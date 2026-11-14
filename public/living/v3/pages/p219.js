// p219 — «احترموا عقولنا»: grey "minds" hover over an open bin; tap one to catch it before it falls, it turns gold on its own pedestal; the bin lid closes when none is left.
import * as THREE from 'three';
import { P, ease, easeBack, clamp01, stag, glow } from '../../kit.js?v=36';
import { rb, lathe, std, gloss, brass, add, grp, hit, Seq, Pulse, touch, chip, blob, at, TAU, INK, GOLD } from '../lib/a2.js?v=36';

export const meta = { free: true, center: [0.5, 0.62], typeLabel: 'مجسّم تفاعلي' };

const CARDS = [
  { title: 'عقلٌ في السلّة', body: 'الرسم يُلقي العقول في سلة المهملات: هكذا يبدو تجاهل العقل.' },
  { title: 'ليس حجراً', body: 'العقل ليس حجراً يُرمى. له قيمة تُحترم قبل أن تُهمل.' },
  { title: 'ما يُحترم يلمع', body: 'حين يُلتقط العقل قبل السقوط يتغيّر لونه: من رماديّ إلى ذهبيّ.' },
  { title: 'القرار بيدك', body: 'أنت من يقرّر: أن يسقط العقل في السلة أو أن يُحفظ في مكانه.' },
  { title: 'احترموا عقولنا', body: 'حين تُحفظ كل العقول تبقى السلة فارغة.' },
];
const N = 5, RING = 0.19, RY = 0.31, PED = 0.255;

