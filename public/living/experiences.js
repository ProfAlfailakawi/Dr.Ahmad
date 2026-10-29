// The living pages. Each one is tied to its page design, never to a page number;
// `pageNo` only tells maintainers where the page sits in the reference copy. Readers never see it,
// because the numbers change between editions.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import {
  P, PAGE_H, ease, easeBack, stag, clamp01, label, sprite, mat, glossy, goldMat, shadowed, glow, textCanvas,
} from './kit.js?v=6';
import { buildLab, buildCone, buildTimeTV, buildWelcome, buildSecret } from './pencil.js?v=6';
import { buildPortal, PORTAL_HOLE, buildPhone, buildBloom, buildBalance, buildRoleplay, buildBranch } from './doors34.js?v=6';

const TAU = Math.PI * 2;
const lerp = THREE.MathUtils.lerp;

// ---------------------------------------------------------------- 1. Living infographic
const ROLES = [
  { n: '١', t: 'التصميم لنظام التعليم', c: 0xb5202f, u: 0.49, v: 0.515, d: 'يخطّط المعلم الموقف التعليمي كاملاً: الأهداف والمحتوى والأنشطة والتقويم، قبل أن يدخل الصف.' },
  { n: '٢', t: 'توظيف التكنولوجيا', c: 0xe0a030, u: 0.52, v: 0.576, d: 'يختار الوسيلة التي تخدم الهدف؛ فالتقنية عنده أداة للتعلّم لا غاية في ذاتها.' },
  { n: '٣', t: 'تشجيع التفاعل بين الطلاب', c: 0xe06a2a, u: 0.5, v: 0.635, d: 'يصمّم مواقف يتحاور فيها الطلاب ويتعاونون، فيتعلّم بعضهم من بعض.' },
  { n: '٤', t: 'المعلم موصل ومطوّر تعليمي', c: 0x4aa3b5, u: 0.52, v: 0.695, d: 'يوصل المعرفة بطرق متجدّدة، ويطوّر أساليبه باستمرار في ضوء ما يستجد.' },
  { n: '٥', t: 'المعلم مشرف وموجّه تربوي', c: 0x4a7a9a, u: 0.5, v: 0.757, d: 'يرافق الطالب ويرشده، ويقوّم أداءه ويقدّم له التغذية الراجعة.' },
  { n: '٦', t: 'تطوير التعلّم الذاتي عند الطلاب', c: 0x2d4060, u: 0.52, v: 0.818, d: 'يعلّم الطالب كيف يتعلّم بنفسه، ليواصل التعلّم بعد انتهاء الدرس.' },
];

function buildInfographic(ctx) {
  const g = new THREE.Group(); ctx.stage.add(g);
  const unit = new RoundedBoxGeometry(1, 1, 1, 4, 0.12);
  const baseZ = P(0.5, 0.69).z;
  const seen = new Set();
  const steps = ROLES.map((r, i) => {
    const grp = new THREE.Group(); g.add(grp);
    const m = mat(r.c, { roughness: 0.48 });
    const box = new THREE.Mesh(unit, m); shadowed(box); grp.add(box);
    const hgt = 0.05 + i * 0.038;
    const num = label(r.n, 0.06, { size: 120, weight: 800, color: '#ffffff', bg: null, width: 220, pad: 10 });
    grp.add(num);
    const tag = sprite(r.t, 0.108, { size: 38, width: 400, weight: 700, pad: 18, border: '#' + r.c.toString(16).padStart(6, '0') });
    grp.add(tag);
    ctx.tap(box, () => pick(i));
    ctx.tap(tag, () => pick(i));
    return {
      r, grp, box, m, num, tag, hgt,
      a: { pos: P(r.u, r.v, 0.006), size: new THREE.Vector3(0.27, 0.012, 0.046) },
      b: { pos: new THREE.Vector3(0.31 - i * 0.124, hgt / 2, baseZ), size: new THREE.Vector3(0.112, hgt, 0.11) },
    };
  });

  const title = sprite('أدوار المعلم في عصر التكنولوجيا', 0.5, { size: 46, width: 900, title: true, bg: 'rgba(31,27,22,.88)', color: '#f3dca2' });
  title.position.set(0, 0.47, baseZ); g.add(title);

  const orb = new THREE.Mesh(new THREE.SphereGeometry(0.016, 24, 16), goldMat());
  const orbGlow = glow(0xffd27a, 0.09); orb.add(orbGlow); shadowed(orb); g.add(orb);

  function pick(i) {
    const s = steps[i];
    seen.add(i);
    s.pulse = 1;
    ctx.fx.burst(s.grp.position.clone().setY(s.hgt + 0.02), s.r.c, 16, 0.3, 0.03);
    ctx.ui.card({ tag: `الدور ${s.r.n} من ٦`, title: s.r.t, body: s.r.d, color: s.r.c });
    ctx.ui.hud(`اكتشفت ${toAr(seen.size)} من ٦ أدوار`);
    if (seen.size === 6) ctx.ui.done();
  }

  ctx.ui.hud('المس أي درجة لتعرف الدور');

  return {
    update(t, dt, e) {
      steps.forEach((s, i) => {
        const a = stag(t, 0.25 + i * 0.08, 0.5) * e;
        const k = stag(t, 1.3 + i * 0.12, 0.9);
        s.grp.position.lerpVectors(s.a.pos, s.b.pos, k);
        const size = new THREE.Vector3().lerpVectors(s.a.size, s.b.size, k);
        s.box.scale.set(size.x * a, Math.max(size.y * a, 0.0001), size.z * a);
        s.box.position.y = 0;
        s.pulse = Math.max(0, (s.pulse || 0) - dt * 1.4);
        s.m.emissive.setHex(s.r.c); s.m.emissiveIntensity = s.pulse * 0.6 + (seen.has(i) ? 0.12 : 0);
        s.num.position.set(0, size.y / 2 - 0.032, size.z / 2 + 0.001);
        s.num.scale.setScalar(Math.max(k * a, 0.001));
        s.num.visible = k > 0.5;
        s.tag.position.set(0, size.y / 2 + 0.045 + (i % 2) * 0.042, 0);
        const ts = stag(t, 2.2 + i * 0.1, 0.5) * e;
        s.tag.scale.set(0.108 * ts, 0.108 * s.tag.userData.aspect * ts, 1);
      });
      const tt = stag(t, 2.6, 0.7) * e;
      title.scale.set(0.5 * tt, 0.5 * title.userData.aspect * tt, 1);
      // The golden "teacher" climbs the six roles, one hop per second.
      const lt = t - 3.4;
      orb.visible = lt > 0 && e > 0.05;
      if (orb.visible) {
        const cyc = lt % 8;
        const hop = Math.min(5, Math.floor(cyc));
        const f = clamp01(cyc - hop);
        const from = steps[hop], to = steps[Math.min(5, hop + 1)];
        const p0 = from.grp.position.clone().setY(from.hgt + 0.018);
        const p1 = to.grp.position.clone().setY(to.hgt + 0.018);
        orb.position.lerpVectors(p0, p1, hop >= 5 ? 0 : ease(f));
        orb.position.y += hop >= 5 ? Math.abs(Math.sin(cyc * 3)) * 0.01 : Math.sin(f * Math.PI) * 0.06;
        orb.scale.setScalar(cyc > 7.5 ? 1 - (cyc - 7.5) * 2 : Math.min(1, cyc * 3));
      }
    },
  };
}

// ---------------------------------------------------------------- 2. 3D model
function chalkCanvas() {
  const c = document.createElement('canvas'); c.width = 1024; c.height = 620;
  return c;
}
function drawChalk(c, p) {
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(512, 300, 50, 512, 310, 640);
  grd.addColorStop(0, '#36684f'); grd.addColorStop(1, '#22473a');
  g.fillStyle = grd; g.fillRect(0, 0, 1024, 620);
  g.globalAlpha = 0.06; g.fillStyle = '#fff';
  for (let i = 0; i < 160; i++) g.fillRect((i * 97) % 1024, (i * 53) % 620, 60, 2);
  g.globalAlpha = 1;
  g.save(); g.beginPath(); g.rect(0, 0, 1024 * clamp01(p * 1.25), 400); g.clip();
  g.font = '700 150px "Reem Kufi", Tajawal, sans-serif'; g.fillStyle = '#f4f1e8'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.shadowColor = 'rgba(255,255,255,.35)'; g.shadowBlur = 8;
  g.fillText('E-LEARNING', 512, 250);
  g.restore();
  g.save(); g.beginPath(); g.rect(1024 * (1 - clamp01((p - 0.6) * 2.5)), 380, 1024, 240); g.clip();
  g.font = '700 84px Tajawal, sans-serif'; g.fillStyle = '#f3dca2'; g.textAlign = 'center'; g.direction = 'rtl';
  g.fillText('التعلّم الإلكتروني', 512, 470);
  g.restore();
}

