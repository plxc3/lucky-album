import {validateMotion,validateParameters} from './model-checks.js';
import {createMotionPolicy} from './motion-policy.js';

const $=id=>document.getElementById(id);
const ui={stage:$('stage'),character:$('character'),reference:$('reference'),host:$('canvas-host'),
  form:$('form-label'),name:$('model-name'),prototype:$('prototype-label'),badge:$('runtime-badge'),
  message:$('runtime-message'),motion:$('motion-status'),pause:$('pause')};
const localUrl=path=>new URL(path,import.meta.url);
const forms={
  cat:{name:'Lucky 小猫',reference:localUrl('../assets/lucky-cozy-idle-small.png').href},
  girl:{name:'Lucky 猫耳女孩',reference:localUrl('../assets/lucky-human-portrait-display.webp').href}
};
const motionLabels={Idle:'自然待机',Touch:'摸摸',Play:'逗玩',Greet:'打招呼',Curious:'好奇回应',DoubleResponse:'两次回应',Quiet:'安静陪伴',Settle:'回到中性'};
const buttons=[...document.querySelectorAll('[data-motion-group]')];
const reduced=matchMedia('(prefers-reduced-motion: reduce)');
let active=new URL(location.href).searchParams.get('form')==='girl'?'girl':'cat';
let engine=null,busy=false,paused=false,manuallyPaused=false;
let press=null,suppressPointerClick=false,suppressClickUntil=0;

const say=text=>{ui.message.textContent=text;};
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const smooth=t=>t*t*(3-2*t);
async function checkedFetch(url){
  const response=await fetch(url);
  if(!response.ok)throw Error('A required character file could not be loaded');
  return response;
}
async function loadImage(url){const image=new Image();image.src=url;await image.decode();return image;}
function showForm(kind){
  const next=kind==='cat'?'girl':'cat';
  ui.form.textContent=forms[kind].name;
  ui.name.textContent=forms[kind].name;
  ui.prototype.textContent='眨眼与独立手势仍在制作';
  ui.character.setAttribute('aria-label',`${forms[kind].name}，轻点切换为${forms[next].name}，长按摸摸`);
  ui.reference.src=forms[kind].reference;
  ui.reference.alt=forms[kind].name+'的原选图画';
}
function pausePreference(){
  paused=document.hidden||reduced.matches||manuallyPaused;
  engine?.setPaused(paused);
  for(const button of buttons)button.disabled=!engine||engine.stopped||busy||paused;
  ui.pause.disabled=!engine||engine.stopped||busy||reduced.matches;
  ui.pause.setAttribute('aria-pressed',String(manuallyPaused||reduced.matches));
  ui.pause.textContent=reduced.matches?'减少动态已开启':manuallyPaused?'继续播放':'暂停播放';
}
function showReference(message){
  ui.stage.dataset.mode='reference';ui.host.hidden=true;ui.reference.hidden=false;
  ui.badge.textContent='静态参考';ui.motion.textContent='图画陪着你';
  for(const button of buttons)button.disabled=true;
  say(message);pausePreference();
}
function clearPress(consume=false){
  if(press){
    clearTimeout(press.timer);
    if(consume||press.consumed){suppressPointerClick=true;suppressClickUntil=performance.now()+1500;}
  }
  press=null;
}
async function switchForm(){
  if(busy)return;
  engine?.recordUserInput();clearPress();busy=true;
  ui.character.setAttribute('aria-busy','true');pausePreference();
  const next=active==='cat'?'girl':'cat',runtime=engine;
  try{
    await loadImage(forms[next].reference);
    if(runtime)await runtime.switchTo(next,reduced.matches);
    active=next;showForm(active);
    const address=new URL(location.href);address.searchParams.set('form',active);
    history.replaceState(history.state,'',address.href);
    ui.motion.textContent=runtime?(paused?'安静陪伴':'自然待机 · 轻轻呼吸'):'图画陪着你';
    say(runtime?'换个模样，还是 Lucky。轻点切换，长按摸摸。':'已换好图画；动态陪伴暂时没有加载。');
  }catch{
    say('另一个模样暂时没有加载好，先让她在这里陪你。');
  }finally{
    busy=false;ui.character.removeAttribute('aria-busy');pausePreference();
  }
}

