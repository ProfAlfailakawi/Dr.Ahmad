// p193 — Gagné's nine events as nine distinct little objects on nine coloured terraced plinths-of-their-own: a bell, a target, books, a screen, a signpost, a pencil, a speech bubble, a clipboard and a graduation cap pop up one by one as a spark counts 1 to 9.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { P, ease, easeBack, clamp01, stag, mat, glossy, goldMat, shadowed } from '../../kit.js?v=18';
import { softLight } from '../../v2/common.js?v=18';
import { hints, finder, toAr, slabText, blobShadow, hitSphere } from '../lib/a3-kit.js?v=18';

export const meta = { free: true, center: [0.5, 0.5], typeLabel: 'أحداث التعليم' };

const EV = [
  ['اجذب الانتباه', 'تنشيط محفزات الاستقبال'],
  ['أعلم المتعلمين بالأهداف', 'خلق مستوى توقعات للتعلم'],
  ['استدعِ المعلومات السابقة', 'تنشيط ذاكرة المدى القصير'],
  ['اعرض المحتوى', 'فهم انتقائي للمحتوى'],
  ['وفّر التوجيه للمتعلم', 'ترميز معنوي في الذاكرة طويلة الأمد'],
  ['أثِر أداء المتعلم', 'تقديم أجوبة للتأكد من حدوث التعلم'],
  ['قدّم التغذية الراجعة', 'تعزيز وتقييم الأداء الصحيح'],
  ['قيّم الأداء', 'استرجاع المحتوى وتعزيزه كتقييم نهائي'],
  ['عزّز الاحتفاظ والتطبيق', 'استرجاع المهارة وتعميمها في ظروف جديدة'],
];
const PAL = [0xe0453c, 0xf07a2a, 0xf2c230, 0x6ab04a, 0x2fa5a0, 0x2a8fd0, 0x5b5bd6, 0xa85bc0, 0xd63a8c];
const OFF = new THREE.Color(0xd8d4c8);
const box = (w, h, d, m, x = 0, y = 0, z = 0, r = 0.004) => { const b = new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 2, Math.min(r, w / 2.2, h / 2.2, d / 2.2)), m); b.position.set(x, y, z); return b; };
const cyl = (r1, r2, h, m, x = 0, y = 0, z = 0, seg = 24) => { const c = new THREE.Mesh(new THREE.CylinderGeometry(r1, r2, h, seg), m); c.position.set(x, y, z); return c; };

