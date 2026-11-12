import * as THREE from 'three';
import { P, ease, easeBack, clamp01, stag, mat, glossy, goldMat, shadowed, glow } from '../../kit.js?v=30';
import { animator, plinth, shadowBlob, V, TAU, softLight } from '../lib/a1-kit.js?v=30';
import { medal, tweener } from '../lib/b1-kit.js?v=30';

export const meta = { free: true, center: [0.55, 0.65], typeLabel: 'مجسّم تفاعلي' };

const TOK = [
  { k: 'book', c: 0x3a86e6, t: 'مثيرات مكتوبة', b: 'النص المكتوب، كالكتاب والمقروء الإلكتروني.' },
  { k: 'sound', c: 0xe0684a, t: 'مثيرات مسموعة', b: 'التسجيل الصوتي والتعليق الشفهي.' },
  { k: 'pic', c: 0x22b5a8, t: 'مثيرات مصوّرة', b: 'الصور والرسوم والمجسّمات تقرّب الظاهرة الدقيقة إلى المتعلم.' },
  { k: 'play', c: 0xd4ad55, t: 'مثيرات متحرّكة إلكترونياً', b: 'صورة متحركة وصوت ونص معاً في مكان واحد.' },
];

const qa = new THREE.Quaternion();
export default function build(ctx) {
  const g = new THREE.Group(); g.position.copy(P(meta.center[0], meta.center[1])); ctx.stage.add(g);
  const A = animator(ctx, g, 1.0);
  const tw = tweener();
  g.add(shadowBlob(0.7, 0.5, 0.3));
  const base = plinth(0.3); g.add(base);

  // pedestal (a laptop-like dais)
  const dais = new THREE.Group();
  const d1 = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.13, 0.04, 48), glossy(0x2b2f3a, { metalness: 0.4, roughness: 0.3 }));
  d1.position.y = 0.025;
  const d2 = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.006, 10, 64), goldMat()); d2.rotation.x = Math.PI / 2; d2.position.y = 0.046;
  const screen = new THREE.Mesh(new THREE.CircleGeometry(0.092, 48), new THREE.MeshBasicMaterial({ color: 0x1a2a40, toneMapped: false })); screen.rotation.x = -Math.PI / 2; screen.position.y = 0.0455;
  dais.add(d1, d2, screen); shadowed(dais); A.add(dais, { at: 0.1, dur: 0.7, rise: 0.08 });

  // innovation core: crystal made of 4 stacked colours once all stimuli are absorbed
  const core = new THREE.Group(); core.position.y = 0.3;
  const cm = new THREE.MeshStandardMaterial({ color: 0xf6f8ff, emissive: 0xaecbff, emissiveIntensity: 0.35, roughness: 0.08, metalness: 0.1, transparent: true, opacity: 0.92 });
  const crystal = new THREE.Mesh(new THREE.OctahedronGeometry(0.09, 0), cm); crystal.scale.y = 1.35;
  const wire = new THREE.Mesh(new THREE.OctahedronGeometry(0.098, 0), new THREE.MeshBasicMaterial({ color: 0xffffff, wireframe: true, transparent: true, opacity: 0.55, toneMapped: false })); wire.scale.y = 1.35;
  const cg = glow(0x9cc8ff, 0.4, 0.6); core.add(crystal, wire, cg);
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.085, 0.2, 28, 1, true), new THREE.MeshBasicMaterial({ color: 0xaed4ff, transparent: true, opacity: 0.2, side: THREE.DoubleSide, depthWrite: false, toneMapped: false, blending: THREE.AdditiveBlending }));
  beam.position.y = -0.12; core.add(beam);
  A.add(core, { at: 0.5, dur: 0.9, rise: 0.12 }); core.userData.keepY = false;
  A.hint(core, 0x9cc8ff, 0.1, 0, [0, 0, 0]);

  // 4 orbit rings (thin gold) and 4 stimuli tokens
  const rings = [], toks = [];
  TOK.forEach((s, i) => {
    const tilt = new THREE.Group(); tilt.position.y = 0.3; tilt.rotation.set(0.35 + i * 0.22, i * 0.8, (i % 2 ? 1 : -1) * 0.3); g.add(tilt);
    const rg = new THREE.Mesh(new THREE.TorusGeometry(0.23, 0.003, 6, 90), new THREE.MeshBasicMaterial({ color: s.c, transparent: true, opacity: 0.55, toneMapped: false })); rg.rotation.x = Math.PI / 2; tilt.add(rg);
    const holder = new THREE.Group(); tilt.add(holder);
    const m = medal(s.k, s.c, 0.07, { th: 0.016, upright: true, bg: '#' + s.c.toString(16).padStart(6, '0'), fg: '#ffffff' });
    const mg = glow(s.c, 0.16, 0.45); m.add(mg);
    holder.add(m); m.scale.setScalar(0.0001);
    const o = { s, i, tilt, holder, m, ph: i * TAU / 4, sp: 0.35 + i * 0.05, state: 'orbit', dock: 0 };
    toks.push(o);
    A.hint(m, s.c, 0.07, 0, [0, 0, 0]);
  });

  // the purpose ring (التوظيف): gold target ring at the base
  const target = new THREE.Group(); target.position.set(0, 0.012, 0);
  const tr = [0.25, 0.2, 0.15].map((r, i) => { const t = new THREE.Mesh(new THREE.TorusGeometry(r, 0.005, 10, 80), goldMat()); t.rotation.x = Math.PI / 2; target.add(t); return t; });
  A.add(target, { at: 1.2, dur: 0.8, rise: 0.02 }); A.hint(target, 0xd4ad55, 0.26, 0.006);
  const tapRing = new THREE.Mesh(new THREE.TorusGeometry(0.25, 0.03, 6, 40), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false })); tapRing.rotation.x = Math.PI / 2; target.add(tapRing);

  A.tag('مستحدثات التعليم', 0, 0x3a86e6, V(0, 0.0, 0.34), { at: 2.4 });

  const seen = new Set(); let absorbed = 0, flash = -9, finale = -1;
  const check = () => { ctx.ui.hud(seen.size < 6 ? `${seen.size} من ٦` : 'مثيرات متعددة لهدف واحد'); if (seen.size === 6) setTimeout(() => ctx.ui.done(), 1500); };
  toks.forEach((o) => A.touch(o.m, () => {
    if (o.state === 'orbit') {
      o.state = 'fly'; const from = o.holder.getWorldPosition(new THREE.Vector3());
      const start = o.holder.position.clone(); ctx.sfx.whoosh?.();
      tw.go(0.9, (k) => { const e = ease(k); o.holder.position.lerpVectors(start, V(0, 0, 0), e); o.holder.position.y += Math.sin(k * Math.PI) * 0.05; o.m.scale.setScalar(1 - 0.55 * e); }, 0, () => {
        o.state = 'dock'; absorbed++; flash = A.now;
        const col = new THREE.Color(o.s.c); crystal.material.emissive.copy(col); crystal.material.color.lerp(col, 0.25); cg.material.color.copy(col);
        ctx.fx.burst(V(0, 0.3, 0).add(g.position), o.s.c, 18, 0.3, 0.03);
        if (absorbed === 4) { finale = A.now; }
      });
    }
    seen.add(o.i); ctx.ui.card({ tag: 'نمط من المثيرات', title: o.s.t, body: o.s.b, color: o.s.c }); check();
  }, { color: o.s.c, burst: false }));
  A.touch(core, () => { seen.add('d'); ctx.ui.card({ tag: 'المستحدث التكنولوجي', title: 'ما المستحدث التكنولوجي؟', body: 'هو كل ما هو جديد في المجال التكنولوجي ويمكن توظيفه بفاعلية وإيجابية في العملية التعليمية.', color: 0x3a86e6 }); check(); }, { color: 0x9cc8ff });
  ctx.tap(tapRing, () => { seen.add('p'); ctx.sfx.pop?.(); flash = A.now; ctx.ui.card({ tag: 'التوظيف', title: 'لأهداف تعليمية محددة', body: 'لا قيمة للمستحدث لذاته؛ يُوظَّف لتحسين قدرة المتعلم على التعامل مع العملية التعليمية.', color: 0xd4ad55 }); check(); });
  ctx.ui.hud('المس المثيرات واجمعها');

  return {
    update(t, dt, e) {
      A.update(t, dt, e); tw.update(dt);
      const S = clamp01((t - 1.0) / 1.2);
      core.rotation.y = t * 0.5; wire.rotation.y = -t * 0.3; cg.scale.setScalar(0.38 + Math.sin(t * 2) * 0.03 + clamp01(1 - (t - flash) / 0.6) * 0.15);
      toks.forEach((o) => {
        const sc = o.state === 'orbit' ? easeBack(clamp01((t - 1.2 - o.i * 0.3) / 0.7)) : null;
        if (o.state === 'orbit') {
          const a = t * o.sp + o.ph; o.holder.position.set(Math.cos(a) * 0.23, 0, Math.sin(a) * 0.23); o.m.scale.setScalar(Math.max(0.0001, sc));
        } else if (o.state === 'dock') {
          const a = t * 1.2 + o.ph; o.holder.position.set(Math.cos(a) * 0.1, Math.sin(t * 2 + o.ph) * 0.02, Math.sin(a) * 0.1);
        }
        // keep medals facing outward from the core
        o.m.parent.getWorldQuaternion(qa); qa.invert().multiply(ctx.camera.quaternion); o.m.quaternion.copy(qa);
      });
      tr.forEach((r, i) => { r.rotation.z = 0; r.scale.setScalar(1 + clamp01(1 - (t - flash) / 0.7) * 0.06 * (i + 1)); });
      if (finale >= 0) { const k = clamp01((t - finale) / 1.2); crystal.material.emissiveIntensity = 0.35 + k * 0.9; wire.material.opacity = 0.55 + k * 0.4; }
    },
  };
}
