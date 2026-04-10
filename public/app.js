// ============================================================
//  FlowMind v2 — app.js
//  100% API-driven. Auth via JWT stored in sessionStorage.
// ============================================================

// ── CONSTANTS ───────────────────────────────────────────────
const CAT_COLORS = {
  Design:      '#a78bfa',
  Engineering: '#3b82f6',
  Marketing:   '#10b981',
  Research:    '#f59e0b',
  Other:       '#ef4444'
};

// ── STATE ────────────────────────────────────────────────────
let AUTH_TOKEN   = null;
let currentUser  = null;
let tasks        = [];
let workflows    = [];
let editId       = null;
let dragId       = null;
let calY         = new Date().getFullYear();
let calM         = new Date().getMonth();
let filt         = { status: 'all', cat: null };

// ── UTILITIES ────────────────────────────────────────────────
const esc = s => String(s)
  .replace(/&/g,'&amp;').replace(/</g,'&lt;')
  .replace(/>/g,'&gt;').replace(/"/g,'&quot;');

const isOverdue = t =>
  t.deadline && new Date(t.deadline) < new Date() && t.status !== 'done';

// ── TOAST ────────────────────────────────────────────────────
function toast(msg, type = 'info') {
  const c  = document.getElementById('toasts');
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.textContent = msg;
  c.appendChild(el);
  requestAnimationFrame(() => el.classList.add('show'));
  setTimeout(() => {
    el.classList.remove('show');
    setTimeout(() => el.remove(), 250);
  }, 4000);
}

// ── API HELPER ───────────────────────────────────────────────
async function api(method, path, body) {
  try {
    const opts = {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(AUTH_TOKEN ? { 'Authorization': 'Bearer ' + AUTH_TOKEN } : {})
      }
    };
    if (body !== undefined) opts.body = JSON.stringify(body);

    const res  = await fetch('/api' + path, opts);
    const text = await res.text();

    let data;
    try {
      data = JSON.parse(text);
    } catch {
      return { success: false, error: 'Server returned non-JSON: ' + text.slice(0, 100) };
    }

    // Auto-logout on 401
    if (res.status === 401 && path !== '/auth/login' && path !== '/auth/register') {
      doLogout();
      return { success: false, error: 'Session expired — please log in again' };
    }

    return data;
  } catch (err) {
    return { success: false, error: 'Network error: ' + err.message };
  }
}

// ── AUTH HELPERS ─────────────────────────────────────────────
function showError(elId, msg) {
  const el = document.getElementById(elId);
  if (!el) return;
  el.textContent = msg;
  el.classList.add('show');
}

function clearError(elId) {
  const el = document.getElementById(elId);
  if (el) { el.textContent = ''; el.classList.remove('show'); }
}

function setBtn(id, html, disabled) {
  const el = document.getElementById(id);
  if (!el) return;
  el.innerHTML = html;
  el.disabled  = disabled;
}

// ── SWITCH LOGIN / REGISTER TAB ──────────────────────────────
function switchAuthTab(tab) {
  // Update tab buttons
  document.getElementById('tab-login').classList.toggle('active',    tab === 'login');
  document.getElementById('tab-register').classList.toggle('active', tab === 'register');

  // Show/hide forms
  document.getElementById('form-login').style.display    = tab === 'login'    ? 'block' : 'none';
  document.getElementById('form-register').style.display = tab === 'register' ? 'block' : 'none';

  // Clear errors
  clearError('login-error');
  clearError('register-error');
}

// ── LOGIN ─────────────────────────────────────────────────────
async function doLogin() {
  clearError('login-error');

  const email    = (document.getElementById('login-email').value || '').trim();
  const password = (document.getElementById('login-password').value || '');

  if (!email)    { showError('login-error', 'Please enter your email.');    return; }
  if (!password) { showError('login-error', 'Please enter your password.'); return; }

  setBtn('login-btn', '<span class="spin"></span> Signing in…', true);

  const data = await api('POST', '/auth/login', { email, password });

  setBtn('login-btn', 'Sign In', false);

  if (!data || !data.success) {
    showError('login-error', data?.error || 'Login failed. Check email and password.');
    return;
  }

  onAuthSuccess(data.token, data.user);
}

