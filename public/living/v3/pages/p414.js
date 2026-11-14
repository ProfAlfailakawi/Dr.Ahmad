import * as THREE from 'three';
import { mat, glossy, goldMat, shadowed, glow, stag, ease, easeBack, clamp01 } from '../../kit.js?v=39';
import { scene, RoundedBox, TAU, contactShadow, lightPool } from '../lib/a8-kit.js?v=39';
export const meta = { free: true, center: [0.57, 0.31], typeLabel: 'مجسّم تفاعلي' };

const GL = (c, i = 1) => new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: i, roughness: 0.3 });
const K = [
  { n: 'حقيقية', t: 'المعرفة الحقيقية', c: 0xe0527f, body: 'تضمنت تعريفات المفردات ومعلومات حول تفاصيل خاصة.' },
  { n: 'مفهومية', t: 'المعرفة المفهومية', c: 0x3b8fe0, body: 'تضمنت أنظمة المعلومات مثل التصنيفات والفئات.' },
  { n: 'إجرائية', t: 'المعرفة الإجرائية', c: 0x7ac143, body: 'تضمنت الخوارزميات والمناهج التجريبية وقواعد التقريب والأساليب والوسائل، ومعلومات حول وقت استخدام هذه الإجراءات.' },
  { n: 'ما وراء المعرفة', t: 'معرفة ما وراء المعرفة', c: 0xf29a2e, body: 'تضمنت المعارف المتعلقة بعمليات التفكير، ومعلومات حول كيفية التحكم في هذه العمليات بفعالية.' },
];
// head profile, face to the left (unit box, y up)
const PROF = [[0.46, 0.0], [0.46, 0.13], [0.40, 0.19], [0.27, 0.205], [0.19, 0.27], [0.155, 0.345], [0.175, 0.385], [0.15, 0.42], [0.17, 0.455], [0.075, 0.51], [0.11, 0.55], [0.175, 0.635], [0.165, 0.71], [0.2, 0.8], [0.27, 0.91], [0.4, 0.98], [0.55, 1.0], [0.7, 0.94], [0.8, 0.8], [0.84, 0.62], [0.8, 0.44], [0.7, 0.3], [0.62, 0.18], [0.62, 0.0]];
const HS = 0.5; // head height in scene units

