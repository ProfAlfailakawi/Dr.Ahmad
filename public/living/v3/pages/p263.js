// p263 (round 2): a hundred employees on a dark roster board (green pad = success, red pad = failure). Touch a glass orb and that many pawns light up.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { P, ease, easeBack, clamp01, stag, mat, glossy, goldMat, shadowed, glow } from '../../kit.js?v=38';
import { halos, liveTag, motes, blob, TAU, css, toAr } from '../lib/a4-kit.js?v=38';

export const meta = { free: true, center: [0.5, 0.72], typeLabel: 'نجاح أم فشل', title: 'التعليم الإلكتروني في الشركات' };

const COLS = 20, ROWS = 5, N = 100;
const CELLS = [
  { id: 'm', n: 72, c: 0x3a86d6, tag: 'تجاري التحديث', title: 'شركات جارت التحديث', body: 'نحو 72٪ من الشركات في العينة استطاعت أن تجاري التحديث الجاري في مجالات الصناعة عبر اعتمادها على التعليم الإلكتروني.' },
  { id: 'l', n: 25, c: 0xe0453c, tag: 'يتركون العمل', title: 'موظفون قد يرحلون', body: 'قُدِّر أن نحو 25٪ من موظفي الشركات الذين لا تتوافر لهم فرص مناسبة للتعليم أو التدريب سوف يتركون عملهم.' },
  { id: 'g', n: 26, c: 0x5fae3a, tag: 'زيادة العائدات', title: 'عائد أكبر لكل موظف', body: 'الشركات التي تقدم فرص التعليم الإلكتروني والتدريب أثناء الخدمة تحقق نحو 26٪ زيادة في العائدات لكل موظف.' },
  { id: 'c', n: 46, c: 0xd4ad55, tag: 'قدرة على الريادة', title: 'ثقافة تعليمية قوية', body: 'من الشركات ذات الثقافة التعليمية القوية، نحو 46٪ امتلكت القدرة على الريادة في مجالها.' },
];
const CULT = [
  { n: 46, tag: 'قدرة على الريادة', body: 'من الشركات ذات الثقافة التعليمية القوية، نحو 46٪ امتلكت القدرة على الريادة في مجالها.' },
  { n: 34, tag: 'تلبية الاحتياجات', body: 'ومن هذه الشركات نحو 34٪ زادت قدرتها على تلبية احتياجات المستفيدين.' },
  { n: 17, tag: 'حصة السوق', body: 'ومنها نحو 17٪ أصبحت صاحبة الحصة المتحكمة في السوق.' },
];
const BASE = new THREE.Color(0xf1e6cb);
const pct = (n) => toAr(n) + '٪';

