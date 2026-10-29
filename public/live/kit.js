// Shared 3D helpers for every living page: easing, Arabic labels, materials, particles.
import * as THREE from 'three';

// Page image is 838 x 1024 px; width is 1 unit, so height is:
export const PAGE_H = 1024 / 838;

export const PALETTE = {
  paper: 0xf7f3ea, ink: 0x1f1b16, gold: 0xd4ad55, goldDeep: 0xb08a35,
  green: 0x8a9a1f, orange: 0xef8f2a, blue: 0x2a8fd0, slate: 0x8fa6b5, brown: 0x6b4f3f,
};

export const clamp01 = (x) => Math.min(1, Math.max(0, x));
export const ease = (x) => 1 - Math.pow(1 - clamp01(x), 3);
export const easeBack = (x) => { x = clamp01(x); const c = 1.6; return 1 + (c + 1) * Math.pow(x - 1, 3) + c * Math.pow(x - 1, 2); };
// Progress of a staggered item: starts at `delay` seconds, lasts `dur`.
export const stag = (t, delay, dur = 0.7, fn = ease) => fn((t - delay) / dur);

// Stage space: x right, y up out of the page, z toward the page bottom.
// u/v are page fractions measured from the top-left corner of the page image.
export const P = (u, v, h = 0) => new THREE.Vector3(u - 0.5, h, (v - 0.5) * PAGE_H);

const FONT_UI = 'Tajawal, sans-serif';
const FONT_TITLE = '"Reem Kufi", Tajawal, sans-serif';

export async function fontsReady() {
  try {
    await Promise.all([
      document.fonts.load(`700 40px Tajawal`), document.fonts.load(`800 40px Tajawal`),
      document.fonts.load(`700 40px "Reem Kufi"`),
    ]);
  } catch { /* system fallback is fine */ }
}

function wrapLines(g, text, maxW) {
  const out = [];
  for (const para of String(text).split('\n')) {
    let line = '';
    for (const word of para.split(' ')) {
      const test = line ? line + ' ' + word : word;
      if (g.measureText(test).width > maxW && line) { out.push(line); line = word; } else line = test;
    }
    out.push(line);
  }
  return out;
}

// A rounded "paper card" with Arabic text drawn by the browser, so letters join correctly.
export function textCanvas(text, {
  width = 512, size = 44, weight = 700, color = '#1f1b16', bg = 'rgba(250,247,240,0.96)',
  border = null, pad = 26, radius = 28, title = false, align = 'center', lineH = 1.35, shadow = true,
} = {}) {
  const c = document.createElement('canvas');
  const g = c.getContext('2d');
  const font = `${weight} ${size}px ${title ? FONT_TITLE : FONT_UI}`;
  g.font = font;
  const lines = wrapLines(g, text, width - pad * 2);
  const h = Math.ceil(lines.length * size * lineH + pad * 2);
  c.width = width; c.height = h;
  if (bg) {
    if (shadow) { g.shadowColor = 'rgba(0,0,0,.18)'; g.shadowBlur = 14; }
    g.fillStyle = bg;
    g.beginPath(); g.roundRect(6, 6, width - 12, h - 12, radius); g.fill();
    g.shadowBlur = 0;
    if (border) { g.lineWidth = 5; g.strokeStyle = border; g.stroke(); }
  }
  g.font = font; g.fillStyle = color; g.direction = 'rtl';
  g.textAlign = align === 'center' ? 'center' : 'right'; g.textBaseline = 'middle';
  const x = align === 'center' ? width / 2 : width - pad;
  lines.forEach((l, i) => g.fillText(l, x, pad + size * lineH * (i + 0.5)));
  return c;
}

function canvasTex(c) {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}

// Flat label in 3D (keeps its orientation). `w` is its width in page units.
export function label(text, w = 0.2, opts = {}) {
  const c = textCanvas(text, opts);
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(w, w * c.height / c.width),
    new THREE.MeshBasicMaterial({ map: canvasTex(c), transparent: true, depthWrite: false, toneMapped: false, side: THREE.DoubleSide }),
  );
  m.renderOrder = 5;
  return m;
}

