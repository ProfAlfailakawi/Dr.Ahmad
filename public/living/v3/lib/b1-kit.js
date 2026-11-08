// b1 helpers: painted glyph medallions, a tiny tween list, bust figure, shake.
import * as THREE from 'three';
import { mat, glossy, goldMat, glow, ease, clamp01 } from '../../kit.js?v=22';
import { canvasTexture, css, TAU } from './a1-kit.js?v=22';

// draw a bold line glyph on a 2D canvas context, centred in a w*w box
export function drawGlyph(g, key, w, col) {
  const c = w / 2, s = w / 100;
  g.save(); g.translate(c, c); g.scale(s, s);
  g.strokeStyle = col; g.fillStyle = col; g.lineWidth = 7; g.lineCap = 'round'; g.lineJoin = 'round';
  const line = (pts, close) => { g.beginPath(); pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); if (close) g.closePath(); g.stroke(); };
  const circ = (x, y, r, fill) => { g.beginPath(); g.arc(x, y, r, 0, TAU); fill ? g.fill() : g.stroke(); };
  const rr = (x, y, ww, hh, r, fill) => { g.beginPath(); g.roundRect(x, y, ww, hh, r); fill ? g.fill() : g.stroke(); };
  switch (key) {
    case 'target': circ(0, 0, 34); circ(0, 0, 19); circ(0, 0, 5, 1); line([[10, -10], [38, -38]]); break;
    case 'ruler': g.rotate(-0.5); rr(-38, -14, 76, 28, 5); for (let i = -2; i <= 2; i++) line([[i * 14, -14], [i * 14, i % 2 ? -3 : 3]]); break;
    case 'medal': circ(0, -6, 24); line([[-12, 16], [-20, 40], [0, 30], [20, 40], [12, 16]]); circ(0, -6, 8, 1); break;
    case 'laptop': rr(-30, -28, 60, 40, 5); line([[-40, 22], [40, 22]]); line([[-30, 12], [-40, 22]]); line([[30, 12], [40, 22]]); break;
    case 'link': g.rotate(-0.6); rr(-40, -13, 44, 26, 13); rr(-4, -13, 44, 26, 13); break;
    case 'book': line([[0, -26], [0, 30]]); g.beginPath(); g.moveTo(0, -22); g.quadraticCurveTo(-18, -34, -38, -26); g.lineTo(-38, 26); g.quadraticCurveTo(-18, 18, 0, 30); g.quadraticCurveTo(18, 18, 38, 26); g.lineTo(38, -26); g.quadraticCurveTo(18, -34, 0, -22); g.stroke(); break;
    case 'sound': rr(-38, -12, 18, 24, 3, 1); line([[-22, -12], [-4, -30], [-4, 30], [-22, 12]], 1); [14, 26].forEach((r, i) => { g.beginPath(); g.arc(2, 0, r, -0.9, 0.9); g.stroke(); }); break;
    case 'pic': rr(-38, -30, 76, 60, 7); circ(-16, -10, 7, 1); g.beginPath(); g.moveTo(-34, 26); g.lineTo(-8, 2); g.lineTo(8, 16); g.lineTo(20, 4); g.lineTo(36, 24); g.stroke(); break;
    case 'play': rr(-38, -28, 76, 56, 10); g.beginPath(); g.moveTo(-9, -14); g.lineTo(15, 0); g.lineTo(-9, 14); g.closePath(); g.fill(); break;
    case 'bulb': circ(0, -8, 24); line([[-10, 24], [10, 24]]); line([[-7, 33], [7, 33]]); line([[-8, 16], [-8, 5]]); line([[8, 16], [8, 5]]); break;
    case 'wires': circ(-26, -20, 8, 1); circ(26, -20, 8, 1); circ(0, 24, 8, 1); g.beginPath(); g.moveTo(-26, -20); g.bezierCurveTo(-10, 0, 10, 0, 26, -20); g.moveTo(0, 24); g.bezierCurveTo(-4, 8, -10, 0, -10, 0); g.stroke(); break;
    case 'drop': g.beginPath(); g.moveTo(0, -38); g.bezierCurveTo(30, -4, 34, 14, 22, 28); g.bezierCurveTo(10, 40, -10, 40, -22, 28); g.bezierCurveTo(-34, 14, -30, -4, 0, -38); g.fill(); break;
    case 'knee': line([[-4, -38], [-4, -8]]); line([[4, 8], [4, 38]]); circ(0, 0, 14); g.beginPath(); g.moveTo(-36, 30); g.lineTo(-36, 40); g.stroke(); rr(-40, -34, 20, 8, 3); break;
    case 'bike': circ(-24, 14, 18); circ(24, 14, 18); line([[-24, 14], [-6, -14], [16, -14], [24, 14]]); line([[-6, -14], [4, 14], [-24, 14]]); line([[16, -14], [12, -28], [22, -28]]); break;
    case 'tread': rr(-40, 14, 80, 14, 7); line([[-30, 14], [-22, 6]]); circ(-2, -28, 8, 1); line([[-2, -18], [4, 4]]); line([[4, 4], [-8, 14]]); line([[-2, -12], [12, -2]]); line([[-2, -12], [-14, -2]]); break;
    case 'list': [-22, 0, 22].forEach((y) => { circ(-30, y, 4, 1); line([[-16, y], [36, y]]); }); break;
    case 'flame': g.beginPath(); g.moveTo(0, -42); g.bezierCurveTo(30, -10, 34, 8, 26, 24); g.bezierCurveTo(18, 40, -18, 40, -26, 24); g.bezierCurveTo(-32, 8, -18, -4, -8, -12); g.bezierCurveTo(-6, -2, 0, 0, 0, -42); g.fill(); break;
    case 'gauge': g.beginPath(); g.arc(0, 12, 36, Math.PI, TAU); g.stroke(); line([[0, 12], [20, -10]]); circ(0, 12, 6, 1); break;
    case 'registry': rr(-30, -34, 60, 68, 7); [-16, 0, 16].forEach((y) => line([[-18, y], [18, y]])); break;
    case 'rec': rr(-38, -22, 52, 44, 8); g.beginPath(); g.moveTo(18, -4); g.lineTo(40, -18); g.lineTo(40, 18); g.lineTo(18, 4); g.closePath(); g.fill(); break;
    case 'pulse': line([[-42, 4], [-22, 4], [-12, -26], [2, 30], [14, -8], [20, 4], [42, 4]]); break;
    case 'route': circ(-26, 22, 7, 1); g.beginPath(); g.moveTo(-26, 22); g.bezierCurveTo(-30, -20, 24, 30, 26, -18); g.stroke(); circ(26, -26, 9); break;
    case 'scale': line([[0, -34], [0, 30]]); line([[-34, -22], [34, -22]]); line([[-34, -22], [-44, 6], [-24, 6]], 1); line([[34, -22], [24, 6], [44, 6]], 1); line([[-16, 32], [16, 32]]); break;
    case 'phone': rr(-20, -36, 40, 72, 9); line([[-6, 26], [6, 26]]); break;
    case 'heart': g.beginPath(); g.moveTo(0, 32); g.bezierCurveTo(-48, -2, -26, -40, 0, -16); g.bezierCurveTo(26, -40, 48, -2, 0, 32); g.stroke(); break;
    case 'chat': rr(-38, -28, 76, 46, 14); line([[-16, 18], [-22, 36], [0, 18]]); break;
    case 'alert': line([[0, -36], [38, 28], [-38, 28]], 1); line([[0, -12], [0, 8]]); circ(0, 19, 2, 1); break;
    case 'family': circ(-20, -16, 9, 1); circ(20, -16, 9, 1); circ(0, 2, 7, 1); line([[-34, 34], [-20, 4], [-6, 34]]); line([[6, 34], [20, 4], [34, 34]]); break;
    case 'clock': circ(0, 0, 36); line([[0, 0], [0, -20]]); line([[0, 0], [16, 8]]); break;
    case 'tv': rr(-38, -26, 76, 46, 8); line([[-14, -34], [0, -26], [14, -34]]); line([[-16, 30], [16, 30]]); break;
    case 'papers': rr(-26, -34, 46, 58, 4); rr(-12, -26, 46, 58, 4); line([[-2, -12], [22, -12]]); line([[-2, 0], [22, 0]]); break;
    case 'person': circ(0, -18, 14); line([[-28, 36], [-28, 12], [28, 12], [28, 36]]); break;
    case 'sat': g.rotate(-0.6); rr(-14, -34, 28, 22, 4); line([[-14, -23], [-38, -23]]); line([[14, -23], [38, -23]]); line([[0, -12], [0, 4]]); g.beginPath(); g.arc(0, 4, 26, 0.2, Math.PI - 0.2); g.stroke(); break;
    case 'hall': rr(-34, -10, 68, 40, 4); line([[-40, -10], [0, -34], [40, -10]]); line([[-8, 30], [-8, 12], [8, 12], [8, 30]]); break;
    case 'twoline': circ(-28, 0, 10); circ(28, 0, 10); line([[-18, 0], [18, 0]]); break;
    case 'bank': [[-24, -26], [-24, -6], [-24, 14]].forEach(([x, y]) => { g.beginPath(); g.ellipse(0, y, 30, 9, 0, 0, TAU); g.stroke(); }); line([[-30, -22], [-30, 14]]); line([[30, -22], [30, 14]]); break;
    case 'drawer': rr(-30, -34, 60, 68, 5); line([[-30, 0], [30, 0]]); line([[-8, -17], [8, -17]]); line([[-8, 17], [8, 17]]); break;
    case 'calendar': rr(-34, -28, 68, 62, 7); line([[-34, -10], [34, -10]]); line([[-18, -38], [-18, -22]]); line([[18, -38], [18, -22]]); circ(0, 14, 5, 1); break;
    case 'hourglass': line([[-24, -36], [24, -36], [-24, 36], [24, 36]], 1); line([[-28, -36], [28, -36]]); line([[-28, 36], [28, 36]]); break;
    case 'check': line([[-30, 4], [-10, 24], [32, -24]]); break;
    case 'cross': line([[-26, -26], [26, 26]]); line([[26, -26], [-26, 26]]); break;
    default: circ(0, 0, 26);
  }
  g.restore();
}

