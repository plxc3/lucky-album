import { notes } from './content.js?v=20261021-1';

const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)');
const finePointer = window.matchMedia?.('(hover: hover) and (pointer: fine)');
const chapters = [
  { id: 'all', name: '全部片段', subtitle: 'Lucky 的小日子', ids: null },
  { id: 'home', name: '家里的新日常', subtitle: '窗边、书桌与沙发', ids: ['lucky-crouching-on-a-chair','lucky-resting-on-a-book','lucky-tail-outside-the-yellow-bag','lucky-peeking-out-of-the-yellow-bag','lucky-reaching-up-beside-a-phone','lucky-sitting-beside-a-phone','lucky-peeking-under-the-table','lucky-at-the-night-window','lucky-touching-a-finger-at-keyboard','lucky-reaching-toward-the-desk','lucky-by-the-floral-cushion','lucky-fluffy-back','lucky-peeking-over-the-table','lucky-curled-up'] },
  { id: 'together', name: '相伴时光', subtitle: '怀里与沙发旁的小日子', ids: ['lucky-in-an-outdoor-hug','lucky-nestled-on-a-shoulder','lucky-beside-the-tablet','lucky-pouncing-on-the-chair','lucky-holding-a-finger','lucky-and-the-blue-feather','lucky-by-the-sofa-cover'] },
  { id: 'window', name: '窗边小家', subtitle: '黄色小窝与窗边一角', ids: ['lucky-in-the-yellow-bed','lucky-in-the-litter-box','lucky-window-corner'] },
  { id: 'first', name: '初见 Lucky', subtitle: '航空箱里的小眼神', ids: ['lucky-in-the-carrier','lucky-looking-up','lucky-looking-up-at-the-carrier-door','lucky-turning-in-the-carrier','lucky-exploring'] },
  { id: 'bird', name: '和小鸟', subtitle: '一位黄绿色的小邻居', ids: ['lucky-watching-the-bird','lucky-and-a-small-neighbor'] },
  { id: 'rest', name: '吃饭与小睡', subtitle: '小脑袋，小爪爪', ids: ['lucky-stretched-out-on-the-floral-mat','lucky-curled-up-with-paws-by-her-face','lucky-at-the-bowl','lucky-sleeping-on-the-back','lucky-little-paws','lucky-hiding-the-face'] },
];
// Keep later additions visible as a chapter until their individual themes are
// curated, without relying on a fixed media count or collection date.
const themedIds = new Set(chapters.flatMap(item=>item.ids || []));
const recentIds = notes.filter(note=>!themedIds.has(note.id)).map(note=>note.id);
if(recentIds.length)chapters.splice(1,0,{id:'recent',name:'新收录',subtitle:'刚收好的新片段',ids:recentIds});
const openingMoments = ['lucky-holding-a-finger', 'lucky-at-the-night-window', 'lucky-reaching-toward-the-desk', 'lucky-in-the-carrier'];
const escape = value => String(value).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const number = value => String(value).padStart(2,'0');
const videoCount = notes.filter(note=>note.video).length;
const photoCount = notes.length-videoCount;
let chapter = 'all';
let page = 0;
let opened = !!reduced?.matches;
let introSeen = opened;
let opening = false;
let turning = false;
let settledTurn = false;
let activeTurnFinish;
let timers = new Set();
let observers = new Set();
let animations = new Set();
let preparations = new Set();
let mountedRoot;
let openMedia;

