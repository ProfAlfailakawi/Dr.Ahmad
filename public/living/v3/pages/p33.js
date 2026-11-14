import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { P, ease, easeBack, clamp01, stag, mat, glossy, goldMat, shadowed, glow, lightTube } from '../../kit.js?v=34';
import { animator, plinth, shadowBlob, V, TAU, softLight } from '../lib/a1-kit.js?v=34';
import { medal, tweener } from '../lib/b1-kit.js?v=34';

export const meta = { free: true, center: [0.5, 0.72], typeLabel: 'مجسّم تفاعلي' };

const COLS = [0x22b5a8, 0x3a86e6, 0xe0684a, 0xd4ad55, 0x7fcf5a];
const ICON = ['target', 'ruler', 'medal', 'laptop', 'link'];
const SPOT = [
  ['الغرض من التعليم', 'الغرض من التعليم هو التعلّم؛ فتُقاس جودته بما يتحقق عند المتعلم لا بما يُلقى عليه.'],
  ['مهام التعلّم وقياسها', 'يجب تحديد مهام التعلم وكيفية قياسها في التصميم التعليمي.'],
  ['الكفايات والإتقان', 'بلوغ مستوى الإتقان في الكفايات المحددة هو مقياس نجاح المتعلم.'],
  ['التعلّم الذاتي والتفريد', 'الحقائب وبرمجيات الحاسوب والكتب المبرمجة والتعلم عن بعد.'],
  ['التفاعل والانسجام', 'كلما زاد التفاعل والانسجام بين عناصر المنظومة زادت فرص التعلم.'],
];

