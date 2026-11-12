// p245: escape the hall. A round vault door with four padlocks; three gem-keys at a time, only one opens the lock.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { P, ease, easeBack, clamp01, stag, mat, glossy, goldMat, shadowed, glow } from '../../kit.js?v=31';
import { rising, halos, liveTag, motes, blob, TAU, css } from '../lib/a4-kit.js?v=31';

export const meta = { free: true, center: [0.5, 0.68], typeLabel: 'لعبة هروب', title: 'اهرب من القاعة' };

const LOCKS = [
  { hud: 'تدرس مساءً وتعمل نهاراً: أي خاصية؟', keys: ['مرونة الوقت والمكان', 'إلقاء وإنصات', 'قاعات المحاضرات'], why: 'المرونة الشديدة تقدّم للمتعلم خيارات من حيث وقت التعلم ومكانه وحرية الاختيار بينها.', title: 'المرونة الشديدة' },
  { hud: 'منصة إلكترونية داخل القاعة: تعليم إلكتروني؟', keys: ['نعم، داخل الفصل', 'لا، تعليم تقليدي', 'لا، عن بعد فقط'], why: 'التعليم الإلكتروني معيار توظيف التقنية لا بُعد المكان، وقد يحدث داخل الفصل الدراسي.', title: 'ليس شرطاً أن يكون عن بعد' },
  { hud: '«يلغي المعلم»: ما الردّ الأدق؟', keys: ['منظّم لبيئة التعلم', 'الأدوات تكفي', 'ملقٍ ومنصت'], why: 'التعليم الإلكتروني لا يلغي دور المعلم، وإنما يوضح دوره منظّماً للبيئة التي تسهّل حدوث التعلم.', title: 'المعلم منظّم البيئة' },
  { hud: 'مهمة من مهام الإدارة الإلكترونية؟', keys: ['اختبارات وشهادات', 'تصنيع الأجهزة', 'تأليف المقررات'], why: 'تشمل الإدارة قبول الدارسين وتسجيلهم ودفع المصروفات وتقديم المحتوى ومتابعة التعلم وإدارة الاختبارات ومنح الشهادات.', title: 'الإدارة الإلكترونية' },
];
const GEM = [0x35b5a8, 0xe0453c, 0x3a86d6];
const R = 0.25;

function keyModel(gem) {
  const k = new THREE.Group();
  const head = new THREE.Mesh(new THREE.TorusGeometry(0.016, 0.0045, 10, 24), goldMat()); head.position.y = 0.04; k.add(head);
  const g = new THREE.Mesh(new THREE.SphereGeometry(0.0095, 16, 12), glossy(gem, { emissive: gem, emissiveIntensity: 0.55 })); g.position.y = 0.04; k.add(g);
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.0034, 0.0034, 0.058, 10), goldMat()); shaft.position.y = 0.0; k.add(shaft);
  [0.006, -0.004].forEach((y, i) => { const t = new THREE.Mesh(new THREE.BoxGeometry(0.012 + i * 0.004, 0.006, 0.004), goldMat()); t.position.set(0.007, -0.02 + y, 0); k.add(t); });
  k.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return k;
}

