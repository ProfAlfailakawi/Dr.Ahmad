// Three new pages: safe simulation, binocular depth and the learner's bag.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { P, ease, sprite, shadowed } from './kit.js?v=6';

const ink = (c, glow = 0) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.34, metalness: 0.22, emissive: c, emissiveIntensity: glow });
const block = (w, h, d, material, r = 0.01) => shadowed(new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 3, r), material));
const tag = (text, w = 0.18, color = '#fff5dd') => sprite(text, w, { size: 48, width: 560, weight: 800, bg: 'rgba(19,28,43,.91)', color });
const setTag = (s, w, k) => s.scale.set(w * k, w * s.userData.aspect * k, 1);

export function buildSafeSimulation(ctx) {
  const world = new THREE.Group(); world.position.copy(P(0.52, 0.64)); ctx.stage.add(world);
  const navy = ink(0x193753), gold = ink(0xe7b454, 0.22), blue = ink(0x55d2ee, 0.3), green = ink(0x6bd5a3, 0.24);
  const ground = block(0.62, 0.018, 0.33, navy, 0.018); ground.position.y = 0.012; world.add(ground);
  const runway = block(0.43, 0.002, 0.078, ink(0x344f66), 0.002); runway.position.set(0.025, 0.024, 0); world.add(runway);
  for (let i = 0; i < 7; i++) {
    const stripe = block(0.022, 0.002, 0.004, gold, 0.001); stripe.position.set(-0.16 + i * 0.061, 0.027, 0); world.add(stripe);
  }
  for (const z of [-0.12, 0.12]) {
    const tower = block(0.016, 0.09, 0.016, navy); tower.position.set(0.23, 0.065, z); world.add(tower);
    const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.014, 12, 8), gold); beacon.position.set(0.23, 0.12, z); world.add(beacon);
  }
  const plane = new THREE.Group(); world.add(plane);
  const fuselage = block(0.14, 0.029, 0.032, blue); plane.add(fuselage);
  const wing = block(0.04, 0.006, 0.2, gold, 0.004); wing.position.x = -0.012; plane.add(wing);
  const tail = block(0.023, 0.045, 0.007, blue, 0.002); tail.position.set(-0.061, 0.027, 0); plane.add(tail);
  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.017, 0.036, 16), gold); nose.rotation.z = -Math.PI / 2; nose.position.x = 0.085; plane.add(nose);
  const canopy = new THREE.Mesh(new THREE.SphereGeometry(0.022, 16, 8), new THREE.MeshPhysicalMaterial({ color: 0x91edff, transparent: true, opacity: 0.65, roughness: 0.08 })); canopy.scale.set(1.25, 0.55, 0.75); canopy.position.set(0.027, 0.018, 0); plane.add(canopy);
  const arc = new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.003, 6, 50, Math.PI), new THREE.MeshBasicMaterial({ color: 0x7ee4f4, transparent: true, opacity: 0.5 })); arc.position.set(0, 0.065, 0); world.add(arc);
  const wind = new THREE.Group(); world.add(wind);
  for (let i = 0; i < 4; i++) {
    const streak = new THREE.Mesh(new THREE.BoxGeometry(0.08 + i * 0.018, 0.002, 0.002), new THREE.MeshBasicMaterial({ color: 0x87e7f6, transparent: true, opacity: 0.6 }));
    streak.position.set(-0.18 + i * 0.075, 0.17 + i * 0.027, -0.1); wind.add(streak);
  }
  const title = tag('مختبر الخطأ الآمن', 0.36); title.position.set(0, 0.38, -0.1); world.add(title);
  const indicator = tag('المحاكاة: تعلّم بلا مخاطرة', 0.32, '#9feaff'); indicator.position.set(0, 0.305, 0.1); world.add(indicator);
  let mode = 'idle', start = 0, now = 0, crosswind = false, corrected = false;
  function chooseWeather(value) {
    crosswind = value; mode = 'flight'; start = now; ctx.sfx.good();
    ctx.ui.hud(value ? 'رياح جانبية تدفع الطائرة عن المسار' : 'الجو هادئ والمدرج أمامك');
    ctx.ui.card({ tag: 'تجربة آمنة', title: value ? 'الرياح غيّرت المسار' : 'مسار الاقتراب واضح', body: 'راقب الطائرة ثم قرّر: هل تصحّح المسار قبل الهبوط؟ يمكنك إعادة التجربة بلا خسارة حقيقية.', color: 0x55d2ee });
    ctx.ui.choices([{ label: 'صحّح المسار', primary: true, onPick: () => finish(true) }, { label: 'استمر كما أنت', onPick: () => finish(false) }]);
  }
  function finish(choice) {
    corrected = choice; mode = 'result'; start = now;
    const safe = !crosswind || choice;
    ctx.sfx.good();
    ctx.ui.hud(safe ? 'هبوط آمن — تعلّمت من التجربة' : 'ابتعدت عن المدرج — جرّب قراراً آخر');
    ctx.ui.card({ tag: 'نتيجة المحاكاة', title: safe ? 'هبوط آمن' : 'خطأ آمن يكشف السبب', body: safe ? 'غيّرت قرارك وفق ظروف الموقف، فاقتربت الطائرة من المدرج. هكذا يتعلم المتدرب بالممارسة.' : 'الرياح الجانبية تحتاج إلى تصحيح. في المحاكاة ترى نتيجة الخطأ ثم تعيد المحاولة بلا خطر أو تكلفة واقعية.', color: safe ? 0x6bd5a3 : 0xe7b454 });
    if (safe) ctx.ui.done();
    ctx.ui.choices([{ label: '↻ أعد المحاكاة', primary: true, onPick: reset }]);
  }
  function reset() {
    mode = 'idle'; start = now; crosswind = false; corrected = false;
    ctx.ui.hideCard(); ctx.ui.hud('اختر ظروف الرحلة ثم اتخذ قرار الهبوط');
    ctx.ui.choices([{ label: 'جو هادئ', onPick: () => chooseWeather(false) }, { label: 'رياح جانبية', primary: true, onPick: () => chooseWeather(true) }]);
  }
  reset();
  ctx.tap(plane, () => ctx.ui.card({ tag: 'من صفحة ٣٢٨', title: 'التدريب بالمحاكاة', body: 'تسمح المحاكاة بتجربة مواقف يصعب أو يخطر تنفيذها في الواقع، مع مشاهدة نتائج القرارات والتعلم منها.', color: 0x55d2ee }));
  return { update(t, dt, e) {
    now = t; const rise = ease((t - 0.1) / 1.05) * e; world.scale.setScalar(Math.max(0.001, rise));
    const f = ease((t - start) / 1.4);
    const moving = mode !== 'idle';
    plane.position.set(moving ? -0.18 + 0.31 * f : -0.18 + Math.sin(t * 0.7) * 0.012, mode === 'result' ? 0.115 - 0.09 * f : 0.17 + Math.sin(t * 2) * 0.008, crosswind && moving ? 0.08 * f * (mode === 'result' && corrected ? 1 - f : 1) : 0);
    plane.rotation.x = crosswind && moving ? Math.sin(t * 4) * 0.08 : 0;
    plane.rotation.z = crosswind && moving ? -0.08 * (1 - (corrected && mode === 'result' ? f : 0)) : 0;
    wind.visible = crosswind; wind.position.x = (t * 0.16) % 0.2;
    arc.material.opacity = (0.3 + 0.2 * Math.sin(t * 2)) * e;
    setTag(title, 0.36, rise); setTag(indicator, 0.32, rise);
    indicator.material.opacity = 0.85 * e;
  } };
}

