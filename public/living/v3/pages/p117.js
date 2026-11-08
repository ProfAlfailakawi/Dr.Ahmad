// p117 — the iceberg of communication, cut by a pane of sea: a bright tip (words 7%), a cyan middle (voice 38%), a big warm base (body 55%); four skills at its feet.
import * as THREE from 'three';
import { P, ease, easeBack, clamp01, stag, glow } from '../../kit.js?v=27';
import { rb, lathe, std, lit, gloss, glass, brass, add, grp, hit, Seq, Pulse, touch, chip, blob, at, TAU, INK, GOLD } from '../lib/a2.js?v=27';

export const meta = { free: true, center: [0.5, 0.68], typeLabel: 'مجسّم تفاعلي' };

function crystal(r, sx, sy, sz, seed, amp = 1) {
  const geo = new THREE.IcosahedronGeometry(r, 2), p = geo.attributes.position, v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const n = Math.sin(v.x * 21.1 + seed) * Math.cos(v.y * 17.7 + seed * 1.3) + Math.sin(v.z * 25.3 - seed * 0.7) * 0.7 + Math.abs(Math.sin(v.y * 29 + seed)) * 0.55;
    v.multiplyScalar(1 + amp * 0.4 * n); v.x *= sx; v.y *= sy; v.z *= sz; p.setXYZ(i, v.x, v.y, v.z);
  }
  geo.computeVertexNormals(); return geo;
}

