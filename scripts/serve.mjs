import http from 'node:http';
import {readFile,stat} from 'node:fs/promises';
import {dirname,join,resolve,extname} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.jpg':'image/jpeg','.png':'image/png','.webp':'image/webp','.svg':'image/svg+xml','.mp4':'video/mp4','.woff2':'font/woff2','.heic':'image/heic','.json':'application/json','.txt':'text/plain; charset=utf-8'};
http.createServer(async(req,res)=>{
  const url=new URL(req.url,'http://127.0.0.1:4180');
  if(!url.pathname.startsWith('/lucky-album/')){res.writeHead(302,{Location:'/lucky-album/'});res.end();return;}
  const local=decodeURIComponent(url.pathname.slice('/lucky-album/'.length))||'index.html';
  const path=resolve(root,local);
  if(!path.startsWith(root+'/')||local.split('/').some(p=>p.startsWith('.'))){res.writeHead(404);res.end();return;}
  try{
    let bytes=await readFile(path),size=bytes.length;
    if(url.searchParams.get('text-scale')==='200'&&extname(path)==='.html')bytes=Buffer.from(bytes.toString().replace('</head>','<style>html{font-size:200%}</style></head>'));
    size=bytes.length;
    const range=/^bytes=(\d+)-(\d*)$/.exec(req.headers.range||'');
    const start=range?Number(range[1]):0,end=range&&range[2]?Math.min(Number(range[2]),size-1):size-1;
    if(start>end||start>=size){res.writeHead(416,{'Content-Range':`bytes */${size}`});res.end();return;}
    res.writeHead(range?206:200,{'Content-Type':types[extname(path)]||'application/octet-stream','Content-Length':range?end-start+1:size,'Cache-Control':'no-store','Accept-Ranges':'bytes',...(range?{'Content-Range':`bytes ${start}-${end}/${size}`}:{})});
    res.end(req.method==='HEAD'?undefined:range?bytes.subarray(start,end+1):bytes);
  }catch{res.writeHead(404);res.end('Not found');}
}).listen(4180,'127.0.0.1',()=>console.log('GitHub Pages preview: http://127.0.0.1:4180/lucky-album/'));
