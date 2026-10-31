// Five more physical pages become small, distinct interactive worlds.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { P, ease, sprite, shadowed } from './kit.js?v=6';

const material = (color, light = 0) => new THREE.MeshStandardMaterial({ color, roughness: 0.33, metalness: 0.24, emissive: color, emissiveIntensity: light });
const box = (w, h, d, m, radius = 0.008) => shadowed(new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 3, radius), m));
const title = (text, w = 0.25, color = '#fff7e7') => sprite(text, w, { size: 48, width: 560, weight: 800, color, bg: 'rgba(20,29,44,.94)' });
const tagScale = (s, w, k) => s.scale.set(Math.max(0.001, w * k), Math.max(0.001, w * s.userData.aspect * k), 1);
const pipe = (points, color, r = 0.003) => new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p))), 30, r, 6, false), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.85 }));

export function buildLivingNetwork(ctx) {
  const g = new THREE.Group(); g.position.copy(P(0.49, 0.55)); ctx.stage.add(g);
  const blue = material(0x2fb6d4, 0.25), gold = material(0xf0bc62, 0.2), green = material(0x62d5a5, 0.25), dark = material(0x20354c);
  const base = box(0.62, 0.014, 0.34, dark, 0.015); base.position.y = 0.012; g.add(base);
  const localRing = new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.003, 8, 52), blue); localRing.rotation.x = Math.PI / 2; localRing.position.set(-0.16, 0.026, 0); g.add(localRing);
  const globe = new THREE.Mesh(new THREE.SphereGeometry(0.105, 22, 16), new THREE.MeshPhysicalMaterial({ color: 0x74d6ed, transparent: true, opacity: 0.28, roughness: 0.16, metalness: 0.1 })); globe.position.set(0.18, 0.145, -0.03); g.add(globe);
  const globeWire = new THREE.Mesh(new THREE.SphereGeometry(0.107, 16, 12), new THREE.MeshBasicMaterial({ color: 0xa8eeff, wireframe: true, transparent: true, opacity: 0.42 })); globeWire.position.copy(globe.position); g.add(globeWire);
  const computers = [[-0.25, -0.07], [-0.12, -0.07], [-0.18, 0.07]].map(([x, z], i) => {
    const node = box(0.055, 0.045, 0.012, i ? blue : gold, 0.003); node.position.set(x, 0.055, z); g.add(node);
    const foot = box(0.033, 0.006, 0.025, dark, 0.002); foot.position.set(x, 0.032, z + 0.014); g.add(foot);
    return node;
  });
  const links = [pipe([[-0.25, 0.06, -0.07], [-0.18, 0.09, 0.07]], 0x71dff5), pipe([[-0.12, 0.06, -0.07], [-0.18, 0.09, 0.07]], 0x71dff5)];
  links.forEach((l) => g.add(l));
  const bridge = pipe([[-0.12, 0.07, -0.07], [0, 0.19, -0.01], [0.18, 0.16, -0.03]], 0xf3cf79, 0.004); g.add(bridge);
  const backup = pipe([[-0.18, 0.09, 0.07], [-0.02, 0.12, 0.14], [0.18, 0.16, -0.03]], 0x7de5b0, 0.003); g.add(backup);
  const packet = new THREE.Mesh(new THREE.SphereGeometry(0.013, 12, 8), gold); g.add(packet);
  const labelLAN = title('LAN · شبكة المدرسة', 0.22); labelLAN.position.set(-0.18, 0.23, 0.12); g.add(labelLAN);
  const labelWAN = title('WAN · نطاق أوسع', 0.21); labelWAN.position.set(0.18, 0.33, -0.09); g.add(labelWAN);
  const heading = title('الشبكة التي تشفي نفسها', 0.35); heading.position.set(0, 0.42, -0.13); g.add(heading);
  let phase = 0, at = 0, now = 0, failed = false;
  function start() {
    phase = 1; at = now; ctx.sfx.good(); ctx.ui.hud('الرسالة تعبر أجهزة المدرسة أولاً');
    ctx.ui.card({ tag: 'الشبكة المحلية', title: 'الأجهزة متصلة داخل المدرسة', body: 'تصف الصفحة شبكة LAN بأنها تربط أجهزة مكان محدد، وتتميز بسرعة نقل البيانات لقصر المسافة.', color: 0x2fb6d4 });
    ctx.ui.choices([{ label: 'أرسلها إلى شبكة أوسع', primary: true, onPick: cross }]);
  }
  function cross() {
    phase = 2; at = now; ctx.sfx.good(); ctx.ui.hud('خرجت الرسالة من الشبكة المحلية إلى نطاق أوسع');
    ctx.ui.card({ tag: 'شبكة واسعة', title: 'من LAN إلى WAN', body: 'الآن تسافر البيانات خارج المبنى. المسار الطويل يربط مناطق أوسع من الشبكة المحلية.', color: 0xf0bc62 });
    ctx.ui.choices([{ label: 'اقطع الاتصال الرئيسي', primary: true, onPick: cut }]);
  }
  function cut() {
    phase = 3; at = now; failed = true; ctx.ui.hud('انقطع الخط؛ الرسالة تنتظر مساراً آخر');
    ctx.ui.card({ tag: 'جرّب بنفسك', title: 'أعد توجيه الرسالة', body: 'عندما يتعطل طريق الاتصال، تحتاج الأجهزة إلى طريق بديل. اختره وشاهد الرسالة تواصل سيرها.', color: 0xf0bc62 });
    ctx.ui.choices([{ label: 'افتح المسار البديل', primary: true, onPick: recover }]);
  }
  function recover() {
    phase = 4; at = now; failed = false; ctx.sfx.good(); ctx.ui.hud('وصلت الرسالة عبر المسار البديل');
    ctx.ui.card({ tag: 'الشبكات والإنترنت', title: 'الاتصال عاد', body: 'وصلت الرسالة من أجهزة المدرسة إلى شبكة أوسع. صفحة الكتاب تميّز بين الشبكة المحلية والواسعة والويب الذي يربط الوثائق.', color: 0x62d5a5 });
    ctx.ui.done(); ctx.ui.choices([{ label: '↻ أعد الرحلة', onPick: reset }]);
  }
  function reset() { phase = 0; at = now; failed = false; ctx.ui.hideCard(); ctx.ui.hud('ثلاثة أجهزة، رسالة واحدة؛ إلى أين تصل؟'); ctx.ui.choices([{ label: '✦ شغّل الشبكة', primary: true, onPick: start }]); }
  reset(); ctx.tap(globe, () => ctx.ui.card({ tag: 'من صفحة ٢٧٣', title: 'LAN وWAN والويب', body: 'الصفحة تفرّق بين نطاق الشبكات وبين وثائق الويب المترابطة التي نصل إليها عبر الإنترنت.', color: 0x62d5a5 }));
  return { update(t, dt, e) {
    now = t; const k = ease((t - 0.1) / 1) * e; g.scale.setScalar(Math.max(0.001, k));
    globeWire.rotation.y = t * 0.27; globe.rotation.y = -t * 0.12;
    bridge.visible = phase !== 3; backup.visible = phase === 4;
    const p = phase === 0 ? 0 : Math.min(1, (t - at) / 1.4);
    if (phase === 1) packet.position.lerpVectors(computers[0].position, computers[2].position, ease(p));
    else if (phase === 2) packet.position.set(-0.12 + 0.3 * ease(p), 0.09 + Math.sin(p * Math.PI) * 0.11, -0.07 + p * 0.04);
    else if (phase === 3) packet.position.set(-0.02, 0.17, 0);
    else if (phase === 4) packet.position.copy(backup.geometry.parameters.path.getPoint(ease(p)));
    else packet.position.copy(computers[0].position).add(new THREE.Vector3(0, 0.05 + Math.sin(t * 2) * 0.008, 0));
    packet.scale.setScalar(failed ? 0.6 + 0.3 * Math.sin(t * 8) : 1);
    tagScale(heading, 0.35, k); tagScale(labelLAN, 0.22, k); tagScale(labelWAN, 0.21, k);
  } };
}

