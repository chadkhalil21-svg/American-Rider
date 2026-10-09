// The operations view — what the platform is doing, right now.
//
// WHY IT EXISTS. Everything the founders knew about their own company came from opening the
// app as a traveler, or from me reading Firestore out loud. There was no place to see travel
// underway, who is on duty, what money moved, or which cases are open. A company cannot launch
// without a window into itself, and "ask Claude" is not that window.
//
// BRAND-BUILT, NOT BRAND-COLOURED (Chad's standing rule). It runs on shell.js — the same
// letterhead, cards, eyebrows, radii and hex the app and the public site use. Mono for amounts
// and travel numbers, never for anything else.
//
// ACCESS. A password kept in OPS_PASSWORD, exchanged for an httpOnly cookie. Not a token in
// the URL: this page shows travelers' routes and operators' earnings, and a URL is copied into
// chats, pasted into search bars and kept in browser history forever.
const crypto = require('crypto');
const { page, T } = require('./shell');
const { adminDb, adminStatus } = require('./firebase-admin');
const { readKey } = require('./env');
const { webhookReady } = require('./webhook');
const { emailReady } = require('./email');
const { screeningReady } = require('./screening');
const { monthlyRemittance } = require('./remittance');
const { REQUIRED_DOCS, resolveDocument, setSuspension, assessAndRecord } = require('./qualification');
const { disclosureStale } = require('./matching');
const { applyIndependentConfirmation, continuingStatus } = require('./insurance-monitoring');
const { codeFor, totpStep, sessionFor, verifySession } = require('./opssecurity');
const { loadOpsBoard, UNDERWAY } = require('./opsboarddata');

const COOKIE = 'ar_ops';

// WHO MAY SIGN IN, AND AS WHOM. Every exception decision is audit-logged with the name of the
// person who made it, so a shared password alone cannot say who that was. OPS_USERS names each
// person — "alice:long-password,bob:another-long-password" — and each signs in as themselves.
// OPS_PASSWORD alone still works and signs in as "ops": authenticated, but not attributable to
// one person, which /ops says on every page.
function opsAccounts() {
  const users = readKey('OPS_USERS');
  if (users) {
    return users
      .split(',')
      .map((pair) => {
        const i = pair.indexOf(':');
        return i > 0 ? { name: pair.slice(0, i), pw: pair.slice(i + 1) } : null;
      })
      .filter((x) => x && x.pw && /^[A-Za-z0-9_-]{1,40}$/.test(x.name));
  }
  const pw = readKey('OPS_PASSWORD');
  const mode = sharedMode();
  if (!pw || mode === 'off') return [];
  return [{ name: mode === 'emergency' ? 'ops-shared-emergency' : 'ops-shared-dev', pw }];
}

/**
 * Is this a production server? Render sets RENDER=true on every service; a live Stripe key or
 * NODE_ENV=production says the same. In production the shared password is OFF: an audit trail
 * that says "ops" cannot say who.
 */
function isProduction() {
  return process.env.NODE_ENV === 'production' || process.env.RENDER === 'true' || /^(sk|rk)_live_/.test(readKey('STRIPE_SECRET_KEY') || '');
}

/**
 * How the shared OPS_PASSWORD may be used, when OPS_USERS is not set:
 *   'dev'        not production — allowed, recorded as "ops-shared-dev"
 *   'emergency'  production with OPS_ALLOW_SHARED_PASSWORD=emergency — allowed, recorded as
 *                "ops-shared-emergency", and every page says so. For a lost OPS_USERS only.
 *   'off'        production otherwise
 */
function sharedMode() {
  if (!isProduction()) return 'dev';
  return readKey('OPS_ALLOW_SHARED_PASSWORD') === 'emergency' ? 'emergency' : 'off';
}

function mfaSecret(name) {
  const entry=String(readKey('OPS_MFA_SECRETS')||'').split(',').find((part)=>part.startsWith(`${name}:`));
  const key=entry?.slice(name.length+1)||'';
  return codeFor(key,1) ? key : null;
}
const productionSecurityReady = () => !isProduction() ||
  (String(readKey('OPS_SESSION_SECRET')||'').length>=32 &&
    opsAccounts().length>0 && opsAccounts().every((acct)=>!!mfaSecret(acct.name)));
