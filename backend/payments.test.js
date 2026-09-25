// The platform fee, and the one thing two implementations of it must never do: disagree.
//
// The app quotes with src/data.ts platformFee() and the server charges with payments.js
// platformFeeCents(). A traveler quoted $64.54 and charged $64.55 has been shown two prices
// for one journey, so the two are held to each other for EVERY cent from $0 to $500 — and the
// app's function is evaluated from its own source, not from a copy typed into this file.
//
// The rule (Chad, 9 Sept 2026: "five percent"; relayed by Adrian): the greater of $1.50 and
// 5% of the travel fare, rounded up to the cent.
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { platformFeeCents, commissionCents, quote } = require('./payments');

const results = [];
const check = (label, ok, detail) => results.push({ label, ok: !!ok, detail });
const usd = (cents) => `$${(cents / 100).toFixed(2)}`;

// ——— THE RULE ————————————————————————————————————————————————————————————————————
// TWO SCHEDULES SINCE 20 SEPT 2026 (Chad): the fee is the greater of $1.50 and 2.5% of the
// fare on a US-issued card, or 5% on any other. A card we do not know yet is quoted domestic —
// see isDomesticCard() in payments.js for why that, and not the safer-looking opposite.
const DOMESTIC = [
  [100, 200], [999, 200], [2500, 200], [3999, 200],
  [4000, 200], // 5% of $40.00 is exactly $2.00
  [4001, 201], [10000, 500], [25000, 1250], [100000, 5000], [500000, 25000],
];
const INTERNATIONAL = [
  [100, 200], [999, 200], [2500, 200], [3076, 200],
  [3077, 201], // 6.5% first exceeds the $2.00 floor here
  [4500, 293], [6000, 390], [10000, 650], [25000, 1625], [100000, 6500], [500000, 32500],
];
for (const [fare, fee] of DOMESTIC) {
  check(`domestic fee(${usd(fare)}) = ${usd(fee)}`, platformFeeCents(fare, 'US') === fee, `got ${platformFeeCents(fare, 'US')}`);
}
for (const [fare, fee] of INTERNATIONAL) {
  check(`international fee(${usd(fare)}) = ${usd(fee)}`, platformFeeCents(fare, 'GB') === fee, `got ${platformFeeCents(fare, 'GB')}`);
}

check('an unknown card is quoted on the DOMESTIC schedule',
  platformFeeCents(10000) === platformFeeCents(10000, 'US') && platformFeeCents(10000) === 500);
check('country is read case- and space-insensitively',
  platformFeeCents(10000, ' us ') === 250 && platformFeeCents(10000, 'us') === 250);
check('every non-US country is international',
  ['GB', 'FR', 'CA', 'DE', 'MX', 'JP'].every((c) => platformFeeCents(10000, c) === 650));

let flatBelowD = true;
for (let c = 0; c < 4000; c++) if (platformFeeCents(c, 'US') !== 200) flatBelowD = false;
check('$2.00 exactly at every cent below a $40 fare, domestic', flatBelowD);
let flatBelowI = true;
for (let c = 0; c <= 3076; c++) if (platformFeeCents(c, 'GB') !== 200) flatBelowI = false;
check('$2.00 through a $30.76 fare, international', flatBelowI);

// ——— NO STEP, ON EITHER SCHEDULE ——————————————————————————————————————————————————
// This is why the rule is max(floor, rate) and not the tier table proposed on 20 Sept: a tier
// boundary makes a fare one cent higher cost the traveler 50 cents more.
for (const [name, country] of [['domestic', 'US'], ['international', 'GB']]) {
  let monotonic = true;
  let allInRises = true;
  let wholeCents = true;
  let biggestJump = 0;
  for (let c = 1; c <= 50000; c++) {
    const prev = platformFeeCents(c - 1, country);
    const fee = platformFeeCents(c, country);
    if (fee < prev) monotonic = false;
    if (c + fee <= c - 1 + prev) allInRises = false;
    if (!Number.isInteger(fee)) wholeCents = false;
    biggestJump = Math.max(biggestJump, (c + fee) - (c - 1 + prev));
  }
  check(`${name}: the fee never falls as the fare rises, $0–$500`, monotonic);
  check(`${name}: the all-in price strictly rises with the fare (so a fare can be recovered from a total)`, allInRises);
  check(`${name}: the fee is always a whole number of cents`, wholeCents);
  check(`${name}: one more cent of fare never costs the traveler more than two cents`, biggestJump <= 2, `got ${biggestJump}`);
}

