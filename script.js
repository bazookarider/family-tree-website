 /* =====================================================
   MR. MANAGER LEAGUE  -  Step 1
   Sections: 1 Config | 2 Icons | 3 Helpers | 4 Auth screen
             5 Dashboard | 6 League page | 7 Router
   ===================================================== */

/* ---------- 1. CONFIG: paste your Firebase config here ---------- */
 // For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyBooMceicbbKVpYHGDuZ6HvmYkP7t8J8_c",
  authDomain: "mr-manager-league.firebaseapp.com",
  databaseURL: "https://mr-manager-league-default-rtdb.firebaseio.com",
  projectId: "mr-manager-league",
  storageBucket: "mr-manager-league.firebasestorage.app",
  messagingSenderId: "140892814639",
  appId: "1:140892814639:web:0a51ca99eb2454dfd3f5da",
  measurementId: "G-PHPG7QDFW8"
};
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

/* ---------- 2. ICONS (hand-written SVG, they draw themselves) ---------- */
const PATHS = {
  pad: '<path d="M7 8h10a4 4 0 0 1 4 4.2l-.6 4a2.4 2.4 0 0 1-4 1.4L14 15.5h-4L7.6 17.6a2.4 2.4 0 0 1-4-1.4l-.6-4A4 4 0 0 1 7 8z"/><path d="M8 10.5v3M6.5 12h3"/><circle cx="15.5" cy="11" r=".6"/><circle cx="17.5" cy="13" r=".6"/>',
  trophy: '<path d="M8 4h8v5a4 4 0 0 1-8 0V4z"/><path d="M8 6H5v1.5A3 3 0 0 0 8 10.5M16 6h3v1.5a3 3 0 0 1-3 3"/><path d="M12 13v4M8.5 20h7M10 17h4v3h-4z"/>',
  cup: '<path d="M6 4h12v6a6 6 0 0 1-12 0V4z"/><path d="M9 21h6M12 16v5"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  out: '<path d="M10 4H5v16h5M15 8l4 4-4 4M19 12H9"/>',
  link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
  trash: '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v5M14 11v5"/>',
  back: '<path d="M15 5l-7 7 7 7"/>',
  eye: '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0M16 4.8a3.5 3.5 0 0 1 0 6.4M18 14a6 6 0 0 1 3.5 6"/>'
};
const ico = (n, cls = '') =>
  `<svg class="ico ${cls}" viewBox="0 0 24 24" aria-hidden="true">${PATHS[n].replace(/<(path|circle)/g, '<$1 pathLength="1"')}</svg>`;

/* ---------- 3. HELPERS ---------- */
const $ = (s, r = document) => r.querySelector(s);
const app = $('#app');
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
let toastTimer;
function toast(msg) {
  const t = $('#toast'); t.textContent = msg; t.classList.add('show');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show'), 2800);
}
function friendlyError(e) {
  const m = {
    'auth/invalid-email': 'That email address is not valid.',
    'auth/missing-password': 'Enter your password.',
    'auth/weak-password': 'Password must be at least 6 characters.',
    'auth/email-already-in-use': 'An account with this email already exists. Log in instead.',
    'auth/invalid-credential': 'Wrong email or password.',
    'auth/wrong-password': 'Wrong email or password.',
    'auth/user-not-found': 'No account found with this email.',
    'auth/too-many-requests': 'Too many attempts. Wait a few minutes and try again.',
    'auth/network-request-failed': 'No internet connection. Check your network.',
    'permission-denied': 'You do not have permission to do that.'
  };
   return m[e.code] || ('Error: ' + (e.code || e.message));
}
function topBar(user) {
  return `<header class="bar">
    <div class="brand" onclick="location.hash='#/'">${ico('pad')}<span>Mr. Manager League</span></div>
    ${user
      ? `<button class="btn ghost small" id="logout">${ico('out')}Log out</button>`
      : `<button class="btn ghost small" onclick="location.hash='#/'">Log in</button>`}
  </header>`;
}
function bindLogout() { const b = $('#logout'); if (b) b.onclick = () => auth.signOut(); }
function busy(btn, on, label) { btn.disabled = on; btn.innerHTML = on ? '<span class="spin"></span>' : label; }

