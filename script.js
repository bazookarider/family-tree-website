/* -------------------------------------------------------- */
/* --- Firebase & Configuration (YOUR CONFIG IS HERE!) --- */
/* -------------------------------------------------------- */

// Your Firebase configuration (from the console)
const firebaseConfig = {
  apiKey: "AIzaSyBtjdMcQ2k56y7oY3Bn3oyr1EB1OFqTZFo",
  authDomain: "maijamaa-585634.firebaseapp.com",
  projectId: "maijamaa-585634",
  storageBucket: "maijamaa-585634.firebasestorage.app",
  messagingSenderId: "1088325009238",
  appId: "1:1088325009238:web:37b5fd223f92c4c573a0f7",
  measurementId: "G-XC6V4WERLN",
  databaseURL: "https://maijamaa-585634-default-rtdb.firebaseio.com" 
};

// Initialize Firebase 
let database;
if (firebaseConfig && firebaseConfig.databaseURL) {
    firebase.initializeApp(firebaseConfig); 
    database = firebase.database();
} else {
    alert("CRITICAL ERROR: Firebase configuration is incomplete. Data will NOT be shared.");
}

/* -------------------------------------------------------- */
/* --- Persistence keys, Data, and Admin Credentials --- */
/* -------------------------------------------------------- */

const CHAT_KEY = 'maijamaa_chat_v1'; 
const ADMIN_USER = 'Benalee';
const ADMIN_PASS = 'Ab@58563'; 
const ADMIN_SESSION_KEY = 'maijamaa_admin_logged_in';

let family = []; 
let events = []; 
let chat = loadChatFromStorage() || []; 
let nextId = 1;

/* -------------------------------------------------------- */
/* --- DOM Refs & Setup --- */
/* -------------------------------------------------------- */
const treeRoot = document.getElementById('treeRoot');
const svg = document.getElementById('connections');
const treeWrap = document.getElementById('treeWrap');
const parentSelect = document.getElementById('inParent');
const addBtn = document.getElementById('addBtn');
const inName = document.getElementById('inName');
const inRole = document.getElementById('inRole');
const inNick = document.getElementById('inNick');

const adminUser = document.getElementById('adminUser');
const adminPass = document.getElementById('adminPass');
const loginBtn = document.getElementById('loginBtn');
const logoutBtn = document.getElementById('logoutBtn');
const adminStatus = document.getElementById('adminStatus');
const addMemberForm = document.getElementById('addMemberForm');
const dataManagement = document.getElementById('dataManagement');
const exportBtn = document.getElementById('exportBtn');
const importFile = document.getElementById('importFile');

const chatBody = document.getElementById('chatBody');
const chatMember = document.getElementById('chatMember');
const chatInput = document.getElementById('chatInput');
const sendChat = document.getElementById('sendChat');
const clearChat = document.getElementById('clearChat');

const eventsBody = document.getElementById('eventsBody');
const eventsFooter = document.getElementById('eventsFooter');
const eventTitleInput = document.getElementById('eventTitleInput');
const eventDateInput = document.getElementById('eventDateInput');
const eventDetailsInput = document.getElementById('eventDetailsInput');
const addEventBtn = document.getElementById('addEventBtn');
const clearEventsBtn = document.getElementById('clearEventsBtn');

