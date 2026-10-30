// Doors three and four: a portal into the page, a phone that takes itself apart, Bloom's pyramid
// to rebuild, the digital-divide balance, a classroom role-play and a branching teacher's path.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { P, PAGE_H, INK, ease, easeBack, stag, clamp01, label, sprite, glow, goldMat, mat, glossy, paperMat, shadowed, lightTube } from './kit.js?v=6';
import { inked, printFrame } from './pencil.js?v=6';

const TAU = Math.PI * 2;
const toAr = (n) => String(n).replace(/\d/g, (d) => '٠١٢٣٤٥٦٧٨٩'[d]);
const css = (c) => '#' + c.toString(16).padStart(6, '0');
const setSprite = (s, w, k) => s.scale.set(w * k + 0.0001, w * s.userData.aspect * k + 0.0001, 1);

// A coloured light that stays coloured on white paper (additive glows wash out to white there).
let softTex;
function softLight(color, size = 0.05, opacity = 0.85) {
  if (!softTex) {
    const c = document.createElement('canvas'); c.width = c.height = 128;
    const g = c.getContext('2d');
    const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    grd.addColorStop(0, 'rgba(255,255,255,1)'); grd.addColorStop(0.2, 'rgba(255,255,255,.85)'); grd.addColorStop(0.5, 'rgba(255,255,255,.3)'); grd.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grd; g.fillRect(0, 0, 128, 128);
    softTex = new THREE.CanvasTexture(c);
  }
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: softTex, color, transparent: true, opacity, depthWrite: false }));
  s.scale.setScalar(size);
  return s;
}

function emojiDisc(emoji, color, size = 0.07) {
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(128, 128, 20, 128, 128, 128);
  grd.addColorStop(0, '#ffffff'); grd.addColorStop(0.62, css(color)); grd.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grd; g.beginPath(); g.arc(128, 128, 128, 0, TAU); g.fill();
  g.font = '120px "Apple Color Emoji","Segoe UI Emoji",sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(emoji, 128, 136);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthWrite: false, toneMapped: false }));
  s.scale.setScalar(size); return s;
}

// ================================================================ 5. Portal: a window opens in the page (p395)
const HEX = { u: 0.256, v: 0.585, r: 0.185 };
export const PORTAL_HOLE = { type: 'hex', u: HEX.u, v: HEX.v, r: HEX.r };

function hexPoints(r) { return Array.from({ length: 6 }, (_, i) => { const a = (i / 6) * TAU; return [Math.cos(a) * r, Math.sin(a) * r]; }); }

function starWall() {
  const c = document.createElement('canvas'); c.width = 512; c.height = 512;
  const g = c.getContext('2d');
  const grd = g.createLinearGradient(0, 0, 0, 512);
  grd.addColorStop(0, '#0b1b3a'); grd.addColorStop(1, '#2a1350');
  g.fillStyle = grd; g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 160; i++) { g.fillStyle = `rgba(255,255,255,${0.3 + Math.random() * 0.7})`; g.beginPath(); g.arc(Math.random() * 512, Math.random() * 512, Math.random() * 1.6 + 0.3, 0, TAU); g.fill(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

export function buildPortal(ctx) {
  const g = new THREE.Group(); g.position.copy(P(HEX.u, HEX.v)); ctx.stage.add(g);
  const R = HEX.r, DEPTH = 0.3;
  // Depth-only page with a hexagonal hole: it hides the world below the paper except through the hole.
  const sheet = new THREE.Shape(); sheet.moveTo(-2, -2); sheet.lineTo(2, -2); sheet.lineTo(2, 2); sheet.lineTo(-2, 2); sheet.closePath();
  const hole = new THREE.Path(); hexPoints(R).forEach(([x, z], i) => (i ? hole.lineTo(x, z) : hole.moveTo(x, z))); hole.closePath(); sheet.holes.push(hole);
  const occluder = new THREE.Mesh(new THREE.ShapeGeometry(sheet), new THREE.MeshBasicMaterial({ colorWrite: false, side: THREE.DoubleSide }));
  occluder.rotation.x = Math.PI / 2; occluder.position.y = 0.0008; occluder.renderOrder = 1; g.add(occluder);

  const world = new THREE.Group(); g.add(world);
  const room = new THREE.Mesh(new THREE.BoxGeometry(2.2 * R, DEPTH, 2 * R), new THREE.MeshBasicMaterial({ map: starWall(), side: THREE.BackSide }));
  room.position.y = -DEPTH / 2; room.renderOrder = 2; world.add(room);
  const grid = new THREE.GridHelper(2 * R, 12, 0x6fe7ff, 0x3a7bd5); grid.position.y = -DEPTH + 0.002; grid.material.transparent = true; grid.material.opacity = 0.75; grid.renderOrder = 3; world.add(grid);

  const planet = new THREE.Mesh(new THREE.SphereGeometry(0.045, 32, 20), new THREE.MeshBasicMaterial({ color: 0x7c5cff }));
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.004, 8, 60), new THREE.MeshBasicMaterial({ color: 0xffd27a }));
  ring.rotation.x = 1.2; planet.add(ring); planet.position.set(-0.08, -0.17, -0.06); planet.renderOrder = 3; world.add(planet);
  const headset = new THREE.Group();
  const shell = new THREE.Mesh(new RoundedBoxGeometry(0.11, 0.05, 0.06, 3, 0.015), new THREE.MeshStandardMaterial({ color: 0xf2f2f6, roughness: 0.35, emissive: 0x223355, emissiveIntensity: 0.4 }));
  headset.add(shell);
  [-0.026, 0.026].forEach((x) => { const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.017, 0.017, 0.01, 24), new THREE.MeshBasicMaterial({ color: 0x45c6ff })); lens.rotation.x = Math.PI / 2; lens.position.set(x, 0, 0.031); headset.add(lens); });
  const strap = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.006, 8, 40, Math.PI), new THREE.MeshStandardMaterial({ color: 0x2b2b35 })); strap.rotation.x = -Math.PI / 2; strap.position.z = -0.01; headset.add(strap);
  headset.position.set(0.05, -0.1, 0.02); headset.traverse((o) => (o.renderOrder = 3)); world.add(headset);

  const senses = [
    { e: '👁️', n: 'البصر', c: 0x45c6ff, at: [-0.11, -0.08, 0.08] },
    { e: '👂', n: 'السمع', c: 0xffb347, at: [0.12, -0.13, -0.09] },
    { e: '✋', n: 'اللمس', c: 0x7cd992, at: [0.0, -0.21, 0.12] },
  ].map((s) => { const d = emojiDisc(s.e, s.c, 0.085); d.position.set(...s.at); d.renderOrder = 4; world.add(d); return { ...s, d }; });
  const motes = Array.from({ length: 40 }, () => { const m = glow(0x9fe8ff, 0.012, 0.8); m.position.set((Math.random() - 0.5) * 2 * R, -Math.random() * DEPTH, (Math.random() - 0.5) * 1.8 * R); m.renderOrder = 4; world.add(m); return m; });

  // The golden frame on the page.
  const ringShape = new THREE.Shape(); hexPoints(R + 0.014).forEach(([x, z], i) => (i ? ringShape.lineTo(x, z) : ringShape.moveTo(x, z))); ringShape.closePath();
  const inner = new THREE.Path(); hexPoints(R).forEach(([x, z], i) => (i ? inner.lineTo(x, z) : inner.moveTo(x, z))); inner.closePath(); ringShape.holes.push(inner);
  const frame = new THREE.Mesh(new THREE.ExtrudeGeometry(ringShape, { depth: 0.008, bevelEnabled: false }), goldMat());
  frame.rotation.x = Math.PI / 2; frame.position.y = 0.008; g.add(frame);
  const halo = glow(0x9fe8ff, 0.55, 0); halo.position.y = 0.01; g.add(halo);

  const card = (s) => ctx.ui.card({ tag: 'الحواس في الواقع الافتراضي', title: s.n, body: 'يعرّفه الشرهان بأنه «عروض بانورامية ترتبط بها الحواس الثلاث: العين والسمع واللمس»، تُعرض فيها المعلومات والصور والرسوم الثلاثية الأبعاد والصوت والحركة لتشكّل عالماً يشابه الواقع.', color: s.c });
  const seen = new Set();
  senses.forEach((s) => ctx.tap(s.d, () => { seen.add(s.n); card(s); if (seen.size === 3) ctx.ui.done(); }));
  ctx.tap(headset, () => ctx.ui.card({ tag: 'من ابتكر المصطلح؟', title: 'جارون لانير', body: 'حاول أن ينشئ عالماً افتراضياً ينقل الوعي الإنساني إلى بيئة إلكترونية؛ عالمٌ ليس وهمياً وليس حقيقياً، تُعاش أحداثه في واقع مفترض.', color: 0x7c5cff }));
  ctx.ui.hud('انظر داخل الصفحة… والمس الحواس الثلاث');
  let dive = 0, diveTo = 0;
  ctx.ui.choices([
    { label: 'تعمّق في العالم', primary: true, onPick: () => { diveTo = diveTo ? 0 : 1; ctx.sfx.whoosh(); } },
    { label: 'ما الواقع الافتراضي؟', onPick: () => ctx.ui.card({ tag: 'الواقع الافتراضي (VR)', title: 'محاكاة الحاسوب لبيئة تشبه الواقع', body: 'مصطلح ينطبق على محاكاة الحاسوب لبيئات يمكن محاكاتها مادياً في العالم الحقيقي، أو لعوالم خيالية لا وجود لها في دنيا الواقع.', color: 0x45c6ff }) },
  ]);

  return {
    update(t, dt, e) {
      const k = stag(t, 0.3, 0.9, easeBack) * e;
      frame.scale.setScalar(Math.max(k, 0.001));
      halo.material.opacity = 0.5 * e * (0.7 + 0.3 * Math.sin(t * 2));
      world.visible = e > 0.02;
      dive = THREE.MathUtils.damp(dive, diveTo, 2.5, dt);
      world.position.y = -0.12 * (1 - stag(t, 0.6, 1.2)) + dive * 0.09;
      planet.rotation.y += dt * 0.6; ring.rotation.z += dt * 0.3;
      headset.rotation.y = Math.sin(t * 0.8) * 0.6; headset.position.y = -0.1 + Math.sin(t * 1.4) * 0.012;
      senses.forEach((s, i) => { s.d.position.y = s.at[1] + Math.sin(t * 1.6 + i * 2) * 0.012; s.d.material.opacity = stag(t, 1.4 + i * 0.25, 0.6) * e; });
      motes.forEach((m, i) => { m.position.y += dt * 0.03; if (m.position.y > -0.01) m.position.y = -DEPTH + 0.01; m.material.opacity = 0.8 * e * (0.5 + 0.5 * Math.sin(t * 3 + i)); });
    },
  };
}

