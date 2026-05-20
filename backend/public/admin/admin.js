/* ====================================================
   Feladify Admin Panel — Vanilla JS SPA
   ==================================================== */

'use strict';

/* ── API ─────────────────────────────────────────── */
const API = {
  token: () => localStorage.getItem('AdminToken'),

  async req(url, opts = {}) {
    const token = this.token();
    const res = await fetch(`/api/admin${url}`, {
      ...opts,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...opts.headers,
      },
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.message || `HTTP ${res.status}`);
    return data;
  },

  login:             (u, p)    => API.req('/login', { method: 'POST', body: JSON.stringify({ username: u, password: p }) }),
  getUsers:          (p = {})  => API.req('/users?' + new URLSearchParams(p)),
  createUser:        (d)       => API.req('/users', { method: 'POST', body: JSON.stringify(d) }),
  updateUser:        (id, d)   => API.req('/users/' + id, { method: 'PUT', body: JSON.stringify(d) }),
  deleteUser:        (id)      => API.req('/users/' + id, { method: 'DELETE' }),
  getCostStats:      ()        => API.req('/cost-stats'),
  getOverviewStats:  ()        => API.req('/stats/overview'),
  getActivityStats:  ()        => API.req('/stats/activity'),
  getAssignmentStats:()        => API.req('/stats/assignments'),
  getSystemInfo:     ()        => API.req('/system'),
  getDataAssignments:(p = {})  => API.req('/data/assignments?' + new URLSearchParams(p)),
  deleteDataAssignment:(id)    => API.req('/data/assignments/' + id, { method: 'DELETE' }),
  getDataClasses:    ()        => API.req('/data/classes'),
  deleteDataClass:   (id)      => API.req('/data/classes/' + id, { method: 'DELETE' }),
  getDataAnnouncements:(p={})  => API.req('/data/announcements?' + new URLSearchParams(p)),
  deleteDataAnnouncement:(id)  => API.req('/data/announcements/' + id, { method: 'DELETE' }),
};

/* ── Auth ────────────────────────────────────────── */
const Auth = {
  user: () => { try { return JSON.parse(localStorage.getItem('AdminUser')); } catch { return null; } },
  isLoggedIn: () => !!localStorage.getItem('AdminToken') && !!Auth.user(),
  login: (token, user) => { localStorage.setItem('AdminToken', token); localStorage.setItem('AdminUser', JSON.stringify(user)); },
  logout: () => { localStorage.removeItem('AdminToken'); localStorage.removeItem('AdminUser'); },
};

/* ── Toast ───────────────────────────────────────── */
const Toast = {
  show(msg, type = 'info') {
    const root = document.getElementById('toast-root');
    if (!root) return;
    const icons = { success: '✅', error: '⚠️', info: 'ℹ️' };
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    el.innerHTML = `<span>${icons[type] || '•'}</span><span>${msg}</span>`;
    root.appendChild(el);
    setTimeout(() => {
      el.style.animation = 'toastOut 0.3s forwards';
      setTimeout(() => el.remove(), 300);
    }, 3200);
  },
  success: (m) => Toast.show(m, 'success'),
  error:   (m) => Toast.show(m, 'error'),
};

/* ── Router ──────────────────────────────────────── */
const Router = {
  routes: {},
  register(hash, fn) { this.routes[hash] = fn; },
  navigate(hash) { location.hash = hash; },
  current() { return location.hash.slice(1) || 'login'; },
  init() {
    window.addEventListener('hashchange', () => this.dispatch());
    this.dispatch();
  },
  dispatch() {
    const route = this.current();
    if (!Auth.isLoggedIn() && route !== 'login') {
      this.navigate('login'); return;
    }
    if (Auth.isLoggedIn() && route === 'login') {
      this.navigate('dashboard'); return;
    }
    const fn = this.routes[route] || this.routes['dashboard'];
    if (fn) fn();
  },
};

/* ── Layout ──────────────────────────────────────── */
const PAGES = {
  dashboard:  { title: 'Áttekintés',   icon: '📊' },
  users:      { title: 'Felhasználók', icon: '👥' },
  data:       { title: 'Tartalmak',    icon: '🗄️' },
  costs:      { title: 'AI Költségek', icon: '💰' },
  statistics: { title: 'Statisztikák', icon: '📈' },
  system:     { title: 'Rendszer',     icon: '⚙️' },
};

function renderShell() {
  const user = Auth.user();
  document.body.innerHTML = `
    <div id="toast-root"></div>
    <div class="admin-root">
      <aside class="admin-sidebar">
        <div class="sidebar-logo">
          <div class="logo-icon">F</div>
          <div>
            <span class="logo-title">Feladify</span>
            <span class="logo-sub">Admin Panel</span>
          </div>
        </div>
        <nav class="sidebar-nav" id="sidebar-nav">
          <span class="nav-section">Navigáció</span>
          ${Object.entries(PAGES).map(([k, v]) => `
            <button class="nav-item" data-route="${k}" onclick="Router.navigate('${k}')">
              <span class="icon">${v.icon}</span>${v.title}
            </button>`).join('')}
        </nav>
        <div class="sidebar-footer">
          <div class="sidebar-user">Bejelentkezve: <span>${user?.name || ''}</span></div>
          <button class="logout-btn" onclick="App.logout()">
            <span class="icon">🚪</span>Kijelentkezés
          </button>
        </div>
      </aside>
      <div style="flex:1">
        <header class="admin-header">
          <span class="header-title" id="header-title">—</span>
          <div class="header-badge">🛡️ Admin</div>
        </header>
        <main class="admin-content" id="main-content"></main>
      </div>
    </div>`;
}

function setActiveNav(route) {
  document.querySelectorAll('.nav-item').forEach(el => {
    el.classList.toggle('active', el.dataset.route === route);
  });
  const p = PAGES[route];
  if (p) document.getElementById('header-title').textContent = p.title;
}

function setContent(html) {
  document.getElementById('main-content').innerHTML = html;
}

function loadingHtml() {
  return `<div class="loading"><div class="spinner"></div><span>Adatok betöltése...</span></div>`;
}

function emptyHtml(icon, text) {
  return `<div class="empty"><div class="icon">${icon}</div><p>${text}</p></div>`;
}

/* ── Helpers ─────────────────────────────────────── */
const ROLE_LABEL = { teacher: 'Tanár', student: 'Diák', parent: 'Szülő', admin: 'Admin' };
const ROLE_CLR   = { teacher: '#6366f1', student: '#10b981', parent: '#f59e0b' };

