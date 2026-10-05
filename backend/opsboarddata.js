// The Founder's exception console never downloads all historic Travels just to render one page.
// A saturated sample is labelled as such; it is not a national count or financial ledger.
const LIMITS=Object.freeze({underway:75,recent:120,operators:75,scheduled:30,
  cases:50,pending:50,owed:50,disputed:50,attention:50,noReceipt:50});
const UNDERWAY=['assigned','accepted','arrived','onboard'];
async function loadOpsBoard(db,dayAgo) {
 if(!db)throw new Error('Firestore required for Operations board');
 const rides=db.collection('rides');
 const [underway,recent,operators,scheduled,cases,pending,owed,disputed,attention,noReceipt]=await Promise.all([
  rides.where('status','in',UNDERWAY).limit(LIMITS.underway).get(),
  rides.where('createdAt','>',dayAgo).orderBy('createdAt','desc').limit(LIMITS.recent).get(),
  db.collection('operators').where('available','==',true).limit(LIMITS.operators).get(),
  db.collection('scheduled_rides').where('status','==','reserved').orderBy('atMs','asc').limit(LIMITS.scheduled).get(),
  db.collection('support_tickets').where('status','==','open').orderBy('createdAt','desc').limit(LIMITS.cases).get(),
  db.collection('users').where('qualification.status','in',['exception','refused','suspended']).limit(LIMITS.pending).get(),
  rides.where('payoutPending','==',true).limit(LIMITS.owed).get(),
  rides.where('disputed','==',true).limit(LIMITS.disputed).get(),
  rides.where('monitor.state','in',['emergency','escalated']).limit(LIMITS.attention).get(),
  rides.where('receiptFailed','==',true).limit(LIMITS.noReceipt).get(),
 ]);
 const groups={underway,recent,operators,scheduled,cases,pending,owed,disputed,attention,noReceipt};
 return Object.fromEntries(Object.entries(groups).map(([k,v])=>[k,{
  rows:v.docs.map((d)=>({id:d.id,...d.data()})),saturated:v.docs.length>=LIMITS[k],limit:LIMITS[k],
 }]));
}
module.exports={LIMITS,UNDERWAY,loadOpsBoard};
