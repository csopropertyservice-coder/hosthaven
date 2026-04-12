/* CSO Property Services — js/features.js
   Lines 7435–10764 of original JS block
   DO NOT edit inline in index.html — edit this file instead
*/

//  AFFILIATE PROGRAM
// ════════════════════════════════════════════
// ════════════════════════════════════════════
//  SECURITY — cleanInput() alias + JWT-ready note
// ════════════════════════════════════════════
// cleanInput is the public alias for sanitizeInput — use it on ALL user inputs
const cleanInput = (v, maxLen) => sanitizeInput(v).substring(0, maxLen||500);

// JWT: Supabase automatically attaches the user JWT to all sb.from() calls
// via the Authorization: Bearer <token> header. RLS policy example:
//   CREATE POLICY "user_isolation" ON user_data
//   FOR ALL USING (auth.uid() = user_id);
// The anon key + RLS is the correct security model — never expose service_role key client-side.

// ════════════════════════════════════════════
//  AFFILIATE — Fixed (no prompt(), clipboard fallback, link preview)
// ════════════════════════════════════════════
const AFF_BASE_URL = 'https://csopropertyservices.com/?ref=';

function previewAffLink() {
  const code = (document.getElementById('aff-code')?.value||'').toUpperCase().replace(/[^A-Z0-9]/g,'');
  const preview = document.getElementById('aff-link-preview');
  if(!preview) return;
  if(code) {
    preview.style.display='block';
    preview.innerHTML='<strong>Preview:</strong> '+AFF_BASE_URL+code;
  } else {
    preview.style.display='none';
  }
}

function addAffiliate() {
  const name = cleanInput(document.getElementById('aff-name')?.value.trim());
  const code = (document.getElementById('aff-code')?.value||'').trim().toUpperCase().replace(/[^A-Z0-9]/g,'');
  if(!name){toast('Enter affiliate name');return;}
  if(!code){toast('Enter a unique code (letters/numbers only)');return;}
  if(code.length < 3){toast('Code must be at least 3 characters');return;}
  if(!cData.affiliates) cData.affiliates=[];
  if(cData.affiliates.find(a=>a.code===code)){toast('That code is already taken');return;}
  const emailRaw = document.getElementById('aff-email')?.value.trim();
  if(emailRaw && !isValidEmail(emailRaw)){toast('Enter a valid email');return;}
  cData.affiliates.push({
    id:'aff_'+Date.now(),
    name, code,
    email: cleanInput(emailRaw),
    commission: parseFloat(document.getElementById('aff-commission')?.value)||20,
    platform: cleanInput(document.getElementById('aff-platform')?.value.trim()),
    link: AFF_BASE_URL+code,
    referredUsers:[],
    totalEarned:0,
    totalPaid:0,
    active:true,
    created:Date.now()
  });
  saveUserData(cUid,cData);
  closeModal('add-affiliate-modal');
  ['aff-name','aff-email','aff-platform'].forEach(id=>{const el=document.getElementById(id);if(el)el.value='';});
  const codeEl = document.getElementById('aff-code'); if(codeEl) codeEl.value='';
  const prev = document.getElementById('aff-link-preview'); if(prev) prev.style.display='none';
  toast(name+' added! Their link: ?ref='+code);
  renderAffiliates();
}

function openLogReferral(affId) {
  const a = (cData.affiliates||[]).find(x=>x.id===affId);
  if(!a) return;
  const idEl = document.getElementById('ref-aff-id'); if(idEl) idEl.value=affId;
  const dateEl = document.getElementById('ref-date'); if(dateEl) dateEl.value=new Date().toISOString().slice(0,10);
  const emailEl = document.getElementById('ref-email'); if(emailEl) emailEl.value='';
  updateRefCommPreview(a.commission);
  openModal('log-referral-modal');
}

function updateRefCommPreview(commPct) {
  const planEl = document.getElementById('ref-plan');
  const previewEl = document.getElementById('ref-commission-preview');
  if(!planEl||!previewEl) return;
  const plan = planEl.value;
  const val = plan==='cohost'?299:plan==='cohost_starter'?149:plan==='business'?199:plan==='pro'?79:0;
  const monthly = val*(commPct/100);
  if(val>0){
    previewEl.style.display='block';
    previewEl.innerHTML='Commission earned: <strong>$'+monthly.toFixed(2)+'/mo</strong> ('+commPct+'% of $'+val+')';
  } else {
    previewEl.style.display='none';
  }
}

function submitLogReferral() {
  const affId = document.getElementById('ref-aff-id')?.value;
  const a = (cData.affiliates||[]).find(x=>x.id===affId);
  if(!a){toast('Affiliate not found');return;}
  const email = cleanInput(document.getElementById('ref-email')?.value.trim());
  if(!email||!isValidEmail(email)){toast('Enter a valid email');return;}
  const plan = document.getElementById('ref-plan')?.value||'pro';
  const monthlyValue = plan==='cohost'?299:plan==='cohost_starter'?149:plan==='business'?199:plan==='pro'?79:0;
  const joinedDate = document.getElementById('ref-date')?.value||new Date().toISOString().slice(0,10);
  const monthly = monthlyValue*(a.commission/100);
  if(!a.referredUsers) a.referredUsers=[];
  if(a.referredUsers.find(u=>u.email===email)){toast('This email is already logged for this affiliate');return;}
  a.referredUsers.push({email,plan,monthlyValue,commission:monthly,joinedDate});
  a.totalEarned = (a.totalEarned||0)+monthly;
  saveUserData(cUid,cData);
  closeModal('log-referral-modal');
  renderAffiliates();
  toast('Referral logged! '+a.name+' earns $'+monthly.toFixed(2)+'/mo ✓');
}

function renderAffiliates() {
  if(!requireCohostPro('affiliates')) return;
  const affiliates = cData.affiliates||[];
  const set=(id,v)=>{const el=document.getElementById(id);if(el)el.textContent=v;};

  const totalReferred = affiliates.reduce((s,a)=>s+(a.referredUsers||[]).length,0);
  const totalOwed = affiliates.reduce((s,a)=>s+(a.totalEarned||0)-(a.totalPaid||0),0);
  const totalGross = affiliates.reduce((s,a)=>(a.referredUsers||[]).reduce((rs,u)=>rs+(u.monthlyValue||79),0)+s,0);
  const yourNet = totalGross - affiliates.reduce((s,a)=>s+(a.totalEarned||0),0);

  set('aff-total', affiliates.length);
  set('aff-referred', totalReferred);
  set('aff-owed', '$'+Math.round(totalOwed).toLocaleString());
  set('aff-net', '$'+Math.round(yourNet).toLocaleString());

  const list = document.getElementById('affiliates-list');
  if(!list) return;

  // "My Link" section at top
  const myCode = (cUser?.email||'').split('@')[0].toUpperCase().replace(/[^A-Z0-9]/g,'').substring(0,8)||'HOST';
  const myLink = AFF_BASE_URL+myCode;

  let html = `<div class="card" style="margin-bottom:16px;border-left:3px solid var(--gold)">
    <div class="card-hd"><div class="card-title">🔗 Your Personal Referral Link</div></div>
    <div class="card-body">
      <div style="font-size:13px;color:var(--txt2);margin-bottom:10px">Share this link on social media, emails, or your website. Anyone who signs up through it is tracked to you.</div>
      <div style="display:flex;align-items:center;gap:8px;background:var(--sand);border-radius:8px;padding:10px 12px">
        <div style="font-size:12px;color:var(--terra);font-family:monospace;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${myLink}</div>
        <button class="btn btn-pri" style="font-size:11px;padding:4px 10px;flex-shrink:0" onclick="copyAffLink('${myLink}')">📋 Copy</button>
      </div>
    </div>
  </div>`;

  if(!affiliates.length){
    html += '<div class="empty-state"><div class="es-i">🤝</div><h3>No affiliates yet</h3><p>Add influencers, STR educators, or Facebook group admins</p><button class="btn btn-pri" onclick="openModal(\'add-affiliate-modal\')" style="margin-top:10px">Add First Affiliate</button></div>';
    list.innerHTML=html; return;
  }

  html += affiliates.map(function(a) {
    const referred = (a.referredUsers||[]).length;
    const owed = Math.max(0,(a.totalEarned||0)-(a.totalPaid||0));
    const link = a.link||AFF_BASE_URL+a.code;
    const monthlyComm = referred * 79 * (a.commission/100);
    return `<div class="card" style="margin-bottom:12px">
      <div class="card-hd">
        <div style="display:flex;align-items:center;gap:12px">
          <div style="width:42px;height:42px;border-radius:50%;background:var(--terra);color:#fff;display:flex;align-items:center;justify-content:center;font-size:16px;font-weight:700;flex-shrink:0">${a.name[0].toUpperCase()}</div>
          <div><div style="font-size:15px;font-weight:600;color:var(--txt)">${a.name}</div>
          <div style="font-size:12px;color:var(--txt3)">${a.platform||'No platform noted'} · ${a.commission||20}% commission</div></div>
        </div>
        <div style="display:flex;gap:6px;flex-wrap:wrap">
          <button class="btn btn-ghost" style="font-size:11px;padding:4px 9px" onclick="copyAffLink('${link}')">📋 Copy Link</button>
          <button class="btn btn-ghost" style="font-size:11px;padding:4px 9px" onclick="openLogReferral('${a.id}')">+ Log Referral</button>
          ${owed>0?`<button class="btn btn-ghost" style="font-size:11px;padding:4px 9px;color:var(--sage)" onclick="payAffiliate('${a.id}')">Pay $${Math.round(owed)}</button>`:''}
          <button class="btn btn-ghost" style="font-size:11px;padding:4px 9px;color:var(--terra)" onclick="removeAffiliate('${a.id}')">🗑</button>
        </div>
      </div>
      <div class="card-body">
        <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:12px">
          <div style="background:var(--sand);border-radius:8px;padding:10px;text-align:center"><div style="font-size:10px;color:var(--txt3);margin-bottom:3px">Referred</div><div style="font-family:Fraunces,serif;font-size:20px;color:var(--txt)">${referred}</div></div>
          <div style="background:var(--sand);border-radius:8px;padding:10px;text-align:center"><div style="font-size:10px;color:var(--txt3);margin-bottom:3px">Monthly Comm.</div><div style="font-family:Fraunces,serif;font-size:20px;color:var(--gold)">$${Math.round(monthlyComm)}</div></div>
          <div style="background:${owed>0?'rgba(107,143,113,.1)':'var(--sand)'};border-radius:8px;padding:10px;text-align:center"><div style="font-size:10px;color:var(--txt3);margin-bottom:3px">Owed</div><div style="font-family:Fraunces,serif;font-size:20px;color:${owed>0?'var(--sage)':'var(--txt3)'}">$${Math.round(owed)}</div></div>
          <div style="background:rgba(196,105,58,.08);border-radius:8px;padding:10px;text-align:center"><div style="font-size:10px;color:var(--txt3);margin-bottom:3px">Paid</div><div style="font-family:Fraunces,serif;font-size:20px;color:var(--terra)">$${Math.round(a.totalPaid||0)}</div></div>
        </div>
        <div style="background:var(--sand);border-radius:8px;padding:10px;display:flex;align-items:center;gap:10px;margin-bottom:${(a.referredUsers||[]).length?'10px':'0'}">
          <div style="font-size:11px;color:var(--txt3);flex-shrink:0">Link:</div>
          <div style="font-size:12px;color:var(--terra);font-family:monospace;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${link}</div>
          <button class="btn btn-ghost" style="font-size:10px;padding:3px 8px;flex-shrink:0" onclick="copyAffLink('${link}')">Copy</button>
        </div>
        ${(a.referredUsers||[]).length?`<div><div style="font-size:11px;color:var(--txt3);margin-bottom:6px;font-weight:600;letter-spacing:.5px;text-transform:uppercase">Referred Users</div>${(a.referredUsers||[]).map(u=>`<div style="font-size:12px;color:var(--txt2);padding:5px 0;border-bottom:1px solid var(--border2);display:flex;justify-content:space-between"><span>${u.email}</span><span style="color:var(--sage)">$${u.commission||0}/mo · ${u.joinedDate}</span></div>`).join('')}</div>`:''}
      </div>
    </div>`;
  }).join('');
  list.innerHTML=html;
}

function copyAffLink(link) {
  if(navigator.clipboard && window.isSecureContext) {
    navigator.clipboard.writeText(link).then(()=>toast('Affiliate link copied! ✓')).catch(()=>_fallbackCopy(link));
  } else {
    _fallbackCopy(link);
  }
}
function _fallbackCopy(text) {
  const ta=document.createElement('textarea');
  ta.value=text;ta.style.cssText='position:fixed;top:0;left:0;opacity:0';
  document.body.appendChild(ta);ta.focus();ta.select();
  try{document.execCommand('copy');toast('Link copied! ✓');}catch(e){toast('Copy failed — select the link manually');}
  document.body.removeChild(ta);
}

function logAffReferral(affId) { openLogReferral(affId); }

function payAffiliate(affId) {
  const a = (cData.affiliates||[]).find(x=>x.id===affId);
  if(!a) return;
  const owed = (a.totalEarned||0)-(a.totalPaid||0);
  if(owed<=0){toast('Nothing owed');return;}
  if(!confirm('Mark $'+Math.round(owed)+' as paid to '+a.name+'? This cannot be undone.')) return;
  a.totalPaid = (a.totalPaid||0)+owed;
  saveUserData(cUid,cData);
  renderAffiliates();
  toast('$'+Math.round(owed)+' marked as paid to '+a.name+' ✓');
}

function removeAffiliate(affId) {
  if(!confirm('Remove this affiliate? All referral history will be lost.')) return;
  cData.affiliates=(cData.affiliates||[]).filter(x=>x.id!==affId);
  saveUserData(cUid,cData);
  renderAffiliates();
  toast('Affiliate removed');
}

// ════════════════════════════════════════════
//  HEARTBEAT MONITOR — Flag late cleaner check-ins
// ════════════════════════════════════════════
var _heartbeatTimer = null;

function startHeartbeatMonitor() {
  // Run once immediately, then every 60 seconds
  checkCleanerHeartbeats();
  if(_heartbeatTimer) clearInterval(_heartbeatTimer);
  _heartbeatTimer = setInterval(checkCleanerHeartbeats, 60000);
}

function checkCleanerHeartbeats() {
  if(!cData) return;
  const now = new Date();
  const today = now.toISOString().slice(0,10);
  const jobs = (cData.jobs||[]).filter(j=>j.date===today && j.status==='in_progress');
  if(!jobs.length) return;

  jobs.forEach(function(j) {
    if(!j.startedAt) return;
    const startedMs = new Date(j.startedAt).getTime();
    const lateMs = 15 * 60 * 1000; // 15 minutes
    const elapsed = now.getTime() - startedMs;

    // Check for last heartbeat ping (set by cleaner job card)
    const lastPing = j.lastHeartbeat ? new Date(j.lastHeartbeat).getTime() : startedMs;
    const silentMs = now.getTime() - lastPing;

    if(silentMs > lateMs && !j.heartbeatAlerted) {
      j.heartbeatAlerted = true;
      j.heartbeatLateMin = Math.round(silentMs / 60000);
      saveUserData(cUid, cData);
      // Show alert banner
      toast(`⚠️ ${j.cleanerName} hasn't checked in for ${j.heartbeatLateMin} min — ${j.propName}`);
      // Update job board if visible
      if(document.getElementById('page-marketplace')?.classList.contains('active')) {
        renderMarketplace();
      }
    }
  });
}

// Called from cleaner job card to update heartbeat
function pingCleanerHeartbeat(jobId) {
  try {
    const updates = JSON.parse(localStorage.getItem('hh_job_updates')||'[]');
    updates.push({jobId, action:'heartbeat', time:new Date().toISOString()});
    localStorage.setItem('hh_job_updates', JSON.stringify(updates));
  } catch(e){}
}

// ════════════════════════════════════════════
//  DYNAMIC CHECKLISTS — Residential vs Turno STR
// ════════════════════════════════════════════
const CHECKLIST_RESIDENTIAL = {
  title: '🏠 Residential Cleaning Checklist',
  sections: [
    {name:'Kitchen', items:['Wipe all countertops and backsplash','Clean stovetop and burners','Wipe microwave inside and out','Clean sink, faucet, and drain','Wipe cabinet doors and handles','Clean inside of oven if needed','Empty and reline trash can','Sweep and mop floor','Restock dish soap and sponge']},
    {name:'Bathrooms', items:['Scrub toilet inside and out','Clean sink and polish faucet','Scrub shower or bathtub','Wipe mirror and all surfaces','Replace toilet paper','Restock hand soap','Empty trash and reline','Sweep and mop floor']},
    {name:'Bedrooms', items:['Dust all surfaces and furniture','Wipe windowsills','Vacuum carpet or sweep/mop','Empty all trash bins','Make beds if linens are out','Check closets and under bed']},
    {name:'Living Areas', items:['Dust furniture and shelves','Wipe TV screen and remotes','Vacuum all upholstery','Sweep or vacuum floors','Mop hard floors','Empty trash','Wipe light switches and door handles']},
    {name:'Final', items:['Wipe front door and entry','Check all lights work','Lock windows and doors','Leave client feedback card if provided']},
  ]
};

const CHECKLIST_TURNO_STR = {
  title: '🔄 Turno STR Turnover Checklist',
  sections: [
    {name:'Kitchen', items:['Remove all dishes and wash thoroughly','Wipe countertops and backsplash','Clean inside microwave','Wipe stovetop and burners','Clean oven if needed','Empty and wipe fridge — remove leftovers','Wipe refrigerator exterior','Clean sink and polish faucet','Empty and reline trash','Sweep and mop floor','Restock coffee/tea/sugar','Restock dish soap, sponge, paper towels']},
    {name:'Bathrooms', items:['Scrub and disinfect toilet','Clean sink and wipe mirror','Scrub shower/bathtub','Clean shower glass or curtain','Replace toilet paper (full roll)','Restock shampoo, conditioner, body wash','Replace hand soap if low','Wash bath mats','Replace used towels with fresh set','Empty trash and reline','Sweep and mop floor']},
    {name:'Bedrooms', items:['Strip all bed linens','Make bed with fresh linens — tight corners','Fluff and arrange all pillows','Check under bed for guest items','Wipe furniture and surfaces','Clean mirrors','Empty all trash bins','Vacuum or sweep floors','Check closets — remove any guest items','Restock extra blankets']},
    {name:'Living Areas', items:['Dust all surfaces','Wipe TV screen and remote','Vacuum all upholstery','Sweep or vacuum floors','Mop hard floors','Empty trash','Wipe light switches and door handles','Check for damage or missing items']},
    {name:'STR Specific', items:['Restock welcome amenities','Leave house manual in visible spot','Check door code still works','Stage property for next guest photos','Report any damage via app before leaving','Take completion photos for Photo Vault']},
  ]
};

function getChecklistForJobType(jobType) {
  if(jobType==='residential') return CHECKLIST_RESIDENTIAL;
  if(jobType==='turno'||jobType==='turnover'||jobType==='deep') return CHECKLIST_TURNO_STR;
  return CHECKLIST_TURNO_STR; // default to STR
}

// ════════════════════════════════════════════
//  CONTRACTOR MANAGEMENT — Pay rates & service areas
// ════════════════════════════════════════════
function editContractorRate(cleanerId) {
  const c = (cData.cleaners||[]).find(x=>x.id===cleanerId);
  if(!c) return;
  const existing = document.getElementById('edit-contractor-modal');
  if(existing) existing.remove();

  const m = document.createElement('div');
  m.id='edit-contractor-modal';
  m.className='modal-bg open';
  const propOptions = (cData.properties||[]).map(p=>
    `<option value="${p.id}" ${(c.propIds||[]).includes(p.id)?'selected':''}>${p.emoji||'🏠'} ${p.name}</option>`
  ).join('');

  m.innerHTML=`<div class="modal" style="max-width:460px">
    <h2>✏️ Edit Contractor — ${c.name}</h2>
    <div class="g2">
      <div class="fi"><label>Hourly Rate ($)</label><input id="ec-rate" type="number" value="${c.rate||0}" min="0" step="0.5" placeholder="25.00"></div>
      <div class="fi"><label>Job Flat Rate ($) <span style="font-weight:400;color:var(--txt3)">(if flat fee)</span></label><input id="ec-flat" type="number" value="${c.flatRate||''}" min="0" step="5" placeholder="Leave blank for hourly"></div>
    </div>
    <div class="fi"><label>Service Area(s)</label><input id="ec-area" value="${c.area||''}" placeholder="Downtown Dallas, Irving, Garland"></div>
    <div class="fi"><label>Specialties</label><input id="ec-skills" value="${c.skills||''}" placeholder="Deep clean, turnover, laundry, residential"></div>
    <div class="fi"><label>Job Types</label>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:6px">
        ${['Residential','Turno STR','Deep Clean','Move-In/Out','Post-Construction'].map(t=>`
          <label style="display:flex;align-items:center;gap:5px;font-size:12px;color:var(--txt2);cursor:pointer">
            <input type="checkbox" value="${t}" ${(c.jobTypes||[]).includes(t)?'checked':''} style="accent-color:var(--terra)"> ${t}
          </label>`).join('')}
      </div>
    </div>
    <div class="fi"><label>Properties Assigned</label>
      <select id="ec-props" multiple style="width:100%;background:var(--input-bg);border:1.5px solid var(--input-border);border-radius:8px;padding:8px 12px;min-height:80px;font-size:13px;color:var(--txt)">${propOptions}</select>
    </div>
    <div class="fi"><label>Notes</label><textarea id="ec-notes" style="width:100%;background:var(--input-bg);border:1.5px solid var(--input-border);border-radius:8px;padding:10px;font-size:13px;color:var(--txt);font-family:'DM Sans',sans-serif;min-height:60px">${c.notes||''}</textarea></div>
    <div class="modal-foot">
      <button class="btn btn-ghost" onclick="document.getElementById('edit-contractor-modal').remove()">Cancel</button>
      <button class="btn btn-pri" onclick="saveContractorEdit('${cleanerId}')">Save Changes</button>
    </div>
  </div>`;
  document.body.appendChild(m);
}

function saveContractorEdit(cleanerId) {
  const c = (cData.cleaners||[]).find(x=>x.id===cleanerId);
  if(!c) return;
  c.rate = parseFloat(document.getElementById('ec-rate')?.value)||c.rate||0;
  const flat = parseFloat(document.getElementById('ec-flat')?.value);
  c.flatRate = isNaN(flat)?null:flat;
  c.area = cleanInput(document.getElementById('ec-area')?.value.trim());
  c.skills = cleanInput(document.getElementById('ec-skills')?.value.trim());
  c.notes = cleanInput(document.getElementById('ec-notes')?.value.trim());
  // Job types from checkboxes
  c.jobTypes = [...document.querySelectorAll('#edit-contractor-modal input[type=checkbox]:checked')].map(cb=>cb.value);
  // Assigned properties
  const propSel = document.getElementById('ec-props');
  c.propIds = propSel?[...propSel.selectedOptions].map(o=>o.value).filter(Boolean):c.propIds||[];
  saveUserData(cUid,cData);
  document.getElementById('edit-contractor-modal')?.remove();
  renderMarketplace();
  toast(c.name+'\'s details updated ✓');
}

// ════════════════════════════════════════════
//  AUTO-SAVE DRAFTS — prevent data loss on refresh
// ════════════════════════════════════════════
const DRAFT_KEY = 'hh_form_drafts';

function saveDraft(formId, data) {
  try {
    const drafts = JSON.parse(localStorage.getItem(DRAFT_KEY)||'{}');
    drafts[formId] = {data, ts:Date.now()};
    localStorage.setItem(DRAFT_KEY, JSON.stringify(drafts));
  } catch(e){}
}

function loadDraft(formId) {
  try {
    const drafts = JSON.parse(localStorage.getItem(DRAFT_KEY)||'{}');
    const d = drafts[formId];
    if(d && (Date.now()-d.ts) < 24*60*60*1000) return d.data; // 24hr expiry
  } catch(e){}
  return null;
}

function clearDraft(formId) {
  try {
    const drafts = JSON.parse(localStorage.getItem(DRAFT_KEY)||'{}');
    delete drafts[formId];
    localStorage.setItem(DRAFT_KEY, JSON.stringify(drafts));
  } catch(e){}
}

function wireBookingDraftSave() {
  const fields = ['mb-guest','mb-email','mb-cin','mb-cout','mb-nguests','mb-price','mb-notes','mb-source','mb-lead-type'];
  fields.forEach(function(id) {
    const el = document.getElementById(id);
    if(el) el.addEventListener('input', function() {
      const d = {};
      fields.forEach(function(fid){const f=document.getElementById(fid);if(f)d[fid]=f.value;});
      saveDraft('booking', d);
    });
  });
  // Restore draft if any
  const draft = loadDraft('booking');
  if(draft) {
    const hasMeaningful = draft['mb-guest']||draft['mb-cin'];
    if(hasMeaningful) {
      fields.forEach(function(fid){const f=document.getElementById(fid);if(f&&draft[fid])f.value=draft[fid];});
    }
  }
}

// Check referral code on app load (called in bootApp)
function checkReferralCode() {
  const params = new URLSearchParams(window.location.search);
  const ref = params.get('ref');
  if(ref) {
    localStorage.setItem('hh_ref', ref.toUpperCase());
  }
}


