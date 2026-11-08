import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { P, ease, easeBack, clamp01, stag, mat, glossy, goldMat, shadowed, glow } from '../../kit.js?v=25';
import { Rig, badge, V } from '../lib/b5-kit.js?v=25';
import { lightPool } from '../../v2/common.js?v=25';

export const meta = { free: true, center: [0.45, 0.74], typeLabel: 'مخطط ينمو' };

// Six game pieces (the concept chain) fall into a small monitor, one after another.
const C = 0.046; // cell size of a piece
const PCS = [
  { t: 'اللعب', ic: 'cube', c: 0xe9a23b, cells: [[0, 0], [0, 1], [1, 0], [2, 0]], n: 'التلعيب مصطلح مشتق من كلمة Game؛ ويُعرف أيضاً باسم Ludification، ويُترجم بالتلعيب أو اللوعبة.' },
  { t: 'التلعيب', ic: 'gear', c: 0x7b52c9, cells: [[3, 0], [4, 0], [5, 0], [5, 1]], n: 'استخدام آليات وأطر الألعاب لتشجيع السلوكيات المرغوبة، أو عناصر تصميم اللعبة في غير سياق اللعبة.' },
  { t: 'التسويق', ic: 'coin', c: 0xe85a4f, cells: [[2, 1], [2, 2], [3, 1], [3, 2]], n: 'كان أول ظهور للمصطلح في التسويق التجاري للترويج للعلامات، ويعود أول استخدام موثّق له إلى عام ٢٠٠٨.' },
  { t: 'التعليم', ic: 'cap', c: 0x2f9fd8, cells: [[0, 2], [0, 3], [1, 1], [1, 2]], n: 'انتقل المصطلح بعد التسويق إلى ميادين أخرى منها التعليم والتدريب.' },
  { t: 'الإعلام والصحة', ic: 'plus', c: 0x39b58a, cells: [[4, 1], [4, 2], [5, 2], [5, 3]], n: 'ومن الميادين التي انتقل إليها أيضاً الإعلام والصحة.' },
  { t: 'الحياة', ic: 'loop', c: 0xd4437a, cells: [[1, 3], [2, 3], [3, 3], [4, 3]], n: 'جعل الحياة الحقيقية تحاكي الألعاب، وليس جعل الألعاب تحاكي الحياة الحقيقية.' },
];
// tray slots (local x, z): two rows of three, scrambled order
const TRAY = [[-0.21, 0.26], [0.0, 0.3], [0.21, 0.26], [-0.2, 0.43], [0.02, 0.46], [0.21, 0.42]];
const MON = V(0, 0, -0.1);

const CELL_GEO = new RoundedBoxGeometry(C * 0.94, C * 0.94, C * 0.94, 2, 0.008);
function pieceGeo(p, cc) {
  const parts = p.cells.map(([x, y]) => { const g = CELL_GEO.clone(); g.translate(x * C - cc.x, y * C - cc.y, 0); return g; });
  return mergeGeometries(parts);
}

