// Exercise the actual local preview in an isolated headless Chrome profile.
// Uses Node's built-in WebSocket; no browser automation package is installed.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const out=path.resolve(__dirname,'../Exports/GameReady');
const delay=ms=>new Promise(r=>setTimeout(r,ms));
async function main(){
 const tabs=await(await fetch('http://127.0.0.1:9224/json')).json();
 const tab=tabs.find(t=>t.type==='page');assert(tab);
 const ws=new WebSocket(tab.webSocketDebuggerUrl);await new Promise((resolve,reject)=>{ws.onopen=resolve;ws.onerror=reject;});
 let id=0;const pending=new Map(),consoleErrors=[],failedRequests=[];
 ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id){const p=pending.get(m.id);if(p){pending.delete(m.id);m.error?p.reject(new Error(JSON.stringify(m.error))):p.resolve(m.result);}}else if(m.method==='Runtime.exceptionThrown')consoleErrors.push(m.params.exceptionDetails.text+' '+(m.params.exceptionDetails.exception?.description||''));else if(m.method==='Log.entryAdded'&&m.params.entry.level==='error')consoleErrors.push(m.params.entry.text);else if(m.method==='Network.loadingFailed')failedRequests.push(m.params.errorText);};
 function send(method,params={}){const key=++id;return new Promise((resolve,reject)=>{pending.set(key,{resolve,reject});ws.send(JSON.stringify({id:key,method,params}));});}
 async function evaluate(expression){const r=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw new Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result.value;}
 await send('Page.enable');await send('Runtime.enable');await send('Log.enable');await send('Network.enable');
 await send('Emulation.setDeviceMetricsOverride',{width:1200,height:900,deviceScaleFactor:1,mobile:false});
 await send('Page.navigate',{url:'http://127.0.0.1:8000/'});
 let ready=false;
 for(let i=0;i<90;i++){await delay(500);ready=await evaluate('!!window.highhornPreview?.inspect().ready');if(ready)break;}
 if(!ready){const failure=await evaluate('document.body.innerText');throw new Error('Preview not ready: '+failure+' '+consoleErrors.join(';'));}
 await evaluate('highhornPreview.setPaused(true)');
 const initial=await evaluate('highhornPreview.inspect()');assert.equal(initial.meshes.length,5);assert.deepEqual(initial.errors,[]);
 const motion={};
 for(const clip of ['walk','run']){
  await evaluate(`document.querySelector('[data-clip="${clip}"]').click()`);
  const sample=[];
  for(const f of [0,.25,.5,.75,.999])sample.push(await evaluate(`highhornPreview.setProgress(${f});highhornPreview.sampleVertices()`));
  const perMesh={};
  for(const name of Object.keys(sample[0])){
   let maximum=0;
   for(const pose of sample.slice(1))for(let i=0;i<pose[name].length;i++){
    const a=sample[0][name][i],b=pose[name][i];assert(b.every(Number.isFinite));maximum=Math.max(maximum,Math.hypot(...a.map((v,j)=>v-b[j])));
   }
   assert(maximum>.015,clip+' '+name+' did not animate');perMesh[name]=maximum;
  }
  motion[clip]=perMesh;
  await evaluate('highhornPreview.setProgress(.25);highhornPreview.setView("threequarter")');
  const screenshot=await send('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(out,`Browser_${clip}.png`),Buffer.from(screenshot.data,'base64'));
 }
 await evaluate('document.querySelector("[data-view=side]").click()');
 const side=await send('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(out,'Browser_run_side.png'),Buffer.from(side.data,'base64'));
 await evaluate('document.querySelector("[data-clip=rest]").click();highhornPreview.setView("threequarter")');assert.equal(await evaluate('highhornPreview.inspect().clip'),'rest');
 await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});await delay(300);
 const dimensions=await evaluate('({scroll:document.documentElement.scrollWidth,width:innerWidth,stage:document.querySelector("#stage").getBoundingClientRect().height})');assert(dimensions.scroll<=dimensions.width+1);assert(dimensions.stage>300);
 const mobile=await send('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(out,'Browser_mobile.png'),Buffer.from(mobile.data,'base64'));
 const restSamples=await evaluate('highhornPreview.sampleVertices()');
 for(const vertices of Object.values(restSamples))for(const p of vertices){assert(p.every(Number.isFinite));assert(Math.abs(p[0])<2&&p[1]>-.15&&p[1]<2.1&&Math.abs(p[2])<1.2,'Rest pose left character bounds');}
 // Check real-time playback, pause, speed selection and the scrub control.
 await evaluate('document.querySelector("[data-clip=walk]").click();document.querySelector("#play").click()');
 await delay(250);
 assert.equal(await evaluate('highhornPreview.inspect().paused'),false);
 assert((await evaluate('Number(document.querySelector("#progress").value)'))>0);
 await evaluate('document.querySelector("#play").click();document.querySelector("#speed").value="0.5";document.querySelector("#speed").dispatchEvent(new Event("change"));document.querySelector("#progress").value="0.5";document.querySelector("#progress").dispatchEvent(new Event("input"))');
 assert.equal(await evaluate('highhornPreview.inspect().paused'),true);
 assert.equal(await evaluate('Number(document.querySelector("#progress").value)'),.5);
 const final=await evaluate('highhornPreview.inspect()');assert.deepEqual(final.errors,[]);assert.deepEqual(consoleErrors,[]);assert.deepEqual(failedRequests,[]);
 // Ignore only the browser's automatic favicon request, recorded separately.
 const report={initial,motion,dimensions,consoleErrors,failedRequests,final,browser:'Chrome headless, software WebGL',url:'http://localhost:8000'};
 fs.writeFileSync(path.join(out,'Browser_Validation.json'),JSON.stringify(report,null,2));
 console.log(JSON.stringify(report));
 await send('Browser.close').catch(()=>{});ws.close();
}
main().catch(e=>{console.error(e);process.exitCode=1;setTimeout(()=>process.exit(1),100);});
