// Server-side toll authority. HERE is invoked only when toll-cost resolution is requested;
// map rendering and ordinary street routing remain independent.
//
// HERE Routing v8 returns toll fares per section. A fare id may repeat across sections, so
// deduplicate by id before summing. If HERE explicitly reports toll data unavailable, or if
// the provider cannot answer, status is unknown — never silently $0.
const { readKey } = require('./env');

const HERE_TOLL_URL = 'https://router.hereapi.com/v8/routes';
const TIMEOUT_MS = 7000;

function cents(price) {
  if (!price || !Number.isFinite(Number(price.value))) return null;
  const currency = String(price.currency || '').toUpperCase();
  if (currency && currency !== 'USD') return null;
  const n = Math.round(Number(price.value) * 100);
  return Number.isSafeInteger(n) && n >= 0 ? n : null;
}

function parseHereTolls(data) {
  const route = Array.isArray(data?.routes) ? data.routes[0] : null;
  if (!route || !Array.isArray(route.sections)) return { status: 'unknown', tollCents: null, reason: 'no_route' };
  const notices = route.sections.flatMap((s) => Array.isArray(s?.notices) ? s.notices : []);
  if (notices.some((n) => String(n?.code || '').toLowerCase() === 'tollsdataunavailable')) {
    return { status: 'unknown', tollCents: null, reason: 'provider_data_unavailable' };
  }
  const seen = new Set();
  let total = 0;
  for (const section of route.sections) {
    for (const toll of (Array.isArray(section?.tolls) ? section.tolls : [])) {
      for (const fare of (Array.isArray(toll?.fares) ? toll.fares : [])) {
        const id = String(fare?.id || '');
        if (id && seen.has(id)) continue;
        const amount = cents(fare?.convertedPrice) ?? cents(fare?.price);
        if (amount == null) return { status: 'unknown', tollCents: null, reason: 'unpriced_toll' };
        if (id) seen.add(id);
        total += amount;
      }
    }
  }
  return { status: total > 0 ? 'tolled' : 'clear', tollCents: total, provider: 'here' };
}

async function resolveTolls(from, to, { departureTime = 'any' } = {}) {
  const apiKey = readKey('HERE_API_KEY');
  if (!apiKey) return { status: 'unknown', tollCents: null, reason: 'provider_not_configured' };
  const q = new URLSearchParams({
    origin: `${from.lat},${from.lng}`,
    destination: `${to.lat},${to.lng}`,
    transportMode: 'car',
    return: 'tolls',
    currency: 'USD',
    departureTime,
    apiKey,
  });
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${HERE_TOLL_URL}?${q}`, { signal: ctrl.signal });
    if (!res.ok) return { status: 'unknown', tollCents: null, reason: `provider_http_${res.status}` };
    return parseHereTolls(await res.json());
  } catch {
    return { status: 'unknown', tollCents: null, reason: 'provider_unavailable' };
  } finally {
    clearTimeout(timer);
  }
}

module.exports = { resolveTolls, parseHereTolls, HERE_TOLL_URL, TIMEOUT_MS };
