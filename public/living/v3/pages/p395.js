import * as THREE from 'three';
import { mat, glossy, goldMat, shadowed, glow, stag, ease, easeBack, clamp01, label } from '../../kit.js?v=16';
import { scene, RoundedBox, TAU, contactShadow } from '../lib/a8-kit.js?v=16';
export const meta = { free: true, center: [0.375, 0.666], typeLabel: 'لعبة مطابقة' };

const GLASS = (c, o = 0.5) => new THREE.MeshPhysicalMaterial({ color: c, roughness: 0.05, transparent: true, opacity: o, clearcoat: 1, emissive: c, emissiveIntensity: 0.35 });
const GLOWM = (c, i = 1) => new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: i, roughness: 0.3 });
const DEV = [
  { n: 'HoloLens', f: 'نظارة بالإيماءات', c: 0x3b8fe0, body: 'نظارة ثلاثية الأبعاد بلا أزرار ولا شاشة لمس، تُدار بالأوامر الصوتية والإيماءات البصرية، من ابتكارات مايكروسوفت.' },
  { n: 'Aura', f: 'منبّه ذكي للنوم', c: 0x8a5ad8, body: 'منبّه ذكي متعدد الألوان يساعد على نوم صحي: يطلق موسيقى هادئة وضوءاً مناسباً، ويقيس حرارة الغرفة وساعات النوم.' },
  { n: 'Cognitoys', f: 'لعبة ناطقة للطفل', c: 0x2fbf8a, body: 'لعبة تعليمية ناطقة تحدد شخصية الطفل وتجيب عن أسئلته، وتعمل عبر الاتصال بالإنترنت.' },
  { n: 'Pantelligent', f: 'مقلاة تذكّر بالخطوات', c: 0xf29a2e, body: 'مقلاة ذكية مرتبطة بالهاتف عبر البلوتوث، تذكّر بخطوات الوجبة ومقاديرها وتختار الحرارة والوقت المناسبين.' },
  { n: 'Earbuds', f: 'سماعة تضبط الضوضاء', c: 0xe0527f, body: 'سماعات لاسلكية صغيرة تتحكم في الضوضاء المحيطة تضخيماً أو خفضاً، وتتيح مكالمات واضحة حتى في المصانع.' },
];
const ORDER = [4, 2, 0, 3, 1];
const hex = (c) => '#' + c.toString(16).padStart(6, '0');

