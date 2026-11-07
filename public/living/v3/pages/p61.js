import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { P, ease, easeBack, clamp01, stag, mat, glossy, goldMat, shadowed, glow } from '../../kit.js?v=15';
import { animator, canvasTexture, softLight, shadowBlob, V, TAU } from '../lib/a1-kit.js?v=15';

export const meta = { free: true, center: [0.55, 0.65], typeLabel: 'مجسّم تفاعلي' };

const TEAL = 0x1fa99a, RED = 0xe0503a, GOLD = 0xd4ad55, NAVY = 0x233a4a;

function screenTex() {
  return canvasTexture(256, 160, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, w, h); gr.addColorStop(0, '#103f4a'); gr.addColorStop(1, '#1fa99a');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(255,255,255,.55)'; g.lineWidth = 3;
    for (let i = 1; i <= 4; i++) { g.beginPath(); g.arc(w / 2, h * 1.05, i * 34, Math.PI * 1.1, Math.PI * 1.9); g.stroke(); }
    g.fillStyle = '#ffd27a'; g.beginPath(); g.arc(w / 2, h * 0.62, 9, 0, TAU); g.fill();
  });
}

// the little emblems that live inside the bubbles
function book() {
  const g = new THREE.Group();
  const cov = glossy(RED, { roughness: 0.4 }), pg = mat(0xfff7e4);
  const a = new THREE.Mesh(new RoundedBoxGeometry(0.05, 0.012, 0.07, 2, 0.003), cov); a.position.set(-0.026, 0, 0); a.rotation.z = 0.12;
  const b = a.clone(); b.position.x = 0.026; b.rotation.z = -0.12;
  const pa = new THREE.Mesh(new THREE.BoxGeometry(0.046, 0.008, 0.064), pg); pa.position.set(-0.025, 0.009, 0); pa.rotation.z = 0.12;
  const pb = pa.clone(); pb.position.x = 0.025; pb.rotation.z = -0.12;
  g.add(a, b, pa, pb); return g;
}
function headphones() {
  const g = new THREE.Group(), m = glossy(NAVY), c = glossy(TEAL);
  const arc = new THREE.Mesh(new THREE.TorusGeometry(0.036, 0.005, 10, 36, Math.PI), m); arc.position.y = 0.0;
  [-1, 1].forEach((s) => { const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.014, 22), c); cup.rotation.z = Math.PI / 2; cup.position.set(s * 0.037, -0.006, 0); g.add(cup); });
  g.add(arc); g.position.y = 0.008; return g;
}
function microscope() {
  const g = new THREE.Group(), m = glossy(0xe0503a), s = glossy(0x2a2a30, { roughness: 0.35 });
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.034, 0.008, 28), s); base.position.y = -0.04;
  const arm = new THREE.Mesh(new THREE.TorusGeometry(0.03, 0.005, 10, 28, Math.PI * 1.1), m); arm.position.set(0.006, -0.01, 0); arm.rotation.z = -Math.PI * 0.55;
  const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.011, 0.07, 18), m); tube.position.set(-0.012, 0.012, 0); tube.rotation.z = 0.35;
  const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.02, 14), s); lens.position.set(-0.025, -0.027, 0); lens.rotation.z = 0.35;
  const stage = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.004, 0.034), s); stage.position.set(-0.02, -0.03, 0);
  g.add(base, arm, tube, lens, stage); g.scale.setScalar(1.05); return g;
}
function picture() {
  const g = new THREE.Group();
  const tex = canvasTexture(256, 192, (c, w, h) => { const gr = c.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#79c8ff'); gr.addColorStop(1, '#d9f3ff'); c.fillStyle = gr; c.fillRect(0, 0, w, h); c.fillStyle = '#ffd35a'; c.beginPath(); c.arc(190, 50, 26, 0, TAU); c.fill(); c.fillStyle = '#3d9970'; c.beginPath(); c.moveTo(0, h); c.lineTo(80, 70); c.lineTo(150, h); c.fill(); c.fillStyle = '#2b7a5a'; c.beginPath(); c.moveTo(90, h); c.lineTo(180, 90); c.lineTo(w, h); c.fill(); });
  const frame = new THREE.Mesh(new RoundedBoxGeometry(0.085, 0.066, 0.01, 2, 0.003), goldMat());
  const img = new THREE.Mesh(new THREE.PlaneGeometry(0.07, 0.052), new THREE.MeshBasicMaterial({ map: tex, toneMapped: false })); img.position.z = 0.0055;
  g.add(frame, img); return g;
}
function reel() {
  const g = new THREE.Group();
  const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.01, 40), glossy(NAVY)); disc.rotation.x = Math.PI / 2;
  for (let i = 0; i < 5; i++) { const a = i / 5 * TAU; const h = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.009, 0.012, 14), mat(0xfff4dc)); h.rotation.x = Math.PI / 2; h.position.set(Math.cos(a) * 0.025, Math.sin(a) * 0.025, 0); g.add(h); }
  const play = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.014, 3), glossy(0xffc15a)); play.rotation.set(Math.PI / 2, 0, -Math.PI / 2); play.position.z = 0.003;
  g.add(disc, play); return g;
}

