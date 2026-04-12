// ════════════════════════════════════════════
//  SUPABASE CONFIG
// ════════════════════════════════════════════
const __cfg = (typeof window !== 'undefined' && window.HH_CONFIG) || {};
const SUPABASE_URL = __cfg.SUPABASE_URL || 'https://vdnyqwpznsysrvyvbqga.supabase.co';
const SUPABASE_ANON_KEY = __cfg.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZkbnlxd3B6bnN5c3J2eXZicWdhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ2NjM4NjUsImV4cCI6MjA5MDIzOTg2NX0.VxwNE_lMR2JV_70SVr9rio_UgfbKGnYFyeitkTuWYkM';
const _hhStorage = {
  getItem: (key) => { try { return localStorage.getItem(key); } catch(e) { try { return sessionStorage.getItem(key); } catch(e2) { return null; } } },
  setItem: (key, val) => { try { localStorage.setItem(key, val); } catch(e) { try { sessionStorage.setItem(key, val); } catch(e2) {} } },
  removeItem: (key) => { try { localStorage.removeItem(key); } catch(e) { try { sessionStorage.removeItem(key); } catch(e2) {} } }
};
const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { storage: _hhStorage, persistSession: true, detectSessionInUrl: true }
});

function hhSessionExpiredError(err) {
  if (!err) return false;
  const msg = String(err.message || err.error_description || err.msg || err).toLowerCase();
  const code = String(err.code || err.status || '');
  return code === '401' || /jwt|session( has)? expired|invalid.*token|not authenticated|unauthorized|refresh.*fail/i.test(msg);
}

function redirectToLoginRoute() {
  isAdmin = false;
  try { void sb.auth.signOut().catch(() => {}); } catch (e) {}
  cUid = null;
  cData = null;
  cUser = null;
  try {
    const app = document.getElementById('app');
    if (app) app.classList.remove('visible');
  } catch (e) {}
  showScreen('login');
  try {
    if (window.location.protocol !== 'file:') {
      history.replaceState(null, '', '/login');
    }
  } catch (e) {}
  toast('Session expired — please sign in again');
}

function hhWireSaveButtons() {
  document.querySelectorAll('button[onclick]').forEach((btn) => {
    const oc = btn.getAttribute('onclick') || '';
    if (
      /saveUserData|addBooking|addProperty|addOwner|addStaff|inviteTeamMember|saveProperty|saveSettings|syncNow|saveAuto|saveLocalData|submitFeedback|upgradePlan/i.test(
        oc
      )
    ) {
      btn.setAttribute('data-hh-requires-online', '1');
      btn.disabled = !navigator.onLine;
      btn.style.opacity = navigator.onLine ? '' : '0.55';
    }
  });
}

let _hhWasOffline = !navigator.onLine;
function hhBindOnlineOffline() {
  function upd() {
    const on = navigator.onLine;
    document.body.classList.toggle('hh-offline', !on);
    document.querySelectorAll('button[data-hh-requires-online="1"]').forEach((b) => {
      b.disabled = !on;
      b.style.opacity = on ? '' : '0.55';
    });
    if (!on && !_hhWasOffline) toast('You are offline — saving is disabled');
    if (on && _hhWasOffline) toast('Back online');
    _hhWasOffline = !on;
  }
  window.addEventListener('online', upd);
  window.addEventListener('offline', upd);
  upd();
}

function sbHandleError(err, context) {
  console.warn(context || 'Supabase', err);
  if (hhSessionExpiredError(err)) redirectToLoginRoute();
}

