// p142 — a laptop with a library in its screen; four pop-ups on the keyboard show what changed the designer's trade.
import * as THREE from 'three';
import { P, ease, easeBack, clamp01, stag, glow } from '../../kit.js?v=20';
import { rb, lathe, std, lit, gloss, glass, brass, add, grp, hit, Seq, Pulse, touch, chip, plinth, organic, at, rnd, TAU, INK, GOLD } from '../lib/a2.js?v=20';

export const meta = { free: true, center: [0.5, 0.7], typeLabel: 'مجسّم تفاعلي' };

function libTex() {
  const c = document.createElement('canvas'); c.width = 512; c.height = 340; const g = c.getContext('2d');
  const gr = g.createLinearGradient(0, 0, 0, 340); gr.addColorStop(0, '#f2dfb8'); gr.addColorStop(1, '#d9b27a'); g.fillStyle = gr; g.fillRect(0, 0, 512, 340);
  const shelf = (x, w) => { g.fillStyle = '#9a6a3c'; g.fillRect(x, 20, w, 250); const cols = ['#d9382b', '#2a8fd0', '#8aa51f', '#ef8f2a', '#f2e6cf', '#5b3a8a']; for (let r = 0; r < 4; r++) { g.fillStyle = '#7a4f28'; g.fillRect(x, 20 + r * 62, w, 5); let xx = x + 6; for (let k = 0; xx < x + w - 12; k++) { const bw = 8 + (k * 7) % 9; g.fillStyle = cols[(k + r) % 6]; g.fillRect(xx, 28 + r * 62, bw, 50 - (k * 5) % 14); xx += bw + 2; } } };
  shelf(24, 150); shelf(338, 150);
  g.fillStyle = '#c0392b'; g.beginPath(); g.moveTo(170, 340); g.lineTo(344, 340); g.lineTo(310, 250); g.lineTo(210, 250); g.fill();
  g.fillStyle = '#7a4f28'; g.fillRect(222, 214, 70, 8); g.fillRect(230, 222, 6, 28); g.fillRect(278, 222, 6, 28);
  g.fillStyle = '#1f9aa6'; g.beginPath(); g.arc(256, 150, 22, 0, TAU); g.fill();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function keysTex() {
  const c = document.createElement('canvas'); c.width = 512; c.height = 330; const g = c.getContext('2d'); g.fillStyle = '#c9ced2'; g.fillRect(0, 0, 512, 330);
  g.fillStyle = '#8f979d'; for (let r = 0; r < 5; r++) for (let k = 0; k < 15; k++) { g.beginPath(); g.roundRect(14 + k * 32.5, 12 + r * 36, 28, 30, 5); g.fill(); }
  g.fillStyle = '#b3b9be'; g.beginPath(); g.roundRect(170, 214, 172, 100, 12); g.fill();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}
function globeTex() {
  const c = document.createElement('canvas'); c.width = 256; c.height = 128; const g = c.getContext('2d'); g.fillStyle = '#2a8fd0'; g.fillRect(0, 0, 256, 128);
  g.fillStyle = '#7cc46a'; [[50, 50, 30, 20], [110, 40, 22, 30], [150, 70, 28, 20], [210, 45, 24, 16], [90, 95, 16, 12], [30, 100, 14, 10]].forEach(([x, y, w, h]) => { g.beginPath(); g.ellipse(x, y, w, h, 0.3, 0, TAU); g.fill(); });
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

export default function build(ctx) {
  const g = new THREE.Group(); g.position.copy(P(meta.center[0], meta.center[1])); ctx.stage.add(g);
  const seq = new Seq(), pulse = new Pulse(), seen = new Set();
  const found = (k) => { seen.add(k); if (seen.size >= 4) ctx.ui.done(); else ctx.ui.hud(`${seen.size} من ٤`); };
  const base = organic(g, 0.98, 0.78, { color: 0xa9ded3, seed: 5 }); seq.add(base, 0, 0.7, { rise: 0.04 });
  const Y0 = 0.014;

  // ---------------- laptop
  const lap = grp(g, 0, Y0, 0.07); lap.scale.setScalar(1.25); 
  add(lap, rb(0.58, 0.016, 0.36, 0.012, 3), std(0xd5dadd, { metalness: 0.5, roughness: 0.35 }), 0, 0.008, 0, true);
  const kb = add(lap, new THREE.PlaneGeometry(0.54, 0.335), new THREE.MeshStandardMaterial({ map: keysTex(), roughness: 0.6 }), 0, 0.0166, 0); kb.rotation.x = -Math.PI / 2;
  const hinge = grp(lap, 0, 0.016, -0.18), lid = grp(hinge, 0, 0, 0); lid.rotation.x = Math.PI / 2;
  add(lid, rb(0.58, 0.37, 0.012, 0.012, 3), std(0xc6cccf, { metalness: 0.5, roughness: 0.3 }), 0, 0.185, 0, true);
  const lt = libTex();
  add(lid, new THREE.PlaneGeometry(0.54, 0.33), new THREE.MeshStandardMaterial({ map: lt, emissiveMap: lt, emissive: 0xffffff, emissiveIntensity: 0.55 }), 0, 0.185, 0.0066);
  const lglow = glow(0xffe2a0, 0.5, 0.0); lglow.position.set(0, 0.2, 0.05); lid.add(lglow);
  seq.add(lap, 0.1, 0.8, { rise: 0.04 });

  // little readers around the laptop
  const folks = [[-0.42, 0.22], [0.42, 0.22], [-0.44, -0.08], [0.44, -0.08], [-0.34, 0.34], [0.34, 0.34]].map(([x, z], i) => {
    const p = grp(g, x, Y0, z); p.rotation.y = Math.atan2(-x, -z) + Math.PI;
    add(p, new THREE.CapsuleGeometry(0.012, 0.04, 4, 10), std([0x2a8fd0, 0xef8f2a, 0x8aa51f, 0xb5489a, 0x1f9aa6, 0xd9382b][i]), 0, 0.034, 0, true);
    add(p, new THREE.SphereGeometry(0.0125, 14, 10), std(0xf1d6b8), 0, 0.078, 0, true);
    add(p, rb(0.022, 0.03, 0.004, 0.001, 2), std([0xd9382b, 0x2a8fd0][i % 2]), 0.0, 0.05, 0.014);
    seq.add(p, 0.6 + i * 0.1, 0.6); return p;
  });

  const stand = (x, col, name, delay) => {
    const s = grp(g, x, Y0 + 0.016, 0.1);
    add(s, new THREE.CylinderGeometry(0.052, 0.056, 0.01, 28), std(0xf8f2e2), 0, 0.005, 0, true);
    const t = add(s, new THREE.TorusGeometry(0.053, 0.003, 6, 36), brass(), 0, 0.01, 0); t.rotation.x = Math.PI / 2;
    hit(s, 0.07, 0, 0.06, 0); pulse.add(s, col, 0.18, 0, 0.06, 0, { op: 0.42 });
    s.scale.setScalar(1.45);
    const c = chip(name, 0, col, { k: 0.85 }); c.position.set(x, Y0 + 0.075, 0.37); g.add(c); seq.add(s, delay, 0.7); seq.add(c, 1.6, 0.5);
    return s;
  };
  const card = (title, body, col) => ctx.ui.card({ tag: 'عوامل غيّرت المهنة', title, body, color: col });

  // A) prototype loop
  const sA = stand(-0.27, 0xe0602f, 'النموذج', 0.5);
  const loop = grp(sA, 0, 0.065, 0);
  [0, 1, 2].forEach((i) => { const a = add(loop, new THREE.TorusGeometry(0.04, 0.0032, 8, 24, TAU / 3 - 0.45), gloss(0xe0602f), 0, 0, 0, true); a.rotation.set(Math.PI / 2, 0, i * TAU / 3); const c = add(loop, new THREE.ConeGeometry(0.0085, 0.02, 10), gloss(0xe0602f), Math.cos(i * TAU / 3 + TAU / 3 - 0.45) * 0.04, 0, Math.sin(i * TAU / 3 + TAU / 3 - 0.45) * 0.04); c.rotation.set(Math.PI / 2 * 0 + Math.PI / 2, 0, 0); c.lookAt(0, 0, 0); c.rotateX(Math.PI / 2); c.rotateZ(0); });
  const cube = add(sA, rb(0.036, 0.036, 0.036, 0.006, 2), gloss(0xe0b85e, { emissive: 0xffc94a, emissiveIntensity: 0.1 }), 0, 0.065, 0, true);
  let aBoost = 0;
  touch(ctx, sA, () => { aBoost = 1; card('سرعة النماذج الأولية', 'سلسلة سريعة من حلقات التجريب والتعديل حتى تنتج نسخة مُرضية، في وقت أقصر.', 0xe0602f); found('a'); }, 0xe0602f);

  // B) globe — the internet, 1995
  const sB = stand(-0.09, 0x2a8fd0, '١٩٩٥', 0.7);
  add(sB, new THREE.CylinderGeometry(0.004, 0.008, 0.03, 10), brass(), 0, 0.025, 0);
  const globe = add(sB, new THREE.SphereGeometry(0.036, 28, 20), new THREE.MeshStandardMaterial({ map: globeTex(), roughness: 0.4 }), 0, 0.07, 0, true);
  const orbitG = grp(sB, 0, 0.07, 0); orbitG.rotation.z = 0.5;
  add(orbitG, new THREE.TorusGeometry(0.055, 0.0018, 6, 60), brass(), 0, 0, 0).rotation.x = Math.PI / 2;
  const sat = add(orbitG, new THREE.SphereGeometry(0.006, 10, 8), lit(0xffe08a, 1), 0.055, 0, 0);
  const wave = add(sB, new THREE.TorusGeometry(0.04, 0.0015, 6, 40), new THREE.MeshBasicMaterial({ color: 0x2a8fd0, transparent: true, opacity: 0, depthWrite: false }), 0, 0.07, 0); wave.rotation.x = Math.PI / 2;
  let bBoost = 0;
  touch(ctx, sB, () => { bBoost = 1; card('الإنترنت والتعليم عن بعد', 'بدأ الاهتمام بالإنترنت وإيصال التعليم لأماكن بعيدة عام ١٩٩٥، وازداد الطلب على برامج التعلم عن بعد.', 0x2a8fd0); found('b'); }, 0x2a8fd0);

  // C) the trait switchboard
  const sC = stand(0.09, 0x8aa51f, 'السمات', 0.9);
  add(sC, rb(0.075, 0.016, 0.07, 0.004, 2), std(0x3b4047, { metalness: 0.4 }), 0, 0.02, 0, true);
  const knobs = [-0.022, 0, 0.022].map((x, i) => {
    add(sC, new THREE.BoxGeometry(0.006, 0.002, 0.052), std(0x14161a), x, 0.0285, 0);
    const k = add(sC, new THREE.CylinderGeometry(0.0072, 0.0072, 0.008, 16), brass(), x, 0.034, 0, true);
    const l = add(sC, new THREE.SphereGeometry(0.0045, 10, 8), lit(0x8aa51f, 1), x, 0.062, 0.02);
    add(sC, new THREE.CylinderGeometry(0.0015, 0.0015, 0.03, 6), brass(), x, 0.044, 0.02);
    return { k, l, on: i !== 1, z: i === 1 ? -0.02 : 0.02, zt: i === 1 ? -0.02 : 0.02 };
  });
  touch(ctx, sC, () => { knobs.forEach((o) => { o.on = !o.on; o.zt = o.on ? 0.02 : -0.02; }); card('تصميم يراعي السمات', 'تُصمم هذه البرامج بعناية في ضوء السمات التي يمكن أن تُستخدم أو لا تُستخدم في الدروس المعتمدة على الإنترنت.', 0x8aa51f); found('c'); }, 0x8aa51f);

  // D) knowledge shelf
  const sD = stand(0.27, 0xb5489a, 'المعرفة', 1.1);
  const sh = grp(sD, 0, 0.012, 0);
  add(sh, rb(0.085, 0.1, 0.034, 0.003, 2), std(0x9a6a3c), 0, 0.05, 0, true);
  [0, 1, 2].forEach((r) => { add(sh, rb(0.078, 0.002, 0.03, 0.001, 1), std(0x6b4326), 0, 0.016 + r * 0.032, 0.002); let x = -0.032; for (let k = 0; k < 6; k++) { const hh = 0.022 + ((k * 5 + r * 3) % 7) * 0.001; add(sh, new THREE.BoxGeometry(0.008, hh, 0.022), std([0xd9382b, 0x2a8fd0, 0x8aa51f, 0xef8f2a, 0xb5489a, 0xf2e6cf][(k + r) % 6]), x, 0.019 + r * 0.032 + hh / 2 - 0.0, 0.006); x += 0.0112; } });
  const orbs = Array.from({ length: 6 }, (_, i) => { const o = glow([0xffd27a, 0xff9ac0, 0x9fe8ff][i % 3], 0.022, 0.95); sD.add(o); return o; });
  const peg = [[-0.07, 0.03], [0.07, 0.03], [-0.06, -0.05], [0.06, -0.05], [0, 0.07], [0, -0.08]].map(([x, z], i) => { const p = grp(sD, x, 0.01, z); add(p, new THREE.CapsuleGeometry(0.005, 0.01, 3, 8), std(0xb5489a), 0, 0.01, 0); add(p, new THREE.SphereGeometry(0.0055, 8, 6), std(0xf1d6b8), 0, 0.026, 0); return { p, x, z }; });
  let dT = -1;
  touch(ctx, sD, () => { dT = 0; card('إدارة المعرفة', 'تحدد المؤسسة الوثائق وتنشر معارفها الصريحة والضمنية لتحسين أدائها، بعدما كانت الخبرات محصورة في أفراد.', 0xb5489a); found('d'); }, 0xb5489a);

  ctx.ui.hud('أربع قطع على لوحة المفاتيح');
  const tmpc = new THREE.Color();
  return {
    update(t, dt, e) {
      seq.update(t, e); pulse.update(t, e);
      lid.rotation.x = Math.PI / 2 - (Math.PI / 2 + 0.28) * ease((t - 0.2) / 1.3);
      lglow.material.opacity = e * (0.25 + 0.1 * Math.sin(t * 1.3));
      folks.forEach((p, i) => { p.position.y = Y0 + Math.max(0, Math.sin(t * 1.5 + i * 1.3)) * 0.003; });
      // A: loop
      aBoost = Math.max(0, aBoost - dt * 0.5);
      loop.rotation.y += dt * (1.4 + aBoost * 6);
      const ph = (t * (0.5 + aBoost * 1.5)) % 1; cube.scale.setScalar(0.65 + 0.35 * ph); cube.material.emissiveIntensity = 0.1 + 0.9 * ph * ph + aBoost; cube.rotation.y += dt * 1.2;
      // B: globe
      bBoost = Math.max(0, bBoost - dt * 0.6);
      globe.rotation.y += dt * (0.5 + bBoost * 5); orbitG.rotation.y += dt * (0.4 + bBoost * 2);
      sat.position.set(Math.cos(t * 1.4) * 0.055, 0, Math.sin(t * 1.4) * 0.055);
      const wk = bBoost > 0 ? 1 - bBoost : 1; wave.scale.setScalar(0.5 + wk * 2); wave.material.opacity = bBoost > 0 ? 0.7 * bBoost : 0;
      // C: switches
      knobs.forEach((o) => { o.z += (o.zt - o.z) * Math.min(1, dt * 8); o.k.position.z = o.z; o.l.material.emissive.setHex(o.on ? 0x8aa51f : 0xe0453c); o.l.material.color.setHex(o.on ? 0x8aa51f : 0xe0453c); o.l.material.emissiveIntensity = 0.8 + 0.3 * Math.sin(t * 3); });
      // D: orbs circle the shelf, then fly out to people and return
      if (dT >= 0) { dT += dt; if (dT > 3.4) dT = -1; }
      orbs.forEach((o, i) => {
        const a = t * 0.9 + i * TAU / 6;
        let x = Math.cos(a) * 0.05, y = 0.12 + Math.sin(t * 2 + i) * 0.006, z = Math.sin(a) * 0.03;
        if (dT >= 0) { const k = Math.sin(clamp01((dT - i * 0.12) / 2.0) * Math.PI); const q = peg[i % 6]; x += (q.x - x) * k; z += (q.z - z) * k; y += (0.04 - y) * k; }
        o.position.set(x, y, z); o.material.opacity = 0.95 * e;
      });
    },
  };
}
