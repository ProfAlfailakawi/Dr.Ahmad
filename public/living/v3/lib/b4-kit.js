// Helpers of builder "b4" (round 4: pages 239, 255, 263, 289, 295, 299).
import * as THREE from 'three';
import { ease, easeBack, clamp01, stag, mat, goldMat, glow } from '../../kit.js?v=40';

export { ease, easeBack, clamp01, stag };
export const TAU = Math.PI * 2;
export const css = (c) => '#' + c.toString(16).padStart(6, '0');
export const toAr = (n) => String(n).replace(/\d/g, (d) => '٠١٢٣٤٥٦٧٨٩'[d]);

export function canvasTex(w, h, draw) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; t.userData = { canvas: c };
  return t;
}

// pieces that rise and grow into place one after another
export function rising() {
  const items = [];
  return {
    add(obj, delay, from = 0.1, dur = 0.7) { items.push({ obj, delay, from, dur, y: obj.position.y, s: obj.scale.x || 1 }); obj.scale.setScalar(0.0001); return obj; },
    update(t, e) {
      for (const it of items) {
        const k = stag(t, it.delay, it.dur, easeBack) * e;
        it.obj.visible = k > 0.002; it.obj.scale.setScalar(Math.max(k * it.s, 0.0001));
        it.obj.position.y = it.y + (1 - stag(t, it.delay, it.dur)) * it.from;
      }
    },
  };
}

// breathing glow behind touchable things. returns handle with .on (0..1)
export function halos() {
  const items = [];
  return {
    add(parent, color = 0xffd27a, size = 0.12, pos = [0, 0, 0], appear = 3) {
      const s = glow(color, size, 0); s.position.set(...pos); s.renderOrder = 4; parent.add(s);
      items.push({ s, size, ph: Math.random() * 6, appear, on: 1 });
      return items[items.length - 1];
    },
    update(t, e) {
      for (const it of items) {
        const k = stag(t, it.appear, 0.8) * e * it.on;
        it.s.material.opacity = k * (0.34 + 0.26 * Math.sin(t * 2.4 + it.ph));
        it.s.scale.setScalar(it.size * (0.92 + 0.1 * Math.sin(t * 2.4 + it.ph)));
      }
    },
  };
}

let blobTex;
export function blob(r, opacity = 0.32) {
  if (!blobTex) blobTex = canvasTex(128, 128, (g, w, h) => { const gr = g.createRadialGradient(64, 64, 4, 64, 64, 64); gr.addColorStop(0, 'rgba(20,14,8,.85)'); gr.addColorStop(0.55, 'rgba(20,14,8,.35)'); gr.addColorStop(1, 'rgba(20,14,8,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, h); });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: blobTex, transparent: true, opacity, depthWrite: false, toneMapped: false }));
  m.rotation.x = -Math.PI / 2; m.position.y = 0.0015; m.scale.setScalar(r * 2); m.renderOrder = 1; return m;
}

export function motes(parent, n, { r = 0.3, h = 0.4, color = 0xfff0c0, size = 0.014, cy = 0.02 } = {}) {
  const arr = [];
  for (let i = 0; i < n; i++) {
    const s = glow(color, size, 0); parent.add(s);
    arr.push({ s, a: Math.random() * TAU, rr: Math.sqrt(Math.random()) * r, y: Math.random() * h, v: 0.012 + Math.random() * 0.02, ph: Math.random() * 6 });
  }
  return {
    update(t, dt, e) {
      for (const m of arr) {
        m.y += m.v * dt; if (m.y > h) m.y = 0;
        m.s.position.set(Math.cos(m.a + t * 0.05) * m.rr, cy + m.y, Math.sin(m.a + t * 0.05) * m.rr);
        m.s.material.opacity = e * Math.sin(Math.min(1, m.y / h) * Math.PI) * (0.5 + 0.4 * Math.sin(t * 2 + m.ph));
      }
    },
  };
}

// round plinth with gold rim and a finished underside
export function dais(r, { top = 0xf4efe3, rim = 0xd8b25a, h = 0.026, under = 0x5b4636 } = {}) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 0.92, h, 64), mat(top, { roughness: 0.5 })); body.position.y = h / 2; g.add(body);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(r, h * 0.42, 12, 80), goldMat()); ring.rotation.x = Math.PI / 2; ring.position.y = h * 0.82; g.add(ring);
  const foot = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.92, r * 0.55, h * 1.6, 56), mat(under, { roughness: 0.5 })); foot.position.y = -h * 0.8; g.add(foot);
  const cap = new THREE.Mesh(new THREE.CircleGeometry(r * 0.55, 32), goldMat()); cap.rotation.x = Math.PI / 2; cap.position.y = -h * 1.6 - 0.001; g.add(cap);
  g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return g;
}

// Wrap text to lines inside a canvas context
function wrap(g, text, maxW) {
  const out = []; let line = '';
  for (const w of text.split(' ')) { const t = line ? line + ' ' + w : w; if (g.measureText(t).width > maxW && line) { out.push(line); line = w; } else line = t; }
  out.push(line); return out;
}
// Paint centered Arabic text (auto-shrinks to fit)
export function paintText(g, text, cx, cy, maxW, maxH, { size = 64, color = '#1f1b16', weight = 800, line = 1.25 } = {}) {
  let s = size, lines;
  for (; s > 18; s -= 3) { g.font = `${weight} ${s}px Tajawal, sans-serif`; lines = wrap(g, text, maxW); if (lines.length * s * line <= maxH && lines.every((l) => g.measureText(l).width <= maxW)) break; }
  g.font = `${weight} ${s}px Tajawal, sans-serif`; g.direction = 'rtl'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = color;
  lines = wrap(g, text, maxW);
  lines.forEach((l, i) => g.fillText(l, cx, cy + (i - (lines.length - 1) / 2) * s * line));
}
// A plane mesh whose canvas can be redrawn: screen(w,h,px) -> {mesh, draw(fn), tex}
export function screen(w, h, px = 512, { transparent = true } = {}) {
  const cw = px, ch = Math.round(px * h / w);
  const c = document.createElement('canvas'); c.width = cw; c.height = ch;
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex, transparent, toneMapped: false, depthWrite: false }));
  mesh.renderOrder = 5;
  const g = c.getContext('2d');
  return { mesh, tex, g, cw, ch, draw(fn) { g.clearRect(0, 0, cw, ch); fn(g, cw, ch); tex.needsUpdate = true; } };
}
// static textured plate (rounded rect plane) with text painted on
export function textPlate(text, w, h, { px = 384, bg = '#fbf8f0', color = '#1f1b16', size = 72, radius = 0.22, border = null } = {}) {
  const s = screen(w, h, px);
  s.draw((g, cw, ch) => {
    if (bg) { g.fillStyle = bg; g.beginPath(); g.roundRect(2, 2, cw - 4, ch - 4, ch * radius); g.fill(); }
    if (border) { g.lineWidth = 6; g.strokeStyle = border; g.stroke(); }
    paintText(g, text, cw / 2, ch / 2, cw * 0.86, ch * 0.78, { size, color });
  });
  return s;
}
