// p347 — a desk globe wrapped by a ring of phone-light, ringed by four glass gauges of users you "bet" on, then touch to reveal.
import * as THREE from 'three';
import { P, ease, easeBack, clamp01, stag, mat, glossy, goldMat, shadowed, lightTube } from '../../kit.js?v=36';
import { TAU, css, canvasTex, rbox, lit, rig, hints, burstAt, lightPool, tagSprite, setSpr } from '../lib/a7.js?v=36';

export const meta = { free: true, center: [0.5, 0.5], typeLabel: 'مجسّم تفاعلي' };

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

const ORBS = [
  { n: 'فيسبوك', lab: '١٫٥٥ مليار', r: 0.092, c: 0x2f7bf0, gl: 'f', card: 'شبكة المليار ونصف. كان عدد المستخدمين ١٢ مليوناً عام ٢٠٠٦، وتجاوز ٤٠ مليوناً مطلع ٢٠٠٧.' },
  { n: 'واتساب', lab: '٩٠٠ مليون', r: 0.07, c: 0x2fb35a, gl: 'wa', card: 'نحو ٥٨٪ من حجم مستخدمي فيسبوك، كما يبدو من الأرقام المطبوعة.' },
  { n: 'إنستجرام', lab: '٤٠٠ مليون', r: 0.05, c: 0xd8337f, gl: 'ig', card: 'نحو ٢٦٪ من حجم فيسبوك. وهو وفيسبوك معاً يستحوذان على قرابة دقيقة من كل ٥ دقائق على الهاتف في الولايات المتحدة.' },
  { n: 'ماسنجر', lab: '٧٠٠ مليون', r: 0.062, c: 0x7a5cf0, gl: 'ms', card: 'نحو ٤٥٪ من حجم فيسبوك؛ تطبيق المحادثة الفورية الذي أصدر الموقع له أيقونات جديدة.' },
  { n: 'أيقونة برتقالية', lab: '٩٢٥ مليون', r: 0.072, c: 0xf0a03a, gl: 'dot', card: 'الرقم المطبوع تحت هذه الأيقونة في الشكل: ٩٢٥ مليون مستخدم.' },
  { n: 'أيقونة صفراء', lab: '٤٥ مليون', r: 0.03, c: 0xf2cf3a, gl: 'dot', card: 'الرقم المطبوع تحت هذه الأيقونة في الشكل: ٤٥ مليون مستخدم.' },
];

