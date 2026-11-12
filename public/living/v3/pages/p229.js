// p229 — anatomy of the system unit as a technical exploded view: a silver case, a green motherboard with its sockets, a cooled CPU, RAM sticks, a hard disk and a disc drive that lift out, hover and dock back in.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { P, ease, easeBack, clamp01, stag, mat, glossy, goldMat, shadowed } from '../../kit.js?v=29';
import { tagSprite, setSpr, softLight } from '../../v2/common.js?v=29';
import { hints, finder, blobShadow, hitSphere } from '../lib/a3-kit.js?v=29';

export const meta = { free: true, center: [0.41, 0.38], typeLabel: 'تشريح مجسّم' };

const GOLD = 0xd4ad55, TAU = Math.PI * 2;
const INFO = {
  mobo: ['اللوحة الأم', 'لوحة إلكترونية داخل وحدة النظام، يُوصَل بها مباشرة معظم المكوّنات الأساسية: المعالج والذواكر وكروت توصيل الأجهزة الأخرى.', 0x2c9a5a],
  cpu: ['وحدة المعالجة المركزية', 'رقاقة سيليكون صغيرة تحوي دوائر معقدة، من وحدة الحساب والمنطق ووحدة التحكم، وهي بمثابة الدماغ. تُقاس سرعتها بالميغاهيرتز.', 0xe0603a],
  ram: ['الذاكرة الرئيسية', 'تتكوّن من ذاكرة الوصول العشوائي (RAM) وذاكرة القراءة فقط (ROM).', 0x3b8fd0],
  hdd: ['القرص الثابت (الصلب)', 'مساحة التخزين الرئيسية الكبيرة؛ يُخزَّن فيه نظام التشغيل والبرامج، ويمتاز بسرعة عالية في الوصول إلى البيانات.', 0x8a96a0],
  odd: ['مشغّلات الأقراص', 'مشغّل الأقراص المرنة يعتمد على المغنطة، أما مشغّل القرص الليزري فيقرأ البيانات ويخزّنها بشعاع الليزر.', 0xb36ad0],
  case: ['وحدة النظام', 'الصندوق الذي توجد داخله اللوحة الأم وتتصل به وحدات الإدخال والإخراج.', GOLD],
};
const asg = (m, o) => { if (o.position) m.position.copy(o.position); if (o.rotation) m.rotation.copy(o.rotation); return m; };
const M = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.5, metalness: 0.1, ...o });
const box = (w, h, d, m, x = 0, y = 0, z = 0, r = 0.0015) => { const b = new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 2, Math.min(r, w / 2.1, h / 2.1, d / 2.1)), m); b.position.set(x, y, z); return b; };
function discTex() {
  const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d');
  const gr = g.createConicGradient ? g.createConicGradient(0, 128, 128) : null;
  if (gr) { ['#ff6a9a', '#ffd36a', '#7affb0', '#6ab4ff', '#c58aff', '#ff6a9a'].forEach((cl, i) => gr.addColorStop(i / 5, cl)); g.fillStyle = gr; } else g.fillStyle = '#c8d4ff';
  g.beginPath(); g.arc(128, 128, 126, 0, TAU); g.fill(); g.fillStyle = 'rgba(255,255,255,.55)'; g.beginPath(); g.arc(128, 128, 60, 0, TAU); g.fill(); g.fillStyle = '#2b2f33'; g.beginPath(); g.arc(128, 128, 18, 0, TAU); g.fill();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

export default function build(ctx) {
  const g = new THREE.Group(); g.position.copy(P(0.41, 0.38)); g.scale.setScalar(0.86); ctx.stage.add(g);
  const H = hints(), found = finder(ctx, 5);
  const sh = blobShadow(0.9, 0.62, 0.3); g.add(sh);
  const rig = new THREE.Group(); g.add(rig);
  const silver = M(0xc9d0d6, { metalness: 0.65, roughness: 0.32 }), darkM = M(0x20262a, { roughness: 0.6 });

  // ---------------- the case: an open silver tray
  const caseG = new THREE.Group(); rig.add(caseG);
  const W = 0.5, D = 0.36, WH = 0.17;
  caseG.add(box(W, 0.016, D, darkM, 0, 0.008, 0, 0.004));
  caseG.add(box(W, WH, 0.012, silver, 0, WH / 2 + 0.008, -D / 2, 0.003));
  [-1, 1].forEach((s) => caseG.add(box(0.012, WH, D, silver, s * W / 2, WH / 2 + 0.008, 0, 0.003)));
  caseG.add(box(W, 0.035, 0.012, silver, 0, 0.0255, D / 2, 0.003));
  // ventilation slots on the back wall, gold trim
  for (let i = 0; i < 8; i++) caseG.add(box(0.03, 0.006, 0.003, darkM, -0.19 + i * 0.054, 0.15, -D / 2 + 0.008, 0.001));
  [-1, 1].forEach((s) => caseG.add(box(0.014, 0.004, D + 0.004, goldMat(), s * W / 2, WH + 0.01, 0, 0.001)));
  caseG.add(box(W + 0.004, 0.004, 0.014, goldMat(), 0, WH + 0.01, -D / 2, 0.001));
  [[-0.2, -0.12], [0.2, -0.12], [-0.2, 0.1], [0.2, 0.1]].forEach(([x, z]) => caseG.add(asg(new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.05, 10), goldMat()), { position: new THREE.Vector3(x, 0.04, z) })));
  shadowed(caseG);
  ctx.tap(caseG, () => { if (auto) return; asmTo = asmTo ? 0 : 1; ctx.sfx.whoosh?.(); card('case'); });

  const parts = [];
  const mk = (id, model, home, away, extra) => {
    const grp = new THREE.Group(); grp.add(model); rig.add(grp);
    if (extra) grp.add(extra);
    const p = { id, grp, model, home: new THREE.Vector3(...home), away: new THREE.Vector3(...away), flash: 0, delay: parts.length * 0.2 };
    ctx.tap(grp, () => pick(id));
    p.hint = H.add(grp, INFO[id][2], 0.14, [0, 0.03, 0], 2.8 + parts.length * 0.2);
    parts.push(p); return p;
  };

  // ---------------- motherboard
  const mobo = new THREE.Group();
  mobo.add(box(0.38, 0.008, 0.28, M(0x1f8a52, { roughness: 0.35 }), 0, 0, 0, 0.004));
  const pcb = (m, x, z, w, d, h = 0.01) => { mobo.add(box(w, h, d, m, x, 0.004 + h / 2, z)); };
  pcb(darkM, -0.06, -0.01, 0.075, 0.075, 0.008); mobo.add(box(0.05, 0.003, 0.05, goldMat(), -0.06, 0.0125, -0.01));
  [0.06, 0.077, 0.094, 0.111].forEach((x) => pcb(M(0x14181b), x, -0.01, 0.009, 0.12, 0.01));
  [0.07, 0.1].forEach((z) => pcb(M(0x14181b), -0.04, z, 0.14, 0.014, 0.01));
  pcb(M(0xd4ad55, { metalness: 0.7, roughness: 0.35 }), 0.04, 0.07, 0.05, 0.05, 0.016);
  for (let i = 0; i < 5; i++) mobo.add(box(0.05, 0.012, 0.003, M(0xe9c97a, { metalness: 0.7 }), 0.04, 0.0245, 0.052 + i * 0.01));
  pcb(M(0xf1f1f1), 0.17, 0.0, 0.018, 0.08, 0.012);
  const io = mobo.add(new THREE.Group()); [[-0.13, 0x9aa3a8, 0.032, 0.02], [-0.09, 0x2a6fb0, 0.024, 0.022], [-0.06, 0x2a6fb0, 0.024, 0.022], [-0.03, 0x9aa3a8, 0.026, 0.026], [0.0, 0x20262a, 0.016, 0.016], [0.02, 0x3aa86a, 0.016, 0.016], [0.04, 0xd63a8c, 0.016, 0.016]].forEach(([x, c, w, d]) => mobo.add(box(w, 0.016, d, M(c, { metalness: 0.4 }), x, 0.012, -0.12, 0.002)));
  mobo.add(box(0.15, 0.002, 0.003, goldMat(), -0.04, 0.0045, 0.0)); for (let i = 0; i < 7; i++) mobo.add(box(0.12 - i * 0.01, 0.002, 0.0025, goldMat(), -0.03 + (i % 3) * 0.02, 0.0045, -0.095 + i * 0.012));
  const caps = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.0055, 0.0055, 0.014, 10), M(0xffffff, { metalness: 0.3 }), 20); const mx = new THREE.Matrix4(), cc = new THREE.Color();
  for (let i = 0; i < 20; i++) { const a = i / 20 * TAU; mx.makeTranslation(-0.06 + Math.cos(a) * 0.06, 0.011, -0.01 + Math.sin(a) * 0.058); caps.setMatrixAt(i, mx); caps.setColorAt(i, cc.setHex([0xd4ad55, 0x20262a, 0x2a6fb0][i % 3])); } mobo.add(caps);
  const batt = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.006, 24), M(0xd9dee2, { metalness: 0.9, roughness: 0.2 })); batt.position.set(0.12, 0.011, 0.09); mobo.add(batt);
  [[-0.17, -0.12], [0.17, -0.12], [-0.17, 0.12], [0.17, 0.12]].forEach(([x, z]) => { const h = new THREE.Mesh(new THREE.CylinderGeometry(0.007, 0.007, 0.002, 14), goldMat()); h.position.set(x, 0.0045, z); mobo.add(h); });
  shadowed(mobo);
  mk('mobo', mobo, [0, 0.085, -0.02], [0, 0.2, -0.03]);

  // ---------------- CPU with heatsink and fan
  const cpu = new THREE.Group();
  cpu.add(box(0.058, 0.006, 0.058, M(0x1d6b3f), 0, 0, 0)); cpu.add(box(0.038, 0.004, 0.038, M(0xdfe5e9, { metalness: 0.9, roughness: 0.2 }), 0, 0.005, 0, 0.002));
  const hs = new THREE.Group(); hs.position.y = 0.012; cpu.add(hs);
  hs.add(box(0.075, 0.008, 0.075, M(0xb9c1c7, { metalness: 0.85, roughness: 0.3 }), 0, 0.004, 0, 0.002));
  for (let i = 0; i < 9; i++) hs.add(box(0.072, 0.032, 0.0035, M(0xcfd6db, { metalness: 0.85, roughness: 0.28 }), 0, 0.024, -0.032 + i * 0.008, 0.0008));
  const fan = new THREE.Group(); fan.position.y = 0.045; cpu.add(fan); fan.rotation.x = 0;
  fan.add(asg(new THREE.Mesh(new THREE.TorusGeometry(0.036, 0.004, 8, 32), darkM), { rotation: new THREE.Euler(Math.PI / 2, 0, 0) }));
  const blades = new THREE.Group(); fan.add(blades);
  for (let i = 0; i < 7; i++) { const b = box(0.032, 0.0015, 0.014, M(0xf2f4f6, { roughness: 0.3 }), Math.cos(i / 7 * TAU) * 0.02, 0, Math.sin(i / 7 * TAU) * 0.02, 0.0007); b.rotation.y = -i / 7 * TAU; b.rotation.x = 0.3; blades.add(b); }
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.009, 0.006, 14), goldMat()); blades.add(hub);
  cpu.add(hitSphere(0.06, [0, 0.025, 0])); shadowed(cpu);
  const cpuGlow = softLight(0xff8a4a, 0.14, 0.4); cpuGlow.position.y = 0.01; cpu.add(cpuGlow);
  const cpuP = mk('cpu', cpu, [-0.06, 0.103, -0.03], [-0.06, 0.37, -0.01]);

  // ---------------- RAM sticks
  const ram = new THREE.Group();
  [0, 1].forEach((i) => { const s = new THREE.Group(); s.position.x = i * 0.017;
    s.add(box(0.006, 0.072, 0.1, M(0x1c6b3c), 0, 0.036, 0, 0.001));
    s.add(box(0.009, 0.05, 0.09, M(i ? 0xd4402a : 0x2b6fd0, { metalness: 0.5, roughness: 0.3 }), 0, 0.04, 0, 0.0015));
    s.add(box(0.0095, 0.008, 0.07, goldMat(), 0, 0.074, 0, 0.001)); s.add(box(0.0065, 0.004, 0.092, goldMat(), 0, 0.002, 0, 0.001));
    ram.add(s); });
  ram.position.x = -0.0085; ram.add(hitSphere(0.07, [0.008, 0.04, 0])); shadowed(ram);
  mk('ram', ram, [0.0775, 0.09, -0.01], [0.17, 0.3, -0.04]);
  ram.parent.rotation.y = 0;

  // ---------------- hard disk
  const hdd = new THREE.Group();
  hdd.add(box(0.1, 0.03, 0.14, M(0xaeb7bd, { metalness: 0.85, roughness: 0.28 }), 0, 0.015, 0, 0.004));
  hdd.add(box(0.07, 0.002, 0.08, M(0xf4efe0), 0, 0.031, -0.006, 0.0005));
  for (let i = 0; i < 4; i++) hdd.add(box(0.05, 0.0016, 0.003, M(0x2b2620), 0, 0.0325, -0.03 + i * 0.013, 0.0003));
  [[-0.04, -0.06], [0.04, -0.06], [-0.04, 0.06], [0.04, 0.06]].forEach(([x, z]) => { const sc = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.002, 10), goldMat()); sc.position.set(x, 0.031, z); hdd.add(sc); });
  hdd.add(box(0.05, 0.012, 0.012, darkM, 0, 0.012, 0.075, 0.002)); for (let i = 0; i < 5; i++) hdd.add(box(0.004, 0.003, 0.003, goldMat(), -0.016 + i * 0.008, 0.012, 0.0825, 0.0003));
  hdd.add(hitSphere(0.08, [0, 0.02, 0])); shadowed(hdd);
  mk('hdd', hdd, [0.14, 0.017, 0.08], [0.32, 0.14, 0.12]);

  // ---------------- disc drive with a disc on the tray
  const odd = new THREE.Group();
  odd.add(box(0.1, 0.03, 0.14, M(0x6f777e, { metalness: 0.6, roughness: 0.35 }), 0, 0.015, 0, 0.004));
  odd.add(box(0.1, 0.03, 0.008, M(0xf1ecdd, { roughness: 0.4 }), 0, 0.015, 0.073, 0.003));
  odd.add(box(0.07, 0.003, 0.009, darkM, 0, 0.02, 0.074, 0.001)); odd.add(box(0.012, 0.006, 0.01, M(0x9a9fa5), 0.036, 0.007, 0.074, 0.002));
  const tray = new THREE.Group(); odd.add(tray);
  tray.add(box(0.09, 0.003, 0.09, M(0xdfe3e6, { metalness: 0.5 }), 0, 0.031, 0.1, 0.002));
  const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.036, 0.0015, 40), new THREE.MeshStandardMaterial({ map: discTex(), metalness: 0.8, roughness: 0.18 })); disc.position.set(0, 0.034, 0.1); tray.add(disc);
  odd.add(hitSphere(0.08, [0, 0.02, 0.04])); shadowed(odd);
  mk('odd', odd, [-0.14, 0.017, 0.08], [-0.33, 0.14, 0.12]);

  const tag = tagSprite('اللوحة الأم', 0.22, GOLD); tag.visible = false; g.add(tag); tag.userData.nm = '';
  let tagFor = null, asm = 0, asmTo = 0, auto = true, now = 0;
  function card(id) { const [a, b, c] = INFO[id]; ctx.ui.card({ tag: 'وحدة النظام', title: a, body: b, color: c }); found(id); }
  function pick(id) {
    const p = parts.find((q) => q.id === id); p.flash = 1; p.hint.calm = true; ctx.sfx.pop?.(); card(id);
    tagFor = p; ctx.ui.hud('المس بقية المكوّنات، أو المس الصندوق ليجمعها');
  }
  ctx.ui.hud('المس كل مكوّن لتعرف عمله');
  const v = new THREE.Vector3();
  return {
    update(t, dt, e) {
      now = t;
      sh.material.opacity = 0.3 * e;
      const ck = Math.max(stag(t, 0.1, 0.8, easeBack) * e, 0.001); caseG.scale.set(ck, ck, ck);
      if (auto) { asmTo = t > 3.4 && t < 6.0 ? 1 : 0; if (t > 6.0) auto = false; }
      asm += (asmTo - asm) * Math.min(1, dt * 2.6);
      rig.rotation.y = Math.sin(t * 0.4) * 0.18;
      parts.forEach((p, i) => {
        const k = Math.max(stag(t, 0.35 + p.delay, 0.8, easeBack) * e, 0.001);
        const a = ease(asm);
        p.grp.scale.setScalar(k * (1 + 0.25 * (1 - a)));
        v.lerpVectors(p.away, p.home, a); v.y += (1 - a) * Math.sin(t * 1.3 + i) * 0.008 + Math.sin(a * Math.PI) * 0.03 - (1 - clamp01((t - 0.35 - p.delay) / 0.9)) * 0.1;
        p.grp.position.copy(v);
        p.flash = Math.max(0, p.flash - dt * 1.2);
        p.grp.rotation.y = (1 - a) * (Math.sin(t * 0.6 + i) * 0.35 + p.flash * 1.4);
        p.grp.scale.multiplyScalar(1 + p.flash * 0.1);
      });
      blades.rotation.y -= dt * (6 + cpuP.flash * 14);
      tray.position.z = 0.05 * (0.5 + 0.5 * Math.sin(t * 1.1)) * (1 - ease(asm)); disc.rotation.y += dt * 2;
      cpuGlow.material.opacity = 0.3 + 0.15 * Math.sin(t * 3) + cpuP.flash * 0.4;
      if (tagFor) { tagFor.grp.getWorldPosition(v); g.worldToLocal(v); tag.position.set(v.x, v.y + 0.13, v.z); tag.visible = true; const nm = INFO[tagFor.id][0]; if (tag.userData.nm !== nm) { tag.userData.nm = nm; const w = nm.length > 12 ? 0.34 : 0.25; const nt = tagSprite(nm, w, INFO[tagFor.id][2]); tag.material.map = nt.material.map; tag.userData.aspect = nt.userData.aspect; tag.userData.w = w; } setSpr(tag, tag.userData.w || 0.25, e); }
      H.update(t, e);
    },
  };
}