function badge(role) {
  return `<span class="badge badge-${role}">${ROLE_LABEL[role] || role}</span>`;
}

function fmtDate(d) {
  return d ? new Date(d).toLocaleDateString('hu-HU') : '—';
}

function fmtDatetime(d) {
  return d ? new Date(d).toLocaleString('hu-HU') : '—';
}

function paginate(total, page, limit) {
  const totalPages = Math.ceil(total / limit);
  const from = (page - 1) * limit + 1;
  const to = Math.min(page * limit, total);
  const pages = Array.from({ length: Math.min(totalPages, 7) }, (_, i) => i + 1);
  return `
    <div class="pagination">
      <span class="pagination-info">${from}–${to} / ${total}</span>
      <div class="pagination-btns">
        <button class="page-btn" ${page <= 1 ? 'disabled' : ''} data-page="${page - 1}">‹</button>
        ${pages.map(p => `<button class="page-btn ${p === page ? 'active' : ''}" data-page="${p}">${p}</button>`).join('')}
        <button class="page-btn" ${page >= totalPages ? 'disabled' : ''} data-page="${page + 1}">›</button>
      </div>
    </div>`;
}

/* ── Modal helpers ───────────────────────────────── */
function openModal(html) {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.id = 'modal-overlay';
  overlay.innerHTML = html;
  overlay.addEventListener('click', e => { if (e.target === overlay) closeModal(); });
  document.body.appendChild(overlay);
}

function closeModal() {
  document.getElementById('modal-overlay')?.remove();
}

function confirmDelete(label, name, onConfirm) {
  openModal(`
    <div class="modal modal-sm">
      <div class="modal-header">
        <h3 class="modal-title">Törlés megerősítése</h3>
        <button class="modal-close" onclick="closeModal()">✕</button>
      </div>
      <div class="modal-body">
        <div class="confirm-icon">🗑️</div>
        <p class="confirm-text">Biztosan törlöd ezt a(z) ${label}t?</p>
        <p class="confirm-subject">${name}</p>
        <p class="confirm-warn">Ez a művelet nem visszavonható!</p>
      </div>
      <div class="modal-footer">
        <button class="btn btn-ghost" onclick="closeModal()">Mégse</button>
        <button class="btn btn-danger" id="confirm-ok">Törlés</button>
      </div>
    </div>`);
  document.getElementById('confirm-ok').onclick = onConfirm;
}

/* ── Page: Login ─────────────────────────────────── */
function renderLogin() {
  document.body.innerHTML = `
    <div id="toast-root"></div>
    <div class="login-page">
      <div class="login-card">
        <div class="login-logo">
          <div class="icon">F</div>
          <div>
            <span class="login-title">Feladify Admin</span>
            <span class="login-sub">Adminisztrátori bejelentkezés</span>
          </div>
        </div>
        <div id="login-error" style="display:none" class="login-error">⚠️ <span id="login-err-msg"></span></div>
        <form id="login-form">
          <div class="form-group">
            <label class="form-label">Felhasználónév</label>
            <input class="input" id="login-user" type="text" placeholder="feladifyadmin" autocomplete="username" autofocus required>
          </div>
          <div class="form-group">
            <label class="form-label">Jelszó</label>
            <div class="pass-wrap">
              <input class="input" id="login-pass" type="password" placeholder="••••••••••" autocomplete="current-password" required>
              <button type="button" class="pass-toggle" id="pass-toggle">👁️</button>
            </div>
          </div>
          <button type="submit" class="login-submit" id="login-btn">Bejelentkezés</button>
        </form>
        <p style="text-align:center;margin-top:18px;font-size:12px;color:#334155">Feladify Admin Panel v1.0</p>
      </div>
    </div>`;

  document.getElementById('pass-toggle').onclick = () => {
    const inp = document.getElementById('login-pass');
    const btn = document.getElementById('pass-toggle');
    inp.type = inp.type === 'password' ? 'text' : 'password';
    btn.textContent = inp.type === 'password' ? '👁️' : '🙈';
  };

  document.getElementById('login-form').onsubmit = async (e) => {
    e.preventDefault();
    const btn = document.getElementById('login-btn');
    const errBox = document.getElementById('login-error');
    const errMsg = document.getElementById('login-err-msg');
    btn.disabled = true; btn.textContent = 'Bejelentkezés...';
    errBox.style.display = 'none';
    try {
      const data = await API.login(
        document.getElementById('login-user').value.trim(),
        document.getElementById('login-pass').value
      );
      Auth.login(data.token, data.user);
      Router.navigate('dashboard');
    } catch (err) {
      errMsg.textContent = err.message;
      errBox.style.display = 'flex';
      btn.disabled = false; btn.textContent = 'Bejelentkezés';
    }
  };
}

