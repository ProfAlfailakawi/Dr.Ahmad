import * as THREE from 'three';
import { mat, glossy, goldMat, shadowed, glow, stag, ease, easeBack, clamp01, label } from '../../kit.js?v=15';
import { scene, RoundedBox, TAU, setSpr, tagSprite, contactShadow } from '../lib/a8-kit.js?v=15';
export const meta = { free: true, center: [0.36, 0.641], typeLabel: 'لعبة تصنيف' };
const hex = (c) => '#' + c.toString(16).padStart(6, '0');
const GL = (c, i = 1) => new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: i, roughness: 0.3 });
const BIN = [
  { n: 'الدخول إلى التقنية', c: 0x3b8fe0 },
  { n: 'كيفية الاستخدام', c: 0xf29a2e },
  { n: 'فوائد التقنية', c: 0x2fbf8a },
];
const IT = [
  ['قرية بلا شبكة', 0, 'قرية بعيدة عن مراكز المدن لا تصلها شبكة اتصالات'],
  ['أسرة بلا حاسوب', 0, 'أسرة محدودة الدخل لا تستطيع شراء حاسوب'],
  ['مدرسة بلا ميزانية', 0, 'مدرسة بلا ميزانية مخصصة لشراء الأجهزة'],
  ['بنية اتصالات ضعيفة', 0, 'منطقة ضعفت فيها البنية التحتية للاتصالات'],
  ['طالب يجهل البحث', 1, 'طالب يملك جهازاً لكنه لا يعرف كيف يبحث ويرفع الملفات'],
  ['جهل مجالات التطبيق', 1, 'بلد اشترى أجهزة كثيرة لكنه يجهل مجالات تطبيقها'],
  ['معلمون بلا تدريب', 1, 'معلّمون وصلت مدرستهم حواسيب لم يتدربوا على تشغيل برمجياتها'],
  ['واجهة بلغة غريبة', 1, 'مستخدم يجيد القراءة والكتابة لكنه لا يجيد لغة الواجهة'],
  ['جهاز في خزانة', 2, 'جهاز في الصف محفوظ في خزانة لأن صاحب القرار لا يرى له أثراً في التعلّم'],
  ['إدارة تعدّه تسلية', 2, 'إدارة تعدّ الإنترنت تسلية فتمنع استخدامه في الدروس'],
  ['حاسوب يُعدّ ترفاً', 2, 'ولي أمر يرى الحاسوب ترفاً ولا يعلم أثره في مستقبل ابنه الدراسي'],
  ['قيمة التقنية مجهولة', 2, 'مؤسسة تملك الشبكة والمهارة لكنها لا تعرف قيمتها في رفع جودة التعلّم'],
];
const ORDER = [4, 0, 9, 5, 2, 10, 8, 1, 6, 11, 3, 7];
const SAY = ['ينقصهم الدخول إلى التقنية', 'ينقصهم معرفة كيفية الاستخدام', 'ينقصهم إدراك فوائد التقنية'];

function gearMesh(r, n, col, depth = 0.016) {
  const sh = new THREE.Shape();
  for (let k = 0; k < n * 4; k++) { const a = (k / (n * 4)) * TAU, rr = (k % 4 < 2) ? r : r * 0.8; const x = Math.cos(a) * rr, y = Math.sin(a) * rr; k === 0 ? sh.moveTo(x, y) : sh.lineTo(x, y); }
  sh.closePath(); sh.holes.push(new THREE.Path().absarc(0, 0, r * 0.3, 0, TAU, true));
  return new THREE.Mesh(new THREE.ExtrudeGeometry(sh, { depth, bevelEnabled: false }), glossy(col, { roughness: 0.3 }));
}


