import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { P, ease, easeBack, clamp01, stag, mat, glossy, goldMat, shadowed, glow, sprite } from '../../kit.js?v=17';
import { Rig, badge, V, TAU } from '../lib/b5-kit.js?v=17';
import { lightPool } from '../../v2/common.js?v=17';

export const meta = { free: true, center: [0.5, 0.74], typeLabel: 'مخطط ينمو' };

const TS = 1.0; const C = 0.05; // cell size
const hx = (c) => '#' + c.toString(16).padStart(6, '0');
// tetromino pieces packed into a 6 x 4 block; order = the concept chain
const PCS = [
  { k: 'game', t: 'اللعب', ic: 'cube', c: 0xe9a23b, cells: [[0, 0], [0, 1], [1, 0], [2, 0]], n: 'التلعيب مصطلح مشتق من كلمة Game؛ ويُعرف أيضاً باسم Ludification، ويُترجم بالتلعيب أو اللوعبة.' },
  { k: 'gami', t: 'التلعيب', ic: 'gear', c: 0x7b52c9, cells: [[3, 0], [4, 0], [5, 0], [5, 1]], n: 'استخدام آليات وأطر الألعاب لتشجيع السلوكيات المرغوبة، أو عناصر تصميم اللعبة في غير سياق اللعبة.' },
  { k: 'mkt', t: 'التسويق', ic: 'coin', c: 0xe85a4f, cells: [[2, 1], [2, 2], [3, 1], [3, 2]], n: 'كان أول ظهور للمصطلح في التسويق التجاري للترويج للعلامات، ويعود أول استخدام موثّق له إلى عام ٢٠٠٨.' },
  { k: 'edu', t: 'التعليم', ic: 'cap', c: 0x2f9fd8, cells: [[0, 2], [0, 3], [1, 1], [1, 2]], n: 'انتقل المصطلح بعد التسويق إلى ميادين أخرى منها التعليم والتدريب.' },
  { k: 'med', t: 'الإعلام والصحة', ic: 'plus', c: 0x39b58a, cells: [[4, 1], [4, 2], [5, 2], [5, 3]], n: 'ومن الميادين التي انتقل إليها أيضاً الإعلام والصحة.' },
  { k: 'life', t: 'الحياة', ic: 'loop', c: 0xd4437a, cells: [[1, 3], [2, 3], [3, 3], [4, 3]], n: 'جعل الحياة الحقيقية تحاكي الألعاب، وليس جعل الألعاب تحاكي الحياة الحقيقية.' },
];
// tray slots (page-plane, local x/z) for the six pieces, scrambled
const TRAY = [[-0.27, 0.34], [0.0, 0.4], [0.27, 0.34], [-0.27, 0.52], [0.02, 0.56], [0.28, 0.5]];
const MON = V(0, 0, -0.2); // monitor foot position

function pieceMesh(p) {
  const g = new THREE.Group(); const m = glossy(p.c, { roughness: 0.22 });
  p.cells.forEach(([x, y]) => {
    const b = new THREE.Mesh(new RoundedBoxGeometry(C * 0.94, C * 0.94, C * 0.94, 3, 0.008), m);
    b.position.set(x * C, y * C, 0); g.add(shadowed(b));
    const top = new THREE.Mesh(new RoundedBoxGeometry(C * 0.62, C * 0.62, 0.004, 2, 0.002), new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: p.c, emissiveIntensity: 0.35, transparent: true, opacity: 0.3 }));
    top.position.set(x * C, y * C, C * 0.47); g.add(top);
  });
  // centre of piece for icon
  const cx = p.cells.reduce((a, c) => a + c[0], 0) / 4, cy = p.cells.reduce((a, c) => a + c[1], 0) / 4;
  g.userData.center = V(cx * C, cy * C, 0);
  return g;
}

