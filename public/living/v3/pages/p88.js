import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { P, ease, easeBack, clamp01, stag, mat, glossy, goldMat, shadowed, glow, lightTube } from '../../kit.js?v=15';
import { animator, shadowBlob, canvasTexture, V, TAU } from '../lib/a1-kit.js?v=15';

export const meta = { free: true, center: [0.55, 0.7], typeLabel: 'لعبة تصميم' };

const SKY = 0x4fb3d9, GOLD = 0xe3b23c, RED = 0xe0503a, TEAL = 0x2fb6a8, NAVY = 0x23364a;

// small models for every option ------------------------------------------------
const box = (w, h, d, c, r = 0.004) => new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 2, r), glossy(c));
function tv() { const g = new THREE.Group(); const b = box(0.07, 0.05, 0.04, NAVY); b.position.y = 0.035; const s = new THREE.Mesh(new THREE.PlaneGeometry(0.056, 0.036), new THREE.MeshBasicMaterial({ color: 0x7fe3ff, toneMapped: false })); s.position.set(0, 0.035, 0.0205); const a = new THREE.Mesh(new THREE.CylinderGeometry(0.001, 0.001, 0.05, 6), goldMat()); a.position.set(0.01, 0.085, 0); a.rotation.z = -0.4; const f = box(0.04, 0.008, 0.03, NAVY); f.position.y = 0.004; g.add(b, s, a, f); return g; }
function papers() { const g = new THREE.Group(); for (let i = 0; i < 5; i++) { const p = box(0.05, 0.004, 0.065, 0xfffaf0, 0.001); p.position.set((i % 2) * 0.004, 0.003 + i * 0.0045, 0); p.rotation.y = (i - 2) * 0.12; g.add(p); } return g; }
function lonely() { const g = new THREE.Group(); const b = box(0.05, 0.05, 0.05, 0xd9c6a0); b.position.y = 0.026; const h = new THREE.Mesh(new THREE.SphereGeometry(0.013, 14, 10), glossy(GOLD)); h.position.y = 0.065; const m = new THREE.Mesh(new THREE.ConeGeometry(0.036, 0.02, 4), glossy(RED)); m.position.y = 0.06; m.rotation.y = Math.PI / 4; m.position.y = 0.062; h.visible = true; g.add(b, m, h); h.position.y = 0.083; return g; }
function sat() { const g = new THREE.Group(); const b = box(0.03, 0.03, 0.03, 0xe8d9a8); b.position.y = 0.045; const pn = (s) => { const p = box(0.045, 0.002, 0.025, 0x2a5fb0, 0.0005); p.position.set(s * 0.045, 0.045, 0); return p; }; const d = new THREE.Mesh(new THREE.SphereGeometry(0.016, 16, 8, 0, TAU, 0, Math.PI / 2), glossy(0xffffff)); d.rotation.x = Math.PI * 0.8; d.position.set(0, 0.07, 0.01); const st = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.008, 0.03, 10), goldMat()); st.position.y = 0.015; g.add(b, pn(1), pn(-1), d, st); return g; }
function room() { const g = new THREE.Group(); const b = box(0.07, 0.045, 0.05, 0x8f8f9a); b.position.y = 0.025; const w = box(0.012, 0.012, 0.002, 0xffe9a0); w.position.set(0, 0.03, 0.026); g.add(b, w); return g; }
function pair() { const g = new THREE.Group(); [-1, 1].forEach((s) => { const b = box(0.028, 0.04, 0.028, 0xd9c6a0); b.position.set(s * 0.035, 0.022, 0); g.add(b); }); const l = new THREE.Mesh(new THREE.CylinderGeometry(0.0015, 0.0015, 0.045, 6), mat(RED)); l.rotation.z = Math.PI / 2; l.position.y = 0.03; g.add(l); return g; }
function bank() { const g = new THREE.Group(); for (let i = 0; i < 3; i++) { const c = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.017, 28), glossy(i === 1 ? SKY : TEAL)); c.position.y = 0.01 + i * 0.021; g.add(c); } const r = new THREE.Mesh(new THREE.TorusGeometry(0.034, 0.002, 8, 32), goldMat()); r.rotation.x = Math.PI / 2; r.position.y = 0.07; g.add(r); return g; }
function archive() { const g = new THREE.Group(); const b = box(0.05, 0.07, 0.04, 0x8d949b); b.position.y = 0.037; [0.018, 0.04, 0.062].forEach((y) => { const d = box(0.04, 0.01, 0.002, 0x6d747b, 0.001); d.position.set(0, y, 0.021); g.add(d); }); g.add(b); return g; }
function meet() { const g = new THREE.Group(); const t = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.012, 24), glossy(0xb9895c)); t.position.y = 0.025; const l = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.02, 8), goldMat()); l.position.y = 0.012; g.add(t, l); for (let i = 0; i < 4; i++) { const a = i / 4 * TAU, p = new THREE.Mesh(new THREE.SphereGeometry(0.008, 12, 8), glossy(GOLD)); p.position.set(Math.cos(a) * 0.04, 0.02, Math.sin(a) * 0.04); g.add(p); } return g; }

