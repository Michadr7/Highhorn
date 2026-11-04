'use strict';
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict'),{spawn}=require('node:child_process');
const root=path.resolve(__dirname,'..'),out=path.join(root,'Exports/CommonerOptimization/2026-11-03'),delay=ms=>new Promise(r=>setTimeout(r,ms));
async function main(){
 const server=http.createServer((req,res)=>{let file=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}if(fs.existsSync(file)&&fs.statSync(file).isDirectory())file=path.join(file,'index.html');if(!fs.existsSync(file)){res.writeHead(404).end();return;}const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.glb':'model/gltf-binary','.png':'image/png','.jpg':'image/jpeg'};res.setHeader('Content-Type',types[path.extname(file)]||'application/octet-stream');fs.createReadStream(file).pipe(res);});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const port=server.address().port;
 const chrome=spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',['--headless=new','--remote-debugging-port=9252',`--user-data-dir=${path.join(out,'ChromeProfile')}`,'--no-first-run','--no-default-browser-check','about:blank'],{windowsHide:true,stdio:'ignore'});
 let ws,id=0;const pending=new Map(),errors=[];
 function send(method,params={}){const key=++id;return new Promise((resolve,reject)=>{const timer=setTimeout(()=>{pending.delete(key);reject(Error('Timed out: '+method));},60000);pending.set(key,{resolve:v=>{clearTimeout(timer);resolve(v);},reject:e=>{clearTimeout(timer);reject(e);}});ws.send(JSON.stringify({id:key,method,params}));});}
 async function evaluate(expression){const r=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result.value;}
 async function wait(expression){for(let i=0;i<240;i++){if(await evaluate(expression))return;await delay(250);}throw Error('Not ready: '+expression+' '+errors.join('\n'));}
 async function shot(name){await evaluate('new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))');const r=await send('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(out,name+'.png'),Buffer.from(r.data,'base64'));}
 try{
  let tabs;for(let i=0;i<80;i++){try{tabs=await(await fetch('http://127.0.0.1:9252/json')).json();if(tabs.length)break;}catch{}await delay(100);}
  assert(tabs?.length,'Chrome debugging session did not start');ws=new WebSocket(tabs.find(t=>t.type==='page').webSocketDebuggerUrl);await new Promise((r,j)=>{ws.onopen=r;ws.onerror=j;});
  ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id){const p=pending.get(m.id);if(p){pending.delete(m.id);m.error?p.reject(Error(JSON.stringify(m.error))):p.resolve(m.result);}}else if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails.exception?.description||m.params.exceptionDetails.text);else if(m.method==='Runtime.consoleAPICalled'&&m.params.type==='error')errors.push(m.params.args.map(a=>a.value||a.description).join(' '));};
  await send('Page.enable');await send('Runtime.enable');await send('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});await send('Page.navigate',{url:`http://127.0.0.1:${port}/Exports/CommonerOptimization/2026-11-03/`});await wait('window.highhornLOD?.inspect().ready');
  const models=[];
  for(const gender of ['male','female'])for(const level of ['hero','board']){
   await evaluate(`highhornLOD.configure('${gender}','${level}')`);await evaluate('highhornLOD.setPaused(true)');const state=await evaluate('highhornLOD.inspect()');assert.equal(state.error,'');assert(state.panes.flat().every(e=>e.bones===24&&e.meshes===5&&e.toon));assert(state.panes[1][0].triangles<state.panes[0][0].triangles*.70);assert(state.panes.flat().every(e=>e.morphNormalMaterials.every(v=>v===false)));
   for(const clip of ['idle','walk','run']){await evaluate(`highhornLOD.setClip('${clip}');highhornLOD.setProgress(.375)`);const s=await evaluate('highhornLOD.inspect()');const morphs=s.panes[1][0].morphs;assert(Object.values(morphs).flat().every(Number.isFinite));assert.equal(Object.keys(morphs).length,2);if(clip==='run')assert(Object.values(morphs).flat().some(v=>v>.5));}
   await evaluate("highhornLOD.setClip('idle');highhornLOD.setProgress(.25);highhornLOD.view('full')");await shot(`${gender}_${level}_full`);
   await evaluate("highhornLOD.view('face')");await shot(`${gender}_${level}_face`);await evaluate("highhornLOD.view('back');highhornLOD.setClip('run');highhornLOD.setProgress(.375)");await shot(`${gender}_${level}_run_back`);
   if(level==='board'){await evaluate("highhornLOD.view('playing');highhornLOD.setClip('idle')");await shot(`${gender}_board_playing`);}models.push(state);
  }
  await evaluate("highhornLOD.configure('male','crowd')");const crowd=await evaluate('highhornLOD.inspect()');for(const pane of crowd.panes){assert.equal(pane.length,6);assert.deepEqual(pane.map(e=>e.identity),['male','female','male','female','male','female']);assert.equal(new Set(pane.flatMap(e=>e.skeletons)).size,30);}
  await evaluate("highhornLOD.setClip('walk');highhornLOD.setPaused(false)");await shot('Crowd');
  const sourceBenchmark=await evaluate('highhornLOD.measure(0)'),optimizedBenchmark=await evaluate('highhornLOD.measure(1)');assert(optimizedBenchmark.triangles<sourceBenchmark.triangles*.25);
  await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});assert(await evaluate('document.documentElement.scrollWidth<=innerWidth+1'));await shot('Mobile');
  assert.deepEqual(errors,[]);fs.writeFileSync(path.join(out,'Browser_Validation.json'),JSON.stringify({passed:true,models,crowd,sourceBenchmark,optimizedBenchmark,errors,scope:'Four source/LOD comparisons, compiled toon shaders, separate cloned skeletons for six alternating male/female identities, garment morph playback, camera views and mobile overflow. Sequential 150-frame headless benchmarks at 1440x1000 with 30 warmup frames; environment-specific observations, not production FPS certification. Temporary HTTP server closed after test.'},null,2));
  console.log('LOD BROWSER PASSED',JSON.stringify({sourceBenchmark,optimizedBenchmark}));
 }finally{if(ws){try{await send('Browser.close');}catch{}ws.close();}chrome.kill();await new Promise(r=>server.close(r));}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
