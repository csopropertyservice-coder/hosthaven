/* CSO Property Services — js/app-dashboard.js
   Split from app.js · DO NOT edit app.js directly
*/

// Returns { allowed: bool, reason: string, nextTier: string }
function canAddProperty() {
  if(isAdmin) return { allowed: true };
  const plan = cData?.plan || 'free';
  const limit = getPlanPropertyLimit(plan);
  const count = (cData?.properties || []).length;

  if(count < limit) return { allowed: true };

  const next = PLAN_NEXT_TIER[plan] || 'pro';
  const nextName = PLAN_NAMES[next] || 'Pro';
  const nextPrice = PLAN_PRICES[next] || '$79';

  return {
    allowed: false,
    reason: `You've reached your ${count}-property limit on the ${PLAN_NAMES[plan]} plan.`,
    nextTier: next,
    cta: `Upgrade to ${nextName} (${nextPrice}/mo) for ${next === 'business' || next === 'cohost' ? 'unlimited' : '10'} properties`
  };
}

// ── Enhanced checkTrialStatus — syncs expiry to Supabase profiles
async function checkTrialStatus() {
  if(!cData) return;
  const plan = cData.plan;
  if(plan !== 'free' && plan !== 'trial') return; // already paid, skip

  if(cData.trialStarted && !cData.trialUsed) {
    const daysSince = (Date.now() - cData.trialStarted) / (1000*60*60*24);
    const daysLeft = Math.max(0, Math.ceil(14 - daysSince));

    if(daysSince <= 14) {
      // Trial still active
      cData.plan = 'trial';
      const pill = document.getElementById('sb-plan');
      if(pill) pill.textContent = '🎯 Trial';
      showTrialBanner(daysLeft);

      // Sync is_trial_active to Supabase profiles
      if(cUid) {
        sb.from('profiles').update({
          is_trial_active: true,
          trial_start_date: new Date(cData.trialStarted).toISOString(),
          trial_expires_at: new Date(cData.trialStarted + 14*86400000).toISOString(),
          subscription_tier: 'trial',
          plan: 'trial',
          updated_at: new Date().toISOString()
        }).eq('id', cUid).catch(e => sbHandleError(e, 'trial sync'));
      }

    } else {
      // Trial expired
      cData.trialUsed = true;
      cData.plan = 'free';
      saveUserData(cUid, cData);

      const pill = document.getElementById('sb-plan');
      if(pill) pill.textContent = '⭐ Free';

      // Sync expiry to Supabase
      if(cUid) {
        sb.from('profiles').update({
          is_trial_active: false,
          subscription_tier: 'free',
          plan: 'free',
          updated_at: new Date().toISOString()
        }).eq('id', cUid).catch(e => sbHandleError(e, 'trial expiry sync'));
      }

      showTrialBanner(0); // Show expired state
      updateAddPropertyButton();
      renderProperties(); // Re-render with locked cards if needed
    }
  }
}

// ── Trial countdown banner
function showTrialBanner(daysLeft) {
  const banner = document.getElementById('trial-banner');
  if(!banner) return;

  if(daysLeft > 0) {
    const urgency = daysLeft <= 3 ? 'var(--terra)' : daysLeft <= 7 ? 'var(--gold)' : 'var(--sage)';
    const urgencyBg = daysLeft <= 3 ? 'rgba(196,105,58,.08)' : daysLeft <= 7 ? 'rgba(200,168,75,.08)' : 'rgba(107,143,113,.08)';
    const urgencyBorder = daysLeft <= 3 ? 'var(--terra-l)' : daysLeft <= 7 ? 'var(--gold)' : 'var(--sage)';
    banner.style.display = 'block';
    banner.innerHTML = `
      <div style="display:flex;align-items:center;gap:12px;background:${urgencyBg};border:1px solid ${urgencyBorder};border-radius:10px;padding:11px 16px">
        <div style="font-size:18px;flex-shrink:0">${daysLeft <= 3 ? '⚠️' : '🎯'}</div>
        <div style="flex:1">
          <span style="font-size:13px;font-weight:600;color:${urgency}">${daysLeft} day${daysLeft!==1?'s':''} remaining in your Pro Trial</span>
          <span style="font-size:12px;color:var(--txt2);margin-left:8px">All features unlocked until ${new Date(cData.trialStarted + 14*86400000).toLocaleDateString()}</span>
        </div>
        <button onclick="showUpgradeModal('Lock in your Pro features before your trial ends.','pro')" class="btn btn-pri" style="font-size:11px;padding:5px 12px;flex-shrink:0">Upgrade Now →</button>
        <button onclick="document.getElementById('trial-banner').style.display='none'" style="background:none;border:none;color:var(--txt3);cursor:pointer;font-size:16px;padding:2px 4px;flex-shrink:0">✕</button>
      </div>`;
  } else if(cData.trialUsed) {
    // Expired state
    banner.style.display = 'block';
    banner.innerHTML = `
      <div style="display:flex;align-items:center;gap:12px;background:rgba(196,105,58,.08);border:1px solid var(--terra-l);border-radius:10px;padding:11px 16px">
        <div style="font-size:18px;flex-shrink:0">⏰</div>
        <div style="flex:1">
          <span style="font-size:13px;font-weight:600;color:var(--terra)">Your Pro Trial has ended</span>
          <span style="font-size:12px;color:var(--txt2);margin-left:8px">You're now on Free (1 property). Your data is safe.</span>
        </div>
        <button onclick="showUpgradeModal('Reactivate Pro to unlock all your properties and features.','pro')" class="btn btn-pri" style="font-size:11px;padding:5px 12px;flex-shrink:0">Reactivate →</button>
      </div>`;
  } else {
    banner.style.display = 'none';
  }
}

// ── Enhanced showUpgradeModal with next-tier CTA
function showUpgradeModal(reason, nextTier) {
  const el = document.getElementById('upgrade-modal-reason');
  const plan = cData?.plan || 'free';
  const tier = nextTier || PLAN_NEXT_TIER[plan] || 'pro';

  if(el) el.innerHTML = reason ||'Upgrade to unlock more features.';

  // Update modal CTA buttons to highlight the recommended tier
  const modal = document.getElementById('upgrade-modal');
  if(modal) {
    const btns = modal.querySelectorAll('.btn-w, .btn-pri, .btn-ghost');
    btns.forEach(function(btn) {
      const btnTier = btn.getAttribute('onclick')?.match(/openStripe\('([^']+)'\)/)?.[1];
      if(btnTier === tier) {
        btn.style.outline = '2px solid var(--gold)';
        btn.style.outlineOffset = '2px';
        // Add recommended label
        if(!btn.querySelector('.rec-badge')) {
          const badge = document.createElement('span');
          badge.className = 'rec-badge';
          badge.style.cssText = 'background:var(--gold);color:#2C1F14;font-size:9px;font-weight:800;padding:1px 5px;border-radius:4px;margin-left:8px;vertical-align:middle;letter-spacing:.5px';
          badge.textContent = 'RECOMMENDED';
          btn.appendChild(badge);
        }
      } else {
        btn.style.outline = '';
        btn.style.outlineOffset = '';
        const existing = btn.querySelector('.rec-badge');
        if(existing) existing.remove();
      }
    });
  }

  openModal('upgrade-modal');
}

function startTrial() {
  if(cData.trialStarted) { toast('Trial already used!'); return; }
  cData.trialStarted = Date.now();
  cData.plan = 'trial';
  saveUserData(cUid, cData);
  document.getElementById('sb-plan').textContent = '🎯 Pro Trial';
  toast('🎉 14-day Pro trial started! Enjoy all features.');
  // Sync to Supabase
  if(cUid) {
    sb.from('profiles').update({
      is_trial_active: true,
      trial_start_date: new Date(cData.trialStarted).toISOString(),
      trial_expires_at: new Date(cData.trialStarted + 14*86400000).toISOString(),
      subscription_tier: 'trial',
      plan: 'trial',
      updated_at: new Date().toISOString()
    }).eq('id', cUid).catch(e => sbHandleError(e, 'startTrial sync'));
  }
  renderAll();
  showTrialBanner(14);
}

// ════════════════════════════════════════════
//  BOOKING CALENDAR
// ════════════════════════════════════════════
let calYear = new Date().getFullYear();
let calMonth = new Date().getMonth();

function filterBook(f, el) {
  bookFilter = f;
  document.querySelectorAll('[id^=bf-]').forEach(b=>{b.className='btn btn-ghost'; b.style.background='';});
  el.className='btn btn-pri'; el.style.background='var(--espresso)';
  const listEl = document.getElementById('bookings-list');
  const calEl = document.getElementById('bookings-calendar');
  if(f === 'calendar') {
    if(listEl) listEl.style.display='none';
    if(calEl) calEl.style.display='block';
    renderBookingCalendar();
  } else {
    if(listEl) listEl.style.display='block';
    if(calEl) calEl.style.display='none';
    renderBookings();
  }
}

function changeCalMonth(dir) {
  calMonth += dir;
  if(calMonth > 11) { calMonth = 0; calYear++; }
  if(calMonth < 0) { calMonth = 11; calYear--; }
  renderBookingCalendar();
}

function renderBookingCalendar() {
  const grid = document.getElementById('cal-grid');
  const title = document.getElementById('cal-month-title');
  if(!grid) return;

  const monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  if(title) title.textContent = monthNames[calMonth] + ' ' + calYear;

  const firstDay = new Date(calYear, calMonth, 1).getDay();
  const daysInMonth = new Date(calYear, calMonth+1, 0).getDate();
  const today = new Date();

  let html = '';
  for(let i=0; i<firstDay; i++) {
    html += `<div style="aspect-ratio:1"></div>`;
  }

  for(let d=1; d<=daysInMonth; d++) {
    // Use local date string to avoid timezone issues
    const dateStr = calYear+'-'+String(calMonth+1).padStart(2,'0')+'-'+String(d).padStart(2,'0');
    const dayBookings = cData.bookings.filter(b => {
      if(!b.checkin || !b.checkout || b.status==='cancelled') return false;
      // Compare as strings to avoid timezone offset issues
      return b.checkin <= dateStr && b.checkout > dateStr;
    });
    const isToday = today.getDate()===d && today.getMonth()===calMonth && today.getFullYear()===calYear;
    const hasBooking = dayBookings.length > 0;
    const bg = hasBooking ? 'var(--terra)' : 'var(--sand)';
    const color = hasBooking ? '#fff' : 'var(--txt2)';
    const outline = isToday ? 'outline:2px solid var(--gold);outline-offset:1px;' : '';
    html += `<div onclick="showCalDay('${dateStr}')" style="aspect-ratio:1;border-radius:6px;background:${bg};color:${color};display:flex;flex-direction:column;align-items:center;justify-content:center;cursor:pointer;transition:opacity .15s;${outline}font-size:12px;font-weight:${isToday?'700':'500'}" onmouseover="this.style.opacity='.8'" onmouseout="this.style.opacity='1'">
      <div>${d}</div>
      ${hasBooking ? `<div style="font-size:8px;opacity:.85">${dayBookings.length} stay${dayBookings.length>1?'s':''}</div>` : ''}
    </div>`;
  }
  grid.innerHTML = html;

  const detail = document.getElementById('cal-day-detail');
  if(detail) detail.style.display = 'none';
}

function showCalDay(dateStr) {
  const detail = document.getElementById('cal-day-detail');
  const dayTitle = document.getElementById('cal-day-title');
  const dayBookings = document.getElementById('cal-day-bookings');
  if(!detail) return;

  const bookingsOnDay = cData.bookings.filter(b => {
    if(!b.checkin || !b.checkout || b.status==='cancelled') return false;
    return b.checkin <= dateStr && b.checkout > dateStr;
  });

  // Parse date without timezone issues
  const parts = dateStr.split('-');
  const d = new Date(parseInt(parts[0]), parseInt(parts[1])-1, parseInt(parts[2]));
  if(dayTitle) dayTitle.textContent = d.toLocaleDateString('default',{weekday:'long',month:'long',day:'numeric',year:'numeric'});

  if(!bookingsOnDay.length) {
    if(dayBookings) dayBookings.innerHTML = `<div style="font-size:13px;color:var(--txt3);padding:8px 0">No bookings on this day — available!</div>`;
  } else {
    const spc={confirmed:'pill-green',pending:'pill-amber',completed:'pill-blue'};
    if(dayBookings) dayBookings.innerHTML = bookingsOnDay.map(b=>`
      <div style="display:flex;align-items:center;gap:10px;padding:9px 0;border-bottom:1px solid var(--border)">
        <div style="font-size:18px">${b.propEmoji||'🏠'}</div>
        <div style="flex:1">
          <div style="font-size:13px;font-weight:500;color:var(--txt)">${b.propName} — ${b.guestName}</div>
          <div style="font-size:11px;color:var(--txt3)">${b.checkin} → ${b.checkout} · ${b.numGuests} guests</div>
        </div>
        <span class="pill ${spc[b.status]||'pill-blue'}">${b.status}</span>
        <div style="font-family:Fraunces,serif;font-size:14px;font-weight:600;color:var(--txt)">$${b.price.toLocaleString()}</div>
      </div>`).join('');
  }
  detail.style.display = 'block';
}
function renderBookings(){
  const list=document.getElementById('bookings-list');
  let bs=[...cData.bookings];
  if(bookFilter!=='all'&&bookFilter!=='calendar')bs=bs.filter(b=>b.status===bookFilter);
  bs.sort((a,b)=>b.created-a.created);
  if(!bs.length){list.innerHTML=`<div class="empty-state"><div class="es-i">📅</div><h3>No bookings</h3><button class="btn btn-pri" onclick="openModal('add-booking-modal')" style="margin-top:10px">Add Booking</button></div>`;return;}
  const spc={confirmed:'pill-green',pending:'pill-amber',completed:'pill-blue',cancelled:'pill-red'};
  list.innerHTML=bs.map(b=>`
    <div class="row">
      <div class="row-thumb ${b.propGradient||'pi1'}">${b.propEmoji||'🏠'}</div>
      <div class="row-info"><div class="row-title">${b.propName} — ${b.guestName}</div><div class="row-sub">👤 ${b.numGuests} guests · ${b.nights}n · ${b.source}${b.leadType?` · <span style="background:var(--sand);border-radius:3px;padding:1px 5px;font-size:9px;color:var(--txt2)">${b.leadType.replace('_',' ')}</span>`:''}</div>${b.cleaningWindow?.windowLabel?`<div style="font-size:10px;margin-top:2px;color:${b.cleaningWindow.tight?'var(--terra)':'var(--sage)'}">${b.cleaningWindow.windowLabel}</div>`:''}</div>
      <span class="pill ${spc[b.status]||'pill-blue'}">${b.status}</span>
      ${b.photos?.length?`<button class="btn btn-ghost" style="font-size:10px;padding:3px 8px;flex-shrink:0" onclick="event.stopPropagation();viewBookingPhotos('${b.id}')">📸 ${b.photos.length}</button>`:''}
      <div style="text-align:right"><div class="row-price">$${b.price.toLocaleString()}</div><div class="row-date">${b.checkin||'TBD'} → ${b.checkout||'TBD'}</div></div>
      <div style="display:flex;gap:4px;flex-shrink:0">
        <button class="btn btn-ghost" style="font-size:10px;padding:4px 9px" onclick="event.stopPropagation();openEditBooking('${b.id}')">✏️ Edit</button>
        <button class="btn btn-ghost" style="font-size:10px;padding:4px 9px;color:var(--terra)" onclick="event.stopPropagation();deleteBooking('${b.id}','${b.guestName}')">🗑</button>
      </div>
    </div>`).join('');
}

function deleteBooking(id, guestName) {
  if(!confirm(`Delete booking for ${guestName}? This cannot be undone.`)) return;
  cData.bookings = cData.bookings.filter(b=>b.id!==id);
  saveUserData(cUid, cData);
  toast(`Booking for ${guestName} deleted`);
  renderAll();
  if(bookFilter==='calendar') renderBookingCalendar();
}

function openEditBooking(id) {
  const b = cData.bookings.find(x=>x.id===id);
  if(!b) return;
  // Populate dropdowns
  const propSel = document.getElementById('mb-prop');
  if(propSel) propSel.innerHTML = cData.properties.map(p=>`<option value="${p.id}" ${p.id===b.propId?'selected':''}>${p.emoji} ${p.name}</option>`).join('');
  document.getElementById('mb-guest').value = b.guestName||'';
  document.getElementById('mb-email').value = b.guestEmail||'';
  document.getElementById('mb-cin').value = b.checkin||'';
  document.getElementById('mb-cout').value = b.checkout||'';
  document.getElementById('mb-nguests').value = b.numGuests||2;
  document.getElementById('mb-price').value = b.price||0;
  document.getElementById('mb-status').value = b.status||'confirmed';
  document.getElementById('mb-source').value = b.source||'airbnb';
  const mbNotes = document.getElementById('mb-notes');
  if(mbNotes) mbNotes.value = b.notes||'';
  // Change modal title and button to edit mode
  const modal = document.querySelector('#add-booking-modal h2');
  if(modal) modal.textContent = '✏️ Edit Booking';
  const saveBtn = document.querySelector('#add-booking-modal .btn-pri');
  if(saveBtn) { saveBtn.textContent = 'Save Changes'; saveBtn.onclick = ()=>saveEditBooking(id); }
  document.getElementById('add-booking-modal').classList.add('open');
}

function saveEditBooking(id) {
  const b = cData.bookings.find(x=>x.id===id);
  if(!b) return;
  const propId = document.getElementById('mb-prop').value;
  const prop = cData.properties.find(p=>p.id===propId);
  const cin = document.getElementById('mb-cin').value;
  const cout = document.getElementById('mb-cout').value;
  b.propId = propId;
  b.propName = prop?.name||b.propName;
  b.propEmoji = prop?.emoji||b.propEmoji;
  b.propGradient = prop?.gradient||b.propGradient;
  b.guestName = document.getElementById('mb-guest').value.trim()||b.guestName;
  b.guestEmail = document.getElementById('mb-email').value;
  b.checkin = cin;
  b.checkout = cout;
  b.nights = cin&&cout?Math.max(1,Math.round((new Date(cout)-new Date(cin))/86400000)):b.nights;
  b.numGuests = parseInt(document.getElementById('mb-nguests').value)||b.numGuests;
  b.price = moneyNonNeg(parseFloat(document.getElementById('mb-price').value)||b.price);
  b.status = document.getElementById('mb-status').value;
  b.source = document.getElementById('mb-source').value;
  b.notes = document.getElementById('mb-notes')?.value||'';
  saveUserData(cUid,cData);
  closeModal('add-booking-modal');
  // Reset modal back to add mode
  const modal = document.querySelector('#add-booking-modal h2');
  if(modal) modal.textContent = '📅 Add Booking';
  const saveBtn = document.querySelector('#add-booking-modal .btn-pri');
  if(saveBtn) { saveBtn.textContent = 'Add Booking'; saveBtn.onclick = addBooking; }
  toast('Booking updated! ✓');
  // Trigger review automation if marked complete
  if(b.status==='completed') onBookingCompleted(b);
  renderAll();
  if(bookFilter==='calendar') renderBookingCalendar();
}

// ════════════════════════════════════════════
//  MESSAGES + AI
// ════════════════════════════════════════════
function addConversation(){
  const name=document.getElementById('mm-name').value.trim();
  const msg=document.getElementById('mm-msg').value.trim();
  if(!name||!msg){toast('Fill in name and message');return;}
  const propId=document.getElementById('mm-prop').value;
  const prop=cData.properties.find(p=>p.id===propId);
  const bookingId=document.getElementById('mm-booking')?.value||'';
  const booking=cData.bookings.find(b=>b.id===bookingId);
  const cols=[['#F5E6D3','#C4693A'],['#D3E8E0','#4A7D50'],['#D3DCE8','#2E4460'],['#E8D3D3','#8B3A3A'],['#E8E3D3','#6B5A2E']];
  const c=cols[cData.messages.length%cols.length];
  const conv={id:'c_'+Date.now(),guestName:name,propId,propName:prop?.name||'',bookingId:bookingId||null,checkin:booking?.checkin||null,checkout:booking?.checkout||null,initials:name.split(' ').map(n=>n[0]).join('').toUpperCase().slice(0,2),avatarBg:c[0],avatarColor:c[1],messages:[{role:'guest',text:msg,time:new Date().toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}],unread:true,created:Date.now()};
  cData.messages.push(conv);saveUserData(cUid,cData);closeModal('add-message-modal');
  document.getElementById('mm-name').value='';document.getElementById('mm-msg').value='';
  toast('Conversation started!');renderMessages();updateBadges();
  sendNotification('new_message', {
    guestName: name,
    propName: prop?.name||'your property',
    message: msg
  });
}
function renderMessages(){
  if(!cData||!cData.messages){return;}
  const list=document.getElementById('msg-conv-list');
  if(!list){return;}
  const convs=[...cData.messages].sort((a,b)=>b.created-a.created);
  if(!convs.length){list.innerHTML=`<div class="empty-state" style="padding:24px 10px"><div class="es-i">💬</div><p style="font-size:12px">No conversations</p></div>`;return;}
  list.innerHTML=convs.map(c=>{
    const msgs=c.messages||[];
    const last=msgs.length?msgs[msgs.length-1]:{text:''};
    const raw=(last.text||'');
    const prev=raw.length>44?raw.substring(0,44)+'…':raw;
    return `<div class="msg-li${activeConvId===c.id?' active':''}" id="cli-${c.id}" onclick="openConv('${c.id}')"><div class="msg-av" style="background:${c.avatarBg};color:${c.avatarColor}">${c.initials||'?'}</div><div style="flex:1;min-width:0"><div class="msg-li-name" style="font-weight:${c.unread?'700':'500'}">${c.guestName||'Guest'}</div><div class="msg-li-prev">${prev}</div></div>${c.unread?`<div style="width:6px;height:6px;background:var(--terra);border-radius:50%;flex-shrink:0;margin-top:4px"></div>`:''}</div>`;
  }).join('');
}
function openConv(id){
  activeConvId=id;const c=cData.messages.find(m=>m.id===id);if(!c)return;
  c.unread=false;saveUserData(cUid,cData);renderMessages();updateBadges();
  const panel=document.getElementById('msg-detail-panel');
  panel.innerHTML=`
    <div class="msg-detail-hd">
      <div class="msg-av" style="width:38px;height:38px;background:${c.avatarBg};color:${c.avatarColor};font-size:13px">${c.initials}</div>
      <div style="flex:1"><div style="font-size:14px;font-weight:500;font-family:Fraunces,serif;color:var(--txt)">${c.guestName}</div><div style="font-size:11px;color:var(--txt3)">${c.propName||'No property'}${c.checkin?' · '+c.checkin+' → '+c.checkout:''}</div></div>
      <button class="btn btn-ghost" style="font-size:11px;padding:5px 10px" onclick="openSMSModal('${id}')">📱 Send SMS</button>
    </div>
    <div class="chat-area" id="ca-${id}">
      ${c.messages.map(m=>`<div style="display:flex;flex-direction:column;align-items:${m.role==='host'?'flex-end':'flex-start'}"><div class="bubble ${m.role}">${m.text}</div><div class="bubble-time" style="text-align:${m.role==='host'?'right':'left'};padding:0 3px">${m.role==='host'?'You':'Guest'} · ${m.time||''}</div></div>`).join('')}
    </div>
    <div class="msg-input-area">
      <div class="ai-status" id="ai-st-${id}"></div>
      <div class="ai-bar">
        <button class="ai-btn" onclick="aiDraft('${id}','reply')">🤖 AI Reply</button>
        <button class="ai-btn" onclick="aiDraft('${id}','checkin')">🔑 Check-in</button>
        <button class="ai-btn" onclick="aiDraft('${id}','tips')">🍽️ Local Tips</button>
        <button class="ai-btn" onclick="aiDraft('${id}','rules')">📋 Rules</button>
      </div>
      <div class="msg-row">
        <textarea class="msg-ta" id="ta-${id}" placeholder="Type reply…" rows="2"></textarea>
        <button class="btn btn-pri" onclick="sendMsg('${id}')">Send ↑</button>
      </div>
    </div>`;
  const area=document.getElementById('ca-'+id);if(area)area.scrollTop=area.scrollHeight;
}