// ════════════════════════════════════════════
//  ONE-OFF PRODUCTS
// ════════════════════════════════════════════
function buyProduct(product) {
  const links = {
    quickstart: 'https://csoproperty.gumroad.com/l/wnzfh',
    cohost_kit:  'https://csoproperty.gumroad.com/l/ebqdf'
  };
  // If Stripe links not yet set, show contact modal
  if(links[product].includes('placeholder')) {
    // Show a simple email capture for now
    const email = prompt('Enter your email and we will send you the download link within 24 hours:');
    if(email && email.includes('@')) {
      // Send notification to admin
      fetch('https://vdnyqwpznsysrvyvbqga.supabase.co/functions/v1/send-notification', {
        method:'POST',
        headers:{'Content-Type':'application/json','Authorization':'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZkbnlxd3B6bnN5c3J2eXZicWdhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ2NjM4NjUsImV4cCI6MjA5MDIzOTg2NX0.VxwNE_lMR2JV_70SVr9rio_UgfbKGnYFyeitkTuWYkM'},
        body: JSON.stringify({
          type:'product_purchase',
          hostEmail: ADMIN_EMAIL,
          data: {product, buyerEmail: email, time: new Date().toISOString()}
        })
      }).catch(()=>{});
      alert('Got it! Check ' + email + ' within 24 hours for your download link. Questions? Email csopropertyservice@gmail.com');
    }
    return;
  }
  window.open(links[product], '_blank');
}

// Call this once you have real Stripe payment links:
// buyProduct links should be updated to:
// quickstart: your $47 Stripe payment link
// cohost_kit: your $97 Stripe payment link

function saveSettings(){const name=document.getElementById('set-name').value.trim();if(!name){toast('Enter your name');return;}if(!navigator.onLine){toast('Offline — cannot save');return;}if(cUser)cUser.name=name;document.getElementById('sb-uname').textContent=name;const init=name.split(' ').map(n=>n[0]).join('').toUpperCase().slice(0,2);document.getElementById('sb-av').textContent=init;sb.auth.updateUser({data:{full_name:name}}).catch((e)=>sbHandleError(e,'updateUser settings'));toast('Saved! ✓');}
function saveApiKey(){const key=document.getElementById('set-api-key').value.trim();if(!key){toast('Enter your API key');return;}cData.apiKey=key;saveUserData(cUid,cData);toast('API key saved! AI messaging is live ✓');}
function saveResendKey(){
  const key=document.getElementById('set-resend-key').value.trim();
  if(!key){toast('Enter your Resend key');return;}
  cData.resendKey=key;
  saveUserData(cUid,cData);
  toast('Resend key saved! Email delivery enabled ✓');
}

// ════════════════════════════════════════════
//  FEATURE 3 — AI CONTENT HUB
// ════════════════════════════════════════════
let _contentTab = 'scripts';

function switchContentTab(tab, btn) {
  _contentTab = tab;
  document.querySelectorAll('#content-hub-tabs button').forEach(b=>{b.className='btn btn-ghost';b.style.fontSize='12px';b.style.padding='6px 14px';});
  if(btn){btn.className='btn btn-pri';btn.style.fontSize='12px';btn.style.padding='6px 14px';}
  const labels = {scripts:'🎬 AI Scripts',prompts:'🎨 Video Prompts',marketing:'📣 Marketing Copy',property:'🏠 Property Assets'};
  const el = document.getElementById('ch-tab-title');
  if(el) el.textContent = labels[tab]||tab;
  renderContentHub();
}

function addContentItem() {
  const title = document.getElementById('ch-title')?.value.trim();
  if(!title){toast('Enter a title');return;}
  if(!cData.contentHub) cData.contentHub=[];
  cData.contentHub.push({
    id:'ch_'+Date.now(),
    title,
    cat: document.getElementById('ch-cat')?.value||'scripts',
    tag: document.getElementById('ch-tag')?.value.trim()||'',
    content: document.getElementById('ch-content')?.value||'',
    notes: document.getElementById('ch-notes')?.value.trim()||'',
    created: Date.now()
  });
  saveUserData(cUid,cData);
  closeModal('add-content-modal');
  ['ch-title','ch-tag','ch-content','ch-notes'].forEach(id=>{const el=document.getElementById(id);if(el)el.value='';});
  toast('Content saved! ✓');
  renderContentHub();
}

function renderContentHub() {
  if(!cData) return;
  const items = cData.contentHub||[];
  const query = (document.getElementById('ch-search')?.value||'').toLowerCase();
  const catIcons = {scripts:'🎬',prompts:'🎨',marketing:'📣',property:'🏠'};

  // KPI counts
  const set=(id,v)=>{const el=document.getElementById(id);if(el)el.textContent=v;};
  set('ch-total', items.length);
  set('ch-scripts', items.filter(i=>i.cat==='scripts').length);
  set('ch-prompts', items.filter(i=>i.cat==='prompts').length);
  set('ch-marketing', items.filter(i=>i.cat==='marketing').length);

  const filtered = items.filter(i=>{
    const matchTab = i.cat === _contentTab;
    const matchQuery = !query || i.title.toLowerCase().includes(query) || (i.content||'').toLowerCase().includes(query) || (i.tag||'').toLowerCase().includes(query);
    return matchTab && matchQuery;
  });

  const list = document.getElementById('content-hub-list');
  if(!list) return;
  if(!filtered.length){
    list.innerHTML='<div class="empty-state"><div class="es-i">'+( catIcons[_contentTab]||'✦')+'</div><h3>No items in this category</h3><button class="btn btn-pri" onclick="openModal(\'add-content-modal\')" style="margin-top:10px">Add Content</button></div>';
    return;
  }

  list.innerHTML = filtered.slice().reverse().map(function(item) {
    const preview = (item.content||'').slice(0,120).replace(/</g,'&lt;');
    const date = new Date(item.created).toLocaleDateString('en-US',{month:'short',day:'numeric'});
    return `<div style="padding:14px 0;border-bottom:1px solid var(--border)">
      <div style="display:flex;align-items:flex-start;gap:12px">
        <div style="font-size:22px;flex-shrink:0">${catIcons[item.cat]||'✦'}</div>
        <div style="flex:1;min-width:0">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;flex-wrap:wrap">
            <div style="font-size:14px;font-weight:600;color:var(--txt)">${item.title}</div>
            ${item.tag?`<span style="background:var(--sand);border-radius:4px;padding:2px 7px;font-size:10px;color:var(--txt2)">${item.tag}</span>`:''}
            <span style="font-size:10px;color:var(--txt3);margin-left:auto">${date}</span>
          </div>
          ${preview?`<div style="font-size:12px;color:var(--txt2);line-height:1.5;white-space:pre-wrap;max-height:60px;overflow:hidden">${preview}${item.content.length>120?'…':''}</div>`:''}
          ${item.notes?`<div style="font-size:11px;color:var(--txt3);margin-top:4px">📝 ${item.notes}</div>`:''}
        </div>
        <div style="display:flex;flex-direction:column;gap:4px;flex-shrink:0">
          <button class="btn btn-ghost" style="font-size:10px;padding:3px 8px" onclick="viewContentItem('${item.id}')">👁 View</button>
          <button class="btn btn-ghost" style="font-size:10px;padding:3px 8px" onclick="copyContentItem('${item.id}')">📋 Copy</button>
          <button class="btn btn-ghost" style="font-size:10px;padding:3px 8px;color:var(--terra)" onclick="deleteContentItem('${item.id}')">🗑</button>
        </div>
      </div>
    </div>`;
  }).join('');
}

function viewContentItem(id) {
  const item = (cData.contentHub||[]).find(x=>x.id===id);
  if(!item) return;
  const modal = document.getElementById('legal-modal');
  if(modal){
    document.getElementById('legal-title').textContent = item.title;
    document.getElementById('legal-content').innerHTML = `<pre style="white-space:pre-wrap;font-family:'DM Sans',sans-serif;font-size:13px;color:var(--txt);line-height:1.7">${(item.content||'').replace(/</g,'&lt;')}</pre>`;
    openModal('legal-modal');
  }
}

function copyContentItem(id) {
  const item = (cData.contentHub||[]).find(x=>x.id===id);
  if(!item) return;
  navigator.clipboard.writeText(item.content||'').then(()=>toast('Copied to clipboard! ✓'));
}

function deleteContentItem(id) {
  if(!confirm('Delete this content item?')) return;
  cData.contentHub = (cData.contentHub||[]).filter(x=>x.id!==id);
  saveUserData(cUid,cData);
  renderContentHub();
  toast('Deleted');
}

// ════════════════════════════════════════════
//  FEATURE 4 — MARKET TRENDS WIDGET
// ════════════════════════════════════════════
function refreshMarketTrends() {
  const props = cData.properties||[];
  const bookings = cData.bookings||[];
  const now = new Date();
  const thisMonth = now.toISOString().slice(0,7);

  // Simulate local market data based on user's actual occupancy + randomised market variance
  const userOccupancy = props.length
    ? props.reduce((s,p)=>s+(p.occupancy||70),0)/props.length
    : 65;

  // Build 8-week simulated demand curve (seeded by occupancy + seasonality)
  const month = now.getMonth();
  const seasonalBase = [60,62,68,75,82,88,90,85,78,72,65,60][month];
  const weeks = Array.from({length:8},(_,i)=>{
    const base = seasonalBase + (userOccupancy - 70)*0.3;
    const noise = (Math.sin(i*1.3+month)*8) + (Math.cos(i*0.7)*5);
    return Math.max(30, Math.min(100, Math.round(base + noise)));
  });

  // Trend: compare last 4 weeks vs first 4 weeks
  const early = weeks.slice(0,4).reduce((s,v)=>s+v,0)/4;
  const late  = weeks.slice(4).reduce((s,v)=>s+v,0)/4;
  const trendPct = Math.round((late - early)/early*100);
  const rising = trendPct >= 0;

  // Recommended price adjustment
  const baseAdj = Math.round(trendPct * 0.6 + (userOccupancy-70)*0.4);
  const adjClamped = Math.max(-15, Math.min(25, baseAdj));

  // Avg market rate (based on user's own average + market factor)
  const userAvgRate = props.length
    ? Math.round(props.reduce((s,p)=>s+(p.rate||100),0)/props.length)
    : 100;
  const marketRate = Math.round(userAvgRate * (1 + adjClamped/100));

  // Render
  const adjEl = document.getElementById('mkt-adj-pct');
  const lblEl = document.getElementById('mkt-adj-label');
  const recEl = document.getElementById('mkt-recommendation');
  if(adjEl) adjEl.textContent = (adjClamped>=0?'+':'')+adjClamped+'%';
  if(lblEl) lblEl.textContent = adjClamped > 5 ? 'Demand rising — consider increasing rates' :
    adjClamped < -5 ? 'Demand softening — lower rates to fill gaps' :
    'Demand steady — current rates are competitive';
  if(recEl) {
    recEl.style.background = adjClamped > 5 ? 'rgba(107,143,113,.12)' : adjClamped < -5 ? 'rgba(196,105,58,.08)' : 'rgba(200,168,75,.1)';
    recEl.style.borderColor = adjClamped > 5 ? 'var(--sage)' : adjClamped < -5 ? 'var(--terra-l)' : 'var(--gold)';
  }
  if(adjEl) adjEl.style.color = adjClamped > 0 ? 'var(--sage)' : adjClamped < 0 ? 'var(--terra)' : 'var(--gold)';

  // Sparkline
  const spark = document.getElementById('mkt-sparkline');
  const sparkLabels = document.getElementById('mkt-sparkline-labels');
  if(spark) {
    const maxV = Math.max(...weeks);
    const minV = Math.min(...weeks);
    const weekLabels = Array.from({length:8},(_,i)=>{
      const d = new Date(now);
      d.setDate(d.getDate() - (7-i)*7);
      return (d.getMonth()+1)+'/'+(d.getDate());
    });
    spark.innerHTML = weeks.map((v,i)=>{
      const h = Math.round(((v-minV)/(maxV-minV||1))*36)+12;
      const isLast = i===7;
      const col = v > (early) ? 'var(--sage)' : 'var(--terra)';
      return `<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:2px">
        <div style="width:100%;background:${col};border-radius:2px 2px 0 0;height:${h}px;opacity:${isLast?1:.7};transition:height .3s" title="Week ${i+1}: ${v}% demand"></div>
      </div>`;
    }).join('');
    if(sparkLabels) sparkLabels.innerHTML = weeks.map((_,i)=>
      `<div style="flex:1;text-align:center;font-size:8px;color:var(--txt3)">${weekLabels[i]}</div>`
    ).join('');
  }

  // Indicators
  const occTrendEl = document.getElementById('mkt-occ-trend');
  const avgRateEl = document.getElementById('mkt-avg-rate');
  if(occTrendEl) {
    occTrendEl.textContent = (rising?'↑ ':' ↓ ')+Math.abs(trendPct)+'%';
    occTrendEl.style.color = rising ? 'var(--sage)' : 'var(--terra)';
  }
  if(avgRateEl) { avgRateEl.textContent = '$'+marketRate+'/night'; avgRateEl.style.color = 'var(--txt)'; }

  const updEl = document.getElementById('mkt-updated');
  if(updEl) updEl.textContent = 'Updated '+now.toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})+' · Simulated local market data';
}

// ════════════════════════════════════════════
//  FEATURE 5 — SOFTWARE MODE / WHITE-LABEL TOGGLE
// ════════════════════════════════════════════
var _softwareMode = false; // false = CSO Property Services, true = white-label

// Strings to swap — [cso_value, whitelabel_value]
const _BRAND_NODES = [
  // Logo text in sidebar
  {sel:'.sb-logo-txt', cso:'CSO Property Services', wl:'Property Manager Pro'},
  // Auth screens
  {sel:'.auth-logo-txt', cso:'CSO Property Services', wl:'Property Manager Pro'},
  // Landing logo
  {sel:'.land-logo-txt', cso:'CSO Property Services', wl:'Property Manager Pro'},
  // Topbar title (page-title is dynamic, handled separately)
];

function toggleSoftwareMode() {
  _softwareMode = !_softwareMode;
  const toggle = document.getElementById('software-mode-toggle');
  const desc = document.getElementById('sw-mode-desc');
  if(toggle) toggle.className = 'toggle ' + (_softwareMode?'on':'off');
  if(desc) desc.innerHTML = _softwareMode
    ? '<strong>ON</strong> — Displaying as Property Manager Pro (white-label)'
    : '<strong>OFF</strong> — Displays as CSO Property Services';

  applySoftwareMode(_softwareMode);

  if(cData){ cData.softwareMode = _softwareMode; saveUserData(cUid,cData); }
  toast(_softwareMode ? '🏷 White-label mode ON' : '🏢 CSO Property Services branding restored');
}

function applySoftwareMode(on) {
  const body = document.body;
  if(on) body.classList.add('white-label-mode');
  else body.classList.remove('white-label-mode');

  // Swap text nodes
  _BRAND_NODES.forEach(function(node) {
    document.querySelectorAll(node.sel).forEach(function(el) {
      el.textContent = on ? node.wl : node.cso;
    });
  });

  // Swap page title tag
  document.title = on
    ? 'Property Manager Pro — Smarter STR Management'
    : 'CSO Property Services — Smarter Airbnb Management';

  // Swap meta og:title
  const ogTitle = document.querySelector('meta[property="og:title"]');
  if(ogTitle) ogTitle.setAttribute('content', on ? 'Property Manager Pro' : 'CSO Property Services — Smarter Airbnb Management');
}

// ════════════════════════════════════════════
//  FEATURE 6 — BACKEND / TAILWIND BRIDGE NOTES
// ════════════════════════════════════════════
/*
  SUPABASE BACKEND — Already fully configured:
  ─────────────────────────────────────────────
  Auth:         sb.auth.signUp / signInWithPassword / signOut
  Data:         sb.from('user_data').upsert(...)  — user_id + data_type + data (jsonb)
  Profiles:     sb.from('profiles').upsert(...)   — plan, full_name, email
  Edge Fns:     /functions/v1/ical-sync, send-notification, ai-draft, stripe-webhook
  Multi-tenant: Each user's data is isolated by user_id with RLS policies

  TO SCALE FURTHER:
  - Add a `teams` table for org-level access (already have team invite logic)
  - Add `webhooks` table for real-time Stripe plan sync
  - Add `content_hub` table to sync AI Content Hub server-side

  TAILWIND CSS BRIDGE:
  ────────────────────
  The CSS custom properties below map directly to Tailwind's config.
  Add this to tailwind.config.js to use these tokens as Tailwind utilities:

  theme: {
    extend: {
      colors: {
        terra:   '#C4693A',
        'terra-d': '#B05A2E',
        'terra-l': '#F0A882',
        sage:    '#6B8F71',
        'sage-l': '#A8C4AB',
        gold:    '#C8A84B',
        'gold-l': '#E8CC7A',
        navy:    '#1E2D40',
        bg:      'var(--bg)',
        bg2:     'var(--bg2)',
        card:    'var(--card)',
        txt:     'var(--txt)',
        txt2:    'var(--txt2)',
        txt3:    'var(--txt3)',
        border:  'var(--border)',
      },
      fontFamily: {
        sans:  ['DM Sans', 'system-ui', 'sans-serif'],
        serif: ['Fraunces', 'Georgia', 'serif'],
      },
      borderRadius: { card: '14px', btn: '8px', kpi: '12px' },
      boxShadow: {
        sm:  'var(--sh)',
        md:  'var(--shm)',
        lg:  'var(--shl)',
      }
    }
  }
*/

// ════════════════════════════════════════════
//  BONUS — VENDOR MANAGEMENT
// ════════════════════════════════════════════
function renderVendorMgmt() {
  if(!requireCohost('vendor_mgmt')) return;

  const now = new Date();
  const allJobs = cData.jobs||[];
  const allPayouts = cData.payouts||[];

  // Populate month filter
  const monthSel = document.getElementById('vend-filter-month');
  if(monthSel && !monthSel.options.length) {
    const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
    for(let i=5;i>=0;i--) {
      const d = new Date(now.getFullYear(), now.getMonth()-i, 1);
      const val = d.toISOString().slice(0,7);
      const opt = document.createElement('option');
      opt.value = val;
      opt.textContent = months[d.getMonth()]+' '+d.getFullYear();
      if(val===now.toISOString().slice(0,7)) opt.selected=true;
      monthSel.appendChild(opt);
    }
  }
  const selectedMonth = monthSel?.value || now.toISOString().slice(0,7);

  const monthJobs = allJobs.filter(j=>j.date&&j.date.startsWith(selectedMonth));
  const set=(id,v)=>{const el=document.getElementById(id);if(el)el.textContent=v;};

  // Owner billed = total job pay (what the owner/host was charged)
  const totalBilled = monthJobs.reduce((s,j)=>s+(j.pay||0),0);
  // Worker payout = cleanerPay portion
  const totalPayout = monthJobs.reduce((s,j)=>s+(j.cleanerPay||Math.round((j.pay||0)*(1-(j.feePct||10)/100))),0);
  // Platform fee = billed - payout
  const totalFee = monthJobs.reduce((s,j)=>s+(j.platformFee||Math.round((j.pay||0)*(j.feePct||10)/100)),0);
  // Net profit = fee (what the co-host keeps)
  const netProfit = totalBilled - totalPayout;

  set('vend-billed','$'+Math.round(totalBilled).toLocaleString());
  set('vend-payout','$'+Math.round(totalPayout).toLocaleString());
  set('vend-fee','$'+Math.round(totalFee).toLocaleString());
  set('vend-profit','$'+Math.round(netProfit).toLocaleString());

  const monthLabel = new Date(selectedMonth+'-01').toLocaleString('default',{month:'long',year:'numeric'});
  set('vend-month-label', monthLabel);

  // Monthly summary by cleaner
  const summaryEl = document.getElementById('vend-summary-rows');
  if(summaryEl) {
    if(!monthJobs.length) {
      summaryEl.innerHTML='<div style="font-size:13px;color:var(--txt3)">No jobs posted this month.</div>';
    } else {
      // Group by cleaner
      const byWorker = {};
      monthJobs.forEach(function(j) {
        const name = j.cleanerName||'Unassigned';
        if(!byWorker[name]) byWorker[name]={name,jobs:0,billed:0,payout:0,fee:0};
        byWorker[name].jobs++;
        byWorker[name].billed += (j.pay||0);
        byWorker[name].payout += (j.cleanerPay||Math.round((j.pay||0)*(1-(j.feePct||10)/100)));
        byWorker[name].fee    += (j.platformFee||Math.round((j.pay||0)*(j.feePct||10)/100));
      });
      summaryEl.innerHTML = Object.values(byWorker).map(function(w){
        return `<div style="display:flex;align-items:center;gap:12px;padding:10px 0;border-bottom:1px solid var(--border)">
          <div style="width:34px;height:34px;border-radius:50%;background:var(--terra);color:#fff;display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:700;flex-shrink:0">${w.name[0]}</div>
          <div style="flex:1">
            <div style="font-size:13px;font-weight:600;color:var(--txt)">${w.name}</div>
            <div style="font-size:11px;color:var(--txt3)">${w.jobs} job${w.jobs!==1?'s':''}</div>
          </div>
          <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;text-align:center">
            <div><div style="font-size:10px;color:var(--txt3)">Billed</div><div style="font-size:13px;font-weight:600;color:var(--txt)">$${Math.round(w.billed).toLocaleString()}</div></div>
            <div><div style="font-size:10px;color:var(--txt3)">Worker Pay</div><div style="font-size:13px;font-weight:600;color:var(--terra)">$${Math.round(w.payout).toLocaleString()}</div></div>
            <div><div style="font-size:10px;color:var(--txt3)">Your Profit</div><div style="font-size:13px;font-weight:600;color:var(--sage)">$${Math.round(w.billed-w.payout).toLocaleString()}</div></div>
          </div>
        </div>`;
      }).join('');
    }
  }

  // Full job list
  const jobList = document.getElementById('vend-jobs-list');
  if(jobList) {
    const typeLabels={turnover:'🔄 Turnover',deep:'🧹 Deep Clean',inspect:'🔍 Inspect',laundry:'👕 Laundry'};
    const sc={open:'pill-amber',assigned:'pill-blue',in_progress:'pill-blue',completed:'pill-green',declined:'pill-red'};
    if(!monthJobs.length) {
      jobList.innerHTML='<div class="empty-state"><div class="es-i">🔧</div><h3>No jobs this month</h3><button class="btn btn-pri" onclick="openModal(\'hire-cleaner-modal\')" style="margin-top:10px">Post Job</button></div>';
    } else {
      jobList.innerHTML = `
        <div style="display:grid;grid-template-columns:2fr 1fr 1fr 1fr 1fr 80px;gap:8px;padding:8px 0;border-bottom:2px solid var(--border);font-size:10px;font-weight:700;color:var(--txt3);letter-spacing:.5px;text-transform:uppercase">
          <div>Job</div><div style="text-align:right">Owner Billed</div><div style="text-align:right">Worker Pay</div><div style="text-align:right">Platform Fee</div><div style="text-align:right">Net Profit</div><div style="text-align:right">Status</div>
        </div>` +
        monthJobs.slice().reverse().map(function(j){
          const fee = j.platformFee||Math.round((j.pay||0)*(j.feePct||10)/100);
          const workerPay = j.cleanerPay||Math.round((j.pay||0)*(1-(j.feePct||10)/100));
          const net = (j.pay||0) - workerPay;
          return `<div style="display:grid;grid-template-columns:2fr 1fr 1fr 1fr 1fr 80px;gap:8px;padding:10px 0;border-bottom:1px solid var(--border);align-items:center">
            <div>
              <div style="font-size:12px;font-weight:600;color:var(--txt)">${typeLabels[j.type]||j.type} — ${j.propName}</div>
              <div style="font-size:10px;color:var(--txt3)">${j.date} · ${j.cleanerName}</div>
            </div>
            <div style="text-align:right;font-size:13px;font-weight:600;color:var(--txt)">$${(j.pay||0).toLocaleString()}</div>
            <div style="text-align:right;font-size:13px;color:var(--terra)">$${workerPay.toLocaleString()}</div>
            <div style="text-align:right;font-size:13px;color:var(--gold)">$${fee.toLocaleString()}</div>
            <div style="text-align:right;font-size:13px;font-weight:600;color:var(--sage)">$${net.toLocaleString()}</div>
            <div style="text-align:right"><span class="pill ${sc[j.status]||'pill-amber'}" style="font-size:9px">${j.status.replace('_',' ')}</span></div>
          </div>`;
        }).join('');
    }
  }
}

// ════════════════════════════════════════════
//  WHITE-LABEL BRANDING (Co-Host)
// ════════════════════════════════════════════
function saveBranding() {
  if(!cData.branding) cData.branding = {};
  cData.branding = {
    name:    document.getElementById('brand-name')?.value.trim() || '',
    logo:    document.getElementById('brand-logo')?.value.trim() || '',
    color:   document.getElementById('brand-color')?.value || '#C4693A',
    tagline: document.getElementById('brand-tagline')?.value.trim() || '',
    email:   document.getElementById('brand-email')?.value.trim() || '',
    website: document.getElementById('brand-website')?.value.trim() || '',
  };
  saveUserData(cUid, cData);
  toast('Branding saved! Guest portals and owner reports will use your brand ✓');
}

// ════════════════════════════════════════════
//  HELP CENTER
// ════════════════════════════════════════════
let _helpTab = 'all';

function switchHelpTab(tab, btn) {
  _helpTab = tab;
  document.querySelectorAll('#help-plan-tabs button').forEach(b=>{b.className='btn btn-ghost';b.style.fontSize='12px';b.style.padding='6px 14px';});
  if(btn){btn.className='btn btn-pri';btn.style.fontSize='12px';btn.style.padding='6px 14px';}
  renderHelp();
}

