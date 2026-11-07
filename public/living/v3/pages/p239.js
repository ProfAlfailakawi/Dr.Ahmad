// p239 (round 3): one big glass head crowded with six tools. Tap a tool and it flies out and docks on a slowly turning gold ring; the head calms down.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { P, ease, easeBack, clamp01, stag, mat, glossy, goldMat, shadowed, glow } from '../../kit.js?v=16';
import { halos, liveTag, motes, canvasTex, blob, arcPoint, TAU, css } from '../lib/a4-kit.js?v=16';

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
  const mo = motes(g, 16, { r: 0.42, h: 0.6, color: 0xffe9b0 });
  const sh = blob(0.3, 0.3); g.add(sh);

  // ---- one hero: a glass head on a slim gold stand
  const HEAD_Y = 0.34, HR = 0.24;
  const stand = new THREE.Group(); g.add(stand);
  const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, 0.024, 36), glossy(0x6b3d1d, { clearcoat: 0.5 })); foot.position.y = 0.012; stand.add(foot);
  const footR = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.006, 8, 40), goldMat()); footR.rotation.x = Math.PI / 2; footR.position.y = 0.024; stand.add(footR);
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.03, 0.12, 20), goldMat()); stem.position.y = 0.085; stand.add(stem);
  const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.045, 0.04, 32), goldMat()); cup.position.y = HEAD_Y - HR + 0.01; stand.add(cup);
  shadowed(stand); stand.scale.setScalar(0.0001);
  const head = new THREE.Group(); head.position.y = HEAD_Y; g.add(head);
  const glassMat = new THREE.MeshPhysicalMaterial({ color: 0xdff4ff, roughness: 0.04, clearcoat: 1, transparent: true, opacity: 0.22, depthWrite: false, side: THREE.DoubleSide });
  const shell = new THREE.Mesh(new THREE.SphereGeometry(HR, 48, 32), glassMat); shell.renderOrder = 6; head.add(shell);
  const core = glow(0xff5a3c, 0.8, 0.9); core.renderOrder = 3; head.add(core);
  hal.add(head, 0xff8a60, 1.0, [0, 0, 0], 0.8);

  // ---- six tools tangled inside
  const tools = TASKS.map((td, i) => {
    const mesh = toolMesh(td.k); mesh.scale.setScalar(0.0001); head.add(mesh);
    const a = (i / 6) * TAU, rr = 0.125;
    const home = new THREE.Vector3(Math.cos(a) * rr, (i % 2 ? 0.07 : -0.07), Math.sin(a) * rr);
    const o = { td, mesh, home, state: 'in', slot: i, fly: 0, from: new THREE.Vector3(), ph: i * 1.7 + 0.4, spin: new THREE.Vector3(0.7 + i * 0.2, 0.9, 0.5 - i * 0.1), rest: new THREE.Vector3(), a: 0 };
    mesh.position.copy(home); ctx.tap(mesh, () => pick(o)); return o;
  });

  // ---- one gold ring around the base with six sockets (the only other object)
  const RR = 0.325;
  const ringG = new THREE.Group(); ringG.position.y = 0.1; ringG.rotation.x = 0.12; g.add(ringG);
  const spinG = new THREE.Group(); ringG.add(spinG);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(RR, 0.012, 14, 96), goldMat()); ring.rotation.x = Math.PI / 2; spinG.add(ring);
  const ring2 = new THREE.Mesh(new THREE.TorusGeometry(RR, 0.005, 10, 96), new THREE.MeshBasicMaterial({ color: 0xfff0c0, toneMapped: false, transparent: true, opacity: 0.8 })); ring2.rotation.x = Math.PI / 2; ring2.position.y = 0.014; spinG.add(ring2);
  const sockets = TASKS.map((td, i) => {
    const a = (i / 6) * TAU + 0.5;
    const grp = new THREE.Group(); grp.position.set(Math.cos(a) * RR, 0, Math.sin(a) * RR); spinG.add(grp);
    const dock = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.055, 0.02, 28), glossy(0xf4efe3)); dock.position.y = 0.005; grp.add(dock);
    const lamp = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.004, 22), new THREE.MeshBasicMaterial({ color: td.c, toneMapped: false })); lamp.position.y = 0.017; grp.add(lamp);
    const beamUp = glow(td.c, 0.12, 0); beamUp.position.y = 0.06; grp.add(beamUp);
    shadowed(grp); return { grp, lamp, beamUp, a, filled: 0, td };
  });
  ringG.scale.setScalar(0.0001);

  const tag = liveTag(0.25, 0xd4ad55, { size: 58 }); tag.set('تفريغ المعلم'); g.add(tag.sp); tag.apply(0);
  let tagPos = new THREE.Vector3(), tagK = 0, tagT = 0, now = 0, ready = false, placedN = 0, finished = false, spinV = 0.12, spinA = 0;
  ctx.ui.hud('أخرج المهام من رأس المعلم');
  const wp = new THREE.Vector3();
  const restOf = (o, out) => { const sk = sockets[o.slot]; sk.grp.getWorldPosition(out); g.worldToLocal(out); out.y += 0.1; return out; };

  function pick(o) {
    if (!ready) return;
    if (o.state === 'in') { o.state = 'fly'; o.fly = 0; o.from.copy(o.mesh.position).applyMatrix4(head.matrixWorld); g.worldToLocal(o.from); head.remove(o.mesh); g.add(o.mesh); o.mesh.position.copy(o.from); ctx.sfx.whoosh?.(); }
    else if (o.state === 'rest') { ctx.fx.burst(g.position.clone().add(restOf(o, wp)), o.td.c, 10, 0.2, 0.03); ctx.sfx.pop?.(); show(o); }
  }
  function show(o) { tag.set(o.td.t, o.td.c); tagFollow = o; tagT = 1; tagK = 0; ctx.ui.card({ tag: 'ما يخفّفه الحاسب', title: o.td.t, body: o.td.body, color: o.td.c }); }
  let tagFollow = null;
  function land(o) {
    o.state = 'rest'; placedN++; sockets[o.slot].filled = 1; ctx.sfx.good?.(); ctx.fx.burst(g.position.clone().add(restOf(o, wp)), o.td.c, 22, 0.32, 0.04); show(o); spinV += 0.05;
    if (placedN === 6 && !finished) { finished = true; spinV = 0.6; setTimeout(() => { ctx.fx.burst(g.position.clone().setY(0.4), 0xffd27a, 46, 0.5, 0.05); ctx.ui.hud('رأس هادئ ووقت للتربية'); ctx.ui.done(); }, 1200); }
    else ctx.ui.hud(`بقي ${['', 'مهمة واحدة', 'مهمتان', '٣ مهام', '٤ مهام', '٥ مهام'][6 - placedN]}`);
  }
  ctx.tap(stand, () => ctx.ui.card({ tag: 'العبء المعرفي', title: 'ذاكرة تتزاحم فيها المهام', body: 'حين تتزاحم المهام يثقل العبء. وللحاسب أن يرفع جزءاً منه.', color: 0xb9783a }));

  const tmp = new THREE.Vector3(), q = new THREE.Vector3();
  return {
    update(t, dt, e) {
      now = t; hal.update(t, e); mo.update(t, dt, e);
      if (!ready && t > 2.6) ready = true;
      const load = (6 - placedN) / 6, calm = 1 - load;
      sh.material.opacity = 0.3 * e;
      stand.scale.setScalar(Math.max(0.0001, stag(t, 0.1, 0.7, easeBack) * e));
      head.scale.setScalar(Math.max(0.0001, stag(t, 0.25, 0.8, easeBack) * e));
      ringG.scale.setScalar(Math.max(0.0001, stag(t, 0.7, 0.9, easeBack) * e));
      head.position.y = HEAD_Y + Math.sin(t * 1.2) * 0.008;
      spinA += dt * spinV; spinG.rotation.y = spinA;
      core.material.color.copy(HOT).lerp(finished ? GOLD : COOL, finished ? 1 : calm);
      core.material.opacity = (0.55 + 0.25 * Math.sin(t * (7 - calm * 5))) * e; core.scale.setScalar(0.8 + calm * 0.25);
      glassMat.opacity = 0.18 + 0.05 * Math.sin(t); head.rotation.y = Math.sin(t * 0.35) * 0.25;
      sockets.forEach((s, i) => { s.beamUp.material.opacity = (s.filled ? 0.7 : 0.25 + 0.25 * Math.sin(t * 3 + i)) * e; s.beamUp.scale.setScalar(0.12 + s.filled * 0.06); });
      tools.forEach((o, i) => {
        const m = o.mesh, hk = stag(t, 0.5 + i * 0.1, 0.5, easeBack);
        if (o.state === 'in') {
          const amp = 0.008 + 0.034 * load;
          m.position.set(o.home.x + Math.sin(t * (3 + i) + o.ph) * amp, o.home.y + Math.sin(t * (2.3 + i * 0.4) + o.ph) * amp, o.home.z + Math.cos(t * (2.7 + i * 0.3)) * amp);
          m.rotation.x += o.spin.x * dt * (0.3 + load); m.rotation.y += o.spin.y * dt * (0.3 + load); m.rotation.z += o.spin.z * dt * (0.3 + load);
          m.scale.setScalar(Math.max(0.0001, hk * e * 1.9));
        } else if (o.state === 'fly') {
          o.fly = Math.min(1, o.fly + dt / 1.0); restOf(o, q); tmp.copy(o.from); arcPoint(m.position, tmp, q, ease(o.fly), 0.2); m.rotation.y += dt * 6; m.scale.setScalar(1.9 + 0.3 * Math.sin(Math.PI * o.fly));
          if (o.fly >= 1) land(o);
        } else { restOf(o, q); m.position.set(q.x, q.y + Math.sin(t * 1.6 + i) * 0.008, q.z); m.rotation.y += dt * 0.8; m.rotation.x = THREE.MathUtils.damp(m.rotation.x, 0, 4, dt); m.rotation.z = THREE.MathUtils.damp(m.rotation.z, 0, 4, dt); m.scale.setScalar(THREE.MathUtils.damp(m.scale.x, 1.7, 5, dt)); }
        if (o.td.k === 'clock') o.mesh.userData.minute.rotation.z -= dt * (o.state === 'in' ? 6 : 0.4);
      });
      tagK = THREE.MathUtils.damp(tagK, tagT, 6, dt);
      if (tagFollow) { restOf(tagFollow, tagPos); tagPos.y += 0.13; }
      tag.sp.position.copy(tagPos); tag.apply(easeBack(tagK) * e);
    },
  };
}
