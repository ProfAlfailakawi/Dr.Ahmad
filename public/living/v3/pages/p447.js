// p447 — eRoll: a screen that is a rolled sheet. A black cylinder unrolls into a glowing page and rolls back into a small device.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { P, ease, easeBack, clamp01, stag, mat, glossy, goldMat, shadowed, glow } from '../../kit.js?v=23';
import { inked } from '../../pencil.js?v=23';
import { lightPool } from '../../v2/common.js?v=23';
import { Seq, Hints, Tag, TAU, V, wpos, softShadow } from '../lib/a9-kit.js?v=23';

export const meta = { free: true, center: [0.5, 0.518], typeLabel: 'جهاز يُطوى', title: 'اطوِ الكتاب الإلكتروني' };

const CARDS = [
  { t: 'تقنية في أرقى تطور', tag: 'أرقى تقنية', b: 'تصميم يجمع أرقى مجالات تطور التكنولوجيا والمعلوماتية والاتصالات، فهو من أكثر الاختراعات العملية نفعاً للتعليم والتعلم.', c: 0x2a8fd0 },
  { t: 'الكتاب الإلكتروني الملفوف', tag: 'قمة الإبداع', b: 'يُعدّ هذا الاختراع قمة الإبداع، ووجوده إنجاز وإضافة كبيرة للعملية التعليمية التعلمية.', c: 0xef8f2a },
  { t: 'بعد طيّ الكتاب', tag: 'صغير وأنيق', b: 'صُمّم ليناسب رغبات الجميع، وتبيّن الصورة صغر حجمه وجمالية التصميم بعد طيه.', c: 0x2fae8f },
];

const SCHEMES = [['#7bb52e', '#ef8f2a', ['#3a5aa8', '#d9453b', '#2a8fd0', '#f2b632', '#2fae8f']], ['#2a8fd0', '#f2b632', ['#e5258f', '#2fae8f', '#ef8f2a', '#3a5aa8', '#d9453b']], ['#d9453b', '#2fae8f', ['#f2b632', '#2a8fd0', '#7bb52e', '#e5258f', '#3a5aa8']]];
function pageTexture(v = 0) {
  const [hd, ac, cols] = SCHEMES[v];
  const c = document.createElement('canvas'); c.width = 1024; c.height = 560; const x = c.getContext('2d');
  x.fillStyle = '#fbfaf4'; x.fillRect(0, 0, 1024, 560);
  x.fillStyle = hd; x.fillRect(0, 0, 1024, 70);
  x.fillStyle = ac; x.fillRect(0, 70, 1024, 10);
  const blocks = [[40, 110, 300, 190, cols[0]], [360, 110, 300, 190, cols[1]], [680, 110, 300, 190, cols[2]], [40, 330, 300, 190, cols[3]], [360, 330, 300, 190, cols[4]]];
  blocks.forEach(([a, b, w, h, col]) => { x.fillStyle = col; x.globalAlpha = 0.9; x.fillRect(a, b, w, h); x.globalAlpha = 1; });
  x.fillStyle = '#c9c4b4';
  for (let i = 0; i < 12; i++) { x.fillRect(690, 335 + i * 15, 280 - (i % 4) * 40, 7); }
  x.fillStyle = '#ffffff'; x.globalAlpha = 0.55; x.beginPath(); x.arc(190, 205, 54, 0, TAU); x.arc(510, 205, 46, 0, TAU); x.arc(830, 205, 50, 0, TAU); x.fill(); x.globalAlpha = 1;
  x.strokeStyle = '#2b2e36'; x.lineWidth = 22; x.strokeRect(0, 0, 1024, 560);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}

