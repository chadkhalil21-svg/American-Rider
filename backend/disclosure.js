// The §627.748(8)(a) insurance disclosure, and the record that it was made.
const { readKey } = require('./env');
//
// WHAT THE STATUTE REQUIRES, exactly. "Before a TNC driver is allowed to accept a request for
// a prearranged ride on the digital network, the TNC must disclose in writing to the TNC
// driver: 1. The insurance coverage, including the types of coverage and the limits for each
// coverage, which the TNC provides while the TNC driver uses a TNC vehicle in connection with
// the TNC's digital network. 2. That the TNC driver's own automobile insurance policy might
// not provide any coverage while the TNC driver is logged on to the digital network or is
// engaged in a prearranged ride, depending on the terms of the TNC driver's own automobile
// insurance policy."
//
// TWO THINGS FOLLOW FROM THAT WORDING, and both shape this file.
//
// "BEFORE ... IS ALLOWED TO ACCEPT" makes it a GATE, not a page. A disclosure sitting in a
// help section that an operator never opened has not been made. So acknowledgement is a
// precondition of going on duty, checked in the same place the screening gate is checked.
//
// "IN WRITING" makes it a RECORD. The text an operator agreed to, and the moment they agreed,
// have to survive — including after this file is edited. So the version string below is
// stamped onto the acknowledgement: if the disclosure changes, everyone who agreed to the old
// one is out of date and is asked again, rather than being silently treated as having agreed
// to words they never saw.
//
// American Rider still requires each Operator to carry qualifying coverage. Separately, the
// platform must not represent its own statutory contingency layer as nonexistent. Production
// readiness therefore requires the bound policy's disclosure text from deployment config.

// Bump this whenever the TEXT below changes in substance. Formatting fixes do not count;
// anything that changes what an operator is agreeing to does.
// 2026-09-18.1 — "while driving for a transportation network company" became "while you
// operate for a transportation network company" in all five languages (Chad, 18 Sept 2026:
// operator, never driver). The term of art "transportation network company" is KEPT: it is the
// statute's own phrase and the one an operator's insurer will recognise, and an operator who
// asks a differently-worded question can be given a differently-worded answer.
//
// This bump is not free and is made deliberately now: every operator who acknowledged
// 2026-08-29.1 is asked to read and acknowledge again before going on duty. Today that is a
// handful of test accounts; after the operator program opens on 28 Sept it would be everyone.
const DISCLOSURE_VERSION = '2026-09-25.1';
const TNC_COVERAGE_TEXT = String(readKey('TNC_INSURANCE_DISCLOSURE') || '').trim();

/**
 * The disclosure itself. Served from here rather than written into the app so that the words
 * an operator agreed to and the words we can produce later are the same words.
 */
const DISCLOSURE = {
  version: DISCLOSURE_VERSION,
  statute: 'Fla. Stat. §627.748(8)(a)',
  title: 'Insurance Disclosure',
  // (8)(a)1 — the coverage the TNC provides, with types and limits.
  provided: {
    heading: 'What American Rider provides',
    body: TNC_COVERAGE_TEXT ||
      'American Rider production operations are not enabled until the platform contingency insurance is bound and its coverage types and limits are stated here.',
  },
  // (8)(a)2 — that the driver's own policy might not cover them.
  // (8)(a)2 — that the driver's own policy might not cover them.
  //
  // TWO VERSIONS, AND CHAD IS THE REASON (28 Aug 2026). He read the first one and called it
  // nonsensical: American Rider requires commercial cover and verifies it, so telling an
  // operator their policy might not cover them reads as either a mistake or an insult.
  //
  // He was right about the effect and wrong about the cause. The sentence is about a PERSONAL
  // policy — the one most operators arrive holding, and which excludes carrying passengers for
  // payment. It is the reason they must go and buy commercial cover, so it earns its place.
  // But an operator who has ALREADY uploaded a commercial policy has answered it, and reading
  // a heading that says otherwise is being told something untrue about themselves.
  //
  // So the heading and the framing follow what we have verified about them, and the statutory
  // sentence survives in both. §627.748(8)(a)2 is satisfied either way — it requires the fact
  // to be disclosed, not the operator to be addressed as though they had not acted on it.
  ownPolicy: {
    heading: 'Your own policy might not cover you',
    body:
      'Your personal automobile insurance policy might not provide any coverage while you are ' +
      'logged on to the network or carrying a traveler, depending on its terms. Most personal ' +
      'policies exclude carrying passengers for payment. Read your policy, or ask your insurer ' +
      'directly whether it covers you while you operate for a transportation network company.',
  },
  /** Shown instead of `ownPolicy` once a commercial policy has been verified. */
  ownPolicyVerified: {
    heading: 'The policy you have provided',
    body:
      'American Rider has verified a commercial policy in your name and tracks its expiry. ' +
      'The statutory warning still applies to any PERSONAL automobile policy you hold: a ' +
      'personal policy might not provide any coverage while you are logged on or carrying a ' +
      'traveler, and most exclude carrying passengers for payment. Your commercial policy is ' +
      'what covers you here, and travel is not assigned once it lapses.',
  },
  // Not required by (8)(a), and stated because an operator reading the two paragraphs above
  // will immediately and reasonably ask "then what am I supposed to have?".
  required: {
    heading: 'What you must carry',
    body:
      'Florida requires the coverage in §627.748(7) to be in force whenever you are logged on. ' +
      'American Rider requires you to maintain qualifying commercial, for-hire or livery coverage in your own name. American Rider verifies that policy and its ' +
      'expiry date, and will not assign travel to an operator whose coverage has lapsed.',
  },
  acknowledgement:
    'I have read this disclosure, including the coverage American Rider provides and the warning that ' +
    'my own policy might not cover me while I am logged on or carrying a traveler.',
};

/**
 * The disclosure as THIS operator should read it.
 *
 * @param insuranceVerified whether a commercial policy has been verified for them
 */
function disclosureFor(insuranceVerified) {
  const { ownPolicyVerified, ...rest } = DISCLOSURE;
  return insuranceVerified
    ? { ...rest, ownPolicy: ownPolicyVerified }
    : rest;
}

/** Has this operator acknowledged the CURRENT disclosure? */
function disclosureCurrent(ack) {
  return !!ack && ack.version === DISCLOSURE_VERSION && !!ack.at;
}

/** Why they cannot go on duty, in words an operator can act on. */
function disclosureReason(ack) {
  if (!ack) return 'Read and acknowledge the insurance disclosure before accepting travel.';
  if (ack.version !== DISCLOSURE_VERSION) {
    return 'The insurance disclosure has changed. Read the current one before accepting travel.';
  }
  return 'Your acknowledgement of the insurance disclosure is incomplete.';
}

module.exports = {
  DISCLOSURE, DISCLOSURE_VERSION, disclosureFor, disclosureCurrent, disclosureReason,
};
