// Lucky stays in the browser only. The small preference record stores her position
// and whether the visitor chose to keep the widget visible or quiet.
const STORAGE_KEY = 'lucky-web-pet-v1';
// The floating pet renders at 136 CSS pixels or smaller; the full-size images
// remain available for the character page and original artwork comparison.
import {SPRITES, catRig, humanRig} from './character-rig.js?v=20261019-2';
const rigMarkup = catRig('lucky-pet', true);
let saved = {};
try { saved = JSON.parse(localStorage.getItem(STORAGE_KEY)) || {}; } catch { /* Storage can be unavailable. */ }

const pet = document.createElement('aside');
pet.className = 'lucky-pet';
pet.setAttribute('aria-label', 'Lucky 网页桌宠，一只奶白色、灰杏色斑块和蓬松长尾巴的三花小猫');
pet.innerHTML = `<div class="lucky-pet-bubble" aria-hidden="true" hidden></div>
  <button class="lucky-pet-character" type="button" aria-label="摸摸 Lucky；拖动或使用方向键可移动桌宠" aria-describedby="lucky-pet-help">
    ${rigMarkup}
    ${humanRig('lucky-pet',true).replace('lucky-human-rig','lucky-human-rig lucky-pet-human')}
    <img class="lucky-pet-pose" data-src="${SPRITES.sleep}" width="1329" height="1183" alt="" aria-hidden="true" draggable="false">
    <span class="lucky-magic" aria-hidden="true"><i class="lucky-magic-ring"></i>${[[-28,-35],[28,-40],[-45,0],[43,5],[-28,35],[30,35]].map(([x,y],i)=>`<i class="lucky-magic-particle" style="--x:${x}px;--y:${y}px;--delay:${i*20}ms">✧</i>`).join('')}</span>
    <span class="lucky-pet-shadow" aria-hidden="true"></span>
    <span class="lucky-pet-heart" aria-hidden="true">♥</span>
    <span class="lucky-pet-spark" aria-hidden="true">✦</span>
    <span class="lucky-pet-dream" aria-hidden="true">zZ</span>
  </button>
  <div class="lucky-pet-bar"><span class="lucky-pet-name">Lucky</span><button class="lucky-pet-menu-toggle" type="button" aria-label="Lucky 的互动菜单" aria-controls="lucky-pet-menu" aria-expanded="false">···</button></div>
  <div id="lucky-pet-menu" class="lucky-pet-menu" hidden>
    <p class="lucky-pet-menu-title">和 Lucky 玩一会儿</p>
    <p class="lucky-pet-menu-subtitle">三个月大的长尾三花小姑娘</p>
    <button type="button" data-pet-action="pet">♡ 摸摸 Lucky</button>
    <button type="button" data-pet-action="play">✦ 一起玩</button>
    <button type="button" data-pet-action="sleep">☾ 去睡觉</button>
    <button type="button" data-pet-action="sound" aria-pressed="false">♫ 合成互动音：关闭</button>
    <button type="button" data-pet-action="hide">× 收起桌宠</button>
    <p id="lucky-pet-help" class="lucky-pet-menu-help">轻点小猫变成女孩，再点女孩变回小猫。拖动或用方向键移动；互动音为合成音。</p>
  </div>
  <span class="lucky-pet-live" role="status" aria-live="polite" aria-atomic="true"></span>`;

const launcher = document.createElement('button');
launcher.className = 'lucky-pet-launcher';
launcher.type = 'button';
launcher.setAttribute('aria-label', '唤回 Lucky 网页桌宠');
launcher.innerHTML = '<span aria-hidden="true">🐾</span><span>Lucky</span>';

