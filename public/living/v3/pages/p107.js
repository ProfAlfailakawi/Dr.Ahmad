// p107 — the other face of technology: a bright laptop ringed by the things it steals (time, sleep of lessons, the phone, endless chat).
import * as THREE from 'three';
import { P, ease, easeBack, clamp01, stag, glow } from '../../kit.js?v=15';
import { rb, lathe, std, lit, gloss, glass, brass, add, grp, hit, Seq, Pulse, touch, chip, plinth, desk, at, TAU, INK, GOLD } from '../lib/a2.js?v=15';

export const meta = { free: true, center: [0.5, 0.66], typeLabel: 'مجسّم تفاعلي' };

function screenTex() {
  const c = document.createElement('canvas'); c.width = 512; c.height = 340;
  const g = c.getContext('2d');
  const gr = g.createLinearGradient(0, 0, 0, 340); gr.addColorStop(0, '#e4f4ff'); gr.addColorStop(1, '#9fd2f5');
  g.fillStyle = gr; g.fillRect(0, 0, 512, 340);
  g.fillStyle = '#ffffff'; g.beginPath(); g.roundRect(34, 34, 300, 190, 18); g.fill();
  g.fillStyle = '#2a8fd0'; g.beginPath(); g.roundRect(54, 54, 120, 14, 7); g.fill();
  [['#2a8fd0', 90], ['#9fb3c2', 122], ['#9fb3c2', 150], ['#9fb3c2', 178]].forEach(([col, y], i) => { g.fillStyle = col; g.beginPath(); g.roundRect(54, y, i ? 240 - i * 22 : 200, 12, 6); g.fill(); });
  g.fillStyle = '#ef8f2a'; g.beginPath(); g.arc(412, 110, 62, 0, TAU); g.fill();
  g.fillStyle = '#ffffff'; g.beginPath(); g.arc(412, 110, 30, 0, TAU); g.fill();
  g.fillStyle = '#8a9a1f'; g.fillRect(360, 200, 36, 90); g.fillStyle = '#2a8fd0'; g.fillRect(404, 170, 36, 120); g.fillStyle = '#ef8f2a'; g.fillRect(448, 230, 36, 60);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function keysTex() {
  const c = document.createElement('canvas'); c.width = 512; c.height = 300;
  const g = c.getContext('2d'); g.fillStyle = '#26292e'; g.fillRect(0, 0, 512, 300);
  g.fillStyle = '#464b53';
  for (let r = 0; r < 5; r++) for (let k = 0; k < 14; k++) { g.beginPath(); g.roundRect(14 + k * 34.5, 14 + r * 38, 29, 31, 5); g.fill(); }
  g.beginPath(); g.roundRect(120, 212, 270, 30, 6); g.fill();
  g.fillStyle = '#383d44'; g.beginPath(); g.roundRect(186, 248, 140, 42, 8); g.fill();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}

export default function build(ctx) {
  const g = new THREE.Group(); g.position.copy(P(meta.center[0], meta.center[1])); ctx.stage.add(g);
  const seq = new Seq(), pulse = new Pulse(), seen = new Set();
  const found = (k) => { seen.add(k); ctx.ui.hud(`${seen.size} من ٥ — للتكنولوجيا وجه آخر`); if (seen.size >= 5) ctx.ui.done(); };

  const Y0 = 0.09; const base = desk(g, 0.86, 0.5); seq.add(base, 0, 0.7, { rise: 0.06 });

  // ---------------- laptop
  const lap = grp(g, -0.04, Y0, -0.04); lap.scale.setScalar(1.55);
  add(lap, rb(0.31, 0.012, 0.2, 0.01, 3), std(0x34383e, { metalness: 0.5, roughness: 0.35 }), 0, 0.006, 0, true);
  const kb = add(lap, new THREE.PlaneGeometry(0.28, 0.165), new THREE.MeshStandardMaterial({ map: keysTex(), roughness: 0.6 }), 0, 0.0126, -0.005); kb.rotation.x = -Math.PI / 2;
  const hinge = grp(lap, 0, 0.012, -0.1);
  const lid = grp(hinge, 0, 0, 0); lid.rotation.x = Math.PI / 2;
  add(lid, rb(0.31, 0.205, 0.008, 0.008, 3), std(0x3b4047, { metalness: 0.55, roughness: 0.3 }), 0, 0.103, 0, true);
  const stex = screenTex();
  const scr = add(lid, new THREE.PlaneGeometry(0.285, 0.185), new THREE.MeshStandardMaterial({ map: stex, emissiveMap: stex, emissive: 0xffffff, emissiveIntensity: 0.85, roughness: 0.3 }), 0, 0.103, 0.0046);
  const apple = add(lid, new THREE.CircleGeometry(0.014, 24), new THREE.MeshBasicMaterial({ color: 0xdcdcdc }), 0, 0.103, -0.0046); apple.rotation.y = Math.PI;
  const scrGlow = glow(0x6cc4ff, 0.5, 0.0); scrGlow.position.set(0, 0.1, 0.05); lid.add(scrGlow);
  hit(lap, 0.14, 0, 0.08, 0.0);
  seq.add(lap, 0.15, 0.8);
  const lapChip = chip('المهارات', 0.11, 0x2a8fd0); lapChip.position.set(-0.04, Y0 + 0.03, 0.215); g.add(lapChip); seq.add(lapChip, 1.9, 0.5);
  pulse.add(lap, 0x5fb8f5, 0.4, 0, 0.1, 0.05, { op: 0.28, amp: 0.1 });

  // ---------------- hourglass (time)
  const hg = grp(g, 0.33, Y0, -0.1); hg.scale.setScalar(1.45);
  const body = grp(hg, 0, 0, 0); body.position.y = 0.0;
  const gl = add(body, lathe([[0.0001, 0.012], [0.034, 0.015], [0.036, 0.034], [0.03, 0.062], [0.011, 0.088], [0.006, 0.098], [0.011, 0.108], [0.03, 0.134], [0.036, 0.162], [0.034, 0.181], [0.0001, 0.184]], 28), glass(0xdff3ff, 0.34, { side: THREE.DoubleSide }), 0, 0, 0);
  const sandMat = std(0xef8f2a, { roughness: 0.7 });
  const topSand = add(body, new THREE.ConeGeometry(0.03, 0.074, 20), sandMat, 0, 0.14, 0); topSand.rotation.x = Math.PI;
  const botSand = add(body, new THREE.ConeGeometry(0.032, 0.045, 20), sandMat, 0, 0.034, 0);
  const stream = add(body, new THREE.CylinderGeometry(0.0022, 0.0022, 0.1, 6), sandMat, 0, 0.065, 0);
  [0.012, 0.19].forEach((y) => add(hg, new THREE.CylinderGeometry(0.044, 0.044, 0.012, 24), brass(), 0, y - (y > 0.1 ? 0.004 : 0), 0, true));
  [[-0.04, -0.04], [0.04, -0.04], [0, 0.056]].forEach(([x, z]) => add(hg, new THREE.CylinderGeometry(0.0034, 0.0034, 0.18, 8), brass(), x * 0.85, 0.101, z * 0.8));
  hit(hg, 0.085, 0, 0.1, 0);
  seq.add(hg, 0.4, 0.8);
  let sandP = 0.12, flipT = -1, flipSpd = 0;
  const hgChip = chip('الوقت', 0.1, 0xef8f2a); hgChip.position.set(0.33, Y0 + 0.34, -0.1); g.add(hgChip); seq.add(hgChip, 2.6, 0.6);
  pulse.add(hg, 0xef8f2a, 0.2, 0, 0.1, 0, { op: 0.4 });
  touch(ctx, hg, () => { flipT = 0; ctx.sfx.whoosh?.(); ctx.ui.card({ tag: 'للتكنولوجيا وجه آخر', title: 'وقت يُهدر', body: 'أهمية الوقت الذي يُهدر تؤثر في مستقبلهم العلمي والمهني.', color: 0xef8f2a }); found('t'); }, 0xef8f2a);

  // ---------------- phone (addiction)
  const ph = grp(g, -0.3, Y0, 0.15); ph.rotation.y = 0.55; ph.scale.setScalar(1.7);
  const phb = grp(ph, 0, 0, 0);
  add(phb, rb(0.056, 0.008, 0.108, 0.012, 3), std(0x1b1d21, { metalness: 0.5, roughness: 0.3 }), 0, 0.004, 0, true);
  const pscr = add(phb, new THREE.PlaneGeometry(0.048, 0.098), new THREE.MeshStandardMaterial({ color: 0xff6a5c, emissive: 0xe0453c, emissiveIntensity: 0.9 }), 0, 0.0084, 0); pscr.rotation.x = -Math.PI / 2;
  const badge = add(phb, new THREE.SphereGeometry(0.011, 16, 12), lit(0xff3b30, 1.2), 0.026, 0.012, -0.05);
  const rings = [0, 1].map(() => { const r = add(ph, new THREE.TorusGeometry(0.05, 0.0018, 6, 40), new THREE.MeshBasicMaterial({ color: 0xe0453c, transparent: true, opacity: 0 }), 0, 0.006, 0); r.rotation.x = Math.PI / 2; return r; });
  hit(ph, 0.075, 0, 0.01, 0);
  seq.add(ph, 0.6, 0.8);
  const phChip = chip('الإدمان', 0.1, 0xe0453c); phChip.position.set(-0.3, Y0 + 0.11, 0.24); g.add(phChip); seq.add(phChip, 2.8, 0.6);
  pulse.add(ph, 0xe0453c, 0.17, 0, 0.012, 0, { op: 0.5 });
  let buzz = -1;
  touch(ctx, ph, () => { buzz = 0; ctx.sfx.bad?.(); ctx.ui.card({ tag: 'للتكنولوجيا وجه آخر', title: 'الهاتف والإدمان', body: 'صار الإدمان ظاهرة بين الطلبة، وتحتّم على التربويين وأولياء الأمور التدخل وتوعية المتعلمين.', color: 0xe0453c }); found('p'); }, 0xe0453c);

  // ---------------- chat bubbles (social media)
  const bb = grp(g, -0.33, Y0 + 0.3, -0.1); bb.scale.setScalar(1.5);
  const bubbles = [[0, 0, 0, 0.05, 0xe0453c], [0.07, -0.035, 0.03, 0.034, 0x2a8fd0], [-0.055, -0.05, 0.035, 0.028, 0xef8f2a]].map(([x, y, z, r, col], i) => {
    const b = grp(bb, x, y, z);
    const s = add(b, new THREE.SphereGeometry(r, 28, 20), gloss(col), 0, 0, 0, true); s.scale.set(1.25, 0.9, 0.8);
    const tail = add(b, new THREE.ConeGeometry(r * 0.3, r * 0.6, 12), gloss(col), -r * 0.7, -r * 0.8, 0); tail.rotation.z = 0.5;
    [-1, 0, 1].forEach((k) => add(b, new THREE.SphereGeometry(r * 0.12, 10, 8), std(0xffffff), k * r * 0.4, 0, r * 0.7));
    b.userData.r = r; return b;
  });
  hit(bb, 0.1, 0.0, -0.02, 0);
  seq.add(bb, 0.8, 0.8, { rise: 0.1 });
  const bbChip = chip('التواصل', 0.1, 0x2a8fd0); bbChip.position.set(-0.33, Y0 + 0.44, -0.1); g.add(bbChip); seq.add(bbChip, 3.0, 0.6);
  let bbT = -1;
  touch(ctx, bb, () => { bbT = 0; ctx.ui.card({ tag: 'للتكنولوجيا وجه آخر', title: 'الجلوس الطويل أمام التواصل', body: 'له خطورة صحية ونفسية، ويؤدي إلى إهمال الدروس.', color: 0x2a8fd0 }); found('b'); }, 0x2a8fd0);

  // ---------------- books (neglected lessons)
  const bk = grp(g, 0.3, Y0, 0.15); bk.rotation.y = -0.3; bk.scale.setScalar(1.55);
  const cols = [0x6b4f3f, 0x8fa6b5, 0x8a9a1f];
  const books = cols.map((col, i) => { const b = grp(bk, (i - 1) * 0.006, 0.014 + i * 0.026, 0); b.rotation.y = (i - 1) * 0.18; add(b, rb(0.1, 0.022, 0.07, 0.004, 2), std(col, { roughness: 0.6 }), 0, 0, 0, true); add(b, rb(0.094, 0.016, 0.066, 0.002, 2), std(0xf5efe0), 0.004, 0, 0); return b; });
  const dust = Array.from({ length: 6 }, (_, i) => { const s = glow(0xb7aea0, 0.03, 0.5); s.position.set((i - 2.5) * 0.017, 0.1 + (i % 2) * 0.01, (i % 3 - 1) * 0.015); bk.add(s); return s; });
  hit(bk, 0.085, 0, 0.04, 0);
  seq.add(bk, 1.0, 0.8);
  const bkChip = chip('الدروس', 0.1, 0x8a9a1f); bkChip.position.set(0.3, Y0 + 0.16, 0.24); g.add(bkChip); seq.add(bkChip, 3.2, 0.6);
  pulse.add(bk, 0x8a9a1f, 0.19, 0, 0.05, 0, { op: 0.4 });
  let bkT = -1;
  touch(ctx, bk, () => { bkT = 0; ctx.ui.card({ tag: 'للتكنولوجيا وجه آخر', title: 'دروس مهملة', body: 'يستخدم غالب المتعلمين التكنولوجيا في غير التعليم أوقات فراغهم وعطلهم.', color: 0x8a9a1f }); found('k'); }, 0x8a9a1f);

  // laptop: the bright face
  let brightT = -1;
  touch(ctx, lap, () => { brightT = 0; ctx.ui.card({ tag: 'الوجه المضيء', title: 'إيجابياتها كثيرة', body: 'يتعلم الطالب مهارات تخدمه في التعليم وفي سوق العمل بعد التخرج.', color: 0x2a8fd0 }); found('l'); }, 0x2a8fd0);

  ctx.ui.hud('المس ما حول الشاشة');

  return {
    update(t, dt, e) {
      seq.update(t, e); pulse.update(t, e);
      lid.rotation.x = Math.PI / 2 - (Math.PI / 2 + 0.3) * ease((t - 0.25) / 1.2);
      // screen breathes; brightens on touch
      if (brightT >= 0) { brightT += dt; if (brightT > 1.6) brightT = -1; }
      const bright = brightT >= 0 ? Math.sin(Math.min(1, brightT / 1.6) * Math.PI) : 0;
      scr.material.emissiveIntensity = 0.8 + 0.12 * Math.sin(t * 1.5) + 0.7 * bright;
      scrGlow.material.opacity = e * (0.28 + 0.25 * bright); scrGlow.scale.setScalar(0.5 + 0.3 * bright);
      // hourglass sand
      if (flipT >= 0) { flipT += dt; body.rotation.z = Math.PI * ease(flipT / 0.9); if (flipT >= 0.9) { flipT = -1; body.rotation.z = 0; sandP = 0; } }
      else sandP = Math.min(1, sandP + dt / 18);
      const sp = sandP;
      topSand.scale.set(1, Math.max(1 - sp, 0.001), 1); topSand.position.y = 0.102 + 0.074 * (1 - sp) * 0.5 + 0.0;
      botSand.scale.set(1, Math.max(sp, 0.001), 1); botSand.position.y = 0.012 + 0.045 * sp * 0.5;
      stream.visible = sp > 0.01 && sp < 0.995 && flipT < 0;
      // phone buzz
      let sh = 0;
      if (buzz >= 0) { buzz += dt; sh = Math.sin(buzz * 70) * 0.004 * (1 - clamp01(buzz / 0.9)); if (buzz > 1.4) buzz = -1; }
      phb.position.x = sh; badge.scale.setScalar(1 + 0.2 * Math.sin(t * 5));
      rings.forEach((r, i) => { const k = buzz >= 0 ? clamp01((buzz - i * 0.25) / 0.9) : 0; r.scale.setScalar(0.6 + k * 1.3); r.material.opacity = k > 0 && k < 1 ? 0.6 * (1 - k) : 0; });
      // bubbles
      if (bbT >= 0) { bbT += dt; if (bbT > 1.2) bbT = -1; }
      bubbles.forEach((b, i) => { const k = bbT >= 0 ? Math.sin(clamp01(bbT / 1.2) * Math.PI) : 0; b.scale.setScalar(1 + 0.45 * k * (1 - i * 0.12)); b.position.y += Math.sin(t * 1.4 + i * 2) * dt * 0.012; b.rotation.y = Math.sin(t * 0.8 + i) * 0.35; });
      bb.position.y = Y0 + 0.3 + Math.sin(t * 1.1) * 0.008;
      // books + dust
      if (bkT >= 0) { bkT += dt; if (bkT > 1.4) bkT = -1; }
      const kk = bkT >= 0 ? Math.sin(clamp01(bkT / 1.4) * Math.PI) : 0;
      books[2].position.x = 0.012 + kk * 0.08; books[2].rotation.y = 0.18 + kk * 0.5;
      dust.forEach((d, i) => { d.material.opacity = e * (0.35 + 0.3 * Math.sin(t * 1.2 + i)) * (1 - 0.7 * kk); d.position.y = 0.1 + (i % 2) * 0.012 + Math.sin(t * 0.7 + i) * 0.008 + kk * 0.03; });
    },
  };
}
