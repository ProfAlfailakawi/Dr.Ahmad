// p203 — Fleming's cycle of information as one hero object: a chalkboard Ferris wheel whose four cabins (receive, organise, record, retrieve) ride round and round under chasing lights.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { P, ease, easeBack, clamp01, stag, mat, glossy, goldMat, shadowed } from '../../kit.js?v=22';
import { tagSprite, setSpr, softLight } from '../../v2/common.js?v=22';
import { hints, finder, blobShadow, hitSphere } from '../lib/a3-kit.js?v=22';

export const meta = { free: true, center: [0.43, 0.64], typeLabel: 'دورة تفاعلية' };

const TAU = Math.PI * 2, R = 0.27, HUB = 0.39;
const ST = [
  { n: 'يستقبل', c: 0x2f9fd8, card: ['المحطة الأولى', 'يستقبل', 'الطريقة التي يستقبل بها المتعلم المعرفة والمعلومات والخبرات.'] },
  { n: 'يرتّب وينظّم', c: 0xf0902a, card: ['المحطة الثانية', 'يرتّب وينظّم', 'الطريقة التي يرتّب وينظّم بها هذه المعلومات.'] },
  { n: 'يسجّل ويرمّز', c: 0x4fae4a, card: ['المحطة الثالثة', 'يسجّل ويرمّز', 'يسجّل المعلومات ويرمّزها ويدمجها ويحتفظ بها في مخزونه المعرفي.'] },
  { n: 'يسترجع ويعبّر', c: 0xe0524a, card: ['المحطة الرابعة', 'يسترجع ويعبّر', 'يسترجع المعلومات والخبرات بالطريقة التي تمثل طريقته في التعبير عنها.'] },
];