function openSMSModal(convId) {
  const c = cData.messages.find(m=>m.id===convId);
  if(!c) return;
  const ta = document.getElementById('ta-'+convId);
  const draft = ta?.value?.trim() || '';
  // Create SMS modal dynamically
  const existing = document.getElementById('sms-modal-dynamic');
  if(existing) existing.remove();
  const div = document.createElement('div');
  div.id = 'sms-modal-dynamic';
  div.className = 'modal-bg open';
  div.innerHTML = `<div class="modal">
    <h2>📱 Send SMS to ${c.guestName}</h2>
    <div style="font-size:13px;color:var(--txt2);margin-bottom:14px;line-height:1.5">Send a text message directly to your guest's phone.</div>
    <div class="fi"><label>Guest Phone Number</label><input id="sms-phone" type="tel" placeholder="+1 555 000 0000" value="${c.guestPhone||''}"></div>
    <div class="fi"><label>Message</label><textarea id="sms-body" style="min-height:80px">${draft||'Hi '+c.guestName+'! '}</textarea></div>
    <div style="font-size:11px;color:var(--txt3);margin-bottom:8px" id="sms-char-count">0 / 160 characters</div>
    <div class="auth-err" id="sms-err"></div>
    <div class="auth-err" id="sms-success" style="display:none;background:rgba(107,143,113,.15);border-color:var(--sage);color:var(--sage)"></div>
    <div class="modal-foot">
      <button class="btn btn-ghost" onclick="document.getElementById('sms-modal-dynamic').remove()">Cancel</button>
      <button class="btn btn-pri" onclick="sendSMS('${convId}')">📱 Send SMS</button>
    </div>
  </div>`;
  document.body.appendChild(div);
  // Character counter
  const bodyEl = document.getElementById('sms-body');
  const countEl = document.getElementById('sms-char-count');
  bodyEl.addEventListener('input', ()=>{
    const len = bodyEl.value.length;
    countEl.textContent = `${len} / 160 characters`;
    countEl.style.color = len > 160 ? 'var(--terra)' : 'var(--txt3)';
  });
  bodyEl.dispatchEvent(new Event('input'));
}

async function sendSMS(convId) {
  const c = cData.messages.find(m=>m.id===convId);
  const phone = document.getElementById('sms-phone').value.trim();
  const message = document.getElementById('sms-body').value.trim();
  const errEl = document.getElementById('sms-err');
  const sucEl = document.getElementById('sms-success');
  const btn = document.querySelector('#sms-modal-dynamic .btn-pri');

  if(!phone){if(errEl){errEl.textContent='Enter a phone number';errEl.style.display='block';}return;}
  if(!message){if(errEl){errEl.textContent='Enter a message';errEl.style.display='block';}return;}

  if(btn){btn.textContent='Sending…';btn.disabled=true;}
  if(errEl) errEl.style.display='none';

  try {
    const res = await fetch('https://vdnyqwpznsysrvyvbqga.supabase.co/functions/v1/send-sms', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({ to: phone, message }),
    });
    const result = await res.json();
    if(result.ok) {
      // Save phone to conversation
      if(c) { c.guestPhone = phone; saveUserData(cUid, cData); }
      if(sucEl){sucEl.textContent=`✓ SMS sent to ${phone}!`;sucEl.style.display='block';}
      if(btn){btn.textContent='Sent! ✓';btn.style.background='var(--sage)';}
      setTimeout(()=>document.getElementById('sms-modal-dynamic')?.remove(), 2000);
    } else {
      const errMsg = result.data?.message || 'Failed to send SMS. Check the phone number.';
      if(errEl){errEl.textContent=errMsg;errEl.style.display='block';}
      if(btn){btn.textContent='📱 Send SMS';btn.disabled=false;}
    }
  } catch(e) {
    if(errEl){errEl.textContent='Error: '+e.message;errEl.style.display='block';}
    if(btn){btn.textContent='📱 Send SMS';btn.disabled=false;}
  }
}
async function aiDraft(convId,type){
  const c=cData.messages.find(m=>m.id===convId);if(!c)return;
  const st=document.getElementById('ai-st-'+convId);const ta=document.getElementById('ta-'+convId);
  document.querySelectorAll('.ai-btn').forEach(b=>b.classList.add('loading'));
  st.innerHTML=`<div class="spinner"></div> Claude is drafting…`;
  const lastGuest=[...c.messages].reverse().find(m=>m.role==='guest')?.text||'';
  const prop=cData.properties.find(p=>p.id===c.propId);
  const userName = cUser?.name || 'Your Host';
  const prompts={
    reply:`You are ${userName}, a warm Airbnb host. Guest ${c.guestName} at ${c.propName||'your property'} wrote: "${lastGuest}". Write a friendly, helpful 2-4 sentence reply. Sign off naturally.`,
    checkin:`You are ${userName}. Write a warm check-in message for ${c.guestName} at ${prop?.name||'the property'}. Door code: ${prop?.doorCode||'[code]'}, WiFi: ${prop?.wifi||'[name]'} / ${prop?.wifiPw||'[pw]'}, Parking: ${prop?.parking||'see listing'}. Keep it under 5 sentences.`,
    tips:`You are a friendly local Airbnb host named ${userName}. Recommend 2-3 local restaurants and 1-2 activities near ${prop?.name||'your property'} to ${c.guestName}. Sound like a local friend.`,
    rules:`You are ${userName}. Write a friendly house rules reminder to ${c.guestName}: no smoking, no parties, quiet 10pm-8am. Keep it warm and brief.`
  };
  const fb={
    reply:`Hi ${c.guestName}! Thanks for reaching out — happy to help! ${lastGuest.toLowerCase().includes('early')?'Early check-in around 1pm should work perfectly!':'Let me know how I can assist.'} Looking forward to hosting you! 😊`,
    checkin:`Hi ${c.guestName}! Excited for your stay at ${prop?.name||'the property'}! 🔑 Door: ${prop?.doorCode||'[see confirmation]'} | WiFi: ${prop?.wifi||'[see welcome book]'} / ${prop?.wifiPw||''} | Parking: ${prop?.parking||'see listing'}. Check-in after 3pm, checkout by 11am. Message me anytime!`,
    tips:`Hi ${c.guestName}! For food: 🍳 Morning Plate (amazing brunch nearby), 🍝 Nonna's Kitchen (best pasta in the area), ☕ Grounds & Grains (my daily coffee spot). For activities — the weekend farmers market on Main St is a must! Enjoy ✨`,
    rules:`Hi ${c.guestName}! Quick friendly note — quiet hours after 10pm, no smoking indoors, and please keep guests to the listed count. Other than that, make yourself completely at home! 🏡`
  };
  try{
    const res = await fetch('https://vdnyqwpznsysrvyvbqga.supabase.co/functions/v1/ai-draft',{
      method:'POST',
      headers:{
        'Content-Type':'application/json',
        'Authorization':'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZkbnlxd3B6bnN5c3J2eXZicWdhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ2NjM4NjUsImV4cCI6MjA5MDIzOTg2NX0.VxwNE_lMR2JV_70SVr9rio_UgfbKGnYFyeitkTuWYkM'
      },
      body:JSON.stringify({prompt:prompts[type]})
    });
    const data=await res.json();
    if(data.error) throw new Error(data.error);
    ta.value=data.text||fb[type];
    st.innerHTML=`<span style="color:var(--sage)">✓ Ready — edit before sending</span>`;
  } catch(e){
    st.innerHTML=`<span style="color:var(--gold)">⚡ Demo draft</span>`;
    ta.value=fb[type];
  }
  document.querySelectorAll('.ai-btn').forEach(b=>b.classList.remove('loading'));
}
function sendMsg(convId){
  const ta=document.getElementById('ta-'+convId);const text=ta.value.trim();if(!text)return;
  const c=cData.messages.find(m=>m.id===convId);if(!c)return;
  c.messages.push({role:'host',text,time:new Date().toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})});
  c.created=Date.now();ta.value='';document.getElementById('ai-st-'+convId).innerHTML='';
  saveUserData(cUid,cData);openConv(convId);renderMessages();toast('Sent! ✓');
}

// ════════════════════════════════════════════
//  TASKS
// ════════════════════════════════════════════
function addTask(){
  const title=document.getElementById('mt-title').value.trim();if(!title){toast('Enter a title');return;}
  const propId=document.getElementById('mt-prop').value;const prop=cData.properties.find(p=>p.id===propId);
  const t={id:'t_'+Date.now(),title,propId,propName:prop?.name||'',assignee:document.getElementById('mt-assign').value||'',due:document.getElementById('mt-due').value||'',priority:document.getElementById('mt-pri').value,done:false,created:Date.now()};
  cData.tasks.push(t);saveUserData(cUid,cData);closeModal('add-task-modal');
  ['mt-title','mt-assign','mt-due'].forEach(id=>{const el=document.getElementById(id);if(el)el.value='';});
  toast('Task added!');renderTasks();
}
function toggleTask(id){const t=cData.tasks.find(x=>x.id===id);if(!t)return;t.done=!t.done;saveUserData(cUid,cData);renderTasks();if(t.done)toast('Done! ✓');}
function renderTasks(){
  {
    const _tt=cData.tasks||[];
    const _now=new Date().toISOString().slice(0,10);
    const _s=(id,v)=>{const el=document.getElementById(id);if(el)el.textContent=v;};
    _s('task-kpi-pending',_tt.filter(t=>!t.done&&t.status!=='in_progress').length);
    _s('task-kpi-progress',_tt.filter(t=>t.status==='in_progress').length);
    _s('task-kpi-done',_tt.filter(t=>t.done).length);
    _s('task-kpi-overdue',_tt.filter(t=>!t.done&&t.due&&t.due<_now).length);
  }

  const list=document.getElementById('tasks-list');const count=document.getElementById('tasks-count');
  const tasks=[...cData.tasks].sort((a,b)=>(a.done===b.done)?({high:0,medium:1,low:2}[a.priority]-{high:0,medium:1,low:2}[b.priority]):(a.done?1:-1));
  count.textContent=`${tasks.length} tasks · ${tasks.filter(t=>!t.done).length} pending`;
  if(!tasks.length){list.innerHTML=`<div class="empty-state"><div class="es-i">🧹</div><h3>No tasks</h3><button class="btn btn-pri" onclick="openModal('add-task-modal')" style="margin-top:10px">Add Task</button></div>`;return;}
  list.innerHTML=tasks.map(t=>`<div class="task-card" onclick="toggleTask('${t.id}')"><div class="task-cb${t.done?' done':''}"> ${t.done?'✓':''}</div><div style="flex:1"><div style="font-size:13px;font-weight:500;color:var(--txt);${t.done?'text-decoration:line-through;opacity:.5':''}">${t.title}${t.propName?` <span style="font-weight:400;font-size:11px;color:var(--txt3)">· ${t.propName}</span>`:''}</div><div style="font-size:11px;color:var(--txt3);margin-top:2px">${[t.assignee&&`👤 ${t.assignee}`,t.due&&`📅 ${t.due}`].filter(Boolean).join(' · ')||'No details'}</div></div><span class="tpri ${t.priority}">${t.priority}</span></div>`).join('');
}

// ════════════════════════════════════════════
//  ICAL
// ════════════════════════════════════════════
async function addICal(){
  const name=document.getElementById('ic-name').value.trim();
  const url=document.getElementById('ic-url').value.trim();
  if(!name||!url){toast('Fill in name and URL');return;}
  const propId=document.getElementById('ic-prop').value;
  const prop=cData.properties.find(p=>p.id===propId);
  const btn=document.querySelector('#add-ical-modal .btn-pri');
  if(btn){btn.textContent='Syncing…';btn.disabled=true;}
  try {
    const result = await syncIcalUrl(url, propId, prop?.name||'');
    const ic={id:'ic_'+Date.now(),name,url,propId,propName:prop?.name||'',source:document.getElementById('ic-source').value,lastSync:new Date().toLocaleString(),status:'synced',created:Date.now()};
    if(!cData.icals)cData.icals=[];cData.icals.push(ic);
    saveUserData(cUid,cData);
    closeModal('add-ical-modal');
    ['ic-name','ic-url'].forEach(id=>{const el=document.getElementById(id);if(el)el.value='';});
    toast(`✓ "${name}" synced! ${result.count} booking${result.count!==1?'s':''} imported`);
    renderICals();renderBookings();
  } catch(e) {
    toast('Sync failed: '+e.message);
  } finally {
    if(btn){btn.textContent='Save & Sync';btn.disabled=false;}
  }
}

function icalImportDedupeKey(b, propId) {
  if (b.icalDedupeKey) return b.icalDedupeKey;
  const u = String(b.icalUid || b.uid || '').trim();
  if (u) return 'u:' + u;
  const cin = String(b.checkin || b.startDate || b.start || '').slice(0, 12);
  const cout = String(b.checkout || b.endDate || b.end || '').slice(0, 12);
  const lbl = String(b.summary || b.title || b.name || b.guestName || '').trim().slice(0, 200);
  return 'k:' + String(propId || '') + '|' + cin + '|' + cout + '|' + lbl;
}

async function syncIcalUrl(url, propId, propName) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000); // 10s timeout per feed
  let res;
  try {
    res = await fetch('https://vdnyqwpznsysrvyvbqga.supabase.co/functions/v1/ical-sync', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({ url }),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
  const data = await res.json();
  if(data.error) throw new Error(data.error);

  // Merge imported bookings — dedupe by iCal UID or stable fallback key
  const existing = new Set();
  for (const x of (cData.bookings || [])) {
    existing.add(icalImportDedupeKey(x, x.propId));
    if (x.icalUid) existing.add('u:' + String(x.icalUid).trim());
    if (x.icalDedupeKey) existing.add(x.icalDedupeKey);
  }
  let added = 0;
  let skippedCollisions = 0;
  
  for(const b of data.bookings) {
    const key = icalImportDedupeKey(b, propId);
    const uidStr = String(b.icalUid || b.uid || '').trim();
    if(existing.has(key) || (uidStr && existing.has('u:' + uidStr))) continue;
    
    // Check for collision with existing manual bookings
    const hasCollision = (cData.bookings || []).some(existingBooking => {
      if (existingBooking.propId !== propId) return false;
      if (existingBooking.status === 'cancelled') return false;
      
      // Check date overlap
      const existingCheckin = new Date(existingBooking.checkin);
      const existingCheckout = new Date(existingBooking.checkout);
      const newCheckin = new Date(b.checkin);
      const newCheckout = new Date(b.checkout);
      
      // Bookings collide if dates overlap
      return (newCheckin < existingCheckout && newCheckout > existingCheckin);
    });
    
    if (hasCollision) {
      skippedCollisions++;
      continue; // Skip this booking to prevent double booking
    }
    
    const prop = cData.properties.find(p=>p.id===propId);
    const rawPrice = b.price != null ? b.price : b.amount;
    const stableKey = key.startsWith('k:') ? key : undefined;
    cData.bookings.push({
      ...b,
      id: 'ical_'+Date.now()+'_'+Math.random().toString(36).slice(2),
      propId: propId||'',
      propName: propName||'Imported',
      propEmoji: prop?.emoji||'📅',
      propGradient: prop?.gradient||'pi1',
      price: rawPrice != null && rawPrice !== '' ? moneyNonNeg(rawPrice) : 0,
      icalUid: uidStr || '',
      icalDedupeKey: stableKey,
    });
    existing.add(key);
    if (stableKey) existing.add(stableKey);
    if (uidStr) existing.add('u:' + uidStr);
    added++;
  }
  
  // Show warning for skipped collisions
  if (skippedCollisions > 0) {
    toast(`⚠️ Skipped ${skippedCollisions} booking${skippedCollisions !== 1 ? 's' : ''} to prevent double booking`, 'warning');
  }
  
  saveUserData(cUid, cData);
  return { count: added };
}

async function syncICal(url, propId, propName) {
  return syncIcalUrl(url, propId, propName);
}

async function syncNow(icalId) {
  const ic = (cData.icals||[]).find(x=>x.id===icalId);
  if(!ic) return;
  const btn = document.getElementById('sync-btn-'+icalId);
  if(btn){btn.textContent='Syncing…';btn.disabled=true;}
  try {
    const result = await syncIcalUrl(ic.url, ic.propId, ic.propName);
    ic.lastSync = new Date().toLocaleString();
    ic.status = 'synced';
    saveUserData(cUid, cData);
    toast(`✓ Synced! ${result.count} new booking${result.count!==1?'s':''} imported`);
    renderICals();renderBookings();
  } catch(e) {
    toast('Sync failed: '+e.message);
    ic.status = 'error';
    saveUserData(cUid, cData);
    renderICals();
  } finally {
    if(btn){btn.textContent='🔄 Sync Now';btn.disabled=false;}
  }
}

function renderICals(){
  const list=document.getElementById('ical-list');if(!list)return;
  const icals=cData.icals||[];
  if(!icals.length){list.innerHTML=`<div class="empty-state"><div class="es-i">🔄</div><h3>No calendars synced</h3><p>Add an iCal link from Airbnb or VRBO to import bookings automatically</p></div>`;return;}
  list.innerHTML=icals.map(ic=>`
    <div class="ical-card">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">
        <div>
          <div style="font-size:14px;font-weight:600;color:var(--txt)">${ic.name}</div>
          <div style="font-size:11px;color:var(--txt3);margin-top:2px">${ic.propName||'No property'} · ${ic.source}</div>
        </div>
        <span class="ical-status ${ic.status==='error'?'ical-err':'ical-ok'}">${ic.status==='error'?'⚠ Error':'✓ Synced'}</span>
      </div>
      <div style="font-size:11px;color:var(--txt3);margin-bottom:10px;font-family:monospace;background:var(--sand);padding:6px 9px;border-radius:5px;word-break:break-all">${ic.url.substring(0,60)}…</div>
      <div style="display:flex;gap:8px;align-items:center">
        <span style="font-size:11px;color:var(--txt3)">Last sync: ${ic.lastSync||'Never'}</span>
        <button id="sync-btn-${ic.id}" class="btn btn-ghost" style="font-size:10px;padding:3px 9px;margin-left:auto" onclick="syncNow('${ic.id}')">🔄 Sync Now</button>
        <button class="btn btn-ghost" style="font-size:10px;padding:3px 9px;color:var(--terra)" onclick="removeICal('${ic.id}')">Remove</button>
      </div>
    </div>`).join('');

  // Render export URLs
  renderICalExports();
}

function renderICalExports() {
  const exportList = document.getElementById('ical-export-list');
  if(!exportList) return;
  const props = cData.properties||[];
  if(!props.length) {
    exportList.innerHTML='<div style="font-size:13px;color:var(--txt3)">Add a property first to generate your export URL.</div>';
    return;
  }

  // Base URL for the export — uses a data: URI approach since we're single-file
  // The export URL is a link that generates and downloads the iCal on click
  exportList.innerHTML = props.filter(p=>!p.hibernated).map(p => {
    const exportId = btoa(cUid + '|' + p.id).replace(/[^a-zA-Z0-9]/g,'').slice(0,24);
    return `<div style="border:1px solid var(--border);border-radius:10px;padding:14px;margin-bottom:10px;background:var(--card)">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px">
        <div style="font-size:20px">${p.emoji||'🏡'}</div>
        <div style="flex:1">
          <div style="font-size:13px;font-weight:600;color:var(--txt)">${p.name}</div>
          <div style="font-size:11px;color:var(--txt3)">${(cData.bookings||[]).filter(b=>b.propId===p.id&&b.status!=='cancelled').length} bookings · ${p.location||'No location'}</div>
        </div>
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <button class="btn btn-ghost" style="font-size:11px;padding:5px 12px" onclick="downloadICalFeed('${p.id}','${p.name}')">⬇️ Download .ics File</button>
        <button class="btn btn-sage" style="font-size:11px;padding:5px 12px;background:rgba(107,143,113,.15);border:1px solid var(--sage);border-radius:8px;color:var(--sage);cursor:pointer;font-family:'DM Sans',sans-serif" onclick="copyICalInstructions('${p.id}','${p.name}')">📋 Copy Setup Instructions</button>
      </div>
      <div style="margin-top:10px;font-size:11px;color:var(--txt3);line-height:1.5">
        Download the .ics file, then paste it into Airbnb or VRBO's calendar import. They'll auto-block your booked dates.
      </div>
    </div>`;
  }).join('');
}

// Generate iCal (.ics) feed for a property
function generateICalFeed(propId) {
  const prop = (cData.properties||[]).find(p=>p.id===propId);
  if(!prop) return '';
  const bookings = (cData.bookings||[]).filter(b=>b.propId===propId && b.status!=='cancelled');

  const pad = n => String(n).padStart(2,'0');
  const toICalDate = dateStr => {
    if(!dateStr) return '';
    const d = new Date(dateStr + 'T12:00:00');
    return `${d.getFullYear()}${pad(d.getMonth()+1)}${pad(d.getDate())}`;
  };

  const now = new Date();
  const stamp = `${now.getFullYear()}${pad(now.getMonth()+1)}${pad(now.getDate())}T${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}Z`;

  const events = bookings.map(b => {
    if(!b.checkin || !b.checkout) return '';
    // Checkout date is the end date (exclusive in iCal)
    const uid = `cso-${b.id}@csopropertyservice`;
    return [
      'BEGIN:VEVENT',
      `UID:${uid}`,
      `DTSTAMP:${stamp}`,
      `DTSTART;VALUE=DATE:${toICalDate(b.checkin)}`,
      `DTEND;VALUE=DATE:${toICalDate(b.checkout)}`,
      `SUMMARY:${b.guestName||'Booked'} — ${prop.name}`,
      `DESCRIPTION:Booked via CSO Property Services. ${b.numGuests||1} guest(s). Source: ${b.source||'direct'}.`,
      `STATUS:CONFIRMED`,
      'END:VEVENT'
    ].join('\r\n');
  }).filter(Boolean);

  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    `PRODID:-//CSO Property Services//CSO//EN`,
    `X-WR-CALNAME:${prop.name} — Bookings`,
    `X-WR-TIMEZONE:America/Chicago`,
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    ...events,
    'END:VCALENDAR'
  ].join('\r\n');
}