function renderHelp() {
  const el = document.getElementById('help-content');
  if(!el) return;
  const plan = cData?.plan||'free';

  // Auto-select user's plan tab on first load (when tab is still 'all' default)
  if(_helpTab==='all' && plan!=='free') {
    _helpTab = plan==='trial'?'pro':plan;
    // Update tab buttons
    document.querySelectorAll('#help-plan-tabs button').forEach(function(b,i){
      const tabs=['all','free','pro','business','cohost'];
      b.className = tabs[i]===_helpTab ? 'btn btn-pri' : 'btn btn-ghost';
      b.style.fontSize='12px'; b.style.padding='6px 14px';
    });
  }

  const tab = _helpTab;

  const sections = [
    {
      title:'🏠 Getting Started',
      plans:['free','pro','business','cohost'],
      items:[
        {q:'How do I add a property?',a:'Go to <strong>Properties</strong> in the sidebar → click <strong>+ Add Property</strong>. Enter your property name, location, nightly rate, WiFi, and door code. These details automatically populate guest portals, AI messages, and check-in instructions.'},
        {q:'How do I sync my Airbnb calendar?',a:'Go to <strong>iCal Sync</strong> → click <strong>+ Add Feed</strong>. In Airbnb: go to Calendar → Availability → Export Calendar → copy the URL. Paste it here and your bookings import instantly. The app re-syncs on every login.'},
        {q:'How do I add a booking manually?',a:'Go to <strong>Bookings</strong> → click <strong>+ Add Booking</strong>. Fill in guest name, property, check-in/out dates, and price. Status options: Pending, Confirmed, Completed, Cancelled.'},
        {q:'What is the demo mode?',a:'Click <strong>🚀 Launch Demo</strong> on the login screen to explore the app with sample data — 3 properties, bookings, messages, and expenses — without creating an account.'},
      ]
    },
    {
      title:'💬 Messaging & AI',
      plans:['free','pro','business','cohost'],
      items:[
        {q:'How does AI messaging work?',a:'Go to <strong>Settings → AI Messaging</strong> and paste your Claude API key (free at console.anthropic.com). Then open any message thread and click <strong>AI Reply</strong> — the AI drafts a contextual response using your property details, check-in times, WiFi, and door code automatically.'},
        {q:'What are Auto-Reply Rules?',a:'Go to <strong>Messages → Auto-Reply tab</strong>. Create rules with trigger keywords (e.g. "parking", "WiFi") and a reply template. When a guest message contains the keyword, the rule fires automatically. Supports variable substitution: {wifi_name}, {door_code}, {checkin_time}.'},
        {q:'What is AI Office Hours?',a:'Go to <strong>AI Office Hours</strong> in the sidebar. Set your quiet hours (e.g. 10pm–8am) and a custom auto-reply message. When guests message during those hours, they get your message instantly. You can set escalation keywords (fire, flood, emergency) to bypass the quiet hours filter.'},
        {q:'What are Message Templates?',a:'Go to <strong>Message Templates</strong> in the sidebar. Save frequently used messages — check-in instructions, house rules, review requests — and reuse them in any conversation with one click.'},
      ]
    },
    {
      title:'🧹 Cleaning & Staff',
      plans:['free','pro','business','cohost'],
      items:[
        {q:'How do I send a job to a cleaner?',a:'Go to <strong>Cleaner Marketplace</strong> → <strong>+ Add Cleaner</strong> first (name, phone, rate). Then click <strong>Request Job</strong>, fill in the details, and assign your cleaner. Click the <strong>🔗 link button</strong> on the job to copy a shareable URL. Send it via SMS or WhatsApp — the cleaner opens it on their phone, accepts, follows the checklist, and marks it complete.'},
        {q:'What are the built-in checklists?',a:'Go to <strong>Staff Portal → Property Checklists</strong>. Four types: Turnover (30 items across Kitchen, Bathrooms, Bedrooms, Living Areas), Pre-Arrival, Checkout, and Maintenance. Each has a progress bar and a print button.'},
        {q:'How does quality scoring work?',a:'After marking a job complete, a star rating prompt appears automatically. Rate the job 1–5 stars with notes. The cleaner\'s rolling average updates on their card in the marketplace.'},
        {q:'What is the auto-cleaning task feature?',a:'Go to <strong>Automations → Auto-Cleaning</strong>. Enable it and set your preferred cleaner, task title, and timing. The app creates a cleaning task automatically every time a booking checkout is added or synced via iCal.'},
      ]
    },
    {
      title:'💰 Revenue & Finances',
      plans:['free','pro','business','cohost'],
      items:[
        {q:'How do I track expenses?',a:'Go to <strong>Expenses</strong> in the sidebar. Add any expense with a category (cleaning, repairs, utilities, mortgage, insurance, etc.) and link it to a property. The P&L tab shows revenue minus expenses, net profit, and margin — per month and per property.'},
        {q:'How do I export for tax season?',a:'Go to <strong>Expenses → Tax Export tab</strong>. Generates a Schedule E-formatted table of all expenses by category. Click <strong>Export CSV</strong> to download as a spreadsheet you can hand to your accountant.'},
        {q:'What is the Pricing Optimizer?',a:'Go to <strong>Pricing Optimizer</strong> in the sidebar. Set percentage rules for weekends, peak season, low season, last-minute, and long stays. Click Optimize to see suggested rates applied to each property based on current occupancy.'},
        {q:'What is the Market Trends widget?',a:'The widget lives on your dashboard. It shows an 8-week demand sparkline, occupancy trend, average market rate, and a recommended price adjustment percentage. Tap ↻ to refresh. It simulates local demand using your occupancy data and seasonal patterns.'},
      ]
    },
    {
      title:'🔑 Guest Experience',
      plans:['free','pro','business','cohost'],
      items:[
        {q:'How do I create a Guest Portal?',a:'Go to <strong>Guest Portal</strong> in the sidebar. Select a property and booking. A personalized HTML page is generated with the guest\'s name, door code, WiFi, check-in/out times, parking, and house tips. Download it or copy the HTML to send to your guest.'},
        {q:'What is the QR House Manual?',a:'Go to <strong>QR House Manual</strong> in the sidebar. Fill in the property details and click <strong>Build Manual</strong>. A scannable QR code is generated that opens the manual on the guest\'s phone — no app needed. Download it to print or frame in the property.'},
        {q:'How does the Guest Blacklist work?',a:'Go to <strong>Guest Blacklist</strong> in the sidebar. Add a guest name, reason, and notes. Blacklisted guests show a ⛔ flag in the Guest CRM. Useful for noting problematic guests before accepting future bookings.'},
        {q:'What is Check-in Insurance (Flex-Time)?',a:'Go to <strong>Check-in Insurance</strong> in the sidebar. Set fees for early check-in and late checkout requests. When guests request flex time, you approve or decline. Revenue from approved requests tracks automatically.'},
      ]
    },
    {
      title:'🚀 Pro Plan Features',
      plans:['pro','business','cohost'],
      items:[
        {q:'What extra features does Pro unlock?',a:'Pro adds: up to 10 properties, Inventory tracking, Guest CRM with loyalty tiers, Pricing Optimizer, Revenue reports with CSV export, Property Scorecards, Damage Claims, Equipment Rentals, Direct Booking Kit, Concierge services, Upsell portal, and Affiliate program.'},
        {q:'How does inventory tracking work?',a:'Go to <strong>Inventory</strong> in the sidebar. Add supplies (toiletries, coffee pods, towels) per property with a restock threshold. The dashboard alerts you when anything hits the low-stock level. One click generates a shopping list you can copy or send.'},
        {q:'What is the Guest Loyalty program?',a:'Go to <strong>Guest Loyalty</strong> in the sidebar. Guests who book multiple times earn tiers: New, Silver (2 stays), Gold (5 stays), Platinum (10 stays). You can send anniversary discount messages automatically via the Automations tab.'},
        {q:'What is the AI Content Hub?',a:'Go to <strong>Content Hub</strong> in the sidebar. Save and organize AI-generated content by category: AI Scripts, Video Prompts, Marketing Copy, or Property Assets. Each item has a title, tag, full content body, notes, and one-click copy.'},
      ]
    },
    {
      title:'💼 Business Plan Features',
      plans:['business','cohost'],
      items:[
        {q:'What does Business add over Pro?',a:'Business adds: unlimited properties, Team Access (invite managers/viewers), Software Mode white-label toggle, full Automations suite, and all analytics features without any limits.'},
        {q:'How does Team Access work?',a:'Go to <strong>Settings → Team Access</strong> (visible on Business and Co-Host plans). Click <strong>Invite Member</strong>, enter their email and role (Manager or Viewer). They receive an invitation email and create their own account to access your workspace.'},
        {q:'What is Software Mode?',a:'Go to <strong>Settings → Software Mode</strong>. Toggle ON to switch all branding to a neutral name ("Property Manager Pro") across every title, logo, and browser tab. Use this when demoing to clients or reselling the platform. Toggle OFF to restore CSO Property Services branding.'},
      ]
    },
    {
      title:'🏆 Co-Host Plan Features',
      plans:['cohost'],
      items:[
        {q:'What does Co-Host add over Business?',a:'Co-Host adds: Vendor Management (owner billing vs worker payout tracking), Owner Management (commission splits, owner reports), Co-Host Earnings Dashboard, Photo Vault (proof-of-service photos), Payout Ledger, White-Label Branding (your logo/colors on portals and reports), and Affiliate Program.'},
        {q:'How does Vendor Management work?',a:'Go to <strong>Vendor Management</strong> in the sidebar. Every job you post shows: Owner Billed (what the host charged), Worker Pay (what the cleaner gets), Platform Fee (your 10%), and Net Profit (what you keep). Monthly summary groups everything by worker.'},
        {q:'How do I send an Owner Report?',a:'Go to <strong>Reports → Owner Reports tab</strong> (or use the Command Center). Select the property, enter the owner\'s email and commission %. Click <strong>Send Report</strong> — a branded HTML report is emailed with revenue, bookings, expenses, and net payout for the period.'},
        {q:'How does White-Label Branding work?',a:'Go to <strong>Settings → White-Label Branding</strong> (Co-Host only). Enter your business name, logo URL, accent color, tagline, contact email, and website. These replace all CSO Property Services branding on guest portals and owner reports. Click Preview to see how it looks.'},
        {q:'What is the Co-Host Earnings Dashboard?',a:'Go to <strong>Earnings Dashboard</strong> in the sidebar. Shows your earnings for any month: KPIs (your take-home, gross managed, YTD, next month projection), per-property breakdown with commission bars, 12-month trend chart, owner payout status, and expense deductions. Export to CSV anytime.'},
      ]
    },
    {
      title:'⚙️ Settings & Account',
      plans:['free','pro','business','cohost'],
      items:[
        {q:'How do I change my password?',a:'Click <strong>Forgot password?</strong> on the login screen. Enter your email — a reset link will arrive within a few minutes. The link expires after 1 hour for security.'},
        {q:'Where is my data stored?',a:'All data is stored securely in Supabase (PostgreSQL on AWS), encrypted in transit and at rest. Your data is private to your account — no other user can access it. It also syncs to your browser\'s localStorage for offline access.'},
        {q:'How do I delete my account?',a:'Email <strong>csopropertyservice@gmail.com</strong> with your account email and we\'ll process the deletion within 24 hours, removing all your data permanently.'},
        {q:'Can I use the app offline?',a:'Yes — the app caches your data in localStorage so you can view and edit your properties, bookings, and notes without internet. Changes sync to the cloud automatically when you reconnect.'},
      ]
    },
  ];

  const filtered = sections.filter(s=>
    tab==='all' || s.plans.includes(tab)
  );

  el.innerHTML = filtered.map(function(section) {
    const items = tab==='all' ? section.items : section.items.filter(()=>true);
    return `<div class="card" style="margin-bottom:16px">
      <div class="card-hd"><div class="card-title">${section.title}${tab!=='all'&&tab!=='free'?`<span class="pill pill-${tab==='cohost'?'gold':tab==='business'?'blue':'green'}" style="font-size:10px;margin-left:8px">${tab==='cohost'?'🏆':tab==='business'?'💼':'🚀'} ${tab}</span>`:''}</div></div>
      <div class="card-body" style="padding-top:4px">
        ${items.map(function(item,i){
          return `<details style="padding:10px 0;border-bottom:1px solid var(--border2);cursor:pointer" ${i===0?'open':''}>
            <summary style="font-size:13px;font-weight:600;color:var(--txt);list-style:none;display:flex;align-items:center;justify-content:space-between;user-select:none">
              ${item.q}
              <span style="font-size:12px;color:var(--txt3);flex-shrink:0;margin-left:8px">▾</span>
            </summary>
            <div style="font-size:13px;color:var(--txt2);line-height:1.7;margin-top:8px;padding-left:2px">${item.a}</div>
          </details>`;
        }).join('')}
      </div>
    </div>`;
  }).join('') + `
    <div style="text-align:center;padding:20px;font-size:13px;color:var(--txt3)">
      Can't find what you need? <button onclick="openAITour()" class="btn btn-pri" style="font-size:12px;padding:6px 14px;margin-left:8px">🤖 Ask AI Tour Guide</button>
      or email <a href="mailto:csopropertyservice@gmail.com" style="color:var(--terra)">csopropertyservice@gmail.com</a>
    </div>`;
}

// ════════════════════════════════════════════
//  AI TOUR GUIDE
// ════════════════════════════════════════════
var _tourHistory = [];
var _tourOpen = false;

function openAITour() {
  _tourOpen = true;
  const panel = document.getElementById('ai-tour-panel');
  const fab = document.getElementById('ai-tour-fab');
  if(panel) panel.style.display='flex';
  if(fab) fab.style.display='none';
  setTimeout(()=>document.getElementById('tour-input')?.focus(),100);
}

function closeAITour() {
  _tourOpen = false;
  const panel = document.getElementById('ai-tour-panel');
  const fab = document.getElementById('ai-tour-fab');
  if(panel) panel.style.display='none';
  if(fab) fab.style.display='flex';
}

async function sendTourMsg(presetMsg) {
  const input = document.getElementById('tour-input');
  const msgBox = document.getElementById('tour-messages');
  if(!input || !msgBox) return;

  const msg = presetMsg || (input.value||'').trim();
  if(!msg) return;
  input.value='';
  input.disabled=true;

  // User bubble
  const ud = document.createElement('div');
  ud.style.cssText='background:var(--terra);color:#fff;border-radius:10px 10px 2px 10px;padding:10px 14px;font-size:13px;line-height:1.5;max-width:85%;align-self:flex-end';
  ud.textContent=msg;
  msgBox.appendChild(ud);

  // Bot thinking
  const td = document.createElement('div');
  td.style.cssText='background:var(--card);border:1px solid var(--border);border-radius:10px 10px 10px 2px;padding:10px 14px;font-size:13px;color:var(--txt);line-height:1.6;max-width:90%';
  td.innerHTML='<span style="opacity:.5">Thinking…</span>';
  msgBox.appendChild(td);
  msgBox.scrollTop=msgBox.scrollHeight;

  _tourHistory.push({role:'user', content:msg});

  const plan = cData?.plan||'free';
  const planLabel = plan==='cohost'?'Co-Host ($299)':plan==='business'?'Business ($199)':plan==='pro'?'Pro ($79)':'Free';
  const props = (cData?.properties||[]).map(p=>p.name).join(', ')||'none yet';
  const bookingCount = (cData?.bookings||[]).filter(b=>b.status!=='cancelled').length;

  const systemPrompt = `You are the CSO Property Services AI Tour Guide — a friendly, knowledgeable assistant built into the app to help users learn how to use every feature.

USER CONTEXT:
- Plan: ${planLabel}
- Properties: ${props}
- Active bookings: ${bookingCount}
- Features available on their plan: ${plan==='free'?'Bookings, Messages, Guest Portal, Basic Analytics (1 property)':plan==='pro'||plan==='trial'?'Everything in Free + up to 10 properties, iCal Sync, AI Messaging, Cleaning/Staff, Inventory, CRM, Loyalty, Pricing Optimizer, Market Trends, Content Hub, Revenue Reports':plan==='business'?'Everything in Pro + Unlimited properties, Team Access, Software Mode, Full Automations':plan==='cohost'?'Everything in Business + Vendor Management, Owner Reports, Co-Host Earnings Dashboard, Photo Vault, Payout Ledger, White-Label Branding, Affiliate Program':'All features'}

INSTRUCTIONS:
- Answer questions about how to use specific features with clear step-by-step directions
- If they ask about a feature not on their plan, explain what plan unlocks it
- Use sidebar navigation names exactly as they appear (e.g. "Cleaner Marketplace", "iCal Sync", "Guest Portal")
- Keep responses concise — 2-4 sentences for simple questions, up to 8 for complex walkthroughs
- Use bold for feature names and navigation paths
- Be encouraging and practical
- If they ask what they should set up first, give a plan-specific priority list`;

  try {
    // Routes through Supabase Edge Function — no client-side API key needed

    const response = await fetch('https://vdnyqwpznsysrvyvbqga.supabase.co/functions/v1/ai-draft',{
      method:'POST',
      headers:{
        'Content-Type':'application/json',
        'Authorization':'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZkbnlxd3B6bnN5c3J2eXZicWdhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ2NjM4NjUsImV4cCI6MjA5MDIzOTg2NX0.VxwNE_lMR2JV_70SVr9rio_UgfbKGnYFyeitkTuWYkM'
      },
      body:JSON.stringify({
        prompt: systemPrompt + '\n\nConversation so far:\n' + 
          _tourHistory.slice(-12).map(m => m.role.toUpperCase() + ': ' + m.content).join('\n') +
          '\n\nUSER: ' + msg
      })
    });
    const data = await response.json();
    if(data.error) throw new Error(data.error);
    const reply = data.text || data.content?.[0]?.text || 'Sorry, I had trouble with that. Try asking again!';

    // Render markdown-lite: **bold**, newlines
    td.innerHTML = reply
      .replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>')
      .replace(/\n/g,'<br>');
    _tourHistory.push({role:'assistant',content:reply});

  } catch(e) {
    const errMsg = e?.message||'';
    const isKeyErr = errMsg.includes('401') || errMsg.includes('invalid') || errMsg.includes('authentication');
    const isCors = errMsg.includes('Failed to fetch') || errMsg.includes('NetworkError') || errMsg.includes('CORS');
    if(isKeyErr) {
      td.innerHTML = `Your API key looks incorrect. Go to <strong>Settings → AI Messaging</strong>, clear the key field, paste your key from <a href="https://console.anthropic.com" target="_blank" style="color:var(--terra)">console.anthropic.com</a>, and click <strong>Save Key</strong>.`;
    } else if(isCors) {
      td.innerHTML = `Browser security is blocking the AI connection. This is a known issue when calling the Anthropic API directly from a browser. <strong>Workaround:</strong> Make sure your API key starts with <code>sk-ant-</code>, then try again. If it persists, the Help Center has full feature guides that don't require AI.`;
    } else {
      td.innerHTML = `AI error: ${errMsg||'Unknown error'}. Check your API key in <strong>Settings → AI Messaging</strong>.`;
    }
  }

  msgBox.scrollTop=msgBox.scrollHeight;
  input.disabled=false;
  input.focus();

  // Update status
  const statusEl = document.getElementById('tour-status');
  if(statusEl) statusEl.textContent = planLabel+' plan';
}

function previewBranding() {
  const b = {
    name:    document.getElementById('brand-name')?.value.trim() || 'Your Business Name',
    logo:    document.getElementById('brand-logo')?.value.trim() || '',
    color:   document.getElementById('brand-color')?.value || '#C4693A',
    tagline: document.getElementById('brand-tagline')?.value.trim() || 'Premium Property Management',
    email:   document.getElementById('brand-email')?.value.trim() || 'you@yourbusiness.com',
    website: document.getElementById('brand-website')?.value.trim() || '',
  };
  const html = `
    <div style="font-family:sans-serif;max-width:420px;margin:0 auto">
      <div style="background:${b.color};padding:24px;border-radius:12px;text-align:center;margin-bottom:16px">
        ${b.logo ? `<img src="${b.logo}" style="height:48px;margin-bottom:8px;object-fit:contain">` : `<div style="font-size:32px;margin-bottom:8px">🏡</div>`}
        <div style="font-family:Georgia,serif;font-size:22px;color:#fff;font-weight:600">${b.name}</div>
        ${b.tagline ? `<div style="font-size:12px;color:rgba(255,255,255,.75);margin-top:4px">${b.tagline}</div>` : ''}
      </div>
      <div style="background:#F5F1EB;border-radius:10px;padding:16px;font-size:13px;color:#5C3D2E;line-height:1.6">
        <strong>This is how your guest portals and owner reports will look.</strong><br>
        Your logo, business name, and brand color replace all CSO Property Services branding.
        ${b.email ? `<br><br>📧 ${b.email}` : ''}
        ${b.website ? `<br>🌐 ${b.website}` : ''}
      </div>
    </div>`;
  const modal = document.getElementById('legal-modal');
  if(modal) {
    document.getElementById('legal-title').textContent = '👁 Brand Preview';
    document.getElementById('legal-content').innerHTML = html;
    openModal('legal-modal');
  }
}

function getBranding() {
  // Returns active branding — falls back to CSO defaults if no custom branding set
  const b = cData?.branding || {};
  return {
    name:    b.name    || 'CSO Property Services',
    logo:    b.logo    || '',
    color:   b.color   || '#C4693A',
    tagline: b.tagline || 'Property Management',
    email:   b.email   || 'csopropertyservice@gmail.com',
    website: b.website || 'https://csopropertyservices.com/',
  };
}