// ── REGISTER ─────────────────────────────────────────────────
async function doRegister() {
  clearError('register-error');

  const name     = (document.getElementById('reg-name').value     || '').trim();
  const email    = (document.getElementById('reg-email').value    || '').trim();
  const password = (document.getElementById('reg-password').value || '');

  if (!name)          { showError('register-error', 'Please enter your name.');               return; }
  if (!email)         { showError('register-error', 'Please enter your email.');              return; }
  if (!password)      { showError('register-error', 'Please enter a password.');              return; }
  if (password.length < 6) { showError('register-error', 'Password must be at least 6 characters.'); return; }

  setBtn('register-btn', '<span class="spin"></span> Creating account…', true);

  const data = await api('POST', '/auth/register', { name, email, password });

  setBtn('register-btn', 'Create Account', false);

  if (!data || !data.success) {
    showError('register-error', data?.error || 'Registration failed.');
    return;
  }

  onAuthSuccess(data.token, data.user);
}

// ── ON AUTH SUCCESS ───────────────────────────────────────────
function onAuthSuccess(token, user) {
  AUTH_TOKEN  = token;
  currentUser = user;

  // Persist session
  try {
    sessionStorage.setItem('fm_token', token);
    sessionStorage.setItem('fm_user',  JSON.stringify(user));
  } catch (e) { /* sessionStorage unavailable */ }

  // Update UI
  const nameEl   = document.getElementById('user-name');
  const avatarEl = document.getElementById('user-avatar');
  if (nameEl)   nameEl.textContent   = user.name;
  if (avatarEl) avatarEl.textContent = (user.name || '?').charAt(0).toUpperCase();

  // Switch screens
  document.getElementById('auth-screen').style.display = 'none';
  document.getElementById('app').style.display         = 'grid';

  // Load data
  loadAllData();
}

// ── LOGOUT ────────────────────────────────────────────────────
function doLogout() {
  AUTH_TOKEN  = null;
  currentUser = null;
  tasks       = [];
  workflows   = [];

  try {
    sessionStorage.removeItem('fm_token');
    sessionStorage.removeItem('fm_user');
  } catch (e) { /* ignore */ }

  document.getElementById('app').style.display         = 'none';
  document.getElementById('auth-screen').style.display = 'flex';

  // Clear form fields
  ['login-email','login-password','reg-name','reg-email','reg-password'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  clearError('login-error');
  clearError('register-error');
  switchAuthTab('login');
}

// ── LOAD DATA ─────────────────────────────────────────────────
async function loadAllData() {
  const [tRes, wRes, aiRes] = await Promise.all([
    api('GET', '/tasks'),
    api('GET', '/workflows'),
    api('GET', '/ai/provider')
  ]);
  if (tRes?.success)  tasks     = tRes.data  || [];
  if (wRes?.success)  workflows = wRes.data  || [];
  if (aiRes?.success) updateAIBadge(aiRes.data);
  renderBoard();
  updateStats();
  renderWfs();
}

// Set Groq badge labels (always Groq)
function updateAIBadge(info) {
  const badge = document.getElementById('chat-model-badge');
  if (badge) badge.textContent = 'Groq · FREE';
  const panelTitle = document.getElementById('gpt-panel-title');
  if (panelTitle) panelTitle.textContent = 'Groq AI Analysis';
  window._aiLabel = 'Groq AI';
}

// ── PAGE NAVIGATION ───────────────────────────────────────────
function goPage(id) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
  const page = document.getElementById('page-' + id);
  if (page) page.classList.add('active');
  const map = { board:0, workflows:1, calendar:2, analytics:3 };
  if (map[id] !== undefined) {
    document.querySelectorAll('.nav-tab')[map[id]]?.classList.add('active');
  }
  if (id === 'analytics') loadAnalytics();
  if (id === 'calendar')  renderCal();
  if (id === 'workflows') renderWfs();
}

function setSbActive(el) {
  document.querySelectorAll('.sb-item').forEach(i => i.classList.remove('active'));
  el.classList.add('active');
}

