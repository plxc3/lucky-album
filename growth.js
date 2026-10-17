// Reading themes describe visible evidence, never an inferred shooting order.
// Every one of the 54 collected records is placed in exactly one theme, so the
// growth view reflects the whole album rather than a curated dozen.
export const growthThemes = [
  {
    id:'outline', label:'01 / 身形与长尾', title:'小小一团，也能伸得长长的',
    description:'航空箱里收着小爪，柜边伸展身子，沙发上竖起灰尖长尾，书本边垂下一条蓬松的尾巴。换个姿势，奶白长毛下的轮廓也跟着变化。',
    ids:[
      'lucky-in-the-carrier','lucky-reaching-toward-the-desk','lucky-tail-up-on-the-sofa-back',
      'lucky-crouching-on-a-chair','lucky-by-the-floral-cushion','lucky-curled-up',
      'lucky-stretched-out-on-the-floral-mat','lucky-tail-outside-the-yellow-bag','lucky-resting-on-a-book',
    ],
  },
  {
    id:'paws', label:'02 / 小爪与回应', title:'手伸过来，小爪也伸过去',
    description:'抱住一根手指、碰一碰梳子、跟着手掌抬爪，还有椅垫上探身伸爪的片段。照片与视频，留下了这些手边的小互动。',
    ids:[
      'lucky-holding-a-finger','lucky-pouncing-on-the-chair','lucky-reaching-for-a-hand-on-the-sofa',
      'lucky-touching-a-finger-at-keyboard','lucky-little-paws','lucky-hiding-the-face',
      'lucky-and-the-pink-brush','lucky-playing-on-a-lap',
    ],
  },
  {
    id:'explore', label:'03 / 走动与探索', title:'家里的小角落，都在镜头里',
    description:'在敞开的箱门旁走动，靠近沙发布边，绕过猫抓柱，还有柜边的一次翻身。完整视频留着，能看清她怎样经过这些地方。',
    ids:[
      'lucky-exploring','lucky-walking-beside-the-sofa','lucky-among-the-sofa-toys',
      'lucky-walking-among-plush-toys','lucky-circling-the-scratcher','lucky-following-a-toy-by-the-scratcher',
      'lucky-at-the-mushroom-scratcher','lucky-by-the-sofa-cover','lucky-rolling-by-the-cabinet',
    ],
  },
  {
    id:'peek', label:'04 / 探头与张望', title:'在布褶、绿叶和桌沿间探头',
    description:'布褶边、包口、绿叶后、桌沿下，也有航空箱里的近景。眼睛和鼻尖露在画面中，探头、抬眼与转身都有自己的模样。',
    ids:[
      'lucky-peeking-by-the-sofa-fold','lucky-peeking-out-of-the-yellow-bag','lucky-peeking-through-the-plants',
      'lucky-peeking-under-the-table','lucky-peeking-over-the-table','lucky-looking-up',
      'lucky-looking-up-at-the-carrier-door','lucky-inside-the-clear-carrier','lucky-turning-in-the-carrier',
    ],
  },
  {
    id:'corners', label:'05 / 窗边、窝与日常一角', title:'窗、小窝与碗边的日常',
    description:'夜里亮着灯的窗、黄色小窝、粉白猫砂盆，还有桌面的杯壶和碗边的小脑袋。屋里的这些角落，也留在了相册里。',
    ids:[
      'lucky-at-the-night-window','lucky-window-corner','lucky-playing-by-the-window-plants',
      'lucky-in-the-yellow-bed','lucky-in-the-litter-box','lucky-looking-beside-the-cups','lucky-at-the-bowl',
    ],
  },
  {
    id:'together', label:'06 / 被陪伴的时刻', title:'有人在旁边，这件事本身就值得记',
    description:'小脸埋在肩头，横窝在怀里，躺在白色垫子上被手轻扶。平板、手机和身旁的手，也和三花背影一起留在画面中。',
    ids:[
      'lucky-nestled-on-a-shoulder','lucky-in-an-outdoor-hug','lucky-on-the-care-table',
      'lucky-beside-the-tablet','lucky-reaching-up-beside-a-phone','lucky-sitting-beside-a-phone','lucky-fluffy-back',
    ],
  },
  {
    id:'quiet', label:'07 / 抬头、逗猫棒与小睡', title:'张望、玩耍，也有安静睡姿',
    description:'抬头望笼顶的小鸟，在椅脚旁与小鸟同框，在沙发上望向蓝色羽毛。贴着鼻尖的小爪和四脚朝天的睡姿，则留下了闭眼休息的样子。',
    ids:[
      'lucky-watching-the-bird','lucky-curled-up-with-paws-by-her-face','lucky-sleeping-on-the-back',
      'lucky-and-a-small-neighbor','lucky-and-the-blue-feather',
    ],
  },
];

const collectionCopy = {
  '2026-10-09': {title:'先把这些小日子留下',description:'航空箱里的眼神、抱住手指的小爪，还有窗边与小窝。第一批入册的照片和视频，留下她的模样。'},
  '2026-10-15': {title:'多一些角度，多一些陪伴',description:'补入肩头、黄包、书桌和睡姿的照片，也收下椅垫上伸爪与探头的两个小片段。'},
  '2026-10-16': {title:'把小动作也收进来',description:'这次补入的视频里，有沙发边走动、窗边跃起、跟着手掌抬爪和玩偶间探身。静态画面之外，也能听见原声、看见完整动作。'},
};

export function buildCollectionTimeline(records) {
  const dates = [...new Set(records.map(note => note.date))].sort();
  let total = 0;
  return dates.map(date => {
    const items = records.filter(note => note.date === date);
    const videos = items.filter(note => note.video).length;
    total += items.length;
    return {date,items,videos,photos:items.length-videos,total,
      ...(collectionCopy[date] || {title:'又收下一些小日子',description:'新放进相册的照片与视频，继续留在这份手记里。'})};
  });
}

// The album's own intake curve: how many records existed after each collection
// date. This is the only growth-shaped series the material supports, because it
// counts what was added on a known date rather than implying a measured body
// size. Returns chart-ready points plus the figures the caption must agree with.
export function buildIntakeSeries(records) {
  const timeline = buildCollectionTimeline(records);
  const max = timeline.at(-1)?.total || 1;
  const step = timeline.length > 1 ? 1 / (timeline.length - 1) : 0;
  return {
    max,
    points: timeline.map((batch, i) => ({
      date: batch.date,
      total: batch.total,
      added: batch.items.length,
      videos: batch.videos,
      photos: batch.photos,
      x: +(i * step).toFixed(4),
      y: +(batch.total / max).toFixed(4),
    })),
  };
}

// The themes are a reading order over the whole album, so a record that is not
// in any theme would silently disappear from the growth view.
export function findThemeGaps(records, themes = growthThemes) {
  const used = themes.flatMap(theme => theme.ids);
  const seen = new Set();
  const duplicates = used.filter(id => seen.has(id) ? true : (seen.add(id), false));
  const missing = records.map(note => note.id).filter(id => !seen.has(id));
  const unknown = used.filter(id => !records.some(note => note.id === id));
  return {used, duplicates, missing, unknown};
}
