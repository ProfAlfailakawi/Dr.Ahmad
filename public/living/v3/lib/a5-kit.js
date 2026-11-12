// Shared helpers for the a5 batch of hand-built pages (icons, touch halos, build-in rig, plinths).
import * as THREE from 'three';
import { ease, easeBack, clamp01, stag, glow, textCanvas, mat, glossy, goldMat, shadowed } from '../../kit.js?v=28';
import { inked } from '../../pencil.js?v=28';

export const css = (c) => '#' + c.toString(16).padStart(6, '0');
export const TAU = Math.PI * 2;
export const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);

// ---------------------------------------------------------------- icons drawn in code
export function iconCanvas(kind, { color = '#fff', bg = null, size = 128, lw = 9 } = {}) {
  const c = document.createElement('canvas'); c.width = c.height = size;
  const g = c.getContext('2d'); const s = size / 128; g.scale(s, s);
  if (bg) { g.fillStyle = bg; g.beginPath(); g.arc(64, 64, 62, 0, TAU); g.fill(); }
  g.strokeStyle = color; g.fillStyle = color; g.lineWidth = lw; g.lineCap = 'round'; g.lineJoin = 'round';
  const poly = (pts, close) => { g.beginPath(); pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); if (close) g.closePath(); g.stroke(); };
  switch (kind) {
    case 'clock': g.beginPath(); g.arc(64, 64, 34, 0, TAU); g.stroke(); poly([[64, 44], [64, 64], [80, 74]]); break;
    case 'loop': g.beginPath(); g.arc(64, 64, 32, -0.5, 4.5); g.stroke(); poly([[84, 30], [98, 46], [78, 52]]); break;
    case 'pencil': poly([[38, 90], [86, 42]]); poly([[82, 38], [92, 28], [100, 36], [90, 46]]); poly([[34, 94], [40, 80], [48, 88]], true); break;
    case 'spark': g.beginPath(); g.moveTo(64, 26); g.quadraticCurveTo(64, 64, 102, 64); g.quadraticCurveTo(64, 64, 64, 102); g.quadraticCurveTo(64, 64, 26, 64); g.quadraticCurveTo(64, 64, 64, 26); g.fill(); break;
    case 'check': poly([[34, 66], [56, 88], [96, 42]]); break;
    case 'screen': g.beginPath(); g.roundRect(30, 34, 68, 46, 8); g.stroke(); poly([[50, 96], [78, 96]]); poly([[64, 80], [64, 96]]); break;
    case 'book': poly([[64, 40], [64, 92]]); g.beginPath(); g.moveTo(64, 40); g.quadraticCurveTo(44, 30, 28, 38); g.lineTo(28, 88); g.quadraticCurveTo(44, 80, 64, 92); g.quadraticCurveTo(84, 80, 100, 88); g.lineTo(100, 38); g.quadraticCurveTo(84, 30, 64, 40); g.stroke(); break;
    case 'globe': g.beginPath(); g.arc(64, 64, 34, 0, TAU); g.stroke(); g.beginPath(); g.ellipse(64, 64, 15, 34, 0, 0, TAU); g.stroke(); poly([[30, 64], [98, 64]]); break;
    case 'wifi': for (let i = 1; i <= 3; i++) { g.beginPath(); g.arc(64, 90, i * 20, -2.35, -0.8); g.stroke(); } g.beginPath(); g.arc(64, 90, 4, 0, TAU); g.fill(); break;
    case 'person': g.beginPath(); g.arc(64, 46, 16, 0, TAU); g.stroke(); g.beginPath(); g.arc(64, 100, 32, Math.PI * 1.15, Math.PI * 1.85); g.stroke(); break;
    case 'briefcase': g.beginPath(); g.roundRect(30, 46, 68, 46, 8); g.stroke(); g.beginPath(); g.roundRect(50, 34, 28, 14, 5); g.stroke(); poly([[30, 66], [98, 66]]); break;
    case 'coin': g.beginPath(); g.arc(64, 64, 34, 0, TAU); g.stroke(); poly([[64, 46], [64, 82]]); poly([[52, 54], [76, 54]]); poly([[52, 74], [76, 74]]); break;
    case 'lock': g.beginPath(); g.roundRect(34, 60, 60, 38, 8); g.stroke(); g.beginPath(); g.arc(64, 58, 18, Math.PI, 0); g.stroke(); break;
    case 'gear': g.beginPath(); g.arc(64, 64, 22, 0, TAU); g.stroke(); for (let i = 0; i < 8; i++) { const a = (i / 8) * TAU; poly([[64 + Math.cos(a) * 28, 64 + Math.sin(a) * 28], [64 + Math.cos(a) * 40, 64 + Math.sin(a) * 40]]); } break;
    case 'chat': g.beginPath(); g.roundRect(28, 34, 72, 50, 14); g.stroke(); poly([[50, 84], [46, 100], [66, 84]]); break;
    case 'bolt': poly([[72, 26], [44, 70], [64, 70], [54, 102], [88, 56], [66, 56]], true); break;
    case 'cap': poly([[64, 36], [100, 54], [64, 72], [28, 54]], true); poly([[44, 64], [44, 82], [64, 92], [84, 82], [84, 64]]); break;
    case 'cube': poly([[64, 28], [96, 46], [96, 82], [64, 100], [32, 82], [32, 46]], true); poly([[32, 46], [64, 64], [96, 46]]); poly([[64, 64], [64, 100]]); break;
    case 'layers': poly([[64, 34], [100, 52], [64, 70], [28, 52]], true); poly([[28, 68], [64, 86], [100, 68]]); break;
    case 'plus': poly([[64, 34], [64, 94]]); poly([[34, 64], [94, 64]]); break;
    case 'cloud': g.beginPath(); g.arc(50, 70, 18, Math.PI * 0.5, Math.PI * 1.5); g.arc(68, 52, 20, Math.PI, 0); g.arc(86, 70, 16, Math.PI * 1.5, Math.PI * 0.5); g.closePath(); g.stroke(); break;
    case 'home': poly([[28, 62], [64, 32], [100, 62]]); poly([[38, 56], [38, 96], [90, 96], [90, 56]]); break;
    case 'eye': g.beginPath(); g.moveTo(24, 64); g.quadraticCurveTo(64, 20, 104, 64); g.quadraticCurveTo(64, 108, 24, 64); g.stroke(); g.beginPath(); g.arc(64, 64, 9, 0, TAU); g.fill(); break;
    case 'x': poly([[40, 40], [88, 88]]); poly([[88, 40], [40, 88]]); break;
    case 'print': g.beginPath(); g.roundRect(32, 52, 64, 34, 8); g.stroke(); poly([[44, 52], [44, 32], [84, 32], [84, 52]]); poly([[44, 74], [44, 98], [84, 98], [84, 74]]); break;
    case 'plane': poly([[26, 70], [100, 36], [74, 98], [64, 74]], true); break;
    case 'tower': poly([[64, 24], [48, 100]]); poly([[64, 24], [80, 100]]); poly([[54, 70], [74, 70]]); poly([[50, 90], [78, 90]]); break;
    default: g.beginPath(); g.arc(64, 64, 20, 0, TAU); g.fill();
  }
  return c;
}
export function iconTexture(kind, o) { const t = new THREE.CanvasTexture(iconCanvas(kind, o)); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t; }
// Round coloured medallion that always faces the camera (no aspect => not counted as a text label).
export function badge(kind, color, size = 0.05) {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: iconTexture(kind, { bg: css(color), size: 128 }), transparent: true, depthWrite: false, toneMapped: false }));
  s.scale.setScalar(size); s.renderOrder = 7; return s;
}
// Hex prism coin whose top face carries an icon (axis = local Y).
export function hexCoin(kind, color, r = 0.04, h = 0.014) {
  const g = new THREE.Group();
  const side = glossy(color, { roughness: 0.3 });
  const top = new THREE.MeshStandardMaterial({ map: iconTexture(kind, { bg: css(color), size: 256 }), roughness: 0.35 });
  const bot = glossy(0xf4ead8);
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 6), [side, top, bot]);
  m.rotation.y = Math.PI / 6 * 0; g.add(m);
  const rim = new THREE.Mesh(new THREE.CylinderGeometry(r * 1.08, r * 1.08, h * 0.5, 6), goldMat());
  rim.position.y = -h * 0.2; g.add(rim);
  g.userData.body = m;
  return shadowed(g);
}