function downloadICalFeed(propId, propName) {
  const content = generateICalFeed(propId);
  if(!content) { toast('No bookings to export'); return; }
  const blob = new Blob([content], {type:'text/calendar;charset=utf-8'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = (propName||'property').replace(/\s+/g,'-').toLowerCase() + '-bookings.ics';
  a.click();
  URL.revokeObjectURL(a.href);
  toast('📅 iCal exported! Import into Airbnb/VRBO calendar settings.');
}

function copyICalInstructions(propId, propName) {
  const content = generateICalFeed(propId);
  const blobUrl = 'Download the .ics file using the button above';
  const instructions = `How to sync ${propName} with Airbnb & VRBO:\n\n` +
    `AIRBNB:\n1. Go to your Airbnb listing\n2. Calendar → Availability → Sync Calendars\n3. Click "Import Calendar"\n4. Upload the downloaded .ics file\n5. Airbnb will block your booked dates automatically\n\n` +
    `VRBO:\n1. Go to your VRBO dashboard\n2. Calendar → Import\n3. Choose "Add a calendar"\n4. Upload the .ics file\n\n` +
    `Re-download and re-import monthly to keep dates in sync.\nBookings in CSO Property Services will block those dates on all platforms.`;
  _fallbackCopy(instructions);
  toast('Instructions copied to clipboard!');
}

function removeICal(id){cData.icals=(cData.icals||[]).filter(x=>x.id!==id);saveUserData(cUid,cData);renderICals();toast('Calendar removed');}

// ════════════════════════════════════════════
//  PRICING
// ════════════════════════════════════════════
// ════════════════════════════════════════════
//  WEBSITE BUILDER
// ════════════════════════════════════════════
function getWbSlug(){return(document.getElementById('wb-name')?.value||'my-property').toLowerCase().replace(/\s+/g,'-');}
function setWbTheme(primary,bg,el){wbTheme={primary,bg};document.querySelectorAll('.cswatch').forEach(s=>s.classList.remove('sel'));el.classList.add('sel');updateWb();}
function toggleChip(el){el.classList.toggle('on');el.classList.toggle('off');el.textContent=el.classList.contains('on')?'✓ '+el.textContent.replace('✓ ',''):el.textContent.replace('✓ ','');updateWb();}
function updateWb(){
  const n=document.getElementById('wb-name')?.value||'My Property';const tl=document.getElementById('wb-tagline')?.value||'';const desc=document.getElementById('wb-desc')?.value||'';const loc=document.getElementById('wb-loc')?.value||'';const price=document.getElementById('wb-price')?.value||'$0';const min=document.getElementById('wb-min')?.value||'1 night';const host=document.getElementById('wb-host')?.value||'Your Host';const email=document.getElementById('wb-email')?.value||'';
  const slug=getWbSlug();const urlBar=document.getElementById('wb-url-bar');if(urlBar)urlBar.textContent=`Preview: ${n}`;
  const amenities=[...document.querySelectorAll('.amenity-chip.on')].map(a=>a.textContent.replace('✓ ','')).join(', ');
  const c=wbTheme.primary,bg=wbTheme.bg;
  const html=`<!DOCTYPE html><html><head><meta charset="UTF-8"><style>*{margin:0;padding:0;box-sizing:border-box;}body{font-family:Georgia,serif;background:${bg}}.hero{background:${c};color:#fff;padding:52px 32px 44px;text-align:center}.hero h1{font-size:40px;letter-spacing:-1px;font-weight:normal;margin-bottom:10px}.hero p{font-size:15px;opacity:.8;max-width:420px;margin:0 auto 6px;line-height:1.5}.hero small{font-size:11px;opacity:.55;letter-spacing:1px;text-transform:uppercase;font-family:sans-serif}.cta{display:inline-block;margin-top:22px;background:rgba(255,255,255,.2);color:#fff;padding:11px 26px;border-radius:28px;text-decoration:none;font-size:14px;border:1px solid rgba(255,255,255,.3);font-family:sans-serif}.sec{padding:32px;max-width:700px;margin:0 auto}.sec h2{font-size:20px;color:${c};margin-bottom:12px;font-weight:normal}.desc{font-size:14px;line-height:1.8;color:#4a3a2e}.pbox{background:#fff;border:1px solid #e0d8ce;border-radius:12px;padding:22px 26px;display:flex;align-items:center;justify-content:space-between;margin-top:12px}.pbig{font-size:40px;color:${c};letter-spacing:-1.5px}.pbook{background:${c};color:#fff;padding:11px 24px;border-radius:8px;font-size:13px;border:none;cursor:pointer;font-family:sans-serif}.ams{display:flex;flex-wrap:wrap;gap:7px;margin-top:10px}.am{background:#fff;border:1px solid #e0d8ce;border-radius:18px;padding:4px 12px;font-size:12px;color:#4a3a2e;font-family:sans-serif}.hcard{background:#fff;border:1px solid #e0d8ce;border-radius:12px;padding:20px;display:flex;align-items:center;gap:16px}.hav{width:48px;height:48px;border-radius:50%;background:${c};color:#fff;display:flex;align-items:center;justify-content:center;font-size:18px}hr{border:none;border-top:1px solid #e0d8ce}.foot{background:${c};color:rgba(255,255,255,.5);text-align:center;padding:16px;font-size:11px;font-family:sans-serif}</style></head><body><div class="hero"><h1>${n}</h1><p>${tl}</p><small>📍 ${loc}</small><br><a class="cta">Book Your Stay</a></div><div class="sec"><h2>About</h2><p class="desc">${desc}</p></div><hr><div class="sec"><h2>Pricing</h2><div class="pbox"><div><div class="pbig">${price}</div><div style="font-size:12px;color:#9b8e85;font-family:sans-serif">per night · Min ${min}</div></div><button class="pbook">Check Availability</button></div></div><hr><div class="sec"><h2>Amenities</h2><div class="ams">${amenities.split(', ').filter(Boolean).map(a=>`<span class="am">✓ ${a}</span>`).join('')}</div></div><hr><div class="sec"><h2>Your Host</h2><div class="hcard"><div class="hav">${host.split(' ').map(n=>n[0]).join('')}</div><div><div style="font-size:16px;color:#1c1410;margin-bottom:3px">${host}</div><div style="font-size:12px;color:#6b5d52;font-family:sans-serif">${email}</div></div></div></div><div class="foot">© 2026 ${n} · Powered by ${getBranding().name}</div></body></html>`;
  const iframe=document.getElementById('wb-iframe');if(iframe){const doc=iframe.contentDocument||iframe.contentWindow.document;doc.open();doc.write(html);doc.close();}
}

// ════════════════════════════════════════════
//  GUEST PORTAL
// ════════════════════════════════════════════
function renderPortal(){
  const list=document.getElementById('portal-guest-list');if(!list)return;
  const bookings=cData.bookings.filter(b=>b.status!=='cancelled'&&b.status!=='completed');
  if(!bookings.length){list.innerHTML=`<div class="empty-state" style="padding:24px 10px"><div class="es-i">🔑</div><p style="font-size:12px">Add bookings to generate portals</p></div>`;return;}
  list.innerHTML=bookings.map((b,i)=>{const cols=[['#F5E6D3','#C4693A'],['#D3E8E0','#4A7D50'],['#D3DCE8','#2E4460'],['#E8D3D3','#8B3A3A']];const c=cols[i%cols.length];const init=b.guestName.split(' ').map(n=>n[0]).join('').toUpperCase().slice(0,2);return `<div class="gp-li${i===0?' active':''}" id="gpl-${b.id}" onclick="selectPortal('${b.id}',this)"><div style="width:34px;height:34px;border-radius:50%;background:${c[0]};color:${c[1]};display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;flex-shrink:0">${init}</div><div><div style="font-size:12px;font-weight:600;color:var(--txt)">${b.guestName}</div><div style="font-size:11px;color:var(--txt3)">${b.propName} · ${b.checkin||'TBD'}</div></div></div>`;}).join('');
  if(bookings.length)setTimeout(()=>selectPortal(bookings[0].id,document.getElementById('gpl-'+bookings[0].id)),100);
}
function selectPortal(bookingId,el){
  document.querySelectorAll('.gp-li').forEach(x=>x.classList.remove('active'));if(el)el.classList.add('active');
  const b=cData.bookings.find(x=>x.id===bookingId);if(!b)return;
  const prop=cData.properties.find(p=>p.id===b.propId);
  const user=cUser;const color='#C4693A';
  document.getElementById('portal-url-bar').textContent=`Guest portal for ${b.guestName} · ${b.propName}`;
  const firstName=b.guestName.split(' ')[0];
  const html=`<!DOCTYPE html><html><head><meta charset="UTF-8"><style>*{margin:0;padding:0;box-sizing:border-box;}body{font-family:Georgia,serif;background:#FAF7F2;min-height:100vh}.hdr{background:${color};padding:36px 24px;text-align:center;color:#fff}.hdr-e{font-size:48px;margin-bottom:12px}.hdr h1{font-size:26px;font-weight:normal;margin-bottom:5px;letter-spacing:-.3px}.hdr p{font-size:13px;opacity:.7;font-family:sans-serif}.wlc{background:#fff;margin:18px;border-radius:12px;padding:20px;box-shadow:0 2px 8px rgba(0,0,0,.06)}.wlc h2{font-size:16px;color:${color};margin-bottom:8px;font-weight:normal}.wlc p{font-size:13px;line-height:1.7;color:#4a3a2e;font-family:sans-serif}.cards{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin:0 18px 10px}.ic{background:#fff;border-radius:11px;padding:16px;box-shadow:0 2px 7px rgba(0,0,0,.05)}.ic h3{font-size:9px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:#9b8e85;margin-bottom:8px;font-family:sans-serif}.code{font-size:34px;font-family:monospace;color:${color};letter-spacing:4px;font-weight:bold}.ir{display:flex;flex-direction:column;gap:2px;margin-bottom:7px}.il{font-size:9px;color:#9b8e85;font-family:sans-serif}.iv{font-size:13px;color:#1c1410;font-weight:600;font-family:sans-serif}.tl{background:#fff;border-radius:12px;margin:0 18px 10px;padding:16px;box-shadow:0 2px 7px rgba(0,0,0,.05)}.tl h3{font-size:9px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:#9b8e85;margin-bottom:12px;font-family:sans-serif}.ti{display:flex;gap:10px;align-items:flex-start;margin-bottom:12px}.td{width:28px;height:28px;border-radius:50%;background:${color};color:#fff;display:flex;align-items:center;justify-content:center;font-size:12px;flex-shrink:0}.tt{font-size:12px;font-weight:500;color:#1c1410;font-family:sans-serif}.ts{font-size:10px;color:#9b8e85;font-family:sans-serif;margin-top:1px}.tips{background:#fff;border-radius:12px;margin:0 18px 12px;padding:16px;box-shadow:0 2px 7px rgba(0,0,0,.05)}.tip{display:flex;gap:7px;font-family:sans-serif;font-size:12px;color:#4a3a2e;line-height:1.5;margin-bottom:8px}.cta{display:block;margin:0 18px 24px;background:${color};color:#fff;padding:13px;border-radius:10px;text-align:center;font-size:13px;text-decoration:none;font-family:sans-serif}.foot{text-align:center;padding:12px;font-size:10px;color:#9b8e85;font-family:sans-serif;border-top:1px solid #e0d8ce}</style></head><body><div class="hdr"><div class="hdr-e">${prop?.emoji||'🏡'}</div><h1>Welcome, ${firstName}!</h1><p>${prop?.name||'Your Property'} · ${prop?.location||''}</p></div><div class="wlc"><h2>We're so happy you're here!</h2><p>Everything you need for your stay is right here. Reach out anytime if you need anything at all.</p></div><div class="cards"><div class="ic"><h3>Door Code</h3><div class="code">${prop?.doorCode||'See host'}</div></div><div class="ic"><h3>WiFi</h3><div class="ir"><div class="il">Network</div><div class="iv">${prop?.wifi||'See welcome book'}</div></div><div class="ir"><div class="il">Password</div><div class="iv">${prop?.wifiPw||'See welcome book'}</div></div></div><div class="ic"><h3>Check-in</h3><div class="iv" style="font-size:12px">${b.checkin||'TBD'}</div><div style="font-size:10px;color:#9b8e85;font-family:sans-serif;margin-top:2px">After 3:00 PM</div></div><div class="ic"><h3>Check-out</h3><div class="iv" style="font-size:12px">${b.checkout||'TBD'}</div><div style="font-size:10px;color:#9b8e85;font-family:sans-serif;margin-top:2px">By 11:00 AM</div></div></div><div class="ic" style="margin:0 18px 10px;padding:14px;border-radius:11px;background:#fff;box-shadow:0 2px 7px rgba(0,0,0,.05)"><h3 style="font-size:9px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:#9b8e85;margin-bottom:6px;font-family:sans-serif">Parking</h3><div class="iv" style="font-size:12px">${prop?.parking||'See listing'}</div></div><div class="tl"><h3>Your Stay</h3><div class="ti"><div class="td">✈️</div><div><div class="tt">Arrive & Check In</div><div class="ts">${b.checkin||'Your check-in date'}</div></div></div><div class="ti"><div class="td">🏠</div><div><div class="tt">Enjoy Your Stay</div><div class="ts">Make yourself at home</div></div></div><div class="ti"><div class="td">👋</div><div><div class="tt">Check Out</div><div class="ts">${b.checkout||'Your checkout date'} · Leave key on counter</div></div></div></div><div class="tips"><h3 style="font-size:9px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:#9b8e85;margin-bottom:10px;font-family:sans-serif">House Tips</h3><div class="tip"><span>🔇</span>Quiet hours 10pm–8am</div><div class="tip"><span>🚭</span>No smoking indoors</div><div class="tip"><span>🌟</span>We'd love a review after your stay!</div></div><a class="cta" href="mailto:${user?.email||'csopropertyservice@gmail.com'}">💬 Message Your Host</a><div class="foot">Powered by ${getBranding().name}</div></body></html>`;
  const iframe=document.getElementById('portal-iframe');const doc=iframe.contentDocument||iframe.contentWindow.document;doc.open();doc.write(html);doc.close();
}

// ════════════════════════════════════════════
//  ANALYTICS
// ════════════════════════════════════════════
function exportAnalyticsCSV() {
  const bookings = cData.bookings||[];
  let csv = 'Date,Property,Guest,Nights,Revenue,Status,Source\n';
  bookings.forEach(function(b) {
    csv += '"'+(b.checkin||'')+'","'+(b.propName||'')+'","'+(b.guestName||'')+'",'+(b.nights||1)+','+(b.price||0)+',"'+(b.status||'')+'","'+(b.source||'')+'"\n';
  });
  const blob = new Blob([csv],{type:'text/csv'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'CSO-Analytics-'+new Date().toISOString().slice(0,10)+'.csv';
  a.click();
  toast('Analytics exported ✓');
}

function renderAnalytics(){
  const bookings=cData.bookings.filter(x=>x.status!=='cancelled');
  const rev=bookings.reduce((s,x)=>s+x.price,0);
  const abv=bookings.length?Math.round(rev/bookings.length):0;
  const set=(id,v)=>{const el=document.getElementById(id);if(el)el.textContent=v;};
  set('an-rev','$'+rev.toLocaleString());set('an-book',bookings.length);set('an-abv','$'+abv.toLocaleString());set('an-props',cData.properties.length);

  // Revenue forecasting
  const now = new Date();
  const thisMonth = bookings.filter(b=>{
    if(!b.checkin) return false;
    const d = new Date(b.checkin);
    return d.getMonth()===now.getMonth() && d.getFullYear()===now.getFullYear();
  }).reduce((s,b)=>s+b.price,0);

  const nextMonth = bookings.filter(b=>{
    if(!b.checkin) return false;
    const d = new Date(b.checkin);
    const nm = new Date(now.getFullYear(), now.getMonth()+1, 1);
    return d.getMonth()===nm.getMonth() && d.getFullYear()===nm.getFullYear();
  }).reduce((s,b)=>s+b.price,0);

  const next90 = bookings.filter(b=>{
    if(!b.checkin) return false;
    const d = new Date(b.checkin);
    const future = new Date(now); future.setDate(future.getDate()+90);
    return d >= now && d <= future;
  }).reduce((s,b)=>s+b.price,0);

  // Annualized run rate based on confirmed bookings
  const monthlyAvg = rev > 0 ? (rev / Math.max(1, bookings.length)) * (bookings.length / 3) : 0;
  const annualRate = Math.round(monthlyAvg * 12);

  set('fc-this','$'+thisMonth.toLocaleString());
  set('fc-next','$'+nextMonth.toLocaleString());
  set('fc-90','$'+next90.toLocaleString());
  set('fc-annual','$'+annualRate.toLocaleString());

  // Forecast bar chart
  const months = [-2,-1,0,1,2,3];
  const monthRevs = months.map(offset => {
    const d = new Date(now.getFullYear(), now.getMonth()+offset, 1);
    return bookings.filter(b=>{
      if(!b.checkin) return false;
      const bd = new Date(b.checkin);
      return bd.getMonth()===d.getMonth() && bd.getFullYear()===d.getFullYear();
    }).reduce((s,b)=>s+b.price,0);
  });
  const maxRev = Math.max(...monthRevs, 1);
  months.forEach((offset,i)=>{
    const d = new Date(now.getFullYear(), now.getMonth()+offset, 1);
    const label = d.toLocaleString('default',{month:'short'});
    const bar = document.getElementById('fc-b'+i);
    const lbl = document.getElementById('fc-l'+i);
    if(bar) bar.style.height = Math.max(4, (monthRevs[i]/maxRev)*90)+'px';
    if(lbl) lbl.textContent = label;
  });

  // Revenue by property
  const propEl = document.getElementById('an-by-prop');
  if(propEl) {
    if(!cData.properties.length){propEl.innerHTML=`<div class="empty-state" style="padding:20px"><p>Add properties and bookings</p></div>`;} else {
      const propRevs = cData.properties.map(p=>({
        name:p.name, emoji:p.emoji,
        rev:bookings.filter(b=>b.propId===p.id).reduce((s,b)=>s+b.price,0)
      })).sort((a,b)=>b.rev-a.rev);
      const maxPRev = Math.max(...propRevs.map(p=>p.rev),1);
      propEl.innerHTML = propRevs.map(p=>`
        <div class="src-item">
          <div class="src-hd"><span>${p.emoji} ${p.name}</span><strong>$${p.rev.toLocaleString()}</strong></div>
          <div class="src-bar"><div class="src-fill" style="width:${Math.round((p.rev/maxPRev)*100)}%;background:var(--terra)"></div></div>
        </div>`).join('');
    }
  }

  // Booking sources breakdown - dynamic chart
  renderBookingSourceChart();
}

// ════════════════════════════════════════════
//  REPORTS
// ════════════════════════════════════════════
function renderReports(){
  initOwnerReport();
  renderSentReports();
  const b=cData.bookings.filter(x=>x.status!=='cancelled');const rev=b.reduce((s,x)=>s+x.price,0);const abv=b.length?Math.round(rev/b.length):0;
  const set=(id,v)=>{const el=document.getElementById(id);if(el)el.textContent=v;};
  set('rep-rev','$'+rev.toLocaleString());set('rep-book',b.length);set('rep-avg','$'+abv.toLocaleString());set('rep-props',cData.properties.length);
  const wrap=document.getElementById('report-table-wrap');if(!wrap)return;
  if(!b.length){wrap.innerHTML=`<div class="empty-state" style="padding:28px"><div class="es-i">📄</div><p>Add bookings to generate reports</p></div>`;return;}
  const rows=[...b].sort((a,x)=>new Date(a.checkin)-new Date(x.checkin));
  wrap.innerHTML=`<table class="report-table"><thead><tr><th>Guest</th><th>Property</th><th>Check-in</th><th>Check-out</th><th>Nights</th><th>Source</th><th>Status</th><th style="text-align:right">Revenue</th></tr></thead><tbody>${rows.map(x=>`<tr><td>${x.guestName}</td><td>${x.propName}</td><td>${x.checkin||'—'}</td><td>${x.checkout||'—'}</td><td>${x.nights}</td><td>${x.source}</td><td>${x.status}</td><td style="text-align:right;font-family:Fraunces,serif;font-weight:500">$${x.price.toLocaleString()}</td></tr>`).join('')}</tbody><tfoot><tr><td colspan="7" style="font-weight:700;font-size:12px;color:var(--txt2);padding-top:12px">TOTAL</td><td style="text-align:right;font-family:Fraunces,serif;font-size:16px;font-weight:600;color:var(--terra);padding-top:12px">$${rev.toLocaleString()}</td></tr></tfoot></table>`;
}
function exportCSV(){
  const b=cData.bookings.filter(x=>x.status!=='cancelled');
  if(!b.length){toast('No bookings to export');return;}
  const header='Guest,Property,Check-in,Check-out,Nights,Guests,Source,Status,Revenue';
  const rows=b.map(x=>`"${x.guestName}","${x.propName}","${x.checkin||''}","${x.checkout||''}",${x.nights},${x.numGuests},"${x.source}","${x.status}",${x.price}`);
  const csv=header+'\n'+rows.join('\n');
  const a=document.createElement('a');a.href='data:text/csv;charset=utf-8,'+encodeURIComponent(csv);a.download='cso-report-'+new Date().toISOString().slice(0,10)+'.csv';a.click();
  toast('Report exported as CSV! ✓');
}

function getPortalHTML() {
  const iframe = document.getElementById('portal-iframe');
  if(!iframe) return null;
  const doc = iframe.contentDocument || iframe.contentWindow?.document;
  if(!doc || !doc.documentElement) return null;
  return '<!DOCTYPE html>' + doc.documentElement.outerHTML;
}

function downloadPortal() {
  const html = getPortalHTML();
  if(!html || html.length < 100) { toast('Select a guest first to generate their portal'); return; }
  const urlBar = document.getElementById('portal-url-bar');
  const guestName = urlBar?.textContent?.replace('Guest portal for ','').split(' · ')[0] || 'guest';
  const slug = guestName.toLowerCase().replace(/\s+/g,'-');
  const a = document.createElement('a');
  a.href = 'data:text/html;charset=utf-8,' + encodeURIComponent(html);
  a.download = 'cso-portal-' + slug + '.html';
  a.click();
  toast('Portal downloaded! Share the HTML file with your guest ✓');
}

function copyPortalHTML() {
  const html = getPortalHTML();
  if(!html || html.length < 100) { toast('Select a guest first to generate their portal'); return; }
  navigator.clipboard.writeText(html).then(()=>{
    toast('Portal HTML copied! Paste into any website or email ✓');
  }).catch(()=>toast('Copy failed — try downloading instead'));
}

function downloadWebsite() {
  const iframe = document.getElementById('wb-iframe');
  if(!iframe) { toast('Build your website first'); return; }
  const doc = iframe.contentDocument || iframe.contentWindow?.document;
  if(!doc || !doc.documentElement) { toast('Build your website first'); return; }
  const html = '<!DOCTYPE html>' + doc.documentElement.outerHTML;
  const name = document.getElementById('wb-name')?.value || 'my-property';
  const slug = name.toLowerCase().replace(/\s+/g,'-');
  const a = document.createElement('a');
  a.href = 'data:text/html;charset=utf-8,' + encodeURIComponent(html);
  a.download = 'cso-website-' + slug + '.html';
  a.click();
  toast('Website downloaded! Upload to any hosting service ✓');
}
function printReport(){
  renderReports();
  const content=document.getElementById('page-reports').innerHTML;
  const w=window.open('','_blank');
  w.document.write(`<!DOCTYPE html><html><head><title>CSO Property Services Report</title><style>body{font-family:Georgia,serif;padding:32px;color:#1C1410}h1{font-size:28px;margin-bottom:24px}table{width:100%;border-collapse:collapse}th{font-size:11px;text-transform:uppercase;letter-spacing:.7px;padding:7px;border-bottom:2px solid #E2DBD0;text-align:left}td{padding:9px 7px;border-bottom:1px solid #EDE8DE;font-size:13px}@media print{body{padding:16px}}</style></head><body><h1>CSO Property Services Revenue Report</h1><p style="color:#9B8E85;margin-bottom:20px">Generated ${new Date().toLocaleDateString()}</p>${content}</body></html>`);
  w.document.close();setTimeout(()=>w.print(),500);
  toast('Print dialog opening…');
}

// ════════════════════════════════════════════
//  REVIEWS
// ════════════════════════════════════════════
function addReview(){
  const name=document.getElementById('mr-name').value.trim();const content=document.getElementById('mr-content').value.trim();
  if(!name||!content){toast('Fill in all fields');return;}
  const propId=document.getElementById('mr-prop').value;const prop=cData.properties.find(p=>p.id===propId);
  const r={id:'r_'+Date.now(),guestName:name,propId,propName:prop?.name||'',rating:parseInt(document.getElementById('mr-rating').value)||5,content,initials:name.split(' ').map(n=>n[0]).join('').toUpperCase().slice(0,2),created:Date.now()};
  cData.reviews.push(r);saveUserData(cUid,cData);closeModal('add-review-modal');
  ['mr-name','mr-content'].forEach(id=>{const el=document.getElementById(id);if(el)el.value='';});
  toast('Review added!');renderReviews();
}
function renderReviews(){
  const list=document.getElementById('reviews-list');const count=document.getElementById('reviews-count');if(!list)return;
  const revs=[...cData.reviews].sort((a,b)=>b.created-a.created);
  count.textContent=revs.length+' review'+(revs.length===1?'':'s');
  if(!revs.length){list.innerHTML=`<div class="empty-state"><div class="es-i">⭐</div><h3>No reviews yet</h3><button class="btn btn-pri" onclick="openModal('add-review-modal')" style="margin-top:10px">Add Review</button></div>`;return;}
  const cols=[['#F5E6D3','#C4693A'],['#D3E8E0','#4A7D50'],['#D3DCE8','#2E4460'],['#E8D3D3','#8B3A3A']];
  list.innerHTML=`<div class="card"><div class="card-body">`+revs.map((r,i)=>{const c=cols[i%cols.length];return `<div style="padding-bottom:16px;margin-bottom:16px;border-bottom:1px solid var(--border)"><div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:8px"><div style="display:flex;align-items:center;gap:9px"><div style="width:34px;height:34px;border-radius:50%;background:${c[0]};color:${c[1]};display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700">${r.initials}</div><div><div style="font-size:13px;font-weight:500;color:var(--txt)">${r.guestName}</div><div style="font-size:11px;color:var(--txt3)">${r.propName||'Property'} · ${new Date(r.created).toLocaleDateString()}</div></div></div><div style="color:var(--gold);font-size:13px">${'★'.repeat(r.rating)}${'☆'.repeat(5-r.rating)}</div></div><div style="font-size:13px;color:var(--txt2);line-height:1.6">${r.content}</div><button class="btn btn-ghost" style="margin-top:8px;font-size:10px;padding:3px 9px" onclick="_replyToReview('${r.guestName.replace(/'/g,"\\'")}','${r.propId||''}')">Reply to ${r.guestName.split(' ')[0]}</button></div>`;}).join('')+`</div></div>`;
}

function _replyToReview(guestName, propId) {
  // Find or create a message thread for this guest, then navigate to messages
  if(!cData) return;
  const existing = (cData.messages||[]).find(m =>
    m.guestName === guestName && (!propId || m.propId === propId)
  );
  nav('messages', document.querySelector('[onclick*=messages]'));
  if(existing) {
    setTimeout(() => {
      if(typeof openConv === 'function') openConv(existing.id);
    }, 100);
    toast('Opening message thread with ' + guestName + ' →');
  } else {
    // No thread yet — open new message modal pre-filled with correct IDs
    setTimeout(() => {
      openModal('add-message-modal');
      const nameEl = document.getElementById('mm-name');
      const propEl = document.getElementById('mm-prop');
      if(nameEl) nameEl.value = guestName;
      if(propEl && propId) propEl.value = propId;
    }, 150);
    toast('Start a message thread with ' + guestName);
  }
}
function scheduleDashboardRevOccIdle(bookings, thisMonthBookings, thisMonth, now, daysInMonth) {
  const ric = window.requestIdleCallback || function(cb) { setTimeout(function() { cb({ didTimeout: true }); }, 1); };
  ric(function() {
    if (!cData) return;
    const rev = moneyRound(thisMonthBookings.reduce((s, b) => moneyRound(s + moneyNonNeg(b.price)), 0));
    const bookedDays = thisMonthBookings.reduce((s, b) => s + (b.nights || 0), 0);
    const nProps = (cData.properties || []).length;
    const occ = nProps ? Math.min(100, Math.round(bookedDays / (daysInMonth * nProps) * 100)) : 0;
    const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
    set('kpi-rev', '$' + rev.toLocaleString());
    set('kpi-occ', occ + '%');
    const occDelta = document.getElementById('kpi-occ-delta');
    if (occDelta) { occDelta.textContent = occ >= 70 ? '↑ great' : occ >= 40 ? '↑ good' : 'this month'; occDelta.className = 'delta ' + (occ >= 40 ? 'up' : ''); }

    const months = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = d.toISOString().slice(0, 7);
      const label = d.toLocaleString('default', { month: 'short' });
      const mrev = moneyRound(bookings.filter(b => b.checkin?.startsWith(key)).reduce((s, b) => moneyRound(s + moneyNonNeg(b.price)), 0));
      months.push({ key, label, rev: mrev });
    }
    const maxRev = Math.max(...months.map(m => m.rev), 1);
    const totalRev = moneyRound(bookings.reduce((s, b) => moneyRound(s + moneyNonNeg(b.price)), 0));
    set('dash-rev-total', 'Total: $' + totalRev.toLocaleString());
    const chartEl = document.getElementById('dash-rev-chart');
    const labelsEl = document.getElementById('dash-rev-labels');
    if (chartEl && months.some(m => m.rev > 0)) {
      chartEl.innerHTML = months.map((m, i) => {
        const h = Math.max(4, Math.round((m.rev / maxRev) * 72));
        const isThis = i === 5;
        return `<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:4px">
        <div style="font-size:10px;color:var(--txt3)">${m.rev > 0 ? '$' + m.rev.toLocaleString() : ''}</div>
        <div style="width:100%;height:${h}px;background:${isThis ? 'var(--terra)' : 'var(--border2)'};border-radius:4px 4px 0 0;transition:height .4s ease"></div>
      </div>`;
      }).join('');
      if (labelsEl) labelsEl.innerHTML = months.map(m => `<div style="flex:1;font-size:10px;color:var(--txt3);text-align:center">${m.label}</div>`).join('');
    } else if (chartEl) {
      chartEl.innerHTML = '<div style="font-size:12px;color:var(--txt3);padding:20px 0">Add bookings to see revenue trend</div>';
    }
  });
}

function renderDashboard(){
  if(!cData){return;}

  // ── Cleaning Business Mode: no properties but has cleaners/jobs
  if(isCleaningBusinessMode()) {
    renderCleaningBusinessDashboard();
    return;
  }

  renderGettingStarted();
  renderMilestoneWidget(); // Feature 1 — persistent 4-step milestone tracker

  // ── Subscription enforcement — trial banner + button state
  checkTrialStatus();
  updateAddPropertyButton();

  const now = new Date();
  const today = now.toISOString().slice(0,10);
  const tomorrow = new Date(now.getTime()+86400000).toISOString().slice(0,10);
  const thisMonth = now.toISOString().slice(0,7);

  const bookings = (cData.bookings||[]).filter(b=>b.status!=='cancelled');
  const thisMonthBookings = bookings.filter(b=>b.checkin?.startsWith(thisMonth));
  const unread = (cData.messages||[]).filter(m=>m.unread).length;
  const daysInMonth = new Date(now.getFullYear(), now.getMonth()+1, 0).getDate();

  const set=(id,v)=>{const el=document.getElementById(id);if(el)el.textContent=v;};
  set('kpi-rev','…');
  set('kpi-book',bookings.filter(b=>b.status==='confirmed').length);
  set('kpi-occ','…');
  set('kpi-msgs',unread);
  scheduleDashboardRevOccIdle(bookings, thisMonthBookings, thisMonth, now, daysInMonth);

  const msgsDelta = document.getElementById('kpi-msgs-delta');
  if(msgsDelta) { msgsDelta.textContent = unread > 0 ? 'need reply' : 'all read'; msgsDelta.className = 'delta '+(unread>0?'':'up'); }

  // Today's alerts
  const alertsEl = document.getElementById('dash-alerts');
  if(alertsEl) {
    const checkinsToday = bookings.filter(b=>b.checkin===today);
    const checkoutsToday = bookings.filter(b=>b.checkout===today);
    const checkoutsTomorrow = bookings.filter(b=>b.checkout===tomorrow);
    const pendingCount = cData.bookings.filter(b=>b.status==='pending').length;
    let alerts = [];
    if(checkinsToday.length) alerts.push(`<div style="display:flex;align-items:center;gap:10px;background:rgba(107,143,113,.12);border:1px solid var(--sage);border-radius:8px;padding:10px 14px;font-size:13px;color:var(--txt)">🟢 <strong>${checkinsToday.length} check-in${checkinsToday.length>1?'s':''} today</strong> — ${checkinsToday.map(b=>b.guestName).join(', ')}</div>`);
    if(checkoutsToday.length) alerts.push(`<div style="display:flex;align-items:center;gap:10px;background:rgba(196,105,58,.08);border:1px solid var(--terra-l);border-radius:8px;padding:10px 14px;font-size:13px;color:var(--txt)">🔴 <strong>${checkoutsToday.length} checkout${checkoutsToday.length>1?'s':''} today</strong> — ${checkoutsToday.map(b=>b.guestName).join(', ')}</div>`);
    if(checkoutsTomorrow.length) alerts.push(`<div style="display:flex;align-items:center;gap:10px;background:rgba(200,168,75,.1);border:1px solid var(--gold);border-radius:8px;padding:10px 14px;font-size:13px;color:var(--txt)">🟡 <strong>${checkoutsTomorrow.length} checkout${checkoutsTomorrow.length>1?'s':''} tomorrow</strong> — ${checkoutsTomorrow.map(b=>b.guestName).join(', ')}</div>`);
    if(pendingCount) alerts.push(`<div style="display:flex;align-items:center;gap:10px;background:rgba(200,168,75,.1);border:1px solid var(--gold);border-radius:8px;padding:10px 14px;font-size:13px;color:var(--txt)" onclick="nav('bookings',document.querySelector('[onclick*=bookings]'))" style="cursor:pointer">⏳ <strong>${pendingCount} pending booking${pendingCount>1?'s':''}</strong> awaiting confirmation <span style="margin-left:auto;font-size:11px;color:var(--terra)">Review →</span></div>`);
    alertsEl.innerHTML = alerts.length ? `<div style="display:flex;flex-direction:column;gap:8px;margin-bottom:14px">${alerts.join('')}</div>` : '';
  }

  // Recent bookings
  const dbEl = document.getElementById('dash-bookings');
  const recent = [...cData.bookings].sort((a,b)=>{
    const aDate = new Date(a.checkin||0); const bDate = new Date(b.checkin||0);
    return aDate - bDate;
  }).filter(b=>b.status!=='cancelled'&&b.status!=='completed').slice(0,5);
  if(!recent.length) dbEl.innerHTML=`<div class="empty-state"><div class="es-i">📅</div><h3>No upcoming bookings</h3><button class="btn btn-pri" onclick="openModal('add-booking-modal')" style="margin-top:10px">Add Booking</button></div>`;
  else {
    const spc={confirmed:'pill-green',pending:'pill-amber',completed:'pill-blue',cancelled:'pill-red'};
    dbEl.innerHTML=recent.map(b=>`<div class="row"><div class="row-thumb ${b.propGradient||'pi1'}">${b.propEmoji||'🏠'}</div><div class="row-info"><div class="row-title">${b.propName} — ${b.guestName}</div><div class="row-sub">${b.checkin||'TBD'} → ${b.checkout||'TBD'} · ${b.nights||0} nights</div></div><span class="pill ${spc[b.status]||'pill-blue'}">${b.status}</span><div class="row-price">$${b.price.toLocaleString()}</div></div>`).join('');
  }

  // Recent messages
  const dmEl = document.getElementById('dash-msgs');
  const recentMsgs = [...cData.messages].sort((a,b)=>b.created-a.created).slice(0,4);
  if(!recentMsgs.length) dmEl.innerHTML=`<div class="empty-state" style="padding:20px 10px"><div class="es-i">💬</div><p>No messages</p></div>`;
  else dmEl.innerHTML=recentMsgs.map(m=>{const msgs=m.messages||[];const last=msgs.length?msgs[msgs.length-1]:{text:''};const raw=(last.text||'');const prev=raw.length>40?raw.substring(0,40)+'…':raw;return `<div class="msg-li" onclick="nav('messages',document.querySelector('[onclick*=messages]'));setTimeout(()=>openConv('${m.id}'),50)"><div class="msg-av" style="background:${m.avatarBg};color:${m.avatarColor}">${m.initials||'?'}</div><div style="flex:1;min-width:0"><div class="msg-li-name" style="font-weight:${m.unread?700:500}">${m.guestName||'Guest'}</div><div class="msg-li-prev">${prev}</div></div>${m.unread?`<div style="width:6px;height:6px;background:var(--terra);border-radius:50%;flex-shrink:0"></div>`:''}</div>`;}).join('');

  // Properties
  const dpEl = document.getElementById('dash-props');
  if(!cData.properties.length) dpEl.innerHTML=`<div class="empty-state"><div class="es-i">🏠</div><h3>No properties yet</h3><button class="btn btn-pri" onclick="openModal('add-property-modal')" style="margin-top:10px">Add First</button></div>`;
  else dpEl.innerHTML=`<div class="g3">`+cData.properties.map(p=>`<div class="prop-card"><div class="prop-img ${p.gradient}">${p.emoji}</div><div class="prop-body"><div class="prop-name">${p.name}</div><div class="prop-loc">📍 ${p.location||'No location'}</div><div class="prop-stats"><div class="prop-stat">⭐ <strong>${p.rating||'—'}</strong></div><div class="prop-stat">💰 <strong>$${p.rate}/n</strong></div></div></div></div>`).join('')+`</div>`;

  // Notes
  renderNotes();
  renderSmartNotifications();
}

// ════════════════════════════════════════════
//  SMART NOTIFICATIONS
// ════════════════════════════════════════════
function renderSmartNotifications() {
  const widget = document.getElementById('smart-notif-widget');
  const list   = document.getElementById('smart-notif-list');
  if (!widget || !list) return;

  const now    = new Date();
  const today  = now.toISOString().slice(0,10);
  const in2d   = new Date(now.getTime()+172800000).toISOString().slice(0,10);
  const in7d   = new Date(now.getTime()+604800000).toISOString().slice(0,10);
  const alerts = [];

  // ── Upcoming check-ins in next 48 hours
  const upcomingCI = (cData.bookings||[]).filter(b=>b.status==='confirmed'&&b.checkin>today&&b.checkin<=in2d);
  upcomingCI.forEach(b=>alerts.push({icon:'🏠',color:'var(--sage)',bg:'rgba(107,143,113,.1)',border:'var(--sage)',text:`<strong>${b.guestName}</strong> checks in <strong>${b.checkin===in2d?'in 2 days':'tomorrow'}</strong> at ${b.propName||'your property'}`,action:`nav('bookings',document.querySelector('[onclick*=bookings]'))`,label:'View booking'}));

  // ── Overdue tasks
  const overdue = (cData.tasks||[]).filter(t=>!t.done&&t.due&&t.due<today);
  if(overdue.length) alerts.push({icon:'⚠️',color:'var(--terra)',bg:'rgba(196,105,58,.08)',border:'var(--terra-l)',text:`<strong>${overdue.length} overdue task${overdue.length>1?'s':''}</strong> — ${overdue.map(t=>t.title).slice(0,2).join(', ')}${overdue.length>2?` +${overdue.length-2} more`:''}`,action:`nav('cleaning',document.querySelector('[onclick*=cleaning]'))`,label:'View tasks'});

  // ── Low inventory items
  const lowStock = (cData.inventory||[]).filter(i=>i.qty<=i.minQty);
  if(lowStock.length) alerts.push({icon:'📦',color:'var(--gold)',bg:'rgba(200,168,75,.1)',border:'var(--gold)',text:`<strong>${lowStock.length} inventory item${lowStock.length>1?'s':''}</strong> running low — ${lowStock.map(i=>i.name).slice(0,2).join(', ')}`,action:`nav('inventory',document.querySelector('[onclick*=inventory]'))`,label:'View inventory'});

  // ── Pending bookings
  const pending = (cData.bookings||[]).filter(b=>b.status==='pending');
  if(pending.length) alerts.push({icon:'⏳',color:'var(--terra)',bg:'rgba(196,105,58,.08)',border:'var(--terra-l)',text:`<strong>${pending.length} booking request${pending.length>1?'s':''}</strong> waiting for your confirmation`,action:`nav('bookings',document.querySelector('[onclick*=bookings]'))`,label:'Confirm now'});

  // ── Upcoming checkouts with no cleaning task
  const soonCO = (cData.bookings||[]).filter(b=>b.checkout>=today&&b.checkout<=in2d&&b.status==='confirmed');
  soonCO.forEach(b=>{
    const hasCleaning = (cData.tasks||[]).some(t=>t.propId===b.propId&&t.type==='cleaning'&&t.date===b.checkout&&!t.done);
    if(!hasCleaning) alerts.push({icon:'🧹',color:'var(--txt3)',bg:'var(--sand)',border:'var(--border)',text:`No cleaning task for <strong>${b.propName||'property'}</strong> checkout on <strong>${b.checkout}</strong>`,action:`openModal('add-task-modal')`,label:'Add task'});
  });

  // ── Rentals due back today
  const rentalsOverdue = (cData.rentalBookings||[]).filter(r=>r.endDate&&r.endDate<=today&&r.status!=='returned');
  if(rentalsOverdue.length) alerts.push({icon:'🚲',color:'var(--gold)',bg:'rgba(200,168,75,.1)',border:'var(--gold)',text:`<strong>${rentalsOverdue.length} rental${rentalsOverdue.length>1?'s':''}</strong> due back today or overdue`,action:`nav('rentals',document.querySelector('[onclick*=rentals]'))`,label:'View rentals'});

  // ── Check-in insurance requests unresolved
  const openCI = (cData.ciRequests||[]).filter(r=>r.status==='pending');
  if(openCI.length) alerts.push({icon:'🛡',color:'var(--sage)',bg:'rgba(107,143,113,.1)',border:'var(--sage)',text:`<strong>${openCI.length} flex-time request${openCI.length>1?'s':''}</strong> pending approval`,action:`nav('checkininsurance',document.querySelector('[onclick*=checkininsurance]'))`,label:'Review'});

  if(!alerts.length) { widget.style.display='none'; }
  else {
    widget.style.display='block';
    list.innerHTML = alerts.map(a=>`
      <div style="display:flex;align-items:center;gap:12px;background:${a.bg};border:1px solid ${a.border};border-radius:8px;padding:10px 14px">
        <div style="font-size:18px;flex-shrink:0">${a.icon}</div>
        <div style="flex:1;font-size:13px;color:var(--txt)">${a.text}</div>
        <button class="btn btn-ghost" style="font-size:11px;padding:4px 10px;white-space:nowrap;color:${a.color};border-color:${a.border}" onclick="${a.action}">${a.label} →</button>
      </div>`).join('');
  }
  // Market Trends widget — refresh on every dashboard render
  setTimeout(refreshMarketTrends, 100);
}



// ════════════════════════════════════════════
//  GUEST CRM
// ════════════════════════════════════════════
function renderCRM() {
  const query = (document.getElementById('crm-search')?.value||'').toLowerCase();
  const filter = document.getElementById('crm-filter')?.value||'all';
  let guests = [...(cData.guestCRM||[])];

  // Auto-sync from bookings
  (cData.bookings||[]).forEach(b => {
    if(b.guestName && !guests.find(g => g.name.toLowerCase()===b.guestName.toLowerCase())) {
      guests.push({id:'cg_'+b.id, name:b.guestName, email:b.guestEmail||'', phone:'', city:'', stays:1, spent:b.price||0, notes:'', tags:'', autoAdded:true, created:b.created||Date.now()});
    } else {
      const g = guests.find(g => g.name.toLowerCase()===b.guestName?.toLowerCase());
      if(g && g.autoAdded) { g.stays = Math.max(g.stays||1, (cData.bookings||[]).filter(x=>x.guestName===b.guestName).length); g.spent = (cData.bookings||[]).filter(x=>x.guestName===b.guestName).reduce((s,x)=>s+(x.price||0),0); }
    }
  });

  if(query) guests = guests.filter(g => g.name.toLowerCase().includes(query) || (g.email||'').toLowerCase().includes(query) || (g.tags||'').toLowerCase().includes(query));
  if(filter==='vip') guests = guests.filter(g => g.stays >= 2);
  if(filter==='blacklist') guests = guests.filter(g => (cData.blacklist||[]).some(b => b.name?.toLowerCase()===g.name.toLowerCase()));

  const set=(id,v)=>{const el=document.getElementById(id);if(el)el.textContent=v;};
  const allGuests = cData.guestCRM||[];
  set('crm-total', allGuests.length + (cData.bookings||[]).filter(b=>b.guestName&&!allGuests.find(g=>g.name.toLowerCase()===b.guestName.toLowerCase())).length);
  set('crm-returns', allGuests.filter(g=>g.stays>=2).length);
  const totalSpent = allGuests.reduce((s,g)=>s+(g.spent||0),0);
  const avgSpend = allGuests.length ? Math.round(totalSpent/allGuests.length) : 0;
  set('crm-avg-spend','$'+avgSpend.toLocaleString());
  set('crm-vip', allGuests.filter(g=>g.stays>=5).length);

  const list = document.getElementById('crm-list');
  if(!list) return;
  if(!guests.length) { list.innerHTML='<div class="empty-state"><div class="es-i">👤</div><h3>No guests found</h3></div>'; return; }

  const blacklisted = (cData.blacklist||[]).map(b=>b.name?.toLowerCase());
  list.innerHTML = guests.map(function(g) {
    var tier = g.stays>=10?'🥇 Platinum':g.stays>=5?'🥈 Gold':g.stays>=2?'🥉 Silver':'⭐ New';
    var isBlacklisted = blacklisted.includes(g.name.toLowerCase());
    var tags = (g.tags||'').split(',').filter(Boolean).map(t=>'<span style="background:var(--sand);border-radius:4px;padding:2px 6px;font-size:10px;color:var(--txt2)">'+t.trim()+'</span>').join(' ');
    return '<div class="row" style="cursor:default;'+(isBlacklisted?'border-left:3px solid var(--terra);':'')+'">'
      +'<div style="width:40px;height:40px;border-radius:50%;background:var(--terra);color:#fff;display:flex;align-items:center;justify-content:center;font-size:16px;font-weight:700;flex-shrink:0">'+g.name[0].toUpperCase()+'</div>'
      +'<div class="row-info"><div class="row-title">'+g.name+(isBlacklisted?' <span style="font-size:10px;color:var(--terra)">⛔ Flagged</span>':'')+'</div>'
      +'<div class="row-sub">'+(g.email||'No email')+' · '+(g.city||'Unknown location')+'</div>'
      +'<div style="margin-top:4px;display:flex;gap:4px;flex-wrap:wrap">'+tags+'</div></div>'
      +'<div style="text-align:right;flex-shrink:0"><div style="font-size:11px;color:var(--txt3)">'+tier+'</div><div style="font-size:13px;font-weight:600;color:var(--txt)">'+g.stays+' stay'+(g.stays!==1?'s':'')+'</div><div style="font-size:12px;color:var(--sage)">$'+(g.spent||0).toLocaleString()+'</div></div>'
      +'<div style="display:flex;flex-direction:column;gap:4px"><button class="btn btn-ghost" style="font-size:10px;padding:3px 8px" onclick="openCRMGuest(this.dataset.id)" data-id="'+g.id+'">View</button><button class="btn btn-ghost" style="font-size:10px;padding:3px 8px;color:var(--terra)" onclick="removeCRMGuest(this.dataset.id)" data-id="'+g.id+'">🗑</button></div>'
      +'</div>';
  }).join('');
}

function addCRMGuest() {
  const name = document.getElementById('crm-name').value.trim();
  if(!name){toast('Enter guest name');return;}
  if(!cData.guestCRM) cData.guestCRM=[];
  cData.guestCRM.push({id:'cg_'+Date.now(), name, email:document.getElementById('crm-email').value, phone:document.getElementById('crm-phone').value, city:document.getElementById('crm-city').value, stays:parseInt(document.getElementById('crm-stays').value)||1, spent:parseFloat(document.getElementById('crm-spent').value)||0, notes:document.getElementById('crm-notes').value, tags:document.getElementById('crm-tags').value, created:Date.now()});
  saveUserData(cUid,cData); closeModal('add-crm-modal'); toast(name+' added to CRM!'); renderCRM();
}

function openCRMGuest(id) {
  const g = (cData.guestCRM||[]).find(x=>x.id===id);
  if(!g) return;
  const bookings = (cData.bookings||[]).filter(b=>b.guestName?.toLowerCase()===g.name.toLowerCase());
  const msgs = (cData.messages||[]).filter(m=>m.guestName?.toLowerCase()===g.name.toLowerCase());
  toast(g.name+' — '+g.stays+' stays · $'+(g.spent||0)+' spent · '+bookings.length+' bookings');
}

function removeCRMGuest(id){cData.guestCRM=(cData.guestCRM||[]).filter(x=>x.id!==id);saveUserData(cUid,cData);renderCRM();toast('Guest removed');}

// ════════════════════════════════════════════
//  PAYOUT LEDGER
// ════════════════════════════════════════════
function calcPayoutSplit() {
  const charged = parseFloat(document.getElementById('pay-charged')?.value)||0;
  const owed = parseFloat(document.getElementById('pay-owed')?.value)||0;
  const preview = document.getElementById('pay-split-preview');
  const netEl = document.getElementById('pay-split-net');
  if(charged && owed && preview && netEl) {
    const net = charged - owed;
    const margin = charged ? Math.round(net/charged*100) : 0;
    preview.style.display='block';
    netEl.textContent = '$'+net.toFixed(2)+' ('+margin+'% margin)';
    netEl.style.color = net >= 0 ? 'var(--sage)' : 'var(--terra)';
  }
}

function calcMargin() {
  const charged = parseFloat(document.getElementById('calc-charged')?.value)||0;
  const owed = parseFloat(document.getElementById('calc-owed')?.value)||0;
  const el = document.getElementById('calc-result');
  if(!el) return;
  if(!charged) { el.innerHTML='<div style="font-size:11px;color:var(--txt3);margin-bottom:4px">Your Net Margin</div><div style="font-family:Fraunces,serif;font-size:32px;color:var(--sage)">—</div>'; return; }
  const net = charged - owed;
  const margin = Math.round(net/charged*100);
  el.innerHTML='<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">'
    +'<div><div style="font-size:10px;color:var(--txt3);margin-bottom:2px">Net Profit</div><div style="font-family:Fraunces,serif;font-size:26px;color:'+(net>=0?'var(--sage)':'var(--terra)')+'">$'+net.toFixed(2)+'</div></div>'
    +'<div><div style="font-size:10px;color:var(--txt3);margin-bottom:2px">Margin</div><div style="font-family:Fraunces,serif;font-size:26px;color:'+(margin>=30?'var(--sage)':margin>=15?'var(--gold)':'var(--terra)')+'">'+margin+'%</div></div>'
    +'</div>'
    +'<div style="margin-top:10px;height:6px;background:var(--border);border-radius:4px;overflow:hidden"><div style="height:100%;background:'+(margin>=30?'var(--sage)':margin>=15?'var(--gold)':'var(--terra)')+';width:'+Math.min(100,Math.max(0,margin))+'%;border-radius:4px;transition:width .4s"></div></div>';
}

function logPayoutFromCalc() {
  const charged = document.getElementById('calc-charged')?.value;
  const owed = document.getElementById('calc-owed')?.value;
  if(!charged||!owed){toast('Enter both amounts first');return;}
  document.getElementById('pay-charged').value=charged;
  document.getElementById('pay-owed').value=owed;
  calcPayoutSplit();
  openModal('add-payout-modal');
}

function addPayout() {
  const charged = parseFloat(document.getElementById('pay-charged').value)||0;
  const owed = parseFloat(document.getElementById('pay-owed').value)||0;
  if(!charged){toast('Enter amount charged');return;}
  if(!cData.payouts) cData.payouts=[];
  const cleaner = document.getElementById('pay-cleaner').value;
  const cleanerName = document.getElementById('pay-cleaner').selectedOptions[0]?.text||'Unknown';
  cData.payouts.push({id:'pay_'+Date.now(), cleaner, cleanerName, charged, owed, net:charged-owed, margin:charged?Math.round((charged-owed)/charged*100):0, status:document.getElementById('pay-status').value, date:document.getElementById('pay-date').value||new Date().toISOString().slice(0,10), notes:document.getElementById('pay-notes').value, created:Date.now()});
  saveUserData(cUid,cData); closeModal('add-payout-modal'); toast('Payout logged! Net: $'+(charged-owed).toFixed(2)); renderPayouts();
}

function renderPayouts() {
  if(!requireCohost('payouts')) return;
  const payouts = cData.payouts||[];
  const set=(id,v)=>{const el=document.getElementById(id);if(el)el.textContent=v;};
  const totalPaid = payouts.reduce((s,p)=>s+(p.owed||0),0);
  const totalNet = payouts.reduce((s,p)=>s+(p.net||0),0);
  const pending = payouts.filter(p=>p.status==='pending').length;
  const avgMargin = payouts.length ? Math.round(payouts.reduce((s,p)=>s+(p.margin||0),0)/payouts.length) : 0;
  set('pay-total','$'+totalPaid.toLocaleString());
  set('pay-net','$'+totalNet.toLocaleString());
  set('pay-pending',pending);
  set('pay-margin',avgMargin+'%');

  const list = document.getElementById('payout-list');
  if(!list) return;
  if(!payouts.length){list.innerHTML='<div class="empty-state"><div class="es-i">💳</div><h3>No payouts logged</h3></div>';return;}
  list.innerHTML = [...payouts].reverse().map(function(p){
    return '<div class="row" style="cursor:default">'
      +'<div class="row-info"><div class="row-title">'+p.cleanerName+'</div><div class="row-sub">'+p.date+' · Charged: $'+p.charged+' · Owed: $'+p.owed+'</div></div>'
      +'<div style="text-align:right;flex-shrink:0"><div style="font-size:12px;font-weight:700;color:var(--sage)">$'+p.net.toFixed(2)+' net</div><div style="font-size:10px;color:var(--txt3)">'+p.margin+'% margin</div></div>'
      +'<span class="pill '+(p.status==='paid'?'pill-green':'pill-amber')+'">'+p.status+'</span>'
      +'<button class="btn btn-ghost" style="font-size:10px;padding:3px 8px" onclick="markPayoutPaid(this.dataset.id)" data-id="'+p.id+'">'+(p.status==='pending'?'Mark Paid':'✓ Paid')+'</button>'
      +'</div>';
  }).join('');

  // Populate cleaner dropdown in modal
  const sel = document.getElementById('pay-cleaner');
  if(sel) sel.innerHTML='<option value="">Select cleaner…</option>'+(cData.cleaners||[]).map(c=>'<option value="'+c.id+'">'+c.name+'</option>').join('');
  const jobSel = document.getElementById('pay-job');
  if(jobSel) jobSel.innerHTML='<option value="">Select job…</option>'+(cData.jobs||[]).map(j=>'<option value="'+j.id+'">'+j.propName+' — '+(j.date||'')+'</option>').join('');
}

function markPayoutPaid(id){const p=(cData.payouts||[]).find(x=>x.id===id);if(p){p.status='paid';saveUserData(cUid,cData);renderPayouts();toast('Marked as paid ✓');}}

// ════════════════════════════════════════════
//  PHOTO VAULT
// ════════════════════════════════════════════
function addVaultPhotos() {
  const propId = document.getElementById('vault-prop').value;
  const prop = cData.properties.find(p=>p.id===propId);
  const files = document.getElementById('vault-files').files;
  const type = document.getElementById('vault-type').value;
  const notes = document.getElementById('vault-notes').value;
  const cleaner = document.getElementById('vault-cleaner').value;
  if(!cData.vaultPhotos) cData.vaultPhotos=[];

  if(files.length===0){toast('Select at least one photo');return;}

  let processed=0;
  Array.from(files).forEach(function(file){
    const reader = new FileReader();
    reader.onload = function(e){
      cData.vaultPhotos.push({id:'vp_'+Date.now()+'_'+Math.random().toString(36).slice(2), propId, propName:prop?.name||'Unknown', propEmoji:prop?.emoji||'🏠', type, cleaner, notes, dataUrl:e.target.result, date:new Date().toISOString().slice(0,10), created:Date.now()});
      processed++;
      if(processed===files.length){saveUserData(cUid,cData);closeModal('add-vault-photo-modal');toast(files.length+' photo'+(files.length!==1?'s':'')+' saved to vault!');renderPhotoVault();}
    };
    reader.readAsDataURL(file);
  });
}

function renderPhotoVault() {
  if(!requireCohost('photovault')) return;
  const photos = cData.vaultPhotos||[];
  const propFilter = document.getElementById('vault-filter-prop')?.value||'';
  const typeFilter = document.getElementById('vault-filter-type')?.value||'';
  const thisMonth = new Date().toISOString().slice(0,7);

  const set=(id,v)=>{const el=document.getElementById(id);if(el)el.textContent=v;};
  set('vault-total',photos.length);
  set('vault-props',new Set(photos.map(p=>p.propId)).size);
  set('vault-month',photos.filter(p=>p.date?.startsWith(thisMonth)).length);
  set('vault-ready',photos.filter(p=>p.type==='after_clean').length);

  // Populate prop filter
  const pf = document.getElementById('vault-filter-prop');
  if(pf && cData.properties.length) {
    const cur = pf.value;
    pf.innerHTML='<option value="">All Properties</option>'+cData.properties.map(p=>'<option value="'+p.id+'">'+p.emoji+' '+p.name+'</option>').join('');
    pf.value=cur;
  }

  let filtered = photos;
  if(propFilter) filtered=filtered.filter(p=>p.propId===propFilter);
  if(typeFilter) filtered=filtered.filter(p=>p.type===typeFilter);

  const grid = document.getElementById('vault-grid');
  if(!grid) return;
  if(!filtered.length){grid.innerHTML='<div class="empty-state" style="grid-column:1/-1"><div class="es-i">📸</div><h3>No photos</h3><p>Upload service photos to build your proof-of-service library</p></div>';return;}

  const typeLabel={'after_clean':'✅ After Clean','before_clean':'🧹 Before','damage':'⚠️ Damage','maintenance':'🔧 Maintenance'};
  const typeColor={'after_clean':'var(--sage)','before_clean':'var(--txt3)','damage':'var(--terra)','maintenance':'var(--gold)'};
  grid.innerHTML=[...filtered].reverse().map(function(p){
    return '<div style="background:var(--card);border:1px solid var(--border);border-radius:12px;overflow:hidden">'
      +'<div style="position:relative">'
      +(p.dataUrl?'<img src="'+p.dataUrl+'" style="width:100%;height:140px;object-fit:cover">':'<div style="width:100%;height:140px;background:var(--sand);display:flex;align-items:center;justify-content:center;font-size:36px">'+p.propEmoji+'</div>')
      +'<span style="position:absolute;top:6px;left:6px;background:rgba(0,0,0,.6);color:#fff;border-radius:4px;padding:2px 6px;font-size:10px">'+(typeLabel[p.type]||p.type)+'</span>'
      +'</div>'
      +'<div style="padding:10px">'
      +'<div style="font-size:12px;font-weight:600;color:var(--txt)">'+p.propName+'</div>'
      +'<div style="font-size:10px;color:var(--txt3)">'+p.date+(p.cleaner?' · '+p.cleaner:'')+'</div>'
      +(p.notes?'<div style="font-size:11px;color:var(--txt2);margin-top:4px">'+p.notes+'</div>':'')
      +'<button class="btn btn-ghost" style="font-size:10px;padding:2px 8px;margin-top:6px;color:var(--terra)" onclick="removeVaultPhoto(this.dataset.id)" data-id="'+p.id+'">Delete</button>'
      +'</div></div>';
  }).join('');
}

function removeVaultPhoto(id){cData.vaultPhotos=(cData.vaultPhotos||[]).filter(x=>x.id!==id);saveUserData(cUid,cData);renderPhotoVault();toast('Photo removed');}

// ════════════════════════════════════════════
//  QR HOUSE MANUAL
// ════════════════════════════════════════════
function renderQRManual() {
  const sel = document.getElementById('qr-prop');
  if(sel) sel.innerHTML='<option value="">Select property…</option>'+cData.properties.map(p=>'<option value="'+p.id+'">'+p.emoji+' '+p.name+'</option>').join('');
}

function buildQRManual() {
  const propId = document.getElementById('qr-prop')?.value;
  const prop = cData.properties.find(p=>p.id===propId);
  const wifi = document.getElementById('qr-wifi')?.value||'—';
  const wifipw = document.getElementById('qr-wifipw')?.value||'—';
  const door = document.getElementById('qr-door')?.value||'—';
  const checkin = document.getElementById('qr-checkin')?.value||'3:00 PM';
  const checkout = document.getElementById('qr-checkout')?.value||'11:00 AM';
  const parking = document.getElementById('qr-parking')?.value||'See host';
  const rules = (document.getElementById('qr-rules')?.value||'').split('\n').filter(Boolean);
  const welcome = document.getElementById('qr-welcome')?.value||'Welcome to your stay!';

  const area = document.getElementById('qr-preview-area');
  if(!area) return;

  const manualHtml = '<div style="font-family:sans-serif;max-width:400px;margin:0 auto">'
    +'<div style="background:var(--terra);color:#fff;padding:20px;border-radius:12px;text-align:center;margin-bottom:14px">'
    +'<div style="font-size:36px;margin-bottom:6px">'+(prop?.emoji||'🏠')+'</div>'
    +'<div style="font-size:18px;font-weight:700">'+(prop?.name||'Your Property')+'</div>'
    +'<div style="font-size:12px;opacity:.8">'+(prop?.location||'')+'</div></div>'
    +'<div style="background:var(--sand);border-radius:10px;padding:14px;margin-bottom:10px">'
    +'<div style="font-size:11px;font-weight:700;letter-spacing:.5px;text-transform:uppercase;color:var(--txt3);margin-bottom:8px">Welcome</div>'
    +'<div style="font-size:13px;color:var(--txt);line-height:1.6">'+welcome+'</div></div>'
    +'<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:10px">'
    +'<div style="background:var(--sand);border-radius:10px;padding:12px"><div style="font-size:10px;color:var(--txt3);margin-bottom:4px">📶 WiFi</div><div style="font-size:13px;font-weight:600;color:var(--txt)">'+wifi+'</div><div style="font-size:11px;color:var(--txt2)">Password: '+wifipw+'</div></div>'
    +'<div style="background:var(--sand);border-radius:10px;padding:12px"><div style="font-size:10px;color:var(--txt3);margin-bottom:4px">🔑 Door Code</div><div style="font-size:22px;font-weight:700;color:var(--terra);letter-spacing:3px">'+door+'</div></div>'
    +'<div style="background:var(--sand);border-radius:10px;padding:12px"><div style="font-size:10px;color:var(--txt3);margin-bottom:4px">🕐 Check-in</div><div style="font-size:13px;font-weight:600;color:var(--txt)">After '+checkin+'</div></div>'
    +'<div style="background:var(--sand);border-radius:10px;padding:12px"><div style="font-size:10px;color:var(--txt3);margin-bottom:4px">🕙 Check-out</div><div style="font-size:13px;font-weight:600;color:var(--txt)">By '+checkout+'</div></div></div>'
    +(parking!=='See host'?'<div style="background:var(--sand);border-radius:10px;padding:12px;margin-bottom:10px"><div style="font-size:10px;color:var(--txt3);margin-bottom:4px">🅿️ Parking</div><div style="font-size:13px;color:var(--txt)">'+parking+'</div></div>':'')
    +(rules.length?'<div style="background:var(--sand);border-radius:10px;padding:12px;margin-bottom:10px"><div style="font-size:10px;color:var(--txt3);margin-bottom:8px;font-weight:700;letter-spacing:.5px;text-transform:uppercase">House Rules</div>'+rules.map(r=>'<div style="font-size:12px;color:var(--txt);padding:3px 0">• '+r+'</div>').join('')+'</div>':'')
    +'<div style="text-align:center;font-size:10px;color:var(--txt3);padding:10px">Powered by '+getBranding().name+'</div></div>';

  area.innerHTML = '<div id="qr-canvas-container" style="text-align:center;margin-bottom:14px">'
    +'<div style="display:inline-block;padding:12px;background:#fff;border-radius:8px;box-shadow:var(--sh)">'
    +'<div id="qr-placeholder" style="width:150px;height:150px;background:var(--sand);display:flex;align-items:center;justify-content:center;font-size:12px;color:var(--txt3)">Click Generate QR</div>'
    +'</div>'
    +'<div style="font-size:11px;color:var(--txt3);margin-top:6px">Scan to view house manual</div></div>'
    +'<div style="border:1px solid var(--border);border-radius:10px;overflow:hidden;max-height:300px;overflow-y:auto">'+manualHtml+'</div>';
}

function generateQRCode() {
  const wifi = document.getElementById('qr-wifi')?.value||'';
  const prop = cData.properties.find(p=>p.id===document.getElementById('qr-prop')?.value);
  if(!prop && !wifi){toast('Select a property or fill in WiFi details first');return;}

  buildQRManual();

  // Generate QR using a public API
  const manualUrl = 'https://csopropertyservices.com/?manual='+(prop?.id||'demo');
  const qrUrl = 'https://api.qrserver.com/v1/create-qr-code/?size=150x150&data='+encodeURIComponent(manualUrl);
  const container = document.getElementById('qr-placeholder');
  if(container) {
    container.innerHTML='';
    const img = document.createElement('img');
    img.src=qrUrl; img.style.cssText='width:150px;height:150px';
    img.onerror=()=>{ container.innerHTML='<div style="padding:10px;font-size:11px;color:var(--txt2)">QR generated! Print this page to share.</div>'; };
    container.appendChild(img);
  }
  toast('QR code generated! ✓ Print or screenshot to share with guests.');
}

function downloadManualPage() {
  const area = document.getElementById('qr-preview-area');
  if(!area){toast('Generate the manual first');return;}
  const prop = cData.properties.find(p=>p.id===document.getElementById('qr-prop')?.value);
  const blob = new Blob(['<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>House Manual</title><style>*{margin:0;padding:0;box-sizing:border-box}body{background:#FAF7F2;padding:20px;font-family:sans-serif}:root{--terra:#C4693A;--sand:#EDE8DE;--txt:#1C1410;--txt2:#6B5D52;--txt3:#9B8E85;--border:#E2DBD0}</style></head><body>'+area.innerHTML+'</body></html>'], {type:'text/html'});
  const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=(prop?.name||'property')+'-house-manual.html'; a.click();
  toast('Manual downloaded! ✓');
}

// ════════════════════════════════════════════
//  AI OFFICE HOURS
// ════════════════════════════════════════════
function toggleAIHours(el) {
  el.classList.toggle('on'); el.classList.toggle('off');
  const enabled = el.classList.contains('on');
  if(!cData.aiHours) cData.aiHours={};
  cData.aiHours.enabled = enabled;
  saveUserData(cUid,cData);
  toast('AI Office Hours '+(enabled?'ENABLED — AI will handle messages during off-hours':'disabled'));
}

function saveAIHours() {
  if(!cData.aiHours) cData.aiHours={};
  cData.aiHours.start = document.getElementById('ah-start')?.value||'22:00';
  cData.aiHours.end = document.getElementById('ah-end')?.value||'08:00';
  cData.aiHours.message = document.getElementById('ah-message')?.value||'';
  cData.aiHours.escalate = document.getElementById('ah-escalate')?.value||'emergency,urgent';
  saveUserData(cUid,cData);
  toast('Office hours settings saved ✓');
}

function renderAIHours() {
  const ah = cData.aiHours||{};
  const toggle = document.getElementById('aihours-toggle');
  if(toggle) { toggle.className = 'toggle '+(ah.enabled?'on':'off'); }
  const startEl = document.getElementById('ah-start'); if(startEl&&ah.start) startEl.value=ah.start;
  const endEl = document.getElementById('ah-end'); if(endEl&&ah.end) endEl.value=ah.end;
  const msgEl = document.getElementById('ah-message'); if(msgEl&&ah.message) msgEl.value=ah.message;
  const escEl = document.getElementById('ah-escalate'); if(escEl&&ah.escalate) escEl.value=ah.escalate;

  const set=(id,v)=>{const el=document.getElementById(id);if(el)el.textContent=v;};
  set('ah-auto-count', ah.autoCount||0);
  set('ah-escalate-count', ah.escalateCount||0);
  set('ah-hours-saved', Math.round((ah.autoCount||0)*0.1*10)/10+'h');

  // Render inventory checklist
  renderInvChecklist();
}

function renderInvChecklist() {
  const items = cData.invChecklist||[];
  const container = document.getElementById('inv-checklist-items');
  if(!container) return;
  container.innerHTML = items.map(function(item,i){
    return '<div style="display:flex;align-items:center;gap:8px">'
      +'<input type="checkbox" style="width:16px;height:16px;accent-color:var(--terra);flex-shrink:0">'
      +'<input value="'+item+'" onchange="updateChecklistItem('+i+',this.value)" style="flex:1;background:var(--input-bg);border:1px solid var(--input-border);border-radius:6px;padding:6px 10px;font-size:12px;color:var(--txt);outline:none">'
      +'<button onclick="removeChecklistItem('+i+')" style="background:none;border:none;cursor:pointer;color:var(--txt3);font-size:14px">×</button>'
      +'</div>';
  }).join('');
}

function addChecklistItem(){if(!cData.invChecklist)cData.invChecklist=[];cData.invChecklist.push('New item');saveUserData(cUid,cData);renderInvChecklist();}
function updateChecklistItem(i,v){if(cData.invChecklist&&cData.invChecklist[i]!==undefined){cData.invChecklist[i]=v;saveUserData(cUid,cData);}}
function removeChecklistItem(i){cData.invChecklist=(cData.invChecklist||[]).filter((_,idx)=>idx!==i);saveUserData(cUid,cData);renderInvChecklist();}
function saveInventoryChecklist(){saveUserData(cUid,cData);toast('Cleaning checklist saved ✓');}

// Check if AI should auto-respond (called from message receive flow)
function checkAIOfficeHours(messageText) {
  const ah = cData.aiHours||{};
  if(!ah.enabled) return null;
  const now = new Date();
  const hhmm = now.getHours().toString().padStart(2,'0')+':'+now.getMinutes().toString().padStart(2,'0');
  const start = ah.start||'22:00'; const end = ah.end||'08:00';
  const isOffHours = start > end ? (hhmm>=start||hhmm<end) : (hhmm>=start&&hhmm<end);
  if(!isOffHours) return null;

  // Check for escalation keywords
  const escWords = (ah.escalate||'emergency,urgent').split(',').map(w=>w.trim().toLowerCase());
  const isEscalation = escWords.some(w=>messageText.toLowerCase().includes(w));
  if(isEscalation) {
    if(!cData.aiHours.escalateCount) cData.aiHours.escalateCount=0;
    cData.aiHours.escalateCount++;
    saveUserData(cUid,cData);
    return (ah.message||'Hi! Message received.')+' ⚡ URGENT: Your host has been alerted immediately.';
  }

  if(!cData.aiHours.autoCount) cData.aiHours.autoCount=0;
  cData.aiHours.autoCount++;
  saveUserData(cUid,cData);
  return (ah.message||'Hi! I received your message and will respond during office hours.').replace('{host_name}', cUser?.name||'Your host');
}


// ════════════════════════════════════════════
//  OWNER REPORT SYSTEM
// ════════════════════════════════════════════
function switchReportTab(tab) {
  document.getElementById('rep-panel-summary').style.display = tab==='summary' ? 'block' : 'none';
  document.getElementById('rep-panel-owner').style.display   = tab==='owner'   ? 'block' : 'none';
  document.getElementById('rep-tab-summary').className = tab==='summary' ? 'btn btn-pri' : 'btn btn-ghost';
  document.getElementById('rep-tab-owner').className   = tab==='owner'   ? 'btn btn-pri' : 'btn btn-ghost';
  document.getElementById('rep-tab-summary').style.cssText = 'font-size:12px;padding:6px 14px;border-radius:8px 8px 0 0;border-bottom:none';
  document.getElementById('rep-tab-owner').style.cssText   = 'font-size:12px;padding:6px 14px;border-radius:8px 8px 0 0;border-bottom:none';
  if(tab==='owner') initOwnerReport();
}

function initOwnerReport() {
  // Populate property dropdown
  const sel = document.getElementById('or-prop');
  if(sel && cData.properties.length) {
    const cur = sel.value;
    sel.innerHTML = '<option value="">Select property…</option>' +
      cData.properties.map(p => '<option value="'+p.id+'">'+p.emoji+' '+p.name+'</option>').join('');
    if(cur) sel.value = cur;
  }
  // Default date range: this month
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0,10);
  const end = new Date(now.getFullYear(), now.getMonth()+1, 0).toISOString().slice(0,10);
  const startEl = document.getElementById('or-start');
  const endEl = document.getElementById('or-end');
  if(startEl && !startEl.value) startEl.value = start;
  if(endEl && !endEl.value) endEl.value = end;
  // Default biz name
  const bizEl = document.getElementById('or-biz');
  if(bizEl && !bizEl.value && cUser) bizEl.value = cUser.name + ' Property Management';
  // Default commission from settings
  const commEl = document.getElementById('or-commission');
  if(commEl && !commEl.value && cData.settings?.commission) commEl.value = cData.settings.commission;
  renderSentReports();
}

function buildOwnerReport() {
  const propId = document.getElementById('or-prop')?.value;
  const prop = cData.properties.find(p => p.id === propId);
  const preview = document.getElementById('or-preview');
  if(!preview) return;
  if(!prop) {
    preview.innerHTML = '<div style="padding:40px;text-align:center;color:#9B8E85;font-family:sans-serif"><div style="font-size:36px;margin-bottom:12px">📋</div><div>Select a property to preview</div></div>';
    return;
  }
  preview.innerHTML = generateOwnerReportHTML(false);
}

function generateOwnerReportHTML(forEmail) {
  const propId = document.getElementById('or-prop')?.value;
  const prop = cData.properties.find(p => p.id === propId);
  if(!prop) return '';

  const start = document.getElementById('or-start')?.value || '';
  const end   = document.getElementById('or-end')?.value   || '';
  const ownerName = document.getElementById('or-owner')?.value || 'Property Owner';
  const bizName   = document.getElementById('or-biz')?.value   || 'Property Management';
  const commission = parseFloat(document.getElementById('or-commission')?.value) || (cData.settings?.commission || 20);
  const notes = document.getElementById('or-notes')?.value || '';
  const generatedDate = new Date().toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric'});

  // ── Data calculations ──────────────────────────────────────────────────────
  const allBookings = (cData.bookings||[]).filter(b =>
    b.propId === propId && b.status !== 'cancelled' &&
    (!start || b.checkin >= start) && (!end || b.checkin <= end)
  );
  const totalRevenue = allBookings.reduce((s,b) => s+(b.price||0), 0);
  const totalNights  = allBookings.reduce((s,b) => s+(b.nights||0), 0);
  const avgPerNight  = totalNights ? Math.round(totalRevenue/totalNights) : 0;
  const commissionAmt = Math.round(totalRevenue * commission / 100);
  const ownerPayout   = totalRevenue - commissionAmt;

  // Period days & occupancy
  const periodDays = start && end
    ? Math.round((new Date(end) - new Date(start)) / 86400000) + 1
    : 30;
  const occupancy = periodDays ? Math.round(totalNights / periodDays * 100) : 0;

  // Expenses for this property in period
  const expenses = (cData.expenses||[]).filter(e =>
    e.propId === propId &&
    (!start || (e.date||'') >= start) &&
    (!end   || (e.date||'') <= end)
  );
  const totalExpenses = expenses.reduce((s,e) => s+(e.amount||0), 0);
  const netToOwner = ownerPayout - totalExpenses;

  // Reviews
  const reviews = (cData.reviews||[]).filter(r => r.propId === propId);
  const avgRating = reviews.length
    ? (reviews.reduce((s,r) => s+(r.rating||0), 0) / reviews.length).toFixed(1)
    : (prop.rating || '—');

  // Tasks completed in period
  const tasks = (cData.tasks||[]).filter(t =>
    t.propId === propId && t.done &&
    (!start || (t.completedDate||t.due||'') >= start)
  );

  // Vault photos for this property
  const photos = (cData.vaultPhotos||[]).filter(p =>
    p.propId === propId && p.type === 'after_clean' &&
    (!start || (p.date||'') >= start)
  );

  // Month label for header
  const periodLabel = start && end
    ? new Date(start).toLocaleDateString('en-US',{month:'long',year:'numeric'})
    : 'Monthly';

  // ── Color theme ─────────────────────────────────────────────────────────────
  const color = '#C4693A';
  const colorLight = '#F0A882';

  // ── Build booking rows ───────────────────────────────────────────────────────
  const bookingRows = allBookings.length
    ? allBookings.map(b =>
        '<tr style="border-bottom:1px solid #EDE8DE">' +
        '<td style="padding:9px 8px;font-size:12px;color:#1C1410">'+b.guestName+'</td>' +
        '<td style="padding:9px 8px;font-size:12px;color:#6B5D52">'+(b.checkin||'—')+'</td>' +
        '<td style="padding:9px 8px;font-size:12px;color:#6B5D52">'+(b.checkout||'—')+'</td>' +
        '<td style="padding:9px 8px;font-size:12px;text-align:center;color:#1C1410">'+(b.nights||0)+'</td>' +
        '<td style="padding:9px 8px;font-size:12px;text-align:right;color:#1C1410;font-weight:600">$'+(b.price||0).toLocaleString()+'</td>' +
        '</tr>'
      ).join('')
    : '<tr><td colspan="5" style="padding:20px;text-align:center;color:#9B8E85;font-size:12px">No bookings in this period</td></tr>';

  // ── Expense rows ─────────────────────────────────────────────────────────────
  const expenseRows = expenses.length
    ? expenses.map(e =>
        '<tr style="border-bottom:1px solid #EDE8DE">' +
        '<td style="padding:8px;font-size:12px;color:#1C1410">'+e.desc+'</td>' +
        '<td style="padding:8px;font-size:12px;color:#6B5D52">'+(e.date||'—')+'</td>' +
        '<td style="padding:8px;font-size:12px;text-align:right;color:#C4693A;font-weight:600">$'+(e.amount||0).toLocaleString()+'</td>' +
        '</tr>'
      ).join('')
    : '';

  // ── Photo gallery (first 6 after-clean shots) ────────────────────────────────
  const photoGallery = photos.length
    ? '<div style="margin-top:24px"><div style="font-size:11px;font-weight:700;letter-spacing:.8px;text-transform:uppercase;color:#9B8E85;margin-bottom:12px">Proof of Service — After Cleaning Photos</div><div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px">'+
      photos.slice(0,6).map(p =>
        p.dataUrl
          ? '<div style="border-radius:8px;overflow:hidden;aspect-ratio:4/3"><img src="'+p.dataUrl+'" style="width:100%;height:100%;object-fit:cover"></div>'
          : '<div style="background:#EDE8DE;border-radius:8px;aspect-ratio:4/3;display:flex;align-items:center;justify-content:center;font-size:24px">📸</div>'
      ).join('') + '</div></div>'
    : '';

  // ── Full HTML ─────────────────────────────────────────────────────────────────
  return '<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<title>Owner Report — '+prop.name+' — '+periodLabel+'</title>' +
    '<style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:Georgia,serif;background:#FAF7F2;color:#1C1410}@media print{body{background:#fff}.no-print{display:none}}</style>' +
    '</head><body>' +

    // Header
    '<div style="background:'+color+';padding:36px 40px;color:#fff">' +
      '<div style="display:flex;align-items:flex-start;justify-content:space-between;flex-wrap:wrap;gap:16px">' +
        '<div>' +
          '<div style="font-size:11px;letter-spacing:1.5px;text-transform:uppercase;opacity:.7;margin-bottom:8px">Property Management Report</div>' +
          '<div style="font-size:28px;font-weight:700;margin-bottom:4px">'+prop.emoji+' '+prop.name+'</div>' +
          '<div style="font-size:14px;opacity:.8">'+(prop.location||'')+'</div>' +
        '</div>' +
        '<div style="text-align:right">' +
          '<div style="font-size:13px;opacity:.7;margin-bottom:4px">Prepared by</div>' +
          '<div style="font-size:16px;font-weight:600">'+bizName+'</div>' +
          '<div style="font-size:12px;opacity:.7;margin-top:2px">'+generatedDate+'</div>' +
        '</div>' +
      '</div>' +
      '<div style="margin-top:20px;padding-top:20px;border-top:1px solid rgba(255,255,255,.25)">' +
        '<div style="font-size:13px;opacity:.7">Report Period</div>' +
        '<div style="font-size:18px;font-weight:600;margin-top:2px">'+periodLabel+(start&&end?' ('+start+' → '+end+')':'')+'</div>' +
      '</div>' +
    '</div>' +

    // Dear owner
    '<div style="background:#fff;padding:32px 40px;border-bottom:1px solid #EDE8DE">' +
      '<div style="font-size:14px;color:#1C1410;line-height:1.8">Dear <strong>'+ownerName+'</strong>,<br><br>' +
      'Please find your monthly performance summary for <strong>'+prop.name+'</strong> below. ' +
      'Your property performed '+
        (occupancy>=70?'exceptionally well':occupancy>=50?'solidly':occupancy>=30?'steadily':'with room to grow')+
      ' this period with a '+occupancy+'% occupancy rate.' +
      (notes ? '<br><br><em style="color:#6B5D52">'+notes+'</em>' : '') +
      '</div>' +
    '</div>' +

    // KPI cards
    '<div style="background:#FAF7F2;padding:28px 40px">' +
      '<div style="font-size:11px;font-weight:700;letter-spacing:.8px;text-transform:uppercase;color:#9B8E85;margin-bottom:16px">Performance Summary</div>' +
      '<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:28px">' +
        kpiCard('Gross Revenue', '$'+totalRevenue.toLocaleString(), color) +
        kpiCard('Occupancy Rate', occupancy+'%', occupancy>=70?'#6B8F71':occupancy>=40?'#C8A84B':'#C4693A') +
        kpiCard('Avg/Night', '$'+avgPerNight, '#1E2D40') +
        kpiCard('Total Bookings', allBookings.length.toString(), '#6B8F71') +
      '</div>' +

      // Payout summary
      '<div style="background:#fff;border-radius:12px;padding:20px;border:1px solid #E2DBD0;margin-bottom:20px">' +
        '<div style="font-size:11px;font-weight:700;letter-spacing:.8px;text-transform:uppercase;color:#9B8E85;margin-bottom:14px">Financial Summary</div>' +
        '<div style="display:flex;flex-direction:column;gap:10px">' +
          payoutRow('Gross Revenue', '$'+totalRevenue.toLocaleString(), false) +
          payoutRow('Management Fee ('+commission+'%)', '-$'+commissionAmt.toLocaleString(), false) +
          (totalExpenses ? payoutRow('Expenses & Maintenance', '-$'+totalExpenses.toLocaleString(), false) : '') +
          '<div style="border-top:2px solid #1C1410;margin:4px 0"></div>' +
          payoutRow('Net to Owner', '$'+netToOwner.toLocaleString(), true) +
        '</div>' +
      '</div>' +

      // Bookings table
      '<div style="background:#fff;border-radius:12px;padding:20px;border:1px solid #E2DBD0;margin-bottom:20px">' +
        '<div style="font-size:11px;font-weight:700;letter-spacing:.8px;text-transform:uppercase;color:#9B8E85;margin-bottom:14px">Bookings This Period</div>' +
        '<table style="width:100%;border-collapse:collapse">' +
          '<thead><tr style="border-bottom:2px solid #EDE8DE">' +
            '<th style="padding:8px;font-size:11px;text-align:left;color:#9B8E85;font-weight:700;letter-spacing:.5px;text-transform:uppercase">Guest</th>' +
            '<th style="padding:8px;font-size:11px;text-align:left;color:#9B8E85;font-weight:700;letter-spacing:.5px;text-transform:uppercase">Check-in</th>' +
            '<th style="padding:8px;font-size:11px;text-align:left;color:#9B8E85;font-weight:700;letter-spacing:.5px;text-transform:uppercase">Check-out</th>' +
            '<th style="padding:8px;font-size:11px;text-align:center;color:#9B8E85;font-weight:700;letter-spacing:.5px;text-transform:uppercase">Nights</th>' +
            '<th style="padding:8px;font-size:11px;text-align:right;color:#9B8E85;font-weight:700;letter-spacing:.5px;text-transform:uppercase">Revenue</th>' +
          '</tr></thead>' +
          '<tbody>'+bookingRows+'</tbody>' +
        '</table>' +
      '</div>' +

      // Expenses table (if any)
      (expenses.length ?
        '<div style="background:#fff;border-radius:12px;padding:20px;border:1px solid #E2DBD0;margin-bottom:20px">' +
          '<div style="font-size:11px;font-weight:700;letter-spacing:.8px;text-transform:uppercase;color:#9B8E85;margin-bottom:14px">Expenses & Maintenance</div>' +
          '<table style="width:100%;border-collapse:collapse">' +
            '<thead><tr style="border-bottom:2px solid #EDE8DE">' +
              '<th style="padding:8px;font-size:11px;text-align:left;color:#9B8E85;font-weight:700;letter-spacing:.5px;text-transform:uppercase">Description</th>' +
              '<th style="padding:8px;font-size:11px;text-align:left;color:#9B8E85;font-weight:700;letter-spacing:.5px;text-transform:uppercase">Date</th>' +
              '<th style="padding:8px;font-size:11px;text-align:right;color:#9B8E85;font-weight:700;letter-spacing:.5px;text-transform:uppercase">Amount</th>' +
            '</tr></thead>' +
            '<tbody>'+expenseRows+'</tbody>' +
          '</table>' +
        '</div>' : '') +

      // Rating & tasks
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:20px">' +
        '<div style="background:#fff;border-radius:12px;padding:20px;border:1px solid #E2DBD0;text-align:center">' +
          '<div style="font-size:11px;font-weight:700;letter-spacing:.8px;text-transform:uppercase;color:#9B8E85;margin-bottom:10px">Guest Rating</div>' +
          '<div style="font-size:42px;font-family:Georgia,serif;color:'+color+'">⭐ '+avgRating+'</div>' +
          '<div style="font-size:12px;color:#9B8E85;margin-top:4px">Based on '+reviews.length+' review'+(reviews.length!==1?'s':'')+'</div>' +
        '</div>' +
        '<div style="background:#fff;border-radius:12px;padding:20px;border:1px solid #E2DBD0;text-align:center">' +
          '<div style="font-size:11px;font-weight:700;letter-spacing:.8px;text-transform:uppercase;color:#9B8E85;margin-bottom:10px">Tasks Completed</div>' +
          '<div style="font-size:42px;font-family:Georgia,serif;color:#6B8F71">'+tasks.length+'</div>' +
          '<div style="font-size:12px;color:#9B8E85;margin-top:4px">Cleaning & maintenance jobs</div>' +
        '</div>' +
      '</div>' +

      // Photo gallery
      photoGallery +

      // Footer
      '<div style="margin-top:32px;padding-top:20px;border-top:1px solid #E2DBD0;text-align:center">' +
        '<div style="font-size:12px;color:#9B8E85">This report was prepared by <strong>'+bizName+'</strong> using CSO Property Services Property Management.</div>' +
        '<div style="font-size:11px;color:#C4C4B4;margin-top:4px">Questions? Reply to this email or contact your property manager directly.</div>' +
      '</div>' +

    '</div>' +
    '</body></html>';
}

// Helper functions for report HTML generation
function kpiCard(label, value, color) {
  return '<div style="background:#fff;border-radius:10px;padding:16px;border:1px solid #E2DBD0;text-align:center">' +
    '<div style="font-size:10px;font-weight:700;letter-spacing:.7px;text-transform:uppercase;color:#9B8E85;margin-bottom:8px">'+label+'</div>' +
    '<div style="font-size:26px;font-family:Georgia,serif;color:'+color+'">'+value+'</div>' +
    '</div>';
}

function payoutRow(label, value, isTotal) {
  return '<div style="display:flex;justify-content:space-between;align-items:center;padding:'+(isTotal?'8px 0':'4px 0')+'">' +
    '<div style="font-size:'+(isTotal?'14px':'13px')+';color:#1C1410;font-weight:'+(isTotal?'700':'400')+'">'+label+'</div>' +
    '<div style="font-size:'+(isTotal?'18px':'13px')+';font-family:Georgia,serif;color:'+(isTotal?'#6B8F71':'#1C1410')+';font-weight:'+(isTotal?'700':'600')+'">'+value+'</div>' +
    '</div>';
}

function downloadOwnerReport() {
  const propId = document.getElementById('or-prop')?.value;
  const prop = cData.properties.find(p => p.id === propId);
  if(!prop) { toast('Select a property first'); return; }
  const html = generateOwnerReportHTML(false);
  if(!html) { toast('No data to generate report'); return; }
  const period = document.getElementById('or-start')?.value?.slice(0,7) || new Date().toISOString().slice(0,7);
  const filename = prop.name.toLowerCase().replace(/\s+/g,'-') + '-owner-report-' + period + '.html';
  const a = document.createElement('a');
  a.href = 'data:text/html;charset=utf-8,' + encodeURIComponent(html);
  a.download = filename;
  a.click();
  toast('Owner report downloaded! ✓');
  logSentReport('downloaded');
}

async function sendOwnerReport() {
  if(!(cData?.plan === 'cohost' || cData?.plan === 'cohost_starter' || isAdmin)) { showUpgradeModal('Owner Reports are a Co-Host feature. Upgrade to unlock it.', 'cohost_starter'); return; }
  const propId = document.getElementById('or-prop')?.value;
  const prop = cData.properties.find(p => p.id === propId);
  const ownerEmail = document.getElementById('or-email')?.value?.trim();
  const ownerName = document.getElementById('or-owner')?.value?.trim() || 'Property Owner';
  const bizName = document.getElementById('or-biz')?.value?.trim() || 'Property Management';

  if(!prop) { toast('Select a property first'); return; }
  if(!ownerEmail) { toast('Enter the owner email address'); return; }
  if(!cData.apiKey && !cData.resendKey) { toast('Add your Resend API key in Settings to send emails'); return; }

  const statusEl = document.getElementById('or-send-status');
  if(statusEl) { statusEl.style.display='block'; statusEl.textContent='Sending report…'; statusEl.style.color='var(--txt3)'; }

  const html = generateOwnerReportHTML(true);
  const period = document.getElementById('or-start')?.value?.slice(0,7) || new Date().toISOString().slice(0,7);
  const subject = prop.name + ' — Monthly Owner Report (' + new Date(period+'-01').toLocaleDateString('en-US',{month:'long',year:'numeric'}) + ')';

  try {
    const res = await fetch('https://vdnyqwpznsysrvyvbqga.supabase.co/functions/v1/send-notification', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({
        to: ownerEmail,
        subject: subject,
        html: html,
        from: bizName + ' <csopropertyservice@gmail.com>'
      })
    });
    const result = await res.json();
    if(result.ok || result.id) {
      if(statusEl) { statusEl.textContent='✓ Report sent to '+ownerEmail; statusEl.style.color='var(--sage)'; }
      toast('Owner report sent to '+ownerEmail+' ✓');
      logSentReport('emailed', ownerEmail);
    } else {
      throw new Error(result.message || 'Send failed');
    }
  } catch(e) {
    if(statusEl) { statusEl.textContent='Send failed: '+e.message+'. Download and email manually.'; statusEl.style.color='var(--terra)'; }
    toast('Email failed — download and send manually');
  }
}

function logSentReport(method, email) {
  const propId = document.getElementById('or-prop')?.value;
  const prop = cData.properties.find(p => p.id === propId);
  const period = document.getElementById('or-start')?.value?.slice(0,7) || new Date().toISOString().slice(0,7);
  if(!cData.sentReports) cData.sentReports = [];
  cData.sentReports.push({
    id: 'sr_'+Date.now(),
    propId, propName: prop?.name||'',
    period, method,
    email: email||'',
    sentAt: new Date().toISOString()
  });
  saveUserData(cUid, cData);
  renderSentReports();
}

function renderSentReports() {
  const el = document.getElementById('or-sent-log');
  if(!el) return;
  const reports = (cData.sentReports||[]).slice().reverse().slice(0,10);
  if(!reports.length) { el.innerHTML='<div style="font-size:13px;color:var(--txt3)">No reports sent yet</div>'; return; }
  el.innerHTML = reports.map(r =>
    '<div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid var(--border)">' +
    '<div style="font-size:18px">'+(r.method==='emailed'?'📧':'⬇️')+'</div>' +
    '<div style="flex:1"><div style="font-size:12px;font-weight:600;color:var(--txt)">'+r.propName+' — '+r.period+'</div>' +
    '<div style="font-size:11px;color:var(--txt3)">'+(r.method==='emailed'?'Emailed to '+r.email:'Downloaded')+' · '+new Date(r.sentAt).toLocaleDateString()+'</div></div>' +
    '</div>'
  ).join('');
}


// ════════════════════════════════════════════
//  OWNER MANAGEMENT
// ════════════════════════════════════════════
function addOwner() {
  const name = sanitizeInput(document.getElementById('own-name').value.trim());
  if(!name){toast('Enter owner name');return;}
  const emailRaw = sanitizeInput(document.getElementById('own-email').value.trim());
  if(emailRaw && !isValidEmail(emailRaw)){toast('Enter a valid owner email');return;}
  if(!cData.owners) cData.owners=[];
  const sel = document.getElementById('own-props-sel');
  const propIds = sel ? Array.from(sel.selectedOptions).map(o=>o.value).filter(Boolean) : [];
  cData.owners.push({
    id:'own_'+Date.now(), name,
    email:emailRaw,
    phone:sanitizeInput(document.getElementById('own-phone').value.trim()),
    commission:parseFloat(document.getElementById('own-commission').value)||20,
    propIds, payment:sanitizeInput(document.getElementById('own-payment').value.trim()),
    notes:sanitizeInput(document.getElementById('own-notes').value.trim()),
    created:Date.now()
  });
  saveUserData(cUid,cData);
  closeModal('add-owner-modal');
  toast(name+' added!');
  renderOwners();
}

function renderOwners() {
  if(!requireCohost('owners')) return;
  const owners = cData.owners||[];
  const set=(id,v)=>{const el=document.getElementById(id);if(el)el.textContent=v;};

  // Populate property select in modal
  const sel = document.getElementById('own-props-sel');
  if(sel) sel.innerHTML = cData.properties.map(p=>'<option value="'+p.id+'">'+p.emoji+' '+p.name+'</option>').join('');

  set('own-total', owners.length);
  const totalProps = owners.reduce((s,o)=>s+(o.propIds||[]).length,0);
  set('own-props', totalProps);
  const avgComm = owners.length ? Math.round(owners.reduce((s,o)=>s+(o.commission||0),0)/owners.length) : 0;
  set('own-avg-comm', avgComm+'%');
  const sentCount = (cData.sentReports||[]).length;
  set('own-reports', sentCount);

  const list = document.getElementById('owners-list');
  if(!list) return;
  if(!owners.length){
    list.innerHTML='<div class="empty-state"><div class="es-i">🤝</div><h3>No owners yet</h3><button class="btn btn-pri" onclick="openModal(\"add-owner-modal\")" style="margin-top:10px">Add First Owner</button></div>';
    return;
  }

  const thisMonth = new Date().toISOString().slice(0,7);
  list.innerHTML = owners.map(function(o) {
    var props = (o.propIds||[]).map(function(pid){ var p=cData.properties.find(x=>x.id===pid); return p?p.emoji+' '+p.name:''; }).filter(Boolean);
    var monthBookings = (cData.bookings||[]).filter(function(b){ return (o.propIds||[]).includes(b.propId)&&b.checkin&&b.checkin.startsWith(thisMonth)&&b.status!=='cancelled'; });
    var grossRev = monthBookings.reduce(function(s,b){return s+(b.price||0);},0);
    var myComm = Math.round(grossRev*(o.commission||(cData.settings?.commission||20))/100);
    var sentReports = (cData.sentReports||[]).filter(function(r){ return (o.propIds||[]).includes(r.propId); }).length;
    return '<div class="card" style="margin-bottom:12px">'
      +'<div class="card-hd">'
        +'<div style="display:flex;align-items:center;gap:12px">'
          +'<div style="width:42px;height:42px;border-radius:50%;background:var(--gold);color:#2C1F14;display:flex;align-items:center;justify-content:center;font-size:18px;font-weight:700;flex-shrink:0">'+o.name[0].toUpperCase()+'</div>'
          +'<div>'
            +'<div style="font-size:15px;font-weight:600;color:var(--txt)">'+o.name+'</div>'
            +'<div style="font-size:12px;color:var(--txt3)">'+(o.email||'No email')+' · '+(o.phone||'No phone')+'</div>'
          +'</div>'
        +'</div>'
        +'<div style="display:flex;gap:6px">'
          +'<button class="btn btn-ghost" style="font-size:11px;padding:4px 9px" onclick="quickSendReport(this.dataset.id)" data-id="'+o.id+'">📧 Send Report</button>'
          +'<button class="btn btn-ghost" style="font-size:11px;padding:4px 9px;color:var(--terra)" onclick="removeOwner(this.dataset.id)" data-id="'+o.id+'">🗑</button>'
        +'</div>'
      +'</div>'
      +'<div class="card-body">'
        +'<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:12px">'
          +'<div style="background:var(--sand);border-radius:8px;padding:10px;text-align:center"><div style="font-size:10px;color:var(--txt3);margin-bottom:3px">Commission</div><div style="font-family:Fraunces,serif;font-size:18px;color:var(--terra)">'+(o.commission||(cData.settings?.commission||20))+'%</div></div>'
          +'<div style="background:var(--sand);border-radius:8px;padding:10px;text-align:center"><div style="font-size:10px;color:var(--txt3);margin-bottom:3px">This Month Gross</div><div style="font-family:Fraunces,serif;font-size:18px;color:var(--txt)">$'+grossRev.toLocaleString()+'</div></div>'
          +'<div style="background:var(--sand);border-radius:8px;padding:10px;text-align:center"><div style="font-size:10px;color:var(--txt3);margin-bottom:3px">Your Earn</div><div style="font-family:Fraunces,serif;font-size:18px;color:var(--sage)">$'+myComm.toLocaleString()+'</div></div>'
          +'<div style="background:var(--sand);border-radius:8px;padding:10px;text-align:center"><div style="font-size:10px;color:var(--txt3);margin-bottom:3px">Reports Sent</div><div style="font-family:Fraunces,serif;font-size:18px;color:var(--txt)">'+sentReports+'</div></div>'
        +'</div>'
        +(props.length?'<div style="font-size:12px;color:var(--txt2);margin-bottom:6px"><strong>Properties:</strong> '+props.join(', ')+'</div>':'')
        +(o.payment?'<div style="font-size:12px;color:var(--txt2);margin-bottom:6px"><strong>Pays via:</strong> '+o.payment+'</div>':'')
        +(o.notes?'<div style="font-size:12px;color:var(--txt3);font-style:italic">'+o.notes+'</div>':'')
      +'</div>'
    +'</div>';
  }).join('');
}

function removeOwner(id){
  if(!confirm('Remove this owner?')) return;
  cData.owners=(cData.owners||[]).filter(x=>x.id!==id);
  saveUserData(cUid,cData); renderOwners(); toast('Owner removed');
}

function quickSendReport(ownerId) {
  const o = (cData.owners||[]).find(x=>x.id===ownerId);
  if(!o){toast('Owner not found');return;}
  if(!o.email){toast('No email on file for this owner');return;}
  if(!(o.propIds||[]).length){toast('No properties linked to this owner');return;}
  // Pre-fill owner report and switch to it
  nav('reports', document.querySelector('[onclick*=reports]'));
  setTimeout(function(){
    switchReportTab('owner');
    setTimeout(function(){
      const propSel = document.getElementById('or-prop');
      if(propSel && o.propIds[0]) { propSel.value=o.propIds[0]; buildOwnerReport(); }
      const emailEl = document.getElementById('or-email'); if(emailEl) emailEl.value=o.email;
      const ownerEl = document.getElementById('or-owner'); if(ownerEl) ownerEl.value=o.name;
      const commEl  = document.getElementById('or-commission'); if(commEl) commEl.value=o.commission||20;
      buildOwnerReport();
      toast('Report pre-filled for '+o.name+' — review and click Email to Owner');
    }, 150);
  }, 100);
}

async function sendAllOwnerReports() {
  const owners = (cData.owners||[]).filter(o=>o.email&&(o.propIds||[]).length);
  if(!owners.length){toast('No owners with email + properties linked');return;}
  toast('Sending '+owners.length+' owner report'+( owners.length!==1?'s':'')+'…');
  var sent=0, failed=0;
  for(var i=0;i<owners.length;i++){
    try {
      await quickSendReportSilent(owners[i]);
      sent++;
    } catch(e) {
      failed++;
      console.error('Report failed for '+owners[i].name+':',e);
    }
    await new Promise(r=>setTimeout(r,600));
  }
  if(failed) toast(sent+' reports sent, '+failed+' failed — check emails');
  else toast('All '+sent+' owner reports sent! ✓');
}

async function quickSendReportSilent(o) {
  if(!o.email||(!(o.propIds||[]).length)) return;
  try {
    const propSel = document.getElementById('or-prop');
    const emailEl = document.getElementById('or-email');
    const ownerEl = document.getElementById('or-owner');
    const commEl  = document.getElementById('or-commission');
    if(propSel) propSel.value=o.propIds[0];
    if(emailEl) emailEl.value=o.email;
    if(ownerEl) ownerEl.value=o.name;
    if(commEl)  commEl.value=o.commission||20;
    await sendOwnerReport();
  } catch(e) {
    throw new Error('Failed for '+o.name+': '+e.message);
  }
}

// ════════════════════════════════════════════
//  COHOST COMMAND CENTER
// ════════════════════════════════════════════
function renderCohostCmd() {
  if(!requireCohost('cohost_cmd')) return;
  const now = new Date();
  const thisMonth = now.toISOString().slice(0,7);
  const bookings = (cData.bookings||[]).filter(b=>b.status!=='cancelled'&&b.checkin&&b.checkin.startsWith(thisMonth));
  const grossRev = bookings.reduce((s,b)=>s+(b.price||0),0);

  // Figure out default commission from first owner or 20%
  const defaultComm = (cData.owners||[]).length ? (cData.owners[0].commission||20) : 20;
  const myEarnings = Math.round(grossRev * defaultComm / 100);

  // Outstanding payouts
  const outstanding = (cData.payouts||[]).filter(p=>p.status==='pending').reduce((s,p)=>s+(p.owed||0),0);

  const set=(id,v)=>{const el=document.getElementById(id);if(el)el.textContent=v;};
  set('cmd-takehome','$'+myEarnings.toLocaleString());
  set('cmd-gross','$'+grossRev.toLocaleString());
  set('cmd-outstanding','$'+outstanding.toLocaleString());
  set('cmd-props',cData.properties.length);

  // AI Office Hours status
  const aiEl = document.getElementById('cmd-aistatus');
  if(aiEl){
    const ah = cData.aiHours||{};
    if(ah.enabled){
      aiEl.textContent='🟢 Active ('+ah.start+' – '+ah.end+')';
      aiEl.style.color='var(--sage)';
    } else {
      aiEl.textContent='⚫ Off — guests get manual replies only';
      aiEl.style.color='var(--txt3)';
    }
  }

  // Portfolio
  renderCmdPortfolio(thisMonth);

  // Contractors
  renderCmdContractors();
}

function renderCmdPortfolio(thisMonth) {
  const el = document.getElementById('cmd-portfolio');
  if(!el) return;
  if(!cData.properties.length){
    el.innerHTML='<div class="empty-state"><div class="es-i">🏘</div><h3>No properties yet</h3></div>';
    return;
  }

  el.innerHTML = cData.properties.map(function(p) {
    var owner = (cData.owners||[]).find(function(o){ return (o.propIds||[]).includes(p.id); });
    var propBookings = (cData.bookings||[]).filter(function(b){ return b.propId===p.id&&b.status!=='cancelled'&&b.checkin&&b.checkin.startsWith(thisMonth); });
    var gross = propBookings.reduce(function(s,b){return s+(b.price||0);},0);
    var comm = owner ? (owner.commission||20) : 20;
    var myNet = Math.round(gross*comm/100);
    var ownerPayout = gross - myNet;
    var lastPhoto = (cData.vaultPhotos||[]).filter(function(ph){ return ph.propId===p.id&&ph.type==='after_clean'; }).slice(-1)[0];
    var lastReport = (cData.sentReports||[]).filter(function(r){ return r.propId===p.id; }).slice(-1)[0];

    return '<div style="display:flex;align-items:center;gap:14px;padding:12px 0;border-bottom:1px solid var(--border)">'
      +'<div style="font-size:28px;flex-shrink:0">'+p.emoji+'</div>'
      +'<div style="flex:1;min-width:0">'
        +'<div style="font-size:14px;font-weight:600;color:var(--txt)">'+p.name+'</div>'
        +'<div style="font-size:12px;color:var(--txt3)">'+(owner?'Owner: '+owner.name:'⚠ No owner linked')+'</div>'
        +'<div style="font-size:11px;color:var(--txt3);margin-top:2px">'
          +'Last photo: '+(lastPhoto?lastPhoto.date:'none')+' · '
          +'Last report: '+(lastReport?lastReport.period:'never sent')
        +'</div>'
      +'</div>'
      +'<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;flex-shrink:0">'
        +'<div style="text-align:center;background:var(--sand);border-radius:8px;padding:8px 10px"><div style="font-size:10px;color:var(--txt3)">Gross</div><div style="font-family:Fraunces,serif;font-size:15px;color:var(--txt)">$'+gross.toLocaleString()+'</div></div>'
        +'<div style="text-align:center;background:rgba(107,143,113,.1);border-radius:8px;padding:8px 10px"><div style="font-size:10px;color:var(--txt3)">My '+comm+'%</div><div style="font-family:Fraunces,serif;font-size:15px;color:var(--sage)">$'+myNet.toLocaleString()+'</div></div>'
        +'<div style="text-align:center;background:var(--sand);border-radius:8px;padding:8px 10px"><div style="font-size:10px;color:var(--txt3)">Owner</div><div style="font-family:Fraunces,serif;font-size:15px;color:var(--txt)">$'+ownerPayout.toLocaleString()+'</div></div>'
      +'</div>'
      +(owner?'<button class="btn btn-ghost" style="font-size:10px;padding:4px 9px;flex-shrink:0" onclick="quickSendReport(this.dataset.id)" data-id="'+owner.id+'">📧 Report</button>':'<button class="btn btn-ghost" style="font-size:10px;padding:4px 9px;flex-shrink:0" onclick="openModal(\"add-owner-modal\")">Link Owner</button>')
    +'</div>';
  }).join('');
}

function renderCmdContractors() {
  const el = document.getElementById('cmd-contractors');
  if(!el) return;
  const payouts = cData.payouts||[];
  if(!payouts.length){el.innerHTML='<div style="font-size:13px;color:var(--txt3)">No payout records yet</div>';return;}

  // Group by cleaner
  const byContractor = {};
  payouts.forEach(function(p){
    if(!byContractor[p.cleanerName]) byContractor[p.cleanerName]={name:p.cleanerName,pending:0,paid:0,total:0};
    byContractor[p.cleanerName].total+=(p.owed||0);
    if(p.status==='pending') byContractor[p.cleanerName].pending+=(p.owed||0);
    else byContractor[p.cleanerName].paid+=(p.owed||0);
  });

  el.innerHTML = Object.values(byContractor).map(function(c){
    return '<div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid var(--border)">'
      +'<div style="flex:1"><div style="font-size:13px;font-weight:600;color:var(--txt)">'+c.name+'</div>'
      +'<div style="font-size:11px;color:var(--txt3)">Total paid: $'+c.paid.toLocaleString()+'</div></div>'
      +(c.pending?'<span class="pill pill-amber">Owes $'+c.pending.toLocaleString()+'</span>':'<span class="pill pill-green">All paid ✓</span>')
    +'</div>';
  }).join('');
}


// ════════════════════════════════════════════
//  FEEDBACK SYSTEM
// ════════════════════════════════════════════
let fbRating = 0;

function setFbRating(val) {
  fbRating = val;
  document.querySelectorAll('#fb-stars span').forEach(function(s) {
    s.style.opacity = parseInt(s.dataset.val) <= val ? '1' : '0.3';
  });
}

async function submitFeedback() {
  const message = cleanInput(document.getElementById('fb-message')?.value?.trim(), 2000);
  const type = document.getElementById('fb-type')?.value || 'other';
  if(!message){toast('Please write something first');return;}

  const btn = document.querySelector('#feedback-modal .btn-pri');
  if(btn){btn.textContent='Sending…';btn.disabled=true;}

  try {
    const payload = {
      user_id: cUid,
      user_email: cUser?.email || 'anonymous',
      user_name: cUser?.name || 'Unknown',
      user_plan: cData?.plan || 'free',
      type, message,
      rating: fbRating || null,
      created_at: new Date().toISOString()
    };

    // Store in Supabase feedback table
    let feedbackRes; try { feedbackRes = await sb.from('feedback').insert([payload]); } catch(e) { feedbackRes = {error:e}; } const error = feedbackRes?.error;

    if(error && error.code !== '42P01') {
      sbHandleError(error, 'feedback insert');
      // Table doesn't exist yet — fall back to notification email
      await fetch('https://vdnyqwpznsysrvyvbqga.supabase.co/functions/v1/send-notification', {
        method:'POST',
        headers:{'Content-Type':'application/json','Authorization':'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZkbnlxd3B6bnN5c3J2eXZicWdhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ2NjM4NjUsImV4cCI6MjA5MDIzOTg2NX0.VxwNE_lMR2JV_70SVr9rio_UgfbKGnYFyeitkTuWYkM'},
        body: JSON.stringify({type:'feedback', hostEmail: ADMIN_EMAIL, data: payload})
      });
    }

    closeModal('feedback-modal');
    document.getElementById('fb-message').value = '';
    fbRating = 0;
    document.querySelectorAll('#fb-stars span').forEach(s=>s.style.opacity='0.4');
    toast('Thank you! Your feedback means a lot 🙏');
  } catch(e) {
    toast('Feedback sent! ✓');
    closeModal('feedback-modal');
  } finally {
    if(btn){btn.textContent='Send Feedback →';btn.disabled=false;}
  }
}

async function loadFeedback() {
  const el = document.getElementById('adm-feedback-list');
  if(!el) return;
  el.innerHTML = '<div style="font-size:13px;color:var(--txt3)">Loading…</div>';

  try {
    let feedbackData = null, feedbackError = null;
  try { const r = await sb.from('feedback').select('*').order('created_at',{ascending:false}); feedbackData = r.data; feedbackError = r.error; } catch(e) { feedbackError = e; }
  const data = feedbackData, error = feedbackError;
    if(error) sbHandleError(error, 'loadFeedback');
    if(error || !data) {
      el.innerHTML = '<div style="font-size:13px;color:var(--txt2)">No feedback yet — or run this SQL in Supabase to create the table:<br><br><code style="background:var(--sand);padding:8px;border-radius:6px;font-size:11px;display:block;margin-top:8px">CREATE TABLE feedback (id uuid DEFAULT gen_random_uuid() PRIMARY KEY, user_id text, user_email text, user_name text, user_plan text, type text, message text, rating int, created_at timestamptz DEFAULT now());</code></div>';
      return;
    }

    const badge = document.getElementById('adm-feedback-badge');
    if(badge && data.length) {badge.textContent=data.length;badge.style.display='inline';}

    if(!data.length){el.innerHTML='<div class="empty-state"><div class="es-i">💬</div><p>No feedback yet</p></div>';return;}

    const typeEmoji = {feature:'💡',bug:'🐛',praise:'⭐',other:'💬'};
    const planColors = {pro:'var(--sage)',business:'var(--terra)',cohost:'var(--gold)',free:'var(--txt3)',trial:'var(--gold)'};
    el.innerHTML = data.map(function(f) {
      var stars = f.rating ? '⭐'.repeat(f.rating) : '';
      var date = f.created_at ? new Date(f.created_at).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}) : '—';
      return '<div style="padding:16px 0;border-bottom:1px solid var(--border)">'
        +'<div style="display:flex;align-items:flex-start;gap:12px">'
          +'<div style="font-size:22px;flex-shrink:0">'+(typeEmoji[f.type]||'💬')+'</div>'
          +'<div style="flex:1">'
            +'<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;flex-wrap:wrap">'
              +'<span style="font-size:13px;font-weight:600;color:var(--txt)">'+(f.user_name||'Anonymous')+'</span>'
              +'<span style="font-size:10px;color:'+(planColors[f.user_plan]||'var(--txt3)')+'">'+( f.user_plan||'free').toUpperCase()+'</span>'
              +'<span style="font-size:11px;color:var(--txt3)">'+(f.user_email||'')+'</span>'
              +'<span style="font-size:11px;color:var(--txt3);margin-left:auto">'+date+'</span>'
            +'</div>'
            +'<div style="font-size:13px;color:var(--txt);line-height:1.6;background:var(--sand);border-radius:8px;padding:10px 12px">'+f.message+'</div>'
            +(stars?'<div style="margin-top:6px;font-size:13px">'+stars+'</div>':'')
          +'</div>'
        +'</div>'
      +'</div>';
    }).join('');
  } catch(e) {
    el.innerHTML = '<div style="font-size:13px;color:var(--terra)">Error: '+e.message+'</div>';
  }
}

