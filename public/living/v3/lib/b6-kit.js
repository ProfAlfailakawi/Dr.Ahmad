// Shared helpers of the builder "a4" (pages 237-275): rise-in sequencer, touch halos, ring dais, tags, motes.
import * as THREE from 'three';
import { ease, easeBack, clamp01, stag, mat, goldMat, glow } from '../../kit.js?v=39';
import { tagSprite, solidTag, setSpr } from '../../v2/common.js?v=39';

export { tagSprite, solidTag, setSpr };
export const TAU = Math.PI * 2;
export const css = (c) => '#' + c.toString(16).padStart(6, '0');
export const lerp = THREE.MathUtils.lerp;

// Pieces that rise and grow into place one after another. add(obj, delay, from) ; update(t, e)
export function rising() {
  const items = [];
  return {
    add(obj, delay, from = 0.12, dur = 0.7) {
      items.push({ obj, delay, from, dur, y: obj.position.y, s: obj.scale.x || 1 });
      obj.scale.setScalar(0.0001);
      return obj;
    },
    update(t, e) {
      for (const it of items) {
        const k = stag(t, it.delay, it.dur, easeBack) * e;
        it.obj.visible = k > 0.002;
        it.obj.scale.setScalar(Math.max(k * it.s, 0.0001));
        it.obj.position.y = it.y + (1 - stag(t, it.delay, it.dur)) * it.from;
      }
    },
  };
}

// Soft breathing glow behind anything touchable.
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

// A round dais with a gold rim (echoes the printed gold ring) and a finished underside.
export function dais(r, { top = 0xf4efe3, rim = 0xd8b25a, h = 0.026 } = {}) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 0.9, h, 56), mat(top, { roughness: 0.55 }));
  body.position.y = h / 2; g.add(body);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(r, h * 0.42, 12, 72), goldMat());
  ring.rotation.x = Math.PI / 2; ring.position.y = h * 0.82; g.add(ring);
  const foot = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.9, r * 0.5, h * 1.6, 48), mat(0x5b4636, { roughness: 0.5 }));
  foot.position.y = -h * 0.8; g.add(foot);
  const under = new THREE.Mesh(new THREE.CircleGeometry(r * 0.5, 32), goldMat()); under.rotation.x = Math.PI / 2; under.position.y = -h * 1.6 - 0.001; g.add(under);
  g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return g;
}

// A label that fits its text (bigger, close to objects). style: 'ink' (dark, gold text), 'paper' (cream) or 'solid' (accent colour).
export function fitTag(text, color, o = {}) {
  const { size = 60, style = 'ink', fixed = 0, ...rest } = o;
  const w = fixed || Math.ceil([...text].length * size * 0.6 + size * 1.2) / 1900;
  const st = style === 'ink' ? { bg: 'rgba(31,27,22,.92)', color: '#f3dca2', border: null }
    : style === 'solid' ? { bg: typeof color === 'number' ? css(color) : color, color: '#ffffff', border: null }
    : { bg: 'rgba(251,248,240,.97)', color: '#1f1b16', border: typeof color === 'number' ? css(color) : color };
  const s = tagSprite(text, w, color, { size, weight: 800, radius: 30, pad: 24, ...st, ...rest });
  s.userData.w = w; return s;
}
// Text with no box: dark ink with a soft pale halo, so it floats lightly on the print (round 3).
export function haloText(text, { size = 56, color = '#1f2b36', halo = '#ffffff', weight = 800 } = {}) {
  const col = typeof color === 'number' ? css(color) : color;
  let lines = [text];
  const words = text.split(' ');
  if (text.length > 12 && words.length > 1) { let best = 1, bd = 1e9; for (let k = 1; k < words.length; k++) { const a = words.slice(0, k).join(' ').length, b = words.slice(k).join(' ').length; if (Math.abs(a - b) < bd) { bd = Math.abs(a - b); best = k; } } lines = [words.slice(0, best).join(' '), words.slice(best).join(' ')]; }
  const c = document.createElement('canvas'); const g = c.getContext('2d');
  const font = `${weight} ${size}px Tajawal, sans-serif`; g.font = font;
  const lh = Math.ceil(size * 1.3), w = Math.ceil(Math.max(...lines.map((l) => g.measureText(l).width))) + Math.round(size * 0.9), h = lh * lines.length + Math.round(size * 0.3);
  c.width = w; c.height = h; g.font = font; g.direction = 'rtl'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineJoin = 'round'; g.lineWidth = size * 0.3; g.strokeStyle = halo;
  lines.forEach((l, k) => { const y = size * 0.15 + lh * (k + 0.5); g.globalAlpha = 0.96; g.strokeText(l, w / 2, y); g.globalAlpha = 1; g.fillStyle = col; g.fillText(l, w / 2, y); });
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthWrite: false, toneMapped: false }));
  const wu = w / 1900; sp.scale.set(wu, wu * h / w, 1); sp.userData.aspect = h / w; sp.userData.w = wu; sp.renderOrder = 6;
  return sp;
}

