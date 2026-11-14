// Shared toolkit of the game library: physical paper tokens with Arabic faces, pencil lines that draw
// themselves, glass tubes, coloured lights that stay coloured on white paper, and a small runtime
// (timers, tweens, particles, end-of-game card) that every game type builds on.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { P, PAGE_H, PAPER, INK, ease, easeBack, stag, clamp01, glowTexture, lightTube, sketch } from '../../kit.js?v=33';
import { inked } from '../../pencil.js?v=33';

export { THREE, P, PAGE_H, PAPER, INK, ease, easeBack, stag, clamp01, lightTube, sketch, inked, RoundedBoxGeometry };
export const TAU = Math.PI * 2;
export const toAr = (n) => String(n).replace(/\d/g, (d) => '٠١٢٣٤٥٦٧٨٩'[d]);
export const css = (c) => '#' + c.toString(16).padStart(6, '0');
export const lerp = THREE.MathUtils.lerp;
export const damp = THREE.MathUtils.damp;
export const clamp = THREE.MathUtils.clamp;
export const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
export const COL = { teal: 0x1fa5a0, blue: 0x2a8fd0, amber: 0xef8f2a, gold: 0xd4ad55, green: 0x2f9e5b, red: 0xd6453a, violet: 0x7a4fd0, rose: 0xe0457a, slate: 0x2f7fb0, ink: INK };
const K = 1800; // canvas pixels per page unit: sharp Arabic at any zoom

