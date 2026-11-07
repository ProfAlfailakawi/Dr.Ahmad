import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { P, ease, easeBack, clamp01, stag, mat, glossy, goldMat, shadowed, glow } from '../../kit.js?v=15';
import { animator, shadowBlob, V, TAU, softLight } from '../lib/a1-kit.js?v=15';

export const meta = { free: true, center: [0.5, 0.72], typeLabel: 'اختبار مجسّم' };

const GOLD = 0xd9b45a, TEAL = 0x2fb6a8, RED = 0xe0503a;
const Q = [
  { hud: 'هل الاتصال مجرد نقل معلومات؟', right: 1, opts: ['نقل المعلومات', 'قواعد روحية', 'بناء الأمة', 'العبادات'], why: 'نُظِّم الاتصال وأُقيم على قواعد روحية في نماذج وطيدة الأركان تتجاوز نقل الرسالة.' },
  { hud: 'هل الاتصال شأن الفصل وحده؟', right: 1, opts: ['للمعلم وحده', 'كل الحياة', 'للاقتصاد', 'للأمة فقط'], why: 'حياة الإنسان الذاتية والاجتماعية والاقتصادية والعبادات لا تستقيم في غياب الاتصال.' },
  { hud: 'ما معنى «رحمة للعالمين» تربوياً؟', right: 2, opts: ['تساهل', 'لمن يرغب', 'تعليم الجاهل', 'عبء ثانوي'], why: 'ليس هناك رحمة مثل تربية الجاهل وتعليمه.' },
];
const GEM = [0x6fb3ff, 0xff8f6b, 0x8ee07a, 0xc78bff];

