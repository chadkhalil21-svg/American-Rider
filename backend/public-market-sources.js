// Free/public evidence-source catalog for national market commissioning.
//
// This is intentionally separate from commercial providers. A source belongs here only when
// an authoritative public body exposes data useful to the market-reference/economics system.
// "Reference" means what the fields support: some sources contain passenger charges; others
// only describe trip shape/demand and therefore must never be promoted as fare evidence.
const PUBLIC_MARKET_SOURCES=Object.freeze({
  'il-chicago':Object.freeze({
    sourceId:'chicago-tnp-open-data',authority:'City of Chicago',cost:'free',
    publication:'rolling public dataset',passengerChargeEvidence:true,tripShapeEvidence:true,
    endpoint:'https://data.cityofchicago.org/resource/8bbv-3wbe.json',
  }),
  'ny-nyc':Object.freeze({
    sourceId:'nyc-tlc-hvfhv',authority:'NYC Taxi & Limousine Commission',cost:'free',
    publication:'monthly; typically ~2 months delayed',passengerChargeEvidence:'verify-current-HVFHV-fields',
    tripShapeEvidence:true,endpoint:'https://www.nyc.gov/site/tlc/about/tlc-trip-record-data.page',
  }),
  'ma-statewide':Object.freeze({
    sourceId:'massachusetts-tnc-report',authority:'Massachusetts TNC Division',cost:'free',
    publication:'annual public report',passengerChargeEvidence:false,tripShapeEvidence:true,
    endpoint:'https://www.mass.gov/orgs/transportation-network-company-division',
  }),
});
function publicSourceFor(marketId){return PUBLIC_MARKET_SOURCES[String(marketId||'')]||null;}
module.exports={PUBLIC_MARKET_SOURCES,publicSourceFor};
