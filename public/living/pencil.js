// Pencil & light pages: every object is drawn by a pencil, filled with paper,
// and only the idea itself glows in colour. Plus the two special pages:
// the welcome page at the front of the book and the secret page.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import {
  P, PAGE_H, PAPER, INK, ease, easeBack, stag, clamp01, label, sprite, glow, glowTexture, goldMat, mat, glossy,
  shadowed, sketch, lightTube, textCanvas,
} from './kit.js?v=6';

const TAU = Math.PI * 2;
const toAr = (n) => String(n).replace(/\d/g, (d) => '٠١٢٣٤٥٦٧٨٩'[d]);
const css = (c) => '#' + c.toString(16).padStart(6, '0');

// Pencil outline that also works on round shapes: a slightly larger ink shell seen from inside.
export function inked(geometry, opts = {}) {
  const s = sketch(geometry, opts);
  const hull = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ color: INK, side: THREE.BackSide, transparent: true, opacity: 0, depthWrite: false }));
  hull.scale.setScalar(opts.hullScale || 1.05);
  s.add(hull);
  const base = s.userData.reveal;
  s.userData.reveal = (p) => { base(p); hull.material.opacity = 0.85 * clamp01((p - 0.1) / 0.5); hull.visible = p > 0.01; };
  s.userData.reveal(0);
  return s;
}

// A soft frame laid on the printed page, used to light up printed boxes and cells.
export function frameTex(color) {
  const c = document.createElement('canvas'); c.width = 512; c.height = 160;
  const g = c.getContext('2d');
  g.shadowColor = color; g.shadowBlur = 18; g.strokeStyle = color; g.lineWidth = 11;
  g.beginPath(); g.roundRect(16, 16, 480, 128, 30);
  g.fillStyle = color + '33'; g.fill(); g.stroke();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
export function printFrame(u, v, w, h, color) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: frameTex(color), transparent: true, depthWrite: false, toneMapped: false, opacity: 0 }));
  m.rotation.x = -Math.PI / 2; m.position.copy(P(u, v, 0.004)); m.scale.set(w, h * PAGE_H, 1);
  m.renderOrder = 2;
  return m;
}

export function smudge(color = 0x3b3b3b, size = 0.03) {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color, transparent: true, opacity: 0, depthWrite: false }));
  s.scale.setScalar(size);
  return s;
}

// ================================================================ 7. Lab: communication and noise (p151)
const UNDERSTAND = ['الاستماع', 'التفسير', 'الاستيعاب', 'التذكّر', 'التقييم', 'الاستجابة'];
const STEP_V = [0.141, 0.178, 0.213, 0.249, 0.285, 0.322];
const MESSAGE = 'التعلّم رحلة ممتعة';

