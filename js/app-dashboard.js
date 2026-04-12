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


