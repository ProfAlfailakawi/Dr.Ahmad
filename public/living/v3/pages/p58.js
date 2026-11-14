import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { P, ease, easeBack, clamp01, stag, mat, glossy, goldMat, shadowed, glow, lightTube } from '../../kit.js?v=38';
import { animator, plinth, shadowBlob, V, TAU, softLight } from '../lib/a1-kit.js?v=38';
import { medal, bust, tweener } from '../lib/b1-kit.js?v=38';

export const meta = { free: true, center: [0.55, 0.62], typeLabel: 'مجسّم تفاعلي' };

const ORANGE = 0xf0702a, BLUE = 0x3a86e6, GREEN = 0x3fbf86, GOLD = 0xd4ad55;
const INFO = {
  goal: ['الهدف المسبق', 'من شروط التواصل التعليمي الناجح التحديد المسبق للهدف أو السببية.', GOLD],
  sender: ['المرسل', 'أحد عناصر التواصل التعليمي، وهو مصدر الرسالة.', ORANGE],
  medium: ['الأداة أو الوسيلة', 'القناة التي تُنقل بها الرسالة إلى المستقبل.', GOLD],
  message: ['الرسالة أو المحتوى', 'ما يُراد نقله من معرفة أو أفكار أو مهارات.', 0xe0a030],
  receiver: ['المستقبل', 'الطرف الذي تصل إليه الرسالة، وتتوقف دافعيته ورغبته على نجاح التواصل.', BLUE],
  response: ['رد الفعل', 'من شروط التواصل الناجح أن يستجيب المستقبل، وبه يُعرف أثر الرسالة.', GREEN],
};

