import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { P, ease, easeBack, clamp01, stag, mat, glossy, goldMat, shadowed, glow, sprite, lightTube } from '../../kit.js?v=37';
import { Rig, badge, V, TAU } from '../lib/b5-kit.js?v=37';
import { lightPool } from '../../v2/common.js?v=37';

export const meta = { free: true, center: [0.5, 0.74], typeLabel: 'خط زمني' };

const ST = [
  { x: -0.25, z: 0.1, c: 0xe9a23b, w: 'قبل ١٥٠٠ سنة', t: 'الشطرنج عند الهنود', n: 'استعمل الهنود لعبة الشطرنج قبل نحو ١٥٠٠ سنة، وانتشر في المدارس اللعب الإيهامي وتمثيل الأدوار.' },
  { x: -0.08, z: -0.12, c: 0xc2503f, w: 'القرن التاسع عشر', t: 'ألعاب الحرب البروسية', n: 'طوّر البروسيون ألعاب الحرب، فاستبدلوا قطع الشطرنج بالجنود والضباط وصارت الخرائط لوحة اللعب.' },
  { x: 0.1, z: 0.1, c: 0x2f9fd8, w: 'بعد الحرب الثانية', t: 'الألعاب في الإدارة', n: 'استعمل رجال الأعمال والإدارة الألعاب لتوضيح العمليات ونقل الواقع إلى موقع التدريب.' },
  { x: 0.27, z: -0.1, c: 0x39b58a, w: 'نهاية الخمسينيات', t: 'اتساع المجال التعليمي', n: 'أدخل التربويون الألعاب في مساقات العلوم السياسية للدراسات العليا وفي التدريب والتعليم.' },
];
const START = V(-0.33, 0, -0.14);
const BY = 0.052; // board top height

function lathe(pts, m) { return new THREE.Mesh(new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), 32), m); }

