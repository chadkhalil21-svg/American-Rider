// Guard the phone-first Operator onboarding return path without requiring live
// insurance providers, credit reports, or individual Operator credentials.
import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const background = read('app/operator/background.tsx');
const insurance = read('app/operator/insurance.tsx');
const screeningService = read('src/backend/screening.ts');
const insuranceService = read('src/backend/insuranceStatus.ts');

for (const [name, screen] of [['screening', background], ['insurance', insurance]]) {
  assert.match(screen, /useFocusEffect\(/, name + ': refresh on navigation focus');
  assert.match(screen, /AppState\.addEventListener\('change'/, name + ': listen for phone return');
  assert.match(screen, /nextState === 'active'\) void refresh\(\)/, name + ': refresh after external browser');
  assert.match(screen, /return \(\) => subscription\.remove\(\)/, name + ': clean up when screen leaves focus');
}
assert.match(background, /fetchScreening\(\)\.then\(setStatus\)/);
assert.match(background, /decision === 'pass'/);
assert.match(background, /status\?\.providerUrl/);
assert.match(background, /declareExistingScreening\(/);
assert.match(background, /Linking\.openURL\(status\.providerUrl!\)\.catch\(/, 'recover from a failed provider launch');
assert.doesNotMatch(
  insurance,
  /useEffect\(\(\) => \{ void refresh\(\); \}, \[refresh, op\.docs\.insurance\]\)/,
  'insurance document state must not cause redundant status requests',
);
assert.match(insurance, /const \[nextConfig, nextStatus\] = await Promise\.all\(/);
assert.match(insurance, /reportInsuranceRisk\(kind\)/);
assert.match(insurance, /requestInsuranceConfirmation\(/);
assert.match(screeningService, /\/operator\/screening/);
assert.match(insuranceService, /\/operator\/insurance\/status/);
console.log('PASS: phone-return refresh and onboarding safeguards (source contracts)');
