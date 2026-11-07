// p237 — a student's desk: three hovering choice tiles per decision fly into the monitor and answer as a stack of books (left) and a plant (right) that thrive or wilt with the quality of the decision.
import * as THREE from 'three';
import { P, ease, easeBack, clamp01, glow } from '../../kit.js?v=17';
import { rb, lathe, std, gloss, brass, add, grp, hit, Seq, Pulse, touch, desk, blob, at, shuffled, TAU } from '../lib/a2.js?v=17';
import { plate, damp } from '../lib/b3-kit.js?v=17';

export const meta = { free: true, center: [0.45, 0.7], typeLabel: 'لعبة قرار' };

const STEPS = [
  { q: 'كيف تعالج ضعفه بالحاسوب؟', o: [
    ['برنامج يعيده بقدر حاجته', 2, 'يتيح الحاسوب للطالب الضعيف استعمال البرنامج مرات عدة دون حرج أو خوف من المعلم أو خجل من زملائه.'],
    ['عرض واحد للصف كله', 1, 'العرض الجماعي مفيد، لكنه لا يراعي مستواه فيبقى الحرج والتعثّر.'],
    ['تصفح حر بلا هدف', 0, 'دون برنامج يستهدف نقاط الضعف لا يُعالج التعثّر.']] },
  { q: 'ماذا تفعل بالبرمجية بعد تحسّنه؟', o: [
    ['تجريب ميداني وتغذية راجعة', 2, 'إثراء المادة يتطلب تطبيقاً ميدانياً وتغذية راجعة ومراقبة وتقييماً من لجان مختصة.'],
    ['اعتماد نهائي فوراً', 1, 'تحسّن حالة واحدة لا يكفي دليلاً على جودة البرمجية للفئات المستهدفة.'],
    ['بلا تغذية راجعة', 0, 'بدون تغذية راجعة لا تُحسَّن المادة ولا يُعرف أثرها.']] },
  { q: 'كيف تُبقيه منهمكاً بعد الحماس؟', o: [
    ['بيئة تفاعلية وتدريبات متنوعة', 2, 'الانهماك يتعمّق بالتفاعل والتدريبات المتنوعة مع التغذية الراجعة المستمرة.'],
    ['أنشطة جماعية جذابة', 1, 'الجاذبية تثير الانتباه، لكن غياب التغذية الراجعة لا يعمّق التعلم.'],
    ['جهاز بلا متابعة', 0, 'الجاذبية وحدها لا تكفي؛ فالعمل بالحاسوب يحتاج إلى خبرة وكفايات لدى المعلم والمتعلم.']] },
];
const TITLE = ['قرار ضعيف', 'قرار ناقص', 'قرار موفّق'];
const BOOK = [0x8b6b5a, 0xe0a33a, 0x2f8f6a], LEAF = [0x8a6a3c, 0xb7c93a, 0x37b36f], CARDC = [0xb3262e, 0xe0a33a, 0x2f8f6a];
const TX = [-0.225, 0, 0.225];

function leafGeo() {
  const s = new THREE.Shape(); s.moveTo(0, 0); s.bezierCurveTo(0.018, 0.034, 0.055, 0.032, 0.085, 0); s.bezierCurveTo(0.055, -0.032, 0.018, -0.034, 0, 0);
  return new THREE.ExtrudeGeometry(s, { depth: 0.003, bevelEnabled: true, bevelSize: 0.002, bevelThickness: 0.002, bevelSegments: 1, curveSegments: 10 });
}