// ================================================================ 6. Take the phone apart (p541)
const LAYERS = [
  { n: 'الشاشة', a: 'المحتوى في جيبك', d: 'الدرس والفيديو والكتاب في جيب الطالب، يفتحه حيث كان.', c: 0x45c6ff },
  { n: 'اللمس', a: 'التعلّم بالتفاعل', d: 'يلمس المتعلّم المحتوى ويحرّكه ويجيب، فيصبح مشاركاً لا متلقياً.', c: 0x7cd992 },
  { n: 'الكاميرا', a: 'الواقع المعزّز', d: 'الكاميرا نافذة تضيف المعرفة إلى العالم الحقيقي، كما تفعل الآن مع هذه الصفحة.', c: 0xffb347 },
  { n: 'المعالج', a: 'تطبيقات تعليمية ذكية', d: 'قدرة حاسوبية في اليد تشغّل المحاكاة والألعاب والتطبيقات التعليمية.', c: 0xb07cff },
  { n: 'الهوائي', a: 'التعلّم في أي مكان', d: 'الاتصال بالشبكة يصل المتعلّم بالمصادر والمعلّم والزملاء.', c: 0xd4ad55 },
  { n: 'البطارية', a: 'التعلّم في أي وقت', d: 'جهاز يرافق المتعلّم طوال يومه، فيتعلّم متى شاء.', c: 0xe0453c },
];
const SYNONYMS = ['التعلّم المتنقل', 'التعلّم النقال', 'التعلّم المتحرك', 'التعلّم الجوال', 'التعلّم بالموبايل'];