/* ── Page: Dashboard ─────────────────────────────── */
async function renderDashboard() {
  setContent(loadingHtml());
  try {
    const s = await API.getOverviewStats();

    const cards = [
      { icon: '👥', value: s.users.total, label: 'Összes felhasználó', cc: 'linear-gradient(90deg,#3b82f6,#6366f1)', sub: `+${s.newRegistrations?.last30 || 0} az elmúlt 30 napban`, posNeg: 'pos' },
      { icon: '🎓', value: s.users.teacher, label: 'Tanárok', cc: 'linear-gradient(90deg,#6366f1,#8b5cf6)' },
      { icon: '🧑‍🎓', value: s.users.student, label: 'Diákok', cc: 'linear-gradient(90deg,#10b981,#059669)' },
      { icon: '👨‍👩‍👦', value: s.users.parent, label: 'Szülők', cc: 'linear-gradient(90deg,#f59e0b,#d97706)' },
      { icon: '📝', value: s.assignmentCount, label: 'Összes feladat', cc: 'linear-gradient(90deg,#0ea5e9,#0284c7)' },
      { icon: '💰', value: '$' + (s.monthlyCost || 0).toFixed(4), label: 'Havi AI költség', cc: 'linear-gradient(90deg,#f43f5e,#e11d48)' },
    ];

    const roleBars = [
      { role: 'teacher', count: s.users.teacher, color: '#6366f1' },
      { role: 'student', count: s.users.student, color: '#10b981' },
      { role: 'parent',  count: s.users.parent,  color: '#f59e0b' },
    ].map(r => {
      const pct = s.users.total > 0 ? Math.round(r.count / s.users.total * 100) : 0;
      return `<div class="role-bar-row">
        <div class="role-bar-top">
          <span style="color:#94a3b8">${ROLE_LABEL[r.role]}</span>
          <span style="font-weight:600;color:#e2e8f0">${r.count} (${pct}%)</span>
        </div>
        <div class="role-bar-track"><div class="role-bar-fill" style="width:${pct}%;background:${r.color}"></div></div>
      </div>`;
    }).join('');

    const recentRows = (s.recentUsers || []).map(u => `
      <tr>
        <td style="font-weight:500;color:#e2e8f0">${u.name}</td>
        <td style="color:#64748b;font-size:12px">${u.email}</td>
        <td>${badge(u.role)}</td>
        <td style="color:#64748b;font-size:12px">${fmtDate(u.createdAt)}</td>
      </tr>`).join('') || `<tr><td colspan="4" style="text-align:center;color:#475569;padding:24px">Nincs adat</td></tr>`;

    setContent(`
      <div class="page-header">
        <h2 class="page-title">Áttekintés</h2>
        <p class="page-sub">A rendszer aktuális állapota és legfontosabb mutatói</p>
      </div>
      <div class="stats-grid">
        ${cards.map(c => `
          <div class="stat-card" style="--cc:${c.cc}">
            <div class="stat-icon">${c.icon}</div>
            <div class="stat-value">${c.value}</div>
            <div class="stat-label">${c.label}</div>
            ${c.sub ? `<div class="stat-change ${c.posNeg || ''}">${c.sub}</div>` : ''}
          </div>`).join('')}
      </div>
      <div class="grid-2">
        <div class="card">
          <div class="card-header"><span class="card-title">👤 Legutóbbi regisztrációk</span></div>
          <div class="table-wrap">
            <table>
              <thead><tr><th>Név</th><th>Email</th><th>Szerep</th><th>Regisztráció</th></tr></thead>
              <tbody>${recentRows}</tbody>
            </table>
          </div>
        </div>
        <div class="card">
          <div class="card-header"><span class="card-title">📊 Szerepkör megoszlás</span></div>
          <div class="role-bar-wrap">${roleBars}</div>
          <div style="margin-top:18px;border-top:1px solid rgba(255,255,255,0.06);padding-top:14px;display:flex;justify-content:space-between">
            <span style="font-size:13px;color:#64748b">Új regisztrációk (7 nap)</span>
            <span style="font-size:14px;font-weight:700;color:#4ade80">+${s.newRegistrations?.last7 || 0}</span>
          </div>
        </div>
      </div>`);
  } catch (err) {
    setContent(`<div class="card"><p style="color:#f87171;text-align:center">⚠️ ${err.message}</p></div>`);
  }
}

/* ── Page: Users ─────────────────────────────────── */
const SUBJECTS = ['Nyelvtan','Irodalom','Angol','Német','Matematika','Környezetismeret','Történelem','Fizika','Biológia','Földrajz'];

let usersState = { page: 1, search: '', role: '', data: null };

async function renderUsers() {
  setContent(loadingHtml());
  await loadUsers();
}

async function loadUsers() {
  try {
    const d = await API.getUsers({ page: usersState.page, limit: 20, search: usersState.search, role: usersState.role });
    usersState.data = d;

    const rows = d.users.map(u => `
      <tr>
        <td style="font-weight:600;color:#e2e8f0">${u.name}</td>
        <td style="color:#64748b;font-size:13px">${u.email}</td>
        <td>${badge(u.role)}</td>
        <td style="font-size:12px;color:#64748b">
          ${u.role === 'teacher' && u.subjects?.length ? u.subjects.slice(0,2).join(', ') + (u.subjects.length > 2 ? ' +' + (u.subjects.length - 2) : '') : ''}
          ${u.role === 'student' && u.className ? u.className : ''}
        </td>
        <td style="color:#64748b;font-size:12px">${fmtDate(u.createdAt)}</td>
        <td>
          <div style="display:flex;gap:5px">
            <button class="btn btn-ghost btn-sm" title="Szerkesztés" onclick="openEditUser('${u._id}')">✏️</button>
            ${u.role !== 'admin' ? `<button class="btn btn-danger btn-sm" title="Törlés" onclick="confirmDeleteUser('${u._id}','${u.name}')">🗑️</button>` : ''}
          </div>
        </td>
      </tr>`).join('') || `<tr><td colspan="6" style="text-align:center;padding:28px;color:#475569">Nincs találat</td></tr>`;

    setContent(`
      <div class="page-header">
        <h2 class="page-title">Felhasználók</h2>
        <p class="page-sub">Összes regisztrált felhasználó kezelése</p>
      </div>
      <div class="card">
        <div class="toolbar">
          <div class="search-wrap" style="flex:1;min-width:180px">
            <span class="icon">🔍</span>
            <input class="input" id="user-search" type="text" placeholder="Keresés névben vagy emailben..." value="${usersState.search}">
          </div>
          <select class="select" style="width:auto;min-width:140px" id="user-role-filter">
            <option value="">Összes szerep</option>
            <option value="teacher" ${usersState.role === 'teacher' ? 'selected' : ''}>Tanárok</option>
            <option value="student" ${usersState.role === 'student' ? 'selected' : ''}>Diákok</option>
            <option value="parent"  ${usersState.role === 'parent'  ? 'selected' : ''}>Szülők</option>
          </select>
          <button class="btn btn-primary" onclick="openCreateUser()">＋ Új felhasználó</button>
        </div>
        <div class="table-wrap">
          <table>
            <thead><tr><th>Név</th><th>Email</th><th>Szerep</th><th>Részletek</th><th>Regisztráció</th><th>Műveletek</th></tr></thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
        ${paginate(d.total, usersState.page, 20)}
      </div>`);

    document.getElementById('user-search').addEventListener('input', e => {
      usersState.search = e.target.value; usersState.page = 1; loadUsers();
    });
    document.getElementById('user-role-filter').addEventListener('change', e => {
      usersState.role = e.target.value; usersState.page = 1; loadUsers();
    });
    document.querySelectorAll('[data-page]').forEach(btn => {
      btn.onclick = () => { usersState.page = parseInt(btn.dataset.page); loadUsers(); };
    });
  } catch (err) {
    setContent(`<div class="card"><p style="color:#f87171;text-align:center">⚠️ ${err.message}</p></div>`);
  }
}

