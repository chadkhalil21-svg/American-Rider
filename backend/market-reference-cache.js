'use strict';
// No external fetch on booking. Collapse concurrent Firestore reference reads.
// Never cache errors; a 30-second snapshot TTL never authorizes a market.
function createMarketReferenceCache({load,now=()=>Date.now(),ttlMs=30000,maxEntries=128}={}){
 if(typeof load!=='function')throw new TypeError('load required');
 if(!Number.isSafeInteger(ttlMs)||ttlMs<1000)throw new RangeError('ttl');
 if(!Number.isSafeInteger(maxEntries)||maxEntries<1||maxEntries>1024)throw new RangeError('maxEntries');
 const cache=new Map();
 function read(id){
  const key=String(id||'').trim();if(!key||key.length>150)return Promise.resolve(null);
  const t=now(),old=cache.get(key);
  if(old&&t<old.expiresAt)return old.promise;
  cache.delete(key);
  const promise=Promise.resolve().then(()=>load(key)).catch(e=>{
   if(cache.get(key)?.promise===promise)cache.delete(key);
   throw e;
  });
  cache.set(key,{promise,expiresAt:t+ttlMs});
  while(cache.size>maxEntries)cache.delete(cache.keys().next().value);
  return promise;
 }
 return {read,invalidate:id=>cache.delete(String(id||'').trim()),size:()=>cache.size};
}
module.exports={createMarketReferenceCache};