export function buildDepthLab(ctx) {
  const world = new THREE.Group(); world.position.copy(P(0.5, 0.55)); ctx.stage.add(world);
  const cyan = ink(0x3fcad4, 0.2), magenta = ink(0xb961d5, 0.2), gold = ink(0xf2bb61, 0.2);
  const base = block(0.62, 0.016, 0.32, ink(0x1f2941)); base.position.y = 0.008; world.add(base);
  const eyes = [];
  for (const side of [-1, 1]) {
    const stand = block(0.014, 0.12, 0.014, ink(0x40516d)); stand.position.set(side * 0.18, 0.08, 0.085); world.add(stand);
    const lens = new THREE.Mesh(new THREE.TorusGeometry(0.045, 0.007, 10, 36), side < 0 ? cyan : magenta); lens.position.set(side * 0.18, 0.15, 0.085); world.add(lens); eyes.push(lens);
    const core = new THREE.Mesh(new THREE.SphereGeometry(0.025, 16, 12), new THREE.MeshPhysicalMaterial({ color: side < 0 ? 0x78e3f1 : 0xdba2e8, transparent: true, opacity: 0.45, roughness: 0.15 })); core.position.copy(lens.position); world.add(core);
  }
  const projections = [-1, 1].map((side) => {
    const p = block(0.105, 0.105, 0.005, side < 0 ? cyan : magenta, 0.002); p.position.set(side * 0.11, 0.18, -0.065); world.add(p); return p;
  });
  const cube = new THREE.Group(); world.add(cube);
  const edges = new THREE.EdgesGeometry(new THREE.BoxGeometry(0.16, 0.16, 0.16));
  const wire = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: 0xffda87, transparent: true, opacity: 0.85 })); cube.add(wire);
  const solid = block(0.147, 0.147, 0.147, new THREE.MeshPhysicalMaterial({ color: 0x42b9d4, transparent: true, opacity: 0.68, roughness: 0.15, metalness: 0.22, emissive: 0x207a9e, emissiveIntensity: 0.22 })); cube.add(solid);
  const beam = [-1, 1].map((side) => {
    const points = [new THREE.Vector3(side * 0.18, 0.15, 0.085), new THREE.Vector3(0, 0.18, -0.035)];
    const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), new THREE.LineBasicMaterial({ color: side < 0 ? 0x61d9e7 : 0xd48be7, transparent: true, opacity: 0.65 })); world.add(line); return line;
  });
  const title = tag('عينان تصنعان العمق', 0.34); title.position.set(0, 0.39, 0); world.add(title);
  const depthTag = tag('صورة مسطّحة ← عمق', 0.28, '#bff2ff'); depthTag.position.set(0, 0.30, -0.1); world.add(depthTag);
  let merged = false, depth = 0.5, now = 0;
  function merge() {
    merged = true; ctx.sfx.good(); ctx.ui.hud('عيناك تدمجان صورتين في مشهد واحد ذي عمق');
    ctx.ui.card({ tag: 'سرّ البعد الثالث', title: 'الدماغ يصنع العمق', body: 'تعرض الصفحة أن الإحساس بالبعد الثالث يرتبط بطريقة عمل العينين والدماغ. حرّك العمق لترى اختلاف موضع الصورة.', color: 0x3fcad4 });
    ctx.ui.slider({ label: 'مقدار العمق', value: depth, onInput: (v) => { depth = v; } });
    ctx.ui.choices([{ label: 'افصل الصورتين', onPick: split }, { label: 'اكتملت التجربة', primary: true, onPick: () => ctx.ui.done() }]);
  }
  function split() {
    merged = false; ctx.ui.hideSlider(); ctx.ui.hideCard(); ctx.ui.hud('صورتان مختلفتان قليلاً أمام العينين');
    ctx.ui.choices([{ label: 'ادمج الصورتين', primary: true, onPick: merge }]);
  }
  split();
  ctx.tap(cube, merge);
  return { update(t, dt, e) {
    now = t; const rise = ease((t - 0.1) / 1) * e; world.scale.setScalar(Math.max(0.001, rise));
    const target = merged ? 1 : 0;
    cube.userData.mix = THREE.MathUtils.lerp(cube.userData.mix || 0, target, Math.min(1, dt * 3));
    const mix = cube.userData.mix;
    cube.position.set(0, 0.18, -0.035 - depth * 0.11 * mix); cube.rotation.y = t * 0.35; cube.rotation.x = 0.18;
    cube.scale.setScalar(Math.max(0.001, mix));
    projections.forEach((p, i) => { p.position.x = (i ? 1 : -1) * (0.11 + depth * 0.045 * mix); p.material.transparent = true; p.material.opacity = 1 - mix * 0.85; });
    beam.forEach((b) => { b.material.opacity = (0.25 + 0.45 * mix) * e; });
    eyes.forEach((eye, i) => { eye.scale.setScalar(1 + Math.sin(t * 2 + i) * 0.04); });
    setTag(title, 0.34, rise); setTag(depthTag, 0.28, rise);
  } };
}

