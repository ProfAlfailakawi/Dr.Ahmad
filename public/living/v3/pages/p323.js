import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { P, ease, easeBack, clamp01, stag, mat, glossy, goldMat, shadowed, glow, sprite } from '../../kit.js?v=19';
import { inked } from '../../pencil.js?v=19';
import { TAU, revealer, bumper, canvasTex, faceMat, fillText, hintGlow, pulseHint, setSpr, retext, burstAt } from '../lib/a6-kit.js?v=19';

export const meta = { free: true, center: [0.46, 0.37], typeLabel: 'أدلة تدور' };

const STUDIES = [
  { w: 'كومار ٢٠١٢', c: 0x2fa8c0, g: 'people', b: 'للتلعيب دور كبير في تعزيز التعلم والدافعية لدى طلبة الجامعة في علم الحاسوب، عبر بيئة تعلم تعاونية.' },
  { w: 'دروميت ٢٠١٣', c: 0x4aa84f, g: 'leaf', b: 'أكدت أثر التلعيب في تعزيز السلوك الإيجابي البيئي لدى الطلبة، بتشجيع السلوكيات البيئية الآمنة.' },
  { w: 'ساينري ٢٠١٣', c: 0x3a6fd0, g: 'phone', b: 'أوضحت تأثير تكنولوجيا الموبايل واستراتيجية التلعيب في دعم تعلم الطلبة في المرحلة الإعدادية.' },
  { w: 'أغابيتو ومارتينيز ٢٠١٤', c: 0x8e5bd0, g: 'code', b: 'قيّمت أداء طلاب الحاسوب في البرمجة لتعزيز دافعيتهم، وأشارت إلى وجود أثر للتلعيب.' },
  { w: 'دوغال ٢٠١٤', c: 0xf2a02f, g: 'db', b: 'أظهرت أثر التلعيب في تدريس نمذجة قواعد البيانات وتسويتها وتطبيعها، من خلال المشاركة الجماعية التعاونية.' },
  { w: 'أوروتيا ٢٠١٤', c: 0xe0463a, g: 'alg', b: 'أظهرت تأثير استراتيجية التلعيب في رفع تحصيل ودافعية الطلبة في مقرر الجبر الرياضي.' },
  { w: 'روس ٢٠١٥', c: 0x1f8a8a, g: 'atom', b: 'ظهر تأثير التلعيب في تدريس الفيزياء وتحفيز الطلبة، وفي دافعية طلبة السنة الأولى في علم الأحياء.' },
];
const hx = (c) => '#' + c.toString(16).padStart(6, '0');
const RO = 0.25, RC = 0.105, CY = 0.2;

function glyph(c, kind, S) {
  c.strokeStyle = '#fff'; c.fillStyle = '#fff'; c.lineWidth = S * 0.07; c.lineCap = 'round'; c.lineJoin = 'round'; const m = S / 2;
  if (kind === 'people') { [[-0.17, 0.02], [0.17, 0.02], [0, -0.04]].forEach(([x, y], i) => { c.beginPath(); c.arc(m + x * S, m + (y - 0.1) * S, S * 0.07, 0, TAU); c.fill(); c.beginPath(); c.arc(m + x * S, m + (y + 0.2) * S, S * 0.12, Math.PI, TAU); c.stroke(); }); }
  if (kind === 'leaf') { c.beginPath(); c.moveTo(m - S * 0.28, m + S * 0.24); c.quadraticCurveTo(m - S * 0.3, m - S * 0.3, m + S * 0.28, m - S * 0.26); c.quadraticCurveTo(m + S * 0.3, m + S * 0.3, m - S * 0.28, m + S * 0.24); c.stroke(); c.beginPath(); c.moveTo(m - S * 0.28, m + S * 0.24); c.lineTo(m + S * 0.1, m - S * 0.1); c.stroke(); }
  if (kind === 'phone') { c.beginPath(); c.roundRect(m - S * 0.14, m - S * 0.28, S * 0.28, S * 0.56, S * 0.05); c.stroke(); c.beginPath(); c.arc(m, m + S * 0.2, S * 0.025, 0, TAU); c.fill(); }
  if (kind === 'code') { c.beginPath(); c.moveTo(m - S * 0.08, m - S * 0.2); c.lineTo(m - S * 0.28, m); c.lineTo(m - S * 0.08, m + S * 0.2); c.stroke(); c.beginPath(); c.moveTo(m + S * 0.08, m - S * 0.2); c.lineTo(m + S * 0.28, m); c.lineTo(m + S * 0.08, m + S * 0.2); c.stroke(); }
  if (kind === 'db') { for (let i = 0; i < 3; i++) { c.beginPath(); c.ellipse(m, m - S * 0.18 + i * S * 0.18, S * 0.24, S * 0.07, 0, 0, TAU); c.stroke(); } c.beginPath(); c.moveTo(m - S * 0.24, m - S * 0.18); c.lineTo(m - S * 0.24, m + S * 0.18); c.moveTo(m + S * 0.24, m - S * 0.18); c.lineTo(m + S * 0.24, m + S * 0.18); c.stroke(); }
  if (kind === 'alg') { fillText(c, 'x²', m, m + S * 0.02, S * 0.62, '#fff', 800, 'Georgia, serif'); }
  if (kind === 'atom') { for (let i = 0; i < 3; i++) { c.save(); c.translate(m, m); c.rotate((i * Math.PI) / 3); c.beginPath(); c.ellipse(0, 0, S * 0.3, S * 0.11, 0, 0, TAU); c.stroke(); c.restore(); } c.beginPath(); c.arc(m, m, S * 0.05, 0, TAU); c.fill(); }
}
const coinTex = (s) => canvasTex(256, 256, (c, w, h) => { const gr = c.createRadialGradient(128, 110, 20, 128, 128, 128); gr.addColorStop(0, hx(s.c)); gr.addColorStop(1, '#1f2a44'); c.fillStyle = gr; c.fillRect(0, 0, w, h); c.strokeStyle = 'rgba(255,255,255,.5)'; c.lineWidth = 8; c.beginPath(); c.arc(128, 128, 112, 0, TAU); c.stroke(); glyph(c, s.g, 256); });

