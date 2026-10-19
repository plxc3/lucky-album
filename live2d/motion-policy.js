// Scheduling only: this module never writes model parameters or invents rig axes.
export const MOTION_GROUPS=Object.freeze([
  'Idle','Touch','Play','Greet','Curious','DoubleResponse','Quiet','Settle'
]);
export const MOTION_SOURCE_PRIORITIES=Object.freeze({
  ambient:2,hover:2,manual:3,longpress:3,transformation:4
});

const DEFAULT_AMBIENT=Object.freeze(['Curious','Quiet','Play']);
const isHumanSource=source=>source!=='ambient';
const isManualSource=source=>source==='manual'||source==='longpress';

function validTime(value,name='now'){
  if(!Number.isFinite(value)||value<0)throw new TypeError(`${name} must be a finite, non-negative millisecond time`);
  return value;
}
function validSource(source){
  if(!Object.hasOwn(MOTION_SOURCE_PRIORITIES,source))throw new TypeError('Unknown motion request source');
}
function validPriority(value){
  if(!Number.isInteger(value)||value<0||value>4)throw new TypeError('currentPriority must be an integer from 0 to 4');
}

/**
 * One policy per active model. All time values use the same monotonic ms clock
 * (normally performance.now()). canRequest and chooseAmbient do not commit state.
 */
export function createMotionPolicy({availableGroups=[],random=Math.random,startTime=0}={}){
  if(!availableGroups||typeof availableGroups[Symbol.iterator]!=='function')throw new TypeError('availableGroups must be iterable');
  const available=new Set(availableGroups);
  if([...available].some(group=>!MOTION_GROUPS.includes(group)))throw new TypeError('Unknown available motion group');
  if(typeof random!=='function')throw new TypeError('random must be a function');
  let lastUserInput,lastAmbient,lastManual,lastHoverGreet,lastAmbientGroup;
  const acceptedAt=new Map();

  function reset(now=0){
    validTime(now);lastUserInput=now;lastAmbient=now;
    lastManual=null;lastHoverGreet=null;lastAmbientGroup=null;acceptedAt.clear();
  }
  reset(startTime);

  function recordUserInput(now){
    validTime(now);lastUserInput=Math.max(lastUserInput,now);
  }

  function canRequest({group,source,now,paused=false,busy=false,transitioning=false,
    currentPriority=0,currentFinished=true,currentGroup='Neutral'}={}){
    validTime(now);validSource(source);validPriority(currentPriority);
    const priority=group==='Idle'?1:MOTION_SOURCE_PRIORITIES[source];
    const result=(allowed,reason)=>({allowed,reason,group,source,priority});
    if(!available.has(group))return result(false,'unavailable-group');
    // These lifecycle gates apply even to transformation requests. The owner's
    // internal switch transaction can play Settle without using this policy.
    if(paused)return result(false,'paused');
    if(transitioning)return result(false,'transitioning');
    if(busy)return result(false,'busy');
    if(!currentFinished&&currentPriority>priority)return result(false,'higher-priority');
    if(acceptedAt.has(group)&&now-acceptedAt.get(group)<1500)return result(false,'group-cooldown');
    if(isManualSource(source)&&lastManual!==null&&now-lastManual<400)return result(false,'manual-cooldown');
    if(source==='hover'&&group==='Greet'&&lastHoverGreet!==null&&now-lastHoverGreet<20000)
      return result(false,'hover-cooldown');
    if(source==='ambient'){
      if(currentGroup!=='Idle')return result(false,'ambient-requires-idle');
      if(now-lastAmbient<18000)return result(false,'ambient-cooldown');
      if(now-lastUserInput<12000)return result(false,'user-active');
    }
    return result(true,'accepted');
  }

  function recordAccepted({group,source,now}={}){
    validTime(now);validSource(source);
    if(!available.has(group))throw new TypeError('Cannot record an unavailable motion group');
    acceptedAt.set(group,Math.max(acceptedAt.get(group)??0,now));
    if(isHumanSource(source))recordUserInput(now);
    if(isManualSource(source))lastManual=Math.max(lastManual??0,now);
    if(source==='hover'&&group==='Greet')lastHoverGreet=Math.max(lastHoverGreet??0,now);
    if(source==='ambient'){
      lastAmbient=Math.max(lastAmbient,now);lastAmbientGroup=group;
    }
  }

  function chooseAmbient({candidates=DEFAULT_AMBIENT,...state}={}){
    validTime(state.now);
    if(!Array.isArray(candidates))throw new TypeError('Ambient candidates must be an array');
    const eligible=[...new Set(candidates)].filter(group=>
      group!=='Idle'&&group!=='Settle'&&group!==lastAmbientGroup&&
      available.has(group)&&canRequest({...state,group,source:'ambient'}).allowed);
    if(!eligible.length)return null;
    const sample=random();
    if(!Number.isFinite(sample)||sample<0||sample>=1)throw new TypeError('random() must return a finite value in [0, 1)');
    const group=eligible[Math.floor(sample*eligible.length)];
    return {...canRequest({...state,group,source:'ambient'}),now:state.now};
  }

  return Object.freeze({canRequest,chooseAmbient,recordUserInput,recordAccepted,reset,
    availableGroups:Object.freeze([...available])});
}
