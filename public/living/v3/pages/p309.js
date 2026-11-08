import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { P, ease, easeBack, clamp01, stag, mat, glossy, goldMat, shadowed, glow, lightTube } from '../../kit.js?v=24';
import { Rig, V, TAU } from '../lib/b5-kit.js?v=24';
import { lightPool } from '../../v2/common.js?v=24';

export const meta = { free: true, center: [0.5, 0.5], typeLabel: 'نوافذ منبثقة' };

const SL = [ // pie slices
  { f: 0.38, c: 0x58b947, t: 'ممتاز' }, { f: 0.28, c: 0xc9dc3a, t: 'جيد' }, { f: 0.19, c: 0xf08a2c, t: 'متوسط' }, { f: 0.15, c: 0xe2453b, t: 'ضعيف' },
];
const hex = (c) => '#' + c.toString(16).padStart(6, '0');

function woodTex() {
  const c = document.createElement('canvas'); c.width = 512; c.height = 384; const g = c.getContext('2d');
  for (let i = 0; i < 8; i++) { g.fillStyle = ['#7a5638', '#6e4d32', '#82603f', '#744f34'][i % 4]; g.fillRect(0, i * 48, 512, 48); g.strokeStyle = 'rgba(255,220,170,.12)'; for (let k = 0; k < 7; k++) { g.beginPath(); g.moveTo(0, i * 48 + 6 + k * 6); g.bezierCurveTo(170, i * 48 + k * 6 - 4, 340, i * 48 + k * 6 + 10, 512, i * 48 + 6 + k * 6); g.stroke(); } g.fillStyle = 'rgba(30,18,8,.45)'; g.fillRect(0, i * 48, 512, 2); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function paperTex() {
  const c = document.createElement('canvas'); c.width = 512; c.height = 400; const g = c.getContext('2d');
  g.fillStyle = '#fbf9f3'; g.fillRect(0, 0, 512, 400);
  g.fillStyle = '#2b2620'; g.font = '700 46px Cairo, Tahoma, sans-serif'; g.textAlign = 'left'; g.fillText('Survey', 40, 70);
  ['Excellent', 'Good', 'Average', 'Poor'].forEach((s, i) => { g.strokeStyle = '#2b2620'; g.lineWidth = 3; g.strokeRect(40, 100 + i * 42, 22, 22); g.font = '500 28px Cairo, Tahoma, sans-serif'; g.fillText(s, 82, 120 + i * 42); });
  let a = -Math.PI / 2; const cx = 370, cy = 265, r = 120;
  SL.forEach((s) => { g.fillStyle = hex(s.c); g.beginPath(); g.moveTo(cx, cy); g.arc(cx, cy, r, a, a + s.f * TAU); g.closePath(); g.fill(); a += s.f * TAU; });
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}
function cardTex() {
  const c = document.createElement('canvas'); c.width = 256; c.height = 330; const g = c.getContext('2d');
  g.fillStyle = 'rgba(255,255,255,0.92)'; g.beginPath(); g.roundRect(4, 4, 248, 322, 34); g.fill(); g.strokeStyle = '#8b6fd0'; g.lineWidth = 6; g.stroke();
  g.fillStyle = '#2b2620'; g.font = '700 40px Cairo, Tahoma, sans-serif'; g.textAlign = 'center'; g.fillText('Survey', 128, 56);
  SL.forEach((s, i) => { const y = 112 + i * 52; g.fillStyle = '#7b5fc7'; g.beginPath(); g.roundRect(26, y - 20, 44, 44, 22); g.fill(); g.fillStyle = hex(s.c); g.beginPath(); g.arc(48, y + 2, 14, 0, TAU); g.fill(); g.fillStyle = '#d9d4ca'; g.beginPath(); g.roundRect(88, y - 6, 136 - i * 16, 16, 8); g.fill(); });
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}

export default function build(ctx) {
  const g = new THREE.Group(); g.position.copy(P(meta.center[0], meta.center[1])); g.scale.setScalar(1.06); ctx.stage.add(g);
  const rig = new Rig(ctx);
  const pool = lightPool(0x8b6fd0, 0.5, 0); pool.position.y = 0.002; pool.scale.set(1.3, 1.3, 1.0); g.add(pool); rig.fn((p) => { pool.material.opacity = 0.28 * p; }, 0.1, 1);

  // desk
  const desk = new THREE.Mesh(new RoundedBoxGeometry(0.84, 0.04, 0.64, 4, 0.016), [mat(0x5d4029), mat(0x5d4029), new THREE.MeshStandardMaterial({ map: woodTex(), roughness: 0.5 }), mat(0x4a3220), mat(0x5d4029), mat(0x5d4029)]);
  desk.position.y = 0.02; g.add(shadowed(desk)); rig.add(desk, 0.1, 0.9, 'pop');
  // paper
  const sheet = new THREE.Group(); sheet.position.set(-0.02, 0.043, 0.07); sheet.rotation.y = 0.12; g.add(sheet);
  const paper = new THREE.Mesh(new RoundedBoxGeometry(0.6, 0.005, 0.48, 2, 0.002), [mat(0xfaf6ec), mat(0xfaf6ec), new THREE.MeshStandardMaterial({ map: paperTex(), roughness: 0.8 }), mat(0xfaf6ec), mat(0xfaf6ec), mat(0xfaf6ec)]);
  paper.receiveShadow = true; sheet.add(paper); rig.add(sheet, 0.5, 0.8, 'pop');
  // marker
  const mk = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.009, 0.1, 14), glossy(0xd8402f)); mk.rotation.z = Math.PI / 2; mk.rotation.y = 0.4; mk.position.set(0.3, 0.052, -0.02); g.add(shadowed(mk));
  // scan line on paper
  const scan = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.012), new THREE.MeshBasicMaterial({ color: 0x9a7be8, transparent: true, opacity: 0, toneMapped: false, depthWrite: false })); scan.rotation.x = -Math.PI / 2; scan.position.set(0, 0.0035, 0); sheet.add(scan);

  // 3D pie (sits on the printed pie)
  const pie = new THREE.Group(); pie.position.set(0.08 * 1, 0.0, 0.0); sheet.add(pie);
  const PCX = (370 - 256) / 512 * 0.6, PCZ = (265 - 200) / 400 * 0.48; pie.position.set(PCX, 0.0035, PCZ);
  const PR = 120 / 512 * 0.6;
  let a0 = 0; const wedges = SL.map((s, i) => {
    const sh = new THREE.Shape(); sh.moveTo(0, 0); const n = 18; for (let k = 0; k <= n; k++) { const a = a0 + (s.f * TAU) * k / n; sh.lineTo(Math.sin(a) * PR, -Math.cos(a) * PR); } sh.lineTo(0, 0);
    const geo = new THREE.ExtrudeGeometry(sh, { depth: 1, bevelEnabled: true, bevelSize: 0.003, bevelThickness: 0.003, bevelSegments: 2 });
    const w = new THREE.Group(); const m = new THREE.Mesh(geo, glossy(s.c, { roughness: 0.15, transmission: 0.0, transparent: true, opacity: 0.93 })); m.rotation.x = Math.PI / 2; m.scale.z = -1; m.rotation.x = -Math.PI / 2; m.scale.set(1, 1, 0.001); w.add(shadowed(m));
    const mid = a0 + s.f * TAU / 2; w.userData = { dir: V(Math.sin(mid), 0, -Math.cos(mid)), m, pop: -9, s }; pie.add(w); a0 += s.f * TAU; return w;
  });
  // pie base ring
  const ring = new THREE.Mesh(new THREE.TorusGeometry(PR * 1.05, 0.003, 8, 56), new THREE.MeshStandardMaterial({ color: 0x9a7be8, emissive: 0x9a7be8, emissiveIntensity: 0.9 })); ring.rotation.x = Math.PI / 2; pie.add(ring);

  // floating card
  const card = new THREE.Mesh(new THREE.PlaneGeometry(0.23, 0.296), new THREE.MeshBasicMaterial({ map: cardTex(), transparent: true, side: THREE.DoubleSide, toneMapped: false }));
  card.position.set(0.12, 0.44, 0.0); g.add(card);
  const cglow = glow(0x9a7be8, 0.4, 0); cglow.position.set(0.12, 0.44, 0.0); g.add(cglow);
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.0015, 0.0015, 0.3, 6), new THREE.MeshBasicMaterial({ color: 0x9a7be8, transparent: true, opacity: 0.6, toneMapped: false })); stem.position.set(0.12, 0.2, 0.0); g.add(stem);

  // lens (tablet)
  const lens = new THREE.Group(); g.add(lens);
  const bzM = glossy(0x4b3f86, { roughness: 0.2 }); const LW = 0.6, LH = 0.42, BW = 0.04;
  [[0, LH / 2 - BW / 2, LW, BW], [0, -LH / 2 + BW / 2, LW, BW], [-LW / 2 + BW / 2, 0, BW, LH - 2 * BW], [LW / 2 - BW / 2, 0, BW, LH - 2 * BW]].forEach(([x, y, w, h]) => { const b = new THREE.Mesh(new RoundedBoxGeometry(w, h, 0.03, 3, 0.014), bzM); b.position.set(x, y, 0); lens.add(shadowed(b)); });
  const gl = new THREE.Mesh(new THREE.PlaneGeometry(0.52, 0.34), new THREE.MeshPhysicalMaterial({ color: 0xb9a6ff, transparent: true, opacity: 0.2, roughness: 0.03, clearcoat: 1, side: THREE.DoubleSide, depthWrite: false })); gl.position.z = 0.0125; lens.add(gl);
  const lrim = new THREE.Mesh(new THREE.TorusGeometry(0.0, 0.0, 3, 3), goldMat());
  const frameLine = new THREE.Mesh(new RoundedBoxGeometry(0.515, 0.355, 0.004, 3, 0.012), new THREE.MeshStandardMaterial({ color: 0x9a7be8, emissive: 0x9a7be8, emissiveIntensity: 0.8 })); frameLine.position.z = 0.0118; lens.add(frameLine);
  // make frame line a ring: cut by inner glass above (opaque inner plane trick): draw glass above it slightly
  const inner = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.34), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.0, depthWrite: false })); inner.position.z = 0.014; lens.add(inner);
  frameLine.visible = false;
  const lensGlow = glow(0x9a7be8, 0.7, 0); lens.add(lensGlow); lensGlow.position.z = 0.03;
  rig.add(lens, 0.9, 0.9, 'pop');
  const AWAY = { p: V(0.0, 0.2, -0.3), r: -0.2 }, ARP = { p: V(0.0, 0.3, 0.2), r: -0.8 };
  let ar = 0, arTarget = 0, now = 0, seen = new Set(), doneF = false; const pieK = { v: 0 };
  const see = (k) => { seen.add(k); if (seen.size >= 4 && !doneF) { doneF = true; setTimeout(() => ctx.ui.done(), 2400); } };

  rig.touch(sheet, () => { ctx.sfx.pop?.(); ctx.ui.card({ tag: 'المشهد الحقيقي', title: 'الواقع المطبوع', body: 'ورقة استبيان حقيقية عليها مخطط دائري؛ هذا هو المشهد الواقعي الذي تلتقطه الكاميرا وتتعرّف عليه.', color: 0xf08a2c }); see('p'); }, { color: 0xf08a2c, size: 0.2, at: V(-0.15, 0.03, 0.1), show: 3 });
  rig.touch(lens, (h) => { ctx.sfx.whoosh?.(); arTarget = arTarget ? 0 : 1; ctx.ui.card({ tag: 'الجهاز الوسيط', title: 'نافذة الدمج', body: 'الشاشة هي النافذة التي يُدمج عليها الواقعي والرقمي. في طريقة العلامات تلتقط الكاميرا علامة وتميّزها لتعرض المعلومات المرتبطة بها.', color: 0x8b6fd0 }); see('l'); }, { color: 0x9a7be8, size: 0.28, at: V(0, 0, 0.03), show: 3 });
  rig.touch(card, () => { ctx.sfx.pop?.(); card.userData.spin = now; ctx.ui.card({ tag: 'طبقة رقمية', title: 'المعلومة المضافة', body: 'بطاقة التقييم الافتراضية تُعرض فوق المشهد الحقيقي نفسه؛ هكذا يضيف الواقع المعزز معلومات رقمية إلى الواقع بدل أن يستبدله.', color: 0x9a7be8 }); see('c'); }, { color: 0x9a7be8, size: 0.2, show: 3.4 });
  wedges.forEach((w) => ctx.tap(w, () => { w.userData.pop = now; ctx.sfx.pop?.(); ctx.fx.burst(w.getWorldPosition(new THREE.Vector3()).add(V(0, 0.08, 0)), w.userData.s.c, 16, 0.3, 0.025); ctx.ui.card({ tag: 'مخطط مجسّم', title: 'المخطط يرتفع', body: 'المخطط الدائري يرتفع ثلاثي الأبعاد فوق الورقة، وهذا ما يفرّق الواقع المعزز عن الافتراضي الذي يحلّ محلّ المشهد كله.', color: w.userData.s.c }); see('w'); }));

  return {
    update(t, dt, e) {
      now = t; rig.update(t, dt, e);
      if (t > 3.2 && !update.started) { update.started = true; arTarget = 1; }
      ar += (arTarget - ar) * Math.min(1, dt * 2.4); const k = ease(ar);
      lens.position.lerpVectors(AWAY.p, ARP.p, k); lens.position.y += Math.sin(k * Math.PI) * 0.06; lens.rotation.x = AWAY.r + (ARP.r - AWAY.r) * k;
      lensGlow.material.opacity = (0.12 + 0.1 * Math.sin(t * 2.4)) * (0.4 + k) * e;
      const pk = clamp01((k - 0.45) / 0.55); pieK.v += (pk - pieK.v) * Math.min(1, dt * 4);
      wedges.forEach((w, i) => {
        const u = w.userData; const lift = clamp01(pieK.v * 1.4 - i * 0.12); const pp = clamp01(1 - (now - u.pop) / 1.0);
        u.m.scale.z = Math.max(0.001, ease(lift) * 0.11 + Math.sin(pp * Math.PI) * 0.03);
        const out = Math.sin(pp * Math.PI) * 0.035; w.position.set(u.dir.x * out, Math.sin(pp * Math.PI) * 0.015, u.dir.z * out);
      });
      ring.material.emissiveIntensity = 0.3 + 0.7 * (1 - pieK.v) * (0.6 + 0.4 * Math.sin(t * 3)); ring.visible = true;
      const ck = clamp01((k - 0.6) / 0.4);
      const cs = clamp01(1 - (now - (card.userData.spin ?? -9)) / 0.9);
      card.visible = ck > 0.02; card.scale.setScalar(Math.max(ck, 0.001)); card.position.y = 0.44 + Math.sin(t * 1.8) * 0.01; card.rotation.y = Math.sin(t * 0.8) * 0.15 + cs * Math.PI * 2 * ease(1 - cs) * 0;
      card.rotation.y += (1 - cs) * 0 + (cs > 0 ? (1 - cs) * Math.PI * 2 : 0);
      cglow.position.y = card.position.y; cglow.material.opacity = 0.35 * ck; stem.scale.y = Math.max(ck, 0.001); stem.material.opacity = 0.6 * ck; stem.position.y = 0.2;
      scan.material.opacity = (0.4 * Math.max(0, Math.sin(t * 1.1))) * (1 - k) * e; scan.position.z = Math.sin(t * 1.1) * 0.2;
    },
  };
  function update() {}
}
