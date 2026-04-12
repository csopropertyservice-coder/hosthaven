/* CSO Property Services — js/auth.js
   Lines 511–967 of original JS block
   DO NOT edit inline in index.html — edit this file instead
*/

//  AUTH — Supabase powered
// ════════════════════════════════════════════
async function doLogin() {
  const email=document.getElementById('login-email').value.trim().toLowerCase();
  const pw=document.getElementById('login-pw').value;
  const remember=document.getElementById('login-remember')?.checked !== false;
  if(!email||!pw){showErr('login-err','Please enter email and password');return;}
  const loginBtn = document.querySelector('#screen-login .btn-pri');
  if(loginBtn){loginBtn.textContent='Signing in…';loginBtn.disabled=true;loginBtn.style.opacity='.7';}
  try {
    const {data,error} = await sb.auth.signInWithPassword({email,password:pw}).catch((e)=>({data:null,error:e}));
    if(error) {
      if (!String(error.message||'').toLowerCase().includes('invalid login')) sbHandleError(error, 'signIn');
      throw error;
    }
    // Save email for remember me
    try {
      if(remember) { localStorage.setItem('hh_remembered_email', email); }
      else { localStorage.removeItem('hh_remembered_email'); }
    } catch(e) {}
    const user = data.user;
    cUid = user.id;
    cUser = {email:user.email, name:user.user_metadata?.full_name||email.split('@')[0], role:user.user_metadata?.role||'user'};
    // Load cloud data first
    const cloudData = await loadFromSupabase(cUid);
    if(cloudData) {
      const localData = getLocalData(cUid);
      const merged = {...cloudData};
      if(localData.apiKey && !cloudData.apiKey) merged.apiKey = localData.apiKey;
      saveUserData(cUid, merged);
    }
    getUserData(cUid);
    // Sync plan
    try {
      let _pRes; try { _pRes = await sb.from('profiles').select('plan,full_name').eq('id',cUid).single(); } catch(e) { _pRes = {data:null,error:e}; } const {data:profile, error:profErr} = _pRes||{data:null,error:null};
      if (profErr) sbHandleError(profErr, 'doLogin profiles');
      if(profile){cData.plan=profile.plan||cData.plan;if(profile.full_name)cUser.name=profile.full_name;saveUserData(cUid,cData);}
    } catch(e){ sbHandleError(e, 'doLogin profiles try'); }
    applyDark(cData.darkMode||false);
    try{sessionStorage.removeItem('hh_last_page');}catch(e){}
    ['landing','login','signup','onboard','forgot','reset'].forEach(function(n){
      const el=document.getElementById('screen-'+n);
      if(el)el.style.display='none';
    });
    await launchApp(cUser);
  } catch(e) {
    const msg = e.message || '';
    const isNet = msg.toLowerCase().includes('failed to fetch') || msg.toLowerCase().includes('networkerror') || msg.toLowerCase().includes('authretryable') || msg.toLowerCase().includes('fetch error');
    showErr('login-err', msg==='Invalid login credentials'
      ? 'Invalid email or password — try signing up first'
      : isNet
      ? 'Connection error — check your internet and try again'
      : msg);
  } finally {
    if(loginBtn){loginBtn.textContent='Sign In →';loginBtn.disabled=false;loginBtn.style.opacity='1';}
  }
}

async function loginDemo() {
  const loginBtn = document.querySelector('#screen-login .btn-dark');
  if(loginBtn){loginBtn.textContent='Loading demo…';loginBtn.disabled=true;}
  try {
    // Use a fixed demo UID that never conflicts with real users
    const DEMO_UID = 'demo_cso_preview';
    cUid = DEMO_UID;
    cUser = {email:'', name:'New User'};
    // Always load fresh demo data
    const demo = buildDemoData();
    saveLocalData(DEMO_UID, demo);
    getUserData(DEMO_UID);
    applyDark(false);
    ['landing','login','signup','onboard','forgot','reset'].forEach(n=>{const el=document.getElementById('screen-'+n);if(el)el.style.display='none';});
    await launchApp(cUser);
  } catch(e) {
    showErr('login-err', 'Demo failed. Please try signing up instead.');
  } finally {
    if(loginBtn){loginBtn.textContent='🚀 Launch Demo';loginBtn.disabled=false;}
  }
}