export default function build(ctx) {
  const g = new THREE.Group(); g.position.copy(P(meta.center[0], meta.center[1])); g.position.z -= 0.2; g.scale.setScalar(0.93); ctx.stage.add(g);
  const rig = new Rig(ctx);
  const pool = lightPool(0x3a8fb7, 0.55, 0); pool.position.set(0, 0.002, 0.15); pool.scale.set(1.2, 1.2, 0.9); g.add(pool);
  rig.fn((p) => { pool.material.opacity = 0.3 * p; }, 0.1, 1);

  // ---- desk tray
  const desk = new THREE.Mesh(new RoundedBoxGeometry(0.78, 0.03, 0.52, 3, 0.012), glossy(0x1d4d66, { roughness: 0.35 }));
  desk.position.set(0, 0.015, 0.37); g.add(shadowed(desk));
  const dRim = new THREE.Mesh(new RoundedBoxGeometry(0.75, 0.008, 0.49, 2, 0.004), goldMat()); dRim.position.set(0, 0.027, 0.37); g.add(dRim);
  const dTop = new THREE.Mesh(new RoundedBoxGeometry(0.72, 0.006, 0.46, 2, 0.003), glossy(0x2b6c8c, { roughness: 0.4 })); dTop.position.set(0, 0.031, 0.37); g.add(dTop);
  rig.add(desk, 0.1, 0.8, 'pop');

  // ---- monitor
  const mon = new THREE.Group(); mon.position.copy(MON); g.add(mon);
  const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.11, 0.016, 40), glossy(0xcfd5de)); foot.position.y = 0.008; mon.add(shadowed(foot));
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.026, 0.14, 20), mat(0xb9c0cb, { metalness: 0.6, roughness: 0.3 })); neck.position.y = 0.08; mon.add(neck);
  const SW = 0.42, SH = 0.54, SY = 0.15 + SH / 2;
  const bez = new THREE.Mesh(new RoundedBoxGeometry(SW + 0.05, SH + 0.05, 0.04, 4, 0.016), glossy(0xe8ecf1, { roughness: 0.3 })); bez.position.y = SY; mon.add(shadowed(bez));
  // screen canvas
  const cv = document.createElement('canvas'); cv.width = 512; cv.height = 512; const cg = cv.getContext('2d');
  const gr = cg.createLinearGradient(0, 0, 0, 512); gr.addColorStop(0, '#16507a'); gr.addColorStop(1, '#0b2540'); cg.fillStyle = gr; cg.fillRect(0, 0, 512, 512);
  cg.strokeStyle = 'rgba(120,220,255,.2)'; cg.lineWidth = 2;
  for (let i = 0; i <= 6; i++) { cg.beginPath(); cg.moveTo(i * 512 / 6, 0); cg.lineTo(i * 512 / 6, 512); cg.stroke(); }
  for (let i = 0; i <= 8; i++) { cg.beginPath(); cg.moveTo(0, i * 64); cg.lineTo(512, i * 64); cg.stroke(); }
  const stex = new THREE.CanvasTexture(cv); stex.colorSpace = THREE.SRGBColorSpace;
  const scr = new THREE.Mesh(new THREE.PlaneGeometry(SW, SH), new THREE.MeshBasicMaterial({ map: stex, toneMapped: false }));
  scr.position.set(0, SY, 0.0215); mon.add(scr);
  // well: 6 columns x 8 rows spans screen
  const WX = (SW - 0.04) / 6, WY = (SH - 0.04) / 8; // not square; use C scale
  const cell = Math.min(WX, WY * 1.0); const PS = cell / C; // piece scale inside the well
  const wellBottom = SY - SH / 2 + 0.02; const wellLeft = -3 * cell;
  const frameGlow = glow(0x6fd0ff, 0.9, 0); frameGlow.position.set(0, SY, 0.04); mon.add(frameGlow);

  // rain cubes (ambient motion inside the screen)
  const rain = [];
  for (let i = 0; i < 9; i++) {
    const m = new THREE.Mesh(new RoundedBoxGeometry(cell * 0.7, cell * 0.7, cell * 0.7, 2, 0.006), new THREE.MeshStandardMaterial({ color: PCS[i % 6].c, emissive: PCS[i % 6].c, emissiveIntensity: 0.9, transparent: true, opacity: 0.0 }));
    m.userData = { col: (i * 5) % 6, ph: i * 0.77, sp: 0.04 + (i % 3) * 0.02 };
    m.position.z = 0.04; mon.add(m); rain.push(m);
  }

  // ---- pieces
  const pcs = PCS.map((p, i) => {
    const grp = new THREE.Group(); const mesh = pieceMesh(p); grp.add(mesh);
    const pos = V(TRAY[i][0], 0.034 + C * 0.4, TRAY[i][1]);
    const cc = mesh.userData.center;
    // centre the piece on its slot
    mesh.position.set(-cc.x, -cc.y, 0); mesh.userData.center = cc;
    grp.position.copy(pos); grp.rotation.x = -Math.PI / 2; grp.scale.setScalar(TS);
    const b = badge(p.ic, p.c, 0.058); b.position.set(0, 0, C * 0.9); grp.add(b); b.material.rotation = 0;
    g.add(grp);
    // landing: cells' world offset in mon-space
    const home = V(wellLeft + 0.0, 0, 0);
    return { p, grp, mesh, i, pos, state: 'tray', t0: -9, b, cc, shake: -9 };
  });
  const land = (o) => { // group origin so that mesh cells land on well cells
    const cc = o.cc; // mesh offset is -cc
    return V(MON.x + wellLeft + cell / 2 + cc.x / C * cell, MON.y + wellBottom + cell / 2 + cc.y / C * cell, MON.z + 0.03);
  };
  const next = { i: 0 };
  const lab = sprite('', 0.2, { size: 50, width: 480, weight: 800 }); lab.visible = false; g.add(lab);
  let doneFlag = false, flash = -9, now = 0;

  pcs.forEach((o0) => ctx.tap(o0.grp, () => { let o = o0;
    if (o.state !== 'tray') { ctx.sfx.pop?.(); ctx.ui.card({ tag: 'مفهوم', title: o.p.t, body: o.p.n, color: o.p.c }); return; }
    if (o.i !== next.i) { o.shake = now; o = pcs[next.i]; }
    o.state = 'fly'; o.t0 = now; o.from = o.grp.position.clone(); o.to = land(o); ctx.sfx.whoosh?.();
    ctx.ui.card({ tag: 'مفهوم', title: o.p.t, body: o.p.n, color: o.p.c });
  }));

  const lblRetext = (text, c) => { // reuse sprite: rebuild canvas lazily
    const s = sprite(text, 0.2, { size: 50, width: 480, weight: 800, border: hx(c) });
    lab.material.map?.dispose(); lab.material.map = s.material.map; lab.material.needsUpdate = true; lab.userData.aspect = s.userData.aspect; lab.userData.w = 0.2;
  };
  let lastNext = -1;

  return {
    update(t, dt, e) {
      now = t; rig.update(t, dt, e);
      const mk = stag(t, 0.3, 1.0, easeBack) * e; mon.scale.setScalar(Math.max(mk, 0.001)); mon.visible = mk > 0.01;
      frameGlow.material.opacity = (0.16 + 0.05 * Math.sin(t * 1.6)) * mk + clamp01(1 - (now - flash) / 1.2) * 0.5;
      rain.forEach((m) => {
        const u = m.userData; const k = ((t * u.sp + u.ph) % 1);
        const yTop = wellBottom + cell * 7.6, yBot = wellBottom + cell * 4.6;
        m.position.set(wellLeft + (u.col + 0.5) * cell, yTop - (yTop - yBot) * k, 0.04);
        m.rotation.z = t * 0.5 + u.ph; m.material.opacity = Math.sin(k * Math.PI) * 0.55 * mk * (doneFlag ? 0 : 1);
        m.visible = mk > 0.05;
      });
      pcs.forEach((o, i) => {
        const p = stag(t, 0.8 + i * 0.22, 0.9, easeBack) * e;
        if (o.state === 'tray') {
          const sk = clamp01(1 - (now - o.shake) / 0.4);
          const act = o.i === next.i && t > 3.4;
          o.grp.position.set(o.pos.x + Math.sin(now * 55) * 0.008 * sk, o.pos.y + (act ? 0.012 + Math.sin(t * 3.5) * 0.008 : 0) + (1 - Math.min(p, 1)) * 0.2, o.pos.z);
          o.grp.rotation.z = (act ? Math.sin(t * 2) * 0.04 : 0);
          o.grp.scale.setScalar(Math.max(TS * p, 0.001) * (act ? 1.06 : 1)); o.grp.visible = p > 0.01;
        } else if (o.state === 'fly') {
          const k = clamp01((now - o.t0) / 1.1), ek = ease(k);
          o.grp.position.lerpVectors(o.from, o.to, ek); o.grp.position.y += Math.sin(k * Math.PI) * 0.16;
          o.grp.rotation.x = -Math.PI / 2 * (1 - ek); o.grp.rotation.z = 0; o.grp.scale.setScalar((TS + (PS - TS) * ek));
          if (k >= 1) {
            o.state = 'placed'; o.b.visible = true; flash = now; ctx.sfx.good?.();
            ctx.fx.burst(g.localToWorld(o.to.clone()), o.p.c, 22, 0.35, 0.025);
            next.i++; if (next.i >= pcs.length && !doneFlag) { doneFlag = true; setTimeout(() => { ctx.ui.card({ tag: 'المعنى الجامع', title: 'الحياة تحاكي اللعبة', body: PCS[5].n, color: PCS[5].c }); ctx.ui.done(); }, 2600); }
          }
        } else { o.grp.position.copy(o.to); o.grp.scale.setScalar(PS); o.b.scale.setScalar(0.058 * PS); }
      });
      // hint label over the next piece
      if (next.i < pcs.length && t > 3.4) {
        const o = pcs[next.i]; if (lastNext !== next.i) { lastNext = next.i; lblRetext(o.p.t, o.p.c); }
        lab.visible = true; lab.position.set(o.pos.x, o.pos.y + 0.12, o.pos.z + 0.01);
        const k = clamp01((t - 3.4) / 0.6); lab.scale.set(0.2 * k + 0.001, 0.2 * lab.userData.aspect * k + 0.001, 1);
      } else lab.visible = false;
    },
  };
}