// Input sanitization to prevent XSS / script injection
function sanitizeInput(input) {
  if (input == null) return '';
  return String(input)
    .replace(/<[^>]*>/g, '')
    .replace(/[<>'"`;\\]/g, '')
    .replace(/javascript:/gi, '')
    .replace(/data:\s*text\/html/gi, '')
    .replace(/on\w+\s*=/gi, '')
    .trim()
    .substring(0, 1000);
}

const HH_EMAIL_REGEX = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
function isValidEmail(s) {
  if (!s || typeof s !== 'string') return false;
  const t = s.trim();
  return t.length <= 254 && HH_EMAIL_REGEX.test(t);
}

function sanitizeHTML(html) {
  const div = document.createElement('div');
  div.textContent = html;
  return div.innerHTML;
}

// Enhanced error handling wrapper
async function safeAsync(fn, errorMessage = 'Operation failed') {
  try {
    return await fn();
  } catch (error) {
    console.error(errorMessage, error);
    toast(errorMessage + ': ' + error.message);
    throw error;
  }
}

// ══════════════════════════════════════════
//  ADMIN CONFIG
// ════════════════════════════════════════════

// Polyfill: restore .catch() support on Supabase query builders
// (removed in supabase-js v2.x — wraps the thenable to add .catch)
(function patchSupabaseCatch() {
  const origFrom = sb.from.bind(sb);
  sb.from = function(...args) {
    const builder = origFrom(...args);
    const origThen = builder.then?.bind(builder);
    if (origThen && !builder._catchPatched) {
      builder.catch = function(fn) {
        return this.then(undefined, fn);
      };
      builder._catchPatched = true;
      // Also patch chained methods to carry .catch
      const methods = ['select','insert','upsert','update','delete','eq','neq','gt','lt','gte','lte','like','ilike','is','in','order','limit','single','maybeSingle','range','filter','match','not','or','and','textSearch','overlaps','containedBy','contains','returns'];
      methods.forEach(m => {
        if (typeof builder[m] === 'function') {
          const orig = builder[m].bind(builder);
          builder[m] = function(...a) {
            const result = orig(...a);
            if (result && !result._catchPatched) {
              result.catch = function(fn) { return this.then(undefined, fn); };
              result._catchPatched = true;
            }
            return result;
          };
        }
      });
    }
    return builder;
  };
})();

const ADMIN_EMAIL = __cfg.ADMIN_EMAIL || 'csopropertyservice@gmail.com';

// ════════════════════════════════════════════
//  STATE
// ════════════════════════════════════════════
let cUid=null, cData=null, cUser=null, activeConvId=null, isAdmin=false;
let wbTheme={primary:'#C4693A',bg:'#FAF7F2'}, bookFilter='all', obStep=1;

// Local cache for fast UI — syncs to Supabase (per-user payload obfuscated at rest)
const LOCAL_KEY = 'hh_local_v1';
function hhExpandLocalKey(seed, len) {
  const enc = new TextEncoder();
  const seedBytes = enc.encode(seed);
  const out = new Uint8Array(len);
  let j = 0,
    acc = 2166136261;
  for (let i = 0; i < len; i++) {
    acc = Math.imul(acc ^ seedBytes[j % seedBytes.length], 16777619);
    out[i] = (acc ^ (i * 131)) & 255;
    j++;
  }
  return out;
}
function hhObfuscateUserBlob(uid, obj) {
  const json = JSON.stringify(obj);
  const bytes = new TextEncoder().encode(json);
  const key = hhExpandLocalKey('hh_ls_v1|' + uid + '|' + (SUPABASE_ANON_KEY || ''), bytes.length);
  const x = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) x[i] = bytes[i] ^ key[i];
  let bin = '';
  for (let i = 0; i < x.length; i++) bin += String.fromCharCode(x[i]);
  return btoa(bin);
}
function hhDeobfuscateUserBlob(uid, b64) {
  const bin = atob(b64);
  const x = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) x[i] = bin.charCodeAt(i);
  const key = hhExpandLocalKey('hh_ls_v1|' + uid + '|' + (SUPABASE_ANON_KEY || ''), x.length);
  const pt = new Uint8Array(x.length);
  for (let i = 0; i < x.length; i++) pt[i] = x[i] ^ key[i];
  return JSON.parse(new TextDecoder().decode(pt));
}
const getLocal = () => {
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (parsed && parsed.__hh_v2 === true && parsed.blob && typeof parsed.blob === 'object') {
      const out = {};
      for (const uid of Object.keys(parsed.blob)) {
        const cell = parsed.blob[uid];
        if (typeof cell === 'string') {
          try {
            out[uid] = hhDeobfuscateUserBlob(uid, cell);
          } catch (e) {
            console.warn('[CSO Property Services] Could not decode local cache for', uid);
          }
        }
      }
      return out;
    }
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
};
const setLocal = (d) => {
  if (!d || typeof d !== 'object') return;
  const blob = {};
  for (const uid of Object.keys(d)) {
    const v = d[uid];
    if (!v || typeof v !== 'object') continue;
    try {
      blob[uid] = hhObfuscateUserBlob(uid, v);
    } catch (e) {
      console.warn('[CSO Property Services] Could not encode local cache for', uid);
    }
  }
  localStorage.setItem(LOCAL_KEY, JSON.stringify({ __hh_v2: true, blob }));
};
const getLocalData = uid => { const l=getLocal(); const d=l[uid]||{properties:[],bookings:[],messages:[],tasks:[],reviews:[],icals:[],staff:[],notes:[],expenses:[],blacklist:[],seasons:[],cleaners:[],jobs:[],workorders:[],inventory:[],autoReplies:[],concierge:[],upsells:[],claims:[],ciPolicies:[],ciRequests:[],rentalItems:[],rentalBookings:[],templates:[],loyaltyMembers:[],optimizerSettings:{},plan:'free',apiKey:'',darkMode:false,onboarded:false,reviewAuto:{enabled:true}}; if(!d.staff)d.staff=[]; if(!d.reviewAuto)d.reviewAuto={enabled:true}; if(!d.notes)d.notes=[]; if(!d.expenses)d.expenses=[]; if(!d.blacklist)d.blacklist=[]; if(!d.seasons)d.seasons=[]; if(!d.cleaners)d.cleaners=[]; if(!d.jobs)d.jobs=[]; if(!d.workorders)d.workorders=[]; if(!d.inventory)d.inventory=[]; if(!d.autoReplies)d.autoReplies=[]; if(!d.concierge)d.concierge=[]; if(!d.upsells)d.upsells=[]; if(!d.claims)d.claims=[]; if(!d.ciPolicies)d.ciPolicies=[]; if(!d.ciRequests)d.ciRequests=[]; if(!d.rentalItems)d.rentalItems=[]; if(!d.rentalBookings)d.rentalBookings=[]; if(!d.templates)d.templates=[]; if(!d.loyaltyMembers)d.loyaltyMembers=[]; if(!d.optimizerSettings)d.optimizerSettings={}; if(!d.guestCRM)d.guestCRM=[]; if(!d.payouts)d.payouts=[]; if(!d.vaultPhotos)d.vaultPhotos=[]; if(!d.aiHours)d.aiHours={enabled:false,start:'22:00',end:'08:00',message:'Hi! I received your message and will respond during office hours (8am-10pm). 🏡',escalate:'emergency,flood,fire,locked out,broken,urgent',autoCount:0,escalateCount:0}; if(!d.sentReports)d.sentReports=[]; if(!d.owners)d.owners=[]; if(!d.affiliates)d.affiliates=[]; if(!d.affiliateClicks)d.affiliateClicks={}; if(!d.invChecklist)d.invChecklist=['Coffee pods (6+)','Toilet paper (4+ rolls)','Paper towels (2+ rolls)','Hand soap','Dish soap','Shampoo & conditioner','Body wash','Bath towels (2 per guest)','Kitchen sponge','Trash bags']; if(!d.readSmartNids)d.readSmartNids=[]; if(!d.contentHub)d.contentHub=[]; if(d.softwareMode===undefined)d.softwareMode=false; if(!d.autoLog)d.autoLog=[]; if(!d.damageClaims)d.damageClaims=[]; if(!d.platformEarnings)d.platformEarnings=[]; if(!d.automations)d.automations={}; return d; };
const saveLocalData = (uid,d) => { const l=getLocal(); l[uid]=d; setLocal(l); };

