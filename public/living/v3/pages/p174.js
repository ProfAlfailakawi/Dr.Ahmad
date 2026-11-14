// p174 — the Gerlach & Ely model as a lacquer-red board: a golden marble walks the path, feedback returns to the goals.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { P, ease, easeBack, clamp01, stag, mat, glossy, goldMat, shadowed, lightTube, PAGE_H } from '../../kit.js?v=36';
import { tagSprite, setSpr, softLight } from '../../v2/common.js?v=36';
import { inked } from '../../pencil.js?v=36';
import { hints, slabText, finder, blobShadow } from '../lib/a3-kit.js?v=36';

export const meta = { free: true, center: [0.5, 0.49], typeLabel: 'مسار ضوئي' };

const RED = 0xb8142a, GOLD = 0xd4ad55;
const NODES = [
  { id: 'a', t: 'تحديد المحتوى', x: 0.285, z: -0.075, w: 0.17, d: 0.075, card: ['خطوة أولى', 'تحديد المحتوى', 'خطوة متداخلة مع تحديد الأهداف، وقد تسبق إحداهما الأخرى.'] },
  { id: 'b', t: 'تحديد الأهداف', x: 0.285, z: 0.06, w: 0.17, d: 0.075, card: ['خطوة أولى', 'تحديد الأهداف', 'وصف الأهداف مع تحديد المادة العلمية. وإليها تعود نتائج التغذية الراجعة.'] },
  { id: 'c', t: 'قياس السلوك', x: 0.1, z: -0.006, w: 0.15, d: 0.085, card: ['خطوة ثانية', 'قياس السلوك الداخلي', 'تقدير مبدئي لسلوك المتعلم، خطوة تقليدية لها دور كبير في تحديد الخطوات القادمة.'] },
  { id: 's1', t: '', x: -0.115, z: -0.15, w: 0.17, d: 0.052, card: ['خطوة ثالثة', 'تحديد استراتيجية التدريس', 'أولى خمس خطوات متداخلة مكملة لبعضها.'] },
  { id: 's2', t: '', x: -0.115, z: -0.082, w: 0.17, d: 0.052, card: ['خطوة ثالثة', 'تنظيم المجموعات للتعلم', 'تُحدَّد معها الزمان والمكان ومصادر التعلم.'] },
  { id: 's3', t: '', x: -0.115, z: -0.014, w: 0.17, d: 0.052, card: ['خطوة ثالثة', 'تحديد وتوزيع الوقت', 'إلى جانب تحديد المكان واختيار المصادر التعليمية.'] },
  { id: 's4', t: '', x: -0.115, z: 0.054, w: 0.17, d: 0.052, card: ['خطوة ثالثة', 'تحديد المكان', 'من الخطوات الخمس المتداخلة المكملة لبعضها.'] },
  { id: 's5', t: '', x: -0.115, z: 0.122, w: 0.17, d: 0.052, card: ['خطوة ثالثة', 'اختيار المصادر التعليمية', 'آخر الخطوات الخمس المتداخلة، تُختار مع تحديد الزمان والمكان.'] },
  { id: 'g', t: 'تقويم الأداء', x: -0.31, z: -0.014, w: 0.13, d: 0.085, card: ['خطوة رابعة', 'تقويم أداء المتعلمين', 'يقوّم المعلم الأداء، فهو المنظّم والموجّه والمرشد وليس مجرد ناقل.'] },
  { id: 'h', t: 'التغذية الراجعة', x: -0.31, z: 0.15, w: 0.13, d: 0.085, card: ['حلقة العودة', 'تحليل التغذية الراجعة', 'تعود نتائجه إلى الأهداف فتُعدَّل الخطة.'] },
];
const ROUTE = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]; // marble order; loops from index 1 (goals)

