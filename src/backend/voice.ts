import { auth } from '../firebase';
import { PAYMENT_SERVER_URL } from '../config';

export type TravelVoiceToken = { token: string; identity: string; side: 'traveler'|'operator'; tripNo?: string };
export async function travelVoiceToken(rideId: string): Promise<TravelVoiceToken> {
  if (!/^[a-f0-9]{40}$/.test(rideId)) throw new Error('invalid_ride');
  const bearer = await auth.currentUser?.getIdToken();
  if (!bearer) throw new Error('not_signed_in');
  const res = await fetch(`${PAYMENT_SERVER_URL}/voice/token`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${bearer}` },
    body: JSON.stringify({ rideId }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || typeof body.token !== 'string' || !['traveler','operator'].includes(body.side) ||
      typeof body.identity !== 'string' ||
      !new RegExp(`^ar_${rideId}_[a-f0-9]{24}_${body.side}$`).test(body.identity)) throw new Error('voice_unavailable');
  return { token: body.token, identity: body.identity, side: body.side, tripNo: body.tripNo };
}
