// p347 — a desk globe wrapped by a ring of phone-light, ringed by four glass gauges of users you "bet" on, then touch to reveal.
import * as THREE from 'three';
import { P, ease, easeBack, clamp01, stag, mat, glossy, goldMat, shadowed, lightTube } from '../../kit.js?v=15';
import { TAU, css, canvasTex, rbox, lit, rig, hints, burstAt, lightPool, tagSprite, setSpr } from '../lib/a7.js?v=15';

export const meta = { free: true, center: [0.5, 0.46], typeLabel: 'مجسّم تفاعلي' };

const LAND = {
  af: [[-17, 15], [-10, 30], [10, 37], [32, 31], [43, 12], [51, 12], [40, -5], [40, -15], [33, -27], [20, -35], [12, -18], [9, -1], [-8, 5]],
  eu: [[-10, 36], [-9, 43], [0, 50], [10, 55], [30, 70], [60, 72], [100, 77], [140, 72], [180, 68], [170, 60], [140, 50], [130, 35], [122, 30], [120, 22], [108, 10], [100, 2], [95, 20], [80, 8], [72, 20], [58, 25], [50, 30], [35, 36], [28, 41], [12, 44], [5, 43]],
  na: [[-168, 66], [-140, 70], [-95, 72], [-60, 60], [-55, 48], [-70, 42], [-80, 26], [-97, 18], [-87, 13], [-78, 8], [-100, 20], [-117, 32], [-125, 45], [-135, 58]],
  sa: [[-78, 8], [-60, 10], [-35, -6], [-40, -22], [-58, -38], [-68, -55], [-75, -45], [-72, -20], [-81, -5]],
  au: [[114, -22], [130, -12], [143, -11], [153, -27], [146, -39], [130, -32], [115, -34]],
};
function globeTex() {
  return canvasTex(1024, 512, (g, W, H) => {
    const gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, '#173a73'); gr.addColorStop(1, '#0e2750');
    g.fillStyle = gr; g.fillRect(0, 0, W, H);
    const X = (lo) => ((lo + 180) / 360) * W, Y = (la) => ((90 - la) / 180) * H;
    const poly = (pts, fill) => { g.beginPath(); pts.forEach(([lo, la], i) => (i ? g.lineTo(X(lo), Y(la)) : g.moveTo(X(lo), Y(la)))); g.closePath(); g.fillStyle = fill; g.fill(); };
    poly(LAND.eu, '#e7eef8'); poly(LAND.na, '#e7eef8'); poly(LAND.sa, '#e7eef8'); poly(LAND.au, '#e7eef8'); poly(LAND.af, '#3a9be0');
    g.strokeStyle = 'rgba(255,255,255,.28)'; g.lineWidth = 1.4;
    for (let lo = -180; lo <= 180; lo += 30) { g.beginPath(); g.moveTo(X(lo), 0); g.lineTo(X(lo), H); g.stroke(); }
    for (let la = -60; la <= 60; la += 30) { g.beginPath(); g.moveTo(0, Y(la)); g.lineTo(W, Y(la)); g.stroke(); }
  });
}

