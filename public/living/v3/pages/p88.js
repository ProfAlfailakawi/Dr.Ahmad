import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { P, ease, easeBack, clamp01, stag, mat, glossy, goldMat, shadowed, glow, lightTube } from '../../kit.js?v=22';
import { animator, plinth, shadowBlob, V, TAU, softLight } from '../lib/a1-kit.js?v=22';
import { bust, tweener, shakeX } from '../lib/b1-kit.js?v=22';

export const meta = { free: true, center: [0.55, 0.7], typeLabel: 'لعبة: صمّم الحل' };

const GOLD = 0xd4ad55, TEAL = 0x22b5a8, RED = 0xe0453a, BLUE = 0x3a86e6;
const STAGES = [
  { ttl: 'وسيلة نقل الخبرة', opts: [
    { t: 'بثّ تلفزيوني', ok: true, fb: 'يبثّ خبرة المتخصص إلى مواقع متعددة في آن واحد، وهو ما يعرضه الكتاب علاجاً للمشكلة.' },
    { t: 'مذكرات مطبوعة', ok: false, fb: 'لا تنقل أداء المتخصص ولا تعالج نقصه، بل تكتفي بنقل نصوص.' },
    { t: 'متخصص لكل معهد', ok: false, fb: 'يعيد المشكلة نفسها؛ فالكفاءات الخاصة يصعب توفيرها لكل معهد.' }] },
  { ttl: 'وسيلة الربط', opts: [
    { t: 'قاعة واحدة', ok: false, fb: 'تحصر الفائدة في موقع واحد فلا تعالج نقص بقية المؤسسات.' },
    { t: 'أقمار صناعية', ok: true, fb: 'توسّع نطاق الوصول إلى عدد كبير من الجامعات والمعاهد معاً.' },
    { t: 'خط لكل جامعتين', ok: false, fb: 'محدود النطاق وكثير التكلفة، ولا يربط أكبر عدد من المؤسسات.' }] },
  { ttl: 'تبادل المعرفة', opts: [
    { t: 'أرشيف ورقي', ok: false, fb: 'يعزل الخبرة داخل الكلية ولا يتيح تبادلها.' },
    { t: 'لقاء سنوي', ok: false, fb: 'لا يوفّر تبادلاً مستمراً للمعرفة بين المؤسسات.' },
    { t: 'بنوك المعلومات', ok: true, fb: 'تتيح تبادل المعرفة والخبرة بين المؤسسات بعد البث والربط.' }] },
];

