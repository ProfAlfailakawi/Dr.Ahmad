// p166 — ADDIE as a staircase of five lit steps: a glowing output arrives, tap the step that produces it.
import * as THREE from 'three';
import { P, ease, easeBack, clamp01, stag, glow, lightTube } from '../../kit.js?v=16';
import { rb, lathe, std, lit, gloss, glass, brass, add, grp, hit, Seq, Pulse, touch, chip, plinth, blob, at, shuffled, TAU, INK, GOLD } from '../lib/a2.js?v=16';

export const meta = { free: true, center: [0.5, 0.54], typeLabel: 'لعبة ترتيب' };

const PH = [
  { L: 'A', col: 0x3a6fc4, out: 'خصائص المتعلم والمعوقات', title: 'التحليل · Analysis', body: 'التحليل ينتج خصائص المتعلم ووصف المعوقات وصياغة المشكلات والحاجات.' },
  { L: 'D', col: 0x1f9aa6, out: 'أهداف قابلة للقياس وإستراتيجية', title: 'التصميم · Design', body: 'يبني التصميم على التحليل أهدافاً قابلة للقياس وإستراتيجية تدريس ومواصفات النموذج الأولي.' },
  { L: 'D', col: 0x4fb98f, out: 'اللوحة القصصية والسيناريو', title: 'التطوير · Development', body: 'يُنتج التطوير المواد: اللوحة القصصية والسيناريو وبرامج الحاسوب.' },
  { L: 'I', col: 0xe86f8e, out: 'ملاحظات المتعلمين وبياناتهم', title: 'التنفيذ · Implementation', body: 'يجمع التنفيذ ملاحظات المتعلمين وبياناتهم في سياق واقعي.' },
  { L: 'E', col: 0x8a1c26, out: 'التوصيات والنموذج المعدّل', title: 'التقويم · Evaluation', body: 'ينتهي التقويم بالتوصيات وتقرير المشروع والنموذج الأولي المعدّل.' },
];