function globeTexture() {
  const c = document.createElement('canvas'); c.width = 512; c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#3d8fd6'; g.fillRect(0, 0, 512, 256);
  g.fillStyle = '#7cc46a';
  const blobs = [[90, 90, 60, 40], [150, 170, 30, 50], [270, 80, 40, 30], [300, 150, 55, 45], [400, 90, 70, 35], [440, 190, 30, 20]];
  blobs.forEach(([x, y, w, h]) => { g.beginPath(); g.ellipse(x, y, w, h, 0.4, 0, TAU); g.fill(); });
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

function desk() {
  const d = new THREE.Group();
  const wood = mat(0xc98d4b, { roughness: 0.55 }), steel = mat(0x9aa3ad, { metalness: 0.6, roughness: 0.35 });
  const top = new THREE.Mesh(new RoundedBoxGeometry(0.11, 0.007, 0.075, 2, 0.003), wood); top.position.y = 0.075; d.add(top);
  const legG = new THREE.CylinderGeometry(0.0032, 0.0032, 0.075, 8);
  [[-0.048, -0.03], [0.048, -0.03], [-0.048, 0.03], [0.048, 0.03]].forEach(([x, z]) => { const l = new THREE.Mesh(legG, steel); l.position.set(x, 0.0375, z); d.add(l); });
  const seat = new THREE.Mesh(new RoundedBoxGeometry(0.058, 0.006, 0.05, 2, 0.002), wood); seat.position.set(0, 0.045, 0.07); d.add(seat);
  const back = new THREE.Mesh(new RoundedBoxGeometry(0.058, 0.035, 0.006, 2, 0.002), wood); back.position.set(0, 0.075, 0.094); d.add(back);
  const cl = new THREE.CylinderGeometry(0.0026, 0.0026, 0.045, 8);
  [[-0.024, 0.05], [0.024, 0.05], [-0.024, 0.09], [0.024, 0.09]].forEach(([x, z]) => { const l = new THREE.Mesh(cl, steel); l.position.set(x, 0.0225, z); d.add(l); });
  d.userData.top = top;
  return shadowed(d);
}

function buildModel(ctx) {
  const g = new THREE.Group(); g.position.copy(P(0.54, 0.715)); ctx.stage.add(g);
  const pieces = [];
  const add = (obj, delay, from = 0.25) => { g.add(obj); pieces.push({ obj, delay, from, y: obj.position.y }); return obj; };

  const base = add(shadowed(new THREE.Mesh(new RoundedBoxGeometry(0.64, 0.024, 0.34, 3, 0.01), mat(0x2f3338, { roughness: 0.4 }))), 0, 0.15);
  base.position.y = 0.012; pieces[0].y = 0.012;
  const keys = new THREE.InstancedMesh(new RoundedBoxGeometry(0.036, 0.008, 0.038, 2, 0.003), mat(0x41474f, { roughness: 0.5 }), 13 * 5);
  const mtx = new THREE.Matrix4(); let ki = 0;
  for (let r = 0; r < 5; r++) for (let c = 0; c < 13; c++) { mtx.setPosition(-0.288 + c * 0.048, 0.028, -0.124 + r * 0.062); keys.setMatrixAt(ki++, mtx); }
  keys.castShadow = keys.receiveShadow = true;
  add(keys, 0.2, 0.1);

  const desks = [[-0.19, 0.04, 0.35], [0.0, 0.085, -0.15], [0.19, 0.06, -0.4]].map(([x, z, ry], i) => {
    const d = desk(); d.position.set(x, 0.032, z); d.rotation.y = ry; return add(d, 0.5 + i * 0.15);
  });

  // Easel and chalkboard
  const easel = new THREE.Group(); easel.position.set(0.07, 0.032, -0.09);
  const wood = mat(0x8b5a2b, { roughness: 0.6 });
  const legG = new THREE.CylinderGeometry(0.004, 0.004, 0.33, 8);
  [[-0.1, 0.03, -0.12], [0.1, 0.03, 0.12], [0, -0.07, 0]].forEach(([x, z, rz]) => {
    const l = new THREE.Mesh(legG, wood); l.position.set(x, 0.155, z); l.rotation.set(z > 0 ? -0.12 : 0.25, 0, rz); easel.add(l);
  });
  const chalk = chalkCanvas(); drawChalk(chalk, 0);
  const chalkTex = new THREE.CanvasTexture(chalk); chalkTex.colorSpace = THREE.SRGBColorSpace;
  const board = new THREE.Group(); board.position.set(0, 0.215, 0.035); board.rotation.x = -0.14;
  board.add(new THREE.Mesh(new RoundedBoxGeometry(0.31, 0.2, 0.012, 2, 0.004), wood));
  const face = new THREE.Mesh(new THREE.PlaneGeometry(0.284, 0.172), new THREE.MeshStandardMaterial({ map: chalkTex, roughness: 0.95 }));
  face.position.z = 0.0065; board.add(face);
  const tray = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.008, 0.02), wood); tray.position.set(0, -0.1, 0.012); board.add(tray);
  easel.add(board); shadowed(easel); add(easel, 1.0, 0.35);

  // Globe on the first desk, books on the second, a glowing tablet on the third
  const globe = new THREE.Group();
  const sphere = new THREE.Mesh(new THREE.SphereGeometry(0.026, 32, 20), new THREE.MeshStandardMaterial({ map: globeTexture(), roughness: 0.45 }));
  sphere.position.y = 0.04; sphere.rotation.z = 0.4; globe.add(sphere);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.031, 0.0018, 8, 40, Math.PI * 1.3), goldMat()); ring.position.y = 0.04; ring.rotation.z = 0.4 + Math.PI / 2; globe.add(ring);
  const stand = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.016, 0.012, 20), goldMat()); stand.position.y = 0.006; globe.add(stand);
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.0022, 0.0022, 0.03, 8), goldMat()); stem.position.y = 0.02; globe.add(stem);
  shadowed(globe); globe.position.set(-0.19, 0.111, 0.03); add(globe, 1.5);

  const books = new THREE.Group();
  [[0xc0392b, 0], [0xe86a8a, 0.15], [0x2a9d8f, -0.1]].forEach(([c, r], i) => {
    const b = new THREE.Mesh(new RoundedBoxGeometry(0.052, 0.011, 0.036, 2, 0.002), mat(c)); b.position.y = 0.006 + i * 0.012; b.rotation.y = r; books.add(b);
  });
  shadowed(books); books.position.set(0.0, 0.111, 0.08); add(books, 1.7);

  const tabletScreen = new THREE.MeshStandardMaterial({ color: 0x9fd8ff, emissive: 0x4ab0ff, emissiveIntensity: 0.6, roughness: 0.2 });
  const tablet = new THREE.Group();
  tablet.add(new THREE.Mesh(new RoundedBoxGeometry(0.056, 0.004, 0.04, 2, 0.002), mat(0x1d2126)));
  const scr = new THREE.Mesh(new THREE.PlaneGeometry(0.048, 0.032), tabletScreen); scr.rotation.x = -Math.PI / 2; scr.position.y = 0.0022; tablet.add(scr);
  shadowed(tablet); tablet.position.set(0.19, 0.11, 0.055); tablet.rotation.y = -0.4; add(tablet, 1.8);

  const STAGES = [
    { k: 'plan', n: '١', t: 'التخطيط', at: new THREE.Vector3(0.07, 0.44, -0.07), d: 'مسؤولية جهات عدة: المتخصصون في التدريب وأساتذة الجامعات وخبراء التكنولوجيا؛ فالتخطيط للتدريب لم يعد يتم بمعزل عن الآخرين.' },
    { k: 'do', n: '٢', t: 'التنفيذ', at: new THREE.Vector3(0.2, 0.23, 0.06), d: 'ترجمة الخطة إلى بيئة افتراضية مرنة تشمل الإنترنت والوسائط المتعددة والفصول الذكية وبرامج التدريب الإلكتروني.' },
    { k: 'eval', n: '٣', t: 'التقويم', at: new THREE.Vector3(0.0, 0.23, 0.09), d: 'يستند إلى أسس ومعايير ومؤشرات، تُجرى في ضوئها التعديلات لتطوير نظام التدريب ورسم استراتيجياته المستقبلية.' },
  ];
  const seen = new Set();
  const tags = STAGES.map((s, i) => {
    const sp = sprite(`${s.n}  ${s.t}`, 0.13, { size: 54, width: 420, weight: 800, bg: 'rgba(31,27,22,.9)', color: '#f3dca2', radius: 60 });
    sp.position.copy(s.at); g.add(sp); s.sp = sp;
    ctx.tap(sp, () => pickStage(i));
    return sp;
  });
  ctx.tap(board, () => pickStage(0));
  ctx.tap(tablet, () => pickStage(1));
  ctx.tap(desks[2], () => pickStage(1));
  ctx.tap(books, () => pickStage(2));
  ctx.tap(desks[1], () => pickStage(2));
  ctx.tap(globe, () => {
    ctx.fx.burst(g.position.clone().add(globe.position).setY(0.16), 0x7cc46a, 14, 0.25, 0.025);
    ctx.ui.card({ tag: 'التدريب التكنولوجي', title: 'لماذا التدريب؟', body: 'يكسب المتعلمين الكفاءات والمهارات اللازمة لاستخدام تكنولوجيا الاتصالات والمعلومات، في عالم تتسارع تطوراته.', color: 0x3d8fd6 });
  });

  function pickStage(i) {
    const s = STAGES[i]; seen.add(i);
    ctx.fx.burst(g.position.clone().add(s.at), 0xffd27a, 18, 0.3, 0.03);
    ctx.ui.card({ tag: `مرحلة ${s.n} من ٣ · التدريب التكنولوجي`, title: s.t, body: s.d, color: 0xd4ad55 });
    ctx.ui.hud(`اكتشفت ${toAr(seen.size)} من ٣ مراحل`);
    if (seen.size === 3) ctx.ui.done();
  }
  ctx.ui.hud('المس السبورة والأدراج لتكتشف مراحل التدريب');

  let lastChalk = -1;
  return {
    update(t, dt, e) {
      pieces.forEach((p) => {
        const k = stag(t, p.delay, 0.6, easeBack) * e;
        p.obj.position.y = p.y + (1 - stag(t, p.delay, 0.6)) * p.from;
        p.obj.scale.setScalar(Math.max(k, 0.0001));
      });
      const cp = clamp01((t - 2.0) / 2.2);
      if (Math.abs(cp - lastChalk) > 0.01) { drawChalk(chalk, cp); chalkTex.needsUpdate = true; lastChalk = cp; }
      sphere.rotation.y += dt * 0.6;
      tabletScreen.emissiveIntensity = 0.45 + Math.sin(t * 3) * 0.2;
      tags.forEach((sp, i) => {
        const k = stag(t, 3.2 + i * 0.2, 0.5, easeBack) * e;
        sp.scale.set(0.13 * k, 0.13 * sp.userData.aspect * k, 1);
        sp.position.y = STAGES[i].at.y + Math.sin(t * 2 + i) * 0.006;
      });
    },
  };
}