ui.character.addEventListener('pointerdown',event=>{
  if(event.button!==0||!event.isPrimary||busy)return;
  engine?.recordUserInput();clearPress();suppressPointerClick=false;
  const pending={id:event.pointerId,x:event.clientX,y:event.clientY,consumed:false,timer:null};press=pending;
  pending.timer=setTimeout(()=>{
    if(press!==pending)return;
    pending.consumed=true;suppressPointerClick=true;
    if(!engine)say('这是 Lucky 的图画，动态陪伴暂时没有加载。');
    else if(!engine.play('Touch','longpress'))say(paused?'现在静静陪着你。':'她正在回应，稍等一下。');
  },600);
});
ui.character.addEventListener('pointermove',event=>{
  if(press&&event.pointerId===press.id&&Math.hypot(event.clientX-press.x,event.clientY-press.y)>12)clearPress(true);
});
for(const type of ['pointerup','pointercancel','pointerleave','lostpointercapture'])
  ui.character.addEventListener(type,()=>clearPress());
ui.character.addEventListener('pointerenter',event=>{
  if(event.pointerType==='mouse'&&!busy)engine?.play('Greet','hover');
});
ui.character.addEventListener('contextmenu',event=>{
  if(press?.consumed||(suppressPointerClick&&performance.now()<suppressClickUntil))event.preventDefault();
});
ui.character.addEventListener('click',event=>{
  const fromPointer=event.detail>0||Boolean(event.pointerType);
  if(fromPointer&&suppressPointerClick&&(press?.consumed||performance.now()<=suppressClickUntil)){
    suppressPointerClick=false;event.preventDefault();return;
  }
  void switchForm();
});
for(const button of buttons)button.addEventListener('click',()=>{
  if(!engine||busy||paused)return;
  if(!engine.play(button.dataset.motionGroup,'manual'))say('动作正在轻轻衔接，稍等一下。');
});
ui.pause.addEventListener('click',()=>{
  if(!engine||busy||reduced.matches)return;
  clearPress();manuallyPaused=!manuallyPaused;pausePreference();
  say(manuallyPaused?'先安静陪着你。':'继续轻轻呼吸，陪你看一会儿相册。');
});
let lastActivityRecord=-Infinity;
const observeActivity=event=>{
  if(!event.isTrusted)return;
  const now=performance.now();if(now-lastActivityRecord<500)return;
  lastActivityRecord=now;engine?.recordUserInput();
};
for(const type of ['pointerdown','pointermove','keydown','wheel'])
  document.addEventListener(type,observeActivity,{passive:true,capture:true});
document.addEventListener('visibilitychange',()=>{clearPress();pausePreference();});
reduced.addEventListener('change',()=>{clearPress();pausePreference();});
window.addEventListener('pagehide',event=>{
  clearPress();if(event.persisted)engine?.setPaused(true);else void engine?.dispose();
});
window.addEventListener('pageshow',event=>{if(event.persisted)pausePreference();});

