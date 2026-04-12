// ════════════════════════════════════════════
//  ONBOARDING
// ════════════════════════════════════════════
// ════════════════════════════════════════════
//  PLAN-AWARE ONBOARDING
// ════════════════════════════════════════════

function getObSteps(plan) {
  const planLabel = plan==='cohost'?'🏆 Co-Host Pro':plan==='cohost_starter'?'🤝 Co-Host':plan==='business'?'💼 Business':plan==='pro'?'🚀 Pro':'⭐ Free';

  const stepWelcome = {title:`Welcome to CSO Property Services! 🎉`,sub:`You're on the <strong>${planLabel}</strong> plan. Let's get you set up in a few quick steps.`,content:`
    <div style="background:var(--sand);border-radius:12px;padding:20px;text-align:center;margin-bottom:14px">
      <div style="font-size:52px;margin-bottom:10px">🏡</div>
      <div style="font-family:Fraunces,serif;font-size:18px;color:var(--txt);margin-bottom:6px">Your complete STR management hub</div>
      <div style="font-size:13px;color:var(--txt2);line-height:1.6">Built for Airbnb, VRBO, and Booking.com hosts. Manage everything from one dashboard.</div>
    </div>
    <div style="display:flex;flex-direction:column;gap:8px">
      <div style="display:flex;gap:10px;align-items:center;padding:10px;background:var(--sand);border-radius:8px"><span style="font-size:18px">📅</span><div><div style="font-size:12px;font-weight:600;color:var(--txt)">Bookings & iCal Sync</div><div style="font-size:11px;color:var(--txt2)">Import from Airbnb/VRBO or add manually. Calendar always stays in sync.</div></div></div>
      <div style="display:flex;gap:10px;align-items:center;padding:10px;background:var(--sand);border-radius:8px"><span style="font-size:18px">🤖</span><div><div style="font-size:12px;font-weight:600;color:var(--txt)">AI Guest Messaging</div><div style="font-size:11px;color:var(--txt2)">One-click replies drafted by Claude AI — check-in info, rules, local tips.</div></div></div>
      <div style="display:flex;gap:10px;align-items:center;padding:10px;background:var(--sand);border-radius:8px"><span style="font-size:18px">🧹</span><div><div style="font-size:12px;font-weight:600;color:var(--txt)">Cleaning & Staff Management</div><div style="font-size:11px;color:var(--txt2)">Post jobs to cleaners with shareable links. Track completion with photo proof.</div></div></div>
      <div style="display:flex;gap:10px;align-items:center;padding:10px;background:var(--sand);border-radius:8px"><span style="font-size:18px">💸</span><div><div style="font-size:12px;font-weight:600;color:var(--txt)">Revenue, Expenses & P&L</div><div style="font-size:11px;color:var(--txt2)">See true profit after every expense. Export to CSV for tax season.</div></div></div>
      ${plan==='pro'||plan==='business'||plan==='cohost'?`<div style="display:flex;gap:10px;align-items:center;padding:10px;background:rgba(107,143,113,.08);border:1px solid var(--sage);border-radius:8px"><span style="font-size:18px">📈</span><div><div style="font-size:12px;font-weight:600;color:var(--txt)">Market Trends & Pricing Optimizer</div><div style="font-size:11px;color:var(--txt2)">Live demand signals and rate recommendations on your dashboard.</div></div></div>`:''}
      ${plan==='business'||plan==='cohost'?`<div style="display:flex;gap:10px;align-items:center;padding:10px;background:rgba(200,168,75,.08);border:1px solid var(--gold);border-radius:8px"><span style="font-size:18px">🏆</span><div><div style="font-size:12px;font-weight:600;color:var(--txt)">Unlimited Properties + Team Access</div><div style="font-size:11px;color:var(--txt2)">No property limits. Invite team members with manager or viewer roles.</div></div></div>`:''}
      ${plan==='cohost'?`<div style="display:flex;gap:10px;align-items:center;padding:10px;background:rgba(200,168,75,.12);border:1px solid var(--gold);border-radius:8px"><span style="font-size:18px">🔧</span><div><div style="font-size:12px;font-weight:600;color:var(--txt)">Co-Host Suite — Vendor Management, Owner Reports, White-Label</div><div style="font-size:11px;color:var(--txt2)">Everything to run a professional property management business.</div></div></div>`:''}
    </div>`};

  const stepProperty = {title:`Add your first property`,sub:`Tell us about your listing. These details power your guest portals, AI messages, and check-in instructions.`,content:`
    <div class="g2"><div class="fi"><label>Property Name</label><input id="ob-prop-name" placeholder="Sunset Loft"></div><div class="fi"><label>Emoji</label><input id="ob-prop-emoji" value="🏡"></div></div>
    <div class="fi"><label>Location</label><input id="ob-prop-loc" placeholder="Downtown, New York"></div>
    <div class="g2"><div class="fi"><label>Nightly Rate ($)</label><input id="ob-prop-rate" type="number" placeholder="100"></div><div class="fi"><label>Door Code</label><input id="ob-prop-door" placeholder="#4821"></div></div>
    <div class="g2"><div class="fi"><label>WiFi Name</label><input id="ob-prop-wifi" placeholder="MyProperty_WiFi"></div><div class="fi"><label>WiFi Password</label><input id="ob-prop-wifipw" placeholder="password123"></div></div>
    <div style="background:var(--sand);border-radius:8px;padding:10px;font-size:11px;color:var(--txt2);line-height:1.5">💡 You can add more properties anytime. ${plan==='free'?'Free plan includes 1 property.':plan==='pro'||plan==='trial'?'Pro plan includes up to 10 properties.':'Unlimited properties on your plan.'}</div>`};

  const stepBookings = {title:`Connect your calendar & first booking`,sub:`Import your existing bookings so the dashboard is live from day one.`,content:`
    <div style="display:flex;flex-direction:column;gap:10px">
      <div style="background:rgba(107,143,113,.1);border:1px solid var(--sage);border-radius:10px;padding:14px;display:flex;gap:12px;align-items:flex-start">
        <div style="font-size:24px;flex-shrink:0">🔄</div>
        <div><div style="font-size:13px;font-weight:600;color:var(--txt)">iCal Sync (Recommended)</div>
        <div style="font-size:12px;color:var(--txt2);margin-top:2px;line-height:1.5">Go to Airbnb → Calendar → Availability → Export Calendar. Paste the URL into <strong>iCal Sync</strong> in the sidebar. Bookings import instantly and sync on every login.</div></div>
      </div>
      <div style="background:var(--sand);border-radius:10px;padding:14px;display:flex;gap:12px;align-items:flex-start">
        <div style="font-size:24px;flex-shrink:0">📅</div>
        <div><div style="font-size:13px;font-weight:600;color:var(--txt)">Add Manually</div>
        <div style="font-size:12px;color:var(--txt2);margin-top:2px">Click <strong>+ Add Booking</strong> on the Bookings page to enter guest details, dates, and price directly.</div></div>
      </div>
      <div style="background:var(--sand);border-radius:10px;padding:14px;display:flex;gap:12px;align-items:flex-start">
        <div style="font-size:24px;flex-shrink:0">🧹</div>
        <div><div style="font-size:13px;font-weight:600;color:var(--txt)">Auto-Cleaning Tasks</div>
        <div style="font-size:12px;color:var(--txt2);margin-top:2px">Enable <strong>Automations → Auto-Cleaning</strong> to create a cleaning task for every checkout automatically.</div></div>
      </div>
    </div>`};

  const stepMessaging = {title:`Set up AI messaging`,sub:`Your Claude API key unlocks real AI-drafted replies — check-in info, house rules, local tips, everything.`,content:`
    <div style="display:flex;flex-direction:column;gap:10px">
      <div style="background:var(--sand);border-radius:10px;padding:14px">
        <div style="font-size:13px;font-weight:600;color:var(--txt);margin-bottom:8px">How to get your free Claude API key:</div>
        <div style="display:flex;flex-direction:column;gap:6px;font-size:12px;color:var(--txt2)">
          <div>1. Go to <strong>console.anthropic.com</strong> and create a free account</div>
          <div>2. Click <strong>Get API keys</strong> → <strong>Create Key</strong></div>
          <div>3. Copy the key (starts with <code style="background:var(--border);padding:1px 5px;border-radius:3px">sk-ant-</code>)</div>
          <div>4. Paste it in <strong>Settings → AI Messaging</strong></div>
        </div>
      </div>
      <div style="background:rgba(107,143,113,.1);border:1px solid var(--sage);border-radius:10px;padding:12px;font-size:12px;color:var(--txt2)">
        ✅ Free tier includes generous usage. Once set up, go to <strong>Messages</strong>, open a conversation, and click <strong>AI Reply</strong> to get an instant draft.
      </div>
      <div style="background:var(--sand);border-radius:10px;padding:12px">
        <div style="font-size:12px;font-weight:600;color:var(--txt);margin-bottom:6px">Also in Messages:</div>
        <div style="font-size:11px;color:var(--txt2);display:flex;flex-direction:column;gap:4px">
          <div>🤖 <strong>Auto-Reply Rules</strong> — keyword triggers that fire automatically</div>
          <div>📋 <strong>Message Templates</strong> — saved messages you reuse</div>
          <div>⏰ <strong>AI Office Hours</strong> — auto-reply when you're unavailable</div>
        </div>
      </div>
    </div>`};

  const stepCleaning = {title:`Set up your cleaning team`,sub:`Add your cleaners, post jobs with shareable links, and track every turnover automatically.`,content:`
    <div style="display:flex;flex-direction:column;gap:10px">
      <div style="background:var(--sand);border-radius:10px;padding:14px">
        <div style="font-size:13px;font-weight:600;color:var(--txt);margin-bottom:8px">🧹 How the cleaner workflow works:</div>
        <div style="display:flex;flex-direction:column;gap:8px;font-size:12px;color:var(--txt2)">
          <div style="display:flex;gap:8px"><span style="color:var(--terra);font-weight:700">1.</span><span>Go to <strong>Cleaner Marketplace</strong> → Add Cleaner (name, phone, rate)</span></div>
          <div style="display:flex;gap:8px"><span style="color:var(--terra);font-weight:700">2.</span><span>Click <strong>Request Job</strong> → pick property, date, type, and assign your cleaner</span></div>
          <div style="display:flex;gap:8px"><span style="color:var(--terra);font-weight:700">3.</span><span>Copy the <strong>🔗 Job Link</strong> and send to your cleaner via SMS or WhatsApp</span></div>
          <div style="display:flex;gap:8px"><span style="color:var(--terra);font-weight:700">4.</span><span>Cleaner opens the link on their phone → accepts, follows checklist, marks complete</span></div>
          <div style="display:flex;gap:8px"><span style="color:var(--terra);font-weight:700">5.</span><span>You get notified, rate the job quality (⭐), and log their payout</span></div>
        </div>
      </div>
      <div style="background:rgba(196,105,58,.08);border:1px solid var(--terra-l);border-radius:10px;padding:12px;font-size:12px;color:var(--txt2)">
        💡 <strong>Staff Portal</strong> also has full turnover, pre-arrival, checkout, and maintenance checklists — assign tasks and track completion per team member.
      </div>
    </div>`};

  const stepPro = {title:`Your Pro power features`,sub:`These tools are unlocked on your plan — here's how to get the most from them.`,content:`
    <div style="display:flex;flex-direction:column;gap:8px">
      <div style="display:flex;gap:10px;align-items:flex-start;padding:10px;background:var(--sand);border-radius:8px"><span style="font-size:18px;flex-shrink:0">📈</span><div><div style="font-size:12px;font-weight:600;color:var(--txt)">Market Trends Widget</div><div style="font-size:11px;color:var(--txt2)">Dashboard shows a demand sparkline and recommended price adjustment. Hit ↻ to refresh anytime.</div></div></div>
      <div style="display:flex;gap:10px;align-items:flex-start;padding:10px;background:var(--sand);border-radius:8px"><span style="font-size:18px;flex-shrink:0">💰</span><div><div style="font-size:12px;font-weight:600;color:var(--txt)">Pricing Optimizer</div><div style="font-size:11px;color:var(--txt2)">Set weekend, peak, low-season, last-minute, and long-stay rate rules. Apply across all properties.</div></div></div>
      <div style="display:flex;gap:10px;align-items:flex-start;padding:10px;background:var(--sand);border-radius:8px"><span style="font-size:18px;flex-shrink:0">📦</span><div><div style="font-size:12px;font-weight:600;color:var(--txt)">Inventory Tracking</div><div style="font-size:11px;color:var(--txt2)">Track supplies per property. Get low-stock alerts and generate a shopping list in one click.</div></div></div>
      <div style="display:flex;gap:10px;align-items:flex-start;padding:10px;background:var(--sand);border-radius:8px"><span style="font-size:18px;flex-shrink:0">👤</span><div><div style="font-size:12px;font-weight:600;color:var(--txt)">Guest CRM & Loyalty</div><div style="font-size:11px;color:var(--txt2)">Auto-builds guest profiles from bookings. Track stay count, total spend, and loyalty tier.</div></div></div>
      <div style="display:flex;gap:10px;align-items:flex-start;padding:10px;background:var(--sand);border-radius:8px"><span style="font-size:18px;flex-shrink:0">🔑</span><div><div style="font-size:12px;font-weight:600;color:var(--txt)">Guest Portal & QR Manual</div><div style="font-size:11px;color:var(--txt2)">Generate a personalized check-in page or scannable QR manual for every guest automatically.</div></div></div>
      <div style="display:flex;gap:10px;align-items:flex-start;padding:10px;background:var(--sand);border-radius:8px"><span style="font-size:18px;flex-shrink:0">✦</span><div><div style="font-size:12px;font-weight:600;color:var(--txt)">AI Content Hub</div><div style="font-size:11px;color:var(--txt2)">Save and organize AI scripts, video prompts, and marketing copy for your digital products.</div></div></div>
    </div>`};

  const stepBusiness = {title:`Business & Team features`,sub:`Unlock your unlimited plan — here's what's new at Business tier.`,content:`
    <div style="display:flex;flex-direction:column;gap:8px">
      <div style="display:flex;gap:10px;align-items:flex-start;padding:10px;background:rgba(200,168,75,.08);border:1px solid var(--gold);border-radius:8px"><span style="font-size:18px;flex-shrink:0">♾️</span><div><div style="font-size:12px;font-weight:600;color:var(--txt)">Unlimited Properties</div><div style="font-size:11px;color:var(--txt2)">No cap. Add as many listings as your portfolio grows.</div></div></div>
      <div style="display:flex;gap:10px;align-items:flex-start;padding:10px;background:var(--sand);border-radius:8px"><span style="font-size:18px;flex-shrink:0">⊹</span><div><div style="font-size:12px;font-weight:600;color:var(--txt)">Team Access</div><div style="font-size:11px;color:var(--txt2)">Go to Settings → Team Access. Invite team members with Manager or Viewer roles. They get their own login.</div></div></div>
      <div style="display:flex;gap:10px;align-items:flex-start;padding:10px;background:var(--sand);border-radius:8px"><span style="font-size:18px;flex-shrink:0">🎛</span><div><div style="font-size:12px;font-weight:600;color:var(--txt)">Software Mode (White-Label)</div><div style="font-size:11px;color:var(--txt2)">Settings → Software Mode. Toggle ON to switch all branding to a neutral product name for client demos.</div></div></div>
      <div style="display:flex;gap:10px;align-items:flex-start;padding:10px;background:var(--sand);border-radius:8px"><span style="font-size:18px;flex-shrink:0">📊</span><div><div style="font-size:12px;font-weight:600;color:var(--txt)">Property Scorecards & Full Analytics</div><div style="font-size:11px;color:var(--txt2)">Revenue per property, quality scores, occupancy trends — exportable to CSV for any reporting need.</div></div></div>
      <div style="display:flex;gap:10px;align-items:flex-start;padding:10px;background:var(--sand);border-radius:8px"><span style="font-size:18px;flex-shrink:0">⚡</span><div><div style="font-size:12px;font-weight:600;color:var(--txt)">Full Automation Suite</div><div style="font-size:11px;color:var(--txt2)">Auto-messages, cleaning tasks, inventory alerts, late checkout detection, anniversary perks, weekly summaries.</div></div></div>
    </div>`};

  const stepCohost = {title:`Your Co-Host business suite`,sub:`Everything you need to run a professional property management operation.`,content:`
    <div style="display:flex;flex-direction:column;gap:8px">
      <div style="display:flex;gap:10px;align-items:flex-start;padding:10px;background:rgba(200,168,75,.12);border:1px solid var(--gold);border-radius:8px"><span style="font-size:18px;flex-shrink:0">🔧</span><div><div style="font-size:12px;font-weight:600;color:var(--txt)">Vendor Management</div><div style="font-size:11px;color:var(--txt2)">Track Owner Billing vs Worker Payout for every job. Auto-calculates 10% platform fee and your net profit.</div></div></div>
      <div style="display:flex;gap:10px;align-items:flex-start;padding:10px;background:var(--sand);border-radius:8px"><span style="font-size:18px;flex-shrink:0">🤝</span><div><div style="font-size:12px;font-weight:600;color:var(--txt)">Owner Management & Reports</div><div style="font-size:11px;color:var(--txt2)">Add property owners, set commission splits, send branded monthly PDF reports in one click.</div></div></div>
      <div style="display:flex;gap:10px;align-items:flex-start;padding:10px;background:var(--sand);border-radius:8px"><span style="font-size:18px;flex-shrink:0">💰</span><div><div style="font-size:12px;font-weight:600;color:var(--txt)">Co-Host Earnings Dashboard</div><div style="font-size:11px;color:var(--txt2)">Your business P&L — earnings by property, monthly trend chart, owner payout status, CSV export.</div></div></div>
      <div style="display:flex;gap:10px;align-items:flex-start;padding:10px;background:var(--sand);border-radius:8px"><span style="font-size:18px;flex-shrink:0">📸</span><div><div style="font-size:12px;font-weight:600;color:var(--txt)">Photo Vault & Payout Ledger</div><div style="font-size:11px;color:var(--txt2)">Upload proof-of-service photos per property. Track every contractor payment with margin tracking.</div></div></div>
      <div style="display:flex;gap:10px;align-items:flex-start;padding:10px;background:var(--sand);border-radius:8px"><span style="font-size:18px;flex-shrink:0">🏷</span><div><div style="font-size:12px;font-weight:600;color:var(--txt)">White-Label Branding</div><div style="font-size:11px;color:var(--txt2)">Settings → White-Label Branding. Set your business name, logo, and colors on all guest portals and reports.</div></div></div>
    </div>`};

  const stepLaunch = {title:`You're all set! 🚀`,sub:`Here are your first 4 actions to get live immediately.`,content:`
    <div style="display:flex;flex-direction:column;gap:10px">
      <div style="background:rgba(107,143,113,.1);border:1px solid var(--sage);border-radius:10px;padding:12px;display:flex;gap:12px;align-items:center"><div style="font-size:22px;flex-shrink:0">🔄</div><div><div style="font-size:13px;font-weight:600;color:var(--txt)">Step 1 — Sync your Airbnb calendar</div><div style="font-size:12px;color:var(--txt2)">iCal Sync → paste your Airbnb iCal URL → bookings import instantly</div></div></div>
      <div style="background:var(--sand);border-radius:10px;padding:12px;display:flex;gap:12px;align-items:center"><div style="font-size:22px;flex-shrink:0">💬</div><div><div style="font-size:13px;font-weight:600;color:var(--txt)">Step 2 — Try AI messaging</div><div style="font-size:12px;color:var(--txt2)">Messages → open a conversation → click AI Reply</div></div></div>
      <div style="background:var(--sand);border-radius:10px;padding:12px;display:flex;gap:12px;align-items:center"><div style="font-size:22px;flex-shrink:0">🔑</div><div><div style="font-size:13px;font-weight:600;color:var(--txt)">Step 3 — Send a guest portal</div><div style="font-size:12px;color:var(--txt2)">Guest Portal → select a booking → download or copy the HTML</div></div></div>
      <div style="background:var(--sand);border-radius:10px;padding:12px;display:flex;gap:12px;align-items:center"><div style="font-size:22px;flex-shrink:0">❓</div><div><div style="font-size:13px;font-weight:600;color:var(--txt)">Step 4 — Explore Help Center</div><div style="font-size:12px;color:var(--txt2)">Sidebar → Help Center for full docs, or click 🤖 AI Tour Guide anytime</div></div></div>
      <div style="background:rgba(196,105,58,.08);border:1px solid var(--terra-l);border-radius:8px;padding:10px;font-size:11px;color:var(--txt2);line-height:1.5;text-align:center">Questions? Email <strong>csopropertyservice@gmail.com</strong> — we respond within 24 hours</div>
    </div>`};

  // Build step array by plan
  const base = [stepWelcome, stepProperty, stepBookings, stepMessaging, stepCleaning];
  if(plan==='free') return [...base, stepLaunch];
  if(plan==='pro'||plan==='trial') return [...base, stepPro, stepLaunch];
  if(plan==='business') return [...base, stepPro, stepBusiness, stepLaunch];
  if(plan==='cohost'||plan==='cohost_starter') return [...base, stepPro, stepBusiness, stepCohost, stepLaunch];
  return [...base, stepLaunch];
}

