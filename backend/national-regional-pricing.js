'use strict';
// Research-only bridge between publisher-verified county/BLS source evidence
// and American Rider's EXISTING national cost-floor candidate calculator.
// No production rate, booking, market admission, network or database mutations.
const {regionalStartingRateCandidate} = require('./national-pricing-candidate');
const STATES = new Set('01 02 04 05 06 08 09 10 11 12 13 15 16 17 18 19 20 21 22 23 24 25 26 27 28 29 30 31 32 33 34 35 36 37 38 39 40 41 42 44 45 46 47 48 49 50 51 53 54 55 56'.split(' '));
const blocked = (reason) => Object.freeze({
  status:'research-hold', bookable:false, marketTargetVerified:false, reason,
});
function integer(value,min,max,label){
  if (!Number.isSafeInteger(value)||value<min||value>max)
    throw new RangeError(label+' missing or outside research policy limits');
  return value;
}
function countyPriceCandidate({countyFips,geographySnapshot,policy,now=Date.now()}={}){
  if(typeof countyFips!=='string'||!/^\d{5}$/.test(countyFips)||!STATES.has(countyFips.slice(0,2)))
    return blocked('invalid county FIPS');
  if(!geographySnapshot || geographySnapshot.status!=='research-only' ||
     geographySnapshot.bookable!==false ||
     geographySnapshot.liveFareModified!==false ||
     geographySnapshot.sourceVerifiedByChecksum!==true ||
     geographySnapshot.sourceVintage?.cbsa!=='2023' ||
     geographySnapshot.sourceVintage?.blsOews!=='2025-05'){
    return blocked('official-version geography and wage evidence absent');
  }
  const p=geographySnapshot.profiles?.[countyFips];
  if(!p)return blocked(geographySnapshot.unresolved?.[countyFips] || 'county economic profile unverified');
  if(p.countyFips!==countyFips || !['metro','micro','nonmetro'].includes(p.category) ||
    !/^bls-\d{2,7}$/.test(p.economicAreaId||'') ||
    p.economicAreaId!=='bls-'+p.blsAreaCode ||
    !['53-3053','53-3054'].includes(p.blsComparisonOccupation) ||
    typeof p.blsEmployeeMedianHourlyUSD!=='number' ||
    !Number.isFinite(p.blsEmployeeMedianHourlyUSD) ||
    p.blsEmployeeMedianHourlyUSD<=0 || p.blsEmployeeMedianHourlyUSD>300){
    return blocked('county wage comparator invalid');
  }
  if(!policy)return blocked('locally approved cost assumptions missing');
  // Every assumption is explicit in the caller's study file and MUST NOT be
  // represented as real Operator profit, market price or regulatory approval.
  const minNet=integer(policy.operatorNetFloorCentsPerHour,100,20000,'operator net floor');
  const multiplier=integer(policy.wageToNetTargetMultiplierBps,10000,50000,'wage-to-net multiplier');
  const vehicle=integer(policy.vehicleCostCentsPerMile,1,2000,'vehicle cost');
  const paid=integer(policy.paidMinutesPer100DutyMinutes,1,100,'paid-time utilization');
  const deadhead=integer(policy.deadheadMilesPer100PaidMiles,0,500,'deadhead miles');
  const fixed=integer(policy.perTravelFixedCents,0,10000,'fixed cost');
  if(typeof policy.vehicleCostSource!=='string'||!policy.vehicleCostSource.trim() ||
    typeof policy.asOf!=='string' || policy.asOf.trim().length<10){
    return blocked('dated and attributable vehicle-cost research missing');
  }
  const hourlyWageCents=Math.round(p.blsEmployeeMedianHourlyUSD*100);
  const net=Math.max(minNet,Math.ceil(hourlyWageCents*multiplier/10000));
  const candidate=regionalStartingRateCandidate({
    geography:{countyFips,economicAreaId:p.economicAreaId,category:p.category},
    evidence:{
      asOf:policy.asOf,operatorTargetNetCentsPerHour:net,
      vehicleCostCentsPerMile:vehicle,perTravelFixedCents:fixed,
      paidMinutesPer100DutyMinutes:paid,deadheadMilesPer100PaidMiles:deadhead,
      wageSource:'BLS OEWS 2025-05 '+p.blsAreaCode+' occupation '+p.blsComparisonOccupation,
      vehicleCostSource:policy.vehicleCostSource,
    },
    now,
  });
  return Object.freeze({
    ...candidate,
    pricingAuthority:'NONE - RESEARCH ONLY',
    evidence:{
      ...candidate.evidence,
      blsEmployeeMedianHourlyUSD:p.blsEmployeeMedianHourlyUSD,
      operatorNetTargetSource:'synthetic explicit multiplier/floor; NOT verified independent-Operator net earnings',
      wageArea:p.blsAreaCode,occupation:p.blsComparisonOccupation,
      geographicSourceHashes:geographySnapshot.sourceSha256||null,
    },
  });
}
module.exports={countyPriceCandidate};