/* ---------- 4. AUTH SCREEN ---------- */
function showAuth(mode = 'login') {
  const titles = { login: 'Log in', register: 'Create account', reset: 'Reset password' };
  app.innerHTML = topBar(null) + `
  <section class="auth">
    <div>
      <div class="hero-ico">${ico('pad')}</div>
      <h1>Run your own PlayStation league.</h1>
      <p class="lead">Create a Pro League or a Cup, add your friends, and share one link. Everyone can watch the table. Only you can change it.</p>
    </div>
    <div class="panel">
      ${mode !== 'reset' ? `<div class="tabs">
        <button class="tab ${mode === 'login' ? 'on' : ''}" data-m="login">Log in</button>
        <button class="tab ${mode === 'register' ? 'on' : ''}" data-m="register">Register</button></div>` : '<h2 style="margin-bottom:18px">Reset password</h2>'}
      <form id="f" novalidate>
        <label class="field"><span>Email</span><input type="email" id="em" autocomplete="email" placeholder="you@example.com"></label>
        ${mode !== 'reset' ? `<label class="field"><span>Password</span><input type="password" id="pw" autocomplete="${mode === 'login' ? 'current-password' : 'new-password'}" placeholder="At least 6 characters"></label>` : ''}
        <div class="err" id="err"></div>
        <button class="btn full" id="go" type="submit">${titles[mode]}</button>
      </form>
      <div style="margin-top:14px;display:flex;justify-content:space-between">
        ${mode === 'login' ? '<button class="link" data-m="reset">Forgot password?</button>' : ''}
        ${mode === 'reset' ? '<button class="link" data-m="login">Back to log in</button>' : ''}
      </div>
    </div>
  </section>`;
  app.querySelectorAll('[data-m]').forEach(b => b.onclick = () => showAuth(b.dataset.m));
  $('#f').onsubmit = async e => {
    e.preventDefault();
    const em = $('#em').value.trim(), pw = $('#pw') ? $('#pw').value : '', go = $('#go');
    $('#err').textContent = '';
    busy(go, true);
    try {
      if (mode === 'login') await auth.signInWithEmailAndPassword(em, pw);
      else if (mode === 'register') await auth.createUserWithEmailAndPassword(em, pw);
      else { await auth.sendPasswordResetEmail(em); toast('Reset link sent. Check your inbox.'); showAuth('login'); return; }
    } catch (x) { $('#err').textContent = friendlyError(x); busy(go, false, titles[mode]); }
  };
}

/* ---------- 5. DASHBOARD (My Leagues) ---------- */
async function showDashboard(user) {
  app.innerHTML = topBar(user) + `
  <div class="head"><div><h2>My leagues</h2><p class="meta" style="color:var(--muted);font-size:.9rem">${esc(user.email)}</p></div>
    <button class="btn" id="new">${ico('plus')}New league</button></div>
  <div id="list" class="grid"></div>`;
  bindLogout();
  $('#new').onclick = () => openCreate(user);
  const list = $('#list');
  try {
    const snap = await db.collection('leagues').where('ownerId', '==', user.uid).get();
    const items = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
    if (!items.length) {
      list.innerHTML = `<div class="panel empty" style="grid-column:1/-1">${ico('trophy')}<h2>No leagues yet</h2><p>Create your first Pro League or Cup to get a shareable link.</p></div>`;
      return;
    }
    list.innerHTML = items.map((l, i) => `
      <article class="card" style="animation-delay:${i * 60}ms" data-id="${l.id}">
        <div class="acts">
          <button class="icon-btn" data-copy="${l.id}" title="Copy share link">${ico('link')}</button>
          <button class="icon-btn del" data-del="${l.id}" title="Delete league">${ico('trash')}</button>
        </div>
        <span class="badge">${ico(l.type === 'cup' ? 'cup' : 'trophy')}${l.type === 'cup' ? 'Cup' : 'Pro League'}</span>
        <h3>${esc(l.name)}</h3>
        <div class="meta">${(l.players || []).length} players</div>
      </article>`).join('');
    list.onclick = async e => {
      const copy = e.target.closest('[data-copy]'), del = e.target.closest('[data-del]'), card = e.target.closest('.card');
      if (copy) { e.stopPropagation(); await navigator.clipboard.writeText(shareLink(copy.dataset.copy)); toast('Share link copied'); }
      else if (del) {
        e.stopPropagation();
        if (!confirm('Delete this league for good? This cannot be undone.')) return;
        try { await db.collection('leagues').doc(del.dataset.del).delete(); toast('League deleted'); showDashboard(user); }
        catch (x) { toast(friendlyError(x)); }
      } else if (card) location.hash = '#/league/' + card.dataset.id;
    };
  } catch (x) { list.innerHTML = `<div class="panel empty" style="grid-column:1/-1">${esc(friendlyError(x))}</div>`; }
}
const shareLink = id => location.origin + location.pathname + '#/league/' + id;

