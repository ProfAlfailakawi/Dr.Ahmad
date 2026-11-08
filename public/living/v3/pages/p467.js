// p467 — a school-less society: four gold slabs on a navy plinth; each turns from the classical school (paper face) to its virtual twin (navy face).
// Light build: every miniature is ONE merged vertex-coloured mesh, the words are painted into the face textures.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { mat, glossy, goldMat, shadowed, clamp01 } from '../../kit.js?v=20';
import { scene, RoundedBox, TAU, contactShadow, paint } from '../lib/b8-kit.js?v=20';
export const meta = { free: true, center: [0.42, 0.62], typeLabel: 'مجسّم تفاعلي' };

const GOLD = 0xd4ad55, CY = 0x4cc9f0;
const INFO = [
  { t: 'مكان التعلم', b: 'مبنى بمواعيد محددة، أم مراكز تعمل على مدار ٢٤ ساعة في اليوم و٧ أيام في الأسبوع؟', c: 0xf08a1c },
  { t: 'وسيط التعلم', b: 'كتب تقليدية هي الأساس، أم حواسيب تحل محلها وتصبح العنصر الأساسي؟', c: 0x2b72c9 },
  { t: 'من يعلّم؟', b: 'يسمع الطلبة معلمهم داخل الصف، أم من خلال الحواسيب والأجهزة الذكية؟', c: 0x2e9e6e },
  { t: 'الحاجة للمدرسة', b: 'قائمة للتعلم كله، أم تبقى لتنمية المهارات الاجتماعية فقط؟', c: 0xe0527f },
];
const OLD = ['المدرسة', 'الكتب', 'المعلم', 'المدرسة'], NEW = ['بلا مدرسة', 'الحواسيب', 'الشاشة', 'للمهارات'];

// painted slab faces (one canvas each, 256x440)
const face = (word, navy) => paint(256, 440, (x, w, h) => {
  const gr = x.createLinearGradient(0, 0, 0, h);
  if (navy) { gr.addColorStop(0, '#2a4a8a'); gr.addColorStop(1, '#14213f'); } else { gr.addColorStop(0, '#fbf1d8'); gr.addColorStop(1, '#ecd9aa'); }
  x.fillStyle = gr; x.fillRect(0, 0, w, h);
  if (navy) { x.fillStyle = 'rgba(120,210,255,.45)'; for (let i = 0; i < 50; i++) { x.beginPath(); x.arc((i * 97) % w, (i * 61) % h, 1.4 + (i % 3), 0, TAU); x.fill(); } }
  else { x.strokeStyle = 'rgba(160,120,50,.22)'; x.lineWidth = 3; for (let i = 0; i < 6; i++) { x.beginPath(); x.moveTo(0, 150 + i * 50); x.lineTo(w, 150 + i * 50); x.stroke(); } }
  x.strokeStyle = navy ? 'rgba(160,225,255,.7)' : 'rgba(150,105,40,.6)'; x.lineWidth = 5; x.strokeRect(10, 10, w - 20, h - 20);
  x.fillStyle = navy ? '#bfeaff' : '#6b4a1e'; x.font = '800 54px Tajawal, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(word, w / 2, 62);
});

