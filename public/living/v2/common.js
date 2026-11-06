// Shared building blocks for the spec-driven engine: pencil ink paths, coloured lights that stay
// coloured on white paper, page-written Arabic text, palettes and timing constants.
import * as THREE from 'three';
import { LineSegments2 } from 'three/addons/lines/LineSegments2.js';
import { LineSegmentsGeometry } from 'three/addons/lines/LineSegmentsGeometry.js';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';
import { P, PAGE_H, PAPER, INK, ease, easeBack, stag, clamp01, label, sprite, glow, lightTube } from '../kit.js?v=9';
import { printFrame } from '../pencil.js?v=9';

export { P, PAGE_H, PAPER, INK, ease, easeBack, stag, clamp01, label, sprite, glow, lightTube, printFrame };

export const TAU = Math.PI * 2;
export const INTRO_T = 6.2;   // the intro is finished (and the interactive layer is awake) at this time
export const T0 = 4.4;        // the template starts drawing itself here, overlapping the intro's end
export const toAr = (n) => String(n).replace(/\d/g, (d) => '٠١٢٣٤٥٦٧٨٩'[d]);
export const css = (c) => '#' + c.toString(16).padStart(6, '0');
export const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
export const lerp = (a, b, k) => a + (b - a) * k;
export const smooth = (x) => { x = clamp01(x); return x * x * (3 - 2 * x); };
export function hash(str) { let h = 2166136261; for (const ch of String(str)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return Math.abs(h); }

// Every template draws its colours from a different palette (picked by spec id + template).
export const PALETTES = [
  [0x1f9aa6, 0xe8604c, 0xe3b23c, 0x5a6fd6, 0x7bbf6a],
  [0xd9482b, 0xf0a030, 0x7a4fb0, 0x2a8fd0, 0x3fae4f],
  [0xb5489a, 0x3b6fd0, 0xe89a2c, 0x2fa38a, 0xd95a5a],
  [0x5f9a2e, 0xc9772a, 0x2c7fb8, 0xb04a6a, 0xd4ad55],
  [0x3b4fc4, 0xe0602f, 0x1fa58a, 0xc7388d, 0xe0b030],
  [0x0f8a8a, 0xd8704a, 0x8a5bb5, 0xc9a02f, 0x4a8fd0],
];
export function paletteFor(spec, salt = 0) {
  const i = (hash(spec.id || spec.page || 'x') + salt * 2) % PALETTES.length;
  const p = PALETTES[i];
  const r = (hash(spec.id || 'x') >> 3) % p.length;       // rotate so neighbouring pages differ too
  return p.slice(r).concat(p.slice(0, r));
}

// ------------------------------------------------------------------ lights
let softTex;
export function softTexture() {
  if (softTex) return softTex;
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grd.addColorStop(0, 'rgba(255,255,255,1)'); grd.addColorStop(0.2, 'rgba(255,255,255,.85)'); grd.addColorStop(0.5, 'rgba(255,255,255,.3)'); grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd; g.fillRect(0, 0, 128, 128);
  softTex = new THREE.CanvasTexture(c);
  return softTex;
}
// A coloured light that stays coloured on white paper (normal blending, not additive).
export function softLight(color, size = 0.05, opacity = 0.85) {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: softTexture(), color, transparent: true, opacity, depthWrite: false }));
  s.scale.setScalar(size); s.renderOrder = 4;
  return s;
}
// A pool of coloured light lying on the page.
export function lightPool(color, r = 0.1, opacity = 0.4) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({
    map: softTexture(), color, transparent: true, opacity, depthWrite: false, toneMapped: false, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1,
  }));
  m.rotation.x = -Math.PI / 2; m.scale.setScalar(r * 2); m.renderOrder = 1;
  return m;
}
const frameCache = new Map();
function squareFrameTex(color) {
  if (frameCache.has(color)) return frameCache.get(color);
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const g = c.getContext('2d');
  g.shadowColor = color; g.shadowBlur = 16; g.strokeStyle = color; g.lineWidth = 9;
  g.beginPath(); g.roundRect(22, 22, 212, 212, 46);
  g.fillStyle = color + '2e'; g.fill(); g.stroke();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  frameCache.set(color, t); return t;
}
// printFrame lit on a round/square printed element (square texture, uniform stroke).
export function spotFrame(u, v, w, color) {
  const f = printFrame(u, v, w, w / PAGE_H, color);
  f.material.map = squareFrameTex(color);
  return f;
}

