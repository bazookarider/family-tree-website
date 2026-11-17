/* =====================================================
   MR. MANAGER LEAGUE  -  Steps 1 to 5
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
        <span class="badge">${ico(l.type === 'cup' ? 'cup' : 'trophy')}${typeName(l.type)}</span>
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
        <label><input type="radio" name="t" value="combo"><div>${ico('trophy')}League + Cup<small style="font-weight:400">Groups, then knockout</small></div></label>
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

/* ---------- 6. LEAGUE PAGE (table, fixtures, knockout, stats, players) ---------- */
Object.assign(PATHS, {
  edit: '<path d="M4 20h4L19 9l-4-4L4 16v4zM13.5 6.5l4 4"/>',
  cal: '<rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 10h16M9 3v4M15 3v4"/>',
  shuffle: '<path d="M4 7h3c5 0 5 10 10 10h3M4 17h3c1.6 0 2.7-.8 3.5-2M13.5 9c.8-1.2 2-2 3.5-2h3M17 4l3 3-3 3M17 14l3 3-3 3"/>',
  list: '<path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01"/>',
  share: '<circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="6" r="2.5"/><circle cx="18" cy="18" r="2.5"/><path d="M8.2 10.8l7.6-3.6M8.2 13.2l7.6 3.6"/>'
});
const uid = () => Math.random().toString(36).slice(2, 9);
const ROUND_NAMES = { 1: 'Final', 2: 'Semi-finals', 3: 'Quarter-finals', 4: 'Round of 16' };
let L = null, LID = null, OWNER = false, TAB = 'main', USER = null, UNSUB = null, H = [null, null];
const nm = id => (L.players.find(p => p.id === id) || { name: 'TBD' }).name;
const emptyMsg = (t, p) => `<div class="panel empty">${ico('users')}<h2>${t}</h2><p>${p}</p></div>`;
const ko = m => L.type === 'cup' || !!m.k;
const typeName = t => t === 'cup' ? 'Cup' : t === 'combo' ? 'League + Cup' : 'Pro League';
const shuffle = a => a.slice().sort(() => Math.random() - .5);

/* live: every change by the owner appears on everyone's screen instantly */
function showLeague(id, user) {
  USER = user; TAB = 'main'; LID = id; L = null;
  app.innerHTML = topBar(user) + '<div class="empty"><span class="spin" style="display:inline-block"></span></div>';
  bindLogout();
  UNSUB = db.collection('leagues').doc(id).onSnapshot(doc => {
    if (!doc.exists) { app.innerHTML = topBar(user) + `<div class="panel empty">${ico('trophy')}<h2>League not found</h2><p>The link may be wrong or the league was deleted.</p></div>`; bindLogout(); return; }
    L = doc.data(); OWNER = !!user && user.uid === L.ownerId;
    L.players = L.players || []; L.matches = L.matches || [];
    renderLeague();
  }, x => { app.innerHTML = topBar(user) + `<div class="panel empty">${esc(friendlyError(x))}</div>`; bindLogout(); });
}

async function save(msg) {
  try {
    await db.collection('leagues').doc(LID).update({ players: L.players, matches: L.matches });
    if (msg) toast(msg);
  } catch (x) { toast(friendlyError(x)); }
  renderLeague();
}

