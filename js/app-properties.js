/* CSO Property Services — js/app-properties.js
   Split from app.js · DO NOT edit app.js directly
*/

//  PROPERTIES
// ════════════════════════════════════════════
const GRADS=['pi1','pi2','pi3','pi4','pi5','pi6'];
async function addProperty(){
  const name = sanitizeInput(document.getElementById('mp-name')?.value?.trim());
  if(!name){toast('Enter a property name');return;}
  const guard = canAddProperty();
  if(!guard.allowed) {
    closeModal('add-property-modal');
    showUpgradeModal(guard.reason, guard.nextTier);
    return;
  }
  const photo = await getPhotoData('mp-photo');
  const p={id:'p_'+Date.now(),name,emoji:sanitizeInput(document.getElementById('mp-emoji')?.value)||'🏡',location:sanitizeInput(document.getElementById('mp-loc')?.value)||'',description:sanitizeInput(document.getElementById('mp-desc')?.value)||'',rate:moneyNonNeg(parseFloat(document.getElementById('mp-rate')?.value)||100),maxGuests:parseInt(document.getElementById('mp-guests')?.value)||2,wifi:sanitizeInput(document.getElementById('mp-wifi')?.value)||'',wifiPw:sanitizeInput(document.getElementById('mp-wifipw')?.value)||'',doorCode:sanitizeInput(document.getElementById('mp-door')?.value)||'',parking:sanitizeInput(document.getElementById('mp-parking')?.value)||'',photo:photo||null,occupancy:Math.floor(Math.random()*25)+65,rating:(4.7+Math.random()*.3).toFixed(2),gradient:GRADS[cData.properties.length%6],propType:document.getElementById('mp-type')?.value||'str',monthlyRate:moneyNonNeg(parseFloat(document.getElementById('mp-monthly-rate')?.value)||0),minStay:parseInt(document.getElementById('mp-min-stay')?.value)||1,longStayDisc:parseInt(document.getElementById('mp-longstay-disc')?.value)||0,hibernated:false,created:Date.now()};
  cData.properties.push(p);saveUserData(cUid,cData);closeModal('add-property-modal');
  toast(sanitizeHTML(name)+' added!');
  renderAll();
}
function renderProperties(){
  if(!cData){return;}
  {
    const _pp=cData.properties||[];
    const _activePP = _pp.filter(p=>!p.hibernated); // exclude hibernated from stats
    const _bb=cData.bookings||[];
    const _set=(id,v)=>{const el=document.getElementById(id);if(el)el.textContent=v;};
    _set('prop-kpi-total',_pp.length);
    const _avgOcc=_activePP.length?Math.round(_activePP.reduce((s,p)=>s+(p.occupancy||0),0)/_activePP.length)+'%':'—';
    _set('prop-kpi-occ',_avgOcc);
    const _rated=_pp.filter(p=>p.rating);
    const _avgRat=_rated.length?(_rated.reduce((s,p)=>s+parseFloat(p.rating||0),0)/_rated.length).toFixed(2)+'★':'—';
    _set('prop-kpi-rating',_avgRat);
    const _rev=moneyRound(_bb.filter(b=>b.status!=='cancelled').reduce((s,b)=>moneyRound(s+moneyNonNeg(b.price)),0));
    _set('prop-kpi-rev','$'+_rev.toLocaleString());
  }

  const grid=document.getElementById('props-grid');
  const count=document.getElementById('props-count');
  if(!grid||!count){return;}
  const props=cData.properties||[];
  count.textContent=props.length+' propert'+(props.length===1?'y':'ies');

  if(!props.length){
    grid.innerHTML=`<div class="empty-state" style="grid-column:1/-1"><div class="es-i">🏠</div><h3>No properties yet</h3><button class="btn btn-pri" onclick="openModal('add-property-modal')" style="margin-top:10px">Add First</button></div>`;
    updateAddPropertyButton();
    return;
  }

  // ── Downgrade protection: determine which properties are accessible
  const guard = canAddProperty();
  const limit = getPlanPropertyLimit(cData.plan||'free');
  const activeProps = props.slice(0, limit);
  const lockedProps = props.slice(limit);

  const bookings=cData.bookings||[];
  const activeCards = activeProps.map(p=>{
    const bs=bookings.filter(b=>b.propId===p.id&&b.status!=='cancelled');
    // Exclude hibernated from active-seeming stats but still show the card
    const typeBadge = getPropTypeBadge(p.propType);
    const rateLabel = p.propType==='midterm' && p.monthlyRate
      ? `$${p.monthlyRate.toLocaleString()}/mo`
      : `$${p.rate}/night`;
    const minStayLabel = p.propType==='midterm' && p.minStay
      ? `<div class="prop-stat">🗓 <strong>${p.minStay}+ nights</strong></div>` : '';

    if(p.hibernated) {
      return `<div class="prop-card" style="opacity:.7;position:relative">
        <div class="prop-img ${p.gradient}" style="filter:grayscale(40%);${p.photo?'background-image:url('+p.photo+');background-size:cover;background-position:center;font-size:0':''}">
          <span style="font-size:32px">${p.photo?'':p.emoji}</span>
        </div>
        <div style="position:absolute;top:8px;left:8px;background:rgba(30,45,64,.85);color:#fff;font-size:10px;font-weight:700;padding:3px 9px;border-radius:20px;letter-spacing:.5px">🌙 HIBERNATING</div>
        <div class="prop-body">
          <div class="prop-name">${p.name}${typeBadge}</div>
          <div class="prop-loc">📍 ${p.location||'No location'}</div>
          <div style="font-size:11px;color:var(--txt3);margin-top:4px">Automations paused · Data preserved</div>
        </div>
        <div class="prop-foot">
          <button class="btn btn-ghost" style="width:100%;font-size:11px;padding:5px" onclick="event.stopPropagation();togglePropertyHibernate('${p.id}')">☀️ Reactivate</button>
        </div>
      </div>`;
    }

    return `<div class="prop-card" onclick="openPropertyDetail('${p.id}')">
      <div class="prop-img ${p.gradient}" style="${p.photo?'background-image:url('+p.photo+');background-size:cover;background-position:center;font-size:0':''}">
        <span style="font-size:32px">${p.photo?'':p.emoji}</span>
      </div>
      <div class="prop-body">
        <div class="prop-name">${p.name}${typeBadge}</div>
        <div class="prop-loc">📍 ${p.location||'No location'}</div>
        <div class="prop-stats">
          <div class="prop-stat">⭐ <strong>${p.rating}</strong></div>
          <div class="prop-stat">💰 <strong>${rateLabel}</strong></div>
          <div class="prop-stat">📅 <strong>${bs.length} stays</strong></div>
          ${minStayLabel}
        </div>
      </div>
      <div class="prop-foot">
        <span style="font-size:10px;color:var(--txt3)">${p.occupancy}%</span>
        <div class="occ-bar"><div class="occ-fill" style="width:${p.occupancy}%"></div></div>
        <span style="font-size:10px;color:var(--txt3)">occ.</span>
        <button onclick="event.stopPropagation();togglePropertyHibernate('${p.id}')" title="Hibernate property" style="background:none;border:none;cursor:pointer;font-size:14px;padding:0 2px;margin-left:4px;opacity:.5" title="Hibernate">🌙</button>
      </div>
    </div>`;
  });

  // Locked property cards — data preserved, not deleted
  const lockedCards = lockedProps.map(p=>`
    <div class="prop-card" style="opacity:.65;pointer-events:none;cursor:default;position:relative">
      <div class="prop-img ${p.gradient}" style="filter:grayscale(60%)">
        <span style="font-size:32px">${p.emoji}</span>
      </div>
      <!-- Lock overlay -->
      <div style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;background:rgba(0,0,0,.35);border-radius:14px;gap:6px">
        <div style="font-size:32px">🔒</div>
        <div style="font-size:11px;color:#fff;font-weight:700;text-align:center;padding:0 8px">Locked — Upgrade to unlock</div>
      </div>
      <div class="prop-body">
        <div class="prop-name">${p.name}</div>
        <div class="prop-loc">📍 ${p.location||'No location'}</div>
      </div>
      <div class="prop-foot" style="pointer-events:all">
        <button class="btn btn-pri" style="width:100%;font-size:11px;padding:6px" onclick="showUpgradeModal('Unlock ${p.name.replace(/'/g,'')} and all your properties.','${guard.nextTier}')">🔓 Reactivate</button>
      </div>
    </div>`);

  grid.innerHTML = [...activeCards, ...lockedCards].join('');
  updateAddPropertyButton();
}