// ------------------------------------------------------------------ pencil ink
const _sz = new THREE.Vector2();
// A hand-drawn polyline: densified, wobbled, drawn on with reveal(p). Lies where the points lie.
export function inkPath(pts, o = {}) {
  const { color = INK, width = 1.5, jitter = 0.0014, seed = 1, opacity = 0.92, closed = false, step = 0.011, pen = false, halo = color === INK } = o;
  const src = closed ? [...pts, pts[0]] : pts;
  const dense = [];
  for (let i = 0; i < src.length - 1; i++) {
    const a = src[i], b = src[i + 1], n = Math.max(1, Math.ceil(a.distanceTo(b) / step));
    for (let k = 0; k < n; k++) dense.push(a.clone().lerp(b, k / n));
  }
  dense.push(src[src.length - 1].clone());
  const pj = dense.map((p, i) => {
    const s = i * step;
    const a = Math.sin(s * 95 + seed * 3.1) * 0.6 + Math.sin(s * 41 + seed * 1.7) * 0.4;
    const b = Math.cos(s * 77 + seed * 2.3) * 0.6 + Math.sin(s * 33 + seed) * 0.4;
    return new THREE.Vector3(p.x + a * jitter, p.y, p.z + b * jitter);
  });
  const arr = [];
  for (let i = 0; i < pj.length - 1; i++) arr.push(pj[i].x, pj[i].y, pj[i].z, pj[i + 1].x, pj[i + 1].y, pj[i + 1].z);
  const geo = new LineSegmentsGeometry(); geo.setPositions(arr);
  const mat = new LineMaterial({ color, linewidth: width, transparent: true, opacity, depthWrite: false });
  const line = new LineSegments2(geo, mat); line.renderOrder = 3; line.frustumCulled = false;
  const prev = line.onBeforeRender;
  line.onBeforeRender = function (r, ...rest) { r.getSize(_sz); mat.resolution.set(_sz.x || 1, _sz.y || 1); prev?.call(this, r, ...rest); };
  const total = pj.length - 1;
  const g = new THREE.Group();
  // a pale halo under dark pencil lines keeps them readable on dark artwork too
  if (halo) {
    const hm = new LineMaterial({ color: 0xfff8ea, linewidth: width + 3.2, transparent: true, opacity: 0.5, depthWrite: false });
    const hl = new LineSegments2(geo, hm); hl.renderOrder = 2; hl.frustumCulled = false;
    hl.onBeforeRender = function (r) { r.getSize(_sz); hm.resolution.set(_sz.x || 1, _sz.y || 1); };
    g.add(hl); g.userData.halo = hl;
  }
  g.add(line);
  let tip = null;
  if (pen) { tip = softLight(INK, 0.022, 0); tip.renderOrder = 7; g.add(tip); }
  let last = -1;
  const haloLine = g.userData.halo;
  g.userData = {
    line, mat, total, pts: pj, haloLine,
    head(p) { return pj[Math.min(pj.length - 1, Math.floor(clamp01(p) * (pj.length - 1)))]; },
    reveal(p) {
      p = clamp01(p); if (p === last) return; last = p;
      geo.instanceCount = Math.floor(total * p);
      line.visible = p > 0.002; if (haloLine) haloLine.visible = line.visible;
      if (tip) { tip.position.copy(g.userData.head(p)); tip.material.opacity = p > 0.002 && p < 0.995 ? 0.7 : 0; }
    },
  };
  g.userData.reveal(0);
  return g;
}
// Separate short strokes (ticks, brackets, grids): pts is a list of [a, b] pairs.
export function inkTicks(pairs, o = {}) {
  const { color = INK, width = 1.3, opacity = 0.85 } = o;
  const arr = []; pairs.forEach(([a, b]) => arr.push(a.x, a.y, a.z, b.x, b.y, b.z));
  const geo = new LineSegmentsGeometry(); geo.setPositions(arr);
  const mat = new LineMaterial({ color, linewidth: width, transparent: true, opacity, depthWrite: false });
  const line = new LineSegments2(geo, mat); line.renderOrder = 3; line.frustumCulled = false;
  const prev = line.onBeforeRender;
  line.onBeforeRender = function (r, ...rest) { r.getSize(_sz); mat.resolution.set(_sz.x || 1, _sz.y || 1); prev?.call(this, r, ...rest); };
  const g = new THREE.Group(); g.add(line);
  g.userData = { line, mat, reveal(p) { geo.instanceCount = Math.floor(pairs.length * clamp01(p)); line.visible = p > 0.002; } };
  g.userData.reveal(0);
  return g;
}