function mkDevice(i) {
  const g = new THREE.Group(), c = DEV[i].c;
  if (i === 0) { // HoloLens: band + curved visor
    const band = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.007, 12, 40, Math.PI * 1.25), glossy(0x39414f)); band.rotation.set(Math.PI / 2, 0, -0.2); band.position.y = 0.05; g.add(band);
    const vis = new THREE.Mesh(new THREE.CylinderGeometry(0.052, 0.052, 0.036, 36, 1, true, Math.PI * 0.2, Math.PI * 0.6), GLASS(c, 0.6)); vis.material.side = THREE.DoubleSide; vis.rotation.y = -Math.PI * 0.05; vis.position.y = 0.05; g.add(vis);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.052, 0.003, 8, 30, Math.PI * 0.6), GLOWM(c, 1.3)); rim.rotation.set(Math.PI / 2, 0, Math.PI * 0.2); rim.position.y = 0.068; g.add(rim);
  } else if (i === 1) { // Aura: a round bedside light
    const b = new THREE.Mesh(new THREE.CylinderGeometry(0.052, 0.058, 0.03, 40), glossy(0xf3efe8)); b.position.y = 0.015; g.add(b);
    const d = new THREE.Mesh(new THREE.SphereGeometry(0.05, 32, 16, 0, TAU, 0, Math.PI / 2), GLOWM(c, 0.9)); d.position.y = 0.03; g.add(d);
    const r = new THREE.Mesh(new THREE.TorusGeometry(0.055, 0.003, 8, 48), GLOWM(0xffe9a8, 1.2)); r.rotation.x = Math.PI / 2; r.position.y = 0.031; g.add(r);
  } else if (i === 2) { // Cognitoys: a friendly round talking toy
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.04, 28, 20), glossy(c)); body.scale.y = 1.15; body.position.y = 0.045; g.add(body);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.03, 28, 20), glossy(0xf6efdf)); head.position.y = 0.105; g.add(head);
    [-1, 1].forEach((s) => { const e = new THREE.Mesh(new THREE.SphereGeometry(0.01, 12, 10), glossy(c)); e.position.set(s * 0.03, 0.12, 0); g.add(e); const eye = new THREE.Mesh(new THREE.SphereGeometry(0.0055, 10, 8), mat(0x2b2620)); eye.position.set(s * 0.011, 0.108, 0.027); g.add(eye); });
    const ant = new THREE.Mesh(new THREE.CylinderGeometry(0.0013, 0.0013, 0.03, 6), mat(0x2b2620)); ant.position.y = 0.147; g.add(ant);
    const tip = new THREE.Mesh(new THREE.SphereGeometry(0.006, 10, 8), GLOWM(0xffd27a, 1.4)); tip.position.y = 0.164; g.add(tip);
  } else if (i === 3) { // Pantelligent: a pan with a blue light
    const p = new THREE.Mesh(new THREE.CylinderGeometry(0.058, 0.044, 0.02, 40), glossy(0x34302c, { metalness: 0.4 })); p.position.y = 0.02; g.add(p);
    const inner = new THREE.Mesh(new THREE.CircleGeometry(0.052, 36), mat(0x6a625a)); inner.rotation.x = -Math.PI / 2; inner.position.y = 0.0305; g.add(inner);
    const h = new THREE.Mesh(new RoundedBox(0.075, 0.009, 0.014, 0.004), glossy(0x2b2620)); h.position.set(0.1, 0.027, 0); g.add(h);
    const led = new THREE.Mesh(new THREE.SphereGeometry(0.006, 10, 8), GLOWM(0x45c6ff, 1.6)); led.position.set(0.075, 0.034, 0); g.add(led);
    const egg = new THREE.Mesh(new THREE.SphereGeometry(0.013, 14, 10), mat(0xfff3c4)); egg.scale.y = 0.4; egg.position.set(-0.01, 0.034, 0.005); g.add(egg);
    const yolk = new THREE.Mesh(new THREE.SphereGeometry(0.0065, 12, 8), mat(0xf5a623)); yolk.position.set(-0.01, 0.038, 0.005); g.add(yolk);
  } else { // earbuds + charging case
    const cs = new THREE.Mesh(new RoundedBox(0.09, 0.034, 0.05, 0.016), glossy(0xf3efe8)); cs.position.y = 0.017; g.add(cs);
    [-1, 1].forEach((s) => {
      const b = new THREE.Mesh(new THREE.SphereGeometry(0.015, 16, 12), glossy(c)); b.position.set(s * 0.02, 0.05, 0); g.add(b);
      const st = new THREE.Mesh(new THREE.CapsuleGeometry(0.004, 0.026, 4, 8), glossy(0xf6efdf)); st.position.set(s * 0.02, 0.028, 0); st.rotation.z = s * 0.2; g.add(st);
    });
    const dot = new THREE.Mesh(new THREE.SphereGeometry(0.0035, 8, 6), GLOWM(0x7dffb0, 1.5)); dot.position.set(0, 0.034, 0.025); g.add(dot);
  }
  return shadowed(g);
}