export function buildLab(ctx) {
  const g = new THREE.Group(); ctx.stage.add(g);
  const drawn = [];
  const person = (u, tint, light, delay) => {
    const p = new THREE.Group(); p.position.copy(P(u, 0.338)); g.add(p);
    const body = inked(new THREE.CapsuleGeometry(0.03, 0.06, 6, 20), { color: tint }); body.position.y = 0.06; p.add(body);
    const head = inked(new THREE.SphereGeometry(0.027, 24, 16), { color: tint }); head.position.y = 0.14; p.add(head);
    const halo = glow(light, 0.14, 0); halo.position.y = 0.14; p.add(halo);
    drawn.push([body, delay], [head, delay + 0.25]);
    return { p, halo };
  };
  const sender = person(0.787, 0xe3f6f8, 0x3cc6d0, 0.2);
  const receiver = person(0.298, 0xfde6ec, 0xf07ca0, 0.5);

  const book = inked(new RoundedBoxGeometry(0.075, 0.055, 0.014, 2, 0.003));
  book.position.copy(P(0.542, 0.256, 0.15)); g.add(book); drawn.push([book, 0.8]);
  const bookGlow = glow(0x45c6ff, 0.12, 0); bookGlow.position.copy(book.position); g.add(bookGlow);
  const stand = inked(new THREE.CylinderGeometry(0.004, 0.004, 0.12, 8)); stand.position.copy(P(0.542, 0.256, 0.06)); g.add(stand); drawn.push([stand, 0.7]);

  const sHead = sender.p.position.clone().setY(0.17), rHead = receiver.p.position.clone().setY(0.17);
  const mid = book.position.clone();
  const curve = new THREE.CatmullRomCurve3([
    sHead, new THREE.Vector3((sHead.x + mid.x) / 2, 0.22, (sHead.z + mid.z) / 2), mid,
    new THREE.Vector3((rHead.x + mid.x) / 2, 0.22, (rHead.z + mid.z) / 2), rHead,
  ]);
  const tube = lightTube(curve, { radius: 0.0085, color: 0x45c6ff, speed: 0.55 }); g.add(tube);
  const back = new THREE.CatmullRomCurve3([P(0.298, 0.34, 0.02), P(0.36, 0.41, 0.05), P(0.47, 0.43, 0.07), P(0.65, 0.41, 0.05), P(0.787, 0.34, 0.02)]);
  const feedback = lightTube(back, { radius: 0.006, color: 0xf07ca0, speed: 0.4 }); g.add(feedback);
  const clean = new THREE.Color(0x45c6ff), murky = new THREE.Color(0x6b6b6b);

  const smudges = Array.from({ length: 46 }, (_, i) => { const s = smudge(0x333333, 0.022 + (i % 5) * 0.004); g.add(s); return { s, a: Math.random() * TAU, r: 0.03 + Math.random() * 0.06, y: (Math.random() - 0.5) * 0.08, sp: 0.6 + Math.random() * 1.4 }; });
  const noiseTag = sprite('تشويش', 0.09, { size: 44, width: 260, weight: 800, color: '#ffffff', bg: 'rgba(40,40,40,.85)' });
  noiseTag.position.copy(mid).add(new THREE.Vector3(0, 0.075, 0)); g.add(noiseTag);

  // Light up the printed understanding steps, one by one.
  const goldF = frameTex('#e7b43a'), redF = frameTex('#e0453c');
  const frames = STEP_V.map((v) => { const f = printFrame(0.171, v, 0.115, 0.03, '#e7b43a'); g.add(f); return { f, on: 0, bad: 0 }; });

  // Understanding meter above the receiver.
  const meter = inked(new THREE.CylinderGeometry(0.017, 0.017, 0.1, 28, 1, true), { color: 0xffffff }); meter.position.copy(receiver.p.position).add(new THREE.Vector3(-0.075, 0.13, 0)); g.add(meter); drawn.push([meter, 1.0]);
  const liquid = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.1, 24), new THREE.MeshBasicMaterial({ color: 0xf07ca0, transparent: true, opacity: 0.85, toneMapped: false }));
  liquid.position.copy(meter.position); g.add(liquid);

  const sent = sprite(MESSAGE, 0.17, { size: 40, width: 520, weight: 800, border: '#3cc6d0' });
  sent.position.copy(sender.p.position).setY(0.26); g.add(sent);
  let gotTex = null;
  const got = sprite(MESSAGE, 0.17, { size: 40, width: 520, weight: 800, border: '#f07ca0' });
  got.position.copy(receiver.p.position).setY(0.26); g.add(got);
  function receive(level) {
    const text = [...MESSAGE].map((ch) => (ch !== ' ' && Math.random() < level * 0.95 ? '·' : ch)).join('');
    const fresh = sprite(text, 0.17, { size: 40, width: 520, weight: 800, border: level > 0.5 ? '#9a9a9a' : '#f07ca0' });
    got.material.map.dispose(); got.material.map = fresh.material.map; got.material.needsUpdate = true;
    gotTex = fresh;
  }

  const packets = [];
  let noise = 0, target = 0, phase = 'intro', predicted = null, demoAt = 0, now = 0, lastPacket = 0;
  let triedLow = false, triedHigh = false, finished = false;

  function ask() {
    phase = 'ask';
    ctx.ui.card({ tag: 'تنبّأ أولاً', title: 'ماذا يحدث لفهم المستقبل إذا زاد التشويش؟', body: 'اختر توقّعك، ثم شاهد الرسالة وهي تعبر الوسيلة.', color: 0x3cc6d0 });
    ctx.ui.choices([
      { label: 'يبقى كما هو', onPick: () => reveal(0) },
      { label: 'يقلّ', onPick: () => reveal(1) },
      { label: 'يزيد', onPick: () => reveal(2) },
    ]);
  }
  function reveal(i) {
    predicted = i; phase = 'demo'; demoAt = now;
    ctx.ui.choices([]); ctx.ui.hideCard(); ctx.ui.hud('راقب: التشويش يرتفع…'); ctx.sfx.whoosh();
  }
  function afterDemo() {
    phase = 'free';
    const ok = predicted === 1;
    ctx.sfx[ok ? 'good' : 'bad']();
    ctx.ui.card({
      tag: ok ? '✓ توقّعك صحيح' : 'النتيجة',
      title: 'كلما زاد التشويش قلّ المعنى الذي يصل',
      body: 'تنكسر سلسلة الفهم عند التفسير والاستيعاب، فلا يصل إلى المستقبل إلا جزء من الرسالة. لذلك يراقب المعلّم التغذية العكسية، ويعيد الإرسال بوسيلة أوضح.',
      color: 0xf07ca0,
    });
    ctx.ui.slider({ label: 'التشويش', value: target, onInput: (v) => { target = v; if (v < 0.15) triedLow = true; if (v > 0.7) triedHigh = true; check(); } });
    ctx.ui.hud('حرّك التشويش، وراقب خطوات الفهم المطبوعة');
  }
  function check() { if (!finished && triedLow && triedHigh) { finished = true; ctx.ui.done(); } }
  ctx.ui.hud('المرسل يرسل فكرة عبر الوسيلة…');
  ctx.tap(book, () => ctx.ui.card({ tag: 'الوسيلة', title: 'قناة الاتصال', body: 'تحمل الرسالة من المرسل إلى المستقبل. وكل ما يعطّلها يسمّى تشويشاً: ضجيج، أو غموض، أو وسيلة غير مناسبة.', color: 0x45c6ff }));
  ctx.tap(sender.p, () => ctx.ui.card({ tag: 'المرسل', title: 'تحويل الأفكار إلى معانٍ', body: 'يضع المرسل فكرته في شفرة: كلمات وصور ورموز يفهمها المستقبل.', color: 0x3cc6d0 }));
  ctx.tap(receiver.p, () => ctx.ui.card({ tag: 'المستقبل', title: 'تحويل المعاني إلى أفكار', body: 'يحلّ المستقبل الشفرة عبر ست خطوات: الاستماع، فالتفسير، فالاستيعاب، فالتذكّر، فالتقييم، ثم الاستجابة.', color: 0xf07ca0 }));

  return {
    update(t, dt, e) {
      now = t;
      drawn.forEach(([s, d]) => s.userData.reveal(stag(t, d, 1.1, clamp01) * e));
      tube.userData.fill(stag(t, 1.3, 1.2) * e); feedback.userData.fill(stag(t, 2.0, 1.2) * e);
      tube.userData.update(dt * (1 - noise * 0.6)); feedback.userData.update(dt);
      if (phase === 'intro' && t > 3.2) ask();
      if (phase === 'demo') { target = clamp01((now - demoAt) / 3) * 0.85; if (now - demoAt > 4.2) afterDemo(); }
      noise = THREE.MathUtils.damp(noise, target, 3, dt);
      tube.userData.core.material.color.copy(clean).lerp(murky, noise);
      bookGlow.material.opacity = 0.6 * (1 - noise) * e;
      sender.halo.material.opacity = 0.7 * e;
      smudges.forEach((m, i) => {
        m.a += dt * m.sp * (0.5 + noise);
        m.s.position.set(mid.x + Math.cos(m.a) * m.r, mid.y + m.y + Math.sin(m.a * 1.7) * 0.02, mid.z + Math.sin(m.a) * m.r * 0.6);
        m.s.material.opacity = clamp01(noise * 1.4 - (i % 7) * 0.08) * 0.75 * e;
      });
      noiseTag.scale.set(0.09 * noise * e + 0.0001, 0.09 * noiseTag.userData.aspect * noise * e + 0.0001, 1);
      // A packet of meaning leaves the sender about every 1.6 seconds.
      if (t > 2.6 && t - lastPacket > 1.6) {
        lastPacket = t;
        const s = glow(0xbfefff, 0.06, 1); g.add(s); packets.push({ s, t0: t, n: noise });
      }
      for (let k = packets.length - 1; k >= 0; k--) {
        const pk = packets[k], p = (t - pk.t0) / 1.3;
        if (p >= 1) {
          g.remove(pk.s); packets.splice(k, 1);
          const reach = Math.round(6 * Math.pow(1 - noise, 1.3));
          frames.forEach((f, i) => { if (i < reach) f.on = t + i * 0.16; else if (i === reach) f.bad = t + i * 0.16; });
          receive(noise);
          continue;
        }
        pk.s.position.copy(curve.getPoint(p));
        if (p > 0.5) pk.s.position.add(new THREE.Vector3((Math.random() - 0.5) * noise * 0.03, (Math.random() - 0.5) * noise * 0.03, 0));
        pk.s.material.color.set(0xbfefff).lerp(new THREE.Color(0x777777), p > 0.5 ? noise : 0);
        pk.s.material.opacity = e;
      }
      frames.forEach((f) => {
        const lit = f.on && t >= f.on ? Math.max(0, 1 - (t - f.on) / 1.4) : 0;
        const bad = f.bad && t >= f.bad ? Math.max(0, 1 - (t - f.bad) / 1.2) : 0;
        f.f.material.map = bad > lit ? redF : goldF;
        f.f.material.opacity = Math.max(lit, bad) * e;
      });
      receiver.halo.material.opacity = 0.75 * (1 - noise) * e;
      liquid.scale.set(1, Math.max(0.02, 1 - noise), 1);
      liquid.position.y = meter.position.y - 0.05 * noise;
      liquid.material.opacity = 0.85 * stag(t, 1.6, 0.6) * e;
      const ts = stag(t, 1.8, 0.5, easeBack) * e;
      sent.scale.set(0.17 * ts, 0.17 * sent.userData.aspect * ts, 1);
      got.scale.set(0.17 * ts, 0.17 * got.userData.aspect * ts, 1);
      sent.position.y = 0.26 + Math.sin(t * 2) * 0.004;
    },
  };
}

