// p239 (round 2): a big glass head crowded with tasks floats over the print; tap a task and it flies out into its own glowing window, the head cools down.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { P, ease, easeBack, clamp01, stag, mat, glossy, goldMat, shadowed, glow } from '../../kit.js?v=15';
import { halos, liveTag, motes, canvasTex, blob, arcPoint, TAU, css } from '../lib/a4-kit.js?v=15';

export const meta = { free: true, center: [0.5, 0.42], typeLabel: 'نوافذ ضوئية', title: 'تعدّد المهام وعبء المعلم' };

const TASKS = [
  { k: 'brief', t: 'تفريغ المعلم', c: 0xb9783a, body: 'استخدام الحاسب يساعد في تفريغ المعلم للقيام بالواجبات التربوية الأخرى إضافة إلى التعليم.' },
  { k: 'clip', t: 'التقويم والتغذية', c: 0x3a86d6, body: 'يساعد في عمليات التقويم الذاتي وتعزيز التعلم وتقديم التغذية الراجعة.' },
  { k: 'clock', t: 'الوقت والجهد', c: 0x2fb5a8, body: 'يوفّر الوقت والجهد على جميع أطراف العملية التعليمية.' },
  { k: 'laptop', t: 'تحرير النصوص', c: 0x8d98a6, body: 'يساعد في تحرير النصوص وكتابتها وفي إعداد المادة التعليمية.' },
  { k: 'mail', t: 'شبكة المعلومات', c: 0xef8f2a, body: 'يزوّد المتعلمين بالمعلومات عبر شبكة المعلومات العالمية.' },
  { k: 'bulb', t: 'تنويع الأساليب', c: 0xf2c23a, body: 'يتيح مجالاً واسعاً لتنويع أساليب تقديم المعلومات للمتعلمين.' },
];
const HOT = new THREE.Color(0xff5a3c), COOL = new THREE.Color(0x35c4b8), GOLD = new THREE.Color(0xffd27a);

