const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const { recognize, extract, localReady, iso }=require('./localocr');
const { readDocument, documentsReady, READER_VERSION }=require('./documents');
(async()=>{
  assert.equal(localReady(),true,'bundled trained data must exist locally');
  assert.equal(documentsReady(),true);
  assert.equal(iso('02/30/2030'),'','invalid calendar date');
  const fixture=fs.readFileSync(path.join(__dirname,'fixtures/synthetic-license.png'));
  const actual=await recognize(fixture);
  assert(actual.confidence>=80,`unexpected synthetic OCR confidence ${actual.confidence}`);
  const fields=extract({kind:'license',...actual});
  assert.equal(fields.fields.expiry,'2030-12-31');
  assert.equal(fields.isTheRequestedDocument,true);
  const fetchBefore=global.fetch;
  try {
    global.fetch=async()=>new globalThis.Response(fixture,{status:200,headers:{'content-type':'image/png'}});
    const output=await readDocument({ kind:'license',imageUrl:'https://private.example/signed',
      expect:{name:'Alex Morgan'},ocr:async()=>actual });
    assert.equal(output.ok,true);assert.equal(output.verdict,'review','OCR is not document approval');
    assert.equal(output.expiry,'2030-12-31');
    assert.equal(output.readerVersion,READER_VERSION);
    assert(output.reasons.some((r)=>/qualified person/.test(r)));
    const unavailable=await readDocument({kind:'license',imageUrl:'https://private.example/signed',
      ocr:async()=>{throw Error('model unavailable');}});
    assert.equal(unavailable.verdict,'review');
    global.fetch=async()=>new globalThis.Response(Buffer.from('not an image'),{status:200});
    const invalid=await readDocument({kind:'insurance',imageUrl:'https://private.example/signed'});
    assert.equal(invalid.verdict,'review','unsupported images never pass');
  } finally {global.fetch=fetchBefore;}
  console.log('PASS bundled local OCR, deterministic expiry, human-only review and unavailable/unsupported fallback');
})().catch((e)=>{console.error(e);process.exitCode=1;});