// ================================================================ 8. Ladder: Dale's cone (p147)
const CONE = [
  ['الرموز اللفظية', 'abs', 'الكلمات المكتوبة والمنطوقة؛ أكثر الخبرات تجريداً.'],
  ['الرموز البصرية', 'abs', 'الخرائط والرسوم البيانية والرسوم الخطية.'],
  ['التسجيلات الصوتية والصور الثابتة', 'semi', 'الإذاعة والتسجيلات الصوتية والصور والشرائح.'],
  ['الأفلام المتحركة', 'semi', 'تعرض الحركة والزمن كما يحدثان.'],
  ['التلفزيون التعليمي', 'semi', 'ينقل الحدث بالصوت والصورة إلى الصف.'],
  ['المعارض والمتاحف', 'semi', 'يرى المتعلّم الأشياء الحقيقية، وغالباً لا يلمسها.'],
  ['الدراسات الميدانية', 'semi', 'الرحلات والزيارات إلى مواقع الخبرة نفسها.'],
  ['العروض العلمية', 'con', 'يشاهد المتعلّم الإجراء وهو يُنفَّذ أمامه.'],
  ['الخبرات الممثلة', 'con', 'لعب الأدوار وتمثيل مواقف يصعب معايشتها.'],
  ['الممارسة المعدلة', 'con', 'النماذج والمحاكاة بدل الشيء الحقيقي.'],
  ['الممارسة الواقعية', 'con', 'التعلّم بالعمل المباشر في الموقف الحقيقي.'],
];
const CONE_GROUPS = {
  abs: { n: 'الوسائل المجردة', c: 0xe2453c },
  semi: { n: 'الوسائل شبه المحسوسة', c: 0xe9b52f },
  con: { n: 'الوسائل المحسوسة', c: 0x3fae4f },
};