// ——— NEITHER SCHEDULE EVER LOSES MONEY ————————————————————————————————————————————
// Stripe takes 2.9% + $0.30 of the WHOLE charge on a US card and 4.4% + $0.30 on any other,
// and it takes it from us, not from the operator. The 1% commission is already earned on the
// fare. This is the whole reason the rates are 2.5% and 5% rather than anything lower.
for (const [name, country, rate] of [['domestic', 'US', 0.029], ['international', 'GB', 0.044]]) {
  let worst = Infinity;
  let worstAt = 0;
  for (let c = 100; c <= 50000; c++) {
    const fee = platformFeeCents(c, country);
    const net = fee + commissionCents(c) - (rate * (c + fee) + 30);
    if (net < worst) { worst = net; worstAt = c; }
  }
  check(`${name}: no fare from $1 to $500 loses money`, worst >= 0, `worst ${worst.toFixed(4)}c at ${usd(worstAt)}`);
}

// ——— PARITY WITH THE APP ——————————————————————————————————————————————————————————
// src/data.ts is TypeScript that imports the i18n layer, so it cannot be require()d here.
// Instead platformFee() and the isDomesticCard() it calls are cut out of the file by name,
// their type annotations removed, and evaluated with the APP_FEE the file declares. If either
// moves or changes shape this extraction fails loudly, which is the right outcome: the parity
// check must then be redone.
const appSource = fs.readFileSync(path.join(__dirname, '..', 'src', 'data.ts'), 'utf8');
function cutFunction(name) {
  const head = appSource.indexOf(`export function ${name}(`);
  if (head < 0) throw new Error(`could not find ${name}() in src/data.ts`);
  const open = appSource.indexOf('{', head);
  let depth = 0;
  let close = -1;
  for (let i = open; i < appSource.length; i++) {
    if (appSource[i] === '{') depth++;
    if (appSource[i] === '}') { depth--; if (depth === 0) { close = i; break; } }
  }
  if (close < 0) throw new Error(`unbalanced braces in ${name}()`);
  return appSource.slice(head, close + 1)
    .replace(/^export /, '')
    .replace(/: number/g, '')
    .replace(/: boolean/g, '')
    .replace(/\?: string \| null \| undefined/g, '')
    .replace(/cardCountry\?: string \| null/g, 'cardCountry');
}
function appPlatformFeeFromSource() {
  const feeConst = /export const APP_FEE = ([0-9.]+);/.exec(appSource);
  if (!feeConst) throw new Error('could not find APP_FEE in src/data.ts');
  const body = `${cutFunction('isDomesticCard')}\n${cutFunction('platformFee')}`;
  return new Function('APP_FEE', `${body}\nreturn platformFee;`)(Number(feeConst[1]));
}
const appPlatformFee = appPlatformFeeFromSource();
// The same rule written out by hand, in case the extraction and the file both drift together.
const portedAppFormula = (dollars, country) => {
  const cents = Math.round(dollars * 100);
  const bps = String(country || 'US').toUpperCase() === 'US' ? 500 : 650;
  return Math.max(2, Math.ceil((cents * bps) / 10000) / 100);
};
// A deliberately naive floating-point version, retained to prove the integer-cent path stays
// authoritative at percentage boundaries.
const naiveDollarFormula = (dollars) => Math.ceil(Math.max(2, 0.065 * dollars) * 100) / 100;

for (const country of ['US', 'GB']) {
  let realMismatch = 0;
  let portedMismatch = 0;
  let firstReal = null;
  for (let c = 0; c <= 50000; c++) {
    const server = platformFeeCents(c, country);
    const real = Math.round(appPlatformFee(c / 100, country) * 100);
    if (real !== server) { realMismatch++; if (!firstReal) firstReal = `${usd(c)}: app ${real} server ${server}`; }
    if (Math.round(portedAppFormula(c / 100, country) * 100) !== server) portedMismatch++;
  }
  check(`${country}: src/data.ts platformFee(), evaluated from its own source, equals the server at every cent from $0 to $500`,
    realMismatch === 0, `${realMismatch} mismatches; first ${firstReal}`);
  check(`${country}: the hand-ported app formula equals the server at every cent from $0 to $500`,
    portedMismatch === 0, `${portedMismatch} mismatches`);
}
let naiveMismatch = 0;
for (let c = 0; c <= 50000; c++) {
  if (Math.round(naiveDollarFormula(c / 100) * 100) !== platformFeeCents(c, 'GB')) naiveMismatch++;
}
check('the naive dollar arithmetic would NOT have matched — which is why cents come first',
  naiveMismatch > 0, `${naiveMismatch} mismatches`);
check('the app declares the same $2.00 minimum the server does', appPlatformFee(0) === 2);

