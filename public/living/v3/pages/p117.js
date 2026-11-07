// p117 — the iceberg of communication: a big glass tank, 7% words above the water, 38% voice and 55% body below; four skills in front.
import * as THREE from 'three';
import { P, ease, easeBack, clamp01, stag, glow } from '../../kit.js?v=15';
import { rb, lathe, std, lit, gloss, glass, brass, add, grp, hit, Seq, Pulse, touch, chip, blob, at, TAU, INK, GOLD } from '../lib/a2.js?v=15';

export const meta = { free: true, center: [0.5, 0.7], typeLabel: 'مجسّم تفاعلي' };

function crystal(r, sx, sy, sz, seed, amp = 0.8) {
  const geo = new THREE.IcosahedronGeometry(r, 1);
  const p = geo.attributes.position, v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const n = Math.sin(v.x * 23.1 + seed) * Math.cos(v.y * 19.7 + seed * 1.3) + Math.sin(v.z * 27.3 - seed * 0.7) * 0.7 + Math.sin((v.x + v.z) * 41 + seed) * 0.25 + Math.abs(Math.sin(v.y * 31 + seed)) * 0.5;
    const q = 1 + amp * 0.45 * n;
    v.multiplyScalar(q); v.x *= sx; v.y *= sy; v.z *= sz;
    p.setXYZ(i, v.x, v.y, v.z);
  }
  geo.deleteAttribute('normal');
  const flat = geo.toNonIndexed ? geo : geo;
  flat.computeVertexNormals();
  return flat;
}

