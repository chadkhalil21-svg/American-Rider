'use strict';
// Nonblocking release telemetry: official-source live CSV compatibility.
// Prints header fields and aggregate count only. Never log agency emails,
// policy numbers, individual names or business contacts.
const { downloadOfficialCsv,csvRows,parseOfficialBusinessCsv } =
  require('./florida-official-insurance-contacts');
(async()=>{
  const text=await downloadOfficialCsv();
  const header=csvRows(text).next().value;
  const count=parseOfficialBusinessCsv(text).matchedCount;
  console.log('FL DFS official valid-agency email CSV parsed; contacts=',count,
    'headers=',JSON.stringify(header));
})().catch(e=>{
  console.error('FL DFS registry NOT commissioned; cause=',String(e?.message||'unavailable').slice(0,100));
  process.exitCode=1;
});