const texCache = new Map();
export function glyphTex(key, fg = '#2b2620', bg = '#fbf7ee', ring = null) {
  const id = key + fg + bg + ring;
  if (!texCache.has(id)) texCache.set(id, canvasTexture(256, 256, (g, w) => {
    if (bg) { g.fillStyle = bg; g.fillRect(0, 0, w, w); }
    if (ring) { g.strokeStyle = ring; g.lineWidth = 10; g.beginPath(); g.arc(w / 2, w / 2, w / 2 - 14, 0, TAU); g.stroke(); }
    drawGlyph(g, key, w * 0.74, fg);
  }));
  return texCache.get(id);
}

// round medallion lying flat (face up): coloured body, gold rim, painted glyph
export function medal(key, color, r = 0.05, { th = 0.016, bg = '#fbf7ee', fg = null, upright = false } = {}) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 0.96, th, 40), glossy(color, { roughness: 0.3 }));
  const rim = new THREE.Mesh(new THREE.TorusGeometry(r, th * 0.33, 8, 48), goldMat()); rim.rotation.x = Math.PI / 2;
  const face = new THREE.Mesh(new THREE.CircleGeometry(r * 0.84, 40), new THREE.MeshStandardMaterial({ map: glyphTex(key, fg || css(color), bg), roughness: 0.4 }));
  face.rotation.x = -Math.PI / 2; face.position.y = th / 2 + 0.0006;
  const back = face.clone(); back.rotation.x = Math.PI / 2; back.position.y = -th / 2 - 0.0006; back.material = mat(color, { roughness: 0.4 });
  g.add(body, rim, face, back);
  g.userData.face = face; g.userData.body = body;
  if (upright) { const o = new THREE.Group(); g.rotation.x = Math.PI / 2; o.add(g); o.userData = g.userData; return o; }
  return g;
}

