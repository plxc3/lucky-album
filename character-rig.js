export const SPRITES = Object.freeze({
  idle: 'assets/lucky-cozy-idle-small.png',
  blink: 'assets/lucky-cozy-blink-small.png',
  hello: 'assets/lucky-cozy-hello-small.png',
  play: 'assets/lucky-cozy-play-small.png',
  sleep: 'assets/lucky-cozy-sleep-small.png'
});

// These shapes sit inside the 1329 × 1183 illustration. Moving parts are
// removed from the base first, so their old outlines do not remain as ghosts.
// A small patch of the existing foreleg fur sits behind each lifted paw.
const ART = Object.freeze({
  earLeft: 'M 314 319 Q 318 228 347 192 Q 375 194 421 262 L 432 335 Q 387 363 337 347 Z',
  earRight: 'M 680 319 Q 696 215 732 169 Q 768 204 789 291 L 778 347 Q 734 360 680 319 Z',
  chest: 'M 443 744 Q 461 679 569 654 Q 691 647 747 711 Q 781 785 747 859 Q 674 903 531 880 Q 454 857 443 744 Z',
  pawLeft: 'M 414 987 Q 452 960 517 992 Q 556 1031 552 1102 Q 536 1126 477 1118 Q 426 1122 408 1081 Q 394 1048 414 987 Z',
  pawRight: 'M 580 985 Q 628 963 698 994 Q 735 1023 748 1105 Q 733 1140 659 1132 Q 604 1139 578 1106 Q 560 1049 580 985 Z',
  tail: 'M 890 1075 C 940 1030 978 981 984 930 C 1005 845 995 786 973 727 C 960 665 948 610 932 575 L 900 550 L 900 515 L 900 470 L 900 423 L 905 371 L 950 347 L 1007 335 L 1125 365 L 1215 450 L 1260 600 L 1275 750 L 1245 910 L 1180 1025 L 1080 1115 L 990 1140 Z',
  eyeLeft: 'M 375 420 Q 408 373 483 374 Q 548 383 559 450 Q 554 518 483 526 Q 408 520 375 471 Z',
  eyeRight: 'M 595 413 Q 630 363 697 370 Q 767 385 773 449 Q 760 515 691 521 Q 621 514 595 471 Z'
});
export function catRig(prefix, lazy = false) {
  const source = lazy ? 'data-href' : 'href';
  const partClip = name => `<clipPath id="${prefix}-${name}"><path d="${ART[name]}"/></clipPath>`;
  const partImage = (name, className, src=SPRITES.idle) => `<g class="${className}" clip-path="url(#${prefix}-${name})"><image ${source}="${src}" width="1329" height="1183"/></g>`;
  const moving = ['earLeft','earRight','chest','pawLeft','pawRight','tail'];
  const pawBacking = ['pawLeft','pawRight'].map(name=>`<g class="lucky-pet-paw-backing" clip-path="url(#${prefix}-${name})"><g clip-path="url(#${prefix}-foreleg-limit)"><image ${source}="${SPRITES.idle}" y="145" width="1329" height="1183"/></g></g>`).join('');
  return `<svg class="lucky-pet-rig" viewBox="0 0 1329 1183" preserveAspectRatio="xMidYMid meet" role="img" aria-label="奶白长毛、烟灰浅杏斑块和灰尖长尾的坐姿小三花 Lucky"><defs>${[...moving,'eyeLeft','eyeRight'].map(partClip).join('')}<clipPath id="${prefix}-foreleg-limit"><rect width="1329" height="1058"/></clipPath><mask id="${prefix}-cat-base-mask" maskUnits="userSpaceOnUse" x="0" y="0" width="1329" height="1183" style="mask-type:luminance"><rect width="1329" height="1183" fill="white"/>${moving.map(name=>`<path d="${ART[name]}" fill="black"/>`).join('')}</mask></defs>${partImage('tail','lucky-pet-tail')}<image class="lucky-pet-base" ${source}="${SPRITES.idle}" width="1329" height="1183" mask="url(#${prefix}-cat-base-mask)"/>${pawBacking}${partImage('earLeft','lucky-pet-ear-left')}${partImage('earRight','lucky-pet-ear-right')}${partImage('chest','lucky-pet-chest')}${partImage('pawLeft','lucky-pet-paw-left')}${partImage('pawRight','lucky-pet-paw-right')}${partImage('eyeLeft','lucky-pet-blink',SPRITES.blink)}${partImage('eyeRight','lucky-pet-blink',SPRITES.blink)}</svg>`;
}

// The same cutout rule keeps the girl's head, hands, and tail from doubling
// when they move. This remains an illustration rig, not a Cubism model.
const HUMAN_PARTS = {
  head:'M 254 150 Q 226 103 310 81 L 596 0 Q 656 80 700 171 Q 790 236 804 409 L 841 575 Q 740 623 660 554 L 581 423 Q 496 430 421 447 L 350 553 Q 253 572 239 454 Q 211 349 254 150 Z',
  handLeft:'M 527 629 Q 553 606 583 619 Q 611 640 596 681 Q 561 702 536 684 Z',
  handRight:'M 642 617 Q 668 603 689 625 Q 708 650 680 680 Q 649 674 642 651 Z',
  tail:'M 142 934 Q 196 893 286 909 Q 352 943 362 1001 Q 350 1068 284 1105 L 266 1152 Q 322 1186 307 1243 Q 274 1279 227 1244 Q 155 1208 145 1150 Q 90 1119 113 1024 Z',
};
export function humanRig(prefix, lazy=false) {
  const source=lazy?'data-href':'href', image='assets/lucky-human-portrait-display.webp';
  return `<svg class="lucky-human-rig" viewBox="0 0 1024 1536" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Lucky 的猫耳女孩形态，奶白长发、烟灰浅杏点染与灰尖长尾"><defs>${Object.entries(HUMAN_PARTS).map(([name,path])=>`<clipPath id="${prefix}-human-${name}"><path d="${path}"/></clipPath>`).join('')}<mask id="${prefix}-human-base-mask" maskUnits="userSpaceOnUse" x="0" y="0" width="1024" height="1536" style="mask-type:luminance"><rect width="1024" height="1536" fill="white"/>${Object.values(HUMAN_PARTS).map(path=>`<path d="${path}" fill="black"/>`).join('')}</mask></defs><image class="lucky-human-base" ${source}="${image}" width="1024" height="1536" mask="url(#${prefix}-human-base-mask)"/>${['handLeft','handRight'].map(name=>`<g class="lucky-human-hand-backing" clip-path="url(#${prefix}-human-${name})"><image ${source}="${image}" x="-60" width="1024" height="1536"/></g>`).join('')}${Object.keys(HUMAN_PARTS).map(name=>`<g class="lucky-human-${name}" clip-path="url(#${prefix}-human-${name})"><image ${source}="${image}" width="1024" height="1536"/></g>`).join('')}</svg>`;
}
