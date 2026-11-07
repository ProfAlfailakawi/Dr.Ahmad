import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { P, ease, easeBack, clamp01, stag, mat, glossy, goldMat, shadowed, glow, glowTexture } from '../../kit.js?v=16';
import { inked } from '../../pencil.js?v=16';
import { TAU, toAr, revealer, bumper, canvasTex, faceMat, fillText, hintGlow, pulseHint, burstAt } from '../lib/a6-kit.js?v=16';

export const meta = { free: true, center: [0.5, 0.45], typeLabel: 'سباق زمني' };

const EV = [
  { t1: 'الدرس الأول', t2: 'لنادية', when: 'أواخر ٢٠٠٤', c: 0xe0463a, title: 'أول درس لنادية', b: 'بدأ يدرّس ابنة عمه نادية الرياضيات باستخدام مفكرة رقمية للرسم.' },
  { t1: 'يزداد', t2: 'الطلب', when: 'بعد الدرس الأول', c: 0xf2a02f, title: 'يزداد الطالبون', b: 'ازداد عدد الأقارب والأصدقاء الذين يطلبون المساعدة نفسها.' },
  { t1: 'فيديو على', t2: 'يوتيوب', when: 'بعد تزايد الطلب', c: 0x3a6fd0, title: 'الفيديو على يوتيوب', b: 'قرر وضع فيديوهاته التعليمية على اليوتيوب لنشر الفائدة وتوفير الوقت.' },
  { t1: 'تأسيس', t2: 'الأكاديمية', when: '٢٠٠٦', c: 0x4aa84f, title: 'تأسيس الأكاديمية', b: 'تأسيس أكاديمية خان مؤسسةً تربوية غير ربحية.' },
  { t1: 'خان يترك', t2: 'عمله', when: '٢٠٠٩', c: 0x2fa8c0, title: 'التفرغ للأكاديمية', b: 'ترك عمله في التمويل والاقتصاد ليتفرغ لتوسيع الأكاديمية بعد شهادات التقدير التي انهالت عليه.' },
  { t1: '٣٥ ألف', t2: 'مشاهد', when: 'أواخر ٢٠٠٩', c: 0x8e5bd0, title: 'إقبال شديد', b: 'تحصد فيديوهاته التعليمية إقبالاً شديداً يتجاوز ٣٥٠٠٠ مشاهد.' },
];
const FAN = [3, 0, 5, 2, 4, 1];
const SX = (k) => 0.34 - k * 0.136;
const SH = (k) => 0.05 + k * 0.045;
const hx = (c) => '#' + c.toString(16).padStart(6, '0');
const CROWD = 420, COUNTS = [0, 10, 40, 110, 220, 420];
const TS = 1.6;

function tileTex(e) {
  return canvasTex(256, 168, (c, w, h) => {
    c.fillStyle = '#fbf7ec'; c.fillRect(0, 0, w, h);
    c.fillStyle = hx(e.c); c.fillRect(0, 0, w, 50);
    c.fillStyle = 'rgba(255,255,255,.95)'; c.beginPath(); c.moveTo(24, 12); c.lineTo(24, 38); c.lineTo(44, 25); c.closePath(); c.fill();
    fillText(c, e.when, w / 2 + 14, 27, 26, '#ffffff', 800);
    fillText(c, e.t1, w / 2, 92, 42, '#2b2620', 800); fillText(c, e.t2, w / 2, 138, 46, hx(e.c), 800);
  });
}

