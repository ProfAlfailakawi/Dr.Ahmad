import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { P, ease, easeBack, clamp01, stag, mat, glossy, goldMat, shadowed, glow, lightTube } from '../../kit.js?v=16';
import { animator, shadowBlob, V, TAU } from '../lib/a1-kit.js?v=16';

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
  { slot: 'نقل الخبرة', col: GOLD, opts: [{ t: 'تلفزيون تربوي', m: tv, ok: true, fb: 'يبثّ خبرة المتخصص إلى مواقع متعددة في آن واحد.' }, { t: 'مذكرات', m: papers, fb: 'لا تنقل أداء المتخصص ولا تعالج نقصه.' }, { t: 'متخصص خاص', m: lonely, fb: 'يعيد المشكلة نفسها؛ فالكفاءات يصعب توفيرها لكل معهد.' }] },
  { slot: 'الربط', col: SKY, opts: [{ t: 'اتصال ثنائي', m: pair, fb: 'محدود النطاق وكثير التكلفة.' }, { t: 'أقمار', m: sat, ok: true, fb: 'توسّع الوصول إلى عدد كبير من المؤسسات معاً.' }, { t: 'قاعة واحدة', m: room, fb: 'تحصر الفائدة في موقع واحد.' }] },
  { slot: 'تبادل المعرفة', col: TEAL, opts: [{ t: 'أرشيف', m: archive, fb: 'يعزل الخبرة داخل الكلية ولا يتيح تبادلها.' }, { t: 'لقاء سنوي', m: meet, fb: 'لا يوفّر تبادلاً مستمراً للمعرفة.' }, { t: 'بنوك معلومات', m: bank, ok: true, fb: 'تتيح تبادل المعرفة والخبرة بين المؤسسات.' }] },
];

