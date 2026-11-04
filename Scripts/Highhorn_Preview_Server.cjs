// Local-only static server for the isolated export preview. No dependencies.
const http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'../Exports/GameReady');
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.glb':'model/gltf-binary','.png':'image/png','.json':'application/json'};
const server=http.createServer((req,res)=>{
 let file;try{file=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));}catch{res.writeHead(400).end();return;}
 if(file!==root&&!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}
 if(file===root)file=path.join(root,'index.html');
 fs.stat(file,(err,stat)=>{if(err||!stat.isFile()){res.writeHead(404).end('Not found');return;}res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream','Content-Length':stat.size,'Cache-Control':'no-cache'});fs.createReadStream(file).pipe(res);});
});
server.on('error',error=>{console.error(error.message);process.exitCode=1;});
server.listen(8000,'127.0.0.1',()=>console.log('Highhorn export preview: http://localhost:8000'));
