import * as THREE from 'three';
import { P, ease, easeBack, clamp01, stag, mat, glossy, goldMat, shadowed, glow, sprite } from '../../kit.js?v=25';
import { inked } from '../../pencil.js?v=25';
import { TAU, revealer, bumper, hintGlow, pulseHint, setSpr, retext, burstAt } from '../lib/a6-kit.js?v=25';

export const meta = { free: true, center: [0.5, 0.52], typeLabel: 'خريطة بأعمدة' };

// users (millions), share of population (%), position of the printed pin
const C = [
  { w: 'السعودية', u: 9.9, p: 31.8, x: 0.475, y: 0.712, b: 'أكثر الدول عدداً بين ما يعرضه الشكل: ٩٫٩ مليون مستخدم، أي ٣١٫٨٪ من السكان.' },
  { w: 'مصر', u: 3.1, p: 3.5, x: 0.225, y: 0.702, b: '٣٫١ مليون مستخدم، لكن نسبتهم ٣٫٥٪ فقط من السكان؛ فالعدد الكبير يذوب في عدد سكان أكبر.' },
  { w: 'قطر', u: 0.35, p: 38.8, x: 0.652, y: 0.708, b: '٠٫٣٥ مليون مستخدم فقط، غير أن نسبتهم ٣٨٫٨٪ من السكان، وهي أعلى نسبة في الشكل مع الإمارات.' },
  { w: 'الكويت', u: 1, p: 31.7, x: 0.54, y: 0.606, b: 'مليون مستخدم بنسبة ٣١٫٧٪ من السكان، قريبة من نسبة السعودية رغم فارق العدد الكبير.' },
  { w: 'عُمان', u: 0.2, p: 6.4, x: 0.785, y: 0.778, b: '٠٫٢ مليون مستخدم بنسبة ٦٫٤٪، وهي أدنى كثيراً من دول الخليج المجاورة.' },
  { w: 'الإمارات', u: 3.3, p: 38.8, x: 0.77, y: 0.706, b: '٣٫٣ مليون مستخدم، ونسبتهم ٣٨٫٨٪ من السكان، وهي أعلى نسبة في الشكل مع قطر.' },
  { w: 'البحرين', u: 0.22, p: 15.5, x: 0.588, y: 0.652, b: '٠٫٢٢ مليون مستخدم بنسبة ١٥٫٥٪ من السكان.' },
  { w: 'الأردن', u: 0.25, p: 3.6, x: 0.385, y: 0.59, b: '٠٫٢٥ مليون مستخدم بنسبة ٣٫٦٪ من السكان.' },
  { w: 'لبنان', u: 0.26, p: 5.9, x: 0.352, y: 0.638, b: '٠٫٢٦ مليون مستخدم بنسبة ٥٫٩٪ من السكان.' },
];
const HMAX = 0.32, RED = 0xc4194a, GREEN = 0x1a7a43, W = 0.026;

