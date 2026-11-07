// p193 — Gagné's nine events as nine stepped tiles (a terraced block): each yellow event tile carries a salmon core, the inner process it serves; a spark of attention counts 1 to 9 and ignites them.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { P, ease, easeBack, clamp01, stag, mat, glossy, goldMat, shadowed } from '../../kit.js?v=15';
import { softLight } from '../../v2/common.js?v=15';
import { hints, finder, toAr, slabText, blobShadow } from '../lib/a3-kit.js?v=15';

export const meta = { free: true, center: [0.5, 0.5], typeLabel: 'أحداث التعليم' };

const EV = [
  ['اجذب الانتباه', 'تنشيط محفزات الاستقبال'],
  ['أعلم المتعلمين بالأهداف', 'خلق مستوى توقعات للتعلم'],
  ['استدعِ المعلومات السابقة', 'تنشيط ذاكرة المدى القصير'],
  ['اعرض المحتوى', 'فهم انتقائي للمحتوى'],
  ['وفّر التوجيه للمتعلم', 'ترميز معنوي في الذاكرة طويلة الأمد'],
  ['أثِر أداء المتعلم', 'تقديم أجوبة للتأكد من حدوث التعلم'],
  ['قدّم التغذية الراجعة', 'تعزيز وتقييم الأداء الصحيح'],
  ['قيّم الأداء', 'استرجاع المحتوى وتعزيزه كتقييم نهائي'],
  ['عزّز الاحتفاظ والتطبيق', 'استرجاع المهارة وتعميمها في ظروف جديدة'],
];
const C = (h) => new THREE.Color(h);
const OFF_BODY = C(0xc9c6dc), OFF_TOP = C(0xe9e4cf), OFF_CORE = C(0xe8d3c8);
const ON_BODY = [C(0x7b7fc9), C(0x9a6fc0), C(0xd04a9c)], ON_TOP = C(0xf6dc3a), ON_CORE = C(0xf0805c);