// Diagnostics stay in private application logs. Never print passwords, MFA keys or session secrets.
function opsConfigurationIssues() {
  const accounts = opsAccounts();
  const issues = [];
  if (!accounts.length) issues.push('OPS_USERS has no valid named account (name:password)');
  if (isProduction()) {
    if (String(readKey('OPS_SESSION_SECRET') || '').length < 32)
      issues.push('OPS_SESSION_SECRET is missing or shorter than 32 characters');
    const lackingMfa = accounts.filter((acct) => !mfaSecret(acct.name)).map((acct) => acct.name);
    if (lackingMfa.length)
      issues.push('OPS_MFA_SECRETS missing or invalid Base32 secret for account(s): ' + lackingMfa.join(', '));
  }
  return issues;
}
const configured = () => opsConfigurationIssues().length === 0;
if (isProduction()) {
  const issues = opsConfigurationIssues();
  if (issues.length) console.warn('[operations] Sign-in blocked: ' + issues.join('; '));
}
const shared = () => !readKey('OPS_USERS') && configured();

/** For /health: how /ops is signed in to. */
function opsAuthMode() {
  if (isProduction() && opsAccounts().length && !productionSecurityReady()) return 'off (Ops MFA/session secret required)';
  if (readKey('OPS_USERS') && opsAccounts().length) return 'named';
  if (!readKey('OPS_PASSWORD')) return 'off';
  const m = sharedMode();
  return m === 'off' ? 'off (shared password disabled in production)' : `shared-${m}`;
}

/** A session token for one account. Changing that person's password ends their sessions. */
const tokenFor = (acct) => crypto.createHash('sha256').update(`ar-ops:${acct.name}:${acct.pw}`).digest('hex');

/** The signed-in person's name, or null. */
function signedIn(req) {
  const raw = req.headers?.cookie || '';
  const got = raw.split(';').map((c) => c.trim()).find((c) => c.startsWith(`${COOKIE}=`));
  if (!got) return null;
  let value;
  try { value = decodeURIComponent(got.slice(COOKIE.length + 1)); } catch { return null; }
  if (isProduction()) {
    if (!productionSecurityReady()) return null;
    const acct=opsAccounts().find((x)=>x.name===value.split('.')[0]);
    return acct && verifySession(value,acct,readKey('OPS_SESSION_SECRET')) ? acct.name : null;
  }
  const dot = value.lastIndexOf('.');
  if (dot <= 0) return null;
  const name = value.slice(0, dot);
  const acct = opsAccounts().find((x) => x.name === name);
  if (!acct) return null;
  // Constant time, so the cookie cannot be guessed a byte at a time.
  const a = Buffer.from(value.slice(dot + 1));
  const b = Buffer.from(tokenFor(acct));
  return a.length === b.length && crypto.timingSafeEqual(a, b) ? acct.name : null;
}

/** Who did it, for the audit log. */
function actorOf(req) {
  const raw = req.headers?.cookie || '';
  return {
    name: signedIn(req),
    ip: req.ip || req.headers?.['x-forwarded-for'] || null,
    userAgent: req.headers?.['user-agent'] || null,
    // A fingerprint of the session, not the session: enough to tell two sessions apart.
    session: crypto.createHash('sha256').update(raw).digest('hex').slice(0, 12),
  };
}

