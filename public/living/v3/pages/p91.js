import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { P, ease, easeBack, clamp01, stag, mat, glossy, goldMat, shadowed, glow, lightTube } from '../../kit.js?v=16';
import { animator, canvasTexture, shadowBlob, V, TAU } from '../lib/a1-kit.js?v=16';

export const meta = { free: true, center: [0.4, 0.3], typeLabel: 'لعبة مطابقة' };

const box = (w, h, d, c, r = 0.004) => new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 2, r), glossy(c));
const cyl = (a, b, h, c, seg = 16) => new THREE.Mesh(new THREE.CylinderGeometry(a, b, h, seg), glossy(c));

function vest() { const g = new THREE.Group(); const t = new THREE.Mesh(new THREE.CapsuleGeometry(0.02, 0.04, 6, 14), glossy(0xf5f5f5)); t.position.y = 0.05; g.add(t); [[0.012, 0.06, 0.018, 0xe0503a], [-0.012, 0.06, 0.018, 0x3a8fe0], [0, 0.04, 0.02, 0x7fbf4a]].forEach(([x, y, z, c]) => { const s = new THREE.Mesh(new THREE.SphereGeometry(0.006, 10, 8), new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: 0.6 })); s.position.set(x, y, z); g.add(s); }); const h = new THREE.Mesh(new THREE.SphereGeometry(0.014, 14, 10), glossy(0xf5f5f5)); h.position.y = 0.1; g.add(h); const w = new THREE.Mesh(new THREE.TorusGeometry(0.02, 0.0015, 6, 18, Math.PI * 1.5), mat(0x333333)); w.position.set(0.02, 0.035, 0); w.rotation.y = Math.PI / 2; g.add(w); return g; }
function drop() { const g = new THREE.Group(); const s = new THREE.Mesh(new THREE.SphereGeometry(0.022, 20, 14), glossy(0xe0302a)); s.position.y = 0.04; const c = new THREE.Mesh(new THREE.ConeGeometry(0.022, 0.035, 20), glossy(0xe0302a)); c.position.y = 0.074; const tube = cyl(0.007, 0.007, 0.05, 0xdff3ff, 12); tube.position.set(0.04, 0.03, 0); g.add(s, c, tube); return g; }
function knee() { const g = new THREE.Group(); const a = new THREE.Mesh(new THREE.CapsuleGeometry(0.012, 0.045, 6, 12), glossy(0xf1d3b3)); a.position.set(-0.01, 0.07, 0); a.rotation.z = -0.35; const b = a.clone(); b.position.set(0.012, 0.025, 0); b.rotation.z = 0.35; const j = new THREE.Mesh(new THREE.SphereGeometry(0.015, 14, 10), glossy(0xf08a7a)); j.position.set(0, 0.048, 0); const s = box(0.04, 0.03, 0.004, 0x1c2a3a, 0.002); s.position.set(-0.04, 0.03, 0.01); const sc = new THREE.Mesh(new THREE.PlaneGeometry(0.034, 0.022), new THREE.MeshBasicMaterial({ color: 0x7fe3ff, toneMapped: false })); sc.position.set(-0.04, 0.03, 0.0125); g.add(a, b, j, s, sc); return g; }
function bike() { const g = new THREE.Group(); [-0.026, 0.026].forEach((x) => { const w = new THREE.Mesh(new THREE.TorusGeometry(0.024, 0.003, 8, 28), glossy(0x222a33)); w.position.set(x, 0.03, 0); g.add(w); }); const f = cyl(0.0028, 0.0028, 0.06, 0xe0503a, 8); f.position.set(0, 0.045, 0); f.rotation.z = 1.0; const f2 = cyl(0.0028, 0.0028, 0.04, 0xe0503a, 8); f2.position.set(0.012, 0.06, 0); f2.rotation.z = -0.6; const s = box(0.018, 0.004, 0.012, 0x222a33, 0.001); s.position.set(-0.012, 0.075, 0); const mon = box(0.016, 0.012, 0.004, 0x1c2a3a, 0.001); mon.position.set(0.03, 0.07, 0); const sc = new THREE.Mesh(new THREE.CircleGeometry(0.004, 12), new THREE.MeshBasicMaterial({ color: 0xff5a6a, toneMapped: false })); sc.position.set(0.03, 0.07, 0.0025); g.add(f, f2, s, mon, sc); return g; }
function treadmill() { const g = new THREE.Group(); const b = box(0.09, 0.012, 0.035, 0x2a2f36, 0.003); b.position.y = 0.012; const bl = new THREE.Mesh(new THREE.PlaneGeometry(0.075, 0.026), new THREE.MeshStandardMaterial({ color: 0x555d66 })); bl.rotation.x = -Math.PI / 2; bl.position.y = 0.0195; const p = cyl(0.002, 0.002, 0.06, 0xd0d6dc, 8); p.position.set(0.04, 0.045, 0.015); const p2 = p.clone(); p2.position.z = -0.015; const bar = cyl(0.002, 0.002, 0.03, 0xd0d6dc, 8); bar.rotation.x = Math.PI / 2; bar.position.set(0.04, 0.075, 0); const mon = box(0.02, 0.014, 0.006, 0x1c2a3a, 0.001); mon.position.set(0.04, 0.085, 0); g.add(b, bl, p, p2, bar, mon); return g; }
function server() { const g = new THREE.Group(); for (let i = 0; i < 3; i++) { const b = box(0.05, 0.02, 0.035, 0x34507a, 0.002); b.position.y = 0.012 + i * 0.023; const l = new THREE.Mesh(new THREE.SphereGeometry(0.0025, 8, 6), new THREE.MeshBasicMaterial({ color: 0x66ff99, toneMapped: false })); l.position.set(0.018, 0.012 + i * 0.023, 0.0185); g.add(b, l); } return g; }
const DEVS = [
  { t: 'عجلة ثابتة', full: 'عجلة ثابتة بجهاز نبض', make: bike, to: 0 },
  { t: 'جهاز الجري', full: 'جهاز جري ببرنامج معدّ خصيصاً', make: treadmill, to: 3 },
  { t: 'قياس اللاكتيك', full: 'قياس حامض اللاكتيك في الدم', make: drop, to: 1 },
  { t: 'جراحة الركبة', full: 'متابعة جراحة الركبة والغضروف على الشاشة', make: knee, to: 2 },
];
const FUNS = [
  { t: 'السعرات المفقودة', full: 'قراءة السعرات الحرارية التي فقدها اللاعب', gl: 0 },
  { t: 'التعب والتحمّل', full: 'مؤشر للتعب ومستوى تحمّل اللاعب', gl: 1 },
  { t: 'تبادل الخبرات', full: 'تسجيل العملية لتبادل الخبرات', gl: 3 },
  { t: 'نوع التدريب', full: 'تحديد التدريب وقياس النبض والمسافة المقطوعة', gl: 5 },
];
const PC = [0xe0503a, 0x3a8fe0, 0x2fb6a8, 0xf0a030];
function glyph(i, col) {
  return canvasTexture(192, 192, (g) => {
    const c = '#' + col.toString(16).padStart(6, '0');
    g.fillStyle = '#fffaf0'; g.beginPath(); g.arc(96, 96, 92, 0, TAU); g.fill();
    g.strokeStyle = c; g.lineWidth = 12; g.beginPath(); g.arc(96, 96, 84, 0, TAU); g.stroke();
    g.strokeStyle = c; g.fillStyle = c; g.lineWidth = 11; g.lineCap = 'round'; g.lineJoin = 'round';
    if (i === 0) { g.beginPath(); g.moveTo(96, 40); g.quadraticCurveTo(138, 90, 120, 130); g.quadraticCurveTo(96, 156, 72, 130); g.quadraticCurveTo(54, 100, 84, 72); g.quadraticCurveTo(86, 56, 96, 40); g.fill(); }
    else if (i === 1) { g.beginPath(); g.arc(96, 112, 46, Math.PI, 0); g.stroke(); g.beginPath(); g.moveTo(96, 112); g.lineTo(122, 78); g.stroke(); }
    else if (i === 2) { for (let r = 0; r < 3; r++) { g.beginPath(); g.arc(60, 66 + r * 30, 6, 0, TAU); g.fill(); g.beginPath(); g.moveTo(80, 66 + r * 30); g.lineTo(138, 66 + r * 30); g.stroke(); } }
    else if (i === 3) { g.strokeRect(48, 62, 96, 64); g.beginPath(); g.arc(96, 94, 11, 0, TAU); g.fill(); }
    else if (i === 4) { g.beginPath(); g.moveTo(36, 100); g.lineTo(70, 100); g.lineTo(84, 64); g.lineTo(102, 134); g.lineTo(116, 100); g.lineTo(156, 100); g.stroke(); }
    else { g.strokeRect(56, 44, 80, 104); g.beginPath(); g.moveTo(72, 78); g.lineTo(120, 78); g.moveTo(72, 100); g.lineTo(120, 100); g.moveTo(72, 122); g.lineTo(104, 122); g.stroke(); }
  });
}

