// Reading an operator's documents.
//
// WHAT THIS REPLACES. `verifyDoc` in src/state/OperatorContext.tsx set a flag to 'checking',
// waited 900 milliseconds, and set it to 'ok'. Driver licence, vehicle registration, annual
// inspection and commercial insurance — every one of them approved by a countdown. Worse than
// it sounds: no image was ever captured, so there was nothing to approve. Five screens said
// "Test program — document review is simulated", which was honest and did not make it safe.
//
// WHERE AI IS ALLOWED TO DO THIS, WHICH IS THE PART THAT MATTERS.
//
// FCRA §603(d)(2)(A)(i) excludes from "consumer report" any report containing information
// SOLELY about transactions or experiences between the consumer and the report-maker. An
// operator hands US their own licence; we read it and decide about our own relationship with
// them. That is first-party, and it is not a consumer report.
//
// CFPB Circular 2024-06 draws the other edge of the same line: a "background dossier" or
// algorithmic score assembled from THIRD-PARTY sources and used for an employment decision IS
// a consumer report, and assembling one could make American Rider a consumer reporting agency
// in its own right. So this file must never do that, and does not:
//
//   IT READS   documents the operator gave us, and compares them with each other and with
//              what the operator told us.
//   IT NEVER   looks anything up about the person, scores them against a population, or
//              consults any source outside this conversation and our own records.
//
// The criminal and driving history stay with a licensed CRA (backend/screening.js) because the
// statute names them and the DPPA governs the driving record. This is the cheap half — the
// half that needs no vendor, and the half a $47.49 report was never going to check anyway.
const { readKey } = require('./env');

// MODEL CHOICE IS A COST DECISION AND THEREFORE THE FOUNDERS'. This reads an identity document
// and decides whether somebody may carry passengers, so it runs on the strongest model. At
// roughly a cent per document it is the cheapest thing in the onboarding by two orders of
// magnitude — the screening it sits beside is $47.49. If that ever changes, this is the line.
const MODEL = 'claude-opus-5';

/** What each document is, and what a valid one must show. */
const KINDS = {
  license: {
    title: 'Driver licence',
    wants: ['full name', 'licence number', 'expiry date', 'issuing state', 'date of birth'],
    // §627.748(12)(d): no valid driver licence is disqualifying, full stop.
    mustNotBeExpired: true,
  },
  registration: {
    title: 'Vehicle registration',
    wants: ['registered owner', 'plate number', 'vehicle make and model', 'year', 'expiry date'],
    mustNotBeExpired: true,
  },
  inspection: {
    title: 'Vehicle inspection',
    wants: ['vehicle identified', 'inspection date', 'result', 'expiry date'],
    mustNotBeExpired: true,
  },
  insurance: {
    title: 'Commercial insurance',
    // The declarations page, not the wallet card: the card shows a policy exists, the
    // declarations page shows what it covers. American Rider carries NO coverage behind the
    // operator, so the limits on this page are the only ones a traveler has.
    wants: [
      'named insured',
      'policy number',
      'policy period start and end',
      'whether it covers commercial, livery or for-hire use',
      'bodily injury and property damage limits',
      'the vehicle it applies to',
    ],
    mustNotBeExpired: true,
  },
};

const SCHEMA = {
  type: 'object',
  properties: {
    // What the document actually is, in the model's judgement — NOT what we asked for. An
    // operator who uploads their insurance card under "inspection" must be told, not passed.
    documentType: { type: 'string' },
    isTheRequestedDocument: { type: 'boolean' },
    legible: { type: 'boolean' },
    fields: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        number: { type: 'string' },
        expiry: { type: 'string' }, // YYYY-MM-DD, or '' when not shown
        state: { type: 'string' },
        vehicle: { type: 'string' },
        plate: { type: 'string' },
        commercialUse: { type: 'string' }, // 'yes' | 'no' | 'unclear' | ''
        limits: { type: 'string' },
      },
      required: ['name', 'number', 'expiry', 'state', 'vehicle', 'plate', 'commercialUse', 'limits'],
      additionalProperties: false,
    },
    concerns: { type: 'array', items: { type: 'string' } },
    summary: { type: 'string' },
  },
  required: ['documentType', 'isTheRequestedDocument', 'legible', 'fields', 'concerns', 'summary'],
  additionalProperties: false,
};

