import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { P, ease, easeBack, clamp01, stag, mat, glossy, goldMat, shadowed, glow } from '../../kit.js?v=30';
import { animator, shadowBlob, canvasTexture, V, TAU } from '../lib/a1-kit.js?v=30';

export const meta = { free: true, center: [0.48, 0.5], typeLabel: 'لعبة قرار' };

const GOLD = 0xd4ad55, WARM = 0xffcf6a;
const ROUNDS = [
  { hud: 'طالب متوتر يعيد السؤال', opts: [
    { t: 'تنبيه علني', s: 0, fb: 'الشدة تزيد التوتر؛ والكتاب يذكر أن الرفق والتأني يورثان الطمأنينة.' },
    { t: 'استقبال هادئ', s: 2, fb: 'الرفق وحسن الاستقبال يهيئان النفس للتعلم ويجعلان معالجة المشكلة أنجح.' },
    { t: 'مراجعة وحده', s: 1, fb: 'فيه تسامح، لكنه يفوّت لحظة الحاجة المباشرة إلى العون.' }] },
  { hud: 'أنهى المهمة بأداء جيد', opts: [
    { t: 'مديح موحّد', s: 1, fb: 'التشجيع مطلوب، لكن المديح غير المحدد لا يدعّم سلوكاً بعينه.' },
    { t: 'دون تعليق', s: 0, fb: 'إغفال السلوك الجيد يفوّت فرصة تدعيمه بالثناء والتشجيع.' },
    { t: 'ثناء محدد', s: 2, fb: 'الثناء المحدد يدعّم السلوك المرغوب ويوجّه إلى العمل المهم التالي.' }] },
  { hud: 'فتور في القاعة', opts: [
    { t: 'تشديد الانضباط', s: 1, fb: 'الجدية مطلوبة، لكن غياب الحفاوة يفقد التعليم أحد مقوّماته.' },
    { t: 'جدّية وترحيب', s: 2, fb: 'الجدية سمة ثابتة، ويلازمها حسن الاستقبال وجذب النفوس إلى الحديث.' },
    { t: 'منهج هزلي', s: 0, fb: 'بعض الفكاهة لا تستدعي تحويل المنهج التربوي إلى منهج هزلي.' }] },
];
const RINGS = 6, STEP = 0.014;

function clothTex(door) {
  return canvasTexture(256, 256, (c, w, h) => {
    c.fillStyle = '#111014'; c.fillRect(0, 0, w, h);
    for (let x = 0; x < w; x += 10) { c.fillStyle = x % 20 ? 'rgba(255,255,255,.05)' : 'rgba(0,0,0,.35)'; c.fillRect(x, 0, 5, h); }
    // the gold band with a repeated motif
    c.fillStyle = '#d9b04e'; c.fillRect(0, 46, w, 44); c.fillStyle = '#8a6a1f'; c.fillRect(0, 46, w, 4); c.fillRect(0, 86, w, 4);
    for (let x = 8; x < w; x += 26) { c.fillStyle = '#8a6a1f'; c.beginPath(); c.moveTo(x, 68); c.lineTo(x + 10, 56); c.lineTo(x + 20, 68); c.lineTo(x + 10, 80); c.fill(); }
    if (door) { c.fillStyle = '#d9b04e'; c.fillRect(88, 118, 80, 138); c.fillStyle = '#a07a22'; c.fillRect(94, 124, 30, 60); c.fillRect(132, 124, 30, 60); c.fillRect(94, 192, 30, 56); c.fillRect(132, 192, 30, 56); }
  });
}
function steleTex(text) {
  return canvasTexture(256, 200, (c, w, h) => {
    c.fillStyle = '#fff6e2'; c.fillRect(0, 0, w, h);
    c.strokeStyle = '#d4ad55'; c.lineWidth = 8; c.strokeRect(10, 10, w - 20, h - 20);
    c.fillStyle = '#2b2620'; c.font = '800 54px Tajawal, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.direction = 'rtl';
    const words = text.split(' ');
    if (words.length === 1) c.fillText(text, w / 2, h / 2); else { c.fillText(words[0], w / 2, h * 0.36); c.fillText(words.slice(1).join(' '), w / 2, h * 0.66); }
  });
}