export function buildLearningBag(ctx) {
  const world = new THREE.Group(); world.position.copy(P(0.43, 0.54)); ctx.stage.add(world);
  const violet = ink(0x583f72), pink = ink(0xe36d9d, 0.16), gold = ink(0xe5b761, 0.2), cyan = ink(0x55bfd4, 0.18);
  const caseBase = block(0.46, 0.055, 0.31, violet, 0.018); caseBase.position.y = 0.04; world.add(caseBase);
  const lining = block(0.42, 0.004, 0.27, ink(0xf5e7d4), 0.009); lining.position.y = 0.071; world.add(lining);
  const lidPivot = new THREE.Group(); lidPivot.position.set(0, 0.068, -0.15); world.add(lidPivot);
  const lid = block(0.46, 0.018, 0.31, pink, 0.016); lid.position.z = 0.15; lidPivot.add(lid);
  const crest = tag('حقيبتي التعليمية', 0.23); crest.position.set(0, 0.017, 0.15); lidPivot.add(crest);
  const handle = new THREE.Mesh(new THREE.TorusGeometry(0.041, 0.007, 7, 18, Math.PI), gold); handle.rotation.x = Math.PI / 2; handle.position.set(0, 0.04, 0.17); lidPivot.add(handle);
  const items = [
    { concept: 'اكتشف', skill: 'شاهد', color: cyan, x: -0.115 },
    { concept: 'جرّب', skill: 'طبّق', color: gold, x: 0 },
    { concept: 'تحقق', skill: 'تحقق', color: pink, x: 0.115 },
  ].map((item) => {
    const group = new THREE.Group(); group.position.set(item.x, 0.078, 0); world.add(group);
    const book = block(0.095, 0.009, 0.13, item.color, 0.004); group.add(book);
    const marks = [tag(item.concept, 0.105), tag(item.skill, 0.105)];
    marks.forEach((mark) => { mark.position.set(0, 0.055, 0); group.add(mark); });
    return { ...item, group, marks };
  });
  const rays = Array.from({ length: 10 }, (_, i) => {
    const dot = new THREE.Mesh(new THREE.SphereGeometry(0.004, 8, 8), new THREE.MeshBasicMaterial({ color: i % 2 ? 0xffd996 : 0x9de9f4 })); world.add(dot); return dot;
  });
  const title = tag('مسار يتشكّل لك', 0.32); title.position.set(0, 0.36, -0.04); world.add(title);
  let goal = null, phase = 0, now = 0, phaseAt = 0;
  function setGoal(g) {
    goal = g; phase = 1; phaseAt = now; ctx.sfx.good();
    ctx.ui.hud(g === 'concept' ? 'اخترت فهم المفهوم — الحقيبة تجهّز وسائلك' : 'اخترت إتقان المهارة — الحقيبة تجهّز وسائلك');
    ctx.ui.card({ tag: 'تعلّم فردي', title: g === 'concept' ? 'هدفك: فهم المفهوم' : 'هدفك: إتقان المهارة', body: 'الحقيبة التعليمية تسمح لك باختيار الوسيلة والنشاط وفق حاجتك، ثم تقدّم تقويماً وتغذية راجعة.', color: 0xe36d9d });
    ctx.ui.choices([{ label: 'افتح أدواتي', primary: true, onPick: reveal }]);
  }
  function reveal() {
    phase = 2; phaseAt = now; ctx.sfx.good();
    ctx.ui.hud('المحتوى والنشاط والتقويم خرجت من حقيبتك');
    ctx.ui.card({ tag: 'حقيبتك الخاصة', title: goal === 'concept' ? 'اكتشف ← جرّب ← تحقق' : 'شاهد ← طبّق ← تحقق', body: 'الوسائل لا تأتي بترتيب ثابت للجميع؛ تختار منها ما يلائم هدفك وتتقدم بنفسك، كما تصف صفحة الحقيبة التعليمية.', color: 0x55bfd4 });
    ctx.ui.choices([{ label: 'أكمل مساري', primary: true, onPick: complete }]);
  }
  function complete() {
    phase = 3; phaseAt = now; ctx.ui.done(); ctx.ui.hud('هذه الحقيبة بُنيت وفق هدفك');
    ctx.ui.card({ tag: 'تعلم ذاتي', title: 'أنت صاحب المسار', body: 'الفكرة المحورية في الصفحة هي تفريد التعلم: أهداف واضحة، وسائل متنوعة، نشاط يختاره المتعلم، وتقويم يرشده.', color: 0xe5b761 });
    ctx.ui.choices([{ label: '↻ غيّر هدفي', onPick: reset }]);
  }
  function reset() {
    phase = 0; goal = null; phaseAt = now; ctx.ui.hideCard(); ctx.ui.hud('اختر هدفاً لتفتح حقيبتك التعليمية');
    ctx.ui.choices([{ label: 'أفهم مفهوماً', primary: true, onPick: () => setGoal('concept') }, { label: 'أتقن مهارة', onPick: () => setGoal('skill') }]);
  }
  reset();
  ctx.tap(caseBase, () => ctx.ui.card({ tag: 'من صفحة ٤٤٩', title: 'الحقيبة التعليمية', body: 'نظام متكامل للتعلم الذاتي يراعي الفروق الفردية ويتيح للمتعلم اختيار وسائل وأنشطة تناسبه.', color: 0xe36d9d }));
  return { update(t, dt, e) {
    now = t; const rise = ease((t - 0.1) / 1.1) * e; world.scale.setScalar(Math.max(0.001, rise));
    const open = phase ? ease((t - phaseAt) / 1) : 0;
    lidPivot.rotation.x = -open * 1.85;
    items.forEach((item, i) => { const k = phase >= 2 ? ease((t - phaseAt - i * 0.17) / 0.75) : 0; item.group.position.y = 0.078 + 0.11 * k; item.group.rotation.y = k * (i - 1) * 0.27; item.group.scale.setScalar(Math.max(0.001, k)); item.marks.forEach((mark, j) => { mark.visible = goal === 'skill' ? j === 1 : j === 0; setTag(mark, 0.105, e); }); });
    rays.forEach((dot, i) => { const a = i * Math.PI * 2 / rays.length + t * 0.22; const k = phase >= 2 ? ease((t - phaseAt) / 0.7) : 0; dot.position.set(Math.cos(a) * 0.22, 0.1 + k * (0.12 + Math.sin(t * 2 + i) * 0.024), Math.sin(a) * 0.16); dot.scale.setScalar(Math.max(0.001, k * e)); });
    setTag(crest, 0.23, rise); setTag(title, 0.32, rise);
  } };
}
