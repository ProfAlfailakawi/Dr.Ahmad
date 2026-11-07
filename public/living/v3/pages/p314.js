import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { P, ease, easeBack, clamp01, stag, mat, glossy, goldMat, shadowed, glow, sprite, lightTube } from '../../kit.js?v=16';
import { toAr, revealer, hintGlow, pulseHint, bumper, canvasTex, faceMat, setSpr, burstAt, retext, fillText } from '../lib/a6-kit.js?v=16';

export const meta = { free: true, center: [0.5, 0.72], typeLabel: 'خط زمني مجسّم' };

const ERAS = [
  { when: 'قبل ١٥٠٠ سنة', t: 'الشطرنج عند الهنود', c: 0xd4ad55, b: 'استعمل الهنود لعبة الشطرنج قبل نحو ١٥٠٠ سنة. وانتشر اللعب الإيهامي وتمثيل الأدوار في المدارس منذ زمن طويل.' },
  { when: 'القرن التاسع عشر', t: 'ألعاب الحرب لدى البروسيين', c: 0xe0603f, b: 'استبدل البروسيون بقطع الشطرنج الجنود والضباط، وصارت الخرائط وأرض المعارك لوحة اللعب.' },
  { when: 'بعد الحرب الثانية', t: 'الألعاب في الأعمال والإدارة', c: 0x2a8fd0, b: 'مع تعدد استعمالات الحاسوب استعمل الاقتصاديون ورجال الأعمال الألعاب لتوضيح العمليات، ونقل الواقع إلى موقع التدريب.' },
  { when: 'نهاية الخمسينيات', t: 'اتساع المجال التعليمي', c: 0x7aa13a, b: 'أدخل التربويون الألعاب في مساقات العلوم السياسية لطلبة الدراسات العليا، وفي مجال التدريب والتعليم.' },
];
const POS = [[0.33, 0.06], [0.11, -0.06], [-0.11, 0.06], [-0.33, -0.06]];
const IS = 1.75;

function pawnGeo(s = 1) {
  const pts = [[0, 0], [0.022, 0], [0.024, 0.005], [0.013, 0.012], [0.009, 0.03], [0.017, 0.034], [0.017, 0.038], [0.009, 0.042], [0.015, 0.05], [0.011, 0.06], [0.003, 0.066], [0, 0.067]].map(([x, y]) => new THREE.Vector2(x * s, y * s));
  return new THREE.LatheGeometry(pts, 28);
}