// Label that always faces the camera.
export function sprite(text, w = 0.2, opts = {}) {
  const c = textCanvas(text, opts);
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: canvasTex(c), transparent: true, depthWrite: false, toneMapped: false }));
  s.scale.set(w, w * c.height / c.width, 1);
  s.userData.aspect = c.height / c.width;
  s.renderOrder = 6;
  return s;
}

export const mat = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.62, metalness: 0.02, ...o });
export const glossy = (color, o = {}) => new THREE.MeshPhysicalMaterial({ color, roughness: 0.25, clearcoat: 1, clearcoatRoughness: 0.15, ...o });
export const goldMat = () => new THREE.MeshStandardMaterial({ color: 0xe0b85e, roughness: 0.28, metalness: 0.85 });

export function shadowed(obj) {
  obj.traverse((o) => { if (o.isMesh && !o.material.transparent) { o.castShadow = true; o.receiveShadow = true; } });
  return obj;
}

// Soft round glow texture for sparkles and halos.
let glowTex;
export function glowTexture() {
  if (glowTex) return glowTex;
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grd.addColorStop(0, 'rgba(255,255,255,1)'); grd.addColorStop(0.35, 'rgba(255,240,200,.55)'); grd.addColorStop(1, 'rgba(255,220,150,0)');
  g.fillStyle = grd; g.fillRect(0, 0, 128, 128);
  glowTex = new THREE.CanvasTexture(c);
  return glowTex;
}

export function glow(color = 0xffd27a, size = 0.08, opacity = 0.9) {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending }));
  s.scale.setScalar(size);
  return s;
}

// Particle bursts that live in the stage and fade on their own.
export class FX {
  constructor(parent) { this.parent = parent; this.items = []; }
  burst(pos, color = 0xffd27a, n = 26, speed = 0.45, size = 0.035) {
    for (let i = 0; i < n; i++) {
      const s = glow(color, size, 1);
      s.position.copy(pos);
      const dir = new THREE.Vector3(Math.random() - 0.5, Math.random() * 0.9 + 0.1, Math.random() - 0.5).normalize();
      this.parent.add(s);
      this.items.push({ s, v: dir.multiplyScalar(speed * (0.4 + Math.random() * 0.8)), life: 0, max: 0.8 + Math.random() * 0.5 });
    }
  }
  update(dt) {
    this.items = this.items.filter((p) => {
      p.life += dt;
      p.v.y -= 0.6 * dt;
      p.s.position.addScaledVector(p.v, dt);
      p.s.material.opacity = 1 - p.life / p.max;
      if (p.life >= p.max) { this.parent.remove(p.s); p.s.material.dispose(); return false; }
      return true;
    });
  }
  clear() { this.items.forEach((p) => this.parent.remove(p.s)); this.items = []; }
}

// A golden light band that sweeps down the page the moment it is recognised.
export function sweepBand() {
  const c = document.createElement('canvas'); c.width = 4; c.height = 256;
  const g = c.getContext('2d');
  const grd = g.createLinearGradient(0, 0, 0, 256);
  grd.addColorStop(0, 'rgba(255,214,120,0)'); grd.addColorStop(0.47, 'rgba(255,224,150,.0)');
  grd.addColorStop(0.5, 'rgba(255,236,190,.95)'); grd.addColorStop(0.53, 'rgba(255,224,150,0)'); grd.addColorStop(1, 'rgba(255,214,120,0)');
  g.fillStyle = grd; g.fillRect(0, 0, 4, 256);
  const tex = new THREE.CanvasTexture(c);
  tex.wrapT = THREE.ClampToEdgeWrapping;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(1, PAGE_H), new THREE.MeshBasicMaterial({
    map: tex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0,
  }));
  m.position.z = 0.003;
  m.renderOrder = 2;
  m.userData.play = (p) => { // p: 0..1 down the page
    tex.repeat.set(1, 0.5); tex.offset.set(0, p * 0.5);
    m.material.opacity = p <= 0 || p >= 1 ? 0 : Math.sin(p * Math.PI);
  };
  return m;
}