/** Money: 2 decimal places, non-negative for guest-facing prices */
const moneyRound = n => Math.round((Number(n) || 0) * 100) / 100;
const moneyNonNeg = n => Math.max(0, moneyRound(n));

function deepMergeUserData(base, patch) {
  if (patch == null) return base && typeof base === 'object' ? base : {};
  if (typeof patch !== 'object' || Array.isArray(patch)) return patch;
  const b = base && typeof base === 'object' && !Array.isArray(base) ? base : {};
  const out = { ...b };
  for (const k of Object.keys(patch)) {
    const pv = patch[k];
    if (pv != null && typeof pv === 'object' && !Array.isArray(pv) && typeof out[k] === 'object' && out[k] != null && !Array.isArray(out[k])) {
      out[k] = deepMergeUserData(out[k], pv);
    } else {
      out[k] = pv;
    }
  }
  return out;
}

// Save to both local and Supabase
const getUserData = uid => { cData = getLocalData(uid); return cData; };
const saveUserData = (uid,d) => {
  if (!uid || d == null) return;
  const base = (cUid === uid && cData) ? cData : getLocalData(uid);
  cData = deepMergeUserData(base, d);
  saveLocalData(uid, cData); // always save locally first, even if offline
  if (navigator.onLine) syncToSupabase(uid, cData); // best-effort cloud sync
};
const loadUserData = async (uid) => {
  try {
    const {data, error} = await sb.from('user_data')
      .select('data')
      .eq('user_id', uid)
      .eq('data_type', 'main')
      .single();
    if (error) {
      sbHandleError(error, 'loadUserData');
      return null;
    }
    if (!data) return null;
    return data.data;
  } catch(e) {
    sbHandleError(e, 'loadUserData');
    return null;
  }
};


