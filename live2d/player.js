import {validateMotion,validateParameters} from './model-checks.js?v=20261021-1';
import {createMotionPolicy} from './motion-policy.js';
const localUrl=path=>new URL(path,import.meta.url);
const abortReason=signal=>signal?.reason??new DOMException('Character loading cancelled','AbortError');
function throwIfAborted(signal){if(signal?.aborted)throw abortReason(signal);}
function abortRace(task,signal){
  throwIfAborted(signal);if(!signal)return task;
  return new Promise((resolve,reject)=>{
    const cleanup=()=>signal.removeEventListener('abort',onAbort);
    const onAbort=()=>{cleanup();reject(abortReason(signal));};
    signal.addEventListener('abort',onAbort,{once:true});
    Promise.resolve(task).then(value=>{cleanup();resolve(value);},error=>{cleanup();reject(error);});
    if(signal.aborted)onAbort();
  });
}
function delay(ms,signal){
  throwIfAborted(signal);
  return new Promise((resolve,reject)=>{
    const cleanup=()=>signal?.removeEventListener('abort',onAbort);
    const timer=setTimeout(()=>{cleanup();resolve();},ms);
    const onAbort=()=>{clearTimeout(timer);cleanup();reject(abortReason(signal));};
    signal?.addEventListener('abort',onAbort,{once:true});
    if(signal?.aborted)onAbort();
  });
}
const smooth=t=>t*t*(3-2*t);
const motionLabels={Idle:'自然待机',Touch:'摸摸',Play:'逗逗',Greet:'打招呼',Curious:'好奇回应',DoubleResponse:'两次回应',Quiet:'安静陪伴',Settle:'回到中性'};
async function checkedFetch(url,signal){
  throwIfAborted(signal);const r=await fetch(url,{signal});throwIfAborted(signal);
  if(!r.ok)throw Error('Character file unavailable');return r;
}
async function loadImage(url,signal){
  throwIfAborted(signal);const image=new Image();
  return new Promise((resolve,reject)=>{
    let settled=false;
    const cleanup=()=>signal?.removeEventListener('abort',onAbort);
    const finish=(error)=>{if(settled)return;settled=true;cleanup();error?reject(error):resolve(image);};
    const onAbort=()=>{
      if(settled)return;settled=true;cleanup();
      if(image.removeAttribute)image.removeAttribute('src');else image.src='';
      reject(abortReason(signal));
    };
    signal?.addEventListener('abort',onAbort,{once:true});
    if(signal?.aborted){onAbort();return;}
    image.src=url;
    Promise.resolve().then(()=>image.decode()).then(()=>{
      if(signal?.aborted)onAbort();else finish();
    },finish);
  });
}
let sdkTask;
function loadSdk(){
  if(sdkTask)return sdkTask;
  sdkTask=(async()=>{
    if(!window.Live2DCubismCore)await new Promise((resolve,reject)=>{
      const script=document.createElement('script');script.src=localUrl('sdk/core.js').href;
      script.onload=resolve;script.onerror=()=>reject(Error('Character player unavailable'));document.head.append(script);
    });
    if(!window.Live2DCubismCore)throw Error('Character player unavailable');
    const sdk=await import(localUrl('sdk/framework.js').href);
    if(!sdk.CubismFramework.isInitialized()){
      const option=new sdk.Option();option.logFunction=()=>{};
      if(!sdk.CubismFramework.startUp(option))throw Error('Character player could not start');
      sdk.CubismFramework.initialize();
    }
    return sdk;
  })().catch(error=>{sdkTask=null;throw error;});
  return sdkTask;
}
export async function createLuckyPlayer(options){
  throwIfAborted(options.signal);
  if(!options.host?.isConnected)throw Error('Character host is not mounted');
  // The SDK task is shared. Cancel this waiter, never another player's SDK load.
  const sdk=await abortRace(loadSdk(),options.signal);throwIfAborted(options.signal);
  if(!options.host.isConnected)throw Error('Character host was removed');
  const canvas=document.createElement('canvas');canvas.setAttribute('aria-hidden','true');canvas.dataset.luckyLive2d='true';
  const gl=canvas.getContext('webgl',{alpha:true,premultipliedAlpha:true,antialias:true});
  if(!gl)throw Error('WebGL unavailable');
  options.host.append(canvas);
  const player=new LuckyPlayer(sdk,canvas,gl,options);
  try{
    player.refreshPause();await player.switchTo(options.initialForm==='girl'?'girl':'cat',true);
    throwIfAborted(options.signal);
    if(!options.host.isConnected)throw Error('Character host was removed');
    player.fit();player.draw();player._ready=true;player.refreshPause();options.onReady?.(player);return player;
  }catch(error){await player.dispose();throw error;}
}

