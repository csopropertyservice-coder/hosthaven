// ════════════════════════════════════════════
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