class LuckyRuntime{
  constructor(sdk,canvas,gl){
    this.sdk=sdk;this.canvas=canvas;this.gl=gl;this.loaded=new Map();this.current=null;
    this.stopped=false;this.paused=false;this.frame=0;this.lastTime=null;this.transition=null;
    this.nextAmbientCheck=performance.now()+18000+Math.random()*10000;
    canvas.addEventListener('webglcontextlost',event=>{
      event.preventDefault();this.stop();if(engine===this)engine=null;
      showReference('动态陪伴暂时停下了，先看看 Lucky 的图画。刷新后可以再试。');
      void this.dispose();
    });
    this.resize=new ResizeObserver(()=>{this.fit();this.draw();});this.resize.observe(ui.host);
  }
  async load(kind){
    if(this.loaded.has(kind))return this.loaded.get(kind);
    const task=this.loadUncached(kind).catch(error=>{this.loaded.delete(kind);throw error;});
    this.loaded.set(kind,task);return task;
  }
  async loadUncached(kind){
    const {sdk,gl}=this,base=localUrl(`models/${kind}/`);
    const manifest=await(await checkedFetch(new URL('model3.json',base))).json();
    const refs=manifest.FileReferences;
    const bytes=await(await checkedFetch(new URL(refs.Moc,base))).arrayBuffer();
    const moc=sdk.CubismMoc.create(bytes,true);if(!moc)throw Error('Model consistency check failed');
    const model=moc.createModel();if(!model){moc.release();throw Error('Model could not be created');}
    const textures=[],motions=new Map();let renderer;
    try{
      const {ids,bounds}=validateParameters(model.getModel().parameters,kind);
      for(const [group,entries] of Object.entries(refs.Motions||{})){
        if(!Object.hasOwn(motionLabels,group)||entries.length!==1)throw Error('Unexpected character motion');
        const data=await(await checkedFetch(new URL(entries[0].File,base))).arrayBuffer();
        const json=JSON.parse(new TextDecoder().decode(data));validateMotion(json,ids,bounds);
        const motion=sdk.CubismMotion.create(data,data.byteLength,undefined,undefined,true);
        if(!motion)throw Error('Motion consistency check failed');
        motion.setEffectIds([],[]);motion.setLoop(group==='Idle');motion.setLoopFadeIn(false);
        motion.setMotionBehavior(sdk.MotionBehavior.MotionBehavior_V2);
        motion.setFadeInTime(entries[0].FadeInTime??json.Meta.FadeInTime??.35);
        motion.setFadeOutTime(entries[0].FadeOutTime??json.Meta.FadeOutTime??.35);
        motions.set(group,motion);
      }
      if(Object.keys(motionLabels).some(group=>!motions.has(group)))throw Error('Character motions are incomplete');
      renderer=new sdk.CubismRenderer_WebGL();renderer.initialize(model);renderer.startUp(gl);
      renderer.setIsPremultipliedAlpha(true);
      for(const [index,path] of refs.Textures.entries()){
        const image=await loadImage(new URL(path,base));if(this.stopped)throw Error('Playback stopped');
        const texture=gl.createTexture();if(!texture)throw Error('Character image could not be created');
        textures.push(texture);gl.bindTexture(gl.TEXTURE_2D,texture);gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL,true);
        gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,image);
        gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
        renderer.bindTexture(index,texture);
      }
      renderer.loadShaders(localUrl('sdk/shaders/').href);
      const shader=sdk.CubismShaderManager_WebGL.getInstance().getShader(gl);
      for(let i=0;!shader._isShaderLoaded&&i<100;i++)await delay(50);
      if(this.stopped||!shader._isShaderLoaded)throw Error('Character drawing is not ready');
      // Pinned 5-r.5 reserves three unused final Normal/Over slots.
      const sets=shader._shaderSets,count=11+shader._blendShaderSetMap.size*3;
      if(sets.length!==count+3)throw Error('Unexpected character drawing setup');
      for(let i=0;i<count;i++){
        const set=sets.at?sets.at(i):sets[i];
        if(!set?.shaderProgram||!gl.isProgram(set.shaderProgram)||!gl.getProgramParameter(set.shaderProgram,gl.LINK_STATUS))
          throw Error('Character drawing could not start');
      }
      model.update();
      return {kind,moc,model,renderer,textures,motions,manager:new sdk.CubismMotionManager(),
        policy:createMotionPolicy({availableGroups:motions.keys(),startTime:performance.now()}),priority:0,group:'Neutral'};
    }catch(error){
      renderer?.release();for(const texture of textures)gl.deleteTexture(texture);
      for(const motion of motions.values())sdk.ACubismMotion.delete(motion);
      moc.deleteModel(model);moc.release();throw error;
    }
  }
  async switchTo(kind,instant=false){
    const target=await this.load(kind);if(this.stopped)throw Error('Playback stopped');
    if(target===this.current)return;
    this.clearManager(target);this.reset(target);target.group='Neutral';target.policy.reset(performance.now());
    if(this.current&&!instant&&!this.paused){
      this.playOn(this.current,'Settle',4);await delay(150);
      if(this.stopped)throw Error('Playback stopped');
      const previous=this.current;
      if(!this.paused)await new Promise(resolve=>{this.transition={previous,target,start:performance.now(),resolve};});
      this.clearManager(previous);if(this.stopped)throw Error('Playback stopped');
    }
    this.current=target;this.transition=null;
    target.resumeIdle=this.paused;
    if(!this.paused)this.playOn(target,'Idle');
    this.lastTime=null;this.draw();
  }
  reset(item){const p=item.model.getModel().parameters;p.values.set(p.defaultValues);item.model.update();}
  clearManager(item){item.manager.release();item.manager=new this.sdk.CubismMotionManager();item.priority=0;}
  playOn(item,group,priority=group==='Idle'?1:3){
    const motion=item.motions.get(group);if(!motion)throw Error('Unknown character motion');
    item.resumeIdle=false;
    item.manager.startMotionPriority(motion,false,priority);item.group=group;item.priority=priority;
  }
  recordUserInput(){this.current?.policy.recordUserInput(performance.now());}
  requestState(now){return {now,paused:this.paused||this.stopped,busy,transitioning:!!this.transition,
    currentPriority:this.current?.priority??0,currentFinished:this.current?.manager.isFinished()??true,currentGroup:this.current?.group??'Neutral'};}
  play(group,source='manual'){
    if(!this.current)return false;
    const now=performance.now(),item=this.current;
    if(source!=='ambient')item.policy.recordUserInput(now);
    const decision=item.policy.canRequest({group,source,...this.requestState(now)});
    if(!decision.allowed)return false;
    this.playOn(item,group,decision.priority);item.policy.recordAccepted({group,source,now});
    ui.motion.textContent=motionLabels[group];
    if(source==='manual'||source==='longpress')say(group==='Quiet'?'放慢一点，静静陪着你。':group==='Settle'?'轻轻回到原来的姿态。':'Lucky 收到啦，轻轻回应你一下。');
    if(source==='ambient')this.nextAmbientCheck=now+18000+Math.random()*10000;
    return true;
  }
  setPaused(value){
    value=this.stopped||value;const changed=value!==this.paused;this.paused=value;this.lastTime=null;
    if(changed){this.recordUserInput();this.nextAmbientCheck=performance.now()+18000+Math.random()*10000;}
    if(value&&this.transition){
      const change=this.transition;this.transition=null;this.current=change.target;
      this.clearManager(change.previous);change.resolve();
    }
    if(value){cancelAnimationFrame(this.frame);this.frame=0;this.draw();}
    else if(!this.stopped){
      if(this.current?.resumeIdle){this.playOn(this.current,'Idle');ui.motion.textContent='自然待机 · 轻轻呼吸';}
      if(!this.frame)this.frame=requestAnimationFrame(time=>this.tick(time));
    }
  }
  fit(){
    const box=ui.host.getBoundingClientRect(),dpr=Math.min(devicePixelRatio||1,2);
    this.canvas.width=Math.max(1,Math.round(box.width*dpr));this.canvas.height=Math.max(1,Math.round(box.height*dpr));
  }
  drawItem(item,alpha=1){
    if(!item)return;
    const {canvas,gl,sdk}=this,aspect=canvas.width/canvas.height;
    const scale=Math.min(1.8*aspect/item.model.getCanvasWidth(),1.8/item.model.getCanvasHeight());
    const matrix=new sdk.CubismMatrix44();matrix.scale(scale/aspect,scale);
    item.renderer.setMvpMatrix(matrix);item.renderer.setModelColor(1,1,1,alpha);
    item.renderer.setRenderState(null,[0,0,canvas.width,canvas.height]);item.renderer.drawModel();
  }
  draw(){
    if(this.stopped)return;
    const {gl,canvas}=this;gl.bindFramebuffer(gl.FRAMEBUFFER,null);gl.viewport(0,0,canvas.width,canvas.height);
    gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT);
    if(this.transition){
      const t=Math.min(1,(performance.now()-this.transition.start)/340),v=smooth(t);
      this.drawItem(this.transition.previous,1-v);this.drawItem(this.transition.target,v);
      if(t===1){const {target,resolve}=this.transition;this.current=target;this.transition=null;resolve();}
    }else this.drawItem(this.current);
  }
  tick(time){
    this.frame=0;if(this.paused||this.stopped)return;
    try{
      const dt=this.lastTime===null?0:Math.min(.05,(time-this.lastTime)/1000);this.lastTime=time;
      const visible=this.transition?[this.transition.previous,this.transition.target]:[this.current];
      for(const item of visible.filter(Boolean)){
        item.manager.updateMotion(item.model,dt);item.model.update();
        if(item.manager.isFinished()&&item.group==='Settle'){
          item.group='Neutral';item.priority=0;if(item===this.current)ui.motion.textContent='已回到中性';
        }else if(item.manager.isFinished()&&item.group!=='Idle'&&item.group!=='Neutral'){
          this.playOn(item,'Idle');if(item===this.current)ui.motion.textContent='自然待机 · 轻轻呼吸';
        }
      }
      if(this.current&&time>=this.nextAmbientCheck){
        this.nextAmbientCheck=time+1000;
        const next=this.current.policy.chooseAmbient(this.requestState(time));if(next)this.play(next.group,'ambient');
      }
      this.draw();this.frame=requestAnimationFrame(next=>this.tick(next));
    }catch{
      this.stop();if(engine===this)engine=null;
      showReference('动态陪伴暂时停下了，Lucky 的图画还在。刷新后可以再试。');void this.dispose();
    }
  }
  stop(){this.stopped=true;cancelAnimationFrame(this.frame);this.frame=0;this.transition?.resolve();this.transition=null;}
  async dispose(){
    if(this.disposed)return;this.disposed=true;this.stop();this.resize.disconnect();
    for(const task of this.loaded.values())try{
      const item=await task;item.manager.release();item.renderer.release();
      for(const texture of item.textures)this.gl.deleteTexture(texture);
      for(const motion of item.motions.values())this.sdk.ACubismMotion.delete(motion);
      item.moc.deleteModel(item.model);item.moc.release();
    }catch{}
    this.sdk.CubismFramework.dispose();this.sdk.CubismFramework.cleanUp();this.canvas.remove();
  }
}

