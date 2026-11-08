import * as THREE from 'three';
import { P, ease, easeBack, clamp01, stag, mat, glossy, goldMat, shadowed, glow, sprite, lightTube } from '../../kit.js?v=26';
import { inked } from '../../pencil.js?v=26';
import { Rig, hexCoin, V, TAU, css } from '../lib/a5-kit.js?v=26';
import { lightPool } from '../../v2/common.js?v=26';

export const meta = { free: true, center: [0.3, 0.66], typeLabel: 'شجرة ضوئية' };

const NODES = [
  { k: 'book', c: 0xef8f2a, t: 'الحصة الصفية', n: 'يبدأ التعليم المخلوط بلبنة قوية أساسها الحصة الصفية المتكاملة.' },
  { k: 'screen', c: 0x2a8fd0, t: 'المادة الإلكترونية', n: 'تتكامل المادة التعليمية مع المادة الإلكترونية، فتتعدد وسائل العرض ويسهل الفهم والاستيعاب.' },
  { k: 'wifi', c: 0x2fa38a, t: 'التعلم عبر الشبكة', n: 'يمزج بين التعلم التقليدي والإلكتروني والتعلم المبني على الاتصال بالإنترنت.' },
  { k: 'chat', c: 0xe8604c, t: 'وجهاً لوجه', n: 'يحتفظ بالتواصل المباشر بين المعلم والمتعلم إلى جانب الوسائط الإلكترونية.' },
  { k: 'cap', c: 0x5a6fd6, t: 'معلم مؤهل', n: 'لا يُضمن النجاح إلا بمعلمين مؤهلين قادرين على إدارة المصادر المتاحة بحكمة وذكاء.' },
  { k: 'layers', c: 0xe3b23c, t: 'تمايز المستويات', n: 'يتنوّع التعليم تبعاً للاحتياجات التعليمية للطلاب في الفصول المتعددة المستويات والقدرات.' },
  { k: 'spark', c: 0xb5489a, t: 'أثر يدوم', n: 'يدوم أثره لفترة أطول من طرق التعليم الأخرى ويجذب انتباه الطلبة مدة أطول.' },
];

