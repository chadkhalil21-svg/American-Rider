// Deterministic bridge from American Rider's statutory screening result to Checkr's
// provider-hosted adverse-action workflow.
//
// The platform does not turn Checkr's "consider" label into a decision. screening.js decides
// under the jurisdiction's rule set. This module only maps the concrete statutory reasons to
// Checkr adverse items so Checkr can deliver the pre-adverse/report/rights package, hold the
// dispute window, and send final notice. If the mapping is not confident, automation stops;
// an unrelated adverse item is never selected merely to make the workflow proceed.

const STOP = new Set(['the','and','for','with','from','this','that','within','previous','years','year','record','operator','requirements','transportation','network','does','meet','florida']);
const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const tokens = (s) => new Set(norm(s).split(/\s+/).filter((x) => x.length >= 3 && !STOP.has(x)));

function itemMatchesReason(item, reason) {
  const it = norm(item?.text);
  const rr = norm(reason);
  if (!it || !rr) return false;
  if (it.includes(rr) || rr.includes(it)) return true;
  const a = tokens(it), b = tokens(rr);
  let overlap = 0;
  for (const x of b) if (a.has(x)) overlap++;
  // One highly distinctive statutory term is enough; otherwise require two shared terms.
  const distinctive = ['felony','misdemeanor','suspended','revoked','license','dui','reckless','battery','sexual','offender','flee','elude','homicide','murder','manslaughter','robbery','kidnap'];
  if (distinctive.some((x) => a.has(x) && b.has(x))) return true;
  return overlap >= 2;
}

function selectAdverseItemIds(items, reasons) {
  const list = Array.isArray(items) ? items.filter((x) => x?.id && x?.text) : [];
  const rs = Array.isArray(reasons) ? reasons.filter(Boolean) : [];
  if (!list.length || !rs.length) return { ok: false, ids: [], unmapped: rs };
  const ids = new Set();
  const unmapped = [];
  for (const reason of rs) {
    const hits = list.filter((item) => itemMatchesReason(item, reason));
    if (!hits.length) unmapped.push(reason);
    else for (const h of hits) ids.add(String(h.id));
  }
  return { ok: unmapped.length === 0 && ids.size > 0, ids: [...ids], unmapped };
}

async function startProviderAdverseAction({ reportId, reasons, api, now = Date.now() }) {
  if (!reportId || typeof api !== 'function') return { ok: false, code: 'bad_input' };
  const listed = await api('GET', `/reports/${reportId}/adverse_items`);
  const items = Array.isArray(listed) ? listed : (Array.isArray(listed?.data) ? listed.data : []);
  const selected = selectAdverseItemIds(items, reasons);
  if (!selected.ok) {
    return { ok: false, code: 'unmapped_adverse_items', unmapped: selected.unmapped };
  }
  // Checkr's API defaults to seven days. State it explicitly so a dashboard default cannot
  // silently shorten the dispute opportunity.
  const postAt = new Date(now + 7 * 24 * 60 * 60 * 1000).toISOString();
  const action = await api('POST', `/reports/${reportId}/adverse_actions`, {
    post_notice_scheduled_at: postAt,
    adverse_item_ids: selected.ids,
    context: 'american-rider-statutory',
    medium: { email: { priority: 1, required: true }, postal: { priority: 0, required: false } },
  });
  return { ok: true, actionId: action?.id || null, status: action?.status || 'pending', postNoticeScheduledAt: postAt, itemIds: selected.ids };
}

async function activeProviderAdverseActions({ reportId, api }) {
  const out = await api('GET', `/reports/${reportId}/adverse_actions?context=american-rider-statutory`);
  const list = Array.isArray(out?.data) ? out.data : [];
  return list.filter((x) => x && !x.canceled_at && x.status !== 'complete');
}

async function cancelProviderAdverseActions({ reportId, api }) {
  const active = await activeProviderAdverseActions({ reportId, api });
  for (const a of active) await api('DELETE', `/adverse_actions/${a.id}`);
  return { ok: true, canceled: active.map((x) => x.id) };
}

module.exports = {
  itemMatchesReason, selectAdverseItemIds,
  startProviderAdverseAction, activeProviderAdverseActions, cancelProviderAdverseActions,
};
