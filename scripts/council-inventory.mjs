import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { extname } from 'node:path';

const sha = execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
const files = execFileSync('git',['ls-files','-z'],{encoding:'utf8'}).split('\0').filter(Boolean);
const routeRe = /^app\/.*\.(?:tsx|ts|jsx|js)$/;
const sourceRe = /\.(?:tsx|ts|jsx|js|mjs|cjs)$/;
const testRe = /(?:test|spec)\.(?:tsx?|jsx?|mjs|cjs)$/;
const binary = new Set(['.png','.jpg','.jpeg','.gif','.webp','.ico','.pdf','.zip']);
const controlPatterns = [
  ['Pressable',/<Pressable\b/g],['Touchable',/<Touchable(?:Opacity|Highlight|WithoutFeedback)?\b/g],
  ['Button',/<Button\b/g],['Link',/<Link\b/g],['TextInput',/<TextInput\b/g],
  ['Switch',/<Switch\b/g]
];
const entries=[]; const controls=[];
for (const path of files) {
  const ext=extname(path).toLowerCase();
  let disposition=binary.has(ext)?'BINARY_ASSET':'REVIEW_REQUIRED';
  let bytes=0;
  try {
    const buf=readFileSync(path); bytes=buf.length;
    if (sourceRe.test(path) && !binary.has(ext)) {
      const text=buf.toString('utf8');
      for (const [kind,re] of controlPatterns) {
        let m; while((m=re.exec(text))) {
          const line=text.slice(0,m.index).split('\n').length;
          controls.push({path,line,kind,status:'UNCLASSIFIED'});
        }
      }
    }
  } catch {}
  entries.push({path,bytes,extension:ext||null,route:routeRe.test(path),test:testRe.test(path),disposition});
}
const routes=entries.filter(x=>x.route).map(x=>({path:x.path,status:'UNCLASSIFIED'}));
const report={schemaVersion:'0.1',candidateSha:sha,generatedAt:new Date().toISOString(),counts:{trackedBlobs:entries.length,routes:routes.length,controlsDiscoveredStatically:controls.length,reviewRequired:entries.filter(x=>x.disposition==='REVIEW_REQUIRED').length,binaryAssets:entries.filter(x=>x.disposition==='BINARY_ASSET').length},files:entries,routes,controls,limitations:[
'Static control discovery is a denominator seed, not runtime proof.',
'Controls created through wrappers, arrays, conditionals, native components, web documents, or indirect render functions require runtime and semantic reconciliation.',
'Runtime screen states, backend endpoints, jobs, callbacks, strings, and external requirements require separate inventories.'
]};
mkdirSync('artifacts/council',{recursive:true});
writeFileSync('artifacts/council/inventory.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report.counts,null,2));
