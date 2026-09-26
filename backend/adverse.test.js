const assert = require('node:assert');
const { selectAdverseItemIds, startProviderAdverseAction } = require('./adverse');

const R=[]; const check=(l,c,d='')=>R.push({l,ok:!!c,d});
let x=selectAdverseItemIds([
  {id:'a1',text:'Felony conviction'},
  {id:'a2',text:'Driving while license suspended'},
], ['Grand theft (felony), 2.0 years ago.']);
check('felony reason maps only to felony adverse item',x.ok&&x.ids.length===1&&x.ids[0]==='a1',JSON.stringify(x));

x=selectAdverseItemIds([{id:'a1',text:'County civil search'}],['Driving under the influence (misdemeanor), 2.0 years ago.']);
check('unrelated adverse item never substitutes for statutory reason',!x.ok&&x.ids.length===0,JSON.stringify(x));

(async()=>{
  const calls=[];
  const api=async(method,path,body)=>{
    calls.push({method,path,body});
    if(method==='GET') return {data:[{id:'dui1',text:'DUI conviction'}]};
    return {id:'aa_1',status:'pending'};
  };
  const now=Date.UTC(2026,8,25,12);
  const out=await startProviderAdverseAction({reportId:'r1',reasons:['DUI within 5 years'],api,now});
  check('mapped statutory result starts provider adverse action',out.ok&&out.actionId==='aa_1',JSON.stringify(out));
  const post=calls.find(c=>c.method==='POST');
  check('provider adverse action explicitly schedules a 7-day dispute interval',
    Date.parse(post.body.post_notice_scheduled_at)-now===7*24*60*60*1000,JSON.stringify(post));
  check('provider is given only mapped adverse item ids',
    JSON.stringify(post.body.adverse_item_ids)===JSON.stringify(['dui1']),JSON.stringify(post.body));
  for(const r of R) console.log(`${r.ok?'PASS':'FAIL'}  ${r.l}${r.ok?'':' — '+r.d}`);
  const bad=R.filter(r=>!r.ok); console.log(`\n${R.length-bad.length}/${R.length} passed`);
  assert.equal(bad.length,0);
})().catch(e=>{console.error(e);process.exit(1)});