// bust: shoulders lathe + head
export function bust(color, h = 0.2) {
  const g = new THREE.Group();
  const prof = [[0.001, 0], [h * 0.3, 0], [h * 0.4, h * 0.05], [h * 0.42, h * 0.16], [h * 0.34, h * 0.3], [h * 0.14, h * 0.38], [h * 0.07, h * 0.46], [0.001, h * 0.47]].map(([x, y]) => new THREE.Vector2(x, y));
  const body = new THREE.Mesh(new THREE.LatheGeometry(prof, 40), glossy(color, { roughness: 0.3 }));
  const head = new THREE.Mesh(new THREE.SphereGeometry(h * 0.2, 32, 24), glossy(0xf4efe6, { roughness: 0.3 }));
  head.scale.set(0.9, 1.12, 0.95); head.position.y = h * 0.67;
  const band = new THREE.Mesh(new THREE.TorusGeometry(h * 0.18, h * 0.012, 8, 40), goldMat()); band.rotation.x = Math.PI / 2; band.position.y = h * 0.67 + h * 0.02;
  g.add(body, head, band); g.userData.head = head; return g;
}

// tiny tween list
export function tweener() {
  const L = [];
  return {
    go(dur, fn, delay = 0, done) { L.push({ dur, fn, t: -delay, done }); },
    update(dt) { for (let i = L.length - 1; i >= 0; i--) { const a = L[i]; a.t += dt; if (a.t < 0) continue; const k = clamp01(a.t / a.dur); a.fn(k); if (k >= 1) { L.splice(i, 1); a.done?.(); } } },
  };
}

export const shakeX = (t0, now, amp = 0.012) => { const k = now - t0; return k >= 0 && k < 0.45 ? Math.sin(k * 60) * amp * (1 - k / 0.45) : 0; };
export { ease };
