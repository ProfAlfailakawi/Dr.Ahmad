import * as THREE from 'three';
import { P, ease, easeBack, clamp01, stag, mat, glossy, goldMat, shadowed, glow } from '../../kit.js?v=34';
import { animator, shadowBlob, V, TAU } from '../lib/a1-kit.js?v=34';

export const meta = { free: true, center: [0.5, 0.75], typeLabel: 'مجسّم تفاعلي' };

const GOLD = 0xe3b23c, TEAL = 0x2fb6a8, CORAL = 0xf0702a, BLUE = 0x4a90e2, N = 190;
const GATES = [
  { k: 'defs', t: 'تعريفات جديدة', col: BLUE, pos: V(-0.27, 0.36, 0.1), r: 0.11, title: 'تعريفات وتصنيفات جديدة', body: 'استحداث تعريفات وتصنيفات جديدة للمعرفة وما وراء المعرفة.' },
  { k: 'media', t: 'الوسائل', col: CORAL, pos: V(0.27, 0.4, 0.1), r: 0.11, title: 'وسائل التكنولوجيا', body: 'الاستعانة بالتلفزيون والفيديو والدوائر التلفزيونية والحاسب الآلي والإنترنت.' },
  { k: 'res', t: 'البحث العلمي', col: TEAL, pos: V(0.0, 0.56, -0.3), r: 0.14, title: 'البحث العلمي', body: 'طريق ثالث لمواجهة الانفجار المعرفي.' },
];

