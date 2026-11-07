import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { P, ease, easeBack, clamp01, stag, mat, glossy, goldMat, shadowed, glow } from '../../kit.js?v=15';
import { animator, shadowBlob, V, TAU, softLight } from '../lib/a1-kit.js?v=15';

export const meta = { free: true, center: [0.5, 0.72], typeLabel: 'مجسّم تفاعلي' };

const TEAL = 0x2fb6a8, ORANGE = 0xf0902a, BLUE = 0x3a8fe0, GOLD = 0xd4ad55, YELLOW = 0xf2c230;

export default function build(ctx) {
  const g = new THREE.Group(); g.position.copy(P(meta.center[0], meta.center[1])); ctx.stage.add(g);
  const A = animator(ctx, g, 0.95);
  const sh = shadowBlob(1.0, 0.7, 0.3); g.add(sh);
  // a school desk: teal top (as printed), warm wooden legs
  const desk = new THREE.Group();
  const dtop = new THREE.Mesh(new RoundedBoxGeometry(0.7, 0.045, 0.46, 4, 0.016), glossy(0x2fb6a8, { roughness: 0.3 })); dtop.position.y = 0.16;
  const edge = new THREE.Mesh(new RoundedBoxGeometry(0.72, 0.012, 0.48, 3, 0.005), goldMat()); edge.position.y = 0.14;
  desk.add(dtop, edge);
  [[-0.3, -0.18], [0.3, -0.18], [-0.3, 0.18], [0.3, 0.18]].forEach(([x, z]) => { const l = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.016, 0.14, 16), glossy(0xc98f55)); l.position.set(x, 0.07, z); desk.add(l); });
  shadowed(desk); A.add(desk, { at: 0, dur: 0.7, rise: 0.2 });
  const TOP = 0.185;

  // the learner: a small golden figure at the centre who turns toward whatever is touched
  const me = new THREE.Group(); me.position.y = TOP; me.scale.setScalar(1.6);
  const bm = glossy(YELLOW, { roughness: 0.3 });
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.025, 0.05, 8, 18), bm); body.position.y = 0.06;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.026, 24, 16), bm); head.position.y = 0.123;
  const book = new THREE.Mesh(new RoundedBoxGeometry(0.04, 0.006, 0.03, 2, 0.002), glossy(0xffffff)); book.position.set(0, 0.07, 0.03);
  me.add(body, head, book); shadowed(me); A.add(me, { at: 0.4, dur: 0.7, rise: 0.12 });

  // station 1: discover — dark stones hide a gem; a magnifier ring hovers over it
  const disc = new THREE.Group(); disc.position.set(-0.21, TOP, 0.07); disc.scale.setScalar(1.55);
  const stones = [];
  for (let i = 0; i < 6; i++) { const a = i / 6 * TAU, s = new THREE.Mesh(new THREE.DodecahedronGeometry(0.03 + (i % 3) * 0.006, 0), mat(0x3c4650, { roughness: 0.8, flatShading: true })); s.userData = { home: V(Math.cos(a) * 0.022, 0.025 + (i % 2) * 0.018, Math.sin(a) * 0.022), a }; s.position.copy(s.userData.home); stones.push(s); disc.add(s); }
  const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.03, 0), new THREE.MeshStandardMaterial({ color: 0xbff6ee, emissive: TEAL, emissiveIntensity: 1.1, roughness: 0.15 })); gem.position.y = 0.03; disc.add(gem);
  const gg = glow(TEAL, 0.2, 0.0); gg.position.y = 0.05; disc.add(gg);
  const lens = new THREE.Group(); lens.position.set(0.0, 0.16, 0.02);
  const lr = new THREE.Mesh(new THREE.TorusGeometry(0.036, 0.005, 12, 40), goldMat()); const lh = new THREE.Mesh(new THREE.CylinderGeometry(0.0045, 0.0045, 0.05, 10), goldMat()); lh.position.set(0.034, -0.034, 0); lh.rotation.z = Math.PI / 4;
  const lg = new THREE.Mesh(new THREE.CircleGeometry(0.036, 32), new THREE.MeshPhysicalMaterial({ color: 0xcffaf4, transparent: true, opacity: 0.25, roughness: 0 })); lens.add(lr, lh, lg); lens.rotation.x = -0.9; disc.add(lens);
  shadowed(disc); A.add(disc, { at: 0.6, dur: 0.7, rise: 0.12 }); A.hint(disc, TEAL, 0.075, 0.0);

  // station 2: create — loose blocks that stack themselves into an arch
  const mk = new THREE.Group(); mk.position.set(0.21, TOP, 0.07); mk.scale.setScalar(1.45);
  const BC = [ORANGE, BLUE, TEAL, 0xe05a6a, GOLD, 0x7fbf4a];
  const SPOTS = [V(-0.045, 0.02, 0), V(0.045, 0.02, 0), V(-0.045, 0.062, 0), V(0.045, 0.062, 0), V(0, 0.102, 0), V(0, 0.145, 0)];
  const blocks = BC.map((c, i) => {
    const w = i === 4 ? 0.13 : 0.04, h = 0.036, b = new THREE.Mesh(new RoundedBoxGeometry(w, h, 0.045, 3, 0.007), glossy(c));
    const a = i / 6 * TAU + 0.4; b.userData = { scatter: V(Math.cos(a) * 0.07, 0.018, Math.sin(a) * 0.06), sr: a, snap: SPOTS[i], k: 0 };
    b.position.copy(b.userData.scatter); b.rotation.y = a; mk.add(b); return b;
  });
  shadowed(mk); A.add(mk, { at: 0.8, dur: 0.7, rise: 0.12 }); A.hint(mk, ORANGE, 0.09, 0.0);

  // station 3: publish — a paper plane on a launch cone
  const pub = new THREE.Group(); pub.position.set(0, TOP, -0.15); pub.scale.setScalar(1.6);
  const padM = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.045, 0.03, 28), goldMat()); padM.position.y = 0.015; pub.add(padM);
  const planeGeo = () => { const gg_ = new THREE.BufferGeometry(); gg_.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0.05, -0.034, 0.006, -0.03, 0, -0.012, -0.03, 0, 0, 0.05, 0, -0.012, -0.03, 0.034, 0.006, -0.03], 3)); gg_.computeVertexNormals(); return gg_; };
  const pm = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.6, side: THREE.DoubleSide, emissive: 0x335577, emissiveIntensity: 0.15 });
  const planes = [0, 1, 2, 3].map((i) => { const p = new THREE.Mesh(planeGeo(), pm); p.userData = { fly: -9, i }; p.scale.setScalar(i ? 0.7 : 1); p.position.set(0, 0.05, 0); pub.add(p); p.visible = i === 0; return p; });
  A.add(pub, { at: 1.0, dur: 0.7, rise: 0.12 }); A.hint(pub, BLUE, 0.07, 0.0);

  A.tag('يكتشف', 0, TEAL, V(-0.21, 0.42, 0.12), { at: 1.3 });
  A.tag('ينشئ', 0, ORANGE, V(0.21, 0.42, 0.12), { at: 1.4 });
  A.tag('ينشر', 0, BLUE, V(0, 0.46, -0.15), { at: 1.5 });

  const st = { d: false, c: false, p: false }; let dAt = -9, cAt = -9, pAt = -9, finale = -9;
  const upd = () => { const n = +st.d + +st.c + +st.p; ctx.ui.hud(n < 3 ? `اكتشفت ${['٠', '١', '٢'][n]} من ٣` : 'اجتمعت الأدوار الثلاثة'); if (n === 3 && finale < 0) { finale = A.now + 1.4; setTimeout(() => ctx.ui.done(), 2200); } };
  A.touch(disc, () => { st.d = true; dAt = A.now; ctx.ui.card({ tag: 'دور المتعلم', title: 'مكتشفاً', body: 'ليس المتعلم اليوم متلقياً للمعرفة؛ إنه يكتشفها بنفسه.', color: TEAL }); upd(); }, { color: TEAL });
  A.touch(mk, () => { st.c = true; cAt = A.now; ctx.ui.card({ tag: 'دور المتعلم', title: 'منشئاً', body: 'ينشئ المعرفة ويبنيها عبر التفاعل والتشارك والتعاون.', color: ORANGE }); upd(); }, { color: ORANGE });
  A.touch(pub, () => { st.p = true; pAt = A.now; planes.forEach((p, i) => { p.userData.fly = A.now + i * 0.25; p.visible = true; }); ctx.ui.card({ tag: 'دور المتعلم', title: 'ناشراً', body: 'ينشرها فيصبح أكثر إنتاجية ونشاطاً وإيجابية في المواقف التعليمية.', color: BLUE }); upd(); }, { color: BLUE });
  ctx.ui.hud('المس ما حول المتعلم');

  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.004, 8, 80), new THREE.MeshBasicMaterial({ color: GOLD, transparent: true, opacity: 0, toneMapped: false })); ring.rotation.x = Math.PI / 2; ring.position.y = 0.5; g.add(ring);
  const sp = []; for (let i = 0; i < 16; i++) { const s = softLight([TEAL, ORANGE, BLUE][i % 3], 0.022, 0); g.add(s); sp.push({ s, ph: Math.random(), a: Math.random() * TAU, r: 0.05 + Math.random() * 0.22 }); }
  const tmp = V();
  return {
    update(t, dt, e) {
      A.update(t, dt, e);
      // learner turns toward the last touched station
      const last = Math.max(dAt, cAt, pAt); const tgt = last === dAt ? Math.atan2(-0.2, 0.1) : last === cAt ? Math.atan2(0.2, 0.1) : Math.atan2(0, -0.2);
      me.rotation.y = THREE.MathUtils.damp(me.rotation.y, last > -9 ? tgt : Math.sin(t * 0.5) * 0.6, 5, dt);
      // discover: stones part, gem rises
      const dk = clamp01((t - dAt) / 1.2), dd = dAt > -9 ? ease(dk) : 0;
      stones.forEach((s) => { const u = s.userData, o = dd * 0.07; s.position.set(u.home.x + Math.cos(u.a) * o, u.home.y - dd * 0.012, u.home.z + Math.sin(u.a) * o); });
      gem.position.y = 0.03 + dd * 0.12 + Math.sin(t * 2) * 0.004 * dd; gem.rotation.y = t * 1.4; gg.material.opacity = THREE.MathUtils.damp(gg.material.opacity, 0.35 + dd * 0.5, 4, dt); gg.scale.setScalar(0.12 + dd * 0.12); gg.position.y = gem.position.y + 0.01;
      lens.position.set(0.0 + Math.sin(t * 0.8) * 0.01 * (1 - dd), 0.16 + dd * 0.12, 0.02); lens.rotation.z = Math.sin(t * 0.9) * 0.2;
      // create: blocks snap into an arch
      blocks.forEach((b, i) => { const u = b.userData, k = clamp01((t - cAt - i * 0.22) / 0.6), kk = cAt > -9 ? easeBack(k) : 0; b.position.lerpVectors(u.scatter, u.snap, Math.min(1, kk)); b.position.y += Math.sin(Math.min(1, kk) * Math.PI) * 0.06; b.rotation.y = u.sr * (1 - Math.min(1, kk)); if (cAt < 0) b.position.y += Math.sin(t * 1.2 + i) * 0.003; });
      // publish: planes loop over the plinth
      planes.forEach((p) => { const u = p.userData, k = (t - u.fly) / 3.4; if (u.i === 0 && u.fly < 0) { p.position.y = 0.055 + Math.sin(t * 1.8) * 0.004; p.rotation.y = Math.sin(t * 0.7) * 0.3; return; } if (k < 0 || k > 1) { p.visible = u.i === 0 && k < 0 || (u.i === 0 && k > 1); if (k > 1) { p.position.set(0, 0.055, 0); p.rotation.set(0, 0, 0); } if (u.i && k > 1) p.visible = false; return; } p.visible = true; const a = k * TAU * 0.9 + u.i * 0.7, R = 0.06 + k * 0.1 + u.i * 0.01; p.position.set(Math.sin(a) * R, 0.06 + Math.sin(k * Math.PI) * 0.12 + u.i * 0.01, (1 - Math.cos(a)) * R * 0.9 + 0.02); tmp.set(Math.cos(a), 0, Math.sin(a)); p.rotation.y = Math.atan2(tmp.x, tmp.z); p.rotation.z = -0.4; });
      // finale: a ring of light rises
      const fk = clamp01((t - finale) / 1.5); ring.material.opacity = finale > 0 ? ease(fk) * (0.7 + Math.sin(t * 4) * 0.2) : 0; ring.rotation.z = t; ring.scale.setScalar(0.5 + ease(fk) * 0.5);
      sp.forEach((d) => { const k = (t * 0.12 + d.ph) % 1; d.s.position.set(Math.cos(d.a + t * 0.3) * d.r, TOP + 0.05 + k * 0.35, Math.sin(d.a + t * 0.3) * d.r); d.s.material.opacity = Math.sin(k * Math.PI) * 0.6 * ease((t - 1.2) / 1.5); });
    },
  };
}