// ---------------------------------------------------------------- 3. Interactive image
const TECH_GROUPS = {
  proc: { name: 'عمليات', title: 'التكنولوجيا كعمليات (Processes)', c: 0x1fa5a0, d: 'التطبيق المنظّم للمعرفة العلمية. هنا التكنولوجيا طريقة وخطوات منظّمة، لا جهاز.' },
  prod: { name: 'نواتج', title: 'التكنولوجيا كنواتج (Products)', c: 0x2a7fd0, d: 'الأدوات والأجهزة والمواد الناتجة عن تطبيق المعرفة العلمية.' },
  both: { name: 'معاً', title: 'التكنولوجيا عمليةً ونواتجَ معاً', c: 0xd4ad55, d: 'تجمع الطريقة والأداة، مثل تقنيات الحاسوب التعليمي وما يقدّمه من برامج علمية منظّمة وهادفة.' },
};
const HOTSPOTS = [
  { u: 0.357, v: 0.575, g: 'proc', n: 'الضبط والتنظيم' },
  { u: 0.279, v: 0.75, g: 'proc', n: 'القياس والتقويم' },
  { u: 0.433, v: 0.552, g: 'prod', n: 'الهاتف الذكي' },
  { u: 0.561, v: 0.621, g: 'prod', n: 'المعالج والذاكرة' },
  { u: 0.58, v: 0.7, g: 'prod', n: 'الحاسوب المكتبي' },
  { u: 0.323, v: 0.684, g: 'both', n: 'الحاسوب التعليمي وبرامجه' },
];

function coinFace(text, color) {
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#' + color.toString(16).padStart(6, '0'); g.beginPath(); g.arc(128, 128, 128, 0, TAU); g.fill();
  g.strokeStyle = 'rgba(255,255,255,.7)'; g.lineWidth = 10; g.beginPath(); g.arc(128, 128, 108, 0, TAU); g.stroke();
  g.fillStyle = '#fff'; g.font = '800 70px Tajawal, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.direction = 'rtl';
  g.fillText(text, 128, 136);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

function buildHotspots(ctx) {
  const g = new THREE.Group(); ctx.stage.add(g);
  const found = new Set();
  const spots = HOTSPOTS.map((h, i) => {
    const grp = TECH_GROUPS[h.g];
    const s = new THREE.Group(); s.position.copy(P(h.u, h.v, 0.002)); g.add(s);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.036, 0.0035, 10, 48), new THREE.MeshBasicMaterial({ color: 0xffd27a, transparent: true, opacity: 0.95 }));
    ring.rotation.x = Math.PI / 2; s.add(ring);
    const halo = glow(0xffd27a, 0.11, 0.5); halo.position.y = 0.006; s.add(halo);
    const hit = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.03, 16), new THREE.MeshBasicMaterial({ visible: false })); s.add(hit);
    const coin = new THREE.Group();
    const faceTex = coinFace(grp.name, grp.c);
    const coinMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.034, 0.034, 0.007, 48), [
      glossy(grp.c), new THREE.MeshStandardMaterial({ map: faceTex, roughness: 0.3 }), new THREE.MeshStandardMaterial({ map: faceTex, roughness: 0.3 }),
    ]);
    coinMesh.rotation.x = Math.PI / 2; coin.add(coinMesh); shadowed(coin);
    coin.visible = false; s.add(coin);
    const name = sprite(h.n, 0.15, { size: 40, width: 460, border: '#' + grp.c.toString(16).padStart(6, '0') });
    name.visible = false; s.add(name);
    ctx.tap(hit, () => open(i));
    ctx.tap(coin, () => open(i));
    return { h, grp, s, ring, halo, coin, name, openAt: -1 };
  });

  const quote = sprite('التكنولوجيا ليست مجرد امتلاك أدوات وأجهزة،\nبل أفكار وُجدت لحلّ المشكلات', 0.62, { size: 44, width: 1100, title: true, bg: 'rgba(31,27,22,.9)', color: '#f3dca2' });
  quote.position.copy(P(0.45, 0.47, 0.42)); quote.visible = false; g.add(quote);
  let quoteAt = -1, now = 0;

  // Light travelling up the branches, from the trunk to every icon.
  const trunk = P(0.39, 0.975, 0.004);
  const flows = Array.from({ length: 14 }, (_, i) => {
    const to = HOTSPOTS[i % HOTSPOTS.length];
    const end = P(to.u, to.v, 0.004);
    const mid = new THREE.Vector3((trunk.x + end.x) / 2, 0.05, lerp(trunk.z, end.z, 0.6));
    const curve = new THREE.QuadraticBezierCurve3(trunk, mid, end);
    const s = glow(i % 2 ? 0x6fd3ff : 0xffe2a0, 0.035, 0.95); g.add(s);
    return { curve, s, off: i / 14 };
  });

  function hudText() {
    const mark = (k) => (found.has(k) ? '●' : '○');
    return `عمليات ${mark('proc')}   ·   نواتج ${mark('prod')}   ·   معاً ${mark('both')}`;
  }
  function open(i) {
    const sp = spots[i];
    if (sp.openAt < 0) { sp.openAt = now; sp.coin.visible = sp.name.visible = true; }
    found.add(sp.h.g);
    ctx.fx.burst(sp.s.position.clone().setY(0.08), sp.grp.c, 18, 0.3, 0.028);
    ctx.ui.card({ tag: sp.h.n, title: sp.grp.title, body: sp.grp.d, color: sp.grp.c });
    ctx.ui.hud(hudText());
    if (found.size === 3 && quoteAt < 0) {
      quoteAt = now; quote.visible = true;
      ctx.fx.burst(quote.position.clone(), 0xffd27a, 36, 0.5, 0.04);
      ctx.ui.done();
    }
  }
  ctx.ui.hud('اكتشف المعاني الثلاثة للتكنولوجيا: ' + hudText());

  return {
    update(t, dt, e) {
      now = t;
      spots.forEach((sp, i) => {
        const a = stag(t, 0.6 + i * 0.12, 0.5, easeBack) * e;
        const pulse = 1 + Math.sin(t * 3 + i) * 0.12;
        sp.ring.scale.setScalar(Math.max(a * pulse, 0.001));
        sp.ring.material.opacity = sp.openAt >= 0 ? 0.35 : 0.95;
        sp.halo.material.opacity = 0.5 * a * (0.7 + 0.3 * Math.sin(t * 3 + i));
        if (sp.openAt >= 0) {
          const k = stag(t, sp.openAt, 0.6, easeBack) * e;
          sp.coin.position.y = 0.11 * ease((t - sp.openAt) / 0.6) + Math.sin(t * 2 + i) * 0.006;
          sp.coin.rotation.y = (t - sp.openAt) * 1.6;
          sp.coin.scale.setScalar(Math.max(k, 0.001));
          sp.name.position.y = sp.coin.position.y + 0.065;
          sp.name.scale.set(0.15 * k, 0.15 * sp.name.userData.aspect * k, 1);
        }
      });
      flows.forEach((f) => {
        const p = ((t * 0.32 + f.off) % 1);
        f.s.position.copy(f.curve.getPoint(p));
        f.s.material.opacity = Math.sin(p * Math.PI) * 0.95 * stag(t, 1.2, 0.8) * e;
      });
      if (quoteAt >= 0) {
        const k = stag(t, quoteAt + 0.4, 0.7, easeBack) * e;
        quote.scale.set(0.62 * k, 0.62 * quote.userData.aspect * k, 1);
        quote.position.y = 0.42 + Math.sin(t * 1.5) * 0.008;
      }
    },
  };
}

