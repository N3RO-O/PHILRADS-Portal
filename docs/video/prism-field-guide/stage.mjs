// Paints the field guide at any time t (seekable, no timers): real PRISM screens in a phone, eased
// screen transitions, a camera that pushes in on each tap, infographic callouts that point at the
// control being used, kinetic chapter titles and colour sweeps between chapters.
import { tips, labels } from './scenes.mjs';
import { finger } from './illustrations.mjs';
import { videoPlan } from './plan.mjs';

const params = new URLSearchParams(location.search);
const short = params.get('clip') || '';
const wide = params.has('wide');
const plan = videoPlan(Boolean(short), short);
const root = document.querySelector('.composition');
const $ = (selector) => root.querySelector(selector);
root.classList.toggle('wide', wide);
root.dataset.width = wide ? '1920' : '1080';
root.dataset.height = wide ? '1080' : '1920';
root.dataset.duration = plan.seconds;
const audio = $('#field-guide-mix');
if (short) {
  audio.src = `assets/clip-mixes/${short}.m4a`;
  audio.dataset.duration = plan.seconds;
}

// Geometry. Screens are 390 × 844 CSS pixels under a 47 px status bar.
const SW = 390;
const SH = 844;
const STATUS = 47;
const L = wide
  ? { s: .9, bezel: 11, x: 1352, y: 128, labelX: 930, labelW: 360, side: 'left', zoom: .1, labelMin: 170, labelMax: 900 }
  : { s: 1.18, bezel: 12, x: 96, y: 352, labelX: 652, labelW: 330, side: 'right', zoom: .12, labelMin: 420, labelMax: 1440 };
const DW = SW * L.s + L.bezel * 2;
const DH = (SH + STATUS) * L.s + L.bezel * 2;
root.style.setProperty('--s', L.s);
root.style.setProperty('--bezel', `${L.bezel}px`);
root.style.setProperty('--dw', `${DW}px`);
root.style.setProperty('--dh', `${DH}px`);
root.style.setProperty('--status', `${STATUS * L.s}px`);

const n = {
  layer: $('.device-layer'), device: $('.device'), screen: $('.screen'), a: $('.shot-a'), b: $('.shot-b'), os: $('.os-layer'),
  glare: $('.glare'), focus: $('.focus'), touch: $('.touch'), ring: $('.touch-ring'), leader: $('.leader'), anchor: $('.anchor'),
  callout: $('.callout'), step: $('.callout-step'), text: $('.callout-text'), captions: $('.captions'), count: $('.count'),
  kicker: $('.chapter .kicker'), heading: $('.chapter h1'), context: $('.chapter p'), accent: $('.accent'), big: $('.big-number'),
  rail: $('.rail'), sweep: [...root.querySelectorAll('.sweep i')], beams: $('.beams'), prism: $('.prism-stage'), tipsBox: $('.tips'),
  shadow: $('.device-shadow'), example: $('.example'),
};
n.layer.style.left = `${L.x}px`;
n.layer.style.top = `${L.y}px`;
n.touch.innerHTML = finger;
const rays = [...root.querySelectorAll('.ray')];
const jobs = [...root.querySelectorAll('.job')];
const letters = [...root.querySelectorAll('.brand-word span')];

const load = async (url, fallback) => {
  const response = await fetch(url).catch(() => null);
  return response?.ok ? response.json() : fallback;
};
const shots = await load('assets/app/shots.json', {});
const allCaptions = await load('assets/captions.json', {});
const captions = allCaptions[short || 'main'] ?? {};

