const { page } = require('./shell');
const esc=(s)=>String(s??'').replace(/[&<>"']/g,(c)=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const date=(ms)=>Number.isFinite(Number(ms))&&Number(ms)>0&&Number(ms)<8.64e15?new Date(Number(ms)).toISOString().slice(0,16).replace('T',' ')+' UTC':'Not recorded';
const money=(c)=>c!=null&&Number.isInteger(Number(c))&&Number(c)>=0?`$${(Number(c)/100).toFixed(2)}`:'Not recorded';
function disputePage(packets,{next=null}={}) {
 const cards=packets.map((p)=>{
  const t=p.travel||{};
  const due=Number(p.evidenceDueAt||0);
  const urgency=due>0&&due-Date.now()<3*86_400_000?' time-sensitive':'';
  const fact=(label,value)=>`<div><dt>${esc(label)}</dt><dd>${esc(value)}</dd></div>`;
  const timeline={createdAt:'Travel requested',paidAt:'Payment confirmed',offeredAt:'Operator offered',
    acceptedAt:'Operator accepted',arrivedAt:'Pickup arrival',onboardAt:'Traveler aboard',
    completedAt:'Travel completed',cancelledAt:'Travel cancelled',settledAt:'Operator settlement'};
  const timelineFacts=Object.entries(timeline).filter(([k])=>t[k]).map(([k,label])=>fact(label,date(t[k]))).join('');
  return `<article><h2>Dispute ${esc(p.disputeId)}</h2>
    <p class="due${urgency}">Evidence due: ${esc(date(p.evidenceDueAt))}</p>
    <p><strong>${esc(t.tripNo||'Travel not matched')}</strong> · ${esc(t.status||'Review required')} · ${esc(money(p.amountCents))} ${esc((p.currency||'usd').toUpperCase())}</p>
    <p>${esc(t.pickup||'Pickup not recorded')} → ${esc(t.destination||'Destination not recorded')}</p>
    <details><summary>Review captured facts</summary><dl>
      ${fact('Reason',p.reason||'Not stated')}${fact('Stripe payment reference',p.paymentIntentId||'Not recorded')}
      ${fact('Travel record',t.travelId||'Not matched')}${fact('Quoted amount',money(t.quotedCents))}
      ${fact('Travel fare',money(t.travelFareCents))}${fact('Platform fee',money(t.platformFeeCents))}
      ${fact('Tolls',money(t.tollCents))}${fact('Government charges',money(t.governmentFeeCents))}
      ${fact('Refund pending',t.refundPending?'Yes':'No')}${fact('Refund reference',t.refundId||'Not recorded')}
      ${fact('Operator transfer',t.transferId||'Not recorded')}${timelineFacts}
      ${fact('Evidence snapshot',date(p.capturedAt))}${fact('Packet SHA-256',p.sha256||'Not recorded')}
    </dl></details></article>`;
 }).join('');
 const more=next?`<p><a href="/ops/disputes?after=${encodeURIComponent(next)}">Older disputes →</a></p>`:'';
 return page('Stripe dispute evidence · Operations',`<style>
 article {border-top:1px solid var(--hairline);padding:18px 0;overflow-wrap:anywhere;}
 article h2{margin:0 0 9px;font-size:19px;}
 article p{margin:7px 0;line-height:1.5;}
 .due{font-weight:600;}.due.time-sensitive{color:#9B3030;}
 article details{margin-top:12px;}article summary{min-height:44px;display:flex;align-items:center;cursor:pointer;color:var(--blue);font-weight:600;}
 article dl{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,240px),1fr));gap:10px 16px;}
 article dt{color:var(--muted);font-size:13px;}article dd{margin:3px 0 0;font-weight:600;}
 </style><h1>Stripe dispute evidence</h1>
 <p class="lede"><a href="/ops">← Operations</a> · Internal review only. These captured facts have <strong>not</strong> been submitted to Stripe.</p>
 <p>Check Stripe's actual deadline and the original Travel record. Resolve omissions, privacy and legal requirements before a human decides what to submit. Capture is create-only; a later Travel correction does not rewrite this packet.</p>
 ${cards||'<p>No captured disputes in this page.</p>'}${more}`, '');
}
module.exports={disputePage};
