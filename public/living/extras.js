// extras — three things every page shares:
//   memory(): the page remembers the reader. From the second visit on, a gold gem waits in the page corner with a harder question (Bloom: analyse, evaluate, create).
//   bridge(): two facing pages talk. Moving from one page to the page opposite it draws a bridge of light across the gutter, carrying the first page's title over.
//   paperVideo: the page's YouTube video plays on the paper itself, standing on the page and following it, instead of leaving the book.
import * as THREE from 'three';
import { glow, sprite, ease, easeBack, clamp01, PAGE_H } from './kit.js?v=28';

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
export function memory({ parent, taps, ui, sfx, fx, id, title, visits, color = 0xd4ad55 }) {
  const lvl = LEVELS[Math.min(visits - 2, LEVELS.length - 1)];
  const q = lvl.qs[(hash(id) + visits) % lvl.qs.length].replace('$', title);
  const g = new THREE.Group(); g.position.set(0.39, 0, -PAGE_H / 2 + 0.1); parent.add(g); g.visible = false;
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
    fx.burst(new THREE.Vector3(0.39, 0.05, -PAGE_H / 2 + 0.1), 0xffd27a, 18, 0.3, 0.022);
    ui.card({ tag: lvl.tag, title: 'الصفحة تتذكّرك', body: q, color: 0xd4ad55 });
  }]);
  return {
    update(t) {
      if (t < 2.6) { g.visible = false; return; }
      if (shownAt < 0) { shownAt = t; sfx.discover?.(); ui.toast?.('عدت إلى هذه الصفحة · طبقة أعمق تنتظرك ✦'); }
      const k = easeBack(clamp01((t - shownAt) / 0.8));
      g.visible = true; g.scale.setScalar(Math.max(k, 1e-4));
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

// ------------------------------------------------------------ the video plays on the paper
// A flat panel (YouTube player) is laid exactly over four points standing on the page: each frame the four corners are projected with
// the AR camera and the panel gets the CSS perspective transform (homography) that maps its rectangle onto them.
function homography(src, dst) {
  const A = [], b = [];
  for (let i = 0; i < 4; i++) {
    const [x, y] = src[i], [X, Y] = dst[i];
    A.push([x, y, 1, 0, 0, 0, -X * x, -X * y]); b.push(X);
    A.push([0, 0, 0, x, y, 1, -Y * x, -Y * y]); b.push(Y);
  }
  for (let c = 0; c < 8; c++) {   // Gauss-Jordan with partial pivoting
    let piv = c; for (let r = c + 1; r < 8; r++) if (Math.abs(A[r][c]) > Math.abs(A[piv][c])) piv = r;
    [A[c], A[piv]] = [A[piv], A[c]]; [b[c], b[piv]] = [b[piv], b[c]];
    const d = A[c][c]; if (Math.abs(d) < 1e-12) return null;
    for (let r = 0; r < 8; r++) if (r !== c) { const f = A[r][c] / d; for (let k = c; k < 8; k++) A[r][k] -= f * A[c][k]; b[r] -= f * b[c]; }
  }
  const h = b.map((v, i) => v / A[i][i]);
  return [h[0], h[3], 0, h[6], h[1], h[4], 0, h[7], 0, 0, 1, 0, h[2], h[5], 0, 1];
}
let panel = null, holder = null, layer = null;
const PW = 960, PH = 600, WORLD_W = 0.7;
const corners = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];
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
    // the panel stands on the page, leaning back a little, in page coordinates of `parent`
    const h = WORLD_W * PH / PW, y0 = 0.03, z0 = 0.08, lean = 0.32;
    const up = new THREE.Vector3(0, Math.cos(lean), -Math.sin(lean)).multiplyScalar(h);
    const bl = new THREE.Vector3(-WORLD_W / 2, y0, z0), br = new THREE.Vector3(WORLD_W / 2, y0, z0);
    panel = { box, stageEl, local: [bl.clone().add(up), br.clone().add(up), br, bl] };   // top-left, top-right, bottom-right, bottom-left
    holder = parent;
    x.onclick = (ev) => { ev.stopPropagation(); this.close(); onClose?.(); };
  },
  render(scene, camera) {
    if (!panel || !holder) return;
    // MindAR sizes its canvas to the camera picture and shifts it to fill the screen: project into the canvas box, measured from the stage
    const el = panel.stageEl, cv = el.querySelector('canvas'), sr = el.getBoundingClientRect(), cr = cv ? cv.getBoundingClientRect() : sr;
    const W = cr.width, H = cr.height, ox = cr.left - sr.left, oy = cr.top - sr.top;
    holder.updateWorldMatrix(true, false);
    const dst = [];
    for (let i = 0; i < 4; i++) {
      const v = corners[i].copy(panel.local[i]).applyMatrix4(holder.matrixWorld).project(camera);
      if (!(v.z < 1) || !Number.isFinite(v.x)) { panel.box.style.visibility = 'hidden'; return; }
      dst.push([ox + (v.x * 0.5 + 0.5) * W, oy + (-v.y * 0.5 + 0.5) * H]);
    }
    const m = homography([[0, 0], [PW, 0], [PW, PH], [0, PH]], dst);
    if (!m) return;
    panel.box.style.transform = `matrix3d(${m.map((n) => +n.toFixed(8)).join(',')})`;
    panel.box.style.visibility = 'visible';
  },
  resize() {},
  close() {
    if (!panel) return;
    layer?.remove(); layer = null; panel = null; holder = null;
  },
};
