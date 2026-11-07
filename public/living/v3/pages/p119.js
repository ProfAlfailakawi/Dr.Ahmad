// p119 — communication as a puzzle that fits: a growing crowd, an exploding library, and a teacher who turns from funnel into compass.
import * as THREE from 'three';
import { P, ease, easeBack, clamp01, stag, glow, lightTube } from '../../kit.js?v=15';
import { rb, lathe, std, lit, gloss, glass, brass, add, grp, hit, Seq, Pulse, touch, chip, plinth, organic, at, rnd, TAU, INK, GOLD } from '../lib/a2.js?v=15';

export const meta = { free: true, center: [0.5, 0.57], typeLabel: 'مجسّم تفاعلي' };

export default function build(ctx) {
  const g = new THREE.Group(); g.position.copy(P(meta.center[0], meta.center[1])); ctx.stage.add(g);
  const seq = new Seq(), pulse = new Pulse(), seen = new Set();
  let swapped = false;
  const found = (k) => { seen.add(k); if (seen.size >= 4 && swapped) ctx.ui.done(); };
  const base = organic(g, 0.88, 0.66, { color: 0xb9dce8, seed: 2 }); seq.add(base, 0, 0.7, { rise: 0.04 });

  // ---------------- puzzle in the middle
  const pz = grp(g, 0, 0.22, 0.0); pz.scale.setScalar(1.75);
  const pa = grp(pz, 0, 0, 0), pb = grp(pz, 0, 0, 0);
  const redM = gloss(0xbd2b45), greyM = gloss(0xe6e4de);
  add(pa, rb(0.1, 0.1, 0.034, 0.03, 4), redM, 0, 0, 0, true);
  add(pa, new THREE.SphereGeometry(0.03, 28, 20), redM, 0.068, 0, 0, true).scale.z = 0.55;
  add(pa, new THREE.CylinderGeometry(0.014, 0.018, 0.03, 16), redM, 0.052, 0, 0).rotation.z = Math.PI / 2;
  add(pb, rb(0.1, 0.1, 0.034, 0.03, 4), greyM, 0, 0, 0, true);
  const sock = add(pb, new THREE.TorusGeometry(0.031, 0.004, 10, 36), brass(), -0.036, 0, 0.0175);
  add(pb, new THREE.CircleGeometry(0.027, 28), new THREE.MeshBasicMaterial({ color: 0xc9c6bd }), -0.036, 0, 0.0176);
  const lock = glow(0xffe29a, 0.2, 0); pz.add(lock);
  hit(pz, 0.09, 0, 0, 0);
  seq.add(pz, 0.1, 0.8, { rise: 0.12 });
  const stem = add(g, new THREE.CylinderGeometry(0.008, 0.02, 0.17, 12), brass(), 0, 0.1, 0); seq.add(stem, 0.0, 0.5, { rise: 0 });
  pulse.add(pz, 0xffc94a, 0.2, 0, 0, 0, { op: 0.4 });
  const lc = chip('الاتصال', 0.1, 0xbd2b45); lc.position.set(0, 0.4, 0); g.add(lc); seq.add(lc, 1.6, 0.5);
  let snapT = 2.6, snapRe = -1;
  touch(ctx, pz, () => { snapRe = 0; ctx.sfx.good?.(); ctx.ui.card({ tag: 'الاتصال والتعليم', title: 'الاتصال ضرورة تعليمية', body: 'للاتصال تأثير كبير في التعليم، وبات ضرورة في العملية التعليمية التعلمية.', color: 0xbd2b45 }); found('c'); }, 0xbd2b45);

  // ---------------- crowd of students
  const cr = grp(g, -0.27, 0.014, 0.14); cr.scale.setScalar(1.35);
  add(cr, new THREE.CylinderGeometry(0.115, 0.12, 0.012, 40), std(0xcfe3e8), 0, 0.006, 0, true);
  const N = 54, bodies = new THREE.InstancedMesh(new THREE.CapsuleGeometry(0.0085, 0.02, 4, 10), std(0xffffff, { roughness: 0.4 }), N);
  const heads = new THREE.InstancedMesh(new THREE.SphereGeometry(0.0085, 12, 10), std(0xf1d6b8, { roughness: 0.5 }), N);
  const cols = [0x2a8fd0, 0x1f9aa6, 0xef8f2a, 0x8a9a1f, 0xb5489a, 0x3b4fc4].map((c) => new THREE.Color(c));
  const dm = new THREE.Object3D(), rr = rnd(7);
  for (let i = 0; i < N; i++) {
    const a = i * 2.39996, d = 0.012 + 0.092 * Math.sqrt((i + 0.5) / N);
    dm.position.set(Math.cos(a) * d, 0.012 + 0.016, Math.sin(a) * d); dm.rotation.set(0, 0, 0); dm.scale.setScalar(1); dm.updateMatrix(); bodies.setMatrixAt(i, dm.matrix);
    dm.position.y = 0.012 + 0.043; dm.updateMatrix(); heads.setMatrixAt(i, dm.matrix);
    bodies.setColorAt(i, cols[Math.floor(rr() * cols.length)]);
  }
  bodies.castShadow = true; cr.add(bodies, heads); bodies.count = 6; heads.count = 6;
  hit(cr, 0.12, 0, 0.03, 0);
  seq.add(cr, 0.3, 0.8);
  let crowd = 6;
  const cc = chip('الطلاب', 0.1, 0x2a8fd0); cc.position.set(-0.27, 0.17, 0.14); g.add(cc); seq.add(cc, 1.7, 0.5);
  touch(ctx, cr, () => { crowd = Math.min(N, crowd + 14); ctx.ui.card({ tag: 'أثر الاتصال', title: 'أعداد متزايدة من الطلاب', body: 'يساعد على التعامل الفعال معهم نظراً لزيادة السكان والطلب المتزايد على التعليم.', color: 0x2a8fd0 }); found('s'); }, 0x2a8fd0);

  // ---------------- information explosion
  const ie = grp(g, 0.27, 0.2, -0.17); ie.scale.setScalar(1.5);
  add(ie, new THREE.IcosahedronGeometry(0.014, 1), lit(0xffd27a, 1.4), 0, 0, 0);
  const M = 42, pages = new THREE.InstancedMesh(new THREE.BoxGeometry(0.024, 0.0018, 0.018), std(0xfbf6ea, { roughness: 0.6 }), M);
  pages.castShadow = true; ie.add(pages);
  const pdir = [], pc = [0xef8f2a, 0x2a8fd0, 0xffffff, 0xd4ad55, 0x1f9aa6].map((c) => new THREE.Color(c));
  for (let i = 0; i < M; i++) { const u = rr() * 2 - 1, a = rr() * TAU, s = Math.sqrt(1 - u * u); pdir.push({ x: Math.cos(a) * s, y: u, z: Math.sin(a) * s, r: 0.05 + rr() * 0.07, ph: rr() * TAU, sp: 0.4 + rr() * 0.8 }); pages.setColorAt(i, pc[i % pc.length]); }
  hit(ie, 0.14, 0, 0, 0);
  seq.add(ie, 0.5, 0.8, { rise: 0.1 });
  const ic = chip('المعلومات', 0.11, 0xef8f2a); ic.position.set(0.27, 0.4, -0.17); g.add(ic); seq.add(ic, 1.8, 0.5);
  pulse.add(ie, 0xffb24a, 0.2, 0, 0, 0, { op: 0.4 });
  let tame = 0, tameTo = 0;
  touch(ctx, ie, () => { tameTo = tameTo ? 0 : 1; ctx.ui.card({ tag: 'أثر الاتصال', title: 'انفجار المعلومات', body: 'نجهّز المعارف ونديرها قبل أن نفقد السيطرة عليها.', color: 0xef8f2a }); found('i'); }, 0xef8f2a);

  // ---------------- the teacher: funnel -> compass
  const tc = grp(g, 0.27, 0.014, 0.19); tc.scale.setScalar(1.6);
  add(tc, new THREE.CylinderGeometry(0.06, 0.064, 0.012, 32), std(0xf2e6cf), 0, 0.006, 0, true);
  const fig = grp(tc, -0.026, 0.012, 0.0);
  add(fig, new THREE.CapsuleGeometry(0.016, 0.05, 6, 16), std(0x2b2e3a, { roughness: 0.5 }), 0, 0.045, 0, true);
  add(fig, new THREE.SphereGeometry(0.0155, 20, 14), std(0xf1d6b8), 0, 0.105, 0, true);
  add(fig, new THREE.CylinderGeometry(0.0035, 0.004, 0.02, 8), std(0xbd2b45), 0, 0.075, 0.016).rotation.x = 1.1;
  const funnel = grp(tc, 0.03, 0.012, 0);
  add(funnel, lathe([[0.0001, 0.0], [0.006, 0.0], [0.007, 0.05], [0.034, 0.09], [0.036, 0.095], [0.032, 0.095], [0.0055, 0.056], [0.0001, 0.054]], 28), gloss(0xe0b85e, { metalness: 0.7, side: THREE.DoubleSide }), 0, 0, 0, true);
  const compass = grp(tc, 0.03, 0.05, 0); compass.scale.setScalar(1e-4);
  add(compass, new THREE.TorusGeometry(0.036, 0.0035, 10, 40), brass(), 0, 0, 0).rotation.x = Math.PI / 2;
  add(compass, new THREE.CylinderGeometry(0.034, 0.034, 0.003, 36), std(0xf7f2e7), 0, 0, 0);
  const needle = grp(compass, 0, 0.004, 0);
  add(needle, new THREE.ConeGeometry(0.007, 0.05, 4), lit(0xe0453c, 0.5), 0, 0, 0.0).rotation.x = Math.PI / 2;
  add(needle, new THREE.ConeGeometry(0.007, 0.03, 4), std(0x2b2620), 0, 0, 0.0).rotation.x = -Math.PI / 2;
  const orbs = Array.from({ length: 6 }, (_, i) => { const o = add(compass, new THREE.SphereGeometry(0.0085, 14, 10), lit([0x2a8fd0, 0x1f9aa6, 0xef8f2a, 0x8a9a1f, 0xb5489a, 0xe0b030][i], 0.9), 0, 0.035, 0); return o; });
  const stream = glow(0xffd27a, 0.03, 0.9); tc.add(stream);
  hit(tc, 0.075, 0, 0.06, 0);
  seq.add(tc, 0.7, 0.8);
  const tcc = chip('المعلم', 0.1, 0x2b2e3a); tcc.position.set(0.27, 0.26, 0.19); g.add(tcc); seq.add(tcc, 1.9, 0.5);
  const tpulse = pulse.add(tc, 0x1f9aa6, 0.2, 0, 0.06, 0, { op: 0.45 });
  let mode = 0, modeTo = 0;
  touch(ctx, tc, () => {
    modeTo = modeTo ? 0 : 1; if (modeTo) swapped = true;
    ctx.ui.card(modeTo ? { tag: 'وظيفة المعلم', title: 'موجّه ومرشد', body: 'يصبح دوره التوجيه والإرشاد، والمساهمة بفاعلية في تطبيق الأساليب الحديثة.', color: 0x1f9aa6 }
      : { tag: 'وظيفة المعلم', title: 'من ناقل ومُلقّن', body: 'كان ناقلاً للمعرفة وملقّناً للمعلومة، ثم صار مصمماً لها ومحفزاً على توظيفها.', color: 0xbd2b45 });
    found('t');
  }, 0x1f9aa6);

  // ---------------- light tubes linking the four
  const tubes = [[0, 0.18, 0, -0.27, 0.1, 0.14, 0x2a8fd0], [0, 0.22, 0, 0.27, 0.2, -0.17, 0xef8f2a], [0, 0.2, 0, 0.27, 0.12, 0.19, 0x1f9aa6]].map(([ax, ay, az, bx, by, bz, col], i) => {
    const a = new THREE.Vector3(ax, ay, az), b = new THREE.Vector3(bx, by, bz), m = a.clone().lerp(b, 0.5); m.y += 0.07;
    const tb = lightTube(new THREE.QuadraticBezierCurve3(a, m, b), { radius: 0.005, color: col, speed: 0.5 }); g.add(tb); tb.userData.fill(0); return tb;
  });

  ctx.ui.hud('المس القطع الأربع');
  const dummy = new THREE.Object3D(), qa = new THREE.Quaternion(), eu = new THREE.Euler();

  return {
    update(t, dt, e) {
      seq.update(t, e); pulse.update(t, e);
      tubes.forEach((tb, i) => { tb.userData.fill(stag(t, 0.9 + i * 0.3, 1.0, ease) * e); tb.userData.update(dt); });
      // puzzle: slowly turns, closes the gap at ~4 s, again after a touch
      let sep = t < snapT ? 0.075 : 0;
      if (snapRe >= 0) { snapRe += dt; sep = snapRe < 0.5 ? 0.075 * ease(snapRe / 0.5) : 0.075 * (1 - ease((snapRe - 0.9) / 0.45)); if (snapRe > 1.35) { snapRe = -1; } }
      else if (t >= snapT) sep = 0.075 * (1 - ease((t - snapT) / 0.8));
      const gap = 0.1 + sep;
      pa.position.x = -gap / 2; pb.position.x = gap / 2;
      lock.material.opacity = e * clamp01(1 - sep / 0.03) * (0.35 + 0.25 * Math.sin(t * 3)); lock.scale.setScalar(0.2 + 0.05 * Math.sin(t * 3));
      pz.rotation.y = Math.sin(t * 0.5) * 0.5; pz.position.y = 0.22 + Math.sin(t * 1.1) * 0.006;
      // crowd grows
      const target = Math.min(N, Math.max(crowd, 6 + Math.floor(Math.max(0, t - 1.6) * 3.2)));
      if (target > crowd) crowd = target;
      bodies.count = heads.count = Math.floor(crowd);
      // info pages: chaos <-> order
      tame += (tameTo - tame) * Math.min(1, dt * 2.2);
      for (let i = 0; i < M; i++) {
        const d = pdir[i], a = t * d.sp * 0.6 + d.ph, rad = d.r * (1 + 0.25 * Math.sin(t * 1.3 + d.ph));
        const cx = d.x * rad + Math.sin(a) * 0.01, cy = d.y * rad, cz = d.z * rad + Math.cos(a) * 0.01;
        const ang = (i / M) * TAU + t * 0.4, ox = Math.cos(ang) * 0.1, oz = Math.sin(ang) * 0.1;
        dummy.position.set(cx + (ox - cx) * tame, cy * (1 - tame) + Math.sin(t + i) * 0.003 * tame, cz + (oz - cz) * tame);
        eu.set(a * 1.3 * (1 - tame), a + (ang * tame), a * 0.7 * (1 - tame)); dummy.quaternion.setFromEuler(eu); dummy.updateMatrix(); pages.setMatrixAt(i, dummy.matrix);
      }
      pages.instanceMatrix.needsUpdate = true;
      // teacher mode
      mode += (modeTo - mode) * Math.min(1, dt * 3);
      funnel.scale.setScalar(Math.max(1e-4, 1 - mode)); funnel.visible = mode < 0.98;
      compass.scale.setScalar(Math.max(1e-4, mode)); compass.visible = mode > 0.02; compass.rotation.y += dt * 0.5;
      needle.rotation.y = Math.sin(t * 1.4) * 0.7 + t * 0.2;
      orbs.forEach((o, i) => { const a = t * 0.9 + i * TAU / 6; o.position.set(Math.cos(a) * 0.055, 0.03 + Math.sin(t * 2 + i) * 0.004, Math.sin(a) * 0.055); });
      stream.visible = mode < 0.5; stream.position.set(0.03, 0.14 - ((t * 0.5) % 1) * 0.07, 0); stream.material.opacity = 0.9 * e * (1 - mode);
      tpulse.material.color.setHex(mode > 0.5 ? 0x1f9aa6 : 0xbd2b45);
    },
  };
}