// ════════════════════════════════════════════
//  COHOST EARNINGS DASHBOARD
// ════════════════════════════════════════════
function renderCohostEarnings() {
  if(!requireCohost('cohost_earnings')) return;

  const now = new Date();
  const thisYear = now.getFullYear();

  // Populate month selector
  const sel = document.getElementById('earn-month-sel');
  if(sel && !sel.options.length) {
    const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
    for(let i=11; i>=0; i--) {
      const d = new Date(thisYear, now.getMonth()-i, 1);
      const val = d.toISOString().slice(0,7);
      const opt = document.createElement('option');
      opt.value = val;
      opt.textContent = months[d.getMonth()] + ' ' + d.getFullYear();
      if(val === now.toISOString().slice(0,7)) opt.selected = true;
      sel.appendChild(opt);
    }
  }
  const selectedMonth = sel?.value || now.toISOString().slice(0,7);

  const bookings = cData.bookings || [];
  const expenses = cData.expenses || [];
  const owners   = cData.owners   || [];
  const props    = cData.properties || [];

  // Helper: get bookings for a given YYYY-MM
  const bForMonth = (mo) => bookings.filter(b => b.status!=='cancelled' && b.checkin && b.checkin.startsWith(mo));

  // This month
  const monthBk  = bForMonth(selectedMonth);
  const monthGross = monthBk.reduce((s,b) => s+(b.price||0), 0);

  // Calculate co-host earnings = sum of (gross * commission%) per property
  function earningsForBookings(bks) {
    return bks.reduce((s,b) => {
      const owner = owners.find(o => (o.propIds||[]).includes(b.propId));
      const comm  = owner ? (owner.commission||20) : 20;
      return s + (b.price||0) * comm / 100;
    }, 0);
  }

  const monthEarnings = earningsForBookings(monthBk);
  const monthExp = expenses.filter(e => (e.date||'').startsWith(selectedMonth)).reduce((s,e)=>s+(e.amount||0),0);

  // YTD
  const ytdEarnings = Array.from({length:12},(_,i)=>{
    const d = new Date(thisYear, i, 1);
    return d <= now ? earningsForBookings(bForMonth(d.toISOString().slice(0,7))) : 0;
  }).reduce((s,v)=>s+v,0);

  // Projection — average of last 3 months
  const last3 = [-1,-2,-3].map(offset=>{
    const d = new Date(now.getFullYear(), now.getMonth()+offset, 1);
    return earningsForBookings(bForMonth(d.toISOString().slice(0,7)));
  });
  const projection = Math.round(last3.reduce((s,v)=>s+v,0)/3);

  const set = (id,v) => { const el=document.getElementById(id); if(el) el.textContent=v; };
  set('earn-month-total',  '$'+Math.round(monthEarnings).toLocaleString());
  set('earn-month-gross',  '$'+Math.round(monthGross).toLocaleString());
  set('earn-ytd',          '$'+Math.round(ytdEarnings).toLocaleString());
  set('earn-projection',   '$'+projection.toLocaleString());

  // Per-property breakdown
  const propEl = document.getElementById('earn-by-prop');
  if(propEl) {
    if(!props.length) {
      propEl.innerHTML = '<div class="empty-state"><div class="es-i">🏠</div><p>No properties yet</p></div>';
    } else {
      propEl.innerHTML = props.map(p => {
        const pBk    = monthBk.filter(b=>b.propId===p.id);
        const pGross = pBk.reduce((s,b)=>s+(b.price||0),0);
        const owner  = owners.find(o=>(o.propIds||[]).includes(p.id));
        const comm   = owner ? (owner.commission||20) : 20;
        const pEarn  = Math.round(pGross * comm / 100);
        const pOwner = Math.round(pGross * (1 - comm/100));
        if(!pGross) return `
          <div style="display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid var(--border);opacity:.5">
            <div style="font-size:22px">${p.emoji||'🏠'}</div>
            <div style="flex:1"><div style="font-size:13px;font-weight:600;color:var(--txt)">${p.name}</div>
            <div style="font-size:11px;color:var(--txt3)">No bookings this month</div></div>
            <div style="font-size:13px;color:var(--txt3)">—</div>
          </div>`;
        const barW = monthGross ? Math.round(pGross/monthGross*100) : 0;
        return `
          <div style="padding:12px 0;border-bottom:1px solid var(--border)">
            <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px">
              <div style="font-size:22px;flex-shrink:0">${p.emoji||'🏠'}</div>
              <div style="flex:1">
                <div style="font-size:13px;font-weight:600;color:var(--txt)">${p.name}</div>
                <div style="font-size:11px;color:var(--txt3)">${owner?owner.name+' · ':''}${comm}% commission · ${pBk.length} booking${pBk.length!==1?'s':''}</div>
              </div>
              <div style="text-align:right;flex-shrink:0">
                <div style="font-size:14px;font-weight:700;color:var(--sage)">+$${pEarn.toLocaleString()}</div>
                <div style="font-size:11px;color:var(--txt3)">Owner: $${pOwner.toLocaleString()}</div>
              </div>
            </div>
            <div style="background:var(--sand);border-radius:4px;height:6px;overflow:hidden">
              <div style="background:var(--gold);height:100%;width:${barW}%;border-radius:4px;transition:width .4s"></div>
            </div>
          </div>`;
      }).join('');
    }
  }

  // 12-month trend chart
  const chartEl   = document.getElementById('earn-trend-chart');
  const labelsEl  = document.getElementById('earn-trend-labels');
  const months12  = Array.from({length:12},(_,i)=>{
    const d = new Date(now.getFullYear(), now.getMonth()-11+i, 1);
    return { mo: d.toISOString().slice(0,7), label: ['J','F','M','A','M','J','J','A','S','O','N','D'][d.getMonth()] };
  });
  const vals = months12.map(m => earningsForBookings(bForMonth(m.mo)));
  const maxV = Math.max(...vals, 1);
  if(chartEl) chartEl.innerHTML = vals.map((v,i) => {
    const h = Math.round(v/maxV*100);
    const isSel = months12[i].mo === selectedMonth;
    return `<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:3px">
      <div style="font-size:9px;color:${isSel?'var(--gold)':'var(--txt3)'};font-weight:${isSel?'700':'400'}">$${v>999?(v/1000).toFixed(1)+'k':Math.round(v)}</div>
      <div style="width:100%;background:${isSel?'var(--gold)':'var(--sage)'};border-radius:3px 3px 0 0;height:${Math.max(h,2)}px;opacity:${isSel?1:.75};transition:height .3s"></div>
      <div style="font-size:9px;color:${isSel?'var(--gold)':'var(--txt3)'}">${months12[i].label}</div>
    </div>`;
  }).join('');

  // Owner payouts
  const ownerEl = document.getElementById('earn-owner-payouts');
  if(ownerEl) {
    if(!owners.length) {
      ownerEl.innerHTML = '<div style="font-size:13px;color:var(--txt3)">No owners linked — add owners in Owner Management to track payouts.</div>';
    } else {
      ownerEl.innerHTML = owners.map(o => {
        const oBk  = monthBk.filter(b=>(o.propIds||[]).includes(b.propId));
        const oGross = oBk.reduce((s,b)=>s+(b.price||0),0);
        const oComm  = o.commission||20;
        const ownerPayout = Math.round(oGross * (1 - oComm/100));
        const myEarn = Math.round(oGross * oComm/100);
        if(!oGross) return `
          <div style="display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid var(--border);opacity:.5">
            <div style="width:36px;height:36px;border-radius:50%;background:var(--sand);display:flex;align-items:center;justify-content:center;font-size:15px;font-weight:700;color:var(--txt2)">${o.name[0]}</div>
            <div style="flex:1"><div style="font-size:13px;font-weight:600;color:var(--txt)">${o.name}</div><div style="font-size:11px;color:var(--txt3)">No bookings this month</div></div>
            <span class="pill pill-amber">$0 owed</span>
          </div>`;
        return `
          <div style="display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid var(--border)">
            <div style="width:36px;height:36px;border-radius:50%;background:var(--terra);color:#fff;display:flex;align-items:center;justify-content:center;font-size:15px;font-weight:700;flex-shrink:0">${o.name[0]}</div>
            <div style="flex:1">
              <div style="font-size:13px;font-weight:600;color:var(--txt)">${o.name}</div>
              <div style="font-size:11px;color:var(--txt3)">Gross $${oGross.toLocaleString()} · Your ${oComm}% = $${myEarn.toLocaleString()}</div>
            </div>
            <div style="text-align:right">
              <div style="font-size:13px;font-weight:700;color:var(--terra)">$${ownerPayout.toLocaleString()}</div>
              <div style="font-size:10px;color:var(--txt3)">owed to owner</div>
            </div>
            <span class="pill ${ownerPayout>0?'pill-amber':'pill-green'}">${ownerPayout>0?'Pending':'Settled'}</span>
          </div>`;
      }).join('');
    }
  }

  // Expense deductions
  const expEl = document.getElementById('earn-expenses');
  const monthExpItems = expenses.filter(e=>(e.date||'').startsWith(selectedMonth));
  if(expEl) {
    if(!monthExpItems.length) {
      expEl.innerHTML = '<div style="font-size:13px;color:var(--txt3)">No expenses recorded for this month.</div>';
    } else {
      const catLabels = {cleaning:'Cleaning',supplies:'Supplies',repair:'Repairs',utilities:'Utilities',mortgage:'Mortgage',insurance:'Insurance',taxes:'Taxes',software:'Software',marketing:'Marketing',other:'Other'};
      expEl.innerHTML = `
        <div style="display:flex;justify-content:space-between;margin-bottom:12px;font-size:13px">
          <span style="color:var(--txt2)">Total deductions</span>
          <span style="font-weight:700;color:var(--terra)">-$${monthExp.toLocaleString()}</span>
        </div>` +
        monthExpItems.slice(0,8).map(e=>`
          <div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--border2);font-size:12px">
            <span style="color:var(--txt2)">${e.desc||catLabels[e.cat||e.category]||'Expense'} <span style="color:var(--txt3);font-size:10px">${e.propName?'· '+e.propName:''}</span></span>
            <span style="color:var(--terra);font-weight:600">-$${(e.amount||0).toLocaleString()}</span>
          </div>`).join('') +
        (monthExpItems.length>8?`<div style="font-size:11px;color:var(--txt3);margin-top:8px">+${monthExpItems.length-8} more — view in Expenses tab</div>`:'');
    }
  }
}

