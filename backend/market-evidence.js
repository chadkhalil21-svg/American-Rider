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
  'massachusetts-tnc-report':Object.freeze({
    type:SOURCE_TYPES.GOVERNMENT_TRIPS,
    authority:'Massachusetts TNC Division',
    coverage:'Massachusetts',
    public:true,
    primaryEligible:false,
    caveat:'Public reports support trip shape/demand and market commissioning; do not treat as passenger-fare evidence unless the current published fields explicitly contain usable charges.',
  }),
  'nyc-tlc-hvfhv':Object.freeze({
    type:SOURCE_TYPES.GOVERNMENT_TRIPS,
    authority:'NYC Taxi & Limousine Commission',
    coverage:'New York City, NY',
    public:true,
    primaryEligible:false,
    caveat:'Free structural trip evidence. Passenger-fare eligibility stays off unless the current public HVFHV schema is verified to expose usable passenger charges.',
  }),
  'chicago-tnp-open-data':Object.freeze({
    type:SOURCE_TYPES.GOVERNMENT_TRIPS,
    authority:'City of Chicago',
    coverage:'Chicago, IL',
    public:true,
    primaryEligible:true,
  }),
  'california-cpuc-tnc-public':Object.freeze({
    type:SOURCE_TYPES.GOVERNMENT_TRIPS,
    authority:'California Public Utilities Commission',
    coverage:'California where public fields are sufficient',
    public:true,
    primaryEligible:false,
    caveat:'Free public TNC reporting; passenger-fare eligibility stays off until the relevant public-period schema is verified.',
  }),
  'ridewise-public-rate-cards':Object.freeze({
    type:SOURCE_TYPES.PLATFORM_PUBLICATION,
    authority:'RideWise public rate-card analysis',
    coverage:'312 U.S. cities across all 50 states as published and periodically reverified',
    public:true,
    primaryEligible:false,
    caveat:'Structural calibration only: published Uber/Lyft rate-card components, not a contemporaneous upfront-price observation. Preserve publication date/methodology; never promote it alone.',
  }),
  'taxifare-public-observed':Object.freeze({
    type:SOURCE_TYPES.PLATFORM_PUBLICATION,
    authority:'TaxiFare.org public observed-trip aggregates',
    coverage:'market-specific where published',
    public:true,
    primaryEligible:false,
    caveat:'Observed-rideshare aggregate validation, not taxi pricing where the page identifies rideshare-only data. Respect sample size, confidence and freshness; never promote it alone.',
  }),
  'controlled-public-price-panel':Object.freeze({
    type:SOURCE_TYPES.FIELD_PANEL,
    authority:'American Rider controlled observation of prices publicly offered to ordinary consumers',
    coverage:'commissioned market-specific route/time panel',
    public:true,
    primaryEligible:true,
    caveat:'No nonpublic competitor data, no competitor coordination, no automated access contrary to source terms. Sample multiple providers/routes/times; strip promotions, tips and pass-throughs; timestamp every observation; reject outliers; never let one provider or quote control production.',
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

const NATIONAL_PUBLIC_FIRST_TEMPLATE=Object.freeze({
  requiredFamilies:2,
  sources:Object.freeze(['government-fare-microdata-when-available','controlled-public-price-panel','ridewise-public-rate-cards','taxifare-public-observed']),
  licensedGapFill:'optional-only',
  commissioningRule:'Every new service market gets its own evidence plan and condition cells. Never inherit another market pricing record. Public rate cards bootstrap discovery but cannot alone promote production pricing.',
  expansionRule:'A market may be added without new pricing code: register geography, law/insurance/tolls, public evidence adapters, condition cells, pricing record, then pass promotion gates.',
});

const FLORIDA_PUBLIC_EVIDENCE=Object.freeze({
  statewide:Object.freeze([
    'fdot-open-transportation-data',
    'controlled-public-price-panel',
    'ridewise-public-rate-cards',
    'taxifare-public-observed',
  ]),
  metros:Object.freeze({
    'fl-miami-dade':Object.freeze({corroboration:['taxifare-miami','taxifare-mia','public-platform-route-averages'],regulated:['miami-dade-public-tnc-and-for-hire-records']}),
    'fl-broward':Object.freeze({corroboration:['taxifare-fll','taxifare-south-florida-routes','public-platform-route-averages'],regulated:['broward-tnc-airport-port-audits']}),
    'fl-palm-beach':Object.freeze({corroboration:['public-platform-route-averages','taxifare-south-florida-routes'],regulated:['palm-beach-public-airport-and-transport-records']}),
    'fl-orlando':Object.freeze({corroboration:['taxifare-orlando','taxifare-sfb','public-platform-route-averages']}),
    'fl-tampa-bay':Object.freeze({corroboration:['taxifare-tampa','taxifare-tampa-bay','taxifare-tpa','public-platform-route-averages']}),
    'fl-jacksonville':Object.freeze({corroboration:['taxifare-jacksonville','taxifare-jax','public-platform-route-averages']}),
    'fl-southwest':Object.freeze({corroboration:['taxifare-fort-myers-naples','taxifare-rsw','public-platform-route-averages']}),
    'fl-sarasota-bradenton':Object.freeze({corroboration:['taxifare-sarasota','taxifare-srq','public-platform-route-averages']}),
  }),
  rule:'These are discovery/commissioning inputs, not automatic production authority. Every activated Florida service market still requires its own condition-matched evidence cells and promotion gates.',
});

const MARKET_EVIDENCE_PLANS=Object.freeze({
  'ma-statewide':Object.freeze({
    sources:Object.freeze(['massachusetts-tnc-report','independent-controlled-audit','gridwise-analytics']),
    minimumIndependentFamilies:2,
    liveCollectorRequiredForContinuousMonitoring:true,
    bootstrapReference:null,
  }),
  'il-chicago':Object.freeze({
    sources:Object.freeze(['chicago-tnp-open-data','independent-controlled-audit','gridwise-analytics']),
    minimumIndependentFamilies:2,
    liveCollectorRequiredForContinuousMonitoring:true,
    bootstrapReference:null,
  }),
  'ny-nyc':Object.freeze({
    sources:Object.freeze(['nyc-tlc-hvfhv','independent-controlled-audit','gridwise-analytics']),
    minimumIndependentFamilies:2,
    liveCollectorRequiredForContinuousMonitoring:true,
    bootstrapReference:null,
  }),
  // Region-level plan remains an admission contract only; runtime quotes never read its snapshot.
  'fl-southeast':Object.freeze({
    admissionOnly:true,sources:Object.freeze(['controlled-public-price-panel','ridewise-public-rate-cards','taxifare-public-observed']),
    minimumIndependentFamilies:2,liveCollectorRequiredForContinuousMonitoring:true,bootstrapReference:'existing evidence-gated production record',
  }),
  // Pricing references are owned by the service market, not the broader operating region.
  // South Florida shares legal/routing infrastructure but Miami-Dade, Broward and Palm Beach
  // must never inherit one another's observed market price.
  'fl-miami-dade':Object.freeze({
    regionId:'fl-southeast',sources:Object.freeze(['controlled-public-price-panel','ridewise-public-rate-cards','taxifare-public-observed']),
    minimumIndependentFamilies:2,liveCollectorRequiredForContinuousMonitoring:true,bootstrapReference:'existing evidence-gated production record',
  }),
  'fl-broward':Object.freeze({
    regionId:'fl-southeast',sources:Object.freeze(['controlled-public-price-panel','ridewise-public-rate-cards','taxifare-public-observed']),
    minimumIndependentFamilies:2,liveCollectorRequiredForContinuousMonitoring:true,bootstrapReference:'existing evidence-gated production record',
  }),
  'fl-palm-beach':Object.freeze({
    regionId:'fl-southeast',sources:Object.freeze(['controlled-public-price-panel','ridewise-public-rate-cards','taxifare-public-observed']),
    minimumIndependentFamilies:2,liveCollectorRequiredForContinuousMonitoring:true,bootstrapReference:'existing evidence-gated production record',
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

module.exports={SOURCE_TYPES,NATIONAL_SOURCE_CATALOG,NATIONAL_PUBLIC_FIRST_TEMPLATE,FLORIDA_PUBLIC_EVIDENCE,MARKET_EVIDENCE_PLANS,source,planForRegion,planProblems};
