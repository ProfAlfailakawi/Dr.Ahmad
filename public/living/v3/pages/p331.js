// p331 — التلاحم العضوي الوظيفي: a glass head (the mind), a phone (the machines) and a globe (the network) on a blue hexagon; touch each and light joins them.
import * as THREE from 'three';
import { P, ease, easeBack, clamp01, glow, lightTube } from '../../kit.js?v=31';
import { rb, lathe, std, lit, gloss, glass, brass, add, grp, hit, Seq, Pulse, touch, chip, blob, at, TAU, GOLD } from '../lib/a2.js?v=31';

export const meta = { free: true, center: [0.46, 0.66], typeLabel: 'مجسّم تفاعلي' };

const BLUE = 0x2f5fb3, SKY = 0x4a97d8, CYAN = 0x7fd4ff;
const INFO = [
  { name: 'العقل', title: 'العقل البشري', body: 'العصر الحالي هو عصر التلاحم العضوي الوظيفي بين العقل البشري والحاسبات الآلية.', col: 0xe8a33d },
  { name: 'الحاسب', title: 'الحاسبات الآلية', body: 'مع انتشار الإنترنت الواسع تغيّرت طريقة التفكير بالنسبة للتعلم عما كانت عليه سابقاً.', col: SKY },
  { name: 'الشبكة', title: 'الشبكة العنكبوتية', body: 'لم تعد المؤسسات التعليمية البيئة التعليمية الوحيدة لتقديم خدمات التعليم والتعلم.', col: 0x3fb7a4 },
];

