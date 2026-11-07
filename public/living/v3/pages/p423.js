import * as THREE from 'three';
import { scene, contactShadow, sign, paintTex, drawText, rr, RB, GL, TAU, sm, mat, glossy, goldMat, shadowed, glow, ease, easeBack, clamp01, burstAt, lightPool, shuffle, faceYaw } from '../lib/b7-kit.js?v=17';
export const meta = { free: true, center: [0.46, 0.62], typeLabel: 'لعبة تصنيف' };

// A stone platform torn in two by a glowing rift. A situation hovers on the near half: tap the tablet (on the far half) that names
// its cause and the situation flies across. Every right answer lays a plank; when the six planks are down the halves close.
const BINS = [
  { t: 'قلة الدخول', c: 0x3b8fe0, ic: 'tower', why: 'قلة الدخول إلى التقنية من حيث توفرها: شبكة غائبة، أو جهاز لا يُشترى، أو ميزانية غير مخصصة.' },
  { t: 'قلة معرفة الاستخدام', c: 0xf29a2e, ic: 'gear', why: 'قلة المعرفة في كيفية استخدام التكنولوجيا: الجهاز موجود لكن مهارة تشغيله ناقصة.' },
  { t: 'قلة معرفة الفوائد', c: 0x7ab648, ic: 'bulb', why: 'قلة المعرفة في فوائد التكنولوجيا: الجهاز موجود لكن لا يُرى أثره في التعلّم.' },
];
const ITEMS = [
  { t: 'قرية لا تصلها شبكة اتصالات', b: 0 }, { t: 'أسرة لا تستطيع شراء حاسوب', b: 0 },
  { t: 'طالب يملك جهازاً ولا يعرف استخدامه', b: 1 }, { t: 'معلّمون لم يتدربوا على تشغيل البرمجيات', b: 1 },
  { t: 'جهاز في خزانة لأن القرار لا يرى أثره', b: 2 }, { t: 'ولي أمر يرى الحاسوب ترفاً', b: 2 },
];
const R = 0.3, G0 = 0.16, TH = 0.03, hx = (c) => '#' + c.toString(16).padStart(6, '0');