// ── TASK MODAL ────────────────────────────────────────────────
function openTaskModal(id) {
  editId   = id || null;
  const t  = id ? tasks.find(x => x._id === id) : null;

  document.getElementById('task-modal-title').textContent = id ? 'Edit Task' : 'New Task';
  document.getElementById('f-title').value    = t?.title    || '';
  document.getElementById('f-desc').value     = t?.desc     || '';
  document.getElementById('f-cat').value      = t?.category || 'Design';
  document.getElementById('f-status').value   = t?.status   || 'todo';
  document.getElementById('f-priority').value = t?.priority || 'medium';
  document.getElementById('f-deadline').value = t?.deadline ? t.deadline.slice(0,10) : '';
  document.getElementById('f-title').dataset.gptEnhanced = '';
  resetGptResult();
  document.getElementById('task-overlay').classList.add('open');
  setTimeout(() => document.getElementById('f-title').focus(), 80);
}

function closeTaskModal() {
  document.getElementById('task-overlay').classList.remove('open');
  editId = null;
}

function resetGptResult() {
  const r = document.getElementById('gpt-result');
  r.classList.remove('show');
  r.innerHTML = '';
  document.getElementById('gpt-loading').style.display = 'none';
  document.querySelectorAll('.gpt-btn').forEach(b => b.classList.remove('active'));
}

// ── TASK CRUD ─────────────────────────────────────────────────
async function saveTask() {
  const title = (document.getElementById('f-title').value || '').trim();
  if (!title) { toast('Title is required', 'err'); return; }

  const btn = document.getElementById('save-task-btn');
  btn.disabled = true;
  btn.innerHTML = '<span class="spin"></span>';

  const body = {
    title,
    desc:        (document.getElementById('f-desc').value || '').trim(),
    category:    document.getElementById('f-cat').value,
    status:      document.getElementById('f-status').value,
    priority:    document.getElementById('f-priority').value,
    deadline:    document.getElementById('f-deadline').value || null,
    gptEnhanced: document.getElementById('f-title').dataset.gptEnhanced === 'true'
  };

  const data = editId
    ? await api('PUT',  '/tasks/' + editId, body)
    : await api('POST', '/tasks',           body);

  btn.disabled = false;
  btn.textContent = 'Save Task';

  if (!data?.success) {
    toast(data?.error || 'Save failed', 'err');
    return;
  }

  if (editId) {
    const idx = tasks.findIndex(t => t._id === editId);
    if (idx >= 0) tasks[idx] = data.data;
    toast('Task updated', 'ok');
  } else {
    tasks.unshift(data.data);
    toast('Task created', 'ok');
  }

  closeTaskModal();
  renderBoard();
  updateStats();
}

async function deleteTask(id) {
  if (!confirm('Delete this task?')) return;
  const data = await api('DELETE', '/tasks/' + id);
  if (data?.success) {
    tasks = tasks.filter(t => t._id !== id);
    renderBoard();
    updateStats();
    toast('Task deleted');
  } else {
    toast(data?.error || 'Delete failed', 'err');
  }
}

// ── RENDER BOARD ──────────────────────────────────────────────
function renderBoard() {
  ['todo','inprogress','done'].forEach(s => {
    const el = document.getElementById('kb-' + s);
    let list = tasks.filter(t => t.status === s);
    if (filt.cat) list = list.filter(t => t.category === filt.cat);
    el.innerHTML = list.length
      ? list.map(taskHtml).join('')
      : '<div style="font-size:10px;color:var(--text3);text-align:center;padding:16px 0">Drop tasks here</div>';
    document.getElementById('kcnt-' + s).textContent = list.length;
  });
  document.getElementById('cnt-all').textContent = tasks.length;
}

