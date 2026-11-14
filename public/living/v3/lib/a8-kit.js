// Shared helpers for the a8 batch of hand-built pages (387 … 429).
import * as THREE from 'three';
import { P, ease, easeBack, clamp01, stag, mat, glossy, goldMat, shadowed, glow } from '../../kit.js?v=36';
import { tagSprite, setSpr } from '../../v2/common.js?v=36';

export const TAU = Math.PI * 2;
export const toAr = (n) => String(n).replace(/\d/g, (d) => '٠١٢٣٤٥٦٧٨٩'[d]);
export const PAPER_C = 0xf6efdf, INK_C = 0x2b2620, GOLD_C = 0xd4ad55;

// A scene shell: positions the group on the page, builds parts in sequence, pulses touchables.
export function scene(ctx, meta) {
  const g = new THREE.Group(); g.position.copy(P(meta.center[0], meta.center[1])); ctx.stage.add(g);
  const parts = [], pulses = [], tags = [], loops = [];
  const S = {
    g, parts, pulses, tags, now: 0,
    // register a piece that builds itself at `delay` s. Inked pieces draw, others grow + rise.
    part(obj, delay = 0, { dur = 0.9, rise = 0.05 } = {}) {
      parts.push({ obj, delay, dur, rise, y0: obj.position.y, s0: obj.scale.clone(), ink: !!obj.userData.reveal });
      if (!obj.userData.reveal) obj.scale.setScalar(0.0001);
      return obj;
    },
    // soft pulsing glow that invites touch; fn runs on tap. Returns the glow sprite.
    touch(obj, fn, { color = 0xffd27a, size = 0.12, at = null, wake = 5 } = {}) {
      const s = glow(color, size, 0.0); s.renderOrder = 8; s.material.depthTest = false;
      if (at) s.position.copy(at); obj.add(s);
      const rec = { s, size, wake, base: 0.3, ph: Math.random() * 6, on: true, k: 1 };
      pulses.push(rec);
      ctx.tap(obj, () => { ctx.sfx.pop?.(); fn(obj, rec); });
      return rec;
    },
    // floating label (camera-facing). Hidden until shown(k).
    tag(text, color, w = 0.17, o = {}) {
      const s = tagSprite(text, w, color, o); s.material.depthTest = false; s.renderOrder = 9; s.visible = false; g.add(s);
      const rec = { s, w, k: 0, tk: 1, sp: 4, delay: 1.5 }; tags.push(rec); return rec;
    },
    loop(fn) { loops.push(fn); },
    burst(pos, color = 0xffd27a, n = 24, sp = 0.5, size = 0.035) { ctx.fx.burst(g.position.clone().add(pos), color, n, sp, size); },
    update(t, dt, e) {
      S.now = t;
      g.scale.setScalar(Math.max(e, 0.001));
      for (const p of parts) {
        const k = stag(t, p.delay, p.dur, p.ink ? clamp01 : easeBack) * e;
        if (p.ink) p.obj.userData.reveal(k);
        else { p.obj.scale.copy(p.s0).multiplyScalar(Math.max(k, 0.0001)); p.obj.position.y = p.y0 + p.rise * (1 - clamp01(k)); p.obj.visible = k > 0.002; }
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

// A finished, round plinth: pale glossy top, gold rim, rounded dark underside.
export function plinth(r = 0.4, { color = PAPER_C, rim = true, h = 0.022 } = {}) {
  const g = new THREE.Group();
  const pts = [[0, 0], [r * 0.45, 0], [r * 0.78, 0.004], [r * 0.95, 0.011], [r, 0.017], [r, h], [r * 0.985, h + 0.003], [0, h + 0.003]].map(([x, y]) => new THREE.Vector2(x, y));
  const body = new THREE.Mesh(new THREE.LatheGeometry(pts, 72), glossy(color, { roughness: 0.4, clearcoat: 0.6 }));
  g.add(body);
  const under = new THREE.Mesh(new THREE.CircleGeometry(r * 0.46, 40), mat(0x3a332b)); under.rotation.x = Math.PI / 2; under.position.y = -0.0006; g.add(under);
  if (rim) { const ring = new THREE.Mesh(new THREE.TorusGeometry(r * 0.985, 0.0055, 10, 90), goldMat()); ring.rotation.x = Math.PI / 2; ring.position.y = h + 0.002; g.add(ring); }
  return shadowed(g);
}
export function slab(w, d, { h = 0.02, color = PAPER_C, rad = 0.02, rim = true } = {}) {
  const g = new THREE.Group();
  const b = new THREE.Mesh(new RoundedBox(w, h, d, rad), glossy(color, { roughness: 0.4, clearcoat: 0.6 })); b.position.y = h / 2; g.add(b);
  if (rim) { const r = new THREE.Mesh(new RoundedBox(w + 0.006, 0.004, d + 0.006, 0.004), goldMat()); r.position.y = h * 0.62; g.add(r); }
  return shadowed(g);
}
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
export function RoundedBox(w, h, d, r = 0.01) { return new RoundedBoxGeometry(w, h, d, 3, Math.min(r, w / 2.01, h / 2.01, d / 2.01)); }

// A restrained adult figure (no face): torso, head, optional hair cap and one arm that can point.
export function person({ body = 0x3d4f6b, skin = 0xe3b894, hair = 0x2a211c, s = 1, skirt = false } = {}) {
  const g = new THREE.Group();
  const torso = new THREE.Mesh(skirt ? new THREE.CylinderGeometry(0.018 * s, 0.032 * s, 0.075 * s, 20) : new THREE.CapsuleGeometry(0.026 * s, 0.05 * s, 6, 16), glossy(body, { roughness: 0.5, clearcoat: 0.3 }));
  torso.position.y = 0.06 * s; g.add(torso);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.021 * s, 20, 14), mat(skin)); head.position.y = 0.123 * s; g.add(head);
  const cap = new THREE.Mesh(new THREE.SphereGeometry(0.0225 * s, 20, 12, 0, TAU, 0, Math.PI * 0.55), mat(hair)); cap.position.y = 0.127 * s; cap.rotation.x = -0.25; g.add(cap);
  const arm = new THREE.Group(); arm.position.set(0.026 * s, 0.085 * s, 0); g.add(arm);
  const a = new THREE.Mesh(new THREE.CapsuleGeometry(0.0085 * s, 0.05 * s, 4, 10), glossy(body, { roughness: 0.5 })); a.position.set(0.0, -0.02 * s, 0); arm.add(a);
  g.userData.arm = arm; g.userData.head = head;
  return shadowed(g);
}

// Little helpers
export const cssHex = (c) => '#' + c.toString(16).padStart(6, '0');
export function shake(obj, t0, now, amp = 0.012) { const k = now - t0; return k < 0.5 ? Math.sin(k * 60) * amp * (1 - k / 0.5) : 0; }
export { P, ease, easeBack, clamp01, stag, mat, glossy, goldMat, shadowed, glow, tagSprite, setSpr };

// ---- round 2 additions -----------------------------------------------------
import { lightPool, softLight } from '../../v2/common.js?v=36';
export { lightPool, softLight };
// a soft dark contact shadow lying on the page
let _sh;
export function contactShadow(w = 0.1, d = 0.1, o = 0.35) {
  if (!_sh) { const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d'); const gr = x.createRadialGradient(64, 64, 4, 64, 64, 64); gr.addColorStop(0, 'rgba(30,22,10,.85)'); gr.addColorStop(0.5, 'rgba(30,22,10,.35)'); gr.addColorStop(1, 'rgba(30,22,10,0)'); x.fillStyle = gr; x.fillRect(0, 0, 128, 128); _sh = new THREE.CanvasTexture(c); }
  const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: _sh, transparent: true, depthWrite: false, opacity: o, toneMapped: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
  m.rotation.x = -Math.PI / 2; m.scale.set(w, d, 1); m.position.y = 0.0015; m.renderOrder = 1; return m;
}
// A properly modelled adult figure. Faces +z. Arms: userData.armL/armR (shoulder groups; rotation.x<0 swings forward) each with .elbow child.
export function person2({ body = 0x3d4f6b, trousers = 0x2b2f3a, skin = 0xe3b894, hair = 0x2a211c, s = 1, long = false, skirt = false, seated = false, tie = 0 } = {}) {
  const g = new THREE.Group(); const U = s;
  const cloth = (c) => glossy(c, { roughness: 0.55, clearcoat: 0.25 });
  const legsY = seated ? 0.05 : 0.085;
  if (!seated) {
    [-1, 1].forEach((k) => { const l = new THREE.Mesh(new THREE.CapsuleGeometry(0.013 * U, 0.07 * U, 4, 10), cloth(skirt ? skin : trousers)); l.position.set(k * 0.018 * U, 0.05 * U, 0); g.add(l); const f = new THREE.Mesh(new RoundedBox(0.022 * U, 0.01 * U, 0.04 * U, 0.004 * U), mat(0x201a16)); f.position.set(k * 0.018 * U, 0.006 * U, 0.008 * U); g.add(f); });
  } else {
    [-1, 1].forEach((k) => { const th = new THREE.Mesh(new THREE.CapsuleGeometry(0.014 * U, 0.06 * U, 4, 10), cloth(trousers)); th.rotation.x = Math.PI / 2; th.position.set(k * 0.018 * U, 0.075 * U, 0.03 * U); g.add(th); const sh = new THREE.Mesh(new THREE.CapsuleGeometry(0.012 * U, 0.05 * U, 4, 10), cloth(trousers)); sh.position.set(k * 0.018 * U, 0.04 * U, 0.062 * U); g.add(sh); });
  }
  const hipY = seated ? 0.085 : 0.095;
  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.03 * U, 0.05 * U, 6, 16), cloth(body)); torso.scale.set(1.22, 1, 0.78); torso.position.y = (hipY + 0.045) * U; g.add(torso);
  if (skirt) { const sk = new THREE.Mesh(new THREE.CylinderGeometry(0.03 * U, 0.05 * U, 0.06 * U, 24), cloth(trousers)); sk.position.y = 0.085 * U; g.add(sk); }
  if (tie) { const t = new THREE.Mesh(new THREE.BoxGeometry(0.008 * U, 0.04 * U, 0.004 * U), mat(tie)); t.position.set(0, (hipY + 0.06) * U, 0.0235 * U); g.add(t); }
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.01 * U, 0.012 * U, 0.016 * U, 12), mat(skin)); neck.position.y = (hipY + 0.098) * U; g.add(neck);
  const head = new THREE.Group(); head.position.y = (hipY + 0.124) * U; g.add(head);
  const hs = new THREE.Mesh(new THREE.SphereGeometry(0.023 * U, 24, 18), mat(skin)); hs.scale.set(0.92, 1.08, 1); head.add(hs);
  const cap = new THREE.Mesh(new THREE.SphereGeometry(0.0245 * U, 24, 16, 0, TAU, 0, Math.PI * 0.58), mat(hair)); cap.position.y = 0.004 * U; cap.rotation.x = -0.35; cap.scale.set(0.94, 1.06, 1.02); head.add(cap);
  if (long) { const lh = new THREE.Mesh(new THREE.CapsuleGeometry(0.02 * U, 0.03 * U, 4, 10), mat(hair)); lh.position.set(0, -0.012 * U, -0.012 * U); lh.scale.set(1, 1, 0.7); head.add(lh); }
  const arm = (k) => {
    const sh = new THREE.Group(); sh.position.set(k * 0.04 * U, (hipY + 0.075) * U, 0); g.add(sh);
    const ball = new THREE.Mesh(new THREE.SphereGeometry(0.0125 * U, 12, 10), cloth(body)); sh.add(ball);
    const up = new THREE.Mesh(new THREE.CapsuleGeometry(0.0095 * U, 0.04 * U, 4, 10), cloth(body)); up.position.y = -0.026 * U; sh.add(up);
    const el = new THREE.Group(); el.position.y = -0.05 * U; sh.add(el);
    const fo = new THREE.Mesh(new THREE.CapsuleGeometry(0.0085 * U, 0.036 * U, 4, 10), cloth(body)); fo.position.y = -0.022 * U; el.add(fo);
    const hd = new THREE.Mesh(new THREE.SphereGeometry(0.009 * U, 10, 8), mat(skin)); hd.position.y = -0.048 * U; el.add(hd);
    sh.userData.elbow = el; sh.rotation.z = k * 0.12; return sh;
  };
  const armL = arm(-1), armR = arm(1);
  g.userData = { armL, armR, head, torso };
  return shadowed(g);
}
