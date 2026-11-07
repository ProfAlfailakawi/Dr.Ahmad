// Shared helpers of the builder "a4" (pages 237-275): rise-in sequencer, touch halos, ring dais, tags, motes.
import * as THREE from 'three';
import { ease, easeBack, clamp01, stag, mat, goldMat, glow } from '../../kit.js?v=15';
import { tagSprite, solidTag, setSpr } from '../../v2/common.js?v=15';

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
// A label whose text can change (tapped-item tags, counters). w0 only matters with o.fixed.
export function liveTag(w0, color, o = {}) {
  const holder = { sp: null, text: '', w: w0, color, o, k: 0 };
  holder.set = (text, col = holder.color) => {
    if (holder.text === text && col === holder.color && holder.sp) return;
    holder.text = text; holder.color = col;
    const fresh = fitTag(text, col, { ...o, fixed: o.fixed ? w0 : 0 });
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
