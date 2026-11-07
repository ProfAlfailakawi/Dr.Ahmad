// p359 — a QR code built of raised blocks on a yellow hexagon; light its three corner eyes, a phone scans, and the code releases what it holds.
import * as THREE from 'three';
import { P, ease, easeBack, clamp01, stag, mat, glossy, goldMat, shadowed } from '../../kit.js?v=18';
import { TAU, canvasTex, rbox, lit, rig, hints, burstAt, lightPool, tagSprite, setSpr, hexSlab } from '../lib/a7.js?v=18';

export const meta = { free: true, center: [0.38, 0.54], typeLabel: 'مجسّم تفاعلي' };

const N = 25, CELL = 0.0185, MOD = 0.0158;
const FINDERS = [[0, 0], [N - 7, 0], [0, N - 7]];   // top-left, top-right, bottom-left (col,row)
function matrix() {
  let s = 20141994; const rnd = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  const m = Array.from({ length: N }, () => new Array(N).fill(0));
  const inF = (c, r) => FINDERS.some(([fc, fr]) => c >= fc - 1 && c <= fc + 7 && r >= fr - 1 && r <= fr + 7);
  for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) if (!inF(c, r)) m[r][c] = rnd() < 0.5 ? 1 : 0;
  for (let i = 8; i < N - 8; i++) { m[6][i] = i % 2 === 0 ? 1 : 0; m[i][6] = i % 2 === 0 ? 1 : 0; }
  for (let r = 16; r < 21; r++) for (let c = 16; c < 21; c++) m[r][c] = (r === 16 || r === 20 || c === 16 || c === 20 || (r === 18 && c === 18)) ? 1 : 0;
  return { m, inF };
}

function bookMini() {
  const o = new THREE.Group();
  const cov = new THREE.Mesh(rbox(0.07, 0.012, 0.09, 0.003), glossy(0x2d6fd0)); o.add(cov);
  const pg = new THREE.Mesh(rbox(0.064, 0.009, 0.084, 0.002), mat(0xfbf7ea)); pg.position.set(0.002, 0.0, 0); pg.scale.set(1, 1, 0.97); o.add(pg);
  const top = new THREE.Mesh(rbox(0.07, 0.012, 0.09, 0.003), glossy(0x2d6fd0)); top.position.y = 0.012; o.add(top);
  const band = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.0125, 0.09), glossy(0xe8b23a)); band.position.set(-0.018, 0.012, 0); o.add(band);
  return o;
}
function badgeMini() {
  const o = new THREE.Group();
  const card = new THREE.Mesh(rbox(0.08, 0.1, 0.008, 0.008), glossy(0xfbf9f0)); o.add(card);
  const head = new THREE.Mesh(new THREE.CircleGeometry(0.017, 28), new THREE.MeshBasicMaterial({ color: 0xe8b23a, toneMapped: false })); head.position.set(0, 0.02, 0.0045); o.add(head);
  const sh = new THREE.Mesh(new THREE.CircleGeometry(0.026, 28, 0, Math.PI), new THREE.MeshBasicMaterial({ color: 0x2d6fd0, toneMapped: false })); sh.position.set(0, -0.012, 0.0045); o.add(sh);
  [].forEach((i) => { const s = new THREE.Mesh(new THREE.CircleGeometry(0.0055, 5), new THREE.MeshBasicMaterial({ color: 0xe8b23a, toneMapped: false })); s.position.set(i * 0.016, -0.035, 0.0045); o.add(s); });
  const clip = new THREE.Mesh(rbox(0.02, 0.008, 0.01, 0.003), goldMat()); clip.position.y = 0.054; o.add(clip);
  return o;
}
function certMini() {
  const o = new THREE.Group();
  const sheet = new THREE.Mesh(rbox(0.11, 0.08, 0.004, 0.002), glossy(0xfffaf0)); o.add(sheet);
  [0.004].forEach((y, i) => { const l = new THREE.Mesh(new THREE.PlaneGeometry(0.05 - i * 0.012, 0.003), new THREE.MeshBasicMaterial({ color: 0x9aa4b8, toneMapped: false })); l.position.set(-0.012, y + 0.008, 0.0028); o.add(l); });
  const seal = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.004, 24), goldMat()); seal.rotation.x = Math.PI / 2; seal.position.set(0.03, -0.016, 0.005); o.add(seal);
  return o;
}

