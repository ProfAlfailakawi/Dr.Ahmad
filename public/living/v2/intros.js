// Eight page intros (5-8 s): a pencil draws a generic picture around `intro.at`, light runs through
// it, and the words are written on the page right to left. The motif only inspires the kind; the
// geometry is generic. playIntro(kind, intro, ctx) -> { update(t), done, group }.
import * as THREE from 'three';
import {
  P, INK, ease, easeBack, clamp01, lightTube, TAU, V, lerp, smooth, hash, PALETTES, INTRO_T, softLight, lightPool,
  inkPath, inkTicks, circlePts, rectPts, setAlpha, pageText, layoutWords, packet,
} from './common.js';

const U = (x, y, h = 0.005) => V(x, h, -y);       // local (x right, y up the page)
const curve = (pts, closed = false) => new THREE.CatmullRomCurve3(pts, closed, 'catmullrom', 0.5);
const along = (a, b, n = 24) => Array.from({ length: n + 1 }, (_, i) => a.clone().lerp(b, i / n));

export function playIntro(kind, intro, ctx) {
  const at = intro.at || [0.5, 0.5];
  const words = (intro.words && intro.words.length ? intro.words : []).slice(0, 4);
  const pal = PALETTES[hash(words.join('') + kind) % PALETTES.length];
  const root = new THREE.Group(); root.position.copy(P(at[0], at[1], 0)); ctx.stage.add(root);
  const statics = new THREE.Group(); root.add(statics);
  const inks = [], tubes = [], lights = [], texts = [], packs = [];
  let seed = 1, sounded = false;

  const S = {
    pal, root,
    ink(pts, t0, dur, o = {}) { const p = inkPath(pts, { seed: seed++, pen: true, ...o }); statics.add(p); inks.push([p, t0, dur]); return p; },
    ticks(pairs, t0, dur, o) { const p = inkTicks(pairs, o); statics.add(p); inks.push([p, t0, dur]); return p; },
    tube(cv, t0, dur, o = {}) { const tb = lightTube(cv, { radius: 0.0065, ...o }); statics.add(tb); tubes.push([tb, t0, dur]); return tb; },
    light(color, size, fn) { const s = softLight(color, size, 0); root.add(s); lights.push([s, fn]); return s; },
    pool(color, r, fn) { const s = lightPool(color, r, 0); s.position.y = 0.002; root.add(s); lights.push([s, fn]); return s; },
    packet(color, size) { const p = packet(color, size); root.add(p); packs.push(p); return p; },
    text(txt, o, t0, dur, pos) { const tx = pageText(txt, o); tx.position.copy(pos); statics.add(tx); texts.push([tx, t0, dur]); return tx; },
  };

  const BUILD = {
    // ---- an open book whose pages throw rays of light
    draw() {
      [1, -1].forEach((s, k) => {
        const leaf = curve([U(0, -0.03), U(s * 0.05, -0.045), U(s * 0.11, -0.04), U(s * 0.17, -0.06), U(s * 0.17, 0.065), U(s * 0.11, 0.085), U(s * 0.05, 0.08), U(0, 0.06), U(0, -0.03)]).getPoints(46);
        S.ink(leaf, 0.2 + k * 0.5, 1.5, { width: 1.9 });
        for (let i = 0; i < 4; i++) S.ink(along(U(s * 0.03, 0.045 - i * 0.025), U(s * (0.12 - (i % 2) * 0.03), 0.052 - i * 0.025), 6), 1.2 + k * 0.4 + i * 0.18, 0.4, { width: 1.1, jitter: 0.001 });
      });
      const rays = [-1, -0.5, 0, 0.5, 1];
      rays.forEach((a, i) => {
        const end = U(Math.sin(a) * 0.24, 0.06 + Math.cos(a * 0.9) * 0.2, 0.012);
        const c = new THREE.QuadraticBezierCurve3(U(0, 0.06, 0.01), U(Math.sin(a) * 0.12, 0.2, 0.06), end);
        S.tube(c, 2.4 + i * 0.22, 0.9, { color: pal[i % pal.length], radius: 0.0055 });
        S.light(pal[i % pal.length], 0.085, (t) => 0.8 * smooth((t - 3.0 - i * 0.22) / 0.6)).position.copy(end);
        const p = S.ink([end.clone().add(V(-0.012, 0, 0)), end.clone().add(V(0.012, 0, 0))], 3.1 + i * 0.22, 0.25, { width: 1.2, jitter: 0 });
        const q = S.ink([end.clone().add(V(0, 0, -0.012)), end.clone().add(V(0, 0, 0.012))], 3.2 + i * 0.22, 0.25, { width: 1.2, jitter: 0 });
        void p; void q;
      });
      S.pool(pal[0], 0.2, (t) => 0.5 * smooth((t - 2.6) / 1.2));
      return { words: U(0, -0.12) };
    },
    // ---- a river of light between two pencil banks
    flow() {
      const pts = (off) => Array.from({ length: 61 }, (_, i) => { const x = 0.3 - (0.6 * i) / 60; return U(x, Math.sin(x * 21) * 0.034 + off); });
      S.ink(pts(0.03), 0.2, 2.3, { width: 1.8 }); S.ink(pts(-0.03), 0.5, 2.3, { width: 1.8 });
      const mid = curve(pts(0).map((p) => p.clone().setY(0.012)));
      S.tube(mid, 1.8, 1.5, { color: pal[0], radius: 0.007 });
      const stations = [0.2, 0, -0.2].map((x, i) => {
        const c = U(x, Math.sin(x * 21) * 0.034);
        S.ink(circlePts(c.clone().setY(0.006), 0.026, 30), 2.0 + i * 0.4, 0.7, { width: 2, color: pal[(i + 1) % pal.length] });
        const l = S.light(pal[(i + 1) % pal.length], 0.1, () => 0); l.position.copy(c).setY(0.012); return { l, x };
      });
      const pk = Array.from({ length: 4 }, (_, i) => S.packet(pal[i % pal.length], 0.045));
      return {
        words: U(0, 0.115),
        anim(t) {
          pk.forEach((p, i) => { const f = (((t - 2.6) * 0.3 + i / 4) % 1 + 1) % 1; p.position.copy(mid.getPoint(f)); p.visible = t > 2.4; });
          stations.forEach((s, i) => { const near = pk.reduce((m, p) => Math.min(m, Math.abs(p.position.x - s.x)), 1); s.l.userData.o = clamp01(1 - near * 9); });
        },
        stationLights: stations,
      };
    },
    // ---- stairs that fill with colour while a light climbs them
    rise() {
      const hts = [0.03, 0.065, 0.1, 0.135, 0.17], tops = [];
      hts.forEach((h, i) => {
        const x = 0.15 - i * 0.075, c = U(x, -0.05 + h / 2);
        S.ink(rectPts(c, 0.056, h, 0.004), 0.2 + i * 0.4, 0.8, { width: 1.8, jitter: 0.001 });
        const fillMesh = new THREE.Mesh(new THREE.PlaneGeometry(0.052, h - 0.006).translate(0, (h - 0.006) / 2, 0), new THREE.MeshBasicMaterial({ color: pal[i % pal.length], transparent: true, opacity: 0.6, depthWrite: false, toneMapped: false }));
        fillMesh.rotation.x = -Math.PI / 2; fillMesh.position.copy(U(x, -0.047, 0.003)); fillMesh.scale.y = 0; fillMesh.renderOrder = 2;
        statics.add(fillMesh);
        tops.push({ x, y: -0.05 + h, fillMesh, i, t: 2.2 + i * 0.5 });
      });
      const orb = S.packet(pal[2], 0.075);
      const crown = S.light(pal[1], 0.14, (t) => 0.7 * smooth((t - 4.6) / 0.8)); crown.position.copy(U(tops[4].x, tops[4].y + 0.03, 0.02));
      return {
        words: U(0, -0.125),
        anim(t) {
          tops.forEach((s) => { s.fillMesh.scale.y = Math.max(0.001, smooth((t - s.t) / 0.55)); });
          const f = clamp01((t - 2.2) / 2.4) * 4, i = Math.min(3, Math.floor(f)), k = f - i;
          const a = tops[i], b = tops[Math.min(4, i + 1)];
          orb.position.set(lerp(a.x, b.x, ease(k)), 0.012 + Math.sin(k * Math.PI) * 0.05 + 0.002, -lerp(a.y, b.y, ease(k)) - 0.02);
          orb.visible = t > 2.1 && t < 5.7;
        },
      };
    },
    // ---- orbits: three rings, three travelling lights
    ring() {
      const radii = [0.065, 0.115, 0.165], orbs = [];
      radii.forEach((r, i) => {
        S.ink(circlePts(V(0, 0.005, 0), r, 56, i), 0.2 + i * 0.45, 1.6, { width: 1.8 });
        S.ink(circlePts(V(0, 0.005, 0), r + 0.007, 56, i + 2, TAU * 0.92), 0.6 + i * 0.45, 1.4, { width: 0.9, opacity: 0.55 });
        const cv = curve(circlePts(V(0, 0.011, 0), r, 48).slice(0, -1), true);
        S.tube(cv, 2.0 + i * 0.35, 1.3, { color: pal[i], radius: 0.0055 });
        orbs.push({ p: S.packet(pal[(i + 2) % pal.length], 0.06), r, sp: (i % 2 ? -1 : 1) * (0.8 - i * 0.18), a0: i * 2.1 });
      });
      const core = S.light(pal[1], 0.12, (t) => (0.5 + 0.35 * Math.sin(t * 3)) * smooth((t - 0.8) / 0.8));
      core.position.y = 0.01;
      return {
        words: U(0, -0.235),
        anim(t) { orbs.forEach((o) => { const a = o.a0 + t * o.sp * 1.4; o.p.position.set(Math.cos(a) * o.r, 0.014, Math.sin(a) * o.r); o.p.visible = t > 2.1; }); },
      };
    },
    // ---- one stem, two branches
    split() {
      const trunk = curve([U(0, -0.12), U(0.006, -0.07), U(-0.004, -0.03), U(0, 0.01)]).getPoints(24);
      S.ink(trunk, 0.2, 1.0, { width: 2 });
      const branch = (s, k) => {
        const pts = [U(0, 0.01), U(s * 0.045, 0.05), U(s * 0.13, 0.085), U(s * 0.21, 0.13)];
        const cv = curve(pts);
        S.ink(cv.getPoints(30), 1.0 + k * 0.4, 1.4, { width: 2 });
        S.ink(circlePts(pts[3].clone().setY(0.006), 0.035, 34), 2.2 + k * 0.5, 0.8, { width: 2.2, color: pal[k] });
        const l = S.light(pal[k], 0.14, (t) => 0.75 * smooth((t - 3.3 - k * 0.5) / 0.7)); l.position.copy(pts[3]).setY(0.012);
        S.tube(curve(pts.map((p) => p.clone().setY(0.012))), 2.2 + k * 0.4, 1.3, { color: pal[k], radius: 0.0065 });
      };
      branch(1, 0); branch(-1, 1);
      S.tube(curve([U(0, -0.12, 0.012), U(0.006, -0.07, 0.012), U(0, 0.01, 0.012)]), 1.7, 0.7, { color: pal[2], radius: 0.0065 });
      S.pool(pal[2], 0.18, (t) => 0.4 * smooth((t - 2.4) / 1.2)).position.copy(U(0, 0.05));
      return { words: U(0, -0.18) };
    },
    // ---- a number line where a light counts
    count() {
      const xs = Array.from({ length: 7 }, (_, i) => 0.25 - (0.5 * i) / 6);
      S.ink(along(U(0.29, 0), U(-0.29, 0), 20), 0.2, 1.6, { width: 2 });
      const ticks = xs.map((x, i) => {
        S.ink([U(x, -0.012), U(x, 0.012)], 0.8 + i * 0.12, 0.25, { width: 1.8, jitter: 0 });
        const d = S.text(String('٠١٢٣٤٥٦'[i]), { h: 0.05, title: true, color: '#2b2620' }, 1.0 + i * 0.14, 0.4, U(x, 0.06, 0.006));
        d.userData.pop = 0;
        const l = S.light(pal[i % pal.length], 0.1, () => 0); l.position.copy(U(x, 0, 0.012));
        return { x, d, l, at: 2.2 + i * 0.5 };
      });
      const dot = S.packet(pal[0], 0.06);
      return {
        words: U(0, -0.1),
        anim(t) {
          const f = clamp01((t - 2.2) / 3.0) * 6, i = Math.min(5, Math.floor(f)), k = f - i;
          dot.position.set(lerp(xs[i], xs[i + 1], ease(k)), 0.016 + Math.sin(k * Math.PI) * 0.03, 0);
          dot.visible = t > 2.1 && t < 5.7;
          ticks.forEach((tk) => { const lit = smooth((t - tk.at) / 0.4); tk.l.userData.o = lit * 0.8; tk.d.scale.setScalar(1 + 0.35 * lit * Math.exp(-(t - tk.at) * 2) * (t > tk.at ? 1 : 0)); });
        },
        tickLights: ticks,
      };
    },
    // ---- a viewfinder scanning the page
    scan() {
      const W = 0.4, H = 0.26;
      S.ticks(((c) => { const pairs = []; [[1, 1], [-1, 1], [-1, -1], [1, -1]].forEach(([sx, sy]) => { const p = U(sx * W / 2, sy * H / 2); pairs.push([p, V(p.x - sx * 0.05, p.y, p.z)], [p, V(p.x, p.y, p.z + sy * 0.05)]); }); return pairs; })(), 0.2, 1.2, { width: 2.4 });
      S.ink(circlePts(V(0, 0.005, 0), 0.05, 40), 0.9, 1.0, { width: 1.8 });
      S.ticks([[U(-0.07, 0), U(-0.03, 0)], [U(0.03, 0), U(0.07, 0)], [U(0, 0.03), U(0, 0.07)], [U(0, -0.07), U(0, -0.03)]], 1.3, 0.6, { width: 1.6 });
      const cells = [];
      for (let r = 0; r < 4; r++) for (let c = 0; c < 8; c++) {
        const x = -W / 2 + 0.03 + c * ((W - 0.06) / 7), y = H / 2 - 0.025 - r * ((H - 0.05) / 3);
        if (Math.hypot(x, y) < 0.065) continue;
        const l = S.light(pal[(r + c) % pal.length], 0.05, () => 0); l.position.copy(U(x, y, 0.01)); cells.push({ l, y });
      }
      const beam = lightTube(new THREE.LineCurve3(U(-W / 2, 0, 0.012), U(W / 2, 0, 0.012)), { color: pal[0], radius: 0.007, speed: 0.8 });
      beam.userData.fill(1); statics.add(beam); tubes.push([beam, 0, 0]);
      const wash = lightPool(pal[0], 0.4, 0); wash.scale.set(W * 1.3, 0.14, 1); wash.position.y = 0.003; root.add(wash); lights.push([wash, () => 0]);
      return {
        words: U(0, -0.19),
        anim(t) {
          const f = clamp01((t - 1.8) / 3.0), y = lerp(H / 2, -H / 2, ease(f));
          beam.position.z = -y; wash.position.z = -y - 0.0; beam.visible = t > 1.7 && t < 5.2; wash.userData.o = beam.visible ? 0.5 : 0;
          cells.forEach((c) => { const passed = c.y > y; c.l.userData.o = t > 1.8 ? (passed ? 0.5 + 0.2 * Math.sin(t * 4 + c.y * 40) : 0) : 0; });
        },
        scanning: true,
      };
    },
    // ---- a plant growing out of the paper
    grow() {
      const stem = curve([U(0, -0.12), U(0.012, -0.06), U(-0.01, 0), U(0.008, 0.06), U(0, 0.12)]);
      S.ink(stem.getPoints(40), 0.2, 1.8, { width: 2.2 });
      S.ink(curve([U(-0.2, -0.12), U(-0.1, -0.125), U(0.05, -0.115), U(0.2, -0.122)]).getPoints(30), 0.1, 1.2, { width: 1.5, opacity: 0.7 });
      const leafs = [];
      const spec = [[-1, -0.07], [1, -0.03], [-1, 0.02], [1, 0.06], [0, 0.125]];
      spec.forEach(([s, y], i) => {
        const base = U(0, y), dir = s === 0 ? V(0, 0, -1) : V(s * 0.8, 0, -0.35).normalize();
        const tip = base.clone().addScaledVector(dir, s === 0 ? 0.04 : 0.13);
        const side = V(-dir.z, 0, dir.x);
        const mid = base.clone().addScaledVector(dir, (s === 0 ? 0.04 : 0.13) * 0.5);
        const lp = [base, mid.clone().addScaledVector(side, 0.026), tip, mid.clone().addScaledVector(side, -0.026), base];
        if (s !== 0) S.ink(curve([base, base.clone().addScaledVector(dir, 0.05).add(V(0, 0, -0.02)), base.clone().addScaledVector(dir, 0.08)]).getPoints(10), 0.9 + i * 0.35, 0.5, { width: 1.5 });
        S.ink(curve(lp).getPoints(26), 1.2 + i * 0.35, 0.8, { width: 1.8, jitter: 0.001 });
        const c = base.clone().addScaledVector(dir, (s === 0 ? 0.02 : 0.105));
        const l = S.light(pal[i % pal.length], 0.12, (t) => 0.75 * smooth((t - 2.6 - i * 0.4) / 0.9)); l.position.copy(c).setY(0.012);
        leafs.push(l);
      });
      S.tube(stem, 1.8, 2.2, { color: pal[3], radius: 0.0065 });
      return { words: U(0, -0.185) };
    },
  };

  const made = (BUILD[kind] || BUILD.draw)();
  // Words, written right to left, each underlined by a light.
  const wl = layoutWords(words.length ? words : [], { h: 0.034 });
  const wordHost = new THREE.Group(); wordHost.position.copy(made.words || U(0, -0.15)); root.add(wordHost);
  const wordTubes = [];
  wl.forEach((it, i) => {
    wordHost.add(it);
    const w = it.userData.w;
    const ul = lightTube(new THREE.LineCurve3(V(w / 2, 0.006, 0.02 + it.position.z), V(-w / 2, 0.006, 0.02 + it.position.z)), { color: pal[(i + 1) % pal.length], radius: 0.0035, glass: false });
    ul.position.x = it.position.x; wordHost.add(ul); wordTubes.push([ul, 1.0 + i * 0.85 + 1.1, 0.7]);
    texts.push([it, 1.0 + i * 0.85, 1.1]);
  });
  tubes.push(...wordTubes);
  const pen = softLight(INK, 0.026, 0); wordHost.add(pen);

  let last = 0;
  const api = {
    group: root, done: false,
    update(t) {
      const dt = clamp01(t - last) * 1; last = t; const d = Math.min(dt, 0.1);
      const fade = t < 5.5 ? 1 : 1 - ease((t - 5.5) / 0.9);
      inks.forEach(([p, t0, dur]) => p.userData.reveal(smooth((t - t0) / dur)));
      tubes.forEach(([tb, t0, dur]) => { if (dur) tb.userData.fill(smooth((t - t0) / dur)); tb.userData.update(d); });
      let writing = null;
      texts.forEach(([tx, t0, dur]) => { const p = clamp01((t - t0) / dur); tx.userData.reveal(p); if (p > 0 && p < 1 && tx.parent === wordHost) writing = [tx, p]; });
      if (writing) { pen.position.set(writing[0].position.x + writing[0].userData.edge(writing[1]), 0.012, writing[0].position.z); pen.material.opacity = 0.7 * fade; } else pen.material.opacity = 0;
      if (made.anim) made.anim(t);
      lights.forEach(([s, fn]) => {
        const o = s.userData.o !== undefined ? s.userData.o : fn(t);
        s.material.opacity = Math.max(0, (s.userData.o !== undefined ? Math.max(o, fn(t)) : o)) * fade;
      });
      if (fade < 1 || api._faded) { setAlpha(statics, fade); setAlpha(wordHost, fade); api._faded = fade < 1; }
      packs.forEach((p) => { p.userData.a.material.opacity = 0.95 * fade; p.userData.b.material.opacity = fade; });
      if (!sounded && t > 2.4) { sounded = true; ctx.sfx?.whoosh?.(); }
      root.visible = fade > 0.003 || t < 0.1;
      api.done = t >= INTRO_T;
    },
    dispose() { ctx.stage.remove(root); },
  };
  return api;
}