// The phone's own screens, drawn (they aren't part of PRISM).
const statusBar = (light = false) => `<div class="os-status${light ? ' light' : ''}"><b>9:41</b><span>▮▮▮ ◠ ▰</span></div>`;
const os = {
  'os:browser': {
    marks: { share: [156, 792, 48, 40] },
    html: () => `<div class="os-browser"><div class="url">philrads-portal.vercel.app</div><img src="assets/app/signin.jpg" alt=""><div class="toolbar"><i>‹</i><i>›</i><i class="share">⇪</i><i>▢</i><i>⧉</i></div></div>`,
  },
  'os:share': {
    marks: { add: [16, 716, 358, 51] },
    html: () => `<div class="os-browser"><div class="url">philrads-portal.vercel.app</div><img src="assets/app/signin.jpg" alt=""><div class="toolbar"><i>‹</i><i>›</i><i class="share">⇪</i><i>▢</i><i>⧉</i></div></div>
      <div class="os-dim"></div><div class="os-sheet"><div class="sheet-head"><img src="assets/prism-icon.svg" alt=""><div><b>PRISM · PHILRADS</b><small>philrads-portal.vercel.app</small></div></div>
      <div class="sheet-row">Copy</div><div class="sheet-row">Add to Reading List</div><div class="sheet-row">Add Bookmark</div><div class="sheet-row hot">Add to Home Screen <span>⊞</span></div><div class="sheet-row">Find on Page</div></div>`,
  },
  'os:home': {
    marks: { icon: [291, 222, 80, 100] },
    html: () => `<div class="os-home">${Array.from({ length: 11 }, (_, i) => `<span class="app a${i % 5}"></span>`).join('')}<span class="app prism-app"><img src="assets/prism-icon.svg" alt=""><small>PRISM</small></span><div class="dock"><span class="app a1"></span><span class="app a3"></span><span class="app a2"></span><span class="app a4"></span></div></div>`,
  },
};
const sheets = new Set(['quick', 'bell', 'bell-unread', 'account', 'account-status', 'drawer', 'finish', 'finish-photo', 'task-detail', 'newtask', 'newtask-typed',
  'map-share', 'inv-item', 'inv-export', 'docs-up', 'res-more', 'profile-crop', 'badges', 'whatsnew', 'staff-invite', 'welcome', 'map-place']);
const marksOf = (id) => (id.startsWith('os:') ? os[id]?.marks : shots[id]?.marks) ?? {};
const pathOf = (id) => (id.startsWith('os:') ? id : shots[id]?.path ?? id);

// Easing
const clamp = (x) => Math.min(1, Math.max(0, x));
const out3 = (x) => 1 - (1 - clamp(x)) ** 3;
const inOut = (x) => { x = clamp(x); return x < .5 ? 4 * x * x * x : 1 - (-2 * x + 2) ** 3 / 2; };
const back = (x) => { x = clamp(x); const c = 1.4; return 1 + (c + 1) * (x - 1) ** 3 + c * (x - 1) ** 2; };
const lerp = (a, b, t) => a + (b - a) * t;

// Timeline index: every beat knows its phases and the shot before it.
for (const chapter of plan.chapters) {
  let previous = null;
  chapter.beats.forEach((beat, i) => {
    beat.index = i;
    beat.captions = captions[beat.id] ?? [[0.2, beat.seconds - 0.1, beat.speech]];
    beat.phases = beat.shots.map(([start, shot, tap, transition], k) => ({
      start: start * beat.seconds,
      end: (beat.shots[k + 1]?.[0] ?? 1) * beat.seconds,
      shot, tap, transition,
      label: labels[tap ? `${shot}:${tap}` : shot] ?? beat.cue,
      prev: k ? beat.shots[k - 1][1] : previous,
      prevTap: k ? beat.shots[k - 1][2] : null,
    }));
    if (beat.shots.length) previous = beat.shots.at(-1)[1];
    else previous = null;
  });
}

// Rail: one segment per chapter.
n.rail.innerHTML = plan.chapters.map(() => '<i><b></b></i>').join('');
const railBars = [...n.rail.querySelectorAll('b')];

// Preload every screen so seeking never shows an empty phone.
const used = new Set(plan.chapters.flatMap((c) => c.beats.flatMap((b) => b.shots.map((s) => s[1]))).concat(tips.map((t) => t[0])));
const srcOf = (id) => `assets/app/${id}.jpg`;
await Promise.all([...used].filter((id) => !id.startsWith('os:')).map((id) => new Promise((ok) => {
  const image = new Image();
  image.onload = image.onerror = () => ok();
  image.src = srcOf(id);
})));