// ---------------------------------------------------------------- 4. Animation
function gearGeometry(r, teeth) {
  const inner = r * 0.78, s = new THREE.Shape();
  for (let i = 0; i < teeth; i++) {
    const a = (i / teeth) * TAU, w = Math.PI / teeth;
    const pts = [[inner, a - w * 0.55], [r, a - w * 0.32], [r, a + w * 0.32], [inner, a + w * 0.55]];
    pts.forEach(([rad, ang], j) => { const x = Math.cos(ang) * rad, y = Math.sin(ang) * rad; i === 0 && j === 0 ? s.moveTo(x, y) : s.lineTo(x, y); });
  }
  s.closePath();
  const hole = new THREE.Path(); hole.absarc(0, 0, r * 0.28, 0, TAU, true); s.holes.push(hole);
  const geo = new THREE.ExtrudeGeometry(s, { depth: 0.012, bevelEnabled: true, bevelThickness: 0.002, bevelSize: 0.0015, bevelSegments: 2, curveSegments: 6 });
  geo.translate(0, 0, -0.006);
  return geo;
}

function bulb(color) {
  const b = new THREE.Group();
  const glass = new THREE.MeshStandardMaterial({ color: 0xfff0c4, emissive: color, emissiveIntensity: 0.12, transparent: true, opacity: 0.9, roughness: 0.12 });
  const sph = new THREE.Mesh(new THREE.SphereGeometry(0.03, 32, 20), glass); sph.position.y = 0.035; b.add(sph);
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.018, 0.018, 20), glass); neck.position.y = 0.012; b.add(neck);
  const screw = new THREE.Mesh(new THREE.CylinderGeometry(0.0125, 0.0125, 0.016, 20), goldMat()); screw.position.y = -0.004; b.add(screw);
  const halo = glow(color, 0.16, 0); halo.position.y = 0.035; b.add(halo);
  b.userData = { glass, halo };
  return shadowed(b);
}

const DESIGN_STEPS = [
  { t: 'اختيار', full: 'اختيار المادة العلمية', c: 0x8cc63f },
  { t: 'تحليل', full: 'تحليلها', c: 0xf39c34 },
  { t: 'تنظيم', full: 'تنظيمها', c: 0x2bb3c0 },
  { t: 'تطوير', full: 'تطويرها', c: 0xe0403a },
  { t: 'تقويم', full: 'تقويمها', c: 0x3a4148 },
];

function buildAnimation(ctx) {
  const g = new THREE.Group(); ctx.stage.add(g);
  const gears = DESIGN_STEPS.map((s, i) => {
    const r = i % 2 ? 0.035 : 0.041;
    const m = glossy(s.c, { roughness: 0.35 });
    const gear = new THREE.Mesh(gearGeometry(r, i % 2 ? 9 : 11), m); shadowed(gear);
    const holder = new THREE.Group();
    holder.position.copy(P(0.57 + i * 0.075, 0.16, 0.1 + Math.sin((i / 4) * Math.PI) * 0.03));
    holder.add(gear); g.add(holder);
    const tag = sprite(s.t, 0.075, { size: 46, width: 260, weight: 800, border: '#' + s.c.toString(16).padStart(6, '0') });
    tag.position.y = -0.068; holder.add(tag);
    ctx.tap(gear, () => explain());
    return { s, gear, holder, m, tag, r, spin: 0 };
  });
  const designer = bulb(0xffc04d); designer.position.copy(P(0.543, 0.3, 0.035)); g.add(designer);
  const learner = bulb(0xffc04d); learner.position.copy(P(0.823, 0.305, 0.035)); g.add(learner);
  designer.userData.glass.emissiveIntensity = 1.6; designer.userData.halo.material.opacity = 0.95;
  ctx.tap(designer, () => explain());
  ctx.tap(learner, () => explain());

  const orb = glow(0xffe7a8, 0.07, 1); g.add(orb);
  const trail = Array.from({ length: 8 }, () => { const s = glow(0xffd27a, 0.04, 0.5); g.add(s); return s; });
  const path = new THREE.CatmullRomCurve3([
    designer.position.clone().setY(0.07),
    ...gears.map((x) => x.holder.position.clone()),
    learner.position.clone().setY(0.07),
  ]);

  function explain() {
    ctx.ui.card({ tag: 'تعريف ريتشي', title: 'تصميم التدريس', body: '«إيجاد مواصفات تفصيلية لتطوير المواقف التعليمية التي تسهّل عملية التعلّم وتقويمها والمحافظة عليها، سواء أكانت وحدات تعليمية كبيرة أو صغيرة».', color: 0x2bb3c0 });
  }
  let start = 0, lastCap = '', cycles = 0, playing = true;
  const replay = () => { start = now; playing = true; learnerLit = false; gears.forEach((x) => (x.spin = 0)); };
  let now = 0, learnerLit = false;
  ctx.ui.choices([{ label: '⟲ أعد المشهد', onPick: replay }, { label: 'التعريف', onPick: explain }]);

  return {
    update(t, dt, e) {
      now = t;
      const lt = t - start;
      gears.forEach((x, i) => {
        const a = stag(t, 0.3 + i * 0.1, 0.6, easeBack) * e;
        x.holder.scale.setScalar(Math.max(a, 0.001));
        const active = lt > 1.4 + i * 1.0;
        x.spin = THREE.MathUtils.damp(x.spin, active ? 1 : 0, 3, dt);
        x.gear.rotation.z += dt * x.spin * (i % 2 ? -2.2 : 1.8);
        x.m.emissive.setHex(x.s.c); x.m.emissiveIntensity = x.spin * 0.35;
        x.holder.position.y = 0.1 + Math.sin((i / 4) * Math.PI) * 0.03 + (active ? Math.sin(t * 4 + i) * 0.003 : 0);
      });
      [designer, learner].forEach((b, i) => b.scale.setScalar(Math.max(stag(t, 0.1 + i * 0.2, 0.6, easeBack) * e, 0.001)));

      // Orb journey: designer → five gears → learner, from 1.0s to 7.0s
      const jp = clamp01((lt - 1.0) / 6.0);
      orb.visible = lt > 1.0 && jp < 1 && e > 0.1;
      if (orb.visible) {
        orb.position.copy(path.getPoint(jp));
        trail.forEach((s, k) => { s.visible = true; s.position.copy(path.getPoint(Math.max(0, jp - (k + 1) * 0.012))); s.material.opacity = 0.5 * (1 - k / 8); });
      } else trail.forEach((s) => (s.visible = false));

      if (lt > 7.0 && !learnerLit) {
        learnerLit = true;
        ctx.fx.burst(learner.position.clone().setY(0.08), 0xffd27a, 34, 0.45, 0.04);
        cycles += 1;
        if (cycles === 1) ctx.ui.done();
      }
      const lit = learnerLit ? ease((lt - 7.0) / 0.8) : 0;
      learner.userData.glass.emissiveIntensity = 0.12 + lit * 1.5;
      learner.userData.halo.material.opacity = lit * 0.85;

      let cap = '';
      if (lt < 1.4) cap = 'المصمّم يبدأ بفكرة…';
      else if (lt < 6.4) { const i = Math.min(4, Math.floor(lt - 1.4)); cap = `${toAr(i + 1)}. ${DESIGN_STEPS[i].full}`; }
      else if (lt < 7.0) cap = 'من أجل تعلّم أفضل…';
      else cap = 'تعلّم أفضل وأسرع، في أقل وقت وجهد';
      if (cap !== lastCap) { ctx.ui.caption(cap); lastCap = cap; }
      if (playing && lt > 14) replay();
    },
  };
}