function later(fn,ms) {
  const timer = window.setTimeout(()=>{timers.delete(timer);fn();},ms);
  timers.add(timer);
  return timer;
}
function selection() {
  const selected = chapters.find(item=>item.id === chapter);
  if (selected.ids) return selected.ids.map(id=>notes.find(note=>note.id === id)).filter(Boolean);
  const featured=openingMoments.map(id=>notes.find(note=>note.id === id)).filter(Boolean);
  return [...featured,...notes.filter(note=>!openingMoments.includes(note.id))];
}
function card(note) {
  const index = notes.indexOf(note);
  const order = selection().indexOf(note);
  const rotation = [-2,1.5,-1,2][order % 4];
  const framing = `style="object-fit:${note.previewFit==='contain'?'contain':'cover'};object-position:${escape(note.previewPosition || 'center')}"`;
  return `<button type="button" class="sticker-card${note.previewFit==='contain' && note.width>note.height ? ' sticker-landscape' : ''}" data-sticker="${index}" style="--rotation:${rotation}deg" aria-label="${note.video?'播放视频':'查看照片'}：${escape(note.title)}">
    <span class="sticker-image"><img src="${escape(note.previewPhoto || note.photo)}"${note.previewPhoto ? ` srcset="${escape(note.previewPhoto.replace(/\.webp$/, '-md.webp'))} 1x, ${escape(note.previewPhoto)} 2x"` : ''} alt="${escape(note.alt)}" width="${note.width}" height="${note.height}" ${framing} loading="lazy" draggable="false">${note.video ? `<video class="sticker-preview" muted playsinline loop preload="none" data-source="${escape(note.video)}" aria-hidden="true" hidden></video><span class="sticker-media-label">视频 · ${escape(note.duration)}</span>` : '<span class="sticker-media-label">照片</span>'}<span class="sticker-sheen" aria-hidden="true"></span></span>
    <span class="sticker-caption"><span class="sticker-number">${number(order+1)}</span><span>${escape(note.title)}</span></span>
  </button>`;
}
function bookPage(items,side,pageNumber=page) {
  const selected = chapters.find(item=>item.id === chapter);
  return `<section class="book-page book-page-${side}" aria-label="${side==='left'?'左':'右'}页">
    <div class="paper-heading"><span>${escape(side==='left'?selected.name:'LUCKY / LITTLE MOMENTS')}</span><span>${number(pageNumber*2+(side==='left'?1:2))}</span></div>
    ${items.length ? `<div class="sticker-grid">${items.map(card).join('')}</div>` : `<div class="chapter-end"><p class="chapter-end-label">这一页，先写到这里。</p><p>${selection().length} 个小片段，都收好了。</p><button type="button" data-book-action="first">回到第一页</button></div>`}
    <div class="paper-footer"><span>${escape(selected.subtitle)}</span><span>2026</span></div>
  </section>`;
}
function cover() {
  const portrait=notes.find(note=>note.id==='lucky-in-the-carrier');
  // The page header already carries "THE LITTLE ALBUM · 2026"; repeating it on the
  // cover wasted the line, so it states the real collection span instead.
  const dates=[...new Set(notes.map(note=>note.date))].sort();
  const first=dates[0].replace(/-/g,'.');
  const last=dates.length>1?dates.at(-1).slice(5).replace('-','.'):`${dates[0].slice(5).replace('-','.')}`;
  const span=dates.length>1?`${first} – ${last}`:first;
  return `<div class="cover-shell"><div class="cover-face"><div class="cover-copy">
    <p class="cover-edition">收录 ${span}</p><h2 class="cover-title">Lucky<span>的日常</span></h2><p class="cover-description">有 Lucky 的普通日子。</p>
    <button class="cover-open" type="button" data-book-action="open">翻开相册</button><button class="cover-skip" type="button" data-book-action="skip">跳过翻页动画</button><a class="cover-character-link" href="#/character">认识画里的 Lucky <span aria-hidden="true">→</span></a>
    <p class="cover-count">${number(notes.length)} 个片段 · ${number(videoCount)} 段视频 · ${number(photoCount)} 张照片</p>
    </div><div class="cover-collage" aria-hidden="true"><div class="cover-photo cover-photo-main"><img src="${portrait.photo}" alt="" width="${portrait.width}" height="${portrait.height}" draggable="false"><span>hello, Lucky.</span></div><div class="cover-photo cover-photo-character"><img src="assets/lucky-cozy-idle-small.png" alt="" width="512" height="456" draggable="false"><span>像素 Lucky</span></div></div>
    </div></div>`;
}

