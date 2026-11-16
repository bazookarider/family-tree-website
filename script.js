/* =====================================================
   MR. MANAGER LEAGUE  -  Steps 1 and 2
   Sections: 1 Config | 2 Icons | 3 Helpers | 4 Auth screen
             5 Dashboard | 6 League page | 7 Router
   ===================================================== */

/* ---------- 1. CONFIG: paste your Firebase config here ---------- */
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
/* If anything crashes, show the error on screen instead of a blank page */
function fatal(msg) {
  const a = document.getElementById('app');
  a.innerHTML = '<div class="panel" style="margin-top:40px"><h2>Something went wrong</h2><p class="lead">' + String(msg).replace(/</g, '&lt;') + '</p></div>';
}
window.addEventListener('error', e => {
  const a = document.getElementById('app');
  if (a && (!a.innerHTML.trim() || a.querySelector('.boot'))) fatal(e.message);
});
window.addEventListener('unhandledrejection', e => {
  const a = document.getElementById('app');
  if (a && a.querySelector('.boot')) fatal((e.reason && (e.reason.code || e.reason.message)) || e.reason);
});
if (firebaseConfig.apiKey.startsWith('PASTE')) {
  document.getElementById('app').innerHTML = '<div class="panel" style="margin-top:40px"><h2>Firebase config missing</h2><p class="lead">Open script.js and replace the PASTE_YOUR values in firebaseConfig with the ones from Firebase Project settings.</p></div>';
  throw new Error('Firebase config missing');
}
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
  `<svg class="ico ${cls}" viewBox="0 0 24 24" aria-hidden="true">${PATHS[n].replace(/<(path|circle|rect)/g, '<$1 pathLength="1"')}</svg>`;

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

/* ---------- 6. LEAGUE PAGE (table, fixtures, results, bracket, players) ---------- */
Object.assign(PATHS, {
  edit: '<path d="M4 20h4L19 9l-4-4L4 16v4zM13.5 6.5l4 4"/>',
  cal: '<rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 10h16M9 3v4M15 3v4"/>',
  shuffle: '<path d="M4 7h3c5 0 5 10 10 10h3M4 17h3c1.6 0 2.7-.8 3.5-2M13.5 9c.8-1.2 2-2 3.5-2h3M17 4l3 3-3 3M17 14l3 3-3 3"/>',
  list: '<path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01"/>'
});
const uid = () => Math.random().toString(36).slice(2, 9);
const ROUND_NAMES = { 1: 'Final', 2: 'Semi-finals', 3: 'Quarter-finals', 4: 'Round of 16' };
let L = null, LID = null, OWNER = false, TAB = 'main', USER = null;
const nm = id => (L.players.find(p => p.id === id) || { name: 'TBD' }).name;
const emptyMsg = (t, p) => `<div class="panel empty">${ico('users')}<h2>${t}</h2><p>${p}</p></div>`;

async function showLeague(id, user) {
  USER = user; TAB = 'main';
  app.innerHTML = topBar(user) + '<div class="empty"><span class="spin" style="display:inline-block"></span></div>';
  bindLogout();
  try {
    const doc = await db.collection('leagues').doc(id).get();
    if (!doc.exists) { app.innerHTML = topBar(user) + `<div class="panel empty">${ico('trophy')}<h2>League not found</h2><p>The link may be wrong or the league was deleted.</p></div>`; bindLogout(); return; }
    L = doc.data(); LID = id; OWNER = !!user && user.uid === L.ownerId;
    L.players = L.players || []; L.matches = L.matches || [];
    renderLeague();
  } catch (x) { app.innerHTML = topBar(user) + `<div class="panel empty">${esc(friendlyError(x))}</div>`; bindLogout(); }
}

async function save(msg) {
  try {
    await db.collection('leagues').doc(LID).update({ players: L.players, matches: L.matches });
    if (msg) toast(msg);
  } catch (x) { toast(friendlyError(x)); }
  renderLeague();
}

