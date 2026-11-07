import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { P, ease, easeBack, clamp01, stag, mat, glossy, goldMat, shadowed, glow, sprite } from '../../kit.js?v=16';
import { inked } from '../../pencil.js?v=16';
import { revealer, bumper, canvasTex, faceMat, setSpr, pulseHint, hintGlow, burstAt, retext } from '../lib/a6-kit.js?v=16';

export const meta = { free: true, center: [0.5, 0.76], typeLabel: 'مخطط ينمو' };

const CELL = 0.05, COLS = 8, ROWS = 6, WD = 0.09;
const W = COLS * CELL, H = ROWS * CELL, FY = 0.034;
const NODES = [
  { id: 'game', w: 'اللعب', tag: 'الأصل', c: 0x2a8fd0, cells: [[0, 0], [1, 0], [2, 0], [3, 0]], side: -1, lr: 0.4,
    b: 'مصطلح مشتق من كلمة Game، ويُعرف أيضاً باسم Ludification ويُترجم بالتلعيب أو اللوعبة.' },
  { id: 'gami', w: 'التلعيب', tag: 'المصطلح', c: 0xf2b630, cells: [[4, 0], [5, 0], [4, 1], [5, 1]], side: 0, pos: 'bottom',
    b: 'استخدام آليات وأطر الألعاب لتشجيع السلوكيات المرغوبة، أو استخدام عناصر تصميم اللعبة في غير سياق اللعبة.' },
  { id: 'mkt', w: 'التسويق', tag: 'أول ظهور', c: 0xd9483b, cells: [[1, 1], [2, 1], [3, 1], [2, 2]], side: -1, lr: 4.4,
    b: 'ظهر المصطلح أول ما ظهر في التسويق التجاري للترويج للعلامات التجارية، وأول استخدام موثّق له عام ٢٠٠٨.' },
  { id: 'edu', w: 'التعليم والتدريب', tag: 'ميدان', c: 0x4aa84f, cells: [[6, 0], [7, 0], [7, 1], [7, 2]], side: 1, lr: 1.2,
    b: 'انتقل المصطلح بعد التسويق إلى ميادين أخرى منها التعليم والتدريب.' },
  { id: 'med', w: 'الإعلام والصحة', tag: 'ميدان', c: 0x26b3b0, cells: [[4, 2], [5, 2], [5, 3], [6, 3]], side: 1, lr: 5.2,
    b: 'ومن الميادين التي انتقل إليها أيضاً الإعلام والصحة.' },
  { id: 'life', w: 'الحياة تحاكي اللعبة', tag: 'المعنى الجامع', c: 0x8e5bd0, cells: [[1, 3], [2, 3], [3, 3], [2, 4]], side: 0, pos: 'top',
    b: 'جعل الحياة الحقيقية تحاكي الألعاب، وليس جعل الألعاب تحاكي الحياة الحقيقية.' },
];
const bounce = (x) => { x = clamp01(x); const n = 7.5625, d = 2.75; if (x < 1 / d) return n * x * x; if (x < 2 / d) return n * (x -= 1.5 / d) * x + 0.75; if (x < 2.5 / d) return n * (x -= 2.25 / d) * x + 0.9375; return n * (x -= 2.625 / d) * x + 0.984375; };
const hx = (c) => '#' + c.toString(16).padStart(6, '0');