async function doSignup() {
  const name=document.getElementById('signup-name').value.trim();
  const email=document.getElementById('signup-email').value.trim().toLowerCase();
  const pw=document.getElementById('signup-pw').value;
  if(!name||!email||!pw){showErr('signup-err','Please fill in all fields');return;}
  if(pw.length<8){showErr('signup-err','Password must be 8+ characters');return;}
  const termsEl = document.getElementById('signup-terms');
  if(termsEl && !termsEl.checked){showErr('signup-err','Please agree to the Terms of Service to continue');return;}
  const btn=document.querySelector('#screen-signup .btn-pri');
  if(btn){btn.textContent='Creating account…';btn.disabled=true;btn.style.opacity='.7';}
  try {
    const {data,error} = await sb.auth.signUp({
      email, password:pw,
      options:{data:{full_name:name}}
    }).catch((e)=>({data:null,error:e}));
    if(error) {
      sbHandleError(error, 'signUp');
      throw error;
    }
    if(data.user) {
      cUid = data.user.id;
      cUser = {email, name};
      getUserData(cUid);
      applyDark(false);
      // Insert profile into Supabase so admin panel can see them
      const signupProf = await sb.from('profiles').upsert({
        id: cUid,
        email,
        full_name: name,
        plan: 'free',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }, {onConflict:'id'}).catch((e) => ({ error: e }));
      if (signupProf.error) sbHandleError(signupProf.error, 'signup profiles upsert');
      // Auto sign in immediately after signup
      const {data:signInData, error:signInError} = await sb.auth.signInWithPassword({email, password:pw}).catch((e) => ({ data: null, error: e }));
      if (signInError) sbHandleError(signInError, 'signup signIn');
      if(!signInError && signInData.user) {
        cUid = signInData.user.id;
        cUser = {email, name};
        getUserData(cUid);
      }
      ['landing','login','signup','onboard'].forEach(n=>{const el=document.getElementById('screen-'+n);if(el)el.style.display='none';});
      // Notify admin of new signup
      fetch('https://vdnyqwpznsysrvyvbqga.supabase.co/functions/v1/send-notification', {
        method:'POST',
        headers:{'Content-Type':'application/json','Authorization':'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZkbnlxd3B6bnN5c3J2eXZicWdhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ2NjM4NjUsImV4cCI6MjA5MDIzOTg2NX0.VxwNE_lMR2JV_70SVr9rio_UgfbKGnYFyeitkTuWYkM'},
        body:JSON.stringify({type:'new_signup',hostEmail:ADMIN_EMAIL,data:{name,email}})
      }).catch(()=>{});
      // Send welcome email to new user
      fetch('https://vdnyqwpznsysrvyvbqga.supabase.co/functions/v1/send-notification', {
        method:'POST',
        headers:{'Content-Type':'application/json','Authorization':'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZkbnlxd3B6bnN5c3J2eXZicWdhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ2NjM4NjUsImV4cCI6MjA5MDIzOTg2NX0.VxwNE_lMR2JV_70SVr9rio_UgfbKGnYFyeitkTuWYkM'},
        body:JSON.stringify({type:'welcome',hostEmail:email,data:{name,email}})
      }).catch(()=>{});
      if(!cData.onboarded) { startOnboard(cUser); } else { await launchApp(cUser); }
    } else {
      showErr('signup-err','Something went wrong. Please try again.');
    }
  } catch(e) {
    const msg = e.message || '';
    const isNet = msg.toLowerCase().includes('failed to fetch') || msg.toLowerCase().includes('networkerror') || msg.toLowerCase().includes('authretryable');
    showErr('signup-err',
      isNet ? 'Connection error — check your internet and try again' :
      (msg.includes('already registered')||msg.includes('already been registered')) ? 'Email already registered — try logging in instead.' :
      msg);
  } finally {
    if(btn){btn.textContent='Create Account →';btn.disabled=false;btn.style.opacity='1';}
  }
}

async function doLogout() {
  await sb.auth.signOut().catch((e) => console.warn('signOut:', e));
  cUid=null; cData=null; cUser=null; isAdmin = false;
  try{sessionStorage.removeItem('hh_last_page');}catch(e){}
  try{localStorage.removeItem('hh_last_page');}catch(e){}
  showLandingPage();
}
async function logout() { await doLogout(); }

function showErr(id,msg){const el=document.getElementById(id);el.textContent=msg;el.style.display='block';setTimeout(()=>el.style.display='none',5000);}