// merge simple parts into one vertex-coloured mesh. part = [geometry, colour, x, y, z, rx, ry, rz, sx, sy, sz]
const M4 = new THREE.Matrix4(), Q = new THREE.Quaternion(), E = new THREE.Euler(), S3 = new THREE.Vector3(), T3 = new THREE.Vector3(), C = new THREE.Color();
function mini(parts, material) {
  const gs = parts.map(([geo, col, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1]) => {
    const g = geo.index ? geo.toNonIndexed() : geo.clone();
    g.deleteAttribute('uv');
    M4.compose(T3.set(x, y, z), Q.setFromEuler(E.set(rx, ry, rz)), S3.set(sx, sy, sz)); g.applyMatrix4(M4);
    C.set(col); const n = g.attributes.position.count, a = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { a[i * 3] = C.r; a[i * 3 + 1] = C.g; a[i * 3 + 2] = C.b; }
    g.setAttribute('color', new THREE.BufferAttribute(a, 3)); return g;
  });
  return new THREE.Mesh(mergeGeometries(gs), material);
}
const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
const cyl = (r, h, n = 14, r2 = r) => new THREE.CylinderGeometry(r, r2, h, n);
const PAPER = 0xf7f1e4, BROWN = 0xa9573b, BLUE = 0x2b72c9, WOOD = 0x7a4a32, LIGHT = 0xbfeaff, SCR = 0x7fd6ff, DK = 0x25282f;
const bellProf = [[0.003, 0], [0.026, 0], [0.024, 0.006], [0.016, 0.022], [0.012, 0.036], [0.004, 0.044]].map(([x, y]) => new THREE.Vector2(x, y));
const ICON_OLD = [
  [[box(0.12, 0.01, 0.05), PAPER, 0, 0.005, 0], ...[0, 1, 2, 3].map((i) => [cyl(0.0055, 0.05), PAPER, -0.045 + i * 0.03, 0.035, 0.012]), [new THREE.ConeGeometry(0.075, 0.034, 4), 0xd4ad55, 0, 0.077, 0, 0, Math.PI / 4, 0, 1, 1, 0.55], [box(0.03, 0.036, 0.006), BROWN, 0, 0.028, -0.004]],
  [[box(0.1, 0.014, 0.062), BROWN, 0, 0.007, 0, 0, 0.1], [box(0.09, 0.013, 0.062), BLUE, 0, 0.0205, 0, 0, -0.14], [box(0.08, 0.012, 0.062), 0xe8c9a0, 0, 0.033, 0, 0, 0.2], [box(0.07, 0.012, 0.062), WOOD, 0, 0.045, 0, 0, -0.08]],
  [[box(0.12, 0.075, 0.008), 0x2f5a46, 0.01, 0.07, -0.014], [box(0.126, 0.081, 0.006), WOOD, 0.01, 0.07, -0.019], [box(0.06, 0.003, 0.002), PAPER, 0.02, 0.085, -0.009], [box(0.04, 0.003, 0.002), PAPER, 0.02, 0.07, -0.009],
    [new THREE.CapsuleGeometry(0.014, 0.04, 4, 10), 0x3d4f6b, -0.045, 0.034, 0.01], [new THREE.SphereGeometry(0.0145, 12, 10), 0xe3b894, -0.045, 0.075, 0.01]],
  [[cyl(0.004, 0.09), GOLD, 0, 0.045, -0.006], [box(0.06, 0.006, 0.006), GOLD, 0.025, 0.09, -0.006], [new THREE.LatheGeometry(bellProf, 20), GOLD, 0.05, 0.043, -0.006], [new THREE.SphereGeometry(0.006, 8, 6), WOOD, 0.05, 0.041, -0.006]],
];
const ICON_NEW = [
  [[new THREE.TorusGeometry(0.048, 0.005, 8, 40), CY, 0, 0.062, 0], [cyl(0.032, 0.004, 24), 0x12305a, 0, 0.062, 0, Math.PI / 2], [box(0.005, 0.036, 0.005), 0xffd27a, 0, 0.078, 0.004], [box(0.005, 0.024, 0.005), LIGHT, 0.012, 0.056, 0.004, 0, 0, 1.0], [cyl(0.005, 0.014), GOLD, 0, 0.007, 0, 0, 0, 0, 1, 1, 1]],
  [[box(0.11, 0.006, 0.07), 0xc9ccd2, 0, 0.003, 0], [box(0.09, 0.03, 0.002), 0x3a3d44, 0, 0.0075, 0.006, -Math.PI / 2, 0, 0, 1, 1, 1], [box(0.11, 0.07, 0.005), 0xc9ccd2, 0, 0.04, -0.034, -0.3], [box(0.1, 0.06, 0.002), SCR, 0, 0.04, -0.0305, -0.3]],
  [[box(0.11, 0.075, 0.01), DK, 0, 0.062, 0], [box(0.1, 0.064, 0.002), 0x163a66, 0, 0.062, 0.0055], [new THREE.SphereGeometry(0.014, 12, 10), SCR, 0, 0.068, 0.0075], [cyl(0.005, 0.026), DK, 0, 0.013, 0], [box(0.05, 0.004, 0.03), DK, 0, 0.002, 0],
    [new THREE.TorusGeometry(0.03, 0.0016, 6, 24, Math.PI * 0.9), CY, 0.062, 0.062, 0.003, 0, 0, -Math.PI * 0.45]],
  [...[[-0.034, 0xf08a1c], [0, BLUE], [0.034, 0x2e9e6e]].flatMap(([x, c]) => [[new THREE.CapsuleGeometry(0.011, 0.026, 4, 10), c, x, 0.03, 0], [new THREE.SphereGeometry(0.0115, 12, 10), 0xe3b894, x, 0.062, 0]]),
    [new THREE.TorusGeometry(0.0095, 0.0022, 6, 12, Math.PI), GOLD, -0.017, 0.038, 0.002], [new THREE.TorusGeometry(0.0095, 0.0022, 6, 12, Math.PI), GOLD, 0.017, 0.038, 0.002], [new THREE.TorusGeometry(0.058, 0.0018, 6, 40), CY, 0, 0.002, 0, Math.PI / 2]],
];

