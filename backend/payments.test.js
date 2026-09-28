// Money contract: server pricing, app fallback parity, Smart Travel, pass-throughs.
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

const {
  quote,
  platformFeeCents,
  commissionCents,
  journeyFeeCents,
  isDomesticCard,
} = require('./payments');
const {
  MIN_PLATFORM_CONTRIBUTION_CENTS,
  economicsFor,
} = require('./economics');

const results = [];
const check = (label, ok, detail) => results.push({ label, ok: !!ok, detail });
const usd = (cents) => `$${(cents / 100).toFixed(2)}`;

// Unknown is loss-safe, not optimistically domestic.
check('US is domestic', isDomesticCard('US'));
check('foreign cards are international', !isDomesticCard('GB'));
check('unknown card country is international-safe', !isDomesticCard(null));

// Exact examples from the canonical cost model.
const expected = [
  // fare, US, international/unknown
  [500, 200, 200],
  [1000, 200, 210],
  [2000, 216, 250],
  [3000, 240, 291],
  [4000, 265, 332],
  [5000, 290, 373],
  [6100, 318, 418],
  [10000, 413, 577],
];
for (const [fare, us, intl] of expected) {
  check(`US ${usd(fare)} fee ${usd(us)}`, platformFeeCents(fare, 'US') === us,
    `got ${platformFeeCents(fare, 'US')}`);
  check(`GB ${usd(fare)} fee ${usd(intl)}`, platformFeeCents(fare, 'GB') === intl,
    `got ${platformFeeCents(fare, 'GB')}`);
  check(`unknown ${usd(fare)} uses the safe schedule`, platformFeeCents(fare) === intl,
    `got ${platformFeeCents(fare)}`);
}

// Load only the pricing section of src/data.ts, transpile it with the project's own TypeScript,
// and execute it. This proves the app fallback formula and server formula agree to the cent.
const appSource = fs.readFileSync(path.join(__dirname, '..', 'src', 'data.ts'), 'utf8');
const start = appSource.indexOf('export const APP_FEE = 2.0;');
const stop = appSource.indexOf('// The coordination commission:', start);
if (start < 0 || stop < 0) throw new Error('could not isolate pricing section in src/data.ts');
const synthetic = appSource.slice(start, stop);
const js = ts.transpileModule(synthetic, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;
const sandbox = { exports: {}, module: { exports: {} }, Math };
sandbox.module.exports = sandbox.exports;
vm.runInNewContext(js, sandbox);
const appPlatformFee = sandbox.exports.platformFee;
if (typeof appPlatformFee !== 'function') throw new Error('src/data.ts platformFee did not transpile');

for (const country of ['US', 'GB', null]) {
  let mismatches = 0;
  let first = null;
  for (let fare = 300; fare <= 50000; fare++) {
    const app = Math.round(appPlatformFee(fare / 100, country) * 100);
    const server = platformFeeCents(fare, country);
    if (app !== server) {
      mismatches++;
      if (!first) first = `${usd(fare)} app=${app} server=${server}`;
    }
  }
  check(`${country || 'unknown'}: app and server agree for every cent $3-$500`,
    mismatches === 0, `${mismatches} mismatches; first ${first}`);
}

// Split and invariant.
for (const country of ['US', 'GB', null]) {
  for (const fare of [500, 1000, 2450, 6100, 10000, 25000]) {
    const q = quote(fare, undefined, undefined, country);
    check(`${country || 'unknown'} ${usd(fare)}: operator gets 99% of fare`,
      q.operatorGets === fare - commissionCents(fare), JSON.stringify(q));
    check(`${country || 'unknown'} ${usd(fare)}: traveler total reconciles`,
      q.travelerPays === fare + q.appFee, JSON.stringify(q));
    check(`${country || 'unknown'} ${usd(fare)}: platform gross is commission + fee`,
      q.platformTake === q.commission + q.appFee, JSON.stringify(q));
    check(`${country || 'unknown'} ${usd(fare)}: modeled contribution target is preserved`,
      q._economics.platformContributionCents >= MIN_PLATFORM_CONTRIBUTION_CENTS,
      JSON.stringify(q._economics));
  }
}

// Government fee: beneficiary receives the exact fee; American Rider recovers the cost of
// processing it through a slightly higher platform fee.
const MIA = {
  id: 'mia-tnc-pickup',
  name: 'Miami International Airport fee',
  payee: 'Miami-Dade Aviation Department',
  cents: 200,
  end: 'pickup',
};
for (const country of ['US', 'GB']) {
  const plain = quote(2450, undefined, undefined, country);
  const airport = quote(2450, undefined, [MIA], country);
  check(`${country}: MIA beneficiary amount remains exactly $2`,
    airport.governmentFeeCents === 200 && airport.feeLines[0].cents === 200);
  check(`${country}: $2 government fee increases traveler total by $2 plus only its induced economics`,
    airport.travelerPays === 2450 + 200 + airport.appFee);
  check(`${country}: government pass-through cannot reduce platform fee`, airport.appFee >= plain.appFee);
  check(`${country}: government pass-through still preserves contribution`,
    airport._economics.platformContributionCents >= MIN_PLATFORM_CONTRIBUTION_CENTS,
    JSON.stringify(airport._economics));
}

// Toll: operator is reimbursed in full and the induced card+Connect cost is funded.
for (const country of ['US', 'GB']) {
  const plain = quote(5000, undefined, undefined, country, 0);
  const tolled = quote(5000, undefined, undefined, country, 500);
  check(`${country}: operator receives 99% of fare plus full $5 toll`,
    tolled.operatorGets === 5000 - commissionCents(5000) + 500);
  check(`${country}: toll is included once in traveler total`,
    tolled.travelerPays === 5000 + tolled.appFee + 500);
  check(`${country}: toll processing cannot reduce platform fee`, tolled.appFee >= plain.appFee);
  check(`${country}: tolled travel preserves contribution`,
    tolled._economics.platformContributionCents >= MIN_PLATFORM_CONTRIBUTION_CENTS,
    JSON.stringify(tolled._economics));
}

// Smart Travel uses two PaymentIntents. The combined journey fee must therefore fund two
// fixed transaction units; leg 2 carries only the difference not already collected on leg 1.
for (const country of ['US', 'GB']) {
  const leg1Fare = 4000;
  const leg2Fare = 3000;
  const leg1Fee = journeyFeeCents(leg1Fare, null, country);
  const leg2Fee = journeyFeeCents(leg2Fare, {
    leg1FareCents: leg1Fare,
    leg1GovernmentFeeCents: 0,
    leg1TollCents: 0,
  }, country);
  const combined = platformFeeCents(leg1Fare + leg2Fare, country, 0, 0, 2);
  check(`${country}: two Smart legs collect exactly the two-transaction journey fee`,
    leg1Fee + leg2Fee === combined,
    `leg1=${leg1Fee} leg2=${leg2Fee} combined=${combined}`);
  const econ = economicsFor({
    travelCostCents: leg1Fare + leg2Fare,
    platformFeeCents: combined,
    cardCountry: country,
    transactionCount: 2,
  });
  check(`${country}: Smart journey funds two contribution targets`,
    econ.platformContributionCents >= 2 * MIN_PLATFORM_CONTRIBUTION_CENTS,
    JSON.stringify(econ));
}

const failed = results.filter((r) => !r.ok);
for (const r of results) {
  console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.label}${r.ok ? '' : '  <-- ' + (r.detail || '')}`);
}
console.log(failed.length ? `\n${failed.length} FAILED of ${results.length}` : `\nall ${results.length} passed`);
assert.equal(failed.length, 0);