// ════════════════════════════════════════════
//  ADMIN TAB SWITCHER
// ════════════════════════════════════════════
function switchAdminTab(tab) {
  document.getElementById('adm-panel-users').style.display    = tab==='users'    ? 'block' : 'none';
  document.getElementById('adm-panel-feedback').style.display = tab==='feedback' ? 'block' : 'none';
  document.getElementById('adm-panel-payouts').style.display  = tab==='payouts'  ? 'block' : 'none';
  const profitPanel = document.getElementById('adm-panel-profit');
  if(profitPanel) profitPanel.style.display = tab==='profit' ? 'block' : 'none';
  document.getElementById('adm-tab-users').className    = tab==='users'    ? 'btn btn-pri' : 'btn btn-ghost';
  document.getElementById('adm-tab-feedback').className = tab==='feedback' ? 'btn btn-pri' : 'btn btn-ghost';
  document.getElementById('adm-tab-payouts').className  = tab==='payouts'  ? 'btn btn-pri' : 'btn btn-ghost';
  const profitTabBtn = document.getElementById('adm-tab-profit');
  if(profitTabBtn) profitTabBtn.className = tab==='profit' ? 'btn btn-pri' : 'btn btn-ghost';
  ['adm-tab-users','adm-tab-feedback','adm-tab-payouts','adm-tab-profit'].forEach(id=>{
    const el=document.getElementById(id); if(el)el.style.cssText='font-size:12px;padding:6px 16px';
  });
  if(tab==='feedback') loadFeedback();
  if(tab==='payouts')  { runAutoApprovalCheck(); renderWeeklyPayouts(); }
  if(tab==='profit')   renderPlatformProfitDashboard();
}

