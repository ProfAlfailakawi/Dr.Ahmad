// The living encyclopedia: a home gallery, a camera (AR) mode and a no-camera showcase,
// all sharing the same six page experiences.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { EXPERIENCES, toAr } from './experiences.js?v=4';
import { PAGE_H, FX, sweepBand, ease, fontsReady } from './kit.js?v=4';

const $ = (id) => document.getElementById(id);
const asset = (path) => new URL(path, import.meta.url).href;
const hex = (c) => '#' + c.toString(16).padStart(6, '0');

const TYPES = {
  infographic: { c: '#b5202f', svg: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>' },
  model: { c: '#2a7fd0', svg: '<path d="m12 3 8 4.5v9L12 21l-8-4.5v-9L12 3Z"/><path d="m12 12 8-4.5M12 12v9M12 12 4 7.5"/>' },
  hotspots: { c: '#1fa5a0', svg: '<circle cx="12" cy="12" r="3"/><circle cx="12" cy="12" r="8" opacity=".5"/>' },
  animation: { c: '#e0861f', svg: '<circle cx="12" cy="12" r="9"/><path d="m10 8.5 5.5 3.5-5.5 3.5v-7Z" fill="currentColor"/>' },
  game: { c: '#d62b3a', svg: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.4" fill="currentColor"/>' },
  quiz: { c: '#8a5bb5', svg: '<path d="M9.2 9a3 3 0 1 1 4.3 2.7c-.9.5-1.5 1.2-1.5 2.3M12 17.5h.01"/><circle cx="12" cy="12" r="9.5"/>' },
};
const icon = (type) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${TYPES[type].svg}</svg>`;

// ------------------------------------------------------------ stamps (kept on the device only)
const STAMP_KEY = 'living-encyclopedia:stamps';
function readStamps() { try { return new Set(JSON.parse(localStorage.getItem(STAMP_KEY) || '[]')); } catch { return new Set(); } }
function writeStamps(s) { try { localStorage.setItem(STAMP_KEY, JSON.stringify([...s])); } catch { /* private mode */ } }
let stamps = readStamps();

// ------------------------------------------------------------ home
function renderHome() {
  $('grid').innerHTML = EXPERIENCES.map((x, i) => `
    <button class="card" data-i="${i}">
      <div class="thumb"><img src="${asset(`./pages/${x.page}.jpg`)}" alt="" loading="lazy"></div>
      <div class="meta">
        <span class="badge" style="background:${TYPES[x.type].c}">${icon(x.type)}${x.typeLabel}</span>
        <h3>${x.title}</h3>
        <span class="page">صفحة ${x.pageNo} في الطبعة الحالية</span>
      </div>
      ${stamps.has(x.id) ? '<span class="stamp" title="اكتشفتها">✦</span>' : ''}
    </button>`).join('');
  $('progress').textContent = stamps.size ? `✦ اكتشفت ${toAr(stamps.size)} من ${toAr(EXPERIENCES.length)} صفحات` : '';
  $('grid').querySelectorAll('.card').forEach((b) => (b.onclick = () => startShowcase(+b.dataset.i)));
}

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
      b.onclick = (ev) => { ev.stopPropagation(); o.onPick(); };
      box.appendChild(b);
    });
  },
  toast(text) {
    const t = $('toast'); t.textContent = text; t.classList.add('on');
    clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('on'), 1800);
  },
  done() {
    const exp = current?.exp; if (!exp || current.stamped) return;
    current.stamped = true;
    const first = !stamps.has(exp.id);
    stamps.add(exp.id); writeStamps(stamps);
    $('stampLbl').textContent = first ? `اكتشفت هذه الصفحة · ${toAr(stamps.size)} من ${toAr(EXPERIENCES.length)}` : 'أكملت هذه الصفحة مرة أخرى';
    const fx = $('stampFx'); fx.classList.remove('on'); void fx.offsetWidth; fx.classList.add('on');
    navigator.vibrate?.([20, 40, 30]);
  },
  reset() {
    this.hideCard(); this.hud(''); this.choices([]);
    $('caption').classList.add('hidden'); $('caption').textContent = '';
  },
};
$('sheet').querySelector('.x').onclick = () => ui.hideCard();

// ------------------------------------------------------------ one running page experience
let current = null;

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
  const ctx = { stage, fx, mode, camera, ui, tap: (obj, fn) => taps.push([obj, fn]) };
  const inst = exp.build(ctx);
  current = { exp, index, root, stage: outer, pivot, sweep, taps, fx, inst, camera, t: 0, e: 0, found: true, stamped: false, yaw: 0, yawV: 0, zoom: 1, drag: false };

  const ty = TYPES[exp.type];
  $('chip').classList.remove('hidden');
  $('chip').querySelector('.ic').style.background = ty.c;
  $('chip').querySelector('.ic').innerHTML = icon(exp.type);
  $('chip').querySelector('small').textContent = `${exp.typeLabel} · صفحة ${exp.pageNo}`;
  $('chip').querySelector('span').textContent = exp.title;
  $('bar').classList.remove('hidden');
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
  if (c.found || c.e > 0.02) c.t += dt;
  c.e = THREE.MathUtils.damp(c.e, c.found ? 1 : 0, 6, dt);
  c.sweep.userData.play(c.t / 1.1);
  c.stage.visible = c.e > 0.01;
  if (!c.drag) {
    c.yaw += c.yawV * dt;
    c.yawV *= Math.exp(-3.2 * dt);
    if (!c.exp.free) { c.yaw = THREE.MathUtils.damp(c.yaw, 0, 4, dt); c.zoom = THREE.MathUtils.damp(c.zoom, 1, 4, dt); }
  }
  c.pivot.rotation.y = c.yaw;
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
  let lastX = 0, lastT = 0, pinch0 = 1, zoom0 = 1, downAt = 0, lastTapAt = 0, moved = 0;
  el.addEventListener('pointerdown', (e) => {
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (!current) return;
    if (pts.size === 1) { lastX = e.clientX; lastT = downAt = performance.now(); moved = 0; current.drag = true; current.yawV = 0; }
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
  const y0 = c.yaw, z0 = c.zoom, t0 = performance.now();
  const step = () => {
    if (current !== c) return;
    const k = ease((performance.now() - t0) / 450);
    c.yaw = y0 * (1 - k); c.zoom = z0 + (1 - z0) * k;
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
async function startShowcase(index) {
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
    const pageTex = EXPERIENCES.map((x) => { const t = loader.load(asset(`./pages/${x.page}.jpg`)); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t; });
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
    show = { renderer, scene, camera, controls, book, pageMat, pageTex, resize, active: true };
  }
  show.active = true;
  show.resize();
  const exp = EXPERIENCES[index];
  show.pageMat.map = show.pageTex[index]; show.pageMat.needsUpdate = true;
  startExperience(index, show.book, show.camera, 'show');
  show.resize();
  $('navPrev').classList.remove('hidden'); $('navNext').classList.remove('hidden');
}

// ------------------------------------------------------------ AR (camera)
let ar = null;
async function startAR() {
  await enterExp('ar');
  $('loading').classList.remove('hidden'); $('loadingText').textContent = 'نجهّز الكاميرا والصفحات الحيّة…';
  try {
    const { MindARThree } = await import('mindar-image-three');
    const mind = new MindARThree({
      container: $('arStage'), imageTargetSrc: asset('./targets.mind?v=4'), maxTrack: 1,
      uiLoading: 'no', uiScanning: 'no', uiError: 'no', filterMinCF: 0.0001, filterBeta: 0.001, warmupTolerance: 3, missTolerance: 10,
    });
    const { renderer, scene, camera } = mind;
    applyLook(renderer);
    environment(renderer, scene);
    scene.add(new THREE.HemisphereLight(0xfff4e0, 0x5a4a3a, 0.7));
    const anchors = EXPERIENCES.map((exp, i) => {
      const a = mind.addAnchor(i);
      // Page space inside the anchor: when only part of the page is the target, scale and shift
      // so experiences keep using whole-page coordinates.
      const page = new THREE.Group(); a.group.add(page);
      if (exp.crop) {
        const [u0, v0, u1, v1] = exp.crop, s = 1 / (u1 - u0);
        page.scale.setScalar(s);
        page.position.set(-((u0 + u1) / 2 - 0.5) * s, -(0.5 - (v0 + v1) / 2) * PAGE_H * s, 0);
      }
      a.onTargetFound = () => {
        $('scan').classList.add('hidden');
        if (current && current.index === i && current.root === page) { current.found = true; showOverlays(true); }
        else { startExperience(i, page, camera, 'ar'); }
        navigator.vibrate?.(25);
      };
      a.onTargetLost = () => {
        if (current && current.index === i) { current.found = false; showOverlays(false); }
        $('scan').classList.remove('hidden');
      };
      return a;
    });
    bindTaps($('arStage'));
    bindGestures($('arStage'));
    await mind.start();
    let last = performance.now();
    renderer.setAnimationLoop(() => {
      const now = performance.now(), dt = Math.min(0.05, (now - last) / 1000); last = now;
      tick(dt);
      renderer.render(scene, camera);
    });
    ar = { mind, anchors };
    [100, 600, 1500].forEach((ms) => setTimeout(() => dispatchEvent(new Event('resize')), ms));
    $('loading').classList.add('hidden');
    $('scan').classList.remove('hidden');
  } catch (err) {
    console.error(err);
    $('loadingText').innerHTML = 'تعذّر فتح الكاميرا.<br><small style="opacity:.7">اسمح للمتصفح باستخدامها ثم أعد المحاولة، أو شاهد الصفحات بدون كاميرا.</small>';
    setTimeout(() => { leaveExp(); }, 2200);
  }
}

function showOverlays(on) {
  ['hud', 'choices', 'caption', 'chip', 'bar'].forEach((id) => { $(id).style.opacity = on ? '' : '0'; $(id).style.pointerEvents = on ? '' : 'none'; });
  if (!on) ui.hideCard();
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
  showOverlays(true);
}
function leaveExp() {
  stopExperience(); ui.reset();
  if (ar) { try { ar.mind.renderer.setAnimationLoop(null); ar.mind.stop(); } catch { /* already stopped */ } $('arStage').innerHTML = ''; ar = null; }
  if (show) show.active = false;
  $('scan').classList.add('hidden'); $('loading').classList.add('hidden');
  $('exp').classList.add('hidden'); $('home').classList.remove('hidden');
  renderHome();
}

$('back').onclick = leaveExp;
$('openAR').onclick = startAR;
$('openShow').onclick = () => startShowcase(0);
const step = (d) => { if (current && show?.active) startShowcase((current.index + d + EXPERIENCES.length) % EXPERIENCES.length); };
$('navNext').onclick = () => step(1);
$('navPrev').onclick = () => step(-1);
$('videoBtn').onclick = () => { if (current) open(`https://www.youtube.com/watch?v=${current.exp.video}`, '_blank', 'noopener'); };
$('behindBtn').onclick = () => {
  if (!current) return;
  $('bhTitle').textContent = current.exp.behind.principle;
  $('bhBody').textContent = current.exp.behind.body;
  const b = $('behind'); b.classList.remove('flipped'); b.classList.add('on');
  setTimeout(() => b.classList.add('flipped'), 900);
};
$('bhClose').onclick = () => $('behind').classList.remove('on', 'flipped');
$('behind').onclick = (e) => { if (e.target === $('behind')) $('behind').classList.remove('on', 'flipped'); };

// Opening the link goes straight to the camera. `?home` opens the gallery, `#show=3` a page without camera.
const m = location.hash.match(/show=(\d)/);
if (m) startShowcase(+m[1]);
else if (new URLSearchParams(location.search).has('home')) leaveExp();
else startAR();
