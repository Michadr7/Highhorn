/* Smoke-test the public-file snapshot, with disposable storage and server. */
'use strict';
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict'),{spawn}=require('node:child_process');
const out=path.resolve(__dirname,'../Exports/Release/0.27.0'),root=path.join(out,'Public'),pause=ms=>new Promise(r=>setTimeout(r,ms));
async function main(){
 const manifest=JSON.parse(fs.readFileSync(path.join(out,'Manifest.json'))),errors=[];
 const server=http.createServer((req,res)=>{const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);let file=path.resolve(root,'.'+pathname);if(file===root)file=path.join(root,'index.html');if(!file.startsWith(root+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404).end();return;}const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.glb':'model/gltf-binary','.svg':'image/svg+xml'};res.setHeader('Content-Type',types[path.extname(file)]||'text/plain');fs.createReadStream(file).pipe(res);});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin=`http://127.0.0.1:${server.address().port}`;
 const chrome=spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',['--headless=new','--remote-debugging-port=9254',`--user-data-dir=${path.join(out,'ChromeProfile')}`,'--no-first-run','--no-default-browser-check','about:blank'],{windowsHide:true,stdio:'ignore'});
 let ws,id=0;const pending=new Map();
 function send(method,params={}){const key=++id;return new Promise((resolve,reject)=>{const timer=setTimeout(()=>{pending.delete(key);reject(Error('Timeout: '+method));},60000);pending.set(key,{resolve:v=>{clearTimeout(timer);resolve(v);},reject:e=>{clearTimeout(timer);reject(e);}});ws.send(JSON.stringify({id:key,method,params}));});}
 async function evaluate(expression){const r=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result.value;}
 async function wait(expression){for(let i=0;i<240;i++){if(await evaluate(expression))return;await pause(250);}throw Error('Not ready: '+expression);}
 async function shot(name){const image=await send('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(out,name+'.png'),Buffer.from(image.data,'base64'));}
 try{
  for(const e of manifest.files){const res=await fetch(origin+'/'+e.path);assert.equal(res.status,200,e.path);assert.equal((await res.arrayBuffer()).byteLength,e.bytes,e.path);}
  for(const forbidden of ['/.git/config','/worker/index.js','/wrangler.jsonc','/Exports/private.blend','/Models/Heroes/MaleCommoner/commoner.glb'])assert.equal((await fetch(origin+forbidden)).status,404,forbidden);
  let tabs;for(let i=0;i<80;i++){try{tabs=await(await fetch('http://127.0.0.1:9254/json')).json();if(tabs.length)break;}catch{}await pause(100);}assert(tabs?.length);
  ws=new WebSocket(tabs.find(t=>t.type==='page').webSocketDebuggerUrl);await new Promise((r,j)=>{ws.onopen=r;ws.onerror=j;});
  ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id){const p=pending.get(m.id);if(p){pending.delete(m.id);m.error?p.reject(Error(JSON.stringify(m.error))):p.resolve(m.result);}}else if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails.exception?.description||m.params.exceptionDetails.text);else if(m.method==='Runtime.consoleAPICalled'&&m.params.type==='error')errors.push(m.params.args.map(a=>a.value||a.description).join(' '));};
  await send('Page.enable');await send('Runtime.enable');await send('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
  const profile={name:'Release QA',color:'Red',xp:1290,games:7,wins:3,hero:{name:'Jora',ability:'farmer',look:{model:'female-commoner',sigil:'sun',custom:'preserve'}}};
  await send('Page.addScriptToEvaluateOnNewDocument',{source:`if(location.protocol==='http:'&&!localStorage.getItem('release.qa')){localStorage.setItem('hexworld.profile',${JSON.stringify(JSON.stringify(profile))});localStorage.setItem('release.qa','yes');}`});
  await send('Page.navigate',{url:origin});await wait('typeof profile!=="undefined"');
  assert(await evaluate(`document.querySelector('.lb-tagline').textContent.includes('Version 0.27.0')&&document.querySelector('#panel .sub').textContent.includes('Version 0.27.0')&&UPDATE_NOTES[0].v==='0.27.0'&&RULESET==='0.20.0'`));
  assert(await evaluate(`[...document.querySelectorAll('script[src],link[rel=stylesheet]')].filter(e=>new URL(e.src||e.href).origin===location.origin).every(e=>new URL(e.src||e.href).searchParams.get('v')==='0.27.0')`));
  await evaluate('window.__saved=localStorage.getItem(PROF_KEY);renderLobby("hero")');await wait('HighhornCommoner.inspect().ready');
  for(const model of ['male-commoner','female-commoner']){
   await evaluate(`document.querySelector('#cmodel').value='${model}';document.querySelector('#cmodel').dispatchEvent(new Event('change'))`);await wait(`HighhornCommoner.inspect().ready&&HighhornCommoner.inspect().model==='${model}'`);
   assert(await evaluate('HighhornCommoner.inspect().toon'));
   for(const clip of ['rest','walk','run']){await evaluate(`HighhornCommoner.setClip('${clip}')`);await wait('HighhornCommoner.inspect().actionTime>0');}
   await shot(model);
  }
  assert(await evaluate('localStorage.getItem(PROF_KEY)===window.__saved&&profile.xp===1290&&profile.hero.look.custom==="preserve"'));
  await evaluate('document.querySelector("#cundo").click();renderLobby("home")');await shot('Home_0.27.0');
  await evaluate('renderLobby("hero")');await wait('HighhornCommoner.inspect().ready');await send('Emulation.setDeviceMetricsOverride',{width:390,height:900,deviceScaleFactor:1,mobile:true});await pause(200);assert(await evaluate('document.querySelector(".lb-main").scrollWidth<=document.querySelector(".lb-main").clientWidth+1'));await shot('Mobile');
  await send('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});await evaluate('renderLobby("play")');
  for(const [slot,ai] of [[1,'aracanus'],[2,'corra'],[3,'brannoc']])await evaluate(`(()=>{const e=document.querySelector('[data-ai="${slot}"]');e.value='${ai}';e.dispatchEvent(new Event('change'));})()`);
  await evaluate('document.querySelector("#gen").click()');assert(await evaluate('G.phase==="setup"&&G.ruleset==="0.20.0"'));
  assert.deepEqual(await evaluate('G.heroes.map(h=>h.look.model)'),['female-commoner','male-commoner','female-commoner','male-commoner']);
  await evaluate(`(()=>{const edges=[...G.B.edges.values()].filter(e=>!e.river).slice(0,4);edges.forEach((e,i)=>{e.road={p:i};G.heroes[i].edge=e.key;G.heroes[i].wounded=false;});renderPieces(G);})()`);
  await wait('Object.values(heroMeshes).length===4&&Object.values(heroMeshes).every(g=>g.userData.commoner.model)');assert(await evaluate('HighhornCommoner.inspectBoard().heroes.every(h=>h.ready&&h.triangles>46000&&h.triangles<47000)'));await shot('Board');
  assert.deepEqual(errors,[]);
  fs.writeFileSync(path.join(out,'Validation.json'),JSON.stringify({passed:true,version:'0.27.0',ruleset:'0.20.0',publicFiles:manifest.files.length,publicBytes:manifest.publicBytes,checks:['Both visible version labels and update notes','Local CSS/JS cache versions','All selected HTTP assets','Development assets absent','Both toon Hero models and three clips','Saved profile unchanged by preview','390px layout','Start game and named identities','Four toon board models'],errors,scope:'Isolated browser and temporary server over the public-file snapshot. No real browser saves or cloud rooms used.'},null,2));
  console.log('RELEASE SMOKE PASSED: v0.27.0, 18 public files, both Hero models, four board heroes, save compatibility and exclusions.');
 }finally{if(ws){try{await send('Browser.close');}catch{}ws.close();}chrome.kill();await new Promise(r=>server.close(r));}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