/* -------------------------------------------------------- */
/* --- Helpers --- */
/* -------------------------------------------------------- */
function saveChatToStorage(){
  localStorage.setItem(CHAT_KEY, JSON.stringify(chat));
}
function loadChatFromStorage(){
  try{
    const raw = localStorage.getItem(CHAT_KEY);
    return raw ? JSON.parse(raw) : null;
  }catch(e){ return null; }
}
function escapeHtml(s){ if(!s) return ''; return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function buildMap(){
  const map = new Map();
  family.forEach(p => map.set(p.id, {...p, children: []}));
  map.forEach(node => {
    if(node.parentId != null && map.has(node.parentId)){
      map.get(node.parentId).children.push(node);
    }
  });
  return map;
}
function getRoots(){
  const map = buildMap();
  const roots = [];
  map.forEach(node => {
    if(node.parentId == null || !map.has(node.parentId)) roots.push(node);
  });
  roots.sort((a,b)=>a.id-b.id);
  return roots;
}

/* -------------------------------------------------------- */
/* --- FIREBASE REALTIME SYNCHRONIZATION --- */
/* -------------------------------------------------------- */

if (database) {
    const familyRef = database.ref('family');
    familyRef.on('value', (snapshot) => {
        const data = snapshot.val();
        if (data) {
            family = Object.values(data); 
            nextId = Math.max(0, ...family.map(p => p.id)) + 1;
        } else {
            if (family.length === 0) {
                 const root = { id: 1, name: "Ibrahim", role: "Ancestor", nickname: "Mai Unguwa Mai Jama'a", parentId: null };
                 database.ref('family/1').set(root);
            }
        }
        renderTree();
    });

    const eventsRef = database.ref('events');
    eventsRef.on('value', (snapshot) => {
        const data = snapshot.val();
        if (data) {
            events = Object.values(data).sort((a, b) => b.created - a.created); 
        } else {
            events = [];
        }
        renderEvents();
    });
}


/* -------------------------------------------------------- */
/* --- Admin & Feature Enforcement --- */
/* -------------------------------------------------------- */
function checkAdminStatus() {
  const isAdmin = sessionStorage.getItem(ADMIN_SESSION_KEY) === 'true';

  if (isAdmin) {
    adminStatus.textContent = '(Logged in as Admin)';
    adminStatus.style.color = 'green';
    addMemberForm.style.opacity = '1';
    addMemberForm.style.pointerEvents = 'auto';
    dataManagement.style.opacity = '1';
    dataManagement.style.pointerEvents = 'auto';
    eventsFooter.style.display = 'flex';
    loginBtn.style.display = 'none';
    logoutBtn.style.display = 'inline-block';
  } else {
    adminStatus.textContent = '(Logged out)';
    adminStatus.style.color = 'red';
    addMemberForm.style.opacity = '0.5';
    addMemberForm.style.pointerEvents = 'none';
    dataManagement.style.opacity = '0.5';
    dataManagement.style.pointerEvents = 'none';
    eventsFooter.style.display = 'none';
    loginBtn.style.display = 'inline-block';
    logoutBtn.style.display = 'none';
  }
  renderTree(); 
  renderEvents(); 
}

loginBtn.addEventListener('click', () => {
  const user = adminUser.value.trim();
  const pass = adminPass.value.trim();

  if (user === ADMIN_USER && pass === ADMIN_PASS) {
    sessionStorage.setItem(ADMIN_SESSION_KEY, 'true');
    alert('Admin Login Successful!');
  } else {
    alert('Invalid Admin Username or Password.');
    sessionStorage.setItem(ADMIN_SESSION_KEY, 'false');
  }
  adminUser.value = '';
  adminPass.value = '';
  checkAdminStatus();
});

logoutBtn.addEventListener('click', () => {
    sessionStorage.setItem(ADMIN_SESSION_KEY, 'false');
    checkAdminStatus();
    alert('Logged out successfully.');
});


/* -------------------------------------------------------- */
/* --- CORE RENDERING --- */
/* -------------------------------------------------------- */
function renderTree(){
  svg.innerHTML = '';
  treeRoot.innerHTML = '';

  const map = buildMap();
  const roots = getRoots();

  const ul = document.createElement('ul');
  ul.style.display = 'inline-block';
  ul.style.textAlign = 'center';

  roots.forEach(root => {
    const li = buildNode(root, map);
    ul.appendChild(li);
  });

  treeRoot.appendChild(ul);
  rebuildParentDropdown();
  rebuildChatMemberList();
  requestAnimationFrame(drawConnections);
}

function buildNode(nodeData, map){
  const li = document.createElement('li');
  li.dataset.id = nodeData.id; 
  
  const card = document.createElement('div');
  card.className = 'card';
  
  const adminBtns = document.createElement('div');
  adminBtns.className = 'admin-btns';
  
  const isAdmin = sessionStorage.getItem(ADMIN_SESSION_KEY) === 'true';
  
  if (isAdmin) {
    const editBtn = document.createElement('button');
    editBtn.textContent = '✏️ Edit';
    editBtn.title = 'Edit Member Details';
    editBtn.style.backgroundColor = '#ffa500'; 
    editBtn.addEventListener('click', (ev) => {
        ev.stopPropagation();
        editMember(nodeData.id);
    });
    adminBtns.appendChild(editBtn);

    const deleteBtn = document.createElement('button');
    deleteBtn.textContent = '❌ Delete';
    deleteBtn.title = 'Delete Member';
    deleteBtn.style.backgroundColor = '#cc0000';
    deleteBtn.addEventListener('click', (ev) => {
        ev.stopPropagation();
        deleteMember(nodeData.id);
    });
    adminBtns.appendChild(deleteBtn);
  }
  
  card.innerHTML = `
    <div class="name">${escapeHtml(nodeData.name)}</div>
    <div class="role">${escapeHtml(nodeData.role)}</div>
    <div class="nick">"${escapeHtml(nodeData.nickname || '')}"</div>
  `;
  
  card.appendChild(adminBtns); 

  const toggle = document.createElement('button');
  toggle.className = 'toggle-btn';
  toggle.textContent = '-';
  toggle.title = 'Collapse/expand branch';
  toggle.addEventListener('click', (ev) => {
    ev.stopPropagation();
    li.classList.toggle('collapsed');
    toggle.textContent = li.classList.contains('collapsed') ? '+' : '-';
    requestAnimationFrame(drawConnections);
  });
  card.appendChild(toggle);

  card.addEventListener('click', (ev) => {
    ev.stopPropagation();
    document.querySelectorAll('.card').forEach(c => c.classList.remove('selected', 'child-highlight'));
    card.classList.add('selected');

    const children = (map.get(nodeData.id) && map.get(nodeData.id).children) || [];
    children.forEach(ch => {
      const childCard = document.querySelector(`li[data-id="${ch.id}"] .card`);
      if(childCard) childCard.classList.add('child-highlight');
    });
    if(children.length>0){
      const first = document.querySelector(`li[data-id="${children[0].id}"]`);
      if(first) first.scrollIntoView({behavior:'smooth', block:'center', inline:'center'});
    }
  });

  li.appendChild(card);

  const children = (map.get(nodeData.id) && map.get(nodeData.id).children) || [];
  if(children.length>0){
    const subUl = document.createElement('ul');
    children.sort((a,b)=>a.id-b.id).forEach(child => {
      const childLi = buildNode(child, map);
      subUl.appendChild(childLi);
    });
    li.appendChild(subUl);
  }

  return li;
}

/* -------------------------------------------------------- */
/* --- Admin CRUD Operations (Writes to Firebase) --- */
/* -------------------------------------------------------- */

addBtn.addEventListener('click', ()=>{
  if (!sessionStorage.getItem(ADMIN_SESSION_KEY) === 'true' || !database) return alert('Must be logged in as Admin.');
  
  const name = inName.value.trim();
  const role = inRole.value.trim();
  const nick = inNick.value.trim();
  const parentVal = parentSelect.value;
  const parentId = parentVal ? Number(parentVal) : null;

  if(!name || !role || !nick){
    alert('Please fill Name, Role and Nickname.');
    return;
  }
  
  const newId = nextId; 
  const newPerson = { id: newId, name, role, nickname: nick, parentId };
  
  database.ref(`family/${newId}`).set(newPerson)
    .then(() => {
        inName.value=''; inRole.value=''; inNick.value=''; parentSelect.value='';
    })
    .catch(error => {
        alert("Failed to add member to database: " + error.message);
    });
});

function deleteMember(idToDelete) {
    if (!sessionStorage.getItem(ADMIN_SESSION_KEY) === 'true' || !database) return;
    if (idToDelete === 1) { 
        alert("Cannot delete the root ancestor (Ibrahim).");
        return;
    }
    
    const member = family.find(p => p.id === idToDelete);
    if (!member) return;

    if (!confirm(`Are you sure you want to delete ${member.name} (id:${idToDelete})? \n\nTheir children will be reassigned as root nodes.`)) {
        return;
    }

    const updates = {};
    const children = family.filter(p => p.parentId === idToDelete);
    children.forEach(child => {
        updates[`family/${child.id}/parentId`] = null; 
    });
    
    updates[`family/${idToDelete}`] = null; 

    database.ref().update(updates)
        .then(() => {
            alert(`${member.name} deleted successfully, and children reassigned.`);
        })
        .catch(error => {
            alert("Failed to delete member or reassign children: " + error.message);
        });
}

function editMember(idToEdit) {
    if (!sessionStorage.getItem(ADMIN_SESSION_KEY) === 'true' || !database) return;
    const member = family.find(p => p.id === idToEdit);
    if (!member) return;

    const newName = prompt(`Edit Name for ${member.name}:`, member.name);
    if (newName === null) return; 

    const newRole = prompt(`Edit Role for ${member.name}:`, member.role);
    if (newRole === null) return; 
    const newNick = prompt(`Edit Nickname for ${member.name}:`, member.nickname);
    if (newNick === null) return; 
    
    let newParentId = member.parentId === null ? '' : member.parentId;
    const parentInput = prompt(`Edit Parent ID (Current: ${member.parentId || 'None'}). Enter ID or leave blank for root:`, newParentId);
    if (parentInput === null) return; 
    
    const parsedParentId = parentInput.trim() === '' ? null : Number(parentInput.trim());
    
    if (parsedParentId !== null && isNaN(parsedParentId)) {
        alert("Invalid Parent ID entered.");
        return;
    }
    
    const updates = {
        name: newName.trim(),
        role: newRole.trim(),
        nickname: newNick.trim(),
        parentId: parsedParentId
    };

    database.ref(`family/${idToEdit}`).update(updates)
        .then(() => {
            alert(`${member.name}'s details updated successfully.`);
        })
        .catch(error => {
            alert("Failed to update member: " + error.message);
        });
}

/* -------------------------------------------------------- */
/* --- Data Management (Export/Import) --- */
/* -------------------------------------------------------- */

function rebuildParentDropdown(){
  const current = parentSelect.value;
  parentSelect.innerHTML = '<option value="">— Parent (root) —</option>';
  family.forEach(p => {
    const opt = document.createElement('option');
    opt.value = String(p.id);
    opt.textContent = `${p.name} (id:${p.id})`;
    parentSelect.appendChild(opt);
  });
  if(current && document.querySelector(`#inParent option[value="${current}"]`)) parentSelect.value = current;
}

exportBtn.addEventListener('click', ()=>{
    if (!sessionStorage.getItem(ADMIN_SESSION_KEY) === 'true') {
        alert('You must be logged in as Admin to export data.');
        return;
    }
    const exportData = {
        family: family, 
        events: events,
        chat: chat 
    };
    
    const dataStr = JSON.stringify(exportData, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    
    const exportFileDefaultName = 'maijamaa_family_export_' + new Date().toISOString().slice(0,10) + '.json';
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
    linkElement.remove();
    alert('Data exported successfully!');
});

importFile.addEventListener('change', (event) => {
    if (!sessionStorage.getItem(ADMIN_SESSION_KEY) === 'true' || !database) {
        alert('You must be logged in as Admin to import data.');
        event.target.value = ''; 
        return;
    }
    
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const importedData = JSON.parse(e.target.result);
            if (!importedData || !importedData.family) {
                throw new Error('Invalid JSON structure. Expected a "family" array.');
            }
            
            if (!confirm('WARNING: Importing this file will OVERWRITE ALL existing Family Tree data and Events in the shared database. Proceed?')) return;
            
            const importedFamily = importedData.family;
            const importedEvents = importedData.events || [];
            
            const familyUpdates = importedFamily.reduce((acc, person) => {
                acc[person.id] = person;
                return acc;
            }, {});
            
            database.ref('family').set(familyUpdates);

            const eventUpdates = importedEvents.reduce((acc, event) => {
                acc[event.created || Date.now()] = event;
                return acc;
            }, {});
            
            database.ref('events').set(eventUpdates);
            
            alert(`Data import successful! ${importedFamily.length} members and ${importedEvents.length} events imported to the shared database.`);
            event.target.value = ''; 
            
        } catch (error) {
            alert('Error importing file: ' + error.message);
            event.target.value = '';
        }
    };
    reader.readAsText(file);
});