export default function build(ctx) {
  const g = new THREE.Group(); g.position.copy(P(meta.center[0], meta.center[1])); ctx.stage.add(g);
  const R = revealer(), B = bumper();

  // a path of light drawn over the page that links the four stations
  const gp = (i, dz = 0) => new THREE.Vector3(POS[i][0], 0.008, POS[i][1] + dz);
  const curve = new THREE.CatmullRomCurve3([gp(0, 0.12), gp(1, 0.12), gp(2, 0.12), gp(3, 0.12)], false, 'catmullrom', 0.5);
  const tube = lightTube(curve, { radius: 0.0055, color: 0xffc95a, speed: 0.45, glass: false }); g.add(tube); tube.userData.fill(0);

  const stations = ERAS.map((era, i) => {
    const s = new THREE.Group(); s.position.set(POS[i][0], 0, POS[i][1]); g.add(s);
    const inner = new THREE.Group(); s.add(inner);
    const item = new THREE.Group(); item.scale.setScalar(IS); inner.add(item);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.0035, 8, 48), new THREE.MeshBasicMaterial({ color: era.c, toneMapped: false, transparent: true, opacity: 0.85 })); ring.rotation.x = Math.PI / 2; ring.position.y = 0.004; inner.add(ring);
    const hint = hintGlow(era.c, 0.28); hint.position.y = 0.06; inner.add(hint);
    const hxc = '#' + era.c.toString(16).padStart(6, '0');
    const numTex = canvasTex(128, 128, (c) => { c.fillStyle = hxc; c.beginPath(); c.arc(64, 64, 58, 0, Math.PI * 2); c.fill(); c.strokeStyle = '#fff'; c.lineWidth = 6; c.beginPath(); c.arc(64, 64, 52, 0, Math.PI * 2); c.stroke(); fillText(c, toAr(i + 1), 64, 70, 78, '#ffffff', 800, '"Reem Kufi", Tajawal'); });
    const tag = new THREE.Mesh(new THREE.PlaneGeometry(0.085, 0.085), new THREE.MeshBasicMaterial({ map: numTex, transparent: true, depthWrite: false, toneMapped: false })); tag.rotation.x = -Math.PI / 2; tag.position.set(0, 0.006, 0.15); s.add(tag);
    return { s, inner, item, ring, hint, tag, era };
  });

  const lab = sprite('قبل ١٥٠٠ سنة', 0.3, { size: 44, width: 560, weight: 800, border: '#d4ad55', color: '#2b2620', bg: 'rgba(251,248,240,.98)' }); g.add(lab);
  let labAt = -1, labT = -9;

  // 1 chess
  {
    const { item } = stations[0];
    const tex = canvasTex(256, 256, (c) => { for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) { c.fillStyle = (x + y) % 2 ? '#3a2d22' : '#f1e4c8'; c.fillRect(x * 64, y * 64, 64, 64); } });
    const slab = new THREE.Mesh(new RoundedBoxGeometry(0.09, 0.01, 0.09, 2, 0.003), [mat(0x6b4f3f), mat(0x6b4f3f), faceMat(tex), mat(0x6b4f3f), mat(0x6b4f3f), mat(0x6b4f3f)]);
    slab.position.y = 0.005; item.add(slab);
    const king = new THREE.Mesh(pawnGeo(1.5), glossy(0xf2e8d0)); king.position.set(0.012, 0.01, -0.01); item.add(king);
    const cross = new THREE.Mesh(new RoundedBoxGeometry(0.004, 0.016, 0.004, 1, 0.001), goldMat()); cross.position.set(0.012, 0.01 + 0.108, -0.01); item.add(cross);
    const p2 = new THREE.Mesh(pawnGeo(1.05), glossy(0x3a2d22)); p2.position.set(-0.022, 0.01, 0.018); item.add(p2);
    const p3 = new THREE.Mesh(pawnGeo(0.85), glossy(0x3a2d22)); p3.position.set(0.026, 0.01, 0.02); item.add(p3);
    shadowed(item);
  }
  // 2 war map
  const soldiers = [];
  {
    const { item } = stations[1];
    const tex = canvasTex(256, 256, (c) => {
      c.fillStyle = '#c9d8a2'; c.fillRect(0, 0, 256, 256); c.strokeStyle = '#8a6a3a'; c.lineWidth = 5;
      c.beginPath(); c.moveTo(0, 150); c.bezierCurveTo(70, 90, 150, 200, 256, 120); c.stroke();
      c.strokeStyle = '#6aa0c8'; c.lineWidth = 9; c.beginPath(); c.moveTo(40, 0); c.bezierCurveTo(100, 80, 60, 170, 130, 256); c.stroke();
    });
    const slab = new THREE.Mesh(new RoundedBoxGeometry(0.1, 0.01, 0.1, 2, 0.003), [mat(0x8a7a50), mat(0x8a7a50), faceMat(tex), mat(0x8a7a50), mat(0x8a7a50), mat(0x8a7a50)]);
    slab.position.y = 0.005; item.add(slab);
    const sm = [glossy(0xc0392b), glossy(0x2a5fb0)];
    for (let k = 0; k < 8; k++) {
      const sol = new THREE.Group();
      const body = new THREE.Mesh(new THREE.CylinderGeometry(0.0048, 0.0068, 0.018, 10), sm[k < 4 ? 0 : 1]); body.position.y = 0.009; sol.add(body);
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.0055, 10, 8), mat(0xf0d8b0)); head.position.y = 0.0145; sol.add(head);
      sol.position.set(((k % 4) - 1.5) * 0.021, 0.01, k < 4 ? -0.026 : 0.026); sol.userData.home = sol.position.clone(); sol.userData.k = k;
      item.add(sol); soldiers.push(sol);
    }
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.0015, 0.0015, 0.06, 6), mat(0x6b4f3f)); pole.position.set(0.042, 0.04, -0.036); item.add(pole);
    const flag = new THREE.Mesh(new THREE.PlaneGeometry(0.026, 0.017), new THREE.MeshBasicMaterial({ color: 0xc0392b, side: THREE.DoubleSide })); flag.position.set(0.055, 0.062, -0.036); item.add(flag);
    stations[1].flag = flag; shadowed(item);
  }
  // 3 monitor with business bars
  const bars = [];
  {
    const { item } = stations[2];
    const body = new THREE.Mesh(new RoundedBoxGeometry(0.09, 0.064, 0.012, 3, 0.004), glossy(0xe9e6df)); body.position.set(0, 0.05, 0); item.add(body);
    const tex = canvasTex(256, 192, (c, w, h) => { c.fillStyle = '#12304f'; c.fillRect(0, 0, w, h); c.strokeStyle = '#3b6ea5'; c.lineWidth = 2; for (let i = 1; i < 5; i++) { c.beginPath(); c.moveTo(0, i * 38); c.lineTo(w, i * 38); c.stroke(); } c.strokeStyle = '#ffd27a'; c.lineWidth = 6; c.beginPath(); c.moveTo(20, 150); c.lineTo(80, 110); c.lineTo(130, 126); c.lineTo(190, 60); c.lineTo(236, 30); c.stroke(); });
    const scr = new THREE.Mesh(new THREE.PlaneGeometry(0.08, 0.055), faceMat(tex)); scr.position.set(0, 0.05, 0.0066); item.add(scr);
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.007, 0.02, 10), mat(0xbdb7aa)); neck.position.y = 0.012; item.add(neck);
    const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.026, 0.004, 20), mat(0xbdb7aa)); foot.position.y = 0.002; item.add(foot);
    [0, 1, 2, 3].forEach((k) => { const m = new THREE.Mesh(new RoundedBoxGeometry(0.013, 1, 0.013, 1, 0.002), glossy([0x2a8fd0, 0xffd27a, 0x7aa13a, 0xe0603f][k])); m.position.set(-0.033 + k * 0.022, 0, 0.042); m.userData.k = k; item.add(m); bars.push(m); });
    shadowed(body);
  }
  // 4 cap on books
  const cap = new THREE.Group();
  {
    const { item } = stations[3];
    [[0x2a5fb0, 0.09], [0xe0603f, 0.08], [0xd4ad55, 0.07]].forEach(([c, w], k) => { const bk = new THREE.Mesh(new RoundedBoxGeometry(w, 0.013, 0.06, 2, 0.003), glossy(c)); bk.position.set(0.004 * (k - 1), 0.0065 + k * 0.013, 0); bk.rotation.y = (k - 1) * 0.18; item.add(bk); });
    cap.position.y = 0.055; item.add(cap);
    const bd = new THREE.Mesh(new RoundedBoxGeometry(0.08, 0.006, 0.08, 1, 0.001), glossy(0x1f2a44)); bd.rotation.y = Math.PI / 4; bd.position.y = 0.016; cap.add(bd);
    const cr = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.028, 0.022, 20), glossy(0x1f2a44)); cr.position.y = 0.002; cap.add(cr);
    const ts = new THREE.Mesh(new THREE.CylinderGeometry(0.0012, 0.0012, 0.032, 6), goldMat()); ts.position.set(0.032, 0, 0); ts.rotation.z = 0.2; cap.add(ts);
    const tb = new THREE.Mesh(new THREE.SphereGeometry(0.0045, 10, 8), goldMat()); tb.position.set(0.037, -0.016, 0); cap.add(tb);
    shadowed(item);
  }

  // the golden traveller walks the path
  const trav = new THREE.Group(); g.add(trav);
  const tp = new THREE.Mesh(pawnGeo(2.2), goldMat()); trav.add(tp); shadowed(trav);
  const tglow = glow(0xffd27a, 0.16, 0.55); tglow.position.y = 0.08; trav.add(tglow);
  const stPos = (i) => new THREE.Vector3(POS[i][0], 0.012, POS[i][1] + 0.13);
  let at = 0, to = 0, hopT0 = -9, from = stPos(0), now = 0, auto = true, nextAuto = 2.4;
  const visited = new Set();
  trav.position.copy(stPos(0));

  function hop(i, byUser) {
    if (i === at && hopT0 > now - 0.8) return;
    from = trav.position.clone(); to = i; hopT0 = now; ctx.sfx.pop?.();
    if (byUser) auto = false;
  }
  function touch(i) {
    hop(i, true); visited.add(i);
    const e = ERAS[i];
    setTimeout(() => burstAt(ctx, g, stPos(i).add(new THREE.Vector3(0, 0.06, 0)), e.c, 26, 0.42, 0.032), 520);
    ctx.ui.card({ tag: e.when, title: e.t, body: e.b, color: e.c });
    B.hit(stations[i].inner, now, 0.1);
    if (visited.size === 4) setTimeout(() => { ctx.sfx.good?.(); ctx.ui.done(); }, 1400);
  }
  stations.forEach((st, i) => ctx.tap(st.s, () => touch(i)));
  ctx.ui.hud('المس المحطات لتتبع تطور الألعاب');

  const v3 = new THREE.Vector3();
  return {
    update(t, dt, e) {
      now = t; R.update(t, e); B.update(t);
      tube.userData.update(dt); tube.userData.fill(clamp01(stag(t, 0.5, 2.6, ease)) * e);
      stations.forEach((st, i) => {
        const k = stag(t, 0.3 + i * 0.45, 0.8, easeBack) * e;
        st.inner.scale.setScalar(Math.max(k, 0.001)); st.s.visible = k > 0.01;
        st.item.rotation.y = 0.2 * Math.sin(t * 0.6 + i);
        st.tag.scale.setScalar(Math.max(stag(t, 0.7 + i * 0.4, 0.5, easeBack) * e * (1 + 0.08 * Math.sin(t * 2 + i)), 0.001));
        pulseHint(st.hint, t, i * 1.3, visited.has(i) ? 0.25 : 1, 0.4);
        st.ring.material.opacity = visited.has(i) || i === at ? 0.95 : 0.45;
      });
      soldiers.forEach((s) => { const w = Math.sin(t * 2 + s.userData.k); s.position.z = s.userData.home.z + (s.userData.k < 4 ? 1 : -1) * 0.005 * (1 + w); s.position.y = 0.01 + Math.abs(Math.sin(t * 6 + s.userData.k)) * 0.002; });
      stations[1].flag.rotation.y = Math.sin(t * 3) * 0.25;
      bars.forEach((b) => { const h = 0.012 + 0.03 * (0.5 + 0.5 * Math.sin(t * 1.4 + b.userData.k * 1.3 + 1)) * (0.6 + 0.12 * (b.userData.k + 1)); b.scale.y = h; b.position.y = h / 2 + 0.004; });
      cap.rotation.y = t * 0.5; cap.position.y = 0.055 + 0.006 * Math.sin(t * 1.8);
      if (auto && t > nextAuto) { nextAuto = t + 2.0; hop((at + 1) % 4, false); }
      const p = clamp01((t - hopT0) / 0.8);
      if (p < 1) {
        v3.copy(stPos(to)); trav.position.lerpVectors(from, v3, ease(p)); trav.position.y += Math.sin(p * Math.PI) * 0.1;
        const sq = 1 + 0.15 * Math.sin(p * Math.PI); trav.scale.set(sq, 2 - sq, sq);
      } else { at = to; trav.position.copy(stPos(at)); trav.scale.setScalar(1); }
      if (p >= 1 && labAt !== at) { labAt = at; labT = t; const era = ERAS[at]; retext(lab, era.when, 0.3, { size: 44, width: 560, weight: 800, border: '#' + era.c.toString(16).padStart(6, '0'), color: '#2b2620', bg: 'rgba(251,248,240,.98)' }); }
      if (p < 1) labAt = -1;
      lab.position.set(THREE.MathUtils.clamp(POS[at][0], -0.2, 0.2), 0.36, POS[at][1]); setSpr(lab, 0.3, labAt === at ? stag(t, labT, 0.45, easeBack) * stag(t, 1.4, 0.4) * e : 0);
      const tk = stag(t, 1.0, 0.7, easeBack) * e; trav.visible = tk > 0.01; tp.scale.setScalar(Math.max(tk, 0.001));
      tglow.material.opacity = 0.45 * tk * (0.8 + 0.2 * Math.sin(t * 5));
    },
  };
}
