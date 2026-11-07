import * as THREE from 'three';
import { P, ease, easeBack, clamp01, stag, mat, glossy, goldMat, shadowed, glow } from '../../kit.js?v=18';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { animator, canvasTexture, shadowBlob, V, TAU } from '../lib/a1-kit.js?v=18';

export const meta = { free: true, center: [0.4, 0.27], typeLabel: 'لعبة ترتيب' };

const COLS = [0x2fb6a8, 0xf0902a, 0x3a8fe0, 0x7fbf4a, 0xe5b93c];
const STEPS = [
  { tag: 'التحليل', title: 'تحليل العملية التعليمية', body: 'تحليل العملية التعليمية وأهدافها ومحتوى الدروس، مع مراعاة الفروق الفردية بين الطلبة.' },
  { tag: 'التخطيط', title: 'تحديد الأهداف والخطط', body: 'تنظيم الأهداف بوضع الخطط الأسبوعية أو الشهرية.' },
  { tag: 'الإدارة', title: 'إدارة العملية التعليمية', body: 'ضمن جداول زمنية وفي إطار التعاون التشاركي.' },
  { tag: 'المصادر', title: 'تحديد المراجع والمصادر', body: 'اختيار المراجع والمصادر المناسبة للعملية التعليمية.' },
  { tag: 'الحقائب', title: 'الحقائب الإلكترونية', body: 'توظيفها لتطوير مهارات التعلم الذاتي وتحسين التواصل مع المعلم.' },
];

// small drawn emblem for each step
function glyph(i, col) {
  return canvasTexture(128, 128, (g) => {
    g.fillStyle = '#fffaf0'; g.fillRect(0, 0, 128, 128);
    g.strokeStyle = col; g.fillStyle = col; g.lineWidth = 9; g.lineCap = 'round'; g.lineJoin = 'round';
    if (i === 0) { g.beginPath(); g.arc(56, 56, 28, 0, TAU); g.stroke(); g.beginPath(); g.moveTo(78, 78); g.lineTo(104, 104); g.stroke(); }
    else if (i === 1) { for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) g.fillRect(24 + c * 30, 24 + r * 30, 22, 22); }
    else if (i === 2) { g.beginPath(); g.arc(64, 64, 38, 0, TAU); g.stroke(); g.beginPath(); g.moveTo(64, 64); g.lineTo(64, 38); g.moveTo(64, 64); g.lineTo(84, 74); g.stroke(); }
    else if (i === 3) { g.strokeRect(30, 26, 68, 76); g.beginPath(); g.moveTo(44, 50); g.lineTo(84, 50); g.moveTo(44, 70); g.lineTo(84, 70); g.stroke(); }
    else { g.strokeRect(26, 48, 76, 52); g.beginPath(); g.moveTo(48, 48); g.lineTo(48, 34); g.lineTo(80, 34); g.lineTo(80, 48); g.stroke(); g.beginPath(); g.moveTo(26, 72); g.lineTo(102, 72); g.stroke(); }
  });
}

