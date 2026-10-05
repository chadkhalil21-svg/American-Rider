const assert=require('node:assert/strict');
const {disputePage}=require('./disputeevidence-ui');
const html=disputePage([{disputeId:'dp_abc',currency:'usd',amountCents:2720,
 evidenceDueAt:Date.now()+86_400_000,reason:'<script>alert(1)</script>',
 travel:{tripNo:'AR-2026',pickup:'<img src=x onerror=alert(1)>',destination:'B',
  quotedCents:2720,status:'completed',completedAt:Date.now()},sha256:'a'.repeat(64)}],{next:'dp_older'});
assert.ok(html.includes('&lt;script&gt;alert(1)&lt;/script&gt;'));
assert.ok(html.includes('&lt;img src=x onerror=alert(1)&gt;'));
assert.ok(!html.includes('<script>alert(1)</script>'));
assert.match(html,/have <strong>not<\/strong> been submitted to Stripe/);
assert.match(html,/Evidence due:/);
assert.match(html,/Older disputes →/);
assert.ok(!/<form[^>]+action=[^>]*stripe/i.test(html));
const empty=disputePage([]);
assert.ok(empty.includes('No captured disputes'));
console.log('PASS dispute evidence view is escaped, paged and explicitly never auto-submits');
