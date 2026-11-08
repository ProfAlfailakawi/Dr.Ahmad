// p373: a four-ring cryptex crowned by a tablet. Touch a ring to turn it to its next option; the right choice locks in gold and lights its quarter of the tablet.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { P, ease, easeBack, clamp01, stag, mat, glossy, goldMat, shadowed, glow } from '../../kit.js?v=26';
import { inked } from '../../pencil.js?v=26';
import { TAU, css, rising, halos, motes, blob, dais, canvasTex, glyph, paintWrap, roundRect, faceMat, shakeX } from '../lib/b6-kit.js?v=26';

export const meta = { free: true, center: [0.5, 0.5], typeLabel: 'لعبة تصميم', title: 'صمّم حصة الآيباد' };

const SLOTS = [
  { name: 'تنظيم العمل', gl: 'group', c: 0x3a74d8, ok: 2, opts: [
    ['كل مجموعة المشروع كاملاً', 'ينتظر بعض الطلبة دورهم، فيضيع الوقت ولا ينشغل الجميع.'],
    ['طالب واحد والباقي يشاهدون', 'ينفرد طالب واحد بالتعلّم النشط، ويتحول الباقون إلى متفرجين.'],
    ['مجموعات صغيرة بأجزاء مختلفة', 'يضمن انشغال بقية المجموعات بتنفيذ عملها وتجهيزه قبل أن يأتي دورها.']] },
  { name: 'العرض الأكبر', gl: 'tablet', c: 0xef8a2a, ok: 1, opts: [
    ['كل طالب يشاهد منفرداً', 'يفقد الصف المشاهدة المشتركة التي تتيح النقاش الفوري بعد العرض.'],
    ['ربط بالسبورة أو تلفاز آبل', 'يوفّر شاشة أكبر ويشرك عدداً كبيراً من الطلبة في المشاهدة والنقاش.'],
    ['صور ثابتة بدل المقاطع', 'يُفقر المحتوى المرئي ولا يحلّ مشكلة حجم الشاشة.']] },
  { name: 'التوصيل', gl: 'cable', c: 0x2fae78, ok: 2, opts: [
    ['أي كابل متاح', 'لا يتم الربط ما لم يتطابق المنفذان في الجهاز والبروجكتور.'],
    ['HDMI لبروجكتور لا يدعمه', 'الوصلة وحدها لا تكفي؛ فالمنفذ يجب أن يكون مدعوماً في الطرفين.'],
    ['HDMI مع بروجكتور يدعمه', 'يجب أن يدعم الجهازان المنفذ نفسه، وإلا استُخدمت الوصلة العادية VGA.']] },
  { name: 'متابعة الطلبة', gl: 'pencilnote', c: 0xd9487f, ok: 1, opts: [
    ['الذاكرة ثم التدوين آخر الفصل', 'يضيّع الملاحظات التكوينية التي تُكتب لحظتها ويُبنى عليها التوجيه.'],
    ['تطبيق TeacherPal', 'تطبيق مخصص لرصد الدرجات والملاحظات، يقوم مقام دفتر المتابعة.'],
    ['تطبيق KeyNote للدرجات', 'KeyNote تطبيق عروض شبيه بالبوربوينت، وليس أداة لرصد الدرجات.']] },
];
const A = 0.145, PW = 0.46, PH = 0.098, RH = 0.1, GAP = 0.15, Y0 = 0.075;
const QX = [0.5, 0.25], QUAD = [[1, 0], [0, 0], [1, 1], [0, 1]]; // [col from right, row]

