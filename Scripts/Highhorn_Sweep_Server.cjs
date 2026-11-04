// Separate asset-review server. The working game remains closed and unchanged.
const http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),home='/Exports/AssetSweep/2026-11-01/TestGallery/index.html';
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.glb':'model/gltf-binary','.png':'image/png','.webp':'image/webp','.md':'text/plain; charset=utf-8'};
http.createServer((req,res)=>{
 let pathname;try{pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);}catch{return res.writeHead(400).end();}
 if(pathname==='/'){res.writeHead(302,{Location:home});return res.end();}
 if(pathname.endsWith('/'))pathname+='index.html';
 const file=path.resolve(root,'.'+pathname),relative=path.relative(root,file);
 if(!file.startsWith(root+path.sep)||relative.split(/[\\/]/).some(p=>p.startsWith('.'))||!types[path.extname(file)])return res.writeHead(403).end();
 fs.stat(file,(err,stat)=>{if(err||!stat.isFile())return res.writeHead(404).end();res.writeHead(200,{'Content-Type':types[path.extname(file)],'Content-Length':stat.size,'Cache-Control':'no-cache'});fs.createReadStream(file).pipe(res);});
}).listen(8012,'127.0.0.1',()=>console.log('Highhorn asset testing: http://localhost:8012'));