export default function build(ctx) {
  const g = new THREE.Group(); g.position.copy(P(meta.center[0], meta.center[1])); g.position.z -= 0.2; ctx.stage.add(g);
  const rig = new Rig(ctx);
  const pool = lightPool(0x3a8fb7, 0.55, 0); pool.position.set(0, 0.002, 0.2); pool.scale.set(1.2, 1.2, 0.9); g.add(pool);
  rig.fn((p) => { pool.material.opacity = 0.3 * p; }, 0.1, 1);

  // ---- desk tray
  const desk = new THREE.Mesh(new RoundedBoxGeometry(0.7, 0.03, 0.46, 3, 0.012), glossy(0x1d4d66, { roughness: 0.35 }));
  desk.position.set(0, 0.015, 0.35); g.add(shadowed(desk));
  const dRim = new THREE.Mesh(new RoundedBoxGeometry(0.67, 0.008, 0.43, 2, 0.004), goldMat()); dRim.position.set(0, 0.027, 0.35); g.add(dRim);
  const dTop = new THREE.Mesh(new RoundedBoxGeometry(0.64, 0.006, 0.4, 2, 0.003), glossy(0x2b6c8c, { roughness: 0.4 })); dTop.position.set(0, 0.031, 0.35); g.add(dTop);
  rig.add(desk, 0.1, 0.8, 'pop');

  // ---- monitor
  const mon = new THREE.Group(); mon.position.copy(MON); g.add(mon);
  const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.1, 0.016, 32), glossy(0xcfd5de)); foot.position.y = 0.008; mon.add(shadowed(foot));
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.026, 0.12, 16), mat(0xb9c0cb, { metalness: 0.6, roughness: 0.3 })); neck.position.y = 0.07; mon.add(neck);
  const SW = 0.34, SH = 0.42, SY = 0.13 + SH / 2;
  const bez = new THREE.Mesh(new RoundedBoxGeometry(SW + 0.04, SH + 0.04, 0.036, 3, 0.014), glossy(0xe8ecf1, { roughness: 0.3 })); bez.position.y = SY; mon.add(shadowed(bez));
  const cv = document.createElement('canvas'); cv.width = 384; cv.height = 512; const cg = cv.getContext('2d');
  const gr = cg.createLinearGradient(0, 0, 0, 512); gr.addColorStop(0, '#16507a'); gr.addColorStop(1, '#0b2540'); cg.fillStyle = gr; cg.fillRect(0, 0, 384, 512);
  cg.strokeStyle = 'rgba(120,220,255,.2)'; cg.lineWidth = 2;
  for (let i = 0; i <= 6; i++) { cg.beginPath(); cg.moveTo(i * 64, 0); cg.lineTo(i * 64, 512); cg.stroke(); }
  for (let i = 0; i <= 8; i++) { cg.beginPath(); cg.moveTo(0, i * 64); cg.lineTo(384, i * 64); cg.stroke(); }
  const stex = new THREE.CanvasTexture(cv); stex.colorSpace = THREE.SRGBColorSpace;
  const scr = new THREE.Mesh(new THREE.PlaneGeometry(SW, SH), new THREE.MeshBasicMaterial({ map: stex, toneMapped: false }));
  scr.position.set(0, SY, 0.019); mon.add(scr);
  const cell = Math.min((SW - 0.03) / 6, (SH - 0.03) / 8), PS = cell / C;
  const wellBottom = SY - SH / 2 + 0.015, wellLeft = -3 * cell;
  const frameGlow = glow(0x6fd0ff, 0.7, 0); frameGlow.position.set(0, SY, 0.04); mon.add(frameGlow);

  // ambient rain of cubes inside the screen
  const rain = []; const rainGeo = new THREE.BoxGeometry(cell * 0.7, cell * 0.7, cell * 0.7);
  for (let i = 0; i < 5; i++) {
    const m = new THREE.Mesh(rainGeo, new THREE.MeshStandardMaterial({ color: PCS[i].c, emissive: PCS[i].c, emissiveIntensity: 0.9, transparent: true, opacity: 0 }));
    m.userData = { col: (i * 5 + 1) % 6, ph: i * 0.77, sp: 0.05 + (i % 3) * 0.02 }; m.position.z = 0.04; mon.add(m); rain.push(m);
  }

  // ---- pieces
  const hitGeo = new THREE.CylinderGeometry(0.1, 0.1, 0.08, 10);
  const hitMat = new THREE.MeshBasicMaterial({ visible: false });
  const pcs = PCS.map((p, i) => {
    const grp = new THREE.Group();
    const cc = V(p.cells.reduce((a, c) => a + c[0], 0) / 4 * C, p.cells.reduce((a, c) => a + c[1], 0) / 4 * C, 0);
    const mesh = new THREE.Mesh(pieceGeo(p, cc), glossy(p.c, { roughness: 0.22 })); mesh.castShadow = true; grp.add(mesh);
    const hit = new THREE.Mesh(hitGeo, hitMat); hit.rotation.x = Math.PI / 2; grp.add(hit); // generous touch area
    const b = badge(p.ic, p.c, 0.055); b.position.set(0, 0, C * 0.8); grp.add(b);
    const pos = V(TRAY[i][0], 0.034 + C * 0.5, TRAY[i][1]);
    grp.position.copy(pos); grp.rotation.x = -Math.PI / 2; g.add(grp);
    return { p, grp, i, pos, state: 'tray', t0: -9, cc, shake: -9, from: V(), to: V() };
  });
  const toTmp = V();
  const land = (o, out) => out.set(MON.x + wellLeft + cell / 2 + o.cc.x / C * cell, MON.y + wellBottom + cell / 2 + o.cc.y / C * cell, MON.z + 0.03);
  const hint = glow(0xffe08a, 0.2, 0); hint.renderOrder = 8; hint.material.depthTest = false; g.add(hint);
  // the card sheet covers the lower third of the screen (where the tray is): it must close by itself
  let cardT = 0;
  const showCard = (c, ms) => { ctx.ui.card(c); clearTimeout(cardT); cardT = setTimeout(() => ctx.ui.hideCard(), ms); };
  let nextI = 0, doneFlag = false, flash = -9, now = 0, flying = false;

  pcs.forEach((o0) => ctx.tap(o0.grp, () => {
    now = now || 0;
    if (o0.state !== 'tray') { ctx.sfx.pop?.(); showCard({ tag: 'مفهوم', title: o0.p.t, body: o0.p.n, color: o0.p.c }, 2200); return; }
    if (flying) return; // one piece at a time: ignore taps while a piece is in the air
    let o = o0;
    if (o.i !== nextI) { o.shake = now; o = pcs[nextI]; } // wrong piece: it shakes, the right one flies
    o.state = 'fly'; flying = true; o.t0 = now; o.from.copy(o.grp.position); land(o, o.to); ctx.sfx.whoosh?.();
    showCard({ tag: 'مفهوم', title: o.p.t, body: o.p.n, color: o.p.c }, 2200);
  }));
  ctx.ui.hud('المس القطع لتركّبها');

  return {
    update(t, dt, e) {
      now = t; rig.update(t, dt, e);
      const mk = stag(t, 0.3, 1.0, easeBack) * e; mon.scale.setScalar(Math.max(mk, 0.001)); mon.visible = mk > 0.01;
      frameGlow.material.opacity = (0.16 + 0.05 * Math.sin(t * 1.6)) * mk + clamp01(1 - (now - flash) / 1.2) * 0.5;
      const yTop = wellBottom + cell * 7.6, yBot = wellBottom + cell * 4.6;
      for (let i = 0; i < rain.length; i++) {
        const m = rain[i], u = m.userData, k = ((t * u.sp + u.ph) % 1);
        m.position.set(wellLeft + (u.col + 0.5) * cell, yTop - (yTop - yBot) * k, 0.04);
        m.rotation.z = t * 0.5 + u.ph; m.material.opacity = Math.sin(k * Math.PI) * 0.55 * mk * (doneFlag ? 0 : 1); m.visible = mk > 0.05;
      }
      for (let i = 0; i < pcs.length; i++) {
        const o = pcs[i];
        const p = stag(t, 0.8 + i * 0.2, 0.9, easeBack) * e;
        if (o.state === 'tray') {
          const sk = clamp01(1 - (now - o.shake) / 0.4);
          const act = o.i === nextI && t > 3.2;
          o.grp.position.set(o.pos.x + Math.sin(now * 55) * 0.008 * sk, o.pos.y + (act ? 0.012 + Math.sin(t * 3.5) * 0.008 : 0) + (1 - Math.min(p, 1)) * 0.2, o.pos.z);
          o.grp.scale.setScalar(Math.max(p, 0.001) * (act ? 1.06 : 1)); o.grp.visible = p > 0.01;
        } else if (o.state === 'fly') {
          const k = clamp01((now - o.t0) / 1.0), ek = ease(k);
          o.grp.position.lerpVectors(o.from, o.to, ek); o.grp.position.y += Math.sin(k * Math.PI) * 0.14;
          o.grp.rotation.x = -Math.PI / 2 * (1 - ek); o.grp.scale.setScalar(1 + (PS - 1) * ek);
          if (k >= 1) {
            o.state = 'placed'; flying = false; flash = now; ctx.sfx.good?.();
            toTmp.copy(o.to); ctx.fx.burst(g.localToWorld(toTmp), o.p.c, 22, 0.35, 0.025);
            nextI++;
            if (nextI >= pcs.length && !doneFlag) { doneFlag = true; setTimeout(() => { showCard({ tag: 'المعنى الجامع', title: 'الحياة تحاكي اللعبة', body: PCS[5].n, color: PCS[5].c }, 5000); ctx.ui.done(); }, 1800); }
          }
        } else { o.grp.position.copy(o.to); o.grp.scale.setScalar(PS); }
      }
      if (nextI < pcs.length && t > 3.2) {
        const o = pcs[nextI]; const k = clamp01((t - 3.2) / 0.6);
        hint.visible = true; hint.position.set(o.pos.x, o.pos.y + 0.03, o.pos.z); hint.material.opacity = (0.35 + 0.2 * Math.sin(t * 4)) * k; hint.scale.setScalar(0.2 + 0.02 * Math.sin(t * 4));
      } else hint.visible = false;
    },
  };
}
