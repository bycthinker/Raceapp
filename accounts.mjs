import { createHash, randomBytes, randomUUID, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const derive = promisify(scrypt);
const month = 30 * 86400;
const hash = value => createHash('sha256').update(value).digest('hex');
const dummySalt = randomBytes(16).toString('hex');
const response = (value,status=200,headers={}) => Response.json(value,{status, headers:{'Cache-Control':'no-store',...headers}});
const fail = (error,status) => response({error},status);
const attempts = new Map();
let jobs = 0;

function allow(key, maximum) {
  const now = Date.now();
  const window = attempts.get(key);
  if (window?.until > now) return ++window.count <= maximum;
  for (const [k,v] of attempts) if (v.until <= now) attempts.delete(k);
  if (attempts.size >= 20000) return false;
  attempts.set(key, {count:1, until:now + 15*60000});
  return true;
}
function cookieToken(request) {
  return /(?:^|;\s*)race_session=([a-f0-9]{64})(?:;|$)/.exec(request.headers.get('cookie') || '')?.[1];
}
function cookie(value,seconds,secure) {
  return 'race_session='+value+'; Path=/; HttpOnly; SameSite=Lax; Max-Age='+seconds+(secure?'; Secure':'');
}
export function accounts(db) {
  db.exec(`
    PRAGMA foreign_keys=ON;
    CREATE TABLE IF NOT EXISTS accounts(id TEXT PRIMARY KEY, handle TEXT UNIQUE NOT NULL, name TEXT NOT NULL, salt TEXT NOT NULL, verifier TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS sessions(digest TEXT PRIMARY KEY, owner TEXT NOT NULL REFERENCES accounts(id), expiry INTEGER NOT NULL);
    CREATE INDEX IF NOT EXISTS sessions_expiry ON sessions(expiry);
    CREATE TABLE IF NOT EXISTS history(owner TEXT NOT NULL REFERENCES accounts(id), race TEXT NOT NULL, mode TEXT NOT NULL, circuit TEXT NOT NULL, result TEXT NOT NULL, started INTEGER NOT NULL, PRIMARY KEY(owner,race));
    CREATE INDEX IF NOT EXISTS history_by_date ON history(owner,started DESC);
  `);
  const sessionQuery = db.prepare('SELECT a.id,a.name FROM sessions s JOIN accounts a ON a.id=s.owner WHERE s.digest=? AND s.expiry>?');
  const insertHistory = db.prepare(`INSERT INTO history VALUES(?,?,?,?,?,?)
    ON CONFLICT(owner,race) DO UPDATE SET result=excluded.result
    WHERE history.result='En cours' AND history.result!=excluded.result`);
  const getUser = request => {
    const token = cookieToken(request);
    return token ? sessionQuery.get(hash(token),Date.now()) || null : null;
  };
  const history = (owner,race,mode,circuit,result,started) => insertHistory.run(owner,race,mode,circuit,result,started);
  async function route(request,user,{address,secure}) {
    const path = new URL(request.url).pathname;
    if (path==='/api/account' && request.method==='GET') return response({user});
    if (path==='/api/history') {
      if (!user) return fail('Connecte-toi pour retrouver tes courses.',401);
      if (request.method==='GET') return response({races:db.prepare('SELECT race,mode,circuit,result,started FROM history WHERE owner=? ORDER BY started DESC,race').all(user.id)});
      if (request.method==='POST') {
        const v=await request.json();
        if (!v || v.owner!==user.id) return fail('Le profil actif a changé.',403);
        if (typeof v.race!=='string' || !/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(v.race) ||
            !['Solo','Contre l’IA','Même écran'].includes(v.mode) || !['En cours','Gagnée','Perdue','Égalité','Forfait'].includes(v.result) ||
            typeof v.circuit!=='string' || !v.circuit.trim() || v.circuit.length>40 || !Number.isSafeInteger(v.started) || v.started<=0)
          return fail('Résultat de course invalide.',400);
        history(user.id,'local-'+v.race,v.mode,v.circuit.trim(),v.result,Math.min(Date.now(),v.started));
        return response({ok:true});
      }
    }
    if (request.method!=='POST') return fail('Adresse inconnue.',404);
    const token = cookieToken(request);
    if (path==='/api/account/logout') {
      if (token) db.prepare('DELETE FROM sessions WHERE digest=?').run(hash(token));
      return response({user:null},200,{'Set-Cookie':cookie('',0,secure)});
    }
    if (!['/api/account/register','/api/account/login'].includes(path)) return fail('Adresse inconnue.',404);
    const data = await request.json();
    if (typeof data?.name!=='string' || typeof data?.password!=='string') return fail('Entre ton pseudo et ton mot de passe.',400);
    const name=data.name.normalize('NFKC').trim(), handle=name.toLocaleLowerCase('fr');
    const register=path.endsWith('/register');
    if (!/^[\p{L}\p{N}][\p{L}\p{N} ._’-]{1,23}$/u.test(name) || data.password.length>128 || !data.password || (register && data.password.length<10))
      return fail(register ? 'Utilise un pseudo de 2 à 24 caractères et un mot de passe de 10 à 128 caractères.' : 'Pseudo ou mot de passe incorrect.',400);
    if (jobs>=4 || !allow('ip:'+address,60) || !allow((register?'new:':'login:')+handle,12)) return fail('Trop de tentatives. Réessaie dans quelques minutes.',429);
    jobs++;
    try {
      const existing=db.prepare('SELECT * FROM accounts WHERE handle=?').get(handle);
      const salt=register ? randomBytes(16).toString('hex') : existing?.salt || dummySalt;
      const verifier=await derive(data.password,salt,64,{N:32768,r:8,p:3,maxmem:64*1024*1024});
      let id=existing?.id;
      if (register) {
        id=randomUUID();
        if (!db.prepare('INSERT OR IGNORE INTO accounts VALUES(?,?,?,?,?)').run(id,handle,name,salt,verifier.toString('hex')).changes)
          return fail('Ce pseudo est déjà utilisé.',409);
      } else if (!timingSafeEqual(verifier,existing ? Buffer.from(existing.verifier,'hex') : Buffer.alloc(64)) || !existing) {
        return fail('Pseudo ou mot de passe incorrect.',401);
      }
      const secret=randomBytes(32).toString('hex');
      db.prepare('DELETE FROM sessions WHERE expiry<=? OR digest=?').run(Date.now(),token ? hash(token) : '');
      db.prepare('INSERT INTO sessions VALUES(?,?,?)').run(hash(secret),id,Date.now()+month*1000);
      return response({user:{id,name:register ? name : existing.name}},register?201:200,{'Set-Cookie':cookie(secret,month,secure)});
    } finally { jobs--; }
  }
  return {getUser,route,history};
}