/* -------------------------------------------------------- */
/* --- Event Panel Logic (Writes to Firebase) --- */
/* -------------------------------------------------------- */

function renderEvents(){
  eventsBody.innerHTML = '';
  if(events.length === 0){
    eventsBody.innerHTML = '<p style="text-align:center; color:var(--muted); font-style:italic;">No upcoming events.</p>';
  }
  events.forEach((event, index) => {
    const item = document.createElement('div');
    item.className = 'event-item';
    item.innerHTML = `
      <div class="event-title">${escapeHtml(event.title)}</div>
      <div class="event-date">${escapeHtml(event.date)}</div>
      <div class="event-details">${escapeHtml(event.details)}</div>
    `;
    
    const isAdmin = sessionStorage.getItem(ADMIN_SESSION_KEY) === 'true';
    if(isAdmin) {
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'event-delete-btn';
        deleteBtn.innerHTML = '&#x2715;'; 
        deleteBtn.title = 'Delete Event (Admin Only)';
        deleteBtn.addEventListener('click', () => deleteEvent(event.created));
        item.appendChild(deleteBtn);
    }
    
    eventsBody.appendChild(item);
  });
}

addEventBtn.addEventListener('click', () => {
  if (!sessionStorage.getItem(ADMIN_SESSION_KEY) === 'true' || !database) return alert('Must be logged in as Admin.');
    
  const title = eventTitleInput.value.trim();
  const date = eventDateInput.value.trim();
  const details = eventDetailsInput.value.trim();
  
  if (!title || !date || !details) {
    alert('Please fill in the Event Title, Date, and Details.');
    return;
  }
  
  const newEvent = { title, date, details, created: Date.now() };
  
  database.ref(`events/${newEvent.created}`).set(newEvent)
    .then(() => {
        eventTitleInput.value = '';
        eventDateInput.value = '';
        eventDetailsInput.value = '';
    })
    .catch(error => {
        alert("Failed to add event: " + error.message);
    });
});