export default function build(ctx) {
  const g = new THREE.Group(); g.position.copy(P(meta.center[0], meta.center[1])); ctx.stage.add(g); g.scale.setScalar(0.9);
  const seq = new Seq(), hints = new Hints(g, 7.5), tag = new Tag(g, 0.2);
  const dark = glossy(0x1d1b19, { roughness: 0.38, clearcoat: 0.6 });
  const Y0 = 0.006, R = 0.046, CX = -0.3, LEN = 0.6, HALF = 0.17, N = 140;

  const shadow = softShadow(0.9, 0.5, 0.32); g.add(shadow);
  const pool = lightPool(0x7cc8ff, 0.4, 0); pool.position.y = 0.004; pool.scale.set(0.95, 0.6, 1); g.add(pool);

  // housing cylinder with end caps and a gold ring
  const core = new THREE.Mesh(new THREE.CylinderGeometry(R, R, HALF * 2 + 0.01, 40), dark); core.rotation.x = Math.PI / 2; core.position.set(CX, Y0 + R, 0); g.add(shadowed(core));
  const caps = [-1, 1].map((s) => { const k = new THREE.Mesh(new THREE.CylinderGeometry(R + 0.009, R + 0.009, 0.012, 40), dark); k.rotation.x = Math.PI / 2; k.position.set(CX, Y0 + R, s * (HALF + 0.011)); g.add(k);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(R + 0.009, 0.0028, 8, 48), goldMat()); ring.position.copy(k.position); ring.position.z += s * 0.006; g.add(ring); return k; });
  const cyl = new THREE.Group(); g.add(cyl);

  // the sheet: a ribbon whose shape follows how much of it is rolled
  const pos = new Float32Array((N + 1) * 2 * 3), uv = new Float32Array((N + 1) * 2 * 2), idx = [];
  for (let i = 0; i <= N; i++) { for (let k = 0; k < 2; k++) { uv[(i * 2 + k) * 2] = 1 - i / N; uv[(i * 2 + k) * 2 + 1] = k; } if (i < N) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); } }
  const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(pos, 3)); sg.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); sg.setIndex(idx);
  const texs = [0, 1, 2].map(pageTexture); const tex = texs[0];
  const front = new THREE.Mesh(sg, new THREE.MeshStandardMaterial({ map: tex, emissiveMap: tex, emissive: 0xffffff, emissiveIntensity: 0.16, roughness: 0.5, side: THREE.BackSide }));
  const back = new THREE.Mesh(sg, new THREE.MeshStandardMaterial({ color: 0x23201d, roughness: 0.45, metalness: 0.2, side: THREE.FrontSide }));
  front.frustumCulled = back.frustumCulled = false; g.add(front, back);
  const bar = new THREE.Mesh(new RoundedBoxGeometry(0.02, 0.022, HALF * 2 + 0.014, 3, 0.006), dark); g.add(shadowed(bar));
  const led = glow(0x6fd3ff, 0.05, 0.9); g.add(led);
  const barGem = new THREE.Mesh(new THREE.SphereGeometry(0.004, 10, 8), new THREE.MeshBasicMaterial({ color: 0x9fe0ff, toneMapped: false })); g.add(barGem);

  let u = 0, uTarget = 0, lastU = -1;
  function shape() {
    const F = u * LEN, p = pos;
    for (let i = 0; i <= N; i++) {
      const s = (i / N) * LEN; let x, y;
      if (s <= F) { x = CX + F - s; y = Y0 + 0.0005; }
      else { const d = s - F; let a = d / R; const r = R + 0.0016 * a / TAU; a = d / r; x = CX - r * Math.sin(a); y = Y0 + r - r * Math.cos(a) + 0.0005; }
      for (let k = 0; k < 2; k++) { const o = (i * 2 + k) * 3; p[o] = x; p[o + 1] = y; p[o + 2] = (k ? HALF : -HALF); }
    }
    sg.attributes.position.needsUpdate = true; sg.computeVertexNormals();
    bar.position.set(CX + F + 0.004, Y0 + 0.011, 0);
    led.position.set(CX + F + 0.004, Y0 + 0.03, HALF - 0.04); barGem.position.copy(led.position); barGem.position.y -= 0.0115; barGem.position.x += 0.0;
  }
  shape();
  // invisible hit areas so a finger always finds something
  const hitSheet = new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.01, 0.01), new THREE.MeshBasicMaterial({ visible: false })); g.add(hitSheet);
  const hitCyl = new THREE.Mesh(new THREE.CylinderGeometry(R + 0.02, R + 0.02, HALF * 2 + 0.04, 16), new THREE.MeshBasicMaterial({ visible: false })); hitCyl.rotation.x = Math.PI / 2; hitCyl.position.set(CX, Y0 + R, 0); g.add(hitCyl);

  let variant = 0;
  function turnPage() { variant = (variant + 1) % 3; front.material.map = texs[variant]; front.material.emissiveMap = texs[variant]; front.material.needsUpdate = true; ctx.sfx.pop?.(); ctx.fx.burst(wpos(g, V(0.05, 0.05, 0)), [0x7bb52e, 0x2a8fd0, 0xd9453b][variant], 26, 0.3, 0.03); }
  const turners = [V(0.12, 0.09, -HALF + 0.03), V(-0.12, 0.09, HALF - 0.03)].map((p) => { const o = new THREE.Mesh(new THREE.OctahedronGeometry(0.014), new THREE.MeshBasicMaterial({ color: 0xffd27a, toneMapped: false })); o.position.copy(p); o.userData.p = p; g.add(o); const h = glow(0xffd27a, 0.09, 0.5); o.add(h); ctx.tap(o, turnPage); return o; });
  const seen = new Set(); let now = 0, finished = false, auto = false;
  function show(i) {
    const c = CARDS[i]; ctx.sfx.pop?.();
    ctx.ui.card({ tag: 'مجسّم', title: c.t, body: c.b, color: c.c });
    tag.show(c.tag, i === 0 ? V(0.05, 0.16, 0) : V(CX, 0.2, 0), c.c);
    seen.add(i);
    if (seen.size === 3 && !finished) { finished = true; setTimeout(() => { ctx.fx.burst(wpos(g, V(0, 0.15, 0)), 0x7cc8ff, 40, 0.5, 0.035); ctx.ui.done(); }, 800); }
  }
  function toggle() { uTarget = uTarget > 0.5 ? 0 : 1; ctx.sfx.whoosh?.(); }
  ctx.tap(hitCyl, () => { toggle(); show(uTarget ? 1 : 2); hints.list[0].on = false; });
  ctx.tap(bar, () => { toggle(); show(uTarget ? 1 : 2); });
  ctx.tap(front, () => { if (u > 0.6) { show(0); hints.list[1].on = false; ctx.fx.burst(wpos(g, V(0, 0.06, 0)), 0x7cc8ff, 14, 0.25, 0.025); } else { toggle(); show(1); } });
  hints.add(V(CX, Y0 + R, 0), 0xffd27a, 0.15); hints.add(V(0.0, 0.05, 0), 0x7cc8ff, 0.2);
  [core, bar].forEach((o, i) => seq.add(o, 0.2 + i * 0.25, 0.9));
  caps.forEach((k) => seq.add(k, 0.8, 0.6));
  ctx.ui.hud('المس الأسطوانة لتنبسط');
  turners.forEach((o) => seq.add(o, 3.2, 0.5));

  return {
    update(t, dt, e) {
      now = t; seq.update(t, e); hints.update(t, e); tag.update(dt, e);
      if (!auto && t > 1.6) { auto = true; uTarget = 1; }
      u = THREE.MathUtils.damp(u, uTarget, 2.6, dt);
      if (Math.abs(u - lastU) > 0.0005) { shape(); lastU = u; hitSheet.position.set(CX + u * LEN * 0.5, 0.04, 0); }
      const vis = clamp01((t - 0.5) / 0.8) * e;
      front.visible = back.visible = vis > 0.05; front.material.opacity = 1;
      led.material.opacity = 0.7 * vis * (0.7 + 0.3 * Math.sin(t * 3)); led.visible = barGem.visible = vis > 0.05;
      pool.material.opacity = 0.55 * clamp01(u * 1.3) * vis;
      turners.forEach((o, i) => { o.rotation.y = t * 1.5; o.position.y = o.userData.p.y + Math.sin(t * 2 + i) * 0.006; o.visible = u > 0.8 && o.scale.x > 0.01; });
      core.rotation.y = 0;
    },
  };
}
