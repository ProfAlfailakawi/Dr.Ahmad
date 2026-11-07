import * as THREE from 'three';
import { mat, glossy, goldMat, shadowed, glow, stag, ease, easeBack, clamp01, label } from '../../kit.js?v=16';
import { scene, RoundedBox, TAU, lightPool, contactShadow } from '../lib/a8-kit.js?v=16';
export const meta = { free: true, center: [0.385, 0.65], typeLabel: 'اختر التوجّه' };

const GL = (c, i = 1) => new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: i, roughness: 0.3 });
const GLASS = (c, o = 0.5) => new THREE.MeshPhysicalMaterial({ color: c, roughness: 0.04, transparent: true, opacity: o, clearcoat: 1, emissive: c, emissiveIntensity: 0.16, depthWrite: false, side: THREE.DoubleSide });
const hex = (c) => '#' + c.toString(16).padStart(6, '0');
const OR = [
  { n: 'الاستقلال', c: 0x3b8fe0, why: 'ينادي أصحاب هذا التوجه بتنمية مهارات التفكير العليا من خلال دروس وبرامج خاصة ومحددة.' },
  { n: 'التضمين', c: 0x7ac143, why: 'يؤمن بتطوير مهارات التفكير العليا من خلال حصص المواد الدراسية المختلفة، بالاعتماد على خبرات تضع المتعلم في مواقف تستدعيها.' },
  { n: 'الدمج', c: 0xf29a2e, why: 'موقف وسط يجمع برامج مستقلة للمبادئ العامة، ومناهج توفر الجوانب التطبيقية والعملية.' },
];
const Q = [{ s: 'مساق مستقل بحصص خاصة', a: 0 }, { s: 'التفكير يُبنى داخل حصص المواد', a: 1 }, { s: 'برامج مستقلة ومناهج تطبيقية', a: 2 }];
const SUBJ = [0xe0527f, 0x3b8fe0, 0xf6c026, 0x2fbf8a, 0x8a5ad8];

function jar(c, k = 1) { // a glass cloche over a gold-edged coaster, an orb of thought inside
  const g = new THREE.Group();
  const co = new THREE.Mesh(new RoundedBox(0.2 * k, 0.012, 0.2 * k, 0.03), glossy(0xf6efdf)); co.position.y = 0.006; g.add(co);
  const rm = new THREE.Mesh(new THREE.TorusGeometry(0.088 * k, 0.005, 8, 56), goldMat()); rm.rotation.x = Math.PI / 2; rm.position.y = 0.014; g.add(rm);
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.088 * k, 0.088 * k, 0.07 * k, 48, 1, true), GLASS(c, 0.3)); body.position.y = 0.014 + 0.035 * k; g.add(body);
  const dome = new THREE.Mesh(new THREE.SphereGeometry(0.088 * k, 48, 20, 0, TAU, 0, Math.PI / 2), GLASS(c, 0.3)); dome.position.y = 0.014 + 0.07 * k; g.add(dome);
  const knob = new THREE.Mesh(new THREE.SphereGeometry(0.012 * k, 14, 10), goldMat()); knob.position.y = 0.014 + 0.158 * k; g.add(knob);
  const orb = new THREE.Mesh(new THREE.SphereGeometry(0.036 * k, 28, 20), GL(0xffe3a0, 0.9)); orb.position.y = 0.08 * k; g.add(orb);
  const r1 = new THREE.Mesh(new THREE.TorusGeometry(0.058 * k, 0.0028, 8, 56), goldMat()); r1.position.y = orb.position.y; r1.rotation.x = 1.2; g.add(r1);
  const r2 = r1.clone(); r2.rotation.set(0.5, 0.9, 0); g.add(r2);
  const h = glow(c, 0.3 * k, 0.55); h.position.y = orb.position.y; g.add(h);
  g.userData = { orb, r1, r2, h, y: orb.position.y };
  return g;
}
function tower(n, w = 0.16, k = 1) {
  const g = new THREE.Group(); const sparks = []; const sp = 0.05 * k;
  for (let i = 0; i < n; i++) {
    const s = new THREE.Mesh(new RoundedBox(w, 0.028 * k, w, 0.01), GLASS(SUBJ[i % 5], 0.8)); s.position.y = 0.016 + 0.014 * k + i * sp; g.add(s);
    if (i < n - 1) { const b = new THREE.Mesh(new THREE.SphereGeometry(0.0155 * k, 16, 12), GL(0xffe3a0, 1.2)); b.position.y = 0.016 + 0.014 * k + i * sp + sp / 2 + 0.003; g.add(b); sparks.push(b); }
  }
  const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.003, 0.003, n * sp + 0.03, 8), goldMat()); rod.position.y = 0.01 + (n * sp + 0.03) / 2; g.add(rod);
  const cap = new THREE.Mesh(new THREE.SphereGeometry(0.012 * k, 12, 8), goldMat()); cap.position.y = 0.014 + (n - 1) * sp + 0.03 * k + 0.01; g.add(cap);
  g.userData = { sparks };
  return g;
}

