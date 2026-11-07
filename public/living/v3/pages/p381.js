// p381 — a graduation cap sprouts six glowing branches; each ends in a glass orb holding one benefit of mobile learning.
import * as THREE from 'three';
import { P, ease, easeBack, clamp01, stag, mat, glossy, goldMat, shadowed, lightTube, glow } from '../../kit.js?v=15';
import { TAU, canvasTex, rbox, lit, rig, hints, burstAt, lightPool, tagSprite, setSpr, hexSlab, glass } from '../lib/a7.js?v=15';

export const meta = { free: true, center: [0.4, 0.55], typeLabel: 'مخطط ينمو' };

const NODES = [
  { k: 'com', l: 'الاتصال والتفاعل', c: 0x4a8fd0, b: 'اتصال وتفاعل بين أطراف المجتمع التعليمي دون الحاجة للجلوس في أماكن وأوقات محددة أمام الشاشات الكبيرة.' },
  { k: 'size', l: 'صغر الحجم', c: 0xe8604c, b: 'أصغر حجماً من الحواسيب المكتبية التي تتطلب مساحة كبيرة، وأسهل حملاً من الحقائب المليئة بالملفات.' },
  { k: 'pen', l: 'الكتابة بالقلم', c: 0xe8b23a, b: 'الكتابة اليدوية في الأجهزة الرقمية بالقلم أسهل من استخدام لوحة المفاتيح والفأرة.' },
  { k: 'self', l: 'التعلّم الذاتي', c: 0x2fa38a, b: 'يدعم الطابع الشخصي ويحسّن التعلّم الذاتي.' },
  { k: 'bar', l: 'إزالة الحواجز', c: 0xb05ad8, b: 'يزيل الحواجز بين الطالب والمدرسة فيما يتعلق بالاتصال أو الثقافة.' },
  { k: 'act', l: 'حيوية وجذب', c: 0xf08a3a, b: 'يضيف مزيداً من الأنشطة إلى الدروس التقليدية فيحقق الحيوية والجذب للمادة العلمية وبيئة التعلم.' },
];

const ICON = {
  com() { const o = new THREE.Group(); const a = new THREE.Mesh(rbox(0.04, 0.028, 0.008, 0.01), glossy(0x4a8fd0)); a.position.set(-0.01, 0.01, 0); const b = new THREE.Mesh(rbox(0.04, 0.028, 0.008, 0.01), glossy(0xf4efe0)); b.position.set(0.012, -0.014, 0.01); o.add(a, b); return o; },
  size() { const o = new THREE.Group(); const big = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 0.06), new THREE.MeshBasicMaterial({ color: 0xe8604c, wireframe: true, transparent: true, opacity: 0.6 })); const sm = new THREE.Mesh(rbox(0.022, 0.034, 0.008, 0.005), glossy(0xe8604c)); o.add(big, sm); return o; },
  pen() { const o = new THREE.Group(); const b = new THREE.Mesh(new THREE.CylinderGeometry(0.007, 0.007, 0.06, 6), glossy(0xf2c230)); const t = new THREE.Mesh(new THREE.ConeGeometry(0.007, 0.016, 6), glossy(0xf1d3a8)); t.position.y = -0.038; const l = new THREE.Mesh(new THREE.ConeGeometry(0.0028, 0.007, 6), mat(0x333333)); l.position.y = -0.049; o.add(b, t, l); o.rotation.z = 0.7; return o; },
  self() { const o = new THREE.Group(); const h = new THREE.Mesh(new THREE.SphereGeometry(0.014, 18, 12), glossy(0xf1c9a4)); h.position.y = 0.022; const s = new THREE.Mesh(new THREE.SphereGeometry(0.026, 20, 10, 0, TAU, 0, Math.PI / 2), glossy(0x2fa38a)); s.position.y = -0.02; const bk = new THREE.Mesh(rbox(0.036, 0.004, 0.026, 0.002), glossy(0xf4efe0)); bk.position.set(0, -0.018, 0.026); bk.rotation.x = -0.5; o.add(h, s, bk); return o; },
  bar() { const o = new THREE.Group(); [[-0.02, -0.02, 0], [0.02, -0.02, 0], [-0.02, 0.006, 0], [0.026, 0.02, 0.012]].forEach(([x, y, r], i) => { const b = new THREE.Mesh(rbox(0.036, 0.02, 0.02, 0.003), glossy(i === 3 ? 0xd8a0f0 : 0xb05ad8)); b.position.set(x, y, 0); b.rotation.z = i === 3 ? 0.5 : r; o.add(b); }); return o; },
  act() { const o = new THREE.Group(); const s = new THREE.Mesh(new THREE.OctahedronGeometry(0.03, 0), glossy(0xf2c230, { emissive: 0xf08a3a, emissiveIntensity: 0.3 })); s.scale.set(1, 1.3, 0.6); o.add(s); return o; },
};

