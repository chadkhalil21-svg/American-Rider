const assert=require('node:assert/strict');
const {casesPage}=require('./opscases-ui');
const urgent=casesPage({cases:[{id:'AR-C-001',caseNo:'AR-C-001',kind:'emergency',reason:'Payment disputed',
 description:'<script>alert(1)</script>',status:'open',createdAt:Date.now(),
 trip:{no:'AR-001'}}],next:'AR-C-002'});
assert.match(urgent,/PAYMENT DEADLINE/);
assert.ok(!urgent.includes('<h2>SAFETY EMERGENCY'));
assert.ok(urgent.includes('&lt;script&gt;alert(1)&lt;/script&gt;'));
assert.ok(!urgent.includes('<script>alert(1)</script>'));
assert.match(urgent,/minlength="12"/);
assert.match(urgent,/aria-live="polite"/);
assert.match(urgent,/Older open cases →/);
const safety=casesPage({cases:[{id:'AR-C-003',caseNo:'AR-C-003',kind:'emergency',
 reason:'Traveler requested help',acknowledgedAt:Date.now(),acknowledgedBy:'alice'}],next:null});
assert.match(safety,/SAFETY EMERGENCY/);
assert.match(safety,/Recording acknowledgement here does not dispatch help/);
assert.match(safety,/Close after resolution/);
assert.match(safety,/Acknowledged/);
console.log('PASS case queue differentiates payment deadline and safety, escapes content, and requires an audited action note');