export default function build(ctx) {
  const g = new THREE.Group(); g.position.copy(P(meta.center[0], meta.center[1])); g.scale.setScalar(1.05); ctx.stage.add(g);
  const R = revealer(), B = bumper();

  // a glass Tetris well standing on its own tray; no plinth, the print stays visible around it
  const tray = inked(new RoundedBoxGeometry(W + 0.07, 0.034, WD + 0.07, 3, 0.012), { color: 0x2f6fb8 }); tray.position.y = 0.017; g.add(tray); R.add(tray, 0.1, 0.9);
  const posts = [[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([sx, sz], i) => {
    const p = new THREE.Mesh(new THREE.CylinderGeometry(0.0125, 0.0125, H + 0.05, 14), goldMat()); p.position.set(sx * (W / 2 + 0.014), FY + (H + 0.05) / 2 - 0.01, sz * (WD / 2 + 0.014)); g.add(p); return p;
  });
  const topRail = inked(new RoundedBoxGeometry(W + 0.07, 0.026, WD + 0.07, 3, 0.01), { color: 0xf7f2e7 }); topRail.position.y = FY + H + 0.03; g.add(topRail); R.add(topRail, 0.3, 0.9);
  const gridTex = canvasTex(256, 352, (c, w, h) => {
    const gr = c.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#1a2c4b'); gr.addColorStop(1, '#0e1a30'); c.fillStyle = gr; c.fillRect(0, 0, w, h);
    c.strokeStyle = 'rgba(130,180,240,.22)'; c.lineWidth = 1.5;
    for (let i = 1; i < COLS; i++) { c.beginPath(); c.moveTo((i * w) / COLS, 0); c.lineTo((i * w) / COLS, h); c.stroke(); }
    for (let j = 1; j < ROWS; j++) { c.beginPath(); c.moveTo(0, (j * h) / ROWS); c.lineTo(w, (j * h) / ROWS); c.stroke(); }
  });
  const back = new THREE.Mesh(new THREE.PlaneGeometry(W, H), faceMat(gridTex, { transparent: true, opacity: 0 })); back.position.set(0, FY + H / 2, -WD / 2 + 0.002); g.add(back);
  const backB = new THREE.Mesh(new THREE.PlaneGeometry(W, H), new THREE.MeshBasicMaterial({ color: 0x0e1a30, side: THREE.BackSide })); backB.position.copy(back.position).setZ(-WD / 2 + 0.001); g.add(backB);
  const glassM = new THREE.MeshPhysicalMaterial({ color: 0xcfe6ff, roughness: 0.05, transparent: true, opacity: 0.09, depthWrite: false, side: THREE.DoubleSide });
  const glassF = new THREE.Mesh(new THREE.PlaneGeometry(W, H), glassM); glassF.position.set(0, FY + H / 2, WD / 2 + 0.002); g.add(glassF);
  [-1, 1].forEach((s) => { const gs = new THREE.Mesh(new THREE.PlaneGeometry(WD, H), glassM); gs.rotation.y = Math.PI / 2; gs.position.set(s * (W / 2 + 0.002), FY + H / 2, 0); g.add(gs); });

  const cellGeo = new RoundedBoxGeometry(CELL * 0.95, CELL * 0.95, WD * 0.86, 2, 0.006);
  const wx = (c) => -W / 2 + (c + 0.5) * CELL, wy = (r) => FY + (r + 0.5) * CELL;
  const pieces = NODES.map((n) => {
    const holder = new THREE.Group(); g.add(holder);
    const cx = n.cells.reduce((s, c) => s + wx(c[0]), 0) / 4, cy = n.cells.reduce((s, c) => s + wy(c[1]), 0) / 4;
    holder.position.set(cx, cy, 0); holder.userData.rest = new THREE.Vector3(cx, cy, 0);
    const inner = new THREE.Group(); holder.add(inner);
    const m = glossy(n.c, { emissive: n.c, emissiveIntensity: 0.14 });
    n.cells.forEach(([c, r]) => { const b = new THREE.Mesh(cellGeo, m); b.position.set(wx(c) - cx, wy(r) - cy, 0); inner.add(b); });
    shadowed(inner);
    const halo = glow(n.c, 0.2, 0); halo.position.set(0, 0, WD * 0.5); inner.add(halo);
    const hint = hintGlow(n.c, 0.17); hint.position.set(0, 0, WD * 0.5 + 0.012); inner.add(hint);
    return { n, holder, inner, halo, hint, landed: false, lift: 0 };
  });

  const lab = sprite('اللعب', 0.26, { size: 46, width: 420, weight: 800, border: '#2a8fd0', color: '#2b2620', bg: 'rgba(251,248,240,.98)' }); g.add(lab);
  let labT = -9, labW = 0.26;
  let now = 0, touched = new Set(), sel = -1, done = false;
  const landAt = (i) => 0.9 + i * 0.8;
  function touch(i) {
    const p = pieces[i]; if (now < landAt(i) + 0.9) return;
    sel = i; touched.add(i); ctx.sfx.pop?.(); B.hit(p.inner, now, 0.1);
    burstAt(ctx, g, new THREE.Vector3(p.holder.position.x, p.holder.position.y + 0.03, 0.06), p.n.c, 24, 0.38, 0.034);
    labT = now; retext(lab, p.n.w, p.n.w.length > 12 ? 0.34 : 0.26, { size: 46, width: p.n.w.length > 12 ? 540 : 420, weight: 800, border: hx(p.n.c), color: '#2b2620', bg: 'rgba(251,248,240,.98)' }); labW = p.n.w.length > 12 ? 0.34 : 0.26; lab.position.set(p.holder.position.x, FY + H + 0.1, 0.05);
    ctx.ui.card({ tag: p.n.tag, title: p.n.w, body: p.n.b, color: p.n.c });
    if (touched.size === NODES.length && !done) { done = true; setTimeout(() => { ctx.sfx.good?.(); ctx.ui.done(); }, 1500); }
  }
  pieces.forEach((p, i) => ctx.tap(p.inner, () => touch(i)));
  ctx.ui.hud('المس القطع لتعرف كيف انتقل التلعيب');

  return {
    update(t, dt, e) {
      now = t; R.update(t, e); B.update(t);
      back.material.opacity = stag(t, 0.5, 0.6) * e;
      posts.forEach((p, i) => { p.scale.set(1, Math.max(stag(t, 0.2 + i * 0.08, 0.6, easeBack) * e, 0.001), 1); });
      pieces.forEach((p, i) => {
        const k = clamp01((t - landAt(i) + 0.8) / 0.8);
        p.holder.visible = k > 0 && e > 0.01;
        const home = p.holder.userData.rest;
        p.lift = THREE.MathUtils.damp(p.lift, sel === i ? 0.045 : 0, 6, dt);
        p.holder.position.set(home.x, home.y + (1 - bounce(k)) * 0.6 * e, home.z + p.lift);
        const landed = k >= 1; if (landed && !p.landed) { p.landed = true; ctx.sfx.pop?.(); }
        const seen = touched.has(i), on = sel === i;
        p.halo.material.opacity = (on ? 0.65 : seen ? 0.2 : 0) * (0.8 + 0.2 * Math.sin(t * 4));
        pulseHint(p.hint, t, i * 1.4, landed && !seen ? 1 : 0, 0.3);
      });
      const lkk = t - labT < 3.5 ? stag(t, labT, 0.4, easeBack) : Math.max(0, 1 - (t - labT - 3.5) / 0.4); setSpr(lab, labW, lkk * e);
      pieces[5].inner.children.forEach((c) => { if (c.isMesh) c.material.emissiveIntensity = 0.2 + 0.14 * Math.sin(t * 2.5); });
    },
  };
}
