// p162 — two glass jars, a wide blue one and a small purple one nested in its shadow: each property drops into the jar it belongs to.
import * as THREE from 'three';
import { P, ease, easeBack, clamp01, stag, glow } from '../../kit.js?v=15';
import { rb, lathe, std, lit, gloss, glass, brass, add, grp, hit, Seq, Pulse, touch, chip, plinth, slab, blob, at, shuffled, TAU, INK, GOLD } from '../lib/a2.js?v=15';

export const meta = { free: true, center: [0.5, 0.4], typeLabel: 'لعبة تصنيف' };

const ITEMS = [
  ['نظام شامل يضم التدريب والتعليم', 0], ['نظام جزئي من نظام التعليم', 1], ['عمل جماعي تعاوني متكامل', 0], ['عمل فردي', 1],
  ['يرتبط بالمادة التعليمية', 0], ['يرتبط بالحصة الدراسية', 1], ['أهداف عامة للمقررات', 0], ['أهداف سلوكية خلال الحصة', 1],
  ['تقويم تكويني وختامي', 0], ['تقويم الأهداف السلوكية', 1], ['يُجرَّب المحتوى على الطلبة', 0], ['لا يُجرَّب غالباً', 1],
  ['النظرية التوسعية لريجيلوت', 0], ['النظرية المصغّرة لميريل', 1],
];