export default function build(ctx) {
  const g = new THREE.Group(); g.position.copy(P(meta.center[0], meta.center[1])); ctx.stage.add(g);
  const R = revealer(), B = bumper();
  let step = 0;

  // a chunky staircase: the timeline itself, rising to the left
  const steps = EV.map((e, k) => {
    const grp = new THREE.Group(); grp.position.set(SX(k), 0, -0.05); g.add(grp);
    const h = SH(k);
    const body = inked(new RoundedBoxGeometry(0.128, h, 0.17, 3, 0.012), { color: 0xf3ecdc }); body.position.y = h / 2; grp.add(body);
    const topM = new THREE.MeshStandardMaterial({ color: 0x1b2540, roughness: 0.3, metalness: 0.2, emissive: 0x000000 });
    const plate = new THREE.Mesh(new RoundedBoxGeometry(0.12, 0.012, 0.16, 2, 0.005), topM); plate.position.y = h + 0.004; grp.add(plate);
    const numTex = canvasTex(128, 128, (c) => { fillText(c, toAr(k + 1), 64, 70, 84, 'rgba(255,255,255,.7)', 800, '"Reem Kufi", Tajawal'); });
    const num = new THREE.Mesh(new THREE.PlaneGeometry(0.075, 0.075), new THREE.MeshBasicMaterial({ map: numTex, transparent: true, depthWrite: false, toneMapped: false })); num.rotation.x = -Math.PI / 2; num.position.set(0, h + 0.0115, 0.02); grp.add(num);
    const front = new THREE.Mesh(new THREE.PlaneGeometry(0.1, 0.03), new THREE.MeshBasicMaterial({ color: e.c, transparent: true, opacity: 0.0, toneMapped: false })); front.position.set(0, h * 0.5, 0.0862); grp.add(front);
    const hint = hintGlow(0xffd27a, 0.2); hint.position.set(0, h + 0.03, 0.02); grp.add(hint);
    R.add(body, 0.2 + k * 0.18, 0.9);
    return { grp, body, plate, topM, num, front, hint, h, filled: false };
  });

  // billboard behind the low steps with a crowd of lights
  const bb = new THREE.Group(); bb.position.set(0.11, 0.0, -0.2); g.add(bb);
  [-0.17, 0.17].forEach((x) => { const post = inked(new THREE.CylinderGeometry(0.012, 0.014, 0.26, 12), { color: 0xcfd6dc }); post.position.set(x, 0.13, -0.01); bb.add(post); R.add(post, 0.8, 0.8); });
  const bFrame = inked(new RoundedBoxGeometry(0.46, 0.28, 0.024, 3, 0.012), { color: 0x2b3342 }); bFrame.position.y = 0.4; bb.add(bFrame); R.add(bFrame, 0.9, 1);
  const sCv = document.createElement('canvas'); sCv.width = 512; sCv.height = 300; const sg = sCv.getContext('2d');
  const sTex = new THREE.CanvasTexture(sCv); sTex.colorSpace = THREE.SRGBColorSpace; sTex.anisotropy = 4;
  const sMesh = new THREE.Mesh(new THREE.PlaneGeometry(0.43, 0.252), new THREE.MeshBasicMaterial({ map: sTex, toneMapped: false, transparent: true, opacity: 0 })); sMesh.position.set(0, 0.4, 0.0125); bb.add(sMesh);
  const bBack = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 0.012, 20), goldMat()); bBack.rotation.x = Math.PI / 2; bBack.position.set(0, 0.4, -0.018); bb.add(bBack);
  function drawScreen() {
    const gr = sg.createLinearGradient(0, 0, 0, 300); gr.addColorStop(0, '#1b2b4a'); gr.addColorStop(1, '#2c1a3f'); sg.fillStyle = gr; sg.fillRect(0, 0, 512, 300);
    if (step >= 6) { fillText(sg, '+٣٥٠٠٠', 256, 118, 120, '#ffe39a', 800); fillText(sg, 'مشاهد', 256, 218, 58, '#ffffff', 800); }
    else {
      sg.fillStyle = '#e0463a'; sg.beginPath(); sg.roundRect(186, 50, 140, 98, 26); sg.fill(); sg.fillStyle = '#fff'; sg.beginPath(); sg.moveTo(238, 72); sg.lineTo(238, 126); sg.lineTo(286, 99); sg.closePath(); sg.fill();
      sg.fillStyle = 'rgba(255,255,255,.2)'; sg.beginPath(); sg.roundRect(60, 200, 392, 18, 9); sg.fill();
      sg.fillStyle = '#ffd27a'; sg.beginPath(); sg.roundRect(452 - 392 * (step / 6), 200, Math.max(18, 392 * (step / 6)), 18, 9); sg.fill();
      for (let i = 0; i < 6; i++) { sg.fillStyle = i < step ? '#ffd27a' : 'rgba(255,255,255,.35)'; sg.beginPath(); sg.arc(436 - i * 74, 258, 10, 0, TAU); sg.fill(); }
    }
    sTex.needsUpdate = true;
  }
  drawScreen();
  const cpos = new Float32Array(CROWD * 3), cph = new Float32Array(CROWD * 3);
  for (let i = 0; i < CROWD; i++) { cph[i * 3] = Math.random() * TAU; cph[i * 3 + 1] = Math.random(); cph[i * 3 + 2] = Math.random(); }
  const cgeo = new THREE.BufferGeometry(); cgeo.setAttribute('position', new THREE.BufferAttribute(cpos, 3)); cgeo.setDrawRange(0, 0);
  const crowd = new THREE.Points(cgeo, new THREE.PointsMaterial({ map: glowTexture(), color: 0xffc95a, size: 0.032, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  crowd.frustumCulled = false; crowd.position.set(0.11, 0.0, -0.2); g.add(crowd);
  let crowdN = 0;

  // tiles: a fan of big cards in front
  const tiles = FAN.map((ei, j) => {
    const e = EV[ei];
    const home = new THREE.Vector3(0.355 - j * 0.142, 0.1, 0.27 + 0.025 * Math.cos(j * 1.3));
    const holder = new THREE.Group(); holder.position.copy(home); g.add(holder);
    const inner = new THREE.Group(); inner.scale.setScalar(TS); holder.add(inner);
    const body = new THREE.Mesh(new RoundedBoxGeometry(0.1, 0.068, 0.014, 3, 0.006), glossy(0xf4efe3)); inner.add(body);
    const face = new THREE.Mesh(new THREE.PlaneGeometry(0.094, 0.062), faceMat(tileTex(e))); face.position.z = 0.0075; inner.add(face);
    const back = new THREE.Mesh(new THREE.PlaneGeometry(0.094, 0.062), new THREE.MeshBasicMaterial({ color: e.c, toneMapped: false })); back.rotation.y = Math.PI; back.position.z = -0.0075; inner.add(back);
    shadowed(inner);
    const hint = hintGlow(e.c, 0.15); hint.position.z = 0.012; inner.add(hint);
    return { e, ei, holder, inner, hint, home, placed: -1, fly: -9, shake: -9, tilt: (j % 2 ? 1 : -1) * 0.14, from: new THREE.Vector3() };
  });

  let now = 0, finished = false;
  function tap(j) {
    const tl = tiles[j]; if (tl.placed >= 0 || finished || now < 3) return;
    if (tl.ei === step) {
      tl.placed = step; tl.fly = now; tl.from.copy(tl.holder.position); steps[step].filled = true; ctx.sfx.good?.(); B.hit(tl.inner, now, 0.1);
      ctx.ui.card({ tag: tl.e.when, title: tl.e.title, body: tl.e.b, color: tl.e.c });
      const sk = step; step++; drawScreen(); crowdN = COUNTS[step - 1] || 0;
      steps[sk].topM.color.setHex(tl.e.c); steps[sk].topM.emissive.setHex(tl.e.c); steps[sk].topM.emissiveIntensity = 0.5; steps[sk].front.material.opacity = 0.9;
      setTimeout(() => burstAt(ctx, g, new THREE.Vector3(SX(sk), SH(sk) + 0.1, -0.05), tl.e.c, 28, 0.45, 0.032), 700);
      if (step >= 6) { finished = true; setTimeout(() => { burstAt(ctx, g, new THREE.Vector3(0.11, 0.45, -0.18), 0xffd27a, 60, 0.7, 0.045); ctx.ui.card({ tag: 'رحلة مكتملة', title: 'كل خطوة نتجت عن سابقتها', body: 'الطلب المتزايد ثم النشر ثم التأسيس: فكرة صغيرة لدرس خصوصي صارت أكاديمية للجميع.', color: 0xd4ad55 }); ctx.sfx.good?.(); ctx.ui.done(); ctx.ui.hud(''); }, 1500); }
    } else { tl.shake = now; ctx.sfx.bad?.(); ctx.ui.toast('ليست الخطوة التالية'); }
  }
  tiles.forEach((tl, j) => ctx.tap(tl.holder, () => tap(j)));
  ctx.ui.hud('المس الحدث التالي بالترتيب');

  const v = new THREE.Vector3();
  return {
    update(t, dt, e) {
      now = t; R.update(t, e); B.update(t);
      sMesh.material.opacity = stag(t, 1.1, 0.7) * e; bBack.scale.setScalar(Math.max(e, 0.001));
      steps.forEach((s, k) => {
        const kk = stag(t, 0.2 + k * 0.17, 0.7, easeBack) * e; s.grp.scale.set(1, Math.max(kk, 0.001), 1); s.grp.visible = kk > 0.01;
        pulseHint(s.hint, t, k, k === step && !finished ? kk : 0, 0.5);
        s.num.material.opacity = s.filled ? 0.0 : 1;
      });
      tiles.forEach((tl, j) => {
        const k = stag(t, 0.8 + j * 0.14, 0.8, easeBack) * e;
        tl.holder.visible = k > 0.01;
        if (tl.placed < 0) {
          tl.holder.scale.setScalar(Math.max(k, 0.001));
          tl.holder.position.set(tl.home.x, tl.home.y + 0.01 * Math.sin(t * 1.6 + j * 1.2) + (1 - k) * 0.25, tl.home.z);
          tl.inner.rotation.set(0, tl.tilt + 0.1 * Math.sin(t * 0.9 + j), (j % 2 ? 1 : -1) * 0.04);
          pulseHint(tl.hint, t, j, k, 0.3);
          tl.inner.position.x = now - tl.shake < 0.5 ? Math.sin((now - tl.shake) * 55) * 0.008 * (1 - (now - tl.shake) / 0.5) : 0;
        } else {
          tl.hint.material.opacity = 0;
          const p = clamp01((t - tl.fly) / 0.9), ep = ease(p), s = steps[tl.placed];
          v.set(SX(tl.placed), s.h + 0.012 + 0.058, -0.05 + 0.03);
          tl.holder.position.lerpVectors(tl.from, v, ep); tl.holder.position.y += Math.sin(p * Math.PI) * 0.14;
          tl.inner.scale.setScalar(THREE.MathUtils.lerp(TS, 1.05, ep)); tl.inner.rotation.set(0, THREE.MathUtils.lerp(tl.inner.rotation.y, 0, 0.15), 0);
        }
      });
      const cur = cgeo.drawRange.count; cgeo.setDrawRange(0, Math.round(THREE.MathUtils.lerp(cur, crowdN, 0.06)));
      const a = cgeo.attributes.position.array;
      for (let i = 0; i < CROWD; i++) { const ang = cph[i * 3] + t * (0.15 + cph[i * 3 + 2] * 0.2); const r = 0.26 + cph[i * 3 + 2] * 0.12; a[i * 3] = Math.cos(ang) * r; a[i * 3 + 1] = 0.08 + cph[i * 3 + 1] * 0.5 + 0.02 * Math.sin(t * 2 + i); a[i * 3 + 2] = Math.sin(ang) * r * 0.5 + 0.02; }
      cgeo.attributes.position.needsUpdate = true;
    },
  };
}
