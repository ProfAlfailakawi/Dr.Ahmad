import * as THREE from 'three';
import { P, ease, easeBack, clamp01, stag, mat, glossy, goldMat, shadowed, glow } from '../../kit.js?v=40';
import { animator, shadowBlob, softLight, V, TAU } from '../lib/a1-kit.js?v=40';

export const meta = { free: true, center: [0.5, 0.72], typeLabel: 'اختبار مجسّم' };

const GOLD = 0xd9b45a, COPPER = 0xe08a2e, TEAL = 0x2fb6a8;
const Q = [
  { hud: 'هل الاتصال مجرد نقل معلومات؟', right: 1, opts: ['نقل المعلومات', 'قواعد روحية', 'بناء الأمة'], why: 'نُظِّم الاتصال وأُقيم على قواعد روحية في نماذج وطيدة الأركان تتجاوز نقل الرسالة.' },
  { hud: 'هل الاتصال شأن الفصل وحده؟', right: 1, opts: ['للمعلم وحده', 'كل الحياة', 'للاقتصاد'], why: 'حياة الإنسان الذاتية والاجتماعية والاقتصادية والعبادات لا تستقيم في غياب الاتصال.' },
  { hud: 'ما معنى «رحمة للعالمين» تربوياً؟', right: 1, opts: ['تساهل', 'تعليم الجاهل', 'لمن يرغب'], why: 'ليس هناك رحمة مثل تربية الجاهل وتعليمه.' },
];
const GEM = [0x6fb3ff, 0xff8f6b, 0x8ee07a];
const leg = (a, b, r, m) => { const d = b.clone().sub(a), l = d.length(), c = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.7, r, l, 12), m); c.position.copy(a).addScaledVector(d, 0.5); c.quaternion.setFromUnitVectors(V(0, 1, 0), d.normalize()); return c; };

