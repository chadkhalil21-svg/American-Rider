'use strict';
const assert=require('node:assert/strict');
const {PAGES,WEEK,extractOfficialTaxiRate,compareSources,
 readPublicPage,sweepSouthFloridaPublicRates}=require('./south-florida-public-rates');
const NOW=Date.parse('2026-10-12T20:00:00Z');
const miami='<html><body>Taxicabs: The metered rate is calculated at: $2.95 for first 1/6 of a mile, $0.85 for each additional 1/6 mile until 1 mile, $0.40 for each 1/6 mile after that, and $0.40 per minute wait charge.</body></html>';
const legislative='<html><body>Under the current rates, the maximum taxicab metered rate is calculated at: $2.95 for first 1/6 of a mile. $0.85 for each additional 1/6 mile until 1 mile. $0.55 for each 1/6 mile after that. Later the document compares proposed CPI rates of $3.11 and $0.90.</body></html>';
const consistent=miami.replace('$0.40 for each 1/6 mile after that','$0.55 for each 1/6 mile after that');
const fakeDb=()=>{
  const docs=new Map();
  return {
    docs,
    collection(name){assert.equal(name,'market_public_rate_watch');return{
      doc(id){assert.equal(id,'fl-miami-dade');return{
        get:async()=>({exists:docs.has(id),data:()=>structuredClone(docs.get(id))}),
        set:async(v)=>docs.set(id,structuredClone(v))
      }}
    }}
  };
};
function provider(htmls,options={}){
  let calls=0;
  const f=async(url,args)=>{
    calls++;assert.ok(PAGES.some(p=>p.url===url),'must only read fixed public government domains');
    assert.equal(args.redirect,'error','no redirects to third party');
    if(options.error&&calls===options.error)throw Error('source down');
    const html=htmls[PAGES.findIndex(p=>p.url===url)];
    return {ok:true,status:200,headers:{get:()=>options.oversize?'300001':String(Buffer.byteLength(html))},
      text:async()=>html};
  };
  f.calls=()=>calls;return f;
}
(async()=>{
  assert.equal(PAGES.length,2);
  assert.equal(extractOfficialTaxiRate(miami).afterMileSixthCents,40);
  assert.equal(extractOfficialTaxiRate(legislative).afterMileSixthCents,55);
  assert.equal(extractOfficialTaxiRate(consistent).afterMileSixthCents,55);
  assert.equal(extractOfficialTaxiRate('<html>Cab fare $999.99. No evidence.</html>'),null);
  assert.equal(extractOfficialTaxiRate('<script>const x="taxi";</script>'),null);
  const id=PAGES[0].id,other=PAGES[1].id,rate=extractOfficialTaxiRate(consistent);
  const row=x=>({id:x,rate});
  assert.equal(compareSources([row(id),row(id)]).ok,false);
  assert.equal(compareSources([row(id),row(other)]).status,'tariff_consistent');
  assert.equal(compareSources([row(id),{id:other,rate:extractOfficialTaxiRate(miami)}]).status,'source_conflict');

  for(let pass=1;pass<=2;pass++){
    const db=fakeDb(),f=provider([miami,legislative]);
    const first=await sweepSouthFloridaPublicRates({db,fetchFn:f,now:NOW});
    assert.equal(first.ok,true);
    assert.equal(first.status,'source_conflict','genuine official disagreement never passed off as market data');
    assert.equal(first.rateAuthority,false);
    assert.equal(first.pricePromotionAllowed,false);
    assert.equal(first.travelerTotalComparable,false);
    assert.equal(first.pages.length,2);
    assert.equal(db.docs.get('fl-miami-dade').pages[0].rate.afterMileSixthCents,40);
    assert.equal(db.docs.get('fl-miami-dade').pages[1].rate.afterMileSixthCents,55);
    assert.equal(f.calls(),2,'two HTTP reads per weekly refresh');
    const repeat=await sweepSouthFloridaPublicRates({db,fetchFn:f,now:NOW+WEEK-1});
    assert.equal(repeat.skipped,'weekly_cadence');
    assert.equal(f.calls(),2,'daily process/Render restarts do not trigger extra provider reads');
    const resolved=provider([consistent,legislative]);
    const next=await sweepSouthFloridaPublicRates({db,fetchFn:resolved,now:NOW+WEEK});
    assert.equal(next.status,'tariff_consistent');
    assert.equal(next.rateAuthority,false,'even matching official TAXI rates are not TNC market prices');
    assert.equal(next.pricePromotionAllowed,false);
    assert.equal(next.travelerTotalComparable,false);
    assert.equal(resolved.calls(),2);
    console.log('PASS source-led Miami-Dade tariff research pass '+pass+': official source disagreement, week-bound refresh, nonpromotion');
  }
  const down=fakeDb(),offline=provider([miami,legislative],{error:1});
  let result=await sweepSouthFloridaPublicRates({db:down,fetchFn:offline,now:NOW});
  assert.equal(result.ok,false);
  assert.equal(result.status,'unverified');
  assert.equal(down.docs.get('fl-miami-dade').rateAuthority,false);
  assert.equal(down.docs.get('fl-miami-dade').failedSources.length,1);
  const empty=await sweepSouthFloridaPublicRates({db:null,now:NOW});
  assert.equal(empty.ok,false);
  await assert.rejects(readPublicPage(PAGES[0],{fetchFn:provider([miami,legislative],{oversize:true})}),/oversized/);
  console.log('PASS official rate watcher: offline, oversized and source changed fail closed, no live fares');
})().catch(e=>{console.error(e);process.exitCode=1});