function taskHtml(t) {
  const cc   = CAT_COLORS[t.category] || '#888';
  const over = isOverdue(t);
  const dl   = t.deadline
    ? `<span class="dl-tag${over ? ' overdue' : ''}">📅 ${t.deadline.slice(0,10)}</span>`
    : '';
  const gptB = t.gptEnhanced ? '<span class="ai-tag">Groq</span>' : '';
  return `<div class="task-card${over ? ' overdue-card' : ''}"
    draggable="true" id="tc-${t._id}"
    ondragstart="dStart(event,'${t._id}')"
    ondragend="dEnd(event)">
    <div class="tc-head">
      <div class="tc-title">${esc(t.title)}</div>
      <div class="tc-acts">
        <button class="tc-btn" onclick="openTaskModal('${t._id}')">✎</button>
        <button class="tc-btn del" onclick="deleteTask('${t._id}')">✕</button>
      </div>
    </div>
    ${t.desc ? `<div class="tc-desc">${esc(t.desc)}</div>` : ''}
    <div class="tc-meta">
      <span class="p-badge p-${t.priority}">${t.priority}</span>
      <span class="cat-tag" style="background:${cc}18;color:${cc}">${t.category}</span>
      ${dl}${gptB}
    </div>
  </div>`;
}

// ── DRAG & DROP ───────────────────────────────────────────────
function dStart(e, id) {
  dragId = id;
  setTimeout(() => document.getElementById('tc-' + id)?.classList.add('dragging'), 0);
}
function dEnd() {
  document.querySelectorAll('.task-card').forEach(c => c.classList.remove('dragging'));
  dragId = null;
}
function dOver(e, col)  { e.preventDefault(); document.getElementById('col-' + col).classList.add('dragover'); }
function dLeave(e)       { e.currentTarget.classList.remove('dragover'); }

async function dDrop(e, col) {
  e.preventDefault();
  e.currentTarget.classList.remove('dragover');
  if (!dragId) return;

  const task = tasks.find(t => t._id === dragId);
  if (!task || task.status === col) return;

  const old    = task.status;
  task.status  = col;        // optimistic
  renderBoard();
  updateStats();

  const data = await api('PATCH', `/tasks/${dragId}/status`, { status: col });
  if (!data?.success) {
    task.status = old;       // rollback
    renderBoard();
    updateStats();
    toast('Update failed', 'err');
    return;
  }
  if (col === 'done' && old !== 'done') {
    toast(`"${task.title}" done! 🎉`, 'ok');
  }
}

// ── FILTER ────────────────────────────────────────────────────
function applyFilter(status, cat) {
  filt = { status: status || 'all', cat };
  const lbl = cat
    ? `Category: ${cat}`
    : (status === 'all' || !status) ? 'Showing all tasks' : `Status: ${status}`;
  document.getElementById('filter-lbl').textContent = lbl;
  renderBoard();
}

// ── STATS ─────────────────────────────────────────────────────
function updateStats() {
  const overdue = tasks.filter(isOverdue).length;
  document.getElementById('s-total').textContent   = tasks.length;
  document.getElementById('s-prog').textContent    = tasks.filter(t => t.status === 'inprogress').length;
  document.getElementById('s-done').textContent    = tasks.filter(t => t.status === 'done').length;
  document.getElementById('s-overdue').textContent = overdue;
}

// ── GPT ACTIONS ───────────────────────────────────────────────
async function gptAction(type) {
  const title = (document.getElementById('f-title').value || '').trim();
  const desc  = (document.getElementById('f-desc').value  || '').trim();
  const dl    = document.getElementById('f-deadline').value;
  if (!title) { toast('Enter a task title first', 'err'); return; }

  document.querySelectorAll('.gpt-btn').forEach(b => b.classList.remove('active'));
  const ids = { subtasks:'gab-subtasks', priority:'gab-priority', automation:'gab-automation', notify:'gab-notify' };
  document.getElementById(ids[type])?.classList.add('active');

  const loading = document.getElementById('gpt-loading');
  const result  = document.getElementById('gpt-result');
  loading.style.display = 'block';
  result.classList.remove('show');
  result.innerHTML = '';

  const endpoints = {
    subtasks:   '/ai/subtasks',
    priority:   '/ai/priority',
    automation: '/ai/automation',
    notify:     '/ai/notify'
  };
  const bodies = {
    subtasks:   { taskTitle: title, taskDesc: desc },
    priority:   { taskTitle: title, taskDesc: desc, deadline: dl || null },
    automation: { taskTitle: title, taskDesc: desc },
    notify:     { taskTitle: title, taskDesc: desc, deadline: dl || null, priority: document.getElementById('f-priority').value }
  };

  const data = await api('POST', endpoints[type], bodies[type]);
  loading.style.display = 'none';

  if (!data?.success) {
    toast(data?.error || 'AI error — check GROQ_API_KEY in your .env file', 'err');
    return;
  }

  result.innerHTML = renderGptResult(type, data.data, title);
  result.classList.add('show');

  if (type === 'priority' && data.data?.priority) {
    document.getElementById('f-priority').value = data.data.priority;
    document.getElementById('f-title').dataset.gptEnhanced = 'true';
  }
  toast('AI analysis complete ✓', 'gpt');
}