let _obSteps = [];

function startOnboard(user) {
  obStep=1;
  const plan = cData?.plan||'free';
  _obSteps = getObSteps(plan);

  // Show AI Tour FAB during onboarding so users can ask questions
  const fab = document.getElementById('ai-tour-fab');
  if(fab) fab.style.display='flex';

  // Update plan badge
  const badge = document.getElementById('ob-plan-badge');
  if(badge) {
    const labels = {free:'⭐ Free Plan',trial:'🎯 Pro Trial',pro:'🚀 Pro Plan',business:'💼 Business',cohost:'🏆 Co-Host'};
    badge.textContent = labels[plan]||'Free Plan';
    badge.style.background = (plan==='cohost'||plan==='cohost_starter')?'rgba(200,168,75,.2)':plan==='business'?'rgba(30,45,64,.1)':plan==='pro'||plan==='trial'?'rgba(107,143,113,.15)':'var(--sand)';
    badge.style.color = (plan==='cohost'||plan==='cohost_starter')?'var(--gold)':plan==='business'?'var(--navy)':plan==='pro'||plan==='trial'?'var(--sage)':'var(--txt2)';
  }

  // Rebuild step indicators
  const stepsEl = document.getElementById('ob-steps');
  if(stepsEl) {
    stepsEl.innerHTML = _obSteps.map((_,i)=>`
      ${i>0?`<div class="ob-line" id="ob-l${i}"></div>`:''}
      <div class="ob-step ${i===0?'active':'future'}" id="ob-s${i+1}">${i+1}</div>
    `).join('');
  }

  ['landing','login','signup'].forEach(n=>{const el=document.getElementById('screen-'+n);if(el)el.style.display='none';});
  document.getElementById('app').classList.remove('visible');
  document.getElementById('screen-onboard').style.display='flex';
  renderObStep();
}

