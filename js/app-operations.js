/* CSO Property Services — js/app-operations.js
   Split from app.js · DO NOT edit app.js directly
*/


// FIX #3: XSS protection — sh() is a short alias for sanitizeHTML()
// Always use sh() when injecting user-entered text into innerHTML
const sh = (s) => {
  if (s == null) return '';
  const d = document.createElement('div');
  d.textContent = String(s);
  return d.innerHTML;
};

function addCleaner(){
  const name=document.getElementById('cl-name').value.trim();
  if(!name){toast('Enter cleaner name');return;}
  if(!cData.cleaners)cData.cleaners=[];
  const propSel=document.getElementById('cl-props');
  const propIds=propSel?[...propSel.selectedOptions].map(o=>o.value).filter(Boolean):[];
  const badges=[...document.querySelectorAll('#cl-badges-wrap input[type=checkbox]:checked')].map(cb=>cb.value);
  cData.cleaners.push({
    id:'cl_'+Date.now(),name,
    phone:document.getElementById('cl-phone').value,
    email:document.getElementById('cl-email').value,
    rate:parseFloat(document.getElementById('cl-rate').value)||0,
    area:document.getElementById('cl-area').value,
    skills:document.getElementById('cl-skills').value,
    notes:document.getElementById('cl-notes').value,
    badges,
    propIds,
    rating:5,jobs:0,available:true,created:Date.now()
  });
  saveUserData(cUid,cData);
  closeModal('add-cleaner-modal');
  ['cl-name','cl-phone','cl-email','cl-rate','cl-area','cl-skills','cl-notes'].forEach(id=>{const el=document.getElementById(id);if(el)el.value='';});
  document.querySelectorAll('#cl-badges-wrap input[type=checkbox]').forEach(cb=>cb.checked=false);
  toast(`${name} added to marketplace!`);
  renderMarketplace();
}

function calcJobFee(){
  const pay=parseFloat(document.getElementById('job-pay')?.value)||0;
  const feePct=parseFloat(document.getElementById('job-fee-pct')?.value)||5;
  const preview=document.getElementById('job-fee-preview');
  if(!preview)return;
  if(!pay){preview.style.display='none';return;}
  const fee=Math.round(pay*feePct/100*100)/100;
  const cleanerGets=Math.round((pay-fee)*100)/100;
  preview.style.display='block';
  preview.innerHTML='<strong>Cleaner receives:</strong> $'+cleanerGets+' &nbsp;·&nbsp; <strong style="color:var(--gold)">Your platform fee ('+feePct+'%): $'+fee+'</strong> &nbsp;·&nbsp; Total charged to host: $'+pay;
}
function postJob(){
  const propId=document.getElementById('job-prop').value;
  const date=document.getElementById('job-date').value;
  if(!date){toast('Select a date');return;}
  if(!cData.jobs)cData.jobs=[];
  if(!cData.platformEarnings)cData.platformEarnings=[];
  const prop=cData.properties.find(p=>p.id===propId);
  const cleanerId=document.getElementById('job-cleaner').value;
  const cleaner=cData.cleaners?.find(c=>c.id===cleanerId);
  const pay=parseFloat(document.getElementById('job-pay').value)||0;
  const feePct=parseFloat(document.getElementById('job-fee-pct')?.value)||5;
  const platformFee=Math.round(pay*feePct/100*100)/100;
  const newJob={id:'j_'+Date.now(),propId,propName:prop?.name||'Property',date,time:document.getElementById('job-time').value,type:document.getElementById('job-type').value,cleanerId,cleanerName:cleaner?.name||'Unassigned',pay,feePct,platformFee,cleanerPay:Math.round((pay-platformFee)*100)/100,notes:document.getElementById('job-notes').value,status:cleanerId?'assigned':'open',created:Date.now()};
  cData.jobs.push(newJob);
  cData.platformEarnings.push({id:'pe_'+Date.now(),jobId:newJob.id,amount:platformFee,percentage:feePct,date,property:prop?.name||'Property',type:'platform_fee',created:Date.now()});
  saveUserData(cUid,cData);
  closeModal('hire-cleaner-modal');
  toast('Job posted! Platform fee: $'+platformFee);
  renderMarketplace();
  // GAP 1: Notify cleaner via SMS/WhatsApp
  if(cleanerId) setTimeout(()=>notifyCleanerJob(newJob), 400);
}