// ════════════════════════════════════════════
//  FEATURE 2 — OWNER APPROVAL PAGE
//  Renders when ?approve=TOKEN is in URL
// ════════════════════════════════════════════
function renderOwnerApprovalPage(token) {
  // Find the job with this token across all local user data
  let job = null;
  let hostData = null;
  try {
    const allData = JSON.parse(localStorage.getItem('hh_local_v1') || '{}');
    Object.values(allData.blob || allData).forEach(function(userData) {
      if(typeof userData !== 'object') return;
      const found = (userData.jobs||[]).find(j=>j.approvalToken===token);
      if(found) { job=found; hostData=userData; }
    });
  } catch(e){}

  document.body.style.cssText='margin:0;padding:0;font-family:DM Sans,sans-serif;background:#FAF7F2;min-height:100vh';
  document.head.insertAdjacentHTML('beforeend','<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><meta name="theme-color" content="#6B8F71">');

  if(!job) {
    document.body.innerHTML=`<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;padding:32px;text-align:center">
      <div style="font-size:52px;margin-bottom:16px">🔍</div>
      <div style="font-family:Georgia,serif;font-size:22px;color:#2C1F14;margin-bottom:8px">Approval Link Not Found</div>
      <div style="font-size:14px;color:#6B5D52;line-height:1.6">This link may have already been used or expired. Contact CSO Property Services for help.</div>
    </div>`;
    return;
  }

  const alreadyActed = job.approvalStatus === 'verified' || job.approvalStatus === 'disputed';
  const typeLabels = {turnover:'Turnover Clean',deep:'Deep Clean',inspect:'Inspection',laundry:'Laundry',residential:'Residential Cleaning'};

  function saveApproval(action) {
    try {
      const updates = JSON.parse(localStorage.getItem('hh_job_updates')||'[]');
      updates.push({jobId:job.id, action, time:new Date().toISOString(), token});
      localStorage.setItem('hh_job_updates', JSON.stringify(updates));
    } catch(e){}
  }

  document.body.innerHTML=`
    <div style="max-width:480px;margin:0 auto;padding:0 0 40px">
      <div style="background:${alreadyActed?'#6B8F71':'#C4693A'};padding:32px 24px 24px;color:#fff;text-align:center">
        <div style="font-size:48px;margin-bottom:12px">${alreadyActed?(job.approvalStatus==='verified'?'✅':'⚠️'):'🏠'}</div>
        <div style="font-family:Georgia,serif;font-size:22px;margin-bottom:6px">
          ${alreadyActed?(job.approvalStatus==='verified'?'Job Approved':'Job Disputed'):typeLabels[job.type]||'Cleaning Job'}
        </div>
        <div style="font-size:14px;opacity:.85">${job.propName}</div>
        <div style="font-size:13px;opacity:.7;margin-top:4px">${job.date} · ${job.cleanerName}</div>
      </div>

      <div style="padding:20px">
        <!-- Job summary -->
        <div style="background:#fff;border-radius:12px;padding:18px;box-shadow:0 2px 8px rgba(0,0,0,.06);margin-bottom:16px">
          <div style="font-size:10px;color:#9B8E85;text-transform:uppercase;letter-spacing:.5px;margin-bottom:12px;font-weight:700">Job Summary</div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
            <div><div style="font-size:10px;color:#9B8E85">Type</div><div style="font-size:14px;font-weight:600;color:#2C1F14">${typeLabels[job.type]||job.type}</div></div>
            <div><div style="font-size:10px;color:#9B8E85">Date</div><div style="font-size:14px;font-weight:600;color:#2C1F14">${job.date}</div></div>
            <div><div style="font-size:10px;color:#9B8E85">Cleaner</div><div style="font-size:14px;font-weight:600;color:#2C1F14">${job.cleanerName}</div></div>
            <div><div style="font-size:10px;color:#9B8E85">Amount</div><div style="font-size:14px;font-weight:600;color:#C4693A">$${job.pay}</div></div>
          </div>
          ${job.completionNotes?`<div style="margin-top:12px;background:#F5F1EB;border-radius:8px;padding:10px;font-size:13px;color:#6B5D52"><strong>Cleaner notes:</strong> ${job.completionNotes}</div>`:''}
        </div>

        ${alreadyActed ? `
          <div style="background:${job.approvalStatus==='verified'?'#F0FBF4':'#FFF3EE'};border:1px solid ${job.approvalStatus==='verified'?'#6B8F71':'#E87040'};border-radius:12px;padding:18px;text-align:center">
            <div style="font-size:24px;margin-bottom:8px">${job.approvalStatus==='verified'?'✅':'⚠️'}</div>
            <div style="font-size:15px;font-weight:600;color:#2C1F14">${job.approvalStatus==='verified'?'You approved this job':'You disputed this job'}</div>
            <div style="font-size:13px;color:#6B5D52;margin-top:4px">${job.approvalStatus==='verified'?'The cleaner will be paid on the next payout cycle.':'CSO Property Services has been notified.'}</div>
          </div>` : `
          <!-- Action buttons -->
          <div style="background:#fff;border-radius:12px;padding:18px;box-shadow:0 2px 8px rgba(0,0,0,.06);margin-bottom:12px">
            <div style="font-size:13px;color:#6B5D52;margin-bottom:14px;line-height:1.6">
              Please review and approve or dispute this cleaning job. If you take no action, it will <strong>auto-approve in 48 hours</strong>.
            </div>
            <div style="display:flex;gap:10px">
              <button id="approve-btn" onclick="handleOwnerApproval('approve')" style="flex:1;background:#6B8F71;color:#fff;border:none;border-radius:10px;padding:16px;font-size:15px;font-weight:600;cursor:pointer;font-family:inherit">
                ✅ Approve Job
              </button>
              <button id="dispute-btn" onclick="handleOwnerApproval('dispute')" style="flex:1;background:#fff;color:#C4693A;border:2px solid #C4693A;border-radius:10px;padding:16px;font-size:15px;font-weight:600;cursor:pointer;font-family:inherit">
                ⚠️ Dispute
              </button>
            </div>
          </div>
          <div style="text-align:center;font-size:11px;color:#9B8E85">Auto-approves ${new Date(job.autoApproveAt||Date.now()+172800000).toLocaleDateString()} at ${new Date(job.autoApproveAt||Date.now()+172800000).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}</div>`}

        <div style="text-align:center;margin-top:20px;font-size:10px;color:#9B8E85">Powered by CSO Property Services</div>
      </div>
    </div>`;

  window.handleOwnerApproval = function(action) {
    const approveBtn = document.getElementById('approve-btn');
    const disputeBtn = document.getElementById('dispute-btn');
    if(approveBtn) { approveBtn.disabled=true; approveBtn.style.opacity='0.6'; }
    if(disputeBtn) { disputeBtn.disabled=true; disputeBtn.style.opacity='0.6'; }

    job.approvalStatus = action==='approve' ? 'verified' : 'disputed';
    job.approvalActedAt = new Date().toISOString();
    saveApproval(action==='approve' ? 'owner_approved' : 'owner_disputed');

    // Update payout status — freeze on dispute (Feature 3)
    const payout = (hostData?.payouts||[]).find(p=>p.approvalToken===token);
    if(action === 'approve') {
      if(payout) payout.status = 'verified';
    } else {
      applyDisputeFreeze(payout, job);
    }

    // Re-render with result
    renderOwnerApprovalPage(token);

    // Show confirmation toast
    const t = document.createElement('div');
    t.textContent = action==='approve' ? '✅ Approved! Payment will be processed.' : '⚠️ Dispute submitted. We\'ll follow up shortly.';
    t.style.cssText='position:fixed;bottom:20px;left:50%;transform:translateX(-50%);background:#2C1F14;color:#fff;padding:12px 24px;border-radius:20px;font-size:13px;z-index:9999';
    document.body.appendChild(t);
    setTimeout(()=>t.remove(), 3500);
  };
}

