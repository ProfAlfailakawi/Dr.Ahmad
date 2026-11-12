import * as THREE from 'three';
import { scene, plinth, contactShadow, textPlate, paintTex, rr, RB, GL, TAU, sm, mat, glossy, goldMat, shadowed, glow, ease, easeBack, clamp01, burstAt, lightPool } from '../lib/b7-kit.js?v=31';
export const meta = { free: true, center: [0.5, 0.6], typeLabel: 'مجسّم تفاعلي' };

// Six benefits orbit a phone like wireless signals; each one docks into the screen. Full screen -> the mortarboard rises.
const B = [
  { n: 'الاتصال والتفاعل', c: 0x3b8fe0, ic: 'wifi', body: 'اتصال وتفاعل بين أطراف المجتمع التعليمي دون الجلوس في أماكن محددة وأوقات معينة.' },
  { n: 'صغر الحجم وسهولة الحمل', c: 0xf29a2e, ic: 'size', body: 'أصغر حجماً من الحواسيب المكتبية، وأسهل حملاً من الحقائب المليئة بالملفات والكتب.' },
  { n: 'الكتابة بالقلم', c: 0x7ab648, ic: 'pen', body: 'الكتابة اليدوية في الأجهزة الرقمية بالقلم أكثر سهولة من لوحة المفاتيح والفأرة.' },
  { n: 'التعلّم الذاتي', c: 0xd9344b, ic: 'self', body: 'يدعم الطابع الشخصي ويحسّن التعلّم الذاتي.' },
  { n: 'إزالة الحواجز', c: 0x3aa6a0, ic: 'bar', body: 'يزيل الحواجز بين الطالب والمدرسة فيما يتعلق بالاتصال أو الثقافة.' },
  { n: 'حيوية وجذب', c: 0x8a63c9, ic: 'bolt', body: 'يضيف مزيداً من الأنشطة إلى الدروس التقليدية فيحقق الحيوية والجذب للمادة العلمية.' },
];
const hx = (c) => '#' + c.toString(16).padStart(6, '0');
function glyph(x, kind, s) { // white glyph in a 256 box
  x.save(); x.translate(128, 128); x.scale(s / 256, s / 256);
  x.strokeStyle = '#fff'; x.fillStyle = '#fff'; x.lineWidth = 16; x.lineCap = 'round'; x.lineJoin = 'round';
  if (kind === 'wifi') {
    [34, 66, 98].forEach((r, i) => { x.beginPath(); x.arc(0, 52, r, Math.PI * 1.22, Math.PI * 1.78); x.stroke(); });
    x.beginPath(); x.arc(0, 52, 11, 0, TAU); x.fill();
  } else if (kind === 'size') {
    x.setLineDash([16, 18]); x.lineWidth = 11; rr(x, -92, -64, 150, 112, 14); x.stroke(); x.setLineDash([]);
    x.lineWidth = 15; rr(x, 8, -22, 68, 104, 14); x.fillStyle = 'rgba(255,255,255,.28)'; x.fill(); x.stroke();
    x.beginPath(); x.arc(42, 62, 5, 0, TAU); x.fillStyle = '#fff'; x.fill();
  } else if (kind === 'pen') {
    x.rotate(-0.78); x.lineWidth = 14;
    rr(x, -18, -100, 36, 130, 9); x.fillStyle = 'rgba(255,255,255,.3)'; x.fill(); x.stroke();
    x.beginPath(); x.moveTo(-18, 36); x.lineTo(0, 96); x.lineTo(18, 36); x.closePath(); x.fillStyle = '#fff'; x.fill();
  } else if (kind === 'self') {
    x.beginPath(); x.arc(0, -52, 28, 0, TAU); x.fill();
    x.beginPath(); x.arc(0, 18, 58, Math.PI * 1.1, Math.PI * 1.9); x.stroke();
    x.lineWidth = 13; x.beginPath(); x.moveTo(-86, 54); x.quadraticCurveTo(-42, 38, 0, 62); x.quadraticCurveTo(42, 38, 86, 54); x.lineTo(86, 96); x.quadraticCurveTo(42, 82, 0, 106); x.quadraticCurveTo(-42, 82, -86, 96); x.closePath(); x.stroke();
  } else if (kind === 'bar') {
    x.lineWidth = 12;
    [[-96, -70], [-34, -70], [28, -70], [-96, -14], [58, -14], [-96, 42], [-34, 42], [28, 42]].forEach(([a, b]) => { rr(x, a, b, 56, 40, 8); x.stroke(); });
    x.lineWidth = 16; x.beginPath(); x.moveTo(-60, 14); x.lineTo(84, 14); x.moveTo(52, -16); x.lineTo(86, 14); x.lineTo(52, 44); x.stroke();
  } else {
    x.beginPath(); x.moveTo(26, -104); x.lineTo(-56, 20); x.lineTo(-6, 20); x.lineTo(-26, 104); x.lineTo(58, -26); x.lineTo(8, -26); x.closePath(); x.fill();
  }
  x.restore();
}
function tileTex(c, kind) {
  return paintTex(256, 256, (x) => {
    const g = x.createLinearGradient(0, 0, 256, 256); g.addColorStop(0, hx(new THREE.Color(c).lerp(new THREE.Color(0xffffff), 0.28).getHex())); g.addColorStop(1, hx(new THREE.Color(c).lerp(new THREE.Color(0x000000), 0.14).getHex()));
    rr(x, 0, 0, 256, 256, 54); x.fillStyle = g; x.fill();
    rr(x, 6, 6, 244, 244, 50); x.strokeStyle = 'rgba(255,255,255,.55)'; x.lineWidth = 4; x.stroke();
    glyph(x, kind, 168);
  });
}

