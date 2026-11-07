// p467 — a society without school: a pencil-drawn school stands on a disc; touch its props and each one turns into its digital twin, until only the social heart of the school remains.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { P, ease, easeBack, clamp01, stag, mat, glossy, goldMat, shadowed, glow } from '../../kit.js?v=15';
import { inked } from '../../pencil.js?v=15';
import { lightPool } from '../../v2/common.js?v=15';
import { Seq, Hints, Tag, TAU, V, wpos, softShadow } from '../lib/a9-kit.js?v=15';

export const meta = { free: true, center: [0.27, 0.592], typeLabel: 'مقارنة تفاعلية', title: 'مجتمع بلا مدرسة' };

const TXT = {
  clock: { a: { t: 'المدرسة التقليدية', tag: 'أوقات محددة', b: 'مبنى مدرسي يقصده الطلبة في أوقات محددة.' }, b: { t: 'مراكز على مدار الساعة', tag: '٢٤ ساعة', b: 'مراكز تعمل على مدار ٢٤ ساعة في اليوم و٧ أيام في الأسبوع.' } },
  book: { a: { t: 'كتب تقليدية', tag: 'كتب', b: 'الكتب التقليدية هي الأساس في التعليم والتعلم.' }, b: { t: 'حواسيب بدل الكتب', tag: 'حواسيب', b: 'حواسيب تحل محل الكتب التقليدية وتصبح العنصر الأساسي.' } },
  teacher: { a: { t: 'المعلم في الصف', tag: 'داخل الصف', b: 'يسمع الطلبة معلمهم داخل الصف.' }, b: { t: 'المعلم عبر الشاشة', tag: 'عبر الشاشة', b: 'يسمع الطلبة معلميهم من خلال الحواسيب والأجهزة الذكية.' } },
  school: { a: { t: 'الحاجة قائمة', tag: 'التعلم كله', b: 'الحاجة إلى المدرسة قائمة للتعلم كله.' }, b: { t: 'مهارات اجتماعية فقط', tag: 'مهارات اجتماعية', b: 'تبقى الحاجة للمدرسة لتنمية المهارات الاجتماعية فقط.' } },
};
const OR = 0xef8f2a, BL = 0x2a8fd0;

