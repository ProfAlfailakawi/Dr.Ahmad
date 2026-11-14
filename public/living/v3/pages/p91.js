import * as THREE from 'three';
import { P, ease, easeBack, clamp01, stag, mat, glossy, goldMat, shadowed, glow, lightTube } from '../../kit.js?v=40';
import { animator, plinth, shadowBlob, V, TAU, softLight } from '../lib/a1-kit.js?v=40';
import { medal, tweener, shakeX } from '../lib/b1-kit.js?v=40';

export const meta = { free: true, center: [0.46, 0.3], typeLabel: 'لعبة: صِل التطبيق بوظيفته' };

const RED = 0xe0453a, BLUE = 0x2f6fdc, TEAL = 0x22b5a8, GOLD = 0xd4ad55;
const DEV = [
  ['wires', 'وصلات بجسم اللاعب'], ['drop', 'قياس حامض اللاكتيك'], ['knee', 'جراحة الركبة على الشاشة'],
  ['bike', 'العجلة الثابتة'], ['tread', 'جهاز الجري'], ['list', 'حاسب الاتحادات'],
];
const FUN = [
  ['flame', 'قراءة السعرات المفقودة'], ['gauge', 'مؤشر التعب والتحمّل'], ['registry', 'تخزين بيانات اللاعبين'],
  ['rec', 'تسجيل لتبادل الخبرات'], ['pulse', 'بيانات النبض عند مقاومة'], ['route', 'نوع التدريب والمسافة'],
];
const PAIRS = [[0, 4], [1, 1], [2, 3], [3, 0], [4, 5], [5, 2]];
const hex = (c) => '#' + c.toString(16).padStart(6, '0');