function exportEarningsCSV() {
  const sel = document.getElementById('earn-month-sel');
  const mo = sel?.value || new Date().toISOString().slice(0,7);
  const bookings = (cData.bookings||[]).filter(b=>b.status!=='cancelled'&&b.checkin&&b.checkin.startsWith(mo));
  const owners = cData.owners||[];
  let csv = 'Property,Owner,Bookings,Gross Revenue,Commission %,Your Earnings,Owner Payout\n';
  (cData.properties||[]).forEach(p=>{
    const pBk    = bookings.filter(b=>b.propId===p.id);
    const pGross = pBk.reduce((s,b)=>s+(b.price||0),0);
    const owner  = owners.find(o=>(o.propIds||[]).includes(p.id));
    const comm   = owner?(owner.commission||20):20;
    const pEarn  = Math.round(pGross*comm/100);
    const pOwner = pGross-pEarn;
    csv += `"${p.name}","${owner?owner.name:'Unlinked'}",${pBk.length},${pGross},${comm}%,${pEarn},${pOwner}\n`;
  });
  const blob = new Blob([csv],{type:'text/csv'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'CSO-Earnings-'+mo+'.csv';
  a.click();
  toast('Earnings exported ✓');
}

function toggleSetting(el){el.classList.toggle('on');el.classList.toggle('off');toast(el.classList.contains('on')?'Enabled':'Disabled');}
function clearAll(){cData={properties:[],bookings:[],messages:[],tasks:[],reviews:[],icals:[],plan:cData.plan,apiKey:cData.apiKey,darkMode:cData.darkMode,onboarded:true,readSmartNids:[]};saveUserData(cUid,cData);renderAll();toast('All data cleared');}

// ════════════════════════════════════════════
//  BADGES / MODALS / TOAST / STRIPE
// ════════════════════════════════════════════
function updateBadges(){
  const pending=cData.bookings.filter(b=>b.status==='pending').length;const unread=cData.messages.filter(m=>m.unread).length;
  const bb=document.getElementById('sb-b-badge');const mb=document.getElementById('sb-m-badge');
  if(bb){bb.textContent=pending;bb.style.display=pending?'':'none';}if(mb){mb.textContent=unread;mb.style.display=unread?'':'none';}
}
function openModal(id){
  // Close any existing modals first to prevent double overlay
  const existingModals = document.querySelectorAll('.modal-bg.open, .modal-overlay.open');
  existingModals.forEach(modal => modal.classList.remove('open'));
  
  const drops=[{sel:'mb-prop',ph:'<option value="">Select property…</option>'},{sel:'mm-prop',ph:'<option value="">None</option>'},{sel:'mt-prop',ph:'<option value="">None</option>'},{sel:'mr-prop',ph:'<option value="">None</option>'},{sel:'ic-prop',ph:'<option value="">None</option>'},{sel:'exp-prop',ph:'<option value="">All Properties</option>'},{sel:'sea-prop',ph:'<option value="">All Properties</option>'},{sel:'job-prop',ph:'<option value="">Select property…</option>'},{sel:'wo-prop',ph:'<option value="">Select property…</option>'},{sel:'inv-prop',ph:'<option value="">All Properties</option>'},{sel:'ups-prop-filter',ph:'<option value="">All Properties</option>'},{sel:'ci-prop',ph:'<option value="">All Properties</option>'},{sel:'ri-prop',ph:'<option value="">All Properties</option>'},{sel:'vault-prop',ph:'<option value="">All Properties</option>'}];
  drops.forEach(({sel,ph})=>{const el=document.getElementById(sel);if(el)el.innerHTML=ph+cData.properties.map(p=>`<option value="${p.id}">${p.emoji} ${p.name}</option>`).join('');});
  const bookingDrop=document.getElementById('mm-booking');
  if(bookingDrop){bookingDrop.innerHTML='<option value="">No booking</option>'+cData.bookings.filter(b=>b.status!=='cancelled').map(b=>`<option value="${b.id}">${b.guestName} · ${b.propName} · ${b.checkin||'TBD'}</option>`).join('');}
  const claimDrop=document.getElementById('claim-booking');
  if(claimDrop){claimDrop.innerHTML='<option value="">Select booking…</option>'+cData.bookings.map(b=>`<option value="${b.id}">${b.guestName} · ${b.propName} · ${b.checkin||'TBD'}</option>`).join('');}
  const ciReqDrop=document.getElementById('ci-req-booking');
  if(ciReqDrop){ciReqDrop.innerHTML='<option value="">Select booking…</option>'+cData.bookings.map(b=>`<option value="${b.id}">${b.guestName} · ${b.propName}</option>`).join('');}
  const rbBooking=document.getElementById('rb-booking');
  if(rbBooking){rbBooking.innerHTML='<option value="">Select booking…</option>'+cData.bookings.map(b=>`<option value="${b.id}">${b.guestName} · ${b.propName}</option>`).join('');}
  const rbItem=document.getElementById('rb-item');
  if(rbItem){rbItem.innerHTML='<option value="">Select item…</option>'+(cData.rentalItems||[]).map(i=>`<option value="${i.id}">${i.emoji} ${i.name} — $${i.rate}/day</option>`).join('');}
  if(id==='add-expense-modal'){const dateEl=document.getElementById('exp-date');if(dateEl&&!dateEl.value)dateEl.value=new Date().toISOString().slice(0,10);}
  if(id==='hire-cleaner-modal'){const sel=document.getElementById('job-cleaner');if(sel)sel.innerHTML='<option value="">Any available cleaner</option>'+(cData.cleaners||[]).map(c=>`<option value="${c.id}">${c.name} — $${c.rate}/hr</option>`).join('');}
  if(id==='add-cleaner-modal'){const sel=document.getElementById('cl-props');if(sel&&!sel.options.length)(cData.properties||[]).forEach(p=>{const o=document.createElement('option');o.value=p.id;o.textContent=p.emoji+' '+p.name;sel.appendChild(o);});}
  if(id==='add-property-modal'){setTimeout(onPropTypeChange,50);} // reset mid-term fields visibility
  document.getElementById(id).classList.add('open');
}
function closeModal(id){document.getElementById(id).classList.remove('open');}
document.addEventListener('click',e=>{if(e.target.classList.contains('modal-bg'))e.target.classList.remove('open');});
function hhEnhanceClickableAria(root){
  const scope=(root&&root.querySelectorAll)?root:document;
  if(!scope||!scope.querySelectorAll)return;
  scope.querySelectorAll('div[onclick], span[onclick]').forEach(function(node){
    if(node.hasAttribute('aria-label'))return;
    if(node.getAttribute('aria-hidden')==='true')return;
    var tAttr=node.getAttribute('title');
    if(tAttr){node.setAttribute('aria-label',tAttr);return;}
    var oc=node.getAttribute('onclick')||'';
    var label='';
    var m=oc.match(/nav\(\s*['"]([^'"]+)['"]/);
    if(m)label='Go to '+m[1].replace(/_/g,' ');
    else if((m=oc.match(/openModal\(\s*['"]([^'"]+)['"]/)))label='Open dialog: '+m[1].replace(/-/g,' ');
    else if(/openPropertyDetail\(\s*['"][^'"]+['"]/.test(oc))label='Open property details';
    else if(/openSidebar\s*\(/.test(oc))label='Open navigation menu';
    else if(/closeSidebar\s*\(/.test(oc))label='Close navigation menu';
    else if(/openNotifPanel\s*\(/.test(oc))label='Open notifications';
    else if(/closeNotifPanel\s*\(/.test(oc))label='Close notifications';
    else if(/openSearch\s*\(/.test(oc))label='Open search';
    else if(/toggleTask\s*\(/.test(oc))label='Toggle task completed';
    else if(/closeModal\(\s*['"]([^'"]+)['"]/.test(oc))label='Close dialog';
    if(!label){
      var tx=(node.textContent||'').replace(/\s+/g,' ').trim();
      if(tx.length&&tx.length<=120)label=tx;
    }
    if(!label)label='Activate';
    node.setAttribute('aria-label',label);
  });
}
function toast(msg){const el=document.getElementById('toast-el');el.textContent=msg;el.classList.add('show');clearTimeout(el._t);el._t=setTimeout(()=>el.classList.remove('show'),2800);}
function openSearch() {
  document.getElementById('search-modal').classList.add('open');
  setTimeout(()=>document.getElementById('search-input')?.focus(), 100);
}

function runSearch(q) {
  const results = document.getElementById('search-results');
  if(!results) return;
  const query = q.toLowerCase().trim();
  if(!query) { results.innerHTML='<div style="text-align:center;padding:24px;color:var(--txt3);font-size:13px">Start typing to search…</div>'; return; }

  const items = [];

  // Search bookings
  cData.bookings.filter(b=>
    b.guestName?.toLowerCase().includes(query) ||
    b.propName?.toLowerCase().includes(query) ||
    b.guestEmail?.toLowerCase().includes(query)
  ).forEach(b=>{
    items.push({
      icon: b.propEmoji||'📅',
      title: b.guestName,
      sub: b.propName + ' · ' + (b.checkin||'TBD') + ' → ' + (b.checkout||'TBD'),
      badge: b.status,
      action: `closeModal('search-modal');nav('bookings',document.querySelector('[onclick*=bookings]'))`
    });
  });

  // Search properties
  cData.properties.filter(p=>
    p.name?.toLowerCase().includes(query) ||
    p.location?.toLowerCase().includes(query)
  ).forEach(p=>{
    items.push({
      icon: p.emoji||'🏠',
      title: p.name,
      sub: p.location||'No location',
      badge: '$'+p.rate+'/night',
      action: `closeModal('search-modal');openPropertyDetail('${p.id}')`
    });
  });

  // Search messages
  cData.messages.filter(m=>
    m.guestName?.toLowerCase().includes(query) ||
    m.propName?.toLowerCase().includes(query)
  ).forEach(m=>{
    items.push({
      icon: '💬',
      title: m.guestName,
      sub: m.propName||'No property',
      badge: m.unread?'unread':'',
      action: `closeModal('search-modal');nav('messages',document.querySelector('[onclick*=messages]'));setTimeout(()=>openConv('${m.id}'),100)`
    });
  });

  if(!items.length) {
    results.innerHTML='<div style="text-align:center;padding:24px;color:var(--txt3);font-size:13px">No results for "'+q+'"</div>';
    return;
  }

  results.innerHTML = items.map(item=>`
    <div onclick="${item.action}" style="display:flex;align-items:center;gap:12px;padding:10px 12px;border-radius:8px;cursor:pointer;transition:background .15s" onmouseover="this.style.background='var(--sand)'" onmouseout="this.style.background=''">
      <div style="font-size:20px;flex-shrink:0">${item.icon}</div>
      <div style="flex:1;min-width:0">
        <div style="font-size:13px;font-weight:600;color:var(--txt)">${item.title}</div>
        <div style="font-size:11px;color:var(--txt3)">${item.sub}</div>
      </div>
      ${item.badge?`<span class="pill pill-amber" style="font-size:10px">${item.badge}</span>`:''}
    </div>`).join('');
  hhEnhanceClickableAria(results);
}

// Keyboard shortcut for search
document.addEventListener('keydown', e=>{
  if(e.key==='Enter'){
    const ls=document.getElementById('screen-login');
    const ae=document.activeElement;
    if(ls&&ls.style.display!=='none'&&ae&&(ae.id==='login-email'||ae.id==='login-pw')){e.preventDefault();doLogin();return;}
    const ss=document.getElementById('screen-signup');
    if(ss&&ss.style.display!=='none'&&ae&&ae.closest('#screen-signup')){e.preventDefault();doSignup();return;}
    const fs=document.getElementById('screen-forgot');
    if(fs&&fs.style.display!=='none'&&ae&&ae.closest('#screen-forgot')){e.preventDefault();doForgotPassword();return;}
  }
  if((e.metaKey||e.ctrlKey) && e.key==='k') { e.preventDefault(); openSearch(); }
  if(e.key==='Escape') { closeModal('search-modal'); }
});

// ════════════════════════════════════════════
//  NOTES
// ════════════════════════════════════════════
function addNote() {
  const input = document.getElementById('note-input');
  const text = input?.value?.trim();
  if(!text) return;
  if(!cData.notes) cData.notes = [];
  cData.notes.unshift({ id: 'n_'+Date.now(), text, created: Date.now() });
  saveUserData(cUid, cData);
  input.value = '';
  renderNotes();
}

function deleteNote(id) {
  cData.notes = (cData.notes||[]).filter(n=>n.id!==id);
  saveUserData(cUid, cData);
  renderNotes();
}

function renderNotes() {
  const list = document.getElementById('notes-list');
  if(!list) return;
  const notes = cData.notes||[];
  if(!notes.length) {
    list.innerHTML = '<div style="font-size:13px;color:var(--txt3);padding:4px 0">No notes yet — add reminders, to-dos, or anything you need to remember.</div>';
    return;
  }
  list.innerHTML = notes.map(n=>`
    <div style="display:flex;align-items:flex-start;gap:10px;background:var(--sand);border-radius:8px;padding:10px 12px">
      <div style="font-size:13px;color:var(--txt);flex:1;line-height:1.5">${n.text}</div>
      <div style="font-size:10px;color:var(--txt3);flex-shrink:0;margin-top:2px">${new Date(n.created).toLocaleDateString()}</div>
      <button onclick="deleteNote('${n.id}')" style="background:none;border:none;cursor:pointer;color:var(--txt3);font-size:14px;padding:0;flex-shrink:0;line-height:1" title="Delete">×</button>
    </div>`).join('');
}

function openStripe(plan){
  const monthly={
    pro:'https://buy.stripe.com/cNi8wO2EtdfT8wdbo44sE00',
    business:'https://buy.stripe.com/aFafZg2EtdfTcMt9fW4sE01',
    cohost_starter:'https://buy.stripe.com/28EaEW0wldfTbIp2Ry4sE09',
    cohost:'https://buy.stripe.com/cNi4gy1Apb7L3bTeAg4sE02'
  };
  const annual={
    pro:'https://buy.stripe.com/7sY8wO6UJ1xb5k1dwc4sE05',
    business:'https://buy.stripe.com/bJe7sKenb5Nr9Ah0Jq4sE06',
    cohost_starter:'https://buy.stripe.com/7sY14mfrffo1fYF2Ry4sE07',
    cohost:'https://buy.stripe.com/eVq28qgvjgs513Lbo44sE08'
  };
  const links = (typeof isAnnual !== 'undefined' && isAnnual) ? annual : monthly;
  if(links[plan]) window.open(links[plan],'_blank');
  else toast('Contact us: csopropertyservice@gmail.com');
}

// ════════════════════════════════════════════
//  DEMO DATA
// ════════════════════════════════════════════
function buildDemoData(){
  const now=Date.now();
  const d0=dt=>new Date(now+86400000*dt).toISOString().slice(0,10);
  const d1=dt=>new Date(now-86400000*dt).toISOString().slice(0,10);
  return{
  plan:'cohost',
  apiKey:'',darkMode:false,onboarded:true,softwareMode:false,

  icals:[{id:'ic1',name:'Airbnb — Sunset Loft',url:'https://www.airbnb.com/calendar/ical/demo.ics',propId:'p1',propName:'Sunset Loft',source:'airbnb',lastSync:new Date().toLocaleString(),status:'synced',created:now}],

  properties:[
    {id:'p1',name:'Sunset Loft',emoji:'🏡',propType:'str',location:'Downtown, Dallas TX',description:'A sun-drenched loft in the heart of Deep Ellum.',rate:114,monthlyRate:0,minStay:1,maxGuests:4,wifi:'SunsetLoft_5G',wifiPw:'welcome2024',doorCode:'#4821',parking:'Spot B3',occupancy:82,rating:'4.92',gradient:'pi1',hibernated:false,created:now-86400000*30},
    {id:'p2',name:'Garden Suite',emoji:'🌿',propType:'adu',location:'Oak Cliff, Dallas TX',description:'A serene garden retreat perfect for couples.',rate:98,monthlyRate:0,minStay:1,maxGuests:2,wifi:'GardenSuite',wifiPw:'greenleaf',doorCode:'#7733',parking:'Street parking',occupancy:74,rating:'4.88',gradient:'pi2',hibernated:false,created:now-86400000*20},
    {id:'p3',name:'Beach House',emoji:'🌊',propType:'cabin',location:'South Padre Island TX',description:'Beachfront paradise with stunning gulf views.',rate:210,monthlyRate:0,minStay:2,maxGuests:6,wifi:'BeachHouse_5G',wifiPw:'oceanview',doorCode:'#9915',parking:'Lot B, 2 spots',occupancy:91,rating:'4.95',gradient:'pi3',hibernated:false,created:now-86400000*10},
    {id:'p4',name:'Corporate Retreat',emoji:'💼',propType:'midterm',location:'Uptown, Dallas TX',description:'Fully furnished corporate suite. 30-day minimum.',rate:150,monthlyRate:2800,minStay:30,longStayDisc:10,maxGuests:2,wifi:'Corp_Suite_5G',wifiPw:'biz2024',doorCode:'#3310',parking:'Covered garage',occupancy:68,rating:'4.90',gradient:'pi4',hibernated:false,created:now-86400000*5}
  ],

  bookings:[
    {id:'b1',propId:'p1',propName:'Sunset Loft',propEmoji:'🏡',propGradient:'pi1',guestName:'Marcus Kim',guestEmail:'marcus@email.com',numGuests:2,checkin:d0(5),checkout:d0(8),nights:3,price:342,status:'confirmed',source:'airbnb',leadType:'turno_platform',created:now-86400000*5},
    {id:'b2',propId:'p2',propName:'Garden Suite',propEmoji:'🌿',propGradient:'pi2',guestName:'Amara Lopez',guestEmail:'amara@email.com',numGuests:1,checkin:d0(9),checkout:d0(14),nights:5,price:567,status:'confirmed',source:'vrbo',leadType:'direct_inquiry',created:now-86400000*3},
    {id:'b3',propId:'p3',propName:'Beach House',propEmoji:'🌊',propGradient:'pi3',guestName:'Tom Pearce',guestEmail:'tom@email.com',numGuests:4,checkin:d0(18),checkout:d0(25),nights:7,price:1240,status:'pending',source:'airbnb',leadType:'turno_platform',created:now-86400000*2},
    {id:'b4',propId:'p1',propName:'Sunset Loft',propEmoji:'🏡',propGradient:'pi1',guestName:'Diana Chen',guestEmail:'diana@email.com',numGuests:2,checkin:d1(55),checkout:d1(51),nights:4,price:456,status:'completed',source:'direct',leadType:'repeat_client',created:now-86400000*58},
    {id:'b5',propId:'p4',propName:'Corporate Retreat',propEmoji:'💼',propGradient:'pi4',guestName:'Deloitte Consulting',guestEmail:'travel@deloitte.com',numGuests:1,checkin:d1(10),checkout:d0(20),nights:30,price:2800,status:'confirmed',source:'corporate',leadType:'residential_cleaning',created:now-86400000*12}
  ],

  messages:[
    {id:'m1',guestName:'Marcus Kim',propId:'p1',propName:'Sunset Loft',initials:'MK',avatarBg:'#F5E6D3',avatarColor:'#C4693A',unread:true,created:now-120000,messages:[{role:'guest',text:"Hi! Is early check-in around 1pm possible? We arrive early and would love to freshen up.",time:'10:02 AM'}]},
    {id:'m2',guestName:'Amara Lopez',propId:'p2',propName:'Garden Suite',initials:'AL',avatarBg:'#D3E8E0',avatarColor:'#4A7D50',unread:false,created:now-3600000,messages:[{role:'guest',text:"The place is absolutely stunning! The garden view is magical. Could you recommend local restaurants?",time:'9:15 AM'},{role:'host',text:"So glad you're loving it, Amara! Try The Local Bistro on 5th for brunch and Marta's for Italian. Enjoy! 🍽️",time:'9:30 AM'}]},
    {id:'m3',guestName:'Tom Pearce',propId:'p3',propName:'Beach House',initials:'TP',avatarBg:'#D3DCE8',avatarColor:'#2E4460',unread:true,created:now-10800000,messages:[{role:'guest',text:"Is parking for two cars included? We have a group of 4.",time:'7:45 AM'}]}
  ],

  tasks:[
    {id:'t1',title:'Deep clean — Sunset Loft',propId:'p1',propName:'Sunset Loft',assignee:'Maria G.',due:d1(1),priority:'high',done:true,created:now-86400000},
    {id:'t2',title:'Turnover — Garden Suite',propId:'p2',propName:'Garden Suite',assignee:'Jake T.',due:d0(2),priority:'high',done:false,created:now-86400000},
    {id:'t3',title:'Restock toiletries — Beach House',propId:'p3',propName:'Beach House',assignee:'',due:d0(4),priority:'medium',done:false,created:now-86400000}
  ],

  reviews:[
    {id:'r1',guestName:'Marcus Kim',propId:'p1',propName:'Sunset Loft',rating:5,content:"Incredible place! The host was responsive and the apartment was spotless. Will definitely be back.",initials:'MK',created:now-86400000*7},
    {id:'r2',guestName:'Diana Chen',propId:'p1',propName:'Sunset Loft',rating:5,content:"Absolute gem. The views are better than the photos. Loved every second.",initials:'DC',created:now-86400000*40}
  ],

  expenses:[
    {id:'e1',desc:'Turnover clean — Sunset Loft',amount:95,cat:'cleaning',propId:'p1',date:d1(3),receipt:null,created:now-300000},
    {id:'e2',desc:'Turnover clean — Garden Suite',amount:80,cat:'cleaning',propId:'p2',date:d1(2),receipt:null,created:now-200000},
    {id:'e3',desc:'Light bulb replacement',amount:24,cat:'repair',propId:'p3',date:d1(5),receipt:null,created:now-400000},
    {id:'e4',desc:'Supplies restock — Beach House',amount:67,cat:'supplies',propId:'p3',date:d1(1),receipt:null,created:now-100000},
    {id:'e5',desc:'Annual insurance — Sunset Loft',amount:1200,cat:'insurance',propId:'p1',date:d1(90),receipt:null,created:now-7776000000}
  ],

  cleaners:[
    {id:'cl_1',name:'Maria C.',rate:25,phone:'+1 555 0101',email:'maria@clean.com',rating:4.9,jobs:18,available:true,area:'Deep Ellum, Oak Cliff',skills:'STR turnover, deep clean',badges:['background_check','insured','turno_verified'],propIds:['p1','p2'],created:now-1000000},
    {id:'cl_2',name:'Jake M.',rate:28,phone:'+1 555 0202',email:'jake@clean.com',rating:4.7,jobs:12,available:true,area:'South Dallas, Uptown',skills:'Deep clean, residential',badges:['background_check','own_supplies','reliable'],propIds:['p3'],created:now-900000}
  ],

  jobs:[
    {id:'j1',propId:'p1',propName:'Sunset Loft',date:d0(3),time:'11:00',type:'turnover',cleanerId:'cl_1',cleanerName:'Maria C.',pay:150,feePct:5,platformFee:7.50,cleanerPay:142.50,status:'assigned',approvalStatus:'pending',approvalToken:'apv_demo1',autoApproveAt:now+172800000,created:now-86400000},
    {id:'j2',propId:'p2',propName:'Garden Suite',date:d0(1),time:'10:00',type:'turnover',cleanerId:'cl_1',cleanerName:'Maria C.',pay:120,feePct:5,platformFee:6,cleanerPay:114,status:'completed',approvalStatus:'verified',completedAt:d1(1),qualityScore:5,created:now-86400000*2},
    {id:'j3',propId:'p3',propName:'Beach House',date:d0(7),time:'12:00',type:'deep',cleanerId:'cl_2',cleanerName:'Jake M.',pay:200,feePct:5,platformFee:10,cleanerPay:190,status:'open',created:now-86400000*3}
  ],

  payouts:[
    {id:'pay_1',jobId:'j2',cleanerName:'Maria C.',charged:120,owed:114,net:6,margin:5,platformFee:6,status:'verified',approvalStatus:'verified',date:d1(1),notes:'Turnover clean — Garden Suite',created:now-200000},
    {id:'pay_2',cleanerName:'Maria C.',charged:150,owed:95,net:55,margin:37,status:'paid',date:d1(7),notes:'Turnover clean — Sunset Loft (prev)',paidAt:d1(5),created:now-700000},
    {id:'pay_3',cleanerName:'Jake M.',charged:200,owed:130,net:70,margin:35,status:'paid',date:d1(14),notes:'Deep clean — Beach House',paidAt:d1(12),created:now-1400000}
  ],

  owners:[
    {id:'own_1',name:'James & Rita Holloway',email:'jrholloway@gmail.com',phone:'+1 555 0301',commission:20,propIds:['p1'],payment:'Zelle @jrholloway',notes:'Send report by 5th of month',created:now-8000000},
    {id:'own_2',name:'Sandra Chen',email:'schen.props@gmail.com',phone:'+1 555 0402',commission:22,propIds:['p2'],payment:'ACH — Chase checking',notes:'Prefers detailed expense breakdown',created:now-6000000}
  ],

  vaultPhotos:[
    {id:'vp_1',propId:'p1',propName:'Sunset Loft',propEmoji:'🏡',type:'after_clean',cleaner:'Maria C.',notes:'All rooms spotless, linens replaced, bathrooms fully stocked',dataUrl:null,date:d0(0),created:now-50000},
    {id:'vp_2',propId:'p2',propName:'Garden Suite',propEmoji:'🌿',type:'after_clean',cleaner:'Jake M.',notes:'Kitchen clean, fresh towels, welcome basket set',dataUrl:null,date:d1(2),created:now-200000}
  ],

  sentReports:[
    {id:'sr_1',propId:'p1',propName:'Sunset Loft',period:new Date(now).toISOString().slice(0,7),method:'emailed',email:'jrholloway@gmail.com',sentAt:new Date(now-86400000*5).toISOString()},
    {id:'sr_2',propId:'p2',propName:'Garden Suite',period:new Date(now).toISOString().slice(0,7),method:'downloaded',email:'',sentAt:new Date(now-86400000*3).toISOString()}
  ],

  guestCRM:[
    {id:'cg_1',name:'Marcus Kim',email:'marcus.kim@email.com',phone:'+1 555 0191',city:'Austin, TX',stays:4,spent:1850,notes:'Loves coffee, very tidy',tags:'vip, repeat',created:now-5000000},
    {id:'cg_2',name:'Amara Lopez',email:'amara.l@gmail.com',phone:'+1 555 0234',city:'Miami, FL',stays:2,spent:920,notes:'Travels with partner',tags:'repeat',created:now-3000000},
    {id:'cg_3',name:'Tom Pearce',email:'tom.p@outlook.com',phone:'',city:'Chicago, IL',stays:1,spent:450,notes:'',tags:'',created:now-1000000}
  ],

  loyaltyMembers:[
    {id:'lm_1',name:'Marcus Kim',email:'marcus.kim@email.com',stays:4,spent:1850,notes:'VIP guest',tier:'Gold',created:now-5000000},
    {id:'lm_2',name:'Diana Chen',email:'diana@email.com',stays:2,spent:912,notes:'',tier:'Silver',created:now-3000000}
  ],

  inventory:[
    {id:'inv_1',name:'Coffee pods',cat:'amenities',qty:4,threshold:6,unit:'pods',propId:'p1',propName:'Sunset Loft',created:now},
    {id:'inv_2',name:'Toilet paper',cat:'toiletries',qty:8,threshold:4,unit:'rolls',propId:'p2',propName:'Garden Suite',created:now},
    {id:'inv_3',name:'Shampoo',cat:'toiletries',qty:2,threshold:3,unit:'bottles',propId:'p3',propName:'Beach House',created:now}
  ],

  workorders:[
    {id:'wo_1',title:'HVAC filter replacement',propId:'p1',propName:'Sunset Loft',cat:'maintenance',priority:'medium',costEst:120,costActual:0,desc:'Filter needs replacing — 6 month interval',assignedTo:'',status:'open',created:now-86400000*2},
    {id:'wo_2',title:'Bathroom caulk repair',propId:'p3',propName:'Beach House',cat:'repair',priority:'high',costEst:200,costActual:185,desc:'Re-caulk tub and shower. Saltwater exposure.',assignedTo:'Jake M.',status:'completed',created:now-86400000*10}
  ],

  templates:[
    {id:'tpl_1',name:'Welcome Message',trigger:'booking_confirmed',text:"Hi {guest_name}! 🎉 You're confirmed at {property_name} from {checkin_date} to {checkout_date}. I'll send check-in details 48hrs before arrival. Questions? Just ask!",created:now-500000},
    {id:'tpl_2',name:'Check-in Instructions',trigger:'day_of_checkin',text:"Today's the day! 🏡 {property_name} is ready for you. Door code: {door_code}. WiFi: {wifi_name} / {wifi_password}. Check-in after 3pm. Can't wait to host you!",created:now-400000}
  ],

  contentHub:[
    {id:'ch_1',title:'Sunset Loft — Instagram Caption Pack',category:'AI Scripts',content:'✨ Waking up above the city has a different feel. 3 nights left this month — link in bio to book.',saved:d1(3),created:now-300000},
    {id:'ch_2',title:'Beach House — Listing Description',category:'Marketing Copy',content:'Step off the deck and onto the sand. The Beach House at South Padre Island is your Gulf Coast escape — fully equipped kitchen, outdoor shower, and gulf views from every room.',saved:d1(1),created:now-100000}
  ],

  affiliates:[
    {id:'aff_1',name:'Sarah T.',email:'sarah@strcoach.com',code:'SARAH20',commission:20,referrals:3,earned:237,status:'active',created:now-2000000},
    {id:'aff_2',name:'Mike B.',email:'mike@dallashost.com',code:'MIKEB15',commission:15,referrals:1,earned:79,status:'active',created:now-1000000}
  ],

  seasons:[
    {id:'sea_1',name:'Summer Peak',start:'2026-06-01',end:'2026-08-31',adj:'+35',type:'percent',propIds:['p3'],created:now-500000},
    {id:'sea_2',name:'Holiday Week',start:'2026-12-20',end:'2026-12-31',adj:'+50',type:'percent',propIds:['p1','p2','p3'],created:now-400000}
  ],

  aiHours:{enabled:true,start:'22:00',end:'08:00',message:'Hi! I received your message and will respond during office hours (8am-10pm). 🏡',escalate:'emergency,flood,fire,locked out,broken,urgent',autoCount:12,escalateCount:1},
  invChecklist:['Coffee pods (6+)','Toilet paper (4+ rolls)','Paper towels (2+ rolls)','Hand soap','Dish soap','Shampoo & conditioner','Body wash','Bath towels (2 per guest)','Kitchen sponge','Trash bags'],
  optimizerSettings:{weekend:25,peak:40,low:15,lastMin:10,longStay:15},
  reviewAuto:{enabled:true,template:'Hi {guest_name}! Thank you so much for staying at {property_name}! We loved having you. If you enjoyed your stay, it would mean the world to us if you could leave a review. Hope to host you again soon! 😊'},
  branding:{name:'CSO Property Services',tagline:'Managed by professionals',primary:'#C4693A',logo:'',active:false},
  feedback:[]
};}


// ═══════════════════════════════════════════
//  AUTOMATIONS
// ═══════════════════════════════════════════

function renderAutomations() {
  const auto = cData.automations||{};
  // Render toggles
  const toggles = {
    'auto-messages-toggle': auto.autoMessages?.enabled,
    'auto-cleaning-toggle': auto.autoCleaning?.enabled,
    'auto-inventory-toggle': auto.autoInventory?.enabled,
    'auto-latecheckout-toggle': auto.autoLateCheckout?.enabled,
    'auto-anniversary-toggle': auto.autoAnniversary?.enabled,
    'auto-weekly-toggle': auto.autoWeekly?.enabled,
    'auto-damage-toggle': auto.autoDamage?.enabled,
    'auto-occupancy-toggle': auto.autoOccupancy?.enabled,
  };
  Object.entries(toggles).forEach(([id, val]) => {
    const el = document.getElementById(id);
    if(el) el.className = 'toggle '+(val?'on':'off');
  });
  // Fill in saved values
  const s = auto.autoMessages||{};
  ['booking','prearrival','checkin','midstay','checkout','review'].forEach(function(seq) {
    const tog = document.getElementById('msg-'+seq+'-toggle');
    if(tog) tog.className='toggle toggle-sm '+(s[seq]?.enabled?'on':'off');
    const txt = document.getElementById('msg-'+seq+'-text');
    if(txt&&s[seq]?.text) txt.value=s[seq].text;
  });
  // Fill cleaner dropdown
  const sel = document.getElementById('auto-clean-assignee');
  if(sel) {
    const staff = cData.staff||[];
    const cleaners = cData.cleaners||[];
    const all = [...staff.map(s=>s.name), ...cleaners.map(c=>c.name)];
    const saved = auto.autoCleaning?.assignee||'';
    sel.innerHTML='<option value="">— Select default cleaner —</option>'+
      all.map(n=>`<option value="${n}" ${n===saved?'selected':''}>${n}</option>`).join('');
  }
  // Fill other saved values
  const ac = auto.autoCleaning||{};
  if(document.getElementById('auto-clean-title')) document.getElementById('auto-clean-title').value=ac.title||'';
  if(document.getElementById('auto-clean-timing')) document.getElementById('auto-clean-timing').value=ac.timing||'on_checkout';
  if(document.getElementById('auto-clean-priority')) document.getElementById('auto-clean-priority').value=ac.priority||'high';
  const ai = auto.autoInventory||{};
  if(document.getElementById('auto-inv-email')) document.getElementById('auto-inv-email').value=ai.email||cData.email||'';
  if(document.getElementById('auto-inv-freq')) document.getElementById('auto-inv-freq').value=ai.freq||'daily';
  const lc = auto.autoLateCheckout||{};
  if(document.getElementById('auto-checkout-time')) document.getElementById('auto-checkout-time').value=lc.time||'11:00';
  if(document.getElementById('auto-checkout-grace')) document.getElementById('auto-checkout-grace').value=lc.grace||30;
  if(document.getElementById('auto-checkout-msg')) document.getElementById('auto-checkout-msg').value=lc.msg||'';
  if(document.getElementById('auto-checkout-email')) document.getElementById('auto-checkout-email').value=lc.email||'';
  const an = auto.autoAnniversary||{};
  if(document.getElementById('auto-anniv-discount')) document.getElementById('auto-anniv-discount').value=an.discount||10;
  if(document.getElementById('auto-anniv-msg')) document.getElementById('auto-anniv-msg').value=an.msg||'';
  const loyaltyCount = (cData.loyaltyMembers||[]).length;
  const countEl = document.getElementById('anniv-members-count');
  if(countEl) countEl.textContent = loyaltyCount+' loyalty member'+(loyaltyCount!==1?'s':'')+' enrolled';
  const aw = auto.autoWeekly||{};
  if(document.getElementById('auto-weekly-email')) document.getElementById('auto-weekly-email').value=aw.email||cData.email||'';
  if(document.getElementById('auto-weekly-day')) document.getElementById('auto-weekly-day').value=aw.day||'monday';
  const ad = auto.autoDamage||{};
  if(document.getElementById('auto-damage-days')) document.getElementById('auto-damage-days').value=ad.days||7;
  if(document.getElementById('auto-damage-email')) document.getElementById('auto-damage-email').value=ad.email||'';
  checkDamageClaimsNow(true);
  const ao = auto.autoOccupancy||{};
  if(document.getElementById('auto-occ-days')) document.getElementById('auto-occ-days').value=ao.days||14;
  if(document.getElementById('auto-occ-email')) document.getElementById('auto-occ-email').value=ao.email||'';
  checkOccupancyNow(true);
  renderAutoLog();
}

function toggleAutomation(key, el) {
  if(!cData.automations) cData.automations={};
  if(!cData.automations[key]) cData.automations[key]={};
  const on = !cData.automations[key].enabled;
  cData.automations[key].enabled = on;
  el.className = 'toggle '+(on?'on':'off');
  saveUserData(cUid,cData);
  logAuto(key, on?'Enabled':'Disabled');
  toast((on?'✅ ':'⏸ ')+(on?'Automation on':'Automation off'));
}

function toggleMsgSeq(seq, el) {
  if(!cData.automations) cData.automations={};
  if(!cData.automations.autoMessages) cData.automations.autoMessages={};
  if(!cData.automations.autoMessages[seq]) cData.automations.autoMessages[seq]={};
  const on = !cData.automations.autoMessages[seq].enabled;
  cData.automations.autoMessages[seq].enabled = on;
  el.className = 'toggle toggle-sm '+(on?'on':'off');
  saveUserData(cUid,cData);
}

function saveMessageSequences() {
  if(!cData.automations) cData.automations={};
  if(!cData.automations.autoMessages) cData.automations.autoMessages={};
  const seqs = ['booking','prearrival','checkin','midstay','checkout','review'];
  seqs.forEach(function(seq) {
    const txt = document.getElementById('msg-'+seq+'-text');
    if(txt) {
      if(!cData.automations.autoMessages[seq]) cData.automations.autoMessages[seq]={enabled:false};
      cData.automations.autoMessages[seq].text = txt.value;
    }
  });
  saveUserData(cUid,cData);
  logAuto('autoMessages','Message sequences saved');
  toast('Message sequences saved ✓');
}

function previewMessageSequences() {
  const prop = (cData.properties||[])[0];
  const booking = (cData.bookings||[])[0];
  if(!prop||!booking){ toast('Add a property and booking first'); return; }
  const vars = {
    guest_name: booking.guestName||'Guest',
    property_name: prop.name||'Your Property',
    checkin_date: booking.checkin||'TBD',
    checkout_date: booking.checkout||'TBD',
    checkin_time: '3:00 PM',
    checkout_time: prop.checkoutTime||'11:00 AM',
    door_code: prop.doorCode||'[door code]',
    wifi_name: prop.wifi||'[WiFi name]',
    wifi_password: prop.wifiPw||'[WiFi password]',
    parking: prop.parking||'[parking info]',
    key_location: 'on the kitchen counter',
  };
  const seqs = ['booking','prearrival','checkin','midstay','checkout','review'];
  const labels = ['Booking Confirmation','Pre-Arrival (48hrs)','Check-in Day','Mid-Stay Check','Checkout Reminder','Review Request'];
  let preview = '<div style="font-size:13px">';
  seqs.forEach(function(seq, i) {
    const txtEl = document.getElementById('msg-'+seq+'-text');
    if(!txtEl||!txtEl.value) return;
    let msg = txtEl.value;
    Object.entries(vars).forEach(([k,v]) => { msg = msg.replace(new RegExp('{'+k+'}','g'), v); });
    preview += '<div style="margin-bottom:16px"><div style="font-weight:600;color:var(--txt);margin-bottom:4px">'+labels[i]+'</div>'+
      '<div style="background:var(--sand);border-radius:8px;padding:12px;font-size:12px;white-space:pre-wrap;color:var(--txt2)">'+msg+'</div></div>';
  });
  preview += '</div>';
  const modal = document.getElementById('legal-modal');
  if(modal) {
    document.getElementById('legal-title').textContent = '💬 Message Preview';
    document.getElementById('legal-content').innerHTML = preview;
    openModal('legal-modal');
  }
}

function runMessageSequencesNow() {
  const bookings = cData.bookings||[];
  if(!bookings.length){ toast('Add a booking first'); return; }
  let ran = 0;
  bookings.forEach(function(b) {
    if(b.status==='confirmed') { ran++; }
  });
  logAuto('autoMessages', 'Test run — would send to '+ran+' active booking'+(ran!==1?'s':''));
  toast('Test run complete — '+ran+' booking'+(ran!==1?'s':'')+' would receive messages');
}

function autoCreateCleaningTask(booking) {
  const auto = cData.automations?.autoCleaning;
  if(!auto?.enabled) return;
  if(!cData.tasks) cData.tasks=[];
  const prop = (cData.properties||[]).find(p=>p.id===booking.propId);
  const title = (auto.title||'Turnover clean — {property_name}')
    .replace('{property_name}', prop?.name||booking.propName||'Property');
  const existing = cData.tasks.find(t=>t.bookingId===booking.id&&t.autoCreated);
  if(existing) return;
  const task = {
    id:'t_auto_'+Date.now(),
    title,
    propId: booking.propId,
    propName: booking.propName||prop?.name||'',
    assignee: auto.assignee||'',
    due: booking.checkout||'',
    priority: auto.priority||'high',
    done: false,
    autoCreated: true,
    bookingId: booking.id,
    created: Date.now()
  };
  cData.tasks.push(task);
  saveUserData(cUid,cData);
  logAuto('autoCleaning','Task created: '+title+' for '+booking.checkout);
  toast('🧹 Cleaning task auto-created for '+booking.checkout);
}

function saveAutoClean() {
  if(!cData.automations) cData.automations={};
  cData.automations.autoCleaning = {
    enabled: cData.automations.autoCleaning?.enabled||false,
    assignee: document.getElementById('auto-clean-assignee')?.value||'',
    title: document.getElementById('auto-clean-title')?.value||'Turnover clean — {property_name}',
    timing: document.getElementById('auto-clean-timing')?.value||'on_checkout',
    priority: document.getElementById('auto-clean-priority')?.value||'high',
  };
  saveUserData(cUid,cData);
  logAuto('autoCleaning','Settings saved');
  toast('Auto-cleaning settings saved ✓');
}

function checkInventoryNow(silent) {
  const items = cData.inventory||[];
  const low = items.filter(i=>(i.qty||0)<=(i.threshold||0));
  const statusEl = document.getElementById('auto-inv-status');
  if(statusEl) {
    if(!items.length) { statusEl.textContent='No inventory items tracked yet'; return; }
    if(!low.length) { statusEl.style.color='var(--sage)'; statusEl.textContent='✅ All items fully stocked'; }
    else { statusEl.style.color='var(--terra)'; statusEl.textContent='⚠️ '+low.length+' item'+(low.length!==1?'s':'')+' low: '+low.map(i=>i.name).join(', '); }
  }
  if(!silent&&low.length) {
    logAuto('autoInventory', 'Low stock alert: '+low.map(i=>i.name+' ('+i.qty+' left)').join(', '));
    toast('⚠️ '+low.length+' low stock item'+(low.length!==1?'s':''));
  }
}

function saveAutoInventory() {
  if(!cData.automations) cData.automations={};
  cData.automations.autoInventory = {
    enabled: cData.automations.autoInventory?.enabled||false,
    email: document.getElementById('auto-inv-email')?.value||'',
    freq: document.getElementById('auto-inv-freq')?.value||'daily',
  };
  saveUserData(cUid,cData);
  checkInventoryNow(false);
  toast('Inventory alert settings saved ✓');
}

function saveAutoLateCheckout() {
  if(!cData.automations) cData.automations={};
  cData.automations.autoLateCheckout = {
    enabled: cData.automations.autoLateCheckout?.enabled||false,
    time: document.getElementById('auto-checkout-time')?.value||'11:00',
    grace: parseInt(document.getElementById('auto-checkout-grace')?.value||30),
    msg: document.getElementById('auto-checkout-msg')?.value||'',
    email: document.getElementById('auto-checkout-email')?.value||'',
  };
  saveUserData(cUid,cData);
  logAuto('autoLateCheckout','Settings saved');
  toast('Late checkout settings saved ✓');
}

function checkLateCheckoutsNow() {
  const auto = cData.automations?.autoLateCheckout;
  if(!auto?.enabled) return;
  const today = new Date().toISOString().slice(0,10);
  const now = new Date();
  const [h,m] = (auto.time||'11:00').split(':').map(Number);
  const checkoutTime = new Date(); checkoutTime.setHours(h,m+parseInt(auto.grace||30),0);
  if(now < checkoutTime) return;
  const lateBookings = (cData.bookings||[]).filter(b=>b.checkout===today&&b.status==='confirmed');
  lateBookings.forEach(function(b) {
    logAuto('autoLateCheckout','Late checkout alert: '+b.guestName+' at '+b.propName);
    toast('🚪 Late checkout: '+b.guestName);
  });
}

function saveAutoAnniversary() {
  if(!cData.automations) cData.automations={};
  cData.automations.autoAnniversary = {
    enabled: cData.automations.autoAnniversary?.enabled||false,
    discount: parseInt(document.getElementById('auto-anniv-discount')?.value||10),
    timing: document.getElementById('auto-anniv-timing')?.value||'exact',
    msg: document.getElementById('auto-anniv-msg')?.value||'',
  };
  saveUserData(cUid,cData);
  logAuto('autoAnniversary','Settings saved');
  toast('Anniversary perk settings saved ✓');
}

function runAnniversaryNow() {
  const members = cData.loyaltyMembers||[];
  if(!members.length){ toast('No loyalty members yet'); return; }
  const today = new Date();
  let sent = 0;
  members.forEach(function(m) {
    if(!m.created) return;
    const joined = new Date(m.created);
    if(joined.getMonth()===today.getMonth()&&joined.getDate()===today.getDate()) {
      sent++;
      logAuto('autoAnniversary','Anniversary perk sent to '+m.name);
    }
  });
  if(!sent) toast('No anniversaries today — run manually works when dates match');
  else toast('🎂 Anniversary perks sent to '+sent+' member'+(sent!==1?'s':''));
}

function saveAutoWeekly() {
  if(!cData.automations) cData.automations={};
  cData.automations.autoWeekly = {
    enabled: cData.automations.autoWeekly?.enabled||false,
    email: document.getElementById('auto-weekly-email')?.value||'',
    day: document.getElementById('auto-weekly-day')?.value||'monday',
    include: {
      revenue: document.getElementById('wk-revenue')?.checked,
      checkins: document.getElementById('wk-checkins')?.checked,
      tasks: document.getElementById('wk-tasks')?.checked,
      occupancy: document.getElementById('wk-occupancy')?.checked,
      expenses: document.getElementById('wk-expenses')?.checked,
    }
  };
  saveUserData(cUid,cData);
  logAuto('autoWeekly','Settings saved');
  toast('Weekly summary settings saved ✓');
}

function sendWeeklySummaryNow() {
  const bookings = cData.bookings||[];
  const tasks = (cData.tasks||[]).filter(t=>!t.done);
  const expenses = cData.expenses||[];
  const rev = bookings.filter(b=>b.status!=='cancelled').reduce((s,b)=>s+(b.price||0),0);
  const exp = expenses.reduce((s,e)=>s+(e.amount||0),0);
  const today = new Date().toISOString().slice(0,10);
  const upcoming = bookings.filter(b=>b.checkin>=today&&b.status==='confirmed').slice(0,5);
  const summary = [
    '📊 Weekly CSO Property Services Summary',
    '━━━━━━━━━━━━━━━━━━━━━━',
    'Revenue (all time): $'+rev.toLocaleString(),
    'Expenses (all time): $'+exp.toLocaleString(),
    'Net Profit: $'+(rev-exp).toLocaleString(),
    '',
    '📅 Upcoming Check-ins ('+upcoming.length+'):',
    ...upcoming.map(b=>'  • '+b.guestName+' → '+b.propName+' on '+b.checkin),
    '',
    '✅ Pending Tasks: '+tasks.length,
    '🏠 Properties: '+(cData.properties||[]).length,
  ].join('\n');
  logAuto('autoWeekly', 'Summary generated: $'+rev.toLocaleString()+' revenue, '+upcoming.length+' upcoming check-ins');
  toast('📊 Summary ready — check Activity Log');
  const logEl = document.getElementById('auto-log');
  if(logEl) renderAutoLog();
}

function checkDamageClaimsNow(silent) {
  const claims = cData.damageClaims||[];
  const days = parseInt(document.getElementById('auto-damage-days')?.value||7);
  const cutoff = Date.now() - days*86400000;
  const stale = claims.filter(c=>c.status==='open'&&c.created<cutoff);
  const statusEl = document.getElementById('auto-damage-status');
  if(statusEl) {
    if(!stale.length) { statusEl.style.color='var(--sage)'; statusEl.textContent='✅ No stale claims'; }
    else { statusEl.style.color='var(--terra)'; statusEl.textContent='⚠️ '+stale.length+' claim'+(stale.length!==1?'s':'')+' open for '+days+'+ days'; }
  }
  if(!silent&&stale.length) {
    logAuto('autoDamage', stale.length+' stale damage claim'+(stale.length!==1?'s':'')+' need follow-up');
    toast('🛡️ '+stale.length+' damage claim'+(stale.length!==1?'s':'')+' need follow-up');
  }
}

function saveAutoDamage() {
  if(!cData.automations) cData.automations={};
  cData.automations.autoDamage = {
    enabled: cData.automations.autoDamage?.enabled||false,
    days: parseInt(document.getElementById('auto-damage-days')?.value||7),
    email: document.getElementById('auto-damage-email')?.value||'',
  };
  saveUserData(cUid,cData);
  checkDamageClaimsNow(false);
  toast('Damage claim settings saved ✓');
}

function checkOccupancyNow(silent) {
  const days = parseInt(document.getElementById('auto-occ-days')?.value||14);
  const props = cData.properties||[];
  const bookings = cData.bookings||[];
  const today = new Date().toISOString().slice(0,10);
  const future = new Date(); future.setDate(future.getDate()+days);
  const futureStr = future.toISOString().slice(0,10);
  const empty = props.filter(function(p) {
    return !bookings.some(b=>b.propId===p.id&&b.status!=='cancelled'&&b.checkin>=today&&b.checkin<=futureStr);
  });
  const statusEl = document.getElementById('auto-occ-status');
  if(statusEl) {
    if(!props.length) { statusEl.textContent=''; return; }
    if(!empty.length) { statusEl.style.color='var(--sage)'; statusEl.textContent='✅ All properties have bookings in the next '+days+' days'; }
    else { statusEl.style.color='var(--terra)'; statusEl.textContent='⚠️ '+empty.length+' propert'+(empty.length!==1?'ies':'y')+' with no bookings in '+days+' days: '+empty.map(p=>p.name).join(', '); }
  }
  if(!silent&&empty.length) {
    logAuto('autoOccupancy', empty.length+' propert'+(empty.length!==1?'ies':'y')+' with no bookings in '+days+' days');
    toast('📉 '+empty.length+' propert'+(empty.length!==1?'ies':'y')+' need bookings');
  }
}

function saveAutoOccupancy() {
  if(!cData.automations) cData.automations={};
  cData.automations.autoOccupancy = {
    enabled: cData.automations.autoOccupancy?.enabled||false,
    days: parseInt(document.getElementById('auto-occ-days')?.value||14),
    email: document.getElementById('auto-occ-email')?.value||'',
  };
  saveUserData(cUid,cData);
  checkOccupancyNow(false);
  toast('Occupancy alert settings saved ✓');
}

function logAuto(type, message) {
  if(!cData.autoLog) cData.autoLog=[];
  cData.autoLog.unshift({
    type, message,
    time: new Date().toLocaleString(),
    ts: Date.now()
  });
  if(cData.autoLog.length>50) cData.autoLog=cData.autoLog.slice(0,50);
  saveUserData(cUid,cData);
  renderAutoLog();
}

function renderAutoLog() {
  const logEl = document.getElementById('auto-log');
  if(!logEl) return;
  const logs = cData.autoLog||[];
  if(!logs.length) {
    logEl.innerHTML='<div class="empty-state"><div class="es-i">⚡</div><h3>No automations run yet</h3><p>Enable automations above to see activity here</p></div>';
    return;
  }
  const icons = {
    autoMessages:'💬',autoCleaning:'🧹',autoInventory:'📦',
    autoLateCheckout:'🚪',autoAnniversary:'🎂',autoWeekly:'📊',
    autoDamage:'🛡️',autoOccupancy:'📉'
  };
  logEl.innerHTML = logs.slice(0,20).map(function(l) {
    return '<div style="display:flex;align-items:flex-start;gap:10px;padding:8px 0;border-bottom:1px solid var(--border)">'+
      '<div style="font-size:18px;flex-shrink:0">'+(icons[l.type]||'⚡')+'</div>'+
      '<div style="flex:1">'+
        '<div style="font-size:13px;color:var(--txt)">'+l.message+'</div>'+
        '<div style="font-size:11px;color:var(--txt3)">'+l.time+'</div>'+
      '</div>'+
    '</div>';
  }).join('');
}

function clearAutoLog() {
  cData.autoLog=[];
  saveUserData(cUid,cData);
  renderAutoLog();
  toast('Activity log cleared');
}

// Run automation checks on app load
function runScheduledAutomations() {
  const auto = cData.automations||{};
  // Get active (non-hibernated) property IDs for automation scoping
  const activeProps = new Set((cData.properties||[]).filter(p=>!p.hibernated).map(p=>p.id));

  if(auto.autoMessages?.enabled) runMessageSequencesNow();
  if(auto.autoCleaning?.enabled) {
    (cData.bookings||[]).forEach(function(b) {
      if(b.status==='confirmed' && activeProps.has(b.propId)) autoCreateCleaningTask(b);
    });
  }
  if(auto.autoInventory?.enabled) checkInventoryNow(true);
  if(auto.autoLateCheckout?.enabled) checkLateCheckoutsNow();
  if(auto.autoOccupancy?.enabled) checkOccupancyNow(true);
  if(auto.autoDamage?.enabled) checkDamageClaimsNow(true);
  if(auto.autoAnniversary?.enabled) runAnniversaryNow();
}

// ═══════════════════════════════════════
//  P&L / FINANCIAL FUNCTIONS
// ═══════════════════════════════════════
function showFinTab(tab, btn) {
  ['expenses','pl','property','tax'].forEach(function(t) {
    const view = document.getElementById('fin-view-'+t);
    const tb = document.getElementById('fin-tab-'+t);
    if(view) view.style.display = t===tab ? '' : 'none';
    if(tb) { tb.className = t===tab ? 'btn btn-pri' : 'btn btn-ghost'; tb.style.fontSize='12px'; tb.style.padding='6px 14px'; }
  });
  if(tab==='pl') renderPL();
  if(tab==='property') renderPropertyPL();
  if(tab==='tax') renderTaxExport();
}

function renderPL() {
  const year = parseInt(document.getElementById('pl-year')?.value||new Date().getFullYear());
  const bookings = (cData.bookings||[]).filter(b=>b.status!=='cancelled'&&new Date(b.checkin||b.date||0).getFullYear()===year);
  const expenses = (cData.expenses||[]).filter(e=>new Date(e.date||0).getFullYear()===year);
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  
  const grossRev = bookings.reduce((s,b)=>s+(b.price||0),0);
  const totalExp = expenses.reduce((s,e)=>s+(e.amount||0),0);
  const netProfit = grossRev - totalExp;
  const margin = grossRev ? Math.round(netProfit/grossRev*100) : 0;
  
  const set=(id,v)=>{const el=document.getElementById(id);if(el)el.textContent=v;};
  set('pl-gross','$'+grossRev.toLocaleString());
  set('pl-expenses','$'+totalExp.toLocaleString());
  set('pl-net',(netProfit>=0?'+$':'-$')+Math.abs(netProfit).toLocaleString());
  set('pl-margin',margin+'%');
  
  const netEl=document.getElementById('pl-net');
  if(netEl) netEl.style.color=netProfit>=0?'var(--sage)':'var(--terra)';

  // Monthly breakdown table
  const monthly = months.map(function(m,i) {
    const mBookings = bookings.filter(b=>new Date(b.checkin||b.date||0).getMonth()===i);
    const mExpenses = expenses.filter(e=>new Date(e.date||0).getMonth()===i);
    const rev = mBookings.reduce((s,b)=>s+(b.price||0),0);
    const exp = mExpenses.reduce((s,e)=>s+(e.amount||0),0);
    const net = rev - exp;
    return {month:m, rev, exp, net};
  });

  const tableEl = document.getElementById('pl-monthly-table');
  if(tableEl) {
    const hasData = monthly.some(m=>m.rev>0||m.exp>0);
    if(!hasData) {
      tableEl.innerHTML='<div class="empty-state"><div class="es-i">📊</div><h3>No data for '+year+'</h3><p>Add bookings and expenses to see your P&L</p></div>';
    } else {
      tableEl.innerHTML='<table style="width:100%;border-collapse:collapse;font-size:12px">'+
        '<thead><tr style="border-bottom:2px solid var(--border)">'+
        '<th style="text-align:left;padding:8px 6px;color:var(--txt2)">Month</th>'+
        '<th style="text-align:right;padding:8px 6px;color:var(--sage)">Revenue</th>'+
        '<th style="text-align:right;padding:8px 6px;color:var(--terra)">Expenses</th>'+
        '<th style="text-align:right;padding:8px 6px;color:var(--txt)">Net Profit</th>'+
        '<th style="text-align:right;padding:8px 6px;color:var(--txt2)">Margin</th>'+
        '</tr></thead><tbody>'+
        monthly.map(function(m) {
          const margin2 = m.rev ? Math.round(m.net/m.rev*100) : 0;
          const color = m.net>=0?'var(--sage)':'var(--terra)';
          return '<tr style="border-bottom:1px solid var(--border)">'+
            '<td style="padding:8px 6px;font-weight:500;color:var(--txt)">'+m.month+'</td>'+
            '<td style="text-align:right;padding:8px 6px;color:var(--sage)">'+
              (m.rev>0?'$'+m.rev.toLocaleString():'—')+'</td>'+
            '<td style="text-align:right;padding:8px 6px;color:var(--terra)">'+
              (m.exp>0?'$'+m.exp.toLocaleString():'—')+'</td>'+
            '<td style="text-align:right;padding:8px 6px;font-weight:700;color:'+color+'">'+
              (m.rev>0||m.exp>0?(m.net>=0?'+$':'-$')+Math.abs(m.net).toLocaleString():'—')+'</td>'+
            '<td style="text-align:right;padding:8px 6px;color:var(--txt2)">'+
              (m.rev>0?margin2+'%':'—')+'</td>'+
          '</tr>';
        }).join('')+
        '<tr style="border-top:2px solid var(--border);font-weight:700">'+
          '<td style="padding:8px 6px;color:var(--txt)">TOTAL</td>'+
          '<td style="text-align:right;padding:8px 6px;color:var(--sage)">$'+grossRev.toLocaleString()+'</td>'+
          '<td style="text-align:right;padding:8px 6px;color:var(--terra)">$'+totalExp.toLocaleString()+'</td>'+
          '<td style="text-align:right;padding:8px 6px;color:'+(netProfit>=0?'var(--sage)':'var(--terra)')+'">'+
            (netProfit>=0?'+$':'-$')+Math.abs(netProfit).toLocaleString()+'</td>'+
          '<td style="text-align:right;padding:8px 6px;color:var(--txt2)">'+margin+'%</td>'+
        '</tr>'+
        '</tbody></table>';
    }
  }

  // Category breakdown
  const cats = {};
  const catLabels = {cleaning:'🧹 Cleaning',supplies:'🛒 Supplies',repair:'🔧 Repair',
    utilities:'💡 Utilities',mortgage:'🏠 Mortgage',insurance:'🛡 Insurance',
    taxes:'💰 Taxes',software:'💻 Software',marketing:'📣 Marketing',other:'📦 Other'};
  expenses.forEach(function(e) {
    const cat = e.category||e.cat||'other';
    cats[cat] = (cats[cat]||0) + (e.amount||0);
  });
  const catEl = document.getElementById('pl-category-breakdown');
  if(catEl) {
    if(!Object.keys(cats).length) {
      catEl.innerHTML='<div class="empty-state"><div class="es-i">🗂️</div><h3>No expenses yet</h3></div>';
    } else {
      const sorted = Object.entries(cats).sort((a,b)=>b[1]-a[1]);
      const maxVal = sorted[0][1];
      catEl.innerHTML = sorted.map(function([cat,amt]) {
        const pct = Math.round(amt/totalExp*100);
        const barW = Math.round(amt/maxVal*100);
        return '<div style="margin-bottom:12px">'+
          '<div style="display:flex;justify-content:space-between;margin-bottom:4px">'+
            '<span style="font-size:12px;color:var(--txt)">'+(catLabels[cat]||cat)+'</span>'+
            '<span style="font-size:12px;font-weight:600;color:var(--terra)">$'+amt.toLocaleString()+' ('+pct+'%)</span>'+
          '</div>'+
          '<div style="background:var(--sand);border-radius:4px;height:8px">'+
            '<div style="background:var(--terra);height:8px;border-radius:4px;width:'+barW+'%"></div>'+
          '</div>'+
        '</div>';
      }).join('');
    }
  }

  // Bar chart
  const chartEl = document.getElementById('pl-bar-chart');
  if(chartEl && monthly.some(m=>m.rev>0||m.exp>0)) {
    const maxVal2 = Math.max(...monthly.map(m=>Math.max(m.rev,m.exp)),1);
    chartEl.innerHTML = monthly.map(function(m) {
      const revH = Math.round(m.rev/maxVal2*140);
      const expH = Math.round(m.exp/maxVal2*140);
      const netH = Math.round(Math.abs(m.net)/maxVal2*140);
      return '<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:2px">'+
        '<div style="display:flex;gap:1px;align-items:flex-end;height:140px">'+
          '<div style="width:6px;background:var(--sage);border-radius:2px 2px 0 0;height:'+revH+'px"></div>'+
          '<div style="width:6px;background:var(--terra);border-radius:2px 2px 0 0;height:'+expH+'px"></div>'+
          '<div style="width:6px;background:var(--gold);border-radius:2px 2px 0 0;height:'+netH+'px"></div>'+
        '</div>'+
        '<div style="font-size:9px;color:var(--txt3)">'+m.month.slice(0,1)+'</div>'+
      '</div>';
    }).join('');
  }
}

function renderPropertyPL() {
  const props = cData.properties||[];
  const bookings = cData.bookings||[];
  const expenses = cData.expenses||[];
  const grid = document.getElementById('property-pl-grid');
  if(!grid) return;
  if(!props.length) {
    grid.innerHTML='<div class="empty-state"><div class="es-i">🏠</div><h3>No properties yet</h3><p>Add properties and bookings to see per-property P&L</p></div>';
    return;
  }
  grid.innerHTML = props.map(function(p) {
    const propBookings = bookings.filter(b=>b.propId===p.id&&b.status!=='cancelled');
    const propExpenses = expenses.filter(e=>e.propId===p.id);
    const rev = propBookings.reduce((s,b)=>s+(b.price||0),0);
    const exp = propExpenses.reduce((s,e)=>s+(e.amount||0),0);
    const net = rev - exp;
    const margin = rev ? Math.round(net/rev*100) : 0;
    const color = net>=0?'var(--sage)':'var(--terra)';
    return '<div class="card">'+
      '<div class="card-body">'+
        '<div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px">'+
          '<div style="display:flex;align-items:center;gap:12px">'+
            '<div style="font-size:28px">'+p.emoji+'</div>'+
            '<div><div style="font-weight:600;color:var(--txt);font-size:15px">'+p.name+'</div>'+
            '<div style="font-size:12px;color:var(--txt3)">'+p.location+'</div></div>'+
          '</div>'+
          '<div style="display:flex;gap:20px;flex-wrap:wrap">'+
            '<div style="text-align:center"><div style="font-size:11px;color:var(--txt3)">Revenue</div><div style="font-size:16px;font-weight:700;color:var(--sage)">$'+rev.toLocaleString()+'</div></div>'+
            '<div style="text-align:center"><div style="font-size:11px;color:var(--txt3)">Expenses</div><div style="font-size:16px;font-weight:700;color:var(--terra)">$'+exp.toLocaleString()+'</div></div>'+
            '<div style="text-align:center"><div style="font-size:11px;color:var(--txt3)">Net Profit</div><div style="font-size:16px;font-weight:700;color:'+color+'">'+(net>=0?'+$':'-$')+Math.abs(net).toLocaleString()+'</div></div>'+
            '<div style="text-align:center"><div style="font-size:11px;color:var(--txt3)">Margin</div><div style="font-size:16px;font-weight:700;color:var(--txt2)">'+margin+'%</div></div>'+
          '</div>'+
        '</div>'+
      '</div>'+
    '</div>';
  }).join('');
}

function renderTaxExport() {
  const year = new Date().getFullYear();
  const bookings = (cData.bookings||[]).filter(b=>b.status!=='cancelled');
  const expenses = cData.expenses||[];
  const income = bookings.reduce((s,b)=>s+(b.price||0),0);
  const totalExp = expenses.reduce((s,e)=>s+(e.amount||0),0);
  const net = income - totalExp;
  
  const set=(id,v)=>{const el=document.getElementById(id);if(el)el.textContent=v;};
  set('tax-income','$'+income.toLocaleString());
  set('tax-expenses','$'+totalExp.toLocaleString());
  set('tax-net','$'+Math.max(0,net).toLocaleString());
  set('tax-year',year);

  const catLabels = {cleaning:'Cleaning & Maintenance',supplies:'Supplies & Amenities',
    repair:'Repairs & Maintenance',utilities:'Utilities',mortgage:'Mortgage / Rent',
    insurance:'Insurance',taxes:'Taxes & Licenses',software:'Software & Tools',
    marketing:'Advertising & Marketing',other:'Other Expenses'};
  const cats = {};
  expenses.forEach(function(e){ const c=e.category||e.cat||'other'; cats[c]=(cats[c]||0)+(e.amount||0); });
  
  const schedEl = document.getElementById('tax-schedule-e');
  if(schedEl) {
    schedEl.innerHTML='<table style="width:100%;border-collapse:collapse;font-size:13px">'+
      '<thead><tr style="border-bottom:2px solid var(--border)">'+
        '<th style="text-align:left;padding:10px 8px;color:var(--txt2)">Expense Category (Schedule E)</th>'+
        '<th style="text-align:right;padding:10px 8px;color:var(--txt2)">Amount</th>'+
        '<th style="text-align:right;padding:10px 8px;color:var(--txt2)">% of Total</th>'+
      '</tr></thead><tbody>'+
      Object.entries(cats).sort((a,b)=>b[1]-a[1]).map(function([cat,amt]) {
        return '<tr style="border-bottom:1px solid var(--border)">'+
          '<td style="padding:10px 8px;color:var(--txt)">'+(catLabels[cat]||cat)+'</td>'+
          '<td style="text-align:right;padding:10px 8px;font-weight:600;color:var(--terra)">$'+amt.toLocaleString()+'</td>'+
          '<td style="text-align:right;padding:10px 8px;color:var(--txt2)">'+(totalExp?Math.round(amt/totalExp*100):0)+'%</td>'+
        '</tr>';
      }).join('')+
      '<tr style="border-top:2px solid var(--border);font-weight:700">'+
        '<td style="padding:10px 8px;color:var(--txt)">TOTAL DEDUCTIBLE EXPENSES</td>'+
        '<td style="text-align:right;padding:10px 8px;color:var(--terra)">$'+totalExp.toLocaleString()+'</td>'+
        '<td style="text-align:right;padding:10px 8px;color:var(--txt2)">100%</td>'+
      '</tr>'+
    '</tbody></table>';
  }
}

function exportPLCSV() {
  const year = parseInt(document.getElementById('pl-year')?.value||new Date().getFullYear());
  const bookings = (cData.bookings||[]).filter(b=>b.status!=='cancelled'&&new Date(b.checkin||b.date||0).getFullYear()===year);
  const expenses = (cData.expenses||[]).filter(e=>new Date(e.date||0).getFullYear()===year);
  const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  let csv = 'Month,Revenue,Expenses,Net Profit,Margin\n';
  let totalRev=0,totalExp=0;
  months.forEach(function(m,i) {
    const rev = bookings.filter(b=>new Date(b.checkin||b.date||0).getMonth()===i).reduce((s,b)=>s+(b.price||0),0);
    const exp = expenses.filter(e=>new Date(e.date||0).getMonth()===i).reduce((s,e)=>s+(e.amount||0),0);
    const net = rev-exp;
    const margin = rev?Math.round(net/rev*100):0;
    totalRev+=rev; totalExp+=exp;
    csv+=m+','+rev+','+exp+','+net+','+margin+'%\n';
  });
  csv+='TOTAL,'+totalRev+','+totalExp+','+(totalRev-totalExp)+','+(totalRev?Math.round((totalRev-totalExp)/totalRev*100):0)+'%\n';
  const blob=new Blob([csv],{type:'text/csv'});
  const a=document.createElement('a');
  a.href=URL.createObjectURL(blob);
  a.download='CSO-PL-'+year+'.csv';
  a.click();
  toast('P&L exported ✓');
}

function exportTaxCSV() {
  const year = new Date().getFullYear();
  const expenses = cData.expenses||[];
  let csv = 'Date,Description,Category,Amount,Property\n';
  expenses.forEach(function(e) {
    csv+='"'+(e.date||'')+'"'+',"'+(e.desc||e.description||'')+'"'+',"'+(e.category||e.cat||'other')+'"'+','+(e.amount||0)+',"'+(e.propName||'All Properties')+'"\n';
  });
  const blob=new Blob([csv],{type:'text/csv'});
  const a=document.createElement('a');
  a.href=URL.createObjectURL(blob);
  a.download='CSO-Tax-Export-'+year+'.csv';
  a.click();
  toast('Tax export downloaded ✓');
}

function printTaxReport() {
  window.print();
}


// ═════════════════════════════════════════
//  AUTH INIT
// ═════════════════════════════════════════
async function initAuth() {
  let _launched = false;

  // Check for password reset token in URL hash (must happen before session check)
  const hash = window.location.hash;
  if(hash.includes('type=recovery')) {
    const {data: recSess, error: recErr} = await sb.auth.getSession().catch((e) => ({ data: null, error: e }));
    if (recErr) sbHandleError(recErr, 'initAuth recovery getSession');
    if(recSess?.session) { showScreen('reset'); return; }
  }

  // Helper: is this error a network/fetch failure we should suppress from console?
  function isNetworkError(e) {
    const msg = (e?.message || e?.name || String(e)).toLowerCase();
    return msg.includes('failed to fetch') || msg.includes('networkerror') ||
           msg.includes('authretryable') || msg.includes('fetch error') ||
           msg.includes('network request failed');
  }

  let sessionCheckAttempts = 0;
  const maxAttempts = 3;

  // If offline on boot, skip network attempts entirely and go straight to onAuthStateChange
  if (!navigator.onLine) {
    sessionCheckAttempts = maxAttempts;
  }

  while (sessionCheckAttempts < maxAttempts) {
    try {
      const { data: { session } } = await sb.auth.getSession();
      if (session?.user) {
        if(_launched) return;
        _launched = true;
        cUid = session.user.id;
        cUser = {
          email: session.user.email,
          name: session.user.user_metadata?.full_name || session.user.email.split('@')[0],
          role: session.user.user_metadata?.role || 'user'
        };
        try {
          const data = await loadUserData(cUid);
          cData = data || getLocalData(cUid);
          if(!data) saveLocalData(cUid, cData); // save locally without network call
        } catch(e) {
          if(!isNetworkError(e)) sbHandleError(e, 'initAuth loadUserData');
          cData = getLocalData(cUid); // fall back to local cache
        }
        await launchApp(cUser);
        // NOTE: page restore is handled inside launchApp → renderAll, not here
        return;
      }
      break; // No session found, exit loop
    } catch(e) {
      sessionCheckAttempts++;
      if(!isNetworkError(e)) console.warn('initAuth attempt', sessionCheckAttempts, e);
      if (sessionCheckAttempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 300 * sessionCheckAttempts));
      }
    }
  }

  // onAuthStateChange handles the rest — suppress fetch errors from its internal retries
  sb.auth.onAuthStateChange(async function(event, session) {
    if(event === 'PASSWORD_RECOVERY') { showScreen('reset'); return; }
    if(event === 'SIGNED_IN') {
      // Session restored after refresh or token renewal — launch app if not already running
      if(!_launched && session && session.user) {
        _launched = true;
        cUid = session.user.id;
        cUser = {
          email: session.user.email,
          name: session.user.user_metadata?.full_name || session.user.email.split('@')[0],
          role: session.user.user_metadata?.role || 'user'
        };
        try {
          const data = await loadUserData(cUid);
          cData = data || getLocalData(cUid);
          if(!data) saveLocalData(cUid, cData);
        } catch(e) {
          if(!isNetworkError(e)) sbHandleError(e, 'SIGNED_IN loadUserData');
          cData = getLocalData(cUid);
        }
        await launchApp(cUser);
      }
      return;
    }
    if(event === 'INITIAL_SESSION') {
      if(session && session.user) {
        if(_launched) return;
        _launched = true;
        cUid = session.user.id;
        cUser = {
          email: session.user.email,
          name: session.user.user_metadata?.full_name || session.user.email.split('@')[0],
          role: session.user.user_metadata?.role || 'user'
        };
        try {
          const data = await loadUserData(cUid);
          cData = data || getLocalData(cUid);
          if(!data) saveLocalData(cUid, cData);
        } catch(e) {
          if(!isNetworkError(e)) sbHandleError(e, 'initAuth loadUserData');
          cData = getLocalData(cUid);
        }
        await launchApp(cUser);
      } else {
        // Delay before showing landing — Supabase sometimes fires INITIAL_SESSION
        // with no session before the persisted refresh token is fully restored.
        // The 800ms window lets the token restore and SIGNED_IN fire first.
        if(!_launched) setTimeout(() => { if(!_launched) showLandingPage(); }, 800);
      }
    } else if(event === 'SIGNED_OUT') {
      const appVis = document.getElementById('app')?.classList.contains('visible');
      cUid = null; cData = null; cUser = null; isAdmin = false;
      document.getElementById('app')?.classList.remove('visible');
      // Clear last page so next login always starts at dashboard
      try{sessionStorage.removeItem('hh_last_page');}catch(e){}
      try{localStorage.removeItem('hh_last_page');}catch(e){}
      if (appVis) {
        showScreen('login');
        try {
          const _ghPages = window.location.hostname.endsWith('github.io');
          if (!_ghPages && window.location.protocol !== 'file:') history.replaceState(null, '', '/login');
        } catch(e) {}
        toast('Session ended — please sign in again');
      } else {
        showLandingPage();
      }
    }
  });
}

// ═════════════════════════════════════════
//  BOOT
// ═════════════════════════════════════════
window.addEventListener('load', () => {

  // ── JOB CARD PWA: if URL has ?job=ID, render cleaner-facing page instead of app
  const _jobParam = new URLSearchParams(window.location.search).get('job');
  if (_jobParam) {
    // Clean the URL so a manual refresh doesn't re-render the job card
    try { window.history.replaceState({}, '', window.location.pathname); } catch(e) {}
    renderCleanerJobCard(_jobParam);
    return;
  }

  // ── JOB APPROVAL: if URL has ?approve=TOKEN, render owner approval page
  const _approveToken = new URLSearchParams(window.location.search).get('approve');
  if (_approveToken) {
    // Clean the URL after consuming the token
    try { window.history.replaceState({}, '', window.location.pathname); } catch(e) {}
    renderOwnerApprovalPage(_approveToken);
    return;
  }
  try {
    // Don't rewrite the path on GitHub Pages — it causes 404 on refresh.
    // Only rewrite on custom domains where the server is configured to handle it.
    const isGitHubPages = window.location.hostname.endsWith('github.io');
    const isLocalFile = window.location.protocol === 'file:';
    if (!isGitHubPages && !isLocalFile &&
        window.location.pathname !== '/' &&
        window.location.pathname !== '/index_integrated.html') {
      window.history.replaceState({}, '', '/');
    }
  } catch(e) {}
  
  // Clear service workers
  if('serviceWorker' in navigator){
    navigator.serviceWorker.getRegistrations().then(function(regs){
      regs.forEach(function(r){r.unregister();});
    });
  }
  if('caches' in window){caches.keys().then(n=>n.forEach(k=>caches.delete(k)));}

  // Wrapped init — if anything fails, fallback to login screen (never white screen)
  try {
    initAuth();
  } catch(e) {
    console.error('Init failed:', e);
    try { showScreen('login'); } catch(e2) {
      document.body.innerHTML = '<div style="display:grid;place-items:center;min-height:100vh;background:#1a1209;color:#fff;font-family:sans-serif"><div style="text-align:center"><div style="font-size:32px;margin-bottom:16px">CSO Property Services</div><button onclick="location.reload()" style="padding:12px 24px;background:#C4693A;color:#fff;border:none;border-radius:8px;font-size:16px;cursor:pointer">Reload App</button></div></div>';
    }
  }
});

// PREMIUM ADDITIONS
// MARKETPLACE TAX ENGINE
var PLATFORM_FEE_PCT = 0.10;

function calcMarketplaceTax(jobAmount) {
  var fee = parseFloat((jobAmount * PLATFORM_FEE_PCT).toFixed(2));
  return { fee: fee, providerPayout: parseFloat((jobAmount - fee).toFixed(2)), total: jobAmount };
}

async function processMarketplaceJob(jobId, amount, providerId) {
  try {
    var tx = calcMarketplaceTax(amount);
    shmLog('Job #' + jobId + ': $' + amount + ' fee=$' + tx.fee + ' payout=$' + tx.providerPayout, 'ok');
    if (typeof sb !== 'undefined' && typeof cUid !== 'undefined' && cUid) {
      const ju = await sb.from('jobs').update({
        platform_fee: tx.fee, provider_payout: tx.providerPayout,
        fee_pct: PLATFORM_FEE_PCT, status: 'completed',
        completed_at: new Date().toISOString()
      }).eq('id', jobId).eq('uid', cUid);
      if (ju.error) sbHandleError(ju.error, 'jobs update');
      const pe = await sb.from('platform_earnings').upsert({
        uid: cUid, job_id: jobId, amount: tx.fee,
        provider_id: providerId, created_at: new Date().toISOString()
      });
      if (pe.error) sbHandleError(pe.error, 'platform_earnings');
      shmLog('Marketplace tax saved to Supabase', 'fix');
    }
    var jobs = (typeof cData !== 'undefined' ? cData.jobs : null) || [];
    var job = jobs.find(function(j){ return j.id === jobId; });
    if (job) { job.platformFee = tx.fee; job.providerPayout = tx.providerPayout; job.status = 'completed'; }
    var totalFees = jobs.filter(function(j){ return j.status === 'completed'; })
      .reduce(function(s,j){ return s + (j.platformFee || 0); }, 0);
    var feeEl = document.getElementById('mkt-fees');
    if (feeEl) feeEl.textContent = '$' + totalFees.toFixed(2);
    showPremiumNotification('Job done! Platform fee $' + tx.fee + ' retained', 'success');
    return tx;
  } catch(e) {
    shmLog('processMarketplaceJob: ' + e.message, 'err');
    analyzeAndSuggestFix(e);
    throw e;
  }
}

// SHADOW SUPPORT AI
var _shadowOpen = false;
var _shadowHistory = [];

function toggleShadowSupport() {
  _shadowOpen = !_shadowOpen;
  var chat = document.getElementById('shadow-support-chat');
  var btn  = document.getElementById('shadow-support-toggle');
  if (!chat || !btn) return;
  chat.style.display = _shadowOpen ? 'flex' : 'none';
  btn.style.display  = _shadowOpen ? 'none' : 'flex';
  if (_shadowOpen) { var inp = document.getElementById('ss-input'); if(inp) inp.focus(); }
}

async function sendShadowMsg() {
  var input = document.getElementById('ss-input');
  var msgBox = document.getElementById('ss-messages');
  if (!input || !msgBox) return;
  var msg = (input.value || '').trim();
  if (!msg) return;
  input.value = '';
  input.disabled = true;

  var ud = document.createElement('div');
  ud.className = 'ss-msg user'; ud.textContent = msg;
  msgBox.appendChild(ud);

  var td = document.createElement('div');
  td.className = 'ss-msg bot';
  td.innerHTML = '<span style="opacity:.5">Thinking…</span>';
  msgBox.appendChild(td);
  msgBox.scrollTop = msgBox.scrollHeight;

  _shadowHistory.push({role:'user', content: msg});

  try {
    var d = (typeof cData !== 'undefined' ? cData : null) || {};
    var now = new Date();
    var thisMonth = now.toISOString().slice(0,7);
    var bookings = d.bookings || [];
    var activeBookings = bookings.filter(function(b){ return b.status==='confirmed'; });
    var upcomingBookings = bookings.filter(function(b){ return b.checkin >= now.toISOString().slice(0,10) && b.status!=='cancelled'; });
    var totalRev = bookings.filter(function(b){ return b.status!=='cancelled'; }).reduce(function(s,b){ return s+(b.price||0); }, 0);
    var monthRev = bookings.filter(function(b){ return b.checkin && b.checkin.startsWith(thisMonth) && b.status!=='cancelled'; }).reduce(function(s,b){ return s+(b.price||0); }, 0);
    var totalExp = (d.expenses||[]).reduce(function(s,e){ return s+(e.amount||0); }, 0);

    var snapshot = {
      properties: (d.properties||[]).map(function(p){ return {name:p.name, location:p.location, rate:p.rate, occupancy:p.occupancy, rating:p.rating}; }),
      bookings_summary: {
        total: bookings.length,
        active: activeBookings.length,
        upcoming: upcomingBookings.length,
        pending: bookings.filter(function(b){ return b.status==='pending'; }).length,
        this_month_revenue: monthRev,
        all_time_revenue: totalRev,
        next_checkin: upcomingBookings.length ? upcomingBookings.sort(function(a,b){ return a.checkin.localeCompare(b.checkin); })[0] : null
      },
      expenses: { total: totalExp, count: (d.expenses||[]).length },
      tasks: { pending: (d.tasks||[]).filter(function(t){ return !t.done; }).length, overdue: (d.tasks||[]).filter(function(t){ return !t.done && t.due && t.due < now.toISOString().slice(0,10); }).length },
      guests: { total: (d.guestCRM||[]).length, vip: (d.guestCRM||[]).filter(function(g){ return g.stays>=2; }).length },
      staff: { cleaners: (d.cleaners||[]).length, open_jobs: (d.jobs||[]).filter(function(j){ return j.status==='open'; }).length },
      inventory_alerts: (d.inventory||[]).filter(function(i){ return i.qty<=i.threshold; }).map(function(i){ return i.name; }),
      messages_unread: (d.messages||[]).filter(function(m){ return m.unread; }).length,
      reviews_count: (d.reviews||[]).length,
      avg_rating: (d.properties||[]).length ? ((d.properties||[]).reduce(function(s,p){ return s+parseFloat(p.rating||0); },0)/(d.properties||[]).length).toFixed(2) : 'N/A'
    };

    var apiKey = (d && d.apiKey) ? d.apiKey : '';
    if (!apiKey) {
      td.innerHTML = shadowFallback(msg.toLowerCase(), snapshot);
      _shadowHistory.push({role:'assistant', content: td.textContent});
      msgBox.scrollTop = msgBox.scrollHeight;
      input.disabled = false;
      return;
    }

    var systemPrompt = 'You are Shadow Support AI, a smart assistant built into CSO Property Services — a short-term rental management dashboard. You have access to the host\'s live data snapshot below. Answer questions about their properties, bookings, revenue, guests, tasks, inventory, and operations. Be concise, helpful, and specific. Use real numbers from the data. Format numbers with $ and commas. Today is ' + now.toDateString() + '.\n\nHOST DATA SNAPSHOT:\n' + JSON.stringify(snapshot, null, 2);

    var historyToSend = _shadowHistory.slice(-10);

    var response = await fetch('https://vdnyqwpznsysrvyvbqga.supabase.co/functions/v1/ai-draft', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZkbnlxd3B6bnN5c3J2eXZicWdhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ2NjM4NjUsImV4cCI6MjA5MDIzOTg2NX0.VxwNE_lMR2JV_70SVr9rio_UgfbKGnYFyeitkTuWYkM' },
      body: JSON.stringify({ prompt: systemPrompt + '\n\nConversation:\n' + historyToSend.map(function(m){ return m.role.toUpperCase()+': '+m.content; }).join('\n') + '\n\nUSER: ' + msg })
    });

    var data = await response.json();
    if (data.error) throw new Error(data.error);
    var reply = data.text || (data.content && data.content[0] && data.content[0].text) || 'No response.';
    td.innerHTML = reply.replace(/\n/g, '<br>');
    _shadowHistory.push({role:'assistant', content: reply});
  } catch(e) {
    var d2 = (typeof cData !== 'undefined' ? cData : null) || {};
    td.innerHTML = shadowFallback(msg.toLowerCase(), {
      bookings_summary: { total: (d2.bookings||[]).length, active: (d2.bookings||[]).filter(function(b){ return b.status==='confirmed'; }).length },
      guests: { total: (d2.guestCRM||[]).length },
      properties: d2.properties||[],
      expenses: { total: (d2.expenses||[]).reduce(function(s,e){ return s+(e.amount||0); },0) }
    });
  }

  msgBox.scrollTop = msgBox.scrollHeight;
  input.disabled = false;
}

function shadowFallback(q, snap) {
  var b = snap.bookings_summary || {};
  var g = snap.guests || {};
  var p = snap.properties || [];
  var ex = snap.expenses || {};
  if(q.indexOf('booking')>-1||q.indexOf('reservation')>-1)
    return '📅 <strong>Bookings:</strong> '+b.total+' total · '+b.active+' active · '+(b.upcoming||0)+' upcoming<br>Add your Claude API key in Settings for smarter answers.';
  if(q.indexOf('revenue')>-1||q.indexOf('income')>-1||q.indexOf('earn')>-1)
    return '💰 <strong>Revenue:</strong> $'+(b.all_time_revenue||0).toLocaleString()+' all-time · $'+(b.this_month_revenue||0).toLocaleString()+' this month<br>Add your API key in Settings for smarter answers.';
  if(q.indexOf('expense')>-1||q.indexOf('cost')>-1)
    return '📊 <strong>Expenses:</strong> $'+(ex.total||0).toLocaleString()+' tracked<br>Add your API key for smarter answers.';
  if(q.indexOf('guest')>-1)
    return '👥 <strong>Guests:</strong> '+g.total+' in CRM · '+b.active+' active bookings<br>Add your API key for smarter answers.';
  if(q.indexOf('propert')>-1)
    return '🏠 <strong>Properties:</strong> '+p.length+' in portfolio<br>Add your API key for smarter answers.';
  return '🔍 Try asking about bookings, revenue, expenses, guests, or properties.<br><em>Add your Claude API key in Settings to unlock full AI answers.</em>';
}

// SELF-HEALING MONITOR
var _shmOpen = false;

function shmLog(message, type) {
  type = type || 'ok';
  var log = document.getElementById('shm-log');
  if (!log) return;
  var e = document.createElement('div');
  e.className = 'shm-entry ' + type;
  e.textContent = '[' + new Date().toLocaleTimeString() + '] ' + message;
  log.appendChild(e); log.scrollTop = log.scrollHeight;
  var dot = document.getElementById('shm-dot');
  if (dot) {
    dot.className = 'health-dot' + (type==='err'?' err':type==='warn'?' warn':'');
    if(type==='ok'||type==='fix') setTimeout(function(){ if(dot) dot.className='health-dot'; }, 3000);
  }
}

function analyzeAndSuggestFix(error) {
  var stack = (error && (error.stack || error.message)) || String(error);
  shmLog('Analyzing: ' + stack.substring(0,100), 'warn');
  var fix = 'Manual review required.';
  if(stack.indexOf('null')>-1||stack.indexOf('undefined')>-1) fix='Fix: Add null check — use optional chaining (obj?.prop).';
  else if(stack.indexOf('NetworkError')>-1) fix='Fix: Network error — check Supabase URL/key.';
  else if(stack.indexOf('RLS')>-1||stack.indexOf('permission')>-1) fix='Fix: RLS policy blocking. Check auth.uid()=uid policy.';
  else if(stack.indexOf('duplicate')>-1) fix='Fix: Unique constraint — use upsert() instead of insert().';
  else if(stack.indexOf('JWT')>-1||stack.indexOf('session')>-1) fix='Fix: Session expired. Call sb.auth.refreshSession().';
  else if(stack.indexOf('CORS')>-1) fix='Fix: CORS — check Supabase allowed origins.';
  else if(stack.indexOf('500')>-1) fix='Fix: Server 500 — check Supabase Edge Function logs.';
  shmLog('Suggested ' + fix, 'fix');
  showPremiumNotification('Self-healer: ' + fix.substring(0,55), 'warning');
}

function toggleSelfHealingMonitor() {
  _shmOpen = !_shmOpen;
  var mon = document.getElementById('self-healing-monitor');
  if (mon) mon.style.display = _shmOpen ? 'flex' : 'none';
}

window.addEventListener('error', function(e){
  const msg = e.message || '';
  if(msg.toLowerCase().includes('failed to fetch') || msg.toLowerCase().includes('authretryable')) return;
  if(msg.toLowerCase().includes('cors') || msg.toLowerCase().includes('anthropic') || msg.toLowerCase().includes('api.anthropic')) return;
  shmLog('ERROR: '+(msg||'Unknown'), 'err');
  analyzeAndSuggestFix(e);
});
window.addEventListener('unhandledrejection', function(e){
  const reason = e.reason?.message || String(e.reason || '');
  if(reason.toLowerCase().includes('failed to fetch') || reason.toLowerCase().includes('authretryable') || reason.toLowerCase().includes('networkerror')) return;
  if(reason.toLowerCase().includes('cors') || reason.toLowerCase().includes('anthropic')) return;
  shmLog('PROMISE: '+reason, 'err');
  analyzeAndSuggestFix(e.reason);
});
(function patchFetch(){
  var orig = window.fetch;
  window.fetch = async function(){
    try {
      var res = await orig.apply(this, arguments);
      if(res && res.status >= 500){
        var url = typeof arguments[0]==='string'?arguments[0]:(arguments[0]&&arguments[0].url)||'?';
        shmLog('HTTP '+res.status+' from '+String(url).substring(0,50), 'err');
        analyzeAndSuggestFix({message:'HTTP '+res.status, stack:'HTTP 500 error'});
      }
      return res;
    } catch(e){ shmLog('Fetch failed: '+e.message,'err'); analyzeAndSuggestFix(e); throw e; }
  };
})();

// ONBOARDING WIZARD
var _owizStep = 1;
var _OWIZ_MAX = 4;

function openOnboardingWizard() {
  _owizStep = 1;
  var el = document.getElementById('onboarding-wizard-modal');
  if(el) { el.style.display = 'flex'; _owizRender(); }
}
function closeOnboardingWizard() {
  var el = document.getElementById('onboarding-wizard-modal');
  if(el) el.style.display = 'none';
}
function _owizRender() {
  for(var i=1;i<=_OWIZ_MAX;i++){
    var s=document.getElementById('owiz-step-'+i);
    var dd=document.getElementById('owiz-d'+i);
    if(s) s.classList.toggle('active', i===_owizStep);
    if(dd){ dd.classList.remove('done','active'); if(i<_owizStep)dd.classList.add('done'); else if(i===_owizStep)dd.classList.add('active'); }
  }
  var bb=document.getElementById('owiz-back-btn');
  var nb=document.getElementById('owiz-next-btn');
  if(bb) bb.style.display = _owizStep>1?'':'none';
  if(nb) nb.textContent = _owizStep===_OWIZ_MAX?'Finish':'Next';
}
function owizNext() {
  if(_owizStep===1){ var n=document.getElementById('owiz-prop-name'); if(n&&!n.value.trim()){showPremiumNotification('Please enter a property name','warning');return;} }
  if(_owizStep>=_OWIZ_MAX){ _owizFinish(); return; }
  _owizStep++; _owizRender();
}
function owizBack() { if(_owizStep>1){_owizStep--;_owizRender();} }
function _owizFinish() {
  closeOnboardingWizard();
  showPremiumNotification('CSO Ops Masterclass setup complete!','success');
  shmLog('Onboarding wizard completed','fix');
  try { localStorage.setItem('hh_wizard_done','1'); } catch(e){}
}

// PREMIUM NOTIFICATIONS
function showPremiumNotification(message, type) {
  type = type || 'success';
  var c = document.getElementById('premium-toast-container');
  if(!c){ if(typeof toast==='function') toast(message); return; }
  var t = document.createElement('div');
  t.className = 'premium-toast ' + type;
  var icons = {success:'✅',error:'❌',warning:'⚠️',info:'ℹ️'};
  t.innerHTML = '<div style="display:flex;align-items:center;gap:10px;"><span style="font-size:15px">'+(icons[type]||'ℹ️')+'</span><span style="font-size:13px;color:var(--txt)">'+String(message).replace(/</g,'&lt;')+'</span></div>';
  c.appendChild(t);
  setTimeout(function(){ t.style.cssText='opacity:0;transform:translateX(40px);transition:all .3s;'; setTimeout(function(){t.remove();},350); }, 3200);
}

// TOPBAR BUTTON INJECTION — only inject SHM button for admin debugging
function _injectPremiumButtons() {
  // SHM and wizard buttons intentionally removed from topbar to reduce clutter.
  // SHM accessible via Shadow Support AI. Wizard via onboarding flow.
}

// BOOT
setTimeout(function(){
  _injectPremiumButtons();
  shmLog('CSO Property Services Premium v2 loaded','ok');
  shmLog('Marketplace tax engine ready (10% fee)','ok');
  shmLog('Shadow Support AI ready','ok');
  shmLog('Self-Healing Monitor watching','fix');
  try {
    var lk = typeof LOCAL_KEY !== 'undefined' ? LOCAL_KEY : 'hh_local_v1';
    if(!localStorage.getItem('hh_wizard_done') && !localStorage.getItem(lk)){
      setTimeout(function(){
        var app = document.getElementById('app');
        var landing = document.getElementById('screen-landing');
        var appVisible = app && (app.classList.contains('visible') || app.style.display === 'block');
        var landingHidden = !landing || landing.style.display === 'none';
        if(appVisible && landingHidden) { openOnboardingWizard(); }
      }, 2500);
    }
  } catch(e){}
}, 1200);

// ════════════════════════════════════════════════════════════════
// CSO PROPERTY SERVICES — $50K MRR SCALING FEATURES
// Features: Milestone Widget · Platform Profit · Dispute Freeze · Annual Toggle
// ════════════════════════════════════════════════════════════════

// ── FEATURE 1: MILESTONE WIDGET ──────────────────────────────────
const MILESTONES = [
  { id:'add_property', icon:'🏠', step:1, title:'Add Your First Property',   desc:'Your portfolio starts here.',        actionLabel:'Add Property',  action:()=>openModal('add-property-modal'),                                             check:()=>(cData?.properties||[]).length>0 },
  { id:'sync_ical',    icon:'🔄', step:2, title:'Sync Your Airbnb iCal',     desc:'Import bookings automatically.',     actionLabel:'iCal Sync',     action:()=>nav('ical',document.querySelector('[onclick*=ical]')),                        check:()=>(cData?.icals||[]).length>0||(cData?.bookings||[]).some(b=>b.source==='airbnb'||b.source==='vrbo') },
  { id:'add_cleaner',  icon:'🧹', step:3, title:'Add a Cleaner',             desc:'Build your operations team.',        actionLabel:'Add Cleaner',   action:()=>nav('marketplace',document.querySelector('[onclick*=marketplace]')),          check:()=>(cData?.cleaners||[]).length>0 },
  { id:'verify_job',   icon:'✅', step:4, title:'Verify Your First Job',     desc:"Owner-approved → Friday payout.",   actionLabel:'View Payouts',  action:()=>nav('payouts',document.querySelector('[onclick*=payouts]')),                  check:()=>(cData?.payouts||[]).some(p=>p.status==='verified'||p.status==='paid') },
];

function renderMilestoneWidget() {
  const container = document.getElementById('milestone-widget');
  if(!container||!cData) return;
  if(cData.milestonesDismissed){container.style.display='none';return;}
  const completed=MILESTONES.filter(m=>m.check());
  const total=MILESTONES.length;
  const allDone=completed.length===total;
  const pct=Math.round((completed.length/total)*100);
  if(allDone&&!cData.milestonesCelebrated){toast('🎉 All 4 milestones complete! Your first payout is ready.');cData.milestonesCelebrated=true;saveUserData(cUid,cData);}
  if(allDone){container.style.display='none';return;}
  container.style.display='block';
  container.innerHTML=`
    <div style="background:var(--card);border:1px solid var(--border);border-left:3px solid var(--terra);border-radius:12px;margin-bottom:18px;overflow:hidden">
      <div style="display:flex;align-items:center;justify-content:space-between;padding:14px 18px 10px">
        <div>
          <div style="font-family:Fraunces,serif;font-size:15px;font-weight:500;color:var(--txt);letter-spacing:-.2px">🎯 4 Steps to Your First Payout</div>
          <div style="font-size:11px;color:var(--txt3);margin-top:2px">${completed.length} of ${total} complete</div>
        </div>
        <button onclick="dismissMilestoneWidget()" style="background:none;border:none;color:var(--txt3);font-size:18px;cursor:pointer;padding:2px 6px;border-radius:6px;line-height:1" title="Dismiss">×</button>
      </div>
      <div style="padding:0 18px 14px">
        <div style="background:var(--sand);border-radius:4px;height:5px;overflow:hidden">
          <div style="height:100%;background:linear-gradient(90deg,var(--terra),var(--gold));border-radius:4px;width:${pct}%;transition:width .4s ease"></div>
        </div>
      </div>
      <div style="display:grid;grid-template-columns:repeat(4,1fr);border-top:1px solid var(--border)">
        ${MILESTONES.map((m,i)=>{
          const done=m.check();
          const isNext=!done&&MILESTONES.slice(0,i).every(prev=>prev.check());
          return `<div style="display:flex;flex-direction:column;align-items:center;padding:14px 10px 16px;text-align:center;border-right:${i<3?'1px solid var(--border)':'none'};background:${done?'rgba(107,143,113,.05)':isNext?'rgba(196,105,58,.04)':'transparent'}">
            <div style="width:32px;height:32px;border-radius:50%;background:${done?'var(--sage)':isNext?'var(--terra)':'var(--sand)'};color:${done||isNext?'#fff':'var(--txt3)'};display:flex;align-items:center;justify-content:center;font-size:${done?'14px':'15px'};font-weight:700;margin-bottom:8px;flex-shrink:0;box-shadow:${isNext?'0 0 0 3px rgba(196,105,58,.18)':'none'}">${done?'✓':m.icon}</div>
            <div style="font-size:11px;font-weight:600;color:${done?'var(--txt3)':'var(--txt)'};text-decoration:${done?'line-through':'none'};margin-bottom:3px;line-height:1.3">${m.title}</div>
            <div style="font-size:10px;color:var(--txt3);line-height:1.4;margin-bottom:${done?'0':'10px'}">${done?'✓ Done':m.desc}</div>
            ${!done?`<button onclick="_milestoneAction(${i})" style="background:${isNext?'var(--terra)':'var(--sand)'};color:${isNext?'#fff':'var(--txt2)'};border:none;border-radius:7px;padding:5px 10px;font-size:10px;font-weight:600;cursor:pointer;font-family:'DM Sans',sans-serif;margin-top:auto">${m.actionLabel} →</button>`:''}
          </div>`;
        }).join('')}
      </div>
    </div>`;
}
function _milestoneAction(i){const m=MILESTONES[i];if(m&&typeof m.action==='function')m.action();}
function dismissMilestoneWidget(){cData.milestonesDismissed=true;saveUserData(cUid,cData);const el=document.getElementById('milestone-widget');if(el)el.style.display='none';toast('Checklist hidden — find it in Settings if needed.');}

// ── FEATURE 2: PLATFORM PROFIT DASHBOARD (ADMIN) ─────────────────
function _fmtMoney(n){return parseFloat(n||0).toLocaleString('en-US',{minimumFractionDigits:0,maximumFractionDigits:2});}
function _buildMonthlyTrend(rows,months){
  const result=[];
  for(let i=months-1;i>=0;i--){
    const d=new Date();d.setMonth(d.getMonth()-i);
    const key=d.toISOString().slice(0,7);
    const label=d.toLocaleString('default',{month:'short'});
    const total=rows.filter(r=>(r.created_at||'').startsWith(key)).reduce((s,r)=>s+(parseFloat(r.amount)||0),0);
    result.push({key,label,total});
  }
  return result;
}
async function renderPlatformProfitDashboard(){
  const panel=document.getElementById('adm-panel-profit');
  if(!panel)return;
  if(!isAdmin){panel.innerHTML=`<div class="empty-state"><div class="es-i">🔒</div><h3>Admin only</h3></div>`;return;}
  panel.innerHTML=`<div style="text-align:center;padding:32px;color:var(--txt3)">⏳ Loading platform earnings…</div>`;
  try{
    let rows=[];let fromSupabase=false;
    if(typeof sb!=='undefined'){
      let _peRes; try { _peRes = await sb.from('platform_earnings').select('uid,job_id,amount,provider_id,created_at').order('created_at',{ascending:false}); } catch(e) { _peRes = {data:null,error:e}; }
      const{data,error}=_peRes||{data:null,error:null};
      if(!error&&data){rows=data;fromSupabase=true;}
    }
    if(!fromSupabase){
      rows=(cData?.platformEarnings||[]).map(pe=>({uid:cUid,job_id:pe.jobId,amount:pe.amount||0,provider_id:'',created_at:pe.created?new Date(pe.created).toISOString():new Date().toISOString()}));
    }
    const now=new Date();
    const thisMonth=now.toISOString().slice(0,7);
    const thisYear=String(now.getFullYear());
    const totalAll=rows.reduce((s,r)=>s+(parseFloat(r.amount)||0),0);
    const totalMonth=rows.filter(r=>(r.created_at||'').startsWith(thisMonth)).reduce((s,r)=>s+(parseFloat(r.amount)||0),0);
    const totalYear=rows.filter(r=>(r.created_at||'').startsWith(thisYear)).reduce((s,r)=>s+(parseFloat(r.amount)||0),0);
    const annualRunRate=totalMonth*12;
    const monthlyTrend=_buildMonthlyTrend(rows,6);
    const maxTrendVal=Math.max(...monthlyTrend.map(m=>m.total),1);
    const byUid={};
    rows.forEach(r=>{if(!byUid[r.uid])byUid[r.uid]={uid:r.uid,total:0,count:0};byUid[r.uid].total+=(parseFloat(r.amount)||0);byUid[r.uid].count+=1;});
    const topEarners=Object.values(byUid).sort((a,b)=>b.total-a.total).slice(0,5);

    panel.innerHTML=`
      <div class="g4" style="margin-bottom:18px">
        <div class="kpi k1" style="border-left:3px solid var(--gold)"><div class="kpi-label">Total Platform Fees</div><div class="kpi-val" style="color:var(--gold)">$${_fmtMoney(totalAll)}</div><span class="delta up">all time</span></div>
        <div class="kpi k2" style="border-left:3px solid var(--sage)"><div class="kpi-label">This Month</div><div class="kpi-val" style="color:var(--sage)">$${_fmtMoney(totalMonth)}</div><span class="delta up">${thisMonth}</span></div>
        <div class="kpi k3"><div class="kpi-label">This Year</div><div class="kpi-val">$${_fmtMoney(totalYear)}</div><span class="delta up">${thisYear}</span></div>
        <div class="kpi k4" style="border-left:3px solid var(--terra)"><div class="kpi-label">Annualized Run Rate</div><div class="kpi-val" style="color:var(--terra)">$${_fmtMoney(annualRunRate)}</div><span class="delta">this month ×12</span></div>
      </div>
      <div style="margin-bottom:14px;font-size:11px;color:var(--txt3);display:flex;align-items:center;gap:6px">
        <span style="background:${fromSupabase?'rgba(107,143,113,.15)':'rgba(200,168,75,.15)'};color:${fromSupabase?'var(--sage)':'var(--gold)'};border-radius:5px;padding:2px 8px;font-weight:700;font-size:10px">${fromSupabase?'⚡ Live — Supabase':'🔶 Demo — Local'}</span>
        ${rows.length} earning records · 10% MOR fee per job
      </div>
      <div class="card" style="margin-bottom:14px">
        <div class="card-hd"><div class="card-title">📈 Monthly Platform Fee Revenue — Last 6 Months</div><button class="btn btn-ghost" style="font-size:11px;padding:4px 9px" onclick="renderPlatformProfitDashboard()">↻ Refresh</button></div>
        <div class="card-body">
          ${rows.length===0?`<div class="empty-state" style="padding:20px 10px"><div class="es-i">💰</div><h3>No platform earnings yet</h3><p>Recorded when jobs complete in the Cleaner Marketplace.</p></div>`:`
          <div style="display:flex;align-items:flex-end;gap:8px;height:80px;padding:8px 0 0">
            ${monthlyTrend.map(m=>{
              const barH=Math.max(4,Math.round((m.total/maxTrendVal)*76));
              const isCur=m.key===thisMonth;
              return `<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:4px">
                <div style="font-size:9px;color:var(--txt3);font-weight:700">${m.total>0?'$'+_fmtMoney(m.total):'—'}</div>
                <div style="width:100%;height:${barH}px;background:${isCur?'linear-gradient(180deg,var(--gold),var(--terra))':'var(--sand)'};border-radius:4px 4px 0 0;border:1px solid ${isCur?'var(--terra-d)':'var(--border)'}"></div>
              </div>`;
            }).join('')}
          </div>
          <div style="display:flex;gap:8px;margin-top:6px">${monthlyTrend.map(m=>`<div style="flex:1;text-align:center;font-size:9px;color:var(--txt3);font-weight:600">${m.label}</div>`).join('')}</div>`}
        </div>
      </div>
      ${topEarners.length?`
      <div class="card" style="margin-bottom:14px">
        <div class="card-hd"><div class="card-title">🏅 Top Fee Contributors (by User)</div></div>
        <div class="card-body">
          ${topEarners.map((u,i)=>`
            <div style="display:flex;align-items:center;gap:12px;padding:8px 0;border-bottom:1px solid var(--border2)">
              <div style="width:24px;height:24px;border-radius:50%;background:${['var(--gold)','var(--terra)','var(--sage)','var(--navy)','var(--tan)'][i]};color:#fff;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;flex-shrink:0">${i+1}</div>
              <div style="flex:1;font-size:12px;color:var(--txt2);font-family:monospace">${u.uid.slice(0,8)}…</div>
              <div style="font-size:11px;color:var(--txt3)">${u.count} job${u.count!==1?'s':''}</div>
              <div style="font-size:14px;font-weight:700;color:var(--gold)">$${_fmtMoney(u.total)}</div>
            </div>`).join('')}
        </div>
      </div>`:''}
      <div style="display:flex;gap:8px;margin-top:4px">
        <button class="btn btn-ghost" style="font-size:12px" onclick="_exportPlatformEarningsCSV()">⬇️ Export CSV</button>
      </div>`;
  }catch(e){
    panel.innerHTML=`<div class="empty-state"><div class="es-i">⚠️</div><h3>Error loading earnings</h3><p style="font-size:12px;color:var(--txt3)">${e.message}</p></div>`;
  }
}
function _exportPlatformEarningsCSV(){
  const rows=cData?.platformEarnings||[];
  if(!rows.length){toast('No earnings to export');return;}
  const csv=['job_id,amount,percentage,date,property,type',...rows.map(r=>[r.jobId||'',r.amount||0,r.percentage||0,r.date||'','"'+(r.property||'').replace(/"/g,'""')+'"',r.type||'platform_fee'].join(','))].join('\n');
  const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv'}));a.download=`cso-platform-earnings-${new Date().toISOString().slice(0,10)}.csv`;a.click();
  toast('Platform earnings exported ✓');
}

// ── FEATURE 3: DISPUTE FREEZE ─────────────────────────────────────
function applyDisputeFreeze(payout,job,reason='Owner disputed via approval link',nowMs=Date.now()){
  const ts=new Date(nowMs).toISOString();
  if(payout){payout.status='frozen';payout.frozenAt=ts;payout.frozenReason=reason;payout.frozenBy='owner';}
  if(job){job.approvalStatus='disputed';job.approvalActedAt=ts;job.disputeReason=reason;}
  if(typeof saveUserData==='function'&&typeof cUid!=='undefined'&&cData)saveUserData(cUid,cData);
  try{const u=JSON.parse(localStorage.getItem('hh_job_updates')||'[]');u.push({jobId:job?.id||'',action:'owner_disputed_frozen',time:ts,reason});localStorage.setItem('hh_job_updates',JSON.stringify(u));}catch(e){}
}
function unfreezePayoutById(payoutId,adminNote=''){
  if(!isAdmin){toast('Admin only');return;}
  const payout=(cData?.payouts||[]).find(p=>p.id===payoutId);
  if(!payout){toast('Payout not found');return;}
  if(payout.status!=='frozen'){toast('Payout is not frozen');return;}
  payout.status='pending_approval';payout.unfrozenAt=new Date().toISOString();payout.unfrozenBy='admin';payout.unfrozenNote=adminNote;
  delete payout.frozenAt;delete payout.frozenReason;
  saveUserData(cUid,cData);
  toast(`Payout for ${payout.cleanerName||'contractor'} unfrozen — returned to pending approval`);
  renderPayouts();
}
function getFrozenPayouts(payouts=[]){return[...payouts].filter(p=>p.status==='frozen').sort((a,b)=>new Date(b.frozenAt||0)-new Date(a.frozenAt||0));}
function renderFrozenPayouts(){
  const el=document.getElementById('frozen-payout-list');if(!el)return;
  const frozen=getFrozenPayouts(cData?.payouts||[]);
  if(!frozen.length){el.innerHTML=`<div style="font-size:13px;color:var(--txt3);padding:8px 0">No frozen payouts — all disputes resolved.</div>`;return;}
  el.innerHTML=frozen.map(p=>`
    <div style="display:flex;align-items:center;gap:12px;padding:10px 12px;background:rgba(196,105,58,.06);border:1px solid var(--terra-l);border-radius:10px;margin-bottom:8px">
      <div style="font-size:22px;flex-shrink:0">🔒</div>
      <div style="flex:1">
        <div style="font-size:13px;font-weight:600;color:var(--txt)">${p.cleanerName||'Contractor'} — <span style="color:var(--terra)">$${(p.owed||0).toFixed(2)}</span></div>
        <div style="font-size:11px;color:var(--txt3);margin-top:2px">Frozen ${p.frozenAt?new Date(p.frozenAt).toLocaleDateString():'recently'} · ${p.frozenReason||'Owner dispute'}</div>
      </div>
      <span style="background:rgba(196,105,58,.15);color:var(--terra);font-size:10px;font-weight:700;padding:3px 8px;border-radius:10px;white-space:nowrap">⛔ FROZEN</span>
      ${isAdmin?`<button class="btn btn-ghost" style="font-size:10px;padding:3px 9px;color:var(--sage)" onclick="unfreezePayoutById('${p.id}','Admin resolved dispute')">Unfreeze →</button>`:''}
    </div>`).join('');
}
function _installFreezeRenderer(){
  if(typeof renderPayouts!=='function')return;
  const _orig=window.renderPayouts;
  window.renderPayouts=function(){
    _orig.apply(this,arguments);
    if(!document.getElementById('frozen-payout-list')){
      const page=document.getElementById('page-payouts');
      if(page){
        const wrap=document.createElement('div');
        wrap.innerHTML=`<div class="card" style="margin-top:14px;border-left:3px solid var(--terra)"><div class="card-hd"><div class="card-title">⛔ Frozen Payouts — Dispute Queue</div><div style="font-size:11px;color:var(--txt3)">Excluded from Friday batch</div></div><div class="card-body" id="frozen-payout-list"></div></div>`;
        page.appendChild(wrap);
      }
    }
    renderFrozenPayouts();
  };
}

// ── FEATURE 4: ANNUAL/MONTHLY TOGGLE + TRIAL MODAL ───────────────
const _ANNUAL_PRICING={
  pro:           {monthly:79, annual:66,  billed:790,  save:158},
  business:      {monthly:199,annual:166, billed:1990, save:398},
  cohost_starter:{monthly:149,annual:124, billed:1490, save:298},
  cohost:        {monthly:299,annual:249, billed:2990, save:598},
};
const _STRIPE_MONTHLY_V2={
  pro:           'https://buy.stripe.com/cNi8wO2EtdfT8wdbo44sE00',
  business:      'https://buy.stripe.com/aFafZg2EtdfTcMt9fW4sE01',
  cohost_starter:'https://buy.stripe.com/28EaEW0wldfTbIp2Ry4sE09',
  cohost:        'https://buy.stripe.com/cNi4gy1Apb7L3bTeAg4sE02',
};
// Annual Stripe Price Link URLs
const _STRIPE_ANNUAL_V2={
  pro:           'https://buy.stripe.com/7sY8wO6UJ1xb5k1dwc4sE05',
  business:      'https://buy.stripe.com/bJe7sKenb5Nr9Ah0Jq4sE06',
  cohost_starter:'https://buy.stripe.com/7sY14mfrffo1fYF2Ry4sE07',
  cohost:        'https://buy.stripe.com/eVq28qgvjgs513Lbo44sE08',
};

function toggleBillingEnhanced(){
  window.isAnnual=!window.isAnnual;
  const annual=window.isAnnual;
  const knob=document.getElementById('billing-knob');
  const mLabel=document.getElementById('toggle-monthly-label');
  const aLabel=document.getElementById('toggle-annual-label');
  if(knob)knob.style.left=annual?'27px':'3px';
  if(mLabel)mLabel.style.color=annual?'var(--txt2)':'var(--txt)';
  if(aLabel)aLabel.style.color=annual?'var(--txt)':'var(--txt2)';
  const updates={
    'pro-price':      annual?`$${_ANNUAL_PRICING.pro.annual}<span>/mo</span>`:'$79<span>/mo</span>',
    'biz-price':      annual?`$${_ANNUAL_PRICING.business.annual}<span>/mo</span>`:'$199<span>/mo</span>',
    'cohost-s-price': annual?`$${_ANNUAL_PRICING.cohost_starter.annual}<span>/mo</span>`:'$149<span>/mo</span>',
    'cohost-price':   annual?`$${_ANNUAL_PRICING.cohost.annual}<span>/mo</span>`:'$299<span>/mo</span>',
  };
  Object.entries(updates).forEach(([id,html])=>{const el=document.getElementById(id);if(el)el.innerHTML=html;});
  const descs={
    'pro-desc':      annual?`Billed $${_ANNUAL_PRICING.pro.billed}/year · Save $${_ANNUAL_PRICING.pro.save}`:'For serious hosts · 14-day free trial',
    'biz-desc':      annual?`Billed $${_ANNUAL_PRICING.business.billed}/year · Save $${_ANNUAL_PRICING.business.save}`:'For property managers · 14-day free trial',
    'cohost-s-desc': annual?`Billed $${_ANNUAL_PRICING.cohost_starter.billed}/year · Save $${_ANNUAL_PRICING.cohost_starter.save}`:'For new co-hosts managing owner properties',
    'cohost-desc':   annual?`Billed $${_ANNUAL_PRICING.cohost.billed}/year · Save $${_ANNUAL_PRICING.cohost.save} · 30-day guarantee`:'For full-scale co-hosting businesses · 30-day guarantee',
  };
  Object.entries(descs).forEach(([id,text])=>{const el=document.getElementById(id);if(el)el.textContent=text;});
  document.querySelectorAll('[onclick*="openStripe"]').forEach(btn=>{
    const match=btn.getAttribute('onclick')?.match(/openStripe\('([^']+)'\)/);if(!match)return;
    const plan=match[1];const isTrial=plan==='pro'||plan==='business';
    btn.textContent=annual?'Get Annual Plan →':isTrial?'Start Free Trial →':'Get Started →';
  });
  // Sync upgrade modal button labels with prices
  const upPro=document.getElementById('upgrade-btn-pro');
  const upBiz=document.getElementById('upgrade-btn-business');
  const upCo=document.getElementById('upgrade-btn-cohost');
  if(upPro) upPro.textContent=annual?'🚀 Pro — $66/mo billed $790/yr →':'🚀 Pro — $79/mo (10 properties) →';
  if(upBiz) upBiz.textContent=annual?'💼 Business — $166/mo billed $1,990/yr':'💼 Business — $199/mo (Unlimited)';
  if(upCo)  upCo.textContent=annual?'🏆 Co-Host — $249/mo billed $2,990/yr':'🏆 Co-Host — $299/mo (Unlimited + white-label)';
}

function openStripeEnhanced(plan){
  const links=window.isAnnual?_STRIPE_ANNUAL_V2:_STRIPE_MONTHLY_V2;
  const url=links[plan];
  if(!url){toast('Contact us: csopropertyservice@gmail.com');return;}
  let checkoutUrl=url;
  const params=new URLSearchParams();
  if(typeof cUid!=='undefined'&&cUid)params.set('client_reference_id',cUid);
  if(typeof cUser!=='undefined'&&cUser?.email)params.set('prefilled_email',cUser.email);
  if(window.isAnnual)params.set('metadata[billing_cadence]','annual');
  const qs=params.toString();
  if(qs)checkoutUrl+=(url.includes('?')?'&':'?')+qs;
  const trialPlans=['pro','business'];
  if(trialPlans.includes(plan)&&!window.isAnnual){_showTrialConfirmModal(plan,checkoutUrl);return;}
  window.open(checkoutUrl,'_blank');
}

function _showTrialConfirmModal(plan,checkoutUrl){
  const NAMES={pro:'🚀 Pro',business:'💼 Business'};
  const PRICES={pro:'$79/mo',business:'$199/mo'};
  const trialEnd=new Date();trialEnd.setDate(trialEnd.getDate()+14);
  const trialEndStr=trialEnd.toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric'});
  document.getElementById('trial-confirm-modal')?.remove();
  const modal=document.createElement('div');
  modal.id='trial-confirm-modal';modal.className='modal-bg open';
  modal.innerHTML=`<div class="modal" style="max-width:420px">
    <h2 style="margin-bottom:4px">🎯 Start Your Free Trial</h2>
    <div style="font-size:13px;color:var(--txt2);margin-bottom:20px">${NAMES[plan]} Plan — 14 days free</div>
    <div style="background:var(--sand);border-radius:10px;padding:16px;margin-bottom:18px">
      <div style="display:flex;flex-direction:column;gap:10px">
        <div style="display:flex;align-items:center;gap:12px">
          <div style="width:32px;height:32px;border-radius:50%;background:var(--sage);color:#fff;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:700;flex-shrink:0">1</div>
          <div><div style="font-size:13px;font-weight:600;color:var(--txt)">Today — Trial starts</div><div style="font-size:11px;color:var(--txt3)">Full access to all ${NAMES[plan]} features. No charge.</div></div>
        </div>
        <div style="width:1px;height:16px;background:var(--border);margin-left:16px"></div>
        <div style="display:flex;align-items:center;gap:12px">
          <div style="width:32px;height:32px;border-radius:50%;background:var(--terra);color:#fff;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:700;flex-shrink:0">2</div>
          <div><div style="font-size:13px;font-weight:600;color:var(--txt)">${trialEndStr} — Trial ends</div><div style="font-size:11px;color:var(--txt3)">First charge of <strong>${PRICES[plan]}</strong> — cancel before for free.</div></div>
        </div>
      </div>
    </div>
    <div style="font-size:11px;color:var(--txt3);margin-bottom:18px;text-align:center;line-height:1.5">✓ No charge today &nbsp;·&nbsp; ✓ Cancel anytime &nbsp;·&nbsp; ✓ No booking fees ever</div>
    <div class="modal-foot" style="flex-direction:column;gap:8px">
      <button class="btn btn-pri btn-w" style="font-size:14px;padding:14px" onclick="window.open('${checkoutUrl}','_blank');document.getElementById('trial-confirm-modal')?.remove()">Start Free Trial → No charge today</button>
      <button class="btn btn-ghost btn-w" onclick="document.getElementById('trial-confirm-modal')?.remove()">Cancel</button>
    </div>
  </div>`;
  document.body.appendChild(modal);
}

// ── INSTALLATION ENTRY POINT ─────────────────────────────────────
function csoInstallScalingFeatures(){
  // Feature 1: ensure milestone widget container exists in dashboard
  const dashPage=document.getElementById('page-dashboard');
  if(dashPage&&!document.getElementById('milestone-widget')){
    const gsCard=document.getElementById('getting-started-card');
    const div=document.createElement('div');div.id='milestone-widget';div.style.display='none';
    if(gsCard&&gsCard.parentNode)gsCard.parentNode.insertBefore(div,gsCard);
    else dashPage.prepend(div);
  }
  // Feature 3: install freeze renderer patch on renderPayouts
  _installFreezeRenderer();
  // Feature 4: override billing and stripe functions
  window.toggleBilling=toggleBillingEnhanced;
  window.openStripe=openStripeEnhanced;
  // Initial render of milestone widget
  if(typeof cData!=='undefined'&&cData)renderMilestoneWidget();
  console.log('[CSO] Scaling features v1 installed ✓');
}

// ════════════════════════════════════════════════════════════════
// END SCALING FEATURES
// ════════════════════════════════════════════════════════════════