let lastChapter = null;
let lastOs = '';
let wordSpans = [];
function setChapter(chapter) {
  if (chapter === lastChapter) return;
  lastChapter = chapter;
  const index = plan.chapters.indexOf(chapter) + 1;
  const words = chapter.title.replace('&amp;', '&').split(' ');
  n.heading.innerHTML = words.map((w) => `<span class="w"><span>${w.replace('&', '&amp;')}</span></span>`).join(' ');
  wordSpans = [...n.heading.querySelectorAll('.w > span')];
  n.heading.classList.toggle('compact', chapter.title.length > 23);
  n.context.textContent = chapter.context;
  n.kicker.textContent = short ? 'PRISM field guide' : `Chapter ${String(index).padStart(2, '0')} of ${plan.chapters.length}`;
  n.count.textContent = short ? 'PRISM' : `${String(index).padStart(2, '0')} / ${plan.chapters.length}`;
  n.big.textContent = String(index).padStart(2, '0');
  if (tipsHost(chapter)) buildTips();
}
const tipsHost = (chapter) => chapter.beats.some((b) => b.effect === 'tips');
let tipsBuilt = false;
function buildTips() {
  if (tipsBuilt) return;
  tipsBuilt = true;
  n.tipsBox.innerHTML = tips.map(([id, label], i) => `<div class="tip"><div class="tip-phone"><img src="${srcOf(id)}" alt=""></div><div class="tip-label"><b>0${i + 1}</b><span>${label}</span></div></div>`).join('');
}

// A point in the screenshot (CSS px) → composition px, given the camera.
function toStage(x, y, cam) {
  const lx = L.bezel + x * L.s;
  const ly = L.bezel + (STATUS + y) * L.s;
  return { x: L.x + cam.tx + lx * cam.z, y: L.y + cam.ty + ly * cam.z, lx, ly };
}

function setShot(img, id) {
  if (!id || id.startsWith('os:')) { img.style.opacity = 0; return; }
  const src = srcOf(id);
  if (img.getAttribute('src') !== src) img.setAttribute('src', src);
}

function paintTransition(phase, tt) {
  const { shot, prev } = phase;
  const kind = !prev || prev === shot ? 'none'
    : phase.transition || (shot.startsWith('os:') || prev.startsWith('os:') ? 'fade'
      : sheets.has(shot) && !sheets.has(prev) ? 'rise'
        : sheets.has(prev) && !sheets.has(shot) ? 'sink'
          : sheets.has(prev) && sheets.has(shot) ? 'fade'
            : pathOf(prev) === pathOf(shot) ? 'fade' : 'push');
  const dur = kind === 'wipe' ? 1.1 : kind === 'push' ? .55 : .42;
  const p = inOut(tt / dur);
  const A = n.a;
  const B = n.b;
  setShot(A, prev);
  setShot(B, shot);
  for (const el of [A, B]) { el.style.transform = ''; el.style.opacity = 1; el.style.clipPath = ''; el.style.zIndex = 1; }
  B.style.zIndex = 2;
  let osOpacity = 0;
  const osId = shot.startsWith('os:') ? shot : prev?.startsWith('os:') ? prev : '';
  if (osId !== lastOs) { n.os.innerHTML = osId ? os[osId].html() : ''; lastOs = osId; }
  if (kind === 'none' || p >= 1) {
    A.style.opacity = 0;
    if (shot.startsWith('os:')) { B.style.opacity = 0; osOpacity = 1; }
  } else if (kind === 'push') {
    B.style.transform = `translateX(${(1 - p) * 100}%)`;
    A.style.transform = `translateX(${-p * 30}%)`;
    A.style.opacity = 1 - p * .6;
  } else if (kind === 'rise') {
    B.style.opacity = p;
    B.style.transform = `translateY(${(1 - p) * 9}%)`;
  } else if (kind === 'sink') {
    A.style.zIndex = 3;
    A.style.opacity = 1 - p;
    A.style.transform = `translateY(${p * 9}%)`;
  } else if (kind === 'wipe') {
    const r = marksOf(shot)[phase.tap];
    if (r) {
      const [x, y, w, h] = r;
      const right = 100 - ((x + w * p) / SW) * 100;
      B.style.clipPath = `inset(${(y / SH) * 100}% ${right}% ${100 - ((y + h) / SH) * 100}% ${(x / SW) * 100}%)`;
    } else B.style.opacity = p;
  } else {
    B.style.opacity = p;
    if (shot.startsWith('os:')) { B.style.opacity = 0; osOpacity = p; }
    else if (prev.startsWith('os:')) osOpacity = 1 - p;
  }
  n.os.style.opacity = osOpacity;
  n.os.style.zIndex = 4;
  return { kind, p };
}