function phoneScreen() {
  const c = document.createElement('canvas'); c.width = 256; c.height = 480;
  const g = c.getContext('2d');
  const grd = g.createLinearGradient(0, 0, 0, 480); grd.addColorStop(0, '#d8f3ff'); grd.addColorStop(1, '#ffffff');
  g.fillStyle = grd; g.fillRect(0, 0, 256, 480);
  g.fillStyle = '#2a8fd0'; g.beginPath(); g.arc(128, 200, 70, 0, TAU); g.fill();
  g.fillStyle = '#7cc46a'; [[100, 175, 30, 22], [150, 220, 28, 20], [120, 240, 18, 12]].forEach(([x, y, w, h]) => { g.beginPath(); g.ellipse(x, y, w, h, 0.3, 0, TAU); g.fill(); });
  [['#e0453c', 300], ['#d4ad55', 322], ['#2a8fd0', 344]].forEach(([col, y]) => { g.fillStyle = col; g.fillRect(70, y, 116, 18); });
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

export function buildPhone(ctx) {
  const g = new THREE.Group(); g.position.copy(P(0.275, 0.72)); ctx.stage.add(g);
  const W = 0.12, H = 0.22, T = 0.008;
  const holder = new THREE.Group(); holder.position.y = H / 2 + 0.02; g.add(holder);
  const parts = LAYERS.map((L, i) => {
    const part = new THREE.Group(); holder.add(part);
    let body;
    if (i === 0) body = new THREE.Mesh(new RoundedBoxGeometry(W, H, T, 3, 0.012), [mat(0x1d2126), mat(0x1d2126), mat(0x1d2126), mat(0x1d2126), new THREE.MeshBasicMaterial({ map: phoneScreen(), toneMapped: false }), mat(0x1d2126)]);
    else if (i === 1) body = new THREE.Mesh(new RoundedBoxGeometry(W * 0.96, H * 0.96, 0.003, 2, 0.01), new THREE.MeshStandardMaterial({ color: 0xbff1d0, transparent: true, opacity: 0.55, emissive: 0x7cd992, emissiveIntensity: 0.5 }));
    else if (i === 2) { body = new THREE.Group(); const cam = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.008, 24), mat(0x222831)); cam.rotation.x = Math.PI / 2; cam.position.set(-0.03, 0.08, 0); body.add(cam); const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.01, 24), new THREE.MeshBasicMaterial({ color: 0xffb347 })); lens.rotation.x = Math.PI / 2; lens.position.set(-0.03, 0.08, 0.002); body.add(lens); const plate = new THREE.Mesh(new RoundedBoxGeometry(W * 0.8, H * 0.8, 0.002, 2, 0.008), new THREE.MeshStandardMaterial({ color: 0xffe4bf, transparent: true, opacity: 0.35 })); body.add(plate); }
    else if (i === 3) { body = new THREE.Group(); body.add(new THREE.Mesh(new RoundedBoxGeometry(W * 0.86, H * 0.55, 0.004, 2, 0.006), mat(0x1f7a46, { roughness: 0.5 }))); [[0, 0.02, 0.03], [-0.03, -0.03, 0.02], [0.03, -0.035, 0.018]].forEach(([x, y, s]) => { const chip = new THREE.Mesh(new THREE.BoxGeometry(s, s, 0.006), mat(0x22252b, { metalness: 0.4 })); chip.position.set(x, y, 0.004); body.add(chip); }); }
    else if (i === 4) { body = new THREE.Group(); const pts = [[-0.05, 0.1], [0.05, 0.1], [0.05, -0.1], [-0.05, -0.1], [-0.05, 0.1]].map(([x, y]) => new THREE.Vector3(x, y, 0)); body.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, false, 'catmullrom', 0.05), 80, 0.0022, 6), goldMat())); }
    else { body = new THREE.Group(); const bat = new THREE.Mesh(new RoundedBoxGeometry(W * 0.75, H * 0.6, 0.01, 2, 0.006), mat(0x3a3f47)); body.add(bat); const bolt = label('⚡', 0.05, { size: 150, bg: null, width: 220, pad: 0 }); bolt.position.z = 0.0055; body.add(bolt); }
    part.add(body); shadowed(part);
    const tag = sprite(`${L.n} · ${L.a}`, 0.2, { size: 34, width: 600, weight: 800, border: css(L.c) });
    tag.position.set(0.17, 0, 0); tag.visible = false; part.add(tag);
    ctx.tap(part, () => pick(i));
    return { L, part, tag, i };
  });
  const back = new THREE.Mesh(new RoundedBoxGeometry(W, H, 0.006, 3, 0.012), glossy(0xd8322f)); back.position.z = -0.006; holder.add(back);
  const ringG = new THREE.Group(); ringG.position.y = H / 2 + 0.02; g.add(ringG);
  const orbit = SYNONYMS.map((s, i) => { const sp = sprite(s, 0.15, { size: 36, width: 460, weight: 800, bg: 'rgba(31,27,22,.85)', color: '#f3dca2' }); ringG.add(sp); return { sp, a: (i / SYNONYMS.length) * TAU }; });

  const seen = new Set();
  let ex = 0, exTo = 0;
  function pick(i) {
    const L = LAYERS[i]; seen.add(i); ctx.sfx.tap();
    ctx.ui.card({ tag: L.n, title: L.a, body: L.d, color: L.c });
    if (seen.size >= 4) ctx.ui.done();
  }
  const setChoices = () => ctx.ui.choices([
    { label: exTo ? 'ركّب الجهاز' : 'فكّك الجهاز', primary: true, onPick: () => { exTo = exTo ? 0 : 1; ctx.sfx.whoosh(); setChoices(); } },
    { label: 'سباق المليار', onPick: () => ctx.ui.card({ tag: 'حقيقة من الصفحة', title: '١٢٨ عاماً مقابل أقل من ٢٠', body: 'احتاجت خطوط الهاتف الثابتة ١٢٨ عاماً لتصل إلى مليار مستخدم، وحققت شبكات الهاتف المحمول الإنجاز نفسه في زمن لا يكاد يتجاوز عشرين عاماً.', color: 0xd4ad55 }) },
  ]);
  setChoices();
  ctx.ui.hud('فكّك الجوال، والمس كل طبقة لتعرف ما تقدّمه للتعلّم');

  return {
    update(t, dt, e) {
      const k = stag(t, 0.3, 0.8, easeBack) * e;
      g.scale.setScalar(Math.max(k, 0.001));
      ex = THREE.MathUtils.damp(ex, exTo, 3.5, dt);
      holder.rotation.y = -0.35 * ex + Math.sin(t * 0.6) * 0.05;
      parts.forEach((p) => {
        p.part.position.set(-p.i * 0.012 * ex, p.i * 0.006 * ex, (0.004 - p.i * 0.003) - p.i * 0.045 * ex);
        p.tag.visible = ex > 0.6;
        setSprite(p.tag, 0.2, clamp01((ex - 0.6) * 2.5));
      });
      back.position.z = -0.006 - 6 * 0.045 * ex - 0.02 * ex;
      orbit.forEach((o, i) => {
        const a = o.a + t * 0.35;
        o.sp.position.set(Math.cos(a) * 0.2, Math.sin(a * 2) * 0.03 + 0.06, Math.sin(a) * 0.14);
        setSprite(o.sp, 0.15, stag(t, 1.2 + i * 0.12, 0.5) * e * (1 - ex * 0.7));
      });
    },
  };
}

// ================================================================ 7. Rebuild Bloom's pyramid (p573)
const BLOOM = [
  { n: 'المعرفة', d: 'تذكّر المعلومات واسترجاعها؛ أدنى المستويات.', c: 0x2a8fd0 },
  { n: 'الفهم', d: 'إدراك المعنى والتعبير عنه بأسلوب المتعلّم.', c: 0x1fa5a0 },
  { n: 'التطبيق', d: 'استخدام ما تعلّمه في مواقف جديدة.', c: 0x8a9a1f },
  { n: 'التحليل', d: 'تجزئة المادة إلى عناصرها وإدراك العلاقات بينها.', c: 0xe0a030 },
  { n: 'التركيب', d: 'عكس التحليل: تجميع الأجزاء لتكوين مادة جديدة.', c: 0xe06a2a },
  { n: 'التقييم', d: 'أعلى المستويات: الحكم على قيمة المادة في ضوء معايير محددة.', c: 0xb5202f },
];

