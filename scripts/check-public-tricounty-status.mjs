// One read-only production verification during CI: do not confuse a county in
// the geographic registry with a commercially activated pickup market.
// Never changes market admission, Operator eligibility or live payment settings.
const url='https://american-rider-server-3d7x.onrender.com/markets';
const required=['fl-miami-dade','fl-broward','fl-palm-beach'];
try {
  const response=await fetch(url,{method:'GET',signal:AbortSignal.timeout(12000),
    headers:{Accept:'application/json'}});
  if(!response.ok) {
    console.log('TRI_COUNTY_STATUS_UNVERIFIED: Public server returned HTTP '+response.status);
  } else {
    const body=await response.json();
    if(!Array.isArray(body?.active)) throw new Error('No valid list of active markets');
    const active=new Set(body.active.filter(x=>x?.status==='active').map(x=>String(x.id)));
    for(const county of required){
      console.log('LIVE_TRI_COUNTY '+county+' '+(active.has(county)?'ACTIVE':'NOT_CONFIRMED_ACTIVE'));
    }
    console.log('LIVE_TRI_COUNTY_SUMMARY '+required.filter(x=>active.has(x)).length+'/3 currently public-active.');
  }
} catch(e) {
  console.log('TRI_COUNTY_STATUS_UNVERIFIED: '+String(e.message||e).slice(0,200));
}
// A read-only network probe is informative, not an authority to launch service.
// Unreachable production must not make an otherwise unrelated code test claim
// insurance or permissions are satisfied. Missing statuses remain unverified.
