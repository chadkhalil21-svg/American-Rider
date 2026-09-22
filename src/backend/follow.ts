// Asking the server for a link a trusted contact can open.
//
// The link is minted server-side and is a bearer capability — see backend/follow.js for why
// that is the right trade for somebody worried about a person mid-journey, and what keeps it
// safe. Nothing here decides anything; it asks, and hands back a URL or null.
import { PAYMENT_SERVER_URL } from '../config';
import { authHeaders } from './payments';

/**
 * A link for the travel underway, or null when there is nothing shareable — the travel has
 * ended, it is not this traveler's, or the server could not be reached.
 *
 * NULL IS NOT AN ERROR THE CALLER SHOULD HIDE. Safe Travels still shares a message without a
 * link when this returns null; a share that fails silently because a link could not be minted
 * would be the same defect this whole path exists to remove.
 */
export async function followLink(rideId: string | null | undefined): Promise<string | null> {
  if (!rideId) return null;
  try {
    const res = await fetch(`${PAYMENT_SERVER_URL}/travel/follow-link`, {
      method: 'POST',
      headers: await authHeaders(),
      body: JSON.stringify({ rideId }),
    });
    if (!res.ok) return null;
    const d = await res.json().catch(() => null);
    return typeof d?.url === 'string' ? d.url : null;
  } catch {
    return null;
  }
}
