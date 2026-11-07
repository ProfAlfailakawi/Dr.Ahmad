import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { P, ease, easeBack, clamp01, stag, mat, glossy, goldMat, shadowed, glow } from '../../kit.js?v=16';
import { inked } from '../../pencil.js?v=16';
import { Rig, badge, V, TAU } from '../lib/a5-kit.js?v=16';
import { lightPool } from '../../v2/common.js?v=16';

export const meta = { free: true, center: [0.3, 0.68], typeLabel: 'مجسّم يُطبع' };

const N = 30, LAYER = 0.0094, HEAD_H = N * LAYER;
const BADGES = [
  { k: 'gear', c: 0xef8f2a, t: 'مجالات التطبيق', n: 'تبرز في العلوم والتكنولوجيا والهندسة والرياضيات، وفي التعليم الطبي وتدريب موظفي الشركات والبحوث.' },
  { k: 'eye', c: 0x2fa38a, t: 'ما يتعذّر في الواقع', n: 'تعقيدات التشريح البشري ومكوّنات المحرّكات تُستكشف بطرق غالباً لا يمكن القيام بها في العالم الحقيقي.' },
  { k: 'cube', c: 0x5a6fd6, t: 'أساس العالم الافتراضي', n: 'تُعدّ ثلاثية الأبعاد أساس العالم الافتراضي الذي يخدم العملية التعليمية التعلمية.' },
  { k: 'layers', c: 0xe0452c, t: 'المختبر ثلاثي الأبعاد', n: 'مختبر zSpace STEM يتيح للطلاب التصوّر والتجربة والبناء بطرق غير ممكنة في بيئة الحوسبة التقليدية.' },
];

// one horizontal slice of a stylised head; t = 0 chin .. 1 crown
function slicePts(t) {
  const out = []; const pts = 44;
  const prof = Math.sqrt(Math.max(0, 1 - Math.pow((t - 0.52) / 0.58, 2)));
  const jaw = t < 0.3 ? 0.66 + 0.34 * (t / 0.3) : 1;
  const a = 0.092 * prof * jaw + 0.004, df = 0.098 * prof * (0.75 + 0.25 * jaw) + 0.004, db = 0.108 * prof + 0.004;
  for (let i = 0; i < pts; i++) {
    const ph = (i / pts) * TAU, sn = Math.sin(ph), cs = Math.cos(ph);
    let z = sn >= 0 ? sn * df : sn * db; let x = cs * a;
    const gauss = (c, w) => Math.exp(-Math.pow((ph - Math.PI / 2) / w, 2)) * Math.exp(-Math.pow((t - c) / 0.07, 2));
    z += 0.034 * gauss(0.43, 0.28) + 0.013 * gauss(0.62, 0.7) + 0.012 * gauss(0.27, 0.45);
    out.push([x, z]);
  }
  return out;
}
function sliceShape(t) { const s = new THREE.Shape(); slicePts(t).forEach(([x, z], i) => (i ? s.lineTo(x, -z) : s.moveTo(x, -z))); s.closePath(); return s; }
function loftHead() {
  const pos = [], idx = []; const M = 44;
  for (let i = 0; i < N; i++) slicePts(i / (N - 1)).forEach(([x, z]) => pos.push(x, i * LAYER + LAYER * 0.5, z));
  for (let i = 0; i < N - 1; i++) for (let k = 0; k < M; k++) { const a = i * M + k, b = i * M + (k + 1) % M, c = (i + 1) * M + k, d = (i + 1) * M + (k + 1) % M; idx.push(a, c, b, b, c, d); }
  const bc = pos.length / 3; pos.push(0, 0, 0.0); const tc = bc + 1; pos.push(0, (N - 1) * LAYER + LAYER * 0.5, 0);
  for (let k = 0; k < M; k++) { idx.push(bc, k, (k + 1) % M); idx.push(tc, (N - 1) * M + (k + 1) % M, (N - 1) * M + k); }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setIndex(idx); geo.computeVertexNormals(); return geo;
}