export function shuffle(arr, seed = 7) {
  const a = arr.slice(); let s = seed >>> 0;
  const rnd = () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

// ---------------------------------------------------------------------------------- text faces
function wrap(g, text, maxW) {
  const out = [];
  for (const para of String(text).split('\n')) {
    let line = '';
    for (const word of para.split(' ')) {
      const test = line ? line + ' ' + word : word;
      if (g.measureText(test).width > maxW && line) { out.push(line); line = word; } else line = test;
    }
    out.push(line);
  }
  return out;
}

export function faceCanvas(text, w, o = {}) {
  const fsPx = Math.round((o.fs ?? 0.02) * K), subPx = Math.round((o.subFs ?? 0.0148) * K);
  const width = Math.round(w * K), pad = Math.round((o.pad ?? 0.012) * K);
  const c = document.createElement('canvas'); const g = c.getContext('2d');
  const fam = o.title ? '"Reem Kufi", Tajawal, sans-serif' : 'Tajawal, sans-serif';
  const font = `${o.weight ?? 700} ${fsPx}px ${fam}`, sfont = `500 ${subPx}px Tajawal, sans-serif`;
  g.font = font; const lines = wrap(g, text, width - pad * 2);
  g.font = sfont; const sublines = o.sub ? wrap(g, o.sub, width - pad * 2) : [];
  const lh = fsPx * 1.38, slh = subPx * 1.42;
  const blockH = lines.length * lh + sublines.length * slh + (sublines.length ? pad * 0.25 : 0);
  const height = o.h ? Math.round(o.h * K) : Math.ceil(blockH + pad * 2);
  c.width = width; c.height = height;
  const rad = Math.round((o.radius ?? 0.014) * K), bw = Math.round((o.bw ?? 0.0042) * K);
  if (o.fill) { g.fillStyle = o.fill; g.beginPath(); g.roundRect(bw, bw, width - bw * 2, height - bw * 2, rad); g.fill(); }
  if (o.border !== false && o.color) {
    g.save(); g.shadowColor = o.color; g.shadowBlur = bw * 2.2; g.strokeStyle = o.color; g.lineWidth = bw; g.globalAlpha = o.borderAlpha ?? 1;
    g.beginPath(); g.roundRect(bw * 1.2, bw * 1.2, width - bw * 2.4, height - bw * 2.4, rad); g.stroke(); g.restore();
  }
  g.direction = 'rtl'; g.textBaseline = 'middle';
  g.textAlign = (o.align || 'center') === 'center' ? 'center' : 'right';
  const x = (o.align || 'center') === 'center' ? width / 2 : width - pad;
  let y = (height - blockH) / 2;
  g.font = font; g.fillStyle = o.tcolor || '#1f1b16';
  lines.forEach((l) => { g.fillText(l, x, y + lh / 2); y += lh; });
  if (sublines.length) {
    y += pad * 0.25; g.font = sfont; g.fillStyle = o.subColor || '#5b5247';
    sublines.forEach((l) => { g.fillText(l, x, y + slh / 2); y += slh; });
  }
  return c;
}
const tex = (c) => { const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t; };

// A physical paper token lying on the page: pencil-drawn slab, an Arabic face, a coloured pool of light.
export function token(text, w, color = COL.gold, o = {}) {
  const T = { text, w, color, o: { ...o }, goal: null, lam: 9, glow: o.glow ?? 0.0, glowGoal: o.glow ?? 0.0, dim: 1, p: 0, t0: 0, hidden: false, sub: o.sub };
  const render = () => faceCanvas(T.text, w, { ...T.o, sub: T.sub, color: css(T.color), h: T.fixedH });
  let c = render();
  T.h = w * c.height / c.width; T.fixedH = T.h;
  const g = T.g = new THREE.Group();
  const th = T.th = o.th ?? 0.011;
  if (o.slab !== false) {
    T.slab = sketch(new RoundedBoxGeometry(w + 0.012, th, T.h + 0.012, 2, Math.min(0.004, th * 0.4)), { color: o.paper ?? 0xfcf9f1, width: 1.5 });
    T.slab.position.y = th / 2; g.add(T.slab);
  }
  const faceMat = new THREE.MeshBasicMaterial({ map: tex(c), transparent: true, depthWrite: false, toneMapped: false, opacity: 0 });
  T.face = new THREE.Mesh(new THREE.PlaneGeometry(w, T.h), faceMat);
  T.face.rotation.x = -Math.PI / 2; T.face.position.y = (o.slab !== false ? th : 0) + 0.0012; T.face.renderOrder = 5; g.add(T.face);
  if (o.halo !== false) {
    T.haloMat = new THREE.MeshBasicMaterial({ map: glowTexture(), color: T.color, transparent: true, opacity: 0, depthWrite: false, toneMapped: false });
    T.halo = new THREE.Mesh(new THREE.PlaneGeometry(w * 1.12 + 0.1, T.h * 1.9 + 0.07), T.haloMat);
    T.halo.rotation.x = -Math.PI / 2; T.halo.position.y = -0.0004; T.halo.renderOrder = 1; T.halo.raycast = () => {}; g.add(T.halo);
  }
  T.restyle = (n = {}) => {
    if (n.text !== undefined) T.text = n.text;
    if (n.color !== undefined) { T.color = n.color; T.haloMat?.color.setHex(n.color); }
    if (n.sub !== undefined) T.sub = n.sub;
    if (n.o) Object.assign(T.o, n.o);
    const old = faceMat.map; faceMat.map = tex(render()); old.dispose(); faceMat.needsUpdate = true;
  };
  T.to = (x, y, z, lam = 9) => { T.goal = V(x, y, z); T.lam = lam; };
  T.snap = (x, y, z) => { g.position.set(x, y, z); T.goal = V(x, y, z); };
  T.update = (dt) => {
    if (T.goal) {
      g.position.x = damp(g.position.x, T.goal.x, T.lam, dt); g.position.y = damp(g.position.y, T.goal.y, T.lam, dt); g.position.z = damp(g.position.z, T.goal.z, T.lam, dt);
    }
    T.glow = damp(T.glow, T.glowGoal, 8, dt);
    const p = T.p;
    if (T.slab) T.slab.userData.reveal(p);
    faceMat.opacity = clamp01((p - 0.45) * 2) * T.dim;
    if (T.haloMat) T.haloMat.opacity = T.glow * 0.8 * clamp01(p);
    g.visible = p > 0.001 && !T.hidden;
  };
  return T;
}

// ---------------------------------------------------------------------------------- pencil lines
class PolyCurve extends THREE.Curve {
  constructor(pts) { super(); this.pts = pts; }
  getPoint(t, target = new THREE.Vector3()) {
    const n = this.pts.length - 1, f = clamp01(t) * n, i = Math.min(n - 1, Math.floor(f));
    return target.lerpVectors(this.pts[i], this.pts[i + 1], f - i);
  }
}
export function circlePts(cx, cz, r, y = 0, n = 48, a0 = 0, a1 = TAU) {
  return Array.from({ length: n + 1 }, (_, i) => { const a = a0 + (a1 - a0) * (i / n); return V(cx + Math.cos(a) * r, y, cz + Math.sin(a) * r); });
}
export function rectPts(cx, cz, w, h, r = 0.02, y = 0) {
  const pts = [], hw = w / 2, hh = h / 2;
  const arc = (ox, oz, a0) => { for (let i = 0; i <= 6; i++) { const a = a0 + (Math.PI / 2) * (i / 6); pts.push(V(ox + Math.cos(a) * r, y, oz + Math.sin(a) * r)); } };
  arc(cx + hw - r, cz + hh - r, 0); arc(cx - hw + r, cz + hh - r, Math.PI / 2); arc(cx - hw + r, cz - hh + r, Math.PI); arc(cx + hw - r, cz - hh + r, Math.PI * 1.5);
  pts.push(pts[0].clone());
  return pts;
}
// An ink (or coloured) line that draws itself: obj.userData.reveal(p).
export function inkLine(pts, { r = 0.0017, color = INK, opacity = 0.9, segs } = {}) {
  const curve = new PolyCurve(pts);
  const geo = new THREE.TubeGeometry(curve, segs ?? Math.max(2, pts.length * 2), r, 5);
  const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color, transparent: true, opacity, toneMapped: false, depthWrite: false }));
  m.renderOrder = 3;
  const count = geo.index.count; let last = -1;
  m.userData.reveal = (p) => { if (p === last) return; last = p; geo.setDrawRange(0, Math.floor((count / 6) * clamp01(p)) * 6); m.visible = p > 0.001; };
  m.userData.reveal(0);
  return m;
}

