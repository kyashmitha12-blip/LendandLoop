/* ================= THEME ================= */
const root = document.documentElement;
const themeToggle = document.getElementById('theme-toggle');

function setTheme(theme){
  const isDark = theme === 'dark';
  root.setAttribute('data-theme', theme);
  localStorage.setItem('theme', theme);
  if (themeToggle) {
    themeToggle.textContent = isDark ? '☀️' : '🌙';
    themeToggle.title = isDark ? 'Switch to light mode' : 'Switch to dark mode';
    themeToggle.setAttribute('aria-label', isDark ? 'Switch to light mode' : 'Switch to dark mode');
  }
}
const savedTheme = localStorage.getItem('theme');
const preferredTheme = savedTheme || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
setTheme(preferredTheme);
themeToggle?.addEventListener('click', ()=>{
  setTheme(root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark');
});

/* ================= STORAGE HELPERS ================= */
const USERS_KEY = 'll_users';
const SESSION_KEY = 'll_session';
const RESOURCES_KEY = 'll_resources';
const BOOKINGS_KEY = 'll_bookings';
const DEMO_SEEDED_KEY = 'll_demo_resources_seeded';

function getUsers(){
  try { return JSON.parse(localStorage.getItem(USERS_KEY)) || {}; }
  catch(e){ return {}; }
}
function saveUsers(users){ localStorage.setItem(USERS_KEY, JSON.stringify(users)); }
function getSessionEmail(){ return localStorage.getItem(SESSION_KEY); }
function setSessionEmail(email){ localStorage.setItem(SESSION_KEY, email); }
function clearSession(){ localStorage.removeItem(SESSION_KEY); }
function getResources(){
  try { return JSON.parse(localStorage.getItem(RESOURCES_KEY)) || []; }
  catch(e){ return []; }
}
function saveResources(list){ localStorage.setItem(RESOURCES_KEY, JSON.stringify(list)); }
function getBookings(){
  try { return JSON.parse(localStorage.getItem(BOOKINGS_KEY)) || []; }
  catch(e){ return []; }
}
function saveBookings(list){ localStorage.setItem(BOOKINGS_KEY, JSON.stringify(list)); }

let currentUser = null; // { name, email, passwordHash, studentId, cardPhoto, verified: 'no'|'pending'|'yes' }

/* very small non-cryptographic hash — this is a front-end demo with no
   backend, so this just avoids storing raw passwords in localStorage as
   plaintext. It is NOT secure for a real production login system. */
function hashPassword(pw){
  let h = 0;
  for (let i=0;i<pw.length;i++){ h = (Math.imul(31,h) + pw.charCodeAt(i)) | 0; }
  return 'h' + h.toString(16);
}

/* ================= AUTH UI ================= */
function switchAuthTab(tab){
  document.getElementById('atab-login').classList.toggle('active', tab==='login');
  document.getElementById('atab-signup').classList.toggle('active', tab==='signup');
  document.getElementById('auth-login').style.display = tab==='login' ? 'block' : 'none';
  document.getElementById('auth-signup').style.display = tab==='signup' ? 'block' : 'none';
  document.getElementById('login-error').textContent = '';
  document.getElementById('signup-error').textContent = '';
}
document.getElementById('atab-login').addEventListener('click', ()=>switchAuthTab('login'));
document.getElementById('atab-signup').addEventListener('click', ()=>switchAuthTab('signup'));

function handleSignup(){
  const name = document.getElementById('signup-name').value.trim();
  const email = document.getElementById('signup-email').value.trim().toLowerCase();
  const pw = document.getElementById('signup-password').value;
  const err = document.getElementById('signup-error');
  err.textContent = '';

  if (!name || !email || !pw){ err.textContent = 'Fill in all fields.'; return; }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)){ err.textContent = 'Enter a valid email address.'; return; }
  if (pw.length < 6){ err.textContent = 'Password must be at least 6 characters.'; return; }

  const users = getUsers();
  if (users[email]){ err.textContent = 'An account with this email already exists.'; return; }

  users[email] = {
    name, email,
    passwordHash: hashPassword(pw),
    studentId: '', cardPhotoName: '',
    verified: 'no'
  };
  saveUsers(users);
  setSessionEmail(email);
  document.getElementById('signup-name').value = '';
  document.getElementById('signup-email').value = '';
  document.getElementById('signup-password').value = '';
  enterApp();
}