// A second, cinematic reading of the same printed page. It shares the existing
// image target and stamp with the hands-on pyramid, so no duplicate target is needed.
function bloomCinematic(ctx) {
  const group = new THREE.Group(); group.position.copy(P(0.33, 0.76)); group.visible = false; ctx.stage.add(group);
  const gold = new THREE.MeshStandardMaterial({ color: 0xf3cb78, metalness: 0.75, roughness: 0.23, emissive: 0x76511a, emissiveIntensity: 0.16 });
  const base = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(0.205, 0.22, 0.012, 48), gold)); base.position.y = 0.008; group.add(base);
  const rings = [], tiers = [], labels = [], stars = [];
  BLOOM.forEach((b, i) => {
    const radius = 0.18 - i * 0.019;
    const material = new THREE.MeshPhysicalMaterial({ color: b.c, metalness: 0.32, roughness: 0.23, clearcoat: 1,
      emissive: b.c, emissiveIntensity: 0.15, transparent: true, opacity: 0.96 });
    const tier = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(radius - 0.017, radius, 0.052, 6), material));
    tier.position.y = 0.043 + i * 0.054; tier.rotation.y = Math.PI / 6; group.add(tier); tiers.push(tier);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(radius - 0.012, 0.0025, 6, 6), gold);
    ring.rotation.x = Math.PI / 2; ring.rotation.z = Math.PI / 6; ring.position.y = 0.069 + i * 0.054; group.add(ring); rings.push(ring);
    const tag = sprite(b.n, 0.115, { size: 48, width: 340, weight: 800, bg: 'rgba(20,27,34,.9)', color: '#fff3d7', border: css(b.c) });
    tag.position.set(-radius - 0.065, tier.position.y, 0.015); group.add(tag); labels.push(tag);
    ctx.tap(tier, () => ctx.ui.card({ tag: `المستوى ${toAr(i + 1)} من ٦`, title: b.n, body: b.d, color: b.c }));
    ctx.tap(tag, () => ctx.ui.card({ tag: `المستوى ${toAr(i + 1)} من ٦`, title: b.n, body: b.d, color: b.c }));
  });
  const crown = new THREE.Mesh(new THREE.OctahedronGeometry(0.037),
    new THREE.MeshPhysicalMaterial({ color: 0xffe4a4, metalness: 0.4, roughness: 0.12, emissive: 0xffbd55, emissiveIntensity: 0.65 }));
  crown.position.y = 0.4; group.add(crown);
  for (let i = 0; i < 40; i++) {
    const a = i * 2.399, r = 0.17 + (i % 6) * 0.012;
    const star = new THREE.Mesh(new THREE.SphereGeometry(0.0018 + (i % 3) * 0.0008, 6, 6),
      new THREE.MeshBasicMaterial({ color: i % 3 ? 0xffd991 : 0xffffff, transparent: true, opacity: 0.7 }));
    star.position.set(Math.cos(a) * r, 0.025 + (i % 12) * 0.03, Math.sin(a) * r); group.add(star); stars.push(star);
  }
  const light = new THREE.PointLight(0xffd184, 1.8, 0.9); light.position.set(-0.1, 0.42, 0.16); group.add(light);
  let began = 0, focus = 0;
  return {
    group,
    start(t) { began = t; group.visible = true; ctx.ui.hud('هرم بلوم يرتفع من الصفحة — المس أي مستوى'); },
    stop() { group.visible = false; },
    next() { focus = (focus + 1) % BLOOM.length; const b = BLOOM[focus]; ctx.ui.card({ tag: `المستوى ${toAr(focus + 1)} من ٦`, title: b.n, body: b.d, color: b.c }); },
    update(t, e) {
      if (!group.visible) return;
      tiers.forEach((tier, i) => {
        const k = ease((t - began - i * 0.22) / 0.65) * e;
        tier.scale.set(k, k, k); tier.material.emissiveIntensity = i === focus ? 0.42 : 0.13;
        rings[i].scale.setScalar(k); setSprite(labels[i], 0.115, k);
      });
      const k = ease((t - began - 1.3) / 0.6) * e; crown.scale.setScalar(k); crown.rotation.y = t * 0.55;
      stars.forEach((star, i) => { star.position.y = 0.025 + (i % 12) * 0.03 + Math.sin(t * 1.8 + i) * 0.005; star.material.opacity = (0.4 + 0.3 * Math.sin(t * 2 + i)) * e; });
    },
  };
}

export function buildBloom(ctx) {
  const g = new THREE.Group(); g.position.copy(P(0.33, 0.76)); ctx.stage.add(g);
  const cinematic = bloomCinematic(ctx);
  const TH = 0.034;
  const tiers = BLOOM.map((b, k) => {
    const w = 0.3 - k * 0.042;
    const holder = new THREE.Group(); g.add(holder);
    const block = inked(new RoundedBoxGeometry(w, TH, w * 0.6, 2, 0.006), { color: 0xfbf7ee, hullScale: 1.03 }); holder.add(block);
    const band = new THREE.Mesh(new RoundedBoxGeometry(w + 0.004, TH * 0.32, w * 0.6 + 0.004, 2, 0.003), new THREE.MeshBasicMaterial({ color: b.c, toneMapped: false }));
    holder.add(band);
    const tag = sprite(b.n, 0.1, { size: 46, width: 300, weight: 800, border: css(b.c) }); tag.position.set(0, TH / 2 + 0.03, w * 0.3); holder.add(tag);
    // Scattered start: floating in a ring above the page.
    const a = (k / BLOOM.length) * TAU + 0.6;
    const home = new THREE.Vector3(Math.cos(a) * 0.2 + 0.02, 0.2 + (k % 3) * 0.05, Math.sin(a) * 0.13 - 0.15);
    const slot = new THREE.Vector3(0, TH / 2 + k * TH, 0);
    ctx.tap(holder, () => pick(k));
    return { b, k, holder, block, band, tag, home, slot, placedAt: -1, shake: 0, spin: Math.random() * TAU };
  });
  const crown = glow(0xffd27a, 0.3, 0); g.add(crown);
  let next = 0, now = 0, finishedAt = -1;
  function pick(k) {
    const tr = tiers[k];
    if (tr.placedAt >= 0) { ctx.ui.card({ tag: `المستوى ${toAr(k + 1)}`, title: tr.b.n, body: tr.b.d, color: tr.b.c }); return; }
    if (k !== next) { tr.shake = 1; ctx.sfx.bad(); ctx.ui.toast(next === 0 ? 'ابدأ من القاعدة: أدنى مستوى' : `ليس بعد… ما المستوى الذي يلي «${BLOOM[next - 1].n}»؟`); return; }
    tr.placedAt = now; next += 1; ctx.sfx.good();
    ctx.ui.card({ tag: `المستوى ${toAr(k + 1)} من ٦`, title: tr.b.n, body: tr.b.d, color: tr.b.c });
    ctx.ui.hud(next < 6 ? `بنيت ${toAr(next)} من ٦ — ما التالي؟` : 'اكتمل هرم بلوم!');
    if (next === 6) { finishedAt = now; ctx.fx.burst(new THREE.Vector3(0, TH * 6 + 0.04, 0).add(g.position), 0xffd27a, 46, 0.55, 0.04); ctx.ui.done(); }
  }
  ctx.ui.hud('ابنِ هرم بلوم: المس المستويات من الأدنى إلى الأعلى');
  const assemblyChoices = () => ctx.ui.choices([
    { label: '✦ شاهد الهرم ينبض', primary: true, onPick: () => { g.visible = false; cinematic.start(now); ctx.ui.choices([
      { label: 'المستوى التالي', onPick: cinematic.next },
      { label: '↶ ركّب الهرم', primary: true, onPick: () => { cinematic.stop(); g.visible = true; ctx.ui.hud(next < 6 ? `بنيت ${toAr(next)} من ٦ — ما التالي؟` : 'اكتمل هرم بلوم!'); assemblyChoices(); } },
    ]); } },
    { label: 'مراجعة أندرسون ٢٠٠١', onPick: () => ctx.ui.card({ tag: 'تطوير التصنيف', title: 'من الأسماء إلى الأفعال', body: 'عدّلت لورين أندرسون وزملاؤها التصنيف ليلائم طلبة القرن الحادي والعشرين: صارت المستويات أفعالاً، ووُضع الإبداع في القمة.', color: 0xb5202f }) },
  ]);
  assemblyChoices();

  return {
    update(t, dt, e) {
      now = t;
      cinematic.update(t, e);
      if (!g.visible) return;
      tiers.forEach((tr) => {
        tr.block.userData.reveal(stag(t, 0.2 + tr.k * 0.12, 0.9, clamp01) * e);
        tr.shake = Math.max(0, tr.shake - dt * 2);
        if (tr.placedAt < 0) {
          tr.holder.position.copy(tr.home); tr.holder.position.y += Math.sin(t * 1.3 + tr.k) * 0.01;
          tr.holder.position.x += Math.sin(t * 40) * 0.01 * tr.shake;
          tr.holder.rotation.y = Math.sin(t * 0.5 + tr.spin) * 0.4;
        } else {
          const p = ease((t - tr.placedAt) / 0.7);
          tr.holder.position.lerpVectors(tr.home, tr.slot, p); tr.holder.position.y += Math.sin(p * Math.PI) * 0.08;
          tr.holder.rotation.y *= 1 - p;
        }
        tr.band.material.opacity = 1;
        setSprite(tr.tag, 0.1, stag(t, 1.0 + tr.k * 0.1, 0.5) * e);
      });
      crown.position.set(0, TH * 6 + 0.04, 0);
      crown.material.opacity = finishedAt >= 0 ? 0.9 * ease((t - finishedAt) / 0.8) * (0.8 + 0.2 * Math.sin(t * 4)) * e : 0;
    },
  };
}