function renderObStep() {
  const step=_obSteps[obStep-1];
  if(!step) return;
  document.getElementById('ob-content').innerHTML=`<div class="ob-title">${step.title}</div><div class="ob-sub">${step.sub}</div>${step.content}`;
  const total = _obSteps.length;
  for(let i=1;i<=total;i++){
    const s=document.getElementById('ob-s'+i);
    if(!s) continue;
    s.className='ob-step '+(i<obStep?'done':i===obStep?'active':'future');
    s.textContent=i<obStep?'✓':i;
    if(i<total){const l=document.getElementById('ob-l'+i);if(l)l.className='ob-line '+(i<obStep?'done':'');}
  }
  document.getElementById('ob-back-btn').style.display=obStep>1?'':'none';
  document.getElementById('ob-next-btn').textContent=obStep===total?'Launch Dashboard →':'Next →';
}

function obNext() {
  if(obStep===2){
    const name=document.getElementById('ob-prop-name')?.value.trim();
    if(name){
      const prop={id:'p_'+Date.now(),name,emoji:document.getElementById('ob-prop-emoji')?.value||'🏡',location:document.getElementById('ob-prop-loc')?.value||'',rate:parseFloat(document.getElementById('ob-prop-rate')?.value)||100,maxGuests:4,wifi:document.getElementById('ob-prop-wifi')?.value||'',wifiPw:document.getElementById('ob-prop-wifipw')?.value||'',doorCode:document.getElementById('ob-prop-door')?.value||'',parking:'',occupancy:Math.floor(Math.random()*25)+65,rating:(4.7+Math.random()*.3).toFixed(2),gradient:'pi1',created:Date.now()};
      cData.properties.push(prop);saveUserData(cUid,cData);
    }
  }
  if(obStep===_obSteps.length){finishOnboard();return;}
  obStep++;renderObStep();
}
function obBack(){if(obStep>1){obStep--;renderObStep();}}
function finishOnboard(){
  cData.onboarded=true;
  saveLocalData(cUid,cData);
  document.getElementById('screen-onboard').style.display='none';
  void launchApp(cUser);
}

