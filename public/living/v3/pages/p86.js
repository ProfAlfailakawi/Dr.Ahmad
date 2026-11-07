import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { P, ease, easeBack, clamp01, stag, mat, glossy, goldMat, shadowed, glow } from '../../kit.js?v=15';
import { animator, shadowBlob, V, TAU } from '../lib/a1-kit.js?v=15';

export const meta = { free: true, center: [0.5, 0.75], typeLabel: 'مجسّم تفاعلي' };

const GOLD = 0xe3b23c, TEAL = 0x2fb6a8, CORAL = 0xf0702a, BLUE = 0x4a90e2, N = 150;

export default function build(ctx) {
  const g = new THREE.Group(); g.position.copy(P(meta.center[0], meta.center[1])); ctx.stage.add(g);
  const A = animator(ctx, g, 0.95);
  g.position.y = 0.05;
  const shb = shadowBlob(1.0, 0.75, 0.3); shb.position.y = -0.048; g.add(shb);
  // a launch pad: steel slab with gold hazard edge and a lattice gantry
  const lp = new THREE.Group();
  const slab = new THREE.Mesh(new RoundedBoxGeometry(0.8, 0.05, 0.56, 3, 0.012), glossy(0xdccaa0, { roughness: 0.45 })); slab.position.y = -0.025;
  const trim = new THREE.Mesh(new RoundedBoxGeometry(0.815, 0.012, 0.575, 3, 0.005), goldMat()); trim.position.y = -0.008;
  lp.add(slab, trim);
  const tw = new THREE.Group(); tw.position.set(-0.3, 0, -0.18);
  [[-0.025, -0.025], [0.025, -0.025], [-0.025, 0.025], [0.025, 0.025]].forEach(([x, z]) => { const p = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.46, 0.008), goldMat()); p.position.set(x, 0.23, z); tw.add(p); });
  for (let q = 1; q < 8; q++) { const b = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.006, 0.06), goldMat()); b.position.y = q * 0.055; tw.add(b); }
  const arm = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.012, 0.012), goldMat()); arm.position.set(0.11, 0.3, 0); tw.add(arm);
  lp.add(tw); shadowed(lp); A.add(lp, { at: 0, dur: 0.7, rise: 0.2 });

  // the rocket on its gantry
  const rocket = new THREE.Group(); rocket.position.y = 0.012;
  const rp = [[0.001, 0], [0.026, 0.01], [0.03, 0.05], [0.026, 0.1], [0.016, 0.14], [0.001, 0.17]].map(([x, y]) => new THREE.Vector2(x, y));
  const hull = new THREE.Mesh(new THREE.LatheGeometry(rp, 28), glossy(0xfff6e6)); hull.position.y = 0.04;
  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.02, 0.05, 24), glossy(CORAL)); nose.position.y = 0.22;
  const win = new THREE.Mesh(new THREE.SphereGeometry(0.012, 16, 12), glossy(0x4aa8ff)); win.position.set(0, 0.14, 0.027);
  rocket.add(hull, nose, win);
  for (let i = 0; i < 3; i++) { const f = new THREE.Mesh(new RoundedBoxGeometry(0.004, 0.06, 0.04, 2, 0.0015), glossy(CORAL)); const a = i / 3 * TAU; f.position.set(Math.cos(a) * 0.03, 0.065, Math.sin(a) * 0.03); f.rotation.y = -a; rocket.add(f); }
  const flame = glow(0xffb040, 0.14, 0.0); flame.position.y = 0.03; rocket.add(flame);
  rocket.scale.setScalar(1.55); shadowed(rocket); const pad = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.062, 0.02, 28), goldMat()); pad.position.y = 0.012; pad.scale.set(1.5, 1, 1.5); g.add(pad);
  A.add(rocket, { at: 0.2, dur: 0.8, rise: 0.15 }); A.hint(rocket, GOLD, 0.1, 0.03);
  const crown = new THREE.Group(); rocket.add(crown);

  // three gates that tame the explosion
  const GATES = [
    { k: 'defs', t: 'تعريفات جديدة', col: BLUE, ang: 2.5, title: 'تعريفات وتصنيفات جديدة', body: 'استحداث تعريفات وتصنيفات جديدة للمعرفة وما وراء المعرفة.' },
    { k: 'media', t: 'وسائل التكنولوجيا', col: CORAL, ang: 0.62, title: 'وسائل التكنولوجيا', body: 'الاستعانة بالتلفزيون والفيديو والدوائر التلفزيونية والحاسب الآلي والإنترنت.' },
    { k: 'res', t: 'البحث العلمي', col: TEAL, ang: -1.57, title: 'البحث العلمي', body: 'طريق ثالث لمواجهة الانفجار المعرفي.' },
  ];
  const gates = GATES.map((d, i) => {
    const x = Math.cos(d.ang) * 0.27, z = Math.sin(d.ang) * 0.19, gt = new THREE.Group(); gt.position.set(x, 0.012, z); gt.rotation.y = Math.atan2(-x, -z) + Math.PI;
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.007, 14, 48), glossy(d.col)); ring.position.y = 0.075;
    const post = [-1, 1].map((s) => { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.014, 0.075, 12), goldMat()); p.position.set(s * 0.04, 0.04, 0); return p; });
    const core = new THREE.Mesh(new THREE.CircleGeometry(0.052, 32), new THREE.MeshBasicMaterial({ color: d.col, transparent: true, opacity: 0.0, side: THREE.DoubleSide, toneMapped: false, depthWrite: false })); core.position.y = 0.075;
    gt.add(ring, ...post, core); gt.scale.setScalar(1.45); shadowed(gt);
    A.add(gt, { at: 0.7 + i * 0.2, dur: 0.7, rise: 0.12 }); A.hint(gt, d.col, 0.085, 0.0);
    A.tag(d.t, 0, d.col, V(x, 0.27, z), { at: 1.5 + i * 0.1 });
    return { ...d, gt, core, on: false, onAt: -9, x, z };
  });
  const tagBoom = A.tag('الانفجار المعرفي', 0, GOLD, V(0, 0.02, 0.36), { at: 1.2 });

  // the sparks: one instanced cloud, steered by simple maths (no allocation per frame)
  const geo = new THREE.BufferGeometry(); const pos = new Float32Array(N * 3), col = new Float32Array(N * 3);
  const S = [], c = new THREE.Color();
  for (let i = 0; i < N; i++) {
    const gI = i % 3, a = Math.random() * TAU, b = Math.acos(2 * Math.random() - 1);
    S.push({ gI, dir: V(Math.sin(b) * Math.cos(a), Math.abs(Math.cos(b)) * 0.9 + 0.1, Math.sin(b) * Math.sin(a)), r: 0.16 + Math.random() * 0.24, ph: Math.random() * TAU, sp: 0.4 + Math.random() * 0.8, ring: Math.random() * TAU });
    c.setHex([BLUE, CORAL, TEAL][gI]); c.lerp(new THREE.Color(0xfff0c0), Math.random() * 0.5); col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
  }
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const pts = new THREE.Points(geo, new THREE.PointsMaterial({ size: 0.03, vertexColors: true, transparent: true, opacity: 0.95, depthWrite: false, sizeAttenuation: true, blending: THREE.NormalBlending }));
  pts.frustumCulled = false; g.add(pts);

  let bangAt = 1.6, n = 0; const seen = new Set();
  const finish = () => { ctx.ui.card({ tag: 'النتيجة', title: 'اختصار الوقت والجهد', body: 'زيادة المخزون التعليمي وإدراك العلاقات بين المواضيع المختلفة.', color: GOLD }); ctx.ui.done(); };
  A.touch(rocket, () => { bangAt = A.now + 0.2; ctx.ui.card({ tag: 'المشكلة', title: 'الانفجار المعرفي', body: 'نمو مضاعف في المعلومات نتيجة التقدم العلمي وظهور علوم جديدة.', color: GOLD }); }, { color: GOLD });
  gates.forEach((d) => A.touch(d.gt, () => {
    if (!d.on) { d.on = true; d.onAt = A.now; n++; }
    ctx.ui.card({ tag: 'مواجهة', title: d.title, body: d.body, color: d.col });
    ctx.ui.hud(n < 3 ? `روّضت ${['٠', '١', '٢'][n]} من ٣ طرق` : 'تحوّل الانفجار إلى نظام');
    if (n === 3 && !seen.has('f')) { seen.add('f'); setTimeout(finish, 2200); }
  }, { color: d.col }));
  ctx.ui.hud('المس الصاروخ ثم البوابات');

  return {
    update(t, dt, e) {
      A.update(t, dt, e);
      const bt = t - bangAt;
      // rocket shakes, lifts a little, then the burst
      const lift = bt > -0.8 && bt < 0 ? -bt * 0 : 0;
      rocket.position.y = 0.012 + (bt > -1.2 && bt < 0 ? Math.sin(bt * 40) * 0.0015 : 0) + (bt > 0 ? Math.min(bt * 0.25, 0.1) * (bt < 3 ? 1 : 0) : 0);
      flame.material.opacity = bt > -1.2 && bt < 1.5 ? 0.9 : 0.0; flame.scale.setScalar(0.12 + Math.random() * 0.03);
      if (bt > 3) { rocket.position.y = 0.012 + THREE.MathUtils.damp(rocket.position.y - 0.012, 0, 2, dt); }
      for (let i = 0; i < N; i++) {
        const s = S[i], o = i * 3;
        if (bt < 0 || t < 1.6) { pos[o] = 0; pos[o + 1] = -5; pos[o + 2] = 0; continue; }
        const k = clamp01(bt / 1.6), r = ease(k) * s.r;
        // free flight: spreads, then drifts on a slow chaotic orbit around the rocket
        let x = s.dir.x * r + Math.sin(t * s.sp + s.ph) * 0.02 * k, y = 0.36 + s.dir.y * r * 1.1 + Math.cos(t * s.sp * 1.3 + s.ph) * 0.02 * k, z = s.dir.z * r + Math.sin(t * s.sp * 0.8 + s.ph * 2) * 0.02 * k;
        const d = gates[s.gI];
        if (d.on) { // tamed: streams into the gate, then circles it in orderly rings
          const m = ease(clamp01((t - d.onAt) / 1.4)), a = t * 1.1 + s.ring, rr = 0.04 + (i % 4) * 0.012;
          const tx = d.x + Math.cos(a) * rr * 0.4, ty = 0.11 + Math.sin(a) * rr, tz = d.z + Math.cos(a) * rr * 0.4 * 0 + Math.sin(a * 0.0) * 0 ;
          const dx = (d.x - 0) , dz = d.z;
          x += (d.x + Math.cos(a) * rr * Math.cos(Math.atan2(-d.x, -d.z) + Math.PI) - x) * m; y += (ty - y) * m; z += (d.z + Math.cos(a) * rr * -Math.sin(Math.atan2(-d.x, -d.z) + Math.PI) - z) * m;
        }
        pos[o] = x; pos[o + 1] = y; pos[o + 2] = z;
      }
      geo.attributes.position.needsUpdate = true;
      gates.forEach((d) => { d.core.material.opacity = THREE.MathUtils.damp(d.core.material.opacity, d.on ? 0.3 + Math.sin(t * 3) * 0.08 : 0, 4, dt); });
      tagBoom.userData.hide = t - bangAt > 8 && n === 3;
    },
  };
}
