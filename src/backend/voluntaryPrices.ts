// Optional first-party market research. Real consumer-owned prices are
// voluntarily attested by a signed-in contributor. No competitor app access.
import { PAYMENT_SERVER_URL } from '../config';
import { auth } from '../firebase';

export type ResearchMarket = { id: string; name: string; state: string };
export type ResearchPrice = {
  marketId: string;
  observedAt: string;
  routedMiles: number;
  routedMinutes: number;
  travelerTotalCents: number;
  observationId: string;
  providerCode: 'other-leading-platform-a'|'other-leading-platform-b'|'other';
  sourceKind: 'my-receipt'|'my-quote';
  serviceClass: 'standard';
  ordinaryNoPromotion: true;
  consentToResearch: true;
};
async function headers(){
  const token=await auth.currentUser?.getIdToken().catch(()=>null);
  if(!token)throw Error('research_auth_required');
  return { Authorization:`Bearer ${token}`, 'Content-Type':'application/json' };
}
export async function marketResearchCounties():Promise<ResearchMarket[]>{
  const res=await fetch(`${PAYMENT_SERVER_URL}/market-price/research/markets`,{headers:await headers()});
  if(!res.ok)throw Error('research_markets_unavailable');
  const body=await res.json();
  return Array.isArray(body.markets)?body.markets.filter(
    (m:ResearchMarket)=>typeof m.id==='string'&&typeof m.name==='string'
  ):[];
}
export async function volunteerMarketPrice(input:ResearchPrice):Promise<boolean>{
  const res=await fetch(`${PAYMENT_SERVER_URL}/market-price/research`,{
    method:'POST',headers:await headers(),body:JSON.stringify(input),
  });
  const body=await res.json().catch(()=>({}));
  if(!res.ok)throw Error(res.status===401?'research_auth_required':'research_intake_unavailable');
  return body.ok===true&&body.researchOnly===true;
}