// ---------------------------------------------------------------- 5. Game
const SHOTS = [
  { t: 'يحدّد الأهداف التي يريد تحقيقها', ok: true },
  { t: 'يوزّع وقت الحصة بشكل متوازن', ok: true },
  { t: 'ينظّم النشاطات ويبعده عن التخبّط', ok: true },
  { t: 'يختار الأساليب والوسائل المناسبة', ok: true },
  { t: 'يجعل المعلم أكثر ثقة بنفسه', ok: true },
  { t: 'يلغي حاجة الطالب إلى المعلم', ok: false },
  { t: 'يجعل الحصة أطول', ok: false },
  { t: 'يزيد عدد الاختبارات', ok: false },
];
const BALLOON_COLORS = [0xef8f2a, 0x2a8fd0, 0x8a9a1f, 0xe0403a, 0x2bb3c0, 0x8e5bb5, 0xd4ad55, 0x4a7a9a];

function dartMesh() {
  const d = new THREE.Group();
  const tip = new THREE.Mesh(new THREE.ConeGeometry(0.004, 0.02, 12), mat(0xcfd6dd, { metalness: 0.8, roughness: 0.25 })); tip.position.y = 0.04; d.add(tip);
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.0045, 0.0045, 0.04, 12), goldMat()); body.position.y = 0.012; d.add(body);
  const finMat = new THREE.MeshStandardMaterial({ color: 0xd62b3a, side: THREE.DoubleSide, roughness: 0.5 });
  for (let k = 0; k < 3; k++) {
    const fin = new THREE.Mesh(new THREE.PlaneGeometry(0.014, 0.022), finMat); fin.position.y = -0.016; fin.rotation.y = (k / 3) * Math.PI; fin.position.x = 0; d.add(fin);
  }
  d.rotation.x = Math.PI / 2;
  const holder = new THREE.Group(); holder.add(d);
  return shadowed(holder);
}

function buildGame(ctx) {
  const g = new THREE.Group(); ctx.stage.add(g);
  // Dartboard rises from the printed target and stands up.
  const board = new THREE.Group(); board.position.copy(P(0.313, 0.818)); g.add(board);
  const face = new THREE.Group(); board.add(face);
  const rings = [[0.1, 0x1f1f22], [0.084, 0xf4f1ea], [0.067, 0x1f1f22], [0.05, 0xf4f1ea], [0.033, 0x1f1f22], [0.017, 0xd62b3a]];
  rings.forEach(([r, c], i) => {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 0.012 + i * 0.0012, 64), mat(c, { roughness: 0.7 }));
    m.rotation.x = Math.PI / 2; face.add(m);
  });
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.006, 12, 64), goldMat()); face.add(rim);
  shadowed(face);

  const balloons = SHOTS.map((s, i) => {
    const b = new THREE.Group();
    const col = BALLOON_COLORS[i];
    const m = glossy(col, { roughness: 0.2 });
    const ball = new THREE.Mesh(new THREE.SphereGeometry(0.03, 32, 24), m); ball.scale.y = 1.15; b.add(ball);
    const knot = new THREE.Mesh(new THREE.ConeGeometry(0.006, 0.01, 10), m); knot.position.y = -0.036; knot.rotation.x = Math.PI; b.add(knot);
    const str = new THREE.Mesh(new THREE.CylinderGeometry(0.0007, 0.0007, 0.06, 4), mat(0xffffff)); str.position.y = -0.07; b.add(str);
    const tag = sprite(s.t, 0.135, { size: 34, width: 420, weight: 700, border: '#' + col.toString(16).padStart(6, '0') });
    tag.position.y = 0.065; b.add(tag);
    shadowed(b);
    const row = Math.floor(i / 3), colI = i % 3;
    const home = P(0.5 + colI * 0.145 + (row === 2 ? 0.07 : 0), 0.86 - row * 0.1, 0.13 + row * 0.15);
    b.position.copy(home); g.add(b);
    ctx.tap(ball, () => shoot(i));
    ctx.tap(tag, () => shoot(i));
    return { s, b, ball, m, tag, home, col, popped: false, wobble: 0, phase: i * 1.3 };
  });

  const darts = [];
  let state = 'idle', score = 0, hits = 0, timeLeft = 45, now = 0, finale = -1;
  const TRUE_COUNT = SHOTS.filter((s) => s.ok).length;

  function hud() { ctx.ui.hud(`⏱ ${toAr(Math.ceil(timeLeft))}   ·   ⭐ ${toAr(score)}   ·   🎯 ${toAr(hits)} / ${toAr(TRUE_COUNT)}`); }
  function intro() {
    state = 'idle';
    ctx.ui.hud('أصب فوائد تخطيط التدريس فقط');
    ctx.ui.choices([{ label: '🎯 ابدأ اللعب', primary: true, onPick: startGame }]);
  }
  function startGame() {
    state = 'play'; score = 0; hits = 0; timeLeft = 45; finale = -1;
    balloons.forEach((x) => { x.popped = false; x.b.visible = true; x.b.scale.setScalar(1); x.b.position.copy(x.home); });
    darts.forEach((d) => g.remove(d.mesh)); darts.length = 0;
    ctx.ui.choices([]); ctx.ui.hideCard(); hud();
  }
  function shoot(i) {
    if (state !== 'play') { if (state === 'idle') ctx.ui.toast('اضغط «ابدأ اللعب» أولاً'); return; }
    const x = balloons[i]; if (x.popped || x.flying) return;
    const mesh = dartMesh();
    const from = P(0.5, 1.15, 0.35);
    mesh.position.copy(from); g.add(mesh);
    x.flying = true;
    darts.push({ mesh, from, to: x.b.position.clone(), t0: now, target: x, done: false });
  }
  function land(d) {
    const x = d.target; x.flying = false;
    if (x.s.ok) {
      x.popped = true; hits += 1; score += 10;
      ctx.fx.burst(x.b.position.clone(), x.col, 30, 0.5, 0.035);
      g.remove(d.mesh);
      ctx.ui.toast('✓ صحيح: ' + x.s.t);
      if (hits === TRUE_COUNT) end(true);
    } else {
      score = Math.max(0, score - 5); x.wobble = 1;
      d.bounce = now;
      ctx.ui.toast('✗ ليست من فوائد التخطيط');
    }
    hud();
  }
  function end(won) {
    state = 'over'; finale = now;
    const stars = hits === TRUE_COUNT ? (timeLeft > 20 ? 3 : 2) : hits >= 3 ? 1 : 0;
    if (won) ctx.fx.burst(board.position.clone().setY(0.17), 0xffd27a, 50, 0.6, 0.045);
    ctx.ui.card({
      tag: 'النتيجة', title: `${'★'.repeat(stars)}${'☆'.repeat(3 - stars)}   ${toAr(score)} نقطة`,
      body: won ? 'أصبت كل فوائد تخطيط التدريس! التخطيط يحدّد الهدف، وينظّم الوقت والنشاط، ويمنح المعلم ثقة.' : `أصبت ${toAr(hits)} من ${toAr(TRUE_COUNT)}. جرّب مرة ثانية؛ فالتخطيط يحدّد الهدف وينظّم الوقت والنشاط.`,
      color: 0xd62b3a,
    });
    if (hits >= 3) ctx.ui.done();
    ctx.ui.choices([{ label: '⟲ العب مرة ثانية', primary: true, onPick: startGame }]);
  }
  intro();

  return {
    update(t, dt, e) {
      now = t;
      const a = stag(t, 0.2, 0.8, easeBack) * e;
      const stand = stag(t, 0.7, 0.8);
      board.scale.setScalar(Math.max(a, 0.001));
      face.rotation.x = lerp(-Math.PI / 2, 0, stand);
      face.position.y = lerp(0.006, 0.17, stand);
      face.position.z = lerp(0, -0.02, stand);
      balloons.forEach((x, i) => {
        const k = x.popped ? 0 : stag(t, 1.4 + i * 0.1, 0.6, easeBack) * e;
        x.b.scale.setScalar(Math.max(k, 0.0001));
        x.b.visible = k > 0.001;
        x.b.position.set(x.home.x + Math.sin(t * 0.9 + x.phase) * 0.012, x.home.y + Math.sin(t * 1.3 + x.phase) * 0.012, x.home.z);
        x.wobble = Math.max(0, x.wobble - dt * 1.5);
        x.b.rotation.z = Math.sin(t * 25) * 0.25 * x.wobble;
        x.m.emissive.setHex(0xff2020); x.m.emissiveIntensity = x.wobble * 0.6;
      });
      darts.forEach((d) => {
        if (d.bounce) { // a wrong shot falls away
          const bt = now - d.bounce;
          d.mesh.position.y -= dt * (0.2 + bt * 1.2); d.mesh.rotation.z += dt * 6;
          if (bt > 1) { g.remove(d.mesh); d.gone = true; }
          return;
        }
        const p = clamp01((now - d.t0) / 0.38);
        const pos = new THREE.Vector3().lerpVectors(d.from, d.target.b.position, p);
        pos.y += Math.sin(p * Math.PI) * 0.08;
        const dir = new THREE.Vector3().subVectors(pos, d.mesh.position);
        d.mesh.position.copy(pos);
        if (dir.lengthSq() > 1e-10) d.mesh.lookAt(g.localToWorld(pos.clone().add(dir.normalize())));
        if (p >= 1 && !d.done) { d.done = true; land(d); }
      });
      for (let k = darts.length - 1; k >= 0; k--) if (darts[k].gone || (darts[k].done && !darts[k].bounce)) darts.splice(k, 1);
      if (state === 'play') {
        const before = Math.ceil(timeLeft);
        timeLeft = Math.max(0, timeLeft - dt);
        if (Math.ceil(timeLeft) !== before) hud();
        if (timeLeft <= 0) end(false);
      }
    },
    onLost() { if (state === 'play') { /* pause the clock while the page is out of view */ } },
  };
}