export default function build(ctx) {
  const g = new THREE.Group(); g.position.copy(P(meta.center[0], meta.center[1])); ctx.stage.add(g);
  const A = animator(ctx, g, 0.92);
  const tw = tweener();
  g.add(shadowBlob(0.8, 0.5, 0.28));

  // the running track: a red stadium oval with white lane lines and a finished underside
  const track = new THREE.Group();
  const oval = (rx, rz, n = 80) => { const s = new THREE.Shape(); for (let i = 0; i <= n; i++) { const a = i / n * TAU; const x = Math.cos(a) * rx, y = Math.sin(a) * rz; i ? s.lineTo(x, y) : s.moveTo(x, y); } return s; };
  const shp = oval(0.2, 0.2); shp.holes.push(new THREE.Path(oval(0.135, 0.135).getPoints(80)));
  const slab = new THREE.Mesh(new THREE.ExtrudeGeometry(shp, { depth: 0.004, bevelEnabled: false, bevelSegments: 2, curveSegments: 40 }), glossy(0xd8452f, { roughness: 0.55, clearcoat: 0.3 }));
  slab.rotation.x = -Math.PI / 2; slab.position.y = 0.004;
  const lane = new THREE.Mesh(new THREE.TorusGeometry(1, 0.0012, 6, 120), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.8, toneMapped: false })); lane.rotation.x = Math.PI / 2; lane.scale.set(0.168, 0.168, 1); lane.position.y = 0.0105;
  const grass = new THREE.Mesh(new THREE.ExtrudeGeometry(oval(0.135, 0.135), { depth: 0.008, bevelEnabled: false, curveSegments: 40 }), mat(0x6fb56a, { roughness: 0.8 })); grass.rotation.x = -Math.PI / 2; grass.position.y = 0.004;
  track.add(slab, lane, grass); shadowed(track); A.add(track, { at: 0.1, dur: 0.9, rise: 0.06 });

  // the runner: a glowing dot with a short comet tail, pulse line rising off the track
  const runner = new THREE.Group(); const rd = new THREE.Mesh(new THREE.SphereGeometry(0.02, 16, 12), new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xfff0c0, emissiveIntensity: 1 })); runner.add(rd, glow(0xffd27a, 0.1, 0.9)); g.add(runner);
  const trail = []; for (let i = 0; i < 12; i++) { const s = softLight(0xffd27a, 0.03 - i * 0.002, 0); g.add(s); trail.push(s); }
  const pulse = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([[-0.26, 0.04, 0], [-0.18, 0.04, 0], [-0.15, 0.12, 0], [-0.11, -0.0, 0], [-0.07, 0.08, 0], [-0.04, 0.04, 0], [0.26, 0.04, 0]].map((a) => V(...a))), 80, 0.0035, 6), new THREE.MeshBasicMaterial({ color: 0xff7a5a, transparent: true, opacity: 0.0, toneMapped: false }));
  pulse.position.set(0, 0.0, 0.0); pulse.visible = false;

  // medallions
  const mk = (arr, side, i, col, at) => {
    const x = (side === 0 ? -1 : 1) * (i % 2 ? 0.27 : 0.405), zz = (Math.floor(i / 2) - 1) * 0.165;
    const m = medal(arr[i][0], col, 0.066, { th: 0.02, bg: hex(col), fg: '#ffffff' });
    m.position.set(x, 0.03, zz);
    const stand = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.08, 0.018, 36), glossy(0xf2ead8, { roughness: 0.4 })); stand.position.y = -0.018; m.add(stand);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.072, 0.004, 8, 40), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, toneMapped: false })); ring.rotation.x = Math.PI / 2; ring.position.y = 0.014; m.add(ring);
    shadowed(m); A.add(m, { at, dur: 0.7, rise: 0.12 });
    m.userData.keepY = false; return { m, ring, side, i, x, z: zz, matched: false, lift: 0, bump: -9 };
  };
  const dev = DEV.map((_, i) => mk(DEV, 0, i, BLUE, 0.7 + i * 0.12));
  const fun = FUN.map((_, i) => mk(FUN, 1, i, RED, 1.2 + i * 0.12));
  dev.forEach((d) => A.hint(d.m, BLUE, 0.07, 0.014, [-Math.PI / 2, 0, 0]));

  let sel = null, matched = 0, shakeT = -9, shakeObj = null;
  const tubes = [];
  const link = (d, f) => {
    const a = V(d.x, 0.07, d.z), b = V(f.x, 0.07, f.z);
    const t = lightTube(new THREE.QuadraticBezierCurve3(a, V((a.x + b.x) / 2, 0.3, (a.z + b.z) / 2), b), { radius: 0.0055, color: GOLD, speed: 0.6 }); t.userData.fill(0); g.add(t); tubes.push({ t, at: A.now });
  };
  dev.forEach((d) => A.touch(d.m, () => {
    if (d.matched) return; if (sel && sel !== d) sel.lift = 0; sel = d; d.lift = 1;
    ctx.ui.card({ tag: 'تطبيق الحاسب', title: DEV[d.i][1], body: 'اختر الوظيفة الأخص بهذا التطبيق من الصف الأحمر.', color: BLUE }); ctx.ui.hud('اختر وظيفته');
  }, { color: BLUE }));
  fun.forEach((f) => A.touch(f.m, () => {
    if (f.matched) return;
    if (!sel) { ctx.ui.toast('ابدأ بتطبيق من الصف الأزرق'); return; }
    const ok = PAIRS.some(([a, b]) => a === sel.i && b === f.i);
    if (ok) {
      sel.matched = f.matched = true; const d = sel; sel = null; d.lift = 0; matched++; link(d, f);
      [d, f].forEach((o) => { o.ring.material.opacity = 0.95; o.ring.material.color.setHex(GOLD); o.m.userData.face.material.emissive = new THREE.Color(GOLD); o.m.userData.face.material.emissiveIntensity = 0.3; });
      ctx.sfx.good?.(); ctx.fx.burst(V((d.x + f.x) / 2, 0.15, 0).add(g.position), GOLD, 20, 0.3, 0.03);
      ctx.ui.card({ tag: 'وصلة صحيحة', title: DEV[d.i][1], body: `ترتبط بـ: ${FUN[f.i][1]}.`, color: GOLD }); ctx.ui.hud(`${matched} من ٦`);
      if (matched === 6) setTimeout(() => ctx.ui.done(), 1800);
    } else { shakeT = A.now; shakeObj = f; ctx.sfx.bad?.(); ctx.ui.toast('ليست الوظيفة الأخص'); }
  }, { color: RED }));
  ctx.ui.hud('اختر تطبيقاً ثم وظيفته');

  const rp = new THREE.EllipseCurve(0, 0, 0.245, 0.122);
  return {
    update(t, dt, e) {
      A.update(t, dt, e); tw.update(dt);
      const a = -t * 0.9 - 1; const rx = Math.cos(a) * 0.168, rz = Math.sin(a) * 0.168;
      runner.position.set(rx, 0.04, rz);
      trail.forEach((s, i) => { const b = a + (i + 1) * 0.11; s.position.set(Math.cos(b) * 0.168, 0.034, Math.sin(b) * 0.168); s.material.opacity = (1 - i / 12) * 0.55 * clamp01((t - 1.5) / 1); });
      [...dev, ...fun].forEach((o) => {
        const y = o.m.userData.y1 ?? 0.03; const lift = o.lift;
        o.ring.material.opacity = o.matched ? 0.95 : lift ? 0.9 : 0;
        if (o.ring.material.opacity > 0 && !o.matched) o.ring.material.color.setHex(BLUE);
        o.m.position.x = o.x + (shakeObj === o ? shakeX(shakeT, t, 0.012) : 0);
        o.m.rotation.y = lift ? t * 1.5 : o.matched ? Math.sin(t * 1.4 + o.i) * 0.3 : 0;
      });
      tubes.forEach((u) => { u.t.userData.fill(clamp01((t - u.at) / 0.9)); u.t.userData.update(dt); });
    },
  };
}
