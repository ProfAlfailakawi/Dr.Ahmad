// Two ideas side by side. A slider moves a bridge of light between them: the emblem above morphs
// (circle <-> hexagon, colour lerped) and the point rows lift on the side the light leans toward.
import * as THREE from 'three';
import {
  P, ease, easeBack, clamp01, stag, V, T0, TAU, lightTube, paletteFor, inkPath, tagSprite, solidTag,
  setSpr, softLight, lightPool, lerp, packet,
} from '../common.js';

export function buildCompare(spec, ctx) {
  const pal = paletteFor(spec, 5);
  const cA = pal[0], cB = pal[1], cC = new THREE.Color(cA), cD = new THREE.Color(cB);
  const d = spec.data, A = d.a || { title: '', points: [] }, B = d.b || { title: '', points: [] };
  const rows = Math.max(A.points.length, B.points.length);
  // the block is wider than most printed pictures: keep it whole on the page instead of hanging over the edge
  const [cu0, cv0] = spec.center || [0.5, 0.5];
  const cu = Math.min(0.585, Math.max(0.415, cu0)), cv = cv0;
  const g = new THREE.Group(); g.position.copy(P(cu, cv, 0)); ctx.stage.add(g);
  const X = 0.225, W = 0.36, GAP = 0.014;          // a on the right, as Arabic reads

  const mk = (txt, color) => tagSprite(txt, W, color, { size: 32, width: 560, pad: 22, radius: 22, weight: 700 });
  const pa = A.points.map((t) => mk(t, cA)), pb = B.points.map((t) => mk(t, cB));
  const hOf = (s) => (s ? s.scale.y : 0);
  const rowH = Array.from({ length: rows }, (_, i) => Math.max(hOf(pa[i]), hOf(pb[i])));
  const span = rowH.reduce((s, h) => s + h, 0) + GAP * Math.max(0, rows - 1);
  const yTopRows = span / 2 + 0.01;
  const rowY = []; { let acc = yTopRows; rowH.forEach((h) => { rowY.push(acc - h / 2); acc -= h + GAP; }); }
  const zOf = (y) => -y;

  const titleA = solidTag(A.title, 0.32, cA, { size: 46, width: 520 }), titleB = solidTag(B.title, 0.32, cB, { size: 46, width: 520 });
  const headY = yTopRows + 0.05;
  titleA.position.set(X, 0.02, zOf(headY)); titleB.position.set(-X, 0.02, zOf(headY));
  g.add(titleA, titleB);

  const cells = [];
  const addSide = (arr, sx, color) => arr.forEach((s, i) => {
    s.position.set(sx * X, 0.02, zOf(rowY[i]));
    const zl = zOf(rowY[i] - rowH[i] / 2 - 0.004);
    const guide = inkPath([V(sx * X - W / 2, 0.006, zl), V(sx * X + W / 2, 0.006, zl)], { color, width: 1.4, jitter: 0.001, seed: i * 2 + (sx > 0 ? 1 : 5), opacity: 0.6 });
    g.add(guide, s);
    cells.push({ s, guide, i, sx });
    // the rows are small on a phone: a touch opens the sentence at reading size
    const col = sx > 0 ? A : B;
    ctx.tap(s, () => { if (!ready) return; ctx.sfx.pop?.(); ctx.ui.card({ tag: col.title, title: col.points[i], body: '', color }); });
  });
  addSide(pa, 1, cA); addSide(pb, -1, cB);
  // a soft pool of the leaning side's colour lights the page behind each column
  const pools = [1, -1].map((sx) => { const p = lightPool(sx > 0 ? cA : cB, 0.5, 0); p.scale.set(W * 1.25, span + 0.12, 1); p.position.set(sx * X, 0.003, zOf(0)); g.add(p); return p; });

  // emblem: an ink outline that morphs between circle and hexagon
  const EM = 72, emR = 0.06, emY = headY + 0.13;
  const shapeAt = (k, s) => {
    const a = (k / EM) * TAU, sector = TAU / 6, m = ((a % sector) + sector) % sector;
    const hex = Math.cos(sector / 2) / Math.cos(m - sector / 2);
    const r = emR * (1 + (hex - 1) * s);
    return V(Math.cos(a) * r, 0.012, Math.sin(a) * r);
  };
  const emGroup = new THREE.Group(); emGroup.position.set(0, 0, zOf(emY)); g.add(emGroup);
  let emCur = null, emLast = -1;
  const rebuildEmblem = (s, col) => {
    if (emCur) { emGroup.remove(emCur); emCur.traverse((o) => { o.geometry?.dispose?.(); o.material?.dispose?.(); }); }
    emCur = inkPath(Array.from({ length: EM + 1 }, (_, k) => shapeAt(k % EM, s)), { color: col, width: 3, jitter: 0.0008, seed: 4 });
    const inner = inkPath(Array.from({ length: EM + 1 }, (_, k) => shapeAt(k % EM, 1 - s)).map((p) => p.multiplyScalar(0.6).setY(0.011)), { color: 0x2b2620, width: 1.1, jitter: 0.001, seed: 8, opacity: 0.6 });
    emCur.add(inner); emCur.userData.inner = inner;
    emGroup.add(emCur);
  };
  const emDot = softLight(cA, 0.13, 0); emDot.position.y = 0.014; emGroup.add(emDot);
  const emPool = lightPool(cA, 0.17, 0); emPool.position.y = 0.003; emGroup.add(emPool);

  // bridge of light under the block, with a bead that rides it
  const ax = X + W / 2, bridgeY = -span / 2 - 0.05;
  const bridge = lightTube(new THREE.LineCurve3(V(ax, 0.012, zOf(bridgeY)), V(-ax, 0.012, zOf(bridgeY))), { radius: 0.006, color: cA, speed: 0.4 });
  bridge.userData.fill(0); g.add(bridge);
  const bead = packet(cA, 0.085); bead.position.set(0, 0.02, zOf(bridgeY)); g.add(bead);
  const axisTxt = d.axis ? tagSprite(d.axis, 0.58, 0xa08a4a, { size: 34, width: 820, weight: 700, pad: 20, radius: 24 }) : null;
  if (axisTxt) { axisTxt.position.set(0, 0.03, zOf(bridgeY - 0.055)); g.add(axisTxt); }

  let ready = false, finished = false, touched = false, sv = 0.5, tv = 0.5, sawA = false, sawB = false, verdictShown = false;

  function checkEnds() {
    if (tv < 0.1) sawA = true;
    if (tv > 0.9) sawB = true;
    if (sawA && sawB && !verdictShown) {
      verdictShown = true;
      setTimeout(() => {
        ctx.ui.card({ tag: 'تأمّل', title: d.verdict || '', body: 'قارن النقطتين المتقابلتين في كل سطر، ثم قرّر أيّهما أنسب لموقفك.', color: pal[2] });
        ctx.sfx.good?.();
        if (!finished) { finished = true; ctx.ui.done(); }
      }, 700);
    }
  }

  return {
    ready() {
      ready = true;
      ctx.ui.slider({ label: 'حرّك الضوء', value: 0.5, onInput: (v) => { touched = true; tv = v; checkEnds(); } });
      ctx.ui.hud('حرّك المنزلق، والمس أي سطر لتقرأه');
    },
    update(t, dt, e) {
      if (!touched) tv = 0.5 + 0.5 * Math.sin(Math.max(0, t - 1) * 0.9 - 0.4);   // already swaying before it is touched
      sv = THREE.MathUtils.damp(sv, tv, touched ? 8 : 20, dt);
      const dr = stag(t, T0 - 0.6, 1.6, clamp01) * e;
      const sm = Math.round(sv * 40) / 40;
      if (sm !== emLast) { emLast = sm; cC.setHex(cA).lerp(cD.setHex(cB), sm); rebuildEmblem(sm, cC.getHex()); }
      emGroup.rotation.y = t * 0.12;
      emCur.userData.reveal(dr); emCur.userData.inner.userData.reveal(dr);
      cC.setHex(cA).lerp(cD.setHex(cB), sv);
      emDot.material.color.copy(cC); emDot.material.opacity = (0.35 + 0.15 * Math.sin(t * 2.4)) * Math.max(dr, stag(t, 0.3, 1)) * e;
      emPool.material.color.copy(cC); emPool.material.opacity = 0.34 * Math.max(dr, stag(t, 0.3, 1) * 0.7) * e;
      bead.position.x = lerp(ax, -ax, sv);
      bead.userData.a.material.color.copy(cC); bead.userData.a.material.opacity = 0.95 * dr; bead.userData.b.material.opacity = dr;
      bridge.userData.fill(dr); bridge.userData.update(dt); bridge.userData.core.material.color.copy(cC);
      if (axisTxt) setSpr(axisTxt, 0.58, stag(t, T0 + 1.0, 0.7, easeBack) * e);
      [titleA, titleB].forEach((s, i) => { const w = i === 0 ? 1 - sv : sv; setSpr(s, 0.32, stag(t, T0 + i * 0.3, 0.7, easeBack) * e * (0.92 + 0.14 * w)); s.position.y = 0.02 + w * 0.02; });
      pools.forEach((p, i) => { p.material.opacity = 0.5 * (i === 0 ? 1 - sv : sv) * dr; });
      cells.forEach((c) => {
        const w = c.sx > 0 ? 1 - sv : sv;           // how much of the light leans to this side
        const bk = stag(t, T0 + 0.4 + c.i * 0.22 + (c.sx > 0 ? 0 : 0.11), 0.7, easeBack) * e;
        setSpr(c.s, W, bk * (0.94 + 0.08 * w));
        c.s.position.y = 0.02 + w * 0.035; c.s.material.opacity = 0.72 + 0.28 * w;
        c.guide.userData.reveal(clamp01(bk)); c.guide.userData.mat.opacity = 0.25 + 0.6 * w;
      });
    },
  };
}