// ════════════════════════════════════════════
//  FEATURE 3 — WEEKLY PAYOUT RECONCILIATION
// ════════════════════════════════════════════
function runAutoApprovalCheck() {
  if(!cData) return;
  const now = Date.now();
  let changed = false;

  // Check for job_updates from cleaner cards
  checkJobCardUpdates();

  // Auto-approve jobs past 48hr window
  (cData.jobs||[]).forEach(function(j) {
    if(j.approvalStatus==='pending' && j.autoApproveAt && now > j.autoApproveAt) {
      j.approvalStatus = 'verified';
      j.approvalActedAt = new Date().toISOString();
      j.autoApproved = true;
      changed = true;

      // Update matching payout
      const payout = (cData.payouts||[]).find(p=>p.jobId===j.id);
      if(payout && payout.status==='pending_approval') {
        payout.status = 'verified';
        payout.verifiedAt = new Date().toISOString();
        payout.autoApproved = true;
      }
    }
  });

  if(changed) {
    saveUserData(cUid, cData);
    toast('⏱ Auto-approval applied to eligible jobs');
  }

  // Render the pending panel
  const pendingEl = document.getElementById('wkp-pending-approval');
  if(!pendingEl) return;

  const pendingJobs = (cData.jobs||[]).filter(j=>j.approvalStatus==='pending' && j.autoApproveAt);
  if(!pendingJobs.length) {
    pendingEl.innerHTML='<div style="font-size:13px;color:var(--txt3)">No jobs awaiting owner approval</div>';
    return;
  }

  pendingEl.innerHTML = pendingJobs.map(function(j) {
    const msLeft = (j.autoApproveAt||0) - now;
    const hoursLeft = Math.max(0, Math.round(msLeft/3600000));
    const minsLeft = Math.max(0, Math.round((msLeft%3600000)/60000));
    const autoApproveStr = msLeft > 0
      ? `Auto-approves in ${hoursLeft}h ${minsLeft}m`
      : 'Auto-approval overdue — run check';
    const approvalUrl = window.location.origin + window.location.pathname + '?approve=' + j.approvalToken;
    return `<div style="display:flex;align-items:center;gap:12px;padding:10px 0;border-bottom:1px solid var(--border)">
      <div style="flex:1">
        <div style="font-size:13px;font-weight:600;color:var(--txt)">${j.propName} · ${j.cleanerName}</div>
        <div style="font-size:11px;color:var(--txt3)">${j.date} · $${j.pay} · <span style="color:${hoursLeft<6?'var(--terra)':'var(--gold)'}">${autoApproveStr}</span></div>
      </div>
      <button class="btn btn-ghost" style="font-size:10px;padding:3px 8px" onclick="_fallbackCopy('${approvalUrl}');toast('Approval link copied ✓')">🔗 Resend</button>
      <button class="btn btn-sage" style="font-size:10px;padding:3px 8px" onclick="forceApproveJob('${j.id}')">Force Approve</button>
    </div>`;
  }).join('');
}

