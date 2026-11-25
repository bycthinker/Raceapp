import './atelier-core.js';
import { readFile, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
export function catalogue(db) {
  db.exec('CREATE TABLE IF NOT EXISTS circuits(id TEXT PRIMARY KEY, name TEXT NOT NULL, design TEXT NOT NULL)');
  const find=db.prepare('SELECT design FROM circuits WHERE id=?');
  const all=db.prepare('SELECT design FROM circuits ORDER BY name COLLATE NOCASE,id');
  const upsert=db.prepare('INSERT INTO circuits VALUES(?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,design=excluded.design');
  return {
    list:()=>all.all().map(row=>JSON.parse(row.design)),
    get:id=>{const row=find.get(id);return row && JSON.parse(row.design);},
    importFile(file){
      const design=RaceAtelier.fromFile(file);
      design.id='officiel-'+design.id.slice('perso-'.length);
      upsert.run(design.id,design.name,JSON.stringify(design));
      return design;
    }
  };
}


export async function loadBundledCircuits(db, circuits, directory=new URL('./circuits/',import.meta.url)) {
  db.exec('CREATE TABLE IF NOT EXISTS bundled_circuits(file TEXT PRIMARY KEY, digest TEXT NOT NULL)');
  const installed=db.prepare('SELECT digest FROM bundled_circuits WHERE file=?');
  const remember=db.prepare('INSERT INTO bundled_circuits VALUES(?,?) ON CONFLICT(file) DO UPDATE SET digest=excluded.digest');
  let files;
  try { files=await readdir(directory); }
  catch (error) { if (error.code==='ENOENT') return; throw error; }
  for (const name of files.filter(n=>n.toLowerCase().endsWith('.json')).sort()) {
    try {
      const contents=await readFile(new URL(encodeURIComponent(name),directory),'utf8');
      const digest=createHash('sha256').update(contents).digest('hex');
      if (installed.get(name)?.digest===digest) continue;
      db.exec('BEGIN IMMEDIATE');
      try {
        circuits.importFile(JSON.parse(contents));
        remember.run(name,digest);
        db.exec('COMMIT');
      } catch (error) { db.exec('ROLLBACK'); throw error; }
    } catch(error) { console.error('Circuit non importé ('+name+') : '+error.message); }
  }
}