export default function build(ctx) {
  const g = new THREE.Group(); g.position.copy(P(0.5, 0.49)); ctx.stage.add(g);
  const H = hints(), found = finder(ctx, 8);

  const topY = 0.03; // blocks float lightly above the print

  // blocks
  const blocks = NODES.map((n, i) => {
    const h = n.id[0] === 's' ? 0.04 + (i % 2) * 0.014 : 0.066;
    const grp = new THREE.Group(); grp.position.set(n.x, topY, n.z);
    const sh = blobShadow(n.w * 1.5, n.d * 1.9, 0.32); sh.position.set(n.x, 0.003, n.z + 0.01); g.add(sh);
    const ink = inked(new RoundedBoxGeometry(n.w, h, n.d, 4, 0.014), { material: glossy(RED, { emissive: 0x6a0010, emissiveIntensity: 0.12 }), hullScale: 1.035, width: 1.6 });
    ink.position.y = h / 2; grp.add(ink);
    const body = ink.userData.fill;
    body.material = ink.userData.fillMat;
    const lip = new THREE.Mesh(new RoundedBoxGeometry(n.w * 0.97, 0.004, n.d * 0.95, 2, 0.002), goldMat()); lip.position.y = h * 0.62; grp.add(lip);
    if (n.t) { const tx = slabText(n.t, n.w * 0.86, n.d * 0.6, { size: n.t.length > 10 ? 0.42 : 0.52 }); tx.position.y = h + 0.0045; tx.renderOrder = 5; grp.add(tx); }
    else { const dot = slabText(['١', '٢', '٣', '٤', '٥'][i - 3], 0.05, 0.04, { size: 0.85 }); dot.position.set(-n.w * 0.32, h + 0.0045, 0); grp.add(dot); }
    shadowed(grp); g.add(grp);
    ctx.tap(grp, () => pick(i));
    const hint = H.add(grp, 0xff8a7a, n.w * 1.5, [0, h + 0.012, 0], 4.2 + i * 0.12);
    return { n, grp, ink, body, h, hint, sh, lit: 0, lift: 0, liftTo: 0, born: 0.15 + i * 0.12 };
  });

  // golden rivets between the five stacked blocks: they interlock
  const rivets = [];
  for (let i = 1; i < 5; i++) {
    const a = blocks[2 + i], b = blocks[3 + i];
    const r = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.03, 12), goldMat());
    r.position.set(-0.115 + (i % 2 ? 0.05 : -0.05), topY + 0.03, (a.n.z + b.n.z) / 2); g.add(r); rivets.push(r);
  }

  // light paths
  const Y = topY + 0.045;
  const path = (pts, color = GOLD) => {
    const cp = new THREE.CurvePath();
    for (let i = 0; i < pts.length - 1; i++) cp.add(new THREE.LineCurve3(new THREE.Vector3(pts[i][0], Y, pts[i][1]), new THREE.Vector3(pts[i + 1][0], Y, pts[i + 1][1])));
    const t = lightTube(cp, { radius: 0.008, color, speed: 0.6 }); g.add(t); return t;
  };
  const tubes = [
    path([[0.285, -0.036], [0.285, 0.022]]),
    path([[0.2, -0.075], [0.182, -0.075], [0.182, -0.006], [0.178, -0.006]]),
    path([[0.2, 0.06], [0.182, 0.06], [0.182, -0.006]]),
    path([[0.025, -0.006], [-0.03, -0.006]]),
    path([[-0.2, -0.014], [-0.243, -0.014]]),
    path([[-0.31, 0.03], [-0.31, 0.106]]),
  ];
  const arcC = new THREE.CatmullRomCurve3([[-0.245, 0.15, 0.04], [-0.17, 0.15, 0.1], [0.0, 0.15, 0.135], [0.2, 0.15, 0.1], [0.285, 0.11, 0.05]].map(([x, z, y]) => new THREE.Vector3(x, y + topY, z)));
  const arcT = lightTube(arcC, { radius: 0.008, color: GOLD, speed: 0.6 }); g.add(arcT); tubes.push(arcT);
  tubes.forEach((t) => t.userData.fill(0));
  // arrow heads
  const heads = [[0.178, -0.006, -Math.PI / 2], [-0.03, -0.006, -Math.PI / 2], [-0.243, -0.014, -Math.PI / 2], [-0.31, 0.106, 0], [0.285, 0.1, Math.PI]].map(([x, z, yaw]) => {
    const c = new THREE.Mesh(new THREE.ConeGeometry(0.011, 0.026, 14), goldMat());
    c.rotation.x = Math.PI / 2; const w = new THREE.Group(); w.add(c);
    w.position.set(x, Y, z); w.rotation.y = yaw; g.add(w); return w;
  });

  // the marble
  const marble = new THREE.Mesh(new THREE.SphereGeometry(0.02, 28, 20), glossy(0xf1c25a, { metalness: 0.7, roughness: 0.18, emissive: 0xffb300, emissiveIntensity: 0.35 }));
  marble.castShadow = true; g.add(marble);
  const mglow = softLightLike(); marble.add(mglow);
  const tag = tagSprite('٥ خطوات متداخلة', 0.2, GOLD); tag.position.set(-0.115, 0.14, -0.2); g.add(tag);

  let seq = 0, from = new THREE.Vector3(), to = new THREE.Vector3(), p = 1, hold = 0, last = -1, jumpIdx = -1;
  const posOf = (i, out) => out.set(NODES[i].x, topY + blocks[i].h + 0.03, NODES[i].z);
  posOf(0, from); posOf(0, to);

  function hopTo(i) {
    from.copy(marble.position); posOf(i, to); p = 0; hold = 0; last = i;
    const b = blocks[i]; b.arrive = true;
  }
  function pick(i) {
    const b = blocks[i];
    b.liftTo = 1; b.pulse = 0;
    seq = ROUTE.indexOf(i); jumpIdx = i; hopTo(i);
    ctx.sfx.pop?.();
    ctx.fx.burst(new THREE.Vector3(b.n.x, 0.1, b.n.z).add(g.position), 0xffc86a, 18, 0.35, 0.03);
    const [tg, ti, bo] = b.n.card;
    ctx.ui.card({ tag: tg, title: ti, body: bo, color: RED });
    b.hint.calm = true;
    const k = found(i);
    ctx.ui.hud(k < 8 ? 'المس الصناديق لتتبع المسار' : 'المسار كاملاً، والعودة إلى الأهداف');
  }
  ctx.ui.hud('اتبع الكرة الذهبية في مسار النموذج');

  const tmp = new THREE.Vector3();
  return {
    update(t, dt, e) {
      blocks.forEach((b) => {
        const k = stag(t, b.born, 0.8, easeBack) * e;
        b.grp.scale.setScalar(Math.max(k, 0.001)); b.ink.userData.reveal(clamp01((t - b.born) / 1.1) * e); b.sh.material.opacity = 0.32 * clamp01(k);
        b.lift += (b.liftTo - b.lift) * Math.min(1, dt * 8);
        if (b.liftTo === 1 && b.lift > 0.97) b.liftTo = 0;
        b.grp.position.y = topY + b.lift * 0.03 + Math.sin(t * 1.3 + b.born * 7) * 0.003;
        b.lit = Math.max(0, b.lit - dt * 1.4);
        b.ink.userData.fillMat.emissiveIntensity = 0.12 + b.lit * 0.9;
      });
      rivets.forEach((r, i) => r.scale.setScalar(Math.max(stag(t, 1.9 + i * 0.1, 0.5) * e, 0.001)));
      tubes.forEach((tb, i) => { tb.userData.fill(stag(t, 1.4 + i * 0.22, 0.9, ease)); tb.userData.update(dt); tb.visible = e > 0.02; });
      heads.forEach((h, i) => h.scale.setScalar(Math.max(stag(t, 3.4 + i * 0.2, 0.5, easeBack) * e, 0.001)));
      const mk = stag(t, 3.4, 0.6, easeBack) * e;
      marble.scale.setScalar(Math.max(mk, 0.001));
      if (t > 2.4) {
        if (p < 1) {
          p = Math.min(1, p + dt / 0.75);
          const q = ease(p);
          marble.position.lerpVectors(from, to, q); marble.position.y += Math.sin(p * Math.PI) * 0.05;
          if (p >= 1) { blocks[last].lit = 1; hold = 0.45; }
        } else {
          hold -= dt;
          if (hold <= 0) {
            seq += 1; if (seq >= ROUTE.length) seq = 1;
            hopTo(ROUTE[seq]);
          }
          marble.position.copy(to); marble.position.y += Math.sin(t * 5) * 0.003;
        }
      } else { posOf(0, tmp); marble.position.copy(tmp); }
      marble.rotation.y += dt * 3;
      tag.visible = t > 2.4; setSpr(tag, 0.2, clamp01((t - 2.4) * 1.4) * e);
      H.update(t, e);
    },
  };
}

function softLightLike() { const s = softLight(0xffc24a, 0.14, 0.55); s.renderOrder = 7; return s; }