export function buildCone(ctx) {
  const g = new THREE.Group(); g.position.copy(P(0.542, 0.665)); ctx.stage.add(g);
  const H = 0.03, GAP = 0.003, N = CONE.length;
  // k = 0 is the base of the cone (the most concrete), k = N - 1 the tip (the most abstract).
  const rings = CONE.slice().reverse().map(([name, grp, desc], k) => {
    const rb = 0.17 - k * (0.115 / N), rt = rb - 0.115 / N;
    const holder = new THREE.Group(); g.add(holder);
    const ring = inked(new THREE.CylinderGeometry(rt, rb, H, 56), { hullScale: 1.025 }); holder.add(ring);
    const color = CONE_GROUPS[grp].c;
    const band = new THREE.Mesh(new THREE.TorusGeometry((rt + rb) / 2 + 0.0015, 0.0032, 8, 72), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0, toneMapped: false }));
    band.rotation.x = Math.PI / 2; holder.add(band);
    const tag = sprite(name, 0.2, { size: 38, width: 560, weight: 800, border: css(color) });
    tag.position.set(rb + 0.13, 0, 0); tag.visible = false; holder.add(tag);
    ctx.tap(ring, () => select(k));
    ctx.tap(tag, () => select(k));
    return { name, grp, desc, color, holder, ring, band, tag, rb, rt, k, lift: 0 };
  });

  const orb = new THREE.Mesh(new THREE.SphereGeometry(0.014, 24, 16), goldMat()); orb.add(glow(0xffd27a, 0.09)); shadowed(orb); g.add(orb);
  const total = N * (H + GAP);
  const rail = new THREE.Mesh(new THREE.CylinderGeometry(0.0022, 0.0022, total, 8), new THREE.MeshBasicMaterial({ color: 0xd4ad55, toneMapped: false }));
  rail.position.set(-0.26, total / 2, 0); g.add(rail);
  const top = sprite('مجرد', 0.075, { size: 46, width: 240, weight: 800, color: '#ffffff', bg: 'rgba(226,69,60,.92)' }); top.position.set(-0.26, total + 0.035, 0); g.add(top);
  const bottom = sprite('محسوس', 0.085, { size: 46, width: 260, weight: 800, color: '#ffffff', bg: 'rgba(63,174,79,.92)' }); bottom.position.set(-0.26, -0.02, 0.02); g.add(bottom);
  const pointer = glow(0xffd27a, 0.07, 1); g.add(pointer);

  let sel = 0, orbY = 0, explode = 0, explodeTo = 0;
  const visited = new Set();
  function yOf(k) { return k * (H + GAP) + H / 2 + k * 0.026 * explode; }
  function select(k) {
    sel = THREE.MathUtils.clamp(k, 0, N - 1);
    const r = rings[sel]; visited.add(sel);
    ctx.sfx.tap();
    ctx.ui.card({ tag: CONE_GROUPS[r.grp].n, title: r.name, body: r.desc, color: r.color });
    if (sel === N - 1) ctx.ui.hud('القمة: أعلى درجات التجريد');
    else if (sel === 0) ctx.ui.hud('القاعدة: خبرات أكثر واقعية وشمولاً');
    else ctx.ui.hud(`الطبقة ${toAr(N - sel)} من ${toAr(N)} من القمة`);
    if (visited.size >= 6 && visited.has(0) && visited.has(N - 1)) ctx.ui.done();
  }
  const setChoices = () => ctx.ui.choices([
    { label: '▼ أكثر واقعية', onPick: () => select(sel - 1) },
    { label: '▲ أكثر تجريداً', onPick: () => select(sel + 1) },
    { label: explodeTo ? 'اجمع الطبقات' : 'افصل الطبقات', onPick: () => { explodeTo = explodeTo ? 0 : 1; setChoices(); ctx.sfx.whoosh(); } },
  ]);
  ctx.ui.hud('اصعد المخروط من الواقع إلى التجريد');
  let started = false;

  return {
    update(t, dt, e) {
      explode = THREE.MathUtils.damp(explode, explodeTo, 4, dt);
      rings.forEach((r) => {
        r.ring.userData.reveal(stag(t, 0.2 + r.k * 0.11, 0.9, clamp01) * e);
        r.lift = THREE.MathUtils.damp(r.lift, r.k === sel ? 1 : 0, 6, dt);
        r.holder.position.set(0, yOf(r.k) + r.lift * 0.008, r.lift * 0.045);
        const lit = stag(t, 1.6 + r.k * 0.06, 0.5) * e;
        r.band.material.opacity = lit * (r.k === sel ? 1 : 0.45 + 0.1 * Math.sin(t * 2 + r.k));
        r.band.scale.setScalar(1 + r.lift * 0.04);
        r.tag.visible = (explode > 0.3 || r.k === sel) && lit > 0.5;
        const ts = r.k === sel ? 1 : explode;
        r.tag.scale.set(0.2 * ts, 0.2 * r.tag.userData.aspect * ts, 1);
        r.tag.position.y = 0.012;
      });
      if (!started && t > 2.4) { started = true; select(0); setChoices(); }
      const r = rings[sel];
      orbY = THREE.MathUtils.damp(orbY, yOf(sel) + H / 2 + 0.016, 7, dt);
      orb.position.set(0, orbY + Math.abs(Math.sin(t * 3)) * 0.004, r.rt * 0.55 + r.lift * 0.045);
      orb.scale.setScalar(Math.max(stag(t, 2.2, 0.5, easeBack) * e, 0.001));
      pointer.position.set(-0.26, orbY, 0); pointer.material.opacity = e;
      const rs = stag(t, 1.2, 0.6) * e;
      rail.scale.set(1, Math.max(rs, 0.001), 1); rail.position.y = (total * rs) / 2;
      [[top, 0.075], [bottom, 0.085]].forEach(([s, w], i) => { const k = stag(t, 1.6 + i * 0.2, 0.5, easeBack) * e; s.scale.set(w * k + 0.0001, w * s.userData.aspect * k + 0.0001, 1); });
      top.position.y = total + 0.035 + explode * N * 0.026;
      rail.scale.y = Math.max(rs, 0.001) * (1 + explode * (N * 0.026) / total);
      rail.position.y = (total + explode * N * 0.026) * rs / 2;
    },
  };
}

// ================================================================ 9. Time machine: the TV of eras (p66)
const ERAS = [
  { y: 'العشرينيات', t: 'المذياع التعليمي', d: 'بدأت الإذاعة تنقل الدروس إلى المدارس والبيوت؛ الصوت وحده يحمل المعرفة.', icon: 'radio' },
  { y: 'الخمسينيات', t: 'التلفزيون التعليمي', d: 'صار الدرس صوتاً وصورة معاً، وانتشرت برامج التلفزيون التعليمي.', icon: 'tv' },
  { y: 'الستينيات', t: 'التعليم المبرمج', d: 'آلات التعليم والتعليم بمساعدة الحاسوب: خطوات صغيرة، وتغذية راجعة فورية.', icon: 'computer' },
  { y: 'التسعينيات', t: 'الإنترنت والتعليم عن بعد', d: 'خرج الدرس من جدران الصف إلى الشبكة، وتوسّع التعليم عن بعد.', icon: 'globe' },
  { y: 'العقد الثاني من الألفية', t: 'التعلّم بالأجهزة المتنقلة', d: 'صار الدرس في الجيب؛ يتعلّم الطالب حيث كان ومتى شاء.', icon: 'phone' },
  { y: 'اليوم', t: 'الواقع المعزّز', d: 'والآن… الصفحة التي بين يديك تصحو أمامك.', icon: 'ar' },
];

function drawIcon(g, kind, cx, cy, s) {
  g.save(); g.translate(cx, cy); g.lineWidth = 7; g.lineCap = g.lineJoin = 'round'; g.strokeStyle = '#f5efe1';
  const R = (x, y, w, h, r = 14) => { g.beginPath(); g.roundRect(x * s, y * s, w * s, h * s, r); g.stroke(); };
  const L = (pts) => { g.beginPath(); pts.forEach(([x, y], i) => (i ? g.lineTo(x * s, y * s) : g.moveTo(x * s, y * s))); g.stroke(); };
  const C = (x, y, r) => { g.beginPath(); g.arc(x * s, y * s, r * s, 0, TAU); g.stroke(); };
  if (kind === 'radio') { R(-1, -0.55, 2, 1.2, 22); C(-0.45, 0.05, 0.32); C(-0.45, 0.05, 0.16); L([[0.25, -0.2], [0.75, -0.2]]); L([[0.25, 0.1], [0.75, 0.1]]); C(0.5, 0.38, 0.1); L([[0.6, -0.55], [0.95, -1.05]]); }
  if (kind === 'tv') { R(-1, -0.65, 2, 1.35, 26); R(-0.8, -0.48, 1.25, 1.0, 16); C(0.72, -0.25, 0.1); C(0.72, 0.1, 0.1); L([[-0.2, -0.65], [-0.55, -1.15]]); L([[-0.2, -0.65], [0.15, -1.1]]); }
  if (kind === 'computer') { R(-0.85, -0.85, 1.7, 1.15, 16); L([[0, 0.3], [0, 0.55]]); L([[-0.4, 0.55], [0.4, 0.55]]); R(-1, 0.72, 2, 0.32, 10); L([[-0.5, -0.4], [-0.1, -0.4]]); L([[-0.5, -0.15], [0.35, -0.15]]); }
  if (kind === 'globe') { C(0, 0, 0.95); g.beginPath(); g.ellipse(0, 0, 0.42 * s, 0.95 * s, 0, 0, TAU); g.stroke(); L([[-0.95, 0], [0.95, 0]]); L([[-0.82, -0.45], [0.82, -0.45]]); L([[-0.82, 0.45], [0.82, 0.45]]); }
  if (kind === 'phone') { R(-0.5, -1, 1, 2, 22); R(-0.38, -0.78, 0.76, 1.42, 8); C(0, 0.83, 0.07); }
  if (kind === 'ar') {
    R(-0.45, -0.2, 0.9, 1.2, 18);
    g.strokeStyle = '#ffd27a';
    L([[-0.35, -0.75], [0, -0.95], [0.35, -0.75], [0, -0.55], [-0.35, -0.75]]); L([[-0.35, -0.75], [-0.35, -0.38], [0, -0.18], [0, -0.55]]); L([[0.35, -0.75], [0.35, -0.38], [0, -0.18]]);
    [[0.75, -0.9], [-0.8, -0.6], [0.65, -0.3]].forEach(([x, y]) => L([[x - 0.08, y], [x + 0.08, y]]));
  }
  g.restore();
}