export default function build(ctx) {
  const g = new THREE.Group(); g.position.copy(P(meta.center[0], meta.center[1])); ctx.stage.add(g);
  const seq = new Seq(), pulse = new Pulse(), seen = new Set();
  const found = (k) => { seen.add(k); if (seen.size >= 7) ctx.ui.done(); else ctx.ui.hud(`${seen.size} من ٧`); };
  const Y0 = 0.014;
  blob(g, 0.95, 0.55, 0.3, 0, -0.06);

  const tank = grp(g, 0, Y0, -0.08);
  const W = 0.74, H = 0.5, D = 0.3, WL = 0.28;
  add(tank, rb(W + 0.03, 0.016, D + 0.03, 0.006, 2), std(0xf3ebd9), 0, -0.006, 0, true);
  add(tank, rb(W + 0.04, 0.006, D + 0.04, 0.003, 2), brass(), 0, 0.004, 0);
  // water with a vertical gradient (lighter at the top)
  const wg = new THREE.BoxGeometry(W - 0.008, 1, D - 0.008), col = [], pos = wg.attributes.position, c1 = new THREE.Color(0x1d7fc8), c2 = new THREE.Color(0x7edcf5), tc = new THREE.Color();
  for (let i = 0; i < pos.count; i++) { tc.copy(c1).lerp(c2, pos.getY(i) + 0.5); col.push(tc.r, tc.g, tc.b); }
  wg.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  const water = add(tank, wg, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.55, depthWrite: false, toneMapped: false }), 0, 0.001, 0); water.renderOrder = 2; water.scale.y = 1e-3;
  const surf = add(tank, new THREE.PlaneGeometry(W - 0.008, D - 0.008), new THREE.MeshBasicMaterial({ color: 0xdff8ff, transparent: true, opacity: 0.5, depthWrite: false, side: THREE.DoubleSide, toneMapped: false }), 0, WL, 0); surf.rotation.x = -Math.PI / 2; surf.renderOrder = 3;
  const edges = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(W, H, D)), new THREE.LineBasicMaterial({ color: 0xd0a040 })); edges.position.y = H / 2; tank.add(edges);
  const panes = add(tank, new THREE.BoxGeometry(W, H, D), glass(0xeaf8ff, 0.08), 0, H / 2, 0); panes.renderOrder = 4;
  seq.add(tank, 0.0, 0.6, { rise: 0 });

  const ice = (col, em) => new THREE.MeshPhysicalMaterial({ color: col, emissive: col, emissiveIntensity: em, roughness: 0.15, clearcoat: 1, flatShading: true, transparent: true, opacity: 0.96 });
  const tiers = [
    { k: 'body', col: 0xff9d5c, geo: crystal(0.19, 1.5, 0.6, 1.0, 1.2, 1.0), y: 0.1, delay: 0.5 },
    { k: 'voice', col: 0x55d0e0, geo: crystal(0.14, 1.3, 0.8, 1.0, 4.1, 1.0), y: 0.19, delay: 0.9 },
    { k: 'words', col: 0xf2fbff, geo: crystal(0.085, 0.85, 1.7, 0.85, 7.7, 1.3), y: 0.35, delay: 1.3 },
  ].map((o) => { const m = add(tank, o.geo, ice(o.col, 0.22), 0, o.y, 0, true); o.mesh = m; o.hold = grp(tank, 0, 0, 0); o.hold.add(m); seq.add(o.hold, o.delay, 0.8, { rise: 0.14 }); hit(o.hold, o.k === 'words' ? 0.1 : 0.17, 0, o.y, 0); o.pop = -1; return o; });
  const motes = Array.from({ length: 16 }, (_, i) => { const s = glow(0xffffff, 0.016, 0.8); tank.add(s); s.userData.ph = i * 0.9; return s; });
  const ringM = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false });
  const ripple = add(tank, new THREE.TorusGeometry(0.06, 0.003, 6, 48), ringM, 0, WL + 0.001, 0); ripple.rotation.x = Math.PI / 2;
  let rip = -1;
  const cards = {
    body: { title: 'تعبيرات الجسم ٥٥٪', body: 'وجد مهرابيان أن ٩٣٪ من الاتصال غير ملفوظ، وتعبيرات الجسم تمثل ٥٥٪ منه.', color: 0xef8f2a },
    voice: { title: 'نبرة الصوت ٣٨٪', body: 'إذا لم يكن الصوت واضحاً عُدّ عامل تشويش.', color: 0x1f9aa6 },
    words: { title: 'الكلمات ٧٪ فقط', body: 'المستقبل يستمع ويعبّر أكثر من الكلام.', color: 0x5a6fd6 },
  };
  tiers.forEach((o) => touch(ctx, o.hold, () => { o.pop = 0; rip = 0; ctx.ui.card({ tag: 'مهرابيان', ...cards[o.k] }); found(o.k); }, o.col));
  [['٥٥٪', 0.04, 0xef8f2a], ['٣٨٪', 0.2, 0x1f9aa6], ['٧٪', 0.43, 0x5a6fd6]].forEach(([t, y, col], i) => {
    const c = chip(t, 0, col, { k: 1.15 }); c.position.set(0.29, y, 0.19); tank.add(c); seq.add(c, 1.6 + i * 0.2, 0.5);
  });

  // ---------------- four skills on coasters in front of the tank
  const skills = [];
  const stand = (x, col) => {
    const s = grp(g, x, Y0, 0.3); s.scale.setScalar(1.55);
    add(s, new THREE.CylinderGeometry(0.046, 0.05, 0.018, 28), std(0xf3ecdc, { roughness: 0.5 }), 0, 0.009, 0, true);
    const t = add(s, new THREE.TorusGeometry(0.047, 0.003, 6, 40), brass(), 0, 0.018, 0); t.rotation.x = Math.PI / 2;
    const top = grp(s, 0, 0.018, 0); hit(s, 0.06, 0, 0.04, 0); pulse.add(s, col, 0.15, 0, 0.04, 0, { op: 0.45 });
    return [s, top];
  };
  { const [s, t] = stand(0.285, 0xe0602f); const m = grp(t, 0, 0.03, 0); m.rotation.z = -0.5;
    const cone = add(m, new THREE.CylinderGeometry(0.036, 0.012, 0.06, 24, 1, true), gloss(0xe0602f, { side: THREE.DoubleSide }), 0.02, 0, 0, true); cone.rotation.z = -Math.PI / 2;
    add(m, new THREE.CylinderGeometry(0.014, 0.014, 0.03, 16), gloss(0x2b2620), -0.034, 0, 0).rotation.z = Math.PI / 2;
    add(m, new THREE.TorusGeometry(0.036, 0.003, 6, 28), brass(), 0.05, 0, 0).rotation.y = Math.PI / 2;
    skills.push({ s, k: 'speak', col: 0xe0602f, title: 'مهارة التحدث', body: 'أن يقدر المرسل على الكلام، ويدرك التوقيت المناسب للكلام والصمت.' }); }
  { const [s, t] = stand(0.095, 0x3b6fd0); const pen = grp(t, 0, 0.034, 0); pen.rotation.z = 0.7;
    add(pen, new THREE.CylinderGeometry(0.006, 0.006, 0.07, 12), gloss(0x3b6fd0), 0, 0, 0, true);
    add(pen, new THREE.ConeGeometry(0.006, 0.02, 12), brass(), 0, -0.045, 0).rotation.x = Math.PI;
    add(pen, new THREE.SphereGeometry(0.0065, 10, 8), brass(), 0, 0.036, 0);
    add(t, rb(0.05, 0.004, 0.036, 0.002, 2), std(0xfbf6ea), 0, 0.003, 0.0);
    skills.push({ s, k: 'write', col: 0x3b6fd0, title: 'مهارة الكتابة', body: 'إذا لم يتقن المرسل الكتابة اكتفى بكتابة ما يريد إرساله.' }); }
  { const [s, t] = stand(-0.095, 0x8a9a1f);
    [-1, 1].forEach((d) => { const pg = grp(t, d * 0.017, 0.012, 0); pg.rotation.z = -d * 0.22; add(pg, rb(0.034, 0.005, 0.048, 0.002, 2), std(0xfbf6ea), 0, 0, 0, true); add(pg, rb(0.036, 0.003, 0.05, 0.002, 2), std(0x8a9a1f), 0, -0.004, 0); });
    skills.push({ s, k: 'read', col: 0x8a9a1f, title: 'مهارة القراءة', body: 'تتوافر في المستقبل من أجل الفهم الصحيح للرسالة المرسلة.' }); }
  { const [s, t] = stand(-0.285, 0xb5489a); const h = grp(t, 0, 0.034, 0);
    add(h, new THREE.TorusGeometry(0.03, 0.004, 8, 32, Math.PI), gloss(0xb5489a), 0, 0, 0, true);
    [-1, 1].forEach((d) => add(h, new THREE.CylinderGeometry(0.012, 0.012, 0.01, 20), gloss(0x2b2620), d * 0.03, -0.004, 0, true).rotation.z = Math.PI / 2);
    skills.push({ s, k: 'listen', col: 0xb5489a, title: 'مهارة الاستماع', body: 'إذا كانت الأداة محادثات شفهية وجب أن تتوافر هذه المهارة في المستقبل.' }); }
  skills.forEach((o, i) => { seq.add(o.s, 1.0 + i * 0.2, 0.7); touch(ctx, o.s, () => { ctx.ui.card({ tag: 'مهارات الاتصال', title: o.title, body: o.body, color: o.col }); found(o.k); }, o.col); });

  ctx.ui.hud('المس قمة الجبل الجليدي');
  return {
    update(t, dt, e) {
      seq.update(t, e); pulse.update(t, e);
      const wk = ease((t - 0.3) / 1.3); water.scale.y = Math.max(1e-3, WL * wk); water.position.y = 0.001 + WL * wk / 2; surf.position.y = 0.001 + WL * wk; surf.visible = wk > 0.02;
      tiers.forEach((o, i) => {
        if (o.pop >= 0) { o.pop += dt; if (o.pop > 1.1) o.pop = -1; }
        const k = o.pop >= 0 ? Math.sin(clamp01(o.pop / 1.1) * Math.PI) : 0;
        o.mesh.material.emissiveIntensity = 0.22 + 0.6 * k + 0.05 * Math.sin(t * 1.6 + i);
        o.mesh.position.y = o.y + Math.sin(t * 0.9 + i * 1.4) * 0.004; o.mesh.rotation.y = Math.sin(t * 0.35 + i) * 0.14;
      });
      if (rip >= 0) { rip += dt; const k = clamp01(rip / 1.3); ripple.scale.setScalar(0.5 + k * 4.5); ringM.opacity = 0.7 * (1 - k); if (rip > 1.3) { rip = -1; ringM.opacity = 0; } }
      motes.forEach((m, i) => { const a = t * 0.3 + m.userData.ph; m.position.set(Math.cos(a) * (0.12 + (i % 3) * 0.05), 0.36 + ((t * 0.04 + i * 0.07) % 0.12), Math.sin(a) * 0.08); m.material.opacity = 0.6 * e * (0.5 + 0.5 * Math.sin(t * 2 + i)); });
    },
  };
}