function deleteEvent(eventKey) {
    if (!sessionStorage.getItem(ADMIN_SESSION_KEY) === 'true' || !database) return;
    if (!confirm('Are you sure you want to delete this event? (Admin Action)')) return;
    
    database.ref(`events/${eventKey}`).remove()
        .catch(error => alert("Failed to delete event: " + error.message));
}

clearEventsBtn.addEventListener('click', () => {
    if (!sessionStorage.getItem(ADMIN_SESSION_KEY) === 'true' || !database) return;
    if(!confirm('Clear ALL shared event announcements? This cannot be undone.')) return;
    
    database.ref('events').set(null)
        .catch(error => alert("Failed to clear events: " + error.message));
});


/* -------------------------------------------------------- */
/* --- Chat Logic (Remains Local) --- */
/* -------------------------------------------------------- */
function rebuildChatMemberList(){
  const prev = chatMember.value;
  chatMember.innerHTML = '';
  const guest = document.createElement('option');
  guest.value = '';
  guest.textContent = '— Choose member (send as) —';
  chatMember.appendChild(guest);
  family.forEach(p => {
    const opt = document.createElement('option');
    opt.value = String(p.id);
    opt.textContent = `${p.name} (${p.nickname}) [id:${p.id}]`;
    chatMember.appendChild(opt);
  });
  if(prev && chatMember.querySelector(`option[value="${prev}"]`)) chatMember.value = prev;
}

