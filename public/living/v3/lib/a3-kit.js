// Shared helpers for the a3 builder's pages: plinths, text on surfaces, touch hints, discovery counter.
import * as THREE from 'three';
import { mat, goldMat, clamp01, ease } from '../../kit.js?v=17';
import { softLight } from '../../v2/common.js?v=17';

export const toAr = (n) => String(n).replace(/\d/g, (d) => '٠١٢٣٤٥٦٧٨٩'[d]);
export const css = (c) => '#' + c.toString(16).padStart(6, '0');

// A round display plinth with a gold rim and a finished underside.
export function plinth(r = 0.3, h = 0.03, { top = 0xf3ecdc, foot = 0x2b2620 } = {}) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 1.03, h, 72), mat(top, { roughness: 0.5 }));
  body.position.y = h / 2; body.receiveShadow = true; g.add(body);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(r * 1.01, h * 0.2, 10, 96), goldMat());
  rim.rotation.x = Math.PI / 2; rim.position.y = h; g.add(rim);
  const under = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.86, r * 0.7, h * 0.9, 56), mat(foot, { roughness: 0.4 }));
  under.position.y = -h * 0.25; g.add(under);
  const ring2 = new THREE.Mesh(new THREE.TorusGeometry(r * 0.87, h * 0.12, 8, 80), goldMat());
  ring2.rotation.x = Math.PI / 2; ring2.position.y = -h * 0.05; g.add(ring2);
  return g;
}

// Arabic text on a flat surface (face up when rot = true) or standing plane.
export function slabText(text, w, h, { bg = null, fg = '#ffffff', weight = 800, flat = true, px = 512, size = 0.55 } = {}) {
  const c = document.createElement('canvas'); c.width = px; c.height = Math.round(px * h / w);
  const g = c.getContext('2d');
  if (bg) { g.fillStyle = bg; g.fillRect(0, 0, c.width, c.height); }
  const fs = Math.round(c.height * size);
  g.font = `${weight} ${fs}px "Reem Kufi", Tajawal, sans-serif`;
  let k = fs;
  while (g.measureText(text).width > c.width * 0.9 && k > 14) { k -= 2; g.font = `${weight} ${k}px "Reem Kufi", Tajawal, sans-serif`; }
  g.direction = 'rtl'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = fg;
  g.fillText(text, c.width / 2, c.height / 2 + 2);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, toneMapped: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
  if (flat) m.rotation.x = -Math.PI / 2;
  m.renderOrder = 4;
  return m;
}

// Gentle breathing glow on things that can be touched.
export function hints() {
  const list = [];
  return {
    add(obj, color = 0xd4ad55, size = 0.12, at = [0, 0, 0], from = 3) {
      const s = softLight(color, size, 0); s.position.set(at[0], at[1], at[2]); s.renderOrder = 8;
      obj.add(s);
      const it = { s, size, from, calm: false, ph: list.length * 1.7 };
      list.push(it); return it;
    },
    update(t, e) {
      for (let i = 0; i < list.length; i++) {
        const it = list[i];
        const a = clamp01((t - it.from) / 0.8) * e;
        const base = it.calm ? 0.0 : 0.26 + 0.2 * Math.sin(t * 2.6 + it.ph);
        it.s.material.opacity = base * a;
        it.s.scale.setScalar(it.size * (1 + 0.08 * Math.sin(t * 2.6 + it.ph)));
      }
    },
  };
}

// Counts distinct discoveries and finishes the page once enough were made.
export function finder(ctx, need) {
  const seen = new Set();
  return (id) => { seen.add(id); if (seen.size >= need) ctx.ui.done(); return seen.size; };
}

export const lerp = (a, b, k) => a + (b - a) * k;
export { ease, clamp01 };

// Soft contact shadow lying on the page (no stage needed).
let shTex;
export function blobShadow(w = 0.2, d = 0.2, op = 0.3) {
  if (!shTex) {
    const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d');
    const gr = g.createRadialGradient(64, 64, 4, 64, 64, 64); gr.addColorStop(0, 'rgba(30,20,10,1)'); gr.addColorStop(0.55, 'rgba(30,20,10,.45)'); gr.addColorStop(1, 'rgba(30,20,10,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 128, 128); shTex = new THREE.CanvasTexture(c);
  }
  const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: shTex, transparent: true, opacity: op, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 }));
  m.rotation.x = -Math.PI / 2; m.scale.set(w, d, 1); m.position.y = 0.002; m.renderOrder = 1;
  return m;
}
export const hitSphere = (r, at = [0, 0, 0]) => { const m = new THREE.Mesh(new THREE.SphereGeometry(r, 8, 6), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false })); m.position.set(...at); return m; };
