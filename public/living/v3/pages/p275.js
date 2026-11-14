// p275 (round 2): the flipped classroom as two little rooms, a school and a home. A blue content block and a gold practice block swap rooms; the pawns turn from rows into a circle.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { P, ease, easeBack, clamp01, stag, mat, glossy, goldMat, shadowed, glow } from '../../kit.js?v=35';
import { halos, liveTag, motes, canvasTex, blob, fitTag, setSpr, TAU, css, arcPoint } from '../lib/a4-kit.js?v=35';

export const meta = { free: true, center: [0.5, 0.68], typeLabel: 'مقارنة', title: 'قلب مهام التعلّم: الفصل المقلوب' };

const BLUE = 0x3a86d6, GOLD = 0xe0a828;
const XL = -0.215, XR = 0.215, RW = 0.4, RD = 0.36, WH = 0.2;

function blockMesh(kind) {
  const col = kind === 'c' ? BLUE : GOLD;
  const tex = canvasTex(128, 128, (c, w, h) => {
    c.fillStyle = kind === 'c' ? '#3a86d6' : '#e8b84a'; c.fillRect(0, 0, w, h); c.fillStyle = 'rgba(255,255,255,.96)';
    if (kind === 'c') { c.beginPath(); c.moveTo(46, 32); c.lineTo(46, 96); c.lineTo(98, 64); c.fill(); }
    else { c.lineWidth = 13; c.lineCap = 'round'; c.lineJoin = 'round'; c.strokeStyle = '#fff'; c.beginPath(); c.moveTo(28, 68); c.lineTo(54, 94); c.lineTo(102, 36); c.stroke(); }
  });
  const m = new THREE.Mesh(new RoundedBoxGeometry(0.075, 0.075, 0.075, 4, 0.016), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.25, emissive: col, emissiveIntensity: 0.28 }));
  m.castShadow = true; return m;
}
function pawn(col, s = 1) {
  const g = new THREE.Group();
  const b = new THREE.Mesh(new THREE.CylinderGeometry(0.013 * s, 0.017 * s, 0.045 * s, 14), glossy(col, { clearcoat: 0.5 })); b.position.y = 0.0225 * s; g.add(b);
  const h = new THREE.Mesh(new THREE.SphereGeometry(0.0155 * s, 16, 12), glossy(col, { clearcoat: 0.5 })); h.position.y = 0.06 * s; g.add(h);
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return g;
}
function room(floorCol, wallCol) {
  const g = new THREE.Group();
  const fl = new THREE.Mesh(new RoundedBoxGeometry(RW, 0.026, RD, 3, 0.008), glossy(floorCol, { clearcoat: 0.3 })); fl.position.y = 0.013; g.add(fl);
  const bw = new THREE.Mesh(new RoundedBoxGeometry(RW, WH, 0.018, 3, 0.006), mat(wallCol, { roughness: 0.6 })); bw.position.set(0, 0.026 + WH / 2, -RD / 2 + 0.009); g.add(bw);
  const sw = new THREE.Mesh(new RoundedBoxGeometry(0.018, WH, RD, 3, 0.006), mat(wallCol, { roughness: 0.6 })); sw.userData.side = true; g.add(sw);
  const trim = new THREE.Mesh(new RoundedBoxGeometry(RW + 0.01, 0.01, RD + 0.01, 2, 0.004), goldMat()); trim.position.y = 0.004; g.add(trim);
  g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return { g, sw };
}