function paintPrism(time, seconds, fade) {
  rays.forEach((ray, i) => {
    const portion = out3((time - (i ? 0.67 + i * 0.12 : 0)) / (i ? 0.79 : 1.02));
    ray.style.strokeDasharray = '1';
    ray.style.strokeDashoffset = String(1 - portion);
  });
  $('.spectrum').style.opacity = String(out3((time - .9) / .9) * .22);
  jobs.forEach((label, i) => {
    const a = out3((time - (1.18 + i * .17)) / .55);
    label.style.opacity = a;
    label.style.transform = `translateX(${(1 - a) * -14}px)`;
  });
  letters.forEach((letter, i) => {
    const a = back((time - (0.58 + i * .12)) / .7);
    letter.style.opacity = clamp((time - (0.58 + i * .12)) / .3);
    letter.style.transform = `translateY(${(1 - a) * 60}px)`;
  });
  $('.brand-by').style.opacity = out3((time - 1.6) / .9);
  $('.src').style.opacity = out3((time - .3) / .5);
  const line = out3((time - 1.75) / .8);
  const bridge = $('.brand-line');
  bridge.style.opacity = clamp((time - 1.65) / .4);
  bridge.querySelector('i').style.transform = `scaleX(${line})`;
  bridge.querySelector('em').style.opacity = clamp((time - 2.4) / .4) * (.65 + .35 * Math.sin(time * 5));
  const note = out3((time - 2.0) / .7);
  $('.brand-note').style.opacity = note;
  $('.brand-note').style.transform = `translateY(${(1 - note) * 20}px)`;
  $('.brand-word .p').style.textShadow = `0 0 ${28 + Math.sin(clamp(time / seconds) * Math.PI) * 32}px #ef433882`;
  n.prism.style.opacity = fade;
}

function paintTips(elapsed) {
  [...n.tipsBox.children].forEach((tip, i) => {
    const t = elapsed - (.2 + i * .55);
    const a = back(t / .6);
    tip.style.opacity = clamp(t / .3);
    tip.style.transform = `translateY(${(1 - a) * 80}px) scale(${.9 + .1 * a})`;
    tip.querySelector('b').style.transform = `scale(${.6 + .4 * back((t - .2) / .5)})`;
  });
}

