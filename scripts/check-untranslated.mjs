#!/usr/bin/env node
// Fails if a user-visible English literal is rendered without going through t().
// The i18n catalogues being complete (check-i18n.mjs) does not mean the screens
// USE them -- this is the lint that proves they are wired, not merely written.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ROOTS = ['app', 'src'];
// src/withdrawn holds finished work with no entry point — see its README.
const SKIP_DIR = /node_modules|__tests__|\.expo|dist|src\/withdrawn/;
// src/widgets carries 'use widget': expo-widgets compiles it to a native SwiftUI target
// where the i18n runtime does not exist. Localising the Live Activity needs the strings
// passed in as props from the app side — see the note in TravelActivity.tsx.
const SKIP_FILE = /\.(test|spec)\.tsx?$|^src\/i18n\/|^src\/widgets\//;

// Punctuation, symbols, numbers, currency and mono-rendered values are not prose.
const NOT_PROSE = /^[\s\d\W_]*$/u;

// Fragments of JavaScript that sit beside a brace look like prose to the patterns
// below; prose does not carry parentheses, operators or dotted identifiers.
// `useX must be used inside <XProvider>` is a developer error thrown at a programmer,
// never rendered to anyone; it stays in English on purpose.
const DEV_ONLY = /must be used inside/;

