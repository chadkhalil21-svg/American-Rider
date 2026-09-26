const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const src=fs.readFileSync(path.join(__dirname,'..','src/state/RideContext.tsx'),'utf8');
assert.ok(src.includes('platformFee(leg1 + fare, null, 0, 0, 2)'), 'Smart Travel fallback must price two transaction units');
assert.ok(src.includes('platformFee(leg1, null, 0, 0, 1)'), 'Smart Travel fallback must subtract first-leg fee');
console.log('✓ Smart Travel client fallback mirrors two-transaction journey economics');
