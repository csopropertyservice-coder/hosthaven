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
