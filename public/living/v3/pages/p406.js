import * as THREE from 'three';
import { mat, glossy, goldMat, shadowed, glow, stag, ease, easeBack, clamp01, label } from '../../kit.js?v=17';
import { scene, RoundedBox, TAU, person2, contactShadow } from '../lib/a8-kit.js?v=17';
export const meta = { free: true, center: [0.6, 0.444], typeLabel: 'لعبة قرارات' };
const GL = (c, i = 1) => new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: i, roughness: 0.3 });
const hex = (c) => '#' + c.toString(16).padStart(6, '0');
const R = [
  { hud: 'فريق يتعثر وآخرون ينتظرون التحدي', o: [
    ['أعدّل أساليبي', 2, 'هذا هو المبدأ الأول: المعلم مسؤول عن تيسير حصول جميع الطلاب على المعرفة.'],
    ['أواصل الخطة', 0, 'المعلم الفعّال يغيّر ممارساته وأساليبه في ضوء ميول الطلاب وقدراتهم وخلفياتهم، لا في ضوء الجدول وحده.'],
    ['أبسّط للجميع', 1, 'تبسيط شامل يعالج جانباً واحداً ويهمل حاجة المتفوقين وفروق الخلفيات.'] ] },
  { hud: 'المتعثرون يخلطون بين مفهومين', o: [
    ['ملخص للحفظ', 1, 'الملخص يخفف الأعراض لكنه لا يبني الفهم ولا يعلّمهم تحديد مشكلاتهم.'],
    ['أعيد الشرح', 0, 'الإعادة الحرفية لا تعالج جذر الخلط في المفاهيم السابقة.'],
    ['مسارات متعددة', 2, 'المعلم يعرف المعرفة التي يجلبها الطلاب معهم، ويخلق مسارات متعددة للمعرفة.'] ] },
  { hud: 'اجتماع أولياء الأمور يقترب', o: [
    ['شواهد متنوعة للنمو', 2, 'هذا يجمع القياس المتعدد وشرح الأوضاع للآباء والتعاون معهم.'],
    ['حديث عام', 1, 'الحديث العام لا يفسّر وضع كل طالب ولا يفتح باب التعاون مع الأسرة.'],
    ['درجة الاختبار فقط', 0, 'المعلمون يستخدمون طرقاً عديدة لقياس نمو الطالب، لا مقياساً واحداً.'] ] },
];
const SC = [0xd9544b, 0xf0a32e, 0x35b97a];
const SCN = ['اجتهاد يحتاج مراجعة', 'قرار مقبول', 'قرار فعّال'];