export function renderAlbum() {
  const items=selection();
  const pages=Math.max(1,Math.ceil(items.length/4));
  page=Math.min(page,pages-1);
  const visible=items.slice(page*4,page*4+4);
  const settledClass=settledTurn?' is-settled':'';
  settledTurn=false;
  return `<section class="album-experience${settledClass}" aria-label="Lucky 的贴纸相册">
    <div class="album-heading"><div><p class="eyebrow">THE LITTLE ALBUM · 2026</p><h1>Lucky 的小相册</h1><p class="album-intro">那些回头、伸爪与打盹的瞬间，都在这里。</p></div><span class="album-total">${videoCount} 段视频 · ${photoCount} 张照片</span></div>
    <div class="chapter-tabs" role="group" aria-label="相册章节">${chapters.map((item,index)=>`<button type="button" class="chapter-tab" data-chapter="${item.id}" aria-pressed="${item.id===chapter}"><span class="chapter-index">${number(index)}</span>${escape(item.name)}</button>`).join('')}</div>
    <div class="book-topline" ${opened?'':'hidden'}><span>左右滑动翻页</span><div><button type="button" data-book-action="previous" aria-label="上一页" ${page===0?'disabled':''}>‹</button><span aria-live="polite">${number(page+1)} / ${number(pages)}</span><button type="button" data-book-action="next" aria-label="下一页" ${page===pages-1?'disabled':''}>›</button></div></div>
    <div class="book-stage ${opened?'is-open':'is-closed'} ${opening?'is-opening':''}" tabindex="0" role="region" aria-label="相册第 ${page+1} 页，共 ${pages} 页，使用方向键翻页">
      <div class="book-spread" ${opened?'':'inert aria-hidden="true"'}>${bookPage(visible.slice(0,2),'left')}${bookPage(visible.slice(2),'right')}</div>
      ${opened?'':cover()}
    </div>
    <div class="book-controls"><button type="button" class="cover-toggle" data-book-action="cover" ${opened?'':'hidden'}>看封面</button><div class="page-controls" ${opened?'':'hidden'}><button type="button" data-book-action="previous" ${page===0?'disabled':''}>上一页</button><span class="page-status" role="status" aria-live="polite">${number(page+1)} / ${number(pages)}</span><button type="button" data-book-action="next" ${page===pages-1?'disabled':''}>下一页</button></div><span class="book-hint" ${opened?'':'hidden'}>点开片段，看大图或视频</span></div>
    <div class="album-progress" aria-hidden="true" ${opened?'':'hidden'}><span style="width:${((page+1)/pages)*100}%"></span></div>
    <a class="character-teaser" href="#/character"><span class="character-teaser-art"><img src="assets/lucky-cozy-hello-small.png" alt="" width="512" height="456" loading="lazy"></span><span class="character-teaser-copy"><strong>画里的 Lucky</strong><span>认识三花小姑娘的像素形象与拟人设定</span></span><span class="character-teaser-arrow" aria-hidden="true">→</span></a>
    <a class="growth-teaser" href="#/growth"><span class="growth-teaser-art" aria-hidden="true"><img src="assets/lucky-photo-11-preview.webp" alt="" width="720" height="1280" loading="lazy"></span><span class="growth-teaser-copy"><strong>Lucky 的成长观察</strong><span>${notes.length} 个真实片段，串起小爪、长尾与日常</span></span><span class="growth-teaser-arrow" aria-hidden="true">→</span></a>
  </section>`;
}