function renderGptResult(type, data, title) {
  if (type === 'subtasks') {
    const steps = (data.subtasks || []).map((s, i) =>
      `<div class="subtask-row"><div class="st-num">${i+1}</div><div>${esc(s.title || s)}</div></div>`
    ).join('');
    return `
      <div class="gpt-result-section">
        <div class="gpt-result-label">📋 Subtasks</div>${steps}
      </div>
      <div class="gpt-result-section" style="display:flex;gap:16px">
        <div><div class="gpt-result-label">⏱ Time</div>
          <div style="font-size:13px;font-weight:600;color:var(--text);font-family:var(--mono)">${data.estimated_hours}h</div></div>
        <div><div class="gpt-result-label">🔢 Complexity</div>
          <div style="font-size:13px;font-weight:600;color:var(--text);font-family:var(--mono);text-transform:capitalize">${data.complexity || '—'}</div></div>
      </div>
      ${data.tip ? `<div class="gpt-result-section"><div class="gpt-result-label">💡 Tip</div><div class="tip-box">${esc(data.tip)}</div></div>` : ''}`;
  }

  if (type === 'priority') {
    const sc = data.score >= 8 ? 'var(--red)' : data.score >= 5 ? 'var(--amber)' : 'var(--green)';
    const factors = (data.factors || []).map(f =>
      `<span style="font-size:9px;padding:2px 7px;background:var(--surface3);border-radius:4px;color:var(--text2)">${esc(f)}</span>`
    ).join('');
    return `
      <div class="gpt-result-section">
        <div style="display:flex;align-items:center;gap:12px;margin-bottom:10px">
          <div><div class="gpt-result-label">Priority</div>
            <span class="p-badge p-${data.priority}" style="font-size:11px;padding:3px 10px">${(data.priority||'').toUpperCase()}</span></div>
          <div><div class="gpt-result-label">Score</div>
            <span style="font-size:18px;font-weight:700;font-family:var(--mono);color:${sc}">${data.score}/10</span></div>
        </div>
        <div class="gpt-result-label">Why</div>
        <div class="tip-box" style="margin-bottom:8px">${esc(data.reasoning || '')}</div>
        <div class="gpt-result-label">Factors</div>
        <div style="display:flex;gap:4px;flex-wrap:wrap">${factors}</div>
      </div>
      ${data.recommendation ? `<div class="gpt-result-section"><div class="gpt-result-label">✅ Action</div><div class="tip-box">${esc(data.recommendation)}</div></div>` : ''}`;
  }

  if (type === 'automation') {
    const cards = (data.workflows || []).map(w => `
      <div style="background:var(--surface2);border:1px solid var(--border);border-radius:var(--radius);padding:10px 12px;margin-bottom:7px">
        <div style="font-size:11px;font-weight:600;color:var(--text);margin-bottom:5px">${esc(w.name)}</div>
        <div style="display:flex;align-items:center;gap:5px;margin-bottom:5px;flex-wrap:wrap">
          <span class="wf-chip t">⚡ ${esc(w.trigger)}</span>
          <span class="wf-arr">→</span>
          <span class="wf-chip a">✦ ${esc(w.action)}</span>
        </div>
        <div style="font-size:10px;color:var(--text3);margin-bottom:7px">${esc(w.benefit)}</div>
        <button class="btn btn-gpt btn-sm" style="font-size:10px"
          onclick="preCreateWf('${esc(w.name).replace(/'/g,"\\'")}','${w.trigger}','${w.action}')">
          + Create this workflow
        </button>
      </div>`).join('');
    return `<div class="gpt-result-section"><div class="gpt-result-label">⚡ Suggested Automations</div>${cards}</div>
    ${data.summary ? `<div class="tip-box">${esc(data.summary)}</div>` : ''}`;
  }

  if (type === 'notify') {
    const email = data.email || {};
    const slack = data.slack || {};
    const scMap = { good:'var(--green)', warning:'var(--amber)', danger:'var(--red)' };
    const sc    = scMap[slack.attachment?.color] || 'var(--ai)';

    const emailHtml = `
      <div class="email-preview">
        <div class="email-header">
          <div class="email-field"><span class="email-field-lbl">To:</span><span class="email-field-val">${esc(email.to||'team@company.com')}</span></div>
          <div class="email-field"><span class="email-field-lbl">Sub:</span><span class="email-field-val">${esc(email.subject||'')}</span></div>
        </div>
        <div class="email-body-text">${esc(email.body||'').replace(/\n/g,'<br>')}</div>
        <div style="margin-top:10px;display:flex;justify-content:flex-end">
          <button class="copy-btn" onclick="copyText('${esc((email.subject+'\\n\\n'+email.body)||'').replace(/'/g,"\\'")}')">📋 Copy email</button>
        </div>
      </div>`;

    const slackHtml = `
      <div class="slack-preview">
        <div class="slack-workspace">🔷 ${esc(slack.channel||'#tasks')}</div>
        <div class="slack-msg">
          <div class="slack-avatar">🤖</div>
          <div class="slack-content">
            <span class="slack-sender">FlowMind Bot</span>
            <span class="slack-time">just now</span>
            <div class="slack-text">${esc(slack.message||'')}</div>
            ${slack.attachment ? `
              <div class="slack-block" style="border-left-color:${sc}">
                <div class="slack-block-title">${esc(slack.attachment.title||title)}</div>
                <div class="slack-block-text">${esc(slack.attachment.text||'')}</div>
              </div>` : ''}
          </div>
        </div>
        <div style="margin-top:10px;display:flex;justify-content:flex-end">
          <button class="copy-btn" onclick="copyText('${esc(slack.message||'').replace(/'/g,"\\'")}')">📋 Copy Slack</button>
        </div>
      </div>`;

    return `
      <div class="gpt-result-section">
        <div id="notif-tabs" class="notif-tabs">
          <button class="notif-tab active" onclick="switchNotifTab('email',this)">📧 Email</button>
          <button class="notif-tab" onclick="switchNotifTab('slack',this)">💬 Slack</button>
        </div>
        <div class="notif-preview">
          <div id="np-email">${emailHtml}</div>
          <div id="np-slack" style="display:none">${slackHtml}</div>
        </div>
      </div>`;
  }

  return `<pre style="font-size:10px;color:var(--text2)">${esc(JSON.stringify(data,null,2))}</pre>`;
}

