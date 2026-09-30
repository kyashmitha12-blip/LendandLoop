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

const API_BASE = '/api';
const state = {
  currentUser: null,
  resources: [],
  bookings: [],
  notifications: [],
  analytics: {}
};

const USERS_KEY = 'll_users';
const SESSION_KEY = 'll_session';
const RESOURCES_KEY = 'll_resources';
const BOOKINGS_KEY = 'll_bookings';

function getUsers(){
  try { return JSON.parse(localStorage.getItem(USERS_KEY)) || {}; }
  catch { return {}; }
}
function saveUsers(users){ localStorage.setItem(USERS_KEY, JSON.stringify(users)); }
function getSessionEmail(){ return localStorage.getItem(SESSION_KEY); }
function setSessionEmail(email){ localStorage.setItem(SESSION_KEY, email); }
function clearSession(){ localStorage.removeItem(SESSION_KEY); sessionStorage.removeItem('ll_token'); }
function getResources(){ return state.resources.length ? state.resources : (JSON.parse(localStorage.getItem(RESOURCES_KEY) || '[]')); }
function saveResources(list){
  state.resources = list;
  localStorage.setItem(RESOURCES_KEY, JSON.stringify(list));
}
function getBookings(){ return state.bookings.length ? state.bookings : (JSON.parse(localStorage.getItem(BOOKINGS_KEY) || '[]')); }
function saveBookings(list){
  state.bookings = list;
  localStorage.setItem(BOOKINGS_KEY, JSON.stringify(list));
}

function getSessionToken(){ return sessionStorage.getItem('ll_token'); }
function setSessionToken(token){
  if (token) sessionStorage.setItem('ll_token', token);
  else sessionStorage.removeItem('ll_token');
}

async function apiFetch(endpoint, options = {}){
  const token = getSessionToken();
  const headers = { ...(options.headers || {}) };
  if (!(options.body instanceof FormData)) {
    headers['Content-Type'] = headers['Content-Type'] || 'application/json';
  }
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers
  });

  const raw = await response.text();
  let data = {};
  try { data = raw ? JSON.parse(raw) : {}; }
  catch { data = { error: raw || 'Request failed' }; }

  if (!response.ok) {
    throw new Error(data.error || 'Request failed');
  }

  return data;
}

function normalizeUser(user){
  if (!user) return null;
  return {
    ...user,
    verified: user.verification_status || user.verified || 'no'
  };
}

function normalizeResource(resource){
  if (!resource) return null;
  return {
    ...resource,
    id: String(resource.id),
    ownerEmail: resource.ownerEmail || resource.owner_email,
    sub: resource.sub || resource.description,
    cat: resource.cat || resource.category,
    price: resource.price || resource.price_per_day,
    ic: resource.ic || resource.icon,
    bg: resource.bg || resource.color,
    distanceKm: resource.distanceKm ?? resource.distance_km ?? 1,
    condition: resource.condition || 'Good',
    reliability: resource.reliability ?? 90,
    durationDays: resource.durationDays ?? resource.duration_days ?? 1,
    status: resource.status || 'available'
  };
}

