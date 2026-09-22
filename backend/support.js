// American Rider — Patron Support resolution (powered by Claude).
//
// WHAT THIS REPLACES: `escalate` used to be `setIssueState('escalated')` — one line that
// flipped a variable in the app's memory. The screen then told the traveler "A specialist
// is responding · You will be contacted shortly · typically under five minutes" while no
// message was sent, no ticket was created and no person was notified. Someone overcharged
// at midnight was told help was coming and waited for a specialist who never knew they
// existed. That is the most serious defect this app has had.
//
// THE SHAPE (founders, 16 Aug): an AI handles the majority; anything else reaches a human.
//
// THE SAFETY RULE THAT MATTERS: the model NEVER enforces its own limits. It proposes; this
// file decides. A credit cap written into a prompt is a suggestion — a credit cap written
// in code is a cap. Everything below that could cost money or touch a person's safety is
// bounded here, not there.
const AnthropicPkg = require('@anthropic-ai/sdk');
const { readKey } = require('./env');
const Anthropic = AnthropicPkg.default ?? AnthropicPkg;

let _client = null;
function getClient() {
  if (!_client) {
    const key = readKey('ANTHROPIC_API_KEY');
    if (!key) throw new Error('ANTHROPIC_API_KEY is not set — add it to backend/.env');
    _client = new Anthropic({ apiKey: key });
  }
  return _client;
}

// Sonnet, not Haiku. The trip assistant maps a sentence to a destination; this one reads a
// complaint about money from someone already unhappy and decides whether to pay them. The
// cost difference is pennies per ticket and the failure mode is a wrong refund or a missed
// safety report.
const MODEL = 'claude-sonnet-5';

// The most the AI may credit without a human. Chosen so it covers the whole of a typical
// travel — the common honest complaints (wrong route, long wait, a fare that looks wrong) are
// fully resolvable — while anything larger is a person's decision.
const MAX_AUTO_CREDIT_CENTS = 4500;

// AND THE MOST OF IT THAT MAY COME OUT OF OUR OWN POCKET (20 Sept 2026, after Adrian asked
// whether we are protected on refunds — we were not, fully).
//
// THE TWO ARE DIFFERENT QUANTITIES AND THAT IS THE POINT. The cap above measures what a
// traveler might reasonably be owed. This one measures what the company can absorb, and they
// diverge because THE OPERATOR HAS ALREADY BEEN PAID: 99% of the fare leaves at completion and
// a refund does not reverse it. On a $9.03 travel we retain about $1.58, so refunding the
// whole thing costs us about $7.45 — money paid out once and now paid again.
//
// $25 is deliberately generous against a fare model where a typical travel is $5 to $25: the
// AI can still make a whole ordinary travel right on its own, which is the point of having it.
// What it can no longer do is hand back an amount whose true cost nobody measured. Beyond this
// the case reaches a person — who may well still refund it, with their eyes open.
const MAX_OUT_OF_POCKET_CENTS = 2500;

