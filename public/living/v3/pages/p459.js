// p459 — BYOD: four letter-blocks spell the word; each turns over to its meaning and the tote bag answers (it is carried, it is yours, devices come out).
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { P, ease, easeBack, clamp01, stag, mat, glossy, goldMat, shadowed, glow } from '../../kit.js?v=37';
import { inked } from '../../pencil.js?v=37';
import { lightPool } from '../../v2/common.js?v=37';
import { Seq, Hints, Tag, TAU, V, wpos, softShadow } from '../lib/a9-kit.js?v=37';

export const meta = { free: true, center: [0.5, 0.616], typeLabel: 'مكعبات الاختصار', title: 'BYOD: أحضر جهازك' };

const LET = [
  { l: 'B', w: 'Bring', c: 0xd9453b }, { l: 'Y', w: 'Your', c: 0x2a8fd0 }, { l: 'O', w: 'Own', c: 0xef8f2a }, { l: 'D', w: 'Device', c: 0x3a5aa8 },
];
const CARDS = {
  all: { t: 'أحضر جهازك الخاص', b: 'اختصار Bring Your Own Device، أي: أحضر جهازك الخاص.', c: 0x2fae8f },
  bring: { t: 'Bring: الإحضار', b: 'المعلم والطالب هما من يجلب الجهاز إلى المدرسة.', c: 0xd9453b },
  own: { t: 'Your Own: ملكك أنت', b: 'الجهاز خاص بصاحبه، فلا تتحمل المدرسة توفيره ولا إلزامهم به.', c: 0xef8f2a },
  dev: { t: 'Device: أجهزة ذكية', b: 'هواتف ذكية، وأجهزة لوحية، وحواسيب محمولة.', c: 0x3a5aa8 },
};

function faceTex(text, bg, fg, size) {
  const c = document.createElement('canvas'); c.width = c.height = 256; const x = c.getContext('2d');
  x.fillStyle = bg; x.fillRect(0, 0, 256, 256);
  x.strokeStyle = 'rgba(255,255,255,.35)'; x.lineWidth = 8; x.strokeRect(14, 14, 228, 228);
  x.fillStyle = fg; x.font = `800 ${size}px Tajawal, sans-serif`; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(text, 128, 138);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}
const hex = (c) => '#' + c.toString(16).padStart(6, '0');
const deep = (c, k = 0.66) => new THREE.Color(c).multiplyScalar(k);

function device(kind) {
  const g = new THREE.Group(); const dk = glossy(0x25272e, { roughness: 0.3 });
  const scr = (w, h, col) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: col, toneMapped: false })); m.position.z = 0.0042; return m; };
  if (kind === 'phone') { g.add(new THREE.Mesh(new RoundedBoxGeometry(0.04, 0.076, 0.007, 3, 0.004), dk)); g.add(scr(0.034, 0.064, 0xf6c334)); }
  if (kind === 'tablet') { g.add(new THREE.Mesh(new RoundedBoxGeometry(0.07, 0.092, 0.007, 3, 0.005), dk)); g.add(scr(0.062, 0.082, 0x4cc38f)); }
  if (kind === 'laptop') { const b = new THREE.Mesh(new RoundedBoxGeometry(0.1, 0.006, 0.07, 3, 0.002), dk); b.rotation.x = 0; b.position.y = -0.035; g.add(b);
    const lid = new THREE.Group(); lid.position.set(0, -0.032, -0.035); lid.rotation.x = -0.3; g.add(lid);
    const l = new THREE.Mesh(new RoundedBoxGeometry(0.1, 0.07, 0.005, 3, 0.002), dk); l.position.y = 0.035; lid.add(l); const s = scr(0.09, 0.06, 0xe5473f); s.position.set(0, 0.035, 0.0032); lid.add(s); }
  if (kind === 'watch') { g.add(new THREE.Mesh(new RoundedBoxGeometry(0.034, 0.04, 0.01, 3, 0.006), dk)); g.add(scr(0.026, 0.03, 0x2a8fd0)); const st = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.1, 0.004), mat(0x2fae8f)); st.position.z = -0.004; g.add(st); }
  return g;
}