function userFormHtml(u = {}) {
  const isEdit = !!u._id;
  const subjPills = SUBJECTS.map(s => `
    <button type="button" class="subject-pill ${(u.subjects||[]).includes(s) ? 'selected' : ''}" data-s="${s}" onclick="toggleSubject(this,'${s}')">${s}</button>`).join('');
  return `
    <div class="modal">
      <div class="modal-header">
        <h3 class="modal-title">${isEdit ? 'Felhasználó szerkesztése' : 'Új felhasználó'}</h3>
        <button class="modal-close" onclick="closeModal()">✕</button>
      </div>
      <div class="modal-body">
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Név *</label>
            <input class="input" id="uf-name" value="${u.name || ''}" placeholder="Teljes név">
          </div>
          <div class="form-group">
            <label class="form-label">Email *</label>
            <input class="input" id="uf-email" type="email" value="${u.email || ''}" placeholder="email@example.com">
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Jelszó ${isEdit ? '(üresen: nem változik)' : '*'}</label>
            <div class="pass-wrap">
              <input class="input" id="uf-pass" type="password" placeholder="••••••••">
              <button type="button" class="pass-toggle" onclick="togglePassVis('uf-pass',this)">👁️</button>
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">Szerepkör *</label>
            <select class="select" id="uf-role" onchange="handleRoleChange()">
              <option value="student" ${u.role==='student'?'selected':''}>Diák</option>
              <option value="teacher" ${u.role==='teacher'?'selected':''}>Tanár</option>
              <option value="parent"  ${u.role==='parent' ?'selected':''}>Szülő</option>
            </select>
          </div>
        </div>
        <div id="uf-student-fields" style="${(!u.role || u.role==='student') ? '' : 'display:none'}">
          <div class="form-group">
            <label class="form-label">Osztály</label>
            <input class="input" id="uf-class" value="${u.className || ''}" placeholder="pl. 7. A">
          </div>
        </div>
        <div id="uf-teacher-fields" style="${u.role==='teacher' ? '' : 'display:none'}">
          <div class="form-group">
            <label class="form-label">Tantárgyak</label>
            <div class="subject-pills" id="uf-subjects">${subjPills}</div>
          </div>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-ghost" onclick="closeModal()">Mégse</button>
        <button class="btn btn-primary" id="uf-save" onclick="saveUser('${u._id || ''}')">${isEdit ? 'Módosítás' : 'Létrehozás'}</button>
      </div>
    </div>`;
}

function openCreateUser() { openModal(userFormHtml()); }

function openEditUser(id) {
  const user = usersState.data?.users.find(u => u._id === id);
  if (user) openModal(userFormHtml(user));
}

function handleRoleChange() {
  const role = document.getElementById('uf-role').value;
  document.getElementById('uf-student-fields').style.display = role === 'student' ? '' : 'none';
  document.getElementById('uf-teacher-fields').style.display = role === 'teacher' ? '' : 'none';
}

function toggleSubject(btn, s) { btn.classList.toggle('selected'); }

function togglePassVis(id, btn) {
  const inp = document.getElementById(id);
  inp.type = inp.type === 'password' ? 'text' : 'password';
  btn.textContent = inp.type === 'password' ? '👁️' : '🙈';
}

async function saveUser(id) {
  const btn = document.getElementById('uf-save');
  const name  = document.getElementById('uf-name').value.trim();
  const email = document.getElementById('uf-email').value.trim();
  const pass  = document.getElementById('uf-pass').value;
  const role  = document.getElementById('uf-role').value;
  const className = document.getElementById('uf-class')?.value?.trim() || '';
  const subjects = [...document.querySelectorAll('#uf-subjects .subject-pill.selected')].map(el => el.dataset.s);

  if (!name || !email || (!id && !pass)) { Toast.error('Töltsd ki a kötelező mezőket!'); return; }
  btn.disabled = true; btn.textContent = 'Mentés...';
  try {
    const payload = { name, email, role };
    if (pass) payload.password = pass;
    if (role === 'student') payload.className = className;
    if (role === 'teacher') payload.subjects = subjects;
    if (id) { await API.updateUser(id, payload); Toast.success('Felhasználó módosítva!'); }
    else { await API.createUser(payload); Toast.success('Felhasználó létrehozva!'); }
    closeModal(); loadUsers();
  } catch (err) {
    Toast.error(err.message); btn.disabled = false; btn.textContent = id ? 'Módosítás' : 'Létrehozás';
  }
}

function confirmDeleteUser(id, name) {
  confirmDelete('felhasználó', name, async () => {
    closeModal();
    try { await API.deleteUser(id); Toast.success('Felhasználó törölve!'); loadUsers(); }
    catch (err) { Toast.error(err.message); }
  });
}

/* ── Page: Data ──────────────────────────────────── */
let dataTab = 'assignments';
let dataState = { aPage: 1, aSearch: '', annPage: 1 };

async function renderData() {
  setContent(`
    <div class="page-header">
      <h2 class="page-title">Tartalmak</h2>
      <p class="page-sub">Adatbázis tartalmak megtekintése és kezelése</p>
    </div>
    <div class="tabs" id="data-tabs">
      <button class="tab-btn ${dataTab==='assignments'?'active':''}" onclick="switchDataTab('assignments')">📝 Feladatok</button>
      <button class="tab-btn ${dataTab==='classes'?'active':''}" onclick="switchDataTab('classes')">🏫 Osztályok</button>
      <button class="tab-btn ${dataTab==='announcements'?'active':''}" onclick="switchDataTab('announcements')">📢 Hirdetmények</button>
    </div>
    <div class="card" id="data-content">${loadingHtml()}</div>`);
  loadDataTab();
}

function switchDataTab(tab) {
  dataTab = tab;
  document.querySelectorAll('#data-tabs .tab-btn').forEach(b => b.classList.toggle('active', b.textContent.includes(tab === 'assignments' ? 'Feladatok' : tab === 'classes' ? 'Osztályok' : 'Hirdetmény')));
  loadDataTab();
}

