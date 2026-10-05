const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript'),path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../src/backend/markets.ts'),'utf8');
const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
let calls=0,response={active:[{id:'miami',status:'active'}],here:{id:'miami',name:'Miami-Dade',status:'active'}};
const context={exports:{},require:(name)=>{assert.equal(name,'../config');return {PAYMENT_SERVER_URL:'https://backend.example.test'};},
 fetch:async(url,options)=>{calls++;assert.equal(url,'https://backend.example.test/markets/at');
  assert.equal(options.method,'POST');assert.deepEqual(JSON.parse(options.body),{lat:Number(JSON.parse(options.body).lat),lng:Number(JSON.parse(options.body).lng)});
  return response;},
 AbortController,setTimeout,clearTimeout,Date,Promise};
vm.runInNewContext(code,context,{filename:'src/backend/markets.ts'});
const {publicPickupMarket}=context.exports;
const json=(body,ok=true)=>({ok,json:async()=>body});
(async()=>{
 response=json({active:[{id:'miami',status:'active'}],here:{id:'miami',name:'Miami-Dade',status:'active'}});
 assert.equal((await publicPickupMarket(25.77,-80.19)).status,'active');
 assert.equal((await publicPickupMarket(25.77,-80.19)).status,'active');assert.equal(calls,1,'only one low-cost bootstrap for a recent pickup');
 response=json({active:[],here:{id:'palm',name:'Palm Beach',status:'onboarding'}});
 assert.equal((await publicPickupMarket(26.7,-80.05)).status,'onboarding');
 response=json({active:[],here:null});
 assert.equal((await publicPickupMarket(40.75,-73.98)).status,'waitlist');
 response=json({active:[],here:{id:'miami',status:'unavailable'}});
 assert.equal((await publicPickupMarket(25.78,-80.20)).status,'unavailable');
 response=json({active:[],here:{id:'fake',status:'active'}});
 await assert.rejects(()=>publicPickupMarket(41,-73.98),/market_active_inconsistent/);
 response=json({});await assert.rejects(()=>publicPickupMarket(42,-73.98),/market_response_invalid/);
 response=json({},false);await assert.rejects(()=>publicPickupMarket(43,-73.98),/market_unavailable/);
 const ui=fs.readFileSync(path.join(__dirname,'../app/index.tsx'),'utf8');
 const server=fs.readFileSync(path.join(__dirname,'server.js'),'utf8');
 assert.ok(server.includes("app.post('/markets/at', LIMITS.quoteIp, publicMarketResponse)"));
 assert.match(ui,/canOfferNewTravel\s*&&\s*<Pressable[\s\S]*reserveBtn/);
 assert.match(ui,/canOfferNewTravel\s*&&\s*<Pressable[\s\S]*scheduleForLater/);
 assert.ok(ui.includes('marketInterestPrivacy')&&ui.includes('waitlistJoin'));
 console.log('PASS public market bootstrap is cached, active requires corroboration, outages fail closed, new sale controls are gated');
})().catch(e=>{console.error(e);process.exitCode=1;});
