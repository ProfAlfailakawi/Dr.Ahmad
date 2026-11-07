// Helpers for the b3 batch: Arabic text painted directly on objects (plates), small utilities.
import * as THREE from 'three';

const FONT = 'Tajawal, sans-serif';

// A flat plane carrying painted Arabic text (auto-fit, up to `lines` lines). Call .userData.draw(text, opts) to repaint.
export function plate(text, w, h, o = {}) {
  const px = o.px || 512, W = px, H = Math.round(px * h / w);
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex, transparent: true, toneMapped: false, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
  m.renderOrder = 3;
  m.userData.draw = (t, oo = {}) => {
    const q = { ...o, ...oo }; const g = c.getContext('2d'); g.clearRect(0, 0, W, H);
    if (q.bg) { g.fillStyle = q.bg; g.beginPath(); g.roundRect(0, 0, W, H, q.radius ?? H * 0.22); g.fill(); }
    if (q.border) { g.lineWidth = q.bw || 6; g.strokeStyle = q.border; g.beginPath(); g.roundRect(q.bw || 6, q.bw || 6, W - 2 * (q.bw || 6), H - 2 * (q.bw || 6), q.radius ?? H * 0.22); g.stroke(); }
    g.direction = 'rtl'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = q.fg || '#2b2620';
    const weight = q.weight || 800, maxL = q.lines || 2, mw = W * 0.88;
    let size = q.size || H * 0.5, lines = [t];
    for (; size > 14; size -= 3) {
      g.font = `${weight} ${size}px ${FONT}`;
      lines = wrap(g, t, mw);
      if (lines.length <= maxL && lines.length * size * 1.25 <= H * 0.92) break;
    }
    const lh = size * 1.25, y0 = H / 2 - (lines.length - 1) * lh / 2 + size * 0.04;
    lines.forEach((l, i) => g.fillText(l, W / 2, y0 + i * lh));
    tex.needsUpdate = true;
  };
  m.userData.draw(text);
  return m;
}
function wrap(g, text, mw) {
  const out = []; let line = '';
  for (const wd of String(text).split(' ')) { const t = line ? line + ' ' + wd : wd; if (g.measureText(t).width > mw && line) { out.push(line); line = wd; } else line = t; }
  out.push(line); return out;
}

// Smoothstep + a few easings used in several pages.
export const sm = (x) => { x = Math.min(1, Math.max(0, x)); return x * x * (3 - 2 * x); };
export const damp = (a, b, k, dt) => a + (b - a) * (1 - Math.exp(-k * dt));
export const col = (h) => '#' + h.toString(16).padStart(6, '0');
