import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { P, ease, easeBack, clamp01, stag, mat, glossy, goldMat, shadowed, glow, lightTube } from '../../kit.js?v=18';
import { animator, plinth, shadowBlob, V, TAU, softLight, canvasTexture } from '../lib/a1-kit.js?v=18';
import { medal, tweener, shakeX } from '../lib/b1-kit.js?v=18';

export const meta = { free: true, center: [0.5, 0.65], typeLabel: 'لعبة: اكتشف الخطأ' };

const GREEN = 0x3fbf86, AMBER = 0xe8a030, RED = 0xe0453a, TEAL = 0x22b5a8;
const ST = [
  { g: 'scale', t: 'تتعدد إيجابيات تكنولوجيا التعليم، ومع ذلك لا يمكن إنكار سلبياتها.', wrong: false },
  { g: 'clock', t: 'غالب المتعلمين يستخدمون التكنولوجيا في أوقات فراغهم وعطلهم لأغراض تعليمية في المقام الأول.', wrong: true, fix: 'غالبهم يستخدمونها في غير التعليم في أوقات الفراغ أو العطل.' },
  { g: 'laptop', t: 'يتعلم الطالب مهارات تخدمه في التعليم وفي سوق العمل بعد التخرج.', wrong: false },
  { g: 'chat', t: 'تقتصر مخاطر الجلوس الطويل أمام مواقع التواصل على الصحة الجسدية.', wrong: true, fix: 'للجلوس الطويل خطورة صحية ونفسية معاً.' },
  { g: 'alert', t: 'أصبح الإدمان ظاهرة بين الطلبة، وتحتّم على التربويين وأولياء الأمور التدخل وتوعية المتعلمين.', wrong: false },
  { g: 'family', t: 'ما دامت المواقع تعليمية فلا حاجة إلى تدخل أولياء الأمور أو التربويين.', wrong: true, fix: 'الإدمان ومخاطر المواقع تحتّم تدخل التربويين وأولياء الأمور.' },
  { g: 'hourglass', t: 'إهدار الوقت يؤثر في المستقبل العلمي والمهني للطالب.', wrong: false },
];

