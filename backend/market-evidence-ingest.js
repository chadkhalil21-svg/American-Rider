// Normalized ingestion boundary for every market-reference provider.
//
// Provider adapters transform lawful source records into this shape. This deliberately contains
// no provider-specific scraping logic and no user identity/personal willingness-to-pay fields.
const ALLOWED_SOURCE_TYPES=new Set([
  'government-trips','independent-audit','licensed-market-data','field-panel','platform-publication',
]);

function normalizeObservation(raw,now=Date.now()){
  if(!raw||typeof raw!=='object')throw new TypeError('observation required');
  const required=['marketId','sourceId','sourceType','observedAt','serviceClass','routedMiles','routedMinutes','travelerTotalCents'];
  for(const k of required)if(raw[k]===undefined||raw[k]===null||raw[k]==='')throw new TypeError(`missing ${k}`);
  if(!ALLOWED_SOURCE_TYPES.has(raw.sourceType))throw new TypeError('unsupported sourceType');
  if(!Number.isFinite(Date.parse(raw.observedAt)))throw new TypeError('invalid observedAt');
  if(Date.parse(raw.observedAt)>now+5*60_000)throw new TypeError('future-dated observedAt');
  if(!Number.isFinite(raw.routedMiles)||raw.routedMiles<0)throw new TypeError('invalid routedMiles');
  if(!Number.isFinite(raw.routedMinutes)||raw.routedMinutes<0)throw new TypeError('invalid routedMinutes');
  if(!Number.isInteger(raw.travelerTotalCents)||raw.travelerTotalCents<0)throw new TypeError('invalid travelerTotalCents');
  if(raw.userId||raw.deviceId||raw.income||raw.protectedClass)throw new TypeError('personalized pricing fields prohibited');
  if(raw.sourceObservationId != null &&
    (typeof raw.sourceObservationId!=='string' ||
     !/^[A-Za-z0-9_.:-]{8,128}$/.test(raw.sourceObservationId)))
    throw new TypeError('invalid anonymous source observation ID');
  return Object.freeze({
    marketId:String(raw.marketId),
    sourceId:String(raw.sourceId),
    sourceType:raw.sourceType,
    observedAt:new Date(raw.observedAt).toISOString(),
    serviceClass:String(raw.serviceClass),
    routedMiles:raw.routedMiles,
    routedMinutes:raw.routedMinutes,
    travelerTotalCents:raw.travelerTotalCents,
    // An explicit source-validated assertion, not proof of independent authority.
    // Only an approved adapter may set this true; the snapshot builder independently
    // checks source eligibility, evidence diversity and human promotion gates.
    hasAllInTotalComparable:raw.hasAllInTotalComparable===true,
    daypart:raw.daypart?String(raw.daypart):null,
    weekdayWeekend:raw.weekdayWeekend?String(raw.weekdayWeekend):null,
    calendarClass:raw.calendarClass?String(raw.calendarClass):null,
    regulatedLocationClass:raw.regulatedLocationClass?String(raw.regulatedLocationClass):null,
    providerKey:raw.providerKey?String(raw.providerKey):null,
    sourceObservationId:raw.sourceObservationId||null,
    confidence:raw.confidence?String(raw.confidence):null,
    provenance:raw.provenance?String(raw.provenance):null,
  });
}
module.exports={normalizeObservation};