document.body.append(pet, launcher);
const character = pet.querySelector('.lucky-pet-character');
const bubble = pet.querySelector('.lucky-pet-bubble');
const live = pet.querySelector('.lucky-pet-live');
const menu = pet.querySelector('.lucky-pet-menu');
const menuToggle = pet.querySelector('.lucky-pet-menu-toggle');
const sleepButton = pet.querySelector('[data-pet-action="sleep"]');
const soundButton = pet.querySelector('[data-pet-action="sound"]');
let petForm = saved.form === 'human' ? 'human' : 'cat';
const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)');
let isSleeping = false;
let soundEnabled = saved.sound === true;
let petVisible = saved.visible !== false;
let revealedForCurrentView = false;
// Older versions saved even the default left-hand placement. Keep only locations
// the visitor actually moved, so a fresh mobile visit starts at the smaller right edge.
let hasCustomPosition = saved.moved === true || (saved.moved !== false && Number(saved.x) > 14);
let position = { x: hasCustomPosition ? Number(saved.x) : NaN, y: hasCustomPosition ? Number(saved.y) : NaN };
let bubbleTimer;
let actionTimer;
let blinkTimer;
let blinkEndTimer;
let formTransitionTimers = new Set();
let formTransitionTarget;
let activePointer;
let suppressClick = false;
let audioContext;
const preloadedSprites = new Map();
let petImagesActive = false;

// The floating companion shares the real runtime with the main transformation stage.
let petPlayer,petPlayerTask,petFormBusy=false,petQueuedForm;
let petLongPressTimer,petLongConsumed=false;
const petCanvasHost=document.createElement('span');petCanvasHost.className='lucky-pet-canvas';petCanvasHost.setAttribute('aria-hidden','true');
character.prepend(petCanvasHost);pet.dataset.modelState='loading';
async function ensurePetPlayer(){
  if(petPlayerTask)return petPlayerTask;
  petPlayerTask=(async()=>{
    try{
      const {createLuckyPlayer}=await import('./live2d/player.js?v=20261019-2');
      const player=await createLuckyPlayer({host:petCanvasHost,initialForm:petForm==='human'?'girl':'cat',maxDpr:1.5,
        onMotion:({group})=>{pet.dataset.motion=group;},
        onError:()=>{pet.dataset.modelState='error';if(!pet.hidden)showBubble('动态暂时停下了，先用图画陪着你。');}});
      petPlayer=player;pet.dataset.modelState='ready';player.setSuspended(pet.hidden);
      clearTimeout(blinkTimer);clearTimeout(blinkEndTimer);pet.classList.remove('is-blinking');
      isSleeping=false;pet.dataset.state='idle';sleepButton.textContent='☾ 安静陪伴';return player;
    }catch{pet.dataset.modelState='error';if(!pet.hidden)showBubble('动态暂时没有加载，当前显示静态参考。');return null;}
  })();return petPlayerTask;
}

function activatePetImages() {
  if (petImagesActive) return;
  petImagesActive = true;
  pet.querySelectorAll('image[data-href]').forEach(image => {
    image.setAttribute('href', image.dataset.href);
  });
}

function preloadSprite(state) {
  if (preloadedSprites.has(state) || !SPRITES[state]) return;
  const image = new Image();
  image.decoding = 'async';
  image.src = SPRITES[state];
  preloadedSprites.set(state, image);
}

function scheduleBlink() {
  clearTimeout(blinkTimer);
  clearTimeout(blinkEndTimer);
  if (pet.dataset.modelState || petForm === 'human' || pet.hidden || document.hidden || reducedMotion?.matches || pet.dataset.state === 'sleep') return;
  blinkTimer = window.setTimeout(() => {
    if (pet.hidden || document.hidden || pet.dataset.state === 'sleep') return;
    pet.classList.add('is-blinking');
    blinkEndTimer = window.setTimeout(() => {
      pet.classList.remove('is-blinking');
      scheduleBlink();
    }, 240);
  }, 3900 + Math.random() * 2200);
}

