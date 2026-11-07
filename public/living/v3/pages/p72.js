import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { P, ease, easeBack, clamp01, stag, mat, glossy, goldMat, shadowed, glow } from '../../kit.js?v=15';
import { animator, shadowBlob, V, TAU } from '../lib/a1-kit.js?v=15';

export const meta = { free: true, center: [0.48, 0.5], typeLabel: 'لعبة قرار' };

const GOLD = 0xd4ad55, WARM = 0xffd27a;
const ROUNDS = [
  { hud: 'طالب متوتر يعيد السؤال', opts: [
    { t: 'تنبيه علني', s: 0, fb: 'الشدة تزيد التوتر؛ والكتاب يذكر أن الرفق والتأني يورثان الطمأنينة.' },
    { t: 'استقبال هادئ', s: 2, fb: 'الرفق وحسن الاستقبال يهيئان النفس للتعلم ويجعلان معالجة المشكلة أنجح.' },
    { t: 'مراجعة وحده', s: 1, fb: 'فيه تسامح، لكنه يفوّت لحظة الحاجة المباشرة إلى العون.' }] },
  { hud: 'أنهى المهمة بأداء جيد', opts: [
    { t: 'مديح موحّد', s: 1, fb: 'التشجيع مطلوب، لكن المديح غير المحدد لا يدعّم سلوكاً بعينه.' },
    { t: 'دون تعليق', s: 0, fb: 'إغفال السلوك الجيد يفوّت فرصة تدعيمه بالثناء والتشجيع.' },
    { t: 'ثناء محدد وتوجيه', s: 2, fb: 'الثناء المحدد يدعّم السلوك المرغوب ويوجّه إلى العمل المهم التالي.' }] },
  { hud: 'فتور في القاعة', opts: [
    { t: 'تشديد الانضباط', s: 1, fb: 'الجدية مطلوبة، لكن غياب الحفاوة يفقد التعليم أحد مقوّماته.' },
    { t: 'جدّية وترحيب', s: 2, fb: 'الجدية سمة ثابتة، ويلازمها حسن الاستقبال وجذب النفوس إلى الحديث.' },
    { t: 'منهج هزلي', s: 0, fb: 'بعض الفكاهة لا تستدعي تحويل المنهج التربوي إلى منهج هزلي.' }] },
];
const RINGS = 6;

