import assert from 'node:assert/strict';
import {readFile,readdir,stat} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {dirname,join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {notes} from '../content.js';
import {growthThemes,buildCollectionTimeline,findThemeGaps,buildIntakeSeries} from '../growth.js';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
assert.equal(notes.length,56);
assert.equal(notes.filter(n=>n.video).length,32);
assert.equal(new Set(notes.map(n=>n.id)).size,56);
const files=['index.html','404.html','app.js','album.js','content.js','growth.js','styles.css','album.css','pet.css','pet.js','character-rig.js'];
const references=new Set();
for(const file of files){
  const text=await readFile(join(root,file),'utf8');
  assert(!/chatgpt\.site|\/logout|\/login/.test(text),`Old hosting reference in ${file}`);
  for(const match of text.matchAll(/assets\/[A-Za-z0-9._-]+/g)) references.add(match[0]);
}
for(const note of notes){
  for(const field of ['photo','video','previewPhoto','originalPhoto','photo1x']) if(note[field]) references.add(note[field]);
  // Responsive previews are computed at render time, so the literal-source scan
  // cannot see them. Check every actual candidate before publishing the site.
  if(note.previewPhoto){
    assert(note.previewPhoto.endsWith('.webp'),`Unsupported responsive preview ${note.id}`);
    references.add(note.previewPhoto.replace(/\.webp$/, '-md.webp'));
  }
}
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
const additions=JSON.parse(await readFile(join(root,'MEDIA_20261020.json'),'utf8'));
assert.equal(additions.records,notes.length);
assert.equal(additions.videos,notes.filter(n=>n.video).length);
for(const item of additions.media_files){
  const raw=await readFile(join(root,item.path));
  assert.equal(raw.length,item.bytes,`Added asset size changed ${item.path}`);
  assert.equal(createHash('sha256').update(raw).digest('hex'),item.sha256,`Added asset changed ${item.path}`);
}
for(const name of await readdir(join(root,'assets'))) assert((await stat(join(root,'assets',name))).size<100*1024*1024,`GitHub file limit ${name}`);
// Every record remains reachable from its actual collection batch, even after
// new uploads; the curated themes must never point to a missing/shifted record.
const timeline=buildCollectionTimeline(notes);
assert.equal(timeline.flatMap(batch=>batch.items).length,notes.length);
assert.deepEqual(new Set(timeline.flatMap(batch=>batch.items.map(n=>n.id))),new Set(notes.map(n=>n.id)));
assert.equal(timeline.at(-1).total,notes.length);
let cumulative=0;
for(const batch of timeline){
  assert(batch.items.every(n=>n.date===batch.date));
  assert.equal(batch.videos+batch.photos,batch.items.length);
  assert.equal(batch.total,cumulative+=batch.items.length);
}
const themedIds=growthThemes.flatMap(theme=>theme.ids);
// The growth view is a reading of the whole album: a record left out of every
// theme would vanish from it without anyone noticing, so coverage is an
// invariant rather than a curation choice.
const gaps=findThemeGaps(notes);
assert.deepEqual(gaps.duplicates,[],'record placed in more than one growth theme');
assert.deepEqual(gaps.missing,[],'record absent from every growth theme');
assert.deepEqual(gaps.unknown,[],'growth theme points at a record that does not exist');
assert.equal(themedIds.length,notes.length);
assert(themedIds.some(id=>notes.find(n=>n.id===id).video&&notes.find(n=>n.id===id).date==='2026-10-16'));
// The intake chart must be derived, never hand-typed: same batches, same running
// totals, and the last point must equal the real record count.
const intake=buildIntakeSeries(notes);
assert.deepEqual(intake.points.map(p=>p.date),timeline.map(b=>b.date));
assert.deepEqual(intake.points.map(p=>p.total),timeline.map(b=>b.total));
assert.equal(intake.points.at(-1).total,notes.length);
assert.equal(intake.points.reduce((s,p)=>s+p.added,0),notes.length);
assert(intake.points.every(p=>p.x>=0&&p.x<=1&&p.y>0&&p.y<=1),'chart coordinates out of range');
const added=buildCollectionTimeline([...notes,{id:'future-record',date:'2026-10-21',photo:'future.jpg'}]);
assert.equal(added.at(-1).total,notes.length+1);
assert.equal(added.at(-1).items[0].id,'future-record');
// Prove the coverage gate actually bites: an unplaced record must be reported.
const unpicked=findThemeGaps([...notes,{id:'future-record',date:'2026-10-21',photo:'future.jpg'}]);
assert.deepEqual(unpicked.missing,['future-record']);
assert.deepEqual(findThemeGaps(notes).missing,[],'current album must stay fully covered');
// One module must be requested under exactly one URL: app.js importing
// content.js?v=…-5 while album.js imports …-3 silently loads two copies of the
// 54-record dataset and defeats the cache-busting the query exists for.
const versions=new Map();
for(const file of files){
  const text=await readFile(join(root,file),'utf8');
  for(const m of text.matchAll(/from '\.\/([\w.-]+)\?v=([\d-]+)'|href="([\w.-]+)\?v=([\d-]+)"|src="([\w.-]+)\?v=([\d-]+)"/g)){
    const target=m[1]||m[3]||m[5], token=m[2]||m[4]||m[6];
    if(!versions.has(target))versions.set(target,new Set());
    versions.get(target).add(token);
  }
}
for(const [target,tokens] of versions)
  assert.equal(tokens.size,1,`${target} is requested under ${[...tokens].join(' and ')} — duplicate module instances`);

console.log(`Verified 56 unique records (32 videos, 24 photos), ${references.size} referenced assets and ${manifest.media_files.length} byte-preserved baseline files and ${additions.media_files.length} verified new assets; no old hosting dependency.`);
console.log(`Growth: ${timeline.length} collection batches, ${themedIds.length} source-linked observations; all records reachable, future batch supported.`);
