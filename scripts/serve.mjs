import {createServer} from 'node:http';
import {readFile,stat} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
const root=resolve('dist/site'),port=Number(process.env.PORT||4173);
const mime={'.js':'text/javascript','.json':'application/json','.html':'text/html','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp'};
createServer(async(req,res)=>{try{
 let path=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
 if (['/','/configurator-garduri'].includes(path)){res.writeHead(302,{Location:'/configurator-garduri/'+new URL(req.url,'http://localhost').search,'X-Robots-Tag':'noindex, nofollow'});res.end();return;}
 if (['/configurator-garduri/','/fence-configurator/'].includes(path)) path='/fence-configurator/index.html';
 path=path.replace(/^\/configurator-garduri\//,'/fence-configurator/');
 const file=resolve(root,'.'+path);
 if(!file.startsWith(root+sep)||(await stat(file)).isDirectory()) throw Error();
 res.writeHead(200,{'Content-Type':mime[extname(file)]||'application/octet-stream','X-Robots-Tag':'noindex, nofollow','Cache-Control':'no-store'});res.end(await readFile(file));
}catch{res.writeHead(404,{'Content-Type':'text/plain','X-Robots-Tag':'noindex'});res.end('Not found');}}).listen(port,'127.0.0.1',()=>console.log('Decorio preview http://127.0.0.1:'+port));