function save() {
  try {
    const preference = { visible: petVisible, sound: soundEnabled, moved: hasCustomPosition, form: petForm };
    if (hasCustomPosition) {
      preference.x = Math.round(position.x);
      preference.y = Math.round(position.y);
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(preference));
  } catch { /* The pet works without storage. */ }
}

function defaultX() {
  return window.innerWidth <= 640 ? window.innerWidth - (pet.offsetWidth || 90) - 12 : 12;
}

function clamp(value, min, max) { return Math.min(Math.max(value, min), Math.max(min, max)); }
function setPosition(x, y, persist = false) {
  const width = pet.offsetWidth || (window.innerWidth <= 640 ? 90 : 136);
  const height = pet.offsetHeight || (window.innerWidth <= 640 ? 124 : 174);
  position = {
    x: clamp(x, 6, window.innerWidth - width - 6),
    y: clamp(y, 6, window.innerHeight - height - 6)
  };
  pet.style.left = `${position.x}px`;
  pet.style.top = `${position.y}px`;
  const above = position.y - 8;
  const below = window.innerHeight - position.y - height - 8;
  const menuBelow = above < 315 && below > above;
  pet.classList.toggle('lucky-pet-near-top', menuBelow);
  pet.classList.toggle('lucky-pet-near-right', position.x + 200 > window.innerWidth - 6);
  menu.style.maxHeight = `${Math.max(80, Math.floor(menuBelow ? below : above))}px`;
  if (persist) save();
}

function showBubble(message, duration = 2400) {
  clearTimeout(bubbleTimer);
  bubble.textContent = message;
  live.textContent = message;
  bubble.hidden = false;
  bubbleTimer = window.setTimeout(() => { bubble.hidden = true; }, duration);
}

function setState(state, duration = 0) {
  if(petPlayer?.ready){clearTimeout(actionTimer);pet.dataset.state='idle';return;}
  clearTimeout(actionTimer);
  clearTimeout(blinkTimer);
  clearTimeout(blinkEndTimer);
  pet.classList.remove('is-blinking');
  pet.dataset.state = state;
  if (state === 'sleep') {
    const pose = pet.querySelector('.lucky-pet-pose');
    if (!pose.hasAttribute('src')) pose.src = pose.dataset.src;
  }
  // The awake figure is assembled from independently animated regions.
  // Sleeping is one deliberate pose transition rather than a loop of whole images.
  if (state !== 'sleep') scheduleBlink();
  if (duration) actionTimer = window.setTimeout(() => setState(isSleeping ? 'sleep' : 'idle'), duration);
}

function chirp() {
  if (!soundEnabled) return;
  try {
    const Context = window.AudioContext || window.webkitAudioContext;
    if (!Context) return;
    audioContext ||= new Context();
    if (audioContext.state === 'suspended') void audioContext.resume().catch(() => {});
    const oscillator = audioContext.createOscillator();
    const volume = audioContext.createGain();
    const now = audioContext.currentTime;
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(480, now);
    oscillator.frequency.exponentialRampToValueAtTime(690, now + 0.12);
    oscillator.frequency.exponentialRampToValueAtTime(390, now + 0.31);
    volume.gain.setValueAtTime(0.0001, now);
    volume.gain.exponentialRampToValueAtTime(0.035, now + 0.025);
    volume.gain.exponentialRampToValueAtTime(0.0001, now + 0.33);
    oscillator.connect(volume).connect(audioContext.destination);
    oscillator.start(now);
    oscillator.stop(now + 0.34);
  } catch { /* Audio is an optional effect. */ }
}

function closeMenu(restoreFocus = false) {
  if (menu.hidden) return;
  menu.hidden = true;
  menuToggle.setAttribute('aria-expanded', 'false');
  if (restoreFocus) menuToggle.focus();
}

