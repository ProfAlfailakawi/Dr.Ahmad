// p379: the mobile phone taken apart. A landscape phone floats open into five layers + a camera module; touch a part and it lifts, lights and tells the idea it carries.
import * as THREE from 'three';
import { P, ease, easeBack, clamp01, stag, mat, glossy, goldMat, glow } from '../../kit.js?v=37';
import { halos, liveTag, motes, blob, dais, canvasTex, TAU } from '../lib/a4-kit.js?v=37';

export const meta = { free: true, center: [0.45, 0.5], typeLabel: 'فكّك الجهاز', title: 'فكّك الجوال: التعلّم المتنقل' };

const L = 0.3, W = 0.13, T = 0.008;
const PX = -0.05; // the phone sits a little left, the camera module right
const PARTS = [
  { id: 'battery', c: 0xf0a030, tag: 'الحجم والوزن', title: 'أصغر وأخفّ وأرخص', body: 'منذ ١٩٨٥ صغر حجم الهاتف النقال وقلّ وزنه وانخفضت أسعاره وأسعار المكالمات، فازدادت سرعة انتشاره.', y0: 0.034, y1: 0.14 },
  { id: 'board', c: 0x23a07a, tag: 'ثورة المعلومات', title: 'الثورة الإلكترونية', body: 'في أوائل الثمانينات بدأت «موتورولا» صناعة الهواتف المحمولة، مع ظهور تكنولوجيا المعلومات وعصر المعرفة.', y0: 0.046, y1: 0.24 },
  { id: 'antenna', c: 0xd4ad55, tag: 'اللاسلكي', title: 'الثورة اللاسلكية', body: 'ظهر الهاتف الجوال، وانتشرت الأجهزة اللاسلكية بسرعة فائقة وبأعداد كبيرة في العالم.', y0: 0.058, y1: 0.34 },
  { id: 'screen', c: 0xe8453c, tag: 'الإنترنت', title: 'من الصوت إلى الإنترنت', body: 'تعددت الاستخدامات والتطبيقات: بدءاً من الصوت، ثم الصورة، ثم البلوتوث، وأخيراً الإنترنت.', y0: 0.07, y1: 0.44 },
  { id: 'camera', c: 0x3a86d6, tag: 'الصورة', title: 'ثم جاءت الصورة', body: 'بعد الصوت أضاف الهاتف المحمول الصورة، فصار أداة للتعلم أينما كان الطالب.', y0: 0.07, y1: 0.24 },
];

const rr = (w, h, r) => { const s = new THREE.Shape(); const x = -w / 2, y = -h / 2; s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r); s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h); s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r); s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y); return s; };
// a flat rounded plate (landscape phone layer); optional window cut out
function plate(w, d, t, r, color, o = {}) {
  const s = rr(w, d, r);
  if (o.hole) s.holes.push(rr(w - o.hole, d - o.hole, Math.max(0.004, r - o.hole / 2)));
  const geo = new THREE.ExtrudeGeometry(s, { depth: t, bevelEnabled: true, bevelSize: 0.0025, bevelThickness: 0.0025, bevelSegments: 2, curveSegments: 6 });
  geo.rotateX(-Math.PI / 2); geo.translate(0, -t / 2, 0);
  const m = new THREE.Mesh(geo, o.material || (o.glossy ? glossy(color) : mat(color, { roughness: o.rough ?? 0.5, metalness: o.metal ?? 0.05 })));
  m.castShadow = true; return m;
}
const flat = (w, d, map, y, o = {}) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), new THREE.MeshBasicMaterial({ map, toneMapped: false, transparent: !!o.transparent })); m.rotation.x = -Math.PI / 2; m.position.y = y; return m; };

