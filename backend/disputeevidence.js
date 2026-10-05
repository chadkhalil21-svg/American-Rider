// A durable, minimally scoped internal snapshot for Stripe dispute review.
// This is NOT a legal finding, an automatic representment, or a Stripe submission.
const { createHash } = require('node:crypto');
const VERSION = 1;
const asText = (x,max=160) => String(x ?? '').slice(0,max);
const asTime = (x) => Number.isFinite(Number(x)) && Number(x)>0 ? Number(x) : null;
const asMoney = (x) => Number.isInteger(Number(x)) && Number(x)>=0 ? Number(x) : null;
const factsFor = (ride) => {
  if (!ride) return null;
  return {
    travelId:asText(ride.id,100), tripNo:asText(ride.tripNo,80),
    status:asText(ride.status,40), travelClass:asText(ride.travelClass,50),
    pickup:asText(ride.dep,160), destination:asText(ride.dest,160),
    createdAt:asTime(ride.createdAt), paidAt:asTime(ride.paidAt),
    offeredAt:asTime(ride.offeredAt), acceptedAt:asTime(ride.acceptedAt),
    arrivedAt:asTime(ride.arrivedAt), onboardAt:asTime(ride.onboardAt),
    completedAt:asTime(ride.completedAt), cancelledAt:asTime(ride.cancelledAt),
    settledAt:asTime(ride.settledAt),
    quotedCents:asMoney(ride.costCents), travelFareCents:asMoney(ride.travelCostCents),
    platformFeeCents:asMoney(ride.platformFeeCents), tollCents:asMoney(ride.tollCents),
    governmentFeeCents:asMoney(ride.governmentFeeCents),
    refundPending:ride.refundPending===true,
    refundId:asText(ride.refundId,100),transferId:asText(ride.transferId,100),
    paymentIntentId:asText(ride.paymentIntentId,100),
  };
};
function packetFor({ride,event,now=Date.now()}) {
  const dispute=event?.data?.object||{};
  const id=asText(dispute.id,100),eventId=asText(event?.id,120);
  if(!/^dp_[A-Za-z0-9_]{1,96}$/.test(id)||!eventId)throw new Error('A verified Stripe dispute id and event id are required');
  if(ride && String(ride.paymentIntentId)!==String(dispute.payment_intent))throw new Error('Dispute payment does not match Travel');
  const body={schema:`ar.dispute.v${VERSION}`,disputeId:id,eventId,capturedAt:now,
    provider:'stripe',paymentIntentId:asText(dispute.payment_intent,100),
    amountCents:asMoney(dispute.amount),currency:asText(dispute.currency,8).toLowerCase(),
    reason:asText(dispute.reason,80),evidenceDueAt:asTime(dispute.evidence_details?.due_by)?Number(dispute.evidence_details.due_by)*1000:null,
    travel:factsFor(ride)};
  return {...body,sha256:createHash('sha256').update(JSON.stringify(body)).digest('hex')};
}
async function saveDisputeEvidence({db,ride,event,now=Date.now()}) {
  if(!db)throw new Error('Firestore is unavailable for dispute evidence');
  const packet=packetFor({ride,event,now});
  const ref=db.collection('dispute_evidence').doc(packet.disputeId);
  try {await ref.create(packet);return {ref:`dispute_evidence/${packet.disputeId}`,hash:packet.sha256,duplicate:false};}
  catch(e) {
    if(![6,'already-exists','ALREADY_EXISTS'].includes(e?.code))throw e;
    const snap=await ref.get();const existing=snap.exists?snap.data():null;
    if(!existing||existing.eventId!==packet.eventId||existing.paymentIntentId!==packet.paymentIntentId||
        existing.travel?.travelId!==packet.travel?.travelId||existing.schema!==packet.schema)
      throw new Error('Existing dispute evidence does not match verified Stripe event');
    return {ref:`dispute_evidence/${packet.disputeId}`,hash:existing.sha256,duplicate:true};
  }
}
module.exports={VERSION,factsFor,packetFor,saveDisputeEvidence};