function drawScreen(c, era, idx, glitch) {
  const g = c.getContext('2d'), W = c.width, H = c.height;
  const grd = g.createRadialGradient(W / 2, H / 2, 40, W / 2, H / 2, W * 0.7);
  grd.addColorStop(0, '#1d3242'); grd.addColorStop(1, '#070d13');
  g.fillStyle = grd; g.fillRect(0, 0, W, H);
  if (glitch > 0) {
    const img = g.getImageData(0, 0, W, H), d = img.data;
    for (let i = 0; i < d.length; i += 4) { const v = Math.random() * 255 * glitch; d[i] = d[i + 1] = d[i + 2] = v + (1 - glitch) * d[i]; }
    g.putImageData(img, 0, 0);
  } else {
    g.direction = 'rtl'; g.textAlign = 'center';
    g.fillStyle = '#f3dca2'; g.font = '800 40px Tajawal, sans-serif'; g.fillText(era.y, W / 2, 62);
    drawIcon(g, era.icon, W / 2, H / 2 + 6, 82);
    g.fillStyle = '#ffffff'; g.font = '800 46px Tajawal, sans-serif'; g.fillText(era.t, W / 2, H - 38);
    g.fillStyle = 'rgba(243,220,162,.75)'; g.font = '700 24px Tajawal, sans-serif'; g.textAlign = 'right'; g.fillText(`القناة ${toAr(idx + 1)}`, W - 22, 34);
  }
  g.fillStyle = 'rgba(0,0,0,.18)';
  for (let y = 0; y < H; y += 4) g.fillRect(0, y, W, 1);
}

export function buildTimeTV(ctx) {
  const g = new THREE.Group(); g.position.copy(P(0.635, 0.455)); ctx.stage.add(g);
  const drawn = [];
  const body = inked(new RoundedBoxGeometry(0.29, 0.22, 0.13, 3, 0.022), { hullScale: 1.02 }); body.position.y = 0.145; g.add(body); drawn.push([body, 0.1]);
  const legGeo = new THREE.CylinderGeometry(0.005, 0.004, 0.035, 8);
  [[-0.1, -0.04], [0.1, -0.04], [-0.1, 0.04], [0.1, 0.04]].forEach(([x, z], i) => { const l = inked(legGeo); l.position.set(x, 0.018, z); g.add(l); drawn.push([l, 0.4 + i * 0.05]); });
  [-0.5, 0.45].forEach((a, i) => {
    const ant = inked(new THREE.CylinderGeometry(0.0028, 0.0028, 0.15, 8));
    ant.position.set(Math.sin(-a) * 0.07 - 0.02, 0.255 + Math.cos(a) * 0.07, 0); ant.rotation.z = a; g.add(ant); drawn.push([ant, 0.7 + i * 0.1]);
    const tip = new THREE.Mesh(new THREE.SphereGeometry(0.008, 12, 8), goldMat()); tip.position.set(Math.sin(-a) * 0.145 - 0.02, 0.255 + Math.cos(a) * 0.145, 0); g.add(tip); drawn.push([{ userData: { reveal: (p) => tip.scale.setScalar(Math.max(p, 0.001)) } }, 1.0]);
  });
  const screenCanvas = document.createElement('canvas'); screenCanvas.width = 512; screenCanvas.height = 400;
  const screenTex = new THREE.CanvasTexture(screenCanvas); screenTex.colorSpace = THREE.SRGBColorSpace;
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.19, 0.148), new THREE.MeshBasicMaterial({ map: screenTex, toneMapped: false, transparent: true, opacity: 0 }));
  screen.position.set(-0.035, 0.145, 0.0655); g.add(screen);
  const screenGlow = glow(0x9fd8ff, 0.32, 0); screenGlow.position.set(-0.035, 0.145, 0.07); g.add(screenGlow);
  const knob = inked(new THREE.CylinderGeometry(0.02, 0.02, 0.012, 20)); knob.rotation.x = Math.PI / 2; knob.position.set(0.105, 0.17, 0.066); g.add(knob); drawn.push([knob, 0.9]);
  const mark = new THREE.Mesh(new THREE.BoxGeometry(0.004, 0.016, 0.004), new THREE.MeshBasicMaterial({ color: 0xd4ad55, toneMapped: false })); mark.position.y = 0.008; knob.add(mark);
  const knob2 = inked(new THREE.CylinderGeometry(0.012, 0.012, 0.01, 16)); knob2.rotation.x = Math.PI / 2; knob2.position.set(0.105, 0.105, 0.066); g.add(knob2); drawn.push([knob2, 1.0]);

  // A timeline of glowing dots in front of the TV: oldest on the right, as Arabic reads.
  const dots = ERAS.map((_, i) => {
    const d = new THREE.Mesh(new THREE.SphereGeometry(0.008, 16, 10), new THREE.MeshBasicMaterial({ color: 0xbfb8a8, toneMapped: false }));
    d.position.set(0.15 - i * 0.06, 0.006, 0.13); g.add(d); return d;
  });
  const line = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.002, 0.002), new THREE.MeshBasicMaterial({ color: 0xd4ad55, toneMapped: false })); line.position.set(0, 0.004, 0.13); g.add(line);
  const yearTag = sprite(ERAS[0].y, 0.11, { size: 40, width: 380, weight: 800, color: '#14110d', bg: 'rgba(243,220,162,.95)' }); g.add(yearTag);

  let era = 0, glitchUntil = 0, drawnEra = -1, now = 0, started = false, knobTurn = 0, finished = false;
  function show(i) {
    era = THREE.MathUtils.clamp(i, 0, ERAS.length - 1);
    glitchUntil = now + 0.35; knobTurn += 1; ctx.sfx.click();
    const x = ERAS[era];
    ctx.ui.card({ tag: x.y, title: x.t, body: x.d, color: 0x45c6ff });
    const fresh = sprite(x.y, 0.11, { size: 40, width: 380, weight: 800, color: '#14110d', bg: 'rgba(243,220,162,.95)' });
    yearTag.material.map.dispose(); yearTag.material.map = fresh.material.map; yearTag.userData.aspect = fresh.userData.aspect; yearTag.material.needsUpdate = true;
    if (era === ERAS.length - 1 && !finished) {
      finished = true;
      setTimeout(() => { ctx.fx.burst(g.position.clone().setY(0.3), 0xffd27a, 40, 0.5, 0.04); ctx.sfx.good(); ctx.ui.done(); }, 600);
    }
  }
  const setChoices = () => ctx.ui.choices([
    { label: 'الأقدم', onPick: () => show(era - 1) },
    { label: 'الأحدث', primary: true, onPick: () => show(era + 1) },
  ]);
  ctx.tap(body, () => show(era + 1 >= ERAS.length ? 0 : era + 1));
  ctx.tap(knob, () => show(era + 1 >= ERAS.length ? 0 : era + 1));
  ctx.ui.hud('قلّب القنوات عبر الزمن');

  return {
    update(t, dt, e) {
      now = t;
      drawn.forEach(([s, d]) => s.userData.reveal(stag(t, d, 1.1, clamp01) * e));
      const on = stag(t, 1.5, 0.6) * e;
      screen.material.opacity = on;
      screenGlow.material.opacity = 0.35 * on * (0.85 + 0.15 * Math.sin(t * 9));
      if (!started && t > 2.0) { started = true; show(0); setChoices(); }
      const glitch = Math.max(0, (glitchUntil - t) / 0.35);
      if (started && (glitch > 0 || drawnEra !== era)) { drawScreen(screenCanvas, ERAS[era], era, glitch); screenTex.needsUpdate = true; if (glitch === 0) drawnEra = era; }
      knob.rotation.y = THREE.MathUtils.damp(knob.rotation.y, knobTurn * (Math.PI / 3), 8, dt);
      dots.forEach((d, i) => {
        const k = stag(t, 1.2 + i * 0.08, 0.4, easeBack) * e;
        d.scale.setScalar(Math.max(k * (i === era ? 1.6 + Math.sin(t * 5) * 0.2 : 1), 0.001));
        d.material.color.set(i === era ? 0xffd27a : i < era ? 0xe7cf98 : 0xbfb8a8);
      });
      line.scale.set(Math.max(stag(t, 1.1, 0.6) * e, 0.001), 1, 1);
      const yk = (started ? 1 : 0) * e;
      yearTag.position.set(dots[era].position.x, 0.045, 0.13);
      yearTag.scale.set(0.11 * yk, 0.11 * yearTag.userData.aspect * yk, 1);
    },
  };
}