function toolMesh(k) {
  const g = new THREE.Group();
  if (k === 'brief') {
    g.add(new THREE.Mesh(new RoundedBoxGeometry(0.085, 0.06, 0.03, 3, 0.008), glossy(0xc88b4a, { clearcoat: 0.4 })));
    const h = new THREE.Mesh(new THREE.TorusGeometry(0.014, 0.003, 8, 20, Math.PI), mat(0x7a4a22)); h.position.y = 0.03; g.add(h);
    const band = new THREE.Mesh(new THREE.BoxGeometry(0.086, 0.004, 0.031), mat(0x7a4a22)); band.position.y = 0.006; g.add(band);
    const lock = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.01, 0.004), goldMat()); lock.position.set(0, 0.006, 0.0165); g.add(lock);
  } else if (k === 'clip') {
    g.add(new THREE.Mesh(new RoundedBoxGeometry(0.058, 0.08, 0.008, 3, 0.004), mat(0x3b4350)));
    const p = new THREE.Mesh(new THREE.PlaneGeometry(0.048, 0.064), mat(0xfbf7ee)); p.position.z = 0.0046; g.add(p);
    for (let i = 0; i < 3; i++) {
      const b = new THREE.Mesh(new THREE.PlaneGeometry(0.01, 0.01), new THREE.MeshBasicMaterial({ color: i === 0 ? 0x35b54a : 0x3b4350 })); b.position.set(0.014, 0.018 - i * 0.018, 0.0052); g.add(b);
      const l = new THREE.Mesh(new THREE.PlaneGeometry(0.022, 0.003), new THREE.MeshBasicMaterial({ color: 0x8a95a3 })); l.position.set(-0.008, 0.018 - i * 0.018, 0.0052); g.add(l);
    }
    const c = new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.01, 0.01), goldMat()); c.position.y = 0.04; g.add(c);
  } else if (k === 'clock') {
    g.add(new THREE.Mesh(new THREE.TorusGeometry(0.036, 0.0055, 10, 36), glossy(0x8a5a2b)));
    const f = new THREE.Mesh(new THREE.CircleGeometry(0.036, 36), new THREE.MeshBasicMaterial({ color: 0xfbf7ee })); f.position.z = 0.001; g.add(f);
    for (let i = 0; i < 12; i++) { const a = (i / 12) * TAU, d = new THREE.Mesh(new THREE.CircleGeometry(0.0018, 6), new THREE.MeshBasicMaterial({ color: 0x4b5563 })); d.position.set(Math.sin(a) * 0.029, Math.cos(a) * 0.029, 0.002); g.add(d); }
    const h1 = new THREE.Mesh(new THREE.BoxGeometry(0.003, 0.022, 0.002), new THREE.MeshBasicMaterial({ color: 0x2b3340 })); h1.geometry.translate(0, 0.011, 0); h1.position.z = 0.003; h1.rotation.z = -0.5; g.add(h1);
    const h2 = new THREE.Mesh(new THREE.BoxGeometry(0.002, 0.03, 0.002), new THREE.MeshBasicMaterial({ color: 0x2b3340 })); h2.geometry.translate(0, 0.015, 0); h2.position.z = 0.0035; h2.rotation.z = 0.2; g.add(h2); g.userData.minute = h2;
  } else if (k === 'laptop') {
    const d = new THREE.Mesh(new RoundedBoxGeometry(0.08, 0.005, 0.055, 2, 0.002), mat(0xaeb4bd, { metalness: 0.4, roughness: 0.4 })); d.position.y = -0.02; g.add(d);
    const l = new THREE.Group(); l.position.set(0, -0.0175, -0.027); l.rotation.x = -0.25; g.add(l);
    const lid = new THREE.Mesh(new RoundedBoxGeometry(0.08, 0.055, 0.004, 2, 0.002), mat(0x9aa2ad, { metalness: 0.4, roughness: 0.4 })); lid.position.y = 0.0275; l.add(lid);
    const s = new THREE.Mesh(new THREE.PlaneGeometry(0.07, 0.045), new THREE.MeshBasicMaterial({ color: 0xcfe9f5 })); s.position.set(0, 0.0275, 0.0023); l.add(s);
  } else if (k === 'mail') {
    const tx = canvasTex(256, 180, (c, w, h) => {
      c.fillStyle = '#f2efe8'; c.fillRect(0, 0, w, h); c.strokeStyle = '#a9a39a'; c.lineWidth = 6;
      c.beginPath(); c.moveTo(0, 0); c.lineTo(w / 2, h * 0.58); c.lineTo(w, 0); c.moveTo(0, h); c.lineTo(w * 0.38, h * 0.5); c.moveTo(w, h); c.lineTo(w * 0.62, h * 0.5); c.stroke();
      c.fillStyle = '#6b7684'; c.font = '700 60px Tajawal, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('@', w / 2, h * 0.72);
    });
    g.add(new THREE.Mesh(new RoundedBoxGeometry(0.085, 0.06, 0.006, 2, 0.002), new THREE.MeshStandardMaterial({ map: tx, roughness: 0.6 })));
  } else {
    const b = new THREE.Mesh(new THREE.SphereGeometry(0.026, 24, 18), glossy(0xffd54a, { emissive: 0xffb81f, emissiveIntensity: 0.55 })); b.position.y = 0.012; g.add(b);
    const n = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.009, 0.02, 14), mat(0x8c939c, { metalness: 0.6 })); n.position.y = -0.024; g.add(n);
    const n2 = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.01, 12), mat(0x6c727a, { metalness: 0.6 })); n2.position.y = -0.038; g.add(n2);
  }
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return g;
}