function screenTex() {
  const c = document.createElement('canvas'); c.width = 256; c.height = 480; const g = c.getContext('2d');
  const gr = g.createLinearGradient(0, 0, 0, 480); gr.addColorStop(0, '#2b6fd0'); gr.addColorStop(1, '#16397d'); g.fillStyle = gr; g.fillRect(0, 0, 256, 480);
  g.strokeStyle = 'rgba(255,255,255,.85)'; g.lineWidth = 7; g.lineCap = 'round';
  [[40, 70, 120], [40, 100, 90], [40, 130, 105]].forEach(([x, y, w]) => { g.beginPath(); g.moveTo(x, y); g.lineTo(x + w, y); g.stroke(); });
  g.lineWidth = 5; g.beginPath(); g.arc(128, 300, 80, 0, TAU); g.stroke();
  g.beginPath(); g.ellipse(128, 300, 34, 80, 0, 0, TAU); g.stroke(); g.beginPath(); g.moveTo(48, 300); g.lineTo(208, 300); g.stroke();
  g.beginPath(); g.moveTo(128, 220); g.lineTo(128, 380); g.stroke();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

export default function build(ctx) {
  const g = new THREE.Group(); g.position.copy(P(meta.center[0], meta.center[1])); g.scale.setScalar(1.15); ctx.stage.add(g);
  const seq = new Seq(), pulse = new Pulse();
  blob(g, 0.8, 0.6, 0.3, 0, 0.02);

  // ---- hexagonal stage, echoing the printed hexagon
  const hx = (r, y0, h, col, o = {}) => { const m = add(g, new THREE.CylinderGeometry(r, r, h, 6), std(col, { roughness: 0.4, ...o }), 0, y0 + h / 2, 0, true); m.rotation.y = Math.PI / 6; return m; };
  const base = grp(g, 0, 0, 0);
  const b1 = hx(0.29, 0, 0.02, SKY), b2 = hx(0.265, 0.02, 0.014, 0xeaf1fb), b3 = hx(0.245, 0.034, 0.012, BLUE);
  [b1, b2, b3].forEach((m) => { g.remove(m); base.add(m); });
  const ring = add(base, new THREE.TorusGeometry(0.245, 0.004, 6, 6), brass(), 0, 0.047, 0); ring.rotation.set(Math.PI / 2, 0, Math.PI / 6);
  base.scale.setScalar(0.85); seq.add(base, 0.1, 0.9, { rise: 0.05 });
  const Y = 0.046;

  // ---- the mind: a glass head in profile, facing the phone
  const head = grp(g, -0.155, Y, -0.01);
  const hg = glass(0xcfe8ff, 0.32);
  add(head, new THREE.CylinderGeometry(0.03, 0.04, 0.05, 20), std(0x1e2f55, { roughness: 0.4 }), 0, 0.025, 0, true);
  add(head, new THREE.CylinderGeometry(0.044, 0.05, 0.012, 24), brass(), 0, 0.006, 0);
  const cran = add(head, new THREE.SphereGeometry(0.066, 20, 14), hg, -0.005, 0.145, 0); cran.scale.set(1.0, 0.95, 0.86);
  const jaw = add(head, rb(0.07, 0.05, 0.075, 0.02, 3), hg, 0.022, 0.1, 0);
  const nose = add(head, new THREE.ConeGeometry(0.012, 0.03, 10), hg, 0.07, 0.125, 0); nose.rotation.z = -Math.PI / 2 - 0.25;
  const neck = add(head, new THREE.CylinderGeometry(0.026, 0.032, 0.05, 14), hg, -0.012, 0.062, 0);
  const wire = add(head, new THREE.TorusGeometry(0.066, 0.0016, 6, 40), brass(), -0.005, 0.145, 0); wire.scale.set(1.0, 0.95, 1);
  const wire2 = add(head, new THREE.TorusGeometry(0.066, 0.0016, 6, 40), brass(), -0.005, 0.145, 0); wire2.scale.set(1.0, 0.95, 1); wire2.rotation.y = Math.PI / 2;
  const brainMat = lit(0xffb457, 0.4, { roughness: 0.3 });
  const brain = add(head, new THREE.IcosahedronGeometry(0.036, 1), brainMat, -0.005, 0.15, 0);
  const brainRing = add(head, new THREE.TorusGeometry(0.05, 0.0025, 6, 36), brass(), -0.005, 0.15, 0);
  const brainHalo = glow(0xffb457, 0.2, 0.0); brainHalo.position.set(-0.005, 0.15, 0); head.add(brainHalo);
  head.rotation.y = 0.2;
  head.scale.setScalar(1.2); seq.add(head, 0.5, 0.9, { rise: 0.08 });

  // ---- the machine: a phone standing on a dock
  const ph = grp(g, 0.0, Y, 0.03);
  add(ph, rb(0.1, 0.012, 0.06, 0.005, 2), brass(), 0, 0.006, 0, true);
  const body = grp(ph, 0, 0.012, 0); body.rotation.x = -0.12;
  add(body, rb(0.082, 0.15, 0.012, 0.012, 3), std(0xf2f5fa, { roughness: 0.25, metalness: 0.2 }), 0, 0.077, 0, true);
  const scr = add(body, new THREE.PlaneGeometry(0.07, 0.126), new THREE.MeshStandardMaterial({ map: screenTex(), emissive: 0xffffff, emissiveMap: null, emissiveIntensity: 0, roughness: 0.3 }), 0, 0.083, 0.0065);
  scr.material.emissive.set(0x3a7ee0);
  const scrBack = add(body, new THREE.PlaneGeometry(0.07, 0.126), std(0x1c2c55), 0, 0.083, -0.0065); scrBack.rotation.y = Math.PI;
  const btn = add(body, new THREE.CylinderGeometry(0.005, 0.005, 0.002, 12), std(0x1c2c55), 0, 0.012, 0.0066); btn.rotation.x = Math.PI / 2;
  const phHalo = glow(0x6fb4ff, 0.2, 0.0); phHalo.position.set(0, 0.09, 0.02); ph.add(phHalo);
  ph.scale.setScalar(1.2); seq.add(ph, 0.7, 0.9, { rise: 0.08 });

  // ---- the network: a wire globe on a brass cradle
  const gl = grp(g, 0.165, Y, -0.01);
  add(gl, new THREE.CylinderGeometry(0.03, 0.04, 0.012, 20), brass(), 0, 0.006, 0, true);
  add(gl, new THREE.CylinderGeometry(0.004, 0.004, 0.06, 8), brass(), 0, 0.04, 0);
  const sph = grp(gl, 0, 0.125, 0); sph.rotation.z = 0.35;
  const coreMat = new THREE.MeshStandardMaterial({ color: 0x2c8c82, emissive: 0x3fb7a4, emissiveIntensity: 0.15, roughness: 0.3, transparent: true, opacity: 0.9 });
  add(sph, new THREE.SphereGeometry(0.058, 18, 12), coreMat, 0, 0, 0);
  const wmat = lit(0xeafffb, 0.6);
  for (let i = 0; i < 3; i++) { const t = add(sph, new THREE.TorusGeometry(0.064, 0.0022, 5, 32), wmat, 0, 0, 0); t.rotation.y = (i * Math.PI) / 3; }
  [-0.035, 0.035].forEach((y) => { const r = Math.sqrt(0.064 * 0.064 - y * y); const t = add(sph, new THREE.TorusGeometry(r, 0.002, 6, 40), wmat, 0, y, 0); t.rotation.x = Math.PI / 2; });
  const eq = add(sph, new THREE.TorusGeometry(0.064, 0.0022, 5, 32), wmat, 0, 0, 0); eq.rotation.x = Math.PI / 2;
  const glHalo = glow(0x5fe0cb, 0.2, 0.0); glHalo.position.set(0, 0.125, 0); gl.add(glHalo);
  gl.scale.setScalar(1.2); seq.add(gl, 0.9, 0.9, { rise: 0.08 });

  // ---- labels painted on the front rim of the stage
  const parts = [head, ph, gl];
  const lblX = [-0.155, 0.0, 0.165];
  INFO.forEach((it, i) => {
    const c = chip(it.name, 0, 0x1e2f55, { k: 0.8 }); c.position.set(lblX[i], Y + 0.045, 0.19); g.add(c); seq.add(c, 1.6 + i * 0.12, 0.5, { rise: 0.01 });
  });

  // ---- pulses & hit targets
  const hy = [0.12, 0.09, 0.12];
  parts.forEach((o, i) => { hit(o, 0.085, 0, hy[i], 0); pulse.add(o, INFO[i].col, 0.2, 0, hy[i], 0, { op: 0.3, additive: true }); });

  // ---- light tubes between the parts
  const cp = (a, b, lift) => {
    const A = new THREE.Vector3(a.x, Y + 0.1, a.z), B = new THREE.Vector3(b.x, Y + 0.1, b.z);
    return new THREE.CatmullRomCurve3([A, A.clone().lerp(B, 0.5).setY(Y + 0.1 + lift), B], false, 'catmullrom', 0.5);
  };
  const pos = { 0: { x: -0.155, z: -0.01 }, 1: { x: 0, z: 0.03 }, 2: { x: 0.165, z: -0.01 } };
  const pairs = [[0, 1, 0.025, 0xffc46a], [1, 2, 0.025, 0x7fe3d0]];
  const tubes = pairs.map(([a, b, lift, col]) => {
    const A = new THREE.Vector3(pos[a].x, Y + 0.17, pos[a].z), B = new THREE.Vector3(pos[b].x, Y + 0.17, pos[b].z), M = A.clone().lerp(B, 0.5); M.y += lift;
    const tb = lightTube(new THREE.CatmullRomCurve3([A, M, B], false, 'catmullrom', 0.5), { radius: 0.005, color: col, speed: 0.7, glass: false });
    tb.userData.fill(0); g.add(tb); return { tb, fill: 0, a, b };
  });

  // ---- the fusion core appears above the centre when all three are lit
  const core = grp(g, 0, Y + 0.31, 0.0);
  add(core, new THREE.SphereGeometry(0.03, 16, 12), gloss(0xffe29a, { emissive: 0xffc94a, emissiveIntensity: 0.9 }), 0, 0, 0);
  const cr1 = add(core, new THREE.TorusGeometry(0.048, 0.003, 8, 40), brass(), 0, 0, 0);
  const cr2 = add(core, new THREE.TorusGeometry(0.058, 0.002, 8, 40), brass(), 0, 0, 0);
  const coreHalo = glow(0xffd27a, 0.2, 0.7); core.add(coreHalo);
  hit(core, 0.075, 0, 0, 0);
  core.scale.setScalar(1e-4); core.visible = false;

  // ---- sparks orbiting the hexagon from the first second
  const sparks = [0, 1, 2, 3].map((k) => { const s = glow(k % 2 ? 0x9fd6ff : 0xffd27a, 0.045, 0.0); g.add(s); return s; });

  // ---- state
  const lit_ = [0, 0, 0], on = [false, false, false]; let litN = 0, coreOn = false, coreT = 0, finished = false, hint = 0;
  parts.forEach((o, i) => touch(ctx, o, () => {
    on[i] = true; litN = on.filter(Boolean).length;
    ctx.ui.card({ tag: 'التلاحم', title: INFO[i].title, body: INFO[i].body, color: INFO[i].col });
    if (litN === 3 && !coreOn) { coreOn = true; core.visible = true; coreT = 0; ctx.ui.hud('المس الشرارة'); }
    else if (litN < 3) ctx.ui.hud('المس بقية الأجزاء');
  }, INFO[i].col));
  touch(ctx, core, () => {
    if (!coreOn) return;
    ctx.ui.card({ tag: 'التلاحم', title: 'عقل وحاسوب معاً', body: 'شبكات التواصل الاجتماعي تضيف وسائل جديدة لنقل الأفكار والمعلومات بين جميع الأطراف المشاركة في العملية التعليمية.', color: GOLD });
    if (!finished) { finished = true; ctx.fx.burst(at(ctx, core), 0xffd27a, 26, 0.5, 0.035); ctx.ui.done(); }
  }, GOLD);
  const seqStart = 2.2;

  return {
    update(t, dt, e) {
      seq.update(t, e); pulse.update(t, e);
      if (hint === 0 && t > seqStart) { hint = 1; ctx.ui.hud('المس العقل والجهاز والشبكة'); }
      // idle life
      brain.rotation.y = t * 0.7; brain.rotation.x = t * 0.4; brainRing.rotation.x = t * 1.1; brainRing.rotation.z = t * 0.6;
      sph.rotation.y = t * 0.5; scr.material.emissiveIntensity = 0.12 + 0.2 * lit_[1];
      sparks.forEach((s, k) => { const a = t * 0.7 + k * (TAU / 4), r = 0.255; s.position.set(Math.cos(a) * r, Y + 0.02, Math.sin(a) * r); s.material.opacity = 0.6 * e * clamp01((t - 1.2) / 1.0); });
      // lighting of parts
      for (let i = 0; i < 3; i++) lit_[i] += ((on[i] ? 1 : 0) - lit_[i]) * Math.min(1, dt * 4);
      brainMat.emissiveIntensity = 0.4 + 0.9 * lit_[0] + 0.15 * Math.sin(t * 3); brainHalo.scale.setScalar(0.2 + 0.1 * lit_[0]); brainHalo.material.opacity = (0.15 + 0.6 * lit_[0]) * e;
      coreMat.emissiveIntensity = 0.15 + 0.9 * lit_[2]; glHalo.material.opacity = 0.6 * lit_[2] * e; phHalo.material.opacity = 0.6 * lit_[1] * e;
      tubes.forEach((q) => { const tgt = on[q.a] && on[q.b] ? 1 : 0; q.fill += (tgt - q.fill) * Math.min(1, dt * 1.6); q.tb.userData.fill(q.fill * e); q.tb.userData.update(dt); });
      if (coreOn) {
        coreT += dt; const k = easeBack(clamp01(coreT / 0.8)) * e; core.scale.setScalar(Math.max(1e-4, k));
        core.position.y = Y + 0.31 + Math.sin(t * 2) * 0.008; cr1.rotation.x = t * 1.5; cr1.rotation.y = t * 0.7; cr2.rotation.y = t * 1.1; cr2.rotation.z = t * 0.9;
        coreHalo.material.opacity = e * (0.55 + 0.25 * Math.sin(t * 3));
      }
    },
  };
}