const boltTex = () => canvasTex(128, 128, (c, w, h) => { c.clearRect(0, 0, w, h); c.fillStyle = '#fff6df'; c.beginPath(); c.moveTo(74, 10); c.lineTo(30, 72); c.lineTo(58, 72); c.lineTo(48, 118); c.lineTo(98, 52); c.lineTo(68, 52); c.closePath(); c.fill(); });
const boardTex = () => canvasTex(512, 256, (c, w, h) => {
  c.fillStyle = '#19805f'; c.fillRect(0, 0, w, h);
  c.strokeStyle = 'rgba(244,222,150,.75)'; c.lineWidth = 3; c.lineCap = 'round';
  const rows = [30, 62, 94, 126, 158, 190, 222];
  rows.forEach((y, i) => { c.beginPath(); c.moveTo(14, y); c.lineTo(70 + i * 18, y); c.lineTo(100 + i * 18, y + (i % 2 ? 16 : -16)); c.lineTo(190, y + (i % 2 ? 16 : -16)); c.stroke(); c.beginPath(); c.moveTo(498, y); c.lineTo(430 - i * 12, y); c.lineTo(400 - i * 12, y + (i % 2 ? -14 : 14)); c.lineTo(330, y + (i % 2 ? -14 : 14)); c.stroke(); c.fillStyle = '#f4de96'; c.beginPath(); c.arc(14, y, 5, 0, TAU); c.arc(498, y, 5, 0, TAU); c.fill(); });
});
const screenTex = () => canvasTex(512, 256, (c, w, h) => {
  const g = c.createLinearGradient(0, 0, w, h); g.addColorStop(0, '#f2564b'); g.addColorStop(1, '#c71f1b'); c.fillStyle = g; c.fillRect(0, 0, w, h);
  // globe on books, echoing the printed phone
  const cx = 150, cy = 118;
  c.fillStyle = '#4aa3df'; c.beginPath(); c.arc(cx, cy, 70, 0, TAU); c.fill();
  c.fillStyle = '#6cc58b'; c.beginPath(); c.ellipse(cx - 22, cy - 10, 26, 34, 0.3, 0, TAU); c.ellipse(cx + 30, cy + 20, 20, 26, -0.4, 0, TAU); c.fill();
  c.strokeStyle = 'rgba(255,255,255,.5)'; c.lineWidth = 3; c.beginPath(); c.ellipse(cx, cy, 30, 70, 0, 0, TAU); c.moveTo(cx - 70, cy); c.lineTo(cx + 70, cy); c.stroke();
  ['#f4efe3', '#4a90d9', '#f0a030'].forEach((k, i) => { c.fillStyle = k; c.fillRect(70 + i * 6, 196 + i * 18, 160 - i * 12, 14); });
  // four service dots: voice, image, bluetooth, internet
  [['#fff'], ['#fbd36b'], ['#8fd0ff'], ['#9be3b0']].forEach((k, i) => { const x = 300 + i * 52, y = 128; c.fillStyle = 'rgba(255,255,255,.2)'; c.beginPath(); c.arc(x, y, 22, 0, TAU); c.fill(); c.fillStyle = k[0]; c.beginPath(); c.arc(x, y, 9 + i * 1.5, 0, TAU); c.fill(); });
});