// ——— NEVER A LOSS ———————————————————————————————————————————————————————————————
// Stripe takes its rate of the WHOLE charge (fare + fee) plus $0.30, rounded to the cent —
// rounded up here, which is the unkind direction. American Rider keeps the 1% commission
// (floored, as commissionCents does) plus the fee. The net must be positive on every fare.
function worstNet(stripeRate, country) {
  let worst = Infinity;
  let at = null;
  for (let fare = 500; fare <= 50000; fare++) {
    const fee = platformFeeCents(fare, country);
    const stripe = Math.ceil(stripeRate * (fare + fee) + 30);
    const net = commissionCents(fare) + fee - stripe;
    if (net < worst) { worst = net; at = fare; }
  }
  return { worst, at };
}
const us = worstNet(0.029, 'US');
const intl = worstNet(0.044, 'GB');
check('never a loss on a US card charged the US schedule (2.9% + $0.30 of the whole charge), $5–$500',
  us.worst >= 0, `worst net ${us.worst}c at ${usd(us.at)}`);
check('never a loss on an international card charged the international schedule (4.4% + $0.30), $5–$500',
  intl.worst >= 0, `worst net ${intl.worst}c at ${usd(intl.at)}`);

// ——— THE ONE CASE THAT DOES LOSE, DELIBERATELY, AND HOW FAR IT GOES ————————————————
// A traveler with no payment method on file is quoted the DOMESTIC schedule, because the
// quote must not move once a card is entered (isDomesticCard()). If that first card turns out
// to be foreign, the domestic fee under-covers the 4.4% and we carry the difference.
//
// IT IS BOUNDED BY THE MARKET, NOT BY THE RULE. The exposure grows with the fare, so the
// number that matters is the largest fare the market can actually produce, not $500 — the
// region gate in market.js refuses anything outside South Florida. At the longest travel the
// fare table holds (Fort Lauderdale Airport, $42.80) it is under a dollar. This test states
// the number rather than asserting it away, so it moves into view if the fares ever move.
const unknownIntl = worstNet(0.044, undefined);
const atFortLauderdale = (() => {
  const fare = 4280;
  const fee = platformFeeCents(fare); // unknown -> domestic
  return commissionCents(fare) + fee - Math.ceil(0.044 * (fare + fee) + 30);
})();
check('an unknown card that turns out foreign costs us under $1 at the longest fare in the table',
  atFortLauderdale > -100, `${atFortLauderdale}c at $42.80`);
check('and the exposure only becomes large at fares the market cannot produce',
  unknownIntl.at > 20000, `worst ${unknownIntl.worst}c at ${usd(unknownIntl.at)}`);

// ——— THE SPLIT ——————————————————————————————————————————————————————————————————
const q1 = quote(2450, undefined, undefined, 'US');
check('quote($24.50): traveler pays $26.50, operator gets $24.26, we keep $2.24',
  q1.travelerPays === 2650 && q1.operatorGets === 2426 && q1.platformTake === 224 &&
  q1.commission === 24 && q1.appFee === 200, JSON.stringify(q1));
const q2 = quote(10000, undefined, undefined, 'GB');
check('quote($100.00 international): traveler pays $106.50, operator gets $99.00, we keep $7.50',
  q2.travelerPays === 10650 && q2.operatorGets === 9900 && q2.platformTake === 750 &&
  q2.commission === 100 && q2.appFee === 650, JSON.stringify(q2));
check('the operator\'s share never depends on the fee: 99% of the fare at $24.50 and at $100.00',
  q1.operatorGets === 2450 - 24 && q2.operatorGets === 10000 - 100);

// ——— ONE FEE PER SMART TRAVEL JOURNEY ————————————————————————————————————————————————
// Leg 2 names leg 1; it pays the fee on the combined car fare less what leg 1 carried.
const { journeyFeeCents } = require('./payments');
// The journey rule is identical on both schedules: the second car leg pays only the difference
// between the fee on the combined car fare and the fee already carried by leg 1.
check('journey: $12 leg 1 then $10 leg 2 remains inside the $2 floor, so leg 2 pays $0',
  journeyFeeCents(1000, { leg1FareCents: 1200 }, 'GB') === 0);
check('journey international: $40 leg 1 ($2.60) + $30 → combined $70 fee $4.55; leg 2 pays $1.95',
  journeyFeeCents(3000, { leg1FareCents: 4000 }, 'GB') === 195);
check('journey: leg 2 is never charged below zero',
  journeyFeeCents(100, { leg1FareCents: 500 }, 'GB') === 0);
check('journey: with no leg 1 the standard fee applies',
  journeyFeeCents(1000, null, 'GB') === 200 && journeyFeeCents(10000, { leg1FareCents: 0 }, 'GB') === 650);
check('journey domestic: $50 leg 1 ($2.50) + $30 → combined $80 fee $4.00; leg 2 pays $1.50',
  journeyFeeCents(3000, { leg1FareCents: 5000 }, 'US') === 150);