// ---------------------------------------------------------------- re-text a label sprite
export function retext(spr, text, w, opts) {
  const c = textCanvas(text, opts);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  spr.material.map?.dispose(); spr.material.map = t; spr.material.needsUpdate = true;
  spr.userData.aspect = c.height / c.width; spr.userData.w = w;
  spr.scale.set(w, w * spr.userData.aspect, 1);
}
export const spriteK = (s, k) => s.scale.set(Math.max((s.userData.w || 0.2) * k, 0.0001), Math.max((s.userData.w || 0.2) * s.userData.aspect * k, 0.0001), 1);

// ---------------------------------------------------------------- build-in rig + touch halos
export class Rig {
  constructor(ctx) { this.ctx = ctx; this.items = []; this.halos = []; this.t = 0; }
  // kind 'ink': pencil reveal; 'pop': scale-in (with optional rise); 'fn': custom (p)=>void
  add(obj, delay = 0, dur = 0.9, kind = 'pop', rise = 0) {
    const it = { obj, delay, dur, kind, rise, s1: obj.scale.clone(), y1: obj.position.y };
    if (kind === 'pop') obj.scale.setScalar(0.0001);
    this.items.push(it); return obj;
  }
  ink(obj, delay, dur = 1) { return this.add(obj, delay, dur, 'ink'); }
  fn(fn, delay, dur) { this.items.push({ fn, delay, dur, kind: 'fn' }); }
  // register a touch target with a gentle pulsing halo
  touch(obj, fn, { color = 0xffd27a, size = 0.11, at = null, show = 3.5 } = {}) {
    const h = glow(color, size, 0); h.renderOrder = 8;
    if (at) h.position.copy(at);
    obj.add(h);
    const rec = { h, size, phase: Math.random() * 6, on: true, show, base: 0.5 };
    this.halos.push(rec);
    this.ctx.tap(obj, () => { fn(rec); });
    return rec;
  }
  update(t, dt, e) {
    this.t = t;
    for (const it of this.items) {
      const p = clamp01((t - it.delay) / it.dur) * e;
      if (it.kind === 'ink') it.obj.userData.reveal(p);
      else if (it.kind === 'fn') it.fn(p);
      else {
        const k = ease(p), b = easeBack(p);
        it.obj.scale.set(Math.max(it.s1.x * b, 0.0001), Math.max(it.s1.y * b, 0.0001), Math.max(it.s1.z * b, 0.0001));
        if (it.rise) it.obj.position.y = it.y1 - it.rise * (1 - k);
        it.obj.visible = p > 0.002;
      }
    }
    for (const r of this.halos) {
      const a = clamp01((t - r.show) / 1.2) * e;
      const pulse = 0.5 + 0.5 * Math.sin(t * 2.6 + r.phase);
      r.h.material.opacity = r.on ? (0.18 + 0.32 * pulse) * a : 0.0;
      r.h.scale.setScalar(r.size * (0.9 + 0.2 * pulse));
    }
  }
}