// the nine option models
function model(stage, i) {
  const g = new THREE.Group();
  const M = (geo, m, x = 0, y = 0, z = 0) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); g.add(o); return o; };
  if (stage === 0 && i === 0) { // TV
    M(new RoundedBoxGeometry(0.16, 0.11, 0.07, 4, 0.014), glossy(0x2b2f3a), 0, 0.075, 0);
    M(new THREE.PlaneGeometry(0.135, 0.085), new THREE.MeshBasicMaterial({ color: 0x59d2ff, toneMapped: false }), 0, 0.075, 0.036);
    M(new THREE.CylinderGeometry(0.004, 0.004, 0.04, 8), goldMat(), -0.03, 0.15, 0).rotation.z = 0.5; M(new THREE.CylinderGeometry(0.004, 0.004, 0.04, 8), goldMat(), 0.03, 0.15, 0).rotation.z = -0.5;
    M(new THREE.CylinderGeometry(0.03, 0.04, 0.012, 20), goldMat(), 0, 0.006, 0);
  } else if (stage === 0 && i === 1) { // paper stack
    for (let k = 0; k < 6; k++) { const p = M(new RoundedBoxGeometry(0.15, 0.012, 0.11, 2, 0.004), mat(k % 2 ? 0xfaf4e6 : 0xefe6d0), (k % 3 - 1) * 0.006, 0.01 + k * 0.013, (k % 2 - 0.5) * 0.008); p.rotation.y = (k - 3) * 0.06; }
  } else if (stage === 0 && i === 2) { // another bust
    const b = bust(0x8b8478, 0.2); g.add(b);
  } else if (stage === 1 && i === 0) { // lone hall
    M(new RoundedBoxGeometry(0.15, 0.08, 0.11, 3, 0.01), mat(0xd9cdb6), 0, 0.045, 0);
    const roof = M(new THREE.ConeGeometry(0.1, 0.05, 4), mat(0xa05a3a), 0, 0.11, 0); roof.rotation.y = Math.PI / 4; roof.scale.z = 0.75;
  } else if (stage === 1 && i === 1) { // satellite
    M(new RoundedBoxGeometry(0.05, 0.05, 0.05, 3, 0.008), goldMat(), 0, 0.09, 0);
    M(new RoundedBoxGeometry(0.075, 0.003, 0.04, 1, 0.001), glossy(0x1f4da0), -0.075, 0.09, 0); M(new RoundedBoxGeometry(0.075, 0.003, 0.04, 1, 0.001), glossy(0x1f4da0), 0.075, 0.09, 0);
    M(new THREE.SphereGeometry(0.03, 20, 8, 0, TAU, 0, 1.2), glossy(0xf4f4f4, { metalness: 0.2 }), 0, 0.045, 0.02).rotation.x = Math.PI * 0.7;
    M(new THREE.CylinderGeometry(0.025, 0.035, 0.012, 20), goldMat(), 0, 0.006, 0);
  } else if (stage === 1 && i === 2) { // two cups with a wire
    [-1, 1].forEach((s) => { M(new THREE.SphereGeometry(0.03, 16, 12), glossy(0xe0684a), s * 0.065, 0.045, 0); });
    const w = M(new THREE.CylinderGeometry(0.003, 0.003, 0.13, 6), mat(0x222222), 0, 0.045, 0); w.rotation.z = Math.PI / 2;
  } else if (stage === 2 && i === 2) { // data bank: stacked discs
    for (let k = 0; k < 4; k++) { M(new THREE.CylinderGeometry(0.06, 0.06, 0.026, 36), glossy(0x1f4da0, { metalness: 0.3 }), 0, 0.02 + k * 0.034, 0); M(new THREE.TorusGeometry(0.06, 0.003, 6, 36), new THREE.MeshBasicMaterial({ color: 0x59d2ff, toneMapped: false }), 0, 0.02 + k * 0.034 + 0.013, 0).rotation.x = Math.PI / 2; }
  } else if (stage === 2 && i === 0) { // paper cabinet
    M(new RoundedBoxGeometry(0.1, 0.14, 0.08, 3, 0.008), mat(0x8b8478, { metalness: 0.4 }), 0, 0.075, 0);
    [0.04, 0.09, 0.13].forEach((y) => M(new THREE.CylinderGeometry(0.006, 0.006, 0.04, 8), goldMat(), 0, y, 0.042).rotation.z = Math.PI / 2);
  } else { // calendar
    M(new RoundedBoxGeometry(0.11, 0.12, 0.016, 3, 0.006), mat(0xfaf4e6), 0, 0.075, 0).rotation.x = -0.15;
    M(new THREE.BoxGeometry(0.11, 0.028, 0.018), mat(0xe0453a), 0, 0.12, 0.003);
    M(new THREE.CylinderGeometry(0.03, 0.04, 0.012, 20), goldMat(), 0, 0.006, 0);
  }
  shadowed(g); return g;
}

