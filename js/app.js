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
  toast('Creating database tables… check console for SQL to run in Supabase');
  console.log(`-- Run this SQL in Supabase SQL Editor:
-- ════════════════════════════════════════════
-- CSO PROPERTY SERVICES — Subscription & Property Enforcement Layer
-- Run this in Supabase → SQL Editor
-- ════════════════════════════════════════════

-- 1. PROFILES TABLE — with full subscription tracking
CREATE TABLE IF NOT EXISTS public.profiles (
  id                  uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email               text,
  full_name           text,
  plan                text DEFAULT 'free',          -- free | trial | pro | business | cohost
  subscription_tier   text DEFAULT 'free',          -- mirrors plan, used by RLS functions
  trial_start_date    timestamptz,                  -- when trial started
  is_trial_active     boolean DEFAULT false,        -- server-side trial flag
  trial_expires_at    timestamptz,                  -- trial_start_date + 14 days
  stripe_customer_id  text,                         -- for billing portal
  stripe_sub_id       text,                         -- active Stripe subscription ID
  role                text DEFAULT 'user',          -- user | admin
  property_count      int DEFAULT 0,               -- denormalized count, updated by trigger
  created_at          timestamptz DEFAULT now(),
  updated_at          timestamptz DEFAULT now()
);

-- 2. ROW LEVEL SECURITY
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Admins can view all profiles" ON public.profiles
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );
CREATE POLICY "Admins can update all profiles" ON public.profiles
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- 3. USER DATA TABLE
CREATE TABLE IF NOT EXISTS public.user_data (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  data_type  text NOT NULL DEFAULT 'main',
  data       jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, data_type)
);

ALTER TABLE public.user_data ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can own their data" ON public.user_data
  FOR ALL USING (user_id = auth.uid());

-- 4. PROPERTIES TABLE — for server-side count enforcement
CREATE TABLE IF NOT EXISTS public.properties (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  name       text NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.properties ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users own their properties" ON public.properties
  FOR ALL USING (user_id = auth.uid());

-- 5. SERVER-SIDE PROPERTY LIMIT FUNCTION
-- This runs with SECURITY DEFINER so it cannot be bypassed from the client
CREATE OR REPLACE FUNCTION public.get_plan_property_limit(user_plan text)
RETURNS integer
LANGUAGE sql IMMUTABLE
AS $$
  SELECT CASE user_plan
    WHEN 'free'           THEN 1
    WHEN 'trial'          THEN 10
    WHEN 'pro'            THEN 10
    WHEN 'cohost_starter' THEN 10
    WHEN 'business'       THEN 2147483647
    WHEN 'cohost'         THEN 2147483647
    ELSE 1
  END;
$$;

CREATE OR REPLACE FUNCTION public.check_property_limit()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  current_count integer;
  plan_limit    integer;
  user_plan     text;
BEGIN
  -- Get user's current plan
  SELECT subscription_tier INTO user_plan
    FROM public.profiles WHERE id = NEW.user_id;

  -- Get their limit
  plan_limit := public.get_plan_property_limit(COALESCE(user_plan, 'free'));

  -- Count existing properties
  SELECT COUNT(*) INTO current_count
    FROM public.properties WHERE user_id = NEW.user_id;

  IF current_count >= plan_limit THEN
    RAISE EXCEPTION 'PROPERTY_LIMIT_REACHED: Plan % allows % properties, you have %',
      user_plan, plan_limit, current_count;
  END IF;

  RETURN NEW;
END;
$$;

-- Attach trigger to properties table
DROP TRIGGER IF EXISTS enforce_property_limit ON public.properties;
CREATE TRIGGER enforce_property_limit
  BEFORE INSERT ON public.properties
  FOR EACH ROW EXECUTE FUNCTION public.check_property_limit();

-- 6. TRIAL EXPIRY FUNCTION — called by cron or on login
CREATE OR REPLACE FUNCTION public.check_and_expire_trials()
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.profiles
  SET
    subscription_tier = 'free',
    plan              = 'free',
    is_trial_active   = false,
    updated_at        = now()
  WHERE
    is_trial_active = true
    AND trial_expires_at IS NOT NULL
    AND trial_expires_at < now();
END;
$$;

-- 7. ADMIN CHECK FUNCTION
CREATE OR REPLACE FUNCTION public.check_admin_status(user_email text)
RETURNS boolean
LANGUAGE sql SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE email = user_email AND role = 'admin'
  );
$$;

-- 8. AUTO-UPDATE updated_at TRIGGER
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- 9. PLATFORM EARNINGS TABLE — records 10% MOR fee per completed job
CREATE TABLE IF NOT EXISTS public.platform_earnings (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  uid         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  job_id      text,
  amount      numeric(10,2) DEFAULT 0,
  provider_id text,
  created_at  timestamptz DEFAULT now()
);

ALTER TABLE public.platform_earnings ENABLE ROW LEVEL SECURITY;

-- Admin can read all earnings (for Platform Profit Dashboard)
CREATE POLICY "admin_read_all_earnings" ON public.platform_earnings
  FOR SELECT USING (true);

-- Users can only insert their own earnings records
CREATE POLICY "user_insert_own_earnings" ON public.platform_earnings
  FOR INSERT WITH CHECK (auth.uid() = uid);`);
  alert('SQL copied to console (F12). Go to Supabase → SQL Editor → paste and run it, then refresh.');
}

// ════════════════════════════════════════════
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
  list.innerHTML=filtered.map(o=>`<div class="row" style="cursor:default"><div style="font-size:20px">${ce[o.cat]||'📦'}</div><div class="row-info"><div class="row-title">${o.title}</div><div class="row-sub">${o.propName||''}${o.assignedTo?' · '+o.assignedTo:''}</div></div><span class="pill ${pc[o.priority]||'pill-amber'}">${o.priority}</span><span class="pill ${sc[o.status]||'pill-amber'}">${o.status.replace('_',' ')}</span><div class="row-price">$${(o.costActual||o.costEst||0).toLocaleString()}</div><select onchange="updateWOStatus('${o.id}',this.value)" style="font-size:10px;background:var(--input-bg);border:1px solid var(--border);border-radius:6px;padding:3px 6px;color:var(--txt)"><option value="open" ${o.status==='open'?'selected':''}>Open</option><option value="in_progress" ${o.status==='in_progress'?'selected':''}>In Progress</option><option value="completed" ${o.status==='completed'?'selected':''}>Completed</option></select></div>`).join('');
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
