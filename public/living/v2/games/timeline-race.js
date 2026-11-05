// timeline-race: events are tapped onto an axis while a light runner crosses it; wrong placements cost seconds.
import { V, COL, toAr, clamp, damp, tube, orb, inkLine, circlePts, shuffle, panel, THREE } from './toolkit.js';

export function timelineRace(G) {
  const d = G.spec.data, E = d.events, N = E.length;
  const ranks = [...new Set(E.map((e) => e.rank))].sort((a, b) => a - b);
  const slotOf = (e) => ranks.indexOf(e.rank);
  const T0 = d.seconds || N * 13 + 10, PEN = 4;
  const X0 = 0.4, X1 = -0.4, sp = (X0 - X1) / (N - 1), SX = (k) => X0 - k * sp, AZ = 0.0;
  const w = Math.min(0.25, sp * 2 - 0.015);

  G.tok(d.brief, 0.86, COL.gold, { fs: 0.0182 }, 0, -0.468, 0, 0.3);
  G.draw(panel(0.9, 0.34, { opacity: 0.45 }), 0).position.set(0, 0, AZ);
  const axis = G.lt(tube([V(X0 + 0.04, 0.006, AZ), V(X1 - 0.04, 0.006, AZ)], COL.blue, { radius: 0.0045, speed: 0.4 }));
  G.draw(inkLine([V(X0 + 0.04, 0.002, AZ), V(X1 - 0.04, 0.002, AZ)], { r: 0.0012, opacity: 0.5 }), 0.4, 1.2);
  const runner = orb(COL.rose, 0.07); G.add(runner);

  const slots = Array.from({ length: N }, (_, k) => {
    const g = new THREE.Group(); g.position.set(SX(k), 0, AZ);
    const hit = new THREE.Mesh(new THREE.CircleGeometry(0.036, 24), new THREE.MeshBasicMaterial({ color: COL.gold, transparent: true, opacity: 0.0, depthWrite: false })); hit.rotation.x = -Math.PI / 2; hit.position.y = 0.004; g.add(hit);
    const ring = inkLine(circlePts(0, 0, 0.022, 0.005, 28), { r: 0.0018 }); g.add(ring);
    g.userData.reveal = (p) => ring.userData.reveal(p);
    G.draw(g, 0.6 + k * 0.1, 0.7);
    const num = G.tok(toAr(k + 1), 0.04, COL.slate, { slab: false, border: false, fs: 0.018, halo: false, weight: 800 }, SX(k), AZ, 0.006, 1.0 + k * 0.08);
    const o = { g, hit, ring, k, filled: null, num };
    G.tap(g, () => tapSlot(o), 'slot ' + (k + 1));
    return o;
  });

  const disp = shuffle(E.map((_, i) => i), 9);
  const evs = E.map((e, i) => {
    const T = G.tok(e.t, w, COL.slate, { fs: 0.0158, glow: 0.12, sub: '\u00a0', subFs: 0.0145 }, 0, 0, 0, 0.9 + disp.indexOf(i) * 0.1);
    const o = { T, e, i, placed: false, stem: null };
    G.tap(T, () => tapEv(o), e.t.slice(0, 30));
    return o;
  });
  const per = Math.ceil(N / 2);
  disp.forEach((i, n) => {
    const o = evs[i], r = Math.floor(n / per), c = n % per, cnt = Math.min(per, N - r * per);
    o.home = V(((cnt - 1) / 2 - c) * (w + 0.018), 0, 0.345 + r * 0.115); o.T.snap(o.home.x, 0, o.home.z);
  });

  // stopwatch dial
  const dial = new THREE.Group(); dial.position.set(-0.37, 0, -0.34);
  dial.add(inkLine(circlePts(0, 0, 0.05, 0.004, 40), { r: 0.0018 }));
  const hand = new THREE.Mesh(new THREE.BoxGeometry(0.044, 0.003, 0.003), new THREE.MeshBasicMaterial({ color: COL.rose, toneMapped: false })); hand.position.y = 0.007; const hp = new THREE.Group(); hp.add(hand); hand.position.x = 0.022; dial.add(hp); hp.position.y = 0.007;
  dial.userData.reveal = (p) => dial.children[0].userData.reveal(p); G.draw(dial, 0.8, 0.8);

  let state = 'idle', elapsed = 0, shownE = 0, selE = null, selS = null, mistakes = 0, placed = 0;
  const left = () => Math.max(0, T0 - elapsed);
  const hud = () => G.hud(state === 'play' ? `${toAr(Math.ceil(left()))} ث  ·  ${toAr(placed)} / ${toAr(N)}  ·  أخطاء ${toAr(mistakes)}` : `${toAr(N)} أحداث  ·  ${toAr(T0)} ثانية`);

  function idle() {
    state = 'idle'; elapsed = 0; shownE = 0; selE = selS = null; mistakes = 0; placed = 0;
    evs.forEach((o) => { o.placed = false; o.T.restyle({ color: COL.slate, sub: '\u00a0' }); o.T.glowGoal = 0.12; o.T.to(o.home.x, 0, o.home.z, 8); if (o.stem) { G.root.remove(o.stem); o.stem = null; } });
    slots.forEach((s) => { s.filled = null; });
    hud(); G.buttons([{ label: 'ابدأ السباق', primary: true, onPick: () => { state = 'play'; G.sfx('whoosh'); hud(); G.buttons([]); } }]);
  }
  function deselect() { if (selE && !selE.placed) { selE.T.glowGoal = 0.12; selE.T.goal.y = 0; } selE = null; selS = null; slots.forEach((s) => { if (!s.filled) s.hit.material.opacity = 0; }); }
  function tapEv(o) {
    if (state === 'idle') { G.toast('اضغط «ابدأ السباق» أولاً'); return; }
    if (state !== 'play' || o.placed) return;
    G.sfx('tap');
    if (selS) { const s = selS; deselect(); attempt(o, s); return; }
    if (selE === o) { deselect(); return; }
    deselect(); selE = o; o.T.glowGoal = 1; o.T.goal.y = 0.03;
  }
  function tapSlot(s) {
    if (state === 'idle') { G.toast('اضغط «ابدأ السباق» أولاً'); return; }
    if (state !== 'play' || s.filled) return;
    G.sfx('tap');
    if (selE) { const o = selE; deselect(); attempt(o, s); return; }
    selS = s; s.hit.material.opacity = 0.35;
  }
  function attempt(o, s) {
    if (slotOf(o.e) === s.k) {
      o.placed = true; s.filled = o; placed++;
      const up = s.k % 2 === 0, z = AZ + (up ? -1 : 1) * (0.07 + o.T.h / 2 + 0.03);
      o.T.restyle({ color: COL.green, sub: o.e.when }); o.T.sub = o.e.when; o.T.glowGoal = 0.8; o.T.to(SX(s.k), 0.01, z, 9);
      o.stem = inkLine([V(SX(s.k), 0.004, AZ + (up ? -0.026 : 0.026)), V(SX(s.k), 0.004, z + (up ? 1 : -1) * (o.T.h / 2))], { r: 0.0017, opacity: 0.8 }); G.add(o.stem); o.stem.userData.reveal(1);
      s.ring.material.color.setHex(COL.green); G.sparks(V(SX(s.k), 0.04, AZ), COL.green, 10, 0.12, 0.028); G.sfx('good');
      hud(); if (placed === N) finish(true);
    } else {
      mistakes++; elapsed += PEN; G.sfx('bad'); G.shake(o.T, 0.012, 0.45);
      o.T.restyle({ color: COL.red }); o.T.glowGoal = 0.9; G.after(0.7, () => { if (!o.placed) { o.T.restyle({ color: COL.slate }); o.T.glowGoal = 0.12; } });
      G.toast(`ليس هنا، خسرت ${toAr(PEN)} ثوانٍ`); hud();
    }
  }
  function finish(win) {
    state = 'over'; deselect();
    if (!win) evs.filter((o) => !o.placed).forEach((o) => {
      const s = slots[slotOf(o.e)], up = s.k % 2 === 0, z = AZ + (up ? -1 : 1) * (0.07 + o.T.h / 2 + 0.03);
      o.T.restyle({ color: COL.amber, sub: o.e.when }); o.T.sub = o.e.when; o.T.glowGoal = 0.8; o.T.to(SX(s.k), 0.01, z, 5);
    });
    const secs = Math.round(elapsed);
    const order = [...E].sort((a, b) => a.rank - b.rank).map((e) => e.when).join(' ← ');
    G.end({
      pct: win ? clamp(0.5 * (left() / T0) + 0.5 * (1 - mistakes / (N * 1.5)), 0.45, 1) : (placed / N) * 0.5,
      title: win ? `رتّبت ${toAr(N)} أحداث في ${toAr(secs)} ثانية` : `انتهى الوقت وثبتت ${toAr(placed)} من ${toAr(N)}`,
      body: `التسلسل الصحيح: ${order}. أخطاؤك: ${toAr(mistakes)}.`, color: COL.blue, again: idle,
      lines: ['التسلسل التاريخي يُحفظ بفهم العلاقة بين الحدث وما قبله، لا بحفظ التواريخ منفصلة.', 'عرفت الإطار العام وبقيت تفاصيل في الترتيب.', 'ترتيب جيّد.', 'ترتيب سريع ودقيق للتسلسل.'],
    });
    hud();
  }

  G.ups.push((t, dt) => {
    if (state === 'play') { elapsed += dt; if (Math.ceil(left()) !== Math.ceil(left() + dt)) hud(); if (left() <= 0) finish(false); }
    const idleK = (Math.sin(t * 0.6) * 0.5 + 0.5) * 0.35;
    const target = state === 'idle' ? idleK : clamp(elapsed / T0, 0, 1);
    shownE = damp(shownE, target, 6, dt);
    const x = lerpX(shownE);
    const on = clamp((t - 0.6) / 1, 0, 1);
    runner.position.set(x, 0.03 + Math.sin(t * 4) * 0.004, AZ); runner.visible = on > 0.05;
    axis.userData.fill(on);
    hp.rotation.y = -shownE * Math.PI * 2;
    slots.forEach((s) => { if (selS === s) s.hit.material.opacity = 0.25 + Math.sin(t * 6) * 0.1; });
  });
  const lerpX = (k) => X0 + 0.03 - k * (X0 - X1 + 0.06);
  idle();
  return {};
}
