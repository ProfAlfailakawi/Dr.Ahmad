import * as THREE from 'three';
import { mat, glossy, goldMat, shadowed, glow, ease, easeBack, clamp01 } from '../../kit.js?v=17';
import { scene, RoundedBox, TAU, contactShadow, lightPool, paint, smooth, GL, person2, textPlane } from '../lib/b8-kit.js?v=17';
export const meta = { free: true, center: [0.5, 0.6], typeLabel: 'مجسّم تفاعلي' };

const GOLD = 0xd4ad55, CY = 0x4cc9f0;
const INFO = [
  { t: 'مكان التعلم', b: 'مبنى بمواعيد محددة، أم مراكز تعمل على مدار ٢٤ ساعة في اليوم و٧ أيام في الأسبوع؟', c: 0xf08a1c },
  { t: 'وسيط التعلم', b: 'كتب تقليدية هي الأساس، أم حواسيب تحل محلها وتصبح العنصر الأساسي؟', c: 0x2b72c9 },
  { t: 'من يعلّم؟', b: 'يسمع الطلبة معلمهم داخل الصف، أم من خلال الحواسيب والأجهزة الذكية؟', c: 0x2e9e6e },
  { t: 'الحاجة للمدرسة', b: 'قائمة للتعلم كله، أم تبقى لتنمية المهارات الاجتماعية فقط؟', c: 0xe0527f },
];
const paperTex = () => paint(256, 400, (x, w, h) => { const gr = x.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#fbf1d8'); gr.addColorStop(1, '#ecd9aa'); x.fillStyle = gr; x.fillRect(0, 0, w, h); x.strokeStyle = 'rgba(160,120,50,.25)'; x.lineWidth = 3; for (let i = 0; i < 6; i++) { x.beginPath(); x.moveTo(0, 90 + i * 50); x.lineTo(w, 90 + i * 50); x.stroke(); } });
const navyTex = () => paint(256, 400, (x, w, h) => { const gr = x.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#2a4a8a'); gr.addColorStop(1, '#162449'); x.fillStyle = gr; x.fillRect(0, 0, w, h); x.fillStyle = 'rgba(120,210,255,.5)'; for (let i = 0; i < 60; i++) { x.beginPath(); x.arc((i * 97) % w, (i * 61) % h, 1.5 + (i % 3), 0, TAU); x.fill(); } });
const scrTex = () => paint(128, 96, (x, w, h) => { x.fillStyle = '#163a66'; x.fillRect(0, 0, w, h); x.fillStyle = '#7fd6ff'; x.beginPath(); x.arc(64, 38, 17, 0, TAU); x.fill(); x.beginPath(); x.ellipse(64, 94, 38, 30, 0, Math.PI, TAU); x.fill(); });
const clkTex = () => paint(128, 128, (x, w, h) => { x.fillStyle = '#12305a'; x.fillRect(0, 0, w, h); x.fillStyle = '#9fe4ff'; x.font = '800 54px Tajawal, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('٢٤/٧', w / 2, h / 2 + 4); });
const dark = () => glossy(0x25282f, { roughness: 0.3 });

// miniatures: built at the origin on a ledge, y up, facing +z
const MINI = [
  () => { // classical school
    const g = new THREE.Group(); const b = new THREE.Mesh(new RoundedBox(0.12, 0.01, 0.05, 0.003), glossy(0xf7f1e4)); b.position.y = 0.005; g.add(b);
    for (let i = 0; i < 4; i++) { const c = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.0055, 0.05, 14), glossy(0xf7f1e4)); c.position.set(-0.045 + i * 0.03, 0.035, 0.012); g.add(c); }
    const s = new THREE.Shape(); s.moveTo(-0.065, 0); s.lineTo(0.065, 0); s.lineTo(0, 0.026); s.closePath(); const p = new THREE.Mesh(new THREE.ExtrudeGeometry(s, { depth: 0.04, bevelEnabled: false }), goldMat()); p.position.set(0, 0.06, -0.008); g.add(p);
    const d = new THREE.Mesh(new RoundedBox(0.03, 0.036, 0.006, 0.002), mat(0xa9573b)); d.position.set(0, 0.028, -0.004); g.add(d); return g;
  },
  () => { // books
    const g = new THREE.Group(); [[0.1, 0.014, 0xa9573b, 0.1], [0.09, 0.013, 0x2b72c9, -0.14], [0.08, 0.012, 0xe8c9a0, 0.2], [0.07, 0.012, 0x7a4a32, -0.08]].reduce((y, [w, h, c, r]) => { const b = new THREE.Mesh(new RoundedBox(w, h, 0.062, 0.003), glossy(c)); b.position.y = y + h / 2; b.rotation.y = r; g.add(b); const pg = new THREE.Mesh(new THREE.BoxGeometry(w * 0.93, h * 0.6, 0.058), mat(0xf6efdf)); pg.position.y = y + h / 2; pg.rotation.y = r; pg.position.z = 0.002; g.add(pg); return y + h; }, 0); return g;
  },
  () => { // teacher at a board
    const g = new THREE.Group(); const bd = new THREE.Mesh(new RoundedBox(0.12, 0.075, 0.008, 0.003), glossy(0x2f5a46)); bd.position.set(0.01, 0.07, -0.01); g.add(bd);
    const fr = new THREE.Mesh(new RoundedBox(0.126, 0.081, 0.006, 0.003), mat(0x7a4a32)); fr.position.set(0.01, 0.07, -0.014); g.add(fr);
    for (let i = 0; i < 3; i++) { const l = new THREE.Mesh(new THREE.BoxGeometry(0.06 - i * 0.012, 0.003, 0.001), mat(0xf6efdf)); l.position.set(0.02, 0.085 - i * 0.015, -0.0055); g.add(l); }
    const p = person2({ body: 0x3d4f6b, s: 0.62 }); p.position.set(-0.045, 0, 0.012); g.add(p); g.userData.arm = p.userData.armR; return g;
  },
  () => { // bell
    const g = new THREE.Group(); const post = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.09, 10), goldMat()); post.position.set(0, 0.045, -0.006); g.add(post);
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.006, 0.006), goldMat()); arm.position.set(0.025, 0.09, -0.006); g.add(arm);
    const bell = new THREE.Group(); bell.position.set(0.05, 0.088, -0.006); g.add(bell);
    const bm = new THREE.Mesh(new THREE.LatheGeometry([[0.003, 0], [0.026, 0.0], [0.024, 0.006], [0.016, 0.022], [0.012, 0.036], [0.004, 0.044], [0.003, 0.0]].map(([x, y]) => new THREE.Vector2(x, y)), 28), goldMat()); bm.position.y = -0.044; bell.add(bm); g.userData.bell = bell; const cl = new THREE.Mesh(new THREE.SphereGeometry(0.006, 10, 8), mat(0x7a4a32)); cl.position.y = -0.046; bell.add(cl); return g;
  },
];
const MINI_NEW = [
  () => { // 24/7 ring
    const g = new THREE.Group(); const r = new THREE.Mesh(new THREE.TorusGeometry(0.048, 0.004, 10, 60), GL(CY, 1)); r.position.y = 0.062; g.add(r);
    const ticks = new THREE.InstancedMesh(new THREE.BoxGeometry(0.0035, 0.009, 0.004), new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xbfeaff, emissiveIntensity: 1 }), 24); const dm = new THREE.Object3D();
    for (let i = 0; i < 24; i++) { const a = (i / 24) * TAU; dm.position.set(Math.sin(a) * 0.04, 0.062 + Math.cos(a) * 0.04, 0); dm.rotation.z = -a; dm.updateMatrix(); ticks.setMatrixAt(i, dm.matrix); } g.add(ticks);
    const c = new THREE.Mesh(new THREE.CircleGeometry(0.03, 28), new THREE.MeshBasicMaterial({ map: clkTex(), toneMapped: false })); c.position.set(0, 0.062, 0.001); g.add(c);
    const hand = new THREE.Mesh(new THREE.BoxGeometry(0.004, 0.036, 0.004), GL(0xffd27a, 1.2)); hand.geometry.translate(0, 0.018, 0); hand.position.set(0, 0.062, 0.004); g.add(hand); g.userData.hand = hand;
    const st = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.006, 0.014, 10), goldMat()); st.position.y = 0.007; g.add(st); return g;
  },
  () => { // laptop
    const g = new THREE.Group(); const b = new THREE.Mesh(new RoundedBox(0.11, 0.006, 0.07, 0.004), glossy(0xc9ccd2)); b.position.y = 0.003; g.add(b);
    const lid = new THREE.Group(); lid.position.set(0, 0.006, -0.032); lid.rotation.x = -0.3; g.add(lid);
    const lb = new THREE.Mesh(new RoundedBox(0.11, 0.07, 0.005, 0.004), glossy(0xc9ccd2)); lb.position.y = 0.035; lid.add(lb);
    const sc = new THREE.Mesh(new THREE.PlaneGeometry(0.1, 0.06), new THREE.MeshBasicMaterial({ map: scrTex(), toneMapped: false })); sc.position.set(0, 0.035, 0.0028); lid.add(sc);
    const kb = new THREE.Mesh(new THREE.PlaneGeometry(0.09, 0.03), mat(0x3a3d44)); kb.rotation.x = -Math.PI / 2; kb.position.set(0, 0.0065, 0.006); g.add(kb); return g;
  },
  () => { // teacher on a monitor
    const g = new THREE.Group(); const m = new THREE.Mesh(new RoundedBox(0.11, 0.075, 0.01, 0.005), dark()); m.position.y = 0.062; g.add(m);
    const sc = new THREE.Mesh(new THREE.PlaneGeometry(0.1, 0.064), new THREE.MeshBasicMaterial({ map: scrTex(), toneMapped: false })); sc.position.set(0, 0.062, 0.0055); g.add(sc);
    const st = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.006, 0.026, 10), dark()); st.position.y = 0.013; g.add(st); const bs = new THREE.Mesh(new RoundedBox(0.05, 0.004, 0.03, 0.002), dark()); bs.position.y = 0.002; g.add(bs);
    const rings = [0.012, 0.022, 0.032].map((r, i) => { const a = new THREE.Mesh(new THREE.TorusGeometry(r, 0.0013, 6, 24, Math.PI * 0.9), GL(CY, 1.2)); a.position.set(0.062, 0.062, 0.003); a.rotation.z = -Math.PI * 0.45; g.add(a); return a; }); g.userData.rings = rings; return g;
  },
  () => { // three figures holding hands
    const g = new THREE.Group(); [[-0.034, 0xf08a1c], [0, 0x2b72c9], [0.034, 0x2e9e6e]].forEach(([x, c], i) => {
      const b = new THREE.Mesh(new THREE.CapsuleGeometry(0.011, 0.026, 4, 12), glossy(c)); b.position.set(x, 0.03, 0); g.add(b); const h = new THREE.Mesh(new THREE.SphereGeometry(0.0115, 16, 12), mat(0xe3b894)); h.position.set(x, 0.062, 0); g.add(h);
    });
    [-0.017, 0.017].forEach((x) => { const a = new THREE.Mesh(new THREE.TorusGeometry(0.0095, 0.0022, 6, 14, Math.PI), goldMat()); a.position.set(x, 0.038, 0.002); g.add(a); });
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.058, 0.0016, 8, 50), GL(CY, 0.9)); ring.rotation.x = Math.PI / 2; ring.position.y = 0.002; g.add(ring); g.userData.ring = ring; return g;
  },
];

