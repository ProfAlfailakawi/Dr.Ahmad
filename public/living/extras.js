// extras — three things every page shares:
//   memory(): the page remembers the reader. From the second visit on, a gold gem waits in the page corner with a harder question (Bloom: analyse, evaluate, create).
//   bridge(): two facing pages talk. Moving from one page to the page opposite it draws a bridge of light across the gutter, carrying the first page's title over.
//   paperVideo: the page's YouTube video plays on the paper itself, standing on the page and following it, instead of leaving the book.
import * as THREE from 'three';
import { glow, sprite, ease, easeBack, clamp01, PAGE_H } from './kit.js?v=37';

// ------------------------------------------------------------ visits (kept on the device only)
const VKEY = 'living-encyclopedia:visits';
export function bumpVisit(id) {
  let m = {};
  try { m = JSON.parse(localStorage.getItem(VKEY) || '{}') || {}; } catch { m = {}; }
  m[id] = (m[id] || 0) + 1;
  try { localStorage.setItem(VKEY, JSON.stringify(m)); } catch { /* private mode: the page simply forgets */ }
  return m[id];
}

const LEVELS = [
  { tag: 'الزيارة الثانية · التحليل', qs: [
    'ما الفكرة التي لو حذفتها من «$» لانهار المعنى كله؟ ولماذا هي بالذات؟',
    'قارن «$» بموقف عشته في قاعة الدرس: أين يتطابقان، وأين يفترقان؟',
    'ما العلاقة الخفية بين «$» وصفحة أخرى اكتشفتها في هذا الباب؟',
  ] },
  { tag: 'الزيارة الثالثة · التقويم', qs: [
    'لو أردت أن تقنع زميلاً متشككاً بقيمة «$»، فما أقوى دليل تقدّمه له؟',
    'ما الذي قد يُفشل «$» حين يُطبَّق في مدرسة حقيقية؟ وكيف تتجنّبه؟',
    'هل يبقى «$» صالحاً بعد عشر سنوات من الآن؟ احكم، ثم علّل حكمك.',
  ] },
  { tag: 'زيارة متجددة · الإبداع', qs: [
    'صمّم نشاطاً مدته عشر دقائق يعلّم «$» لطلاب لم يقرؤوا الكتاب.',
    'أعد صياغة «$» في ثلاث جمل فقط، كأنك تشرحه لمن يسمع به أول مرة.',
    'ابتكر مثالاً من واقعك يجعل «$» أوضح من مثال الكتاب.',
  ] },
];
const hash = (s) => [...String(s)].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);