function switchNotifTab(tab, btn) {
  document.querySelectorAll('#notif-tabs .notif-tab').forEach(t => t.classList.remove('active'));
  btn.classList.add('active');
  document.getElementById('np-email').style.display = tab === 'email' ? 'block' : 'none';
  document.getElementById('np-slack').style.display = tab === 'slack' ? 'block' : 'none';
}

function copyText(text) {
  navigator.clipboard.writeText(text.replace(/\\n/g, '\n'))
    .then(() => toast('Copied!', 'ok'))
    .catch(() => toast('Copy failed — try manually', 'err'));
}

function preCreateWf(name, trigger, action) {
  document.getElementById('wf-name').value    = name;
  document.getElementById('wf-trigger').value = trigger;
  document.getElementById('wf-action').value  = action;
  closeTaskModal();
  goPage('workflows');
  openWfModal();
  toast('Workflow pre-filled — review and save', 'info');
}

// ── GPT CHAT ──────────────────────────────────────────────────
async function sendChat() {
  const input = document.getElementById('chat-input');
  const msg   = (input.value || '').trim();
  if (!msg) return;
  input.value = '';
  addChatMsg(msg, 'user');

  const btn = document.getElementById('chat-send-btn');
  btn.disabled    = true;
  btn.textContent = '...';

  const data = await api('POST', '/ai/chat', { message: msg });

  addChatMsg(
    data?.data?.reply || data?.error || 'Error — check GROQ_API_KEY in your .env file',
    'ai'
  );
  btn.disabled    = false;
  btn.textContent = 'Send';
}