// ================================================================ Welcome page (front of the book)
// Layout shared with intro.html: printed card grid and QR position, in page fractions.
export const WELCOME = { qr: [0.5, 0.335], cols: [0.79, 0.5, 0.21], rows: [0.655, 0.755, 0.855], card: [0.27, 0.088] };

function cardCanvas(x, typeColor, thumb, found) {
  const c = document.createElement('canvas'); c.width = 540; c.height = 220;
  const g = c.getContext('2d');
  g.fillStyle = '#fffdf8'; g.beginPath(); g.roundRect(4, 4, 532, 212, 26); g.fill();
  g.lineWidth = 6; g.strokeStyle = found ? '#d4ad55' : 'rgba(31,27,22,.12)'; g.stroke();
  if (thumb) { g.save(); g.beginPath(); g.roundRect(380, 22, 136, 176, 14); g.clip(); g.drawImage(thumb, 380, 22, 136, 176); g.restore(); }
  g.direction = 'rtl'; g.textAlign = 'right';
  g.fillStyle = typeColor; g.beginPath(); g.roundRect(196, 26, 164, 44, 22); g.fill();
  g.fillStyle = '#fff'; g.font = '800 26px Tajawal, sans-serif'; g.textAlign = 'center'; g.fillText(x.typeLabel, 278, 57);
  g.textAlign = 'right'; g.fillStyle = '#1f1b16'; g.font = '800 31px Tajawal, sans-serif';
  const words = x.title.split(' '); let line = '', y = 112; const lines = [];
  words.forEach((w) => { const t = line ? line + ' ' + w : w; if (g.measureText(t).width > 330) { lines.push(line); line = w; } else line = t; });
  lines.push(line); lines.slice(0, 3).forEach((l, i) => g.fillText(l, 360, y + i * 38));
  if (found) { g.fillStyle = '#d4ad55'; g.beginPath(); g.arc(46, 46, 30, 0, TAU); g.fill(); g.fillStyle = '#14110d'; g.font = '800 34px Tajawal'; g.textAlign = 'center'; g.fillText('✦', 46, 58); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return { c, t };
}

export function buildWelcome(ctx) {
  const g = new THREE.Group(); ctx.stage.add(g);
  const pages = ctx.pages();
  const { done, total } = ctx.progress();
  const center = P(WELCOME.qr[0], WELCOME.qr[1]);

  const seal = new THREE.Group(); seal.position.copy(center); g.add(seal);
  const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.012, 64), goldMat()); disc.rotation.x = Math.PI / 2; seal.add(disc);
  const star = label('✦', 0.08, { size: 150, weight: 800, color: '#14110d', bg: null, width: 220, pad: 6 }); star.position.z = 0.0065; seal.add(star);
  const star2 = star.clone(); star2.rotation.y = Math.PI; star2.position.z = -0.0065; seal.add(star2);
  seal.add(glow(0xffd27a, 0.3, 0.7));
  shadowed(seal);
  const waves = [0, 1, 2].map((i) => { const w = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.0025, 8, 80), new THREE.MeshBasicMaterial({ color: 0xffd27a, transparent: true, opacity: 0, toneMapped: false })); w.rotation.x = Math.PI / 2; w.position.copy(center).setY(0.003); g.add(w); return { w, off: i / 3 }; });

  const title = sprite('مرحباً بك في الموسوعة الحيّة', 0.5, { size: 50, width: 1000, title: true, bg: 'rgba(31,27,22,.9)', color: '#f3dca2' });
  g.add(title);
  const status = done >= total
    ? 'اكتملت صفحاتك كلها ✦ صفحةٌ سرّية تنتظرك قبل الإهداء…'
    : done ? `اكتشفت ${toAr(done)} من ${toAr(total)} صفحات حيّة` : `${toAr(total)} صفحات حيّة تنتظرك في هذا الكتاب`;
  const sub = sprite(status, 0.44, { size: 40, width: 900, weight: 800, bg: 'rgba(250,247,240,.96)', border: '#d4ad55' });
  g.add(sub);

  const cards = pages.slice(0, 9).map((x, i) => {
    const u = WELCOME.cols[i % 3], v = WELCOME.rows[Math.floor(i / 3)];
    const found = ctx.isFound(x.id);
    const { c, t } = cardCanvas(x, x.typeColor, null, found);
    const img = new Image(); img.onload = () => { const r = cardCanvas(x, x.typeColor, img, found); c.getContext('2d').drawImage(r.c, 0, 0); t.needsUpdate = true; }; img.src = ctx.asset(`./pages/${x.page}.jpg`);
    const w = WELCOME.card[0], h = WELCOME.card[1] * PAGE_H;
    const card = new THREE.Mesh(new RoundedBoxGeometry(w, 0.006, h, 2, 0.003), [
      mat(0xf7f2e7), mat(0xf7f2e7), new THREE.MeshStandardMaterial({ map: t, roughness: 0.6 }), mat(0xf7f2e7), mat(0xf7f2e7), mat(0xf7f2e7),
    ]);
    shadowed(card);
    const holder = new THREE.Group(); holder.position.copy(P(u, v)); holder.add(card); g.add(holder);
    ctx.tap(card, () => ctx.ui.card({ tag: found ? 'اكتشفتها ✦' : x.typeLabel, title: x.title, body: found ? 'عُد إليها متى شئت، أو اكتشف صفحة أخرى.' : 'ابحث عنها في الباب الأول من الموسوعة، ووجّه الكاميرا نحوها.', color: x.typeColorHex }));
    return { holder, card, i };
  });

  return {
    update(t, dt, e) {
      const k = stag(t, 0.3, 0.9, easeBack) * e;
      seal.scale.setScalar(Math.max(k, 0.001));
      seal.position.y = 0.17 * ease((t - 0.3) / 1.2) + Math.sin(t * 1.8) * 0.006;
      seal.rotation.y = t * 0.9;
      waves.forEach((w) => { const p = ((t * 0.45 + w.off) % 1); w.w.scale.setScalar(0.4 + p * 1.8); w.w.material.opacity = (1 - p) * 0.8 * stag(t, 0.6, 0.6) * e; });
      const tk = stag(t, 1.0, 0.7, easeBack) * e;
      title.position.copy(center).add(new THREE.Vector3(0, 0.33, -0.02));
      title.scale.set(0.5 * tk, 0.5 * title.userData.aspect * tk, 1);
      const sk = stag(t, 1.4, 0.7, easeBack) * e;
      sub.position.copy(center).add(new THREE.Vector3(0, 0.05, 0.13));
      sub.scale.set(0.44 * sk, 0.44 * sub.userData.aspect * sk, 1);
      cards.forEach((c) => {
        const p = stag(t, 1.6 + c.i * 0.12, 0.7, easeBack);
        c.holder.position.y = 0.004 + p * 0.03 + Math.sin(t * 1.6 + c.i) * 0.003 * p;
        c.card.rotation.x = -0.45 * p;
        c.card.scale.setScalar(Math.max(e, 0.001));
      });
    },
  };
}

