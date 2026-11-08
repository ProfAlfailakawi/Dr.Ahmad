import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { P, ease, easeBack, clamp01, stag, mat, glossy, goldMat, shadowed, glow } from '../../kit.js?v=21';
import { inked } from '../../pencil.js?v=21';
import { TAU, revealer, hintGlow, pulseHint, bumper, canvasTex, faceMat, fillText, burstAt } from '../lib/a6-kit.js?v=21';

export const meta = { free: true, center: [0.56, 0.64], typeLabel: 'لعبة مطابقة' };

const ITEMS = [
  { w: 'القواعد', clue: 'تحديد كيفية اللعب', body: 'تحديد كيفية اللعب: لكل لعبة قواعد تحدد ما يجوز فيها.', c: 0xd4ad55 },
  { w: 'المنافسة', clue: 'مواجهة متعلم لآخر', body: 'الاعتماد في تحقيق الأهداف على مواجهة بين متعلم وآخر، أو بينه وبين الجهاز أو محك أو معيار.', c: 0xe0603f },
  { w: 'التحدي', clue: 'صعوبة تستنفر قدراتك', body: 'قدر ملائم من الصعوبة يستنفر قدرات الفرد في حدود ممكنة.', c: 0x3a6fd0 },
  { w: 'الخيال', clue: 'إثارة خيال الفرد', body: 'إثارة خيال الفرد بما يحقق الدافعية والرغبة في التعلم.', c: 0x2fa8c0 },
  { w: 'تفريد التعلم', clue: 'مراعاة الفروق الفردية', body: 'مواجهة الفروق الفردية وتعليم الأطفال وفق إمكاناتهم وقدراتهم.', c: 0x8e5bd0 },
  { w: 'تأكيد الذات', clue: 'التفوق على الآخرين', body: 'التفوق على الآخرين فردياً وفي نطاق الجماعة.', c: 0x8a9a1f },
];
const ORDER = [0, 3, 4, 2, 5, 1];
const hexs = (c) => '#' + c.toString(16).padStart(6, '0');

function cartridgeFace(it) {
  return canvasTex(256, 330, (g, w, h) => {
    g.fillStyle = hexs(it.c); g.fillRect(0, 0, w, h);
    g.fillStyle = 'rgba(255,255,255,.16)'; g.fillRect(0, 0, w, 70);
    g.fillStyle = '#fbf7ec'; g.beginPath(); g.roundRect(18, 90, w - 36, 160, 22); g.fill();
    g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(w / 2 - 60, 22, 120, 16);
    fillText(g, it.w, w / 2, 170, it.w.length > 8 ? 40 : 56, '#2b2620', 800);
    g.fillStyle = 'rgba(255,255,255,.55)'; for (let i = 0; i < 6; i++) g.fillRect(34 + i * 34, 270, 22, 30);
  });
}