function renderLeague() {
  const cup = L.type === 'cup';
  const tabs = cup ? [['main', 'Bracket'], ['players', 'Players']] : [['main', 'Table'], ['fix', 'Fixtures'], ['players', 'Players']];
  const body = TAB === 'players' ? playersView() : cup ? bracketView() : TAB === 'fix' ? fixturesView() : tableView();
  app.innerHTML = topBar(USER) + `<div id="lg">
    <div class="head"><div>
      <button class="link" onclick="location.hash='#/'" style="display:flex;align-items:center;gap:6px;margin-bottom:10px">${ico('back')}${USER ? 'My leagues' : 'Home'}</button>
      <h1 style="font-size:clamp(1.8rem,5vw,2.6rem)">${esc(L.name)}</h1></div>
      <div style="display:flex;gap:10px;flex-wrap:wrap">
        <span class="badge ${OWNER ? '' : 'view'}">${ico(OWNER ? 'pad' : 'eye')}${OWNER ? 'You manage this' : 'View only'}</span>
        <button class="btn ghost small" data-a="copy">${ico('link')}Copy link</button></div></div>
    <div class="tabs">${tabs.map(t => `<button class="tab ${TAB === t[0] ? 'on' : ''}" data-a="tab" data-t="${t[0]}">${t[1]}</button>`).join('')}</div>
    ${body}</div>`;
  bindLogout();
  const f = $('#addf'); if (f) f.onsubmit = addPlayer;
}

/* ----- standings ----- */
function standings() {
  const t = {};
  L.players.forEach(p => t[p.id] = { id: p.id, P: 0, W: 0, D: 0, L: 0, GF: 0, GA: 0, Pts: 0, form: [] });
  L.matches.filter(m => m.played).sort((a, b) => a.round - b.round).forEach(m => {
    const A = t[m.a], B = t[m.b]; if (!A || !B) return;
    A.P++; B.P++; A.GF += m.sa; A.GA += m.sb; B.GF += m.sb; B.GA += m.sa;
    if (m.sa > m.sb) { A.W++; B.L++; A.Pts += 3; A.form.push('W'); B.form.push('L'); }
    else if (m.sa < m.sb) { B.W++; A.L++; B.Pts += 3; B.form.push('W'); A.form.push('L'); }
    else { A.D++; B.D++; A.Pts++; B.Pts++; A.form.push('D'); B.form.push('D'); }
  });
  return Object.values(t).sort((x, y) => y.Pts - x.Pts || (y.GF - y.GA) - (x.GF - x.GA) || y.GF - x.GF || nm(x.id).localeCompare(nm(y.id)));
}

function tableView() {
  if (!L.players.length) return emptyMsg('No players yet', OWNER ? 'Open the Players tab and add your friends.' : 'The manager has not added players yet.');
  const s = standings(), done = L.matches.filter(m => m.played), total = L.matches.length;
  const goals = done.reduce((a, m) => a + m.sa + m.sb, 0);
  const big = done.slice().sort((a, b) => Math.abs(b.sa - b.sb) - Math.abs(a.sa - a.sb))[0];
  const champ = total && done.length === total ? s[0] : null;
  const rows = s.map((r, i) => `<tr class="${i === 0 && r.P ? 'top1' : ''}"><td class="pos">${i + 1}</td><td class="who">${esc(nm(r.id))}</td>
    <td>${r.P}</td><td>${r.W}</td><td>${r.D}</td><td>${r.L}</td><td>${r.GF}</td><td>${r.GA}</td><td>${r.GF - r.GA > 0 ? '+' : ''}${r.GF - r.GA}</td><td class="pts">${r.Pts}</td>
    <td><div class="form">${r.form.slice(-5).map(f => `<i class="f ${f}">${f}</i>`).join('')}</div></td></tr>`).join('');
  return (champ ? `<div class="champ">${ico('trophy')}<div><b>${esc(nm(champ.id))}</b><span>League champion with ${champ.Pts} points</span></div></div>` : '') +
    `<div class="panel tw"><table class="tbl"><thead><tr><th>#</th><th>Player</th><th>P</th><th>W</th><th>D</th><th>L</th><th>GF</th><th>GA</th><th>GD</th><th>Pts</th><th>Form</th></tr></thead><tbody>${rows}</tbody></table></div>
    <div class="stats">
      <div class="stat"><b>${done.length}/${total}</b><span>Matches played</span></div>
      <div class="stat"><b>${goals}</b><span>Goals scored</span></div>
      <div class="stat"><b>${done.length ? (goals / done.length).toFixed(1) : 0}</b><span>Goals per match</span></div>
      <div class="stat"><b>${big ? big.sa + ' - ' + big.sb : '-'}</b><span>${big ? esc(nm(big.a)) + ' v ' + esc(nm(big.b)) : 'Biggest margin'}</span></div></div>`;
}

