import { site, notes } from './content.js?v=20261020-1';
import { renderAlbum, mountAlbum, destroyAlbum } from './album.js?v=20261020-1';
import {growthThemes, buildCollectionTimeline, buildIntakeSeries} from './growth.js?v=20261020-1';

const main = document.querySelector('main');
const dialog = document.querySelector('.lightbox');
const image = dialog.querySelector('img');
const video = dialog.querySelector('video');
const originalDownload = document.createElement('a');
originalDownload.className = 'original-download';
originalDownload.textContent = '下载相册原始 HEIC';
originalDownload.setAttribute('download', '');
originalDownload.hidden = true;
dialog.querySelector('.lightbox-top').insertBefore(originalDownload, dialog.querySelector('.close-button'));
let activePhoto = 0;
let activeSequence = notes;
let lastPhotoButton;
let lastRoute = '';
let journalScrollY = 0;
let journalReturnNoteId = '';
let imageObserver;
const escape = (value) => String(value).replace(/[&<>"']/g, (char) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const dateText = (date) => date.replaceAll('-', '.');
const duration = (note) => note.video ? `视频 · ${escape(note.duration)}` : '照片';
const albumCount = `${String(notes.filter(note => note.video).length).padStart(2,'0')} 段视频 · ${String(notes.filter(note => !note.video).length).padStart(2,'0')} 张照片`;
const collectionDates = [...new Set(notes.map(note => note.date))];
const sharedCollectionDate = collectionDates.length === 1 ? collectionDates[0] : null;
const journalGroups = [
  {
    title: '小爪与陪伴',
    description: '抱住手指，追着羽毛，也轻轻碰一下你。',
    ids: ['lucky-in-an-outdoor-hug', 'lucky-nestled-on-a-shoulder', 'lucky-beside-the-tablet', 'lucky-reaching-up-beside-a-phone', 'lucky-sitting-beside-a-phone', 'lucky-pouncing-on-the-chair', 'lucky-holding-a-finger', 'lucky-touching-a-finger-at-keyboard', 'lucky-little-paws', 'lucky-and-the-blue-feather', 'lucky-peeking-over-the-table'],
  },
  {
    title: '家里的新日常',
    description: '书桌、沙发和窗边，都有她的小身影。',
    ids: ['lucky-crouching-on-a-chair', 'lucky-resting-on-a-book', 'lucky-tail-outside-the-yellow-bag', 'lucky-peeking-out-of-the-yellow-bag', 'lucky-peeking-under-the-table', 'lucky-at-the-night-window', 'lucky-reaching-toward-the-desk', 'lucky-by-the-floral-cushion', 'lucky-fluffy-back', 'lucky-curled-up', 'lucky-by-the-sofa-cover', 'lucky-window-corner'],
  },
  {
    title: '初见与探索',
    description: '从航空箱里的眼神，到走出箱门的一步。',
    ids: ['lucky-in-the-carrier', 'lucky-looking-up', 'lucky-looking-up-at-the-carrier-door', 'lucky-turning-in-the-carrier', 'lucky-exploring'],
  },
  {
    title: '窗边与小憩',
    description: '小窝、饭碗、小鸟，还有四脚朝天的好梦。',
    ids: ['lucky-stretched-out-on-the-floral-mat', 'lucky-curled-up-with-paws-by-her-face', 'lucky-at-the-bowl', 'lucky-sleeping-on-the-back', 'lucky-hiding-the-face', 'lucky-in-the-yellow-bed', 'lucky-in-the-litter-box', 'lucky-watching-the-bird', 'lucky-and-a-small-neighbor'],
  },
];
// New owner uploads remain readable before a hand-curated chapter is assigned.
// Existing chapters keep their order, including the original 37 little moments.
const groupedNoteIds = new Set(journalGroups.flatMap(group => group.ids));
const recentNotes = notes.filter(note => !groupedNoteIds.has(note.id));
if (recentNotes.length) journalGroups.push({
  title: '最近收录',
  description: '刚刚放进相册的小日子，也在这里留一页。',
  ids: recentNotes.map(note => note.id),
});
const growthNotes = growthThemes.flatMap(theme => theme.ids.map(id => notes.find(note => note.id === id)));
const growthTimeline = buildCollectionTimeline(notes);
const journalSequence = journalGroups.flatMap(group => group.ids.map(id => notes.find(note => note.id === id))).filter(Boolean);

function deferOffscreenImages(markup) {
  // This markup is generated here. Assign offscreen sources only near the viewport,
  // rather than letting the browser eagerly fetch several screens of lazy images.
  return markup.replace(/<img\b[^>]*>/g, tag => tag.includes('loading="lazy"') ? tag.replace(/\b(src|srcset)=/g, 'data-$1=') : tag);
}
function mountImages() {
  const pending = [...main.querySelectorAll('img[data-src]')];
  const load = img => {
    if (!img.dataset.src) return;
    img.classList.add('is-image-pending');
    const show = () => img.classList.remove('is-image-pending');
    img.addEventListener('load', show, {once:true});
    img.addEventListener('error', show, {once:true});
    // Keep responsive candidates dormant too, including inside folded details.
    // Set the candidates before the fallback so one selection starts the request.
    if (img.dataset.srcset) {
      img.srcset = img.dataset.srcset;
      img.removeAttribute('data-srcset');
    }
    img.src = img.dataset.src;
    img.removeAttribute('data-src');
    if (img.complete) show();
  };
  if (!window.IntersectionObserver) { pending.forEach(load); return; }
  const observer = new IntersectionObserver(entries => entries.forEach(entry => {
    if (!entry.isIntersecting) return;
    if (entry.target.isConnected) load(entry.target);
    observer.unobserve(entry.target);
  }), {rootMargin:'200px 0px'});
  imageObserver = observer;
  pending.forEach(img => { img.classList.add('is-image-pending'); observer.observe(img); });
}

function renderIntakeChart(series) {
  const W = 720, H = 164, left = 16, right = 16, top = 12, bottom = 12;
  const plotW = W - left - right, plotH = H - top - bottom;
  const px = p => left + p.x * plotW;
  const py = p => top + plotH - p.y * plotH;
  const line = series.points.map(p => `${px(p).toFixed(1)},${py(p).toFixed(1)}`).join(' ');
  const area = `${left},${top + plotH} ${line} ${px(series.points.at(-1)).toFixed(1)},${top + plotH}`;
  // Keep the plot decorative. HTML values below remain readable when a narrow
  // viewport scales the SVG down or the visitor increases their text size.
  const grid = [0, 0.5, 1].map(f => {
    const y = top + plotH - f * plotH;
    return `<line class="growth-chart-grid" x1="${left}" y1="${y}" x2="${W - right}" y2="${y}"></line>`;
  }).join('');
  const dots = series.points.map(p => `<circle class="growth-chart-dot" cx="${px(p).toFixed(1)}" cy="${py(p).toFixed(1)}" r="5"></circle>`).join('');
  const rows = series.points.map(p => `<tr><th scope="row"><time datetime="${escape(p.date)}"><span class="growth-chart-year">${escape(p.date.slice(0,4))} 年</span><span class="growth-chart-monthday">${escape(p.date.slice(5).replace('-','.'))}</span></time></th><td>${p.added}</td><td><strong>${p.total}</strong></td></tr>`).join('');
  return `<figure class="growth-intake-chart">
    <svg viewBox="0 0 ${W} ${H}" aria-hidden="true" focusable="false" preserveAspectRatio="xMidYMid meet">
      ${grid}
      <polygon class="growth-chart-area" points="${area}"></polygon>
      <polyline class="growth-chart-line" points="${line}"></polyline>
      ${dots}
    </svg>
    <table class="growth-chart-table"><caption>相册一页页添起来 · 单位：条</caption><thead><tr><th scope="col">收录日期</th><th scope="col">本次</th><th scope="col">累计</th></tr></thead><tbody>${rows}</tbody></table>
    <figcaption>曲线向上表示<strong>累计收录条数</strong>增加，每个节点是一批收录，按批次等距排列。收录日期不等于拍摄日期；目前缺少可靠的体重、身长与拍摄日期，无法绘制 Lucky 的身体成长曲线。</figcaption>
  </figure>`;
}

function renderGrowthMoment(note) {
  const index = growthNotes.indexOf(note);
  return `<li class="growth-moment"><article><button type="button" class="growth-image-button" data-growth-photo="${index}" aria-label="${note.video ? '播放视频' : '放大照片'}：${escape(note.title)}"><img src="${escape(note.previewPhoto || note.photo)}"${note.previewPhoto ? ` srcset="${escape(note.previewPhoto.replace(/\.webp$/, '-md.webp'))} 1x, ${escape(note.previewPhoto)} 2x"` : ''} alt="${escape(note.alt)}" width="${note.width}" height="${note.height}" loading="lazy"><span class="growth-image-hint">${note.video ? `▷ 完整视频 · ${escape(note.duration)}` : '放大看原图 ↗'}</span></button><div class="growth-moment-copy"><span class="growth-moment-label"><time datetime="${note.date}">${dateText(note.date)}</time> 收录</span><h4>${escape(note.title)}</h4><p>${escape(note.description)}</p><a href="#/note/${escape(note.id)}">翻到这篇日记 <span aria-hidden="true">→</span></a></div></article></li>`;
}
function renderGrowthTheme(theme) {
  const records = theme.ids.map(id => notes.find(note => note.id === id));
  const featured = records.slice(0,3);
  const remaining = records.slice(3);
  // Native details keeps every card and diary link in the DOM. Its closed content
  // has no layout box; deferred images load when opening makes them intersect.
  const more = remaining.length ? `<details class="growth-theme-more"><summary>展开本主题其余 ${remaining.length} 个片段</summary><ul class="growth-moments">${remaining.map(renderGrowthMoment).join('')}</ul></details>` : '';
  return `<section class="growth-theme" aria-labelledby="growth-theme-${theme.id}"><header><p class="growth-moment-label">${escape(theme.label)}</p><h3 id="growth-theme-${theme.id}" tabindex="-1">${escape(theme.title)}</h3><p>${escape(theme.description)}</p></header><ul class="growth-moments">${featured.map(renderGrowthMoment).join('')}</ul>${more}</section>`;
}

function renderGrowth() {
  const hero = notes.find(note => note.id === 'lucky-fluffy-back');
  const intake = buildIntakeSeries(notes);
  return `<section class="growth-view" aria-labelledby="growth-title">
    <header class="growth-hero"><div class="growth-hero-copy"><p class="growth-kicker">LUCKY / LITTLE BY LITTLE</p><h1 id="growth-title">小小一团，<br>满满的日常。</h1><p class="growth-hero-lead">把小爪、长尾和轻快的脚步，一点点收进成长手记。${notes.length} 个真实片段，记下 Lucky 被陪伴、被看见的模样。</p><div class="growth-profile"><span class="growth-profile-mark" aria-hidden="true">✳</span><span>主人提供的小档案</span><strong>3 个月 · 母三花 · 灰尖长尾</strong></div></div><figure class="growth-hero-photo"><button class="growth-cover-button" type="button" data-photo="${notes.indexOf(hero)}" aria-label="放大查看 Lucky 的三花背影"><img src="${hero.previewPhoto || hero.photo}" alt="Lucky 背对镜头坐在蓝边白色垫子上，奶白长毛间有烟灰和浅杏斑块" width="${hero.width}" height="${hero.height}"></button><figcaption>奶白、烟灰和浅杏，都是她的颜色。</figcaption></figure><span class="growth-hero-index" aria-hidden="true">LITTLE MOMENTS / ${notes.length}</span></header>
    <section class="growth-collection" aria-labelledby="growth-collection-title"><header class="growth-story-heading"><div><p class="growth-kicker">OUR ALBUM KEEPS GROWING</p><h2 id="growth-collection-title">陪她的日子，一页页收好</h2></div><p>${albumCount}。下面按<strong>收录日期</strong>排列，记录相册怎样添页；不代表素材的拍摄先后。</p></header>${renderIntakeChart(intake)}<ol class="growth-collection-list">${growthTimeline.map(batch => `<li><article><div class="growth-collection-date"><span>收录日期</span><time datetime="${batch.date}">${dateText(batch.date)}</time><small>累计 ${batch.total} 条记录</small></div><div class="growth-collection-copy"><h3>${escape(batch.title)}</h3><p>${escape(batch.description)}</p><p class="growth-batch-count">本次 ${batch.items.length} 条 · ${batch.videos} 段视频 · ${batch.photos} 张照片</p><details><summary>翻看本次全部 ${batch.items.length} 条记录</summary><ul>${batch.items.map(note => `<li><a href="#/note/${escape(note.id)}"><span>${escape(note.title)}</span><small>${duration(note)}</small></a></li>`).join('')}</ul></details></div></article></li>`).join('')}</ol></section>
    <section class="growth-story growth-observations" aria-labelledby="growth-story-title"><header class="growth-story-heading"><div><p class="growth-kicker">WAYS TO REMEMBER HER</p><h2 id="growth-story-title">在这些小事里，看见 Lucky</h2></div><p>${growthThemes.length} 条观察线，把 ${growthNotes.length} 个照片与动作片段放在一起，覆盖相册里的每一条记录。按生活主题翻看，不把不同姿态当作长大的刻度。</p></header><nav class="growth-theme-index" aria-label="选择成长观察主题">${growthThemes.map(theme => `<button type="button" data-growth-jump="growth-theme-${theme.id}">${escape(theme.label.slice(5))}</button>`).join('')}</nav>${growthThemes.map(renderGrowthTheme).join('')}</section>
    <section class="growth-context" aria-labelledby="growth-context-title"><div class="growth-context-icon" aria-hidden="true">✳</div><div><h2 id="growth-context-title">把看得见的留下，把未知的留白</h2><p>这是一份基于现有影像的成长手记。目前没有可靠的拍摄日期、逐月体重或身长记录；收录日期不等于拍摄日期。镜头远近和姿势会影响看起来的大小，因此这里记录动作、陪伴与日常，不绘制未经测量的成长曲线。</p></div></section>
    <nav class="growth-next" aria-label="继续看 Lucky"><a href="#/notes">翻翻 Lucky 的日记 <span aria-hidden="true">→</span></a><a href="#/">回到小相册 <span aria-hidden="true">→</span></a></nav>
  </section>`;
}

const characterFeatures = [
  {
    id:'fur', label:'奶白长毛', noteId:'lucky-little-paws',
    description:'脸颊、胸口与小爪旁的长毛是奶白色。画里用成组的浅色毛束，留下她还是幼猫的圆脸与软软的轮廓。',
    photoMark:{cx:54,cy:47,rx:24,ry:15}, artMark:{cx:45,cy:73,rx:22,ry:15},
    photoCaption:'照片里的胸毛与小爪', artCaption:'形象里的奶白毛束',
  },
  {
    id:'calico', label:'烟灰与浅杏', noteId:'lucky-fluffy-back',
    description:'背毛中能看到烟灰与浅杏色的斑块。形象把这些颜色轻轻留在耳尖、额头与毛束里，奶白仍然是主色。',
    photoMark:{cx:36,cy:58,rx:27,ry:17}, artMark:{cx:44,cy:24,rx:29,ry:13},
    photoCaption:'背影里的三花斑块', artCaption:'画里的灰杏点染',
  },
  {
    id:'tail', label:'灰尖长尾', noteId:'lucky-reaching-toward-the-desk',
    description:'站到柜边时，灰色长尾向坐垫左侧伸出，尾端到了镜头边缘。画里的灰尖尾巴完整绕在身旁，保留她醒目的长尾特征。',
    photoMark:{cx:18,cy:73,rx:18,ry:9}, artMark:{cx:83,cy:44,rx:13,ry:13},
    photoCaption:'坐垫左侧伸出的长尾', artCaption:'绕在身边的灰尖尾巴',
  },
];
function featureMark(mark) {
  return `<svg class="feature-mark" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><ellipse cx="${mark.cx}" cy="${mark.cy}" rx="${mark.rx}" ry="${mark.ry}" vector-effect="non-scaling-stroke"/></svg>`;
}
function renderFeaturePanel(index) {
  const feature = characterFeatures[index];
  const note = notes.find(item => item.id === feature.noteId);
  return `<div class="character-feature-evidence"><figure class="feature-reference"><button type="button" class="feature-reference-frame" data-photo="${notes.indexOf(note)}" aria-label="查看本猫照片：${escape(feature.label)}"><img src="${note.previewPhoto || note.photo}" alt="${escape(note.alt)}" width="${note.width}" height="${note.height}" loading="lazy">${featureMark(feature.photoMark)}</button><figcaption>本猫 · ${escape(feature.photoCaption)}</figcaption></figure><figure class="feature-drawing"><div class="feature-drawing-frame"><img src="assets/lucky-cozy-idle-small.png" alt="Lucky 的坐姿像素形象，奶白长毛间点染灰杏，长尾巴绕在身旁" width="512" height="456" loading="lazy">${featureMark(feature.artMark)}</div><figcaption>画里的 Lucky · ${escape(feature.artCaption)}</figcaption></figure></div><div class="character-feature-copy"><p class="feature-observation">FROM LUCKY'S PHOTOS / ${String(index+1).padStart(2,'0')}</p><h3>${escape(feature.label)}</h3><p>${escape(feature.description)}</p><a href="#/note/${feature.noteId}">看看这张照片的日记 <span aria-hidden="true">→</span></a></div>`;
}
function renderFeatureStudy() {
  return `<section class="character-feature-study" aria-labelledby="character-feature-title"><header><p class="character-kicker">A LITTLE BIT OF LUCKY</p><h2 id="character-feature-title">认认 Lucky 的三花</h2><p>点选一个小特征，把照片里的她与画里的她放在一起。</p></header><div class="character-feature-tabs" role="tablist" aria-label="Lucky 的特征">${characterFeatures.map((feature,index) => `<button type="button" role="tab" id="feature-tab-${feature.id}" data-feature="${index}" aria-controls="character-feature-panel" aria-selected="${index===0}" tabindex="${index===0 ? 0 : -1}">${feature.label}</button>`).join('')}</div><div id="character-feature-panel" class="character-feature-panel" role="tabpanel" aria-labelledby="feature-tab-fur" tabindex="0">${renderFeaturePanel(0)}</div></section>`;
}
function selectCharacterFeature(index, moveFocus = false) {
  const feature = characterFeatures[index];
  const panel = document.getElementById('character-feature-panel');
  if (!feature || !panel) return;
  const currentButton = main.querySelector(`[data-feature="${index}"]`);
  if (currentButton?.getAttribute('aria-selected') === 'true') {
    if (moveFocus) currentButton.focus({preventScroll:true});
    return;
  }
  main.querySelectorAll('[data-feature]').forEach(button => {
    const selected = Number(button.dataset.feature) === index;
    button.setAttribute('aria-selected', String(selected));
    button.tabIndex = selected ? 0 : -1;
    if (selected && moveFocus) button.focus({preventScroll:true});
  });
  panel.setAttribute('aria-labelledby', `feature-tab-${feature.id}`);
  panel.innerHTML = renderFeaturePanel(index);
}

const realCharacterNote = notes.find(note => note.id === 'lucky-little-paws');
const characterForms = [
  {
    id:'photo', label:'真实小猫', eyebrow:'LUCKY / THE LITTLE MUSE',
    title:'故事从她开始。', description:'圆圆的眼睛、奶白长毛，还有绕在身边的灰尖长尾。照片里的 Lucky，是每一种画法的起点。',
    image:realCharacterNote.photo, small:realCharacterNote.photo1x, width:realCharacterNote.width, height:realCharacterNote.height,
    alt:realCharacterNote.alt, caption:'本猫 Lucky · 真实照片',
  },
  {
    id:'cat', label:'像素小猫', eyebrow:'LUCKY / PIXEL PORTRAIT',
    title:'坐下来，陪着你。', description:'把柔软的毛束画成小小像素。奶白、烟灰与浅杏，和她醒目的长尾巴，都留在了画里。',
    image:'assets/lucky-cozy-idle-small.png', width:1329, height:1183,
    alt:'第二版坐姿像素 Lucky，奶白长毛间点染烟灰与浅杏，灰尖长尾绕在身旁', caption:'坐姿像素 Lucky · 根据本猫照片创作',
  },
  {
    id:'human', label:'猫耳女孩', eyebrow:'LUCKY / HUMAN PORTRAIT',
    title:'换一种模样，还是 Lucky。', description:'猫耳、浅色蓬松长发和完整的灰尖长尾，把小姑娘的神气带进柔和的绘本里。',
    image:'assets/lucky-human-portrait-display.webp', small:'assets/lucky-human-portrait-display-1x.webp', width:1024, height:1536,
    alt:'Lucky 的既有绘本风猫耳女孩立绘，奶白长发、暖白外套，完整灰尖长尾在身旁弯起', caption:'猫耳女孩 Lucky · 来自本猫的拟人想象',
  },
];
const characterMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const characterGroups={idle:'Idle',pet:'Touch',play:'Play',greet:'Greet',curious:'Curious',double:'DoubleResponse',rest:'Quiet',settle:'Settle'};
const characterLabels={Idle:'自然待机，轻轻呼吸。',Touch:'Lucky 收下你的摸摸，轻轻回应了一下。',Play:'一起玩一会儿，她轻轻回应你。',Greet:'你好呀，Lucky 和你打招呼。',Curious:'她好奇地回应了一下。',DoubleResponse:'一次，再一次，回应你的小招呼。',Quiet:'放慢一点，安静陪着你。',Settle:'轻轻回到原来的姿态。',Neutral:'安静地陪着你。'};
let characterMount;
let rememberedCharacterForm=new URL(location.href).searchParams.get('form')==='girl'?'human':'cat';

function characterHitLabel(form){return form==='human'?'点击猫耳女孩，变回像素小猫；长按摸摸':form==='photo'?'点击真实 Lucky，看看像素小猫':'点击像素小猫，变成猫耳女孩；长按摸摸';}
function renderCharacterTransform(){
  const initial=characterForms.find(form=>form.id===rememberedCharacterForm)||characterForms[1];
  return `<section class="character-transform character-transform--live" aria-label="Lucky 的三种模样" data-character-form="${initial.id}" data-live2d-state="loading">
    <div class="character-transform-intro"><p class="character-kicker">ONE LUCKY / THREE LITTLE WORLDS</p><h1 id="character-title">同一只 Lucky，<br>换个模样陪你。</h1><p>从照片里的小三花，到画里的小姑娘。<br>选一种模样，看看那些一直没变的小特征。</p><div class="character-form-tabs" role="tablist" aria-label="选择 Lucky 的模样">${characterForms.map((form,index)=>`<button type="button" role="tab" id="character-form-${form.id}" data-character-form-tab="${index}" aria-controls="character-form-panel" aria-selected="${form.id===initial.id}" tabindex="${form.id===initial.id?0:-1}">${form.label}</button>`).join('')}</div><div class="character-form-copy" aria-live="polite" aria-atomic="true"><p class="character-form-eyebrow">${initial.eyebrow}</p><h2>${initial.title}</h2><p class="character-form-description">${initial.description}</p></div><p class="character-transform-instruction" id="character-transform-help">轻点小猫，原地变成画里的她；再点女孩，变回小猫。<br>长按约半秒摸摸，也可以用下面的小动作陪她玩。</p><a class="character-transform-details" href="#character-human-title" data-character-human-jump>翻翻完整拟人设定 <span aria-hidden="true">↓</span></a><p class="character-model-note">动态形象 · 体验中<br>已经能轻柔呼吸和回应，眨眼与独立手势仍在制作。</p></div>
    <div class="character-form-panel" id="character-form-panel" role="tabpanel" aria-labelledby="character-form-${initial.id}" tabindex="0"><div class="character-display">${characterForms.map(form=>`<figure class="character-form-figure character-form-figure--${form.id}" data-character-form-slide="${form.id}" data-active="${form.id===initial.id}" aria-hidden="${form.id!==initial.id}"><div class="character-form-art"><img src="${form.image}"${form.small?` srcset="${form.small} 1x, ${form.image} 2x"`:''} alt="${escape(form.alt)}" width="${form.width}" height="${form.height}" decoding="async" draggable="false"></div></figure>`).join('')}<div class="character-live2d" data-character-live2d aria-hidden="true"></div><button type="button" class="character-form-hit" data-character-transform-hit aria-label="${characterHitLabel(initial.id)}" aria-describedby="character-transform-help"></button></div><p class="character-model-caption" data-character-caption>${initial.caption}</p><div class="character-interactions" role="group" aria-label="和画里的 Lucky 互动">${[['pet','摸摸'],['play','逗逗'],['rest','安静陪伴'],['greet','打招呼'],['curious','好奇回应'],['double','两次回应'],['idle','自然待机'],['settle','回到中性']].map(([key,label])=>`<button type="button" data-character-action="${key}" disabled>${label}</button>`).join('')}</div><p class="character-action-status" role="status" aria-live="polite" aria-atomic="true">正在准备 Lucky 的动态形象…</p><div class="character-playback"><button type="button" data-character-pause aria-pressed="false" disabled>暂停动态</button><a href="live2d/licenses.html">动态形象使用条款</a></div></div>
  </section>`;
}
function syncCharacterActions(state=characterMount){
  if(!state||state.destroyed)return;
  const section=state.section,photo=section.dataset.characterForm==='photo';
  const ready=state.player?.ready&&!state.error;
  const paused=state.manualPaused||characterMotion.matches;
  section.querySelectorAll('[data-character-action]').forEach(button=>{button.disabled=!ready||photo||state.busy||paused;});
  const pause=section.querySelector('[data-character-pause]');
  pause.disabled=!ready||photo||state.busy||characterMotion.matches;
  pause.setAttribute('aria-pressed',String(paused));
  pause.textContent=characterMotion.matches?'减少动态已开启':state.manualPaused?'继续动态':'暂停动态';
}
function applyCharacterForm(state,index,moveFocus=false){
  if(state.destroyed)return;
  const section=state.section,form=characterForms[index];
  section.dataset.characterForm=form.id;rememberedCharacterForm=form.id;
  section.querySelectorAll('[data-character-form-tab]').forEach(button=>{
    const selected=Number(button.dataset.characterFormTab)===index;
    button.setAttribute('aria-selected',String(selected));button.tabIndex=selected?0:-1;
    if(selected&&moveFocus)button.focus({preventScroll:true});
  });
  section.querySelectorAll('[data-character-form-slide]').forEach(slide=>{
    const selected=slide.dataset.characterFormSlide===form.id;
    slide.dataset.active=String(selected);slide.setAttribute('aria-hidden',String(!selected||Boolean(state.player?.ready&&form.id!=='photo')));
  });
  section.querySelector('#character-form-panel').setAttribute('aria-labelledby',`character-form-${form.id}`);
  section.querySelector('.character-form-eyebrow').textContent=form.eyebrow;
  section.querySelector('.character-form-copy h2').textContent=form.title;
  section.querySelector('.character-form-description').textContent=form.description;
  section.querySelector('[data-character-transform-hit]').setAttribute('aria-label',characterHitLabel(form.id));
  section.querySelector('[data-character-caption]').textContent=form.caption;
  state.player?.setSuspended(form.id==='photo'||!state.inView);
  window.dispatchEvent(new CustomEvent('lucky:character-form',{detail:{form:form.id}}));
  syncCharacterActions(state);
}
async function selectCharacterForm(index,moveFocus=false){
  const state=characterMount,form=characterForms[index];
  if(!state||state.destroyed||!form)return;
  if(state.busy||state.initializing){state.queued={index,moveFocus};return;}
  if(state.section.dataset.characterForm===form.id){
    if(moveFocus)state.section.querySelector(`[data-character-form-tab="${index}"]`).focus({preventScroll:true});return;
  }
  state.busy=true;const hit=state.section.querySelector('[data-character-transform-hit]');
  hit.setAttribute('aria-busy','true');syncCharacterActions(state);
  const status=state.section.querySelector('.character-action-status');
  try{
    if(state.player?.ready&&form.id!=='photo'){
      state.player.setSuspended(!state.inView);
      await state.player.switchTo(form.id==='human'?'girl':'cat',characterMotion.matches);
    }
    if(state.destroyed)return;
    applyCharacterForm(state,index,moveFocus);
    status.textContent=form.id==='photo'?'这是照片里的 Lucky。选画里的模样，可以和她互动。':state.player?.ready?'换个模样，还是 Lucky。长按摸摸她吧。':'动态形象暂时未加载，当前显示静态参考。';
  }catch{if(!state.destroyed)status.textContent='另一个模样暂时没有加载好，保留当前形象。';}
  finally{
    if(!state.destroyed){state.busy=false;hit.removeAttribute('aria-busy');syncCharacterActions(state);
      const queued=state.queued;state.queued=null;if(queued)void selectCharacterForm(queued.index,queued.moveFocus);}
  }
}
function interactWithCharacter(action,source='manual'){
  const state=characterMount,group=characterGroups[action];
  if(!state||!group||state.busy||state.section.dataset.characterForm==='photo'||!state.player?.ready)return;
  if(!state.player.play(group,source))state.section.querySelector('.character-action-status').textContent=state.manualPaused||characterMotion.matches?'现在静静陪着你。':'动作正在衔接，稍等一下。';
}
function destroyCharacter(){
  const state=characterMount;characterMount=null;if(!state)return;
  state.destroyed=true;state.abort.abort();state.observer?.disconnect();state.clearPress();
  void state.player?.dispose();
}
function mountCharacter(){
  const section=main.querySelector('.character-transform');if(!section)return;
  const state={section,player:null,abort:new AbortController(),destroyed:false,busy:false,initializing:true,queued:null,inView:true,manualPaused:false,error:false};
  characterMount=state;
  const hit=section.querySelector('[data-character-transform-hit]'),status=section.querySelector('.character-action-status');
  let press=null,suppressed=false,suppressedUntil=0;
  state.clearPress=(consume=false)=>{
    if(press){clearTimeout(press.timer);if(consume||press.consumed){suppressed=true;suppressedUntil=performance.now()+1500;}}press=null;
  };
  hit.addEventListener('pointerdown',event=>{
    if(event.button!==0||!event.isPrimary||state.busy)return;
    state.player?.recordUserInput();state.clearPress();suppressed=false;
    const pending={x:event.clientX,y:event.clientY,id:event.pointerId,consumed:false};press=pending;
    pending.timer=setTimeout(()=>{if(press!==pending)return;pending.consumed=true;suppressed=true;interactWithCharacter('pet','longpress');},600);
  });
  hit.addEventListener('pointermove',event=>{if(press&&event.pointerId===press.id&&Math.hypot(event.clientX-press.x,event.clientY-press.y)>12)state.clearPress(true);});
  for(const type of ['pointerup','pointercancel','pointerleave','lostpointercapture'])hit.addEventListener(type,()=>state.clearPress());
  hit.addEventListener('contextmenu',event=>{if(press?.consumed||suppressed&&performance.now()<suppressedUntil)event.preventDefault();});
  hit.addEventListener('pointerenter',event=>{if(event.pointerType==='mouse')state.player?.play('Greet','hover');});
  hit.addEventListener('click',event=>{
    event.stopPropagation();
    if((event.detail>0||event.pointerType)&&suppressed&&(press?.consumed||performance.now()<=suppressedUntil)){suppressed=false;event.preventDefault();return;}
    void selectCharacterForm(section.dataset.characterForm==='cat'?2:1);
  });
  section.querySelector('[data-character-pause]').addEventListener('click',()=>{
    state.manualPaused=!state.manualPaused;state.player?.setPaused(state.manualPaused);syncCharacterActions(state);
    status.textContent=state.manualPaused?'暂停动作，静静陪着你。':'继续轻轻呼吸，陪你一会儿。';
  });
  state.observer=new IntersectionObserver(entries=>{
    state.inView=entries[0].isIntersecting;state.player?.setSuspended(!state.inView||section.dataset.characterForm==='photo');
  },{rootMargin:'80px'});state.observer.observe(section.querySelector('.character-display'));
  void (async()=>{
    try{
      const {createLuckyPlayer}=await import('./live2d/player.js?v=20261020-1');
      const player=await createLuckyPlayer({host:section.querySelector('[data-character-live2d]'),signal:state.abort.signal,initialForm:section.dataset.characterForm==='human'?'girl':'cat',onMotion:({group})=>{
        if(state.destroyed||state.busy||section.dataset.characterForm==='photo')return;
        section.dataset.motion=group;status.textContent=characterLabels[group]||'Lucky 陪着你。';
      },onError:()=>{
        if(state.destroyed)return;state.error=true;section.dataset.live2dState='error';
        section.querySelectorAll('[data-character-form-slide]').forEach(slide=>slide.setAttribute('aria-hidden',String(slide.dataset.active!=='true')));
        status.textContent='动态形象暂时停下了，当前显示静态参考。刷新后可以再试。';syncCharacterActions(state);
      }});
      if(state.destroyed){await player.dispose();return;}
      state.player=player;state.error=false;section.dataset.live2dState='ready';
      applyCharacterForm(state,characterForms.findIndex(form=>form.id===section.dataset.characterForm));
      status.textContent=characterMotion.matches?'减少动态已开启，保留静止模型。':'Lucky 来啦。轻点原地变身，长按摸摸。';
    }catch{
      if(!state.destroyed){state.error=true;section.dataset.live2dState='error';status.textContent='动态形象暂时没有加载，当前显示静态参考。稍后刷新可以再试。';}
    }finally{
      if(!state.destroyed){state.initializing=false;syncCharacterActions(state);const queued=state.queued;state.queued=null;if(queued)void selectCharacterForm(queued.index,queued.moveFocus);}
    }
  })();
}
characterMotion.addEventListener('change',()=>syncCharacterActions());

function renderCharacter() {
  return `<section class="character-view" aria-labelledby="character-title">
    ${renderCharacterTransform()}
    ${renderFeatureStudy()}
    <section class="character-human" aria-labelledby="character-human-title"><header class="character-human-heading"><p class="character-kicker">LUCKY / HUMAN PORTRAIT</p><h2 id="character-human-title" tabindex="-1">Lucky 的拟人设定</h2><p>从第二版坐姿小猫出发，想象她成为猫耳小姑娘的模样。</p></header><div class="character-human-sheet"><figure class="character-human-art"><img src="assets/lucky-human-portrait-display.webp" srcset="assets/lucky-human-portrait-display-1x.webp 1x, assets/lucky-human-portrait-display.webp 2x" alt="Lucky 的水彩绘本风拟人立绘：奶白蓬松长发的猫耳小姑娘，局部烟灰与浅杏发色、粉色鼻尖，穿暖白外套，完整的蓬松灰尖长尾在身侧弯起" width="1024" height="1536" loading="lazy" decoding="async"><figcaption>拟人立绘 · 灵感来自 Lucky 本猫</figcaption></figure><div class="character-human-notes"><p class="character-human-label">CHARACTER NOTES / 01</p><h3>画里也留着她的样子</h3><ul><li><strong>奶白长毛</strong><span>化作蓬松的浅色头发与柔软外套。</span></li><li><strong>烟灰与浅杏</strong><span>只在耳尖、发束和尾巴上轻轻点染。</span></li><li><strong>圆眼与粉鼻</strong><span>保留 Lucky 仰头看人时的稚气。</span></li><li><strong>灰尖长尾</strong><span>完整地绕在身边，像本猫一样醒目。</span></li></ul><div class="character-human-reference"><p>从照片里来的细节</p><div class="character-human-photos"><figure><img src="assets/lucky-photo-05-preview.webp" alt="真实 Lucky 抱住手指，可以看到圆眼睛与粉色小鼻子" width="1280" height="720" loading="lazy"><figcaption>圆眼睛与粉鼻</figcaption></figure><figure><img src="assets/lucky-photo-11-preview.webp" alt="真实 Lucky 背对镜头坐着，奶白长毛上有烟灰与浅杏斑块" width="720" height="1280" loading="lazy"><figcaption>奶白、烟灰与浅杏</figcaption></figure></div></div></div></div>
      <figure class="character-human-detail"><a href="assets/lucky-human-sheet.png" target="_blank" rel="noopener" aria-label="打开 Lucky 拟人设定稿原图，可放大查看（新标签页）"><img src="assets/lucky-human-sheet-display.webp" srcset="assets/lucky-human-sheet-display-1x.webp 1x, assets/lucky-human-sheet-display.webp 2x" alt="Lucky 拟人设定稿，展示人物正面、背面、三种表情，以及烟灰耳尖和灰尖长尾的细节" width="1536" height="1024" loading="lazy" decoding="async"><span>查看完整设定稿 <span aria-hidden="true">→</span></span></a><figcaption>正反面、三种小表情与耳朵、尾巴细节 · 点击图片查看大图</figcaption></figure>
    </section>
    <section class="character-evolution" aria-labelledby="character-evolution-title"><div class="character-evolution-heading"><p class="character-kicker">LUCKY / BEFORE &amp; AFTER</p><h2 id="character-evolution-title">两种画法，都是 Lucky</h2><p>保留最初的站姿版本，也看看现在毛束更柔软的坐姿小猫。</p></div><div class="character-evolution-grid"><figure class="character-evolution-card"><div class="character-evolution-art"><img src="assets/lucky-pixel-idle-small.png" alt="旧版像素 Lucky：奶白长毛小三花四脚站立，灰尖的长尾巴向上弯起" width="1284" height="1225" loading="lazy"></div><figcaption><span class="character-evolution-tag">原版</span><strong>站着探索</strong><span>明快的像素轮廓，保留第一次画下 Lucky 的样子。</span></figcaption></figure><figure class="character-evolution-card character-evolution-card-new"><div class="character-evolution-art"><img src="assets/lucky-cozy-idle-small.png" alt="新版像素 Lucky：奶白长毛小三花安静坐着，烟灰与浅杏斑块、粉鼻和灰尖长尾巴清楚可见" width="1329" height="1183" loading="lazy"></div><figcaption><span class="character-evolution-tag">新版</span><strong>坐着陪伴</strong><span>用成组的小毛束表现柔软长毛，也让耳朵、爪子和尾巴轻轻动起来。</span></figcaption></figure></div></section>
    <div class="character-stickers"><div class="character-stickers-heading"><p class="character-kicker">LUCKY / PIXEL MOMENTS</p><h2>Lucky 的像素小表情</h2><p>抬抬爪，再打个小盹。</p></div><div class="character-sticker-grid"><figure><img src="assets/lucky-cozy-hello-small.png" alt="坐着的像素小三花 Lucky 轻轻抬起前爪，奶白长毛和灰尖尾巴都在身旁" width="512" height="456" loading="lazy"><figcaption>你好呀</figcaption></figure><figure><img src="assets/lucky-cozy-sleep-small.png" alt="闭眼休息的像素小三花 Lucky，奶白长毛和灰尖尾巴围着小小的身体" width="512" height="456" loading="lazy"><figcaption>困困啦</figcaption></figure></div></div>
  </section>`;
}

document.querySelector('.skip-link').addEventListener('click', event => {
  event.preventDefault();
  main.focus();
  main.scrollIntoView({block:'start'});
});
document.querySelector('.site-title').firstChild.textContent = site.title;
document.querySelector('.site-description').textContent = site.description;
document.querySelector('.site-title').setAttribute('aria-label', `${site.title}，首页`);
document.querySelector('.site-footer > p').textContent = `© 2026 · ${site.title}`;

function thumbnail(note, index, album = false) {
  const frame = note.previewFit === 'contain' ? 'object-fit:contain' : `object-position:${note.previewPosition || 'center'}`;
  return `<span class="media-thumbnail ${album ? 'album-thumbnail' : ''}"><img class="${album ? '' : 'post-thumbnail'}" src="${escape(note.previewPhoto || note.photo)}" alt="${escape(note.alt)}" width="${note.width}" height="${note.height}" style="${escape(frame)}" ${index > 0 ? 'loading="lazy"' : ''}>${note.video ? `<span class="video-badge">视频 ${escape(note.duration)}</span>` : ''}</span>`;
}
function pauseInlineVideos() {
  main.querySelectorAll('video').forEach(element => element.pause());
}
function render() {
  destroyCharacter();
  if (dialog.open) closePhoto();
  imageObserver?.disconnect();
  pauseInlineVideos();
  destroyAlbum();
  const route = location.hash === '#main' ? '/' : (location.hash.slice(1) || '/');
  if (lastRoute === '/notes' && route !== '/notes') {
    journalScrollY = window.scrollY;
    journalReturnNoteId = route.startsWith('/note/') ? route.slice('/note/'.length) : '';
  }
  if (route.startsWith('/note/') && lastRoute !== '/notes' && !lastRoute.startsWith('/note/')) journalReturnNoteId = '';
  document.querySelectorAll('[data-nav]').forEach(link => link.removeAttribute('aria-current'));
  const navKey = route === '/' || route === '/photos' ? 'photos' : route === '/character' ? 'character' : route === '/growth' ? 'growth' : 'notes';
  const navLink = document.querySelector(`[data-nav="${navKey}"]`);
  navLink.setAttribute('aria-current', 'page');
  // Focus lands on <main> after every route change, so the region needs a name or a
  // screen reader just announces "main" with no idea which view it landed in.
  if (navLink) main.setAttribute('aria-label', navLink.textContent.replace(/\s+/g, ' ').trim());
  if (route === '/' || route === '/photos') {
    document.title = `${site.title} · 贴纸小相册`;
    main.innerHTML = renderAlbum();
    mountAlbum(main,openPhoto);
  } else if (route === '/character') {
    document.title = `Lucky 的虚拟形象 · ${site.title}`;
    main.innerHTML = deferOffscreenImages(renderCharacter());
    mountCharacter();
  } else if (route === '/growth') {
    document.title = `Lucky 的成长观察 · ${site.title}`;
    main.innerHTML = deferOffscreenImages(renderGrowth());
  } else if (route === '/notes') {
    document.title = `${site.title} · Lucky 的日记`;
    const noteById = new Map(notes.map(note => [note.id, note]));
    let journalIndex = 0;
    const sections = journalGroups.map((group, groupIndex) => {
      const items = group.ids.map(id => noteById.get(id)).filter(Boolean);
      const chapter = String(groupIndex + 1).padStart(2, '0');
      return `<section class="journal-section ${groupIndex === 0 ? 'journal-section--opening' : 'journal-section--standard'}" aria-labelledby="journal-chapter-${chapter}"><header class="journal-section-heading"><span class="journal-section-number" aria-hidden="true">${chapter}</span><div><p class="journal-section-kicker">CHAPTER ${chapter} / ${String(journalGroups.length).padStart(2,'0')}</p><h2 id="journal-chapter-${chapter}" tabindex="-1">${escape(group.title)}</h2><p class="journal-section-description">${escape(group.description)}</p></div><span class="journal-section-count">${String(items.length).padStart(2, '0')} 个片段</span></header><div class="post-list">${items.map(note => {
        const index = journalIndex++;
        return `<article class="post-item"><a class="post-link" href="#/note/${escape(note.id)}"><div class="post-info"><div class="post-overline"><span>NO. ${String(index + 1).padStart(2, '0')}</span>${sharedCollectionDate ? `<span class="post-format">${duration(note)}</span>` : `<time datetime="${note.date}">收录于 ${dateText(note.date)}</time>`}</div><h3 class="post-title">${escape(note.title)}</h3><p class="post-description">${escape(note.description)}</p></div>${thumbnail(note,index)}</a></article>`;
      }).join('')}</div></section>`;
    }).join('');
    main.innerHTML = deferOffscreenImages(`<section class="journal-view"><header class="journal-heading"><p class="eyebrow">LUCKY / LITTLE NOTES</p><h1>把普通日子，写成小小的一页。</h1><p>从夜里的窗边，到沙发上的小睡。Lucky 的每一个瞬间，都有自己的位置。</p><span>${notes.length} 个片段 · ${albumCount}${sharedCollectionDate ? ` · 收录于 ${dateText(sharedCollectionDate)}` : ''}</span></header><nav class="journal-index" aria-label="跳转到日记章节"><span>按主题翻阅</span>${journalGroups.map((group,index) => `<button type="button" data-journal-jump="journal-chapter-${String(index+1).padStart(2,'0')}">${escape(group.title)} <span aria-hidden="true">→</span></button>`).join('')}</nav><div class="journal-sections">${sections}</div></section>`);
  } else {
    const note = notes.find(n => route === `/note/${n.id}`);
    if (note) {
      document.title = `${note.title} · ${site.title}`;
      const readingIndex = journalSequence.indexOf(note);
      const chapter = journalGroups.find(group => group.ids.includes(note.id)) || {title:'Lucky 的日记'};
      const adjacent = (item, label, direction) => item
        ? `<a class="note-adjacent" href="#/note/${escape(item.id)}" aria-label="${label}：${escape(item.title)}"><span>${label} ${direction}</span><strong>${escape(item.title)}</strong></a>`
        : '<a class="note-adjacent note-adjacent-all" href="#/notes"><span>所有的小片段</span><strong>回到 Lucky 的日记 →</strong></a>';
      const media = note.video
        ? `<video class="note-video" controls playsinline preload="none" poster="${escape(note.photo)}" width="${note.width}" height="${note.height}" aria-label="${escape(note.alt)}"><source src="${escape(note.video)}" type="video/mp4">无法播放视频，<a href="${escape(note.video)}">打开视频文件</a>。</video><button class="expand-video" data-photo="${notes.indexOf(note)}" type="button">放大观看</button>`
        : `<button type="button" class="photo-button" data-photo="${notes.indexOf(note)}" aria-label="查看大图：${escape(note.caption)}"><img class="note-photo" src="${escape(note.photo)}" alt="${escape(note.alt)}"></button>`;
      main.innerHTML = `<article class="note-view"><a class="back-link note-back" href="#/notes">← 返回日记</a><div class="note-spread"><header class="note-copy"><p class="note-kicker">${escape(chapter.title)} <span aria-hidden="true">/</span> ${String(readingIndex+1).padStart(2,'0')}—${journalSequence.length}</p><h1 class="note-title">${escape(note.title)}</h1><div class="note-meta"><time datetime="${note.date}">收录于 ${dateText(note.date)}</time><span>${duration(note)}</span></div></header><figure class="note-photo-block">${media}${note.originalPhoto ? `<a class="original-download" href="${escape(note.originalPhoto)}" download>下载相册原始 HEIC</a>` : ''}<figcaption class="photo-caption">${escape(note.caption)}</figcaption></figure><div class="note-body">${note.paragraphs.map(p => `<p>${escape(p)}</p>`).join('')}<span class="note-signature" aria-hidden="true">Lucky's little moment.</span></div></div><nav class="note-pagination" aria-label="继续读日记">${adjacent(journalSequence[readingIndex-1],'上一篇','←')}${adjacent(journalSequence[readingIndex+1],'下一篇','→')}</nav></article>`;
    } else {
      document.title = `未找到日记 · ${site.title}`;
      main.innerHTML = '<h1 class="note-title">这篇日记还没有写。</h1><a class="back-link" href="#/notes">返回日记</a>';
    }
  }
  mountImages();
  if (lastRoute && route !== lastRoute) {
    const returningToJournal = route === '/notes' && lastRoute.startsWith('/note/') && journalReturnNoteId;
    window.scrollTo(0,0);
    main.focus({preventScroll:true});
    if (returningToJournal) window.requestAnimationFrame(() => {
      const item = [...main.querySelectorAll('.post-link')].find(link => link.getAttribute('href') === `#/note/${journalReturnNoteId}`);
      item?.focus({preventScroll:true});
      window.scrollTo(0,journalScrollY);
    });
  }
  lastRoute = route;
}

function updatePhoto() {
  const note = activeSequence[activePhoto];
  originalDownload.hidden = !note.originalPhoto;
  if (note.originalPhoto) originalDownload.href = note.originalPhoto;
  else originalDownload.removeAttribute('href');
  video.pause();
  video.removeAttribute('src');
  video.hidden = !note.video;
  image.hidden = !!note.video;
  // The full-size viewer always uses the complete original, at every density.
  image.removeAttribute('srcset');
  if (note.video) {
    video.poster = note.photo;
    video.src = note.video;
    video.setAttribute('aria-label', note.alt);
    video.width = note.width;
    video.height = note.height;
    image.removeAttribute('src');
  } else {
    image.src = note.photo;
    image.alt = note.alt;
  }
  // The record already carries its intrinsic size, so the media box can be reserved
  // before the file decodes instead of snapping to shape underneath the visitor.
  image.width = note.width;
  image.height = note.height;
  video.load();
  dialog.querySelector('.lightbox-caption').textContent = note.caption;
  document.querySelector('#media-note-link').href = `#/note/${note.id}`;
  document.querySelector('#photo-position').textContent = `${activePhoto + 1} / ${activeSequence.length}`;
  document.querySelector('#previous-photo').disabled = activePhoto === 0;
  document.querySelector('#next-photo').disabled = activePhoto === activeSequence.length - 1;
}
function openPhoto(index,button,sequence=notes) {
  const note = notes[index];
  if (!note) return;
  pauseInlineVideos();
  activeSequence = sequence.includes(note) ? sequence : notes;
  activePhoto = activeSequence.indexOf(note);
  lastPhotoButton = button;
  updatePhoto();
  dialog.showModal();
  dialog.querySelector('.close-button')?.focus({preventScroll:true});
  document.documentElement.classList.add('modal-open');
}
function closePhoto() {
  video.pause();
  video.removeAttribute('src');
  video.load();
  dialog.close();
  document.documentElement.classList.remove('modal-open');
  if (lastPhotoButton?.isConnected) lastPhotoButton.focus({preventScroll:true});
}
main.addEventListener('click', event => {
  const action = event.target.closest('[data-character-action]');
  if (action) { interactWithCharacter(action.dataset.characterAction); return; }
  const formTab = event.target.closest('[data-character-form-tab]');
  if (formTab) { selectCharacterForm(Number(formTab.dataset.characterFormTab)); return; }
  const featureButton = event.target.closest('[data-feature]');
  if (featureButton) { selectCharacterFeature(Number(featureButton.dataset.feature)); return; }
  const growthJump = event.target.closest('[data-growth-jump]');
  if (growthJump) {
    const target = document.getElementById(growthJump.dataset.growthJump);
    target?.focus({preventScroll:true});
    target?.scrollIntoView({behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',block:'start'});
    return;
  }
  const journalJump = event.target.closest('[data-journal-jump]');
  if (journalJump) {
    const target = document.getElementById(journalJump.dataset.journalJump);
    target?.focus({preventScroll:true});
    target?.scrollIntoView({behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',block:'start'});
    return;
  }
  if (event.target.closest('[data-character-human-jump]')) {
    event.preventDefault();
    const target = main.querySelector('#character-human-title');
    if (target) {
      target.focus({preventScroll:true});
      target.scrollIntoView({behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',block:'start'});
    }
    return;
  }
  const button = event.target.closest('[data-photo]');
  if (button) openPhoto(Number(button.dataset.photo),button);
  const growthButton = event.target.closest('[data-growth-photo]');
  if (growthButton) openPhoto(notes.indexOf(growthNotes[Number(growthButton.dataset.growthPhoto)]),growthButton,growthNotes);
});
main.addEventListener('keydown', event => {
  const formTab = event.target.closest('[data-character-form-tab]');
  if (formTab && ['ArrowLeft','ArrowRight','Home','End'].includes(event.key)) {
    event.preventDefault();
    const index = Number(formTab.dataset.characterFormTab);
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? characterForms.length-1
      : (index+(event.key==='ArrowRight'?1:-1)+characterForms.length)%characterForms.length;
    selectCharacterForm(next,true);
    return;
  }
  const featureButton = event.target.closest('[data-feature]');
  if (!featureButton || !['ArrowLeft','ArrowRight','Home','End'].includes(event.key)) return;
  event.preventDefault();
  const index = Number(featureButton.dataset.feature);
  const next = event.key === 'Home' ? 0 : event.key === 'End' ? characterFeatures.length-1
    : (index + (event.key === 'ArrowRight' ? 1 : -1) + characterFeatures.length) % characterFeatures.length;
  selectCharacterFeature(next, true);
});
dialog.querySelector('.close-button').addEventListener('click',closePhoto);
document.querySelector('#media-note-link').addEventListener('click',closePhoto);
dialog.addEventListener('cancel', event => { event.preventDefault(); closePhoto(); });
dialog.addEventListener('click', event => { if (event.target === dialog) closePhoto(); });
document.querySelector('#previous-photo').addEventListener('click', () => { if(activePhoto > 0) { activePhoto--; updatePhoto(); } });
document.querySelector('#next-photo').addEventListener('click', () => { if(activePhoto < activeSequence.length - 1) { activePhoto++; updatePhoto(); } });
dialog.addEventListener('keydown', event => {
  // Native video controls use arrows for seeking and volume.
  if(event.target.closest('video')) return;
  if(event.key === 'ArrowLeft' && activePhoto > 0) {event.preventDefault(); activePhoto--;updatePhoto();}
  if(event.key === 'ArrowRight' && activePhoto < activeSequence.length - 1) {event.preventDefault(); activePhoto++;updatePhoto();}
});
window.addEventListener('hashchange',render);
render();
