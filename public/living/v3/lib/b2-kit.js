// Shared helpers for the a1 builder pages: a plinth, a piece animator (rise-in, bump on touch, pulse hint) and tidy labels.
import * as THREE from 'three';
import { P, ease, easeBack, clamp01, stag, mat, glossy, goldMat, shadowed, glow, sprite, PAGE_H } from '../../kit.js?v=32';
import { softLight, tagSprite, setSpr } from '../../v2/common.js?v=32';

export const TAU = Math.PI * 2;
export const css = (c) => '#' + c.toString(16).padStart(6, '0');
export const toAr = (n) => String(n).replace(/\d/g, (d) => '٠١٢٣٤٥٦٧٨٩'[d]);

// A round paper plinth with a gold rim and a finished tapered underside (reads well from every side).
export function plinth(r = 0.34, { top = 0xf6f0e2, rim = 0xd4ad55, under = 0x3b2f27, h = 0.022 } = {}) {
  const g = new THREE.Group();
  const prof = [[0.001, -h * 3.2], [r * 0.5, -h * 3], [r * 0.86, -h * 1.6], [r * 0.985, -h * 0.4], [r, 0], [r, h * 0.2], [r * 0.985, h * 0.5], [0.001, h * 0.5]].map(([x, y]) => new THREE.Vector2(x, y));
  const body = new THREE.Mesh(new THREE.LatheGeometry(prof, 72), mat(top, { roughness: 0.5, transparent: true, opacity: 0.74 }));
  body.position.y = -0.002;
  const under_ = new THREE.Mesh(new THREE.LatheGeometry(prof.slice(0, 4), 72), mat(under, { roughness: 0.45, metalness: 0.2 }));
  under_.position.y = -0.002; under_.scale.setScalar(1.002);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(r, h * 0.28, 10, 96), goldMat()); ring.rotation.x = Math.PI / 2; ring.position.y = h * 0.1;
  g.add(body, under_, ring);
  g.userData.top = h * 0.5;
  return g;
}

export function canvasTexture(w, h, draw) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}

// pulsing ring hint, lying flat in the object's local frame (child of object)
function hintRing(color, r, rot) {
  const m = new THREE.Mesh(new THREE.RingGeometry(r * 0.88, r, 48), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.6, depthWrite: false, toneMapped: false, side: THREE.DoubleSide }));
  m.rotation.set(...rot); m.renderOrder = 4; return m;
}

// Animator: every registered piece rises in at `at`, bumps when touched, and may carry a pulsing hint ring.
export function animator(ctx, g, SC = 1.2) {
  const items = [], hints = [], tags = [];
  let now = 0, E = 1;
  const api = {
    // add a piece: appears at `at` (s), rising from y0 offset
    add(obj, { at = 0, dur = 0.8, rise = 0.05, parent = g } = {}) {
      const u = obj.userData;
      u.base = obj.scale.clone(); u.y1 = obj.position.y; u.at = at; u.dur = dur; u.rise = rise; u.bump = -9;
      obj.scale.setScalar(0.0001);
      parent.add(obj); items.push(obj); return obj;
    },
    // pulsing hint on an object (call after add)
    hint(obj, color = 0xd4ad55, r = 0.05, y = 0.004, rot = [-Math.PI / 2, 0, 0]) {
      const m = hintRing(color, r, rot); m.position.y = y; obj.add(m);
      m.userData = { r, ph: Math.random() * 6 }; hints.push({ m, obj }); return m;
    },
    // touchable: registers the tap, bump + sound + burst; `fn(point)` is the scene's answer
    touch(obj, fn, { color = 0xd4ad55, sfx = 'pop', burst = true } = {}) {
      ctx.tap(obj, () => {
        obj.userData.bump = now; ctx.sfx[sfx]?.();
        if (burst) { ctx.fx.burst(obj.getWorldPosition(new THREE.Vector3()).sub(ctx.stage.position), color, 14, 0.3, 0.03); }
        fn(obj);
      });
    },
    tag(text, _w, color, pos, { at = 0.6, parent = g, solid = false, size = 46 } = {}) {
      // auto-sized, large and readable: the pill grows with its text
      const m = document.createElement('canvas').getContext('2d'); m.font = `800 ${size}px Tajawal, sans-serif`;
      const tw = Math.ceil(m.measureText(text).width) + 74, w = tw / 1150;
      const s = tagSprite(text, w, color, { ppu: 1150, size, ...(solid ? { bg: css(color), color: '#fff', border: null } : {}) });
      s.position.copy(pos); s.userData.w = w; s.userData.at = at; s.material.depthTest = false; s.renderOrder = 9;
      parent.add(s); tags.push(s); return s;
    },
    retag(s, text, color) { // replace the text of a tag, keeping width
      const m = document.createElement('canvas').getContext('2d'); m.font = '800 46px Tajawal, sans-serif'; const nw = (Math.ceil(m.measureText(text).width) + 74) / 1150; const n = tagSprite(text, nw, color, { ppu: 1150, size: 46 }); s.userData.w = nw; s.material.map.dispose(); s.material.map = n.material.map; s.userData.aspect = n.userData.aspect; s.material.needsUpdate = true; n.material.dispose();
    },
    hideHints(obj) { hints.forEach((h) => { if (h.obj === obj) h.m.visible = false; }); },
    sp(v) { return g.position.clone().add(v.clone().multiplyScalar(g.scale.x)); },
    get now() { return now; },
    update(t, dt, e) {
      now = t; E = e;
      g.scale.setScalar(Math.max(0.0001, e * SC));
      for (const o of items) {
        const u = o.userData, k = clamp01((t - u.at) / u.dur), p = easeBack(k);
        const b = t - u.bump, bump = b >= 0 && b < 0.5 ? Math.sin(b / 0.5 * Math.PI) * 0.16 : 0;
        const s = Math.max(0.0001, p * (1 + bump));
        o.scale.set(u.base.x * s, u.base.y * s, u.base.z * s);
        o.position.y = (u.keepY ? o.position.y : u.y1) + (u.keepY ? 0 : (1 - ease(k)) * u.rise);
        o.visible = k > 0.001;
        u.reveal?.(ease(k));
      }
      for (const h of hints) {
        const f = ((t * 0.9 + h.m.userData.ph) % 1.8) / 1.8;
        h.m.scale.setScalar(0.75 + f * 0.7); h.m.material.opacity = (1 - f) * 0.55 * (h.m.parent.visible ? 1 : 0);
      }
      for (const s of tags) { const k = stag(t, s.userData.at, 0.5, easeBack) * (s.userData.hide ? 0 : 1); setSpr(s, s.userData.w, k); s.visible = k > 0.01; }
    },
  };
  return api;
}