function resourceStatus(resource){ return resource?.status || 'available'; }
function predictionForResource(resource){
  const name = `${resource.name || ''} ${resource.sub || ''}`.toLowerCase();
  if (/dslr|camera/.test(name)) return { key: 'dslr', name: 'DSLR Camera', demand: 8, supply: 6, period: 'Next 7 days' };
  if (/arduino/.test(name)) return { key: 'arduino', name: 'Arduino Kit', demand: 15, supply: 10, period: 'Next 7 days' };
  if (/microphone|mic\b/.test(name)) return { key: 'microphone', name: 'Microphone', demand: 9, supply: 4, period: 'Next 7 days' };
  if (/tripod/.test(name)) return { key: 'tripod', name: 'Tripod', demand: 7, supply: 3, period: 'Next 7 days' };
  return { key: 'projector', name: 'Projector', demand: 12, supply: 5, period: 'Next 7 days' };
}
function predictedGap(prediction){ return Math.max(0, prediction.demand - prediction.supply); }
function matchScore(resource){
  const availability = resourceStatus(resource) === 'available' ? 12 : 0;
  const condition = resource.condition === 'Excellent' ? 12 : resource.condition === 'Good' ? 8 : 3;
  const distance = Number(resource.distanceKm || 1) <= 1 ? 8 : Number(resource.distanceKm || 1) <= 1.5 ? 6 : Number(resource.distanceKm || 1) <= 3 ? 3 : 0;
  const priceValue = Number(String(resource.price || '').replace(/[^\d]/g, '')) || 0;
  const price = priceValue <= 60 ? 8 : priceValue <= 120 ? 6 : priceValue <= 150 ? 4 : 1;
  const duration = (resource.durationDays || 1) <= 3 ? 3 : -2;
  return Math.min(99, Math.round(50 + availability + condition + distance + price + duration + (resource.reliability || 85) * 0.1));
}

async function hydrateSession(){
  const token = getSessionToken();
  if (!token) {
    state.currentUser = null;
    state.resources = [];
    state.bookings = [];
    state.notifications = [];
    state.analytics = {};
    return;
  }

  try {
    const me = await apiFetch('/auth/me');
    state.currentUser = normalizeUser(me.user);
  } catch (error) {
    clearSession();
    state.currentUser = null;
    return;
  }

  try {
    const resourcesRes = await apiFetch('/resources');
    state.resources = (resourcesRes.resources || []).map(normalizeResource);
    saveResources(state.resources);
  } catch (error) {
    state.resources = [];
  }

  try {
    const bookingData = await apiFetch('/bookings/my');
    state.bookings = bookingData.bookings || [];
    saveBookings(state.bookings);
  } catch (error) {
    state.bookings = [];
  }

  try {
    const notificationsData = await apiFetch('/notifications');
    state.notifications = notificationsData.notifications || [];
  } catch (error) {
    state.notifications = [];
  }

  if (state.currentUser && state.currentUser.role === 'admin') {
    try {
      const analyticsData = await apiFetch('/admin/analytics');
      state.analytics = analyticsData || {};
    } catch (error) {
      state.analytics = {};
    }
  }
}

function switchAuthTab(tab){
  document.getElementById('atab-login').classList.toggle('active', tab === 'login');
  document.getElementById('atab-signup').classList.toggle('active', tab === 'signup');
  document.getElementById('auth-login').style.display = tab === 'login' ? 'block' : 'none';
  document.getElementById('auth-signup').style.display = tab === 'signup' ? 'block' : 'none';
  document.getElementById('login-error').textContent = '';
  document.getElementById('signup-error').textContent = '';
}

document.getElementById('atab-login').addEventListener('click', () => switchAuthTab('login'));
document.getElementById('atab-signup').addEventListener('click', () => switchAuthTab('signup'));

async function handleSignup(){
  const name = document.getElementById('signup-name').value.trim();
  const email = document.getElementById('signup-email').value.trim().toLowerCase();
  const password = document.getElementById('signup-password').value;
  const err = document.getElementById('signup-error');
  err.textContent = '';

  if (!name || !email || !password) { err.textContent = 'Fill in all fields.'; return; }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { err.textContent = 'Enter a valid email address.'; return; }
  if (password.length < 6) { err.textContent = 'Password must be at least 6 characters.'; return; }

  try {
    const result = await apiFetch('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ name, email, password })
    });
    setSessionEmail(email);
    setSessionToken(result.token);
    state.currentUser = normalizeUser(result.user);
    document.getElementById('signup-name').value = '';
    document.getElementById('signup-email').value = '';
    document.getElementById('signup-password').value = '';
    await enterApp();
  } catch (error) {
    err.textContent = error.message;
  }
}