export default function build(ctx) {
  const g = new THREE.Group(); g.position.copy(P(meta.center[0], meta.center[1])); ctx.stage.add(g);
  const R = rig(), H = hints(g);
  const seen = new Set(); let finished = false, pulse = 0;
  const check = (id) => { seen.add(id); if (seen.size >= 7 && !finished) { finished = true; setTimeout(() => { ctx.sfx.good?.(); ctx.ui.done(); }, 900); } };

  const sh = lightPool(0x000000, 0.5, 0.28); sh.position.y = -0.002; sh.scale.set(1.5, 1, 1); g.add(sh);

  // ---- big glossy globe on a slim gold cradle
  const GY = 0.3;
  const globeG = new THREE.Group(); globeG.position.set(0, GY, 0); g.add(globeG); R.add(globeG, 0.2, { dur: 1.0, rise: 0.25 });
  const tilt = new THREE.Group(); tilt.rotation.z = 0.41; globeG.add(tilt);
  const earth = new THREE.Mesh(new THREE.SphereGeometry(0.2, 64, 40), new THREE.MeshPhysicalMaterial({ map: globeTex(), roughness: 0.3, clearcoat: 0.9, clearcoatRoughness: 0.15 }));
  tilt.add(earth);
  const meridian = new THREE.Mesh(new THREE.TorusGeometry(0.228, 0.007, 10, 64, Math.PI * 1.05), goldMat()); meridian.rotation.set(0.15, 0.55, 0.45); globeG.add(meridian);
  const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 0.022, 36), goldMat()); foot.position.y = -GY + 0.011; globeG.add(foot);
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.013, 0.02, GY - 0.2 - 0.02, 16), goldMat()); stem.position.y = -0.2 - 0.0 - (GY - 0.2 - 0.02) / 2 + 0.0; globeG.add(stem);
  shadowed(globeG);
  H.add(earth, 0xffd27a, 0.5, new THREE.Vector3(0, GY, 0));

  // ---- phone-light ring: 90% lit = mobile share
  const ringG = new THREE.Group(); ringG.position.set(0, GY, 0); ringG.rotation.set(1.05, 0, 0.2); g.add(ringG);
  const RR = 0.27, share = 1.39 / 1.55;
  const arcPts = (a0, a1, n) => Array.from({ length: n + 1 }, (_, i) => { const a = a0 + (a1 - a0) * (i / n); return new THREE.Vector3(Math.cos(a) * RR, 0, Math.sin(a) * RR); });
  const arcCurve = new THREE.CatmullRomCurve3(arcPts(0, TAU * share, 70));
  const lit90 = lightTube(arcCurve, { radius: 0.009, color: 0x55c8ff, speed: 0.8 }); ringG.add(lit90);
  const rest = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(arcPts(TAU * share, TAU, 10)), 20, 0.006, 8), mat(0x6a7690)); ringG.add(rest);
  const phone = new THREE.Group(); ringG.add(phone);
  phone.add(new THREE.Mesh(rbox(0.04, 0.074, 0.011, 0.007), glossy(0xf4f1ea)));
  const ps = new THREE.Mesh(new THREE.PlaneGeometry(0.031, 0.062), lit(0x4aa8ff)); ps.position.z = 0.0062; phone.add(ps);
  R.add(ringG, 0.9, { dur: 1.0 });
  const tapGlobe = () => {
    ctx.sfx.pop?.(); burstAt(ctx, earth, 0x55c8ff, 30, 0.45, 0.03); R.bounce(globeG); H.seen(earth); pulse = 1;
    ctx.ui.card({ tag: 'عبر الهاتف', title: 'تسعة من كل عشرة', body: '١٫٣٩ مليار من أصل ١٫٥٥ مليار مستخدم يدخلون فيسبوك عبر الهاتف المحمول.', color: 0x55c8ff }); check('globe');
  };
  ctx.tap(earth, tapGlobe); ctx.tap(meridian, tapGlobe);

  // ---- six orbs orbiting: their size is the number of users (your bet: who is biggest?)
  const orbit = new THREE.Group(); orbit.position.set(0, GY, 0); orbit.rotation.set(-0.25, 0, 0.1); g.add(orbit);
  const spin = new THREE.Group(); orbit.add(spin);
  const orbs = ORBS.map((d, i) => {
    const a = (i / 6) * TAU, rad = 0.37;
    const gp = new THREE.Group(); gp.position.set(Math.cos(a) * rad, 0, Math.sin(a) * rad); spin.add(gp);
    const body = new THREE.Mesh(new THREE.SphereGeometry(d.r, 36, 24), glossy(d.c, { roughness: 0.2 })); gp.add(body);
    const gs = new THREE.Sprite(new THREE.SpriteMaterial({ map: glyph(d.gl), transparent: true, toneMapped: false, depthWrite: false })); gs.scale.setScalar(0.0001); gs.visible = false;
    const tag = tagSprite('؟', 0.1, d.c, { size: 40 }); tag.position.y = d.r + 0.07; gp.add(tag); tag.visible = false;
    R.add(gp, 0.6 + i * 0.18, { dur: 0.8, rise: 0.0 });
    H.add(body, d.c, d.r * 3.4);
    const o = { d, gp, body, tag, pop: 0, t: 0 };
    ctx.tap(gp, () => {
      ctx.sfx.pop?.(); burstAt(ctx, body, d.c, 20, 0.35, 0.028); R.bounce(gp); H.seen(body); o.pop = 1; o.t = 1;
      const s = tagSprite(d.lab, 0.2, d.c, { size: 40, pad: 14 }); tag.material.map.dispose(); tag.material.map = s.material.map; tag.userData.aspect = s.userData.aspect; tag.material.needsUpdate = true; tag.visible = true;
      orbs.forEach((x) => { if (x !== o && x.t) x.t = 0.0; });
      ctx.ui.card({ tag: d.lab + ' مستخدم', title: d.n, body: d.card, color: d.c }); check(d.n);
    });
    return o;
  });

  ctx.ui.hud('أيّها الأكبر؟ المس الكرات');
  return {
    update(t, dt, e) {
      R.update(t, dt, e); H.update(t, e, stag(t, 2.8, 0.6));
      earth.rotation.y += dt * 0.3;
      spin.rotation.y += dt * 0.28;
      lit90.userData.fill(stag(t, 1.0, 1.4, ease)); lit90.userData.update(dt);
      pulse = Math.max(0, pulse - dt * 0.7); lit90.userData.speed = 0.8 + pulse * 3;
      const u = (t * 0.08) % 1; phone.position.copy(arcCurve.getPoint(u * 0.999)); phone.rotation.y = -TAU * share * u - Math.PI / 2;
      orbs.forEach((o, i) => {
        o.pop = Math.max(0, o.pop - dt * 1.4);
        o.body.scale.setScalar(1 + 0.25 * Math.sin(o.pop * Math.PI) + 0.04 * Math.sin(t * 2 + i));
        o.gp.children[1].quaternion.identity();
        if (o.tag.visible) setSpr(o.tag, 0.2, clamp01(o.t) * R.k(o.gp));
      });
    },
  };
}
