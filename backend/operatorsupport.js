// American Rider — Operator Support resolution (powered by Claude).
//
// THE HOLE THIS FILLS. Patron Support has resolved travelers' problems with an AI since
// 16 August: it reads the complaint, answers it, refunds up to $45 against the real
// PaymentIntent, and hands anything it should not decide to a person. An OPERATOR had no path
// at all. Not a worse path — none. A traveler who never appeared, a fare that looks wrong, a
// passenger who behaved badly: there was nowhere in the operator's app to say so, and no
// endpoint that would have listened if there had been.
//
// That is the wrong way round for this company. The operator is the supply side of a platform
// whose entire proposition is that operators are treated better here than elsewhere, and the
// one thing we had not built for them was the ability to ask for help.
//
// WHAT IS DIFFERENT FROM THE TRAVELER'S SIDE, and it is not cosmetic:
//
//   a traveler's remedy is a REFUND   — money goes back to the card that paid
//   an operator's remedy is a PAYMENT — money goes out to them, and it is ours, not the
//                                       traveler's; we never claw back a completed fare from
//                                       a traveler to satisfy an operator's complaint
//
// So the two resolvers share their shape and nothing else. A single prompt trying to serve
// both would have to hold two opposite ideas of who is owed what, which is how a model ends
// up refunding the wrong party.
const { mustReachHuman, LANGUAGES, langOf } = require('./support');

const MODEL = 'claude-sonnet-5';

// The most the AI may pay an operator without a person. Set to cover the whole of a typical
// travel being made good — a no-show, a cancelled travel already driven to, a fare correction
// — at the fare model as it stands, where a typical travel is $5 to $25. Anything larger is
// not a routine remedy, it is a dispute, and a dispute is a person's job.
const MAX_AUTO_PAYMENT_CENTS = 4500;

function systemPrompt(travel, language) {
  return `You are Operator Support for American Rider, a transportation company.

LANGUAGE. Write the "message" in ${LANGUAGES[langOf(language)]}: that is the language the
operator reads. The "reason" is for our records and may be in English.

You are speaking to an OPERATOR — a self-employed driver who carries travelers on this
platform. You are not speaking to a traveler. Your job is to settle what you fairly can from
the record, and to hand anything else to a person.

THE TRAVEL IN QUESTION — these are the real recorded figures. Never contradict them and never
invent any number that is not here:
${JSON.stringify(travel, null, 2)}

WHAT THE OPERATOR IS OWED, so you never misstate it:
- The operator retains 99% of the travel fare. American Rider retains a 1% coordination
  commission plus a platform fee the traveler pays on top.
- Tolls and airport or seaport fees are never taken from the operator's share.
- NEVER QUOTE A FEE FORMULA and never describe how the platform fee is calculated. Give
  amounts from the recorded figures above, or say the figure is not in the record.

VOICE. American Rider is institutional, authoritative and sophisticated. Plain English,
precisely used. Do not apologise repeatedly, no exclamation marks, no emoji, do not
editorialise. Be brief; three sentences is usually enough. An operator is at work, often at
the kerb, and wants the answer.

WHAT YOU MAY DECIDE:
- "explain" — answer the question or correct a misunderstanding. No money moves.
- "pay" — the record supports making the operator good: a traveler who did not appear after
  the operator waited, a travel cancelled after the operator had driven to the pickup, an
  underpayment visible in the figures above. Give the amount in cents and a one-line reason.
- "escalate" — anything you cannot settle from the recorded facts alone.

THE MONEY YOU PAY IS OURS, NOT THE TRAVELER'S. You are never taking a completed fare back
from a traveler to satisfy this complaint. If the right remedy would require charging or
debiting a traveler, that is not yours to decide — escalate it.

YOU MUST ESCALATE, without exception, if the message involves: an accident or injury; any
safety concern or conduct complaint about ANY person, traveler or operator; a legal threat;
discrimination; a deactivation, screening or insurance decision; a dispute about facts you
cannot verify from the record above; or a request for more than
$${(MAX_AUTO_PAYMENT_CENTS / 100).toFixed(2)}. When you escalate, say so honestly and do not
promise a timeframe.

Never invent policy. Never promise anything not stated here. If you are unsure, escalate — an
operator passed to a person loses nothing, an operator given a wrong answer stops driving.`;
}

