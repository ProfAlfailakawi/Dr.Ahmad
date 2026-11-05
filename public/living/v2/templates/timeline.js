// A light moves along an axis drawn on the page, waking each event in order. The slider scrubs the
// light; events it has passed stay lit in colour, those ahead wait in pencil.
import * as THREE from 'three';
import {
  P, INK, ease, easeBack, clamp01, stag, smooth, V, toAr, css, T0, lightTube, paletteFor, ringMark, inkPath, inkTicks,
  tagSprite, solidTag, setSpr, softLight, lightPool, packet, lerp,
} from '../common.js';

export function buildTimeline(spec, ctx) {
  const pal = paletteFor(spec, 4);
  const d = spec.data, items = d.items || [], N = items.length;
  const ax = d.axis || [0.12, 0.5, 0.88, 0.5];
  const A = P(ax[0], ax[1], 0.006), B = P(ax[2], ax[3], 0.006);
  const dir = B.clone().sub(A).normalize(), nrm = V(-dir.z, 0, dir.x);
  const g = new THREE.Group(); ctx.stage.add(g);
  const at = (s, y = 0.006) => A.clone().lerp(B, s).setY(y);
  const posS = items.map((_, i) => (N > 1 ? i / (N - 1) : 0.5) * 0.9 + 0.05);

  const pencil = inkPath([A, B], { width: 2, seed: 5, pen: true, jitter: 0.0016 }); g.add(pencil);
  const pencil2 = inkPath([A.clone().addScaledVector(nrm, 0.006), B.clone().addScaledVector(nrm, 0.006)], { width: 0.9, seed: 12, opacity: 0.5 }); g.add(pencil2);
  const tan = dir.clone(), side = nrm.clone();
  const arrow = inkPath([B.clone().addScaledVector(tan, -0.03).addScaledVector(side, 0.016), B, B.clone().addScaledVector(tan, -0.03).addScaledVector(side, -0.016)], { width: 2, jitter: 0 }); g.add(arrow);
  const tube = lightTube(new THREE.LineCurve3(at(0, 0.012), at(1, 0.012)), { radius: 0.0065, color: pal[0], speed: 0.6 }); tube.userData.fill(0); g.add(tube);
  const tubeCore = tube.userData.core.material;

  const nodes = items.map((it, i) => {
    const color = pal[i % pal.length], up = i % 2 ? -1 : 1;
    const root = new THREE.Group(); root.position.copy(at(posS[i], 0)); g.add(root);
    const mark = ringMark(color, 0.034, { seed: i * 3 + 2 }); root.add(mark);
    const tick = inkPath([V(0, 0.006, 0), nrm.clone().multiplyScalar(up * 0.085).setY(0.006)], { width: 1.2, jitter: 0.0008, seed: i + 3, opacity: 0.7 }); root.add(tick);
    const when = solidTag(it.when, 0.13, color, { size: 40, width: 300, pad: 16, radius: 22 }); when.position.copy(nrm.clone().multiplyScalar(up * 0.085)).setY(0.04); root.add(when);
    const w = Math.min(0.3, Math.max(0.12, 0.062 + it.label.length * 0.0102));
    const lab = tagSprite(it.label, w, color, { size: 36, width: 520 }); lab.position.copy(nrm.clone().multiplyScalar(up * 0.085)).setY(0.04 + 0.1); root.add(lab);
    const hit = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.1, 14), new THREE.MeshBasicMaterial({ visible: false })); hit.position.y = 0.04; root.add(hit);
    ctx.tap(hit, () => jump(i)); ctx.tap(lab, () => jump(i)); ctx.tap(when, () => jump(i));
    return { it, i, color, root, mark, tick, when, lab, w, lit: 0 };
  });

  const orb = packet(pal[0], 0.1); g.add(orb);
  const halo = lightPool(pal[0], 0.16, 0); halo.position.y = 0.003; g.add(halo);

  let now = 0, gate = 0, ready = false, finished = false;
  let s = 0, target = 0, manual = false, idx = -1, shownIdx = -1, waitUntil = 0, autoI = 0, autoWait = -1, reached = new Set();
  const nearIdx = (v) => { let b = 0; posS.forEach((p, i) => { if (Math.abs(p - v) < Math.abs(posS[b] - v)) b = i; }); return b; };

  function show(i, quiet) {
    if (i === shownIdx) return; shownIdx = i; reached.add(i);
    ctx.sfx.tap?.();
    if (!quiet) ctx.fx.burst(nodes[i].root.position.clone().setY(0.05), nodes[i].color, 12, 0.26, 0.024);
    ctx.ui.card({ tag: items[i].when, title: items[i].label, body: items[i].body || '', color: nodes[i].color });
    if (reached.size === N && !finished) { finished = true; setTimeout(() => ctx.ui.done(), 2200); }
  }
  function jump(i) { if (!ready || gate < 0.5) return; manual = true; target = posS[i]; show(i); syncSlider(posS[i]); }
  function syncSlider(v) {
    ctx.ui.slider({ label: d.sliderLabel || 'الزمن', value: v, onInput: (x) => { manual = true; target = x; const i = nearIdx(x); if (Math.abs(posS[i] - x) < 0.5 / N * 0.8) show(i, true); else ctx.ui.hideCard(), shownIdx = -1; } });
  }

  return {
    ready() { ready = true; syncSlider(0); ctx.ui.hud('اسحب الضوء على المحور، أو المس حدثاً'); waitUntil = now + 0.2; },
    update(t, dt, e, k) {
      now = t; gate = k;
      const dr = stag(t, T0 - 0.8, 2.0, clamp01) * e;
      pencil.userData.reveal(dr); pencil2.userData.reveal(clamp01(dr * 1.1 - 0.1)); arrow.userData.reveal(clamp01((dr - 0.9) * 10));
      if (!ready) { s = clamp01((t - 0.6) / 5.4) * 0.12 + 0.0; target = s; }
      else if (!manual && autoI < N) {
        // the light walks to each event in order, waiting a moment on each one
        const goal = posS[autoI];
        target = goal;
        if (Math.abs(s - goal) < 0.012) {
          if (autoWait < 0) { show(autoI); syncSlider(goal); autoWait = t + 3.2; } else if (t > autoWait) { autoI++; autoWait = -1; }
        }
      }
      s = THREE.MathUtils.damp(s, target, ready ? 3 : 60, dt);
      tube.userData.fill(Math.max(s, 0.0001) * e); tube.userData.update(dt);
      const col = nodes[Math.min(N - 1, Math.max(0, nearIdx(s)))].color;
      orb.position.copy(at(s, 0.02)); orb.userData.a.material.color.setHex(col);
      orb.userData.a.material.opacity = 0.95 * dr; orb.userData.b.material.opacity = dr;
      halo.position.x = orb.position.x; halo.position.z = orb.position.z; halo.material.color.setHex(col); halo.material.opacity = 0.35 * dr;
      tubeCore.color.setHex(col);
      nodes.forEach((n, i) => {
        const d0 = stag(t, T0 + i * 0.3, 0.9, clamp01) * e;
        n.mark.userData.reveal(d0);
        const passed = s >= posS[i] - 0.004;
        n.lit = THREE.MathUtils.damp(n.lit, passed ? 1 : 0, 6, dt);
        const early = i === 0 ? stag(t, 0.3, 1.2) * (0.55 + 0.45 * Math.sin(t * 2.4)) : 0;
        n.mark.userData.level(Math.max(early, d0 * (0.25 + 0.12 * Math.sin(t * 2 + i))) * e + n.lit * 0.65);
        n.tick.userData.reveal(d0);
        const bk = stag(t, T0 + 0.4 + i * 0.3, 0.6, easeBack) * e;
        const pop = 1 + (shownIdx === i ? 0.1 : 0);
        setSpr(n.when, 0.13, bk * pop); setSpr(n.lab, n.w, bk * pop);
        n.when.material.opacity = n.lab.material.opacity = 0.5 + 0.5 * n.lit;
        n.root.children.forEach(() => {});
      });
    },
  };
}