export default function build(ctx) {
  const g = new THREE.Group(); g.position.copy(P(meta.center[0], meta.center[1])); ctx.stage.add(g);
  const A = animator(ctx, g, 0.95);
  g.position.y = 0.01;
  // the stage is the running track itself: a flat red oval with white lanes and a green infield
  const trk = new THREE.Group();
  const oval = (r, h, c, y, o = {}) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 72), glossy(c, o)); m.scale.set(1.0, 1, 0.86); m.position.y = y; return m; };
  trk.add(oval(0.4, 0.016, 0xc4323f, -0.008, { roughness: 0.6 }), oval(0.27, 0.018, 0x5fae45, -0.007, { roughness: 0.9 }));
  [0.37, 0.3].forEach((r) => { const l = new THREE.Mesh(new THREE.TorusGeometry(r, 0.0035, 6, 96), new THREE.MeshBasicMaterial({ color: 0xfff1e0, toneMapped: false })); l.rotation.x = Math.PI / 2; l.scale.set(1.0, 0.86, 1); l.position.y = 0.002; trk.add(l); });
  shadowed(trk); A.add(trk, { at: 0, dur: 0.6, rise: 0.1 });
  const sh = shadowBlob(1.15, 0.85, 0.22); sh.position.y = -0.01; g.add(sh);

  // a runner who never stops: the track is alive from the first second
  const runner = new THREE.Group(); const rb = new THREE.Mesh(new THREE.CapsuleGeometry(0.014, 0.034, 4, 10), glossy(0xffd27a)); rb.position.y = 0.045; const rh = new THREE.Mesh(new THREE.SphereGeometry(0.015, 14, 10), glossy(0xffd27a)); rh.position.y = 0.083; runner.add(rb, rh); const rg = glow(0xffd27a, 0.12, 0.7); rg.position.y = 0.05; runner.add(rg); g.add(runner);

  const sel = { d: -1 }; const tag = A.tag('جهاز الجري', 0, 0xffffff, V(0, 0.3, 0), { at: 9e9 }); tag.userData.hide = true;
  const SPOT = [V(-0.24, 0, 0.2), V(0.24, 0, 0.2), V(-0.24, 0, -0.2), V(0.24, 0, -0.2)];
  const devs = DEVS.map((d, i) => {
    const root = new THREE.Group(); root.position.copy(SPOT[i]);
    const pad = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.095, 0.012, 32), glossy(0xfff4e8)); pad.position.y = 0.006;
    const m = d.make(); m.position.y = 0.012; m.scale.setScalar(2.7); root.add(pad, m); shadowed(root);
    A.add(root, { at: 0.3 + i * 0.15, dur: 0.7, rise: 0.12 }); A.hint(root, PC[i], 0.1, 0.014);
    return { root, m, i, done: false, bounce: -9, to: d.to };
  });
  const funs = FUNS.map((f, k) => {
    const o = new THREE.Group(); o.position.set(-0.15 + k * 0.1, 0.13, -0.01);
    const mesh = new THREE.Mesh(new THREE.CircleGeometry(0.047, 40), new THREE.MeshBasicMaterial({ map: glyph(f.gl, PC[k]), side: THREE.DoubleSide, toneMapped: false })); o.add(mesh);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.048, 0.004, 8, 40), glossy(PC[k])); o.add(rim);
    A.add(o, { at: 0.8 + k * 0.12, dur: 0.7, rise: 0.08 }); A.hint(o, PC[k], 0.075, 0.0, [0, 0, 0]);
    return { o, mesh, rim, k, done: false, bounce: -9 };
  });

  let matched = 0; const tubes = [];
  const showTag = (text, pos, col) => { A.retag(tag, text, col); tag.position.copy(pos).add(V(0, 0.2, 0)); tag.userData.hide = false; tag.userData.until = A.now + 2.4; tag.userData.at = 0; };
  devs.forEach((d) => A.touch(d.root, () => { if (d.done) return; sel.d = d.i; ctx.ui.hud(DEVS[d.i].full); showTag(DEVS[d.i].t, d.root.position, PC[d.i]); }, { color: PC[d.i] }));
  funs.forEach((f) => A.touch(f.o, () => {
    if (f.done) return;
    if (sel.d < 0) { ctx.ui.hud(FUNS[f.k].full); showTag(FUNS[f.k].t, f.o.position.clone().setY(0.1), PC[f.k]); return; }
    const d = devs[sel.d];
    if (d.to === f.k) {
      d.done = f.done = true; sel.d = -1; matched++; ctx.sfx.good?.();
      const from = d.root.position.clone().add(V(0, 0.14, 0)), to = f.o.position.clone();
      const tb = lightTube(new THREE.QuadraticBezierCurve3(from, from.clone().lerp(to, 0.5).add(V(0, 0.1, 0)), to), { radius: 0.007, color: PC[d.i], speed: 0.6, glass: false }); g.add(tb); tb.userData.fill(0); tubes.push({ tb, at: A.now });
      ctx.ui.card({ tag: `وصلة ${['١', '٢', '٣', '٤'][matched - 1]} من ٤`, title: DEVS[d.i].t, body: FUNS[f.k].full + '.', color: PC[d.i] });
      ctx.ui.hud(matched < 4 ? 'أحسنت، اختر جهازاً آخر' : 'اكتمل المسار');
      A.hideHints(d.root); A.hideHints(f.o);
      if (matched === 4) setTimeout(() => ctx.ui.done(), 1800);
    } else { d.bounce = f.bounce = A.now; ctx.sfx.bad?.(); ctx.ui.toast('ليست الوظيفة الأخص'); sel.d = -1; }
  }, { color: PC[f.k] }));
  ctx.ui.hud('صِل كل جهاز بوظيفته الأخص');

  const cp = V();
  return {
    update(t, dt, e) {
      A.update(t, dt, e); sh.material.opacity = 0.22 * e;
      const ra = t * 0.9; runner.position.set(Math.cos(ra) * 0.335, Math.abs(Math.sin(t * 9)) * 0.005, Math.sin(ra) * 0.335 * 0.86); runner.rotation.y = -ra + Math.PI; rb.rotation.z = Math.sin(t * 9) * 0.15; runner.visible = t > 0.4;
      devs.forEach((d) => { const b = t - d.bounce; d.m.position.y = 0.012 + (sel.d === d.i ? 0.03 + Math.sin(t * 6) * 0.005 : 0) + (b >= 0 && b < 0.4 ? Math.sin(b / 0.4 * Math.PI) * 0.02 : 0); d.m.rotation.y = d.done ? t * 0.8 : sel.d === d.i ? t * 2 : Math.sin(t * 0.7 + d.i) * 0.3; });
      ctx.camera.getWorldPosition(cp); g.worldToLocal(cp);
      funs.forEach((f) => { const k = t - f.bounce; f.o.position.y = 0.13 + Math.sin(t * 1.4 + f.k) * 0.007 + (k >= 0 && k < 0.4 ? Math.sin(k / 0.4 * Math.PI) * 0.015 : 0); f.o.rotation.y = Math.atan2(cp.x - f.o.position.x, cp.z - f.o.position.z); f.rim.scale.setScalar(f.done ? 1.12 : 1); });
      tubes.forEach((q) => { q.tb.userData.fill(clamp01((t - q.at) / 0.9)); q.tb.userData.update(dt); });
      if (!tag.userData.hide && t > (tag.userData.until || 0)) tag.userData.hide = true;
    },
  };
}