// ================================================================ Secret page: the typewriter (p8)
const LETTER = ['THANK YOU!', '', 'شكراً لك…', 'أيقظتَ صفحات الموسوعة كلها،', 'وعشتَ نظرياتها بنفسك.', '', '«إلى كل طالب وكل باحث', 'عن العلم والمعرفة»', '— من إهداء المؤلفَين'];

function drawLetter(c, chars) {
  const g = c.getContext('2d'), W = c.width, H = c.height;
  g.fillStyle = '#fffdf6'; g.fillRect(0, 0, W, H);
  g.strokeStyle = 'rgba(160,140,100,.18)'; g.lineWidth = 2;
  for (let y = 120; y < H - 30; y += 58) { g.beginPath(); g.moveTo(40, y + 14); g.lineTo(W - 40, y + 14); g.stroke(); }
  let left = chars, y = 90;
  LETTER.forEach((line, i) => {
    if (left <= 0) return;
    const part = [...line].slice(0, left).join(''); left -= [...line].length + 1;
    if (i === 0) { g.font = '700 46px "Courier New", monospace'; g.fillStyle = '#c0242b'; g.textAlign = 'center'; g.direction = 'ltr'; g.fillText(part, W / 2, y); }
    else { g.font = i >= 6 ? '700 34px "Reem Kufi", Tajawal' : '700 38px Tajawal, sans-serif'; g.fillStyle = i === 8 ? '#8a6a1f' : '#2b2620'; g.textAlign = 'right'; g.direction = 'rtl'; g.fillText(part, W - 50, y); }
    y += 58;
  });
}

function rose() {
  const r = new THREE.Group();
  const petal = new THREE.SphereGeometry(0.02, 16, 10, 0, Math.PI);
  const red = new THREE.MeshPhysicalMaterial({ color: 0xc8102e, roughness: 0.45, clearcoat: 0.4, side: THREE.DoubleSide });
  const petals = [];
  [[5, 0.6], [6, 0.9], [7, 1.2]].forEach(([n, ring], ri) => {
    for (let i = 0; i < n; i++) {
      const pv = new THREE.Group(); pv.rotation.y = (i / n) * TAU + ri * 0.4; r.add(pv);
      const m = new THREE.Mesh(petal, red); m.scale.set(0.7 * ring, 1.1, 0.5); m.position.set(0, 0.012, 0.004 * ring); pv.add(m);
      petals.push({ m, ring: ri });
    }
  });
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.003, 0.003, 0.08, 8), mat(0x2f7d32)); stem.position.y = -0.04; r.add(stem);
  r.userData.bloom = (p) => petals.forEach(({ m, ring }) => { m.rotation.x = -0.15 - p * (0.35 + ring * 0.35); });
  return shadowed(r);
}

