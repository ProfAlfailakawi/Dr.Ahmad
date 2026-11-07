// Shared helpers for the b7 batch (381, 384, 395, 401, 423, 431).
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { P, ease, easeBack, clamp01, stag, mat, glossy, goldMat, shadowed, glow } from '../../kit.js?v=17';
import { tagSprite, setSpr, lightPool, softLight } from '../../v2/common.js?v=17';

export const TAU = Math.PI * 2;
export const css = (c) => '#' + c.toString(16).padStart(6, '0');
export const toAr = (n) => String(n).replace(/\d/g, (d) => '٠١٢٣٤٥٦٧٨٩'[d]);
export const RB = (w, h, d, r = 0.01) => new RoundedBoxGeometry(w, h, d, 3, Math.min(r, w / 2.01, h / 2.01, d / 2.01));
export const GL = (c, i = 1) => new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: i, roughness: 0.3 });
export const lerp = (a, b, k) => a + (b - a) * k;
export const sm = (x) => { x = clamp01(x); return x * x * (3 - 2 * x); };
export { P, ease, easeBack, clamp01, stag, mat, glossy, goldMat, shadowed, glow, tagSprite, setSpr, lightPool, softLight };

export function shuffle(a, seed = 7) { // deterministic, so captures are stable
  const r = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  const o = a.slice(); for (let i = o.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [o[i], o[j]] = [o[j], o[i]]; } return o;
}

// ---- canvas painting -------------------------------------------------------
export function paintTex(w, h, draw) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const x = c.getContext('2d'); draw(x, w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  t.userData = { c, x, w, h }; return t;
}
const FONT = 'Tajawal, sans-serif';
// wrapped, shrink-to-fit Arabic text centred at (cx,cy) inside maxW x maxH
export function drawText(x, text, cx, cy, maxW, maxH, { size = 64, weight = 800, color = '#2b2620', lineH = 1.3 } = {}) {
  x.direction = 'rtl'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillStyle = color;
  let s = size, lines = [];
  for (let k = 0; k < 12; k++) {
    x.font = `${weight} ${s}px ${FONT}`; lines = [];
    let line = '';
    for (const wd of String(text).split(' ')) { const t = line ? line + ' ' + wd : wd; if (x.measureText(t).width > maxW && line) { lines.push(line); line = wd; } else line = t; }
    lines.push(line);
    if (lines.length * s * lineH <= maxH && lines.every((l) => x.measureText(l).width <= maxW * 1.02)) break;
    s *= 0.9;
  }
  const y0 = cy - ((lines.length - 1) * s * lineH) / 2;
  lines.forEach((l, i) => x.fillText(l, cx, y0 + i * s * lineH));
}
export function rr(x, px, py, w, h, r) { x.beginPath(); x.roundRect(px, py, w, h, r); }