function renderMarketplace(){
  // Check for cleaner card updates from localStorage bridge
  checkJobCardUpdates();
  const jobs=cData.jobs||[];
  const completedJobs=jobs.filter(j=>j.status==='completed');
  const totalPlatformFees=completedJobs.reduce((s,j)=>s+(j.platformFee||0),0);
  const feeEl=document.getElementById('mkt-fees');
  if(feeEl)feeEl.textContent='$'+totalPlatformFees.toFixed(2);

  const cleaners=cData.cleaners||[];
  const set=(id,v)=>{const el=document.getElementById(id);if(el)el.textContent=v;};
  set('mkt-cleaners',cleaners.filter(c=>c.available).length);
  set('mkt-jobs',jobs.filter(j=>j.status==='open'||j.status==='assigned'||j.status==='in_progress').length);
  set('mkt-done',completedJobs.length);
  const rated=cleaners.filter(c=>c.rating);
  set('mkt-rating',rated.length?'⭐'+(rated.reduce((s,c)=>s+c.rating,0)/rated.length).toFixed(1):'—');

  const dir=document.getElementById('cleaner-directory');
  if(dir){
    if(!cleaners.length) dir.innerHTML='<div class="empty-state"><div class="es-i">🧹</div><h3>No cleaners yet</h3><p>Add cleaners who have contacted you to join your marketplace</p></div>';
    else dir.innerHTML=cleaners.map(c=>{
      const cJobs=(cData.jobs||[]).filter(j=>j.cleanerId===c.id||j.cleanerName===c.name);
      const propNames=(c.propIds||[]).map(pid=>(cData.properties||[]).find(p=>p.id===pid)?.name).filter(Boolean);
      const avgScore=cJobs.filter(j=>j.qualityScore).length?(cJobs.filter(j=>j.qualityScore).reduce((s,j)=>s+j.qualityScore,0)/cJobs.filter(j=>j.qualityScore).length).toFixed(1):null;
      const badgeMap={background_check:'✅ BG Check',insured:'🛡 Insured',turno_verified:'🔄 Turno',own_supplies:'🧴 Supplies',reliable:'⭐ Reliable'};
      const certBadges=(c.badges||[]).map(b=>badgeMap[b]||'').filter(Boolean);
      return `<div class="row" style="cursor:default">
        <div style="width:38px;height:38px;border-radius:50%;background:var(--terra);color:#fff;display:flex;align-items:center;justify-content:center;font-size:16px;font-weight:700;flex-shrink:0">${c.name[0]}</div>
        <div class="row-info">
          <div class="row-title">${c.name} <span style="font-size:11px;color:var(--gold)">${avgScore?'⭐'+avgScore:'⭐'+c.rating}</span></div>
          <div class="row-sub">${c.area||'No area'} · $${c.rate}/hr · ${cJobs.length} jobs</div>
          ${certBadges.length?`<div style="margin-top:4px;display:flex;gap:4px;flex-wrap:wrap">${certBadges.map(b=>`<span style="background:rgba(107,143,113,.12);border:1px solid var(--sage);border-radius:4px;padding:1px 6px;font-size:10px;color:var(--sage);font-weight:600">${b}</span>`).join('')}</div>`:''}
          ${propNames.length?`<div style="margin-top:3px;display:flex;gap:4px;flex-wrap:wrap">${propNames.map(n=>`<span style="background:var(--sand);border-radius:4px;padding:1px 6px;font-size:10px;color:var(--txt2)">${n}</span>`).join('')}</div>`:''}
        </div>
        <span class="pill ${c.available?'pill-green':'pill-amber'}">${c.available?'Available':'Busy'}</span>
        <button class="btn btn-ghost" style="font-size:10px;padding:3px 8px" onclick="renderCleanerEarnings('${c.id}')">💰</button>
        <button class="btn btn-ghost" style="font-size:10px;padding:3px 8px" onclick="editContractorRate('${c.id}')">✏️ Edit</button>
        <button class="btn btn-ghost" style="font-size:10px;padding:3px 8px" onclick="toggleCleanerAvail('${c.id}')">${c.available?'Mark Busy':'Mark Free'}</button>
        <button class="btn btn-ghost" style="font-size:10px;padding:3px 8px;color:var(--terra)" onclick="removeCleaner('${c.id}')">🗑</button>
      </div>`;
    }).join('');
  }

  const board=document.getElementById('job-board');
  if(board){
    if(!jobs.length) board.innerHTML='<div class="empty-state"><div class="es-i">📋</div><h3>No active jobs</h3></div>';
    else {
      const typeLabels={turnover:'🔄 Turnover',deep:'🧹 Deep',inspect:'🔍 Inspect',laundry:'👕 Laundry'};
      const sc={open:'pill-amber',assigned:'pill-blue',in_progress:'pill-blue',completed:'pill-green',declined:'pill-red'};
      const jobCardBase = window.location.origin + window.location.pathname;
      board.innerHTML=jobs.slice().reverse().map(j=>{
        const scoreHtml=j.qualityScore?`<span style="font-size:11px;color:var(--gold)">⭐${j.qualityScore}</span>`:'';
        const windowHtml=j.cleaningWindow?.windowLabel?`<div style="font-size:10px;color:var(--txt3);margin-top:2px">${j.cleaningWindow.windowLabel}</div>`:'';
        const heartbeatHtml=j.heartbeatAlerted?`<div style="font-size:10px;color:var(--terra);font-weight:600;margin-top:2px">⚠️ No check-in for ${j.heartbeatLateMin||15}+ min</div>`:'';
        return `<div class="row" style="cursor:default;${j.heartbeatAlerted?'border-left:3px solid var(--terra);padding-left:10px;':''}">
          <div class="row-info">
            <div class="row-title">${typeLabels[j.type]||j.type} — ${j.propName} ${scoreHtml}</div>
            <div class="row-sub">${j.date} at ${j.time||'TBD'} · ${j.cleanerName}</div>
            ${windowHtml}${heartbeatHtml}
          </div>
          <span class="pill ${sc[j.status]||'pill-amber'}" style="font-size:10px">${j.status.replace('_',' ')}</span>
          <div class="row-price">$${j.pay}</div>
          <button class="btn btn-ghost" style="font-size:10px;padding:3px 8px" title="Copy cleaner job link" onclick="navigator.clipboard.writeText('${jobCardBase}?job=${j.id}').then(()=>toast('Job link copied! Send to ${j.cleanerName} ✓'))">🔗</button>
          ${(j.cleanerId&&j.status!=='completed'&&j.status!=='declined')?`<button class="btn btn-ghost" style="font-size:10px;padding:3px 8px" title="Resend notification" onclick="notifyCleanerJob(${JSON.stringify(j).replace(/"/g,'&quot;')})">📱</button>`:''}
          <button class="btn btn-ghost" style="font-size:10px;padding:3px 8px" onclick="completeJob('${j.id}')" ${j.status==='completed'?'disabled':''}>✓</button>
        </div>`;
      }).join('');
    }
  }

  // Populate properties in cleaner modal
  const clPropSel=document.getElementById('cl-props');
  if(clPropSel&&!clPropSel.options.length)(cData.properties||[]).forEach(p=>{const o=document.createElement('option');o.value=p.id;o.textContent=p.emoji+' '+p.name;clPropSel.appendChild(o);});

  const sel=document.getElementById('job-cleaner');
  if(sel)sel.innerHTML='<option value="">Any available cleaner</option>'+(cleaners.map(c=>`<option value="${c.id}">${c.name} — $${c.rate}/hr</option>`).join(''));
}
function toggleCleanerAvail(id){const c=(cData.cleaners||[]).find(x=>x.id===id);if(c){c.available=!c.available;saveUserData(cUid,cData);renderMarketplace();}}
function removeCleaner(id){if(!confirm('Remove this cleaner?'))return;cData.cleaners=(cData.cleaners||[]).filter(x=>x.id!==id);saveUserData(cUid,cData);renderMarketplace();toast('Cleaner removed');}
function completeJob(id){
  const j=(cData.jobs||[]).find(x=>x.id===id);
  if(!j)return;
  j.status='completed';
  j.completedAt=new Date().toISOString().slice(0,10);
  j.completedTs=Date.now();

  // ── Generate secure approval token for owner verification
  const token = 'apv_' + Math.random().toString(36).slice(2) + Date.now().toString(36);
  j.approvalToken = token;
  j.approvalStatus = 'pending';  // pending | verified | disputed
  j.approvalSentAt = Date.now();
  j.autoApproveAt = Date.now() + (48 * 60 * 60 * 1000); // 48 hours from now

  // Auto-create payout record — status 'pending_approval' until owner verifies
  if(!cData.payouts)cData.payouts=[];
  const alreadyLogged=cData.payouts.find(p=>p.jobId===j.id);
  if(!alreadyLogged&&j.pay>0){
    cData.payouts.push({
      id:'pay_'+Date.now(),
      jobId:j.id,
      approvalToken:token,
      cleaner:j.cleanerId||'',
      cleanerName:j.cleanerName||'Cleaner',
      charged:j.pay||0,
      owed:j.cleanerPay||Math.round((j.pay-(j.platformFee||0))*100)/100,
      net:j.platformFee||0,
      margin:j.feePct||5,
      platformFee:j.platformFee||0,
      status:'pending_approval',   // pending_approval | verified | paid
      date:j.completedAt,
      autoApproveAt:j.autoApproveAt,
      notes:'Auto-logged from job: '+j.propName,
      created:Date.now()
    });
  }

  // Record platform fee as revenue
  if(j.platformFee && j.platformFee > 0){
    if(!cData.expenses)cData.expenses=[];
    const alreadyExpensed=cData.expenses.find(e=>e.jobId===j.id && e.category==='Platform Fee');
    if(!alreadyExpensed){
      cData.expenses.push({
        id:'exp_'+Date.now(),
        jobId:j.id,
        category:'Platform Fee',
        amount:j.platformFee,
        date:j.completedAt,
        property:j.propName,
        notes:'Platform fee from marketplace job: '+j.type+' - '+j.cleanerName,
        type:'revenue',
        created:Date.now()
      });
    }
  }

  saveUserData(cUid,cData);
  renderMarketplace();

  // Generate and show the approval link for the owner
  const approvalUrl = window.location.origin + window.location.pathname + '?approve=' + token;
  const approvalMsg = `
    <div style="background:rgba(107,143,113,.1);border:1px solid var(--sage);border-radius:12px;padding:16px;margin-top:8px">
      <div style="font-size:14px;font-weight:600;color:var(--txt);margin-bottom:8px">✅ Job Marked Complete — Send Approval Link to Owner</div>
      <div style="font-size:12px;color:var(--txt2);margin-bottom:10px;line-height:1.6">
        Share this link with the property owner. They have <strong>48 hours</strong> to approve or dispute. If no action is taken, the job auto-approves and the payout becomes eligible.
      </div>
      <div style="background:var(--sand);border-radius:8px;padding:10px;display:flex;align-items:center;gap:8px;margin-bottom:10px">
        <div style="font-size:11px;color:var(--terra);font-family:monospace;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${approvalUrl}</div>
        <button class="btn btn-pri" style="font-size:11px;padding:4px 10px;flex-shrink:0" onclick="_fallbackCopy('${approvalUrl}');this.textContent='Copied!'">📋 Copy</button>
      </div>
      <div style="display:flex;gap:8px">
        <a href="sms:?body=${encodeURIComponent('Please approve the cleaning job at '+j.propName+': '+approvalUrl)}" class="btn btn-ghost" style="font-size:11px;padding:5px 10px;text-decoration:none;flex:1;text-align:center">💬 SMS Owner</a>
        <a href="mailto:?subject=${encodeURIComponent('Job Approval — '+j.propName)}&body=${encodeURIComponent('Hi,\n\nThe cleaning job at '+j.propName+' has been completed by '+j.cleanerName+' on '+j.completedAt+'.\n\nPlease click the link below to approve or dispute within 48 hours:\n\n'+approvalUrl+'\n\nIf no action is taken, the job will auto-approve after 48 hours.\n\nThank you,\nCSO Property Services')}" class="btn btn-ghost" style="font-size:11px;padding:5px 10px;text-decoration:none;flex:1;text-align:center">📧 Email Owner</a>
      </div>
    </div>`;

  // Show in a modal
  const existing = document.getElementById('approval-link-modal');
  if(existing) existing.remove();
  const m = document.createElement('div');
  m.id='approval-link-modal';
  m.className='modal-bg open';
  m.innerHTML=`<div class="modal" style="max-width:500px">
    <h2>✅ ${j.propName} — Job Complete</h2>
    <div style="font-size:13px;color:var(--txt2);margin-bottom:4px">${j.cleanerName} · ${j.date} · $${j.pay}</div>
    ${approvalMsg}
    <div class="modal-foot">
      <button class="btn btn-ghost" onclick="document.getElementById('approval-link-modal').remove()">Close</button>
    </div>
  </div>`;
  document.body.appendChild(m);

  // GAP 4: Prompt quality score after modal dismissed
  setTimeout(()=>promptJobQualityScore(id), 600);
}

// ════════════════════════════════════════════
//  WORK ORDERS
// ════════════════════════════════════════════
let woFilter='all';
function addWorkOrder(){const title=document.getElementById('wo-title').value.trim();if(!title){toast('Enter issue title');return;}if(!cData.workorders)cData.workorders=[];const propId=document.getElementById('wo-prop').value;const prop=cData.properties.find(p=>p.id===propId);cData.workorders.push({id:'wo_'+Date.now(),title,propId,propName:prop?.name||'',cat:document.getElementById('wo-cat').value,priority:document.getElementById('wo-priority').value,costEst:parseFloat(document.getElementById('wo-cost-est').value)||0,costActual:0,desc:document.getElementById('wo-desc').value,assignedTo:document.getElementById('wo-assign').value,status:'open',created:Date.now()});saveUserData(cUid,cData);closeModal('add-workorder-modal');['wo-title','wo-desc','wo-assign','wo-cost-est'].forEach(id=>{const el=document.getElementById(id);if(el)el.value='';});toast('Work order created!');renderWorkOrders();}

function filterWO(filter,btn){woFilter=filter;document.querySelectorAll('#wo-filters button').forEach(b=>{b.className='btn btn-ghost';b.style.fontSize='10px';b.style.padding='3px 9px';});if(btn){btn.className='btn btn-pri';btn.style.fontSize='10px';btn.style.padding='3px 9px';}renderWorkOrders();}

function renderWorkOrders(){
  const orders=cData.workorders||[];const filtered=woFilter==='all'?orders:orders.filter(o=>o.status===woFilter);
  const set=(id,v)=>{const el=document.getElementById(id);if(el)el.textContent=v;};
  set('wo-open',orders.filter(o=>o.status==='open').length);set('wo-progress',orders.filter(o=>o.status==='in_progress').length);set('wo-done',orders.filter(o=>o.status==='completed').length);set('wo-cost','$'+orders.filter(o=>o.status==='completed').reduce((s,o)=>s+(o.costActual||o.costEst||0),0).toLocaleString());
  const list=document.getElementById('workorders-list');if(!list)return;
  if(!filtered.length){list.innerHTML='<div class="empty-state"><div class="es-i">🔧</div><h3>No work orders</h3></div>';return;}
  const ce={plumbing:'🚰',electrical:'⚡',hvac:'❄️',appliance:'🍳',structural:'🏚',cleaning:'🧹',other:'📦'};
  const pc={urgent:'pill-red',high:'pill-amber',medium:'pill-green',low:'pill-blue'};const sc={open:'pill-amber',in_progress:'pill-blue',completed:'pill-green'};
  list.innerHTML=filtered.map(o=>`<div class="row" style="cursor:default"><div style="font-size:20px">${ce[o.cat]||'📦'}</div><div class="row-info"><div class="row-title">${sh(o.title)}</div><div class="row-sub">${sh(o.propName)||''}${o.assignedTo?' · '+o.assignedTo:''}</div></div><span class="pill ${pc[o.priority]||'pill-amber'}">${o.priority}</span><span class="pill ${sc[o.status]||'pill-amber'}">${o.status.replace('_',' ')}</span><div class="row-price">$${(o.costActual||o.costEst||0).toLocaleString()}</div><select onchange="updateWOStatus('${o.id}',this.value)" style="font-size:10px;background:var(--input-bg);border:1px solid var(--border);border-radius:6px;padding:3px 6px;color:var(--txt)"><option value="open" ${o.status==='open'?'selected':''}>Open</option><option value="in_progress" ${o.status==='in_progress'?'selected':''}>In Progress</option><option value="completed" ${o.status==='completed'?'selected':''}>Completed</option></select></div>`).join('');
}
function updateWOStatus(id,status){const o=(cData.workorders||[]).find(x=>x.id===id);if(o){o.status=status;saveUserData(cUid,cData);renderWorkOrders();toast('Work order updated ✓');}}

// ════════════════════════════════════════════
//  INVENTORY
// ════════════════════════════════════════════
function addInventoryItem(){const name=document.getElementById('inv-name').value.trim();if(!name){toast('Enter item name');return;}if(!cData.inventory)cData.inventory=[];const propId=document.getElementById('inv-prop').value;const prop=cData.properties.find(p=>p.id===propId);cData.inventory.push({id:'inv_'+Date.now(),name,propId,propName:prop?.name||'All',cat:document.getElementById('inv-cat').value,qty:parseInt(document.getElementById('inv-qty').value)||0,threshold:parseInt(document.getElementById('inv-threshold').value)||3,unit:document.getElementById('inv-unit').value||'units',cost:parseFloat(document.getElementById('inv-cost').value)||0,link:document.getElementById('inv-link').value,created:Date.now()});saveUserData(cUid,cData);closeModal('add-inventory-modal');['inv-name','inv-qty','inv-threshold','inv-unit','inv-cost','inv-link'].forEach(id=>{const el=document.getElementById(id);if(el)el.value='';});toast(`${name} added!`);renderInventory();}

function updateQty(id,delta){const item=(cData.inventory||[]).find(x=>x.id===id);if(!item)return;item.qty=Math.max(0,(item.qty||0)+delta);saveUserData(cUid,cData);renderInventory();}
function removeInventory(id){cData.inventory=(cData.inventory||[]).filter(x=>x.id!==id);saveUserData(cUid,cData);renderInventory();toast('Item removed');}

function renderInventory(){
  const items=cData.inventory||[];const low=items.filter(i=>i.qty<=i.threshold&&i.qty>0).length;const out=items.filter(i=>i.qty===0).length;
  const set=(id,v)=>{const el=document.getElementById(id);if(el)el.textContent=v;};
  set('inv-total',items.length);set('inv-low',low);set('inv-out',out);set('inv-props',new Set(items.map(i=>i.propId).filter(Boolean)).size);
  const list=document.getElementById('inventory-list');if(!list)return;
  if(!items.length){list.innerHTML='<div class="empty-state"><div class="es-i">📦</div><h3>No inventory tracked</h3><button class="btn btn-pri" onclick="openModal(\'add-inventory-modal\')" style="margin-top:10px">Add First Item</button></div>';return;}
  const ce={toiletries:'🧴',linens:'🛏',cleaning:'🧹',kitchen:'🍳',amenities:'⭐',other:'📦'};
  const sorted=[...items].sort((a,b)=>{if(a.qty===0&&b.qty!==0)return -1;if(b.qty===0&&a.qty!==0)return 1;if(a.qty<=a.threshold&&b.qty>b.threshold)return -1;return a.name.localeCompare(b.name);});
  list.innerHTML=sorted.map(function(i){
    var isOut=i.qty===0;var isLow=i.qty<=i.threshold&&!isOut;
    var statusBadge=isOut?'<span style="color:var(--terra);font-size:11px">OUT</span>':isLow?'<span style="color:var(--gold);font-size:11px">LOW</span>':'';
    var qtyColor=isOut?'var(--terra)':isLow?'var(--gold)':'var(--txt)';
    var shopBtn=i.link?'<a href="'+i.link+'" target="_blank" class="btn btn-ghost" style="font-size:10px;padding:3px 8px;text-decoration:none">🛒</a>':'';
    return '<div class="row" style="cursor:default">'
      +'<div style="font-size:20px">'+(ce[i.cat]||'📦')+'</div>'
      +'<div class="row-info"><div class="row-title">'+i.name+' '+statusBadge+'</div>'
      +'<div class="row-sub">'+i.propName+' · Alert at '+i.threshold+' '+i.unit+'</div></div>'
      +'<div style="display:flex;align-items:center;gap:6px">'
      +'<button onclick="updateQty(this.dataset.id,-1)" data-id="'+i.id+'" style="background:var(--sand);border:1px solid var(--border);border-radius:5px;width:24px;height:24px;cursor:pointer;font-size:14px;color:var(--txt)">−</button>'
      +'<div style="font-family:Fraunces,serif;font-size:18px;color:'+qtyColor+';min-width:32px;text-align:center">'+i.qty+'</div>'
      +'<button onclick="updateQty(this.dataset.id,1)" data-id="'+i.id+'" style="background:var(--sand);border:1px solid var(--border);border-radius:5px;width:24px;height:24px;cursor:pointer;font-size:14px;color:var(--txt)">+</button>'
      +'<span style="font-size:11px;color:var(--txt3)">'+i.unit+'</span></div>'
      +shopBtn
      +'<button class="btn btn-ghost" style="font-size:10px;padding:3px 8px;color:var(--terra)" onclick="removeInventory(this.dataset.id)" data-id="'+i.id+'">🗑</button></div>';
  }).join('');
}

function generateShoppingList(){const low=(cData.inventory||[]).filter(i=>i.qty<=i.threshold);if(!low.length){toast('All items well stocked! ✓');return;}let text='Shopping List — '+new Date().toLocaleDateString()+'\n\n';low.forEach(i=>{text+=`□ ${i.name} (${i.propName}) — Need ~${Math.max(3,i.threshold*3-i.qty)} ${i.unit}\n`;});navigator.clipboard.writeText(text).then(()=>toast(`${low.length} items copied to clipboard!`)).catch(()=>toast(`${low.length} items need restocking`));}

// ════════════════════════════════════════════
//  UNIFIED INBOX
// ════════════════════════════════════════════
let autoReplyEnabled=false;
function toggleAutoReply(){autoReplyEnabled=!autoReplyEnabled;const btn=document.getElementById('autoreply-toggle-btn');if(btn){btn.textContent=`🤖 Auto-Reply: ${autoReplyEnabled?'ON':'OFF'}`;btn.className=autoReplyEnabled?'btn btn-pri':'btn btn-ghost';}toast(`Auto-reply ${autoReplyEnabled?'enabled':'disabled'}`);}

function addAutoReply(){const trigger=document.getElementById('ar-trigger').value.trim();const reply=document.getElementById('ar-reply').value.trim();if(!trigger||!reply){toast('Fill in trigger and reply');return;}if(!cData.autoReplies)cData.autoReplies=[];cData.autoReplies.push({id:'ar_'+Date.now(),trigger,reply,active:true,hits:0,created:Date.now()});saveUserData(cUid,cData);closeModal('add-autoreply-modal');document.getElementById('ar-trigger').value='';document.getElementById('ar-reply').value='';toast('Auto-reply rule saved!');renderInbox();}

function checkAutoReply(message){if(!autoReplyEnabled||!cData.autoReplies?.length)return null;const msg=message.toLowerCase();for(const rule of cData.autoReplies){if(!rule.active)continue;const triggers=rule.trigger.split(',').map(t=>t.trim().toLowerCase());if(triggers.some(t=>msg.includes(t))){rule.hits=(rule.hits||0)+1;const prop=cData.properties[0];return rule.reply.replace(/{wifi_name}/g,prop?.wifi||'[WiFi]').replace(/{wifi_password}/g,prop?.wifiPw||'[Password]').replace(/{door_code}/g,prop?.doorCode||'[Code]').replace(/{host_name}/g,cUser?.name||'Host').replace(/{property_name}/g,prop?.name||'the property').replace(/{checkin_time}/g,'3:00 PM').replace(/{checkout_time}/g,'11:00 AM');}}return null;}

function renderInbox(){
  const msgs=[...cData.messages].sort((a,b)=>b.created-a.created);
  // Target msg-conv-list (the actual messages page container) with inbox-list as legacy fallback
  const inboxList=document.getElementById('msg-conv-list') || document.getElementById('inbox-list');
  if(inboxList){
    if(!msgs.length){
      inboxList.innerHTML='<div class="empty-state" style="padding:24px 10px"><div class="es-i">📬</div><p style="font-size:12px">No conversations yet</p></div>';
    } else {
      inboxList.innerHTML=msgs.map(m=>{
        const last=m.messages[m.messages.length-1];
        return '<div class="msg-li" onclick="openConv(\''+m.id+'\')" style="cursor:pointer"><div class="msg-av" style="background:'+m.avatarBg+';color:'+m.avatarColor+'">'+m.initials+'</div><div style="flex:1;min-width:0"><div class="msg-li-name" style="font-weight:'+(m.unread?700:500)+'">'+m.guestName+'</div><div class="msg-li-prev">'+(last?.text||'').substring(0,45)+'…</div></div>'+(m.unread?'<div style="width:6px;height:6px;background:var(--terra);border-radius:50%;flex-shrink:0"></div>':'')+'</div>';
      }).join('');
    }
  }
  const rulesList=document.getElementById('autoreply-rules-list');
  if(rulesList){
    const rules=cData.autoReplies||[];
    if(!rules.length){
      rulesList.innerHTML='<div style="font-size:13px;color:var(--txt3)">No auto-reply rules yet.</div>';
    } else {
      rulesList.innerHTML=rules.map(r=>'<div class="row" style="cursor:default"><div class="row-info"><div class="row-title">🎯 "'+r.trigger+'"</div><div class="row-sub">'+r.reply.substring(0,50)+'… · '+(r.hits||0)+' hits</div></div><span class="pill '+(r.active?'pill-green':'pill-amber')+'">'+(r.active?'Active':'Off')+'</span><button class="btn btn-ghost" style="font-size:10px;padding:3px 8px" onclick="toggleARRule(\''+r.id+'\')">'+(r.active?'Disable':'Enable')+'</button><button class="btn btn-ghost" style="font-size:10px;padding:3px 8px;color:var(--terra)" onclick="deleteAR(\''+r.id+'\')">🗑</button></div>').join('');
    }
  }
}
function toggleARRule(id){const r=(cData.autoReplies||[]).find(x=>x.id===id);if(r){r.active=!r.active;saveUserData(cUid,cData);renderInbox();}}
function deleteAR(id){cData.autoReplies=(cData.autoReplies||[]).filter(x=>x.id!==id);saveUserData(cUid,cData);renderInbox();toast('Rule deleted');}

// ════════════════════════════════════════════
//  CONCIERGE
// ════════════════════════════════════════════
function addConciergeService(){const name=document.getElementById('svc-name').value.trim();if(!name){toast('Enter service name');return;}if(!cData.concierge)cData.concierge=[];cData.concierge.push({id:'svc_'+Date.now(),name,cat:document.getElementById('svc-cat').value,price:parseFloat(document.getElementById('svc-price').value)||0,duration:document.getElementById('svc-duration').value,desc:document.getElementById('svc-desc').value,contact:document.getElementById('svc-contact').value,active:true,requests:0,created:Date.now()});saveUserData(cUid,cData);closeModal('add-service-modal');toast(`${name} added!`);renderConcierge();}

function renderConcierge(){const services=cData.concierge||[];const list=document.getElementById('concierge-list');if(!list)return;const ce={transport:'🚗',food:'🍽',tours:'🗺',wellness:'💆',shopping:'🛍',other:'✨'};if(!services.length)list.innerHTML='<div class="empty-state"><div class="es-i">🎩</div><h3>No services yet</h3></div>';else list.innerHTML=services.map(s=>`<div class="row" style="cursor:default"><div style="font-size:22px">${ce[s.cat]||'✨'}</div><div class="row-info"><div class="row-title">${s.name}</div><div class="row-sub">${s.duration||''} · ${s.requests} requests · ${s.contact||''}</div></div><div class="row-price">$${s.price}</div><button class="btn btn-ghost" style="font-size:10px;padding:3px 8px;color:var(--terra)" onclick="removeConcierge('${s.id}')">🗑</button></div>`).join('');}
function removeConcierge(id){cData.concierge=(cData.concierge||[]).filter(x=>x.id!==id);saveUserData(cUid,cData);renderConcierge();toast('Service removed');}

// ════════════════════════════════════════════
//  UPSELL PORTAL
// ════════════════════════════════════════════
function addUpsell(){const name=document.getElementById('ups-name').value.trim();if(!name){toast('Enter offer name');return;}if(!cData.upsells)cData.upsells=[];cData.upsells.push({id:'ups_'+Date.now(),name,cat:document.getElementById('ups-cat').value,price:parseFloat(document.getElementById('ups-price').value)||0,desc:document.getElementById('ups-desc').value,propFilter:document.getElementById('ups-prop-filter').value,active:true,purchases:[],created:Date.now()});saveUserData(cUid,cData);closeModal('add-upsell-modal');toast(`${name} upsell added!`);renderUpsell();}

function renderUpsell(){const upsells=cData.upsells||[];const purchases=upsells.flatMap(u=>u.purchases||[]);const now=new Date();const thisMonth=now.toISOString().slice(0,7);const monthRev=purchases.filter(p=>p.date?.startsWith(thisMonth)).reduce((s,p)=>s+p.price,0);const totalRev=purchases.reduce((s,p)=>s+p.price,0);const set=(id,v)=>{const el=document.getElementById(id);if(el)el.textContent=v;};set('upsell-rev-month','$'+monthRev.toLocaleString());set('upsell-rev-total','$'+totalRev.toLocaleString());const ce={checkin:'🔑',basket:'🧺',rental:'🚲',food:'🍽',experience:'🎭',other:'✨'};const list=document.getElementById('upsell-list');if(list){if(!upsells.length)list.innerHTML='<div class="empty-state"><div class="es-i">🛎</div><h3>No offers yet</h3></div>';else list.innerHTML=upsells.map(u=>`<div class="row" style="cursor:default"><div style="font-size:22px">${ce[u.cat]||'✨'}</div><div class="row-info"><div class="row-title">${u.name}</div><div class="row-sub">${(u.purchases||[]).length} purchases</div></div><div class="row-price">$${u.price}</div><button class="btn btn-pri" style="font-size:10px;padding:3px 8px" onclick="recordUpsell('${u.id}')">+ Sale</button><button class="btn btn-ghost" style="font-size:10px;padding:3px 8px;color:var(--terra)" onclick="removeUpsell('${u.id}')">🗑</button></div>`).join('');}}
function recordUpsell(id){const u=(cData.upsells||[]).find(x=>x.id===id);if(!u)return;if(!u.purchases)u.purchases=[];u.purchases.push({date:new Date().toISOString().slice(0,10),price:u.price});saveUserData(cUid,cData);renderUpsell();toast(`$${u.price} sale recorded! 🎉`);}
function removeUpsell(id){cData.upsells=(cData.upsells||[]).filter(x=>x.id!==id);saveUserData(cUid,cData);renderUpsell();toast('Offer removed');}

// ════════════════════════════════════════════
//  DIRECT BOOKING KIT
// ════════════════════════════════════════════
function renderDirectBook(){const directBookings=(cData.bookings||[]).filter(b=>b.source==='direct');const saved=directBookings.reduce((s,b)=>s+b.price*0.03,0);const set=(id,v)=>{const el=document.getElementById(id);if(el)el.textContent=v;};set('db-count',directBookings.length);set('db-saved','$'+Math.round(saved).toLocaleString());}
function generateDirectBookingLink(){const link=`https://csopropertyservices.com/?inquiry=1&host=${encodeURIComponent(cUser?.email||'')}`;const display=document.getElementById('db-link-display');const text=document.getElementById('db-link-text');if(display)display.style.display='block';if(text)text.textContent=link;toast('Direct booking link generated!');}
function copyDirectLink(){const text=document.getElementById('db-link-text')?.textContent;if(text)navigator.clipboard.writeText(text).then(()=>toast('Link copied! ✓'));}

// ════════════════════════════════════════════
//  DAMAGE CLAIMS
// ════════════════════════════════════════════
let claimPhotosTemp=[];
function addClaimPhotos(input){Array.from(input.files).forEach(file=>{const reader=new FileReader();reader.onload=e=>{claimPhotosTemp.push({data:e.target.result,name:file.name});renderClaimPhotos();};reader.readAsDataURL(file);});input.value='';}
function renderClaimPhotos(){const preview=document.getElementById('claim-photos-preview');if(!preview)return;preview.innerHTML=claimPhotosTemp.map((p,i)=>`<div style="position:relative;cursor:pointer" onclick="claimPhotosTemp.splice(${i},1);renderClaimPhotos()" title="Click to remove"><img src="${p.data}" style="width:60px;height:60px;object-fit:cover;border-radius:6px;border:1px solid var(--border)"><div style="position:absolute;top:-4px;right:-4px;width:14px;height:14px;background:var(--terra);border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:9px;color:#fff">×</div></div>`).join('');}

function addDamageClaim(){const desc=document.getElementById('claim-desc').value.trim();const amount=parseFloat(document.getElementById('claim-amount').value)||0;if(!desc){toast('Describe the damage');return;}if(!cData.claims)cData.claims=[];const bookingId=document.getElementById('claim-booking').value;const booking=cData.bookings.find(b=>b.id===bookingId);cData.claims.push({id:'claim_'+Date.now(),desc,amount,bookingId,guestName:booking?.guestName||'Unknown',propName:booking?.propName||'',platform:document.getElementById('claim-platform').value,notes:document.getElementById('claim-notes').value,photos:[...claimPhotosTemp],status:'open',recovered:0,created:Date.now()});claimPhotosTemp=[];saveUserData(cUid,cData);closeModal('add-claim-modal');toast('Damage claim filed!');renderDamageClaims();}

function renderDamageClaims(){const claims=cData.claims||[];const set=(id,v)=>{const el=document.getElementById(id);if(el)el.textContent=v;};set('claim-open',claims.filter(c=>c.status==='open').length);set('claim-submitted',claims.filter(c=>c.status==='submitted').length);set('claim-recovered','$'+claims.reduce((s,c)=>s+(c.recovered||0),0).toLocaleString());set('claim-pending','$'+claims.filter(c=>c.status!=='closed').reduce((s,c)=>s+c.amount,0).toLocaleString());const list=document.getElementById('claims-list');if(!list)return;if(!claims.length){list.innerHTML='<div class="empty-state"><div class="es-i">🛡</div><h3>No damage claims</h3></div>';return;}const sc={open:'pill-amber',submitted:'pill-blue',resolved:'pill-green',closed:'pill-red'};const pe={airbnb:'🏠',vrbo:'🏡',insurance:'🛡',direct:'💳'};list.innerHTML=claims.map(c=>`<div class="row" style="cursor:default"><div style="font-size:22px">${pe[c.platform]||'🛡'}</div><div class="row-info"><div class="row-title">${c.desc}${c.photos?.length?` <span style="font-size:10px;color:var(--terra)">📸${c.photos.length}</span>`:''}</div><div class="row-sub">${c.guestName} · ${c.propName} · ${c.platform}</div></div><span class="pill ${sc[c.status]||'pill-amber'}">${c.status}</span><div style="text-align:right"><div class="row-price">$${c.amount.toLocaleString()}</div>${c.recovered?`<div style="font-size:11px;color:var(--sage)">Recovered: $${c.recovered}</div>`:''}</div><select onchange="updateClaimStatus('${c.id}',this.value)" style="font-size:10px;background:var(--input-bg);border:1px solid var(--border);border-radius:6px;padding:3px 6px;color:var(--txt)"><option value="open" ${c.status==='open'?'selected':''}>Open</option><option value="submitted" ${c.status==='submitted'?'selected':''}>Submitted</option><option value="resolved" ${c.status==='resolved'?'selected':''}>Resolved</option><option value="closed" ${c.status==='closed'?'selected':''}>Closed</option></select></div>`).join('');}
function updateClaimStatus(id,status){const c=(cData.claims||[]).find(x=>x.id===id);if(!c)return;c.status=status;if(status==='resolved'){const amt=prompt(`Amount recovered? (Claimed: $${c.amount})`);if(amt)c.recovered=parseFloat(amt)||0;}saveUserData(cUid,cData);renderDamageClaims();toast('Claim updated ✓');}

// ════════════════════════════════════════════
//  CHECK-IN INSURANCE
// ════════════════════════════════════════════
function addCIPolicy(){
  const fee=parseFloat(document.getElementById('ci-fee').value)||0;
  if(!fee){toast('Enter a fee amount');return;}
  if(!cData.ciPolicies)cData.ciPolicies=[];
  const propId=document.getElementById('ci-prop').value;
  const prop=cData.properties.find(p=>p.id===propId);
  cData.ciPolicies.push({id:'cip_'+Date.now(),type:document.getElementById('ci-type').value,propId,propName:prop?.name||'All properties',standard:document.getElementById('ci-standard').value,fee,structure:document.getElementById('ci-structure').value,notes:document.getElementById('ci-notes').value,active:true,created:Date.now()});
  saveUserData(cUid,cData);closeModal('add-ci-policy-modal');
  toast('Policy saved!');renderCIInsurance();
}

function addCIRequest(){
  const fee=parseFloat(document.getElementById('ci-req-fee').value)||0;
  if(!cData.ciRequests)cData.ciRequests=[];
  const bookingId=document.getElementById('ci-req-booking').value;
  const booking=cData.bookings.find(b=>b.id===bookingId);
  cData.ciRequests.push({id:'cir_'+Date.now(),bookingId,guestName:booking?.guestName||'Guest',propName:booking?.propName||'',type:document.getElementById('ci-req-type').value,requestedTime:document.getElementById('ci-req-time').value,fee,status:document.getElementById('ci-req-status').value,created:Date.now()});
  saveUserData(cUid,cData);closeModal('add-ci-request-modal');
  toast('Request logged!');renderCIInsurance();
}

function renderCIInsurance(){
  const policies=cData.ciPolicies||[];
  const requests=cData.ciRequests||[];
  const approvedRevenue=requests.filter(r=>r.status==='approved').reduce((s,r)=>s+r.fee,0);
  const set=(id,v)=>{const el=document.getElementById(id);if(el)el.textContent=v;};
  set('ci-policies',policies.length);
  set('ci-protected','$'+approvedRevenue.toLocaleString());
  set('ci-claims',requests.length);
  const fees=requests.filter(r=>r.fee>0);
  set('ci-avg',fees.length?'$'+Math.round(fees.reduce((s,r)=>s+r.fee,0)/fees.length):'$0');
  const pList=document.getElementById('ci-policies-list');
  if(pList){
    if(!policies.length){
      pList.innerHTML='<div class="empty-state"><div class="es-i">🛡</div><h3>No policies set</h3><p>Add pricing rules for flex time requests</p></div>';
    } else {
      const structLabel={'flat':'flat fee','per_hour':'per hour','half_day':'half day'};
      pList.innerHTML=policies.map(function(p){
        return '<div class="row" style="cursor:default"><div style="font-size:22px">'+(p.type==='early_checkin'?'🔑':p.type==='late_checkout'?'🚪':'🔄')+'</div><div class="row-info"><div class="row-title">'+(p.type==='early_checkin'?'Early Check-in':p.type==='late_checkout'?'Late Checkout':'Both')+'</div><div class="row-sub">'+p.propName+' · '+(p.standard||'Standard times')+' · '+(p.structure==='per_hour'?'per hour':p.structure==='half_day'?'half day':'flat fee')+'</div></div><div class="row-price">$'+p.fee+'</div><button class="btn btn-ghost" style="font-size:10px;padding:3px 8px;color:var(--terra)" onclick="deleteCIPolicy(this.getAttribute(\'data-id\'))" data-id="'+p.id+'">🗑</button></div>';
      }).join('');
    }
  }
  const rList=document.getElementById('ci-requests-list');
  if(rList){
    if(!requests.length){
      rList.innerHTML='<div class="empty-state"><div class="es-i">📋</div><p>No requests logged yet</p></div>';
    } else {
      const sc={'approved':'pill-green','denied':'pill-red','pending':'pill-amber'};
      rList.innerHTML=requests.map(function(r){
        return '<div class="row" style="cursor:default"><div class="row-info"><div class="row-title">'+r.guestName+' — '+(r.type==='early_checkin'?'Early Check-in':'Late Checkout')+'</div><div class="row-sub">'+r.propName+' · '+(r.requestedTime||'Time not specified')+'</div></div><span class="pill '+(sc[r.status]||'pill-amber')+'">'+r.status+'</span><div class="row-price">$'+r.fee+'</div></div>';
      }).join('');
    }
  }
}
function deleteCIPolicy(id){cData.ciPolicies=(cData.ciPolicies||[]).filter(x=>x.id!==id);saveUserData(cUid,cData);renderCIInsurance();toast('Policy removed');}

// ════════════════════════════════════════════
//  EQUIPMENT RENTALS
// ════════════════════════════════════════════
function addRentalItem(){
  const name=document.getElementById('ri-name').value.trim();
  if(!name){toast('Enter item name');return;}
  if(!cData.rentalItems)cData.rentalItems=[];
  const propId=document.getElementById('ri-prop').value;
  const prop=cData.properties.find(p=>p.id===propId);
  cData.rentalItems.push({id:'ri_'+Date.now(),name,emoji:document.getElementById('ri-emoji').value||'📦',cat:document.getElementById('ri-cat').value,rate:parseFloat(document.getElementById('ri-rate').value)||0,qty:parseInt(document.getElementById('ri-qty').value)||1,propId,propName:prop?.name||'All',desc:document.getElementById('ri-desc').value,rentals:0,created:Date.now()});
  saveUserData(cUid,cData);closeModal('add-rental-item-modal');
  ['ri-name','ri-desc','ri-rate','ri-qty'].forEach(id=>{const el=document.getElementById(id);if(el)el.value='';});
  document.getElementById('ri-emoji').value='🚲';
  toast(`${name} added to catalog!`);renderRentals();
}

function calcRentalTotal(){
  const sel=document.getElementById('rb-item');
  const item=sel?(cData.rentalItems||[]).find(i=>i.id===sel.value):null;
  const days=parseInt(document.getElementById('rb-days')?.value)||0;
  const total=document.getElementById('rb-total');
  if(total&&item)total.value=(item.rate*days).toFixed(2);
}

function addRentalBooking(){
  const itemId=document.getElementById('rb-item').value;
  const item=(cData.rentalItems||[]).find(i=>i.id===itemId);
  if(!item){toast('Select an item');return;}
  const days=parseInt(document.getElementById('rb-days').value)||1;
  const total=parseFloat(document.getElementById('rb-total').value)||item.rate*days;
  const bookingId=document.getElementById('rb-booking').value;
  const booking=cData.bookings.find(b=>b.id===bookingId);
  if(!cData.rentalBookings)cData.rentalBookings=[];
  cData.rentalBookings.push({id:'rb_'+Date.now(),itemId,itemName:item.name,itemEmoji:item.emoji,bookingId,guestName:booking?.guestName||'Walk-in',start:document.getElementById('rb-start').value,days,total,status:'active',created:Date.now()});
  item.rentals=(item.rentals||0)+1;
  saveUserData(cUid,cData);closeModal('add-rental-booking-modal');
  toast(`${item.name} rental logged! $${total}`);renderRentals();
}

function renderRentals(){
  const items=cData.rentalItems||[];
  const bookings=cData.rentalBookings||[];
  const totalRev=bookings.reduce((s,b)=>s+b.total,0);
  const popular=items.length?[...items].sort((a,b)=>(b.rentals||0)-(a.rentals||0))[0]:null;
  const set=(id,v)=>{const el=document.getElementById(id);if(el)el.textContent=v;};
  set('rent-items',items.length);
  set('rent-active',bookings.filter(b=>b.status==='active').length);
  set('rent-rev','$'+totalRev.toLocaleString());
  set('rent-popular',popular?`${popular.emoji} ${popular.name}`:'—');
  const catalog=document.getElementById('rental-catalog');
  if(catalog){
    if(!items.length)catalog.innerHTML='<div class="empty-state"><div class="es-i">🚲</div><h3>No items yet</h3><button class="btn btn-pri" onclick="openModal(\'add-rental-item-modal\')" style="margin-top:10px">Add First Item</button></div>';
    else catalog.innerHTML=items.map(i=>`<div class="row" style="cursor:default">
      <div style="font-size:26px">${i.emoji}</div>
      <div class="row-info"><div class="row-title">${i.name}</div><div class="row-sub">${i.propName} · ${i.qty} available · ${i.rentals||0} rentals</div></div>
      <div class="row-price">$${i.rate}<span style="font-size:10px;color:var(--txt3)">/day</span></div>
      <button class="btn btn-ghost" style="font-size:10px;padding:3px 8px;color:var(--terra)" onclick="removeRentalItem('${i.id}')">🗑</button>
    </div>`).join('');
  }
  const history=document.getElementById('rental-history');
  if(history){
    if(!bookings.length)history.innerHTML='<div class="empty-state"><div class="es-i">📋</div><p>No rentals logged yet</p></div>';
    else history.innerHTML=[...bookings].reverse().map(b=>`<div class="row" style="cursor:default">
      <div style="font-size:22px">${b.itemEmoji||'📦'}</div>
      <div class="row-info"><div class="row-title">${b.itemName} — ${b.guestName}</div><div class="row-sub">${b.start||'No date'} · ${b.days} day${b.days!==1?'s':''}</div></div>
      <div class="row-price">$${b.total}</div>
    </div>`).join('');
  }
  // Populate item dropdown in rental booking modal
  const sel=document.getElementById('rb-item');
  if(sel)sel.innerHTML='<option value="">Select item…</option>'+items.map(i=>`<option value="${i.id}">${i.emoji} ${i.name} — $${i.rate}/day</option>`).join('');
}
function removeRentalItem(id){cData.rentalItems=(cData.rentalItems||[]).filter(x=>x.id!==id);saveUserData(cUid,cData);renderRentals();toast('Item removed');}

// ════════════════════════════════════════════
//  MESSAGE TEMPLATES
// ════════════════════════════════════════════
const STARTER_TEMPLATES = [
  {name:'Check-in Instructions',cat:'checkin',body:`Hi {guest_name}! Welcome to {property_name} 🏡\n\nYour check-in time is 3:00 PM. Door code: {door_code}\nWiFi: {wifi_name} | Password: {wifi_password}\n\nLet me know if you need anything!\n{host_name}`},
  {name:'Checkout Reminder',cat:'checkout',body:`Hi {guest_name}! Just a reminder that checkout is at 11:00 AM tomorrow.\n\nPlease leave keys on the kitchen counter and let me know if you need anything.\n\nThank you for staying at {property_name}! 🙏`},
  {name:'Welcome Message',cat:'welcome',body:`Hi {guest_name}! So excited to host you at {property_name} 🎉\n\nYou arrive on {checkin_date} — can't wait! Let me know if you have any questions before then.\n\n{host_name}`},
  {name:'Review Request',cat:'review',body:`Hi {guest_name}! Thank you for staying at {property_name} — it was a pleasure hosting you!\n\nIf you enjoyed your stay, I'd really appreciate a review on Airbnb. It only takes a minute and means the world to small hosts like me 🙏\n\n{host_name}`},
  {name:'House Rules',cat:'rules',body:`Hi {guest_name}! Quick reminder of our house rules:\n\n🚭 No smoking inside\n🐾 No pets unless pre-approved\n🔇 Quiet hours after 10pm\n👥 Max {max_guests} guests\n\nThank you! {host_name}`}
];

function addTemplate(){
  const name=document.getElementById('tpl-name').value.trim();
  const body=document.getElementById('tpl-body').value.trim();
  if(!name||!body){toast('Enter name and message');return;}
  if(!cData.templates)cData.templates=[];
  cData.templates.push({id:'tpl_'+Date.now(),name,cat:document.getElementById('tpl-cat').value,body,uses:0,created:Date.now()});
  saveUserData(cUid,cData);closeModal('add-template-modal');
  document.getElementById('tpl-name').value='';document.getElementById('tpl-body').value='';
  toast(`"${name}" template saved!`);renderTemplates();
}

function useTemplate(body){
  // Navigate to messages and pre-fill
  nav('messages',document.querySelector('[onclick*=messages]'));
  setTimeout(()=>{
    const activeTA=document.querySelector('.msg-ta');
    if(activeTA){activeTA.value=body;activeTA.focus();}
    else toast('Open a conversation first, then use the template');
  },200);
}

function renderTemplates(){
  const templates=cData.templates||[];
  const list=document.getElementById('templates-list');
  const catEmoji={checkin:'🔑',checkout:'🚪',rules:'📋',welcome:'👋',review:'⭐',other:'💬'};
  if(list){
    if(!templates.length)list.innerHTML='<div class="empty-state"><div class="es-i">📝</div><h3>No templates yet</h3><p>Save frequently used messages to send faster</p></div>';
    else list.innerHTML=templates.map(t=>`<div class="row" style="cursor:default">
      <div style="font-size:22px">${catEmoji[t.cat]||'💬'}</div>
      <div class="row-info"><div class="row-title">${t.name}</div><div class="row-sub">${t.body.substring(0,60).replace(/\n/g,' ')}… · used ${t.uses||0}×</div></div>
      <button class="btn btn-pri" style="font-size:10px;padding:3px 9px;flex-shrink:0" onclick="useTemplate(\`${t.body.replace(/`/g,"'")}\`)">Use</button>
      <button class="btn btn-ghost" style="font-size:10px;padding:3px 8px;color:var(--terra);flex-shrink:0" onclick="deleteTemplate('${t.id}')">🗑</button>
    </div>`).join('');
  }
  const starter=document.getElementById('starter-templates');
  if(starter)starter.innerHTML=STARTER_TEMPLATES.map(t=>`<div style="display:flex;align-items:center;justify-content:space-between;padding:8px 12px;background:var(--sand);border-radius:8px">
    <div><div style="font-size:12px;font-weight:600;color:var(--txt)">${catEmoji[t.cat]||'💬'} ${t.name}</div></div>
    <button class="btn btn-ghost" style="font-size:10px;padding:3px 9px" onclick="saveStarterTemplate('${t.name}','${t.cat}')">Save</button>
  </div>`).join('');
}
function saveStarterTemplate(name,cat){
  const tpl=STARTER_TEMPLATES.find(t=>t.name===name&&t.cat===cat);
  if(!tpl)return;
  if(!cData.templates)cData.templates=[];
  if(cData.templates.find(t=>t.name===name)){toast('Already saved!');return;}
  cData.templates.push({id:'tpl_'+Date.now(),name:tpl.name,cat:tpl.cat,body:tpl.body,uses:0,created:Date.now()});
  saveUserData(cUid,cData);renderTemplates();toast(`"${name}" saved to your templates!`);
}
function deleteTemplate(id){cData.templates=(cData.templates||[]).filter(x=>x.id!==id);saveUserData(cUid,cData);renderTemplates();toast('Template deleted');}

