// pcover — the cover of the book lifts off the paper like a pop-up: the picture the camera sees rises in three layers of depth,
// a line of gold light draws its frame, then the title forms in the air above it. Works with ANY cover (the picture comes from the camera).
import * as THREE from 'three';
import { P, ease, easeBack, clamp01, glow, glowTexture, fontsReady, PAGE_H } from '../../kit.js?v=24';

export const meta = { free: true, center: [0.5, 0.5], typeLabel: 'الغلاف' };

const H = PAGE_H, NX = 20, NZ = 26;
const SC = 0.7;            // final width of the floating cover (page widths)
const Y0 = 0.11, ZC = 0.07; // hover height and shift toward the reader
const RAD = 0.03, RIM = 0.008, WALL = 0.011;
const T_RISE = 0.9, D_RISE = 1.7, T_RIM = 2.3, D_RIM = 1.6, T_TITLE = 3.1, D_TITLE = 1.8, T_SUB = 4.3, D_SUB = 1.2, T_IDLE = 6.2, PER = 6.5;
const TITLE = 'موسوعة تكنولوجيا التعليم', SUB = 'الموسوعة الحيّة';
const GOLD = 0xe9b94f;

// ---------------------------------------------------------------- small canvas helpers
const cv = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
const dataTex = (c) => { const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.NoColorSpace; return t; };

// Soft rounded-rectangle mask (white inside) for a surface of size sw x sh world units.
function softRect(pw, ph, sw, sh, insetX, insetZ, rad, feather) {
  const c = cv(pw, ph), g = c.getContext('2d'), im = g.createImageData(pw, ph), hx = sw / 2 - insetX, hz = sh / 2 - insetZ;
  for (let j = 0; j < ph; j++) for (let i = 0; i < pw; i++) {
    const X = ((i + 0.5) / pw - 0.5) * sw, Z = ((j + 0.5) / ph - 0.5) * sh;
    const qx = Math.abs(X) - hx + rad, qz = Math.abs(Z) - hz + rad;
    const d = Math.hypot(Math.max(qx, 0), Math.max(qz, 0)) + Math.min(Math.max(qx, qz), 0) - rad;
    const k = clamp01((d + feather) / (2 * feather)), a = 1 - k * k * (3 - 2 * k), o = (j * pw + i) * 4;
    im.data[o] = im.data[o + 1] = im.data[o + 2] = Math.round(a * 255); im.data[o + 3] = 255;
  }
  g.putImageData(im, 0, 0);
  return dataTex(c);
}

