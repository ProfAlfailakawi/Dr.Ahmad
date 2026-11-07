// p237 (round 2): a big glossy laptop opens, books drop in, three decision orbs; each choice grows a plant out of the books and lights the student on screen.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { P, ease, easeBack, clamp01, stag, mat, glossy, goldMat, shadowed, glow } from '../../kit.js?v=16';
import { halos, liveTag, motes, canvasTex, blob, TAU, css, arcPoint } from '../lib/a4-kit.js?v=16';

export const meta = { free: true, center: [0.5, 0.7], typeLabel: 'قرار المعلّم', title: 'معلّم أمام طالب متعثّر' };

const STEPS = [
  { hud: 'كيف تعالج ضعفه؟', opts: [
    { t: 'برنامج يستهدف ضعفه', s: 2, fb: 'صحيح: يتيح الحاسوب للطالب الضعيف استعمال البرنامج مرات عدة دون حرج أو خوف من المعلم أو خجل من زملائه.' },
    { t: 'عرض واحد للجميع', s: 1, fb: 'العرض الجماعي مفيد، لكنه لا يراعي مستواه فيبقى الحرج والتعثّر.' },
    { t: 'تصفّح بلا هدف', s: 0, fb: 'الحرية مطلوبة، لكن دون برنامج يستهدف نقاط الضعف لا يُعالج التعثّر.' }] },
  { hud: 'كيف تُثري البرمجية؟', opts: [
    { t: 'تجربة ميدانية وملاحظات', s: 2, fb: 'صحيح: إثراء المادة يتطلب تطبيقاً ميدانياً وتغذية راجعة ومراقبة وتقييماً من لجان مختصة.' },
    { t: 'اعتماد فوري', s: 1, fb: 'تحسّن حالة واحدة لا يكفي دليلاً على جودة البرمجية للفئات المستهدفة.' },
    { t: 'بلا تغذية راجعة', s: 0, fb: 'بدون تغذية راجعة لا تُحسَّن المادة ولا يُعرف أثرها.' }] },
  { hud: 'كيف تُبقيه منهمكاً؟', opts: [
    { t: 'تفاعل وتدريب متنوع', s: 2, fb: 'صحيح: الانهماك يتعمّق بالتفاعل والتدريبات المتنوعة مع التغذية الراجعة المستمرة.' },
    { t: 'أنشطة بلا متابعة', s: 1, fb: 'الجاذبية تثير الانتباه، لكن غياب التغذية الراجعة لا يعمّق التعلم.' },
    { t: 'جهاز دون متابعة', s: 0, fb: 'الجاذبية وحدها لا تكفي؛ فالعمل بالحاسوب يحتاج إلى خبرة وكفايات لدى المعلم والمتعلم.' }] },
];
const ORB_COL = [0x2fb5a8, 0xf0902a, 0x3a86d6], ORB_INK = ['#0d6a60', '#a8530a', '#1c5497'];
const LEAF = [0xc2a878, 0xb5c44a, 0x5fb54a];