check('journey, domestic: one journey is never charged two fees',
  journeyFeeCents(2000, null, 'US') + journeyFeeCents(2000, { leg1FareCents: 2000 }, 'US')
    === platformFeeCents(4000, 'US'));
check('quote() carries the journey fee into what the traveler pays and what we keep',
  (() => { const q = quote(3000, { leg1FareCents: 4000 }, undefined, 'GB'); return q.appFee === 195 && q.travelerPays === 3195 && q.platformTake === 225 && q.operatorGets === 2970; })());
const legsSum = (a, b, c) => journeyFeeCents(a, null, c) + journeyFeeCents(b, { leg1FareCents: a }, c);
for (const country of ['US', 'GB']) {
  check(`journey, ${country}: the two legs together always pay exactly the fee on the combined fare (every $1 pair to $200)`,
    (() => { for (let a = 500; a <= 20000; a += 100) for (let b = 500; b <= 20000; b += 100) { if (legsSum(a, b, country) !== platformFeeCents(a + b, country)) return false; } return true; })());
}

// ——— GOVERNMENT FEES: pass-through, and nothing else moves ————————————————————————————
// fees.js lines (an airport's per-pickup charge) are added to what the traveler pays and held
// for remittance. The operator's 99% and our take are computed as if the fee did not exist.
const MIA_FEE = { id: 'mia-tnc-pickup', name: 'Miami International Airport fee', payee: 'Miami-Dade Aviation Department', cents: 200, end: 'pickup' };
const plain = quote(2450);
const withFee = quote(2450, undefined, [MIA_FEE]);
check('with no fee the quote is unchanged: no government cents, no lines',
  plain.governmentFeeCents === 0 && plain.passThroughCents === 0 && Array.isArray(plain.feeLines) && plain.feeLines.length === 0 && plain.travelerPays === 2450 + 200);
check('a $2.00 airport fee adds $2.00 to what the traveler pays', withFee.travelerPays === 2450 + 200 + 200, withFee.travelerPays);
check('  and to nothing else: operatorGets, platformTake, commission and appFee are identical',
  withFee.operatorGets === plain.operatorGets && withFee.platformTake === plain.platformTake && withFee.commission === plain.commission && withFee.appFee === plain.appFee);
check('  it is carried as governmentFeeCents and passThroughCents', withFee.governmentFeeCents === 200 && withFee.passThroughCents === 200);
check('  with one line naming what it is and whom it is for',
  withFee.feeLines.length === 1 && withFee.feeLines[0].name === 'Miami International Airport fee' && withFee.feeLines[0].payee === 'Miami-Dade Aviation Department' && withFee.feeLines[0].cents === 200 && withFee.feeLines[0].id === 'mia-tnc-pickup', JSON.stringify(withFee.feeLines));
check('the split still adds up: traveler = operator + platform + pass-through',
  withFee.travelerPays === withFee.operatorGets + withFee.platformTake + withFee.passThroughCents);
const two = quote(1190, undefined, [MIA_FEE, { ...MIA_FEE, id: 'portmiami-tnc-pickup', name: 'PortMiami fee', payee: 'Miami-Dade Seaport Department' }]);
check('two fees are two lines and their sum', two.governmentFeeCents === 400 && two.feeLines.length === 2 && two.travelerPays === 1190 + 150 + 400);
const junk = quote(2450, undefined, [{ id: 'x', payee: 'X', cents: -200 }, { id: 'y', payee: 'Y', cents: 1.5 }, { id: 'z', cents: 200 }, null, 'two dollars', { id: 'ok', name: 'OK', payee: 'Z', cents: 100 }]);
check('a negative, a fraction, a line with no payee and non-objects are not fees', junk.governmentFeeCents === 100 && junk.feeLines.length === 1 && junk.feeLines[0].id === 'ok', JSON.stringify(junk.feeLines));
check('a non-array is no fee', quote(2450, undefined, 'MIA').governmentFeeCents === 0 && quote(2450, undefined, { cents: 200 }).governmentFeeCents === 0);
const journeyFee = quote(3000, { leg1FareCents: 4000 }, [MIA_FEE], 'GB');
check('on the second leg of a journey the fee rule and the government fee are both honoured',
  journeyFee.appFee === 195 && journeyFee.governmentFeeCents === 200 && journeyFee.travelerPays === 3000 + 195 + 200 && journeyFee.operatorGets === 2970);

const failed = results.filter((r) => !r.ok);
for (const r of results) console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.label}${r.ok ? '' : '  <-- ' + (r.detail || '')}`);
console.log(failed.length ? `\n${failed.length} FAILED of ${results.length}` : `\nall ${results.length} passed`);
assert.equal(failed.length, 0);
