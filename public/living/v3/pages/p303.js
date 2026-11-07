import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { P, ease, easeBack, clamp01, stag, mat, glossy, goldMat, shadowed, glow, lightTube } from '../../kit.js?v=17';
import { Rig, badge, V, TAU } from '../lib/b5-kit.js?v=17';
import { lightPool } from '../../v2/common.js?v=17';

export const meta = { free: true, center: [0.5, 0.33], typeLabel: 'مواقف تطبيقية' };

const LM = [
  { c: 0xef8f2a, ic: 'briefcase', t: 'طلاب عاملون', n: 'إتاحة الفرصة للطلاب العاملين لإتمام تعليمهم دون الحاجة لترك أعمالهم.' },
  { c: 0x2a8fd0, ic: 'wifi', t: 'من أي مكان', n: 'يكفي حضور قاعة الجامعة الافتراضية من أي جهاز حاسوب متصل بالإنترنت.' },
  { c: 0x2fa38a, ic: 'bolt', t: 'تحديث فوري', n: 'السرعة والمرونة في تطوير المنهج والحصول الفوري على أحدث التعديلات.' },
  { c: 0xd9a21f, ic: 'coin', t: 'كلفة أقل', n: 'انخفاض الكلفة التعليمية مقارنة بالنمط التقليدي للتعلم.' },
  { c: 0x6a5bd6, ic: 'globe', t: 'شهادات عالمية', n: 'عالمية الشهادات وإلغاء الحواجز بين الدول.' },
];
const Q = [
  { ic: 'briefcase', hud: 'موظف يريد الدراسة دون ترك عمله', a: 0, col: 0xef8f2a },
  { ic: 'plane', hud: 'طالبة انتقلت إلى بلد آخر', a: 1, col: 0x2a8fd0 },
  { ic: 'bolt', hud: 'تعديل المقرر وصل الطلبة فوراً', a: 2, col: 0x2fa38a },
];
const LP = LM.map((_, i) => V(-0.28 + 0.14 * i, 0, i % 2 ? -0.2 : -0.1));
const START = V(0, 0, 0.2);

let winTex;
function windows() {
  if (winTex) return winTex;
  const c = document.createElement('canvas'); c.width = 64; c.height = 128; const g = c.getContext('2d');
  g.fillStyle = '#f3f8fb'; g.fillRect(0, 0, 64, 128);
  for (let y = 6; y < 128; y += 16) for (let x = 6; x < 64; x += 16) { g.fillStyle = (x * y) % 3 ? '#9ec9de' : '#ffe9a8'; g.fillRect(x, y, 9, 9); }
  winTex = new THREE.CanvasTexture(c); winTex.colorSpace = THREE.SRGBColorSpace; return winTex;
}

