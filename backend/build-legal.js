#!/usr/bin/env node
// Export the Terms and Privacy pages as static HTML for always-on hosting.
//
// WHY THIS EXISTS: the app links to /terms and /privacy, and App Store Connect requires a
// working Privacy Policy URL in the listing. Those pages were served only by the Render
// backend, which is on the free tier and sleeps after ~15 minutes idle — an App Review
// engineer clicking the link gets a ~50-second cold start or a timeout, which is a
// rejection risk on a link Apple is guaranteed to open.
//
// backend/legal.js stays the single source of the wording. This writes the same HTML out
// as flat files so it can also be served from somewhere that never sleeps. Re-run it after
// ANY edit to legal.js, or the two copies drift:
//
//   node backend/build-legal.js
//
// Output goes to legal/ (gitignored from Pages' perspective — it is generated, not authored).
const fs = require('fs');
const path = require('path');
const { TERMS_HTML, PRIVACY_HTML, ABOUT_HTML } = require('./legal');
const {
  HOME_HTML, OPERATE_HTML, SUPPORT_HTML, TRAVEL_HTML, SAFETY_HTML, SMART_HTML,
} = require('./site');

const OUT = path.join(__dirname, '..', 'legal');

// Directory-per-route so the hosts serve clean URLs (/terms, not /terms.html).
const PAGES = [
  { dir: 'terms', html: TERMS_HTML },
  { dir: 'privacy', html: PRIVACY_HTML },
  { dir: 'about', html: ABOUT_HTML },
  { dir: 'travel', html: TRAVEL_HTML },
  { dir: 'operate', html: OPERATE_HTML },
  { dir: 'safety', html: SAFETY_HTML },
  { dir: 'smart-travel', html: SMART_HTML },
  { dir: 'support', html: SUPPORT_HTML },
];

// A plain index so the bare domain is not a 404 if anyone visits it.
const INDEX = HOME_HTML;

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(path.join(OUT, 'index.html'), INDEX);

for (const { dir, html } of PAGES) {
  fs.mkdirSync(path.join(OUT, dir), { recursive: true });
  fs.writeFileSync(path.join(OUT, dir, 'index.html'), html);
  console.log(`  legal/${dir}/index.html  ${html.length} bytes`);
}
console.log(`  legal/index.html          ${INDEX.length} bytes`);
console.log('\nDeploy:  npx wrangler pages deploy legal --project-name american-rider-legal');
