// Regenerates backend/markets/fl-counties.json — the county boundaries backend/markets.js uses
// to decide which market a pickup is in.
//
// SOURCE: us-atlas@3.0.1 counties-10m.json (U.S. Census Bureau cartographic county boundaries,
// 2017, simplified to 1:10,000,000). Coastlines are simplified: backend/markets.js snaps a point
// within SNAP_KM of a county to it, which covers beaches and barrier islands. County-to-county
// lines can be off by several hundred metres. For exact lines, replace the input with the
// Census 1:500,000 file (cb_<year>_us_county_500k) converted to GeoJSON; the output shape is
// the same.
//
// Run:  npm i --no-save us-atlas@3.0.1 topojson-client@3.1.0 && node infra/markets/build-counties.mjs
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const topo = require('us-atlas/counties-10m.json');
const { feature } = require('topojson-client');

const round = (c) => (typeof c[0] === 'number' ? [+c[0].toFixed(5), +c[1].toFixed(5)] : c.map(round));
const counties = feature(topo, topo.objects.counties)
  .features.filter((f) => String(f.id).startsWith('12')) // Florida's FIPS state code
  .map((f) => ({ fips: String(f.id), name: f.properties.name, geometry: { type: f.geometry.type, coordinates: round(f.geometry.coordinates) } }))
  .sort((a, b) => a.fips.localeCompare(b.fips));

const out = path.join(path.dirname(new URL(import.meta.url).pathname), '..', '..', 'backend', 'markets', 'fl-counties.json');
fs.writeFileSync(out, JSON.stringify({ source: 'us-atlas@3.0.1 counties-10m (Census cartographic boundaries 2017)', state: 'FL', counties }));
console.log(`wrote ${counties.length} counties to ${out}`);
