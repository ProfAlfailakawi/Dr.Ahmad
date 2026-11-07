import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { P, ease, easeBack, clamp01, stag, mat, glossy, goldMat, shadowed, glow, sprite } from '../../kit.js?v=15';
import { inked } from '../../pencil.js?v=15';
import { TAU, revealer, bumper, canvasTex, faceMat, fillText, hintGlow, pulseHint, setSpr, retext, burstAt } from '../lib/a6-kit.js?v=15';

export const meta = { free: true, center: [0.5, 0.5], typeLabel: 'لعبة تصميم' };

const SLOTS = [
  { k: 'show', c: 0x2a8fd0, o: [
    { t: 'لوح عادي فقط', ok: false, fb: 'هكذا تُهدر خصائصها كلها؛ فهي مجهزة للاتصال بالحاسب وأجهزة العرض.' },
    { t: 'ربط بالحاسب والعرض', ok: true, fb: 'صحيح: بالتوصيل تتحول السبورة في ثوانٍ إلى شاشة كمبيوتر عملاقة.' },
    { t: 'شرائح مطبوعة فقط', ok: false, fb: 'لا يضيف ذلك تفاعلاً؛ العرض الساكن لا يختلف عن الوسائل التقليدية.' }] },
  { k: 'save', c: 0xf2b630, o: [
    { t: 'محو بعد كل حصة', ok: false, fb: 'يضيع بذلك الناتج التعليمي الذي كان يمكن حفظه ومراجعته.' },
    { t: 'تدوين يدوي فقط', ok: false, fb: 'ممكن لكنه يهمل قدرة السبورة على الحفظ والنقل المباشر.' },
    { t: 'حفظ العمل ونقله', ok: true, fb: 'صحيح: تحفظ السبورة ما يكتب عليها وتنقله إلى حاسبات الطلبة إن أرادوا.' }] },
  { k: 'join', c: 0xe0603f, o: [
    { t: 'مساهمات الطلبة تُعرض', ok: true, fb: 'صحيح: يمكن لأي طالب أن يبعث بملاحظاته ومساهماته لتعرض على السبورة.' },
    { t: 'تحكم المعلمة وحدها', ok: false, fb: 'يبقي الطلبة متلقين، ويخالف شرط المشاركة.' },
    { t: 'ترك الطلبة بلا توجيه', ok: false, fb: 'المشاركة تحتاج إلى توجيه نحو الهدف؛ فالتقنية وسيلة لا بديل عن التخطيط.' }] },
  { k: 'rich', c: 0x4aa84f, o: [
    { t: 'مؤثرات بلا هدف', ok: false, fb: 'الإثراء مطلوب لخدمة الهدف، وليس للزينة في ذاتها.' },
    { t: 'برامج أوفيس والإنترنت', ok: true, fb: 'صحيح: تتيح السبورة معظم برامج أوفيس والإبحار في الإنترنت بحرية.' },
    { t: 'نسخ صفحات الكتاب', ok: false, fb: 'نقل المحتوى دون إثراء لا يستثمر إمكانات السبورة.' }] },
];
const SLOT_NAMES = ['التوصيل والعرض', 'حفظ العمل', 'مشاركة الطلبة', 'إثراء المحتوى'];
const hx = (c) => '#' + c.toString(16).padStart(6, '0');
const TX = [-0.2, 0, 0.2];

