// Shared builders for the "a2" batch of hand-built page scenes (meshes, rise-in sequencing, pulses, touch helpers).
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { P, ease, easeBack, clamp01, stag, glow } from '../../kit.js?v=23';
import { softLight, tagSprite, css } from '../../v2/common.js?v=23';

export const INK = 0x2b2620, PAPER = 0xf7f2e7, GOLD = 0xd4ad55, TAU = Math.PI * 2;
export const rb = (w, h, d, r = 0.008, s = 3) => new RoundedBoxGeometry(w, h, d, s, Math.min(r, w / 2 - 1e-4, h / 2 - 1e-4, d / 2 - 1e-4));
export const lathe = (pts, seg = 44) => new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), seg);
export const std = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.5, metalness: 0.04, ...o });
export const lit = (color, i = 1.1, o = {}) => new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: i, roughness: 0.45, ...o });
export const gloss = (color, o = {}) => new THREE.MeshPhysicalMaterial({ color, roughness: 0.28, clearcoat: 1, clearcoatRoughness: 0.12, ...o });
export const glass = (color = 0xbfe6ff, op = 0.3, o = {}) => new THREE.MeshPhysicalMaterial({ color, roughness: 0.06, transparent: true, opacity: op, depthWrite: false, clearcoat: 1, side: THREE.DoubleSide, ...o });
export const brass = () => new THREE.MeshStandardMaterial({ color: 0xe0b85e, roughness: 0.3, metalness: 0.85 });

export function add(parent, geo, material, x = 0, y = 0, z = 0, shadow = false) {
  const m = new THREE.Mesh(geo, material); m.position.set(x, y, z); parent.add(m);
  if (shadow) { m.castShadow = true; m.receiveShadow = true; }
  return m;
}
export const grp = (parent, x = 0, y = 0, z = 0) => { const g = new THREE.Group(); g.position.set(x, y, z); parent?.add(g); return g; };

// An invisible fat target so small things are easy to tap with a thumb.
export function hit(parent, r, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(r, 8, 6), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }));
  m.position.set(x, y, z); parent.add(m); return m;
}

// Things rise and scale into place one after another.
export class Seq {
  constructor() { this.a = []; }
  add(o, delay, dur = 0.8, { rise = 0.04, fn = easeBack } = {}) {
    this.a.push({ o, delay, dur, sx: o.scale.x, sy: o.scale.y, sz: o.scale.z, y: o.position.y, rise, fn });
    o.scale.setScalar(1e-4); o.visible = false; return o;
  }
  update(t, e) {
    for (let i = 0; i < this.a.length; i++) {
      const q = this.a[i], k = stag(t, q.delay, q.dur, q.fn) * e;
      q.o.scale.set(Math.max(q.sx * k, 1e-4), Math.max(q.sy * k, 1e-4), Math.max(q.sz * k, 1e-4)); q.o.position.y = q.y - q.rise * (1 - Math.min(1, k)); q.o.visible = k > 0.003;
    }
  }
}

// Gentle breathing glow that tells the eye "touch me".
export class Pulse {
  constructor() { this.a = []; }
  add(parent, color, size, x = 0, y = 0, z = 0, { amp = 0.16, speed = 2.1, op = 0.55, additive = false } = {}) {
    const s = additive ? glow(color, size, op) : softLight(color, size, op);
    s.position.set(x, y, z); parent.add(s);
    this.a.push({ s, size, amp, speed, op, ph: this.a.length * 1.7, boost: 0 });
    return s;
  }
  update(t, e) {
    for (let i = 0; i < this.a.length; i++) {
      const q = this.a[i], w = 0.5 + 0.5 * Math.sin(t * q.speed + q.ph);
      q.s.scale.setScalar(q.size * (1 + q.amp * w) * Math.max(e, 1e-3)); q.s.material.opacity = q.op * e * (0.55 + 0.45 * w);
    }
  }
}

const _v = new THREE.Vector3();
export function at(ctx, obj, dy = 0) { obj.getWorldPosition(_v); ctx.stage.worldToLocal(_v); _v.y += dy; return _v; }
export function touch(ctx, obj, fn, color = GOLD) {
  ctx.tap(obj, () => { ctx.sfx.pop?.(); ctx.fx.burst(at(ctx, obj, 0.02), color, 16, 0.38, 0.03); fn(); });
}

// A dark-ink label with white text (short!). Always faces the camera.
export function chip(text, w0, color = INK, o = {}) {
  const k = o.k || 1, w = (0.05 + 0.0195 * [...text].length) * k;
  const { k: _k, ppu: _p, dark, ...rest } = o;
  return tagSprite(text, w, color, { bg: dark ? 'rgba(36,31,26,.92)' : 'rgba(255,251,242,.96)', color: dark ? '#fff6e3' : '#2b2620', border: css(color), size: Math.round(46 * k), pad: 16, radius: 26, ppu: 1400, ...rest });
}

