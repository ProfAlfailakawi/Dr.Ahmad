// p363: the blog as a six-sided jewel cube. Touch it and it tumbles to a new face; or touch one of the six glyph coins around its base to roll that face to you.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { P, ease, easeBack, clamp01, stag, mat, glossy, goldMat, shadowed, glow } from '../../kit.js?v=19';
import { inked } from '../../pencil.js?v=19';
import { TAU, css, rising, halos, motes, blob, dais, canvasTex, glyph, paintWrap, roundRect, faceMat } from '../lib/b6-kit.js?v=19';

export const meta = { free: true, center: [0.5, 0.56], typeLabel: 'مجسّم تفاعلي', title: 'تشريح التدوين' };

const FACES = [
  { t: 'مدونات الأشخاص', gl: 'person', c: 0x2fae96, body: 'يكتبها أشخاص بصفتهم الشخصية للمتعة فقط، وهي أحد أنواع المدونات الثلاثة.' },
  { t: 'المدونات التحريرية', gl: 'pen', c: 0xe9645f, body: 'يقوم محررون محترفون بكتابتها وتحريرها، فتخضع لمعايير أعلى من المدونات الشخصية.' },
  { t: 'مدونات المؤسسات', gl: 'building', c: 0x3a74d8, body: 'تخصّ المؤسسات والمدارس والشركات، وتتواصل بها مع القرّاء بالأحداث والأخبار المتعلقة بها.' },
  { t: 'التدوين بالفيديو', gl: 'play', c: 0xef9a1f, body: 'للبلوق صور غير النص: بالفيديو والصور والصوت، وهناك التدوين بمشاركات قصيرة.' },
  { t: 'حفظ وأرشفة', gl: 'archive', c: 0x7a62d6, body: 'يتيح للمعلم كتابة مواضيع المقرر ومفرداته، وللمتعلمين إضافة تعليقات، مع حفظ المحتويات وأرشفتها وتصنيفها.' },
  { t: 'من أي مكان', gl: 'globe', c: 0x2c9a63, body: 'يمكن استخدام خدمات التدوين من أي مكان تتوافر فيه شبكة الإنترنت، وبعضها عبر رسائل الهاتف المحمول.' },
];
// cube side that faces the viewer for face k -> Euler that brings it to the front (+z)
const SIDE = [
  { pos: [0, 0, 1], rot: [0, 0, 0], front: [0, 0, 0] },
  { pos: [1, 0, 0], rot: [0, Math.PI / 2, 0], front: [0, -Math.PI / 2, 0] },
  { pos: [-1, 0, 0], rot: [0, -Math.PI / 2, 0], front: [0, Math.PI / 2, 0] },
  { pos: [0, 1, 0], rot: [-Math.PI / 2, 0, 0], front: [Math.PI / 2, 0, 0] },
  { pos: [0, 0, -1], rot: [0, Math.PI, 0], front: [0, Math.PI, 0] },
  { pos: [0, -1, 0], rot: [Math.PI / 2, 0, 0], front: [-Math.PI / 2, 0, 0] },
];
const S = 0.31;