// ------------------------------------------------------------------ geometry helpers (page plane)
export function circlePts(c, r, n = 56, a0 = 0, sweep = TAU) {
  return Array.from({ length: n + 1 }, (_, i) => { const a = a0 + (sweep * i) / n; return V(c.x + Math.cos(a) * r, c.y, c.z + Math.sin(a) * r); });
}
export function rectPts(c, w, d, rad = 0.008) {
  const hw = w / 2, hd = d / 2, r = Math.min(rad, hw, hd), pts = [];
  const corner = (cx, cz, a0) => { for (let i = 0; i <= 5; i++) { const a = a0 + (Math.PI / 2) * (i / 5); pts.push(V(c.x + cx + Math.cos(a) * r, c.y, c.z + cz + Math.sin(a) * r)); } };
  corner(hw - r, hd - r, 0); corner(-hw + r, hd - r, Math.PI / 2); corner(-hw + r, -hd + r, Math.PI); corner(hw - r, -hd + r, Math.PI * 1.5);
  pts.push(pts[0].clone());
  return pts;
}
export function bracketPairs(c, w, d, len = 0.02) {
  const hw = w / 2, hd = d / 2, out = [];
  [[1, 1], [-1, 1], [-1, -1], [1, -1]].forEach(([sx, sz]) => {
    const p = V(c.x + sx * hw, c.y, c.z + sz * hd);
    out.push([p, V(p.x - sx * len, p.y, p.z)], [p, V(p.x, p.y, p.z - sz * len)]);
  });
  return out;
}
export function arcCurve(a, b, lift = 0.04) {
  const m = a.clone().add(b).multiplyScalar(0.5); m.y += lift;
  return new THREE.QuadraticBezierCurve3(a, m, b);
}
export const sampleCurve = (curve, n = 40) => curve.getPoints(n);

// ------------------------------------------------------------------ text
export function setAlpha(obj, a) {
  obj.traverse((o) => {
    const ms = o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : [];
    ms.forEach((m) => { if (m.userData.o0 === undefined) m.userData.o0 = m.opacity; m.opacity = m.userData.o0 * a; m.transparent = true; });
  });
  obj.visible = a > 0.003;
}
export const setSpr = (s, w, k) => s.scale.set(Math.max(w * k, 0.0001), Math.max(w * s.userData.aspect * k, 0.0001), 1);
// Labels share one text size in the world: the canvas width follows the world width (ppu = px per unit).
export function tagSprite(text, w, color, o = {}) {
  const { ppu = 1900, ...rest } = o;
  const s = sprite(text, w, { size: 42, weight: 800, border: css(color), bg: 'rgba(251,248,240,.97)', radius: 26, pad: 22, ...rest, width: Math.round(w * ppu) });
  s.userData.w = w; return s;
}
export function solidTag(text, w, color, o = {}) {
  return tagSprite(text, w, color, { bg: css(color), color: '#ffffff', border: null, ...o });
}