// A glowing light tube between points (wraps kit.lightTube) that can be recoloured.
export function tube(pts, color, { radius = 0.0065, speed = 0.5, glass = true, smooth = true } = {}) {
  const curve = pts.length === 2 || !smooth ? new PolyCurve(pts) : new THREE.CatmullRomCurve3(pts, false, 'centripetal');
  const t = lightTube(curve, { radius, color, speed, glass });
  t.userData.curve = curve;
  t.userData.paint = (c) => t.userData.core.material.color.setHex(c);
  t.userData.fill(0);
  return t;
}

// A soft round coloured light (normal blending so it stays coloured on white paper) with a bright core.
export function orb(color, size = 0.04) {
  const g = new THREE.Group();
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color, transparent: true, opacity: 0.85, depthWrite: false, toneMapped: false }));
  s.scale.setScalar(size); s.renderOrder = 6; g.add(s);
  const core = new THREE.Mesh(new THREE.SphereGeometry(size * 0.16, 14, 10), new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false }));
  core.renderOrder = 7; g.add(core);
  g.userData = { s, core, paint: (c) => s.material.color.setHex(c) };
  return g;
}

// An open glass cylinder standing on the page (ink rims + faint glass) with a liquid inside.
export function glassCylinder(r, h, liquidColor, { liquid = true } = {}) {
  const g = new THREE.Group();
  const glass = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 28, 1, true), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.1, transparent: true, opacity: 0.2, depthWrite: false, side: THREE.DoubleSide }));
  glass.position.y = h / 2; glass.renderOrder = 4; g.add(glass);
  const lines = [inkLine(circlePts(0, 0, r, 0, 36), { r: 0.0016 }), inkLine(circlePts(0, 0, r, h, 36), { r: 0.0016 }),
    inkLine([V(r, 0, 0), V(r, h, 0)], { r: 0.0016 }), inkLine([V(-r, 0, 0), V(-r, h, 0)], { r: 0.0016 })];
  lines.forEach((l) => g.add(l));
  let liq = null;
  if (liquid) {
    const geo = new THREE.CylinderGeometry(r * 0.86, r * 0.86, h, 24); geo.translate(0, h / 2, 0);
    liq = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: liquidColor, transparent: true, opacity: 0.88, toneMapped: false }));
    liq.scale.y = 0.001; liq.renderOrder = 3; g.add(liq);
  }
  g.userData = { glass, liq, h, reveal: (p) => { lines.forEach((l) => l.userData.reveal(p)); glass.material.opacity = 0.2 * clamp01(p * 2 - 0.5); glass.visible = p > 0.05; } };
  g.userData.reveal(0);
  return g;
}

// A flat paper wash with a pencil outline, laid under text so it stays legible over the printed page.
export function panel(w, h, { r = 0.025, opacity = 0.78, color = 0xfbf8f0, outline = true } = {}) {
  // The play pieces are opaque paper cards with their own text, so the wash behind them only needs to hint at the play area:
  // keep the printed illustration visible instead of covering it.
  opacity *= 0.42;
  const g = new THREE.Group();
  const c = document.createElement('canvas'); c.width = 256; c.height = Math.max(8, Math.round(256 * h / w));
  const x = c.getContext('2d'); x.fillStyle = '#' + color.toString(16).padStart(6, '0');
  x.beginPath(); x.roundRect(2, 2, c.width - 4, c.height - 4, Math.max(2, (r / w) * 256)); x.fill();
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex(c), transparent: true, opacity: 0, depthWrite: false, toneMapped: false }));
  m.rotation.x = -Math.PI / 2; m.position.y = 0.0014; m.renderOrder = 0; m.raycast = () => {}; g.add(m);
  const line = outline ? inkLine(rectPts(0, 0, w, h, r, 0.0016), { r: 0.0009, opacity: 0.3 }) : null;
  if (line) g.add(line);
  g.userData.reveal = (p) => { m.material.opacity = opacity * clamp01(p * 1.6 - 0.4); line?.userData.reveal(clamp01(p * 1.4)); };
  g.userData.reveal(0);
  return g;
}

