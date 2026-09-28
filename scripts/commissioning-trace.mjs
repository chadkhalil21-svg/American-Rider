import fs from "node:fs";
const required=[["economics authority","backend/economics.js",/MIN_PLATFORM_FEE_CENTS\s*=\s*200/],["server authority","backend/server.js",/operator\/online|travel\/dispatch|create-payment-intent/],["qualification authority","backend/qualification.js",/qualif/i],["screening authority","backend/screening.js",/screen/i],["insurance jurisdiction authority","backend/insurance-jurisdictions.js",/Florida|jurisdiction/i],["payment authority","backend/payments.js",/transfer|payment/i],["Smart Travel authority","backend/smart.js",/smart|journey/i],["Family authority","backend/family.js",/family|guardian|teen/i],["Firestore rules","firestore.rules",/match|allow/],["release evidence verifier","scripts/verify-release-evidence.mjs",/candidateSha|gates/]];
let failed=false;
console.log("American Rider — deterministic commissioning trace");
console.log("SIMULATION/PREFLIGHT ONLY: not physical-device or production-provider evidence.\n");
for(const [label,file,pattern] of required){if(!fs.existsSync(file)){console.error(`FAIL  ${label}: missing ${file}`);failed=true;continue;}const body=fs.readFileSync(file,"utf8");if(!pattern.test(body)){console.error(`FAIL  ${label}: authority marker absent in ${file}`);failed=true;}else console.log(`PASS  ${label} -> ${file}`);}
const app=JSON.parse(fs.readFileSync("app.json","utf8")).expo;
for(const [platform,id] of [["iOS",app.ios?.bundleIdentifier],["Android",app.android?.package]]){if(id!=="com.americanrider.app"){console.error(`FAIL  ${platform} identity: ${id??"missing"}`);failed=true;}else console.log(`PASS  ${platform} identity -> ${id}`);}
console.log("\nOperator trace: account -> market -> documents -> authoritative screening -> insurance/disclosure -> payout readiness -> duty -> assignment -> accept -> Travel progression -> settlement.");
console.log("Traveler trace: account -> quote -> party -> dispatch -> payment -> assignment -> Travel -> cancellation/recovery -> completion -> receipt/support.");
console.log("Invariant: client presentation never substitutes for server/provider authority; missing or stale authority fails closed.");
console.log("External boundary: signed physical devices, production providers, live money movement and store distribution remain separately evidenced.");
if(failed)process.exit(1);console.log("\nCOMMISSIONING TRACE: PASS\n");