export default function build(ctx) {
  const g = new THREE.Group(); g.position.copy(P(meta.center[0], meta.center[1])); ctx.stage.add(g);
  const A = animator(ctx, g, 1.0);
  const sh = shadowBlob(0.8, 0.7, 0.28); g.add(sh);

  // the Kaaba: black cloth, a gold band, a gold door
  const ka = new THREE.Group(); ka.position.y = 0.012;
  const body = new THREE.Mesh(new RoundedBoxGeometry(0.105, 0.125, 0.105, 3, 0.004), glossy(0x17161a, { roughness: 0.45, clearcoat: 0.3 })); body.position.y = 0.0625;
  const band = new THREE.Mesh(new RoundedBoxGeometry(0.108, 0.02, 0.108, 3, 0.003), goldMat()); band.position.y = 0.092;
  const door = new THREE.Mesh(new RoundedBoxGeometry(0.026, 0.05, 0.004, 2, 0.001), goldMat()); door.position.set(0.0, 0.04, 0.054);
  ka.add(body, band, door); shadowed(ka); ka.scale.setScalar(2.0); A.add(ka, { at: 0.1, dur: 0.8, rise: 0.15 });
  const kg = glow(WARM, 0.35, 0.0); kg.position.y = 0.07; g.add(kg);

  // rings of worshippers: instanced little figures, dim until a gentle decision lights them
  const dummy = new THREE.Object3D(), figGeo = new THREE.CapsuleGeometry(0.0072, 0.015, 3, 6);
  const rings = [];
  for (let r = 0; r < RINGS; r++) {
    const R = 0.12 + r * 0.034, n = Math.round(TAU * R / 0.0155);
    const m = new THREE.MeshStandardMaterial({ color: 0x56606e, emissive: WARM, emissiveIntensity: 0, roughness: 0.6 });
    const im = new THREE.InstancedMesh(figGeo, m, n); im.frustumCulled = false; g.add(im);
    rings.push({ im, R, n, lit: -9, sp: 0.12 + r * 0.012 });
  }
  const setRing = (rg, t, e, k) => {
    for (let i = 0; i < rg.n; i++) { const a = i / rg.n * TAU + t * rg.sp * (rg.R < 0.2 ? 1 : 0.9); const bob = rg.lit > -9 ? Math.sin(t * 3 + i * 0.7) * 0.0025 * k : 0; dummy.position.set(Math.cos(a) * rg.R, 0.02 + bob, Math.sin(a) * rg.R); dummy.rotation.y = -a; dummy.scale.setScalar(Math.max(0.0001, e)); dummy.updateMatrix(); rg.im.setMatrixAt(i, dummy.matrix); }
    rg.im.instanceMatrix.needsUpdate = true;
  };

  // decision orbs
  let round = 0, orbs = [], score = 0, lit = 0, finished = false, startAt = 3.2;
  const OPX = [-0.25, 0, 0.25], TINT = [0xb7c3d6, 0xd9cdb4, 0xbfd4cf];
  const spawn = () => {
    orbs.forEach((o) => { o.root.parent?.remove(o.root); o.tag.parent?.remove(o.tag); });
    orbs = []; const R = ROUNDS[round]; if (!R) return;
    ctx.ui.hud(R.hud);
    R.opts.forEach((op, i) => {
      const root = new THREE.Group(); root.position.set(OPX[i], 0.12, 0.27); root.scale.setScalar(0.0001);
      const sh = new THREE.Mesh(new THREE.SphereGeometry(0.058, 32, 22), new THREE.MeshPhysicalMaterial({ color: TINT[i], roughness: 0.05, transparent: true, opacity: 0.55, clearcoat: 1 }));
      const core = new THREE.Mesh(new THREE.SphereGeometry(0.026, 20, 14), new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: TINT[i], emissiveIntensity: 0.5, roughness: 0.3 }));
      const base = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.08, 8), goldMat()); base.position.y = -0.06;
      root.add(sh, core, base); g.add(root);
      const tag = A.tag(op.t, 0, GOLD, V(OPX[i], 0.34 + (i === 1 ? 0.1 : 0), 0.27), { at: A.now + 0.4 + i * 0.1 });
      const ring = new THREE.Mesh(new THREE.RingGeometry(0.07, 0.078, 40), new THREE.MeshBasicMaterial({ color: GOLD, transparent: true, opacity: 0.5, side: THREE.DoubleSide, toneMapped: false, depthWrite: false })); root.add(ring);
      const o = { root, sh, core, ring, op, tag, i, born: A.now + i * 0.12, chosen: false, ok: false }; orbs.push(o);
      ctx.tap(root, () => choose(o));
    });
  };
  const choose = (o) => {
    if (o.chosen || orbs.some((q) => q.chosen) || finished) return; o.chosen = true; ctx.sfx.pop?.();
    const s = o.op.s; score += s; o.core.material.emissive.setHex(s === 2 ? WARM : s === 1 ? 0xbcd0ff : 0x555560); o.core.material.emissiveIntensity = s === 2 ? 1.4 : 0.6;
    ctx.fx.burst(A.sp(o.root.position), s === 2 ? WARM : 0x9aa4b8, 22, 0.35, 0.03);
    const from = lit; lit = Math.min(RINGS, lit + s); for (let r = from; r < lit; r++) rings[r].lit = A.now + (r - from) * 0.5;
    if (s > 0) ctx.sfx.good?.(); else ctx.sfx.bad?.();
    ctx.ui.card({ tag: s === 2 ? 'الأقرب إلى المنهج' : s === 1 ? 'مقبول وناقص' : 'بعيد عن المنهج', title: o.op.t, body: o.op.fb, color: s === 2 ? GOLD : s === 1 ? 0x7da0d9 : 0x8a8f9a });
    orbs.forEach((q) => { if (q !== o) { q.dim = true; } });
    setTimeout(() => { round++; if (round >= ROUNDS.length) fin(); else { startAt = A.now; spawn(); ctx.ui.hideCard(); } }, 3400);
  };
  const fin = () => {
    finished = true; orbs.forEach((o) => { o.root.parent?.remove(o.root); o.tag.parent?.remove(o.tag); }); orbs = [];
    ctx.ui.card({ tag: 'خلاصة', title: 'الرفق والجدّية معاً', body: 'الرفق والتأني والترحيب والثناء، مع الجدية والعمل.', color: GOLD }); ctx.ui.hud(`أضأت ${['٠', '١', '٢', '٣', '٤', '٥', '٦'][lit]} من ٦ حلقات`); ctx.ui.done();
  };
  spawn(); startAt = 1.4;

  return {
    update(t, dt, e) {
      A.update(t, dt, e);
      rings.forEach((rg, r) => {
        const k = clamp01((t - 0.2 - r * 0.15) / 0.7), lk = clamp01((t - rg.lit) / 0.8);
        rg.im.material.emissiveIntensity = lk * (0.9 + Math.sin(t * 2 + r) * 0.15); rg.im.material.color.setHex(lk > 0.01 ? 0xffcf6a : 0x56606e);
        setRing(rg, t, ease(k) * e, lk);
      });
      kg.material.opacity = THREE.MathUtils.damp(kg.material.opacity, Math.min(0.8, lit * 0.14), 3, dt); kg.scale.setScalar(0.3 + lit * 0.03);
      orbs.forEach((o) => {
        const k = ease((t - Math.max(o.born, startAt)) / 0.8); const out = o.dim ? 0.45 : 1;
        o.root.scale.setScalar(Math.max(0.0001, k * (o.chosen ? 1.25 : out) * (1 + Math.sin(t * 2 + o.i) * 0.02)));
        o.root.position.y = 0.12 + Math.sin(t * 1.4 + o.i * 2) * 0.006 + (1 - k) * 0.08 + (o.chosen ? 0.04 : 0);
        o.ring.visible = !o.chosen && !o.dim; o.ring.rotation.x = Math.PI / 2; o.ring.scale.setScalar(1 + (Math.sin(t * 3 + o.i) * 0.5 + 0.5) * 0.18);
        o.tag.position.set(o.root.position.x, 0.34 + (o.i === 1 ? 0.1 : 0) + (o.chosen ? 0.04 : 0), 0.27); o.tag.userData.hide = !!o.dim;
      });
    },
  };
}