export function kill(obj) {
  if (!obj) return;
  obj.visible = false;
  obj.parent?.remove(obj);
  obj.traverse((o) => { o.geometry?.dispose?.(); if (o.material) { const m = o.material; m.map?.dispose?.(); m.dispose?.(); } });
}

// ---------------------------------------------------------------------------------- runtime
const TIERS = ['ما زال المفهوم غير مستقرّ؛ ارجع إلى نصّ الصفحة ثم أعد المحاولة.', 'أداؤك متوسّط، وفي إعادة اللعبة فرصة لتثبيت الفكرة.', 'أداء جيّد؛ بقيت تفاصيل صغيرة تستحقّ المراجعة.', 'أداء متقن يدلّ على فهم لا على حفظ.'];
const TIER_TAG = ['بحاجة إلى مراجعة', 'قيد الإتقان', 'أداء جيّد', 'أداء متقن'];

export function createGame(spec, ctx) {
  const G = { spec, ctx, now: 0, dt: 0, gen: 0, items: [], reveals: [], timers: [], anims: [], parts: [], ups: [], idles: [], particles: [] };
  const c = spec.center || [0.5, 0.55];
  G.origin = V(clamp(c[0], 0.42, 0.58) - 0.5, 0, (clamp(c[1], 0.44, 0.56) - 0.5) * PAGE_H);
  G.root = new THREE.Group(); G.root.position.copy(G.origin); ctx.stage.add(G.root);
  G.add = (o) => { G.root.add(o); return o; };
  // objects with userData.reveal(p) draw themselves from `delay`
  G.draw = (o, delay = 0, dur = 0.9) => { G.root.add(o); G.reveals.push({ o, delay, dur }); return o; };
  G.lt = (t) => { G.root.add(t); G.parts.push(t); return t; };
  G.token = (T, delay = null) => { G.root.add(T.g); G.items.push(T); T.t0 = delay === null ? G.now : delay; return T; };
  G.tok = (text, w, color, o = {}, x = 0, z = 0, y = 0, delay = null) => { const T = token(text, w, color, o); T.snap(x, y, z); G.token(T, delay); return T; };
  G.drop = (T) => { if (!T) return; T.dead = true; G.items = G.items.filter((x) => x !== T); kill(T.g); };
  G.tap = (T, fn, label) => { const obj = T.g || T; obj.userData.tapLabel = label || T.text || ''; ctx.tap(obj, () => { if (!T.dead && !T.off) fn(); }); };
  G.after = (s, fn) => { const gen = G.gen; G.timers.push({ at: G.now + s, fn: () => { if (gen === G.gen) fn(); } }); };
  G.anim = (dur, fn, done) => { const gen = G.gen; G.anims.push({ t0: G.now, dur, fn, done, gen }); };
  G.sfx = (n) => { try { ctx.sfx?.[n]?.(); } catch { /* sound is optional */ } };
  G.hud = (s) => ctx.ui.hud(s);
  // touching a piece before the start simply starts the game; nobody should be told to press a button first
  G.toast = (s) => { if (s.startsWith('اضغط «ابدأ') && G.startNow) { const go = G.startNow; G.startNow = null; go(); return; } ctx.ui.toast(s); };
  // No start button: a game begins by itself the moment its introduction ends (and again a second after a replay is offered).
  G.isReady = false;
  G.buttons = (list) => {
    const first = list.find((b) => b.primary && b.label.startsWith('ابدأ'));
    if (!first) { G.startNow = null; ctx.ui.choices(list); return; }
    const go = () => { if (G.startNow !== go) return; G.startNow = null; ctx.ui.choices([]); first.onPick(); };
    G.startNow = go; ctx.ui.choices([]);
    if (G.isReady) G.after(1.0, go);
  };
  let cardId = 0;
  G.card = (o, hideAfter = 0) => { ctx.ui.card(o); const id = ++cardId; if (hideAfter) G.after(hideAfter, () => { if (id === cardId) ctx.ui.hideCard(); }); };
  G.hideCard = () => { cardId++; ctx.ui.hideCard(); };
  G.idle = (fn) => G.idles.push(fn);
  G.shake = (T, amp = 0.012, dur = 0.45) => { const x0 = T.goal ? T.goal.x : T.g.position.x; G.anim(dur, (p) => { T.g.position.x = x0 + Math.sin(p * 38) * amp * (1 - p); }, () => { T.g.position.x = x0; }); };
  G.sparks = (pos, color, n = 14, speed = 0.22, size = 0.03) => {
    for (let i = 0; i < n; i++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color, transparent: true, opacity: 0.9, depthWrite: false, toneMapped: false }));
      s.scale.setScalar(size * (0.6 + Math.random() * 0.8)); s.renderOrder = 6; s.position.copy(pos); G.root.add(s);
      const a = Math.random() * TAU, v = speed * (0.4 + Math.random());
      G.particles.push({ s, v: V(Math.cos(a) * v, 0.1 + Math.random() * 0.18, Math.sin(a) * v), life: 0, max: 0.7 + Math.random() * 0.5 });
    }
  };
  // flight of any object along an arc
  G.fly = (obj, to, dur = 0.5, arc = 0.08, done) => {
    const from = obj.position.clone();
    G.anim(dur, (p) => { const k = ease(p); obj.position.lerpVectors(from, to, k); obj.position.y += Math.sin(p * Math.PI) * arc; }, () => { obj.position.copy(to); done?.(); });
  };
  G.end = ({ pct, title, body = '', color = COL.gold, again, lines }) => {
    const tier = pct >= 0.85 ? 3 : pct >= 0.6 ? 2 : pct >= 0.35 ? 1 : 0;
    G.final = { pct, tier };
    G.card({ tag: TIER_TAG[tier], title, body: `${body} ${(lines || TIERS)[tier]}`.trim(), color });
    if (pct >= 0.5) { ctx.ui.done(); G.sfx('good'); } else G.sfx('bad');
    G.buttons([{ label: '↻ العب من جديد', primary: true, onPick: () => { G.gen++; G.hideCard(); again(); } }]);
  };
  G.update = (t, dt, e) => {
    G.now = t; G.dt = dt;
    G.root.scale.setScalar(Math.max(e, 0.001));
    G.reveals.forEach((r) => r.o.userData.reveal(stag(t, r.delay, r.dur)));
    G.items.forEach((T) => { T.p = stag(t, T.t0, 0.7); T.update(dt); });
    G.parts.forEach((p) => p.userData?.update?.(dt));
    for (let i = G.timers.length - 1; i >= 0; i--) if (t >= G.timers[i].at) { const f = G.timers[i].fn; G.timers.splice(i, 1); f(); }
    for (let i = G.anims.length - 1; i >= 0; i--) {
      const a = G.anims[i];
      if (a.gen !== G.gen && a.dur > 0.001) { G.anims.splice(i, 1); continue; }
      const p = clamp01((t - a.t0) / a.dur); a.fn(p);
      if (p >= 1) { G.anims.splice(i, 1); a.done?.(); }
    }
    for (let i = G.particles.length - 1; i >= 0; i--) {
      const q = G.particles[i]; q.life += dt; q.v.y -= 0.35 * dt; q.s.position.addScaledVector(q.v, dt);
      q.s.material.opacity = 0.9 * (1 - q.life / q.max);
      if (q.life >= q.max) { G.root.remove(q.s); q.s.material.dispose(); G.particles.splice(i, 1); }
    }
    G.ups.forEach((f) => f(t, dt));
  };
  return G;
}

// A small row of progress pips (ink ring + light when filled).
export function pips(n, color, { gap = 0.045, r = 0.013 } = {}) {
  const g = new THREE.Group(); const list = [];
  for (let i = 0; i < n; i++) {
    const p = new THREE.Group(); p.position.x = -i * gap;
    p.add(inkLine(circlePts(0, 0, r, 0.004, 24), { r: 0.0016 }));
    const o = orb(color, r * 3.2); o.position.y = 0.006; o.visible = false; p.add(o);
    list.push({ p, o, ring: p.children[0] });
    g.add(p);
  }
  g.userData.list = list;
  g.userData.set = (k, c) => list.forEach((x, i) => { x.o.visible = i < k; if (c !== undefined && i < k) x.o.userData.paint(c); });
  g.userData.reveal = (pp) => list.forEach((x, i) => x.ring.userData.reveal(clamp01(pp * 1.5 - i * 0.1)));
  g.userData.reveal(0);
  return g;
}