// ════════════════════════════════════════════
//  GUEST LOYALTY
// ════════════════════════════════════════════
function getLoyaltyTier(stays){
  if(stays>=10)return{tier:'Platinum',emoji:'🥇',discount:15,color:'var(--terra)'};
  if(stays>=5)return{tier:'Gold',emoji:'🥈',discount:10,color:'var(--txt)'};
  if(stays>=2)return{tier:'Silver',emoji:'🥉',discount:5,color:'var(--gold)'};
  return{tier:'New',emoji:'⭐',discount:0,color:'var(--txt3)'};
}

function addLoyaltyMember(){
  const name=document.getElementById('loy-name').value.trim();
  if(!name){toast('Enter guest name');return;}
  if(!cData.loyaltyMembers)cData.loyaltyMembers=[];
  const stays=parseInt(document.getElementById('loy-stays').value)||0;
  const spent=parseFloat(document.getElementById('loy-spent').value)||0;
  const tier=getLoyaltyTier(stays);
  cData.loyaltyMembers.push({id:'loy_'+Date.now(),name,email:document.getElementById('loy-email').value,stays,spent,notes:document.getElementById('loy-notes').value,tier:tier.tier,created:Date.now()});
  saveUserData(cUid,cData);closeModal('add-loyalty-modal');
  ['loy-name','loy-email','loy-stays','loy-spent','loy-notes'].forEach(id=>{const el=document.getElementById(id);if(el)el.value='';});
  toast(`${name} added — ${tier.emoji} ${tier.tier}!`);renderLoyalty();
}