export default function build(ctx) {
  const S = scene(ctx, meta), g = S.g;
  const base = new THREE.Mesh(new RoundedBox(0.9, 0.028, 0.24, 0.03), glossy(0x2f3f66, { roughness: 0.35, clearcoat: 0.8 })); base.position.y = 0.014; g.add(shadowed(base));
  const brim = new THREE.Mesh(new RoundedBox(0.906, 0.005, 0.246, 0.03), goldMat()); brim.position.y = 0.024; g.add(brim);
  const under = new THREE.Mesh(new RoundedBox(0.8, 0.012, 0.18, 0.03), mat(0x2b2724)); under.position.y = -0.005; g.add(under);
  S.part(base, 0.1, { rise: 0.06 }); S.part(brim, 0.2, { rise: 0.06 }); S.part(under, 0.15, { rise: 0.06 });
  const shd = contactShadow(0.96, 0.32, 0.3); g.add(shd);
  const pT = paperTex(), nT = navyTex();
  const slabs = [-0.285, -0.095, 0.095, 0.285].map((x, i) => {
    const holder = new THREE.Group(); holder.position.set(x, 0.028, 0); g.add(holder);
    const sl = new THREE.Group(); sl.position.y = 0.0; holder.add(sl);
    const pivot = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.06, 0.012, 32), goldMat()); pivot.position.y = 0.006; holder.add(pivot);
    const body = new THREE.Mesh(new RoundedBox(0.17, 0.27, 0.03, 0.012), glossy(0xe0b85e, { metalness: 0.7, roughness: 0.3 })); body.position.y = 0.147; sl.add(body);
    const pf = new THREE.Mesh(new THREE.PlaneGeometry(0.15, 0.25), new THREE.MeshBasicMaterial({ map: pT, toneMapped: false })); pf.position.set(0, 0.147, 0.0153); sl.add(pf);
    const pb = new THREE.Mesh(new THREE.PlaneGeometry(0.15, 0.25), new THREE.MeshBasicMaterial({ map: nT, toneMapped: false })); pb.position.set(0, 0.147, -0.0153); pb.rotation.y = Math.PI; sl.add(pb);
    const ledF = new THREE.Mesh(new RoundedBox(0.15, 0.01, 0.07, 0.004), glossy(0xf7efdc)); ledF.position.set(0, 0.05, 0.04); sl.add(ledF);
    const ledB = new THREE.Mesh(new RoundedBox(0.15, 0.01, 0.07, 0.004), glossy(0x1c2f58)); ledB.position.set(0, 0.05, -0.04); sl.add(ledB);
    const mo = MINI[i](), mn = MINI_NEW[i](); mo.position.set(0, 0.055, 0.045); mn.position.set(0, 0.055, -0.045); mo.scale.setScalar(1.22); mn.scale.setScalar(1.22); mn.rotation.y = Math.PI; sl.add(mo, mn);
    const tF = textPlane(['المدرسة', 'الكتب', 'المعلم', 'المدرسة'][i], 0.1, { color: '#6b4a1e', size: 62, width: 380 }); tF.position.set(0, 0.255, 0.0162); sl.add(tF);
    const tB = textPlane(['بلا مدرسة', 'الحواسيب', 'الشاشة', 'للمهارات'][i], 0.1, { color: '#bfeaff', size: 62, width: 380 }); tB.position.set(0, 0.255, -0.0162); tB.rotation.y = Math.PI; sl.add(tB);
    shadowed(sl); S.part(sl, 0.6 + i * 0.3, { rise: 0.1 }); S.part(pivot, 0.5 + i * 0.3, { rise: 0.05 });
    return { holder, sl, mo, mn, x, i, rot: 0, tg: 0, seen: false, spin: -9 };
  });
  let flipped = new Set(), finished = false, auto = false;
  const flip = (s, byUser) => {
    s.tg = s.tg === 0 ? Math.PI : 0; s.spin = S.now; ctx.sfx.whoosh?.();
    S.burst(new THREE.Vector3(s.x, 0.17, 0), s.tg ? CY : GOLD, 24, 0.45);
    if (!byUser) return;
    const I = INFO[s.i]; ctx.ui.card({ tag: s.tg ? 'بلا مدرسة' : 'المدرسة التقليدية', title: I.t, body: I.b, color: I.c });
    flipped.add(s.i);
    if (flipped.size === 4 && !finished) { finished = true; setTimeout(() => { ctx.ui.hud('تقدّم الأمم رهين بالاستثمار في الإنسان'); ctx.ui.card({ tag: 'الخلاصة', title: 'الاستثمار في الإنسان', body: 'تقدّم الأمم وتطورها رهين بالاستثمار في العنصر البشري. هل تُلغي المدرسة الافتراضية دور المعلم أم تعيد تعريفه؟', color: GOLD }); ctx.ui.done(); }, 1800); }
  };
  slabs.forEach((s) => S.touch(s.sl, () => flip(s, true), { color: 0xffe3a0, size: 0.2, at: new THREE.Vector3(0, 0.147, 0.02), wake: 5.4 }));
  ctx.ui.hud('المس اللوح ليتحوّل التعليم');

  S.loop((t, dt, e) => {
    if (!auto && t > 3.6) { auto = true; slabs.forEach((s, i) => setTimeout(() => { if (!s.tg) flip(s, false); }, i * 500)); setTimeout(() => slabs.forEach((s) => { if (!flipped.has(s.i) && s.tg) flip(s, false); }), 4200); }
    slabs.forEach((s) => {
      s.rot = THREE.MathUtils.damp(s.rot, s.tg, 3.4, dt); s.sl.rotation.y = s.rot; s.sl.position.y = Math.sin(clamp01(s.rot / Math.PI) * Math.PI) * 0.03;
      s.mo.visible = s.mo.parent && true;
      const u = s.mn.userData; if (u.hand) u.hand.rotation.z = -t * 1.2; if (u.rings) u.rings.forEach((r, k) => { r.material.emissiveIntensity = 0.4 + 1.1 * clamp01(Math.sin(t * 4 - k * 1.1)); }); if (u.ring) u.ring.rotation.z = t;
      const v = s.mo.userData; if (v.bell) v.bell.rotation.z = Math.sin(t * 2.4) * 0.28; if (v.arm) v.arm.rotation.x = -1.2 + Math.sin(t * 2) * 0.25;
    });
  });
  return { update: S.update };
}
