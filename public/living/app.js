// The living encyclopedia: camera (AR) mode, a no-camera showcase, the book map, lecture mode
// with a phone remote, a field-test mode and a few keepsakes (stamps, certificates, photos).
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { EXPERIENCES, PAGES, PACKS, toAr } from './experiences.js?v=14';
import { PAGE_H, FX, sweepBand, ease, fontsReady, syncLines } from './kit.js?v=14';
import { sfx, unlockAudio, isMuted, setMuted } from './sound.js?v=14';
import { captureWorkers, installFast, stopPack } from './fast.js?v=14';

const $ = (id) => document.getElementById(id);
const asset = (path) => new URL(path, import.meta.url).href;
const hex = (c) => '#' + c.toString(16).padStart(6, '0');
// Arabic counting: one page, two pages, 3–10 pages, 11 pages and up.
const livePages = (n) => n === 1 ? 'صفحة حيّة واحدة' : n === 2 ? 'صفحتين حيّتين' : n <= 10 ? `${toAr(n)} صفحات حيّة` : `${toAr(n)} صفحة حيّة`;
const params = new URLSearchParams(location.search);
const TEST = params.has('test');
// The public app is AR only: without the camera nothing runs. `?dev`, `?lecture` and `?remote` keep the no-camera views for the author.
const DEV = params.has('dev') || params.has('lecture') || !!params.get('remote');
if (!DEV) document.body.classList.add('arOnly');
const PEERJS = 'https://cdn.jsdelivr.net/npm/peerjs@1.5.4/+esm';
const QRCODE = 'https://cdn.jsdelivr.net/npm/qrcode@1.5.4/+esm';