function applyPetForm(form) {
  petForm = form === 'human' ? 'human' : 'cat';
  pet.dataset.form = petForm;
  pet.setAttribute('aria-label', `Lucky 网页桌宠，${petForm === 'cat' ? '奶白长毛三花小猫' : '猫耳女孩拟人形态'}`);
  pet.querySelector('[data-pet-action=pet]').textContent = petForm === 'human' ? '♡ 轻轻回应' : '♡ 摸摸 Lucky';
  pet.querySelector('[data-pet-action=play]').textContent = petForm === 'human' ? '✦ 一起玩' : '✦ 一起玩';
  sleepButton.textContent = petPlayer?.ready ? '☾ 安静陪伴' : '☾ 休息一下';
  character.setAttribute('aria-label', `点击${petForm === 'cat' ? '小猫 Lucky，变成猫耳女孩' : '猫耳女孩 Lucky，变回小猫'}；可拖动或用方向键移动`);
  if (!pet.hidden) activatePetImages();
  setState(isSleeping ? 'sleep' : 'idle');
}

function stopFormTransition() {
  formTransitionTimers.forEach(timer=>window.clearTimeout(timer));
  formTransitionTimers.clear();
  formTransitionTarget = undefined;
  delete pet.dataset.transition;
  delete pet.dataset.targetForm;
  pet.classList.remove('is-transforming');
  character.removeAttribute('aria-busy');
}

async function setPetForm(form,announce=false){
  const next=form==='human'?'human':'cat';
  if(petFormBusy){petQueuedForm={form:next,announce};return;}
  if(next===petForm&&pet.dataset.form)return;
  petFormBusy=true;character.setAttribute('aria-busy','true');closeMenu();stopFormTransition();character.setAttribute('aria-busy','true');
  try{
    const player=!pet.hidden||petPlayer?await ensurePetPlayer():null;
    if(player?.ready)await player.switchTo(next==='human'?'girl':'cat',reducedMotion?.matches||pet.hidden);
    applyPetForm(next);
    if(announce){showBubble(petForm==='human'?'变成画里的她，长按摸摸 ♡':'小猫回来啦，长按摸摸 ♡');save();}
  }catch{showBubble('另一个模样暂时没有加载好，保留现在的她。');}
  finally{petFormBusy=false;character.removeAttribute('aria-busy');const queued=petQueuedForm;petQueuedForm=null;if(queued)void setPetForm(queued.form,queued.announce);}
}
window.addEventListener('lucky:character-form', event => {
  if (['cat','human'].includes(event.detail?.form)) setPetForm(event.detail.form, true);
});

function toggleSleep() {
  if(petPlayer?.ready){isSleeping=false;petPlayer.play('Quiet','manual');showBubble('放慢一点，安静陪着你。');return;}
  isSleeping = !isSleeping;
  sleepButton.textContent = petPlayer?.ready ? '☾ 安静陪伴' : '☾ 休息一下';
  setState(isSleeping ? 'sleep' : 'hello', isSleeping ? 0 : 1500);
  showBubble(isSleeping ? petForm === 'human' ? '在这里休息一会儿，晚安 ☾' : '呼噜……晚安呀 ☾' : '醒啦，又能陪你啦 ♡');
  if (!isSleeping) chirp();
}

function petLucky() {
  if(petPlayer?.ready){if(petPlayer.play('Touch','manual')){showBubble('收到啦，轻轻回应你一下 ♡');chirp();}return;}
  if (isSleeping) {
    toggleSleep();
    return;
  }
  setState('hello', 2300);
  showBubble(petForm === 'human' ? '点点头，收到你的小心心啦 ♡' : '喵～送你一颗小心心 ♡');
  chirp();
}

function playLucky() {
  if(petPlayer?.ready){if(petPlayer.play('Play','manual')){showBubble('一起玩一会儿 ✧');chirp();}return;}
  if (isSleeping) toggleSleep();
  setState('play', 2900);
  showBubble(petForm === 'human' ? '抬起手，回应你一下 ✦' : '来玩呀！尾巴都摇起来啦 ✦', 2900);
  chirp();
}