export default function build(ctx) {
  const g = new THREE.Group(); g.position.copy(P(meta.center[0], meta.center[1])); ctx.stage.add(g);
  const A = animator(ctx, g, 0.95);
  const tw = tweener();
  g.add(shadowBlob(0.9, 0.7, 0.3));
  const base = plinth(0.5); base.scale.set(1, 1, 0.8); g.add(base);

  // the rare expert: a gold bust on a high pedestal at left
  const ex = new THREE.Group(); ex.position.set(-0.3, 0, -0.12);
  const ped = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 0.1, 30), goldMat()); ped.position.y = 0.05;
  const eb = bust(0xd4ad55, 0.34); eb.position.y = 0.1; ex.add(ped, eb);
  const eg = glow(0xffd27a, 0.22, 0.3); eg.position.y = 0.3; ex.add(eg);
  A.add(ex, { at: 0.2, dur: 0.8, rise: 0.1 });

  // 4 campuses at the back
  const camp = [];
  [[-0.05, -0.2], [0.12, -0.26], [0.29, -0.2], [0.2, -0.04]].forEach(([x, z], i) => {
    const c = new THREE.Group(); c.position.set(x, 0, z);
    const bd = new THREE.Mesh(new RoundedBoxGeometry(0.1, 0.09, 0.075, 3, 0.008), glossy(0xf1e8d2, { roughness: 0.4 })); bd.position.y = 0.047;
    const dome = new THREE.Mesh(new THREE.ConeGeometry(0.082, 0.055, 4), glossy(0x1f9a90, { emissive: 0x000000 })); dome.position.y = 0.12; dome.rotation.y = Math.PI / 4; dome.scale.z = 0.78;
    const wins = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.02, 0.004), new THREE.MeshBasicMaterial({ color: 0x555a66 })); wins.position.set(0, 0.06, 0.039);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.0025, 0.0025, 0.05, 6), goldMat()); pole.position.y = 0.175;
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.009, 10, 8), new THREE.MeshBasicMaterial({ color: 0x555555 })); lamp.position.y = 0.205;
    const lg = glow(0xffd27a, 0.001, 0); lg.position.y = 0.2;
    c.add(bd, dome, wins, pole, lamp, lg); c.scale.setScalar(1.45); shadowed(c); A.add(c, { at: 0.5 + i * 0.2, dur: 0.7, rise: 0.1 });
    camp.push({ c, dome, lamp, lg, wins, lit: 0 });
  });

  // link tubes (appear with choices)
  const mkTube = (curve, color) => { const t = lightTube(curve, { radius: 0.005, color, speed: 0.5 }); t.userData.fill(0); g.add(t); return t; };
  const tvTube = mkTube(new THREE.QuadraticBezierCurve3(V(-0.3, 0.3, -0.12), V(-0.15, 0.45, -0.14), V(0.0, 0.52, -0.1)), 0x59d2ff);
  const satTubes = camp.map((c) => mkTube(new THREE.QuadraticBezierCurve3(V(0.0, 0.52, -0.1), V((c.c.position.x) * 0.5, 0.45, c.c.position.z * 0.6 - 0.05), V(c.c.position.x, 0.3, c.c.position.z)), 0xffd27a));
  const netTubes = [[0, 1], [1, 2], [2, 3], [3, 0], [0, 2]].map(([a, b]) => { const pa = camp[a].c.position, pb = camp[b].c.position; return mkTube(new THREE.QuadraticBezierCurve3(V(pa.x, 0.1, pa.z), V((pa.x + pb.x) / 2, 0.2, (pa.z + pb.z) / 2), V(pb.x, 0.1, pb.z)), 0x7fcf5a); });
  const fills = { tv: 0, sat: 0, net: 0 };

  // placed tools
  const tvPlaced = model(0, 0); tvPlaced.position.set(-0.3, 0.3, -0.12); tvPlaced.scale.setScalar(0.0001); g.add(tvPlaced);
  const satPlaced = model(1, 1); satPlaced.position.set(0, 0.46, -0.1); satPlaced.scale.setScalar(0.0001); g.add(satPlaced);
  const bankPlaced = model(2, 2); bankPlaced.position.set(0.12, 0, -0.08); bankPlaced.scale.setScalar(0.0001); g.add(bankPlaced);
  const placed = [tvPlaced, satPlaced, bankPlaced];

  // option trays
  const SLOTX = [-0.235, 0, 0.235], SLOTZ = 0.22;
  let stage = 0, locked = true, opts = [], bad = null, shakeT = -9, shakeI = -1, done = false;
  const tags = [];
  const mkStage = () => {
    opts.forEach((o) => { g.remove(o.grp); });
    tags.forEach((s) => { s.userData.hide = true; });
    opts = STAGES[stage].opts.map((o, i) => {
      const grp = new THREE.Group(); grp.position.set(SLOTX[i], 0, SLOTZ);
      const pad = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.1, 0.012, 40), glossy(0xf6f0e2, { roughness: 0.4 })); pad.position.y = 0.006;
      const rim = new THREE.Mesh(new THREE.TorusGeometry(0.09, 0.004, 8, 48), goldMat()); rim.rotation.x = Math.PI / 2; rim.position.y = 0.012;
      const m = model(stage, i); m.position.y = 0.012; m.scale.setScalar(1.2); grp.add(pad, rim, m);
      const k = { grp, o, i, m, appear: A.now };
      grp.scale.setScalar(0.0001); g.add(grp);
      ctx.tap(grp, () => pick(k));
      const s = A.tag(o.t, 0, GOLD, V(SLOTX[i], 0.0, SLOTZ + 0.16 + (i === 1 ? 0.05 : 0)), { at: A.now + 0.5 + i * 0.12, size: 29 }); tags.push(s); k.tag = s; return k;
    });
    locked = false; ctx.ui.hud(STAGES[stage].ttl);
  };
  const flashRed = () => {};
  const pick = (k) => {
    if (locked || done || !k.grp.parent) return; ctx.sfx.pop?.();
    if (!k.o.ok) { shakeT = A.now; shakeI = k.i; ctx.sfx.bad?.(); ctx.ui.card({ tag: 'ليست الأنسب', title: k.o.t, body: k.o.fb, color: RED }); return; }
    locked = true; ctx.sfx.good?.(); ctx.ui.card({ tag: 'اختيار موفّق', title: k.o.t, body: k.o.fb, color: TEAL });
    const from = k.grp.position.clone(); const st = stage;
    ctx.fx.burst(from.clone().add(g.position), TEAL, 20, 0.35, 0.03);
    opts.forEach((o) => { if (o !== k) tw.go(0.5, (e) => o.grp.scale.setScalar(Math.max(0.0001, 1 - e))); o.tag.userData.hide = true; });
    tw.go(0.7, (e) => k.grp.scale.setScalar(Math.max(0.0001, 1 - ease(e))), 0.2, () => {
      tw.go(0.8, (e) => { placed[st].scale.setScalar(Math.max(0.0001, easeBack(e))); });
      tw.go(1.6, (e) => { if (st === 0) fills.tv = e; if (st === 1) fills.sat = e; if (st === 2) fills.net = e; if (st >= 1) camp.forEach((c, i) => { c.lit = Math.max(c.lit, clamp01(e * 4 - i * 0.6)); }); });
      stage++; if (stage < 3) setTimeout(mkStage, 1400); else setTimeout(() => { done = true; ctx.ui.hud('خبرة نادرة تصل للجميع'); ctx.ui.done(); }, 1800);
    });
  };
  ctx.tap(ex, () => ctx.ui.card({ tag: 'المشكلة', title: 'كفاءات نادرة', body: 'يصعب توفير ذوي الكفاءات الخاصة لكل جامعة ومعهد.', color: GOLD }));
  A.hint(ex, GOLD, 0.1, 0.01);
  setTimeout(mkStage, 3200);

  return {
    update(t, dt, e) {
      A.update(t, dt, e); tw.update(dt);
      opts.forEach((o) => { const k = easeBack(clamp01((t - o.appear - o.i * 0.15) / 0.6)); if (locked && o.grp.scale.x < 0.01) return; if (!locked) o.grp.scale.setScalar(Math.max(0.0001, k)); o.grp.position.x = SLOTX[o.i] + (shakeI === o.i ? shakeX(shakeT, t, 0.012) : 0); o.m.rotation.y = t * 0.6 + o.i; });
      tvTube.userData.fill(fills.tv); tvTube.userData.update(dt);
      satTubes.forEach((s, i) => { s.userData.fill(clamp01(fills.sat * 1.4 - i * 0.12)); s.userData.update(dt); });
      netTubes.forEach((s, i) => { s.userData.fill(clamp01(fills.net * 1.4 - i * 0.1)); s.userData.update(dt); });
      satPlaced.rotation.y = t * 0.8; satPlaced.position.y = 0.46 + Math.sin(t * 1.6) * 0.01;
      tvPlaced.position.y = 0.3 + Math.sin(t * 1.4) * 0.006;
      eg.scale.setScalar(0.22 + Math.sin(t * 2) * 0.02);
      camp.forEach((c) => { c.lamp.material.color.setHex(c.lit > 0.05 ? 0xffd27a : 0x555555); c.lg.scale.setScalar(0.001 + c.lit * 0.16); c.lg.material.opacity = c.lit * 0.9; c.wins.material.color.setHex(c.lit > 0.05 ? 0xffd27a : 0x555a66); });
    },
  };
}
