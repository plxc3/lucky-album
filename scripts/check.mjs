import assert from 'node:assert/strict';
import {readFile,readdir,stat} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {dirname,join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {notes} from '../content.js';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
assert.equal(notes.length,54);
assert.equal(notes.filter(n=>n.video).length,30);
assert.equal(new Set(notes.map(n=>n.id)).size,54);
const files=['index.html','404.html','app.js','album.js','content.js','styles.css','album.css','pet.css','pet.js','character-rig.js'];
const references=new Set();
for(const file of files){
  const text=await readFile(join(root,file),'utf8');
  assert(!/chatgpt\.site|\/logout|\/login/.test(text),`Old hosting reference in ${file}`);
  for(const match of text.matchAll(/assets\/[A-Za-z0-9._-]+/g)) references.add(match[0]);
}
for(const note of notes) for(const field of ['photo','video','previewPhoto','originalPhoto']) if(note[field]) references.add(note[field]);
for(const name of references) assert((await stat(join(root,name))).size>0,`Missing or empty ${name}`);
const hashes=new Set();
for(const note of notes){
  const raw=await readFile(join(root,note.video||note.photo));
  const hash=createHash('sha256').update(raw).digest('hex');
  assert(!hashes.has(hash),`Duplicate independent record ${note.id}`);hashes.add(hash);
}
const manifest=JSON.parse(await readFile(join(root,'MEDIA_20261016.json'),'utf8'));
for(const item of manifest.media_files){
  const raw=await readFile(join(root,item.path));
  assert.equal(raw.length,item.bytes,`Size changed ${item.path}`);
  assert.equal(createHash('sha256').update(raw).digest('hex'),item.sha256,`Bytes changed ${item.path}`);
}
for(const name of await readdir(join(root,'assets'))) assert((await stat(join(root,'assets',name))).size<100*1024*1024,`GitHub file limit ${name}`);
console.log(`Verified 54 unique records (30 videos, 24 photos), ${references.size} referenced assets and ${manifest.media_files.length} byte-preserved files; no old hosting dependency.`);