// ════════════════════════════════════════════
//  NAV
// ════════════════════════════════════════════
const titles={dashboard:'Dashboard',properties:'Properties',bookings:'Bookings',messages:'Messages',pricing:'Nightly Rates',cleaning:'Tasks',staff:'Staff Portal',marketplace:'Cleaner Marketplace',workorders:'Work Orders',inventory:'Inventory',content_hub:'Content Hub',vendor_mgmt:'Vendor Management',cohost_cmd:'Command Center',cohost_earnings:'Earnings Dashboard',owners:'Owner Management',crm:'Guest CRM',payouts:'Payout Ledger',photovault:'Photo Vault',qrmanual:'QR House Manual',aihours:'AI Office Hours',affiliates:'Affiliate Program',checkininsurance:'Check-in Insurance',rentals:'Equipment Rentals',ical:'iCal Sync',templates:'Message Templates',loyalty:'Guest Loyalty',pricing_opt:'Pricing Optimizer',scorecards:'Property Scorecards',concierge:'Concierge',upsell:'Upsell Portal',directbook:'Direct Booking Kit',website:'Website Builder',portal:'Guest Portal',analytics:'Analytics',reports:'Reports',reviews:'Reviews',expenses:'Expenses',damage:'Damage Claims',blacklist:'Guest Blacklist',settings:'Settings',help:'Help Center',team:'Team Access',admin:'Admin Panel',automations:'Automations'};
function nav(id,el){
  // Reset ALL scroll containers to top on every tab navigation
  window.scrollTo(0,0);
  const contentEl = document.querySelector('.content');
  if(contentEl) contentEl.scrollTop = 0;
  const mainArea = document.querySelector('.main-area');
  if(mainArea) mainArea.scrollTop = 0;
  
  // Navigation guard - if no user is logged in, redirect to landing page
  if(!cUid || !cUser) {
    showLandingPage();
    return;
  }
  
  // Safety guard - if requested page doesn't exist, default to dashboard
  const targetPage = document.getElementById('page-' + id);
  if (!targetPage) {
    console.warn('Page not found: ' + id + ', defaulting to dashboard');
    id = 'dashboard';
  }
  
  document.querySelectorAll('.page').forEach(function(p){
    p.classList.remove('active');
    p.style.display='none';
  });
  document.querySelectorAll('.sb-item').forEach(n=>n.classList.remove('active'));
  const activePg=document.getElementById('page-'+id);
  activePg.classList.add('active');
  activePg.style.display='block';
  activePg.style.position='relative';
  document.getElementById('page-title').textContent=titles[id]||id;
  closeSidebar();
  updateMobNav(id);
  // Save last page for refresh restore
  try{sessionStorage.setItem('hh_last_page',id);}catch(e){}
  try{localStorage.setItem('hh_last_page',id);}catch(e){}

  if(id==='website')setTimeout(updateWb,100);
  if(id==='settings'){
    setTimeout(function(){
      const akEl=document.getElementById('set-api-key');
      if(akEl&&cData.apiKey) akEl.value=cData.apiKey;
      const rkEl=document.getElementById('set-resend-key');
      if(rkEl&&cData.resendKey) rkEl.value=cData.resendKey;
      const nmEl=document.getElementById('set-name');
      if(nmEl&&cUser) nmEl.value=cUser.name||'';
      const emEl=document.getElementById('set-email');
      if(emEl&&cUser) emEl.value=cUser.email||'';
    },50);
  }
  if(id==='portal')renderPortal();
  if(id==='dashboard'){setTimeout(()=>{checkoutMonitor();refreshMarketTrends();},300);}
  if(id==='reports')renderReports();
  if(id==='analytics'){renderAnalytics();}
  if(id==='admin')setTimeout(()=>renderAdmin(),50);
  if(id==='staff'){renderStaff();setTimeout(()=>{showChecklist('turnover',document.querySelector('#checklist-tabs button'));},150);}
  if(id==='reviews')setTimeout(()=>checkReviewRequests(),100);
  if(id==='team')setTimeout(()=>renderTeam(),50);
  if(id==='expenses')setTimeout(()=>renderExpenses(),50);
  if(id==='blacklist')setTimeout(()=>renderBlacklist(),50);
  if(id==='pricing')setTimeout(()=>{renderPricing();renderSeasons();},50);
  if(id==='marketplace')setTimeout(()=>renderMarketplace(),50);
  if(id==='workorders')setTimeout(()=>renderWorkOrders(),50);
  if(id==='inventory')setTimeout(()=>renderInventory(),50);
  if(id==='cohost_cmd')setTimeout(()=>renderCohostCmd(),50);
  if(id==='cohost_earnings')setTimeout(()=>renderCohostEarnings(),50);
  if(id==='content_hub')setTimeout(()=>renderContentHub(),50);
  if(id==='vendor_mgmt')setTimeout(()=>renderVendorMgmt(),50);
  if(id==='help')setTimeout(()=>renderHelp(),50);
  if(id==='owners')setTimeout(()=>renderOwners(),50);
  if(id==='crm')setTimeout(()=>renderCRM(),50);
  if(id==='payouts')setTimeout(()=>renderPayouts(),50);
  if(id==='photovault')setTimeout(()=>renderPhotoVault(),50);
  if(id==='qrmanual')setTimeout(()=>renderQRManual(),50);
  if(id==='aihours')setTimeout(()=>renderAIHours(),50);
  if(id==='automations')setTimeout(()=>renderAutomations(),50);
  if(id==='affiliates')setTimeout(()=>renderAffiliates(),50);
  if(id==='concierge')setTimeout(()=>renderConcierge(),50);
  if(id==='upsell')setTimeout(()=>renderUpsell(),50);
  if(id==='directbook')setTimeout(()=>renderDirectBook(),50);
  if(id==='damage')setTimeout(()=>renderDamageClaims(),50);
  if(id==='checkininsurance')setTimeout(()=>renderCIInsurance(),50);
  if(id==='rentals')setTimeout(()=>renderRentals(),50);
  if(id==='templates')setTimeout(()=>renderTemplates(),50);
  if(id==='loyalty')setTimeout(()=>renderLoyalty(),50);
  if(id==='pricing_opt')setTimeout(()=>{saveOptimizerSettings();runPricingOptimizer();},50);
  if(id==='scorecards')setTimeout(()=>renderScorecards(),50);
}
function openSidebar(){document.getElementById('sidebar').classList.add('open');document.getElementById('sb-overlay').classList.add('show');}
function closeSidebar(){document.getElementById('sidebar').classList.remove('open');document.getElementById('sb-overlay').classList.remove('show');}

