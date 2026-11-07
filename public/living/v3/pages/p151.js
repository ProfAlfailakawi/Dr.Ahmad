// p151 — a cramped classroom model: analyse first (loupe finds the hidden limits), then the room opens up, then the right tool fits.
import * as THREE from 'three';
import { P, ease, easeBack, clamp01, stag, glow } from '../../kit.js?v=18';
import { rb, lathe, std, lit, gloss, glass, brass, add, grp, hit, Seq, Pulse, touch, chip, plinth, blob, at, rnd, TAU, INK, GOLD } from '../lib/a2.js?v=18';

export const meta = { free: true, center: [0.5, 0.34], typeLabel: 'لعبة قرار' };

export default function build(ctx) {
  const g = new THREE.Group(); g.position.copy(P(meta.center[0], meta.center[1])); ctx.stage.add(g);
  const seq = new Seq(), pulse = new Pulse();
  blob(g, 1.0, 0.8, 0.28, 0, 0.0);
  const Y0 = 0.014, WALL = 0.13;
  let stage = 0, lensT = -1, expand = 0, expandTo = 0, projT = -1, projDone = false, bumpT = -1;

  // ---------------- the room (floor, walls)
  const room = grp(g, -0.03, Y0, 0.0); room.scale.setScalar(1.7);
  const floor = add(room, rb(1, 0.012, 1, 0.003, 2), std(0xe8c99a, { roughness: 0.6 }), 0, 0.006, 0, true);
  const back = add(room, rb(1, WALL, 0.008, 0.002, 2), std(0xf6f0e2), 0, WALL / 2 + 0.012, 0, true);
  const left = add(room, rb(0.008, WALL, 1, 0.002, 2), std(0xf6f0e2), 0, WALL / 2 + 0.012, 0, true);
  const right = add(room, rb(0.008, WALL, 1, 0.002, 2), std(0xeaf1ef), 0, WALL / 2 + 0.012, 0, true);
  const rimMat = std(0x1f9aa6);
  const rimB = add(room, rb(1, 0.006, 0.012, 0.002, 2), rimMat, 0, WALL + 0.013, 0), rimL = add(room, rb(0.012, 0.006, 1, 0.002, 2), rimMat, 0, WALL + 0.013, 0), rimR = add(room, rb(0.012, 0.006, 1, 0.002, 2), rimMat, 0, WALL + 0.013, 0);
  const board = grp(room, 0, 0.075, -0.005);
  const boardMat = std(0x2c6a4f, { emissive: 0x2c6a4f, emissiveIntensity: 0.1 });
  add(board, rb(0.13, 0.06, 0.006, 0.002, 2), boardMat, 0, 0, 0, true);
  add(board, rb(0.14, 0.068, 0.004, 0.002, 2), std(0xa4713f), 0, 0, -0.003);
  const win = add(room, rb(0.06, 0.05, 0.004, 0.003, 2), glass(0xbfe6ff, 0.5), 0.0, 0.08, 0.0);
  seq.add(room, 0.0, 0.8, { rise: 0.05 });

  // desks and students: crowded, then spaced
  const crowd = [], spaced = [];
  for (let i = 0; i < 6; i++) { const c = i % 3, r = Math.floor(i / 3); crowd.push([(c - 1) * 0.05, 0.016 + r * 0.05]); spaced.push([(c - 1) * 0.13, 0.03 + r * 0.11]); }
  const desks = crowd.map((p, i) => {
    const d = grp(room, p[0], 0.012, p[1]);
    add(d, rb(0.044, 0.004, 0.032, 0.001, 2), std(0xb8864f), 0, 0.03, 0, true);
    [[-0.018, -0.012], [0.018, -0.012], [-0.018, 0.012], [0.018, 0.012]].forEach(([x, z]) => add(d, new THREE.CylinderGeometry(0.0017, 0.0017, 0.03, 6), std(0x6b4f3f), x, 0.015, z));
    add(d, new THREE.CapsuleGeometry(0.008, 0.012, 3, 8), std([0x2a8fd0, 0xef8f2a, 0x8aa51f, 0xb5489a, 0x1f9aa6, 0xd9382b][i]), 0, 0.048, 0.024, true);
    add(d, new THREE.SphereGeometry(0.0085, 10, 8), std(0xf1d6b8), 0, 0.071, 0.024, true);
    return d;
  });

  // ---------------- three hidden limits (pins)
  const PINS = [
    { n: 'مالية', col: 0xe0453c, x: -0.06, z: 0.0, make: (p) => add(p, new THREE.CylinderGeometry(0.011, 0.011, 0.004, 20), brass(), 0, 0.02, 0).rotation.x = Math.PI / 2 },
    { n: 'بشرية', col: 0xe0453c, x: 0.0, z: 0.06, make: (p) => { add(p, new THREE.CapsuleGeometry(0.006, 0.01, 3, 8), std(0xe0453c), 0, 0.02, 0); add(p, new THREE.SphereGeometry(0.0065, 10, 8), std(0xe0453c), 0, 0.038, 0); } },
    { n: 'إدارية', col: 0xe0453c, x: 0.07, z: -0.04, make: (p) => { add(p, rb(0.018, 0.024, 0.004, 0.001, 2), std(0xf6f0e2), 0, 0.022, 0); add(p, rb(0.01, 0.003, 0.005, 0.001, 1), std(0xe0453c), 0, 0.03, 0.003); } },
  ].map((o, i) => {
    const p = grp(room, o.x, 0.012, o.z);
    add(p, new THREE.ConeGeometry(0.008, 0.02, 12), lit(0xe0453c, 0.8), 0, 0.012, 0).rotation.x = Math.PI;
    const top = grp(p, 0, 0.032, 0); o.make(top);
    const ring = add(p, new THREE.TorusGeometry(0.02, 0.0015, 6, 30), new THREE.MeshBasicMaterial({ color: 0xe0453c, transparent: true, opacity: 0.8, depthWrite: false }), 0, 0.001, 0); ring.rotation.x = Math.PI / 2;
    hit(p, 0.035, 0, 0.03, 0);
    const c = chip(o.n, 0, 0xe0453c); c.position.set(0, 0.09, 0); p.add(c);
    p.scale.setScalar(1e-4); p.visible = false; o.p = p; o.ring = ring; o.c = c; o.seen = false; return o;
  });
  PINS.forEach((o, i) => touch(ctx, o.p, () => { ctx.ui.card({ tag: 'تحليل بيئة التعلم', title: 'موارد ' + o.n, body: 'تُحلَّل ضمن الإمكانيات والتسهيلات التعليمية قبل تصميم أي مصدر.', color: 0xe0453c }); }, 0xe0453c));

  // ---------------- the loupe (analysis)
  const lens = grp(g, -0.33, 0.25, 0.3); lens.scale.setScalar(1.6);
  add(lens, new THREE.TorusGeometry(0.036, 0.005, 10, 36), brass(), 0, 0, 0, true);
  add(lens, new THREE.CircleGeometry(0.034, 28), glass(0xcfeeff, 0.35), 0, 0, 0.0);
  add(lens, new THREE.CylinderGeometry(0.006, 0.0075, 0.06, 10), std(0x3b2a20), 0.027, -0.05, 0).rotation.z = -0.55;
  lens.rotation.x = -1.0;
  const beamMat = new THREE.MeshBasicMaterial({ color: 0xfff0b0, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
  const beam = add(g, new THREE.PlaneGeometry(0.012, 0.2), beamMat, 0, 0.13, 0); beam.rotation.y = Math.PI / 2;
  hit(lens, 0.07, 0, 0, 0);
  seq.add(lens, 0.5, 0.8, { rise: 0.06 });
  pulse.add(lens, 0xffc94a, 0.2, 0, 0, 0, { op: 0.45 });
  const lc = chip('حلّل', 0, 0x1f9aa6); lc.position.set(-0.3, 0.05, 0.43); g.add(lc); seq.add(lc, 1.6, 0.5);
  touch(ctx, lens, () => {
    if (stage >= 1) { ctx.ui.toast('كشف التحليل الحدود الثلاثة'); return; }
    stage = 1; lensT = 0; ctx.ui.hud('الآن افتح المكان'); ctx.sfx.good?.();
    ctx.ui.card({ tag: 'حلّل البيئة قبل أن تصمّم', title: 'تحليل البيئة أولاً', body: 'يكشف مسبقاً المعيقات التي قد توقف تطبيق التصميم التعليمي بعد إنجازه.', color: 0x1f9aa6 });
  }, 0x1f9aa6);

  // ---------------- the tool that waits outside (projector)
  const pj = grp(g, 0.34, Y0, 0.28); pj.scale.setScalar(1.6);
  add(pj, rb(0.07, 0.035, 0.05, 0.007, 3), gloss(0xef8f2a), 0, 0.02, 0, true);
  add(pj, new THREE.CylinderGeometry(0.014, 0.014, 0.014, 20), std(0x2b2e3a), 0, 0.022, 0.03, true).rotation.x = Math.PI / 2;
  add(pj, new THREE.CylinderGeometry(0.009, 0.009, 0.004, 16), lit(0xbfe6ff, 0.8), 0, 0.022, 0.038).rotation.x = Math.PI / 2;
  pj.rotation.y = -0.3 + Math.PI;
  const pjBeamMat = new THREE.MeshBasicMaterial({ color: 0xfff6d0, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
  const pjBeam = add(pj, new THREE.CylinderGeometry(0.003, 0.03, 0.14, 16, 1, true), pjBeamMat, 0, 0.022, 0.1); pjBeam.rotation.x = Math.PI / 2; pjBeam.rotation.z = 0;
  hit(pj, 0.06, 0, 0.02, 0);
  seq.add(pj, 0.7, 0.8);
  pulse.add(pj, 0xef8f2a, 0.18, 0, 0.03, 0, { op: 0.4 });
  const pjc = chip('وسيلة', 0, 0xef8f2a); pjc.position.set(0.36, 0.06, 0.42); g.add(pjc); seq.add(pjc, 1.7, 0.5);
  touch(ctx, pj, () => {
    if (projDone) return;
    if (stage < 2) { bumpT = 0; ctx.sfx.bad?.(); ctx.ui.toast(stage < 1 ? 'حلّل المكان أولاً' : 'المكان لا يتسع بعد'); return; }
    projDone = true; projT = 0; ctx.sfx.good?.(); ctx.ui.hud('أصبت: التحليل ثم التصميم');
    ctx.ui.card({ tag: 'حلّل البيئة قبل أن تصمّم', title: 'وسيلة تناسب الهدف', body: 'بعد التحليل يُختار نوع الوسيلة التعليمية المناسبة لكل هدف.', color: 0xef8f2a });
    setTimeout(() => ctx.ui.done(), 900);
  }, 0xef8f2a);

  // ---------------- tap the room once the limits are known
  touch(ctx, floor, () => {
    if (stage < 1) { ctx.ui.toast('ابدأ بتحليل البيئة'); return; }
    if (stage >= 2) return;
    stage = 2; expandTo = 1; ctx.sfx.whoosh?.(); ctx.ui.hud('الآن ضع الوسيلة المناسبة');
    ctx.ui.card({ tag: 'حلّل البيئة قبل أن تصمّم', title: 'مكان أكثر انشراحاً', body: 'قد يقرر المعلم نقل الطلبة من الفصل إلى مكان أكثر انشراحاً وتحفيزاً.', color: 0x1f9aa6 });
  }, 0x1f9aa6);
  pulse.add(room, 0x1f9aa6, 0.0, 0, 0, 0, { op: 0 });

  ctx.ui.hud('ابدأ بالتحليل، لا بالإنتاج');
  const shadowK = 0;

  return {
    update(t, dt, e) {
      seq.update(t, e); pulse.update(t, e);
      expand += (expandTo - expand) * Math.min(1, dt * 2.4);
      const s = expand, W = 0.26 + 0.12 * s, D = 0.22 + 0.08 * s;
      floor.scale.set(W, 1, D); back.scale.set(W, 1, 1); back.position.z = -D / 2; left.scale.set(1, 1, D); left.position.x = -W / 2; right.scale.set(1, 1, D); right.position.x = W / 2;
      rimB.scale.set(W, 1, 1); rimB.position.z = -D / 2; rimL.scale.set(1, 1, D); rimL.position.x = -W / 2; rimR.scale.set(1, 1, D); rimR.position.x = W / 2;
      board.position.z = -D / 2 + 0.007; win.position.z = -D / 2 + 0.002; win.position.x = -W * 0.3;
      room.position.x = -0.03 + 0.01 * s; room.position.z = -0.03;
      desks.forEach((d, i) => { const a = crowd[i], b = spaced[i]; d.position.x = a[0] + (b[0] - a[0]) * s; d.position.z = a[1] + (b[1] - a[1]) * s - D / 2 + 0.12 * (1 - s) + 0.02 * s; d.rotation.y = (1 - s) * Math.sin(i * 2.3) * 0.5; });
      // loupe: hover, then sweep over the room
      let lx = -0.33, ly = 0.25 + Math.sin(t * 1.5) * 0.008, lz = 0.3;
      if (lensT >= 0) { lensT += dt; const k = clamp01(lensT / 2.6); lx = -0.28 + 0.56 * ease(k) ; lz = 0.12 + 0.08 * Math.sin(k * Math.PI); ly = 0.24; beam.position.set(-0.03 + lx, 0.13, -0.03); beamMat.opacity = 0.5 * Math.sin(k * Math.PI);
        PINS.forEach((o, i) => { const kk = clamp01((lensT - 0.5 - i * 0.6) / 0.7); o.p.scale.setScalar(Math.max(1e-4, easeBack(kk))); o.p.visible = kk > 0.01; });
        if (lensT > 2.8) { lensT = -2; lx = -0.33; } }
      else if (lensT === -2) { lx = -0.33; lz = 0.3; beamMat.opacity = 0; }
      lens.position.set(lx, ly, lz); lens.rotation.z = Math.sin(t * 1.2) * 0.2;
      PINS.forEach((o, i) => { o.p.position.y = 0.012 + Math.sin(t * 2 + i) * 0.003; o.ring.scale.setScalar(1 + 0.15 * Math.sin(t * 3 + i)); o.p.children[1].rotation.y += dt * 1.5; });
      // projector: bumps before it may enter; then glides in and lights the board
      let px = 0.34, pz = 0.28, py = Y0;
      if (bumpT >= 0) { bumpT += dt; px += Math.sin(bumpT * 30) * 0.008 * (1 - clamp01(bumpT / 0.4)); if (bumpT > 0.5) bumpT = -1; }
      if (projT >= 0) { projT += dt; const k = ease(projT / 1.2); px = 0.34 + (0.0 - 0.34) * k; pz = 0.28 + (0.3 - 0.28) * k; py = Y0 + 0.03 * k; }
      pj.position.set(px, py, pz);
      const lit = projT >= 0 ? clamp01((projT - 1.0) / 0.6) : 0;
      pjBeamMat.opacity = e * 0.28 * lit; boardMat.emissiveIntensity = 0.1 + 0.9 * lit;
      pj.rotation.y = Math.PI - 0.3 * (1 - (projT >= 0 ? ease(projT / 1.2) : 0));
    },
  };
}
