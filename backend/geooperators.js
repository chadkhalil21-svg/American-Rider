// Bounded geographic Operator retrieval for dispatch.
//
// Firestore has no native radius query. Its documented pattern is to store a geohash, query
// bounded geohash ranges, then apply exact distance filtering. We use the same pattern without
// trusting the geohash as distance authority: matching.js still computes Haversine distance and
// all eligibility gates. The database query exists only to keep candidate reads bounded.
//
// Two search tiers cover ordinary urban and regional pickup. Each tier asks at most nine
// prefixes and caps each prefix. Therefore a dispatch can never turn into "read every available
// Operator", even with a million-Operator fleet.
const BASE32='0123456789bcdefghjkmnpqrstuvwxyz';
const PER_PREFIX_LIMIT=40;
const TIERS=Object.freeze([
  {precision:5, latStep:0.044, lngStep:0.044},   // ~5 km cells
  {precision:4, latStep:0.176, lngStep:0.352},  // ~20 x 39 km cells
]);

function encodeGeohash(lat,lng,precision=7){
  lat=Number(lat);lng=Number(lng);
  if(!Number.isFinite(lat)||!Number.isFinite(lng)||Math.abs(lat)>90||Math.abs(lng)>180)return null;
  let latR=[-90,90],lngR=[-180,180],even=true,bit=0,ch=0,out='';
  while(out.length<precision){
    const r=even?lngR:latR, v=even?lng:lat, mid=(r[0]+r[1])/2;
    if(v>=mid){ch|=1<<(4-bit);r[0]=mid;}else r[1]=mid;
    even=!even;
    if(bit<4)bit++;else{out+=BASE32[ch];bit=0;ch=0;}
  }
  return out;
}
function prefixes(point,tier){
  const set=new Set();
  for(const dy of [-1,0,1])for(const dx of [-1,0,1]){
    const lat=Math.max(-89.999999,Math.min(89.999999,Number(point.lat)+dy*tier.latStep));
    let lng=Number(point.lng)+dx*tier.lngStep;while(lng>180)lng-=360;while(lng<-180)lng+=360;
    set.add(encodeGeohash(lat,lng,tier.precision));
  }
  return [...set].filter(Boolean);
}
async function queryTier(db,point,tier,{excludeIds=new Set(),limitPerPrefix=PER_PREFIX_LIMIT}={}){
  const out=new Map();
  await Promise.all(prefixes(point,tier).map(async prefix=>{
    const snap=await db.collection('operators')
      .where('available','==',true)
      .orderBy('geohash')
      .startAt(prefix).endAt(prefix+'\uf8ff')
      .limit(limitPerPrefix).get();
    for(const d of snap.docs){
      if(excludeIds.has(String(d.id)))continue;
      const x={id:d.id,...d.data()};
      if(Number.isFinite(Number(x.lat))&&Number.isFinite(Number(x.lng)))out.set(String(d.id),x);
    }
  }));
  return [...out.values()];
}
async function nearbyOperatorCandidates(db,point,opts={}){
  if(!encodeGeohash(point?.lat,point?.lng,1))return [];
  for(const tier of TIERS){
    const rows=await queryTier(db,point,tier,opts);
    if(rows.length)return rows;
  }
  return [];
}
module.exports={encodeGeohash,nearbyOperatorCandidates,prefixes,TIERS,PER_PREFIX_LIMIT};