function openCreate(user) {
  const m = document.createElement('div'); m.className = 'modal';
  m.innerHTML = `<div class="panel"><h2 style="margin-bottom:18px">New competition</h2>
    <form id="cf" novalidate>
      <div class="choice">
        <label><input type="radio" name="t" value="league" checked><div>${ico('trophy')}Pro League<small style="font-weight:400">Everyone plays everyone</small></div></label>
        <label><input type="radio" name="t" value="cup"><div>${ico('cup')}Cup<small style="font-weight:400">Knockout rounds</small></div></label>
      </div>
      <label class="field"><span>Name</span><input id="nm" maxlength="40" placeholder="Friday Night FC League"></label>
      <div class="err" id="cerr"></div>
      <div class="row"><button type="button" class="btn ghost" id="cancel">Cancel</button><button class="btn" id="mk" type="submit">Create</button></div>
    </form></div>`;
  document.body.appendChild(m);
  $('#nm', m).focus();
  const close = () => m.remove();
  $('#cancel', m).onclick = close;
  m.onclick = e => { if (e.target === m) close(); };
  $('#cf', m).onsubmit = async e => {
    e.preventDefault();
    const name = $('#nm', m).value.trim();
    if (!name) { $('#cerr', m).textContent = 'Give your competition a name.'; return; }
    const btn = $('#mk', m); busy(btn, true);
    try {
      const ref = await db.collection('leagues').add({
        name, type: m.querySelector('[name=t]:checked').value, ownerId: user.uid,
        players: [], matches: [], createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      close(); toast('Created. Share link is ready.'); location.hash = '#/league/' + ref.id;
    } catch (x) { $('#cerr', m).textContent = friendlyError(x); busy(btn, false, 'Create'); }
  };
}

/* ---------- 6. LEAGUE PAGE (public view, owner sees extra controls) ---------- */
async function showLeague(id, user) {
  app.innerHTML = topBar(user) + '<div class="empty"><span class="spin" style="display:inline-block"></span></div>';
  bindLogout();
  try {
    const doc = await db.collection('leagues').doc(id).get();
    if (!doc.exists) { app.innerHTML = topBar(user) + `<div class="panel empty">${ico('trophy')}<h2>League not found</h2><p>The link may be wrong or the league was deleted.</p></div>`; bindLogout(); return; }
    const l = doc.data(), owner = !!user && user.uid === l.ownerId;
    app.innerHTML = topBar(user) + `
      <div class="head"><div>
        <button class="link" onclick="location.hash='#/'" style="display:flex;align-items:center;gap:6px;margin-bottom:10px">${ico('back')}${user ? 'My leagues' : 'Home'}</button>
        <h1 style="font-size:clamp(1.8rem,5vw,2.6rem)">${esc(l.name)}</h1></div>
        <div style="display:flex;gap:10px;flex-wrap:wrap">
          <span class="badge ${owner ? '' : 'view'}">${ico(owner ? 'pad' : 'eye')}${owner ? 'You manage this' : 'View only'}</span>
          <button class="btn ghost small" id="cp">${ico('link')}Copy link</button></div></div>
      <div class="panel empty">${ico('users')}<h2>${l.type === 'cup' ? 'Cup' : 'Pro League'} is ready</h2>
        <p>${owner ? 'Players, fixtures and results come in the next step.' : 'The table, fixtures and results will appear here.'}</p></div>`;
    bindLogout();
    $('#cp').onclick = async () => { await navigator.clipboard.writeText(shareLink(id)); toast('Share link copied'); };
  } catch (x) { app.innerHTML = topBar(user) + `<div class="panel empty">${esc(friendlyError(x))}</div>`; bindLogout(); }
}

/* ---------- 7. ROUTER ---------- */
let currentUser = null, ready = false;
function route() {
  if (!ready) return;
  const m = location.hash.match(/^#\/league\/([\w-]+)/);
  if (m) showLeague(m[1], currentUser);
  else if (currentUser) showDashboard(currentUser);
  else showAuth('login');
}
auth.onAuthStateChanged(u => { currentUser = u; ready = true; route(); });
window.addEventListener('hashchange', route);
