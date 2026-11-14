// Small shared helpers for the a9 pages: staged build-up, pulsing touch hints, one floating tag.
import * as THREE from 'three';
import { glow, ease, easeBack, clamp01, stag } from '../../kit.js?v=34';
import { lightPool, tagSprite, setSpr } from '../../v2/common.js?v=34';

export const TAU = Math.PI * 2;
export const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
export const css = (c) => '#' + c.toString(16).padStart(6, '0');

// Pieces that build themselves: pencil-inked ones are drawn (reveal), others spring up from nothing.
export class Seq {
  constructor(speed = 1.7) { this.items = []; this.k = speed; }
  add(o, delay, dur = 0.9, rise = 0) {
    const it = { o, delay, dur, rise, s: o.scale.clone(), y: o.position.y };
    this.items.push(it); if (!o.userData.reveal) { o.scale.setScalar(0.0001); o.visible = false; } return o;
  }
  update(t, e) {
    t *= this.k;
    for (const it of this.items) {
      const o = it.o;
      if (o.userData.reveal) { o.userData.reveal(stag(t, it.delay, it.dur, clamp01) * e); continue; }
      const p = stag(t, it.delay, it.dur, clamp01) * e, k = easeBack(p);
      o.visible = p > 0.002;
      o.scale.set(it.s.x * Math.max(k, 0.0001), it.s.y * Math.max(k, 0.0001), it.s.z * Math.max(k, 0.0001));
      if (it.rise) o.position.y = it.y - it.rise * (1 - ease(p));
    }
  }
}

// A soft glow that breathes under every object that can be touched, until it was touched.
export class Hints {
  constructor(parent, from = 5.2) { this.parent = parent; this.list = []; this.from = from * 0.6; }
  add(pos, color = 0xffd27a, size = 0.1) {
    const h = glow(color, size, 0); h.position.copy(pos); this.parent.add(h);
    const it = { h, size, on: true, ph: Math.random() * 6 }; this.list.push(it); return it;
  }
  update(t, e) {
    const k = clamp01((t - this.from) / 1.2) * e;
    for (const it of this.list) {
      const s = Math.sin(t * 2.6 + it.ph);
      it.h.material.opacity = it.on ? k * (0.3 + 0.22 * s) : 0;
      it.h.scale.setScalar(it.size * (1 + 0.14 * s));
    }
  }
}

// One tag that moves to whatever was touched last (never more than one at a time).
export class Tag {
  constructor(parent, w = 0.2, color = 0xc08a2b) { this.w = w; this.color = color; this.parent = parent; this.s = null; this.k = 0; this.pos = V(); this.want = 0; }
  show(text, pos, color = this.color) {
    if (this.s) { this.parent.remove(this.s); this.s.material.map.dispose(); this.s.material.dispose(); }
    this.s = tagSprite(text, this.w, color); this.parent.add(this.s); this.pos.copy(pos); this.k = 0; this.want = 1;
    this.s.position.copy(pos); setSpr(this.s, this.w, 0);
  }
  hide() { this.want = 0; }
  update(dt, e) {
    if (!this.s) return;
    this.k = THREE.MathUtils.damp(this.k, this.want * e, 9, dt);
    setSpr(this.s, this.w, this.k);
  }
}

// A clear glass stage: the printed picture stays visible through it.
export function glassDisc(r, h = 0.022, tint = 0xffffff, op = 0.2) {
  return new THREE.Mesh(new THREE.CylinderGeometry(r, r * 1.02, h, 72), new THREE.MeshPhysicalMaterial({ color: tint, transparent: true, opacity: op, roughness: 0.08, clearcoat: 1, depthWrite: false }));
}

// world position of a point given in a scaled scene group (for particle bursts)
export const wpos = (g, v = V()) => g.position.clone().add(v.clone().multiplyScalar(g.scale.x));
// a soft dark contact shadow lying on the print
export function softShadow(w = 0.3, d = 0.2, op = 0.28) {
  const m = lightPool(0x1a1208, 0.5, op); m.scale.set(w, d, 1); m.position.y = 0.002; return m;
}
