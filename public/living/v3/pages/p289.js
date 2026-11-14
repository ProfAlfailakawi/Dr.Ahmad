// p289 (round 4): a 3D printer that builds the orange head layer by layer. Tap the head and its layers float apart; tap the print head to print again.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { P, ease, easeBack, clamp01, stag, mat, glossy, goldMat, shadowed, glow, sprite } from '../../kit.js?v=34';
import { rising, halos, motes, blob, canvasTex, screen, paintText, TAU } from '../lib/b4-kit.js?v=34';

export const meta = { free: true, center: [0.46, 0.52], typeLabel: 'مجسّم تفاعلي', title: 'الطباعة ثلاثية الأبعاد' };

const BLUE = 0x3d7bd8, ORANGE = 0xff5f1f;
const H = 0.36, N = 50, BED = 0.052;
const TAB = [[0, 0.040, 0.043], [0.14, 0.043, 0.046], [0.2, 0.05, 0.055], [0.28, 0.064, 0.074], [0.4, 0.074, 0.088], [0.58, 0.080, 0.096], [0.78, 0.078, 0.092], [0.9, 0.062, 0.07], [0.97, 0.04, 0.045], [1, 0.014, 0.017]];
function prof(y) { for (let i = 1; i < TAB.length; i++) if (y <= TAB[i][0]) { const a = TAB[i - 1], b = TAB[i], k = (y - a[0]) / (b[0] - a[0]); return [(a[1] + (b[1] - a[1]) * k) * 1.05, (a[2] + (b[2] - a[2]) * k) * 1.05]; } return [0.017, 0.02]; }