export default function build(ctx) {
  const S = scene(ctx, meta), g0 = S.g; const g = new THREE.Group(); g.scale.setScalar(0.88); g0.add(g);
  const sh0 = contactShadow(0.9, 0.6, 0.35); sh0.position.set(0, 0.0015, -0.05); g.add(sh0);
  // ---- a classroom as an open box: wooden floor, teal back and side walls
  const room = new THREE.Group(); g.add(room);
  const floor = new THREE.Mesh(new RoundedBox(0.74, 0.03, 0.5, 0.012), glossy(0xc58a52, { roughness: 0.4, clearcoat: 0.5 })); floor.position.set(0, 0.015, -0.03); room.add(floor);
  for (let i = -3; i <= 3; i++) { const l = new THREE.Mesh(new THREE.BoxGeometry(0.0015, 0.0008, 0.46), mat(0x9b6a3a)); l.position.set(i * 0.1, 0.0305, -0.03); room.add(l); }
  const back = new THREE.Mesh(new RoundedBox(0.74, 0.36, 0.024, 0.01), mat(0x86cfcb)); back.position.set(0, 0.21, -0.27); room.add(back);
  const side = new THREE.Mesh(new RoundedBox(0.024, 0.36, 0.5, 0.01), mat(0x70bdb9)); side.position.set(-0.37, 0.21, -0.03); room.add(side);
  const trim = new THREE.Mesh(new THREE.BoxGeometry(0.74, 0.012, 0.03), goldMat()); trim.position.set(0, 0.395, -0.27); room.add(trim);
  const base1 = new THREE.Mesh(new THREE.BoxGeometry(0.74, 0.02, 0.012), glossy(0xf6efdf)); base1.position.set(0, 0.04, -0.255); room.add(base1);
  // clock, window, shelf, framed pictures
  const clock = new THREE.Group(); clock.position.set(-0.24, 0.3, -0.255); room.add(clock);
  const cf = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.01, 36), mat(0xfbf6ea)); cf.rotation.x = Math.PI / 2; clock.add(cf);
  const cr = new THREE.Mesh(new THREE.TorusGeometry(0.052, 0.007, 8, 36), glossy(0x4a9fe0)); clock.add(cr);
  const hand = new THREE.Mesh(new THREE.BoxGeometry(0.004, 0.036, 0.003), mat(0x2b2620)); hand.position.set(0, 0.014, 0.007); hand.geometry.translate(0, 0.0, 0); clock.add(hand);
  const win = new THREE.Group(); win.position.set(0.25, 0.26, -0.254); room.add(win);
  win.add(new THREE.Mesh(new RoundedBox(0.13, 0.15, 0.012, 0.008), glossy(0xf6efdf)));
  const wp = new THREE.Mesh(new THREE.PlaneGeometry(0.11, 0.13), GL(0xffe08a, 0.7)); wp.position.z = 0.0068; win.add(wp);
  [[0, 0.13], [0.11, 0]].forEach(([w, h], k) => { const bar = new THREE.Mesh(new THREE.BoxGeometry(w || 0.004, h || 0.004, 0.003), mat(0xf6efdf)); bar.position.z = 0.009; win.add(bar); });
  const shelf = new THREE.Group(); shelf.position.set(-0.02, 0.32, -0.245); room.add(shelf);
  shelf.add(new THREE.Mesh(new RoundedBox(0.24, 0.01, 0.04, 0.004), glossy(0x8a5a38)));
  [0xd9544b, 0x3b8fe0, 0xf6c026, 0x7ac143, 0x8a5ad8, 0xe0527f, 0x3b8fe0].forEach((c, i) => { const b = new THREE.Mesh(new RoundedBox(0.018, 0.05 + (i % 3) * 0.01, 0.03, 0.003), glossy(c)); b.position.set(-0.09 + i * 0.026, 0.03 + (i % 3) * 0.005, 0); shelf.add(b); });
  [[0x4aae5a, 0xf29a2e, -0.08], [0xf6c026, 0x3b8fe0, 0.08]].forEach(([c1, c2, x], i) => { const fr = new THREE.Group(); fr.position.set(x - 0.02, 0.17, -0.256); room.add(fr); fr.add(new THREE.Mesh(new RoundedBox(0.1, 0.085, 0.01, 0.005), glossy(0xf6efdf))); const pi = new THREE.Mesh(new THREE.PlaneGeometry(0.086, 0.07), GL(c1, 0.35)); pi.position.z = 0.0058; fr.add(pi); const sh = new THREE.Mesh(new THREE.ConeGeometry(0.014, 0.034, 3), GL(c2, 0.5)); sh.position.set(0, -0.004, 0.009); fr.add(sh); });
  const gt = new THREE.Group(); gt.position.set(0.3, 0.03, -0.2); room.add(gt);
  const gtt = new THREE.Mesh(new RoundedBox(0.09, 0.012, 0.09, 0.005), glossy(0x8a5a38)); gtt.position.y = 0.075; gt.add(gtt);
  [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([a, b]) => { const l = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.005, 0.07, 6), glossy(0x8a5a38)); l.position.set(a * 0.036, 0.035, b * 0.036); gt.add(l); });
  const globe = new THREE.Mesh(new THREE.SphereGeometry(0.034, 24, 16), glossy(0x3b8fe0)); globe.position.y = 0.123; gt.add(globe);
  const gring = new THREE.Mesh(new THREE.TorusGeometry(0.04, 0.002, 6, 36), goldMat()); gring.position.y = 0.123; gring.rotation.set(0.4, 0, 0.4); gt.add(gring);
  shadowed(room); S.part(room, 0.1, { rise: 0.1 });

  // string lights along the top of the back wall: the score
  const bulbs = []; const wire = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([-0.34, -0.2, -0.06, 0.06, 0.2, 0.34].map((x, i) => new THREE.Vector3(x, 0.375 - Math.sin(i * 1.25) * 0.012, -0.255))), 30, 0.0012, 4), mat(0x2b2620)); g.add(wire);
  for (let i = 0; i < 6; i++) {
    const x = -0.3 + i * 0.12;
    const b = new THREE.Mesh(new THREE.SphereGeometry(0.0165, 14, 10), new THREE.MeshStandardMaterial({ color: 0xd8d2c4, emissive: 0xffd27a, emissiveIntensity: 0, roughness: 0.3 })); b.position.set(x, 0.352, -0.25); g.add(b);
    const h = glow(0xffd27a, 0.14, 0); h.position.copy(b.position); g.add(h);
    bulbs.push({ b, h, on: 0 });
  }

  // ---- teacher on a stool reading, children on cushions listening
  const stool = new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.042, 0.05, 24), glossy(0x8a5a38)); stool.position.set(0.0, 0.055, -0.14); g.add(shadowed(stool));
  const teacher = person2({ body: 0xe0527f, trousers: 0x3a4a8a, hair: 0xb8462a, long: true, s: 1.35, seated: true }); teacher.position.set(0, 0.08, -0.16); teacher.rotation.y = 0; g.add(teacher); S.part(teacher, 0.5, { rise: 0.1 });
  const tu = teacher.userData; tu.armL.rotation.set(-0.95, 0, -0.35); tu.armR.rotation.set(-0.95, 0, 0.35); tu.armL.userData.elbow.rotation.x = -0.9; tu.armR.userData.elbow.rotation.x = -0.9;
  const book = new THREE.Mesh(new RoundedBox(0.075, 0.008, 0.055, 0.003), glossy(0xf6efdf)); book.position.set(0, 0.18, -0.085); book.rotation.x = -0.9; g.add(book);
  const apple = new THREE.Mesh(new THREE.SphereGeometry(0.013, 12, 10), glossy(0xd9344b)); apple.position.set(0.075, 0.085, -0.14); g.add(apple);
  const KC = [[-0.17, 0xf0a32e, 0xe3b894, 0x2a211c], [0.0, 0x35b97a, 0x8a5a3a, 0x1c1713], [0.17, 0x4a9fe0, 0xc78d63, 0x6b3a1c]];
  const kids = KC.map(([x, c, sk, hr], i) => {
    const grp = new THREE.Group(); grp.position.set(x, 0.03, 0.05 + (i === 1 ? 0.03 : 0)); g.add(grp);
    const cush = new THREE.Mesh(new THREE.CylinderGeometry(0.052, 0.052, 0.02, 28), glossy(c)); cush.position.y = 0.01; grp.add(cush);
    const p = person2({ body: c, trousers: 0x2b2f3a, skin: sk, hair: hr, long: i === 1, s: 0.95, seated: true }); p.position.y = 0.0; p.rotation.y = Math.PI; grp.add(p);
    S.part(grp, 0.8 + i * 0.25, { rise: 0.1 }); return { grp, p };
  });
  const ku = kids[0].p.userData; ku.armR.rotation.set(-2.75, 0, 0.15); // a raised hand

  // ---- three decision lanterns, a name plate under each (swapped each round)
  const lamps = [], LX = [-0.2, 0, 0.2];
  for (let k = 0; k < 3; k++) {
    const grp = new THREE.Group(); grp.position.set(LX[k], 0, 0.3); g.add(grp);
    const ped = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.04, 0.012, 24), goldMat()); ped.position.y = 0.006; grp.add(ped);
    const stalk = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.007, 0.07, 8), goldMat()); stalk.position.y = 0.045; grp.add(stalk);
    const m = new THREE.MeshPhysicalMaterial({ color: 0xfff1d0, emissive: 0xffd27a, emissiveIntensity: 0.55, roughness: 0.1, transparent: true, opacity: 0.94, clearcoat: 1 });
    const ball = new THREE.Mesh(new THREE.SphereGeometry(0.052, 32, 22), m); ball.position.y = 0.125; grp.add(ball);
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.028, 0.014, 20), goldMat()); cap.position.y = 0.18; grp.add(cap);
    const h = glow(0xffd27a, 0.28, 0); h.position.y = 0.125; grp.add(h);
    shadowed(grp); S.part(grp, 1.4 + k * 0.25, { rise: 0.12 });
    lamps.push({ grp, ball, m, h, k, shake: -9, state: 0 });
  }
  const sets = R.map((r, ri) => r.o.map((o, k) => { const pl = label(o[0], 0.17, { size: 56, width: 520, weight: 800, border: '#d4ad55', pad: 18, radius: 20 }); pl.rotation.x = -1.0; pl.position.set(LX[k], 0.012, 0.37); pl.visible = ri === 0; g.add(pl); return pl; }));
  let round = 0, score = 0, locked = false;
  lamps.forEach((L) => {
    S.touch(L.grp, () => {
      if (locked || round >= R.length) return;
      const o = R[round].o[L.k], sc = o[1]; locked = true; score += sc;
      L.state = sc + 1; L.m.emissive.set(SC[sc]); L.m.color.set(0xffffff); L.m.emissiveIntensity = 1.0; L.h.material.color.set(SC[sc]); L.h.material.opacity = 0.7;
      sc === 0 ? ctx.sfx.bad?.() : ctx.sfx.good?.();
      S.burst(new THREE.Vector3(L.grp.position.x, 0.17, L.grp.position.z).multiplyScalar(0.88), SC[sc], 20 + sc * 10, 0.5);
      for (let i = 0; i < 6; i++) if (bulbs[i].on < 0.5 && i < score) bulbs[i].on = 0.5;
      ctx.ui.card({ tag: SCN[sc], title: o[0], body: o[2], color: SC[sc] });
      const lastR = round; round++;
      setTimeout(() => {
        sets[lastR].forEach((p) => { p.visible = false; });
        if (round < R.length) { sets[round].forEach((p) => { p.visible = true; }); lamps.forEach((l) => { l.state = 0; l.m.emissive.set(0xffd27a); l.m.emissiveIntensity = 0.55; l.m.color.set(0xfff1d0); l.h.material.opacity = 0; }); ctx.ui.hud(R[round].hud); locked = false; }
        else {
          ctx.ui.hud(score >= 5 ? 'قرارات معلم فعّال' : 'اكتملت القرارات');
          ctx.ui.card({ tag: 'خلاصة القرارات', title: `أضأتَ ${['صفر', 'مصباحاً', 'مصباحين', 'ثلاثة مصابيح', 'أربعة مصابيح', 'خمسة مصابيح', 'ستة مصابيح'][score]}`, body: score >= 5 ? 'جمعت قراراتك مبادئ المعلم الفعّال: تكييف الأساليب، ومسارات متعددة، وقياس متنوع لنمو الطلاب.' : 'كل قرار يضيء بقدر انسجامه مع مبادئ المعلم الفعّال؛ أعد المحاولة لتضيء المصابيح كلها.', color: 0xd4ad55 });
          ctx.ui.done();
        }
      }, 3200);
    }, { color: 0xffd27a, size: 0.34, at: new THREE.Vector3(0, 0.125, 0), wake: 3.2 });
  });
  ctx.ui.hud(R[0].hud);

  S.loop((t, dt, e) => {
    hand.rotation.z = -t * 0.5;
    tu.head.rotation.y = Math.sin(t * 0.6) * 0.3; book.rotation.x = -0.9 + Math.sin(t * 1.4) * 0.03;
    ku.armR.rotation.x = -2.75 + Math.sin(t * 3) * 0.14;
    kids.forEach((k, i) => { k.p.userData.head.rotation.y = Math.sin(t * 0.8 + i * 2) * 0.3; });
    globe.rotation.y = t * 0.6;
    lamps.forEach((L, i) => {
      L.ball.position.y = 0.125 + Math.sin(t * 1.8 + i * 1.7) * 0.006;
      if (L.state === 0) L.m.emissiveIntensity = 0.5 + 0.18 * Math.sin(t * 2.4 + i);
      L.grp.position.x = LX[i] + clamp01(1 - (t - L.shake) / 0.5) * Math.sin((t - L.shake) * 55) * 0.01;
    });
    bulbs.forEach((b, i) => { if (b.on > 0) b.on = Math.min(1, b.on + dt * 2); b.b.material.emissiveIntensity = b.on * (1.2 + 0.2 * Math.sin(t * 3 + i)); b.h.material.opacity = b.on * 0.6; b.b.material.color.set(b.on > 0.5 ? 0xfff0c0 : 0xd8d2c4); });
  });
  return { update: S.update };
}