// Route paths and URL fragments are addresses, not prose.
const PATHY = /^\/|^[\w-]+\/|`$|^as \w/;

const CODEY = /[()=;:]|\w\.\w|^\s*(else|return|const|await|catch|try|finally)\b/;

// Proper nouns are the same in every language and must never be "translated": the insurers a
// real operator would telephone, and the demonstration operator's own name. Hoisted to module
// scope 20 Sept 2026 — it guarded the object-property rule only, so the SAME company name was
// waved through there and reported by the prose rule two lines later.
const PROPER_NOUN = /^(Progressive Commercial|Garzor Insurance LLC|Coverage Insurance Agency|InsureLimos|Insurify|Miguel|American Rider|Metrorail|Metromover|Metrobus|Tri-Rail|Brightline)$/;


// Inside a text node a colon is prose, not code: "American Rider chooses who brings it back:
// the operator…" was waved through as code, and every line after it with it, because the
// bare-prose chain resets on a skipped line. That paragraph stood in English on the Lost Item
// ladder in five languages (found 16 Sept 2026).
const CODEY_BARE = /[()=;]|\w\.\w|^\s*(else|return|const|await|catch|try|finally)\b/;

// The wordmark lockup is a brand mark and reads identically in every language.
const BRAND = new Set(['AMERICAN RIDER', 'NATIONAL TRANSPORTATION', 'American Rider', 'AR']);

// A sample person's name shown in a placeholder. Names are not translated.
const SAMPLE = new Set(['J. Reyes', '1200 Brickell Ave']);

// Miami place names are proper nouns: a Spanish speaker still goes to the Miami Beach
// Convention Center. The LABELS around them ("Home —", "Work —") do translate, and are
// keys; only the names themselves are listed here.
// "Home — Brickell City Centre" is a place record, not a sentence: prettyPlace() in
// src/data.ts translates the LABEL half at render and leaves the proper noun alone.
// Matching the shape rather than listing the strings means a new seed place is covered,
// and a label outside PLACE_LABELS still gets reported.
const LABELLED_PLACE = /^(Home|Work|Current location) — .+$/;

const PLACE_NAMES = new Set([
  'Miami Beach Convention Center',
  'Miami Airport, Terminal D',
  'Miami International Airport',
]);

function walk(dir, out = []) {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (SKIP_DIR.test(p)) continue;
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.tsx?$/.test(p) && !SKIP_FILE.test(p)) out.push(p);
  }
  return out;
}

const findings = [];
for (const file of ROOTS.flatMap((r) => walk(r))) {
  const src = readFileSync(file, 'utf8');
  const lines = src.split('\n');
  let inBlockComment = false;
  let prevOpensText = false;
  let bareProse = false;
  let inLabelExpr = 0;
  lines.forEach((line, i) => {
    // Comments and JSX comments explain the code; they never reach a reader.
    const raw = line.trim();
    // A comment TRAILING real code is not prose either -- but only strip it when the
    // quotes before it balance, or an apostrophe inside a string ends the line early.
    const cut = raw.startsWith('//') ? -1 : line.indexOf('//');
    const balanced = cut > 0 && (line.slice(0, cut).match(/'/g) || []).length % 2 === 0;
    const trimmed = balanced ? line.slice(0, cut).trim() : raw;
    const opened = trimmed.includes('/*') || trimmed.includes('{/*');
    const closed = trimmed.includes('*/');
    const wasInComment = inBlockComment;
    if (opened && !closed) inBlockComment = true;
    if (closed) inBlockComment = false;
    if (wasInComment || opened || trimmed.startsWith('//') || trimmed.startsWith('*')) return;
    // console.* is written for a developer reading a log, never rendered.
    if (/\bconsole\.\w+\(/.test(line)) return;
    const report = (text) => {
      if (NOT_PROSE.test(text)) return;
      if (!/[A-Za-z]{2}/.test(text)) return;
      const bare = text.trim();
      if (BRAND.has(bare) || SAMPLE.has(bare) || PLACE_NAMES.has(bare)) return;
      if (LABELLED_PLACE.test(bare)) return;
      if (CODEY.test(text) || PATHY.test(text.trim())) return;
      if (DEV_ONLY.test(text)) return;
      findings.push({ file, line: i + 1, text: text.trim() });
    };
    // JSX text nodes: >Some text<
    for (const m of line.matchAll(/(?<![=-])>(?!=)([^<>{}\n]{2,})</g)) report(m[1]);
    // Prose sharing a text node with an expression: >To {dest}<  or  {n} operations<
    // (this class is invisible to the pattern above, which stops at any brace)
    for (const m of line.matchAll(/(?<![=-])>(?!=)([^<>{}\n]*[A-Za-z]{2}[^<>{}\n]*)\{/g)) report(m[1]);
    for (const m of line.matchAll(/\}([^<>{}\n]*[A-Za-z]{2}[^<>{}\n]*)</g)) report(m[1]);
    for (const m of line.matchAll(/\}([^<>{}\n]*[A-Za-z]{2}[^<>{}\n]*)\{/g)) report(m[1]);
    // Prose alone on its own line inside a multi-line text node. It carries no tag and
    // no brace, so every pattern above steps straight over it -- which is exactly how the
    // longest sentences in the app (the ones a translator most needs) stayed invisible.
    if (
      (prevOpensText || bareProse) &&
      !/[<>{}]/.test(trimmed) &&
      /[A-Za-z]{2}/.test(trimmed) &&
      !CODEY_BARE.test(trimmed)
    ) {
      report(trimmed);
      bareProse = true;
    } else if (trimmed) {
      bareProse = false;
    }
    // PROSE IN AN OBJECT LITERAL, not a JSX text node. A drawer menu built its rows as
    // `{ label: 'Wallet', onPress: … }` — nine English words rendered beside three siblings
    // that correctly called t(), so the traveler drawer read half English and half Spanish
    // while every catalogue held the translation (found 12 Sept 2026 on the release build).
    // Every pattern above looks for text around a tag, so an object property never matched.
    {
      // Proper nouns are the same in every language and must never be "translated": the
      // insurers a real operator would telephone, and the demonstration operator's own name.
      const m = trimmed.match(/^(?:label|title|text|placeholder|heading|sub|name|message)\s*:\s*'([^']{2,})'\s*,?$/);
      if (m && /[A-Za-z]{2}/.test(m[1]) && !PROPER_NOUN.test(m[1]) && !CODEY.test(m[1]) && !PATHY.test(m[1]) && !NOT_PROSE.test(m[1])) {
        report(m[1]);
      }
    }
    // An expression that OPENS the line and prose that follows it, with no tag anywhere:
    //   <Text ...>
    //     {plan.directMin} min · I-95 traffic
    // No '>' precedes the words and no '<' or '{' follows them, so every pattern above
    // steps over it. This is how "I-95 traffic" stayed on a screen in five languages.
    {
      const m = trimmed.match(/^\{[^}]*\}\s*([^<>{}\n]*[A-Za-z]{2}[^<>{}\n]*)$/);
      if (m && !CODEY.test(m[1])) report(m[1]);
    }
    // Prose that OPENS a text node and then runs into an expression on the same line:
    //   <Text ...>
    //     By continuing you accept the{' '}
    // The tag is on the previous line, so no '>' precedes the words here and every
    // pattern above misses them. This is how an English lead-in survived on a fully
    // translated Spanish sentence on the front door.
    if (prevOpensText) {
      const head = trimmed.split(/[{<]/)[0];
      if (head && /[A-Za-z]{2}/.test(head) && !CODEY.test(head)) report(head);
    }
    // <Sub>, <Title>, <SectionLabel> render text exactly as <Text> does. Anchoring this
    // to <Text> alone is how the recruiting screen's Spanish page kept an English subtitle.
    // A fragment (`<>`) opens a text node too: `Travel <Mono>…</Mono>.` on the line after a
    // `<>` is how one English word stayed on the Lost Item ladder in five languages.
    prevOpensText = /<[A-Z][A-Za-z]*[^>]*>$|^>$|^<>$/.test(trimmed);
    // Prose held in a plain or template literal rather than a JSX text node -- the
    // coverage-expiry sentences, the emergency SMS, the screening notes. Every pattern
    // above is anchored to JSX, so this whole class was invisible to all of them.
    for (const m of trimmed.matchAll(/(['`])((?:[^'`\\\n]|\\.){12,}?)\1/g)) {
      // Judge the prose, not the expressions inside it: `${names.join(', ')}` carries a
      // parenthesis, and CODEY read that as code and waved the whole sentence through.
      const lit = m[2].replace(/\$\{[^}]*\}/g, '…');
      const words = lit.split(/\s+/).filter((w) => /[A-Za-z]/.test(w));
      const sentenceish = /[.?!]\s|[.?!]$/.test(lit) || words.length >= 4;
      if (CODEY.test(lit) || PROPER_NOUN.test(lit)) continue;
      if (words.length >= 3 && sentenceish && /[a-z]/.test(lit) && !/^[\w.]+$/.test(lit)) {
        report(lit);
      }
    }
    for (const m of line.matchAll(/\b(label|title|placeholder)=\{/g)) inLabelExpr = 2;
    if (inLabelExpr > 0) {
      inLabelExpr -= 1;
      for (const m of line.matchAll(/'([^'\\\n]{4,})'/g)) {
        if (/[a-z]/.test(m[1]) && !/^[\w.-]+$/.test(m[1])) report(m[1]);
      }
    }
    // Human-facing string props
    for (const m of line.matchAll(/\b(placeholder|label|title|accessibilityLabel|tag|eyebrow)="([^"]{2,})"/g)) {
      report(m[2]);
    }
  });
}

if (findings.length) {
  for (const f of findings) console.error(`${f.file}:${f.line}  ${f.text}`);
  console.error(`\n${findings.length} untranslated string(s).`);
  process.exit(1);
}
console.log('no untranslated user-visible strings');
