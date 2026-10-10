'use strict';
// Free, source-pinned Florida insurer/agency-contact recognition.
// This matches the EXACT agency email in Florida DFS's publicly published
// *valid business licences* register. Never infer policy status or coverage
// from an agency licence. Fail closed when official schema/data is unavailable.
const https = require('node:https');
const crypto = require('node:crypto');
const SOURCE = 'https://www.myfloridacfo.com/downloads/AAS/LicenseeSearch/AllValidLicensesBusiness.csv';
const MAX_BYTES = 42 * 1024 * 1024;
const SUCCESS_AGE_MS = 24 * 60 * 60 * 1000;
const FAILURE_RETRY_MS = 30 * 60 * 1000;
const emailRE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const normEmail = v => String(v || '').trim().toLowerCase();
const normHeader = v => String(v || '').replace(/^\uFEFF/, '').toLowerCase().replace(/[^a-z0-9]/g,'');
const columns = {
  email: ['email','emailaddress','businessemail','businesscontactemail','businessemailaddress','emailaddr','contactemail'],
  license: ['licensenum','licensenumber','licenseno','license','fllicensenumber','fllicenseno','licenseid'],
  type: ['licensetype','licensetypename','licensetitle','licensecategory','licensecategoryname','licenseclass'],
  business: ['agencyname','agencyfirmname','businessname','licenseename','firmname','entityname','fullbusinessname'],
  status: ['licensestatus','status','validity'],
};
// CSV parser is quote-aware (including commas/newlines inside quoted names),
// avoiding a paid parser dependency. An invalid source is never partly trusted.
function* csvRows(text) {
  let row=[], cell='', quoted=false, seenEnd=false;
  for (let i=0;i<text.length;i++) {
    const ch=text[i];
    if(ch==='"') {
      if(quoted && text[i+1]==='"') { cell+='"'; i++; }
      else if(quoted) quoted=false;
      else if(cell.length===0) quoted=true;
      else throw new Error('invalid_csv_quotes');
    } else if(ch===',' && !quoted) {
      row.push(cell); cell='';
    } else if((ch==='\n'||ch==='\r') && !quoted) {
      if(ch==='\r' && text[i+1]==='\n') i++;
      row.push(cell);
      if(row.some(v=>v.trim())) yield row;
      row=[];cell='';seenEnd=true;
    } else {
      cell+=ch;seenEnd=false;
      if(cell.length>8192)throw new Error('csv_cell_too_large');
    }
  }
  if(quoted)throw new Error('unclosed_csv_quote');
  if(cell||row.length) {row.push(cell); if(row.some(v=>v.trim())) yield row;}
  if(!seenEnd && text.length===0)throw new Error('empty_registry');
}
function findCol(headers, keys) {
  const index=headers.findIndex(v => keys.includes(normHeader(v)));
  return index;
}
function parseOfficialBusinessCsv(text,{minimumContacts=500}={}) {
  if(typeof text!=='string' || !text.length || Buffer.byteLength(text,'utf8')>MAX_BYTES)
    throw new Error('official_registry_size_unavailable');
  const rows=csvRows(text);
  const h=rows.next().value;
  if(!h || h.length<3 || h.length>100) throw new Error('official_registry_header_unavailable');
  const ix=Object.fromEntries(Object.entries(columns).map(([k,names])=>[k,findCol(h,names)]));
  if(['email','license','type','business'].some(k=>ix[k]<0))
    throw new Error('official_registry_schema_unrecognized');
  const matched=new Map();
  let validRows=0;
  for(const row of rows) {
    if(row.length!==h.length)throw new Error('official_registry_row_shape_changed');
    const email=normEmail(row[ix.email]);
    const licence=String(row[ix.license]||'').trim();
    const licenseType=String(row[ix.type]||'').trim().toUpperCase();
    const business=String(row[ix.business]||'').trim();
    const status=ix.status>=0?String(row[ix.status]||'').trim().toUpperCase():'VALID';
    if(!emailRE.test(email)||email.length>254||!licence||!business||business.length>200)
      continue;
    if(!['VALID','ACTIVE','CURRENT',''].includes(status))continue;
    if(!/(AGENCY|GENERAL LINES|PROPERTY|CASUALTY|SURPLUS LINES)/.test(licenseType))continue;
    if(/(LIFE ONLY|HEALTH ONLY|TITLE ONLY|ADJUST)/.test(licenseType))continue;
    validRows++;
    const hash=crypto.createHash('sha256').update(email).digest('hex');
    matched.set(hash,{licence:licence.slice(0,60),business:business.slice(0,200)});
    if(validRows>500000)throw new Error('official_registry_unexpected_row_count');
  }
  if(matched.size<minimumContacts)throw new Error('official_registry_insufficient_agency_contacts');
  return { contacts:matched, matchedCount:matched.size, validRows };
}
async function downloadOfficialCsv(url=SOURCE) {
  // Fixed, literal state-government host and path: no arbitrary URL/redirect,
  // no user input, no SSRF, no file uploads, no provider secrets.
  if(url!==SOURCE)throw new Error('unapproved_official_registry_url');
  return new Promise((resolve,reject)=>{
    let finished=false, bytes=0;
    const stop=(err,value)=>{if(finished)return;finished=true;err?reject(err):resolve(value);};
    const req=https.get(url,{timeout:20000,headers:{'accept':'text/csv,application/octet-stream','user-agent':'AmericanRider-LicenceValidation/1.0'}},res=>{
      if(res.statusCode!==200){res.resume();return stop(new Error('official_registry_http_'+res.statusCode));}
      const parts=[];
      res.on('data',buf=>{
        bytes+=buf.length;
        if(bytes>MAX_BYTES){req.destroy(new Error('official_registry_too_large'));return;}
        parts.push(buf);
      });
      res.on('end',()=>stop(null,Buffer.concat(parts).toString('utf8')));
      res.on('error',stop);
    });
    req.on('timeout',()=>req.destroy(new Error('official_registry_timeout')));
    req.on('error',stop);
  });
}
// Cache per Node process, refresh at most daily and coalesce concurrent lookups.
// Missing/partial data NEVER supplies trust; transient failure backs off.
function createOfficialContactRecognizer({load=downloadOfficialCsv,now=Date.now,minContacts=500}={}) {
  let snapshot=null,attemptAt=0,pending=null;
  async function lookup(email) {
    const key=normEmail(email);
    if(!emailRE.test(key) || key.length>254)return {recognized:false,reason:'invalid_email'};
    const at=now();
    if(!snapshot || at-snapshot.fetchedAt>=SUCCESS_AGE_MS) {
      if(!pending && (!attemptAt || at-attemptAt>=FAILURE_RETRY_MS)) {
        attemptAt=at;
        pending=(async()=>{
          try {
            const text=await load();
            const parsed=parseOfficialBusinessCsv(text,{minimumContacts:minContacts});
            snapshot={...parsed,fetchedAt:at,
              sha256:crypto.createHash('sha256').update(text).digest('hex')};
          } catch {
            snapshot=null; // Stale data must never renew insurance.
          } finally {pending=null;}
        })();
      }
      if(pending)await pending;
    }
    if(!snapshot || now()-snapshot.fetchedAt>=SUCCESS_AGE_MS)
      return {recognized:false,reason:'official_registry_unavailable'};
    const found=snapshot.contacts.get(crypto.createHash('sha256').update(key).digest('hex'));
    return found?{recognized:true,email:key,source:'FL_DFS_VALID_BUSINESS_LICENSES',
      sourceHash:snapshot.sha256,fetchedAt:snapshot.fetchedAt,
      licence:found.licence,business:found.business
    }:{recognized:false,reason:'email_not_in_official_valid_agency_register'};
  }
  return {lookup,stats:()=>({active:!!snapshot,entries:snapshot?.matchedCount||0,
    fetchedAt:snapshot?.fetchedAt||null,attemptAt})};
}
const recognizer=createOfficialContactRecognizer();
module.exports={ SOURCE,csvRows,parseOfficialBusinessCsv,createOfficialContactRecognizer,
  lookupOfficialAgencyEmail: recognizer.lookup, officialRegistryStats:recognizer.stats };
