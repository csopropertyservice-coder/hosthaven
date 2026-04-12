/* CSO Property Services — js/app-admin.js
   Split from app.js · DO NOT edit app.js directly
*/

/* CSO Property Services — js/app.js
   Lines 1338–7435 of original JS block
   DO NOT edit inline in index.html — edit this file instead
*/

//  ADMIN PANEL
// ════════════════════════════════════════════
async function renderAdmin() {
  // Wait for element to be in DOM
  const getTable = () => document.getElementById('admin-user-table');
  if(!getTable()) return;

  await checkAdminStatus(cUser?.email).catch(()=>false);
  if (!isAdmin) {
    getTable().innerHTML = `<div class="empty-state"><div class="es-i">🔒</div><h3>Not authorized</h3><p style="font-size:13px;color:var(--txt2)">Admin access is verified on the server. If you need access, contact support.</p></div>`;
    return;
  }
  
  const search = (document.getElementById('adm-search')?.value||'').toLowerCase();
  getTable().innerHTML = `<div style="text-align:center;padding:20px;color:var(--txt3)">Loading users…</div>`;

  try {
    let profiles = null, profilesError = null;
    try { const r = await sb.from('profiles').select('*').order('created_at',{ascending:false}); profiles = r.data; profilesError = r.error; } catch(e) { profilesError = e; }
    const error = profilesError;
    
    // Re-get element after async — page may have changed
    const table = getTable();
    if(!table) return; // user navigated away

    if(error) {
      sbHandleError(error, 'renderAdmin profiles');
      table.innerHTML=`<div class="empty-state"><div class="es-i">⚠️</div><h3>Error</h3><p style="font-size:11px">${JSON.stringify(error)}</p></div>`;
      return;
    }
    if(!profiles || profiles.length===0) {
      table.innerHTML=`<div class="empty-state"><div class="es-i">👥</div><h3>No users yet</h3><p>Users appear here when they sign up</p></div>`;
      ['adm-total','adm-paid','adm-pro','adm-mrr'].forEach(id=>{const el=document.getElementById(id);if(el)el.textContent=id==='adm-mrr'?'$0':'0';});
      return;
    }

    let allUsers = profiles;
    if(search) allUsers = allUsers.filter(u => u.email?.toLowerCase().includes(search) || u.full_name?.toLowerCase().includes(search));

    const pro = allUsers.filter(u=>u.plan==='pro');
    const biz = allUsers.filter(u=>u.plan==='business');
    const cohost = allUsers.filter(u=>u.plan==='cohost'||u.plan==='cohost_starter');
    const paid = allUsers.filter(u=>u.plan&&u.plan!=='free');
    const mrr = (pro.length*79)+(biz.length*199)+(cohost.length*299);

    const setEl=(id,v)=>{const el=document.getElementById(id);if(el)el.textContent=v;};
    const trial = allUsers.filter(u=>u.plan==='trial');
    const freeUsers = allUsers.filter(u=>!u.plan||u.plan==='free');
    const arr = mrr * 12;
    setEl('adm-total',allUsers.length);
    setEl('adm-paid',paid.length);
    setEl('adm-pro',pro.length);
    setEl('adm-biz',biz.length);
    setEl('adm-free',freeUsers.length);
    setEl('adm-mrr','$'+mrr.toLocaleString());
    setEl('adm-arr','$'+arr.toLocaleString());
    setEl('adm-pro-rev','$'+(pro.length*79).toLocaleString()+'/mo');
    setEl('adm-biz-rev','$'+(biz.length*199).toLocaleString()+'/mo');
    setEl('adm-cohost-rev','$'+(cohost.length*299).toLocaleString()+'/mo');
    const admCohostEl=document.getElementById('adm-cohost');if(admCohostEl)admCohostEl.textContent=cohost.length;
    // Goal tracker — $5,667/mo = $68k/yr
    const goal = 5667;
    const pct = Math.min(100, Math.round(mrr/goal*100));
    const goalBar = document.getElementById('adm-goal-bar');
    if(goalBar) goalBar.style.width=pct+'%';
    setEl('adm-goal-pct', pct+'%');
    setEl('adm-mrr2', '$'+mrr.toLocaleString());
    const goalMsg = document.getElementById('adm-goal-msg');
    if(goalMsg) {
      const remaining = goal - mrr;
      const proNeeded = remaining > 0 ? Math.ceil(remaining/79) : 0;
      const cohostNeeded = remaining > 0 ? Math.ceil(remaining/299) : 0;
      if(mrr >= goal) {
        goalMsg.innerHTML = '🎉 <strong>You hit the goal!</strong> $'+mrr.toLocaleString()+'/mo — you have surpassed your $68k salary target. Keep going!';
        goalMsg.style.color = 'var(--sage)';
      } else {
        goalMsg.innerHTML = 'Need <strong>$'+remaining.toLocaleString()+'/mo</strong> more to hit $68k/yr. That is <strong>'+proNeeded+' more Pro users</strong> or <strong>'+cohostNeeded+' Co-Host users</strong>.';
      }
    }

    const planColor=p=>p==='business'?'pill-blue':p==='pro'?'pill-green':p==='cohost'?'pill-gold':p==='cohost_starter'?'pill-gold':'pill-amber';
    const planLabel=p=>p==='business'?'💼 Business':p==='pro'?'🚀 Pro':p==='cohost'?'🏆 Co-Host Pro':p==='cohost_starter'?'🤝 Co-Host Starter':p==='trial'?'🎯 Trial':'⭐ Free';

    table.innerHTML=`<table class="report-table" style="width:100%">
      <thead><tr><th>Name</th><th>Email</th><th>Plan</th><th>Joined</th><th>Actions</th></tr></thead>
      <tbody>
        ${allUsers.map(u=>{
          const isMe=u.email?.toLowerCase()===ADMIN_EMAIL.toLowerCase();
          const plan=u.plan||'free';
          const joined=u.created_at?new Date(u.created_at).toLocaleDateString():'—';
          return `<tr>
            <td style="font-weight:500">${u.full_name||'—'}${isMe?' 👑':''}</td>
            <td style="font-size:12px;color:var(--txt2)">${u.email||'—'}</td>
            <td><span class="pill ${planColor(plan)}">${planLabel(plan)}</span></td>
            <td style="font-size:11px;color:var(--txt3)">${joined}</td>
            <td>${isMe?`<span style="font-size:11px;color:var(--txt3)">You 👑</span>`:`
              <div style="display:flex;gap:5px;flex-wrap:wrap">
                <button class="btn btn-ghost" style="font-size:10px;padding:3px 8px" onclick="upgradePlan('${u.id}','${u.email||''}','${u.full_name||'User'}','pro')">→ Pro</button>
                <button class="btn btn-ghost" style="font-size:10px;padding:3px 8px" onclick="upgradePlan('${u.id}','${u.email||''}','${u.full_name||'User'}','business')">→ Biz</button>
                <button class="btn btn-ghost" style="font-size:10px;padding:3px 8px;background:rgba(200,168,75,.15);color:var(--gold)" onclick="upgradePlan('${u.id}','${u.email||''}','${u.full_name||'User'}','cohost')">→ CoHost</button>
                <button class="btn btn-ghost" style="font-size:10px;padding:3px 8px;color:var(--txt3)" onclick="upgradePlan('${u.id}','${u.email||''}','${u.full_name||'User'}','free')">→ Free</button>
              </div>`}
            </td>
          </tr>`;
        }).join('')}
      </tbody>
    </table>`;
  } catch(e) {
    const table=getTable();
    if(table) table.innerHTML=`<div class="empty-state"><div class="es-i">⚠️</div><h3>Error</h3><p style="font-size:11px">${e.message}</p></div>`;
  }
}

async function upgradePlan(uid, email, name, plan) {
  await checkAdminStatus(cUser?.email).catch(()=>false);
  if (!isAdmin) {
    toast('Not authorized');
    return;
  }
  try {
    let upr; try { upr = await sb.from('profiles').upsert({id:uid, email, plan, updated_at:new Date().toISOString()},{onConflict:'id'}); } catch(e) { upr = {error:e}; }
    if (upr.error) {
      sbHandleError(upr.error, 'upgradePlan');
      throw upr.error;
    }
    // Also update local cache for that user
    const local = getLocal();
    if(local[uid]) { local[uid].plan=plan; setLocal(local); }
    toast(`✓ ${name} upgraded to ${plan}!`);
    renderAdmin();
  } catch(e) {
    toast('Error updating plan: '+e.message);
  }
}

async function setupSupabase() {
async function setupSupabase() {
  // FIX #8: Removed console.log of SQL schema — use the Help Center SQL tab instead
  toast('Database setup: copy the SQL from Help Center → Setup tab and run it in Supabase SQL Editor');
  alert('SQL copied to console (F12). Go to Supabase → SQL Editor → paste and run it, then refresh.');
}

// ════════════════════════════════════════════