export default function build(ctx) {
  const S = scene(ctx, meta), g0 = S.g; const g = new THREE.Group(); g.scale.setScalar(0.95); g0.add(g);
  // ---- a floating glass screen carries the question
  const panel = new THREE.Group(); panel.position.set(0, 0.31, -0.05); g.add(panel);
  const frame = new THREE.Mesh(new RoundedBox(0.5, 0.16, 0.014, 0.016), glossy(0x1d2430, { roughness: 0.25 })); panel.add(frame);
  const rim = new THREE.Mesh(new RoundedBox(0.512, 0.172, 0.008, 0.018), goldMat()); rim.position.z = -0.005; panel.add(rim);
  const cv = document.createElement('canvas'); cv.width = 1024; cv.height = 266; const cx = cv.getContext('2d');
  const stex = new THREE.CanvasTexture(cv); stex.colorSpace = THREE.SRGBColorSpace;
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.47, 0.13), new THREE.MeshBasicMaterial({ map: stex, toneMapped: false })); screen.position.z = 0.0078; panel.add(screen);
  const SC = { text: '', done: 0, flash: 0, c: 0xd4ad55 };
  const draw = () => {
    const gr = cx.createLinearGradient(0, 0, 1024, 266); gr.addColorStop(0, '#16345a'); gr.addColorStop(1, '#0b1a30'); cx.fillStyle = gr; cx.fillRect(0, 0, 1024, 266);
    for (let i = 0; i < 5; i++) { cx.beginPath(); cx.arc(412 + i * 50, 40, 13, 0, TAU); cx.fillStyle = i < SC.done ? hex(DEV[ORDER[i]].c) : 'rgba(255,255,255,.2)'; cx.fill(); }
    cx.textAlign = 'center'; cx.textBaseline = 'middle'; cx.direction = 'rtl';
    cx.fillStyle = '#ffe3a0'; cx.font = '800 92px Tajawal, sans-serif'; cx.shadowColor = hex(SC.c); cx.shadowBlur = 36; cx.fillText(SC.text, 512, 160); cx.shadowBlur = 0;
    if (SC.flash > 0) { cx.fillStyle = `rgba(255,255,255,${0.3 * SC.flash})`; cx.fillRect(0, 0, 1024, 266); }
    stex.needsUpdate = true;
  };
  const sglow = glow(0x5aa8ff, 0.7, 0.0); sglow.position.set(0, 0, 0.05); panel.add(sglow);
  const shP = contactShadow(0.5, 0.2, 0.25); shP.position.set(0, 0.0015, -0.04); g.add(shP);
  S.part(panel, 0.5, { rise: 0.1 });

  // ---- five podiums, each lifts a device
  const xs = [-0.26, -0.13, 0, 0.13, 0.26], zs = [0.07, 0.03, 0.0, 0.03, 0.07];
  const devs = DEV.map((dv, i) => {
    const grp = new THREE.Group(); grp.position.set(xs[i], 0, zs[i] + 0.05); g.add(grp);
    const sh = contactShadow(0.2, 0.18, 0.4); sh.position.y = 0.0015; grp.add(sh);
    const pod = new THREE.Mesh(new RoundedBox(0.118, 0.06, 0.11, 0.02), glossy(dv.c, { roughness: 0.28 })); pod.position.y = 0.03; grp.add(pod);
    const top = new THREE.Mesh(new RoundedBox(0.124, 0.008, 0.116, 0.022), goldMat()); top.position.y = 0.062; grp.add(top);
    const m = mkDevice(i); m.position.y = 0.07; m.scale.setScalar(1.35); grp.add(m);
    const plate = label(dv.n, 0.11, { size: 54, width: 420, weight: 800, border: hex(dv.c), pad: 16, radius: 18 }); plate.rotation.x = -0.45; plate.position.set(0, 0.026, 0.056); grp.add(plate);
    const lamp = glow(dv.c, 0.28, 0); lamp.position.y = 0.13; grp.add(lamp);
    shadowed(grp); S.part(grp, 0.2 + i * 0.14, { rise: 0.16 });
    return { grp, m, lamp, pod, d: dv, i, state: 'idle', shake: -9, up: 0, x: xs[i], z: zs[i] + 0.05 };
  });
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 1, 8), new THREE.MeshBasicMaterial({ color: 0xffd27a, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false })); g.add(beam);

  let round = 0, done = 0, bt = -9; const Y = new THREE.Vector3(0, 1, 0), tgt = new THREE.Vector3(), to = new THREE.Vector3(0, 0.24, -0.05), dir = new THREE.Vector3();
  SC.text = DEV[ORDER[0]].f; SC.c = DEV[ORDER[0]].c; draw();
  devs.forEach((v) => {
    S.touch(v.grp, () => {
      if (v.state === 'done') { ctx.ui.card({ tag: 'ابتكار', title: v.d.n, body: v.d.body, color: v.d.c }); return; }
      if (round >= ORDER.length) return;
      if (ORDER[round] === v.i) {
        v.state = 'done'; round++; done++; v.lamp.material.opacity = 0.6; bt = S.now; tgt.set(v.x, 0.17, v.z); SC.flash = 1; SC.done = done;
        S.burst(new THREE.Vector3(v.x, 0.18, v.z).multiplyScalar(0.95), v.d.c, 32, 0.55);
        ctx.sfx.good?.(); ctx.ui.card({ tag: 'ابتكار', title: v.d.n, body: v.d.body, color: v.d.c });
        if (round >= ORDER.length) { SC.text = 'طابقتَ الخمسة'; SC.c = 0xffe3a0; ctx.ui.hud('طابقتَ الابتكارات الخمسة'); setTimeout(() => ctx.ui.done(), 1800); }
        else { SC.text = DEV[ORDER[round]].f; SC.c = DEV[ORDER[round]].c; ctx.ui.hud(['', 'أحسنت', 'متقدّم', 'قاربت', 'الأخيرة'][done]); }
        draw();
      } else { v.shake = S.now; ctx.sfx.bad?.(); ctx.ui.toast('ليس هذا الابتكار، جرّب غيره'); }
    }, { color: v.d.c, size: 0.3, at: new THREE.Vector3(0, 0.13, 0), wake: 3.0 });
  });
  ctx.ui.hud('أي ابتكار يؤدي هذه الوظيفة؟');

  S.loop((t, dt, e) => {
    sglow.material.opacity = 0.3 * ease((t - 0.8) / 0.8) * e; panel.position.y = 0.31 + Math.sin(t * 1.2) * 0.005;
    if (SC.flash > 0) { SC.flash = Math.max(0, SC.flash - dt * 2.2); draw(); }
    devs.forEach((v, i) => {
      v.up = THREE.MathUtils.damp(v.up, v.state === 'done' ? 1 : 0, 5, dt);
      v.m.rotation.y = Math.sin(t * 0.6 + i * 1.3) * 0.6 + (v.state === 'done' ? t * 1.0 : 0);
      v.m.position.y = 0.07 + Math.sin(t * 1.6 + i * 1.3) * 0.005 + v.up * 0.035;
      v.grp.position.x = v.x + clamp01(1 - (t - v.shake) / 0.5) * Math.sin((t - v.shake) * 55) * 0.01;
      v.pod.material.emissive.set(v.d.c); v.pod.material.emissiveIntensity = 0.1 + v.up * 0.5 + 0.08 * Math.sin(t * 2.4 + i);
      if (v.state === 'idle') v.lamp.material.opacity = t > 3.0 ? 0.16 + 0.08 * Math.sin(t * 2.4 + i) : 0;
    });
    const u = clamp01((t - bt) / 0.9);
    if (u > 0 && u < 1) { dir.subVectors(to, tgt); beam.position.copy(tgt).addScaledVector(dir, 0.5); beam.scale.set(1, dir.length(), 1); beam.quaternion.setFromUnitVectors(Y, dir.clone().normalize()); beam.material.opacity = 0.7 * Math.sin(u * Math.PI); beam.visible = true; } else beam.visible = false;
  });
  return { update: S.update };
}