function renderLoyalty(){
  const members=cData.loyaltyMembers||[];
  const set=(id,v)=>{const el=document.getElementById(id);if(el)el.textContent=v;};
  set('loy-members',members.length);
  set('loy-returns',members.filter(m=>m.stays>1).length);
  const totalDiscount=members.reduce((s,m)=>{const t=getLoyaltyTier(m.stays);return s+(m.spent*(t.discount/100));},0);
  set('loy-discounts','$'+Math.round(totalDiscount).toLocaleString());
  set('loy-revenue','$'+members.reduce((s,m)=>s+m.spent,0).toLocaleString());
  const list=document.getElementById('loyalty-list');
  if(list){
    if(!members.length)list.innerHTML='<div class="empty-state"><div class="es-i">🎁</div><h3>No members yet</h3></div>';
    else list.innerHTML=[...members].sort((a,b)=>b.stays-a.stays).map(m=>{
      const t=getLoyaltyTier(m.stays);
      return `<div class="row" style="cursor:default">
        <div style="width:38px;height:38px;border-radius:50%;background:var(--sand);display:flex;align-items:center;justify-content:center;font-size:18px;flex-shrink:0">${t.emoji}</div>
        <div class="row-info"><div class="row-title">${m.name} <span style="font-size:11px;color:${t.color}">${t.tier}</span></div><div class="row-sub">${m.stays} stay${m.stays!==1?'s':''} · $${m.spent.toLocaleString()} spent${m.email?' · '+m.email:''}</div></div>
        <div style="text-align:right;flex-shrink:0"><div style="font-size:12px;font-weight:600;color:var(--sage)">${t.discount}% off</div><div style="font-size:10px;color:var(--txt3)">discount</div></div>
        <button class="btn btn-ghost" style="font-size:10px;padding:3px 8px;color:var(--terra)" onclick="removeLoyaltyMember('${m.id}')">🗑</button>
      </div>`;
    }).join('');
  }
}
function removeLoyaltyMember(id){cData.loyaltyMembers=(cData.loyaltyMembers||[]).filter(x=>x.id!==id);saveUserData(cUid,cData);renderLoyalty();toast('Member removed');}
function recordLoyaltyStay(id){const m=(cData.loyaltyMembers||[]).find(x=>x.id===id);if(!m)return;m.stays=(m.stays||0)+1;const t=getLoyaltyTier(m.stays);m.tier=t.tier;saveUserData(cUid,cData);renderLoyalty();toast(`${m.name} now has ${m.stays} stay${m.stays!==1?'s':''} — ${t.emoji} ${t.tier}!`);}

// ════════════════════════════════════════════
//  PRICING OPTIMIZER
// ════════════════════════════════════════════
function saveOptimizerSettings(){
  cData.optimizerSettings={
    weekend:parseInt(document.getElementById('opt-weekend')?.value)||25,
    peak:parseInt(document.getElementById('opt-peak')?.value)||40,
    low:parseInt(document.getElementById('opt-low')?.value)||15,
    lastMin:parseInt(document.getElementById('opt-lastmin')?.value)||10,
    longStay:parseInt(document.getElementById('opt-longstay')?.value)||15
  };
  saveUserData(cUid,cData);
}