export default function build(ctx) {
  const g = new THREE.Group(); ctx.stage.add(g);
  const R = revealer(), B = bumper();

  // the bird hatching from an egg on a small gold stand
  const bird = new THREE.Group(); bird.position.copy(P(0.49, 0.43)); g.add(bird);
  const stand = inked(new THREE.CylinderGeometry(0.055, 0.065, 0.016, 28), { color: 0xf1ecdf }); stand.position.y = 0.008; bird.add(stand); R.add(stand, 0.2, 0.9);
  const eggM = new THREE.MeshStandardMaterial({ color: 0xf3d9a4, roughness: 0.45, side: THREE.DoubleSide });
  const shell = new THREE.Mesh(new THREE.SphereGeometry(0.058, 32, 24, 0, TAU, 1.0, Math.PI - 1.0), eggM); shell.scale.set(1, 1.2, 1); shell.position.y = 0.075; bird.add(shell);
  const band = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.007, 8, 40), new THREE.MeshStandardMaterial({ color: 0x4a3a2a, roughness: 0.5 })); band.rotation.x = Math.PI / 2; band.position.y = 0.07; bird.add(band);
  const body = new THREE.Group(); body.position.y = 0.105; bird.add(body);
  const bm = glossy(0x4aa9e0);
  const torso = new THREE.Mesh(new THREE.SphereGeometry(0.045, 24, 18), bm); torso.scale.set(1, 1.05, 0.9); body.add(torso);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.03, 20, 16), bm); head.position.set(0, 0.052, 0.012); body.add(head);
  const beak = new THREE.Mesh(new THREE.ConeGeometry(0.011, 0.03, 12), glossy(0xf2a02f)); beak.rotation.x = Math.PI / 2; beak.position.set(0, 0.048, 0.046); body.add(beak);
  const tuft = new THREE.Mesh(new THREE.ConeGeometry(0.007, 0.03, 8), bm); tuft.position.set(0, 0.09, 0.0); tuft.rotation.x = -0.4; body.add(tuft);
  const wings = [-1, 1].map((s) => { const w = new THREE.Group(); w.position.set(s * 0.04, 0.0, 0); const m = new THREE.Mesh(new THREE.SphereGeometry(0.036, 16, 12), glossy(0x3a8cc8)); m.scale.set(1.3, 0.18, 0.7); m.position.x = s * 0.04; w.add(m); body.add(w); return { w, s }; });
  shadowed(body);
  const birdHint = hintGlow(0x4aa9e0, 0.22); birdHint.position.set(0, 0.12, 0.05); bird.add(birdHint);

  // the twin columns
  const cols = C.map((c, i) => {
    const holder = new THREE.Group(); holder.position.copy(P(c.x, c.y)); g.add(holder);
    const hU = Math.max(0.012, (c.u / 9.9) * HMAX), hP = Math.max(0.012, (c.p / 38.8) * HMAX);
    const mk = (h, color, x) => { const m = new THREE.Mesh(new THREE.BoxGeometry(W, 1, W), glossy(color, { emissive: color, emissiveIntensity: 0.15 })); m.geometry.translate(0, 0.5, 0); m.position.x = x; holder.add(m); return { m, h, color }; };
    const red = mk(hU, RED, -0.016), green = mk(hP, GREEN, 0.016);
    const capR = glow(0xff6d90, 0.05, 0), capG = glow(0x6fe6a0, 0.05, 0); holder.add(capR, capG);
    const hit = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.12, 8), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false })); hit.position.y = 0.06; holder.add(hit);
    const hint = hintGlow(0xffd27a, 0.1); hint.position.y = 0.01; holder.add(hint);
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.003, 20), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.8, toneMapped: false })); disc.position.y = 0.0015; holder.add(disc);
    return { c, holder, red, green, capR, capG, hit, hint, disc, seen: false, hl: 0 };
  });
  const lab = sprite('السعودية', 0.2, { size: 42, width: 330, weight: 800, border: '#c4194a', color: '#2b2620', bg: 'rgba(251,248,240,.97)' }); g.add(lab);
  let labT = -9, labCol = null;

  let now = 0, sel = -1, seen = new Set(), finished = false;
  function touchCol(i) {
    if (now < 2.6) return;
    const k = cols[i]; sel = i; k.seen = true; seen.add(i); ctx.sfx.pop?.(); B.hit(k.holder, now, 0.05);
    labT = now; labCol = k;
    retext(lab, k.c.w, 0.2, { size: 42, width: 330, weight: 800, border: '#' + (k.c.p > k.c.u * 3 ? GREEN : RED).toString(16).padStart(6, '0'), color: '#2b2620', bg: 'rgba(251,248,240,.97)' });
    burstAt(ctx, g, k.holder.position.clone().add(new THREE.Vector3(0, 0.08, 0)), 0xffd27a, 18, 0.3, 0.025);
    ctx.ui.card({ tag: 'تويتر · ٢٠١٥', title: k.c.w, body: k.c.b, color: RED });
    if (seen.size >= 6 && !finished) { finished = true; setTimeout(() => { ctx.sfx.good?.(); ctx.ui.card({ tag: 'الاستنتاج', title: 'العدد ليس النسبة', body: 'كثرة المستخدمين بالأرقام المطلقة لا تعني بالضرورة ارتفاع نسبة الانتشار بين السكان.', color: 0xd4ad55 }); ctx.ui.done(); }, 1800); }
  }
  cols.forEach((k, i) => ctx.tap(k.holder, () => touchCol(i)));
  ctx.tap(bird, () => { ctx.sfx.pop?.(); B.hit(body, now, 0.12); ctx.ui.card({ tag: 'قبل الاستنتاج', title: 'كيف تقرأ الخريطة؟', body: 'العمود الأحمر يبيّن عدد المستخدمين بالملايين، والأخضر يبيّن نسبتهم إلى عدد السكان. قارن بينهما قبل أي استنتاج.', color: 0x4aa9e0 }); });
  ctx.ui.hud('قارن العمود الأحمر بالأخضر لكل دولة');

  const pv = new THREE.Vector3();
  return {
    update(t, dt, e) {
      now = t; R.update(t, e); B.update(t);
      const bk = stag(t, 0.3, 0.9, easeBack) * e; bird.visible = bk > 0.01; bird.scale.setScalar(Math.max(bk * 1.3, 0.001));
      body.position.y = 0.105 + 0.02 * ease((t - 1.6) / 1.2) + 0.004 * Math.sin(t * 3);
      wings.forEach(({ w, s }) => { w.rotation.z = s * (0.35 + 0.5 * Math.sin(t * 9)) * (0.5 + 0.5 * stag(t, 2.5, 1)); });
      body.rotation.y = Math.sin(t * 0.8) * 0.4;
      pulseHint(birdHint, t, 0, seen.size ? 0.4 : 1, 0.3);
      cols.forEach((k, i) => {
        const rise = ease((t - (0.9 + i * 0.3)) / 1.2) * e;
        k.holder.visible = e > 0.01;
        k.hl = THREE.MathUtils.damp(k.hl, sel === i ? 1 : 0, 6, dt);
        [k.red, k.green].forEach((cc) => { cc.m.scale.y = Math.max(cc.h * rise, 0.0005); cc.m.material.emissiveIntensity = 0.15 + 0.5 * k.hl + 0.1 * Math.sin(t * 2 + i) * (k.seen ? 0 : 1); cc.m.scale.x = cc.m.scale.z = 1 + 0.25 * k.hl; });
        k.capR.position.set(-0.016, k.red.h * rise + 0.01, 0); k.capG.position.set(0.016, k.green.h * rise + 0.01, 0);
        const shine = (0.18 + 0.5 * k.hl) * rise; k.capR.material.opacity = shine; k.capG.material.opacity = shine;
        pulseHint(k.hint, t, i * 0.8, k.seen ? 0 : stag(t, 2.0 + i * 0.2, 0.5) * e, 0.35);
        k.disc.scale.setScalar(Math.max(rise, 0.001));
      });
      // name tag floats over the chosen pair, above its taller column
      const lk = t - labT < 4 ? stag(t, labT, 0.4, easeBack) : Math.max(0, 1 - (t - labT - 4) / 0.4);
      if (labCol) { const hh = Math.max(labCol.red.h, labCol.green.h) + 0.06; lab.position.copy(labCol.holder.position); lab.position.y = hh; }
      setSpr(lab, 0.2, lk * e);
    },
  };
}
