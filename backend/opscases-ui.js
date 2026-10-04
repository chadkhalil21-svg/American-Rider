const {page}=require('./shell');
const esc=(s)=>String(s??'').replace(/[&<>"']/g,(c)=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const date=(ms)=>Number.isFinite(Number(ms))&&Number(ms)>0&&Number(ms)<8.64e15?
 new Date(Number(ms)).toISOString().slice(0,16).replace('T',' ')+' UTC':'Not recorded';
function casesPage({cases,next},kind='emergency') {
 const active=kind==='support'?'support':'emergency';
 const cards=cases.map((c)=>{
  const financial=c.reason==='Payment disputed';
  const type=financial?'PAYMENT DEADLINE':c.kind==='emergency'?'SAFETY EMERGENCY':'SUPPORT';
  return `<article><h2>${esc(type)} · ${esc(c.caseNo||c.id)}</h2>
   ${c.kind==='emergency'&&!financial?'<p role="alert"><strong>Immediate danger:</strong> contact emergency services and the staffed safety responder. Recording acknowledgement here does not dispatch help.</p>':''}
   <p class="muted">Filed ${esc(date(c.createdAt))} · ${esc(c.trip?.no||c.trip||'No Travel number')}</p>
   <p><strong>${esc(c.reason||'Review needed')}</strong></p>
   <p>${c.acknowledgedAt?`Acknowledged ${esc(date(c.acknowledgedAt))} by ${esc(c.acknowledgedBy||'Operations')}`:'Not yet acknowledged by a person'}</p>
   <details><summary>Read case details</summary><p class="description">${esc(c.description||'No additional details recorded')}</p></details>
   <form class="case-action" data-id="${esc(c.id)}" data-action="${c.acknowledgedAt?'close':'acknowledge'}">
     <label>${c.acknowledgedAt?'Reason for closing this case':'Acknowledgement and next step'}
       <textarea name="note" minlength="12" maxlength="500" required placeholder="Record the action you took or the next step."></textarea>
     </label>
     <button type="submit">${c.acknowledgedAt?'Close after resolution':'Acknowledge and take responsibility'}</button>
   </form></article>`;
 }).join('');
 const more=next?`<p><a href="/ops/cases?kind=${encodeURIComponent(active)}&after=${encodeURIComponent(next)}">Older open cases →</a></p>`:'';
 return page('Case exceptions · Operations',`<style>
 article {border-top:1px solid var(--hairline);padding:18px 0;overflow-wrap:anywhere;}
 article h2{font-size:19px;margin:0 0 12px;}article .muted{color:var(--muted);}
 article summary{cursor:pointer;display:flex;align-items:center;min-height:44px;color:var(--blue);font-weight:600;}
 article .description{white-space:pre-wrap;line-height:1.5;}
 article label{font-size:14px;font-weight:600;display:block;}
 article textarea{width:100%;box-sizing:border-box;min-height:86px;padding:12px;border:1px solid var(--border);border-radius:10px;margin:8px 0;font:16px Arial,sans-serif;}
 article button{display:block;min-height:46px;padding:10px 14px;border:1px solid var(--blue);border-radius:11px;color:#fff;background:var(--blue);font-size:15px;cursor:pointer;}
 article button:disabled{background:#eee;border-color:#bbb;color:#777;}
 article button:focus-visible,article textarea:focus-visible,article summary:focus-visible{outline:3px solid var(--blue);outline-offset:2px;}
 #action-result:not(:empty){border:1px solid var(--blue-border);padding:12px;border-radius:10px;}
 </style><h1>Open cases</h1>
 <p class="lede"><a href="/ops">← Operations</a> · <a href="/ops/cases?kind=emergency">Urgent and deadline cases</a> · <a href="/ops/cases?kind=support">Support cases</a></p>
 <p>Oldest open cases first. A stored case or delivered alert does not mean a person answered. This page shows up to 40 at a time; move to the next page until the queue is clear.</p>
 <p id="action-result" role="status" aria-live="polite"></p>
 ${cards||'<p>No open cases in this queue.</p>'}${more}
 <script>
 document.querySelectorAll('form.case-action').forEach(form=>form.addEventListener('submit',async(e)=>{
  e.preventDefault();const note=form.querySelector('textarea').value.trim();if(note.length<12)return;
  const button=form.querySelector('button');const status=document.getElementById('action-result');
  if(button.disabled)return;button.disabled=true;status.textContent='Saving…';
  try{const r=await fetch('/ops/cases/'+encodeURIComponent(form.dataset.id)+'/action',{
    method:'POST',credentials:'same-origin',headers:{'content-type':'application/json','x-ar-ops-action':'1'},
    body:JSON.stringify({action:form.dataset.action,note})});const result=await r.json();
    if(!r.ok||!result.ok){status.textContent='Case not changed: '+String(result.code||'unavailable');button.disabled=false;return;}
    location.reload();
  }catch{status.textContent='Change not confirmed. Check the case before retrying.';button.disabled=false;}
 }));
 </script>`, '');
}
module.exports={casesPage};
