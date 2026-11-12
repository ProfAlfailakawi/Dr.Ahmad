// p239 (round 4): a brass-and-wool teacher mannequin with six arms, each hand clutching a task.
// Tap a task: it flies into its own glowing screen on the ring, the arm relaxes, the load ring turns from red to teal.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { P, ease, easeBack, clamp01, stag, mat, glossy, goldMat, shadowed, glow } from '../../kit.js?v=28';
import { rising, halos, motes, blob, dais, canvasTex, screen, paintText, TAU } from '../lib/b4-kit.js?v=28';

export const meta = { free: true, center: [0.45, 0.46], typeLabel: 'نوافذ ضوئية', title: 'تعدّد المهام وعبء المعلم' };

const TASKS = [
  { k: 'brief', t: 'تفريغ المعلم', c: 0xb9783a, body: 'استخدام الحاسب يساعد في تفريغ المعلم للقيام بالواجبات التربوية الأخرى إضافة إلى التعليم.' },
  { k: 'clip', t: 'التقويم والتغذية', c: 0x3a86d6, body: 'يساعد في عمليات التقويم الذاتي وتعزيز التعلم وتقديم التغذية الراجعة.' },
  { k: 'clock', t: 'الوقت والجهد', c: 0x2fb5a8, body: 'يوفّر الوقت والجهد على جميع أطراف العملية التعليمية.' },
  { k: 'laptop', t: 'تحرير النصوص', c: 0x8d98a6, body: 'يساعد في تحرير النصوص وكتابتها وفي إعداد المادة التعليمية.' },
  { k: 'mail', t: 'شبكة المعلومات', c: 0xef8f2a, body: 'يزوّد المتعلمين بالمعلومات عبر شبكة المعلومات العالمية.' },
  { k: 'bulb', t: 'تنويع الأساليب', c: 0xf2c23a, body: 'يتيح مجالاً واسعاً لتنويع أساليب تقديم المعلومات للمتعلمين.' },
];
const HOT = new THREE.Color(0xff5a3c), COOL = new THREE.Color(0x35c4b8);
const SHO_Y = 0.2, RING_R = 0.335, LEAN = -0.62;
const HAND = [[-0.14, 0.04], [-0.19, 0.31], [-0.25, 0.17], [0.16, 0.05], [0.25, 0.19], [0.17, 0.35]]; // hand spots in the figure's own front plane
const WANG = [-0.92, -2.5, -1.72, 0.92, 1.72, 2.5]; // window angle on the ring