export default function build(ctx) {
  const g = new THREE.Group(); g.position.copy(P(meta.center[0], meta.center[1])); ctx.stage.add(g);
  const A = animator(ctx, g, 0.82);
  const sh = shadowBlob(0.9, 0.55, 0.28); g.add(sh);

  // laptop: the innovation itself
  const lap = new THREE.Group(); lap.position.set(0, 0.0, 0.08); lap.scale.setScalar(1.75);
  const body = new THREE.Mesh(new RoundedBoxGeometry(0.27, 0.014, 0.19, 3, 0.006), glossy(0xd9dde0, { metalness: 0.3, roughness: 0.3 })); body.position.y = 0.007;
  const keys = new THREE.Mesh(new THREE.PlaneGeometry(0.22, 0.09), mat(0x39434a)); keys.rotation.x = -Math.PI / 2; keys.position.set(0, 0.0145, -0.015);
  const lid = new THREE.Group(); lid.position.set(0, 0.014, -0.09); lid.rotation.x = -0.28;
  const shell = new THREE.Mesh(new RoundedBoxGeometry(0.27, 0.17, 0.01, 3, 0.005), glossy(0xd9dde0, { metalness: 0.3, roughness: 0.3 })); shell.position.y = 0.085;
  const scr = new THREE.Mesh(new THREE.PlaneGeometry(0.25, 0.152), new THREE.MeshBasicMaterial({ map: screenTex(), toneMapped: false })); scr.position.set(0, 0.086, 0.0055);
  lid.add(shell, scr); lap.add(body, keys, lid); shadowed(lap);
  A.add(lap, { at: 0.1, dur: 0.8, rise: 0.12 }); A.hint(lap, TEAL, 0.1, 0.0);

  // four bubbles on a slowly turning ring
  const ring = new THREE.Group(); ring.position.y = 0.34; g.add(ring);
  const defs = [
    { make: book, key: 'w', title: 'مثيرات مكتوبة', body: 'النص المكتوب، كالكتاب والمقروء الإلكتروني.', tint: RED },
    { make: headphones, key: 'a', title: 'مثيرات مسموعة', body: 'كالتسجيل الصوتي والتعليق الشفهي.', tint: TEAL },
    { make: picture, key: 'p', title: 'مثيرات مصوّرة', body: 'الصور والرسوم والمجسّمات تقرّب الظاهرة الدقيقة إلى المتعلم.', tint: 0xe0503a },
    { make: reel, key: 'm', title: 'مثيرات متحرّكة', body: 'مثيرات متحرّكة بشكل إلكتروني.', tint: 0xe3a52a },
  ];
  const glassM = new THREE.MeshPhysicalMaterial({ color: 0xbfeee8, roughness: 0.04, metalness: 0, transparent: true, opacity: 0.28, clearcoat: 1, depthWrite: false });
  const bubbles = defs.map((d, i) => {
    const slot = new THREE.Group(); slot.userData.ang = i / defs.length * TAU + 0.4; ring.add(slot);
    const holder = new THREE.Group(); slot.add(holder);
    const em = d.make(); em.userData.spin = true; em.scale.setScalar(1.45); holder.add(shadowed(em));
    const shell = new THREE.Mesh(new THREE.SphereGeometry(0.1, 36, 24), glassM.clone());
    const rimM = new THREE.Mesh(new THREE.SphereGeometry(0.1015, 30, 20), new THREE.MeshBasicMaterial({ color: d.tint, transparent: true, opacity: 0.4, side: THREE.BackSide, depthWrite: false, toneMapped: false }));
    shell.renderOrder = 3; rimM.renderOrder = 2; holder.add(shell, rimM);
    const link = new THREE.Mesh(new THREE.CylinderGeometry(0.0018, 0.0018, 1, 6), new THREE.MeshBasicMaterial({ color: d.tint, transparent: true, opacity: 0.0, toneMapped: false, depthWrite: false })); g.add(link);
    const b = { d, slot, holder, em, shell, rimM, link, popAt: -9, seen: false };
    return b;
  });
  const bw = new THREE.Group(); // wrapper objects for animator (scale-in)
  bubbles.forEach((b, i) => { A.add(b.holder, { at: 0.4 + i * 0.25, dur: 0.8, rise: 0.12, parent: b.slot }); A.hint(b.holder, b.d.tint, 0.1, 0, [0, 0, 0]); });

  // rising stimuli: soft lights drift up from the screen
  const dots = [];
  for (let i = 0; i < 22; i++) { const s = softLight([TEAL, GOLD, RED][i % 3], 0.022 + (i % 4) * 0.004, 0.0); g.add(s); dots.push({ s, ph: Math.random(), x: (Math.random() - 0.5) * 0.2, z: (Math.random() - 0.5) * 0.06, sp: 0.1 + Math.random() * 0.1 }); }

  A.tag('مستحدث', 0, TEAL, V(0, 0.02, 0.34), { at: 1.2 });
  const tip = A.tag('مثيرات', 0, GOLD, V(0, 0.62, 0), { at: 9e9 });

  let found = 0, lapSeen = false;
  const prog = () => ctx.ui.hud(`اكتشفت ${['٠', '١', '٢', '٣', '٤', '٥'][found + (lapSeen ? 1 : 0)]} من ٥`);
  const check = () => { prog(); if (found === 4 && lapSeen) { ctx.ui.done(); ctx.sfx.good?.(); } };
  A.touch(lap, () => { lapSeen = true; ctx.ui.card({ tag: 'تعريف', title: 'ما المستحدث التكنولوجي؟', body: 'كل ما هو جديد في المجال التكنولوجي ويمكن توظيفه بفاعلية وإيجابية في العملية التعليمية.', color: TEAL }); check(); }, { color: TEAL });
  bubbles.forEach((b) => A.touch(b.holder, () => {
    b.popAt = A.now;
    if (!b.seen) { b.seen = true; found++; }
    tip.userData.hide = false;
    ctx.ui.card({ tag: 'نمط من المثيرات', title: b.d.title, body: b.d.body, color: b.d.tint }); check();
  }, { color: b.d.tint }));
  ctx.ui.hud('المس ما يرتفع من الحاسوب');

  const tmp = new THREE.Vector3(), a = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
  return {
    update(t, dt, e) {
      A.update(t, dt, e);
      ring.rotation.y = Math.sin(t * 0.25) * 0.5 + t * 0.06;
      bubbles.forEach((b, i) => {
        const ang = b.slot.userData.ang, R = 0.31;
        b.slot.position.set(Math.cos(ang) * R, Math.sin(t * 0.8 + i * 1.7) * 0.015 + (i % 2) * 0.03, Math.sin(ang) * R * 0.45);
        b.em.rotation.y = t * 0.9 + i; b.em.rotation.x = Math.sin(t * 0.7 + i) * 0.25;
        const pk = t - b.popAt, popping = pk >= 0 && pk < 2.6;
        // pop: glass swells and vanishes, emblem rises; then the bubble re-forms
        const f = popping ? (pk < 0.25 ? pk / 0.25 : pk > 2.0 ? 1 - (pk - 2.0) / 0.6 : 1) : 0;
        b.shell.material.opacity = 0.28 * (1 - (pk < 0.25 ? f : popping && pk < 2.0 ? 1 : popping ? f : 0));
        b.rimM.material.opacity = 0.4 * (1 - (popping && pk < 2.0 ? 1 : popping ? f : 0));
        b.shell.scale.setScalar(1 + (popping && pk < 0.25 ? f * 0.3 : 0));
        b.em.position.y = f * 0.05; b.em.scale.setScalar(1.45 + f * 0.45);
        b.link.material.opacity = f * 0.5;
        if (f > 0.01) {
          b.holder.getWorldPosition(tmp); g.worldToLocal(tmp); const o = V(0, 0.2, 0.02);
          a.copy(tmp).sub(o); const len = a.length(); b.link.position.copy(o).addScaledVector(a, 0.5); b.link.scale.set(1, len, 1); b.link.quaternion.setFromUnitVectors(up, a.normalize());
          if (pk < 0.1) { tip.position.copy(tmp).add(V(0, 0.115, 0)); }
          if (pk < 0.1) A.retag(tip, b.d.title.replace('مثيرات ', ''), b.d.tint);
        }
      });
      // tip tag follows the last popped bubble only while popping
      let any = false; bubbles.forEach((b) => { const pk = t - b.popAt; if (pk >= 0 && pk < 2.2) { any = true; b.holder.getWorldPosition(tmp); g.worldToLocal(tmp); tip.position.copy(tmp).add(V(0, 0.115, 0)); } });
      tip.userData.at = any ? 0 : 9e9; tip.userData.hide = !any;
      dots.forEach((d) => { const k = (t * d.sp + d.ph) % 1; d.s.position.set(d.x * (0.6 + k), 0.1 + k * 0.28, d.z); d.s.material.opacity = Math.sin(k * Math.PI) * 0.55 * ease((t - 1.0) / 1.5); });
    },
  };
}