// ---------------------------------------------------------------- plinths
export function hexPlinth(r = 0.3, color = 0xf3ead6, gold = true) {
  const g = new THREE.Group();
  const top = inked(new THREE.CylinderGeometry(r, r * 1.04, 0.018, 6), { color });
  top.position.y = 0.009; g.add(top);
  const rim = new THREE.Mesh(new THREE.CylinderGeometry(r * 1.045, r * 1.055, 0.006, 6), gold ? goldMat() : mat(0xcfc3a8));
  rim.position.y = 0.002; rim.receiveShadow = true; g.add(rim);
  g.userData.reveal = (p) => top.userData.reveal(p);
  return g;
}
export function roundPlinth(r = 0.3, color = 0xf3ead6) {
  const g = new THREE.Group();
  const top = inked(new THREE.CylinderGeometry(r, r * 1.03, 0.016, 56), { color });
  top.position.y = 0.008; g.add(top);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(r * 1.02, 0.005, 10, 72), goldMat());
  rim.rotation.x = Math.PI / 2; rim.position.y = 0.012; g.add(rim);
  g.userData.reveal = (p) => { top.userData.reveal(p); rim.visible = p > 0.5; };
  return g;
}

// a soft, slow breathing helper
export const breathe = (t, f = 1, a = 1, ph = 0) => Math.sin(t * f + ph) * a;
export { ease, easeBack, clamp01, stag, glow, mat, glossy, goldMat, shadowed, inked };
