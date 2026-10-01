// Normalized ingestion boundary for every market-reference provider.
//
// Provider adapters transform lawful source records into this shape. This deliberately contains
// no provider-specific scraping logic and no user identity/personal willingness-to-pay fields.
const ALLOWED_SOURCE_TYPES=new Set([
  'government-trips','independent-audit','licensed-market-data','field-panel','platform-publication',
]);

function normalizeObservation(raw){
  if(!raw||typeof raw!=='object')throw new TypeError('observation required');
  const required=['marketId','sourceId','sourceType','observedAt','serviceClass','routedMiles','routedMinutes','travelerTotalCents'];
  for(const k of required)if(raw[k]===undefined||raw[k]===null||raw[k]==='')throw new TypeError(`missing ${k}`);
  if(!ALLOWED_SOURCE_TYPES.has(raw.sourceType))throw new TypeError('unsupported sourceType');
  if(!Number.isFinite(Date.parse(raw.observedAt)))throw new TypeError('invalid observedAt');
  if(!Number.isFinite(raw.routedMiles)||raw.routedMiles<0)throw new TypeError('invalid routedMiles');
  if(!Number.isFinite(raw.routedMinutes)||raw.routedMinutes<0)throw new TypeError('invalid routedMinutes');
  if(!Number.isInteger(raw.travelerTotalCents)||raw.travelerTotalCents<0)throw new TypeError('invalid travelerTotalCents');
  if(raw.userId||raw.deviceId||raw.income||raw.protectedClass)throw new TypeError('personalized pricing fields prohibited');
  return Object.freeze({
    marketId:String(raw.marketId),
    sourceId:String(raw.sourceId),
    sourceType:raw.sourceType,
    observedAt:new Date(raw.observedAt).toISOString(),
    serviceClass:String(raw.serviceClass),
    routedMiles:raw.routedMiles,
    routedMinutes:raw.routedMinutes,
    travelerTotalCents:raw.travelerTotalCents,
    daypart:raw.daypart?String(raw.daypart):null,
    weekdayWeekend:raw.weekdayWeekend?String(raw.weekdayWeekend):null,
    calendarClass:raw.calendarClass?String(raw.calendarClass):null,
    regulatedLocationClass:raw.regulatedLocationClass?String(raw.regulatedLocationClass):null,
    provenance:raw.provenance?String(raw.provenance):null,
  });
}
module.exports={normalizeObservation};