function addChatMsg(text, role) {
  const msgs = document.getElementById('chat-msgs');
  msgs.innerHTML += `
    <div class="msg ${role}">
      <div class="msg-role">${role === 'ai' ? (window._aiLabel || 'AI Assistant') : 'You'}</div>
      ${esc(text)}
    </div>`;
  msgs.scrollTop = msgs.scrollHeight;
}

function quickChat(text) {
  document.getElementById('chat-input').value = text;
  sendChat();
}

// ── WORKFLOWS ─────────────────────────────────────────────────
function openWfModal()  { document.getElementById('wf-overlay').classList.add('open'); }
function closeWfModal() { document.getElementById('wf-overlay').classList.remove('open'); }

async function saveWf() {
  const name = (document.getElementById('wf-name').value || '').trim();
  if (!name) { toast('Workflow name required', 'err'); return; }

  const data = await api('POST', '/workflows', {
    name,
    trigger: document.getElementById('wf-trigger').value,
    action:  document.getElementById('wf-action').value
  });

  if (!data?.success) { toast(data?.error || 'Failed to create workflow', 'err'); return; }

  workflows.unshift(data.data);
  toast('Workflow created', 'ok');
  closeWfModal();
  renderWfs();
  document.getElementById('wf-name').value = '';
}

async function toggleWf(id) {
  const data = await api('PATCH', `/workflows/${id}/toggle`);
  if (data?.success) {
    const w = workflows.find(x => x._id === id);
    if (w) w.active = data.data.active;
    renderWfs();
  }
}

async function deleteWf(id) {
  const data = await api('DELETE', `/workflows/${id}`);
  if (data?.success) {
    workflows = workflows.filter(x => x._id !== id);
    renderWfs();
    toast('Workflow removed');
  }
}

function renderWfs() {
  const el = document.getElementById('wf-list');
  if (!workflows.length) {
    el.innerHTML = `<div style="text-align:center;padding:36px;color:var(--text3);font-size:12px">
      No workflows yet. Create one above or ask GPT for suggestions.
    </div>`;
    return;
  }

  const tl = {
    'task-done':     'Task marked Done',
    'task-created':  'Task created',
    'high-priority': 'High-priority added',
    'task-overdue':  'Task overdue'
  };
  const al = {
    notify:        'Notify',
    'gpt-suggest': 'GPT: Next task',
    'gpt-summary': 'GPT: Summary',
    'gpt-email':   'GPT: Email',
    'gpt-slack':   'GPT: Slack',
    'move-done':   'Auto-Done'
  };

  el.innerHTML = workflows.map(w => `
    <div class="wf-card">
      <div class="wf-card-head">
        <div>
          <div class="wf-name">${esc(w.name)}</div>
          <div class="wf-runs">${w.runs} run${w.runs !== 1 ? 's' : ''}</div>
        </div>
        <div style="display:flex;align-items:center;gap:8px">
          <span class="wf-status ${w.active ? 'wf-on' : 'wf-off'}">${w.active ? 'Active' : 'Paused'}</span>
          <label class="toggle-wrap">
            <input type="checkbox" ${w.active ? 'checked' : ''} onchange="toggleWf('${w._id}')">
            <span class="t-slider"></span>
          </label>
          <button class="tc-btn del" onclick="deleteWf('${w._id}')">✕</button>
        </div>
      </div>
      <div class="wf-flow">
        <span class="wf-chip t">⚡ ${tl[w.trigger] || w.trigger}</span>
        <span class="wf-arr">→</span>
        <span class="wf-chip ${w.action.startsWith('gpt') ? 'a' : 'n'}">✦ ${al[w.action] || w.action}</span>
      </div>
    </div>`).join('');
}

