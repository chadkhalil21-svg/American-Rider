'use strict';
// Research-only; never an authority for fares, payment or market admission.
const crypto=require('node:crypto');
const MAX_AGE=30*60000;
function enabled(env=process.env){
 return env.PRICE_VIEWS_PILOT==='1'&&env.PRICE_VIEWS_PRIVACY_OK==='1'&&
   env.PRICE_VIEWS_TTL_READY==='1'&&String(env.PRICE_VIEWS_KEY||'').length>=32;
}
function signature(encoded,uid,key){
 return crypto.createHmac('sha256',key).update('ar-price-view-v1|'+uid+'|'+encoded).digest('base64url');
}
function routeTag({uid,pickup,dest,env=process.env}){
 if(!enabled(env)||!uid||!pickup||!dest)return null;
 const coords=[pickup.lat,pickup.lng,dest.lat,dest.lng];
 if(!coords.every(x=>Number.isFinite(x))||Math.abs(coords[0])>90||
   Math.abs(coords[2])>90||Math.abs(coords[1])>180||Math.abs(coords[3])>180)return null;
 return crypto.createHmac('sha256',env.PRICE_VIEWS_KEY)
  .update('route-v1|'+uid+'|'+coords.map(x=>x.toFixed(5)).join('|')).digest('base64url');
}
function issue({uid,marketId,distanceBand,totalCents,routeFingerprint,now=Date.now(),env=process.env,
 id=crypto.randomBytes(16).toString('hex')}){
 if(!enabled(env)||!uid||!/^[-a-z0-9]{3,90}$/.test(marketId)||
   !['0-3','3-7','7-15','15-30','30+'].includes(distanceBand)||
   !Number.isSafeInteger(totalCents)||totalCents<300||totalCents>1000000||
   !/^[A-Za-z0-9_-]{43}$/.test(String(routeFingerprint||'')))return null;
 const body=Buffer.from(JSON.stringify([2,id,now,marketId,distanceBand,totalCents,routeFingerprint])).toString('base64url');
 return body+'.'+signature(body,uid,env.PRICE_VIEWS_KEY);
}
function verify(token,{uid,now=Date.now(),env=process.env}){
 if(!enabled(env)||!uid||typeof token!=='string'||token.length>450||
   !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(token))return null;
 const [b,s]=token.split('.'),expected=Buffer.from(signature(b,uid,env.PRICE_VIEWS_KEY));
 const supplied=Buffer.from(s);
 if(supplied.length!==expected.length||!crypto.timingSafeEqual(supplied,expected))return null;
 let data;try{data=JSON.parse(Buffer.from(b,'base64url').toString());}catch{return null;}
 if(!Array.isArray(data)||data.length!==7)return null;
 const [v,id,t,marketId,distanceBand,totalCents,routeFingerprint]=data;
 if(v!==2||!/^[a-f0-9]{32}$/.test(id)||!Number.isSafeInteger(t)||
   t>now+30000||now-t>MAX_AGE||
   !/^[-a-z0-9]{3,90}$/.test(marketId)||
   !['0-3','3-7','7-15','15-30','30+'].includes(distanceBand)||
   !Number.isSafeInteger(totalCents)||totalCents<300||totalCents>1000000||
   !/^[A-Za-z0-9_-]{43}$/.test(String(routeFingerprint||'')))return null;
 return {id,marketId,distanceBand,totalCents,routeFingerprint,issuedAt:t};
}
function matchesBooking(view,{marketId,distanceBand,totalCents,routeFingerprint}){
 return !!view&&view.marketId===marketId&&view.distanceBand===distanceBand&&view.totalCents===totalCents&&view.routeFingerprint===routeFingerprint;
}
module.exports={enabled,routeTag,issue,verify,matchesBooking,MAX_AGE};
