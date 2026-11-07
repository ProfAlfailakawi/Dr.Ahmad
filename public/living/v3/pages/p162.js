// p162 — a small purple dome nested inside a big blue one: fourteen gems wait in front. Tap a gem to read its claim, then tap the dome it belongs to; sorted gems fill the domes.
import * as THREE from 'three';
import { P, ease, easeBack, clamp01, stag, glow } from '../../kit.js?v=16';
import { rb, lathe, std, lit, gloss, glass, brass, add, grp, hit, Seq, Pulse, touch, chip, blob, at, shuffled, TAU, INK, GOLD } from '../lib/a2.js?v=16';

export const meta = { free: true, center: [0.5, 0.42], typeLabel: 'لعبة تصنيف' };

const ITEMS = [
  ['نظام شامل يضم التدريب والتعليم', 0], ['نظام جزئي من نظام التعليم', 1], ['عمل جماعي تعاوني متكامل', 0], ['عمل فردي', 1],
  ['يرتبط بالمادة التعليمية', 0], ['يرتبط بالحصة الدراسية', 1], ['أهداف عامة للمقررات', 0], ['أهداف سلوكية خلال الحصة', 1],
  ['تقويم تكويني وختامي', 0], ['تقويم الأهداف السلوكية', 1], ['يُجرَّب المحتوى على الطلبة', 0], ['لا يُجرَّب غالباً', 1],
  ['النظرية التوسعية لريجيلوت', 0], ['النظرية المصغّرة لميريل', 1],
];
const GEM = [0xff7a59, 0xffc233, 0x4cc9a8, 0xe85d9a, 0x7aa2ff, 0xb08cff, 0xff9f4a];