export default function build(ctx) {
  const g = new THREE.Group(); g.position.copy(P(meta.center[0], meta.center[1])); g.scale.setScalar(1.02); ctx.stage.add(g);
  const R = revealer(), B = bumper();

  // an arcade cabinet of the idea itself: navy body, teal control deck, glowing marquee
  const cab = new THREE.Group(); cab.position.set(0, 0, -0.06); g.add(cab);
  const base = inked(new RoundedBoxGeometry(0.36, 0.25, 0.27, 4, 0.016), { color: 0x2b3f77 }); base.position.y = 0.125; cab.add(base); R.add(base, 0.2, 1);
  const sideL = new THREE.Mesh(new RoundedBoxGeometry(0.012, 0.5, 0.275, 2, 0.005), glossy(0x3fb0c8)); sideL.position.set(-0.186, 0.25, -0.01); cab.add(sideL);
  const sideR = sideL.clone(); sideR.position.x = 0.186; cab.add(sideR);
  const deck = inked(new RoundedBoxGeometry(0.36, 0.03, 0.15, 3, 0.01), { color: 0x3fb0c8 }); deck.position.set(0, 0.265, 0.1); deck.rotation.x = -0.22; cab.add(deck); R.add(deck, 0.5, 0.9);
  const hous = inked(new RoundedBoxGeometry(0.34, 0.27, 0.2, 4, 0.016), { color: 0x24355f }); hous.position.set(0, 0.395, -0.04); cab.add(hous); R.add(hous, 0.4, 1);
  const mar = inked(new RoundedBoxGeometry(0.36, 0.085, 0.22, 3, 0.012), { color: 0x1b2a52 }); mar.position.set(0, 0.57, -0.035); cab.add(mar); R.add(mar, 0.7, 0.9);
  const marTex = canvasTex(512, 128, (c, w, h) => { const gr = c.createLinearGradient(0, 0, w, 0); gr.addColorStop(0, '#d4ad55'); gr.addColorStop(0.5, '#ffe39a'); gr.addColorStop(1, '#d4ad55'); c.fillStyle = '#10204a'; c.fillRect(0, 0, w, h); c.strokeStyle = gr; c.lineWidth = 6; c.strokeRect(8, 8, w - 16, h - 16); fillText(c, 'عناصر اللعبة', w / 2, 68, 70, '#ffe39a', 800, '"Reem Kufi", Tajawal'); });
  const marF = new THREE.Mesh(new THREE.PlaneGeometry(0.33, 0.07), faceMat(marTex, { transparent: true, opacity: 0 })); marF.position.set(0, 0.57, 0.0775); cab.add(marF);
  // screen
  const scrCv = document.createElement('canvas'); scrCv.width = 512; scrCv.height = 336; const sg = scrCv.getContext('2d');
  const screenTex = new THREE.CanvasTexture(scrCv); screenTex.colorSpace = THREE.SRGBColorSpace; screenTex.anisotropy = 4;
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.29, 0.19), new THREE.MeshBasicMaterial({ map: screenTex, toneMapped: false, transparent: true, opacity: 0 })); screen.position.set(0, 0.4, 0.0615); cab.add(screen);
  const sGlow = glow(0x7fe3ff, 0.5, 0); sGlow.position.set(0, 0.4, 0.1); cab.add(sGlow);
  // joystick and buttons
  const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.05, 10), mat(0xcfd6dc)); stick.position.set(-0.09, 0.3, 0.1); cab.add(stick);
  const ball = new THREE.Mesh(new THREE.SphereGeometry(0.017, 16, 12), glossy(0xe0463a)); ball.position.set(-0.09, 0.33, 0.1); cab.add(ball);
  [0xffd27a, 0x3a6fd0, 0x4aa84f].forEach((c, i) => { const b = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.01, 16), glossy(c)); b.position.set(0.03 + i * 0.045, 0.275, 0.11); b.rotation.x = -0.22; cab.add(b); });
  // cartridge slot and lamps
  const slotM = new THREE.Mesh(new RoundedBoxGeometry(0.15, 0.016, 0.01, 1, 0.003), new THREE.MeshBasicMaterial({ color: 0x0a1020, toneMapped: false })); slotM.position.set(0, 0.1, 0.1355); cab.add(slotM);
  const slotGlow = glow(0xffd27a, 0.22, 0); slotGlow.position.set(0, 0.1, 0.15); cab.add(slotGlow);
  const lamps = ITEMS.map((it, k) => { const l = new THREE.Mesh(new THREE.SphereGeometry(0.012, 14, 10), new THREE.MeshBasicMaterial({ color: 0x3a4468, toneMapped: false })); l.position.set(-0.125 + k * 0.05, 0.632, -0.035); cab.add(l); const lg = glow(it.c, 0.1, 0); lg.position.copy(l.position); cab.add(lg); return { l, lg }; });
  shadowed(cab);

  // cartridges floating in an arc in front
  const carts = ITEMS.map((it, i) => {
    const phi = (-0.5 + i / 5) * 1.8;
    const home = new THREE.Vector3(0.235 * Math.sin(phi), 0.1, 0.25 + 0.06 * Math.cos(phi));
    const holder = new THREE.Group(); holder.position.copy(home); g.add(holder);
    const inner = new THREE.Group(); holder.add(inner);
    const sh = new THREE.Mesh(new THREE.CircleGeometry(0.045, 20), new THREE.MeshBasicMaterial({ color: 0x1b2540, transparent: true, opacity: 0.18, depthWrite: false })); sh.rotation.x = -Math.PI / 2; sh.position.y = -home.y + 0.002; holder.add(sh);
    const cart = new THREE.Group(); cart.scale.setScalar(1.6); inner.add(cart);
    cart.add(new THREE.Mesh(new RoundedBoxGeometry(0.06, 0.074, 0.014, 2, 0.004), glossy(it.c)));
    const face = new THREE.Mesh(new THREE.PlaneGeometry(0.056, 0.0722), faceMat(cartridgeFace(it))); face.position.z = 0.0072; cart.add(face);
    const contact = new THREE.Mesh(new THREE.BoxGeometry(0.044, 0.004, 0.01), goldMat()); contact.position.y = -0.037; cart.add(contact);
    shadowed(cart);
    holder.rotation.y = phi * 0.5;
    const hint = hintGlow(it.c, 0.17); hint.position.set(0, 0, 0.014); inner.add(hint);
    return { holder, inner, cart, hint, home, phi, it, docked: false, fly: -9, k: -1, shake: -9, sh };
  });

  let step = 0, now = 0, resKind = '', done = false, flashUntil = 0;
  const cur = () => ORDER[step];
  function drawScreen(kind) {
    const tint = kind === 'ok' ? ['#134f3a', '#1f8a62'] : kind === 'bad' ? ['#5a1e2a', '#a8374a'] : kind === 'end' ? ['#6a4d12', '#d4ad55'] : ['#12304f', '#1f6fa0'];
    const grd = sg.createLinearGradient(0, 0, 0, 336); grd.addColorStop(0, tint[0]); grd.addColorStop(1, tint[1]); sg.fillStyle = grd; sg.fillRect(0, 0, 512, 336);
    sg.strokeStyle = 'rgba(255,255,255,.25)'; sg.lineWidth = 3;
    [[24, 24, 1, 1], [488, 24, -1, 1], [24, 312, 1, -1], [488, 312, -1, -1]].forEach(([x, y, sx, sy]) => { sg.beginPath(); sg.moveTo(x, y + 36 * sy); sg.lineTo(x, y); sg.lineTo(x + 36 * sx, y); sg.stroke(); });
    if (kind === 'end') fillText(sg, 'اكتملت العناصر الستة', 256, 168, 52, '#fff7dc');
    else {
      const t = ITEMS[cur()].clue; const words = t.split(' '); const mid = Math.ceil(words.length / 2);
      const lines = words.length > 2 ? [words.slice(0, mid).join(' '), words.slice(mid).join(' ')] : [t];
      lines.forEach((l, i) => fillText(sg, l, 256, 160 + (i - (lines.length - 1) / 2) * 72, 66, '#ffffff'));
      for (let i = 0; i < 6; i++) { sg.fillStyle = i < step ? '#ffd27a' : 'rgba(255,255,255,.28)'; sg.beginPath(); sg.arc(256 + (i - 2.5) * 32, 296, 8, 0, TAU); sg.fill(); }
      if (kind === 'ok') fillText(sg, '✓', 256, 62, 64, '#bfffe0');
      if (kind === 'bad') fillText(sg, '✕', 256, 62, 64, '#ffd0d6');
    }
    screenTex.needsUpdate = true;
  }
  drawScreen('');

  function pick(i) {
    const c = carts[i]; if (c.docked || done || now < 2.4) return;
    if (i === cur()) {
      c.docked = true; c.k = step; c.fly = now; ctx.sfx.good?.(); B.hit(c.inner, now, 0.1);
      ctx.ui.card({ tag: 'عنصر اللعبة', title: c.it.w, body: c.it.body, color: c.it.c });
      const k = step; step++; resKind = 'ok'; flashUntil = now + 0.9; drawScreen('ok');
      setTimeout(() => { burstAt(ctx, g, new THREE.Vector3(lamps[k].l.position.x, 0.7, -0.09), c.it.c, 26, 0.4, 0.035); }, 1100);
      if (step >= 6) { done = true; setTimeout(() => { drawScreen('end'); ctx.ui.hud(''); ctx.sfx.good?.(); ctx.ui.done(); }, 1700); }
      else setTimeout(() => { if (!done) drawScreen(''); }, 1400);
    } else {
      c.shake = now; ctx.sfx.bad?.(); resKind = 'bad'; flashUntil = now + 0.7; drawScreen('bad'); ctx.ui.toast('جرّب عنصراً آخر');
      setTimeout(() => { if (!done) drawScreen(''); }, 800);
    }
  }
  carts.forEach((c, i) => ctx.tap(c.holder, () => pick(i)));
  ctx.ui.hud('اختر العنصر الذي يدل عليه المعنى');

  const v = new THREE.Vector3(), SL = new THREE.Vector3(0, 0.12, 0.16);
  return {
    update(t, dt, e) {
      now = t; R.update(t, e); B.update(t);
      const on = stag(t, 1.0, 0.7) * e; screen.material.opacity = on; marF.material.opacity = on;
      sGlow.material.opacity = (0.28 + (t < flashUntil ? 0.2 : 0)) * on * (0.9 + 0.1 * Math.sin(t * 4));
      sGlow.material.color.setHex(resKind === 'bad' && t < flashUntil ? 0xff8a9a : resKind === 'ok' && t < flashUntil ? 0x9fffd0 : 0x7fe3ff);
      ball.rotation.z = Math.sin(t * 1.5) * 0.25; ball.position.x = -0.09 + Math.sin(t * 1.5) * 0.008;
      lamps.forEach((l, k) => { const lit = carts.find((c) => c.k === k && t - c.fly > 1.0); l.l.material.color.setHex(lit ? lit.it.c : 0x3a4468); l.lg.material.opacity = lit ? 0.7 + 0.2 * Math.sin(t * 5 + k) : 0; });
      carts.forEach((c, i) => {
        const k = stag(t, 0.5 + i * 0.2, 0.8, easeBack) * e;
        c.holder.visible = k > 0.01 && !(c.docked && t - c.fly > 1.0);
        if (!c.docked) {
          c.holder.scale.setScalar(Math.max(k, 0.001));
          c.holder.position.set(c.home.x, c.home.y + 0.012 * Math.sin(t * 1.6 + i) + (1 - k) * 0.3, c.home.z);
          c.cart.rotation.y = Math.sin(t * 0.9 + i) * 0.16;
          pulseHint(c.hint, t, i * 1.1, 0.9 * k, 0.34);
          c.cart.position.x = t - c.shake < 0.5 ? Math.sin((t - c.shake) * 50) * 0.007 * (1 - (t - c.shake) / 0.5) : 0;
          c.sh.scale.setScalar(1 + 0.1 * Math.sin(t * 1.6 + i));
        } else {
          c.hint.material.opacity = 0; c.sh.visible = false;
          const p = clamp01((t - c.fly) / 0.7), ep = ease(p), q = clamp01((t - c.fly - 0.7) / 0.3);
          v.copy(SL).lerp(c.home, 0); const sx = THREE.MathUtils.lerp(c.home.x, SL.x, ep), sy = THREE.MathUtils.lerp(c.home.y, SL.y, ep) + Math.sin(p * Math.PI) * 0.1, sz = THREE.MathUtils.lerp(c.home.z, SL.z + 0.06, ep) - q * 0.09;
          c.holder.position.set(sx, sy, sz); c.holder.rotation.y = THREE.MathUtils.lerp(c.holder.rotation.y, 0, 0.2);
          c.cart.rotation.y *= 0.8; c.holder.scale.setScalar(1 - 0.15 * ep);
          slotGlow.material.opacity = Math.max(slotGlow.material.opacity, 0.6 * Math.sin(clamp01(t - c.fly) * Math.PI));
        }
      });
      slotGlow.material.opacity *= 0.94;
    },
  };
}