// Arabic written on the page itself (upright with the page). reveal(p) writes it right to left.
export function pageText(text, { h = 0.034, color = '#2b2620', weight = 800, title = false, bg = null, pad = 16 } = {}) {
  const size = 64;
  const font = `${weight} ${size}px ${title ? '"Reem Kufi", Tajawal, sans-serif' : 'Tajawal, sans-serif'}`;
  const c = document.createElement('canvas'); const g0 = c.getContext('2d'); g0.font = font;
  const tw = Math.ceil(g0.measureText(text).width);
  const W = tw + pad * 2 + (bg ? 26 : 0), H = Math.ceil(size * 1.5);
  c.width = W; c.height = H;
  const g = c.getContext('2d');
  if (bg) { g.fillStyle = bg; g.beginPath(); g.roundRect(3, 8, W - 6, H - 16, 28); g.fill(); }
  g.font = font; g.direction = 'rtl'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = color;
  g.fillText(text, W / 2, H / 2 + 3);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  const w = (h * W) / H;
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, toneMapped: false, side: THREE.DoubleSide }));
  mesh.rotation.x = -Math.PI / 2; mesh.renderOrder = 5;
  const grp = new THREE.Group(); grp.add(mesh);
  grp.userData = {
    w, h, mesh,
    reveal(p) {
      p = Math.max(clamp01(p), 0.001);
      tex.repeat.x = p; tex.offset.x = 1 - p;
      mesh.scale.x = p; mesh.position.x = ((1 - p) * w) / 2;
      grp.visible = p > 0.004;
    },
    // x position of the writing edge (for a pen glow), in the group's local space
    edge(p) { return w / 2 - clamp01(p) * w; },
  };
  grp.userData.reveal(0);
  return grp;
}

// Arrange page-written words right to left on one line (or two when long), centred on (0, 0).
export function layoutWords(words, opts = {}) {
  const h = opts.h || 0.034, gap = opts.gap || 0.03, maxW = opts.maxW || 0.62;
  const items = words.map((w) => pageText(w, { h, title: true, bg: 'rgba(250,247,240,.9)', ...opts }));
  const lines = [[]]; let cur = 0;
  items.forEach((it) => { const w = it.userData.w; if (cur + w > maxW && lines[lines.length - 1].length) { lines.push([]); cur = 0; } lines[lines.length - 1].push(it); cur += w + gap; });
  lines.forEach((ln, li) => {
    const total = ln.reduce((s, it) => s + it.userData.w, 0) + gap * (ln.length - 1);
    let x = total / 2;
    ln.forEach((it) => { x -= it.userData.w / 2; it.position.set(x, 0.006, li * (h + 0.012)); x -= it.userData.w / 2 + gap; });
  });
  return items;
}

// A coloured ring on the printed page with a pool of light: the basic "lit spot".
export function ringMark(color, r = 0.036, { seed = 1 } = {}) {
  const g = new THREE.Group();
  const ring = inkPath(circlePts(V(0, 0.006, 0), r, 40), { color, width: 2.8, jitter: 0.0008, seed, step: 0.008, opacity: 0.95 });
  const ink = inkPath(circlePts(V(0, 0.0055, 0), r * 1.07, 40, 0.6), { color: INK, width: 1.1, jitter: 0.0016, seed: seed + 4, opacity: 0.7, step: 0.01 });
  const pool = lightPool(color, r * 4.4, 0); pool.position.y = 0.002;
  const core = softLight(color, r * 3.1, 0); core.position.y = 0.012;
  g.add(pool, ring, ink, core);
  g.userData = {
    ring, ink, pool, core,
    reveal(p) { ring.userData.reveal(p); ink.userData.reveal(clamp01(p * 1.1 - 0.05)); },
    level(a) { pool.material.opacity = 0.62 * a; core.material.opacity = 0.62 * a; },
  };
  return g;
}

// A bright travelling light (a packet of meaning).
export function packet(color, size = 0.05) {
  const g = new THREE.Group();
  const a = softLight(color, size, 0.95), b = softLight(0xffffff, size * 0.42, 1); b.renderOrder = 5;
  g.add(a, b); g.userData = { a, b };
  return g;
}