// outline of a page-sized slab whose inner side is torn into zigzag teeth
function tornShape(w, h, side) { // side: +1 tooth edge on the right, -1 on the left
  const s = new THREE.Shape(), r = 0.02, x1 = w / 2, y1 = h / 2;
  const teeth = 14, amp = 0.011;
  const zig = (dir) => { const pts = []; for (let i = 0; i <= teeth; i++) { const y = -y1 + (i / teeth) * h; pts.push([dir * (x1 - (i % 2 ? amp : 0)), y]); } return pts; };
  if (side > 0) {
    s.moveTo(-x1 + r, -y1); const z = zig(1); s.lineTo(z[0][0], z[0][1]); z.forEach(([x, y]) => s.lineTo(x, y)); s.lineTo(x1, y1 - r); s.quadraticCurveTo(x1, y1, x1 - r, y1); s.lineTo(-x1 + r, y1); s.quadraticCurveTo(-x1, y1, -x1, y1 - r); s.lineTo(-x1, -y1 + r); s.quadraticCurveTo(-x1, -y1, -x1 + r, -y1);
  } else {
    s.moveTo(x1 - r, -y1); s.quadraticCurveTo(x1, -y1, x1, -y1 + r); s.lineTo(x1, y1 - r); s.quadraticCurveTo(x1, y1, x1 - r, y1); const z = zig(-1).reverse(); s.lineTo(z[0][0], z[0][1]); z.forEach(([x, y]) => s.lineTo(x, y)); s.lineTo(-x1, -y1);
  }
  return s;
}
function paperTex() {
  const c = document.createElement('canvas'); c.width = 512; c.height = 640; const x = c.getContext('2d');
  x.fillStyle = '#fbf6ea'; x.fillRect(0, 0, 512, 640);
  x.strokeStyle = '#8fb4e3'; x.lineWidth = 2; for (let y = 90; y < 640; y += 38) { x.beginPath(); x.moveTo(0, y); x.lineTo(512, y); x.stroke(); }
  x.strokeStyle = '#e07a7a'; x.lineWidth = 3; x.beginPath(); x.moveTo(70, 0); x.lineTo(70, 640); x.stroke();
  x.fillStyle = '#2b2620'; x.font = '800 62px Tajawal, sans-serif'; x.textAlign = 'center'; x.direction = 'rtl'; x.fillText('الفجوة الرقمية', 290, 190);
  x.font = '700 40px Tajawal, sans-serif'; x.fillStyle = '#8a7a66'; x.fillText('قلة · معرفة · دخول', 290, 262);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.repeat.set(1 / 0.28, 1 / 0.36); t.offset.set(0.5, 0.5); return t;
}
function screenTex2() {
  const c = document.createElement('canvas'); c.width = 512; c.height = 640; const x = c.getContext('2d');
  const gr = x.createLinearGradient(0, 0, 0, 640); gr.addColorStop(0, '#173b6e'); gr.addColorStop(1, '#091526'); x.fillStyle = gr; x.fillRect(0, 0, 512, 640);
  x.strokeStyle = 'rgba(120,190,255,.55)'; x.lineWidth = 3; const P = []; for (let i = 0; i < 16; i++) P.push([60 + ((i * 97) % 400), 80 + ((i * 163) % 480)]);
  P.forEach((p, i) => { P.forEach((q, j) => { if (j > i && Math.hypot(p[0] - q[0], p[1] - q[1]) < 190) { x.beginPath(); x.moveTo(p[0], p[1]); x.lineTo(q[0], q[1]); x.stroke(); } }); });
  P.forEach((p) => { x.beginPath(); x.arc(p[0], p[1], 9, 0, TAU); x.fillStyle = '#ffe3a0'; x.fill(); });
  x.fillStyle = 'rgba(255,255,255,.92)'; x.font = '800 54px Tajawal, sans-serif'; x.textAlign = 'center'; x.direction = 'rtl'; x.fillText('The Digital Divide', 256, 590);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.repeat.set(1 / 0.28, 1 / 0.36); t.offset.set(0.5, 0.5); return t;
}