export default function build(ctx) {
  const g = new THREE.Group(); g.position.copy(P(meta.center[0], meta.center[1])); ctx.stage.add(g);
  const seq = new Seq(), pulse = new Pulse();
  blob(g, 1.0, 0.45, 0.3, 0, 0.0);
  const Y0 = 0.0, SW = 0.145, DX = 0.155;

  const steps = PH.map((p, i) => {
    const x = (2 - i) * DX * -1 * -1;      // A on the right, E on the left (Arabic reading order)
    const px = (i - 2) * -DX, h = 0.07 + i * 0.055;
    const s = grp(g, px, Y0, 0.0);
    const blk = add(s, rb(SW, h, 0.2, 0.014, 3), std(p.col, { roughness: 0.38 }), 0, h / 2, 0, true);
    const cap = add(s, rb(SW + 0.008, 0.008, 0.208, 0.004, 2), brass(), 0, h + 0.004, 0, true);
    const lamp = add(s, new THREE.CylinderGeometry(0.036, 0.036, 0.003, 28), new THREE.MeshStandardMaterial({ color: p.col, emissive: p.col, emissiveIntensity: 0.0 }), 0, h + 0.0095, 0);
    const c = chip(p.L, 0, p.col, { k: 1.9 }); c.position.set(0, h + 0.09, 0.03); s.add(c);
    hit(s, 0.085, 0, h / 2 + 0.02, 0);
    pulse.add(s, p.col, 0.2, 0, h + 0.02, 0, { op: 0.33 });
    seq.add(s, 0.1 + i * 0.16, 0.7, { rise: 0.1 }); seq.add(c, 1.2 + i * 0.1, 0.5);
    return { s, h, p, i, px, lamp, lit: 0, shake: -1, placed: null, solved: false };
  });

  // glowing stacks that land on solved steps
  const crates = steps.map((st) => { const cr = grp(g, st.px, Y0 + st.h + 0.016, 0); add(cr, rb(0.08, 0.04, 0.07, 0.008, 2), gloss(st.p.col, { emissive: st.p.col, emissiveIntensity: 0.35 }), 0, 0.015, 0, true); add(cr, rb(0.04, 0.004, 0.003, 0.001, 1), std(0xffffff), 0, 0.02, 0.026); cr.scale.setScalar(1e-4); cr.visible = false; return cr; });
  // chain of light between solved steps
  const tubes = steps.slice(0, 4).map((st, i) => {
    const a = new THREE.Vector3(st.px, Y0 + st.h + 0.02, 0.1), b = new THREE.Vector3(steps[i + 1].px, Y0 + steps[i + 1].h + 0.02, 0.1), m = a.clone().lerp(b, 0.5); m.y += 0.05;
    const tb = lightTube(new THREE.QuadraticBezierCurve3(a, m, b), { radius: 0.004, color: 0xffd27a, speed: 0.6 }); tb.userData.fill(0); g.add(tb); return tb;
  });

  const orbG = grp(g, 0.0, Y0 + 0.56, -0.12);
  add(orbG, new THREE.SphereGeometry(0.026, 24, 16), gloss(0xffe29a, { emissive: 0xffc94a, emissiveIntensity: 0.7 }), 0, 0, 0);
  const ring = add(orbG, new THREE.TorusGeometry(0.04, 0.0025, 8, 40), brass(), 0, 0, 0);
  const halo = glow(0xffd27a, 0.14, 0.0); orbG.add(halo);
  orbG.scale.setScalar(1e-4); orbG.visible = false;

  const order = shuffled([0, 1, 2, 3, 4], 31);
  let qi = -1, state = 'wait', tAnim = 0, tgt = null, fails = 0, nextAt = 2.0, solvedN = 0, tubeFill = [0, 0, 0, 0], lastTube = -1;
  const rest = new THREE.Vector3(0, Y0 + 0.56, -0.12);
  const give = () => { ctx.ui.hud(PH[order[qi]].out); state = 'idle'; orbG.visible = true; tAnim = 0; };
  steps.forEach((st) => touch(ctx, st.s, () => {
    if (state !== 'idle' || qi < 0) return;
    if (order[qi] === st.i) {
      tgt = st; state = 'fly'; tAnim = 0; ctx.sfx.good?.();
    } else { st.shake = 0; fails++; ctx.sfx.bad?.(); ctx.ui.toast('ليست لهذه المرحلة'); }
  }, 0xffd27a));
  const dest = new THREE.Vector3();

  return {
    update(t, dt, e) {
      seq.update(t, e); pulse.update(t, e);
      if (qi < 0 && t > nextAt) { qi = 0; give(); }
      ring.rotation.x = t * 1.3; ring.rotation.y = t * 0.8;
      if (state === 'idle') { tAnim += dt; orbG.scale.setScalar(Math.max(1e-4, easeBack(clamp01(tAnim / 0.5)) * e)); orbG.position.set(rest.x, rest.y + Math.sin(t * 2.2) * 0.008, rest.z); halo.material.opacity = e * (0.6 + 0.25 * Math.sin(t * 3)); }
      else if (state === 'fly') {
        tAnim += dt; const k = clamp01(tAnim / 0.8), kk = ease(k);
        dest.set(tgt.px, Y0 + tgt.h + 0.04, 0);
        orbG.position.set(rest.x + (dest.x - rest.x) * kk, rest.y + (dest.y - rest.y) * kk + Math.sin(k * Math.PI) * 0.05, rest.z + (dest.z - rest.z) * kk);
        orbG.scale.setScalar(Math.max(1e-4, (1 - 0.5 * k) * e));
        if (k >= 1) {
          tgt.solved = true; tgt.lit = 1; solvedN++; orbG.visible = false; state = 'pause'; tAnim = 0; crates[tgt.i].visible = true; crates[tgt.i].userData.t = 0;
          ctx.fx.burst(at(ctx, orbG), tgt.p.col, 16, 0.32, 0.03);
          ctx.ui.card({ tag: 'نموذج ADDIE', title: tgt.p.title, body: tgt.p.body, color: tgt.p.col });
          qi++;
        }
      } else if (state === 'pause') {
        tAnim += dt;
        if (tAnim > 2.4) {
          if (qi >= 5) { state = 'end'; ctx.ui.hideCard(); ctx.ui.hud('كل مرحلة تغذّي التي بعدها'); ctx.ui.done(); } else { ctx.ui.hideCard(); give(); }
        }
      }
      steps.forEach((st) => {
        let sh = 0; if (st.shake >= 0) { st.shake += dt; sh = Math.sin(st.shake * 55) * 0.005 * (1 - clamp01(st.shake / 0.45)); if (st.shake > 0.5) st.shake = -1; }
        st.s.position.x = st.px + sh;
        st.lamp.material.emissiveIntensity = st.solved ? 0.9 + 0.3 * Math.sin(t * 3 + st.i) : 0;
        const cr = crates[st.i]; if (st.solved) { cr.userData.t = (cr.userData.t || 0) + dt; cr.scale.setScalar(Math.max(1e-4, easeBack(clamp01(cr.userData.t / 0.6)))); cr.position.y = Y0 + st.h + 0.016 + Math.sin(t * 1.8 + st.i) * 0.002; }
      });
      // light chain grows between neighbouring solved steps
      for (let i = 0; i < 4; i++) { const on = steps[i].solved && steps[i + 1].solved ? 1 : 0; tubeFill[i] += (on - tubeFill[i]) * Math.min(1, dt * 1.2); tubes[i].userData.fill(tubeFill[i] * e); tubes[i].userData.update(dt); }
    },
  };
}