async function loadDataTab() {
  const el = document.getElementById('data-content');
  if (!el) return;
  el.innerHTML = loadingHtml();

  try {
    if (dataTab === 'assignments') {
      const d = await API.getDataAssignments({ page: dataState.aPage, limit: 20, search: dataState.aSearch });
      const rows = d.assignments.map(a => `
        <tr>
          <td style="font-weight:500;color:#e2e8f0;max-width:200px">${a.title}</td>
          <td><span class="badge badge-teacher">${a.subject}</span></td>
          <td style="color:#94a3b8;font-size:13px">${a.difficulty}</td>
          <td style="font-size:13px;color:#64748b">${a.teacherId?.name || '—'}</td>
          <td style="text-align:center;color:#64748b;font-size:13px">${a.completedCount}</td>
          <td style="color:#64748b;font-size:12px">${fmtDate(a.createdAt)}</td>
          <td><button class="btn btn-danger btn-sm" onclick="delDataItem('assignment','${a._id}','${a.title.replace(/'/g,"\\'")}')">🗑️</button></td>
        </tr>`).join('') || `<tr><td colspan="7" style="text-align:center;padding:24px;color:#475569">Nincs találat</td></tr>`;

      el.innerHTML = `
        <div class="toolbar">
          <div class="search-wrap" style="flex:1">
            <span class="icon">🔍</span>
            <input class="input" id="a-search" placeholder="Keresés cím alapján..." value="${dataState.aSearch}">
          </div>
        </div>
        <div class="table-wrap">
          <table>
            <thead><tr><th>Cím</th><th>Tantárgy</th><th>Nehézség</th><th>Tanár</th><th>Beküldések</th><th>Létrehozva</th><th>Törlés</th></tr></thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
        ${paginate(d.total, dataState.aPage, 20)}`;

      document.getElementById('a-search').addEventListener('input', e => { dataState.aSearch = e.target.value; dataState.aPage = 1; loadDataTab(); });
      document.querySelectorAll('[data-page]').forEach(b => { b.onclick = () => { dataState.aPage = parseInt(b.dataset.page); loadDataTab(); }; });

    } else if (dataTab === 'classes') {
      const d = await API.getDataClasses();
      const rows = d.classes.map(c => `
        <tr>
          <td style="font-weight:600;color:#e2e8f0">${c.name}</td>
          <td style="font-size:13px;color:#64748b">${(c.teacherIds||[]).map(t=>t.name).join(', ') || '—'}</td>
          <td style="text-align:center;color:#94a3b8">${c.studentCount}</td>
          <td><button class="btn btn-danger btn-sm" onclick="delDataItem('class','${c._id}','${c.name}')">🗑️</button></td>
        </tr>`).join('') || `<tr><td colspan="4" style="text-align:center;padding:24px;color:#475569">Nincsenek osztályok</td></tr>`;
      el.innerHTML = `<div class="table-wrap"><table><thead><tr><th>Osztálynév</th><th>Tanárok</th><th>Diákok</th><th>Törlés</th></tr></thead><tbody>${rows}</tbody></table></div>`;

    } else if (dataTab === 'announcements') {
      const d = await API.getDataAnnouncements({ page: dataState.annPage, limit: 20 });
      const rows = d.announcements.map(a => `
        <tr>
          <td style="font-weight:500;color:#e2e8f0">${a.title}</td>
          <td style="font-size:13px;color:#64748b">${a.teacherId?.name || '—'}</td>
          <td style="font-size:13px;color:#64748b">${a.classId?.name || '—'}</td>
          <td style="font-size:12px;color:${a.deadline ? '#fbbf24' : '#475569'}">${a.deadline ? fmtDate(a.deadline) : '—'}</td>
          <td style="color:#64748b;font-size:12px">${fmtDate(a.createdAt)}</td>
          <td><button class="btn btn-danger btn-sm" onclick="delDataItem('announcement','${a._id}','${a.title.replace(/'/g,"\\'")}')">🗑️</button></td>
        </tr>`).join('') || `<tr><td colspan="6" style="text-align:center;padding:24px;color:#475569">Nincsenek hirdetmények</td></tr>`;
      el.innerHTML = `
        <div class="table-wrap"><table><thead><tr><th>Cím</th><th>Tanár</th><th>Osztály</th><th>Határidő</th><th>Létrehozva</th><th>Törlés</th></tr></thead><tbody>${rows}</tbody></table></div>
        ${paginate(d.total, dataState.annPage, 20)}`;
      document.querySelectorAll('[data-page]').forEach(b => { b.onclick = () => { dataState.annPage = parseInt(b.dataset.page); loadDataTab(); }; });
    }
  } catch (err) {
    el.innerHTML = `<p style="color:#f87171;text-align:center">⚠️ ${err.message}</p>`;
  }
}

function delDataItem(type, id, name) {
  const LABELS = { assignment: 'feladat', class: 'osztály', announcement: 'hirdetmény' };
  confirmDelete(LABELS[type] || type, name, async () => {
    closeModal();
    try {
      if (type === 'assignment') await API.deleteDataAssignment(id);
      else if (type === 'class') await API.deleteDataClass(id);
      else if (type === 'announcement') await API.deleteDataAnnouncement(id);
      Toast.success('Törölve!');
      loadDataTab();
    } catch (err) { Toast.error(err.message); }
  });
}