function drawScreen(g, w, h, score, t = 0) {
  const k = score / 6;
  const grd = g.createLinearGradient(0, 0, 0, h);
  grd.addColorStop(0, k < 0.4 ? '#7f94ad' : '#aee3f4'); grd.addColorStop(1, k < 0.4 ? '#c3ccd6' : '#fff1cf');
  g.fillStyle = grd; g.fillRect(0, 0, w, h);
  const sun = g.createRadialGradient(w * 0.8, h * 0.2, 6, w * 0.8, h * 0.2, 150);
  sun.addColorStop(0, `rgba(255,226,140,${0.1 + k * 0.85})`); sun.addColorStop(1, 'rgba(255,226,140,0)');
  g.fillStyle = sun; g.fillRect(0, 0, w, h);
  // shelf of books behind
  ['#d8372f', '#f2c23a', '#2f6fb8', '#ef8a2a', '#5fae3a'].forEach((c, i) => { g.fillStyle = c; g.fillRect(24 + i * 26, h - 44 - (i % 3) * 8, 20, 44 + (i % 3) * 8); });
  const cx = w * 0.46, cy = h * 0.5;
  g.fillStyle = '#2f3440'; g.beginPath(); g.ellipse(cx, cy - 10, 62, 72, 0, Math.PI, TAU); g.fill();
  g.fillStyle = '#f2c9a6'; g.beginPath(); g.arc(cx, cy, 56, 0, TAU); g.fill();
  g.fillStyle = '#2f3440'; g.beginPath(); g.arc(cx, cy - 18, 58, Math.PI * 1.02, Math.PI * 1.98); g.fill();
  g.fillStyle = '#d8453c'; g.beginPath(); g.moveTo(cx - 120, h); g.quadraticCurveTo(cx, cy + 66, cx + 120, h); g.fill();
  g.strokeStyle = '#2f3440'; g.lineWidth = 7; g.lineCap = 'round';
  g.beginPath(); g.moveTo(cx - 20, cy + 26 + (1 - k) * 8); g.quadraticCurveTo(cx, cy + 26 + (k * 2 - 1) * 15, cx + 20, cy + 26 + (1 - k) * 8); g.stroke();
  g.fillStyle = '#2f3440'; g.beginPath(); g.arc(cx - 20, cy + 2, 5.5, 0, TAU); g.arc(cx + 20, cy + 2, 5.5, 0, TAU); g.fill();
  g.fillStyle = 'rgba(255,255,255,.96)'; g.beginPath(); g.roundRect(w * 0.62, h * 0.12, 150, 104, 30); g.fill();
  if (k < 0.7) { g.fillStyle = '#6b7a8a'; g.font = '800 78px Tajawal, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('؟', w * 0.62 + 75, h * 0.12 + 56); }
  else { g.fillStyle = '#5fb54a'; g.beginPath(); g.ellipse(w * 0.62 + 75, h * 0.12 + 54, 40, 20, -0.6, 0, TAU); g.fill(); g.fillRect(w * 0.62 + 72, h * 0.12 + 54, 5, 30); }
}

export default function build(ctx) {
  const g = new THREE.Group(); g.position.copy(P(meta.center[0], meta.center[1])); ctx.stage.add(g);
  const hal = halos();
  const mo = motes(g, 18, { r: 0.4, h: 0.5, color: 0xfff0c0 });

  // ---- big laptop (opens in the first two seconds)
  const laptop = new THREE.Group(); laptop.position.set(-0.13, 0, -0.04); laptop.rotation.y = 0.12; g.add(laptop);
  const sh1 = blob(0.3, 0.3); sh1.scale.set(0.62, 0.62 * 0.8, 1); sh1.position.set(-0.13, 0.0015, -0.02); g.add(sh1);
  const BODY = 0xe9ecf1, ACC = 0xf0702a;
  const deck = new THREE.Mesh(new RoundedBoxGeometry(0.42, 0.024, 0.29, 4, 0.008), mat(BODY, { roughness: 0.3, metalness: 0.35 })); deck.position.y = 0.012; laptop.add(deck);
  const keyArea = new THREE.Mesh(new THREE.PlaneGeometry(0.36, 0.14), mat(0x2c313b, { roughness: 0.6 })); keyArea.rotation.x = -Math.PI / 2; keyArea.position.set(0, 0.0246, -0.045); laptop.add(keyArea);
  const keys = new THREE.InstancedMesh(new RoundedBoxGeometry(0.0235, 0.005, 0.0235, 2, 0.002), mat(0x4a505c, { roughness: 0.5 }), 14 * 5);
  const mtx = new THREE.Matrix4(); let ki = 0; for (let r = 0; r < 5; r++) for (let c = 0; c < 14; c++) { mtx.setPosition(-0.165 + c * 0.0254, 0.0275, -0.095 + r * 0.0265); keys.setMatrixAt(ki++, mtx); }
  laptop.add(keys);
  const pad = new THREE.Mesh(new RoundedBoxGeometry(0.1, 0.002, 0.05, 2, 0.001), mat(0xc4c9d1)); pad.position.set(0, 0.025, 0.088); laptop.add(pad);
  const hinge = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.3, 14), goldMat()); hinge.rotation.z = Math.PI / 2; hinge.position.set(0, 0.026, -0.14); laptop.add(hinge);
  const lid = new THREE.Group(); lid.position.set(0, 0.03, -0.14); laptop.add(lid);
  const lidB = new THREE.Mesh(new RoundedBoxGeometry(0.42, 0.29, 0.012, 4, 0.008), mat(BODY, { roughness: 0.3, metalness: 0.35 })); lidB.position.y = 0.145; lid.add(lidB);
  const bezel = new THREE.Mesh(new RoundedBoxGeometry(0.4, 0.27, 0.004, 3, 0.004), mat(0x1b1f27)); bezel.position.set(0, 0.145, 0.0075); lid.add(bezel);
  const stex = canvasTex(512, 340, (c, w, h) => drawScreen(c, w, h, 0));
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.375, 0.245), new THREE.MeshBasicMaterial({ map: stex, toneMapped: false })); screen.position.set(0, 0.145, 0.0105); lid.add(screen);
  const sglow = glow(0xbfe8ff, 0.7, 0); sglow.position.set(0, 0.15, 0.05); lid.add(sglow);
  const logo = new THREE.Mesh(new THREE.CircleGeometry(0.014, 24), new THREE.MeshBasicMaterial({ color: ACC, toneMapped: false })); logo.position.set(0, 0.145, -0.0075); logo.rotation.y = Math.PI; lid.add(logo);
  shadowed(laptop);
  hal.add(laptop, 0xbfe8ff, 0.5, [0, 0.16, 0.12], 2.6);

  // ---- books and plant (drop in one by one)
  const books = new THREE.Group(); books.position.set(0.3, 0, -0.02); g.add(books);
  const sh2 = blob(0.14, 0.32); sh2.position.set(0.3, 0.0015, -0.01); g.add(sh2);
  const BK = [[0x2f6fb8, 0.0, 0.2], [0xf2c23a, 0.25, 0.185], [0xef8a2a, -0.2, 0.17], [0xd8372f, 0.3, 0.155]];
  const bookMeshes = BK.map(([c, r, w], i) => {
    const b = new THREE.Mesh(new RoundedBoxGeometry(w, 0.04, 0.135, 3, 0.01), glossy(c, { clearcoat: 0.7 })); b.rotation.y = r; b.position.y = 0.02 + i * 0.041; b.userData.y = b.position.y;
    const pg = new THREE.Mesh(new THREE.BoxGeometry(w - 0.012, 0.028, 0.002), mat(0xf8f1e0)); pg.position.set(0, 0, 0.0685); b.add(pg);
    books.add(b); return b;
  });
  shadowed(books);
  const potY = 0.16 + 0.03;
  const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.04, 0.075, 30), glossy(0xc8693c, { clearcoat: 0.3 })); pot.position.set(0.3, potY + 0.0375, -0.02); shadowed(pot); g.add(pot);
  const rim2 = new THREE.Mesh(new THREE.TorusGeometry(0.055, 0.007, 8, 30), goldMat()); rim2.rotation.x = Math.PI / 2; rim2.position.y = 0.0375; pot.add(rim2);
  const soil = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.006, 20), mat(0x4a3322)); soil.position.y = 0.036; pot.add(soil);
  const plant = new THREE.Group(); plant.position.set(0.3, potY + 0.078, -0.02); g.add(plant);
  const STEM = 0.34;
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.0055, 0.008, STEM, 10), mat(0x58a03c)); stem.geometry.translate(0, STEM / 2, 0); stem.scale.y = 0.001; plant.add(stem);
  const leafGeo = new THREE.SphereGeometry(1, 16, 10); leafGeo.scale(0.075, 0.009, 0.034); leafGeo.translate(0.075, 0, 0);
  const leaves = [];
  for (let st = 0; st < 3; st++) for (let side = 0; side < 2; side++) {
    const m = new THREE.Mesh(leafGeo, mat(0x5fb54a, { roughness: 0.45 })); const a = side ? Math.PI : 0;
    m.position.y = 0.07 + st * 0.095 + side * 0.03; m.rotation.set(0, a + st * 0.7, side ? 0.35 : 0.5); m.scale.setScalar(0.0001); m.castShadow = true; plant.add(m); leaves.push({ m, st, to: 0, k: 0 });
  }
  const flower = new THREE.Group(); flower.position.y = STEM + 0.005; flower.scale.setScalar(0.0001); plant.add(flower);
  for (let i = 0; i < 9; i++) { const pt = new THREE.Mesh(new THREE.SphereGeometry(0.02, 12, 8), mat(0xf4c24a, { emissive: 0xd89a20, emissiveIntensity: 0.4 })); pt.scale.set(1.7, 0.4, 0.9); const a = (i / 9) * TAU; pt.position.set(Math.cos(a) * 0.03, 0, Math.sin(a) * 0.03); pt.rotation.y = -a; flower.add(pt); }
  flower.add(new THREE.Mesh(new THREE.SphereGeometry(0.018, 14, 10), mat(0xe9852a)));
  const bud = glow(0xffe08a, 0.2, 0); bud.position.y = STEM; plant.add(bud);

  // ---- mortarboard and glasses from the print
  const cap = new THREE.Group(); cap.position.set(-0.4, 0.014, 0.12); cap.rotation.y = 0.5; g.add(cap);
  cap.add(Object.assign(new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.048, 0.03, 26), glossy(0x26303c)), {}));
  const brim = new THREE.Mesh(new RoundedBoxGeometry(0.13, 0.008, 0.13, 2, 0.002), glossy(0x26303c)); brim.position.y = 0.022; cap.add(brim);
  const tassel = new THREE.Mesh(new THREE.CylinderGeometry(0.002, 0.002, 0.07, 6), goldMat()); tassel.position.set(0.058, 0.0, 0.058); cap.add(tassel);
  shadowed(cap);

  // ---- three option orbs (big)
  const slots = [-0.27, 0, 0.27].map((x, i) => {
    const grp = new THREE.Group(); grp.position.set(x, 0.12, 0.26); g.add(grp);
    const orb = new THREE.Mesh(new THREE.SphereGeometry(0.056, 32, 22), glossy(ORB_COL[i], { emissive: ORB_COL[i], emissiveIntensity: 0.25, clearcoat: 1, transparent: true, opacity: 0.55, depthWrite: false })); orb.renderOrder = 5; grp.add(orb);
    const core = glow(ORB_COL[i], 0.12, 0.95); core.renderOrder = 6; grp.add(core); const core2 = glow(0xffffff, 0.05, 1); core2.renderOrder = 7; grp.add(core2);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.076, 0.0025, 8, 48), goldMat()); ring.rotation.x = Math.PI / 2.4; grp.add(ring);
    const ring2 = new THREE.Mesh(new THREE.TorusGeometry(0.076, 0.0018, 8, 48), goldMat()); ring2.rotation.x = Math.PI / 2.4; ring2.rotation.y = 1.1; grp.add(ring2);
    const hl = hal.add(grp, ORB_COL[i], 0.3, [0, 0, 0], 9999);
    const slot = { grp, orb, ring, hl, home: new THREE.Vector3(x, 0.12, 0.26), tag: liveTag(0.25, ORB_COL[i], { size: 58, style: 'halo', ink: ORB_INK[i] }), opt: null, state: 'off', k: 0, fly: 0, from: new THREE.Vector3(), i };
    slot.tag.set('برنامج'); g.add(slot.tag.sp); slot.tag.sp.position.set(x, 0.3, 0.27); slot.tag.apply(0);
    ctx.tap(grp, () => choose(slot)); grp.visible = false; return slot;
  });

  let trail = 0, now = 0, phase = 'build', stepI = 0, total = 0, tPhase = 0, chosen = null, finished = false, lidK = 0;
  const tmp = new THREE.Vector3(), tip = new THREE.Vector3();
  const plantTop = () => tip.set(0.3, potY + 0.1 + stepI * 0.1, -0.02);
  function startStep(i) {
    stepI = i; chosen = null; phase = 'choose'; tPhase = now; ctx.ui.hideCard(); ctx.ui.hud(STEPS[i].hud);
    const order = [0, 1, 2].sort(() => Math.random() - 0.5);
    slots.forEach((s, k) => { s.opt = STEPS[i].opts[order[k]]; s.tag.set(s.opt.t, ORB_COL[k]); s.state = 'idle'; s.grp.visible = true; s.k = 0; s.grp.position.copy(s.home); });
  }
  function choose(s) { if (phase !== 'choose' || s.state !== 'idle') return; phase = 'react'; tPhase = now; chosen = s; s.state = 'fly'; s.fly = 0; s.from.copy(s.grp.position); slots.forEach((o) => { if (o !== s) o.state = 'fade'; }); ctx.sfx.pop?.(); }
  function arrive(s) {
    const sc = s.opt.s; total += sc;
    leaves.filter((l) => l.st === stepI).forEach((l) => { l.to = sc === 2 ? 1 : sc === 1 ? 0.65 : 0.4; l.m.material.color.setHex(LEAF[sc]); });
    ctx.fx.burst(g.position.clone().add(plantTop()), [0xd8a050, 0xc9d24a, 0x6bd24a][sc], 18 + sc * 8, 0.3, 0.04); sc === 2 ? ctx.sfx.good?.() : ctx.sfx.click?.();
    drawScreen(stex.userData.canvas.getContext('2d'), 512, 340, total); stex.needsUpdate = true;
    ctx.ui.card({ tag: `قرارك ${['الأول', 'الثاني', 'الثالث'][stepI]}`, title: s.opt.t, body: s.opt.fb, color: [0xc2a878, 0xe0a030, 0x4fa03a][sc] });
  }
  function end() {
    finished = true; phase = 'done'; slots.forEach((s) => { s.state = 'gone'; }); ctx.ui.hud('الحاسوب أداة لكل طالب');
    ctx.ui.card({ tag: 'الخلاصة', title: 'أداة مناسبة لجميع الطلاب', body: 'كل طالب يتقدم في التعلم حسب مستواه، وينتقل من برنامج لآخر حسب قدراته.', color: 0x4fa03a });
    ctx.fx.burst(g.position.clone().add(new THREE.Vector3(0.3, 0.5, -0.02)), 0xffd27a, 40, 0.5, 0.05); ctx.sfx.good?.(); ctx.ui.done();
  }
  ctx.tap(laptop, () => ctx.ui.card({ tag: 'الحاسوب التعليمي', title: 'تعلّم بلا حرج', body: 'يستعمل الطالب الضعيف البرنامج مرات عدة دون حرج أو خوف من المعلم أو خجل من زملائه.', color: 0x3a86d6 }));
  ctx.tap(plant, () => { ctx.fx.burst(g.position.clone().add(plantTop()), 0x7bd05a, 14, 0.25, 0.04); ctx.ui.card({ tag: 'نموّ الطالب', title: 'أثر القرار', body: 'كلما اقترب قرارك من حاجة الطالب، كبر النبات وأشرقت الشاشة.', color: 0x4fa03a }); });
  ctx.tap(books, () => ctx.ui.card({ tag: 'المادة التعليمية', title: 'إثراء المادة', body: 'تُثرى المادة بالخبرات والمعلومات والتجارب، وبتطبيق ميداني وتغذية راجعة.', color: 0xef8a2a }));
  ctx.ui.hud('المس القرار الذي تراه أنسب');

  return {
    update(t, dt, e) {
      now = t; hal.update(t, e); mo.update(t, dt, e);
      if (phase === 'build' && t > 3.0) startStep(0);
      // laptop opens, books drop
      lidK = easeBack(clamp01((t - 0.3) / 1.5)); lid.rotation.x = THREE.MathUtils.lerp(Math.PI / 2 - 0.02, -0.26, lidK);
      laptop.scale.setScalar(Math.max(0.0001, stag(t, 0, 0.5) * e)); sh1.material.opacity = 0.3 * e;
      sglow.material.opacity = (0.08 + total / 6 * 0.55) * clamp01((lidK - 0.6) * 2.5) * e * (0.85 + 0.15 * Math.sin(t * 2));
      screen.material.opacity = 1;
      bookMeshes.forEach((b, i) => { const k = stag(t, 0.5 + i * 0.25, 0.7, easeBack) * e; b.scale.setScalar(Math.max(0.0001, k)); b.position.y = b.userData.y + (1 - stag(t, 0.5 + i * 0.25, 0.7)) * 0.3; });
      const pk = stag(t, 1.6, 0.6, easeBack) * e; pot.scale.setScalar(Math.max(0.0001, pk)); cap.scale.setScalar(Math.max(0.0001, stag(t, 1.8, 0.6, easeBack) * e));
      stem.scale.y = Math.max(0.001, THREE.MathUtils.damp(stem.scale.y, finished ? 1 : (0.2 + (stepI + (phase === 'react' && chosen && chosen.state === 'gone' ? 1 : 0)) * 0.27), 3, dt));
      leaves.forEach((l) => { l.k = THREE.MathUtils.damp(l.k, l.to, 4, dt); l.m.scale.setScalar(Math.max(0.0001, l.k * e)); l.m.rotation.z += Math.sin(t * 1.7 + l.st * 2) * 0.0009; });
      flower.scale.setScalar(Math.max(0.0001, THREE.MathUtils.damp(flower.scale.x, (finished && total >= 4 ? 1 : 0) * e, 3, dt))); flower.rotation.y += dt * 0.4;
      bud.material.opacity = (finished ? 0.7 : 0.0) * (0.7 + 0.3 * Math.sin(t * 3));
      slots.forEach((s, i) => {
        if (s.state === 'idle') { s.k = Math.min(1, s.k + dt * 2); s.grp.position.y = s.home.y + Math.sin(t * 1.8 + i * 2) * 0.01; }
        if (s.state === 'fade') s.k = Math.max(0, s.k - dt * 2.4);
        if (s.state === 'gone') s.k = Math.max(0, s.k - dt * 3);
        if (s.state === 'fly') { s.fly = Math.min(1, s.fly + dt / 0.9); trail += dt; if (trail > 0.07) { trail = 0; ctx.fx.burst(g.position.clone().add(s.grp.position), ORB_COL[s.i], 2, 0.08, 0.035); } plantTop(); arcPoint(tmp, s.from, tip, ease(s.fly), 0.16); s.grp.position.copy(tmp); s.grp.scale.setScalar(1 - 0.5 * s.fly); if (s.fly >= 1) { s.state = 'gone'; arrive(s); } }
        s.grp.visible = s.state !== 'off' && (s.state === 'fly' || s.k > 0.01);
        if (s.state !== 'fly') s.grp.scale.setScalar(Math.max(0.0001, easeBack(s.k)));
        s.hl.on = s.state === 'idle' || s.state === 'fly' ? 1 : 0; s.orb.rotation.y += dt; s.ring.rotation.z += dt * 0.8;
        s.tag.apply(s.state === 'idle' ? easeBack(s.k) * e : 0);
      });
      if (phase === 'react' && chosen && chosen.state === 'gone' && t - tPhase > 4.6) { if (stepI < 2) startStep(stepI + 1); else if (!finished) end(); }
    },
  };
}
