// assemble: pieces are tapped from a tray onto a staircase of ghost platforms; a structure only stands in the right order.
import { V, COL, toAr, clamp, damp, stag, tube, inkLine, sketch, RoundedBoxGeometry, shuffle, panel, THREE } from './toolkit.js';

export function assemble(G) {
  const d = G.spec.data, labels = d.slots, N = labels.length;
  let order = d.order;
  if (!order || order.length !== N || new Set(order).size !== N) order = labels.map((_, i) => i);
  const MAXC = 3;
  const SX = -0.13, spacing = 0.58 / (N - 1), dep = Math.min(0.1, spacing * 0.94);
  const zOf = (k) => 0.3 - k * spacing, yOf = (k) => k * 0.028;

  G.tok(d.brief, 0.86, COL.gold, { fs: 0.0182 }, 0, -0.468, 0, 0.3);
  G.draw(panel(0.5, 0.74, { opacity: 0.4 }), 0).position.set(SX, 0, 0.0);

  const plats = Array.from({ length: N }, (_, k) => {
    const s = sketch(new RoundedBoxGeometry(0.5, 0.02, dep, 2, 0.004), { color: 0xfcf9f1, width: 1.4 });
    s.position.set(SX, yOf(k) + 0.01, zOf(k)); G.add(s);
    const num = G.tok(toAr(k + 1), 0.05, COL.slate, { slab: false, border: false, fs: 0.02, halo: false, weight: 800 }, SX + 0.22, zOf(k), yOf(k) + 0.022, 1.0 + k * 0.1);
    G.tap(s, () => tapSlot(k), 'slot ' + (k + 1));
    return { s, k, p: 0, locked: false, num };
  });
  const climbPts = Array.from({ length: N }, (_, k) => V(SX - 0.28, yOf(k) + 0.02, zOf(k)));
  const climb = G.lt(tube(climbPts, COL.teal, { radius: 0.005, speed: 0.5 })); climb.userData.fill(0);
  G.draw(inkLine(climbPts, { r: 0.0013, opacity: 0.4 }), 0.6, 1.2);

  const disp = shuffle(labels.map((_, i) => i), 11);
  const pieces = labels.map((text, i) => {
    const T = G.tok(text, 0.34, COL.slate, { fs: 0.0165, glow: 0.12 }, 0, 0, 0, 0.8 + disp.indexOf(i) * 0.1);
    const pc = { T, i, slot: -1, locked: false };
    G.tap(T, () => tapPiece(pc), text.slice(0, 30));
    return pc;
  });
  let zc = -0.4;
  disp.forEach((i) => { const pc = pieces[i]; pc.home = V(0.3, 0.0, zc + pc.T.h / 2); pc.T.snap(pc.home.x, 0, pc.home.z); zc += pc.T.h + 0.014; });

  let state = 'idle', sel = null, tries = 0;
  const occ = Array(N).fill(null);
  const placed = () => occ.filter(Boolean).length;
  function hud() { G.hud(state === 'over' ? 'انتهى البناء' : state === 'play' ? `القطع المثبتة ${toAr(placed())} / ${toAr(N)}  ·  القياسات المتبقية ${toAr(MAXC - tries)}` : `${toAr(N)} قطع  ·  ${toAr(MAXC)} قياسات`); }
  function goHome(pc) { pc.T.to(pc.home.x, 0, pc.home.z, 8); pc.T.glowGoal = 0.12; pc.slot = -1; }
  function put(pc, k) { pc.slot = k; occ[k] = pc; pc.T.to(SX, yOf(k) + 0.022, zOf(k), 9); pc.T.glowGoal = 0.35; }
  function select(pc) { if (sel) { sel.T.glowGoal = sel.slot >= 0 ? 0.35 : 0.12; if (sel.slot < 0) sel.T.goal.y = 0; } sel = pc; if (pc) { pc.T.glowGoal = 1; if (pc.slot < 0) pc.T.goal.y = 0.03; } }
  function buttons() {
    G.buttons(placed() === N ? [{ label: 'تحقّق من البناء', primary: true, onPick: check }] : []);
  }
  function tapPiece(pc) {
    if (state === 'idle') { G.toast('اضغط «ابدأ البناء» أولاً'); return; }
    if (state !== 'play' || pc.locked) return;
    G.sfx('tap');
    if (pc.slot >= 0) { occ[pc.slot] = null; goHome(pc); select(pc); buttons(); hud(); return; }
    select(sel === pc ? null : pc);
  }
  function tapSlot(k) {
    if (state === 'idle') { G.toast('اضغط «ابدأ البناء» أولاً'); return; }
    if (state !== 'play' || plats[k].locked) return;
    const cur = occ[k];
    if (!sel) { if (cur) { occ[k] = null; goHome(cur); select(cur); buttons(); hud(); } return; }
    if (cur) { occ[k] = null; goHome(cur); }
    const pc = sel; select(null); put(pc, k); G.sfx('click'); G.sparks(V(SX, yOf(k) + 0.03, zOf(k)), COL.gold, 6, 0.1, 0.02);
    buttons(); hud();
  }
  function idle() {
    state = 'idle'; tries = 0; sel = null;
    pieces.forEach((pc) => { pc.locked = false; pc.slot = -1; pc.T.restyle({ color: COL.slate }); goHome(pc); pc.T.dim = 1; });
    occ.fill(null); plats.forEach((p) => { p.locked = false; }); hud();
    G.buttons([{ label: 'ابدأ البناء', primary: true, onPick: () => { state = 'play'; G.sfx('whoosh'); hud(); buttons(); } }]);
  }
  function check() {
    if (state !== 'play' || placed() < N) return;
    tries++; let ok = 0;
    occ.forEach((pc, k) => {
      const good = pc.i === order[k];
      if (good) { ok++; pc.locked = true; plats[k].locked = true; pc.T.restyle({ color: COL.green }); pc.T.glowGoal = 0.9; G.sparks(V(SX, yOf(k) + 0.04, zOf(k)), COL.green, 8, 0.12, 0.025); }
      else { pc.T.restyle({ color: COL.red }); pc.T.glowGoal = 0.9; G.shake(pc.T, 0.012, 0.5); G.after(1.3, () => { if (!pc.locked) { pc.T.restyle({ color: COL.slate }); pc.T.glowGoal = 0.35; } }); }
    });
    climb.userData.fill(0);
    if (ok === N) { state = 'over'; G.sfx('good'); G.end({ pct: tries === 1 ? 1 : tries === 2 ? 0.8 : 0.6, title: tries === 1 ? 'بناء صحيح من المحاولة الأولى' : `بناء صحيح بعد ${toAr(tries)} قياسات`, body: d.why, color: COL.violet, again: idle }); hud(); return; }
    G.sfx('bad');
    if (tries >= MAXC) {
      state = 'over';
      G.after(1.4, () => {
        order.forEach((pi, k) => { const pc = pieces[pi]; if (pc.slot >= 0 && occ[pc.slot] === pc) occ[pc.slot] = null; });
        order.forEach((pi, k) => { const pc = pieces[pi]; occ[k] = pc; pc.slot = k; pc.locked = true; pc.T.restyle({ color: COL.green }); pc.T.to(SX, yOf(k) + 0.022, zOf(k), 6); pc.T.glowGoal = 0.8; plats[k].locked = true; });
        G.end({ pct: (ok / N) * 0.5, title: `ثبت ${toAr(ok)} من ${toAr(N)} قطع فقط`, body: 'رتّبتُ لك القطع على الصورة الصحيحة. ' + d.why, color: COL.red, again: idle });
      });
    } else {
      G.toast(`ثبتت ${toAr(ok)} من ${toAr(N)}؛ أعد ترتيب القطع الحمراء`);
      G.buttons([]);
    }
    hud();
  }

  G.ups.push((t, dt) => {
    plats.forEach((p) => {
      p.p = damp(p.p, p.locked ? 1 : occ[p.k] ? 0.8 : 0.62, 6, dt);
      p.s.userData.reveal(Math.min(stag(t, 0.5 + p.k * 0.12, 0.9), p.p));
    });
    const lockedN = plats.filter((p) => p.locked).length;
    climb.userData.fill(clamp((t - 0.6) / 1.2, 0, 1) * (state === 'idle' ? 0.12 + 0.1 * Math.sin(t * 1.2) : clamp(lockedN / N, 0.02, 1)));
    if (state === 'idle') pieces.forEach((pc, i) => { pc.T.goal.y = 0.004 + Math.sin(t * 1.5 + i) * 0.004; });
    if (state === 'play' && sel && sel.slot < 0) sel.T.goal.y = 0.03 + Math.sin(t * 5) * 0.005;
  });
  idle();
  return {};
}
