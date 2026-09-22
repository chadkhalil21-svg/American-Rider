// The app's native dependency graph, read from the root lockfile.
// Run: node backend/deps.test.js
//
// Pins the 22 Sept 2026 fixes so a later lockfile regeneration cannot quietly undo them:
//   - expo 57.0.8 / react-native 0.86.0 shipped Hermes V1 250829098.0.14, which has a known
//     memory regression; 250829098.0.16 is the first fixed build (expo-doctor, SDK 57 notes).
//   - expo-constants, expo-application and @expo/ui were each installed twice, because a newer
//     dependent needed a higher patch than the hoisted copy. A native module must exist once.
const fs = require('fs');
const path = require('path');

const R = [];
const check = (l, c, d) => R.push({ l, ok: !!c, d });

const lock = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package-lock.json'), 'utf8')).packages;
const ver = (name) => lock[`node_modules/${name}`]?.version || '';
const cmp = (a, b) => {
  const x = a.split('.').map(Number);
  const y = b.split('.').map(Number);
  for (let i = 0; i < Math.max(x.length, y.length); i++) {
    if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) - (y[i] || 0);
  }
  return 0;
};

check('expo is 57.0.9 or later within SDK 57', ver('expo').startsWith('57.0.') && cmp(ver('expo'), '57.0.9') >= 0, ver('expo'));
check('react-native is 0.86.2 or later within 0.86', ver('react-native').startsWith('0.86.') && cmp(ver('react-native'), '0.86.2') >= 0, ver('react-native'));
check('Hermes is 250829098.0.16 or later (the memory fix)', cmp(ver('hermes-compiler'), '250829098.0.16') >= 0, ver('hermes-compiler'));

for (const name of ['expo-constants', 'expo-application', '@expo/ui', 'expo-widgets', 'expo-modules-core', 'react-native']) {
  const copies = Object.keys(lock).filter((k) => k.endsWith(`node_modules/${name}`));
  check(`${name} is installed exactly once`, copies.length === 1, copies.join(', '));
}

let bad = 0;
for (const r of R) { if (!r.ok) bad++; console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.l}${r.ok ? '' : '  — ' + (r.d || '')}`); }
console.log(`\n${R.length - bad}/${R.length} passed`);
process.exit(bad ? 1 : 0);