function handleLogin(){
  const email = document.getElementById('login-email').value.trim().toLowerCase();
  const pw = document.getElementById('login-password').value;
  const err = document.getElementById('login-error');
  err.textContent = '';

  if (!email || !pw){ err.textContent = 'Enter your email and password.'; return; }

  const users = getUsers();
  const user = users[email];
  if (!user || user.passwordHash !== hashPassword(pw)){
    err.textContent = 'Incorrect email or password.';
    return;
  }
  setSessionEmail(email);
  document.getElementById('login-password').value = '';
  enterApp();
}

function handleLogout(){
  clearSession();
  currentUser = null;
  document.getElementById('app-root').style.display = 'none';
  document.getElementById('auth-overlay').style.display = 'flex';
  document.getElementById('login-email').value = '';
  document.getElementById('login-password').value = '';
  switchAuthTab('login');
}

function enterApp(){
  const email = getSessionEmail();
  const users = getUsers();
  currentUser = users[email];
  if (!currentUser){ handleLogout(); return; }
  ensureDemoResources();

  document.getElementById('auth-overlay').style.display = 'none';
  document.getElementById('app-root').style.display = 'flex';
  renderUserSidebar();
  renderVerifyStatus();
  refreshEverything();
  go('dashboard');
}

function renderUserSidebar(){
  document.getElementById('user-name').textContent = currentUser.name;
  document.getElementById('user-avatar').textContent = currentUser.name.trim().charAt(0).toUpperCase() || '👤';
  const subMap = { no:'Not verified', pending:'Verification pending', yes:'Verified student' };
  document.getElementById('user-sub').textContent = subMap[currentUser.verified] || 'Not verified';
  document.getElementById('dash-greeting').textContent = 'Welcome, ' + currentUser.name.split(' ')[0];
  document.getElementById('verify-alert').style.display = currentUser.verified === 'yes' ? 'none' : 'flex';
}

/* ================= VERIFICATION ================= */
function renderVerifyStatus(){
  const verifiedBox = document.getElementById('verify-status-verified');
  const pendingBox = document.getElementById('verify-status-pending');
  const formCard = document.getElementById('verify-form-card');

  verifiedBox.style.display = 'none';
  pendingBox.style.display = 'none';
  formCard.style.display = 'block';

  if (currentUser.verified === 'yes'){
    verifiedBox.style.display = 'flex';
    formCard.style.display = 'none';
  } else if (currentUser.verified === 'pending'){
    pendingBox.style.display = 'flex';
    formCard.style.display = 'none';
  }
}

function submitVerification(){
  const name = document.getElementById('verify-name').value.trim();
  const card = document.getElementById('verify-card').value.trim();
  const photoInput = document.getElementById('verify-photo');
  const err = document.getElementById('verify-error');
  err.textContent = '';

  if (!name || !card){ err.textContent = 'Enter your name and campus card number.'; return; }
  if (!photoInput.files || !photoInput.files[0]){ err.textContent = 'Upload a photo of your campus card.'; return; }

  const users = getUsers();
  currentUser.studentId = card;
  currentUser.cardPhotoName = photoInput.files[0].name;
  currentUser.verified = 'pending';
  users[currentUser.email] = currentUser;
  saveUsers(users);

  renderVerifyStatus();
  renderUserSidebar();
  showConfirmModal('🛡️', 'Under review', "We're checking your student ID against campus records — usually within a few hours.", 'Verification submitted');

  /* Demo-only: simulates campus-records approval coming back, since there
     is no real backend here to call. In a production build this would be
     an admin action or a real ID-verification API response instead. */
  setTimeout(()=>{
    const u = getUsers();
    if (u[currentUser.email] && u[currentUser.email].verified === 'pending'){
      u[currentUser.email].verified = 'yes';
      saveUsers(u);
      if (currentUser.email === getSessionEmail()){
        currentUser = u[currentUser.email];
        renderVerifyStatus();
        renderUserSidebar();
      }
    }
  }, 4000);
}

function guardVerified(){
  if (!currentUser || currentUser.verified !== 'yes'){
    alert('You need to be a verified student to do this. Head to the Verification tab and submit your student ID.');
    go('verify');
    return false;
  }
  return true;
}

