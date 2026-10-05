// Internal Operations control: no evidence is approved by rendering a green checklist.
const { page } = require('./shell');
const { REQUIRED_EVIDENCE } = require('./market-readiness');
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' })[c]);
const title = (id) => id.replaceAll('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase());
function marketChecklistPage(items, { production = false } = {}) {
  const cards = items.map(({ market, state }) => {
    const id = esc(market.id);
    const ready = production && state.readyToActivate && state.manifestVersion && state.status !== 'active';
    const canOnboard = production && state.readyToOnboard && state.manifestVersion && state.status === 'waitlist';
    return `<section data-market="${id}">
  <h2>${esc(market.name)} · ${esc(market.state)} · ${esc(state.status)}</h2>
  <p>${state.status === 'active' ? 'New bookings are admitted in this county.' : state.status === 'onboarding' ? 'Only approved Operator intake is allowed; no paid Travel or duty is admitted.' : 'No paid Travel or expensive Operator onboarding is admitted in this county.'} Evidence references must be independently checked against real contracts, coverage and staffed service.</p>
  <p>Manifest ${esc(state.manifestVersion?.slice(0, 16) || 'not configured')} · ${state.missing.length} unmet requirement${state.missing.length === 1 ? '' : 's'}</p>
  ${state.fleetCleanupPending ? '<p role="alert"><strong>Fleet shutdown pending:</strong> new offers are blocked, but some Operator devices may still show on-duty. The leased cleanup must finish and be checked before reactivation.</p>' : ''}
  ${state.onboardingMissing?.length ? `<p>Prelaunch intake needs: ${state.onboardingMissing.map((m) => esc(title(m.id))).join(', ')}.</p>` : ''}
  ${state.missing.length ? `<ul>${state.missing.map((m) => `<li><strong>${esc(title(m.id))}</strong>: ${esc(m.reason)}</li>`).join('')}</ul>` : '<p>All source and externally reviewed records are current. Independently verify the underlying references before activation.</p>'}
  <details><summary>Record independently reviewed evidence</summary>
    <p>Paste only a document reference, independent issuer and expiry, not personal data or the document itself. This pauses an active county until it is re-approved.</p>
    <form class="evidence" data-market="${id}" data-version="${esc(state.manifestVersion || '')}">
      <label>Requirement <select name="domain">${REQUIRED_EVIDENCE.map((r) => `<option value="${esc(r)}">${esc(title(r))}</option>`).join('')}</select></label>
      <label>External record reference <input name="reference" minlength="8" maxlength="500" required></label>
      <label>Issuer or independent authority <input name="issuer" minlength="3" maxlength="120" required></label>
      <label>Valid through <input name="validUntil" type="date" required></label>
      <button type="submit">Record evidence and pause market</button>
    </form>
  </details>
  <button class="onboard" data-market="${id}" data-version="${esc(state.manifestVersion || '')}" ${canOnboard ? '' : 'disabled'}>Authorize prelaunch Operator intake</button>
  <button class="activate" data-market="${id}" data-version="${esc(state.manifestVersion || '')}" ${ready ? '' : 'disabled'}>Activate ${esc(market.name)}</button>
  <form class="pause" data-market="${id}">
    <label>Pause reason <input name="reason" minlength="8" maxlength="500" required></label>
    <button type="submit" ${['active', 'onboarding'].includes(state.status) ? '' : 'disabled'}>Pause intake and new offers</button>
  </form>
</section>`;
  }).join('');
  return page('Market readiness · Operations', `<style>
section[data-market] { margin-top:18px; }
section[data-market] h2 { margin-bottom:16px; }
section[data-market] details { margin:16px 0; border-top:1px solid var(--hairline); padding-top:10px; }
section[data-market] summary { cursor:pointer; min-height:44px; display:flex; align-items:center; font-weight:600; color:var(--blue); }
section[data-market] form.evidence { display:grid; gap:12px; margin-top:12px; }
section[data-market] label { display:block; font-size:14px; font-weight:600; }
section[data-market] input, section[data-market] select {
  display:block; width:100%; min-height:46px; margin-top:6px; padding:9px 12px;
  border:1px solid var(--border); border-radius:10px; color:var(--ink); background:#fff; font:16px Arial,sans-serif;
}
section[data-market] button {
  display:block; width:100%; min-height:46px; margin:12px 0 0; padding:10px 14px;
  border:1px solid var(--blue); border-radius:12px; color:#fff; background:var(--blue);
  font-size:15px; font-weight:600; text-align:center; cursor:pointer;
}
section[data-market] button.onboard { background:#fff; color:var(--blue); }
section[data-market] button:disabled { border-color:#D9D9D3; color:#777; background:#F1F1EF; cursor:not-allowed; }
section[data-market] form.pause { margin-top:20px; border-top:1px solid var(--hairline); padding-top:12px; }
section[data-market] form.pause button { border-color:#B54949; color:#8F2525; background:#fff; }
section[data-market] button:focus-visible,section[data-market] input:focus-visible,
section[data-market] select:focus-visible,section[data-market] summary:focus-visible {outline:3px solid var(--blue);outline-offset:3px;}
#result:not(:empty) { padding:10px 12px; border:1px solid var(--blue-border); background:var(--blue-tint); border-radius:10px; }
</style>
<h1>Market readiness</h1>
<p class="lede"><a href="/ops">← Operations</a> · No market can activate from geography or API keys alone.</p>
<p>Only named, MFA-authenticated Operations users may record evidence. Production activation additionally requires live provider readiness and all current external records. No market was activated by this page being created.</p>
<p id="result" role="status" aria-live="polite"></p>
${cards || '<section><p>No configured service counties.</p></section>'}
<script>
async function action(market, verb, body) {
  const status=document.getElementById('result'); status.textContent='Saving…';
  try {
    const r=await fetch('/ops/markets/'+encodeURIComponent(market)+'/'+verb,{
      method:'POST',credentials:'same-origin',headers:{'content-type':'application/json','x-ar-ops-action':'1'},body:JSON.stringify(body)
    });
    const result=await r.json();
    if(!r.ok) { status.textContent='No change: '+String(result.code||result.error||'unavailable'); return; }
    status.textContent='Saved. Refreshing checklist…'; location.reload();
  } catch { status.textContent='No change confirmed. Recheck the market before retrying.'; }
}
document.querySelectorAll('form.evidence').forEach(form=>form.addEventListener('submit', e=>{
  e.preventDefault();const f=new FormData(form);
  const validUntil=Date.parse(String(f.get('validUntil'))+'T23:59:59Z');
  action(form.dataset.market,'evidence',{domain:f.get('domain'),reference:f.get('reference'),issuer:f.get('issuer'),validUntil,manifestVersion:form.dataset.version});
}));
document.querySelectorAll('button.activate').forEach(button=>button.addEventListener('click',()=>{
  if(!button.disabled) action(button.dataset.market,'activate',{manifestVersion:button.dataset.version});
}));
document.querySelectorAll('button.onboard').forEach(button=>button.addEventListener('click',()=>{
  if(!button.disabled) action(button.dataset.market,'onboard',{manifestVersion:button.dataset.version});
}));
document.querySelectorAll('form.pause').forEach(form=>form.addEventListener('submit',e=>{
  e.preventDefault();action(form.dataset.market,'pause',{reason:new FormData(form).get('reason')});
}));
</script>`, '');
}
module.exports = { marketChecklistPage };
