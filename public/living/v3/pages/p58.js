import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { P, ease, easeBack, clamp01, stag, mat, glossy, goldMat, shadowed, glow, lightTube } from '../../kit.js?v=15';
import { animator, shadowBlob, V, TAU } from '../lib/a1-kit.js?v=15';

export const meta = { free: true, center: [0.55, 0.62], typeLabel: 'مجسّم تفاعلي' };

const ORANGE = 0xf0702a, BLUE = 0x2d7fe0, GOLD = 0xd4ad55, GREEN = 0x3fae7a;

export default function build(ctx) {
  const g = new THREE.Group(); g.position.copy(P(meta.center[0], meta.center[1])); ctx.stage.add(g);
  const A = animator(ctx, g, 0.95);
  const sh = shadowBlob(0.95, 0.5, 0.3); g.add(sh);

  // two big glass heads in profile, a glowing mind inside each, facing each other
  const minds = [], glows = [];
  const head = (x, color, dir) => {
    const b = new THREE.Group(); b.position.set(x, 0.0, 0.0);
    const body = glossy(color, { roughness: 0.28 });
    const glass = new THREE.MeshPhysicalMaterial({ color, roughness: 0.08, transparent: true, opacity: 0.42, clearcoat: 1, depthWrite: false });
    const tp = [[0.001, 0], [0.12, 0.004], [0.1, 0.03], [0.06, 0.075], [0.035, 0.1]].map(([a, c]) => new THREE.Vector2(a, c));
    const torso = new THREE.Mesh(new THREE.LatheGeometry(tp, 36), body); torso.scale.set(1.15, 1, 0.7);
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.04, 0.06, 20), body); neck.position.y = 0.13;
    const skull = new THREE.Mesh(new THREE.SphereGeometry(0.1, 40, 28), glass); skull.position.set(0, 0.25, 0); skull.scale.set(1.05, 1.0, 0.92); skull.renderOrder = 3;
    const jaw = new THREE.Mesh(new THREE.SphereGeometry(0.06, 28, 20), body); jaw.position.set(dir * 0.04, 0.185, 0); jaw.scale.set(1.0, 0.8, 0.85);
    const nose = new THREE.Mesh(new THREE.ConeGeometry(0.018, 0.045, 16), body); nose.rotation.z = -dir * Math.PI / 2; nose.position.set(dir * 0.108, 0.225, 0);
    const mind = new THREE.Mesh(new THREE.IcosahedronGeometry(0.058, 1), new THREE.MeshBasicMaterial({ color, wireframe: true, transparent: true, opacity: 0.95, toneMapped: false })); mind.position.set(-dir * 0.005, 0.26, 0);
    const core = new THREE.Mesh(new THREE.SphereGeometry(0.026, 16, 12), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9, toneMapped: false })); core.position.copy(mind.position);
    const gl = glow(color, 0.34, 0.5); gl.position.copy(mind.position);
    b.add(torso, neck, jaw, nose, mind, core, gl, skull); minds.push(mind); glows.push(gl); b.userData.mind = mind; b.userData.gl = gl;
    return shadowed(b);
  };
  const sender = head(-0.23, ORANGE, 1), receiver = head(0.23, BLUE, -1);
  A.add(sender, { at: 0.15, dur: 0.8, rise: 0.15 }); A.add(receiver, { at: 0.3, dur: 0.8, rise: 0.15 });

  // the medium: a rainbow of light from mind to mind with a golden gate at the crown
  const out = new THREE.QuadraticBezierCurve3(V(-0.17, 0.3, 0), V(0, 0.7, 0), V(0.17, 0.3, 0));
  const tube = lightTube(out, { radius: 0.013, color: 0xffffff, speed: 0.55 }); g.add(tube);
  const railGeo = new THREE.TubeGeometry(out, 80, 0.0075, 10), cols = [], pos = railGeo.attributes.position, c1 = new THREE.Color(ORANGE), c2 = new THREE.Color(BLUE), cc = new THREE.Color();
  for (let i = 0; i < pos.count; i++) { cc.copy(c1).lerp(c2, clamp01((pos.getX(i) + 0.17) / 0.34)); cols.push(cc.r, cc.g, cc.b); }
  railGeo.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
  const rail = new THREE.Mesh(railGeo, new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false })); g.add(rail); const railN = railGeo.index.count;
  const back = new THREE.QuadraticBezierCurve3(V(0.17, 0.14, 0.09), V(0, 0.08, 0.34), V(-0.17, 0.14, 0.09));
  const tube2 = lightTube(back, { radius: 0.009, color: 0xb6f5d2, speed: 0.4 }); g.add(tube2);
  const rail2 = new THREE.Mesh(new THREE.TubeGeometry(back, 60, 0.0048, 8), new THREE.MeshBasicMaterial({ color: GREEN, toneMapped: false })); g.add(rail2);
  const gate = new THREE.Group(); gate.position.copy(out.getPoint(0.5)); gate.rotation.y = Math.PI / 2;
  gate.add(new THREE.Mesh(new THREE.TorusGeometry(0.075, 0.011, 16, 60), goldMat()), new THREE.Mesh(new THREE.TorusGeometry(0.055, 0.004, 8, 48), goldMat()));
  A.add(gate, { at: 0.9, dur: 0.8, rise: 0.1 }); A.hint(gate, GOLD, 0.095, 0, [0, 0, 0]);

  // the goal: a big target behind the sender
  const goal = new THREE.Group(); goal.position.set(-0.23, 0.01, -0.2); goal.rotation.x = -0.9;
  [[0.085, 0xffffff], [0.065, ORANGE], [0.045, 0xffffff], [0.025, ORANGE]].forEach(([r, c], i) => { const d = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 0.006, 40), mat(c, { roughness: 0.4 })); d.rotation.x = Math.PI / 2; d.position.z = i * 0.002; goal.add(d); });
  const dart = new THREE.Mesh(new THREE.ConeGeometry(0.008, 0.09, 12), goldMat()); dart.rotation.x = -Math.PI / 2; dart.position.z = 0.04; goal.add(dart);
  goal.position.y = 0.1; A.add(shadowed(goal), { at: 1.1, dur: 0.7, rise: 0.1 }); A.hint(goal, ORANGE, 0.11, 0.0, [0, 0, 0]);

  // the message: an envelope in a glow
  const msg = new THREE.Group();
  const env = new THREE.Mesh(new RoundedBoxGeometry(0.095, 0.062, 0.012, 2, 0.005), glossy(0xfffbf0)); env.rotation.z = 0.1;
  const flap = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.03, 3), glossy(0xffc15a)); flap.rotation.set(Math.PI / 2, 0, Math.PI); flap.position.set(0, 0.012, 0.007); flap.scale.set(1, 1, 0.3);
  msg.add(env, flap, glow(0xffc15a, 0.26, 0.9));
  msg.userData.keepY = true; A.add(msg, { at: 1.3, dur: 0.5, rise: 0 }); A.hint(msg, 0xffc15a, 0.07, 0, [0, 0, 0]);

  A.tag('المرسل', 0, ORANGE, V(-0.23, 0.0, 0.15), { at: 1.4 });
  A.tag('المستقبل', 0, BLUE, V(0.23, 0.0, 0.15), { at: 1.5 });
  A.tag('الوسيلة', 0, GOLD, V(0, 0.55, 0.0), { at: 1.6 });

  const seen = new Set();
  const card = (tag, title, body, color, key) => { ctx.ui.card({ tag, title, body, color }); seen.add(key); ctx.ui.hud(`اكتشفت ${['٠', '١', '٢', '٣', '٤', '٥'][seen.size]} من ٥`); if (seen.size >= 5) ctx.ui.done(); };
  let launchAt = 1.8;
  A.touch(sender, () => { launchAt = A.now; card('عنصر', 'المرسل', 'أحد عناصر التواصل التعليمي، وهو مصدر الرسالة.', ORANGE, 's'); }, { color: ORANGE });
  A.touch(receiver, () => card('عنصر', 'المستقبل', 'الطرف الذي تصل إليه الرسالة، وتتوقف دافعيته ورغبته على نجاح التواصل.', BLUE, 'r'), { color: BLUE });
  A.touch(gate, () => card('عنصر', 'الأداة أو الوسيلة', 'القناة التي تُنقل بها الرسالة إلى المستقبل.', GOLD, 'm'), { color: GOLD });
  A.touch(msg, () => card('عنصر', 'الرسالة أو المحتوى', 'ما يُراد نقله من معرفة أو أفكار أو مهارات.', 0xffc15a, 'c'), { color: 0xffc15a });
  A.touch(goal, () => card('شرط', 'الهدف المسبق', 'من شروط التواصل التعليمي الناجح التحديد المسبق للهدف.', ORANGE, 'g'), { color: ORANGE });
  ctx.ui.hud('المس عناصر التواصل');

  const pt = new THREE.Vector3(), CYC = 8.5;
  return {
    update(t, dt, e) {
      A.update(t, dt, e); sh.material.opacity = 0.3 * e;
      const fp = stag(t, 0.5, 1.2, clamp01); tube.userData.fill(fp); rail.geometry.setDrawRange(0, Math.floor(railN / 6 * fp) * 6); tube2.userData.fill(stag(t, 1.2, 1.2, clamp01)); tube.userData.update(dt); tube2.userData.update(dt);
      const c = t - launchAt; let o = 0, b = 0; const k = c >= 0 ? c % CYC : -1;
      if (k >= 0) { if (k < 3.0) o = k / 3.0; else if (k < 4.0) o = 1; else if (k < 6.4) b = (k - 4.0) / 2.4; }
      const out_ = k >= 0 && k < 4.0, ret = k >= 4.0 && k < 6.4;
      msg.visible = (out_ || ret) && t > 1.5;
      if (out_) { out.getPoint(ease(o), pt); msg.position.copy(pt); } if (ret) { back.getPoint(ease(b), pt); msg.position.copy(pt); }
      msg.rotation.y = Math.sin(t * 2) * 0.4;
      const rl = out_ && o > 0.9, sl = ret && b > 0.85;
      receiver.userData.gl.material.opacity = THREE.MathUtils.damp(receiver.userData.gl.material.opacity, rl ? 1 : 0.4, 6, dt);
      sender.userData.gl.material.opacity = THREE.MathUtils.damp(sender.userData.gl.material.opacity, sl || (c >= 0 && c < 0.6) ? 1 : 0.4, 6, dt);
      minds[0].rotation.y = t * 0.9; minds[1].rotation.y = -t * 0.9; minds[1].scale.setScalar(1 + (rl ? 0.3 : 0) + Math.sin(t * 3) * 0.04); minds[0].scale.setScalar(1 + (sl ? 0.3 : 0) + Math.sin(t * 3 + 1) * 0.04);
      goal.rotation.z = Math.sin(t * 0.8) * 0.1;
    },
  };
}