export default function build(ctx) {
  const g = new THREE.Group(); g.position.copy(P(meta.center[0], meta.center[1])); ctx.stage.add(g); g.scale.setScalar(1.2);
  const hal = halos(), mo = motes(g, 6, { r: 0.3, h: 0.5, color: 0xcfe6ff });
  g.add(blob(0.3, 0.3));
  const base = dais(0.23, { top: 0xcfe9e6 }); base.position.y = 0; g.add(base);
  const turn = new THREE.Group(); g.add(turn); turn.position.y = 0.0;

  // ---- back shell (the floor of the stack)
  const shell = new THREE.Group(); turn.add(shell);
  shell.add(plate(L, W, 0.012, 0.03, 0x35b4b4, { glossy: true }));
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.012, 0.003, 8, 24), goldMat()); rim.rotation.x = Math.PI / 2; rim.position.set(0.09, 0.008, 0); shell.add(rim);
  shell.position.set(PX, 0.036, 0);

  // ---- parts
  const part = {}, own = [];
  const mk = (id) => { const o = new THREE.Group(); turn.add(o); part[id] = o; return o; };
  // battery
  { const o = mk('battery'); o.add(plate(L, W, T, 0.026, 0x3b4452));
    const b = plate(0.2, 0.09, 0.014, 0.02, 0xf0a030, { glossy: true }); b.position.y = 0.01; o.add(b);
    const cap = plate(0.016, 0.034, 0.01, 0.006, 0xd9d3c4); cap.position.set(0.11, 0.008, 0); o.add(cap);
    const bt = flat(0.075, 0.075, boltTex(), 0.0185, { transparent: true }); o.add(bt); }
  // board
  { const o = mk('board'); o.add(plate(L, W, T, 0.026, 0x14604a));
    o.add(flat(L - 0.018, W - 0.018, boardTex(), 0.0066));
    [[-0.07, -0.01, 0.07, 0.05], [0.05, 0.02, 0.05, 0.05], [0.07, -0.04, 0.035, 0.03]].forEach(([x, z, a, b], i) => {
      const c = new THREE.Mesh(new THREE.BoxGeometry(a, 0.012, b), mat(i ? 0x22252b : 0x1b1f26, { metalness: 0.4, roughness: 0.35 })); c.position.set(x, 0.012, z); o.add(c);
      const pin = new THREE.Mesh(new THREE.BoxGeometry(a * 1.12, 0.003, b * 1.12), goldMat()); pin.position.set(x, 0.0075, z); o.add(pin); }); }
  // antenna frame + waves
  const waves = [];
  { const o = mk('antenna'); o.add(plate(L, W, 0.01, 0.028, 0xd4ad55, { hole: 0.034, material: goldMat() }));
    const bar = plate(0.1, 0.012, 0.01, 0.005, 0xd4ad55, { material: goldMat() }); bar.position.set(-0.1, 0, 0); o.add(bar);
    [0.035, 0.06, 0.085].forEach((r, i) => { const a = new THREE.Mesh(new THREE.TorusGeometry(r, 0.0032, 8, 28, Math.PI), new THREE.MeshBasicMaterial({ color: 0xffe08a, transparent: true, opacity: 0.9, toneMapped: false })); a.rotation.set(0, 0, 0); a.position.set(0.0, 0.01, 0); a.rotation.x = -Math.PI / 2; a.rotation.z = -Math.PI / 2; a.position.x = -0.1; o.add(a); waves.push(a); }); }
  // screen
  { const o = mk('screen'); o.add(plate(L, W, 0.01, 0.03, 0x1b2026, { glossy: true }));
    o.add(flat(L - 0.03, W - 0.03, screenTex(), 0.0092));
    const glass = plate(L - 0.01, W - 0.01, 0.002, 0.028, 0xffffff, { material: new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.05, transparent: true, opacity: 0.12, depthWrite: false }) }); glass.castShadow = false; glass.position.y = 0.0105; o.add(glass); }
  // camera module
  { const o = mk('camera');
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.04, 0.034, 28), mat(0x23282f, { metalness: 0.5, roughness: 0.35 })); body.castShadow = true; o.add(body);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.03, 0.004, 10, 36), goldMat()); ring.rotation.x = Math.PI / 2; ring.position.y = 0.018; o.add(ring);
    const lens = new THREE.Mesh(new THREE.SphereGeometry(0.024, 24, 12, 0, TAU, 0, Math.PI / 2), glossy(0x1d4f9c, { emissive: 0x1d4f9c, emissiveIntensity: 0.4 })); lens.position.y = 0.017; lens.scale.y = 0.55; o.add(lens);
    const sp = new THREE.Mesh(new THREE.SphereGeometry(0.005, 10, 8), new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false })); sp.position.set(-0.01, 0.03, -0.008); o.add(sp); }

  // vertical guide lines (exploded-view hallmark)
  const guides = [[-0.15 + PX, -0.06], [0.15 + PX, -0.06], [-0.15 + PX, 0.06], [0.15 + PX, 0.06]].map(([x, z]) => {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(0.0016, 0.0016, 1, 5), new THREE.MeshBasicMaterial({ color: 0xd4ad55, transparent: true, opacity: 0.55 })); m.position.set(x, 0, z); turn.add(m); return m; });
  const camGuide = new THREE.Mesh(new THREE.CylinderGeometry(0.0016, 0.0016, 1, 5), new THREE.MeshBasicMaterial({ color: 0xd4ad55, transparent: true, opacity: 0.55 })); turn.add(camGuide);

  // ---- state
  const hs = {}; PARTS.forEach((p) => { hs[p.id] = hal.add(part[p.id], p.c, 0.3, [0, 0.0, 0], 3.5); });
  const found = new Set(); let focus = -1, ex = 0, exT = 1, lift = new Float32Array(PARTS.length), now = 0, finished = false;
  const tag = liveTag(0.25, 0xd4ad55, { size: 58 }); tag.set('فكّك الجوال'); g.add(tag.sp); tag.apply(0); tag.sp.position.set(0, 0.56, 0);
  let tagK = 0, tagT = 0, tagC = 0xd4ad55;
  ctx.ui.hud('المس جزءاً من الجوال');

  PARTS.forEach((p, i) => {
    ctx.tap(part[p.id], () => {
      if (now < 4.8) return;
      if (finished) { exT = 1; }
      focus = i; ctx.sfx.pop?.();
      const wp = part[p.id].getWorldPosition(new THREE.Vector3()); ctx.fx.burst(wp, p.c, 12, 0.25, 0.026);
      tag.set(p.tag, p.c); tagT = 1;
      ctx.ui.card({ tag: `جزء ${['', '١', '٢', '٣', '٤', '٥'][found.size + (found.has(p.id) ? 0 : 1)]} من ٥`, title: p.title, body: p.body, color: p.c });
      found.add(p.id);
      ctx.ui.hud(found.size < 5 ? `اكتشفت ${['', '١', '٢', '٣', '٤'][found.size]} من ٥ أجزاء` : 'جوال كامل: فكرة في كل طبقة');
      if (found.size === 5 && !finished) {
        finished = true;
        setTimeout(() => { exT = 0; focus = -1; ctx.sfx.good?.(); ctx.fx.burst(g.position.clone().add(new THREE.Vector3(0, 0.15, 0)), 0xffd27a, 44, 0.5, 0.04); ctx.ui.done(); }, 1200);
      }
    });
  });
  ctx.tap(shell, () => { if (now < 4.8) return; ctx.sfx.pop?.(); ctx.ui.card({ tag: 'سباق المليار', title: '١٢٨ عاماً مقابل عشرين', body: 'الهواتف الثابتة احتاجت ١٢٨ عاماً لتصل إلى مليار مستخدم، والمحمول حقق ذلك في زمن لا يكاد يتجاوز عشرين عاماً.', color: 0x35b4b4 }); });

  const CAMX = 0.2;
  return {
    update(t, dt, e) {
      now = t; hal.update(t, e); mo.update(t, dt, e);
      if (t > 3.2) ex = THREE.MathUtils.damp(ex, exT, 2.6, dt); else ex = 0;
      const k0 = stag(t, 0.2, 0.7, easeBack) * e;
      shell.scale.setScalar(Math.max(k0, 0.0001));
      let top = 0.05;
      PARTS.forEach((p, i) => {
        const o = part[p.id], k = stag(t, 0.5 + i * 0.35, 0.7, easeBack) * e;
        o.visible = k > 0.002; o.scale.setScalar(Math.max(k, 0.0001));
        lift[i] = THREE.MathUtils.damp(lift[i], focus === i ? 0.055 : 0, 6, dt);
        const y = THREE.MathUtils.lerp(p.y0 - 0.0, p.y1, ex) + lift[i] + Math.sin(t * 1.3 + i) * 0.004 * ex + (1 - stag(t, 0.5 + i * 0.35, 0.7)) * 0.1;
        if (p.id === 'camera') { o.position.set(PX + 0.19 + CAMX * ex * 0.4, y, 0.0); o.rotation.y = t * 0.5 * (focus === i ? 3 : 1); }
        else { o.position.set(PX, y, 0); o.rotation.y = focus === i ? Math.sin(t * 1.5) * 0.12 : 0; }
        o.position.y = Math.max(o.position.y, 0.0001);
        if (y > top) top = y;
        const h = hs[p.id]; h.on = (focus === i ? 1.1 : 0.55) * (found.has(p.id) ? 1.0 : 1.0); h.size = focus === i ? 0.42 : 0.3;
      });
      waves.forEach((w, i) => { w.material.opacity = 0.35 + 0.55 * Math.max(0, Math.sin(t * 3 - i * 0.9)); w.scale.setScalar(1 + 0.06 * Math.sin(t * 3 - i * 0.9)); });
      const gh = 0.04 + 0.42 * ex;
      guides.forEach((m) => { m.scale.y = Math.max(0.001, gh); m.position.y = 0.036 + gh / 2; m.visible = ex > 0.05; m.material.opacity = 0.5 * ex * e; });
      camGuide.visible = ex > 0.05; camGuide.position.set(PX + 0.19 + CAMX * ex * 0.4, 0.036 + (part.camera.position.y - 0.036) / 2, 0); camGuide.scale.y = Math.max(0.001, part.camera.position.y - 0.036); camGuide.material.opacity = 0.5 * ex * e;
      turn.rotation.set(0, 0, 0); turn.rotateY(-0.45 + (focus >= 0 ? 0 : Math.sin(t * 0.3) * 0.12));
      tagK = THREE.MathUtils.damp(tagK, tagT, 6, dt);
      tag.sp.position.y = 0.52 + 0.12 * ex; tag.apply(easeBack(tagK) * e);
    },
  };
}