function paint(time) {
  const seconds = Math.min(Math.max(time, 0), plan.seconds - .0001);
  const chapter = plan.chapters.findLast((c) => seconds + 1e-5 >= c.start);
  const within = seconds - chapter.start;
  const beat = chapter.beats.findLast((b) => within + 1e-5 >= b.start);
  const elapsed = Math.max(0, within - beat.start);
  const ci = plan.chapters.indexOf(chapter);
  setChapter(chapter);

  // Background: slow beams, drifting chapter number.
  n.beams.style.transform = `rotate(${-18 + Math.sin(seconds * .07) * 5}deg) translateX(${Math.sin(seconds * .05) * 40}px)`;
  n.big.style.transform = `translate(${-within * 6}px, ${Math.sin(seconds * .2) * 10}px)`;
  n.big.style.opacity = .9 * out3(within / 1.2);

  // Header: words rise in at each chapter start.
  wordSpans.forEach((w, i) => {
    const a = out3((within - .15 - i * .07) / .6);
    w.style.transform = `translateY(${(1 - a) * 110}%)`;
  });
  const k = out3((within - .05) / .5);
  n.kicker.style.opacity = k;
  n.kicker.style.transform = `translateX(${(1 - k) * -30}px)`;
  const c = out3((within - .45) / .6);
  n.context.style.opacity = c;
  n.context.style.transform = `translateY(${(1 - c) * 18}px)`;
  n.accent.style.transform = `scaleX(${out3((within - .55) / .7)})`;

  // Rail
  railBars.forEach((bar, i) => { bar.style.transform = `scaleX(${i < ci ? 1 : i > ci ? 0 : within / chapter.seconds})`; });

  // Colour sweep across each chapter cut.
  const next = plan.chapters[ci + 1];
  const boundary = within < .5 && ci > 0 ? chapter.start : next && next.start - seconds < .5 ? next.start : null;
  n.sweep.forEach((bar, i) => {
    if (boundary === null) { bar.style.transform = 'translateX(-160%) skewX(-14deg)'; return; }
    const u = (seconds - boundary + .5) / 1 - i * .06;
    bar.style.transform = `translateX(${lerp(-160, 160, inOut(u))}%) skewX(-14deg)`;
  });

  // Special beats: the logo and the four habits.
  const special = beat.effect === 'prism' || beat.effect === 'tips';
  const prevBeat = chapter.beats[beat.index - 1];
  const handoff = special && prevBeat?.phases.length && elapsed < .45;
  n.prism.classList.toggle('hidden', beat.effect !== 'prism');
  n.tipsBox.classList.toggle('hidden', beat.effect !== 'tips');
  if (beat.effect === 'prism') paintPrism(elapsed, beat.seconds, handoff ? out3((elapsed - .1) / .35) : 1);
  if (beat.effect === 'tips') paintTips(elapsed);

  // Captions
  n.captions.textContent = beat.captions.find(([a, b]) => elapsed >= a && elapsed < b)?.[2] ?? '';

  // The phone.
  let phase;
  let tt = 0;
  if (beat.phases.length) {
    phase = beat.phases.findLast((p) => elapsed + 1e-5 >= p.start);
    tt = elapsed - phase.start;
  } else if (handoff) {
    const last = prevBeat.phases.at(-1);
    phase = { ...last, prev: null, tap: '' };
    tt = 99;
  }
  const hasPhone = Boolean(phase);
  n.layer.style.visibility = hasPhone ? 'visible' : 'hidden';
  n.shadow.style.visibility = hasPhone ? 'visible' : 'hidden';
  if (!hasPhone) {
    hideCallout();
    return;
  }
  paintTransition(phase, tt);

  // Phone entrance at a chapter start (or after the logo), exit into the logo.
  const enterAt = beat.index === 0 || (prevBeat && !prevBeat.phases.length) ? beat.start : null;
  const enter = enterAt === null ? 1 : back((within - enterAt - .1) / .8);
  const leave = handoff ? inOut(elapsed / .4) : 0;
  const avail = phase.end - phase.start;
  const box = phase.tap ? marksOf(phase.shot)[phase.tap] : null;
  const cx = box ? box[0] + box[2] / 2 : SW / 2;
  const cy = box ? box[1] + box[3] / 2 : SH / 2;

  // Camera: the whole phone stays in frame, so every screen is seen in full. It only floats gently,
  // and scales a little on its way in and out of a chapter (around its own centre).
  const drift = Math.sin(seconds * .5) * 6;
  const z = (.92 + .08 * enter) * (1 - .08 * leave);
  const cam = { tx: DW / 2 * (1 - z), ty: DH / 2 * (1 - z) + drift + (1 - enter) * 160 + leave * 60, z };
  n.layer.style.transform = `translate(${cam.tx}px, ${cam.ty}px) scale(${cam.z}) rotate(${(1 - enter) * 4}deg)`;
  n.layer.style.opacity = clamp(enter * 1.6) * (1 - leave);
  n.shadow.style.transform = n.layer.style.transform;
  n.shadow.style.opacity = n.layer.style.opacity;
  n.glare.style.transform = `translateX(${lerp(-130, 130, inOut((within - (enterAt ?? -9) - .4) / 1.2))}%) skewX(-18deg)`;

  // Error shake
  n.screen.style.transform = beat.effect === 'error' && elapsed < .5 ? `translateX(${Math.sin(elapsed * 42) * (1 - elapsed / .5) * 10}px)` : '';

  // Focus box, finger and ripple (inside the phone layer, so they move with the camera).
  const contact = Math.min(.7, avail * .5);
  if (box && !handoff) {
    const [x, y, w, h] = box;
    const f = out3((tt - .1) / .4) * (1 - inOut((tt - (avail - .25)) / .25));
    const pad = 6;
    n.focus.style.opacity = f;
    n.focus.style.left = `${L.bezel + (x - pad) * L.s}px`;
    n.focus.style.top = `${L.bezel + (STATUS + y - pad) * L.s}px`;
    n.focus.style.width = `${(w + pad * 2) * L.s}px`;
    n.focus.style.height = `${(h + pad * 2) * L.s}px`;
    n.focus.style.transform = `scale(${1.25 - .25 * out3((tt - .1) / .45)})`;
    const travel = out3(tt / contact);
    const release = out3((tt - contact - .1) / .45);
    const fade = clamp(tt / .15) * (1 - release) * (avail > .55 ? 1 : 0);
    const px = L.bezel + cx * L.s;
    const py = L.bezel + (STATUS + cy) * L.s;
    const swipe = beat.effect === 'swipe' && beat.phases.indexOf(phase) === 0 ? out3((tt - contact) / .5) * 110 : 0;
    const off = wide ? 17 : 22;
    n.touch.style.opacity = fade;
    n.touch.style.transform = `translate(${px - off + (1 - travel + release) * 90 + swipe}px, ${py - off + (1 - travel + release) * 70}px) scale(${1 - Math.sin(clamp(tt / contact) * Math.PI) * .05})`;
    const ripple = clamp((tt - contact) / .55);
    n.ring.style.opacity = tt < contact ? 0 : (1 - ripple) * .95;
    n.ring.style.transform = `translate(${px - 21 + swipe}px, ${py - 21}px) scale(${.4 + ripple * 1.4})`;
    paintCallout(beat, chapter, phase, tt, cam, cx, cy, box, elapsed);
  } else {
    n.focus.style.opacity = 0;
    n.touch.style.opacity = 0;
    n.ring.style.opacity = 0;
    paintCallout(beat, chapter, phase, tt, cam, null, null, null, elapsed, handoff);
  }
}

