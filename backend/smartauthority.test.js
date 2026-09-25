const assert=require('node:assert/strict');
const { journeyFor }=require('./fareauthority');

function dbWith(rows){
  return {collection(){return {where(){return this},limit(){return this},async get(){return {docs:rows.map(x=>({data:()=>x}))}}}}};
}
(async()=>{
  const base={travelerUid:'u',tripNo:'AR-1',paymentIntentId:'pi',status:'completed',travelCostCents:1000,governmentFeeCents:0,tollCents:0};
  assert.ok(await journeyFor({db:dbWith([base]),uid:'u',journeyNo:'AR-1'}));
  assert.equal(await journeyFor({db:dbWith([{...base,journeyNo:'AR-0'}]),uid:'u',journeyNo:'AR-1'}),null,'leg 2 cannot become a new leg 1');
  assert.equal(await journeyFor({db:dbWith([{...base,status:'accepted'}]),uid:'u',journeyNo:'AR-1'}),null,'unfinished leg cannot subsidize leg 2');
  assert.equal(await journeyFor({db:dbWith([{...base,paymentIntentId:null}]),uid:'u',journeyNo:'AR-1'}),null,'unpaid leg cannot subsidize leg 2');
  console.log('✓ Smart Travel journey reference is paid, completed and non-chainable');
})().catch(e=>{console.error(e);process.exitCode=1});