function toolMesh(k) {
  const g = new THREE.Group();
  const bm = (geo, m) => { const o = new THREE.Mesh(geo, m); g.add(o); return o; };
  if (k === 'brief') {
    bm(new RoundedBoxGeometry(0.1, 0.07, 0.034, 3, 0.009), glossy(0xc88b4a, { clearcoat: 0.4 }));
    const h = bm(new THREE.TorusGeometry(0.017, 0.0035, 8, 20, Math.PI), mat(0x7a4a22)); h.position.y = 0.035;
    bm(new THREE.BoxGeometry(0.101, 0.005, 0.035), mat(0x7a4a22)).position.y = 0.007;
    bm(new THREE.BoxGeometry(0.014, 0.012, 0.004), goldMat()).position.set(0, 0.007, 0.0185);
  } else if (k === 'clip') {
    bm(new RoundedBoxGeometry(0.068, 0.092, 0.009, 3, 0.004), mat(0x3b4350));
    bm(new THREE.PlaneGeometry(0.056, 0.074), mat(0xfbf7ee)).position.z = 0.0051;
    for (let i = 0; i < 3; i++) {
      bm(new THREE.PlaneGeometry(0.011, 0.011), new THREE.MeshBasicMaterial({ color: i === 0 ? 0x35b54a : 0x3b4350 })).position.set(0.017, 0.021 - i * 0.021, 0.0056);
      bm(new THREE.PlaneGeometry(0.026, 0.0035), new THREE.MeshBasicMaterial({ color: 0x8a95a3 })).position.set(-0.009, 0.021 - i * 0.021, 0.0056);
    }
    bm(new THREE.BoxGeometry(0.026, 0.012, 0.011), goldMat()).position.y = 0.046;
  } else if (k === 'clock') {
    bm(new THREE.TorusGeometry(0.042, 0.0065, 10, 40), glossy(0x8a5a2b));
    bm(new THREE.CircleGeometry(0.042, 40), new THREE.MeshBasicMaterial({ color: 0xfbf7ee })).position.z = 0.001;
    for (let i = 0; i < 12; i++) { const a = (i / 12) * TAU; bm(new THREE.CircleGeometry(0.002, 6), new THREE.MeshBasicMaterial({ color: 0x4b5563 })).position.set(Math.sin(a) * 0.034, Math.cos(a) * 0.034, 0.002); }
    const h1 = bm(new THREE.BoxGeometry(0.0035, 0.025, 0.002), new THREE.MeshBasicMaterial({ color: 0x2b3340 })); h1.geometry.translate(0, 0.0125, 0); h1.position.z = 0.003; h1.rotation.z = -0.5;
    const h2 = bm(new THREE.BoxGeometry(0.0025, 0.034, 0.002), new THREE.MeshBasicMaterial({ color: 0x2b3340 })); h2.geometry.translate(0, 0.017, 0); h2.position.z = 0.0035; g.userData.minute = h2;
  } else if (k === 'laptop') {
    bm(new RoundedBoxGeometry(0.096, 0.006, 0.066, 2, 0.002), mat(0xaeb4bd, { metalness: 0.4, roughness: 0.4 })).position.y = -0.024;
    const l = new THREE.Group(); l.position.set(0, -0.021, -0.032); l.rotation.x = -0.25; g.add(l);
    const lid = new THREE.Mesh(new RoundedBoxGeometry(0.096, 0.066, 0.005, 2, 0.002), mat(0x9aa2ad, { metalness: 0.4, roughness: 0.4 })); lid.position.y = 0.033; l.add(lid);
    const s = new THREE.Mesh(new THREE.PlaneGeometry(0.084, 0.054), new THREE.MeshBasicMaterial({ color: 0xcfe9f5 })); s.position.set(0, 0.033, 0.0028); l.add(s);
  } else if (k === 'mail') {
    const tx = canvasTex(256, 180, (c, w, h) => {
      c.fillStyle = '#f2efe8'; c.fillRect(0, 0, w, h); c.strokeStyle = '#a9a39a'; c.lineWidth = 6;
      c.beginPath(); c.moveTo(0, 0); c.lineTo(w / 2, h * 0.58); c.lineTo(w, 0); c.moveTo(0, h); c.lineTo(w * 0.38, h * 0.5); c.moveTo(w, h); c.lineTo(w * 0.62, h * 0.5); c.stroke();
      c.fillStyle = '#4f6b8a'; c.font = '800 70px Tajawal, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('@', w / 2, h * 0.72);
    });
    bm(new RoundedBoxGeometry(0.1, 0.07, 0.007, 2, 0.002), new THREE.MeshStandardMaterial({ map: tx, roughness: 0.6 }));
  } else {
    const b = bm(new THREE.SphereGeometry(0.031, 28, 20), glossy(0xffd54a, { emissive: 0xffb81f, emissiveIntensity: 0.6 })); b.position.y = 0.014;
    bm(new THREE.CylinderGeometry(0.014, 0.0105, 0.024, 16), mat(0x8c939c, { metalness: 0.6 })).position.y = -0.028;
    bm(new THREE.CylinderGeometry(0.0095, 0.0095, 0.012, 14), mat(0x6c727a, { metalness: 0.6 })).position.y = -0.045;
  }
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return g;
}