export default function build(ctx) {
  const S = scene(ctx, meta), g = S.g;
  const shd = contactShadow(0.5, 0.26, 0.4); shd.position.y = 0.0015; g.add(shd);
  const pool = lightPool(0xf29a2e, 0.3, 0.0); pool.position.y = 0.002; g.add(pool);
  const col = new THREE.Mesh(new RoundedBox(0.14, 0.05, 0.1, 0.02), glossy(0x7a4f32, { roughness: 0.3, clearcoat: 0.6 })); col.position.y = 0.025; g.add(shadowed(col)); S.part(col, 0.1, { rise: 0.05 });
  const colr = new THREE.Mesh(new RoundedBox(0.146, 0.006, 0.106, 0.02), goldMat()); colr.position.y = 0.05; g.add(colr);
  const head = new THREE.Group(); head.position.set(0.0, 0.056, 0); head.scale.setScalar(1.2); g.add(head);
  const curve = new THREE.CatmullRomCurve3(PROF.map(([x, y]) => new THREE.Vector3((x - 0.46) * HS, y * HS, 0)), true, 'catmullrom', 0.4);
  const poly = curve.getPoints(160).map((p) => new THREE.Vector2(p.x, p.y));
  // inward offset for the frame's hole
  let area = 0; poly.forEach((p, i) => { const q = poly[(i + 1) % poly.length]; area += p.x * q.y - q.x * p.y; }); const sgn = area > 0 ? 1 : -1;
  const off = (d) => poly.map((p, i) => { const a = poly[(i + poly.length - 1) % poly.length], b = poly[(i + 1) % poly.length]; const tx = b.x - a.x, ty = b.y - a.y, L = Math.hypot(tx, ty) || 1; return new THREE.Vector2(p.x + (-ty / L) * d * -sgn * -1 * -1 * 1, p.y + (tx / L) * d * -sgn * -1 * -1 * 1); });
  const inner = off(-0.016 * sgn * sgn);
  // decide the correct offset direction by checking one point is inside
  const inside = (pt, pl) => { let c = false; for (let i = 0, j = pl.length - 1; i < pl.length; j = i++) { const a = pl[i], b = pl[j]; if ((a.y > pt.y) !== (b.y > pt.y) && pt.x < ((b.x - a.x) * (pt.y - a.y)) / (b.y - a.y) + a.x) c = !c; } return c; };
  let hole = off(0.016); if (!inside(hole[40], poly)) hole = off(-0.016);
  const shapeOuter = new THREE.Shape(poly); const holePath = new THREE.Path(hole.slice().reverse()); shapeOuter.holes.push(holePath);
  const wood = glossy(0xc08a52, { roughness: 0.35, clearcoat: 0.5 });
  const frame = new THREE.Mesh(new THREE.ExtrudeGeometry(shapeOuter, { depth: 0.11, bevelEnabled: true, bevelThickness: 0.004, bevelSize: 0.004, bevelSegments: 2, curveSegments: 1 }), wood); frame.position.z = -0.055; head.add(frame);
  const back = new THREE.Mesh(new THREE.ExtrudeGeometry(new THREE.Shape(hole), { depth: 0.01, bevelEnabled: false }), mat(0x5a3d28)); back.position.z = -0.05; head.add(back);
  shadowed(head); S.part(frame, 0.15, { rise: 0.04 }); S.part(back, 0.15, { rise: 0.04 });

  // ---- shelves and books, row by row
  const rows = [], ROW = 0.054, rnd = (() => { let s = 7; return () => (s = (s * 16807) % 2147483647) / 2147483647; })();
  const palette = [0xf3ead6, 0xe9d9b8, 0xa9573b, 0x7a4a32, 0xc9a26a, 0x6d7f92, 0xd9d2c4, 0x3f4d5e, 0xb8764a, 0xe8c9a0];
  const dummy = new THREE.Object3D();
  const xsAt = (y) => { const xs = []; for (let i = 0; i < poly.length; i++) { const a = poly[i], b = poly[(i + 1) % poly.length]; if ((a.y <= y) !== (b.y <= y)) xs.push(a.x + ((y - a.y) / (b.y - a.y)) * (b.x - a.x)); } return xs.sort((p, q) => p - q); };
  const nRows = Math.floor((HS * 0.97) / ROW);
  for (let r = 0; r < nRows; r++) {
    const y0 = 0.022 + r * ROW, xs = xsAt(y0 + ROW * 0.5 + 0.004), books = [];
    for (let k = 0; k + 1 < xs.length; k += 2) {
      let x = xs[k] + 0.014; const xe = xs[k + 1] - 0.014;
      while (x < xe - 0.006) { const w = 0.007 + rnd() * 0.009; if (x + w > xe) break; books.push({ x: x + w / 2, w, h: 0.026 + rnd() * 0.02, c: palette[Math.floor(rnd() * palette.length)], tilt: rnd() < 0.05 ? 0.25 : 0 }); x += w + 0.0012; if (rnd() < 0.06) x += 0.016 + rnd() * 0.02; }
    }
    if (!books.length) continue;
    const grp = new THREE.Group(); grp.position.set(0, y0 + 0.058, 0); head.add(grp);
    const board = new THREE.Mesh(new THREE.BoxGeometry(Math.max(0.05, xs[xs.length - 1] - xs[0] - 0.01), 0.004, 0.09), mat(0x8a5a38)); board.position.set((xs[0] + xs[xs.length - 1]) / 2, -0.002, 0); grp.add(board);
    const im = new THREE.InstancedMesh(new RoundedBox(1, 1, 1, 0.12), new THREE.MeshStandardMaterial({ roughness: 0.6 }), books.length);
    books.forEach((b, i) => { dummy.position.set(b.x, b.h / 2 + 0.002, 0.0); dummy.scale.set(b.w, b.h, 0.07 - rnd() * 0.012); dummy.rotation.set(0, 0, b.tilt); dummy.updateMatrix(); im.setMatrixAt(i, dummy.matrix); im.setColorAt(i, new THREE.Color(b.c)); });
    im.instanceColor.needsUpdate = true; grp.add(im);
    grp.position.x = 0; S.part(grp, 0.4 + r * 0.16, { rise: 0.05 }); rows.push(grp);
  }
  // ---- four lit objects set in the shelves
  const world = (px, py) => new THREE.Vector3((px - 0.46) * HS, py * HS + 0.0, 0.07);
  const objs = [];
  const mk = (i) => {
    const grp = new THREE.Group(), c = K[i].c;
    if (i === 0) { // dictionary stack
      [[0.07, 0.016, 0.05, 0x7a4a32, 0], [0.065, 0.014, 0.048, c, 0.15], [0.06, 0.013, 0.044, 0xf3ead6, -0.1]].forEach(([w, h, d, col, r], k) => { const b = new THREE.Mesh(new RoundedBox(w, h, d, 0.004), glossy(col)); b.position.y = 0.008 + k * 0.016; b.rotation.y = r; grp.add(b); });
      const lab = new THREE.Mesh(new THREE.PlaneGeometry(0.03, 0.006), GL(0xffe3a0, 0.8)); lab.position.set(0, 0.024, 0.025); grp.add(lab);
    } else if (i === 1) { // a grid of sorted boxes
      for (let a = 0; a < 2; a++) for (let b = 0; b < 2; b++) { const bx = new THREE.Mesh(new RoundedBox(0.032, 0.026, 0.04, 0.005), GL([0x3b8fe0, 0x6f5bd6, 0x2fbf8a, 0xf0a32e][a * 2 + b], 0.55)); bx.position.set(-0.019 + a * 0.038, 0.013 + b * 0.03, 0); grp.add(bx); }
    } else if (i === 2) { // two gears
      const gear = (r, n, col) => { const sh = new THREE.Shape(); for (let k = 0; k < n * 2; k++) { const a = (k / (n * 2)) * TAU, rr = k % 2 ? r * 0.8 : r; sh.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); if (k === 0) { sh.moveTo(Math.cos(a) * rr, Math.sin(a) * rr); } } sh.closePath(); const m = new THREE.Mesh(new THREE.ExtrudeGeometry(sh, { depth: 0.012, bevelEnabled: false }), GL(col, 0.55)); return m; };
      const g1 = gear(0.03, 8, c); g1.position.set(-0.022, 0.03, 0); const g2 = gear(0.021, 6, 0xffe3a0); g2.position.set(0.03, 0.045, 0); grp.add(g1, g2); grp.userData = { g1, g2 };
    } else { // an eye with a loop
      const iris = new THREE.Mesh(new THREE.SphereGeometry(0.018, 20, 14), GL(c, 0.9)); iris.position.y = 0.032; grp.add(iris);
      const pup = new THREE.Mesh(new THREE.SphereGeometry(0.008, 12, 8), mat(0x2b2620)); pup.position.set(0, 0.032, 0.014); grp.add(pup);
      const lid = new THREE.Mesh(new THREE.TorusGeometry(0.036, 0.0035, 8, 40), goldMat()); lid.position.y = 0.032; grp.add(lid);
      const loop = new THREE.Mesh(new THREE.TorusGeometry(0.046, 0.0025, 8, 50, Math.PI * 1.5), GL(0xffe3a0, 1)); loop.position.y = 0.032; grp.add(loop); grp.userData = { loop };
    }
    return shadowed(grp);
  };
  const at = [[0.4, 0.3], [0.6, 0.28], [0.52, 0.8], [0.3, 0.7]];
  K.forEach((k, i) => {
    const grp = mk(i); const w = world(at[i][0], at[i][1]); grp.position.copy(w); grp.position.z = 0.055; head.add(grp);
    grp.scale.multiplyScalar(1.15);
    const h = glow(k.c, 0.2, 0); h.position.set(0, 0.03, 0.01); grp.add(h);
    S.part(grp, 2.6 + i * 0.3, { rise: 0.05 });
    const tg = S.tag(k.n, k.c, 0.12, { ppu: 2200 }); const side = at[i][0] < 0.5 ? -1 : 1;
    tg.s.position.set(side * 0.27, 0.056 + at[i][1] * HS * 1.2 + 0.02, 0.1); tg.delay = 3.6 + i * 0.2;
    objs.push({ grp, h, i, k, lit: false, shake: -9 });
  });
  let found = 0, quiz = false, solved = false;
  objs.forEach((o) => {
    S.touch(o.grp, () => {
      S.burst(o.grp.position.clone().multiplyScalar(1.2).add(head.position), o.k.c, 24, 0.5);
      if (quiz && !solved) {
        if (o.i === 3) { solved = true; ctx.sfx.good?.(); ctx.ui.card({ tag: 'أصبت', title: 'ما وراء المعرفة', body: 'مراقبة عمليات التفكير والتحكم فيها بفعالية هي ما وراء المعرفة.', color: o.k.c }); ctx.ui.hud('عرفتَ أنواع المعرفة الأربعة'); setTimeout(() => ctx.ui.done(), 1800); }
        else { o.shake = S.now; ctx.sfx.bad?.(); ctx.ui.toast('فكّر: ماذا يراقب الطالب هنا؟'); }
        return;
      }
      ctx.sfx.good?.();
      ctx.ui.card({ tag: 'نوع من المعرفة', title: o.k.t, body: o.k.body, color: o.k.c });
      if (!o.lit) { o.lit = true; found++; o.h.material.opacity = 0.6; ctx.ui.hud(found < 4 ? `${['', 'واحد', 'اثنان', 'ثلاثة'][found]} من أربعة` : ''); }
      if (found >= 4 && !quiz) setTimeout(() => { quiz = true; ctx.ui.hud('طالب يراجع طريقة مذاكرته ويغيّرها'); ctx.ui.card({ tag: 'اختبر فهمك', title: 'أي معرفة يوظّف؟', body: 'طالب يراجع طريقته في المذاكرة بعد أن لاحظ أنها لا تناسبه، ثم يقرر تغييرها. المس نوع المعرفة.', color: 0xd4ad55 }); }, 1700);
    }, { color: K[o.i].c, size: 0.2, at: new THREE.Vector3(0, 0.03, 0.01), wake: 4.2 });
  });
  ctx.ui.hud('المس أنواع المعرفة في الرأس');

  S.loop((t, dt, e) => {
    head.rotation.y = -0.45 + Math.sin(t * 0.4) * 0.12; pool.material.opacity = 0.35 * ease((t - 0.3) / 1.0) * e;
    objs.forEach((o, i) => {
      o.grp.position.z = 0.055 + Math.sin(t * 1.6 + i) * 0.003;
      if (!o.lit) o.h.material.opacity = Math.max(o.h.material.opacity, 0) * 0 + (t > 4.2 ? 0.2 + 0.1 * Math.sin(t * 2.4 + i) : 0); else o.h.material.opacity = 0.5 + 0.15 * Math.sin(t * 2 + i);
      o.grp.rotation.z = clamp01(1 - (t - o.shake) / 0.5) * Math.sin((t - o.shake) * 55) * 0.18;
    });
    const u2 = objs[2].grp.userData; if (u2.g1) { u2.g1.rotation.z = t * 1.2; u2.g2.rotation.z = -t * 1.6; }
    const u3 = objs[3].grp.userData; if (u3.loop) u3.loop.rotation.z = -t * 2.2;
  });
  return { update: S.update };
}
