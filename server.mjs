import { createServer } from 'node:http';
import { createReadStream, existsSync, mkdirSync, readFileSync, writeFileSync, renameSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';
import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('.', import.meta.url));
const dataDir = join(root, 'data');
const uploadDir = join(root, 'uploads');
const dataFile = join(dataDir, 'store.json');
const password = process.env.ADMIN_PASSWORD;
if (!password || password.length < 12) {
  console.error('Configure ADMIN_PASSWORD avec au moins 12 caractères avant de lancer le serveur.');
  process.exit(1);
}
mkdirSync(dataDir, { recursive: true });
mkdirSync(uploadDir, { recursive: true });
const defaults = JSON.parse(readFileSync(join(root, 'store.default.json'), 'utf8'));
if (!existsSync(dataFile)) writeFileSync(dataFile, JSON.stringify(defaults, null, 2));
const sessions = new Map();
const attempts = new Map();
const mime = { '.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.gif':'image/gif','.svg':'image/svg+xml' };
const safeEqual = (a,b) => { const x=scryptSync(a,'maison-miro-auth',32), y=scryptSync(b,'maison-miro-auth',32); return timingSafeEqual(x,y); };
function readBody(req, limit=8_000_000) { return new Promise((resolve,reject)=>{let size=0, chunks=[];req.on('data',c=>{size+=c.length;if(size>limit){reject(Object.assign(new Error('Fichier trop volumineux'),{status:413}));req.destroy();return}chunks.push(c)});req.on('end',()=>resolve(Buffer.concat(chunks)));req.on('error',reject)}); }
function json(res, status, value, headers={}) { res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store',...headers});res.end(JSON.stringify(value)); }
function currentSession(req) { const cookie=(req.headers.cookie||'').split(';').map(v=>v.trim()).find(v=>v.startsWith('miro_session='));const token=cookie?.slice('miro_session='.length);const expiry=token&&sessions.get(token);if(!expiry)return false;if(expiry<Date.now()){sessions.delete(token);return false}return true; }
function saveStore(value) { if(!value||!Array.isArray(value.products)) throw new Error('Contenu boutique invalide');const temp=`${dataFile}.tmp`;writeFileSync(temp,JSON.stringify(value,null,2));renameSync(temp,dataFile); }
const server=createServer(async(req,res)=>{
  try {
    const url=new URL(req.url,'http://localhost');
    if(req.method==='GET'&&url.pathname==='/api/store') return json(res,200,JSON.parse(readFileSync(dataFile,'utf8')));
    if(req.method==='GET'&&url.pathname==='/api/session') return json(res,200,{authenticated:Boolean(currentSession(req))});
    if(req.method==='POST'&&url.pathname==='/api/login') {
      const ip=req.socket.remoteAddress||'unknown', now=Date.now(), record=attempts.get(ip)||{count:0,until:0};
      if(record.until>now) return json(res,429,{error:'Trop d’essais. Réessayez dans quelques minutes.'});
      const body=JSON.parse((await readBody(req,10000)).toString());
      if(typeof body.password!=='string'||!safeEqual(body.password,password)){record.count++;if(record.count>=6){record.until=now+10*60*1000;record.count=0}attempts.set(ip,record);return json(res,401,{error:'Mot de passe incorrect.'})}
      attempts.delete(ip);const token=randomBytes(32).toString('hex');sessions.set(token,Date.now()+12*60*60*1000);
      for(const [key,expiry] of sessions)if(expiry<Date.now())sessions.delete(key);
      return json(res,200,{ok:true},{'Set-Cookie':`miro_session=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=43200${process.env.NODE_ENV==='production'?'; Secure':''}`});
    }
    if(req.method==='POST'&&url.pathname==='/api/logout'){const c=(req.headers.cookie||'').split(';').map(v=>v.trim()).find(v=>v.startsWith('miro_session='));if(c)sessions.delete(c.slice('miro_session='.length));return json(res,200,{ok:true},{'Set-Cookie':'miro_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0'});}
    if(url.pathname.startsWith('/api/admin/')&&!currentSession(req))return json(res,401,{error:'Connexion administrateur requise.'});
    if(req.method==='PUT'&&url.pathname==='/api/admin/store'){const value=JSON.parse((await readBody(req)).toString());saveStore(value);return json(res,200,{ok:true});}
    if(req.method==='POST'&&url.pathname==='/api/admin/upload'){
      const body=JSON.parse((await readBody(req,6_000_000)).toString());const match=/^data:image\/(png|jpeg|webp|gif);base64,([A-Za-z0-9+/=]+)$/.exec(body.data||'');if(!match)return json(res,400,{error:'Format image non accepté.'});const ext=match[1]==='jpeg'?'jpg':match[1];const bytes=Buffer.from(match[2],'base64');if(bytes.length>4_000_000)return json(res,413,{error:'Image trop volumineuse (4 Mo maximum).'});const name=`${randomBytes(16).toString('hex')}.${ext}`;writeFileSync(join(uploadDir,name),bytes,{flag:'wx'});return json(res,201,{url:`/uploads/${name}`});
    }
    if(url.pathname.startsWith('/api/'))return json(res,404,{error:'Route introuvable.'});
    let file=url.pathname==='/'?join(root,'index.html'):join(root,normalize(decodeURIComponent(url.pathname)).replace(/^([/\\]|\.\.(?:[/\\]|$))+/,''));
    if(!file.startsWith(root)||!existsSync(file)){res.writeHead(404);return res.end('Introuvable')}
    res.writeHead(200,{'Content-Type':mime[extname(file)]||'application/octet-stream','X-Content-Type-Options':'nosniff'});createReadStream(file).pipe(res);
  } catch(e) { if(!res.headersSent)json(res,e.status||500,{error:e.message||'Erreur serveur.'});else res.destroy(); }
});
const port=Number(process.env.PORT||3000);server.listen(port,'0.0.0.0',()=>console.log(`Boutique prête sur http://localhost:${port}`));