export default function build(ctx) {
  const g = new THREE.Group(); g.position.copy(P(meta.center[0], meta.center[1])); ctx.stage.add(g);
  const hal = halos();
  const mo = motes(g, 22, { r: 0.45, h: 0.5, color: 0xfff0c0 });
  const sh = blob(0.5, 0.28); sh.scale.set(1.0, 0.45, 1); g.add(sh);

  // ---- home (left)
  const H = room(0xd9b07a, 0xf7dcc2); const home = H.g; home.position.set(XL, 0, 0); g.add(home); H.sw.position.set(-RW / 2 + 0.009, 0.026 + WH / 2, 0);
  const win = new THREE.Group(); win.position.set(-0.08, 0.14, -RD / 2 + 0.02); home.add(win);
  win.add(new THREE.Mesh(new THREE.PlaneGeometry(0.13, 0.1), new THREE.MeshBasicMaterial({ color: 0xbfe6ff, toneMapped: false })));
  [[0, 0, 0.135, 0.006], [0, 0, 0.006, 0.105]].forEach(([x, y, w, h]) => { const b = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: 0xffffff })); b.position.set(x, y, 0.001); win.add(b); });
  const desk = new THREE.Group(); desk.position.set(0.06, 0.026, -0.05); home.add(desk);
  const dt = new THREE.Mesh(new RoundedBoxGeometry(0.22, 0.012, 0.11, 3, 0.004), glossy(0x8b5a2b)); dt.position.y = 0.06; desk.add(dt);
  [[-0.1, -0.045], [0.1, -0.045], [-0.1, 0.045], [0.1, 0.045]].forEach(([x, z]) => { const l = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.06, 8), mat(0x6b4a2a)); l.position.set(x, 0.03, z); desk.add(l); });
  const lap = new THREE.Group(); lap.position.set(-0.03, 0.066, 0.0); desk.add(lap);
  lap.add(new THREE.Mesh(new RoundedBoxGeometry(0.12, 0.006, 0.08, 2, 0.002), mat(0xb8bec8, { metalness: 0.4 })));
  const lid = new THREE.Group(); lid.position.set(0, 0.003, -0.04); lid.rotation.x = -0.3; lap.add(lid);
  const lidb = new THREE.Mesh(new RoundedBoxGeometry(0.12, 0.08, 0.004, 2, 0.002), mat(0x9aa2ad)); lidb.position.y = 0.04; lid.add(lidb);
  const stex = canvasTex(256, 170, () => {});
  const drawLap = (on) => { const c = stex.userData.canvas.getContext('2d'); c.fillStyle = on ? '#2c6fc4' : '#5a6572'; c.fillRect(0, 0, 256, 170); if (on) { c.fillStyle = '#fff'; c.beginPath(); c.moveTo(104, 40); c.lineTo(104, 130); c.lineTo(176, 85); c.fill(); } stex.needsUpdate = true; };
  drawLap(false);
  const lscr = new THREE.Mesh(new THREE.PlaneGeometry(0.108, 0.07), new THREE.MeshBasicMaterial({ map: stex, toneMapped: false })); lscr.position.set(0, 0.04, 0.0023); lid.add(lscr);
  const lg = glow(0x7fc0ff, 0.25, 0); lg.position.set(0, 0.05, 0.03); lap.add(lg);
  const sheets = new THREE.Group(); sheets.position.set(0.075, 0.068, 0.0); desk.add(sheets);
  for (let i = 0; i < 5; i++) { const s = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.002, 0.06), mat(0xfffdf6)); s.position.y = i * 0.0022; s.rotation.y = i * 0.22; sheets.add(s); }
  const plantP = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.015, 0.03, 16), mat(0xc8693c)); plantP.position.set(-0.13, 0.04, 0.1); home.add(plantP);
  const lf = new THREE.Mesh(new THREE.SphereGeometry(0.03, 14, 10), mat(0x5fb54a)); lf.position.set(-0.13, 0.08, 0.1); home.add(lf);
  shadowed(desk); home.scale.setScalar(0.0001);

  // ---- school (right)
  const S = room(0xe2b87a, 0xcfe6f7); const school = S.g; school.position.set(XR, 0, 0); g.add(school); S.sw.position.set(RW / 2 - 0.009, 0.026 + WH / 2, 0);
  const bd = new THREE.Group(); bd.position.set(0, 0.15, -RD / 2 + 0.02); school.add(bd);
  bd.add(new THREE.Mesh(new RoundedBoxGeometry(0.3, 0.13, 0.008, 2, 0.003), mat(0x8b5a2b)));
  const btex = canvasTex(256, 110, (c, w, h) => { c.fillStyle = '#2f6a4a'; c.fillRect(0, 0, w, h); c.strokeStyle = 'rgba(255,255,255,.85)'; c.lineWidth = 5; c.lineCap = 'round'; c.beginPath(); c.moveTo(24, 36); c.lineTo(110, 36); c.moveTo(24, 62); c.lineTo(86, 62); c.moveTo(24, 86); c.lineTo(130, 86); c.stroke(); c.beginPath(); c.arc(190, 56, 28, 0, TAU); c.stroke(); });
  const bscr = new THREE.Mesh(new THREE.PlaneGeometry(0.28, 0.115), new THREE.MeshBasicMaterial({ map: btex, toneMapped: false })); bscr.position.z = 0.0045; bd.add(bscr);
  const clock = new THREE.Mesh(new THREE.CircleGeometry(0.022, 24), new THREE.MeshBasicMaterial({ color: 0xfffdf6 })); clock.position.set(0.13, 0.215, -RD / 2 + 0.02); school.add(clock);
  const hand = new THREE.Mesh(new THREE.BoxGeometry(0.002, 0.016, 0.001), new THREE.MeshBasicMaterial({ color: 0x222222 })); hand.geometry.translate(0, 0.008, 0); hand.position.set(0.13, 0.215, -RD / 2 + 0.021); school.add(hand);
  const flag = new THREE.Mesh(new THREE.PlaneGeometry(0.04, 0.025), new THREE.MeshBasicMaterial({ color: 0xe0453c, side: THREE.DoubleSide })); flag.position.set(0.17, 0.3, -RD / 2 + 0.02); school.add(flag);
  const fpole = new THREE.Mesh(new THREE.CylinderGeometry(0.0025, 0.0025, 0.1, 6), goldMat()); fpole.position.set(0.15, 0.275, -RD / 2 + 0.02); school.add(fpole);
  const table = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.02, 28), glossy(0x8b5a2b)); table.position.set(0, 0.036, 0.04); school.add(table); table.scale.setScalar(0.0001);
  const kids = Array.from({ length: 8 }, (_, i) => { const p = pawn([0x3a86d6, 0xef8f2a, 0x5fae3a, 0xe0453c][i % 4]); p.position.set(0, 0.026, 0.05); school.add(p); return p; });
  const teacher = pawn(0x26303c, 1.4); school.add(teacher);
  shadowed(school); school.scale.setScalar(0.0001);
  const rowPos = (i) => ({ x: -0.105 + (i % 4) * 0.07, z: 0.03 + Math.floor(i / 4) * 0.085 });
  const ringPos = (i) => { const a = (i / 8) * TAU + 0.4; return { x: Math.cos(a) * 0.105, z: 0.04 + Math.sin(a) * 0.105 }; };

  // ---- the two blocks
  const content = blockMesh('c'), practice = blockMesh('p'); content.scale.setScalar(1.35); practice.scale.setScalar(1.35); g.add(content, practice);
  const cg = glow(BLUE, 0.3, 0); content.add(cg); const pg = glow(GOLD, 0.3, 0); practice.add(pg);
  const homeSpot = new THREE.Vector3(XL, 0.32, 0.02), schoolSpot = new THREE.Vector3(XR, 0.32, 0.0);
  content.position.copy(schoolSpot); practice.position.copy(homeSpot);
  hal.add(content, BLUE, 0.3, [0, 0, 0], 1.6); hal.add(practice, GOLD, 0.3, [0, 0, 0], 1.7);

  const tagH = fitTag('المنزل', 0xb5532f, { size: 62, style: 'solid' }), tagS = fitTag('الصف', 0x3a86d6, { size: 62, style: 'solid' });
  const tagC = fitTag('المحتوى', BLUE, { size: 56, style: 'solid' }), tagP = fitTag('التدريبات', 0xc08a10, { size: 56, style: 'solid' });
  g.add(tagH, tagS, tagC, tagP);
  const mode = liveTag(0.25, 0xd4ad55, { size: 66 }); mode.set('الدرس التقليدي'); g.add(mode.sp); mode.apply(0);

  let flipped = false, k = 0, kT = 0, now = 0, auto = true, seenT = false, seenF = false, finished = false, blockT = 1, modeK = 0; const from = { c: new THREE.Vector3(), p: new THREE.Vector3() };
  const TXT = {
    t: { tag: 'الدرس التقليدي', title: 'الشرح في الصف والتدريب في البيت', body: 'يُقدَّم المحتوى الجديد بالشرح داخل المحاضرة، وتُكلَّف الأنشطة والتدريبات فروضاً منزلية بعد الدرس.', c: GOLD },
    f: { tag: 'الفصل المقلوب', title: 'المحتوى في البيت والتدريب في الصف', body: 'يُقدَّم المحتوى قبل الحضور في مقاطع فيديو، ويُخصَّص وقت المحاضرة للمناقشات والمشاريع والتدريبات.', c: BLUE },
  };
  function flip(user) {
    if (now < 2.0 || blockT < 1) return;
    flipped = !flipped; kT = flipped ? 1 : 0; blockT = 0; from.c.copy(content.position); from.p.copy(practice.position); ctx.sfx.whoosh?.(); drawLap(flipped);
    mode.set(flipped ? 'الفصل المقلوب' : 'الدرس التقليدي', flipped ? BLUE : 0xd4ad55); modeK = 0;
    if (user) {
      auto = false; const x = TXT[flipped ? 'f' : 't']; ctx.ui.card({ tag: x.tag, title: x.title, body: x.body, color: x.c });
      flipped ? (seenF = true) : (seenT = true);
      if (seenT && seenF && !finished) { finished = true; setTimeout(() => { ctx.fx.burst(g.position.clone().setY(0.3), 0xffd27a, 44, 0.5, 0.05); ctx.sfx.good?.(); ctx.ui.hud('أعدتَ توزيع الأدوار'); ctx.ui.done(); }, 1600); }
    }
  }
  ctx.tap(home, () => flip(true)); ctx.tap(school, () => flip(true));
  ctx.tap(content, () => { ctx.sfx.pop?.(); ctx.ui.card(flipped ? { tag: 'قبل الحضور', title: 'يطّلع الطالب في بيته', body: 'يطّلع الطالب على المادة في منزله أو في أي مكان عبر حاسوبه أو هاتفه أو جهازه اللوحي.', color: BLUE } : { tag: 'داخل المحاضرة', title: 'شرح وإلقاء', body: 'يتلقّى الطالب المادة داخل غرفة الصف في الوقت المحدد.', color: BLUE }); });
  ctx.tap(practice, () => { ctx.sfx.pop?.(); ctx.ui.card(flipped ? { tag: 'داخل الصف', title: 'أنشطة بحضور المعلم', body: 'تُؤدّى الأنشطة التي كانت فروضاً منزلية داخل الصف بحضور المعلم.', color: GOLD } : { tag: 'بعد الدرس', title: 'فروض منزلية', body: 'تُكلَّف الأنشطة والتدريبات فروضاً منزلية بعد الدرس.', color: GOLD }); });
  ctx.ui.hud('المس المنزل أو الصف ليتبادلا الأدوار');

  return {
    update(t, dt, e) {
      now = t; hal.update(t, e); mo.update(t, dt, e); sh.material.opacity = 0.28 * e;
      home.scale.setScalar(Math.max(0.0001, stag(t, 0.1, 0.8, easeBack) * e)); school.scale.setScalar(Math.max(0.0001, stag(t, 0.25, 0.8, easeBack) * e));
      if (auto && t > 2.2 && !flipped && blockT >= 1) flip(false);
      k = THREE.MathUtils.damp(k, kT, 3, dt); blockT = Math.min(1, blockT + dt / 1.3);
      const f = ease(blockT), cTo = flipped ? homeSpot : schoolSpot, pTo = flipped ? schoolSpot : homeSpot;
      const bk = stag(t, 0.6, 0.7, easeBack) * e;
      if (blockT < 1) { arcPoint(content.position, from.c, cTo, f, 0.14); arcPoint(practice.position, from.p, pTo, f, -0.04); content.rotation.y += dt * 6; practice.rotation.y -= dt * 6; }
      else { content.position.copy(cTo).y += Math.sin(t * 1.8) * 0.008; practice.position.copy(pTo).y += Math.sin(t * 1.8 + 1) * 0.008; content.rotation.y += dt * 0.7; practice.rotation.y += dt * 0.7; }
      content.scale.setScalar(Math.max(0.0001, bk * 1.35)); practice.scale.setScalar(Math.max(0.0001, bk * 1.35));
      table.scale.setScalar(Math.max(0.0001, k));
      const kk = ease(k);
      kids.forEach((p, i) => { const a = rowPos(i), b = ringPos(i); p.position.x = THREE.MathUtils.lerp(a.x, b.x, kk); p.position.z = THREE.MathUtils.lerp(a.z, b.z, kk); p.position.y = 0.026 + Math.sin(Math.PI * kk) * 0.014 + Math.abs(Math.sin(t * 2 + i)) * 0.002; p.rotation.y = THREE.MathUtils.lerp(Math.PI, Math.atan2(-b.x, 0.04 - b.z), kk); });
      teacher.position.set(THREE.MathUtils.lerp(0, 0.0, kk), 0.026 + Math.sin(Math.PI * kk) * 0.014, THREE.MathUtils.lerp(-0.1, 0.17, kk)); teacher.rotation.y = THREE.MathUtils.lerp(0, Math.PI, kk);
      lg.material.opacity = (flipped ? 0.5 : 0.0) * e; hand.rotation.z -= dt * 0.5; flag.rotation.y = Math.sin(t * 3) * 0.4;
      cg.material.opacity = (0.3 + 0.1 * Math.sin(t * 3)) * bk; pg.material.opacity = (0.3 + 0.1 * Math.sin(t * 3 + 1)) * bk;
      const lk = stag(t, 1.2, 0.6, easeBack) * e;
      tagH.visible = tagS.visible = tagC.visible = tagP.visible = lk > 0.02;
      setSpr(tagH, tagH.userData.w, lk); tagH.position.set(XL, 0.03, RD / 2 + 0.07); setSpr(tagS, tagS.userData.w, lk); tagS.position.set(XR, 0.03, RD / 2 + 0.07);
      setSpr(tagC, tagC.userData.w, lk); tagC.position.copy(content.position).y += 0.09; setSpr(tagP, tagP.userData.w, lk); tagP.position.copy(practice.position).y += 0.09;
      modeK = Math.min(1, modeK + dt * 3); mode.sp.position.set(0, 0.46, -0.06); mode.apply(easeBack(modeK) * lk);
    },
  };
}
