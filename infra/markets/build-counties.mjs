// Generates authoritative county boundary packages for one state or the entire U.S. — backend/markets.js loads every package
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
// Run: node infra/markets/build-counties.mjs [path-to-county.json] [STATE|ALL]\n// Default STATE is FL for backwards compatibility. ALL writes every state/territory package.
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
const data=JSON.parse(raw);
const jurisdictionPath=path.join(here,'..','..','backend','jurisdictions','us.json');
const jurisdictions=JSON.parse(fs.readFileSync(jurisdictionPath)).jurisdictions;
const requested=String(process.argv[3]||'FL').toUpperCase();
const targets=requested==='ALL'?jurisdictions:jurisdictions.filter(j=>j.code===requested);
if(!targets.length)throw new Error('Unknown U.S. jurisdiction '+requested);
for(const j of targets){
 const counties=data.features
  .filter(f=>f.properties.STATEFP===j.fips)
  .map(f=>({fips:f.properties.GEOID,name:f.properties.NAME,geometry:{type:f.geometry.type,coordinates:round(f.geometry.coordinates)}}))
  .sort((a,b)=>a.fips.localeCompare(b.fips));
 if(!counties.length){console.warn('no county-equivalent features for '+j.code);continue;}
 const out=path.join(here,'..','..','backend','markets',j.code.toLowerCase()+'-counties.json');
 fs.writeFileSync(out,JSON.stringify({source:'U.S. Census Bureau cb_2021_us_county_500k (1:500,000)',sourceSha256:sha,state:j.code,counties}));
 console.log('wrote '+counties.length+' county-equivalents for '+j.code+' to '+out);
}