export default function build(ctx) {
  const g = new THREE.Group(); g.position.copy(P(meta.center[0], meta.center[1])); ctx.stage.add(g);
  const A = animator(ctx, g, 0.85);
  const sh = shadowBlob(0.95, 0.6, 0.28); g.add(sh);
  // the stage is a great open book: navy cover, cream pages fanned on both sides
  const bk = new THREE.Group();
  const cover = new THREE.Mesh(new RoundedBoxGeometry(0.86, 0.03, 0.58, 3, 0.012), glossy(0x1e3a5f, { roughness: 0.4 })); cover.position.y = 0.015;
  [-1, 1].forEach((sd) => { for (let q = 0; q < 6; q++) { const pg = new THREE.Mesh(new RoundedBoxGeometry(0.4 - q * 0.004, 0.006, 0.52 - q * 0.004, 2, 0.002), mat(q === 5 ? 0xfffaf0 : 0xf3ecdc, { roughness: 0.8 })); pg.position.set(sd * 0.208, 0.034 + q * 0.0058, 0.0); pg.rotation.z = -sd * (0.01 + q * 0.004); bk.add(pg); } });
  const spine = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.52, 14), glossy(0xb9893c)); spine.rotation.x = Math.PI / 2; spine.position.set(0, 0.05, 0);
  const gl2 = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.003, 6, 80, Math.PI), goldMat()); gl2.rotation.x = -Math.PI / 2; gl2.position.y = 0.062; gl2.scale.set(1, 0.85, 1);
  bk.add(cover, spine); shadowed(bk); A.add(bk, { at: 0, dur: 0.7, rise: 0.15 });
  const TOP = 0.07;

  // the lantern of three glass drums; each right answer lights one
  const lan = new THREE.Group(); lan.position.y = TOP; lan.scale.setScalar(1.35);
  const drums = [0, 1, 2].map((i) => {
    const d = new THREE.Group(); d.position.y = 0.045 + i * 0.085;
    const gl = new THREE.Mesh(new THREE.CylinderGeometry(0.052, 0.052, 0.07, 32, 1, true), new THREE.MeshPhysicalMaterial({ color: 0xcfe8ff, transparent: true, opacity: 0.28, roughness: 0.05, side: THREE.DoubleSide, clearcoat: 1 }));
    const ring = (y) => { const r = new THREE.Mesh(new THREE.TorusGeometry(0.054, 0.004, 8, 40), goldMat()); r.rotation.x = Math.PI / 2; r.position.y = y; return r; };
    const flame = new THREE.Mesh(new THREE.SphereGeometry(0.02, 18, 14), new THREE.MeshStandardMaterial({ color: 0xfff3c8, emissive: 0xffc15a, emissiveIntensity: 0, roughness: 0.3 })); flame.scale.y = 1.4;
    const fg = glow(0xffc15a, 0.0, 0.9);
    d.add(gl, ring(-0.035), ring(0.035), flame, fg); return { d, flame, fg, lit: -9 };
  });
  const post = (a) => { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.0035, 0.0035, 0.25, 8), goldMat()); p.position.set(Math.cos(a) * 0.053, 0.135, Math.sin(a) * 0.053); return p; };
  const cap = new THREE.Mesh(new THREE.ConeGeometry(0.066, 0.05, 32), goldMat()); cap.position.y = 0.285; const knob = new THREE.Mesh(new THREE.SphereGeometry(0.01, 12, 8), goldMat()); knob.position.y = 0.318;
  lan.add(...drums.map((x) => x.d), post(0.5), post(2.6), post(4.7), cap, knob); shadowed(lan);
  A.add(lan, { at: 0.2, dur: 0.8, rise: 0.15 });
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.07, 0.35, 24, 1, true), new THREE.MeshBasicMaterial({ color: 0xffe3a0, transparent: true, opacity: 0, depthWrite: false, toneMapped: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending })); beam.position.y = 0.62; g.add(beam);

  // answer gems on four slim pillars around the lantern
  const AX = [V(-0.3, 0, 0.0), V(-0.15, 0, 0.21), V(0.15, 0, 0.21), V(0.3, 0, 0.0)];
  let round = 0, gems = [], lit = 0, bornAt = 3.0, over = false;
  const geos = [() => new THREE.OctahedronGeometry(0.034), () => new THREE.IcosahedronGeometry(0.032, 0), () => new THREE.DodecahedronGeometry(0.032), () => new THREE.TetrahedronGeometry(0.04)];
  const spawn = () => {
    gems.forEach((q) => { q.root.parent?.remove(q.root); q.tag.parent?.remove(q.tag); }); gems = [];
    const R = Q[round]; if (!R) return; ctx.ui.hud(R.hud);
    R.opts.forEach((txt, i) => {
      const root = new THREE.Group(); root.position.copy(AX[i]); root.position.y = TOP; root.scale.setScalar(0.0001);
      const col = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.016, 0.07, 14), glossy(0xe9e1cf)); col.position.y = 0.035;
      const gm = new THREE.Mesh(geos[i](), new THREE.MeshStandardMaterial({ color: GEM[i], emissive: GEM[i], emissiveIntensity: 0.35, roughness: 0.18, metalness: 0.1 })); gm.position.y = 0.1;
      gm.scale.setScalar(1.3); root.add(col, gm); g.add(root);
      const tag = A.tag(txt, 0, GEM[i], V(AX[i].x, TOP + 0.2 + (i === 1 || i === 2 ? 0 : 0.12), AX[i].z), { at: A.now + 0.4 + i * 0.1 });
      A.hint(root, GEM[i], 0.055, 0.02);
      const o = { root, gm, tag, i, born: A.now + i * 0.12, state: 'idle', t0: 0 }; gems.push(o); ctx.tap(root, () => pick(o));
    });
  };
  const pick = (o) => {
    if (o.state !== 'idle' || over || gems.some((q) => q.state === 'fly')) return;
    const R = Q[round]; ctx.sfx.pop?.();
    if (o.i === R.right) {
      o.state = 'fly'; o.t0 = A.now; ctx.sfx.good?.(); A.hideHints(o.root); o.tag.userData.hide = true;
      ctx.ui.card({ tag: `إجابة صحيحة · ${['١', '٢', '٣'][round]} من ٣`, title: R.opts[o.i], body: R.why, color: GEM[o.i] });
      gems.forEach((q) => { if (q !== o) q.state = 'fade'; });
      setTimeout(() => { drums[round].lit = A.now; lit++; ctx.fx.burst(A.sp(V(0, TOP + (0.05 + round * 0.085) * 1.35, 0)), 0xffc15a, 30, 0.45, 0.035); }, 900);
      setTimeout(() => { round++; if (round >= Q.length) { over = true; ctx.ui.hud('أضاء الفانوس كاملاً'); ctx.ui.done(); } else { bornAt = A.now; spawn(); } }, 3300);
    } else { o.state = 'wrong'; o.t0 = A.now; ctx.sfx.bad?.(); ctx.ui.toast('ليست الإجابة الأدق'); }
  };
  spawn(); bornAt = 1.2;

  const sp = []; for (let i = 0; i < 18; i++) { const s = softLight([GOLD, 0x7fc4ff, TEAL][i % 3], 0.02, 0); g.add(s); sp.push({ s, ph: Math.random(), a: Math.random() * TAU, r: 0.04 + Math.random() * 0.25 }); }
  return {
    update(t, dt, e) {
      A.update(t, dt, e);
      drums.forEach((d, i) => { const k = clamp01((t - d.lit) / 1.0); d.flame.material.emissiveIntensity = (d.lit > -9 ? ease(k) * (1.4 + Math.sin(t * 6 + i) * 0.2) : 0.0) ; d.fg.scale.setScalar(Math.max(0.0001, d.lit > -9 ? ease(k) * 0.22 : 0.0001)); d.flame.scale.set(1, 1.4 + Math.sin(t * 7 + i) * 0.1 * k, 1); });
      beam.material.opacity = THREE.MathUtils.damp(beam.material.opacity, over ? 0.22 : lit * 0.03, 3, dt); lan.rotation.y = Math.sin(t * 0.3) * 0.2;
      gems.forEach((o) => {
        const k = ease((t - Math.max(o.born, bornAt)) / 0.8); let s = k, x = AX[o.i].x, y = 0.012, z = AX[o.i].z, gy = 0.1 + Math.sin(t * 1.6 + o.i) * 0.006, rz = 0;
        if (o.state === 'fly') { const f = clamp01((t - o.t0) / 1.0); const L = 0.045 + round * 0.085; o.root.position.set(THREE.MathUtils.lerp(x, 0, ease(f)), 0, THREE.MathUtils.lerp(z, 0, ease(f))); gy = 0.1 + (L * 1.35 - 0.1) * ease(f) + Math.sin(f * Math.PI) * 0.07; s = k * (1 - ease(f) * 0.85); o.gm.position.y = gy; o.root.position.y = TOP; o.root.scale.setScalar(Math.max(0.0001, s)); o.gm.rotation.y += dt * 6; return; }
        if (o.state === 'fade') s = k * Math.max(0, 1 - (t - (o.t0 || t)) * 0.0) * 0.5;
        if (o.state === 'wrong') { const w = t - o.t0; rz = w < 0.5 ? Math.sin(w * 50) * 0.25 * (1 - w * 2) : 0; s = k * 0.8; o.gm.material.emissiveIntensity = 0.05; o.gm.material.color.setHex(0x59606b); }
        o.root.position.set(x, TOP, z); o.root.rotation.z = rz; o.root.scale.setScalar(Math.max(0.0001, s)); o.gm.position.y = gy; o.gm.rotation.y = t * 0.9 + o.i; o.gm.rotation.x = t * 0.5;
        o.tag.userData.hide = o.state === 'fade'; o.tag.position.set(x, TOP + 0.2 + (o.i === 1 || o.i === 2 ? 0 : 0.12), z);
      });
      sp.forEach((d) => { const k = (t * 0.1 + d.ph) % 1; d.s.position.set(Math.cos(d.a + t * 0.2) * d.r, 0.05 + k * 0.4, Math.sin(d.a + t * 0.2) * d.r); d.s.material.opacity = Math.sin(k * Math.PI) * 0.5 * ease((t - 1) / 1.5); });
    },
  };
}
