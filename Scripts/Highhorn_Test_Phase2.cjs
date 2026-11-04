/* Browser tests use a separate Chrome profile, never the player's localStorage. */
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const out=path.resolve(__dirname,'../Exports/HeroPhase2');
const delay=ms=>new Promise(r=>setTimeout(r,ms));
async function main(){
 const tabs=await(await fetch('http://127.0.0.1:9224/json')).json();const tab=tabs.find(t=>t.type==='page');
 const ws=new WebSocket(tab.webSocketDebuggerUrl);await new Promise((r,j)=>{ws.onopen=r;ws.onerror=j;});
 let id=0;const pending=new Map(),errors=[],requests=[];
 ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id){const p=pending.get(m.id);if(p){pending.delete(m.id);m.error?p.reject(Error(JSON.stringify(m.error))):p.resolve(m.result);}}else if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails.exception?.description||m.params.exceptionDetails.text);else if(m.method==='Network.requestWillBeSent')requests.push(m.params.request.url);};
 function send(method,params={}){const key=++id;return new Promise((resolve,reject)=>{pending.set(key,{resolve,reject});ws.send(JSON.stringify({id:key,method,params}));});}
 async function ev(expression){const r=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result.value;}
 async function wait(expression){const t=Date.now();while(Date.now()-t<45000){if(await ev(expression))return;await delay(250);}throw Error('Timed out: '+expression);}
 async function shot(name){const r=await send('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(out,name+'.png'),Buffer.from(r.data,'base64'));}
 await send('Page.enable');await send('Runtime.enable');await send('Network.enable');
 await send('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
 await send('Page.navigate',{url:'http://127.0.0.1:8001/'});await wait('typeof profile!=="undefined"');
 // An existing procedural character/save must render with the replacement without
 // rewriting its identity, appearance fields, progress or stored game.
 await ev('profile.hero.look.model="prototype";profile.hero.name="Legacy Hero QA";profile.xp=1290;saveProfile();window.__profileBefore=localStorage.getItem(PROF_KEY);window.__saveBefore=localStorage.getItem("hexworld.save");renderLobby("home")');
 assert.equal(await ev('document.querySelector("#lbProf img").getAttribute("src")'),'Models/Heroes/MaleCommoner/portrait.png');
 await shot('Home_new_portrait');
 await ev('renderLobby("hero")');await wait('HighhornCommoner.inspect().ready');
 assert.equal(await ev('document.querySelector("#cmodel").options.length'),1);
 assert.equal(await ev('document.querySelector(".legacy-appearance")'),null);
 assert.equal(await ev('localStorage.getItem(PROF_KEY)===window.__profileBefore'),true);
 assert.equal(await ev('localStorage.getItem("hexworld.save")===window.__saveBefore'),true);
 const initial=await ev('HighhornCommoner.inspect()');assert(initial.clips.includes('idle'));assert.equal(initial.clip,'rest');
 await delay(600);assert((await ev('HighhornCommoner.inspect().actionTime'))>0);await shot('Creator_relaxed_idle');
 for(const clip of ['walk','run','rest']){await ev(`HighhornCommoner.setClip('${clip}')`);await delay(450);const s=await ev('HighhornCommoner.inspect()');assert.equal(s.clip,clip);assert(s.actionTime>0);await shot('Creator_'+clip);}
 await ev('window.__canvas=document.querySelector(".commoner-viewport canvas");document.querySelector("[data-ab2=merchant]").click();document.querySelector("[data-sg=star]").click()');
 assert.equal(await ev('window.__canvas===document.querySelector(".commoner-viewport canvas")'),true);
 await ev('document.querySelector("#cundo").click()');assert.equal(await ev('draft.name'),'Legacy Hero QA');
 await ev('document.querySelector("#csave").click()');assert.equal(await ev('profile.xp'),1290);assert.equal(await ev('profile.hero.look.model'),'male-commoner');
 await ev('renderLobby("hero");HighhornCommoner.mount(document.querySelector("#commonerMount"),{reducedMotion:true});HighhornCommoner.setClip("rest")');
 await delay(350);assert.equal(await ev('HighhornCommoner.inspect().actionTime'),0);assert.equal(await ev('HighhornCommoner.inspect().autoRotate'),false);
 for(const width of [820,390]){await send('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:width<500});await delay(200);assert.equal(await ev('document.querySelector(".lb-main").scrollWidth<=document.querySelector(".lb-main").clientWidth+1'),true);await shot('Creator_'+width);}
 await send('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
 await ev('renderLobby("play");document.querySelector("#gen").click()');await wait('!!G&&G.phase==="setup"');
 // Put all four test heroes on separate real edges for rendering checks. The
 // deterministic fixture is in this isolated test tab only, never a real save.
 await ev('window.__edges=[...G.B.edges.values()].filter(e=>!e.river);G.heroes.forEach((h,p)=>{h.edge=window.__edges[20+p*3].key;h.wounded=false;});renderPieces(G);camOverview()');
 await wait('HighhornCommoner.inspectBoard().heroes.length===4&&HighhornCommoner.inspectBoard().heroes.every(h=>h.ready)');await delay(500);
 const board=await ev('HighhornCommoner.inspectBoard()');assert(board.heroes.every(h=>h.bones===24&&h.clip==='idle'));
 const shared=await ev('(()=>{const a=heroMeshes[0].userData.commoner,b=heroMeshes[1].userData.commoner;let am,bm;a.model.traverse(o=>{if(o.isSkinnedMesh&&!am)am=o});b.model.traverse(o=>{if(o.isSkinnedMesh&&!bm)bm=o});return {bonesIndependent:am.skeleton.bones[0]!==bm.skeleton.bones[0],geometryShared:am.geometry===bm.geometry,materialShared:am.material===bm.material}})()');
 assert(shared.bonesIndependent&&shared.geometryShared&&shared.materialShared);
 const bounds=await ev('Object.values(heroMeshes).map(h=>{h.updateMatrixWorld(true);const b=new THREE.Box3();h.userData.commoner.model.traverse(m=>{if(!m.isSkinnedMesh)return;m.skeleton.update();for(let i=0;i<m.geometry.attributes.position.count;i++){const v=new THREE.Vector3().fromBufferAttribute(m.geometry.attributes.position,i);m.boneTransform(i,v);b.expandByPoint(v.applyMatrix4(m.matrixWorld));}});return b.getSize(new THREE.Vector3()).toArray()})');console.log('Deformed board bounds:',bounds);assert(bounds.every(b=>b[1]>.35&&b[1]<.65));
 await ev('[...document.querySelectorAll("button")].find(b=>b.textContent.includes("Start placing"))?.click()');
 await shot('Board_four_commoners');
 await ev('window.__hero0=heroMeshes[0];window.__model0=heroMeshes[0].userData.commoner.model;window.__hero1=heroMeshes[1];heroMeshes[0].userData.walking=true');await delay(300);
 let states=await ev('HighhornCommoner.inspectBoard()');assert.equal(states.heroes[0].clip,'walk');assert.equal(states.heroes[1].clip,'idle');
 await ev('heroMeshes[0].userData.walking=false;renderPieces(G)');assert.equal(await ev('heroMeshes[0]!==window.__hero0&&heroMeshes[0].userData.commoner.model===window.__model0'),true);
 assert.equal(requests.filter(u=>u.endsWith('/commoner-board.glb')).length,1);
 await ev('G.heroes[0].wounded=1;renderPieces(G)');assert.equal(await ev('heroMeshes[0].rotation.z'),.5);
 await ev('G.heroes[0].wounded=false;renderPieces(G)');assert.equal(await ev('heroMeshes[0].rotation.z'),0);
 // Close-up to inspect low-detail clothes/feet in actual game lighting.
 await ev('(()=>{const h=heroMeshes[0];h.position.set(0,TOP,0);controls.target.copy(h.position).add(new THREE.Vector3(0,.23,0));camera.position.copy(h.position).add(new THREE.Vector3(.7,.8,1.2));controls.minDistance=.5;controls.update()})()');await delay(400);await shot('Board_commoner_closeup');
 await send('Network.setBlockedURLs',{urls:['*commoner-idle.glb*']});
 await send('Page.reload',{ignoreCache:true});await wait('typeof profile!=="undefined"');await ev('renderLobby("hero")');await wait('!!HighhornCommoner.inspect().error');
 assert.equal(await ev('document.querySelector(".commoner-retry").hidden'),false);assert.equal(await ev('!!document.querySelector("#csave")'),true);
 await send('Network.setBlockedURLs',{urls:[]});await ev('document.querySelector(".commoner-retry").click()');await wait('HighhornCommoner.inspect().ready');
 assert.deepEqual(errors,[]);
 const result={passed:true,initial,board,shared,bounds,boardRequests:1,legacyProfilePreserved:true,reducedMotionPassed:true,errors};fs.writeFileSync(path.join(out,'Browser_Validation.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));ws.close();
}
main().catch(e=>{console.error(e);process.exit(1)});
