const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const out=path.resolve(__dirname,'../Exports/FemaleCommoner/Browser');fs.mkdirSync(out,{recursive:true});
const delay=ms=>new Promise(r=>setTimeout(r,ms));
async function main(){
 const tabs=await(await fetch('http://127.0.0.1:'+(process.env.HIGHHORN_DEBUG_PORT||9224)+'/json',{signal:AbortSignal.timeout(10000)})).json();const tab=tabs.find(t=>t.type==='page');const ws=new WebSocket(tab.webSocketDebuggerUrl);await new Promise((r,j)=>{ws.onopen=r;ws.onerror=j;});
 let id=0;const pending=new Map(),errors=[],requests=[];
 ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id){const p=pending.get(m.id);if(p){pending.delete(m.id);m.error?p.reject(Error(JSON.stringify(m.error))):p.resolve(m.result);}}else if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails.exception?.description||m.params.exceptionDetails.text);else if(m.method==='Network.requestWillBeSent')requests.push(m.params.request.url);else if(m.method==='Runtime.consoleAPICalled'&&m.params.type==='error')errors.push(m.params.args.map(a=>a.value||a.description).join(' '));};
 function send(method,params={}){const key=++id;return new Promise((resolve,reject)=>{const timer=setTimeout(()=>{pending.delete(key);reject(Error('Browser command timed out: '+method));},30000);pending.set(key,{resolve:r=>{clearTimeout(timer);resolve(r)},reject:e=>{clearTimeout(timer);reject(e)}});ws.send(JSON.stringify({id:key,method,params}));});}
 async function ev(expression){const r=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result.value;}
 async function wait(expression){const t=Date.now();while(Date.now()-t<60000){if(await ev(expression))return;await delay(300);}throw Error('Timed out: '+expression+'; errors='+errors.join('\n'));}
 async function shot(name){const r=await send('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(out,name+'.png'),Buffer.from(r.data,'base64'));}
 async function choose(model){await ev(`document.querySelector('#cmodel').value='${model}';document.querySelector('#cmodel').dispatchEvent(new Event('change'))`);await wait(`HighhornCommoner.inspect().ready&&HighhornCommoner.inspect().model==='${model}'`);}
 await send('Page.enable');await send('Runtime.enable');await send('Network.enable');
 await send('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
 await send('Page.navigate',{url:'http://127.0.0.1:8001/'});await wait('typeof profile!=="undefined"');
 await ev('profile.hero.look.model="prototype";profile.hero.name="Commoner QA";profile.xp=1290;saveProfile();window.__before=localStorage.getItem(PROF_KEY);renderLobby("hero")');await wait('HighhornCommoner.inspect().ready');
 assert.equal(await ev('localStorage.getItem(PROF_KEY)===window.__before'),true);
 assert.deepEqual(await ev('[...document.querySelector("#cmodel").options].map(o=>o.value)'),['male-commoner','female-commoner']);
 assert.equal(await ev('!!document.querySelector(".legacy-appearance")'),false);
 const states={};
 for(const model of ['male-commoner','female-commoner']){
  await choose(model);assert.equal(await ev('document.querySelectorAll(".commoner-viewport canvas").length'),1);
  for(const clip of ['rest','walk','run','rest']){await ev(`HighhornCommoner.setClip('${clip}')`);await wait('HighhornCommoner.inspect().actionTime>0');const s=await ev('HighhornCommoner.inspect()');assert.equal(s.clip,clip);await shot(model+'_'+clip);}
  states[model]=await ev('HighhornCommoner.inspect()');assert.deepEqual(states[model].clips.sort(),['idle','run','walk']);assert.equal(states[model].meshes,5);
 }
 // Save a portrait from the actual female browser model to match the male style.
 const portrait=await ev('HighhornCommoner.capturePortrait()');assert(portrait.startsWith('data:image/png;base64,'));fs.writeFileSync(path.resolve(__dirname,'../Models/Heroes/FemaleCommoner/portrait.png'),Buffer.from(portrait.split(',')[1],'base64'));
 for(let i=0;i<3;i++){await choose('male-commoner');await choose('female-commoner');}
 const previewRequests=requests.filter(u=>/commoner(?:-idle)?\.glb/.test(u)&&!u.includes('board'));assert.equal(previewRequests.length,2,'Switching characters must reuse loaded previews');
 await ev('document.querySelector("[data-ab2=merchant]").click();document.querySelector("[data-sg=star]").click();document.querySelector("#csave").click()');
 assert.equal(await ev('profile.hero.look.model'),'female-commoner');assert.equal(await ev('profile.xp'),1290);assert.equal(await ev('profile.hero.ability'),'merchant');
 assert.equal(await ev('document.querySelector("#lbProf img").getAttribute("src")'),'Models/Heroes/FemaleCommoner/portrait.png');
 await ev('renderLobby("hero")');await choose('male-commoner');await ev('document.querySelector("#cundo").click()');assert.equal(await ev('draft.look.model'),'female-commoner');
 await ev('HighhornCommoner.mount(document.querySelector("#commonerMount"),{model:"female-commoner",reducedMotion:true});HighhornCommoner.setClip("rest")');await delay(350);assert.equal(await ev('HighhornCommoner.inspect().actionTime'),0);
 for(const width of [820,390]){await send('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:width<500});await delay(200);assert.equal(await ev('document.querySelector(".lb-main").scrollWidth<=document.querySelector(".lb-main").clientWidth+1'),true);await shot('Female_'+width);}
 await send('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
 await ev('renderLobby("play");document.querySelector("#gen").click()');await wait('!!G&&G.phase==="setup"');assert.equal(await ev('G.heroes[G.you].look.model'),'female-commoner');
 await ev('window.__edges=[...G.B.edges.values()].filter(e=>!e.river);G.heroes.forEach((h,p)=>{h.look.model=p<2?"male-commoner":"female-commoner";h.edge=window.__edges[20+p*3].key;h.wounded=false;});renderPieces(G);[...document.querySelectorAll("button")].find(b=>b.textContent.includes("Start placing"))?.click()');
 await wait('Object.values(heroMeshes).length===4&&Object.values(heroMeshes).every(h=>h.userData.commoner.model)');await delay(350);
 const board=await ev('HighhornCommoner.inspectBoard()');assert.equal(board.heroes.length,4);assert(board.heroes.every(h=>h.bones===24&&h.clip==='idle'));assert.equal(requests.filter(u=>u.includes('commoner-board.glb')).length,2);
 const independent=await ev('(()=>{const bones=h=>{let m;h.userData.commoner.model.traverse(o=>{if(o.isSkinnedMesh&&!m)m=o});return m.skeleton.bones[0]};return bones(heroMeshes[0])!==bones(heroMeshes[1])&&bones(heroMeshes[2])!==bones(heroMeshes[3])})()');assert(independent);
 await ev('heroMeshes[0].userData.walking=true;heroMeshes[2].userData.walking=true');await delay(300);assert.deepEqual(await ev('Object.values(heroMeshes).map(h=>h.userData.commoner.clip)'),['walk','idle','walk','idle']);
 await ev('heroMeshes[0].userData.walking=false;heroMeshes[2].userData.walking=false;renderPieces(G)');
 await shot('Board_mixed_commoners');
 await send('Page.reload',{ignoreCache:true});await wait('typeof profile!=="undefined"');assert.equal(await ev('profile.hero.look.model'),'female-commoner');await ev('renderLobby("hero")');await wait('HighhornCommoner.inspect().ready');assert.equal(await ev('HighhornCommoner.inspect().model'),'female-commoner');
 await send('Network.setBlockedURLs',{urls:['*FemaleCommoner/commoner.glb*']});await send('Page.reload',{ignoreCache:true});await wait('typeof profile!=="undefined"');await ev('renderLobby("hero")');await wait('!!HighhornCommoner.inspect().error');assert.equal(await ev('document.querySelector(".commoner-retry").hidden'),false);
 // Switching away from a failed female request must still load the male.
 await choose('male-commoner');await send('Network.setBlockedURLs',{urls:[]});await choose('female-commoner');
 assert.deepEqual(errors,[]);
 const report={passed:true,states,board,independentSkeletons:independent,previewRequests:2,boardRequests:2,profilePreserved:true,femaleSaveReload:true,loaderRecovery:true,errors};fs.writeFileSync(path.join(out,'Validation.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));ws.close();
}
main().catch(e=>{console.error(e);process.exit(1)});