export default function build(ctx) {
  const S = scene(ctx, meta, 1.22), g = S.g;
  const pad = plinth(0.3, { color: 0x3b3d47 }); g.add(pad); S.part(pad, 0.1, { rise: 0.0, dur: 0.8 });
  const shd = contactShadow(0.8, 0.8, 0.4); g.add(shd);
  const wash = lightPool(0x3b8fe0, 0.36, 0.0); wash.position.y = 0.026; g.add(wash);
  const top = 0.025;

  // ---- the phone (hero) ----
  const phone = new THREE.Group(); phone.position.set(0, top + 0.012, 0); g.add(phone);
  const PW = 0.17, PH = 0.34, PD = 0.016, PY = PH / 2 + 0.01;
  const body = new THREE.Mesh(RB(PW, PH, PD, 0.022), glossy(0xd8dce3, { roughness: 0.22 })); body.position.y = PY; phone.add(body);
  const edge = new THREE.Mesh(RB(PW + 0.004, PH + 0.004, PD * 0.3, 0.023), goldMat()); edge.position.y = PY; phone.add(edge);
  const scrTex = paintTex(300, 600, (x) => {
    const gr = x.createLinearGradient(0, 0, 0, 600); gr.addColorStop(0, '#2f6fc4'); gr.addColorStop(1, '#14305e');
    rr(x, 0, 0, 300, 600, 34); x.fillStyle = gr; x.fill();
    x.fillStyle = 'rgba(255,255,255,.12)';
    for (let i = 0; i < 6; i++) { const col = i % 2, row = Math.floor(i / 2); rr(x, 28 + col * 130, 118 + row * 130, 114, 114, 24); x.fill(); x.strokeStyle = 'rgba(255,255,255,.16)'; x.lineWidth = 3; x.stroke(); }
    rr(x, 112, 22, 76, 16, 8); x.fillStyle = 'rgba(0,0,0,.6)'; x.fill();
  });
  const scr = new THREE.Mesh(new THREE.PlaneGeometry(PW * 0.93, PH * 0.955), new THREE.MeshBasicMaterial({ map: scrTex, toneMapped: false }));
  scr.position.set(0, PY, PD / 2 + 0.0008); phone.add(scr);
  const scrGlow = new THREE.Mesh(new THREE.PlaneGeometry(PW * 0.93, PH * 0.955), new THREE.MeshBasicMaterial({ color: 0x5aa8ff, transparent: true, opacity: 0, toneMapped: false, depthWrite: false }));
  scrGlow.position.set(0, PY, PD / 2 + 0.0012); phone.add(scrGlow);
  // back: camera island + gold seal
  const cam = new THREE.Mesh(RB(0.05, 0.05, 0.004, 0.012), glossy(0x14161b)); cam.position.set(0.035, PY + PH / 2 - 0.045, -PD / 2 - 0.002); phone.add(cam);
  [[0.026, 0.012], [0.044, 0.012], [0.035, -0.006]].forEach(([a, b]) => { const l = new THREE.Mesh(new THREE.CylinderGeometry(0.0075, 0.0075, 0.005, 20), glossy(0x0a0b0e)); l.rotation.x = Math.PI / 2; l.position.set(a, PY + PH / 2 - 0.045 + b, -PD / 2 - 0.005); phone.add(l); const rg = new THREE.Mesh(new THREE.TorusGeometry(0.0075, 0.0015, 8, 20), goldMat()); rg.position.copy(l.position); phone.add(rg); });
  const seal = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, 0.003, 36), goldMat()); seal.rotation.x = Math.PI / 2; seal.position.set(0, PY - 0.02, -PD / 2 - 0.0018); phone.add(seal);
  // stand foot
  const foot = new THREE.Mesh(RB(0.1, 0.012, 0.06, 0.006), goldMat()); foot.position.y = 0.006; phone.add(foot);
  shadowed(phone); S.part(phone, 0.2, { rise: 0.12, dur: 1.0 });

  // signal rings from the top
  const rings = [0, 1, 2].map((i) => { const r = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.0016, 8, 64), new THREE.MeshBasicMaterial({ color: 0x5aa8ff, transparent: true, opacity: 0, toneMapped: false, depthWrite: false })); r.rotation.x = Math.PI / 2; r.position.y = PY + PH / 2 + 0.03; g.add(r); r.position.y += top + 0.012; return r; });

  // plate on the plinth
  const plate = textPlate('التعليم المتنقل', { w: 0.2, h: 0.052, th: 0.008 }); plate.position.set(0, top, 0.2); g.add(plate); S.part(plate, 1.2, { rise: 0.04 });

  // slots on the screen (phone-local)
  const slotAt = (i) => { const col = i % 2, row = Math.floor(i / 2); const u = (28 + col * 130 + 57) / 300, v = (118 + row * 130 + 57) / 600; return new THREE.Vector3((u - 0.5) * PW * 0.93, PY + (0.5 - v) * PH * 0.955, PD / 2 + 0.008); };
  const slotS = (114 / 300) * PW * 0.93 / 0.088;

  // ---- orbiting benefit tiles ----
  const tiles = B.map((b, i) => {
    const o = new THREE.Group(); g.add(o); const m = new THREE.Group(); o.add(m); const inner = new THREE.Group(); m.add(inner);
    const slab = new THREE.Mesh(RB(0.088, 0.088, 0.014, 0.018), glossy(b.c, { roughness: 0.3 })); inner.add(slab);
    const mk = (z, ry) => { const f = new THREE.Mesh(new THREE.PlaneGeometry(0.088, 0.088), new THREE.MeshBasicMaterial({ map: tileTex(b.c, b.ic), transparent: true, toneMapped: false })); f.position.z = z; f.rotation.y = ry; return f; };
    inner.add(mk(0.0075, 0)); inner.add(mk(-0.0075, Math.PI));
    const hal = glow(b.c, 0.17, 0.0); m.add(hal);
    shadowed(inner);
    const rec = { o, m, inner, b, i, a0: (i / 6) * TAU, on: false, t0: 0, from: new THREE.Vector3(), hal };
    S.part(o, 1.4 + i * 0.28, { rise: 0, dur: 0.8 });
    rec.pr = S.touch(m, () => take(rec), { color: b.c, size: 0.15, wake: 3.4 });
    return rec;
  });
  let docked = 0, capeT = -1, capDone = false, fin = false;

  // mortarboard (rises when the screen is full)
  const cap = new THREE.Group(); cap.position.y = top + 0.012 + PY + PH / 2 + 0.07; g.add(cap);
  const brd = new THREE.Mesh(RB(0.17, 0.012, 0.17, 0.004), glossy(0x2f2a26, { roughness: 0.4 })); brd.rotation.y = Math.PI / 4; brd.position.y = 0.04; cap.add(brd);
  const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.052, 0.058, 0.05, 36), glossy(0x2f2a26, { roughness: 0.4 })); crown.position.y = 0.01; cap.add(crown);
  const btn = new THREE.Mesh(new THREE.SphereGeometry(0.01, 14, 10), goldMat()); btn.position.y = 0.048; cap.add(btn);
  const cord = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([new THREE.Vector3(0, 0.048, 0), new THREE.Vector3(0.05, 0.05, 0.02), new THREE.Vector3(0.09, 0.03, 0.04), new THREE.Vector3(0.1, -0.01, 0.04)]), 24, 0.0032, 6), goldMat()); cap.add(cord);
  const tas = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.0095, 0.03, 12), goldMat()); tas.position.set(0.1, -0.03, 0.04); cap.add(tas);
  shadowed(cap); cap.scale.setScalar(0.0001); cap.visible = false;

  // docking
  const tmp = new THREE.Vector3();
  function take(r) {
    if (r.on) { ctx.ui.card({ tag: 'فائدة', title: r.b.n, body: r.b.body, color: r.b.c }); return; }
    r.on = true; r.pr.on = false; r.t0 = S.now; r.from.copy(r.m.position); r.slot = docked++;
    burstAt(S, r.m, r.b.c, 26, 0.45, 0.03); ctx.sfx.good?.();
    ctx.ui.card({ tag: 'فائدة', title: r.b.n, body: r.b.body, color: r.b.c });
    ctx.ui.hud(docked < 6 ? `${['', 'فائدة', 'فائدتان', 'ثلاث فوائد', 'أربع فوائد', 'خمس فوائد'][docked]} على الشاشة` : 'اكتملت الشاشة');
    if (docked === 6) capeT = S.now + 1.4;
  }
  ctx.ui.hud('المس الأيقونات المتحلّقة');

  S.loop((t, dt, e) => {
    wash.material.opacity = 0.55 * ease((t - 0.5) / 1.2) * e;
    phone.rotation.y = Math.sin(t * 0.5) * 0.12;
    rings.forEach((r, i) => { const u = ((t * 0.45 + i / 3) % 1); r.scale.setScalar(0.5 + u * 1.7); r.material.opacity = 0.5 * (1 - u) * (1 - u) * ease((t - 1.2) / 1) * e; r.visible = r.material.opacity > 0.01; });
    scrGlow.material.opacity = (docked / 6) * 0.14 * (0.8 + 0.2 * Math.sin(t * 3));
    tiles.forEach((r) => {
      if (!r.on) {
        const ang = r.a0 + t * 0.34;
        r.m.position.set(Math.sin(ang) * 0.27, top + 0.12 + 0.07 * Math.sin(t * 0.9 + r.i * 1.3) + (r.i % 2) * 0.07, Math.cos(ang) * 0.27);
        r.m.rotation.y = ang; r.m.rotation.z = Math.sin(t + r.i) * 0.06;
      } else if (!r.landed) {
        const k = sm((t - r.t0) / 0.95);
        const sp = slotAt(r.slot).add(phone.position);
        r.m.position.lerpVectors(r.from, sp, k); r.m.position.y += Math.sin(k * Math.PI) * 0.09;
        r.m.rotation.y = lerp2(r.m.rotation.y, 0, 0.2); r.m.rotation.z *= 0.9;
        r.inner.scale.setScalar(1 + (slotS - 1) * k);
        r.hal.material.opacity = 0.5 * (1 - k);
        if (k >= 1) { r.landed = true; burstAt(S, r.m, r.b.c, 10, 0.22, 0.02); r.o.remove(r.m); phone.add(r.m); r.hal.scale.setScalar(0.09); r.m.position.copy(slotAt(r.slot)); r.m.rotation.set(0, 0, 0); }
      } else { r.hal.material.opacity = 0.3 + 0.15 * Math.sin(t * 3 + r.i); }
    });
    if (capeT > 0 && t > capeT) {
      const u = easeBack((t - capeT) / 1.2); cap.visible = true; cap.scale.setScalar(Math.max(0.0001, u)); cap.rotation.y = t * 0.9;
      cap.position.y = top + 0.012 + PY + PH / 2 + 0.05 + 0.02 * Math.sin(t * 1.6) + 0.04 * u;
      if (!fin && t - capeT > 1.4) { fin = true; burstAt(S, cap, 0xffd27a, 60, 0.7, 0.04); ctx.sfx.good?.(); ctx.ui.card({ tag: 'فوائد التعليم المتنقل', title: 'تعلّم يرافقك', body: 'تعليم يعتمد على تقنيات لاسلكية مثل الهواتف النقالة والأجهزة الرقمية الشخصية PDAs والحاسبات المصغرة.', color: 0x3b8fe0 }); ctx.ui.done(); }
    }
  });
  return { update: S.update };
}
const lerp2 = (a, b, k) => a + (b - a) * k;