export default function build(ctx) {
  const g = new THREE.Group(); g.position.copy(P(meta.center[0], meta.center[1])); ctx.stage.add(g);
  const seq = new Seq(), pulse = new Pulse();
  blob(g, 1.05, 0.7, 0.28);
  const base = slab(g, 0.9, 0.54, { h: 0.022, color: 0xe9f4f8, r: 0.04 }); seq.add(base, 0, 0.7, { rise: 0.05 });
  const Y0 = 0.022;
  const order = shuffled(ITEMS.map((_, i) => i), 5);

  const mkJar = (x, z, r, h, col, name, delay) => {
    const j = grp(g, x, Y0, z);
    add(j, new THREE.CylinderGeometry(r * 1.04, r * 1.08, 0.012, 40), std(0xf6efe0), 0, 0.006, 0, true);
    const liquidMat = new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.62, depthWrite: false, toneMapped: false });
    const liquid = add(j, new THREE.CylinderGeometry(r * 0.95, r * 0.95, 1, 36), liquidMat, 0, 0.012, 0); liquid.scale.y = 1e-3;
    const top = add(j, new THREE.CylinderGeometry(r * 0.95, r * 0.95, 0.002, 36), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.55, depthWrite: false }), 0, 0.012, 0);
    const wall = add(j, new THREE.CylinderGeometry(r, r, h, 40, 1, true), glass(0xdff2ff, 0.24), 0, 0.012 + h / 2, 0); wall.renderOrder = 4;
    const rim = add(j, new THREE.TorusGeometry(r, 0.004, 8, 48), brass(), 0, 0.012 + h, 0, true); rim.rotation.x = Math.PI / 2;
    const rim2 = add(j, new THREE.TorusGeometry(r * 1.03, 0.0035, 8, 48), new THREE.MeshStandardMaterial({ color: col, roughness: 0.4 }), 0, 0.016, 0); rim2.rotation.x = Math.PI / 2;
    hit(j, r * 1.1, 0, h / 2, 0); pulse.add(j, col, r * 2.6, 0, h * 0.5, 0, { op: 0.28 });
    const c = chip(name, 0, col, { k: 1.05 }); c.position.set(0, 0.035, r + 0.09); j.add(c);
    seq.add(j, delay, 0.8); seq.add(c, 1.5, 0.5);
    return { j, liquid, top, liquidMat, h, r, col, n: 0, lvl: 0, x, z, flash: 0 };
  };
  const jars = [mkJar(-0.2, -0.04, 0.17, 0.3, 0x1fb4ee, 'تصميم التعليم', 0.2), mkJar(0.27, 0.08, 0.1, 0.18, 0x6a2fa0, 'تصميم التدريس', 0.5)];

  const orbG = grp(g, 0.03, Y0 + 0.5, -0.08);
  add(orbG, new THREE.SphereGeometry(0.026, 24, 16), gloss(0xffe29a, { emissive: 0xffc94a, emissiveIntensity: 0.7 }), 0, 0, 0);
  const ring = add(orbG, new THREE.TorusGeometry(0.04, 0.0025, 8, 40), brass(), 0, 0, 0); 
  const halo = glow(0xffd27a, 0.14, 0.0); orbG.add(halo);
  orbG.scale.setScalar(1e-4); orbG.visible = false;
  hit(orbG, 0.05, 0, 0, 0);

  let qi = -1, state = 'wait', tAnim = 0, tgt = null, right = 0, ended = false, nextAt = 2.0;
  const rest = new THREE.Vector3(0.03, Y0 + 0.5, -0.08);
  const give = () => { ctx.ui.hud(ITEMS[order[qi]][0]); state = 'idle'; orbG.visible = true; tAnim = 0; };
  jars.forEach((jr, bi) => touch(ctx, jr.j, () => {
    if (state !== 'idle' || qi < 0) return;
    const bin = ITEMS[order[qi]][1];
    const ok = bin === bi; if (ok) right++;
    tgt = jars[bin]; state = 'fly'; tAnim = 0; ctx.sfx[ok ? 'good' : 'bad']?.();
    if (!ok) { jr.flash = 1; ctx.ui.toast(bin ? 'هذه من تصميم التدريس' : 'هذه من تصميم التعليم'); }
  }, 0xffd27a));

  const dest = new THREE.Vector3();
  return {
    update(t, dt, e) {
      seq.update(t, e); pulse.update(t, e);
      if (qi < 0 && t > nextAt) { qi = 0; give(); }
      ring.rotation.x = t * 1.3; ring.rotation.y = t * 0.8;
      const kApp = state === 'idle' ? Math.min(1, 0.001 + tAnim * 2.2) : 1;
      if (state === 'idle') { tAnim += dt; orbG.scale.setScalar(Math.max(1e-4, easeBack(clamp01(tAnim / 0.5)) * e)); orbG.position.set(rest.x, rest.y + Math.sin(t * 2.2) * 0.008, rest.z); halo.material.opacity = e * (0.6 + 0.25 * Math.sin(t * 3)); }
      else if (state === 'fly') {
        tAnim += dt; const k = clamp01(tAnim / 0.9);
        dest.set(tgt.x, Y0 + tgt.h + 0.06, tgt.z);
        const kk = ease(k);
        orbG.position.set(rest.x + (dest.x - rest.x) * kk, rest.y + (dest.y - rest.y) * kk + Math.sin(k * Math.PI) * 0.05, rest.z + (dest.z - rest.z) * kk);
        orbG.scale.setScalar(Math.max(1e-4, (1 - 0.55 * k) * e));
        if (k >= 1) { tgt.n++; ctx.fx.burst(at(ctx, orbG), tgt.col, 14, 0.3, 0.03); orbG.visible = false; state = 'pause'; tAnim = 0; qi++; if (qi >= ITEMS.length) { ended = true; } }
      } else if (state === 'pause') {
        tAnim += dt;
        if (tAnim > 0.7) {
          if (ended) {
            state = 'end'; ctx.ui.hud(`أصبت ${right} من ${ITEMS.length}`);
            ctx.ui.card({ tag: 'الفرق بين المفهومين', title: 'الأشمل والأضيق', body: 'تصميم التعليم نظام شامل، وتصميم التدريس نظام جزئي منه.', color: 0x1fb4ee }); ctx.ui.done();
          } else give();
        }
      }
      jars.forEach((jr) => {
        const target = jr.n / 7; jr.lvl += (target - jr.lvl) * Math.min(1, dt * 3);
        const hh = Math.max(1e-3, jr.lvl * (jr.h - 0.015)); jr.liquid.scale.y = hh; jr.liquid.position.y = 0.012 + hh / 2; jr.top.position.y = 0.012 + hh;
        jr.flash = Math.max(0, jr.flash - dt * 1.4); jr.j.position.x = jr.x + Math.sin(t * 60) * 0.004 * jr.flash;
        jr.liquidMat.opacity = 0.62 + 0.25 * jr.flash;
      });
    },
  };
}
