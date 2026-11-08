import * as THREE from 'three';
import { P, ease, easeBack, clamp01, stag, mat, glossy, goldMat, shadowed, glow, lightTube } from '../../kit.js?v=21';
import { animator, shadowBlob, V, TAU, softLight } from '../lib/a1-kit.js?v=21';

export const meta = { free: true, center: [0.5, 0.8], typeLabel: 'مجسّم تفاعلي' };

const COPPER = 0xe08a2e, TEAL = 0x22b5a8, GOLD = 0xd4ad55, BLUE = 0x3a86e6;

function gearGeo(R, r, n, hole, depth) {
  const s = new THREE.Shape();
  for (let i = 0; i < n; i++) {
    const a = i / n * TAU, w = TAU / n;
    const p = [[r, a], [R, a + w * 0.18], [R, a + w * 0.42], [r, a + w * 0.6]];
    p.forEach(([rad, ang], k) => { const x = Math.cos(ang) * rad, y = Math.sin(ang) * rad; (i === 0 && k === 0) ? s.moveTo(x, y) : s.lineTo(x, y); });
  }
  s.closePath();
  const h = new THREE.Path(); h.absarc(0, 0, hole, 0, TAU, true); s.holes.push(h);
  return new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: true, bevelThickness: 0.004, bevelSize: 0.004, bevelSegments: 2, curveSegments: 12 });
}

