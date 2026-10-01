// National place autocomplete. Search is discovery, not service authorization:
// it may find any U.S. place; fare/market authority decides whether it is bookable.
const { readKey } = require('./env');

const MAX_QUERY = 160;
const CACHE_TTL_MS = 10 * 60 * 1000;
const cache = new Map();
const inflight = new Map();
const bucket = (n) => Math.round(Number(n) * 100) / 100;
const cacheKey = (q, near, limit) => `${q.toLowerCase()}|${near ? `${bucket(near.lat)},${bucket(near.lng)}` : 'us'}|${limit}`;
const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));
const validCoord = (lat, lng) => Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;

function normalizeSuggestion(x) {
  const pos = x?.position;
  if (!x || typeof x.title !== 'string' || !validCoord(Number(pos?.lat), Number(pos?.lng))) return null;
  const resultType = String(x.resultType || 'place').toLowerCase();
  return {
    id: String(x.id || `${pos.lat},${pos.lng},${x.title}`).slice(0, 240),
    title: x.title.slice(0, 180),
    subtitle: String(x.address?.label || x.address?.street || x.address?.city || '').slice(0, 240),
    category: resultType === 'locality' ? 'locality' : resultType === 'street' || resultType === 'houseNumber' ? 'address' : resultType === 'place' ? 'place' : 'place',
    lat: Number(pos.lat),
    lng: Number(pos.lng),
  };
}

async function searchPlaces(query, near, limit = 6) {
  const q = String(query || '').trim().slice(0, MAX_QUERY);
  if (q.length < 2) return [];
  const key = readKey('HERE_API_KEY');
  if (!key) return [];
  const n = near && validCoord(Number(near.lat), Number(near.lng)) ? { lat: Number(near.lat), lng: Number(near.lng) } : null;
  const ck = cacheKey(q, n, clamp(Number(limit) || 6, 1, 8));
  const hit = cache.get(ck);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.items;
  if (inflight.has(ck)) return inflight.get(ck);
  const u = new URL('https://autosuggest.search.hereapi.com/v1/autosuggest');
  u.searchParams.set('q', q);
  u.searchParams.set('apiKey', key);
  u.searchParams.set('limit', String(clamp(Number(limit) || 6, 1, 8)));
  u.searchParams.set('in', 'countryCode:USA');
  if (near && validCoord(Number(near.lat), Number(near.lng))) {
    u.searchParams.set('at', `${Number(near.lat)},${Number(near.lng)}`);
  } else {
    // HERE requires a search context; this is a neutral continental-US bias, not a market gate.
    u.searchParams.set('at', '39.8283,-98.5795');
  }
  const work = (async () => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 2500);
  try {
    const res = await fetch(u, { signal: controller.signal, headers: { 'User-Agent': 'American-Rider/1.0' } });
    if (!res.ok) return [];
    const body = await res.json().catch(() => null);
    const seen = new Set();
    return (Array.isArray(body?.items) ? body.items : [])
      .map(normalizeSuggestion).filter(Boolean)
      .filter((x) => { const k = `${x.lat.toFixed(6)},${x.lng.toFixed(6)}`; if (seen.has(k)) return false; seen.add(k); return true; })
      .slice(0, clamp(Number(limit) || 6, 1, 8));
  } catch {
    return [];
  } finally {
    clearTimeout(timer);
  }
  })();
  inflight.set(ck, work);
  try {
    const items = await work;
    cache.set(ck, { at: Date.now(), items });
    if (cache.size > 500) cache.delete(cache.keys().next().value);
    return items;
  } finally { inflight.delete(ck); }
}

module.exports = { searchPlaces, normalizeSuggestion };
