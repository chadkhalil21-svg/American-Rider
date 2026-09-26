const assert=require('node:assert/strict');
const {ageOn,MIN_AGE,MAX_AGE}=require('./family');

const utc=(s)=>new Date(s+'T12:00:00Z').getTime();
assert.equal(MIN_AGE,13);
assert.equal(MAX_AGE,17);
assert.equal(ageOn('2013-09-25',utc('2026-09-25')),13,'thirteenth birthday becomes eligible');
assert.equal(ageOn('2013-09-26',utc('2026-09-25')),12,'day before thirteenth birthday remains ineligible');
assert.equal(ageOn('2008-09-25',utc('2026-09-25')),18,'eighteenth birthday ages out immediately');
assert.equal(ageOn('2008-09-26',utc('2026-09-25')),17,'day before eighteenth birthday remains eligible');
assert.equal(ageOn('not-a-date',utc('2026-09-25')),null,'invalid birth date is never eligible');
console.log('✓ Family Teen Travel age boundaries');