// ---------------------------------------------------------------- 6. Questions
const ROWS = { goal: { v: 0.264, h: 0.04, n: 'الهدف' }, student: { v: 0.311, h: 0.046, n: 'أدوار الطالب' }, teacher: { v: 0.361, h: 0.047, n: 'أدوار المعلم' }, mats: { v: 0.428, h: 0.075, n: 'دور الخبرات والمواد الدراسية' } };
const COLS = { taalim: { u: 0.53, w: 0.315, n: 'التعليم', c: 0x5aa7d6 }, tadris: { u: 0.245, w: 0.25, n: 'التدريس', c: 0xe48a7a } };
const QUIZ = [
  { s: 'حشو عقول الطلبة بالمعلومات التي يعرضها المعلم', a: 'taalim', r: 'goal' },
  { s: 'مساعدة الطلبة على التفاعل مع الخبرات في الصف وخارجه', a: 'tadris', r: 'goal' },
  { s: 'التلقّي والاستماع والحفظ والترديد', a: 'taalim', r: 'student' },
  { s: 'ممارسة عمليات الانتباه والتفكير', a: 'tadris', r: 'student' },
  { s: 'ملقّن يتحدث طيلة الحصة', a: 'taalim', r: 'teacher' },
  { s: 'منظّم للخبرات ومستثير لدوافع الطلبة', a: 'tadris', r: 'teacher' },
  { s: 'تدريب الأذهان بالتكرار الآلي', a: 'taalim', r: 'mats' },
  { s: 'مواقع لتجريب الأفكار وأساليب التعلّم', a: 'tadris', r: 'mats' },
];

function frameTexture(color = '#d39a22') {
  const c = document.createElement('canvas'); c.width = 512; c.height = 256;
  const g = c.getContext('2d');
  g.shadowColor = color; g.shadowBlur = 22; g.strokeStyle = color; g.lineWidth = 12;
  g.beginPath(); g.roundRect(20, 20, 472, 216, 20);
  g.fillStyle = 'rgba(232,178,60,.22)'; g.fill(); g.stroke();
  return new THREE.CanvasTexture(c);
}