const money = (c) => `$${((Number(c) || 0) / 100).toFixed(2)}`;
const esc = (s) =>
  String(s ?? '').replace(/[&<>"]/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[m]));
const ago = (ms) => {
  if (!ms) return '—';
  const m = Math.round((Date.now() - Number(ms)) / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  return h < 24 ? `${h}h ago` : `${Math.round(h / 24)}d ago`;
};

const LOGIN = `
<h1>Operations</h1>
<p class="lede">Sign in to continue.</p>
<section>
  <form method="post" action="/ops/enter">
    <input type="text" name="name" placeholder="Name" autocomplete="username" autocapitalize="none" autocorrect="off" spellcheck="false"
      style="width:100%;padding:13px 14px;border:1px solid ${T.border};border-radius:13px;
             font-size:16px;background:#fff;color:${T.ink};box-sizing:border-box;margin-bottom:10px;">
    <input type="password" name="password" placeholder="Password" autocomplete="current-password"
      style="width:100%;padding:13px 14px;border:1px solid ${T.border};border-radius:13px;
             font-size:16px;background:#fff;color:${T.ink};box-sizing:border-box;">
    <input type="text" name="otp" placeholder="Authenticator code (production)" inputmode="numeric" autocomplete="one-time-code"
      maxlength="6" style="width:100%;padding:13px 14px;border:1px solid ${T.border};border-radius:13px;
      font-size:16px;background:#fff;color:${T.ink};box-sizing:border-box;margin-top:10px;">
    <button type="submit" class="cta" style="border:0;cursor:pointer;">Sign in</button>
  </form>
</section>`;

/** A stat line: a quiet label and a value, the app's own row idiom. */
const stat = (k, v, mono) =>
  `<div><span class="k">${esc(k)}</span><span class="${mono ? 'amount' : ''}">${v}</span></div>`;

const DOC_TITLES = {
  license: 'Driver licence',
  registration: 'Vehicle registration',
  inspection: 'Vehicle inspection',
  insurance: 'Commercial insurance',
};

/** A small form that posts one decision. The session authorises it; SameSite=Lax keeps it ours. */
const noteInput = `<input type="text" name="note" placeholder="Note for the record (required)" required
  style="padding:8px 12px;border:1px solid ${T.border};border-radius:13px;font-size:14px;margin:6px 8px 0 0;min-width:220px;">`;
const small = (name, placeholder, extra = '') => `<input type="text" name="${name}" placeholder="${placeholder}" ${extra}
  style="padding:8px 12px;border:1px solid ${T.border};border-radius:13px;font-size:14px;margin:6px 8px 0 0;width:150px;">`;
const decide = (action, fields, label, extra = '') =>
  `<form method="post" action="${action}" style="margin:6px 0 0 0;">
     ${Object.entries(fields).map(([k, v]) => `<input type="hidden" name="${k}" value="${esc(v)}">`).join('')}
     ${extra}${noteInput}
     <button type="submit" style="border:1px solid ${T.border};background:#fff;color:${T.ink};
       border-radius:13px;padding:8px 14px;font-size:14px;cursor:pointer;margin-top:6px;">${esc(label)}</button>
   </form>`;

const DOC_CODES = /^(document_|insurance_)/;
const dollars = (x) => Number(String(x).replace(/[^0-9.]/g, '')) || undefined;

/**
 * One operator in the exception queue: every finding that stops them qualifying, and the
 * actions a person may take on it. Everything else about them is already automatic.
 */
function exceptionCard(u) {
  const q = u.qualification || {};
  const who = u.legalName || u.name || u.email || u.id;
  const blockers = Array.isArray(q.blockers) ? q.blockers : [];
  const shown = new Set();
  const rows = blockers.map((b) => {
    let actions = '';
    // One set of actions per document, however many findings it has.
    if (b.item && REQUIRED_DOCS.includes(b.item) && DOC_CODES.test(b.code) && !shown.has(b.item) && shown.add(b.item)) {
      const d = u.documents?.[b.item] || {};
      const image = d.imageUrl ? `<br><a href="${esc(d.imageUrl)}" target="_blank" rel="noopener">View document</a>` : '';
      const read = d.evidence?.fields ? `<br>Read: ${esc(JSON.stringify(d.evidence.fields))}` : '';
      const box = (name, label) => `<label style="font-size:13px;margin-right:10px;"><input type="checkbox" name="${name}" value="yes"> ${label}</label>`;
      // What a person states they read on the policy. The same Florida rules then judge it.
      const insurance = b.item === 'insurance'
        ? box('commercialUse', 'Covers passengers for hire') + box('tncUse', 'TNC / for-hire use stated') +
          box('insuredConfirmed', 'Operator is insured or listed') + box('vehicleConfirmed', 'Registered vehicle is listed') + '<br>' +
          small('limitDollars', 'Ride-period limit, $', 'inputmode="numeric"') +
          small('loggedOnPerPersonDollars', 'Logged-on BI per person, $', 'inputmode="numeric"') +
          small('loggedOnPerIncidentDollars', 'Logged-on BI per incident, $', 'inputmode="numeric"') +
          small('loggedOnPropertyDamageDollars', 'Logged-on property damage, $', 'inputmode="numeric"') +
          small('pipDollars', 'PIP, $', 'inputmode="numeric"') +
          small('effectiveDate', 'Policy start YYYY-MM-DD') +
          `<select name="uninsuredMotorist" style="padding:8px;border:1px solid ${T.border};border-radius:13px;margin:6px 8px 0 0;">
             <option value="">UM / UIM…</option><option value="yes">UM / UIM shown</option><option value="rejected_in_writing">UM rejected in writing</option></select>`
        : '';
      actions =
        `<span style="color:${T.faint};font-size:13px;">${esc(d.summary || '')}${image}${read}</span>` +
        decide('/ops/operators/document', { uid: u.id, kind: b.item, action: 'accept' }, 'Accept document',
          small('expiry', 'Expiry YYYY-MM-DD') + insurance) +
        decide('/ops/operators/document', { uid: u.id, kind: b.item, action: 'refuse' }, 'Refuse document');
    } else if (b.item === 'screening') {
      actions = `<span style="color:${T.faint};font-size:13px;">Decided through the screening company's adjudication, not here.</span>`;
    }
    return `<div><span class="k">${esc(b.reason)}<br>
        <span class="mono" style="color:${T.faint};font-size:12px;">${esc(b.code)}${b.item ? ` · ${esc(b.item)}` : ''}</span><br>${actions}</span>
      <span class="amount">${esc(b.kind)}</span></div>`;
  }).join('');
  const suspended = !!u.suspension?.active;
  return `<div class="rows" style="margin-bottom:18px;">
    <div><span class="k"><strong>${esc(who)}</strong><br>
      <span class="mono" style="color:${T.faint};font-size:12px;">${esc(u.id)} · assessed ${ago(q.evaluatedAt)}</span></span>
      <span class="amount">${esc(q.status || '—')}</span></div>
    ${rows}
    <div><span class="k">${decide('/ops/operators/suspension', { uid: u.id, action: suspended ? 'reinstate' : 'suspend' }, suspended ? 'Reinstate' : 'Suspend')}</span></div>
  </div>`;
}

async function board() {
  const db = adminDb();
  if (!db) {
    return `<h1>Operations</h1>
      <section><h2>Not connected</h2><p>${esc(adminStatus().reason)}</p></section>`;
  }

  const dayAgo = Date.now() - 24 * 60 * 60 * 1000;
  const loaded = await loadOpsBoard(db, dayAgo);
  const size = (k) => loaded[k].unavailable ? 'Unavailable' : `${loaded[k].rows.length}${loaded[k].saturated ? '+' : ''}`;
  const unreadable = Object.entries(loaded).filter(([, group]) => group.unavailable).map(([key]) => key);
  const unavailableText = '<p role="alert">This section is unavailable. Do not interpret missing records as none.</p>';
  const pending = loaded.pending.rows
    .sort((a, b) => (a.qualification?.evaluatedAt || 0) - (b.qualification?.evaluatedAt || 0));

  const operators = loaded.operators.rows;
  const scheduled = loaded.scheduled.rows;
  const cases = loaded.cases.rows;
  const underway = loaded.underway.rows.filter((r) => UNDERWAY.includes(r.status)).sort((a, b) => b.createdAt - a.createdAt);
  const today = loaded.recent.rows;
  const completed = today.filter((r) => r.status === 'completed');
  const onDuty = operators.filter((o) => o.available);
  const owed = loaded.owed.rows;
  const disputed = loaded.disputed.rows;
  const attention = loaded.attention.rows;

  const paid = completed.reduce((n, r) => n + (Number(r.operatorPaidCents) || 0), 0);
  const took = completed.reduce((n, r) => n + (Number(r.platformTakeCents) || 0), 0);
  const owedCents = owed.reduce((n, r) => n + (Number(r.costCents) || 0), 0);

  // THE ONE THING THAT MUST BE AT THE TOP. Anything on fire outranks the numbers.
  const alarms = [];
  if (attention.length) alarms.push(`${size('attention')} travel needing attention`);
  if (disputed.length) alarms.push(`${size('disputed')} disputed payment${disputed.length > 1 ? 's' : ''}`);
  if (owed.length) alarms.push(`${size('owed')} operator payout${owed.length > 1 ? 's' : ''} owed`);
  const noReceipt = loaded.noReceipt.rows;
  if (noReceipt.length) alarms.push(`${size('noReceipt')} receipt${noReceipt.length > 1 ? 's' : ''} not delivered`);
  const waiting = pending.filter((u) => u.qualification?.status === 'exception');
  if (waiting.length) alarms.push(`${size('pending')} operator qualification item${waiting.length > 1 ? 's' : ''} to review`);
  // Real operators only — the demonstration stand-ins are never stored.
  const staleDisclosure = operators.filter((o) => disclosureStale(o));

  const rideRow = (r) =>
    `<div>
       <span class="k">${esc(r.dep || '—')} → ${esc(r.dest || '—')}<br>
         <span style="color:${T.faint};font-size:13px;">${esc(r.operatorName || 'unassigned')} ·
         <span class="mono">${esc(r.tripNo || '')}</span> · ${ago(r.createdAt)}</span>
       </span>
       <span class="amount">${esc(r.status)}${r.monitor?.state && r.monitor.state !== 'clear' ? `<br><span style="font-size:12px;color:${T.blue};">${esc(r.monitor.state)}</span>` : ''}</span>
     </div>`;

  return `
<h1>Operations</h1>
<p class="lede">${new Date().toLocaleString('en-US', { dateStyle: 'full', timeStyle: 'short' })}</p>
${unreadable.length ? `<section role="alert" style="border:2px solid #B42318;">
  <h2>Operations data incomplete</h2>
  <p>${unreadable.length} dashboard section${unreadable.length === 1 ? ' is' : 's are'} unavailable.
  Counts and empty states cannot certify that emergencies, payout obligations, insurance exceptions or other work are clear.
  Review the affected data sources before making operational decisions.</p>
  <p>Affected sections: ${unreadable.map(esc).join(', ')}.</p>
  </section>` : ''}
<p><a href="/ops/markets">Market readiness, evidence and pause controls →</a></p>
<p><a href="/ops/cases?kind=emergency">Urgent and deadline cases · acknowledge →</a> · <a href="/ops/cases?kind=support">Support cases →</a></p>
<p><a href="/ops/disputes">Stripe dispute evidence · review only →</a></p>
${Object.entries(loaded).some(([,g]) => g.saturated)
  ? '<p role="alert"><strong>Some sections show a bounded sample.</strong> A “+” means more records exist. Do not use sample amounts for accounting; reconcile with Stripe and the financial ledger. Check /health for worker saturation.</p>' : ''}

${alarms.length
  ? `<div class="panel" style="background:#FFF4F4;border-color:#F3D8D8;margin-top:18px;">
       <strong>Needs attention.</strong> ${alarms.map(esc).join(' · ')}
     </div>`
  : ''}

<div class="statement">
  <div class="lbl">Travel Underway</div>
  <div class="figure">${size('underway')}</div>
  <div class="note">${size('operators')} operator${onDuty.length === 1 ? '' : 's'} on duty ·
    ${size('scheduled')} reservation${scheduled.length === 1 ? '' : 's'} upcoming</div>
</div>

<section>
  <h2>Recent activity · up to 120 Travels in the last 24 hours</h2>
  <p>These numbers and amounts describe only the records shown, not a complete daily financial or operational total.</p>
  <div class="rows">
    ${stat('Travel completed', loaded.recent.unavailable ? 'Unavailable' : completed.length)}
    ${stat('Travel started', loaded.recent.unavailable ? 'Unavailable' : today.length)}
    ${stat('Paid to operators · sample', loaded.recent.unavailable ? 'Unavailable' : money(paid), true)}
    ${stat('American Rider kept · sample', loaded.recent.unavailable ? 'Unavailable' : money(took), true)}
    <div class="split"></div>
    ${stat('Payouts owed · shown', loaded.owed.unavailable ? 'Unavailable' : `${size('owed')} · ${money(owedCents)}`, true)}
    ${stat('Disputed · shown', size('disputed'))}
    ${stat('Open cases · shown', size('cases'))}
    ${stat('Receipts not delivered · shown', size('noReceipt'))}
  </div>
</section>

<section>
  <h2>Underway now</h2>
  ${loaded.underway.unavailable ? unavailableText : underway.length
    ? `<div class="rows">${underway.slice(0, 25).map(rideRow).join('')}</div>`
    : '<p>No travel underway.</p>'}
</section>

<section>
  <h2>Operator exceptions</h2>
  ${loaded.pending.saturated ? '<p role="alert">More Operator qualification exceptions exist than this page can show. Do not treat the list below as the entire review queue.</p>' : ''}
  <p>Operators qualify automatically when every check passes. Only what the checks cannot settle
    — held documents, refusals to reconsider, suspensions — appears here. Every decision is
    recorded with a note and the name of the person who made it.${shared() ? ` <strong>Signed in with the shared password (${esc(sharedMode())}): decisions are recorded as “${esc(opsAccounts()[0]?.name || 'ops')}”, not a named person. Set OPS_USERS.</strong>` : ''}</p>
  ${loaded.pending.unavailable ? unavailableText : pending.length ? pending.map(exceptionCard).join('') : '<p>No operator exceptions.</p>'}
  <div style="margin-top:20px;">
    <strong>Insurance status confirmation</strong>
    <p style="color:${T.muted};font-size:13px;">After reviewing a carrier, agent, broker, or monitoring-provider confirmation, record the current status here. A cancellation or material change removes the Operator from service immediately.</p>
    <form method="post" action="/ops/operators/insurance-status">
      ${small('uid', 'Operator uid', 'required')}
      ${small('source', 'broker / carrier / provider', 'required')}
      <select name="status" style="padding:8px;border:1px solid ${T.border};border-radius:13px;margin:6px 8px 0 0;">
        <option value="verified_active">Verified active</option>
        <option value="pending_cancellation">Pending cancellation</option>
        <option value="cancelled">Cancelled</option>
        <option value="nonrenewed">Nonrenewed</option>
        <option value="coverage_reduced">Coverage reduced</option>
        <option value="vehicle_removed">Vehicle removed</option>
        <option value="unverified">Unverified</option>
      </select>
      ${noteInput}
      <button type="submit" style="border:1px solid ${T.border};background:#fff;color:${T.ink};border-radius:13px;padding:8px 14px;font-size:14px;cursor:pointer;margin-top:6px;">Record status</button>
    </form>
  </div>
  ${decide('/ops/operators/suspension', { action: 'suspend' }, 'Suspend an operator', small('uid', 'Operator uid', 'required'))}
</section>

<section>
  <h2>On duty</h2>
  ${loaded.operators.unavailable ? unavailableText : onDuty.length
    ? `<div class="rows">${onDuty
        .map((o) => `<div><span class="k">${esc(o.name || o.id)}<br>
          <span style="color:${T.faint};font-size:13px;">${esc(o.car || '')} ${esc(o.plate || '')}</span></span>
          <span class="amount">${o.screened === false ? 'NOT SCREENED' : o.payoutsEnabled === false ? 'not payable' : 'available'}</span></div>`)
        .join('')}</div>`
    : '<p>Nobody is on duty.</p>'}
  ${staleDisclosure.length
    ? `<p>${staleDisclosure.length} operator record${staleDisclosure.length === 1 ? '' : 's'} carry an
        insurance disclosure that is not the one in force. Dispatch skips them until the operator
        reads the current disclosure in the app: ${staleDisclosure.map((o) => esc(o.name || o.id)).join(', ')}.</p>`
    : ''}
</section>

<section>
  <h2>Reservations</h2>
  ${loaded.scheduled.unavailable ? unavailableText : scheduled.length
    ? `<div class="rows">${scheduled
        .slice(0, 15)
        .map(
          (r) => `<div><span class="k">${esc(r.dep || '—')} → ${esc(r.dest || '—')}<br>
            <span style="color:${T.faint};font-size:13px;"><span class="mono">${esc(r.tripNo || '')}</span></span></span>
            <span class="amount">${new Date(Number(r.atMs)).toLocaleString('en-US', { weekday: 'short', hour: 'numeric', minute: '2-digit' })}</span></div>`,
        )
        .join('')}</div>`
    : '<p>No reservations upcoming.</p>'}
</section>

<section>
  <h2>Open cases</h2>
  ${loaded.cases.unavailable ? unavailableText : cases.length
    ? `<div class="rows">${cases
        .slice(0, 15)
        .map(
          (c) => `<div><span class="k"><span class="mono">${esc(c.caseNo)}</span> ${esc(c.reason || '')}<br>
            <span style="color:${T.faint};font-size:13px;">${ago(c.createdAt)}</span></span>
            <span class="amount">${c.kind === 'emergency' ? 'EMERGENCY' : 'support'}</span></div>`,
        )
        .join('')}</div>`
    : '<p>No open cases.</p>'}
</section>

<section>
  <h2>Systems</h2>
  <div class="rows">
    ${stat('Firestore', unreadable.length ? 'DEGRADED' : adminStatus().ok ? 'connected' : 'DOWN')}
    ${stat('Stripe webhook', webhookReady() ? 'configured' : 'NOT CONFIGURED')}
    ${stat('Email receipts', emailReady() ? 'configured' : 'NOT CONFIGURED')}
    ${stat('Operator screening', screeningReady() ? 'configured' : 'NOT CONFIGURED')}
    ${stat('Optional incident/support analysis', readKey('ANTHROPIC_API_KEY') ? 'configured' : 'off')}
  </div>
  <a class="more" href="/health">Full health report ›</a>
</section>`;
}

/**
 * @param deps.db        () => Firestore, or null. Injected for tests.
 * @param deps.checks    the network half of an assessment (server.js qualificationChecks)
 * @param deps.liveMoney () => boolean, whether the Stripe key is live
 */
function mount(app, express, deps = {}) {
  const dbOf = deps.db || adminDb;
  const liveMoney = deps.liveMoney || (() => false);
  const checks = deps.checks || (async () => ({ account: { disabled: null }, payouts: { enabled: false } }));

  app.get('/ops', async (req, res) => {
    if (!configured()) {
      return res
        .status(503)
        .type('html')
        .send(page('Operations', '<h1>Operations</h1><section><p>Operations sign-in is unavailable because its security configuration is incomplete. Check the Render service logs for the exact missing requirement.</p></section>'));
    }
    if (!signedIn(req)) {
      if (isProduction()) {
        // Trace cookie rejection without logging its value or the person's identity.
        const cookiePresent = String(req.headers?.cookie || '').split(';')
          .some((part) => part.trim().startsWith(`${COOKIE}=`));
        console.info(`[operations] Sign-in page rendered: session_cookie=${cookiePresent ? 'present_invalid' : 'absent'}`);
      }
      return res.type('html').send(page('Operations', LOGIN));
    }
    try {
      res.type('html').send(page('Operations', await board()));
    } catch (e) {
      // Database error details may contain internal Firebase project paths and links.
      // Keep the private diagnostic on the server; show Operators an actionable safe state.
      console.error(`[operations] Dashboard could not render: ${String(e?.code || 'unexpected').slice(0, 48)}`);
      res.status(503).type('html').send(page('Operations',
        '<h1>Operations</h1><section role="alert"><h2>Dashboard temporarily unavailable</h2><p>Your sign-in succeeded, but operational data could not be retrieved. Please contact platform administration. Do not assume pending work is clear.</p></section>'));
    }
  });

  app.post('/ops/enter', express.urlencoded({ extended: false }), async (req, res) => {
    // Random reference connects an on-screen failure to private Render diagnostics.
    // It is NOT an authorization token. Never log names, passwords, codes, or sessions.
    const attempt = crypto.randomBytes(6).toString('hex');
    const trace = (outcome) => {
      if (isProduction()) console.info(`[operations] Sign-in ${attempt}: ${outcome}`);
    };
    const name = shared() ? opsAccounts()[0].name : String(req.body?.name || '').trim();
    const got = String(req.body?.password || '');
    const acct = opsAccounts().find((x) => x.name === name);
    let reason = 'credentials_rejected';
    // Constant time again, and a deliberate pause on failure so the form cannot be run at
    // speed against a short password.
    let ok = !!(
      acct &&
      got.length === acct.pw.length &&
      crypto.timingSafeEqual(Buffer.from(got), Buffer.from(acct.pw))
    );
    if (ok && isProduction()) {
      const step = totpStep(mfaSecret(acct.name), req.body?.otp);
      const ready = productionSecurityReady();
      ok = step !== null && ready;
      if (!ok) reason = ready ? 'authenticator_code_rejected' : 'configuration_incomplete';
      if (ok) {
        const db = dbOf();
        if (!db) {
          trace('mfa_store_unavailable');
          return res.status(503).send('Operations authentication is temporarily unavailable.');
        }
        try {
          ok = await db.runTransaction(async (tx) => {
            const ref = db.collection('ops_mfa').doc(acct.name);
            const prior = await tx.get(ref);
            if (Number(prior.exists ? prior.data().lastStep : -1) >= step) {
              reason = 'authenticator_code_already_used';
              return false;
            }
            tx.set(ref, { lastStep: step, acceptedAt: Date.now() }, { merge: true });
            return true;
          });
        } catch {
          trace('mfa_store_error');
          return res.status(503).send('Operations authentication is temporarily unavailable.');
        }
      }
    }
    if (!ok) {
      trace(reason);
      return setTimeout(
        () => res.status(401).type('html').send(page('Operations',
          `<h1>Operations</h1><section role="alert"><h2>Sign-in unsuccessful</h2>
          <p>Check your name and password, then use a newly refreshed six-digit code from your paired authenticator.</p>
          <p>Support reference: <strong>${attempt}</strong></p></section>
          <section>${LOGIN.split('<section>')[1]}`)),
        700,
      );
    }
    trace('session_issued');
    res.setHeader(
      'Set-Cookie',
      `${COOKIE}=${encodeURIComponent(isProduction()
        ? sessionFor(acct, readKey('OPS_SESSION_SECRET'))
        : `${acct.name}.${tokenFor(acct)}`)}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${60 * 60 * 12}; Secure`,
    );
    res.redirect('/ops');
  });

  // THE EXCEPTION ACTIONS. Each one: authenticated here, validated and audit-logged in the same
  // transaction as the change (backend/qualification.js), then the operator is re-assessed —
  // so resolving the last held item qualifies them on the spot, with nobody clicking Approve.
  const exceptionRoute = (path, act) =>
    app.post(path, express.urlencoded({ extended: false }), async (req, res) => {
      if (!configured() || !signedIn(req)) return res.status(401).type('html').send(page('Operations', LOGIN));
      const db = dbOf();
      if (!db) return res.status(503).send(esc(adminStatus().reason));
      const uid = String(req.body?.uid || '').trim();
      if (!uid) return res.status(400).send('uid is required');
      try {
        const out = await act({ db, uid, body: req.body || {}, actor: actorOf(req) });
        if (!out.ok) return res.status(out.status || 400).send(esc(out.error));
        await assessAndRecord({ db, uid, checks, liveMoney: liveMoney() });
        res.redirect(303, '/ops');
      } catch (e) {
        res.status(500).send(esc(e.message));
      }
    });

  // A person decides one document: a held one, or reconsiders a refused one.
  exceptionRoute('/ops/operators/document', ({ db, uid, body, actor }) =>
    resolveDocument({
      db,
      uid,
      actor,
      kind: String(body.kind || ''),
      action: String(body.action || ''),
      note: body.note,
      expiry: String(body.expiry || '').trim() || undefined,
      commercialUse: body.commercialUse,
      limitDollars: body.limitDollars ? dollars(body.limitDollars) : undefined,
      verified: {
        insuredConfirmed: body.insuredConfirmed === 'yes',
        vehicleConfirmed: body.vehicleConfirmed === 'yes',
        effectiveDate: String(body.effectiveDate || '').trim() || undefined,
        tncUse: body.tncUse === 'yes' ? 'yes' : undefined,
        rideCombinedDollars: body.limitDollars ? dollars(body.limitDollars) : undefined,
        loggedOnPerPersonDollars: body.loggedOnPerPersonDollars ? dollars(body.loggedOnPerPersonDollars) : undefined,
        loggedOnPerIncidentDollars: body.loggedOnPerIncidentDollars ? dollars(body.loggedOnPerIncidentDollars) : undefined,
        loggedOnPropertyDamageDollars: body.loggedOnPropertyDamageDollars ? dollars(body.loggedOnPropertyDamageDollars) : undefined,
        pipDollars: body.pipDollars ? dollars(body.pipDollars) : undefined,
        uninsuredMotorist: body.uninsuredMotorist || undefined,
      },
    }),
  );

  // Independent insurance-status evidence. Used after a carrier/broker reply or a
  // monitoring-provider alert is reviewed. The actor and note are retained on the same record.
  exceptionRoute('/ops/operators/insurance-status', async ({ db, uid, body, actor }) => {
    const ref = db.collection('users').doc(uid);
    const snap = await ref.get();
    if (!snap.exists) return { ok: false, status: 404, error: 'Operator not found' };
    const u = snap.data() || {};
    const status = String(body.status || 'verified_active');
    const source = String(body.source || 'broker').trim().slice(0, 40);
    const updated = applyIndependentConfirmation(u.insuranceMonitoring, {
      status,
      source,
      actor,
      note: String(body.note || '').trim() || null,
    });
    await ref.set({ insuranceMonitoring: updated }, { merge: true });
    const live = continuingStatus({ ...u, insuranceMonitoring: updated });
    await db.collection('audit_log').add({
      at: Date.now(),
      subject: uid,
      actor,
      action: 'insurance_status_confirmation',
      status,
      source,
      note: String(body.note || '').trim() || null,
      resultingCode: live.code || null,
    });
    if (!live.ok) {
      await db.collection('operators').doc(uid).set(
        { available: false, offDutyReason: live.code, offDutyAt: Date.now() },
        { merge: true },
      );
    }
    return { ok: true };
  });

  // Suspend (fraud, safety, administrative) or reinstate.
  exceptionRoute('/ops/operators/suspension', ({ db, uid, body, actor }) => {
    const action = String(body.action || '');
    if (!['suspend', 'reinstate'].includes(action)) return { ok: false, status: 400, error: 'Unknown action' };
    return setSuspension({ db, uid, active: action === 'suspend', actor, note: body.note });
  });

  // The record of every decision about one operator, newest first.
  app.get('/ops/audit', async (req, res) => {
    if (!configured() || !signedIn(req)) return res.status(401).json({ error: 'Sign in at /ops first' });
    const db = dbOf();
    if (!db) return res.status(503).json({ error: adminStatus().reason });
    const uid = String(req.query?.uid || '');
    if (!uid) return res.status(400).json({ error: 'uid is required' });
    try {
      const snap = await db.collection('audit_log').where('subject', '==', uid).get();
      res.json(snap.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => b.at - a.at));
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  // THE GOVERNMENT-FEE LEDGER: what is held for each public body for a calendar month, summed
  // from the rides, as JSON. /ops/remittance?year=2026&month=9 — default, the month just
  // ended. Behind the same cookie as the board. It names no traveler: payees, counts, cents.
  app.get('/ops/remittance', async (req, res) => {
    if (!configured() || !signedIn(req)) return res.status(401).json({ error: 'Sign in at /ops first' });
    const db = dbOf();
    if (!db) return res.status(503).json({ error: adminStatus().reason || 'Firestore is not configured' });
    const last = new Date();
    last.setUTCDate(1);
    last.setUTCMonth(last.getUTCMonth() - 1);
    const year = Number(req.query?.year) || last.getUTCFullYear();
    const month = Number(req.query?.month) || last.getUTCMonth() + 1;
    try {
      res.json(await monthlyRemittance({ db, year, month }));
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });
}

module.exports = { mount, signedIn, opsAccounts, tokenFor, opsAuthMode, sharedMode, actorOf, opsConfigurationIssues };
