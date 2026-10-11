'use strict';
// Management-only sensitivity calculator. NOT used in dispatch, quotes, or settlements.
// Unlike economics.js's assumed 6c payout and 25c operating allowances, this
// replaces them with *entered* payout counts and actual operating cost categories.
// No external billing / provider service is inferred, purchased, or touched.
const {economicsFor}=require('./economics');

function nonNegativeWhole(n,name) {
  if(!Number.isSafeInteger(n)||n<0)throw new TypeError(name+' must be a non-negative integer');
  return n;
}
function monthlyCoverage({
  completedTravels,
  travelFareCents=1750,
  platformFeeCents=250,
  cardCountry='US',
  activeConnectAccounts=0,
  collectedAccountFeesCents=0,
  standardPayouts=0,
  variableOpsCostCentsPerTravel=0,
  fixedOpsCostCentsMonthly=0,
  realizedContingencyLossesCents=0,
}={}) {
  for(const [name,n] of Object.entries({
    completedTravels,travelFareCents,platformFeeCents,activeConnectAccounts,
    collectedAccountFeesCents,standardPayouts,variableOpsCostCentsPerTravel,
    fixedOpsCostCentsMonthly,realizedContingencyLossesCents
  }))nonNegativeWhole(n,name);
  if(completedTravels===0) {
    return {completedTravels,contributionAfterProvisionCents:
      -activeConnectAccounts*200+collectedAccountFeesCents-standardPayouts*25-
      fixedOpsCostCentsMonthly-realizedContingencyLossesCents,
      breakEven:false,perTravelCents:null};
  }
  const e=economicsFor({
    travelCostCents:travelFareCents,platformFeeCents,cardCountry,
  });
  // Remove assumed payout+overhead provision only; retain 25c contingency
  // provision. Never take the provision itself as an actual cash vendor bill.
  const availableCents=completedTravels*
    (e.platformContributionCents+e.connectFixedAllowanceCents+e.operatingOverheadCents);
  const actualPayoutFixedCents=25*standardPayouts;
  const connectAccountCents=200*activeConnectAccounts;
  if(collectedAccountFeesCents>connectAccountCents)
    throw new RangeError('account fee recovery cannot exceed modeled Connect account charge');
  const actualVariableOpsCents=completedTravels*variableOpsCostCentsPerTravel;
  // Do not double subtract realized fraud/dispute losses already provisioned
  // at 25c/travel. Keep the unspent provision off the distributable margin.
  const provisionCents=completedTravels*e.contingencyReserveCents;
  const contingencyShortfallCents=Math.max(0,realizedContingencyLossesCents-provisionCents);
  const remainingCents=availableCents-actualPayoutFixedCents-connectAccountCents+
    collectedAccountFeesCents-actualVariableOpsCents-fixedOpsCostCentsMonthly-
    contingencyShortfallCents;
  return {
    completedTravels,
    grossRevenueCents:completedTravels*e.platformGrossCents,
    modeledPlatformContributionCents:completedTravels*e.platformContributionCents,
    replacedAssumptionCents:completedTravels*(e.connectFixedAllowanceCents+e.operatingOverheadCents),
    actualPayoutFixedCents,connectAccountCents,collectedAccountFeesCents,
    actualVariableOpsCents,fixedOpsCostCentsMonthly,
    reservedRiskCents:provisionCents,contingencyShortfallCents,
    contributionAfterProvisionCents:remainingCents,
    perTravelCents:remainingCents/completedTravels,
    modeledMinimumRequiredCents:completedTravels*e.requiredContributionCents,
    meetsModeledMinimum:remainingCents>=completedTravels*e.requiredContributionCents,
    breakEven:remainingCents>=0,
  };
}
module.exports={monthlyCoverage};
