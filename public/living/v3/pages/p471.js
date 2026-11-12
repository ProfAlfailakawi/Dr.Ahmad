// p471 — «أن توقد شمعة خير من أن تلعن الظلام»: a brass candelabra whose six candles are the solutions; touch a candle to light it.
import * as THREE from 'three';
import { P, ease, easeBack, clamp01, stag, mat, goldMat, shadowed, glow } from '../../kit.js?v=29';
import { inked } from '../../pencil.js?v=29';
import { lightPool } from '../../v2/common.js?v=29';
import { Seq, Hints, Tag, TAU, V, wpos, softShadow } from '../lib/a9-kit.js?v=29';

export const meta = { free: true, center: [0.27, 0.42], typeLabel: 'شمعدان الحلول', title: 'أنِر شموع الحلول' };

const SOL = [
  { t: 'مراكز البحث', tag: 'مراكز البحث', b: 'تدعيم مراكز البحث بالإمكانات المادية والبشرية المتخصصة، مع تنسيق سبل الاتصال والتعاون بينها.', c: 0xef8f2a },
  { t: 'إنتاج محلي أم استيراد؟', tag: 'محلي أم مستورد؟', b: 'تصنيف البرمجيات والوسائل التعليمية إلى ما يمكن إنتاجه محلياً وما يتطلب الاستيراد من الخارج.', c: 0x2a8fd0 },
  { t: 'الكوادر الفنية', tag: 'كوادر فنية', b: 'إعداد الكوادر الفنية المتخصصة لتدريس البرمجيات التطبيقية وغيرها من الوسائط.', c: 0x2fae8f },
  { t: 'تدعيم أقسام الوسائط', tag: 'أقسام الوسائط', b: 'تدعيم أقسام الوسائط التعليمية والبرمجيات بالإمكانات المادية والبشرية.', c: 0xd4ad55 },
  { t: 'الابتكار', tag: 'الابتكار', b: 'زيادة التأكيد على الابتكار هي أول الحلول، بحسب الزهراني وليفنغستون.', c: 0xe0562f },
  { t: 'تحليل المناهج', tag: 'تحليل المناهج', b: 'تحليل المناهج والمقررات تحليلاً علمياً وموضوعياً بواسطة لجنة من الأخصائيين.', c: 0x8fa6b5 },
];

