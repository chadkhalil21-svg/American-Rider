// Verified public-source metadata. This registry is expandable without changing pricing logic.
const {assessPublicSource}=require('./public-source-discovery');
const SOURCES=Object.freeze({
  'chicago-tnp-open-data':Object.freeze({
    authority:'City of Chicago',endpoint:'https://data.cityofchicago.org/resource/8bbv-3wbe.json',
    geography:'Chicago, IL',publicationCadence:'rolling',publicationLagDays:31,
    hasPassengerCharge:true,hasAllInTotalComparable:false,
    hasTripDistance:true,hasTripDuration:true,hasTripCount:true,
    selfReported:true,regulatorReview:true,roundedFareCents:250,roundedTimeMinutes:15,
    notes:'City TNP trip_total contains rounded Fare, Tip and Additional Charges. Not equivalent to a contemporaneous untipped upfront Traveler quote; structural and cross-check evidence only.',
  }),
  'nyc-tlc-hvfhv':Object.freeze({
    authority:'NYC Taxi & Limousine Commission',endpoint:'https://www.nyc.gov/site/tlc/about/tlc-trip-record-data.page',
    geography:'New York City, NY',publicationCadence:'monthly',publicationLagDays:60,
    hasPassengerCharge:true,hasAllInTotalComparable:false,
    hasTripDistance:true,hasTripDuration:true,hasTripCount:true,
    selfReported:true,regulatorReview:true,
    notes:'TLC 2025 HVFHV dictionary includes base_passenger_fare BEFORE tolls, tips, taxes and fees; not comparable to ordinary all-in quoted Total without documented reconciliation.',
  }),
  'nyc-tlc-aggregate-fares':Object.freeze({
    authority:'NYC Taxi & Limousine Commission',endpoint:'https://www.nyc.gov/site/tlc/about/aggregated-reports.page',
    geography:'New York City, NY',publicationCadence:'monthly',publicationLagDays:31,
    hasPassengerCharge:true,hasAllInTotalComparable:false,hasTripDistance:false,hasTripDuration:false,hasTripCount:true,
    selfReported:true,regulatorReview:true,
    notes:'Monthly aggregates include amount of fares collected; suitable for aggregate cross-check, not condition-matched trip fare alone.',
  }),
  'nyc-hvfhv-driver-pay':Object.freeze({
    authority:'NYC Taxi & Limousine Commission',endpoint:'https://www.nyc.gov/site/tlc/about/driver-pay-rates.page',
    geography:'New York City, NY',publicationCadence:'regulatory update',publicationLagDays:0,
    hasPassengerCharge:false,hasAllInTotalComparable:false,hasTripDistance:true,hasTripDuration:true,hasTripCount:false,
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
