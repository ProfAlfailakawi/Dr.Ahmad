// Door two: a live, shared moment rises from the page on synchronous e-learning.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { P, ease, sprite, shadowed } from './kit.js?v=6';

const toAr = (n) => String(n).replace(/\d/g, (d) => '٠١٢٣٤٥٦٧٨٩'[d]);
const lightMat = (color, intensity = 0.25) => new THREE.MeshStandardMaterial({
  color, roughness: 0.28, metalness: 0.32, emissive: color, emissiveIntensity: intensity,
});

export function buildSynchronous(ctx) {
  const scene = new THREE.Group(); scene.position.copy(P(0.34, 0.47)); ctx.stage.add(scene);
  const gold = lightMat(0xe8bd65, 0.23);
  const cyan = lightMat(0x43c5e8, 0.35);
  const floorMat = new THREE.MeshStandardMaterial({ color: 0x263c55, metalness: 0.38, roughness: 0.3 });

  const makeClass = (side) => {
    const room = new THREE.Group(); scene.add(room);
    const floor = shadowed(new THREE.Mesh(new RoundedBoxGeometry(0.23, 0.013, 0.17, 2, 0.007), floorMat));
    floor.position.y = 0.008; room.add(floor);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.102, 0.003, 6, 24), side < 0 ? gold : cyan);
    rim.rotation.x = Math.PI / 2; rim.scale.z = 0.7; rim.position.y = 0.019; room.add(rim);
    const board = shadowed(new THREE.Mesh(new RoundedBoxGeometry(0.085, 0.055, 0.006, 2, 0.003), lightMat(side < 0 ? 0xe6ae55 : 0x48b9d1)));
    board.position.set(0, 0.072, -0.072); room.add(board);
    const students = [];
    for (const x of [-0.055, 0.055]) {
      const desk = shadowed(new THREE.Mesh(new RoundedBoxGeometry(0.07, 0.006, 0.034, 2, 0.003), gold));
      desk.position.set(x, 0.043, 0.025); room.add(desk);
      const body = shadowed(new THREE.Mesh(new THREE.CapsuleGeometry(0.011, 0.021, 3, 8), lightMat(side < 0 ? 0xf5cc81 : 0x78e4f4)));
      body.position.set(x, 0.05, 0.059); room.add(body);
      const head = shadowed(new THREE.Mesh(new THREE.SphereGeometry(0.013, 12, 10), lightMat(0xf4d7b0)));
      head.position.set(x, 0.082, 0.059); room.add(head); students.push({ body, head });
    }
    const name = sprite(side < 0 ? 'المعلّم' : 'الطلبة', 0.13, {
      size: 48, width: 340, weight: 800, bg: 'rgba(20,29,42,.92)', color: '#fff1cf',
    }); name.position.set(0, 0.145, -0.075); room.add(name);
    return { room, floor, board, students };
  };
  const teacher = makeClass(-1), learners = makeClass(1);

  const clock = new THREE.Group(); clock.position.y = 0.19; scene.add(clock);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.138, 0.004, 8, 64), gold); clock.add(ring);
  const ring2 = new THREE.Mesh(new THREE.TorusGeometry(0.111, 0.0015, 5, 64), cyan); clock.add(ring2);
  for (let i = 0; i < 12; i++) {
    const a = i * Math.PI / 6;
    const mark = new THREE.Mesh(new THREE.BoxGeometry(0.003, 0.015, 0.003), gold);
    mark.position.set(Math.sin(a) * 0.124, Math.cos(a) * 0.124, 0); mark.rotation.z = -a; clock.add(mark);
  }
  const hand = new THREE.Mesh(new THREE.BoxGeometry(0.003, 0.1, 0.002), cyan);
  hand.position.y = 0.05; clock.add(hand);
  const nowTag = sprite('الوقت نفسه', 0.14, { size: 52, width: 440, weight: 800,
    bg: 'rgba(20,29,42,.92)', color: '#ffe6a4' }); nowTag.position.set(0, 0.36, 0); scene.add(nowTag);

  const globe = new THREE.Group(); globe.position.set(0, 0.17, 0); scene.add(globe);
  const sphere = new THREE.Mesh(new THREE.SphereGeometry(0.083, 24, 18),
    new THREE.MeshPhysicalMaterial({ color: 0x78d8f2, metalness: 0.15, roughness: 0.18,
      transparent: true, opacity: 0.22, depthWrite: false, emissive: 0x1b9cc5, emissiveIntensity: 0.4 })); globe.add(sphere);
  const lines = new THREE.Mesh(new THREE.SphereGeometry(0.085, 16, 12),
    new THREE.MeshBasicMaterial({ color: 0x9ae8f8, wireframe: true, transparent: true, opacity: 0.42 })); globe.add(lines);
  const glow = new THREE.PointLight(0x66d9f5, 0.4, 0.9); globe.add(glow);

  const linkCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-0.17, 0.13, 0), new THREE.Vector3(-0.08, 0.25, 0),
    new THREE.Vector3(0, 0.28, 0), new THREE.Vector3(0.08, 0.25, 0),
    new THREE.Vector3(0.17, 0.13, 0),
  ]);
  const link = new THREE.Mesh(new THREE.TubeGeometry(linkCurve, 64, 0.0035, 8, false),
    new THREE.MeshBasicMaterial({ color: 0xffd486, transparent: true, opacity: 0 })); scene.add(link);
  const dots = Array.from({ length: 7 }, (_, i) => {
    const dot = new THREE.Mesh(new THREE.SphereGeometry(0.0045, 8, 8),
      new THREE.MeshBasicMaterial({ color: i % 2 ? 0xffe3a4 : 0x88e8fa, transparent: true, opacity: 0 }));
    scene.add(dot); return dot;
  });

  let phase = 0, phaseAt = 0, now = 0;
  const step = () => {
    phase += 1; phaseAt = now; ctx.sfx.good();
    if (phase === 1) {
      ctx.ui.hud('تباعد المكان… واتحد الوقت');
      ctx.ui.card({ tag: 'التعليم الإلكتروني المتزامن', title: 'حصة واحدة في الوقت نفسه',
        body: 'يلتقي المعلم والطلبة مباشرة عبر الشبكة، رغم تباعد المكان. هذا هو شرط التزامن الذي تصفه الصفحة.', color: 0x43c5e8 });
      ctx.ui.choices([{ label: 'أرسل سؤالًا', primary: true, onPick: step }]);
    } else if (phase === 2) {
      ctx.ui.hud('السؤال يعبر بين الفصلين الآن');
      ctx.ui.card({ tag: 'نقاش مباشر', title: 'الطلاب يسمعون السؤال معًا',
        body: 'تتيح الحصة المتزامنة نقاشًا مباشرًا بين المعلم والطلبة أو بين الطلبة أنفسهم.', color: 0xe8bd65 });
      ctx.ui.choices([{ label: 'شاهد الرد الفوري', primary: true, onPick: step }]);
    } else {
      ctx.ui.hud('وصلت التغذية الراجعة في اللحظة نفسها');
      ctx.ui.card({ tag: 'قوة التزامن', title: 'ردّ فوري رغم المسافة',
        body: 'تذكر الصفحة التغذية الراجعة الفورية ميزةً للتعلم المتزامن، مع حاجته إلى أجهزة حديثة واتصال جيد.', color: 0x43c5e8 });
      ctx.fx.burst(new THREE.Vector3(0, 0.2, 0).add(scene.position), 0x9ae8f8, 44, 0.5, 0.05);
      ctx.ui.done();
      ctx.ui.choices([{ label: '↻ عش اللحظة مجددًا', onPick: () => { phase = 0; phaseAt = now; ctx.ui.hud('فصلان متباعدان — المس لتبدأ الحصة'); ctx.ui.choices([{ label: '✦ ابدأ الحصة', primary: true, onPick: step }]); } }]);
    }
  };
  ctx.ui.hud('فصلان متباعدان — المس لتبدأ الحصة');
  ctx.ui.choices([{ label: '✦ ابدأ الحصة', primary: true, onPick: step }]);
  [teacher.floor, learners.floor, globe].forEach((o) => ctx.tap(o, () => ctx.ui.card({
    tag: 'من صفحة ٣٤١', title: 'التعليم الإلكتروني المتزامن',
    body: 'المعلم والطلبة في الوقت نفسه؛ نقاش مباشر وتغذية راجعة فورية.', color: 0x43c5e8,
  })));
  return {
    update(t, dt, e) {
      now = t;
      const rise = ease((t - 0.15) / 1) * e;
      scene.scale.setScalar(Math.max(0.001, rise));
      const join = phase ? ease((t - phaseAt) / 1) : 0;
      teacher.room.position.set(-0.25 + join * 0.08, 0.025 + join * 0.045, 0.065);
      learners.room.position.set(0.25 - join * 0.08, 0.025 + join * 0.045, 0.065);
      teacher.room.rotation.y = -0.2 + join * 0.2;
      learners.room.rotation.y = 0.2 - join * 0.2;
      globe.scale.setScalar(0.25 + join * 0.75);
      globe.rotation.y = t * 0.24;
      clock.scale.setScalar(0.25 + join * 0.75);
      clock.rotation.z = phase ? 0 : Math.sin(t * 0.8) * 0.06;
      hand.rotation.z = phase ? 0 : -t * 0.75;
      nowTag.material.opacity = join * e;
      link.material.opacity = phase ? 0.85 * e : 0;
      dots.forEach((dot, i) => {
        let p = (t * 0.35 + i / dots.length) % 1;
        if (phase === 3) p = 1 - p;
        dot.position.copy(linkCurve.getPoint(p)); dot.material.opacity = phase >= 2 ? 0.75 * e : 0;
      });
      glow.intensity = (0.4 + join * 1.3 + (phase >= 2 ? 0.5 : 0)) * e;
    },
  };
}