// ── Update Add Property button state based on plan limit
function updateAddPropertyButton() {
  const guard = canAddProperty();
  const btns = document.querySelectorAll('[onclick*="add-property-modal"]');
  btns.forEach(function(btn) {
    if(!guard.allowed && !isAdmin) {
      btn.disabled = true;
      btn.style.opacity = '0.5';
      btn.style.cursor = 'not-allowed';
      btn.title = guard.reason;
      // Replace onclick with upgrade modal
      btn.setAttribute('onclick', `showUpgradeModal('${guard.reason}','${guard.nextTier}')`);
    } else {
      btn.disabled = false;
      btn.style.opacity = '';
      btn.style.cursor = '';
      btn.title = '';
      if(!btn.getAttribute('onclick')?.includes('add-property-modal')) {
        btn.setAttribute('onclick', "openModal('add-property-modal')");
      }
    }
  });
}

// ════════════════════════════════════════════
//  MID-TERM RENTAL — show/hide fields on type change
// ════════════════════════════════════════════
function onPropTypeChange() {
  const type = document.getElementById('mp-type')?.value;
  const fields = document.getElementById('mp-midterm-fields');
  if(fields) fields.style.display = (type==='midterm') ? 'block' : 'none';
}

// ════════════════════════════════════════════
//  SEASONAL HIBERNATE
// ════════════════════════════════════════════
function toggleEditHibernate() {
  const val = document.getElementById('ep-hibernate');
  const tog = document.getElementById('ep-hibernate-toggle');
  if(!val||!tog) return;
  const current = val.value==='true';
  val.value = current ? 'false' : 'true';
  tog.className = 'toggle '+(current?'off':'on');
}