export default function build(ctx) {
  const g = new THREE.Group(); g.position.copy(P(0.5, 0.5)); ctx.stage.add(g);
  const H = hints(), found = finder(ctx, 6);
  const big = blobShadow(0.8, 0.78, 0.3); g.add(big);
  const SP = 0.205, W = 0.18;

  const tiles = EV.map((ev, i) => {
    const r = Math.floor(i / 3), c = i % 3;
    const x = (1 - c) * SP, z = (1 - r) * SP * 0.95;
    const h = 0.05 + r * 0.045;
    const grp = new THREE.Group(); grp.position.set(x, 0, z); g.add(grp);
    const bm = glossy(0xc9c6dc, { roughness: 0.4 }), tm = glossy(0xe9e4cf, { roughness: 0.35 }), cm = glossy(0xe8d3c8, { roughness: 0.3 });
    const body = new THREE.Mesh(new RoundedBoxGeometry(W, h, W, 4, 0.016), bm); body.position.y = h / 2; grp.add(body);
    const top = new THREE.Mesh(new RoundedBoxGeometry(W * 1.03, 0.018, W * 1.03, 3, 0.008), tm); top.position.y = h + 0.006; grp.add(top);
    const core = new THREE.Mesh(new THREE.CylinderGeometry(0.052, 0.056, 0.014, 40), cm); core.position.y = h + 0.021; grp.add(core);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.057, 0.0034, 8, 48), goldMat()); ring.rotation.x = Math.PI / 2; ring.position.y = h + 0.0265; grp.add(ring);
    const num = slabText(toAr(i + 1), 0.07, 0.048, { fg: '#ffffff', bg: '#d0287f', size: 0.78 }); num.material.polygonOffset = false; num.position.set(0, h + 0.0158, W * 0.34); num.position.y = h + 0.0165; grp.add(num);
    const face = slabText(toAr(i + 1), 0.06, 0.05, { fg: '#ffffff', bg: '#d0287f', flat: false, size: 0.8 }); face.material.polygonOffset = false; face.position.set(0, h * 0.45, W / 2 + 0.002); grp.add(face);
    shadowed(grp);
    const halo = softLight(0xffd27a, 0.3, 0); halo.position.y = h + 0.05; grp.add(halo);
    ctx.tap(grp, () => pick(i));
    const hint = H.add(grp, 0xffd27a, 0.2, [0, h + 0.04, 0], 5.2 + i * 0.1);
    return { i, x, z, h, grp, bm, tm, cm, halo, lit: 0, pop: 0, popTo: 0, hint, bodyOn: ON_BODY[r], born: 0.15 + i * 0.1 };
  });
  const orb = new THREE.Mesh(new THREE.SphereGeometry(0.028, 22, 16), glossy(0xfff0b0, { emissive: 0xffc24a, emissiveIntensity: 0.9 })); g.add(orb);
  orb.add(softLight(0xffc24a, 0.2, 0.7));

  let tgt = -1, p = 1, now = 0, autoUntil = 5.2, last = 0;
  const from = new THREE.Vector3(), to = new THREE.Vector3(), q = new THREE.Vector3();
  const topOf = (i, out) => out.set(tiles[i].x, tiles[i].h + 0.1 + tiles[i].pop * 0.06, tiles[i].z);
  from.set(tiles[0].x, 0.3, tiles[0].z); orb.position.copy(from);
  function goTo(i) { if (i === last && p >= 1 && tgt >= 0) { tgt = i; return; } from.copy(orb.position); topOf(i, to); p = 0; tgt = i; last = i; }
  function pick(i) {
    const f = tiles[i]; ctx.sfx.pop?.(); f.popTo = 1; autoUntil = 0; goTo(i);
    ctx.fx.burst(new THREE.Vector3(f.x, f.h + 0.05, f.z).add(g.position), 0xffd27a, 16, 0.3, 0.03);
    ctx.ui.card({ tag: `الحدث ${toAr(i + 1)} من ٩`, title: EV[i][0], body: `العملية الداخلية: ${EV[i][1]}.`, color: 0xe3188c });
    f.hint.calm = true; found(i);
    ctx.ui.hud('كل حدث يخدم عملية داخلية في عقل المتعلم');
  }
  ctx.ui.hud('انظر كيف تشتعل الأحداث التسعة');
  return {
    update(t, dt, e) {
      now = t;
      big.material.opacity = 0.3 * e;
      if (t < autoUntil) { const k = Math.floor((t - 0.8) / 0.42); const n = Math.max(-1, Math.min(8, k)); if (n !== tgt && n >= 0) goTo(n); }
      tiles.forEach((f, i) => {
        const gk = Math.max(stag(t, f.born, 0.7, easeBack) * e, 0.001); f.grp.scale.setScalar(gk);
        const on = t < autoUntil ? (i <= tgt ? 1 : 0) : 1;
        f.lit += (on - f.lit) * Math.min(1, dt * 6);
        f.bm.color.copy(OFF_BODY).lerp(f.bodyOn, f.lit); f.tm.color.copy(OFF_TOP).lerp(ON_TOP, f.lit); f.cm.color.copy(OFF_CORE).lerp(ON_CORE, f.lit);
        f.cm.emissive.setHex(0xf0805c); f.cm.emissiveIntensity = f.lit * 0.25 + (i === tgt ? 0.35 : 0);
        f.pop += (f.popTo - f.pop) * Math.min(1, dt * 7); if (f.popTo === 1 && f.pop > 0.97) f.popTo = 0;
        f.grp.position.y = f.pop * 0.05; f.grp.rotation.y = Math.sin(f.pop * Math.PI) * 0.25;
        f.halo.material.opacity = (i === tgt ? 0.22 : 0) * f.lit * e;
      });
      if (p < 1) { p = Math.min(1, p + dt / 0.38); topOf(tgt, to); q.lerpVectors(from, to, ease(p)); q.y += Math.sin(p * Math.PI) * 0.07; orb.position.copy(q); }
      else { topOf(tgt < 0 ? 0 : tgt, to); orb.position.copy(to); orb.position.y += Math.sin(t * 5) * 0.006; }
      orb.scale.setScalar(Math.max(stag(t, 0.5, 0.5, easeBack) * e, 0.001)); orb.rotation.y += dt * 3;
      H.update(t, e);
    },
  };
}