function refresh(focusSelector) {
  if(!mountedRoot?.isConnected)return;
  const root=mountedRoot,callback=openMedia;
  const chapterScroll=root.querySelector('.chapter-tabs')?.scrollLeft || 0;
  destroyAlbum();
  root.innerHTML=renderAlbum();
  mountAlbum(root,callback);
  const chapterTabs=root.querySelector('.chapter-tabs');
  if(chapterTabs)chapterTabs.scrollLeft=chapterScroll;
  if(focusSelector)root.querySelector(focusSelector)?.focus({preventScroll:true});
}
function finishOpening(moveFocus=false) {
  opened=true;opening=false;introSeen=true;
  refresh(moveFocus?`[data-chapter="${chapter}"]`:undefined);
}
function openCover(manual=false,skip=false) {
  if(opened)return;
  introSeen=true;
  if(skip||reduced?.matches){finishOpening(manual);return;}
  if(opening)return;
  opening=true;
  const stage=mountedRoot.querySelector('.book-stage');
  stage.classList.add('is-opening');
  mountedRoot.querySelector('.cover-open')?.setAttribute('aria-busy','true');
  later(()=>{
    const stage=mountedRoot?.querySelector('.book-stage');
    finishOpening(!!stage?.contains(document.activeElement));
  },1450);
}
function turnPage(direction,focusPlace='stage') {
  const max=Math.ceil(selection().length/4)-1;
  if(!opened||turning||page+direction<0||page+direction>max)return;
  mountedRoot.querySelectorAll('[data-sticker]').forEach(stopPreview);
  const action=direction>0?'next':'previous';
  const focusSelector=focusPlace==='top'?`.book-topline [data-book-action="${action}"]`
    :focusPlace==='bottom'?`.page-controls [data-book-action="${action}"]`:'.book-stage';
  const root=mountedRoot;
  const stage=root.querySelector('.book-stage');
  let finished=false;
  const finish=()=>{
    if(finished||mountedRoot!==root||!stage.isConnected)return;
    finished=true;
    activeTurnFinish=undefined;
    page+=direction;
    turning=false;
    settledTurn=true;
    refresh();
    const target=mountedRoot.querySelector(focusSelector);
    (target?.disabled?mountedRoot.querySelector('.book-stage'):target)?.focus({preventScroll:true});
  };
  if(reduced?.matches){finish();return;}
  turning=true;
  activeTurnFinish=finish;
  const spread=stage.querySelector('.book-spread');
  const oldHeight=spread.getBoundingClientRect().height;
  const mobile=window.matchMedia('(max-width:640px)').matches;
  stage.classList.add('is-turning','is-preparing',direction>0?'turn-forward':'turn-back');
  stage.setAttribute('aria-busy','true');
  spread.inert=true;
  spread.setAttribute('aria-hidden','true');
  // Keep the initiating control focused while photos prepare. No adjacent
  // sheets are downloaded until the visitor actually requests this turn.
  root.querySelectorAll('.page-controls button,.book-topline button').forEach(button=>button.setAttribute('aria-disabled','true'));
  const nextPage=page+direction;
  const incomingItems=selection().slice(nextPage*4,nextPage*4+4);
  const incoming=document.createElement('div');
  incoming.className='book-spread';
  incoming.innerHTML=bookPage(incomingItems.slice(0,2),'left',nextPage)+bookPage(incomingItems.slice(2),'right',nextPage);
  incoming.inert=true;
  incoming.setAttribute('aria-hidden','true');
  const makeLayer=(className,markup)=>{
    const layer=document.createElement('div');
    layer.className=className;layer.innerHTML=markup;
    layer.inert=true;layer.setAttribute('aria-hidden','true');
    layer.querySelectorAll('video').forEach(video=>video.remove());
    layer.querySelectorAll('button').forEach(button=>{button.disabled=true;button.tabIndex=-1;});
    return layer;
  };
  const startMotion=()=>{
    if(mountedRoot!==root||!stage.isConnected||activeTurnFinish!==finish)return;
    stage.classList.remove('is-preparing');
    if(reduced?.matches){finish();return;}
    if(mobile){
      // A narrow screen stacks the two album pages. Treat the complete spread
      // as one bounded sheet rather than rotating the lower half over the top.
      stage.classList.add('is-turning-mobile');
      incoming.classList.add('turning-mobile-incoming');
      const outgoing=makeLayer('turning-mobile-outgoing',spread.outerHTML);
      outgoing.style.height=`${oldHeight}px`;
      spread.replaceWith(incoming);
      stage.append(outgoing);
      const newHeight=incoming.getBoundingClientRect().height;
      if(stage.animate){
        const animation=stage.animate([{height:`${oldHeight}px`},{height:`${newHeight}px`}],
          {duration:320,easing:'cubic-bezier(.22,.65,.3,1)',fill:'forwards'});
        animations.add(animation);
      }
      later(finish,320);
    }else{
      // Incoming content is present before the leaf moves. The outgoing half on
      // the far side stays still until the leaf's real backside settles over it.
      const outgoingSide=direction>0?'right':'left';
      const stationarySide=direction>0?'left':'right';
      const stationary=makeLayer('turning-stationary',spread.querySelector(`.book-page-${stationarySide}`).outerHTML);
      const leaf=makeLayer('turning-leaf',`<div class="turning-face turning-front">${spread.querySelector(`.book-page-${outgoingSide}`).outerHTML}</div><div class="turning-face turning-back">${incoming.querySelector(`.book-page-${stationarySide}`).outerHTML}</div>`);
      spread.replaceWith(incoming);
      stage.append(stationary,leaf);
      later(finish,650);
    }
  };
  let decodeTimer;
  let cancelPreparation;
  const cancelled=new Promise(resolve=>{cancelPreparation=resolve;preparations.add(resolve);});
  const timeout=new Promise(resolve=>{decodeTimer=later(resolve,900);});
  const decoded=Promise.allSettled([...incoming.querySelectorAll('img')].map(image=>{
    image.loading='eager';image.decoding='async';
    if(image.decode)return image.decode();
    if(image.complete)return Promise.resolve();
    return new Promise(resolve=>{
      image.addEventListener('load',resolve,{once:true});
      image.addEventListener('error',resolve,{once:true});
    });
  }));
  Promise.race([decoded,timeout,cancelled]).then(()=>{
    preparations.delete(cancelPreparation);
    window.clearTimeout(decodeTimer);timers.delete(decodeTimer);
    startMotion();
  });
}
function stopPreview(card) {
  card.dataset.hovering='false';
  const video=card.querySelector('video');
  if(video){video.pause();video.hidden=true;video.removeAttribute('src');video.load();}
  card.style.removeProperty('--tilt-x');card.style.removeProperty('--tilt-y');card.style.removeProperty('--shine-x');card.style.removeProperty('--shine-y');
}

