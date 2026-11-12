// p181 — behaviourism vs cognitivism: a sealed lacquer box (stimulus in, response out) beside a glass dome with a thinking network inside.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { P, ease, easeBack, clamp01, stag, mat, glossy, goldMat, shadowed } from '../../kit.js?v=28';
import { tagSprite, setSpr, softLight } from '../../v2/common.js?v=28';
import { blobShadow, hints, finder } from '../lib/a3-kit.js?v=28';

export const meta = { free: true, center: [0.42, 0.68], typeLabel: 'مقارنة مجسّمة' };

const ORANGE = 0xef7a2a, TEAL = 0x23989e;

export default function build(ctx) {
  const g = new THREE.Group(); g.position.copy(P(0.42, 0.68)); ctx.stage.add(g);
  const H = hints(), found = finder(ctx, 3);
  const shA = blobShadow(0.36, 0.3, 0.3); shA.position.set(-0.17, 0.003, 0.02); const shB = blobShadow(0.36, 0.34, 0.3); shB.position.set(0.17, 0.003, 0); g.add(shA, shB);
  const Y = 0.004;
  const hit = (r) => new THREE.Mesh(new THREE.SphereGeometry(r, 8, 6), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }));

  // ---------------- left: the sealed box
  const box = new THREE.Group(); box.position.set(-0.17, Y, 0.0); g.add(box);
  const body = new THREE.Mesh(new RoundedBoxGeometry(0.2, 0.15, 0.18, 5, 0.018), glossy(ORANGE, { emissive: 0x6a2a00, emissiveIntensity: 0.12 })); body.position.y = 0.075; box.add(body);
  const seam = new THREE.Mesh(new RoundedBoxGeometry(0.204, 0.006, 0.184, 2, 0.003), goldMat()); seam.position.y = 0.05; box.add(seam);
  const panel = new THREE.Mesh(new RoundedBoxGeometry(0.15, 0.07, 0.01, 3, 0.004), mat(0x2b2620)); panel.position.set(0, 0.09, 0.09); box.add(panel);
  // stimulus lamp on top
  const stalk = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.035, 8), goldMat()); stalk.position.set(0, 0.165, 0); box.add(stalk);
  const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.02, 20, 14), new THREE.MeshBasicMaterial({ color: 0xffe08a, transparent: true, opacity: 0.3, toneMapped: false })); lamp.position.set(0, 0.195, 0); box.add(lamp);
  const lampGlow = softLight(0xffc24a, 0.2, 0); lampGlow.position.copy(lamp.position); box.add(lampGlow);
  // lever
  const lever = new THREE.Group(); lever.position.set(0, 0.09, 0.098); box.add(lever);
  const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.005, 0.05, 10), goldMat()); arm.rotation.x = Math.PI / 2; arm.position.z = 0.025; lever.add(arm);
  const knob = new THREE.Mesh(new THREE.SphereGeometry(0.011, 14, 10), glossy(0xc43a2a)); knob.position.z = 0.05; lever.add(knob);
  // ramp + cup + ball
  const ramp = new THREE.Mesh(new RoundedBoxGeometry(0.03, 0.006, 0.12, 2, 0.002), goldMat()); ramp.position.set(0.0, 0.035, 0.15); ramp.rotation.x = 0.35; box.add(ramp);
  const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.02, 0.016, 20), mat(0xf6efe0)); cup.position.set(0, 0.008, 0.22); box.add(cup);
  const pellet = new THREE.Mesh(new THREE.SphereGeometry(0.012, 18, 14), glossy(0xe6b84a, { metalness: 0.6, emissive: 0xffb300, emissiveIntensity: 0.3 })); pellet.visible = false; box.add(pellet);
  const boxHit = hit(0.14); boxHit.position.set(0, 0.1, 0.05); box.add(boxHit);
  let bT = -9, bCount = 0;
  ctx.tap(box, () => {
    bT = now; bCount += 1; ctx.sfx.pop?.();
    ctx.ui.card(bCount % 2 ? { tag: 'النظرية السلوكية', title: 'مثير ثم استجابة', body: 'تهتم بالارتباط بين المثيرات والسلوك، ويظهر أثرها في التعزيز الفوري عند سكنر.', color: ORANGE } : { tag: 'النظرية السلوكية', title: 'التقويم بالنتائج', body: 'يُقوَّم المتعلم بما يحققه من أهداف سلوكية تظهر نتائجها.', color: ORANGE });
    found('b');
  });

  // ---------------- right: the glass dome with a thinking network
  const dome = new THREE.Group(); dome.position.set(0.17, Y, 0); g.add(dome);
  const R = 0.11;
  const ring = new THREE.Mesh(new THREE.CylinderGeometry(R + 0.008, R + 0.012, 0.016, 56), goldMat()); ring.position.y = 0.008; dome.add(ring);
  const floor = new THREE.Mesh(new THREE.CylinderGeometry(R, R, 0.004, 48), mat(0x14585c)); floor.position.y = 0.018; dome.add(floor);
  const shell = new THREE.Mesh(new THREE.SphereGeometry(R, 48, 24, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshPhysicalMaterial({ color: 0xd8f6f6, transparent: true, opacity: 0.2, roughness: 0.04, clearcoat: 1, side: THREE.DoubleSide, depthWrite: false }));
  shell.position.y = 0.018; shell.renderOrder = 6; dome.add(shell);
  const N = 15, nodes = [];
  let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < N; i++) {
    const a = rnd() * Math.PI * 2, rr = Math.sqrt(rnd()) * R * 0.78, y = 0.03 + rnd() * R * 0.62 * (1 - rr / R * 0.7);
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.009 + rnd() * 0.005, 14, 10), new THREE.MeshBasicMaterial({ color: 0x35c2c8, toneMapped: false }));
    m.position.set(Math.cos(a) * rr, y + 0.018, Math.sin(a) * rr); dome.add(m);
    const gl = softLight(0x35c2c8, 0.07, 0.3); m.add(gl);
    nodes.push({ m, gl, base: m.position.clone(), act: 0, ph: rnd() * 6, d: 0 });
  }
  const seg = [];
  nodes.forEach((n, i) => {
    nodes.map((o, j) => [j, n.base.distanceTo(o.base)]).filter(([j]) => j !== i).sort((a, b) => a[1] - b[1]).slice(0, 2).forEach(([j]) => seg.push(i, j));
  });
  const lg = new THREE.BufferGeometry(); const lp = new Float32Array(seg.length * 3); lg.setAttribute('position', new THREE.BufferAttribute(lp, 3));
  const lines = new THREE.LineSegments(lg, new THREE.LineBasicMaterial({ color: 0x35c2c8, transparent: true, opacity: 0.55 })); lines.frustumCulled = false; dome.add(lines);
  // a little paper-gold gear in the middle: the processing
  const core = new THREE.Mesh(new THREE.IcosahedronGeometry(0.02, 1), glossy(0xe6b84a, { metalness: 0.7 })); core.position.set(0, 0.075, 0); dome.add(core);
  const domeHit = hit(R); domeHit.position.y = 0.06; dome.add(domeHit);
  let dT = -9, dCount = 0, auto = 4;
  const fireWave = () => { nodes.forEach((n) => { n.d = Math.hypot(n.base.x, n.base.z) * 5 + n.base.y; }); dT = now; };
  ctx.tap(dome, () => {
    fireWave(); dCount += 1; ctx.sfx.pop?.();
    ctx.ui.card(dCount % 2 ? { tag: 'النظرية المعرفية', title: 'ما يجري داخل العقل', body: 'تهتم بالتفكير وحل المشكلات والإدراك، وترى أن المعرفة تُكتسب بالعمليات العقلية.', color: TEAL } : { tag: 'النظرية المعرفية', title: 'عمليات التعلم', body: 'التعلم عملية تنطوي على الذاكرة والتفكير والانعكاس والتجريد والدافع.', color: TEAL });
    found('c');
  });

  // ---------------- the axis gem between them
  const gem = new THREE.Group(); gem.position.set(0, Y + 0.2, 0); g.add(gem);
  const gm = new THREE.Mesh(new THREE.OctahedronGeometry(0.026), glossy(0xf1c25a, { metalness: 0.5, emissive: 0xffb300, emissiveIntensity: 0.3 })); gm.scale.y = 1.4; gem.add(gm);
  const gr = new THREE.Mesh(new THREE.TorusGeometry(0.04, 0.0035, 8, 50), goldMat()); gr.rotation.x = Math.PI / 2; gem.add(gr);
  const gHit = hit(0.06); gem.add(gHit);
  ctx.tap(gem, () => { ctx.sfx.pop?.(); ctx.fx.burst(gem.position.clone().add(g.position), 0xf1c25a, 20, 0.3, 0.03); found('g'); ctx.ui.card({ tag: 'بين النظريتين', title: 'من الظاهر إلى الداخل', body: 'إذا قوّمت بالسلوك الظاهر فقط، فقد يفوتك ما جرى داخل عقل المتعلم.', color: 0xd4ad55 }); });

  H.add(box, ORANGE, 0.26, [0, 0.12, 0.02], 4.2); H.add(dome, TEAL, 0.3, [0, 0.07, 0], 4.5); H.add(gem, 0xf1c25a, 0.14, [0, 0, 0], 4.8);
  shadowed(box);
  const tagA = tagSprite('سلوكية', 0.19, ORANGE), tagB = tagSprite('معرفية', 0.19, TEAL);
  tagA.position.set(-0.17 / 1, 0.025, 0.25); tagB.position.set(0.17, 0.025, 0.25); g.add(tagA, tagB);
  ctx.ui.hud('المس الصندوق ثم القبة');
  let now = 0;
  const tmp = new THREE.Vector3();
  return {
    update(t, dt, e) {
      now = t;
      shA.material.opacity = shB.material.opacity = 0.3 * e;
      const gb = Math.max(stag(t, 0.15, 0.8, easeBack) * e, 0.001); box.scale.setScalar(gb * 1.3);
      const gd = Math.max(stag(t, 0.4, 0.8, easeBack) * e, 0.001); dome.scale.setScalar(gd * 1.25);
      gem.scale.setScalar(Math.max(stag(t, 1.2, 0.7, easeBack) * e, 0.001)); gem.position.y = Y + 0.2 + Math.sin(t * 1.5) * 0.008; gm.rotation.y = t * 0.9; gr.rotation.z = t * 0.7;
      // box animation: lamp flash (auto every 5 s too), lever press, pellet rolls to the cup
      const kb = t - bT;
      const autoB = t > 6 && (t % 6) < 0.1 && bT < 0 ? 1 : 0;
      const lamOn = kb < 0.45 ? 1 : (t > 1.2 && bT < 0 ? (0.5 + 0.5 * Math.sin(t * 2.2)) * 0.6 : 0);
      lamp.material.opacity = 0.3 + lamOn * 0.7; lampGlow.material.opacity = lamOn * 0.7;
      lever.rotation.x = kb > 0.25 && kb < 0.7 ? -0.5 * Math.sin((kb - 0.25) / 0.45 * Math.PI) : 0;
      if (kb > 0.45 && kb < 2.8) {
        const p = clamp01((kb - 0.45) / 0.9);
        pellet.visible = true;
        pellet.position.set(0, 0.07 - 0.052 * p * p + Math.sin(p * Math.PI) * 0.0, 0.1 + 0.115 * p);
        if (p >= 1) { pellet.position.set(0, 0.03 + Math.abs(Math.sin((kb - 1.35) * 8)) * 0.014 * Math.exp(-(kb - 1.35) * 2.5), 0.22); }
        pellet.material.emissiveIntensity = 0.3 + (p >= 1 ? 0.7 : 0);
      } else pellet.visible = false;
      // dome network
      if (t > 1.5 && t - dT > auto + 3.5) { fireWave(); auto = 0; }
      const kd = t - dT;
      let o = 0;
      nodes.forEach((n, i) => {
        const a = clamp01(1 - Math.abs(kd - n.d * 0.55 - 0.2) * 1.8);
        n.act += (a - n.act) * Math.min(1, dt * 10);
        n.m.position.set(n.base.x + Math.sin(t * 0.7 + n.ph) * 0.006, n.base.y + Math.sin(t * 0.9 + n.ph) * 0.006, n.base.z + Math.cos(t * 0.6 + n.ph) * 0.006);
        n.m.scale.setScalar(Math.max(stag(t, 0.8 + i * 0.05, 0.5, easeBack) * e, 0.001) * (1 + n.act * 0.9));
        n.gl.material.opacity = 0.18 + n.act * 0.7; o += n.act;
      });
      for (let k = 0; k < seg.length; k++) { const n = nodes[seg[k]].m.position; lp[k * 3] = n.x; lp[k * 3 + 1] = n.y; lp[k * 3 + 2] = n.z; }
      lg.attributes.position.needsUpdate = true;
      lines.material.opacity = (0.28 + Math.min(0.6, o * 0.12)) * clamp01((t - 2) * 0.8) * e;
      core.rotation.y = t * 1.2; core.rotation.x = t * 0.7; core.scale.setScalar(1 + Math.min(0.5, o * 0.06));
      tagA.visible = tagB.visible = t > 1.6;
      setSpr(tagA, 0.19, clamp01((t - 1.6) * 1.6) * e); setSpr(tagB, 0.19, clamp01((t - 1.8) * 1.6) * e);
      H.update(t, e);
    },
  };
}