/* ================= RESOURCES ================= */
const bgPalette = ['#EAF4EE','#FFE4DC','#FCEFD2','#E4ECFB','#CFEBDA'];
function pickBg(){ return bgPalette[Math.floor(Math.random()*bgPalette.length)]; }
const catLabel = { equip:'Equipment', books:'Books', space:'Spaces', skill:'Skills' };
const predictionData = [
  {key:'projector', name:'Projector', demand:12, supply:5, period:'Next 7 days'},
  {key:'dslr', name:'DSLR Camera', demand:8, supply:6, period:'Next 7 days'},
  {key:'arduino', name:'Arduino Kit', demand:15, supply:10, period:'Next 7 days'},
  {key:'microphone', name:'Microphone', demand:9, supply:4, period:'Next 7 days'},
  {key:'tripod', name:'Tripod', demand:7, supply:3, period:'Next 7 days'}
];
const demoResources = [
  {id:'demo-epson-projector', name:'Epson Projector', predictionKey:'projector', cat:'equip', sub:'HD projector · HDMI included', price:'₹150/day', priceValue:150, ic:'📽️', bg:'#EAF4EE', status:'idle', utilization:31, daysSinceUsed:10, activationOpportunity:'Medium', distanceKm:0.8, condition:'Excellent', reliability:96, durationDays:2},
  {id:'demo-canon-dslr', name:'Canon DSLR', predictionKey:'dslr', cat:'equip', sub:'Canon EOS · 18-55mm lens', price:'₹120/day', priceValue:120, ic:'📷', bg:'#FFE4DC', status:'idle', utilization:22, daysSinceUsed:14, activationOpportunity:'High', distanceKm:1.4, condition:'Good', reliability:94, durationDays:2},
  {id:'demo-arduino-kit', name:'Arduino Kit', predictionKey:'arduino', cat:'equip', sub:'Starter kit · sensors included', price:'₹60/day', priceValue:60, ic:'🔌', bg:'#FCEFD2', status:'available', utilization:54, daysSinceUsed:2, distanceKm:0.6, condition:'Excellent', reliability:91, durationDays:3},
  {id:'demo-campus-microphone', name:'Campus Microphone', predictionKey:'microphone', cat:'equip', sub:'USB condenser microphone', price:'₹45/day', priceValue:45, ic:'🎙️', bg:'#E4ECFB', status:'available', utilization:48, daysSinceUsed:3, distanceKm:1.1, condition:'Good', reliability:89, durationDays:1},
  {id:'demo-tripod', name:'Tripod', predictionKey:'tripod', cat:'equip', sub:'Lightweight camera tripod', price:'₹30/day', priceValue:30, ic:'📸', bg:'#CFEBDA', status:'available', utilization:39, daysSinceUsed:5, distanceKm:0.9, condition:'Good', reliability:92, durationDays:2}
];

function ensureDemoResources(){
  if (localStorage.getItem(DEMO_SEEDED_KEY)==='true') return;
  const resources = getResources();
  const existingIds = new Set(resources.map(resource=>resource.id));
  const additions = demoResources.filter(resource=>!existingIds.has(resource.id)).map(resource=>({
    ...resource, ownerEmail:currentUser.email, demoResource:true, wasActivated:false
  }));
  if (additions.length) saveResources([...resources, ...additions]);
  localStorage.setItem(DEMO_SEEDED_KEY,'true');
}
function resourceStatus(resource){ return resource.status || 'available'; }
function predictionForResource(resource){
  if (resource.predictionKey) return predictionData.find(item=>item.key===resource.predictionKey) || predictionData[0];
  const name = `${resource.name} ${resource.sub}`.toLowerCase();
  if (/dslr|camera/.test(name)) return predictionData[1];
  if (/arduino/.test(name)) return predictionData[2];
  if (/microphone|mic\b/.test(name)) return predictionData[3];
  if (/tripod/.test(name)) return predictionData[4];
  return predictionData[0];
}
function predictionSupply(prediction){
  const activations = getResources().filter(resource=>resource.demoResource && resource.predictionKey===prediction.key && resource.wasActivated && resourceStatus(resource)==='available').length;
  return prediction.supply + activations;
}
function predictedGap(prediction){ return Math.max(0, prediction.demand - predictionSupply(prediction)); }
function matchScore(resource){
  const availability = resourceStatus(resource)==='available' ? 12 : 0;
  const condition = resource.condition==='Excellent' ? 12 : resource.condition==='Good' ? 8 : 3;
  const distance = resource.distanceKm <= 1 ? 8 : resource.distanceKm <= 1.5 ? 6 : resource.distanceKm <= 3 ? 3 : 0;
  const price = (resource.priceValue || 0) <= 60 ? 8 : (resource.priceValue || 0) <= 120 ? 6 : (resource.priceValue || 0) <= 150 ? 4 : 1;
  const duration = (resource.durationDays || 1) <= 3 ? 3 : -2;
  return Math.min(99, Math.round(50 + availability + condition + distance + price + duration + (resource.reliability || 85)*0.1));
}

