// American Rider — AI trip assistant (powered by Claude / Anthropic).
//
// Turns a plain-English request ("get me to the airport by 6, two of us, one has a wheelchair")
// into a structured trip plan the app can act on, plus a short friendly reply.
//
// The Anthropic API key is read from the environment (ANTHROPIC_API_KEY) and lives ONLY on the
// server — the app never holds it, exactly the same rule as the Stripe secret key.

const AnthropicPkg = require('@anthropic-ai/sdk');
const { readKey, hasInvalidHeaderChars } = require('./env');
const Anthropic = AnthropicPkg.default ?? AnthropicPkg; // works whether the export is default or named

// Create the Claude client lazily, so the server still boots before a key is configured.
let _client = null;
function getClient() {
  if (!_client) {
    const key = readKey('ANTHROPIC_API_KEY');
    if (!key) throw new Error('ANTHROPIC_API_KEY is not set — add it to backend/.env');
    _client = new Anthropic({ apiKey: key });
  }
  return _client;
}

// The AI model. This assistant runs on every message, and its job (reading a trip request and
// picking a destination/time/passengers) is simple, so we use Haiku — Anthropic's fastest and
// cheapest model — to stretch usage credits as far as possible. If you ever want more power,
// swap this one word to 'claude-sonnet-5' (a step up) or 'claude-opus-5' (the flagship).
const MODEL = 'claude-haiku-4-5';

// The destinations the app can actually book — the assistant maps free text to one of these
// EXACT names. Mirrors src/data.ts (PLACES + HOME_PLACE); keep the two in sync.
// CORRECTED 25 Aug 2026. This said 'Miami Airport' and 'Port of Miami' — names src/data.ts
// stopped using on 15 Aug. The model dutifully returned 'Miami Airport', the app looked it up
// in PLACES, found nothing, and told the traveler "American Rider does not serve that
// destination yet" — about the airport, the most-booked place in the market.
//
// AND IT WAS ALSO TOO SHORT. It listed six destinations while src/data.ts books twenty-five,
// so "take me to Coconut Grove" — a place the app prices, maps and dispatches to — came back
// as "American Rider does not serve that destination yet". The assistant was quietly the
// narrowest way into the product.
//
// KEEP THESE EXACTLY EQUAL TO `short` IN src/data.ts PLACES, plus 'Home'. There is no shared
// source between a TypeScript app and a JavaScript server, so the only defence is the test in
// backend/assistant.test.js, which fails if they ever drift again.
const DESTINATIONS = [
  'Miami International Airport',
  'Wynwood',
  'South Beach',
  'Coral Gables',
  'PortMiami',
  'Kaseya Center',
  'Kendall',
  'Doral',
  'Coconut Grove',
  'Key Biscayne',
  'Little Havana',
  'Design District',
  'Midtown Miami',
  'Bayside',
  'University of Miami',
  'Virginia Key',
  'Convention Center',
  'Hialeah',
  'Bal Harbour',
  'North Miami Beach',
  'Sunny Isles',
  'Aventura',
  'Hard Rock Stadium',
  'Homestead',
  'Fort Lauderdale Airport',
  'Home',
];

// THE VOICE, REWRITTEN 25 Aug 2026 against the rubric in AGENTS.md.
//
// It used to ask for "warm", "friendly", "genuinely helpful" and to "say that warmly", and it
// produced exactly what those words ask for: "Perfect! We'll get you and your travel companion
// to Miami Airport by 6. Ready to book?" That fails the rubric three times over — it
// editorialises ("Perfect!"), it carries an exclamation mark, and it chats ("Ready to book?").
//
// The screen already states the reading as a record. The model's sentence sits under it and
// its whole job is to name anything the rows cannot show — a missing detail, a second stop, a
// place we do not serve. Where the rows say everything, one plain line is enough.
const SYSTEM = `You are American Rider's travel assistant.
American Rider is a Miami transportation company where operators keep 99% of every fare.

The traveler describes a trip in plain English. Pull out the details and map the destination to
EXACTLY ONE of these known places (or leave it empty if none clearly match):
${DESTINATIONS.map((d) => `- ${d}`).join('\n')}

VOICE. This is an institutional service, and the reply is read beneath a record of what was
understood. Write plain English, precisely used:
- One sentence. Two only if the second is genuinely needed.
- NO exclamation marks. NO emoji. No markdown.
- Never open with a judgement of the request — not "Perfect", "Great", "Got it", "Sure".
- Never ask "Ready to book?" or similar. The traveler decides; the screen has the control.
- Do not repeat what the rows already show unless naming a problem with it.
- Never reassure. State the fact and stop.
Good: "Two passengers to Miami International Airport, arriving by 6:00 AM."
Good: "American Rider does not serve Fort Lauderdale."
Bad:  "Perfect! We'll get you there by 6. Ready to book?"

Rules:
- "destination" MUST be one of the known places above, spelled exactly, or "" if the request
  doesn't clearly match one — in that case ask a short clarifying question in "reply".
- If the traveler just wants to go home ("take me home", "get me home", "back home"), set
  destination to "Home" — that is their saved home address, so do NOT ask where home is.
- "when" is a short human phrase like "now", "6:00 AM", "tomorrow at 6 PM", or "" if not stated.
- "passengers" is the number of riders (default 1 if not stated).
- "prefs" is a short list of comfort needs mentioned (e.g. "wheelchair", "quiet", "bags",
  "charger", "pet") — otherwise an empty list.
- MULTIPLE STOPS: American Rider books one travel at a time. If the traveler asks for several
  stops ("Publix first, then..."), say so plainly and set "destination" to the FIRST stop if it
  matches a known place, otherwise "" and tell them each leg is booked from the search screen.
- If the request names a real Miami place that is not in the known list, don't pretend it's
  unbookable — tell them to type it into the search on the home screen, which can find any
  Miami address.
- Never invent a destination the traveler didn't ask for.`;

// A strict shape for the model's answer, so the app always gets clean, predictable JSON.
const SCHEMA = {
  type: 'object',
  properties: {
    reply: { type: 'string' },
    destination: { type: 'string' },
    when: { type: 'string' },
    passengers: { type: 'integer' },
    prefs: { type: 'array', items: { type: 'string' } },
  },
  required: ['reply', 'destination', 'when', 'passengers', 'prefs'],
  additionalProperties: false,
};

// Plan a trip from a free-text message. Returns { reply, destination, when, passengers, prefs }.
async function planTrip({ message }) {
  const client = getClient();
  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 2048,
    system: SYSTEM,
    output_config: {
      // Force the answer into our exact JSON shape (destination, when, passengers, prefs).
      format: { type: 'json_schema', schema: SCHEMA },
    },
    messages: [{ role: 'user', content: message }],
  });
  // With output_config.format the first text block is valid JSON matching SCHEMA.
  const textBlock = response.content.find((b) => b.type === 'text');
  const plan = JSON.parse(textBlock ? textBlock.text : '{}');
  // Only keep a destination the app can actually book.
  if (!DESTINATIONS.includes(plan.destination)) plan.destination = '';
  if (typeof plan.reply !== 'string') plan.reply = "Sorry, I didn't catch that — where would you like to go?";
  if (!Array.isArray(plan.prefs)) plan.prefs = [];
  if (typeof plan.passengers !== 'number') plan.passengers = 1;
  if (typeof plan.when !== 'string') plan.when = '';
  return plan;
}

module.exports = { planTrip, DESTINATIONS };