function figureTex() {
  const c = document.createElement('canvas'); c.width = 256; c.height = 192; const x = c.getContext('2d');
  x.fillStyle = '#10243a'; x.fillRect(0, 0, 256, 192);
  x.fillStyle = '#7cc8ff'; x.beginPath(); x.arc(128, 80, 34, 0, TAU); x.fill(); x.beginPath(); x.ellipse(128, 190, 64, 58, 0, Math.PI, TAU); x.fill();
  x.strokeStyle = 'rgba(124,200,255,.6)'; x.lineWidth = 5; for (let r = 1; r <= 3; r++) { x.beginPath(); x.arc(206, 40, r * 11, -2.4, -0.7); x.stroke(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

export default function build(ctx) {
  const g = new THREE.Group(); g.position.copy(P(meta.center[0], meta.center[1])); ctx.stage.add(g); g.scale.setScalar(0.64);
  const seq = new Seq(), hints = new Hints(g, 6.0), tag = new Tag(g, 0.2);
  let now = 0, finished = false;
  const done = new Set();

  const stage = new THREE.Mesh(new RoundedBoxGeometry(0.72, 0.02, 0.64, 3, 0.03), new THREE.MeshPhysicalMaterial({ color: 0xffffff, transparent: true, opacity: 0.28, roughness: 0.08, clearcoat: 1, depthWrite: false })); stage.position.y = 0.01; g.add(stage);
  const rim = new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.01, 0.01)); rim.visible = false;
  seq.add(stage, 0.1, 1.0); seq.add(rim, 0.2, 0.7);
  const pool = lightPool(0x7cc8ff, 0.3, 0); pool.position.y = 0.022; g.add(pool);

  // --- the school (drawn in pencil) ---
  const school = new THREE.Group(); school.position.set(0, 0.026, 0.02); g.add(school);
  const parts = [];
  const add = (geo, color, x, y, z, d) => { const m = inked(geo, { color }); m.position.set(x, y, z); school.add(m); parts.push([m, d]); return m; };
  add(new RoundedBoxGeometry(0.34, 0.012, 0.19, 2, 0.004), 0xe9dcc0, 0, 0.006, 0.02, 0.4);
  add(new RoundedBoxGeometry(0.26, 0.012, 0.15, 2, 0.004), 0xefe4c9, 0, 0.018, 0.0, 0.5);
  add(new RoundedBoxGeometry(0.25, 0.09, 0.12, 3, 0.006), 0xf6efdc, 0, 0.069, -0.01, 0.6);
  const tri = new THREE.Shape(); tri.moveTo(-0.15, 0); tri.lineTo(0.15, 0); tri.lineTo(0, 0.065); tri.closePath();
  const ped = add(new THREE.ExtrudeGeometry(tri, { depth: 0.13, bevelEnabled: false }), 0xd8cdb2, 0, 0.114, -0.065, 0.9); 
  [-0.095, -0.032, 0.032, 0.095].forEach((x, i) => add(new THREE.CylinderGeometry(0.0095, 0.0105, 0.09, 14), 0xfffaf0, x, 0.069, 0.065, 0.75 + i * 0.05));
  const door = add(new RoundedBoxGeometry(0.035, 0.05, 0.006, 2, 0.002), 0x8a5a3a, 0, 0.049, 0.052, 1.0);
  const flagPole = new THREE.Mesh(new THREE.CylinderGeometry(0.0018, 0.0018, 0.07, 6), mat(0x2b2620)); flagPole.position.set(0, 0.2, -0.01); school.add(flagPole);
  const flag = new THREE.Mesh(new THREE.PlaneGeometry(0.04, 0.025), new THREE.MeshBasicMaterial({ color: OR, side: THREE.DoubleSide })); flag.position.set(0.02, 0.222, -0.01); school.add(flag);
  seq.add(flagPole, 1.4, 0.5); seq.add(flag, 1.6, 0.5);
  // little figures that stay when the building shrinks: the social heart
  const folk = [0, 1, 2].map((i) => { const f = new THREE.Group(); const a = i * TAU / 3 + 0.5; f.position.set(Math.cos(a) * 0.1, 0.026, 0.02 + Math.sin(a) * 0.09);
    const b = new THREE.Mesh(new THREE.CapsuleGeometry(0.011, 0.02, 4, 10), mat([0xef8f2a, 0x2a8fd0, 0x2fae8f][i])); b.position.y = 0.025; f.add(b); const h = new THREE.Mesh(new THREE.SphereGeometry(0.0105, 12, 8), mat(0xf1bd96)); h.position.y = 0.055; f.add(h);
    const gl = glow(0xffd27a, 0.08, 0.0); gl.position.y = 0.04; f.add(gl); f.userData.gl = gl; f.scale.setScalar(0.0001); f.visible = false; g.add(f); return f; });

  // --- stations: [traditional | digital] ---
  function station(key, x, z, buildA, buildB, hitY) {
    const grp = new THREE.Group(); grp.position.set(x, 0.026, z); grp.scale.setScalar(1.3); g.add(grp);
    const pad = inked(new THREE.CylinderGeometry(0.06, 0.063, 0.012, 36), { color: 0xf0e7d3 }); pad.position.y = 0.006; grp.add(pad);
    const A = new THREE.Group(); const B = new THREE.Group(); buildA(A); buildB(B); grp.add(A, B); A.position.y = 0.012; B.position.y = 0.012;
    const hit = new THREE.Mesh(new THREE.SphereGeometry(0.075, 12, 8), new THREE.MeshBasicMaterial({ visible: false })); hit.position.y = 0.06; grp.add(hit);
    const st = { key, grp, A, B, pad, p: 0, target: 0, hit, hint: hints.add(V(x, 0.1, z), 0xffd27a, 0.15) };
    seq.add(pad, 0.9, 0.8); seq.add(A, 1.4, 0.8, 0.04);
    return st;
  }
  const clock = station('clock', 0, -0.26, (A) => {
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.012, 40), mat(0xfaf6ea)); body.rotation.x = Math.PI / 2; body.position.y = 0.065; A.add(body);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.006, 10, 40), mat(0x6b4a34)); ring.position.y = 0.065; A.add(ring);
    const h1 = new THREE.Mesh(new THREE.BoxGeometry(0.003, 0.034, 0.003), mat(0x2b2620)); h1.position.set(0, 0.075, 0.008); A.add(h1);
    const h2 = new THREE.Mesh(new THREE.BoxGeometry(0.003, 0.024, 0.003), mat(0x2b2620)); h2.position.set(0.008, 0.063, 0.008); h2.rotation.z = -1.1; A.add(h2);
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.006, 0.05, 8), mat(0x6b4a34)); stem.position.y = 0.025; A.add(stem);
  }, (B) => {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.055, 0.005, 10, 60), new THREE.MeshBasicMaterial({ color: 0x7cc8ff, toneMapped: false })); ring.position.y = 0.07; B.add(ring);
    for (let i = 0; i < 24; i++) { const a = (i / 24) * TAU; const t = new THREE.Mesh(new THREE.BoxGeometry(0.003, i % 6 === 0 ? 0.014 : 0.008, 0.003), new THREE.MeshBasicMaterial({ color: i % 6 === 0 ? 0xffd27a : 0xbfe6ff, toneMapped: false })); t.position.set(Math.sin(a) * 0.04, 0.07 + Math.cos(a) * 0.04, 0); t.rotation.z = -a; B.add(t); }
    const c = glow(0x7cc8ff, 0.16, 0.45); c.position.y = 0.07; B.add(c); B.userData.spin = ring;
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.006, 0.05, 8), glossy(0x2b3a50)); stem.position.y = 0.025; B.add(stem);
  });
  const book = station('book', 0.25, 0.09, (A) => {
    [[0, 0xb5502f], [0.011, 0x2f5d8a], [0.022, 0x6b8a2f]].forEach(([y, c], i) => { const b = new THREE.Mesh(new RoundedBoxGeometry(0.085 - i * 0.006, 0.011, 0.062, 2, 0.003), mat(c)); b.position.y = 0.0055 + y; b.rotation.y = i * 0.35 - 0.3; A.add(shadowed(b)); const pg = new THREE.Mesh(new THREE.BoxGeometry(0.08 - i * 0.006, 0.006, 0.056), mat(0xf6efdc)); pg.position.copy(b.position); pg.rotation.y = b.rotation.y; pg.position.y += 0.0; A.add(pg); b.scale.y = 1; });
  }, (B) => {
    const base = new THREE.Mesh(new RoundedBoxGeometry(0.1, 0.008, 0.07, 3, 0.003), glossy(0x2b2e36)); base.position.y = 0.004; B.add(base);
    const lid = new THREE.Group(); lid.position.set(0, 0.008, -0.034); lid.rotation.x = -0.35; B.add(lid);
    const l = new THREE.Mesh(new RoundedBoxGeometry(0.1, 0.07, 0.005, 3, 0.002), glossy(0x2b2e36)); l.position.y = 0.035; lid.add(l);
    const s = new THREE.Mesh(new THREE.PlaneGeometry(0.09, 0.06), new THREE.MeshBasicMaterial({ color: 0x4cc3ee, toneMapped: false })); s.position.set(0, 0.035, 0.0028); lid.add(s);
    const c = glow(0x7cc8ff, 0.16, 0.5); c.position.set(0, 0.04, 0.02); B.add(c);
  });
  const teacher = station('teacher', -0.25, 0.09, (A) => {
    const board = new THREE.Mesh(new RoundedBoxGeometry(0.1, 0.065, 0.006, 2, 0.002), mat(0x2f6a4a)); board.position.set(0.0, 0.07, -0.01); A.add(board);
    const fr = new THREE.Mesh(new RoundedBoxGeometry(0.108, 0.073, 0.004, 2, 0.002), mat(0x8b5a2b)); fr.position.set(0, 0.07, -0.014); A.add(fr);
    [-0.04, 0.04].forEach((x) => { const l = new THREE.Mesh(new THREE.CylinderGeometry(0.002, 0.002, 0.06, 6), mat(0x8b5a2b)); l.position.set(x, 0.03, -0.012); A.add(l); });
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.011, 0.025, 4, 10), mat(0xf4bfd0)); body.position.set(0.04, 0.034, 0.03); A.add(body);
    const hd = new THREE.Mesh(new THREE.SphereGeometry(0.0105, 12, 8), mat(0xf1bd96)); hd.position.set(0.04, 0.066, 0.03); A.add(hd);
  }, (B) => {
    const scr = new THREE.Mesh(new RoundedBoxGeometry(0.1, 0.075, 0.006, 3, 0.003), glossy(0x1d2a3c)); scr.position.set(0, 0.075, 0); B.add(scr);
    const face = new THREE.Mesh(new THREE.PlaneGeometry(0.092, 0.069), new THREE.MeshBasicMaterial({ map: figureTex(), toneMapped: false })); face.position.set(0, 0.075, 0.0035); B.add(face);
    const st = new THREE.Mesh(new THREE.CylinderGeometry(0.003, 0.005, 0.04, 8), glossy(0x2b3a50)); st.position.y = 0.02; B.add(st);
    const c = glow(0x7cc8ff, 0.18, 0.4); c.position.set(0, 0.075, 0.02); B.add(c);
  });
  const stations = [clock, book, teacher];
  const schoolHit = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.2, 0.2), new THREE.MeshBasicMaterial({ visible: false })); schoolHit.position.set(0, 0.1, 0.02); school.add(schoolHit);
  const schoolHint = hints.add(V(0, 0.2, 0.02), 0xffd27a, 0.16);
  let sTarget = 0, sP = 0;

  function note(key, on, pos) { const t = TXT[key][on ? 'b' : 'a']; ctx.sfx.pop?.(); ctx.ui.card({ tag: on ? 'مجتمع بلا مدرسة' : 'المدرسة التقليدية', title: t.t, body: t.b, color: on ? BL : OR }); tag.show(t.tag, pos, on ? BL : OR); }
  function check(key) { done.add(key); if (done.size === 4 && !finished) { finished = true; setTimeout(() => { ctx.fx.burst(wpos(g, V(0, 0.2, 0)), 0x7cc8ff, 50, 0.5, 0.04); ctx.ui.done(); ctx.ui.hud('المدرسة صارت أوسع من جدرانها'); }, 900); } }
  stations.forEach((s) => ctx.tap(s.hit, () => { s.target = s.target ? 0 : 1; s.hint.on = false; note(s.key, !!s.target, V(s.grp.position.x, 0.19, s.grp.position.z)); if (s.target) { ctx.fx.burst(wpos(g, s.grp.position.clone().setY(0.1)), 0x7cc8ff, 18, 0.25, 0.03); check(s.key); } }));
  ctx.tap(schoolHit, () => { sTarget = sTarget ? 0 : 1; schoolHint.on = false; note('school', !!sTarget, V(0, 0.27, 0.02)); if (sTarget) { ctx.fx.burst(wpos(g, V(0, 0.12, 0)), 0xffd27a, 24, 0.3, 0.03); check('school'); } });
  parts.forEach(([m, d]) => seq.add(m, d, 0.9));
  ctx.ui.hud('المس الأشياء لتتحول');
  let auto = false;

  return {
    update(t, dt, e) {
      now = t; seq.update(t, e); hints.update(t, e); tag.update(dt, e);
      if (!auto && t > 2.2) { auto = true; book.target = 1; } // the first prop turns by itself
      stations.forEach((s) => {
        s.p = THREE.MathUtils.damp(s.p, s.target, 4, dt);
        const a = 1 - s.p, b = s.p;
        s.A.visible = a > 0.02 && s.A.scale.x > 0.01; s.B.visible = b > 0.02;
        if (t > 1.6) { s.A.scale.setScalar(Math.max(a, 0.001)); }
        s.B.scale.setScalar(Math.max(b, 0.001) * (1 + 0.1 * Math.sin(b * Math.PI))); s.B.position.y = 0.012 + 0.015 * Math.sin(t * 1.5 + s.grp.position.x * 9) * b; s.A.position.y = 0.012 + 0.04 * s.p;
        if (s.B.userData.spin) s.B.userData.spin.rotation.z = t * 0.5;
      });
      sP = THREE.MathUtils.damp(sP, sTarget, 3.5, dt);
      const sc = 1.25 * (1 - 0.5 * sP); school.scale.setScalar(Math.max(0.0001, Math.min(1, (stag(t, 0.5, 1.2, clamp01) * e > 0.99 ? 1 : 1) ) * sc));
      school.position.y = 0.026;
      folk.forEach((f, i) => { const k = ease((sP - 0.4) / 0.6); f.visible = k > 0.01; f.scale.setScalar(Math.max(k, 0.0001)); f.userData.gl.material.opacity = 0.5 * k * (0.8 + 0.2 * Math.sin(t * 3 + i)); });
      flag.rotation.y = Math.sin(t * 3) * 0.3;
      pool.material.opacity = 0.5 * Math.max(book.p, clock.p, teacher.p, sP) * e;
    },
  };
}