export default function build(ctx) {
  const g = new THREE.Group(); g.position.copy(P(meta.center[0], meta.center[1])); ctx.stage.add(g); g.scale.setScalar(0.9);
  const seq = new Seq(), pulse = new Pulse(), seen = new Set();
  const found = (k) => { seen.add(k); if (seen.size >= 7) ctx.ui.done(); else ctx.ui.hud(`${seen.size} من ٧`); };
  const Y0 = 0.0, SEA = 0.3, CZ = -0.06;
  blob(g, 0.8, 0.5, 0.32, 0, CZ);

  // ---- the sea: a glowing pane cut through the iceberg, with a bright waterline ring
  const sea = grp(g, 0, SEA, CZ);
  const seaTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 256; const x = c.getContext('2d'); const gr = x.createRadialGradient(128, 128, 20, 128, 128, 128); gr.addColorStop(0, 'rgba(120,205,245,.28)'); gr.addColorStop(0.7, 'rgba(60,160,225,.5)'); gr.addColorStop(1, 'rgba(30,120,205,.65)'); x.fillStyle = gr; x.beginPath(); x.arc(128, 128, 126, 0, TAU); x.fill(); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; })();
  const pane = add(sea, new THREE.CircleGeometry(0.4, 64), new THREE.MeshBasicMaterial({ map: seaTex, transparent: true, depthWrite: false, side: THREE.DoubleSide, toneMapped: false }), 0, 0, 0); pane.rotation.x = -Math.PI / 2; pane.scale.y = 0.72; pane.renderOrder = 3;
  const edge = add(sea, new THREE.TorusGeometry(0.4, 0.004, 8, 96), new THREE.MeshBasicMaterial({ color: 0xc6efff, toneMapped: false }), 0, 0, 0); edge.rotation.x = Math.PI / 2; edge.scale.y = 0.72;
  const wl = add(sea, new THREE.TorusGeometry(0.2, 0.0035, 8, 64), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.8, depthWrite: false, toneMapped: false }), 0, 0.001, 0); wl.rotation.x = Math.PI / 2; wl.scale.y = 0.8;
  const rips = [0, 1, 2].map(() => { const m = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false, toneMapped: false }); const r = add(sea, new THREE.TorusGeometry(0.2, 0.002, 6, 64), m, 0, 0.0015, 0); r.rotation.x = Math.PI / 2; return { r, m }; });
  seq.add(sea, 0.1, 0.8, { rise: 0 });
  // a thin gold stem that holds the pane (so it reads as a model)
  const rod = add(g, new THREE.CylinderGeometry(0.004, 0.004, SEA, 8), brass(), 0.36, SEA / 2, CZ + 0.1); seq.add(rod, 0.1, 0.5, { rise: 0 });

  const ice = (col, em, op = 0.97) => new THREE.MeshPhysicalMaterial({ color: col, emissive: col, emissiveIntensity: em, roughness: 0.15, clearcoat: 1, flatShading: true, transparent: true, opacity: op });
  const tiers = [
    { k: 'body', col: 0xff9d5c, geo: crystal(0.25, 1.0, 0.5, 0.8, 1.2, 1.0), y: 0.115, delay: 0.3, h: 0.18 },
    { k: 'voice', col: 0x4cd2e6, geo: crystal(0.2, 1.0, 0.5, 0.8, 4.1, 1.0), y: 0.225, delay: 0.65, h: 0.12 },
    { k: 'words', col: 0xf6fcff, geo: crystal(0.1, 0.85, 1.55, 0.8, 7.7, 1.2), y: 0.405, delay: 1.0, h: 0.16 },
  ].map((o) => { const m = add(g, o.geo, ice(o.col, 0.25), 0, o.y, CZ, true); o.mesh = m; o.hold = grp(g, 0, 0, 0); o.hold.add(m); seq.add(o.hold, o.delay, 0.8, { rise: 0.2 }); hit(o.hold, o.k === 'words' ? 0.12 : 0.2, 0, o.y, CZ); o.pop = -1; return o; });
  const motes = Array.from({ length: 14 }, (_, i) => { const s = glow(0xffffff, 0.016, 0.85); g.add(s); s.userData.ph = i * 0.9; return s; });
  let rip = -1;
  const cards = {
    body: { title: 'تعبيرات الجسم ٥٥٪', body: 'وجد مهرابيان أن ٩٣٪ من الاتصال غير ملفوظ، وتعبيرات الجسم تمثل ٥٥٪ منه.', color: 0xef8f2a },
    voice: { title: 'نبرة الصوت ٣٨٪', body: 'إذا لم يكن الصوت واضحاً عُدّ عامل تشويش.', color: 0x1f9aa6 },
    words: { title: 'الكلمات ٧٪ فقط', body: 'المستقبل يستمع ويعبّر أكثر من الكلام.', color: 0x5a6fd6 },
  };
  tiers.forEach((o) => touch(ctx, o.hold, () => { o.pop = 0; rip = 0; ctx.ui.card({ tag: 'مهرابيان', ...cards[o.k] }); found(o.k); }, o.col));
  [['٥٥٪', 0.1, 0xef8f2a], ['٣٨٪', 0.24, 0x1f9aa6], ['٧٪', 0.46, 0x5a6fd6]].forEach(([t, y, col], i) => {
    const c = chip(t, 0, col, { k: 1.3 }); c.position.set(0.31, y, CZ + 0.05); g.add(c); seq.add(c, 1.5 + i * 0.15, 0.5);
  });

  // ---- four skills at the iceberg's feet
  const skills = [];
  const stand = (x, col) => {
    const s = grp(g, x, Y0, 0.3); s.scale.setScalar(1.55);
    add(s, new THREE.CylinderGeometry(0.046, 0.05, 0.018, 28), std(0xf3ecdc, { roughness: 0.5 }), 0, 0.009, 0, true);
    const t = add(s, new THREE.TorusGeometry(0.047, 0.003, 6, 40), brass(), 0, 0.018, 0); t.rotation.x = Math.PI / 2;
    const top = grp(s, 0, 0.018, 0); hit(s, 0.06, 0, 0.04, 0); pulse.add(s, col, 0.15, 0, 0.04, 0, { op: 0.45 });
    return [s, top];
  };
  { const [s, t] = stand(0.285, 0xe0602f); const m = grp(t, 0, 0.03, 0); m.rotation.z = -0.5;
    add(m, new THREE.CylinderGeometry(0.036, 0.012, 0.06, 24, 1, true), gloss(0xe0602f, { side: THREE.DoubleSide }), 0.02, 0, 0, true).rotation.z = -Math.PI / 2;
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
  skills.forEach((o, i) => { seq.add(o.s, 0.8 + i * 0.18, 0.7); touch(ctx, o.s, () => { ctx.ui.card({ tag: 'مهارات الاتصال', title: o.title, body: o.body, color: o.col }); found(o.k); }, o.col); });

  ctx.ui.hud('المس قمة الجبل الجليدي');
  return {
    update(t, dt, e) {
      seq.update(t, e); pulse.update(t, e);
      wl.material.opacity = 0.55 + 0.25 * Math.sin(t * 2);
      tiers.forEach((o, i) => {
        if (o.pop >= 0) { o.pop += dt; if (o.pop > 1.1) o.pop = -1; }
        const k = o.pop >= 0 ? Math.sin(clamp01(o.pop / 1.1) * Math.PI) : 0;
        o.mesh.material.emissiveIntensity = 0.25 + 0.6 * k + 0.05 * Math.sin(t * 1.6 + i);
        o.mesh.position.y = o.y + Math.sin(t * 0.9 + i * 1.4) * 0.004; o.mesh.rotation.y = Math.sin(t * 0.35 + i) * 0.12;
      });
      rips.forEach((q, i) => { const base = ((t * 0.22 + i / 3) % 1), k = rip >= 0 ? clamp01((rip - i * 0.22) / 1.3) : base; q.r.scale.set(0.6 + k * 1.9, (0.6 + k * 1.9) * 0.72, 1); q.m.opacity = e * (rip >= 0 ? 0.7 : 0.28) * (1 - k); });
      if (rip >= 0) { rip += dt; if (rip > 1.9) rip = -1; }
      motes.forEach((m, i) => { const a = t * 0.3 + m.userData.ph; m.position.set(Math.cos(a) * (0.16 + (i % 3) * 0.06), 0.34 + ((t * 0.05 + i * 0.07) % 0.18), CZ + Math.sin(a) * 0.1); m.material.opacity = 0.6 * e * (0.5 + 0.5 * Math.sin(t * 2 + i)); });
    },
  };
}