export function buildLessonFactory(ctx) {
  const g = new THREE.Group(); g.position.copy(P(0.5, 0.48)); ctx.stage.add(g);
  const gold = material(0xe5b85d, 0.22), teal = material(0x52c4c9, 0.2), navy = material(0x1d334d), pink = material(0xe4829e, 0.18);
  const rail = box(0.63, 0.018, 0.14, navy); rail.position.set(0, 0.025, 0.05); g.add(rail);
  const stages = [
    ['تحليل', 'من يتعلّم؟'], ['تصميم', 'ما الهدف؟'], ['إنتاج', 'بأي وسيلة؟'], ['تقويم', 'هل نجح؟'], ['استخدام', 'في الصف'],
  ].map(([name, sub], i) => {
    const group = new THREE.Group(); group.position.set(-0.25 + i * 0.125, 0.04, 0.035); g.add(group);
    const card = box(0.104, 0.11, 0.065, i % 2 ? teal : gold, 0.008); card.position.y = 0.057; group.add(card);
    const number = title(String(i + 1), 0.045); number.position.set(0, 0.11, 0.035); group.add(number);
    const text = title(name, 0.12); text.position.set(0, 0.19, 0); group.add(text);
    return { group, card, number, text, name, sub };
  });
  const gears = [-0.19, 0, 0.19].map((x, i) => {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.055, 0.009, 8, 20), i === 1 ? pink : teal); ring.position.set(x, 0.025, -0.11); g.add(ring); return ring;
  });
  const feedback = pipe([[0.25, 0.22, -0.05], [0, 0.34, -0.18], [-0.25, 0.22, -0.05]], 0xf3ca6f, 0.004); g.add(feedback);
  const orb = new THREE.Mesh(new THREE.SphereGeometry(0.015, 12, 10), pink); g.add(orb);
  const heading = title('مصنع الدرس', 0.27); heading.position.set(0, 0.36, 0.12); g.add(heading);
  let learner = null, resource = null, phase = 0, now = 0, at = 0;
  function chooseLearner(k) {
    learner = k; phase = 1; at = now; ctx.sfx.good();
    ctx.ui.hud(k === 'new' ? 'المتعلم يبدأ من الصفر' : 'المتعلم لديه خبرة سابقة');
    ctx.ui.card({ tag: 'التحليل', title: 'ابدأ بخصائص المتعلم', body: 'نموذج الجزار في الصفحة يبدأ بتحديد خصائص المتعلمين والحاجة التعليمية والموارد قبل بناء الدرس.', color: 0x52c4c9 });
    ctx.ui.choices([{ label: 'فيديو قصير', onPick: () => chooseResource('video') }, { label: 'نشاط عملي', primary: true, onPick: () => chooseResource('practice') }]);
  }
  function chooseResource(k) {
    resource = k; phase = 2; at = now; ctx.sfx.good();
    ctx.ui.hud('المراحل تركّب درساً من اختياراتك');
    ctx.ui.card({ tag: 'التصميم والإنتاج', title: k === 'video' ? 'الوسيلة: فيديو قصير' : 'الوسيلة: نشاط عملي', body: 'اختيار الوسيلة يغيّر طريقة عرض المحتوى، لكن الهدف والتقويم يبقيان مرتبطين بخصائص المتعلم.', color: 0xe5b85d });
    ctx.ui.choices([{ label: 'اختبر الدرس', primary: true, onPick: evaluate }]);
  }
  function evaluate() {
    phase = 3; at = now; ctx.ui.hud('التقويم يعيد ضوء التغذية الراجعة إلى البداية');
    ctx.ui.card({ tag: 'المراجعة والتعديل', title: 'هل يناسب الدرس المتعلم؟', body: learner === 'new' && resource === 'video' ? 'للمبتدئ قد تحتاج إضافة نشاط تطبيقي بعد الفيديو. ارجع وعدّل الوسيلة ثم قارن.' : 'تتصل مراحل النموذج ببعضها عبر التغذية الراجعة؛ إذا لم يتحقق الهدف، تعود لتعديل مرحلة سابقة.', color: 0xe4829e });
    ctx.ui.choices([{ label: 'غيّر الوسيلة', onPick: () => { phase = 1; at = now; ctx.ui.hud('عدّل الوسيلة ثم أعد اختبار الدرس'); ctx.ui.card({ tag: 'مراجعة التصميم', title: 'اختر وسيلة جديدة', body: 'غيّر طريقة تقديم الدرس، ثم قارن نتيجة التقويم قبل اعتماده.', color: 0xe5b85d }); ctx.ui.choices([{ label: 'فيديو قصير', onPick: () => chooseResource('video') }, { label: 'نشاط عملي', primary: true, onPick: () => chooseResource('practice') }]); } }, { label: 'اعتمد الدرس', primary: true, onPick: done }]);
  }
  function done() { phase = 4; at = now; ctx.ui.done(); ctx.ui.hud('درس صُنع من المتعلم إلى التقويم'); ctx.ui.card({ tag: 'نموذج الجزار', title: 'اكتملت دورة الدرس', body: `المتعلم: ${learner === 'new' ? 'مبتدئ' : 'لديه خبرة'} · الوسيلة: ${resource === 'video' ? 'فيديو' : 'نشاط عملي'}. تعود التغذية الراجعة لتطوير الدرس بعد الاستخدام.`, color: 0x52c4c9 }); ctx.ui.choices([{ label: '↻ اصنع درساً آخر', onPick: reset }]); }
  function reset() { learner = resource = null; phase = 0; at = now; ctx.ui.hideCard(); ctx.ui.hud('أدخل خصائص المتعلم لتبدأ آلة الدرس'); ctx.ui.choices([{ label: 'مبتدئ', primary: true, onPick: () => chooseLearner('new') }, { label: 'لديه خبرة', onPick: () => chooseLearner('experienced') }]); }
  reset(); stages.forEach((s, i) => ctx.tap(s.card, () => ctx.ui.card({ tag: `المرحلة ${i + 1}`, title: s.name, body: s.sub, color: i % 2 ? 0x52c4c9 : 0xe5b85d })));
  return { update(t, dt, e) {
    now = t; const k = ease((t - 0.1) / 1.1) * e; g.scale.setScalar(Math.max(0.001, k));
    stages.forEach((s, i) => { const active = phase >= 2 ? 1 : phase >= 1 && i === 0 ? 1 : 0; s.group.position.y = 0.04 + (active ? 0.035 : 0) + Math.sin(t * 2 + i) * 0.004; s.card.material.emissiveIntensity = active ? 0.35 + Math.sin(t * 4 - i) * 0.12 : 0.05; tagScale(s.text, 0.12, k); tagScale(s.number, 0.045, k); });
    gears.forEach((ring, i) => { ring.rotation.z = t * (i % 2 ? -0.7 : 0.7); });
    feedback.visible = phase >= 3; orb.visible = phase >= 3; if (orb.visible) orb.position.copy(feedback.geometry.parameters.path.getPoint((t * 0.3) % 1));
    tagScale(heading, 0.27, k);
  } };
}