function emptyState(msg){
  return `<div style="grid-column:1/-1;text-align:center;padding:40px 20px;color:var(--ink-400);font-size:13px;">${msg}</div>`;
}
function resCard(r){
  const status = resourceStatus(r);
  const bookable = status==='available';
  return `<div class="res-card">
    <div class="thumb" style="background:${r.bg};">${r.ic}</div>
    <div class="body">
      <div class="t">${escapeHtml(r.name)}</div>
      <div class="s">${escapeHtml(r.sub)}</div>
      <div class="match-details"><span class="match-score">${Math.round(matchScore(r))}% Match</span><span class="status-pill ${status}">${status==='idle'?'Idle':status[0].toUpperCase()+status.slice(1)}</span></div>
      <div class="resource-meta">${Number(r.distanceKm ?? 1).toFixed(1)} km · ${escapeHtml(r.condition || 'Good')} condition · ${r.reliability || 85}% reliable</div>
      <div class="row"><span class="price">${escapeHtml(r.price || 'Free')}</span><button class="btn-book" ${bookable?'':'disabled'} onclick="openBooking('${escapeAttr(r.id)}','${escapeAttr(r.name)}','${escapeAttr(r.ic)}','${escapeAttr(r.sub)}')">${bookable?'Book':'Unavailable'}</button></div>
    </div>
  </div>`;
}
function escapeHtml(s){ return String(s).replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function escapeAttr(s){ return String(s).replace(/'/g,''); }

function renderDashMatches(){
  const all = getResources();
  const mine = all.filter(r=>r.ownerEmail === currentUser.email);
  const others = all.filter(r=>(r.ownerEmail !== currentUser.email || r.demoResource) && resourceStatus(r)==='available')
    .sort((a,b)=>matchScore(b)-matchScore(a)).slice(0,3);
  document.getElementById('dash-matches').innerHTML = others.length ? others.map(resCard).join('') : emptyState('No matches yet');
  document.getElementById('stat-shared').textContent = mine.length;
  const bookings = getBookings().filter(booking=>booking.borrowerEmail===currentUser.email && booking.status==='active');
  document.getElementById('stat-bookings').textContent = bookings.length;
  document.getElementById('dash-shortages').textContent = predictionData.filter(predictedGap).length;
  document.getElementById('dash-idle').textContent = all.filter(resource=>resourceStatus(resource)==='idle').length;
  document.getElementById('dash-opportunities').textContent = all.filter(resource=>resourceStatus(resource)==='idle' && predictedGap(predictionForResource(resource))>0).length;
}

function renderFind(cat, query=''){
  const all = getResources();
  const normalizedQuery = query.trim().toLowerCase();
  const list = all.filter(resource=>{
    const matchesCategory = cat==='all' || resource.cat===cat;
    const searchable = `${resource.name} ${resource.sub} ${catLabel[resource.cat] || resource.cat}`.toLowerCase();
    return matchesCategory && (!normalizedQuery || searchable.includes(normalizedQuery));
  }).sort((a,b)=>matchScore(b)-matchScore(a));
  document.getElementById('find-grid').innerHTML = list.length ? list.map(resCard).join('') : emptyState('No resources found');
}
document.querySelectorAll('#filter-chips .chip').forEach(chip=>{
  chip.addEventListener('click', ()=>{
    document.querySelectorAll('#filter-chips .chip').forEach(c=>c.classList.remove('active'));
    chip.classList.add('active');
    renderFind(chip.dataset.cat, document.getElementById('global-search').value);
  });
});
document.getElementById('global-search').addEventListener('input', event=>{
  renderFind(document.querySelector('#filter-chips .chip.active')?.dataset.cat || 'all', event.target.value);
});
document.getElementById('global-search').addEventListener('keydown', event=>{
  if (event.key==='Enter') go('find');
});

function ownerRow(r){
  const status = resourceStatus(r);
  const prediction = predictionForResource(r);
  const lastUsed = r.lastUsedAt ? 'Today' : r.daysSinceUsed === undefined ? 'Not used yet' : `${r.daysSinceUsed} days ago`;
  return `<div class="owner-row">
    <div class="ic" style="background:${r.bg};">${r.ic}</div>
    <div class="info"><div class="t">${escapeHtml(r.name)}</div><div class="s">${catLabel[r.cat]||r.cat} · ${escapeHtml(r.price || 'Free')} · ${r.utilization || 0}% utilized · Last used ${lastUsed} · Predicted demand ${prediction.demand}</div></div>
    <div class="row-actions">
      <span class="status-pill ${status}">${status==='idle'?'Idle':status==='suggested'?'Activation suggested':status[0].toUpperCase()+status.slice(1)}</span>
      ${status==='idle' && predictedGap(prediction)>0 ? `<button class="btn-book" onclick="activateResource('${escapeAttr(r.id)}')">Activate</button>` : ''}
      <button class="icon-del" title="Remove listing" onclick="deleteResource('${r.id}')">✕</button>
    </div>
  </div>`;
}
function renderOwnerList(){
  const mine = getResources().filter(r=>r.ownerEmail === currentUser.email);
  const idle = mine.filter(resource=>resourceStatus(resource)==='idle');
  document.getElementById('idle-resource-list').innerHTML = idle.length
    ? idle.map(activationCard).join('')
    : `<div class="idle-card"><span class="ic">✓</span><div><div class="t">No idle resources detected</div><div class="s">Available and booked resources are reflected in your listings below.</div></div></div>`;
  document.getElementById('owner-list').innerHTML = mine.length
    ? mine.map(ownerRow).join('')
    : `<div class="owner-row"><div class="ic" style="background:var(--mint-50);">📦</div><div class="info"><div class="t">No resources listed yet</div><div class="s">Add a resource to start lending it out</div></div></div>`;
}

function activationCard(resource){
  const prediction = predictionForResource(resource);
  const gap = predictedGap(prediction);
  const level = gap>=5?'High':'Medium';
  const unitLabel = {projector:'projectors',dslr:'DSLR cameras',arduino:'Arduino kits',microphone:'microphones',tripod:'tripods'}[prediction.key] || 'resources';
  return `<div class="activation-card">
    <div class="activation-copy"><div class="t">${level} demand for ${escapeHtml(prediction.name)} predicted.</div>
      <div class="s">Your ${escapeHtml(resource.name)} has been idle for ${resource.daysSinceUsed ?? 0} days.</div>
      <div class="s">${gap} additional ${unitLabel} may be required · ${resource.utilization || 0}% utilization · ${resource.activationOpportunity || 'Medium'} activation opportunity</div>
    </div>
    <div class="activation-actions"><button class="btn-book" onclick="activateResource('${escapeAttr(resource.id)}')">Activate Resource</button><button class="btn-ghost" onclick="dismissActivation('${escapeAttr(resource.id)}')">Not Now</button></div>
  </div>`;
}

function renderPredictions(){
  document.getElementById('prediction-grid').innerHTML = predictionData.map(prediction=>{
    const supply = predictionSupply(prediction);
    const gap = Math.max(0,prediction.demand-supply);
    const level = gap>=5?'High':gap>0?'Medium':'Low';
    return `<div class="prediction-card ${gap>0?'shortage':''}"><div class="prediction-card-head"><strong>${prediction.name}</strong><span class="status-pill ${gap>0?'idle':'available'}">${level} demand</span></div>
      <div class="prediction-numbers"><div><span>Predicted demand</span><strong>${prediction.demand}</strong></div><div><span>Current supply</span><strong>${supply}</strong></div><div><span>Supply gap</span><strong>${gap}</strong></div></div>
      <div class="prediction-period">${prediction.period} · ${gap>0?'Shortage predicted':'Supply meets demand'}</div></div>`;
  }).join('');
  document.getElementById('gap-list').innerHTML = predictionData.map(prediction=>{
    const gap = predictedGap(prediction);
    const percent = Math.round(gap/prediction.demand*100);
    return `<div class="gap-row ${gap>0?'gap-warning':''}"><div class="cat">${prediction.name}</div><div class="gap-bar-track"><div class="gap-bar-fill" style="width:${percent}%;"></div></div><div class="gap-pct">${gap} short</div></div>`;
  }).join('');
  const idle = getResources().filter(resource=>resourceStatus(resource)==='idle' && predictedGap(predictionForResource(resource))>0);
  document.getElementById('activation-alerts').innerHTML = idle.length ? idle.map(activationCard).join('') : `<div class="empty-alert">No idle resources are currently eligible for activation.</div>`;
}

function activateResource(id){
  const resources = getResources();
  const resource = resources.find(item=>item.id===id);
  if (!resource || resourceStatus(resource)!=='idle') return;
  resource.status = 'available';
  resource.wasActivated = true;
  saveResources(resources);
  refreshEverything();
  showConfirmModal('✅','Resource activated','Resource activated successfully. It is now available for booking.','Activation complete');
}

function dismissActivation(id){
  const resources = getResources();
  const resource = resources.find(item=>item.id===id);
  if (!resource) return;
  resource.status = 'suggested';
  saveResources(resources);
  refreshEverything();
}

function deleteResource(id){
  const list = getResources().filter(r=>r.id !== id);
  saveResources(list);
  refreshEverything();
}

function renderAdminStats(){
  const all = getResources();
  const users = getUsers();
  document.getElementById('admin-total-res').textContent = all.length;
  document.getElementById('admin-verified-count').textContent = Object.values(users).filter(u=>u.verified==='yes').length;
}

function refreshEverything(){
  renderDashMatches();
  const activeChip = document.querySelector('#filter-chips .chip.active');
  renderFind(activeChip ? activeChip.dataset.cat : 'all', document.getElementById('global-search').value);
  renderOwnerList();
  renderAdminStats();
  renderPredictions();
  renderBookings();
}

/* ---------- add-resource modal ---------- */
function openResourceModal(){
  if (!guardVerified()) return;
  document.getElementById('res-name').value = '';
  document.getElementById('res-cat').value = 'equip';
  document.getElementById('res-desc').value = '';
  document.getElementById('res-price').value = '';
  document.getElementById('res-icon').value = '';
  document.getElementById('res-error').textContent = '';
  openModal('resource-modal');
}
function submitResource(){
  const name = document.getElementById('res-name').value.trim();
  const cat = document.getElementById('res-cat').value;
  const desc = document.getElementById('res-desc').value.trim();
  const price = document.getElementById('res-price').value.trim() || 'Free';
  const icon = document.getElementById('res-icon').value.trim() || '📦';
  const err = document.getElementById('res-error');
  err.textContent = '';

  if (!name || !desc){ err.textContent = 'Give it a name and a short description.'; return; }

  const list = getResources();
  list.push({
    id: 'r' + Date.now() + Math.floor(Math.random()*1000),
    name, cat, sub: desc, price, ic: icon,
    bg: pickBg(),
    ownerEmail: currentUser.email, status:'available', utilization:0,
    distanceKm:0.8, condition:'Good', reliability:85, durationDays:1
  });
  saveResources(list);
  closeModal('resource-modal');
  refreshEverything();
  go('owner');
}
document.getElementById('add-resource-btn').addEventListener('click', openResourceModal);

/* ================= NAV ================= */
const views = ['dashboard','find','owner','bookings','admin','verify'];
function go(view){
  views.forEach(v=>document.getElementById('view-'+v).classList.remove('active'));
  document.getElementById('view-'+view).classList.add('active');
  document.querySelectorAll('.nav-item').forEach(n=>n.classList.toggle('active', n.dataset.view===view));
  document.getElementById('sidebar').classList.remove('open');
  window.scrollTo({top:0,behavior:'smooth'});
  if (view==='find') renderFind(document.querySelector('#filter-chips .chip.active')?.dataset.cat || 'all', document.getElementById('global-search').value);
  if (view==='owner') renderOwnerList();
  if (view==='admin') renderAdminStats();
  if (view==='verify') renderVerifyStatus();
}
document.querySelectorAll('.nav-item').forEach(n=>n.addEventListener('click', ()=>go(n.dataset.view)));
document.querySelectorAll('[data-goto]').forEach(n=>n.addEventListener('click', ()=>go(n.dataset.goto)));

document.getElementById('hamburger').addEventListener('click', ()=>{
  document.getElementById('sidebar').classList.toggle('open');
});

/* role switch */
document.getElementById('role-student').addEventListener('click', ()=>{
  document.getElementById('role-student').classList.add('active');
  document.getElementById('role-admin').classList.remove('active');
  document.getElementById('nav-student').style.display='flex';
  document.getElementById('nav-admin').style.display='none';
  go('dashboard');
});
document.getElementById('role-admin').addEventListener('click', ()=>{
  document.getElementById('role-admin').classList.add('active');
  document.getElementById('role-student').classList.remove('active');
  document.getElementById('nav-student').style.display='none';
  document.getElementById('nav-admin').style.display='flex';
  go('admin');
});

/* booking tabs */
document.querySelectorAll('[data-btab]').forEach(b=>{
  b.addEventListener('click', ()=>{
    document.querySelectorAll('[data-btab]').forEach(x=>x.classList.remove('active'));
    b.classList.add('active');
    document.getElementById('bookings-upcoming').style.display = b.dataset.btab==='upcoming'?'block':'none';
    document.getElementById('bookings-past').style.display = b.dataset.btab==='past'?'block':'none';
  });
});

function renderBookings(){
  if (!currentUser) return;
  const bookings = getBookings().filter(booking=>booking.borrowerEmail===currentUser.email);
  const upcoming = bookings.filter(booking=>booking.status==='active');
  const past = bookings.filter(booking=>booking.status==='returned');
  document.getElementById('bookings-upcoming').innerHTML = upcoming.length ? upcoming.map(booking=>`
    <div class="booking-card"><div class="ic" style="background:var(--mint-50);">📅</div><div class="info"><div class="t">${escapeHtml(booking.resourceName)}</div><div class="s">Booked · Resource status: Booked</div></div><div class="actions"><button class="btn-return" onclick="openReturn('${escapeAttr(booking.id)}','${escapeAttr(booking.resourceName)}')">Return</button></div></div>`).join('')
    : `<div class="booking-card"><div class="ic" style="background:var(--mint-50);">📅</div><div class="info"><div class="t">No upcoming bookings</div><div class="s">Resources you book will show up here</div></div></div>`;
  document.getElementById('bookings-past').innerHTML = past.length ? past.map(booking=>`
    <div class="booking-card"><div class="ic" style="background:var(--mint-50);">✅</div><div class="info"><div class="t">${escapeHtml(booking.resourceName)}</div><div class="s">Returned · Resource is available again</div></div></div>`).join('')
    : `<div class="booking-card"><div class="ic" style="background:var(--mint-50);">📅</div><div class="info"><div class="t">No past bookings</div><div class="s">Completed bookings will appear here</div></div></div>`;
}

document.getElementById('notifications-btn').addEventListener('click', ()=>{
  const messages = [];
  const shortages = predictionData.filter(prediction=>predictedGap(prediction)>0);
  if (shortages.length) messages.push(`${shortages[0].name} shortage predicted for next week.`);
  const idleCamera = getResources().find(resource=>resourceStatus(resource)==='idle' && predictionForResource(resource).key==='dslr');
  if (idleCamera) messages.push(`Your idle ${idleCamera.name} can satisfy upcoming demand.`);
  if (getResources().some(resource=>resourceStatus(resource)==='available' && matchScore(resource)>=90)) messages.push('New high-match resource available near you.');
  showConfirmModal('🔔','Smart alerts',messages.join('\n') || 'No new smart alerts.','Campus notifications');
});

/* ================= MODALS ================= */
function openModal(id){ document.getElementById(id).classList.add('open'); }
function closeModal(id){
  document.getElementById(id).classList.remove('open');
  if (document.getElementById('bm-confirm')) document.getElementById('bm-confirm').style.display='none';
  document.querySelector('#booking-modal .modal > *:not(.modal-head):not(#bm-confirm)') && showBookingForm();
  if (document.getElementById('rm-confirm')) document.getElementById('rm-confirm').style.display='none';
}
let activeBookingResourceId = null;
let activeReturnBookingId = null;
function openBooking(id, name, ic, sub){
  if (!guardVerified()) return;
  activeBookingResourceId = id;
  document.getElementById('bm-name').textContent = name;
  document.getElementById('bm-ic').textContent = ic;
  document.getElementById('bm-sub').textContent = sub + ' · Available now';
  document.getElementById('bm-title').textContent = 'Book resource';
  showBookingForm();
  openModal('booking-modal');
}
function showBookingForm(){
  document.querySelectorAll('#booking-modal .f-label, #booking-modal .f-input, #booking-modal .btn-primary, #booking-modal .modal-res').forEach(el=>el.style.display='');
  document.getElementById('bm-confirm').style.display='none';
}
function showBookingConfirm(){
  const resources = getResources();
  const resource = resources.find(item=>item.id===activeBookingResourceId);
  if (!resource || resourceStatus(resource)!=='available'){
    closeModal('booking-modal');
    showConfirmModal('⚠️','Resource unavailable','This resource is no longer available. Refresh the results and choose another match.','Booking not completed');
    return;
  }
  resource.status = 'booked';
  resource.utilization = Math.min(100,(resource.utilization || 0)+5);
  saveResources(resources);
  const bookings = getBookings();
  bookings.push({id:'b'+Date.now(),resourceId:resource.id,resourceName:resource.name,borrowerEmail:currentUser.email,ownerEmail:resource.ownerEmail,status:'active'});
  saveBookings(bookings);
  document.querySelectorAll('#booking-modal .f-label, #booking-modal .f-input, #booking-modal .btn-primary, #booking-modal .modal-res').forEach(el=>el.style.display='none');
  document.getElementById('bm-confirm').style.display='block';
  refreshEverything();
}
function openReturn(bookingId,name){
  activeReturnBookingId = bookingId;
  document.getElementById('rm-name').textContent = name;
  document.querySelectorAll('#return-modal .step-row, #return-modal .btn-primary, #return-modal .modal-res').forEach(el=>el.style.display='');
  document.getElementById('rm-confirm').style.display='none';
  openModal('return-modal');
}
function toggleStep(el){ el.classList.toggle('done'); }
function showReturnConfirm(){
  const bookings = getBookings();
  const booking = bookings.find(item=>item.id===activeReturnBookingId);
  if (booking){
    booking.status = 'returned';
    const resources = getResources();
    const resource = resources.find(item=>item.id===booking.resourceId);
    if (resource){
      resource.status = 'available';
      resource.lastUsedAt = Date.now();
      resource.daysSinceUsed = 0;
    }
    saveBookings(bookings);
    saveResources(resources);
  }
  document.querySelectorAll('#return-modal .step-row, #return-modal .btn-primary, #return-modal .modal-res').forEach(el=>el.style.display='none');
  document.getElementById('rm-confirm').style.display='block';
  refreshEverything();
}
function showConfirmModal(icon, heading, body, title){
  document.getElementById('confirm-modal-title').textContent = title || 'Submitted';
  document.getElementById('confirm-modal-ic').textContent = icon || '✅';
  document.getElementById('confirm-modal-h4').textContent = heading || 'Done';
  document.getElementById('confirm-modal-p').textContent = body || '';
  openModal('confirm-modal');
}

document.querySelectorAll('.modal-overlay').forEach(ov=>{
  ov.addEventListener('click', (e)=>{ if(e.target===ov) ov.classList.remove('open'); });
});

/* ================= BOOT ================= */
(function boot(){
  const email = getSessionEmail();
  const users = getUsers();
  if (email && users[email]){
    currentUser = users[email];
    ensureDemoResources();
    document.getElementById('auth-overlay').style.display = 'none';
    document.getElementById('app-root').style.display = 'flex';
    renderUserSidebar();
    renderVerifyStatus();
    refreshEverything();
  } else {
    document.getElementById('auth-overlay').style.display = 'flex';
    document.getElementById('app-root').style.display = 'none';
  }
})();
