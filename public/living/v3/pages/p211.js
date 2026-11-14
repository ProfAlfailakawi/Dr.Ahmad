// p211 — a split brain: slate-and-chalk left hemisphere, painted right hemisphere; each swings open like a bowl to show its world, and a light bridge joins them.
import * as THREE from 'three';
import { P, ease, easeBack, clamp01, glow, lightTube } from '../../kit.js?v=35';
import { rb, lathe, std, gloss, brass, add, grp, hit, Seq, Pulse, touch, plinth, blob, rnd, TAU } from '../lib/a2.js?v=35';
import { plate, damp } from '../lib/b3-kit.js?v=35';

export const meta = { free: true, center: [0.45, 0.68], typeLabel: 'مجسّم تفاعلي' };

const R = 0.18, SX = 0.86, SY = 0.95, SZ = 1.2, DX = 0.092;

function halfGeo() {
  const geo = new THREE.SphereGeometry(R, 72, 48, 0, Math.PI);
  const p = geo.attributes.position, v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i); const l = v.length(); const n = v.clone().divideScalar(l);
    const f = Math.sin(v.x * 70 + v.y * 36) * Math.sin(v.z * 62 - v.y * 30) + 0.6 * Math.sin(v.y * 90 + v.z * 40);
    const k = 1 + 0.045 * f * Math.min(1, Math.abs(v.z) / 0.03);
    v.multiplyScalar(k); p.setXYZ(i, v.x * SX, v.y * SY, v.z * SZ);
  }
  geo.computeVertexNormals(); return geo;
}
function chalkTex() {
  const c = document.createElement('canvas'); c.width = 1024; c.height = 512; const g = c.getContext('2d'), r = rnd(3);
  const gr = g.createLinearGradient(0, 0, 1024, 512); gr.addColorStop(0, '#34484f'); gr.addColorStop(1, '#212f35'); g.fillStyle = gr; g.fillRect(0, 0, 1024, 512);
  for (let i = 0; i < 900; i++) { g.fillStyle = `rgba(255,255,255,${r() * 0.05})`; g.fillRect(r() * 1024, r() * 512, 2 + r() * 40, 1 + r() * 3); }
  g.strokeStyle = 'rgba(250,250,245,.9)'; g.fillStyle = 'rgba(250,250,245,.9)'; g.lineWidth = 6; g.lineCap = 'round';
  const T = (s, x, y, sz) => { g.font = `italic 700 ${sz}px Georgia, serif`; g.fillText(s, x, y); };
  T('x² + y² = r²', 40, 90, 72); T('∑ n = 4', 560, 120, 80); T('√2', 300, 230, 96); T('f(x)', 740, 270, 84); T('12 × 4 = 48', 60, 360, 74); T('π', 520, 400, 120); T('A  B  C', 720, 450, 70); T('∫ dx', 250, 470, 70);
  g.beginPath(); g.moveTo(60, 230); g.lineTo(60, 160); g.lineTo(250, 230); g.closePath(); g.stroke();
  g.beginPath(); g.moveTo(640, 150); g.bezierCurveTo(700, 20, 760, 330, 840, 190); g.stroke();
  g.beginPath(); g.arc(880, 380, 50, 0, TAU); g.stroke();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}
function paintTex() {
  const c = document.createElement('canvas'); c.width = 1024; c.height = 512; const g = c.getContext('2d'), r = rnd(11);
  g.fillStyle = '#f4e6c6'; g.fillRect(0, 0, 1024, 512);
  const cols = ['#e63b7a', '#f2a01e', '#3ea6e0', '#7bc043', '#8e4fc4', '#ff6a3d', '#12a58a', '#ffd23f'];
  for (let i = 0; i < 70; i++) { const x = r() * 1024, y = r() * 512, rad = 40 + r() * 110; const gr = g.createRadialGradient(x, y, 0, x, y, rad); const cc = cols[Math.floor(r() * cols.length)]; gr.addColorStop(0, cc); gr.addColorStop(0.7, cc + 'cc'); gr.addColorStop(1, cc + '00'); g.fillStyle = gr; g.beginPath(); g.arc(x, y, rad, 0, TAU); g.fill(); }
  g.lineWidth = 12; g.lineCap = 'round';
  for (let i = 0; i < 14; i++) { g.strokeStyle = cols[i % cols.length]; g.beginPath(); const y0 = r() * 512; g.moveTo(0, y0); g.bezierCurveTo(300, y0 + (r() - 0.5) * 300, 700, y0 + (r() - 0.5) * 300, 1024, r() * 512); g.stroke(); }
  g.fillStyle = '#d93a3a'; g.font = '700 150px Tajawal, sans-serif'; g.fillText('♥', 120, 300); g.fillStyle = '#2b2150'; g.font = '700 130px Tajawal, sans-serif'; g.fillText('♪', 640, 190); g.fillText('♫', 860, 400);
  g.strokeStyle = '#ffe14a'; g.lineWidth = 14; g.beginPath(); for (let a = 0; a < 18; a += 0.15) g.lineTo(480 + Math.cos(a) * a * 8, 130 + Math.sin(a) * a * 8); g.stroke();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}

