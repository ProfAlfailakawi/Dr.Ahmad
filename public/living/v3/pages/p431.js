// p431 — Arab ICT indicators: a night-city disc, a glowing tower for Dubai (its ranks float at the height of their rank), and two glass gauges: Bahrain's internet and Kuwait's phones that overflow 100%.
import * as THREE from 'three';
import { P, ease, easeBack, clamp01, stag, mat, glossy, goldMat, shadowed, glow, sprite } from '../../kit.js?v=15';
import { inked } from '../../pencil.js?v=15';
import { lightPool } from '../../v2/common.js?v=15';
import { Seq, Hints, Tag, TAU, V, wpos } from '../lib/a9-kit.js?v=15';

export const meta = { free: true, center: [0.28, 0.608], typeLabel: 'أبراج المؤشرات', title: 'مؤشرات المنطقة العربية' };

const C = {
  bh: { t: 'البحرين أولى خليجياً', tag: 'إنترنت ٧٤٫١٥٪', b: 'جاءت البحرين أولى بعد أن سجلت ٧٤٫١٥٪ في معدلات استخدام شبكة الإنترنت عام ٢٠١٥.', c: 0x2fc7c0 },
  kw: { t: 'الكويت: أعلى انتشار للهواتف', tag: 'هواتف ١٩٤٫٦٢٪', b: 'حققت الكويت أعلى نسبة في انتشار الهواتف النقالة بـ ١٩٤٫٦٢٪، أي أكثر من هاتف لكل فرد.', c: 0xef8f2a },
  dubai: { t: 'دبي بين أفضل عشر مدن', tag: 'دبي', b: 'أثبتت دبي مكانة مرموقة ضمن أفضل ١٠ مدن في الحوكمة الرقمية عام ٢٠١٤، متفوقة على لندن وأوسلو وفيينا.', c: 0xd4ad55 },
  r9: { t: 'التاسعة عالمياً', tag: 'المؤشر العام', b: 'احتلت دبي المرتبة التاسعة عالمياً وفق المؤشر العام في دراسة جامعة روتجرز (٢٠١٤).', c: 0xd4ad55 },
  r4: { t: 'الرابعة في تسليم الخدمات', tag: 'تسليم الخدمات', b: 'جاءت دبي في المرتبة الرابعة من حيث تسليم الخدمات في الدراسة نفسها.', c: 0x4fb3e8 },
  r5: { t: 'الخامسة في الأمن', tag: 'الخصوصية والأمن', b: 'وجاءت في المرتبة الخامسة من حيث الخصوصية والأمن.', c: 0x4cc38f },
};
const UNIT = 0.2; // height of 100 %

