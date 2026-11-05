// speed-sort: statements fall down the page toward two bins; a light fuse burns down above them.
import { V, COL, css, toAr, shuffle, clamp, damp, tube, orb, inkLine, rectPts, panel, THREE } from './toolkit.js';

function dashes(x0, x1, z, n = 16) {
  const g = new THREE.Group(); const L = [];
  for (let i = 0; i < n; i++) {
    const a = x0 + ((x1 - x0) * i) / n, b = a + ((x1 - x0) / n) * 0.55;
    const l = inkLine([V(a, 0.003, z), V(b, 0.003, z)], { r: 0.0015, opacity: 0.55 }); L.push(l); g.add(l);
  }
  g.userData.reveal = (p) => L.forEach((l, i) => l.userData.reveal(clamp(p * 1.6 - (i / n) * 0.6, 0, 1)));
  g.userData.reveal(0);
  return g;
}

export function speedSort(G) {
  const { spec } = G; const d = spec.data;
  const items = d.items, bins = d.bins, N = items.length, SEC = d.seconds || 45;
  const binCol = [COL.blue, COL.amber];
  const ZTOP = -0.33, ZLINE = 0.16, FALL = 9;
  const binPos = (i) => V(i === 0 ? 0.215 : -0.215, 0, 0.365);

  G.draw(panel(0.9, 0.56, { opacity: 0.55 }), 0).position.set(0, 0, -0.05);
  G.tok('القاعدة: ' + d.rule, 0.86, COL.gold, { fs: 0.0185 }, 0, -0.455, 0, 0.3);
  G.draw(dashes(-0.43, 0.43, ZLINE), 0.8);

  // the fuse: a light tube that burns from right to left
  const fuseCurve = [V(-0.42, 0.008, -0.385), V(0.42, 0.008, -0.385)];
  const fuse = G.lt(tube(fuseCurve, COL.amber, { radius: 0.0065 }));
  const spark = orb(0xffb347, 0.075); spark.position.copy(fuseCurve[1]); G.add(spark);
  const tray = G.draw(inkLine([V(-0.425, 0.002, -0.385), V(0.425, 0.002, -0.385)], { r: 0.0013, opacity: 0.5 }), 0.4);

  const binT = bins.map((name, i) => {
    const T = G.tok(name, 0.38, binCol[i], { th: 0.03, fs: 0.0215, title: true, sub: '✓ ٠', glow: 0.4 }, binPos(i).x, binPos(i).z, binPos(i).y, 0.5 + i * 0.2);
    G.tap(T, () => sort(i));
    return T;
  });

  let state = 'idle', left = SEC, ok = 0, streak = 0, best = 0, nextIdx = 0, nextAt = 0, order = [], live = [], all = [], wrong = [], missed = [], tally = [0, 0], fuseP = 0;
  let previews = [];

  function hud() { G.hud(state === 'play' ? `${toAr(Math.ceil(left))} ث  ·  صحيح ${toAr(ok)} / ${toAr(N)}  ·  تتابع ${toAr(streak)}` : `${toAr(N)} مفردة  ·  ${toAr(SEC)} ثانية`); }
  function idle() {
    state = 'idle'; left = SEC; hud();
    previews.forEach((T) => G.drop(T)); previews = [];
    shuffle(items.map((_, i) => i), 3).slice(0, 2).forEach((i, k) => {
      const T = G.tok(items[i].t, 0.34, COL.gold, { fs: 0.0185 }, 0, -0.2 + k * 0.17, 0.02, 1.0 + k * 0.3); T.ph = k * 2.1; previews.push(T);
    });
    G.buttons([{ label: 'ابدأ الفرز', primary: true, onPick: start }]);
  }
  function start() {
    previews.forEach((T) => G.drop(T)); previews = [];
    all.forEach((a) => G.drop(a.T)); all = []; live = [];
    state = 'play'; left = SEC; ok = 0; streak = 0; best = 0; nextIdx = 0; nextAt = G.now + 0.2; wrong = []; missed = []; tally = [0, 0];
    order = shuffle(items.map((_, i) => i), (G.now * 1000) | 0);
    binT.forEach((T, i) => T.restyle({ sub: '✓ ٠' }));
    G.hideCard(); G.sfx('whoosh');
    G.buttons([{ label: bins[0], color: css(binCol[0]), onPick: () => sort(0) }, { label: bins[1], color: css(binCol[1]), onPick: () => sort(1) }]);
    hud();
  }
  function spawn() {
    const idx = order[nextIdx++];
    const T = G.tok(items[idx].t, 0.34, COL.gold, { fs: 0.0185 }, 0, ZTOP, 0.02, G.now); T.goal = null;
    const a = { T, idx, born: G.now, state: 'fall', ph: Math.random() * 6, jx: (Math.random() - 0.5) * 0.14 };
    live.push(a); all.push(a); nextAt = G.now + Math.max(1.6, Math.min(4, (SEC - FALL) / N));
  }
  const active = () => live.filter((a) => a.state === 'fall').sort((a, b) => a.born - b.born)[0];
  function pulse(T, color, back) { T.haloMat.color.setHex(color); T.glow = 1; G.after(0.6, () => { T.haloMat.color.setHex(back); }); }
  function sort(b) {
    if (state !== 'play') { if (state === 'idle') G.toast('اضغط «ابدأ الفرز» أولاً'); return; }
    const a = active(); if (!a) return;
    a.state = 'fly';
    const good = items[a.idx].bin === b;
    const to = binPos(b).clone(); to.y = 0.06;
    G.sfx('click');
    G.fly(a.T.g, to, 0.4, 0.1, () => {
      pulse(binT[b], good ? COL.green : COL.red, binCol[b]);
      G.sparks(to, good ? COL.green : COL.red, good ? 14 : 10);
      if (good) {
        ok++; streak++; best = Math.max(best, streak); tally[b]++; binT[b].restyle({ sub: '✓ ' + toAr(tally[b]) }); G.sfx('good');
        G.anim(0.35, (p) => { a.T.dim = 1 - p; a.T.g.position.y = 0.06 - p * 0.03; }, () => { a.state = 'done'; settle(a); });
      } else {
        streak = 0; wrong.push(a.idx); G.sfx('bad'); G.shake(binT[b], 0.01, 0.4);
        a.T.restyle({ color: COL.red });
        G.after(0.25, () => {
          const to2 = binPos(1 - b).clone(); to2.y = 0.06;
          G.fly(a.T.g, to2, 0.5, 0.12, () => {
            a.T.restyle({ color: COL.green }); pulse(binT[1 - b], COL.green, binCol[1 - b]);
            G.anim(0.45, (p) => { a.T.dim = 1 - p; }, () => { a.state = 'done'; settle(a); });
          });
        });
        G.toast('✗ تنتمي إلى «' + bins[items[a.idx].bin] + '»');
      }
      hud(); check();
    });
    hud();
  }
  function settle(a) { live = live.filter((x) => x !== a); a.T.hidden = true; check(); }
  function check() { if (state === 'play' && nextIdx >= N && live.length === 0) finish(false); }
  function finish(timeout) {
    if (state !== 'play') return;
    state = 'over';
    const unsorted = N - ok - wrong.length - missed.length;
    live.forEach((a) => { a.T.dim = 0.35; });
    const lost = [...wrong, ...missed];
    const note = lost.length ? ` أبرز ما التبس عليك: ${lost.slice(0, 3).map((i) => `«${items[i].t}» تنتمي إلى «${bins[items[i].bin]}»`).join('؛ ')}.` : ' لم يلتبس عليك شيء.';
    G.final = null;
    G.end({
      pct: ok / N,
      title: `${toAr(ok)} من ${toAr(N)} مفردة صُنّفت صحيحًا${timeout && unsorted > 0 ? ' قبل نفاد الوقت' : ''}`,
      body: `القاعدة التي حكمت الفرز: ${d.rule}.${note} أطول تتابع صحيح: ${toAr(best)}.`,
      color: COL.amber, again: idle,
      lines: ['الفرز السريع يكشف ما تحفظه آلياً وما تفهمه؛ ارجع إلى الفرق بين الفئتين ثم أعد المحاولة.', 'اقتربت من الإتقان، والتباس الحالات الحدّية هو ما يستحق المراجعة.', 'فرز جيّد؛ ركّز على الحالات التي تتشابه ظاهراً وتختلف في المعنى.', 'فرز دقيق وسريع: الفئتان واضحتان في ذهنك.'],
    });
    G.hud(`انتهى الفرز  ·  ${toAr(ok)} / ${toAr(N)}`);
  }

  G.ups.push((t, dt) => {
    // idle motion: the fuse flickers and previews sway before the first tap
    const ratio = state === 'play' ? left / SEC : 1;
    fuseP = damp(fuseP, ratio, 10, dt);
    const reveal = clamp((t - 0.5) / 0.9, 0, 1);
    fuse.userData.fill(Math.min(reveal, fuseP));
    const pt = fuse.userData.curve.getPoint(Math.min(reveal, fuseP));
    spark.position.copy(pt); spark.position.y = 0.012;
    spark.userData.s.scale.setScalar(0.07 + Math.sin(t * 22) * 0.012 + (state === 'play' && left < 8 ? Math.sin(t * 40) * 0.012 : 0));
    spark.visible = reveal > 0.01 && fuseP > 0.01;
    fuse.userData.paint(left < 0.2 * SEC && state === 'play' ? COL.red : COL.amber);
    previews.forEach((T) => { T.g.position.x = Math.sin(t * 0.9 + T.ph) * 0.08; T.g.position.y = 0.02 + Math.sin(t * 1.7 + T.ph) * 0.006; T.glowGoal = 0.3; });
    binT.forEach((T, i) => { if (T.glowGoal !== undefined) T.glowGoal = 0.4 + Math.sin(t * 1.6 + i * 2) * 0.12; });
    if (state !== 'play') return;
    left = Math.max(0, left - dt);
    if (Math.ceil(left) !== Math.ceil(left + dt)) hud();
    const noneFalling = !live.some((a) => a.state === 'fall');
    if (nextIdx < N && (t >= nextAt || noneFalling)) spawn();
    const act = active();
    const v = (ZLINE - ZTOP) / FALL;
    live.forEach((a) => {
      if (a.state === 'fall') {
        const z = ZTOP + (t - a.born) * v;
        a.T.g.position.set(a.jx + Math.sin(t * 1.2 + a.ph) * 0.03, 0.02 + Math.sin(t * 2.2 + a.ph) * 0.004, z);
        a.T.glowGoal = a === act ? 1 : 0.2;
        if (z > ZLINE + 0.02) { // crossed the line without being sorted
          a.state = 'miss'; missed.push(a.idx); streak = 0; a.T.restyle({ color: COL.red }); G.sfx('bad'); hud();
          G.toast('فاتتك: «' + items[a.idx].t.slice(0, 28) + '»');
          G.anim(0.8, (p) => { a.T.g.position.z += 0.2 * G.dt; a.T.g.position.y = 0.02 - p * 0.05; a.T.dim = 1 - p; }, () => { a.state = 'done'; settle(a); });
        }
      }
    });
    if (left <= 0) finish(true);
  });

  idle();
  return {};
}
