// Local game preview, independent of the outfit export server. No dependencies.
const http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.glb':'model/gltf-binary','.png':'image/png','.svg':'image/svg+xml','.json':'application/json'};
const server=http.createServer((req,res)=>{
 let pathname;try{pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);}catch{res.writeHead(400).end();return;}
 const file=path.resolve(root,'.'+(pathname==='/'?'/index.html':pathname));
 if(!file.startsWith(root+path.sep)||path.relative(root,file).split(/[\\/]/).some(p=>p.startsWith('.'))||!types[path.extname(file)]){res.writeHead(403).end();return;}
 fs.stat(file,(error,stat)=>{if(error||!stat.isFile()){res.writeHead(404).end('Not found');return;}res.writeHead(200,{'Content-Type':types[path.extname(file)],'Content-Length':stat.size,'Cache-Control':'no-cache'});fs.createReadStream(file).pipe(res);});
});
server.on('error',error=>{console.error(error.message);process.exitCode=1;});
server.listen(8001,'127.0.0.1',()=>console.log('Highhorn game: http://localhost:8001'));
