const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const issues = fs.readFileSync(path.join(__dirname, '..', 'app', 'issues.tsx'), 'utf8');

// Patron Support is a stateful hierarchy inside one route. Back from a category/detail must
// return to the category list before the router stack is allowed to leave /issues.
assert.ok(
  /const supportBack = \(\) => \{[\s\S]*ride\.issueState !== null[\s\S]*resetIssue\(\)[\s\S]*goBack\(\)/.test(issues),
  'Patron Support Back must unwind in-route issue state before route navigation',
);
assert.ok(
  issues.includes('<LetterheadBar onBack={supportBack} />'),
  'Patron Support header must use the hierarchical back handler',
);
assert.equal(
  /<LetterheadBar onBack=\{goBack\} \/>/.test(issues),
  false,
  'Patron Support must not bypass its in-route hierarchy with raw route Back',
);

const reserve = fs.readFileSync(path.join(__dirname, '..', 'app', 'reserve.tsx'), 'utf8');
assert.ok(
  reserve.includes("user?.displayName?.trim() || t('traveler.me')"),
  'Self Traveler identity should prefer the authenticated profile name over generic “Me”',
);

console.log('✓ Patron Support Back retraces issue detail → categories → route parent');
console.log('✓ Travel Confirmation uses the authenticated Traveler display name when available');


const operatorContext = fs.readFileSync(path.join(__dirname, '..', 'src', 'state', 'OperatorContext.tsx'), 'utf8');
assert.equal(/r\.tripNo \|\| r\.rideId \|\|/.test(operatorContext), false, 'Operator acceptance must never fabricate a Travel Number');
assert.ok(operatorContext.includes("if (!r.tripNo && !r.rideId)"), 'Operator acceptance must fail closed without authoritative Travel identity');
const insurance = fs.readFileSync(path.join(__dirname, '..', 'app', 'operator', 'insurance.tsx'), 'utf8');
for (const literal of ["'Not recorded'", "'Not sent'", "'Not submitted'", "'Not checked'", "'Not accepted'", "'Being checked'", "'Take a photograph'", "'Choose a file'"]) assert.equal(insurance.includes(literal), false, 'Insurance workflow must localize user-visible literal: ' + literal);
console.log('✓ Operator acceptance fails closed on missing authoritative Travel identity');
console.log('✓ Insurance action and failure states are localized');


assert.ok(operatorContext.includes("useState(UNKNOWN_PICKUP_WAIT)") || fs.readFileSync(path.join(__dirname, '..', 'src', 'state', 'RideContext.tsx'), 'utf8').includes("useState(UNKNOWN_PICKUP_WAIT)"), 'Pickup ETA must initialize unknown, not as a fabricated minute estimate');
assert.ok(reserve.includes("ride.pickupWait > 0 ?"), 'Travel confirmation must hide pickup ETA until an estimate exists');
const operatorVehicle = fs.readFileSync(path.join(__dirname, '..', 'app', 'operator', 'vehicle.tsx'), 'utf8');
assert.equal(operatorVehicle.includes("showNote('Saved.')"), false, 'Operator vehicle save confirmation must be localized');
assert.equal(operatorVehicle.includes(": 'Save'"), false, 'Operator vehicle save action must be localized');
console.log('✓ Pickup ETA remains unknown until authoritative evidence exists');
console.log('✓ Operator vehicle save states are localized');