function landmark(i, c) {
  const t = new THREE.Group(); const m = glossy(c, { roughness: 0.28 });
  const base = new THREE.Mesh(new RoundedBoxGeometry(0.1, 0.012, 0.1, 2, 0.005), glossy(0xfaf4e6)); base.position.y = 0.006; t.add(base);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.0035, 8, 40), new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: 0.6 })); ring.rotation.x = Math.PI / 2; ring.position.y = 0.012; t.add(ring);
  t.userData.ring = ring; let top;
  if (i === 0) { const b = new THREE.Mesh(new RoundedBoxGeometry(0.055, 0.17, 0.055, 3, 0.008), new THREE.MeshStandardMaterial({ map: windows(), color: 0xffffff, roughness: 0.3 })); b.position.y = 0.1; t.add(shadowed(b)); const cap = new THREE.Mesh(new RoundedBoxGeometry(0.062, 0.016, 0.062, 2, 0.006), m); cap.position.y = 0.195; t.add(cap); top = 0.2; }
  else if (i === 1) { const d = new THREE.Mesh(new THREE.SphereGeometry(0.052, 32, 16, 0, TAU, 0, Math.PI / 2), glossy(c, { transparent: true, opacity: 0.75 })); d.position.y = 0.012; t.add(d); for (let k = 0; k < 3; k++) { const r = new THREE.Mesh(new THREE.TorusGeometry(0.052, 0.0025, 6, 36, Math.PI), goldMat()); r.position.y = 0.012; r.rotation.y = k * Math.PI / 3; t.add(r); } t.userData.spin = null; top = 0.07; }
  else if (i === 2) { const b = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.032, 0.15, 24), m); b.position.y = 0.09; t.add(shadowed(b)); const s = new THREE.Mesh(new THREE.ConeGeometry(0.02, 0.07, 24), goldMat()); s.position.y = 0.2; t.add(s); const ant = new THREE.Mesh(new THREE.CylinderGeometry(0.0018, 0.0018, 0.05, 6), goldMat()); ant.position.y = 0.26; t.add(ant); const gl = glow(0xfff0b0, 0.07, 0.9); gl.position.y = 0.29; t.add(gl); t.userData.beacon = gl; top = 0.3; }
  else if (i === 3) { const b = new THREE.Mesh(new RoundedBoxGeometry(0.09, 0.05, 0.06, 3, 0.007), glossy(0xfff4d6)); b.position.y = 0.04; t.add(shadowed(b)); for (let k = -1; k <= 1; k++) { const col = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.005, 0.05, 10), goldMat()); col.position.set(k * 0.03, 0.04, 0.032); t.add(col); } const roof = new THREE.Mesh(new THREE.CylinderGeometry(0.052, 0.052, 0.012, 3), m); roof.rotation.set(0, Math.PI / 2, Math.PI / 2); roof.scale.set(1, 0.9, 0.7); roof.position.set(0, 0.075, 0); roof.rotation.set(Math.PI / 2, 0, 0); roof.rotation.z = Math.PI; roof.scale.set(1.0, 1, 0.5); t.add(roof); const coin = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.008, 28), goldMat()); coin.rotation.x = Math.PI / 2; coin.position.y = 0.13; t.add(coin); t.userData.spin = coin; top = 0.17; }
  else { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.022, 0.05, 16), m); p.position.y = 0.04; t.add(p); const gb = new THREE.Mesh(new THREE.SphereGeometry(0.045, 32, 20), glossy(c, { roughness: 0.15 })); gb.position.y = 0.12; t.add(shadowed(gb)); const r1 = new THREE.Mesh(new THREE.TorusGeometry(0.058, 0.003, 8, 48), goldMat()); r1.position.y = 0.12; r1.rotation.set(1.1, 0.4, 0); t.add(r1); t.userData.spin = r1; top = 0.2; }
  t.userData.top = top; return t;
}

