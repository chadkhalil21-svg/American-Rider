// Regenerates backend/markets/fl-counties.json — the county boundaries backend/markets.js uses
// to decide which market a pickup is in.
//
// SOURCE: U.S. Census Bureau cartographic boundary file cb_2021_us_county_500k (1:500,000), as
// GeoJSON, published by the Census Bureau in its own citysdk repository:
//   https://raw.githubusercontent.com/uscensusbureau/citysdk/master/v2/GeoJSON/500k/2021/county.json
// sha256 of the file used on 22 Sept 2026:
//   28f766d0c47085ffe911aae08dd544c480c3298bb141bf76c7e95fb1c241f315
// Cartographic boundaries follow the shoreline, so no point is given to a county it is not in.
// Coordinates are kept to 5 decimal places (about 1 metre).
//
// Run:  node infra/markets/build-counties.mjs [path-to-county.json]   (downloads when no path)
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const URL_500K = 'https://raw.githubusercontent.com/uscensusbureau/citysdk/master/v2/GeoJSON/500k/2021/county.json';
const EXPECT_SHA256 = '28f766d0c47085ffe911aae08dd544c480c3298bb141bf76c7e95fb1c241f315';

const here = path.dirname(fileURLToPath(import.meta.url));
const input = process.argv[2];
const raw = input ? fs.readFileSync(input) : Buffer.from(await (await fetch(URL_500K)).arrayBuffer());
const sha = crypto.createHash('sha256').update(raw).digest('hex');
if (sha !== EXPECT_SHA256) console.warn(`note: source sha256 ${sha} differs from the recorded one — review the diff before committing.`);

const round = (c) => (typeof c[0] === 'number' ? [+c[0].toFixed(5), +c[1].toFixed(5)] : c.map(round));
const counties = JSON.parse(raw)
  .features.filter((f) => f.properties.STATEFP === '12') // Florida
  .map((f) => ({ fips: f.properties.GEOID, name: f.properties.NAME, geometry: { type: f.geometry.type, coordinates: round(f.geometry.coordinates) } }))
  .sort((a, b) => a.fips.localeCompare(b.fips));

const out = path.join(here, '..', '..', 'backend', 'markets', 'fl-counties.json');
fs.writeFileSync(out, JSON.stringify({ source: 'U.S. Census Bureau cb_2021_us_county_500k (1:500,000)', sourceSha256: sha, state: 'FL', counties }));
console.log(`wrote ${counties.length} counties (${sha.slice(0, 12)}) to ${out}`);