const qa = new THREE.Quaternion();
export default function build(ctx) {
  const g = new THREE.Group(); g.position.copy(P(meta.center[0], meta.center[1])); ctx.stage.add(g);
  const A = animator(ctx, g, 1.0);
  const tw = tweener();
  const sh = shadowBlob(0.6, 0.45, 0.3); g.add(sh);

  const base = plinth(0.27); base.scale.setScalar(1); g.add(base);
  // central gold column
  const col = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.022, 0.64, 24), glossy(0xf2d58a, { metalness: 0.6, roughness: 0.25 })); col.position.y = 0.32;
  const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 0.03, 36), goldMat()); foot.position.y = 0.016;
  const colG = new THREE.Group(); colG.add(col, foot); shadowed(colG); A.add(colG, { at: 0.1, dur: 0.7, rise: 0.1 });

  // spiral stairs
  const R = 0.175, N = 5, steps = [];
  const stepPos = (i) => { const a = 0.0 + i * 1.26; return V(Math.cos(a) * R, 0.05 + i * 0.115, Math.sin(a) * R); };
  for (let i = 0; i < N; i++) {
    const s = new THREE.Group(); const p = stepPos(i); s.position.copy(p);
    const a = Math.atan2(p.z, p.x); s.rotation.y = -a;
    const hh = p.y + 0.02; const slab = new THREE.Group(); const pil = new THREE.Mesh(new THREE.CylinderGeometry(0.052, 0.058, hh, 32), glossy(COLS[i], { roughness: 0.3 })); pil.position.y = -hh / 2 + 0.012; const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.058, 0.058, 0.012, 32), goldMat()); cap.position.y = 0.012; slab.add(pil, cap);
    slab.position.x = 0;
    const arm = new THREE.Group();
    const m = medal(ICON[i], COLS[i], 0.05, { th: 0.014, upright: true, bg: '#fffaf0', fg: '#' + [0x127a70, 0x1f4fa8, 0xb03a22, 0x8a6a14, 0x3a8a1e][i].toString(16).padStart(6, '0') }); m.position.set(0.0, 0.085, 0); m.rotation.y = a;
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.05, 8), goldMat()); stem.position.set(0, 0.04, 0);
    s.add(slab, arm, stem, m); shadowed(s);
    A.add(s, { at: 0.5 + i * 0.35, dur: 0.7, rise: 0.12 });
    A.hint(s, COLS[i], 0.07, 0.03);
    steps.push({ s, p, slab, m });
  }
  // the learner: a glowing orb
  const orb = new THREE.Group();
  const core = new THREE.Mesh(new THREE.SphereGeometry(0.04, 28, 20), new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffe2a0, emissiveIntensity: 1.1, roughness: 0.2 }));
  const og = glow(0xffd27a, 0.26, 0.9); orb.add(core, og); g.add(orb);
  let at = 0, hop = null; // current step; hop animation
  const orbAt = (i) => { const q = stepPos(i); return V(q.x * 0.55, q.y + 0.05, q.z * 0.55); };
  orb.position.copy(orbAt(0));
  const goTo = (i, dur = 0.8) => {
    const a = orb.position.clone(), b = orbAt(i); at = i;
    tw.go(dur, (k) => { orb.position.lerpVectors(a, b, ease(k)); orb.position.y += Math.sin(k * Math.PI) * 0.1; });
  };
  // demo climb while building
  [1, 2, 3, 4, 0].forEach((i, n) => tw.go(0.01, () => {}, 2.2 + n * 0.55, () => { if (!seen.size) goTo(i, 0.5); }));

  // beacon on top: crown of light
  const top = new THREE.Group(); top.position.y = 0.72;
  const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.04, 0), new THREE.MeshStandardMaterial({ color: 0xfff1c9, emissive: 0xffc24d, emissiveIntensity: 0.25, roughness: 0.15 }));
  gem.scale.y = 1.4;
  const bg = glow(0xffc24d, 0.0, 0.0); top.add(gem, bg);
  const rays = []; for (let i = 0; i < 12; i++) { const r = new THREE.Mesh(new THREE.CylinderGeometry(0.002, 0.005, 0.12, 6), new THREE.MeshBasicMaterial({ color: 0xffd27a, transparent: true, opacity: 0, toneMapped: false, depthWrite: false })); r.userData.a = i / 12 * TAU; r.position.set(Math.cos(r.userData.a) * 0.08, 0, Math.sin(r.userData.a) * 0.08); r.rotation.z = -Math.cos(r.userData.a) * 1.1; r.rotation.x = Math.sin(r.userData.a) * 1.1; top.add(r); rays.push(r); }
  A.add(top, { at: 2.2, dur: 0.8, rise: 0.1 });
  // knowledge spreading: 5 arcs from the crown down onto the page
  const arcs = [];
  for (let i = 0; i < 5; i++) { const a = i / 5 * TAU + 0.3; const c = new THREE.QuadraticBezierCurve3(V(0, 0.72, 0), V(Math.cos(a) * 0.18, 0.74, Math.sin(a) * 0.18), V(Math.cos(a) * 0.3, 0.01, Math.sin(a) * 0.26)); const t = lightTube(c, { radius: 0.005, color: COLS[i], speed: 0.6 }); t.userData.fill(0); g.add(t); arcs.push(t); }
  const seeds = []; for (let i = 0; i < 16; i++) { const s = softLight(COLS[i % 5], 0.028, 0); g.add(s); seeds.push({ s, a: Math.random() * TAU, ph: Math.random(), r: 0.2 + Math.random() * 0.2 }); }

  A.tag('مكتشفاً ومنشئاً', 0, 0xd4ad55, V(0, 0.0, 0.33), { at: 3 });

  const seen = new Set(); let lit = -1;
  steps.forEach((st, i) => {
    ctx.tap(st.s, () => {
      ctx.sfx.pop?.(); ctx.fx.burst(st.s.getWorldPosition(new THREE.Vector3()).sub(ctx.stage.position), COLS[i], 16, 0.3, 0.03);
      st.s.userData.bump = A.now; goTo(i);
      ctx.ui.card({ tag: 'المتعلّم مكتشفاً', title: SPOT[i][0], body: SPOT[i][1], color: COLS[i] });
      seen.add(i); st.m.userData.face.material.emissive = new THREE.Color(COLS[i]); st.m.userData.face.material.emissiveIntensity = 0.3;
      ctx.ui.hud(seen.size < 5 ? `بقي ${5 - seen.size} درجات للقمة` : 'وصل المتعلم للقمة');
      if (seen.size === 5 && lit < 0) { lit = A.now; setTimeout(() => ctx.ui.done(), 2400); }
    });
  });
  ctx.ui.hud('المس الدرجات واصعد');

  return {
    update(t, dt, e) {
      A.update(t, dt, e); tw.update(dt);
      steps.forEach((st) => { st.m.parent.getWorldQuaternion(qa); qa.invert().multiply(ctx.camera.quaternion); st.m.quaternion.copy(qa); });
      og.scale.setScalar(0.2 + Math.sin(t * 3) * 0.02);
      core.scale.setScalar(1 + Math.sin(t * 5) * 0.06);
      gem.rotation.y = t * 1.3;
      const L = lit >= 0 ? clamp01((t - lit) / 1.2) : 0;
      gem.material.emissiveIntensity = 0.25 + L * 1.4; bg.scale.setScalar(0.001 + L * 0.34); bg.material.opacity = L * 0.8;
      rays.forEach((r, i) => { r.material.opacity = L * (0.55 + Math.sin(t * 3 + i) * 0.25); });
      arcs.forEach((a, i) => { a.userData.fill(clamp01((t - lit - 0.6 - i * 0.18) / 1.2) * (lit >= 0 ? 1 : 0)); a.userData.update(dt); });
      seeds.forEach((d) => { const k = (t * 0.12 + d.ph) % 1; d.s.position.set(Math.cos(d.a + k * 2) * d.r * (0.3 + k), 0.72 - k * 0.65, Math.sin(d.a + k * 2) * d.r * (0.3 + k)); d.s.material.opacity = Math.sin(k * Math.PI) * 0.7 * L; });
    },
  };
}
