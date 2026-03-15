const GEMINI_API_KEY="AIzaSyDjUPs9Dn2dhn-kArE-8xc6FHbLRuAHSNg";

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

uploadMessage.textContent="Reading file...";

const text=await extractTextFromFile(file);

currentHandoutText=text;

textChunks=splitIntoChunks(text);

uploadMessage.textContent="Handout loaded. AI ready.";

aiOutput.textContent="Handout loaded successfully.";

});

async function extractTextFromFile(file){

const ext=file.name.split(".").pop().toLowerCase();

if(ext==="txt"){
return await file.text();
}

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

document.querySelectorAll(".tool-btn").forEach(btn=>{

btn.addEventListener("click",async()=>{

if(!currentHandoutText){
aiOutput.textContent="Upload a handout first.";
return;
}

const tool=btn.dataset.tool;

let prompt="";

if(tool==="summary"){
prompt=`Summarize this handout:\n${currentHandoutText}`;
}

if(tool==="notes"){
prompt=`Create revision notes:\n${currentHandoutText}`;
}

if(tool==="quiz"){
prompt=`Create quiz questions with answers:\n${currentHandoutText}`;
}

if(tool==="questions"){
prompt=`Generate likely exam questions:\n${currentHandoutText}`;
}

if(tool==="predictor"){
prompt=`Predict most likely exam topics:\n${currentHandoutText}`;
}

aiOutput.textContent="Generating...";

const result=await callGemini(prompt);

aiOutput.textContent=result;

});

});

const askAiBtn=document.getElementById("askAiBtn");
const aiPrompt=document.getElementById("aiPrompt");

askAiBtn.addEventListener("click",async()=>{

const question=aiPrompt.value;

if(!currentHandoutText){
aiOutput.textContent="Upload a handout first.";
return;
}

aiOutput.textContent="Searching handout...";

const relevantText=findRelevantChunks(question);

const prompt=`
Use the following lecture material to answer clearly.

Material:
${relevantText}

Question:
${question}
`;

const result=await callGemini(prompt);

aiOutput.textContent=result;

});