const SYSTEM = `You read documents an operator has submitted to American Rider, a Florida
transportation network company, so their vehicle and licence can be checked before they carry
passengers.

Report what the document SHOWS. Do not infer, complete or improve it.

- If a field is not visible, return "" for it. Never guess a value, a date or a number.
- If the image is blurred, cropped, glared or partly obscured, set legible false and say which
  part cannot be read.
- If the document is not the kind that was asked for, set isTheRequestedDocument false and name
  what it actually is.
- Dates as YYYY-MM-DD. If only a month and year are shown, use the last day of that month.
- "concerns" is for anything a person should look at: signs of alteration, a mismatch inside
  the document, a name that differs between fields, an expiry that has passed, a photocopy of a
  screen, handwriting on a printed form. One short sentence each. Empty when there are none.
- "summary" is one plain sentence stating what the document is and its expiry. No reassurance,
  no exclamation marks, no judgement of the person.

You are reading an image, not verifying it against any authority. You cannot confirm a document
is genuine — only that it is legible, internally consistent, and says what it appears to say.`;

/**
 * Read one document.
 *
 * @param kind      one of KINDS
 * @param imageUrl  where the operator's upload lives
 * @param expect    { name, vehicle, plate } — what WE already believe, for cross-checking.
 *                  All first-party: the operator told us these themselves.
 *
 * Returns { ok, verdict: 'accept'|'refuse'|'review', reasons[], fields, summary }.
 * Never throws.
 */
async function readDocument({ kind, imageUrl, expect = {}, now = Date.now() }) {
  const spec = KINDS[kind];
  if (!spec) return { ok: false, error: `unknown document kind: ${kind}` };
  const key = readKey('ANTHROPIC_API_KEY');
  // NO KEY MEANS NO REVIEW — and 'review' is the safe direction, because nobody drives on it.
  // It must never mean 'accept', which is what the 900ms timer effectively did.
  if (!key) {
    return {
      ok: true,
      verdict: 'review',
      reasons: ['Automatic document reading is not configured.'],
      fields: {},
      summary: 'Waiting for a person to check this.',
    };
  }

  let image;
  try {
    const res = await fetch(imageUrl);
    if (!res.ok) throw new Error(`could not fetch the upload (${res.status})`);
    const buf = Buffer.from(await res.arrayBuffer());
    // 5 MB is well inside the API's limit and far above a photograph of a licence.
    if (buf.length > 5 * 1024 * 1024) throw new Error('the image is too large to read');
    image = {
      media_type: res.headers.get('content-type')?.split(';')[0] || 'image/jpeg',
      data: buf.toString('base64'),
    };
  } catch (e) {
    return { ok: false, error: e.message };
  }

  let read;
  try {
    const AnthropicPkg = require('@anthropic-ai/sdk');
    const Anthropic = AnthropicPkg.default ?? AnthropicPkg;
    const client = new Anthropic({ apiKey: key });
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 2048,
      system: SYSTEM,
      output_config: { format: { type: 'json_schema', schema: SCHEMA } },
      messages: [
        {
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: image.media_type, data: image.data } },
            {
              type: 'text',
              text:
                `This should be a ${spec.title}. Read it and report:\n` +
                spec.wants.map((w) => `- ${w}`).join('\n'),
            },
          ],
        },
      ],
    });
    const text = (response.content.find((b) => b.type === 'text') || {}).text || '{}';
    read = JSON.parse(text);
  } catch (e) {
    return { ok: false, error: e.message };
  }

  return decide({ kind, spec, read, expect, now });
}