function forceApproveJob(jobId) {
  if(!confirm('Force-approve this job and mark payout as verified?')) return;
  const j = (cData.jobs||[]).find(x=>x.id===jobId);
  if(!j) return;
  j.approvalStatus='verified';
  j.approvalActedAt=new Date().toISOString();
  j.forceApproved=true;
  const payout=(cData.payouts||[]).find(p=>p.jobId===jobId);
  if(payout) { payout.status='verified'; payout.verifiedAt=new Date().toISOString(); }
  saveUserData(cUid,cData);
  runAutoApprovalCheck();
  renderWeeklyPayouts();
  toast('Job force-approved ✓');
}

function renderWeeklyPayouts() {
  if(!cData) return;
  runAutoApprovalCheck();

  const filter = document.getElementById('wkp-filter')?.value || 'unpaid';
  const now = new Date();
  // "This week" = Monday to Sunday
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - now.getDay() + (now.getDay()===0?-6:1));
  weekStart.setHours(0,0,0,0);

  let payouts = (cData.payouts||[]).filter(p => {
    if(filter==='unpaid')  return p.status==='verified';
    if(filter==='paid')    return p.status==='paid' && new Date(p.paidAt||p.date)>=weekStart;
    if(filter==='all')     return p.status==='verified'||p.status==='paid';
    return false;
  });

  // KPIs
  const verifiedPayouts = (cData.payouts||[]).filter(p=>p.status==='verified');
  const totalOwed = verifiedPayouts.reduce((s,p)=>s+(p.owed||0),0);
  const totalFees = verifiedPayouts.reduce((s,p)=>s+(p.platformFee||p.net||0),0);
  const totalNet  = verifiedPayouts.reduce((s,p)=>s+(p.net||0),0);

  const set=(id,v)=>{const el=document.getElementById(id);if(el)el.textContent=v;};
  set('wkp-verified', verifiedPayouts.length);
  set('wkp-owed', '$'+Math.round(totalOwed).toLocaleString());
  set('wkp-fees', '$'+Math.round(totalFees).toLocaleString());
  set('wkp-net',  '$'+Math.round(totalNet).toLocaleString());

  // Update badge
  const badge = document.getElementById('adm-payout-badge');
  if(badge) {
    badge.textContent = verifiedPayouts.length;
    badge.style.display = verifiedPayouts.length > 0 ? 'inline' : 'none';
  }

  const list = document.getElementById('wkp-cleaner-list');
  if(!list) return;

  if(!payouts.length) {
    list.innerHTML=`<div class="empty-state"><div class="es-i">💳</div><h3>${filter==='unpaid'?'No verified jobs pending payout':'No payouts found'}</h3></div>`;
    return;
  }

  // Group by cleaner for batch view
  const byCleaner = {};
  payouts.forEach(function(p) {
    const key = p.cleaner||p.cleanerName||'unassigned';
    if(!byCleaner[key]) byCleaner[key] = {name:p.cleanerName||'Unassigned', jobs:[], totalOwed:0, totalCharged:0, totalFee:0};
    byCleaner[key].jobs.push(p);
    byCleaner[key].totalOwed    += (p.owed||0);
    byCleaner[key].totalCharged += (p.charged||0);
    byCleaner[key].totalFee     += (p.platformFee||p.net||0);
  });

  list.innerHTML = Object.values(byCleaner).map(function(c) {
    const paidIds = c.jobs.map(j=>`'${j.id}'`).join(',');
    return `
      <div style="border:1px solid var(--border);border-radius:10px;margin-bottom:12px;overflow:hidden">
        <!-- Cleaner header -->
        <div style="display:flex;align-items:center;gap:12px;padding:14px 16px;background:var(--sand)">
          <div style="width:36px;height:36px;border-radius:50%;background:var(--terra);color:#fff;display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:700;flex-shrink:0">${c.name[0]}</div>
          <div style="flex:1">
            <div style="font-size:14px;font-weight:600;color:var(--txt)">${c.name}</div>
            <div style="font-size:11px;color:var(--txt3)">${c.jobs.length} verified job${c.jobs.length!==1?'s':''}</div>
          </div>
          <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;text-align:right">
            <div><div style="font-size:9px;color:var(--txt3);text-transform:uppercase">Charged</div><div style="font-size:13px;font-weight:600;color:var(--txt)">$${Math.round(c.totalCharged).toLocaleString()}</div></div>
            <div><div style="font-size:9px;color:var(--txt3);text-transform:uppercase">Your Fee</div><div style="font-size:13px;font-weight:600;color:var(--gold)">$${Math.round(c.totalFee).toLocaleString()}</div></div>
            <div><div style="font-size:9px;color:var(--txt3);text-transform:uppercase">Pay Out</div><div style="font-size:15px;font-weight:700;color:var(--sage)">$${Math.round(c.totalOwed).toLocaleString()}</div></div>
          </div>
          ${filter!=='paid'?`<button class="btn btn-pri" style="font-size:11px;padding:6px 12px;flex-shrink:0" onclick="batchMarkCleanerPaid([${paidIds}],'${c.name}')">Mark Paid →</button>`:'<span style="font-size:11px;color:var(--sage);font-weight:600;padding:0 8px">✓ Paid</span>'}
        </div>
        <!-- Job breakdown -->
        <div style="padding:0 16px">
          ${c.jobs.map(function(p) {
            const j=(cData.jobs||[]).find(x=>x.id===p.jobId);
            return `<div style="display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid var(--border2);font-size:12px">
              <div style="flex:1;color:var(--txt2)">${j?.propName||p.notes||'Job'} · ${p.date}</div>
              <div style="color:var(--txt3)">Charged: $${(p.charged||0).toFixed(2)}</div>
              <div style="color:var(--gold)">Fee: $${(p.platformFee||p.net||0).toFixed(2)}</div>
              <div style="font-weight:600;color:var(--sage)">Pay: $${(p.owed||0).toFixed(2)}</div>
              ${p.autoApproved?'<span style="font-size:9px;color:var(--txt3);background:var(--sand);border-radius:4px;padding:1px 5px">auto</span>':''}
            </div>`;
          }).join('')}
        </div>
      </div>`;
  }).join('');
}

