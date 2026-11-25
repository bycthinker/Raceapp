import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { DatabaseSync } from 'node:sqlite';
import { Readable } from 'node:stream';
import { api } from './api.mjs';
import { accounts } from './accounts.mjs';
import { catalogue, loadBundledCircuits } from './catalogue.mjs';
import { courseFor } from './game.mjs';

const db = new DatabaseSync(process.env.RACE_DATABASE || new URL('./race.sqlite',import.meta.url));
db.exec('CREATE TABLE IF NOT EXISTS rooms (code TEXT PRIMARY KEY, revision INTEGER NOT NULL, data TEXT NOT NULL)');
db.exec('PRAGMA busy_timeout=5000');
const profiles = accounts(db);
const circuits = catalogue(db);
await loadBundledCircuits(db,circuits);
const insert = db.prepare('INSERT OR IGNORE INTO rooms VALUES (?, ?, ?)');
const lookup = db.prepare('SELECT data FROM rooms WHERE code = ?');
const update = db.prepare('UPDATE rooms SET revision = ?, data = ? WHERE code = ? AND revision = ?');
const store = {
  insert: room => insert.run(room.code,room.revision,JSON.stringify(room)).changes === 1,
  get: code => JSON.parse(lookup.get(code)?.data ?? 'null'),
  official: id => circuits.get(id),
  update(room) {
    db.exec('BEGIN IMMEDIATE');
    try {
      const changed=update.run(room.revision,JSON.stringify(room),room.code,room.revision-1).changes===1;
      if (changed && room.raceId && room.started) {
        const name=room.design?.name || courseFor(room).name || 'Mainland';
        room.players.forEach((p,i)=>{
          if (!p.accountId) return;
          const result=p.forfeit?'Forfait':room.state!=='finished'?'En cours':
            !room.winners.includes(i)?'Perdue':room.winners.length>1?'Égalité':'Gagnée';
          profiles.history(p.accountId,'direct-'+room.raceId,'En direct',name,result,room.started);
        });
      }
      db.exec('COMMIT');
      return changed;
    } catch(error) { db.exec('ROLLBACK'); throw error; }
  },
};
const files = new Map([
  ['/',['index.html','text/html; charset=utf-8']],
  ['/tutorial',['tutorial.html','text/html; charset=utf-8']],
  ['/stats',['stats.html','text/html; charset=utf-8']],
  ['/profile.js',['profile.js','text/javascript']],
  ['/Raceapp-Createur-de-circuits.html',['Raceapp-Createur-de-circuits.html','text/html; charset=utf-8']],
  ['/compte',['compte.html','text/html; charset=utf-8']],
  ['/compte.js',['compte.js','text/javascript']],
  ['/ui.css',['ui.css','text/css']],
  ['/home.css',['home.css','text/css']],
  ['/mainland.svg',['mainland.svg','image/svg+xml']],
  ['/guide.css',['guide.css','text/css']],
  ['/stats.js',['stats.js','text/javascript']],
  ['/atelier',['atelier.html','text/html; charset=utf-8']],
  ['/atelier.js',['atelier.js','text/javascript']],
  ['/atelier-core.js',['atelier-core.js','text/javascript']],
  ['/online',['online.html','text/html; charset=utf-8']],
  ['/local.html',['local.html','text/html; charset=utf-8']],
  ['/app.mjs',['app.mjs','text/javascript; charset=utf-8']],
  ['/game.mjs',['game.mjs','text/javascript; charset=utf-8']],
]);

// Les liens du menu fonctionnent aussi avec les noms de fichiers du ZIP.
for (const [filename, type] of [...files.values()]) {
  if (filename.endsWith('.html')) files.set('/'+filename,[filename,type]);
}

createServer(async (incoming,outgoing) => {
  try {
    const url = new URL(incoming.url,'http://localhost');
    let response;
    if (url.pathname.startsWith('/api/')) {
      const init = { method:incoming.method, headers:incoming.headers };
      if (incoming.method === 'POST') {
        const origin=incoming.headers.origin;
        if (origin && !(URL.canParse(origin) && new URL(origin).host===incoming.headers.host)) {
          outgoing.writeHead(403).end(); return;
        }
        if (incoming.headers['content-type']?.split(';')[0].trim()!=='application/json') {
          outgoing.writeHead(415).end(); return;
        }
        const chunks = [];
        let size = 0;
        for await (const chunk of incoming) {
          size += chunk.length;
          if (size > 24576) break;
          chunks.push(chunk);
        }
        if (size > 24576) {
          outgoing.writeHead(413).end();
          return;
        }
        init.body = Buffer.concat(chunks);
      }
      const request=new Request(url,init);
      const user=profiles.getUser(request);
      if (url.pathname==='/api/circuits' && request.method==='GET') {
        response=Response.json({circuits:circuits.list()},{headers:{'Cache-Control':'no-store'}});
      } else if (url.pathname.startsWith('/api/account') || url.pathname==='/api/history') {
        const secure=incoming.socket.encrypted || process.env.NODE_ENV==='production' || process.env.RENDER==='true';
        try { response=await profiles.route(request,user,{address:incoming.socket.remoteAddress,secure}); }
        catch(error) {
          if (!(error instanceof SyntaxError)) throw error;
          response=Response.json({error:'Requête invalide.'},{status:400});
        }
      } else response=await api(request,store,user);
    } else if (files.has(url.pathname)) {
      const [name,type] = files.get(url.pathname==='/' && url.searchParams.has('salle') ? '/online' : url.pathname);
      const content = await readFile(new URL('./'+name,import.meta.url));
      response = new Response(content,{headers:{'Content-Type':type}});
    } else {
      response = new Response('Page introuvable.',{status:404});
    }
    outgoing.writeHead(response.status,Object.fromEntries(response.headers));
    if (response.body) Readable.fromWeb(response.body).pipe(outgoing);
    else outgoing.end();
  } catch (error) {
    console.error(error);
    if (!outgoing.headersSent) outgoing.writeHead(500);
    outgoing.end();
  }
}).listen(Number(process.env.PORT || 3000),process.env.HOST || '0.0.0.0',function () {
  const {address,port} = this.address();
  console.log('Course sur Quadrillage disponible sur http://'+address+':'+port);
});