export default function build(ctx) {
  const S = scene(ctx, meta), g0 = S.g; const g = new THREE.Group(); g.scale.setScalar(0.82); g0.add(g);
  // ---- the divide: a ruled notebook and a glowing tablet, torn apart by a bright crack
  const mkSlab = (right) => {
    const geo = new THREE.ExtrudeGeometry(tornShape(0.28, 0.36, right ? -1 : 1), { depth: 0.032, bevelEnabled: true, bevelThickness: 0.004, bevelSize: 0.003, bevelSegments: 2, curveSegments: 6 });
    const face = right ? new THREE.MeshBasicMaterial({ map: screenTex2(), toneMapped: false }) : new THREE.MeshStandardMaterial({ map: paperTex(), roughness: 0.6 });
    const sideM = right ? glossy(0x1d222c, { roughness: 0.3 }) : mat(0xe9dfc8);
    const m = new THREE.Mesh(geo, [face, sideM]); const grp = new THREE.Group(); grp.add(m); m.position.y = 0.18;
    if (!right) { for (let i = 0; i < 8; i++) { const r = new THREE.Mesh(new THREE.TorusGeometry(0.014, 0.0028, 6, 16), glossy(0x8a8f99, { metalness: 0.6 })); r.position.set(-0.14, 0.06 + i * 0.04, 0.016); r.rotation.y = Math.PI / 2; grp.add(r); } }
    else { const bz = new THREE.Mesh(new THREE.TorusGeometry(0.004, 0.002, 6, 12), goldMat()); bz.visible = false; grp.add(bz); }
    grp.rotation.x = -0.1; return shadowed(grp);
  };
  const L = mkSlab(false), Rr = mkSlab(true); L.position.set(-0.17, 0, -0.1); Rr.position.set(0.17, 0, -0.1); g.add(L, Rr);
  const shL = contactShadow(0.34, 0.18, 0.35); shL.position.set(-0.17, 0.0015, -0.08); g.add(shL); const shR = contactShadow(0.34, 0.18, 0.35); shR.position.set(0.17, 0.0015, -0.08); g.add(shR);
  const crack = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.36, 0.01), new THREE.MeshBasicMaterial({ color: 0xffd27a, transparent: true, opacity: 0.55, toneMapped: false, blending: THREE.AdditiveBlending, depthWrite: false })); crack.position.set(0, 0.18, -0.1); g.add(crack);
  const crackGlow = glow(0xffd27a, 0.3, 0.4); crackGlow.position.set(0, 0.18, -0.08); g.add(crackGlow);
  S.part(L, 0.1, { rise: 0.15 }); S.part(Rr, 0.25, { rise: 0.15 });

  // ---- three bins in front: a plug, a gear, a bulb, each on its own pad
  const POS = [new THREE.Vector3(-0.22, 0, 0.17), new THREE.Vector3(0, 0, 0.2), new THREE.Vector3(0.22, 0, 0.17)];
  const bins = BIN.map((b, i) => {
    const grp = new THREE.Group(); grp.position.copy(POS[i]); g.add(grp);
    const padm = new THREE.Mesh(new RoundedBox(0.17, 0.01, 0.15, 0.03), glossy(0x2d3f5c)); padm.position.y = 0.005; grp.add(padm);
    const rim = new THREE.Mesh(new RoundedBox(0.176, 0.004, 0.156, 0.032), GL(b.c, 0.7)); rim.position.y = 0.0025; grp.add(rim);
    let obj;
    if (i === 0) {
      obj = new THREE.Group(); const bx = new THREE.Mesh(new RoundedBox(0.1, 0.08, 0.045, 0.014), glossy(b.c)); bx.position.y = 0.05; obj.add(bx);
      [-0.018, 0.018].forEach((x) => { const h = new THREE.Mesh(new THREE.CylinderGeometry(0.007, 0.007, 0.004, 14), mat(0x2b2620)); h.rotation.x = Math.PI / 2; h.position.set(x, 0.05, 0.0235); obj.add(h); });
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.034, 0.0035, 8, 40), GL(b.c, 1.1)); ring.position.set(0, 0.05, 0.024); obj.add(ring);
      const cable = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([new THREE.Vector3(0.05, 0.03, 0.02), new THREE.Vector3(0.09, 0.012, 0.05), new THREE.Vector3(0.07, 0.012, 0.08)]), 20, 0.004, 8), mat(0x2b2620)); obj.add(cable);
    } else if (i === 1) {
      obj = new THREE.Group(); const gm = gearMesh(0.048, 9, b.c); gm.position.set(0, 0.062, -0.008); obj.add(gm); obj.userData.gear = gm;
      const g2 = gearMesh(0.03, 7, 0xffe3a0); g2.position.set(0.058, 0.03, -0.008); obj.add(g2); obj.userData.g2 = g2;
    } else {
      obj = new THREE.Group(); const bu = new THREE.Mesh(new THREE.SphereGeometry(0.045, 28, 20), GL(0xffe3a0, 0.8)); bu.position.y = 0.088; obj.add(bu);
      const nk = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.025, 0.03, 16), goldMat()); nk.position.y = 0.04; obj.add(nk); obj.userData.bulb = bu;
      const hh = glow(b.c, 0.26, 0.5); hh.position.y = 0.088; obj.add(hh);
    }
    obj.position.y = 0.01; obj.scale.setScalar(1.3); grp.add(shadowed(obj));
    const lamp = glow(b.c, 0.3, 0); lamp.position.y = 0.07; grp.add(lamp);
    const plate = label(b.n, 0.15, { size: 50, width: 480, weight: 800, border: hex(b.c), pad: 16, radius: 18 }); plate.rotation.x = -1.0; plate.position.set(0, 0.012, 0.1); grp.add(plate);
    S.part(grp, 0.6 + i * 0.3, { rise: 0.14 });
    return { grp, obj, lamp, rim, b, i, shake: -9, pulse: -9 };
  });

  // ---- progress beads, and the pearl that carries the situation
  const beads = [];
  for (let i = 0; i < 12; i++) { const m = new THREE.Mesh(new THREE.SphereGeometry(0.0085, 12, 8), new THREE.MeshStandardMaterial({ color: 0xcfc6b2, emissive: 0xffd27a, emissiveIntensity: 0, roughness: 0.4 })); m.position.set(-0.165 + i * 0.03, 0.01, 0.325); g.add(m); beads.push(m); }
  const pearl = new THREE.Group(); pearl.position.set(0, 0.24, 0.04); g.add(pearl);
  const pm = new THREE.Mesh(new THREE.SphereGeometry(0.034, 28, 20), new THREE.MeshPhysicalMaterial({ color: 0xfff4d8, emissive: 0xffd27a, emissiveIntensity: 0.6, roughness: 0.1, clearcoat: 1, transparent: true, opacity: 0.95 })); pearl.add(pm);
  const ph = glow(0xffd27a, 0.24, 0.6); pearl.add(ph);
  S.touch(pearl, () => { ctx.ui.toast('اختر ما ينقص أصحابها بالضبط'); }, { color: 0xffd27a, size: 0.14, wake: 3.2 });
  let cur = 0, done = 0, tagS = null, anim = null, closeT = -1; const seenBin = [false, false, false];
  const homeP = new THREE.Vector3(0, 0.24, 0.04);
  const showTag = () => { if (tagS) { g.remove(tagS); tagS.material.map.dispose(); tagS = null; } if (cur >= ORDER.length) return; const it = IT[ORDER[cur]]; tagS = tagSprite(it[0], 0.2, 0xd4ad55, { ppu: 2200 }); tagS.material.depthTest = false; tagS.renderOrder = 10; g.add(tagS); tagS.userData.k = 0; };
  showTag(); ctx.ui.hud('أين يكمن السبب الأقوى؟');
  bins.forEach((bn) => {
    S.touch(bn.grp, () => {
      if (cur >= ORDER.length || anim) return;
      const it = IT[ORDER[cur]];
      if (it[1] === bn.i) {
        bn.pulse = S.now; ctx.sfx.good?.(); anim = { t0: S.now, from: pearl.position.clone(), to: bn.grp.position.clone().setY(0.12), bin: bn };
        S.burst(bn.grp.position.clone().setY(0.12).multiplyScalar(0.82), bn.b.c, 24, 0.5);
        if (!seenBin[bn.i]) { seenBin[bn.i] = true; ctx.ui.card({ tag: 'السبب الأقوى', title: bn.b.n, body: `${it[2]}؛ ${SAY[bn.i]}.`, color: bn.b.c }); } else ctx.ui.toast(SAY[bn.i]);
      } else { bn.shake = S.now; ctx.sfx.bad?.(); ctx.ui.toast('فكّر فيما ينقص أصحابها بالضبط'); }
    }, { color: bn.b.c, size: 0.32, at: new THREE.Vector3(0, 0.07, 0), wake: 3.4 });
  });

  S.loop((t, dt, e) => {
    const k = easeBack((t - 1.6) / 0.8) * e;
    if (anim) {
      const u = clamp01((t - anim.t0) / 0.7); pearl.position.lerpVectors(anim.from, anim.to, ease(u)); pearl.position.y += Math.sin(u * Math.PI) * 0.1; pearl.scale.setScalar(Math.max(0.0001, 1 - 0.8 * ease(u)) * k);
      if (u >= 1) { beads[done].material.emissiveIntensity = 1.4; beads[done].material.color.set(0xffe3a0); done++; cur++; anim = null; pearl.position.copy(homeP); if (cur >= ORDER.length) { closeT = t; ctx.ui.hud('سدَدتَ الفجوة'); if (tagS) { g.remove(tagS); tagS = null; } } else showTag(); }
    } else { pearl.position.y = 0.24 + Math.sin(t * 1.8) * 0.007; pearl.scale.setScalar(Math.max(0.0001, k)); }
    if (tagS) { tagS.position.set(0, 0.32, 0.04); tagS.userData.k = THREE.MathUtils.damp(tagS.userData.k, (anim || t < 2.6 ? 0 : 1) * e, 6, dt); tagS.visible = tagS.userData.k > 0.03; setSpr(tagS, 0.2, Math.min(tagS.userData.k, 1)); }
    const c = closeT > 0 ? ease((t - closeT - 0.6) / 1.6) : 0;
    L.position.x = -0.17 + 0.0 + 0.155 * c; Rr.position.x = 0.17 - 0.155 * c; crack.material.opacity = 0.55 * (1 - c) * (0.75 + 0.25 * Math.sin(t * 5)); crack.scale.x = 1 - c * 0.9; crackGlow.material.opacity = 0.4 * (1 - c);
    shL.position.x = L.position.x; shR.position.x = Rr.position.x;
    if (c >= 1 && !S.finished) { S.finished = true; S.burst(new THREE.Vector3(0, 0.16, 0), 0xffd27a, 60, 0.7, 0.045); ctx.ui.card({ tag: 'اكتمل التصنيف', title: 'أسباب الفجوة الرقمية', body: 'قلة الدخول إلى التقنية، وقلة المعرفة بكيفية استخدامها، وقلة المعرفة بفوائدها؛ ثلاثة أسباب حدّدها موليناري.', color: 0xd4ad55 }); ctx.ui.done(); }
    bins.forEach((bn, i) => {
      const o = bn.obj.userData;
      if (o.gear) { o.gear.rotation.z = t * 0.8; o.g2.rotation.z = -t * 1.1; }
      if (o.bulb) o.bulb.material.emissiveIntensity = 0.7 + 0.3 * Math.sin(t * 2.4) + clamp01(1 - (t - bn.pulse) / 0.8) * 1.2;
      bn.grp.position.x = POS[i].x + clamp01(1 - (t - bn.shake) / 0.5) * Math.sin((t - bn.shake) * 55) * 0.012;
      bn.obj.scale.y = 1.3 * (1 + clamp01(1 - (t - bn.pulse) / 0.5) * 0.12 * Math.sin((t - bn.pulse) * 14));
      bn.obj.rotation.y = Math.sin(t * 0.7 + i) * 0.25;
      bn.rim.material.emissiveIntensity = 0.5 + 0.25 * Math.sin(t * 2.4 + i) + clamp01(1 - (t - bn.pulse) / 0.8);
    });
  });
  return { update: S.update };
}