function batchMarkCleanerPaid(ids, cleanerName) {
  if(!confirm(`Mark all ${ids.length} payout(s) for ${cleanerName} as paid? This confirms you've sent the funds.`)) return;
  const now = new Date().toISOString();
  ids.forEach(function(id) {
    const p=(cData.payouts||[]).find(x=>x.id===id);
    if(p) { p.status='paid'; p.paidAt=now; }
  });
  saveUserData(cUid,cData);
  renderWeeklyPayouts();
  toast(`✓ ${ids.length} payout${ids.length!==1?'s':''} for ${cleanerName} marked as paid`);
}

function batchMarkAllPaid() {
  const unpaid = (cData.payouts||[]).filter(p=>p.status==='verified');
  if(!unpaid.length) { toast('No verified payouts to mark paid'); return; }
  if(!confirm(`Mark ALL ${unpaid.length} verified payouts as paid? Only do this after sending funds.`)) return;
  const now = new Date().toISOString();
  unpaid.forEach(p=>{ p.status='paid'; p.paidAt=now; });
  saveUserData(cUid,cData);
  renderWeeklyPayouts();
  toast(`✓ ${unpaid.length} payouts marked as paid`);
}

// ════════════════════════════════════════════
//  FEATURE 4 — STRIPE WEBHOOK (Supabase Edge Function)
//  Deploy to: supabase/functions/stripe-webhook/index.ts
//  In Stripe Dashboard → Webhooks → add endpoint:
//    https://vdnyqwpznsysrvyvbqga.supabase.co/functions/v1/stripe-webhook
//  Listen for: customer.subscription.updated
// ════════════════════════════════════════════
/*
STRIPE WEBHOOK EDGE FUNCTION — supabase/functions/stripe-webhook/index.ts
═══════════════════════════════════════════════════════════════════════════

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Stripe from 'https://esm.sh/stripe@13.3.0?target=deno'

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, { apiVersion: '2023-10-16' })
const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

// Map Stripe price IDs → subscription tiers
const PRICE_TO_TIER: Record<string, string> = {
  // Monthly prices (existing)
  'price_pro_monthly':            'pro',
  'price_business_monthly':       'business',
  'price_cohost_starter_monthly': 'cohost_starter',
  'price_cohost_monthly':         'cohost',
  // New annual prices
  'price_1TL5qhAq1y5M81l9JCAsW6xr': 'pro',            // Pro Annual $790/yr
  'price_1TL5sBAq1y5M81l92JjVr41o':  'business',       // Business Annual $1,990/yr
  'price_1TL5trAq1y5M81l9UbzF0zRz':  'cohost_starter', // Co-Host Starter Annual $1,490/yr
  'price_1TL5ujAq1y5M81l9rWzrn6Ao':  'cohost',         // Co-Host Pro Annual $2,990/yr
  // Co-Host Starter monthly (new dedicated price)
  'price_1TL5viAq1y5M81l9A7UdJ3dU':  'cohost_starter', // Co-Host Starter Monthly $149/mo
}

serve(async (req) => {
  const signature = req.headers.get('stripe-signature')!
  const body = await req.text()

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(body, signature, Deno.env.get('STRIPE_WEBHOOK_SECRET')!)
  } catch(err) {
    return new Response(`Webhook signature failed: ${err.message}`, { status: 400 })
  }

  if (event.type === 'customer.subscription.updated') {
    const sub = event.data.object as Stripe.Subscription
    const customerId = sub.customer as string
    const priceId = sub.items.data[0]?.price?.id ?? ''
    const tier = PRICE_TO_TIER[priceId] ?? 'free'
    const status = sub.status  // active | trialing | past_due | canceled | unpaid

    // Determine trial fields
    const isTrialing = status === 'trialing'
    const trialStart = sub.trial_start ? new Date(sub.trial_start * 1000).toISOString() : null
    const trialEnd   = sub.trial_end   ? new Date(sub.trial_end   * 1000).toISOString() : null

    // Sync to profiles
    const { error } = await supabase
      .from('profiles')
      .update({
        subscription_tier:   tier,
        plan:                status === 'active' || status === 'trialing' ? tier : 'free',
        stripe_sub_id:       sub.id,
        is_trial_active:     isTrialing,
        trial_start_date:    trialStart,
        trial_expires_at:    trialEnd,
        stripe_sub_status:   status,
        updated_at:          new Date().toISOString(),
      })
      .eq('stripe_customer_id', customerId)

    if (error) {
      console.error('Supabase update error:', error.message)
      return new Response('DB error', { status: 500 })
    }

    // If subscription canceled/expired → downgrade to free
    if (status === 'canceled' || status === 'unpaid' || status === 'past_due') {
      await supabase
        .from('profiles')
        .update({ subscription_tier: 'free', plan: 'free', is_trial_active: false })
        .eq('stripe_customer_id', customerId)
    }
  }

  return new Response(JSON.stringify({ received: true }), {
    headers: { 'Content-Type': 'application/json' }
  })
})

═══════════════════════════════════════════════════════════════════════════
SUPABASE SCHEMA ADDITIONS — run in SQL Editor:
═══════════════════════════════════════════════════════════════════════════

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS stripe_sub_status  text DEFAULT 'inactive',
  ADD COLUMN IF NOT EXISTS stripe_sub_id      text,
  ADD COLUMN IF NOT EXISTS stripe_customer_id text;

-- Job approval columns on a dedicated jobs table (if you migrate from jsonb):
-- ALTER TABLE public.jobs
--   ADD COLUMN IF NOT EXISTS approval_token    text UNIQUE,
--   ADD COLUMN IF NOT EXISTS approval_status   text DEFAULT 'pending',
--   ADD COLUMN IF NOT EXISTS approval_acted_at timestamptz,
--   ADD COLUMN IF NOT EXISTS auto_approve_at   timestamptz;

-- Payout status column:
-- ALTER TABLE public.payouts
--   ADD COLUMN IF NOT EXISTS status        text DEFAULT 'pending_approval',
--   ADD COLUMN IF NOT EXISTS verified_at   timestamptz,
--   ADD COLUMN IF NOT EXISTS paid_at       timestamptz,
--   ADD COLUMN IF NOT EXISTS approval_token text;

═══════════════════════════════════════════════════════════════════════════
SUPABASE ENV VARS (Settings → Edge Functions → Secrets):
  STRIPE_SECRET_KEY       = sk_live_...
  STRIPE_WEBHOOK_SECRET   = whsec_...
  SUPABASE_URL            = https://vdnyqwpznsysrvyvbqga.supabase.co
  SUPABASE_SERVICE_ROLE_KEY = eyJ...
*/

// ── checkPropertyLimit: named exported alias matching the request spec
function checkPropertyLimit() { return canAddProperty(); }


// ════════════════════════════════════════════