// The neutral cover plate (no camera): midnight blue, gold lattice star. Also used for the back of the sheet.
function plate(w, h, back) {
  const c = cv(w, h), g = c.getContext('2d');
  const bg = g.createLinearGradient(0, 0, w, h);
  bg.addColorStop(0, back ? '#0b1730' : '#16294d'); bg.addColorStop(1, back ? '#13264a' : '#0c1936');
  g.fillStyle = bg; g.fillRect(0, 0, w, h);
  const cx = w / 2, cy = h / 2, R = w * 0.34;
  g.strokeStyle = 'rgba(233,185,79,0.16)'; g.lineWidth = 2;
  for (let i = -h; i < w + h; i += w / 11) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i + h, h); g.stroke(); g.beginPath(); g.moveTo(i, h); g.lineTo(i + h, 0); g.stroke(); }
  const star = (r, rot, lw, a) => {
    g.strokeStyle = `rgba(240,196,92,${a})`; g.lineWidth = lw;
    for (let k = 0; k < 2; k++) { g.beginPath(); for (let i = 0; i < 4; i++) { const t = rot + k * Math.PI / 4 + i * Math.PI / 2, x = cx + Math.cos(t) * r * 1.0 * Math.SQRT2 / 1, y = cy + Math.sin(t) * r * Math.SQRT2; i ? g.lineTo(x, y) : g.moveTo(x, y); } g.closePath(); g.stroke(); }
  };
  g.save(); g.translate(0, 0);
  const rg = g.createRadialGradient(cx, cy, 0, cx, cy, R * 1.5); rg.addColorStop(0, 'rgba(240,196,92,0.30)'); rg.addColorStop(1, 'rgba(240,196,92,0)');
  g.fillStyle = rg; g.fillRect(0, 0, w, h);
  [1, 0.8, 0.6, 0.42].forEach((f, i) => star(R * f, Math.PI / 4, i ? 3 : 5, i ? 0.8 : 1));
  g.strokeStyle = 'rgba(240,196,92,0.9)'; g.lineWidth = 3;
  [R * 1.22, R * 1.3].forEach((r) => { g.beginPath(); g.arc(cx, cy, r, 0, 7); g.stroke(); });
  g.fillStyle = '#f0c45c'; g.beginPath(); g.arc(cx, cy, R * 0.09, 0, 7); g.fill();
  g.restore();
  const m = w * 0.045;
  g.strokeStyle = '#f0c45c'; g.lineWidth = 5; g.strokeRect(m, m, w - 2 * m, h - 2 * m);
  g.lineWidth = 2; g.strokeRect(m * 1.55, m * 1.55, w - 3.1 * m, h - 3.1 * m);
  for (const [x, y] of [[m * 2.2, m * 2.2], [w - m * 2.2, m * 2.2], [m * 2.2, h - m * 2.2], [w - m * 2.2, h - m * 2.2]]) { g.beginPath(); g.arc(x, y, 9, 0, 7); g.fill(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}

// Title lettering, gold with a dark outline so it reads on any background.
function drawText(c, text, maxPx, weight, grad) {
  const g = c.getContext('2d'), w = c.width, h = c.height;
  g.clearRect(0, 0, w, h); g.direction = 'rtl'; g.textAlign = 'center'; g.textBaseline = 'middle';
  let px = maxPx;
  for (; px > 20; px -= 4) { g.font = `${weight} ${px}px "Reem Kufi", Tajawal, sans-serif`; if (g.measureText(text).width < w * 0.92) break; }
  const y = h * 0.54;
  g.lineJoin = 'round';
  g.shadowColor = 'rgba(20,12,0,0.55)'; g.shadowBlur = px * 0.12; g.shadowOffsetY = px * 0.05;
  g.strokeStyle = '#3b2a0c'; g.lineWidth = px * 0.1; g.strokeText(text, w / 2, y);
  g.shadowColor = 'transparent';
  const gr = g.createLinearGradient(0, y - px * 0.55, 0, y + px * 0.55);
  grad.forEach(([s, col]) => gr.addColorStop(s, col));
  g.fillStyle = gr; g.fillText(text, w / 2, y);
}

// ---------------------------------------------------------------- shaders
const TXT_V = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }';
const TXT_F = `uniform sampler2D map; uniform float uP; uniform float uG; uniform float uMode; uniform vec3 uTint; uniform float uOp; varying vec2 vUv;
void main(){
  float x = 1.0 - vUv.x;
  float fr = uP * 1.35 - 0.2;
  float rv = clamp((fr - x) / 0.22, 0.0, 1.0);
  vec2 uv = vUv; uv.y -= (1.0 - rv) * 0.2 * (0.5 + 0.5 * sin(x * 37.0));
  vec4 c = texture2D(map, uv);
  float a = c.a * rv * uOp;
  if (a < 0.004) discard;
  vec3 col = mix(c.rgb, uTint, uMode);
  float band = exp(-pow((fr - x - 0.03) / 0.05, 2.0));
  float gl = exp(-pow((uG - (x * 0.8 + vUv.y * 0.25)) / 0.06, 2.0));
  col += (band * 1.2 + gl * 0.85) * (1.0 - uMode) * vec3(1.0, 0.92, 0.62);
  gl_FragColor = vec4(col, a);
}`;
const RIM_V = 'attribute float aS; attribute float aRow; varying float vS; varying float vRow; void main(){ vS = aS; vRow = aRow; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }';
const RIM_F = `uniform float uHead; uniform float uGl; varying float vS; varying float vRow;
void main(){
  vec3 base = vRow < 0.5 ? vec3(1.0, 0.82, 0.40) : (vRow < 1.5 ? vec3(0.92, 0.71, 0.29) : vec3(0.52, 0.37, 0.12));
  float lit = smoothstep(uHead, uHead - 0.012, vS);
  float head = exp(-pow((vS - uHead) / 0.022, 2.0)) * step(vS, uHead + 0.04);
  float d = abs(vS - uGl); d = min(d, 1.0 - d);
  float gl = exp(-pow(d / 0.04, 2.0));
  vec3 col = base + head * vec3(0.9, 0.85, 0.6) + gl * vec3(0.8, 0.75, 0.5);
  float a = clamp(lit + head, 0.0, 1.0);
  if (a < 0.01) discard;
  gl_FragColor = vec4(col, a);
}`;