export function buildWebEvolution(ctx) {
  const g = new THREE.Group(); g.position.copy(P(0.49, 0.48)); ctx.stage.add(g);
  const violet = material(0x874eaa, 0.2), pink = material(0xe470a5, 0.2), cyan = material(0x5ac8d2, 0.25), gold = material(0xf0c36b, 0.22), dark = material(0x242a46);
  const pedestal = box(0.62, 0.015, 0.32, dark); pedestal.position.y = 0.012; g.add(pedestal);
  const monolith = new THREE.Group(); g.add(monolith); monolith.position.set(-0.2, 0.04, 0);
  const site = box(0.18, 0.18, 0.014, violet); site.position.y = 0.11; monolith.add(site);
  for (let i = 0; i < 4; i++) { const line = box(0.13 - i * 0.015, 0.006, 0.003, gold, 0.001); line.position.set(-0.01, 0.17 - i * 0.032, 0.009); monolith.add(line); }
  const noWrite = title('قراءة فقط', 0.16); noWrite.position.set(0, 0.27, 0); monolith.add(noWrite);
  const community = new THREE.Group(); community.position.set(0.03, 0.04, 0); g.add(community);
  const users = [
    { x: -0.12, z: -0.09, c: pink }, { x: 0.1, z: -0.09, c: cyan }, { x: -0.1, z: 0.1, c: gold }, { x: 0.12, z: 0.08, c: violet },
  ].map((u, i) => {
    const unit = new THREE.Group(); unit.position.set(u.x, 0.07, u.z); community.add(unit);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.021, 12, 8), u.c); head.position.y = 0.048; unit.add(head);
    const post = box(0.084, 0.05, 0.012, u.c); post.position.y = 0; unit.add(post);
    const glyph = title(i === 2 ? '✎' : '✦', 0.035); glyph.position.set(0, 0.004, 0.008); unit.add(glyph);
    return unit;
  });
  const threads = [pipe([[-0.12, 0.16, -0.09], [0.1, 0.16, -0.09]], 0xf3a6d2), pipe([[0.1, 0.16, -0.09], [0.12, 0.16, 0.08]], 0x9be8f2), pipe([[0.12, 0.16, 0.08], [-0.1, 0.16, 0.1]], 0xf3d58b), pipe([[-0.1, 0.16, 0.1], [-0.12, 0.16, -0.09]], 0xd6a9ed)]; threads.forEach((l) => community.add(l));
  const semantic = new THREE.Group(); semantic.position.set(0.2, 0.18, 0); g.add(semantic);
  const ideas = ['معلم', 'درس', 'طالب', 'معنى'].map((word, i) => {
    const a = i * Math.PI / 2; const orb = new THREE.Mesh(new THREE.SphereGeometry(0.033, 16, 12), i % 2 ? cyan : gold); orb.position.set(Math.cos(a) * 0.13, Math.sin(a) * 0.1, 0); semantic.add(orb);
    const lbl = title(word, 0.095); lbl.position.copy(orb.position).add(new THREE.Vector3(0, 0.05, 0)); semantic.add(lbl); return { orb, lbl };
  });
  for (let i = 0; i < 4; i++) semantic.add(pipe([[ideas[i].orb.position.x, ideas[i].orb.position.y, 0], [0, 0, 0]], 0x91e8dc, 0.002));
  const core = new THREE.Mesh(new THREE.IcosahedronGeometry(0.048, 1), pink); semantic.add(core);
  const heading = title('ولادة الويب', 0.28); heading.position.set(0, 0.4, -0.1); g.add(heading);
  let phase = 0, now = 0, at = 0, contributed = false;
  function open() {
    phase = 1; at = now; ctx.ui.hud('الويب ١٫٠: المحتوى معروض للقراءة فقط');
    ctx.ui.card({ tag: 'ويب ١٫٠', title: 'موقع جامد', body: 'يصف جدول الصفحة الويب الأول بصفحات ثابتة تُقرأ أكثر مما تُكتب، ويحدد نشر المحتوى مسؤول الموقع.', color: 0x874eaa });
    ctx.ui.choices([{ label: 'حوّل الصفحة إلى مساحة مشاركة', primary: true, onPick: share }]);
  }
  function share() {
    phase = 2; at = now; ctx.sfx.good(); ctx.ui.hud('الويب ٢٫٠: القراء يشاركون في المحتوى');
    ctx.ui.card({ tag: 'ويب ٢٫٠', title: 'من قارئ إلى مشارك', body: 'تظهر التعليقات والإضافات بين المستخدمين. هذا يترجم جانب القراءة والكتابة والمشاركة في جدول الكتاب.', color: 0xe470a5 });
    ctx.ui.choices([{ label: 'أضف مشاركتك', primary: true, onPick: contribute }]);
  }
  function contribute() {
    contributed = true; ctx.sfx.good(); ctx.ui.hud('مشاركتك أصبحت جزءاً من الشبكة');
    ctx.ui.card({ tag: 'ويب تشاركي', title: 'الصفحة تغيّرت بمشاركتك', body: 'بعد أن أضفت فكرة، لم يعد المحتوى ثابتاً. الآن اربط المفاهيم بمعانيها لترى فكرة الويب الدلالي.', color: 0x5ac8d2 });
    ctx.ui.choices([{ label: 'اربط المعاني', primary: true, onPick: meanings }]);
  }
  function meanings() {
    phase = 3; at = now; ctx.sfx.good(); ctx.ui.hud('الويب الدلالي: صلات بين المعاني');
    ctx.ui.card({ tag: 'ويب ٣٫٠ في الكتاب', title: 'المعنى يربط المعلومات', body: 'تقدم الصفحة الويب ٣٫٠ بوصفه ويباً دلالياً يهتم بمعاني الكلمات وصلاتها، ليجعل التعامل مع المعلومات أذكى.', color: 0x5ac8d2 });
    ctx.ui.done(); ctx.ui.choices([{ label: '↻ شاهد التحول مجدداً', onPick: reset }]);
  }
  function reset() { phase = 0; contributed = false; at = now; ctx.ui.hideCard(); ctx.ui.hud('صفحة واحدة… وثلاثة أجيال من الويب'); ctx.ui.choices([{ label: 'ابدأ بالويب ١٫٠', primary: true, onPick: open }]); }
  reset(); ctx.tap(site, open);
  return { update(t, dt, e) {
    now = t; const k = ease((t - 0.1) / 1) * e; g.scale.setScalar(Math.max(0.001, k));
    monolith.scale.setScalar(phase < 2 ? 1 : Math.max(0.001, 1 - ease((t - at) / 0.7)));
    community.scale.setScalar(phase >= 2 ? ease((t - at) / 0.9) : 0.001);
    if (phase === 3) community.scale.setScalar(0.55);
    semantic.scale.setScalar(phase === 3 ? ease((t - at) / 1) : 0.001);
    semantic.rotation.y = Math.sin(t * 0.5) * 0.18; core.rotation.y = t * 0.7;
    users[2].scale.setScalar(contributed ? 1.35 : 1);
    tagScale(noWrite, 0.16, k); tagScale(heading, 0.28, k);
    ideas.forEach(({ lbl }) => tagScale(lbl, 0.095, k));
  } };
}

