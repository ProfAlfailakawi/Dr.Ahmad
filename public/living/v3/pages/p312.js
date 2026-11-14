import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { P, ease, easeBack, clamp01, stag, mat, glossy, goldMat, shadowed, glow, sprite } from '../../kit.js?v=34';
import { Rig, V, TAU } from '../lib/b5-kit.js?v=34';
import { lightPool } from '../../v2/common.js?v=34';

export const meta = { free: true, center: [0.5, 0.72], typeLabel: 'مقارنة بمنزلق' };

const DX = 0.1, R = 0.28; // disc centre x, radius
const PLX = -0.37;       // plinth x
const hex = (c) => '#' + c.toString(16).padStart(6, '0');

function screenTex() {
  const c = document.createElement('canvas'); c.width = 256; c.height = 180; const g = c.getContext('2d');
  const gr = g.createLinearGradient(0, 0, 256, 180); gr.addColorStop(0, '#2b8fb5'); gr.addColorStop(1, '#1b4f86'); g.fillStyle = gr; g.fillRect(0, 0, 256, 180);
  g.strokeStyle = 'rgba(255,255,255,.85)'; g.lineWidth = 7; g.lineCap = 'round'; g.beginPath(); g.moveTo(30, 130); g.lineTo(80, 90); g.lineTo(120, 110); g.lineTo(170, 60); g.lineTo(226, 40); g.stroke();
  [[30, 130], [80, 90], [120, 110], [170, 60], [226, 40]].forEach(([x, y]) => { g.fillStyle = '#ffd27a'; g.beginPath(); g.arc(x, y, 9, 0, TAU); g.fill(); });
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

export default function build(ctx) {
  const g = new THREE.Group(); g.position.copy(P(meta.center[0], meta.center[1])); g.scale.setScalar(0.9); g.position.x += 0.1; ctx.stage.add(g);
  const rig = new Rig(ctx);
  const pool = lightPool(0xd9a21f, 0.5, 0); pool.position.set(0, 0.002, 0); pool.scale.set(1.7, 1.7, 1.0); g.add(pool); rig.fn((p) => { pool.material.opacity = 0.25 * p; }, 0.1, 1);

  // institution disc
  const disc = new THREE.Group(); disc.position.set(DX, 0, 0); g.add(disc);
  const dBase = new THREE.Mesh(new THREE.CylinderGeometry(R, R * 1.03, 0.03, 72), glossy(0xf4ead4, { roughness: 0.45 })); dBase.position.y = 0.015; disc.add(shadowed(dBase));
  const dRim = new THREE.Mesh(new THREE.TorusGeometry(R * 1.01, 0.006, 10, 90), goldMat()); dRim.rotation.x = Math.PI / 2; dRim.position.y = 0.03; disc.add(dRim);
  const dTop = new THREE.Mesh(new THREE.CylinderGeometry(R * 0.96, R * 0.96, 0.004, 72), mat(0x20364f, { roughness: 0.6 })); dTop.position.y = 0.031; disc.add(dTop);
  rig.add(disc, 0.1, 0.9, 'pop');

  // woven fabric (instanced short threads)
  const S = 0.046, cells = [];
  for (let i = -6; i <= 6; i++) for (let j = -6; j <= 6; j++) { const x = i * S, z = j * S; if (Math.hypot(x, z) < R * 0.93) cells.push({ x, z, h: (i + j) & 1 }); }
  const th = new THREE.InstancedMesh(new RoundedBoxGeometry(1, 1, 1, 2, 0.4), new THREE.MeshStandardMaterial({ roughness: 0.45 }), cells.length);
  const cols = [0x1c8fa8, 0xe0a52f, 0x2b6fc0, 0xd9663f]; const colr = new THREE.Color();
  cells.forEach((c, k) => { colr.setHex(cols[(c.h ? 0 : 2) + ((k * 7) % 2)]); th.setColorAt(k, colr); });
  th.position.y = 0.036; disc.add(th); th.castShadow = true;
  const dm = new THREE.Object3D();
  const setThreads = (w, lp, t) => {
    cells.forEach((c, k) => {
      const d = Math.hypot(c.x - lp.x, c.z - lp.z) / R;
      const p = clamp01(w * 1.6 - d * 0.9); const e = 0.2 + 0.8 * easeBack(p);
      dm.position.set(c.x, (c.h ? 0.003 : -0.001) * e + Math.sin(t * 2 + c.x * 12 + c.z * 9) * 0.0012 * p, c.z);
      dm.rotation.set(0, 0, 0);
      if (c.h) dm.scale.set(S * 0.98 * e + 0.0001, 0.006 * e + 0.0001, S * 0.32 * e + 0.0001); else dm.scale.set(S * 0.32 * e + 0.0001, 0.006 * e + 0.0001, S * 0.98 * e + 0.0001);
      dm.updateMatrix(); th.setMatrixAt(k, dm.matrix);
    });
    th.instanceMatrix.needsUpdate = true;
  };
  setThreads(0, V(0, 0, 0), 0);

  // plinth + glass case at the margin
  const pl = new THREE.Group(); pl.position.set(PLX, 0, 0.0); g.add(pl);
  const plb = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.09, 0.1, 40), glossy(0xe0b85e, { roughness: 0.25, metalness: 0.3 })); plb.position.y = 0.05; pl.add(shadowed(plb));
  const plt = new THREE.Mesh(new THREE.CylinderGeometry(0.095, 0.095, 0.014, 40), goldMat()); plt.position.y = 0.107; pl.add(plt);
  const case_ = new THREE.Mesh(new THREE.SphereGeometry(0.13, 36, 18, 0, TAU, 0, Math.PI / 2), new THREE.MeshPhysicalMaterial({ color: 0xe6f1f6, transparent: true, opacity: 0.28, roughness: 0.04, side: THREE.DoubleSide, depthWrite: false })); case_.position.y = 0.114; pl.add(case_);
  const caseRing = new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.003, 6, 40), goldMat()); caseRing.rotation.x = Math.PI / 2; caseRing.position.y = 0.114; pl.add(caseRing);
  rig.add(pl, 0.4, 0.9, 'pop');

  // laptop
  const lap = new THREE.Group(); g.add(lap);
  const lb = new THREE.Mesh(new RoundedBoxGeometry(0.2, 0.012, 0.14, 3, 0.005), glossy(0xdfe3ea, { roughness: 0.3 })); lb.position.y = 0.006; lap.add(shadowed(lb));
  const keys = new THREE.InstancedMesh(new RoundedBoxGeometry(0.014, 0.005, 0.014, 2, 0.002), mat(0x3a3f4a), 40); let kk = 0;
  for (let r = 0; r < 4; r++) for (let c = 0; c < 10; c++) { dm.position.set(-0.09 + c * 0.02, 0.014, -0.02 + r * 0.02 - 0.01); dm.scale.set(1, 1, 1); dm.rotation.set(0, 0, 0); dm.updateMatrix(); keys.setMatrixAt(kk++, dm.matrix); }
  lap.add(keys);
  const pad = new THREE.Mesh(new RoundedBoxGeometry(0.06, 0.002, 0.03, 2, 0.001), mat(0xc3c8d0)); pad.position.set(0, 0.0125, 0.052); lap.add(pad);
  const hinge = new THREE.Group(); hinge.position.set(0, 0.012, -0.07); hinge.rotation.x = -0.28; lap.add(hinge);
  const lid = new THREE.Mesh(new RoundedBoxGeometry(0.2, 0.14, 0.008, 3, 0.004), glossy(0xdfe3ea, { roughness: 0.3 })); lid.position.set(0, 0.07, 0); hinge.add(shadowed(lid));
  const sc = new THREE.Mesh(new THREE.PlaneGeometry(0.185, 0.127), new THREE.MeshBasicMaterial({ map: screenTex(), toneMapped: false })); sc.position.set(0, 0.07, 0.0045); hinge.add(sc);
  const lgl = glow(0x6fd0ff, 0.34, 0.5); lgl.position.set(0, 0.07, 0.04); hinge.add(lgl);
  rig.add(lap, 0.8, 0.8, 'pop');
  // blocks (the learners' toys)
  const blocks = new THREE.Group(); disc.add(blocks); rig.add(blocks, 1.1, 0.8, 'pop');
  const b1 = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.05, 3), glossy(0xe86fa6)); b1.rotation.z = Math.PI / 2; b1.position.set(-0.16, 0.06, 0.14); b1.rotation.set(0, 0.5, Math.PI / 2);
  const b2 = new THREE.Mesh(new RoundedBoxGeometry(0.05, 0.06, 0.05, 3, 0.006), glossy(0x7ec34d)); b2.position.set(0.12, 0.066, 0.17); b2.rotation.y = 0.6;
  const b3 = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.05, 28), glossy(0x2f8fe0)); b3.position.set(0.19, 0.06, -0.08);
  [b1, b2, b3].forEach((b) => blocks.add(shadowed(b)));

  const lab1 = sprite('على الهامش', 0.2, { size: 50, width: 420, weight: 800, border: '#d9a21f' }); lab1.position.set(PLX, 0.36, 0.0); g.add(lab1);
  const lab2 = sprite('في الصميم', 0.19, { size: 50, width: 420, weight: 800, border: '#1c8fa8' }); lab2.position.set(DX, 0.34, -0.36); g.add(lab2);
  lab1.userData.w = 0.2; lab2.userData.w = 0.19;

  let s = 0, target = 0, now = 0, seen = new Set(), doneF = false, auto = true; let slideEl;
  const LAP0 = V(PLX, 0.114, 0), LAP1 = V(DX, 0.035, 0.02);
  const see = (k) => { seen.add(k); if (seen.size >= 4 && !doneF && s > 0.8) { doneF = true; setTimeout(() => ctx.ui.done(), 2500); } };
  const setTarget = (v) => { target = v; auto = false; };
  rig.touch(lap, () => { ctx.sfx.whoosh?.(); setTarget(target > 0.5 ? 0 : 1); if (target > 0.5) ctx.ui.card({ tag: 'نظرة الدول المتقدمة', title: 'جزء من النسيج', body: 'التكنولوجيا جزء من نسيج العملية التعليمية بل والمجتمع، وليست مجرد ترف.', color: 0x1c8fa8 }); else ctx.ui.card({ tag: 'الاعتقاد السائد', title: 'جهاز مستورد', body: 'ظنّوا أن استيراد الأجهزة والمواد وإدخالها في المدارس يحقق الحداثة.', color: 0xd9a21f }); see('l'); }, { color: 0x6fd0ff, size: 0.3, at: V(0, 0.07, 0), show: 3 });
  rig.touch(pl, (h) => { ctx.sfx.pop?.(); h.on = false; ctx.ui.card({ tag: 'الاعتقاد السائد', title: 'نوع من الرفاهية', body: 'ينظر بعضهم إلى التكنولوجيا على أنها رفاهية، لا مكوّن أصيل في العملية التعليمية.', color: 0xd9a21f }); see('p'); }, { color: 0xe0b85e, size: 0.22, at: V(0, 0.12, 0), show: 3.4 });
  rig.touch(blocks, (h) => { ctx.sfx.pop?.(); h.on = false; blocks.userData.bounce = now; ctx.ui.card({ tag: 'سؤال', title: 'أين المستفيد؟', body: 'يُنسى المستفيد الحقيقي من ذلك كله.', color: 0xe86fa6 }); see('b'); }, { color: 0xe86fa6, size: 0.2, at: V(0.0, 0.08, 0.1), show: 3.8 });
  ctx.ui.slider?.({ label: 'الموقع', value: 0, onInput: (v) => { setTarget(v); } });

  return {
    update(t, dt, e) {
      now = t; rig.update(t, dt, e);
      if (auto && t > 4.2) target = 1;
      s += (target - s) * Math.min(1, dt * 1.8); const k = ease(s);
      lap.position.lerpVectors(LAP0, LAP1, k); lap.position.y += Math.sin(k * Math.PI) * 0.1 + (k < 0.02 ? Math.sin(t * 1.4) * 0.004 : 0); lap.rotation.y = (1 - k) * 0.35 + Math.sin(k * Math.PI) * 0.5;
      lgl.material.opacity = 0.35 + 0.15 * Math.sin(t * 2);
      const lw = lap.position.x - DX; setThreads(clamp01((k - 0.35) / 0.65) * e, V(lw * 0.2, 0, lap.position.z), t);
      case_.material.opacity = 0.28; caseRing.visible = true;
      const bb = clamp01(1 - (now - (blocks.userData.bounce ?? -9)) / 0.7); blocks.position.y = Math.sin(bb * Math.PI) * 0.03 + clamp01((k - 0.4) * 2) * 0.004;
      b1.rotation.y = 0.5 + clamp01((k - 0.5) * 2) * Math.sin(t * 2) * 0.3; b2.rotation.y = 0.6 + (1 - Math.min(1, k * 2)) * 0;
      const f1 = clamp01((t - 3.6) / 0.6) * (1 - k) * e, f2 = clamp01((t - 3.6) / 0.6) * k * e;
      lab1.scale.set(lab1.userData.w * f1 + 0.0001, lab1.userData.w * lab1.userData.aspect * f1 + 0.0001, 1); lab2.scale.set(lab2.userData.w * f2 + 0.0001, lab2.userData.w * lab2.userData.aspect * f2 + 0.0001, 1);
      lab1.visible = f1 > 0.05; lab2.visible = f2 > 0.05;
    },
  };
}