function icon(x, k, cx, cy, s) {
  x.save(); x.translate(cx, cy); x.scale(s / 100, s / 100); x.strokeStyle = '#fff'; x.fillStyle = '#fff'; x.lineWidth = 8; x.lineCap = 'round'; x.lineJoin = 'round';
  if (k === 'tower') {
    x.beginPath(); x.moveTo(-26, 44); x.lineTo(0, -20); x.lineTo(26, 44); x.moveTo(-14, 16); x.lineTo(14, 16); x.stroke();
    x.beginPath(); x.arc(0, -26, 7, 0, TAU); x.fill();
    [20, 38].forEach((r) => { x.beginPath(); x.arc(0, -26, r, -2.4, -0.74); x.stroke(); x.beginPath(); x.arc(0, -26, r, Math.PI + 0.74, Math.PI + 2.4 - Math.PI * 0, false); });
    [20, 38].forEach((r) => { x.beginPath(); x.arc(0, -26, r, Math.PI * 1.17, Math.PI * 1.83); x.stroke(); });
  } else if (k === 'gear') {
    for (let i = 0; i < 8; i++) { x.save(); x.rotate((i / 8) * TAU); rr(x, -7, -42, 14, 18, 3); x.fill(); x.restore(); }
    x.beginPath(); x.arc(0, 0, 28, 0, TAU); x.stroke(); x.beginPath(); x.arc(0, 0, 11, 0, TAU); x.stroke();
  } else {
    x.beginPath(); x.arc(0, -10, 28, Math.PI * 0.78, Math.PI * 2.22); x.lineTo(14, 34); x.lineTo(-14, 34); x.closePath(); x.stroke();
    x.beginPath(); x.moveTo(-12, 46); x.lineTo(12, 46); x.moveTo(-8, 22); x.lineTo(-8, 4); x.lineTo(0, 12); x.lineTo(8, 4); x.lineTo(8, 22); x.stroke();
  }
  x.restore();
}
function tabletTex(b) {
  return paintTex(320, 380, (x) => {
    rr(x, 0, 0, 320, 380, 44); x.fillStyle = '#fbf6ea'; x.fill(); x.lineWidth = 9; x.strokeStyle = hx(b.c); x.stroke();
    x.beginPath(); x.arc(160, 120, 84, 0, TAU); const g = x.createLinearGradient(80, 40, 240, 200); g.addColorStop(0, hx(new THREE.Color(b.c).lerp(new THREE.Color(0xffffff), 0.25).getHex())); g.addColorStop(1, hx(b.c)); x.fillStyle = g; x.fill();
    icon(x, b.ic, 160, 122, 88);
    drawText(x, b.t, 160, 292, 270, 120, { size: 58, color: '#2b2620' });
  });
}
function halfShape(far) {
  const s = new THREE.Shape(); const n = 12, a = 0.018; // same zigzag on both halves
  const zz = (i) => (i === 0 || i === n ? 0 : (i % 2 ? 1 : -1) * a);
  s.moveTo(-R, 0);
  for (let i = 1; i <= n; i++) s.lineTo(-R + (i / n) * 2 * R, zz(i));
  if (far) s.absarc(0, 0, R, 0, Math.PI, false); else s.absarc(0, 0, R, 0, -Math.PI, true);
  return s;
}
function half(far) {
  const m = new THREE.Mesh(new THREE.ExtrudeGeometry(halfShape(far), { depth: TH, bevelEnabled: true, bevelSize: 0.004, bevelThickness: 0.004, bevelSegments: 2, curveSegments: 64 }), glossy(0x7d6b55, { roughness: 0.5, clearcoat: 0.3 }));
  m.rotation.x = -Math.PI / 2; m.position.y = 0.0;
  const g = new THREE.Group(); g.add(m);
  // underside plate (dark) so it reads finished from below
  const rim = new THREE.Mesh(new THREE.ExtrudeGeometry(halfShape(far), { depth: 0.006, bevelEnabled: false, curveSegments: 64 }), goldMat()); rim.rotation.x = -Math.PI / 2; rim.position.y = TH * 0.55; rim.scale.set(1.012, 1.012, 1); g.add(rim);
  const base = new THREE.Mesh(new THREE.ExtrudeGeometry(halfShape(far), { depth: 0.01, bevelEnabled: false, curveSegments: 64 }), mat(0x3a332b)); base.rotation.x = -Math.PI / 2; base.position.y = -0.006; base.scale.set(0.97, 0.97, 1); g.add(base);
  [0.2, 0.245].forEach((r, i) => { const ri = new THREE.Mesh(new THREE.RingGeometry(r - 0.0025, r + 0.0025, 64, 1, far ? 0.12 : Math.PI + 0.12, Math.PI - 0.24), new THREE.MeshStandardMaterial({ color: 0xe0b85e, metalness: 0.8, roughness: 0.3, side: THREE.DoubleSide })); ri.rotation.x = -Math.PI / 2; ri.position.y = TH + 0.0048; g.add(ri); });
  return shadowed(g);
}