export function buildStoryboardDirector(ctx) {
  const g = new THREE.Group(); g.position.copy(P(0.47, 0.5)); ctx.stage.add(g);
  const charcoal = material(0x252b3e), violet = material(0x8748b6, 0.22), orange = material(0xea9c4b, 0.2), blue = material(0x5abdd5, 0.25), paper = material(0xffedce);
  const strip = box(0.62, 0.024, 0.26, charcoal); strip.position.y = 0.025; g.add(strip);
  for (const x of [-0.27, -0.09, 0.09, 0.27]) { const hole = box(0.012, 0.002, 0.025, paper, 0.001); hole.position.set(x, 0.04, -0.12); g.add(hole); }
  const frames = [0, 1, 2].map((i) => {
    const group = new THREE.Group(); group.position.set((i - 1) * 0.19, 0.048, 0); g.add(group);
    const panel = box(0.17, 0.1, 0.15, i === 0 ? violet : i === 1 ? blue : orange); panel.position.y = 0.05; group.add(panel);
    const scene = box(i === 1 ? 0.055 : 0.095, 0.043, 0.01, paper, 0.002); scene.position.set(i === 1 ? 0.035 : 0, 0.1, 0.077); group.add(scene);
    const actor = new THREE.Mesh(new THREE.SphereGeometry(0.018, 12, 8), charcoal); actor.position.set(i === 1 ? -0.04 : 0, 0.145, 0.018); group.add(actor);
    const caption = title(['بداية', 'تفصيل', 'نهاية'][i], 0.12); caption.position.set(0, 0.2, 0); group.add(caption);
    return { group, panel, caption, actor };
  });
  const camera = new THREE.Group(); camera.position.set(-0.27, 0.19, 0.18); g.add(camera);
  const body = box(0.075, 0.052, 0.052, charcoal); camera.add(body);
  const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.021, 0.021, 0.04, 16), blue); lens.rotation.x = Math.PI / 2; lens.position.z = -0.041; camera.add(lens);
  const reels = [-0.025, 0.025].map((x) => { const r = new THREE.Mesh(new THREE.TorusGeometry(0.026, 0.006, 7, 20), orange); r.position.set(x, 0.045, 0); camera.add(r); return r; });
  const spotlight = new THREE.SpotLight(0xffdfab, 2, 1.2, 0.35, 0.5); spotlight.position.set(0, 0.5, 0.25); spotlight.target = frames[0].group; g.add(spotlight);
  const heading = title('أنت المخرج', 0.3); heading.position.set(0, 0.39, -0.1); g.add(heading);
  let shot = null, order = null, phase = 0, at = 0, now = 0, played = false;
  function chooseShot(k) {
    shot = k; phase = 1; at = now; ctx.sfx.good(); ctx.ui.hud(k === 'close' ? 'اقتربت الكاميرا من التفصيل' : 'كشفت اللقطة الواسعة المكان كاملاً');
    ctx.ui.card({ tag: 'قرار إخراجي', title: k === 'close' ? 'لقطة قريبة' : 'لقطة واسعة', body: 'تذكر صفحة الستوري بورد اتجاه الكاميرا والتكبير والتصغير ضمن تعليمات كل لقطة.', color: 0x8748b6 });
    ctx.ui.choices([{ label: 'النهاية أولاً', onPick: () => chooseOrder('reverse') }, { label: 'من البداية للنهاية', primary: true, onPick: () => chooseOrder('normal') }]);
  }
  function chooseOrder(k) {
    order = k; phase = 2; at = now; ctx.ui.hud(k === 'reverse' ? 'بدأت الحكاية من نهايتها' : 'اللقطات مرتبة من البداية للنهاية');
    ctx.ui.card({ tag: 'ترتيب الستوري بورد', title: 'غيّرت ترتيب الحكاية', body: 'اللوحات نفسها قد تروي حكاية مختلفة عندما يتغير ترتيب اللقطات وحجمها. شغّل النسخة التي أخرجتها.', color: 0xea9c4b });
    ctx.ui.choices([{ label: '▶ شغّل الفيلم القصير', primary: true, onPick: play }]);
  }
  function play() { phase = 3; at = now; played = true; ctx.sfx.good(); ctx.ui.hideCard(); ctx.ui.hud('عرض اللقطات التي أخرجتها…'); ctx.ui.choices([]); }
  function finish() {
    if (phase !== 3) return; phase = 4; ctx.ui.done();
    ctx.ui.hud('اختياراتك غيّرت طريقة رواية المشهد');
    ctx.ui.card({ tag: 'من صفحة ٤٧٧', title: 'الستوري بورد صار فيلماً', body: `زاوية الكاميرا: ${shot === 'close' ? 'قريبة' : 'واسعة'} · ترتيب اللقطات: ${order === 'reverse' ? 'من النهاية' : 'من البداية'}. تخطيط الصورة يسبق تحريكها وإخراجها.`, color: 0x5abdd5 });
    ctx.ui.choices([{ label: '↻ أخرج نسخة ثانية', onPick: reset }]);
  }
  function reset() { shot = order = null; phase = 0; played = false; at = now; ctx.ui.hideCard(); ctx.ui.hud('ثلاث لقطات مطبوعة تنتظر مخرجها'); ctx.ui.choices([{ label: 'لقطة واسعة', onPick: () => chooseShot('wide') }, { label: 'لقطة قريبة', primary: true, onPick: () => chooseShot('close') }]); }
  reset(); frames.forEach((f, i) => ctx.tap(f.panel, () => ctx.ui.card({ tag: `إطار ${i + 1}`, title: ['بداية', 'تفصيل', 'نهاية'][i], body: 'هذه لقطة من الستوري بورد؛ اختيار زاويتها وترتيبها يغيّر طريقة سرد القصة.', color: 0x8748b6 })));
  return { update(t, dt, e) {
    now = t; const k = ease((t - 0.1) / 1.05) * e; g.scale.setScalar(Math.max(0.001, k));
    const sequence = order === 'reverse' ? [2, 1, 0] : [0, 1, 2];
    const index = phase === 3 ? Math.min(2, Math.floor((t - at) / 1.25)) : -1;
    frames.forEach((frame, i) => { const selected = index >= 0 && sequence[index] === i; frame.group.position.y = 0.048 + (selected ? 0.1 : phase > 0 ? 0.035 : 0) + Math.sin(t * 2 + i) * 0.005; frame.group.scale.setScalar(selected ? (shot === 'close' ? 1.7 : 1.4) : 1); frame.panel.material.emissiveIntensity = selected ? 0.5 : 0.1; tagScale(frame.caption, 0.12, k); });
    if (index >= 0) { camera.position.x = THREE.MathUtils.lerp(camera.position.x, frames[sequence[index]].group.position.x, Math.min(1, dt * 3)); spotlight.target = frames[sequence[index]].group; }
    else camera.position.x = -0.27 + Math.sin(t * 0.6) * 0.025;
    reels.forEach((r, i) => { r.rotation.z = t * (i ? -1.1 : 1.1); });
    if (phase === 3 && t - at > 3.8) finish();
    tagScale(heading, 0.3, k);
  } };
}