function runPricingOptimizer(){
  const settings=cData.optimizerSettings||{weekend:25,peak:40,low:15,lastMin:10,longStay:15};
  const el=document.getElementById('pricing-suggestions');
  if(!el)return;
  if(!cData.properties.length){el.innerHTML='<div style="font-size:13px;color:var(--txt3);text-align:center;padding:20px">Add properties first</div>';return;}
  const now=new Date();
  const suggestions=cData.properties.map(p=>{
    const base=p.rate||100;
    const bookings=cData.bookings.filter(b=>b.propId===p.id&&b.status!=='cancelled');
    const occRate=bookings.length?Math.min(95,bookings.length*10):30;
    const demandBonus=occRate>70?15:occRate>50?5:0;
    const today=now.getDay();
    const isWeekend=today===5||today===6;
    const month=now.getMonth();
    const isPeak=month>=5&&month<=8;
    const isLow=month===1||month===2;
    let suggested=base;
    if(isWeekend)suggested=Math.round(suggested*(1+settings.weekend/100));
    if(isPeak)suggested=Math.round(suggested*(1+settings.peak/100));
    if(isLow)suggested=Math.round(suggested*(1-settings.low/100));
    suggested=Math.round(suggested*(1+demandBonus/100));
    const change=Math.round((suggested-base)/base*100);
    return{p,base,suggested,change,isWeekend,isPeak,isLow,occRate};
  });
  el.innerHTML=suggestions.map(s=>`<div class="row" style="cursor:default">
    <div style="font-size:22px">${s.p.emoji}</div>
    <div class="row-info">
      <div class="row-title">${s.p.name}</div>
      <div class="row-sub">${s.occRate}% occ · ${s.isWeekend?'Weekend · ':''}${s.isPeak?'Peak season · ':''}${s.isLow?'Low season · ':''}</div>
    </div>
    <div style="text-align:right;flex-shrink:0">
      <div style="font-size:11px;color:var(--txt3);text-decoration:line-through">$${s.base}/n</div>
      <div style="font-family:Fraunces,serif;font-size:20px;color:${s.change>0?'var(--sage)':'var(--terra)'}">$${s.suggested}/n</div>
    </div>
    <span class="pill ${s.change>0?'pill-green':'pill-red'}">${s.change>0?'+':''}${s.change}%</span>
    <button class="btn btn-pri" style="font-size:10px;padding:3px 9px;flex-shrink:0" onclick="applyOptimizedRate('${s.p.id}',${s.suggested})">Apply</button>
  </div>`).join('');
  // Revenue impact
  const impact=document.getElementById('pricing-impact');
  if(impact){
    const totalCurrentRev=cData.properties.reduce((s,p)=>{const bs=cData.bookings.filter(b=>b.propId===p.id);return s+(bs.length*p.rate*3);},0);
    const totalOptRev=suggestions.reduce((s,sg)=>{const bs=cData.bookings.filter(b=>b.propId===sg.p.id);return s+(bs.length*sg.suggested*3);},0);
    const uplift=totalOptRev-totalCurrentRev;
    impact.innerHTML=`<div class="g2"><div style="background:var(--sand);border-radius:10px;padding:16px;text-align:center"><div style="font-size:11px;color:var(--txt3);margin-bottom:4px">Current Est. Revenue</div><div style="font-family:Fraunces,serif;font-size:24px;color:var(--txt)">$${totalCurrentRev.toLocaleString()}</div></div><div style="background:rgba(107,143,113,.12);border:1px solid var(--sage);border-radius:10px;padding:16px;text-align:center"><div style="font-size:11px;color:var(--txt3);margin-bottom:4px">Optimized Est. Revenue</div><div style="font-family:Fraunces,serif;font-size:24px;color:var(--sage)">$${totalOptRev.toLocaleString()}</div><div style="font-size:11px;color:var(--sage);margin-top:4px">+$${uplift.toLocaleString()} uplift</div></div></div>`;
  }
}
function applyOptimizedRate(propId,rate){
  const p=cData.properties.find(x=>x.id===propId);
  if(p){p.rate=rate;saveUserData(cUid,cData);toast(`${p.name} rate updated to $${rate}/night ✓`);runPricingOptimizer();}
}
function renderPricingImpact(){
  const el=document.getElementById('pricing-impact');if(!el)return;
  const bookings=cData.bookings.filter(b=>b.status!=='cancelled');
  if(!bookings.length){el.innerHTML='<div style="font-size:13px;color:var(--txt3)">Add bookings to see revenue impact</div>';return;}
  const totalRev=bookings.reduce((s,b)=>s+b.price,0);
  const avgNightly=bookings.reduce((s,b)=>s+(b.price/(b.nights||1)),0)/bookings.length;
  const settings=cData.optimizerSettings||{weekend:25,peak:40,low:15};
  const potentialWeekend=Math.round(avgNightly*(1+settings.weekend/100));
  const potentialGain=Math.round((potentialWeekend-avgNightly)*bookings.length*0.3);
  el.innerHTML=`<div class="g2">
    <div style="background:var(--sand);border-radius:10px;padding:14px;text-align:center"><div style="font-size:11px;color:var(--txt3);margin-bottom:4px">Avg Nightly Rate</div><div style="font-family:Fraunces,serif;font-size:24px;color:var(--txt)">$${Math.round(avgNightly)}</div></div>
    <div style="background:rgba(107,143,113,.12);border:1px solid var(--sage);border-radius:10px;padding:14px;text-align:center"><div style="font-size:11px;color:var(--txt3);margin-bottom:4px">Est. Revenue Uplift</div><div style="font-family:Fraunces,serif;font-size:24px;color:var(--sage)">+$${potentialGain.toLocaleString()}</div></div>
  </div>
  <div style="margin-top:12px;font-size:12px;color:var(--txt2);line-height:1.6">Based on your <strong>${bookings.length} bookings</strong>, applying weekend and seasonal pricing could increase revenue by ~<strong>$${potentialGain.toLocaleString()}/year</strong>.</div>`;
}


function renderScorecards(){
  {
    const _sp=cData.properties||[];
    const _sb=(cData.bookings||[]).filter(b=>b.status!=='cancelled');
    const _ss=(id,v)=>{const el=document.getElementById(id);if(el)el.textContent=v;};
    const _socc=_sp.length?Math.round(_sp.reduce((s,p)=>s+(p.occupancy||0),0)/_sp.length)+'%':'—';
    const _srated=_sp.filter(p=>p.rating);
    const _srat=_srated.length?(_srated.reduce((s,p)=>s+parseFloat(p.rating||0),0)/_srated.length).toFixed(2)+'★':'—';
    const _srev=_sb.reduce((s,b)=>s+(b.price||0),0);
    const _stop=_sp.length?_sp.reduce((a,b)=>(a.occupancy||0)>(b.occupancy||0)?a:b,_sp[0]):null;
    _ss('sc-occ',_socc);_ss('sc-rating',_srat);
    _ss('sc-rev','$'+_srev.toLocaleString());
    _ss('sc-top',_stop?_stop.emoji+' '+_stop.name:'—');
  }

  const grid=document.getElementById('scorecards-grid');
  if(!grid)return;
  if(!cData.properties.length){grid.innerHTML='<div class="empty-state"><div class="es-i">🏆</div><h3>No properties yet</h3></div>';return;}
  grid.innerHTML=cData.properties.map(p=>{
    const bookings=cData.bookings.filter(b=>b.propId===p.id&&b.status!=='cancelled');
    const revenue=bookings.reduce((s,b)=>s+b.price,0);
    const avgStay=bookings.length?Math.round(bookings.reduce((s,b)=>s+(b.nights||1),0)/bookings.length):0;
    const occupancy=p.occupancy||0;
    const rating=parseFloat(p.rating||0);
    const expenses=(cData.expenses||[]).filter(e=>e.propId===p.id).reduce((s,e)=>s+e.amount,0);
    const profit=revenue-expenses;
    const margin=revenue?Math.round(profit/revenue*100):0;
    // Score out of 100
    const revScore=Math.min(30,Math.round(revenue/100));
    const occScore=Math.round(occupancy/100*25);
    const ratingScore=Math.round((rating/5)*25);
    const bookingScore=Math.min(20,bookings.length*2);
    const totalScore=Math.min(100,revScore+occScore+ratingScore+bookingScore);
    const grade=totalScore>=80?{g:'A',c:'var(--sage)'}:totalScore>=60?{g:'B',c:'var(--gold)'}:totalScore>=40?{g:'C',c:'var(--terra)'}:{g:'D',c:'#999'};
    return `<div class="card">
      <div class="card-hd">
        <div style="display:flex;align-items:center;gap:12px">
          <div style="font-size:28px">${p.emoji}</div>
          <div><div class="card-title">${p.name}</div><div style="font-size:12px;color:var(--txt2)">${p.location||'No location'}</div></div>
        </div>
        <div style="text-align:center"><div style="font-family:Fraunces,serif;font-size:42px;font-weight:700;color:${grade.c};line-height:1">${grade.g}</div><div style="font-size:11px;color:var(--txt3)">${totalScore}/100</div></div>
      </div>
      <div class="card-body">
        <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:16px">
          <div style="text-align:center;background:var(--sand);border-radius:8px;padding:10px"><div style="font-family:Fraunces,serif;font-size:20px;color:var(--txt)">$${revenue.toLocaleString()}</div><div style="font-size:10px;color:var(--txt3)">Revenue</div></div>
          <div style="text-align:center;background:var(--sand);border-radius:8px;padding:10px"><div style="font-family:Fraunces,serif;font-size:20px;color:var(--txt)">${occupancy}%</div><div style="font-size:10px;color:var(--txt3)">Occupancy</div></div>
          <div style="text-align:center;background:var(--sand);border-radius:8px;padding:10px"><div style="font-family:Fraunces,serif;font-size:20px;color:var(--txt)">⭐${rating}</div><div style="font-size:10px;color:var(--txt3)">Rating</div></div>
          <div style="text-align:center;background:var(--sand);border-radius:8px;padding:10px"><div style="font-family:Fraunces,serif;font-size:20px;color:${margin>=0?'var(--sage)':'var(--terra)'}"> ${margin}%</div><div style="font-size:10px;color:var(--txt3)">Margin</div></div>
        </div>
        <div style="display:flex;flex-direction:column;gap:6px">
          ${[{label:'Revenue Score',score:revScore,max:30},{label:'Occupancy Score',score:occScore,max:25},{label:'Rating Score',score:ratingScore,max:25},{label:'Booking Volume',score:bookingScore,max:20}].map(m=>`<div style="display:flex;align-items:center;gap:10px">
            <div style="font-size:11px;color:var(--txt2);width:130px;flex-shrink:0">${m.label}</div>
            <div style="flex:1;background:var(--border);border-radius:4px;height:6px;overflow:hidden"><div style="width:${Math.round(m.score/m.max*100)}%;height:100%;background:${grade.c};border-radius:4px"></div></div>
            <div style="font-size:11px;color:var(--txt3);width:40px;text-align:right">${m.score}/${m.max}</div>
          </div>`).join('')}
        </div>
        ${bookings.length===0?`<div style="margin-top:12px;font-size:12px;color:var(--terra)">💡 Add bookings for this property to improve your score</div>`:''}
      </div>
    </div>`;
  }).join('');
}

// ════════════════════════════════════════════
//  SMART NOTIFICATIONS
// ════════════════════════════════════════════
function buildSmartNotificationItems(){
  const notes=[];
  const now=new Date();
  const today=now.toISOString().slice(0,10);
  const in2days=new Date(now.getTime()+2*86400000).toISOString().slice(0,10);
  const in7days=new Date(now.getTime()+7*86400000).toISOString().slice(0,10);
  const bid=b=>b.id||('legacy_'+String(b.checkin)+'_'+String(b.guestName||'')+'_'+String(b.propId||''));
  cData.bookings.filter(b=>b.checkin>=today&&b.checkin<=in2days&&b.status==='confirmed').forEach(b=>{
    notes.push({nid:'smart:checkin:'+bid(b),type:'checkin',icon:'🔑',title:`Check-in: ${b.guestName}`,desc:`${b.propName} · ${b.checkin}`,urgency:b.checkin===today?'high':'medium',link:'bookings'});
  });
  cData.bookings.filter(b=>b.checkout>=today&&b.checkout<=in2days&&b.status==='confirmed').forEach(b=>{
    notes.push({nid:'smart:checkout:'+bid(b),type:'checkout',icon:'🚪',title:`Checkout: ${b.guestName}`,desc:`${b.propName} · ${b.checkout}`,urgency:b.checkout===today?'high':'medium',link:'bookings'});
  });
  cData.tasks?.filter(t=>!t.done&&t.due&&t.due<today).forEach(t=>{
    const tid=t.id||('t_'+String(t.title)+'_'+String(t.due));
    notes.push({nid:'smart:task:'+tid,type:'task',icon:'⚠️',title:`Overdue: ${t.title}`,desc:`Due ${t.due}`,urgency:'high',link:'cleaning'});
  });
  cData.inventory?.filter(i=>i.qty<=i.threshold).forEach(i=>{
    const iid=i.id||('inv_'+String(i.name)+'_'+String(i.propId||''));
    notes.push({nid:'smart:inv:'+iid,type:'inventory',icon:'📦',title:`${i.qty===0?'Out of stock':'Low stock'}: ${i.name}`,desc:`${i.qty} ${i.unit} left at ${i.propName}`,urgency:i.qty===0?'high':'medium',link:'inventory'});
  });
  const urgentWO=(cData.workorders||[]).filter(w=>w.status==='open'&&w.priority==='urgent');
  urgentWO.forEach(w=>{
    const wid=w.id||('wo_'+String(w.title)+'_'+String(w.created||''));
    notes.push({nid:'smart:wo:'+wid,type:'workorder',icon:'🔧',title:`Urgent: ${w.title}`,desc:w.propName,urgency:'high',link:'workorders'});
  });
  cData.bookings.filter(b=>b.checkin>=today&&b.checkin<=in7days&&b.status==='confirmed').forEach(b=>{
    const hasTask=cData.tasks?.some(t=>t.propId===b.propId&&t.due===b.checkin&&!t.done);
    if(!hasTask)notes.push({nid:'smart:cleaning:'+bid(b),type:'cleaning',icon:'🧹',title:`No cleaner assigned: ${b.propName}`,desc:`Guest checks in ${b.checkin}`,urgency:'medium',link:'cleaning'});
  });
  return notes.sort((a,b)=>a.urgency==='high'&&b.urgency!=='high'?-1:1);
}
function getSmartNotifications(){
  const read=new Set(cData.readSmartNids||[]);
  return buildSmartNotificationItems().filter(n=>!read.has(n.nid));
}
function markSmartNotifRead(nid){
  if(!nid||!cUid)return;
  if(!cData.readSmartNids)cData.readSmartNids=[];
  if(cData.readSmartNids.includes(nid)){renderNotifDropdown();return;}
  cData.readSmartNids.push(nid);
  saveUserData(cUid,cData);
  renderNotifDropdown();
}
function markAllSmartNotifsRead(){
  if(!cUid)return;
  const all=buildSmartNotificationItems();
  if(!all.length){renderNotifDropdown();return;}
  if(!cData.readSmartNids)cData.readSmartNids=[];
  const s=new Set(cData.readSmartNids);
  all.forEach(x=>s.add(x.nid));
  cData.readSmartNids=[...s];
  saveUserData(cUid,cData);
  renderNotifDropdown();
}