export default function build(ctx) {
  const g = new THREE.Group(); g.position.copy(P(meta.center[0], meta.center[1])); ctx.stage.add(g); g.scale.setScalar(1.2);
  const seq = new Seq(), hints = new Hints(g, 5.6), tag = new Tag(g, 0.2);
  const seen = new Set(); let finished = false, now = 0;

  const shadow = softShadow(0.5, 0.3, 0.3); shadow.position.z = 0.08; g.add(shadow);
  const pool = lightPool(0xfff1c8, 0.28, 0.5); pool.position.set(0, 0.004, 0.06); g.add(pool);

  // tote bag
  const bag = new THREE.Group(); bag.position.set(0, 0.004, 0.09); g.add(bag);
  const body = new THREE.Mesh(new RoundedBoxGeometry(0.2, 0.15, 0.085, 4, 0.016), glossy(0x2f3a5c, { roughness: 0.4 })); body.position.y = 0.075; bag.add(shadowed(body));
  const band = new THREE.Mesh(new RoundedBoxGeometry(0.205, 0.035, 0.09, 3, 0.012), glossy(0xf6c334, { roughness: 0.4 })); band.position.y = 0.04; bag.add(band);
  const mouth = new THREE.Mesh(new THREE.PlaneGeometry(0.17, 0.06), new THREE.MeshBasicMaterial({ color: 0x0f1118 })); mouth.rotation.x = -Math.PI / 2; mouth.position.y = 0.1505; bag.add(mouth);
  const handle = new THREE.Mesh(new THREE.TorusGeometry(0.055, 0.0075, 10, 40, Math.PI), glossy(0x1e2132)); handle.position.y = 0.15; bag.add(handle);
  // name tag (appears for "Your Own") and gold ring of ownership
  const tg = new THREE.Group(); tg.position.set(0.08, 0.12, 0.05); bag.add(tg);
  const tagBody = new THREE.Mesh(new RoundedBoxGeometry(0.05, 0.065, 0.004, 3, 0.004), goldMat()); tg.add(tagBody);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.009, 12, 8), mat(0x2b2620)); head.position.set(0, 0.008, 0.004); tg.add(head);
  const sh = new THREE.Mesh(new THREE.SphereGeometry(0.016, 14, 8, 0, TAU, 0, Math.PI / 2), mat(0x2b2620)); sh.position.set(0, -0.022, 0.003); sh.scale.z = 0.3; tg.add(sh);
  tg.userData.s = tg.scale.clone(); tg.scale.setScalar(0.0001); tg.visible = false;
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.0045, 8, 80), new THREE.MeshBasicMaterial({ color: 0xffd27a, toneMapped: false, transparent: true, opacity: 0 })); ring.rotation.x = Math.PI / 2; ring.position.set(0, 0.012, 0.09); g.add(ring);

  // devices hidden in the bag
  const slotPos = [V(-0.22, 0.2, 0.15), V(-0.08, 0.3, 0.2), V(0.08, 0.28, 0.2), V(0.22, 0.19, 0.15)];
  const devs = ['tablet', 'laptop', 'phone', 'watch'].map((k, i) => { const d = device(k); d.position.set(0, 0.12, 0.09); d.scale.setScalar(0.0001); d.visible = false; g.add(d); return { d, i, out: false, t0: 0 }; });

  // letter blocks
  const blocks = LET.map((L, i) => {
    const outer = new THREE.Group(); outer.position.set((i - 1.5) * 0.13, 0.19, -0.12); outer.rotation.x = -0.62; g.add(outer);
    const spin = new THREE.Group(); outer.add(spin);
    const sideM = new THREE.MeshStandardMaterial({ color: deep(L.c), roughness: 0.45 });
    const mats = [sideM, sideM, sideM, sideM, new THREE.MeshStandardMaterial({ map: faceTex(L.l, '#' + deep(L.c).getHexString(), '#ffffff', 190), roughness: 0.45 }), new THREE.MeshStandardMaterial({ map: faceTex(L.w, '#f3ecd8', '#' + deep(L.c, 0.8).getHexString(), L.w.length > 4 ? 66 : 84), roughness: 0.5 })];
    const cube = new THREE.Mesh(new THREE.BoxGeometry(0.105, 0.105, 0.105), mats); spin.add(shadowed(cube));
    const edge = new THREE.Mesh(new THREE.EdgesGeometry(cube.geometry), new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.55 })); spin.add(edge);
    const h = hints.add(outer.position.clone(), L.c, 0.16);
    seq.add(outer, 1.2 + i * 0.3, 0.9, 0.2);
    return { outer, spin, L, i, flip: 0, target: 0, hint: h };
  });
  seq.add(bag, 0.6, 0.9, 0.08); seq.add(pool, 0.4, 0.1);

  let hopAt = -9, ringAt = -9;
  function card(k, pos, tg2) { const c = CARDS[k]; ctx.sfx.pop?.(); ctx.ui.card({ tag: 'BYOD', title: c.t, body: c.b, color: c.c }); tag.show(tg2, pos, c.c); }
  function check() { if (seen.has('B') && seen.has('YO') && seen.has('D') && !finished) { finished = true; setTimeout(() => { ctx.fx.burst(wpos(g, V(0, 0.2, 0)), 0xffd27a, 50, 0.55, 0.04); ctx.ui.done(); ctx.ui.hud('أحضر جهازك الخاص'); }, 900); } }
  function turn(b, v) { b.target = v; b.hint.on = false; }
  ctx.tap(blocks[0].outer, () => { turn(blocks[0], 1); hopAt = now; seen.add('B'); card('bring', V(blocks[0].outer.position.x, 0.28, -0.12), 'الإحضار'); check(); });
  const yo = () => { turn(blocks[1], 1); turn(blocks[2], 1); ringAt = now; tg.visible = true; seen.add('YO'); card('own', V(0, 0.3, -0.12), 'جهازك أنت'); check(); };
  ctx.tap(blocks[1].outer, yo); ctx.tap(blocks[2].outer, yo);
  ctx.tap(blocks[3].outer, () => { turn(blocks[3], 1); devs.forEach((q) => { if (!q.out) { q.out = true; q.t0 = now + q.i * 0.18; } }); seen.add('D'); card('dev', V(blocks[3].outer.position.x, 0.28, -0.12), 'أجهزة ذكية'); check(); });
  ctx.tap(bag, () => { hopAt = now; blocks.forEach((b) => (b.target = 0)); ctx.sfx.pop?.(); ctx.ui.card({ tag: 'BYOD', title: CARDS.all.t, body: CARDS.all.b, color: CARDS.all.c }); });
  ctx.ui.hud('اقلب المكعبات لتعرف المعنى');
  const tm = V();

  return {
    update(t, dt, e) {
      now = t; seq.update(t, e); hints.update(t, e); tag.update(dt, e);
      blocks.forEach((b) => {
        b.flip = THREE.MathUtils.damp(b.flip, b.target, 5, dt); b.spin.rotation.y = b.flip * Math.PI + Math.sin(t * 0.9 + b.i) * 0.06 * (1 - b.flip);
        b.outer.position.y = 0.19 + Math.sin(t * 1.5 + b.i * 1.3) * 0.008; b.hint.h.position.copy(b.outer.position);
      });
      const hop = clamp01((t - hopAt) / 0.9); const hh = hopAt > 0 && hop < 1 ? Math.sin(hop * Math.PI) * 0.06 : 0;
      bag.position.y = 0.004 + hh; bag.position.z = 0.09 + (hopAt > 0 && hop < 1 ? Math.sin(hop * Math.PI) * 0.05 : 0);
      handle.rotation.z = hop < 1 && hopAt > 0 ? Math.sin(hop * 12) * 0.12 * (1 - hop) : 0;
      const ts = ease((t - ringAt) / 0.6); if (tg.visible) { tg.scale.copy(tg.userData.s).multiplyScalar(Math.max(ts, 0.0001)); tg.rotation.z = Math.sin(t * 2) * 0.12; }
      ring.material.opacity = ringAt > 0 ? (0.5 + 0.35 * Math.sin(t * 3)) * ts * e : 0; ring.scale.setScalar(1 + 0.03 * Math.sin(t * 3));
      devs.forEach((q) => {
        const k = q.out ? ease((t - q.t0) / 1.1) : 0; q.d.visible = k > 0.01;
        q.d.scale.setScalar(Math.max(k, 0.0001) * 1.6);
        tm.set(0, 0.14, 0.09); q.d.position.lerpVectors(tm, slotPos[q.i], k); q.d.position.y += Math.sin(t * 1.6 + q.i) * 0.006 * k + Math.sin(k * Math.PI) * 0.05;
        q.d.rotation.y = Math.sin(t * 0.8 + q.i) * 0.5 + (1 - k) * 3; q.d.rotation.x = -0.55 * k;
      });
      pool.material.opacity = 0.4 * e;
    },
  };
}