// ════════════════════════════════════════════
//  RENDER ALL
// ════════════════════════════════════════════
function renderPricingOpt(){
  // Load saved settings into inputs
  const s=cData.optimizerSettings||{};
  if(s.weekend!=null){const el=document.getElementById('opt-weekend');if(el)el.value=s.weekend;}
  if(s.peak!=null){const el=document.getElementById('opt-peak');if(el)el.value=s.peak;}
  if(s.low!=null){const el=document.getElementById('opt-low');if(el)el.value=s.low;}
  if(s.lastMin!=null){const el=document.getElementById('opt-lastmin');if(el)el.value=s.lastMin;}
  if(s.longStay!=null){const el=document.getElementById('opt-longstay');if(el)el.value=s.longStay;}
}
function updateMobNav(id) {
  document.querySelectorAll('.mob-nav-item').forEach(function(el) {
    el.classList.remove('active');
  });
  const active = document.getElementById('mob-nav-'+id);
  if(active) active.classList.add('active');
}

function safeRender(fn, name) {
  try { fn(); } catch(e) { console.warn('[CSO Property Services] render error in ' + name + ':', e); }
}
function toggleSidebarCollapse() {
  const sb = document.getElementById('sidebar');
  const btn = document.getElementById('sb-collapse-btn');
  const collapsed = sb.classList.toggle('collapsed');
  try { localStorage.setItem('hh_sb_collapsed', collapsed ? '1' : '0'); } catch(e) {}
}