async function syncToSupabase(uid, d) {
  if (!navigator.onLine) return;
  try {
    // Save the complete data object so nothing is ever lost on cross-device load
    const dataToSync = {
      properties:        d.properties||[],
      bookings:          d.bookings||[],
      messages:          d.messages||[],
      tasks:             d.tasks||[],
      reviews:           d.reviews||[],
      icals:             d.icals||[],
      staff:             d.staff||[],
      notes:             d.notes||[],
      expenses:          d.expenses||[],
      blacklist:         d.blacklist||[],
      seasons:           d.seasons||[],
      cleaners:          d.cleaners||[],
      jobs:              d.jobs||[],
      workorders:        d.workorders||[],
      inventory:         d.inventory||[],
      autoReplies:       d.autoReplies||[],
      concierge:         d.concierge||[],
      upsells:           d.upsells||[],
      claims:            d.claims||[],
      ciPolicies:        d.ciPolicies||[],
      ciRequests:        d.ciRequests||[],
      rentalItems:       d.rentalItems||[],
      rentalBookings:    d.rentalBookings||[],
      templates:         d.templates||[],
      loyaltyMembers:    d.loyaltyMembers||[],
      owners:            d.owners||[],
      payouts:           d.payouts||[],
      vaultPhotos:       d.vaultPhotos||[],
      sentReports:       d.sentReports||[],
      affiliates:        d.affiliates||[],
      affiliateClicks:   d.affiliateClicks||{},
      invChecklist:      d.invChecklist||[],
      guestCRM:          d.guestCRM||[],
      optimizerSettings: d.optimizerSettings||{},
      aiHours:           d.aiHours||{enabled:false},
      plan:              d.plan||'free',
      apiKey:            d.apiKey||'',
      darkMode:          d.darkMode||false,
      onboarded:         d.onboarded||false,
      reviewAuto:        d.reviewAuto||{enabled:true},
      gsDismissed:       d.gsDismissed||false,
      readSmartNids:     d.readSmartNids||[],
      websiteBuilt:      d.websiteBuilt||false,
      trialStarted:      d.trialStarted||null,
      trialUsed:         d.trialUsed||false,
      contentHub:        d.contentHub||[],
      softwareMode:      d.softwareMode||false
    };
    let up1; try { up1 = await sb.from('user_data').upsert({
      user_id: uid,
      data_type: 'main',
      data: dataToSync,
      updated_at: new Date().toISOString()
    }, {onConflict:'user_id,data_type'}); } catch(e) { up1 = { error: e }; }
    if (up1.error) {
      sbHandleError(up1.error, 'sync user_data');
      return;
    }
    let up2; try { up2 = await sb.from('profiles').upsert({id:uid, plan:d.plan, updated_at:new Date().toISOString()}, {onConflict:'id'}); } catch(e) { up2 = { error: e }; }
    if (up2.error) {
      sbHandleError(up2.error, 'sync profiles');
      return;
    }
  } catch(e) {
    sbHandleError(e, 'syncToSupabase');
  }
}

async function loadFromSupabase(uid) {
  try {
    const {data, error} = await sb.from('user_data').select('data').eq('user_id', uid).eq('data_type','main').maybeSingle();
    if (error) {
      sbHandleError(error, 'loadFromSupabase');
      return null;
    }
    return data?.data || null;
  } catch(e) {
    sbHandleError(e, 'loadFromSupabase');
    return null;
  }
}

async function syncPlanToSupabase(uid, plan) {
  try {
    await sb.from('profiles').upsert({id:uid, plan, updated_at: new Date().toISOString()}, {onConflict:'id'});
  } catch(e) {
    sbHandleError(e, 'syncPlanToSupabase');
  }
}

// ════════════════════════════════════════════
//  DARK MODE
// ════════════════════════════════════════════
function applyDark(on) {
  document.documentElement.setAttribute('data-theme', on?'dark':'light');
  try { localStorage.setItem('hh_ui_theme', on?'dark':'light'); } catch (e) {}
  const btn=document.getElementById('dark-toggle'); if(btn)btn.textContent=on?'☀️':'🌙';
  const toggle=document.getElementById('dark-setting-toggle');
  if(toggle){toggle.className='toggle '+(on?'on':'off');}
}
function toggleDark() {
  const isDark=document.documentElement.getAttribute('data-theme')==='dark';
  applyDark(!isDark);
  if(cData){cData.darkMode=!isDark;saveUserData(cUid,cData);}
}