// A label whose text can change (tapped-item tags, counters). w0 only matters with o.fixed.
export function liveTag(w0, color, o = {}) {
  const holder = { sp: null, text: '', w: w0, color, o, k: 0 };
  holder.set = (text, col = holder.color) => {
    if (holder.text === text && col === holder.color && holder.sp) return;
    holder.text = text; holder.color = col;
    const fresh = o.style === 'halo' ? haloText(text, { size: o.size || 56, color: o.ink || '#1f2b36' }) : fitTag(text, col, { ...o, fixed: o.fixed ? w0 : 0 });
    holder.w = fresh.userData.w;
    if (!holder.sp) { holder.sp = fresh; holder.sp.visible = false; return; }
    holder.sp.material.map.dispose(); holder.sp.material.map = fresh.material.map; holder.sp.userData.aspect = fresh.userData.aspect; holder.sp.material.needsUpdate = true;
  };
  holder.apply = (k) => { holder.k = k; holder.sp.visible = k > 0.02; setSpr(holder.sp, holder.w, k); };
  return holder;
}

// A soft dark blob lying on the page under an object (no solid stage).
let blobTex;
export function blob(r, opacity = 0.32) {
  if (!blobTex) blobTex = canvasTex(128, 128, (g, w, h) => { const gr = g.createRadialGradient(64, 64, 4, 64, 64, 64); gr.addColorStop(0, 'rgba(20,14,8,.85)'); gr.addColorStop(0.55, 'rgba(20,14,8,.35)'); gr.addColorStop(1, 'rgba(20,14,8,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, h); });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: blobTex, transparent: true, opacity, depthWrite: false, toneMapped: false }));
  m.rotation.x = -Math.PI / 2; m.position.y = 0.0015; m.scale.setScalar(r * 2); m.renderOrder = 1; return m;
}

// Slow rising motes of light around a scene.
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

// Canvas texture from a draw function.
export function canvasTex(w, h, draw) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  t.userData = { canvas: c }; return t;
}

// A smooth arc between two points (in the same parent space), `lift` above their middle.
export function arcPoint(out, a, b, k, lift) {
  out.lerpVectors(a, b, k); out.y += Math.sin(Math.PI * k) * lift; return out;
}

export const toAr = (n) => String(n).replace(/\d/g, (d) => '٠١٢٣٤٥٦٧٨٩'[d]);
export { ease, easeBack, clamp01, stag };

// A thin glowing tube along a curve with light flowing through it. grow(p) draws it; update(dt) moves the light.
let flowTex;
function flowTexture() {
  if (flowTex) return flowTex;
  flowTex = canvasTex(128, 4, (g, w, h) => {
    const grd = g.createLinearGradient(0, 0, w, 0);
    grd.addColorStop(0, 'rgba(255,255,255,.35)'); grd.addColorStop(0.5, 'rgba(255,255,255,1)'); grd.addColorStop(1, 'rgba(255,255,255,.35)');
    g.fillStyle = grd; g.fillRect(0, 0, w, h);
  });
  flowTex.wrapS = THREE.RepeatWrapping; flowTex.colorSpace = THREE.NoColorSpace;
  return flowTex;
}
export function beam(curve, { radius = 0.004, color = 0x45c6ff, segs = 24, speed = 0.5 } = {}) {
  const geo = new THREE.TubeGeometry(curve, segs, radius, 6);
  const tex = flowTexture().clone(); tex.needsUpdate = true; tex.wrapS = THREE.RepeatWrapping;
  tex.repeat.set(Math.max(1, curve.getLength() / 0.06), 1);
  const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color, map: tex, transparent: true, opacity: 0.95, toneMapped: false, depthWrite: false }));
  m.renderOrder = 3;
  const total = geo.index.count, per = 6 * 6;
  m.userData = { tex, speed, boost: 1, grow(p) { geo.setDrawRange(0, Math.floor((total / per) * clamp01(p)) * per); }, update(dt) { tex.offset.x -= dt * m.userData.speed * m.userData.boost * 2; } };
  m.userData.grow(0);
  return m;
}

