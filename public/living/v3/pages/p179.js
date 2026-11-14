// p179 — "theory" as a crystal lantern held by four brass instruments (collect, explain, predict, guide); a situation appears, tap the instrument that performs that function and a light beam feeds the crystal.
import * as THREE from 'three';
import { P, ease, easeBack, clamp01, glow, lightTube } from '../../kit.js?v=37';
import { rb, lathe, std, gloss, brass, add, grp, hit, Seq, Pulse, touch, plinth, blob, at, shuffled, TAU } from '../lib/a2.js?v=37';
import { plate, damp } from '../lib/b3-kit.js?v=37';

export const meta = { free: true, center: [0.39, 0.66], typeLabel: 'أسئلة تطبيقية' };

const F = [
  { k: 'collect', t: 'تجميع الحقائق', col: 0x3a7bd5, x: 0.14, z: 0.13, hi: 0, q: 'معلم يجمع ملاحظات في إطار واحد', title: 'تجميع الحقائق', body: 'تجمع النظرية الحقائق والمفاهيم والمبادئ في بناء منظم منسق، فيصير لها معنى وقيمة.' },
  { k: 'explain', t: 'تفسير الظواهر', col: 0xe8a020, x: -0.14, z: 0.13, hi: 0, q: 'باحث يسأل عن سبب ظاهرة تعلّم', title: 'التفسير', body: 'تقدّم النظرية توضيحاً وتفسيراً لعدد من الظواهر والأحداث الطبيعية والإنسانية والكونية.' },
  { k: 'predict', t: 'التنبؤ', col: 0xd9483b, x: 0.14, z: -0.13, hi: 0.03, q: 'باحث يتوقع النتيجة قبل التجريب', title: 'التنبؤ', body: 'تساعد في التنبؤ بالظواهر وتوقع حدوثها أو عدمه في ظل معطيات ومؤشرات معينة.' },
  { k: 'guide', t: 'توجيه البحث', col: 0x2fa36b, x: -0.14, z: -0.13, hi: 0.03, q: 'باحث يحتاج موجّهاً لإجراءات بحثه', title: 'توجيه الفكر العلمي', body: 'هي بمثابة الموجّه لإجراءات البحث العلمي وعمليات الاستدلال العقلي.' },
];
const CRY_Y = 0.3;

function gearGeo(R = 0.05, r = 0.039, n = 10) {
  const s = new THREE.Shape();
  for (let i = 0; i < n * 4; i++) {
    const a = (i / (n * 4)) * TAU, rr = (i % 4 === 1 || i % 4 === 2) ? R : r;
    const x = Math.cos(a) * rr, y = Math.sin(a) * rr; i ? s.lineTo(x, y) : s.moveTo(x, y);
  }
  const h = new THREE.Path(); h.absarc(0, 0, 0.014, 0, TAU, true); s.holes.push(h);
  return new THREE.ExtrudeGeometry(s, { depth: 0.014, bevelEnabled: true, bevelSize: 0.003, bevelThickness: 0.003, bevelSegments: 2, curveSegments: 6 });
}

