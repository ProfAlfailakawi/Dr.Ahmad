// p162 — two nested vessels: the wide cyan bowl (تصميم التعليم) holds the small purple cup (تصميم التدريس); property tiles hover, tap the vessel they belong to.
import * as THREE from 'three';
import { P, ease, easeBack, clamp01, glow } from '../../kit.js?v=17';
import { rb, lathe, std, gloss, brass, add, grp, hit, Seq, Pulse, touch, plinth, blob, at, shuffled, TAU } from '../lib/a2.js?v=17';
import { plate, damp } from '../lib/b3-kit.js?v=17';

export const meta = { free: true, center: [0.5, 0.4], typeLabel: 'لعبة تصنيف' };

// [short tile text, bin (0 = تعليم, 1 = تدريس), exact phrase from the printed table]
const ITEMS = [
  ['نظام شامل', 0, 'نظام شامل يحتوي التدريب والتعليم والتعلم'], ['نظام جزئي', 1, 'نظام جزئي من نظام التعليم'],
  ['عمل جماعي تعاوني', 0, 'عمل جماعي تعاوني متكامل'], ['عمل فردي', 1, 'عمل فردي'],
  ['المادة التعليمية', 0, 'يرتبط بالمادة التعليمية'], ['الحصة الدراسية', 1, 'يرتبط بالحصة الدراسية'],
  ['أهداف عامة', 0, 'أهداف عامة ترتبط بالمقررات الدراسية'], ['أهداف سلوكية', 1, 'أهداف سلوكية محددة تتحقق خلال الحصة'],
  ['تقويم تكويني وختامي', 0, 'تقويم تكويني ختامي، إذ لا تطوير من دون تقويم'], ['تقويم الأهداف السلوكية', 1, 'تقويم لمدى تحقق الأهداف السلوكية لدى الطلبة'],
  ['يُجرَّب على الطلبة', 0, 'يُجرَّب المحتوى على الطلبة'], ['تغذية راجعة بالتنفيذ', 1, 'لا يُجرَّب غالباً، وتأتي التغذية الراجعة من خلال التنفيذ'],
  ['نظرية ريجلوت', 0, 'يتماشى مع النظرية التوسعية (ريجلوت)'], ['نظرية ميريل', 1, 'يتماشى مع النظرية المصغّرة (ميريل)'],
];
const CY = 0x14b4ee, PU = 0x5d2a8c;