export default function build(ctx) {
  const g = new THREE.Group(); g.position.copy(P(meta.center[0], meta.center[1])); ctx.stage.add(g);
  const A = animator(ctx, g, 0.95);
  const sh1 = shadowBlob(0.5, 0.36, 0.3); sh1.position.set(-0.2, 0.002, 0); const sh2 = shadowBlob(0.4, 0.3, 0.3); sh2.position.set(0.24, 0.002, 0); g.add(sh1, sh2);

  // left: the gear of craft (تقنية)
  const craft = new THREE.Group(); craft.position.set(-0.22, 0.0, 0.0); craft.scale.setScalar(1.4);
  const cm = glossy(COPPER, { metalness: 0.75, roughness: 0.3, clearcoat: 0.4 });
  const gear = new THREE.Mesh(gearGeo(0.115, 0.095, 14, 0.028, 0.03), cm); gear.position.set(0, 0.145, -0.015);
  const gear2 = new THREE.Mesh(gearGeo(0.062, 0.05, 8, 0.014, 0.03), glossy(0xf2c36b, { metalness: 0.75, roughness: 0.3 })); gear2.position.set(0.15, 0.065, -0.015);
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.05, 20), goldMat()); hub.rotation.x = Math.PI / 2; hub.position.set(0, 0.145, 0.006);
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.145, 10), goldMat()); post.position.set(0, 0.075, -0.015);
  const peg = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.009, 0.05, 14), goldMat()); peg.rotation.x = Math.PI / 2; peg.position.set(0.15, 0.065, 0.0);
  const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, 0.014, 32), goldMat()); foot.position.set(0.04, 0.014, -0.01); foot.scale.set(1.8, 1, 1);
  craft.add(gear, gear2, hub, post, peg, foot); shadowed(craft);
  A.add(craft, { at: 0.1, dur: 0.8, rise: 0.15 }); A.hint(craft, COPPER, 0.13, 0.02, [0, 0, 0]);
  gear.position.y = 0.145; // gear pivots about its own centre
  // right: the armillary of science (تكنولوجيا)
  const sci = new THREE.Group(); sci.position.set(0.22, 0, 0); sci.scale.setScalar(1.4);
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.02, 0.1, 18), goldMat()); stem.position.y = 0.06;
  const sbase = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, 0.014, 32), goldMat()); sbase.position.y = 0.014;
  const arm = new THREE.Group(); arm.position.y = 0.2;
  const rings = [[0, 0, 0], [Math.PI / 2, 0, 0], [0, Math.PI / 2, 0.5], [0.9, 0.4, 0]].map(([x, y, z], i) => { const r = new THREE.Mesh(new THREE.TorusGeometry(0.11 - i * 0.004, 0.0045, 10, 64), goldMat()); r.rotation.set(x, y, z); arm.add(r); return r; });
  const core = new THREE.Mesh(new THREE.OctahedronGeometry(0.036, 0), new THREE.MeshStandardMaterial({ color: 0xb5fff4, emissive: TEAL, emissiveIntensity: 1.0, roughness: 0.15, metalness: 0.1 })); arm.add(core);
  const cg = glow(TEAL, 0.24, 0.8); arm.add(cg);
  sci.add(stem, sbase, arm); shadowed(sci);
  A.add(sci, { at: 0.3, dur: 0.8, rise: 0.15 });
  const coreSlot = new THREE.Group(); // touch target for the core (a bigger invisible-ish hit sphere)
  const hit = new THREE.Mesh(new THREE.SphereGeometry(0.06, 12, 8), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false })); arm.add(hit);
  A.hint(sci, TEAL, 0.075, 0.02);

  // three beads that orbit the armillary: human, matter, tool
  const BEADS = [
    { k: 'h', t: 'الإنسان', col: 0xf0702a, tilt: [0.5, 0, 0], sp: 0.9, ph: 0 },
    { k: 'm', t: 'المادة', col: 0x7fcf5a, tilt: [0, 0, 0.9], sp: -0.7, ph: 2 },
    { k: 't', t: 'الأداة', col: BLUE, tilt: [1.2, 0.8, 0], sp: 0.55, ph: 4 },
  ].map((b) => {
    const pivot = new THREE.Group(); pivot.rotation.set(...b.tilt); arm.add(pivot);
    const bead = new THREE.Mesh(new THREE.SphereGeometry(0.016, 20, 14), new THREE.MeshStandardMaterial({ color: b.col, emissive: b.col, emissiveIntensity: 0.55, roughness: 0.25 }));
    pivot.add(bead); const gl = glow(b.col, 0.07, 0.9); bead.add(gl);
    return { ...b, pivot, bead, bump: -9 };
  });

  A.tag('تقنية', 0, COPPER, V(-0.2, 0.0, 0.16), { at: 1.0 });
  A.tag('تكنولوجيا', 0, TEAL, V(0.25, 0.0, 0.16), { at: 1.1 });

  // the bridge of light between the two, kindled once both are touched
  const bridge = lightTube(new THREE.QuadraticBezierCurve3(V(-0.07, 0.22, 0.04), V(0.03, 0.42, 0.08), V(0.17, 0.3, 0.04)), { radius: 0.006, color: 0xffd27a, speed: 0.5 });
  g.add(bridge); bridge.userData.fill(0); let bridgeAt = -1;

  // drifting light from the plinth, like the sparks over the hand
  const sparks = [];
  for (let i = 0; i < 20; i++) { const s = softLight([GOLD, TEAL, COPPER][i % 3], 0.02 + (i % 3) * 0.004, 0); g.add(s); sparks.push({ s, ph: Math.random(), a: Math.random() * TAU, r: 0.1 + Math.random() * 0.25, sp: 0.07 + Math.random() * 0.08 }); }

  const seen = new Set();
  const see = (k, tag, title, body, col) => {
    ctx.ui.card({ tag, title, body, color: col }); seen.add(k); ctx.ui.hud(`اكتشفت ${['٠', '١', '٢', '٣', '٤', '٥'][seen.size]} من ٥`);
    if (seen.has('c') && seen.has('g') && bridgeAt < 0) bridgeAt = A.now;
    if (seen.size >= 5) setTimeout(() => ctx.ui.done(), 1200);
  };
  let gearBoost = 0;
  A.touch(craft, () => { gearBoost = 1; see('g', 'التقنية', 'الأسلوب أو الطريقة', 'الطريقة المنتهجة لفعل شيء، وإتقان التطبيق عملياً وليس علمياً.', COPPER); }, { color: COPPER });
  A.touch(sci, () => see('c', 'التكنولوجيا', 'علم الحرفة', 'من «تكنو» بمعنى حرفة و«لوجي» بمعنى علم؛ علم تطبيقي يخدم البشرية.', TEAL), { color: TEAL });
  BEADS.forEach((b) => ctx.tap(b.bead, () => { b.bump = A.now; ctx.sfx.pop?.(); see(b.k, 'من مصادر المنظومة', b.t, b.k === 'h' ? 'مصدر بشري تدخل فيه التكنولوجيا ضمن منظومتها.' : 'مصدر غير بشري تدخل فيه التكنولوجيا ضمن منظومتها.', b.col); }));
  ctx.ui.hud('المس الترس والكرة الحلقية');

  return {
    update(t, dt, e) {
      A.update(t, dt, e);
      gearBoost = Math.max(0, gearBoost - dt * 0.35);
      const w = 0.5 + gearBoost * 2.2;
      gear.rotation.z += dt * w * e; gear2.rotation.z -= dt * w * 14 / 8 * e + 0.0;
      rings.forEach((r, i) => { r.rotation.y += dt * (0.25 + i * 0.12) * (i % 2 ? -1 : 1) * 0; });
      arm.rotation.y = t * 0.35; arm.rotation.z = Math.sin(t * 0.4) * 0.08;
      core.rotation.y = t * 1.2; core.rotation.x = t * 0.7; cg.scale.setScalar(0.22 + Math.sin(t * 2.2) * 0.02);
      BEADS.forEach((b) => { const a = t * b.sp + b.ph; b.bead.position.set(Math.cos(a) * 0.11, 0, Math.sin(a) * 0.11); const k = t - b.bump; b.bead.scale.setScalar(k >= 0 && k < 0.6 ? 1 + Math.sin(k / 0.6 * Math.PI) * 0.8 : 1); });
      if (bridgeAt >= 0) bridge.userData.fill(clamp01((t - bridgeAt) / 1.2)); bridge.userData.update(dt);
      sparks.forEach((d) => { const k = (t * d.sp + d.ph) % 1; d.s.position.set(Math.cos(d.a + t * 0.2) * d.r, 0.04 + k * 0.4, Math.sin(d.a + t * 0.2) * d.r * 0.6); d.s.material.opacity = Math.sin(k * Math.PI) * 0.6 * ease((t - 1) / 1.5); });
    },
  };
}