export default function build(ctx) {
  const g = new THREE.Group(); g.position.copy(P(meta.center[0], meta.center[1])); g.scale.setScalar(1.12); ctx.stage.add(g);
  const seq = new Seq(), pulse = new Pulse();
  blob(g, 0.8, 0.7, 0.3);

  // yellow plate echoing the printed shape
  const plate = grp(g, 0, 0, 0);
  add(plate, lathe([[0, 0], [0.31, 0], [0.322, 0.008], [0.31, 0.02], [0, 0.02]], 64), std(0xf0b814, { roughness: 0.6 }), 0, 0, 0, true);
  const rim = add(plate, new THREE.TorusGeometry(0.318, 0.004, 8, 80), brass(), 0, 0.012, 0); rim.rotation.x = Math.PI / 2;
  seq.add(plate, 0.1, 0.8, { rise: 0.05 });

  // the bin (ink-dark, ribbed) with an open hinged lid
  const bin = grp(g, 0, 0.02, 0);
  add(bin, lathe([[0, 0], [0.066, 0], [0.074, 0.01], [0.092, 0.2], [0.098, 0.205], [0.098, 0.212], [0.088, 0.212], [0.086, 0.2], [0, 0.19]], 40), std(0x1d3535, { roughness: 0.45 }), 0, 0, 0, true);
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * TAU, r = 0.0905 - 0.0001;
    const rib = add(bin, rb(0.012, 0.15, 0.006, 0.003, 1), std(0x56706e, { roughness: 0.4 }), 0, 0.105, 0);
    const rr = 0.08 + (0.105 / 0.2) * 0.0; rib.position.set(Math.sin(a) * (r - 0.006), 0.105, Math.cos(a) * (r - 0.006)); rib.rotation.y = a; rib.rotation.x = 0;
  }
  const band = add(bin, new THREE.TorusGeometry(0.097, 0.004, 8, 48), brass(), 0, 0.2, 0); band.rotation.x = Math.PI / 2;
  const lidP = grp(bin, 0, 0.21, -0.095);
  const lid = add(lidP, new THREE.CylinderGeometry(0.1, 0.1, 0.008, 40), std(0x1d3535, { roughness: 0.45 }), 0, 0.004, 0.095, true);
  add(lidP, rb(0.03, 0.01, 0.016, 0.004, 2), brass(), 0, 0.012, 0.19);
  lidP.rotation.x = -1.35;
  seq.add(bin, 0.5, 0.8, { rise: 0.08 });
  const plate0 = chip('عقولنا', 0, GOLD, { k: 1.25 }); plate0.position.set(0, 0.1, 0.13); bin.add(plate0);
  seq.add(plate0, 1.3, 0.5);

  // pedestals
  const peds = [];
  for (let i = 0; i < N; i++) {
    const a = ((i - 2) / 2) * 1.25 + 0;   // spread across the front arc
    const x = Math.sin(a) * PED, z = Math.cos(a) * PED * 0.9;
    const pg = grp(g, x, 0.02, z);
    add(pg, lathe([[0, 0], [0.036, 0], [0.04, 0.008], [0.03, 0.02], [0, 0.02]], 24), std(0x2b3a3a, { roughness: 0.5 }), 0, 0, 0, true);
    const tr = add(pg, new THREE.TorusGeometry(0.036, 0.003, 6, 28), brass(), 0, 0.012, 0); tr.rotation.x = Math.PI / 2;
    seq.add(pg, 0.8 + i * 0.1, 0.5, { rise: 0.03 });
    peds.push({ x, z });
  }

  // the minds: faceted grey stones
  const geo = new THREE.IcosahedronGeometry(0.046, 0);
  const stones = [];
  for (let i = 0; i < N; i++) {
    const a = (i / N) * TAU + Math.PI / N;
    const sg = grp(g, 0, 0, 0);
    const m = new THREE.MeshStandardMaterial({ color: 0x7c8186, roughness: 0.55, metalness: 0.15, flatShading: true, emissive: 0xffc94a, emissiveIntensity: 0 });
    const body = add(sg, geo, m, 0, 0, 0, true); body.scale.set(1, 0.85 + (i % 3) * 0.1, 0.95); body.rotation.set(i, i * 2, 0);
    const halo = glow(0xffd27a, 0.15, 0); sg.add(halo);
    const soft = pulse.add(sg, 0xffe9a0, 0.13, 0, 0, 0, { op: 0.3, amp: 0.2 });
    hit(sg, 0.065, 0, 0, 0);
    const rx = Math.sin(a) * RING, rz = Math.cos(a) * RING;
    sg.position.set(rx, RY, rz);
    seq.add(sg, 1.6 + i * 0.18, 0.6, { rise: -0.06 });
    stones.push({ sg, body, m, halo, soft, rx, rz, i, st: 0, k: 0 });
  }

  // a decorative stone keeps falling into the bin until all are saved
  const fall = add(g, geo, std(0x555a5f, { roughness: 0.55, flatShading: true }), 0, 0.5, 0.0);
  fall.scale.setScalar(0.8);
  // drip lines like the print
  let saved = 0, state = 'idle', pauseT = 0, done = false, cardIdx = 0;
  const v = new THREE.Vector3();

  stones.forEach((s) => touch(ctx, s.sg, () => {
    if (s.st !== 0) return;
    s.st = 1; s.k = 0; s.soft.visible = false; ctx.sfx.good?.();
  }, GOLD));
  ctx.tap(bin, () => { ctx.sfx.bad?.(); ctx.ui.toast('التقط العقول قبل أن تسقط'); });

  ctx.ui.hud('اِلتقط العقول قبل سقوطها');
  let ft = 0;
  return {
    update(t, dt, e) {
      seq.update(t, e); pulse.update(t, e);
      // falling stone loop
      ft = (t * 0.55) % 1;
      if (saved < N && t > 2) { fall.visible = true; fall.position.set(0.0, 0.46 - ft * 0.26, 0.0); fall.rotation.x = t * 2; fall.rotation.y = t * 1.3; fall.scale.setScalar(Math.max(1e-4, 0.8 * e * (ft > 0.9 ? (1 - ft) * 10 : 1))); }
      else fall.visible = false;
      // lid
      const lt = -1.35 * (1 - saved / N) * 1; lidP.rotation.x += (lt - lidP.rotation.x) * Math.min(1, dt * 3);
      let flying = false;
      stones.forEach((s) => {
        if (t < 2.2) return;
        const bob = Math.sin(t * 1.6 + s.i * 1.3) * 0.012;
        if (s.st === 0) { s.sg.position.set(s.rx, RY + bob, s.rz); s.body.rotation.y += dt * 0.5; }
        else if (s.st === 1) {
          flying = true; s.k += dt / 0.9; const k = clamp01(s.k), kk = ease(k);
          const p = peds[s.i];
          s.sg.position.set(s.rx + (p.x - s.rx) * kk, RY + (0.085 - RY) * kk + Math.sin(k * Math.PI) * 0.07, s.rz + (p.z - s.rz) * kk);
          s.body.rotation.y += dt * 4;
          if (k >= 1) {
            s.st = 2; saved++; s.m.color.setHex(0xf1c24a); s.m.emissiveIntensity = 0.55; s.m.metalness = 0.6; s.m.roughness = 0.3; s.halo.material.opacity = 0.7;
            ctx.fx.burst(at(ctx, s.sg, 0.02), 0xffd27a, 18, 0.4, 0.03);
            const c = CARDS[cardIdx++]; ctx.ui.card({ tag: 'احترموا عقولنا', title: c.title, body: c.body, color: 0xf1c24a });
            pauseT = 0;
            if (saved >= N) { state = 'end'; }
          }
        } else { s.sg.position.y = 0.085 + Math.sin(t * 2 + s.i) * 0.005; s.body.rotation.y += dt * 0.8; s.halo.material.opacity = (0.55 + 0.2 * Math.sin(t * 3 + s.i)) * e; }
      });
      if (state === 'end' && !flying) {
        pauseT += dt;
        if (pauseT > 2.6 && !done) { done = true; ctx.ui.hideCard(); ctx.ui.hud('كل العقول محفوظة'); ctx.ui.done(); }
      }
    },
  };
}
