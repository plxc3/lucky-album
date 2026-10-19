import {validateMotion,validateParameters} from './model-checks.js';
import {createMotionPolicy} from './motion-policy.js';
const localUrl=path=>new URL(path,import.meta.url);
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const smooth=t=>t*t*(3-2*t);
const motionLabels={Idle:'自然待机',Touch:'摸摸',Play:'逗逗',Greet:'打招呼',Curious:'好奇回应',DoubleResponse:'两次回应',Quiet:'安静陪伴',Settle:'回到中性'};
async function checkedFetch(url){const r=await fetch(url);if(!r.ok)throw Error('Character file unavailable');return r;}
async function loadImage(url){const i=new Image();i.src=url;await i.decode();return i;}
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
  if(!options.host?.isConnected)throw Error('Character host is not mounted');
  const sdk=await loadSdk();
  if(!options.host.isConnected)throw Error('Character host was removed');
  const canvas=document.createElement('canvas');canvas.setAttribute('aria-hidden','true');canvas.dataset.luckyLive2d='true';
  const gl=canvas.getContext('webgl',{alpha:true,premultipliedAlpha:true,antialias:true});
  if(!gl)throw Error('WebGL unavailable');
  options.host.append(canvas);
  const player=new LuckyPlayer(sdk,canvas,gl,options);
  try{
    player.refreshPause();await player.switchTo(options.initialForm==='girl'?'girl':'cat',true);
    if(!options.host.isConnected)throw Error('Character host was removed');
    player.fit();player.draw();player._ready=true;options.onReady?.(player);return player;
  }catch(error){await player.dispose();throw error;}
}

class LuckyPlayer{
  constructor(sdk,canvas,gl,options){
    this.host=options.host;this.options=options;this.maxDpr=options.maxDpr??2;this.switching=false;this._ready=false;this.manualPaused=false;this.suspended=false;
    this.reduced=matchMedia('(prefers-reduced-motion: reduce)');
    this.onPreference=()=>this.refreshPause();
    document.addEventListener('visibilitychange',this.onPreference);this.reduced.addEventListener('change',this.onPreference);
    this.sdk=sdk;this.canvas=canvas;this.gl=gl;this.loaded=new Map();this.current=null;
    this.stopped=false;this.paused=false;this.frame=0;this.lastTime=null;this.transition=null;
    this.nextAmbientCheck=performance.now()+18000+Math.random()*10000;
    canvas.addEventListener('webglcontextlost',event=>{
      event.preventDefault();this.stop();this.options.onError?.(Error('Character context was lost'));void this.dispose();
    });
    this.resize=new ResizeObserver(()=>{this.fit();this.draw();});this.resize.observe(this.host);
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
  get form(){return this.current?.kind;}
  get ready(){return this._ready&&!this.stopped;}
  async switchTo(kind,instant=false){
    if(!['cat','girl'].includes(kind))throw Error('Unknown Lucky form');
    if(this.switching)throw Error('Character is already changing');
    this.switching=true;
    try {
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
    else if(!this.stopped){
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
      this.stop();this.options.onError?.(Error('Character playback stopped'));void this.dispose();
    }
  }
  stop(){this.stopped=true;cancelAnimationFrame(this.frame);this.frame=0;this.transition?.resolve();this.transition=null;}
  async dispose(){
    if(this.disposed)return;this.disposed=true;this.stop();this.resize.disconnect();
    document.removeEventListener('visibilitychange',this.onPreference);this.reduced.removeEventListener('change',this.onPreference);
    for(const task of this.loaded.values())try{
      const item=await task;item.manager.release();item.renderer.release();
      for(const texture of item.textures)this.gl.deleteTexture(texture);
      for(const motion of item.motions.values())this.sdk.ACubismMotion.delete(motion);
      item.moc.deleteModel(item.model);item.moc.release();
    }catch{}
    // Framework and IDs are shared by all mounted players. Release only this GL context.
    const shaders=this.sdk.CubismShaderManager_WebGL.getInstance();
    shaders.getShader(this.gl)?.release();shaders._shaderMap.delete(this.gl);
    this.canvas.remove();
  }
}