export default function build(ctx) {
  const g = new THREE.Group(); g.position.copy(P(meta.center[0], meta.center[1])); g.scale.setScalar(1.1); ctx.stage.add(g);
  const R = revealer(), B = bumper();

  // a cut-away classroom: floor and two walls (no plinth)
  const floor = inked(new RoundedBoxGeometry(0.8, 0.036, 0.6, 3, 0.014), { color: 0xc47a5a }); floor.position.set(0, 0.018, 0); g.add(floor); R.add(floor, 0.1, 1);
  const rug = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.004, 40), glossy(0x3fb0c8)); rug.scale.set(1.5, 1, 0.8); rug.position.set(0, 0.038, 0.12); g.add(rug);
  const wall = inked(new RoundedBoxGeometry(0.8, 0.36, 0.022, 3, 0.008), { color: 0xa9ddb8 }); wall.position.set(0, 0.21, -0.289); g.add(wall); R.add(wall, 0.4, 1.2);
  const wallL = inked(new RoundedBoxGeometry(0.022, 0.36, 0.6, 3, 0.008), { color: 0x8fcba3 }); wallL.position.set(-0.389, 0.21, 0); g.add(wallL); R.add(wallL, 0.6, 1.2);
  const under = { scale: { setScalar() {} } }; const gold = under;
  // whiteboard with projector
  const wb = new THREE.Group(); wb.position.set(-0.06, 0.22, -0.265); g.add(wb);
  const wbFrame = inked(new RoundedBoxGeometry(0.3, 0.2, 0.016, 3, 0.006), { color: 0x3a3f47 }); wb.add(wbFrame); R.add(wbFrame, 0.9, 1);
  const boardCv = document.createElement('canvas'); boardCv.width = 512; boardCv.height = 320; const bg2 = boardCv.getContext('2d');
  const boardTex = new THREE.CanvasTexture(boardCv); boardTex.colorSpace = THREE.SRGBColorSpace; boardTex.anisotropy = 4;
  function drawBoard(full) {
    bg2.fillStyle = '#f4faf8'; bg2.fillRect(0, 0, 512, 320);
    fillText(bg2, full ? '٢ + ٣ = ٥' : '٢ + ٣ =', 256, 62, 70, '#6b7480');
    for (let i = 0; i < (full ? 5 : 5); i++) { bg2.fillStyle = '#e0463a'; bg2.beginPath(); bg2.arc(100 + i * 78, 170, 24, 0, TAU); bg2.fill(); bg2.fillStyle = '#4aa84f'; bg2.fillRect(100 + i * 78 - 3, 138, 6, 12); }
    if (full) { bg2.strokeStyle = '#ffd27a'; bg2.lineWidth = 8; bg2.strokeRect(10, 10, 492, 300); fillText(bg2, '✓', 256, 262, 70, '#4aa84f'); }
    boardTex.needsUpdate = true;
  }
  drawBoard(false);
  const wbScreen = new THREE.Mesh(new THREE.PlaneGeometry(0.27, 0.168), faceMat(boardTex, { transparent: true, opacity: 0 })); wbScreen.position.z = 0.0085; wb.add(wbScreen);
  const proj = new THREE.Group(); proj.position.set(-0.06, 0.375, -0.2); g.add(proj);
  const arm = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.06, 0.008), mat(0x3a3f47)); arm.position.set(0, 0.03, -0.04); proj.add(arm);
  const pbody = inked(new RoundedBoxGeometry(0.1, 0.035, 0.07, 3, 0.01), { color: 0xf1ecdf }); proj.add(pbody); R.add(pbody, 1.1, 0.9);
  const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.013, 0.013, 0.01, 20), glossy(0x1f2a44)); lens.rotation.x = Math.PI / 2; lens.position.set(-0.02, 0, 0.038); proj.add(lens);
  const beam = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.17, 4, 1, true), new THREE.MeshBasicMaterial({ color: 0xcfeeff, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, toneMapped: false }));
  beam.rotation.set(-Math.PI / 2 - 0.3, 0, Math.PI / 4); beam.position.set(-0.02, -0.07, 0.115); proj.add(beam);

  // cabinet (memory) and globe (the web)
  const cab = new THREE.Group(); cab.position.set(0.215, 0.036, -0.2); g.add(cab);
  const cabBody = inked(new RoundedBoxGeometry(0.11, 0.14, 0.07, 3, 0.008), { color: 0xf7f2e7 }); cabBody.position.y = 0.07; cab.add(cabBody); R.add(cabBody, 1.0, 1);
  const drawers = [0xf2c230, 0xe84e8a, 0x8ac43a].map((c, i) => { const d = new THREE.Mesh(new RoundedBoxGeometry(0.098, 0.036, 0.008, 2, 0.003), glossy(c)); d.position.set(0, 0.025 + i * 0.044, 0.036); cab.add(d); return d; });
  const memLed = glow(0xffd27a, 0.08, 0); memLed.position.set(0, 0.07, 0.045); cab.add(memLed);
  const globe = new THREE.Group(); globe.position.set(-0.26, 0.036, -0.2); g.add(globe);
  const gst = inked(new THREE.CylinderGeometry(0.026, 0.032, 0.05, 20), { color: 0xf1ecdf }); gst.position.y = 0.025; globe.add(gst); R.add(gst, 1.1, 0.9);
  const gTex = canvasTex(256, 128, (c, w, h) => { c.fillStyle = '#4aa6d8'; c.fillRect(0, 0, w, h); c.fillStyle = '#6fbf5a'; [[30, 40, 40, 30], [90, 60, 36, 40], [150, 30, 50, 28], [190, 70, 36, 30], [60, 95, 40, 20], [20, 90, 20, 14]].forEach(([x, y, a, b]) => { c.beginPath(); c.ellipse(x + a / 2, y + b / 2, a / 2, b / 2, 0, 0, TAU); c.fill(); }); });
  const gsph = new THREE.Mesh(new THREE.SphereGeometry(0.048, 28, 20), new THREE.MeshStandardMaterial({ map: gTex, roughness: 0.4 })); gsph.position.y = 0.1; globe.add(gsph);
  const gring = new THREE.Mesh(new THREE.TorusGeometry(0.056, 0.0025, 6, 40), goldMat()); gring.position.y = 0.1; gring.rotation.set(Math.PI / 2 - 0.4, 0, 0.3); globe.add(gring);

  // teacher and children
  const person = (color, hair, s = 1) => {
    const f = new THREE.Group();
    const b = inked(new THREE.CapsuleGeometry(0.016 * s, 0.04 * s, 4, 14), { color }); b.position.y = 0.045 * s; f.add(b);
    const h = new THREE.Mesh(new THREE.SphereGeometry(0.0155 * s, 18, 14), mat(0xf0c8a0)); h.position.y = 0.093 * s; f.add(h);
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.0165 * s, 18, 12, 0, TAU, 0, Math.PI * 0.55), mat(hair)); cap.position.y = 0.095 * s; f.add(cap);
    f.userData = { b };
    return f;
  };
  const teacher = person(0x2f5bb0, 0x8a3a1e, 1.2); teacher.position.set(0.1, 0.036, -0.16); g.add(teacher); R.add(teacher.userData.b, 1.3, 0.8);
  const ptr = new THREE.Mesh(new THREE.CylinderGeometry(0.0016, 0.0016, 0.12, 6), mat(0x6b4f3f)); ptr.position.set(0.06, 0.13, -0.18); ptr.rotation.z = 1.0; g.add(ptr);
  const kidsG = new THREE.Group(); g.add(kidsG);
  const kids = [0x7fd0f0, 0xf2b630, 0xe84e8a].map((c, i) => {
    const gp = new THREE.Group(); gp.position.set(TX[i] * 0.9, 0.036, 0.0 + (i === 1 ? 0.02 : 0)); kidsG.add(gp);
    const cush = inked(new THREE.CylinderGeometry(0.04, 0.045, 0.016, 24), { color: c }); cush.position.y = 0.008; gp.add(cush); R.add(cush, 1.2 + i * 0.15, 0.8);
    const k = person([0x7a4fb0, 0xf2b630, 0xe84e8a][i], [0x8a2a1e, 0x4a2a1e, 0xe0903a][i], 0.9); k.position.y = 0.014; gp.add(k);
    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.04, 8), mat(0xf0c8a0)); arm.position.set(0.024, 0.07, 0); arm.rotation.z = -0.4; k.add(arm);
    gp.userData = { arm, k };
    return gp;
  });
  shadowed(teacher);

  // slot objects (touchable) with floor rings
  const targets = [proj, cab, kidsG, globe];
  const slotHint = SLOTS.map((s, i) => { const h = hintGlow(s.c, 0.2); g.add(h); return h; });
  const hintPos = [new THREE.Vector3(-0.06, 0.375, -0.17), new THREE.Vector3(0.215, 0.11, -0.17), new THREE.Vector3(0, 0.14, 0.02), new THREE.Vector3(-0.26, 0.15, -0.17)];
  slotHint.forEach((h, i) => h.position.copy(hintPos[i]));
  const status = SLOTS.map((s, i) => { const r = new THREE.Mesh(new THREE.TorusGeometry(0.015, 0.003, 8, 24), new THREE.MeshBasicMaterial({ color: s.c, toneMapped: false })); r.position.copy(hintPos[i]).add(new THREE.Vector3(0, 0.0, 0.02)); g.add(r); return r; });

  // option tokens
  const tokens = TX.map((x, i) => {
    const grp = new THREE.Group(); g.add(grp);
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.038, 0.042, 0.016, 28), glossy(0xe9d08a)); disc.position.y = 0.0; grp.add(disc);
    const rimT = new THREE.Mesh(new THREE.TorusGeometry(0.04, 0.003, 8, 28), goldMat()); rimT.rotation.x = Math.PI / 2; rimT.position.y = 0.008; grp.add(rimT);
    const lab = sprite('خيار', 0.17, { size: 40, width: 310, weight: 800, border: '#d4ad55', color: '#2b2620', bg: 'rgba(251,248,240,.97)' });
    lab.position.y = 0.085; grp.add(lab);
    return { grp, disc, lab, i, x, shake: -9, bad: false, vis: 0, want: 0 };
  });
  const tokenHome = (i) => new THREE.Vector3(TX[i], 0.12, 0.27);

  let active = -1, solved = new Set(), now = 0, finished = false, openAt = -9, from = new THREE.Vector3();
  function open(s) {
    if (solved.has(s) || finished) return;
    active = s; openAt = now; ctx.sfx.pop?.();
    from.copy(hintPos[s]);
    tokens.forEach((tk, i) => { const o = SLOTS[s].o[i]; retext(tk.lab, o.t, 0.17, { size: 40, width: 310, weight: 800, border: hx(SLOTS[s].c), color: '#2b2620', bg: 'rgba(251,248,240,.97)' }); tk.lab.userData.w = 0.17; tk.bad = false; tk.disc.material.color.setHex(0xe9d08a); tk.want = 1; });
    ctx.ui.hud(SLOT_NAMES[s]);
  }
  function choose(i) {
    if (active < 0 || now - openAt < 0.7) return;
    const s = active, o = SLOTS[s].o[i], tk = tokens[i]; if (tk.bad) return;
    if (o.ok) {
      solved.add(s); tokens.forEach((t) => { t.want = 0; }); active = -1; ctx.sfx.good?.();
      burstAt(ctx, g, hintPos[s], SLOTS[s].c, 30, 0.45, 0.035);
      ctx.ui.card({ tag: 'قرار مناسب', title: SLOT_NAMES[s], body: o.fb.replace('صحيح: ', ''), color: SLOTS[s].c });
      if (solved.size === 4) { finished = true; setTimeout(() => { ctx.ui.card({ tag: 'ما تعلمناه', title: 'الوسيلة تخدم الهدف', body: 'قيمة السبورة التفاعلية في الجمع بين التفاعل والحفظ والإثراء، لا في العرض وحده؛ فهي وسيلة تخدم هدفاً تعليمياً محدّداً.', color: 0xd4ad55 }); ctx.sfx.good?.(); ctx.ui.done(); }, 1700); ctx.ui.hud(''); }
      else { const nxt = [0, 1, 2, 3].find((k) => !solved.has(k)); setTimeout(() => open(nxt), 2300); }
    } else {
      tk.bad = true; tk.shake = now; tk.disc.material.color.setHex(0xd4686a); ctx.sfx.bad?.();
      ctx.ui.card({ tag: 'قرار غير مناسب', title: SLOT_NAMES[s], body: o.fb, color: 0xd4686a });
    }
  }
  targets.forEach((tg, i) => ctx.tap(tg, () => { if (now > 3) open(i); }));
  tokens.forEach((tk, i) => { ctx.tap(tk.grp, () => choose(i)); });
  ctx.ui.hud('المس ما يضيء في الصف لتتخذ قراراً');

  return {
    update(t, dt, e) {
      now = t; R.update(t, e); B.update(t);
      
      wbScreen.material.opacity = stag(t, 1.6, 0.8) * e;
      [teacher, cab, globe].forEach((o, i) => { o.scale.setScalar(Math.max(stag(t, 1.2 + i * 0.2, 0.8, easeBack) * e, 0.001)); });
      proj.scale.setScalar(Math.max(stag(t, 1.1, 0.8, easeBack) * e, 0.001));
      kids.forEach((k, i) => { k.scale.setScalar(Math.max(stag(t, 1.5 + i * 0.2, 0.8, easeBack) * e, 0.001)); const up = solved.has(2); k.userData.arm.rotation.z = -0.4 + (up ? -1.6 + 0.3 * Math.sin(t * 4 + i) : 0.06 * Math.sin(t * 2 + i)); k.userData.arm.position.y = up ? 0.09 : 0.07; });
      gsph.rotation.y = t * (solved.has(3) ? 1.6 : 0.4);
      beam.material.opacity = THREE.MathUtils.damp(beam.material.opacity, solved.has(0) ? 0.22 * (0.9 + 0.1 * Math.sin(t * 3)) : 0, 4, dt);
      memLed.material.opacity = solved.has(1) ? 0.6 + 0.3 * Math.sin(t * 4) : 0;
      drawers.forEach((d, i) => { const want = solved.has(1) ? 0.03 * (0.5 + 0.5 * Math.sin(t * 2 + i * 1.5)) : 0; d.position.z = 0.036 + want; });
      if (solved.has(0) && solved.has(1) && solved.has(2) && solved.has(3) && !finished) { /* handled in choose */ }
      if (finished && boardCv.dataset.full !== '1') { boardCv.dataset.full = '1'; drawBoard(true); }
      slotHint.forEach((h, i) => { h.position.y = hintPos[i].y + 0.006 * Math.sin(t * 2 + i); pulseHint(h, t, i, solved.has(i) ? 0 : (active === i ? 1 : 0.7) * stag(t, 2.5 + i * 0.3, 0.6) * e, 0.4); });
      status.forEach((r, i) => { const k = solved.has(i) ? 1 : 0; r.visible = true; r.scale.setScalar(Math.max(0.001, THREE.MathUtils.lerp(r.scale.x, k, 0.12))); });
      // tokens
      tokens.forEach((tk) => {
        tk.vis = THREE.MathUtils.damp(tk.vis, tk.want, 6, dt);
        const k = ease(tk.vis); tk.grp.visible = k > 0.01;
        const home = tokenHome(tk.i); const sh = now - tk.shake < 0.5 ? Math.sin((now - tk.shake) * 55) * 0.01 * (1 - (now - tk.shake) / 0.5) : 0;
        tk.grp.position.set(THREE.MathUtils.lerp(from.x, home.x, k) + sh, THREE.MathUtils.lerp(from.y, home.y, k) + 0.008 * Math.sin(t * 2 + tk.i), THREE.MathUtils.lerp(from.z + 0.1, home.z, k));
        tk.grp.scale.setScalar(Math.max(k, 0.001));
        setSpr(tk.lab, tk.lab.userData.w || 0.2, k * (tk.bad ? 0.7 : 1));
        tk.grp.rotation.y = Math.sin(t * 1.2 + tk.i) * 0.2;
      });
      // the game starts by itself
      if (t > 4.8 && active < 0 && openAt < 0 && solved.size === 0) open(0);
    },
  };
}