export function mountAlbum(root,onMedia) {
  mountedRoot=root;openMedia=onMedia;
  root.querySelectorAll('[data-sticker]').forEach(card=>{
    card.addEventListener('click',()=>{stopPreview(card);onMedia(Number(card.dataset.sticker),card,selection());});
    if(!finePointer?.matches||reduced?.matches)return;
    card.addEventListener('pointermove',event=>{
      if(reduced?.matches)return;
      const bounds=card.getBoundingClientRect();if(!bounds.width||!bounds.height)return;
      const x=(event.clientX-bounds.left)/bounds.width,y=(event.clientY-bounds.top)/bounds.height;
      card.style.setProperty('--tilt-x',`${(0.5-y)*8}deg`);card.style.setProperty('--tilt-y',`${(x-0.5)*10}deg`);
      card.style.setProperty('--shine-x',`${x*100}%`);card.style.setProperty('--shine-y',`${y*100}%`);
    });
    card.addEventListener('pointerenter',()=>{
      if(reduced?.matches||document.hidden)return;
      card.dataset.hovering='true';const video=card.querySelector('video');
      if(!video||window.navigator.connection?.saveData)return;
      later(()=>{if(card.dataset.hovering!=='true'||!card.isConnected||reduced?.matches||document.hidden)return;video.muted=true;video.src=video.dataset.source;
        video.play()?.then(()=>{if(card.dataset.hovering==='true'&&card.isConnected)video.hidden=false;else stopPreview(card);}).catch(()=>{video.hidden=true;});
      },250);
    });
    card.addEventListener('pointerleave',()=>stopPreview(card));
  });
  if(window.IntersectionObserver){
    const observer=new IntersectionObserver(entries=>entries.forEach(entry=>{if(!entry.isIntersecting)stopPreview(entry.target);}));
    root.querySelectorAll('[data-sticker]').forEach(card=>observer.observe(card));
    observers.add(observer);
  }
  root.querySelectorAll('[data-chapter]').forEach(button=>button.addEventListener('click',()=>{
    if(button.dataset.chapter===chapter && opened)return;
    chapter=button.dataset.chapter;page=0;opened=true;opening=false;turning=false;introSeen=true;
    refresh(`[data-chapter="${chapter}"]`);
  }));
  root.querySelectorAll('[data-book-action]').forEach(button=>button.addEventListener('click',()=>{
    const action=button.dataset.bookAction;
    if(action==='open'||action==='skip')openCover(true,action==='skip');
    else if(action==='next'||action==='previous')turnPage(action==='next'?1:-1,
      button.closest('.book-topline')?'top':button.closest('.page-controls')?'bottom':'stage');
    else if(action==='first'){page=0;refresh('.book-stage');}
    else if(action==='cover'){opened=false;opening=false;turning=false;introSeen=true;refresh('[data-book-action="open"]');}
  }));
  const stage=root.querySelector('.book-stage');
  stage.addEventListener('keydown',event=>{
    if(event.key==='Escape' && !opened){event.preventDefault();finishOpening(true);return;}
    if(event.target.closest('video'))return;
    if(event.key==='ArrowRight'||event.key==='ArrowLeft'){event.preventDefault();turnPage(event.key==='ArrowRight'?1:-1,'stage');}
  });
  let touch;
  stage.addEventListener('touchstart',event=>{touch=event.touches.length===1&&!event.target.closest('video')?{x:event.touches[0].clientX,y:event.touches[0].clientY}:null;},{passive:true});
  stage.addEventListener('touchmove',event=>{if(event.touches.length!==1)touch=null;},{passive:true});
  stage.addEventListener('touchcancel',()=>{touch=null;},{passive:true});
  stage.addEventListener('touchend',event=>{if(!touch)return;const point=event.changedTouches[0];const origin=touch;touch=null;if(!point||event.touches.length)return;const dx=point.clientX-origin.x,dy=point.clientY-origin.y;if(Math.abs(dx)>65&&Math.abs(dy)<60)turnPage(dx<0?1:-1);},{passive:true});
  if(!opened&&!introSeen){introSeen=true;later(()=>openCover(),1600);}
}
export function destroyAlbum() {
  timers.forEach(timer=>window.clearTimeout(timer));timers.clear();
  observers.forEach(observer=>observer.disconnect());observers.clear();
  animations.forEach(animation=>animation.cancel());animations.clear();
  preparations.forEach(cancel=>cancel());preparations.clear();
  activeTurnFinish=undefined;
  mountedRoot?.querySelectorAll('.sticker-preview').forEach(video=>{video.pause();video.removeAttribute('src');video.load();});
  mountedRoot=undefined;openMedia=undefined;turning=false;opening=false;
}
document.addEventListener('visibilitychange',()=>{
  if(document.hidden)mountedRoot?.querySelectorAll('[data-sticker]').forEach(stopPreview);
});
reduced?.addEventListener('change',()=>{
  if(!reduced.matches||!mountedRoot?.isConnected)return;
  mountedRoot.querySelectorAll('[data-sticker]').forEach(stopPreview);
  if(turning){activeTurnFinish?.();return;}
  if(!opened)finishOpening(!!mountedRoot.querySelector('.book-stage')?.contains(document.activeElement));
});