export default function build(ctx) {
  const g = new THREE.Group(); g.position.copy(P(meta.center[0], meta.center[1])); g.scale.setScalar(1.22); g.position.x += 0.055; ctx.stage.add(g);
  const rig = new Rig(ctx);

  const pool = lightPool(0x3b2b1a, 0.3, 0); pool.position.y = 0.003; g.add(pool); rig.fn((p) => { pool.material.opacity = 0.3 * p; }, 0.1, 1.0);

  // trunk: two braided strands, classroom (orange) and network (blue)
  const trunk = new THREE.Group(); g.add(trunk);
  const H = 0.24;
  const strand = (ph, color) => {
    const pts = []; for (let i = 0; i <= 60; i++) { const y = (i / 60) * H, a = ph + (i / 60) * TAU * 2.6, r = 0.02 * (1 - 0.35 * (i / 60)); pts.push(V(Math.cos(a) * r, 0.018 + y, Math.sin(a) * r)); }
    const m = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 160, 0.0115, 10), glossy(color, { roughness: 0.28 }));
    return shadowed(m);
  };
  const sA = strand(0, 0xef8f2a), sB = strand(Math.PI, 0x2a8fd0); trunk.add(sA, sB);
  const roots = [];
  [[0, 0xef8f2a], [Math.PI, 0x2a8fd0]].forEach(([a, c]) => {
    const pts = [V(Math.cos(a) * 0.15, 0.02, Math.sin(a) * 0.12), V(Math.cos(a) * 0.08, 0.025, Math.sin(a) * 0.05 + 0.02), V(Math.cos(a) * 0.02, 0.04, Math.sin(a) * 0.02)];
    const m = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 40, 0.007, 8), glossy(c)); g.add(m); roots.push(m);
  });

  // crown: seven light branches ending in hex coins
  const top = V(0, 0.018 + H, 0);
  const crown = new THREE.Group(); g.add(crown);
  const fruits = [], tubes = [];
  NODES.forEach((n, i) => {
    const a = (i / NODES.length) * TAU + 0.35, rr = 0.15 + (i % 2) * 0.05, y = 0.38 + ((i * 3) % 4) * 0.03;
    const end = V(Math.cos(a) * rr, y, Math.sin(a) * rr * 0.8);
    const mid = V(end.x * 0.35, top.y + 0.04 + (i % 3) * 0.02, end.z * 0.35);
    const curve = new THREE.CatmullRomCurve3([top.clone(), mid, end.clone()]);
    const tube = lightTube(curve, { radius: 0.0055, color: n.c, speed: 0.4 + (i % 3) * 0.1 }); crown.add(tube); tubes.push(tube);
    const dir = end.clone().sub(top).add(V(0, 0.35, 0)).normalize();
    const holder = new THREE.Group(); holder.position.copy(end); holder.quaternion.setFromUnitVectors(V(0, 1, 0), dir); crown.add(holder);
    const coin = hexCoin(n.k, n.c, 0.06, 0.02); holder.add(coin);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.003, 6, 6), goldMat()); ring.rotation.x = Math.PI / 2; ring.rotation.z = Math.PI / 6; holder.add(ring);
    fruits.push({ holder, coin, ring, n, end, i, spin: -9, seen: false, base: end.clone() });
  });

  // drifting leaves: small hex shards around the crown
  const leaves = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.011, 0.011, 0.003, 6), new THREE.MeshStandardMaterial({ roughness: 0.5 }), 54);
  const lc = [0xef8f2a, 0x2a8fd0, 0x2fa38a, 0xe8604c, 0xe3b23c, 0x5a6fd6];
  const ld = [];
  for (let i = 0; i < 54; i++) {
    leaves.setColorAt(i, new THREE.Color(lc[i % 6]));
    ld.push({ a: Math.random() * TAU, r: 0.06 + Math.random() * 0.2, y: 0.3 + Math.random() * 0.2, sp: 0.15 + Math.random() * 0.25, ph: Math.random() * 6 });
  }
  g.add(leaves);
  const dm = new THREE.Object3D();

  // a seed of light travelling up the trunk
  const seed = glow(0xfff0c0, 0.06, 0.9); g.add(seed);
  const tagA = sprite('الصف التقليدي', 0.2, { size: 48, width: 380, weight: 800, border: '#ef8f2a' }); tagA.userData.w = 0.2;
  const tagB = sprite('الإلكتروني', 0.17, { size: 48, width: 320, weight: 800, border: '#2a8fd0' });
  tagA.position.set(0.14, 0.05, 0.17); tagB.position.set(-0.15, 0.05, 0.16);
  g.add(tagA, tagB);

  let found = 0, finished = false, trunkPulse = -9, now = 0;
  const seenCore = { v: false };
  const check = () => { if (!finished && found >= NODES.length && seenCore.v) { finished = true; setTimeout(() => ctx.ui.done(), 900); } };
  fruits.forEach((f) => {
    rig.touch(f.holder, (h) => {
      f.spin = now; ctx.sfx.pop?.(); ctx.fx.burst(f.end.clone().add(V(0, 0.04, 0)), f.n.c, 22, 0.35, 0.03);
      ctx.ui.card({ tag: 'غصن', title: f.n.t, body: f.n.n, color: f.n.c });
      if (!f.seen) { f.seen = true; found++; ctx.ui.hud(`أضأتَ ${found} من ${NODES.length} أغصان`); check(); }
      h.on = false;
    }, { color: f.n.c, size: 0.13, at: V(0, 0.01, 0), show: 3.6 + f.i * 0.2 });
  });
  const core = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.28, 8), new THREE.MeshBasicMaterial({ visible: false }));
  core.position.y = 0.15; g.add(core);
  ctx.tap(core, () => {
    trunkPulse = now; ctx.sfx.whoosh?.(); ctx.fx.burst(V(0, 0.2, 0), 0xffd27a, 26, 0.3, 0.03);
    ctx.ui.card({ tag: 'الجذع', title: 'مزج الأدوار', body: 'خلط أو مزج أدوار المعلم التقليدية في الصفوف الدراسية مع المعلم الإلكتروني في الصفوف الافتراضية.', color: 0xd4ad55 });
    seenCore.v = true; check();
  });
  ctx.ui.hud('المس أوراق الشجرة وجذعها');

  return {
    update(t, dt, e) {
      now = t; rig.update(t, dt, e);
      const grow = stag(t, 0.2, 1.4, ease) * e;
      trunk.scale.set(1, Math.max(grow, 0.001), 1);
      roots.forEach((r, i) => r.scale.setScalar(Math.max(stag(t, 0.3 + i * 0.2, 0.9) * e, 0.001)));
      const tp = clamp01((now - trunkPulse) / 1.2);
      const sc = 1 + 0.12 * Math.sin(tp * Math.PI) * (trunkPulse > 0 ? 1 : 0);
      trunk.scale.x = trunk.scale.z = sc;
      tubes.forEach((tb, i) => { tb.userData.fill(stag(t, 1.0 + i * 0.2, 1.0, clamp01) * e); tb.userData.update(dt); });
      fruits.forEach((f) => {
        const p = stag(t, 1.7 + f.i * 0.22, 0.8, easeBack) * e;
        f.holder.scale.setScalar(Math.max(p, 0.0001)); f.holder.visible = p > 0.01;
        const bob = Math.sin(t * 1.1 + f.i * 1.3) * 0.006;
        f.holder.position.y = f.base.y + bob;
        const s = clamp01((t - f.spin) / 1.0);
        f.coin.rotation.y = f.spin > 0 ? easeBack(s) * TAU : 0;
        f.ring.rotation.z = Math.PI / 6 + t * 0.4;
      });
      for (let i = 0; i < ld.length; i++) {
        const d = ld[i]; const a = d.a + t * d.sp;
        const k = stag(t, 2.4 + (i % 9) * 0.1, 1.2) * e;
        dm.position.set(Math.cos(a) * d.r, d.y + Math.sin(t * 0.8 + d.ph) * 0.012, Math.sin(a) * d.r * 0.8);
        dm.rotation.set(t * 0.7 + d.ph, a, 0.4); dm.scale.setScalar(Math.max(k, 0.0001)); dm.updateMatrix(); leaves.setMatrixAt(i, dm.matrix);
      }
      leaves.instanceMatrix.needsUpdate = true;
      crown.rotation.y = Math.sin(t * 0.25) * 0.08;
      const sp = (t * 0.28) % 1; seed.position.set(0, 0.03 + sp * H, 0); seed.material.opacity = 0.8 * grow * Math.sin(sp * Math.PI);
      const tk = stag(t, 1.2, 0.6, easeBack) * e; tagA.scale.set(0.2 * tk, 0.2 * tagA.userData.aspect * tk, 1); tagB.scale.set(0.17 * tk, 0.17 * tagB.userData.aspect * tk, 1);
    },
  };
}