export function buildFoldingBook(ctx) {
  const g = new THREE.Group(); g.position.copy(P(0.52, 0.55)); ctx.stage.add(g);
  const black = material(0x252938), silver = material(0x9db9c2, 0.12), green = material(0x8bc85a, 0.18), cyan = material(0x4dbed2, 0.2), gold = material(0xe8bd65, 0.2);
  const plinth = box(0.62, 0.015, 0.31, black); plinth.position.y = 0.015; g.add(plinth);
  const roller = new THREE.Mesh(new THREE.CylinderGeometry(0.038, 0.038, 0.22, 24), black); roller.rotation.x = Math.PI / 2; roller.position.set(-0.26, 0.12, 0); g.add(roller);
  const cap1 = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.008, 24), silver); cap1.rotation.x = Math.PI / 2; cap1.position.set(-0.26, 0.12, 0.115); g.add(cap1);
  const cap2 = cap1.clone(); cap2.position.z = -0.115; g.add(cap2);
  const accordion = new THREE.Group(); accordion.position.set(-0.225, 0.12, 0); g.add(accordion);
  let pivot = accordion;
  const panels = [];
  for (let i = 0; i < 6; i++) {
    const hinge = new THREE.Group(); if (i) hinge.position.x = 0.09; pivot.add(hinge);
    const page = box(0.09, 0.18, 0.004, i % 2 ? cyan : green, 0.002); page.position.x = 0.045; hinge.add(page);
    const strip = box(0.07, 0.015, 0.005, i % 3 === 0 ? gold : silver, 0.001); strip.position.set(0.045, 0.035, 0.004); hinge.add(strip);
    const line = box(0.06, 0.006, 0.005, black, 0.001); line.position.set(0.04, -0.015, 0.004); hinge.add(line);
    panels.push({ hinge, page }); pivot = hinge;
  }
  const light = new THREE.PointLight(0xa5edb9, 1.2, 0.7); light.position.set(0.06, 0.27, 0.05); g.add(light);
  const heading = title('الكتاب الذي يطوي نفسه', 0.36); heading.position.set(0, 0.39, 0); g.add(heading);
  const caption = title('من كتاب مفتوح إلى حجم الجيب', 0.3, '#c8f8d4'); caption.position.set(0, 0.32, 0.06); g.add(caption);
  let fold = 0, target = 0, now = 0, opened = false;
  function open() {
    opened = true; target = 1; ctx.sfx.good(); ctx.ui.hud('افتح الكتاب المرن بإصبعك');
    ctx.ui.card({ tag: 'تصور تقني من الكتاب', title: 'الشاشة تنفتح من لفة صغيرة', body: 'تعرض الصفحة تصوراً لكتاب إلكتروني قابل للطي؛ نحرّك أجزاؤه فوق الورقة لنتخيل كيف يتغير حجمه وشكل القراءة.', color: 0x8bc85a });
    ctx.ui.slider({ label: 'مقدار فتح الكتاب', value: 1, onInput: (v) => { target = v; } });
    ctx.ui.choices([{ label: 'اطو الكتاب', onPick: () => { target = 0; ctx.ui.slider({ label: 'مقدار فتح الكتاب', value: 0, onInput: (v) => { target = v; } }); ctx.ui.hud('عاد الكتاب إلى حجم الجيب'); ctx.ui.choices([{ label: 'افتح الكتاب', onPick: open }, { label: 'اكشف الفكرة', primary: true, onPick: done }]); } }, { label: 'اكشف الفكرة', primary: true, onPick: done }]);
  }
  function done() { target = 1; ctx.ui.done(); ctx.ui.hud('الورقة تحوّلت إلى كتاب مرن'); ctx.ui.card({ tag: 'من صفحة ٦٠٩', title: 'الفكرة تنطوي ثم تنفتح', body: 'تقدم الصفحة صورة لاختراع مستقبلي متخيّل: كتاب إلكتروني صغير يمكن فرده للقراءة ثم طيه للحمل.', color: 0x4dbed2 }); ctx.ui.choices([{ label: '↻ أعد الطي', onPick: reset }]); }
  function reset() { opened = false; target = 0; ctx.ui.hideSlider(); ctx.ui.hideCard(); ctx.ui.hud('من صفحة ورقية إلى كتاب ينطوي'); ctx.ui.choices([{ label: '✦ افتح الكتاب', primary: true, onPick: open }]); }
  reset(); ctx.tap(roller, open);
  return { update(t, dt, e) {
    now = t; const k = ease((t - 0.1) / 1.1) * e; g.scale.setScalar(Math.max(0.001, k));
    fold = THREE.MathUtils.lerp(fold, target, Math.min(1, dt * 3.5));
    panels.forEach(({ hinge, page }, i) => { hinge.rotation.y = i === 0 ? 0 : (i % 2 ? 1 : -1) * (1 - fold) * 2.48; page.material.emissiveIntensity = opened ? 0.18 + 0.08 * Math.sin(t * 2 + i) : 0.04; });
    roller.rotation.y = t * 0.03; light.intensity = (0.35 + fold * 1.2) * e;
    tagScale(heading, 0.36, k); tagScale(caption, 0.3, k);
  } };
}