export default function build(ctx) {
  const g = new THREE.Group(); g.position.copy(P(meta.center[0], meta.center[1])); ctx.stage.add(g); g.scale.setScalar(1.5);
  const seq = new Seq(), hints = new Hints(g, 5.0), tag = new Tag(g, 0.18);
  const brass = goldMat();
  const waxM = mat(0xf6efdc, { roughness: 0.5 });
  const R = 0.15, CY = 0.085; // ring radius, cup height

  const shadow = softShadow(0.36, 0.34, 0.3); g.add(shadow);
  const pool = lightPool(0xffc86a, 0.3, 0); pool.position.y = 0.004; g.add(pool);

  // candelabra: round foot, short stem, hub with a crown, six curved arms in one ring
  const prof = [[0, 0], [0.085, 0], [0.09, 0.007], [0.07, 0.017], [0.034, 0.03], [0.016, 0.05], [0.012, 0.062], [0.02, 0.074], [0.011, 0.088], [0.011, 0.1], [0.02, 0.11]].map(([x, y]) => new THREE.Vector2(x, y));
  const stand = new THREE.Mesh(new THREE.LatheGeometry(prof, 36), brass); g.add(shadowed(stand));
  const hub = new THREE.Mesh(new THREE.SphereGeometry(0.026, 20, 14), brass); hub.position.y = 0.12; hub.scale.set(1, 0.8, 1); g.add(hub);
  const crown = new THREE.Mesh(new THREE.ConeGeometry(0.016, 0.05, 18), brass); crown.position.y = 0.158; g.add(crown);

  const wax = new THREE.CylinderGeometry(0.02, 0.02, 0.085, 22), cupG = new THREE.CylinderGeometry(0.03, 0.017, 0.03, 20);
  const flameG = new THREE.SphereGeometry(0.013, 14, 10), hitG = new THREE.SphereGeometry(0.04, 8, 6);
  const hitM = new THREE.MeshBasicMaterial({ visible: false });
  const candles = SOL.map((s, i) => {
    const a = (i / 6) * TAU + 0.3;
    const end = V(Math.cos(a) * R, CY, Math.sin(a) * R);
    const curve = new THREE.CatmullRomCurve3([V(0, 0.12, 0), V(Math.cos(a) * R * 0.45, 0.14, Math.sin(a) * R * 0.45), V(Math.cos(a) * R * 0.92, CY + 0.012, Math.sin(a) * R * 0.92), end.clone().setY(CY - 0.02)]);
    const arm = new THREE.Mesh(new THREE.TubeGeometry(curve, 28, 0.0062, 8), brass); g.add(arm);
    const grp = new THREE.Group(); grp.position.copy(end); g.add(grp);
    const cup = new THREE.Mesh(cupG, brass); cup.position.y = -0.02; grp.add(cup);
    const w = new THREE.Mesh(wax, waxM); w.position.y = 0.04; grp.add(w);
    const flame = new THREE.Mesh(flameG, new THREE.MeshBasicMaterial({ color: 0xffd66b, toneMapped: false, transparent: true, opacity: 0.95 }));
    flame.scale.set(0.8, 1.9, 0.8); flame.position.y = 0.1; flame.visible = false; grp.add(flame);
    const hit = new THREE.Mesh(hitG, hitM); hit.position.y = 0.06; grp.add(hit);
    const halo = glow(0xffb64a, 0.2, 0); halo.position.y = 0.1; halo.raycast = () => {}; grp.add(halo);
    const hint = hints.add(end.clone().add(V(0, 0.06, 0)), 0xffd27a, 0.12);
    seq.add(arm, 1.0 + i * 0.25, 0.8); seq.add(grp, 1.4 + i * 0.25, 0.8, 0.05);
    return { grp, flame, halo, hint, lit: 0, s, i, a };
  });
  shadowed(candles[0].grp.children[1]); candles.forEach((c) => shadowed(c.grp.children[1]));
  seq.add(stand, 0.5, 0.9); seq.add(hub, 0.8, 0.7); seq.add(crown, 1.0, 0.6);

  let nLit = 0, finished = false, now = 0;
  const spark = glow(0xfff1b8, 0.09, 0); g.add(spark);
  function light(c, withCard) {
    if (!c.lit) { c.lit = now; nLit++; c.hint.on = false; ctx.sfx.good?.(); ctx.fx.burst(wpos(g, c.grp.position.clone().add(V(0, 0.1, 0))), 0xffd27a, 18, 0.25, 0.03); }
    if (withCard) {
      ctx.sfx.pop?.();
      ctx.ui.card({ tag: 'حلّ مستقبلي', title: c.s.t, body: c.s.b, color: c.s.c });
      tag.show(c.s.tag, c.grp.position.clone().add(V(0, 0.17, 0)), c.s.c);
    }
    if (nLit === 6 && !finished) { finished = true; setTimeout(() => { ctx.fx.burst(wpos(g, V(0, 0.2, 0)), 0xffd27a, 50, 0.55, 0.04); ctx.ui.done(); ctx.ui.hud('أنرتَ الحلول كلها'); }, 700); }
  }
  candles.forEach((c) => ctx.tap(c.grp, () => light(c, true)));
  ctx.ui.hud('المس شمعة لتضيء حلاً');
  let sparkDone = false;
  const c0 = candles[0], to = c0.grp.position.clone().add(V(0, 0.1, 0));

  return {
    update(t, dt, e) {
      now = t;
      seq.update(t, e); hints.update(t, e); tag.update(dt, e);
      const ps = stag(t, 1.4, 1.5, clamp01);
      if (ps > 0 && ps < 1) { // a spark drifts down and lights the first candle
        const k = ease(ps); spark.position.set(to.x * k, 0.4 * (1 - k) + to.y * k + Math.sin(k * 6) * 0.015, to.z * k); spark.material.opacity = 0.9 * e;
      } else spark.material.opacity = 0;
      if (ps >= 1 && !sparkDone) { sparkDone = true; light(c0, false); }
      for (const c of candles) {
        const on = c.lit ? ease((t - c.lit) / 0.5) : 0;
        c.flame.visible = on > 0.01;
        const fl = 1 + 0.12 * Math.sin(t * 11 + c.i * 2) + 0.07 * Math.sin(t * 17 + c.i);
        c.flame.scale.set(0.8 * on, 1.9 * on * fl, 0.8 * on);
        c.halo.material.opacity = 0.75 * on * e; c.halo.scale.setScalar(0.2 * (0.9 + 0.12 * Math.sin(t * 9 + c.i)) * Math.max(on, 0.01));
      }
      pool.material.opacity = (0.15 + 0.5 * (nLit / 6)) * Math.min(1, nLit) * e;
    },
  };
}
