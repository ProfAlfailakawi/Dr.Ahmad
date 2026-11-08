// Small helpers shared by the pages built by builder a6 (p314..p345).
import * as THREE from 'three';
import { clamp01, ease, easeBack, stag, sprite, glow } from '../../kit.js?v=27';

export const TAU = Math.PI * 2;
export const toAr = (n) => String(n).replace(/\d/g, (d) => '٠١٢٣٤٥٦٧٨٩'[d]);
export const css = (c) => '#' + c.toString(16).padStart(6, '0');

// Drives `reveal(p)` of inked objects on a schedule: add(obj, delay, dur); update(t, e).
export function revealer() {
  const list = [];
  return {
    add(o, delay, dur = 1) { list.push([o, delay, dur]); return o; },
    update(t, e) { for (const [o, d, du] of list) o.userData.reveal(clamp01((t - d) / du) * e); },
  };
}

// Scale-in of plain meshes: grow(obj, t, delay, dur, e)
export function grow(obj, t, delay, dur, e = 1, base = 1) {
  const k = Math.max(stag(t, delay, dur, easeBack) * e * base, 0.0001);
  obj.scale.setScalar(k);
  return k;
}

// Replace the text of a label sprite made with kit.sprite()
export function retext(spr, text, w, opts) {
  const fresh = sprite(text, w, opts);
  spr.material.map.dispose(); spr.material.map = fresh.material.map; spr.material.needsUpdate = true;
  spr.userData.aspect = fresh.userData.aspect; spr.userData.w = w;
  fresh.material.dispose();
}
export const setSpr = (s, w, k) => s.scale.set(Math.max(w * k, 0.0001), Math.max(w * s.userData.aspect * k, 0.0001), 1);

// A soft pulsing ring light that says "touch me".
export function hintGlow(color, size = 0.09) {
  const s = glow(color, size, 0.0); s.userData.size = size; return s;
}
export function pulseHint(s, t, phase = 0, on = 1, amp = 0.38) {
  s.material.opacity = on * (amp * 0.55 + amp * 0.45 * Math.sin(t * 3 + phase));
  const k = 1 + 0.12 * Math.sin(t * 3 + phase); s.scale.setScalar(s.userData.size * k);
}

// Bump animation: hit(obj) squashes/stretches obj.scale briefly (obj must be a wrapper that nothing else scales).
export function bumper() {
  const items = new Map();
  return {
    hit(obj, now, amp = 0.22) { if (!obj.userData.s0) obj.userData.s0 = obj.scale.clone(); items.set(obj, [now, amp]); },
    update(now) {
      for (const [obj, [t0, amp]] of items) {
        const d = now - t0, s0 = obj.userData.s0;
        if (d > 0.9) { obj.scale.copy(s0); items.delete(obj); continue; }
        const k = 1 + amp * Math.exp(-d * 5) * Math.sin(d * 22);
        obj.scale.set(s0.x * k, s0.y * (2 - k), s0.z * k);
      }
    },
  };
}

// Canvas texture helper for printed faces on objects.
export function canvasTex(w, h, draw) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d'); draw(g, w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}
export function faceMat(tex, o = {}) { return new THREE.MeshBasicMaterial({ map: tex, toneMapped: false, ...o }); }

// Wrapped Arabic text on a canvas (rtl, centred)
export function fillText(g, text, x, y, size, color = '#2b2620', weight = 800, font = 'Tajawal, sans-serif') {
  g.font = `${weight} ${size}px ${font}`; g.direction = 'rtl'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = color;
  g.fillText(text, x, y);
}
export { ease, easeBack, clamp01, stag };

// Burst at a point given in the local space of group g (works with scaled/rotated groups)
const _w = new THREE.Vector3();
export function burstAt(ctx, g, local, color, n = 24, speed = 0.4, size = 0.03) {
  _w.copy(local); g.localToWorld(_w); ctx.stage.worldToLocal(_w);
  ctx.fx.burst(_w.clone(), color, n, speed, size);
}
