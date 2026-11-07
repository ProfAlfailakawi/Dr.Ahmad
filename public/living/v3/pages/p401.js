import * as THREE from 'three';
import { scene, plinth, contactShadow, sign, RB, GL, TAU, sm, mat, glossy, goldMat, shadowed, glow, ease, easeBack, clamp01, burstAt, lightPool, shuffle, faceYaw } from '../lib/b7-kit.js?v=19';
export const meta = { free: true, center: [0.5, 0.65], typeLabel: 'أسئلة تطبيقية' };

// Three ways to teach thinking, as three physical stations: a lone orb (independent), an orb inside a row of books (including),
// a gold arch joining the two (merging). A scenario card hovers: tap the station it describes.
const ST = [
  { n: 'الاستقلال', c: 0x3b8fe0, why: 'أصحاب توجّه الاستقلال ينادون بتنمية المهارات العليا من خلال دروس وبرامج خاصة ومحددة.' },
  { n: 'التضمين', c: 0xf29a2e, why: 'التضمين يطوّر مهارات التفكير من خلال حصص المواد الدراسية المختلفة بخبرات تضع المتعلم في مواقف تستدعيها.' },
  { n: 'الدمج', c: 0x7ab648, why: 'الدمج موقف وسط: برامج مستقلة للمبادئ العامة، مع مناهج توفر الجوانب التطبيقية والعملية.' },
];
const Q = [
  { t: 'مساق مستقل لمهارات التفكير العليا', a: 0 },
  { t: 'معلّم علوم يبني أنشطته على مواقف تفكير', a: 1 },
  { t: 'برامج مستقلة مع مناهج تطبّق عملياً', a: 2 },
];

function orb(c, r = 0.042) {
  const g = new THREE.Group();
  const core = new THREE.Mesh(new THREE.SphereGeometry(r * 0.5, 20, 14), GL(0xfff0c8, 1.1)); g.add(core);
  const shell = new THREE.Mesh(new THREE.SphereGeometry(r, 32, 22), new THREE.MeshPhysicalMaterial({ color: c, transparent: true, opacity: 0.38, roughness: 0.05, clearcoat: 1, depthWrite: false })); g.add(shell);
  const rings = [0, 1, 2].map((i) => { const t = new THREE.Mesh(new THREE.TorusGeometry(r * 1.32, r * 0.04, 8, 48), goldMat()); t.rotation.set(i * 1.05, i * 0.6, 0); g.add(t); return t; });
  const h = glow(c, r * 5, 0.55); g.add(h);
  g.userData = { core, rings, h, shell };
  return g;
}