function restoreSidebarState() {
  try {
    if(localStorage.getItem('hh_sb_collapsed') === '1') {
      document.getElementById('sidebar')?.classList.add('collapsed');
    }
  } catch(e) {}
}

function renderAll(){
  setTimeout(runScheduledAutomations, 2000);
  setTimeout(checkoutMonitor, 1500);      // GAP 5 — checkout detection
  setTimeout(checkJobCardUpdates, 500);   // GAP 2+3 — cleaner card bridge
  setTimeout(runAutoApprovalCheck, 2000); // Auto-approve 48hr window + update badge
  // Force hide all inactive pages on load
  document.querySelectorAll('.page:not(.active)').forEach(function(p){
    p.style.display='none';
    p.style.position='absolute';
  });
  const ap=document.querySelector('.page.active');
  if(ap){ap.style.display='block';ap.style.position='relative';}
  const _ma=document.querySelector('.main-area');if(_ma)_ma.scrollTo({top:0,behavior:'instant'});
  safeRender(renderDashboard,'dashboard');
  safeRender(renderProperties,'properties');
  safeRender(renderBookings,'bookings');
  safeRender(renderMessages,'messages');
  safeRender(renderTasks,'tasks');
  safeRender(renderPricing,'pricing');
  safeRender(renderPortal,'portal');
  safeRender(renderAnalytics,'analytics');
  safeRender(renderReports,'reports');
  safeRender(renderReviews,'reviews');
  safeRender(renderICals,'icals');
  safeRender(renderICalExports,'ical-exports');
  safeRender(renderStaff,'staff');
  safeRender(updateBadges,'badges');
  safeRender(renderSmartNotifications,'notifications');
  safeRender(renderHelp,'help');
  setTimeout(function(){hhEnhanceClickableAria(document.body);},0);
}