export default function build(ctx) {
  const g = new THREE.Group(); g.position.copy(P(meta.center[0], meta.center[1])); g.scale.setScalar(1.3); ctx.stage.add(g);
  const R = revealer(), B = bumper();

  const shadow = new THREE.Mesh(new THREE.CircleGeometry(0.16, 32), new THREE.MeshBasicMaterial({ color: 0x1b2540, transparent: true, opacity: 0.16, depthWrite: false })); shadow.rotation.x = -Math.PI / 2; shadow.position.y = 0.002; shadow.scale.set(1.2, 1, 0.7); g.add(shadow);
  const under = shadow, rimR = shadow, disc = { userData: { reveal() {} } };

  // the phone
  const ph = new THREE.Group(); ph.position.set(0, 0.0, 0); ph.scale.setScalar(1.15); g.add(ph);
  const stand = inked(new THREE.CylinderGeometry(0.045, 0.055, 0.03, 28), { color: 0xd4ad55 }); stand.position.y = 0.015; ph.add(stand); R.add(stand, 0.3, 0.9);
  const pbody = inked(new RoundedBoxGeometry(0.15, 0.26, 0.018, 4, 0.016), { color: 0xf7f2e7 }); pbody.position.y = 0.17; ph.add(pbody); R.add(pbody, 0.5, 1.2);
  const scrCv = document.createElement('canvas'); scrCv.width = 256; scrCv.height = 420; const sg = scrCv.getContext('2d');
  const scrTex = new THREE.CanvasTexture(scrCv); scrTex.colorSpace = THREE.SRGBColorSpace; scrTex.anisotropy = 4;
  let docked = 0;
  function drawScr(p) {
    sg.fillStyle = '#ee4a36'; sg.fillRect(0, 0, 256, 420);
    sg.fillStyle = 'rgba(255,255,255,.12)'; sg.beginPath(); sg.arc(128, 210, 100 + 12 * Math.sin(p), 0, TAU); sg.fill();
    sg.fillStyle = '#fff'; sg.beginPath(); sg.roundRect(58, 160, 140, 80, 40); sg.fill();
    sg.fillStyle = '#ee4a36'; sg.fillRect(86, 192, 30, 8); sg.fillRect(97, 181, 8, 30); sg.beginPath(); sg.arc(156, 186, 8, 0, TAU); sg.arc(172, 202, 8, 0, TAU); sg.fill();
    for (let i = 0; i < 7; i++) { sg.fillStyle = i < docked ? '#ffe39a' : 'rgba(255,255,255,.35)'; sg.beginPath(); sg.arc(128 + (i - 3) * 26, 350, 8, 0, TAU); sg.fill(); }
    scrTex.needsUpdate = true;
  }
  drawScr(0);
  const scr = new THREE.Mesh(new THREE.PlaneGeometry(0.128, 0.21), faceMat(scrTex, { transparent: true, opacity: 0 })); scr.position.set(0, 0.175, 0.0095); ph.add(scr);
  const pback = new THREE.Mesh(new THREE.CircleGeometry(0.02, 24), goldMat()); pback.position.set(0, 0.2, -0.0095); pback.rotation.y = Math.PI; ph.add(pback);
  const sGlow = glow(0xff8a70, 0.4, 0); sGlow.position.set(0, 0.175, 0.03); ph.add(sGlow);

  // crown ring (the evidence collected so far) and the orbit
  const crownGrp = new THREE.Group(); crownGrp.position.y = 0.022 + 0.34; g.add(crownGrp);
  const crownRing = new THREE.Mesh(new THREE.TorusGeometry(RC, 0.002, 6, 56), new THREE.MeshBasicMaterial({ color: 0xd4ad55, toneMapped: false, transparent: true, opacity: 0.5 })); crownRing.rotation.x = Math.PI / 2; crownGrp.add(crownRing);
  const orbitGrp = new THREE.Group(); orbitGrp.position.y = 0.022 + CY; orbitGrp.rotation.x = 0.18; g.add(orbitGrp);
  const orbitRing = new THREE.Mesh(new THREE.TorusGeometry(RO, 0.0022, 6, 80), new THREE.MeshBasicMaterial({ color: 0xcfc7b4, toneMapped: false, transparent: true, opacity: 0.8 })); orbitRing.rotation.x = Math.PI / 2; orbitGrp.add(orbitRing);

  const coins = STUDIES.map((s, i) => {
    const holder = new THREE.Group(); const inner = new THREE.Group(); inner.scale.setScalar(1.3); holder.add(inner);
    const m = [mat(0xd4ad55), faceMat(coinTex(s)), mat(0xd4ad55)];
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.036, 0.011, 32), m); body.rotation.x = Math.PI / 2; inner.add(body);
    const rimC = new THREE.Mesh(new THREE.TorusGeometry(0.036, 0.0032, 8, 32), goldMat()); inner.add(rimC);
    shadowed(inner);
    const hint = hintGlow(s.c, 0.15); hint.position.z = 0.012; inner.add(hint);
    g.add(holder);
    return { s, holder, inner, hint, a: (i / 7) * TAU, slot: -1, fly: -9, from: new THREE.Vector3() };
  });
  const lab = sprite('كومار ٢٠١٢', 0.2, { size: 40, width: 380, weight: 800, border: '#d4ad55', color: '#2b2620', bg: 'rgba(251,248,240,.97)' });
  lab.position.set(0, 0.5, 0); g.add(lab); let labT = -9, labW = 0.2;

  // verdict dome: a big glass shell with many dark dots (all the universities) around the few lit coins
  const DR = 0.315;
  const dome = new THREE.Mesh(new THREE.SphereGeometry(DR, 40, 22, 0, TAU, 0, Math.PI / 2), new THREE.MeshPhysicalMaterial({ color: 0xbfd8f0, roughness: 0.05, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide }));
  g.add(dome); let domeAt = -9;
  const domeRing = new THREE.Mesh(new THREE.TorusGeometry(DR, 0.006, 8, 90), goldMat()); domeRing.rotation.x = Math.PI / 2; domeRing.position.y = 0.004; domeRing.visible = false; g.add(domeRing);
  const NDOTS = 90, dpos = new Float32Array(NDOTS * 3);
  for (let i = 0; i < NDOTS; i++) { const u = Math.random(), a1 = Math.random() * TAU, ph1 = Math.acos(1 - u * 0.92); const r = DR * 0.985; dpos[i * 3] = Math.sin(ph1) * Math.cos(a1) * r; dpos[i * 3 + 1] = Math.cos(ph1) * r; dpos[i * 3 + 2] = Math.sin(ph1) * Math.sin(a1) * r; }
  const dgeo = new THREE.BufferGeometry(); dgeo.setAttribute('position', new THREE.BufferAttribute(dpos, 3));
  const dots = new THREE.Points(dgeo, new THREE.PointsMaterial({ color: 0x6b7a96, size: 0.016, transparent: true, opacity: 0, depthWrite: false })); dots.frustumCulled = false; g.add(dots);
  const verdict = sprite('لا يمكن التعميم', 0.3, { size: 46, width: 560, weight: 800, border: '#d4ad55', color: '#2b2620', bg: 'rgba(251,248,240,.98)' }); verdict.position.set(0, DR + 0.07, 0); g.add(verdict);

  let now = 0, finished = false;
  const slotPos = (k, out) => { const a = (k / 7) * TAU; return out.set(Math.cos(a) * RC, 0.022 + 0.34, Math.sin(a) * RC); };
  function touch(i) {
    const c = coins[i]; if (c.slot >= 0 || now < 3) return;
    c.slot = docked; c.fly = now; c.from.copy(c.holder.position); docked++; drawScr(now); ctx.sfx.pop?.(); B.hit(c.inner, now, 0.2);
    retext(lab, c.s.w, c.s.w.length > 14 ? 0.3 : 0.2, { size: 40, width: c.s.w.length > 14 ? 560 : 380, weight: 800, border: hx(c.s.c), color: '#2b2620', bg: 'rgba(251,248,240,.97)' }); labW = c.s.w.length > 14 ? 0.3 : 0.2; labT = now;
    burstAt(ctx, g, new THREE.Vector3(0, 0.3, 0.05), c.s.c, 20, 0.35, 0.03);
    ctx.ui.card({ tag: 'دراسة', title: c.s.w, body: c.s.b, color: c.s.c });
    if (docked === 7 && !finished) {
      finished = true;
      setTimeout(() => { domeAt = now; ctx.sfx.whoosh?.(); }, 1200);
      setTimeout(() => { ctx.ui.card({ tag: 'تقويم الأدلة', title: 'لا يمكن التعميم', body: 'جاءت هذه الدراسات في معظمها على مستوى ضيق، وتحتاج إلى بحث شامل وموسع قبل تعميم نتائجها.', color: 0xd4ad55 }); ctx.sfx.good?.(); ctx.ui.done(); }, 2800);
    }
  }
  coins.forEach((c, i) => ctx.tap(c.holder, () => touch(i)));
  ctx.tap(ph, () => { ctx.sfx.pop?.(); B.hit(ph, now, 0.05); });
  ctx.ui.hud('المس العملات لتجمع الدراسات');

  const v = new THREE.Vector3(), w = new THREE.Vector3();
  return {
    update(t, dt, e) {
      now = t; R.update(t, e); B.update(t);
      
      const on = stag(t, 1.4, 0.9) * e; scr.material.opacity = on; sGlow.material.opacity = 0.3 * on * (0.8 + 0.2 * Math.sin(t * 3)); if (((t * 10) | 0) % 2 === 0) drawScr(t * 2);
      orbitRing.scale.setScalar(Math.max(stag(t, 1.0, 1, ease) * e, 0.001)); crownRing.material.opacity = 0.2 + 0.1 * docked;
      coins.forEach((c, i) => {
        const k = stag(t, 2.0 + i * 0.35, 0.8, easeBack) * e; c.holder.visible = k > 0.01; c.holder.scale.setScalar(Math.max(k, 0.001));
        if (c.slot < 0) {
          const a = c.a + t * 0.22;
          v.set(Math.cos(a) * RO, 0, Math.sin(a) * RO); orbitGrp.localToWorld(w.copy(v)); g.worldToLocal(w);
          c.holder.position.copy(w);           c.holder.rotation.set(0, -a + Math.PI / 2, 0);
          c.holder.position.y += 0.012 * Math.sin(t * 1.8 + i);
          pulseHint(c.hint, t, i * 0.9, k, 0.3);
        } else {
          c.hint.material.opacity = 0;
          const p = clamp01((t - c.fly) / 0.9), ep = ease(p);
          const sa = ((c.slot / 7) * TAU) + t * 0.3; v.set(Math.cos(sa) * RC, 0.022 + 0.34, Math.sin(sa) * RC);
          c.holder.position.lerpVectors(c.from, v, ep); c.holder.position.y += Math.sin(p * Math.PI) * 0.06;
          c.holder.rotation.y = THREE.MathUtils.lerp(c.holder.rotation.y, -sa + Math.PI / 2, 0.15); c.holder.scale.setScalar(Math.max(k * (1 - 0.35 * ep), 0.001));
        }
      });
      crownGrp.rotation.y = 0;
      const lk = t - labT < 3.2 ? stag(t, labT, 0.4, easeBack) : Math.max(0, 1 - (t - labT - 3.2) / 0.4);
      setSpr(lab, labW, lk * e);
      if (domeAt > 0) { const dk = ease((t - domeAt) / 1.4); dome.material.opacity = 0.2 * dk; dome.scale.setScalar(0.25 + 0.75 * dk); domeRing.visible = true; domeRing.scale.setScalar(Math.max(0.25 + 0.75 * dk, 0.001)); dots.material.opacity = 0.85 * dk; dots.scale.setScalar(0.25 + 0.75 * dk); setSpr(verdict, 0.3, easeBack((t - domeAt - 0.8) / 0.6) * e); } else setSpr(verdict, 0.3, 0);
      pback.scale.setScalar(1);
    },
  };
}