export default function build(ctx) {
  const g = new THREE.Group(); g.position.copy(P(meta.center[0], meta.center[1])); ctx.stage.add(g);
  const seq = new Seq(), pulse = new Pulse();
  blob(g, 1.0, 0.8, 0.28, 0, 0.02);
  const base = plinth(g, 0.43, { h: 0.016 }); seq.add(base, 0.0, 0.8, { rise: 0.03 });

  // wide bowl
  const bowl = grp(g, 0, 0.016, 0);
  const bowlMat = gloss(CY, { roughness: 0.22, side: THREE.DoubleSide, emissive: CY, emissiveIntensity: 0.0 });
  add(bowl, lathe([[0, 0.0], [0.17, 0.0], [0.27, 0.026], [0.335, 0.105], [0.342, 0.122], [0.328, 0.124], [0.318, 0.108], [0.255, 0.05], [0.16, 0.026], [0, 0.026]], 72), bowlMat, 0, 0, 0, true);
  const rim = add(bowl, new THREE.TorusGeometry(0.335, 0.0075, 10, 96), brass(), 0, 0.118, 0); rim.rotation.x = Math.PI / 2;
  const bl1 = plate('تصميم التعليم', 0.2, 0.05, { fg: '#06324d', px: 512, lines: 1 }); bl1.position.set(0, 0.062, 0.314); bl1.rotation.x = -0.58; bowl.add(bl1);
  const bl2 = bl1.clone(); bl2.position.set(0, 0.062, -0.314); bl2.rotation.set(-0.58, Math.PI, 0); bowl.add(bl2);
  hit(bowl, 0.001, 0, 0, 0);
  seq.add(bowl, 0.35, 0.9, { rise: 0.06 });

  // small cup
  const cup = grp(g, 0, 0.044, 0);
  const cupMat = gloss(PU, { roughness: 0.22, side: THREE.DoubleSide, emissive: PU, emissiveIntensity: 0.0 });
  add(cup, lathe([[0, 0], [0.07, 0], [0.108, 0.05], [0.126, 0.17], [0.112, 0.172], [0.098, 0.07], [0.06, 0.03], [0, 0.03]], 56), cupMat, 0, 0, 0, true);
  const crim = add(cup, new THREE.TorusGeometry(0.119, 0.0062, 10, 64), brass(), 0, 0.171, 0); crim.rotation.x = Math.PI / 2;
  const cl1 = plate('تصميم التدريس', 0.15, 0.04, { fg: '#ffeab4', lines: 1 }); cl1.position.set(0, 0.098, 0.1215); cl1.rotation.x = -0.075; cup.add(cl1);
  const cl2 = cl1.clone(); cl2.position.set(0, 0.098, -0.1215); cl2.rotation.set(-0.075, Math.PI, 0); cup.add(cl2);
  cup.scale.setScalar(1.22); seq.add(cup, 0.75, 0.8, { rise: 0.07 });

  pulse.add(bowl, CY, 0.2, 0.26, 0.17, 0.2, { op: 0.5 });
  pulse.add(cup, PU, 0.14, 0.0, 0.2, 0.0, { op: 0.5 });
  // two quiet sparks orbit the vessels
  const sparks = [0, 1].map((i) => { const s = glow(i ? 0xffffff : 0xffd27a, 0.05, 0.9); g.add(s); return s; });

  // tile pool (one per round)
  const order = shuffled([0, 1, 2, 3, 4, 5, 6], 17).slice(0, 7).map((p, i) => { const k = (p * 7 + i * 3) % 2; return ITEMS[p * 2 + k]; });
  const tiles = order.map((it) => {
    const t = grp(g, 0, 0.5, 0.0); t.userData.big = 1.3;
    add(t, rb(0.25, 0.1, 0.014, 0.012, 3), gloss(0xfff8ea, { roughness: 0.3 }), 0, 0, 0, true);
    add(t, rb(0.262, 0.108, 0.008, 0.012, 2), brass(), 0, 0, 0);
    const a = plate(it[0], 0.23, 0.086, { fg: '#2b2620', lines: 2 }); a.position.z = 0.0105; t.add(a);
    const b = plate(it[0], 0.23, 0.086, { fg: '#2b2620', lines: 2 }); b.position.z = -0.0105; b.rotation.y = Math.PI; t.add(b);
    t.visible = false; return t;
  });
  const halo = glow(0xffd27a, 0.3, 0.0); g.add(halo);

  let ri = -1, state = 'wait', tt = 0, shake = -1, wrong = 0, cnt = [0, 0], next = 2.6, from = new THREE.Vector3(), dest = new THREE.Vector3();
  const rest = new THREE.Vector3(0, 0.5, 0.0);
  const cur = () => tiles[ri];
  const answer = (bin) => {
    if (state !== 'idle') return;
    const it = order[ri];
    if (it[1] === bin) {
      state = 'fly'; tt = 0; ctx.sfx.good?.(); from.copy(cur().position);
      const a = Math.random() * TAU;
      if (bin === 0) dest.set(Math.cos(a) * 0.235, 0.075, Math.sin(a) * 0.235); else dest.set(Math.cos(a) * 0.04, 0.12 + cnt[1] * 0.012, Math.sin(a) * 0.04);
      ctx.ui.card({ tag: 'الجدول المطبوع', title: bin ? 'تصميم التدريس' : 'تصميم التعليم', body: it[2], color: bin ? PU : CY });
    } else { shake = 0; wrong++; ctx.sfx.bad?.(); ctx.ui.toast('ليست هنا، جرّب الآخر'); }
  };
  touch(ctx, bowl, () => answer(0), CY);
  touch(ctx, cup, () => answer(1), PU);
  // an extra invisible-fat target over the cup so the thumb never misses the small vessel
  const cupHit = hit(cup, 0.14, 0, 0.1, 0); ctx.tap(cupHit, () => answer(1));

  return {
    update(t, dt, e) {
      seq.update(t, e); pulse.update(t, e);
      sparks.forEach((s, i) => { const a = t * (0.7 + i * 0.25) + i * 3.1, r = 0.37 + i * 0.05; s.position.set(Math.cos(a) * r, 0.2 + Math.sin(t * 1.3 + i) * 0.04 + i * 0.05, Math.sin(a) * r); s.material.opacity = 0.8 * e; });
      bowlMat.emissiveIntensity = damp(bowlMat.emissiveIntensity, 0.06 + 0.22 * cnt[0] / 4, 4, dt);
      cupMat.emissiveIntensity = damp(cupMat.emissiveIntensity, 0.06 + 0.25 * cnt[1] / 4, 4, dt);
      if (state === 'wait' && t > next) { ri = 0; state = 'appear'; tt = 0; cur().visible = true; ctx.ui.hud('أين تنتمي هذه الخاصية؟'); }
      if (state === 'appear' || state === 'idle') {
        tt += dt; const T = cur(), k = easeBack(clamp01(tt / 0.6)) * e;
        T.scale.setScalar(Math.max(k * 1.3, 1e-4)); let sx = 0;
        if (shake >= 0) { shake += dt; sx = Math.sin(shake * 60) * 0.012 * (1 - clamp01(shake / 0.4)); if (shake > 0.45) shake = -1; }
        T.position.set(rest.x + sx, rest.y + Math.sin(t * 1.9) * 0.012, rest.z); T.rotation.y = Math.sin(t * 0.9) * 0.28;
        halo.position.set(rest.x, rest.y, rest.z); halo.material.opacity = (0.45 + 0.2 * Math.sin(t * 3)) * e * k;
        if (state === 'appear' && tt > 0.6) state = 'idle';
      } else if (state === 'fly') {
        tt += dt; const T = cur(), k = clamp01(tt / 0.75), kk = ease(k);
        T.position.set(from.x + (dest.x - from.x) * kk, from.y + (dest.y - from.y) * kk + Math.sin(k * Math.PI) * 0.12, from.z + (dest.z - from.z) * kk);
        T.scale.setScalar(Math.max((1.3 - 1.0 * kk) * e, 1e-4)); T.rotation.set(kk * 1.3, T.rotation.y + dt * 5, 0); halo.material.opacity *= 0.8;
        if (k >= 1) {
          const bin = order[ri][1]; cnt[bin]++; state = 'pause'; tt = 0; T.rotation.set(1.3 + ri * 0.4, ri, 0.3);
          ctx.fx.burst(dest.clone().add(g.position), bin ? PU : CY, 14, 0.3, 0.028);
        }
      } else if (state === 'pause') {
        tt += dt;
        if (tt > 2.3) {
          ctx.ui.hideCard(); ri++;
          if (ri >= tiles.length) { state = 'end'; ctx.ui.hud('الأوسع يحتوي الأضيق'); ctx.ui.done(); halo.material.opacity = 0; }
          else { state = 'appear'; tt = 0; tiles[ri].visible = true; tiles[ri].scale.setScalar(1e-4); }
        }
      }
    },
  };
}
