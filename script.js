const $=id=>document.getElementById(id);
let photoData="",gps=null;
$("photo").addEventListener("change",e=>{
 const file=e.target.files[0]; if(!file)return;
 const reader=new FileReader();
 reader.onload=x=>{photoData=x.target.result;$("preview").src=photoData;$("preview").style.display="block";$("uploadPrompt").style.display="none"};
 reader.readAsDataURL(file);
});
$("gpsBtn").addEventListener("click",()=>{
 if(!navigator.geolocation){$("gpsText").textContent="Geolocation is not supported.";return}
 $("gpsBtn").disabled=true;$("gpsBtn").textContent="Getting location...";
 navigator.geolocation.getCurrentPosition(p=>{
   gps={lat:p.coords.latitude,lon:p.coords.longitude};
   $("gpsText").textContent=`Captured: ${gps.lat.toFixed(6)}, ${gps.lon.toFixed(6)}`;
   $("gpsBtn").disabled=false;$("gpsBtn").textContent="✓ Location Captured";
 },()=>{$("gpsText").textContent="Permission denied/unavailable. Allow location and retry.";$("gpsBtn").disabled=false;$("gpsBtn").textContent="Use My Location"},{enableHighAccuracy:true,timeout:10000,maximumAge:0});
});
$("reportForm").addEventListener("submit",e=>{
 e.preventDefault();
 if(!photoData){$("message").textContent="Please add a photo.";return}
 if(!gps){$("message").textContent="Please capture GPS location.";return}
 const issues=JSON.parse(localStorage.getItem("sunoBharatIssues")||"[]");
 issues.unshift({id:Date.now().toString(),photo:photoData,category:$("category").value,location:$("location").value,description:$("description").value,gps,status:"Reported",verified:false,supporters:0,amplified:false,created:new Date().toISOString()});
 localStorage.setItem("sunoBharatIssues",JSON.stringify(issues));
 e.target.reset();photoData="";gps=null;$("preview").style.display="none";$("uploadPrompt").style.display="block";$("gpsText").textContent="Not captured yet";$("gpsBtn").disabled=false;$("gpsBtn").textContent="Use My Location";
 $("message").textContent="Issue created successfully on this browser. Real multi-user storage comes with the backend.";
 render();
 $("issues").scrollIntoView({behavior:"smooth"});
});
function render(){
 const issues=JSON.parse(localStorage.getItem("sunoBharatIssues")||"[]");
 $("issueGrid").innerHTML=issues.length?issues.map(i=>{
   const score=Math.min(100,15+i.supporters*8+(i.verified?25:0)+(i.amplified?20:0));
   return `<article class="issue-card"><div class="issue-image"><img src="${i.photo}" alt="Civic issue"><span class="badge">${esc(i.status)}</span></div><div class="issue-body"><span class="tag">${esc(i.category)}</span><h3>${esc(i.description)}</h3><p>📍 ${esc(i.location)}</p><p>GPS: ${i.gps.lat.toFixed(5)}, ${i.gps.lon.toFixed(5)}</p><p>Verification: <strong>${i.verified?"Verified ✓":"Pending"}</strong></p><div class="priority"><span style="--score:${score}%"></span></div><div class="issue-actions"><strong>${i.supporters} supports</strong><button onclick="support('${i.id}')">Support +</button><button onclick="amplify('${i.id}')">${i.amplified?"Amplified ✓":"Amplify"}</button></div></div></article>`;
 }).join(""):`<div class="issue-card"><div class="issue-body"><h3>No reports yet</h3><p>Submit the first civic issue.</p></div></div>`;
 $("totalCount").textContent=issues.length;
 $("verifiedCount").textContent=issues.filter(i=>i.verified).length;
 $("supportCount").textContent=issues.reduce((a,i)=>a+i.supporters,0);
 $("amplifyCount").textContent=issues.filter(i=>i.amplified).length;
}
function support(id){
 const issues=JSON.parse(localStorage.getItem("sunoBharatIssues")||"[]"),i=issues.find(x=>x.id===id);if(!i)return;
 i.supporters++;localStorage.setItem("sunoBharatIssues",JSON.stringify(issues));render();
}
function amplify(id){
 const issues=JSON.parse(localStorage.getItem("sunoBharatIssues")||"[]"),i=issues.find(x=>x.id===id);if(!i)return;
 i.amplified=true;localStorage.setItem("sunoBharatIssues",JSON.stringify(issues));render();
}
$("clearBtn").addEventListener("click",()=>{localStorage.removeItem("sunoBharatIssues");render()});
function esc(v){return String(v).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]))}
render();