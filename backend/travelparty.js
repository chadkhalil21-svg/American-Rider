// Server-authoritative Booker / physical Traveler semantics.
const { normalizeTeenParty, operatorTeenView } = require('./family');
const MAX_NAME=80;
const clean=(v,n=MAX_NAME)=>String(v||'').trim().replace(/\s+/g,' ').slice(0,n);

async function normalizeParty(body={},booker={}){
 const mode=['self','other_adult','teen'].includes(body.partyMode)?body.partyMode:'self';
 if(mode==='teen') return normalizeTeenParty({familyLinkId:body.familyLinkId,requesterUid:booker.uid,bookerUid:booker.uid,journeyNo:body.journeyNo||null});
 const bookerName=clean(booker.name||body.bookerName||'Traveler');
 if(mode==='self') return {ok:true,party:{mode:'self',travelerName:bookerName,bookerName,bookedForAnother:false}};
 const travelerName=clean(body.travelerName);
 if(!travelerName)return {ok:false,code:'traveler_name_required',error:'Name the person taking this Travel.'};
 return {ok:true,party:{mode:'other_adult',travelerName,bookerName,bookedForAnother:true}};
}
function operatorPartyView(party){return operatorTeenView(party||{});}
module.exports={normalizeParty,operatorPartyView};
