import { PAYMENT_SERVER_URL } from '../config';

export type PickupMarket = {status:'active'|'onboarding'|'waitlist'|'unavailable';name:string|null};
let cached:{key:string;until:number;value:PickupMarket}|null=null;
let inflight:{key:string;promise:Promise<PickupMarket>}|null=null;
/** Location is transmitted only to our backend for a county lookup; never stored in this cache beyond a 15-second key. */
export function publicPickupMarket(lat:number,lng:number):Promise<PickupMarket>{
  if(!Number.isFinite(lat)||!Number.isFinite(lng)||Math.abs(lat)>90||Math.abs(lng)>180)
    return Promise.resolve({status:'unavailable',name:null});
  const key=`${lat.toFixed(3)},${lng.toFixed(3)}`;
  if(cached?.key===key&&Date.now()<cached.until)return Promise.resolve(cached.value);
  if(inflight?.key===key)return inflight.promise;
  const promise=(async()=>{
    const ctl=new AbortController();const timer=setTimeout(()=>ctl.abort(),4000);
    try{
      const res=await fetch(`${PAYMENT_SERVER_URL}/markets/at`,
        {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({lat,lng}),signal:ctl.signal});
      if(!res.ok)throw new Error('market_unavailable');
      const body=await res.json();
      if(!body||!Array.isArray(body.active)||!Object.prototype.hasOwnProperty.call(body,'here'))
        throw new Error('market_response_invalid');
      const here=body.here;
      if(here!=null&&(!['active','onboarding','waitlist','unavailable'].includes(here.status)||typeof here.id!=='string'))
        throw new Error('market_pickup_invalid');
      if(here?.status==='active'&&!body.active.some((m:{id:string;status:string})=>m.id===here.id&&m.status==='active'))
        throw new Error('market_active_inconsistent');
      const state:PickupMarket=here?
        {status:here.status,name:typeof here.name==='string'?here.name.slice(0,100):null}:
        {status:'waitlist',name:null};
      cached={key,until:Date.now()+15_000,value:state};
      return state;
    }finally{clearTimeout(timer);}
  })();
  inflight={key,promise};
  return promise.finally(()=>{if(inflight?.promise===promise)inflight=null;});
}
