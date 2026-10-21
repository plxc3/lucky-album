import assert from 'node:assert/strict';
import {readFile,readdir,stat} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {dirname,join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {validateMotion} from '../live2d/model-checks.js';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const base=join(root,'live2d');
const manifest=JSON.parse(await readFile(join(base,'distribution.json'),'utf8'));
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
for(const file of manifest.files){
 assert(!file.path.startsWith('/')&&!file.path.split('/').includes('..'));
 const bytes=await readFile(join(base,file.path));
 assert.equal(bytes.length,file.bytes,file.path);
 assert.equal(sha(bytes),file.sha256,file.path);
}
assert.equal(sha(await readFile(join(base,'sdk/core.js'))),'8741f739779b5d5210872bd3d7d99f0f1e56e6c87409e7d26d6bb4b80aa1ef47');
const framework=await readFile(join(base,'sdk/framework.js'),'utf8');
assert(framework.startsWith('/**\n * Copyright(c) Live2D Inc. All rights reserved.'));
assert(framework.slice(0,320).includes('live2d-open-software-license-agreement_en.html'));
assert((await stat(join(root,'licenses/live2d/Framework-LICENSE.md'))).size>0);
const expectedGroups=['Idle','Touch','Play','Greet','Curious','DoubleResponse','Quiet','Settle'];
for(const kind of ['cat','girl']){
 const dir=join(base,'models',kind,...(kind==='girl'?['v012']:[]));
 const model=JSON.parse(await readFile(join(dir,'model3.json'),'utf8'));
 const refs=model.FileReferences;
 assert.deepEqual(Object.keys(refs.Motions),expectedGroups);
 for(const file of [refs.Moc,refs.DisplayInfo,...refs.Textures])assert((await stat(join(dir,file))).size>0);
 const ids=kind==='cat'?['ParamLuckyEar','ParamLuckyTail','ParamBreath','ParamLuckyResponse']:['ParamBreath','ParamLuckyResponse','ParamLuckyEar'];
 const bounds=new Map(ids.map(id=>[id,id==='ParamLuckyEar'||id==='ParamLuckyTail'?[-1,1]:[0,1]]));
 for(const [group,entries] of Object.entries(refs.Motions)){
  assert.equal(entries.length,1);
  const motion=JSON.parse(await readFile(join(dir,entries[0].File),'utf8'));
  validateMotion(motion,ids,bounds);
  assert.equal(motion.Meta.Loop,group==='Idle',`${kind}/${group}`);
 }
}
const html=await readFile(join(base,'index.html'),'utf8');
const runtime=await readFile(join(base,'runtime.js'),'utf8');
const player=await readFile(join(base,'player.js'),'utf8');
assert(!/runtime-status|save-playback-report|\/Users\/|\/workspace\//.test(player),'Private backend/source reference in shared player');
assert(player.includes('export async function createLuckyPlayer'),'Missing shared player entry');
const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);
assert.equal(new Set(ids).size,ids.length);
for(const m of runtime.matchAll(/\$\('([^']+)'\)/g))assert(ids.includes(m[1]),`Runtime references missing #${m[1]}`);
assert.deepEqual([...html.matchAll(/data-motion-group="([^"]+)"/g)].map(m=>m[1]),expectedGroups);
assert(!/runtime-status|save-playback-report|\/models\/|\/sdk\/|playback-checks|\/Users\/|\/workspace\//.test(runtime));
assert(!/data-motion="/.test(runtime),'Old action selector');
for(const path of ['style.css','runtime.js','licenses.html','../assets/lucky-cozy-idle-small.png','../assets/lucky-human-portrait-display.webp'])assert((await stat(resolve(base,path))).size>0);
const forbidden=/\.(?:cmo3|psd|psb|jar|kt|ts|py|zip|dmg|pkg|exe|key|pem)$|^(?:consent|publication).*\.json$/i;
async function walk(dir){for(const entry of await readdir(dir,{withFileTypes:true})){assert(!forbidden.test(entry.name),`Private source in public tree: ${entry.name}`);if(entry.isDirectory())await walk(join(dir,entry.name));}}
await walk(base);
console.log(`Live2D: ${manifest.files.length} pinned runtime/model assets, original Core bytes, notices, 16 motion groups and public subpath graph verified. No private model source or local-only backend.`);
