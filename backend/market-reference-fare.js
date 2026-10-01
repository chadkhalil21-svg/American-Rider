// Converts a market-controlled Traveler target into a Travel Fare while preserving the
// existing server economics. Government fees and tolls are excluded from the target comparison.
function controlledTotal(breakdown){return breakdown.travelerPays-breakdown.passThroughCents;}
function fareForMarketTarget({floorFareCents,targetControlledTotalCents,quoteForFare}){
  const floor=Math.max(0,Math.trunc(floorFareCents));
  if(!Number.isInteger(targetControlledTotalCents)||targetControlledTotalCents<=0)return {fareCents:floor,reason:'reference unavailable'};
  const floorBreakdown=quoteForFare(floor),floorTotal=controlledTotal(floorBreakdown);
  if(floorTotal>=targetControlledTotalCents)return {fareCents:floor,reason:'production/economic floor',controlledTotalCents:floorTotal};
  let lo=floor,hi=Math.max(floor,targetControlledTotalCents);
  while(lo<hi){
    const mid=Math.ceil((lo+hi)/2),total=controlledTotal(quoteForFare(mid));
    if(total<=targetControlledTotalCents)lo=mid;else hi=mid-1;
  }
  return {fareCents:lo,reason:'market reference',controlledTotalCents:controlledTotal(quoteForFare(lo))};
}
module.exports={controlledTotal,fareForMarketTarget};
