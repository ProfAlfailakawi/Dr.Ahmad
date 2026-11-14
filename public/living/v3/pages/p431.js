import * as THREE from 'three';
import { scene, plinth, contactShadow, sign, paintTex, drawText, RB, GL, TAU, sm, mat, glossy, goldMat, shadowed, glow, ease, easeBack, clamp01, burstAt, lightPool, faceYaw, toAr } from '../lib/b7-kit.js?v=35';
export const meta = { free: true, center: [0.48, 0.6], typeLabel: 'لعبة رهان' };

// A tower of light rises from a city. Before each question you stake 1-3 gold coins on your confidence; a right answer lights that many
// tiers, a wrong one switches them off. Five questions, fifteen tiers.
const Q = [
  { q: 'من الأولى خليجياً في استخدام الإنترنت عام ٢٠١٥؟', o: ['البحرين', 'الكويت', 'الإمارات', 'السعودية'], a: 0, why: 'جاءت البحرين في المرتبة الأولى بعد أن سجلت ٧٤٫١٥٪ في معدلات استخدام الإنترنت.' },
  { q: 'من الأعلى في انتشار الهواتف النقالة؟', o: ['البحرين', 'الكويت', 'الإمارات', 'عُمان'], a: 1, why: 'حققت الكويت أعلى نسبة في انتشار الهواتف النقالة بـ ١٩٤٫٦٢٪.' },
  { q: 'أي مدينة عربية تفوقت على لندن وأوسلو في الحوكمة الرقمية؟', o: ['الرياض', 'القاهرة', 'دبي', 'المنامة'], a: 2, why: 'أثبتت دبي مكانة مرموقة ضمن أفضل ١٠ مدن في الحوكمة الرقمية عام ٢٠١٤.' },
  { q: 'في دراسة روتجرز، في أي مؤشر جاءت دبي رابعة؟', o: ['الخصوصية والأمن', 'تسليم الخدمات', 'المؤشر العام', 'الاستخدام المتنقل'], a: 1, why: 'جاءت دبي رابعة في تسليم الخدمات وخامسة في الخصوصية والأمن، وتاسعة وفق المؤشر العام.' },
  { q: 'جامعة الملك عبدالعزيز سادسة عالمياً في أي فئة؟', o: ['الطب', 'الهندسة', 'الحاسبات', 'الرياضيات'], a: 3, why: 'صُنّفت جامعة الملك عبدالعزيز في المرتبة السادسة عالمياً عن فئة الرياضيات.' },
];
const NT = 15, TT = 0.024, hx = (c) => '#' + c.toString(16).padStart(6, '0');
const BLUE = 0x3b8fe0, ORG = 0xf29a2e, GRN = '#4a9a3a', RED = '#d9344b';

