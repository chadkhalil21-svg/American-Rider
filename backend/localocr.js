// No metered AI call and no third-party OCR API: both WASM engine and English trained data
// are pinned in backend/package-lock.json. The source image stays in server memory/R2.
const fs = require('node:fs');
const path = require('node:path');
const { createWorker } = require('tesseract.js');
const language = require('@tesseract.js-data/eng');

const MAX_QUEUE = 8;
const MAX_MS = 45_000;
let worker = null;
let serial = Promise.resolve();
let queued = 0;
let idleTimer = null;
const localReady = () => fs.existsSync(path.join(language.langPath, 'eng.traineddata.gz'));

async function recognize(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length > 5 * 1024 * 1024) throw new Error('OCR input is missing or too large');
  if (!localReady()) throw new Error('Bundled OCR language data is unavailable');
  if (queued >= MAX_QUEUE) throw new Error('Document reader is busy; retry later');
  if (idleTimer) { clearTimeout(idleTimer); idleTimer = null; }
  queued++;
  const job = serial.then(async () => {
    let timer;
    try {
      if (!worker) worker = await createWorker('eng', 1, {
        langPath: language.langPath, gzip: true, cacheMethod: 'none',
      });
      const output = await Promise.race([
        worker.recognize(buffer),
        new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('Local OCR timed out')), MAX_MS); }),
      ]);
      return { text: String(output.data?.text || '').slice(0, 16_000),
        confidence: Number(output.data?.confidence) || 0 };
    } catch (e) {
      const old = worker; worker = null;
      if (old) old.terminate().catch(() => {});
      throw e;
    } finally { if (timer) clearTimeout(timer); }
  });
  serial = job.catch(() => {});
  return job.finally(() => {
    queued--;
    if (!queued && worker) {
      idleTimer = setTimeout(() => {
        if (!queued && worker) {
          const old = worker; worker = null;
          old.terminate().catch(() => {});
        }
        idleTimer = null;
      }, 1500);
    }
  });
}

function iso(raw) {
  const s = String(raw || '').trim();
  let y,m,d;
  if (/^\d{4}-\d{1,2}-\d{1,2}$/.test(s)) [y,m,d]=s.split('-').map(Number);
  else if (/^\d{1,2}[/.]\d{1,2}[/.]\d{4}$/.test(s)) [m,d,y]=s.split(/[/.]/).map(Number);
  else return '';
  const date = new Date(Date.UTC(y,m-1,d));
  return date.getUTCFullYear()===y && date.getUTCMonth()===m-1 && date.getUTCDate()===d
    ? `${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}` : '';
}

function extract({ kind, text, confidence }) {
  const content = String(text || '').replace(/\r/g,'').slice(0,16000);
  const upper = content.toUpperCase();
  const dates = [...upper.matchAll(/(?:EXP(?:IRATION|IRES|IRY)?|VALID\s+TO|EXPIRES\s+ON)\s*[:#.-]?\s*(\d{4}-\d{1,2}-\d{1,2}|\d{1,2}[/.]\d{1,2}[/.]\d{4})/g)]
    .map((m)=>iso(m[1])).filter(Boolean);
  const expiry = [...new Set(dates)].length===1 ? dates[0] : '';
  const name = upper.match(/(?:^|\n)\s*(?:NAME|NAMED INSURED)\s*[:#-]?\s*([A-Z][A-Z .,']{3,60})(?:\n|$)/)?.[1]?.trim() || '';
  const plate = upper.match(/(?:^|\n)\s*(?:PLATE|TAG|LICENSE PLATE)\s*[:#-]?\s*([A-Z0-9 -]{5,12})(?:\n|$)/)?.[1]?.trim() || '';
  const signs = { license:/DRIVER.?S?\s+LICEN[CS]E|DRIVER\s+LICENSE/, registration:/REGISTRATION/, inspection:/INSPECTION/, insurance:/INSURANCE|POLICY\s+DECLARATION/ };
  const identified = !!(signs[kind] && signs[kind].test(upper));
  const fields = { name, number:'', expiry, state:'', vehicle:'', vin:'', plate,
    commercialUse:kind==='insurance' ? 'unclear' : '', limits:'' };
  const concerns = [];
  if (Number(confidence) < 85 || content.trim().length < 35) concerns.push('Text extraction confidence is insufficient for automatic approval.');
  if (!expiry) concerns.push('Expiry could not be uniquely extracted from the image.');
  if (!identified) concerns.push('Document type could not be established from extracted text.');
  if (kind==='insurance') concerns.push('Policy terms, insured vehicle, status and limits require independent human/insurer verification.');
  return {
    documentType: identified ? kind : 'unidentified', isTheRequestedDocument: identified,
    legible: Number(confidence)>=85 && content.trim().length>=35,
    fields, insurance:null, concerns,
    summary: 'Local text extraction completed; a qualified person must review the original document.',
  };
}

module.exports = { recognize, extract, localReady, iso, MAX_QUEUE, MAX_MS };