// ================================================================ 8. The digital-divide balance (p587)
// Mobile broadband subscriptions per 100 people, from the chart printed on the page (ITU, 2012).
const GCC = [['الكويت', 63.5], ['الإمارات', 58.4], ['السعودية', 57.8]];
const OTHERS = [['ليبيا', 42.7], ['المغرب', 10.0], ['مصر', 6.4], ['الأردن', 2.4], ['سوريا', 1.3], ['الجزائر', 0.0]];
const FACTORS = [
  { n: 'الدعم الحكومي', w: 15, d: 'ليبيا بلغت ٤٢٫٧ اشتراكاً لكل ١٠٠ شخص بفضل الدعم الحكومي، فاقتربت من دول الخليج.', libya: true },
  { n: 'البنية التحتية', w: 13, d: 'يعود التفاوت بين البلدان العربية إلى توافر البنى التحتية الاتصالية واستخدام الإنترنت.' },
  { n: 'كسر الاحتكار', w: 12, d: 'تُعزى التكلفة العالية لخدمات الاتصالات في البلدان العربية في المقام الأول إلى الاحتكارات.' },
  { n: 'المحتوى العربي', w: 10, d: 'اللغة العربية لا تتجاوز ١٪ من محتوى الإنترنت، مقابل ٦٨٫٨٪ للإنجليزية.' },
  { n: 'سياسات التنمية المعلوماتية', w: 10, d: 'من أسباب الفجوة عجز بعض القيادات في البلدان النامية عن وضع سياسات للتنمية المعلوماتية.' },
];
const avg = (a) => a.reduce((s, [, v]) => s + v, 0) / a.length;

export function buildBalance(ctx) {
  const g = new THREE.Group(); g.position.copy(P(0.56, 0.78)); ctx.stage.add(g);
  const base = inked(new THREE.CylinderGeometry(0.05, 0.06, 0.012, 32)); base.position.y = 0.006; g.add(base);
  const pole = inked(new THREE.CylinderGeometry(0.006, 0.008, 0.22, 16)); pole.position.y = 0.12; g.add(pole);
  const beam = new THREE.Group(); beam.position.y = 0.235; g.add(beam);
  const bar = inked(new RoundedBoxGeometry(0.52, 0.01, 0.014, 2, 0.004)); beam.add(bar);
  beam.add(new THREE.Mesh(new THREE.SphereGeometry(0.012, 16, 12), goldMat()));
  const pans = [-0.25, 0.25].map((x) => {
    const hang = new THREE.Group(); hang.position.x = x; beam.add(hang);
    const rope = new THREE.Mesh(new THREE.CylinderGeometry(0.0015, 0.0015, 0.12, 6), mat(0x8a6a1f)); rope.position.y = -0.06; hang.add(rope);
    const plate = inked(new THREE.CylinderGeometry(0.075, 0.06, 0.008, 40)); plate.position.y = -0.12; hang.add(plate);
    const stack = new THREE.Group(); stack.position.y = -0.116; hang.add(stack);
    return { hang, plate, stack };
  });
  const [othersPan, gccPan] = pans;
  const blockFor = (value, color, i, n) => {
    const h = Math.max(0.004, value / 100 * 0.12);
    const m = new THREE.Mesh(new RoundedBoxGeometry(0.03, h, 0.03, 2, 0.004), glossy(color, { emissive: color, emissiveIntensity: 0.2 }));
    const a = (i / n) * TAU; m.position.set(Math.cos(a) * 0.035, h / 2, Math.sin(a) * 0.035);
    return shadowed(m);
  };
  GCC.forEach(([, v], i) => gccPan.stack.add(blockFor(v, 0xd4ad55, i, GCC.length)));
  OTHERS.forEach(([, v], i) => othersPan.stack.add(blockFor(v, 0x7cc46a, i, OTHERS.length)));
  const gccTag = sprite(`دول الخليج · ${toAr(avg(GCC).toFixed(1))}`, 0.18, { size: 36, width: 560, weight: 800, border: '#d4ad55' });
  const othText = (w) => `دول عربية أخرى · ${toAr(w.toFixed(1))}`;
  const othTag = sprite(othText(avg(OTHERS)), 0.18, { size: 36, width: 560, weight: 800, border: '#7cc46a' });
  [gccTag, othTag].forEach((tag) => { tag.material.depthTest = false; tag.renderOrder = 9; });
  g.add(gccTag, othTag);
  const libyaFrame = printFrame(0.57, 0.452, 0.46, 0.032, '#e7b43a'); g.parent.add(libyaFrame);

  const added = [];
  let weight = avg(OTHERS), angle = 0, now = 0, balancedAt = -1;
  function addFactor(f) {
    if (added.includes(f)) return;
    added.push(f); weight += f.w; ctx.sfx.pop();
    // The tag follows the growing weight.
    const fresh = sprite(othText(weight), 0.18, { size: 36, width: 560, weight: 800, border: '#7cc46a' });
    othTag.material.map.dispose(); othTag.material.map = fresh.material.map; othTag.material.needsUpdate = true;
    const cube = new THREE.Mesh(new RoundedBoxGeometry(0.034, 0.03, 0.034, 2, 0.006), new THREE.MeshStandardMaterial({ color: 0x9fe8ff, emissive: 0x45c6ff, emissiveIntensity: 0.6, roughness: 0.3 }));
    const idx = added.length - 1, y1 = 0.065 + Math.floor(idx / 3) * 0.033;
    cube.position.set((idx % 3 - 1) * 0.036, y1 + 0.15, 0); cube.userData = { drop: now, y1 };
    othersPan.stack.add(shadowed(cube));
    ctx.ui.card({ tag: `عامل لسدّ الفجوة · +${toAr(f.w)}`, title: f.n, body: f.d, color: 0x45c6ff });
    if (f.libya) libyaFrame.userData.on = now;
    setChoices();
    if (Math.abs(weight - avg(GCC)) < 2 && balancedAt < 0) {
      balancedAt = now;
      setTimeout(() => { ctx.fx.burst(g.position.clone().setY(0.3), 0xffd27a, 46, 0.55, 0.04); ctx.sfx.good(); ctx.ui.card({ tag: 'توازن الميزان', title: 'سددتَ الفجوة الرقمية', body: `لا يسدّ الفجوة عاملٌ واحد؛ اجتمعت ${toAr(added.length)} عوامل (${added.map((x) => x.n).join('، ')}) حتى تعادلت الكفّتان.`, color: 0xd4ad55 }); ctx.ui.done(); }, 900);
    }
  }
  function setChoices() { ctx.ui.choices(FACTORS.filter((f) => !added.includes(f)).map((f) => ({ label: `+ ${f.n}`, onPick: () => addFactor(f) }))); }
  setChoices();
  ctx.ui.hud('أضف عوامل سدّ الفجوة حتى تتعادل الكفّتان');

  return {
    update(t, dt, e) {
      now = t;
      const k = stag(t, 0.2, 0.8, easeBack) * e;
      g.scale.setScalar(Math.max(k, 0.001));
      [base, pole, bar, ...pans.map((p) => p.plate)].forEach((s, i) => s.userData.reveal(stag(t, 0.1 + i * 0.1, 0.9, clamp01) * e));
      const target = THREE.MathUtils.clamp((avg(GCC) - weight) / 60, -1, 1) * 0.42;
      angle = THREE.MathUtils.damp(angle, stag(t, 1.4, 0.8) * target, 3, dt);
      beam.rotation.z = -angle;
      pans.forEach((p) => (p.hang.rotation.z = angle));
      othersPan.stack.children.forEach((c) => { if (c.userData.drop !== undefined) c.position.y = c.userData.y1 + 0.15 * (1 - easeBack((now - c.userData.drop) / 0.6)); });
      const wp = new THREE.Vector3();
      // Each tag floats just above its end of the beam, so the beam never crosses the text.
      gccPan.hang.getWorldPosition(wp); g.worldToLocal(wp); gccTag.position.copy(wp).add(new THREE.Vector3(0, 0.07, 0));
      othersPan.hang.getWorldPosition(wp); g.worldToLocal(wp); othTag.position.copy(wp).add(new THREE.Vector3(0, 0.07, 0));
      const tk = stag(t, 1.2, 0.5, easeBack) * e; setSprite(gccTag, 0.18, tk); setSprite(othTag, 0.18, tk);
      const lf = libyaFrame.userData.on; libyaFrame.material.opacity = lf ? Math.max(0, 1 - (now - lf) / 4) * e : 0;
    },
  };
}

