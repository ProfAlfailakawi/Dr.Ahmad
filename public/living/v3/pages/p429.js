import * as THREE from 'three';
import { mat, glossy, goldMat, shadowed, glow, stag, ease, easeBack, clamp01 } from '../../kit.js?v=25';
import { scene, RoundedBox, TAU, contactShadow, lightPool } from '../lib/a8-kit.js?v=25';
export const meta = { free: true, center: [0.48, 0.575], typeLabel: 'مجسّم تفاعلي' };

const GL = (c, i = 1) => new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: i, roughness: 0.3 });
const PC = [
  { n: 'محو الأمية الإلكترونية', c: 0x3b8fe0, body: 'من أهداف الجهد المطلوب العمل على محو الأمية الإلكترونية، وتنمية روح البحث والتطوير.' },
  { n: 'إنتاج عربي حقيقي', c: 0xf29a2e, body: 'يحتاج العالم العربي إلى إنتاج عربي حقيقي فيما يتعلق بتكنولوجيا الاتصالات والحاسبات الآلية.' },
  { n: 'أقسام الهندسة', c: 0x7ac143, body: 'توجيه جهود حقيقية لأقسام الاتصالات والإلكترونيات في كليات الهندسة العربية، لتخرّج مهندسين قادرين على إبداع تكنولوجيا تتلاءم مع المنطقة.' },
  { n: 'ربط مراكز البحث', c: 0xd9344b, body: 'العمل على ربط شبكات مراكز البحث العلمي بالمحيط المتوسطي والعالمي.' },
  { n: 'ربط الاستثمار بالبحث', c: 0x2c5aa0, body: 'ربط الاستثمار الصناعي والتكنولوجي بخطط قابلة للتطبيق في البحث العلمي سيقلل من الفجوة الرقمية بين العالم العربي والعالم.' },
];
const RI = 0.06, RO = 0.31, KC = 0.023, KR = 0.03, KW = Math.sqrt(KR * KR - KC * KC);
const sA = Math.PI + Math.atan(KC / KW), sB = -Math.atan(KC / KW);
function pieceShape(a0, a1) {
  const rm = (RI + RO) / 2;
  const P2 = (a, x, y) => new THREE.Vector2(Math.cos(a) * x - Math.sin(a) * y, Math.sin(a) * x + Math.cos(a) * y);
  const pts = [];
  const gap = 0.012; a0 += gap; a1 -= gap;
  pts.push(P2(a0, RI, 0), P2(a0, rm - KW, 0));
  for (let i = 1; i < 14; i++) { const u = i / 14, th = sA + (sB - sA) * u; pts.push(P2(a0, rm + KR * Math.cos(th), KC + KR * Math.sin(th))); }
  pts.push(P2(a0, rm + KW, 0), P2(a0, RO, 0));
  for (let i = 1; i < 22; i++) { const a = a0 + (a1 - a0) * (i / 22); pts.push(new THREE.Vector2(Math.cos(a) * RO, Math.sin(a) * RO)); }
  pts.push(P2(a1, RO, 0), P2(a1, rm + KW, 0));
  for (let i = 1; i < 14; i++) { const u = i / 14, th = sB + (sA - sB) * u; pts.push(P2(a1, rm + KR * Math.cos(th), KC + KR * Math.sin(th))); }
  pts.push(P2(a1, rm - KW, 0), P2(a1, RI, 0));
  for (let i = 1; i < 10; i++) { const a = a1 - (a1 - a0) * (i / 10); pts.push(new THREE.Vector2(Math.cos(a) * RI, Math.sin(a) * RI)); }
  return new THREE.Shape(pts);
}
function icon(i, c) {
  const g = new THREE.Group();
  if (i === 0) { [-1, 1].forEach((s) => { const p = new THREE.Mesh(new RoundedBox(0.04, 0.006, 0.05, 0.002), glossy(0xf6efdf)); p.position.set(s * 0.021, 0.012, 0); p.rotation.z = s * -0.25; g.add(p); }); const sp = new THREE.Mesh(new THREE.BoxGeometry(0.004, 0.012, 0.05), GL(c, 0.6)); sp.position.y = 0.007; g.add(sp); const fl = glow(0xffe3a0, 0.07, 0.8); fl.position.y = 0.03; g.add(fl); }
  else if (i === 1) { const sh = new THREE.Shape(); for (let k = 0; k < 32; k++) { const a = (k / 32) * TAU, rr = Math.floor(k / 2) % 2 ? 0.02 : 0.026; k ? sh.lineTo(Math.cos(a) * rr, Math.sin(a) * rr) : sh.moveTo(Math.cos(a) * rr, Math.sin(a) * rr); } sh.holes.push(new THREE.Path().absarc(0, 0, 0.008, 0, TAU, true)); const m = new THREE.Mesh(new THREE.ExtrudeGeometry(sh, { depth: 0.012, bevelEnabled: false }), glossy(0xf6efdf)); m.rotation.x = -Math.PI / 2; g.add(m); g.userData.spin = m; }
  else if (i === 2) { const ch = new THREE.Mesh(new RoundedBox(0.04, 0.008, 0.04, 0.003), glossy(0x2b2f3a)); ch.position.y = 0.006; g.add(ch); const co = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.003, 0.02), GL(0xffe3a0, 0.9)); co.position.y = 0.011; g.add(co); for (let k = -2; k <= 2; k++) [[1, 0], [0, 1]].forEach(([a, b]) => { [-1, 1].forEach((s) => { const pin = new THREE.Mesh(new THREE.BoxGeometry(a ? 0.008 : 0.003, 0.002, a ? 0.003 : 0.008), goldMat()); pin.position.set(a ? s * 0.024 : k * 0.008, 0.006, a ? k * 0.008 : s * 0.024); g.add(pin); }); }); }
  else if (i === 3) { const P = [[0, 0.01, -0.022], [-0.024, 0.01, 0.016], [0.024, 0.01, 0.016]]; P.forEach((p) => { const n = new THREE.Mesh(new THREE.SphereGeometry(0.009, 14, 10), GL(0xffe3a0, 0.9)); n.position.set(...p); g.add(n); }); [[0, 1], [1, 2], [2, 0]].forEach(([a, b]) => { const va = new THREE.Vector3(...P[a]), vb = new THREE.Vector3(...P[b]); const l = new THREE.Mesh(new THREE.CylinderGeometry(0.0013, 0.0013, va.distanceTo(vb), 6), goldMat()); l.position.copy(va).lerp(vb, 0.5); l.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), vb.clone().sub(va).normalize()); g.add(l); }); }
  else { for (let k = 0; k < 4; k++) { const cn = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.005, 24), goldMat()); cn.position.set(k % 2 * 0.004 - 0.01, 0.004 + k * 0.0055, k % 2 * 0.003); g.add(cn); } }
  return shadowed(g);
}