async function handleLogin(){
  const email = document.getElementById('login-email').value.trim().toLowerCase();
  const password = document.getElementById('login-password').value;
  const err = document.getElementById('login-error');
  err.textContent = '';

  if (!email || !password) { err.textContent = 'Enter your email and password.'; return; }

  try {
    const result = await apiFetch('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    });
    setSessionEmail(email);
    setSessionToken(result.token);
    state.currentUser = normalizeUser(result.user);
    document.getElementById('login-password').value = '';
    await enterApp();
  } catch (error) {
    err.textContent = error.message;
  }
}

async function handleLogout(){
  try { await apiFetch('/auth/logout', { method: 'POST' }); } catch (error) {}
  clearSession();
  state.currentUser = null;
  state.resources = [];
  state.bookings = [];
  state.notifications = [];
  state.analytics = {};
  document.getElementById('app-root').style.display = 'none';
  document.getElementById('auth-overlay').style.display = 'flex';
  document.getElementById('login-email').value = '';
  document.getElementById('login-password').value = '';
  switchAuthTab('login');
}

async function enterApp(){
  await hydrateSession();
  if (!state.currentUser) {
    document.getElementById('auth-overlay').style.display = 'flex';
    document.getElementById('app-root').style.display = 'none';
    return;
  }

  document.getElementById('auth-overlay').style.display = 'none';
  document.getElementById('app-root').style.display = 'flex';
  renderUserSidebar();
  renderVerifyStatus();
  refreshEverything();
  go('dashboard');
}

function renderUserSidebar(){
  const user = state.currentUser;
  if (!user) return;
  document.getElementById('user-name').textContent = user.name;
  document.getElementById('user-avatar').textContent = user.name.trim().charAt(0).toUpperCase() || '👤';
  const subMap = { no: 'Not verified', pending: 'Verification pending', yes: 'Verified student' };
  document.getElementById('user-sub').textContent = subMap[user.verified] || 'Not verified';
  document.getElementById('dash-greeting').textContent = 'Welcome, ' + user.name.split(' ')[0];
  document.getElementById('verify-alert').style.display = user.verified === 'yes' ? 'none' : 'flex';
}

function renderVerifyStatus(){
  const verifiedBox = document.getElementById('verify-status-verified');
  const pendingBox = document.getElementById('verify-status-pending');
  const formCard = document.getElementById('verify-form-card');
  const status = state.currentUser ? (state.currentUser.verification_status || state.currentUser.verified || 'no') : 'no';

  verifiedBox.style.display = 'none';
  pendingBox.style.display = 'none';
  formCard.style.display = 'block';

  if (status === 'yes') {
    verifiedBox.style.display = 'flex';
    formCard.style.display = 'none';
  } else if (status === 'pending') {
    pendingBox.style.display = 'flex';
    formCard.style.display = 'none';
  }
}

async function submitVerification(){
  const name = document.getElementById('verify-name').value.trim();
  const studentId = document.getElementById('verify-card').value.trim();
  const photoInput = document.getElementById('verify-photo');
  const err = document.getElementById('verify-error');
  err.textContent = '';

  if (!name || !studentId) {
    err.textContent = 'Enter your name and campus card number.';
    return;
  }
  if (!photoInput.files || !photoInput.files[0]) {
    err.textContent = 'Upload a photo of your campus card.';
    return;
  }

  try {
    const formData = new FormData();
    formData.append('student_id', studentId);
    formData.append('document', photoInput.files[0]);
    await apiFetch('/verification/submit', {
      method: 'POST',
      body: formData
    });
    await hydrateSession();
    renderVerifyStatus();
    renderUserSidebar();
    showConfirmModal('🛡️', 'Under review', "Your verification request has been submitted. An admin will approve it in the dashboard queue.", 'Verification submitted');
  } catch (error) {
    err.textContent = error.message;
  }
}

function guardVerified(){
  if (!state.currentUser || (state.currentUser.verification_status || state.currentUser.verified || 'no') !== 'yes') {
    alert('You need to be a verified student to do this. Head to the Verification tab and submit your student ID.');
    go('verify');
    return false;
  }
  return true;
}

const bgPalette = ['#EAF4EE', '#FFE4DC', '#FCEFD2', '#E4ECFB', '#CFEBDA'];
function pickBg(){ return bgPalette[Math.floor(Math.random() * bgPalette.length)]; }
const catLabel = { equip: 'Equipment', books: 'Books', space: 'Spaces', skill: 'Skills' };
const predictionData = [
  { key: 'projector', name: 'Projector', demand: 12, supply: 5, period: 'Next 7 days' },
  { key: 'dslr', name: 'DSLR Camera', demand: 8, supply: 6, period: 'Next 7 days' },
  { key: 'arduino', name: 'Arduino Kit', demand: 15, supply: 10, period: 'Next 7 days' },
  { key: 'microphone', name: 'Microphone', demand: 9, supply: 4, period: 'Next 7 days' },
  { key: 'tripod', name: 'Tripod', demand: 7, supply: 3, period: 'Next 7 days' }
];

function emptyState(msg){
  return `<div style="grid-column:1/-1;text-align:center;padding:40px 20px;color:var(--ink-400);font-size:13px;">${msg}</div>`;
}
function escapeHtml(value){
  return String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
}
function escapeAttr(value){ return String(value).replace(/'/g, ''); }

function resCard(resource){
  const status = resourceStatus(resource);
  const bookable = status === 'available';
  return `<div class="res-card">
    <div class="thumb" style="background:${resource.bg || '#EAF4EE'};">${resource.ic || '📦'}</div>
    <div class="body">
      <div class="t">${escapeHtml(resource.name)}</div>
      <div class="s">${escapeHtml(resource.sub || resource.description || '')}</div>
      <div class="match-details"><span class="match-score">${matchScore(resource)}% Match</span><span class="status-pill ${status}">${status === 'idle' ? 'Idle' : status[0].toUpperCase() + status.slice(1)}</span></div>
      <div class="resource-meta">${Number(resource.distanceKm || 1).toFixed(1)} km · ${escapeHtml(resource.condition || 'Good')} condition · ${resource.reliability || 85}% reliable</div>
      <div class="row"><span class="price">${escapeHtml(resource.price || 'Free')}</span><button class="btn-book" ${bookable ? '' : 'disabled'} onclick="openBooking('${escapeAttr(resource.id)}','${escapeAttr(resource.name)}','${escapeAttr(resource.ic || '📦')}','${escapeAttr(resource.sub || resource.description || '')}')">${bookable ? 'Book' : 'Unavailable'}</button></div>
    </div>
  </div>`;
}

function renderDashMatches(){
  const all = getResources();
  const me = state.currentUser;
  const others = all.filter((resource) => resource.ownerEmail !== me.email && resourceStatus(resource) === 'available')
    .sort((a, b) => matchScore(b) - matchScore(a))
    .slice(0, 3);

  document.getElementById('dash-matches').innerHTML = others.length ? others.map(resCard).join('') : emptyState('No matches yet');
  document.getElementById('stat-shared').textContent = all.filter((resource) => resource.ownerEmail === me.email).length;
  const activeBookings = getBookings().filter((booking) => booking.borrower_id === me.id && booking.status === 'active');
  document.getElementById('stat-bookings').textContent = activeBookings.length;
  document.getElementById('dash-shortages').textContent = predictionData.filter((p) => predictedGap(p) > 0).length;
  document.getElementById('dash-idle').textContent = all.filter((resource) => resourceStatus(resource) === 'idle').length;
  document.getElementById('dash-opportunities').textContent = all.filter((resource) => resourceStatus(resource) === 'idle' && predictedGap(predictionForResource(resource)) > 0).length;
}

function renderFind(cat = 'all', query = ''){
  const list = getResources().filter((resource) => {
    const categoryMatches = cat === 'all' || (resource.cat || resource.category) === cat;
    const searchText = `${resource.name} ${resource.sub || resource.description || ''} ${catLabel[resource.cat || resource.category] || ''}`.toLowerCase();
    const queryMatches = !query || searchText.includes(query.toLowerCase());
    return categoryMatches && queryMatches;
  }).sort((a, b) => matchScore(b) - matchScore(a));

  document.getElementById('find-grid').innerHTML = list.length ? list.map(resCard).join('') : emptyState('No resources found');
}

document.querySelectorAll('#filter-chips .chip').forEach((chip) => {
  chip.addEventListener('click', () => {
    document.querySelectorAll('#filter-chips .chip').forEach((item) => item.classList.remove('active'));
    chip.classList.add('active');
    renderFind(chip.dataset.cat, document.getElementById('global-search').value);
  });
});

document.getElementById('global-search').addEventListener('input', (event) => {
  renderFind(document.querySelector('#filter-chips .chip.active')?.dataset.cat || 'all', event.target.value);
});

document.getElementById('global-search').addEventListener('keydown', (event) => {
  if (event.key === 'Enter') go('find');
});

function activationCard(resource){
  const prediction = predictionForResource(resource);
  const gap = predictedGap(prediction);
  const level = gap >= 5 ? 'High' : 'Medium';
  return `<div class="activation-card">
    <div class="activation-copy"><div class="t">${level} demand for ${escapeHtml(prediction.name)} predicted.</div>
      <div class="s">Your ${escapeHtml(resource.name)} has been idle and may be needed soon.</div>
      <div class="s">${gap} additional resources may be required · ${resource.utilization || 0}% utilization</div>
    </div>
    <div class="activation-actions"><button class="btn-book" onclick="activateResource('${escapeAttr(resource.id)}')">Activate Resource</button><button class="btn-ghost" onclick="dismissActivation('${escapeAttr(resource.id)}')">Not Now</button></div>
  </div>`;
}

function ownerRow(resource){
  const status = resourceStatus(resource);
  const prediction = predictionForResource(resource);
  return `<div class="owner-row">
    <div class="ic" style="background:${resource.bg || '#EAF4EE'};">${resource.ic || '📦'}</div>
    <div class="info"><div class="t">${escapeHtml(resource.name)}</div><div class="s">${catLabel[resource.cat || resource.category] || resource.category} · ${escapeHtml(resource.price || 'Free')} · ${resource.utilization || 0}% utilized · Predicted demand ${prediction.demand}</div></div>
    <div class="row-actions">
      <span class="status-pill ${status}">${status === 'idle' ? 'Idle' : status[0].toUpperCase() + status.slice(1)}</span>
      ${status === 'idle' && predictedGap(prediction) > 0 ? `<button class="btn-book" onclick="activateResource('${escapeAttr(resource.id)}')">Activate</button>` : ''}
      <button class="icon-del" title="Remove listing" onclick="deleteResource('${resource.id}')">✕</button>
    </div>
  </div>`;
}

function renderOwnerList(){
  const mine = getResources().filter((resource) => resource.ownerEmail === state.currentUser.email || resource.owner_id === state.currentUser.id);
  const idle = mine.filter((resource) => resourceStatus(resource) === 'idle');
  document.getElementById('idle-resource-list').innerHTML = idle.length ? idle.map(activationCard).join('') : `<div class="idle-card"><span class="ic">✓</span><div><div class="t">No idle resources detected</div><div class="s">Available and booked resources are reflected in your listings below.</div></div></div>`;
  document.getElementById('owner-list').innerHTML = mine.length ? mine.map(ownerRow).join('') : `<div class="owner-row"><div class="ic" style="background:var(--mint-50);">📦</div><div class="info"><div class="t">No resources listed yet</div><div class="s">Add a resource to start lending it out</div></div></div>`;
}

function renderPredictions(){
  document.getElementById('prediction-grid').innerHTML = predictionData.map((prediction) => {
    const supply = prediction.supply;
    const gap = Math.max(0, prediction.demand - supply);
    const level = gap >= 5 ? 'High' : gap > 0 ? 'Medium' : 'Low';
    return `<div class="prediction-card ${gap > 0 ? 'shortage' : ''}"><div class="prediction-card-head"><strong>${prediction.name}</strong><span class="status-pill ${gap > 0 ? 'idle' : 'available'}">${level} demand</span></div>
      <div class="prediction-numbers"><div><span>Predicted demand</span><strong>${prediction.demand}</strong></div><div><span>Current supply</span><strong>${supply}</strong></div><div><span>Supply gap</span><strong>${gap}</strong></div></div>
      <div class="prediction-period">${prediction.period} · ${gap > 0 ? 'Shortage predicted' : 'Supply meets demand'}</div></div>`;
  }).join('');

  document.getElementById('gap-list').innerHTML = predictionData.map((prediction) => {
    const gap = predictedGap(prediction);
    const percent = Math.round((gap / prediction.demand) * 100 || 0);
    return `<div class="gap-row ${gap > 0 ? 'gap-warning' : ''}"><div class="cat">${prediction.name}</div><div class="gap-bar-track"><div class="gap-bar-fill" style="width:${percent}%;"></div></div><div class="gap-pct">${gap} short</div></div>`;
  }).join('');

  const idle = getResources().filter((resource) => resourceStatus(resource) === 'idle' && predictedGap(predictionForResource(resource)) > 0);
  document.getElementById('activation-alerts').innerHTML = idle.length ? idle.map(activationCard).join('') : '<div class="empty-alert">No idle resources are currently eligible for activation.</div>';
}

async function activateResource(id){
  try {
    await apiFetch(`/resources/${id}/activate`, { method: 'POST' });
    await hydrateSession();
    renderUserSidebar();
    refreshEverything();
    showConfirmModal('✅', 'Resource activated', 'Resource activated successfully. It is now available for booking.', 'Activation complete');
  } catch (error) {
    showConfirmModal('⚠️', 'Activation failed', error.message, 'Try again');
  }
}

function dismissActivation(id){
  const resource = getResources().find((item) => item.id === String(id));
  if (!resource) return;
  resource.status = 'suggested';
  saveResources(getResources());
  refreshEverything();
}

async function deleteResource(id){
  try {
    await apiFetch(`/resources/${id}`, { method: 'DELETE' });
    await hydrateSession();
    refreshEverything();
  } catch (error) {
    showConfirmModal('⚠️', 'Delete failed', error.message, 'Try again');
  }
}

function renderAdminStats(){
  const all = getResources();
  const analytics = state.analytics || {};
  document.getElementById('admin-total-res').textContent = all.length || analytics.total_resources || 0;
  document.getElementById('admin-verified-count').textContent = analytics.verified_students || Object.values(getUsers()).filter((user) => user.verified === 'yes').length || 0;
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

async function submitResource(){
  const name = document.getElementById('res-name').value.trim();
  const cat = document.getElementById('res-cat').value;
  const desc = document.getElementById('res-desc').value.trim();
  const price = document.getElementById('res-price').value.trim() || 'Free';
  const icon = document.getElementById('res-icon').value.trim() || '📦';
  const err = document.getElementById('res-error');
  err.textContent = '';

  if (!name || !desc) {
    err.textContent = 'Give it a name and a short description.';
    return;
  }

  try {
    await apiFetch('/resources', {
      method: 'POST',
      body: JSON.stringify({
        name,
        category: cat,
        description: desc,
        price_per_day: price,
        deposit: '',
        condition: 'Good',
        location: 'Campus',
        icon,
        color: pickBg(),
        status: 'available'
      })
    });
    closeModal('resource-modal');
    await hydrateSession();
    refreshEverything();
    go('owner');
  } catch (error) {
    err.textContent = error.message;
  }
}

document.getElementById('add-resource-btn').addEventListener('click', openResourceModal);

const views = ['dashboard', 'find', 'owner', 'bookings', 'admin', 'verify'];
function go(view){
  views.forEach((item) => document.getElementById('view-' + item).classList.remove('active'));
  document.getElementById('view-' + view).classList.add('active');
  document.querySelectorAll('.nav-item').forEach((navItem) => navItem.classList.toggle('active', navItem.dataset.view === view));
  document.getElementById('sidebar').classList.remove('open');
  window.scrollTo({ top: 0, behavior: 'smooth' });
  if (view === 'find') renderFind(document.querySelector('#filter-chips .chip.active')?.dataset.cat || 'all', document.getElementById('global-search').value);
  if (view === 'owner') renderOwnerList();
  if (view === 'admin') renderAdminStats();
  if (view === 'verify') renderVerifyStatus();
}

document.querySelectorAll('.nav-item').forEach((item) => item.addEventListener('click', () => go(item.dataset.view)));
document.querySelectorAll('[data-goto]').forEach((item) => item.addEventListener('click', () => go(item.dataset.goto)));

document.getElementById('hamburger').addEventListener('click', () => {
  document.getElementById('sidebar').classList.toggle('open');
});

document.getElementById('role-student').addEventListener('click', () => {
  document.getElementById('role-student').classList.add('active');
  document.getElementById('role-admin').classList.remove('active');
  document.getElementById('nav-student').style.display = 'flex';
  document.getElementById('nav-admin').style.display = 'none';
  go('dashboard');
});

document.getElementById('role-admin').addEventListener('click', () => {
  document.getElementById('role-admin').classList.add('active');
  document.getElementById('role-student').classList.remove('active');
  document.getElementById('nav-student').style.display = 'none';
  document.getElementById('nav-admin').style.display = 'flex';
  go('admin');
});

document.querySelectorAll('[data-btab]').forEach((button) => {
  button.addEventListener('click', () => {
    document.querySelectorAll('[data-btab]').forEach((item) => item.classList.remove('active'));
    button.classList.add('active');
    document.getElementById('bookings-upcoming').style.display = button.dataset.btab === 'upcoming' ? 'block' : 'none';
    document.getElementById('bookings-past').style.display = button.dataset.btab === 'past' ? 'block' : 'none';
  });
});

function renderBookings(){
  if (!state.currentUser) return;
  const bookings = getBookings().filter((booking) => booking.borrower_id === state.currentUser.id || booking.borrowerEmail === state.currentUser.email);
  const upcoming = bookings.filter((booking) => booking.status === 'active');
  const past = bookings.filter((booking) => booking.status === 'returned');
  document.getElementById('bookings-upcoming').innerHTML = upcoming.length ? upcoming.map((booking) => `
    <div class="booking-card"><div class="ic" style="background:var(--mint-50);">📅</div><div class="info"><div class="t">${escapeHtml(booking.resource_name || booking.resourceName || 'Resource')}</div><div class="s">Booked · Resource status: ${booking.status}</div></div><div class="actions"><button class="btn-return" onclick="openReturn('${escapeAttr(booking.id)}','${escapeAttr(booking.resource_name || booking.resourceName || 'Resource')}')">Return</button></div></div>`).join('') : `<div class="booking-card"><div class="ic" style="background:var(--mint-50);">📅</div><div class="info"><div class="t">No upcoming bookings</div><div class="s">Resources you book will show up here</div></div></div>`;
  document.getElementById('bookings-past').innerHTML = past.length ? past.map((booking) => `
    <div class="booking-card"><div class="ic" style="background:var(--mint-50);">✅</div><div class="info"><div class="t">${escapeHtml(booking.resource_name || booking.resourceName || 'Resource')}</div><div class="s">Returned · Resource is available again</div></div></div>`).join('') : `<div class="booking-card"><div class="ic" style="background:var(--mint-50);">📅</div><div class="info"><div class="t">No past bookings</div><div class="s">Completed bookings will appear here</div></div></div>`;
}

document.getElementById('notifications-btn').addEventListener('click', () => {
  const messages = state.notifications.slice(0, 3).map((item) => item.message);
  showConfirmModal('🔔', 'Smart alerts', messages.length ? messages.join('\n') : 'No new smart alerts.', 'Campus notifications');
});

function openModal(id){ document.getElementById(id).classList.add('open'); }
function closeModal(id){ document.getElementById(id).classList.remove('open'); }

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
  document.querySelectorAll('#booking-modal .f-label, #booking-modal .f-input, #booking-modal .btn-primary, #booking-modal .modal-res').forEach((el) => { el.style.display = ''; });
  document.getElementById('bm-confirm').style.display = 'none';
}

async function showBookingConfirm(){
  const resource = getResources().find((item) => item.id === String(activeBookingResourceId));
  if (!resource || resourceStatus(resource) !== 'available') {
    closeModal('booking-modal');
    showConfirmModal('⚠️', 'Resource unavailable', 'This resource is no longer available. Refresh the results and choose another match.', 'Booking not completed');
    return;
  }

  try {
    await apiFetch('/bookings', {
      method: 'POST',
      body: JSON.stringify({
        resource_id: Number(activeBookingResourceId),
        pickup_point: 'Main campus hub',
        price: resource.price || 'Free',
        deposit: ''
      })
    });
    document.querySelectorAll('#booking-modal .f-label, #booking-modal .f-input, #booking-modal .btn-primary, #booking-modal .modal-res').forEach((el) => { el.style.display = 'none'; });
    document.getElementById('bm-confirm').style.display = 'block';
    await hydrateSession();
    refreshEverything();
  } catch (error) {
    showConfirmModal('⚠️', 'Booking failed', error.message, 'Try again');
  }
}

function openReturn(bookingId, name){
  activeReturnBookingId = bookingId;
  document.getElementById('rm-name').textContent = name;
  document.querySelectorAll('#return-modal .step-row, #return-modal .btn-primary, #return-modal .modal-res').forEach((el) => { el.style.display = ''; });
  document.getElementById('rm-confirm').style.display = 'none';
  openModal('return-modal');
}

function toggleStep(el){ el.classList.toggle('done'); }

async function showReturnConfirm(){
  if (!activeReturnBookingId) return;
  try {
    await apiFetch(`/bookings/${activeReturnBookingId}/return`, { method: 'POST' });
    document.querySelectorAll('#return-modal .step-row, #return-modal .btn-primary, #return-modal .modal-res').forEach((el) => { el.style.display = 'none'; });
    document.getElementById('rm-confirm').style.display = 'block';
    await hydrateSession();
    refreshEverything();
  } catch (error) {
    showConfirmModal('⚠️', 'Return failed', error.message, 'Try again');
  }
}

function showConfirmModal(icon, heading, body, title){
  document.getElementById('confirm-modal-title').textContent = title || 'Submitted';
  document.getElementById('confirm-modal-ic').textContent = icon || '✅';
  document.getElementById('confirm-modal-h4').textContent = heading || 'Done';
  document.getElementById('confirm-modal-p').textContent = body || '';
  openModal('confirm-modal');
}

document.querySelectorAll('.modal-overlay').forEach((overlay) => {
  overlay.addEventListener('click', (event) => {
    if (event.target === overlay) overlay.classList.remove('open');
  });
});

(async function boot(){
  const token = getSessionToken();
  if (token) {
    await enterApp();
  } else {
    document.getElementById('auth-overlay').style.display = 'flex';
    document.getElementById('app-root').style.display = 'none';
  }
})();