export default function build(ctx) {
  const g = new THREE.Group(); g.position.copy(P(meta.center[0], meta.center[1])); g.position.z += 0.02; g.scale.setScalar(1.12); ctx.stage.add(g);
  const rig = new Rig(ctx);
  const pool = lightPool(0x2f8f9a, 0.5, 0); pool.position.y = 0.002; pool.scale.set(1.3, 1.3, 0.95); g.add(pool); rig.fn((p) => { pool.material.opacity = 0.32 * p; }, 0.1, 1);

  // tablet
  const tab = new THREE.Group(); g.add(tab);
  const body = new THREE.Mesh(new RoundedBoxGeometry(0.8, 0.03, 0.58, 5, 0.02), glossy(0x2b2f3a)); body.position.y = 0.015; tab.add(shadowed(body));
  const cv = document.createElement('canvas'); cv.width = 512; cv.height = 384; const cg = cv.getContext('2d');
  const gr = cg.createLinearGradient(0, 0, 0, 384); gr.addColorStop(0, '#bfe9e4'); gr.addColorStop(1, '#8fd2cf'); cg.fillStyle = gr; cg.fillRect(0, 0, 512, 384);
  cg.strokeStyle = 'rgba(255,255,255,.55)'; cg.lineWidth = 2; for (let i = 0; i < 17; i++) { cg.beginPath(); cg.moveTo(i * 32, 0); cg.lineTo(i * 32, 384); cg.stroke(); } for (let j = 0; j < 13; j++) { cg.beginPath(); cg.moveTo(0, j * 32); cg.lineTo(512, j * 32); cg.stroke(); }
  cg.fillStyle = '#7cc28a'; cg.beginPath(); cg.ellipse(110, 290, 90, 55, 0, 0, TAU); cg.fill(); cg.beginPath(); cg.ellipse(420, 90, 70, 40, 0, 0, TAU); cg.fill();
  cg.strokeStyle = '#fff'; cg.lineWidth = 14; cg.lineCap = 'round'; cg.beginPath(); cg.moveTo(256, 384); cg.lineTo(256, 190); cg.lineTo(40, 190); cg.moveTo(256, 190); cg.lineTo(472, 190); cg.stroke();
  const tx = new THREE.CanvasTexture(cv); tx.colorSpace = THREE.SRGBColorSpace;
  const scr = new THREE.Mesh(new THREE.PlaneGeometry(0.74, 0.52), new THREE.MeshBasicMaterial({ map: tx, toneMapped: false })); scr.rotation.x = -Math.PI / 2; scr.position.y = 0.0305; tab.add(scr);
  rig.add(tab, 0.1, 0.9, 'pop');

  // filler city (instanced)
  const N = 46; const cityM = new THREE.InstancedMesh(new RoundedBoxGeometry(1, 1, 1, 2, 0.1), new THREE.MeshStandardMaterial({ roughness: 0.55 }), N); const dm = new THREE.Object3D(); const cols = [0xf6b36b, 0xe86f5c, 0xfbe7b5, 0x8fb8e8, 0xf2d06b, 0xb7a0e0]; let n = 0;
  const heights = [];
  for (let k = 0; k < 400 && n < N; k++) {
    const x = (Math.random() - 0.5) * 0.66, z = (Math.random() - 0.5) * 0.46;
    if (Math.abs(x) < 0.05 && z > -0.04) continue; if (z > 0.12 && Math.abs(x) < 0.14) continue;
    let ok = true; LP.forEach((l) => { if (Math.hypot(x - l.x, z - l.z) < 0.1) ok = false; }); if (Math.hypot(x, z - 0.04) < 0.1) ok = false; if (Math.abs(z + 0.0) < 0.012 || Math.abs(x) < 0.012) ok = false;
    if (!ok) continue;
    const h = 0.012 + Math.random() * 0.03, w = 0.025 + Math.random() * 0.02;
    dm.position.set(x, 0.031 + h / 2, z); dm.scale.set(w, h, w * (0.8 + Math.random() * 0.4)); dm.updateMatrix(); cityM.setMatrixAt(n, dm.matrix); cityM.setColorAt(n, new THREE.Color(cols[n % 6])); heights.push(h); n++;
  }
  cityM.count = n; cityM.castShadow = true; tab.add(cityM);
  rig.fn((p) => { cityM.scale.set(1, Math.max(ease(p), 0.001), 1); cityM.position.y = 0.031 * (1 - ease(p)); }, 0.7, 1.4);

  // hub: glass dome (the virtual university)
  const hub = new THREE.Group(); hub.position.set(0, 0.031, 0.04); g.add(hub);
  const hb = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.08, 0.014, 40), glossy(0xfaf4e6)); hb.position.y = 0.007; hub.add(shadowed(hb));
  const dome = new THREE.Mesh(new THREE.SphereGeometry(0.062, 36, 18, 0, TAU, 0, Math.PI / 2), new THREE.MeshPhysicalMaterial({ color: 0xd5f2f7, transparent: true, opacity: 0.45, roughness: 0.05, side: THREE.DoubleSide, depthWrite: false })); dome.position.y = 0.014; hub.add(dome);
  for (let k = 0; k < 4; k++) { const r = new THREE.Mesh(new THREE.TorusGeometry(0.062, 0.0025, 6, 36, Math.PI), goldMat()); r.position.y = 0.014; r.rotation.y = k * Math.PI / 4; hub.add(r); }
  const hcore = glow(0xffd27a, 0.13, 0.7); hcore.position.y = 0.04; hub.add(hcore);
  const cap = badge('cap', 0xd4ad55, 0.05); cap.position.y = 0.045; hub.add(cap);

  // landmarks + light roads
  const lms = LM.map((l, i) => {
    const grp = landmark(i, l.c); grp.position.copy(LP[i]); grp.position.y = 0.031; g.add(grp);
    const bd = badge(l.ic, l.c, 0.06); bd.position.y = grp.userData.top + 0.05; grp.add(bd);
    const sd = LP[i].x < 0 ? -1 : 1, b = V(LP[i].x, 0.034, LP[i].z + 0.07);
    const curve = new THREE.CatmullRomCurve3([V(0, 0.034, 0.2), V(sd * 0.13, 0.034, 0.15), V(sd * 0.13 + (b.x - sd * 0.13) * 0.4, 0.034, -0.02), b]);
    const tube = lightTube(curve, { radius: 0.0035, color: l.c, speed: 0.6 }); g.add(tube);
    return { grp, l, i, tube, curve, flash: -9, bad: -9, bd };
  });

  // student
  const stu = new THREE.Group(); g.add(stu); stu.visible = false;
  const sbody = new THREE.Mesh(new THREE.CapsuleGeometry(0.014, 0.028, 6, 14), glossy(0xfff0d8)); sbody.position.y = 0.032; stu.add(shadowed(sbody));
  const shead = new THREE.Mesh(new THREE.SphereGeometry(0.0145, 18, 12), glossy(0xe9c9a0)); shead.position.y = 0.07; stu.add(shead);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.03, 0.003, 8, 32), new THREE.MeshStandardMaterial({ color: 0xffd27a, emissive: 0xffd27a, emissiveIntensity: 0.9 })); ring.rotation.x = Math.PI / 2; ring.position.y = 0.002; stu.add(ring);
  let who = badge('briefcase', 0xd4ad55, 0.07); who.position.y = 0.13; stu.add(who);
  const sglow = glow(0xffd27a, 0.14, 0.5); sglow.position.y = 0.03; stu.add(sglow);

  let qi = -1, st = 'idle', t0 = 0, now = 0, solved = 0, finished = false, tgt = null;
  const hy = 0.031;
  function ask() {
    qi++; if (qi >= Q.length) return; const q = Q[qi]; st = 'drop'; t0 = now; stu.visible = true;
    stu.remove(who); who = badge(q.ic, q.col, 0.07); who.position.y = 0.13; stu.add(who);
    sglow.material.color.setHex(q.col); ring.material.color.setHex(q.col); ring.material.emissive.setHex(q.col);
    ctx.ui.hideCard(); ctx.ui.hud(q.hud); ctx.sfx.whoosh?.();
  }
  lms.forEach((o) => {
    rig.touch(o.grp, () => {
      if (st !== 'wait') { ctx.sfx.pop?.(); ctx.ui.card({ tag: 'ميزة', title: o.l.t, body: o.l.n, color: o.l.c }); return; }
      if (o.i === Q[qi].a) { st = 'go'; t0 = now; tgt = o; ctx.sfx.good?.(); o.flash = now; ctx.fx.burst(g.localToWorld(LP[o.i].clone().add(V(0, 0.15, 0))), o.l.c, 28, 0.4, 0.03); ctx.ui.card({ tag: 'الميزة المناسبة', title: o.l.t, body: o.l.n, color: o.l.c }); solved++; setTimeout(() => ctx.ui.hideCard(), 3400); }
      else { o.bad = now; ctx.sfx.bad?.(); ctx.ui.hud('ليست هذه الميزة، جرّب غيرها'); }
    }, { color: o.l.c, size: 0.2, at: V(0, 0.08, 0), show: 3.2 });
  });
  rig.touch(hub, (h) => { ctx.sfx.pop?.(); h.on = false; ctx.ui.card({ tag: 'الجامعة الافتراضية', title: 'جامعة بلا جدران', body: 'كيان إلكتروني يلتقي فيه الطلاب والمعلمون في بيئة فضائية بواسطة الحاسب وشبكة الاتصالات العالمية.', color: 0xd4ad55 }); }, { color: 0xffd27a, size: 0.2, at: V(0, 0.07, 0), show: 3.2 });

  return {
    update(t, dt, e) {
      now = t; rig.update(t, dt, e);
      const hk = stag(t, 0.9, 0.9, easeBack) * e; hub.scale.setScalar(Math.max(hk, 0.001)); hcore.material.opacity = 0.5 * hk * (0.8 + 0.2 * Math.sin(t * 2)); cap.scale.setScalar(0.05 + Math.sin(t * 2) * 0.002);
      lms.forEach((o, i) => {
        const p = stag(t, 1.1 + i * 0.3, 0.9, easeBack) * e; o.grp.scale.setScalar(Math.max(p, 0.001) * 1.3); o.grp.visible = p > 0.01;
        const fl = clamp01(1 - (now - o.flash) / 1.2), bd = clamp01(1 - (now - o.bad) / 0.5);
        o.grp.position.x = LP[i].x + Math.sin(now * 60) * 0.004 * bd; o.grp.userData.ring.material.emissiveIntensity = 0.6 + fl * 1.6 + bd * 0;
        o.grp.userData.ring.scale.setScalar(1 + fl * 0.25);
        const sp = o.grp.userData.spin; if (sp) sp.rotation.y += dt * 1.2; if (o.grp.userData.beacon) o.grp.userData.beacon.material.opacity = 0.6 + 0.4 * Math.sin(t * 4 + i);
        o.bd.position.y = o.grp.userData.top + 0.05 + Math.sin(t * 2 + i) * 0.006; o.bd.scale.setScalar(0.06 * (1 + fl * 0.3));
        o.tube.userData.fill(stag(t, 2.0 + i * 0.25, 0.9, clamp01) * e); o.tube.userData.update(dt * (1 + 4 * fl));
      });
      if (st === 'idle' && t > 3.6) ask();
      if (st === 'drop') { const k = clamp01((now - t0) / 0.8); stu.position.set(START.x, hy + (1 - easeBack(k)) * 0.18, START.z); stu.scale.setScalar(Math.max(k, 0.01) * 1.8); if (k >= 1) st = 'wait'; }
      else if (st === 'wait') { stu.position.set(START.x, hy + Math.abs(Math.sin(t * 3)) * 0.01, START.z); }
      else if (st === 'go') {
        const k = clamp01((now - t0) / 1.6); const p = tgt.curve.getPoint(ease(k)); stu.position.set(p.x, hy + Math.abs(Math.sin(k * 14)) * 0.02, p.z);
        if (k >= 1) { stu.visible = false; st = 'between'; t0 = now; if (solved >= Q.length && !finished) { finished = true; setTimeout(() => { ctx.ui.card({ tag: 'جامعة بلا جدران', title: 'كيان إلكتروني', body: 'كيان إلكتروني يلتقي فيه الطلاب والمعلمون في بيئة فضائية بواسطة الحاسب وشبكة الاتصالات العالمية.', color: 0xd4ad55 }); ctx.ui.done(); }, 2800); } }
      } else if (st === 'between' && now - t0 > 2.8 && qi < Q.length - 1) ask();
      who.scale.setScalar(0.07 + Math.sin(t * 3) * 0.003);
    },
  };
}