/**
 * Turn a reading into a verdict.
 *
 * THE RULES ARE HERE, NOT IN THE PROMPT. What disqualifies a document is a policy decision and
 * must be reviewable, testable and identical for everybody — so the model reports what it sees
 * and this function alone decides what that means. Changing the model cannot change the
 * standard.
 *
 * 'review' rather than 'refuse' wherever the answer is "we cannot tell". Nobody drives on a
 * review, so it is the safe direction, and a person deciding is better than a machine guessing.
 */
function decide({ kind, spec, read, expect, now }) {
  const reasons = [];
  const f = read.fields || {};

  if (!read.legible) reasons.push(`The ${spec.title.toLowerCase()} could not be read clearly.`);
  if (!read.isTheRequestedDocument) {
    reasons.push(
      `That does not look like a ${spec.title.toLowerCase()}` +
        (read.documentType ? ` — it appears to be a ${read.documentType}.` : '.'),
    );
  }

  // ---- Expiry. -----------------------------------------------------------------------------
  let expired = false;
  if (spec.mustNotBeExpired) {
    const end = Date.parse(`${f.expiry}T23:59:59`);
    if (!f.expiry || Number.isNaN(end)) {
      reasons.push('No expiry date could be read.');
    } else if (end < now) {
      expired = true;
      reasons.push(`Expired ${f.expiry}.`);
    }
  }

  // ---- Does it belong to the person who sent it? -------------------------------------------
  // A loose comparison on purpose: middle names, initials and suffixes differ legitimately
  // between a licence and an insurance schedule. A real mismatch is a person's job, not a
  // string comparison's.
  const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z ]/g, '').trim();
  const surname = (s) => norm(s).split(/\s+/).filter(Boolean).pop() || '';
  if (expect.name && f.name && surname(expect.name) && surname(expect.name) !== surname(f.name)) {
    reasons.push(`The name on the document (${f.name}) does not match the account (${expect.name}).`);
  }
  if (expect.plate && f.plate && norm(expect.plate).replace(/ /g, '') !== norm(f.plate).replace(/ /g, '')) {
    reasons.push(`The plate on the document (${f.plate}) is not the vehicle on file (${expect.plate}).`);
  }

  // ---- Insurance only: it must actually cover carrying people for money. -------------------
  //
  // CAUGHT BY THE TEST, and it was the dangerous direction. Only 'no' raised a reason, so a
  // policy whose cover could not be determined — 'unclear', or a field the reader could not
  // find — produced no reasons at all and was ACCEPTED. American Rider carries no coverage
  // behind the operator, so the limits on that page are the only ones a traveler has, and
  // "we could not tell" must never read as "yes".
  if (kind === 'insurance') {
    if (f.commercialUse === 'no') {
      reasons.push(
        'This policy appears to be for personal use. Carrying passengers for hire needs ' +
          'commercial, livery or for-hire cover.',
      );
    } else if (f.commercialUse !== 'yes') {
      reasons.push('Whether this policy covers carrying passengers for hire could not be read.');
    }
    if (!f.limits) reasons.push('The coverage limits could not be read.');
  }

  const concerns = Array.isArray(read.concerns) ? read.concerns : [];

  // Expired, wrong document, or personal-use insurance are refusals: each is a fact the
  // document itself states. Everything else a person looks at.
  const hardFail =
    expired ||
    read.isTheRequestedDocument === false ||
    (kind === 'insurance' && f.commercialUse === 'no');

  const verdict = hardFail ? 'refuse' : reasons.length || concerns.length ? 'review' : 'accept';

  return {
    ok: true,
    verdict,
    reasons: [...reasons, ...concerns],
    fields: f,
    summary: String(read.summary || '').slice(0, 300),
    expiry: f.expiry || null,
  };
}

/** Is document reading available? /health and /ops report it. */
const documentsReady = () => !!readKey('ANTHROPIC_API_KEY');

module.exports = { readDocument, decide, KINDS, documentsReady, MODEL };
