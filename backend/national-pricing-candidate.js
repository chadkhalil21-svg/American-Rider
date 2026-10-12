'use strict';
// Research-only national starting-rate candidate. No database/API calls, no
// automatic pricing authority, and no service activation. A county's regional
// cost inputs arrive from separately verified/versioned Census/BLS/cost records.
const OPERATOR_SHARE_NUM=99;
const OPERATOR_SHARE_DEN=100;
const MAX_INPUT_AGE_DAYS=550;
function safeInteger(n,min,max,label) {
  if (!Number.isSafeInteger(n)||n<min||n>max) throw new RangeError('invalid '+label);
  return n;
}
function nonBlank(v,label) {
  if (typeof v!=='string'||!v.trim()) throw new TypeError('missing '+label);
  return v.trim();
}
function regionalStartingRateCandidate({geography,evidence,now=Date.now()}={}) {
  if(!geography||!evidence) throw new TypeError('geography and cost evidence required');
  const fips=nonBlank(geography.countyFips,'countyFips');
  if(!/^\d{5}$/.test(fips))throw new TypeError('countyFips must be five digits');
  const category=nonBlank(geography.category,'category');
  if(!['metro','micro','nonmetro'].includes(category))throw new TypeError('unverified economic category');
  const key=nonBlank(geography.economicAreaId,'economicAreaId');
  // This identifier is supplied by versioned Census geography, not invented
  // from a town name or a bounding-box guess.
  if(!/^[a-z0-9-]{2,80}$/i.test(key))throw new TypeError('invalid economic area id');
  const wage=safeInteger(evidence.operatorTargetNetCentsPerHour,100,20000,'operator net hourly target');
  const vehicle=safeInteger(evidence.vehicleCostCentsPerMile,1,2000,'vehicle operating cost');
  const fixed=safeInteger(evidence.perTravelFixedCents,0,10000,'fixed service cost');
  const paid=safeInteger(evidence.paidMinutesPer100DutyMinutes,1,100,'paid-time utilization');
  const deadhead=safeInteger(evidence.deadheadMilesPer100PaidMiles,0,500,'pickup/empty-mile allowance');
  const asOf=Date.parse(evidence.asOf);
  if(!Number.isFinite(asOf)||!Number.isFinite(now)||asOf>now+5*60_000||now-asOf>MAX_INPUT_AGE_DAYS*86400_000)
    throw new TypeError('regional cost evidence missing, stale or future-dated');
  // Check provenance. Distinct public data families constrain two different
  // inputs, but they are NOT competitor-price observations.
  const wages=nonBlank(evidence.wageSource,'wage source');
  const driving=nonBlank(evidence.vehicleCostSource,'vehicle cost source');
  if(wages===driving)throw new TypeError('distinct cost evidence required');
  const share=OPERATOR_SHARE_NUM/OPERATOR_SHARE_DEN;
  // An Operator's 99% share must cover net hourly compensation across full
  // duty time plus driving and empty-pickup vehicle costs.
  const baseCents=Math.ceil(fixed/share);
  const perMileCents=Math.ceil(vehicle*(1+deadhead/100)/share);
  const perMinuteCents=Math.ceil(wage/(60*(paid/100)*share));
  const minimumFareCents=Math.max(300,baseCents);
  return Object.freeze({
    status:'research-candidate',marketTargetVerified:false,bookable:false,
    geography:Object.freeze({countyFips:fips,economicAreaId:key,category}),
    coefficients:Object.freeze({baseCents,perMileCents,perMinuteCents,minimumFareCents,currency:'USD'}),
    evidence:Object.freeze({asOf:new Date(asOf).toISOString(),wageSource:wages,vehicleCostSource:driving}),
    limits:Object.freeze({requiresStateLicensing:true,requiresLocalMarketEvidence:true,requiresLiveRouting:true,
      requiresEconomicsGate:true,requiresIndependentPromotion:true}),
  });
}
module.exports={regionalStartingRateCandidate,MAX_INPUT_AGE_DAYS};
