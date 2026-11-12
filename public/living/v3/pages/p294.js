// p294 — virtual reality: a holographic stage that wakes as you plug in the five parts of the system.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { P, ease, easeBack, clamp01, glow } from '../../kit.js?v=29';
import { rb, std, lit, gloss, glass, brass, add, grp, hit, Seq, Pulse, touch, chip, blob, at, TAU } from '../lib/a2.js?v=29';

export const meta = { free: true, center: [0.45, 0.47], typeLabel: 'مجسّم تفاعلي' };

const BLUE = 0x3a6fc4, GREEN = 0x3fa04a, ORANGE = 0xf29a2e, GOLD = 0xe0b85e, MAROON = 0x8a1c26;
const PARTS = [
  { k: 'pc', name: 'الحاسوب', col: BLUE, title: 'الحاسوب', body: 'قدرات الحاسوب في الخزن والمعالجة هي ما يبني العوالم الافتراضية والخيالية.' },
  { k: 'sw', name: 'البرنامج', col: GOLD, title: 'البرنامج', body: 'برنامج حاسوبي تشترك فيه حواس الإنسان لتمر بخبرة شبيهة بالواقع إلى حد بعيد.' },
  { k: 'hs', name: 'غطاء الرأس', col: GREEN, title: 'غطاء الرأس', body: 'يساعد في رؤية البرنامج بصورة مجسمة ذات أبعاد ثلاثية: الطول والعرض والعمق.' },
  { k: 'gl', name: 'القفازات', col: ORANGE, title: 'القفازات', body: 'اللمس من خلال القفازات: يتفاعل الفرد مع ما يدور في البرنامج وكأنه واقع محسوس.' },
  { k: 'sp', name: 'السماعات', col: MAROON, title: 'السماعات', body: 'السمع: مكبرات الصوت أو سماعات الرأس تضيف معلومات حسية مثل الصوت إلى المحاكاة.' },
];

