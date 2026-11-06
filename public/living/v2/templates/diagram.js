// A diagram that grows out of the page: nodes bloom one by one (breadth first), pencil draws each
// edge, then light flows along it. Tap a node to read it; its outgoing edges light up.
import * as THREE from 'three';
import {
  P, INK, ease, easeBack, clamp01, stag, smooth, V, toAr, css, T0, lightTube, paletteFor, ringMark, inkPath, pageText,
  tagSprite, solidTag, setSpr, arcCurve, packet, sampleCurve,
} from '../common.js';

export function buildDiagram(spec, ctx) {
  const pal = paletteFor(spec, 2);
  const { nodes = [], edges = [], title = '' } = spec.data;
  const g = new THREE.Group(); ctx.stage.add(g);
  const idx = new Map(nodes.map((n, i) => [n.id, i]));
  const E = edges.map(([a, b, lab]) => ({ a: idx.get(a), b: idx.get(b), lab })).filter((x) => x.a !== undefined && x.b !== undefined);
  // breadth-first depth from the first node (edges read both ways for ordering)
  const depth = nodes.map(() => -1); depth[0] = 0;
  for (let changed = true; changed;) { changed = false; E.forEach((x) => { [[x.a, x.b], [x.b, x.a]].forEach(([p, q]) => { if (depth[p] >= 0 && depth[q] < 0) { depth[q] = depth[p] + 1; changed = true; } }); }); }
  const maxD = Math.max(0, ...depth);
  depth.forEach((d, i) => { if (d < 0) depth[i] = maxD + 1; });
  const rank = {}; const appear = nodes.map((_, i) => { rank[depth[i]] = (rank[depth[i]] || 0); const r = rank[depth[i]]++; return T0 - 0.8 + depth[i] * 1.0 + r * 0.32; });

  const seen = new Set(); let now = 0, gate = 0, ready = false, finished = false, sel = -1;
  const packs = [];
  const items = nodes.map((n, i) => {
    const color = pal[depth[i] % pal.length];
    const root = new THREE.Group(); root.position.copy(P(n.u, n.v, 0)); g.add(root);
    const mark = ringMark(color, i === 0 ? 0.045 : 0.037, { seed: i * 5 + 2 }); root.add(mark);
    const w = Math.min(0.3, Math.max(0.12, 0.062 + n.label.length * 0.0102));
    const lab = i === 0 ? solidTag(n.label, w, color, { size: 40, width: 520 }) : tagSprite(n.label, w, color, { size: 38, width: 520 });
    lab.position.set(0, 0.085, 0); root.add(lab);
    const stem = inkPath([V(0, 0.008, 0), V(0, 0.05, 0)], { width: 1.3, jitter: 0.0005, seed: i + 7, opacity: 0.75 }); root.add(stem);
    stem.userData.len = 0.05;
    const hit = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.12, 14), new THREE.MeshBasicMaterial({ visible: false })); hit.position.y = 0.04; root.add(hit);
    const pick = () => select(i); ctx.tap(hit, pick); ctx.tap(lab, pick);
    return { n, i, color, root, mark, lab, w, stem, hit, lit: 0 };
  });

  // labels that would collide stack on higher levels
  {
    const placed = [];
    [...items].sort((a, b) => a.root.position.x - b.root.position.x).forEach((it) => {
      let lvl = 0;
      // a label near the edge slides inward, so its first letters are never cut by the page
      const limit = 0.485 - it.w / 2, labX = Math.max(-limit, Math.min(limit, it.root.position.x));
      it.labDX = labX - it.root.position.x;
      const clash = (l) => placed.some((o) => o.lvl === l && Math.abs(o.x - labX) < (o.w + it.w) / 2 + 0.01 && Math.abs(o.z - it.root.position.z) < 0.16);
      while (clash(lvl)) lvl++;
      placed.push({ x: labX, z: it.root.position.z, w: it.w, lvl });
      it.lvl = lvl;
      it.labY = 0.085 + lvl * 0.062;
      const sp = it.stem.userData.pts; void sp;
    });
  }
  items.forEach((it) => { it.lab.position.y = it.labY; it.lab.position.x = it.labDX; it.root.remove(it.stem); it.stem = inkPath([V(0, 0.008, 0), V(it.labDX, it.labY - 0.03, 0)], { width: 1.3, jitter: 0.0005, seed: it.i + 7, opacity: 0.75 }); it.root.add(it.stem); });

  const eds = E.map((x, k) => {
    const A = items[x.a].root.position, B = items[x.b].root.position;
    const dir = B.clone().sub(A).setY(0); const len = dir.length(); dir.normalize();
    const r0 = 0.05;
    const a = A.clone().addScaledVector(dir, r0).setY(0.008), b = B.clone().addScaledVector(dir, -r0).setY(0.008);
    const cv = arcCurve(a, b, 0.018 + len * 0.12);
    const color = items[x.a].color;
    const pts = sampleCurve(cv, 30).map((p) => p.clone().setY(0.006));
    const pencil = inkPath(pts, { width: 1.3, jitter: 0.0012, seed: k * 3 + 1, opacity: 0.6 }); g.add(pencil);
    const tube = lightTube(cv, { radius: 0.0055, color, speed: 0.5 }); tube.userData.fill(0); g.add(tube);
    // pencil arrowhead
    const tan = cv.getTangent(0.98).setY(0).normalize(), side = V(-tan.z, 0, tan.x), tip = b.clone().setY(0.007);
    const head = inkPath([tip.clone().addScaledVector(tan, -0.02).addScaledVector(side, 0.011), tip, tip.clone().addScaledVector(tan, -0.02).addScaledVector(side, -0.011)], { width: 1.7, jitter: 0, color, opacity: 0.95 }); g.add(head);
    let lab = null;
    if (x.lab) { lab = tagSprite(x.lab, 0.12, color, { size: 34, width: 300, pad: 16, radius: 20 }); lab.position.copy(cv.getPoint(0.5)).setY(0.045 + len * 0.1); lab.visible = false; g.add(lab); }
    const t0 = Math.min(appear[x.a], appear[x.b]) + 0.5;
    const pk = packet(color, 0.04); pk.visible = false; g.add(pk); packs.push(pk);
    return { x, cv, pencil, tube, head, lab, t0, pk, ph: Math.random(), burst: -9 };
  });

  // the title is written on the page like a heading
  const minV = Math.min(...nodes.map((n) => n.v)), avgU = nodes.reduce((s, n) => s + n.u, 0) / nodes.length;
  const heading = title ? pageText(title, { h: 0.04, title: true, bg: 'rgba(250,247,240,.9)' }) : null;
  if (heading) { heading.position.copy(P(avgU, Math.max(0.04, minV - 0.1), 0.006)); g.add(heading); }

  function select(i) {
    if (!ready || gate < 0.5) return;
    sel = i; seen.add(i);
    ctx.sfx.tap?.();
    ctx.fx.burst(items[i].root.position.clone().setY(0.06), items[i].color, 14, 0.28, 0.026);
    eds.forEach((ed) => { if (ed.x.a === i) ed.burst = now; });
    ctx.ui.card({ tag: i === 0 ? 'الفكرة المركزية' : 'عقدة', title: items[i].n.label, body: items[i].n.note || '', color: items[i].color });
    ctx.ui.hud(`المس العقد لتقرأ شرحها · ${toAr(seen.size)} من ${toAr(items.length)}`);
    if (seen.size === items.length && !finished) { finished = true; ctx.ui.done(); }
  }

  return {
    ready() { ready = true; ctx.ui.hud(`المس العقد لتقرأ شرحها · ${toAr(0)} من ${toAr(items.length)}`); },
    update(t, dt, e, k) {
      now = t; gate = k;
      items.forEach((it, i) => {
        const d = stag(t, appear[i], 0.9, clamp01) * e;
        it.mark.userData.reveal(d);
        const early = i === 0 ? stag(t, 0.3, 1.2) * (0.55 + 0.45 * Math.sin(t * 2.4)) : 0;
        it.lit = THREE.MathUtils.damp(it.lit, sel === i ? 1 : 0, 6, dt);
        it.mark.userData.level(Math.max(early, d * (0.6 + 0.2 * Math.sin(t * 2 + i))) * e + it.lit * 0.5);
        const lk = stag(t, appear[i] + 0.3, 0.7, easeBack) * e;
        setSpr(it.lab, it.w, lk * (1 + it.lit * 0.08)); it.lab.position.y = it.labY + Math.sin(t * 1.6 + i * 1.3) * 0.004 + it.lit * 0.012;
        it.stem.userData.reveal(d);
      });
      eds.forEach((ed) => {
        const p = (t - ed.t0) / 0.6;
        ed.pencil.userData.reveal(clamp01(p) * e);
        ed.tube.userData.fill(clamp01((t - ed.t0 - 0.3) / 0.9) * e); ed.tube.userData.update(dt);
        ed.head.userData.reveal(clamp01((t - ed.t0 - 1.0) / 0.3) * e);
        const flow = t > ed.t0 + 1.2;
        const pkBoost = t - ed.burst < 1.4;
        ed.pk.visible = flow && e > 0.5;
        if (flow) {
          const f = ((((t - ed.t0) * (pkBoost ? 0.8 : 0.28) + ed.ph) % 1) + 1) % 1; ed.pk.position.copy(ed.cv.getPoint(f));
          ed.pk.userData.a.material.opacity = 0.95 * Math.sin(f * Math.PI); ed.pk.userData.b.material.opacity = Math.sin(f * Math.PI);
        }
        if (ed.lab) { const s = clamp01((t - ed.t0 - 0.9) / 0.5) * e; ed.lab.visible = s > 0.02; setSpr(ed.lab, 0.12, easeBack(s)); }
      });
      if (heading) heading.userData.reveal(stag(t, T0 - 1, 1.6, clamp01) * e);
    },
  };
}
