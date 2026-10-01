// Verified public-source metadata. This registry is expandable without changing pricing logic.
const {assessPublicSource}=require('./public-source-discovery');
const SOURCES=Object.freeze({
  'chicago-tnp-open-data':Object.freeze({
    authority:'City of Chicago',endpoint:'https://data.cityofchicago.org/resource/6dvr-xwnh.json',
    geography:'Chicago, IL',publicationCadence:'rolling',publicationLagDays:31,
    hasPassengerCharge:true,hasTripDistance:true,hasTripDuration:true,hasTripCount:true,
    selfReported:true,regulatorReview:true,roundedFareCents:250,roundedTimeMinutes:15,
    notes:'TNP-reported ordinance data. Census tracts may be suppressed; fare rounded to nearest $2.50.',
  }),
  'nyc-tlc-hvfhv':Object.freeze({
    authority:'NYC Taxi & Limousine Commission',endpoint:'https://www.nyc.gov/site/tlc/about/tlc-trip-record-data.page',
    geography:'New York City, NY',publicationCadence:'monthly',publicationLagDays:60,
    hasPassengerCharge:false,hasTripDistance:true,hasTripDuration:true,hasTripCount:true,
    selfReported:true,regulatorReview:true,
    notes:'HVFHV public trip records; TLC says it cannot guarantee accuracy/completeness and performs routine reviews.',
  }),
  'nyc-tlc-aggregate-fares':Object.freeze({
    authority:'NYC Taxi & Limousine Commission',endpoint:'https://www.nyc.gov/site/tlc/about/aggregated-reports.page',
    geography:'New York City, NY',publicationCadence:'monthly',publicationLagDays:31,
    hasPassengerCharge:true,hasTripDistance:false,hasTripDuration:false,hasTripCount:true,
    selfReported:true,regulatorReview:true,
    notes:'Monthly aggregates include amount of fares collected; suitable for aggregate cross-check, not condition-matched trip fare alone.',
  }),
  'nyc-hvfhv-driver-pay':Object.freeze({
    authority:'NYC Taxi & Limousine Commission',endpoint:'https://www.nyc.gov/site/tlc/about/driver-pay-rates.page',
    geography:'New York City, NY',publicationCadence:'regulatory update',publicationLagDays:0,
    hasPassengerCharge:false,hasTripDistance:true,hasTripDuration:true,hasTripCount:false,
    isRegulatoryRate:true,selfReported:false,regulatorReview:true,
    notes:'Driver minimum payment standard; explicitly not passenger fare.',
  }),
  'massachusetts-tnc-report':Object.freeze({
    authority:'Massachusetts TNC Division',endpoint:'https://www.mass.gov/orgs/transportation-network-company-division',
    geography:'Massachusetts',publicationCadence:'annual',publicationLagDays:365,
    hasPassengerCharge:false,hasTripDistance:true,hasTripDuration:false,hasTripCount:true,
    selfReported:true,regulatorReview:true,
    notes:'Regulator collects/analyzes TNC data; structural/demand evidence unless current report exposes passenger charges.',
  }),
});
function verifiedSource(id){const meta=SOURCES[id];return meta?Object.freeze({...meta,assessment:assessPublicSource(meta)}):null;}
module.exports={SOURCES,verifiedSource};