const TOOL = {
  name: 'resolve',
  description: 'Record the decision for this operator support case.',
  input_schema: {
    type: 'object',
    properties: {
      action: { type: 'string', enum: ['explain', 'pay', 'escalate'] },
      message: { type: 'string', description: 'What the operator reads. Plain, brief, institutional.' },
      pay_cents: { type: 'integer', description: 'Only for action=pay. Whole cents.' },
      reason: { type: 'string', description: 'One line for our records — why this decision.' },
    },
    required: ['action', 'message', 'reason'],
  },
};

/** Escalate, in the shape the caller expects, without asking a model anything. */
const forcedEscalation = (reason) => ({ action: 'escalate', message: null, reason, forced: true });

/**
 * Decide what happens to an operator's case.
 *
 * ALWAYS RESOLVES. A thrown model error becomes an escalation, because the one outcome that
 * must never happen is an operator being told nothing — exactly as on the traveler's side.
 */
async function resolveOperatorIssue({ description, travel, language }) {
  const text = String(description || '');
  if (!text.trim()) return forcedEscalation('Empty description.');

  // BEFORE THE MODEL RUNS. The same list that guards the traveler's side, for the same reason:
  // a safety report must never depend on a model's judgement. An operator reporting a
  // passenger's conduct is reporting on a person, and that is a person's job to read.
  // mustReachHuman(), not the English list alone: it carries the Spanish, French, Italian and
  // German patterns too. An operator writing "me empujó" must reach a person exactly as one
  // writing "he pushed me" does.
  if (mustReachHuman(text)) {
    return forcedEscalation("Matched an always-human category in the operator's own words.");
  }

  let out;
  try {
    const Anthropic = require('@anthropic-ai/sdk');
    const { readKey } = require('./env');
    const key = readKey('ANTHROPIC_API_KEY');
    if (!key) return forcedEscalation('No ANTHROPIC_API_KEY configured.');
    const client = new Anthropic({ apiKey: key });
    const res = await client.messages.create({
      model: MODEL,
      max_tokens: 700,
      system: systemPrompt(travel || {}, language),
      messages: [{ role: 'user', content: text.slice(0, 4000) }],
      tools: [TOOL],
      tool_choice: { type: 'tool', name: 'resolve' },
    });
    const use = (res.content || []).find((c) => c.type === 'tool_use');
    if (!use) return forcedEscalation('Model returned no decision.');
    out = use.input;
  } catch (e) {
    return forcedEscalation(`resolver failed: ${e && e.message ? e.message : e}`);
  }

  // AND AFTER IT ANSWERS. A persuasive message must not be able to route a safety matter away
  // from a person by the model's own wording either.
  if (mustReachHuman(String(out.message || ''))) {
    return { action: 'escalate', message: out.message, reason: 'Output matched an always-human category.', forced: true };
  }

  if (out.action === 'pay') {
    const cents = Number(out.pay_cents);
    if (!Number.isInteger(cents) || cents <= 0) {
      return { action: 'escalate', message: out.message, reason: 'Payment approved with no usable amount.', forced: true };
    }
    if (cents > MAX_AUTO_PAYMENT_CENTS) {
      return { action: 'escalate', message: out.message, reason: `Payment of ${cents}c exceeds the automatic limit.`, forced: true };
    }
    return { action: 'pay', message: out.message, pay_cents: cents, reason: out.reason };
  }

  if (out.action !== 'explain' && out.action !== 'escalate') {
    return { action: 'escalate', message: out.message, reason: `Unrecognised action: ${out.action}`, forced: true };
  }
  return { action: out.action, message: out.message, reason: out.reason };
}

module.exports = { resolveOperatorIssue, MAX_AUTO_PAYMENT_CENTS, MODEL };