function hideCallout() {
  n.callout.style.opacity = 0;
  n.leader.style.opacity = 0;
  n.anchor.style.opacity = 0;
}

// The label beside the phone, with a leader line to the control.
let labelText = '';
function paintCallout(beat, chapter, phase, tt, cam, cx, cy, box, elapsed, handoff = false) {
  if (handoff) { hideCallout(); return; }
  const text = phase.label ?? beat.cue;
  if (text !== labelText) {
    labelText = text;
    n.text.textContent = text;
    n.step.textContent = short ? `Step ${beat.index + 1}` : `${String(plan.chapters.indexOf(chapter) + 1).padStart(2, '0')}.${beat.index + 1}`;
  }
  const a = out3((elapsed - .1) / .5) * (1 - inOut((elapsed - (beat.seconds - .3)) / .3));
  const prevBox = phase.prev && phase.prevTap ? marksOf(phase.prev)[phase.prevTap] : null;
  const target = box ? toStage(cx, cy, cam) : null;
  const before = prevBox ? toStage(prevBox[0] + prevBox[2] / 2, prevBox[1] + prevBox[3] / 2, cam) : null;
  const restY = L.y + DH * .42;
  const goalY = target ? target.y : restY;
  const fromY = before ? before.y : goalY;
  const y = Math.min(L.labelMax, Math.max(L.labelMin, lerp(fromY, goalY, inOut(tt / .45))));
  const h = n.callout.offsetHeight;
  n.callout.style.left = `${L.labelX}px`;
  n.callout.style.width = `${L.labelW}px`;
  n.callout.style.top = `${y - h / 2}px`;
  n.callout.style.opacity = a;
  n.callout.style.transform = `translateX(${(1 - a) * (L.side === 'right' ? 40 : -40)}px)`;
  if (!target) {
    n.leader.style.opacity = 0;
    n.anchor.style.opacity = 0;
    return;
  }
  const edgeX = target.x + (L.side === 'right' ? 1 : -1) * Math.min(box[2] * L.s * cam.z / 2, 60);
  const labelEdge = L.side === 'right' ? L.labelX - 14 : L.labelX + L.labelW + 14;
  const elbow = L.side === 'right' ? Math.max(edgeX + 30, labelEdge - 46) : Math.min(edgeX - 30, labelEdge + 46);
  n.leader.setAttribute('d', `M${edgeX} ${target.y} H${elbow} L${labelEdge} ${y}`);
  n.leader.setAttribute('pathLength', '1');
  const draw = out3((tt - .15) / .5) * a;
  n.leader.style.strokeDasharray = '1';
  n.leader.style.strokeDashoffset = String(1 - draw);
  n.leader.style.opacity = a;
  n.anchor.setAttribute('cx', edgeX);
  n.anchor.setAttribute('cy', target.y);
  n.anchor.style.opacity = a * clamp((tt - .1) / .2);
  n.anchor.setAttribute('r', String(6 + Math.sin(tt * 6) * 1.2));
}

window.prism = {
  paint,
  plan: plan.chapters.map((chapter) => ({ id: chapter.id, start: chapter.start, seconds: chapter.seconds,
    frames: Array.from({ length: Math.round(chapter.seconds * 30) + 1 }, (_, i) => i) })),
  seconds: plan.seconds,
};
const cursor = { seconds: 0 };
const timeline = gsap.timeline({ paused: true });
timeline.to(cursor, { seconds: plan.seconds, duration: plan.seconds, ease: 'none', onUpdate: () => paint(cursor.seconds) });
window.__timelines ??= {};
window.__timelines['prism-guide'] = timeline;
await document.fonts.ready;
paint(0);
window.prism.ready = true;