export default function build(ctx) {
  const g = new THREE.Group(); g.position.copy(P(meta.center[0], meta.center[1])); ctx.stage.add(g); g.scale.setScalar(0.88);
  const R = rig(), H = hints(g);
  const lit3 = [false, false, false], read = new Set();
  let scanStart = -1, now = 0, finished = false;

  // ---- yellow hexagon in blue frames, a white tile on top
  const base = new THREE.Group(); g.add(base);
  base.add(hexSlab(0.38, 0.014, 0x3a5cc6, 0));
  base.add(hexSlab(0.35, 0.01, 0x5aa6e6, 0.014));
  base.add(hexSlab(0.325, 0.012, 0xf6c715, 0.024));
  const tile = new THREE.Mesh(rbox(0.5, 0.016, 0.5, 0.012), glossy(0xfbf8ee, { roughness: 0.4 })); tile.position.y = 0.044; base.add(tile);
  const sh = lightPool(0x000000, 0.52, 0.22); sh.position.y = -0.002; base.add(sh);
  R.add(base, 0.1, { dur: 0.9, rise: 0.06 });
  const TY = 0.052, X0 = -((N - 1) * CELL) / 2;

  // ---- the data modules: instanced blocks that rise in a wave from the three corners
  const { m, inF } = matrix();
  const cells = []; for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) if (m[r][c]) cells.push([c, r]);
  const inst = new THREE.InstancedMesh(new THREE.BoxGeometry(MOD, 1, MOD), glossy(0x1b1a1e, { roughness: 0.35 }), cells.length);
  inst.castShadow = true; g.add(inst);
  const delays = cells.map(([c, r]) => {
    const d = Math.min(Math.hypot(c, r), Math.hypot(N - 1 - c, r), Math.hypot(c, N - 1 - r));
    return 0.5 + d * 0.085 + Math.random() * 0.12;
  });
  const dummy = new THREE.Object3D();
  const cellPos = (c, r) => [X0 + c * CELL, X0 + r * CELL];

  // ---- the three corner "eyes"
  const eyes = FINDERS.map(([fc, fr], i) => {
    const grp = new THREE.Group(); const [x0, z0] = cellPos(fc + 3, fr + 3); grp.position.set(x0, TY, z0); g.add(grp);
    const outer = new THREE.Mesh(rbox(7 * CELL - 0.0015, 0.024, 7 * CELL - 0.0015, 0.004), glossy(0x1b1a1e)); outer.position.y = 0.012; grp.add(outer);
    const ringW = new THREE.Mesh(rbox(5 * CELL, 0.0245, 5 * CELL, 0.003), glossy(0xfbf8ee)); ringW.position.y = 0.012; grp.add(ringW);
    const coreMat = new THREE.MeshStandardMaterial({ color: 0x1b1a1e, roughness: 0.35, emissive: 0xffb300, emissiveIntensity: 0 });
    const core = new THREE.Mesh(rbox(3 * CELL, 0.03, 3 * CELL, 0.004), coreMat); core.position.y = 0.015; grp.add(core);
    const halo = lightPool(0xffc233, 0.1, 0); halo.position.y = 0.026; grp.add(halo);
    R.add(grp, 0.9 + i * 0.35, { dur: 0.8, rise: 0.12 });
    H.add(core, 0xffc233, 0.16, null, () => (finished ? 0 : 1));
    const hit = new THREE.Mesh(new THREE.BoxGeometry(7 * CELL + 0.04, 0.05, 7 * CELL + 0.04), new THREE.MeshBasicMaterial({ visible: false })); hit.position.y = 0.02; grp.add(hit); // generous touch area
    const e = { grp, coreMat, halo, i, k: 0 };
    ctx.tap(grp, () => touchEye(e));
    return e;
  });
  const EYE_CARDS = [
    ['ثلاث زوايا', 'الجيل الثاني من الشفرة ثنائي الأبعاد، ومقسّم إلى مربعات في ثلاث زوايا.'],
    ['٤٠٠٠ حرف', 'ازدادت قدرته التخزينية لتصل إلى ٤٠٠٠ حرف، ويقرؤه قارئ خاص أو برنامج على الهاتف.'],
    ['من اليابان ١٩٩٤', 'بدأ هذا الجيل عام ١٩٩٤ على يد الياباني دنسون ويف.'],
  ];
  function touchEye(e) {
    ctx.sfx.pop?.(); R.bounce(e.grp); burstAt(ctx, e.grp, 0xffc233, 18, 0.3, 0.025);
    const first = !lit3[e.i]; lit3[e.i] = true; H.seen(e.grp.children[2]);
    const c = EYE_CARDS[e.i]; ctx.ui.card({ tag: 'رمز QR', title: c[0], body: c[1], color: 0xf6c715 });
    if (first && lit3.every(Boolean) && scanStart < 0) setTimeout(() => { scanStart = now; ctx.sfx.whoosh?.(); }, 900);
  }

  // ---- phone hovering above, scanning
  const phone = new THREE.Group(); phone.position.set(0.31, 0.3, 0.02); phone.rotation.x = -0.25; phone.scale.setScalar(0.8); g.add(phone);
  const body = new THREE.Mesh(rbox(0.11, 0.2, 0.01, 0.014), glossy(0x1d2430)); phone.add(body);
  const scr = new THREE.Mesh(new THREE.PlaneGeometry(0.098, 0.186), new THREE.MeshBasicMaterial({ color: 0x172033, toneMapped: false })); scr.position.z = 0.0055; phone.add(scr);
  const brackets = new THREE.Group(); brackets.position.z = 0.006; phone.add(brackets);
  [[1, 1], [-1, 1], [1, -1], [-1, -1]].forEach(([a, b]) => { const l = new THREE.Mesh(new THREE.PlaneGeometry(0.014, 0.014), lit(0xffc233)); l.position.set(a * 0.03, b * 0.052, 0); brackets.add(l); });
  const scan = new THREE.Mesh(new THREE.PlaneGeometry(0.086, 0.004), lit(0x6fe0ff)); scan.position.z = 0.007; phone.add(scan);
  R.add(phone, 2.2, { dur: 1.0, rise: 0.15 });
  const beamMat = new THREE.MeshBasicMaterial({ color: 0x7fe6ff, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, toneMapped: false });
  const beam = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.2), beamMat); beam.position.y = TY + 0.1; g.add(beam);

  // ---- what the code releases
  const things = [
    { k: 'book', mk: bookMini, x: -0.19, c: 0x2d6fd0, tag: 'مصادر تعليمية', t: 'كتاب يفتح مصادره', b: 'يُضاف الرمز إلى الكتب المدرسية لتسهيل الوصول إلى المصادر التعليمية المتنوعة.' },
    { k: 'badge', mk: badgeMini, x: 0, c: 0xe8b23a, tag: 'سجلّ الإنجازات', t: 'رمز لكل طالب', b: 'يحفظ كل طالب في رمزه إنجازاته المتنوعة، فيسهل تقديمها للمعلم والاطلاع عليها.' },
    { k: 'cert', mk: certMini, x: 0.19, c: 0xe0605a, tag: 'الشهادات', t: 'شهادة لا تُزيَّف', b: 'يُضاف الرمز إلى شهادات الطلاب لضمان عدم فقدان الأصل الورقي أو تزييفه.' },
  ].map((d, i) => {
    const o = d.mk(); o.position.set(d.x, TY + 0.02, 0.1); o.scale.setScalar(0.0001); g.add(o); o.children[0].castShadow = true;
    const pool = { material: { opacity: 0 } };
    ctx.tap(o, () => {
      ctx.sfx.pop?.(); burstAt(ctx, o, d.c, 20, 0.3, 0.025); read.add(d.k); thing.bn = 1; H.seen(o);
      ctx.ui.card({ tag: d.tag, title: d.t, body: d.b, color: d.c });
      if (read.size === 3 && !finished) { finished = true; setTimeout(() => { ctx.sfx.good?.(); ctx.ui.done(); }, 1000); }
    });
    H.add(o, d.c, 0.15, null, () => (thing.k > 0.9 ? 1 : 0));
    const thing = { o, d, i, pool, k: 0, bn: 0 };
    return thing;
  });

  ctx.ui.hud('المس العيون الثلاث في الزوايا');
  return {
    update(t, dt, e) {
      now = t;
      R.update(t, dt, e); H.update(t, e, stag(t, 3.8, 0.6));
      // data blocks
      for (let i = 0; i < cells.length; i++) {
        const [c, r] = cells[i]; const k = easeBack((t - delays[i]) / 0.55) * e;
        const h = Math.max(0.0001, 0.011 * k);
        const [x, z] = cellPos(c, r);
        dummy.position.set(x, TY + h / 2, z); dummy.scale.set(1, h, 1); dummy.updateMatrix(); inst.setMatrixAt(i, dummy.matrix);
      }
      inst.instanceMatrix.needsUpdate = true;
      // eyes glow
      eyes.forEach((ey, i) => {
        const on = lit3[i] ? 1 : 0; ey.k = THREE.MathUtils.damp(ey.k, on, 5, dt);
        ey.coreMat.emissiveIntensity = ey.k * (1.2 + 0.4 * Math.sin(t * 5 + i)); ey.halo.material.opacity = 0.7 * ey.k;
      });
      // phone sweeps back and forth, brackets pulse
      const pk = R.k(phone); phone.position.y = 0.3 + Math.sin(t * 1.1) * 0.01 - (scanStart >= 0 ? 0.01 : 0);
      phone.rotation.y = Math.sin(t * 0.5) * 0.25;
      const sp = scanStart >= 0 ? (t - scanStart) : -1;
      scan.position.y = Math.sin(t * 2.2) * 0.07; scan.visible = pk > 0.8;
      const sweeping = sp >= 0 && sp < 1.6;
      beamMat.opacity = sweeping ? 0.35 * Math.sin((sp / 1.6) * Math.PI) : 0;
      beam.position.z = -0.25 + (sweeping ? sp / 1.6 : 0) * 0.5; beam.rotation.y = 0;
      // released things
      things.forEach((th, i) => {
        const k = sp >= 0 ? easeBack((sp - 0.5 - i * 0.28) / 0.8) : 0; th.k = k;
        th.bn = Math.max(0, th.bn - dt * 3);
        const bob = Math.sin(t * 1.4 + i * 2) * 0.008;
        th.o.position.y = TY + 0.045 + 0.15 * clamp01(k) + bob; th.o.position.z = 0.1 - 0.06 * clamp01(k);
        th.o.rotation.y = Math.sin(t * 0.8 + i) * 0.4; th.o.rotation.x = -0.25;
        th.o.scale.setScalar(Math.max(0.0001, k * (1 + 0.18 * Math.sin(th.bn * Math.PI))));
        th.o.visible = k > 0.01; th.pool.material.opacity = 0.5 * clamp01(k);
      });
    },
  };
}