// ── CALENDAR ──────────────────────────────────────────────────
function renderCal() {
  const months = ['January','February','March','April','May','June',
    'July','August','September','October','November','December'];
  document.getElementById('cal-label').textContent = `${months[calM]} ${calY}`;

  const grid = document.getElementById('cal-grid');
  const fd   = new Date(calY, calM, 1).getDay();
  const dim  = new Date(calY, calM + 1, 0).getDate();
  const today = new Date();

  let html = '';
  for (let i = 0; i < fd; i++) html += '<div class="cal-cell dim"></div>';
  for (let d = 1; d <= dim; d++) {
    const isToday = today.getFullYear() === calY && today.getMonth() === calM && today.getDate() === d;
    const ds   = `${calY}-${String(calM+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    const dots = tasks.filter(t => t.deadline && t.deadline.slice(0,10) === ds)
      .slice(0, 3)
      .map(t => {
        const c = CAT_COLORS[t.category] || '#888';
        return `<div class="cal-dot" style="background:${c}18;color:${c}">${esc(t.title.slice(0,12))}</div>`;
      }).join('');
    html += `<div class="cal-cell${isToday ? ' today' : ''}">
      <div class="cal-day">${d}</div>
      ${dots}
    </div>`;
  }
  grid.innerHTML = html;
}

function calShift(d) {
  calM += d;
  if (calM > 11) { calM = 0; calY++; }
  if (calM < 0)  { calM = 11; calY--; }
  renderCal();
}

// ── ANALYTICS ─────────────────────────────────────────────────
async function loadAnalytics() {
  const data = await api('GET', '/analytics');
  if (!data?.success) return;

  const d    = data.data;
  const ps   = d.byPriority || {};
  const topP = ['high','medium','low']
    .sort((a, b) => (ps[b]||0) - (ps[a]||0))[0] || '—';

  document.getElementById('an-rate').textContent    = (d.completionRate || 0) + '%';
  document.getElementById('an-pri').textContent     = topP;
  document.getElementById('an-overdue').textContent = d.overdue || 0;
  document.getElementById('an-wf').textContent      = workflows.filter(w => w.active).length;

  const cats = ['Design','Engineering','Marketing','Research','Other'];
  const byC  = d.byCategory || {};
  const maxC = Math.max(1, ...cats.map(c => byC[c] || 0));
  document.getElementById('an-bars').innerHTML = cats.map(c => {
    const n = byC[c] || 0;
    const h = Math.round(n / maxC * 100);
    return `<div class="bar-w">
      <div class="bar-fill" style="height:${h}%;background:${CAT_COLORS[c]}"></div>
      <div class="bar-txt">${c.slice(0,3)}<br>${n}</div>
    </div>`;
  }).join('');

  const total = Math.max(1, d.total || 1);
  document.getElementById('an-prog').innerHTML = [
    { l:'To-do',       v: d.todo      || 0, c:'var(--blue)'  },
    { l:'In Progress', v: d.inprogress|| 0, c:'var(--amber)' },
    { l:'Done',        v: d.done      || 0, c:'var(--green)' }
  ].map(s => `
    <div class="prog-row">
      <div class="prog-lbl">${s.l}</div>
      <div class="prog-track">
        <div class="prog-fill" style="width:${Math.round(s.v/total*100)}%;background:${s.c}"></div>
      </div>
      <div class="prog-num">${s.v}</div>
    </div>`).join('');
}

// ── CSV EXPORT ─────────────────────────────────────────────────
function exportCSV() {
  if (!AUTH_TOKEN) return;
  window.open('/api/tasks/export/csv', '_blank');
}

// ── KEYBOARD SHORTCUTS ─────────────────────────────────────────
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    closeTaskModal();
    closeWfModal();
  }
  if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
    e.preventDefault();
    if (AUTH_TOKEN) openTaskModal();
  }
});

['task-overlay','wf-overlay'].forEach(id => {
  const el = document.getElementById(id);
  if (el) {
    el.addEventListener('click', ev => {
      if (ev.target === el) {
        closeTaskModal();
        closeWfModal();
      }
    });
  }
});

// ── INIT: restore session ──────────────────────────────────────
(function init() {
  try {
    const savedToken = sessionStorage.getItem('fm_token');
    const savedUser  = sessionStorage.getItem('fm_user');
    if (savedToken && savedUser) {
      onAuthSuccess(savedToken, JSON.parse(savedUser));
      return;
    }
  } catch (e) {
    sessionStorage.clear();
  }
  // Show login screen if no saved session
  document.getElementById('auth-screen').style.display = 'flex';
  document.getElementById('app').style.display         = 'none';
})();
