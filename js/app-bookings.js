/* CSO Property Services — js/app-bookings.js
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

  if(!cData){toast('Session not ready');return;}
  if(!cData.bookings)cData.bookings=[];
  if(!cData.properties)cData.properties=[];
  const propId=document.getElementById('mb-prop').value;
  const guest=document.getElementById('mb-guest').value.trim();
  if(!guest){toast('Enter a guest name');return;}
  const prop=cData.properties.find(p=>p.id===propId);
  const cin=document.getElementById('mb-cin').value,cout=document.getElementById('mb-cout').value;
  const nights=cin&&cout?Math.max(1,Math.round((new Date(cout)-new Date(cin))/86400000)):1;
  const b={id:'b_'+Date.now(),propId,propName:prop?.name||'Property',propEmoji:prop?.emoji||'🏠',propGradient:prop?.gradient||'pi1',guestName:cleanInput(guest),guestEmail:cleanInput(document.getElementById('mb-email').value.trim()),numGuests:parseInt(document.getElementById('mb-nguests').value)||2,checkin:cin,checkout:cout,nights,price:moneyNonNeg(parseFloat(document.getElementById('mb-price').value)),status:document.getElementById('mb-status').value,source:document.getElementById('mb-source').value,leadType:document.getElementById('mb-lead-type')?.value||'',notes:cleanInput(document.getElementById('mb-notes')?.value||''),photos:[...tempBookingPhotos],created:Date.now()};
  tempBookingPhotos=[];
  const previewEl=document.getElementById('mb-photos-preview');if(previewEl)previewEl.innerHTML='';
  cData.bookings.push(b);saveUserData(cUid,cData);closeModal('add-booking-modal');
  clearDraft('booking');
  toast(`Booking for ${guest} added!`);renderAll();
  // Auto-create cleaning task on checkout date
  if(cout) {
    const cleanTask = {
      id:'t_'+Date.now(),
      title:`Turnover clean — ${prop?.name||'Property'}`,
      propId,
      propName:prop?.name||'Property',
      assignee:'',
      due:cout,
      priority:'high',
      done:false,
      created:Date.now(),
      autoCreated:true
    };
    if(!cData.tasks) cData.tasks=[];
    cData.tasks.push(cleanTask);
    saveUserData(cUid,cData);
    toast(`Booking added! 🧹 Cleaning task auto-created for ${cout}`);
  }
  // Send email notification
  sendNotification('new_booking', {
    guestName: b.guestName,
    propName: b.propName,
    checkin: b.checkin||'TBD',
    checkout: b.checkout||'TBD',
    numGuests: b.numGuests,
    price: b.price
  });
}
// ════════════════════════════════════════════
//  TEAM ACCESS
// ════════════════════════════════════════════
async function renderTeam() {
  const plan = cData.plan||'free';
  const gate = document.getElementById('team-plan-gate');
  const content = document.getElementById('team-content');
  if(plan !== 'business' && plan !== 'cohost' && plan !== 'trial') {
    if(gate) gate.style.display='block';
    if(content) content.style.display='none';
    return;
  }
  if(gate) gate.style.display='none';
  if(content) content.style.display='block';
  const ownerAv=document.getElementById('team-owner-av');
  const ownerName=document.getElementById('team-owner-name');
  const ownerEmail=document.getElementById('team-owner-email');
  if(cUser){
    const init=(cUser.name||'?').split(' ').map(n=>n[0]).join('').toUpperCase().slice(0,2);
    if(ownerAv)ownerAv.textContent=init;
    if(ownerName)ownerName.textContent=(cUser.name||'You')+' (You)';
    if(ownerEmail)ownerEmail.textContent=cUser.email||'';
  }
  const listEl=document.getElementById('team-members-list');
  if(!listEl)return;
  listEl.innerHTML=`<div style="text-align:center;padding:16px;color:var(--txt3)">Loading…</div>`;
  try {
    let members = null, membersError = null;
  try { const r = await sb.from('teams').select('*').eq('owner_id',cUid).order('created_at',{ascending:true}); members = r.data; membersError = r.error; } catch(e) { membersError = e; }
  const error = membersError;
    if(error){ sbHandleError(error,'renderTeam'); throw error; }
    if(!members||members.length===0){listEl.innerHTML=`<div style="font-size:13px;color:var(--txt3);padding:16px 0;text-align:center">No team members yet — invite someone to get started!</div>`;return;}
    const roleColors={manager:'pill-blue',viewer:'pill-amber'};
    const statusColors={accepted:'pill-green',pending:'pill-amber'};
    listEl.innerHTML=members.map(m=>`
      <div style="display:flex;align-items:center;gap:12px;padding:12px 0;border-bottom:1px solid var(--border)">
        <div style="width:38px;height:38px;border-radius:50%;background:var(--sand);color:var(--txt2);display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:700;flex-shrink:0">${(m.member_name||m.member_email||'?').charAt(0).toUpperCase()}</div>
        <div style="flex:1"><div style="font-size:13px;font-weight:600;color:var(--txt)">${m.member_name||'Invited User'}</div><div style="font-size:11px;color:var(--txt3)">${m.member_email}</div></div>
        <span class="pill ${roleColors[m.role]||'pill-amber'}" style="text-transform:capitalize">${m.role}</span>
        <span class="pill ${statusColors[m.status]||'pill-amber'}" style="text-transform:capitalize">${m.status}</span>
        <button class="btn btn-ghost" style="font-size:10px;padding:3px 8px;color:var(--terra)" onclick="removeTeamMember('${m.id}','${m.member_email}')">Remove</button>
      </div>`).join('');
  } catch(e){listEl.innerHTML=`<div style="font-size:13px;color:var(--terra);padding:16px 0">Error: ${e.message}</div>`;}
}

async function inviteTeamMember() {
  const email=document.getElementById('invite-email').value.trim().toLowerCase();
  const name=sanitizeInput(document.getElementById('invite-name').value.trim());
  const role=document.getElementById('invite-role').value;
  if(!email){toast('Enter an email address');return;}
  if(!isValidEmail(email)){toast('Enter a valid email address');return;}
  if(email===cUser?.email){toast('You cannot invite yourself!');return;}
  const btn=document.querySelector('#invite-team-modal .btn-pri');
  if(btn){btn.textContent='Sending…';btn.disabled=true;}
  try {
    const token=Math.random().toString(36).slice(2)+Date.now().toString(36);
    let insTeam; try { insTeam = await sb.from('teams').insert({owner_id:cUid,member_id:cUid,member_email:email,member_name:name||email.split('@')[0],role,status:'pending',invite_token:token}); } catch(e) { insTeam = {error:e}; }
    const error = insTeam.error;
    if(error&&!String(error.message||'').includes('unique')){ sbHandleError(error,'inviteTeam'); throw error; }
    closeModal('invite-team-modal');
    document.getElementById('invite-email').value='';
    document.getElementById('invite-name').value='';
    toast(`✓ ${email} added to your team!`);
    renderTeam();
  } catch(e){toast('Error: '+e.message);}
  finally{if(btn){btn.textContent='Send Invitation →';btn.disabled=false;}}
}

async function removeTeamMember(id, email) {
  if(!confirm(`Remove ${email} from your team?`))return;
  try {
    let delT; try { delT = await sb.from('teams').delete().eq('id',id); } catch(e) { delT = {error:e}; }
    if(delT.error){ sbHandleError(delT.error,'removeTeam'); throw delT.error; }
    toast(`${email} removed from team`);
    renderTeam();
  } catch(e){toast('Error: '+e.message);}
}

// ════════════════════════════════════════════
//  GETTING STARTED CHECKLIST
// ════════════════════════════════════════════
const GS_STEPS = [
  {
    id:'add_property',
    icon:'🏠',
    title:'Add your first property',
    desc:'Add your listing details — name, location, door code, WiFi, and photo',
    action:'openModal(\'add-property-modal\')',
    actionLabel:'Add Property',
    check: ()=> cData.properties.length > 0
  },
  {
    id:'add_booking',
    icon:'📅',
    title:'Sync your bookings from Airbnb',
    desc:'Go to iCal Sync → paste your Airbnb, VRBO, or Booking.com calendar link → bookings import automatically',
    action:'nav(\'ical\',document.querySelector(\'[onclick*=ical]\'))',
    actionLabel:'iCal Sync',
    check: ()=> cData.bookings.length > 0
  },
  {
    id:'setup_qr',
    icon:'📱',
    title:'Create your QR House Manual',
    desc:'Generate a scannable QR code for each property — WiFi, door code, rules, all in one',
    action:'nav(\'qrmanual\',document.querySelector(\'[onclick*=qrmanual]\'))',
    actionLabel:'QR Manual',
    check: ()=> cData.properties.length > 0
  },
  {
    id:'try_ai',
    icon:'🤖',
    title:'Turn on AI Office Hours',
    desc:'Set your quiet hours — AI handles guest messages automatically while you sleep',
    action:'nav(\'aihours\',document.querySelector(\'[onclick*=aihours]\'))',
    actionLabel:'AI Office Hours',
    check: ()=> !!(cData.aiHours&&cData.aiHours.enabled)
  },
  {
    id:'add_expense',
    icon:'💸',
    title:'Track your revenue & expenses',
    desc:'Add income and expenses to see your true profit margin per property',
    action:'nav(\'expenses\',document.querySelector(\'[onclick*=expenses]\'))',
    actionLabel:'Add Expense',
    check: ()=> (cData.expenses||[]).length > 0
  },
  {
    id:'add_staff',
    icon:'🧹',
    title:'Add a cleaner & log a payout',
    desc:'Add your cleaning contractor, log their payout — your margin is calculated automatically',
    action:'nav(\'payouts\',document.querySelector(\'[onclick*=payouts]\'))',
    actionLabel:'Payout Ledger',
    check: ()=> (cData.payouts||[]).length > 0
  },
  {
    id:'send_owner_report',
    icon:'📋',
    title:'Send your first owner report',
    desc:'Go to Reports → Owner Report tab → select a property → email a branded PDF to your client',
    action:'nav(\'reports\',document.querySelector(\'[onclick*=reports]\'))',
    actionLabel:'Owner Reports',
    check: ()=> (cData.sentReports||[]).length > 0
  }
];

function renderGettingStarted() {
  const card = document.getElementById('getting-started-card');
  const stepsEl = document.getElementById('gs-steps');
  const progressBar = document.getElementById('gs-progress-bar');
  const progressText = document.getElementById('gs-progress-text');
  if(!card || !stepsEl) return;

  // Check if dismissed
  if(cData.gsDismissed) { card.style.display='none'; return; }

  const completed = GS_STEPS.filter(s=>s.check()).length;
  const total = GS_STEPS.length;

  // Hide if all done
  if(completed === total) {
    card.style.display='none';
    return;
  }

  card.style.display='block';
  const pct = Math.round((completed/total)*100);
  if(progressBar) progressBar.style.width = pct+'%';
  if(progressText) progressText.textContent = `${completed} of ${total} steps complete — you're ${pct}% set up!`;

  stepsEl.innerHTML = GS_STEPS.map(step=>{
    const done = step.check();
    return `<div style="display:flex;align-items:center;gap:12px;padding:10px 12px;border-radius:10px;background:${done?'var(--sand)':'var(--card)'};border:1px solid ${done?'var(--border2)':'var(--border)'};transition:all .2s;${done?'opacity:.6':''}">
      <div style="width:32px;height:32px;border-radius:50%;background:${done?'var(--sage)':'var(--sand)'};color:${done?'#fff':'var(--txt2)'};display:flex;align-items:center;justify-content:center;font-size:${done?'14px':'16px'};flex-shrink:0;font-weight:700">
        ${done?'✓':step.icon}
      </div>
      <div style="flex:1">
        <div style="font-size:13px;font-weight:600;color:var(--txt);${done?'text-decoration:line-through;':''}margin-bottom:2px">${step.title}</div>
        <div style="font-size:11px;color:var(--txt3);line-height:1.4">${step.desc}</div>
      </div>
      ${!done?`<button class="btn btn-pri" style="font-size:11px;padding:5px 11px;flex-shrink:0" onclick="${step.action}">${step.actionLabel} →</button>`:'<span style="font-size:11px;color:var(--sage);font-weight:600">Done ✓</span>'}
    </div>`;
  }).join('');
}

function dismissGettingStarted() {
  cData.gsDismissed = true;
  saveUserData(cUid, cData);
  const card = document.getElementById('getting-started-card');
  if(card) card.style.display='none';
  toast('Getting started guide hidden. Find it again in Settings if needed.');
}

// ════════════════════════════════════════════
// ════════════════════════════════════════════
function toggleDay(el){
  const sel=el.getAttribute('data-selected')==='1';
  if(sel){el.removeAttribute('data-selected');el.style.background='';el.style.color='var(--txt)';el.style.borderColor='var(--border)';}
  else{el.setAttribute('data-selected','1');el.style.background='var(--terra)';el.style.color='#fff';el.style.borderColor='var(--terra)';}
}

function addStaff() {
  const name = sanitizeInput(document.getElementById('sf-name').value.trim());
  if(!name){toast('Enter staff name');return;}
  const sfEmail = document.getElementById('sf-email').value.trim();
  if(sfEmail && !isValidEmail(sfEmail)){toast('Enter a valid email address');return;}
  if(!cData.staff) cData.staff=[];
  const roleEmojis={cleaner:'🧹',handyman:'🔧',manager:'👔',other:'👤'};
  const role=document.getElementById('sf-role').value;
  const availDays=[...document.querySelectorAll('#sf-avail-days [data-day]')]
    .filter(d=>d.style.background.includes('var(--terra)')||d.classList.contains('day-selected'))
    .map(d=>d.dataset.day);
  const member={
    id:'s_'+Date.now(), name,role,
    phone:sanitizeInput(document.getElementById('sf-phone').value.trim()),
    email:sanitizeInput(sfEmail),
    notes:sanitizeInput(document.getElementById('sf-notes').value),
    emoji:roleEmojis[role]||'👤',
    availability:{
      days:availDays,
      from:document.getElementById('sf-avail-from').value||'08:00',
      to:document.getElementById('sf-avail-to').value||'17:00',
      blackout:(document.getElementById('sf-blackout').value||'').split(',').map(d=>d.trim()).filter(Boolean)
    },
    created:Date.now()
  };
  cData.staff.push(member);
  saveUserData(cUid,cData);
  closeModal('add-staff-modal');
  ['sf-name','sf-phone','sf-email','sf-notes'].forEach(id=>{const el=document.getElementById(id);if(el)el.value='';});
  toast(`${name} added to staff!`);
  renderStaff();
}

// ════════════════════════════════════════════
//  CHECKLISTS
// ════════════════════════════════════════════
const CHECKLISTS = {
  turnover: {
    title: '🧹 Cleaner Turnover Checklist',
    sections: [
      { name: 'Kitchen', items: ['Remove all dishes and wash thoroughly','Wipe down all countertops and backsplash','Clean inside microwave — remove food residue','Wipe stovetop and burners','Clean oven if needed','Empty and wipe inside refrigerator','Wipe refrigerator exterior and handles','Clean sink and polish faucet','Empty and reline trash can','Sweep and mop floor','Restock dish soap, sponge, paper towels','Check and restock coffee/tea supplies']},
      { name: 'Bathrooms', items: ['Scrub and disinfect toilet inside and out','Clean sink and wipe mirror','Scrub shower/bathtub — remove soap scum','Clean shower glass or curtain','Wipe all surfaces and fixtures','Sweep and mop floor','Replace toilet paper (full roll)','Restock shampoo, conditioner, body wash','Replace hand soap if low','Wash and replace bath mats','Replace used towels with fresh set','Empty trash and reline bin']},
      { name: 'Bedrooms', items: ['Strip all bed linens and pillowcases','Make bed with fresh linens — tight corners','Fluff and arrange all pillows','Check under bed for left items','Wipe down all furniture surfaces','Clean mirrors and windows','Empty all trash bins','Vacuum carpet or sweep/mop floors','Check closets — remove any guest items','Restock extra blankets if needed']},
      { name: 'Living Areas', items: ['Vacuum all sofas and cushions','Wipe down coffee table and side tables','Clean TV screen with microfiber cloth','Dust all surfaces and shelves','Vacuum or sweep all floors','Mop hard floors','Empty all trash bins','Check for any damage or broken items','Ensure remotes have working batteries','Straighten pillows and throws']},
      { name: 'Final Checks', items: ['Check all windows and doors lock properly','Set thermostat to welcome temperature','Turn on all lights and check bulbs','Ensure WiFi is working','Leave welcome note or guide for guests','Take photos of clean property','Report any damage to host immediately','Lock up and return keys as instructed']}
    ]
  },
  prearrival: {
    title: '🏡 Host Pre-Arrival Checklist',
    sections: [
      { name: 'Communication', items: ['Send check-in instructions to guest','Confirm guest arrival time','Share door code and access details','Send WiFi name and password','Provide parking instructions','Share emergency contact number','Send local recommendations guide','Confirm number of guests arriving']},
      { name: 'Property Setup', items: ['Confirm cleaning has been completed','Check all door locks and access codes work','Test WiFi connection speed','Set thermostat to comfortable temperature','Turn on all necessary lights','Ensure all appliances are working','Check all TVs and streaming services work','Test smoke and CO detectors']},
      { name: 'Supplies', items: ['Restock toilet paper (minimum 4 rolls)','Restock paper towels','Check soap dispensers are full','Restock coffee, tea, and sugar','Ensure fresh towels are set out','Check kitchen supplies are stocked','Leave extra trash bags under bin','Ensure welcome basket is prepared']},
      { name: 'Safety', items: ['First aid kit is stocked and accessible','Fire extinguisher is charged and visible','Emergency exit routes are clear','All medications removed from property','Pool/hot tub area is safe and clean','Check for any trip hazards','Ensure all sharp tools are stored away']},
      { name: 'Final Walkthrough', items: ['Walk through every room one final time','Check all windows are closed','Ensure no previous guest items remain','Take arrival photos for your records','Set alarm system if applicable','Confirm cleaners have been paid','Update booking status to confirmed']}
    ]
  },
  checkout: {
    title: '👋 Guest Checkout Checklist',
    sections: [
      { name: 'Send to Guest Before Checkout', items: ['Send checkout time reminder (night before)','Share checkout instructions clearly','Remind guest to return all keys/fobs','Ask guest to strip bed linens','Request guest start dishwasher if dishes used','Ask guest to take all personal belongings','Remind guest to turn off all lights','Share how to leave feedback/review']},
      { name: 'After Guest Departs', items: ['Confirm guest has checked out','Do a walkthrough of entire property','Check all rooms for left items','Check for any damage to furniture','Check walls and floors for stains','Inspect all appliances for damage','Check all windows and doors','Count and check all keys returned']},
      { name: 'Inventory Check', items: ['Count all towels and linens','Check all kitchen items are present','Check electronics — TV remotes etc.','Inspect artwork and decor items','Check outdoor furniture if applicable','Review security camera footage if needed','Document any missing or damaged items']},
      { name: 'Admin Tasks', items: ['Process security deposit if applicable','Report any damage to Airbnb within 24hrs','Update booking status to completed','Send review request to guest','Schedule cleaning for next guest','Update availability calendar','Log any maintenance issues found','Review guest communication for feedback']}
    ]
  },
  maintenance: {
    title: '🔧 Maintenance Inspection Checklist',
    sections: [
      { name: 'Plumbing', items: ['Check all faucets for leaks or drips','Test all toilets flush properly','Check under sinks for moisture or leaks','Test shower pressure and temperature','Check water heater is working','Inspect washing machine hoses','Check dishwasher seals and drain','Test garbage disposal if present']},
      { name: 'Electrical', items: ['Test all light switches and dimmers','Replace any burnt out bulbs','Test all electrical outlets','Check GFCI outlets in bathrooms/kitchen','Test smoke detectors — replace batteries','Test carbon monoxide detectors','Check circuit breaker panel','Test doorbell if present']},
      { name: 'HVAC & Appliances', items: ['Replace HVAC air filter','Test heating system','Test air conditioning system','Clean refrigerator coils','Test all stovetop burners','Test oven — check temperature accuracy','Clean dryer lint trap and vent','Test all ceiling fans']},
      { name: 'Structure & Safety', items: ['Inspect roof for visible damage','Check gutters are clear','Inspect all windows open/close properly','Check all door locks and deadbolts','Inspect caulking in bathrooms','Check for cracks in walls or ceilings','Inspect deck/balcony for stability','Check exterior lighting works']},
      { name: 'Seasonal Checks', items: ['Check weather stripping on doors','Inspect window screens for damage','Test garage door if applicable','Check outdoor hose bibs','Inspect driveway and walkways','Check fence gates and latches','Service lawn equipment if needed','Check pool/hot tub equipment']}
    ]
  }
};

let activeChecklist = 'turnover';
let checklistState = {};

function showChecklist(type, btn) {
  activeChecklist = type;
  document.querySelectorAll('#checklist-tabs button').forEach(b=>{b.className='btn btn-ghost';b.style.fontSize='11px';b.style.padding='5px 12px';});
  if(btn){btn.className='btn btn-pri';btn.style.fontSize='11px';btn.style.padding='5px 12px';}
  renderChecklist();
}

function renderChecklist() {
  const cl = CHECKLISTS[activeChecklist];
  if(!cl) return;
  const content = document.getElementById('checklist-content');
  if(!content) return;
  if(!checklistState[activeChecklist]) checklistState[activeChecklist] = {};
  const state = checklistState[activeChecklist];
  let totalItems=0, checkedItems=0, html='';
  cl.sections.forEach((section,si)=>{
    html+=`<div style="margin-bottom:18px"><div style="font-size:11px;font-weight:700;letter-spacing:.7px;text-transform:uppercase;color:var(--txt3);margin-bottom:10px;padding-bottom:6px;border-bottom:1px solid var(--border)">${section.name}</div>`;
    section.items.forEach((item,ii)=>{
      const key=si+'_'+ii;
      const checked=state[key]||false;
      if(checked)checkedItems++;
      totalItems++;
      html+=`<div data-clkey="${key}" class="cl-item" style="display:flex;align-items:center;gap:12px;padding:8px 6px;border-radius:7px;cursor:pointer;transition:background .15s;${checked?'opacity:.55':''}" onmouseover="this.style.background='var(--sand)'" onmouseout="this.style.background=''">
        <div style="width:18px;height:18px;border-radius:5px;border:2px solid ${checked?'var(--sage)':'var(--border2)'};background:${checked?'var(--sage)':'transparent'};display:flex;align-items:center;justify-content:center;flex-shrink:0;transition:all .15s">
          ${checked?'<svg width="10" height="8" viewBox="0 0 10 8"><polyline points="1,4 3.5,6.5 9,1" stroke="white" stroke-width="2" fill="none" stroke-linecap="round"/></svg>':''}
        </div>
        <div style="font-size:13px;color:var(--txt);${checked?'text-decoration:line-through':''}">${item}</div>
      </div>`;
    });
    html+='</div>';
  });
  content.innerHTML=html;
  const pct=totalItems?Math.round(checkedItems/totalItems*100):0;
  const bar=document.getElementById('cl-progress-bar');
  const label=document.getElementById('cl-progress-label');
  if(bar){bar.style.width=pct+'%';bar.style.background=pct===100?'var(--sage)':'var(--terra)';}
  if(label)label.textContent=checkedItems+' of '+totalItems+' complete'+(pct===100?' ✓ All done!':'');
}

function toggleChecklistItem(key){
  if(!checklistState[activeChecklist])checklistState[activeChecklist]={};
  checklistState[activeChecklist][key]=!checklistState[activeChecklist][key];
  renderChecklist();
}

// Delegated click handler for checklist items
document.addEventListener('click', e=>{
  const item = e.target.closest('.cl-item');
  if(item) {
    const key = item.getAttribute('data-clkey');
    if(key) toggleChecklistItem(key);
  }
});

function resetChecklist(){
  if(!confirm('Reset all items in this checklist?'))return;
  checklistState[activeChecklist]={};
  renderChecklist();
  toast('Checklist reset ✓');
}

function printChecklist(){
  const cl=CHECKLISTS[activeChecklist];if(!cl)return;
  const state=checklistState[activeChecklist]||{};
  let html='<!DOCTYPE html><html><head><title>'+cl.title+'</title><style>body{font-family:Georgia,serif;padding:32px;color:#1C1410;max-width:700px;margin:0 auto}h1{font-size:24px;margin-bottom:8px}h2{font-size:14px;font-weight:700;text-transform:uppercase;letter-spacing:.7px;color:#9B8E85;margin:20px 0 10px;padding-bottom:6px;border-bottom:1px solid #E2DBD0}.item{display:flex;align-items:center;gap:12px;padding:7px 0;font-size:13px;border-bottom:1px solid #F5F0E8}.box{width:16px;height:16px;border:2px solid #C4693A;border-radius:4px;flex-shrink:0;text-align:center;line-height:14px;font-size:11px}@media print{body{padding:16px}}</style></head><body>';
  html+='<h1>'+cl.title+'</h1><p style="font-size:12px;color:#9B8E85;margin-bottom:24px">Generated by CSO Property Services · '+new Date().toLocaleDateString()+'</p>';
  cl.sections.forEach((section,si)=>{
    html+='<h2>'+section.name+'</h2>';
    section.items.forEach((item,ii)=>{
      const key=si+'_'+ii;
      const checked=state[key]?'✓':'';
      html+='<div class="item"><div class="box" style="'+(checked?'background:#6B8F71;border-color:#6B8F71;color:#fff':'')+'">'+checked+'</div><div>'+item+'</div></div>';
    });
  });
  html+='</body></html>';
  const w=window.open('','_blank');w.document.write(html);w.document.close();
  setTimeout(()=>w.print(),500);
  toast('Print dialog opening…');
}

function showStaffTab(tab){
  const r=document.getElementById('staff-roster-view');
  const a=document.getElementById('staff-availability-view');
  if(!r||!a)return;
  if(tab==='availability'){r.style.display='none';a.style.display='block';if(typeof renderAvailability==='function')renderAvailability();}
  else{r.style.display='block';a.style.display='none';}
}
function renderStaff() {
  const grid=document.getElementById('staff-grid');
  if(!grid)return;
  const staff=cData.staff||[];
  if(!staff.length){
    grid.innerHTML=`<div class="empty-state" style="grid-column:1/-1"><div class="es-i">👥</div><h3>No staff yet</h3><p>Add your cleaners and maintenance staff</p><button class="btn btn-pri" onclick="openModal('add-staff-modal')" style="margin-top:10px">Add Staff</button></div>`;
    document.getElementById('staff-tasks-card').style.display='none';
    return;
  }
  const roleColors={cleaner:'#F5E6D3',handyman:'#D3E8E0',manager:'#D3DCE8',other:'#E8E3D3'};
  const roleTextColors={cleaner:'#C4693A',handyman:'#4A7D50',manager:'#2E4460',other:'#6B5A2E'};
  grid.innerHTML=staff.map(s=>{
    const tasks=cData.tasks.filter(t=>t.assignee===s.name);
    const pending=tasks.filter(t=>!t.done).length;
    const done=tasks.filter(t=>t.done).length;
    return `<div class="card" style="cursor:pointer" onclick="showStaffTasks('${s.id}')">
      <div class="card-body">
        <div style="display:flex;align-items:center;gap:12px;margin-bottom:12px">
          <div style="width:44px;height:44px;border-radius:50%;background:${roleColors[s.role]||'#EDE8DE'};color:${roleTextColors[s.role]||'#6B5D52'};display:flex;align-items:center;justify-content:center;font-size:20px;flex-shrink:0">${s.emoji}</div>
          <div>
            <div style="font-size:14px;font-weight:600;color:var(--txt)">${s.name}</div>
            <div style="font-size:11px;color:var(--txt3);text-transform:capitalize">${s.role}</div>
          </div>
        </div>
        <div style="display:flex;gap:10px;margin-bottom:10px">
          <div style="background:var(--sand);border-radius:7px;padding:7px 10px;flex:1;text-align:center">
            <div style="font-size:18px;font-family:Fraunces,serif;color:var(--terra)">${pending}</div>
            <div style="font-size:10px;color:var(--txt3)">Pending</div>
          </div>
          <div style="background:var(--sand);border-radius:7px;padding:7px 10px;flex:1;text-align:center">
            <div style="font-size:18px;font-family:Fraunces,serif;color:var(--sage)">${done}</div>
            <div style="font-size:10px;color:var(--txt3)">Done</div>
          </div>
        </div>
        ${s.phone?`<div style="font-size:12px;color:var(--txt2)">📞 ${s.phone}</div>`:''}
        <div style="display:flex;gap:6px;margin-top:10px">
          <button class="btn btn-ghost" style="flex:1;justify-content:center;font-size:11px" onclick="event.stopPropagation();showStaffTasks('${s.id}')">View Tasks</button>
          <button class="btn btn-ghost" style="font-size:11px;padding:6px 8px;color:var(--terra)" onclick="event.stopPropagation();deleteStaff('${s.id}','${s.name}')">🗑</button>
        </div>
      </div>
    </div>`;
  }).join('');
}

function showStaffTasks(staffId) {
  const s = (cData.staff||[]).find(x=>x.id===staffId);
  if(!s) return;
  const card=document.getElementById('staff-tasks-card');
  const title=document.getElementById('staff-task-title');
  const list=document.getElementById('staff-task-list');
  if(!card||!title||!list) return;
  const tasks=cData.tasks.filter(t=>t.assignee===s.name);
  title.textContent=`${s.emoji} ${s.name}'s Tasks`;
  card.style.display='block';
  card.dataset.staffId=staffId;
  if(!tasks.length){list.innerHTML=`<div style="font-size:13px;color:var(--txt3);padding:10px 0">No tasks assigned to ${s.name} yet. Add tasks in the Tasks page.</div>`;return;}
  list.innerHTML=tasks.map(t=>`
    <div class="task-card" onclick="toggleTask('${t.id}');showStaffTasks('${staffId}')">
      <div class="task-cb${t.done?' done':''}"> ${t.done?'✓':''}</div>
      <div style="flex:1">
        <div style="font-size:13px;font-weight:500;color:var(--txt);${t.done?'text-decoration:line-through;opacity:.5':''}">${t.title}</div>
        <div style="font-size:11px;color:var(--txt3);margin-top:2px">${t.propName||'No property'} ${t.due?'· Due '+t.due:''}</div>
      </div>
      <span class="tpri ${t.priority}">${t.priority}</span>
    </div>`).join('');
  card.scrollIntoView({behavior:'smooth',block:'nearest'});
}

function copyStaffLink() {
  const card=document.getElementById('staff-tasks-card');
  const staffId=card?.dataset.staffId;
  const s=(cData.staff||[]).find(x=>x.id===staffId);
  if(!s){toast('Select a staff member first');return;}
  // In a real app this would be a unique URL — for now copy a shareable message
  const tasks=cData.tasks.filter(t=>t.assignee===s.name&&!t.done);
  const taskList=tasks.map(t=>`• ${t.title}${t.due?' (Due: '+t.due+')':''}`).join('\n');
  const msg=`Hi ${s.name}! Here are your current tasks:\n\n${taskList||'No pending tasks'}\n\nPlease update your status when complete. - via CSO Property Services`;
  navigator.clipboard.writeText(msg).then(()=>toast('Task list copied to clipboard! Send to '+s.name)).catch(()=>toast('Copy failed — try again'));
}

function deleteStaff(id, name) {
  if(!confirm(`Remove ${name} from staff?`)) return;
  cData.staff=(cData.staff||[]).filter(x=>x.id!==id);
  saveUserData(cUid,cData);
  renderStaff();
  toast(`${name} removed`);
}

// ════════════════════════════════════════════
//  REVIEW AUTOMATION
// ════════════════════════════════════════════
let reviewAutoEnabled = true;

function toggleReviewAuto() {
  reviewAutoEnabled = !reviewAutoEnabled;
  const t=document.getElementById('review-auto-toggle');
  if(t){t.className='toggle '+(reviewAutoEnabled?'on':'off');}
  toast('Review automation '+(reviewAutoEnabled?'enabled':'disabled'));
  if(!cData.reviewAuto)cData.reviewAuto={};
  cData.reviewAuto.enabled=reviewAutoEnabled;
  saveUserData(cUid,cData);
}

function saveReviewTemplate() {
  const tmpl=document.getElementById('review-template')?.value;
  if(!cData.reviewAuto)cData.reviewAuto={};
  cData.reviewAuto.template=tmpl;
  saveUserData(cUid,cData);
  toast('Review template saved! ✓');
}

function checkReviewRequests() {
  const el=document.getElementById('review-requests-list');
  if(!el) return;
  const completed=cData.bookings.filter(b=>b.status==='completed');
  const reviewed=cData.reviews.map(r=>r.bookingId);
  const pending=completed.filter(b=>!reviewed.includes(b.id));
  if(!pending.length){el.innerHTML=`<div style="font-size:13px;color:var(--sage)">✓ All completed bookings have been reviewed!</div>`;return;}
  el.innerHTML=pending.map(b=>`
    <div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid var(--border)">
      <div style="font-size:17px">${b.propEmoji||'🏠'}</div>
      <div style="flex:1"><div style="font-size:13px;font-weight:500;color:var(--txt)">${b.guestName}</div><div style="font-size:11px;color:var(--txt3)">${b.propName} · ${b.checkout||'TBD'}</div></div>
      <button class="btn btn-pri" style="font-size:11px;padding:5px 10px" onclick="sendReviewRequest('${b.id}')">📋 Copy Request</button>
    </div>`).join('');
}

function sendReviewRequest(bookingId) {
  const b=cData.bookings.find(x=>x.id===bookingId);
  if(!b) return;
  const tmpl=(cData.reviewAuto?.template)||`Hi {guest_name}! 🌟 Thank you for staying at {property_name}! If you enjoyed your stay, we'd love a review — it really helps us. Hope to host you again! 😊`;
  const msg=tmpl.replace('{guest_name}',b.guestName).replace('{property_name}',b.propName);
  navigator.clipboard.writeText(msg).then(()=>toast(`Review request for ${b.guestName} copied! Paste into Airbnb messaging.`)).catch(()=>toast('Copy failed'));
}

// Auto-trigger review request when booking marked complete
function onBookingCompleted(booking) {
  if(!reviewAutoEnabled) return;
  setTimeout(()=>{
    toast(`⭐ ${booking.guestName}'s stay is complete! Go to Reviews to send a review request.`);
  }, 500);
}
// ════════════════════════════════════════════
//  EXPENSES
// ════════════════════════════════════════════
function addExpense() {
  const desc = document.getElementById('exp-desc').value.trim();
  const amount = parseFloat(document.getElementById('exp-amount').value)||0;
  const date = document.getElementById('exp-date').value;
  if(!desc||!amount){toast('Enter description and amount');return;}
  if(!cData.expenses) cData.expenses=[];
  const receiptImg = document.getElementById('exp-receipt-img');
  const receiptData = receiptImg?.src && receiptImg.src.startsWith('data:') ? receiptImg.src : null;
  const exp = {
    id:'ex_'+Date.now(),
    desc, amount, date,
    cat: document.getElementById('exp-cat').value,
    propId: document.getElementById('exp-prop').value,
    notes: document.getElementById('exp-notes').value,
    receipt: receiptData,
    created: Date.now()
  };
  cData.expenses.push(exp);
  saveUserData(cUid,cData);
  closeModal('add-expense-modal');
  ['exp-desc','exp-amount','exp-date','exp-notes'].forEach(id=>{const el=document.getElementById(id);if(el)el.value='';});
  removeReceiptPhoto();
  toast(`Expense of $${amount} added!${receiptData?' Receipt attached 📷':''}`);
  renderExpenses();
}

function previewReceiptPhoto(input) {
  const file = input.files[0];
  if(!file) return;
  const reader = new FileReader();
  reader.onload = function(e) {
    const img = document.getElementById('exp-receipt-img');
    const preview = document.getElementById('exp-receipt-preview');
    const placeholder = document.getElementById('exp-receipt-placeholder');
    const removeBtn = document.getElementById('exp-receipt-remove');
    if(img) img.src = e.target.result;
    if(preview) preview.style.display = 'block';
    if(placeholder) placeholder.style.display = 'none';
    if(removeBtn) removeBtn.style.display = 'inline';
  };
  reader.readAsDataURL(file);
}

function removeReceiptPhoto() {
  const img = document.getElementById('exp-receipt-img');
  const preview = document.getElementById('exp-receipt-preview');
  const placeholder = document.getElementById('exp-receipt-placeholder');
  const removeBtn = document.getElementById('exp-receipt-remove');
  const input = document.getElementById('exp-receipt-input');
  if(img) img.src = '';
  if(preview) preview.style.display = 'none';
  if(placeholder) placeholder.style.display = 'block';
  if(removeBtn) removeBtn.style.display = 'none';
  if(input) input.value = '';
}

function viewReceipt(expId) {
  const exp = (cData.expenses||[]).find(e=>e.id===expId);
  if(!exp?.receipt) return;
  const w = window.open('', '_blank', 'width=600,height=800');
  w.document.write(`<!DOCTYPE html><html><head><title>Receipt — ${exp.desc}</title><style>body{margin:0;background:#1a1209;display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;font-family:sans-serif}img{max-width:100%;max-height:90vh;border-radius:8px;box-shadow:0 4px 24px rgba(0,0,0,.5)}p{color:#9B8E85;font-size:13px;margin-top:12px}h3{color:#FAF7F2;font-family:Georgia,serif;font-size:18px;margin-bottom:8px}</style></head><body><h3>${exp.desc}</h3><p>$${exp.amount} · ${exp.date||'No date'} · ${exp.cat}</p><img src="${exp.receipt}"><p>Receipt attached via CSO Property Services</p></body></html>`);
}

function deleteExpense(id) {
  cData.expenses = (cData.expenses||[]).filter(e=>e.id!==id);
  saveUserData(cUid,cData);
  renderExpenses();
  toast('Expense deleted');
}

function renderExpenses() {
  const expenses = cData.expenses||[];
  const revenue = cData.bookings.filter(b=>b.status!=='cancelled').reduce((s,b)=>s+b.price,0);
  const totalExp = expenses.reduce((s,e)=>s+e.amount,0);
  const profit = revenue - totalExp;
  const margin = revenue ? Math.round(profit/revenue*100) : 0;

  const set=(id,v)=>{const el=document.getElementById(id);if(el)el.textContent=v;};
  set('exp-revenue','$'+revenue.toLocaleString());
  set('exp-total','$'+totalExp.toLocaleString());
  set('exp-profit',(profit>=0?'+$':'-$')+Math.abs(profit).toLocaleString());
  set('exp-margin',margin+'%');

  const profitEl = document.getElementById('exp-profit');
  if(profitEl) profitEl.style.color = profit>=0?'var(--sage)':'var(--terra)';

  const list = document.getElementById('expenses-list');
  if(!list) return;
  if(!expenses.length){
    list.innerHTML='<div class="empty-state"><div class="es-i">💸</div><h3>No expenses yet</h3><p>Track cleaning fees, repairs, supplies, and more</p><button class="btn btn-pri" onclick="openModal(\'add-expense-modal\')" style="margin-top:10px">Add First Expense</button></div>';
    return;
  }
  const catEmojis={cleaning:'🧹',supplies:'🛒',repair:'🔧',utilities:'💡',mortgage:'🏠',insurance:'🛡',tax:'📋',other:'📦'};
  const sorted = [...expenses].sort((a,b)=>new Date(b.date||b.created)-new Date(a.date||a.created));
  list.innerHTML = sorted.map(e=>`
    <div class="row" style="cursor:default">
      <div style="font-size:22px;flex-shrink:0">${catEmojis[e.cat]||'📦'}</div>
      <div class="row-info">
        <div class="row-title">${e.desc}${e.receipt?` <span style="background:rgba(107,143,113,.15);border:1px solid var(--sage);border-radius:4px;padding:1px 5px;font-size:9px;color:var(--sage);font-weight:700;cursor:pointer" onclick="viewReceipt('${e.id}')">📷 Receipt</span>`:''}</div>
        <div class="row-sub">${e.cat} · ${e.date||'No date'}${e.notes?' · '+e.notes:''}</div>
      </div>
      ${e.receipt?`<img src="${e.receipt}" onclick="viewReceipt('${e.id}')" style="width:36px;height:36px;border-radius:6px;object-fit:cover;cursor:pointer;flex-shrink:0;border:1px solid var(--border)" title="View receipt">`:'' }
      <div class="row-price" style="color:var(--terra)">-$${e.amount.toLocaleString()}</div>
      <button class="btn btn-ghost" style="font-size:10px;padding:3px 8px;color:var(--terra);flex-shrink:0" onclick="deleteExpense('${e.id}')">🗑</button>
    </div>`).join('');
}

function exportExpensesCSV() {
  const expenses = cData.expenses||[];
  if(!expenses.length){toast('No expenses to export');return;}
  const header = 'Date,Description,Category,Amount,Property,Notes';
  const rows = expenses.map(e=>`"${e.date||''}","${e.desc}","${e.cat}",${e.amount},"${e.propId?cData.properties.find(p=>p.id===e.propId)?.name||'':'All'}","${e.notes||''}"`);
  const csv = header+'\n'+rows.join('\n');
  const a = document.createElement('a');
  a.href='data:text/csv;charset=utf-8,'+encodeURIComponent(csv);
  a.download='cso-expenses-'+new Date().toISOString().slice(0,10)+'.csv';
  a.click();
  toast('Expenses exported! ✓');
}

// ════════════════════════════════════════════
//  GUEST BLACKLIST
// ════════════════════════════════════════════
function addToBlacklist() {
  const name = document.getElementById('bl-name').value.trim();
  if(!name){toast('Enter guest name');return;}
  if(!cData.blacklist) cData.blacklist=[];
  const reasonLabels={property_damage:'Property damage',noise:'Noise complaints',unauthorized_guests:'Unauthorized guests',smoking:'Smoking inside',cleanliness:'Left in bad condition',late_checkout:'Late checkout',bad_reviews:'Unfair review',other:'Other'};
  const entry = {
    id:'bl_'+Date.now(),
    name,
    email: document.getElementById('bl-email').value,
    reason: document.getElementById('bl-reason').value,
    reasonLabel: reasonLabels[document.getElementById('bl-reason').value]||'Other',
    notes: document.getElementById('bl-notes').value,
    created: Date.now()
  };
  cData.blacklist.push(entry);
  saveUserData(cUid,cData);
  closeModal('add-blacklist-modal');
  ['bl-name','bl-email','bl-notes'].forEach(id=>{const el=document.getElementById(id);if(el)el.value='';});
  toast(`${name} flagged`);
  renderBlacklist();
}

function removeFromBlacklist(id) {
  if(!confirm('Remove this guest from the blacklist?')) return;
  cData.blacklist = (cData.blacklist||[]).filter(b=>b.id!==id);
  saveUserData(cUid,cData);
  renderBlacklist();
  toast('Guest removed from blacklist');
}

function renderBlacklist() {
  const list = document.getElementById('blacklist-list');
  if(!list) return;
  const bl = cData.blacklist||[];
  if(!bl.length){
    list.innerHTML='<div class="empty-state"><div class="es-i">🚫</div><h3>No flagged guests</h3><p>Add guests you want to avoid in the future</p></div>';
    return;
  }
  list.innerHTML = bl.map(g=>`
    <div class="row" style="cursor:default">
      <div style="width:38px;height:38px;border-radius:50%;background:rgba(196,105,58,.12);color:var(--terra);display:flex;align-items:center;justify-content:center;font-size:16px;flex-shrink:0">🚫</div>
      <div class="row-info">
        <div class="row-title">${g.name}</div>
        <div class="row-sub">${g.email?g.email+' · ':''}${g.reasonLabel}${g.notes?' · "'+g.notes+'"':''}</div>
      </div>
      <div style="font-size:11px;color:var(--txt3);flex-shrink:0">${new Date(g.created).toLocaleDateString()}</div>
      <button class="btn btn-ghost" style="font-size:10px;padding:3px 8px;flex-shrink:0" onclick="removeFromBlacklist('${g.id}')">Remove</button>
    </div>`).join('');
}

// ════════════════════════════════════════════
//  DISCOUNT CALCULATOR
// ════════════════════════════════════════════
function setDiscount(pct) {
  const el = document.getElementById('disc-pct');
  if(el){el.value=pct;calcDiscount();}
}

function calcDiscount() {
  const rate = parseFloat(document.getElementById('disc-rate')?.value)||0;
  const nights = parseInt(document.getElementById('disc-nights')?.value)||0;
  const pct = parseFloat(document.getElementById('disc-pct')?.value)||0;
  const subtotal = rate * nights;
  const savings = Math.round(subtotal * pct/100 * 100)/100;
  const final = subtotal - savings;
  const set=(id,v)=>{const el=document.getElementById(id);if(el)el.textContent=v;};
  set('disc-subtotal','$'+subtotal.toLocaleString());
  set('disc-savings','-$'+savings.toLocaleString());
  set('disc-final','$'+final.toLocaleString());
}

// ════════════════════════════════════════════
//  SEASONAL PRICING
// ════════════════════════════════════════════
function addSeason() {
  const name = document.getElementById('sea-name').value.trim();
  const start = document.getElementById('sea-start').value;
  const end = document.getElementById('sea-end').value;
  const adj = document.getElementById('sea-adj').value.trim();
  if(!name||!start||!end||!adj){toast('Fill in all fields');return;}
  if(!cData.seasons) cData.seasons=[];
  cData.seasons.push({
    id:'s_'+Date.now(), name, start, end, adj,
    type: document.getElementById('sea-type').value,
    propId: document.getElementById('sea-prop').value,
    created: Date.now()
  });
  saveUserData(cUid,cData);
  closeModal('add-season-modal');
  toast(`"${name}" season added!`);
  renderSeasons();
}

function deleteSeason(id) {
  cData.seasons = (cData.seasons||[]).filter(s=>s.id!==id);
  saveUserData(cUid,cData);
  renderSeasons();
  toast('Season deleted');
}

function renderSeasons() {
  const list = document.getElementById('seasons-list');
  if(!list) return;
  const seasons = cData.seasons||[];
  if(!seasons.length){
    list.innerHTML='<div style="font-size:13px;color:var(--txt3);text-align:center;padding:16px">No seasonal rules yet — add peak season, holiday, or low season pricing</div>';
    return;
  }
  list.innerHTML = seasons.map(s=>{
    const prop = cData.properties.find(p=>p.id===s.propId);
    const adj = parseFloat(s.adj);
    const color = adj>0?'var(--sage)':'var(--terra)';
    return `<div class="row" style="cursor:default">
      <div style="font-size:22px">🌿</div>
      <div class="row-info">
        <div class="row-title">${s.name}</div>
        <div class="row-sub">${s.start} → ${s.end}${prop?' · '+prop.name:' · All properties'}</div>
      </div>
      <div style="font-family:Fraunces,serif;font-size:16px;font-weight:600;color:${color}">${adj>0?'+':''}${s.adj}${s.type==='percent'?'%':'$'}</div>
      <button class="btn btn-ghost" style="font-size:10px;padding:3px 8px;color:var(--terra);flex-shrink:0" onclick="deleteSeason('${s.id}')">🗑</button>
    </div>`;
  }).join('');
}

function renderPricing(){
  const list=document.getElementById('pricing-list');if(!list)return;
  const props=cData.properties;
  if(!props.length){list.innerHTML=`<div class="empty-state"><div class="es-i">💰</div><p>Add properties first</p></div>`;return;}
  list.innerHTML=props.map(p=>`<div class="row" style="cursor:default"><div style="font-size:18px">${p.emoji}</div><div class="row-info"><div class="row-title">${p.name}</div><div class="row-sub">${p.location}</div></div><div style="text-align:right"><div style="font-family:Fraunces,serif;font-size:20px;color:var(--txt)">$${p.rate}</div><div style="font-size:10px;color:var(--txt3)">per night</div></div><button class="btn btn-ghost" style="font-size:10px;padding:4px 9px" onclick="openPropertyDetail('${p.id}')">Edit Rate</button></div>`).join('');
  renderSeasons();
}

// ════════════════════════════════════════════
//  PHOTO MANAGEMENT
// ════════════════════════════════════════════

// Temporary photo storage for current modal session
let tempBookingPhotos = []; // [{data, type, name}]
let tempPropertyPhotos = []; // [{data, name}]
let currentEditPropPhotos = []; // existing photos being edited

function previewPhoto(inputId, previewId) {
  const input = document.getElementById(inputId);
  const preview = document.getElementById(previewId);
  if(!input||!preview||!input.files[0]) return;
  const reader = new FileReader();
  reader.onload = e=>{
    preview.innerHTML=`<img src="${e.target.result}" style="width:100%;max-height:160px;object-fit:cover;border-radius:8px;border:1px solid var(--border)">`;
  };
  reader.readAsDataURL(input.files[0]);
}

async function getPhotoData(inputId) {
  return new Promise(resolve=>{
    const input = document.getElementById(inputId);
    if(!input||!input.files[0]){resolve(null);return;}
    const reader = new FileReader();
    reader.onload = e=>resolve(e.target.result);
    reader.readAsDataURL(input.files[0]);
  });
}

function addBookingPhotos(input, type) {
  const typeLabels = {before:'📷 Before',after:'🧹 After',damage:'⚠️ Damage'};
  const typeColors = {before:'var(--sage)',after:'var(--gold)',damage:'var(--terra)'};
  Array.from(input.files).forEach(file=>{
    const reader = new FileReader();
    reader.onload = e=>{
      tempBookingPhotos.push({data:e.target.result, type, name:file.name});
      renderBookingPhotoPreview();
    };
    reader.readAsDataURL(file);
  });
  input.value='';
}

function renderBookingPhotoPreview() {
  const preview = document.getElementById('mb-photos-preview');
  if(!preview) return;
  const typeColors = {before:'#6B8F71',after:'#C8A84B',damage:'#C4693A'};
  const typeLabels = {before:'Before',after:'After Clean',damage:'Damage'};
  preview.innerHTML = tempBookingPhotos.map((p,i)=>`
    <div style="position:relative;cursor:pointer" onclick="removeBookingPhoto(${i})" title="Click to remove">
      <img src="${p.data}" style="width:72px;height:72px;object-fit:cover;border-radius:8px;border:2px solid ${typeColors[p.type]||'var(--border)'}">
      <div style="position:absolute;bottom:2px;left:0;right:0;text-align:center;font-size:8px;font-weight:700;color:#fff;background:${typeColors[p.type]||'var(--border)'};padding:1px 2px;border-radius:0 0 6px 6px">${typeLabels[p.type]||p.type}</div>
      <div style="position:absolute;top:-4px;right:-4px;width:16px;height:16px;background:var(--terra);border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:10px;color:#fff;font-weight:700">×</div>
    </div>`).join('');
}

function removeBookingPhoto(index) {
  tempBookingPhotos.splice(index,1);
  renderBookingPhotoPreview();
}

function addPropertyPhotos() {
  const input = document.getElementById('ep-photo');
  if(!input||!input.files.length) return;
  Array.from(input.files).forEach(file=>{
    const reader = new FileReader();
    reader.onload = e=>{
      currentEditPropPhotos.push({data:e.target.result, name:file.name, added:Date.now()});
      renderPropertyGallery();
    };
    reader.readAsDataURL(file);
  });
  input.value='';
}

function renderPropertyGallery() {
  const gallery = document.getElementById('ep-gallery');
  if(!gallery) return;
  if(!currentEditPropPhotos.length){
    gallery.innerHTML='<div style="font-size:12px;color:var(--txt3);padding:8px 0">No photos yet — upload some above</div>';
    return;
  }
  gallery.innerHTML = currentEditPropPhotos.map((p,i)=>`
    <div style="position:relative;cursor:pointer" onclick="removePropertyPhoto(${i})" title="Click to remove">
      <img src="${p.data}" style="width:80px;height:80px;object-fit:cover;border-radius:8px;border:1px solid var(--border)">
      <div style="position:absolute;top:-4px;right:-4px;width:16px;height:16px;background:var(--terra);border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:10px;color:#fff;font-weight:700">×</div>
    </div>`).join('');
}

function removePropertyPhoto(index) {
  currentEditPropPhotos.splice(index,1);
  renderPropertyGallery();
}

// Show booking photos in booking list
function renderBookingPhotoBadge(b) {
  const photos = b.photos||[];
  if(!photos.length) return '';
  const dmg = photos.filter(p=>p.type==='damage').length;
  return `<span style="font-size:10px;background:${dmg>0?'rgba(196,105,58,.1)':'var(--sand)'};color:${dmg>0?'var(--terra)':'var(--txt3)'};padding:2px 7px;border-radius:10px;border:1px solid ${dmg>0?'var(--terra-l)':'var(--border)'}">📸 ${photos.length}${dmg>0?' ⚠️':''}</span>`;
}

// View booking photos modal
function viewBookingPhotos(bookingId) {
  const b = cData.bookings.find(x=>x.id===bookingId);
  if(!b||!b.photos?.length) return;
  const existing = document.getElementById('booking-photos-modal');
  if(existing) existing.remove();
  const div = document.createElement('div');
  div.id = 'booking-photos-modal';
  div.className = 'modal-bg open';
  const typeLabels = {before:'📷 Before Check-in',after:'🧹 After Cleaning',damage:'⚠️ Damage'};
  const typeColors = {before:'#6B8F71',after:'#C8A84B',damage:'#C4693A'};
  const groups = {before:[],after:[],damage:[]};
  b.photos.forEach(p=>{ if(groups[p.type]) groups[p.type].push(p); });
  let html = `<div class="modal" style="max-width:600px;max-height:80vh;overflow-y:auto">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px">
      <h2>📸 ${b.guestName} — Photos</h2>
      <button class="btn btn-ghost" onclick="document.getElementById('booking-photos-modal').remove()">✕</button>
    </div>`;
  Object.entries(groups).forEach(([type,photos])=>{
    if(!photos.length) return;
    html += `<div style="margin-bottom:16px">
      <div style="font-size:11px;font-weight:700;letter-spacing:.7px;text-transform:uppercase;color:${typeColors[type]};margin-bottom:8px">${typeLabels[type]} (${photos.length})</div>
      <div style="display:flex;flex-wrap:wrap;gap:8px">
        ${photos.map(p=>`<img src="${p.data}" style="width:120px;height:120px;object-fit:cover;border-radius:8px;border:2px solid ${typeColors[type]};cursor:pointer" onclick="window.open(this.src)" title="Click to view full size">`).join('')}
      </div>
    </div>`;
  });
  html += '</div>';
  div.innerHTML = html;
  document.body.appendChild(div);
}

// ════════════════════════════════════════════
//  BOOKING SOURCE ANALYTICS
// ════════════════════════════════════════════
function renderBookingSourceChart() {
  const chartEl = document.getElementById('source-chart');
  if(!chartEl) return;
  const bookings = cData.bookings.filter(b=>b.status!=='cancelled');
  if(!bookings.length){chartEl.innerHTML='<div style="font-size:12px;color:var(--txt3);text-align:center;padding:16px">Add bookings to see source breakdown</div>';return;}
  const sources={};
  bookings.forEach(b=>{const s=b.source||'other';sources[s]=(sources[s]||0)+1;});
  const total=bookings.length;
  const colors={airbnb:'#FF5A5F',vrbo:'#3D82BE',direct:'var(--sage)',other:'var(--gold)',booking_com:'#003580'};
  const labels={airbnb:'Airbnb',vrbo:'VRBO',direct:'Direct',other:'Other',booking_com:'Booking.com'};
  chartEl.innerHTML=Object.entries(sources).sort((a,b)=>b[1]-a[1]).map(([src,count])=>{
    const pct=Math.round(count/total*100);
    return `<div style="margin-bottom:10px">
      <div style="display:flex;justify-content:space-between;margin-bottom:4px">
        <span style="font-size:12px;color:var(--txt)">${labels[src]||src}</span>
        <span style="font-size:12px;color:var(--txt3)">${count} booking${count>1?'s':''} (${pct}%)</span>
      </div>
      <div style="background:var(--border);border-radius:4px;height:8px;overflow:hidden">
        <div style="width:${pct}%;height:100%;background:${colors[src]||'var(--terra)'};border-radius:4px;transition:width .4s"></div>
      </div>
    </div>`;
  }).join('');
}

// ════════════════════════════════════════════
//  CLEANER MARKETPLACE
// ════════════════════════════════════════════
