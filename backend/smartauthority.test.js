const assert=require('node:assert/strict');
const { journeyFor }=require('./fareauthority');

function dbWith(rows){
  return {
    collection(){
      const q = {
        filters: [],
        where(field, op, value){ this.filters.push([field,value]); return this; },
        limit(){ return this; },
        async get(){
          const matches=rows.filter((x)=>this.filters.every(([k,v])=>String(x[k]||'')===String(v)));
          return { docs: matches.map((x)=>({ data:()=>x })) };
        },
      };
      return q;
    },
  };
}

(async()=>{
  const base={travelerUid:'u',tripNo:'AR-1',paymentIntentId:'pi',status:'completed',travelCostCents:1000,governmentFeeCents:0,tollCents:0};
  assert.ok(await journeyFor({db:dbWith([base]),uid:'u',journeyNo:'AR-1'}));
  assert.equal(await journeyFor({db:dbWith([{...base,journeyNo:'AR-0'}]),uid:'u',journeyNo:'AR-1'}),null,'leg 2 cannot become a new leg 1');
  assert.equal(await journeyFor({db:dbWith([{...base,status:'accepted'}]),uid:'u',journeyNo:'AR-1'}),null,'unfinished leg cannot subsidize leg 2');
  assert.equal(await journeyFor({db:dbWith([{...base,paymentIntentId:null}]),uid:'u',journeyNo:'AR-1'}),null,'unpaid leg cannot subsidize leg 2');
  assert.equal(await journeyFor({db:dbWith([{...base,travelerUid:'other'}]),uid:'u',journeyNo:'AR-1'}),null,'another Booker cannot reference this leg');
  console.log('✓ Smart Travel journey reference is paid, completed and non-chainable');
})().catch(e=>{console.error(e);process.exitCode=1});