function renderLeague() {
  const t = L.type;
  const tabs = t === 'cup' ? [['main', 'Bracket'], ['players', 'Players'], ['stats', 'Stats']]
    : t === 'combo' ? [['main', 'Table'], ['fix', 'Fixtures'], ['ko', 'Knockout'], ['players', 'Players'], ['stats', 'Stats']]
    : [['main', 'Table'], ['fix', 'Fixtures'], ['players', 'Players'], ['stats', 'Stats']];
  const body = TAB === 'players' ? playersView() : TAB === 'stats' ? statsView()
    : (TAB === 'ko' || (t === 'cup' && TAB === 'main')) ? bracketView() : TAB === 'fix' ? fixturesView() : tableView();
  app.innerHTML = topBar(USER) + `<div id="lg">
    <div class="head"><div>
      <button class="link" onclick="location.hash='#/'" style="display:flex;align-items:center;gap:6px;margin-bottom:10px">${ico('back')}${USER ? 'My leagues' : 'Home'}</button>
      <h1 style="font-size:clamp(1.8rem,5vw,2.6rem)">${esc(L.name)}</h1></div>
      <div style="display:flex;gap:10px;flex-wrap:wrap">
        <span class="badge ${OWNER ? '' : 'view'}">${ico(OWNER ? 'pad' : 'eye')}${OWNER ? 'You manage this' : 'View only'}</span>
        <button class="btn ghost small" data-a="wa">${ico('share')}Share</button>
        <button class="btn ghost small" data-a="copy">${ico('link')}Copy link</button></div></div>
    <div class="tabs">${tabs.map(x => `<button class="tab ${TAB === x[0] ? 'on' : ''}" data-a="tab" data-t="${x[0]}">${x[1]}</button>`).join('')}</div>
    ${body}</div>`;
  bindLogout();
  const f = $('#addf'); if (f) f.onsubmit = addPlayer;
}