/* ── Page: Costs ─────────────────────────────────── */
async function renderCosts() {
  setContent(loadingHtml());
  try {
    const data = await API.getCostStats();

    if (!data || !data.month) {
      setContent(`<div class="card">${emptyHtml('💰', 'Még nincsenek cost adatok.')}</div>`);
      return;
    }

    const bm = data.byModel || {};
    const bc = data.byChain || {};
    const callers = data.byCaller || {};
    const total = data.totalCostUSD || 0;
    const totalIn = data.totalInputTokens || 0;
    const totalOut = data.totalOutputTokens || 0;

    const fmt = v => v == null ? '$0.0000' : '$' + Number(v).toFixed(4);
    const fmtTok = v => v == null ? '0' : Number(v).toLocaleString('hu-HU');
    const pct = v => total > 0 ? Math.round((v / total) * 100) : 0;

    // Chain cards
    let chainCardsHtml = '';
    ['reasoning', 'fast'].forEach(ct => {
      const d = bc[ct] || {};
      const cc = ct === 'reasoning' ? '#6366f1' : '#0ea5e9';
      chainCardsHtml += `
        <div style="padding:12px 18px;border-radius:10px;background:rgba(15,23,42,0.6);border:1px solid ${cc}30;min-width:140px">
          <div style="font-size:10px;font-weight:800;color:${cc};text-transform:uppercase;letter-spacing:.8px">${ct === 'reasoning' ? '🧠 Reasoning' : '⚡ Fast'}</div>
          <div style="font-size:20px;font-weight:800;color:#e2e8f0;margin-top:2px">${fmt(d.costUSD)}</div>
          <div style="font-size:11px;color:#64748b">${d.calls || 0} hívás · ${pct(d.costUSD || 0)}%</div>
          <div style="font-size:10px;color:#64748b;margin-top:3px">in: ${fmtTok(d.inputTokens)} · out: ${fmtTok(d.outputTokens)}</div>
        </div>`;
    });

    // Model rows
    const modelDefs = [
      { key: 'deepseek-reasoner', chain: 'reasoning', color: '#6366f1' },
      { key: 'qwen-plus',         chain: 'reasoning', color: '#8b5cf6' },
      { key: 'deepseek-chat',     chain: 'fast',      color: '#0ea5e9' },
      { key: 'qwen-turbo',        chain: 'fast',      color: '#38bdf8' },
    ];
    let modelsHtml = '';
    modelDefs.forEach(({ key, chain, color }) => {
      const d = bm[key] || { calls: 0, costUSD: 0, inputTokens: 0, outputTokens: 0 };
      const barW = pct(d.costUSD);
      const cc = chain === 'reasoning' ? '#6366f1' : '#0ea5e9';
      const cbg = chain === 'reasoning' ? 'rgba(99,102,241,0.15)' : 'rgba(14,165,233,0.15)';
      modelsHtml += `
        <div style="margin-bottom:14px">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:5px">
            <div style="display:flex;align-items:center;gap:8px">
              <span style="width:10px;height:10px;border-radius:50%;background:${color};display:inline-block;flex-shrink:0"></span>
              <span style="font-weight:700;font-size:13px;color:#e2e8f0">${key}</span>
              <span style="font-size:10px;font-weight:700;padding:1px 7px;border-radius:20px;background:${cbg};color:${cc}">${chain}</span>
            </div>
            <div style="display:flex;gap:14px;align-items:center">
              <span style="font-size:11px;color:#64748b">in ${fmtTok(d.inputTokens)} · out ${fmtTok(d.outputTokens)}</span>
              <span style="font-size:11px;color:#64748b">${d.calls} hívás</span>
              <span style="font-size:13px;font-weight:800;color:#e2e8f0;min-width:80px;text-align:right">${fmt(d.costUSD)}</span>
              <span style="font-size:11px;color:${color};font-weight:700;min-width:36px;text-align:right">${barW}%</span>
            </div>
          </div>
          <div style="height:6px;background:rgba(255,255,255,0.08);border-radius:6px;overflow:hidden">
            <div style="height:100%;width:${barW}%;background:${color};border-radius:6px;transition:width .5s"></div>
          </div>
        </div>`;
    });

    // Caller rows
    const callerEntries = Object.entries(callers).sort((a, b) => (b[1].costUSD || 0) - (a[1].costUSD || 0));
    let callerRowsHtml = '';
    if (callerEntries.length > 0) {
      callerEntries.forEach(([name, d]) => {
        callerRowsHtml += `<tr>
          <td style="font-family:monospace;font-size:12px;font-weight:600;color:#e2e8f0">${name}</td>
          <td style="text-align:right;color:#94a3b8;font-size:12px">${d.calls}×</td>
          <td style="text-align:right;color:#94a3b8;font-size:12px">${fmtTok(d.inputTokens)}</td>
          <td style="text-align:right;color:#94a3b8;font-size:12px">${fmtTok(d.outputTokens)}</td>
          <td style="text-align:right;font-weight:700;color:#e2e8f0;font-size:12px">${fmt(d.costUSD)}</td>
        </tr>`;
      });
    } else {
      callerRowsHtml = '<tr><td colspan="5" style="text-align:center;padding:20px;color:#475569">Nincs adat</td></tr>';
    }

    // User rows
    const userEntries = Object.entries(data.byUser || {}).sort((a, b) => (b[1].costUSD || 0) - (a[1].costUSD || 0));
    let userRowsHtml = '';
    if (userEntries.length > 0) {
      userEntries.forEach(([uid, d]) => {
        const roleSpan = d.role ? `<span style="margin-left:6px;font-size:11px;color:#64748b">[${d.role}]</span>` : '';
        userRowsHtml += `<tr>
          <td><span style="font-weight:600;color:#e2e8f0">${d.name || uid}</span>${roleSpan}</td>
          <td style="text-align:right;color:#94a3b8;font-size:12px">${d.calls}×</td>
          <td style="text-align:right;color:#94a3b8;font-size:12px">${fmtTok(d.inputTokens)}</td>
          <td style="text-align:right;color:#94a3b8;font-size:12px">${fmtTok(d.outputTokens)}</td>
          <td style="text-align:right;font-weight:700;color:#e2e8f0;font-size:12px">${fmt(d.costUSD)}</td>
        </tr>`;
      });
    } else {
      userRowsHtml = '<tr><td colspan="5" style="text-align:center;padding:20px;color:#475569">Nincs adat</td></tr>';
    }

    // Price cards
    let priceCardsHtml = '';
    [
      { label: 'deepseek-reasoner', inp: '$0.55', out: '$2.19', color: '#6366f1' },
      { label: 'qwen-plus',         inp: '$0.40', out: '$1.20', color: '#8b5cf6' },
      { label: 'deepseek-chat',     inp: '$0.14', out: '$0.28', color: '#0ea5e9' },
      { label: 'qwen-turbo',        inp: '$0.05', out: '$0.20', color: '#38bdf8' },
    ].forEach(m => {
      priceCardsHtml += `
        <div style="padding:10px 14px;border-radius:8px;border:1px solid ${m.color}30;background:${m.color}08">
          <div style="font-weight:800;font-size:12px;color:${m.color};margin-bottom:4px">${m.label}</div>
          <div style="font-size:11px;color:#64748b">Input: <strong style="color:#e2e8f0">${m.inp}</strong></div>
          <div style="font-size:11px;color:#64748b">Output: <strong style="color:#e2e8f0">${m.out}</strong></div>
        </div>`;
    });

    setContent(`
      <div class="page-header">
        <h2 class="page-title">AI Költségek</h2>
        <p class="page-sub">Valós token számlálás az API response usage mezőből · Árak: 2026-05, DeepSeek + DashScope</p>
      </div>

      <div class="card" style="display:flex;gap:32px;flex-wrap:wrap;padding:24px 28px">
        <div>
          <div style="font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px">Havi összesítő</div>
          <div style="font-size:32px;font-weight:900;color:#10b981;letter-spacing:-1px">${fmt(total)}</div>
          <div style="font-size:12px;color:#64748b;margin-top:2px">${data.month} · ${data.callCount} AI hívás</div>
          <div style="display:flex;gap:14px;margin-top:10px;flex-wrap:wrap">
            <span style="font-size:11px;color:#64748b">Input: <strong style="color:#e2e8f0">${fmtTok(totalIn)} tok</strong></span>
            <span style="font-size:11px;color:#64748b">Output: <strong style="color:#e2e8f0">${fmtTok(totalOut)} tok</strong></span>
            <span style="font-size:11px;color:#64748b">Össz: <strong style="color:#e2e8f0">${fmtTok(totalIn + totalOut)} tok</strong></span>
          </div>
        </div>
        <div style="display:flex;gap:12px;flex-wrap:wrap;align-items:center">${chainCardsHtml}</div>
      </div>

      <div class="card">
        <div class="card-header"><span class="card-title">🤖 Modellenként</span></div>
        <div style="padding:4px 0">${modelsHtml}</div>
      </div>

      <div class="card">
        <div class="card-header"><span class="card-title">⚙️ Hívások forrása</span></div>
        <div class="table-wrap">
          <table>
            <thead><tr><th>Függvény</th><th style="text-align:right">Hívás</th><th style="text-align:right">Input tok</th><th style="text-align:right">Output tok</th><th style="text-align:right">Költség</th></tr></thead>
            <tbody>${callerRowsHtml}</tbody>
          </table>
        </div>
      </div>

      <div class="card">
        <div class="card-header"><span class="card-title">👤 Felhasználónkénti fogyasztás</span></div>
        <div class="table-wrap">
          <table>
            <thead><tr><th>Felhasználó</th><th style="text-align:right">Hívás</th><th style="text-align:right">Input tok</th><th style="text-align:right">Output tok</th><th style="text-align:right">Költség</th></tr></thead>
            <tbody>${userRowsHtml}</tbody>
          </table>
        </div>
      </div>

      <div class="card">
        <div class="card-header"><span class="card-title">💲 Ártáblázat ($ / 1M token)</span></div>
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:10px;padding:4px 0">${priceCardsHtml}</div>
      </div>`);

  } catch (err) {
    setContent(`<div class="card"><p style="color:#f87171;text-align:center">⚠️ ${err.message}</p></div>`);
  }
}