function buildQuiz(ctx) {
  const g = new THREE.Group(); ctx.stage.add(g);
  const pillars = {};
  for (const [k, col] of Object.entries(COLS)) {
    const p = new THREE.Group(); p.position.copy(P(k === 'taalim' ? 0.64 : 0.34, 0.8)); g.add(p);
    const m = glossy(col.c, { roughness: 0.3 });
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.082, 0.1, 48), m); body.position.y = 0.05; p.add(body);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.075, 0.005, 12, 48), goldMat()); ring.rotation.x = Math.PI / 2; ring.position.y = 0.1; p.add(ring);
    const top = new THREE.Mesh(new THREE.CircleGeometry(0.072, 48), new THREE.MeshStandardMaterial({ color: 0x1f1b16, roughness: 0.9 })); top.rotation.x = -Math.PI / 2; top.position.y = 0.1005; p.add(top);
    const name = label(col.n, 0.15, { size: 64, width: 420, weight: 800, title: true, bg: 'rgba(250,247,240,.95)' });
    name.position.set(0, 0.055, 0.0835); p.add(name);
    shadowed(p);
    ctx.tap(body, () => answer(k)); ctx.tap(name, () => answer(k));
    pillars[k] = { p, m, col, glowT: 0 };
  }
  const frame = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: frameTexture(), transparent: true, depthWrite: false, toneMapped: false }));
  frame.rotation.x = -Math.PI / 2; frame.visible = false; g.add(frame);

  let card = null, cardFly = null, round = 0, correct = 0, now = 0, phase = 'ask', frameAt = -1;
  const order = QUIZ.map((_, i) => i).sort(() => Math.random() - 0.5).slice(0, 5);
  const cardHome = P(0.49, 0.72, 0.3);

  function ask() {
    phase = 'ask'; frame.visible = false;
    const q = QUIZ[order[round]];
    if (card) g.remove(card);
    card = sprite(q.s, 0.32, { size: 44, width: 760, weight: 700, bg: 'rgba(250,247,240,.97)', border: '#d4ad55' });
    card.position.copy(cardHome); card.userData.born = now; g.add(card);
    ctx.ui.hud(`السؤال ${toAr(round + 1)} من ٥  ·  تنبّأ: لأيّهما تنتمي العبارة؟`);
    ctx.ui.hideCard();
    ctx.ui.choices([
      { label: 'التدريس', color: '#e48a7a', onPick: () => answer('tadris') },
      { label: 'التعليم', color: '#5aa7d6', onPick: () => answer('taalim') },
    ]);
  }
  function answer(k) {
    if (phase !== 'ask') return;
    phase = 'reveal';
    const q = QUIZ[order[round]];
    const ok = k === q.a; if (ok) correct += 1;
    const target = pillars[q.a];
    cardFly = { from: card.position.clone(), to: target.p.position.clone().setY(0.11), t0: now };
    target.glowT = 1;
    ctx.fx.burst(target.p.position.clone().setY(0.14), ok ? 0x7ad37a : 0xffd27a, ok ? 30 : 14, 0.4, 0.035);
    // Light up the exact printed cell in the table.
    const row = ROWS[q.r], col = COLS[q.a];
    frame.position.copy(P(col.u, row.v, 0.004));
    frame.scale.set(col.w + 0.03, row.h * PAGE_H + 0.03, 1);
    frame.visible = true; frameAt = now;
    ctx.ui.card({
      tag: ok ? '✓ توقّعك صحيح' : '✗ توقّع غير صحيح، وهذا جزء من التعلّم',
      title: `في الجدول: ${col.n} · ${row.n}`,
      body: `«${q.s}» تنتمي إلى ${col.n}. انظر الخانة المضيئة في الجدول المطبوع.`,
      color: col.c,
    });
    const last = round === 4;
    ctx.ui.choices([{ label: last ? 'النتيجة' : 'التالي ←', primary: true, onPick: () => (last ? finish() : (round += 1, ask())) }]);
  }
  function finish() {
    phase = 'done'; frame.visible = false; if (card) { g.remove(card); card = null; }
    ctx.ui.card({ tag: 'تنبّأ ثم شاهد', title: `${toAr(correct)} من ٥ توقّعات صحيحة`, body: 'الخلاصة من الجدول: التعليم يركّز على نقل المعلومة وحفظها، والتدريس يركّز على تفاعل الطالب وتفكيره وتجريبه.', color: 0xd4ad55 });
    ctx.ui.hud('أحسنت!');
    ctx.ui.done();
    ctx.ui.choices([{ label: '⟲ أعد الأسئلة', primary: true, onPick: () => { round = 0; correct = 0; order.sort(() => Math.random() - 0.5); ask(); } }]);
  }

  let started = false;
  return {
    update(t, dt, e) {
      now = t;
      if (!started && t > 1.4) { started = true; ask(); }
      Object.values(pillars).forEach((x, i) => {
        x.p.scale.setScalar(Math.max(stag(t, 0.3 + i * 0.15, 0.7, easeBack) * e, 0.001));
        x.glowT = Math.max(0, x.glowT - dt * 0.7);
        x.m.emissive.setHex(x.col.c); x.m.emissiveIntensity = x.glowT * 0.7;
      });
      if (card) {
        if (phase === 'ask') {
          const k = stag(t, card.userData.born, 0.5, easeBack) * e;
          card.scale.set(0.32 * k, 0.32 * card.userData.aspect * k, 1);
          card.position.y = cardHome.y + Math.sin(t * 2) * 0.008;
        } else if (cardFly) {
          const p = ease((t - cardFly.t0) / 0.7);
          card.position.lerpVectors(cardFly.from, cardFly.to, p);
          card.position.y += Math.sin(p * Math.PI) * 0.06;
          const s = 0.32 * (1 - p * 0.85);
          card.scale.set(s, s * card.userData.aspect, 1);
          card.material.opacity = 1 - clamp01((p - 0.8) * 5);
        }
      }
      if (frame.visible) frame.material.opacity = (0.75 + Math.sin(t * 5) * 0.25) * ease((t - frameAt) / 0.4);
    },
  };
}

// ---------------------------------------------------------------- catalogue
export const toAr = (n) => String(n).replace(/\d/g, (d) => '٠١٢٣٤٥٦٧٨٩'[d]);