export default function build(ctx) {
  const g = new THREE.Group(); g.position.copy(P(meta.center[0], meta.center[1])); ctx.stage.add(g);
  const seq = new Seq(), pulse = new Pulse();
  const dk = desk(g, 0.7, 0.46, { top: 0.075, th: 0.03 }); seq.add(dk, 0.0, 0.9, { rise: 0.05 });
  const TOP = 0.075;

  // monitor
  const mon = grp(g, 0, TOP, -0.1); mon.scale.setScalar(0.92);
  add(mon, new THREE.CylinderGeometry(0.07, 0.08, 0.012, 32), std(0x2c3038, { roughness: 0.35, metalness: 0.4 }), 0, 0.006, 0, true);
  add(mon, new THREE.CylinderGeometry(0.014, 0.02, 0.1, 16), std(0x2c3038, { roughness: 0.35, metalness: 0.4 }), 0, 0.055, 0, true);
  const head = grp(mon, 0, 0.215, 0.0);
  add(head, rb(0.35, 0.225, 0.024, 0.014, 3), gloss(0x20242c, { roughness: 0.25 }), 0, 0, 0, true);
  add(head, rb(0.358, 0.233, 0.006, 0.014, 2), brass(), 0, 0, -0.011);
  const sc = document.createElement('canvas'); sc.width = 512; sc.height = 320; const sg = sc.getContext('2d');
  const stex = new THREE.CanvasTexture(sc); stex.colorSpace = THREE.SRGBColorSpace;
  const scores = [];
  const drawScreen = () => {
    const gr = sg.createLinearGradient(0, 0, 512, 320); gr.addColorStop(0, '#0f4452'); gr.addColorStop(1, '#176a68'); sg.fillStyle = gr; sg.fillRect(0, 0, 512, 320);
    sg.strokeStyle = '#bff3dd'; sg.fillStyle = '#bff3dd'; sg.lineWidth = 9; sg.lineCap = 'round';
    sg.beginPath(); sg.moveTo(256, 230); sg.bezierCurveTo(250, 170, 270, 130, 256, 80); sg.stroke();
    [[256, 150, -1], [262, 110, 1]].forEach(([x, y, d]) => { sg.beginPath(); sg.moveTo(x, y); sg.bezierCurveTo(x + d * 40, y - 40, x + d * 80, y - 20, x + d * 90, y + 6); sg.bezierCurveTo(x + d * 50, y + 14, x + d * 20, y + 8, x, y); sg.fill(); });
    for (let i = 0; i < 3; i++) { sg.beginPath(); sg.arc(190 + i * 66, 278, 20, 0, TAU); if (scores[i] === undefined) { sg.lineWidth = 5; sg.strokeStyle = 'rgba(255,255,255,.35)'; sg.stroke(); } else { sg.fillStyle = '#' + CARDC[scores[i]].toString(16).padStart(6, '0'); sg.fill(); } }
    stex.needsUpdate = true;
  };
  drawScreen();
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.32, 0.2), new THREE.MeshBasicMaterial({ map: stex, toneMapped: false })); screen.position.z = 0.0125; head.add(screen);
  const sGlow = glow(0x7fe3ff, 0.5, 0.2); sGlow.position.z = 0.06; head.add(sGlow);
  seq.add(mon, 0.4, 0.9, { rise: 0.08 });

  // books stack (left)
  const books = grp(g, -0.245, TOP, -0.06);
  const bookObjs = [0, 1, 2].map((i) => {
    const b = grp(books, Math.sin(i * 2.1) * 0.012, 0.016 + i * 0.034, 0); b.rotation.y = (i - 1) * 0.18;
    return { b, mat: gloss(0x8b6b5a) };
  });
  bookObjs.forEach((o) => { add(o.b, rb(0.16, 0.03, 0.115, 0.007, 2), o.mat, 0, 0, 0, true); add(o.b, rb(0.152, 0.022, 0.118, 0.004, 2), std(0xf6efdf), 0.004, 0, 0.0); add(o.b, rb(0.006, 0.032, 0.117, 0.002, 1), brass(), -0.08, 0, 0); o.b.scale.setScalar(1e-4); o.b.visible = false; });
  const bookBase = add(books, rb(0.16, 0.03, 0.115, 0.007, 2), gloss(0xcfb88a), 0, -0.002, 0, true);
  books.scale.setScalar(1.1); seq.add(books, 0.7, 0.8, { rise: 0.05 });

  // plant (right)
  const plant = grp(g, 0.25, TOP, -0.06);
  add(plant, lathe([[0, 0], [0.04, 0], [0.058, 0.07], [0.064, 0.075], [0.056, 0.078], [0.05, 0.07], [0, 0.066]], 32), std(0xc8693a, { roughness: 0.6 }), 0, 0, 0, true);
  add(plant, new THREE.CircleGeometry(0.052, 24), std(0x4a3426, { roughness: 0.9 }), 0, 0.068, 0).rotation.x = -Math.PI / 2;
  const stem = grp(plant, 0, 0.07, 0);
  const stemMesh = add(stem, new THREE.CylinderGeometry(0.005, 0.009, 0.3, 10), std(0x3a8a4a, { roughness: 0.5 }), 0, 0.15, 0, true);
  stem.scale.y = 0.3;
  const LG = leafGeo(); const leaves = [];
  for (let j = 0; j < 6; j++) {
    const step = Math.floor(j / 2), lm = new THREE.MeshStandardMaterial({ color: 0x37b36f, roughness: 0.45, side: THREE.DoubleSide });
    const pv = grp(plant, 0, 0.07 + 0.05 + j * 0.037, 0); pv.rotation.y = j * 2.4;
    const lf = new THREE.Mesh(LG, lm); lf.castShadow = true; pv.add(lf); lf.rotation.z = 0.5;
    pv.scale.setScalar(1e-4); pv.visible = false; leaves.push({ pv, lf, lm, step, k: 0, on: false, tilt: 0.5 });
  }
  const bulb = grp(plant, 0, 0.07 + 0.33, 0);
  const bulbMat = new THREE.MeshPhysicalMaterial({ color: 0xfff1b8, emissive: 0xffc94a, emissiveIntensity: 0.0, roughness: 0.1, transparent: true, opacity: 0.9 });
  add(bulb, new THREE.SphereGeometry(0.03, 20, 14), bulbMat, 0, 0, 0);
  add(bulb, new THREE.CylinderGeometry(0.015, 0.015, 0.014, 14), brass(), 0, -0.032, 0);
  const bGlow = glow(0xffd27a, 0.3, 0); bulb.add(bGlow); bulb.scale.setScalar(1e-4); bulb.visible = false;
  plant.scale.setScalar(1.55); seq.add(plant, 1.0, 0.9, { rise: 0.05 });

  // choice tiles (three, reused)
  const tiles = TX.map((x, i) => {
    const t = grp(g, x, 0.21, 0.17);
    add(t, rb(0.21, 0.11, 0.016, 0.014, 3), gloss(0xfff8ea, { roughness: 0.3 }), 0, 0, 0, true);
    add(t, rb(0.222, 0.118, 0.008, 0.014, 2), brass(), 0, 0, 0);
    const a = plate('', 0.192, 0.09, { fg: '#2b2620', lines: 2 }); a.position.z = 0.0115; t.add(a);
    const b = plate('', 0.192, 0.09, { fg: '#2b2620', lines: 2 }); b.position.z = -0.0115; b.rotation.y = Math.PI; t.add(b);
    const halo = glow(0xffd27a, 0.3, 0); halo.position.z = -0.02; t.add(halo);
    hit(t, 0.1, 0, 0, 0);
    t.scale.setScalar(1e-4); t.visible = false;
    return { t, a, b, halo, opt: null, show: 0, state: 'hid', fk: 0, base: new THREE.Vector3(x, 0.21, 0.17) };
  });

  let step = -1, phase = 'wait', pt = 0, total = 0, chosen = null, shakeT = [-1, -1, -1];
  const setStep = () => {
    const S = STEPS[step], ord = shuffled([0, 1, 2], 11 + step * 5);
    tiles.forEach((tl, i) => { const o = S.o[ord[i]]; tl.opt = o; tl.a.userData.draw(o[0]); tl.b.userData.draw(o[0]); tl.state = 'in'; tl.show = 0; tl.t.visible = true; tl.t.position.copy(tl.base); tl.t.rotation.set(0, 0, 0); });
    ctx.ui.hud(S.q); phase = 'choose';
  };
  const addResult = (sc) => {
    scores.push(sc); drawScreen();
    const si = scores.length - 1; bookObjs[si].mat.color.setHex(BOOK[sc]); bookObjs[si].b.visible = true; bookObjs[si].grow = 0.001;
    leaves.filter((l) => l.step === si).forEach((l) => { l.on = true; l.lm.color.setHex(LEAF[sc]); l.tilt = sc === 0 ? -0.55 : sc === 1 ? 0.25 : 0.65; l.pv.visible = true; });
  };
  tiles.forEach((tl, i) => touch(ctx, tl.t, () => {
    if (phase !== 'choose' || tl.state !== 'in') return;
    chosen = tl; phase = 'fly'; pt = 0; const sc = tl.opt[1]; total += sc; tl.state = 'fly'; tl.from = tl.t.position.clone();
    tiles.forEach((o) => { if (o !== tl) o.state = 'out'; });
    ctx.sfx[sc ? 'good' : 'bad']?.();
    addResult(sc);
    ctx.ui.card({ tag: 'أثر قرارك', title: TITLE[sc], body: tl.opt[2], color: CARDC[sc] });
  }, 0xffd27a));

  return {
    update(t, dt, e) {
      seq.update(t, e); pulse.update(t, e);
      sGlow.material.opacity = (0.16 + 0.06 * Math.sin(t * 2)) * e;
      stem.scale.y = damp(stem.scale.y, 0.3 + 0.35 * scores.length, 2.5, dt);
      stem.rotation.z = Math.sin(t * 1.1) * 0.025; plant.rotation.z = 0;
      bookObjs.forEach((o) => { if (o.grow !== undefined) { o.grow = Math.min(1, o.grow + dt * 2); o.b.scale.setScalar(Math.max(easeBack(o.grow), 1e-4)); } });
      leaves.forEach((l, j) => { if (l.on) { l.k = Math.min(1, l.k + dt * 1.6 * (j % 2 ? 0.8 : 1)); l.pv.scale.setScalar(Math.max(easeBack(l.k), 1e-4)); l.lf.rotation.z = damp(l.lf.rotation.z, l.tilt + Math.sin(t * 1.3 + j) * 0.05, 4, dt); } });
      if (phase === 'end') { bulb.visible = true; bulb.scale.setScalar(Math.max(easeBack(clamp01((t - bulbT) / 0.8)), 1e-4)); bulbMat.emissiveIntensity = (0.2 + total / 6 * 1.0) * (0.8 + 0.2 * Math.sin(t * 3)); bGlow.material.opacity = (0.15 + total / 6 * 0.6) * e; }
      if (phase === 'wait' && t > 3.4) { step = 0; setStep(); }
      tiles.forEach((tl, i) => {
        if (tl.state === 'in') { tl.show = Math.min(1, tl.show + dt * 2.2); tl.t.scale.setScalar(Math.max(easeBack(tl.show) * e, 1e-4)); tl.t.position.y = tl.base.y + Math.sin(t * 1.8 + i * 1.7) * 0.01; tl.t.rotation.y = Math.sin(t * 0.8 + i) * 0.12; tl.halo.material.opacity = (0.35 + 0.2 * Math.sin(t * 3 + i)) * tl.show * e; }
        else if (tl.state === 'out') { tl.show = Math.max(0, tl.show - dt * 3); tl.t.scale.setScalar(Math.max(tl.show * e, 1e-4)); tl.halo.material.opacity = 0; if (tl.show <= 0) { tl.state = 'hid'; tl.t.visible = false; } }
        else if (tl.state === 'fly') {
          pt += dt / 3; const k = clamp01(pt / 0.28), kk = ease(k);
          tl.t.position.set(tl.from.x * (1 - kk), tl.from.y + (0.23 - tl.from.y) * kk + Math.sin(k * Math.PI) * 0.05, tl.from.z + (-0.06 - tl.from.z) * kk);
          tl.t.scale.setScalar(Math.max((1 - 0.85 * kk) * e, 1e-4)); tl.t.rotation.y += dt * 6; tl.halo.material.opacity = 0.5 * (1 - kk);
          if (k >= 1) { tl.state = 'hid'; tl.t.visible = false; ctx.fx.burst(at(ctx, head, 0.0).clone().add(new THREE.Vector3(0, 0, 0.06)), CARDC[tl.opt[1]], 16, 0.32, 0.03); phase = 'pause'; pt = 0; }
        }
      });
      if (phase === 'pause') {
        pt += dt;
        if (pt > 2.8) {
          ctx.ui.hideCard();
          if (step >= 2) { phase = 'end'; bulbT = t; ctx.ui.hud('قيمته في طريقة توظيفه'); ctx.ui.done(); } else { step++; setStep(); }
        }
      }
    },
  };
}
let bulbT = 0;