function showPet() {
  petVisible = true;
  revealedForCurrentView = true;
  pet.hidden = false;
  launcher.hidden = true;
  petPlayer?.setSuspended(false);void ensurePetPlayer();
  activatePetImages();
  setState(isSleeping ? 'sleep' : 'idle');
  setPosition(hasCustomPosition && Number.isFinite(position.x) ? position.x : defaultX(),
    hasCustomPosition && Number.isFinite(position.y) ? position.y : window.innerHeight - pet.offsetHeight - 16, true);
  character.focus({ preventScroll: true });
  showBubble(isSleeping ? 'Lucky 还在做梦，轻点她变身。' : petForm === 'cat' ? '轻点我，变成猫耳女孩 ✧' : '再点我，变回小猫 ♡');
}

function hidePet() {
  closeMenu();
  stopFormTransition();
  clearTimeout(actionTimer);
  clearTimeout(blinkTimer);
  clearTimeout(blinkEndTimer);
  clearTimeout(bubbleTimer);
  bubble.hidden = true;
  petVisible = false;
  pet.hidden = true;
  clearTimeout(petLongPressTimer);petPlayer?.setSuspended(true);
  launcher.hidden = false;
  launcher.focus({ preventScroll: true });
  save();
}

soundButton.setAttribute('aria-pressed', String(soundEnabled));
soundButton.textContent = soundEnabled ? '♫ 合成互动音：开启' : '♫ 合成互动音：关闭';
pet.hidden = !petVisible;
launcher.hidden = !pet.hidden;
setState('idle');
setPosition(hasCustomPosition && Number.isFinite(position.x) ? position.x : defaultX(),
  hasCustomPosition && Number.isFinite(position.y) ? position.y : window.innerHeight - pet.offsetHeight - 16);
function syncRouteVisibility(reset = false) {
  if (reset) revealedForCurrentView = false;
  const isReading = ['#/character', '#/notes', '#/growth'].includes(location.hash) || location.hash.startsWith('#/note/');
  const contentLeft = document.querySelector('main')?.getBoundingClientRect().left || 0;
  const sideRailFits = hasCustomPosition || contentLeft >= 160;
  const compactView = window.innerWidth <= 640 || isReading || !sideRailFits;
  pet.hidden = !petVisible || (compactView && !revealedForCurrentView);
  launcher.hidden = !pet.hidden;
  if (pet.hidden) closeMenu();
  else {activatePetImages();void ensurePetPlayer();}
  petPlayer?.setSuspended(pet.hidden);
  scheduleBlink();
}
syncRouteVisibility();
setPetForm(petForm);
window.addEventListener('hashchange', () => syncRouteVisibility(true));

