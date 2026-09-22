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

const COOKIE = 'ar_ops';

/** The cookie value for the configured password. Changing the password invalidates sessions. */
function expectedCookie() {
  const pw = readKey('OPS_PASSWORD');
  if (!pw) return null;
  return crypto.createHash('sha256').update(`ar-ops:${pw}`).digest('hex');
}

function signedIn(req) {
  const want = expectedCookie();
  if (!want) return false;
  const raw = req.headers.cookie || '';
  const got = raw.split(';').map((c) => c.trim()).find((c) => c.startsWith(`${COOKIE}=`));
  if (!got) return false;
  const value = got.slice(COOKIE.length + 1);
  // Constant time, so the cookie cannot be guessed a byte at a time.
  const a = Buffer.from(value);
  const b = Buffer.from(want);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
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
    <input type="password" name="password" placeholder="Password" autofocus
      style="width:100%;padding:13px 14px;border:1px solid ${T.border};border-radius:13px;
             font-size:16px;background:#fff;color:${T.ink};box-sizing:border-box;">
    <button type="submit" class="cta" style="border:0;cursor:pointer;">Sign in</button>
  </form>
</section>`;

/** A stat line: a quiet label and a value, the app's own row idiom. */
const stat = (k, v, mono) =>
  `<div><span class="k">${esc(k)}</span><span class="${mono ? 'amount' : ''}">${v}</span></div>`;

const UNDERWAY = ['assigned', 'accepted', 'arrived', 'onboard'];

async function board() {
  const db = adminDb();
  if (!db) {
    return `<h1>Operations</h1>
      <section><h2>Not connected</h2><p>${esc(adminStatus().reason)}</p></section>`;
  }

  const dayAgo = Date.now() - 24 * 60 * 60 * 1000;
  const [ridesSnap, opsSnap, schedSnap, caseSnap] = await Promise.all([
    db.collection('rides').get(),
    db.collection('operators').get(),
    db.collection('scheduled_rides').where('status', '==', 'reserved').get(),
    db.collection('support_tickets').where('status', '==', 'open').get(),
  ]);

  const rides = ridesSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
  const operators = opsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
  const scheduled = schedSnap.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => a.atMs - b.atMs);
  const cases = caseSnap.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => b.createdAt - a.createdAt);

  const underway = rides.filter((r) => UNDERWAY.includes(r.status)).sort((a, b) => b.createdAt - a.createdAt);
  const today = rides.filter((r) => Number(r.createdAt) > dayAgo);
  const completed = today.filter((r) => r.status === 'completed');
  const onDuty = operators.filter((o) => o.available);
  const owed = rides.filter((r) => r.payoutPending);
  const disputed = rides.filter((r) => r.disputed);
  const attention = rides.filter((r) => r.monitor?.state === 'emergency' || r.monitor?.state === 'escalated');

  const paid = completed.reduce((n, r) => n + (Number(r.operatorPaidCents) || 0), 0);
  const took = completed.reduce((n, r) => n + (Number(r.platformTakeCents) || 0), 0);
  const owedCents = owed.reduce((n, r) => n + (Number(r.costCents) || 0), 0);

  // THE ONE THING THAT MUST BE AT THE TOP. Anything on fire outranks the numbers.
  const alarms = [];
  if (attention.length) alarms.push(`${attention.length} travel needing attention`);
  if (disputed.length) alarms.push(`${disputed.length} disputed payment${disputed.length > 1 ? 's' : ''}`);
  if (owed.length) alarms.push(`${owed.length} operator payout${owed.length > 1 ? 's' : ''} owed`);
  const noReceipt = rides.filter((r) => r.receiptFailed);
  if (noReceipt.length) alarms.push(`${noReceipt.length} receipt${noReceipt.length > 1 ? 's' : ''} not delivered`);

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

${alarms.length
  ? `<div class="panel" style="background:#FFF4F4;border-color:#F3D8D8;margin-top:18px;">
       <strong>Needs attention.</strong> ${alarms.map(esc).join(' · ')}
     </div>`
  : ''}

<div class="statement">
  <div class="lbl">Travel Underway</div>
  <div class="figure">${underway.length}</div>
  <div class="note">${onDuty.length} operator${onDuty.length === 1 ? '' : 's'} on duty ·
    ${scheduled.length} reservation${scheduled.length === 1 ? '' : 's'} upcoming</div>
</div>

<section>
  <h2>Last 24 hours</h2>
  <div class="rows">
    ${stat('Travel completed', completed.length)}
    ${stat('Travel started', today.length)}
    ${stat('Paid to operators', money(paid), true)}
    ${stat('American Rider kept', money(took), true)}
    <div class="split"></div>
    ${stat('Payouts owed', `${owed.length} · ${money(owedCents)}`, true)}
    ${stat('Disputed', disputed.length)}
    ${stat('Open cases', cases.length)}
    ${stat('Receipts not delivered', noReceipt.length)}
  </div>
</section>

<section>
  <h2>Underway now</h2>
  ${underway.length
    ? `<div class="rows">${underway.slice(0, 25).map(rideRow).join('')}</div>`
    : '<p>No travel underway.</p>'}
</section>

<section>
  <h2>On duty</h2>
  ${onDuty.length
    ? `<div class="rows">${onDuty
        .map((o) => `<div><span class="k">${esc(o.name || o.id)}<br>
          <span style="color:${T.faint};font-size:13px;">${esc(o.car || '')} ${esc(o.plate || '')}</span></span>
          <span class="amount">${o.screened === false ? 'NOT SCREENED' : o.payoutsEnabled === false ? 'not payable' : 'available'}</span></div>`)
        .join('')}</div>`
    : '<p>Nobody is on duty.</p>'}
</section>

<section>
  <h2>Reservations</h2>
  ${scheduled.length
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
  ${cases.length
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
    ${stat('Firestore', adminStatus().ok ? 'connected' : 'DOWN')}
    ${stat('Stripe webhook', webhookReady() ? 'configured' : 'NOT CONFIGURED')}
    ${stat('Email receipts', emailReady() ? 'configured' : 'NOT CONFIGURED')}
    ${stat('Operator screening', screeningReady() ? 'configured' : 'NOT CONFIGURED')}
    ${stat('Assistant', readKey('ANTHROPIC_API_KEY') ? 'on' : 'off')}
  </div>
  <a class="more" href="/health">Full health report ›</a>
</section>`;
}

