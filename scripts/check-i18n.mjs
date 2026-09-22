// EVERY LANGUAGE MUST COVER EVERY KEY.
//
// i18n.enableFallback means a missing translation renders the ENGLISH sentence rather than a
// raw key. That is the right behaviour at runtime and a terrible one during development: a
// half-translated screen looks finished, in English, to the person least able to report it.
// This fails the build instead.
import { readFileSync, readdirSync } from 'node:fs';

const DIR = new URL('../src/i18n/', import.meta.url);
const keysOf = (src) => {
  const out = [];
  let section = null;
  for (const line of src.split('\n')) {
    const s = line.trim();
    if (s.startsWith('//') || s.startsWith('*')) continue;
    const sec = s.match(/^(\w+):\s*\{/);
    if (sec) { section = sec[1]; continue; }
    if (s === '},' || s === '}') { section = null; continue; }
    const key = s.match(/^(\w+):\s*['"`]/);
    if (key && section) out.push(`${section}.${key[1]}`);
  }
  return out;
};

// A key written twice in the same section is not a harmless repeat: the later entry
// silently wins, so a correct translation can sit in the file and never render. The
// same name in two DIFFERENT sections is fine, which is why this compares the
// section-qualified names rather than the bare ones.
const duplicatesIn = (keys) => {
  const seen = new Set();
  return [...new Set(keys.filter((k) => (seen.has(k) ? true : (seen.add(k), false))))];
};

const langs = readdirSync(DIR).filter((f) => /^[a-z]{2}\.ts$/.test(f)).map((f) => f.slice(0, 2));
const table = Object.fromEntries(langs.map((l) => [l, keysOf(readFileSync(new URL(`${l}.ts`, DIR), 'utf8'))]));
const base = table.en;
let bad = 0;

for (const l of langs) {
  const dupes = duplicatesIn(table[l]);
  if (dupes.length) {
    bad += 1;
    console.log(`FAIL  ${l}: ${dupes.length} duplicate key(s) — the later entry silently wins`);
    dupes.slice(0, 8).forEach((k) => console.log(`        duplicate  ${k}`));
  }
  if (l === 'en') continue;
  const missing = base.filter((k) => !table[l].includes(k));
  const extra = table[l].filter((k) => !base.includes(k));
  if (missing.length || extra.length) {
    bad += 1;
    console.log(`FAIL  ${l}: ${missing.length} missing, ${extra.length} unknown`);
    missing.slice(0, 8).forEach((k) => console.log(`        missing  ${k}`));
    extra.slice(0, 8).forEach((k) => console.log(`        unknown  ${k}`));
  } else {
    console.log(`PASS  ${l}: all ${base.length} keys translated`);
  }
}
// AND EVERY KEY A SCREEN ASKS FOR MUST EXIST. A complete catalogue does not mean the
// screens ask for the right names: t('traveler.typo') renders the literal key text to the
// traveler, in every language, and no test catches it because the module is fine. Two such
// keys shipped this way (platformCommission, operationInProgress) before this check existed.
const defined = new Set(base.map((k) => k.split('.')[1]));
const referenced = [];
const walk = (dir) => {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = `${dir}/${e.name}`;
    if (/node_modules|\.expo|dist|withdrawn|src\/i18n/.test(p)) continue;
    if (e.isDirectory()) walk(p);
    else if (/\.tsx?$/.test(p)) {
      for (const m of readFileSync(p, 'utf8').matchAll(/\btr?\('(\w+)\.(\w+)'/g)) {
        if (!defined.has(m[2])) referenced.push(`${p}  ${m[1]}.${m[2]}`);
      }
    }
  }
};
for (const root of ['app', 'src']) walk(root);
if (referenced.length) {
  bad += 1;
  console.log(`\nFAIL  ${referenced.length} key(s) asked for but never defined:`);
  referenced.slice(0, 12).forEach((r) => console.log(`        ${r}`));
}

console.log(bad ? `\n${bad} problem(s)` : `\nall ${langs.length} languages complete (${base.length} keys)`);
process.exit(bad ? 1 : 0);