export default function build(ctx) {
  const g = new THREE.Group(); g.position.copy(P(meta.center[0], meta.center[1])); ctx.stage.add(g);
  const rise = rising(), hal = halos(), mo = motes(g, 14, { r: 0.4, h: 0.5 });
  const sh = blob(0.42, 0.3); sh.position.y = -0.03; g.add(sh);

  // ---- hexagonal base (the printed hexagons), thick finished underside
  const hexBase = new THREE.Group(); g.add(hexBase);
  const hb = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 0.034, 6), glossy(BLUE, { clearcoat: 0.6 })); hb.rotation.y = Math.PI / 6; hb.position.y = 0.017; hexBase.add(hb);
  const hb2 = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.012, 6), mat(0xf6f1e4, { roughness: 0.4 })); hb2.rotation.y = Math.PI / 6; hb2.position.y = 0.04; hexBase.add(hb2);
  const hb3 = new THREE.Mesh(new THREE.CylinderGeometry(0.345, 0.345, 0.004, 6), goldMat()); hb3.rotation.y = Math.PI / 6; hb3.position.y = 0.0375; hexBase.add(hb3);
  const hb4 = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.3, 0.05, 6), mat(0x28487e)); hb4.rotation.y = Math.PI / 6; hb4.position.y = -0.025; hexBase.add(hb4);
  const hb5 = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.004, 6), goldMat()); hb5.rotation.y = Math.PI / 6; hb5.position.y = -0.052; hexBase.add(hb5);
  shadowed(hexBase); rise.add(hexBase, 0.05, 0.1, 0.8);
  const bed = new THREE.Group(); bed.position.y = 0.046; g.add(bed);   // turntable that carries the head
  const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.16, 0.012, 48), glossy(0xf1ece0, { clearcoat: 0.6 })); disc.position.y = 0.0; bed.add(disc);
  const dr = new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.004, 8, 60), goldMat()); dr.rotation.x = Math.PI / 2; dr.position.y = 0.006; bed.add(dr);
  rise.add(bed, 0.3, 0.08, 0.7);

  // ---- one tall post, an arm and a halo ring that climbs with the print; the nozzle rides the ring
  const post = new THREE.Group(); post.position.set(0.0, 0.04, -0.3); g.add(post);
  const pb = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 0.03, 28), goldMat()); pb.position.y = 0.015; post.add(pb);
  const pp = new THREE.Mesh(new RoundedBoxGeometry(0.04, 0.6, 0.04, 4, 0.014), glossy(0xf4f1ea, { clearcoat: 0.6 })); pp.position.y = 0.32; post.add(pp);
  const pc = new THREE.Mesh(new THREE.SphereGeometry(0.026, 20, 14), goldMat()); pc.position.y = 0.635; post.add(pc);
  const slot = new THREE.Mesh(new RoundedBoxGeometry(0.006, 0.5, 0.006, 2, 0.002), goldMat()); slot.position.set(0, 0.3, 0.021); post.add(slot);
  shadowed(post); rise.add(post, 0.5, 0.18, 0.9);
  const halo = new THREE.Group(); g.add(halo);
  const arm = new THREE.Mesh(new RoundedBoxGeometry(0.03, 0.022, 0.2, 3, 0.008), glossy(0xf4f1ea, { clearcoat: 0.6 })); arm.position.set(0, 0, -0.17); halo.add(arm);
  const hring = new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.007, 10, 72), goldMat()); hring.rotation.x = Math.PI / 2; halo.add(hring);
  const hring2 = new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.003, 8, 72), new THREE.MeshBasicMaterial({ color: 0xff9a40, toneMapped: false })); hring2.rotation.x = Math.PI / 2; hring2.position.y = -0.008; halo.add(hring2);
  const carriage = new THREE.Group(); halo.add(carriage);
  const cb = new THREE.Mesh(new RoundedBoxGeometry(0.06, 0.04, 0.05, 3, 0.012), glossy(0xff7a2a, { clearcoat: 0.6 })); cb.position.y = 0.02; carriage.add(cb);
  const noz = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.003, 0.03, 14), goldMat()); noz.position.y = -0.012; carriage.add(noz);
  const tip = glow(0xff9a40, 0.08, 0.9); tip.position.y = -0.03; carriage.add(tip);
  const fil = new THREE.Mesh(new THREE.CylinderGeometry(0.0022, 0.0022, 1, 6), new THREE.MeshBasicMaterial({ color: 0xff8a30, toneMapped: false })); halo.add(fil);
  shadowed(halo); rise.add(halo, 0.9, 0.1, 0.7);
  hal.add(halo, 0xffd27a, 0.22, [0.15, 0.03, 0], 3.6);

  // ---- the head: instanced layers
  const items = [];
  for (let i = 0; i < N; i++) { const y = (i + 0.5) / N; const [ax, az] = prof(y); items.push({ y, x: 0, z: 0, ax, az }); }
  const add = (y0, y1, n, f) => { for (let i = 0; i < n; i++) { const y = y0 + (y1 - y0) * (i + 0.5) / n; const [ax, az] = prof(y); items.push({ y, ...f(i / (n - 1 || 1), ax, az) }); } };
  add(0.36, 0.52, 8, (k, ax, az) => ({ x: 0, z: az * 0.95 + 0.01, ax: 0.015 + 0.004 * Math.sin(k * 3), az: 0.034 - 0.02 * k }));
  add(0.2, 0.3, 5, (k, ax, az) => ({ x: 0, z: az * 0.8, ax: 0.036 - 0.004 * k, az: 0.03 }));
  add(0.42, 0.6, 6, (k, ax, az) => ({ x: ax + 0.002, z: -0.008, ax: 0.005, az: 0.018 + 0.004 * Math.sin(k * 3) }));
  add(0.42, 0.6, 6, (k, ax, az) => ({ x: -ax - 0.002, z: -0.008, ax: 0.005, az: 0.018 + 0.004 * Math.sin(k * 3) }));
  add(0.55, 0.62, 3, (k, ax, az) => ({ x: 0, z: az * 0.9, ax: 0.062, az: 0.014 }));   // brow
  const NI = items.length;
  const geo = new THREE.CylinderGeometry(1, 1, 1, 28);
  const head = new THREE.InstancedMesh(geo, glossy(0xffffff, { clearcoat: 0.8, roughness: 0.28, emissive: 0xff3d00, emissiveIntensity: 0.1 }), NI); head.castShadow = true; head.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  const turn = new THREE.Group(); turn.position.y = 0.006; bed.add(turn); turn.add(head);
  const col = new THREE.Color();
  items.forEach((it, i) => { col.setHex(ORANGE).multiplyScalar(0.9 + 0.1 * ((i * 7) % 3) / 2); head.setColorAt(i, col); });
  const dm = new THREE.Object3D(), TH = H / N * 1.08;
  hal.add(head, 0xffd27a, 0.3, [0, 0.12, 0.08], 6.6);
  ctx.tap(head, () => toggleExplode());
  ctx.tap(halo, () => reprint());

  // ---- three tokens on the front edge
  const toks = [
    { w: 'STEM', c: '#e8873a', sub: 'علوم', title: 'حيث تبرز التقنية', body: 'تبرز التقنية تحديداً في تعليم العلوم والتكنولوجيا والهندسة والرياضيات، وفي التعليم الطبي وتدريب موظفي الشركات والبحوث.' },
    { w: 'VR', c: '#35b5a8', sub: 'افتراضي', title: 'أساس العالم الافتراضي', body: 'تُعدّ تقنية ثلاثية الأبعاد أساس العالم الافتراضي الذي يخدم العملية التعليمية التعلمية.' },
    { w: 'zSpace', c: '#8d6bd1', sub: 'مختبر', title: 'المختبر ثلاثي الأبعاد', body: 'مختبر zSpace STEM يتيح للطلاب التصوّر والتجربة والبناء بطرق غير ممكنة في بيئة الحوسبة التقليدية.' },
  ].map((T, i) => {
    const grp = new THREE.Group(); grp.position.set((i - 1) * 0.255, 0.044, 0.285); g.add(grp);
    const lean = new THREE.Group(); lean.rotation.x = -0.9; lean.position.y = 0.055; grp.add(lean);
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.014, 6), glossy(0xfbf7ee, { clearcoat: 0.5 })); body.rotation.x = Math.PI / 2; body.rotation.z = Math.PI / 6; lean.add(body);
    const rim = new THREE.Mesh(new THREE.CylinderGeometry(0.081, 0.081, 0.01, 6), goldMat()); rim.rotation.x = Math.PI / 2; rim.rotation.z = Math.PI / 6; rim.position.z = -0.005; lean.add(rim);
    const sc = screen(0.12, 0.12, 256); sc.draw((c, w, h) => {
      c.save(); c.translate(w / 2, h * 0.38); c.strokeStyle = T.c; c.fillStyle = T.c; c.lineWidth = 9; c.lineCap = 'round'; c.lineJoin = 'round';
      if (i === 0) { for (let k = 0; k < 3; k++) { c.save(); c.rotate(k * Math.PI / 3); c.beginPath(); c.ellipse(0, 0, 50, 19, 0, 0, TAU); c.stroke(); c.restore(); } c.beginPath(); c.arc(0, 0, 9, 0, TAU); c.fill(); }
      else if (i === 1) { c.beginPath(); c.roundRect(-46, -22, 92, 44, 16); c.stroke(); c.beginPath(); c.arc(-20, 0, 7, 0, TAU); c.arc(20, 0, 7, 0, TAU); c.fill(); c.beginPath(); c.moveTo(-46, -4); c.quadraticCurveTo(-60, -36, -30, -40); c.moveTo(46, -4); c.quadraticCurveTo(60, -36, 30, -40); c.stroke(); }
      else { c.beginPath(); c.moveTo(0, -42); c.lineTo(40, -20); c.lineTo(40, 24); c.lineTo(0, 46); c.lineTo(-40, 24); c.lineTo(-40, -20); c.closePath(); c.stroke(); c.beginPath(); c.moveTo(-40, -20); c.lineTo(0, 2); c.lineTo(40, -20); c.moveTo(0, 2); c.lineTo(0, 46); c.stroke(); }
      c.restore();
    });
    sc.mesh.position.z = 0.0075; sc.mesh.material.polygonOffset = true; sc.mesh.material.polygonOffsetFactor = -4; sc.mesh.material.polygonOffsetUnits = -4; lean.add(sc.mesh); sc.mesh.renderOrder = 6;
    const tag = sprite(T.sub, 0.16, { size: 92, color: '#2b2620', bg: 'rgba(255,251,242,.97)', border: T.c, radius: 30, pad: 14 }); tag.position.set(0, 0.035, 0.145); grp.add(tag);
    grp.scale.setScalar(1.55); shadowed(grp); rise.add(grp, 1.5 + i * 0.2, 0.1, 0.7);
    const hh = hal.add(lean, 0xffe0a0, 0.2, [0, 0, 0.03], 4.2);
    const s = { T, grp, lean, hh, seen: false, lift: 0 };
    ctx.tap(grp, () => { s.seen = true; s.lift = 1; ctx.sfx.click?.(); ctx.ui.card({ tag: 'ثلاثية الأبعاد', title: T.title, body: T.body, color: parseInt(T.c.slice(1), 16) }); check(); });
    return s;
  });

  let prog = 0, printing = true, startAt = 1.6, exploded = 0, expT = 0, now = 0, printedOnce = false, tappedHead = false, done = false;
  const spin = { v: 0, a: 0 }, tmpP = new THREE.Vector3(), tmpQ = new THREE.Vector3(), tmpD = new THREE.Vector3(), yAxis = new THREE.Vector3(0, 1, 0); let carAng = 0;
  function check() { if (!done && printedOnce && tappedHead && toks.every((s) => s.seen)) { done = true; setTimeout(() => { ctx.sfx.whoosh?.(); ctx.fx.burst(g.position.clone().add(new THREE.Vector3(0, 0.3, 0)), 0xffd27a, 50, 0.5, 0.04); ctx.ui.card({ tag: 'اكتمل المجسّم', title: 'من التصميم إلى الشيء', body: 'الأجسام ثلاثية الأبعاد تجعل المفهوم المجرّد شيئاً ملموساً في متناول المتعلم.', color: 0xff5f1f }); ctx.ui.done(); }, 1000); } }
  function toggleExplode() {
    if (now < 3 || printing) return; expT = expT ? 0 : 1; tappedHead = true; ctx.sfx.pop?.(); spin.v = 3;
    ctx.ui.hud(expT ? 'طبقة فوق طبقة' : 'مجسّم يمكن الدوران حوله');
    ctx.ui.card({ tag: 'مجسّم', title: expT ? 'طبقة فوق طبقة' : 'مجسّم يمكن الدوران حوله', body: 'رؤية الشيء من جميع جهاته بدل الاكتفاء بصورة مسطّحة، وهذا ما يجعل التقنية وسيلة بصرية مهمة في التعليم.', color: 0xff5f1f }); check();
  }
  function reprint() { if (printing || now < 3) return; prog = 0; printing = true; expT = 0; bed.rotation.y = 0; ctx.sfx.whoosh?.(); ctx.ui.hud('يُطبع من جديد'); ctx.ui.card({ tag: 'الطابعة', title: 'من التصميم إلى الشيء', body: 'الأجسام ثلاثية الأبعاد تجعل المفهوم المجرّد شيئاً ملموساً في متناول المتعلم.', color: 0x3d7bd8 }); }
  ctx.ui.hud('الطابعة تبني المجسّم');

  return {
    update(t, dt, e) {
      now = t; rise.update(t, e); hal.update(t, e); mo.update(t, dt, e);
      if (printing && t > startAt) { prog = Math.min(1, prog + dt / 5.6); if (prog >= 1) { printing = false; printedOnce = true; ctx.ui.hud('المس المجسّم'); ctx.sfx.good?.(); ctx.fx.burst(g.position.clone().add(new THREE.Vector3(0, 0.3, 0.05)), 0xffa060, 24, 0.3, 0.03); check(); } }
      exploded = THREE.MathUtils.damp(exploded, expT, 4, dt);
      const topY = prog * H;
      for (let i = 0; i < NI; i++) {
        const it = items[i]; const k = clamp01((prog * 1.0 - it.y) * N / 1.2 + 0.0); // grows in as the nozzle reaches it
        const kk = it.y <= prog ? 1 : (it.y <= prog + 0.02 ? 0.4 : 0);
        const full = clamp01((prog - it.y) * N * 1.0 + 0.6) * (it.y <= prog + 0.0001 ? 1 : 0);
        const vis = e * (prog >= 1 ? 1 : full);
        const yy = it.y * H * (1 + exploded * 0.55);
        dm.position.set(it.x, yy, it.z); dm.scale.set(Math.max(0.0001, it.ax * vis), Math.max(0.0001, TH * (1 - 0.55 * exploded) * vis), Math.max(0.0001, it.az * vis)); dm.rotation.set(0, 0, 0); dm.updateMatrix(); head.setMatrixAt(i, dm.matrix);
      }
      head.instanceMatrix.needsUpdate = true;
      head.material.emissiveIntensity = 0.1 + exploded * 0.25 + (printing ? 0.12 : 0);
      // turntable slowly turns; spins faster after a tap
      spin.v = THREE.MathUtils.damp(spin.v, 0, 1.4, dt); bed.rotation.y += dt * (printing ? 0.0 : 0.35 + spin.v * 2);
      // halo ring follows the print height, the nozzle rides it and the filament reaches the layer's rim
      const topNow = printing || prog < 1 ? topY : H * (1 + exploded * 0.55);
      const gy = 0.046 + 0.006 + Math.max(topNow, 0.001) + 0.03;
      halo.position.y = THREE.MathUtils.damp(halo.position.y || gy, gy, 8, dt);
      const [ax, az] = prof(Math.min(0.999, Math.max(0.02, prog)));
      const act = printing && t > startAt ? 1 : 0;
      const th = act ? t * 3.2 : t * 0.6; carAng = th;
      const R = 0.15; carriage.position.set(Math.cos(th) * R, 0, Math.sin(th) * R); carriage.rotation.y = -th + Math.PI / 2;
      // bed spins, so trace in bed-local coordinates, then draw the filament in halo space
      tmpP.set(Math.cos(th - bed.rotation.y) * (ax + 0.004), 0, Math.sin(th - bed.rotation.y) * (az + 0.004));
      const k1 = Math.cos(-bed.rotation.y), k2 = Math.sin(-bed.rotation.y);
      tmpP.set(Math.cos(th) * (ax + 0.004) , -0.014, Math.sin(th) * (az + 0.004));
      tmpQ.set(Math.cos(th) * R, -0.03, Math.sin(th) * R);
      fil.visible = act > 0; tmpD.subVectors(tmpP, tmpQ); const L = tmpD.length() || 1e-4; fil.position.lerpVectors(tmpQ, tmpP, 0.5); fil.scale.set(1, L, 1); fil.quaternion.setFromUnitVectors(yAxis, tmpD.divideScalar(L));
      tip.material.opacity = (act ? 0.9 : 0.25) * e; tip.scale.setScalar(0.07 + 0.02 * Math.sin(t * 20) * act);
      toks.forEach((s, i) => { s.lift = Math.max(0, s.lift - dt * 1.2); s.grp.position.y = 0.044 + Math.sin(Math.PI * Math.min(1, s.lift)) * 0.03; s.hh.on = s.seen ? 0.3 : 1; });
    },
  };
}