export default function build(ctx) {
  const g = new THREE.Group(); g.position.copy(P(meta.center[0], meta.center[1])); ctx.stage.add(g);
  const hal = halos();
  const mo = motes(g, 20, { r: 0.4, h: 0.6, color: 0xffe9b0 });
  const sh = blob(0.34, 0.3); g.add(sh);

  // ---- the teacher: brown jacket, green tie, floating glass head
  const bust = new THREE.Group(); g.add(bust);
  const jacket = new THREE.Mesh(new THREE.CapsuleGeometry(0.05, 0.12, 10, 24), glossy(0x6b3d1d, { clearcoat: 0.3 })); jacket.rotation.z = Math.PI / 2; jacket.position.y = 0.055; jacket.scale.set(1, 1, 0.75); bust.add(jacket);
  const lap1 = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.09, 4), mat(0x55300f)); lap1.rotation.set(Math.PI, 0, 0.5); lap1.scale.z = 0.3; lap1.position.set(-0.022, 0.07, 0.04); bust.add(lap1);
  const lap2 = lap1.clone(); lap2.rotation.z = -0.5; lap2.position.x = 0.03; bust.add(lap2);
  const tie = new THREE.Mesh(new THREE.ConeGeometry(0.018, 0.11, 4), glossy(0x6f8f2a)); tie.rotation.x = Math.PI; tie.scale.z = 0.35; tie.position.set(0, 0.065, 0.045); bust.add(tie);
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.032, 0.11, 18), mat(0xf0c29a)); neck.position.y = 0.12; bust.add(neck);
  shadowed(bust); bust.scale.setScalar(0.0001);

  const HEAD_Y = 0.37, HR = 0.19;
  const head = new THREE.Group(); head.position.y = HEAD_Y; g.add(head);
  const glassMat = new THREE.MeshPhysicalMaterial({ color: 0xdff4ff, roughness: 0.05, clearcoat: 1, transparent: true, opacity: 0.2, depthWrite: false, side: THREE.DoubleSide });
  const shell = new THREE.Mesh(new THREE.SphereGeometry(HR, 44, 30), glassMat); shell.renderOrder = 6; head.add(shell);
  const core = glow(0xff5a3c, 0.6, 0.9); core.renderOrder = 3; head.add(core);
  const glasses = new THREE.Group(); glasses.position.set(0, 0.03, HR - 0.002); head.add(glasses);
  [-0.06, 0.06].forEach((x) => { const r = new THREE.Mesh(new THREE.TorusGeometry(0.036, 0.0028, 8, 30), mat(0x23262d)); r.position.x = x * 0.85; glasses.add(r); });
  const bridge = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.005, 0.005), mat(0x23262d)); glasses.add(bridge);
  hal.add(head, 0xff8a60, 0.8, [0, 0, 0], 1.0);

  // ---- tools tangled in the head (big)
  const tools = TASKS.map((td, i) => {
    const mesh = toolMesh(td.k); mesh.scale.setScalar(0.0001); head.add(mesh);
    const a = (i / 6) * TAU, rr = 0.1;
    const home = new THREE.Vector3(Math.cos(a) * rr, (i % 2 ? 0.07 : -0.06), Math.sin(a) * rr);
    const o = { td, mesh, home, state: 'in', slot: i, fly: 0, from: new THREE.Vector3(), ph: i * 1.7 + 0.4, spin: new THREE.Vector3(0.7 + i * 0.2, 0.9, 0.5 - i * 0.1), rest: new THREE.Vector3() };
    mesh.position.copy(home); ctx.tap(mesh, () => pick(o)); return o;
  });

  // ---- six large glowing windows around
  const R = 0.34;
  const slots = TASKS.map((td, i) => {
    const a = Math.PI * 0.5 + (i / 6) * TAU + 0.52, sx = Math.cos(a) * R, sz = Math.sin(a) * R * 0.78;
    const grp = new THREE.Group(); grp.position.set(sx, 0, sz); grp.rotation.y = Math.atan2(sx, sz) + Math.PI; g.add(grp);
    const W = 0.15, H = 0.17, T = 0.009, Y0 = 0.02;
    const fm = glossy(0xe0b85e, { metalness: 0.7, roughness: 0.25 });
    [[0, H + Y0], [0, Y0]].forEach(([x, y]) => { const b = new THREE.Mesh(new RoundedBoxGeometry(W + T, T, T * 1.4, 2, 0.003), fm); b.position.set(x, y, 0); grp.add(b); });
    [-W / 2, W / 2].forEach((x) => { const b = new THREE.Mesh(new RoundedBoxGeometry(T, H, T * 1.4, 2, 0.003), fm); b.position.set(x, Y0 + H / 2, 0); grp.add(b); });
    const pane = new THREE.Mesh(new THREE.PlaneGeometry(W, H), new THREE.MeshBasicMaterial({ color: td.c, transparent: true, opacity: 0.1, depthWrite: false, side: THREE.DoubleSide, toneMapped: false })); pane.position.y = Y0 + H / 2; grp.add(pane);
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.058, 0.014, 28), glossy(0xf4efe3)); base.position.set(0, 0.007, -0.04); grp.add(base);
    const dot = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.003, 18), new THREE.MeshBasicMaterial({ color: td.c, toneMapped: false })); dot.position.set(0, 0.0155, -0.04); grp.add(dot);
    shadowed(grp); grp.scale.setScalar(0.0001);
    const rest = new THREE.Vector3(sx, 0.15, sz).add(new THREE.Vector3(Math.sin(Math.atan2(sx, sz)) * 0.04, 0, Math.cos(Math.atan2(sx, sz)) * 0.04));
    // the tool floats in front of the pane, between pane and head
    rest.set(sx - Math.sin(Math.atan2(sx, sz)) * 0.04, 0.12, sz - Math.cos(Math.atan2(sx, sz)) * 0.04);
    return { grp, pane, dot, rest, td, filled: 0 };
  });
  tools.forEach((o, i) => o.rest.copy(slots[i].rest));

  const tag = liveTag(0.25, 0xd4ad55, { size: 60 }); tag.set('تفريغ المعلم'); g.add(tag.sp); tag.apply(0);
  let tagPos = new THREE.Vector3(), tagK = 0, tagT = 0, now = 0, ready = false, placedN = 0, finished = false;
  ctx.ui.hud('أخرج المهام من رأس المعلم');

  function pick(o) {
    if (!ready) return;
    if (o.state === 'in') { o.state = 'fly'; o.fly = 0; o.from.copy(o.mesh.position).applyMatrix4(head.matrixWorld); g.worldToLocal(o.from); head.remove(o.mesh); g.add(o.mesh); o.mesh.position.copy(o.from); ctx.sfx.whoosh?.(); }
    else if (o.state === 'rest') { ctx.fx.burst(g.position.clone().add(o.rest), o.td.c, 10, 0.2, 0.03); ctx.sfx.pop?.(); show(o); }
  }
  function show(o) { tag.set(o.td.t, o.td.c); tagPos.copy(o.rest); tagPos.y += 0.14; tagTarget(); ctx.ui.card({ tag: 'ما يخفّفه الحاسب', title: o.td.t, body: o.td.body, color: o.td.c }); }
  function tagTarget() { tagT = 1; tagK = 0; }
  function land(o) {
    o.state = 'rest'; placedN++; slots[o.slot].filled = 1; ctx.sfx.good?.(); ctx.fx.burst(g.position.clone().add(o.rest), o.td.c, 22, 0.32, 0.04); show(o);
    if (placedN === 6 && !finished) { finished = true; setTimeout(() => { ctx.fx.burst(g.position.clone().setY(0.45), 0xffd27a, 46, 0.5, 0.05); ctx.ui.hud('رأس هادئ ووقت للتربية'); ctx.ui.done(); }, 1200); }
    else ctx.ui.hud(`بقي ${['', 'مهمة واحدة', 'مهمتان', '٣ مهام', '٤ مهام', '٥ مهام'][6 - placedN]}`);
  }
  ctx.tap(bust, () => ctx.ui.card({ tag: 'العبء المعرفي', title: 'ذاكرة تتزاحم فيها المهام', body: 'حين تتزاحم المهام يثقل العبء. وللحاسب أن يرفع جزءاً منه.', color: 0xb9783a }));

  const tmp = new THREE.Vector3(), q = new THREE.Vector3();
  return {
    update(t, dt, e) {
      now = t; hal.update(t, e); mo.update(t, dt, e);
      if (!ready && t > 3.2) ready = true;
      const load = (6 - placedN) / 6, calm = 1 - load;
      sh.material.opacity = 0.3 * e;
      bust.scale.setScalar(Math.max(0.0001, stag(t, 0.1, 0.8, easeBack) * e));
      head.scale.setScalar(Math.max(0.0001, stag(t, 0.3, 0.8, easeBack) * e));
      head.position.y = HEAD_Y + Math.sin(t * 1.2) * 0.008;
      core.material.color.copy(HOT).lerp(finished ? GOLD : COOL, finished ? 1 : calm);
      core.material.opacity = (0.55 + 0.25 * Math.sin(t * (6 - calm * 4))) * e; core.scale.setScalar(0.65 + calm * 0.2);
      glassMat.opacity = 0.16 + 0.05 * Math.sin(t); head.rotation.y = Math.sin(t * 0.35) * 0.25;
      tools.forEach((o, i) => {
        const m = o.mesh, hk = stag(t, 0.7 + i * 0.1, 0.5, easeBack);
        if (o.state === 'in') {
          const amp = 0.006 + 0.026 * load;
          m.position.set(o.home.x + Math.sin(t * (3 + i) + o.ph) * amp, o.home.y + Math.sin(t * (2.3 + i * 0.4) + o.ph) * amp, o.home.z + Math.cos(t * (2.7 + i * 0.3)) * amp);
          m.rotation.x += o.spin.x * dt * (0.3 + load); m.rotation.y += o.spin.y * dt * (0.3 + load); m.rotation.z += o.spin.z * dt * (0.3 + load);
          m.scale.setScalar(Math.max(0.0001, hk * e * 1.55));
        } else if (o.state === 'fly') {
          o.fly = Math.min(1, o.fly + dt / 1.0); tmp.copy(o.from); q.copy(o.rest); arcPoint(m.position, tmp, q, ease(o.fly), 0.16); m.rotation.y += dt * 6; m.scale.setScalar(1.55 + 0.3 * Math.sin(Math.PI * o.fly));
          if (o.fly >= 1) land(o);
        } else { m.position.set(o.rest.x, o.rest.y + Math.sin(t * 1.6 + i) * 0.008, o.rest.z); m.rotation.y += dt * 0.8; m.rotation.x = THREE.MathUtils.damp(m.rotation.x, 0, 4, dt); m.rotation.z = THREE.MathUtils.damp(m.rotation.z, 0, 4, dt); m.scale.setScalar(THREE.MathUtils.damp(m.scale.x, 1.45, 5, dt)); }
        if (o.td.k === 'clock') o.mesh.userData.minute.rotation.z -= dt * (o.state === 'in' ? 6 : 0.4);
        const s = slots[i]; s.grp.scale.setScalar(Math.max(0.0001, stag(t, 0.9 + i * 0.15, 0.7, easeBack) * e));
        s.pane.material.opacity = THREE.MathUtils.damp(s.pane.material.opacity, 0.1 + s.filled * 0.22, 4, dt);
      });
      tagK = THREE.MathUtils.damp(tagK, tagT, 6, dt); tag.sp.position.copy(tagPos); tag.apply(easeBack(tagK) * e);
    },
  };
}