launcher.addEventListener('click', showPet);
character.addEventListener('click', event => {
  if ((event.detail>0||event.pointerType)&&suppressClick) { suppressClick = false; return; }
  if(petFormBusy)return;
  if (pet.classList.contains('is-transforming')) return;
  isSleeping = false; sleepButton.textContent = '☾ 去睡觉';
  setPetForm(petForm === 'cat' ? 'human' : 'cat', true);
});
character.addEventListener('pointerenter', event => {
  if (event.pointerType === 'touch' || isSleeping || !menu.hidden || activePointer) return;
  if(petPlayer?.ready){petPlayer.play('Greet','hover');return;}
  setState('hello', 1800);
});
character.addEventListener('keydown', (event) => {
  const steps = { ArrowLeft: [-20, 0], ArrowRight: [20, 0], ArrowUp: [0, -20], ArrowDown: [0, 20] };
  if (!steps[event.key]) return;
  event.preventDefault();
  const [dx, dy] = steps[event.key];
  hasCustomPosition = true;
  setPosition(position.x + dx, position.y + dy, true);
});
character.addEventListener('pointerdown', (event) => {
  if (event.button !== 0||!event.isPrimary||petFormBusy) return;
  clearTimeout(petLongPressTimer);suppressClick=false;petLongConsumed=false;petPlayer?.recordUserInput();
  activePointer = {
    id: event.pointerId, startX: event.clientX, startY: event.clientY,
    x: position.x, y: position.y, dragged: false
  };
  character.setPointerCapture?.(event.pointerId);
  const current=activePointer;petLongPressTimer=setTimeout(()=>{if(activePointer!==current||current.dragged)return;petLongConsumed=true;suppressClick=true;petLucky();},600);
});
character.addEventListener('pointermove', (event) => {
  if (!activePointer || event.pointerId !== activePointer.id) return;
  const dx = event.clientX - activePointer.startX;
  const dy = event.clientY - activePointer.startY;
  if (!activePointer.dragged && Math.hypot(dx, dy) < 7) return;
  clearTimeout(petLongPressTimer);activePointer.dragged = true;
  closeMenu();
  pet.classList.add('lucky-pet-dragging');
  setPosition(activePointer.x + dx, activePointer.y + dy);
  event.preventDefault();
});
function finishDrag(event) {
  if (!activePointer || event.pointerId !== activePointer.id) return;
  clearTimeout(petLongPressTimer);
  if(petLongConsumed)suppressClick=true;
  if (activePointer.dragged) {
    suppressClick = true;
    hasCustomPosition = true;
    setPosition(position.x, position.y, true);
    window.setTimeout(() => { suppressClick = false; }, 500);
  }
  activePointer = null;
  pet.classList.remove('lucky-pet-dragging');
}
character.addEventListener('pointerup', finishDrag);
character.addEventListener('pointercancel', finishDrag);
character.addEventListener('lostpointercapture',finishDrag);
character.addEventListener('contextmenu',event=>{if(petLongConsumed)event.preventDefault();});

menuToggle.addEventListener('click', () => {
  menu.hidden = !menu.hidden;
  menuToggle.setAttribute('aria-expanded', String(!menu.hidden));
  if (!menu.hidden) {
    bubble.hidden = true;
    preloadSprite('sleep');
  }
});
menu.addEventListener('click', (event) => {
  const button = event.target.closest('[data-pet-action]');
  if (!button) return;
  const action = button.dataset.petAction;
  if (action === 'pet') petLucky();
  else if (action === 'play') playLucky();
  else if (action === 'sleep') toggleSleep();
  else if (action === 'sound') {
    soundEnabled = !soundEnabled;
    soundButton.setAttribute('aria-pressed', String(soundEnabled));
    soundButton.textContent = soundEnabled ? '♫ 合成互动音：开启' : '♫ 合成互动音：关闭';
    showBubble(soundEnabled ? '合成的小音符，轻轻陪着你 ♪' : '安静陪着你 ♡');
    if (soundEnabled) chirp();
    save();
  } else if (action === 'hide') { hidePet(); return; }
  closeMenu(true);
});
document.addEventListener('pointerdown', (event) => {
  if (!pet.contains(event.target)) closeMenu();
});
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && !menu.hidden) closeMenu(true);
});
window.addEventListener('resize', () => {
  if (hasCustomPosition) setPosition(position.x, position.y, true);
  else setPosition(defaultX(), window.innerHeight - (pet.offsetHeight || (window.innerWidth <= 640 ? 124 : 174)) - 16);
  syncRouteVisibility();
});
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    if (formTransitionTarget) setPetForm(formTransitionTarget);
    clearTimeout(blinkTimer);
    clearTimeout(blinkEndTimer);
  } else if (pet.dataset.state !== 'sleep') scheduleBlink();
  else if (!isSleeping) setState('idle');
});
reducedMotion?.addEventListener?.('change', () => {
  if (formTransitionTarget) setPetForm(formTransitionTarget);
  setState(isSleeping ? 'sleep' : 'idle');
});
