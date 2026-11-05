// spot-error: a lens sweeps the statements on a draft sheet; the student marks the faulty ones.
import { V, COL, toAr, clamp, lerp, tube, inkLine, inked, pips, panel, THREE } from './toolkit.js';

export function spotError(G) {
  const d = G.spec.data, S = d.statements, N = S.length;
  const W = S.filter((s) => s.wrong).length;
  const fs = N > 7 ? 0.0172 : 0.0185;

  G.tok(d.brief, 0.86, COL.gold, { fs: 0.0185 }, 0, -0.46, 0, 0.3);
  G.draw(panel(0.9, 0.7, { opacity: 0.45 }), 0).position.set(0, 0, -0.04);

  // statements as strips of a draft sheet
  const strips = S.map((s, i) => {
    const T = G.tok(s.t, 0.84, COL.slate, { fs, align: 'right', pad: 0.016 }, 0, 0, 0.012, 0.6 + i * 0.12);
    const fog = new THREE.Mesh(new THREE.PlaneGeometry(0.84, T.h), new THREE.MeshBasicMaterial({ color: 0xfbf8f0, transparent: true, opacity: 0.5, depthWrite: false, toneMapped: false }));
    fog.rotation.x = -Math.PI / 2; fog.position.y = T.th + 0.0028; fog.renderOrder = 6; fog.raycast = () => {}; T.g.add(fog);
    const st = { T, fog, s, i, mark: 'open', line: null };
    G.tap(T, () => mark(st), s.t.slice(0, 30));
    return st;
  });
  const gap = 0.012;
  const total = strips.reduce((a, x) => a + x.T.h, 0) + gap * (N - 1);
  let zc = -0.35 + 0.0;
  strips.forEach((x) => { x.z = zc + x.T.h / 2; x.T.snap(0, 0.012, x.z); zc += x.T.h + gap; });
  const zMin = strips[0].z, zMax = strips[N - 1].z;

  const found = G.draw(pips(W, COL.green), 0.8); found.position.set(0.42, 0.002, -0.395);
  const strikes = G.draw(pips(3, COL.red), 0.9); strikes.position.set(-0.26, 0.002, -0.395);
  const lblF = G.tok('أخطاء مكتشفة', 0.2, COL.green, { slab: false, border: false, fs: 0.013, halo: false, weight: 600 }, 0.42 - W * 0.045 - 0.075, -0.395, 0.002, 1.0);
  const lblS = G.tok('محاولات خاطئة', 0.22, COL.red, { slab: false, border: false, fs: 0.013, halo: false, weight: 600 }, -0.26 - 3 * 0.045 - 0.085, -0.395, 0.002, 1.0);

  // the lens
  const lens = new THREE.Group();
  const ring = inked(new THREE.TorusGeometry(0.07, 0.0065, 10, 40), { color: 0xfcf9f1 }); ring.rotation.x = -Math.PI / 2; lens.add(ring);
  const glass = new THREE.Mesh(new THREE.CircleGeometry(0.066, 36), new THREE.MeshBasicMaterial({ color: COL.gold, transparent: true, opacity: 0, depthWrite: false, toneMapped: false }));
  glass.rotation.x = -Math.PI / 2; glass.position.y = 0.0005; glass.raycast = () => {}; lens.add(glass);
  const handle = inked(new THREE.CylinderGeometry(0.007, 0.009, 0.1, 10), { color: 0xfcf9f1 }); handle.rotation.set(0, 0, Math.PI / 2); handle.rotation.y = 0; handle.position.set(-0.105, 0, 0.065); handle.rotation.set(Math.PI / 2, 0, 0.9); lens.add(handle);
  lens.userData.reveal = (p) => { ring.userData.reveal(p); handle.userData.reveal(p); glass.material.opacity = 0.14 * p; };
  lens.userData.reveal(0);
  G.draw(lens, 1.0, 1.2);
  const scan = G.lt(tube([V(-0.43, 0.012, 0), V(0.43, 0.012, 0)], COL.gold, { radius: 0.0035, glass: false, speed: 0.8 })); scan.userData.fill(1);

  let state = 'idle', hits = 0, bad = 0;
  const hud = () => G.hud(state === 'over' ? `النتيجة: ${toAr(hits)} من ${toAr(W)}` : state === 'play' ? `أخطاء مكتشفة ${toAr(hits)} / ${toAr(W)}  ·  محاولات خاطئة ${toAr(bad)} / ٣` : `${toAr(N)} جمل  ·  ${toAr(W)} منها خاطئة`);

  function idle() {
    state = 'idle'; hits = 0; bad = 0;
    strips.forEach((x) => { x.mark = 'open'; x.T.restyle({ color: COL.slate }); x.T.glowGoal = 0; if (x.line) { G.root.remove(x.line); x.line = null; } });
    found.userData.set(0); strikes.userData.set(0); hud();
    G.buttons([{ label: 'ابدأ الفحص', primary: true, onPick: () => { state = 'play'; G.hideCard(); hud(); G.sfx('whoosh'); G.buttons([]); } }]);
  }
  function mark(x) {
    if (state === 'idle') { G.toast('اضغط «ابدأ الفحص» أولاً'); return; }
    if (state !== 'play' || x.mark !== 'open') return;
    if (x.s.wrong) {
      x.mark = 'found'; hits++; x.T.restyle({ color: COL.green }); x.T.glowGoal = 0.9;
      const w = 0.78, line = inkLine([V(w / 2, 0.026, x.z), V(-w / 2, 0.026, x.z)], { r: 0.0022, color: COL.red }); G.root.add(line); x.line = line;
      G.anim(0.5, (p) => line.userData.reveal(p));
      found.userData.set(hits, COL.green); G.sparks(V(0, 0.05, x.z), COL.green, 12); G.sfx('good');
      G.card({ tag: 'خطأ مفاهيمي مكتشف', title: 'التصويب الصحيح', body: x.s.fix, color: COL.green }, 5);
      hud();
      if (hits === W) finish(true);
    } else {
      x.mark = 'clear'; bad++; x.T.restyle({ color: COL.red }); x.T.glowGoal = 0.7;
      G.shake(x.T, 0.01, 0.4); strikes.userData.set(bad, COL.red); G.sfx('bad');
      G.toast('هذه الجملة سليمة ولا خطأ فيها');
      G.after(1.2, () => { if (x.mark === 'clear') { x.T.restyle({ color: COL.slate }); x.T.glowGoal = 0; } });
      hud();
      if (bad >= 3) finish(false);
    }
  }
  function finish(win) {
    state = 'over';
    const missed = strips.filter((x) => x.s.wrong && x.mark !== 'found');
    missed.forEach((x) => { x.T.restyle({ color: COL.amber }); x.T.glowGoal = 0.9; });
    const fixes = S.filter((s) => s.wrong).slice(0, 3).map((s) => s.fix.replace(/\.$/, '')).join(' ؛ ');
    G.end({
      pct: clamp(hits / W - bad * 0.1, 0, 1),
      title: `${toAr(hits)} من ${toAr(W)} أخطاء مفاهيمية`,
      body: (win ? 'أحسنت، كشفت الأخطاء كلها. ' : `استنفدت المحاولات الخاطئة، وأضأتُ لك الأخطاء المتبقية. `) + 'التصويب: ' + fixes + '.',
      color: COL.green, again: idle,
      lines: ['الخطأ المفاهيمي الدقيق يتسلّل في الجمل التي تبدو مألوفة؛ اقرأ كل جملة بسؤال: ما الذي يمكن أن يكون معكوساً فيها؟', 'ما زال بعض الالتباس بين مفهومين متقاربين.', 'قراءة ناقدة جيّدة.', 'قراءة ناقدة متقنة: لم يخدعك التشابه الظاهري.'],
    });
    hud();
  }

  G.ups.push((t) => {
    const ph = Math.sin(t * 0.55) * 0.5 + 0.5;
    const lz = lerp(zMin, zMax, ph), lx = Math.sin(t * 0.37) * 0.24;
    const on = clamp((t - 1.0) / 1.0, 0, 1);
    lens.position.set(lx, 0.07, lz); lens.rotation.y = Math.sin(t * 0.6) * 0.15;
    scan.position.z = lz; scan.visible = on > 0.5;
    strips.forEach((x) => {
      const focus = clamp(1 - (Math.abs(x.z - lz) - 0.02) / 0.06, 0, 1);
      x.fog.material.opacity = (x.mark === 'open' ? 0.5 * (1 - focus) : 0) * (state === 'over' ? 0 : 1);
      if (x.mark === 'open') x.T.glowGoal = focus * 0.55;
      x.T.glowGoal = x.mark === 'open' ? x.T.glowGoal : x.T.glowGoal;
      x.T.goal.y = 0.012 + (x.mark === 'open' ? focus * 0.012 : 0);
      if (x.mark === 'open') x.T.haloMat.color.setHex(COL.gold);
    });
  });

  idle();
  return {};
}