export default function build(ctx) {
  const g = new THREE.Group(); g.position.copy(P(meta.center[0], meta.center[1])); ctx.stage.add(g);
  const rise = rising(), hal = halos(), mo = motes(g, 18, { r: 0.36, h: 0.5 });
  const sh = blob(0.42, 0.3); sh.position.y = -0.02; g.add(sh);
  const base = dais(0.385, { top: 0x9ed6cf }); rise.add(base, 0.05, 0.1, 0.9); g.add(base);
  const loadRing = new THREE.Mesh(new THREE.TorusGeometry(0.368, 0.0065, 8, 96), new THREE.MeshBasicMaterial({ color: 0xff5a3c, toneMapped: false }));
  loadRing.rotation.x = Math.PI / 2; loadRing.position.y = 0.033; g.add(loadRing);

  // ---- the mannequin: lathe body, egg head, glasses
  const fig = new THREE.Group(); fig.position.set(0, 0.03, -0.02); fig.rotation.x = LEAN; fig.scale.setScalar(1.3); g.add(fig);
  const prof = [[0.001, 0], [0.065, 0.0], [0.07, 0.012], [0.052, 0.05], [0.048, 0.1], [0.06, 0.16], [0.078, 0.2], [0.07, 0.222], [0.028, 0.236], [0.022, 0.255], [0.001, 0.256]].map(([r, y]) => new THREE.Vector2(r, y));
  const body = new THREE.Mesh(new THREE.LatheGeometry(prof, 40), glossy(0x6b3f1d, { clearcoat: 0.5, roughness: 0.45 })); fig.add(body);
  const collar = new THREE.Mesh(new THREE.TorusGeometry(0.03, 0.007, 10, 28), goldMat()); collar.rotation.x = Math.PI / 2; collar.position.y = 0.24; fig.add(collar);
  const tie = new THREE.Mesh(new THREE.BoxGeometry(0.014, 0.085, 0.006), mat(0x6b7d2a)); tie.position.set(0, 0.17, 0.063); tie.rotation.x = -0.12; fig.add(tie);
  const head = new THREE.Group(); head.position.y = 0.3; fig.add(head);
  const skull = new THREE.Mesh(new THREE.SphereGeometry(0.043, 32, 24), glossy(0xf1c79b, { clearcoat: 0.2, roughness: 0.5 })); skull.scale.set(0.9, 1.08, 0.95); head.add(skull);
  const hair = new THREE.Mesh(new THREE.SphereGeometry(0.0445, 32, 18, 0, TAU, 0, 1.15), mat(0x2b2f38, { roughness: 0.6 })); hair.scale.set(0.93, 1.1, 0.98); hair.position.y = 0.003; head.add(hair);
  [-1, 1].forEach((s) => { const lens = new THREE.Mesh(new THREE.TorusGeometry(0.0125, 0.0025, 8, 24), mat(0x1c1c20)); lens.position.set(s * 0.0165, 0.004, 0.04); head.add(lens); const ear = new THREE.Mesh(new THREE.SphereGeometry(0.009, 10, 8), mat(0xf1c79b)); ear.position.set(s * 0.039, 0, 0); head.add(ear); });
  const bridge = new THREE.Mesh(new THREE.CylinderGeometry(0.0018, 0.0018, 0.008, 6), mat(0x1c1c20)); bridge.rotation.z = Math.PI / 2; bridge.position.set(0, 0.006, 0.041); head.add(bridge);
  const stress = glow(0xff5a3c, 0.2, 0.6); stress.position.set(0, 0.3, -0.02); fig.add(stress);
  const cap = new THREE.Group(); // graduation cap that arrives at the end
  { const b = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.034, 0.02, 24), mat(0x1f2430)); cap.add(b); const t = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.006, 0.1), mat(0x1f2430)); t.position.y = 0.014; t.rotation.y = Math.PI / 4; cap.add(t); const tas = new THREE.Mesh(new THREE.SphereGeometry(0.006, 10, 8), goldMat()); tas.position.set(0.045, 0.0, 0.0); cap.add(tas); const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.0014, 0.0014, 0.05, 6), goldMat()); cord.position.set(0.045, -0.02, 0); cap.add(cord); }
  cap.position.set(0, 0.5, 0); cap.scale.setScalar(0.0001); fig.add(cap);
  shadowed(fig);
  rise.add(fig, 0.4, 0.14, 0.9);

  // ---- arms (two segments each) and hands; tools
  const armMat = mat(0x5b3519, { roughness: 0.5 });
  const hands = TASKS.map((T, i) => {
    const a = i * TAU / 6 + Math.PI / 6;
    const up = new THREE.Mesh(new THREE.CylinderGeometry(0.0085, 0.0085, 1, 10), armMat);
    const low = new THREE.Mesh(new THREE.CylinderGeometry(0.0075, 0.0075, 1, 10), armMat);
    const elbow = new THREE.Mesh(new THREE.SphereGeometry(0.0105, 12, 10), goldMat());
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.0125, 14, 10), mat(0xf1c79b));
    fig.add(up, low, elbow, hand);
    const tool = toolMesh(T.k); tool.scale.setScalar(1); g.add(tool);
    const h = hal.add(tool, T.c, 0.2, [0, 0, 0.02], 3.6);
    // window on the ring
    const wa = WANG[i];
    const win = new THREE.Group(); win.position.set(Math.sin(wa) * RING_R, 0.03, Math.cos(wa) * RING_R); win.rotation.y = wa + Math.PI; g.add(win);
    const tilt = new THREE.Group(); tilt.rotation.x = -0.35; win.add(tilt);
    const frame = new THREE.Mesh(new RoundedBoxGeometry(0.19, 0.128, 0.012, 3, 0.009), glossy(0xf4efe3, { clearcoat: 0.6 })); frame.position.y = 0.066; tilt.add(frame);
    const mk = (draw) => { const sc = screen(0.172, 0.11, 512); sc.draw(draw); const f = sc.mesh; f.position.set(0, 0.066, 0.0068); const bk = f.clone(); bk.position.z = -0.0068; bk.rotation.y = Math.PI; tilt.add(f, bk); return [f, bk]; };
    const col = '#' + T.c.toString(16).padStart(6, '0');
    const empty = mk((c, w, h) => { c.fillStyle = 'rgba(255,255,255,.5)'; c.beginPath(); c.roundRect(3, 3, w - 6, h - 6, 28); c.fill(); c.setLineDash([26, 18]); c.lineWidth = 10; c.strokeStyle = '#1f8f86'; c.stroke(); c.setLineDash([]); c.fillStyle = '#1f8f86'; c.globalAlpha = 0.85; c.fillRect(w / 2 - 7, h / 2 - 34, 14, 68); c.fillRect(w / 2 - 34, h / 2 - 7, 68, 14); });
    const full = mk((c, w, h) => { c.fillStyle = '#fffdf7'; c.beginPath(); c.roundRect(3, 3, w - 6, h - 6, 28); c.fill(); c.fillStyle = col; c.beginPath(); c.roundRect(3, 3, w - 6, 26, [28, 28, 0, 0]); c.fill(); paintText(c, T.t, w / 2, h * 0.76, w - 30, h * 0.36, { size: 86, color: '#2b2620' }); });
    full.forEach((m) => { m.visible = false; });
    const wl = glow(T.c, 0.24, 0); wl.position.set(0, 0.06, 0.03); tilt.add(wl);
    const goldEdge = new THREE.Mesh(new THREE.BoxGeometry(0.192, 0.006, 0.016), goldMat()); goldEdge.position.y = 0.004; tilt.add(goldEdge);
    const stand = { plate: { mesh: full[0] }, back: full[1] };
    shadowed(win);
    rise.add(win, 0.9 + i * 0.18, 0.08, 0.7);
    const s = { i, a: wa, T, up, low, elbow, hand, tool, h, win, tilt, empty, full, wl, state: 'held', fly: 0, from: new THREE.Vector3(), calm: 0, dock: new THREE.Vector3(), seen: false };
    ctx.tap(tool, () => release(s));
    return s;
  });
  hands.forEach((s) => { s.tool.visible = false; });
  rise.add(new THREE.Group(), 0, 0); // keep API happy

  const cam = new THREE.Vector3();
  let docked = 0, finished = false, now = 0, calmAll = 0, capK = 0;
  const sp = new THREE.Vector3(), hp = new THREE.Vector3(), ep = new THREE.Vector3(), tmp = new THREE.Vector3(), up_ = new THREE.Vector3(0, 1, 0), w = new THREE.Vector3(), q = new THREE.Quaternion();
  const limb = (m, a, b) => { tmp.subVectors(b, a); const L = tmp.length() || 1e-4; m.position.lerpVectors(a, b, 0.5); m.scale.set(1, L, 1); q.setFromUnitVectors(up_, tmp.divideScalar(L)); m.quaternion.copy(q); };

  function release(s) {
    if (s.state !== 'held' || now < 3.6) return;
    s.state = 'fly'; s.fly = 0; s.from.copy(s.tool.position); s.h.on = 0;
    s.win.getWorldPosition(s.dock); g.worldToLocal(s.dock);
    s.dock.y += 0.108; s.dock.addScaledVector(w.set(cam.x - s.dock.x, 0, cam.z - s.dock.z).normalize(), 0.03);
    ctx.sfx.pop?.(); ctx.ui.hud(`${docked + 1} من ٦ سُلّمت للحاسب`.replace(/\d/g, (d) => '٠١٢٣٤٥٦٧٨٩'[d]));
  }
  function arrive(s) {
    s.state = 'docked'; docked++; s.full.forEach((m) => { m.visible = true; }); s.empty.forEach((m) => { m.visible = false; }); s.wl.userData.pulse = 1;
    ctx.sfx.good?.(); ctx.fx.burst(g.position.clone().add(s.dock), s.T.c, 18, 0.28, 0.026);
    ctx.ui.card({ tag: 'سُلّمت للحاسب', title: s.T.t, body: s.T.body, color: s.T.c });
    if (docked === 6 && !finished) {
      finished = true; ctx.ui.hud('وقتٌ للمهام التربوية');
      setTimeout(() => { ctx.sfx.whoosh?.(); ctx.fx.burst(g.position.clone().add(new THREE.Vector3(0, 0.36, 0)), 0xffe6a0, 50, 0.5, 0.04); ctx.ui.card({ tag: 'اكتملت الصورة', title: 'مهام أقل، وقت أوفر', body: 'حين يتولّى الحاسب هذه المهام يتفرّغ المعلم لواجباته التربوية إلى جانب التعليم.', color: 0x35c4b8 }); ctx.ui.done(); }, 1400);
    }
  }
  ctx.tap(head, () => { ctx.sfx.click?.(); ctx.ui.card({ tag: 'المعلم', title: 'ستّ مهام في وقت واحد', body: 'كلما تزاحمت المهام ثقل العبء على المعلم، والحاسب يرفع عنه جزءاً منها.', color: 0xd4ad55 }); });
  ctx.ui.hud('المس أداة لتسلّمها للحاسب');

  return {
    update(t, dt, e) {
      now = t; ctx.camera.getWorldPosition(cam); g.worldToLocal(cam);
      rise.update(t, e); hal.update(t, e); mo.update(t, dt, e);
      const target = docked / 6; calmAll = THREE.MathUtils.damp(calmAll, target, 3, dt);
      loadRing.material.color.copy(HOT).lerp(COOL, calmAll);
      const amp = 1 - calmAll;
      fig.rotation.z = Math.sin(t * 17) * 0.012 * amp * stag(t, 2, 1); fig.rotation.y = Math.sin(t * 0.8) * 0.12 * (0.4 + amp * 0.6) + (finished ? t * 0.3 : 0) * 0;
      head.rotation.z = Math.sin(t * 13) * 0.05 * amp; head.rotation.y = Math.sin(t * 1.3) * 0.2;
      stress.material.opacity = 0.7 * amp * e * (0.7 + 0.3 * Math.sin(t * 9)); stress.scale.setScalar(0.18 + 0.03 * Math.sin(t * 9));
      capK = THREE.MathUtils.damp(capK, finished ? 1 : 0, 2.5, dt);
      cap.visible = capK > 0.02; cap.scale.setScalar(Math.max(0.0001, capK * 1.15)); cap.position.y = 0.352 + (1 - capK) * 0.2 + Math.sin(t * 2) * 0.004 * capK; cap.rotation.y = t * 0.9;
      sp.set(0, 0, 0);
      hands.forEach((s) => {
        s.win.rotation.y = Math.atan2(cam.x - s.win.position.x, cam.z - s.win.position.z);
        const wake = stag(t, 0.7 + s.i * 0.15, 0.7, easeBack) * e;
        s.calm = THREE.MathUtils.damp(s.calm, s.state === 'held' ? 0 : 1, 3.5, dt);
        const jit = (1 - s.calm) * 0.012;
        const side = HAND[s.i][0] < 0 ? -1 : 1;
        sp.set(side * 0.06, SHO_Y + (s.i % 3) * 0.012, 0.0);
        hp.set(THREE.MathUtils.lerp(HAND[s.i][0], side * 0.098, s.calm) + Math.sin(t * (9 + s.i * 2) + s.i) * jit, THREE.MathUtils.lerp(HAND[s.i][1], 0.07 + (s.i % 3) * 0.035, s.calm) + Math.cos(t * (11 + s.i) + s.i) * jit, 0.05 + Math.sin(t * (7 + s.i) + 2) * jit);
        if (wake < 0.01) hp.copy(sp); else { hp.sub(sp).multiplyScalar(wake).add(sp); }
        ep.lerpVectors(sp, hp, 0.5); ep.y -= 0.035 * (1 - s.calm * 0.4); ep.x += side * 0.03; ep.z += 0.03;
        limb(s.up, sp, ep); limb(s.low, ep, hp); s.elbow.position.copy(ep); s.hand.position.copy(hp);
        s.up.visible = s.low.visible = s.elbow.visible = s.hand.visible = wake > 0.02;
        s.up.scale.x = s.low.scale.x = s.elbow.scale.x = s.hand.scale.x = Math.max(0.0001, wake); s.up.scale.z = s.low.scale.z = Math.max(0.0001, wake); s.elbow.scale.y = s.elbow.scale.z = s.hand.scale.y = s.hand.scale.z = Math.max(0.0001, wake);
        if (s.state === 'held') {
          fig.localToWorld(w.copy(hp)); g.worldToLocal(w); tmp.set(side * 0.02, 0.012, 0.03).applyEuler(fig.rotation); s.tool.position.copy(w).add(tmp);
          s.tool.rotation.set(LEAN + Math.sin(t * 3 + s.i) * 0.12 * amp, Math.sin(t * 2.4 + s.i) * 0.1 * amp, Math.sin(t * 4 + s.i * 2) * 0.14 * amp);
          s.tool.visible = wake > 0.05; s.tool.scale.setScalar(Math.max(0.0001, wake * 1.5));
        } else if (s.state === 'fly') {
          s.fly = Math.min(1, s.fly + dt / 1.0); const k = ease(s.fly);
          s.tool.position.lerpVectors(s.from, s.dock, k); s.tool.position.y += Math.sin(Math.PI * k) * 0.1;
          s.tool.rotation.y += dt * 5 * (1 - s.fly); s.tool.scale.setScalar(1.5 - 0.75 * k);
          if (s.fly >= 1) { s.tool.rotation.set(-0.35, s.win.rotation.y, 0); arrive(s); }
        } else {
          s.tool.position.copy(s.dock); s.tool.position.y += Math.sin(t * 2 + s.i) * 0.002; s.tool.rotation.set(-0.35, s.win.rotation.y, 0);
        }
        if (s.tool.userData.minute) s.tool.userData.minute.rotation.z = -t * (s.state === 'held' ? 6 : 0.5);
        const wk = s.state === 'docked' ? 1 : 0;
        s.wl.userData.pulse = Math.max(0, (s.wl.userData.pulse || 0) - dt * 0.8);
        s.wl.material.opacity = (wk * 0.28 + s.wl.userData.pulse * 0.5) * e;
        s.wl.scale.setScalar(0.2 + s.wl.userData.pulse * 0.1);
      });
    },
  };
}