// A gold gem in the top corner of the page; touching it opens the deeper question for this visit.
export function memory({ parent, taps, ui, sfx, fx, id, title, visits, color = 0xd4ad55, center = [0.5, 0.6] }) {
  const lvl = LEVELS[Math.min(visits - 2, LEVELS.length - 1)];
  const q = lvl.qs[(hash(id) + visits) % lvl.qs.length].split('$').join(title);
  // the gem waits in the corner farthest from the scene, so it never sits on top of it
  const at = new THREE.Vector3(center[0] > 0.5 ? -0.36 : 0.36, 0, (center[1] > 0.5 ? -1 : 1) * (PAGE_H / 2 - 0.14)), SIZE = 1.6;
  const g = new THREE.Group(); g.position.copy(at); parent.add(g); g.visible = false;
  const gold = new THREE.MeshStandardMaterial({ color: 0xe8c063, emissive: 0xffb84a, emissiveIntensity: 0.55, metalness: 0.7, roughness: 0.25 });
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.045, 0.004, 8, 48), gold); ring.rotation.x = Math.PI / 2; ring.position.y = 0.003; g.add(ring);
  const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.022, 0), new THREE.MeshPhysicalMaterial({ color, emissive: color, emissiveIntensity: 0.6, roughness: 0.15, clearcoat: 1, flatShading: true }));
  g.add(gem);
  const halo = glow(0xffd27a, 0.14, 0.7); g.add(halo);
  const dots = [];
  for (let i = 0; i < Math.min(visits, 6); i++) { const a = -Math.PI / 2 + (i - (Math.min(visits, 6) - 1) / 2) * 0.42; const d = new THREE.Mesh(new THREE.SphereGeometry(0.0055, 10, 8), gold); d.position.set(Math.cos(a) * 0.062, 0.004, Math.sin(a) * 0.062); g.add(d); dots.push(d); }
  const lab = sprite('طبقة أعمق', 0.11, { size: 40, weight: 800, bg: 'rgba(24,20,12,.85)', color: '#f4d98a', pad: 12, radius: 22, shadow: false });
  lab.position.set(0, 0.11, 0); g.add(lab);
  const hit = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false })); hit.position.y = 0.04; g.add(hit);
  let shownAt = -1, opened = false;
  taps.push([hit, () => {
    opened = true; sfx.discover?.();
    fx.burst(at.clone().setY(0.07), 0xffd27a, 18, 0.3, 0.022);
    ui.card({ tag: lvl.tag, title: 'الصفحة تتذكّرك', body: q, color: 0xd4ad55 });
  }]);
  return {
    update(t) {
      if (t < 2.6) { g.visible = false; return; }
      if (shownAt < 0) { shownAt = t; sfx.discover?.(); ui.toast?.('عدت إلى هذه الصفحة · طبقة أعمق تنتظرك ✦'); }
      const k = easeBack(clamp01((t - shownAt) / 0.8));
      g.visible = true; g.scale.setScalar(Math.max(k, 1e-4) * SIZE);
      gem.position.y = 0.045 + Math.sin(t * 2) * 0.006; gem.rotation.set(0.3, t * 1.4, 0);
      halo.position.y = gem.position.y; halo.material.opacity = (opened ? 0.35 : 0.7) * (0.75 + 0.25 * Math.sin(t * 3));
      ring.rotation.z = t * 0.5; lab.visible = !opened;
    },
  };
}