function togglePropertyHibernate(propId) {
  const p = (cData.properties||[]).find(x=>x.id===propId);
  if(!p) return;
  p.hibernated = !p.hibernated;
  saveUserData(cUid,cData);
  renderProperties();
  toast(p.name+(p.hibernated?' 🌙 hibernated — automations paused':' ☀️ reactivated'));
}

// ════════════════════════════════════════════
//  PROPERTY TYPE HELPERS
// ════════════════════════════════════════════
const PROP_TYPE_LABELS = {
  str:{icon:'🏨',label:'STR'},midterm:{icon:'📅',label:'Mid-Term'},
  adu:{icon:'🏠',label:'ADU'},cabin:{icon:'🏔️',label:'Cabin'},
  residential:{icon:'🧹',label:'Residential'}
};

function getPropTypeBadge(propType) {
  const t = PROP_TYPE_LABELS[propType];
  if(!t||propType==='str') return '';
  return `<span style="background:var(--sand);border-radius:4px;padding:2px 6px;font-size:9px;color:var(--txt3);font-weight:700;margin-left:4px">${t.icon} ${t.label}</span>`;
}

// ════════════════════════════════════════════
//  CLEANING BUSINESS MODE
// ════════════════════════════════════════════
function isCleaningBusinessMode() {
  if(!cData) return false;
  return (cData.properties||[]).length===0 && ((cData.cleaners||[]).length>0||(cData.jobs||[]).length>0);
}

