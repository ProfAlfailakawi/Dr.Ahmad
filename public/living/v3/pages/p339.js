import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { P, ease, easeBack, clamp01, stag, mat, glossy, goldMat, shadowed, glow, sprite, lightTube } from '../../kit.js?v=34';
import { inked } from '../../pencil.js?v=34';
import { TAU, revealer, bumper, canvasTex, faceMat, fillText, hintGlow, pulseHint, setSpr, burstAt } from '../lib/a6-kit.js?v=34';

export const meta = { free: true, center: [0.51, 0.62], typeLabel: 'مقارنة بمجسّم يدور' };

const RED = 0xe62b1e, BLUE = 0x2a6fd0;
const PLATES = [
  { w: 'أسئلة', c: 0xf2a02f, b: 'يمكن إضافة أسئلة عقب كل محاضرة، وهي الخدمة التي يسميها الموقع Flip.' },
  { w: 'أنشطة', c: 0x4aa84f, b: 'ونشاطات تُضاف عقب كل محاضرة لتجعل الدرس المبني على الفيديو تفاعلياً.' },
  { w: 'تعديل الدرس', c: 0x8e5bd0, b: 'يمكن تعديل الدرس أكثر من مرة، وهذا ما يسمح للمدرس بإضافة الأسئلة والأنشطة.' },
];
const hx = (c) => '#' + c.toString(16).padStart(6, '0');

