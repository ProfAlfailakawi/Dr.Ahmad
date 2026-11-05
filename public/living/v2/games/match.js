// match: tap one item on each side to draw a light string between two columns; wrong strings burn away.
import { V, COL, toAr, clamp, tube, orb, shuffle, panel, THREE } from './toolkit.js';

const PAL = [COL.teal, COL.rose, COL.blue, COL.amber, COL.violet, COL.green, COL.red, COL.gold];

export function match(G) {
  const d = G.spec.data, Ls = d.left, Rs = d.right, pairs = d.pairs, N = pairs.length;
  G.tok(d.brief, 0.86, COL.gold, { fs: 0.0182 }, 0, -0.468, 0, 0.3);
  G.draw(panel(0.9, 0.84, { opacity: 0.4 }), 0).position.set(0, 0, 0.0);
  const XR = 0.3, XL = -0.3, W = 0.34;

  const mk = (text, side, i, delay) => {
    const T = G.tok(text, W, COL.slate, { fs: 0.0172, glow: 0.12 }, 0, 0, 0.0, delay);
    const o = { T, side, i, matched: false };
    G.tap(T, () => tapTok(o), text.slice(0, 30));
    return o;
  };
  const left = Ls.map((t, i) => mk(t, 'L', i, 0.5 + i * 0.1));
  const rOrder = shuffle(Rs.map((_, i) => i), 5);
  const right = rOrder.map((ri, k) => mk(Rs[ri], 'R', ri, 0.6 + k * 0.1));
  const layout = (col, x) => {
    const gap = 0.02, tot = col.reduce((a, o) => a + o.T.h, 0) + gap * (col.length - 1);
    let z = -0.37 + Math.max(0, (0.76 - tot) / 2);
    col.forEach((o) => { o.z = z + o.T.h / 2; o.x = x; o.T.snap(x, 0, o.z); z += o.T.h + gap; });
  };
  layout(left, XR); layout(right, XL);
  const byR = (ri) => right.find((o) => o.i === ri);

  const motes = Array.from({ length: 5 }, (_, i) => { const o = orb(PAL[i], 0.045); G.add(o); return { o, ph: i * 1.7, row: i }; });

  let state = 'idle', selA = null, matched = 0, mistakes = [], strings = [];
  const hud = () => G.hud(state === 'play' ? `الروابط الصحيحة ${toAr(matched)} / ${toAr(N)}  ·  أخطاء ${toAr(mistakes.length)}` : `${toAr(N)} أزواج`);

  function idle() {
    state = 'idle'; selA = null; matched = 0; mistakes = [];
    strings.forEach((s) => { G.root.remove(s.t); }); strings = [];
    [...left, ...right].forEach((o) => { o.matched = false; o.T.restyle({ color: COL.slate }); o.T.glowGoal = 0.12; o.T.goal.y = 0; });
    hud();
    G.buttons([{ label: 'ابدأ الربط', primary: true, onPick: () => { state = 'play'; G.sfx('whoosh'); hud(); G.buttons([]); } }]);
  }
  function unselect() { if (selA) { selA.T.restyle({ color: COL.slate }); selA.T.glowGoal = 0.12; selA.T.goal.y = 0; selA = null; } }
  function tapTok(o) {
    if (state === 'idle') { G.toast('اضغط «ابدأ الربط» أولاً'); return; }
    if (state !== 'play' || o.matched) return;
    G.sfx('tap');
    if (!selA) { selA = o; o.T.restyle({ color: COL.gold }); o.T.glowGoal = 1; o.T.goal.y = 0.02; return; }
    if (selA === o) { unselect(); return; }
    if (selA.side === o.side) { unselect(); selA = o; o.T.restyle({ color: COL.gold }); o.T.glowGoal = 1; o.T.goal.y = 0.02; return; }
    const a = selA.side === 'L' ? selA : o, b = selA.side === 'L' ? o : selA;
    unselect(); connect(a, b);
  }
  function stringBetween(a, b, color) {
    const p0 = V(a.x - W / 2, 0.025, a.z), p1 = V(0, 0.07 + Math.abs(a.z - b.z) * 0.12, (a.z + b.z) / 2), p2 = V(b.x + W / 2, 0.025, b.z);
    const t = tube([p0, p1, p2], color, { radius: 0.0055, speed: 0.7 }); G.lt(t); return t;
  }
  function connect(a, b) {
    const ok = pairs.some((p) => p[0] === a.i && p[1] === b.i);
    const col = ok ? PAL[a.i % PAL.length] : COL.red;
    const t = stringBetween(a, b, col); G.sfx('click');
    G.anim(0.45, (p) => t.userData.fill(p));
    if (ok) {
      a.matched = b.matched = true; matched++; strings.push({ t });
      [a, b].forEach((o) => { o.T.restyle({ color: col }); o.T.glowGoal = 0.8; });
      G.after(0.45, () => { G.sfx('good'); G.sparks(V((a.x + b.x) / 2, 0.08, (a.z + b.z) / 2), col, 12, 0.14, 0.028); });
      hud();
      if (matched === N) G.after(0.9, finish);
    } else {
      mistakes.push({ a, b }); G.sfx('bad'); hud();
      [a, b].forEach((o) => { o.T.restyle({ color: COL.red }); o.T.glowGoal = 0.9; G.shake(o.T, 0.01, 0.5); });
      G.after(0.5, () => G.anim(0.4, (p) => t.userData.fill(1 - p), () => { G.root.remove(t); }));
      G.after(1.0, () => [a, b].forEach((o) => { if (!o.matched) { o.T.restyle({ color: COL.slate }); o.T.glowGoal = 0.12; } }));
      G.toast('هذه العلاقة غير صحيحة');
    }
  }
  function finish() {
    state = 'over';
    const seen = new Set(), notes = [];
    mistakes.forEach((m) => { if (!seen.has(m.a.i) && notes.length < 2) { seen.add(m.a.i); const pr = pairs.find((p) => p[0] === m.a.i); notes.push(`«${Ls[m.a.i]}» ↔ «${Rs[pr[1]]}»`); } });
    G.end({
      pct: N / (N + mistakes.length), title: `${toAr(N)} روابط صحيحة و${toAr(mistakes.length)} محاولات خاطئة`,
      body: mistakes.length ? `أكثر ما التبس عليك: ${notes.join('؛ ')}.` : 'ربطت المفاهيم بمعانيها دون خطأ واحد.', color: COL.teal, again: idle,
      lines: ['', 'راجع الفروق بين المفاهيم المتقاربة ثم أعد الربط.', 'ربط جيّد.', 'ربط متقن للمفاهيم.'],
    });
    hud();
  }

  G.ups.push((t) => {
    motes.forEach((m) => {
      const k = ((t * 0.18 + m.ph * 0.2) % 1), z = -0.3 + m.row * 0.15;
      m.o.position.set(XR - 0.17 - k * (XR - 0.17 - (XL + 0.17)), 0.04 + Math.sin(k * Math.PI) * 0.05, z + Math.sin(t + m.ph) * 0.03);
      m.o.userData.s.material.opacity = Math.sin(k * Math.PI) * 0.7 * clamp((t - 1) / 1, 0, 1);
    });
  });
  idle();
  return {};
}