export default function build(ctx) {
  const g = new THREE.Group(); g.position.copy(P(meta.center[0], meta.center[1])); g.scale.setScalar(1.08); ctx.stage.add(g);
  const rise = rising(), hal = halos();
  g.add(blob(0.5, 0.3));
  const mo = motes(g, 26, { r: 0.4, h: 0.8, color: 0xcfeee6 });

  const dz = dais(0.36, { top: 0xf6f0e2, h: 0.03 }); g.add(dz); rise.add(dz, 0, 0.05, 0.6);

  // ---------- the cube
  const lift = new THREE.Group(); lift.position.y = 0.36; g.add(lift);
  const tiltG = new THREE.Group(); tiltG.rotation.x = -0.3; lift.add(tiltG);
  const cube = new THREE.Group(); tiltG.add(cube);
  const body = inked(new RoundedBoxGeometry(S, S, S, 5, 0.035), { color: 0x2b3a55 }); cube.add(body);
  const core = new THREE.Mesh(new RoundedBoxGeometry(S - 0.004, S - 0.004, S - 0.004, 5, 0.034), glossy(0x24324d, { clearcoat: 0.6 })); cube.add(core);
  const faces = FACES.map((f, k) => {
    const cv = document.createElement('canvas'); cv.width = cv.height = 512; const gg = cv.getContext('2d');
    const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
    const draw = (lit) => {
      const c = css(f.c); gg.clearRect(0, 0, 512, 512);
      const gr = gg.createLinearGradient(0, 0, 0, 512); gr.addColorStop(0, '#fffaf0'); gr.addColorStop(1, '#f3ead8'); gg.fillStyle = gr; roundRect(gg, 0, 0, 512, 512, 60); gg.fill();
      gg.fillStyle = c; gg.beginPath(); gg.arc(256, 200, 150, 0, TAU); gg.fill();
      gg.fillStyle = 'rgba(255,255,255,.18)'; gg.beginPath(); gg.arc(206, 150, 90, 0, TAU); gg.fill();
      glyph(gg, f.gl, 256, 200, 200, '#ffffff', c);
      gg.fillStyle = c; roundRect(gg, 46, 372, 420, 102, 40); gg.fill();
      paintWrap(gg, f.t, 256, 424, 390, 62, '#ffffff', 900, 1.2, 1);
      tex.needsUpdate = true;
    };
    draw(false);
    const pl = new THREE.Mesh(new THREE.PlaneGeometry(S - 0.02, S - 0.02), faceMat(tex));
    const sd = SIDE[k]; pl.position.set(sd.pos[0] * (S / 2 + 0.0015), sd.pos[1] * (S / 2 + 0.0015), sd.pos[2] * (S / 2 + 0.0015)); pl.rotation.set(...sd.rot); cube.add(pl);
    return { f, pl };
  });
  shadowed(cube); rise.add(lift, 0.5, 0.2, 0.9);
  const cubeGlow = glow(0xfff0c8, 0.9, 0); cubeGlow.position.y = 0.36; g.add(cubeGlow);
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.05, 0.12, 24), goldMat()); post.position.y = 0.09; g.add(post); shadowed(post); rise.add(post, 0.3, 0.05, 0.6);

  // ---------- coins around the base
  const orbit = new THREE.Group(); g.add(orbit);
  const coins = FACES.map((f, k) => {
    const a = -k * (TAU / 6) + 0.0;
    const outer = new THREE.Group(); outer.position.set(Math.sin(a) * 0.29, 0.09, Math.cos(a) * 0.29); outer.rotation.y = a; orbit.add(outer);
    const inner = new THREE.Group(); inner.rotation.x = -0.35; outer.add(inner);
    const rimm = new THREE.Mesh(new THREE.CylinderGeometry(0.062, 0.062, 0.016, 32), goldMat()); rimm.rotation.x = Math.PI / 2; inner.add(rimm);
    const cv = document.createElement('canvas'); cv.width = cv.height = 192; const gg = cv.getContext('2d');
    const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
    const draw = (lit) => { gg.clearRect(0, 0, 192, 192); gg.fillStyle = lit ? css(f.c) : '#fbf7ec'; gg.beginPath(); gg.arc(96, 96, 94, 0, TAU); gg.fill(); glyph(gg, f.gl, 96, 96, 108, lit ? '#ffffff' : css(f.c), lit ? css(f.c) : '#fbf7ec'); tex.needsUpdate = true; };
    draw(false);
    const face = new THREE.Mesh(new THREE.CircleGeometry(0.055, 32), faceMat(tex)); face.position.z = 0.0086; inner.add(face);
    const face2 = face.clone(); face2.position.z = -0.0086; face2.rotation.y = Math.PI; inner.add(face2);
    shadowed(inner);
    const hl = hal.add(inner, f.c, 0.22, [0, 0, 0.02], 9999); hl.on = 0;
    const o = { k, f, outer, inner, draw, hl, seen: false, bump: 0, ph: k * 1.2 };
    rise.add(outer, 1.0 + k * 0.12, 0.15, 0.6);
    ctx.tap(outer, () => roll(k));
    return o;
  });
  ctx.tap(cube, () => { // next unseen face (or simply the next one)
    let k = (cur + 1) % 6; for (let i = 1; i <= 6; i++) { const c = (cur + i) % 6; if (!coins[c].seen) { k = c; break; } } roll(k);
  });

  let cur = 0, now = 0, rolling = 0, rollT = 0, seenN = 0, finished = false, kick = 0;
  const sw = new THREE.Quaternion(), eu2 = new THREE.Euler(), q0 = new THREE.Quaternion(), q1 = new THREE.Quaternion(), qa = new THREE.Quaternion(), eu = new THREE.Euler();
  ctx.ui.hud('المس المكعب ليدور');

  function roll(k) {
    if (now < 3.4 || rolling) return;
    q0.copy(cube.quaternion); eu.set(...SIDE[k].front); q1.setFromEuler(eu);
    rolling = 1; rollT = 0; cur = k; ctx.sfx.whoosh?.(); ctx.sfx.pop?.();
    const c = coins[k]; c.bump = 1;
    if (!c.seen) { c.seen = true; seenN++; c.draw(true); c.hl.on = 0.7; }
    ctx.ui.card({ tag: ['نوع ١ من ٣', 'نوع ٢ من ٣', 'نوع ٣ من ٣', 'صورة للتدوين', 'ميزة', 'ميزة'][k], title: FACES[k].t, body: FACES[k].body, color: FACES[k].c });
    ctx.ui.hud(seenN < 6 ? `اكتشفت ${['', '١', '٢', '٣', '٤', '٥'][seenN]} من ٦ وجوه` : 'تدوينٌ بوجوه كثيرة');
    if (seenN === 6 && !finished) { finished = true; setTimeout(() => { ctx.fx.burst(g.position.clone().add(new THREE.Vector3(0, 0.4, 0)), 0xffd27a, 54, 0.6, 0.04); ctx.sfx.good?.(); ctx.ui.done(); }, 1300); }
  }

  return {
    update(t, dt, e) {
      now = t; rise.update(t, e); hal.update(t, e); mo.update(t, dt, e);
      kick = Math.max(0, kick - dt * 2);
      if (rolling) {
        rollT += dt / 0.9; const p = clamp01(rollT);
        qa.slerpQuaternions(q0, q1, ease(p)); cube.quaternion.copy(qa);
        lift.position.y = 0.36 + Math.sin(Math.PI * p) * 0.1;
        const sq = p > 0.88 ? 1 - 0.07 * Math.sin((p - 0.88) / 0.12 * Math.PI) : 1; cube.scale.set(1 + (1 - sq) * 0.6, sq, 1 + (1 - sq) * 0.6);
        if (p >= 1) { rolling = 0; cube.scale.set(1, 1, 1); ctx.fx.burst(g.position.clone().add(new THREE.Vector3(0, 0.36, 0.1)), FACES[cur].c, 14, 0.25, 0.026); }
      } else {
        cube.quaternion.setFromEuler(eu.set(SIDE[cur].front[0], SIDE[cur].front[1], SIDE[cur].front[2]));
        // idle sway layered on top
        sw.setFromEuler(eu2.set(0.04 * Math.sin(t * 0.9), 0.1 * Math.sin(t * 0.6), 0));
        cube.quaternion.premultiply(sw);
        lift.position.y = 0.36 + 0.012 * Math.sin(t * 1.4);
      }
      cubeGlow.material.opacity = stag(t, 0.6, 1) * e * (0.32 + 0.08 * Math.sin(t * 2));
            orbit.rotation.y += dt * 0.12 * stag(t, 1.4, 1.2);
      for (const c of coins) {
        c.bump = Math.max(0, c.bump - dt * 2);
        c.inner.position.y = 0.012 * Math.sin(t * 1.6 + c.ph) + 0.03 * Math.sin(c.bump * Math.PI);
        c.inner.scale.setScalar(1 + 0.25 * Math.sin(c.bump * Math.PI));
        c.hl.on = c.seen ? 0.5 : (stag(t, 3, 1) > 0 ? 0.55 : 0);
      }
    },
  };
}