export default function build(ctx) {
  const g = new THREE.Group(); g.position.copy(P(meta.center[0], meta.center[1])); g.scale.setScalar(1.08); g.position.x += 0.04; ctx.stage.add(g);
  const rig = new Rig(ctx);

  const pool = lightPool(0x3b2b1a, 0.3, 0); pool.position.y = 0.003; g.add(pool); rig.fn((p) => { pool.material.opacity = 0.3 * p; }, 0.1, 1);
  const bed = new THREE.Mesh(new RoundedBoxGeometry(0.4, 0.03, 0.36, 3, 0.012), glossy(0x39414c, { roughness: 0.35 })); bed.position.y = 0.015; g.add(shadowed(bed));
  const bedRim = new THREE.Mesh(new RoundedBoxGeometry(0.42, 0.008, 0.38, 2, 0.003), goldMat()); bedRim.position.y = 0.018; g.add(bedRim);
  const bedTop = 0.034;

  // frame
  const posts = [-1, 1].map((s) => { const p = inked(new THREE.CylinderGeometry(0.009, 0.011, 0.47, 14), { color: 0xe6edf3 }); p.position.set(s * 0.17, 0.25, -0.13); g.add(p); rig.ink(p, 0.4 + (s > 0 ? 0.2 : 0), 1.1); return p; });
  const topBar = inked(new RoundedBoxGeometry(0.37, 0.022, 0.03, 2, 0.008), { color: 0xe6edf3 }); topBar.position.set(0, 0.5, -0.13); g.add(topBar); rig.ink(topBar, 1.0, 0.9);
  const gantry = new THREE.Group(); g.add(gantry);
  const cross = new THREE.Mesh(new RoundedBoxGeometry(0.34, 0.016, 0.024, 2, 0.006), glossy(0xf2f4f7)); gantry.add(shadowed(cross));
  const carriage = new THREE.Group(); gantry.add(carriage);
  const cbox = new THREE.Mesh(new RoundedBoxGeometry(0.05, 0.03, 0.04, 2, 0.007), glossy(0x3b4a5a)); carriage.add(shadowed(cbox));
  const arm = new THREE.Mesh(new RoundedBoxGeometry(0.03, 0.016, 0.15, 2, 0.006), glossy(0xf2f4f7)); arm.position.z = 0.09; carriage.add(shadowed(arm));
  const nz = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.004, 0.034, 16), glossy(0xf6f6f6)); nz.position.set(0, -0.024, 0.145); carriage.add(shadowed(nz));
  const tip = glow(0xff7a2a, 0.07, 0.9); tip.position.set(0, -0.045, 0.145); carriage.add(tip);

  // the printed head: stacked slices
  const headMat = glossy(0xff5a1f, { roughness: 0.3, clearcoat: 1 });
  const head = new THREE.Group(); head.position.y = bedTop; g.add(head);
  const slices = [];
  for (let i = 0; i < N; i++) {
    const geo = new THREE.ExtrudeGeometry(sliceShape(i / (N - 1)), { depth: LAYER * 0.94, bevelEnabled: false, curveSegments: 1 });
    geo.rotateX(-Math.PI / 2);
    const m = new THREE.Mesh(geo, headMat); m.position.y = i * LAYER; m.castShadow = true; head.add(m); slices.push(m);
  }
  head.position.z = 0.0;
  const smooth = new THREE.Mesh(loftHead(), headMat); smooth.castShadow = true; smooth.visible = false; head.add(smooth);
  const nose = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 14), headMat); nose.scale.set(0.017, 0.026, 0.024); nose.position.set(0, HEAD_H * 0.43 - 0.004, 0.113); smooth.add(nose);
  [-1, 1].forEach((s) => { const ear = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 12), headMat); ear.scale.set(0.008, 0.026, 0.018); ear.position.set(s * 0.097, HEAD_H * 0.47, -0.008); smooth.add(ear); const brow = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 12), headMat); brow.scale.set(0.03, 0.007, 0.012); brow.position.set(s * 0.036, HEAD_H * 0.6, 0.098); smooth.add(brow); });
  const lightSlice = glow(0xffd27a, 0.3, 0);
  head.add(lightSlice);

  // orbiting medallions
  const orb = new THREE.Group(); orb.position.y = 0.2; g.add(orb);
  const bdg = BADGES.map((b, i) => {
    const h = new THREE.Group(); const sp = badge(b.k, b.c, 0.065); h.add(sp); orb.add(h); return { h, b, i, sp, seen: false };
  });

  let prog = 0, printing = true, exploded = 0, expT = 0, now = 0, found = new Set(), finished = false, startAt = 0.5, restart = 0;
  const mark = (id) => { found.add(id); ctx.ui.hud(`اكتشفتَ ${found.size} من ${BADGES.length + 2}`); if (found.size >= BADGES.length + 2 && !finished) { finished = true; setTimeout(() => ctx.ui.done(), 1200); } };
  rig.touch(head, (hh) => {
    if (prog < 0.95) return; expT = expT ? 0 : 1; ctx.sfx.whoosh?.(); hh.on = false;
    ctx.ui.card({ tag: 'مجسّم', title: 'رؤية من كل الجهات', body: 'الرأس المعروض شاهد على ما تتيحه ثلاثية الأبعاد: رؤية الشيء من جميع جهاته بدل الاكتفاء بصورة مسطّحة.', color: 0xff5a1f }); mark('head');
  }, { color: 0xff7a2a, size: 0.34, at: V(0, HEAD_H / 2, 0), show: 4.8 });
  rig.touch(carriage, () => {
    prog = 0; restart = now; expT = 0; ctx.sfx.whoosh?.();
    ctx.ui.card({ tag: 'الطابعة', title: 'من التصميم إلى الشيء', body: 'الأجسام ثلاثية الأبعاد تجعل المفهوم المجرّد شيئاً ملموساً في متناول المتعلم.', color: 0xef8f2a }); mark('print');
  }, { color: 0xffb36a, size: 0.14, show: 6.5 });
  bdg.forEach((o) => rig.touch(o.h, (hh) => {
    ctx.sfx.pop?.(); ctx.fx.burst(o.h.getWorldPosition(new THREE.Vector3()).sub(g.getWorldPosition(new THREE.Vector3())).divideScalar(1.15).add(V(0, 0, 0)), o.b.c, 18, 0.3, 0.03);
    ctx.ui.card({ tag: 'ثلاثية الأبعاد', title: o.b.t, body: o.b.n, color: o.b.c }); mark('b' + o.i); hh.on = false;
  }, { color: o.b.c, size: 0.17, show: 4.6 + o.i * 0.3 }));
  ctx.ui.hud('المس الرأس والطابعة والأيقونات');

  const pr = (t) => clamp01((t - startAt - restart * 0) / 5.5);
  return {
    update(t, dt, e) {
      now = t; rig.update(t, dt, e);
      if (t > startAt && prog < 1) prog = Math.min(1, prog + dt / 4.2);
      expT = expT; exploded += (expT - exploded) * Math.min(1, dt * 3);
      const ex = ease(exploded);
      const n = Math.floor(prog * N + 0.0001), shown = prog >= 1 ? N : n;
      slices.forEach((m, i) => {
        const vis = i < shown + (prog < 1 ? 1 : 0);
        const part = i === shown && prog < 1 ? (prog * N - n) : 1;
        m.visible = vis; m.scale.y = Math.max(part, 0.05);
        m.position.y = i * LAYER * (1 + ex * 2.6);
        m.rotation.y = ex * Math.sin(i * 0.9 + t * 0.9) * 0.25;
      });
      const done = prog >= 1; smooth.visible = done && ex < 0.02; slices.forEach((m) => { if (done && ex < 0.02) m.visible = false; });
      const topY = bedTop + (prog < 1 ? (shown + 1) * LAYER : HEAD_H * (1 + ex * 2.6));
      const gy = Math.max(topY + 0.07, bedTop + 0.1);
      gantry.position.set(0, gy + (prog >= 1 ? Math.sin(t) * 0.0 : 0) + (prog >= 1 ? 0.04 + (1 - ex) * 0.0 : 0), -0.13);
      gantry.position.y += prog >= 1 ? 0.03 : 0;
      carriage.position.x = prog < 1 && t > startAt ? Math.sin(t * 7) * 0.07 : THREE.MathUtils.damp(carriage.position.x, 0, 3, dt);
      tip.material.opacity = (prog < 1 && t > startAt ? 0.9 : 0.25) * e * (0.7 + 0.3 * Math.sin(t * 20));
      lightSlice.position.set(0, (prog < 1 ? shown : N * 0.5) * LAYER, 0.02); lightSlice.material.opacity = prog < 1 && t > startAt ? 0.5 * e : 0;
      head.rotation.y = prog >= 1 ? Math.sin(t * 0.5) * 0.35 * (1 - ex * 0.3) : 0;
      orb.rotation.y = t * 0.25; orb.rotation.z = 0.12; orb.rotation.x = 0.12;
      bdg.forEach((o) => {
        const a = (o.i / bdg.length) * TAU, k = stag(t, 2.0 + o.i * 0.3, 0.8, easeBack) * e;
        o.h.position.set(Math.cos(a) * 0.25, Math.sin(t * 1.2 + o.i * 1.7) * 0.01 + (o.i % 2) * 0.05, Math.sin(a) * 0.25);
        o.h.scale.setScalar(Math.max(k, 0.0001)); o.h.visible = k > 0.01;
      });
    },
  };
}
