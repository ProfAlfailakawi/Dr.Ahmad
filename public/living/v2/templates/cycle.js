// A loop of light: a bright orb travels round the ring, pausing at each step; each arc of the loop
// takes the colour of the step it leaves, and the pencil circle underneath is drawn on first.
import * as THREE from 'three';
import {
  P, INK, ease, easeBack, clamp01, stag, smooth, V, toAr, css, T0, TAU, lightTube, paletteFor, ringMark, inkPath, inkTicks,
  circlePts, tagSprite, solidTag, setSpr, softLight, lightPool, packet, pageText,
} from '../common.js';

export function buildCycle(spec, ctx) {
  const pal = paletteFor(spec, 3);
  const d = spec.data, steps = d.steps || [], N = steps.length;
  const R = d.radius || 0.14;
  const [cu, cv] = d.center || spec.center || [0.5, 0.5];
  const C = P(cu, cv, 0);
  const g = new THREE.Group(); g.position.copy(C); ctx.stage.add(g);
  const pos = (s, r = R, y = 0.01) => { const a = s * TAU; return V(Math.sin(a) * r, y, -Math.cos(a) * r); };

  // pencil circle (double stroke), then the coloured arcs between steps
  const ring1 = inkPath(circlePts(V(0, 0.006, 0), R, 72, -Math.PI / 2), { width: 1.8, seed: 3, pen: true });
  const ring2 = inkPath(circlePts(V(0, 0.006, 0), R + 0.006, 72, -Math.PI / 2 + 0.2, TAU * 0.96), { width: 0.9, seed: 9, opacity: 0.5 });
  g.add(ring1, ring2);
  const arcs = steps.map((_, k) => {
    const pts = Array.from({ length: 22 }, (_, i) => pos((k + i / 21) / N, R, 0.011));
    const cvv = new THREE.CatmullRomCurve3(pts);
    const t = lightTube(cvv, { radius: 0.0062, color: pal[k % pal.length], speed: 0.5 }); t.userData.fill(0); g.add(t);
    return t;
  });
  // compass ticks that slowly turn in the middle
  const tickPairs = Array.from({ length: 36 }, (_, i) => { const a = (i / 36) * TAU, r0 = R * 0.52, r1 = r0 + (i % 3 === 0 ? 0.018 : 0.009); return [V(Math.cos(a) * r0, 0.006, Math.sin(a) * r0), V(Math.cos(a) * r1, 0.006, Math.sin(a) * r1)]; });
  const ticks = inkTicks(tickPairs, { width: 1.2, opacity: 0.55 }); g.add(ticks);
  const heart = pageText(d.title || spec.title, { h: 0.036, title: true, bg: 'rgba(250,247,240,.88)' }); heart.position.set(0, 0.012, 0); g.add(heart);
  const glowC = lightPool(pal[0], R * 1.1, 0); glowC.position.y = 0.002; g.add(glowC);

  const nodes = steps.map((s, k) => {
    const color = pal[k % pal.length];
    const root = new THREE.Group(); root.position.copy(pos(k / N, R, 0)); g.add(root);
    const mark = ringMark(color, 0.036, { seed: k * 4 + 1 }); root.add(mark);
    const num = tagSprite(toAr(k + 1), 0.05, color, { size: 60, width: 150, pad: 12, radius: 60 }); num.position.set(0, 0.03, 0); root.add(num);
    const out = pos(k / N, 1, 0), dist = R + 0.1 + Math.min(0.06, s.label.length * 0.004);
    const w = Math.min(0.3, Math.max(0.12, 0.062 + s.label.length * 0.0102));
    const lab = tagSprite(s.label, w, color, { size: 38, width: 520 }); lab.position.set(out.x * 0.115 / R * R, 0.05, out.z * 0.115 / R * R); root.add(lab);
    const hit = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.1, 14), new THREE.MeshBasicMaterial({ visible: false })); hit.position.y = 0.04; root.add(hit);
    ctx.tap(hit, () => goTo(k, true)); ctx.tap(lab, () => goTo(k, true)); ctx.tap(num, () => goTo(k, true));
    void dist;
    return { s, k, color, root, mark, num, lab, w, lit: 0, hit };
  });

  const orb = packet(pal[0], 0.085); g.add(orb);
  const trail = Array.from({ length: 7 }, (_, i) => { const s = softLight(pal[0], 0.05 - i * 0.005, 0); g.add(s); return s; });
  let now = 0, gate = 0, ready = false, finished = false;
  let cur = 0, sc = 0, tgt = 0, reach = 0, auto = true, stepAt = 0;
  const visited = new Set();

  function setChoices() {
    ctx.ui.choices([
      { label: 'السابقة', onPick: () => goTo((cur + N - 1) % N, true) },
      { label: auto ? 'إيقاف التشغيل' : 'تشغيل تلقائي', onPick: () => { auto = !auto; stepAt = now; setChoices(); } },
      { label: 'التالية', primary: true, onPick: () => goTo((cur + 1) % N, true) },
    ]);
  }
  function goTo(k, manual) {
    if (!ready || gate < 0.5) return;
    if (manual) { auto = false; setChoices(); }
    cur = k; stepAt = now; visited.add(k);
    const base = k / N;
    tgt = manual ? base + Math.round(sc - base) : base + Math.ceil(sc - base - 0.02);
    ctx.sfx.tap?.();
    ctx.ui.card({ tag: `الخطوة ${toAr(k + 1)} من ${toAr(N)}`, title: steps[k].label, body: steps[k].body || '', color: nodes[k].color });
    ctx.ui.hud(d.title || spec.title);
    ctx.fx.burst(nodes[k].root.position.clone().add(g.position).setY(0.05), nodes[k].color, 14, 0.3, 0.026);
    if (visited.size === N && !finished) { finished = true; setTimeout(() => ctx.ui.done(), 1800); }
  }

  return {
    ready() { ready = true; goTo(0, false); setChoices(); },
    update(t, dt, e, k) {
      now = t; gate = k;
      const dr = stag(t, T0 - 0.6, 1.9, clamp01) * e;
      ring1.userData.reveal(dr); ring2.userData.reveal(clamp01(dr * 1.1 - 0.1));
      ticks.userData.reveal(stag(t, T0, 1.2, clamp01) * e); ticks.rotation.y = t * 0.18;
      heart.userData.reveal(stag(t, T0 + 0.3, 1.2, clamp01) * e);
      glowC.material.opacity = 0.28 * dr * (0.7 + 0.3 * Math.sin(t * 1.5));
      // orb: before anything is awake it already circles the faint loop; afterwards it runs to each step
      if (!ready) { sc = Math.max(0, t - 0.8) * 0.11; tgt = sc; }
      else {
        const diff = tgt - sc; sc += diff * Math.min(1, dt * 2.4);
        if (auto && t - stepAt > 4.6 && Math.abs(diff) < 0.012) goTo((cur + 1) % N, false);
      }
      reach = Math.max(reach, sc * N);
      const sp = ((sc % 1) + 1) % 1;
      const op = pos(sp, R, 0.016);
      orb.position.copy(op); orb.userData.a.material.opacity = 0.95 * dr; orb.userData.b.material.opacity = dr;
      const col = nodes[Math.min(N - 1, Math.floor(sp * N))].color; orb.userData.a.material.color.setHex(col);
      trail.forEach((s, i) => { s.position.copy(pos(sp - (i + 1) * 0.012, R, 0.014)); s.material.opacity = (0.55 - i * 0.07) * dr; s.material.color.setHex(col); });
      arcs.forEach((a, i) => { a.userData.fill(clamp01(reach - i) * e); a.userData.update(dt); });
      nodes.forEach((n, i) => {
        const d0 = stag(t, T0 - 0.2 + i * 0.28, 0.9, clamp01) * e;
        n.mark.userData.reveal(d0);
        n.lit = THREE.MathUtils.damp(n.lit, cur === i && ready ? 1 : 0, 6, dt);
        const early = i === 0 ? stag(t, 0.3, 1.2) * (0.55 + 0.45 * Math.sin(t * 2.4)) : 0;
        n.mark.userData.level(Math.max(early, d0 * (0.45 + 0.15 * Math.sin(t * 2 + i))) * e + n.lit * 0.6);
        const bk = stag(t, T0 + i * 0.28, 0.6, easeBack) * e;
        setSpr(n.num, 0.05, bk * (1 + n.lit * 0.2)); setSpr(n.lab, n.w, bk * (1 + n.lit * 0.08));
        n.lab.position.y = 0.05 + Math.sin(t * 1.6 + i) * 0.004;
      });
    },
  };
}