export default function build(ctx) {
  const g = new THREE.Group(); g.position.copy(P(meta.center[0], meta.center[1])); ctx.stage.add(g);
  const A = animator(ctx, g, 0.92);
  const sh = shadowBlob(1.0, 0.85, 0.3); g.add(sh);
  const BOWL = (RINGS - 1) * STEP;

  // the Kaaba: folded black cloth, a gold band with a motif, a gold door; it stands on a low stone base
  const ka = new THREE.Group(); ka.position.y = BOWL;
  const cloth = clothTex(false), clothD = clothTex(true);
  const mats = [cloth, cloth, mat(0x111014), mat(0x111014), clothD, cloth].map((t) => (t.isMaterial ? t : new THREE.MeshStandardMaterial({ map: t, roughness: 0.55 })));
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.23, 0.2), mats); body.position.y = 0.145;
  const base = new THREE.Mesh(new RoundedBoxGeometry(0.235, 0.03, 0.235, 3, 0.008), glossy(0x8d8a84, { roughness: 0.5 })); base.position.y = 0.015;
  const cap = new THREE.Mesh(new THREE.BoxGeometry(0.204, 0.006, 0.204), goldMat()); cap.position.y = 0.262;
  ka.add(body, base); shadowed(ka); A.add(ka, { at: 0.05, dur: 0.7, rise: 0.2 });
  const kg = glow(WARM, 0.6, 0.0); kg.position.y = BOWL + 0.15; g.add(kg);
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.1, 0.6, 24, 1, true), new THREE.MeshBasicMaterial({ color: WARM, transparent: true, opacity: 0, depthWrite: false, toneMapped: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending })); beam.position.y = BOWL + 0.5; g.add(beam);

  // rings of worshippers step down like a bowl: real depth, inner rings highest
  const dummy = new THREE.Object3D(), figGeo = new THREE.CapsuleGeometry(0.008, 0.017, 3, 6), rings = [];
  for (let r = 0; r < RINGS; r++) {
    const R = 0.17 + r * 0.043, n = Math.round(TAU * R / 0.02);
    const m = new THREE.MeshStandardMaterial({ color: 0x56606e, emissive: WARM, emissiveIntensity: 0, roughness: 0.6 });
    const im = new THREE.InstancedMesh(figGeo, m, n); im.frustumCulled = false; g.add(im);
    const step = new THREE.Mesh(new THREE.TorusGeometry(R + 0.02, 0.0045, 6, 90), new THREE.MeshBasicMaterial({ color: 0xb9b2a4, transparent: true, opacity: 0.55, toneMapped: false })); step.rotation.x = Math.PI / 2; step.position.y = (RINGS - 1 - r) * STEP + 0.001; g.add(step);
    rings.push({ im, R, n, y: (RINGS - 1 - r) * STEP + 0.016, lit: -9, sp: 0.1 + r * 0.01 });
  }
  const setRing = (rg, t, e, k) => {
    for (let i = 0; i < rg.n; i++) { const a = i / rg.n * TAU + t * rg.sp; dummy.position.set(Math.cos(a) * rg.R, rg.y + (rg.lit > -9 ? Math.sin(t * 3 + i * 0.7) * 0.003 * k : 0), Math.sin(a) * rg.R); dummy.rotation.y = -a; dummy.scale.setScalar(Math.max(0.0001, e)); dummy.updateMatrix(); rg.im.setMatrixAt(i, dummy.matrix); }
    rg.im.instanceMatrix.needsUpdate = true;
  };

  // the decisions: three glass steles with the choice written on them, standing in front
  let round = 0, st = [], lit = 0, finished = false, startAt = 1.2;
  const SX = [-0.3, 0, 0.3];
  const spawn = () => {
    st.forEach((o) => o.root.parent?.remove(o.root)); st = [];
    const R = ROUNDS[round]; if (!R) return; ctx.ui.hud(R.hud);
    R.opts.forEach((op, i) => {
      const root = new THREE.Group(); root.position.set(SX[i], 0, 0.5); root.scale.setScalar(0.0001);
      const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.065, 0.012, 28), goldMat()); foot.position.y = 0.008;
      const slab = new THREE.Mesh(new RoundedBoxGeometry(0.17, 0.14, 0.03, 3, 0.01), new THREE.MeshStandardMaterial({ color: 0xfff6e2, emissive: 0xffe8b0, emissiveIntensity: 0.12, roughness: 0.3 })); slab.position.y = 0.09;
      const face = new THREE.Mesh(new THREE.PlaneGeometry(0.15, 0.118), new THREE.MeshBasicMaterial({ map: steleTex(op.t), toneMapped: false })); face.position.set(0, 0.09, 0.0158);
      const rim = new THREE.Mesh(new THREE.RingGeometry(0.095, 0.105, 40), new THREE.MeshBasicMaterial({ color: GOLD, transparent: true, opacity: 0.5, side: THREE.DoubleSide, toneMapped: false, depthWrite: false })); rim.rotation.x = -Math.PI / 2; rim.position.y = 0.002;
      root.add(foot, slab, face, rim); shadowed(root); g.add(root);
      const o = { root, slab, rim, op, i, born: A.now + i * 0.12, chosen: false, dim: false }; st.push(o);
      ctx.tap(root, () => choose(o));
    });
  };
  const choose = (o) => {
    if (o.chosen || st.some((q) => q.chosen) || finished) return; o.chosen = true; ctx.sfx.pop?.();
    const s = o.op.s, col = s === 2 ? WARM : s === 1 ? 0xbcd0ff : 0x555560; o.slab.material.emissive.setHex(col); o.slab.material.emissiveIntensity = s === 2 ? 0.9 : 0.35;
    ctx.fx.burst(A.sp(o.root.position.clone().setY(0.1)), s === 2 ? WARM : 0x9aa4b8, 22, 0.35, 0.03);
    const from = lit; lit = Math.min(RINGS, lit + s); for (let r = from; r < lit; r++) rings[r].lit = A.now + (r - from) * 0.5;
    if (s > 0) ctx.sfx.good?.(); else ctx.sfx.bad?.();
    ctx.ui.card({ tag: s === 2 ? 'الأقرب إلى المنهج' : s === 1 ? 'مقبول وناقص' : 'بعيد عن المنهج', title: o.op.t, body: o.op.fb, color: s === 2 ? GOLD : s === 1 ? 0x7da0d9 : 0x8a8f9a });
    st.forEach((q) => { if (q !== o) q.dim = true; });
    setTimeout(() => { round++; if (round >= ROUNDS.length) fin(); else { startAt = A.now; spawn(); ctx.ui.hideCard(); } }, 3400);
  };
  const fin = () => {
    finished = true; st.forEach((o) => o.root.parent?.remove(o.root)); st = [];
    ctx.ui.card({ tag: 'خلاصة', title: 'الرفق والجدّية معاً', body: 'الرفق والتأني والترحيب والثناء، مع الجدية والعمل.', color: GOLD }); ctx.ui.hud(`أضأت ${['٠', '١', '٢', '٣', '٤', '٥', '٦'][lit]} من ٦ حلقات`); ctx.ui.done();
  };
  spawn();

  return {
    update(t, dt, e) {
      A.update(t, dt, e); sh.material.opacity = 0.3 * e;
      rings.forEach((rg, r) => {
        const k = clamp01((t - 0.1 - r * 0.12) / 0.6), lk = clamp01((t - rg.lit) / 0.8);
        rg.im.material.emissiveIntensity = lk * (0.9 + Math.sin(t * 2 + r) * 0.15); rg.im.material.color.setHex(lk > 0.01 ? 0xffcf6a : 0x56606e);
        setRing(rg, t, ease(k) * e, lk);
      });
      kg.material.opacity = THREE.MathUtils.damp(kg.material.opacity, Math.min(0.85, lit * 0.15), 3, dt); kg.scale.setScalar(0.4 + lit * 0.06);
      beam.material.opacity = THREE.MathUtils.damp(beam.material.opacity, lit * 0.035, 3, dt);
      st.forEach((o) => {
        const k = ease((t - Math.max(o.born, startAt)) / 0.7), s = (o.dim ? 0.8 : 1) * (o.chosen ? 1.12 : 1);
        o.root.scale.setScalar(Math.max(0.0001, k * s * 1.5)); o.root.position.y = (1 - k) * 0.1 + (o.chosen ? 0.02 : 0);
        o.root.rotation.y = Math.sin(t * 0.8 + o.i * 2) * 0.12;
        o.rim.visible = !o.chosen && !o.dim; o.rim.scale.setScalar(1 + (Math.sin(t * 3 + o.i) * 0.5 + 0.5) * 0.15);
      });
    },
  };
}