export default function build(ctx) {
  const g = new THREE.Group(); g.position.copy(P(meta.center[0], meta.center[1])); ctx.stage.add(g);
  const A = animator(ctx, g, 0.95);
  g.position.y = 0.12;
  const sh = shadowBlob(0.95, 0.65, 0.3); sh.position.y = -0.118; g.add(sh);
  // a wooden planter: the tree grows out of its soil
  const pl = new THREE.Group();
  const wood = new THREE.Mesh(new RoundedBoxGeometry(0.76, 0.12, 0.5, 4, 0.02), glossy(0xb77d46, { roughness: 0.45 })); wood.position.y = -0.06;
  const band = new THREE.Mesh(new RoundedBoxGeometry(0.775, 0.016, 0.515, 3, 0.006), goldMat()); band.position.y = -0.02;
  const soil = new THREE.Mesh(new RoundedBoxGeometry(0.68, 0.03, 0.42, 3, 0.012), mat(0x4a2f1d, { roughness: 0.95 })); soil.position.y = -0.006;
  pl.add(wood, band, soil); for (let q = 0; q < 16; q++) { const c = new THREE.Mesh(new THREE.SphereGeometry(0.012 + (q % 3) * 0.004, 8, 6), mat(0x5c3b26, { roughness: 1 })); c.position.set((Math.sin(q * 2.3)) * 0.3, 0.008, Math.cos(q * 1.7) * 0.17); c.scale.y = 0.5; pl.add(c); }
  shadowed(pl); A.add(pl, { at: 0, dur: 0.7, rise: 0.2 });

  // the tree: a golden trunk with five bare branches waiting
  const trunk = new THREE.Group(); A.add(trunk, { at: 0.2, dur: 0.8, rise: 0 });
  const tp = [[0.001, 0], [0.05, 0.002], [0.034, 0.03], [0.02, 0.1], [0.016, 0.2], [0.013, 0.3]].map(([x, y]) => new THREE.Vector2(x, y));
  const tr = new THREE.Mesh(new THREE.LatheGeometry(tp, 24), glossy(0x6b4426, { roughness: 0.5 })); tr.position.y = 0.012; trunk.add(tr);
  const SOCK = [V(-0.13, 0.2, 0.05), V(0.13, 0.26, -0.03), V(-0.1, 0.34, -0.05), V(0.1, 0.4, 0.04), V(0, 0.49, 0)];
  const branches = SOCK.map((s, i) => {
    const from = V(0, 0.06 + i * 0.05, 0), mid = V(s.x * 0.45, s.y * 0.8, s.z * 0.5 + 0.0), curve = new THREE.QuadraticBezierCurve3(from, mid.setY(s.y * 0.72 + 0.04), s.clone().setY(s.y - 0.02));
    const geo = new THREE.TubeGeometry(curve, 24, 0.0075, 8); const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: 0xf0b45a, emissive: 0xb86a1e, emissiveIntensity: 0.5, roughness: 0.4 })); const n = geo.index.count; m.geometry.setDrawRange(0, 0); g.add(m);
    const dorm = new THREE.Mesh(new THREE.TubeGeometry(curve, 24, 0.0075, 8), mat(0x7a5638, { roughness: 0.7 })); g.add(dorm);
    // socket ring
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.04, 0.004, 8, 40), new THREE.MeshBasicMaterial({ color: COLS[i], transparent: true, opacity: 0, toneMapped: false })); ring.position.copy(s); ring.rotation.x = Math.PI / 2; g.add(ring);
    const leaves = new THREE.Group(); leaves.position.copy(s); for (let q = 0; q < 5; q++) { const lf = new THREE.Mesh(new THREE.SphereGeometry(0.02 + (q % 2) * 0.006, 12, 8), new THREE.MeshStandardMaterial({ color: COLS[i], emissive: COLS[i], emissiveIntensity: 0.45, roughness: 0.5 })); lf.position.set(Math.cos(q * 1.9) * 0.05, 0.03 + (q % 3) * 0.015, Math.sin(q * 1.9) * 0.04); leaves.add(lf); } leaves.scale.setScalar(0.0001); g.add(leaves);
    return { m, n, curve, ring, grown: 0, target: 0, dorm, leaves };
  });

  // five discs waiting on the rim, in scrambled places
  const SLOT = [2, 0, 4, 1, 3]; // which place on the rim each step sits at
  const discs = STEPS.map((st, i) => {
    const a = SLOT[i] / 5 * TAU + 0.5, R = 0.29, home = V(Math.cos(a) * R, 0.026, Math.sin(a) * R * 0.6);
    const d = new THREE.Group(); d.position.copy(home);
    const top = new THREE.Mesh(new THREE.CylinderGeometry(0.043, 0.043, 0.014, 40), [glossy(COLS[i]), new THREE.MeshBasicMaterial({ map: glyph(i, '#' + COLS[i].toString(16).padStart(6, '0')) }), glossy(COLS[i])]);
    d.add(top); shadowed(d); d.scale.setScalar(1.4);
    A.add(d, { at: 0.7 + i * 0.18, dur: 0.7, rise: 0.15 });
    A.hint(d, COLS[i], 0.07, 0.009);
    const tag = A.tag(st.tag, 0.13, COLS[i], home.clone().add(V(0, 0.09, 0.0)), { at: 1.5 + i * 0.1 });
    return { d, st, i, home, tag, state: 'idle', t0: 0, wob: -9 };
  });

  let next = 0, hintAt = 0;
  const bulbs = SOCK.map((s, i) => { const b = glow(COLS[i], 0.0, 0.9); b.position.copy(s).add(V(0, 0.01, 0)); g.add(b); return b; });
  ctx.ui.hud('ركّب الخطوات من التحليل إلى الدعم');
  const check = (dd) => {
    if (dd.state !== 'idle') return;
    if (dd.i === next) {
      dd.state = 'fly'; dd.t0 = A.now; dd.d.userData.keepY = true; branches[dd.i].target = 1; dd.tag.userData.hide = true; A.hideHints(dd.d); next++;
      ctx.sfx.good?.(); ctx.ui.card({ tag: `الخطوة ${['١', '٢', '٣', '٤', '٥'][dd.i]} من ٥`, title: dd.st.title, body: dd.st.body, color: COLS[dd.i] });
      ctx.ui.hud(next < 5 ? 'أحسنت، ما الخطوة التالية؟' : 'اكتملت الشجرة');
      if (next === 5) setTimeout(() => { ctx.ui.done(); }, 1600);
    } else { dd.wob = A.now; ctx.sfx.bad?.(); ctx.ui.toast('ليست الخطوة التالية'); }
  };
  discs.forEach((dd) => A.touch(dd.d, () => check(dd), { color: COLS[dd.i], sfx: 'pop', burst: false }));

  const tmp = V();
  return {
    update(t, dt, e) {
      A.update(t, dt, e);
      discs.forEach((dd) => {
        const u = dd.d.userData;
        if (dd.state === 'idle') {
          dd.d.position.y = dd.home.y + Math.sin(t * 1.6 + dd.i) * 0.004;
          dd.d.rotation.y = dd.i + t * 0.5;
          const w = t - dd.wob; dd.d.rotation.z = w >= 0 && w < 0.5 ? Math.sin(w * 40) * 0.25 * (1 - w * 2) : 0;
        } else if (dd.state === 'fly') {
          const k = clamp01((t - dd.t0) / 1.1), s = SOCK[dd.i];
          dd.d.position.lerpVectors(dd.home, s, ease(k)); dd.d.position.y += Math.sin(k * Math.PI) * 0.12;
          dd.d.rotation.x = ease(k) * Math.PI / 2; dd.d.rotation.y = 0; dd.d.rotation.z = 0;
          if (k >= 1) { dd.state = 'done'; ctx.fx.burst(A.sp(s), COLS[dd.i], 24, 0.4, 0.035); }
        } else { dd.d.rotation.y = 0; dd.d.rotation.z = Math.sin(t * 1.4 + dd.i) * 0.08; dd.d.position.y = SOCK[dd.i].y + Math.sin(t * 1.3 + dd.i) * 0.004; dd.d.rotation.x = Math.PI / 2; }
      });
      branches.forEach((b, i) => {
        b.grown = THREE.MathUtils.damp(b.grown, b.target, 2.2, dt);
        b.m.geometry.setDrawRange(0, Math.floor(b.n / 6 * b.grown) * 6); b.leaves.scale.setScalar(Math.max(0.0001, THREE.MathUtils.clamp((b.grown - 0.6) / 0.4, 0, 1))); b.dorm.visible = e > 0.5 && stag(t, 0.4 + i * 0.12, 0.5) > 0.5;
        b.ring.material.opacity = (b.target ? 0 : 0.0) + (i === next && t > 3 ? 0.35 + Math.sin(t * 3) * 0.2 : 0) * e;
        b.ring.visible = true;
        const bulb = bulbs[i], k = b.grown > 0.95 ? 1 : 0; bulb.scale.setScalar(THREE.MathUtils.damp(bulb.scale.x, k * (0.18 + Math.sin(t * 2 + i) * 0.015), 4, dt) + 0.0001);
      });
    },
  };
}