function renderCleaningBusinessDashboard() {
  const jobs=cData.jobs||[], cleaners=cData.cleaners||[], payouts=cData.payouts||[];
  const now=new Date(), today=now.toISOString().slice(0,10), thisMonth=now.toISOString().slice(0,7);
  const todayJobs=jobs.filter(j=>j.date===today);
  const openJobs=jobs.filter(j=>['open','assigned','in_progress'].includes(j.status));
  const doneMonth=jobs.filter(j=>j.status==='completed'&&j.date?.startsWith(thisMonth));
  const pendingPay=payouts.filter(p=>p.status==='verified');
  const pendingAmt=pendingPay.reduce((s,p)=>s+(p.owed||0),0);
  const monthFees=doneMonth.reduce((s,j)=>s+(j.platformFee||0),0);
  const badgeMap={background_check:'✅',insured:'🛡',turno_verified:'🔄',own_supplies:'🧴',reliable:'⭐'};
  const sc={open:'pill-amber',assigned:'pill-blue',in_progress:'pill-blue',completed:'pill-green',declined:'pill-red'};

  const dash=document.getElementById('page-dashboard');
  if(!dash) return;

  const html=`
    <div style="background:linear-gradient(135deg,var(--espresso),#1a2a3a);border-radius:14px;padding:20px 24px;margin-bottom:20px;display:flex;align-items:center;gap:16px">
      <div style="font-size:32px">🧹</div>
      <div style="flex:1">
        <div style="font-family:Fraunces,serif;font-size:18px;color:#fff;margin-bottom:3px">Cleaning Business Mode</div>
        <div style="font-size:12px;color:rgba(255,255,255,.6)">No properties yet — showing your cleaning operation. <a onclick="openModal('add-property-modal')" style="color:var(--terra-l);cursor:pointer;text-decoration:underline">Add a property</a> to switch to full host mode.</div>
      </div>
      <button class="btn btn-pri" style="flex-shrink:0;font-size:12px;padding:8px 14px" onclick="openModal('hire-cleaner-modal')">+ Post Job</button>
    </div>
    <div class="g4" style="margin-bottom:18px">
      <div class="kpi k1"><div class="kpi-label">Open Jobs</div><div class="kpi-val">${openJobs.length}</div><span class="delta up">${todayJobs.length} today</span></div>
      <div class="kpi k2"><div class="kpi-label">Available Cleaners</div><div class="kpi-val">${cleaners.filter(c=>c.available).length}</div><span class="delta up">of ${cleaners.length}</span></div>
      <div class="kpi k3"><div class="kpi-label">Done This Month</div><div class="kpi-val">${doneMonth.length}</div><span class="delta up">completed</span></div>
      <div class="kpi k4" style="border-left:3px solid var(--gold)"><div class="kpi-label">Platform Fees (Month)</div><div class="kpi-val" style="color:var(--gold)">$${Math.round(monthFees).toLocaleString()}</div><span class="delta up">your cut</span></div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 340px;gap:14px;margin-bottom:14px">
      <div class="card">
        <div class="card-hd"><div class="card-title">📋 Today's Jobs</div><button class="btn btn-ghost" style="font-size:11px;padding:4px 9px" onclick="nav('marketplace',document.querySelector('[onclick*=marketplace]'))">All →</button></div>
        <div class="card-body">${todayJobs.length===0
          ? '<div class="empty-state" style="padding:16px"><div class="es-i">📋</div><p>No jobs today</p><button class="btn btn-pri" onclick="openModal(\'hire-cleaner-modal\')" style="margin-top:8px">+ Post Job</button></div>'
          : todayJobs.map(j=>`<div class="row" style="cursor:default${j.heartbeatAlerted?';border-left:3px solid var(--terra);padding-left:10px':''}"><div class="row-info"><div class="row-title">${j.propName||'Job'} — ${j.cleanerName}${j.heartbeatAlerted?'<span style="color:var(--terra);font-size:10px;font-weight:700"> ⚠️ Late</span>':''}</div><div class="row-sub">${j.time||''} · ${j.type}</div></div><span class="pill ${sc[j.status]||'pill-amber'}" style="font-size:10px">${j.status.replace('_',' ')}</span><div class="row-price">$${j.pay}</div></div>`).join('')
        }</div>
      </div>
      <div class="card">
        <div class="card-hd"><div class="card-title">💳 Pending Payouts</div></div>
        <div class="card-body" style="padding-top:8px;text-align:center">
          <div style="font-family:Fraunces,serif;font-size:36px;color:${pendingAmt>0?'var(--terra)':'var(--txt3)'};padding:16px 0">$${Math.round(pendingAmt).toLocaleString()}</div>
          <div style="font-size:12px;color:var(--txt2);margin-bottom:12px">${pendingPay.length} verified job${pendingPay.length!==1?'s':''} awaiting payment</div>
          ${pendingAmt>0?`<button class="btn btn-pri btn-w" style="font-size:12px" onclick="nav('admin',document.querySelector('[onclick*=admin]'));setTimeout(()=>switchAdminTab&&switchAdminTab('payouts'),200)">View Payouts →</button>`:'<div style="font-size:12px;color:var(--txt3)">All caught up ✓</div>'}
        </div>
      </div>
    </div>
    <div class="card">
      <div class="card-hd"><div class="card-title">👥 Cleaner Roster</div><button class="btn btn-pri" style="font-size:11px;padding:4px 9px" onclick="openModal('add-cleaner-modal')">+ Add</button></div>
      <div class="card-body">${cleaners.length===0
        ? '<div class="empty-state" style="padding:16px"><div class="es-i">🧹</div><p>No cleaners yet</p><button class="btn btn-pri" onclick="openModal(\'add-cleaner-modal\')" style="margin-top:8px">Add Cleaner</button></div>'
        : cleaners.map(c=>{const cJobs=jobs.filter(j=>j.cleanerId===c.id||j.cleanerName===c.name);const badges=(c.badges||[]).map(b=>badgeMap[b]||'').filter(Boolean).join(' ');return `<div class="row" style="cursor:default"><div style="width:36px;height:36px;border-radius:50%;background:var(--terra);color:#fff;display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:700;flex-shrink:0">${c.name[0]}</div><div class="row-info"><div class="row-title">${c.name} ${badges?`<span style="font-size:13px">${badges}</span>`:''}</div><div class="row-sub">${c.area||'No area'} · $${c.rate}/hr · ${cJobs.length} jobs</div></div><span class="pill ${c.available?'pill-green':'pill-amber'}">${c.available?'Available':'Busy'}</span><div class="row-price" style="color:var(--sage)">⭐${c.rating}</div></div>`;}).join('')
      }</div>
    </div>`;

  dash.innerHTML = html;
}