export default function build(ctx) {
  const S = scene(ctx, meta), g = S.g;
  const base = new THREE.Mesh(new RoundedBox(0.62, 0.028, 0.22, 0.03), glossy(0x2f3f66, { roughness: 0.35, clearcoat: 0.8 })); base.position.y = 0.014; g.add(shadowed(base));
  const brim = new THREE.Mesh(new RoundedBox(0.626, 0.005, 0.226, 0.03), goldMat()); brim.position.y = 0.024; g.add(brim);
  const under = new THREE.Mesh(new RoundedBox(0.54, 0.012, 0.17, 0.03), mat(0x2b2724)); under.position.y = -0.005; g.add(under);
  S.part(base, 0.1, { rise: 0.06 }); S.part(brim, 0.2, { rise: 0.06 }); S.part(under, 0.15, { rise: 0.06 });
  g.add(contactShadow(0.74, 0.32, 0.3));
  const slabGeo = new RoundedBox(0.125, 0.24, 0.03, 0.012), pivGeo = new THREE.CylinderGeometry(0.05, 0.055, 0.012, 24), planeGeo = new THREE.PlaneGeometry(0.114, 0.215), ledGeo = new RoundedBox(0.12, 0.01, 0.07, 0.004);
  const bodyM = glossy(0xe0b85e, { metalness: 0.7, roughness: 0.3 }), ledFM = glossy(0xf7efdc), ledBM = glossy(0x1c2f58), pivM = goldMat();
  const oldM = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.45 });
  const newM = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.35, emissive: 0x1a3550, emissiveIntensity: 0.8 });
  const slabs = [-0.21, -0.07, 0.07, 0.21].map((x, i) => {
    const holder = new THREE.Group(); holder.position.set(x, 0.028, 0); g.add(holder);
    const sl = new THREE.Group(); holder.add(sl);
    const pivot = new THREE.Mesh(pivGeo, pivM); pivot.position.y = 0.006; holder.add(pivot);
    const body = new THREE.Mesh(slabGeo, bodyM); body.position.y = 0.13; sl.add(shadowed(body));
    const pf = new THREE.Mesh(planeGeo, new THREE.MeshBasicMaterial({ map: face(OLD[i], false), toneMapped: false })); pf.position.set(0, 0.13, 0.0153); sl.add(pf);
    const pb = new THREE.Mesh(planeGeo, new THREE.MeshBasicMaterial({ map: face(NEW[i], true), toneMapped: false })); pb.position.set(0, 0.13, -0.0153); pb.rotation.y = Math.PI; sl.add(pb);
    const ledF = new THREE.Mesh(ledGeo, ledFM); ledF.position.set(0, 0.05, 0.04); sl.add(ledF);
    const ledB = new THREE.Mesh(ledGeo, ledBM); ledB.position.set(0, 0.05, -0.04); sl.add(ledB);
    const mo = mini(ICON_OLD[i], oldM), mn = mini(ICON_NEW[i], newM);
    mo.position.set(0, 0.055, 0.042); mn.position.set(0, 0.055, -0.042); mo.scale.setScalar(0.95); mn.scale.setScalar(0.95); mn.rotation.y = Math.PI; sl.add(mo, mn);
    S.part(sl, 0.6 + i * 0.3, { rise: 0.1 }); S.part(pivot, 0.5 + i * 0.3, { rise: 0.05 });
    return { holder, sl, mo, mn, x, i, rot: 0, tg: 0, spin: -9 };
  });
  const flipped = new Set(); let finished = false, auto = 0;
  const flip = (s, byUser) => {
    s.tg = s.tg === 0 ? Math.PI : 0; s.spin = S.now; ctx.sfx.whoosh?.();
    S.burst(new THREE.Vector3(s.x, 0.15, 0), s.tg ? CY : GOLD, 20, 0.4);
    if (!byUser) return;
    const I = INFO[s.i]; ctx.ui.card({ tag: s.tg ? 'بلا مدرسة' : 'المدرسة التقليدية', title: I.t, body: I.b, color: I.c });
    flipped.add(s.i);
    if (flipped.size === 4 && !finished) {
      finished = true;
      setTimeout(() => { ctx.ui.hud('تقدّم الأمم رهين بالاستثمار في الإنسان'); ctx.ui.done(); }, 900);
    }
  };
  slabs.forEach((s) => { const r = S.touch(s.sl, () => flip(s, true), { color: 0xffe3a0, size: 0.2, at: new THREE.Vector3(0, 0.13, 0.02), wake: 5.4 }); r.s.raycast = () => {}; }); // glow sprites never steal a tap
  ctx.ui.hud('المس اللوح ليتحوّل التعليم');

  S.loop((t, dt) => {
    // short demo: the slabs turn once by themselves, then turn back
    if (auto === 0 && t > 3.6) { auto = 1; slabs.forEach((s, i) => { s.demo = 3.6 + i * 0.5; }); }
    if (auto === 1) {
      let allBack = true;
      slabs.forEach((s) => {
        if (s.demo && t > s.demo) { s.demo = 0; if (!s.tg) flip(s, false); s.back = t + 3.2; }
        if (s.back && t > s.back) { s.back = 0; if (s.tg && !flipped.has(s.i)) flip(s, false); }
        if (s.demo || s.back) allBack = false;
      });
      if (allBack) auto = 2;
    }
    slabs.forEach((s) => {
      s.rot = THREE.MathUtils.damp(s.rot, s.tg, 3.4, dt); s.sl.rotation.y = s.rot; s.sl.position.y = Math.sin(clamp01(s.rot / Math.PI) * Math.PI) * 0.03;
      s.mn.rotation.y = Math.PI + Math.sin(t * 0.9 + s.i) * 0.25; s.mo.rotation.y = Math.sin(t * 0.8 + s.i) * 0.12;
    });
  });
  return { update: S.update };
}