export default function build(ctx) {
  const S = scene(ctx, meta, 1.2), g = S.g;
  const pad = plinth(0.31, { color: 0x3a3350 }); g.add(pad); S.part(pad, 0.1, { dur: 0.8, rise: 0 });
  g.add(contactShadow(0.8, 0.8, 0.4));
  const wash = lightPool(0xf29a2e, 0.3, 0.0); wash.position.y = 0.027; g.add(wash);
  const top = 0.025;
  const cam = ctx.camera, cv = new THREE.Vector3(), gv = new THREE.Vector3();
  const stn = [];

  // 0 independence: island + orb
  {
    const o = new THREE.Group(); o.position.set(-0.17, top, -0.02); g.add(o);
    const isl = new THREE.Group(); o.add(isl);
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.07, 0.04, 44), glossy(0xe9f1fb, { roughness: 0.3 })); body.position.y = 0.02; isl.add(body);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.085, 0.0045, 10, 56), goldMat()); rim.rotation.x = Math.PI / 2; rim.position.y = 0.04; isl.add(rim);
    const col = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.022, 0.08, 20), glossy(0xf1ebdd)); col.position.y = 0.08; isl.add(col);
    shadowed(isl);
    const ob = orb(ST[0].c, 0.056); ob.position.y = 0.19; o.add(ob);
    const halo = new THREE.Mesh(new THREE.TorusGeometry(0.11, 0.0022, 8, 80), new THREE.MeshBasicMaterial({ color: ST[0].c, transparent: true, opacity: 0, toneMapped: false })); halo.rotation.x = Math.PI / 2; halo.position.y = 0.045; o.add(halo);
    stn.push({ o, ob, halo, wrongX: o, at: new THREE.Vector3(0, 0.15, 0), i: 0, lit: false, k: 0 });
  }
  // 1 including: books with an orb among them
  {
    const o = new THREE.Group(); o.position.set(0.17, top, -0.02); g.add(o);
    const row = new THREE.Group(); o.add(row);
    const cols = [0xd9344b, 0x3b8fe0, 0xf29a2e, 0x3aa6a0, 0x8a63c9, 0xe0b85e, 0x7ab648];
    const hts = [0.13, 0.15, 0.12, 0, 0.14, 0.12, 0.15];
    let x = -0.1;
    cols.forEach((c, i) => {
      if (i === 3) { x += 0.048; return; }
      const b = new THREE.Mesh(RB(0.022, hts[i] * 1.2, 0.075, 0.004), glossy(c, { roughness: 0.38 })); b.position.set(x, 0.012 + hts[i] * 0.6, 0); b.rotation.z = i === 4 ? -0.07 : 0; b.rotation.y = (i % 2 ? 0.04 : -0.03); row.add(b);
      const sp = new THREE.Mesh(RB(0.0215, 0.006, 0.0765, 0.002), goldMat()); sp.position.set(x, 0.012 + hts[i] * 0.84, 0); row.add(sp);
      x += 0.025;
    });
    const shelf = new THREE.Mesh(RB(0.27, 0.016, 0.1, 0.006), glossy(0xe0b85e, { roughness: 0.35 })); shelf.position.y = 0.008; row.add(shelf);
    shadowed(row);
    const ob = orb(ST[1].c, 0.042); ob.position.set(0.0, 0.085, 0); o.add(ob);
    const halo = new THREE.Mesh(new THREE.TorusGeometry(0.11, 0.0022, 8, 80), new THREE.MeshBasicMaterial({ color: ST[1].c, transparent: true, opacity: 0, toneMapped: false })); halo.rotation.x = Math.PI / 2; halo.position.y = 0.02; o.add(halo);
    stn.push({ o, ob, halo, at: new THREE.Vector3(0, 0.1, 0.02), i: 1, lit: false, k: 0 });
  }
  // 2 merging: gold arch over both
  {
    const o = new THREE.Group(); o.position.set(0, top, -0.13); g.add(o);
    const arch = new THREE.Group(); o.add(arch);
    const cur = new THREE.CatmullRomCurve3(Array.from({ length: 17 }, (_, k) => { const a = Math.PI - (k / 16) * Math.PI; return new THREE.Vector3(Math.cos(a) * 0.17, 0.02 + Math.sin(a) * 0.2, 0); }));
    const tube = new THREE.Mesh(new THREE.TubeGeometry(cur, 60, 0.011, 12), new THREE.MeshStandardMaterial({ color: 0xe0b85e, roughness: 0.25, metalness: 0.85 })); arch.add(tube);
    const light = new THREE.Mesh(new THREE.TubeGeometry(cur, 60, 0.0045, 8), new THREE.MeshBasicMaterial({ color: ST[2].c, transparent: true, opacity: 0.0, toneMapped: false })); light.position.z = 0.007; arch.add(light);
    [-1, 1].forEach((s) => { const f = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.026, 0.02, 24), goldMat()); f.position.set(s * 0.17, 0.01, 0); arch.add(f); });
    shadowed(arch);
    const ob = orb(ST[2].c, 0.045); ob.position.set(0, 0.235, 0); o.add(ob); ob.scale.setScalar(0.0001);
    stn.push({ o, ob, light, at: new THREE.Vector3(0, 0.19, 0), i: 2, lit: false, k: 0, arch });
  }
  stn.forEach((s, k) => { S.part(s.o, 0.5 + k * 0.4, { rise: 0.1, dur: 0.9 }); s.pr = S.touch(s.o, () => pick(s), { color: ST[s.i].c, size: 0.2, at: s.at, wake: 3.4 }); });

  // station name plates (billboards on the plinth front)
  const plates = ST.map((d, i) => { const p = sign(0.2, 0.054, d.n, { fs: 70, border: '#' + d.c.toString(16).padStart(6, '0') }); const px = [-0.17, 0.17, 0][i]; p.position.set(px, top + 0.03, [0.115, 0.115, -0.02][i]); if (i === 2) p.position.set(0, top + 0.03, 0.105); g.add(p); S.part(p, 1.6 + i * 0.2, { rise: 0.04 }); return p; });

  // scenario card
  const card = new THREE.Group(); card.position.set(0, top + 0.47, 0.12); g.add(card);
  const cs = sign(0.42, 0.1, '', { color: '#fff7e6', border: '#d4ad55', fs: 64 }); card.add(cs);
  const cg = glow(0xffd27a, 0.5, 0.35); cs.add(cg);
  card.visible = false;
  const order = shuffle([0, 1, 2], 5);
  let round = -1, flight = null, nextAt = 3.3, pend = 0, wig = -9, solved = 0, tries = 0, fin = false, finT = -1, t0c = 0;
  function next() { round++; if (round >= 3) { finT = S.now; return; } cs.userData.set(Q[order[round]].t); card.visible = true; t0c = S.now; ctx.ui.hud('أي توجّه يمثّله الموقف؟'); }
  function pick(s) {
    if (round < 0) return;
    if (round >= 3 || flight) { if (s.lit) ctx.ui.card({ tag: 'توجّه', title: ST[s.i].n, body: ST[s.i].why, color: ST[s.i].c }); return; }
    const q = Q[order[round]];
    if (s.i === q.a) {
      s.lit = true; s.litT = S.now; s.pr.on = false; solved++; ctx.sfx.good?.(); burstAt(S, s.ob.parent === s.o ? s.ob : s.o, ST[s.i].c, 32, 0.5, 0.03);
      flight = { t0: S.now, from: card.position.clone(), s };
      ctx.ui.card({ tag: 'توجّه', title: ST[s.i].n, body: ST[s.i].why, color: ST[s.i].c });
    } else { tries++; ctx.sfx.bad?.(); wig = S.now; s.bad = S.now; ctx.ui.toast('ليس هذا التوجّه، فكّر مرة أخرى'); }
  }
  const crown = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.003, 8, 100), new THREE.MeshBasicMaterial({ color: 0xffd27a, transparent: true, opacity: 0, toneMapped: false })); crown.rotation.x = Math.PI / 2; crown.position.y = top + 0.02; g.add(crown);
  ctx.ui.hud('كيف نعلّم التفكير؟');

  S.loop((t, dt, e) => {
    wash.material.opacity = 0.25 * ease((t - 0.4) / 1.2) * e;
    const yaw = faceYaw(g, cam);
    plates.forEach((p) => { p.rotation.y = yaw; });
    if (round < 0 && t > nextAt) { next(); nextAt = 1e9; }
    stn.forEach((s, k) => {
      const lit = s.lit; s.k = THREE.MathUtils.damp(s.k, lit ? 1 : 0, 3, dt);
      const u = s.ob.userData; const ob = s.ob;
      if (s.i === 2) ob.scale.setScalar(lit ? Math.max(0.0001, easeBack((t - s.litT) / 0.9)) : 0.0001);
      u.rings.forEach((r, i) => { r.rotation.x += dt * (0.3 + i * 0.2) * (1 + 2 * s.k); r.rotation.y += dt * (0.5 - i * 0.15) * (1 + 2 * s.k); });
      u.core.material.emissiveIntensity = 0.7 + 0.5 * s.k + 0.2 * Math.sin(t * 3 + k);
      u.h.material.opacity = 0.35 + 0.35 * s.k + 0.08 * Math.sin(t * 2.4 + k);
      if (s.i === 0) ob.position.y = 0.2 + 0.012 * Math.sin(t * 1.4) + 0.02 * s.k;
      if (s.i === 1) ob.position.y = 0.085 + 0.006 * Math.sin(t * 1.4 + 1);
      if (s.halo) { s.halo.material.opacity = 0.55 * s.k; s.halo.scale.setScalar(1 + 0.05 * Math.sin(t * 2)); }
      if (s.light) { s.light.material.opacity = 0.9 * s.k; }
      const bd = clamp01(1 - (t - (s.bad || -9)) / 0.5); s.o.position.x = [-0.17, 0.17, 0][k] + Math.sin((t - (s.bad || -9)) * 55) * 0.008 * bd;
    });
    if (card.visible) {
      card.rotation.y = yaw;
      if (flight) {
        const u = sm((t - flight.t0) / 0.8); const tp = flight.s.o.position;
        card.position.set(THREE.MathUtils.lerp(flight.from.x, tp.x, u), THREE.MathUtils.lerp(flight.from.y, top + 0.16, u) + Math.sin(u * Math.PI) * 0.05, THREE.MathUtils.lerp(flight.from.z, tp.z, u));
        card.scale.setScalar(Math.max(0.05, 1 - u * 0.92));
        if (u >= 1) { card.visible = false; flight = null; pend = t + 0.6; }
      } else {
        card.position.set(Math.sin((t - wig) * 55) * 0.012 * clamp01(1 - (t - wig) / 0.5), top + 0.47 + 0.01 * Math.sin(t * 2), 0.12); card.scale.setScalar(Math.max(0.0001, easeBack((t - t0c) / 0.7)));
        cg.material.opacity = 0.3 + 0.12 * Math.sin(t * 3);
      }
    }
    if (pend && t > pend) { pend = 0; next(); }
    if (finT > 0) {
      const u = clamp01((t - finT) / 1.2); crown.material.opacity = 0.9 * u; crown.rotation.z = t * 0.4;
      if (!fin && t - finT > 0.4) { fin = true; burstAt(S, pad, 0xffd27a, 60, 0.7, 0.045); ctx.sfx.good?.(); ctx.ui.card({ tag: 'ثلاثة توجّهات', title: 'كيف نعلّم التفكير؟', body: 'استقلال ببرامج خاصة، أو تضمين في المواد الدراسية، أو دمج يجمع بينهما بمناهج تطبيقية.', color: 0xd4ad55 }); ctx.ui.done(); }
    }
  });
  return { update: S.update };
}