export default function build(ctx) {
  const g = new THREE.Group(); g.position.copy(P(meta.center[0], meta.center[1])); ctx.stage.add(g);
  const A = animator(ctx, g, 0.88);
  const sh = shadowBlob(0.7, 0.55, 0.32); g.add(sh);

  // a chunky rocket on a three-legged stand
  const stand = new THREE.Group();
  [90, 210, 330].forEach((d) => { const a = d * Math.PI / 180, l = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.012, 0.16, 10), goldMat()); l.position.set(Math.cos(a) * 0.075, 0.075, Math.sin(a) * 0.075); l.rotation.z = -Math.cos(a) * 0.38; l.rotation.x = Math.sin(a) * 0.38; stand.add(l); });
  const collar = new THREE.Mesh(new THREE.TorusGeometry(0.052, 0.01, 10, 36), goldMat()); collar.rotation.x = Math.PI / 2; collar.position.y = 0.15; stand.add(collar); shadowed(stand);
  A.add(stand, { at: 0.05, dur: 0.6, rise: 0.15 });
  const rocket = new THREE.Group(); rocket.position.y = 0.16;
  const rp = [[0.001, 0], [0.05, 0.012], [0.078, 0.07], [0.082, 0.17], [0.07, 0.28], [0.042, 0.37], [0.001, 0.42]].map(([x, y]) => new THREE.Vector2(x, y));
  const hull = new THREE.Mesh(new THREE.LatheGeometry(rp, 40), glossy(0xfff6e6, { roughness: 0.18 })); hull.position.y = 0.05;
  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.047, 24, 16, 0, TAU, 0, Math.PI * 0.62), glossy(CORAL)); nose.position.y = 0.43; nose.scale.y = 1.7;
  const band = new THREE.Mesh(new THREE.TorusGeometry(0.081, 0.007, 10, 40), goldMat()); band.rotation.x = Math.PI / 2; band.position.y = 0.17;
  const band2 = band.clone(); band2.position.y = 0.3; band2.scale.setScalar(0.88);
  const bell = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.055, 0.05, 20, 1, true), goldMat()); bell.position.y = 0.035;
  rocket.add(hull, nose, band, band2, bell);
  [0.23].forEach((y) => { const w = new THREE.Mesh(new THREE.SphereGeometry(0.024, 18, 12), glossy(0x4aa8ff)); w.position.set(0, y, 0.074); w.scale.z = 0.5; const wr = new THREE.Mesh(new THREE.TorusGeometry(0.026, 0.005, 8, 24), goldMat()); wr.position.set(0, y, 0.077); rocket.add(w, wr); });
  for (let i = 0; i < 4; i++) { const f = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.12, 0.07), glossy(CORAL)); const a = i / 4 * TAU + Math.PI / 4; f.position.set(Math.cos(a) * 0.1, 0.11, Math.sin(a) * 0.1); f.rotation.y = -a; f.rotation.z = Math.cos(a) * 0.0; f.rotation.x = 0; rocket.add(f); }
  const flame = glow(0xffb040, 0.28, 0.0); flame.position.y = -0.02; rocket.add(flame);
  shadowed(rocket); rocket.userData.keepY = false; A.add(rocket, { at: 0.2, dur: 0.8, rise: 0.2 }); A.hint(rocket, GOLD, 0.11, 0.0);
  const shock = new THREE.Mesh(new THREE.RingGeometry(0.9, 1.0, 64), new THREE.MeshBasicMaterial({ color: GOLD, transparent: true, opacity: 0, side: THREE.DoubleSide, toneMapped: false, depthWrite: false })); shock.rotation.x = -Math.PI / 2; shock.position.y = 0.004; g.add(shock);

  // three big glass hoops that tame the sparks
  const hoops = GATES.map((d, i) => {
    const gt = new THREE.Group(); gt.position.copy(d.pos); gt.rotation.y = Math.atan2(d.pos.x, d.pos.z) * 0.55;
    const ring = new THREE.Mesh(new THREE.TorusGeometry(d.r, 0.014, 16, 56), glossy(d.col));
    const disc = new THREE.Mesh(new THREE.CircleGeometry(d.r, 40), new THREE.MeshBasicMaterial({ color: d.col, transparent: true, opacity: 0.1, side: THREE.DoubleSide, toneMapped: false, depthWrite: false }));
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.007, 0.01, d.pos.y - 0.02, 10), goldMat()); stem.position.y = -d.pos.y / 2 + 0.01 - d.r * 0.0;
    gt.add(ring, disc, stem); shadowed(gt);
    A.add(gt, { at: 0.5 + i * 0.2, dur: 0.7, rise: 0.12 }); A.hint(gt, d.col, d.r + 0.03, 0.0, [0, 0, 0]);
    A.tag(d.t, 0, d.col, d.pos.clone().add(V(0, d.r + 0.07, 0)), { at: 1.3 + i * 0.1 });
    return { ...d, gt, disc, on: false, onAt: -9, ex: V(Math.cos(gt.rotation.y), 0, -Math.sin(gt.rotation.y)) };
  });

  // the sparks: one point cloud steered by maths (no allocation per frame)
  const geo = new THREE.BufferGeometry(); const pos = new Float32Array(N * 3), col = new Float32Array(N * 3);
  const S = [], c = new THREE.Color();
  for (let i = 0; i < N; i++) {
    const gI = i % 3, a = Math.random() * TAU, b = Math.acos(2 * Math.random() - 1);
    S.push({ gI, dir: V(Math.sin(b) * Math.cos(a), Math.abs(Math.cos(b)) * 0.8 + 0.2, Math.sin(b) * Math.sin(a)), r: 0.25 + Math.random() * 0.3, ph: Math.random() * TAU, sp: 0.4 + Math.random() * 0.8, ring: Math.random() * TAU, rr: 0.5 + Math.random() * 0.6 });
    c.setHex([BLUE, CORAL, TEAL][gI]); c.lerp(new THREE.Color(0xfff0c0), Math.random() * 0.45); col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
  }
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const pts = new THREE.Points(geo, new THREE.PointsMaterial({ size: 0.034, vertexColors: true, transparent: true, opacity: 0.95, depthWrite: false, sizeAttenuation: true }));
  pts.frustumCulled = false; g.add(pts);

  let bangAt = 1.1, n = 0; const seen = new Set();
  const NOSE = V(0, 0.68, 0);
  const finish = () => { ctx.ui.card({ tag: 'النتيجة', title: 'اختصار الوقت والجهد', body: 'زيادة المخزون التعليمي وإدراك العلاقات بين المواضيع المختلفة.', color: GOLD }); ctx.ui.done(); };
  A.touch(rocket, () => { bangAt = A.now + 0.25; ctx.ui.card({ tag: 'المشكلة', title: 'الانفجار المعرفي', body: 'نمو مضاعف في المعلومات نتيجة التقدم العلمي وظهور علوم جديدة.', color: GOLD }); }, { color: GOLD });
  hoops.forEach((d) => A.touch(d.gt, () => {
    if (!d.on) { d.on = true; d.onAt = A.now; n++; }
    ctx.ui.card({ tag: 'مواجهة', title: d.title, body: d.body, color: d.col });
    ctx.ui.hud(n < 3 ? `روّضت ${['٠', '١', '٢'][n]} من ٣ طرق` : 'تحوّل الانفجار إلى نظام');
    if (n === 3 && !seen.has('f')) { seen.add('f'); setTimeout(finish, 2200); }
  }, { color: d.col }));
  ctx.ui.hud('المس الصاروخ ثم الحلقات');

  return {
    update(t, dt, e) {
      A.update(t, dt, e); sh.material.opacity = 0.32 * e;
      const bt = t - bangAt;
      rocket.position.y = 0.16 + (bt > -1.0 && bt < 0 ? Math.sin(bt * 45) * 0.002 : 0) + (bt > 0 && bt < 0.5 ? Math.sin(bt / 0.5 * Math.PI) * 0.03 : 0);
      flame.material.opacity = bt > -1.0 && bt < 1.4 ? 0.9 : 0; flame.scale.setScalar(0.22 + Math.sin(t * 40) * 0.03);
      const sk = clamp01(bt / 1.6); shock.material.opacity = bt > 0 && bt < 1.6 ? (1 - sk) * 0.6 : 0; shock.scale.setScalar(0.05 + ease(sk) * 0.45);
      for (let i = 0; i < N; i++) {
        const s = S[i], o = i * 3;
        if (bt < 0 || t < 1.1) { pos[o] = 0; pos[o + 1] = -5; pos[o + 2] = 0; continue; }
        const k = clamp01(bt / 1.6), r = ease(k) * s.r;
        let x = NOSE.x + s.dir.x * r + Math.sin(t * s.sp + s.ph) * 0.03 * k, y = NOSE.y + (s.dir.y - 0.35) * r + Math.cos(t * s.sp * 1.3 + s.ph) * 0.03 * k, z = NOSE.z + s.dir.z * r * 0.8 + Math.sin(t * s.sp * 0.8 + s.ph * 2) * 0.03 * k;
        const d = hoops[s.gI];
        if (d.on) {
          const m = ease(clamp01((t - d.onAt) / 1.5)), a = t * 1.3 + s.ring, rr = d.r * (0.55 + s.rr * 0.5);
          const tx = d.pos.x + d.ex.x * Math.cos(a) * rr, ty = d.pos.y + Math.sin(a) * rr, tz = d.pos.z + d.ex.z * Math.cos(a) * rr;
          x += (tx - x) * m; y += (ty - y) * m; z += (tz - z) * m;
        }
        pos[o] = x; pos[o + 1] = y; pos[o + 2] = z;
      }
      geo.attributes.position.needsUpdate = true;
      hoops.forEach((d) => { d.disc.material.opacity = THREE.MathUtils.damp(d.disc.material.opacity, d.on ? 0.3 + Math.sin(t * 3) * 0.06 : 0.1, 4, dt); });
    },
  };
}