export default function build(ctx) {
  const g = new THREE.Group(); g.position.copy(P(meta.center[0], meta.center[1])); ctx.stage.add(g);
  const A = animator(ctx, g, 0.86);
  const sh = shadowBlob(0.8, 0.6, 0.3); g.add(sh);

  // a broadcast tower: four slender legs, crossbars, a beacon; the design is bolted onto it part by part
  const tw = new THREE.Group(); const gm = goldMat(), wm = glossy(0xf4ecd8, { roughness: 0.35 });
  const lg = (a, b, r, m) => { const d = b.clone().sub(a), l = d.length(), c = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.8, r, l, 8), m); c.position.copy(a).addScaledVector(d, 0.5); c.quaternion.setFromUnitVectors(V(0, 1, 0), d.normalize()); return c; };
  const H = 0.78, B = 0.12, T = 0.025;
  [[1, 1], [-1, 1], [-1, -1], [1, -1]].forEach(([x, z]) => tw.add(lg(V(x * B, 0, z * B - 0.0), V(x * T, H, z * T), 0.008, wm)));
  for (let q = 1; q <= 6; q++) { const y = q * H / 7, w = B + (T - B) * (y / H); const bx = new THREE.Mesh(new THREE.BoxGeometry(w * 2, 0.006, 0.006), gm), bz = new THREE.Mesh(new THREE.BoxGeometry(0.006, 0.006, w * 2), gm); bx.position.set(0, y, w); const bx2 = bx.clone(); bx2.position.z = -w; bz.position.set(w, y, 0); const bz2 = bz.clone(); bz2.position.x = -w; tw.add(bx, bx2, bz, bz2); }
  const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.022, 16, 12), new THREE.MeshStandardMaterial({ color: 0xffe9a0, emissive: GOLD, emissiveIntensity: 0.5 })); beacon.position.y = H + 0.02; tw.add(beacon);
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.003, 0.004, 0.08, 8), gm); mast.position.y = H + 0.04; tw.add(mast);
  
  tw.position.z = -0.12; shadowed(tw); A.add(tw, { at: 0.05, dur: 0.8, rise: 0.2 });
  const bg = glow(GOLD, 0.2, 0.7); bg.position.set(0, H + 0.03, -0.12); g.add(bg);

  // the scarce expert, small and golden at the foot of the tower
  const ex = new THREE.Group(); ex.position.set(-0.27, 0, -0.04); const bmx = glossy(GOLD, { roughness: 0.25, metalness: 0.4 });
  const eb = new THREE.Mesh(new THREE.CapsuleGeometry(0.03, 0.07, 6, 16), bmx); eb.position.y = 0.075; const eh = new THREE.Mesh(new THREE.SphereGeometry(0.03, 20, 14), bmx); eh.position.y = 0.165;
  const hl = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.004, 8, 36), new THREE.MeshBasicMaterial({ color: GOLD, toneMapped: false })); hl.position.y = 0.22; hl.rotation.x = Math.PI / 2;
  ex.add(eb, eh, hl); shadowed(ex); A.add(ex, { at: 0.4, dur: 0.6, rise: 0.12 }); A.hint(ex, GOLD, 0.07, 0.0);
  A.touch(ex, () => ctx.ui.card({ tag: 'المشكلة', title: 'الكفاءة النادرة', body: 'تفتقر جامعات ومعاهد عدة إلى ذوي الكفاءات الخاصة الذين يصعب توفيرهم لكل مؤسسة.', color: GOLD }), { color: GOLD });

  // the institutions: little houses of learning that wake up as the design reaches them
  const blds = [];
  for (let i = 0; i < 8; i++) {
    const a = i / 8 * TAU + 0.4, b = new THREE.Group(); b.position.set(Math.cos(a) * 0.46, 0, Math.sin(a) * 0.3 - 0.06); b.scale.setScalar(1.25);
    const body = box(0.04, 0.032 + (i % 3) * 0.01, 0.04, 0xcfc7b4, 0.003); body.position.y = 0.02 + (i % 3) * 0.005;
    const roof = new THREE.Mesh(new THREE.ConeGeometry(0.036, 0.018, 4), glossy(0x8e8676)); roof.position.y = 0.048 + (i % 3) * 0.01; roof.rotation.y = Math.PI / 4;
    const lamp = glow(GOLD, 0.0, 0.9); lamp.position.y = 0.085; b.add(body, roof, lamp); shadowed(b); b.userData.lamp = lamp; b.userData.body = body;
    blds.push(b); A.add(b, { at: 0.4 + i * 0.07, dur: 0.5, rise: 0.08 });
  }

  // radio waves rolling over the print from the tower foot
  const wcol = [GOLD, SKY, TEAL], waves = [];
  for (let s = 0; s < 3; s++) for (let q = 0; q < 3; q++) { const m = new THREE.Mesh(new THREE.RingGeometry(0.96, 1.0, 72), new THREE.MeshBasicMaterial({ color: wcol[s], transparent: true, opacity: 0, side: THREE.DoubleSide, toneMapped: false, depthWrite: false })); m.rotation.x = -Math.PI / 2; m.position.set(0, 0.004, -0.12); m.scale.setScalar(0.01); g.add(m); waves.push({ m, s, q }); }

  // the three mounting points on the tower
  const MOUNT = [V(0, 0.07, 0.04), V(0, H + 0.1, -0.12), V(0, 0.4, 0.06)], MSC = [2.1, 2.0, 2.0];
  let round = 0, opts = [], placed = [false, false, false], placedAt = [-9, -9, -9], solved = false, roundAt = 1.0;
  const OPX = [-0.25, 0, 0.25];
  const order = [[2, 0, 1], [1, 2, 0], [0, 1, 2]];
  const tags = [0, 1, 2].map(() => null);
  function spawn() {
    opts.forEach((o) => { o.root.parent?.remove(o.root); }); opts = [];
    const P_ = PARTS[round]; if (!P_) return; ctx.ui.hud(`اختر: ${P_.slot}`);
    P_.opts.forEach((op, i) => {
      const spot = order[round].indexOf(i);
      const root = new THREE.Group(); root.position.set(OPX[spot], 0, 0.4); root.scale.setScalar(0.0001);
      const pad = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.078, 0.012, 28), glossy(0xf2ead8)); pad.position.y = 0.006;
      const m = op.m(); m.position.y = 0.012; m.scale.setScalar(1.7); shadowed(m); root.add(pad, m); g.add(root);
      const tg = tags[spot] || (tags[spot] = A.tag('—', 0, P_.col, V(OPX[spot], 0.3, 0.4), { at: 9e9 }));
      A.retag(tg, op.t, P_.col); tg.userData.hide = false; tg.userData.at = A.now + 0.3 + i * 0.1; tg.position.set(OPX[spot], spot === 1 ? 0.46 : 0.26, 0.4);
      const o = { root, m, op, spot, tg, born: A.now + i * 0.12, state: 'idle', t0: 0, wob: -9 }; opts.push(o);
      ctx.tap(root, () => choose(o));
    });
  }
  function choose(o) {
    if (o.state !== 'idle' || solved || opts.some((q) => q.state === 'fly')) return; ctx.sfx.pop?.();
    if (o.op.ok) {
      o.state = 'fly'; o.t0 = A.now; ctx.sfx.good?.(); tags.forEach((t) => t && (t.userData.hide = true));
      ctx.ui.card({ tag: 'اختيار موفّق', title: o.op.t, body: o.op.fb, color: PARTS[round].col }); opts.forEach((q) => { if (q !== o) q.state = 'fade'; });
      const r = round; o.r = r; setTimeout(() => { placed[r] = true; placedAt[r] = A.now; ctx.fx.burst(A.sp(MOUNT[r]), PARTS[r].col, 26, 0.4, 0.035); o.root.visible = false; blds.forEach((b, i) => { if (i % 3 === r) b.userData.on = A.now + 0.6 + i * 0.1; }); round++; if (round >= PARTS.length) finish(); else { roundAt = A.now; spawn(); } }, 1500);
    } else { o.state = 'wrong'; o.wob = A.now; ctx.sfx.bad?.(); ctx.ui.card({ tag: 'ليس الأنسب', title: o.op.t, body: o.op.fb, color: RED }); }
  }
  function finish() { solved = true; blds.forEach((b, i) => { b.userData.on = A.now + 0.2 + i * 0.12; }); setTimeout(() => { ctx.ui.card({ tag: 'خلاصة التصميم', title: 'خبرة واحدة تصل إلى الجميع', body: 'بثّ تربوي، وربط واسع بالأقمار الصناعية، وبنوك معلومات لتبادل المعرفة.', color: GOLD }); ctx.ui.done(); }, 2400); }
  spawn();

  const mountedGroups = [];
  return {
    update(t, dt, e) {
      A.update(t, dt, e); sh.material.opacity = 0.3 * e;
      hl.rotation.z = t; ex.rotation.y = Math.sin(t * 0.5) * 0.4; beacon.material.emissiveIntensity = 0.5 + placed.filter(Boolean).length * 0.5 + Math.sin(t * 3) * 0.15; bg.scale.setScalar(0.18 + placed.filter(Boolean).length * 0.05);
      opts.forEach((o) => {
        const k = ease((t - Math.max(o.born, roundAt)) / 0.7); let x = OPX[o.spot], y = (1 - k) * 0.08, z = 0.4, s = k * (o.state === 'fade' ? 0.7 : 1), rz = 0;
        if (o.state === 'wrong') { const w = t - o.wob; if (w < 0.5) rz = Math.sin(w * 50) * 0.2 * (1 - w * 2); s *= 0.85; }
        if (o.state === 'fly') { const f = clamp01((t - o.t0) / 1.4), M = MOUNT[o.r]; x = THREE.MathUtils.lerp(OPX[o.spot], M.x, ease(f)); z = THREE.MathUtils.lerp(0.4, M.z, ease(f)); y = THREE.MathUtils.lerp(0, M.y, ease(f)) + Math.sin(f * Math.PI) * 0.12; s = k * THREE.MathUtils.lerp(1, 0.9, ease(f)); o.m.rotation.y = f * TAU; }
        else o.m.rotation.y = Math.sin(t * 0.8 + o.spot) * 0.3;
        o.root.position.set(x, y, z); o.root.rotation.z = rz; o.root.scale.setScalar(Math.max(0.0001, s * (o.state === 'fly' ? 1 + ease(clamp01((t - o.t0) / 1.4)) * 0.2 : 1)));
      });
      // modules that arrived stay mounted on the tower
      PARTS.forEach((P_, r) => { if (placed[r] && !mountedGroups[r]) { const mm = P_.opts.find((q) => q.ok).m(); mm.scale.setScalar(MSC[r]); mm.position.copy(MOUNT[r]); shadowed(mm); g.add(mm); mountedGroups[r] = mm; mm.userData.born = t; } if (mountedGroups[r]) { const mm = mountedGroups[r]; mm.scale.setScalar(MSC[r] * (1 + Math.max(0, 1 - (t - mm.userData.born) * 3) * 0.3)); mm.rotation.y = Math.sin(t * 0.6 + r) * 0.4; } });
      waves.forEach((w) => { const on = placed[w.s]; const ph = ((t - placedAt[w.s]) / 3.0 + w.q / 3) % 1; if (!on) { w.m.material.opacity = 0; return; } w.m.scale.setScalar(0.05 + ph * 0.5); w.m.material.opacity = (1 - ph) * 0.5 * (t - placedAt[w.s] > 0 ? 1 : 0); });
      blds.forEach((b) => { const u = b.userData, k = clamp01((t - (u.on ?? 1e9)) / 0.8); u.lamp.scale.setScalar(Math.max(0.0001, ease(k) * 0.14 + (k > 1 ? Math.sin(t * 2 + b.position.x * 20) * 0.01 : 0))); if (u.on !== undefined && t >= u.on) { u.body.material.emissive.setHex(0xd9a830); u.body.material.emissiveIntensity = 0.45 * k; } });
    },
  };
}