export default function build(ctx) {
  const g = new THREE.Group(); g.position.copy(P(meta.center[0], meta.center[1])); g.scale.setScalar(1.3); ctx.stage.add(g);
  const R = revealer(), B = bumper();

  // only a small turntable carries the panel; red and blue light pools on the page mark the two sides
  const mkPool = (c, x) => { const m = new THREE.Mesh(new THREE.CircleGeometry(0.17, 40), new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.0, depthWrite: false, toneMapped: false })); m.rotation.x = -Math.PI / 2; m.scale.set(1, 1, 0.8); m.position.set(x, 0.002, 0.04); g.add(m); return m; };
  const poolR = mkPool(RED, -0.2), poolB = mkPool(BLUE, 0.2);
  const disc = { userData: { reveal() {} } }, r1 = { scale: { setScalar() {} } }, r2 = r1, under = r1;
  const turn = inked(new THREE.CylinderGeometry(0.075, 0.085, 0.02, 32), { color: 0xd8dce0 }); turn.position.y = 0.01; g.add(turn); R.add(turn, 0.4, 0.9);
  const axle = new THREE.Mesh(new THREE.CylinderGeometry(0.007, 0.007, 0.34, 12), goldMat()); axle.position.y = 0.19; g.add(axle);
  const cap = new THREE.Mesh(new THREE.SphereGeometry(0.014, 16, 12), goldMat()); cap.position.y = 0.37; g.add(cap);

  // the revolving panel
  const slab = new THREE.Group(); slab.position.y = 0.2; g.add(slab);
  const frame = inked(new RoundedBoxGeometry(0.36, 0.24, 0.026, 4, 0.012), { color: 0x2b2f3a }); slab.add(frame); R.add(frame, 0.6, 1.2);
  const frontTex = canvasTex(512, 340, (c, w, h) => {
    const gr = c.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#f0382a'); gr.addColorStop(1, '#a8140d'); c.fillStyle = gr; c.fillRect(0, 0, w, h);
    c.font = '900 190px Arial Black, Arial, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = '#ffffff'; c.fillText('TED', w / 2, 140);
    fillText(c, 'أفكار تستحق الانتشار', w / 2, 270, 46, '#ffe3df', 800);
  });
  const backTex = canvasTex(512, 340, (c, w, h) => {
    const gr = c.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#2f7fe0'); gr.addColorStop(1, '#16316e'); c.fillStyle = gr; c.fillRect(0, 0, w, h);
    c.font = '900 130px Arial Black, Arial, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = '#ffffff'; c.fillText('TED-Ed', w / 2, 120);
    c.fillStyle = 'rgba(255,255,255,.3)'; c.beginPath(); c.roundRect(60, 214, 392, 14, 7); c.fill(); c.fillStyle = '#ffd27a'; c.beginPath(); c.roundRect(60, 214, 240, 14, 7); c.fill();
    fillText(c, 'درس يُبنى فوق الفيديو', w / 2, 290, 44, '#e3efff', 800);
  });
  const fm = new THREE.Mesh(new THREE.PlaneGeometry(0.33, 0.219), faceMat(frontTex, { transparent: true, opacity: 0 })); fm.position.z = 0.0135; slab.add(fm);
  const bm = new THREE.Mesh(new THREE.PlaneGeometry(0.33, 0.219), faceMat(backTex, { transparent: true, opacity: 0 })); bm.rotation.y = Math.PI; bm.position.z = -0.0135; slab.add(bm);

  // timer (TED side)
  const clock = new THREE.Group(); clock.position.set(-0.26, 0.3, 0.1); g.add(clock);
  const cring = new THREE.Mesh(new THREE.TorusGeometry(0.036, 0.005, 10, 36), goldMat()); clock.add(cring);
  const cface = new THREE.Mesh(new THREE.CircleGeometry(0.034, 36), faceMat(canvasTex(128, 128, (c) => { c.fillStyle = '#fbf7ec'; c.fillRect(0, 0, 128, 128); c.fillStyle = '#e62b1e'; c.beginPath(); c.moveTo(64, 64); c.arc(64, 64, 58, -Math.PI / 2, -Math.PI / 2 + TAU * 0.3); c.closePath(); c.fill(); c.strokeStyle = '#2b2620'; c.lineWidth = 5; for (let i = 0; i < 12; i++) { const a = (i / 12) * TAU; c.beginPath(); c.moveTo(64 + Math.cos(a) * 50, 64 + Math.sin(a) * 50); c.lineTo(64 + Math.cos(a) * 58, 64 + Math.sin(a) * 58); c.stroke(); } }))); cface.position.z = 0.002; clock.add(cface);
  const hand = new THREE.Mesh(new THREE.BoxGeometry(0.003, 0.028, 0.002), mat(0x2b2620)); hand.geometry.translate(0, 0.012, 0); hand.position.z = 0.0045; clock.add(hand);
  const clockLab = sprite('حتى ١٨ دقيقة', 0.17, { size: 40, width: 380, weight: 800, border: hx(RED), color: '#2b2620', bg: 'rgba(251,248,240,.97)' }); clockLab.position.set(-0.26, 0.375, 0.1); g.add(clockLab);
  const clockHint = hintGlow(RED, 0.15); clock.add(clockHint); clockHint.position.z = 0.01;

  // teacher and student
  const fig = (x, rotY) => {
    const grp = new THREE.Group(); grp.position.set(x, 0.0, 0.15); grp.rotation.y = rotY; g.add(grp);
    const m = new THREE.MeshStandardMaterial({ color: 0xb9b3a6, roughness: 0.55 });
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.02, 0.05, 6, 16), m); body.position.y = 0.05; grp.add(body);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.0195, 20, 16), mat(0xf0c8a0)); head.position.y = 0.11; grp.add(head);
    const ringF = new THREE.Mesh(new THREE.TorusGeometry(0.036, 0.003, 8, 28), new THREE.MeshBasicMaterial({ color: BLUE, toneMapped: false, transparent: true, opacity: 0 })); ringF.rotation.x = Math.PI / 2; ringF.position.y = 0.002; grp.add(ringF);
    shadowed(grp);
    const hint = hintGlow(BLUE, 0.14); hint.position.set(0, 0.06, 0.03); grp.add(hint);
    return { grp, m, ringF, hint };
  };
  const teacher = fig(-0.24, 0.55), student = fig(0.24, -0.55);
  const arcCurve = new THREE.QuadraticBezierCurve3(new THREE.Vector3(-0.24, 0.13, 0.15), new THREE.Vector3(0, 0.34, 0.24), new THREE.Vector3(0.24, 0.13, 0.15));
  const link = lightTube(arcCurve, { radius: 0.0045, color: 0x7fd0ff, speed: 0.8, glass: false }); g.add(link); link.userData.fill(0);
  const pkt = glow(0xffffff, 0.05, 0.9); g.add(pkt);

  // plates (TED-Ed layers)
  const plates = PLATES.map((pl, i) => {
    const holder = new THREE.Group(); holder.position.set(-0.135 + i * 0.135, 0.1, 0.2); g.add(holder);
    const inner = new THREE.Group(); holder.add(inner);
    const b = new THREE.Mesh(new RoundedBoxGeometry(0.095, 0.052, 0.01, 3, 0.005), glossy(pl.c, { emissive: pl.c, emissiveIntensity: 0.2 })); inner.add(b);
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.004, 0.004), new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false })); stripe.position.set(0, -0.005, 0.006); inner.add(stripe);
    const check = new THREE.Mesh(new THREE.CircleGeometry(0.008, 16), new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false })); check.position.set(0.032, 0.012, 0.006); inner.add(check);
    shadowed(inner);
    const lab = sprite(pl.w, 0.125, { size: 40, width: 270, weight: 800, border: hx(pl.c), color: '#2b2620', bg: 'rgba(251,248,240,.97)' }); lab.position.set(0, 0.052, 0); holder.add(lab);
    const hint = hintGlow(pl.c, 0.14); hint.position.z = 0.01; inner.add(hint);
    return { pl, holder, inner, lab, hint, seen: false };
  });

  let mode = 0, ang = 0, tgt = 0, now = 0, modeSeen = new Set([0]), plateSeen = new Set(), finished = false, k = 0;
  function check() { if (!finished && modeSeen.size === 2 && plateSeen.size === 3) { finished = true; setTimeout(() => { ctx.sfx.good?.(); ctx.ui.done(); }, 1500); } }
  function flip(byUser) {
    mode = 1 - mode; tgt = mode * Math.PI; modeSeen.add(mode); ctx.sfx.whoosh?.();
    burstAt(ctx, g, new THREE.Vector3(0, 0.3, 0.06), mode ? BLUE : RED, 26, 0.45, 0.03);
    if (byUser) {
      ctx.ui.card(mode
        ? { tag: 'تيد التعليمي', title: 'درس يُبنى على الفيديو', body: 'مواد ومحاضرات تعليمية مبنية على الفيديو، ويتيح إنشاء دروس تفاعلية أو مخصصة مبنية على الفيديوهات.', color: BLUE }
        : { tag: 'تيد التقليدي', title: 'إلهام قصير', body: 'محاضرات مصوّرة قصيرة هدفها تحفيزي: إثارة الخيال والحماس في المتعلم وإيصال الفكرة بشكل مختصر.', color: RED });
      check();
    }
  }
  ctx.tap(slab, () => { if (now > 2.5) flip(true); });
  ctx.tap(clock, () => { if (mode === 0) { ctx.sfx.pop?.(); B.hit(clock, now, 0.2); ctx.ui.card({ tag: 'تيد التقليدي', title: 'حدّ أقصى ١٨ دقيقة', body: 'تُقدَّم الفكرة بصيغتها المصوّرة كما هي، في محاضرة قصيرة بحدّ أقصى ١٨ دقيقة.', color: RED }); } });
  [teacher, student].forEach((f, i) => ctx.tap(f.grp, () => {
    ctx.sfx.pop?.(); B.hit(f.grp, now, 0.15);
    ctx.ui.card(mode ? { tag: 'تيد التعليمي', title: 'تفاعل بين المدرس والطلاب', body: 'يتيح الموقع إمكانية التفاعل بين المدرس والطلاب حول الفيديو.', color: BLUE } : { tag: 'تيد التقليدي', title: 'المشاهد متلقٍّ', body: 'لا تفاعل بين المدرس والطلاب؛ الفكرة تُقدَّم بصيغتها المصوّرة كما هي.', color: RED });
  }));
  plates.forEach((p, i) => ctx.tap(p.holder, () => { if (mode !== 1 || k < 0.6) return; ctx.sfx.pop?.(); p.seen = true; plateSeen.add(i); B.hit(p.inner, now, 0.18); ctx.ui.card({ tag: 'تيد التعليمي', title: p.pl.w, body: p.pl.b, color: p.pl.c }); check(); }));
  ctx.ui.hud('المس اللوحة لتقلبها');

  const pv = new THREE.Vector3();
  return {
    update(t, dt, e) {
      now = t; R.update(t, e); B.update(t);
      poolR.material.opacity = 0.2 * e * (1 - k * 0.7); poolB.material.opacity = 0.2 * e * (0.3 + 0.7 * k);
      const on = stag(t, 1.4, 0.9) * e; fm.material.opacity = on; bm.material.opacity = on;
      axle.scale.set(1, Math.max(stag(t, 0.6, 0.8) * e, 0.001), 1); cap.scale.setScalar(Math.max(stag(t, 1.2, 0.5, easeBack) * e, 0.001));
      if (t > 6.5 && !flip.auto && modeSeen.size === 1) { flip.auto = true; flip(false); }
      ang = THREE.MathUtils.damp(ang, tgt, 3.2, dt);
      slab.rotation.y = ang + Math.sin(t * 0.7) * 0.06 * (1 - Math.abs(Math.sin(ang)));
      slab.position.y = 0.2 + 0.006 * Math.sin(t * 1.4); slab.scale.setScalar(Math.max(stag(t, 0.7, 0.9, easeBack) * e, 0.001));
      k = THREE.MathUtils.damp(k, mode, 3.5, dt);
      // TED side props
      const ck = (1 - k) * stag(t, 2.2, 0.7, easeBack) * e; clock.scale.setScalar(Math.max(ck, 0.001)); clock.visible = ck > 0.01;
      hand.rotation.z = -t * 0.9; pulseHint(clockHint, t, 0, ck > 0.8 ? 1 : 0, 0.3);
      setSpr(clockLab, 0.17, ck * stag(t, 2.6, 0.5, easeBack));
      // figures: grey and passive, then blue and connected
      [teacher, student].forEach((f, i) => {
        const fk = stag(t, 1.8 + i * 0.2, 0.8, easeBack) * e; f.grp.scale.setScalar(Math.max(fk, 0.001));
        f.m.color.setHex(mode ? (i ? 0xe0603f : 0x2f5bb0) : 0xb9b3a6);
        f.ringF.material.opacity = k * 0.9; pulseHint(f.hint, t, i * 2, fk > 0.8 ? 1 : 0, 0.28);
        f.grp.position.y = 0.004 * Math.sin(t * 2 + i) * k;
      });
      link.userData.update(dt); link.userData.fill(k * e); link.visible = k > 0.02;
      const u = (t * 0.5) % 1; arcCurve.getPoint(u, pv); pkt.position.copy(pv); pkt.material.opacity = 0.9 * k * Math.sin(u * Math.PI); pkt.scale.setScalar(0.05);
      plates.forEach((p, i) => {
        const pk = clamp01(k * 1.4 - 0.15 * i) * stag(t, 2.4, 0.6) * e; const pe = easeBack(pk);
        p.holder.visible = pk > 0.01; p.holder.scale.setScalar(Math.max(pe, 0.001));
        p.holder.position.y = 0.03 + 0.085 * pe + 0.006 * Math.sin(t * 1.6 + i);
        p.inner.rotation.y = Math.sin(t * 0.8 + i) * 0.12;
        pulseHint(p.hint, t, i * 1.2, p.seen ? 0 : pk, 0.3);
        setSpr(p.lab, 0.125, pk > 0.7 ? 1 : 0);
        p.lab.position.y = 0.05 + 0.0;
      });
    },
  };
}