const TYPES = {
  infographic: { c: '#b5202f', svg: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>' },
  model: { c: '#2a7fd0', svg: '<path d="m12 3 8 4.5v9L12 21l-8-4.5v-9L12 3Z"/><path d="m12 12 8-4.5M12 12v9M12 12 4 7.5"/>' },
  hotspots: { c: '#1fa5a0', svg: '<circle cx="12" cy="12" r="3"/><circle cx="12" cy="12" r="8" opacity=".5"/>' },
  animation: { c: '#e0861f', svg: '<circle cx="12" cy="12" r="9"/><path d="m10 8.5 5.5 3.5-5.5 3.5v-7Z" fill="currentColor"/>' },
  game: { c: '#d62b3a', svg: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.4" fill="currentColor"/>' },
  quiz: { c: '#8a5bb5', svg: '<path d="M9.2 9a3 3 0 1 1 4.3 2.7c-.9.5-1.5 1.2-1.5 2.3M12 17.5h.01"/><circle cx="12" cy="12" r="9.5"/>' },
  timeline: { c: '#2f6fa8', svg: '<rect x="3" y="6" width="18" height="12" rx="2.5"/><path d="M8 3l4 3 4-3M17 10v4"/>' },
  ladder: { c: '#3f8f45', svg: '<path d="M12 3 4 20h16L12 3Z"/><path d="M7.5 13h9M9.5 9h5M6 17h12"/>' },
  lab: { c: '#c2457a', svg: '<path d="M9 3h6M10 3v6l-5 9a2 2 0 0 0 1.8 3h10.4a2 2 0 0 0 1.8-3l-5-9V3"/><path d="M7.5 15h9"/>' },
  portal: { c: '#3b57d6', svg: '<path d="m12 2 8.5 5v10L12 22l-8.5-5V7L12 2Z"/><path d="m12 7 4.3 2.5v5L12 17l-4.3-2.5v-5L12 7Z"/>' },
  exploded: { c: '#d8322f', svg: '<rect x="8" y="3" width="9" height="15" rx="2"/><path d="M5 6v15h9"/>' },
  assemble: { c: '#7a4fd0', svg: '<path d="M9 4h6M7 9h10M5 14h14M3 19h18"/>' },
  balance: { c: '#1f9d7a', svg: '<path d="M12 3v18M7 21h10M4 7h16M4 7l-2.5 6h5L4 7ZM20 7l-2.5 6h5L20 7Z"/>' },
  roleplay: { c: '#e0861f', svg: '<circle cx="8" cy="8" r="3"/><circle cx="16" cy="9" r="2.5"/><path d="M3 20c0-3.5 2.2-6 5-6s5 2.5 5 6M13 20c.3-3 1.6-5 3-5 2 0 4 2 4 5"/>' },
  branching: { c: '#c99a3b', svg: '<path d="M12 21v-7M12 14 6 8M12 14l6-6M12 14V5"/><circle cx="6" cy="6" r="2"/><circle cx="18" cy="6" r="2"/><circle cx="12" cy="4" r="2"/>' },
  welcome: { c: '#a9832f', svg: '<path d="M12 3l2.6 5.6 6 .7-4.5 4.1 1.2 6L12 16.4 6.7 19.4l1.2-6L3.4 9.3l6-.7L12 3Z"/>' },
  secret: { c: '#8b1d2c', svg: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>' },
};
const icon = (type) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${TYPES[type].svg}</svg>`;

// The book's structure (page numbers here only group pages on the map; recognition never uses them).
const DOORS = {
  1: { t: 'الباب الأول', s: 'مفهوم تكنولوجيا التعليم' },
  2: { t: 'الباب الثاني', s: 'الحاسب والتعليم الإلكتروني' },
  3: { t: 'الباب الثالث', s: 'مستحدثات ومنصات تعليمية' },
  4: { t: 'الباب الرابع', s: 'المعلم والتكنولوجيا' },
};
const CHAPTERS = [
  [1, 26, "مفاهيم أساسية في تكنولوجيا التعليم"],
  [1, 64, "تاريخ تكنولوجيا التعليم وتطور مفهومها"],
  [1, 108, "التعليم والاتصال التعليمي"],
  [1, 134, "التصميم التعليمي"],
  [1, 176, "نظريات التعلم ونماذجه"],
  [2, 224, "الحاسب الآلي التعليمي"],
  [2, 240, "التعليم الإلكتروني والتعليم عن بُعد"],
  [2, 268, "نماذج التعليم الإلكتروني: السحابة والفصل المقلوب والكتاب الإلكتروني"],
  [3, 286, "الواقع الافتراضي والمعزز والتقنيات ثلاثية الأبعاد"],
  [3, 310, "الألعاب التعليمية والتلعيب والسبورة التفاعلية"],
  [3, 330, "الشبكات والمنصات التعليمية"],
  [3, 366, "الأجهزة الذكية في التعليم"],
  [4, 392, "القرن الحادي والعشرون والتعليم"],
  [4, 408, "مستويات بلوم وتكنولوجيا التعليم"],
  [4, 418, "الفجوة الرقمية"],
  [4, 434, "من التعلم التقليدي إلى التعلم التفاعلي"],
  [4, 452, "التكنولوجيا كأداة للتغيير"]
];
const pageNum = (x) => parseInt(x.page.slice(1), 10);
const chapterOf = (x) => CHAPTERS.filter(([d, start]) => d === x.door && pageNum(x) >= start).pop();

// ------------------------------------------------------------ stamps (kept on the device only)
const STAMP_KEY = 'living-encyclopedia:stamps';
function readStamps() { try { return new Set(JSON.parse(localStorage.getItem(STAMP_KEY) || '[]')); } catch { return new Set(); } }
function writeStamps(s) { try { localStorage.setItem(STAMP_KEY, JSON.stringify([...s])); } catch { /* private mode */ } }
let stamps = readStamps();
const doorPages = (d) => PAGES.filter((x) => x.door === d);
const foundOf = (list) => list.filter((x) => stamps.has(x.id)).length;
const doorDone = (d) => doorPages(d).length > 0 && foundOf(doorPages(d)) >= Math.ceil(doorPages(d).length * 0.6);
const LIVE_DOORS = [...new Set(PAGES.map((x) => x.door))].sort();
// The secret page opens when any one door is complete; it reports the door closest to completion.
function secretProgress() {
  const best = LIVE_DOORS.map((d) => ({ done: foundOf(doorPages(d)), total: doorPages(d).length })).sort((a, b) => b.done / b.total - a.done / a.total)[0];
  return { done: best.done, total: best.total };
}

// ------------------------------------------------------------ home
function renderHome() {
  $('grid').innerHTML = PAGES.map((x, i) => `
    <button class="card" data-i="${i}">
      <div class="thumb"><img src="${asset(`./thumbs/${x.page}.jpg`)}" alt="" loading="lazy"></div>
      <div class="meta">
        <span class="badge" style="background:${TYPES[x.type].c}">${icon(x.type)}${x.typeLabel}</span>
        <h3>${x.title}</h3>
        <span class="page">${DOORS[x.door].t} · ${chapterOf(x)[2]}</span>
      </div>
      ${stamps.has(x.id) ? '<span class="stamp" title="اكتشفتها">✦</span>' : ''}
    </button>`).join('');
  const n = foundOf(PAGES);
  const done = LIVE_DOORS.filter(doorDone);
  $('progress').innerHTML = !n ? '' : `✦ اكتشفت ${toAr(n)} من ${toAr(PAGES.length)} صفحة` + done.map((d) => ` · <button class="link" data-cert="${d}">شهادة ${DOORS[d].t}</button>`).join('');
  $('progress').querySelectorAll('[data-cert]').forEach((b) => (b.onclick = () => openCertificate(+b.dataset.cert)));
  $('grid').querySelectorAll('.card').forEach((b) => (b.onclick = () => startShowcase(EXPERIENCES.indexOf(PAGES[+b.dataset.i]))));
  document.querySelector('.section .sub').textContent = `${toAr(PAGES.length)} صفحة حيّة حتى الآن، ولكل صفحة تجربة. المس أي بطاقة لتشاهدها بدون كتاب.`;
}

// ------------------------------------------------------------ the book map
function renderMap() {
  $('mapProgress').textContent = `اكتشفت ${toAr(foundOf(PAGES))} من ${toAr(PAGES.length)} صفحة حيّة`;
  $('mapBody').innerHTML = Object.entries(DOORS).map(([d, door]) => {
    d = +d;
    const chapters = CHAPTERS.filter(([cd]) => cd === d).map(([, start, title]) => {
      const pages = PAGES.filter((x) => x.door === d && chapterOf(x)?.[1] === start);
      const stars = pages.length
        ? pages.map((x) => `<button class="star ${stamps.has(x.id) ? 'found' : ''}" data-open="${x.id}">✦ ${x.title}</button>`).join('')
        : '<span class="star soon">قريباً</span>';
      return `<div class="chap"><b>${title}</b>${stars}</div>`;
    }).join('');
    const pack = PACKS.find((p) => p.ids.some((id) => EXPERIENCES.find((x) => x.id === id)?.door === d));
    const buttons = [
      pack ? `<button class="btn btn-gold" data-pack="${pack.id}">افتح الكاميرا على هذا الباب</button>` : '',
      doorDone(d) ? `<button class="btn btn-line" data-cert="${d}">شهادة الباب</button>` : '',
    ].join('');
    const count = doorPages(d).length;
    return `<section class="door"><h3>${door.t}</h3><div class="meta">${door.s} · ${count ? `${toAr(foundOf(doorPages(d)))} من ${livePages(count)}` : 'صفحاته الحيّة قادمة'}</div>${chapters}<div class="row">${buttons}</div></section>`;
  }).join('');
  $('mapBody').querySelectorAll('[data-open]').forEach((b) => (b.onclick = () => { closeMap(); startShowcase(EXPERIENCES.findIndex((x) => x.id === b.dataset.open)); }));
  $('mapBody').querySelectorAll('[data-pack]').forEach((b) => (b.onclick = () => { closeMap(); switchPack(b.dataset.pack); }));
  $('mapBody').querySelectorAll('[data-cert]').forEach((b) => (b.onclick = () => openCertificate(+b.dataset.cert)));
}
function openMap() { renderMap(); $('map').classList.add('on'); sfx.tap(); }
function closeMap() { $('map').classList.remove('on'); }

// ------------------------------------------------------------ overlay UI shared by all experiences
let toastTimer, captionTimer;
const ui = {
  card({ tag = '', title = '', body = '', color = 0xd4ad55 }) {
    const s = $('sheet');
    s.querySelector('.tag').textContent = tag;
    s.querySelector('h3').textContent = title;
    s.querySelector('p').textContent = body;
    s.querySelector('.accent').style.background = hex(color);
    s.classList.add('on');
    sfx.discover();
  },
  hideCard() { $('sheet').classList.remove('on'); },
  hud(text) { const h = $('hud'); h.textContent = text; h.classList.toggle('hidden', !text); },
  caption(text) {
    const c = $('caption');
    c.classList.remove('hidden'); c.classList.add('swap');
    clearTimeout(captionTimer);
    captionTimer = setTimeout(() => { c.textContent = text; c.classList.remove('swap'); }, 180);
  },
  choices(list) {
    const box = $('choices'); box.innerHTML = '';
    list.forEach((o) => {
      const b = document.createElement('button');
      b.textContent = o.label;
      if (o.primary) b.className = 'primary';
      if (o.color) b.style.background = o.color;
      b.onclick = (ev) => { ev.stopPropagation(); sfx.tap(); o.onPick(); };
      box.appendChild(b);
    });
    lecture.sendState();
  },
  slider({ label, value = 0, onInput }) {
    const box = $('slider');
    box.querySelector('span').textContent = label;
    const input = box.querySelector('input');
    input.value = Math.round(value * 100);
    input.oninput = () => { box.style.setProperty('--v', input.value + '%'); onInput(input.value / 100); };
    box.style.setProperty('--v', input.value + '%');
    box.classList.remove('hidden');
  },
  hideSlider() { $('slider').classList.add('hidden'); },
  toast(text) {
    const t = $('toast'); t.textContent = text; t.classList.add('on');
    clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('on'), 1800);
  },
  done() {
    const exp = current?.exp; if (!exp || current.stamped || exp.kind !== 'page') return;
    current.stamped = true;
    const first = !stamps.has(exp.id);
    stamps.add(exp.id); writeStamps(stamps);
    const pages = doorPages(exp.door);
    $('stampLbl').textContent = first ? `اكتشفت هذه الصفحة · ${toAr(foundOf(pages))} من ${toAr(pages.length)} في ${DOORS[exp.door].t}` : 'أكملت هذه الصفحة مرة أخرى';
    const fx = $('stampFx'); fx.classList.remove('on'); void fx.offsetWidth; fx.classList.add('on');
    sfx.stamp();
    navigator.vibrate?.([20, 40, 30]);
    if (first && doorDone(exp.door)) setTimeout(() => {
      ui.toast(`أكملت ${DOORS[exp.door].t}! والصفحة السرّية فُتحت لك…`);
      ui.choices([{ label: '✦ احصل على شهادتك', primary: true, onPick: () => openCertificate(exp.door) }]);
    }, 2700);
  },
  certificate() { openCertificate(LIVE_DOORS.find(doorDone) || 1); },
  reset() {
    this.hideCard(); this.hud(''); this.choices([]); this.hideSlider();
    $('caption').classList.add('hidden'); $('caption').textContent = '';
  },
};
$('sheet').querySelector('.x').onclick = () => ui.hideCard();

// ------------------------------------------------------------ one running page experience
let current = null;
let activeCanvas = null;

function lights(stage, ar) {
  const sun = new THREE.DirectionalLight(0xfff1dc, ar ? 2.0 : 2.2);
  sun.position.set(-0.55, 1.25, 0.45);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  const cam = sun.shadow.camera; cam.left = cam.bottom = -0.9; cam.right = cam.top = 0.9; cam.near = 0.1; cam.far = 3;
  sun.shadow.bias = -0.0008; sun.shadow.radius = 4;
  stage.add(sun, sun.target);
  if (ar) {
    const catcher = new THREE.Mesh(new THREE.PlaneGeometry(1.2, PAGE_H * 1.1), new THREE.ShadowMaterial({ opacity: 0.22 }));
    catcher.rotation.x = -Math.PI / 2; catcher.position.y = 0.0006; catcher.receiveShadow = true;
    stage.add(catcher);
  }
}

const pageInfo = () => doorPages(1).map((x) => ({ ...x, typeColor: TYPES[x.type].c, typeColorHex: parseInt(TYPES[x.type].c.slice(1), 16) }));

function startExperience(index, root, camera, mode) {
  stopExperience();
  ui.reset();
  const exp = EXPERIENCES[index];
  // outer: page-aligned space with the lights; pivot: turns and scales around the scene's center.
  const outer = new THREE.Group(); outer.rotation.x = Math.PI / 2; root.add(outer);
  const [cu, cv] = exp.center || [0.5, 0.6];
  const center = new THREE.Vector3(cu - 0.5, 0, (cv - 0.5) * PAGE_H);
  const pivot = new THREE.Group(); pivot.position.copy(center); outer.add(pivot);
  const stage = new THREE.Group(); stage.position.copy(center).negate(); pivot.add(stage);
  const sweep = sweepBand(); root.add(sweep);
  lights(outer, mode === 'ar');
  const taps = [];
  const fx = new FX(stage);
  const ctx = {
    stage, fx, mode, camera, ui, sfx, asset,
    tap: (obj, fn) => taps.push([obj, fn]),
    progress: () => (exp.id === 'secret' ? secretProgress() : { done: foundOf(PAGES), total: PAGES.length }),
    pages: pageInfo,
    isFound: (id) => stamps.has(id),
  };
  const inst = exp.build(ctx);
  current = { exp, index, root, stage: outer, pivot, sweep, taps, fx, inst, camera, t: 0, e: 0, found: true, stamped: false, yaw: 0, yawV: 0, pitch: 0, zoom: 1, drag: false };

  const ty = TYPES[exp.type];
  $('chip').classList.remove('hidden');
  $('chip').querySelector('.ic').style.background = ty.c;
  $('chip').querySelector('.ic').innerHTML = icon(exp.type);
  $('chip').querySelector('small').textContent = exp.kind === 'page' ? `${exp.typeLabel} · ${DOORS[exp.door].t}` : exp.typeLabel;
  $('chip').querySelector('span').textContent = exp.title;
  $('bar').classList.toggle('hidden', !exp.video && !exp.behind && mode !== 'show');
  $('videoBtn').classList.toggle('hidden', !exp.video);
  $('behindBtn').classList.toggle('hidden', !exp.behind);
  sfx.wake();
  lecture.sendState();
  return current;
}

function stopExperience() {
  if (!current) return;
  current.root.remove(current.stage);
  current.root.remove(current.sweep);
  current.fx.clear();
  current.stage.traverse((o) => { o.geometry?.dispose?.(); });
  current = null;
}

function tick(dt) {
  const c = current; if (!c) return;
  if (activeCanvas) syncLines(activeCanvas.clientWidth || 1, activeCanvas.clientHeight || 1);
  if (c.found || c.e > 0.02) c.t += dt;
  c.e = THREE.MathUtils.damp(c.e, c.found ? 1 : 0, 6, dt);
  c.sweep.userData.play(c.t / 1.1);
  c.stage.visible = c.e > 0.01;
  if (!c.drag) {
    c.yaw += c.yawV * dt;
    c.yawV *= Math.exp(-3.2 * dt);
    if (!c.exp.free) { c.yaw = THREE.MathUtils.damp(c.yaw, 0, 4, dt); c.pitch = THREE.MathUtils.damp(c.pitch, 0, 4, dt); c.zoom = THREE.MathUtils.damp(c.zoom, 1, 4, dt); }
  }
  c.pivot.rotation.order = 'YXZ'; c.pivot.rotation.x = c.pitch; c.pivot.rotation.y = c.yaw;
  c.pivot.scale.setScalar(c.zoom);
  c.inst.update(c.t, dt, ease(c.e));
  c.fx.update(dt);
}

// Taps: a short press without dragging picks the nearest registered object.
const ray = new THREE.Raycaster();
function bindTaps(el) {
  let down = null;
  el.onpointerdown = (e) => { down = { x: e.clientX, y: e.clientY }; };
  el.onpointerup = (e) => {
    if (!down || !current || !current.found) return;
    const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y); down = null;
    if (moved > 8) return;
    const r = el.getBoundingClientRect();
    ray.setFromCamera(new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1), current.camera);
    const objs = current.taps.map(([o]) => o);
    const hits = ray.intersectObjects(objs, true).filter((h) => isShown(h.object));
    for (const h of hits) {
      let o = h.object;
      while (o) { const t = current.taps.find(([x]) => x === o); if (t) { t[1](); return; } o = o.parent; }
    }
  };
}
function bindGestures(el) {
  const pts = new Map();
  let lastX = 0, lastY = 0, lastT = 0, pinch0 = 1, zoom0 = 1, downAt = 0, lastTapAt = 0, moved = 0;
  el.addEventListener('pointerdown', (e) => {
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (!current) return;
    if (pts.size === 1) { lastX = e.clientX; lastY = e.clientY; lastT = downAt = performance.now(); moved = 0; current.drag = true; current.yawV = 0; }
    if (pts.size === 2) { const [a, b] = [...pts.values()]; pinch0 = Math.hypot(a.x - b.x, a.y - b.y) || 1; zoom0 = current.zoom; }
  });
  el.addEventListener('pointermove', (e) => {
    if (!pts.has(e.pointerId) || !current) return;
    const prev = pts.get(e.pointerId);
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    moved += Math.hypot(e.clientX - prev.x, e.clientY - prev.y);
    if (pts.size === 1) {
      const now = performance.now(), d = ((e.clientX - lastX) / innerWidth) * Math.PI * 1.5;
      current.yaw += d;
      current.pitch = THREE.MathUtils.clamp(current.pitch + ((e.clientY - lastY) / innerHeight) * Math.PI * 1.4, -1.15, 1.15);   // the model can be seen from above and below too
      lastY = e.clientY;
      current.yawV = THREE.MathUtils.lerp(current.yawV, d / Math.max(0.008, (now - lastT) / 1000), 0.5);
      lastX = e.clientX; lastT = now;
    } else if (pts.size === 2) {
      const [a, b] = [...pts.values()];
      current.zoom = THREE.MathUtils.clamp((zoom0 * Math.hypot(a.x - b.x, a.y - b.y)) / pinch0, 0.6, 1.8);
    }
  });
  const up = (e) => {
    pts.delete(e.pointerId);
    if (!current || pts.size) return;
    current.drag = false;
    const now = performance.now();
    if (now - lastT > 90) current.yawV = 0;
    if (moved < 8 && now - downAt < 250) {
      if (now - lastTapAt < 320) { current.yawV = 0; current.drag = true; resetView(); }
      lastTapAt = now;
    }
  };
  el.addEventListener('pointerup', up);
  el.addEventListener('pointercancel', up);
}
function resetView() {
  const c = current; if (!c) return;
  const y0 = c.yaw, p0 = c.pitch, z0 = c.zoom, t0 = performance.now();
  const step = () => {
    if (current !== c) return;
    const k = ease((performance.now() - t0) / 450);
    c.yaw = y0 * (1 - k); c.pitch = p0 * (1 - k); c.zoom = z0 + (1 - z0) * k;
    if (k < 1) requestAnimationFrame(step); else c.drag = false;
  };
  step();
}

function isShown(o) {
  for (let x = o; x; x = x.parent) { if (!x.visible || x.scale.x < 0.01) return false; }
  return true;
}

function applyLook(renderer) {
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
}
function environment(renderer, scene) {
  const pm = new THREE.PMREMGenerator(renderer);
  scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture;
  pm.dispose();
}

// ------------------------------------------------------------ showcase (no camera)
let show = null;
function frame(camera) {
  const d = 1.8 * Math.max(1, 0.85 / camera.aspect);
  camera.position.set(0, d * 0.8, d * 0.66);
}
// A page with a hole (the portal) needs the printed page cut open in the no-camera view.
function pageHole(hole) {
  const W = 512, H = Math.round(512 * PAGE_H), c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, W, H); g.fillStyle = '#000'; g.beginPath();
  for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; const x = hole.u * W + Math.cos(a) * hole.r * W, y = hole.v * H + Math.sin(a) * hole.r * W; i ? g.lineTo(x, y) : g.moveTo(x, y); }
  g.closePath(); g.fill();
  return new THREE.CanvasTexture(c);
}
// `which` is an index into EXPERIENCES.
async function startShowcase(which) {
  if (!DEV) return;
  await enterExp('show');
  if (!show) {
    const el = $('showStage');
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    applyLook(renderer);
    el.appendChild(renderer.domElement);
    const scene = new THREE.Scene();
    environment(renderer, scene);
    scene.add(new THREE.HemisphereLight(0xfff4e0, 0x6b5a48, 0.55));
    const camera = new THREE.PerspectiveCamera(36, 1, 0.01, 20);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true; controls.enablePan = false;
    controls.minDistance = 0.6; controls.maxDistance = 3; controls.maxPolarAngle = 1.32;
    controls.target.set(0, 0.08, 0.02);

    const desk = new THREE.Mesh(new THREE.CircleGeometry(4, 64), new THREE.ShadowMaterial({ opacity: 0.18 }));
    desk.rotation.x = -Math.PI / 2; desk.position.y = -0.045; desk.receiveShadow = true; scene.add(desk);

    // The book lying on the desk; `book` is page space (page in XY, +Z out of the page).
    const book = new THREE.Group(); book.rotation.x = -Math.PI / 2; scene.add(book);
    const pageMat = new THREE.MeshStandardMaterial({ roughness: 0.85 });
    const page = new THREE.Mesh(new THREE.PlaneGeometry(1, PAGE_H), pageMat); page.receiveShadow = true; book.add(page);
    const block = new THREE.Mesh(new THREE.BoxGeometry(1.0, PAGE_H, 0.034), new THREE.MeshStandardMaterial({ color: 0xf3ecdc, roughness: 0.9 }));
    block.position.z = -0.0175; block.receiveShadow = block.castShadow = true; book.add(block);
    const cover = new THREE.Mesh(new THREE.BoxGeometry(1.04, PAGE_H + 0.04, 0.01), new THREE.MeshStandardMaterial({ color: 0x6b4f3f, roughness: 0.6 }));
    cover.position.z = -0.04; cover.castShadow = true; book.add(cover);
    const bookSun = new THREE.DirectionalLight(0xfff1dc, 0.6); bookSun.position.set(-1, 2, 1); scene.add(bookSun);

    const loader = new THREE.TextureLoader();
    const pageTex = [];
    pageTex.get = (i) => (pageTex[i] ||= (() => { const t = loader.load(asset(`./pages/${EXPERIENCES[i].page}.jpg`)); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t; })());
    const resize = () => {
      const w = el.clientWidth, h = el.clientHeight;
      renderer.setSize(w, h, false); renderer.domElement.style.width = '100%'; renderer.domElement.style.height = '100%';
      camera.aspect = w / h; camera.updateProjectionMatrix();
      frame(camera);
    };
    addEventListener('resize', resize);
    bindTaps(renderer.domElement);
    let last = performance.now();
    renderer.setAnimationLoop(() => {
      if (!show.active) return;
      const now = performance.now(), dt = Math.min(0.05, (now - last) / 1000); last = now;
      controls.update(); tick(dt);
      renderer.render(scene, camera);
    });
    show = { renderer, scene, camera, controls, book, block, cover, pageMat, pageTex, resize, active: true };
  }
  show.active = true;
  activeCanvas = show.renderer.domElement;
  show.resize();
  const exp = EXPERIENCES[which];
  show.pageMat.map = show.pageTex.get(which);
  show.pageMat.alphaMap = exp.hole ? pageHole(exp.hole) : null;
  show.pageMat.alphaTest = exp.hole ? 0.5 : 0;
  show.block.visible = show.cover.visible = !exp.hole;
  show.pageMat.needsUpdate = true;
  startExperience(which, show.book, show.camera, 'show');
  show.resize();
  $('navPrev').classList.remove('hidden'); $('navNext').classList.remove('hidden');
  $('bar').classList.remove('hidden');
}

// ------------------------------------------------------------ AR (camera), one recognition pack at a time
const PACK_KEY = 'living-encyclopedia:pack';
let packId = PACKS.some((p) => p.id === params.get('pack')) ? params.get('pack') : PACKS[0].id;
let ar = null, rotor = null;

const test = TEST ? { since: 0, rows: [], frames: 0, fpsAt: 0, fps: 0 } : null;

const PACK_URL = () => new URL(asset(`targets/all.pack.gz?v=11`), location.href).href;
let fastWorkers = [];
function packFailed() {
  $('loading').classList.remove('hidden');
  $('loadingText').textContent = 'تعذّر تحميل صفحات الكتاب. تأكد من الاتصال ثم افتح الصفحة من جديد.';
}
async function startAR(id = packId) {
  packId = id;
  const pack = PACKS.find((p) => p.id === id);
  await enterExp('ar');
  $('loading').classList.remove('hidden'); $('loadingText').textContent = 'نجهّز الكاميرا… (أول مرة تحتاج لحظات فقط)';
  try {
    const { MindARThree } = await import('mindar-image-three');
    const cores = navigator.hardwareConcurrency || 4;
    fastWorkers = captureWorkers(Math.min(4, Math.max(2, cores - 2)));
    const mind = new MindARThree({
      container: $('arStage'), imageTargetSrc: asset(`${pack.file}?v=11`), maxTrack: 1,
      uiLoading: 'no', uiScanning: 'no', uiError: 'no', filterMinCF: 0.0001, filterBeta: 0.001, warmupTolerance: 1, missTolerance: 10,
    });
    // MindAR creates its controller inside start(); the fast matching is attached at that moment, before the pages load.
    let liveController = null;
    Object.defineProperty(mind, 'controller', { configurable: true, get: () => liveController, set: (c) => { liveController = c; installFast(c, fastWorkers, { url: PACK_URL(), onFail: packFailed }); } });
    const { renderer, scene, camera } = mind;
    applyLook(renderer);
    environment(renderer, scene);
    scene.add(new THREE.HemisphereLight(0xfff4e0, 0x5a4a3a, 0.7));
    activeCanvas = renderer.domElement;
    // The camera looks through the recognition packs one after another by itself; the student never picks.
    let ids = pack.ids, packNo = PACKS.indexOf(pack);
    const slots = Math.max(...PACKS.map((p) => p.ids.length));
    const expOf = (i) => { const k = EXPERIENCES.findIndex((x) => x.id === ids[i]); return k < 0 ? null : [k, EXPERIENCES[k]]; };
    const anchors = Array.from({ length: slots }, (_, i) => {
      const a = mind.addAnchor(i);
      const page = new THREE.Group(); a.group.add(page);
      a.onTargetFound = () => {
        if (performance.now() < ignoreUntil) return;   // right after a pack swap the matcher and our id list may disagree for a moment
        const hit = expOf(i); if (!hit) return;
        const [index, exp] = hit;
        // Page space inside the anchor: when only part of the page is the target, scale and shift
        // so experiences keep using whole-page coordinates.
        page.scale.setScalar(1); page.position.set(0, 0, 0);
        if (exp.crop) {
          const [u0, v0, u1, v1] = exp.crop, k = 1 / (u1 - u0);
          page.scale.setScalar(k);
          page.position.set(-((u0 + u1) / 2 - 0.5) * k, -(0.5 - (v0 + v1) / 2) * PAGE_H * k, 0);
        }
        lastSeen = performance.now(); seen = true;
        $('scan').classList.add('hidden');
        if (test) testFound(exp);
        if (current && current.index === index && current.root === page) { current.found = true; showOverlays(true); sfx.wake(); }
        else { startExperience(index, page, camera, 'ar'); }
        navigator.vibrate?.(25);
      };
      a.onTargetLost = () => {
        const hit = expOf(i);
        if (hit && current && current.index === hit[0]) { current.found = false; showOverlays(false); }
        seen = false; lastSeen = performance.now();
        $('scan').classList.remove('hidden');
        if (test) test.since = performance.now();
      };
      return a;
    });
    let seen = false, lastSeen = performance.now(), rotating = false, ignoreUntil = 0, swappedAt = performance.now();
    const nextPack = async () => {
      if (rotating || !mind.controller) return; rotating = true;
      try {
        packNo = (packNo + 1) % PACKS.length; ignoreUntil = performance.now() + 5000;
        await mind.controller.addImageTargets(await targetsURL(PACKS[packNo].file));
        ids = PACKS[packNo].ids; packId = PACKS[packNo].id; ignoreUntil = performance.now() + 450; swappedAt = performance.now();   // the dwell is counted from the END of the swap
      } catch (err) { console.warn('pack swap failed', err); }
      rotating = false;
    };
    // Several packs (only if the book ever grows past one file): each gets a fair look, counted from the END of its swap.
    const DWELL = 1700;
    if (PACKS.length > 1 && !params.has('norotate')) rotor = setInterval(() => { if (!seen && performance.now() - Math.max(lastSeen, swappedAt) > DWELL && !document.hidden) nextPack(); }, 250);
    bindTaps($('arStage'));
    bindGestures($('arStage'));
    await mind.start();
    lastSeen = swappedAt = performance.now();   // the first pack is looked at from the moment the camera is really running
    let last = performance.now();
    renderer.setAnimationLoop(() => {
      const now = performance.now(), dt = Math.min(0.05, (now - last) / 1000); last = now;
      tick(dt);
      renderer.render(scene, camera);
      if (test) testFrame(now);
    });
    ar = { mind, anchors };
    if (TEST) window.__mind = mind;   // field-test diagnostics (?test)
    [100, 600, 1500].forEach((ms) => setTimeout(() => dispatchEvent(new Event('resize')), ms));
    $('loading').classList.add('hidden');
    $('scan').classList.remove('hidden');
    $('packPill').classList.remove('hidden'); $('packPill').querySelector('span').textContent = 'خريطة الكتاب ▾';
    $('photoBtn').classList.remove('hidden');
    if (test) { test.since = performance.now(); renderTest(); }
  } catch (err) {
    console.error(err);
    $('loading').classList.remove('hidden');
    $('loadingText').innerHTML = 'الموسوعة الحيّة تعمل بالكاميرا فقط.<br><small style="opacity:.8;display:block;margin:.5em 0 1em">اسمح للمتصفح باستخدام الكاميرا ثم اضغط «أعد المحاولة». وإن رفضتها سابقاً ففعّلها من إعدادات الموقع في المتصفح.</small><button class="btn btn-gold" id="retryCam">أعد المحاولة</button>';
    $('retryCam').onclick = () => { stopAR(); startAR(); };
    if (DEV) setTimeout(() => { leaveExp(); }, 2200);
  }
}
function stopAR() {
  clearInterval(rotor); rotor = null;
  fastWorkers.forEach((w) => w.terminate()); stopPack(); fastWorkers = [];
  if (!ar) return;
  try { ar.mind.renderer.setAnimationLoop(null); ar.mind.stop(); } catch { /* already stopped */ }
  $('arStage').innerHTML = ''; ar = null;
}
function switchPack(id) { stopExperience(); stopAR(); startAR(id); }

function showOverlays(on) {
  ['hud', 'choices', 'caption', 'chip', 'bar', 'slider'].forEach((id) => { $(id).style.opacity = on ? '' : '0'; $(id).style.pointerEvents = on ? '' : 'none'; });
  if (!on) ui.hideCard();
}

// ------------------------------------------------------------ field-test mode (?test): how fast each page is recognised
function testFound(exp) {
  test.rows.push({ title: exp.title, secs: (performance.now() - test.since) / 1000 });
  renderTest();
}
function testFrame(now) {
  test.frames += 1;
  if (now - test.fpsAt > 2000) { test.fps = Math.round((test.frames * 1000) / (now - test.fpsAt || 1)); test.frames = 0; test.fpsAt = now; renderTest(); }
}
function deviceName() {
  const ua = navigator.userAgent;
  return /iPhone/.test(ua) ? 'آيفون' : /iPad/.test(ua) ? 'آيباد' : /Android/.test(ua) ? (ua.match(/Android [\d.]+; ([^;)]+)/)?.[1] || 'أندرويد') : 'جهاز آخر';
}
function renderTest() {
  const p = $('testPanel'); p.classList.remove('hidden');
  const rows = test.rows.slice(-8).map((r) => `${r.title}: <b>${toAr(r.secs.toFixed(1))} ث</b>`).join('<br>');
  p.innerHTML = `<b>وضع التجربة</b> · ${deviceName()} · ${toAr(test.fps)} إطار/ث<br>${rows || 'وجّه الكاميرا إلى صفحة حيّة…'}<button class="btn btn-gold" id="testShot">صورة النتيجة</button>`;
  $('testShot').onclick = () => {
    const c = document.createElement('canvas'); c.width = 1080; c.height = 1350; const g = c.getContext('2d');
    g.fillStyle = '#14110d'; g.fillRect(0, 0, 1080, 1350);
    g.direction = 'rtl'; g.textAlign = 'center'; g.fillStyle = '#f3dca2'; g.font = '700 64px "Reem Kufi", Tajawal'; g.fillText('نتيجة تجربة الموسوعة الحيّة', 540, 130);
    g.fillStyle = '#fff'; g.font = '500 36px Tajawal'; g.fillText(`${deviceName()} · ${toAr(test.fps)} إطاراً في الثانية · ${new Date().toLocaleString('ar')}`, 540, 200);
    g.textAlign = 'right'; g.font = '700 38px Tajawal';
    test.rows.slice(-18).forEach((r, i) => { g.fillStyle = r.secs < 2 ? '#7cd992' : r.secs < 5 ? '#f3d686' : '#ff8a80'; g.fillText(`${r.title} — ${toAr(r.secs.toFixed(1))} ثانية`, 1000, 300 + i * 56); });
    showShare(c, 'نتيجة التجربة', 'نتيجة-تجربة-الموسوعة-الحية.png');
  };
}

// ------------------------------------------------------------ souvenir photo: camera image + the living page, framed
function capturePhoto() {
  if (!ar) return;
  const stageEl = $('arStage'), r = stageEl.getBoundingClientRect();
  const scale = Math.min(2, 1440 / r.width), W = Math.round(r.width * scale), H = Math.round(r.height * scale);
  const c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d');
  const video = stageEl.querySelector('video');
  if (video) { const vr = video.getBoundingClientRect(); g.drawImage(video, (vr.left - r.left) * scale, (vr.top - r.top) * scale, vr.width * scale, vr.height * scale); }
  const gl = ar.mind.renderer; gl.render(ar.mind.scene, ar.mind.camera);
  const cr = gl.domElement.getBoundingClientRect();
  g.drawImage(gl.domElement, (cr.left - r.left) * scale, (cr.top - r.top) * scale, cr.width * scale, cr.height * scale);
  const gold = g.createLinearGradient(0, 0, W, H); gold.addColorStop(0, '#b88b33'); gold.addColorStop(0.5, '#f3d686'); gold.addColorStop(1, '#a9832f');
  g.strokeStyle = gold; g.lineWidth = W * 0.022; g.strokeRect(W * 0.011, W * 0.011, W - W * 0.022, H - W * 0.022);
  const band = H * 0.12; g.fillStyle = 'rgba(20,17,13,.82)'; g.fillRect(W * 0.022, H - band - W * 0.022, W - W * 0.044, band);
  g.direction = 'rtl'; g.textAlign = 'center'; g.fillStyle = '#f3dca2'; g.font = `700 ${Math.round(band * 0.34)}px "Reem Kufi", Tajawal`;
  g.fillText('الموسوعة الحيّة', W / 2, H - band * 0.55 - W * 0.022);
  g.fillStyle = '#fff'; g.font = `500 ${Math.round(band * 0.2)}px Tajawal`;
  g.fillText(`${current?.exp.title || 'موسوعة تكنولوجيا التعليم'} · dr-alfailakawi.com/living`, W / 2, H - band * 0.2 - W * 0.022);
  sfx.stamp();
  showShare(c, 'صورتك مع الصفحة الحيّة', 'الموسوعة-الحية.png');
}

function showShare(canvas, title, filename) {
  $('shareTitle').textContent = title;
  $('shareImg').src = canvas.toDataURL('image/png');
  $('share').classList.add('on');
  canvas.toBlob((blob) => {
    const file = new File([blob], filename, { type: 'image/png' });
    $('shareSave').onclick = () => { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = filename; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); };
    $('shareSend').classList.toggle('hidden', !navigator.canShare?.({ files: [file] }));
    $('shareSend').onclick = () => navigator.share({ files: [file], title }).catch(() => {});
  }, 'image/png');
}
$('shareClose').onclick = () => $('share').classList.remove('on');

// ------------------------------------------------------------ certificate per door (drawn on the device, nothing is uploaded)
const SEAL_NAMES = { infographic: 'إنفوجرافيك', model: 'مجسّم', hotspots: 'صورة تفاعلية', ladder: 'سلّم', lab: 'مختبر', portal: 'بوابة', exploded: 'فكّك', assemble: 'الهرم', balance: 'الميزان', roleplay: 'تمثيل', branching: 'قرار' };
let certDoor = 1;
function drawCertificate(name, door) {
  const W = 2000, H = 1414, c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d');
  const bg = g.createRadialGradient(W / 2, H * 0.4, 100, W / 2, H / 2, W * 0.75);
  bg.addColorStop(0, '#fffdf6'); bg.addColorStop(1, '#f1e8d4');
  g.fillStyle = bg; g.fillRect(0, 0, W, H);
  const gold = g.createLinearGradient(0, 0, W, H);
  gold.addColorStop(0, '#b88b33'); gold.addColorStop(0.5, '#f3d686'); gold.addColorStop(1, '#a9832f');
  g.strokeStyle = gold; g.lineWidth = 18; g.strokeRect(46, 46, W - 92, H - 92);
  g.lineWidth = 3; g.strokeRect(84, 84, W - 168, H - 168);
  g.fillStyle = '#b88b33'; g.font = '700 46px Tajawal, sans-serif'; g.textAlign = 'center';
  [[110, 120], [W - 110, 120], [110, H - 100], [W - 110, H - 100]].forEach(([x, y]) => g.fillText('✦', x, y));
  g.save(); g.translate(W / 2, 205);
  const med = g.createRadialGradient(-20, -20, 10, 0, 0, 92); med.addColorStop(0, '#fbe7ad'); med.addColorStop(1, '#a9832f');
  g.fillStyle = med; g.beginPath(); g.arc(0, 0, 88, 0, Math.PI * 2); g.fill();
  g.strokeStyle = 'rgba(20,17,13,.25)'; g.lineWidth = 6; g.beginPath(); g.arc(0, 0, 72, 0, Math.PI * 2); g.stroke();
  g.fillStyle = '#14110d'; g.font = '800 92px Tajawal, sans-serif'; g.textBaseline = 'middle'; g.fillText('✦', 0, 6);
  g.restore();
  g.direction = 'rtl'; g.textAlign = 'center'; g.textBaseline = 'alphabetic';
  g.fillStyle = '#1f1b16'; g.font = '700 112px "Reem Kufi", Tajawal, sans-serif'; g.fillText('شهادة إتمام', W / 2, 410);
  g.fillStyle = '#8a6a1f'; g.font = '700 44px Tajawal, sans-serif'; g.fillText(`الموسوعة الحيّة · ${DOORS[door].t}: ${DOORS[door].s}`, W / 2, 490);
  g.fillStyle = '#6f655a'; g.font = '500 40px Tajawal, sans-serif'; g.fillText('تُمنح هذه الشهادة إلى', W / 2, 600);
  const ink = g.createLinearGradient(W / 2 - 500, 0, W / 2 + 500, 0); ink.addColorStop(0, '#8a6a1f'); ink.addColorStop(0.5, '#c79a3a'); ink.addColorStop(1, '#8a6a1f');
  g.fillStyle = ink; g.font = '700 124px "Reem Kufi", Tajawal, sans-serif'; g.fillText(name, W / 2, 750);
  g.strokeStyle = gold; g.lineWidth = 4; g.beginPath(); g.moveTo(W / 2 - 520, 800); g.lineTo(W / 2 + 520, 800); g.stroke();
  g.fillStyle = '#3c352d'; g.font = '500 42px Tajawal, sans-serif';
  g.fillText(`تقديراً لإيقاظ صفحات ${DOORS[door].t} الحيّة جميعها، وعيش نظرياتها تجربةً لا قراءة.`, W / 2, 880);
  const pages = doorPages(door), n = pages.length, gap = Math.min(170, 1500 / Math.max(1, n)), x0 = W / 2 + ((n - 1) * gap) / 2;
  pages.forEach((x, i) => {
    const cx = x0 - i * gap, cy = 1010;
    g.fillStyle = TYPES[x.type].c; g.beginPath(); g.arc(cx, cy, 46, 0, Math.PI * 2); g.fill();
    g.strokeStyle = '#f3d686'; g.lineWidth = 6; g.stroke();
    g.fillStyle = '#ffffff'; g.font = '800 40px Tajawal, sans-serif'; g.fillText('✦', cx, cy + 14);
    g.fillStyle = '#4b4339'; g.font = '700 23px Tajawal, sans-serif'; g.fillText(SEAL_NAMES[x.type] || x.typeLabel, cx, cy + 92);
  });
  g.direction = 'rtl'; g.textAlign = 'center'; g.fillStyle = '#1f1b16'; g.font = '700 34px Tajawal, sans-serif';
  g.fillText('موسوعة تكنولوجيا التعليم — د. أحمد حسين الفيلكاوي · د. عبدالعزيز دخيل العنزي', W / 2, H - 200);
  const date = new Date().toLocaleDateString('ar', { year: 'numeric', month: 'long', day: 'numeric' });
  g.fillStyle = '#6f655a'; g.font = '500 30px Tajawal, sans-serif';
  g.textAlign = 'right'; g.fillText(date, W - 150, H - 130);
  g.textAlign = 'left'; g.direction = 'ltr'; g.fillText('dr-alfailakawi.com/living', 150, H - 130);
  return c;
}

function openCertificate(door = 1) {
  certDoor = door;
  const box = $('cert');
  box.classList.add('on');
  box.querySelector('.step1').classList.remove('hidden');
  box.querySelector('.step2').classList.add('hidden');
  box.querySelector('h4').textContent = `شهادة ${DOORS[door].t} جاهزة`;
  const input = $('certName');
  try { input.value = localStorage.getItem('living-encyclopedia:name') || ''; } catch { /* private mode */ }
  setTimeout(() => input.focus(), 300);
}
$('certMake').onclick = async () => {
  const name = $('certName').value.trim().slice(0, 40);
  if (!name) { $('certName').focus(); return; }
  try { localStorage.setItem('living-encyclopedia:name', name); } catch { /* private mode */ }
  await fontsReady();
  const c = drawCertificate(name, certDoor);
  const box = $('cert');
  box.querySelector('img').src = c.toDataURL('image/png');
  box.querySelector('.step1').classList.add('hidden');
  box.querySelector('.step2').classList.remove('hidden');
  sfx.stamp();
  c.toBlob((blob) => {
    const file = new File([blob], 'شهادة-الموسوعة-الحية.png', { type: 'image/png' });
    $('certSave').onclick = () => { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = file.name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); };
    const canShare = navigator.canShare?.({ files: [file] });
    $('certShare').classList.toggle('hidden', !canShare);
    $('certShare').onclick = () => navigator.share({ files: [file], title: 'شهادة الموسوعة الحيّة' }).catch(() => {});
  }, 'image/png');
};
$('certClose').onclick = () => $('cert').classList.remove('on');

// ------------------------------------------------------------ lecture mode: the projector shows the page, the lecturer's phone drives it
const lecture = {
  conn: null,
  sendState() {
    if (!this.conn?.open || !current) return;
    this.conn.send({ type: 'state', title: current.exp.title, label: current.exp.typeLabel, chapter: current.exp.kind === 'page' ? chapterOf(current.exp)[2] : '', free: !!current.exp.free, choices: [...$('choices').querySelectorAll('button')].map((b) => b.textContent) });
  },
  async start() {
    await startShowcase(EXPERIENCES.indexOf(PAGES[0]));
    const box = $('lecture'); box.classList.remove('hidden');
    box.innerHTML = '<small>نجهّز وضع المحاضرة…</small>';
    try {
      const code = String(Math.floor(1000 + Math.random() * 9000));
      const Peer = (await import(PEERJS)).Peer;
      const QR = await import(QRCODE); const toDataURL = (QR.default || QR).toDataURL;
      const remoteUrl = `${location.origin}${location.pathname}?remote=${code}`;
      const peer = new Peer(`dr-living-${code}`);
      const qr = await toDataURL(remoteUrl, { margin: 1, width: 300 });
      box.innerHTML = `<b>وضع المحاضرة</b><img src="${qr}" alt=""><div class="code">${code}</div><small>امسح الرمز بجوالك لتتحكم في العرض</small>`;
      peer.on('connection', (conn) => {
        this.conn = conn;
        conn.on('open', () => { box.innerHTML = '<b>✦ جوال المحاضر متصل</b>'; setTimeout(() => box.classList.add('hidden'), 2500); this.sendState(); });
        conn.on('data', (m) => this.onRemote(m));
        conn.on('close', () => { box.classList.remove('hidden'); box.innerHTML = `<b>انقطع الاتصال</b><img src="${qr}" alt=""><div class="code">${code}</div>`; });
      });
      peer.on('error', () => { box.innerHTML = '<small>تعذّر وضع المحاضرة الآن؛ استخدم الأسهم في الأسفل.</small>'; });
    } catch { box.innerHTML = '<small>تعذّر وضع المحاضرة الآن؛ استخدم الأسهم في الأسفل.</small>'; }
  },
  onRemote(m) {
    if (m.type === 'next') step(1);
    if (m.type === 'prev') step(-1);
    if (!current) return;
    if (m.type === 'yaw') { current.yaw = m.v; current.yawV = 0; }
    if (m.type === 'zoom') current.zoom = m.v;
    if (m.type === 'choice') $('choices').querySelectorAll('button')[m.k]?.click();
    if (m.type === 'behind') $('behindBtn').click();
    if (m.type === 'reset') { current.yaw = 0; current.pitch = 0; current.zoom = 1; }
  },
};

async function startRemote(code) {
  $('home').classList.add('hidden'); $('exp').classList.add('hidden');
  const r = $('remote'); r.classList.remove('hidden');
  r.innerHTML = '<h2>جهاز التحكّم</h2><div class="now" id="rNow">نتصل بالعرض…</div>';
  try {
    const Peer = (await import(PEERJS)).Peer;
    const peer = new Peer();
    peer.on('open', () => {
      const conn = peer.connect(`dr-living-${code}`, { reliable: true });
      const send = (m) => conn.open && conn.send(m);
      conn.on('open', () => {
        r.innerHTML = `<h2>جهاز التحكّم</h2><div class="now" id="rNow">متصل ✦</div>
          <div class="nav"><button id="rPrev">السابقة</button><button class="gold" id="rNext">التالية</button></div>
          <label id="rYawRow">تدوير<input type="range" id="rYaw" min="-314" max="314" value="0"></label>
          <label id="rZoomRow">تكبير<input type="range" id="rZoom" min="60" max="180" value="100"></label>
          <div id="remoteChoices"></div>
          <div class="nav"><button id="rBehind">خلف الكواليس</button><button id="rReset">إعادة الوضع</button></div>`;
        $('rPrev').onclick = () => send({ type: 'prev' }); $('rNext').onclick = () => send({ type: 'next' });
        $('rYaw').oninput = (e) => send({ type: 'yaw', v: e.target.value / 100 });
        $('rZoom').oninput = (e) => send({ type: 'zoom', v: e.target.value / 100 });
        $('rBehind').onclick = () => send({ type: 'behind' });
        $('rReset').onclick = () => { $('rYaw').value = 0; $('rZoom').value = 100; send({ type: 'reset' }); };
      });
      conn.on('data', (m) => {
        if (m.type !== 'state' || !$('remoteChoices')) return;
        $('rNow').innerHTML = `${m.label}${m.chapter ? ` · ${m.chapter}` : ''}<br>${m.title}`;
        $('rYaw').value = 0; $('rZoom').value = 100;
        // Pages printed flat stay flat on the projector too, so their sliders rest.
        $('rYaw').disabled = $('rZoom').disabled = !m.free;
        $('rYawRow').classList.toggle('off', !m.free); $('rZoomRow').classList.toggle('off', !m.free);
        $('remoteChoices').innerHTML = m.choices.map((c, k) => `<button data-k="${k}">${c}</button>`).join('');
        $('remoteChoices').querySelectorAll('button').forEach((b) => (b.onclick = () => send({ type: 'choice', k: +b.dataset.k })));
      });
      conn.on('close', () => ($('rNow').textContent = 'انقطع الاتصال؛ امسح الرمز من جديد.'));
    });
    peer.on('error', () => ($('rNow').textContent = 'تعذّر الاتصال؛ تأكد من الرمز وامسحه من جديد.'));
  } catch { $('rNow').textContent = 'تعذّر الاتصال الآن.'; }
}

// ------------------------------------------------------------ navigation
async function enterExp(mode) {
  await fontsReady();
  $('home').classList.add('hidden');
  $('exp').classList.remove('hidden');
  $('exp').classList.toggle('ar', mode === 'ar');
  $('arStage').classList.toggle('hidden', mode !== 'ar');
  $('showStage').classList.toggle('hidden', mode !== 'show');
  $('navPrev').classList.add('hidden'); $('navNext').classList.add('hidden');
  $('chip').classList.add('hidden'); $('bar').classList.add('hidden');
  $('packPill').classList.add('hidden'); $('photoBtn').classList.add('hidden');
  // The camera overlay belongs to camera mode only (direct #show= and ?lecture links start here).
  if (mode !== 'ar') { stopAR(); $('loading').classList.add('hidden'); }
  showOverlays(true);
}
function leaveExp() {
  stopExperience(); ui.reset();
  stopAR();
  if (show) show.active = false;
  $('scan').classList.add('hidden'); $('loading').classList.add('hidden'); $('testPanel').classList.add('hidden');
  $('exp').classList.add('hidden'); $('home').classList.remove('hidden');
  renderHome();
}

function renderMute() {
  const m = isMuted();
  $('mute').innerHTML = m
    ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 5 6 9H3v6h3l5 4V5Z"/><path d="m22 9-6 6M16 9l6 6"/></svg>'
    : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 5 6 9H3v6h3l5 4V5Z"/><path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13"/></svg>';
  $('mute').setAttribute('aria-label', m ? 'تشغيل الصوت' : 'كتم الصوت');
}
$('mute').onclick = () => { setMuted(!isMuted()); renderMute(); unlockAudio(); if (!isMuted()) sfx.tap(); };
renderMute();
// Browsers allow sound only after a first touch.
addEventListener('pointerdown', unlockAudio, { capture: true });

$('back').onclick = leaveExp;
$('openAR').onclick = () => startAR();
$('openShow').onclick = () => startShowcase(EXPERIENCES.indexOf(PAGES[0]));
$('openMap').onclick = openMap;
$('mapClose').onclick = closeMap;
$('packPill').onclick = openMap;
$('photoBtn').onclick = capturePhoto;
const step = (d) => {
  if (!current || !show?.active) return;
  const i = Math.max(0, PAGES.indexOf(current.exp));
  startShowcase(EXPERIENCES.indexOf(PAGES[(i + d + PAGES.length) % PAGES.length]));
};
$('navNext').onclick = () => step(1);
$('navPrev').onclick = () => step(-1);
$('videoBtn').onclick = () => { if (current?.exp.video) open(`https://www.youtube.com/watch?v=${current.exp.video}`, '_blank', 'noopener'); };
$('behindBtn').onclick = () => {
  if (!current?.exp.behind) return;
  $('bhTitle').textContent = current.exp.behind.principle;
  $('bhBody').textContent = current.exp.behind.body;
  const b = $('behind'); b.classList.remove('flipped'); b.classList.add('on');
  setTimeout(() => b.classList.add('flipped'), 900);
};
$('bhClose').onclick = () => $('behind').classList.remove('on', 'flipped');
$('behind').onclick = (e) => { if (e.target === $('behind')) $('behind').classList.remove('on', 'flipped'); };

// Offline: a small service worker keeps the app, the libraries and the recognition files on the phone.
if ('serviceWorker' in navigator && !params.has('nosw')) {
  const scope = new URL('.', import.meta.url).pathname.replace(/(.)\/$/, '$1');
  navigator.serviceWorker.register(asset('./sw.js'), { scope }).catch(() => { /* still works online */ });
}

// Opening the link goes straight to the camera. `?home` opens the gallery; `?lecture` the projector view;
// `?remote=1234` the lecturer's phone remote; `#show=3` or `#show=<id>` a page without camera.
const m = location.hash.match(/show=([\w-]+)/);
if (params.get('remote')) startRemote(params.get('remote'));
else if (params.has('lecture')) lecture.start();
else if (m && DEV) startShowcase(/^\d+$/.test(m[1]) ? EXPERIENCES.indexOf(PAGES[+m[1]]) : Math.max(0, EXPERIENCES.findIndex((x) => x.id === m[1])));
else if (params.has('home') && DEV) leaveExp();
else startAR();
// Debug handle for local checks.
window.__living = {
  get current() { return current; }, get show() { return show; }, start: startShowcase, EXPERIENCES,
  setStamps(ids) { stamps = new Set(ids); writeStamps(stamps); },
};