function renderNotifDropdown(){
  const notes=getSmartNotifications();
  const badge=document.getElementById('notif-badge');
  if(badge){
    badge.textContent=notes.length;
    badge.style.display=notes.length?'flex':'none';
  }
  const panel=document.getElementById('notif-panel');
  if(!panel)return;
  if(!notes.length){panel.innerHTML='<div style="padding:20px;text-align:center;font-size:13px;color:var(--txt3)">✅ All clear — no urgent notifications</div>';hhEnhanceClickableAria(panel);return;}
  const urgColors={high:'var(--terra)',medium:'var(--gold)'};
  panel.innerHTML=notes.map(n=>{const albl=String(n.title).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;');return `<div role="button" tabindex="0" aria-label="${albl}" onclick="markSmartNotifRead(${JSON.stringify(n.nid)});nav('${n.link}',document.querySelector('[onclick*=${n.link}]'));closeNotifPanel()" style="display:flex;gap:10px;align-items:flex-start;padding:12px 16px;border-bottom:1px solid var(--border);cursor:pointer;transition:background .15s" onmouseover="this.style.background='var(--sand)'" onmouseout="this.style.background=''">
    <div style="font-size:20px;flex-shrink:0">${n.icon}</div>
    <div style="flex:1"><div style="font-size:13px;font-weight:600;color:var(--txt)">${n.title}</div><div style="font-size:11px;color:var(--txt2)">${n.desc}</div></div>
    <div style="width:8px;height:8px;border-radius:50%;background:${urgColors[n.urgency]||'var(--txt3)'};flex-shrink:0;margin-top:5px"></div>
  </div>`;}).join('');
  hhEnhanceClickableAria(panel);
}

function openNotifPanel(){
  renderNotifDropdown();
  const panel=document.getElementById('notif-dropdown');
  if(panel)panel.style.display=panel.style.display==='block'?'none':'block';
}
function closeNotifPanel(){const p=document.getElementById('notif-dropdown');if(p)p.style.display='none';}
function showLegal(type) {
  const title = document.getElementById('legal-title');
  const content = document.getElementById('legal-content');
  if(type === 'terms') {
    if(title) title.textContent = 'Terms of Service';
    if(content) content.innerHTML = `
      <p><strong>Last updated: March 2026</strong></p>
      <p>By using CSO Property Services ("Service"), you agree to these Terms of Service. Please read them carefully.</p>
      <h3 style="color:var(--txt);margin:14px 0 6px">1. Acceptance of Terms</h3>
      <p>By accessing or using CSO Property Services, you agree to be bound by these Terms. If you do not agree, do not use the Service.</p>
      <h3 style="color:var(--txt);margin:14px 0 6px">2. Description of Service</h3>
      <p>CSO Property Services is a property management platform for short-term rental hosts. We provide tools for booking management, guest communication, and analytics.</p>
      <h3 style="color:var(--txt);margin:14px 0 6px">3. Subscription & Billing</h3>
      <p>Paid plans are billed monthly or annually. You may cancel at any time through the billing portal. Refunds are not provided for partial months. We reserve the right to change pricing with 30 days notice.</p>
      <h3 style="color:var(--txt);margin:14px 0 6px">4. Free Trial</h3>
      <p>No credit card is required to start your free trial. At the end of the 14-day trial period, your account automatically reverts to the Free plan. To continue using Pro features, you will need to upgrade to a paid plan.</p>
      <h3 style="color:var(--txt);margin:14px 0 6px">5. User Data</h3>
      <p>You retain ownership of all data you enter into CSO Property Services. We store your data securely using Supabase. We do not sell your data to third parties.</p>
      <h3 style="color:var(--txt);margin:14px 0 6px">6. Acceptable Use</h3>
      <p>You agree not to misuse the Service, attempt to gain unauthorized access, or use the Service for illegal purposes.</p>
      <h3 style="color:var(--txt);margin:14px 0 6px">7. Limitation of Liability</h3>
      <p>CSO Property Services is provided "as is" without warranties. We are not liable for any indirect or consequential damages arising from your use of the Service.</p>
      <h3 style="color:var(--txt);margin:14px 0 6px">8. Contact</h3>
      <p>Questions? Email us at <a href="mailto:csopropertyservice@gmail.com" style="color:var(--terra)">csopropertyservice@gmail.com</a></p>`;
  } else {
    if(title) title.textContent = 'Privacy Policy';
    if(content) content.innerHTML = `
      <p><strong>Last updated: March 2026</strong></p>
      <p>CSO Property Services ("we", "us") is committed to protecting your privacy. This policy explains how we collect, use, and protect your information.</p>
      <h3 style="color:var(--txt);margin:14px 0 6px">1. Information We Collect</h3>
      <p>We collect information you provide directly: name, email address, property details, booking information, and payment information (processed securely by Stripe — we never store card details).</p>
      <h3 style="color:var(--txt);margin:14px 0 6px">2. How We Use Your Information</h3>
      <p>We use your information to provide and improve the Service, send transactional emails (booking notifications, welcome emails), and respond to support requests. We do not use your data for advertising.</p>
      <h3 style="color:var(--txt);margin:14px 0 6px">3. Data Storage</h3>
      <p>Your data is stored securely using Supabase (PostgreSQL database hosted on AWS). Data is encrypted at rest and in transit.</p>
      <h3 style="color:var(--txt);margin:14px 0 6px">4. Third-Party Services</h3>
      <p>We use Stripe for payments, Resend for email delivery, and Supabase for database and authentication. Each has their own privacy policy.</p>
      <h3 style="color:var(--txt);margin:14px 0 6px">5. Data Retention</h3>
      <p>We retain your data as long as your account is active. You may request deletion of your account and data at any time by emailing us.</p>
      <h3 style="color:var(--txt);margin:14px 0 6px">6. Your Rights</h3>
      <p>You have the right to access, correct, or delete your personal data. Contact us at <a href="mailto:csopropertyservice@gmail.com" style="color:var(--terra)">csopropertyservice@gmail.com</a> to exercise these rights.</p>
      <h3 style="color:var(--txt);margin:14px 0 6px">7. Cookies</h3>
      <p>We use only essential cookies for authentication. We do not use tracking or advertising cookies.</p>
      <h3 style="color:var(--txt);margin:14px 0 6px">8. Contact</h3>
      <p>Privacy questions? Email <a href="mailto:csopropertyservice@gmail.com" style="color:var(--terra)">csopropertyservice@gmail.com</a></p>`;
  }
  // Use direct classList instead of openModal to avoid cData dependency
  document.getElementById('legal-modal').classList.add('open');
}

// ════════════════════════════════════════════
//  AUTO ICAL SYNC ON LOGIN
// ════════════════════════════════════════════
async function autoSyncICals() {
  const icals = cData.icals||[];
  if(!icals.length) return;
  let newBookings = 0;
  for(const ic of icals) {
    try {
      const result = await syncIcalUrl(ic.url, ic.propId, ic.propName);
      newBookings += result.count;
      ic.lastSync = new Date().toLocaleString();
      ic.status = 'synced';
      // GAP 6: Smart cleaning window — after sync, calculate gaps between bookings
      smartScheduleCleaningWindows(ic.propId);
    } catch(e) {
      ic.status = 'error';
    }
  }
  if(newBookings > 0) {
    saveUserData(cUid, cData);
    renderBookings();
    renderDashboard();
    toast(`📅 iCal sync: ${newBookings} new booking${newBookings!==1?'s':''} imported!`);
  }
}

// ════════════════════════════════════════════
//  GAP 1 — JOB NOTIFICATIONS (SMS/WhatsApp)
// ════════════════════════════════════════════
function notifyCleanerJob(job) {
  const cleaner = (cData.cleaners||[]).find(c=>c.id===job.cleanerId);
  if(!cleaner || !cleaner.phone) return;
  const prop = (cData.properties||[]).find(p=>p.id===job.propId);
  const jobLink = window.location.origin + window.location.pathname + '?job=' + job.id;
  const typeLabels = {turnover:'Turnover Clean',deep:'Deep Clean',inspect:'Inspection',laundry:'Laundry'};
  const msg = `Hi ${cleaner.name}! 🧹 New job at ${job.propName}:\n\n📅 ${job.date} at ${job.time}\n🏠 ${typeLabels[job.type]||job.type}\n💰 $${job.cleanerPay||job.pay}\n\n${prop?.doorCode?'🔑 Door code: '+prop.doorCode+'\n':''}${job.notes?'📝 '+job.notes+'\n':''}\nView & complete your job here:\n${jobLink}`;

  // Show notification modal with SMS + WhatsApp options
  const existing = document.getElementById('notify-cleaner-modal');
  if(existing) existing.remove();
  const modal = document.createElement('div');
  modal.id = 'notify-cleaner-modal';
  modal.className = 'modal-bg open';
  modal.innerHTML = `
    <div class="modal" style="max-width:400px">
      <h2>📱 Notify ${cleaner.name}</h2>
      <div style="font-size:13px;color:var(--txt2);margin-bottom:16px">Send the job details and link to your cleaner:</div>
      <div style="background:var(--sand);border-radius:10px;padding:12px;font-size:12px;color:var(--txt2);white-space:pre-wrap;margin-bottom:16px;line-height:1.6;max-height:180px;overflow-y:auto">${msg.replace(/</g,'&lt;')}</div>
      <div style="display:flex;flex-direction:column;gap:8px">
        <a href="sms:${cleaner.phone}?body=${encodeURIComponent(msg)}" class="btn btn-pri btn-w" style="text-decoration:none;text-align:center">💬 Open in SMS</a>
        <a href="https://wa.me/${cleaner.phone.replace(/\D/g,'')}?text=${encodeURIComponent(msg)}" target="_blank" class="btn btn-w" style="background:#25D366;color:#fff;border:none;border-radius:8px;padding:12px;font-size:14px;font-weight:600;cursor:pointer;text-decoration:none;text-align:center">💚 Open in WhatsApp</a>
        <button class="btn btn-ghost btn-w" onclick="navigator.clipboard.writeText(${JSON.stringify(msg)}).then(()=>toast('Copied! Paste into any messaging app'));document.getElementById('notify-cleaner-modal').remove()">📋 Copy Message</button>
        <button class="btn btn-ghost btn-w" onclick="document.getElementById('notify-cleaner-modal').remove()">Skip for now</button>
      </div>
    </div>`;
  document.body.appendChild(modal);
}

// ════════════════════════════════════════════
//  GAP 2+3 — CLEANER ACCEPTS/DECLINES + SUBMITS COMPLETION
//  (handled via shareable job card — see renderCleanerJobCard below)
//  Host side: update job status from card submissions via localStorage bridge
// ════════════════════════════════════════════
function checkJobCardUpdates() {
  // Poll for updates cleaners submitted via their job card (localStorage bridge)
  try {
    const updates = JSON.parse(localStorage.getItem('hh_job_updates') || '[]');
    if(!updates.length) return;
    let changed = false;
    updates.forEach(function(upd) {
      const job = (cData.jobs||[]).find(j=>j.id===upd.jobId);
      if(!job) return;
      if(upd.action==='accept' && job.status==='open') { job.status='assigned'; job.acceptedAt=upd.time; changed=true; }
      if(upd.action==='decline' && job.status==='open') { job.status='declined'; job.declinedAt=upd.time; changed=true; }
      if(upd.action==='start' && (job.status==='assigned'||job.status==='open')) { job.status='in_progress'; job.startedAt=upd.time; job.lastHeartbeat=upd.time; job.heartbeatAlerted=false; changed=true; }
      if(upd.action==='heartbeat') { job.lastHeartbeat=upd.time; job.heartbeatAlerted=false; changed=true; }
      if(upd.action==='complete') {
        job.status='completed'; job.completedAt=upd.time;
        if(upd.photos) job.completionPhotos = upd.photos;
        if(upd.notes) job.completionNotes = upd.notes;
        changed=true;
        toast('✅ '+job.cleanerName+' completed job at '+job.propName+'!');
      }
    });
    if(changed) { saveUserData(cUid,cData); renderMarketplace(); }
    localStorage.removeItem('hh_job_updates');
  } catch(e){}
}

// ════════════════════════════════════════════
//  GAP 4 — QUALITY SCORING PER JOB
// ════════════════════════════════════════════
function promptJobQualityScore(jobId) {
  const j = (cData.jobs||[]).find(x=>x.id===jobId);
  if(!j) return;
  const existing = document.getElementById('job-score-modal');
  if(existing) existing.remove();
  const modal = document.createElement('div');
  modal.id = 'job-score-modal';
  modal.className = 'modal-bg open';
  modal.innerHTML = `
    <div class="modal" style="max-width:380px;text-align:center">
      <div style="font-size:40px;margin-bottom:8px">⭐</div>
      <h2>Rate This Job</h2>
      <div style="font-size:13px;color:var(--txt2);margin-bottom:20px">${j.cleanerName} · ${j.propName} · ${j.date}</div>
      <div style="display:flex;justify-content:center;gap:10px;margin-bottom:16px" id="job-score-stars">
        ${[1,2,3,4,5].map(n=>`<span data-score="${n}" onclick="selectJobScore(${n})" style="font-size:36px;cursor:pointer;opacity:.4;transition:opacity .15s">⭐</span>`).join('')}
      </div>
      <div class="fi" style="text-align:left"><label>Notes (optional)</label><textarea id="job-score-notes" style="width:100%;background:var(--input-bg);border:1.5px solid var(--input-border);border-radius:8px;padding:10px;font-size:13px;color:var(--txt);font-family:'DM Sans',sans-serif;min-height:60px;outline:none" placeholder="Any issues? Great work to note?"></textarea></div>
      <div style="display:flex;gap:8px;margin-top:8px">
        <button class="btn btn-ghost btn-w" onclick="document.getElementById('job-score-modal').remove()">Skip</button>
        <button class="btn btn-pri btn-w" onclick="saveJobScore('${jobId}')">Save Rating</button>
      </div>
    </div>`;
  document.body.appendChild(modal);
}

let _selectedJobScore = 0;
function selectJobScore(n) {
  _selectedJobScore = n;
  document.querySelectorAll('#job-score-stars span').forEach(function(s) {
    s.style.opacity = parseInt(s.dataset.score) <= n ? '1' : '0.25';
  });
}

function saveJobScore(jobId) {
  if(!_selectedJobScore) { toast('Select a star rating first'); return; }
  const j = (cData.jobs||[]).find(x=>x.id===jobId);
  if(!j) return;
  j.qualityScore = _selectedJobScore;
  j.qualityNotes = document.getElementById('job-score-notes')?.value || '';
  // Update cleaner's rolling average rating
  const cleaner = (cData.cleaners||[]).find(c=>c.id===j.cleanerId || c.name===j.cleanerName);
  if(cleaner) {
    const scoredJobs = (cData.jobs||[]).filter(x=>x.cleanerId===cleaner.id && x.qualityScore);
    const avg = scoredJobs.reduce((s,x)=>s+x.qualityScore,0) / scoredJobs.length;
    cleaner.rating = Math.round(avg*10)/10;
  }
  saveUserData(cUid, cData);
  document.getElementById('job-score-modal')?.remove();
  _selectedJobScore = 0;
  renderMarketplace();
  toast('Rating saved! ⭐'.repeat(_selectedJobScore||1).slice(0,6));
}

// ════════════════════════════════════════════
//  GAP 5 — GUEST AUTO-CHECKOUT DETECTION
// ════════════════════════════════════════════
function checkoutMonitor() {
  if(!cData) return;
  const now = new Date();
  const today = now.toISOString().slice(0,10);
  const currentTime = now.getHours() * 60 + now.getMinutes(); // minutes since midnight
  const checkouts = (cData.bookings||[]).filter(b =>
    b.status === 'confirmed' && b.checkout === today
  );
  if(!checkouts.length) return;
  const alerts = [];
  checkouts.forEach(function(b) {
    const prop = (cData.properties||[]).find(p=>p.id===b.propId);
    const checkoutTimeStr = prop?.checkoutTime || '11:00';
    const [ch, cm] = checkoutTimeStr.split(':').map(Number);
    const checkoutMins = ch * 60 + (cm||0);
    const graceMins = 30;
    const hasCleaningTask = (cData.tasks||[]).some(t=>
      t.propId===b.propId && t.due===today && (t.type==='cleaning'||t.title?.toLowerCase().includes('clean')) && !t.done
    );
    const hasJob = (cData.jobs||[]).some(j=>
      j.propId===b.propId && j.date===today && j.status!=='completed'
    );
    if(currentTime > checkoutMins + graceMins) {
      alerts.push({
        booking: b,
        prop,
        checkoutTime: checkoutTimeStr,
        hasCleaning: hasCleaningTask || hasJob,
        minsLate: currentTime - checkoutMins
      });
    }
  });
  if(!alerts.length) return;
  // Show dashboard alert
  const alertEl = document.getElementById('checkout-monitor-alert');
  if(alertEl) {
    alertEl.style.display = 'block';
    alertEl.innerHTML = alerts.map(a=>`
      <div style="display:flex;align-items:center;gap:12px;background:rgba(196,105,58,.08);border:1px solid var(--terra-l);border-radius:8px;padding:10px 14px;margin-bottom:8px">
        <div style="font-size:18px">🚪</div>
        <div style="flex:1;font-size:13px;color:var(--txt)">
          <strong>${a.booking.guestName}</strong> checked out at ${a.prop?.name||a.booking.propName}
          <span style="color:var(--terra)"> · ${Math.round(a.minsLate/60*10)/10}hr${a.minsLate>60?'s':''} past checkout</span>
          ${a.hasCleaning ? '<span style="color:var(--sage);font-size:11px;margin-left:6px">✓ Cleaning scheduled</span>' : '<span style="color:var(--terra);font-size:11px;margin-left:6px">⚠ No cleaning task!</span>'}
        </div>
        ${!a.hasCleaning ? `<button class="btn btn-ghost" style="font-size:11px;padding:4px 10px;white-space:nowrap" onclick="openModal('hire-cleaner-modal')">+ Schedule Clean</button>` : ''}
      </div>`).join('');
  }
}

// ════════════════════════════════════════════
//  GAP 6 — ICAL SMART CLEANING WINDOW
// ════════════════════════════════════════════
function smartScheduleCleaningWindows(propId) {
  const propBookings = (cData.bookings||[])
    .filter(b => b.propId===propId && b.status!=='cancelled' && b.checkin && b.checkout)
    .sort((a,b) => a.checkout.localeCompare(b.checkout));

  propBookings.forEach(function(b, i) {
    const nextBooking = propBookings[i+1];
    const checkoutDate = b.checkout;
    const nextCheckin = nextBooking?.checkin;

    // Calculate gap in hours
    let gapHours = null;
    if(nextCheckin) {
      const co = new Date(checkoutDate);
      const ci = new Date(nextCheckin);
      gapHours = (ci - co) / (1000*60*60);
    }

    // Add cleaning window data to booking
    b.cleaningWindow = {
      date: checkoutDate,
      nextCheckin: nextCheckin || null,
      gapHours: gapHours,
      tight: gapHours !== null && gapHours < 4,
      windowLabel: gapHours === null ? 'Open ended' :
        gapHours < 2 ? '⚠️ Under 2hrs — urgent!' :
        gapHours < 4 ? '⚡ '+Math.round(gapHours)+'hr window — tight' :
        '✅ '+Math.round(gapHours)+'hr window'
    };

    // Auto-suggest cleaning task if tight window and no task exists
    if(b.cleaningWindow.tight) {
      const hasTask = (cData.tasks||[]).some(t=>t.propId===propId&&t.due===checkoutDate&&!t.done);
      if(!hasTask) {
        setTimeout(function() {
          toast(`⚡ Tight turnover at ${b.propName} on ${checkoutDate} — only ${Math.round(gapHours)}hr window!`);
        }, 1500);
      }
    }
  });
}

// ════════════════════════════════════════════
//  GAP 7 — CLEANER MULTI-PROPERTY + GAP 8 — EARNINGS HISTORY
// ════════════════════════════════════════════
function renderCleanerEarnings(cleanerId) {
  const cleaner = (cData.cleaners||[]).find(c=>c.id===cleanerId);
  if(!cleaner) return;
  const jobs = (cData.jobs||[]).filter(j=>j.cleanerId===cleanerId||j.cleanerName===cleaner.name);
  const payouts = (cData.payouts||[]).filter(p=>p.cleaner===cleanerId||p.cleanerName===cleaner.name);
  const totalEarned = payouts.reduce((s,p)=>s+(p.owed||0),0);
  const totalPaid = payouts.filter(p=>p.status==='paid').reduce((s,p)=>s+(p.owed||0),0);
  const outstanding = totalEarned - totalPaid;
  const avgScore = jobs.filter(j=>j.qualityScore).length
    ? (jobs.filter(j=>j.qualityScore).reduce((s,j)=>s+j.qualityScore,0)/jobs.filter(j=>j.qualityScore).length).toFixed(1)
    : '—';

  const existing = document.getElementById('cleaner-earnings-modal');
  if(existing) existing.remove();
  const modal = document.createElement('div');
  modal.id = 'cleaner-earnings-modal';
  modal.className = 'modal-bg open';
  modal.innerHTML = `
    <div class="modal" style="max-width:500px">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px">
        <h2>💰 ${cleaner.name} — Earnings</h2>
        <button class="btn btn-ghost" onclick="document.getElementById('cleaner-earnings-modal').remove()" style="padding:5px 10px">✕</button>
      </div>
      <div class="g4" style="margin-bottom:18px">
        <div style="background:var(--sand);border-radius:10px;padding:12px;text-align:center"><div style="font-size:10px;color:var(--txt3);margin-bottom:3px">Total Jobs</div><div style="font-family:Fraunces,serif;font-size:22px;color:var(--txt)">${jobs.length}</div></div>
        <div style="background:var(--sand);border-radius:10px;padding:12px;text-align:center"><div style="font-size:10px;color:var(--txt3);margin-bottom:3px">Total Earned</div><div style="font-family:Fraunces,serif;font-size:22px;color:var(--sage)">$${totalEarned.toLocaleString()}</div></div>
        <div style="background:${outstanding>0?'rgba(196,105,58,.08)':'var(--sand)'};border-radius:10px;padding:12px;text-align:center"><div style="font-size:10px;color:var(--txt3);margin-bottom:3px">Outstanding</div><div style="font-family:Fraunces,serif;font-size:22px;color:${outstanding>0?'var(--terra)':'var(--txt3)'}">$${outstanding.toLocaleString()}</div></div>
        <div style="background:var(--sand);border-radius:10px;padding:12px;text-align:center"><div style="font-size:10px;color:var(--txt3);margin-bottom:3px">Avg Quality</div><div style="font-family:Fraunces,serif;font-size:22px;color:var(--gold)">${avgScore==='—'?'—':'⭐'+avgScore}</div></div>
      </div>
      <div style="max-height:280px;overflow-y:auto">
        ${jobs.length===0?'<div class="empty-state"><div class="es-i">📋</div><p>No jobs yet</p></div>':
        jobs.slice().reverse().map(function(j){
          const sc={open:'pill-amber',assigned:'pill-blue',in_progress:'pill-blue',completed:'pill-green',declined:'pill-red'};
          const payout = payouts.find(p=>p.jobId===j.id);
          return `<div style="display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid var(--border)">
            <div style="flex:1"><div style="font-size:13px;font-weight:500;color:var(--txt)">${j.propName}</div>
            <div style="font-size:11px;color:var(--txt3)">${j.date} · ${j.type}${j.qualityScore?' · ⭐'+j.qualityScore:''}</div></div>
            <span class="pill ${sc[j.status]||'pill-amber'}" style="font-size:10px">${j.status.replace('_',' ')}</span>
            <div style="text-align:right;flex-shrink:0">
              <div style="font-size:13px;font-weight:600;color:var(--sage)">$${(j.cleanerPay||j.pay||0).toLocaleString()}</div>
              <div style="font-size:10px;color:${payout?.status==='paid'?'var(--sage)':'var(--terra)'};">${payout?.status==='paid'?'✓ Paid':'Pending'}</div>
            </div>
          </div>`;
        }).join('')}
      </div>
      <div style="margin-top:14px;display:flex;gap:8px">
        <button class="btn btn-ghost btn-w" onclick="document.getElementById('cleaner-earnings-modal').remove()">Close</button>
        ${outstanding>0?`<button class="btn btn-pri btn-w" onclick="document.getElementById('cleaner-earnings-modal').remove();setTimeout(()=>nav('payouts',document.querySelector('[onclick*=payouts]')),100)">💳 View Payouts</button>`:''}
      </div>
    </div>`;
  document.body.appendChild(modal);
}

// ════════════════════════════════════════════
//  GAP 9 — CLEANER PWA JOB CARD
//  Renders a full-page offline-capable job card when ?job=ID is in URL
// ════════════════════════════════════════════
function renderCleanerJobCard(jobId) {
  // Try to load job from all user data in localStorage
  let job = null;
  let prop = null;
  let checklist = null;

  try {
    const allData = JSON.parse(localStorage.getItem('hh_local_v1') || '{}');
    // Search across all user blobs
    Object.values(allData.blob || allData).forEach(function(userData) {
      if(typeof userData !== 'object') return;
      const found = (userData.jobs||[]).find(j=>j.id===jobId);
      if(found) {
        job = found;
        prop = (userData.properties||[]).find(p=>p.id===found.propId);
        checklist = userData.invChecklist || [];
      }
    });
  } catch(e) {}

  const typeLabels = {turnover:'Turnover Clean',deep:'Deep Clean',inspect:'Inspection',laundry:'Laundry Only'};
  const statusColor = {open:'#C8A84B',assigned:'#3B82F6',in_progress:'#6B8F71',completed:'#6B8F71',declined:'#C4693A'};

  document.body.style.cssText = 'margin:0;padding:0;font-family:DM Sans,sans-serif;background:#FAF7F2;min-height:100vh;min-height:100dvh';
  document.head.insertAdjacentHTML('beforeend','<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><meta name="theme-color" content="#C4693A">');

  if(!job) {
    document.body.innerHTML = `<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;padding:32px;text-align:center"><div style="font-size:52px;margin-bottom:16px">🔍</div><div style="font-family:Georgia,serif;font-size:24px;color:#2C1F14;margin-bottom:8px">Job Not Found</div><div style="font-size:14px;color:#6B5D52;line-height:1.6">This job link may have expired or been completed. Contact your host for a new link.</div></div>`;
    return;
  }

  // Dynamic checklist based on job type
  const _cl = getChecklistForJobType(job.type||'turnover');
  const _allItems = _cl.sections.reduce((arr,s)=>arr.concat(s.items),[]);

  let checkItems = _allItems.length ? _allItems : ['Strip and replace all bed linens','Wipe all surfaces and furniture','Clean bathrooms (toilet, sink, shower)','Mop or vacuum all floors','Restock toiletries and amenities','Empty all trash bins','Check and restock kitchen supplies','Wipe down kitchen appliances','Check for guest left items','Final walkthrough — close windows, lock doors'];
  let checkState = {};
  try { checkState = JSON.parse(localStorage.getItem('hh_job_check_'+jobId)||'{}'); } catch(e){}

  function saveJobUpdate(action, extra) {
    try {
      const updates = JSON.parse(localStorage.getItem('hh_job_updates')||'[]');
      updates.push(Object.assign({jobId, action, time:new Date().toISOString()}, extra||{}));
      localStorage.setItem('hh_job_updates', JSON.stringify(updates));
    } catch(e){}
  }

  function render() {
    const done = checkItems.filter((_,i)=>checkState[i]).length;
    const pct = Math.round(done/checkItems.length*100);
    const statusLabel = {open:'Pending Acceptance',assigned:'Accepted — Not Started',in_progress:'In Progress',completed:'✅ Completed',declined:'Declined'}[job.status] || job.status;

    document.body.innerHTML = `
      <div style="max-width:480px;margin:0 auto;padding-bottom:40px">
        <!-- Header -->
        <div style="background:#C4693A;padding:28px 20px 20px;color:#fff">
          <div style="font-size:11px;opacity:.7;letter-spacing:1px;text-transform:uppercase;margin-bottom:6px">Your Cleaning Job</div>
          <div style="font-family:Georgia,serif;font-size:24px;font-weight:normal;margin-bottom:4px">${typeLabels[job.type]||job.type}</div>
          <div style="font-size:14px;opacity:.85">🏠 ${job.propName}</div>
          <div style="font-size:14px;opacity:.85;margin-top:2px">📅 ${job.date} at ${job.time||'TBD'}</div>
          <div style="margin-top:12px;display:inline-block;background:rgba(255,255,255,.2);border-radius:20px;padding:4px 14px;font-size:12px">${statusLabel}</div>
        </div>

        <!-- Pay + Access -->
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;padding:16px 16px 0">
          <div style="background:#fff;border-radius:12px;padding:14px;box-shadow:0 2px 8px rgba(0,0,0,.06)">
            <div style="font-size:10px;color:#9B8E85;text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px">Your Pay</div>
            <div style="font-family:Georgia,serif;font-size:28px;color:#C4693A">$${(job.cleanerPay||job.pay||0)}</div>
          </div>
          ${prop?.doorCode?`<div style="background:#fff;border-radius:12px;padding:14px;box-shadow:0 2px 8px rgba(0,0,0,.06)"><div style="font-size:10px;color:#9B8E85;text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px">Door Code</div><div style="font-family:monospace;font-size:28px;color:#1E2D40;letter-spacing:3px">${prop.doorCode}</div></div>`
          :`<div style="background:#fff;border-radius:12px;padding:14px;box-shadow:0 2px 8px rgba(0,0,0,.06)"><div style="font-size:10px;color:#9B8E85;text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px">Access</div><div style="font-size:13px;color:#2C1F14">Check with host</div></div>`}
        </div>

        ${prop?.wifi?`<div style="margin:10px 16px 0;background:#fff;border-radius:12px;padding:14px;box-shadow:0 2px 8px rgba(0,0,0,.06)"><div style="font-size:10px;color:#9B8E85;text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px">📶 WiFi</div><div style="font-size:13px;color:#2C1F14;font-weight:600">${prop.wifi}</div><div style="font-size:12px;color:#6B5D52">Password: ${prop.wifiPw||'—'}</div></div>`:''}

        ${job.notes?`<div style="margin:10px 16px 0;background:#FFF8E8;border-radius:12px;padding:14px;border-left:3px solid #C8A84B"><div style="font-size:10px;color:#9B8E85;text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px">📝 Host Notes</div><div style="font-size:13px;color:#2C1F14;line-height:1.6">${job.notes}</div></div>`:''}

        <!-- Action buttons -->
        ${job.status==='open'||job.status==='assigned'?`
        <div style="padding:16px;display:flex;gap:8px">
          ${job.status==='open'?`
          <button onclick="acceptJob()" style="flex:1;background:#6B8F71;color:#fff;border:none;border-radius:10px;padding:14px;font-size:15px;font-weight:600;cursor:pointer;font-family:inherit">✓ Accept Job</button>
          <button onclick="declineJob()" style="flex:1;background:#fff;color:#C4693A;border:2px solid #C4693A;border-radius:10px;padding:14px;font-size:15px;font-weight:600;cursor:pointer;font-family:inherit">✗ Decline</button>
          `:`<button onclick="startJob()" style="width:100%;background:#C4693A;color:#fff;border:none;border-radius:10px;padding:16px;font-size:16px;font-weight:600;cursor:pointer;font-family:inherit">🧹 Start Cleaning</button>`}
        </div>`:''}

        ${job.status==='in_progress'?`
        <!-- Progress bar -->
        <div style="padding:16px 16px 0">
          <div style="display:flex;justify-content:space-between;margin-bottom:6px">
            <div style="font-size:13px;font-weight:600;color:#2C1F14">${done} of ${checkItems.length} tasks done</div>
            <div style="font-size:13px;color:#C4693A;font-weight:600">${pct}%</div>
          </div>
          <div style="background:#E2DBD0;border-radius:8px;height:8px;overflow:hidden">
            <div style="background:#6B8F71;height:100%;width:${pct}%;border-radius:8px;transition:width .3s"></div>
          </div>
        </div>
        <!-- Checklist -->
        <div style="margin:12px 16px 0;background:#fff;border-radius:12px;padding:16px;box-shadow:0 2px 8px rgba(0,0,0,.06)">
          <div style="font-size:11px;font-weight:700;letter-spacing:.5px;text-transform:uppercase;color:#9B8E85;margin-bottom:12px">Cleaning Checklist</div>
          ${checkItems.map((item,i)=>`
            <div onclick="toggleCheck(${i})" style="display:flex;align-items:center;gap:12px;padding:10px 0;border-bottom:1px solid #F5F1EB;cursor:pointer">
              <div style="width:22px;height:22px;border-radius:50%;border:2px solid ${checkState[i]?'#6B8F71':'#D4C9B4'};background:${checkState[i]?'#6B8F71':'transparent'};display:flex;align-items:center;justify-content:center;flex-shrink:0;color:#fff;font-size:12px;transition:all .15s">${checkState[i]?'✓':''}</div>
              <div style="font-size:13px;color:${checkState[i]?'#9B8E85':'#2C1F14'};text-decoration:${checkState[i]?'line-through':''};line-height:1.4">${item}</div>
            </div>`).join('')}
        </div>
        <!-- Complete button -->
        <div style="padding:16px">
          <div style="margin-bottom:10px"><textarea id="completion-notes" placeholder="Any notes for the host? Issues found?" style="width:100%;background:#fff;border:1.5px solid #D4C9B4;border-radius:8px;padding:10px;font-size:13px;color:#2C1F14;font-family:inherit;min-height:60px;box-sizing:border-box;outline:none"></textarea></div>
          <button onclick="submitComplete()" style="width:100%;background:${pct>=80?'#6B8F71':'#9B8E85'};color:#fff;border:none;border-radius:10px;padding:16px;font-size:16px;font-weight:600;cursor:pointer;font-family:inherit">
            ${pct>=80?'✅ Mark Job Complete':'Complete ('+pct+'% done)'}
          </button>
        </div>`:''}

        ${job.status==='completed'?`
        <div style="padding:24px;text-align:center">
          <div style="font-size:52px;margin-bottom:12px">✅</div>
          <div style="font-family:Georgia,serif;font-size:22px;color:#2C1F14;margin-bottom:6px">Job Complete!</div>
          <div style="font-size:14px;color:#6B5D52">Great work. Your pay of $${(job.cleanerPay||job.pay||0)} will be processed by your host.</div>
          ${job.completionNotes?`<div style="margin-top:12px;background:#F5F1EB;border-radius:8px;padding:12px;font-size:13px;color:#6B5D52;text-align:left">${job.completionNotes}</div>`:''}
        </div>`:''}

        <div style="text-align:center;padding:20px;font-size:10px;color:#9B8E85">Powered by CSO Property Services</div>
      </div>`;

    // Attach functions to window for inline onclick
    window.toggleCheck = function(i) {
      checkState[i] = !checkState[i];
      try { localStorage.setItem('hh_job_check_'+jobId, JSON.stringify(checkState)); } catch(e){}
      render();
    };
    window.acceptJob = function() {
      job.status='assigned';
      saveJobUpdate('accept');
      render();
      toast2('Job accepted! ✓');
    };
    window.declineJob = function() {
      if(!confirm('Decline this job?')) return;
      job.status='declined';
      saveJobUpdate('decline');
      render();
    };
    window.startJob = function() {
      job.status='in_progress';
      job.startedAt = new Date().toISOString();
      job.lastHeartbeat = new Date().toISOString();
      saveJobUpdate('start');
      // Ping heartbeat every 5 minutes while job is in progress
      if(window._hbInterval) clearInterval(window._hbInterval);
      window._hbInterval = setInterval(function() {
        if(job.status==='in_progress') {
          pingCleanerHeartbeat(job.id);
          job.lastHeartbeat = new Date().toISOString();
        } else {
          clearInterval(window._hbInterval);
        }
      }, 5 * 60 * 1000);
      render();
    };
    window.submitComplete = function() {
      const notes = document.getElementById('completion-notes')?.value || '';
      job.status='completed';
      job.completedAt = new Date().toISOString().slice(0,10);
      saveJobUpdate('complete', {notes});
      render();
    };
  }

  // Simple toast for job card (no app framework)
  function toast2(msg) {
    const t = document.createElement('div');
    t.textContent = msg;
    t.style.cssText='position:fixed;bottom:20px;left:50%;transform:translateX(-50%);background:#2C1F14;color:#fff;padding:10px 20px;border-radius:20px;font-size:13px;z-index:9999;pointer-events:none';
    document.body.appendChild(t);
    setTimeout(()=>t.remove(), 2500);
  }

  render();
}
// ════════════════════════════════════════════
// ════════════════════════════════════════════
//  COHOST PLAN GATE HELPER
// ════════════════════════════════════════════
// requireCohostAny — Co-Host Starter OR Co-Host Pro (vendor mgmt, owner reports, payout, earnings)
function requireCohost(pageId) {
  const plan = cData?.plan || 'free';
  if(plan === 'cohost' || plan === 'cohost_starter' || isAdmin) return true;
  const el = document.getElementById('page-' + pageId);
  if(!el) return false;
  el.innerHTML = `
    <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:60vh;padding:40px;text-align:center">
      <div style="font-size:52px;margin-bottom:16px">🏆</div>
      <div style="font-family:Fraunces,serif;font-size:28px;font-weight:500;color:var(--txt);margin-bottom:8px;letter-spacing:-.5px">Co-Host Feature</div>
      <div style="font-size:15px;color:var(--txt2);max-width:440px;line-height:1.6;margin-bottom:28px">This feature is built for co-hosts managing properties on behalf of owners. Upgrade to unlock it.</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;width:100%;max-width:560px;margin-bottom:16px">
        <div style="background:var(--sand);border-radius:12px;padding:16px;text-align:left">
          <div style="font-size:11px;font-weight:700;color:var(--txt3);letter-spacing:.5px;text-transform:uppercase;margin-bottom:10px">Co-Host Starter — $149/mo</div>
          <div style="display:flex;flex-direction:column;gap:6px;font-size:13px;color:var(--txt2)">
            <div>✓ 10 properties</div>
            <div>✓ Owner reports (branded PDF)</div>
            <div>✓ Payout ledger + margin tracking</div>
            <div>✓ Vendor management</div>
            <div>✓ Co-Host earnings dashboard</div>
            <div>✓ Photo vault</div>
          </div>
          <button class="btn btn-w" style="margin-top:14px;background:var(--terra);color:#fff;font-weight:700;border:none;border-radius:8px;padding:10px;font-size:13px;cursor:pointer;width:100%" onclick="openStripe('cohost_starter')">Get Starter →</button>
        </div>
        <div style="background:linear-gradient(135deg,rgba(200,168,75,.15),rgba(200,168,75,.08));border:1px solid var(--gold);border-radius:12px;padding:16px;text-align:left">
          <div style="font-size:11px;font-weight:700;color:var(--gold);letter-spacing:.5px;text-transform:uppercase;margin-bottom:10px">Co-Host Pro — $299/mo</div>
          <div style="display:flex;flex-direction:column;gap:6px;font-size:13px;color:var(--txt2)">
            <div>✓ Unlimited properties</div>
            <div>✓ Everything in Starter</div>
            <div>✓ White-label branding</div>
            <div>✓ Affiliate program</div>
            <div>✓ 30-day money-back guarantee</div>
          </div>
          <button class="btn btn-w" style="margin-top:14px;background:var(--gold);color:#2C1F14;font-weight:700;border:none;border-radius:8px;padding:10px;font-size:13px;cursor:pointer;width:100%" onclick="openStripe('cohost')">Get Pro →</button>
        </div>
      </div>
      <div style="font-size:11px;color:var(--txt3)">No contracts · Cancel anytime · No booking fees</div>
    </div>`;
  return false;
}

// requireCohostPro — Co-Host Pro only (white-label, affiliate program, unlimited properties)
function requireCohostPro(pageId) {
  const plan = cData?.plan || 'free';
  if(plan === 'cohost' || isAdmin) return true;
  const el = document.getElementById('page-' + pageId);
  if(!el) return false;
  el.innerHTML = `
    <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:60vh;padding:40px;text-align:center">
      <div style="font-size:52px;margin-bottom:16px">👑</div>
      <div style="font-family:Fraunces,serif;font-size:28px;font-weight:500;color:var(--txt);margin-bottom:8px;letter-spacing:-.5px">Co-Host Pro Feature</div>
      <div style="font-size:15px;color:var(--txt2);max-width:400px;line-height:1.6;margin-bottom:28px">This feature is exclusive to Co-Host Pro — built for full-scale property management businesses.</div>
      <div style="background:linear-gradient(135deg,rgba(200,168,75,.15),rgba(200,168,75,.08));border:1px solid var(--gold);border-radius:12px;padding:20px;width:100%;max-width:320px;text-align:left;margin-bottom:16px">
        <div style="font-size:11px;font-weight:700;color:var(--gold);letter-spacing:.5px;text-transform:uppercase;margin-bottom:10px">Co-Host Pro includes</div>
        <div style="display:flex;flex-direction:column;gap:6px;font-size:13px;color:var(--txt2)">
          <div>✓ Unlimited properties</div>
          <div>✓ White-label branding (your logo, your colors)</div>
          <div>✓ Affiliate program & referral tracking</div>
          <div>✓ Everything in Co-Host Starter</div>
          <div>✓ 30-day money-back guarantee</div>
        </div>
      </div>
      <button class="btn btn-w" style="background:var(--gold);color:#2C1F14;font-weight:700;border:none;border-radius:8px;padding:14px 28px;font-size:14px;cursor:pointer;max-width:320px;width:100%" onclick="openStripe('cohost')">🏆 Upgrade to Co-Host Pro — $299/mo →</button>
      <div style="font-size:11px;color:var(--txt3);margin-top:10px">30-day money-back · Cancel anytime</div>
    </div>`;
  return false;
}

// ════════════════════════════════════════════
//  BILLING MANAGEMENT
// ════════════════════════════════════════════
function openBillingPortal() {
  const plan = cData.plan||'free';
  if(plan==='free'||plan==='trial'){showUpgradeModal('Upgrade to Pro to manage your subscription.');return;}
  try {
    const win = window.open('https://billing.stripe.com/p/login/cNi8wO2EtdfT8wdbo44sE00','_blank');
    if(!win) {
      toast('Popup blocked — please allow popups or email csopropertyservice@gmail.com to manage your subscription.');
    }
  } catch(e) {
    toast('Could not open billing portal. Email csopropertyservice@gmail.com for help.');
  }
}

let isAnnual = false;
function toggleBilling() {
  isAnnual = !isAnnual;
  const knob = document.getElementById('billing-knob');
  const mLabel = document.getElementById('toggle-monthly-label');
  const aLabel = document.getElementById('toggle-annual-label');
  const proPrice = document.getElementById('pro-price');
  const bizPrice = document.getElementById('biz-price');
  const proDesc = document.getElementById('pro-desc');
  const bizDesc = document.getElementById('biz-desc');
  if(knob) knob.style.left = isAnnual ? '27px' : '3px';
  if(mLabel) mLabel.style.color = isAnnual ? 'var(--txt2)' : 'var(--txt)';
  if(aLabel) aLabel.style.color = isAnnual ? 'var(--txt)' : 'var(--txt2)';
  if(proPrice) proPrice.innerHTML = isAnnual ? '$66<span>/mo</span>' : '$79<span>/mo</span>';
  if(bizPrice) bizPrice.innerHTML = isAnnual ? '$166<span>/mo</span>' : '$199<span>/mo</span>';
  if(proDesc) proDesc.textContent = isAnnual ? 'Billed $790/year · Save $158' : 'For serious hosts · 14-day free trial';
  if(bizDesc) bizDesc.textContent = isAnnual ? 'Billed $1,990/year · Save $398' : 'For property managers · 14-day free trial';
}

// ════════════════════════════════════════════
//  FREE TRIAL LOGIC
// ════════════════════════════════════════════
// ════════════════════════════════════════════
//  SUBSCRIPTION & PROPERTY ENFORCEMENT LAYER
// ════════════════════════════════════════════

// Plan limits — single source of truth
const PLAN_LIMITS = {
  free:           1,
  trial:          10,
  pro:            10,
  business:       Infinity,
  cohost_starter: 10,
  cohost:         Infinity
};

const PLAN_NAMES = {
  free: 'Free', trial: 'Pro Trial', pro: 'Pro',
  business: 'Business', cohost_starter: 'Co-Host Starter', cohost: 'Co-Host Pro'
};

const PLAN_NEXT_TIER = {
  free: 'pro', trial: 'pro', pro: 'business',
  business: 'cohost_starter', cohost_starter: 'cohost'
};

const PLAN_PRICES = {
  free: '$0', trial: '$79', pro: '$79', business: '$199',
  cohost_starter: '$149', cohost: '$299'
};

function getPlanPropertyLimit(plan) {
  return PLAN_LIMITS[plan] ?? 1;
}

// ── canAddProperty(): named guard function — used by addProperty() and UI