export default function build(ctx) {
  const g = new THREE.Group(); g.position.copy(P(meta.center[0], meta.center[1])); ctx.stage.add(g);
  const A = animator(ctx, g, 1.0);
  const tw = tweener();
  g.add(Object.assign(shadowBlob(0.9, 0.4, 0.3)));
  

  const SX = 0.245;
  // sender & receiver busts on little gold pedestals
  const mk = (x, col, at) => {
    const grp = new THREE.Group(); grp.position.set(x, 0, 0.02);
    const ped = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.1, 0.03, 40), goldMat()); ped.position.y = 0.015;
    const b = bust(col, 0.34); b.position.y = 0.03;
    grp.add(ped, b); shadowed(grp); A.add(grp, { at, dur: 0.8, rise: 0.12 }); return grp;
  };
  const sender = mk(-SX, ORANGE, 0.2), receiver = mk(SX, BLUE, 0.5);
  A.hint(sender, ORANGE, 0.12, 0.04); A.hint(receiver, BLUE, 0.12, 0.04);

  // goal: a target standing behind the sender
  const goal = new THREE.Group(); goal.position.set(-SX - 0.02, 0.62, -0.07);
  const gd = medal('target', GOLD, 0.07, { th: 0.014, upright: true, bg: '#fff8e8', fg: '#d98a1a' }); goal.add(gd);
  const gstem = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.14, 8), goldMat()); gstem.position.y = -0.1; goal.add(gstem);
  A.add(goal, { at: 0.9, dur: 0.8, rise: 0.1 }); A.hint(goal, GOLD, 0.085, 0, [0, 0, 0]);

  // the medium: a gold ring gate at the top of the arc
  const gate = new THREE.Group(); gate.position.set(0, 0.57, 0.02);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.085, 0.014, 14, 56), goldMat()); ring.rotation.y = Math.PI / 2;
  const ring2 = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.006, 10, 48), new THREE.MeshStandardMaterial({ color: 0x9ff3ea, emissive: 0x22b5a8, emissiveIntensity: 0.9 })); ring2.rotation.y = Math.PI / 2;
  const ggl = glow(0x22b5a8, 0.2, 0.5); gate.add(ring, ring2, ggl);
  const legs = [-1, 1].forEach((s) => { const l = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.2, 8), goldMat()); l.position.set(0, -0.14, s * 0.05); gate.add(l); });
  A.add(gate, { at: 1.1, dur: 0.8, rise: 0.12 }); A.hint(gate, 0x22b5a8, 0.09, 0, [0, Math.PI / 2, 0]);

  // rails: upper arc (message) + lower return arc (response)
  
  const upper = new THREE.QuadraticBezierCurve3(V(-SX, 0.42, 0.02), V(0, 0.72, 0.02), V(SX, 0.42, 0.02));
  const lower = new THREE.QuadraticBezierCurve3(V(SX, 0.3, 0.06), V(0, 0.08, 0.2), V(-SX, 0.3, 0.06));
  const railU = lightTube(upper, { radius: 0.011, color: ORANGE, speed: 0.4 }), railL = lightTube(lower, { radius: 0.011, color: GREEN, speed: -0.4 });
  g.add(railU, railL); railU.userData.fill(0); railL.userData.fill(0);

  // the message (sealed letter) and the response (green spark)
  const msg = new THREE.Group();
  const env = new THREE.Mesh(new RoundedBoxGeometry(0.075, 0.048, 0.016, 3, 0.006), new THREE.MeshStandardMaterial({ color: 0xfff1d0, emissive: 0xffa43a, emissiveIntensity: 0.5, roughness: 0.4 }));
  const seal = new THREE.Mesh(new THREE.SphereGeometry(0.011, 14, 10), glossy(0xe0402a)); seal.position.z = 0.009;
  const mg = glow(0xffa43a, 0.17, 0.7); msg.add(env, seal, mg); msg.visible = false; g.add(msg);
  const rsp = new THREE.Group();
  const rc = new THREE.Mesh(new THREE.SphereGeometry(0.022, 20, 14), new THREE.MeshStandardMaterial({ color: 0xdfffee, emissive: GREEN, emissiveIntensity: 1 }));
  rsp.add(rc, glow(GREEN, 0.15, 0.8)); rsp.visible = false; g.add(rsp);

  // the receiver's motivation bulb
  const bulb = new THREE.Group(); bulb.position.set(SX, 0.58, 0.02);
  const bb = new THREE.Mesh(new THREE.SphereGeometry(0.03, 20, 14), new THREE.MeshStandardMaterial({ color: 0xfff6d6, emissive: 0xffd27a, emissiveIntensity: 0, roughness: 0.15 }));
  const bcap = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.017, 0.02, 14), goldMat()); bcap.position.y = -0.035;
  const bgl = glow(0xffd27a, 0.001, 0); bulb.add(bb, bcap, bgl); g.add(bulb);

  A.tag('المرسل', 0, ORANGE, V(-SX, 0.0, 0.2), { at: 2.4 });
  A.tag('المستقبل', 0, BLUE, V(SX, 0.0, 0.2), { at: 2.6 });

  const seen = new Set(); let flight = null, busy = false, lastAuto = 0, bulbOn = 0, railOn = 0;
  const see = (k) => {
    const [title, body, col] = INFO[k];
    ctx.ui.card({ tag: 'عناصر التواصل', title, body, color: col }); seen.add(k);
    ctx.ui.hud(seen.size < 6 ? `${seen.size} من ٦ عناصر` : 'اكتمل التواصل');
    if (seen.size === 6) setTimeout(() => ctx.ui.done(), 1400);
  };
  const send = () => {
    if (busy) return; busy = true; railOn = 1; msg.visible = true; ctx.sfx.whoosh?.();
    tw.go(2.6, (k) => {
      const e = ease(k); upper.getPoint(e, msg.position); msg.rotation.z = Math.sin(k * 8) * 0.12;
      const gp = Math.exp(-Math.pow((k - 0.5) * 6, 2)); ring.scale.setScalar(1 + gp * 0.25); ggl.scale.setScalar(0.2 + gp * 0.25);
    }, 0, () => {
      msg.visible = false; bulbOn = 1; ctx.fx.burst(V(SX, 0.42, 0.02).add(g.position), BLUE, 18, 0.3, 0.03); ctx.sfx.good?.();
      tw.go(0.001, () => {}, 0.7, () => respond());
    });
  };
  const respond = () => {
    rsp.visible = true;
    tw.go(2.2, (k) => { lower.getPoint(ease(k), rsp.position); }, 0, () => { rsp.visible = false; ctx.fx.burst(V(-SX, 0.3, 0.06).add(g.position), GREEN, 14, 0.25, 0.03); busy = false; lastAuto = A.now; });
  };
  A.touch(sender, () => { see('sender'); send(); }, { color: ORANGE });
  A.touch(receiver, () => { see('receiver'); bulbOn = 1; if (!busy) respond(); see('response'); }, { color: BLUE });
  A.touch(gate, () => see('medium'), { color: 0x22b5a8 });
  A.touch(goal, () => see('goal'), { color: GOLD });
  ctx.tap(msg, () => see('message'));
  ctx.ui.hud('المس المرسل ليرسل');

  return {
    update(t, dt, e) {
      A.update(t, dt, e); tw.update(dt);
      const R = clamp01((t - 1.8) / 1.4); railU.userData.fill(R); railL.userData.fill(R); railU.userData.update(dt); railL.userData.update(dt);
      goal.rotation.y = Math.sin(t * 0.8) * 0.4; goal.position.y = 0.62 + Math.sin(t * 1.4) * 0.008;
      ggl.scale.setScalar(Math.max(ggl.scale.x - dt * 0.2, 0.2) || 0.2);
      ring2.rotation.x = t * 0.9;
      bulbOn = Math.max(0, bulbOn - dt * 0.35);
      bb.material.emissiveIntensity = bulbOn * 1.6; bgl.scale.setScalar(0.001 + bulbOn * 0.2); bgl.material.opacity = bulbOn * 0.9;
      bulb.position.y = 0.6 + Math.sin(t * 2) * 0.004;
      if (t > 4.2 && !busy && t - lastAuto > 7 && !seen.size) { lastAuto = t; send(); }
      if (msg.visible && ctx.sfx) msg.scale.setScalar(1 + Math.sin(t * 6) * 0.04);
    },
  };
}