// ================================================================ 9. Role-play: from a traditional to an interactive classroom (p599)
const ROUNDS = [
  { q: 'الطلاب يتثاءبون أثناء الشرح…', o: [['أواصل الشرح حتى أنهي الدرس', -0.25], ['أطرح سؤالاً يتحدّاهم', 0.2], ['أحوّل الدرس إلى نشاط جماعي بالأجهزة اللوحية', 0.4, 'groups']] },
  { q: 'طالب يسأل سؤالاً خارج الدرس…', o: [['أؤجّله إلى آخر الحصة', 0], ['أجعله مدخلاً لبحث جماعي', 0.3], ['أتجاهله وأكمل', -0.3]] },
  { q: 'اقتربت نهاية الحصة…', o: [['اختبار ورقي سريع', 0.05], ['يعرض كل فريق ما توصّل إليه', 0.35, 'present'], ['أعطيهم واجباً إضافياً', -0.2]] },
];

function boardTex() {
  const c = document.createElement('canvas'); c.width = 512; c.height = 300;
  const g = c.getContext('2d'); g.fillStyle = '#2f5d46'; g.fillRect(0, 0, 512, 300);
  g.fillStyle = '#f4f1e8'; g.font = '700 110px Tajawal, sans-serif'; g.textAlign = 'center'; g.direction = 'rtl'; g.fillText('٢ + ٣ = ٥', 256, 190);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

function figure(tint, scale = 1) {
  const f = new THREE.Group();
  const body = inked(new THREE.CapsuleGeometry(0.018 * scale, 0.03 * scale, 4, 14), { color: tint }); body.position.y = 0.034 * scale; f.add(body);
  const head = inked(new THREE.SphereGeometry(0.016 * scale, 18, 12), { color: tint }); head.position.y = 0.078 * scale; f.add(head);
  f.userData = { body, head };
  return f;
}

export function buildRoleplay(ctx) {
  const g = new THREE.Group(); g.position.copy(P(0.31, 0.33)); ctx.stage.add(g);
  const floor = inked(new RoundedBoxGeometry(0.44, 0.01, 0.3, 2, 0.006), { color: 0xf3ead6 }); floor.position.y = 0.005; g.add(floor);
  const board = new THREE.Mesh(new RoundedBoxGeometry(0.2, 0.11, 0.008, 2, 0.003), [mat(0x8b5a2b), mat(0x8b5a2b), mat(0x8b5a2b), mat(0x8b5a2b), new THREE.MeshBasicMaterial({ map: boardTex(), toneMapped: false }), mat(0x8b5a2b)]);
  board.position.set(0, 0.09, -0.14); g.add(shadowed(board));
  const teacher = figure(0xffcf9c, 1.3); teacher.position.set(0.12, 0.01, -0.1); g.add(teacher);
  const rowsPos = [[-0.12, 0.0], [0.0, 0.0], [-0.12, 0.09], [0.0, 0.09]];
  const circlePos = [[-0.08, -0.02], [0.08, -0.02], [-0.08, 0.1], [0.08, 0.1]];
  const students = rowsPos.map(([x, z], i) => {
    const s = figure([0xa9d8e6, 0xf4bfd0, 0xc2e0a6, 0xf2d796][i]); s.position.set(x, 0.01, z); g.add(s);
    const desk = inked(new RoundedBoxGeometry(0.05, 0.006, 0.035, 2, 0.002), { color: 0xd8b07a }); desk.position.set(x, 0.045, z - 0.03); g.add(desk);
    const tablet = new THREE.Mesh(new THREE.PlaneGeometry(0.03, 0.02), new THREE.MeshBasicMaterial({ color: 0x9fd8ff, toneMapped: false })); tablet.rotation.x = -Math.PI / 2; tablet.position.set(x, 0.0495, z - 0.03); tablet.visible = false; g.add(tablet);
    const orb = softLight(0x9aa3ad, 0.04, 0.9); g.add(orb);
    return { s, desk, tablet, orb, i, eng: 0.25, from: new THREE.Vector3(x, 0.01, z), to: new THREE.Vector3(x, 0.01, z) };
  });
  let round = 0, mood = 0.25, mode = 'rows', now = 0, moveAt = -1;
  const drawn = [floor, ...[teacher, ...students.map((s) => s.s)].flatMap((f) => [f.userData.body, f.userData.head]), ...students.map((s) => s.desk)];
  function ask() {
    const r = ROUNDS[round];
    ctx.ui.card({ tag: `الموقف ${toAr(round + 1)} من ٣`, title: r.q, body: 'اختر تصرّف المعلّم، وراقب الطلاب.', color: 0xc2457a });
    ctx.ui.choices(r.o.map(([label, delta, effect]) => ({ label, onPick: () => choose(delta, effect) })));
  }
  function choose(delta, effect) {
    mood = clamp01(mood + delta); ctx.sfx[delta > 0 ? 'good' : delta < 0 ? 'bad' : 'tap']();
    students.forEach((s, i) => (s.eng = clamp01(mood + (i % 2 ? 0.05 : -0.05))));
    if (effect === 'groups' && mode === 'rows') { mode = 'circle'; moveAt = now; students.forEach((s, i) => { s.from.copy(s.s.position); s.to.set(circlePos[i][0], 0.01, circlePos[i][1]); s.tablet.visible = true; }); }
    if (effect === 'present') ctx.fx.burst(g.position.clone().setY(0.15), 0xffd27a, 30, 0.4, 0.035);
    round += 1;
    if (round < ROUNDS.length) setTimeout(ask, 900); else setTimeout(finish, 900);
  }
  function finish() {
    const good = mood > 0.7;
    ctx.ui.card({ tag: good ? 'فصل تفاعلي ✦' : 'جرّب مرة أخرى', title: good ? 'صار فصلك تفاعلياً' : 'ما زال الملل حاضراً', body: 'التفاعلية تقلّل الملل وتزيد رغبة الطالب في التعلّم والبحث عن المعلومات. ويتطلّب التعلّم التفاعلي بنية تحتية تكنولوجية، ومصادر إلكترونية، وتنمية مهنية، وبناء قدرات المعلمين والإداريين، ومتابعة وتقييماً.', color: good ? 0xd4ad55 : 0x8fa6b5 });
    ctx.ui.done();
    ctx.ui.choices([{ label: '⟲ أعد المشهد', primary: true, onPick: () => { round = 0; mood = 0.25; mode = 'rows'; students.forEach((s) => { s.eng = 0.25; s.from.copy(s.s.position); s.to.set(rowsPos[s.i][0], 0.01, rowsPos[s.i][1]); s.tablet.visible = false; }); moveAt = now; ask(); } }]);
  }
  ctx.ui.hud('أنت المعلّم: قراراتك تغيّر الفصل');
  let started = false;
  return {
    update(t, dt, e) {
      now = t;
      drawn.forEach((s, i) => s.userData.reveal(stag(t, 0.1 + i * 0.05, 0.9, clamp01) * e));
      board.scale.setScalar(Math.max(stag(t, 0.8, 0.6, easeBack) * e, 0.001));
      if (!started && t > 2.2) { started = true; ask(); }
      const mv = moveAt >= 0 ? ease((t - moveAt) / 1.2) : 1;
      students.forEach((s) => {
        if (moveAt >= 0) s.s.position.lerpVectors(s.from, s.to, mv);
        s.s.userData.head.position.y = 0.078 - (1 - s.eng) * 0.01;
        s.s.userData.head.rotation.x = (1 - s.eng) * 0.6;
        s.orb.position.copy(s.s.position).add(new THREE.Vector3(0, 0.12 + Math.sin(t * 3 + s.i) * 0.005, 0));
        // A dim grey spark for a bored student, a bright golden one for an engaged student.
        s.orb.material.color.setHSL(0.11, 0.1 + 0.85 * s.eng, 0.64 - 0.12 * s.eng);
        s.orb.scale.setScalar(0.026 + 0.034 * s.eng);
        s.orb.material.opacity = (0.55 + 0.45 * s.eng) * e;
        s.desk.position.set(s.s.position.x, 0.045, s.s.position.z - 0.03);
        s.tablet.position.set(s.s.position.x, 0.0495, s.s.position.z - 0.03);
      });
      teacher.position.x = THREE.MathUtils.damp(teacher.position.x, mode === 'circle' ? 0.0 : 0.12, 2, dt);
      teacher.position.z = THREE.MathUtils.damp(teacher.position.z, mode === 'circle' ? 0.04 : -0.1, 2, dt);
    },
  };
}

// ================================================================ 10. Branching: the technological teacher (p617)
const BRANCHES = [
  { q: 'طالبة متفوّقة تشعر بالملل، وزميلها يحتاج وقتاً أطول…', o: [['أشرح للجميع بالطريقة نفسها', 'a'], ['أعطي كلاً منهما مهمة تناسب ميوله واحتياجه', 'b'], ['أعرض عليهما فيديو يشاهدانه', 'c']] },
  { q: 'ظهرت أداة رقمية جديدة…', o: [['لا وقت لديّ لتعلّمها', 'a'], ['أجرّبها وأقيس أثرها على تعلّم طلابي', 'b'], ['أستخدمها لأنها جديدة فقط', 'c']] },
  { q: 'طالب يريد أن يتعلّم موضوعاً خارج المنهج…', o: [['أقول له: ليس في الامتحان', 'a'], ['أوجّهه إلى مصادر يتعلّم منها بنفسه', 'b'], ['أبحث عنه بدلاً منه', 'c']] },
];
const ENDINGS = {
  a: { t: 'المعلّم التقليدي', d: 'الطريقة واحدة للجميع، والتقنية غائبة. الكتاب يدعو إلى معلّم يدرك ميول كل طالب واحتياجاته.', c: 0x8fa6b5 },
  b: { t: 'المعلّم التكنولوجي', d: '«المعلّم الذي يدرك ميول كل طالب واحتياجاته الخاصة، ويشجّع طلبته على التعلّم الذاتي الذي يطوّر شخصيتهم لتكون فعّالة في المجتمع».', c: 0xd4ad55 },
  c: { t: 'معلّم الأجهزة', d: 'التقنية حاضرة لكن بلا هدف. الأداة لا تصنع المعلّم التكنولوجي؛ تصنعه الغاية التعليمية.', c: 0x45c6ff },
};
const BRANCH_COLORS = { a: 0x6f8797, b: 0xe89a00, c: 0x0fa3e0 };
const LEAF_COLORS = { a: 0xa9b6c0, b: 0x7cc46a, c: 0x6fd3ff };
// Each answer leans its own way: the traditional path droops left, the gadget path shoots right,
// and the technological path climbs the middle, so the finished tree tells the story.
const LEAN = { a: { x: -0.085, y: 0.032 }, b: { x: 0.024, y: 0.075 }, c: { x: 0.085, y: 0.052 } };
// The five qualities of the technological teacher, as the page lists them; they ripen as fruit.
const QUALITIES = [
  ['القيم والنشاط', 'أن يكون مؤمناً بقيمه، ذكياً، نشيطاً، متعاوناً.'],
  ['الثقافة الواسعة', 'أن يمتلك ثقافة واسعة تشمل مختلف المجالات العلمية.'],
  ['المظهر والهندام', 'أن يهتمّ بمظهره الخارجي ولباسه وهندامه.'],
  ['الودّ والشخصية', 'أن يكون ودوداً، بشوشاً، سليم النطق، ذا شخصية قوية ناضجة.'],
  ['الروح والمادة', 'أن يمتلك القدرة على تعليم المتعلّمين الحياة الروحية جنباً إلى جنب مع الحياة المادية.'],
];

const LEAF_GEO = new THREE.SphereGeometry(0.011, 10, 6);
function leaf(color) {
  const m = new THREE.Mesh(LEAF_GEO, paperMat(color));
  const hull = new THREE.Mesh(LEAF_GEO, new THREE.MeshBasicMaterial({ color: INK, side: THREE.BackSide }));
  hull.scale.setScalar(1.14); m.add(hull);
  m.scale.setScalar(0.0001);
  return m;
}

export function buildBranch(ctx) {
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const g = new THREE.Group(); g.position.copy(P(0.27, 0.54)); ctx.stage.add(g);
  const seed = new THREE.Mesh(new THREE.SphereGeometry(0.016, 20, 14), goldMat()); g.add(seed);
  const seedLight = softLight(0xffc94d, 0.1, 0); seedLight.position.y = 0.004; g.add(seedLight);
  const ROOT = V(0, 0.12, 0);
  const trunk = lightTube(new THREE.CatmullRomCurve3([V(0, 0.01, 0), V(0.01, 0.05, 0.004), V(-0.008, 0.09, -0.004), ROOT.clone()]), { radius: 0.009, color: 0xe89a00, speed: 0.4 });
  g.add(trunk);
  let tip = ROOT.clone(), round = 0, now = 0, finishedAt = -1, badge = null;
  const picks = [], grown = [], offers = [], ghosts = [], leaves = [];

  // Five fruits made once and shown at the end.
  const fruits = QUALITIES.map(([title, text], i) => {
    const f = new THREE.Mesh(new THREE.SphereGeometry(0.013, 18, 12), glossy(0xffc94d, { emissive: 0xffa000, emissiveIntensity: 0.25 }));
    const rim = new THREE.Mesh(f.geometry, new THREE.MeshBasicMaterial({ color: INK, side: THREE.BackSide })); rim.scale.setScalar(1.14); f.add(rim);
    f.visible = false; f.userData = { at: 0, y: 0, ripe: false }; g.add(f);
    ctx.tap(f, () => {
      ctx.sfx.tap();
      ctx.ui.card(f.userData.ripe
        ? { tag: `صفات المعلّم التكنولوجي · ${toAr(i + 1)} من ٥`, title, body: text, color: 0xd4ad55 }
        : { tag: 'صفة لم تنضج بعد', title, body: `${text} اسلك الطريق الذهبي لتنضج.`, color: 0x8fa6b5 });
    });
    return f;
  });

  function twig(from, key, r) {
    const l = LEAN[key];
    const x = key === 'b' ? (r % 2 ? -l.x : l.x) : l.x;
    const end = from.clone().add(V(x, l.y, (r % 2 ? 0.016 : -0.016) * (key === 'b' ? 1 : 0.4)));
    const mid = from.clone().lerp(end, 0.5).add(V(0, l.y * 0.25, 0));
    return { curve: new THREE.CatmullRomCurve3([from.clone(), mid, end]), end };
  }
  function offer() {
    const r = BRANCHES[round];
    r.o.forEach(([, key]) => {
      const { curve, end } = twig(tip, key, round);
      const tube = lightTube(curve, { radius: 0.006, color: BRANCH_COLORS[key], speed: 0.6 }); tube.userData.fill(0);
      g.add(tube); offers.push({ tube, key, end, born: now });
    });
    ctx.ui.card({ tag: `القرار ${toAr(round + 1)} من ٣`, title: r.q, body: 'اختر، وراقب كيف ينمو طريقك.', color: 0xd4ad55 });
    ctx.ui.choices(r.o.map(([label, key]) => ({ label, onPick: () => choose(key) })));
  }
  // The roads not taken stay on the tree as faint grey twigs.
  function wither(o) {
    const [core, shell] = o.tube.children;
    core.material.color.setHex(0xb9b1a3); core.material.opacity = 0.4;
    if (shell) shell.material.opacity = 0.1;
    o.tube.userData.speed = 0; o.tube.userData.fill(1);
    ghosts.push(o);
  }
  function choose(key) {
    const o = offers.find((x) => x.key === key);
    offers.filter((x) => x !== o).forEach(wither);
    offers.length = 0; grown.push({ ...o, at: now }); picks.push(key); tip = o.end;
    ctx.sfx[key === 'b' ? 'good' : 'tap']();
    for (let i = 0; i < 6; i++) {
      const lf = leaf(LEAF_COLORS[key]);
      const a = (i / 6) * TAU + Math.random() * 0.5;
      lf.position.copy(o.end).add(V(Math.cos(a) * 0.016, (Math.random() - 0.3) * 0.012, Math.sin(a) * 0.016));
      lf.rotation.set((Math.random() - 0.5) * 0.6, -a, 0.45);
      lf.userData = { at: now + 0.35 + i * 0.06, s: 0.85 + Math.random() * 0.4 };
      g.add(lf); leaves.push(lf);
    }
    round += 1;
    if (round < BRANCHES.length) setTimeout(offer, 800); else setTimeout(finish, 900);
  }
  function finish() {
    const count = (k) => picks.filter((p) => p === k).length;
    const key = count('b') >= 2 ? 'b' : count('c') >= count('a') ? 'c' : 'a';
    const end = ENDINGS[key];
    finishedAt = now;
    badge = sprite(end.t, 0.24, { size: 50, width: 600, title: true, bg: 'rgba(31,27,22,.92)', color: css(end.c) });
    badge.position.copy(tip).add(V(0, 0.115, 0)); g.add(badge);
    fruits.forEach((f, i) => {
      const a = (i / 5) * TAU + 0.3;
      f.userData.y = tip.y - 0.012 + (i % 2) * 0.014;
      f.position.set(tip.x + Math.cos(a) * 0.05, f.userData.y, tip.z + Math.sin(a) * 0.05);
      f.userData.at = now + 0.5 + i * 0.16; f.userData.ripe = key === 'b';
      // Ripe and golden on the technological path; pale and unripe on the others.
      f.material.color.setHex(key === 'b' ? 0xffc94d : 0xefe9dc);
      f.material.emissiveIntensity = key === 'b' ? 0.25 : 0;
      f.visible = true; f.scale.setScalar(0.0001);
    });
    ctx.fx.burst(tip.clone(), end.c, 40, 0.5, 0.04);
    ctx.ui.card({ tag: 'نهاية طريقك', title: end.t, body: `${end.d} المس الثمار لتقرأ صفات المعلّم التكنولوجي.`, color: end.c });
    ctx.ui.done();
    ctx.ui.choices([{ label: '⟲ طريق جديد', primary: true, onPick: restart }]);
  }
  function restart() {
    [...grown, ...ghosts].forEach((o) => g.remove(o.tube)); leaves.forEach((lf) => g.remove(lf));
    if (badge) g.remove(badge);
    grown.length = ghosts.length = leaves.length = picks.length = 0;
    fruits.forEach((f) => (f.visible = false));
    badge = null; round = 0; tip = ROOT.clone(); finishedAt = -1; offer();
  }
  ctx.ui.hud('ثلاثة قرارات تصنع نوع المعلّم الذي ستكونه');
  let started = false;
  return {
    update(t, dt, e) {
      now = t;
      seed.scale.setScalar(Math.max(stag(t, 0.2, 0.6, easeBack) * e, 0.001));
      seedLight.material.opacity = 0.7 * stag(t, 0.3, 0.6) * e;
      trunk.userData.fill(stag(t, 0.6, 1.0) * e); trunk.userData.update(dt);
      if (!started && t > 1.8) { started = true; offer(); }
      offers.forEach((o, i) => { o.tube.userData.update(dt); o.tube.userData.fill(stag(t, o.born + i * 0.12, 0.5) * (0.34 + 0.08 * Math.sin(t * 3 + i))); });
      grown.forEach((o) => { o.tube.userData.update(dt); o.tube.userData.fill(ease((t - o.at) / 0.6)); });
      leaves.forEach((lf) => { const s = lf.userData.s * Math.max(easeBack((t - lf.userData.at) / 0.45) * e, 0.0001); lf.scale.set(s, s * 0.3, s * 0.55); });
      fruits.forEach((f, i) => {
        if (!f.visible) return;
        f.scale.setScalar(Math.max(easeBack((t - f.userData.at) / 0.5) * e, 0.0001));
        f.position.y = f.userData.y + Math.sin(t * 2 + i) * 0.003;
      });
      if (badge) setSprite(badge, 0.24, stag(t, finishedAt + 0.3, 0.6, easeBack) * e);
    },
  };
}
