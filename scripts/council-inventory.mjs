import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { extname, dirname } from 'node:path';

const sha = execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
const files = execFileSync('git',['ls-files','-z'],{encoding:'utf8'}).split('\0').filter(Boolean);
const routeRe = /^app\/.*\.(?:tsx|ts|jsx|js)$/;
const sourceRe = /\.(?:tsx|ts|jsx?|mjs|cjs)$/;
const testRe = /(?:test|spec)\.(?:tsx?|jsx?|mjs|cjs)$/;
const binary = new Set(['.png','.jpg','.jpeg','.gif','.webp','.ico','.pdf','.zip']);
const controlsRe = /<(Pressable|TouchableOpacity|TouchableHighlight|TouchableWithoutFeedback|Button|Link|TextInput|Switch)\b/g;
const expressRe = /\bapp\.(get|post|put|patch|delete|use)\(\s*(['"`])([^'"`]+)\2/g;
const routerRe = /\b(?:router|navigation)\.(push|replace|navigate)\(\s*(['"`])([^'"`]+)\2/g;
const tRe = /\bt\(\s*(['"`])([^'"`]+)\1/g;
const scheduleRe = /\b(sweep[A-Z]\w*|setInterval|setTimeout)\b/g;

const entries=[], controls=[], endpoints=[], navigation=[], translationKeys=[], jobs=[];
for (const path of files) {
  const ext=extname(path).toLowerCase();
  const disposition=binary.has(ext)?'BINARY_ASSET':'REVIEW_REQUIRED';
  const buf=readFileSync(path); const bytes=buf.length;
    if (sourceRe.test(path) && !binary.has(ext)) {
      const text=buf.toString('utf8');
      const collect=(re,fn)=>{let m; while((m=re.exec(text))) fn(m,text.slice(0,m.index).split('\n').length); re.lastIndex=0;};
      collect(controlsRe,(m,line)=>controls.push({path,line,kind:m[1],status:'UNCLASSIFIED'}));
      collect(expressRe,(m,line)=>endpoints.push({path,line,method:m[1].toUpperCase(),route:m[3],status:'UNCLASSIFIED'}));
      collect(routerRe,(m,line)=>navigation.push({path,line,action:m[1],target:m[3],status:'UNCLASSIFIED'}));
      collect(tRe,(m,line)=>translationKeys.push({path,line,key:m[2],status:'UNCLASSIFIED'}));
      if(path.startsWith('backend/')) collect(scheduleRe,(m,line)=>jobs.push({path,line,symbol:m[1],status:'UNCLASSIFIED'}));
    }
  entries.push({path,bytes,extension:ext||null,route:routeRe.test(path),test:testRe.test(path),disposition});
}
const routes=entries.filter(x=>x.route).map(x=>({path:x.path,status:'UNCLASSIFIED'}));
const uniq=(xs,key)=>[...new Map(xs.map(x=>[key(x),x])).values()];
const uniqueEndpoints=uniq(endpoints,x=>x.method+' '+x.route+' '+x.path+':'+x.line);
const uniqueNav=uniq(navigation,x=>x.path+':'+x.line+':'+x.target);
const uniqueKeys=uniq(translationKeys,x=>x.key);
const uniqueJobs=uniq(jobs,x=>x.path+':'+x.line+':'+x.symbol);
const report={schemaVersion:'0.2',candidateSha:sha,generatedAt:new Date().toISOString(),
 counts:{trackedBlobs:entries.length,routes:routes.length,controlsDiscoveredStatically:controls.length,backendEndpointRegistrations:uniqueEndpoints.length,navigationTargets:uniqueNav.length,translationKeysReferenced:uniqueKeys.length,backendJobSymbols:uniqueJobs.length,reviewRequired:entries.filter(x=>x.disposition==='REVIEW_REQUIRED').length,binaryAssets:entries.filter(x=>x.disposition==='BINARY_ASSET').length},
 files:entries,routes,controls,endpoints:uniqueEndpoints,navigation:uniqueNav,translationKeys:uniqueKeys,jobs:uniqueJobs,
 limitations:[
 'Static inventories establish denominators and reconciliation targets; they do not prove runtime behavior.',
 'Wrapper-created controls, dynamic routes, conditional states, native-only surfaces, backend HTML, and indirect render functions require semantic/runtime reconciliation.',
 'A route file is not equivalent to a reachable screen state. Runtime state inventory is separately required.',
 'Translation-key references do not by themselves enumerate literals or server-generated user-visible prose; existing i18n gates and language review remain required.',
 'Endpoint registration does not prove authentication, authorization, persistence, provider behavior, or client handling.',
 'External legal/regulatory/design/security requirements require dated primary-source research.'
 ]};
const output = process.argv[2] || 'artifacts/council/inventory.json';
mkdirSync(dirname(output),{recursive:true});
writeFileSync(output,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report.counts,null,2));