export default function build(ctx) {
  const g = new THREE.Group(); g.position.copy(P(meta.center[0], meta.center[1])); ctx.stage.add(g);
  const A = animator(ctx, g, 0.85);
  const sh = shadowBlob(0.8, 0.6, 0.3); g.add(sh);

  // a brass gyroscope on a tripod: three gimbal rings, a core that wakes up with every right answer
  const tri = new THREE.Group(); const bm = goldMat();
  [90, 210, 330].forEach((d) => { const a = d * Math.PI / 180; tri.add(leg(V(0, 0.2, 0), V(Math.cos(a) * 0.2, 0, Math.sin(a) * 0.2), 0.009, bm)); });
  const hubT = new THREE.Mesh(new THREE.SphereGeometry(0.026, 18, 12), bm); hubT.position.y = 0.2; tri.add(hubT); shadowed(tri); A.add(tri, { at: 0.05, dur: 0.6, rise: 0.15 });
  const gy = new THREE.Group(); gy.position.y = 0.38;
  const ringM = (c) => new THREE.MeshStandardMaterial({ color: c, metalness: 0.85, roughness: 0.25, emissive: c, emissiveIntensity: 0.0 });
  const mA = ringM(GOLD), mB = ringM(COPPER), mC = ringM(TEAL);
  const gA = new THREE.Group(), gB = new THREE.Group(), gC = new THREE.Group();
  gA.add(new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.011, 14, 64), mA)); gB.add(new THREE.Mesh(new THREE.TorusGeometry(0.135, 0.011, 14, 64), mB)); gC.add(new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.011, 14, 64), mC));
  gA.add(gB); gB.add(gC); gy.add(gA);
  const core = new THREE.Mesh(new THREE.IcosahedronGeometry(0.05, 1), new THREE.MeshStandardMaterial({ color: 0xbfd6ee, emissive: 0x335577, emissiveIntensity: 0.6, roughness: 0.2, metalness: 0.2 })); gy.add(core);
  const halo = glow(0xffe3a0, 0.5, 0.0); gy.add(halo);
  shadowed(gy); A.add(gy, { at: 0.2, dur: 0.8, rise: 0.2 });

  // the gallows: two posts and a crossbar; three pendants hang from it
  const gal = new THREE.Group();
  [-0.31, 0.31].forEach((x) => { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.011, 0.9, 12), bm); p.position.set(x, 0.45, 0.14); const k = new THREE.Mesh(new THREE.SphereGeometry(0.018, 12, 8), bm); k.position.set(x, 0.91, 0.14); gal.add(p, k); });
  const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.62, 10), bm); bar.rotation.z = Math.PI / 2; bar.position.set(0, 0.88, 0.14); gal.add(bar);
  const fb = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.04, 0.012, 20), bm); [-0.31, 0.31].forEach((x) => { const f = fb.clone(); f.position.set(x, 0.006, 0.14); gal.add(f); });
  shadowed(gal); A.add(gal, { at: 0.1, dur: 0.7, rise: 0.15 });

  // pendants
  const PX = [-0.22, 0, 0.22], LEN = [0.2, 0.15, 0.2];
  let round = 0, pend = [], lit = 0, over = false, bornAt = 1.0;
  const tag3 = [0, 1, 2].map((i) => A.tag('—', 0, GEM[i], V(PX[i], 0.8, 0.14), { at: 9e9 }));
  const tmp = V(), tgt = V(0, 0.38, 0);
  const spawn = () => {
    pend.forEach((p) => p.pivot.parent?.remove(p.pivot)); pend = [];
    const R = Q[round]; if (!R) return; ctx.ui.hud(R.hud);
    R.opts.forEach((txt, i) => {
      const pivot = new THREE.Group(); pivot.position.set(PX[i], 0.88, 0.14);
      const str = new THREE.Mesh(new THREE.CylinderGeometry(0.0022, 0.0022, LEN[i], 6), mat(0x6b5a3a)); str.position.y = -LEN[i] / 2;
      const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.052), new THREE.MeshStandardMaterial({ color: GEM[i], emissive: GEM[i], emissiveIntensity: 0.4, roughness: 0.15, metalness: 0.15 })); gem.scale.y = 1.3; gem.position.y = -LEN[i] - 0.05;
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.012, 0.003, 8, 20), bm); ring.position.y = -LEN[i] + 0.002; ring.rotation.y = 0.8;
      const pulse = softLight(GEM[i], 0.16, 0.0); gem.add(pulse);
      pivot.add(str, gem, ring); pivot.scale.setScalar(0.0001); g.add(pivot);
      const o = { pivot, gem, str, ring, pulse, txt, i, born: A.now + i * 0.12, state: 'idle', t0: 0, wob: -9 };
      pend.push(o); ctx.tap(gem, () => pick(o));
      A.retag(tag3[i], txt, GEM[i]); tag3[i].userData.hide = false; tag3[i].userData.at = A.now + 0.3 + i * 0.1;
    });
  };
  const pick = (o) => {
    if (o.state !== 'idle' || over || pend.some((q) => q.state === 'fall')) return;
    ctx.sfx.pop?.(); const R = Q[round];
    if (o.i === R.right) {
      o.state = 'fall'; o.t0 = A.now; o.str.visible = false; o.ring.visible = false; ctx.sfx.good?.();
      g.attach(o.gem); o.gem.getWorldPosition(tmp); o.start = o.gem.position.clone(); tag3.forEach((t) => (t.userData.hide = true));
      ctx.ui.card({ tag: `إجابة صحيحة · ${['١', '٢', '٣'][round]} من ٣`, title: o.txt, body: R.why, color: GEM[o.i] });
      pend.forEach((q) => { if (q !== o) q.state = 'fade'; });
      setTimeout(() => { const m = [mA, mB, mC][round]; m.emissiveIntensity = 1.1; lit++; core.material.emissiveIntensity = 0.6 + lit * 0.9; ctx.fx.burst(A.sp(V(0, 0.38, 0)), [GOLD, COPPER, TEAL][round], 34, 0.5, 0.035); o.gem.visible = false; }, 1100);
      setTimeout(() => { round++; if (round >= Q.length) { over = true; ctx.ui.hud('استيقظ الجهاز كاملاً'); ctx.ui.done(); } else { bornAt = A.now; spawn(); } }, 3300);
    } else { o.state = 'wrong'; o.wob = A.now; ctx.sfx.bad?.(); ctx.ui.toast('ليست الإجابة الأدق'); o.gem.material.emissiveIntensity = 0.02; o.gem.material.color.setHex(0x59606b); }
  };
  spawn();

  const sp = []; for (let i = 0; i < 16; i++) { const s = softLight([GOLD, 0x7fc4ff, TEAL][i % 3], 0.022, 0); g.add(s); sp.push({ s, ph: Math.random(), a: Math.random() * TAU, r: 0.05 + Math.random() * 0.3 }); }
  return {
    update(t, dt, e) {
      A.update(t, dt, e); sh.material.opacity = 0.3 * e;
      const spd = 1 + lit * 0.9;
      gA.rotation.y = t * 0.3 * spd; gB.rotation.x = t * 0.5 * spd; gC.rotation.z = t * 0.7 * spd; core.rotation.y = t * 1.2; core.rotation.x = t * 0.8;
      halo.material.opacity = THREE.MathUtils.damp(halo.material.opacity, lit * 0.28, 3, dt); halo.scale.setScalar(0.3 + lit * 0.1 + Math.sin(t * 2) * 0.01);
      pend.forEach((o) => {
        const k = ease((t - Math.max(o.born, bornAt)) / 0.7);
        if (o.state === 'fall') {
          const f = clamp01((t - o.t0) / 1.1); o.gem.position.lerpVectors(o.start, tgt, ease(f)); o.gem.position.y += Math.sin(f * Math.PI) * 0.1; o.gem.rotation.y += dt * 8; o.gem.scale.setScalar(Math.max(0.0001, 1.3 * (1 - ease(f) * 0.7)));
          o.gem.scale.x = o.gem.scale.z = Math.max(0.0001, 1 - ease(f) * 0.7); return;
        }
        let sw = Math.sin(t * 1.3 + o.i * 2) * 0.05; if (o.state === 'wrong') { const w = t - o.wob; sw += w < 0.8 ? Math.sin(w * 22) * 0.28 * (1 - w / 0.8) : 0; }
        o.pivot.rotation.z = sw; o.pivot.scale.setScalar(Math.max(0.0001, k)); o.gem.rotation.y = t * 1.1 + o.i;
        o.pulse.material.opacity = o.state === 'idle' ? (0.25 + Math.sin(t * 3 + o.i) * 0.15) * k : 0;
        if (o.state === 'fade') o.pivot.scale.setScalar(Math.max(0.0001, k * 0.8));
        o.gem.getWorldPosition(tmp); g.worldToLocal(tmp); const tg = tag3[o.i]; tg.position.set(tmp.x, tmp.y + (o.i === 1 ? 0.22 : 0.11), tmp.z);
      });
      sp.forEach((d) => { const k = (t * 0.1 + d.ph) % 1; d.s.position.set(Math.cos(d.a + t * 0.2) * d.r, 0.1 + k * 0.5, Math.sin(d.a + t * 0.2) * d.r); d.s.material.opacity = Math.sin(k * Math.PI) * 0.5 * ease((t - 0.6) / 1.2); });
    },
  };
}
