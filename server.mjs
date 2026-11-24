import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { DatabaseSync } from 'node:sqlite';
import { Readable } from 'node:stream';
import { api } from './api.mjs';

const db = new DatabaseSync(process.env.RACE_DATABASE || new URL('./race.sqlite',import.meta.url));
db.exec('CREATE TABLE IF NOT EXISTS rooms (code TEXT PRIMARY KEY, revision INTEGER NOT NULL, data TEXT NOT NULL)');
const insert = db.prepare('INSERT OR IGNORE INTO rooms VALUES (?, ?, ?)');
const lookup = db.prepare('SELECT data FROM rooms WHERE code = ?');
const update = db.prepare('UPDATE rooms SET revision = ?, data = ? WHERE code = ? AND revision = ?');
const store = {
  insert: room => insert.run(room.code,room.revision,JSON.stringify(room)).changes === 1,
  get: code => JSON.parse(lookup.get(code)?.data ?? 'null'),
  update: room => update.run(room.revision,JSON.stringify(room),room.code,room.revision-1).changes === 1,
};
const files = new Map([
  ['/',['index.html','text/html; charset=utf-8']],
  ['/tutorial',['tutorial.html','text/html; charset=utf-8']],
  ['/stats',['stats.html','text/html; charset=utf-8']],
  ['/guide.css',['guide.css','text/css']],
  ['/stats.js',['stats.js','text/javascript']],
  ['/online',['online.html','text/html; charset=utf-8']],
  ['/local.html',['local.html','text/html; charset=utf-8']],
  ['/app.mjs',['app.mjs','text/javascript; charset=utf-8']],
  ['/game.mjs',['game.mjs','text/javascript; charset=utf-8']],
]);

createServer(async (incoming,outgoing) => {
  try {
    const url = new URL(incoming.url,'http://localhost');
    let response;
    if (url.pathname.startsWith('/api/')) {
      const init = { method:incoming.method, headers:incoming.headers };
      if (incoming.method === 'POST') {
        const chunks = [];
        let size = 0;
        for await (const chunk of incoming) {
          size += chunk.length;
          if (size > 4096) break;
          chunks.push(chunk);
        }
        if (size > 4096) {
          outgoing.writeHead(413).end();
          return;
        }
        init.body = Buffer.concat(chunks);
      }
      response = await api(new Request(url,init),store);
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