class LuckyPlayer{
  constructor(sdk,canvas,gl,options){
    this.host=options.host;this.options=options;this.abortController=new AbortController();this.signal=this.abortController.signal;
    this.externalSignal=options.signal;this.maxDpr=options.maxDpr??2;this.switching=false;this._ready=false;this.manualPaused=false;this.suspended=false;
    this.reduced=matchMedia('(prefers-reduced-motion: reduce)');
    this.onPreference=()=>this.refreshPause();
    document.addEventListener('visibilitychange',this.onPreference);this.reduced.addEventListener('change',this.onPreference);
    this.sdk=sdk;this.canvas=canvas;this.gl=gl;this.loaded=new Map();this.current=null;
    this.stopped=false;this.paused=false;this.frame=0;this.lastTime=null;this.transition=null;
    this.nextAmbientCheck=performance.now()+18000+Math.random()*10000;
    this.onContextLost=event=>{
      event.preventDefault();if(this.disposed)return;this.stop();
      if(!this.signal?.aborted)this.options.onError?.(Error('Character context was lost'));void this.dispose();
    };
    canvas.addEventListener('webglcontextlost',this.onContextLost);
    this.resize=new ResizeObserver(()=>{this.fit();this.draw();});this.resize.observe(this.host);
    this.onAbort=()=>{this.stop();void this.dispose();};
    this.signal.addEventListener('abort',this.onAbort,{once:true});
    this.onExternalAbort=()=>this.abortController.abort(abortReason(this.externalSignal));
    this.externalSignal?.addEventListener('abort',this.onExternalAbort,{once:true});
    if(this.externalSignal?.aborted)this.onExternalAbort();
  }
  checkActive(){throwIfAborted(this.signal);if(this.stopped)throw Error('Playback stopped');if(!this.host.isConnected)throw Error('Character host was removed');}
  async load(kind){
    this.checkActive();
    if(this.loaded.has(kind))return this.loaded.get(kind);
    const task=this.loadUncached(kind).catch(error=>{this.loaded.delete(kind);throw error;});
    this.loaded.set(kind,task);return task;
  }
  async loadUncached(kind){
    this.checkActive();
    const {sdk,gl}=this,base=localUrl(kind==='girl'?'models/girl/v012/':`models/${kind}/`);
    const manifest=await(await checkedFetch(new URL(kind==='girl'?'model3.json?v=20261021-1':'model3.json',base),this.signal)).json();this.checkActive();
    const refs=manifest.FileReferences;
    const bytes=await(await checkedFetch(new URL(refs.Moc,base),this.signal)).arrayBuffer();this.checkActive();
    const moc=sdk.CubismMoc.create(bytes,true);if(!moc)throw Error('Model consistency check failed');
    const model=moc.createModel();if(!model){moc.release();throw Error('Model could not be created');}
    const textures=[],motions=new Map();let renderer;
    try{
      const {ids,bounds}=validateParameters(model.getModel().parameters,kind,kind==='girl'?'v012':'v005');
      for(const [group,entries] of Object.entries(refs.Motions||{})){
        if(!Object.hasOwn(motionLabels,group)||entries.length!==1)throw Error('Unexpected character motion');
        const data=await(await checkedFetch(new URL(entries[0].File,base),this.signal)).arrayBuffer();this.checkActive();
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
        const image=await loadImage(new URL(path,base),this.signal);this.checkActive();
        const texture=gl.createTexture();if(!texture)throw Error('Character image could not be created');
        textures.push(texture);gl.bindTexture(gl.TEXTURE_2D,texture);gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL,true);
        gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,image);
        gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
        renderer.bindTexture(index,texture);
      }
      const shader=sdk.CubismShaderManager_WebGL.getInstance().getShader(gl);
      this.checkActive();this.startShaders(renderer,shader);
      // Pinned SDK shader fetching has no AbortSignal interface. Stop playback's
      // wait promptly; disposal releases this shader after its late registration.
      for(let i=0;!shader._isShaderLoaded&&i<100;i++){this.checkActive();await delay(50,this.signal);}
      this.checkActive();
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
  startShaders(renderer,shader){
    // Capture only this context's pending load, without changing the shared SDK.
    // generateShaders attaches its registration callback before this call returns.
    const own=Object.getOwnPropertyDescriptor(shader,'loadShaders'),original=shader.loadShaders;
    let task;
    shader.loadShaders=function(...args){task=original.apply(this,args);return task;};
    try{renderer.loadShaders(localUrl('sdk/shaders/').href);}
    finally{
      if(own)Object.defineProperty(shader,'loadShaders',own);else delete shader.loadShaders;
      if(task)this.shaderSettled=Promise.resolve(task).then(()=>{},()=>{});
    }
  }
  get form(){return this.current?.kind;}
  get ready(){return this._ready&&!this.stopped;}
  async switchTo(kind,instant=false){
    this.checkActive();
    if(!['cat','girl'].includes(kind))throw Error('Unknown Lucky form');
    if(this.switching)throw Error('Character is already changing');
    this.switching=true;
    try {
    const target=await abortRace(this.load(kind),this.signal);this.checkActive();
    if(target===this.current)return;
    this.clearManager(target);this.reset(target);target.group='Neutral';target.policy.reset(performance.now());
    if(this.current&&!instant&&!this.paused){
      this.playOn(this.current,'Settle',4);await delay(150,this.signal);this.checkActive();
      const previous=this.current;
      if(!this.paused)await new Promise(resolve=>{this.transition={previous,target,start:performance.now(),resolve};});
      this.checkActive();this.clearManager(previous);
    }
    this.current=target;this.transition=null;
    target.resumeIdle=this.paused;
    if(!this.paused)this.playOn(target,'Idle');
    this.lastTime=null;this.draw();this.canvas.dataset.form=kind;
    this.options.onMotion?.({group:target.group,source:'transform',form:kind});
    } finally {this.switching=false;}
  }
  reset(item){const p=item.model.getModel().parameters;p.values.set(p.defaultValues);item.model.update();}
  clearManager(item){item.manager.release();item.manager=new this.sdk.CubismMotionManager();item.priority=0;}
  playOn(item,group,priority=group==='Idle'?1:3){
    const motion=item.motions.get(group);if(!motion)throw Error('Unknown character motion');
    item.resumeIdle=false;
    item.manager.startMotionPriority(motion,false,priority);item.group=group;item.priority=priority;
  }
  recordUserInput(){this.current?.policy.recordUserInput(performance.now());}
  requestState(now){return {now,paused:this.paused||this.stopped,busy:this.switching,transitioning:!!this.transition,
    currentPriority:this.current?.priority??0,currentFinished:this.current?.manager.isFinished()??true,currentGroup:this.current?.group??'Neutral'};}
  play(group,source='manual'){
    if(!this.current)return false;
    const now=performance.now(),item=this.current;
    if(source!=='ambient')item.policy.recordUserInput(now);
    const decision=item.policy.canRequest({group,source,...this.requestState(now)});
    if(!decision.allowed)return false;
    this.playOn(item,group,decision.priority);item.policy.recordAccepted({group,source,now});
    this.options.onMotion?.({group,source,form:item.kind});
    if(source==='ambient')this.nextAmbientCheck=now+18000+Math.random()*10000;
    return true;
  }
  setPaused(value){this.manualPaused=Boolean(value);this.refreshPause();}
  setSuspended(value){this.suspended=Boolean(value);this.refreshPause();}
  refreshPause(){this.applyPaused(document.hidden||this.reduced.matches||this.manualPaused||this.suspended);}
  applyPaused(value){
    value=this.stopped||value;const changed=value!==this.paused;this.paused=value;this.lastTime=null;
    if(changed){this.recordUserInput();this.nextAmbientCheck=performance.now()+18000+Math.random()*10000;}
    if(value&&this.transition){
      const change=this.transition;this.transition=null;this.current=change.target;
      this.clearManager(change.previous);change.resolve();
    }
    if(value){cancelAnimationFrame(this.frame);this.frame=0;this.draw();}
    else if(!this.stopped&&this._ready&&this.current){
      if(this.current?.resumeIdle){this.playOn(this.current,'Idle');this.options.onMotion?.({group:'Idle',source:'resume',form:this.current.kind});}
      if(!this.frame)this.frame=requestAnimationFrame(time=>this.tick(time));
    }
  }
  fit(){
    const box=this.host.getBoundingClientRect(),dpr=Math.min(devicePixelRatio||1,this.maxDpr);
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
    if(!this.host.isConnected){void this.dispose();return;}
    try{
      const dt=this.lastTime===null?0:Math.min(.05,(time-this.lastTime)/1000);this.lastTime=time;
      const visible=this.transition?[this.transition.previous,this.transition.target]:[this.current];
      for(const item of visible.filter(Boolean)){
        item.manager.updateMotion(item.model,dt);item.model.update();
        if(item.manager.isFinished()&&item.group==='Settle'){
          item.group='Neutral';item.priority=0;if(item===this.current)this.options.onMotion?.({group:'Neutral',source:'finished',form:item.kind});
        }else if(item.manager.isFinished()&&item.group!=='Idle'&&item.group!=='Neutral'){
          this.playOn(item,'Idle');if(item===this.current)this.options.onMotion?.({group:'Idle',source:'finished',form:item.kind});
        }
      }
      if(this.current&&time>=this.nextAmbientCheck){
        this.nextAmbientCheck=time+1000;
        const next=this.current.policy.chooseAmbient(this.requestState(time));if(next)this.play(next.group,'ambient');
      }
      this.draw();this.frame=requestAnimationFrame(next=>this.tick(next));
    }catch{
      this.stop();if(!this.signal?.aborted)this.options.onError?.(Error('Character playback stopped'));void this.dispose();
    }
  }
  stop(){this.stopped=true;cancelAnimationFrame(this.frame);this.frame=0;this.transition?.resolve();this.transition=null;}
  async dispose(){
    if(this.disposed)return;this.disposed=true;this.stop();this.abortController.abort();this.resize.disconnect();
    document.removeEventListener('visibilitychange',this.onPreference);this.reduced.removeEventListener('change',this.onPreference);
    this.signal.removeEventListener('abort',this.onAbort);this.externalSignal?.removeEventListener('abort',this.onExternalAbort);
    this.canvas.removeEventListener('webglcontextlost',this.onContextLost);this.canvas.remove();
    // Detach ownership now. An uncancellable SDK shader load may still complete;
    // keep its sets intact until registration finishes, then release them once.
    const shaders=this.sdk.CubismShaderManager_WebGL.getInstance(),shader=shaders.getShader(this.gl);
    shaders._shaderMap.delete(this.gl);
    for(const task of this.loaded.values())try{
      const item=await task;item.manager.release();item.renderer.release();
      for(const texture of item.textures)this.gl.deleteTexture(texture);
      for(const motion of item.motions.values())this.sdk.ACubismMotion.delete(motion);
      item.moc.deleteModel(item.model);item.moc.release();
    }catch{}
    // Framework and IDs are shared by all mounted players. Release only this GL context.
    await this.shaderSettled;shader?.release();
  }
}