function fixturesView() {
  if (!L.matches.length) return emptyMsg('No fixtures yet', OWNER ? 'Open the Players tab and generate fixtures.' : 'Fixtures will appear once the manager creates them.');
  const by = {}; L.matches.forEach(m => (by[m.round] = by[m.round] || []).push(m));
  const done = L.matches.filter(m => m.played).length, pct = Math.round(done / L.matches.length * 100);
  return `<div class="prog"><div style="width:${pct}%"></div></div><p class="meta" style="color:var(--muted);font-size:.85rem;margin:8px 0 18px">${done} of ${L.matches.length} matches played</p>` +
    Object.keys(by).sort((a, b) => a - b).map(r => `<h3 class="mw">Matchweek ${r}</h3>` + by[r].map(m => `<div class="fx ${m.played ? 'done' : ''}">
      <span class="a">${esc(nm(m.a))}</span><span class="sc">${m.played ? m.sa + ' - ' + m.sb : 'vs'}</span><span class="b">${esc(nm(m.b))}</span>
      ${OWNER ? `<button class="icon-btn" data-a="res" data-id="${m.id}" title="${m.played ? 'Edit result' : 'Enter result'}">${ico(m.played ? 'edit' : 'plus')}</button>` : ''}</div>`).join('')).join('');
}

/* ----- cup ----- */
const winner = m => m.bye ? m.a : !m.played ? null : m.sa > m.sb ? m.a : m.sb > m.sa ? m.b : m.pw;
function propagate(m) {
  const n = L.matches.find(x => x.round === m.round + 1 && x.slot === m.slot >> 1); if (!n) return;
  n[m.slot % 2 ? 'b' : 'a'] = winner(m) || null;
  if (n.played) { n.played = false; n.sa = n.sb = n.pw = null; }
  propagate(n);
}
function bracketView() {
  if (!L.matches.length) return emptyMsg('Bracket not drawn', OWNER ? 'Add players, then draw the bracket in the Players tab.' : 'The bracket will appear once the manager draws it.');
  const R = Math.max(...L.matches.map(m => m.round)) + 1;
  const fin = L.matches.find(m => m.round === R - 1), w = winner(fin);
  const cols = [...Array(R).keys()].map(r => `<div class="col"><h3 class="mw">${ROUND_NAMES[R - r] || 'Round ' + (r + 1)}</h3>` +
    L.matches.filter(m => m.round === r).sort((a, b) => a.slot - b.slot).map(m => {
      const can = OWNER && m.a && m.b && !m.bye, wn = winner(m);
      const row = (id, s) => `<div class="${wn && wn === id ? 'win' : ''}"><span>${id ? esc(nm(id)) : 'TBD'}</span><b>${m.played && !m.bye ? s : ''}</b></div>`;
      return `<div class="bm ${can ? 'can' : ''}" ${can ? `data-a="res" data-id="${m.id}"` : ''}>${row(m.a, m.sa)}${m.bye ? '<small>Bye</small>' : row(m.b, m.sb)}${m.pw ? '<small>Won on penalties</small>' : ''}</div>`;
    }).join('') + '</div>').join('');
  return (w ? `<div class="champ">${ico('trophy')}<div><b>${esc(nm(w))}</b><span>Cup winner</span></div></div>` : '') + `<div class="bracket">${cols}</div>`;
}

