const { createHash } = require('node:crypto');
function scheduledIdentity({ uid, atMs, pickup, destination, travelClass, party }) {
  if (!uid || !Number.isSafeInteger(atMs) || !pickup || !destination || !party) throw new Error('invalid_reservation_identity');
  const canonical = JSON.stringify({
    uid:String(uid), atMs,
    pickup:[Number(pickup.lat).toFixed(6), Number(pickup.lng).toFixed(6)],
    destination:[Number(destination.lat).toFixed(6),Number(destination.lng).toFixed(6)],
    travelClass:String(travelClass||'Standard'), party:{
      mode:String(party.mode||'self'), travelerUid:String(party.travelerUid||''),
      guardianUid:String(party.guardianUid||''), familyLinkId:String(party.familyLinkId||''),
    },
  });
  const fingerprint=createHash('sha256').update(canonical).digest('hex');
  return { id:`scheduled_${fingerprint.slice(0,40)}`, fingerprint };
}
module.exports={scheduledIdentity};