// a soft contact shadow lying on the print (no slab): the object floats lightly
let shTex;
export function shadowBlob(w = 0.6, d = 0.4, opacity = 0.35) {
  if (!shTex) shTex = canvasTexture(128, 128, (g) => { const r = g.createRadialGradient(64, 64, 0, 64, 64, 64); r.addColorStop(0, 'rgba(30,20,10,.85)'); r.addColorStop(0.55, 'rgba(30,20,10,.3)'); r.addColorStop(1, 'rgba(30,20,10,0)'); g.fillStyle = r; g.fillRect(0, 0, 128, 128); });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: shTex, transparent: true, opacity, depthWrite: false, toneMapped: false, polygonOffset: true, polygonOffsetFactor: -2 }));
  m.rotation.x = -Math.PI / 2; m.scale.set(w, d, 1); m.position.y = 0.002; m.renderOrder = 1; return m;
}
export const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
export { THREE, P, ease, easeBack, clamp01, stag, mat, glossy, goldMat, shadowed, glow, sprite, PAGE_H, softLight, tagSprite, setSpr };

// ---- b2 additions -------------------------------------------------------
// painted face: text/glyph on a rounded plate, auto-fit. lines split on '\n'.
export function faceTex(text, { w = 512, h = 256, bg = '#f6efe0', fg = '#2b2620', border = null, size = 120, weight = 800, radius = 40, glyphFn = null, round = false } = {}) {
  return canvasTexture(w, h, (g) => {
    if (bg) { g.fillStyle = bg; g.beginPath(); if (round) g.arc(w / 2, h / 2, Math.min(w, h) / 2, 0, TAU); else g.roundRect(0, 0, w, h, radius); g.fill(); }
    if (border) { g.lineWidth = Math.max(6, w / 60); g.strokeStyle = border; g.beginPath(); if (round) g.arc(w / 2, h / 2, Math.min(w, h) / 2 - g.lineWidth, 0, TAU); else g.roundRect(g.lineWidth / 2, g.lineWidth / 2, w - g.lineWidth, h - g.lineWidth, radius); g.stroke(); }
    if (glyphFn) glyphFn(g, w, h);
    if (text) {
      const lines = String(text).split('\n'); let s = size; g.direction = 'rtl'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = fg;
      const fit = () => { g.font = `${weight} ${s}px Tajawal, sans-serif`; return Math.max(...lines.map((l) => g.measureText(l).width)); };
      while (fit() > w * 0.84 && s > 18) s -= 4;
      lines.forEach((l, i) => g.fillText(l, w / 2, h / 2 + (i - (lines.length - 1) / 2) * s * 1.25));
    }
  });
}
// deterministic jittered rock / crystal
export function rock(r = 0.1, { detail = 1, jit = 0.22, seed = 1, sq = [1, 1, 1] } = {}) {
  const geo = new THREE.IcosahedronGeometry(r, detail);
  const p = geo.attributes.position; const v = new THREE.Vector3();
  const cache = new Map();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i); const key = v.x.toFixed(3) + v.y.toFixed(3) + v.z.toFixed(3);
    if (!cache.has(key)) { const n = Math.sin((v.x * 12.9898 + v.y * 78.233 + v.z * 37.719 + seed * 4.1) * 43758.5453); cache.set(key, 1 + ((n - Math.floor(n)) - 0.5) * 2 * jit); }
    v.multiplyScalar(cache.get(key)); v.set(v.x * sq[0], v.y * sq[1], v.z * sq[2]); p.setXYZ(i, v.x, v.y, v.z);
  }
  geo.computeVertexNormals(); return geo;
}
export const hex6 = (c) => '#' + c.toString(16).padStart(6, '0');