export default function build(ctx) {
  const g = new THREE.Group(); g.position.copy(P(meta.center[0], meta.center[1])); ctx.stage.add(g);
  const rise = rising(), hal = halos();
  const sh = blob(0.36, 0.34); sh.position.set(0, 0.0015, -0.04); sh.scale.set(0.8, 0.5, 1); g.add(sh);
  const mo = motes(g, 20, { r: 0.4, h: 0.55, color: 0xfff0c0 });

  // ---- the door stands upright at the back
  const DY = R + 0.05;
  const gate = new THREE.Group(); gate.position.set(0, DY - 0.02, -0.12); gate.rotation.x = -0.5; g.add(gate);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(R + 0.016, 0.017, 16, 64), goldMat()); gate.add(ring);
  const ring2 = new THREE.Mesh(new THREE.TorusGeometry(R + 0.016, 0.011, 12, 64), mat(0x5b4636)); ring2.position.z = -0.03; gate.add(ring2);
  const lightDisc = new THREE.Mesh(new THREE.CircleGeometry(R, 48), new THREE.MeshBasicMaterial({ color: 0xfff4cc, toneMapped: false, side: THREE.DoubleSide })); lightDisc.position.z = -0.02; gate.add(lightDisc);
  const flood = glow(0xffe6a0, 0.9, 0); flood.position.z = 0.0; gate.add(flood);
  // legs
  [-1, 1].forEach((s) => { const f = new THREE.Mesh(new RoundedBoxGeometry(0.07, 0.04, 0.16, 3, 0.01), mat(0x5b4636)); f.position.set(s * 0.14, -DY + 0.02 + 0.02, 0.0); gate.add(f); });
  const strut = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.02, 12), goldMat()); strut.position.y = -R - 0.02; gate.add(strut);
  // the door itself, hinged on its left edge
  const pivot = new THREE.Group(); pivot.position.x = -R; gate.add(pivot);
  const door = new THREE.Group(); door.position.x = R; pivot.add(door);
  const slab = new THREE.Mesh(new THREE.CylinderGeometry(R, R, 0.045, 64), mat(0x8f6d2c, { metalness: 0.75, roughness: 0.38 })); slab.rotation.x = Math.PI / 2; door.add(slab);
  [R * 0.86, R * 0.64].forEach((rr) => { const t = new THREE.Mesh(new THREE.TorusGeometry(rr, 0.0035, 8, 64), goldMat()); t.position.z = 0.018; door.add(t); const t2 = t.clone(); t2.position.z = -0.018; door.add(t2); });
  const hub = new THREE.Group(); hub.position.z = 0.03; door.add(hub);
  const hubC = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.014, 24), goldMat()); hubC.rotation.x = Math.PI / 2; hub.add(hubC);
  for (let i = 0; i < 6; i++) { const sp = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.09, 8), goldMat()); sp.position.set(Math.cos(i / 6 * TAU) * 0.045, Math.sin(i / 6 * TAU) * 0.045, 0.004); sp.rotation.z = i / 6 * TAU + Math.PI / 2; hub.add(sp); const kn = new THREE.Mesh(new THREE.SphereGeometry(0.008, 10, 8), goldMat()); kn.position.set(Math.cos(i / 6 * TAU) * 0.09, Math.sin(i / 6 * TAU) * 0.09, 0.004); hub.add(kn); }
  const hubR = new THREE.Mesh(new THREE.TorusGeometry(0.09, 0.004, 8, 40), goldMat()); hubR.position.z = 0.004; hub.add(hubR);
  hub.scale.setScalar(1.5); const wheelBack = hub.clone(); wheelBack.position.z = -0.03; wheelBack.rotation.y = Math.PI; door.add(wheelBack);
  shadowed(gate);
  rise.add(gate, 0.15, 0.3);

  // ---- four padlocks on the door
  const lockPos = [[-1, 1], [1, 1], [1, -1], [-1, -1]].map(([sx, sy]) => [sx * 0.14, sy * 0.14]);
  const locks = lockPos.map(([x, y], i) => {
    const grp = new THREE.Group(); grp.position.set(x, y, 0.03); grp.scale.setScalar(2.5); door.add(grp);
    const body = new THREE.Mesh(new RoundedBoxGeometry(0.04, 0.032, 0.016, 3, 0.005), mat(0x3a3f48, { metalness: 0.7, roughness: 0.35 })); grp.add(body);
    const sh = new THREE.Group(); sh.position.set(-0.011, 0.016, 0); grp.add(sh);
    const arch = new THREE.Mesh(new THREE.TorusGeometry(0.011, 0.0028, 8, 18, Math.PI), goldMat()); arch.position.x = 0.011; sh.add(arch);
    const led = new THREE.Mesh(new THREE.SphereGeometry(0.0045, 10, 8), new THREE.MeshBasicMaterial({ color: 0xe0453c, toneMapped: false })); led.position.set(0, -0.002, 0.0095); grp.add(led);
    const hl = glow(0xffd27a, 0.2, 0); hl.position.z = 0.015; grp.add(hl);
    return { grp, body, sh, led, hl, open: 0, openT: 0, wob: 0 };
  });

  // ---- three keys
  const slots = [-0.28, 0, 0.28].map((x, i) => {
    const grp = new THREE.Group(); grp.position.set(x, 0.12, 0.3); g.add(grp);
    const key = keyModel(GEM[i]); key.scale.setScalar(1.9); grp.add(key);
    const hl = hal.add(grp, GEM[i], 0.3, [0, 0.03, 0], 9999);
    const s = { grp, key, hl, home: new THREE.Vector3(x, 0.12, 0.3), state: 'off', k: 0, fly: 0, from: new THREE.Vector3(), opt: null, tag: liveTag(0.25, GEM[i], { size: 54, fixed: 1, style: 'solid' }), i };
    s.tag.set('مفتاح'); g.add(s.tag.sp); s.tag.sp.position.set(x, 0.27, 0.32); s.tag.apply(0);
    grp.visible = false;
    ctx.tap(grp, () => choose(s));
    return s;
  });

  let now = 0, phase = 'build', li = -1, tPhase = 0, chosen = null, finished = false, doorOpen = 0, order = [0, 1, 2];
  const tmp = new THREE.Vector3(), tgt = new THREE.Vector3(), wp = new THREE.Vector3();
  const lockWorld = (i) => { locks[i].grp.getWorldPosition(wp); g.worldToLocal(wp); return wp; };

  function startLock(i) {
    li = i; chosen = null; phase = 'choose'; tPhase = now; ctx.ui.hideCard(); ctx.ui.hud(LOCKS[i].hud);
    order = [0, 1, 2].sort(() => Math.random() - 0.5);
    slots.forEach((s, k) => { s.opt = { t: LOCKS[i].keys[order[k]], ok: order[k] === 0 }; s.tag.set(s.opt.t, GEM[k]); s.state = 'idle'; s.k = 0; s.grp.visible = true; s.grp.position.copy(s.home); s.grp.scale.setScalar(0.0001); s.fly = 0; });
  }
  function choose(s) {
    if (phase !== 'choose' || s.state !== 'idle' || now < 3.4) return;
    phase = 'react'; chosen = s; s.state = 'fly'; s.fly = 0; s.from.copy(s.grp.position); ctx.sfx.pop?.();
    if (s.opt.ok) slots.forEach((o) => { if (o !== s) o.state = 'fade'; });
  }
  function arrive(s) {
    if (s.opt.ok) {
      const L = locks[li]; L.openT = 1; ctx.sfx.good?.(); ctx.fx.burst(g.position.clone().add(lockWorld(li)), 0xffd27a, 26, 0.35, 0.03);
      ctx.ui.card({ tag: `القفل ${['الأول', 'الثاني', 'الثالث', 'الرابع'][li]} انفتح`, title: LOCKS[li].title, body: LOCKS[li].why, color: 0xd4ad55 });
      s.state = 'gone'; tPhase = now; phase = 'opened';
    }
  }
  function wrong(s) {
    ctx.sfx.bad?.(); ctx.ui.toast('ليس هذا المفتاح، جرّب غيره'); locks[li].wob = 1; ctx.fx.burst(g.position.clone().add(lockWorld(li)), 0xe0453c, 10, 0.2, 0.025);
    s.state = 'idle'; s.k = 1; phase = 'choose';
  }
  ctx.tap(gate, () => ctx.ui.card({ tag: 'قاعة التدريب الافتراضية', title: 'أربعة أقفال متتابعة', body: 'لكل قفل موقف يحتاج إلى فهم خصائص التعليم الإلكتروني.', color: 0xd4ad55 }));
  ctx.tap(hub, () => { hub.userData.spin = 1; ctx.sfx.click?.(); ctx.ui.hud(li >= 0 && li < 4 && phase !== 'done' ? LOCKS[li].hud : 'الباب مفتوح'); });
  ctx.ui.hud('أربعة أقفال لفتح الباب');

  return {
    update(t, dt, e) {
      now = t; rise.update(t, e); hal.update(t, e); mo.update(t, dt, e);
      if (phase === 'build' && t > 3.2) startLock(0);
      hub.rotation.z += dt * (0.2 + (hub.userData.spin || 0) * 4 + doorOpen * 2); hub.userData.spin = Math.max(0, (hub.userData.spin || 0) - dt * 1.5);
      wheelBack.rotation.z -= dt * 0.2;
      locks.forEach((L, i) => {
        L.open = THREE.MathUtils.damp(L.open, L.openT, 6, dt);
        L.sh.position.y = 0.016 + L.open * 0.009; L.sh.rotation.y = L.open * 2.4;
        L.body.material.color.setHex(L.open > 0.5 ? 0xd4ad55 : 0x3a3f48); L.led.material.color.setHex(L.open > 0.5 ? 0x4fd06a : 0xe0453c);
        const active = i === li && L.openT === 0 && phase !== 'build' && phase !== 'done';
        L.hl.material.opacity = (active ? 0.65 + 0.3 * Math.sin(t * 4) : 0) * e; L.hl.scale.setScalar(0.16 + (active ? 0.03 * Math.sin(t * 4) : 0));
        L.wob = Math.max(0, L.wob - dt * 2.5); L.grp.rotation.z = Math.sin(t * 50) * 0.18 * L.wob;
      });
      slots.forEach((s, i) => {
        if (s.state === 'idle') { s.k = Math.min(1, s.k + dt * 2.2); s.grp.position.set(s.home.x, s.home.y + Math.sin(t * 1.8 + i * 2) * 0.008, s.home.z); }
        if (s.state === 'fade' || s.state === 'gone') s.k = Math.max(0, s.k - dt * 3);
        if (s.state === 'fly') {
          s.fly = Math.min(1, s.fly + dt / (chosen && chosen.opt.ok ? 0.9 : 1.1)); tgt.copy(lockWorld(li));
          const f = s.opt.ok ? s.fly : (s.fly < 0.5 ? s.fly * 2 * 0.75 : (1 - s.fly) * 2 * 0.75);
          tmp.lerpVectors(s.from, tgt, ease(f)); tmp.y += Math.sin(Math.PI * Math.min(1, f)) * 0.07; s.grp.position.copy(tmp); s.k = 1;
          s.key.rotation.y += dt * 6;
          if (!s.opt.ok && s.fly > 0.5 && !s.hit) { s.hit = true; locks[li].wob = 1; ctx.sfx.bad?.(); }
          if (s.fly >= 1) { s.hit = false; s.opt.ok ? arrive(s) : wrong(s); }
        }
        s.grp.visible = s.state !== 'off' && (s.k > 0.01 || s.state === 'fly');
        s.grp.scale.setScalar(s.state === 'fly' ? 1 - s.fly * 0.35 * (s.opt.ok ? 1 : 0) : Math.max(0.0001, easeBack(s.k)));
        s.hl.on = s.state === 'idle' ? 1 : 0; if (s.state !== 'fly') s.key.rotation.y += dt * 0.9;
        s.tag.apply(s.state === 'idle' ? easeBack(s.k) * e : 0);
      });
      if (phase === 'opened' && t - tPhase > 4.2) { if (li < 3) startLock(li + 1); else if (!finished) { finished = true; phase = 'done'; ctx.ui.hideCard(); ctx.ui.hud('انفتح الباب'); ctx.sfx.whoosh?.(); setTimeout(() => { ctx.fx.burst(g.position.clone().add(new THREE.Vector3(0, 0.25, -0.05)), 0xffe6a0, 60, 0.6, 0.045); ctx.ui.card({ tag: 'خرجت من القاعة', title: 'فككت الأقفال الأربعة', body: 'بنيت خصائص التعليم الإلكتروني بنفسك قطعةً بعد قطعة.', color: 0xd4ad55 }); ctx.ui.done(); }, 1500); } }
      doorOpen = THREE.MathUtils.damp(doorOpen, finished ? 1 : 0, 1.6, dt);
      pivot.rotation.y = -1.75 * ease(doorOpen);
      flood.material.opacity = doorOpen * 0.75 * e * (0.85 + 0.15 * Math.sin(t * 3)); flood.scale.setScalar(0.5 + doorOpen * 0.7);
      lightDisc.material.color.setHex(0xfff4cc);
    },
  };
}