export default function build(ctx) {
  const g = new THREE.Group(); g.position.copy(P(meta.center[0], meta.center[1])); g.scale.setScalar(0.86); ctx.stage.add(g);
  const rise = rising(), hal = halos();
  g.add(blob(0.5, 0.3));
  const mo = motes(g, 16, { r: 0.42, h: 0.8, color: 0xcfe0ff });

  const dz = dais(0.33, { top: 0xf6f0e2, h: 0.03 }); g.add(dz); rise.add(dz, 0, 0.05, 0.6);
  const topY = Y0 + 3 * GAP + RH;
  const column = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.11, topY + 0.04, 24), glossy(0x24324d, { clearcoat: 0.5 })); column.position.y = (topY + 0.04) / 2; g.add(column);
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.03, 0.07, 16), goldMat()); neck.position.y = topY + 0.045; g.add(neck);
  shadowed(column); rise.add(column, 0.15, 0.04, 0.5);

  // ---------- tablet crown
  const pad = new THREE.Group(); pad.position.y = topY + 0.2; g.add(pad);
  const tilt = new THREE.Group(); tilt.rotation.x = -0.5; pad.add(tilt);
  const frame = inked(new RoundedBoxGeometry(0.5, 0.36, 0.024, 4, 0.03), { color: 0xe8ebef }); tilt.add(frame);
  const frameM = new THREE.Mesh(new RoundedBoxGeometry(0.496, 0.356, 0.02, 4, 0.029), glossy(0xdfe3e8, { metalness: 0.4, roughness: 0.3 })); tilt.add(frameM);
  const scv = document.createElement('canvas'); scv.width = 640; scv.height = 456; const sg = scv.getContext('2d');
  const stex = new THREE.CanvasTexture(scv); stex.colorSpace = THREE.SRGBColorSpace; stex.anisotropy = 4;
  const lit = [false, false, false, false];
  function drawScreen() {
    sg.fillStyle = '#121b30'; sg.fillRect(0, 0, 640, 456);
    SLOTS.forEach((s, i) => {
      const [c, r] = QUAD[i], x = 18 + c * 0 + (c === 1 ? 336 : 0) * 0, X = c === 1 ? 336 : 18, Y = 18 + r * 224;
      sg.fillStyle = lit[i] ? css(s.c) : '#1f2a46'; roundRect(sg, X, Y, 286, 196, 26); sg.fill();
      if (lit[i]) { sg.fillStyle = 'rgba(255,255,255,.18)'; sg.beginPath(); sg.arc(X + 60, Y + 40, 110, 0, TAU); sg.fill(); }
      glyph(sg, s.gl, X + 143, Y + 86, 108, lit[i] ? '#ffffff' : 'rgba(255,255,255,.22)', lit[i] ? css(s.c) : '#1f2a46');
      paintWrap(sg, s.name, X + 143, Y + 164, 250, 36, lit[i] ? '#ffffff' : 'rgba(255,255,255,.3)', 800);
    });
    stex.needsUpdate = true;
  }
  drawScreen();
  const scr = new THREE.Mesh(new THREE.PlaneGeometry(0.46, 0.318), faceMat(stex)); scr.position.z = 0.0125; tilt.add(scr);
  const bk = new THREE.Mesh(new THREE.CircleGeometry(0.03, 24), goldMat()); bk.position.z = -0.0125; bk.rotation.y = Math.PI; tilt.add(bk);
  shadowed(tilt); rise.add(pad, 1.4, 0.15, 0.9);
  const padGlow = glow(0x8fb8ff, 1.1, 0); padGlow.position.y = topY + 0.2; g.add(padGlow);
  ctx.tap(scr, () => ctx.ui.card({ tag: 'الخلاصة', title: 'الجهاز لا يصنع الدرس', body: 'ينجح الدرس حين يخدم كل خيار هدفاً واضحاً: تنظيم العمل، ثم العرض، ثم التوصيل، ثم المتابعة.', color: 0x3a74d8 }));

  // ---------- rings
  const rings = SLOTS.map((s, k) => {
    const outer = new THREE.Group(); outer.position.y = Y0 + k * GAP; g.add(outer);
    const pivot = new THREE.Group(); outer.add(pivot);
    const core = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, RH - 0.004, 28), mat(0x1f2c47)); core.position.y = RH / 2; pivot.add(core);
    const panels = [0, 1, 2].map((j) => {
      const phi = j * TAU / 3;
      const pg = new THREE.Group(); pg.position.set(Math.sin(phi) * (A + 0.009), RH / 2, Math.cos(phi) * (A + 0.009)); pg.rotation.y = phi; pivot.add(pg);
      const body = new THREE.Mesh(new RoundedBoxGeometry(PW, PH, 0.018, 3, 0.008), glossy(0xfbf8ef, { clearcoat: 0.5 })); pg.add(body);
      const cv = document.createElement('canvas'); cv.width = 1024; cv.height = Math.round(1024 * (PH - 0.008) / (PW - 0.008)); const gg = cv.getContext('2d');
      const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
      const face = new THREE.Mesh(new THREE.PlaneGeometry(PW - 0.008, PH - 0.008), faceMat(tex)); face.position.z = 0.0095; pg.add(face);
      const o = { j, pg, cv, gg, tex, state: 0 };
      return o;
    });
    const draw = (p, state) => { // 0 normal, 1 wrong, 2 right
      const gg = p.gg, W = p.cv.width, H = p.cv.height; gg.clearRect(0, 0, W, H);
      const c = css(s.c); gg.fillStyle = state === 2 ? c : state === 1 ? '#f9e3df' : '#fbf8ef'; roundRect(gg, 0, 0, W, H, 40); gg.fill();
      if (state !== 2) { gg.fillStyle = c; gg.fillRect(0, 0, 22, H); }
      gg.fillStyle = state === 2 ? 'rgba(255,255,255,.96)' : state === 1 ? '#e0603f' : c; gg.beginPath(); gg.arc(W - 96, H / 2, 66, 0, TAU); gg.fill();
      glyph(gg, state === 2 ? 'check' : state === 1 ? 'cross' : s.gl, W - 96, H / 2, 82, state === 2 ? c : '#ffffff', state === 1 ? '#e0603f' : c);
      paintWrap(gg, s.opts[p.j][0], (W - 190) / 2 + 20, H / 2, W - 290, 84, state === 2 ? '#ffffff' : state === 1 ? '#a8402b' : '#1f2b3a', 900, 1.2, 2);
      p.tex.needsUpdate = true;
    };
    panels.forEach((p) => draw(p, 0));
    const colB = new THREE.Mesh(new THREE.CylinderGeometry(0.175, 0.175, 0.012, 36), glossy(s.c, { emissive: s.c, emissiveIntensity: 0.25 })); colB.position.y = 0.0; pivot.add(colB);
    const colT = new THREE.Mesh(new THREE.CylinderGeometry(0.175, 0.175, 0.012, 36), glossy(s.c, { emissive: s.c, emissiveIntensity: 0.25 })); colT.position.y = RH; pivot.add(colT);
    shadowed(outer);
    const hl = hal.add(outer, s.c, 0.5, [0, RH / 2, A + 0.05], 9999); hl.on = 0;
    const o = { s, k, outer, pivot, panels, draw, hl, n: 0, rot: 0, locked: false, shake: 99, bump: 0, lockE: 0 };
    rise.add(outer, 0.4 + k * 0.22, 0.12, 0.7);
    ctx.tap(outer, () => turn(o));
    return o;
  });

  const spark = glow(0xfff2c8, 0.14, 0); g.add(spark); const spark2 = glow(0x9fd2ff, 0.28, 0); g.add(spark2);
  let now = 0, lockedN = 0, finished = false, sparkT = 9, sparkFrom = new THREE.Vector3(), sparkTo = new THREE.Vector3(), padE = 0.15;
  ctx.ui.hud('المس حلقة لتدور');

  function turn(o) {
    if (now < 3.6 || o.locked) return;
    o.n++; const kk = o.n % 3; ctx.sfx.click?.(); ctx.sfx.pop?.();
    const s = o.s, right = kk === s.ok;
    if (right) {
      o.locked = true; o.panels[kk].state = 2; o.draw(o.panels[kk], 2); o.bump = 1; o.hl.on = 0; ctx.sfx.good?.();
      lockedN++; lit[o.k] = true;
      ctx.ui.card({ tag: `مرحلة ${['', '١', '٢', '٣', '٤'][o.k + 1]} من ٤`, title: s.name, body: s.opts[kk][1], color: s.c });
      ctx.ui.hud(lockedN < 4 ? `ثبّتّ ${['', '١', '٢', '٣'][lockedN]} من ٤ مراحل` : 'حصة متكاملة الأركان');
      setTimeout(() => { drawScreen(); sparkT = 0; sparkFrom.set(0, o.outer.position.y + RH / 2, A); sparkTo.set(0, topY + 0.2, 0.05); ctx.fx.burst(g.position.clone().add(new THREE.Vector3(0, o.outer.position.y + 0.05, 0.2)), s.c, 20, 0.3, 0.03); padE = Math.min(1, 0.15 + lockedN * 0.22); }, 600);
      if (lockedN === 4 && !finished) { finished = true; setTimeout(() => { ctx.fx.burst(g.position.clone().add(new THREE.Vector3(0, topY + 0.25, 0.05)), 0xffd27a, 56, 0.6, 0.04); ctx.sfx.good?.(); ctx.ui.done(); }, 1700); }
    } else {
      o.shake = 0; ctx.sfx.bad?.(); o.panels[kk].state = 1; o.draw(o.panels[kk], 1);
      setTimeout(() => { if (!o.locked) o.draw(o.panels[kk], 0); }, 1500);
      ctx.ui.card({ tag: 'ليس الأنسب', title: s.opts[kk][0], body: s.opts[kk][1], color: 0xe0603f });
    }
  }

  return {
    update(t, dt, e) {
      now = t; rise.update(t, e); hal.update(t, e); mo.update(t, dt, e);
      const cap = stag(t, 1.4, 1) * e;
      padE = Math.max(padE, 0.15); padGlow.material.opacity = cap * (0.12 + padE * 0.35 + 0.05 * Math.sin(t * 2.4));
      pad.position.y = topY + 0.2 + 0.01 * Math.sin(t * 1.5);
      for (const o of rings) {
        const target = -o.n * (TAU / 3); o.rot = THREE.MathUtils.damp(o.rot, target, 7, dt);
        o.pivot.rotation.y = o.rot + shakeX(o.shake, 0.06) + (o.locked ? 0 : 0.06 * Math.sin(t * 1.2 + o.k) * stag(t, 3, 1));
        if (o.shake < 90) o.shake += dt;
        o.bump = Math.max(0, o.bump - dt * 2); o.outer.position.y = Y0 + o.k * GAP + Math.sin(o.bump * Math.PI) * 0.025;
        o.hl.on = o.locked ? 0 : (stag(t, 3.4, 1) > 0 ? 0.55 : 0);
      }
      if (sparkT < 1.2) {
        sparkT += dt; const p = clamp01(sparkT / 0.8); spark.position.lerpVectors(sparkFrom, sparkTo, ease(p)); spark.position.z += Math.sin(Math.PI * p) * 0.12; spark2.position.copy(spark.position);
        const f = p < 1 ? 1 : 1 - (sparkT - 0.8) / 0.4; spark.material.opacity = clamp01(f); spark2.material.opacity = clamp01(f) * 0.7;
      } else { spark.material.opacity = 0; spark2.material.opacity = 0; }
    },
  };
}
