'use strict';
const assert=require('node:assert/strict');
const {monthlyCoverage}=require('./fully-loaded-coverage');
const {economicsFor,MIN_PLATFORM_CONTRIBUTION_CENTS}=require('./economics');
const dollars=n=>(n/100).toFixed(2);
const base=economicsFor({travelCostCents:1750,platformFeeCents:250,cardCountry:'US'});
assert.equal(base.platformGrossCents,267);
assert.equal(base.platformContributionCents,114);
// The model's 25c per-Travel overhead is an allowance, not a vendor invoice.
assert.equal(base.operatingOverheadCents,25);
assert.equal(base.connectFixedAllowanceCents,6);
const params={completedTravels:20,travelFareCents:1750,platformFeeCents:250,
  cardCountry:'US',activeConnectAccounts:1,collectedAccountFeesCents:0,
  standardPayouts:4,variableOpsCostCentsPerTravel:25};
const actual=monthlyCoverage(params);
assert.equal(actual.grossRevenueCents,5340);
assert.equal(actual.contributionAfterProvisionCents,2100);
assert.equal(actual.perTravelCents,105);
assert.equal(actual.breakEven,true);
assert.equal(actual.meetsModeledMinimum,true);
// The 20-Travel waiver means $2 Connect ACTIVE ACCOUNT charge is not recovered.
assert.equal(actual.connectAccountCents,200);
assert.equal(actual.collectedAccountFeesCents,0);
const overBudget=monthlyCoverage({...params,variableOpsCostCentsPerTravel:60});
assert.equal(overBudget.perTravelCents,70);
assert.equal(overBudget.meetsModeledMinimum,false);
assert.equal(overBudget.breakEven,true);
const unprofitable=monthlyCoverage({...params,variableOpsCostCentsPerTravel:150});
assert.equal(unprofitable.perTravelCents,-20);
assert.equal(unprofitable.breakEven,false);
// International fee burden shrinks risk/headroom.
const international=monthlyCoverage({...params,cardCountry:'GB'});
assert.equal(international.perTravelCents,75);
assert.equal(international.meetsModeledMinimum,true);
assert.equal(monthlyCoverage({...params,cardCountry:'GB',variableOpsCostCentsPerTravel:35}).perTravelCents,65);
// A monthly account fee can be recovered from the Operator when under the
// waiver limit, but only once the actual successful collection is recorded.
const five=monthlyCoverage({
  ...params,completedTravels:5,activeConnectAccounts:1,
  standardPayouts:4,collectedAccountFeesCents:200,
});
const missed=monthlyCoverage({
  ...params,completedTravels:5,activeConnectAccounts:1,
  standardPayouts:4,collectedAccountFeesCents:0,
});
assert.equal(five.contributionAfterProvisionCents-missed.contributionAfterProvisionCents,200);
assert.equal(five.actualPayoutFixedCents,100,
  'four real payouts cost $1 and may overwhelm a six-cent-per-Travel allowance');
// The $0.25 reserve is an allocation, not a second charge every time an
// actual loss already covered by the reserve occurs.
const coveredLoss=monthlyCoverage({...params,realizedContingencyLossesCents:500});
assert.equal(coveredLoss.contributionAfterProvisionCents,actual.contributionAfterProvisionCents);
const uncoveredLoss=monthlyCoverage({...params,realizedContingencyLossesCents:600});
assert.equal(uncoveredLoss.contributionAfterProvisionCents,actual.contributionAfterProvisionCents-100);
// Fixed service costs scale nonlinearly with the completed-Travel denominator.
const justBackend=monthlyCoverage({...params,completedTravels:1000,
  activeConnectAccounts:50,standardPayouts:200,
  fixedOpsCostCentsMonthly:700});
assert.equal(justBackend.perTravelCents,104.3);
const hypotheticalFullStack=monthlyCoverage({...params,completedTravels:1000,
  activeConnectAccounts:50,standardPayouts:200,
  fixedOpsCostCentsMonthly:12300}); // illustrative $7 server+$96 routing+$20 email
assert.equal(hypotheticalFullStack.perTravelCents,92.7);
const noTravels=monthlyCoverage({completedTravels:0,fixedOpsCostCentsMonthly:700});
assert.equal(noTravels.breakEven,false);
assert.equal(noTravels.contributionAfterProvisionCents,-700);
assert.equal(noTravels.perTravelCents,null);
assert.throws(()=>monthlyCoverage({...params,variableOpsCostCentsPerTravel:-1}),/non-negative/);
assert.throws(()=>monthlyCoverage({...params,collectedAccountFeesCents:201}),/recovery/);
console.log('PASS full-cost sensitivity, 20-travel Connect waiver, payout cadence, paid hosting, domestic/international pricing, reserve utilization and downside cases. $20 domestic modeled='+dollars(base.platformContributionCents)+'; full-cost at 25c actual overhead='+dollars(actual.perTravelCents)+'; at 60c='+dollars(overBudget.perTravelCents)+'; at 150c='+dollars(unprofitable.perTravelCents)+'; contribution floor='+dollars(MIN_PLATFORM_CONTRIBUTION_CENTS));
