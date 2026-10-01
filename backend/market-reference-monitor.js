// Market-reference monitoring contract.
//
// Two clocks are intentionally separate:
// 1) external market evidence is observed frequently but promoted conservatively;
// 2) American Rider's own marketplace signals may be evaluated at quote time.
//
// This module does not scrape competitors and does not fabricate evidence. Production collectors
// must use lawful, licensed, public-government, independent-audit, or founder/field evidence
// consistent with the evidence hierarchy in docs/MIAMI-FARE-CALIBRATION.md.
const CADENCE = Object.freeze({
  externalObservationMinutes: 60,
  referenceRecomputeMinutes: 60,
  productionPromotionMinutes: 24 * 60,
  ownMarketplaceMaxAgeMinutes: 5,
  trafficMaxAgeMinutes: 5,
  weatherMaxAgeMinutes: 15,
  eventCalendarMaxAgeMinutes: 60,
});

const GUARDRAILS = Object.freeze({
  targetFraction: 0.90,
  maxAutomaticReferenceMoveFractionPerDay: 0.10,
  manualReviewMoveFraction: 0.10,
  minimumIndependentEvidenceFamilies: 2,
  prohibitPersonalizedPricing: true,
  prohibitProtectedClassSignals: true,
  prohibitUnboundedMultiplier: true,
});

function ageMinutes(asOf, now=Date.now()) {
  const t=Date.parse(asOf);
  if(!Number.isFinite(t)) return Infinity;
  return Math.max(0,(now-t)/60000);
}

function freshness(snapshot, now=Date.now()) {
  if(!snapshot?.asOf) return {ok:false,reason:'missing timestamp'};
  const kind=String(snapshot.kind||'');
  const limit={
    ownMarketplace:CADENCE.ownMarketplaceMaxAgeMinutes,
    traffic:CADENCE.trafficMaxAgeMinutes,
    weather:CADENCE.weatherMaxAgeMinutes,
    eventCalendar:CADENCE.eventCalendarMaxAgeMinutes,
    externalMarket:CADENCE.externalObservationMinutes,
  }[kind];
  if(!limit) return {ok:false,reason:'unknown evidence kind'};
  const age=ageMinutes(snapshot.asOf,now);
  return age<=limit?{ok:true,ageMinutes:age}:{ok:false,reason:'stale',ageMinutes:age,limitMinutes:limit};
}

function proposedReferenceMove(currentCents,nextCents) {
  if(!Number.isInteger(currentCents)||currentCents<=0||!Number.isInteger(nextCents)||nextCents<0) throw new TypeError('reference cents must be integers and current must be positive');
  return (nextCents-currentCents)/currentCents;
}

function promotionDecision({currentCents,nextCents,independentEvidenceFamilies,holdoutPassed,economicsPassed,routerPassed}) {
  const move=proposedReferenceMove(currentCents,nextCents);
  if(!Number.isInteger(independentEvidenceFamilies)||independentEvidenceFamilies<GUARDRAILS.minimumIndependentEvidenceFamilies) return {promote:false,reason:'independent evidence insufficient',move};
  if(!holdoutPassed||!economicsPassed||!routerPassed) return {promote:false,reason:'promotion gates incomplete',move};
  if(Math.abs(move)>GUARDRAILS.manualReviewMoveFraction) return {promote:false,reason:'manual review required',move};
  return {promote:true,reason:'gates passed',move};
}

module.exports={CADENCE,GUARDRAILS,ageMinutes,freshness,proposedReferenceMove,promotionDecision};