/* ── Page: Statistics ────────────────────────────── */
async function renderStatistics() {
  setContent(loadingHtml());
  try {
    const [act, asg] = await Promise.all([API.getActivityStats(), API.getAssignmentStats()]);

    const userItems = (act.recentUsers||[]).slice(0,8).map(u => `
      <div class="user-list-item">
        <div style="display:flex;align-items:center">
          <div class="user-avatar">${(u.name||'?').charAt(0).toUpperCase()}</div>
          <div class="user-info">
            <div class="user-name">${u.name}</div>
            <div class="user-email">${u.email}</div>
          </div>
        </div>
        <div class="user-meta">
          ${badge(u.role)}
          <div class="user-date">${fmtDate(u.createdAt)}</div>
        </div>
      </div>`).join('') || emptyHtml('👤', 'Nincs adat');

    setContent(`
      <div class="page-header">
        <h2 class="page-title">Statisztikák</h2>
        <p class="page-sub">Felhasználói aktivitás és platform használati adatok</p>
      </div>
      <div class="stats-grid" style="grid-template-columns:repeat(4,1fr)">
        ${[
          { icon:'📝', value: asg.total||0, label:'Összes feladat', cc:'linear-gradient(90deg,#3b82f6,#6366f1)' },
          { icon:'✅', value: asg.submittedCount||0, label:'Beküldött megoldás', cc:'linear-gradient(90deg,#10b981,#059669)' },
          { icon:'⭐', value: asg.avgGrade ? asg.avgGrade.toFixed(1) : '—', label:'Átlagjegy', cc:'linear-gradient(90deg,#f59e0b,#d97706)' },
          { icon:'📚', value: (asg.bySubject||[]).length, label:'Aktív tantárgy', cc:'linear-gradient(90deg,#8b5cf6,#7c3aed)' },
        ].map(c=>`
          <div class="stat-card" style="--cc:${c.cc}">
            <div class="stat-icon">${c.icon}</div>
            <div class="stat-value">${c.value}</div>
            <div class="stat-label">${c.label}</div>
          </div>`).join('')}
      </div>
      <div class="grid-21">
        <div class="card">
          <div class="card-header"><span class="card-title">📈 Regisztrációk (utolsó 30 nap)</span></div>
          <div class="chart-wrap"><canvas id="chart-reg"></canvas></div>
        </div>
        <div class="card">
          <div class="card-header"><span class="card-title">🥧 Szerepkör megoszlás</span></div>
          <div class="chart-wrap"><canvas id="chart-roles"></canvas></div>
        </div>
      </div>
      <div class="grid-2">
        <div class="card">
          <div class="card-header"><span class="card-title">📊 Tantárgyak szerinti feladatok</span></div>
          <div class="chart-wrap"><canvas id="chart-subj"></canvas></div>
        </div>
        <div class="card">
          <div class="card-header"><span class="card-title">👤 Legutóbbi regisztrálók</span></div>
          ${userItems}
        </div>
      </div>`);

    const ticks = { color: '#64748b', font: { size: 11 } };
    const grid = { color: 'rgba(255,255,255,0.05)' };
    const tooltipBase = { backgroundColor: 'rgba(15,23,42,0.96)', titleColor: '#e2e8f0', bodyColor: '#94a3b8', borderColor: 'rgba(59,130,246,0.3)', borderWidth: 1 };

    // Registration line chart
    const regDays = act.registrationsByDay || [];
    new Chart(document.getElementById('chart-reg'), {
      type: 'line',
      data: {
        labels: regDays.map(d=>d._id),
        datasets: [{ label: 'Regisztrációk', data: regDays.map(d=>d.count), borderColor: '#3b82f6', backgroundColor: 'rgba(59,130,246,0.1)', tension: 0.4, fill: true, pointBackgroundColor: '#3b82f6', pointRadius: 3 }]
      },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: tooltipBase }, scales: { x: { ticks: { ...ticks, maxRotation: 40 }, grid }, y: { ticks, grid, beginAtZero: true } } }
    });

    // Role doughnut
    const roleData = act.roleDistribution || [];
    new Chart(document.getElementById('chart-roles'), {
      type: 'doughnut',
      data: {
        labels: roleData.map(r=>ROLE_LABEL[r._id]||r._id),
        datasets: [{ data: roleData.map(r=>r.count), backgroundColor: roleData.map(r=>ROLE_CLR[r._id]||'#64748b'), borderWidth: 2 }]
      },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'right', labels: { color: '#94a3b8', font: { size: 13 }, padding: 14 } }, tooltip: tooltipBase } }
    });

    // Subject bar chart
    const subj = asg.bySubject || [];
    new Chart(document.getElementById('chart-subj'), {
      type: 'bar',
      data: { labels: subj.map(s=>s._id), datasets: [{ label: 'Feladatok', data: subj.map(s=>s.count), backgroundColor: 'rgba(99,102,241,0.65)', borderColor: '#6366f1', borderWidth: 1, borderRadius: 5 }] },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: tooltipBase }, scales: { x: { ticks: { ...ticks, maxRotation: 35 }, grid }, y: { ticks, grid, beginAtZero: true } } }
    });

  } catch (err) {
    setContent(`<div class="card"><p style="color:#f87171;text-align:center">⚠️ ${err.message}</p></div>`);
  }
}

