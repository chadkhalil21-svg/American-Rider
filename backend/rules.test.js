// The Firestore rules, read as text, held to the things they must never allow.
//
// A full rules test needs the Firebase emulator, which this repository does not run. That is
// recorded as a gap (AUTH-01/02). This is the cheaper half and it catches the defect that was
// actually there: a rule that let the gated party write the value the gate reads.
//
// Found 19 Sept 2026. `match /users/{uid} { allow read, write: if request.auth.uid == uid }`
// let any signed-in person write every field on their own record — including `screening`,
// which decides whether they may carry passengers, and `insuranceDisclosure`, the statutory
// acknowledgement. The app never wrote either; the rule allowed it, and the Firebase web
// config is public by design.
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');

const R = [];
const check = (l, c, d) => R.push({ l, ok: !!c, d });

const rules = fs.readFileSync(path.join(ROOT, 'firestore.rules'), 'utf8');

// Pull out the users block so assertions cannot accidentally match another collection.
const users = (rules.match(/match \/users\/\{uid\} \{[\s\S]*?\n {4}\}/) || [''])[0];
check('the users block exists', users.length > 0);

check('users is NOT a blanket write',
  !/match \/users\/\{uid\} \{\s*allow read, write:/.test(rules));
check('users grants read, create, update and delete separately',
  /allow read:/.test(users) && /allow create:/.test(users)
  && /allow update:/.test(users) && /allow delete:/.test(users));

// The three fields the server trusts must not appear in any allowed-key list.
const allowed = [...users.matchAll(/hasOnly\(\[([\s\S]*?)\]\)/g)].map((m) => m[1]).join(' ');
check('at least one allow-list constrains the writable keys', allowed.length > 0);
for (const field of ['screening', 'insuranceDisclosure', 'stripeAccountId']) {
  check(`a phone cannot write ${field}`, !new RegExp(`'${field}'`).test(allowed), allowed.slice(0, 120));
}

// And the fields the app genuinely writes must still be allowed, or sign-up and push break.
for (const field of ['name', 'mobile', 'email', 'pushToken', 'pushPrefs']) {
  check(`the app can still write ${field}`, new RegExp(`'${field}'`).test(allowed));
}

// The collections that must stay closed to a phone entirely.
check('operators are never writable from the app', /match \/operators\/\{operatorId\}[\s\S]*?allow write: if false;/.test(rules));
check('support tickets are closed in both directions', /match \/support_tickets\/\{caseNo\}[\s\S]*?allow read, write: if false;/.test(rules));
check('a travel is never deleted from a phone', /match \/rides\/\{rideId\}[\s\S]*?allow delete: if false;/.test(rules));
check('a message is never edited or deleted', /match \/messages\/\{messageId\}[\s\S]*?allow update, delete: if false;/.test(rules));

// The money fields on a travel stay unwritable, which is what touchesOnly is for.
const rides = (rules.match(/match \/rides\/\{rideId\} \{[\s\S]*?\n {4}\}/) || [''])[0];
for (const field of ['costCents', 'operatorId', 'tripNo', 'paymentIntentId']) {
  check(`a phone cannot write ${field} on a travel`, !new RegExp(`'${field}'`).test(rides));
}

// ——— F-A: the phone neither creates travels nor reads the fleet ————————————————
check('a phone cannot CREATE a travel', /match \/rides\/\{rideId\}[\s\S]*?allow create: if false;/.test(rules));
check('THE FLEET IS NOT READABLE FROM A PHONE',
  /match \/operators\/\{operatorId\}[\s\S]*?allow read: if false;/.test(rules));
check('the fleet is still not writable from a phone',
  /match \/operators\/\{operatorId\}[\s\S]*?allow write: if false;/.test(rules));

// And the app must genuinely not depend on either, or closing them breaks booking.
const fs2 = require('fs');
const path2 = require('path');
function walk(dir, out = []) {
  for (const e of fs2.readdirSync(dir, { withFileTypes: true })) {
    const full = path2.join(dir, e.name);
    if (e.isDirectory()) walk(full, out);
    else if (/\.(ts|tsx)$/.test(e.name)) out.push(full);
  }
  return out;
}
const appSrc = [
  ...walk(path2.join(ROOT, 'src')),
  ...walk(path2.join(ROOT, 'app')),
].map((f) => ({ f, t: fs2.readFileSync(f, 'utf8') }));
const creates = appSrc.filter(({ t }) => /addDoc\(\s*collection\(db, 'rides'\)/.test(t));
check('no client file creates a travel', creates.length === 0, creates.map((c) => c.f).join(', '));
const readsFleet = appSrc.filter(({ t }) => /collection\(db, 'operators'\)/.test(t));
check('no client file reads the fleet', readsFleet.length === 0, readsFleet.map((c) => c.f).join(', '));

// ——— storage.rules: the operator document upload path ————————————————————————————
// It had no rule, so the deny-all refused every document upload (found 22 Sept 2026).
const storage = fs.readFileSync(path.join(ROOT, 'storage.rules'), 'utf8');
const docs = (storage.match(/match \/operator-documents\/\{uid\}\/\{fileName\} \{[\s\S]*?\n {4}\}/) || [''])[0];
const uploadPath = fs.readFileSync(path.join(ROOT, 'src', 'backend', 'documentUpload.ts'), 'utf8');
check('the app uploads documents under operator-documents/{uid}/',
  /operator-documents\/\$\{uid\}\//.test(uploadPath));
check('storage.rules has a rule for that path', docs.length > 0);
check('only the owner may create there', /allow create: if request\.auth != null\s*&& request\.auth\.uid == uid/.test(docs));
check('uploads are images of bounded size', /contentType\.matches\('image\/\.\*'\)/.test(docs) && /request\.resource\.size </.test(docs));
check('nobody may replace or delete the evidence', /allow update, delete: if false;/.test(docs));

// ——— messages are bounded ————————————————————————————————————————————————————————
const msgs = (rules.match(/match \/messages\/\{messageId\} \{[\s\S]*?\n {4}\}/) || [''])[0];
check('messages: only the fields the app writes', /keys\(\)\.hasOnly\(\['tripNo', 'from', 'travelerUid', 'operatorId', 'lostItemId', 'text', 'createdAt'\]\)/.test(msgs));
check('messages: text is bounded to 2,000 characters', /text\.size\(\) <= 2000/.test(msgs));
const writer = fs.readFileSync(path.join(ROOT, 'src', 'backend', 'messages.ts'), 'utf8');
check('messages: the app writes no field the rule refuses',
  ['tripNo', 'from', 'travelerUid', 'operatorId', 'lostItemId', 'text', 'createdAt'].every((k) => new RegExp(`\\b${k}:`).test(writer)));

let bad = 0;
for (const r of R) { if (!r.ok) bad++; console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.l}${r.ok ? '' : '  — ' + (r.d || '')}`); }
console.log(`\n${R.length - bad}/${R.length} passed`);
process.exit(bad ? 1 : 0);