// ------------------------------------------------------------ facing pages: a bridge of light across the gutter
const TUBE_V = 'varying float vU; void main(){ vU = uv.x; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }';
const TUBE_F = `uniform float uHead; uniform float uFade; uniform vec3 uCol; varying float vU;
void main(){
  if (vU > uHead) discard;
  float tip = exp(-pow((uHead - vU) / 0.05, 2.0));
  float body = 0.55 + 0.45 * sin(vU * 60.0 - uHead * 40.0);
  vec3 c = mix(uCol, vec3(1.0, 0.95, 0.8), 0.35 + 0.6 * tip);
  gl_FragColor = vec4(c * (0.8 + 0.6 * body), (0.55 + 0.45 * tip) * uFade);
}`;
// Neighbouring pages talk: the facing page, or one a few leaves away (an Arabic book turns leftward, so earlier pages lie to the right).
export function isFacing(a, b) { return a !== b && Math.abs(a - b) <= 6; }
// side: -1 when the previous page lies to the left of this one on the spread, +1 when to the right.
export function bridge({ parent, fx, sfx, side, center, color, title }) {
  const col = new THREE.Color(color);
  const a = new THREE.Vector3(side * 1.02, 0.03, 0), c = new THREE.Vector3(center[0] - 0.5, 0.1, (center[1] - 0.5) * PAGE_H);
  const m1 = a.clone().lerp(c, 0.33).setY(0.42), m2 = a.clone().lerp(c, 0.7).setY(0.36);
  const curve = new THREE.CubicBezierCurve3(a, m1, m2, c);
  const U = { uHead: { value: 0 }, uFade: { value: 1 }, uCol: { value: col } };
  const mat = new THREE.ShaderMaterial({ uniforms: U, vertexShader: TUBE_V, fragmentShader: TUBE_F, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
  const tube = new THREE.Mesh(new THREE.TubeGeometry(curve, 72, 0.006, 6, false), mat); tube.renderOrder = 9; tube.frustumCulled = false;
  const head = glow(col.getHex(), 0.12, 1); head.renderOrder = 10;
  const root = new THREE.Group(); root.add(tube, head); parent.add(root);
  const chip = sprite(title, 0.34, { size: 38, weight: 700, bg: 'rgba(14,20,38,.88)', color: '#f4d98a', border: 'rgba(240,196,92,.6)', pad: 14, radius: 26, shadow: false, width: 640 });
  chip.renderOrder = 11; root.add(chip);
  const start = glow(col.getHex(), 0.3, 0.8); start.position.copy(a); root.add(start);
  let t = 0, landed = false;
  sfx.whoosh?.();
  return {
    update(dt) {
      t += dt;
      const g = ease(clamp01(t / 1.4)), fade = 1 - clamp01((t - 3.6) / 0.9);
      U.uHead.value = g * 1.02; U.uFade.value = fade;
      const p = curve.getPoint(Math.min(1, g)); head.position.copy(p); head.material.opacity = fade;
      head.scale.setScalar(0.1 + 0.04 * Math.sin(t * 12));
      chip.position.copy(p).add(new THREE.Vector3(0, 0.07, 0)); chip.material.opacity = Math.min(clamp01(t / 0.4), fade) * (landed ? 1 - clamp01((t - 2.2) / 0.6) : 1);
      start.material.opacity = 0.8 * fade * (1 - clamp01(t / 2));
      if (!landed && g >= 0.999) { landed = true; fx.burst(c.clone(), col.getHex(), 26, 0.4, 0.026); sfx.pop?.(); }
      if (t > 4.6) { parent.remove(root); tube.geometry.dispose(); mat.dispose(); return false; }
      return true;
    },
  };
}

// ------------------------------------------------------------ the room's own light
// Once a second the camera picture is averaged (16×16 pixels): its colour tints the scene's lights and its brightness dims or lifts them,
// so a model under a warm lamp looks warm and one in a dim room is not floodlit. Changes glide; nothing here costs a frame.
const room = { tint: new THREE.Color(1, 1, 1), gain: 1, tTint: new THREE.Color(1, 1, 1), tGain: 1, at: 0, cv: null };
export function roomLight(video, now, dt, lightsList) {
  if (video && video.videoWidth && now - room.at > 1000) {
    room.at = now;
    try {
      room.cv ||= Object.assign(document.createElement('canvas'), { width: 16, height: 16 });
      const g = room.cv.getContext('2d', { willReadFrequently: true });
      g.drawImage(video, 0, 0, 16, 16);
      const d = g.getImageData(0, 0, 16, 16).data; let r = 0, gg = 0, b = 0;
      for (let i = 0; i < d.length; i += 4) { r += d[i]; gg += d[i + 1]; b += d[i + 2]; }
      const n = d.length / 4; r /= n; gg /= n; b /= n;
      const m = Math.max(r, gg, b, 1), lum = 0.3 * r + 0.59 * gg + 0.11 * b;
      room.tTint.setRGB(1 + (r / m - 1) * 0.4, 1 + (gg / m - 1) * 0.4, 1 + (b / m - 1) * 0.4);
      room.tGain = Math.min(1.12, Math.max(0.68, 0.55 + lum / 300));
    } catch { /* a protected video frame: keep the last light */ }
  }
  const k = 1 - Math.exp(-2 * dt);
  room.tint.lerp(room.tTint, k); room.gain += (room.tGain - room.gain) * k;
  for (const L of lightsList) {
    if (!L) continue;
    L.userData.base ??= { c: L.color.clone(), i: L.intensity };
    L.color.copy(L.userData.base.c).multiply(room.tint); L.intensity = L.userData.base.i * room.gain;
  }
}

// ------------------------------------------------------------ the printed figure itself rises from the paper
// A snapshot of the page region the camera recognised is laid exactly over the print, then peels up, floats and melts into gold light
// while the scene grows underneath: the drawing seems to leave the paper and become the model.
const LIFT_V = 'varying vec2 vUv; varying vec2 vP; attribute vec2 aP; void main(){ vUv = uv; vP = aP; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }';
const LIFT_F = `uniform sampler2D map; uniform float uK; varying vec2 vUv; varying vec2 vP;
void main(){
  vec4 c = texture2D(map, vUv);
  float edge = min(min(vP.x, 1.0 - vP.x), min(vP.y, 1.0 - vP.y));
  float soft = smoothstep(0.0, 0.08, edge);
  float n = fract(sin(dot(floor(vP * 46.0), vec2(12.9898, 78.233))) * 43758.5453);
  float gone = smoothstep(uK * 1.25 - 0.25, uK * 1.25, n * 0.6 + (1.0 - vP.y) * 0.4);
  float rim = smoothstep(0.0, 0.12, gone) * (1.0 - smoothstep(0.12, 0.3, gone));
  vec3 col = c.rgb + vec3(1.0, 0.82, 0.45) * (rim * 0.9 + uK * 0.25);
  float a = soft * gone * (1.0 - smoothstep(0.8, 1.0, uK));
  if (a < 0.01) discard;
  gl_FragColor = vec4(col, a);
}`;
export function liftOff({ parent, frame, rect, fx, color = 0xffd27a }) {
  if (!frame?.tex) return null;
  const [u0, v0, u1, v1] = rect, N = 10, pos = [], uv = [], ap = [], idx = [], v = new THREE.Vector3();
  let inside = 0;
  for (let j = 0; j <= N; j++) for (let i = 0; i <= N; i++) {
    const a = i / N, b = j / N, x = u0 + (u1 - u0) * a - 0.5, z = (v0 + (v1 - v0) * b - 0.5) * PAGE_H;
    pos.push(x, 0, z); ap.push(a, 1 - b);
    const q = frame.uv(v.set(x, 0, z)); uv.push(q[0], q[1]);
    if (q[0] > 0 && q[0] < 1 && q[1] > 0 && q[1] < 1) inside++;
  }
  if (inside < (N + 1) * (N + 1) * 0.6) { frame.tex.dispose(); return null; }   // most of the figure must be in the camera picture
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) { const a = j * (N + 1) + i, b = a + 1, c = a + N + 1, d = c + 1; idx.push(a, c, b, b, c, d); }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setAttribute('aP', new THREE.Float32BufferAttribute(ap, 2)); geo.setIndex(idx);
  const U = { map: { value: frame.tex }, uK: { value: 0 } };
  const mesh = new THREE.Mesh(geo, new THREE.ShaderMaterial({ uniforms: U, vertexShader: LIFT_V, fragmentShader: LIFT_F, transparent: true, depthWrite: false, side: THREE.DoubleSide }));
  mesh.renderOrder = 20; mesh.frustumCulled = false;
  const cx = (u0 + u1) / 2 - 0.5, cz = ((v0 + v1) / 2 - 0.5) * PAGE_H;
  const holder = new THREE.Group(); holder.position.set(cx, 0, cz); mesh.position.set(-cx, 0, -cz); holder.add(mesh); parent.add(holder);
  let t = 0, sparked = false;
  return {
    update(dt) {
      t += dt; const k = clamp01(t / (globalThis.__liftDur || 1.5)), e = ease(k);   // __liftDur: local checks only
      U.uK.value = k;
      holder.position.y = 0.002 + e * 0.2; holder.rotation.x = -0.25 * e; holder.scale.setScalar(1 - 0.12 * e);
      if (!sparked && k > 0.45) { sparked = true; fx.burst(new THREE.Vector3(cx, 0.14, cz), color, 22, 0.42, 0.026); }
      if (k >= 1) { parent.remove(holder); geo.dispose(); mesh.material.dispose(); frame.tex.dispose(); return false; }
      return true;
    },
  };
}

// ------------------------------------------------------------ the video plays on the paper
// A YouTube player in a panel that stands on a point of the page and follows it, always facing the reader.
let panel = null, holder = null, layer = null;
const PW = 960, PH = 600;
const corners = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];
export const paperVideo = {
  get open() { return !!panel; },
  async show({ parent, id, stageEl, onClose }) {
    this.close();
    layer = document.createElement('div');
    Object.assign(layer.style, { position: 'absolute', inset: '0', pointerEvents: 'none', zIndex: '3', overflow: 'hidden' });
    const box = document.createElement('div');
    Object.assign(box.style, { position: 'absolute', left: '0', top: '0', width: PW + 'px', height: PH + 'px', transformOrigin: '0 0', background: '#0b1020', borderRadius: '28px', overflow: 'hidden', pointerEvents: 'auto', boxShadow: '0 30px 80px rgba(0,0,0,.55)', border: '6px solid #d4ad55', display: 'flex', flexDirection: 'column', boxSizing: 'border-box', visibility: 'hidden' });
    const top = document.createElement('div');
    Object.assign(top.style, { height: '64px', flex: 'none', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 22px', background: '#141b30', color: '#f4d98a', font: '700 28px Tajawal, sans-serif', direction: 'rtl' });
    const x = document.createElement('button'); x.textContent = '✕'; x.setAttribute('aria-label', 'أغلق الفيديو');
    Object.assign(x.style, { font: '700 34px Tajawal, sans-serif', color: '#fff', background: 'transparent', border: '0', cursor: 'pointer', padding: '6px 14px' });
    const yt = document.createElement('a'); yt.textContent = 'افتح في يوتيوب ↗'; yt.href = `https://www.youtube.com/watch?v=${id}`; yt.target = '_blank'; yt.rel = 'noopener';
    Object.assign(yt.style, { color: '#f4d98a', textDecoration: 'none' });
    top.append(x, yt);
    const fr = document.createElement('iframe');
    fr.src = `https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}?autoplay=1&playsinline=1&rel=0&modestbranding=1`;
    fr.allow = 'autoplay; encrypted-media; picture-in-picture; fullscreen'; fr.allowFullscreen = true; fr.title = 'فيديو الصفحة';
    Object.assign(fr.style, { border: '0', width: '100%', flex: '1' });
    box.append(top, fr); layer.append(box); stageEl.appendChild(layer);
    panel = { box, stageEl, anchor: [new THREE.Vector3(0, 0.02, -0.05), new THREE.Vector3(-0.5, 0.02, -0.05), new THREE.Vector3(0.5, 0.02, -0.05)] };
    holder = parent;
    x.onclick = (ev) => { ev.stopPropagation(); this.close(); onClose?.(); };
  },
  // The panel always faces the reader: an upright rectangle (never skewed) whose bottom centre sits on a point of the page and whose
  // width follows the page's size on screen. Only a move and a uniform scale are applied.
  render(scene, camera) {
    if (!panel || !holder) return;
    const el = panel.stageEl, cv = el.querySelector('canvas'), sr = el.getBoundingClientRect(), cr = cv ? cv.getBoundingClientRect() : sr;
    const W = cr.width, H = cr.height, ox = cr.left - sr.left, oy = cr.top - sr.top;
    holder.updateWorldMatrix(true, false);
    const pt = [];
    for (let i = 0; i < 3; i++) {
      const v = corners[i].copy(panel.anchor[i]).applyMatrix4(holder.matrixWorld).project(camera);
      if (!(v.z < 1) || !Number.isFinite(v.x)) { panel.box.style.visibility = 'hidden'; return; }
      pt.push([ox + (v.x * 0.5 + 0.5) * W, oy + (-v.y * 0.5 + 0.5) * H]);
    }
    // pt[0]: where the panel stands; pt[1], pt[2]: the page's left and right edges at that depth (its width on screen)
    const pageW = Math.hypot(pt[2][0] - pt[1][0], pt[2][1] - pt[1][1]);
    const w = Math.min(sr.width * 0.92, Math.max(sr.width * 0.5, pageW * 0.8)), s = w / PW;
    const x = Math.min(sr.width - w - 6, Math.max(6, pt[0][0] - w / 2));
    const y = Math.min(sr.height - PH * s - 90, Math.max(70, pt[0][1] - PH * s));
    panel.box.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) scale(${s.toFixed(4)})`;
    panel.box.style.visibility = 'visible';
  },
  resize() {},
  close() {
    if (!panel) return;
    layer?.remove(); layer = null; panel = null; holder = null;
  },
};
