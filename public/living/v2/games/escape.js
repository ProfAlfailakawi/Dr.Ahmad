// escape: a chain of light locks along a path; each lock is opened by a clue taken from the page.
import { V, COL, toAr, clamp, damp, tube, orb, inked, inkLine, RoundedBoxGeometry, pips, panel, THREE } from './toolkit.js';

export function escapeGame(G) {
  const d = G.spec.data, L = d.locks, N = L.length;
  G.tok(d.story, 0.86, COL.gold, { fs: 0.0182 }, 0, -0.465, 0, 0.3);
  const ZL = (i) => -0.335 + (i % 2 ? -0.035 : 0.035);
  const lockX = (i) => (N === 1 ? 0 : 0.31 - (0.62 * i) / (N - 1));
  const pts = [V(0.45, 0.006, -0.335)];
  L.forEach((_, i) => pts.push(V(lockX(i), 0.006, ZL(i))));
  pts.push(V(-0.44, 0.006, -0.335));
  const path = G.lt(tube(pts, COL.teal, { radius: 0.0055, speed: 0.6 }));
  const curve = path.userData.curve;
  const sp = curve.getSpacedPoints(300);
  const frac = L.map((_, i) => { let b = 0, bd = 9; sp.forEach((p, k) => { const dd = Math.hypot(p.x - lockX(i), p.z - ZL(i)); if (dd < bd) { bd = dd; b = k; } }); return b / 300; });
  G.draw(inkLine(sp.filter((_, k) => k % 3 === 0), { r: 0.0012, opacity: 0.45 }), 0.4, 1.4);
  G.draw(panel(0.9, 0.17, { opacity: 0.5 }), 0).position.set(0, 0, -0.335);

  const locks = L.map((_, i) => {
    const g = new THREE.Group(); g.position.set(lockX(i), 0, ZL(i)); g.scale.setScalar(1.4);
    const body = inked(new RoundedBoxGeometry(0.06, 0.04, 0.045, 2, 0.006), { color: 0xfcf9f1 }); body.position.y = 0.02; g.add(body);
    const piv = new THREE.Group(); piv.position.set(0.018, 0.04, 0); g.add(piv);
    const sh = inked(new THREE.TorusGeometry(0.0175, 0.0042, 8, 20, Math.PI), { color: 0xd8d2c4 }); sh.position.set(-0.0175, 0, 0); piv.add(sh);
    const key = orb(COL.amber, 0.045); key.position.set(0, 0.022, 0.026); g.add(key);
    g.userData.reveal = (p) => { body.userData.reveal(p); sh.userData.reveal(clamp(p * 1.3 - 0.3, 0, 1)); key.visible = p > 0.7; };
    g.userData.reveal(0);
    G.draw(g, 0.7 + i * 0.25, 0.9);
    const num = G.tok(toAr(i + 1), 0.04, COL.amber, { slab: false, border: false, fs: 0.02, halo: false }, lockX(i), ZL(i) - 0.052, 0.002, 1.0 + i * 0.25);
    return { g, piv, key, open: 0, goal: 0, shake: 0, num };
  });
  const door = new THREE.Group(); door.position.set(-0.455, 0, -0.335);
  const dpiv = new THREE.Group(); door.add(dpiv);
  const leaf = inked(new RoundedBoxGeometry(0.07, 0.12, 0.012, 2, 0.003), { color: 0xfcf9f1 }); leaf.position.set(0.035, 0.06, 0); dpiv.add(leaf);
  const lightP = new THREE.Mesh(new THREE.PlaneGeometry(0.066, 0.115), new THREE.MeshBasicMaterial({ color: 0xffe9a8, transparent: true, opacity: 0, depthWrite: false, toneMapped: false }));
  lightP.position.set(0.035, 0.06, -0.008); door.add(lightP);
  door.userData.reveal = (p) => leaf.userData.reveal(p);
  G.draw(door, 1.2, 1.2);
  const lantern = orb(COL.gold, 0.07); G.add(lantern);
  const lives = G.draw(pips(3, COL.red), 0.9); lives.position.set(0.42, 0.002, -0.235);
  G.tok('المحاولات', 0.14, COL.red, { slab: false, border: false, fs: 0.013, halo: false, weight: 600 }, 0.42 - 3 * 0.045 - 0.05, -0.235, 0.002, 1.0);

  let state = 'idle', cur = 0, left = 3, shown = [], u = 0, uGoal = 0, picked = [];
  const hud = () => G.hud(state === 'play' || state === 'next' ? `القفل ${toAr(cur + 1)} من ${toAr(N)}  ·  محاولات متبقية ${toAr(left)}` : `${toAr(N)} أقفال متسلسلة`);
  const clear = () => { shown.forEach((T) => G.drop(T)); shown = []; };

  function idle() {
    clear(); state = 'idle'; cur = 0; left = 3; uGoal = 0; u = 0;
    locks.forEach((l) => { l.goal = 0; l.open = 0; l.key.userData.paint(COL.amber); });
    lightP.material.opacity = 0; dpiv.rotation.y = 0; lives.userData.set(3, COL.red); hud();
    G.buttons([{ label: 'ابدأ الهروب', primary: true, onPick: () => { state = 'play'; G.sfx('whoosh'); showLock(0); } }]);
  }
  function showLock(i) {
    clear(); cur = i; state = 'play'; picked = []; hud(); G.hideCard(); G.buttons([]);
    const k = L[i];
    const clue = G.tok(`القفل ${toAr(i + 1)}\n${k.clue}`, 0.86, COL.gold, { fs: 0.0192, th: 0.018 }, 0, 0, 0, G.now);
    clue.snap(0, 0, -0.19 + clue.h / 2); shown.push(clue);
    let z = -0.19 + clue.h + 0.03;
    k.options.forEach((o, j) => {
      const T = G.tok(o, 0.8, COL.slate, { fs: 0.0178 }, 0, 0, 0, G.now + 0.15 * j);
      T.snap(0, 0, z + T.h / 2); z += T.h + 0.014; T.opt = j; shown.push(T);
      G.tap(T, () => pick(j, T), o.slice(0, 30));
    });
  }
  function pick(j, T) {
    if (state !== 'play' || T.off) return;
    const k = L[cur];
    if (j === k.answer) {
      state = 'next'; T.restyle({ color: COL.green }); T.glowGoal = 1;
      shown.forEach((x) => { if (x.opt !== undefined && x !== T) x.dim = 0.3; });
      const l = locks[cur]; l.goal = 1; l.key.userData.paint(COL.green); G.sfx('good'); G.sparks(V(l.g.position.x, 0.05, l.g.position.z), COL.green, 14);
      uGoal = cur + 1 < N ? frac[cur + 1] : 1;
      G.card({ tag: 'انفتح القفل', title: 'لماذا هذه هي الإجابة؟', body: k.why, color: COL.green });
      if (cur + 1 < N) G.buttons([{ label: 'القفل التالي ←', primary: true, onPick: () => showLock(cur + 1) }]);
      else G.after(1.4, win);
      hud();
    } else {
      left--; lives.userData.set(left, COL.red); T.off = true; T.restyle({ color: COL.red }); T.dim = 0.5; T.glowGoal = 0.8;
      G.shake(T, 0.014, 0.45); G.shake(shown[0], 0.006, 0.3); G.sfx('bad'); locks[cur].shake = 1;
      G.toast(left > 0 ? 'لم ينفتح القفل، فكّر في المعلومة المطلوبة' : 'نفدت محاولاتك');
      hud();
      if (left <= 0) lose();
    }
  }
  function win() {
    state = 'over'; G.hideCard(); lightP.material.opacity = 1; G.sparks(V(-0.43, 0.08, -0.33), COL.gold, 30, 0.3, 0.04); G.sfx('good');
    G.end({
      pct: 0.6 + 0.4 * ((left - 1) / 2), title: `انفتحت الأقفال كلها بـ ${toAr(left)} محاولات متبقية`,
      body: 'عبرت البوابة لأنك ربطت كل قفل بمعلومة محددة من الصفحة لا بالتخمين.', color: COL.gold, again: idle,
      lines: ['', 'نجحت، لكنّ الأخطاء السابقة تدلّ على معلومة تحتاج إلى تثبيت.', 'نجحت بثبات.', 'عبور متقن: كل قفل أخذ ما يستحقه من التحليل.'],
    });
    G.hud('انفتحت البوابة');
  }
  function lose() {
    state = 'over'; const k = L[cur];
    shown.forEach((T) => { if (T.opt === k.answer) { T.restyle({ color: COL.green }); T.dim = 1; T.glowGoal = 1; } });
    G.end({
      pct: (cur / N) * 0.5, title: `توقفت عند القفل ${toAr(cur + 1)} من ${toAr(N)}`,
      body: 'الإجابة الصحيحة أضأتُها لك. ' + k.why, color: COL.red, again: idle,
      lines: ['ارجع إلى الصفحة وابحث عن المعلومة التي يستند إليها هذا القفل، ثم أعد المحاولة.', 'اقتربت؛ أعد المحاولة بعد مراجعة هذه المعلومة.', '', ''],
    });
  }

  G.ups.push((t, dt) => {
    const reveal = clamp((t - 0.6) / 1.2, 0, 1);
    if (state === 'idle') uGoal = frac[0] * (0.5 + 0.5 * Math.sin(t * 0.9));
    u = damp(u, uGoal, state === 'idle' ? 3 : 2.2, dt);
    path.userData.fill(Math.min(reveal, state === 'idle' ? 0.02 + frac[0] : u + 0.012));
    lantern.position.copy(curve.getPointAt(clamp(u, 0, 1))); lantern.position.y = 0.03 + Math.sin(t * 3) * 0.006;
    lantern.visible = reveal > 0.05;
    locks.forEach((l, i) => {
      l.open = damp(l.open, l.goal, 6, dt);
      l.piv.rotation.y = -l.open * Math.PI * 0.75; l.piv.position.y = 0.04 + l.open * 0.008;
      l.shake = Math.max(0, l.shake - dt * 2.2); l.g.position.x = lockX(i) + Math.sin(t * 50) * 0.004 * l.shake;
      l.key.userData.s.scale.setScalar(0.04 + Math.sin(t * 3 + i) * 0.006);
    });
    dpiv.rotation.y = damp(dpiv.rotation.y, state === 'over' && lightP.material.opacity > 0.5 ? -1.3 : 0, 3, dt);
  });
  idle();
  return {};
}
