#!/usr/bin/env node
// Fails on a catalogue key nothing renders.
//
// Five languages have to be written for every key, so a key nobody uses is four
// translations of nothing — and, more usefully, it is the fingerprint of a wiring
// mistake: a key added and then never wired, or an older key orphaned when a screen
// was pointed at a new one. Twenty of those had accumulated by 5 Sept 2026.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const keysOf = (src) => {
  const out = [];
  let section = null;
  for (const line of src.split('\n')) {
    const s = line.trim();
    if (s.startsWith('//')) continue;
    const sec = s.match(/^(\w+):\s*\{/);
    if (sec) { section = sec[1]; continue; }
    if (s === '},' || s === '}') { section = null; continue; }
    const k = s.match(/^(\w+):\s*['"`]/);
    if (k && section) out.push(`${section}.${k[1]}`);
  }
  return out;
};

const files = [];
const walk = (d) => {
  for (const e of readdirSync(d)) {
    const p = join(d, e);
    if (/node_modules|\.expo|dist/.test(p)) continue;
    if (statSync(p).isDirectory()) walk(p);
    // Keys reached dynamically (QUAL_DOCS, WHY, ROWS, DOCUMENTS) are stored in source
    // as the literal key string, so a plain substring search finds those too.
    else if (/\.tsx?$/.test(p) && !p.includes('src/i18n/')) files.push(p);
  }
};
walk('app');
walk('src');

const blob = files.map((f) => readFileSync(f, 'utf8')).join('\n');
const keys = keysOf(readFileSync('src/i18n/en.ts', 'utf8'));
const unused = keys.filter((k) => !blob.includes(k));

// THE REVERSE CHECK. A screen can name a key no catalogue has — `t('traveler.continue')` when
// the key lives under `common` — and the reader sees `[missing "es.traveler.continue"
// translation]` in a button. Seen on the simulator, 10 Sept 2026. Every literal
// 'namespace.key' in the code must exist in the English catalogue.
const namespaces = new Set(keys.map((k) => k.split('.')[0]));
const keySet = new Set(keys);
const used = new Set(
  [...blob.matchAll(/['"`]([a-z]+\.[A-Za-z0-9_]+)['"`]/g)]
    .map((m) => m[1])
    .filter((k) => namespaces.has(k.split('.')[0])),
);
const missing = [...used].filter((k) => !keySet.has(k));
if (missing.length) {
  missing.forEach((k) => console.error(`  missing  ${k}  (used in the code, absent from src/i18n/en.ts)`));
  console.error(`\n${missing.length} key(s) the code names that no catalogue has.`);
  process.exit(1);
}

if (unused.length) {
  unused.forEach((k) => console.error(`  unused  ${k}`));
  console.error(`\n${unused.length} catalogue key(s) nothing renders.`);
  process.exit(1);
}
console.log(`all ${keys.length} keys are used`);
