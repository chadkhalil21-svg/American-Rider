// National public-source discovery and fitness contract.
//
// Public-first does NOT mean "any public dataset may set a fare." Sources are discovered
// nationally, then admitted only for the decisions their fields and publication quality support.
const FITNESS=Object.freeze({
  FARE_REFERENCE:'fare-reference',
  TRIP_SHAPE:'trip-shape',
  DEMAND:'demand',
  REGULATORY_FLOOR:'regulatory-floor',
});

function assessPublicSource(meta={}){
  const problems=[],fitness=[];
  if(!meta.authority)problems.push('authority missing');
  if(!meta.endpoint)problems.push('endpoint missing');
  if(!meta.publicationCadence)problems.push('publication cadence missing');
  if(!meta.geography)problems.push('geography missing');
  if(meta.hasPassengerCharge===true&&meta.hasTripDistance===true&&meta.hasTripDuration===true)fitness.push(FITNESS.FARE_REFERENCE);
  if(meta.hasTripDistance===true||meta.hasTripDuration===true)fitness.push(FITNESS.TRIP_SHAPE);
  if(meta.hasTripCount===true)fitness.push(FITNESS.DEMAND);
  if(meta.isRegulatoryRate===true)fitness.push(FITNESS.REGULATORY_FLOOR);
  if(meta.selfReported===true&&!meta.regulatorReview)problems.push('self-reported without regulator review');
  if(meta.roundedFareCents&&meta.roundedFareCents>0)problems.push(`fare rounded to ${meta.roundedFareCents} cents`);
  if(meta.publicationLagDays===undefined)problems.push('publication lag unknown');
  return Object.freeze({usable:problems.filter(x=>/missing|unknown|without regulator/.test(x)).length===0,fitness:Object.freeze(fitness),problems:Object.freeze(problems)});
}

const DISCOVERY_TARGETS=Object.freeze([
  'Data.gov and agency open-data catalogs',
  'state TNC/rideshare regulators',
  'city/county transportation regulators',
  'taxi/for-hire commissions',
  'airport/port ground-transportation authorities',
  'state/city open-data portals',
]);

module.exports={FITNESS,DISCOVERY_TARGETS,assessPublicSource};