// ════════════════════════════════════════════
//  SCREENS
// ════════════════════════════════════════════
function showScreen(name) {
  const owm = document.getElementById('onboarding-wizard-modal');
  if (owm) owm.style.display = 'none';
  ['landing','login','signup','onboard','forgot','reset'].forEach(s=>{
    const el=document.getElementById('screen-'+s);
    if(!el) return;
    if(s===name) {
      el.style.display = s==='landing' ? 'block' : 'flex';
      el.style.visibility = 'visible';
      el.style.pointerEvents = 'auto';
      el.style.position = s==='landing' ? 'relative' : 'fixed';
      if(s !== 'landing') {
        el.style.inset = '0';
        el.style.zIndex = '500';
        el.style.background = 'var(--auth-bg, #1a1209)';
      }
    } else {
      el.style.display = 'none';
      el.style.visibility = 'hidden';
      el.style.pointerEvents = 'none';
    }
  });
  // Pre-fill remembered email when showing login screen
  if(name === 'login') {
    try {
      const remembered = localStorage.getItem('hh_remembered_email');
      const emailEl = document.getElementById('login-email');
      const rememberEl = document.getElementById('login-remember');
      if(remembered && emailEl) {
        emailEl.value = remembered;
        if(rememberEl) rememberEl.checked = true;
        // Focus password field since email is pre-filled
        setTimeout(() => document.getElementById('login-pw')?.focus(), 100);
      }
    } catch(e) {}
  }
  const app = document.getElementById('app');
  if(app) app.classList.remove('visible');
  window.scrollTo(0,0);
}

function showForgotPassword() {
  showScreen('forgot');
  setTimeout(()=>{
    const email = document.getElementById('login-email')?.value;
    if(email) document.getElementById('forgot-email').value = email;
  }, 50);
}

async function doForgotPassword() {
  const email = document.getElementById('forgot-email').value.trim().toLowerCase();
  if(!email){showErr('forgot-err','Please enter your email');return;}
  const btn = document.querySelector('#screen-forgot .btn-pri');
  if(btn){btn.textContent='Sending…';btn.disabled=true;btn.style.opacity='.7';}
  try {
    const resPw = await sb.auth.resetPasswordForEmail(email, {
      redirectTo: 'https://csopropertyservices.com',
    }).catch((e) => ({ error: e }));
    if (resPw && resPw.error) {
      sbHandleError(resPw.error, 'resetPasswordForEmail');
      throw resPw.error;
    }
    const errEl = document.getElementById('forgot-err');
    const sucEl = document.getElementById('forgot-success');
    if(errEl) errEl.style.display='none';
    if(sucEl) { sucEl.textContent='✓ Reset link sent! Check your email inbox.'; sucEl.style.display='block'; }
  } catch(e) {
    showErr('forgot-err', e.message||'Something went wrong. Try again.');
  } finally {
    if(btn){btn.textContent='Send Reset Link →';btn.disabled=false;btn.style.opacity='1';}
  }
}

async function doResetPassword() {
  const pw = document.getElementById('reset-pw').value;
  const pw2 = document.getElementById('reset-pw2').value;
  if(!pw || pw.length < 8){showErr('reset-err','Password must be 8+ characters');return;}
  if(pw !== pw2){showErr('reset-err','Passwords do not match');return;}
  const btn = document.querySelector('#screen-reset .btn-pri');
  if(btn){btn.textContent='Updating…';btn.disabled=true;btn.style.opacity='.7';}
  try {
    const {error} = await sb.auth.updateUser({password: pw});
    if(error) {
      sbHandleError(error, 'updateUser password');
      throw error;
    }
    // Sign out and back to login with success message
    await sb.auth.signOut().catch((e) => console.warn('signOut after reset:', e));
    showScreen('login');
    setTimeout(()=>{
      showErr('login-err','✓ Password updated! Please sign in with your new password.');
      document.getElementById('login-err').style.background='rgba(107,143,113,.15)';
      document.getElementById('login-err').style.borderColor='var(--sage)';
      document.getElementById('login-err').style.color='var(--sage)';
    }, 100);
  } catch(e) {
    const msg = e.message||'';
    if(msg.includes('expired') || msg.includes('invalid') || msg.includes('Auth session missing') || msg.includes('Token')) {
      showErr('reset-err', 'This reset link has expired. Redirecting you to request a new one…');
      setTimeout(()=>showScreen('forgot'), 2500);
    } else {
      showErr('reset-err', msg || 'Something went wrong. Try again.');
    }
  } finally {
    if(btn){btn.textContent='Update Password →';btn.disabled=false;btn.style.opacity='1';}
  }
}
function scrollToSection(id){
  const el=document.getElementById(id);
  if(el) setTimeout(()=>el.scrollIntoView({behavior:'smooth',block:'start'}),50);
}