function screenTex() {
  const c = document.createElement('canvas'); c.width = 256; c.height = 160; const g = c.getContext('2d');
  g.fillStyle = '#dff3ff'; g.fillRect(0, 0, 256, 160); g.fillStyle = '#2a8fd0'; g.fillRect(0, 0, 256, 24);
  g.fillStyle = '#ef8a2a'; [[30, 70], [74, 100], [118, 50], [162, 84]].forEach(([x, h]) => g.fillRect(x, 140 - h, 30, h)); g.fillStyle = '#2b2620'; for (let i = 0; i < 4; i++) g.fillRect(200, 44 + i * 22, 44, 8);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
const ICONS = [
  () => { const g = new THREE.Group(); const m = glossy(0xf1c25a, { metalness: 0.7, roughness: 0.2 });
    const b = new THREE.Mesh(new THREE.LatheGeometry([[0.004, 0.1], [0.018, 0.093], [0.03, 0.072], [0.04, 0.046], [0.05, 0.024], [0.062, 0.008], [0.06, 0.0]].map(([r, y]) => new THREE.Vector2(r, y)), 28), m); b.position.y = 0.012; g.add(b);
    const cl = new THREE.Mesh(new THREE.SphereGeometry(0.011, 12, 10), glossy(0xd04a3a)); cl.position.y = 0.012; g.add(cl); g.userData.sway = b; g.userData.sw2 = cl;
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.011, 0.004, 8, 14), m); ring.position.y = 0.116; g.add(ring); return g; },
  () => { const g = new THREE.Group(); const face = new THREE.Group(); face.position.y = 0.075; face.rotation.x = Math.PI / 2; g.add(face);
    [[0.062, 0xd9362e], [0.048, 0xfaf6ee], [0.034, 0xd9362e], [0.02, 0xfaf6ee], [0.008, 0xd4ad55]].forEach(([r, c], i) => face.add(cyl(r, r, 0.008 + i * 0.002, glossy(c), 0, 0.004 * i, 0, 32)));
    [-1, 1].forEach((s) => { const l = cyl(0.004, 0.004, 0.085, mat(0x7b4f2e), s * 0.03, 0.04, -0.03); l.rotation.x = 0.35; g.add(l); });
    const dart = new THREE.Group(); dart.position.set(0.012, 0.085, 0.03); dart.rotation.x = Math.PI / 2; dart.add(cyl(0.003, 0.003, 0.05, mat(0xe9e4d8), 0, 0.03, 0, 8)); const tip = new THREE.Mesh(new THREE.ConeGeometry(0.005, 0.012, 8), goldMat()); tip.position.y = -0.0; tip.rotation.x = Math.PI; dart.add(tip); dart.add(box(0.012, 0.014, 0.002, glossy(0x2a8fd0), 0, 0.054, 0)); g.add(dart); g.userData.dart = dart; return g; },
  () => { const g = new THREE.Group(); [[0.11, 0.03, 0.075, 0x2a8fd0, 0.05], [0.1, 0.026, 0.07, 0xd9362e, -0.08], [0.09, 0.024, 0.065, 0xf2c230, 0.1]].reduce((y, [w, h, d, c, r]) => { const b = box(w, h, d, glossy(c)); b.position.y = y + h / 2; b.rotation.y = r; g.add(b); const pg = box(w * 0.92, h * 0.6, d * 0.9, mat(0xfaf6e8), 0, y + h / 2, 0.003); pg.position.copy(b.position); pg.rotation.y = r; pg.position.z += 0.003; g.add(pg); return y + h; }, 0.005); const rb = box(0.008, 0.01, 0.07, glossy(0xd63a8c)); rb.position.set(0.04, 0.09, 0); g.add(rb); return g; },
  () => { const g = new THREE.Group(); g.add(box(0.12, 0.085, 0.014, glossy(0x2b2f33), 0, 0.075, 0, 0.006)); const sc = new THREE.Mesh(new THREE.PlaneGeometry(0.105, 0.07), new THREE.MeshBasicMaterial({ map: screenTex(), toneMapped: false })); sc.position.set(0, 0.075, 0.0075); g.add(sc); g.add(cyl(0.008, 0.011, 0.03, mat(0xb8bcc2), 0, 0.02, 0, 12), cyl(0.04, 0.045, 0.008, mat(0xb8bcc2), 0, 0.004, 0, 24)); return g; },
  () => { const g = new THREE.Group(); g.add(cyl(0.006, 0.008, 0.13, mat(0x7b4f2e), 0, 0.065, 0, 10));
    [[0.1, 0x2fa5a0, 0.06], [0.082, 0xf2c230, -0.05]].forEach(([w, c, rot], i) => { const a = new THREE.Group(); a.position.y = 0.1 - i * 0.032; a.rotation.y = rot; a.add(box(w, 0.024, 0.008, glossy(c), w / 2 - 0.01, 0, 0.007, 0.003)); const tp = new THREE.Mesh(new THREE.ConeGeometry(0.017, 0.024, 3), glossy(c)); tp.rotation.z = -Math.PI / 2; tp.rotation.y = 0; tp.position.set(w - 0.002, 0, 0.007); tp.scale.set(0.5, 1, 0.3); a.add(tp); g.add(a); }); return g; },
  () => { const g = new THREE.Group(); const pen = new THREE.Group(); pen.rotation.z = -0.5; pen.position.set(0.012, 0.055, 0.0); g.add(pen);
    pen.add(cyl(0.012, 0.012, 0.1, glossy(0xf2c230), 0, 0, 0, 6)); const tip = new THREE.Mesh(new THREE.ConeGeometry(0.012, 0.028, 6), mat(0xe9c9a0)); tip.position.y = -0.064; tip.rotation.z = Math.PI; pen.add(tip); const gr = new THREE.Mesh(new THREE.ConeGeometry(0.005, 0.011, 6), mat(0x2b2f33)); gr.position.y = -0.0785; gr.rotation.z = Math.PI; pen.add(gr); pen.add(cyl(0.012, 0.012, 0.014, mat(0xd8d8dc), 0, 0.057, 0, 12), cyl(0.012, 0.012, 0.016, glossy(0xe8869a), 0, 0.07, 0, 12));
    g.add(box(0.1, 0.004, 0.12, mat(0xfaf6e8), 0, 0.002, 0.0)); g.userData.pen = pen; return g; },
  () => { const g = new THREE.Group(); g.add(box(0.105, 0.07, 0.024, glossy(0xfaf6ee), 0, 0.07, 0, 0.012)); const tail = new THREE.Mesh(new THREE.ConeGeometry(0.014, 0.03, 3), glossy(0xfaf6ee)); tail.position.set(-0.025, 0.02, 0); tail.rotation.z = Math.PI; g.add(tail);
    const mk = (w, x, y, r) => { const b = box(w, 0.009, 0.004, new THREE.MeshBasicMaterial({ color: 0x3aa05a, toneMapped: false }), x, y, 0.013, 0.002); b.rotation.z = r; return b; }; g.add(mk(0.022, -0.01, 0.062, -0.75), mk(0.05, 0.012, 0.074, 0.65)); return g; },
  () => { const g = new THREE.Group(); const bd = box(0.075, 0.105, 0.012, glossy(0x8a5a2e), 0, 0.06, 0, 0.005); bd.rotation.x = -0.18; g.add(bd); const pp = box(0.063, 0.09, 0.004, mat(0xfaf6e8), 0, 0.058, 0.008, 0.002); pp.rotation.x = -0.18; g.add(pp);
    for (let i = 0; i < 3; i++) { const l = box(0.034, 0.004, 0.003, mat(0x2b2620), 0.008, 0.083 - i * 0.026, 0.012, 0.001); l.rotation.x = -0.18; g.add(l); const k = box(0.012, 0.005, 0.003, new THREE.MeshBasicMaterial({ color: 0x3aa05a, toneMapped: false }), -0.022, 0.083 - i * 0.026, 0.012, 0.001); k.rotation.x = -0.18; k.rotation.z = -0.6; g.add(k); }
    g.add(box(0.03, 0.015, 0.012, goldMat(), 0, 0.112, 0.004, 0.003)); return g; },
  () => { const g = new THREE.Group(); const bd = glossy(0x20242a); g.add(cyl(0.04, 0.044, 0.04, bd, 0, 0.03, 0, 28)); const top = box(0.13, 0.008, 0.13, bd, 0, 0.056, 0, 0.002); top.rotation.y = Math.PI / 4; g.add(top);
    g.add(cyl(0.0035, 0.0035, 0.002, goldMat(), 0, 0.061, 0, 8)); const cord = cyl(0.002, 0.002, 0.07, goldMat(), 0.045, 0.062, 0.0, 6); cord.rotation.z = -0.1; const tas = new THREE.Mesh(new THREE.SphereGeometry(0.009, 10, 8), goldMat()); tas.position.set(0.058, 0.02, 0.0); g.add(cord, tas); g.userData.tas = tas; return g; },
];