// Order matters: it is the order of the images in targets.mind (the recognition file).
// kind 'page' = a living page that earns a stamp; 'special' = the welcome page and the secret page.
export const EXPERIENCES = [
  {
    id: 'teacher-roles', kind: 'page', door: 1, pack: 'door1', page: 'p51', pageNo: '٥١', title: 'أدوار المعلم في عصر التكنولوجيا', type: 'infographic', typeLabel: 'إنفوجرافيك حيّ',
    video: 'HHowUzMcWEQ', center: [0.5, 0.69], free: true, build: buildInfographic,
    behind: { principle: 'مبدأ التجزئة (ريتشارد ماير)', body: 'لم نعرض الأدوار الستة دفعة واحدة؛ ارتفعت درجةً درجة، وأنت تكشف كل دور بلمستك. تقسيم المعلومة إلى قطع يخفّف العبء على الذاكرة العاملة، فيثبت الترتيب في ذهنك.' },
  },
  {
    id: 'e-learning-class', kind: 'page', door: 1, pack: 'door1', page: 'p49', pageNo: '٤٩', title: 'الفصل الإلكتروني: مراحل التدريب التكنولوجي', type: 'model', typeLabel: 'مجسّم ثلاثي الأبعاد',
    video: 'IYwFwcVajqQ', center: [0.54, 0.715], free: true, build: buildModel,
    behind: { principle: 'مخروط الخبرة (إدجار ديل)', body: 'النموذج المجسّم أقرب إلى الخبرة الحقيقية من الصورة المسطّحة. حين تدور حول الفصل وتلمس أجزاءه، يصبح المفهوم المجرّد شيئاً تراه وتلمسه.' },
  },
  {
    id: 'technology-tree', kind: 'page', door: 1, pack: 'door1', page: 'p45', pageNo: '٤٥', title: 'شجرة التكنولوجيا: ثلاثة معانٍ', type: 'hotspots', typeLabel: 'صورة تفاعلية',
    video: 'IYwFwcVajqQ', center: [0.42, 0.7], free: false, build: buildHotspots,
    behind: { principle: 'الاكتشاف الموجّه (جيروم برونر)', body: 'لم نعطك التعريفات الثلاثة جاهزة؛ تركناك تكتشفها بنفسك من داخل الصورة. المعنى الذي تصل إليه بنفسك يبقى في الذاكرة أطول من المعنى الذي يُلقى عليك.' },
  },
  {
    id: 'instructional-design', kind: 'page', door: 1, pack: 'door1', page: 'p54', pageNo: '٥٤', title: 'تصميم التدريس: من فكرة المصمّم إلى عقل المتعلّم', type: 'animation', typeLabel: 'أنيميشن',
    video: 'NSTqBgSMi_g', center: [0.72, 0.22], free: true, crop: [0.5, 0.03, 0.98, 0.5], build: buildAnimation,
    behind: { principle: 'مبدأ التزامن (ماير) والترميز الثنائي (بايفيو)', body: 'الكلمة تظهر في اللحظة نفسها التي يدور فيها الترس الذي تصفه. حين تصل الصورة والكلمة معاً، يبني عقلك تمثيلين للفكرة نفسها فتترسّخ.' },
  },
  {
    id: 'planning-darts', kind: 'page', door: 1, pack: 'door1', page: 'p55', pageNo: '٥٥', title: 'أصب الهدف: فوائد تخطيط التدريس', type: 'game', typeLabel: 'لعبة',
    video: 'NSTqBgSMi_g', center: [0.55, 0.75], free: true, crop: [0.12, 0.64, 0.52, 0.95], build: buildGame,
    behind: { principle: 'التلعيب والتعزيز الفوري (سكنر)', body: 'وقت ونقاط وتحدٍّ، وكل رمية تعطيك نتيجتها في الحال. التغذية الراجعة الفورية تحوّل الحفظ إلى قرارات سريعة تكرّرها بمتعة.' },
  },
  {
    id: 'teaching-vs-instruction', kind: 'page', door: 1, pack: 'door1', page: 'p41', pageNo: '٤١', title: 'تنبّأ ثم شاهد: التعليم أم التدريس؟', type: 'quiz', typeLabel: 'أسئلة',
    video: 'HHowUzMcWEQ', center: [0.5, 0.62], free: false, build: buildQuiz,
    behind: { principle: 'تنبّأ ثم شاهد (البنائية) والتعلّم بالاسترجاع', body: 'حين تلتزم بإجابة قبل أن ترى الحقيقة، يقارن عقلك توقّعه بالواقع ويعيد بناء الفكرة. ثم أضأنا لك الخانة نفسها في الجدول المطبوع ليتصل الجديد بما في الكتاب.' },
  },
  {
    id: 'channels-of-time', kind: 'page', door: 1, pack: 'door1', page: 'p66', pageNo: '٦٦', title: 'قنوات الزمن: رحلة الوسائل التعليمية', type: 'timeline', typeLabel: 'آلة الزمن',
    video: 'gPzhwiIN__8', center: [0.635, 0.36], free: true, crop: [0.34, 0.02, 0.955, 0.58], build: buildTimeTV,
    behind: { principle: 'التنظيم المتقدّم والسرد (أوزوبل)', body: 'وضعنا كل وسيلة على خطّ زمني واحد قبل تفاصيلها؛ فحين يرى عقلك الإطار الكبير أولاً، يجد لكل معلومة جديدة مكاناً تتعلّق به.' },
  },
  {
    id: 'dale-cone', kind: 'page', door: 1, pack: 'door1', page: 'p147', pageNo: '١٤٧', title: 'مخروط الخبرة: من الواقع إلى التجريد', type: 'ladder', typeLabel: 'سلّم تفاعلي',
    video: 'Ro4IM9cWn0s', center: [0.542, 0.5], free: true, crop: [0.14, 0.245, 0.84, 0.7], build: buildCone,
    behind: { principle: 'من المحسوس إلى المجرد (برونر وديل)', body: 'بدأت رحلتك من قاعدة المخروط، من الخبرة الواقعية، ثم صعدت نحو الرموز. هكذا يُبنى الفهم: تمثيل عملي، ثم صوري، ثم رمزي.' },
  },
  {
    id: 'communication-lab', kind: 'page', door: 1, pack: 'door1', page: 'p151', pageNo: '١٥١', title: 'مختبر الاتصال: الرسالة والتشويش', type: 'lab', typeLabel: 'مختبر تفاعلي',
    video: 'GHKPjqQZRnA', center: [0.54, 0.27], free: false, crop: [0.11, 0.09, 0.88, 0.42], build: buildLab,
    behind: { principle: 'التعلّم بالمحاكاة والتجريب', body: 'لم نخبرك بأثر التشويش؛ أعطيناك مقبضه. حين تغيّر متغيّراً واحداً وترى نتيجته فوراً، تكتشف العلاقة بنفسك كما يكتشفها العالِم في مختبره.' },
  },
  {
    id: 'virtual-portal', kind: 'page', door: 3, pack: 'door34', page: 'p395', pageNo: '٣٩٥', title: 'بوابة العالم الافتراضي', type: 'portal', typeLabel: 'بوابة',
    video: 'hc9KfKNPIRQ', center: [0.256, 0.585], free: false, hole: PORTAL_HOLE, crop: [0.02, 0.36, 0.5, 0.82], build: buildPortal,
    behind: { principle: 'الانغماس والحضور (Presence)', body: 'حين يشعر المتعلّم أنه «داخل» البيئة لا أمامها، يرتفع انتباهه ودافعيته. لذلك فتحنا لك نافذة في الورق نفسه بدل صورة تنظر إليها.' },
  },
  {
    id: 'mobile-exploded', kind: 'page', door: 3, pack: 'door34', page: 'p541', pageNo: '٥٤١', title: 'فكّك الجوال: التعلّم المتنقل', type: 'exploded', typeLabel: 'فكّك الجهاز',
    video: 'JMlobDkhuPY', center: [0.275, 0.62], free: true, crop: [0.04, 0.38, 0.5, 0.82], build: buildPhone,
    behind: { principle: 'المنظر المفكَّك وتقليل العبء المعرفي', body: 'رؤية الجهاز طبقةً طبقة، وكل طبقة مربوطة بوظيفتها، أسهل على الذاكرة العاملة من رؤية الكل مرة واحدة؛ فتفهم العلاقة بين الجزء والوظيفة.' },
  },
  {
    id: 'bloom-pyramid', kind: 'page', door: 4, pack: 'door34', page: 'p573', pageNo: '٥٧٣', title: 'ركّب هرم بلوم', type: 'assemble', typeLabel: 'ركّب الهرم',
    video: 'WTh25DM1ZCI', center: [0.33, 0.6], free: true, crop: [0.04, 0.08, 0.64, 0.68], build: buildBloom,
    behind: { principle: 'التسلسل الهرمي للتعلّم (روبرت جانييه)', body: 'لم يُقبل منك مستوى قبل الذي تحته، كما ينصّ الكتاب: على المتعلّم أن يصل إلى أهداف المستوى الأدنى قبل أن يبني عليها المستوى الأعلى.' },
  },
  {
    id: 'digital-divide-balance', kind: 'page', door: 4, pack: 'door34', page: 'p587', pageNo: '٥٨٧', title: 'ميزان الفجوة الرقمية', type: 'balance', typeLabel: 'الميزان',
    video: 'S0GvFyJOQ5g', center: [0.56, 0.62], free: true, crop: [0.14, 0.34, 0.86, 0.68], build: buildBalance,
    behind: { principle: 'التفكير المنظومي', body: 'رأيت الأرقام المطبوعة وزناً تحمله يدك، ثم رأيت أن عاملاً واحداً لا يكفي. التفكير المنظومي يعلّمك أن المشكلات الكبيرة تتوازن بعوامل متعددة معاً.' },
  },
  {
    id: 'interactive-classroom', kind: 'page', door: 4, pack: 'door34', page: 'p599', pageNo: '٥٩٩', title: 'من فصل تقليدي إلى فصل تفاعلي', type: 'roleplay', typeLabel: 'مشهد تمثيلي',
    video: 'DzdyVn3kS50', center: [0.31, 0.3], free: true, crop: [0.02, 0.02, 0.6, 0.5], build: buildRoleplay,
    behind: { principle: 'التعلّم الاجتماعي ولعب الأدوار (ألبرت باندورا)', body: 'تقمّصت دور المعلّم ورأيت أثر قراراتك على طلابك. حين نمارس الدور ونرى نتائجه، تنتقل المعرفة من «أعرف» إلى «أستطيع».' },
  },
  {
    id: 'tech-teacher-branch', kind: 'page', door: 4, pack: 'door34', page: 'p617', pageNo: '٦١٧', title: 'طريق المعلّم التكنولوجي', type: 'branching', typeLabel: 'قرار متفرّع',
    video: 'dJidLUqALTY', center: [0.27, 0.5], free: true, crop: [0.0, 0.28, 0.56, 0.8], build: buildBranch,
    behind: { principle: 'التعلّم التجريبي (ديفيد كولب)', body: 'جرّبت قراراً، ثم رأيت نتيجته، ثم تأمّلتها، ثم وصلت إلى المفهوم في النهاية. هذه دورة كولب: تجربة فتأمّل فمفهوم فتطبيق.' },
  },
  {
    id: 'welcome', kind: 'special', pack: 'all', page: 'intro', pageNo: '', title: 'مرحباً بك في الموسوعة الحيّة', type: 'welcome', typeLabel: 'صفحة الترحيب',
    center: [0.5, 0.5], free: false, build: buildWelcome,
  },
  {
    id: 'secret', kind: 'special', pack: 'all', page: 'p8', pageNo: '', title: 'الصفحة السرّية', type: 'secret', typeLabel: 'صفحة سرّية',
    center: [0.5, 0.5], free: false, crop: [0.19, 0.24, 0.81, 0.76], build: buildSecret,
  },
];
export const PAGES = EXPERIENCES.filter((x) => x.kind === 'page');

// Recognition packs: each opens with its own small recognition file so speed stays the same as the
// book grows. `ids` follows the order of the images inside that pack's file.
export const PACKS = [
  { id: 'door1', title: 'الباب الأول', sub: 'مفهوم تكنولوجيا التعليم', file: './targets-door1.mind',
    ids: ['teacher-roles', 'e-learning-class', 'technology-tree', 'instructional-design', 'planning-darts', 'teaching-vs-instruction', 'channels-of-time', 'dale-cone', 'communication-lab', 'welcome', 'secret'] },
  { id: 'door34', title: 'البابان الثالث والرابع', sub: 'المستحدثات والمعلّم والتكنولوجيا', file: './targets-door34.mind',
    ids: ['virtual-portal', 'mobile-exploded', 'bloom-pyramid', 'digital-divide-balance', 'interactive-classroom', 'tech-teacher-branch', 'welcome', 'secret'] },
];
