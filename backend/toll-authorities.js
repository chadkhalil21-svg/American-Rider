// Toll-authority registry.
//
// FHWA is the nationwide discovery/control source, not the live price authority: FHWA itself
// says its voluntary biennial inventory is not complete. A market record therefore names the
// public operating authorities whose current material was directly reviewed. Missing coverage
// never means "no toll"; tolls.js falls through to HERE and then UNKNOWN.
const NATIONAL_DISCOVERY=Object.freeze({
 authority:'Federal Highway Administration, Office of Highway Policy Information',
 source:'https://www.fhwa.dot.gov/policyinformation/tollpage/page00.cfm',
 limitation:'discovery inventory; not a complete live toll-price authority',
});
const MARKETS=Object.freeze({
 'fl-southeast':Object.freeze({
  verifiedDiscovery:true,
  reviewedAt:'2026-09-29',
  authorities:Object.freeze([
   Object.freeze({name:"Florida's Turnpike Enterprise / Florida Department of Transportation",source:'https://floridasturnpike.com/tolls/toll-rates/',pricing:'official schedules/calculator'}),
   Object.freeze({name:'Greater Miami Expressway Agency',source:'https://www.gmx-way.com/',pricing:'authority toll policy and SunPass collection'}),
  ]),
  localPriceResolver:false,
  fallback:'HERE Routing v8; unknown fails closed',
 }),
});
const forMarket=id=>MARKETS[String(id||'')]||null;
module.exports={NATIONAL_DISCOVERY,MARKETS,forMarket};