async function initialize(){
  busy=true;showForm(active);ui.reference.hidden=false;ui.host.hidden=true;
  ui.stage.dataset.mode='reference';ui.badge.textContent='准备见面';ui.motion.textContent='稍等一下';
  ui.character.setAttribute('aria-busy','true');say('Lucky 正在准备和你打招呼。');pausePreference();
  let initializedSdk;
  try{
    await new Promise((resolve,reject)=>{
      const script=document.createElement('script');script.src=localUrl('sdk/core.js').href;
      script.onload=resolve;script.onerror=()=>reject(Error('Character player unavailable'));document.head.append(script);
    });
    if(!window.Live2DCubismCore)throw Error('Character player did not start');
    const sdk=await import(localUrl('sdk/framework.js').href);
    for(const name of ['CubismFramework','Option','CubismMoc','CubismMotion','CubismMotionManager','MotionBehavior','ACubismMotion','CubismMatrix44','CubismRenderer_WebGL','CubismShaderManager_WebGL'])
      if(!sdk[name])throw Error('Character player is incomplete');
    const option=new sdk.Option();option.logFunction=()=>{};
    if(!sdk.CubismFramework.startUp(option))throw Error('Character player could not start');
    initializedSdk=sdk;sdk.CubismFramework.initialize();
    const canvas=document.createElement('canvas');canvas.hidden=true;canvas.setAttribute('aria-hidden','true');
    const gl=canvas.getContext('webgl',{alpha:true,premultipliedAlpha:true,antialias:true});
    if(!gl)throw Error('Character drawing is unavailable');
    ui.host.append(canvas);ui.host.hidden=false;
    const candidate=new LuckyRuntime(sdk,canvas,gl);engine=candidate;candidate.setPaused(paused);
    await candidate.switchTo(active,true);if(engine!==candidate||candidate.stopped)throw Error('Playback stopped');
    canvas.hidden=false;candidate.fit();candidate.draw();
    ui.reference.hidden=true;ui.stage.dataset.mode='runtime';ui.badge.textContent='体验中';
    ui.motion.textContent=paused?'安静陪伴':'自然待机 · 轻轻呼吸';
    say('轻点她换个模样，长按摸摸。两种模样都会轻轻回应。');
  }catch{
    const failed=engine;engine=null;await failed?.dispose();
    if(!failed&&initializedSdk){initializedSdk.CubismFramework.dispose();initializedSdk.CubismFramework.cleanUp();}
    showReference('动态陪伴暂时没有加载，先看看 Lucky 的图画。稍后刷新可以再试。');
  }finally{
    busy=false;ui.character.removeAttribute('aria-busy');pausePreference();
  }
}
void initialize();
