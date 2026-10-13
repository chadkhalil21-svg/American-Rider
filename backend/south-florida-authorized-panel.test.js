'use strict';
const assert=require('node:assert/strict');
const {approvedSource,authorizedMarketPanelCollectors}=require('./south-florida-authorized-panel');
const {configuredCollectors}=require('./market-evidence-collectors');
const NOW=Date.parse('2026-10-12T20:00:00Z');
const env={AR_PANEL_APPROVED_FOR_MARKET_RESEARCH:'true',
 AR_PANEL_APPROVAL_REFERENCE:'signed-rights-review-001',
 AR_PANEL_READ_TOKEN:'offline_synthetic_only',
 AR_PANEL_HTTPS_URL:'https://approved.example.org/prices'};
const normal=(marketId)=>({
 marketId,serviceClass:'standard',currency:'USD',
 fullOrdinaryTravelerTotal:true,promotionApplied:false,routeConditionsConfirmed:true,
 providerKey:'independent-provider-A',travelerTotalCents:1496,
 observedAt:'2026-10-12T19:58:00Z',routedMiles:6.3,routedMinutes:17,
 daypart:'evening',weekdayWeekend:'weekday',
});
function feedResponse(marketId,changes={},responseOpts={}){
 const body=JSON.stringify({approvalReference:'signed-rights-review-001',
  marketId,pricingResearchUseApproved:true,
  observations:[{...normal(marketId),...changes}]});
 return {
  ok:responseOpts.error?false:true,status:responseOpts.error?403:200,
  headers:{get:()=>responseOpts.oversize?'120001':String(Buffer.byteLength(body))},
  text:async()=>body,
 };
}
async function run(){
 assert.deepEqual(authorizedMarketPanelCollectors({env:{}}),{});
 assert.equal(approvedSource({...env,AR_PANEL_APPROVED_FOR_MARKET_RESEARCH:'false'}),null);
 assert.equal(approvedSource({...env,AR_PANEL_HTTPS_URL:'http://approved.example.org/prices'}),null);
 assert.equal(approvedSource({...env,AR_PANEL_HTTPS_URL:'https://127.0.0.1/prices'}),null);
 assert.equal(approvedSource({...env,AR_PANEL_HTTPS_URL:'https://localhost/prices'}),null);
 assert.equal(approvedSource({...env,AR_PANEL_HTTPS_URL:'https://user:pass@approved.example.org/prices'}),null);
 assert.equal(approvedSource({...env,AR_PANEL_HTTPS_URL:'https://approved.example.org/'}),null);
 assert.equal(typeof configuredCollectors()['chicago-tnp-open-data'],'function');

 for(let pass=1;pass<=2;pass++){
   const urls=[],f=async(url,opts)=>{
     const marketId=new URL(url).searchParams.get('marketId');
     assert.ok(['fl-miami-dade','fl-broward','fl-palm-beach'].includes(marketId));
     assert.equal(new URL(url).hostname,'approved.example.org');
     assert.equal(opts.redirect,'error');
     assert.equal(opts.headers.authorization,'Bearer offline_synthetic_only');
     urls.push(marketId);
     return feedResponse(marketId);
   };
   const collectors=authorizedMarketPanelCollectors({env,fetchFn:f});
   assert.equal(Object.keys(collectors).length,1,'only one source is connected to 3 county plans');
   for(const marketId of ['fl-miami-dade','fl-broward','fl-palm-beach']){
     const got=await collectors['controlled-public-price-panel']({marketId,now:NOW});
     assert.equal(got.length,1);assert.equal(got[0].marketId,marketId);
     assert.equal(got[0].travelerTotalCents,1496);
     assert.equal(got[0].sourceType,'field-panel');
     assert.equal(got[0].sourceId,'controlled-public-price-panel');
     assert.equal(got[0].calendarClass,'ordinary');
     assert.equal(got[0].providerKey,'independent-provider-A');
     assert.equal(got[0].userId,undefined);
   }
   assert.deepEqual(urls,['fl-miami-dade','fl-broward','fl-palm-beach']);
   await assert.rejects(collectors['controlled-public-price-panel']({marketId:'ny-nyc',now:NOW}),/unapproved/);
   console.log('PASS approved market-data connector pass '+pass+' 3 separate counties; zero real requests');
 }
 const cases=[
  [{promotionApplied:true},/promotional/],
  [{fullOrdinaryTravelerTotal:false},/promotional/],
  [{routeConditionsConfirmed:false},/promotional/],
  [{customerId:'personal'},/personalized/],
  [{userId:'personal'},/personalized/],
  [{marketId:'fl-broward'},/scope|permissions/],
  [{observedAt:'2026-08-12T00:00:00Z'},/stale/],
  [{observedAt:'2026-10-13T20:00:00Z'},/stale/],
  [{routedMiles:-1},/routedMiles/],
  [{travelerTotalCents:0},/promotional/],
 ];
 for(const [changes,pattern] of cases){
   const collectors=authorizedMarketPanelCollectors({env,fetchFn:async()=>feedResponse('fl-miami-dade',changes)});
   await assert.rejects(collectors['controlled-public-price-panel']({marketId:'fl-miami-dade',now:NOW}),pattern);
 }
 const oversized=authorizedMarketPanelCollectors({env,fetchFn:async()=>feedResponse('fl-miami-dade',{}, {oversize:true})});
 await assert.rejects(oversized['controlled-public-price-panel']({marketId:'fl-miami-dade',now:NOW}),/oversized/);
 const unavailable=authorizedMarketPanelCollectors({env,fetchFn:async()=>feedResponse('fl-miami-dade',{}, {error:true})});
 await assert.rejects(unavailable['controlled-public-price-panel']({marketId:'fl-miami-dade',now:NOW}),/unavailable/);
 console.log('PASS approval/access denial, out-of-scope, stale, promo, incomplete price, private-person data and provider failures');
}
run().catch(e=>{console.error(e);process.exitCode=1});