export default function build(ctx) {
  const g = new THREE.Group(); g.position.copy(P(meta.center[0], meta.center[1])); ctx.stage.add(g); g.scale.setScalar(1.0);
  const R = rig(), H = hints(g);
  const seen = new Set(); let done = false, now = 0;
  const finish = (id) => { seen.add(id); if (seen.size >= 7 && !done) { done = true; setTimeout(() => { ctx.sfx.good?.(); ctx.ui.done(); }, 1000); } };

  const base = new THREE.Group(); g.add(base);
  const gridTex = canvasTex(512, 384, (c, W, H) => { c.fillStyle = '#fbf7ea'; c.fillRect(0, 0, W, H); c.strokeStyle = 'rgba(70,110,170,.22)'; c.lineWidth = 2; for (let x = 0; x <= W; x += 32) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x, H); c.stroke(); } for (let y = 0; y <= H; y += 32) { c.beginPath(); c.moveTo(0, y); c.lineTo(W, y); c.stroke(); } });
  const sheet = new THREE.Mesh(rbox(0.8, 0.014, 0.6, 0.006), new THREE.MeshStandardMaterial({ map: gridTex, roughness: 0.8 })); sheet.position.y = 0.007; base.add(sheet);
  const binder = new THREE.Mesh(rbox(0.03, 0.02, 0.6, 0.008), glossy(0xe8604c)); binder.position.set(-0.4, 0.01, 0); base.add(binder);
  const sh = lightPool(0x000000, 0.55, 0.2); sh.position.y = -0.002; base.add(sh);
  R.add(base, 0.1, { dur: 0.9, rise: 0.06 });
  const TY = 0.014;

  // ---- graduation cap on a gold stand
  const hub = new THREE.Group(); hub.position.set(0, TY, 0); g.add(hub);
  const stand = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.045, 0.09, 32), goldMat()); stand.position.y = 0.045; hub.add(stand);
  const cap = new THREE.Group(); cap.scale.setScalar(0.85); cap.position.y = 0.16; hub.add(cap);
  const skull = new THREE.Mesh(new THREE.CylinderGeometry(0.062, 0.07, 0.06, 40), glossy(0x2b3f7a, { roughness: 0.4 })); skull.position.y = -0.03; cap.add(skull);
  const board = new THREE.Mesh(rbox(0.25, 0.012, 0.25, 0.004), glossy(0x24346b, { roughness: 0.4 })); board.rotation.y = Math.PI / 4; board.position.y = 0.012; cap.add(board);
  const edge = new THREE.Mesh(rbox(0.258, 0.004, 0.258, 0.002), goldMat()); edge.rotation.y = Math.PI / 4; edge.position.y = 0.005; cap.add(edge);
  const button = new THREE.Mesh(new THREE.SphereGeometry(0.009, 14, 10), goldMat()); button.position.y = 0.022; cap.add(button);
  const cord = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([new THREE.Vector3(0, 0.022, 0), new THREE.Vector3(0.07, 0.024, 0.02), new THREE.Vector3(0.115, 0.01, 0.05), new THREE.Vector3(0.125, -0.03, 0.05)]), 20, 0.0025, 6), goldMat()); cap.add(cord);
  const tas = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.01, 0.045, 10), goldMat()); tas.position.set(0.125, -0.052, 0.05); cap.add(tas);
  shadowed(cap);
  R.add(hub, 0.5, { dur: 1.0, rise: 0.1 });
  const hubTag = tagSprite('التعليم المتنقل', 0.26, 0xd4ad55, { size: 36, pad: 14 }); hubTag.position.set(0, 0.35, 0); hub.add(hubTag);
  H.add(skull, 0xffd27a, 0.2);
  ctx.tap(hub, () => { ctx.sfx.pop?.(); R.bounce(hub); H.seen(skull); burstAt(ctx, cap, 0xffd27a, 24, 0.35, 0.028); ctx.ui.card({ tag: 'الفكرة المركزية', title: 'التعليم المتنقل', body: 'تعليم يعتمد على تقنيات لاسلكية مثل الهواتف النقالة والأجهزة الرقمية الشخصية PDAs والحاسبات المصغرة.', color: 0xd4ad55 }); finish('hub'); });

  // ---- branches and orbs
  const RN = 0.3;
  const nodes = NODES.map((nd, i) => {
    const a = (i / 6) * TAU + 0.5, x = Math.cos(a) * RN, z = Math.sin(a) * RN * 0.9, y = 0.19 + (i % 2) * 0.04;
    const from = new THREE.Vector3(0, TY + 0.19, 0), to = new THREE.Vector3(x, TY + y, z), mid = new THREE.Vector3(x * 0.45, TY + y + 0.1, z * 0.45);
    const tube = lightTube(new THREE.CatmullRomCurve3([from, mid, to]), { radius: 0.0055, color: nd.c, speed: 0.5, glass: false }); g.add(tube);
    const gp = new THREE.Group(); gp.position.copy(to); g.add(gp);
    const orb = new THREE.Mesh(new THREE.SphereGeometry(0.075, 28, 20), glass(nd.c, 0.3)); orb.renderOrder = 4; gp.add(orb);
    const core = new THREE.Mesh(new THREE.SphereGeometry(0.077, 24, 16), new THREE.MeshBasicMaterial({ color: nd.c, transparent: true, opacity: 0.12, depthWrite: false, toneMapped: false })); gp.add(core);
    const ico = ICON[nd.k](); const ih = new THREE.Group(); ih.add(ico); ih.scale.setScalar(1.7); gp.add(ih);
    const stalk = new THREE.Mesh(new THREE.CylinderGeometry(0.003, 0.003, y - 0.05, 8), goldMat()); stalk.position.set(x, TY + (y - 0.05) / 2 - 0.0, z); g.add(stalk);
    const tag = tagSprite(nd.l, 0.24, nd.c, { size: 36, pad: 14 }); tag.position.y = 0.1; gp.add(tag); tag.visible = false;
    R.add(gp, 2.2 + i * 0.3, { dur: 0.8, rise: 0.0 }); R.add(stalk, 2.4 + i * 0.3, { dur: 0.5, fn: ease });
    H.add(orb, nd.c, 0.18, null, () => 1);
    const o = { nd, gp, tube, core, ih, tag, on: 0, tt: 0, i };
    ctx.tap(gp, () => {
      ctx.sfx.pop?.(); R.bounce(gp); H.seen(orb); burstAt(ctx, gp, nd.c, 20, 0.32, 0.026); o.on = 1; o.tt = 1;
      nodes.forEach((n) => { if (n !== o) n.tt = 0; });
      ctx.ui.card({ tag: 'فائدة', title: nd.l, body: nd.b, color: nd.c }); finish(nd.k);
    });
    return o;
  });

  ctx.ui.hud('المس الكرات لتكتشف الفوائد');
  return {
    update(t, dt, e) {
      now = t; R.update(t, dt, e); H.update(t, e, stag(t, 4.0, 0.6));
      cap.rotation.y = t * 0.35; cap.position.y = 0.16 + Math.sin(t * 1.2) * 0.006;
      setSpr(hubTag, 0.26, stag(t, 1.8, 0.6, ease) * (R.k(hub) > 0.5 ? 1 : 0));
      nodes.forEach((n) => {
        n.tube.userData.fill(stag(t, 1.6 + n.i * 0.18, 0.9, ease)); n.tube.userData.update(dt);
        n.on = Math.max(0, n.on - dt * 0.6);
        n.tube.userData.core.material.opacity = 0.55 + 0.4 * n.on;
        n.core.material.opacity = 0.12 + 0.3 * n.on;
        n.ih.rotation.y += dt * (0.8 + n.on * 3); n.gp.position.y += 0; n.ih.position.y = Math.sin(t * 1.6 + n.i) * 0.004;
        setSpr(n.tag, 0.24, n.tt ? 1 : 0); n.tag.visible = n.tt > 0 && R.k(n.gp) > 0.5;
      });
    },
  };
}
