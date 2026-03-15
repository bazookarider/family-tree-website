// 🔐 GEMINI KEY
const GEMINI_API_KEY="AIzaSyDjUPs9Dn2dhn-kArE-8xc6FHbLRuAHSNg";

// 🔐 FIREBASE
import { initializeApp } from
"https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";

import {
getAuth,
signInWithEmailAndPassword,
createUserWithEmailAndPassword,
signOut,
onAuthStateChanged
} from
"https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

// 🔥 PASTE YOUR FIREBASE CONFIG HERE
const firebaseConfig = {
  apiKey: "AIzaSyAG6jDGHVoZ-yHSqvgxbU2RHewvCURcTZI",
  authDomain: "study-hub-ai-a6591.firebaseapp.com",
  projectId: "study-hub-ai-a6591",
  storageBucket: "study-hub-ai-a6591.firebasestorage.app",
  messagingSenderId: "535236262155",
  appId: "1:535236262155:web:9aa462da354c0dbd9e8a0e",
  measurementId: "G-5K2GNV8QVB"
};
const app=initializeApp(firebaseConfig);
const auth=getAuth(app);

// =========================
// AI SYSTEM
// =========================

let currentHandoutText="";
let textChunks=[];

const uploadBtn=document.getElementById("uploadBtn");
const handoutFile=document.getElementById("handoutFile");
const uploadMessage=document.getElementById("uploadMessage");
const aiOutput=document.getElementById("aiOutput");

uploadBtn.addEventListener("click",async()=>{

const file=handoutFile.files[0];

if(!file){
uploadMessage.textContent="Select a file first";
return;
}

uploadMessage.textContent="Reading handout...";

const text=await extractTextFromFile(file);

currentHandoutText=text;

textChunks=splitIntoChunks(text);

uploadMessage.textContent="Handout loaded.";

});

async function extractTextFromFile(file){

const ext=file.name.split(".").pop().toLowerCase();

if(ext==="txt") return await file.text();

if(ext==="pdf"){

const buffer=await file.arrayBuffer();
const pdf=await pdfjsLib.getDocument({data:buffer}).promise;

let text="";

for(let i=1;i<=pdf.numPages;i++){

const page=await pdf.getPage(i);
const content=await page.getTextContent();

text+=content.items.map(s=>s.str).join(" ");

}

return text;

}

if(ext==="docx"){

const buffer=await file.arrayBuffer();
const result=await mammoth.extractRawText({arrayBuffer:buffer});

return result.value;

}

return "";

}

// =========================
// SMART SEARCH
// =========================

function splitIntoChunks(text){

const size=1000;
let chunks=[];

for(let i=0;i<text.length;i+=size){
chunks.push(text.substring(i,i+size));
}

return chunks;

}

function findRelevantChunks(question){

const words=question.toLowerCase().split(" ");

let scores=textChunks.map(chunk=>{

let score=0;

words.forEach(word=>{
if(chunk.toLowerCase().includes(word)){
score++;
}
});

return {chunk,score};

});

scores.sort((a,b)=>b.score-a.score);

return scores.slice(0,3).map(s=>s.chunk).join("\n");

}

// =========================
// GEMINI
// =========================

async function callGemini(prompt){

const response=await fetch(

"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key="+GEMINI_API_KEY,

{

method:"POST",

headers:{"Content-Type":"application/json"},

body:JSON.stringify({
contents:[{parts:[{text:prompt}]}]
})

}

);

const data=await response.json();

return data.candidates[0].content.parts[0].text;

}

// =========================
// TOOL BUTTONS
// =========================

document.querySelectorAll(".tool-btn").forEach(btn=>{

btn.addEventListener("click",async()=>{

const tool=btn.dataset.tool;

if(!currentHandoutText){

aiOutput.textContent="Upload handout first";

return;

}

let prompt="";

if(tool==="summary")
prompt=`Summarize:\n${currentHandoutText}`;

if(tool==="notes")
prompt=`Create revision notes:\n${currentHandoutText}`;

if(tool==="quiz")
prompt=`Create quiz questions with answers:\n${currentHandoutText}`;

if(tool==="questions")
prompt=`Generate exam questions:\n${currentHandoutText}`;

if(tool==="predictor")
prompt=`Predict exam topics:\n${currentHandoutText}`;

aiOutput.textContent="Generating...";

const result=await callGemini(prompt);

aiOutput.textContent=result;

});

});

// =========================
// ASK AI
// =========================

const askAiBtn=document.getElementById("askAiBtn");
const aiPrompt=document.getElementById("aiPrompt");

askAiBtn.addEventListener("click",async()=>{

const question=aiPrompt.value;

const relevant=findRelevantChunks(question);

const prompt=`
Use this lecture material to answer:

${relevant}

Question:
${question}
`;

const result=await callGemini(prompt);

aiOutput.textContent=result;

});