export default function build(ctx) {
  const S = scene(ctx, meta, 1.0), g = S.g, cam = ctx.camera;
  const pad = plinth(0.37, { color: 0x23375a }); g.add(pad); S.part(pad, 0.1, { dur: 0.8, rise: 0 });
  g.add(contactShadow(1.0, 1.0, 0.4));
  const wash = lightPool(BLUE, 0.4, 0.0); wash.position.y = 0.027; g.add(wash);
  const top = 0.025;

  // city ring
  const city = new THREE.Group(); g.add(city);
  const rnd = (() => { let s = 3; return () => { s = (s * 16807) % 2147483647; return s / 2147483647; }; })();
  const blocks = [];
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * TAU + 0.1, r = 0.115 + rnd() * 0.05, h = 0.025 + rnd() * 0.06;
    const b = new THREE.Mesh(RB(0.026, h, 0.026, 0.004), new THREE.MeshStandardMaterial({ color: 0x9db4d6, emissive: i % 3 ? BLUE : ORG, emissiveIntensity: 0.28, roughness: 0.3, metalness: 0.2 }));
    b.position.set(Math.cos(a) * r, top + h / 2, Math.sin(a) * r); b.rotation.y = -a; city.add(b); blocks.push(b);
  }
  shadowed(city); S.part(city, 0.5, { rise: 0.06, dur: 1.0 });

  // tower tiers (hexagonal, each turned a little, like a spiralling spire)
  const tower = new THREE.Group(); tower.position.y = top; tower.scale.setScalar(1.35); g.add(tower);
  const tiers = [];
  for (let i = 0; i < NT; i++) {
    const r0 = 0.062 - (i / NT) * 0.044, r1 = 0.062 - ((i + 1) / NT) * 0.044;
    const m = new THREE.MeshStandardMaterial({ color: 0xdfe8f4, emissive: BLUE, emissiveIntensity: 0, roughness: 0.18, metalness: 0.35, transparent: true, opacity: 0.82 });
    const t = new THREE.Mesh(new THREE.CylinderGeometry(r1, r0, TT * 0.94, 6), m); t.position.y = TT * (i + 0.5); t.rotation.y = i * 0.35; tower.add(t);
    const ring = new THREE.Mesh(new THREE.CylinderGeometry(r1 * 1.04, r1 * 1.04, 0.0025, 6), goldMat()); ring.position.y = TT * (i + 1); ring.rotation.y = i * 0.35; tower.add(ring);
    tiers.push({ t, m, k: 0 });
  }
  const spire = new THREE.Mesh(new THREE.CylinderGeometry(0.0015, 0.008, 0.1, 10), goldMat()); spire.position.y = TT * NT + 0.05; tower.add(spire);
  const baseDisc = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.095, 0.014, 6), goldMat()); baseDisc.position.y = 0.007; tower.add(baseDisc);
  const beacon = glow(0xffd27a, 0.14, 0.7); beacon.position.y = TT * NT + 0.1; tower.add(beacon);
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.02, 0.5, 14, 1, true), new THREE.MeshBasicMaterial({ color: 0xffe3a0, transparent: true, opacity: 0, toneMapped: false, depthWrite: false, side: THREE.DoubleSide })); beam.position.y = TT * NT + 0.35; tower.add(beam);
  shadowed(tower); S.part(tower, 0.8, { rise: 0.1, dur: 1.2 });

  // option pedestals on the back arc
  const cams = new THREE.Vector3();
  const opts = [0, 1, 2, 3].map((i) => {
    const ang = Math.PI + 0.35 + (i / 3) * (Math.PI - 0.7); // back arc, left to right
    const o = new THREE.Group(); o.position.set(Math.cos(ang) * 0.28, top, Math.sin(ang) * 0.28 + 0.02); g.add(o);
    const ped = new THREE.Group(); o.add(ped);
    const c = new THREE.Mesh(new THREE.CylinderGeometry(0.052, 0.06, 0.044, 36), glossy(0xf1ebdd, { roughness: 0.35 })); c.position.y = 0.022; ped.add(c);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.0525, 0.004, 10, 44), goldMat()); rim.rotation.x = Math.PI / 2; rim.position.y = 0.044; ped.add(rim);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.062, 0.003, 8, 44), new THREE.MeshBasicMaterial({ color: 0xffd27a, transparent: true, opacity: 0, toneMapped: false })); ring.rotation.x = Math.PI / 2; ring.position.y = 0.004; ped.add(ring);
    shadowed(ped);
    const sg = sign(0.17, 0.062, '', { fs: 60 }); sg.position.y = 0.092; o.add(sg);
    const rec = { o, ped, sg, ring, i, bad: -9, ok: -9, x0: o.position.x };
    S.part(o, 1.4 + i * 0.2, { rise: 0.08, dur: 0.9 });
    rec.pr = S.touch(ped, () => answer(rec), { color: 0xffd27a, size: 0.16, at: new THREE.Vector3(0, 0.08, 0), wake: 4.2, quiet: true });
    return rec;
  });

  // stake stacks (front)
  const stakes = [1, 2, 3].map((n, i) => {
    const o = new THREE.Group(); o.position.set((i - 1) * 0.13, top, 0.29); g.add(o);
    const inner = new THREE.Group(); o.add(inner);
    for (let k = 0; k < n; k++) { const c = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.032, 0.0075, 36), goldMat()); c.position.y = 0.004 + k * 0.0085; inner.add(c); const e = new THREE.Mesh(new THREE.TorusGeometry(0.0305, 0.0016, 6, 36), goldMat()); e.rotation.x = Math.PI / 2; e.position.y = 0.004 + k * 0.0085 + 0.004; inner.add(e); }
    const faceT = paintTex(128, 128, (x) => { x.fillStyle = '#f0c968'; x.beginPath(); x.arc(64, 64, 62, 0, TAU); x.fill(); x.strokeStyle = '#b98a2c'; x.lineWidth = 6; x.beginPath(); x.arc(64, 64, 50, 0, TAU); x.stroke(); drawText(x, toAr(n), 64, 68, 80, 80, { size: 76, color: '#6b4a10' }); });
    const face = new THREE.Mesh(new THREE.CircleGeometry(0.0305, 36), new THREE.MeshBasicMaterial({ map: faceT, toneMapped: false })); face.rotation.x = -Math.PI / 2; face.position.y = 0.004 + (n - 1) * 0.0085 + 0.0043; inner.add(face);
    shadowed(inner);
    const halo = new THREE.Mesh(new THREE.TorusGeometry(0.045, 0.0025, 8, 40), new THREE.MeshBasicMaterial({ color: 0xffd27a, transparent: true, opacity: 0, toneMapped: false })); halo.rotation.x = Math.PI / 2; halo.position.y = 0.003; o.add(halo);
    const rec = { o, inner, halo, n, i, k: 0 };
    S.part(o, 2.2 + i * 0.2, { rise: 0.06, dur: 0.8 });
    rec.pr = S.touch(o, () => stake(rec), { color: 0xffd27a, size: 0.13, at: new THREE.Vector3(0, 0.03, 0), wake: 4.4, quiet: true });
    return rec;
  });

  // question plate above the tower
  const qp = new THREE.Group(); qp.position.set(0, top + 0.78, 0); g.add(qp);
  const qs = sign(0.52, 0.11, '', { color: '#fff7e6', border: '#d4ad55', fs: 60 }); qp.add(qs); qp.visible = false;

  let phase = 'wait', round = -1, st = 0, score = 0, shown = 0, fin = false, finT = -1, tNext = 3.4, tAns = 0, qT0 = 0, tries = 0;
  const setPhase = (p) => { phase = p; stakes.forEach((s) => { s.pr.on = p === 'stake' || p === 'answer'; }); opts.forEach((o) => { o.pr.on = p === 'answer'; }); };
  function next() {
    round++; if (round >= 5) { finT = S.now; setPhase('end'); return; }
    ctx.ui.hideCard(); st = 0; qT0 = S.now; qp.visible = true;
    qs.userData.set(Q[round].q); opts.forEach((o, i) => { o.sg.userData.set(Q[round].o[i], '#d4ad55'); o.pr.on = false; });
    setPhase('stake'); ctx.ui.hud('راهن بثقتك: ١ أو ٢ أو ٣');
  }
  function stake(s) {
    if (phase !== 'stake' && phase !== 'answer') return;
    st = s.n; ctx.sfx.pop?.(); burstAt(S, s.o, 0xffd27a, 14, 0.25, 0.02);
    if (phase === 'stake') { setPhase('answer'); ctx.ui.hud('الآن اختر الإجابة'); }
  }
  function answer(o) {
    if (phase === 'stake') { ctx.ui.toast('راهن بثقتك أولاً'); return; }
    if (phase !== 'answer') return;
    const q = Q[round]; setPhase('resolve');
    const ok = o.i === q.a;
    if (ok) { score = Math.min(NT, score + st); o.ok = S.now; o.sg.userData.set(q.o[o.i], GRN); ctx.sfx.good?.(); burstAt(S, o.sg, 0x7ab648, 30, 0.45, 0.03); }
    else { score = Math.max(0, score - st); tries++; o.bad = S.now; o.sg.userData.set(q.o[o.i], RED); ctx.sfx.bad?.(); const c = opts[q.a]; c.ok = S.now; c.sg.userData.set(q.o[q.a], GRN); }
    ctx.ui.card({ tag: ok ? `ربحت ${['', 'طبقة', 'طبقتين', 'ثلاث طبقات'][st]}` : `خسرت ${['', 'طبقة', 'طبقتين', 'ثلاث طبقات'][st]}`, title: q.o[q.a], body: q.why, color: ok ? 0x4a9a3a : 0xd9344b });
    ctx.ui.hud(`البرج ${toAr(score)} من ${toAr(NT)}`);
    tNext = S.now + 3.4; tAns = S.now;
  }
  ctx.ui.hud('مؤشرات رقمية عربية');
  const beamK = { v: 0 };

  S.loop((t, dt, e) => {
    wash.material.opacity = 0.5 * ease((t - 0.4) / 1.2) * e;
    const yaw = faceYaw(g, cam);
    qp.rotation.y = yaw; opts.forEach((o) => { o.sg.rotation.y = yaw; });
    if (round < 0 && t > tNext) { next(); tNext = 1e9; }
    if (phase === 'resolve' && t > tNext) { next(); tNext = 1e9; if (round >= 5) return; }
    blocks.forEach((b, i) => { b.material.emissiveIntensity = 0.25 + 0.2 * Math.sin(t * 1.6 + i) + 0.5 * (shown / NT); });
    // tiers
    shown = THREE.MathUtils.damp(shown, score, 3, dt);
    tiers.forEach((x, i) => {
      const k = clamp01(shown - i); x.k = k;
      x.m.emissiveIntensity = k * (1.1 + 0.25 * Math.sin(t * 2.4 + i * 0.5));
      x.m.emissive.setHex(i < 5 ? 0xf29a2e : BLUE); x.m.opacity = 0.82 + 0.18 * k;
      x.t.scale.setScalar(1 + 0.04 * Math.max(0, Math.sin(t * 3 - i * 0.6)) * k);
    });
    beacon.material.opacity = 0.25 + 0.55 * (shown / NT) + 0.1 * Math.sin(t * 3);
    tower.rotation.y = t * 0.12;
    // options
    opts.forEach((o) => {
      const bd = clamp01(1 - (t - o.bad) / 0.5); o.o.position.x = o.x0 + Math.sin((t - o.bad) * 55) * 0.008 * bd;
      const live = o.pr.on; const okk = clamp01(1 - (t - o.ok) / 2.6);
      o.ring.material.opacity = o.ok > 0 && t - o.ok < 3 ? 0.8 * okk : (o.bad > 0 && t - o.bad < 1 ? 0.7 * (1 - (t - o.bad)) : 0);
      o.ring.material.color.setHex(o.bad > 0 && t - o.bad < 1 ? 0xd9344b : 0x7ab648);
    });
    stakes.forEach((s) => { const sel = st === s.n; s.k = THREE.MathUtils.damp(s.k, sel ? 1 : 0, 6, dt); s.inner.position.y = 0.012 * s.k + 0.002 * Math.sin(t * 2 + s.i); s.halo.material.opacity = 0.75 * s.k; s.inner.rotation.y = t * (0.4 + 2.5 * s.k); });
    if (qp.visible) { const u = easeBack((t - qT0) / 0.7); qp.scale.setScalar(Math.max(0.0001, u)); qp.position.y = top + 0.78 + 0.008 * Math.sin(t * 1.6); }
    if (finT > 0) {
      const u = clamp01((t - finT) / 1.4); beam.material.opacity = 0.35 * u * (0.7 + 0.3 * Math.sin(t * 4)); qp.visible = false; opts.forEach((o) => { o.o.visible = true; });
      if (!fin && t - finT > 0.6) { fin = true; burstAt(S, beacon, 0xffd27a, 60, 0.7, 0.04); ctx.sfx.good?.(); ctx.ui.card({ tag: 'المعايرة المعرفية', title: `بُرج من ${toAr(score)} طبقة`, body: 'قارنتَ ثقتك بصحة إجابتك، فتعلّمت أن تعرف ما تعرفه وما لا تعرفه.', color: 0xd4ad55 }); ctx.ui.done(); }
    }
  });
  return { update: S.update };
}
