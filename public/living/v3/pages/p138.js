// p138 — six inkwells in a ring, each with a reed pen: a contribution appears in the middle, tap the scholar whose pen wrote it.
import * as THREE from 'three';
import { P, ease, easeBack, clamp01, stag, glow } from '../../kit.js?v=19';
import { rb, lathe, std, lit, gloss, glass, brass, add, grp, hit, Seq, Pulse, touch, chip, plinth, slab, blob, at, shuffled, TAU, INK, GOLD } from '../lib/a2.js?v=19';

export const meta = { free: true, center: [0.5, 0.7], typeLabel: 'لعبة مطابقة' };

const WHO = [
  { n: 'أبو الأسود', col: 0xd9382b, hud: 'النقط والتشكيل لإصلاح اللسان', title: 'أبو الأسود الدؤلي', body: 'وضع النقط والتشكيل، وسيلة عملية لإصلاح اللسان وإعراب كتاب الله.' },
  { n: 'الخليل', col: 0xe8b82c, hud: 'صاحب أول معجم عربي', title: 'الخليل بن أحمد', body: 'صاحب أول معجم عربي، وشرح مخارج الحروف وصفاتها شرحاً عميقاً ودقيقاً.' },
  { n: 'ابن سينا', col: 0x2a8fd0, hud: 'كتاب «أسباب حدوث الحروف»', title: 'ابن سينا', body: 'شرح مكونات الحنجرة واللسان، ووصف العملية العضوية للأصوات.' },
  { n: 'الجرجاني', col: 0x8aa51f, hud: 'تيسير النحو لأبناء اللغات الأخرى', title: 'الجرجاني', body: 'يسّر النحو العربي في صورة سهلة ليتعلم أبناء اللغات الأخرى القرآن ويفهموا معانيه.' },
  { n: 'علماء المسلمين', col: 0xb5489a, hud: 'العناية بمخارج الحروف للتصدي للحن', title: 'علماء المسلمين', body: 'اهتموا بالجانب الصوتي ومخارج الحروف للتصدي للحن الفاشي في الكلام.' },
  { n: 'زياد', col: 0xef8f2a, hud: 'طلب ما يصلح كلام الناس', title: 'زياد', body: 'طلب ما يصلح كلام الناس بعدما كثر العجم وأفسدوا ألسن العرب.' },
];