function openPropertyDetail(propId) {
  const p = cData.properties.find(x=>x.id===propId);
  if(!p) return;
  const bookings = cData.bookings.filter(b=>b.propId===propId);
  const revenue = moneyRound(bookings.filter(b=>b.status!=='cancelled').reduce((s,b)=>moneyRound(s+moneyNonNeg(b.price)),0));

  // Populate edit modal
  document.getElementById('ep-id').value = p.id;
  document.getElementById('ep-name').value = p.name||'';
  document.getElementById('ep-emoji').value = p.emoji||'🏡';
  document.getElementById('ep-loc').value = p.location||'';
  document.getElementById('ep-desc').value = p.description||'';
  document.getElementById('ep-rate').value = p.rate||'';
  document.getElementById('ep-guests').value = p.maxGuests||'';
  document.getElementById('ep-wifi').value = p.wifi||'';
  document.getElementById('ep-wifipw').value = p.wifiPw||'';
  document.getElementById('ep-door').value = p.doorCode||'';
  document.getElementById('ep-parking').value = p.parking||'';
  const epNotes = document.getElementById('ep-notes');
  if(epNotes) epNotes.value = p.notes||'';

  // Hibernate toggle
  const hibVal = document.getElementById('ep-hibernate');
  const hibTog = document.getElementById('ep-hibernate-toggle');
  if(hibVal) hibVal.value = p.hibernated ? 'true' : 'false';
  if(hibTog) hibTog.className = 'toggle ' + (p.hibernated ? 'on' : 'off');
  // Load existing photos into gallery
  currentEditPropPhotos = [...(p.photos||[])];
  renderPropertyGallery();

  // Populate bookings list in modal
  const bList = document.getElementById('ep-bookings');
  if(bookings.length) {
    const spc={confirmed:'pill-green',pending:'pill-amber',completed:'pill-blue',cancelled:'pill-red'};
    bList.innerHTML = bookings.slice(0,5).map(b=>`
      <div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid var(--border)">
        <div style="flex:1"><div style="font-size:13px;font-weight:500;color:var(--txt)">${b.guestName}</div><div style="font-size:11px;color:var(--txt3)">${b.checkin||'TBD'} → ${b.checkout||'TBD'}</div></div>
        <span class="pill ${spc[b.status]||'pill-blue'}">${b.status}</span>
        <div style="font-family:Fraunces,serif;font-size:14px;font-weight:600;color:var(--txt)">$${b.price.toLocaleString()}</div>
      </div>`).join('');
  } else {
    bList.innerHTML = `<div style="font-size:13px;color:var(--txt3);padding:12px 0">No bookings yet for this property</div>`;
  }

  // Stats
  document.getElementById('ep-rev').textContent = '$'+revenue.toLocaleString();
  document.getElementById('ep-stays').textContent = bookings.filter(b=>b.status!=='cancelled').length;

  openModal('edit-property-modal');
}