// A rounded slab with text painted on its top face (lies flat; rotate the group to stand it up).
export function textPlate(text, { w = 0.2, h = 0.07, th = 0.012, color = 0xf6efdf, fg = '#2b2620', fs = 64, rim = 0xd4ad55, px = 1600, r = 0.014 } = {}) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(RB(w, th, h, r), glossy(color, { roughness: 0.4, clearcoat: 0.5 })); body.position.y = th / 2; g.add(body);
  if (rim != null) { const rm = new THREE.Mesh(RB(w + 0.004, th * 0.28, h + 0.004, r), goldMat()); rm.position.y = th * 0.5; g.add(rm); }
  const W = Math.round(w * px), H = Math.round(h * px);
  const draw = (t) => (x) => { x.clearRect(0, 0, W, H); drawText(x, t, W / 2, H / 2, W * 0.88, H * 0.8, { size: fs, color: fg }); };
  const tex = paintTex(W, H, draw(text));
  const face = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.98, h * 0.98), new THREE.MeshBasicMaterial({ map: tex, transparent: true, toneMapped: false, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
  face.rotation.x = -Math.PI / 2; face.position.y = th + 0.0008; g.add(face);
  g.userData.setText = (t) => { draw(t)(tex.userData.x); tex.needsUpdate = true; };
  g.userData.tex = tex;
  return shadowed(g);
}

// ---- shell ---------------------------------------------------------------------
export function scene(ctx, meta, K = 1) {
  const g = new THREE.Group(); g.position.copy(P(meta.center[0], meta.center[1])); ctx.stage.add(g);
  const parts = [], pulses = [], tags = [], loops = [];
  const S = {
    g, now: 0, ctx,
    part(obj, delay = 0, { dur = 0.9, rise = 0.05 } = {}) {
      parts.push({ obj, delay, dur, rise, y0: obj.position.y, s0: obj.scale.clone() });
      obj.scale.setScalar(0.0001); return obj;
    },
    touch(obj, fn, { color = 0xffd27a, size = 0.12, at = null, wake = 5, quiet = false } = {}) {
      const s = glow(color, size, 0.0); s.renderOrder = 8; s.material.depthTest = false;
      if (at) s.position.copy(at); obj.add(s);
      const rec = { s, size, wake, base: 0.34, ph: Math.random() * 6, on: !quiet, k: 0 };
      pulses.push(rec);
      ctx.tap(obj, () => { ctx.sfx.pop?.(); fn(obj, rec); });
      return rec;
    },
    tag(text, color, w = 0.17, o = {}) {
      const s = tagSprite(text, w, color, o); s.material.depthTest = false; s.renderOrder = 9; s.visible = false; g.add(s);
      const rec = { s, w, k: 0, tk: 1, sp: 5, delay: 99 }; tags.push(rec); return rec;
    },
    loop(fn) { loops.push(fn); },
    burst(pos, color = 0xffd27a, n = 24, sp = 0.5, size = 0.035) { ctx.fx.burst(g.position.clone().add(pos), color, n, sp, size); },
    update(t, dt, e) {
      S.now = t;
      g.scale.setScalar(Math.max(e, 0.001) * K);
      for (const p of parts) {
        const k = stag(t, p.delay, p.dur, easeBack) * e;
        p.obj.scale.copy(p.s0).multiplyScalar(Math.max(k, 0.0001)); p.obj.position.y = p.y0 + p.rise * (1 - clamp01(k)); p.obj.visible = k > 0.002;
      }
      for (const r of pulses) {
        r.k = THREE.MathUtils.damp(r.k, r.on && t > r.wake ? 1 : 0, 4, dt);
        const b = r.base * (0.65 + 0.35 * Math.sin(t * 2.4 + r.ph));
        r.s.material.opacity = b * r.k; r.s.scale.setScalar(r.size * (0.9 + 0.12 * Math.sin(t * 2.4 + r.ph)));
        r.s.visible = r.k > 0.01;
      }
      for (const r of tags) {
        r.k = THREE.MathUtils.damp(r.k, t > r.delay ? r.tk * e : 0, r.sp, dt);
        r.s.visible = r.k > 0.03; setSpr(r.s, r.w, Math.min(r.k, 1));
      }
      for (const f of loops) f(t, dt, e);
    },
  };
  return S;
}

let _sh;
export function contactShadow(w = 0.1, d = 0.1, o = 0.35) {
  if (!_sh) { const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d'); const gr = x.createRadialGradient(64, 64, 4, 64, 64, 64); gr.addColorStop(0, 'rgba(30,22,10,.85)'); gr.addColorStop(0.5, 'rgba(30,22,10,.35)'); gr.addColorStop(1, 'rgba(30,22,10,0)'); x.fillStyle = gr; x.fillRect(0, 0, 128, 128); _sh = new THREE.CanvasTexture(c); }
  const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: _sh, transparent: true, depthWrite: false, opacity: o, toneMapped: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
  m.rotation.x = -Math.PI / 2; m.scale.set(w, d, 1); m.position.y = 0.0015; m.renderOrder = 1; return m;
}

// Round plinth with a finished underside and a gold rim. Top surface at y = h (+0.003).
export function plinth(r = 0.4, { color = 0xf6efdf, rim = true, h = 0.022 } = {}) {
  const g = new THREE.Group();
  const pts = [[0, 0], [r * 0.45, 0], [r * 0.78, 0.004], [r * 0.95, 0.011], [r, 0.017], [r, h], [r * 0.985, h + 0.003], [0, h + 0.003]].map(([x, y]) => new THREE.Vector2(x, y));
  g.add(new THREE.Mesh(new THREE.LatheGeometry(pts, 72), glossy(color, { roughness: 0.4, clearcoat: 0.6 })));
  const under = new THREE.Mesh(new THREE.CircleGeometry(r * 0.46, 40), mat(0x3a332b)); under.rotation.x = Math.PI / 2; under.position.y = -0.0006; g.add(under);
  if (rim) { const ring = new THREE.Mesh(new THREE.TorusGeometry(r * 0.985, 0.0055, 10, 90), goldMat()); ring.rotation.x = Math.PI / 2; ring.position.y = h + 0.002; g.add(ring); }
  return shadowed(g);
}

export function burstAt(S, obj, color, n = 24, sp = 0.5, size = 0.035) {
  const v = new THREE.Vector3(); obj.getWorldPosition(v); S.ctx.stage.worldToLocal(v); v.sub(S.g.position); S.burst(v, color, n, sp, size);
}

// Upright double-faced sign with painted Arabic text (rotate.y to face the viewer). userData.set(text) repaints.
export function sign(w, h, text, { color = '#f6efdf', fg = '#2b2620', border = '#d4ad55', fs = 64, px = 1500, r = 0.28 } = {}) {
  const W = Math.round(w * px), H = Math.round(h * px);
  const draw = (t, bd) => (x) => { x.clearRect(0, 0, W, H); x.beginPath(); x.roundRect(5, 5, W - 10, H - 10, H * r); x.fillStyle = color; x.fill(); x.lineWidth = 7; x.strokeStyle = bd || border; x.stroke(); drawText(x, t, W / 2, H / 2, W * 0.86, H * 0.74, { size: fs, color: fg }); };
  const tex = paintTex(W, H, draw(text));
  const g = new THREE.Group();
  const mk = (ry) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex, transparent: true, toneMapped: false, side: THREE.FrontSide })); m.rotation.y = ry; m.position.z = ry ? -0.0015 : 0.0015; return m; };
  g.add(mk(0)); g.add(mk(Math.PI));
  g.userData.set = (t, bd) => { draw(t, bd)(tex.userData.x); tex.needsUpdate = true; };
  return g;
}

// local rotation.y that makes an upright child of `g` face the camera, whatever the stage's own yaw is
const _fa = new THREE.Vector3(), _fb = new THREE.Vector3();
export function faceYaw(g, cam) {
  cam.getWorldPosition(_fa); g.getWorldPosition(_fb);
  const e = g.matrixWorld.elements;
  return Math.atan2(_fa.x - _fb.x, _fa.z - _fb.z) - Math.atan2(e[8], e[10]);
}