/* ----- players ----- */
function playersView() {
  const cup = L.type === 'cup', n = L.players.length;
  const add = OWNER ? `<div class="panel" style="margin-bottom:16px"><form id="addf" class="row"><input id="pn" maxlength="24" placeholder="Player name or gamertag"><button class="btn" style="flex:0 0 auto">${ico('plus')}Add</button></form>
    <button class="btn ghost small" data-a="bulk" style="margin-top:12px">${ico('list')}Paste many names</button></div>` : '';
  const list = n ? L.players.map(p => `<div class="pl"><span class="av">${esc(p.name[0].toUpperCase())}</span><span class="nm">${esc(p.name)}</span>
    ${OWNER ? `<button class="icon-btn" data-a="ren" data-id="${p.id}" title="Edit name">${ico('edit')}</button><button class="icon-btn del" data-a="delp" data-id="${p.id}" title="Delete player">${ico('trash')}</button>` : ''}</div>`).join('')
    : emptyMsg('No players yet', OWNER ? 'Add the first player above.' : 'The manager has not added players yet.');
  const gen = OWNER && n >= 2 ? `<div class="panel" style="margin-top:16px"><h2>${cup ? 'Draw the bracket' : 'Generate fixtures'}</h2>
    <p class="lead" style="margin:8px 0 14px">${cup ? 'Players are drawn at random. If the number is not a power of two, some players get a bye.' : 'Every player meets every other player, with matchweeks created automatically.'}</p>
    ${cup ? '' : '<label class="chk"><input type="checkbox" id="dbl"> Home and away (everyone plays twice)</label>'}
    <div style="display:flex;gap:10px;flex-wrap:wrap"><button class="btn" data-a="gen">${ico('shuffle')}${cup ? 'Draw bracket' : 'Generate fixtures'}</button>
    ${!cup && L.matches.length ? '<button class="btn ghost" data-a="reset">Clear all results</button>' : ''}</div></div>` : '';
  return add + `<div class="plist">${list}</div>` + gen;
}

function modal(html, onSubmit) {
  const m = document.createElement('div'); m.className = 'modal';
  m.innerHTML = `<div class="panel"><form novalidate>${html}</form></div>`;
  document.body.appendChild(m);
  const close = () => m.remove();
  m.onclick = e => { if (e.target === m || e.target.closest('[data-x]')) close(); };
  m.querySelector('form').onsubmit = e => { e.preventDefault(); onSubmit(m, close); };
  const i = m.querySelector('input,textarea'); if (i) i.focus();
  return m;
}
const dup = (v, skip) => L.players.some(p => p.id !== skip && p.name.toLowerCase() === v.toLowerCase());
const btns = ok => `<div class="err" id="e"></div><div class="row"><button type="button" class="btn ghost" data-x>Cancel</button><button class="btn">${ok}</button></div>`;

function addPlayer(e) {
  e.preventDefault();
  const v = $('#pn').value.trim(); if (!v) return;
  if (dup(v)) { toast('That name is already in the league'); return; }
  L.players.push({ id: uid(), name: v }); save();
}
function openBulk() {
  modal(`<h2 style="margin-bottom:6px">Paste many names</h2><p class="lead" style="margin:0 0 14px">One name per line.</p>
    <textarea id="bk" rows="7" placeholder="Ahmed&#10;Sani&#10;Musa"></textarea>${btns('Add players')}`, (m, close) => {
    const names = m.querySelector('#bk').value.split('\n').map(s => s.trim().slice(0, 24)).filter(Boolean);
    let added = 0; names.forEach(v => { if (!dup(v)) { L.players.push({ id: uid(), name: v }); added++; } });
    close(); save(added + ' players added');
  });
}
function openRename(id) {
  const p = L.players.find(x => x.id === id);
  modal(`<h2 style="margin-bottom:18px">Edit player</h2><label class="field"><span>Name</span><input id="rn" maxlength="24" value="${esc(p.name)}"></label>${btns('Save')}`, (m, close) => {
    const v = m.querySelector('#rn').value.trim();
    if (!v) { m.querySelector('#e').textContent = 'Name cannot be empty.'; return; }
    if (dup(v, id)) { m.querySelector('#e').textContent = 'That name is already used.'; return; }
    p.name = v; close(); save('Player updated');
  });
}
function openResult(mid) {
  const m = L.matches.find(x => x.id === mid), cup = L.type === 'cup';
  modal(`<h2 style="margin-bottom:18px">${m.played ? 'Edit result' : 'Enter result'}</h2>
    <div class="score"><label>${esc(nm(m.a))}<input type="number" id="sa" min="0" max="99" inputmode="numeric" value="${m.played ? m.sa : ''}"></label><b>-</b>
    <label>${esc(nm(m.b))}<input type="number" id="sb" min="0" max="99" inputmode="numeric" value="${m.played ? m.sb : ''}"></label></div>
    ${cup ? `<label class="field"><span>If the score is level, who won on penalties?</span><select id="pw"><option value="${m.a}" ${m.pw === m.a ? 'selected' : ''}>${esc(nm(m.a))}</option><option value="${m.b}" ${m.pw === m.b ? 'selected' : ''}>${esc(nm(m.b))}</option></select></label>` : ''}
    ${btns('Save result')}${m.played ? '<button type="button" class="link" id="clr" style="margin-top:10px;color:var(--danger)">Clear this result</button>' : ''}`, (md, close) => {
    const sa = parseInt(md.querySelector('#sa').value, 10), sb = parseInt(md.querySelector('#sb').value, 10);
    if (isNaN(sa) || isNaN(sb) || sa < 0 || sb < 0) { md.querySelector('#e').textContent = 'Enter both scores.'; return; }
    Object.assign(m, { sa, sb, played: true, pw: cup && sa === sb ? md.querySelector('#pw').value : null });
    if (cup) propagate(m);
    close(); save('Result saved');
  });
  const c = $('#clr', document.querySelector('.modal'));
  if (c) c.onclick = () => { Object.assign(m, { played: false, sa: null, sb: null, pw: null }); if (cup) propagate(m); document.querySelector('.modal').remove(); save('Result cleared'); };
}