export default function build(ctx) {
  const g = new THREE.Group(); g.position.copy(P(meta.center[0], meta.center[1])); ctx.stage.add(g);
  const seq = new Seq(), pulse = new Pulse();
  blob(g, 1.0, 0.75, 0.3);
  const sheetBack = slab(g, 0.84, 0.6, { h: 0.012, color: 0xb98a3e, r: 0.03 }); seq.add(sheetBack, 0, 0.7, { rise: 0.05 });
  const sheet = slab(g, 0.8, 0.56, { y: 0.012, h: 0.006, color: 0xf6e9c6, r: 0.025 }); seq.add(sheet, 0.1, 0.7, { rise: 0.05 });
  const Y0 = 0.02, R = 0.245;

  // centrepiece: a small armillary that spins, with a pulse for the question
  const arm = grp(g, 0, Y0 + 0.07, 0);
  const rings = [0.07, 0.054, 0.038].map((r, i) => { const t = add(arm, new THREE.TorusGeometry(r, 0.0032, 8, 56), brass(), 0, 0, 0, true); t.rotation.set(i * 1.0, i * 0.7, 0); return t; });
  add(arm, new THREE.SphereGeometry(0.016, 20, 14), gloss(0xfff0c0, { emissive: 0xffd27a, emissiveIntensity: 0.6 }), 0, 0, 0);
  add(g, new THREE.CylinderGeometry(0.004, 0.012, 0.07, 10), brass(), 0, Y0 + 0.035, 0);
  arm.scale.setScalar(1.45); seq.add(arm, 0.2, 0.8, { rise: 0.05 });
  const orb = glow(0xfff0b0, 0.1, 0.0); orb.position.set(0, Y0 + 0.07, 0); g.add(orb);

  const wells = WHO.map((w, i) => {
    const a = i * TAU / 6 + Math.PI / 6, x = Math.cos(a) * R, z = Math.sin(a) * R * 0.92;
    const s = grp(g, x, Y0, z); s.rotation.y = -a + Math.PI / 2; s.scale.setScalar(1.3);
    add(s, new THREE.CylinderGeometry(0.056, 0.06, 0.008, 32), std(0xf3ebd9, { roughness: 0.5 }), 0, 0.004, 0, true);
    const body = add(s, lathe([[0.0001, 0.008], [0.036, 0.008], [0.044, 0.02], [0.044, 0.036], [0.034, 0.05], [0.02, 0.056], [0.02, 0.064], [0.0001, 0.064]], 30), gloss(w.col), 0, 0, 0, true);
    add(s, new THREE.TorusGeometry(0.021, 0.0033, 8, 28), brass(), 0, 0.064, 0).rotation.x = Math.PI / 2;
    add(s, new THREE.CircleGeometry(0.018, 24), new THREE.MeshBasicMaterial({ color: 0x14121a }), 0, 0.0642, 0).rotation.x = -Math.PI / 2;
    const pen = grp(s, 0, 0.06, 0); pen.rotation.z = 0.32; pen.rotation.y = 0.5;
    add(pen, new THREE.CylinderGeometry(0.0034, 0.0034, 0.15, 10), std(0xa4713f, { roughness: 0.55 }), 0, 0.06, 0, true);
    add(pen, new THREE.CylinderGeometry(0.0037, 0.0037, 0.008, 10), brass(), 0, 0.105, 0);
    add(pen, new THREE.ConeGeometry(0.0036, 0.016, 10), std(0xa4713f), 0, 0.14, 0);
    const halo = glow(w.col, 0.0, 0.0); halo.position.set(0, 0.07, 0); s.add(halo);
    const dot = add(s, new THREE.SphereGeometry(0.008, 14, 10), brass(), 0.0, 0.012, 0.065); dot.scale.setScalar(1e-4);
    const c = chip(w.n, 0, w.col, { k: 0.6 }); c.position.set(0, 0.02, 0.095); s.add(c);
    hit(s, 0.07, 0, 0.05, 0);
    pulse.add(s, w.col, 0.17, 0, 0.05, 0, { op: 0.4 });
    seq.add(s, 0.3 + i * 0.15, 0.7); seq.add(c, 1.6 + i * 0.08, 0.5);
    return { s, pen, halo, dot, w, i, wx: x, wz: z, solved: false, shake: -1, lift: -1, flash: 0 };
  });

  let order = shuffled([0, 1, 2, 3, 4, 5], 23), qi = -1, nextAt = 2.4, flyT = -1, flyTo = null, ended = false, clock = 0;
  const show = () => { if (qi < 6) ctx.ui.hud(WHO[order[qi]].hud); };
  wells.forEach((o) => touch(ctx, o.s, () => {
    if (qi < 0 || qi >= 6 || flyT >= 0 || o.solved) return;
    if (order[qi] === o.i) {
      o.solved = true; o.lift = 0; o.flash = 1; flyT = 0; flyTo = o; ctx.sfx.good?.();
      ctx.ui.card({ tag: 'رواد التصميم في تراثنا', title: o.w.title, body: o.w.body, color: o.w.col });
      qi++; nextAt = clock + 2.6;
      if (qi >= 6) { ended = true; ctx.ui.hud('أصبت الستة'); ctx.ui.done(); }
    } else { o.shake = 0; ctx.sfx.bad?.(); ctx.ui.toast('ليس هذا، حاول مجدداً'); }
  }, 0xffd27a));

  const tmp = new THREE.Vector3();
  return {
    update(t, dt, e) {
      clock = t; seq.update(t, e); pulse.update(t, e);
      if (qi < 0 && t > nextAt) { qi = 0; show(); }
      if (qi > 0 && qi < 6 && nextAt > 0 && t > nextAt) { nextAt = -1; ctx.ui.hideCard(); show(); }
      rings.forEach((r, i) => { r.rotation.x += dt * (0.5 + i * 0.25); r.rotation.y += dt * (0.3 - i * 0.12); });
      arm.position.y = Y0 + 0.07 + Math.sin(t * 1.2) * 0.004;
      // the question orb
      if (flyT >= 0) {
        flyT += dt; const k = ease(flyT / 0.7);
        orb.position.set(flyTo.wx * k, Y0 + 0.07 + (0.09 - 0.07) * Math.sin(k * Math.PI) + (0.06 - 0.07) * k, flyTo.wz * k);
        orb.material.opacity = 0.95 * e * (1 - clamp01((flyT - 0.55) / 0.2)); orb.scale.setScalar(0.1 * (1 - 0.5 * k));
        if (flyT > 0.85) { flyT = -1; orb.position.set(0, Y0 + 0.07, 0); }
      } else { orb.material.opacity = e * (qi >= 0 && qi < 6 ? 0.55 + 0.3 * Math.sin(t * 3) : 0); orb.scale.setScalar(0.1 + 0.02 * Math.sin(t * 3)); }
      wells.forEach((o) => {
        let sh = 0;
        if (o.shake >= 0) { o.shake += dt; sh = Math.sin(o.shake * 60) * 0.006 * (1 - clamp01(o.shake / 0.5)); if (o.shake > 0.5) o.shake = -1; }
        o.pen.rotation.z = 0.32 + sh * 12;
        if (o.lift >= 0) { o.lift += dt; const k = ease(o.lift / 0.6); o.pen.position.y = 0.06 + 0.018 * k; o.dot.scale.setScalar(Math.max(1e-4, k)); }
        o.flash = Math.max(0, o.flash - dt * 0.6);
        const base = o.solved ? 0.55 : 0; o.halo.material.opacity = e * (base * (0.75 + 0.25 * Math.sin(t * 2 + o.i)) + o.flash * 0.5);
        o.halo.scale.setScalar(0.12 + 0.05 * o.flash + (o.solved ? 0.05 : 0));
      });
    },
  };
}
