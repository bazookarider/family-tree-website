import { initializeApp } from "https://www.gstatic.com/firebasejs/12.10.0/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.10.0/firebase-auth.js";
import { getFirestore, collection, addDoc, getDocs, doc, updateDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/12.10.0/firebase-firestore.js";

// -------------------- FIREBASE CONFIG --------------------
const firebaseConfig = {
  apiKey: "AIzaSyDJFQnwOs-fetKVy0Ow43vktz8xwefZMks",
  authDomain: "cyou-db8f0.firebaseapp.com",
  projectId: "cyou-db8f0",
  storageBucket: "cyou-db8f0.firebasestorage.app",
  messagingSenderId: "873569975141",
  appId: "1:873569975141:web:147eb7b7b4043a38c9bf8c",
  measurementId: "G-T66B50HFJ8"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const provider = new GoogleAuthProvider();

// -------------------- ELEMENTS --------------------
const loginBtn = document.getElementById("loginBtn");
const logoutBtn = document.getElementById("logoutBtn");
const adminPanel = document.getElementById("adminPanel");
const leaguesGrid = document.getElementById("leaguesGrid");
const leagueDetailSection = document.getElementById("leagueDetail");
const leagueTitle = document.getElementById("leagueTitle");
const addPlayerBtn = document.getElementById("addPlayerBtn");
const playerNameInput = document.getElementById("playerName");
const homePlayerSelect = document.getElementById("homePlayer");
const awayPlayerSelect = document.getElementById("awayPlayer");
const matchDateInput = document.getElementById("matchDate");
const homeGoalsInput = document.getElementById("homeGoals");
const awayGoalsInput = document.getElementById("awayGoals");
const recordMatchBtn = document.getElementById("recordMatchBtn");
const leagueTableBody = document.querySelector("#leagueTable tbody");
const playersListContainer = document.getElementById("playersList");
const matchesTableBody = document.querySelector("#matchesTable tbody");

const playerInputGroup = document.getElementById("playerInputGroup");
const matchInputGroup = document.getElementById("matchInputGroup");
const actionsHeader = document.getElementById("actionsHeader");

let currentLeagueId = null;
let currentLeagueOwnerId = null; // We now track WHO owns the active league
let players = [];
let prevPositions = {};
let isLeagueOwner = false; // True ONLY if the logged-in user created this specific league

// -------------------- AUTH --------------------
loginBtn.onclick = () => signInWithPopup(auth, provider);
logoutBtn.onclick = () => signOut(auth);

onAuthStateChanged(auth, (user) => {
  if (user) { 
    loginBtn.style.display="none"; 
    logoutBtn.style.display="flex"; 
    adminPanel.style.display="block"; // Logged in users can create a new league
  } else { 
    loginBtn.style.display="flex"; 
    logoutBtn.style.display="none"; 
    adminPanel.style.display="none"; // Visitors cannot create leagues
  }
  
  // If we are currently looking at a league, re-verify ownership
  if (currentLeagueId) {
    verifyOwnershipAndRender();
  }
});

// Helper function to check if the current user owns the league they are viewing
async function verifyOwnershipAndRender() {
  const user = auth.currentUser;
  isLeagueOwner = (user && user.uid === currentLeagueOwnerId);

  if (isLeagueOwner) {
    playerInputGroup.style.display = "flex";
    matchInputGroup.style.display = "block";
    actionsHeader.style.display = "table-cell";
  } else {
    playerInputGroup.style.display = "none";
    matchInputGroup.style.display = "none";
    actionsHeader.style.display = "none";
  }
  
  await loadPlayersList();
  await loadMatchesList();
}

// -------------------- CREATE LEAGUE --------------------
document.getElementById("createLeagueBtn").onclick = async () => {
  const name = document.getElementById("leagueName").value.trim();
  const user = auth.currentUser;
  if (!name || !user) return;
  await addDoc(collection(db,"leagues"),{name, ownerId:user.uid, ownerName:user.displayName, createdAt:new Date()});
  document.getElementById("leagueName").value = "";
  loadLeagues();
};

// -------------------- LOAD LEAGUES (Public View) --------------------
async function loadLeagues() {
  leaguesGrid.innerHTML="";
  const snapshot = await getDocs(collection(db,"leagues"));
  snapshot.forEach(leagueDoc => {
    const league = leagueDoc.data();
    const div = document.createElement("div");
    div.className = "league-card";
    div.innerHTML = `<h3>${league.name}</h3><p>Owner: ${league.ownerName}</p>`;
    // Pass the ownerId to the detail view so we know who the boss is
    div.onclick = () => showLeagueDetail(leagueDoc.id, league.name, league.ownerId);
    leaguesGrid.appendChild(div);
  });
}

// -------------------- SHOW LEAGUE DETAIL --------------------
async function showLeagueDetail(leagueId, leagueName, ownerId){
  currentLeagueId = leagueId;
  currentLeagueOwnerId = ownerId; 
  leagueDetailSection.style.display="block";
  leagueTitle.textContent=leagueName;
  
  await loadPlayers();
  await loadLeagueTable();
  await verifyOwnershipAndRender(); // This handles showing/hiding admin tools
}

// -------------------- ADD PLAYER --------------------
addPlayerBtn.onclick=async()=>{
  if (!isLeagueOwner) return; // Strict block
  const name=playerNameInput.value.trim();
  if(!name || !currentLeagueId) return;
  await addDoc(collection(db,`leagues/${currentLeagueId}/players`),{
    name, stats:{P:0,W:0,D:0,L:0,G:0,GA:0,GD:0,Pts:0,position:0}
  });
  playerNameInput.value="";
  await loadPlayers();
  await loadPlayersList();
  await loadLeagueTable();
};

// -------------------- LOAD PLAYERS --------------------
async function loadPlayers(){
  players=[]; homePlayerSelect.innerHTML=""; awayPlayerSelect.innerHTML="";
  const snapshot=await getDocs(collection(db,`leagues/${currentLeagueId}/players`));
  snapshot.forEach(pDoc => {
    const player={id:pDoc.id,...pDoc.data()};
    players.push(player);
    homePlayerSelect.innerHTML+=`<option value="${player.id}">${player.name}</option>`;
    awayPlayerSelect.innerHTML+=`<option value="${player.id}">${player.name}</option>`;
  });
}

// -------------------- RECORD MATCH --------------------
recordMatchBtn.onclick=async()=>{
  if (!isLeagueOwner) return; // Strict block
  const date=matchDateInput.value;
  const homeId=homePlayerSelect.value;
  const awayId=awayPlayerSelect.value;
  const homeGoals=parseInt(homeGoalsInput.value);
  const awayGoals=parseInt(awayGoalsInput.value);
  if(!date||!homeId||!awayId) return;
  await addDoc(collection(db,`leagues/${currentLeagueId}/matches`),{date,homeId,awayId,homeGoals,awayGoals});
  homeGoalsInput.value=""; awayGoalsInput.value="";
  await loadLeagueTable(); await loadMatchesList();
};

// -------------------- LEAGUE TABLE --------------------
async function loadLeagueTable(){
  if(!currentLeagueId) return;
  const playersSnapshot=await getDocs(collection(db,`leagues/${currentLeagueId}/players`));
  const matchesSnapshot=await getDocs(collection(db,`leagues/${currentLeagueId}/matches`));
  let stats={};
  
  playersSnapshot.forEach(pDoc => {stats[pDoc.id]={...pDoc.data().stats,name:pDoc.data().name};});
  
  matchesSnapshot.forEach(mDoc => {
    const m = mDoc.data();
    if (!stats[m.homeId] || !stats[m.awayId]) return; 

    stats[m.homeId].P++; stats[m.awayId].P++;
    stats[m.homeId].G+=m.homeGoals; stats[m.homeId].GA+=m.awayGoals;
    stats[m.awayId].G+=m.awayGoals; stats[m.awayId].GA+=m.homeGoals;
    if(m.homeGoals>m.awayGoals){ stats[m.homeId].W++; stats[m.homeId].Pts+=3; stats[m.awayId].L++; }
    else if(m.homeGoals<m.awayGoals){ stats[m.awayId].W++; stats[m.awayId].Pts+=3; stats[m.homeId].L++; }
    else{ stats[m.homeId].D++; stats[m.homeId].Pts++; stats[m.awayId].D++; stats[m.awayId].Pts++; }
  });
  
  for(let id in stats) stats[id].GD=stats[id].G-stats[id].GA;
  let table=Object.values(stats);
  table.sort((a,b)=>b.Pts-a.Pts||b.GD-a.GD);
  leagueTableBody.innerHTML="";
  table.forEach((p,i)=>{
    let prev=prevPositions[p.name]||i+1;
    let arrow=i+1<prev?"⬆":i+1>prev?"⬇":"–";
    prevPositions[p.name]=i+1;
    leagueTableBody.innerHTML+=`<tr><td>${i+1}</td><td>${p.name}</td><td>${p.P}</td><td>${p.W}</td><td>${p.D}</td><td>${p.L}</td><td>${p.G}</td><td>${p.GA}</td><td>${p.GD}</td><td>${p.Pts}</td><td>${arrow}</td></tr>`;
  });
}

// -------------------- PLAYERS LIST --------------------
async function loadPlayersList(){
  playersListContainer.innerHTML="";
  const snapshot=await getDocs(collection(db,`leagues/${currentLeagueId}/players`));
  snapshot.forEach(pDoc => {
    const player={id:pDoc.id,...pDoc.data()};
    const div=document.createElement("div"); div.className="card";
    
    // Only show action buttons if the current user OWNS this league
    let actionButtons = isLeagueOwner ? `<button class="action-btn edit">Edit</button><button class="action-btn delete">Delete</button>` : ``;
    div.innerHTML=`<span>${player.name}</span>${actionButtons}`;
    
    if (isLeagueOwner) {
      const [editBtn,deleteBtn]=div.querySelectorAll("button");
      editBtn.onclick=async()=>{
        const newName=prompt("Enter new player name:",player.name);
        if(!newName) return;
        await updateDoc(doc(db,`leagues/${currentLeagueId}/players`,player.id),{name:newName});
        await loadPlayers(); await loadPlayersList(); await loadLeagueTable(); await loadMatchesList();
      };
      deleteBtn.onclick=async()=>{
        if(!confirm("Delete player and their matches?")) return;
        await deleteDoc(doc(db,`leagues/${currentLeagueId}/players`,player.id));
        const matchesSnap=await getDocs(collection(db,`leagues/${currentLeagueId}/matches`));
        matchesSnap.forEach(async mDoc=>{
          const m=mDoc.data();
          if(m.homeId===player.id||m.awayId===player.id){ await deleteDoc(doc(db,`leagues/${currentLeagueId}/matches`,mDoc.id)); }
        });
        await loadPlayers(); await loadPlayersList(); await loadLeagueTable(); await loadMatchesList();
      };
    }
    playersListContainer.appendChild(div);
  });
}

// -------------------- MATCHES LIST --------------------
async function loadMatchesList(){
  matchesTableBody.innerHTML="";
  const snapshot=await getDocs(collection(db,`leagues/${currentLeagueId}/matches`));
  
  snapshot.forEach(mDoc => {
    const m=mDoc.data();
    const home=players.find(p=>p.id===m.homeId)?.name||"Unknown";
    const away=players.find(p=>p.id===m.awayId)?.name||"Unknown";
    const tr=document.createElement("tr");
    
    // Only show action cells if the current user OWNS this league
    let actionCells = isLeagueOwner ? `<td><button class="action-btn edit">Edit</button><button class="action-btn delete">Delete</button></td>` : `<td style="display:none;"></td>`;
    
    tr.innerHTML=`<td>${m.date}</td><td>${home}</td><td>${m.homeGoals} - ${m.awayGoals}</td><td>${away}</td>${actionCells}`;
    
    if (isLeagueOwner) {
      const [editBtn,deleteBtn]=tr.querySelectorAll("button");
      editBtn.onclick=async()=>{
        const newHome=parseInt(prompt("New home goals:",m.homeGoals));
        const newAway=parseInt(prompt("New away goals:",m.awayGoals));
        if(isNaN(newHome)||isNaN(newAway)) return;
        await updateDoc(doc(db,`leagues/${currentLeagueId}/matches`,mDoc.id),{homeGoals:newHome,awayGoals:newAway});
        await loadLeagueTable(); await loadMatchesList();
      };
      deleteBtn.onclick=async()=>{
        if(!confirm("Are you sure you want to delete this match?")) return;
        await deleteDoc(doc(db,`leagues/${currentLeagueId}/matches`,mDoc.id));
        await loadLeagueTable(); await loadMatchesList();
      };
    }
    matchesTableBody.appendChild(tr);
  });
}

loadLeagues();
