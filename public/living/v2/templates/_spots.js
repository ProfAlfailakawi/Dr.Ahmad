// Shared engine of popup / hotspots: lit rings over printed elements, the printed element is
// framed in light when opened, a light tube draws the connection.
import * as THREE from 'three';
import {
  P, PAGE_H, INK, ease, easeBack, clamp01, stag, V, toAr, css, T0, lightTube, paletteFor, ringMark, inkTicks, bracketPairs,
  spotFrame, tagSprite, setSpr, softLight, arcCurve, packet, TAU,
} from '../common.js';

export function buildSpots(spec, ctx, variant) {
  const hot = variant === 'hotspots';
  const pal = paletteFor(spec, hot ? 1 : 0);
  const spots = spec.data.spots || [];
  const finale = hot ? spec.data.finale : null;
  const g = new THREE.Group(); ctx.stage.add(g);
  const opened = new Set();
  let now = 0, gate = 0, cur = -1, last = -1, ready = false, finished = false, phase = 'explore';

  const items = spots.map((s, i) => {
    const color = pal[i % pal.length];
    const root = new THREE.Group(); root.position.copy(P(s.u, s.v, 0)); g.add(root);
    const mark = ringMark(color, hot ? 0.04 : 0.036, { seed: i * 3 + 1 }); root.add(mark);
    const br = inkTicks(bracketPairs(V(0, 0.006, 0), 0.13, 0.13, 0.026), { color: INK, width: 1.4, opacity: 0.75 });
    if (!hot) root.add(br);
    const badge = tagSprite(s.glyph || toAr(i + 1), 0.062, color, { size: 54, width: 170, pad: 14, radius: 44 });
    badge.position.set(0, 0.06, 0); root.add(badge);
    const hit = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.065, 0.1, 16), new THREE.MeshBasicMaterial({ visible: false })); hit.position.y = 0.04; root.add(hit);
    const frame = spotFrame(s.u, s.v, hot ? 0.19 : 0.17, css(color)); g.add(frame);
    const tag = tagSprite(s.title, 0.26, color, { size: 40, width: 520 }); tag.position.set(0, 0.12, 0); tag.visible = false; root.add(tag);
    // radar ripples (hotspots) keep moving even before anything is touched
    const ripples = hot ? [0, 1].map(() => { const m = new THREE.Mesh(new THREE.RingGeometry(0.93, 1, 48), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0, depthWrite: false, toneMapped: false })); m.rotation.x = -Math.PI / 2; m.position.y = 0.007; m.renderOrder = 2; root.add(m); return m; }) : [];
    const beam = lightTube(new THREE.LineCurve3(V(0, 0.006, 0), V(0, 0.095, 0)), { radius: 0.0045, color, glass: false }); beam.userData.fill(0); root.add(beam);
    const idx = i;
    const pick = () => open(idx);
    ctx.tap(hit, pick); ctx.tap(badge, pick); ctx.tap(tag, pick);
    return { s, i, color, root, mark, br, badge, hit, frame, tag, ripples, beam, openAt: -1, lit: 0 };
  });

  // Constellation: light tubes joining discovered spots in the order they were found.
  const links = [];
  function link(a, b) {
    const A = items[a].root.position.clone().setY(0.008), B = items[b].root.position.clone().setY(0.008);
    const t = lightTube(arcCurve(A, B, 0.03 + A.distanceTo(B) * 0.15), { radius: 0.0055, color: items[b].color });
    t.userData.fill(0); g.add(t); links.push({ t, at: now, color: items[b].color });
  }

  const hudText = () => (hot ? `اكتشفت ${toAr(opened.size)} من ${toAr(items.length)}` : `المس الدوائر المضيئة · ${toAr(opened.size)} من ${toAr(items.length)}`);
  function open(i) {
    if (!ready || gate < 0.5 || phase === 'finale') return;
    const it = items[i];
    if (it.openAt < 0) it.openAt = now;
    const first = !opened.has(i); opened.add(i);
    ctx.sfx.pop?.();
    ctx.fx.burst(it.root.position.clone().setY(0.05), it.color, 16, 0.3, 0.026);
    if (hot && last >= 0 && last !== i && first) link(last, i);
    cur = i; if (first) last = i; else last = i;
    ctx.ui.card({ tag: it.s.glyph ? `${it.s.glyph}` : (hot ? 'اكتشاف' : 'عنصر مطبوع'), title: it.s.title, body: it.s.body, color: it.color });
    ctx.ui.hud(hudText());
    if (opened.size === items.length && !finished) {
      if (finale && finale.options) setTimeout(() => startFinale(), 2200);
      else { finished = true; ctx.ui.done(); }
    }
  }
  function startFinale() {
    if (finished) return;
    phase = 'finale';
    ctx.ui.card({ tag: 'سؤال ختامي', title: finale.q, body: '', color: pal[0] });
    ctx.ui.choices(finale.options.map((o, k) => ({
      label: o, color: css(pal[k % pal.length]) + 'dd',
      onPick: () => {
        const ok = k === finale.answer; ctx.sfx[ok ? 'good' : 'bad']?.();
        ctx.ui.choices([]);
        ctx.ui.card({ tag: ok ? 'إجابة صحيحة' : 'الإجابة الأدق', title: finale.options[finale.answer], body: finale.why || '', color: ok ? 0x3fae4f : 0xe0864a });
        if (ok) items.forEach((it) => ctx.fx.burst(it.root.position.clone().setY(0.05), it.color, 10, 0.3, 0.024));
        finished = true; phase = 'done'; ctx.ui.done();
      },
    })));
  }

  const nextIdx = () => items.findIndex((it) => !opened.has(it.i));
  return {
    ready() { ready = true; ctx.ui.hud(hot ? 'المس كل دائرة لتكتشف ما تخفيه الصورة' : 'المس الدوائر المضيئة'); },
    update(t, dt, e, k) {
      now = t; gate = k;
      const nx = nextIdx();
      items.forEach((it, i) => {
        const dTime = T0 + 0.3 * i;
        const draw = stag(t, dTime, 1.0, clamp01) * e;
        it.mark.userData.reveal(draw);
        // the first spot already breathes with light from the very beginning
        const early = i === 0 ? stag(t, 0.3, 1.2) * (0.55 + 0.45 * Math.sin(t * 2.4)) : 0;
        const norm = draw * (0.55 + 0.25 * Math.sin(t * 2 + i * 1.3) + (i === nx && ready ? 0.35 * (0.5 + 0.5 * Math.sin(t * 4)) : 0));
        const isOpen = opened.has(i);
        it.lit = THREE.MathUtils.damp(it.lit, isOpen ? 1 : 0, 5, dt);
        it.mark.userData.level(Math.max(early, norm) * e + it.lit * 0.5);
        const bt = stag(t, dTime + 0.5, 0.6, easeBack) * e;
        setSpr(it.badge, 0.062, bt * (hot ? 1 - it.tagK : 1)); it.badge.position.y = 0.06 + Math.sin(t * 2 + i) * 0.004 + it.lit * 0.01;
        it.br.userData.reveal(draw); it.br.scale.setScalar(1 + 0.05 * Math.sin(t * 2.2 + i));
        const sel = !hot ? cur === i : isOpen;
        const fo = sel ? clamp01(1 - (t - it.openAt) / 4.5 * (hot ? 0 : 0.15)) : 0;
        it.frame.material.opacity = (hot ? it.lit * 0.55 + (cur === i ? 0.4 * Math.max(0, 1 - (t - it.openAt) / 1.2) : 0) : (cur === i ? 0.95 * (0.75 + 0.25 * Math.sin(t * 3)) : 0)) * e;
        void fo;
        it.beam.userData.fill(sel ? 1 : 0); it.beam.userData.update(dt);
        it.beam.visible = !hot && sel;
        it.tagK = THREE.MathUtils.damp(it.tagK || 0, sel || (hot && isOpen) ? 1 : 0, 9, dt); setSpr(it.tag, 0.26, easeBack(it.tagK)); it.tag.visible = it.tagK > 0.02;
        it.ripples.forEach((r, ri) => {
          const f = (((t * 0.5 + ri * 0.5 + i * 0.17) % 1) + 1) % 1;
          r.scale.setScalar(0.04 + f * 0.1); r.material.opacity = (1 - f) * 0.55 * draw * e * (isOpen ? 0.5 : 1);
        });
      });
      links.forEach((l) => { l.t.userData.fill(clamp01((t - l.at) / 0.9)); l.t.userData.update(dt); });
    },
  };
}