function chalkTex() {
  const c = document.createElement('canvas'); c.width = c.height = 512; const g = c.getContext('2d');
  const gr = g.createRadialGradient(256, 256, 20, 256, 256, 256); gr.addColorStop(0, '#46535a'); gr.addColorStop(1, '#2b3639'); g.fillStyle = gr; g.fillRect(0, 0, 512, 512);
  g.fillStyle = 'rgba(255,255,248,.35)'; g.strokeStyle = 'rgba(255,255,248,.3)'; g.lineWidth = 3; g.font = '700 38px Georgia, serif';
  const w = ['x²+y²', 'Σ', 'π', 'a/b', '∫f', 'E=mc²', '√25', '△', '∞', 'n+1'];
  for (let i = 0; i < 24; i++) { const x = 60 + Math.random() * 390, y = 60 + Math.random() * 390; if (Math.hypot(x - 256, y - 256) > 215) continue; g.save(); g.translate(x, y); g.rotate((Math.random() - 0.5) * 0.7); g.fillText(w[i % w.length], 0, 0); g.restore(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}
function glyphTex(k, color) {
  const c = document.createElement('canvas'); c.width = 256; c.height = 192; const g = c.getContext('2d');
  g.fillStyle = '#' + color.toString(16).padStart(6, '0'); g.fillRect(0, 0, 256, 192);
  g.strokeStyle = '#fff'; g.fillStyle = '#fff'; g.lineWidth = 16; g.lineCap = 'round'; g.lineJoin = 'round';
  if (k === 0) { g.beginPath(); g.moveTo(128, 30); g.lineTo(128, 120); g.moveTo(90, 86); g.lineTo(128, 124); g.lineTo(166, 86); g.stroke(); g.beginPath(); g.moveTo(66, 150); g.lineTo(190, 150); g.stroke(); }
  else if (k === 1) { [[96, 60], [150, 100], [66, 140]].forEach(([w, y]) => { g.beginPath(); g.moveTo(40, y); g.lineTo(40 + w + 40, y); g.stroke(); }); g.beginPath(); g.moveTo(210, 40); g.lineTo(210, 150); g.stroke(); }
  else if (k === 2) { g.beginPath(); g.roundRect(70, 84, 116, 78, 14); g.fill(); g.beginPath(); g.arc(128, 80, 36, Math.PI, 0); g.stroke(); g.fillStyle = '#' + color.toString(16).padStart(6, '0'); g.beginPath(); g.arc(128, 118, 11, 0, TAU); g.fill(); }
  else { g.beginPath(); g.moveTo(128, 150); g.lineTo(128, 60); g.moveTo(90, 94); g.lineTo(128, 56); g.lineTo(166, 94); g.stroke(); g.beginPath(); g.moveTo(66, 30); g.lineTo(190, 30); g.stroke(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}
const beam = (a, b, r, m) => {
  const d = b.clone().sub(a), len = d.length(); const mesh = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 1.15, len, 12), m);
  mesh.position.copy(a).addScaledVector(d, 0.5); mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize()); return mesh;
};

export default function build(ctx) {
  const g = new THREE.Group(); g.position.copy(P(0.43, 0.64)); g.scale.setScalar(0.9); ctx.stage.add(g);
  const H = hints(), found = finder(ctx, 4);
  const sh = blobShadow(0.62, 0.34, 0.32); g.add(sh);
  const wood = mat(0xb9803f, { roughness: 0.55 });
  // the A-frame stand
  const stand = new THREE.Group(); g.add(stand);
  [-1, 1].forEach((sx) => [-1, 1].forEach((sz) => stand.add(beam(new THREE.Vector3(sx * 0.045, HUB, 0), new THREE.Vector3(sx * 0.12, 0.004, sz * 0.15), 0.012, wood))));
  [-1, 1].forEach((sx) => stand.add(beam(new THREE.Vector3(sx * 0.082, 0.07, -0.075), new THREE.Vector3(sx * 0.082, 0.07, 0.075), 0.008, wood)));
  [-1, 1].forEach((sx) => [-1, 1].forEach((sz) => { const f = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.022, 0.012, 14), goldMat()); f.position.set(sx * 0.12, 0.006, sz * 0.15); stand.add(f); }));
  // the wheel
  const wheel = new THREE.Group(); wheel.position.set(0, HUB, 0); g.add(wheel);
  const slate = new THREE.Mesh(new THREE.CircleGeometry(R, 72), new THREE.MeshStandardMaterial({ map: chalkTex(), roughness: 0.9 })); slate.position.z = -0.012; wheel.add(slate);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(R, 0.013, 14, 90), mat(0xf4efe0, { roughness: 0.35 })); wheel.add(rim);
  const rim2 = new THREE.Mesh(new THREE.TorusGeometry(R * 0.5, 0.006, 10, 60), goldMat()); wheel.add(rim2);
  for (let i = 0; i < 8; i++) { const s = new THREE.Mesh(new THREE.BoxGeometry(0.008, R, 0.008), mat(0xf4efe0, { roughness: 0.4 })); s.geometry.translate(0, R / 2, 0); s.rotation.z = i / 8 * TAU; wheel.add(s); }
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.05, 28), goldMat()); hub.rotation.x = Math.PI / 2; wheel.add(hub);
  const hubGlow = softLight(0xffd27a, 0.2, 0.6); hubGlow.position.z = 0.03; wheel.add(hubGlow);
  const lights = Array.from({ length: 28 }, (_, i) => { const a = i / 28 * TAU; const b = new THREE.Mesh(new THREE.SphereGeometry(0.0085, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffe08a, toneMapped: false })); b.position.set(Math.cos(a) * R, Math.sin(a) * R, 0.012); wheel.add(b); return b; });
  // four cabins
  const cabins = ST.map((s, k) => {
    const a = Math.PI / 2 + k * TAU / 4;
    const pivot = new THREE.Group(); pivot.position.set(Math.cos(a) * R, Math.sin(a) * R, 0); wheel.add(pivot);
    const cab = new THREE.Group(); pivot.add(cab);
    [-0.03, 0.03].forEach((x) => cab.add(Object.assign(beam(new THREE.Vector3(x * 0.4, 0, 0), new THREE.Vector3(x, -0.045, 0), 0.0025, goldMat()), {})));
    const body = new THREE.Mesh(new RoundedBoxGeometry(0.13, 0.095, 0.07, 4, 0.014), glossy(s.c)); body.position.y = -0.095; cab.add(body);
    const roof = new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.036, 0.135, 16, 1, false, 0, Math.PI), goldMat()); roof.rotation.z = Math.PI / 2; roof.position.y = -0.045; roof.scale.set(1, 1.0, 1.05); cab.add(roof);
    const face = new THREE.Mesh(new THREE.PlaneGeometry(0.1, 0.075), new THREE.MeshBasicMaterial({ map: glyphTex(k, s.c), toneMapped: false })); face.position.set(0, -0.095, 0.0365); cab.add(face);
    const faceB = face.clone(); faceB.rotation.y = Math.PI; faceB.position.z = -0.0365; cab.add(faceB);
    const rimF = new THREE.Mesh(new THREE.TorusGeometry(0.0, 0.0, 4, 4), goldMat()); cab.add(rimF);
    cab.add(hitSphere(0.085, [0, -0.09, 0]));
    const halo = softLight(s.c, 0.26, 0); halo.position.set(0, -0.09, 0.05); cab.add(halo);
    shadowed(cab);
    ctx.tap(cab, () => pick(k));
    const hint = H.add(cab, 0xffe08a, 0.2, [0, -0.09, 0.06], 2.4 + k * 0.2);
    return { k, pivot, cab, halo, hint, a, pop: 0 };
  });
  const tag = tagSprite(ST[0].n, 0.24, ST[0].c); tag.visible = false; tag.userData.nm = ''; g.add(tag);
  let spin = 2.6, hold = 0, targetRot = null, lastK = -1, now = 0;
  const v = new THREE.Vector3();
  function pick(k) {
    const c = cabins[k]; ctx.sfx.pop?.(); c.pop = 1; c.hint.calm = true; found(k); lastK = k;
    // turn the wheel so this cabin hangs at the front-bottom, where it reads best
    const want = -(c.a - (-Math.PI / 2)); let d = ((want - wheel.rotation.z) % TAU + TAU) % TAU; if (d > Math.PI) d -= TAU; targetRot = wheel.rotation.z + d; hold = 4;
    ctx.fx.burst(new THREE.Vector3(0, HUB - R * 0.9, 0.06).add(g.position), ST[k].c, 24, 0.35, 0.03);
    const [a, b, t] = ST[k].card; ctx.ui.card({ tag: a, title: b, body: t, color: ST[k].c });
    ctx.ui.hud('الدورة تعود إلى أولها');
  }
  ctx.ui.hud('أدِر دورة المعلومة وامسّ كل مقصورة');
  return {
    update(t, dt, e) {
      now = t;
      sh.material.opacity = 0.32 * e;
      const sk = Math.max(stag(t, 0.1, 0.8, easeBack) * e, 0.001); stand.scale.set(sk, sk, sk);
      const wk = Math.max(stag(t, 0.3, 0.9, easeBack) * e, 0.001); wheel.scale.set(wk, wk, wk);
      // spin: fast at first, then calm; a touched cabin brings the wheel to rest for a moment
      if (hold > 0 && targetRot !== null) { hold -= dt; wheel.rotation.z += (targetRot - wheel.rotation.z) * Math.min(1, dt * 4); spin = 0; }
      else { targetRot = null; spin += (0.3 - spin) * Math.min(1, dt * 0.9); wheel.rotation.z += dt * spin; }
      lights.forEach((b, i) => { const k = 0.35 + 0.65 * Math.max(0, Math.sin(t * 5 - i * 0.55)); b.material.color.setRGB(1 * k + 0.25, 0.85 * k + 0.2, 0.5 * k + 0.1); b.scale.setScalar(0.7 + k * 0.6); b.visible = t > 0.8; });
      hubGlow.material.opacity = 0.35 + 0.15 * Math.sin(t * 3);
      cabins.forEach((c, i) => {
        c.cab.rotation.z = -wheel.rotation.z + Math.sin(t * 1.7 + i) * 0.05;
        c.pop = Math.max(0, c.pop - dt * 0.4);
        const ck = Math.max(stag(t, 0.8 + i * 0.15, 0.7, easeBack) * e, 0.001); c.cab.scale.setScalar(ck * (1 + c.pop * 0.18));
        c.halo.material.opacity = c.pop * 0.7;
      });
      if (lastK >= 0 && t - 0 > 0) {
        const c = cabins[lastK]; c.cab.getWorldPosition(v); g.worldToLocal(v); tag.position.set(v.x, v.y + 0.13, v.z + 0.02); tag.visible = c.pop > 0.02 || hold > 0;
        if (tag.userData.nm !== ST[lastK].n) { tag.userData.nm = ST[lastK].n; const nt = tagSprite(ST[lastK].n, 0.24, ST[lastK].c); tag.material.map = nt.material.map; tag.userData.aspect = nt.userData.aspect; }
        setSpr(tag, 0.24, e);
      }
      H.update(t, e);
    },
  };
}
