export const SPRITES = Object.freeze({
  idle: 'assets/lucky-cozy-idle-small.png',
  blink: 'assets/lucky-cozy-blink-small.png',
  hello: 'assets/lucky-cozy-hello-small.png',
  play: 'assets/lucky-cozy-play-small.png',
  sleep: 'assets/lucky-cozy-sleep-small.png'
});

// These shapes sit inside the 1329 × 1183 illustration. The full idle image
// stays opaque beneath them; animation never cuts holes through Lucky.
const ART = Object.freeze({
  earLeft: 'M 314 319 Q 318 228 347 192 Q 375 194 421 262 L 432 335 Q 387 363 337 347 Z',
  earRight: 'M 680 319 Q 696 215 732 169 Q 768 204 789 291 L 778 347 Q 734 360 680 319 Z',
  chest: 'M 443 744 Q 461 679 569 654 Q 691 647 747 711 Q 781 785 747 859 Q 674 903 531 880 Q 454 857 443 744 Z',
  pawLeft: 'M 432 984 Q 475 950 536 977 Q 558 1020 547 1084 Q 501 1103 448 1081 Q 424 1040 432 984 Z',
  pawRight: 'M 590 978 Q 641 946 704 974 Q 735 1018 717 1083 Q 665 1104 609 1082 Q 587 1047 590 978 Z',
  tail: 'M 954 452 Q 1012 392 1090 400 Q 1167 412 1188 482 Q 1194 554 1153 648 Q 1097 674 1036 632 Q 987 585 954 452 Z',
  eyeLeft: 'M 375 420 Q 408 373 483 374 Q 548 383 559 450 Q 554 518 483 526 Q 408 520 375 471 Z',
  eyeRight: 'M 595 413 Q 630 363 697 370 Q 767 385 773 449 Q 760 515 691 521 Q 621 514 595 471 Z'
});
export function catRig(prefix, lazy = false) {
  const source = lazy ? 'data-href' : 'href';
  const partClip = name => `<clipPath id="${prefix}-${name}"><path d="${ART[name]}"/></clipPath>`;
  const partImage = (name, className, src=SPRITES.idle) => `<g class="${className}" clip-path="url(#${prefix}-${name})"><image ${source}="${src}" width="1329" height="1183"/></g>`;
  return `<svg class="lucky-pet-rig" viewBox="0 0 1329 1183" preserveAspectRatio="xMidYMid meet" role="img" aria-label="奶白长毛、烟灰浅杏斑块和灰尖长尾的坐姿小三花 Lucky"><defs>${['earLeft','earRight','chest','pawLeft','pawRight','tail','eyeLeft','eyeRight'].map(partClip).join('')}</defs><image class="lucky-pet-base" ${source}="${SPRITES.idle}" width="1329" height="1183"/>${partImage('tail','lucky-pet-tail')}${partImage('earLeft','lucky-pet-ear-left')}${partImage('earRight','lucky-pet-ear-right')}${partImage('chest','lucky-pet-chest')}${partImage('pawLeft','lucky-pet-paw-left')}${partImage('pawRight','lucky-pet-paw-right')}${partImage('eyeLeft','lucky-pet-blink',SPRITES.blink)}${partImage('eyeRight','lucky-pet-blink',SPRITES.blink)}</svg>`;
}

// Keep the complete existing portrait below its small, independently moving
// details. These are restrained illustration gestures, not new generated poses.
const HUMAN_PARTS = {
  head:'M 254 150 Q 226 103 310 81 L 596 0 Q 656 80 700 171 Q 790 236 804 409 L 841 575 Q 740 623 660 554 L 581 423 Q 496 430 421 447 L 350 553 Q 253 572 239 454 Q 211 349 254 150 Z',
  handLeft:'M 527 629 Q 553 606 583 619 Q 611 640 596 681 Q 561 702 536 684 Z',
  handRight:'M 642 617 Q 668 603 689 625 Q 708 650 680 680 Q 649 674 642 651 Z',
  tail:'M 142 934 Q 196 893 286 909 Q 352 943 362 1001 Q 350 1068 284 1105 L 266 1152 Q 322 1186 307 1243 Q 274 1279 227 1244 Q 155 1208 145 1150 Q 90 1119 113 1024 Z',
};
export function humanRig(prefix, lazy=false) {
  const source=lazy?'data-href':'href', image='assets/lucky-human-portrait-display.webp';
  return `<svg class="lucky-human-rig" viewBox="0 0 1024 1536" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Lucky 的猫耳女孩形态，奶白长发、烟灰浅杏点染与灰尖长尾"><defs>${Object.entries(HUMAN_PARTS).map(([name,path])=>`<clipPath id="${prefix}-human-${name}"><path d="${path}"/></clipPath>`).join('')}</defs><image ${source}="${image}" width="1024" height="1536"/>${Object.keys(HUMAN_PARTS).map(name=>`<g class="lucky-human-${name}" clip-path="url(#${prefix}-human-${name})"><image ${source}="${image}" width="1024" height="1536"/></g>`).join('')}</svg>`;
}