/* ----- generators ----- */
const mk = (round, a, b) => ({ id: uid(), round, a, b, sa: null, sb: null, played: false });
function genLeague(double) {
  const arr = L.players.map(p => p.id); if (arr.length % 2) arr.push(null);
  const n = arr.length, ms = [];
  for (let r = 0; r < n - 1; r++) {
    for (let i = 0; i < n / 2; i++) { const a = arr[i], b = arr[n - 1 - i]; if (a && b) ms.push(r % 2 ? mk(r + 1, b, a) : mk(r + 1, a, b)); }
    arr.splice(1, 0, arr.pop());
  }
  if (double) ms.slice().forEach(m => ms.push(mk(m.round + n - 1, m.b, m.a)));
  L.matches = ms;
}
function genCup() {
  const ps = L.players.map(p => p.id).sort(() => Math.random() - .5);
  let n = 2; while (n < ps.length) n *= 2;
  const ms = [];
  for (let r = 0; r < Math.log2(n); r++) for (let s = 0; s < n / 2 ** (r + 1); s++) ms.push({ id: uid(), round: r, slot: s, a: null, b: null, sa: null, sb: null, pw: null, played: false });
  for (let s = 0; s < n / 2; s++) { const m = ms.find(x => x.round === 0 && x.slot === s); m.a = ps[s]; m.b = ps[n - 1 - s] || null; if (!m.b) m.bye = true; }
  L.matches = ms; ms.filter(m => m.bye).forEach(propagate);
}

/* ----- clicks ----- */
app.onclick = e => {
  const t = e.target.closest('[data-a]'); if (!t || !$('#lg')) return;
  const a = t.dataset.a, id = t.dataset.id;
  if (a === 'tab') { TAB = t.dataset.t; renderLeague(); return; }
  if (a === 'copy') { navigator.clipboard.writeText(shareLink(LID)); toast('Share link copied'); return; }
  if (!OWNER) return;
  if (a === 'res') openResult(id);
  else if (a === 'bulk') openBulk();
  else if (a === 'ren') openRename(id);
  else if (a === 'delp') {
    if (!confirm('Delete this player?' + (L.matches.length ? ' All fixtures and results will be cleared.' : ''))) return;
    L.players = L.players.filter(p => p.id !== id); L.matches = []; save('Player deleted');
  } else if (a === 'gen') {
    if (L.matches.length && !confirm('This replaces all current fixtures and results. Continue?')) return;
    if (L.type === 'cup') genCup(); else genLeague($('#dbl') && $('#dbl').checked);
    TAB = L.type === 'cup' ? 'main' : 'fix'; save('Fixtures ready');
  } else if (a === 'reset') {
    if (!confirm('Clear every result and keep the fixtures?')) return;
    L.matches.forEach(m => Object.assign(m, { played: false, sa: null, sb: null })); save('Results cleared');
  }
};

/* ---------- 7. ROUTER ---------- */
let currentUser = null, ready = false;
function route() {
  if (!ready) return;
  try {
    const m = location.hash.match(/^#\/league\/([\w-]+)/);
    if (m) showLeague(m[1], currentUser);
    else if (currentUser) showDashboard(currentUser);
    else showAuth('login');
  } catch (x) { fatal(x.message); }
}
setTimeout(() => { if (!ready) fatal('Could not reach Firebase sign-in. Check your internet, turn off any content blocker, and make sure your Firebase config is correct.'); }, 8000);
auth.onAuthStateChanged(u => { currentUser = u; ready = true; route(); });
window.addEventListener('hashchange', route);
