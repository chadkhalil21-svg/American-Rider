// Lawful/public collectors that can run without a commercial credential.
// Commercial/licensed collectors are registered separately when their contract and schema exist.
const { normalizeObservation }=require('./market-evidence-ingest');

async function json(url){
  const r=await fetch(url,{headers:{'user-agent':'American-Rider/1.0 market-reference'}});
  if(!r.ok)throw new Error(`HTTP ${r.status} from evidence source`);
  return r.json();
}

function chicagoDaypart(iso){const h=new Date(iso).getUTCHours();return h<6?'overnight':h<10?'morning':h<16?'midday':h<20?'evening':'night';}
function chicagoWeekend(iso){const d=new Date(iso).getUTCDay();return d===0||d===6?'weekend':'weekday';}

async function collectChicago({marketId='il-chicago'}={}){
  // City of Chicago 2026 TNP dataset. Fare and total are rounded by the publisher; provenance
  // remains attached so calibration can weight it appropriately.
  const base='https://data.cityofchicago.org/resource/6dvr-xwnh.json';
  const params=new URLSearchParams({
    '$limit':'1000',
    '$order':'trip_start_timestamp DESC',
    '$where':"trip_start_timestamp IS NOT NULL AND trip_seconds > 0 AND trip_miles > 0 AND trip_total > 0",
  });
  const rows=await json(`${base}?${params}`);
  return rows.map((r)=>{
    const observedAt=new Date(r.trip_start_timestamp).toISOString();
    return normalizeObservation({
      marketId,sourceId:'chicago-tnp-open-data',sourceType:'government-trips',observedAt,
      serviceClass:'standard',routedMiles:Number(r.trip_miles),routedMinutes:Number(r.trip_seconds)/60,
      travelerTotalCents:Math.round((Number(r.fare)+Number(r.additional_charges||0))*100),daypart:chicagoDaypart(observedAt),
      weekdayWeekend:chicagoWeekend(observedAt),calendarClass:'ordinary',regulatedLocationClass:'ordinary',
      provenance:'City of Chicago TNP Trips 2025+, dataset 6dvr-xwnh; comparable passenger charge = fare + additional_charges, excludes voluntary tip; fare rounded by publisher',
    });
  });
}

function configuredCollectors(){
  const out={};
  // Public collectors are enabled only for a market whose evidence plan names the source.
  out['chicago-tnp-open-data']=collectChicago;
  return out;
}
module.exports={collectChicago,configuredCollectors};
