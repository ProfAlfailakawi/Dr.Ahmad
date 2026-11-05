// bet: before answering, wager 30/60/90 of your confidence; the bank rises or falls, and calibration is graded.
import { V, COL, toAr, clamp, damp, tube, orb, glassCylinder, pips, panel, THREE } from './toolkit.js';

const STAKES = [{ v: 30, name: 'حذر', c: COL.teal, h: 0.06 }, { v: 60, name: 'متوسّط', c: COL.amber, h: 0.1 }, { v: 90, name: 'جازم', c: COL.red, h: 0.14 }];

export function bet(G) {
  const Q = G.spec.data.questions, n = Q.length;
  G.draw(panel(0.9, 0.2, { opacity: 0.45 }), 0).position.set(0, 0, 0.405);

  const bankTube = G.lt(tube([V(0.1, 0.006, -0.47), V(-0.43, 0.006, -0.47)], COL.gold, { radius: 0.0055, speed: 0.4 }));
  const bankLbl = G.tok('', 0.3, COL.gold, { slab: false, border: false, fs: 0.0185, halo: false, weight: 800 }, 0.27, -0.47, 0.002, 0.5);
  const prog = G.draw(pips(n, COL.violet), 0.7); prog.position.set(0.43, 0.002, -0.425);

  const pillars = STAKES.map((s, i) => {
    const x = 0.22 - i * 0.22;
    const g = glassCylinder(0.03, s.h, s.c); g.position.set(x, 0, 0.385); G.draw(g, 0.6 + i * 0.2, 1.0);
    const lab = G.tok(`${s.name} ${toAr(s.v)}٪`, 0.2, s.c, { slab: false, border: false, fs: 0.0172, halo: false }, x, 0.45, 0.002, 1.0 + i * 0.15);
    const o = { s, g, lab, level: 0.15, i, x };
    G.tap(g, () => stake(i), 'stake ' + s.v); G.tap(lab, () => stake(i), 'stake ' + s.v);
    return o;
  });
  const ask = G.tok('اختر حجم رهانك أولاً، ثم أجب', 0.5, COL.gold, { slab: false, border: false, fs: 0.0165, halo: false, weight: 600 }, 0, 0.318, 0.002, 1.2);

  let state = 'idle', qi = 0, bank = 100, st = -1, shown = [], log = [], qTok = null, opts = [];
  const hud = () => G.hud(state === 'idle' ? `${toAr(n)} أسئلة  ·  رصيد ابتدائي ${toAr(100)}` : `السؤال ${toAr(Math.min(qi + 1, n))} من ${toAr(n)}  ·  الرصيد ${toAr(bank)}${st >= 0 ? `  ·  الرهان ${toAr(STAKES[st].v)}` : ''}`);
  const setBank = () => bankLbl.restyle({ text: `رصيد الثقة: ${toAr(bank)}` });
  const clear = () => { shown.forEach((T) => G.drop(T)); shown = []; opts = []; qTok = null; };

  function idle() {
    clear(); state = 'idle'; qi = 0; bank = 100; st = -1; log = []; setBank(); prog.userData.set(0); hud();
    ask.hidden = false;
    G.buttons([{ label: 'ابدأ المراهنة', primary: true, onPick: () => { state = 'play'; G.sfx('whoosh'); showQ(); } }]);
  }
  function showQ() {
    clear(); st = -1; state = 'play'; G.hideCard(); G.buttons([]); ask.hidden = false;
    const q = Q[qi];
    qTok = G.tok(q.q, 0.86, COL.gold, { fs: 0.0205, th: 0.018 }, 0, 0, 0, G.now); qTok.snap(0, 0, -0.395 + qTok.h / 2); shown.push(qTok);
    let z = -0.395 + qTok.h + 0.03;
    q.options.forEach((o, j) => {
      const T = G.tok(o, 0.8, COL.slate, { fs: 0.0182 }, 0, 0, 0, G.now + 0.12 * j); T.snap(0, 0, z + T.h / 2); z += T.h + 0.014;
      T.dim = 0.5; T.off = true; opts.push(T); shown.push(T);
      G.tap(T, () => answer(j), o.slice(0, 30));
    });
    hud();
  }
  function stake(i) {
    if (state !== 'play') { if (state === 'idle') G.toast('اضغط «ابدأ المراهنة» أولاً'); return; }
    st = i; G.sfx('click');
    opts.forEach((T) => { T.off = false; T.dim = 1; });
    ask.hidden = true; hud();
  }
  function answer(j) {
    if (state !== 'play' || st < 0) return;
    state = 'reveal';
    const q = Q[qi], ok = j === q.answer, s = STAKES[st];
    bank = Math.max(0, bank + (ok ? s.v : -s.v)); log.push({ stake: s.v, ok, q });
    opts.forEach((T, k) => { T.off = true; if (k === q.answer) { T.restyle({ color: COL.green }); T.glowGoal = 1; T.dim = 1; } else if (k === j) { T.restyle({ color: COL.red }); T.glowGoal = 0.9; T.dim = 1; } else T.dim = 0.4; });
    prog.userData.set(qi + 1, COL.violet);
    const from = V(pillars[st].x, 0.06, 0.385), to = V(-0.2, 0.03, -0.47), o = orb(ok ? COL.gold : COL.red, 0.06); G.add(o);
    o.position.copy(ok ? from : to);
    G.fly(o, ok ? to : from, 0.9, 0.18, () => { G.root.remove(o); G.sparks(ok ? to : from, ok ? COL.gold : COL.red, 12, 0.15, 0.03); });
    G.sfx(ok ? 'good' : 'bad'); setBank();
    G.card({ tag: ok ? `✓ إجابة صحيحة  ·  ربحت ${toAr(s.v)}` : `✗ إجابة غير صحيحة  ·  خسرت ${toAr(s.v)}`, title: ok ? 'ثقتك في محلّها' : 'الثقة هنا سبقت المعرفة', body: q.why, color: ok ? COL.green : COL.red });
    const last = qi === n - 1;
    G.buttons([{ label: last ? 'النتيجة' : 'السؤال التالي ←', primary: true, onPick: () => (last ? finish() : (qi++, showQ())) }]);
    hud();
  }
  function finish() {
    state = 'over'; clear(); ask.hidden = true;
    const right = log.filter((l) => l.ok).length, acc = right / n, conf = log.reduce((a, l) => a + l.stake, 0) / n / 100, diff = conf - acc;
    const cal = diff > 0.15 ? 'مفرط الثقة' : diff < -0.15 ? 'متحفّظ أكثر من اللازم' : 'جيّد المعايرة';
    const miss = log.filter((l) => !l.ok).slice(0, 2).map((l) => l.q.why.replace(/\.$/, '')).join(' ؛ ');
    G.end({
      pct: 0.5 * acc + 0.5 * (1 - Math.min(1, Math.abs(diff) * 1.5)),
      title: `${toAr(right)} من ${toAr(n)} صحيحة  ·  رصيدك ${toAr(bank)}`,
      body: `متوسط ثقتك ${toAr(Math.round(conf * 100))}٪ مقابل دقتك الفعلية ${toAr(Math.round(acc * 100))}٪، فأنت ${cal}. المعايرة هي مطابقة الثقة بالمعرفة الفعلية، وهي أساس التعلّم الذاتي.${miss ? ' راجع: ' + miss : ''}`,
      color: COL.violet, again: idle,
      lines: ['', 'عدّل رهاناتك بحسب ما تعرفه فعلاً لا بما تشعر به.', 'معايرة مقبولة.', 'معايرة دقيقة: تعرف ما تعرفه وما لا تعرفه.'],
    });
    hud();
  }

  G.ups.push((t, dt) => {
    pillars.forEach((p) => {
      const goal = st === p.i ? 1 : state === 'idle' ? 0.2 + 0.18 * (Math.sin(t * 1.6 + p.i * 1.3) * 0.5 + 0.5) : 0.12;
      p.level = damp(p.level, goal, 6, dt); p.g.userData.liq.scale.y = Math.max(0.001, p.level);
    });
    bankTube.userData.fill(clamp((t - 0.5) / 1, 0, 1) * clamp(bank / 300, 0.03, 1));
    ask.dim = 0.7 + Math.sin(t * 3) * 0.3;
  });
  idle();
  return {};
}