export default function build(ctx) {
  const g = new THREE.Group(); g.position.copy(P(0.5, 0.5)); ctx.stage.add(g);
  const smallBox = new THREE.Box3(new THREE.Vector3(-0.02, 0, -0.02), new THREE.Vector3(0.02, 0.01, 0.02));
  const lowBounds = (geo) => { geo.boundingBox = smallBox.clone(); geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 0.03); };

  // ---- floating group and the cover block (spins on tap)
  const fl = new THREE.Group(); g.add(fl);
  const cover = new THREE.Group(); fl.add(cover);

  // ---- the sheet: one deformable grid shared by the layers
  const NV = (NX + 1) * (NZ + 1), bx = new Float32Array(NV), bz = new Float32Array(NV);
  const pos = new Float32Array(NV * 3), uv0 = new Float32Array(NV * 2), uv1 = new Float32Array(NV * 2), idx = [];
  for (let j = 0; j <= NZ; j++) for (let i = 0; i <= NX; i++) {
    const n = j * (NX + 1) + i; bx[n] = i / NX - 0.5; bz[n] = (j / NZ - 0.5) * H;
    uv1[n * 2] = i / NX; uv1[n * 2 + 1] = 1 - j / NZ; uv0[n * 2] = uv1[n * 2]; uv0[n * 2 + 1] = uv1[n * 2 + 1];
  }
  for (let j = 0; j < NZ; j++) for (let i = 0; i < NX; i++) { const a = j * (NX + 1) + i, b = a + 1, c = a + NX + 1, d = c + 1; idx.push(a, c, b, b, c, d); }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
  geo.setAttribute('uv', new THREE.BufferAttribute(uv0, 2));
  geo.setAttribute('uv1', new THREE.BufferAttribute(uv1, 2));
  geo.setIndex(idx);
  geo.boundingBox = new THREE.Box3(new THREE.Vector3(-0.5 * SC, 0, -0.5 * H * SC), new THREE.Vector3(0.5 * SC, 0.08, 0.5 * H * SC));
  geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1);

  // masks (page uv)
  const mA = softRect(384, 470, 1, H, 0, 0, RAD, 0.004), mB = softRect(128, 156, 1, H, 0.085, 0.085, 0.07, 0.04), mC = softRect(128, 156, 1, H, 0.19, 0.19, 0.12, 0.05);
  [mA, mB, mC].forEach((t) => { t.channel = 1; });
  const backTex = plate(512, 626, true); backTex.channel = 1;

  const fallback = plate(720, 880, false);
  const state = { tex: fallback, real: false };
  const lay = (color, mask, soft, order) => {
    const m = new THREE.MeshBasicMaterial({ map: fallback, color, alphaMap: mask, toneMapped: false, transparent: soft, depthWrite: !soft, alphaTest: soft ? 0 : 0.5 });
    const mesh = new THREE.Mesh(geo, m); mesh.renderOrder = order; mesh.frustumCulled = false; cover.add(mesh); return mesh;
  };
  const LA = lay(0xf0f0f0, mA, false, 2), LB = lay(0xf8f8f8, mB, true, 4), LC = lay(0xffffff, mC, true, 6);
  const OFF_B = 0.032, OFF_C = 0.064;
  const backMat = new THREE.MeshBasicMaterial({ map: backTex, alphaMap: mA, side: THREE.BackSide, toneMapped: false, alphaTest: 0.5 });
  const back = new THREE.Mesh(geo, backMat); back.renderOrder = 2; back.frustumCulled = false; cover.add(back);

  // glint over the sheet
  const gc = cv(256, 256), gx = gc.getContext('2d');
  gx.setTransform(1, 0, -0.5, 1, 128 * 0.5, 0);
  const gg = gx.createLinearGradient(100, 0, 156, 0); gg.addColorStop(0, 'rgba(255,236,170,0)'); gg.addColorStop(0.5, 'rgba(255,244,205,0.75)'); gg.addColorStop(1, 'rgba(255,236,170,0)');
  gx.fillStyle = gg; gx.fillRect(60, 0, 140, 256);
  const glintTex = new THREE.CanvasTexture(gc); glintTex.channel = 1; glintTex.colorSpace = THREE.SRGBColorSpace;
  const glint = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: glintTex, alphaMap: mA, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, opacity: 0 }));
  glint.renderOrder = 8; glint.frustumCulled = false; cover.add(glint);

  // gold rim: a bevelled strip around the rounded rectangle that deforms with the sheet
  const NP = 120, px = new Float32Array(NP + 1), pz = new Float32Array(NP + 1), pnx = new Float32Array(NP + 1), pnz = new Float32Array(NP + 1), ps = new Float32Array(NP + 1);
  {
    const hx = 0.5 - RAD, hz = H / 2 - RAD, pts = [];
    const arc = (cx, cz, a0) => { for (let k = 0; k < 8; k++) { const a = a0 + (k / 7) * Math.PI / 2; pts.push([cx + Math.cos(a) * RAD, cz + Math.sin(a) * RAD, Math.cos(a), Math.sin(a)]); } };
    const seg = (x0, z0, x1, z1, nx, nz) => { for (let k = 1; k < 21; k++) pts.push([x0 + (x1 - x0) * k / 21, z0 + (z1 - z0) * k / 21, nx, nz]); };
    seg(0, -hz - RAD, hx, -hz - RAD, 0, -1); arc(hx, -hz, -Math.PI / 2); seg(hx + RAD, -hz, hx + RAD, hz, 1, 0); arc(hx, hz, 0);
    seg(hx, hz + RAD, -hx, hz + RAD, 0, 1); arc(-hx, hz, Math.PI / 2); seg(-hx - RAD, hz, -hx - RAD, -hz, -1, 0); arc(-hx, -hz, Math.PI);
    seg(-hx, -hz - RAD, 0, -hz - RAD, 0, -1);
    const n = Math.min(pts.length, NP); let L = 0; const cum = [0];
    for (let k = 1; k <= NP; k++) { const a = pts[(k - 1) % pts.length], b = pts[k % pts.length]; L += Math.hypot(b[0] - a[0], b[1] - a[1]); cum.push(L); }
    for (let k = 0; k <= NP; k++) { const p = pts[k % pts.length]; px[k] = p[0]; pz[k] = p[1]; pnx[k] = p[2]; pnz[k] = p[3]; ps[k] = cum[k] / L; }
    void n;
  }
  const rimPos = new Float32Array((NP + 1) * 3 * 3), rimS = new Float32Array((NP + 1) * 3), rimRow = new Float32Array((NP + 1) * 3), rimIdx = [];
  for (let k = 0; k <= NP; k++) for (let r = 0; r < 3; r++) { rimS[k * 3 + r] = ps[k]; rimRow[k * 3 + r] = r; }
  for (let k = 0; k < NP; k++) for (let r = 0; r < 2; r++) { const a = k * 3 + r, b = (k + 1) * 3 + r; rimIdx.push(a, b, a + 1, b, b + 1, a + 1); }
  const rimGeo = new THREE.BufferGeometry();
  rimGeo.setAttribute('position', new THREE.BufferAttribute(rimPos, 3).setUsage(THREE.DynamicDrawUsage));
  rimGeo.setAttribute('aS', new THREE.BufferAttribute(rimS, 1)); rimGeo.setAttribute('aRow', new THREE.BufferAttribute(rimRow, 1)); rimGeo.setIndex(rimIdx);
  rimGeo.boundingBox = geo.boundingBox.clone(); rimGeo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1);
  const rimU = { uHead: { value: -0.1 }, uGl: { value: -1 } };
  const rim = new THREE.Mesh(rimGeo, new THREE.ShaderMaterial({ uniforms: rimU, vertexShader: RIM_V, fragmentShader: RIM_F, transparent: true, side: THREE.DoubleSide, depthWrite: false }));
  rim.renderOrder = 9; rim.frustumCulled = false; cover.add(rim);

  // ---- shadows between the layers, and on the page
  const shadowTex = (sw, sh, m) => softRect(96, Math.round(96 * sh / sw), sw, sh, m * 0.55, m * 0.55, m * 0.5, m * 0.8);
  const mkShadow = (sw, sh, m, op, order) => {
    const geom = new THREE.PlaneGeometry(sw, sh); geom.rotateX(-Math.PI / 2);
    const mesh = new THREE.Mesh(geom, new THREE.MeshBasicMaterial({ color: 0x000000, alphaMap: shadowTex(sw, sh, m), transparent: true, opacity: 0, depthWrite: false, toneMapped: false }));
    mesh.renderOrder = order; mesh.userData.op = op; return mesh;
  };
  const sB = mkShadow((1 - 0.17) * SC + 0.16, (H - 0.17) * SC + 0.16, 0.08, 0.3, 3); sB.position.set(0.012, OFF_B - 0.0285, 0.014); fl.add(sB);
  const sC = mkShadow((1 - 0.38) * SC + 0.16, (H - 0.38) * SC + 0.16, 0.08, 0.3, 5); sC.position.set(0.012, OFF_C - 0.0285, 0.014); fl.add(sC);
  const sG = mkShadow(SC + 0.34, H * SC + 0.34, 0.17, 0.4, 0); sG.position.set(0.018, 0.0012, ZC + 0.03); g.add(sG); lowBounds(sG.geometry);
  const hole = (() => { const geom = new THREE.PlaneGeometry(1, H); geom.rotateX(-Math.PI / 2); const m = new THREE.Mesh(geom, new THREE.MeshBasicMaterial({ color: 0x050a14, alphaMap: mA, transparent: true, opacity: 0, depthWrite: false, toneMapped: false })); m.position.y = 0.0008; m.renderOrder = 0; lowBounds(geom); return m; })();
  hole.material.alphaMap = softRect(96, 118, 1, H, 0.0, 0.0, RAD, 0.07); hole.material.alphaMap.channel = 0; g.add(hole);

  // ---- title lettering
  const TW = 0.8, SW = 0.52;
  const tcv = cv(1024, 256), scv = cv(768, 170);
  const tTex = new THREE.CanvasTexture(tcv), sTex = new THREE.CanvasTexture(scv); tTex.colorSpace = sTex.colorSpace = THREE.NoColorSpace;
  const paintText = () => {
    drawText(tcv, TITLE, 150, 800, [[0, '#fff3c4'], [0.45, '#f2c75e'], [1, '#bd8a2a']]); tTex.needsUpdate = true;
    drawText(scv, SUB, 104, 700, [[0, '#ffffff'], [0.5, '#ffeab0'], [1, '#e7bb55']]); sTex.needsUpdate = true;
  };
  paintText(); fontsReady().then(paintText);
  const uP = { value: 0 }, uG = { value: -1 }, uPs = { value: 0 }, uGs = { value: -1 };
  const tg = new THREE.Group(); tg.position.set(0, 0.3, -0.6); tg.rotation.x = -0.4; g.add(tg);
  const textLayer = (tex, w, h, y, z, pU, gU, mode, tint, op, order) => {
    const m = new THREE.ShaderMaterial({ uniforms: { map: { value: tex }, uP: pU, uG: gU, uMode: { value: mode }, uTint: { value: new THREE.Color(tint) }, uOp: { value: op } }, vertexShader: TXT_V, fragmentShader: TXT_F, transparent: true, depthWrite: false, side: THREE.DoubleSide });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), m); mesh.position.set(0, y, z); mesh.renderOrder = order; tg.add(mesh); return mesh;
  };
  const th = TW * 256 / 1024, sh = SW * 170 / 768;
  textLayer(tTex, TW, th, 0.0 - 0.006, -0.014, uP, uG, 1, 0x1d1405, 0.85, 11);
  textLayer(tTex, TW, th, 0.0 - 0.003, -0.007, uP, uG, 1, 0x6b4c14, 0.95, 12);
  textLayer(tTex, TW, th, 0.0, 0, uP, uG, 0, 0xffffff, 1, 13);
  textLayer(sTex, SW, sh, -0.25 - 0.004, -0.008, uPs, uGs, 1, 0x1d1405, 0.8, 11);
  textLayer(sTex, SW, sh, -0.25, 0, uPs, uGs, 0, 0xffffff, 1, 13);
  const sweepGlow = glow(0xffe29a, 0.2, 0); tg.add(sweepGlow); sweepGlow.position.z = 0.01;

  // ---- soft halo of gold light under and behind the cover
  const hg = new THREE.PlaneGeometry(1.5, 1.5); hg.rotateX(-Math.PI / 2); lowBounds(hg);
  const halo = new THREE.Mesh(hg, new THREE.MeshBasicMaterial({ map: glowTexture(), color: 0xffc55a, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
  halo.position.set(0, 0.003, ZC); halo.renderOrder = 1; g.add(halo);

  // ---- a ring of light that spreads over the page when the cover lifts (and again when it is tapped)
  const rc = cv(256, 256), rg2 = rc.getContext('2d'), rr = rg2.createRadialGradient(128, 128, 60, 128, 128, 126);
  rr.addColorStop(0, 'rgba(255,214,120,0)'); rr.addColorStop(0.55, 'rgba(255,214,120,0.9)'); rr.addColorStop(0.7, 'rgba(255,236,170,0.5)'); rr.addColorStop(1, 'rgba(255,214,120,0)');
  rg2.fillStyle = rr; rg2.fillRect(0, 0, 256, 256);
  const rgeo = new THREE.PlaneGeometry(1, 1); rgeo.rotateX(-Math.PI / 2); lowBounds(rgeo);
  const ringTex = new THREE.CanvasTexture(rc); ringTex.colorSpace = THREE.SRGBColorSpace;
  const ring = new THREE.Mesh(rgeo, new THREE.MeshBasicMaterial({ map: ringTex, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
  ring.position.set(0, 0.004, ZC * 0.5); ring.renderOrder = 1; ring.visible = false; g.add(ring);
  let ringAt = T_RISE + 0.25, now = 0;

  // ---- floating motes of gold light
  const NM = 44, mp = new Float32Array(NM * 3), mph = new Float32Array(NM * 3);
  for (let i = 0; i < NM; i++) { mph[i * 3] = Math.random(); mph[i * 3 + 1] = Math.random() * 6.28; mph[i * 3 + 2] = 0.5 + Math.random(); }
  const mgeo = new THREE.BufferGeometry(); mgeo.setAttribute('position', new THREE.BufferAttribute(mp, 3).setUsage(THREE.DynamicDrawUsage)); lowBounds(mgeo);
  const motes = new THREE.Points(mgeo, new THREE.PointsMaterial({ map: glowTexture(), color: 0xffd98a, size: 0.035, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
  motes.renderOrder = 10; motes.frustumCulled = false; g.add(motes);

  // ---- deformation of the sheet: a corner peels up, then the whole sheet rises and settles smaller, nearer the reader
  const S = { peel: 0, sc: 1 }, o = [0, 0, 0];
  const deform = (x, z) => {
    const sd = clamp01((-x * 0.6 + (z / H) * 0.8 + 0.7) / 1.4), s2 = Math.pow(sd, 2.2), pe = S.peel;
    const shift = pe * 0.13 * s2;
    o[0] = x * S.sc + 0.6 * shift; o[2] = z * S.sc - 0.8 * shift;
    o[1] = pe * (0.3 * s2 + 0.04 * Math.sin(x * 9 + 1) * sd);
  };
  const place = () => {
    for (let n = 0; n < NV; n++) { deform(bx[n], bz[n]); pos[n * 3] = o[0]; pos[n * 3 + 1] = o[1]; pos[n * 3 + 2] = o[2]; }
    geo.attributes.position.needsUpdate = true;
    for (let k = 0; k <= NP; k++) {
      deform(px[k], pz[k]);
      const r = k * 9, nx = pnx[k], nz = pnz[k];
      rimPos[r] = o[0] - nx * RIM; rimPos[r + 1] = o[1] + 0.0012; rimPos[r + 2] = o[2] - nz * RIM;
      rimPos[r + 3] = o[0]; rimPos[r + 4] = o[1] + 0.0012; rimPos[r + 5] = o[2];
      rimPos[r + 6] = o[0]; rimPos[r + 7] = o[1] - WALL; rimPos[r + 8] = o[2];
    }
    rimGeo.attributes.position.needsUpdate = true;
  };

  // ---- first update: take the picture of the real cover from the camera
  let ready = false, hasCam = false;
  const init = () => {
    ready = true;
    let f = null; try { f = ctx.captureFrame?.() || null; } catch { f = null; }
    if (f && f.tex) {
      const v = new THREE.Vector3(); let ok = 0;
      for (let n = 0; n < NV; n++) {
        v.set(bx[n], 0, bz[n]); const q = f.uv(v);
        const u = Math.min(1, Math.max(0, q[0])), w = Math.min(1, Math.max(0, q[1]));
        if (q[0] > 0 && q[0] < 1 && q[1] > 0 && q[1] < 1) ok++;
        uv0[n * 2] = u; uv0[n * 2 + 1] = w;
      }
      if (ok > NV * 0.25) { geo.attributes.uv.needsUpdate = true; f.tex.anisotropy = 4; state.tex = f.tex; hasCam = true; }
    }
    [LA, LB, LC].forEach((m) => { m.material.map = state.tex; m.material.needsUpdate = true; });
    if (!hasCam) { LA.material.color.set(0xffffff); }
  };

  // ---- tap: flip around once, sparks, one card
  let flipT = -1, carded = false, spun = 0;
  const flip = () => {
    if (flipT >= 0 || !ready) return;
    flipT = 0; spun++; ringAt = now;
    ctx.sfx.whoosh?.(); ctx.sfx.pop?.();
  };
  ctx.tap(cover, flip);
  const sparks = (y) => {
    const c = new THREE.Vector3(0, Y0 + y, ZC);
    ctx.fx.burst(c, GOLD, 30, 0.55, 0.034); ctx.fx.burst(c, 0xfff0c0, 16, 0.38, 0.026);
    for (const [sx, sz] of [[-0.3, -0.38], [0.3, -0.38], [-0.3, 0.38], [0.3, 0.38]]) ctx.fx.burst(new THREE.Vector3(sx, Y0 + y, ZC + sz), GOLD, 6, 0.3, 0.026);
  };

  // ---- animation
  let placedFinal = false;
  return {
    update(t, dt, e) {
      if (!ready) init();
      now = t;
      const rise = ease((t - T_RISE) / D_RISE), riseY = easeBack((t - T_RISE) / D_RISE), p1 = clamp01(t / 1.1);
      S.peel = ease(p1) * (1 - rise); S.sc = 1 + (SC - 1) * rise;
      const anim = t < T_RISE + D_RISE + 0.1;
      if (anim || !placedFinal) { place(); if (!anim) placedFinal = true; }
      // layers fan out as the sheet rises
      fl.position.set(0, 0.0015 + riseY * Y0, ZC * rise);
      LB.position.y = OFF_B * rise; LC.position.y = OFF_C * rise; glint.position.y = OFF_C * rise + 0.002;
      // breathing float and a gentle rock (so the depth is visible without touching)
      const idle = rise > 0.98 ? 1 : 0, ph = t - (T_RISE + D_RISE);
      const k = idle * clamp01(ph / 1.2);
      fl.position.y += Math.sin(t * 1.35) * 0.006 * k;
      fl.rotation.x = Math.sin(t * 0.8) * 0.03 * k; fl.rotation.z = Math.sin(t * 0.63 + 1) * 0.026 * k;
      // flip on tap
      if (flipT >= 0) {
        flipT += dt; const p = clamp01(flipT / 1.35), q = p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
        cover.rotation.z = q * Math.PI * 2; cover.position.y = Math.sin(Math.PI * p) * 0.37;
        if (!carded && p > 0.5) { carded = true; sparks(0.05); ctx.sfx.good?.(); ctx.ui.card({ tag: 'الموسوعة الحيّة', title: 'أهلاً بك', body: 'كل صفحة في هذا الكتاب تستيقظ حين توجّه إليها الكاميرا. قلّب الصفحات وستجد عالماً ينتظرك.', color: GOLD }); ctx.ui.done(); }
        else if (p > 0.5 && spun > 1 && p < 0.52) sparks(0.05);
        if (p >= 1) { flipT = -1; cover.rotation.z = 0; cover.position.y = 0; }
      }
      const fl2 = flipT >= 0 ? 0.35 + 0.65 * Math.abs(Math.cos(cover.rotation.z)) : 1;
      // shadows and the empty place on the page
      sB.material.opacity = sB.userData.op * rise * fl2; sC.material.opacity = sC.userData.op * rise * fl2;
      sG.material.opacity = sG.userData.op * rise * 0.8; sG.position.y = 0.0012;
      hole.material.opacity = 0.42 * ease((t - 0.6) / 1.4);
      // gold line around the edge, then idle glints every ~6 s
      rimU.uHead.value = t < T_RIM ? -0.1 : 1.3 * ease((t - T_RIM) / D_RIM) - 0.03;
      const gt = t - T_IDLE, gp = gt >= 0 ? gt % PER : -1;
      rimU.uGl.value = gp >= 0 && gp < 1.4 ? gp / 1.4 : -1;
      glint.material.opacity = gp >= 0.15 && gp < 1.6 ? 1 : 0; glintTex.offset.x = 1.0 - (gp - 0.15) / 1.45 * 2.0;
      // title forms letter by letter with a sweep of light, then the sub-line
      uP.value = clamp01((t - T_TITLE) / D_TITLE); uPs.value = clamp01((t - T_SUB) / D_SUB);
      const tp = gt >= 0 ? gt % PER - 1.4 : -1; uG.value = tp >= 0 && tp < 1.4 ? -0.3 + tp / 1.4 * 1.5 : -1; uGs.value = tp >= 0.35 && tp < 1.5 ? -0.3 + (tp - 0.35) / 1.15 * 1.5 : -1;
      const tl = clamp01((t - T_TITLE) / D_TITLE); tg.position.y = 0.3 + 0.02 * (1 - ease(tl)) + Math.sin(t * 1.1 + 2) * 0.004 * tl; tg.scale.setScalar(0.94 + 0.06 * ease(tl));
      sweepGlow.position.x = (0.5 - (uP.value * 1.35 - 0.2)) * TW; sweepGlow.position.y = 0.0;
      sweepGlow.material.opacity = uP.value > 0 && uP.value < 0.99 ? 0.9 * Math.sin(Math.PI * clamp01(uP.value * 1.05)) : 0; sweepGlow.scale.setScalar(0.22); sweepGlow.visible = sweepGlow.material.opacity > 0.01;
      halo.material.opacity = 0.34 * rise * (0.85 + 0.15 * Math.sin(t * 1.6)); halo.visible = halo.material.opacity > 0.01;
      const ru = (t - ringAt) / 1.5; ring.visible = ru > 0 && ru < 1;
      if (ring.visible) { ring.scale.setScalar(0.5 + 1.5 * ease(ru)); ring.material.opacity = 0.85 * Math.sin(Math.PI * Math.min(1, ru * 1.15)) * (1 - ru); }
      // motes
      motes.material.opacity = 0.9 * clamp01((t - T_RISE - 0.8) / 1.5) * e;
      for (let i = 0; i < NM; i++) {
        const a = mph[i * 3 + 1] + t * 0.15 * mph[i * 3 + 2], u = (mph[i * 3] + t * 0.07 * mph[i * 3 + 2]) % 1, rr = 0.34 + 0.12 * Math.sin(a * 2.3 + i);
        mp[i * 3] = Math.cos(a) * rr * 1.0; mp[i * 3 + 1] = Y0 + 0.02 + u * 0.4; mp[i * 3 + 2] = ZC + Math.sin(a) * rr * 1.25;
      }
      mgeo.attributes.position.needsUpdate = true;
    },
  };
}