export default function build(ctx) {
  const g = new THREE.Group(); g.position.copy(P(meta.center[0], meta.center[1])); ctx.stage.add(g); g.scale.setScalar(1.1);
  const seq = new Seq(), pulse = new Pulse();
  blob(g, 0.8, 0.7, 0.3, 0, 0);
  const base = plinth(g, 0.3, { h: 0.018 }); seq.add(base, 0.0, 0.8, { rise: 0.03 });
  // orbit ring + spokes on the plinth
  const ring = add(g, new THREE.TorusGeometry(0.2, 0.004, 8, 80), brass(), 0, 0.03, 0); ring.rotation.x = Math.PI / 2; seq.add(ring, 0.4, 0.8, { rise: 0.02 });
  // central column + crystal cradle
  const col = grp(g, 0, 0.018, 0);
  add(col, lathe([[0, 0], [0.045, 0], [0.05, 0.012], [0.03, 0.03], [0.018, 0.1], [0.022, 0.2], [0.04, 0.245], [0.0, 0.245]], 40), std(0xf1e6cf, { roughness: 0.45 }), 0, 0, 0, true);
  const cr = add(col, new THREE.TorusGeometry(0.043, 0.0048, 8, 40), brass(), 0, 0.247, 0); cr.rotation.x = Math.PI / 2;
  seq.add(col, 0.5, 0.9, { rise: 0.06 });
  const crystalMat = new THREE.MeshPhysicalMaterial({ color: 0xffa51f, emissive: 0xff7a00, emissiveIntensity: 0.25, roughness: 0.2, metalness: 0.0, transparent: true, opacity: 0.95, clearcoat: 0.3, flatShading: true });
  const crystal = grp(g, 0, CRY_Y + 0.0, 0);
  add(crystal, new THREE.OctahedronGeometry(0.075, 0), crystalMat, 0, 0, 0, true).scale.set(0.85, 1.25, 0.85);
  const cHalo = glow(0xffb040, 0.4, 0.55); crystal.add(cHalo);
  seq.add(crystal, 1.1, 1.0, { rise: 0.08 });

  // the four instruments
  const inst = F.map((f, i) => {
    const s = grp(g, f.x, 0.018 + f.hi, f.z);
    const ped = add(s, rb(0.16, 0.062, 0.1, 0.012, 3), gloss(f.col, { roughness: 0.3 }), 0, 0.031, 0, true);
    add(s, rb(0.168, 0.006, 0.108, 0.004, 2), brass(), 0, 0.064, 0);
    const p1 = plate(f.t, 0.146, 0.05, { fg: '#fffaf0', lines: 1 }); p1.position.set(0, 0.031, 0.0507); s.add(p1);
    const p2 = plate(f.t, 0.146, 0.05, { fg: '#fffaf0', lines: 1 }); p2.position.set(0, 0.031, -0.0507); p2.rotation.y = Math.PI; s.add(p2);
    const tool = grp(s, 0, 0.068, 0); let spin = null, bits = [];
    if (f.k === 'collect') {
      const cs = [0xe86f5a, 0x3a7bd5, 0xf2c14a, 0x56b48a, 0xb06bd0, 0xf08a4b];
      [[-0.035, 0], [0, 0], [0.035, 0], [-0.0175, 1], [0.0175, 1], [0, 2]].forEach(([x, y], j) => { const b = add(tool, rb(0.032, 0.032, 0.05, 0.006, 2), gloss(cs[j]), x, 0.016 + y * 0.033, 0, true); bits.push(b); });
    } else if (f.k === 'explain') {
      spin = add(tool, gearGeo(), std(0xe0b85e, { roughness: 0.3, metalness: 0.8 }), 0, 0.058, -0.007, true);
      add(tool, new THREE.CylinderGeometry(0.01, 0.01, 0.07, 12), std(0x6b4f3f), 0, 0.03, 0);
      const g2 = add(tool, gearGeo(0.03, 0.022, 7), std(0xc99d3e, { roughness: 0.3, metalness: 0.8 }), 0.074, 0.03, -0.007, true); bits.push(g2);
    } else if (f.k === 'predict') {
      const piv = grp(tool, 0, 0.03, 0); spin = piv;
      add(tool, new THREE.SphereGeometry(0.018, 16, 12), brass(), 0, 0.03, 0);
      add(piv, new THREE.CylinderGeometry(0.006, 0.006, 0.09, 10), std(0xf4ede0, { roughness: 0.4 }), 0.0, 0.045, 0).rotation.z = 0;
      add(piv, new THREE.ConeGeometry(0.02, 0.05, 14), gloss(0xd9483b), 0, 0.115, 0);
      add(tool, new THREE.CylinderGeometry(0.004, 0.004, 0.03, 8), std(0x6b4f3f), 0, 0.012, 0);
    } else {
      const piv = grp(tool, 0, 0.07, 0); spin = piv; piv.rotation.x = -0.5;
      add(piv, new THREE.CylinderGeometry(0.014, 0.018, 0.11, 18), std(0x2f4d46, { roughness: 0.35 }), 0, 0.0, 0).rotation.x = Math.PI / 2;
      const ln = add(piv, new THREE.TorusGeometry(0.019, 0.004, 8, 24), brass(), 0, 0, 0.056);
      add(piv, new THREE.CylinderGeometry(0.0125, 0.0125, 0.004, 18), std(0x9fe0d0, { roughness: 0.05, emissive: 0x2fa36b, emissiveIntensity: 0.5 }), 0, 0, 0.057).rotation.x = Math.PI / 2;
      [0, 1, 2].forEach((j) => { const a = j * TAU / 3 + 0.5; const l = add(tool, new THREE.CylinderGeometry(0.004, 0.004, 0.075, 6), brass(), Math.cos(a) * 0.022, 0.035, Math.sin(a) * 0.022); l.rotation.set(Math.sin(a) * 0.35, 0, -Math.cos(a) * 0.35); });
    }
    const lampG = glow(0xffc860, 0.2, 0.0); lampG.position.y = 0.09; s.add(lampG);
    hit(s, 0.085, 0, 0.06, 0);
    pulse.add(s, f.col, 0.2, 0, 0.1, 0, { op: 0.4 });
    s.scale.setScalar(1.08); seq.add(s, 0.8 + i * 0.25, 0.8, { rise: 0.07 });
    // spoke from the ring to the pedestal
    const sp = new THREE.CatmullRomCurve3([new THREE.Vector3(f.x * 0.6, 0.075, f.z * 0.6), new THREE.Vector3(f.x * 0.3, 0.2, f.z * 0.3), new THREE.Vector3(0, CRY_Y - 0.03, 0)]);
    const beam = lightTube(sp, { radius: 0.006, color: f.col, speed: 0.8 }); beam.userData.fill(0); g.add(beam);
    return { f, s, spin, bits, lampG, beam, fill: 0, solved: false, shake: -1, boost: 0, base: tool };
  });

  const order = shuffled([0, 1, 2, 3], 5);
  let qi = -1, state = 'wait', tt = 0, solved = 0, energy = 0.25;
  const ask = () => { state = 'idle'; ctx.ui.hud(F[order[qi]].q); };
  inst.forEach((it, i) => touch(ctx, it.s, () => {
    if (state !== 'idle') return;
    if (order[qi] === i) {
      it.solved = true; it.boost = 1; solved++; state = 'pause'; tt = 0; ctx.sfx.good?.();
      ctx.ui.card({ tag: 'وظيفة النظرية', title: it.f.title, body: it.f.body, color: it.f.col });
      ctx.fx.burst(new THREE.Vector3(0, CRY_Y + 0.0, 0).add(g.position), it.f.col, 18, 0.35, 0.03);
    } else { it.shake = 0; ctx.sfx.bad?.(); ctx.ui.toast('ليست هذه الوظيفة'); }
  }, F[i].col));

  return {
    update(t, dt, e) {
      seq.update(t, e); pulse.update(t, e);
      energy = damp(energy, 0.25 + solved * 0.25, 2, dt);
      crystal.rotation.y = t * (0.5 + solved * 0.35); crystal.position.y = CRY_Y + Math.sin(t * 1.6) * 0.008;
      crystalMat.emissiveIntensity = 0.2 + energy * (0.6 + 0.2 * Math.sin(t * 3)); cHalo.material.opacity = (0.12 + energy * 0.3) * e; cHalo.scale.setScalar(0.24 + energy * 0.14);
      inst.forEach((it, i) => {
        it.boost = damp(it.boost, 0, 1.2, dt); let sx = 0;
        if (it.shake >= 0) { it.shake += dt; sx = Math.sin(it.shake * 60) * 0.008 * (1 - clamp01(it.shake / 0.4)); if (it.shake > 0.45) it.shake = -1; }
        it.s.position.x = it.f.x + sx;
        it.fill = damp(it.fill, it.solved ? 1 : 0, 1.8, dt); it.beam.userData.fill(it.fill * e); it.beam.userData.update(dt);
        it.lampG.material.opacity = (it.solved ? 0.75 : 0) * e * (0.8 + 0.2 * Math.sin(t * 3 + i));
        const k = it.f.k, b = it.boost;
        if (k === 'explain') { it.spin.rotation.z = t * (0.6 + b * 6 + (it.solved ? 0.8 : 0)); it.bits[0].rotation.z = -t * (1.0 + b * 8) + 0.3; }
        else if (k === 'predict') it.spin.rotation.z = -0.5 + Math.sin(t * 1.4) * 0.35 - (it.solved ? 0.4 : 0) + b * Math.sin(t * 20) * 0.2;
        else if (k === 'guide') { it.spin.rotation.x = -0.5 - Math.sin(t * 0.9) * 0.18 - b * 0.4; it.spin.rotation.y = Math.sin(t * 0.7) * 0.5; }
        else it.bits.forEach((c, j) => { c.position.z = Math.sin(t * 2 + j) * 0.002; c.scale.y = 1 + b * 0.25 * Math.sin(t * 16 + j * 1.3); });
      });
      if (state === 'wait' && t > 3.2) { qi = 0; ask(); }
      if (state === 'pause') {
        tt += dt;
        if (tt > 2.6) {
          ctx.ui.hideCard(); qi++;
          if (qi >= 4) { state = 'end'; ctx.ui.card({ tag: 'تكنولوجيا التعليم', title: 'أوسع من الأجهزة', body: 'مفهومها لا يقتصر على معدات وأجهزة، بل يتسع لتطبيق فكر النظم في تصميم البرامج وتقويمها وتطويرها.', color: 0xd4ad55 }); ctx.ui.hud('النظرية تضيء الطريق'); ctx.ui.done(); }
          else ask();
        }
      }
    },
  };
}