/* ----- standings (league matches only) ----- */
function standings() {
  const t = {};
  L.players.forEach(p => t[p.id] = { id: p.id, P: 0, W: 0, D: 0, L: 0, GF: 0, GA: 0, Pts: 0, form: [] });
  L.matches.filter(m => m.played && !ko(m)).sort((a, b) => a.round - b.round).forEach(m => {
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
  const lm = L.matches.filter(m => !ko(m)), done = lm.filter(m => m.played), total = lm.length, s = standings();
  const goals = done.reduce((a, m) => a + m.sa + m.sb, 0);
  const big = done.slice().sort((a, b) => Math.abs(b.sa - b.sb) - Math.abs(a.sa - a.sb))[0];
  const champ = L.type === 'league' && total && done.length === total ? s[0] : null;
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
  const lm = L.matches.filter(m => !ko(m));
  if (!lm.length) return emptyMsg('No fixtures yet', OWNER ? 'Open the Players tab and generate fixtures.' : 'Fixtures will appear once the manager creates them.');
  const by = {}; lm.forEach(m => (by[m.round] = by[m.round] || []).push(m));
  const done = lm.filter(m => m.played).length, pct = Math.round(done / lm.length * 100);
  return `<div class="prog"><div style="width:${pct}%"></div></div><p class="meta" style="color:var(--muted);font-size:.85rem;margin:8px 0 18px">${done} of ${lm.length} matches played</p>` +
    Object.keys(by).sort((a, b) => a - b).map(r => `<h3 class="mw">Matchweek ${r}</h3>` + by[r].map(m => `<div class="fx ${m.played ? 'done' : ''}">
      <span class="a">${esc(nm(m.a))}</span><span class="sc">${m.played ? m.sa + ' - ' + m.sb : 'vs'}</span><span class="b">${esc(nm(m.b))}</span>
      ${OWNER ? `<button class="icon-btn" data-a="res" data-id="${m.id}" title="${m.played ? 'Edit result' : 'Enter result'}">${ico(m.played ? 'edit' : 'plus')}</button>` : ''}</div>`).join('')).join('');
}

/* ----- knockout ----- */
const winner = m => m.bye ? m.a : !m.played ? null : m.sa > m.sb ? m.a : m.sb > m.sa ? m.b
  : (m.legs === 2 && m.ag && m.l2[0] !== m.l1[1]) ? (m.l2[0] > m.l1[1] ? m.a : m.b) : m.pw;
function propagate(m) {
  const n = L.matches.find(x => ko(x) && x.round === m.round + 1 && x.slot === m.slot >> 1); if (!n) return;
  n[m.slot % 2 ? 'b' : 'a'] = winner(m) || null;
  if (n.played) Object.assign(n, { played: false, sa: null, sb: null, pw: null, l1: null, l2: null });
  propagate(n);
}
function bracketView() {
  const km = L.matches.filter(ko);
  const btn = OWNER ? `<button class="btn" data-a="ko" style="margin-top:16px">${ico('shuffle')}Set up knockout</button>` : '';
  if (!km.length) return emptyMsg('Knockout not drawn', (L.type === 'combo' ? 'Finish the league, then start the knockout stage.' : OWNER ? 'Add players, then set up the draw.' : 'The bracket will appear once the manager draws it.') + (OWNER ? '<br>' + btn : ''));
  const R = Math.max(...km.map(m => m.round)) + 1, w = winner(km.find(m => m.round === R - 1));
  const cols = [...Array(R).keys()].map(r => `<div class="col"><h3 class="mw">${ROUND_NAMES[R - r] || 'Round ' + (r + 1)}</h3>` +
    km.filter(m => m.round === r).sort((a, b) => a.slot - b.slot).map(m => {
      const can = OWNER && m.a && m.b && !m.bye, wn = winner(m);
      const row = (id, s) => `<div class="${wn && wn === id ? 'win' : ''}"><span>${id ? esc(nm(id)) : 'TBD'}</span><b>${m.played && !m.bye ? s : ''}</b></div>`;
      const legs = m.legs === 2 && m.l1 ? `<small>Leg 1: ${m.l1[0]}-${m.l1[1]}, Leg 2: ${m.l2[0]}-${m.l2[1]}</small>` : m.legs === 2 && !m.played ? '<small>Two legs</small>' : '';
      const note = m.pw ? '<small>Won on penalties</small>' : (m.legs === 2 && m.played && m.sa === m.sb ? '<small>Won on away goals</small>' : '');
      return `<div class="bm ${can ? 'can' : ''}" ${can ? `data-a="res" data-id="${m.id}"` : ''}>${row(m.a, m.sa)}${m.bye ? '<small>Bye</small>' : row(m.b, m.sb)}${legs}${note}</div>`;
    }).join('') + '</div>').join('');
  return (w ? `<div class="champ">${ico('trophy')}<div><b>${esc(nm(w))}</b><span>${L.type === 'combo' ? 'Knockout winner' : 'Cup winner'}</span></div></div>` : '') +
    (OWNER ? `<button class="btn ghost small" data-a="ko" style="margin-bottom:14px">${ico('shuffle')}New draw</button>` : '') + `<div class="bracket">${cols}</div>`;
}

/* ----- stats and head to head ----- */
function statMatches() {
  const out = [];
  L.matches.filter(m => m.played && !m.bye).sort((x, y) => (ko(x) ? 1000 : 0) + x.round - ((ko(y) ? 1000 : 0) + y.round)).forEach(m => {
    if (m.legs === 2 && m.l1) out.push({ a: m.a, b: m.b, sa: m.l1[0], sb: m.l1[1] }, { a: m.a, b: m.b, sa: m.l2[0], sb: m.l2[1] });
    else out.push(m);
  });
  return out;
}
function statsView() {
  const ms = statMatches();
  if (!ms.length) return emptyMsg('No stats yet', 'Stats appear after the first result is entered.');
  const P = {};
  L.players.forEach(p => P[p.id] = { id: p.id, P: 0, W: 0, GF: 0, run: 0, best: 0, wr: 0, wbest: 0, big: 0, bigTxt: '-' });
  ms.forEach(m => [[m.a, m.sa, m.sb, m.b], [m.b, m.sb, m.sa, m.a]].forEach(([id, f, g, opp]) => {
    const p = P[id]; if (!p) return;
    p.P++; p.GF += f;
    if (f > g) { p.W++; p.run++; p.wr++; if (f - g > p.big) { p.big = f - g; p.bigTxt = f + '-' + g + ' v ' + nm(opp); } }
    else if (f === g) { p.run++; p.wr = 0; } else { p.run = 0; p.wr = 0; }
    p.best = Math.max(p.best, p.run); p.wbest = Math.max(p.wbest, p.wr);
  }));
  const rows = Object.values(P).filter(p => p.P).sort((x, y) => y.W / y.P - x.W / x.P || y.W - x.W)
    .map(p => `<tr><td class="who">${esc(nm(p.id))}</td><td class="pts">${Math.round(p.W / p.P * 100)}%</td><td>${p.best}</td><td>${p.wbest}</td><td>${(p.GF / p.P).toFixed(1)}</td><td>${esc(p.bigTxt)}</td></tr>`).join('');
  const ids = L.players.map(p => p.id);
  if (!ids.includes(H[0])) H[0] = ids[0];
  if (!ids.includes(H[1]) || H[1] === H[0]) H[1] = ids.find(x => x !== H[0]);
  let w0 = 0, w1 = 0, d = 0, g0 = 0, g1 = 0;
  ms.filter(m => (m.a === H[0] && m.b === H[1]) || (m.a === H[1] && m.b === H[0])).forEach(m => {
    const x = m.a === H[0] ? m.sa : m.sb, y = m.a === H[0] ? m.sb : m.sa;
    g0 += x; g1 += y; if (x > y) w0++; else if (x < y) w1++; else d++;
  });
  const sel = (id, v) => `<select id="${id}">${ids.map(x => `<option value="${x}" ${x === v ? 'selected' : ''}>${esc(nm(x))}</option>`).join('')}</select>`;
  return `<h3 class="mw" style="margin-top:0">Player stats</h3>
    <div class="panel tw"><table class="tbl"><thead><tr><th>Player</th><th>Win rate</th><th>Unbeaten run</th><th>Win run</th><th>Goals per game</th><th>Biggest win</th></tr></thead><tbody>${rows}</tbody></table></div>
    <h3 class="mw">Head to head</h3><div class="panel">${ids.length > 1 ? `<div class="row">${sel('h1', H[0])}${sel('h2', H[1])}</div>
    <div class="stats"><div class="stat"><b>${w0}</b><span>${esc(nm(H[0]))} wins</span></div><div class="stat"><b>${d}</b><span>Draws</span></div>
    <div class="stat"><b>${w1}</b><span>${esc(nm(H[1]))} wins</span></div><div class="stat"><b>${g0} - ${g1}</b><span>Goals</span></div></div>` : '<p>Add at least two players.</p>'}</div>`;
}

/* ----- players ----- */
function playersView() {
  const cup = L.type === 'cup', n = L.players.length;
  const add = OWNER ? `<div class="panel" style="margin-bottom:16px"><form id="addf" class="row"><input id="pn" maxlength="24" placeholder="Player name or gamertag"><button class="btn" style="flex:0 0 auto">${ico('plus')}Add</button></form>
    <button class="btn ghost small" data-a="bulk" style="margin-top:12px">${ico('list')}Paste many names</button></div>` : '';
  const list = n ? L.players.map(p => `<div class="pl"><span class="av">${esc(p.name[0].toUpperCase())}</span><span class="nm">${esc(p.name)}</span>
    ${OWNER ? `<button class="icon-btn" data-a="ren" data-id="${p.id}" title="Edit name">${ico('edit')}</button><button class="icon-btn del" data-a="delp" data-id="${p.id}" title="Delete player">${ico('trash')}</button>` : ''}</div>`).join('')
    : emptyMsg('No players yet', OWNER ? 'Add the first player above.' : 'The manager has not added players yet.');
  const hasLeague = L.matches.some(m => !ko(m));
  const gen = OWNER && n >= 2 ? `<div class="panel" style="margin-top:16px"><h2>${cup ? 'Knockout draw' : 'Generate fixtures'}</h2>
    <p class="lead" style="margin:8px 0 14px">${cup ? 'Draw the bracket at random, or choose who plays who yourself.' : 'Matchweeks are created automatically.' + (L.type === 'combo' ? ' Start the knockout stage from the Knockout tab when the league is done.' : '')}</p>
    ${cup ? '' : `<label class="chk"><input type="radio" name="fmt" value="1" checked> Everyone plays everyone once</label>
    <label class="chk"><input type="radio" name="fmt" value="2"> Home and away (everyone plays twice)</label>`}
    <div style="display:flex;gap:10px;flex-wrap:wrap"><button class="btn" data-a="${cup ? 'ko' : 'gen'}">${ico('shuffle')}${cup ? 'Set up knockout' : 'Generate fixtures'}</button>
    ${!cup && hasLeague ? '<button class="btn ghost" data-a="reset">Clear all results</button>' : ''}</div></div>` : '';
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
const radio = (name, val, label, on) => `<label class="chk"><input type="radio" name="${name}" value="${val}" ${on ? 'checked' : ''}> ${label}</label>`;

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
  modal(`<h2 style="margin-bottom:18px">Edit player</h2><label class="field"><span>Name</span><input id="rn" maxlength="24" value="${esc(nm(id))}"></label>${btns('Save')}`, (m, close) => {
    const v = m.querySelector('#rn').value.trim();
    if (!v) { m.querySelector('#e').textContent = 'Name cannot be empty.'; return; }
    if (dup(v, id)) { m.querySelector('#e').textContent = 'That name is already used.'; return; }
    L.players.find(x => x.id === id).name = v; close(); save('Player updated');
  });
}

/* ----- enter result (single match or two legs) ----- */
function openResult(mid) {
  const m0 = L.matches.find(x => x.id === mid), isKo = ko(m0), two = m0.legs === 2;
  const inp = (id, v) => `<input type="number" id="${id}" min="0" max="99" inputmode="numeric" value="${v == null ? '' : v}">`;
  const row = (lab, i1, v1, i2, v2) => `${lab ? `<p class="mw" style="margin:0 0 8px">${lab}</p>` : ''}<div class="score"><label>${esc(nm(m0.a))}${inp(i1, v1)}</label><b>-</b><label>${esc(nm(m0.b))}${inp(i2, v2)}</label></div>`;
  const l1 = m0.l1 || [], l2 = m0.l2 || [];
  modal(`<h2 style="margin-bottom:18px">${m0.played ? 'Edit result' : 'Enter result'}</h2>
    ${two ? row('Leg 1 (' + esc(nm(m0.a)) + ' at home)', 'a1', l1[0], 'b1', l1[1]) + row('Leg 2 (' + esc(nm(m0.b)) + ' at home)', 'a2', l2[0], 'b2', l2[1]) : row('', 'sa', m0.played ? m0.sa : null, 'sb', m0.played ? m0.sb : null)}
    ${isKo ? `<label class="field"><span>If still level, who won on penalties?</span><select id="pw"><option value="${m0.a}" ${m0.pw === m0.a ? 'selected' : ''}>${esc(nm(m0.a))}</option><option value="${m0.b}" ${m0.pw === m0.b ? 'selected' : ''}>${esc(nm(m0.b))}</option></select></label>` : ''}
    ${btns('Save result')}${m0.played ? '<button type="button" class="link" id="clr" style="margin-top:10px;color:var(--danger)">Clear this result</button>' : ''}`, (md, close) => {
    const m = L.matches.find(x => x.id === mid), g = i => parseInt(md.querySelector('#' + i).value, 10);
    const v = two ? [g('a1'), g('b1'), g('a2'), g('b2')] : [g('sa'), g('sb')];
    if (v.some(x => isNaN(x) || x < 0)) { md.querySelector('#e').textContent = 'Enter every score.'; return; }
    if (two) { m.l1 = [v[0], v[1]]; m.l2 = [v[2], v[3]]; m.sa = v[0] + v[2]; m.sb = v[1] + v[3]; } else { m.sa = v[0]; m.sb = v[1]; }
    m.played = true;
    const decided = m.sa !== m.sb || (two && m.ag && m.l2[0] !== m.l1[1]);
    m.pw = isKo && !decided ? md.querySelector('#pw').value : null;
    if (isKo) propagate(m);
    close(); save('Result saved');
  });
  const c = document.querySelector('#clr');
  if (c) c.onclick = () => {
    const m = L.matches.find(x => x.id === mid);
    Object.assign(m, { played: false, sa: null, sb: null, pw: null, l1: null, l2: null }); if (isKo) propagate(m);
    document.querySelector('.modal').remove(); save('Result cleared');
  };
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
function pairsFrom(ids) {
  let n = 2; while (n < ids.length) n *= 2;
  return [...Array(n / 2).keys()].map(s => [ids[s], ids[n - 1 - s] || null]);
}
function buildKO(pairs, legs, ag) {
  const n = pairs.length * 2, R = Math.log2(n), ms = [];
  for (let r = 0; r < R; r++) for (let s = 0; s < n / 2 ** (r + 1); s++) {
    const m = { id: uid(), round: r, slot: s, a: null, b: null, sa: null, sb: null, pw: null, played: false, k: true };
    if (legs === 2 && r < R - 1) { m.legs = 2; m.l1 = null; m.l2 = null; if (ag) m.ag = true; }
    ms.push(m);
  }
  pairs.forEach((p, s) => { const m = ms.find(x => x.round === 0 && x.slot === s); m.a = p[0]; m.b = p[1]; if (!p[1]) m.bye = true; });
  L.matches = L.matches.filter(m => !ko(m)).concat(ms);
  ms.filter(m => m.bye).forEach(propagate);
  TAB = L.type === 'cup' ? 'main' : 'ko'; save('Knockout ready');
}
function openKO() {
  const combo = L.type === 'combo';
  if (combo && !L.matches.some(m => !ko(m))) { toast('Generate the league fixtures first'); return; }
  if (L.matches.some(ko) && !confirm('This replaces the current knockout draw. Continue?')) return;
  const opts = [2, 4, 8, 16].filter(x => x <= L.players.length), def = opts.includes(4) ? 4 : opts[opts.length - 1];
  modal(`<h2 style="margin-bottom:14px">Knockout setup</h2>
    ${combo ? `<label class="field"><span>Players going through</span><select id="kn">${opts.map(x => `<option ${x === def ? 'selected' : ''}>${x}</option>`).join('')}</select></label>` : ''}
    <p class="mw" style="margin:0 0 8px">Draw</p>
    ${combo ? radio('d', 'seed', 'By league position (1st plays last)', 1) : ''}${radio('d', 'rand', 'Random draw', !combo)}${radio('d', 'man', 'I choose the matches', 0)}
    <p class="mw" style="margin:6px 0 8px">Format</p>
    ${radio('g', '1', 'Single match', 1)}${radio('g', '2', 'Two legs, home and away (final is one match)', 0)}
    <label class="chk"><input type="checkbox" id="ag"> Away goals rule (two legs only)</label>${btns('Continue')}`, (m, close) => {
    const d = m.querySelector('[name=d]:checked').value, legs = +m.querySelector('[name=g]:checked').value, ag = m.querySelector('#ag').checked;
    let pool = L.players.map(p => p.id);
    if (combo) pool = standings().slice(0, +m.querySelector('#kn').value).map(r => r.id);
    if (d !== 'seed') pool = shuffle(pool);
    close();
    if (d === 'man') openManual(pool, legs, ag); else buildKO(pairsFrom(pool), legs, ag);
  });
}
function openManual(pool, legs, ag) {
  const pairs = pairsFrom(pool);
  const sel = (i, j, v) => `<select data-r="${i}" data-s="${j}"><option value="">Bye</option>${pool.map(id => `<option value="${id}" ${id === v ? 'selected' : ''}>${esc(nm(id))}</option>`).join('')}</select>`;
  modal(`<h2 style="margin-bottom:6px">Choose the matches</h2><p class="lead" style="margin:0 0 4px">Use every player once. Pick Bye to give a free pass.</p>
    ${pairs.map((p, i) => `<p class="mw" style="margin:14px 0 8px">Match ${i + 1}</p><div class="row">${sel(i, 0, p[0])}${sel(i, 1, p[1])}</div>`).join('')}${btns('Create bracket')}`, (m, close) => {
    const rows = pairs.map((_, i) => [0, 1].map(j => m.querySelector(`[data-r="${i}"][data-s="${j}"]`).value || null));
    const used = rows.flat().filter(Boolean);
    if (new Set(used).size !== used.length || used.length !== pool.length) { m.querySelector('#e').textContent = 'Use every player exactly once.'; return; }
    if (rows.some(r => !r[0] && !r[1])) { m.querySelector('#e').textContent = 'Each match needs at least one player.'; return; }
    close(); buildKO(rows.map(r => r[0] ? [r[0], r[1]] : [r[1], null]), legs, ag);
  });
}

/* ----- share ----- */
function shareText() {
  let t = '*' + L.name + '*\n';
  if (L.type !== 'cup') t += standings().slice(0, 10).map((r, i) => `${i + 1}. ${nm(r.id)} - ${r.Pts} pts (P${r.P}, GD ${r.GF - r.GA})`).join('\n') + '\n';
  const k = L.matches.filter(m => ko(m) && m.played && !m.bye).slice(-6);
  if (k.length) t += '\nKnockout results:\n' + k.map(m => `${nm(m.a)} ${m.sa}-${m.sb} ${nm(m.b)}`).join('\n') + '\n';
  return t + '\n' + shareLink(LID);
}

/* ----- clicks ----- */
app.onclick = e => {
  const t = e.target.closest('[data-a]'); if (!t || !$('#lg')) return;
  const a = t.dataset.a, id = t.dataset.id;
  if (a === 'tab') { TAB = t.dataset.t; renderLeague(); return; }
  if (a === 'copy') { navigator.clipboard.writeText(shareLink(LID)); toast('Share link copied'); return; }
  if (a === 'wa') { window.open('https://wa.me/?text=' + encodeURIComponent(shareText()), '_blank'); return; }
  if (!OWNER) return;
  if (a === 'res') openResult(id);
  else if (a === 'bulk') openBulk();
  else if (a === 'ren') openRename(id);
  else if (a === 'ko') openKO();
  else if (a === 'delp') {
    if (!confirm('Delete this player?' + (L.matches.length ? ' All fixtures and results will be cleared.' : ''))) return;
    L.players = L.players.filter(p => p.id !== id); L.matches = []; save('Player deleted');
  } else if (a === 'gen') {
    if (L.matches.length && !confirm('This replaces all current fixtures and results. Continue?')) return;
    genLeague($('input[name=fmt]:checked').value === '2');
    TAB = 'fix'; save('Fixtures ready');
  } else if (a === 'reset') {
    if (!confirm('Clear every result and keep the fixtures?')) return;
    L.matches = L.matches.filter(m => !ko(m));
    L.matches.forEach(m => Object.assign(m, { played: false, sa: null, sb: null })); save('Results cleared');
  }
};
app.onchange = e => { if (e.target.id === 'h1' || e.target.id === 'h2') { H = [$('#h1').value, $('#h2').value]; renderLeague(); } };

/* ---------- 7. ROUTER ---------- */
let currentUser = null, ready = false;
function route() {
  if (!ready) return;
  if (UNSUB) { UNSUB(); UNSUB = null; }
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