const qa = new THREE.Quaternion();
export default function build(ctx) {
  const g = new THREE.Group(); g.position.copy(P(meta.center[0], meta.center[1])); ctx.stage.add(g);
  const A = animator(ctx, g, 1.0);
  const tw = tweener();
  g.add(shadowBlob(0.7, 0.4, 0.3));
  const base = plinth(0.34, { top: 0xf2ece0 }); g.add(base);

  // the phone monolith with a glowing screen
  const phone = new THREE.Group();
  const body = new THREE.Mesh(new RoundedBoxGeometry(0.21, 0.42, 0.03, 6, 0.026), glossy(0x1f2230, { metalness: 0.5, roughness: 0.25 }));
  const sc = canvasTexture(256, 480, (c, w, h) => {
    const gr = c.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#2a3a7a'); gr.addColorStop(1, '#7a3a6a'); c.fillStyle = gr; c.fillRect(0, 0, w, h);
    c.fillStyle = 'rgba(255,255,255,.12)'; for (let i = 0; i < 6; i++) { c.beginPath(); c.roundRect(24, 40 + i * 70, w - 48, 54, 14); c.fill(); }
  });
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.185, 0.38), new THREE.MeshBasicMaterial({ map: sc, toneMapped: false })); screen.position.z = 0.0155;
  const camDot = new THREE.Mesh(new THREE.CircleGeometry(0.006, 14), new THREE.MeshBasicMaterial({ color: 0x0a0a0a })); camDot.position.set(0, 0.18, 0.0158);
  const back = new THREE.Mesh(new THREE.CircleGeometry(0.03, 24), goldMat()); back.position.set(0, 0.04, -0.0156); back.rotation.y = Math.PI;
  phone.add(body, screen, camDot, back); phone.position.set(0, 0.26, 0); shadowed(phone);
  const pg = glow(0x8aa4ff, 0.7, 0.35); pg.position.set(0, 0.24, 0.03);
  const holder = new THREE.Group(); holder.add(phone, pg);
  const stand = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 0.025, 36), goldMat()); stand.position.y = 0.014; holder.add(stand);
  A.add(holder, { at: 0.1, dur: 0.9, rise: 0.12 });

  // hourglass at the right (time lost): sand level reflects judged statements
  const hg = new THREE.Group(); hg.position.set(0.34, 0, 0.16);
  const gl = new THREE.MeshPhysicalMaterial({ color: 0xffffff, transmission: 0.0, transparent: true, opacity: 0.28, roughness: 0.05, metalness: 0 });
  const bulbT = new THREE.Mesh(new THREE.SphereGeometry(0.045, 24, 16), gl); bulbT.scale.y = 1.25; bulbT.position.y = 0.19;
  const bulbB = bulbT.clone(); bulbB.position.y = 0.075;
  const sandT = new THREE.Mesh(new THREE.SphereGeometry(0.036, 20, 14), mat(0xe8b24a, { roughness: 0.6 })); sandT.position.y = 0.19;
  const sandB = new THREE.Mesh(new THREE.SphereGeometry(0.036, 20, 14), mat(0xe8b24a, { roughness: 0.6 })); sandB.position.y = 0.062; sandB.scale.setScalar(0.001);
  const stream = new THREE.Mesh(new THREE.CylinderGeometry(0.002, 0.002, 0.07, 6), mat(0xe8b24a)); stream.position.y = 0.13;
  [0.015, 0.25].forEach((y) => { const c = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.012, 30), goldMat()); c.position.y = y; hg.add(c); });
  [-1, 1].forEach((s) => { const r = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.235, 8), goldMat()); r.position.set(s * 0.055, 0.133, 0); hg.add(r); });
  hg.add(bulbT, bulbB, sandT, sandB, stream); shadowed(hg); A.add(hg, { at: 0.5, dur: 0.8, rise: 0.1 });

  // seven orbs orbiting the phone, each a glass bubble with a glyph (no text)
  const orbs = ST.map((s, i) => {
    const o = new THREE.Group();
    const col = 0x5468e8;
    const shell = new THREE.Mesh(new THREE.SphereGeometry(0.068, 28, 20), new THREE.MeshPhysicalMaterial({ color: 0x4a5fe0, roughness: 0.1, clearcoat: 1, transparent: true, opacity: 0.2, depthWrite: false }));
    const m = medal(s.g, col, 0.058, { th: 0.012, upright: true, bg: '#3d4fd0', fg: '#ffffff' });
    const gg = glow(col, 0.22, 0.3);
    o.add(shell, m, gg); g.add(o); o.scale.setScalar(0.0001);
    return { o, shell, m, gg, s, i, ph: i / 7 * TAU, state: 'orbit', verdict: null, ang: 0 };
  });
  const R = 0.3;
  const place = (k, t) => { const a = t * 0.3 + k.ph; k.ang = a; return V(Math.cos(a) * R, 0.26 + Math.sin(a * 2 + k.ph) * 0.08, Math.sin(a) * R * 0.75); };

  let cur = null, judged = 0, correct = 0, shakeT = -9, shakeObj = null, sand = 0;
  const finish = (k, answerWrong) => {
    const right = answerWrong === k.s.wrong;
    ctx.ui.choices([]); judged++; if (right) correct++;
    const col = k.s.wrong ? AMBER : GREEN; k.verdict = k.s.wrong ? 'wrong' : 'ok';
    k.shell.material.color.setHex(col); k.shell.material.opacity = 0.6; k.gg.material.color.setHex(col);
    if (right) ctx.sfx.good?.(); else ctx.sfx.bad?.();
    ctx.ui.card({ tag: k.s.wrong ? 'عبارة تخالف الكتاب' : 'عبارة صحيحة', title: right ? (k.s.wrong ? 'اكتشفت الخطأ' : 'حكم صحيح') : 'راجع الحكم', body: k.s.wrong ? `الصواب: ${k.s.fix}` : 'هذه العبارة تتفق مع ما يقوله الكتاب.', color: col });
    ctx.fx.burst(k.o.position.clone().add(g.position), col, 18, 0.3, 0.03);
    k.state = 'return'; const from = k.o.position.clone(); const at0 = A.now;
    tw.go(0.9, (e) => { k.o.position.lerpVectors(from, place(k, A.now), ease(e)); }, 0.6, () => { k.state = 'orbit'; });
    cur = null; sand = judged / 7; ctx.ui.hud(`${judged} من ٧`);
    if (judged === 7) setTimeout(() => ctx.ui.done(), 2200);
  };
  orbs.forEach((k) => A.touch(k.o, () => {
    if (cur || k.verdict) { return; }
    cur = k; k.state = 'front'; const from = k.o.position.clone();
    ctx.ui.card({ tag: 'اقرأ ثم احكم', title: 'هل يقول الكتاب هذا؟', body: k.s.t, color: 0x6c8cff });
    ctx.ui.choices([{ label: 'يتفق مع الكتاب', primary: true, onPick: () => finish(k, false) }, { label: 'يخالف الكتاب', onPick: () => finish(k, true) }]);
    tw.go(0.6, (e) => k.o.position.lerpVectors(from, V(0, 0.46, 0.2), ease(e)));
  }, { color: 0x6c8cff, burst: false }));
  ctx.ui.hud('المس فقاعة واحكم عليها');

  return {
    update(t, dt, e) {
      A.update(t, dt, e); tw.update(dt);
      pg.scale.setScalar(0.65 + Math.sin(t * 2) * 0.04); holder.rotation.y = Math.sin(t * 0.5) * 0.25;
      orbs.forEach((k) => {
        const sc = easeBack(clamp01((t - 0.9 - k.i * 0.15) / 0.7));
        if (k.state === 'orbit') k.o.position.copy(place(k, t));
        k.o.scale.setScalar(Math.max(0.0001, sc * (k.state === 'front' ? 1.5 : 1)));
        k.m.parent.getWorldQuaternion(qa); qa.invert().multiply(ctx.camera.quaternion); k.m.quaternion.copy(qa);
        k.gg.scale.setScalar(0.24 + Math.sin(t * 2 + k.i) * 0.015);
      });
      sandT.scale.setScalar(Math.max(0.001, 1 - sand * 0.95)); sandT.position.y = 0.19 - sand * 0.025;
      sandB.scale.setScalar(Math.max(0.001, sand * 0.9)); stream.visible = sand < 1;
    },
  };
}