// ════════════════════════════════════════════
//  LANDING PAGE FUNCTIONS
// ════════════════════════════════════════════
function showLandingPage() {
  const lp = document.getElementById('screen-landing');
  const dw = document.getElementById('app');
  const onboarding = document.getElementById('onboarding-wizard-modal');
  if (dw) { dw.style.display = 'none'; dw.classList.remove('visible'); }
  if (onboarding) onboarding.style.display = 'none';
  // Fully hide ALL auth screens — clear pointerEvents and visibility
  // so they don't block clicks on the landing page underneath
  ['login','signup','onboard','forgot','reset'].forEach(s => {
    const el = document.getElementById('screen-'+s);
    if (el) {
      el.style.display = 'none';
      el.style.visibility = 'hidden';
      el.style.pointerEvents = 'none';
      el.style.zIndex = '-1';
    }
  });
  if (lp) {
    lp.style.display = 'block';
    lp.style.visibility = 'visible';
    lp.style.pointerEvents = 'auto';
    lp.style.zIndex = '1';
    lp.style.position = 'relative';
    lp.style.top = '';
  }
  document.body.style.display = 'block';
  window.scrollTo(0,0);
}

function showDashboard() {
  const lp = document.getElementById('screen-landing');
  const dw = document.getElementById('app');
  const onboarding = document.getElementById('onboarding-wizard-modal');
  // FIX: pull landing page fully out of document flow so it contributes zero height
  if (lp) {
    lp.style.display = 'none';
    lp.style.visibility = 'hidden';
    lp.style.pointerEvents = 'none';
    lp.style.position = 'absolute';
    lp.style.top = '-9999px';
  }
  // FIX: use classList.add('visible') — the CSS handles display:flex via .app.visible
  // Do NOT set dw.style.display manually — it conflicts with the CSS class
  if (dw) {
    dw.style.display = '';  // clear any inline override first
    dw.classList.add('visible');
  }
  if (onboarding) onboarding.style.display = 'none';
  ['login','signup','onboard','forgot','reset'].forEach(s => {
    const el = document.getElementById('screen-'+s);
    if (el) { el.style.display='none'; el.style.visibility='hidden'; el.style.pointerEvents='none'; el.style.zIndex='-1'; }
  });
  document.body.style.display = 'block';
}

// ════════════════════════════════════════════
//  BOOT — check existing session
// ════════════════════════════════════════════
async function bootApp() {
  // Show loading screen instead of login while checking session
  ['landing','login','signup','onboard','forgot','reset'].forEach(s=>{
    const el=document.getElementById('screen-'+s);
    if(el) el.style.display='none';
  });
  // Show a minimal loading indicator
  document.body.insertAdjacentHTML('beforeend',`
    <div id="boot-loader" style="position:fixed;inset:0;background:var(--bg);display:flex;flex-direction:column;align-items:center;justify-content:center;z-index:9999;gap:16px">
      <div style="width:44px;height:44px;background:var(--terra);border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:22px">🏡</div>
      <div style="font-family:Fraunces,serif;font-size:20px;color:var(--txt);letter-spacing:-.3px">CSO Property Services</div>
      <div class="spinner"></div>
    </div>`);

  // Check for password reset token in URL hash
  const hash = window.location.hash;
  if(hash.includes('type=recovery')) {
    const {data: recSess, error: recErr} = await sb.auth.getSession().catch((e) => ({ data: null, error: e }));
    if (recErr) sbHandleError(recErr, 'boot recovery getSession');
    const session = recSess?.session;
    if(session) {
      document.getElementById('boot-loader')?.remove();
      showScreen('reset');
      return;
    }
  }

  // Wait a bit longer for Supabase to fully initialize session
  await new Promise(resolve => setTimeout(resolve, 100));
  
  const {data: bootSess, error: bootSessErr} = await sb.auth.getSession().catch((e) => ({ data: null, error: e }));
  if (bootSessErr) sbHandleError(bootSessErr, 'boot getSession');
  const session = bootSess?.session;
  document.getElementById('boot-loader')?.remove();

  if(session?.user) {
    cUid = session.user.id;
    cUser = {email:session.user.email, name:session.user.user_metadata?.full_name||session.user.email.split('@')[0]};
    const cloudData = await loadFromSupabase(cUid);
    if(cloudData) {
      const localData = getLocalData(cUid);
      const merged = {...cloudData};
      if(localData.apiKey && !cloudData.apiKey) merged.apiKey = localData.apiKey;
      saveLocalData(cUid, merged);
    }
    getUserData(cUid);
    try {
      let _bpRes; try { _bpRes = await sb.from('profiles').select('plan,full_name').eq('id',cUid).single(); } catch(e) { _bpRes = {data:null,error:e}; } const {data:profile, error:bootProfErr} = _bpRes||{data:null,error:null};
      if (bootProfErr) sbHandleError(bootProfErr, 'boot profiles');
      if(profile) {
        cData.plan = profile.plan || cData.plan;
        if(profile.full_name) cUser.name = profile.full_name;
        saveLocalData(cUid, cData);
      }
    } catch(e){ sbHandleError(e, 'boot profiles try'); }
    applyDark(cData.darkMode||false);
    ['landing','login','signup','onboard','forgot','reset'].forEach(n=>{const el=document.getElementById('screen-'+n);if(el)el.style.display='none';});
    
    // Check if user is onboarded, if not show onboarding wizard
    if(!cData.onboarded) {
      startOnboard(cUser);
    } else {
      await launchApp(cUser);
    }
    return;
  }
  showLandingPage();
}