function king(c) {
  const t = new THREE.Group(); const m = glossy(0xfaf3e2, { roughness: 0.22 });
  const body = lathe([[0.001, 0], [0.034, 0], [0.036, 0.008], [0.026, 0.016], [0.016, 0.05], [0.02, 0.07], [0.03, 0.078], [0.03, 0.086], [0.016, 0.092], [0.001, 0.092]], m); t.add(shadowed(body));
  const a = new THREE.Mesh(new RoundedBoxGeometry(0.008, 0.032, 0.008, 2, 0.002), goldMat()); a.position.y = 0.108; t.add(a);
  const b = new THREE.Mesh(new RoundedBoxGeometry(0.026, 0.008, 0.008, 2, 0.002), goldMat()); b.position.y = 0.112; t.add(b);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.03, 0.003, 8, 28), goldMat()); ring.rotation.x = Math.PI / 2; ring.position.y = 0.012; t.add(ring);
  t.userData.spin = t; return t;
}
function soldier(c) {
  const t = new THREE.Group(); const m = glossy(c, { roughness: 0.3 });
  const legs = [-1, 1].map((s) => { const l = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.009, 0.034, 10), glossy(0x23324f)); l.position.set(s * 0.011, 0.025, 0); t.add(shadowed(l)); return l; });
  const bd = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.024, 0.05, 20), m); bd.position.y = 0.067; t.add(shadowed(bd));
  const belt = new THREE.Mesh(new THREE.TorusGeometry(0.0225, 0.003, 6, 20), goldMat()); belt.rotation.x = Math.PI / 2; belt.position.y = 0.055; t.add(belt);
  const hd = new THREE.Mesh(new THREE.SphereGeometry(0.0175, 20, 14), glossy(0xe9c9a0)); hd.position.y = 0.105; t.add(hd);
  const hat = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.018, 0.034, 20), glossy(0x23324f)); hat.position.y = 0.134; t.add(shadowed(hat));
  const pl = new THREE.Mesh(new THREE.SphereGeometry(0.005, 10, 8), goldMat()); pl.position.y = 0.155; t.add(pl);
  const rf = new THREE.Mesh(new THREE.CylinderGeometry(0.002, 0.002, 0.11, 6), goldMat()); rf.position.set(0.026, 0.09, 0); rf.rotation.z = -0.1; t.add(rf);
  t.userData.legs = legs; return t;
}
function bars(c) {
  const t = new THREE.Group(); const bs = [];
  [0.04, 0.07, 0.105].forEach((h, i) => { const b = new THREE.Mesh(new RoundedBoxGeometry(0.026, 1, 0.026, 2, 0.006), glossy([0x2f9fd8, 0x39b58a, 0xe9a23b][i], { roughness: 0.25 })); b.geometry.translate(0, 0.5, 0); b.position.set(-0.034 + i * 0.034, 0, 0); b.scale.y = h; b.userData.h = h; t.add(shadowed(b)); bs.push(b); });
  const coin = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.006, 28), goldMat()); coin.rotation.x = Math.PI / 2; coin.position.set(0.034, 0.14, 0); t.add(coin);
  t.userData.bars = bs; t.userData.coin = coin; return t;
}
function cap(c) {
  const t = new THREE.Group();
  [0, 1, 2].forEach((i) => { const b = new THREE.Mesh(new RoundedBoxGeometry(0.07 - i * 0.004, 0.012, 0.05, 2, 0.003), glossy([0x2f9fd8, 0xe85a4f, 0xe9a23b][i], { roughness: 0.3 })); b.position.set(0, 0.008 + i * 0.013, 0); b.rotation.y = i * 0.25; t.add(shadowed(b)); });
  const hat = new THREE.Group(); hat.position.y = 0.075; t.add(hat);
  const board = new THREE.Mesh(new RoundedBoxGeometry(0.075, 0.006, 0.075, 2, 0.002), glossy(0x23324f)); board.rotation.y = Math.PI / 4; hat.add(shadowed(board));
  const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.024, 0.026, 20), glossy(0x23324f)); crown.position.y = -0.015; hat.add(crown);
  const tas = new THREE.Mesh(new THREE.CylinderGeometry(0.0015, 0.0015, 0.04, 6), goldMat()); tas.position.set(0.032, -0.02, 0.032); hat.add(tas);
  t.userData.hat = hat; return t;
}
function mapTex() {
  const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d');
  g.fillStyle = '#f2e3bf'; g.fillRect(0, 0, 128, 128); g.strokeStyle = '#9b7c4a'; g.lineWidth = 3; g.setLineDash([8, 6]); g.beginPath(); g.moveTo(16, 100); g.bezierCurveTo(40, 30, 80, 120, 112, 24); g.stroke();
  g.setLineDash([]); g.fillStyle = '#c2503f'; g.fillRect(18, 22, 20, 20); g.fillStyle = '#2f5aa6'; g.fillRect(88, 84, 20, 20);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

export default function build(ctx) {
  const g = new THREE.Group(); g.position.copy(P(meta.center[0], meta.center[1])); g.scale.setScalar(1.05); ctx.stage.add(g);
  const rig = new Rig(ctx);
  const pool = lightPool(0xc9a45e, 0.5, 0); pool.position.y = 0.002; pool.scale.set(1.4, 1.4, 1.0); g.add(pool); rig.fn((p) => { pool.material.opacity = 0.3 * p; }, 0.1, 1);

  // board
  const brd = new THREE.Group(); g.add(brd);
  const slab = new THREE.Mesh(new RoundedBoxGeometry(0.76, 0.05, 0.58, 4, 0.016), glossy(0x7a4f33, { roughness: 0.45 })); slab.position.y = 0.025; brd.add(shadowed(slab));
  const frame = new THREE.Mesh(new RoundedBoxGeometry(0.73, 0.006, 0.55, 2, 0.003), goldMat()); frame.position.y = 0.051; brd.add(frame);
  const CS = 0.085; const sq = new THREE.InstancedMesh(new RoundedBoxGeometry(1, 1, 1, 2, 0.08), new THREE.MeshStandardMaterial({ roughness: 0.4 }), 8 * 6); const dm = new THREE.Object3D(); const col = new THREE.Color();
  for (let i = 0; i < 8; i++) for (let j = 0; j < 6; j++) { const k = i * 6 + j; dm.position.set(-0.3 + (i + 0.5) * CS * 0.88 * 1 + 0.0, BY + 0.003, -0.22 + (j + 0.5) * CS * 0.88 + 0.0); dm.scale.set(CS * 0.9 * 0.88 / 0.88, 0.008, CS * 0.88); dm.updateMatrix(); sq.setMatrixAt(k, dm.matrix); col.setHex((i + j) % 2 ? 0xf3e6c8 : 0xb98f5a); sq.setColorAt(k, col); }
  sq.receiveShadow = true; brd.add(sq); rig.add(brd, 0.1, 0.9, 'pop');

  // path of light between stations
  const wp = [V(START.x, BY + 0.02, START.z), ...ST.map((s) => V(s.x, BY + 0.02, s.z))];
  const tubes = []; for (let i = 0; i < 4; i++) { const a = wp[i], b = wp[i + 1]; const cu = new THREE.CatmullRomCurve3([a, V((a.x + b.x) / 2, BY + 0.05, (a.z + b.z) / 2), b]); const tb = lightTube(cu, { radius: 0.0045, color: ST[i].c, speed: 0.6 }); tb.userData.fill(0); g.add(tb); tubes.push(tb); }

  // stations
  const builders = [king, soldier, bars, cap];
  const sts = ST.map((s, i) => {
    const grp = new THREE.Group(); grp.position.set(s.x, BY, s.z); g.add(grp);
    const ped = new THREE.Mesh(new THREE.CylinderGeometry(0.058, 0.064, 0.022, 36), glossy(s.c, { roughness: 0.25 })); ped.position.y = 0.011; grp.add(shadowed(ped));
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.058, 0.0035, 8, 40), goldMat()); rim.rotation.x = Math.PI / 2; rim.position.y = 0.022; grp.add(rim);
    const obj = builders[i](s.c); obj.position.y = 0.022; obj.scale.setScalar(1.6); grp.add(obj);
    if (i === 1) { const mp = new THREE.Mesh(new THREE.PlaneGeometry(0.085, 0.085), new THREE.MeshStandardMaterial({ map: mapTex(), roughness: 0.8 })); mp.rotation.x = -Math.PI / 2; mp.position.y = 0.0235; grp.add(mp); }
    const aura = glow(s.c, 0.3, 0); aura.position.y = 0.1; grp.add(aura);
    return { grp, obj, s, i, act: -9, aura, ped, rim };
  });
  sts.forEach((o, i) => rig.add(o.grp, 0.9 + i * 0.25, 0.8, 'pop'));

  // pawn
  const pawn = new THREE.Group(); g.add(pawn);
  const pm = lathe([[0.001, 0], [0.022, 0], [0.024, 0.006], [0.012, 0.018], [0.01, 0.034], [0.018, 0.04], [0.01, 0.046], [0.016, 0.056], [0.001, 0.07]], goldMat()); pawn.add(shadowed(pm));
  const ph = new THREE.Mesh(new THREE.SphereGeometry(0.015, 18, 14), goldMat()); ph.position.y = 0.074; pawn.add(shadowed(ph));
  const pg = glow(0xffd27a, 0.15, 0.6); pg.position.y = 0.05; pawn.add(pg);
  pawn.position.set(START.x, BY, START.z); pawn.scale.setScalar(1.35);
  rig.add(pawn, 0.7, 0.8, 'pop');
  const lab = sprite('قبل ١٥٠٠ سنة', 0.2, { size: 50, width: 480, weight: 800, border: '#e9a23b' }); lab.visible = false; g.add(lab); lab.userData.w = 0.2;

  let cur = -1, route = [], hopT = 0, hopFrom = null, now = 0, seen = new Set(), doneF = false, autoGo = true, labI = -1;
  const goTo = (j) => {
    if (j <= cur) { /* revisit: hop back via direct jump */ route = [j]; } else { route = []; for (let k = cur + 1; k <= j; k++) route.push(k); }
    if (!route.length) return; hopFrom = pawn.position.clone(); hopT = now; ctx.sfx.whoosh?.();
  };
  sts.forEach((o) => rig.touch(o.grp, () => {
    ctx.sfx.pop?.(); goTo(o.i); o.act = now; autoGo = false;
    ctx.ui.card({ tag: o.s.w, title: o.s.t, body: o.s.n, color: o.s.c }); seen.add(o.i);
    if (seen.size >= 4 && !doneF) { doneF = true; setTimeout(() => ctx.ui.done(), 2800); }
  }, { color: o.s.c, size: 0.2, at: V(0, 0.08, 0), show: 3.2 + o.i * 0.25 }));

  const HOP = 0.75;
  return {
    update(t, dt, e) {
      now = t; rig.update(t, dt, e);
      if (autoGo && t > 3.8) { autoGo = false; goTo(0); sts[0].act = t; }
      if (route.length) {
        const tg = route[0]; const to = V(ST[tg].x, BY + 0.022, ST[tg].z); const k = clamp01((now - hopT) / HOP);
        pawn.position.lerpVectors(hopFrom, to, ease(k)); pawn.position.y += Math.sin(k * Math.PI) * 0.07;
        if (k >= 1) { cur = tg; if (tg > 0) { tubes[tg].userData.fill(1); } else tubes[0].userData.fill(1); sts[tg].act = now; ctx.fx.burst(g.localToWorld(to.clone().add(V(0, 0.05, 0))), ST[tg].c, 18, 0.3, 0.025); route.shift(); hopFrom = pawn.position.clone(); hopT = now; ctx.sfx.pop?.(); }
      } else { pawn.position.y += (BY + (cur >= 0 ? 0.022 : 0) - pawn.position.y) * 0.3; }
      tubes.forEach((tb) => tb.userData.update(dt));
      sts.forEach((o, i) => {
        const a = clamp01(1 - (now - o.act) / 2.2), cur_ = i === cur ? 1 : 0;
        o.aura.material.opacity = (0.18 + 0.12 * Math.sin(t * 2 + i) + cur_ * 0.35) * e;
        o.obj.position.y = 0.022 + Math.sin(t * 1.6 + i) * 0.003 + Math.sin(a * Math.PI) * 0.01;
        if (i === 0) o.obj.rotation.y = a > 0 ? (1 - a) * TAU * 1 : 0; if (i === 0) o.obj.rotation.z = Math.sin(a * Math.PI * 4) * 0.12 * a;
        if (i === 1) { o.obj.userData.legs.forEach((l, k) => { l.rotation.x = Math.sin(t * 9 + k * Math.PI) * 0.5 * a; }); o.obj.position.z = Math.sin(a * Math.PI) * 0.03 * -1; }
        if (i === 2) { o.obj.userData.bars.forEach((b, k) => { const gr = a > 0 ? easeBack(clamp01((1 - a) * 1.6 - k * 0.15)) : 1; b.scale.y = b.userData.h * (0.35 + 0.65 * gr); }); o.obj.userData.coin.rotation.y = t * 2.5; }
        if (i === 3) { o.obj.userData.hat.position.y = 0.075 + Math.sin(a * Math.PI) * 0.06; o.obj.userData.hat.rotation.y = (1 - a) * TAU * (a > 0 ? 1 : 0) + t * 0.3; }
      });
      const li = cur; if (li >= 0 && !route.length) { if (labI !== li) { labI = li; const s = sprite(ST[li].w, 0.2, { size: 50, width: 480, weight: 800, border: '#' + ST[li].c.toString(16).padStart(6, '0') }); lab.material.map?.dispose(); lab.material.map = s.material.map; lab.material.needsUpdate = true; lab.userData.aspect = s.userData.aspect; }
        lab.visible = true; lab.position.set(ST[li].x, 0.3, ST[li].z); lab.scale.set(0.2, 0.2 * lab.userData.aspect, 1); } else lab.visible = false;
    },
  };
}