export default function build(ctx) {
  const S = scene(ctx, meta), g = S.g;
  const pool = lightPool(0x3b8fe0, 0.4, 0.0); pool.position.y = 0.002; g.add(pool); const shd = contactShadow(0.7, 0.7, 0.4); g.add(shd);
  const pieces = PC.map((p, i) => {
    const a0 = (i / 5) * TAU + 0.2, a1 = ((i + 1) / 5) * TAU + 0.2, am = (a0 + a1) / 2;
    const grp = new THREE.Group(); g.add(grp);
    const m = new THREE.Mesh(new THREE.ExtrudeGeometry(pieceShape(a0, a1), { depth: 0.026, bevelEnabled: true, bevelThickness: 0.004, bevelSize: 0.0035, bevelSegments: 2, curveSegments: 1 }), glossy(p.c, { roughness: 0.28 }));
    m.rotation.x = -Math.PI / 2; m.position.y = 0.026; grp.add(m);
    const ic = icon(i, p.c); const dir = new THREE.Vector3(Math.cos(am), 0, -Math.sin(am)); ic.position.copy(dir).multiplyScalar(0.19).setY(0.062); grp.add(ic);
    const lamp = glow(p.c, 0.26, 0); lamp.position.copy(dir).multiplyScalar(0.19).setY(0.07); grp.add(lamp);
    shadowed(grp);
    const out = dir.clone().multiplyScalar(0.09).setY(0.06);
    const tg = S.tag(p.n, p.c, 0.13, { ppu: 2200 }); tg.delay = 2.8 + i * 0.2;
    return { grp, dir, out, p, ic, lamp, tg, i, on: false, k: 0, ph: i * 1.3, shake: -9, born: 0.3 + i * 0.22 };
  });
  // the seal that rises when the gaps are closed
  const seal = new THREE.Group(); seal.position.y = 0.05; g.add(seal);
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.058, 0.058, 0.024, 40), goldMat()); hub.position.y = 0.0; seal.add(hub);
  const rosette = new THREE.Mesh(new THREE.TorusGeometry(0.036, 0.007, 10, 40), goldMat()); rosette.rotation.x = Math.PI / 2; rosette.position.y = 0.013; seal.add(rosette);
  const core = new THREE.Mesh(new THREE.SphereGeometry(0.022, 20, 14), GL(0xffe3a0, 0.8)); core.position.y = 0.022; seal.add(core);
  const sh = glow(0xffd27a, 0.3, 0); sh.position.y = 0.03; seal.add(sh);
  shadowed(seal);
  seal.scale.setScalar(0.0001);
  let lit = 0, fin = -1;
  const scat = (p, t) => { const r = 1; return r; };
  pieces.forEach((pc) => {
    S.touch(pc.grp, () => {
      if (!pc.on) { pc.on = true; lit++; pc.t0 = S.now; ctx.sfx.good?.(); S.burst(pc.dir.clone().multiplyScalar(0.16).setY(0.08), pc.p.c, 28, 0.5); pc.lamp.material.opacity = 0.6; if (lit === 5) { fin = S.now + 1.2; } }
      else { ctx.sfx.pop?.(); }
      ctx.ui.card({ tag: 'نحو إنتاج عربي للتقنية', title: pc.p.n, body: pc.p.body, color: pc.p.c });
      ctx.ui.hud(lit < 5 ? `${['', 'قطعة', 'قطعتان', 'ثلاث قطع', 'أربع قطع'][lit]} في مكانها` : 'اكتملت الصورة');
    }, { color: pc.p.c, size: 0.3, at: pc.dir.clone().multiplyScalar(0.19).setY(0.07), wake: 3.4 });
  });
  ctx.ui.hud('ركّب القطع لتسدّ الفجوة');

  S.loop((t, dt, e) => {
    pool.material.opacity = 0.5 * ease((t - 0.2) / 1.0) * e;
    pieces.forEach((pc) => {
      const b = easeBack((t - pc.born) / 0.9) * e;
      pc.k = THREE.MathUtils.damp(pc.k, pc.on ? 1 : 0, 3.2, dt);
      const open = 1 - pc.k, sh = clamp01(1 - (t - pc.shake) / 0.5) * Math.sin((t - pc.shake) * 55) * 0.01;
      pc.grp.position.set(pc.out.x * open, 0.0, pc.out.z * open).addScaledVector(pc.dir, 0).setY(pc.out.y * open + (pc.on ? 0 : Math.sin(t * 1.6 + pc.ph) * 0.006) + (1 - b) * 0.15);
      pc.grp.rotation.y = open * Math.sin(t * 0.7 + pc.ph) * 0.08; pc.grp.scale.setScalar(Math.max(0.0001, b));
      if (pc.ic.userData.spin) pc.ic.userData.spin.rotation.z = t * (pc.on ? 1.4 : 0.3);
      pc.ic.rotation.y = pc.on ? t * 0.8 : 0;
      pc.lamp.material.opacity = (pc.on ? 0.5 + 0.15 * Math.sin(t * 2 + pc.ph) : t > 3.4 ? 0.25 + 0.1 * Math.sin(t * 2.4 + pc.ph) : 0) * b;
      pc.tg.s.position.copy(pc.grp.position).addScaledVector(pc.dir, 0.15).setY(pc.grp.position.y + 0.14);
    });
    if (fin > 0 && t > fin) {
      const u = easeBack((t - fin) / 1.1); seal.scale.setScalar(Math.max(0.0001, u)); seal.position.y = 0.05 + 0.02 * u; seal.rotation.y = t * 1.0; sh.material.opacity = 0.6 * u;
      if (!S.finished && t - fin > 1.4) { S.finished = true; S.burst(new THREE.Vector3(0, 0.12, 0), 0xffd27a, 60, 0.7, 0.045); ctx.ui.card({ tag: 'اكتملت الصورة', title: 'فجوة أقل', body: 'ربط الاستثمار الصناعي والتكنولوجي بخطط قابلة للتطبيق في البحث العلمي يقلل الفجوة الرقمية بين العالم العربي والعالم.', color: 0xd4ad55 }); ctx.ui.done(); }
    }
  });
  return { update: S.update };
}