export default function build(ctx) {
  const g = new THREE.Group(); g.position.copy(P(meta.center[0], meta.center[1])); ctx.stage.add(g);
  const seq = new Seq(), pulse = new Pulse();
  blob(g, 1.0, 0.72, 0.3, 0, 0);
  const base = plinth(g, 0.35, { h: 0.018 }); seq.add(base, 0.0, 0.8, { rise: 0.03 });
  const geo = halfGeo();
  const gm = (map, hex) => new THREE.MeshPhysicalMaterial({ map, roughness: 0.55, clearcoat: 0.35, clearcoatRoughness: 0.4 });
  const sides = [
    { id: 'L', sx: -1, tex: chalkTex(), inner: 0x2a3a40, glowC: 0x6fd0ff, title: 'النصف الأيسر', body: 'يختص بوظائف الكلمات والأعداد والتسلسل، والتحليل والمنطق من وظائفه.', items: ['∑', '٣+٢', 'أ ب', '√', '=', 'π'], itemCol: ['#1f2f36'], tileCols: [0xf3f1e6] },
    { id: 'R', sx: 1, tex: paintTex(), inner: 0xf0c890, glowC: 0xff9a4d, title: 'النصف الأيمن', body: 'يختص بالموسيقا والألوان والفراغ والتخيل والأحلام، وإدراك الكل بالصور.', items: ['♪', '♥', '◐', '♫', '✦', '◆'], itemCol: ['#ffffff'], tileCols: [0xe6407a, 0xf2a01e, 0x3ea6e0, 0x7bc043, 0x8e4fc4, 0xff6a3d] },
  ].map((S, si) => {
    const pivot = grp(g, S.sx * 0.03, 0.018 + 0.2, 0); const half = grp(pivot, 0, 0, 0);
    half.rotation.y = S.sx * (-Math.PI / 2) * -1; // bulge outward (left: -x, right: +x)
    half.rotation.y = S.sx < 0 ? -Math.PI / 2 : Math.PI / 2;
    const outer = new THREE.Mesh(geo, gm(S.tex)); outer.castShadow = true; half.add(outer);
    const inner = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: S.inner, roughness: 0.6, side: THREE.BackSide, emissive: S.glowC, emissiveIntensity: 0.04 })); half.add(inner);
    // rim of the cut
    const rim = add(half, new THREE.TorusGeometry(R, 0.0035, 8, 64, Math.PI), brass(), 0, 0, 0); rim.scale.set(SX, SY, 1); rim.rotation.z = 0; rim.rotation.x = 0;
    // brass cradle
    add(pivot, lathe([[0.0, -0.18], [0.08, -0.18], [0.085, -0.17], [0.045, -0.16], [0.0, -0.16]], 28), brass(), 0, -0.02, 0);
    // contents float inside the bowl (their faces look towards the opening, local -z)
    const stuff = grp(half, 0, 0, 0); const items = [];
    S.items.forEach((s, j) => {
      const tg = grp(stuff, 0, 0, 0); const a = j * TAU / 6;
      add(tg, rb(0.092, 0.092, 0.014, 0.014, 3), gloss(S.tileCols[j % S.tileCols.length], { roughness: 0.35 }), 0, 0, 0, true);
      const pl = plate(s, 0.082, 0.082, { fg: S.itemCol[j % S.itemCol.length], lines: 1, weight: 800, size: 200 }); pl.position.z = -0.0076; pl.rotation.y = Math.PI; tg.add(pl);
      tg.position.set(Math.cos(a) * 0.075, Math.sin(a) * 0.06, 0.085 + 0.04 * Math.sin(j * 2));
      items.push({ tg, ph: j * 1.3, base: tg.position.clone() });
    });
    const lamp = glow(S.glowC, 0.34, 0.0); lamp.position.set(0, 0, 0.06); half.add(lamp);
    hit(half, 0.15, 0, 0, 0.1);
    seq.add(pivot, 0.5 + si * 0.2, 0.9, { rise: 0.08 });
    pulse.add(pivot, S.glowC, 0.2, S.sx * 0.1, 0.03, 0.08, { op: 0.35 });
    return { ...S, pivot, half, items, lamp, open: 0, want: 0, hov: 0, tapped: false, inner };
  });

  // light bridge between the hemispheres (the corpus callosum)
  const bridgeCurve = new THREE.CatmullRomCurve3([new THREE.Vector3(-0.08, 0.36, 0), new THREE.Vector3(-0.035, 0.45, 0), new THREE.Vector3(0.035, 0.45, 0), new THREE.Vector3(0.08, 0.36, 0)]);
  const bridge = lightTube(bridgeCurve, { radius: 0.007, color: 0xffd27a, speed: 0.9 }); g.add(bridge);
  const bridgeHit = hit(g, 0.07, 0, 0.44, 0);
  const bGlow = glow(0xffd27a, 0.22, 0.0); bGlow.position.set(0, 0.44, 0); g.add(bGlow);

  let bridgeOn = 0, bridgeTapped = false, done = false;
  const check = () => { if (!done && sides.every((s) => s.tapped) && bridgeTapped) { done = true; setTimeout(() => { ctx.ui.hud('الفصّان يعملان معاً'); ctx.ui.done(); }, 1400); } };
  sides.forEach((S) => touch(ctx, S.half, () => {
    S.want = S.want ? 0 : 1; S.tapped = true;
    if (S.want) ctx.ui.card({ tag: 'نصف الدماغ', title: S.title, body: S.body, color: S.glowC }); else ctx.ui.hideCard();
    check();
  }, S.glowC));
  ctx.tap(bridgeHit, () => {
    ctx.sfx.pop?.(); bridgeTapped = true; bridgeOn = 1;
    ctx.ui.card({ tag: 'نصف الدماغ', title: 'بينهما تفاعل', body: 'مع وجود تفاعل بين الفصين، لا يصح تعميم قلة الدقة على النصف الأيمن.', color: 0xffd27a }); check();
  });
  ctx.tap(bridge, () => { ctx.sfx.pop?.(); bridgeTapped = true; bridgeOn = 1; ctx.ui.card({ tag: 'نصف الدماغ', title: 'بينهما تفاعل', body: 'مع وجود تفاعل بين الفصين، لا يصح تعميم قلة الدقة على النصف الأيمن.', color: 0xffd27a }); check(); });

  return {
    update(t, dt, e) {
      seq.update(t, e); pulse.update(t, e);
      const both = sides.every((s) => s.want);
      bridgeOn = damp(bridgeOn, both ? 1 : bridgeOn > 0.4 ? bridgeOn * 0.995 : 0.18, 2, dt);
      bridge.userData.fill(Math.min(1, clamp01((t - 2.6) / 1.2)) * e); bridge.userData.update(dt);
      bridge.children.forEach((c) => { if (c.material && c.material.opacity !== undefined && c === bridge.userData.core) c.material.opacity = 0.35 + bridgeOn * 0.65; });
      bGlow.material.opacity = (0.25 + bridgeOn * 0.6 + 0.12 * Math.sin(t * 3)) * e * clamp01((t - 3) / 1);
      sides.forEach((S, si) => {
        S.open = damp(S.open, S.want, 3.2, dt);
        const o = ease(S.open), s = S.sx;
        // closed: bulge outward. open: the cut faces the reader.
        S.half.rotation.y = (s < 0 ? -Math.PI / 2 : Math.PI / 2) + (s < 0 ? -1 : 1) * (Math.PI / 2) * o + Math.sin(t * 0.6 + si) * 0.04 * (1 - o);
        S.pivot.position.x = s * (0.03 + 0.17 * o + 0.006 * Math.sin(t * 1.1 + si * 2));
        S.pivot.position.y = 0.018 + 0.2 + 0.02 * o + Math.sin(t * 1.3 + si) * 0.004;
        S.pivot.position.z = 0.0 + 0.04 * o;
        S.inner.material.emissiveIntensity = 0.04 + 0.1 * o;
        S.lamp.material.opacity = (0.1 + 0.22 * o) * e;
        S.items.forEach((q, j) => { q.tg.position.y = q.base.y + Math.sin(t * 1.5 + q.ph) * 0.006 * (0.3 + o); q.tg.rotation.z = Math.sin(t * 0.9 + q.ph) * 0.15; });
      });
    },
  };
}
