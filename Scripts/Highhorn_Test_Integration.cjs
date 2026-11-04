/* Integration checks against the actual game, in a separate Chrome profile. */
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const out=path.resolve(__dirname,'../Exports/HeroCreatorIntegration');
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function main(){
 const tabs=await(await fetch('http://127.0.0.1:9224/json')).json();const tab=tabs.find(t=>t.type==='page');assert(tab);
 const ws=new WebSocket(tab.webSocketDebuggerUrl);await new Promise((r,j)=>{ws.onopen=r;ws.onerror=j;});
 let id=0;const pending=new Map(),errors=[],requests=[],warnings=[];
 ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id){const p=pending.get(m.id);if(p){pending.delete(m.id);m.error?p.reject(new Error(JSON.stringify(m.error))):p.resolve(m.result);}}else if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails.exception?.description||m.params.exceptionDetails.text);else if(m.method==='Network.requestWillBeSent')requests.push(m.params.request.url);else if(m.method==='Log.entryAdded'&&m.params.entry.level==='error')warnings.push(m.params.entry.text);};
 function send(method,params={}){const key=++id;return new Promise((resolve,reject)=>{pending.set(key,{resolve,reject});ws.send(JSON.stringify({id:key,method,params}));});}
 async function evaluate(expression){const r=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result.value;}
 async function wait(expression,timeout=45000){const start=Date.now();while(Date.now()-start<timeout){if(await evaluate(expression))return;await delay(300);}throw Error('Timed out: '+expression+'\n'+await evaluate('document.body.innerText.slice(0,2000)'));}
 async function shot(name){const r=await send('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(out,name+'.png'),Buffer.from(r.data,'base64'));}
 await send('Page.enable');await send('Runtime.enable');await send('Network.enable');await send('Log.enable');await send('Network.setCacheDisabled',{cacheDisabled:true});
 await send('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
 await send('Page.navigate',{url:'http://127.0.0.1:8001/'});await wait('document.querySelector("#lobbyScr") && !document.querySelector("#lobbyScr").hidden');
 assert.equal(requests.filter(u=>u.endsWith('/commoner.glb')).length,0,'Model loaded before Hero tab');
 const previousProfile=await evaluate('JSON.stringify(profile)');
 await evaluate('document.querySelector("#lbNav [data-sec=hero]").click()');
 await evaluate('if(document.querySelector("#cmodel").value!=="male-commoner"){document.querySelector("#cmodel").value="male-commoner";document.querySelector("#cmodel").dispatchEvent(new Event("change"));}');
 await wait('HighhornCommoner.inspect().ready');
 assert.equal(await evaluate('document.querySelector("#cmodel").value'),'male-commoner');
 assert.equal(await evaluate('document.querySelector(".legacy-appearance").hidden'),true);
 const initial=await evaluate('HighhornCommoner.inspect()');assert.equal(initial.meshes,5);assert(initial.clips.includes('walk')&&initial.clips.includes('run'));
 // Produce a real model portrait used by profile/lobby cards, without loading
 // the 40 MB mesh on the home screen in later sessions.
 const portrait=await evaluate('HighhornCommoner.capturePortrait()');assert(portrait?.startsWith('data:image/png;base64,'));
 fs.writeFileSync(path.resolve(__dirname,'../Models/Heroes/MaleCommoner/portrait.png'),Buffer.from(portrait.split(',')[1],'base64'));
 await delay(500);await shot('Creator_desktop');
 for(const clip of ['walk','run']){
  await evaluate(`document.querySelector('[data-commoner-clip="${clip}"]').click()`);await delay(450);
  const state=await evaluate('HighhornCommoner.inspect()');assert.equal(state.clip,clip);assert(state.actionTime>0);await shot('Creator_'+clip);
 }
 await evaluate('window.__qaCanvas=document.querySelector(".commoner-viewport canvas");document.querySelector("[data-ab2=merchant]").click()');
 assert.equal(await evaluate('window.__qaCanvas===document.querySelector(".commoner-viewport canvas")'),true);
 await evaluate('document.querySelector("[data-sg=star]").click()');
 assert.equal(requests.filter(u=>u.endsWith('/commoner.glb')).length,1,'Repeated draft update reloaded GLB');
 await evaluate('document.querySelector("#cname").value="Commoner QA";document.querySelector("#cname").dispatchEvent(new Event("input"));document.querySelector("#csave").click()');
 let saved=await evaluate('JSON.parse(localStorage.getItem("hexworld.profile"))');
 assert.equal(saved.hero.name,'Commoner QA');assert.equal(saved.hero.look.model,'male-commoner');assert.equal(saved.hero.ability,'merchant');assert.equal(saved.hero.look.sigil,'star');
 assert.equal(saved.xp,JSON.parse(previousProfile).xp);
 assert.equal(await evaluate('HighhornCommoner.inspect().active'),false);
 const inactiveFrames=await evaluate('HighhornCommoner.inspect().frames');await delay(350);assert.equal(await evaluate('HighhornCommoner.inspect().frames'),inactiveFrames);
 await evaluate('document.querySelector("#lbNav [data-sec=hero]").click();document.querySelector("#cname").value="Discard me";document.querySelector("#cname").dispatchEvent(new Event("input"));document.querySelector("#cundo").click()');
 assert.equal(await evaluate('document.querySelector("#cname").value'),'Commoner QA');
 await evaluate('document.querySelector("#cmodel").value="prototype";document.querySelector("#cmodel").dispatchEvent(new Event("change"))');
 assert.equal(await evaluate('document.querySelector(".legacy-appearance").hidden'),false);assert.equal(await evaluate('!!document.querySelector("#hero3d")'),true);assert.equal(await evaluate('HighhornCommoner.inspect().active'),false);
 await shot('Creator_prototype');
 await evaluate('document.querySelector("#cmodel").value="male-commoner";document.querySelector("#cmodel").dispatchEvent(new Event("change"))');
 assert.equal(await evaluate('window.__qaCanvas===document.querySelector(".commoner-viewport canvas")'),true);
 for(let n=0;n<3;n++)await evaluate('document.querySelector("#lbNav [data-sec=home]").click();document.querySelector("#lbNav [data-sec=hero]").click()');
 assert.equal(requests.filter(u=>u.endsWith('/commoner.glb')).length,1);
 const performanceSample=await evaluate('HighhornCommoner.inspect()');
 // Existing board game continues to start with the saved hero and its ability.
 await evaluate('document.querySelector("#lbNav [data-sec=play]").click();document.querySelector("#gen").click()');
 await wait('!!G && G.phase==="setup"');assert.equal(await evaluate('HighhornCommoner.inspect().active'),false);
 const game=await evaluate('({phase:G.phase,players:G.players.length,hero:G.heroes[G.you].name,model:G.heroes[G.you].look.model,boardTriangles:renderer.info.render.triangles})');assert.equal(game.hero,'Commoner QA');assert.equal(game.model,'male-commoner');
 await send('Page.reload',{ignoreCache:true});await wait('document.querySelector("#lobbyScr") && !document.querySelector("#lobbyScr").hidden');
 assert.equal(await evaluate('profile.hero.look.model'),'male-commoner');
 const requestsBeforeReopen=requests.filter(u=>u.endsWith('/commoner.glb')).length;
 await delay(200);assert.equal(requests.filter(u=>u.endsWith('/commoner.glb')).length,requestsBeforeReopen);
 await evaluate('document.querySelector("#lbNav [data-sec=hero]").click()');await wait('HighhornCommoner.inspect().ready');
 await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
 await evaluate('document.querySelector("#lobbyScr").scrollTop=0');await delay(350);
 const mobile=await evaluate('(()=>{const r=document.querySelector(".commoner-viewport").getBoundingClientRect();return {left:r.left,right:r.right,width:innerWidth,height:r.height,scrollWidth:document.documentElement.scrollWidth};})()');
 assert(mobile.left>=0&&mobile.right<=mobile.width+1&&mobile.height>250);await shot('Creator_mobile');
 // Verify reduced motion starts with a still rest preview on a fresh document.
 await send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
 await send('Page.reload',{ignoreCache:true});await wait('document.querySelector("#lobbyScr") && !document.querySelector("#lobbyScr").hidden');
 await evaluate('document.querySelector("#lbNav [data-sec=hero]").click()');await wait('HighhornCommoner.inspect().ready');
 const reduced=await evaluate('HighhornCommoner.inspect()');assert.equal(reduced.clip,'rest');assert.equal(reduced.autoRotate,false);
 assert.deepEqual(errors,[]);assert.deepEqual(warnings,[]);
 // A missing/blocked asset must leave the form usable and retry successfully.
 const warningStart=warnings.length;
 await send('Network.setBlockedURLs',{urls:['*Models/Heroes/MaleCommoner/commoner.glb*']});
 await send('Page.reload',{ignoreCache:true});await wait('document.querySelector("#lobbyScr") && !document.querySelector("#lobbyScr").hidden');
 await evaluate('document.querySelector("#lbNav [data-sec=hero]").click()');
 await wait('!!HighhornCommoner.inspect().error');
 assert.equal(await evaluate('document.querySelector(".commoner-retry").hidden'),false);
 assert.equal(await evaluate('document.querySelector("#csave").disabled'),false);
 await send('Network.setBlockedURLs',{urls:[]});
 await evaluate('document.querySelector(".commoner-retry").click()');await wait('HighhornCommoner.inspect().ready');
 assert.equal(await evaluate('HighhornCommoner.inspect().error'),'');
 const expectedFailureWarnings=warnings.splice(warningStart);
 assert(expectedFailureWarnings.every(w=>w.includes('ERR_BLOCKED_BY_CLIENT')),JSON.stringify(expectedFailureWarnings));
 // Saving the original prototype must persist as well, without forcing a mesh
 // load when its creator is reopened after navigation/reload.
 await evaluate('document.querySelector("#cmodel").value="prototype";document.querySelector("#cmodel").dispatchEvent(new Event("change"));document.querySelector("#csave").click()');
 await send('Page.reload',{ignoreCache:true});await wait('document.querySelector("#lobbyScr") && !document.querySelector("#lobbyScr").hidden');
 await evaluate('document.querySelector("#lbNav [data-sec=hero]").click()');
 assert.equal(await evaluate('document.querySelector("#cmodel").value'),'prototype');
 assert.equal(await evaluate('HighhornCommoner.inspect().ready'),false);
 assert.deepEqual(errors,[]);assert.deepEqual(warnings,[]);
 const report={checks:'lazy load; clips; one renderer/model across draft changes and navigation; save/discard; prototype persistence; game start; reload; mobile; reduced motion; failed-load retry',initial,performanceSample,game,mobile,reduced,errors,warnings,expectedFailureWarnings,browser:'Headless Chrome with software WebGL; timings are not user hardware benchmarks'};
 fs.writeFileSync(path.join(out,'Integration_Validation.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
 await send('Browser.close').catch(()=>{});ws.close();
}
main().catch(error=>{console.error(error);process.exitCode=1;setTimeout(()=>process.exit(1),100);});
