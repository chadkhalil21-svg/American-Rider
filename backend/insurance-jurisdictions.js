// Jurisdiction-specific Operator insurance requirements and buying instructions.
//
// RULE: a state is not activated here by copying another state's numbers. Each jurisdiction is
// researched, sourced, reviewed and then added explicitly. The app asks this module for the
// Operator's declared operating state, so the buying script changes with the market.
//
// Only Florida is configured today because American Rider's active markets are in Florida.
// An expansion state fails closed until its verified requirements are added here.
const REQUIREMENTS = Object.freeze({
  FL: Object.freeze({
    state: 'FL',
    stateName: 'Florida',
    statute: 'Fla. Stat. §627.748(7)',
    source: 'https://www.flsenate.gov/Laws/Statutes/2025/627.748',
    loggedOn: Object.freeze({ statute: 'Fla. Stat. §627.748(7)(b)', perPerson: 50000, perIncident: 100000, propertyDamage: 25000 }),
    ride: Object.freeze({ statute: 'Fla. Stat. §627.748(7)(c)', primaryLiabilityMinDollars: 1000000 }),
    pipRequired: true,
    pipMinDollars: 10000,
    umUim: 'as required by Fla. Stat. §627.727',
    umRejectionAccepted: () => process.env.INSURANCE_UM_REJECTION_ACCEPTED === '1',
    policyUse: 'transportation-network / for-hire passenger transportation',
    script:
      "I use my vehicle for prearranged passenger transportation through a transportation network company in Florida. American Rider's current onboarding policy asks me to provide my own standalone commercial for-hire passenger policy recognizing this use across all platform periods. Please assess available policies against that operating policy and Florida Statute 627.748; the statute itself allows the driver, the company, or both to maintain required coverage. Please confirm the required $50,000/$100,000/$25,000 logged-on liability, $1,000,000 primary liability during a prearranged ride, applicable PIP and UM/UIM treatment, carrier eligibility, deductibles, exclusions, vehicle and airport/private-livery use. Explain in writing how cancellation, nonrenewal and coverage changes can be verified by American Rider. I will submit the declarations page for American Rider review before operating.",
  }),
});

function forState(state) {
  return REQUIREMENTS[String(state || '').trim().toUpperCase()] || null;
}

function forMarket(market) {
  return forState(market?.state);
}

function publicConfig(rule) {
  if (!rule) return null;
  return {
    state: rule.state,
    stateName: rule.stateName,
    statute: rule.statute,
    source: rule.source,
    script: rule.script,
    policyUse: rule.policyUse,
    limits: {
      loggedOn: rule.loggedOn,
      ride: { statute: rule.ride.statute, primaryLiability: rule.ride.primaryLiabilityMinDollars },
      ridePrimaryLiability: rule.ride.primaryLiabilityMinDollars,
      pipRequired: rule.pipRequired,
      umUim: rule.umUim,
    },
  };
}

module.exports = { REQUIREMENTS, forState, forMarket, publicConfig };