// A soft contact shadow lying on the page (no plinth: objects sit lightly on the print).
let _sh;
export function blob(parent, w, d, op = 0.3, x = 0, z = 0) {
  if (!_sh) { const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d'); const gr = g.createRadialGradient(64, 64, 6, 64, 64, 64); gr.addColorStop(0, 'rgba(40,28,12,.9)'); gr.addColorStop(0.55, 'rgba(40,28,12,.35)'); gr.addColorStop(1, 'rgba(40,28,12,0)'); g.fillStyle = gr; g.fillRect(0, 0, 128, 128); _sh = new THREE.CanvasTexture(c); }
  const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: _sh, transparent: true, opacity: op, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
  m.rotation.x = -Math.PI / 2; m.position.set(x, 0.0015, z); m.scale.set(w, d, 1); m.renderOrder = 1; parent.add(m); return m;
}

let _wood;
export function woodTex(base = '#c58f55', dark = '#a9733e') {
  const c = document.createElement('canvas'); c.width = 512; c.height = 256; const g = c.getContext('2d');
  g.fillStyle = base; g.fillRect(0, 0, 512, 256);
  for (let i = 0; i < 46; i++) { g.strokeStyle = i % 3 ? 'rgba(120,70,30,.10)' : dark + '55'; g.lineWidth = 1 + (i % 4); g.beginPath(); const y = (i * 37) % 256; g.moveTo(0, y); g.bezierCurveTo(150, y + 8, 330, y - 10, 512, y + 4); g.stroke(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}
// A tabletop with short legs: the stage for scenes that belong on a desk.
export function desk(parent, w, d, { top = 0.09, th = 0.036, wood = true, color = 0xffffff } = {}) {
  const g = grp(parent, 0, 0, 0);
  const m = add(g, rb(w, th, d, 0.012, 3), new THREE.MeshStandardMaterial({ color, map: wood ? woodTex() : null, roughness: 0.55 }), 0, top - th / 2, 0, true);
  add(g, rb(w + 0.01, 0.006, d + 0.01, 0.004, 2), brass(), 0, top - th + 0.002, 0);
  [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([a, b]) => add(g, new THREE.CylinderGeometry(0.014, 0.01, top - th, 12), std(0x6b4f3f), a * (w / 2 - 0.05), (top - th) / 2, b * (d / 2 - 0.05), true));
  blob(parent, w * 1.25, d * 1.4, 0.32);
  return g;
}
// An organic, blob-shaped slab (like the coloured shapes behind the printed pictures).
export function organic(parent, w, d, { color = 0xbfe3ec, h = 0.014, seed = 1, y = 0 } = {}) {
  const pts = []; const N = 40;
  for (let i = 0; i < N; i++) { const a = (i / N) * TAU, r = 1 + 0.07 * Math.sin(3 * a + seed) + 0.04 * Math.sin(5 * a + seed * 2) + 0.03 * Math.sin(2 * a + seed * 3); pts.push(new THREE.Vector2(Math.cos(a) * w / 2 * r, Math.sin(a) * d / 2 * r)); }
  const shape = new THREE.Shape(new THREE.Path().setFromPoints(pts).getPoints ? new THREE.SplineCurve([...pts, pts[0]]).getPoints(120) : pts);
  const geo = new THREE.ExtrudeGeometry(shape, { depth: h, bevelEnabled: true, bevelSize: 0.006, bevelThickness: 0.004, bevelSegments: 2, curveSegments: 4 });
  geo.rotateX(-Math.PI / 2);
  const m = new THREE.Mesh(geo, std(color, { roughness: 0.5 })); m.position.y = y; m.castShadow = m.receiveShadow = true; parent.add(m);
  blob(parent, w * 1.15, d * 1.25, 0.25);
  return m;
}

// A round ivory plinth with a gold rim: the stage that every a2 scene stands on.
export function plinth(parent, r, { y = 0, h = 0.012, color = PAPER, rim = GOLD } = {}) {
  const g = grp(parent, 0, y, 0);
  add(g, lathe([[0, 0], [r * 0.985, 0], [r, h * 0.45], [r * 0.985, h], [0, h]], 72), std(color, { roughness: 0.55 }), 0, 0, 0, true);
  const t = add(g, new THREE.TorusGeometry(r, h * 0.38, 8, 96), brass(), 0, h * 0.5, 0); t.rotation.x = Math.PI / 2;
  return g;
}

// A rounded plaque base (rectangular)
export function slab(parent, w, d, { y = 0, h = 0.012, color = PAPER, r = 0.01 } = {}) {
  const g = grp(parent, 0, y, 0);
  add(g, rb(w, h, d, r, 2), std(color, { roughness: 0.55 }), 0, h / 2, 0, true);
  return g;
}

export const rnd = (seed) => { let s = seed >>> 0 || 1; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); };
export const shuffled = (arr, seed) => { const r = rnd(seed), a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

export { THREE, P, ease, easeBack, clamp01, stag, glow, softLight, css };
