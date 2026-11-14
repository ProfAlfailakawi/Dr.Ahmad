// Shared helpers for the a7 pages: appear/bounce rig, touch hints, plinth, canvas drawing.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { P, ease, easeBack, clamp01, mat, glossy, goldMat, glow, sprite } from '../../kit.js?v=35';
import { softLight, lightPool, tagSprite, solidTag, setSpr } from '../../v2/common.js?v=35';

export const TAU = Math.PI * 2;
export const css = (c) => '#' + c.toString(16).padStart(6, '0');
export const toAr = (n) => String(n).replace(/\d/g, (d) => '٠١٢٣٤٥٦٧٨٩'[d]);
export const rbox = (w, h, d, r = 0.004) => new RoundedBoxGeometry(w, h, d, 3, Math.min(r, w / 2.1, h / 2.1, d / 2.1));
export { RoundedBoxGeometry, softLight, lightPool, tagSprite, solidTag, setSpr };

export function canvasTex(w, h, draw, srgb = true) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}

// Emissive "light" material (stays bright, ignores scene light).
export const lit = (color, opacity = 1) => new THREE.MeshBasicMaterial({ color, toneMapped: false, transparent: opacity < 1, opacity });

// Appear + bounce rig. Everything registered grows in (pop) at its delay; tap() bounces it.
export function rig() {
  const items = [];
  const api = {
    add(obj, delay = 0, { dur = 0.7, rise = 0, fn = easeBack, hold = false } = {}) {
      obj.userData._a = { delay, dur, rise, fn, base: obj.scale.clone(), y0: obj.position.y, bn: 0, k: 0, hold };
      obj.scale.multiplyScalar(0.0001); obj.visible = false; items.push(obj); return obj;
    },
    bounce(obj, amt = 1) { if (obj.userData._a) obj.userData._a.bn = amt; },
    k(obj) { return obj.userData._a ? obj.userData._a.k : 1; },
    update(t, dt, e) {
      for (const o of items) {
        const a = o.userData._a;
        const k = a.fn((t - a.delay) / a.dur) * e;
        a.k = k; a.bn = Math.max(0, a.bn - dt * 3.2);
        const s = Math.max(k, 0.0001) * (1 + 0.16 * Math.sin(Math.min(1, 1 - a.bn) * Math.PI) * (a.bn > 0 ? 1 : 0));
        o.scale.copy(a.base).multiplyScalar(s);
        o.position.y = a.y0 + a.rise * (1 - clamp01(k));
        o.visible = k > 0.003;
      }
    },
  };
  return api;
}

// Touch hints: a soft pulsing halo on every untouched, touchable object. `tapped(obj)` quiets it.
export function hints(root) {
  const list = [];
  return {
    add(obj, color = 0xffd27a, size = 0.1, at = null, gate = null) {
      const h = softLight(color, size, 0); h.renderOrder = 8;
      if (at) h.position.copy(at); else obj.add(h);
      if (at) root.add(h);
      list.push({ h, size, seen: false, obj, gate, ph: Math.random() * 6 });
      return h;
    },
    seen(obj) { list.forEach((x) => { if (x.obj === obj) x.seen = true; }); },
    update(t, e, ready = 1) {
      list.forEach((x) => {
        const g = x.gate ? x.gate() : 1;
        const a = x.seen ? 0 : (0.28 + 0.2 * Math.sin(t * 2.6 + x.ph)) * e * ready * g;
        x.h.material.opacity = a; x.h.visible = a > 0.01;
        x.h.scale.setScalar(x.size * (1 + 0.14 * Math.sin(t * 2.6 + x.ph)));
      });
    },
  };
}

// Burst at the world position of an object, expressed in stage space.
export function burstAt(ctx, obj, color = 0xffd27a, n = 22, speed = 0.4, size = 0.03) {
  const v = new THREE.Vector3(); obj.getWorldPosition(v); ctx.stage.worldToLocal(v);
  ctx.fx.burst(v, color, n, speed, size);
}

// A round display plinth: lathe body, gold rim, soft contact shadow. Returns the group (top surface at y = h).
export function plinth(r = 0.3, { h = 0.022, color = 0xf1ebdd, rim = true, shadow = true } = {}) {
  const g = new THREE.Group();
  const pts = [[0, 0], [r * 0.96, 0], [r, h * 0.35], [r, h * 0.85], [r * 0.985, h], [0, h]].map(([x, y]) => new THREE.Vector2(x, y));
  const body = new THREE.Mesh(new THREE.LatheGeometry(pts, 64), mat(color, { roughness: 0.55 }));
  body.receiveShadow = true; g.add(body);
  if (rim) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(r * 0.992, h * 0.2, 10, 96), goldMat());
    ring.rotation.x = Math.PI / 2; ring.position.y = h * 0.95; g.add(ring);
  }
  if (shadow) { const s = lightPool(0x000000, r * 1.25, 0.2); s.position.y = -0.002; g.add(s); }
  g.userData.top = h;
  return g;
}

// Glass tube/cylinder material.
export const glass = (color = 0xffffff, op = 0.22) => new THREE.MeshPhysicalMaterial({ color, roughness: 0.06, metalness: 0, transparent: true, opacity: op, depthWrite: false, clearcoat: 1 });

// Soft pulsing breathing helper
export const breathe = (t, f = 1, a = 0.5, ph = 0) => 1 + a * Math.sin(t * f + ph);

export const lerp = (a, b, k) => a + (b - a) * k;
export { P, ease, easeBack, clamp01, mat, glossy, goldMat, glow, sprite };

export function hexShape(r) {
  const s = new THREE.Shape();
  for (let i = 0; i < 6; i++) { const a = (i / 6) * TAU; const x = Math.cos(a) * r, y = Math.sin(a) * r; i ? s.lineTo(x, y) : s.moveTo(x, y); }
  s.closePath(); return s;
}
// flat hexagonal slab lying on the page; top at y + depth
export function hexSlab(r, depth, color, y = 0, bevel = 0.004, material = null) {
  const m = new THREE.Mesh(new THREE.ExtrudeGeometry(hexShape(r), { depth, bevelEnabled: true, bevelSize: bevel, bevelThickness: bevel, bevelSegments: 2 }), material || glossy(color, { roughness: 0.35 }));
  m.rotation.x = -Math.PI / 2; m.position.y = y; return m;
}
// Is a point-hint needed? simple additive star sprite helper
export function twinkles(parent, n, w, hgt, d, color = 0xffe9a6, size = 0.02) {
  const arr = Array.from({ length: n }, () => { const s = glow(color, size * (0.6 + Math.random() * 0.8), 0.8); s.position.set((Math.random() - 0.5) * w, hgt * (0.3 + Math.random() * 0.7), (Math.random() - 0.5) * d); s.userData.ph = Math.random() * 6; s.userData.sz = s.scale.x; parent.add(s); return s; });
  return { update(t, e) { arr.forEach((s) => { const k = 0.5 + 0.5 * Math.sin(t * 2 + s.userData.ph); s.material.opacity = 0.85 * k * e; s.scale.setScalar(s.userData.sz * (0.6 + 0.6 * k)); }); } };
}
