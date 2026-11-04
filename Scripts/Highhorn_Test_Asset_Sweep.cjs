const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const out=path.resolve(__dirname,'../Exports/AssetSweep/2026-11-01'),delay=ms=>new Promise(r=>setTimeout(r,ms));
async function main(){
 const tabs=await(await fetch('http://127.0.0.1:9232/json',{signal:AbortSignal.timeout(10000)})).json();const tab=tabs.find(t=>t.type==='page');const ws=new WebSocket(tab.webSocketDebuggerUrl);await new Promise((r,j)=>{ws.onopen=r;ws.onerror=j;});
 let id=0;const pending=new Map(),errors=[];
 ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id){const p=pending.get(m.id);if(p){pending.delete(m.id);m.error?p.reject(Error(JSON.stringify(m.error))):p.resolve(m.result);}}else if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails.exception?.description||m.params.exceptionDetails.text);else if(m.method==='Runtime.consoleAPICalled'&&m.params.type==='error')errors.push(m.params.args.map(a=>a.value||a.description).join(' '));};
 function send(method,params={}){const key=++id;return new Promise((resolve,reject)=>{const timer=setTimeout(()=>{pending.delete(key);reject(Error('Timed out: '+method));},45000);pending.set(key,{resolve:r=>{clearTimeout(timer);resolve(r)},reject:e=>{clearTimeout(timer);reject(e)}});ws.send(JSON.stringify({id:key,method,params}));});}
 async function ev(expression){const r=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result.value;}
 async function wait(expression){const start=Date.now();while(Date.now()-start<60000){if(await ev(expression))return;await delay(250);}throw Error('Not ready: '+expression+' '+errors.join('\n'));}
 async function shot(name){const r=await send('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(out,name+'.png'),Buffer.from(r.data,'base64'));}
 await send('Page.enable');await send('Runtime.enable');await send('Network.enable');await send('Emulation.setDeviceMetricsOverride',{width:1280,height:1000,deviceScaleFactor:1,mobile:false});
 await send('Page.navigate',{url:'http://127.0.0.1:8012/Exports/AssetSweep/2026-11-01/TestGallery/'});await wait('window.highhornSweep?.inspect().ready');
 await ev('highhornSweep.setPaused(true)');const assets=await ev('highhornSweep.assets()');assert.equal(assets.length,14);const results=[];
 const metadata=JSON.parse(fs.readFileSync(path.join(out,'TestGallery/assets.json'),'utf8'));
 for(const asset of assets){
  await ev(`highhornSweep.load(${JSON.stringify(asset.id)})`);await wait(`highhornSweep.inspect().ready&&highhornSweep.inspect().id===${JSON.stringify(asset.id)}`);await ev('highhornSweep.setPaused(true)');
  const initial=await ev('highhornSweep.inspect()'),expected=metadata.find(m=>m.id===asset.id);assert.equal(initial.bones,expected.bones);assert.equal(initial.triangles,expected.triangles);assert(initial.height>.5&&initial.height<4);assert.equal(initial.error,'');
  const motion={};
  for(const clip of ['walk','run']){
   const samples=[];for(const progress of [0,.25,.5,.75,.999]){await ev(`highhornSweep.setClip('${clip}');highhornSweep.setProgress(${progress})`);samples.push(await ev('highhornSweep.sample()'));}
   let maximum=0;for(const pose of samples.slice(1))for(let i=0;i<pose.length;i++){assert(pose[i].every(Number.isFinite));maximum=Math.max(maximum,Math.hypot(...pose[i].map((v,j)=>v-samples[0][i][j])));}assert(maximum>.015&&maximum<initial.height*5);motion[clip]=maximum;
  }
  await ev('highhornSweep.setClip("walk");highhornSweep.setProgress(.25)');await shot('Browser_'+asset.id);
  const state=await ev('highhornSweep.inspect()');assert(state.geometryMemory<=5&&state.textureMemory<=16,'Resources accumulated across switches');results.push({id:asset.id,passed:true,bones:state.bones,triangles:state.triangles,height_m:state.height,motion,geometryMemory:state.geometryMemory,textureMemory:state.textureMemory});console.log('BROWSER PASSED',asset.id,JSON.stringify(results.at(-1)));
 }
 await ev('highhornSweep.setPaused(false);highhornSweep.setClip("walk")');await wait('highhornSweep.inspect().actionTime>0');
 await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});await delay(250);assert.equal(await ev('document.documentElement.scrollWidth<=innerWidth+1'),true);await shot('Browser_mobile');
 assert.deepEqual(errors,[]);const report={passed:true,assets:results,errors,scope:'Native glTF/PBR playback, sampled vertex movement, actual skinned bounds, resource disposal and mobile layout; not a full collision/production performance certification.'};fs.writeFileSync(path.join(out,'Browser_Validation.json'),JSON.stringify(report,null,2));console.log('ALL BROWSER CHECKS PASSED');ws.close();
}
main().catch(e=>{console.error(e);process.exit(1)});
