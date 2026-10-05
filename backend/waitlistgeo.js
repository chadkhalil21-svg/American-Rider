// Only a half-degree cell may be retained for out-of-county interest; never write exact GPS.
function pointFromWaitlist(b){
 if(!b||b.lat==null||b.lng==null||String(b.lat).trim()===''||String(b.lng).trim()==='')return null;
 const lat=Number(b.lat),lng=Number(b.lng);
 return Number.isFinite(lat)&&Number.isFinite(lng)&&Math.abs(lat)<=90&&Math.abs(lng)<=180?{lat,lng}:null;
}
function coarseAreaFor(point){
 return point?`${Math.floor(point.lat*2)/2},${Math.floor(point.lng*2)/2}`:null;
}
module.exports={pointFromWaitlist,coarseAreaFor};