function gridTex() {
  const c = document.createElement('canvas'); c.width = c.height = 512; const g = c.getContext('2d');
  const gr = g.createRadialGradient(256, 256, 20, 256, 256, 256); gr.addColorStop(0, '#1f8a45'); gr.addColorStop(1, '#0f4a2a'); g.fillStyle = gr; g.fillRect(0, 0, 512, 512);
  g.strokeStyle = 'rgba(190,255,205,.85)'; g.lineWidth = 3;
  for (let i = 0; i <= 8; i++) { const p = 32 + i * 56; g.beginPath(); g.moveTo(p, 32); g.lineTo(p, 480); g.stroke(); g.beginPath(); g.moveTo(32, p); g.lineTo(480, p); g.stroke(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}
const merge = (parts) => mergeGeometries(parts.map(([geo, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0]) => { const m = new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new THREE.Vector3(1, 1, 1)); const g2 = geo.index ? geo.toNonIndexed() : geo.clone(); g2.applyMatrix4(m); return g2; }));

export default function build(ctx) {
  const g = new THREE.Group(); g.position.copy(P(meta.center[0], meta.center[1])); ctx.stage.add(g);
  const seq = new Seq(), pulse = new Pulse();
  const WZ = -0.06, PY = 0.02;                // world stage: centre z, pedestal top
  const ivory = std(0xf3ecde, { roughness: 0.5 });

  // ---- holographic stage ----
  blob(g, 0.62, 0.5, 0.3, 0, WZ + 0.05);
  const ped = grp(g, 0, 0, WZ);
  add(ped, new THREE.CylinderGeometry(0.15, 0.165, PY, 56), gloss(0x3a6fc4, { roughness: 0.3 }), 0, PY / 2, 0, true);
  const rim = add(ped, new THREE.TorusGeometry(0.152, 0.005, 8, 72), brass(), 0, PY, 0); rim.rotation.x = Math.PI / 2;
  seq.add(ped, 0.1, 0.9, { rise: 0.06 });
  const floor = add(ped, new THREE.CircleGeometry(0.145, 48), new THREE.MeshBasicMaterial({ map: gridTex(), transparent: true, opacity: 0, depthWrite: false }), 0, PY + 0.002, 0);
  floor.rotation.x = -Math.PI / 2;
  const seed = glow(0x9fd0ff, 0.2, 0.0); seed.position.set(0, 0.1, 0); ped.add(seed);
  const halo = glow(0xffd27a, 0.5, 0.0); halo.position.set(0, 0.12, 0); ped.add(halo);

  // layer 2: solids of the simulated world
  const world = grp(ped, 0, PY + 0.002, 0);
  const solids = [
    add(world, new THREE.BoxGeometry(0.07, 0.07, 0.07), gloss(BLUE, { emissive: BLUE, emissiveIntensity: 0.25 }), -0.06, 0.035, 0.02, true),
    add(world, new THREE.SphereGeometry(0.045, 28, 18), gloss(ORANGE, { emissive: ORANGE, emissiveIntensity: 0.25 }), 0.06, 0.047, 0.04, true),
    add(world, new THREE.ConeGeometry(0.04, 0.11, 4), gloss(MAROON, { emissive: MAROON, emissiveIntensity: 0.25 }), 0.0, 0.055, -0.055, true),
  ];
  solids.forEach((s, i) => { s.userData.y = s.position.y; s.userData.spin = 0; s.userData.ph = i * 2; s.scale.setScalar(1e-4); });
  // layer 3: depth cage with the three axes (length, width, depth)
  const box = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(0.26, 0.26, 0.26)), new THREE.LineBasicMaterial({ color: 0xbfe6ff, transparent: true, opacity: 0 }));
  box.position.set(0, PY + 0.13, 0); ped.add(box);
  const ax = new THREE.BufferGeometry(); const cx = new THREE.Color(ORANGE), cy = new THREE.Color(GREEN), cz = new THREE.Color(BLUE);
  const O = [-0.13, 0.0, 0.13];
  ax.setAttribute('position', new THREE.Float32BufferAttribute([...O, 0.13, 0, 0.13, ...O, -0.13, 0.26, 0.13, ...O, -0.13, 0, -0.13], 3));
  ax.setAttribute('color', new THREE.Float32BufferAttribute([cx.r, cx.g, cx.b, cx.r, cx.g, cx.b, cy.r, cy.g, cy.b, cy.r, cy.g, cy.b, cz.r, cz.g, cz.b, cz.r, cz.g, cz.b], 3));
  const axes = new THREE.LineSegments(ax, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0 })); axes.position.set(0, PY + 0.002, 0); axes.userData = {}; ped.add(axes);
  // layer 5: sound rings
  const rings = [0, 1].map(() => { const r = add(ped, new THREE.TorusGeometry(0.1, 0.0025, 6, 64), new THREE.MeshBasicMaterial({ color: 0xff9aa8, transparent: true, opacity: 0, depthWrite: false }), 0, PY + 0.06, 0); r.rotation.x = Math.PI / 2; return r; });

  // ---- the five parts along the front ----
  const cols = PARTS.map((p, i) => {
    const x = (i - 2) * 0.15, z = 0.175 + 0.012 * (i - 2) * (i - 2);
    const m = grp(g, x, 0, z);
    add(m, new THREE.CylinderGeometry(0.066, 0.07, 0.014, 40), ivory, 0, 0.007, 0);
    const tor = add(m, new THREE.TorusGeometry(0.067, 0.004, 8, 48), lit(p.col, 0.1), 0, 0.014, 0); tor.rotation.x = Math.PI / 2;
    const ic = grp(m, 0, 0.014, 0); ic.scale.setScalar(1.25);
    if (p.k === 'pc') {
      add(ic, rb(0.034, 0.07, 0.05, 0.006, 2), std(0x34496b), -0.016, 0.035, 0, true);
      add(ic, rb(0.05, 0.036, 0.008, 0.004, 2), std(0x1b1f2a), 0.018, 0.036, 0.0, true);
      add(ic, new THREE.PlaneGeometry(0.042, 0.028), new THREE.MeshBasicMaterial({ color: 0x77d6ff }), 0.018, 0.036, 0.0045);
    } else if (p.k === 'sw') {
      const d = add(ic, new THREE.CylinderGeometry(0.036, 0.036, 0.007, 36), gloss(0x1b1f2a), 0, 0.045, 0, true); d.rotation.x = Math.PI / 2;
      const r2 = add(ic, new THREE.TorusGeometry(0.037, 0.004, 8, 40), brass(), 0, 0.045, 0); r2.userData.spin = 1;
      ic.userData.spinner = r2;
    } else if (p.k === 'hs') {
      add(ic, rb(0.085, 0.045, 0.055, 0.016, 3), gloss(0x232a3c), 0, 0.04, 0, true);
      add(ic, new THREE.TorusGeometry(0.044, 0.005, 8, 36), std(0x56627f), 0, 0.04, -0.005).rotation.y = Math.PI / 2;
      add(ic, new THREE.PlaneGeometry(0.07, 0.022), new THREE.MeshBasicMaterial({ color: 0x8be0b0 }), 0, 0.04, 0.0285);
    } else if (p.k === 'gl') {
      const parts = [[rb(0.034, 0.04, 0.014, 0.006, 2), 0, 0.035, 0], [new THREE.CylinderGeometry(0.018, 0.02, 0.016, 16), 0, 0.012, 0]];
      [-0.0125, -0.004, 0.0045, 0.013].forEach((fx, k) => parts.push([new THREE.CapsuleGeometry(0.0055, 0.022 + (k === 1 || k === 2 ? 0.006 : 0), 4, 8), fx, 0.07 + (k === 1 || k === 2 ? 0.003 : 0), 0]));
      parts.push([new THREE.CapsuleGeometry(0.0058, 0.02, 4, 8), -0.024, 0.045, 0, 0, 0, 0.9]);
      add(ic, merge(parts), gloss(ORANGE), 0, 0.0, 0, true);
    } else {
      const band = add(ic, new THREE.TorusGeometry(0.036, 0.0045, 8, 36, Math.PI), std(0x2a3347), 0, 0.03, 0, true);
      add(ic, merge([[new THREE.CylinderGeometry(0.016, 0.016, 0.014, 20), -0.036, 0.03, 0, 0, 0, Math.PI / 2], [new THREE.CylinderGeometry(0.016, 0.016, 0.014, 20), 0.036, 0.03, 0, 0, 0, Math.PI / 2]]), gloss(MAROON), 0, 0, 0, true);
      band.position.y = 0.03;
    }
    const c = chip(p.name, 0, p.col, { k: 0.62 }); c.position.set(0, 0.14 + (i % 2) * 0.0, 0.0); m.add(c);
    c.position.y = 0.15; c.position.z = 0.03;
    hit(m, 0.07, 0, 0.05, 0);
    seq.add(m, 0.6 + i * 0.28, 0.8, { rise: 0.08 });
    return { m, tor, c, p, i, done: false, ic };
  });

  // ---- logic ----
  const cur = [0, 0, 0, 0, 0], got = [false, false, false, false, false];
  const orbs = cols.map((cl) => { const o = glow(cl.p.col, 0.075, 0.95); o.visible = false; g.add(o); return { o, k: -1, from: new THREE.Vector3(), cl }; });
  const end = new THREE.Vector3(0, 0.13, WZ);
  const anchor = grp(g, 0, 0.13, WZ);
  let cardT = 0, nGot = 0, finished = false, finT = 0;
  ctx.ui.hud('المس الأجزاء لتبني العالم');
  cols.forEach((cl) => touch(ctx, cl.m, () => {
    ctx.ui.card({ tag: 'الواقع الافتراضي', title: cl.p.title, body: cl.p.body, color: cl.p.col }); cardT = 2.0;
    const ob = orbs[cl.i]; if (ob.k < 0 && !got[cl.i]) { ob.k = 0; ob.o.visible = true; ob.from.set(cl.m.position.x, 0.1, cl.m.position.z); }
  }, cl.p.col));
  solids.forEach((s) => touch(ctx, s, () => { s.userData.spin = 1; ctx.sfx.good?.(); }, GOLD));

  return {
    update(t, dt, e) {
      seq.update(t, e); pulse.update(t, e);
      if (cardT > 0) { cardT -= dt; if (cardT <= 0 && !finished) ctx.ui.hideCard(); }
      const E = Math.max(e, 1e-3);
      seed.material.opacity = e * (nGot === 0 ? 0.5 + 0.2 * Math.sin(t * 2.4) : 0.15); seed.position.y = 0.1 + Math.sin(t * 1.6) * 0.01;
      rim.rotation.z = t * 0.3;
      // flying orbs
      for (let i = 0; i < 5; i++) {
        const ob = orbs[i]; if (ob.k < 0) continue;
        ob.k += dt / 0.75; const k = clamp01(ob.k), kk = ease(k);
        ob.o.position.set(ob.from.x + (end.x - ob.from.x) * kk, ob.from.y + (end.y - ob.from.y) * kk + Math.sin(k * Math.PI) * 0.1, ob.from.z + (end.z - ob.from.z) * kk);
        ob.o.scale.setScalar(0.075 * (1.2 - 0.5 * k) * E);
        if (k >= 1) {
          ob.k = -1; ob.o.visible = false; got[i] = true; nGot++;
          ctx.fx.burst(at(ctx, anchor), cols[i].p.col, 22, 0.35, 0.03); ctx.sfx.good?.();
          cols[i].done = true;
          if (nGot === 5) { finished = true; finT = 0; }
        }
      }
      // layer growth
      for (let i = 0; i < 5; i++) cur[i] += ((got[i] ? 1 : 0) - cur[i]) * Math.min(1, dt * 2.6);
      floor.material.opacity = (0.3 + 0.7 * cur[0]) * e; floor.scale.setScalar(0.85 + 0.15 * ease(cur[0]));
      solids.forEach((s, i) => {
        const k = Math.max(1e-4, easeBack(clamp01(cur[1] * 1.15 - i * 0.1)) * e);
        s.userData.spin = Math.max(0, s.userData.spin - dt * 0.8);
        s.scale.setScalar(k); s.position.y = s.userData.y + Math.sin(t * 1.6 + s.userData.ph) * 0.004 * cur[1] + Math.sin(s.userData.spin * Math.PI) * 0.03;
        s.rotation.y = t * 0.5 * (i + 1) * 0.5 + (1 - s.userData.spin) * 0 + s.userData.spin * 6;
        s.material.emissiveIntensity = 0.25 + cur[3] * (0.35 + 0.25 * Math.sin(t * 3 + i)) + s.userData.spin * 0.7;
      });
      box.material.opacity = (0.28 + 0.6 * cur[2]) * e; axes.material.opacity = cur[2] * e;
      box.rotation.y = Math.sin(t * 0.4) * 0.08;
      rings.forEach((r, i) => { const ph = (t * 0.55 + i * 0.5) % 1, s = 0.35 + ph * 1.05; r.scale.setScalar(s); r.material.opacity = cur[4] * (1 - ph) * 0.8 * e; });
      world.rotation.y = t * 0.12 * (1 + cur[1]);
      halo.material.opacity = e * (finished ? 0.35 + 0.1 * Math.sin(t * 3) : cur[0] * 0.12);
      cols.forEach((cl) => {
        cl.tor.material.emissiveIntensity = cl.done ? 0.9 + 0.3 * Math.sin(t * 3 + cl.i) : 0.45 + 0.4 * Math.sin(t * 2.4 + cl.i * 1.3);
        cl.ic.rotation.y = Math.sin(t * 0.9 + cl.i) * 0.25;
        if (cl.ic.userData.spinner) cl.ic.userData.spinner.rotation.y = t * 1.5;
        
      });
      if (finished) {
        finT += dt;
        if (finT > 2.6 && finT - dt <= 2.6) { ctx.ui.hideCard(); ctx.ui.hud('منظومة متكاملة تصنع عالماً تحسّه'); ctx.ui.done(); }
      }
    },
  };
}