export default function build(ctx) {
  const g = new THREE.Group(); g.position.copy(P(meta.center[0], meta.center[1])); ctx.stage.add(g);
  const seq = new Seq(), pulse = new Pulse();
  const Y0 = 0.0, OZ = -0.1;
  blob(g, 0.8, 0.62, 0.3, 0, OZ + 0.02);
  const order = shuffled(ITEMS.map((_, i) => i), 9);

  // ---- outer dome: a flat glowing ring on the page (tap target) + a big glass dome
  const outer = grp(g, 0, Y0, OZ);
  const ringMat = new THREE.MeshBasicMaterial({ color: 0x1fb4ee, transparent: true, opacity: 0.55, depthWrite: false, toneMapped: false, side: THREE.DoubleSide });
  const ring = add(outer, new THREE.RingGeometry(0.17, 0.34, 64), ringMat, 0, 0.004, 0); ring.rotation.x = -Math.PI / 2; ring.scale.y = 0.85;
  const oDome = add(outer, new THREE.SphereGeometry(0.34, 48, 24, 0, TAU, 0, Math.PI / 2), glass(0x9fdcff, 0.16), 0, 0.004, 0); oDome.scale.set(1, 0.62, 0.85); oDome.renderOrder = 4;
  const oRim = add(outer, new THREE.TorusGeometry(0.34, 0.005, 8, 96), brass(), 0, 0.006, 0); oRim.rotation.x = Math.PI / 2; oRim.scale.y = 0.85;
  const oLit = glow(0x1fb4ee, 0.5, 0.0); oLit.position.set(0, 0.05, 0); outer.add(oLit);
  seq.add(outer, 0.0, 0.8, { rise: 0.05 });
  // ---- inner dome: smaller, purple, nested toward the front of the big one
  const inner = grp(g, 0, Y0, OZ + 0.06);
  const iBase = add(inner, new THREE.CylinderGeometry(0.15, 0.16, 0.012, 40), std(0x6a2fa0, { roughness: 0.4 }), 0, 0.006, 0, true);
  const iDome = add(inner, new THREE.SphereGeometry(0.15, 36, 18, 0, TAU, 0, Math.PI / 2), glass(0xc9a6ff, 0.3), 0, 0.012, 0, true); iDome.scale.y = 0.75; iDome.renderOrder = 5;
  const iRim = add(inner, new THREE.TorusGeometry(0.15, 0.004, 8, 64), brass(), 0, 0.012, 0); iRim.rotation.x = Math.PI / 2;
  const iLit = glow(0x8a4fe0, 0.3, 0.0); iLit.position.set(0, 0.04, 0); inner.add(iLit);
  hit(inner, 0.14, 0, 0.05, 0);
  seq.add(inner, 0.25, 0.8, { rise: 0.06 });
  const cO = chip('تصميم التعليم', 0, 0x1fb4ee, { k: 0.95 }); cO.position.set(0, 0.2, OZ - 0.16); g.add(cO); seq.add(cO, 1.4, 0.5);
  const cI = chip('تصميم التدريس', 0, 0x8a4fe0, { k: 0.95 }); cI.position.set(0, 0.17, OZ + 0.06); g.add(cI); seq.add(cI, 1.5, 0.5);

  // ---- fourteen gems in two rows at the front
  const gems = order.map((idx, i) => {
    const row = i < 7 ? 0 : 1, col = i % 7;
    const rx = (col - 3) * 0.105 + row * 0.05, rz = 0.27 + row * 0.1;
    const holder = grp(g, 0, 0, 0);
    const gm = grp(holder, rx, Y0 + 0.04, rz);
    add(gm, new THREE.OctahedronGeometry(0.045, 0), gloss(GEM[i % GEM.length], { emissive: GEM[i % GEM.length], emissiveIntensity: 0.25 }), 0, 0, 0, true).scale.set(1, 1.25, 1);
    add(gm, new THREE.TorusGeometry(0.048, 0.003, 6, 28), brass(), 0, -0.04, 0).rotation.x = Math.PI / 2;
    hit(gm, 0.06, 0, 0, 0);
    pulse.add(gm, GEM[i % GEM.length], 0.14, 0, 0, 0, { op: 0.4 });
    seq.add(holder, 0.7 + i * 0.07, 0.6, { rise: 0.08 });
    return { gm, idx, bin: ITEMS[idx][1], rest: new THREE.Vector3(rx, Y0 + 0.04, rz), target: new THREE.Vector3(rx, Y0 + 0.04, rz), sorted: false, shake: -1, i, col: GEM[i % GEM.length] };
  });
  // slots inside the domes
  const slotsO = Array.from({ length: 7 }, (_, k) => { const a = -0.4 + k * 0.5 + Math.PI * 0.2; return new THREE.Vector3(Math.cos(a + Math.PI) * 0.25, Y0 + 0.04, OZ + Math.sin(a + Math.PI) * 0.19 - 0.02); });
  const slotsI = Array.from({ length: 7 }, (_, k) => { const a = k * TAU / 7; return new THREE.Vector3(Math.cos(a) * 0.075, Y0 + 0.04, OZ + 0.06 + Math.sin(a) * 0.075); });
  let nO = 0, nI = 0, sel = null, right = 0, firstTry = new Set(), done = 0, ended = false, flashO = 0, flashI = 0;
  const hover = new THREE.Vector3(0, Y0 + 0.4, OZ + 0.05);

  const choose = (gm) => {
    if (gm.sorted) return;
    if (sel === gm) { sel = null; gm.target.copy(gm.rest); ctx.ui.hud('اختر خاصية ثم قبّة'); return; }
    if (sel) sel.target.copy(sel.rest);
    sel = gm; gm.target.copy(hover); ctx.ui.hud(ITEMS[gm.idx][0]);
  };
  gems.forEach((o) => touch(ctx, o.gm, () => choose(o), o.col));
  const drop = (bin) => {
    if (!sel) { ctx.ui.toast('اختر خاصية أولاً'); return; }
    const o = sel;
    if (o.bin === bin) {
      if (!firstTry.has(o.i + 'x')) right++;
      o.sorted = true; sel = null; done++; o.target.copy(bin ? slotsI[nI++] : slotsO[nO++]); if (bin) flashI = 1; else flashO = 1; ctx.sfx.good?.();
      ctx.ui.hud(done < ITEMS.length ? 'أحسنت — اختر خاصية أخرى' : '');
      if (done >= ITEMS.length) { ended = true; ctx.ui.hud(`أصبت ${right} من ${ITEMS.length} من أول مرة`); ctx.ui.card({ tag: 'الفرق بين المفهومين', title: 'الأشمل والأضيق', body: 'تصميم التعليم نظام شامل، وتصميم التدريس نظام جزئي منه.', color: 0x1fb4ee }); ctx.ui.done(); }
    } else { firstTry.add(o.i + 'x'); o.shake = 0; ctx.sfx.bad?.(); ctx.ui.toast(o.bin ? 'هذه من تصميم التدريس' : 'هذه من تصميم التعليم'); sel = null; o.target.copy(o.rest); }
  };
  touch(ctx, ring, () => drop(0), 0x1fb4ee);
  touch(ctx, inner, () => drop(1), 0x8a4fe0);

  ctx.ui.hud('المس جوهرة ثم القبّة المناسبة');
  return {
    update(t, dt, e) {
      seq.update(t, e); pulse.update(t, e);
      flashO = Math.max(0, flashO - dt * 1.5); flashI = Math.max(0, flashI - dt * 1.5);
      ringMat.opacity = 0.45 + 0.1 * Math.sin(t * 2) + 0.3 * flashO; oLit.material.opacity = e * (0.18 + 0.4 * flashO); oLit.scale.setScalar(0.5 + 0.2 * flashO);
      iLit.material.opacity = e * (0.18 + 0.5 * flashI); iLit.scale.setScalar(0.3 + 0.15 * flashI);
      gems.forEach((o) => {
        const bob = o === sel ? Math.sin(t * 3) * 0.012 : 0, k = Math.min(1, dt * 7);
        o.gm.position.x += (o.target.x - o.gm.position.x) * k; o.gm.position.z += (o.target.z - o.gm.position.z) * k; o.gm.position.y += (o.target.y + bob - o.gm.position.y) * k;
        o.gm.rotation.y += dt * (o === sel ? 3 : 0.8);
        if (o.shake >= 0) { o.shake += dt; o.gm.position.x += Math.sin(o.shake * 60) * 0.004 * (1 - clamp01(o.shake / 0.5)); if (o.shake > 0.5) o.shake = -1; }
      });
    },
  };
}