// merge an icon's many little meshes into ONE vertex-coloured mesh (+ the screen picture as its own plane)
const ICON_MAT = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.34, metalness: 0.12 });
function bake(icon) {
  icon.updateMatrixWorld(true); const list = [], out = new THREE.Group(), tc = new THREE.Color();
  icon.traverse((m) => {
    if (!m.isMesh) return;
    if (m.material.map) { const sc = m.clone(); sc.position.copy(m.getWorldPosition(new THREE.Vector3())); out.add(sc); return; }
    let geo = m.geometry.clone(); if (geo.index) geo = geo.toNonIndexed(); geo.applyMatrix4(m.matrixWorld);
    for (const k of Object.keys(geo.attributes)) if (k !== 'position' && k !== 'normal') geo.deleteAttribute(k);
    const n = geo.attributes.position.count, col = new Float32Array(n * 3); tc.copy(m.material.color);
    for (let i = 0; i < n; i++) { col[i * 3] = tc.r; col[i * 3 + 1] = tc.g; col[i * 3 + 2] = tc.b; }
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3)); list.push(geo);
  });
  if (list.length) out.add(new THREE.Mesh(mergeGeometries(list), ICON_MAT));
  return out;
}

export default function build(ctx) {
  const g = new THREE.Group(); g.position.copy(P(0.5, 0.5)); ctx.stage.add(g);
  const H = hints(), found = finder(ctx, 6);
  const big = blobShadow(0.78, 0.76, 0.28); g.add(big);
  const SP = 0.215, W = 0.185;

  const tiles = EV.map((ev, i) => {
    const r = Math.floor(i / 3), c = i % 3;
    const x = (1 - c) * SP, z = (1 - r) * SP * 0.95;
    const h = 0.045 + r * 0.04;
    const grp = new THREE.Group(); grp.position.set(x, 0, z); g.add(grp);
    const bm = glossy(PAL[i], { roughness: 0.35 });
    const body = new THREE.Mesh(new RoundedBoxGeometry(W, h, W, 2, 0.02), bm); body.position.y = h / 2; body.castShadow = true; grp.add(body);
    const face = slabText(toAr(i + 1), 0.07, 0.05, { fg: '#2b2620', bg: '#fbf6e8', flat: false, size: 0.8 }); face.material.polygonOffset = false; face.position.set(0, h * 0.46, W / 2 + 0.003);
    grp.add(face); face.position.z += 0.0015;
    const icon = bake(ICONS[i]()); icon.position.y = h + 0.008; grp.add(icon);
    grp.add(hitSphere(0.1, [0, h + 0.05, 0]));
    ctx.tap(grp, () => pick(i));
    const hint = H.add(grp, 0xffe08a, 0.16, [0, h + 0.08, 0.02], 5.2 + i * 0.08);
    return { i, x, z, h, grp, bm, icon, lit: 0, pop: 0, popTo: 0, hint, born: 0.1 + i * 0.07, appeared: false };
  });
  const orb = new THREE.Mesh(new THREE.SphereGeometry(0.02, 22, 16), glossy(0xfff0b0, { emissive: 0xffc24a, emissiveIntensity: 0.9 })); g.add(orb);
  orb.add(softLight(0xffc24a, 0.2, 0.7));

  let tgt = -1, p = 1, now = 0, autoUntil = 5.0, last = 0;
  const from = new THREE.Vector3(), to = new THREE.Vector3(), q = new THREE.Vector3();
  const topOf = (i, out) => out.set(tiles[i].x, tiles[i].h + 0.17 + tiles[i].pop * 0.05, tiles[i].z);
  from.set(tiles[0].x, 0.34, tiles[0].z); orb.position.copy(from);
  function goTo(i) { from.copy(orb.position); topOf(i, to); p = 0; tgt = i; last = i; }
  function pick(i) {
    const f = tiles[i]; ctx.sfx.pop?.(); f.popTo = 1; autoUntil = 0; goTo(i);
    ctx.fx.burst(new THREE.Vector3(f.x, f.h + 0.09, f.z).add(g.position), PAL[i], 18, 0.32, 0.03);
    ctx.ui.card({ tag: `الحدث ${toAr(i + 1)} من ٩`, title: EV[i][0], body: `العملية الداخلية: ${EV[i][1]}.`, color: PAL[i] });
    f.hint.calm = true; found(i);
    ctx.ui.hud('كل حدث يخدم عملية داخلية في عقل المتعلم');
  }
  ctx.ui.hud('انظر كيف تظهر الأحداث التسعة');
  return {
    update(t, dt, e) {
      now = t;
      big.material.opacity = 0.28 * e;
      if (t < autoUntil) { const k = Math.floor((t - 0.7) / 0.4); const n = Math.max(-1, Math.min(8, k)); if (n !== tgt && n >= 0) goTo(n); }
      tiles.forEach((f, i) => {
        const gk = Math.max(stag(t, f.born, 0.7, easeBack) * e, 0.001); f.grp.scale.setScalar(gk);
        const on = t < autoUntil ? (i <= tgt ? 1 : 0) : 1;
        if (on && !f.appeared) { f.appeared = true; if (t > 0.6) ctx.fx.burst(new THREE.Vector3(f.x, f.h + 0.08, f.z).add(g.position), PAL[i], 8, 0.25, 0.025); }
        f.lit += (on - f.lit) * Math.min(1, dt * 6);
        f.bm.color.copy(OFF).lerp(cc.setHex(PAL[i]), f.lit);
        f.pop += (f.popTo - f.pop) * Math.min(1, dt * 7); if (f.popTo === 1 && f.pop > 0.97) f.popTo = 0;
        f.grp.position.y = f.pop * 0.04;
        const ik = Math.max(easeBack(f.lit), 0.001) * (1 + f.pop * 0.25 + (i === tgt ? 0.12 : 0)); f.icon.scale.setScalar(ik * 1.15);
        f.icon.rotation.y = Math.sin(t * 0.9 + i) * 0.35 + f.pop * 1.2;
        f.icon.position.y = f.h + 0.008 + Math.sin(t * 1.6 + i) * 0.003;
        const u = f.icon.userData; if (u.sway) { u.sway.rotation.z = Math.sin(t * 4 + i) * 0.12 * (0.3 + f.pop + (i === tgt ? 1 : 0)); } if (u.dart) u.dart.position.x = 0.012 + Math.sin(t * 6) * 0.0015 * (i === tgt ? 3 : 1); if (u.pen) u.pen.rotation.z = -0.5 + Math.sin(t * 5) * 0.12 * (0.4 + f.pop); if (u.tas) u.tas.position.x = 0.058 + Math.sin(t * 3 + i) * 0.006;
      });
      if (p < 1) { p = Math.min(1, p + dt / 0.34); topOf(tgt, to); q.lerpVectors(from, to, ease(p)); q.y += Math.sin(p * Math.PI) * 0.06; orb.position.copy(q); }
      else { topOf(tgt < 0 ? 0 : tgt, to); orb.position.copy(to); orb.position.y += Math.sin(t * 5) * 0.006; }
      orb.scale.setScalar(Math.max(stag(t, 0.4, 0.5, easeBack) * e, 0.001)); orb.rotation.y += dt * 3;
      H.update(t, e);
    },
  };
}
const cc = new THREE.Color();