function renderChat(){
  chatBody.innerHTML = '';
  chat.forEach(m => {
    const msg = document.createElement('div');
    msg.className = 'message';
    const author = family.find(p => p.id === m.authorId);
    const authorLabel = author ? `${author.name} ("${author.nickname}")` : 'Unknown';
    const time = new Date(m.time).toLocaleString();
    msg.innerHTML = `<div class="meta">${escapeHtml(authorLabel)} • ${escapeHtml(time)}</div><div class="text">${escapeHtml(m.text)}</div>`;
    chatBody.appendChild(msg);
  });
  chatBody.scrollTop = chatBody.scrollHeight;
}

sendChat.addEventListener('click', ()=>{
  const text = chatInput.value.trim();
  const authorId = chatMember.value ? Number(chatMember.value) : null;
  if(!text) return;
  const entry = { id: 'm'+Date.now(), authorId, text, time: Date.now() };
  chat.push(entry);
  saveChatToStorage();
  renderChat();
  chatInput.value='';
});

clearChat.addEventListener('click', ()=>{
  if(!confirm('Clear local chat messages? This cannot be undone.')) return;
  chat = [];
  saveChatToStorage();
  renderChat();
});


/* -------------------------------------------------------- */
/* --- Utility: Draw Connections (Tree Layout) --- */
/* -------------------------------------------------------- */
function drawConnections(){
  const wrapRect = treeWrap.getBoundingClientRect();
  svg.setAttribute('width', wrapRect.width);
  svg.setAttribute('height', wrapRect.height);
  svg.style.left = '0';
  svg.style.top = '0';
  while(svg.firstChild) svg.removeChild(svg.firstChild);

  const lis = treeRoot.querySelectorAll('li[data-id]');
  lis.forEach(li => {
    const children = li.querySelectorAll(':scope > ul > li[data-id]');
    if(children.length === 0) return;

    const parentCard = li.querySelector(':scope > .card');
    if(!parentCard) return;
    const pRect = parentCard.getBoundingClientRect();

    children.forEach(childLi => {
      const childCard = childLi.querySelector(':scope > .card');
      if(!childCard) return;
      const cRect = childCard.getBoundingClientRect();

      const startX = pRect.left + pRect.width/2 - wrapRect.left;
      const startY = pRect.bottom - wrapRect.top;
      const endX = cRect.left + cRect.width/2 - wrapRect.left;
      const endY = cRect.top - wrapRect.top;

      const dx = (endY - startY) * 0.6; 
      const path = document.createElementNS('http://www.w3.org/2000/svg','path');
      const d = `M ${startX} ${startY} C ${startX} ${startY + dx} ${endX} ${endY - dx} ${endX} ${endY}`;
      path.setAttribute('d', d);
      path.setAttribute('fill','none');
      path.setAttribute('stroke','rgba(0,0,0,0.08)');
      path.setAttribute('stroke-width','2');
      svg.appendChild(path);

      const circle = document.createElementNS('http://www.w3.org/2000/svg','circle');
      circle.setAttribute('cx', endX);
      circle.setAttribute('cy', endY);
      circle.setAttribute('r', 3);
      circle.setAttribute('fill', 'rgba(0,0,0,0.06)');
      svg.appendChild(circle);
    });
  });
}

let redrawTimer = null;
function scheduleRedraw(){
  if(redrawTimer) clearTimeout(redrawTimer);
  redrawTimer = setTimeout(()=>{ requestAnimationFrame(drawConnections); }, 120);
}
window.addEventListener('resize', scheduleRedraw);
treeWrap.addEventListener('scroll', scheduleRedraw);


/* -------------------------------------------------------- */
/* --- initialization --- */
/* -------------------------------------------------------- */
function init(){
  checkAdminStatus(); 
  renderChat();
}
init();
