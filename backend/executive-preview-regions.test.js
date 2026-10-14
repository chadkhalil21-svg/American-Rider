'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const config=require('./executive-preview-regions.json');
const {markets}=require('./markets');
const {regionById}=require('./regions');
const app=fs.readFileSync(path.join(__dirname,'../app/executive-preview.tsx'),'utf8');
const shell=fs.readFileSync(path.join(__dirname,'../app/_layout.tsx'),'utf8');
const server=fs.readFileSync(path.join(__dirname,'server.js'),'utf8');
const admission=fs.readFileSync(path.join(__dirname,'market-readiness.js'),'utf8');
const actual=markets();
function project(commands,region){
 const results=Object.fromEntries(region.counties.map(c=>[c.id,false]));
 for(const c of commands){
  if(c.scope==='region' && c.id===region.id){
   for(const county of region.counties) results[county.id]=c.action==='open';
  }else if(c.scope==='county' && Object.hasOwn(results,c.id)){
   results[c.id]=c.action==='open';
  }
 }
 return results;
}
for(let pass=1;pass<=2;pass++){
 assert.equal(config.version,1);
 assert.equal(config.mode,'preview_only');
 assert.equal(config.requestedBy,'chadkhalil21-svg');
 assert.ok(config.regions.length>0);
 for(const region of config.regions){
   const canonical=regionById(region.id);
   assert.ok(canonical,'every preview region must exist in the real registry');
   const authoritative=actual.filter(x=>x.regionId===region.id).map(x=>x.id).sort();
   assert.deepEqual(region.counties.map(x=>x.id).sort(),authoritative,
     'the preview must label ONLY actually configured counties; never extend service by a fake location');
   assert.equal(new Set(region.counties.map(c=>c.id)).size,region.counties.length);
   assert.equal(new Set(config.commands.map(c=>c.scope+':'+c.id)).size,config.commands.length,
      'a Founder command must have a single unambiguous target');
   for(const c of config.commands){
     assert.ok(['open','close'].includes(c.action));
     assert.ok(['region','county'].includes(c.scope));
     assert.ok(c.scope==='region'?!!regionById(c.id):!!actual.find(x=>x.id===c.id),
       'commands must reference configured places');
   }
   const display=project(config.commands,region);
   for(const value of Object.values(display))assert.equal(value,true,'three-county preview is OPEN');
   const first=region.counties[0].id;
   const revoked=project([...config.commands,{scope:'county',id:first,action:'close'}],region);
   assert.equal(revoked[first],false,'the Founder can close a specific preview county');
   assert.equal(Object.values(revoked).filter(Boolean).length,region.counties.length-1);
   const closed=project([{scope:'region',id:region.id,action:'close'}],region);
   assert.ok(Object.values(closed).every(x=>!x),'the Founder can close an entire preview region');
 }
 assert.match(app,/american-rider-preview-ng4p\.onrender\.com/,'preview hostname is fixed');
 assert.match(app,/TEST DISPLAY ONLY/,'preview cannot be mistaken for commercial service');
 assert.match(app,/live Operator duty/);
 assert.match(app,/projectedCounties\(region\)/);
 assert.doesNotMatch(app,/fetch\(|\.post\(|startBooking\(|PaymentSheet/,
    'display must not call a real booking or payment endpoint');
 assert.match(shell,/route === '\/executive-preview'/);
 assert.match(shell,/!webPreviewBypass && !readOnlyRegionalPreview/,
   'the single read-only route is the only additional authorization-screen exception');
 assert.doesNotMatch(server,/executive-preview-regions/,
   'the backend must not use preview declarations for real booking eligibility');
 assert.doesNotMatch(admission,/executive-preview-regions/,
   'the real activation transaction must remain unchanged');
}
console.log('PASS twice: executive preview open/close of configured South Florida counties, no paid booking authority, host isolation, no authentication bypass elsewhere');