export default function build(ctx) {
  const S = scene(ctx, meta), g0 = S.g; const g = new THREE.Group(); g.scale.setScalar(0.92); g0.add(g);
  const POS = [new THREE.Vector3(-0.19, 0, 0.12), new THREE.Vector3(0.2, 0, 0.12), new THREE.Vector3(0.0, 0, -0.2)];
  const pods = OR.map((o, i) => {
    const grp = new THREE.Group(); grp.position.copy(POS[i]); g.add(grp);
    const pool = lightPool(o.c, 0.26, 0.0); pool.position.y = 0.002; grp.add(pool);
    const shd = contactShadow(0.3, 0.24, 0.32); grp.add(shd);
    let model;
    if (i === 0) model = jar(o.c, 1.5);
    else if (i === 1) model = tower(6, 0.19, 1.15);
    else {
      model = new THREE.Group();
      const mkHalf = (col, side) => {
        const h = new THREE.Group();
        const m = new THREE.Mesh(new THREE.SphereGeometry(0.115, 48, 30, side < 0 ? -Math.PI / 2 : Math.PI / 2, Math.PI), glossy(col, { roughness: 0.22, side: THREE.DoubleSide })); h.add(m);
        const cap = new THREE.Mesh(new THREE.CircleGeometry(0.115, 40), new THREE.MeshStandardMaterial({ color: col, emissive: col, emissiveIntensity: 0.6, side: THREE.DoubleSide })); cap.rotation.y = Math.PI / 2; h.add(cap);
        h.position.y = 0.14; return h;
      };
      const hl = mkHalf(0x3b8fe0, -1), hr = mkHalf(0xf29a2e, 1); model.add(hl, hr);
      const seam = new THREE.Mesh(new THREE.TorusGeometry(0.117, 0.004, 8, 60), goldMat()); seam.rotation.y = Math.PI / 2; seam.position.y = 0.14; model.add(seam);
      const core = glow(0xffe3a0, 0.25, 0.9); core.position.y = 0.14; model.add(core);
      const stand = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.04, 0.03, 20), goldMat()); stand.position.y = 0.015; model.add(stand);
      model.userData = { hl, hr, core, seam };
    }
    grp.add(model); shadowed(grp);
    const lamp = glow(o.c, 0.34, 0); lamp.position.y = 0.13; grp.add(lamp);
    const plate = label(o.n, 0.17, { size: 56, width: 440, weight: 800, border: hex(o.c), pad: 18, radius: 20 }); plate.rotation.x = -0.9; plate.position.set(0, 0.012, i === 2 ? 0.1 : 0.15); grp.add(plate);
    S.part(grp, 0.2 + i * 0.25, { rise: 0.16 });
    return { grp, model, lamp, pool, o, i, on: false, shake: -9 };
  });

  let round = 0, solved = 0, waiting = false;
  const setHud = () => ctx.ui.hud(round < Q.length ? `الموقف ${['١', '٢', '٣'][round]}: ${Q[round].s}` : 'تعرّفتَ التوجهات الثلاثة');
  setHud();
  pods.forEach((p) => {
    S.touch(p.grp, () => {
      if (round >= Q.length || waiting) { ctx.ui.card({ tag: 'توجّه تعليم التفكير', title: p.o.n, body: p.o.why, color: p.o.c }); return; }
      if (Q[round].a === p.i) {
        p.on = true; p.lamp.material.opacity = 0.6; solved++; waiting = true;
        S.burst(new THREE.Vector3(p.grp.position.x, 0.16, p.grp.position.z).multiplyScalar(0.92), p.o.c, 38, 0.6);
        ctx.sfx.good?.(); ctx.ui.card({ tag: 'أصبت', title: `التوجّه: ${p.o.n}`, body: p.o.why, color: p.o.c });
        round++;
        setTimeout(() => { waiting = false; setHud(); if (round >= Q.length) ctx.ui.done(); }, 2600);
      } else { p.shake = S.now; ctx.sfx.bad?.(); ctx.ui.toast('تأمّل الفرق بين التوجهات'); }
    }, { color: p.o.c, size: 0.22, at: new THREE.Vector3(0, 0.13, 0), wake: 3.2 });
  });

  S.loop((t, dt, e) => {
    pods.forEach((p, i) => {
      const m = p.model, ph = t * 1.4 + i;
      p.pool.material.opacity = (0.4 + (p.on ? 0.25 : 0)) * ease((t - 0.2) / 1.0) * e;
      if (i === 0) { const u = m.userData; u.r1.rotation.z = t * 1.3; u.r2.rotation.z = -t * 1.0; u.orb.position.y = u.y + Math.sin(ph) * 0.01; u.h.position.y = u.orb.position.y; }
      else if (i === 1) { m.rotation.y = Math.sin(t * 0.5) * 0.4; m.userData.sparks.forEach((s, k) => { const w = Math.max(0, Math.sin(t * 2.4 - k * 1.0)); s.material.emissiveIntensity = 0.6 + 0.9 * w; s.scale.setScalar(0.85 + 0.3 * w); }); }
      else { const u = m.userData, gap = 0.02 + 0.02 * Math.sin(t * 1.6) + (p.on ? -0.02 : 0); u.hl.position.x = -Math.max(gap, 0.002); u.hr.position.x = Math.max(gap, 0.002); u.hl.position.y = u.hr.position.y = 0.14 + Math.sin(t * 1.4) * 0.006; u.core.material.opacity = 0.6 + 0.3 * Math.sin(t * 3); m.rotation.y = Math.sin(t * 0.5) * 0.3; }
      p.grp.position.x = POS[i].x + clamp01(1 - (t - p.shake) / 0.5) * Math.sin((t - p.shake) * 55) * 0.02;
      if (p.on) p.lamp.material.opacity = 0.5 + 0.2 * Math.sin(t * 2); else p.lamp.material.opacity = t > 3.2 ? 0.14 + 0.08 * Math.sin(t * 2.4 + i) : 0;
    });
  });
  return { update: S.update };
}