// ================= builder b6 additions =================
// ---- glyph library: flat pictograms drawn on canvas. glyph(g, kind, cx, cy, size, color, color2)
const rr = (g, x, y, w, h, r) => { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); };
export const roundRect = rr;
const person = (g, s, c, x = 0, y = 0, k = 1) => { g.fillStyle = c; g.beginPath(); g.arc(x, y - 0.26 * s * k, 0.2 * s * k, 0, TAU); g.fill(); g.beginPath(); g.arc(x, y + 0.52 * s * k, 0.46 * s * k, Math.PI, 0); g.closePath(); g.fill(); };
export const GLYPH = {
  play(g, s, c) { g.fillStyle = c; g.beginPath(); g.moveTo(-0.34 * s, -0.5 * s); g.lineTo(0.56 * s, 0); g.lineTo(-0.34 * s, 0.5 * s); g.closePath(); g.fill(); },
  person(g, s, c) { person(g, s, c, 0, -0.04 * s); },
  group(g, s, c) { person(g, s, c, -0.42 * s, 0.1 * s, 0.62); person(g, s, c, 0.42 * s, 0.1 * s, 0.62); person(g, s, c, 0, -0.06 * s, 0.82); },
  pen(g, s, c, c2) { g.rotate(0.75); g.fillStyle = c; rr(g, -0.12 * s, -0.55 * s, 0.24 * s, 0.82 * s, 0.05 * s); g.fill(); g.fillStyle = c2; g.beginPath(); g.moveTo(-0.12 * s, 0.3 * s); g.lineTo(0.12 * s, 0.3 * s); g.lineTo(0, 0.62 * s); g.closePath(); g.fill(); g.fillStyle = c2; rr(g, -0.12 * s, -0.55 * s, 0.24 * s, 0.14 * s, 0.05 * s); g.fill(); },
  building(g, s, c, c2) { g.fillStyle = c; rr(g, -0.3 * s, -0.5 * s, 0.6 * s, 1.0 * s, 0.05 * s); g.fill(); g.fillStyle = c2; for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) { g.fillRect((-0.17 + j * 0.2) * s, (-0.36 + i * 0.26) * s, 0.14 * s, 0.14 * s); } g.fillRect(-0.07 * s, 0.3 * s, 0.14 * s, 0.2 * s); },
  archive(g, s, c, c2) { g.fillStyle = c; rr(g, -0.5 * s, -0.42 * s, 1.0 * s, 0.9 * s, 0.08 * s); g.fill(); g.fillStyle = c2; g.fillRect(-0.42 * s, -0.04 * s, 0.84 * s, 0.05 * s); rr(g, -0.14 * s, -0.24 * s, 0.28 * s, 0.1 * s, 0.04 * s); g.fill(); rr(g, -0.14 * s, 0.16 * s, 0.28 * s, 0.1 * s, 0.04 * s); g.fill(); g.fillStyle = c; rr(g, -0.56 * s, -0.55 * s, 1.12 * s, 0.2 * s, 0.06 * s); g.fill(); },
  globe(g, s, c) { g.strokeStyle = c; g.lineWidth = 0.1 * s; g.beginPath(); g.arc(0, 0, 0.5 * s, 0, TAU); g.stroke(); g.lineWidth = 0.07 * s; g.beginPath(); g.ellipse(0, 0, 0.2 * s, 0.5 * s, 0, 0, TAU); g.stroke(); g.beginPath(); g.moveTo(-0.5 * s, 0); g.lineTo(0.5 * s, 0); g.moveTo(-0.42 * s, -0.25 * s); g.lineTo(0.42 * s, -0.25 * s); g.moveTo(-0.42 * s, 0.25 * s); g.lineTo(0.42 * s, 0.25 * s); g.stroke(); },
  hand(g, s, c) { g.fillStyle = c; rr(g, -0.28 * s, -0.04 * s, 0.56 * s, 0.56 * s, 0.2 * s); g.fill(); [[-0.28, -0.42], [-0.09, -0.52], [0.1, -0.5], [0.29, -0.4]].forEach(([x, y], i) => { rr(g, (x - 0.08) * s, y * s, 0.16 * s, (0.56 - i * 0.0) * s, 0.08 * s); g.fill(); }); g.save(); g.translate(-0.3 * s, 0.22 * s); g.rotate(-0.8); rr(g, -0.07 * s, -0.3 * s, 0.15 * s, 0.4 * s, 0.07 * s); g.fill(); g.restore(); },
  disk(g, s, c, c2) { g.fillStyle = c; g.beginPath(); g.moveTo(-0.46 * s, -0.5 * s); g.lineTo(0.3 * s, -0.5 * s); g.lineTo(0.5 * s, -0.3 * s); g.lineTo(0.5 * s, 0.5 * s); g.lineTo(-0.46 * s, 0.5 * s); g.closePath(); g.fill(); g.fillStyle = c2; g.fillRect(-0.26 * s, -0.5 * s, 0.46 * s, 0.3 * s); rr(g, -0.3 * s, 0.08 * s, 0.6 * s, 0.42 * s, 0.04 * s); g.fill(); g.fillStyle = c; g.fillRect(0.02 * s, -0.46 * s, 0.1 * s, 0.2 * s); },
  projector(g, s, c, c2) { g.fillStyle = c; rr(g, -0.5 * s, -0.3 * s, 0.9 * s, 0.5 * s, 0.1 * s); g.fill(); g.fillStyle = c2; g.beginPath(); g.arc(0.2 * s, -0.05 * s, 0.14 * s, 0, TAU); g.fill(); g.strokeStyle = c; g.lineWidth = 0.07 * s; g.beginPath(); g.moveTo(0.46 * s, -0.2 * s); g.lineTo(0.68 * s, -0.34 * s); g.moveTo(0.46 * s, -0.05 * s); g.lineTo(0.7 * s, -0.05 * s); g.moveTo(0.46 * s, 0.1 * s); g.lineTo(0.68 * s, 0.24 * s); g.stroke(); g.fillRect(-0.4 * s, 0.22 * s, 0.1 * s, 0.1 * s); g.fillRect(0.2 * s, 0.22 * s, 0.1 * s, 0.1 * s); },
  cable(g, s, c, c2) { g.fillStyle = c; rr(g, -0.1 * s, -0.46 * s, 0.5 * s, 0.38 * s, 0.07 * s); g.fill(); g.fillStyle = c2; g.fillRect(0.0 * s, -0.55 * s, 0.1 * s, 0.14 * s); g.fillRect(0.2 * s, -0.55 * s, 0.1 * s, 0.14 * s); g.strokeStyle = c; g.lineWidth = 0.1 * s; g.beginPath(); g.moveTo(0.15 * s, -0.08 * s); g.bezierCurveTo(0.15 * s, 0.3 * s, -0.5 * s, 0.1 * s, -0.5 * s, 0.5 * s); g.stroke(); },
  check(g, s, c) { g.strokeStyle = c; g.lineWidth = 0.17 * s; g.beginPath(); g.moveTo(-0.4 * s, 0.02 * s); g.lineTo(-0.1 * s, 0.32 * s); g.lineTo(0.42 * s, -0.3 * s); g.stroke(); },
  cross(g, s, c) { g.strokeStyle = c; g.lineWidth = 0.17 * s; g.beginPath(); g.moveTo(-0.34 * s, -0.34 * s); g.lineTo(0.34 * s, 0.34 * s); g.moveTo(0.34 * s, -0.34 * s); g.lineTo(-0.34 * s, 0.34 * s); g.stroke(); },
  tablet(g, s, c, c2) { g.fillStyle = c; rr(g, -0.4 * s, -0.52 * s, 0.8 * s, 1.04 * s, 0.1 * s); g.fill(); g.fillStyle = c2; rr(g, -0.32 * s, -0.43 * s, 0.64 * s, 0.82 * s, 0.04 * s); g.fill(); g.fillStyle = c; g.beginPath(); g.arc(0, 0.45 * s, 0.035 * s, 0, TAU); g.fill(); },
  book(g, s, c, c2) { g.fillStyle = c; g.beginPath(); g.moveTo(0, -0.34 * s); g.quadraticCurveTo(-0.28 * s, -0.5 * s, -0.56 * s, -0.4 * s); g.lineTo(-0.56 * s, 0.4 * s); g.quadraticCurveTo(-0.28 * s, 0.3 * s, 0, 0.46 * s); g.closePath(); g.fill(); g.beginPath(); g.moveTo(0, -0.34 * s); g.quadraticCurveTo(0.28 * s, -0.5 * s, 0.56 * s, -0.4 * s); g.lineTo(0.56 * s, 0.4 * s); g.quadraticCurveTo(0.28 * s, 0.3 * s, 0, 0.46 * s); g.closePath(); g.fill(); g.strokeStyle = c2; g.lineWidth = 0.05 * s; g.beginPath(); g.moveTo(-0.4 * s, -0.2 * s); g.lineTo(-0.1 * s, -0.16 * s); g.moveTo(-0.4 * s, 0 * s); g.lineTo(-0.1 * s, 0.04 * s); g.moveTo(0.4 * s, -0.2 * s); g.lineTo(0.1 * s, -0.16 * s); g.moveTo(0.4 * s, 0 * s); g.lineTo(0.1 * s, 0.04 * s); g.stroke(); },
  bubble(g, s, c, c2) { g.fillStyle = c; rr(g, -0.52 * s, -0.42 * s, 1.04 * s, 0.7 * s, 0.2 * s); g.fill(); g.beginPath(); g.moveTo(-0.2 * s, 0.25 * s); g.lineTo(-0.3 * s, 0.54 * s); g.lineTo(0.06 * s, 0.25 * s); g.fill(); g.fillStyle = c2; [-0.24, 0, 0.24].forEach((x) => { g.beginPath(); g.arc(x * s, -0.07 * s, 0.07 * s, 0, TAU); g.fill(); }); },
  bulb(g, s, c, c2) { g.fillStyle = c; g.beginPath(); g.arc(0, -0.1 * s, 0.36 * s, 0, TAU); g.fill(); g.fillRect(-0.15 * s, 0.2 * s, 0.3 * s, 0.1 * s); rr(g, -0.12 * s, 0.34 * s, 0.24 * s, 0.14 * s, 0.05 * s); g.fill(); g.strokeStyle = c2; g.lineWidth = 0.06 * s; g.beginPath(); g.moveTo(-0.12 * s, -0.1 * s); g.lineTo(0, 0.14 * s); g.lineTo(0.12 * s, -0.1 * s); g.stroke(); },
  eye(g, s, c, c2) { g.fillStyle = c; g.beginPath(); g.moveTo(-0.6 * s, 0); g.quadraticCurveTo(0, -0.62 * s, 0.6 * s, 0); g.quadraticCurveTo(0, 0.62 * s, -0.6 * s, 0); g.fill(); g.fillStyle = c2; g.beginPath(); g.arc(0, 0, 0.23 * s, 0, TAU); g.fill(); g.fillStyle = c; g.beginPath(); g.arc(0, 0, 0.1 * s, 0, TAU); g.fill(); },
  magnifier(g, s, c, c2) { g.strokeStyle = c; g.lineWidth = 0.13 * s; g.beginPath(); g.arc(-0.1 * s, -0.1 * s, 0.34 * s, 0, TAU); g.stroke(); g.lineCap = 'round'; g.beginPath(); g.moveTo(0.16 * s, 0.16 * s); g.lineTo(0.5 * s, 0.5 * s); g.stroke(); g.fillStyle = c2; g.globalAlpha = 0.5; g.beginPath(); g.arc(-0.1 * s, -0.1 * s, 0.3 * s, 0, TAU); g.fill(); g.globalAlpha = 1; },
  translate(g, s, c) { g.fillStyle = c; g.font = `900 ${0.9 * s}px Tajawal, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('A', -0.2 * s, -0.12 * s); g.font = `900 ${0.74 * s}px Tajawal, sans-serif`; g.fillText('ع', 0.28 * s, 0.26 * s); },
  image(g, s, c, c2) { g.fillStyle = c; rr(g, -0.52 * s, -0.4 * s, 1.04 * s, 0.8 * s, 0.1 * s); g.fill(); g.fillStyle = c2; g.beginPath(); g.moveTo(-0.46 * s, 0.34 * s); g.lineTo(-0.1 * s, -0.06 * s); g.lineTo(0.12 * s, 0.2 * s); g.lineTo(0.26 * s, 0.04 * s); g.lineTo(0.46 * s, 0.34 * s); g.closePath(); g.fill(); g.beginPath(); g.arc(0.26 * s, -0.18 * s, 0.09 * s, 0, TAU); g.fill(); },
  camera(g, s, c, c2) { g.fillStyle = c; rr(g, -0.52 * s, -0.28 * s, 1.04 * s, 0.76 * s, 0.12 * s); g.fill(); g.fillRect(-0.22 * s, -0.44 * s, 0.4 * s, 0.2 * s); g.fillStyle = c2; g.beginPath(); g.arc(0, 0.1 * s, 0.24 * s, 0, TAU); g.fill(); g.fillStyle = c; g.beginPath(); g.arc(0, 0.1 * s, 0.12 * s, 0, TAU); g.fill(); },
  news(g, s, c, c2) { g.fillStyle = c; rr(g, -0.5 * s, -0.46 * s, 1.0 * s, 0.92 * s, 0.08 * s); g.fill(); g.fillStyle = c2; g.fillRect(-0.38 * s, -0.34 * s, 0.34 * s, 0.3 * s); for (let i = 0; i < 4; i++) g.fillRect(0.02 * s, (-0.34 + i * 0.1) * s, 0.36 * s, 0.05 * s); for (let i = 0; i < 3; i++) g.fillRect(-0.38 * s, (0.1 + i * 0.1) * s, 0.76 * s, 0.05 * s); },
  pinwheel(g, s) { ['#ea4335', '#fbbc05', '#34a853', '#4285f4'].forEach((col, i) => { g.save(); g.rotate(i * Math.PI / 2); g.fillStyle = col; g.beginPath(); g.moveTo(0, 0); g.arc(0, 0, 0.5 * s, -Math.PI / 2, 0.0); g.closePath(); g.globalAlpha = 0.95; g.fill(); g.restore(); }); g.fillStyle = 'rgba(255,255,255,.0)'; },
  bars(g, s, c) { g.fillStyle = c; [[-0.4, 0.1], [-0.1, 0.4], [0.2, 0.7]].forEach(([x, h]) => { rr(g, x * s, (0.5 - h) * s, 0.24 * s, h * s, 0.05 * s); g.fill(); }); },
  wifi(g, s, c) { g.strokeStyle = c; g.lineWidth = 0.1 * s; g.lineCap = 'round'; [0.58, 0.38, 0.18].forEach((r) => { g.beginPath(); g.arc(0, 0.3 * s, r * s, -Math.PI * 0.8, -Math.PI * 0.2); g.stroke(); }); g.fillStyle = c; g.beginPath(); g.arc(0, 0.3 * s, 0.06 * s, 0, TAU); g.fill(); },
  star(g, s, c) { g.fillStyle = c; g.beginPath(); for (let i = 0; i < 8; i++) { const r = i % 2 ? 0.14 * s : 0.52 * s, a = i * Math.PI / 4 - Math.PI / 2; g.lineTo(Math.cos(a) * r, Math.sin(a) * r); } g.closePath(); g.fill(); },
  pin(g, s, c, c2) { g.fillStyle = c; g.beginPath(); g.arc(0, -0.14 * s, 0.34 * s, Math.PI * 0.85, Math.PI * 0.15); g.lineTo(0, 0.56 * s); g.closePath(); g.fill(); g.fillStyle = c2; g.beginPath(); g.arc(0, -0.14 * s, 0.13 * s, 0, TAU); g.fill(); },
  coins(g, s, c, c2) { g.fillStyle = c; g.beginPath(); g.ellipse(0, 0.25 * s, 0.46 * s, 0.2 * s, 0, 0, TAU); g.fill(); g.fillRect(-0.46 * s, -0.05 * s, 0.92 * s, 0.3 * s); g.fillStyle = c2; g.beginPath(); g.ellipse(0, -0.05 * s, 0.46 * s, 0.2 * s, 0, 0, TAU); g.fill(); },
  cap(g, s, c, c2) { g.fillStyle = c; g.beginPath(); g.moveTo(0, -0.42 * s); g.lineTo(0.62 * s, -0.1 * s); g.lineTo(0, 0.22 * s); g.lineTo(-0.62 * s, -0.1 * s); g.closePath(); g.fill(); g.beginPath(); g.moveTo(-0.34 * s, 0.05 * s); g.lineTo(-0.34 * s, 0.34 * s); g.quadraticCurveTo(0, 0.56 * s, 0.34 * s, 0.34 * s); g.lineTo(0.34 * s, 0.05 * s); g.lineTo(0, 0.24 * s); g.closePath(); g.fill(); g.strokeStyle = c2; g.lineWidth = 0.05 * s; g.beginPath(); g.moveTo(0.54 * s, -0.06 * s); g.lineTo(0.54 * s, 0.34 * s); g.stroke(); },
  pencilnote(g, s, c, c2) { g.fillStyle = c; rr(g, -0.42 * s, -0.5 * s, 0.84 * s, 1.0 * s, 0.08 * s); g.fill(); g.strokeStyle = c2; g.lineWidth = 0.06 * s; for (let i = 0; i < 4; i++) { g.beginPath(); g.moveTo(-0.28 * s, (-0.3 + i * 0.22) * s); g.lineTo(0.28 * s, (-0.3 + i * 0.22) * s); g.stroke(); } },
  plus(g, s, c) { g.strokeStyle = c; g.lineWidth = 0.17 * s; g.beginPath(); g.moveTo(-0.4 * s, 0); g.lineTo(0.4 * s, 0); g.moveTo(0, -0.4 * s); g.lineTo(0, 0.4 * s); g.stroke(); },
};
export function glyph(g, kind, x, y, s, c = '#fff', c2 = '#000') {
  g.save(); g.translate(x, y); g.lineCap = 'round'; g.lineJoin = 'round'; (GLYPH[kind] || GLYPH.star)(g, s, c, c2); g.restore();
}

// Wrapped RTL text on a canvas: returns the number of lines drawn. Centered at (cx, cy).
export function paintWrap(g, text, cx, cy, maxW, size, color = '#1f2b36', weight = 800, lh = 1.28, maxLines = 99) {
  g.direction = 'rtl'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = color;
  const words = text.split(' '); let lines;
  for (;;) {
    g.font = `${weight} ${size}px Tajawal, sans-serif`; lines = []; let cur = '';
    for (const w of words) { const t = cur ? cur + ' ' + w : w; if (g.measureText(t).width > maxW && cur) { lines.push(cur); cur = w; } else cur = t; }
    if (cur) lines.push(cur);
    if (lines.length <= maxLines || size < 24) break; size -= 3;
  }
  const y0 = cy - ((lines.length - 1) * size * lh) / 2;
  lines.forEach((l, i) => g.fillText(l, cx, y0 + i * size * lh));
  return lines.length;
}

// Plain canvas material (unlit, true colours)
export const faceMat = (tex, o = {}) => new THREE.MeshBasicMaterial({ map: tex, toneMapped: false, ...o });

// Damped shake offset value (x) for wrong answers: shakeX(age) -> metres
export const shakeX = (age, amp = 0.012) => (age < 0.6 ? Math.sin(age * 46) * amp * Math.exp(-age * 5.5) : 0);

// Expanding fading ring pulse in the page plane (signal waves). pulses(parent) -> {fire(pos,color,size), update(dt)}
export function pulses(parent, n = 10) {
  const items = [];
  const geo = new THREE.RingGeometry(0.92, 1, 48);
  for (let i = 0; i < n; i++) {
    const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false, toneMapped: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending }));
    m.rotation.x = -Math.PI / 2; m.visible = false; m.renderOrder = 5; parent.add(m); items.push({ m, age: 9, size: 0.2, op: 0.7 });
  }
  let k = 0;
  return {
    fire(pos, color = 0xffd27a, size = 0.3, op = 0.7) { const it = items[k++ % n]; it.m.position.copy(pos); it.m.material.color.setHex(color); it.age = 0; it.size = size; it.op = op; it.m.visible = true; },
    update(dt) { for (const it of items) { if (!it.m.visible) continue; it.age += dt; const p = it.age / 1.2; if (p >= 1) { it.m.visible = false; continue; } it.m.scale.setScalar(Math.max(0.001, it.size * ease(p))); it.m.material.opacity = it.op * (1 - p); } },
  };
}