export function buildSecret(ctx) {
  const g = new THREE.Group(); ctx.stage.add(g);
  const { done, total } = ctx.progress();
  const open = done >= total;
  const center = P(0.5, 0.47);

  const lock = new THREE.Group(); lock.position.copy(center); g.add(lock);
  const lockBody = new THREE.Mesh(new RoundedBoxGeometry(0.085, 0.07, 0.032, 3, 0.008), goldMat()); lock.add(lockBody);
  const shackleHold = new THREE.Group(); shackleHold.position.set(-0.026, 0.035, 0); lock.add(shackleHold);
  const shackle = new THREE.Mesh(new THREE.TorusGeometry(0.026, 0.0065, 14, 40, Math.PI), goldMat()); shackle.position.x = 0.026; shackleHold.add(shackle);
  const hole = new THREE.Mesh(new THREE.CylinderGeometry(0.007, 0.007, 0.004, 16), mat(0x1f1b16)); hole.rotation.x = Math.PI / 2; hole.position.set(0, -0.004, 0.0165); lock.add(hole);
  lock.add(glow(0xffd27a, 0.28, 0.6)); shadowed(lock);
  const dots = Array.from({ length: total }, (_, i) => {
    const a = (i / total) * TAU - Math.PI / 2;
    const d = new THREE.Mesh(new THREE.SphereGeometry(0.009, 14, 10), i < done ? goldMat() : mat(0xe8e2d4));
    d.position.set(Math.cos(a) * 0.1, Math.sin(-a) * 0.1, 0); lock.add(d); return d;
  });
  const title = sprite(open ? 'الصفحة السرّية' : 'صفحة سرّية', 0.3, { size: 50, width: 640, title: true, bg: 'rgba(31,27,22,.9)', color: '#f3dca2' });
  title.position.copy(center).add(new THREE.Vector3(0, 0.2, 0)); g.add(title);
  const hint = sprite(open ? 'فتحتَها! اقترب…' : `أكمل صفحات بابٍ كامل لتفتحها · ${toAr(done)} من ${toAr(total)}`, 0.42, { size: 38, width: 900, weight: 800, border: '#d4ad55' });
  hint.position.copy(center).add(new THREE.Vector3(0, 0.035, 0.2)); g.add(hint);
  ctx.tap(lockBody, () => ctx.ui.card(open
    ? { tag: 'الصفحة السرّية', title: 'رسالة لك', body: 'هذه الصفحة لا تفتح إلا لمن أيقظ صفحات الموسوعة كلها.', color: 0xc0242b }
    : { tag: 'صفحة سرّية', title: 'ما زالت مقفلة', body: 'كل صفحة حيّة تكملها تمنحك ختماً ذهبياً. حين تكمل باباً كاملاً، عُد إلى هذه الصفحة…', color: 0xd4ad55 }));

  let paper = null, letterCanvas = null, letterTex = null, typed = -1, flower = null;
  const LETTER_LEN = LETTER.reduce((n, l) => n + [...l].length + 1, 0);
  if (open) {
    letterCanvas = document.createElement('canvas'); letterCanvas.width = 560; letterCanvas.height = 660;
    letterTex = new THREE.CanvasTexture(letterCanvas); letterTex.colorSpace = THREE.SRGBColorSpace; letterTex.anisotropy = 4;
    drawLetter(letterCanvas, 0);
    paper = new THREE.Mesh(new THREE.PlaneGeometry(0.24, 0.285), new THREE.MeshStandardMaterial({ map: letterTex, roughness: 0.9, side: THREE.DoubleSide }));
    paper.castShadow = true; paper.visible = false; g.add(paper);
    flower = rose(); flower.position.copy(P(0.65, 0.45, 0.05)); flower.scale.setScalar(0.001); g.add(flower);
  }
  let shownCert = false, lastClick = 0;

  return {
    update(t, dt, e) {
      const k = stag(t, 0.2, 0.8, easeBack) * e;
      title.scale.set(0.3 * k, 0.3 * title.userData.aspect * k, 1);
      hint.scale.set(0.42 * k, 0.42 * hint.userData.aspect * k, 1);
      if (!open) {
        lock.scale.setScalar(Math.max(k, 0.001));
        lock.position.y = 0.14 + Math.sin(t * 1.6) * 0.008; lock.rotation.y = Math.sin(t * 0.7) * 0.5;
        return;
      }
      // Unlock, the letter rises from the typewriter and types itself, then the rose blooms.
      const gone = stag(t, 1.6, 0.4);
      lock.scale.setScalar(Math.max(k * (1 - gone), 0.001));
      lock.position.y = 0.14; lock.rotation.y = 0;
      shackleHold.rotation.z = -1.1 * ease((t - 0.7) / 0.6);
      if (t > 1.6 && !lock.userData.burst) { lock.userData.burst = true; ctx.fx.burst(lock.position.clone(), 0xffd27a, 46, 0.6, 0.045); ctx.sfx.stamp(); }
      const rise = stag(t, 1.9, 1.0);
      paper.visible = rise > 0.001 && e > 0.05;
      paper.position.copy(P(0.54, 0.33)).add(new THREE.Vector3(0, 0.02 + rise * 0.13, 0.02 + rise * 0.05));
      paper.rotation.x = -0.38 * rise;
      paper.scale.set(1, Math.max(rise, 0.001), 1);
      const chars = Math.floor(clamp01((t - 3.0) / 6.5) * LETTER_LEN);
      if (chars !== typed) { typed = chars; drawLetter(letterCanvas, chars); letterTex.needsUpdate = true; if (t - lastClick > 0.07) { lastClick = t; ctx.sfx.click(); } }
      const b = stag(t, 9.2, 1.6);
      flower.scale.setScalar(Math.max(easeBack(clamp01((t - 9.0) / 0.8)) * 1.6 * e, 0.001));
      flower.userData.bloom(b); flower.rotation.y = t * 0.3;
      if (t > 10.5 && !shownCert) {
        shownCert = true; ctx.fx.burst(flower.position.clone().setY(0.08), 0xff6b81, 30, 0.4, 0.035);
        ctx.ui.choices([{ label: '✦ احصل على شهادتك', primary: true, onPick: () => ctx.ui.certificate() }]);
      }
    },
  };
}
