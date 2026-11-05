// Predict, then reveal. The question sits in the middle of an ink-drawn question mark; each option
// is a coloured light orb (tap it, or use the buttons). The chosen orb flies to the centre, and the
// page itself answers: a frame and a sweep of light run over the printed area.
import * as THREE from 'three';
import {
  P, PAGE_H, INK, ease, easeBack, clamp01, stag, smooth, V, toAr, css, T0, TAU, lightTube, paletteFor, inkPath, circlePts,
  tagSprite, setSpr, softLight, lightPool, packet, printFrame, spotFrame, lerp,
} from '../common.js';

const LET = ['أ', 'ب', 'ج', 'د'];

export function buildQuiz(spec, ctx) {
  const pal = paletteFor(spec, 6);
  const qs = spec.data.questions || [], N = qs.length;
  const crop = spec.crop || [0.15, 0.3, 0.85, 0.7];
  const cu = (crop[0] + crop[2]) / 2, cv = (crop[1] + crop[3]) / 2, cw = crop[2] - crop[0], ch = crop[3] - crop[1];
  const g = new THREE.Group(); ctx.stage.add(g);
  const C = P(spec.center ? spec.center[0] : cu, spec.center ? spec.center[1] : cv, 0);
  const hub = new THREE.Group(); hub.position.copy(C); g.add(hub);

  // the page answers through this frame over the printed area
  const frame = printFrame(cu, cv, Math.min(0.98, cw), Math.min(1, ch), css(pal[0])); g.add(frame);
  const framesByColor = { good: printFrame(cu, cv, Math.min(0.98, cw), Math.min(1, ch), '#3fae4f'), bad: printFrame(cu, cv, Math.min(0.98, cw), Math.min(1, ch), '#e0864a') };
  g.add(framesByColor.good, framesByColor.bad);
  const sweep = lightPool(pal[1], 0.5, 0); sweep.scale.set(Math.min(1, cw) * 1.02, 0.1, 1); sweep.position.copy(P(cu, cv, 0.01)); g.add(sweep);

  // an ink question mark, drawn on and then breathing
  const qpts = (() => {
    const pts = []; const R = 0.075;
    for (let i = 0; i <= 26; i++) { const a = Math.PI * 1.05 - (Math.PI * 1.55 * i) / 26; pts.push(V(Math.cos(a) * R, 0.008, -R - 0.0 - Math.sin(a) * R + 0.0)); }
    pts.push(V(0.0, 0.008, 0.012), V(0.0, 0.008, 0.045));
    return pts;
  })();
  const qmark = inkPath(qpts, { width: 3.6, seed: 7, pen: true, jitter: 0.0014 }); qmark.position.set(0, 0, 0.02); hub.add(qmark);
  const dotQ = inkPath(circlePts(V(0, 0.008, 0.088), 0.008, 12), { width: 3.4, jitter: 0 }); qmark.add(dotQ);
  const qLight = softLight(pal[0], 0.28, 0); qLight.position.y = 0.02; hub.add(qLight);
  const qPool = lightPool(pal[0], 0.25, 0); qPool.position.y = 0.003; hub.add(qPool);

  // progress beads along a light tube below
  const by = cv + ch / 2 + 0.03;
  const beadPos = (i) => P(cu + (i - (N - 1) / 2) * 0.12, Math.min(0.96, by), 0.012);
  const bead = qs.map((_, i) => { const s = softLight(pal[i % pal.length], 0.06, 0); s.position.copy(beadPos(i)); g.add(s); const r = inkPath(circlePts(beadPos(i).setY(0.007), 0.016, 20), { width: 2, color: pal[i % pal.length], jitter: 0.0005, seed: i + 2 }); g.add(r); return { s, r }; });
  const prog = N > 1 ? lightTube(new THREE.LineCurve3(beadPos(0), beadPos(N - 1)), { radius: 0.004, color: pal[0], glass: false }) : null;
  if (prog) { prog.userData.fill(0); g.add(prog); }

  // option orbs
  let orbs = [];
  function makeOrbs(q) {
    orbs.forEach((o) => { hub.remove(o.root); });
    const n = q.options.length;
    orbs = q.options.map((txt, k) => {
      const color = pal[(k + 1) % pal.length];
      const a = -Math.PI / 2 + (k - (n - 1) / 2) * 0.62 + Math.PI;
      const root = new THREE.Group(); hub.add(root);
      const ang = Math.PI + ((k + 0.5) / n) * Math.PI;
      const pos = V(Math.cos(ang) * 0.27, 0.03, Math.sin(ang) * 0.25 - 0.02);
      root.position.copy(pos);
      const light = softLight(color, 0.13, 0.75); light.position.y = 0.01; root.add(light);
      const ring = inkPath(circlePts(V(0, 0.006, 0), 0.03, 30), { width: 2.4, color, jitter: 0.0008, seed: k * 3 + 1 }); root.add(ring);
      const letter = tagSprite(LET[k] || String(k + 1), 0.048, color, { size: 62, width: 150, pad: 12, radius: 62 }); letter.position.y = 0.035; root.add(letter);
      const hit = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.1, 12), new THREE.MeshBasicMaterial({ visible: false })); hit.position.y = 0.03; root.add(hit);
      const pick = () => choose(k);
      ctx.tap(hit, pick); ctx.tap(letter, pick);
      return { root, light, ring, letter, home: pos.clone(), k, color, born: now, fly: 0, out: 0 };
    });
  }

  let now = 0, gate = 0, ready = false, qi = 0, phase = 'idle', chosen = -1, revealAt = -9, score = 0, correct = false, finished = false;
  function askQ() {
    const q = qs[qi]; phase = 'ask'; chosen = -1;
    makeOrbs(q);
    ctx.ui.card({ tag: `تنبّأ أولاً · السؤال ${toAr(qi + 1)} من ${toAr(N)}`, title: q.q, body: 'التزم بتوقّعك، ثم شاهد الصفحة تجيب.', color: pal[qi % pal.length] });
    ctx.ui.choices(q.options.map((o, k) => ({ label: `${LET[k] || ''}  ${o}`, color: css(pal[(k + 1) % pal.length]) + 'e0', onPick: () => choose(k) })));
    ctx.ui.hud(`تنبّأ ثم شاهد · ${toAr(qi + 1)} من ${toAr(N)}`);
  }
  function choose(k) {
    if (!ready || gate < 0.5 || phase !== 'ask') return;
    const q = qs[qi]; chosen = k; correct = k === q.answer; phase = 'reveal'; revealAt = now;
    if (correct) score++;
    ctx.sfx[correct ? 'good' : 'bad']?.();
    ctx.ui.choices([]);
    ctx.fx.burst(C.clone().setY(0.08), correct ? 0x3fae4f : 0xe0864a, 28, 0.45, 0.035);
    ctx.ui.card({ tag: correct ? 'توقّعك صحيح' : 'الإجابة الأدق', title: q.options[q.answer], body: q.why || '', color: correct ? 0x3fae4f : 0xe0864a });
    setTimeout(() => {
      ctx.ui.choices([{ label: qi + 1 < N ? 'السؤال التالي' : 'إنهاء', primary: true, onPick: next }]);
    }, 900);
  }
  function next() {
    ctx.ui.choices([]);
    bead[qi].done = true;
    if (qi + 1 < N) { qi++; askQ(); }
    else {
      phase = 'end';
      ctx.sfx.good?.();
      ctx.ui.card({ tag: 'اكتملت الأسئلة', title: `أصبت ${toAr(score)} من ${toAr(N)}`, body: 'أعد قراءة الصفحة المطبوعة بعد توقّعاتك؛ فالفكرة التي اختبرت نفسك فيها تثبت أكثر.', color: pal[0] });
      if (!finished) { finished = true; ctx.ui.done(); }
    }
  }

  return {
    ready() { ready = true; askQ(); },
    update(t, dt, e, k) {
      now = t; gate = k;
      const dq = stag(t, T0 - 0.6, 1.4, clamp01) * e;
      const early = stag(t, 0.3, 1.2) * (0.55 + 0.45 * Math.sin(t * 2.4));
      qmark.userData.reveal(dq); dotQ.userData.reveal(clamp01((dq - 0.8) * 5));
      qLight.material.opacity = (0.18 + 0.2 * Math.sin(t * 2.2)) * Math.max(early, dq) * e;
      qPool.material.opacity = 0.3 * Math.max(early * 0.8, dq) * e;
      qmark.position.y = Math.sin(t * 1.4) * 0.005;
      // page answers
      const since = t - revealAt;
      const ans = phase === 'reveal' || phase === 'end' || since < 0 ? 0 : 0;
      void ans;
      const showAns = phase === 'reveal' ? ease(since / 0.5) : 0;
      frame.material.opacity = (phase === 'ask' ? 0.35 + 0.15 * Math.sin(t * 2) : 0.12) * dq * e;
      framesByColor.good.material.opacity = correct ? showAns * (0.7 + 0.3 * Math.sin(t * 3)) : 0;
      framesByColor.bad.material.opacity = !correct && phase === 'reveal' ? showAns * (0.7 + 0.3 * Math.sin(t * 3)) : 0;
      if (phase === 'reveal') {
        const f = clamp01(since / 1.6);
        sweep.position.copy(P(cu, lerp(cv - ch / 2, cv + ch / 2, ease(f)), 0.01)); sweep.material.color.setHex(correct ? 0x3fae4f : 0xe0864a); sweep.material.opacity = Math.sin(f * Math.PI) * 0.75;
      } else sweep.material.opacity = 0;
      orbs.forEach((o, i) => {
        const born = stag(t, o.born + 0.12 * i, 0.6, easeBack);
        const isCh = chosen === o.k, right = qs[qi] && o.k === qs[qi].answer;
        o.fly = THREE.MathUtils.damp(o.fly, isCh && phase === 'reveal' ? 1 : 0, 5, dt);
        o.out = THREE.MathUtils.damp(o.out, phase === 'reveal' && !isCh && !right ? 1 : 0, 4, dt);
        o.root.position.set(lerp(o.home.x, 0, o.fly), o.home.y + Math.sin(t * 2 + i * 1.7) * 0.006 + o.fly * 0.04, lerp(o.home.z, 0.0, o.fly));
        o.light.material.opacity = (0.7 * (1 - o.out * 0.8) + (right && phase === 'reveal' ? 0.2 * Math.sin(t * 6) : 0)) * born * e;
        setSpr(o.letter, 0.048, born * (1 + (right && phase === 'reveal' ? 0.25 : 0)) * (1 - o.out * 0.4));
        o.ring.userData.reveal(born);
        o.letter.visible = born > 0.02;
      });
      bead.forEach((b, i) => {
        const db = stag(t, T0 + 0.2 * i, 0.6, clamp01) * e;
        b.r.userData.reveal(db);
        const cur = i === qi && ready && phase !== 'end';
        b.s.material.opacity = ((b.done ? 0.8 : cur ? 0.45 + 0.3 * Math.sin(t * 4) : 0.12)) * db;
      });
      if (prog) { prog.userData.fill(clamp01((qi + (phase === 'reveal' || phase === 'end' ? 1 : 0.0)) / Math.max(1, N - 1)) * e * (ready ? 1 : 0)); prog.userData.update(dt); }
    },
  };
}