export default function build(ctx) {
  const g = new THREE.Group(); g.position.copy(P(meta.center[0], meta.center[1])); ctx.stage.add(g); g.scale.setScalar(0.72);
  const seq = new Seq(), hints = new Hints(g, 6.0), tag = new Tag(g, 0.23);
  const brass = goldMat(), seen = new Set(); let finished = false, now = 0;

  // a night pool of soft dark blue under the skyline (no hard base) and two crossing highways drawn in light
  const night = lightPool(0x0a1838, 0.42, 0.0); night.position.y = 0.003; g.add(night);
  const hw = (pts, col, w) => { const m = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map(([x, z]) => V(x, 0.006, z)), false, 'catmullrom', 0.5), 120, w, 6), new THREE.MeshBasicMaterial({ color: col, toneMapped: false })); m.scale.y = 0.35; g.add(m); return m; };
  const road = hw([[-0.38, 0.22], [-0.2, 0.14], [-0.02, 0.2], [0.18, 0.1], [0.38, 0.2]], 0xff9a3c, 0.0055);
  const road2 = hw([[-0.36, -0.06], [-0.15, 0.0], [0.05, -0.16], [0.22, -0.02], [0.38, -0.12]], 0xfff2d8, 0.0035);
  seq.add(road, 0.5, 0.8); seq.add(road2, 0.6, 0.8);
  // low city blocks
  const city = new THREE.Group(); g.add(city);
  const bm = new THREE.MeshStandardMaterial({ color: 0x2c4a7e, emissive: 0x2a6fb8, emissiveIntensity: 0.55, roughness: 0.4 });
  for (let i = 0; i < 22; i++) {
    const a = i * TAU / 22 + 0.1, r = 0.15 + (i % 3) * 0.035; const h = 0.025 + ((i * 37) % 7) * 0.012;
    const b = new THREE.Mesh(new THREE.BoxGeometry(0.03 + (i % 2) * 0.012, h, 0.03 + (i % 3) * 0.006), bm); b.position.set(Math.cos(a) * r, h / 2, Math.sin(a) * r); b.rotation.y = -a; city.add(b);
  }
  city.scale.setScalar(0.0001); seq.add(city, 1.0, 1.0);

  // the tower
  const tower = new THREE.Group(); tower.position.y = 0; g.add(tower);
  const prof = [[0.05, 0], [0.05, 0.07], [0.04, 0.12], [0.04, 0.2], [0.03, 0.26], [0.03, 0.32], [0.02, 0.38], [0.014, 0.44], [0.008, 0.5], [0.002, 0.58]];
  const tmat = new THREE.MeshPhysicalMaterial({ color: 0x6fb8ee, emissive: 0x2a74c0, emissiveIntensity: 0.6, roughness: 0.15, metalness: 0.2, clearcoat: 1 });
  const body = new THREE.Mesh(new THREE.LatheGeometry(prof.map(([x, y]) => new THREE.Vector2(x, y)), 6), tmat); tower.add(shadowed(body));
  [0.12, 0.2, 0.26, 0.32, 0.38, 0.44].forEach((y, i) => { const r = new THREE.Mesh(new THREE.TorusGeometry(0.052 - i * 0.007, 0.0016, 6, 6), brass); r.rotation.x = Math.PI / 2; r.position.y = y; r.rotation.z = 0; tower.add(r); });
  const spire = glow(0xffe3a0, 0.18, 0.9); spire.position.y = 0.55; tower.add(spire);
  const tglow = glow(0x6fb8ee, 0.5, 0.4); tglow.position.y = 0.2; tower.add(tglow);
  const hitT = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.5, 10), new THREE.MeshBasicMaterial({ visible: false })); hitT.position.y = 0.25; tower.add(hitT);
  seq.add(tower, 1.3, 1.4);

  // rank orbs: the better the rank, the higher the orb
  const orbs = [['r9', 9, 0xd4ad55, '٩', 0.0], ['r4', 4, 0x4fb3e8, '٤', 2.1], ['r5', 5, 0x4cc38f, '٥', 4.2]].map(([k, rank, col, num, ph]) => {
    const grp = new THREE.Group(); g.add(grp);
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.042, 20, 14), new THREE.MeshStandardMaterial({ color: col, emissive: col, emissiveIntensity: 0.6, roughness: 0.2 })); grp.add(m);
    const num3 = sprite(num, 0.085, { size: 110, width: 200, weight: 800, color: '#14213d', bg: null, shadow: false, pad: 8 }); num3.position.y = 0; num3.userData.aspect = 0; num3.material.depthTest = false; grp.add(num3); // a glyph on the orb, not a label
    const h = hints.add(V(), col, 0.16);
    const y = 0.5 - rank * 0.032;
    seq.add(grp, 2.4 + ph * 0.1, 0.8);
    return { k, grp, ph, y, h, col, num3 };
  });

  // two glass gauges
  function gauge(x, value, col, key, delay) {
    const grp = new THREE.Group(); grp.position.set(x, 0.0, 0.14); g.add(grp);
    const H = 0.42;
    const glassM = new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.036, H, 28, 1, true), new THREE.MeshPhysicalMaterial({ color: 0xffffff, transparent: true, opacity: 0.18, roughness: 0.05, clearcoat: 1, side: THREE.DoubleSide, depthWrite: false })); glassM.position.y = H / 2; glassM.renderOrder = 4; grp.add(glassM);
    const liquid = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1, 24), new THREE.MeshStandardMaterial({ color: col, emissive: col, emissiveIntensity: 0.45, roughness: 0.3 })); grp.add(liquid);
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.003, 24), new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false, transparent: true, opacity: 0.8 })); grp.add(cap);
    const baseM = new THREE.Mesh(new THREE.CylinderGeometry(0.044, 0.05, 0.018, 28), brass); baseM.position.y = 0.0; grp.add(baseM);
    const top = new THREE.Mesh(new THREE.CylinderGeometry(0.039, 0.039, 0.01, 28), brass); top.position.y = H; grp.add(top);
    for (let k = 1; k <= 2; k++) { const r = new THREE.Mesh(new THREE.TorusGeometry(0.0385, k === 1 ? 0.0032 : 0.0018, 6, 30), k === 1 ? brass : new THREE.MeshBasicMaterial({ color: 0xffd27a, toneMapped: false })); r.rotation.x = Math.PI / 2; r.position.y = UNIT * k; grp.add(r); }
    const hit = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, H, 10), new THREE.MeshBasicMaterial({ visible: false })); hit.position.y = H / 2; grp.add(hit);
    const hint = hints.add(V(x, 0.28, 0.14), col, 0.14);
    seq.add(baseM, delay, 0.6); seq.add(glassM, delay + 0.1, 0.7); seq.add(top, delay + 0.2, 0.5);
    const st = { grp, liquid, cap, value, hint, key, hit, pulse: -9 };
    ctx.tap(hit, () => see(key, V(x, 0.5, 0.14)));
    return st;
  }
  const bh = gauge(-0.23, 0.7415, 0x2fc7c0, 'bh', 1.1), kw = gauge(0.23, 1.9462, 0xef8f2a, 'kw', 1.3);
  bh.hit.userData.k = 'bh'; kw.hit.userData.k = 'kw';

  function see(k, pos) {
    const c = C[k]; ctx.sfx.pop?.(); ctx.ui.card({ tag: 'مؤشر', title: c.t, body: c.b, color: c.c }); tag.show(c.tag, pos, c.c); seen.add(k);
    if (k === 'bh') { bh.pulse = now; bh.hint.on = false; } if (k === 'kw') { kw.pulse = now; kw.hint.on = false; }
    if (seen.size === 6 && !finished) { finished = true; setTimeout(() => { ctx.fx.burst(wpos(g, V(0, 0.3, 0)), 0xffd27a, 50, 0.55, 0.04); ctx.ui.done(); ctx.ui.hud('عرفت مؤشرات المنطقة'); }, 900); }
  }
  ctx.tap(hitT, () => { see('dubai', V(0, 0.68, 0)); ctx.fx.burst(wpos(g, V(0, 0.55, 0)), 0xffe3a0, 24, 0.3, 0.03); });
  orbs.forEach((o) => ctx.tap(o.grp, () => { see(o.k, o.grp.position.clone().add(V(0, 0.115, 0))); o.h.on = false; }));
  ctx.ui.hud('المس البرج والمقاييس والكرات');

  return {
    update(t, dt, e) {
      now = t; seq.update(t, e); hints.update(t, e); tag.update(dt, e);
      tower.rotation.y = t * 0.12; night.material.opacity = 0.5 * clamp01(t * 1.2) * e; spire.material.opacity = 0.7 + 0.3 * Math.sin(t * 3); tglow.material.opacity = 0.35 + 0.1 * Math.sin(t * 1.5);
      [bh, kw].forEach((q) => {
        const f = ease((t - 2.0) / 2.4) * e, v = q.value * f; const hgt = Math.max(v * UNIT, 0.001);
        const wob = clamp01(1 - (t - q.pulse) / 1.0) * Math.sin((t - q.pulse) * 30) * 0.006 * (q.pulse > 0);
        q.liquid.scale.set(1, hgt + wob, 1); q.liquid.position.y = (hgt + wob) / 2 + 0.009; q.cap.position.y = hgt + wob + 0.01;
      });
      orbs.forEach((o, i) => { const a = t * 0.5 + o.ph; o.grp.position.set(Math.cos(a) * 0.11, o.y + Math.sin(t * 1.4 + i) * 0.006, Math.sin(a) * 0.11); o.h.h.position.copy(o.grp.position); o.num3.visible = true; });
      city.children.forEach((b, i) => { b.material.emissiveIntensity = 0.55; });
    },
  };
}