// ════════════════════════════════════════════
//  LAUNCH APP
// ════════════════════════════════════════════
/** Admin flag comes only from Edge Function response — never trust the client alone. */
async function checkAdminStatus(userEmail) {
  isAdmin = false;
  if (!userEmail) return false;
  // Fast local check first — if email matches hardcoded admin, grant immediately
  if (ADMIN_EMAIL && userEmail.toLowerCase().trim() === ADMIN_EMAIL.toLowerCase().trim()) {
    isAdmin = true;
    return true;
  }
  // Also check profiles table for is_admin role
  try {
    const { data: profile } = await sb.from('profiles')
      .select('plan, role')
      .eq('id', cUid)
      .single()
      .catch(() => ({ data: null }));
    if (profile && (profile.plan === 'is_admin' || profile.role === 'admin' || profile.role === 'is_admin')) {
      isAdmin = true;
      // Fix the plan value to business while we're at it
      try { await sb.from('profiles').update({ plan: 'business', role: 'admin' }).eq('id', cUid); } catch(e) {}
      return true;
    }
  } catch(e) {}
  // Fallback: try Edge Function
  try {
    const { data, error } = await sb.functions
      .invoke('check-admin-status', { body: { email: userEmail } })
      .catch((e) => ({ data: null, error: e }));
    if (!error && data) {
      isAdmin = !!(data.isAdmin);
      return isAdmin;
    }
  } catch (e) {
    console.warn('Admin edge function check failed:', e);
  }
  isAdmin = false;
  return false;
}

