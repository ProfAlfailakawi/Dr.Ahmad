// design: choose one part for every socket of a circuit drawing; light reaches the core only if every choice honours the constraints.
import { V, COL, toAr, clamp, damp, tube, orb, inkLine, circlePts, panel, THREE } from './toolkit.js';

export function design(G) {
  const d = G.spec.data, parts = d.parts, P = parts.length, MAXT = 3;
  G.tok(d.brief, 0.86, COL.gold, { fs: 0.0178 }, 0, -0.468, 0, 0.3);
  const cons = G.tok('متطلبات التصميم:\n' + d.constraints.map((c) => '• ' + c).join('\n'), 0.86, COL.teal, { fs: 0.0158, align: 'right', pad: 0.016 }, 0, 0, 0, 0.6);
  cons.snap(0, 0, -0.405 + cons.h / 2);
  const rx = 0.3, rz = 0.2, cz = -0.405 + cons.h + 0.055 + rz;
  G.draw(panel(0.9, rz * 2 + 0.2, { opacity: 0.4 }), 0).position.set(0, 0, cz);

  // core
  const core = orb(COL.slate, 0.13); core.position.set(0, 0.03, cz); G.add(core);
  const coreRing = inkLine(circlePts(0, cz, 0.038, 0.004, 36), { r: 0.0022 }); G.draw(coreRing, 0.5, 0.9);

  const longest = (p) => p.options.reduce((a, o) => (o.t.length > a.length ? o.t : a), '');
  const slots = parts.map((p, i) => {
    const a = -Math.PI / 2 + Math.PI / P - i * ((2 * Math.PI) / P);
    const x = rx * Math.cos(a), z = cz + rz * Math.sin(a);
    const T = G.tok(p.slot, 0.3, COL.slate, { fs: 0.0172, sub: longest(p), subFs: 0.0142, glow: 0.12 }, x, z, 0, 0.8 + i * 0.12);
    T.restyle({ sub: '— اختر القطعة —' });
    const dir = V(-x, 0, cz - z).normalize(), sEdge = Math.min(0.15 / Math.max(1e-4, Math.abs(dir.x)), (T.h / 2) / Math.max(1e-4, Math.abs(dir.z)));
    const from = V(x, 0.008, z).addScaledVector(dir, sEdge + 0.004), to = V(0, 0.008, cz).addScaledVector(dir, -0.05);
    const sp = G.lt(tube([from, to], COL.slate, { radius: 0.006, glass: false, speed: 0.3 })); sp.userData.fill(1);
    const s = { T, i, p, x, z, sp, from, to, chosen: -1, frac: 1, fracGoal: 1, state: 'open' };
    G.tap(T, () => activate(s), p.slot);
    // option tokens for this socket
    const n = p.options.length, cols = n <= 2 ? n : n === 3 ? 3 : 2, ow = cols === 3 ? 0.28 : 0.42;
    s.opts = p.options.map((o, j) => {
      const O = G.tok(o.t, ow, COL.slate, { fs: 0.0158, glow: 0.12 }, 0, 0, 0, 0.1);
      O.hidden = true; O.j = j;
      G.tap(O, () => choose(s, j), o.t.slice(0, 30));
      return O;
    });
    const rows = Math.ceil(n / cols);
    s.opts.forEach((O, j) => { const r = Math.floor(j / cols), c = j % cols, cnt = Math.min(cols, n - r * cols); O.snap(((cnt - 1) / 2 - c) * (ow + 0.016), 0, 0.325 + r * 0.115); });
    return s;
  });

  let state = 'idle', active = null, tries = 0, cur = null;
  const done = () => slots.filter((s) => s.chosen >= 0).length;
  const hud = () => G.hud(state === 'over' ? 'انتهى التصميم' : (state === 'play' || state === 'run') ? `القطع المختارة ${toAr(done())} / ${toAr(P)}  ·  التشغيلات المتبقية ${toAr(MAXT - tries)}` : `${toAr(P)} قطع  ·  ${toAr(d.constraints.length)} متطلبات`);
  function showOpts(s) { slots.forEach((x) => x.opts.forEach((O) => { O.hidden = x !== s; if (x === s) { O.t0 = G.now; } })); }
  function activate(s) {
    if (state === 'idle') { G.toast('اضغط «ابدأ التصميم» أولاً'); return; }
    if (state !== 'play') return;
    active = s; G.sfx('tap'); showOpts(s);
    slots.forEach((x) => { x.T.glowGoal = x === s ? 1 : x.chosen >= 0 ? 0.35 : 0.12; });
    s.opts.forEach((O, j) => { O.restyle({ color: s.chosen === j ? COL.gold : COL.slate }); O.glowGoal = s.chosen === j ? 0.8 : 0.12; });
  }
  function choose(s, j) {
    if (state !== 'play' || active !== s) return;
    s.chosen = j; G.sfx('click'); G.sparks(V(s.x, 0.05, s.z), COL.gold, 8, 0.12, 0.025);
    s.T.restyle({ sub: s.p.options[j].t, color: COL.gold }); s.T.glowGoal = 0.5;
    s.opts.forEach((O, k) => { O.restyle({ color: k === j ? COL.gold : COL.slate }); O.glowGoal = k === j ? 0.8 : 0.12; });
    const next = slots.find((x) => x.chosen < 0);
    if (next) G.after(0.35, () => { if (state === 'play') activate(next); }); else { active = null; showOpts(null); }
    buttons(); hud();
  }
  function buttons() { G.buttons(done() === P ? [{ label: 'شغّل التصميم', primary: true, onPick: run }] : []); }
  function idle() {
    state = 'idle'; tries = 0; active = null; showOpts(null);
    slots.forEach((s) => { s.chosen = -1; s.T.restyle({ sub: '— اختر القطعة —', color: COL.slate }); s.T.glowGoal = 0.12; s.sp.userData.paint(COL.slate); s.fracGoal = 1; s.frac = 1; });
    core.userData.paint(COL.slate); hud();
    G.buttons([{ label: 'ابدأ التصميم', primary: true, onPick: () => { state = 'play'; G.sfx('whoosh'); activate(slots[0]); hud(); } }]);
  }
  function run() {
    if (state !== 'play' || done() < P) return;
    state = 'run'; tries++; G.buttons([]); showOpts(null); G.hideCard();
    const bad = slots.filter((s) => !s.p.options[s.chosen].ok);
    slots.forEach((s, i) => {
      s.sp.userData.paint(COL.slate); s.sp.userData.fill(0);
      G.after(0.15 + i * 0.55, () => {
        const ok = s.p.options[s.chosen].ok;
        s.sp.userData.paint(ok ? COL.teal : COL.red); s.runAt = G.now; s.runOk = ok; G.sfx(ok ? 'click' : 'bad');
        s.T.restyle({ color: ok ? COL.green : COL.red }); s.T.glowGoal = 0.9;
        if (!ok) G.shake(s.T, 0.012, 0.5);
      });
    });
    G.after(0.15 + P * 0.55 + 0.7, () => {
      if (!bad.length) { core.userData.paint(COL.gold); G.sparks(V(0, 0.06, cz), COL.gold, 30, 0.3, 0.04); G.sfx('good'); G.after(0.9, () => win()); return; }
      core.userData.paint(COL.slate);
      G.card({ tag: `التشغيل ${toAr(tries)} من ${toAr(MAXT)}  ·  لم يصل الضوء إلى القلب`, title: 'أين انقطعت الدارة؟', body: bad.slice(0, 3).map((s) => `${s.p.slot}: ${s.p.options[s.chosen].fb}`).join(' ؛ '), color: COL.red });
      if (tries >= MAXT) { G.after(1.2, lose); return; }
      state = 'play'; hud();
      G.buttons([{ label: 'عدّل التصميم', primary: true, onPick: () => { G.hideCard(); slots.forEach((s) => { s.T.glowGoal = s.chosen >= 0 ? 0.35 : 0.12; if (!s.p.options[s.chosen].ok) { s.T.restyle({ color: COL.gold }); } }); activate(bad[0]); buttons(); } }]);
    });
    hud();
  }
  function win() {
    state = 'over';
    G.end({ pct: tries === 1 ? 1 : tries === 2 ? 0.8 : 0.6, title: tries === 1 ? 'تصميم يعمل من التشغيل الأول' : `تصميم يعمل بعد ${toAr(tries)} تشغيلات`, body: d.lesson, color: COL.teal, again: idle,
      lines: ['', 'نجح التصميم بعد مراجعة، وفي كل مراجعة تثبيت لقيد جديد.', 'تصميم جيّد.', 'تصميم متقن يراعي كل المتطلبات معاً.'] });
    hud();
  }
  function lose() {
    state = 'over';
    const okN = slots.filter((s) => s.p.options[s.chosen].ok).length;
    slots.forEach((s) => { const j = s.p.options.findIndex((o) => o.ok); s.T.restyle({ sub: s.p.options[j].t, color: COL.green }); s.T.glowGoal = 0.8; s.sp.userData.paint(COL.teal); s.sp.userData.fill(1); });
    core.userData.paint(COL.gold);
    G.end({ pct: (okN / P) * 0.5, title: `صحّ ${toAr(okN)} من ${toAr(P)} قطع`, body: 'عرضتُ لك القطع الصحيحة. ' + d.lesson, color: COL.red, again: idle,
      lines: ['اقرأ المتطلبات مرة أخرى واسأل عن كل قطعة: أي متطلب تحقق؟', 'اقتربت من الحل.', '', ''] });
  }

  G.ups.push((t, dt) => {
    const on = clamp((t - 0.6) / 1.0, 0, 1);
    slots.forEach((s, i) => {
      if (state === 'run' || state === 'over') {
        if (s.runAt !== undefined && state === 'run') { const p = clamp((G.now - s.runAt) / 0.5, 0, 1); s.sp.userData.fill(s.runOk ? p : p * 0.55); }
      } else s.sp.userData.fill(on * (state === 'idle' ? 0.55 + 0.35 * Math.sin(t * 1.4 + i) : 0.5));
    });
    const lit = core.userData.s.material.color.getHex() === COL.gold;
    core.userData.s.scale.setScalar((lit ? 0.18 : 0.12) + Math.sin(t * 3) * 0.012); core.visible = on > 0.05;
  });
  idle();
  return {};
}