/* ── Page: System ────────────────────────────────── */
async function renderSystem() {
  setContent(loadingHtml());
  try {
    const info = await API.getSystemInfo();
    const dbColors = { connected: 'green', connecting: 'yellow', disconnected: 'red', disconnecting: 'red' };
    const dbLabel = { connected: 'Csatlakozva', disconnected: 'Nincs kapcsolat', connecting: 'Csatlakozás...', disconnecting: 'Lecsatlakozás...' };

    const keyRows = Object.entries(info.apiKeys||{}).map(([name, val]) => `
      <div class="info-row">
        <span class="info-key">${name}</span>
        ${val
          ? `<span class="info-val" style="color:#4ade80"><span class="dot dot-green"></span>${val}</span>`
          : `<span style="font-size:13px;color:#f87171"><span class="dot dot-red"></span>Hiányzik</span>`}
      </div>`).join('');

    const uptime = info.uptime ? `${Math.floor(info.uptime/3600)}h ${Math.floor((info.uptime%3600)/60)}m` : '—';

    setContent(`
      <div class="page-header">
        <h2 class="page-title">Rendszer</h2>
        <p class="page-sub">Szerver állapot, API kulcsok és adminisztratív beállítások</p>
      </div>
      <div class="grid-2">
        <div class="card">
          <div class="card-header"><span class="card-title">🗄️ Adatbázis állapot</span></div>
          <div class="info-row">
            <span class="info-key">Kapcsolat</span>
            <span class="info-val"><span class="dot dot-${dbColors[info.db?.state]||'red'}"></span>${dbLabel[info.db?.state]||info.db?.state||'—'}</span>
          </div>
          <div class="info-row">
            <span class="info-key">Ready state</span>
            <span class="info-val">${info.db?.readyState ?? '—'}</span>
          </div>
        </div>

        <div class="card">
          <div class="card-header"><span class="card-title">🔑 API kulcsok</span></div>
          ${keyRows}
        </div>

        <div class="card">
          <div class="card-header"><span class="card-title">⚙️ Szerver infó</span></div>
          ${[
            ['Node.js verzió', info.node||'—'],
            ['Platform', info.platform||'—'],
            ['Uptime', uptime],
            ['Szerver idő', fmtDatetime(info.serverTime)],
            ['Cost hónap', info.costMonth||'—'],
          ].map(([k,v])=>`<div class="info-row"><span class="info-key">${k}</span><span class="info-val" style="font-size:12px">${v}</span></div>`).join('')}
        </div>

        <div class="card">
          <div class="card-header"><span class="card-title">🔐 Admin fiók</span></div>
          <div class="info-row">
            <span class="info-key">Felhasználónév</span>
            <span class="info-val">${Auth.user()?.name||'—'}</span>
          </div>
          <div class="info-row">
            <span class="info-key">Szerepkör</span>
            <span><span class="badge badge-admin">Admin</span></span>
          </div>
          <div style="margin-top:16px" id="pass-section">
            <button class="btn btn-ghost" onclick="showPassForm()">🔑 Jelszó megváltoztatása</button>
          </div>
        </div>
      </div>`);
  } catch (err) {
    setContent(`<div class="card"><p style="color:#f87171;text-align:center">⚠️ ${err.message}</p></div>`);
  }
}

function showPassForm() {
  document.getElementById('pass-section').innerHTML = `
    <div class="form-group">
      <label class="form-label">Új jelszó (min. 8 karakter)</label>
      <div class="pass-wrap">
        <input class="input" id="new-pass" type="password" placeholder="••••••••">
        <button type="button" class="pass-toggle" onclick="togglePassVis('new-pass',this)">👁️</button>
      </div>
    </div>
    <div class="form-group">
      <label class="form-label">Jelszó megerősítése</label>
      <input class="input" id="confirm-pass" type="password" placeholder="••••••••">
    </div>
    <div style="display:flex;gap:9px;margin-top:4px">
      <button class="btn btn-primary" id="save-pass-btn" onclick="saveAdminPass()">Mentés</button>
      <button class="btn btn-ghost" onclick="renderSystem()">Mégse</button>
    </div>`;
}

async function saveAdminPass() {
  const p1 = document.getElementById('new-pass').value;
  const p2 = document.getElementById('confirm-pass').value;
  if (p1.length < 8) { Toast.error('A jelszó legalább 8 karakter legyen!'); return; }
  if (p1 !== p2) { Toast.error('A két jelszó nem egyezik!'); return; }
  const btn = document.getElementById('save-pass-btn');
  btn.disabled = true; btn.textContent = 'Mentés...';
  try {
    await API.updateUser(Auth.user()?.id, { password: p1 });
    Toast.success('Jelszó sikeresen megváltoztatva!');
    renderSystem();
  } catch (err) { Toast.error(err.message); btn.disabled = false; btn.textContent = 'Mentés'; }
}

/* ── App ─────────────────────────────────────────── */
const App = {
  logout() {
    Auth.logout();
    Router.navigate('login');
  },
  init() {
    Router.register('login',       renderLogin);
    Router.register('dashboard',   () => { renderShell(); setActiveNav('dashboard'); renderDashboard(); });
    Router.register('users',       () => { renderShell(); setActiveNav('users'); renderUsers(); });
    Router.register('data',        () => { renderShell(); setActiveNav('data'); renderData(); });
    Router.register('costs',       () => { renderShell(); setActiveNav('costs'); renderCosts(); });
    Router.register('statistics',  () => { renderShell(); setActiveNav('statistics'); renderStatistics(); });
    Router.register('system',      () => { renderShell(); setActiveNav('system'); renderSystem(); });
    Router.init();
  },
};

App.init();