function mount(app, express) {
  app.get('/ops', async (req, res) => {
    if (!expectedCookie()) {
      return res
        .status(503)
        .type('html')
        .send(page('Operations', '<h1>Operations</h1><section><p>Set OPS_PASSWORD in the environment to use this page.</p></section>'));
    }
    if (!signedIn(req)) return res.type('html').send(page('Operations', LOGIN));
    try {
      res.type('html').send(page('Operations', await board()));
    } catch (e) {
      res
        .status(500)
        .type('html')
        .send(page('Operations', `<h1>Operations</h1><section><h2>Error</h2><p>${esc(e.message)}</p></section>`));
    }
  });

  app.post('/ops/enter', express.urlencoded({ extended: false }), (req, res) => {
    const want = readKey('OPS_PASSWORD');
    const got = String(req.body?.password || '');
    // Constant time again, and a deliberate pause on failure so the form cannot be run at
    // speed against a short password.
    const ok =
      want &&
      got.length === want.length &&
      crypto.timingSafeEqual(Buffer.from(got), Buffer.from(want));
    if (!ok) {
      return setTimeout(
        () =>
          res
            .status(401)
            .type('html')
            .send(page('Operations', `<h1>Operations</h1><p class="lede">That password is not right.</p><section>${LOGIN.split('<section>')[1]}`)),
        700,
      );
    }
    res.setHeader(
      'Set-Cookie',
      `${COOKIE}=${expectedCookie()}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${60 * 60 * 12}; Secure`,
    );
    res.redirect('/ops');
  });

  // THE GOVERNMENT-FEE LEDGER: what is held for each public body for a calendar month, summed
  // from the rides, as JSON. /ops/remittance?year=2026&month=9 — default, the month just
  // ended. Behind the same cookie as the board. It names no traveler: payees, counts, cents.
  app.get('/ops/remittance', async (req, res) => {
    if (!expectedCookie() || !signedIn(req)) return res.status(401).json({ error: 'Sign in at /ops first' });
    const db = adminDb();
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

module.exports = { mount };
