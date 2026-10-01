// National market-evidence registry.
//
// The platform does not assume one data source exists everywhere. Every commissioned market
// declares its own lawful evidence plan. Government/open data and independent audits are
// preferred; licensed commercial collectors may fill coverage gaps. Platform-published
// observations are validation-only unless an explicit license permits the intended use.
const SOURCE_TYPES=Object.freeze({
  GOVERNMENT_TRIPS:'government-trips',
  INDEPENDENT_AUDIT:'independent-audit',
  LICENSED_MARKET_DATA:'licensed-market-data',
  FIELD_PANEL:'field-panel',
  PLATFORM_PUBLICATION:'platform-publication',
});

const NATIONAL_SOURCE_CATALOG=Object.freeze({
  'gridwise-analytics':Object.freeze({
    type:SOURCE_TYPES.LICENSED_MARKET_DATA,
    authority:'Gridwise Analytics',
    coverage:'U.S. national and metro coverage subject to contract',
    public:false,
    primaryEligible:true,
    caveat:'Requires commercial license/contract and field-level validation for intended pricing use.',
  }),
  'chicago-tnp-open-data':Object.freeze({
    type:SOURCE_TYPES.GOVERNMENT_TRIPS,
    authority:'City of Chicago',
    coverage:'Chicago, IL',
    public:true,
    primaryEligible:true,
  }),
  'nyc-tlc-hvfhv':Object.freeze({
    type:SOURCE_TYPES.GOVERNMENT_TRIPS,
    authority:'NYC Taxi & Limousine Commission',
    coverage:'New York City, NY',
    public:true,
    primaryEligible:true,
  }),
  'california-cpuc-tnc-public':Object.freeze({
    type:SOURCE_TYPES.GOVERNMENT_TRIPS,
    authority:'California Public Utilities Commission',
    coverage:'California where public fields are sufficient',
    public:true,
    primaryEligible:true,
    caveat:'Public availability and redaction vary by reporting period; verify fields before fare use.',
  }),
  'independent-controlled-audit':Object.freeze({
    type:SOURCE_TYPES.INDEPENDENT_AUDIT,
    authority:'approved independent study/audit',
    coverage:'market-specific',
    public:true,
    primaryEligible:true,
  }),
  'licensed-market-data':Object.freeze({
    type:SOURCE_TYPES.LICENSED_MARKET_DATA,
    authority:'contracted provider',
    coverage:'contract-specific',
    public:false,
    primaryEligible:true,
  }),
  'american-rider-field-panel':Object.freeze({
    type:SOURCE_TYPES.FIELD_PANEL,
    authority:'American Rider controlled field observation',
    coverage:'market-specific',
    public:false,
    primaryEligible:false,
  }),
});

const MARKET_EVIDENCE_PLANS=Object.freeze({
  'fl-southeast':Object.freeze({
    sources:Object.freeze(['independent-controlled-audit','american-rider-field-panel','gridwise-analytics']),
    minimumIndependentFamilies:2,
    liveCollectorRequiredForContinuousMonitoring:true,
    bootstrapReference:'existing evidence-gated production record',
  }),
});

function source(id){return NATIONAL_SOURCE_CATALOG[String(id||'')]||null;}
function planForRegion(regionId){return MARKET_EVIDENCE_PLANS[String(regionId||'')]||null;}
function planProblems(regionId){
  const p=planForRegion(regionId);
  if(!p)return [`${regionId}: no market evidence plan`];
  const out=[];
  if(!Array.isArray(p.sources)||p.sources.length<2)out.push(`${regionId}: fewer than two evidence sources planned`);
  const unknown=(p.sources||[]).filter(id=>!source(id));
  if(unknown.length)out.push(`${regionId}: unknown evidence sources ${unknown.join(', ')}`);
  const families=new Set((p.sources||[]).map(id=>source(id)?.type).filter(Boolean));
  if(families.size<(p.minimumIndependentFamilies||2))out.push(`${regionId}: evidence-family diversity insufficient`);
  return out;
}

module.exports={SOURCE_TYPES,NATIONAL_SOURCE_CATALOG,MARKET_EVIDENCE_PLANS,source,planForRegion,planProblems};
