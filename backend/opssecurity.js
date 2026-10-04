const crypto=require('node:crypto');
const SESSION_MS=12*60*60*1000;
const STEP_MS=30_000;
function base32(s){
  const alphabet='ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';let bits=0,value=0,out=[];
  for(const ch of String(s||'').toUpperCase().replace(/\s|=/g,'')){
    const n=alphabet.indexOf(ch);if(n<0)return null;
    value=(value<<5)|n;bits+=5;
    if(bits>=8){bits-=8;out.push((value>>>bits)&255);}
  }
  return out.length>=20?Buffer.from(out):null;
}
function codeFor(secret,step){
  const key=base32(secret);if(!key||!Number.isSafeInteger(step)||step<0)return null;
  const msg=Buffer.alloc(8);msg.writeBigUInt64BE(BigInt(step));
  const h=crypto.createHmac('sha1',key).update(msg).digest();
  const off=h[h.length-1]&15;
  return String((h.readUInt32BE(off)&0x7fffffff)%1_000_000).padStart(6,'0');
}
function totpStep(secret,submitted,now=Date.now()){
  if(!/^\d{6}$/.test(String(submitted||'')))return null;
  const current=Math.floor(now/STEP_MS);
  for(const step of [current,current-1]){
    const expected=codeFor(secret,step);
    if(expected && crypto.timingSafeEqual(Buffer.from(expected),Buffer.from(submitted)))return step;
  }
  return null;
}
function sessionFor(acct,secret,now=Date.now()){
  if(!secret||secret.length<32||!/^[A-Za-z0-9_-]{1,40}$/.test(acct.name))return null;
  const nonce=crypto.randomBytes(16).toString('hex');
  const body=`${acct.name}.${now}.${nonce}`;
  const sig=crypto.createHmac('sha256',secret).update(`${body}:${acct.pw}`).digest('hex');
  return `${body}.${sig}`;
}
function verifySession(value,acct,secret,now=Date.now()){
  if(!secret||secret.length<32)return false;
  const parts=String(value||'').split('.');if(parts.length!==4||parts[0]!==acct.name)return false;
  const issued=Number(parts[1]);
  if(!Number.isSafeInteger(issued)||issued>now||now-issued>SESSION_MS||!/^[0-9a-f]{32}$/.test(parts[2])||!/^[0-9a-f]{64}$/.test(parts[3]))return false;
  const body=parts.slice(0,3).join('.');
  const expected=crypto.createHmac('sha256',secret).update(`${body}:${acct.pw}`).digest('hex');
  return crypto.timingSafeEqual(Buffer.from(expected),Buffer.from(parts[3]));
}
module.exports={codeFor,totpStep,sessionFor,verifySession,SESSION_MS,STEP_MS};