function glyph(kind) {
  return canvasTex(128, 128, (g) => {
    g.clearRect(0, 0, 128, 128); g.fillStyle = '#fff'; g.strokeStyle = '#fff'; g.lineWidth = 9; g.lineCap = 'round'; g.lineJoin = 'round';
    if (kind === 'f') { g.font = '800 104px Georgia, serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('f', 70, 70); }
    if (kind === 'ig') { g.beginPath(); g.roundRect(26, 26, 76, 76, 22); g.stroke(); g.beginPath(); g.arc(64, 64, 17, 0, TAU); g.stroke(); g.beginPath(); g.arc(87, 41, 4, 0, TAU); g.fill(); }
    if (kind === 'ms') { g.beginPath(); g.moveTo(64, 22); g.bezierCurveTo(98, 22, 112, 46, 108, 66); g.bezierCurveTo(104, 88, 84, 104, 62, 104); g.lineTo(32, 108); g.lineTo(38, 84); g.bezierCurveTo(22, 70, 24, 40, 44, 28); g.bezierCurveTo(50, 24, 58, 22, 64, 22); g.fill(); g.strokeStyle = '#3a6fe0'; g.lineWidth = 8; g.beginPath(); g.moveTo(40, 72); g.lineTo(58, 54); g.lineTo(70, 64); g.lineTo(88, 46); g.stroke(); }
    if (kind === 'dot') { g.beginPath(); g.arc(64, 64, 26, 0, TAU); g.fill(); }
    if (kind === 'wa') { g.beginPath(); g.arc(64, 62, 38, 0, TAU); g.stroke(); g.beginPath(); g.moveTo(34, 96); g.lineTo(42, 78); g.lineTo(52, 90); g.closePath(); g.fill(); g.lineWidth = 9; g.beginPath(); g.arc(60, 60, 14, 2.6, 5.2); g.stroke(); }
  });
}

const GAUGES = [
  { n: 'فيسبوك', lab: '١٫٥٥ مليار', v: 1, c: 0x2f7bf0, gl: 'f', x: 0.325, card: 'شبكة المليار ونصف. كان عدد المستخدمين ١٢ مليوناً عام ٢٠٠٦، وتجاوز ٤٠ مليوناً مطلع ٢٠٠٧.' },
  { n: 'واتساب', lab: '٩٠٠ مليون', v: 0.58, c: 0x2fb35a, gl: 'wa', x: 0.195, card: 'نحو ٥٨٪ من حجم مستخدمي فيسبوك، كما يبدو من الأرقام المطبوعة.' },
  { n: 'إنستجرام', lab: '٤٠٠ مليون', v: 0.26, c: 0xd8337f, gl: 'ig', x: 0.065, card: 'نحو ٢٦٪ من حجم فيسبوك. وفيسبوك وإنستجرام معاً يستحوذان على قرابة دقيقة من كل ٥ دقائق على الهاتف في الولايات المتحدة.' },
  { n: 'ماسنجر', lab: '٧٠٠ مليون', v: 0.45, c: 0x7a5cf0, gl: 'ms', x: -0.065, card: 'نحو ٤٥٪ من حجم فيسبوك؛ تطبيق المحادثة الفورية الذي أصدر الموقع له أيقونات جديدة.' },
  { n: 'برتقالي', lab: '٩٢٥ مليون', v: 0.6, c: 0xf0a03a, gl: 'dot', x: -0.195, card: 'الرقم المطبوع تحت الأيقونة البرتقالية في الشكل: ٩٢٥ مليون مستخدم.' },
  { n: 'أصفر', lab: '٤٥ مليون', v: 0.05, c: 0xe8c23a, gl: 'dot', x: -0.325, card: 'الرقم المطبوع تحت الأيقونة الصفراء في الشكل: ٤٥ مليون مستخدم.' },
];

export default function build(ctx) {
  const g = new THREE.Group(); g.position.copy(P(meta.center[0], meta.center[1])); ctx.stage.add(g);
  const R = rig(), H = hints(g);
  const seen = new Set(); let finished = false;
  const check = (id) => { seen.add(id); if (seen.size >= 7 && !finished) { finished = true; setTimeout(() => { ctx.sfx.good?.(); ctx.ui.done(); }, 900); } };

  const base = new THREE.Group(); g.add(base);
  const sh = lightPool(0x000000, 0.5, 0.22); sh.position.y = -0.002; sh.scale.set(1.3, 0.8, 1); base.add(sh);
  R.add(base, 0.1, { dur: 0.8 });
  const SY = 0.02;
  // ---- globe on a brass cradle
  const globeG = new THREE.Group(); globeG.position.set(0, SY + 0.215, -0.12); g.add(globeG); R.add(globeG, 0.5, { dur: 1.0, rise: 0.12 });
  const tilt = new THREE.Group(); tilt.rotation.z = 0.41; globeG.add(tilt);
  const earth = new THREE.Mesh(new THREE.SphereGeometry(0.15, 56, 36), new THREE.MeshPhysicalMaterial({ map: globeTex(), roughness: 0.32, clearcoat: 0.8, clearcoatRoughness: 0.2 }));
  tilt.add(earth);
  const meridian = new THREE.Mesh(new THREE.TorusGeometry(0.172, 0.006, 10, 64, Math.PI * 1.05), goldMat()); meridian.rotation.set(0.15, 0.55, 0.45); globeG.add(meridian);
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.014, 0.08, 16), goldMat()); stem.position.y = -0.2; globeG.add(stem);
  const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.068, 0.018, 32), goldMat()); foot.position.y = -0.24; globeG.add(foot);
  shadowed(globeG);

  // ---- ring of phone-light (90% lit = mobile share)
  const ringG = new THREE.Group(); ringG.position.set(0, SY + 0.215, -0.12); ringG.rotation.set(0.32, 0, 0.18); g.add(ringG);
  const RR = 0.24, share = 1.39 / 1.55;
  const arcPts = (a0, a1, n) => Array.from({ length: n + 1 }, (_, i) => { const a = a0 + (a1 - a0) * (i / n); return new THREE.Vector3(Math.cos(a) * RR, 0, Math.sin(a) * RR); });
  const arcCurve = new THREE.CatmullRomCurve3(arcPts(0, TAU * share, 60));
  const lit90 = lightTube(arcCurve, { radius: 0.0065, color: 0x45b8ff, speed: 0.7 }); ringG.add(lit90);
  const rest = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(arcPts(TAU * share, TAU, 10)), 20, 0.0045, 8), mat(0x8590a8)); ringG.add(rest);
  const phone = new THREE.Group(); ringG.add(phone);
  const pb = new THREE.Mesh(rbox(0.03, 0.056, 0.008, 0.005), glossy(0xf4f1ea)); phone.add(pb);
  const ps = new THREE.Mesh(new THREE.PlaneGeometry(0.023, 0.046), lit(0x4aa8ff)); ps.position.z = 0.0045; phone.add(ps);
  const ph2 = phone.clone(); ringG.add(ph2);
  R.add(ringG, 1.2, { dur: 1.0 });
  H.add(earth, 0xffd27a, 0.36, new THREE.Vector3(0, SY + 0.215, -0.12));

  const tapGlobe = () => {
    ctx.sfx.pop?.(); burstAt(ctx, earth, 0x45b8ff, 30, 0.45, 0.03); R.bounce(globeG); H.seen(earth); pulse = 1;
    ctx.ui.card({ tag: 'عبر الهاتف', title: 'تسعة من كل عشرة', body: '١٫٣٩ مليار من أصل ١٫٥٥ مليار مستخدم يدخلون فيسبوك عبر الهاتف المحمول.', color: 0x45b8ff }); check('globe');
  };
  ctx.tap(earth, tapGlobe); ctx.tap(meridian, tapGlobe);

  // ---- four solid columns: first all equal (your bet), touch to reveal the real number
  const BH = 0.32, BR = 0.05;
  const gauges = GAUGES.map((d, i) => {
    const gp = new THREE.Group(); gp.position.set(d.x, SY, 0.2); g.add(gp);
    const body = new THREE.Mesh(new THREE.CylinderGeometry(BR, BR * 1.04, 1, 40), glossy(d.c, { roughness: 0.3 })); gp.add(body);
    const cap = new THREE.Group(); gp.add(cap);
    const lid = new THREE.Mesh(new THREE.CylinderGeometry(BR * 1.12, BR * 1.12, 0.012, 40), goldMat()); lid.position.y = 0.006; cap.add(lid);
    const disc = new THREE.Mesh(new THREE.CircleGeometry(BR * 0.8, 36), new THREE.MeshBasicMaterial({ color: d.c, toneMapped: false })); disc.rotation.x = -Math.PI / 2; disc.position.y = 0.0135; cap.add(disc);
    const gl = new THREE.Mesh(new THREE.PlaneGeometry(BR * 1.3, BR * 1.3), new THREE.MeshBasicMaterial({ map: glyph(d.gl), transparent: true, toneMapped: false })); gl.rotation.x = -Math.PI / 2; gl.position.y = 0.0145; cap.add(gl);
    const tag = tagSprite('؟', 0.12, d.c, { size: 40 }); gp.add(tag);
    const o = { d, gp, body, cap, tag, lvl: 0.2, to: 0.2, shown: false };
    R.add(gp, 1.4 + i * 0.2, { dur: 0.8, rise: 0.05 });
    H.add(cap, d.c, 0.17);
    const go = () => {
      ctx.sfx.pop?.(); burstAt(ctx, cap, d.c, 22, 0.35, 0.028); R.bounce(gp); H.seen(cap);
      o.to = d.v; o.shown = true; swap(o);
      ctx.ui.card({ tag: d.lab + ' مستخدم', title: d.n, body: d.card, color: d.c }); check(d.n);
    };
    ctx.tap(gp, go);
    return o;
  });
  function swap(o) {
    const t = tagSprite(o.d.lab, 0.16, o.d.c, { size: 34, pad: 14 });
    o.tag.material.map.dispose(); o.tag.material.map = t.material.map; o.tag.userData.aspect = t.userData.aspect; o.tag.material.needsUpdate = true;
  }
  let pulse = 0;

  ctx.ui.hud('خمّن ثم المس الأعمدة');
  return {
    update(t, dt, e) {
      R.update(t, dt, e); H.update(t, e, stag(t, 3.2, 0.6));
      earth.rotation.y += dt * 0.28;
      lit90.userData.fill(stag(t, 1.4, 1.8, ease)); lit90.userData.update(dt);
      pulse = Math.max(0, pulse - dt * 0.7);
      lit90.userData.speed = 0.7 + pulse * 3;
      const u = (t * 0.07) % share, u2 = (u + share / 2) % share;
      const a = u / share, a2 = u2 / share;
      phone.position.copy(arcCurve.getPoint(a)); ph2.position.copy(arcCurve.getPoint(a2));
      phone.rotation.y = -TAU * share * a - Math.PI / 2; ph2.rotation.y = -TAU * share * a2 - Math.PI / 2;
      gauges.forEach((o, i) => {
        o.lvl = THREE.MathUtils.damp(o.lvl, o.to, 3.2, dt);
        const hgt = Math.max(0.01, BH * o.lvl);
        o.body.scale.set(1, hgt, 1); o.body.position.y = hgt / 2; o.cap.position.y = hgt;
        o.tag.position.y = hgt + 0.065;
        const k = R.k(o.gp); setSpr(o.tag, o.shown ? 0.16 : 0.05, clamp01((t - 2.4) / 0.5) * (k > 0.5 ? 1 : 0));
      });
    },
  };
}