export default function build(ctx) {
  const g = new THREE.Group(); g.position.copy(P(meta.center[0], meta.center[1])); ctx.stage.add(g);
  const hal = halos();
  const mo = motes(g, 20, { r: 0.45, h: 0.45, color: 0xfff0c0 });
  const bl = blob(0.46, 0.3); bl.scale.set(0.95, 0.5, 1); g.add(bl);
  const slab = new THREE.Mesh(new RoundedBoxGeometry(0.86, 0.035, 0.38, 4, 0.014), glossy(0x262b36, { clearcoat: 0.6 })); slab.position.y = 0.0175; g.add(slab); shadowed(slab);
  const rim = new THREE.Mesh(new RoundedBoxGeometry(0.88, 0.012, 0.4, 3, 0.005), goldMat()); rim.position.y = 0.006; g.add(rim);
  const padL = new THREE.Mesh(new RoundedBoxGeometry(0.09, 0.014, 0.32, 3, 0.005), glossy(0x5fae3a)); padL.position.set(-0.385, 0.042, 0); g.add(padL);
  const padR = new THREE.Mesh(new RoundedBoxGeometry(0.09, 0.014, 0.32, 3, 0.005), glossy(0xe0453c)); padR.position.set(0.385, 0.042, 0); g.add(padR);
  const arrow = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.06, 3), mat(0xffffff, { emissive: 0xaaffaa, emissiveIntensity: 0.3 })); arrow.position.set(-0.385, 0.08, 0); arrow.scale.z = 0.35; g.add(arrow);
  const gate = new THREE.Group(); gate.position.set(0.385, 0.05, 0); gate.scale.setScalar(1.5); g.add(gate);
  [-0.04, 0.04].forEach((z) => { const p = new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.06, 0.008), mat(0xffffff)); p.position.set(0, 0.03, z); gate.add(p); });
  const lin = new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.008, 0.09), mat(0xffffff)); lin.position.y = 0.062; gate.add(lin);
  shadowed(padL); shadowed(padR);

  // ---- pawns (instanced), 20 columns x 5 rows
  const body = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.0115, 0.0145, 0.036, 12), mat(0xffffff, { roughness: 0.45 }), N);
  const head = new THREE.InstancedMesh(new THREE.SphereGeometry(0.0125, 14, 10), mat(0xffffff, { roughness: 0.4 }), N);
  body.castShadow = head.castShadow = true; g.add(body, head);
  const px = new Float32Array(N), pz = new Float32Array(N), cur = Array.from({ length: N }, () => new THREE.Color(BASE)), tgt = Array.from({ length: N }, () => new THREE.Color(BASE));
  const up = new Float32Array(N), upT = new Float32Array(N), sx = new Float32Array(N), sxT = new Float32Array(N), ph = new Float32Array(N);
  for (let i = 0; i < N; i++) { const col = Math.floor(i / ROWS), row = i % ROWS; px[i] = 0.3 - col * 0.0316; pz[i] = (row - 2) * 0.062; ph[i] = Math.random() * 6; }
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), v3 = new THREE.Vector3(), s3 = new THREE.Vector3();
  let sel = new Set();

  // ---- four glass orbs in front
  const orbs = CELLS.map((cell, i) => {
    const x = -0.3 + i * 0.2, z = 0.31;
    const grp = new THREE.Group(); grp.position.set(x, 0.11, z); g.add(grp);
    const orb = new THREE.Mesh(new THREE.SphereGeometry(0.058, 30, 22), glossy(cell.c, { emissive: cell.c, emissiveIntensity: 0.4, transparent: true, opacity: 0.92 })); grp.add(orb);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.078, 0.004, 8, 44), goldMat()); ring.rotation.x = 1.2; grp.add(ring);
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.08, 8), goldMat()); stem.position.y = -0.09; grp.add(stem);
    const hl = hal.add(grp, cell.c, 0.34, [0, 0, 0], 2.6 + i * 0.15);
    const lt = liveTag(0.2, cell.c, { size: 70, style: 'solid' }); lt.set(pct(cell.n)); g.add(lt.sp); lt.sp.position.set(x, 0.23, z + 0.02); lt.apply(0);
    shadowed(grp); grp.scale.setScalar(0.0001);
    const o = { cell, grp, orb, ring, hl, lt, cult: 0, x };
    ctx.tap(grp, () => pick(o, i)); return o;
  });
  const tag = liveTag(0.25, 0xd4ad55, { size: 62 }); tag.set('قدرة على الريادة'); g.add(tag.sp); tag.apply(0);
  let now = 0, tagK = 0, tagT = 0, finished = false; const seen = new Set(); const tagPos = new THREE.Vector3(0, 0.17, 0.12);
  ctx.ui.hud('المس كرة لتضيء النسبة بين مئة موظف');

  function light(n, col, mode_) {
    sel = new Set(); for (let i = 0; i < N; i++) { const on = i < n; if (on) sel.add(i); tgt[i].set(on ? col : BASE); upT[i] = on ? 0.036 : 0; sxT[i] = on && mode_ === 'leave' ? 0.06 : 0; }
  }
  function pick(o) {
    if (now < 2.6) return;
    ctx.sfx.pop?.(); const c = o.cell; let n = c.n, body_ = c.body, title = c.title, tg = c.tag;
    if (c.id === 'c') { const k = CULT[o.cult % 3]; n = k.n; body_ = k.body; tg = k.tag; title = 'ثقافة تعليمية قوية'; o.lt.set(pct(n), c.c); seen.add('c' + (o.cult % 3)); o.cult++; }
    else seen.add(c.id);
    light(n, c.c, c.id === 'l' ? 'leave' : '');
    tag.set(tg, c.c); tagK = 0; tagT = 1;
    ctx.fx.burst(g.position.clone().add(new THREE.Vector3(o.x, 0.14, 0.3)), c.c, 16, 0.25, 0.04);
    ctx.ui.card({ tag: `${pct(n)} من مئة`, title, body: body_, color: c.c });
    if (seen.size >= 6 && !finished) { finished = true; setTimeout(() => { ctx.sfx.good?.(); ctx.fx.burst(g.position.clone().setY(0.25), 0xffd27a, 46, 0.5, 0.05); ctx.ui.hud('الأرقام تُقرأ بنسبها'); ctx.ui.done(); }, 1500); }
    ctx.ui.hud(finished ? 'الأرقام تُقرأ بنسبها' : `اكتشفت ${toAr(Math.min(5, seen.size))} من ٦`);
  }
  ctx.tap(gate, () => { light(25, 0xe0453c, 'leave'); tag.set('يتركون العمل', 0xe0453c); tagK = 0; tagT = 1; ctx.sfx.click?.(); });
  ctx.tap(arrow, () => { light(26, 0x5fae3a, ''); tag.set('زيادة العائدات', 0x5fae3a); tagK = 0; tagT = 1; ctx.sfx.click?.(); });

  return {
    update(t, dt, e) {
      now = t; hal.update(t, e); mo.update(t, dt, e);
      slab.scale.set(Math.max(0.0001, stag(t, 0, 0.5) * e), 1, 1); rim.scale.copy(slab.scale); bl.material.opacity = 0.3 * e;
      for (let i = 0; i < N; i++) {
        cur[i].lerp(tgt[i], 1 - Math.exp(-6 * dt)); up[i] += (upT[i] - up[i]) * (1 - Math.exp(-7 * dt)); sx[i] += (sxT[i] - sx[i]) * (1 - Math.exp(-3 * dt));
        const col = Math.floor(i / ROWS), k = stag(t, 0.2 + col * 0.05, 0.5, easeBack) * e;
        const bob = sel.has(i) ? Math.abs(Math.sin(t * 4 + ph[i])) * 0.01 : 0;
        const y = 0.035 + 0.018 + up[i] + bob + 0.004 * Math.sin(t * 2 + col * 0.5);   // a gentle wave runs across the crowd
        s3.set(k, k, k); v3.set(px[i] + sx[i], y * k, pz[i]); m4.compose(v3, q, s3); body.setMatrixAt(i, m4);
        v3.set(px[i] + sx[i], (y + 0.0285) * k, pz[i]); m4.compose(v3, q, s3); head.setMatrixAt(i, m4);
        body.setColorAt(i, cur[i]); head.setColorAt(i, cur[i]);
      }
      body.instanceMatrix.needsUpdate = head.instanceMatrix.needsUpdate = true; body.instanceColor.needsUpdate = head.instanceColor.needsUpdate = true;
      orbs.forEach((o, i) => { const pk = stag(t, 0.9 + i * 0.15, 0.7, easeBack) * e; o.grp.scale.setScalar(Math.max(0.0001, pk)); o.grp.position.y = 0.11 + Math.sin(t * 1.7 + i * 1.3) * 0.008; o.ring.rotation.z += dt * 0.8; o.orb.rotation.y += dt; o.lt.apply(stag(t, 1.5 + i * 0.15, 0.5, easeBack) * e); });
      tagK = THREE.MathUtils.damp(tagK, tagT, 6, dt); tag.sp.position.copy(tagPos); tag.apply(easeBack(tagK) * e);
      arrow.rotation.y += dt;
    },
  };
}