const PARTS = [
  { slot: 'نقل الخبرة', col: GOLD, opts: [{ t: 'تلفزيون تربوي', m: tv, ok: true, fb: 'يبثّ خبرة المتخصص إلى مواقع متعددة في آن واحد.' }, { t: 'مذكرات مطبوعة', m: papers, fb: 'لا تنقل أداء المتخصص ولا تعالج نقصه.' }, { t: 'متخصص لكل معهد', m: lonely, fb: 'يعيد المشكلة نفسها؛ فالكفاءات يصعب توفيرها لكل معهد.' }] },
  { slot: 'الربط', col: SKY, opts: [{ t: 'اتصال ثنائي', m: pair, fb: 'محدود النطاق وكثير التكلفة.' }, { t: 'أقمار صناعية', m: sat, ok: true, fb: 'توسّع الوصول إلى عدد كبير من المؤسسات معاً.' }, { t: 'قاعة واحدة', m: room, fb: 'تحصر الفائدة في موقع واحد.' }] },
  { slot: 'تبادل المعرفة', col: TEAL, opts: [{ t: 'أرشيف ورقي', m: archive, fb: 'يعزل الخبرة داخل الكلية ولا يتيح تبادلها.' }, { t: 'لقاء سنوي', m: meet, fb: 'لا يوفّر تبادلاً مستمراً للمعرفة.' }, { t: 'بنوك المعلومات', m: bank, ok: true, fb: 'تتيح تبادل المعرفة والخبرة بين المؤسسات.' }] },
];

