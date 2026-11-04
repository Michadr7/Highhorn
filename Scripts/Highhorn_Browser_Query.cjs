const fs=require('node:fs');
(async()=>{
 const tabs=await(await fetch('http://127.0.0.1:'+(process.env.HIGHHORN_DEBUG_PORT||9224)+'/json',{signal:AbortSignal.timeout(10000)})).json();const tab=tabs.find(t=>t.type==='page');
 const ws=new WebSocket(tab.webSocketDebuggerUrl);await new Promise(r=>ws.onopen=r);
 let id=0;const queue=new Map();ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id){queue.get(m.id)(m);queue.delete(m.id);}};
 const send=(method,params={})=>new Promise(r=>{const key=++id;queue.set(key,r);ws.send(JSON.stringify({id:key,method,params}));});
 if(process.argv[2]==='--close'){await send('Browser.close');ws.close();return;}
 const result=await send('Runtime.evaluate',{expression:process.argv[2],returnByValue:true,awaitPromise:true});console.log(JSON.stringify(result));
 if(process.argv[3]){const shot=await send('Page.captureScreenshot',{format:'png'});fs.writeFileSync(process.argv[3],Buffer.from(shot.result.data,'base64'));}
 ws.close();
})().catch(e=>{console.error(e);process.exit(1)});