async function launchApp(user) {
  // Show dashboard and hide landing page
  showDashboard();
  restoreSidebarState();
  
  // Show a brief loading overlay so data has time to be ready
  const app = document.getElementById('app');
  app.classList.add('visible');

  // Show loading indicator in content area
  const content = document.querySelector('.content');
  if(content) {
    content.style.opacity = '0';

    content.style.transition = 'opacity 0.3s';

  }

  document.getElementById('sb-uname').textContent=user.name;
  document.getElementById('sb-uemail').textContent=user.email;
  const init=user.name.split(' ').map(n=>n[0]).join('').toUpperCase().slice(0,2);
  document.getElementById('sb-av').textContent=init;

  await checkAdminStatus(user.email).catch(() => false);
  const adminNavEl = document.getElementById('admin-nav-item');
  if (isAdmin) {
    cData.plan = 'business';
    saveUserData(cUid, cData);
    if (adminNavEl) adminNavEl.style.display = 'flex';
  } else {
    if (adminNavEl) adminNavEl.style.display = 'none';
  }

  // Free trial for new users
  if(!cData.trialStarted && !cData.onboarded && (cData.plan==='free'||cData.plan==='trial') && cData.plan!=='cohost' && cData.plan!=='pro' && cData.plan!=='business') {
    cData.trialStarted = Date.now();
    cData.plan = 'trial';
    saveUserData(cUid, cData);
  }
  checkTrialStatus();

  const plan=cData.plan||'free';

  // Show team nav for business/admin
  const teamNav = document.getElementById('team-nav-item');
  if(teamNav) teamNav.style.display = (plan==='business'||plan==='cohost'||isAdmin) ? 'flex' : 'none';

  // Show cohost-only nav items and settings
  const earningsNav = document.getElementById('earnings-nav-item');
  if(earningsNav) earningsNav.style.display = (plan==='cohost'||plan==='cohost_starter'||isAdmin) ? 'flex' : 'none';
  const vendorNav = document.getElementById('vendor-nav-item');
  if(vendorNav) vendorNav.style.display = (plan==='cohost'||plan==='cohost_starter'||isAdmin) ? 'flex' : 'none';
  const brandingCard = document.getElementById('cohost-branding-card');
  if(brandingCard) brandingCard.style.display = (plan==='cohost'||isAdmin) ? 'block' : 'none'; // cohost pro only

  // Restore software mode toggle
  if(cData.softwareMode) {
    _softwareMode = true;
    const tog = document.getElementById('software-mode-toggle');
    if(tog) tog.className='toggle on';
    const desc = document.getElementById('sw-mode-desc');
    if(desc) desc.innerHTML='<strong>ON</strong> — Displaying as Property Manager Pro (white-label)';
    applySoftwareMode(true);
  }

  // Show floating AI Tour FAB
  const fab = document.getElementById('ai-tour-fab');
  if(fab) fab.style.display='flex';

  // Mobile bottom nav — visibility controlled by CSS media query only
  // (removing JS override that was forcing it visible on desktop)

  // Init content hub data store
  if(!cData.contentHub) cData.contentHub=[];

  // Load saved branding into fields
  if((plan==='cohost'||isAdmin) && cData.branding) { // cohost_pro only
    const b = cData.branding;
    if(b.name) document.getElementById('brand-name').value = b.name;
    if(b.logo) document.getElementById('brand-logo').value = b.logo;
    if(b.color) document.getElementById('brand-color').value = b.color;
    if(b.tagline) document.getElementById('brand-tagline').value = b.tagline;
    if(b.email) document.getElementById('brand-email').value = b.email;
    if(b.website) document.getElementById('brand-website').value = b.website;
  }

  document.getElementById('sb-plan').textContent=isAdmin?'👑 Admin':plan==='free'?'⭐ Free':plan==='pro'?'🚀 Pro':plan==='trial'?'🎯 Trial':plan==='cohost'?'🏆 Co-Host Pro':plan==='cohost_starter'?'🤝 Co-Host':'💼 Business';
  document.getElementById('set-name').value=user.name;
  document.getElementById('set-email').value=user.email;
  document.getElementById('set-plan').textContent=isAdmin?'Admin — Unlimited':plan==='free'?'Free — 1 property':plan==='pro'?'Pro — 10 properties':plan==='trial'?'Pro Trial — 10 properties':plan==='cohost'?'Co-Host Pro — Unlimited':plan==='cohost_starter'?'Co-Host Starter — 10 properties':'Business — Unlimited';
  if(cData.apiKey)document.getElementById('set-api-key').value=cData.apiKey;
  document.getElementById('wb-host').value=user.name;
  document.getElementById('wb-email').value=user.email;

  // Render all data then fade in — opacity always restores even on error
  safeRender(renderAll, 'renderAll-initial');
  requestAnimationFrame(()=>{
    requestAnimationFrame(()=>{
      if(content){ content.style.opacity='1'; }
      safeRender(renderAll, 'renderAll-frame');
      csoInstallScalingFeatures(); // Feature 1-4 — wire all scaling features
      // Restore last page on REFRESH only — not on fresh login
      // Fresh login clears hh_last_page so user always lands on dashboard
      try {
        let lastPage = sessionStorage.getItem('hh_last_page');
        if(!lastPage) lastPage = localStorage.getItem('hh_last_page');
        if(lastPage && lastPage !== 'dashboard') {
          const pageEl = document.getElementById('page-'+lastPage);
          const navEl = document.querySelector(`[onclick*="nav('${lastPage}'"]`);
          if(pageEl) nav(lastPage, navEl);
        }
        // Always clear after consuming — ensures next login goes to dashboard
        try{sessionStorage.removeItem('hh_last_page');}catch(e){}
        try{localStorage.removeItem('hh_last_page');}catch(e){}
      } catch(e){}
      setTimeout(()=>{ updateWb(); renderPortal(); }, 300);
      // Auto sync iCal feeds in background
      setTimeout(()=>autoSyncICals(), 2000);
      // Checkout monitor + cleaner card bridge
      setTimeout(()=>checkoutMonitor(), 3000);
      setTimeout(()=>checkJobCardUpdates(), 1000);
      // Heartbeat monitor for late cleaner check-ins
      setTimeout(()=>startHeartbeatMonitor(), 4000);
    });
  });
  hhWireSaveButtons();
  hhBindOnlineOffline();
  // Wire booking draft auto-save after modal fields are in DOM
  setTimeout(wireBookingDraftSave, 500);
}

// ════════════════════════════════════════════
//  ONBOARDING
// ════════════════════════════════════════════
// ════════════════════════════════════════════