function mapTex() {
  return canvasTexture(256, 180, (c, w, h) => { c.fillStyle = '#1f5f7a'; c.fillRect(0, 0, w, h); c.fillStyle = 'rgba(255,255,255,.08)'; for (let x = 0; x < w; x += 24) c.fillRect(x, 0, 1, h); for (let y = 0; y < h; y += 24) c.fillRect(0, y, w, 1); c.fillStyle = '#2f8aa8'; [[60, 70, 40], [130, 90, 55], [200, 60, 34], [95, 130, 28], [180, 125, 30]].forEach(([x, y, r]) => { c.beginPath(); c.ellipse(x, y, r, r * 0.6, 0.3, 0, TAU); c.fill(); }); });
}
export default function build(ctx) {
  const g = new THREE.Group(); g.position.copy(P(meta.center[0], meta.center[1])); ctx.stage.add(g);
  const A = animator(ctx, g, 0.88);
  g.position.y = 0.05;
  const shb = shadowBlob(1.0, 0.8, 0.28); shb.position.y = -0.048; g.add(shb);
  // a console desk in the pale blue of the print, with a glowing map inlay
  const cs = new THREE.Group();
  const slab = new THREE.Mesh(new RoundedBoxGeometry(0.84, 0.05, 0.64, 4, 0.02), glossy(0xbfe3ee, { roughness: 0.3 })); slab.position.y = -0.025;
  const inlay = new THREE.Mesh(new THREE.PlaneGeometry(0.72, 0.5), new THREE.MeshBasicMaterial({ map: mapTex(), toneMapped: false })); inlay.rotation.x = -Math.PI / 2; inlay.position.y = 0.001;
  const rim = new THREE.Mesh(new RoundedBoxGeometry(0.86, 0.012, 0.66, 3, 0.005), goldMat()); rim.position.y = -0.01;
  cs.add(slab, rim, inlay); shadowed(cs); A.add(cs, { at: 0, dur: 0.7, rise: 0.2 });

  // the scarce expert: a golden figure on a tall pedestal, with a faint light
  const ex = new THREE.Group(); ex.position.set(0, 0.0, -0.16); ex.scale.setScalar(1.45);
  const ped = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.05, 0.1, 28), glossy(0xf5ecd6)); ped.position.y = 0.05;
  const bm = glossy(GOLD, { roughness: 0.25, metalness: 0.4 });
  const eb = new THREE.Mesh(new THREE.CapsuleGeometry(0.022, 0.05, 6, 16), bm); eb.position.y = 0.14; const eh = new THREE.Mesh(new THREE.SphereGeometry(0.022, 20, 14), bm); eh.position.y = 0.205;
  const halo = new THREE.Mesh(new THREE.TorusGeometry(0.04, 0.003, 8, 36), new THREE.MeshBasicMaterial({ color: GOLD, toneMapped: false })); halo.position.y = 0.24; halo.rotation.x = Math.PI / 2;
  ex.add(ped, eb, eh, halo); shadowed(ex); A.add(ex, { at: 0.2, dur: 0.8, rise: 0.15 });
  const exTag = A.tag('الكفاءة النادرة', 0, GOLD, V(0, 0.46, -0.16), { at: 1.2 });

  // the receiving institutions: small buildings ring, dark until the design reaches them
  const camp = [], blds = [];
  for (let i = 0; i < 8; i++) {
    const a = i / 8 * TAU + 0.2, b = new THREE.Group(); b.position.set(Math.cos(a) * 0.37, 0.0, Math.sin(a) * 0.25 + 0.01); b.scale.setScalar(1.5);
    const body = box(0.035, 0.03 + (i % 3) * 0.01, 0.035, 0x6b7a86, 0.003); body.position.y = 0.02 + (i % 3) * 0.005;
    const roof = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.015, 4), glossy(0x44525d)); roof.position.y = 0.045 + (i % 3) * 0.01; roof.rotation.y = Math.PI / 4;
    const lamp = glow(GOLD, 0.0, 0.9); lamp.position.y = 0.075; b.add(body, roof, lamp); shadowed(b); b.userData.lamp = lamp; b.userData.body = body;
    blds.push(b); A.add(b, { at: 0.5 + i * 0.07, dur: 0.6, rise: 0.08 });
  }

  // three slots on the platform, waiting for the chosen parts
  const SLOTX = [-0.2, 0, 0.2], slots = PARTS.map((p, i) => {
    const r = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.004, 8, 40), new THREE.MeshBasicMaterial({ color: p.col, transparent: true, opacity: 0.0, toneMapped: false })); r.rotation.x = Math.PI / 2; r.position.set(SLOTX[i], 0.006, 0.0); g.add(r);
    return r;
  });

  // option objects for the current round
  let round = 0, optObjs = [], doneCount = 0, roundAt = 1.2, solved = false, tubes = [];
  const OPX = [-0.23, 0, 0.23];
  const pickOrder = [[2, 0, 1], [1, 2, 0], [0, 1, 2]]; // where each option stands in each round (right answer is never in the middle twice)
  function spawn() {
    optObjs.forEach((o) => { o.root.parent?.remove(o.root); o.tag.parent?.remove(o.tag); });
    optObjs = [];
    const P_ = PARTS[round]; if (!P_) return;
    P_.opts.forEach((op, i) => {
      const spot = pickOrder[round].indexOf(i);
      const root = new THREE.Group(); root.position.set(OPX[spot], 0.0, 0.2); root.scale.setScalar(1.0);
      const stand = new THREE.Mesh(new THREE.CylinderGeometry(0.052, 0.058, 0.008, 28), glossy(0xf2ead8)); stand.position.y = 0.004;
      const m = op.m(); m.position.y = 0.008; shadowed(m); root.add(stand, m);
      root.scale.setScalar(0.0001); g.add(root);
      const tag = A.tag(op.t, 0, P_.col, V(OPX[spot], spot === 1 ? 0.4 : 0.28, 0.2), { at: A.now + 0.3 + i * 0.1 });
      A.hint(root, P_.col, 0.07, 0.01);
      const o = { root, m, op, tag, spot, born: A.now + i * 0.15, dead: false, shake: -9, flyAt: -9, gone: false }; optObjs.push(o);
      root.userData = { };
      ctx.tap(root, () => choose(o));
    });
    ctx.ui.hud(`اختر: ${P_.slot}`);
  }
  function choose(o) {
    if (o.dead || solved || o.flyAt > -9) return;
    ctx.sfx.pop?.();
    if (o.op.ok) {
      o.flyAt = A.now; o.tag.userData.hide = true; ctx.sfx.good?.(); ctx.ui.card({ tag: 'اختيار موفّق', title: o.op.t, body: o.op.fb, color: PARTS[round].col });
      optObjs.forEach((q) => { if (q !== o) q.dead = true; });
      const r = round; setTimeout(() => { doneCount++; light(r); round++; if (round >= PARTS.length) finish(); else { roundAt = A.now + 0.2; spawn(); } }, 1700);
    } else { o.shake = A.now; o.dead = true; ctx.sfx.bad?.(); ctx.ui.card({ tag: 'ليس الأنسب', title: o.op.t, body: o.op.fb, color: RED }); }
  }
  let litAt = [-9, -9, -9];
  function light(r) { litAt[r] = A.now; for (let i = 0; i < 8; i++) { if (i % 3 === r || i === r + 3) blds[i].userData.on = A.now + i * 0.12; } }
  function finish() {
    solved = true; blds.forEach((b, i) => { b.userData.on = A.now + i * 0.1; });
    setTimeout(() => { ctx.ui.card({ tag: 'خلاصة التصميم', title: 'خبرة واحدة تصل إلى الجميع', body: 'بثّ تربوي، وربط واسع بالأقمار الصناعية، وبنوك معلومات لتبادل المعرفة.', color: GOLD }); ctx.ui.done(); }, 2200);
  }
  spawn();

  const beams = [];
  return {
    update(t, dt, e) {
      A.update(t, dt, e);
      halo.rotation.z = t; ex.rotation.y = Math.sin(t * 0.5) * 0.4; halo.position.y = 0.24 + Math.sin(t * 2) * 0.004;
      optObjs.forEach((o) => {
        const k = ease((t - Math.max(o.born, roundAt)) / 0.7);
        let s = k, x = OPX[o.spot], y = 0.0 + (1 - k) * 0.08, z = 0.2, rz = 0;
        if (o.shake > -9) { const w = t - o.shake; if (w < 0.5) rz = Math.sin(w * 50) * 0.2 * (1 - w * 2); }
        if (o.dead && o.flyAt < 0) s *= 0.78 + 0.0;
        if (o.flyAt > -9) { const f = clamp01((t - o.flyAt) / 1.2); x = THREE.MathUtils.lerp(OPX[o.spot], SLOTX[round], ease(f)); z = THREE.MathUtils.lerp(0.2, 0, ease(f)); y = 0.0 + Math.sin(f * Math.PI) * 0.12; }
        o.root.position.set(x, y, z); o.root.rotation.z = rz; o.root.scale.setScalar(Math.max(0.0001, s * 1.8));
        o.m.rotation.y = o.flyAt > -9 ? 0 : Math.sin(t * 0.8 + o.spot) * 0.3;
        o.tag.position.set(x, o.spot === 1 ? 0.4 : 0.28, z); o.tag.userData.hide = o.flyAt > -9;
      });
      slots.forEach((r, i) => { r.material.opacity = (i === round && !solved ? 0.5 + Math.sin(t * 3) * 0.25 : litAt[i] > -9 ? 0.6 : 0.0) * clamp01(e); });
      blds.forEach((b) => { const u = b.userData, k = clamp01((t - (u.on ?? 1e9)) / 0.8); u.lamp.scale.setScalar(Math.max(0.0001, ease(k) * 0.12 + (k > 1 ? Math.sin(t * 2 + b.position.x * 20) * 0.01 : 0))); u.body.material.emissive = u.body.material.emissive; u.body.material.emissiveIntensity = k; if (u.on !== undefined) u.body.material.emissive.setHex(0x8a6a1e); });
    },
  };
}
