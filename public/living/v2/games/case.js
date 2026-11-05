// case: a branching scenario; each decision lights a road of consequence and leads to the next fork.
import { V, COL, toAr, clamp, damp, tube, orb, inkLine, circlePts, panel, THREE } from './toolkit.js';

export function caseGame(G) {
  const d = G.spec.data, S = d.steps, M = S.length;
  const xs = S.map((_, i) => (M === 1 ? 0 : 0.3 - (0.6 * i) / (M - 1)));
  const CW = Math.min(0.27, M > 1 ? 0.6 / (M - 1) - 0.03 : 0.5), HZ = 0.415;
  const colOf = (sc, mx) => (sc >= mx ? COL.green : sc / mx >= 0.5 ? COL.amber : COL.red);
  const maxOf = (s) => Math.max(...s.options.map((o) => o.score));

  G.draw(panel(0.9, 0.6, { opacity: 0.4 }), 0).position.set(0, 0, 0.05);
  // the road: start -> hubs -> end
  const hubPts = [V(0.455, 0.006, HZ), ...xs.map((x) => V(x, 0.006, HZ)), V(-0.455, 0.006, HZ)];
  const road = G.lt(tube(hubPts, COL.slate, { radius: 0.0035, speed: 0.35, glass: false })); road.userData.fill(1);
  const hubs = xs.map((x, i) => { const r = inkLine(circlePts(x, HZ, 0.022, 0.004, 28), { r: 0.0019 }); G.draw(r, 0.6 + i * 0.2, 0.8); return r; });
  const endR = G.draw(inkLine(circlePts(-0.455, HZ, 0.026, 0.004, 28), { r: 0.0019 }), 1.2, 0.8);
  const traveler = orb(COL.gold, 0.07); G.add(traveler);
  const trk = S.map((_, i) => G.tok(`القرار ${toAr(i + 1)}`, 0.2, COL.slate, { fs: 0.0155, th: 0.01 }, xs[i], -0.335, 0, 0.9 + i * 0.12));

  let state = 'idle', si = 0, score = 0, maxScore = S.reduce((a, s) => a + maxOf(s), 0), chosen = [], promptT = null, optT = [], extras = [], segs = [], tu = 0, tuGoal = 0, picks = [];
  const hud = () => G.hud(state === 'idle' ? `${toAr(M)} قرارات متتابعة` : `القرار ${toAr(Math.min(si + 1, M))} من ${toAr(M)}  ·  أثر قراراتك ${toAr(score)} / ${toAr(maxScore)}`);
  const setPrompt = (text, tag) => { if (promptT) G.drop(promptT); promptT = G.tok(text, 0.86, COL.gold, { fs: 0.0172, th: 0.016 }, 0, 0, 0, G.now); promptT.snap(0, 0, -0.49 + promptT.h / 2); };
  const hubAt = (i) => (i < 0 ? 0 : (i + 1) / (hubPts.length - 1));

  function idle() {
    optT.flat().forEach((T) => G.drop(T)); extras.forEach((x) => G.root.remove(x)); segs.forEach((x) => G.root.remove(x)); optT = []; extras = []; segs = []; picks = [];
    state = 'idle'; si = 0; score = 0; tuGoal = 0; hud();
    trk.forEach((T) => { T.restyle({ color: COL.slate }); T.glowGoal = 0; });
    setPrompt(d.scenario);
    G.buttons([{ label: 'ابدأ الحالة', primary: true, onPick: () => { G.sfx('whoosh'); showStep(0); } }]);
  }
  function showStep(i) {
    si = i; state = 'play'; G.hideCard(); G.buttons([]);
    setPrompt(`القرار ${toAr(i + 1)}: ${S[i].prompt}`);
    trk[i].glowGoal = 0.8; trk[i].restyle({ color: COL.gold });
    const toks = S[i].options.map((o, j) => {
      const T = G.tok(o.t, CW, COL.slate, { fs: 0.0152, glow: 0.15 }, xs[i], 0, 0, G.now + j * 0.14); T.o_ = o; T.j = j; return T;
    });
    const gap = 0.018; let z = -0.275;
    toks.forEach((T) => { T.snap(xs[i], 0, z + T.h / 2); T.zb = z + T.h; z += T.h + gap; });
    toks.forEach((T) => G.tap(T, () => pick(i, T), T.text.slice(0, 30)));
    // ghost threads from the fork to every option
    toks.forEach((T, j) => {
      const e = V(xs[i] + (j - (toks.length - 1) / 2) * 0.06, 0.01, T.zb + 0.012);
      const th = tube([V(xs[i], 0.006, HZ - 0.022), V(xs[i] + (e.x - xs[i]) * 0.3, 0.02, (HZ + e.z) / 2), e], COL.slate, { radius: 0.0028, glass: false, speed: 0.3 });
      G.lt(th); G.anim(0.6, (p) => th.userData.fill(p)); extras.push(th); T.thread = th;
    });
    optT.push(toks); tuGoal = hubAt(i - 1 + 0); hud();
  }
  function pick(i, T) {
    if (state !== 'play' || i !== si) return;
    state = 'fb'; const o = T.o_, mx = maxOf(S[i]), col = colOf(o.score, mx);
    score += o.score; picks.push({ i, o, T });
    optT[i].forEach((x) => { if (x !== T) { x.dim = 0.3; x.glowGoal = 0; } });
    T.restyle({ color: col }); T.glowGoal = 1;
    T.thread.userData.paint(col); T.thread.userData.fill(1);
    trk[i].restyle({ color: col }); trk[i].glowGoal = 1;
    const seg = tube([hubPts[i + 1].clone(), V((hubPts[i + 1].x + hubPts[i + 2].x) / 2, 0.02, HZ), hubPts[i + 2].clone()], col, { radius: 0.0062, speed: 0.8 });
    G.lt(seg); segs.push(seg); G.anim(0.8, (p) => seg.userData.fill(p));
    tuGoal = hubAt(i); G.sfx(o.score >= mx ? 'good' : o.score / mx >= 0.5 ? 'discover' : 'bad');
    G.sparks(V(xs[i], 0.05, T.g.position.z), col, 10, 0.12, 0.028);
    G.card({ tag: 'نتيجة القرار: ' + (o.score >= mx ? 'ممتاز' : o.score / mx >= 0.5 ? 'مقبول' : 'ضعيف'), title: `القرار ${toAr(i + 1)}`, body: o.fb, color: col });
    const last = i === M - 1;
    G.buttons([{ label: last ? 'خلاصة المسار' : 'القرار التالي ←', primary: true, onPick: () => (last ? finish() : showStep(i + 1)) }]);
    hud();
  }
  function finish() {
    state = 'over'; tuGoal = 1; G.hideCard();
    const pct = score / maxScore;
    const weak = picks.find((p) => p.o.score < maxOf(S[p.i]));
    S.forEach((s, i) => { const best = optT[i].find((x) => x.o_.score === maxOf(s)); if (best && best.o_ !== picks[i].o) { best.dim = 1; best.restyle({ color: COL.gold }); best.glowGoal = 1; } });
    const outcome = pct >= 0.8 ? 'مسار موفّق' : pct >= 0.5 ? 'مسار مقبول يحمل مخاطر' : 'مسار متعثّر';
    G.end({
      pct, title: `${outcome}  ·  ${toAr(score)} من ${toAr(maxScore)}`,
      body: weak ? `أضأتُ لك الخيار الأنسب في القرارات التي كان فيها بديل أفضل. مثال: في القرار ${toAr(weak.i + 1)} كان الأنسب «${S[weak.i].options.find((o) => o.score === maxOf(S[weak.i])).t}».` : 'كل قراراتك كانت الأنسب في موقعها.',
      color: COL.amber, again: idle,
      lines: ['', 'تذكّر أن كل قرار يغيّر خيارات القرار الذي يليه.', 'قرارات متزنة في الجملة.', 'قرارات مدروسة تراعي أثر كل خطوة على ما بعدها.'],
    });
    hud();
  }

  G.ups.push((t, dt) => {
    const reveal = clamp((t - 0.5) / 1, 0, 1);
    if (state === 'idle') tuGoal = (Math.sin(t * 0.7) * 0.5 + 0.5) * 0.3;
    tu = damp(tu, tuGoal, 2.5, dt);
    traveler.position.copy(road.userData.curve.getPointAt(clamp(tu, 0, 1))); traveler.position.y = 0.035 + Math.sin(t * 3) * 0.005; traveler.visible = reveal > 0.1;
  });
  idle();
  return {};
}
