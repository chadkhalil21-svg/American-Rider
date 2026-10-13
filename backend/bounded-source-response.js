'use strict';
// Enforce a hard decoded-response byte ceiling WHILE reading a supplier stream.
// Checking Content-Length or Buffer.byteLength(await response.text()) alone is
// insufficient: remote servers can omit/misstate Content-Length.
async function boundedSourceText(response,{maxBytes,label='source'}={}){
  if(!Number.isSafeInteger(maxBytes)||maxBytes<1||maxBytes>1_000_000)
    throw new RangeError('invalid bounded source maximum');
  const header=response?.headers?.get?.('content-length');
  if(header!=null && /^\d+$/.test(String(header).trim()) &&
     Number(header)>maxBytes) throw Error(label+' oversized');
  const reader=response?.body?.getReader?.();
  if(!reader) throw Error(label+' body stream unavailable');
  const chunks=[];
  let total=0,done=false;
  try{
    while(true){
      const part=await reader.read();
      if(part.done){done=true;break;}
      if(!(part.value instanceof Uint8Array))
        throw Error(label+' invalid response chunk');
      total+=part.value.byteLength;
      if(total>maxBytes) throw Error(label+' oversized');
      chunks.push(Buffer.from(part.value));
    }
    return Buffer.concat(chunks,total).toString('utf8');
  }finally{
    // Abort oversized/broken remote streams rather than continuing transfer.
    if(!done){try{await reader.cancel();}catch{}}
    reader.releaseLock();
  }
}
module.exports={boundedSourceText};