// ════════════════════════════════════════════
//  BOOKINGS
// ════════════════════════════════════════════
function saveProperty() {
  const id = document.getElementById('ep-id').value;
  const p = cData.properties.find(x=>x.id===id);
  if(!p) return;
  p.name = document.getElementById('ep-name').value.trim()||p.name;
  p.emoji = document.getElementById('ep-emoji').value||'🏡';
  p.location = document.getElementById('ep-loc').value;
  p.description = document.getElementById('ep-desc').value;
  p.rate = moneyNonNeg(parseFloat(document.getElementById('ep-rate').value)||p.rate);
  p.maxGuests = parseInt(document.getElementById('ep-guests').value)||p.maxGuests;
  p.wifi = document.getElementById('ep-wifi').value;
  p.wifiPw = document.getElementById('ep-wifipw').value;
  p.doorCode = document.getElementById('ep-door').value;
  p.parking = document.getElementById('ep-parking').value;
  p.notes = document.getElementById('ep-notes')?.value||'';
  p.hibernated = document.getElementById('ep-hibernate')?.value === 'true';
  p.photos = [...currentEditPropPhotos];
  // Use first photo as main photo for property card
  p.photo = currentEditPropPhotos.length ? currentEditPropPhotos[0].data : (p.photo||null);
  saveUserData(cUid,cData);
  closeModal('edit-property-modal');
  toast(`"${p.name}" updated! ✓`);
  renderAll();
}

function deleteProperty() {
  const id = document.getElementById('ep-id').value;
  const p = cData.properties.find(x=>x.id===id);
  if(!p) return;
  if(!confirm(`Delete "${p.name}"? This cannot be undone.`)) return;
  cData.properties = cData.properties.filter(x=>x.id!==id);
  saveUserData(cUid,cData);
  closeModal('edit-property-modal');
  toast(`"${p.name}" deleted`);
  renderAll();
}
// ════════════════════════════════════════════
//  EMAIL NOTIFICATIONS
// ════════════════════════════════════════════
async function sendNotification(type, data) {
  try {
    const hostEmail = cUser?.email;
    if(!hostEmail) { return; }
    const res = await fetch('https://vdnyqwpznsysrvyvbqga.supabase.co/functions/v1/send-notification', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({ type, hostEmail, data }),
    });
    const result = await res.json();
    // notification sent
  } catch(e) {
    console.error('Notification error:', e.message);
  }
}

async function sendEmail(toOrOpts, subject, body) {
  const opts = typeof toOrOpts === 'object' && toOrOpts !== null ? toOrOpts : { to: toOrOpts, subject, body };
  const to = opts.to || opts.hostEmail || cUser?.email;
  if (!to) return;
  try {
    await fetch('https://vdnyqwpznsysrvyvbqga.supabase.co/functions/v1/send-notification', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${SUPABASE_ANON_KEY}` },
      body: JSON.stringify({ type: 'email', hostEmail: to, data: { subject: opts.subject || subject || '', body: opts.body || body || '', html: opts.html } }),
    });
  } catch (e) {
    console.error('sendEmail:', e.message);
  }
}

const showToast = (msg, _dur) => { toast(msg); };

function addBooking(){
