// allocate: spend a limited budget on options; their effects fill three glass meters toward gold target rings.
import { V, COL, toAr, clamp, damp, tube, orb, inkLine, circlePts, glassCylinder, panel, THREE } from './toolkit.js';

const NAMES = { engagement: 'المشاركة والتفاعل', access: 'إتاحة الوصول', quality: 'جودة التعلّم' };

export function allocate(G) {
  const d = G.spec.data, O = d.options, B = d.budget || 100, target = d.target;
  const keys = Object.keys(target).slice(0, 3);
  const kcol = [COL.amber, COL.blue, COL.green];
  const H = 0.2, R = 0.033;
  const maxV = keys.map((k) => Math.max(1, target[k] * 1.6));

  G.tok(d.brief, 0.86, COL.gold, { fs: 0.0182 }, 0, -0.468, 0, 0.3);
  G.draw(panel(0.9, 0.34, { opacity: 0.45 }), 0).position.set(0, 0, -0.205);

  const meters = keys.map((k, i) => {
    const x = 0.27 - i * 0.27;
    const g = glassCylinder(R, H, kcol[i]); g.position.set(x, 0, -0.245); G.draw(g, 0.5 + i * 0.2, 1.0);
    const ringY = (target[k] / maxV[i]) * H;
    const ring = inkLine(circlePts(0, 0, R + 0.009, ringY, 40), { r: 0.0026, color: COL.gold }); ring.position.set(x, 0, -0.245); G.draw(ring, 1.1 + i * 0.2, 0.6);
    const lab = G.tok(NAMES[k] || k, 0.24, kcol[i], { slab: false, border: false, fs: 0.0165, halo: false }, x, -0.2, 0.002, 1.0 + i * 0.2);
    const val = G.tok('٠ / ' + toAr(target[k]), 0.24, kcol[i], { slab: false, border: false, fs: 0.0145, halo: false, weight: 500 }, x, -0.175, 0.002, 1.1 + i * 0.2);
    return { k, g, x, level: 0, v: 0, lab, val, i };
  });
  const bud = G.lt(tube([V(0.36, 0.006, -0.125), V(-0.36, 0.006, -0.125)], COL.gold, { radius: 0.005, speed: 0.4 })); bud.userData.fill(1);
  const budLbl = G.tok('', 0.5, COL.gold, { slab: false, border: false, fs: 0.0165, halo: false }, 0, -0.098, 0.002, 1.0);

  // options in two columns
  const toks = O.map((o, i) => {
    const eff = keys.map((k) => (o.effect?.[k] ? `${NAMES[k] || k} ${o.effect[k] > 0 ? '+' : '−'}${toAr(Math.abs(o.effect[k]))}` : null)).filter(Boolean).join(' · ');
    const T = G.tok(o.label, 0.41, COL.slate, { fs: 0.0172, sub: `التكلفة ${toAr(o.cost)}  ·  ${eff}`, subFs: 0.0132, glow: 0.12 }, 0, 0, 0, 1.2 + i * 0.1);
    const s = { T, o, i, on: false };
    G.tap(T, () => toggle(s), o.label.slice(0, 30));
    return s;
  });
  const rows = Math.ceil(O.length / 2);
  let zc = -0.045;
  for (let r = 0; r < rows; r++) {
    const pair = toks.slice(r * 2, r * 2 + 2), h = Math.max(...pair.map((s) => s.T.h));
    pair.forEach((s, c) => { s.home = V(0.215 - c * 0.43, 0, zc + h / 2); s.T.snap(s.home.x, s.home.y, s.home.z); });
    zc += h + 0.016;
  }

  let state = 'idle', spent = 0;
  const vals = () => keys.map((k) => Math.max(0, toks.filter((s) => s.on).reduce((a, s) => a + (s.o.effect?.[k] || 0), 0)));
  function refresh() {
    spent = toks.filter((s) => s.on).reduce((a, s) => a + s.o.cost, 0);
    const v = vals();
    meters.forEach((m, i) => { m.v = v[i]; m.val.restyle({ text: `${toAr(Math.round(v[i]))} / ${toAr(target[m.k])}`, color: v[i] >= target[m.k] ? COL.green : kcol[i] }); });
    budLbl.restyle({ text: `الميزانية المتبقية: ${toAr(B - spent)} من ${toAr(B)}` });
    G.hud(state === 'play' ? `المتبقي ${toAr(B - spent)} من ${toAr(B)}  ·  الخيارات المختارة ${toAr(toks.filter((s) => s.on).length)}` : `الميزانية ${toAr(B)} وحدة`);
  }
  function toggle(s) {
    if (state === 'idle') { G.toast('اضغط «ابدأ التخطيط» أولاً'); return; }
    if (state !== 'play') return;
    if (!s.on && spent + s.o.cost > B) { G.toast('هذا الخيار يتجاوز الميزانية'); G.shake(s.T, 0.01, 0.35); G.sfx('bad'); return; }
    s.on = !s.on; G.sfx(s.on ? 'click' : 'tap');
    s.T.restyle({ color: s.on ? COL.gold : COL.slate }); s.T.glowGoal = s.on ? 1 : 0.12; s.T.goal.y = s.on ? 0.022 : 0;
    if (s.on) keys.forEach((k, i) => {
      if ((s.o.effect?.[k] || 0) <= 0) return;
      const o = orb(kcol[i], 0.05); o.position.set(s.home.x, 0.04, s.home.z); G.add(o);
      G.fly(o, V(meters[i].x, 0.03 + (meters[i].level) * H, -0.245), 0.7, 0.12, () => { G.root.remove(o); G.sparks(o.position, kcol[i], 5, 0.1, 0.02); });
    });
    refresh();
  }
  function idle() {
    state = 'idle'; toks.forEach((s) => { s.on = false; s.T.restyle({ color: COL.slate }); s.T.glowGoal = 0.12; s.T.goal.y = 0; }); refresh();
    G.buttons([{ label: 'ابدأ التخطيط', primary: true, onPick: () => { state = 'play'; G.sfx('whoosh'); refresh(); buttonsPlay(); } }]);
  }
  function buttonsPlay() {
    G.buttons([{ label: 'قدّم الخطة', primary: true, onPick: submit }, { label: 'أفرغ الخطة', onPick: () => { toks.forEach((s) => { if (s.on) { s.on = false; s.T.restyle({ color: COL.slate }); s.T.glowGoal = 0.12; s.T.goal.y = 0; } }); refresh(); } }]);
  }
  function submit() {
    if (state !== 'play') return;
    state = 'over';
    const v = vals(), short = keys.filter((k, i) => v[i] < target[k]);
    const pass = short.length === 0;
    const avg = keys.reduce((a, k, i) => a + Math.min(1, v[i] / target[k]), 0) / keys.length;
    const pct = pass ? 0.75 + 0.25 * ((B - spent) / B) : 0.6 * avg;
    G.end({
      pct, title: pass ? 'خطة تحقق الأهداف الثلاثة' : `قصّرت الخطة في: ${short.map((k) => NAMES[k] || k).join(' و')}`,
      body: `أنفقت ${toAr(spent)} من ${toAr(B)}. ${d.lesson}`, color: COL.gold, again: () => { G.gen++; idle(); },
      lines: ['', 'اقتربت من التوازن المطلوب، فجرّب إعادة توزيع الميزانية.', 'توزيع جيّد للموارد.', 'توزيع متوازن: أخذت المفاضلة بين الأهداف بجدية.'],
    });
    if (!pass) G.buttons([{ label: 'عدّل خطتك', primary: true, onPick: () => { G.hideCard(); state = 'play'; refresh(); buttonsPlay(); } }, { label: '↻ من جديد', onPick: () => { G.hideCard(); idle(); } }]);
  }

  G.ups.push((t, dt) => {
    meters.forEach((m) => {
      const goal = clamp(m.v / maxV[m.i], 0, 1) + (state === 'idle' ? (Math.sin(t * 1.3 + m.i * 2) * 0.5 + 0.5) * 0.18 : 0);
      m.level = damp(m.level, goal, 5, dt);
      m.g.userData.liq.scale.y = Math.max(0.001, m.level);
      m.g.userData.liq.material.color.setHex(m.v >= target[m.k] ? COL.green : kcol[m.i]);
    });
    bud.userData.fill(clamp((t - 0.7) / 1, 0, 1) * clamp((B - spent) / B, 0.001, 1));
    toks.forEach((s, i) => { if (!s.on && state === 'idle') s.T.goal.y = Math.sin(t * 1.4 + i) * 0.004; });
  });
  idle();
  return {};
}