// Categories a model must never close, whatever it concludes. These are matched against the
// traveler's own words BEFORE the model runs and AFTER it answers, so neither a confused
// model nor a persuasive message can route them away from a human.
// FALSE POSITIVES ARE FINE HERE AND FALSE NEGATIVES ARE NOT. This list exists so that a
// safety report never depends on a model's judgement; a bumpy ride sent to a person costs a
// minute of someone's time, and an assault sent to a model costs something that cannot be
// got back. Widen it freely; narrow it only with a reason.
//
// WIDENED 16 Aug 2026: "he grabbed my arm" matched none of these. Physical contact was
// covered by `grope` and `touch` and nothing else, so the plainest words a shaken person
// actually uses — grabbed, pushed, shoved, hit — fell through to the model.
const ALWAYS_HUMAN = [
  /\b(accident|crash|collided|injur|hurt|hospital|ambulance|911)\b/i,
  /\b(assault|attack|threat|harass|abuse|grope|touch|unsafe|scared|frightened|follow(ed|ing) me)\b/i,
  // Physical contact, in the words people reach for first.
  /\b(grab|grabb|shov|push|pushed|hit|punch|slapp|spat|spit|bruis|choke|strangl)\w*\b/i,
  // Sexual conduct and exposure.
  /\b(sexual|indecent|expos(ed|ing)|undress|proposition|came on to me|inappropriate)\b/i,
  /\b(weapon|gun|knife|drunk|intoxicated|drug)\b/i,
  /\b(police|lawyer|attorney|sue|lawsuit|legal action|court)\b/i,
  /\b(discriminat|racist|racial|sexist|homophob|slur)\b/i,
  /\b(kidnap|abduct|held against|would not let me out|wouldn't let me out|locked the door)\b/i,
  // A minor in the car changes who must handle it, whatever the complaint is about.
  /\b(my (child|daughter|son)|a minor|underage)\b/i,
];

// The same matters in the other four languages the app speaks. A Spanish traveler writing
// "hubo un accidente" must reach a person exactly as an English one writing "accident" does;
// until 15 Sept 2026 only English words forced it.
const ALWAYS_HUMAN_INTL = [
  /\b(accidente|choque|herid[oa]s?|hospital|ambulancia|agresi[oó]n|agredi|acos[oa]|arma|pistola|cuchillo|borrach[oa]|ebri[oa]|drogas?|polic[ií]a|abogad[oa]|denuncia|secuestr)\w*/i,
  /\b(bless[ée]e?s?|h[ôo]pital|agress|harc[eè]l|arme|couteau|ivre|drogu[eé]|police|avocat|plainte|enl[eè]v|kidnapp)\w*/i,
  /\b(incidente|ferit[oa]|ospedale|ambulanza|aggressione|aggredit|molest|arma|pistola|coltello|ubriac[oa]|droga|polizia|avvocat[oa]|denuncia|rapi[tm])\w*/i,
  /\b(unfall|verletz|krankenhaus|krankenwagen|angriff|angegriffen|bel[äa]stig|waffe|messer|betrunken|drogen?|polizei|anwalt|anw[äa]ltin|anzeige|entf[üu]hr)\w*/i,
];

function mustReachHuman(text) {
  const s = text || '';
  return ALWAYS_HUMAN.some((re) => re.test(s)) || ALWAYS_HUMAN_INTL.some((re) => re.test(s));
}

// The five languages the app speaks, and what the traveler reads from this server in each.
// Until 15 Sept 2026 every server message was English inside a Spanish, French, Italian or
// German screen. The model is told to write in the traveler's language; these fixed lines are
// written here, once, and fall back to English for any other code.
const LANGUAGES = { en: 'English', es: 'Spanish', fr: 'French', it: 'Italian', de: 'German' };
const langOf = (code) => (LANGUAGES[String(code || '').toLowerCase()] ? String(code).toLowerCase() : 'en');
const SUPPORT_MESSAGES = {
  forced: {
    en: 'This is going to a member of our team rather than being handled automatically. Everything you have written travels with your case.',
    es: 'Esto pasa a un miembro de nuestro equipo en lugar de resolverse automáticamente. Todo lo que ha escrito acompaña a su caso.',
    fr: 'Ceci est transmis à un membre de notre équipe plutôt que traité automatiquement. Tout ce que vous avez écrit accompagne votre dossier.',
    it: 'Questo passa a un membro del nostro team anziché essere gestito automaticamente. Tutto ciò che ha scritto accompagna il suo caso.',
    de: 'Dies geht an ein Mitglied unseres Teams, statt automatisch bearbeitet zu werden. Alles, was Sie geschrieben haben, begleitet Ihren Fall.',
  },
  // What happens next, and where: a person, and the account's own address. "A member of our
  // team has your case. You will be contacted by email." named nobody's address and read as a
  // ticketing system's auto-reply (Chad, 16 Sept 2026).
  // The sender named too (Adrian, 16 Sept 2026: MAIL_FROM is support@americanrider.app), so the
  // traveler knows what to look for in their inbox. The address is read from the server's own
  // MAIL_FROM, never typed here: a screen that names a sender the server does not use is untrue.
  filed: {
    en: 'A person reads your case and replies from %{from} to %{email}.',
    es: 'Una persona lee su caso y responde desde %{from} a %{email}.',
    fr: 'Une personne lit votre dossier et répond depuis %{from} à %{email}.',
    it: 'Una persona legge il suo caso e risponde da %{from} a %{email}.',
    de: 'Eine Person liest Ihren Fall und antwortet von %{from} an %{email}.',
  },
  // A server with no MAIL_FROM configured names no sender.
  filedNoFrom: {
    en: 'A person reads your case and replies by email to %{email}.',
    es: 'Una persona lee su caso y responde por correo electrónico a %{email}.',
    fr: 'Une personne lit votre dossier et répond par e-mail à %{email}.',
    it: 'Una persona legge il suo caso e risponde per e-mail a %{email}.',
    de: 'Eine Person liest Ihren Fall und antwortet per E-Mail an %{email}.',
  },
  // The same when the account has no email address on it (phone-only sign-in).
  filedNoEmail: {
    en: 'A person reads your case and replies by email.',
    es: 'Una persona lee su caso y responde por correo electrónico.',
    fr: 'Une personne lit votre dossier et répond par e-mail.',
    it: 'Una persona legge il suo caso e risponde per e-mail.',
    de: 'Eine Person liest Ihren Fall und antwortet per E-Mail.',
  },
  notFiled: {
    en: 'We could not open your case automatically. Email support@americanrider.app and quote your travel number.',
    es: 'No pudimos abrir su caso automáticamente. Escriba a support@americanrider.app indicando su número de viaje.',
    fr: 'Nous n’avons pas pu ouvrir votre dossier automatiquement. Écrivez à support@americanrider.app en indiquant votre numéro de trajet.',
    it: 'Non è stato possibile aprire il suo caso automaticamente. Scriva a support@americanrider.app indicando il numero del viaggio.',
    de: 'Ihr Fall konnte nicht automatisch angelegt werden. Schreiben Sie an support@americanrider.app und nennen Sie Ihre Fahrtnummer.',
  },
};
/** The address the server sends from — the bare address inside MAIL_FROM ("Name <addr>" or "addr"), or ''. */
function replySender() {
  const raw = String(readKey('MAIL_FROM') || '').trim();
  const m = raw.match(/<([^>]+)>/);
  const addr = (m ? m[1] : raw).trim();
  return /^[^\s@]+@[^\s@]+$/.test(addr) ? addr : '';
}

function supportMessage(kind, language, vars = {}) {
  const email = typeof vars.email === 'string' ? vars.email.trim() : '';
  const from = typeof vars.from === 'string' ? vars.from.trim() : '';
  const which = kind !== 'filed' ? kind : !email ? 'filedNoEmail' : !from ? 'filedNoFrom' : 'filed';
  const table = SUPPORT_MESSAGES[which] || SUPPORT_MESSAGES.forced;
  const text = table[langOf(language)] || table.en;
  return text.replace(/%\{email\}/g, email).replace(/%\{from\}/g, from);
}

function systemPrompt(trip, language, category) {
  return `You are Patron Support for American Rider, a transportation company.

LANGUAGE. Write the "message" in ${LANGUAGES[langOf(language)]}: that is the language the
traveler reads. The "reason" is for our records and may be in English.
${category ? `FILED UNDER: ${category} — the matter the traveler chose on the screen.` : ''}

You are speaking to a traveler about a completed or in-progress travel. Your job is to
resolve their issue where you fairly can, and to hand it to a person where you cannot.

THE TRAVEL IN QUESTION — these are the real recorded figures. Never contradict them and
never invent any number that is not here:
${JSON.stringify(trip, null, 2)}

HOW AMERICAN RIDER'S PRICING WORKS, so you never misstate it:
- The traveler pays ONE all-in amount, quoted before reserving. It does not change with
  demand or time of day. It is never itemised and nothing is added on top of it.
- The operator retains 99% of the travel fare. American Rider retains a 1% coordination
  commission plus a platform fee, which also covers payment processing.
- If a traveler asks why 99% of what they paid is not what the operator received: the 99%
  applies to the TRAVEL FARE, not to the total including the platform fee. Say so plainly.
- NEVER QUOTE A FEE FORMULA. Do not say "$1.50", do not say a percentage of the fare, do not
  describe how the platform fee is worked out. Two different schedules exist depending on the
  card used, so any formula you state is wrong for half the people who read it — and the
  traveler is shown one total travel cost, never a breakdown. If asked what the fee is, give
  the amount from the recorded figures above if it is there, and otherwise say it is included
  in the total they were quoted.

VOICE. American Rider is institutional, authoritative and sophisticated. Write plain
English, precisely used. Do not apologise repeatedly, do not use exclamation marks or
emoji, do not editorialise ("Great question", "No worries"), and do not reassure the
traveler that a price is trustworthy — state the facts and let them carry themselves.
Be brief. Three sentences is usually enough.

WHAT YOU MAY DECIDE:
- "explain" — answer the question or correct a misunderstanding. No money moves.
- "credit" — the traveler was demonstrably charged for something they did not receive, or
  the recorded facts support a refund. Give the amount in cents and a one-line reason.
- "escalate" — anything you cannot settle from the recorded facts alone.

YOU MUST ESCALATE, without exception, if the message involves: an accident or injury; any
safety concern or conduct complaint about a person; a legal threat; discrimination; a
dispute about facts you cannot verify from the record above; or a request for more than
$${(MAX_AUTO_CREDIT_CENTS / 100).toFixed(2)}. When you escalate, say so honestly and do not
promise a timeframe.

Never invent policy. Never promise anything not stated here. If you are unsure, escalate —
a traveler passed to a person loses nothing, a traveler given a wrong answer loses trust.`;
}

const TOOL = {
  name: 'resolve',
  description: 'Record the decision for this support case.',
  input_schema: {
    type: 'object',
    properties: {
      action: { type: 'string', enum: ['explain', 'credit', 'escalate'] },
      message: { type: 'string', description: 'What the traveler reads. Plain, brief, institutional.' },
      credit_cents: { type: 'integer', description: 'Only for action=credit. Whole cents.' },
      reason: { type: 'string', description: 'One line for our records — why this decision.' },
    },
    required: ['action', 'message', 'reason'],
  },
};

/**
 * Decide what happens to a support case.
 *
 * Always resolves — a thrown model error becomes an escalation, because the one outcome
 * that must never happen is a traveler being told nothing.
 */
async function resolveIssue({ description, trip, language, category }) {
  const lang = langOf(language);
  // The Safety row on the screen says "always reaches a person". Until 15 Sept 2026 that was
  // true only if the words matched an English pattern: the server never read the category, so
  // a safety report in other words could have been answered by a machine. It is enforced here.
  if (category === 'safety') {
    return {
      action: 'escalate',
      message: supportMessage('forced', lang),
      reason: 'Filed under Safety: always a person.',
      forced: true,
    };
  }
  const forced = mustReachHuman(description);

  if (forced) {
    return {
      action: 'escalate',
      message: supportMessage('forced', lang),
      reason: 'Matched a category that must always reach a person.',
      forced: true,
    };
  }

  let out;
  try {
    const res = await getClient().messages.create({
      model: MODEL,
      max_tokens: 1024,
      system: systemPrompt(trip, lang, category),
      tools: [TOOL],
      tool_choice: { type: 'tool', name: 'resolve' },
      messages: [{ role: 'user', content: String(description || '').slice(0, 4000) }],
    });
    const call = res.content.find((c) => c.type === 'tool_use');
    if (!call) throw new Error('model returned no decision');
    out = call.input;
  } catch (err) {
    // A model that is down, rate-limited or confused must not strand the traveler.
    return {
      action: 'escalate',
      message: supportMessage('forced', lang),
      reason: `Automatic handling unavailable: ${err.message}`,
      forced: true,
    };
  }

  // ---- the model proposed; from here the server decides ----

  // Re-check the OUTPUT too: a model can be talked into calling an assault a billing query.
  if (mustReachHuman(out.message) || mustReachHuman(out.reason)) {
    return { action: 'escalate', message: out.message, reason: 'Output matched an always-human category.', forced: true };
  }

  if (out.action === 'credit') {
    const cents = Number.isFinite(out.credit_cents) ? Math.floor(out.credit_cents) : 0;
    // A credit larger than the cap, or larger than the travel itself, is a person's call.
    const paid = Number(trip?.totalCents) || 0;
    if (cents <= 0 || cents > MAX_AUTO_CREDIT_CENTS || (paid > 0 && cents > paid)) {
      return {
        action: 'escalate',
        message: supportMessage('forced', lang),
        reason: `Proposed credit ${cents}c outside automatic limits (cap ${MAX_AUTO_CREDIT_CENTS}c, travel ${paid}c).`,
        forced: true,
      };
    }
    return { action: 'credit', credit_cents: cents, message: out.message, reason: out.reason };
  }

  if (out.action === 'explain') {
    return { action: 'explain', message: out.message, reason: out.reason };
  }

  return { action: 'escalate', message: out.message, reason: out.reason || 'Model escalated.' };
}

// ALWAYS_HUMAN, LANGUAGES and langOf are shared with operatorsupport.js ON PURPOSE. The list
// of things a model must never close is the same list whoever is asking — an operator
// reporting a passenger's conduct is a safety report exactly as a traveler reporting an
// operator's is. Two copies of that list would drift, and the copy that drifted would be the
// one nobody was reading when it mattered.
module.exports = { resolveIssue, MAX_AUTO_CREDIT_CENTS, MAX_OUT_OF_POCKET_CENTS, mustReachHuman, supportMessage, replySender, langOf, ALWAYS_HUMAN, LANGUAGES };
