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
    source: 'https://www.flsenate.gov/Laws/Statutes/2026/627.748',
    loggedOn: Object.freeze({ statute: 'Fla. Stat. §627.748(7)(b)', perPerson: 50000, perIncident: 100000, propertyDamage: 25000 }),
    ride: Object.freeze({ statute: 'Fla. Stat. §627.748(7)(c)', primaryLiabilityMinDollars: 1000000 }),
    pipRequired: true,
    pipMinDollars: 10000,
    umUim: 'as required by Fla. Stat. §627.727',
    umRejectionAccepted: () => process.env.INSURANCE_UM_REJECTION_ACCEPTED === '1',
    policyUse: 'transportation-network / for-hire passenger transportation',
    script:
      "I'm an independent contractor using my own vehicle for prearranged passenger transportation through a transportation network company in Florida. I need a standalone commercial for-hire / livery automobile policy — not a personal auto policy and not a rideshare endorsement. Please quote the lowest-cost policy that recognizes TNC passenger transportation and satisfies Florida Statute 627.748 for every required period, including at least $50,000/$100,000/$25,000 while logged on and not on a prearranged Travel and at least $1,000,000 primary liability during a prearranged Travel, together with the required Florida PIP and UM/UIM treatment. Please confirm the carrier, deductibles, exclusions, whether my vehicle and any airport/private-livery work are covered, and how cancellation, nonrenewal, or policy-status changes can be communicated to American Rider.",
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