export default function build(ctx) {
  const S = scene(ctx, meta, 1.25), g = S.g;
  const cam = ctx.camera;
  g.add(contactShadow(0.95, 1.0, 0.38));
  // the rift: a deep blue glow under the gap
  const abyssT = paintTex(128, 128, (x) => { const gr = x.createLinearGradient(0, 0, 128, 0); gr.addColorStop(0, 'rgba(60,140,255,0)'); gr.addColorStop(0.5, 'rgba(120,190,255,1)'); gr.addColorStop(1, 'rgba(60,140,255,0)'); x.fillStyle = gr; x.fillRect(0, 0, 128, 128); });
  const abyss = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: abyssT, transparent: true, opacity: 0.95, toneMapped: false, depthWrite: false })); abyss.rotation.x = -Math.PI / 2; abyss.rotation.z = Math.PI / 2; abyss.position.y = 0.003; abyss.renderOrder = 2; g.add(abyss);
  const seam = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ color: 0xffd27a, transparent: true, opacity: 0, toneMapped: false, depthWrite: false })); seam.rotation.x = -Math.PI / 2; seam.position.y = TH + 0.009; seam.scale.set(R * 2, 0.012, 1); seam.renderOrder = 3; g.add(seam);
  const farH = half(true), nearH = half(false); g.add(farH, nearH);

  // three tablets on the far half
  const tab = BINS.map((b, i) => {
    const o = new THREE.Group(); o.position.set((i - 1) * 0.225, TH, -0.17); g.add(o);
    const body = new THREE.Mesh(RB(0.2, 0.235, 0.016, 0.022), glossy(0xf6efdf, { roughness: 0.4 })); body.position.y = 0.138; o.add(body);
    const mk = (z, ry) => { const f = new THREE.Mesh(new THREE.PlaneGeometry(0.19, 0.225), new THREE.MeshBasicMaterial({ map: tabletTex(b), transparent: true, toneMapped: false })); f.position.set(0, 0.138, z); f.rotation.y = ry; return f; };
    o.add(mk(0.0085, 0)); o.add(mk(-0.0085, Math.PI));
    const foot = new THREE.Mesh(RB(0.14, 0.02, 0.05, 0.008), goldMat()); foot.position.y = 0.01; o.add(foot);
    shadowed(o);
    const rec = { o, b, i, k: 0, bad: -9, ok: -9 };
    S.part(o, 1.3 + i * 0.25, { rise: 0.1, dur: 0.9 });
    rec.pr = S.touch(o, () => pick(rec), { color: b.c, size: 0.2, at: new THREE.Vector3(0, 0.14, 0.02), wake: 3.8 });
    return rec;
  });
  // planks
  const planks = Array.from({ length: 6 }, (_, i) => {
    const o = new THREE.Group(); o.position.set(-0.25 + i * 0.1, TH + 0.007, 0); g.add(o);
    const m = new THREE.Mesh(RB(0.07, 0.012, 1, 0.005), glossy(0xe0b85e, { roughness: 0.3 })); o.add(m);
    const stripe = new THREE.Mesh(RB(0.02, 0.0135, 0.5, 0.003), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3 })); o.add(stripe);
    shadowed(o); o.visible = false; o.userData = { m, stripe, born: -9, c: 0xffffff };
    return o;
  });

  // hovering situation
  const card = new THREE.Group(); g.add(card);
  const cs = sign(0.5, 0.115, '', { color: '#fff7e6', border: '#d4ad55', fs: 62 }); card.add(cs);
  const cg = glow(0xffd27a, 0.5, 0.3); cs.add(cg);
  card.visible = false;
  const order = (() => { const o = shuffle([0, 1, 2, 3, 4, 5], 9); // never two of the same cause back to back
    for (let k = 1; k < 6; k++) if (ITEMS[o[k]].b === ITEMS[o[k - 1]].b) { for (let j = k + 1; j < 6; j++) if (ITEMS[o[j]].b !== ITEMS[o[k - 1]].b && (j + 1 >= 6 || ITEMS[o[j]].b !== ITEMS[o[k + 1 < 6 ? k + 1 : k]].b || true)) { [o[k], o[j]] = [o[j], o[k]]; break; } }
    return o; })();
  const spawn = new THREE.Vector3(0, TH + 0.23, 0.15);
  let round = -1, solved = 0, tries = 0, fl = null, fall = null, nextAt = 3.6, pend = 0, t0c = 0, gap = 0.7, fin = false, finT = -1;
  function next() { round++; if (round >= 6) { finT = S.now; return; } cs.userData.set(ITEMS[order[round]].t); card.visible = true; card.scale.setScalar(0.0001); card.position.copy(spawn); t0c = S.now; fall = null; ctx.ui.hud('ما السبب الأقوى للفجوة؟'); }
  function pick(r) {
    if (round < 0) return;
    if (!card.visible || fl || fall) { ctx.ui.card({ tag: 'سبب', title: r.b.t, body: r.b.why, color: r.b.c }); return; }
    const it = ITEMS[order[round]];
    if (it.b === r.i) {
      solved++; ctx.sfx.good?.(); fl = { t0: S.now, from: card.position.clone(), r };
      const p = planks[solved - 1]; p.userData.born = S.now; p.userData.m.material.color.setHex(r.b.c); p.userData.stripe.material.color.setHex(r.b.c); p.visible = true;
      ctx.ui.card({ tag: 'سبب', title: r.b.t, body: r.b.why, color: r.b.c });
      ctx.ui.hud(`${['', 'لوح', 'لوحان', 'ثلاثة ألواح', 'أربعة ألواح', 'خمسة ألواح'][solved] || 'اكتمل الجسر'}`);
    } else {
      tries++; ctx.sfx.bad?.(); fall = { t0: S.now, from: card.position.clone() }; r.bad = S.now; ctx.ui.toast('ليس هذا السبب، سقط الموقف في الهوّة');
    }
  }
  const crown = new THREE.Mesh(new THREE.TorusGeometry(R + 0.03, 0.003, 8, 120), new THREE.MeshBasicMaterial({ color: 0xffd27a, transparent: true, opacity: 0, toneMapped: false })); crown.rotation.x = Math.PI / 2; crown.position.y = TH + 0.012; g.add(crown);
  ctx.ui.hud('الفجوة الرقمية');
  const gapTarget = () => G0 * (1 - solved / 6) + 0.0;

  S.loop((t, dt, e) => {
    const bt = ease(t / 1.6);
    const tg = t < 1.8 ? THREE.MathUtils.lerp(0.9, G0, bt) : gapTarget();
    gap = t < 1.8 ? tg : THREE.MathUtils.damp(gap, tg, 2.6, dt);
    farH.position.z = -gap / 2; nearH.position.z = gap / 2;
    abyss.scale.set(Math.max(0.0001, gap + 0.14), R * 2.04, 1); abyss.material.opacity = 0.95 * clamp01(gap / 0.06);
    seam.material.opacity = (1 - clamp01(gap / 0.05)) * (0.5 + 0.2 * Math.sin(t * 3)) * (solved ? 1 : 0);
    planks.forEach((p, i) => { const u = p.userData; if (!p.visible) return; const k = easeBack((t - u.born) / 0.7); p.scale.set(Math.max(0.0001, k), Math.max(0.0001, k), 1); u.m.scale.z = gap + 0.09; u.stripe.scale.z = Math.max(0.2, gap + 0.07); p.position.y = TH + 0.007 + 0.01 * (1 - clamp01(k)); p.scale.z = 1; if (gap < 0.012) p.visible = (solved < 6) ? true : t - finT < 0.8; });
    const yaw = faceYaw(g, cam);
    tab.forEach((r) => { const bd = clamp01(1 - (t - r.bad) / 0.5); r.o.position.x = (r.i - 1) * 0.225 + Math.sin((t - r.bad) * 55) * 0.008 * bd; });
    if (round < 0 && t > nextAt) { next(); nextAt = 1e9; }
    if (card.visible) {
      card.rotation.y = yaw;
      if (fl) {
        const u = sm((t - fl.t0) / 0.9); const tp = fl.r.o.position;
        card.position.set(THREE.MathUtils.lerp(fl.from.x, tp.x, u), THREE.MathUtils.lerp(fl.from.y, TH + 0.16, u) + Math.sin(u * Math.PI) * 0.1, THREE.MathUtils.lerp(fl.from.z, tp.z, u));
        card.scale.setScalar(Math.max(0.05, 1 - u * 0.9));
        if (u >= 1) { card.visible = false; burstAt(S, fl.r.o, fl.r.b.c, 28, 0.5, 0.03); fl = null; pend = t + 0.7; }
      } else if (fall) {
        const u = clamp01((t - fall.t0) / 0.9);
        card.position.set(fall.from.x * (1 - sm(u * 2)), THREE.MathUtils.lerp(fall.from.y, -0.1, u * u) + Math.sin(Math.min(1, u * 2) * Math.PI) * 0.04, THREE.MathUtils.lerp(fall.from.z, 0, sm(u * 2)));
        card.scale.setScalar(Math.max(0.05, 1 - u * 0.7)); card.rotation.z = u * 1.6;
        if (u >= 1) { card.rotation.z = 0; card.visible = true; card.position.copy(spawn); t0c = t; fall = null; }
      } else {
        card.rotation.z = 0; card.position.set(0, spawn.y + 0.01 * Math.sin(t * 2), spawn.z); card.scale.setScalar(Math.max(0.0001, easeBack((t - t0c) / 0.7)));
        cg.material.opacity = 0.3 + 0.12 * Math.sin(t * 3);
      }
    }
    if (pend && t > pend) { pend = 0; next(); }
    if (finT > 0) {
      const u = clamp01((t - finT) / 1.2); crown.material.opacity = 0.9 * u; crown.rotation.z = t * 0.4;
      if (!fin && t - finT > 0.5) { fin = true; burstAt(S, farH, 0xffd27a, 60, 0.7, 0.045); ctx.sfx.good?.(); ctx.ui.card({ tag: 'الفجوة الرقمية', title: 'ثلاثة أسباب', body: 'قلة الدخول إلى التكنولوجيا، وقلة المعرفة في كيفية استخدامها، وقلة المعرفة في فوائدها (موليناري، ٢٠١٢).', color: 0x3b8fe0 }); ctx.ui.done(); }
    }
  });
  return { update: S.update };
}
