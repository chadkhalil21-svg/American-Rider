const assert = require('node:assert');
const {
  MIN_PLATFORM_FEE_CENTS,
  MIN_PLATFORM_CONTRIBUTION_CENTS,
  isDomesticCard,
  processingBps,
  economicsFor,
  feeIsSufficient,
  minimumPlatformFeeCents,
} = require('./economics');

const results = [];
const check = (label, ok, detail) => results.push({ label, ok: !!ok, detail });
const usd = (c) => `$${(c / 100).toFixed(2)}`;

check('US cards use domestic processing', isDomesticCard('US') && processingBps('US') === 290);
check('country matching ignores case and spaces', isDomesticCard(' us '));
check('foreign cards use the international-card rate', processingBps('GB') === 440);
check('unknown cards are international-safe, never domestic by assumption',
  !isDomesticCard(null) && processingBps(null) === 440);

// Exact audited examples under the launch cost model.
const examples = [
  // fare, domestic fee, international/unknown fee
  [500, 200, 200],
  [1000, 201, 220],
  [2000, 226, 261],
  [3000, 251, 302],
  [4000, 275, 343],
  [5000, 300, 383],
  [6100, 328, 429],
  [7500, 362, 486],
  [10000, 424, 587],
  [15000, 547, 791],
];
for (const [fare, us, intl] of examples) {
  check(`domestic ${usd(fare)} -> ${usd(us)}`,
    minimumPlatformFeeCents({ travelCostCents: fare, cardCountry: 'US' }) === us);
  check(`international ${usd(fare)} -> ${usd(intl)}`,
    minimumPlatformFeeCents({ travelCostCents: fare, cardCountry: 'GB' }) === intl);
  check(`unknown ${usd(fare)} is priced like international`,
    minimumPlatformFeeCents({ travelCostCents: fare }) === intl);
}

// Exhaustive invariant: every cent from $3 to $500, both card classes.
// The selected fee must meet the contribution target, and one cent less must fail unless the
// selected fee is the absolute $2 floor.
for (const country of ['US', 'GB', null]) {
  let invariant = true;
  let minimal = true;
  let totalMonotonic = true;
  let prevTotal = 0;
  let worst = Infinity;
  let worstAt = 0;

  for (let fare = 300; fare <= 50000; fare++) {
    const fee = minimumPlatformFeeCents({ travelCostCents: fare, cardCountry: country });
    const e = economicsFor({ travelCostCents: fare, platformFeeCents: fee, cardCountry: country });
    const margin = e.platformContributionCents - e.requiredContributionCents;
    if (margin < 0) invariant = false;
    if (margin < worst) { worst = margin; worstAt = fare; }
    const total = fare + fee;
    if (total < prevTotal) totalMonotonic = false;
    prevTotal = total;
    if (fee > MIN_PLATFORM_FEE_CENTS &&
        feeIsSufficient({ travelCostCents: fare, platformFeeCents: fee - 1, cardCountry: country })) {
      minimal = false;
    }
  }

  const name = country === 'US' ? 'domestic' : country ? 'international' : 'unknown';
  check(`${name}: every fare $3-$500 preserves the contribution target`, invariant,
    `worst headroom ${worst}c at ${usd(worstAt)}`);
  check(`${name}: the fee is the minimum whole-cent sufficient amount`, minimal);
  check(`${name}: the traveler fare+fee total never falls as fare rises`, totalMonotonic);
}

// Pass-throughs do not become hidden subsidies.
for (const country of ['US', 'GB']) {
  for (const fare of [1000, 3000, 6100, 10000]) {
    const plain = minimumPlatformFeeCents({ travelCostCents: fare, cardCountry: country });
    const airport = minimumPlatformFeeCents({
      travelCostCents: fare, governmentFeeCents: 200, cardCountry: country,
    });
    const toll = minimumPlatformFeeCents({
      travelCostCents: fare, tollCents: 500, cardCountry: country,
    });
    check(`${country}: $2 government pass-through never lowers the platform fee`, airport >= plain);
    check(`${country}: $5 toll reimbursement never lowers the platform fee`, toll >= plain);

    const ea = economicsFor({
      travelCostCents: fare, platformFeeCents: airport, governmentFeeCents: 200, cardCountry: country,
    });
    const et = economicsFor({
      travelCostCents: fare, platformFeeCents: toll, tollCents: 500, cardCountry: country,
    });
    check(`${country}: government fee processing remains funded`,
      ea.platformContributionCents >= MIN_PLATFORM_CONTRIBUTION_CENTS);
    check(`${country}: toll processing/routing remains funded`,
      et.platformContributionCents >= MIN_PLATFORM_CONTRIBUTION_CENTS);
  }
}

// Smart Travel: two separately charged car legs must fund two fixed-cost units. Treating a
// two-PaymentIntent journey as one transaction would silently lose a second 30c Stripe fixed
// charge plus its second reserve/overhead allocation.
const one = minimumPlatformFeeCents({ travelCostCents: 4000, cardCountry: 'US', transactionCount: 1 });
const two = minimumPlatformFeeCents({ travelCostCents: 4000, cardCountry: 'US', transactionCount: 2 });
check('two separately charged legs require more total platform fee than one transaction', two > one,
  `one=${one} two=${two}`);
const e2 = economicsFor({ travelCostCents: 4000, platformFeeCents: two, cardCountry: 'US', transactionCount: 2 });
check('two-leg journey funds two 75c contribution targets',
  e2.platformContributionCents >= 2 * MIN_PLATFORM_CONTRIBUTION_CENTS, JSON.stringify(e2));

const failed = results.filter((r) => !r.ok);
for (const r of results) console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.label}${r.ok ? '' : '  <-- ' + (r.detail || '')}`);
console.log(failed.length ? `\n${failed.length} FAILED of ${results.length}` : `\nall ${results.length} passed`);
assert.equal(failed.length, 0);
