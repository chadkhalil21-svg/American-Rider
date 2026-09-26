import { auth } from '../firebase';
import { PAYMENT_SERVER_URL } from '../config';

export type FamilyLink={id:string;status:'invited'|'active'|'revoked'|'aged_out';role:'guardian'|'teen';guardianName?:string;teenName?:string;eligible:boolean;inviteExpiresAt?:number|null};

async function call(path:string,init?:RequestInit){const token=await auth.currentUser?.getIdToken();if(!token)throw new Error('Sign in required');const res=await fetch(`${PAYMENT_SERVER_URL}${path}`,{...init,headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`,...(init?.headers||{})}});const body=await res.json().catch(()=>({}));if(!res.ok)throw new Error(body?.reason||body?.error||'Family request failed');return body;}

export async function fetchFamily():Promise<FamilyLink[]>{const x=await call('/family');return Array.isArray(x.links)?x.links:[];}
export async function createFamilyInvite(input:{guardianName:string;teenName:string;teenEmail:string;teenDob:string}){return call('/family/invite',{method:'POST',body:JSON.stringify(input)});}
export async function acceptFamilyInvite(id:string,inviteToken:string){return call(`/family/invite/${encodeURIComponent(id)}/accept`,{method:'POST',body:JSON.stringify({inviteToken})});}
export async function revokeFamilyLink(id:string){return call(`/family/${encodeURIComponent(id)}/revoke`,{method:'POST'});}
