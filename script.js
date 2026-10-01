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
  analytics: {},
  predictions: []   // live from /api/predictions
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
  const predictions = getPredictions();
  if (/dslr|camera/.test(name)) return predictions.find(p => p.key === 'dslr') || predictions[0];
  if (/arduino/.test(name)) return predictions.find(p => p.key === 'arduino') || predictions[0];
  if (/microphone|mic\b/.test(name)) return predictions.find(p => p.key === 'microphone') || predictions[0];
  if (/tripod/.test(name)) return predictions.find(p => p.key === 'tripod') || predictions[0];
  return predictions.find(p => p.key === 'projector') || predictions[0];
}
function predictedGap(prediction){
  // Use pre-computed gap from API if available, otherwise calculate
  if (prediction.gap !== undefined) return prediction.gap;
  return Math.max(0, (prediction.demand || 0) - (prediction.supply || 0));
}
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

  try {
    const predictData = await apiFetch('/predictions');
    state.predictions = (predictData.predictions || []).map(p => ({
      key: p.resource_category,
      name: p.display_name || p.resource_category,
      demand: p.predicted_demand,
      supply: p.current_supply,
      gap: p.supply_gap,
      level: p.demand_level,
      period: p.prediction_period || 'Next 7 days'
    }));
  } catch (error) {
    // Keep existing predictions on error
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

function switchPortal(portal){
  const studentBtn = document.getElementById('ptab-student');
  const adminBtn = document.getElementById('ptab-admin');
  const studentSec = document.getElementById('portal-student-section');
  const adminSec = document.getElementById('portal-admin-section');
  
  if (portal === 'admin') {
    adminBtn.classList.add('active');
    adminBtn.style.background = 'var(--green-500)';
    adminBtn.style.color = '#fff';
    studentBtn.classList.remove('active');
    studentBtn.style.background = 'transparent';
    studentBtn.style.color = 'var(--ink-600)';
    adminSec.style.display = 'block';
    studentSec.style.display = 'none';
  } else {
    studentBtn.classList.add('active');
    studentBtn.style.background = 'var(--green-500)';
    studentBtn.style.color = '#fff';
    adminBtn.classList.remove('active');
    adminBtn.style.background = 'transparent';
    adminBtn.style.color = 'var(--ink-600)';
    studentSec.style.display = 'block';
    adminSec.style.display = 'none';
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

async function handleAdminLogin(){
  const email = document.getElementById('admin-login-email').value.trim().toLowerCase();
  const password = document.getElementById('admin-login-password').value;
  const err = document.getElementById('admin-login-error');
  err.textContent = '';

  if (!email || !password) { err.textContent = 'Enter admin email and password.'; return; }

  try {
    const result = await apiFetch('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    });
    
    if (result.user.role !== 'admin') {
      throw new Error('Access denied: This account does not have Campus Administrator privileges.');
    }
    
    setSessionEmail(email);
    setSessionToken(result.token);
    state.currentUser = normalizeUser(result.user);
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

  if (state.currentUser.role === 'admin') {
    go('admin');
  } else {
    go('dashboard');
  }
}

function renderUserSidebar(){
  const user = state.currentUser;
  if (!user) return;
  document.getElementById('user-name').textContent = user.name;
  document.getElementById('user-avatar').textContent = user.name.trim().charAt(0).toUpperCase() || '👤';

  const roleBadge = document.getElementById('role-badge-text');
  const navStudent = document.getElementById('nav-student');
  const navAdmin = document.getElementById('nav-admin');

  if (user.role === 'admin') {
    if (roleBadge) {
      roleBadge.textContent = '🛡️ Campus Administrator';
      roleBadge.style.color = 'var(--coral-500)';
    }
    if (navAdmin) navAdmin.style.display = 'flex';
    if (navStudent) navStudent.style.display = 'none';
    document.getElementById('user-sub').textContent = 'Administrator';
    document.getElementById('dash-greeting').textContent = 'Admin Console · ' + user.name.split(' ')[0];
    document.getElementById('verify-alert').style.display = 'none';
  } else {
    if (roleBadge) {
      roleBadge.textContent = '🎓 Student Account';
      roleBadge.style.color = 'var(--green-700)';
    }
    if (navStudent) navStudent.style.display = 'flex';
    if (navAdmin) navAdmin.style.display = 'none';
    const subMap = { no: 'Not verified', pending: 'Verification pending', yes: 'Verified student' };
    document.getElementById('user-sub').textContent = subMap[user.verified] || 'Not verified';
    document.getElementById('dash-greeting').textContent = 'Welcome, ' + user.name.split(' ')[0];
    document.getElementById('verify-alert').style.display = user.verified === 'yes' ? 'none' : 'flex';
  }
}

function renderVerifyStatus(){
  const user = state.currentUser;
  const studentBox = document.getElementById('student-verify-box');
  const adminBox = document.getElementById('admin-verify-box');

  if (user && user.role === 'admin') {
    if (studentBox) studentBox.style.display = 'none';
    if (adminBox) adminBox.style.display = 'block';
    renderAdminVerificationQueue();
    return;
  }

  if (adminBox) adminBox.style.display = 'none';
  if (studentBox) studentBox.style.display = 'block';

  const verifiedBox = document.getElementById('verify-status-verified');
  const pendingBox = document.getElementById('verify-status-pending');
  const formCard = document.getElementById('verify-form-card');
  const status = user ? (user.verification_status || user.verified || 'no') : 'no';

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

async function renderAdminVerificationQueue(){
  const listEl = document.getElementById('admin-verification-list');
  if (!listEl) return;
  listEl.innerHTML = '<div style="text-align:center;padding:20px;color:var(--ink-400);">Loading verification queue...</div>';

  try {
    const data = await apiFetch('/admin/verifications');
    const records = data.verifications || [];
    if (!records.length) {
      listEl.innerHTML = '<div style="text-align:center;padding:30px 20px;color:var(--ink-400);font-size:13px;">No student verification requests submitted yet.</div>';
      return;
    }

    listEl.innerHTML = `
      <div style="display:flex;flex-direction:column;gap:12px;">
        ${records.map(v => {
          const isPending = v.status === 'pending';
          const statusClass = v.status === 'approved' ? 'available' : v.status === 'pending' ? 'idle' : 'booked';
          const hasDoc = v.document_path && v.document_path.trim();

          return `
            <div style="background:var(--mint-50);border:1px solid var(--line);border-radius:var(--radius-sm);padding:14px 16px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;">
              <div>
                <div style="display:flex;align-items:center;gap:8px;">
                  <strong style="font-size:14px;color:var(--ink-900);">${escapeHtml(v.student_name || 'Student')}</strong>
                  <span class="status-pill ${statusClass}" style="text-transform:capitalize;">${escapeHtml(v.status)}</span>
                </div>
                <div style="font-size:12px;color:var(--ink-600);margin-top:4px;">
                  Card ID: <strong>${escapeHtml(v.student_id)}</strong> · Email: ${escapeHtml(v.student_email || '—')}
                </div>
                <div style="font-size:11px;color:var(--ink-400);margin-top:2px;">
                  Submitted: ${v.submitted_at ? new Date(v.submitted_at).toLocaleString() : 'Recently'}
                </div>
              </div>

              <div style="display:flex;align-items:center;gap:8px;">
                ${hasDoc ? `<a href="${escapeHtml(v.document_path)}" target="_blank" class="btn-ghost" style="font-size:11.5px;padding:6px 10px;text-decoration:none;">📄 View ID Photo</a>` : ''}
                ${isPending ? `
                  <button class="btn-book" style="padding:6px 14px;font-size:12px;" onclick="processVerification(${v.id}, 'approved')">Approve ✅</button>
                  <button class="btn-ghost" style="padding:6px 12px;font-size:12px;color:var(--coral-500);" onclick="processVerification(${v.id}, 'rejected')">Reject ✕</button>
                ` : `
                  <span style="font-size:12px;font-weight:700;color:var(--ink-400);">Action complete</span>
                `}
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `;
  } catch (err) {
    listEl.innerHTML = `<div style="color:var(--coral-500);padding:14px;font-size:12.5px;">⚠️ Failed to load verification queue: ${escapeHtml(err.message)}</div>`;
  }
}

async function processVerification(verifId, status){
  try {
    await apiFetch(`/admin/verifications/${verifId}`, {
      method: 'PUT',
      body: JSON.stringify({ status })
    });

    showConfirmModal(
      status === 'approved' ? '✅' : '❌',
      `Student ${status}`,
      `The verification request has been ${status}. The student's account permissions have been updated in the campus database.`,
      'Verification Processed'
    );

    renderAdminVerificationQueue();
    if (state.currentUser && state.currentUser.role === 'admin') {
      try {
        const analyticsData = await apiFetch('/admin/analytics');
        state.analytics = analyticsData || {};
        renderAdminStats();
      } catch (e) {}
    }
  } catch (err) {
    showConfirmModal('⚠️', 'Action failed', err.message, 'Admin Action');
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
    formData.append('name', name);
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

// Fallback predictions used before API data loads
const _defaultPredictions = [
  { key: 'projector', name: 'Projector', demand: 12, supply: 5, gap: 7, level: 'high', period: 'Next 7 days' },
  { key: 'dslr', name: 'DSLR Camera', demand: 8, supply: 6, gap: 2, level: 'medium', period: 'Next 7 days' },
  { key: 'arduino', name: 'Arduino Kit', demand: 15, supply: 10, gap: 5, level: 'high', period: 'Next 7 days' },
  { key: 'microphone', name: 'Microphone', demand: 9, supply: 4, gap: 5, level: 'high', period: 'Next 7 days' },
  { key: 'tripod', name: 'Tripod', demand: 7, supply: 3, gap: 4, level: 'medium', period: 'Next 7 days' }
];

function getPredictions(){
  return state.predictions && state.predictions.length ? state.predictions : _defaultPredictions;
}

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
  document.getElementById('dash-shortages').textContent = getPredictions().filter((p) => predictedGap(p) > 0).length;
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
  const predictions = getPredictions();
  document.getElementById('prediction-grid').innerHTML = predictions.map((prediction) => {
    const supply = prediction.supply;
    const gap = predictedGap(prediction);
    const level = gap >= 5 ? 'High' : gap > 0 ? 'Medium' : 'Low';
    return `<div class="prediction-card ${gap > 0 ? 'shortage' : ''}"><div class="prediction-card-head"><strong>${prediction.name}</strong><span class="status-pill ${gap > 0 ? 'idle' : 'available'}">${level} demand</span></div>
      <div class="prediction-numbers"><div><span>Predicted demand</span><strong>${prediction.demand}</strong></div><div><span>Current supply</span><strong>${supply}</strong></div><div><span>Supply gap</span><strong>${gap}</strong></div></div>
      <div class="prediction-period">${prediction.period} · ${gap > 0 ? 'Shortage predicted' : 'Supply meets demand'}</div></div>`;
  }).join('');

  document.getElementById('gap-list').innerHTML = predictions.map((prediction) => {
    const gap = predictedGap(prediction);
    const percent = Math.round((gap / (prediction.demand || 1)) * 100 || 0);
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

// Role-based views are now managed automatically by backend authentication session

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
  
  // Reset AI vision return inspection elements
  const vInput = document.getElementById('rm-vision-file');
  if (vInput) vInput.value = '';
  const vRes = document.getElementById('rm-vision-result');
  if (vRes) { vRes.style.display = 'none'; vRes.innerHTML = ''; }
  const vLoad = document.getElementById('rm-vision-loading');
  if (vLoad) vLoad.style.display = 'none';
  
  openModal('return-modal');
}

async function runVisionInspection(){
  const fileInput = document.getElementById('rm-vision-file');
  const loadEl = document.getElementById('rm-vision-loading');
  const resEl = document.getElementById('rm-vision-result');
  if (!fileInput || !fileInput.files || !fileInput.files[0]) return;
  
  loadEl.style.display = 'block';
  resEl.style.display = 'none';
  
  try {
    const formData = new FormData();
    formData.append('photo', fileInput.files[0]);
    if (activeReturnBookingId) formData.append('booking_id', activeReturnBookingId);
    
    const result = await apiFetch('/ai/vision-inspect', {
      method: 'POST',
      body: formData
    });
    
    loadEl.style.display = 'none';
    resEl.style.display = 'block';
    
    resEl.innerHTML = `
      <div class="vision-badge">🛡️ AI Verified · ${escapeHtml(result.rating)} (${result.integrity_score}% Integrity)</div>
      <div style="font-size:11.5px;color:var(--ink-900);margin-bottom:6px;">${escapeHtml(result.summary)}</div>
      <div class="vision-checks">
        ${(result.checks || []).map(c => `
          <div class="vision-check-item">
            <span>• ${escapeHtml(c.item)}</span>
            <span class="status-tag">✓ ${escapeHtml(c.status)}</span>
          </div>
        `).join('')}
      </div>
      <div style="font-size:11px;font-weight:800;color:var(--green-700);margin-top:6px;">🎁 Bonus: ${escapeHtml(result.trust_bonus)}</div>
    `;
    
    // Auto-mark checklist items upon AI pass
    document.querySelectorAll('#return-modal .step-check').forEach(el => el.classList.add('done'));
  } catch (error) {
    loadEl.style.display = 'none';
    resEl.style.display = 'block';
    resEl.innerHTML = `<div style="font-size:11.5px;color:var(--coral-500);">⚠️ AI Vision check error: ${escapeHtml(error.message)}</div>`;
  }
}

function toggleStep(el){ el.classList.toggle('done'); }

/* ================= LOOPBOT AI AGENT ================= */
function toggleLoopBot(){
  const win = document.getElementById('loopbot-window');
  if (!win) return;
  const isHidden = win.style.display === 'none' || !win.style.display;
  win.style.display = isHidden ? 'flex' : 'none';
  if (isHidden) {
    document.getElementById('loopbot-input')?.focus();
  }
}

function askLoopBotChip(text){
  const input = document.getElementById('loopbot-input');
  if (input) {
    input.value = text;
    handleLoopBotSubmit(new Event('submit'));
  }
}

async function handleLoopBotSubmit(e){
  if (e && e.preventDefault) e.preventDefault();
  const input = document.getElementById('loopbot-input');
  if (!input) return;
  const message = input.value.trim();
  if (!message) return;
  
  input.value = '';
  appendLoopBotMsg('user', message);
  
  // Typing indicator
  const typingId = 'typing-' + Date.now();
  appendLoopBotMsg('bot', '<span style="opacity:0.6;">LoopBot is searching campus resources...</span>', null, typingId);
  
  try {
    const data = await apiFetch('/ai/chat', {
      method: 'POST',
      body: JSON.stringify({ message })
    });
    
    document.getElementById(typingId)?.remove();
    appendLoopBotMsg('bot', data.reply, data.suggestions);
  } catch (error) {
    document.getElementById(typingId)?.remove();
    appendLoopBotMsg('bot', '⚠️ Sorry, I ran into an error connecting to campus services. Please try again!');
  }
}

function appendLoopBotMsg(sender, text, suggestions = [], id = null){
  const box = document.getElementById('loopbot-messages');
  if (!box) return;
  
  const div = document.createElement('div');
  div.className = `loopbot-msg ${sender}`;
  if (id) div.id = id;
  
  // Format markdown bold & linebreaks
  const formatted = text
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/\n/g, '<br>');
    
  let html = `<div class="bubble">${formatted}</div>`;
  
  if (suggestions && suggestions.length) {
    html += '<div style="margin-top:6px;">';
    suggestions.forEach(item => {
      const bookable = item.status === 'available';
      html += `
        <div class="loopbot-card">
          <div class="loopbot-card-info">
            <strong>${item.icon || '📦'} ${escapeHtml(item.name)}</strong>
            <span>${escapeHtml(item.price)} · ${item.match}% Match · ${escapeHtml(item.location || 'Campus')}</span>
          </div>
          <button class="loopbot-card-btn" ${bookable ? '' : 'disabled'} onclick="toggleLoopBot(); openBooking('${escapeAttr(item.id)}','${escapeAttr(item.name)}','${escapeAttr(item.icon || '📦')}','${escapeAttr(item.price)}')">
            ${bookable ? 'Book' : 'Busy'}
          </button>
        </div>
      `;
    });
    html += '</div>';
  }
  
  div.innerHTML = html;
  box.appendChild(div);
  box.scrollTop = box.scrollHeight;
}

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
