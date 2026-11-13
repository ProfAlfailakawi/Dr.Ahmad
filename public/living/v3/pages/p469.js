// p469 — a concept map as a hanging mobile: the future of educational technology balances on a brass stand; every idea hangs from the one it depends on.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { P, ease, easeBack, clamp01, stag, mat, glossy, goldMat, shadowed, glow } from '../../kit.js?v=32';
import { inked } from '../../pencil.js?v=32';
import { lightPool } from '../../v2/common.js?v=32';
import { Seq, Hints, Tag, TAU, V, wpos, softShadow } from '../lib/a9-kit.js?v=32';

export const meta = { free: true, center: [0.5, 0.575], typeLabel: 'مجسّم معلّق', title: 'شبكة مستقبل التعليم' };

const N = {
  t: { t: 'مستقبل تكنولوجيا التعليم', tag: 'المستقبل', b: 'يتمحور حول طرق الوصول إلى المعلومات والتعلم في جميع الأمكنة، والتعاون على الصعيدين المحلي والعالمي.', c: 0xe5258f },
  cl: { t: 'تطبيقات السحب', tag: 'السحب', b: 'من الهواجس المستقبلية للتربويين توظيف تطبيقات السحب (cloud) في التعليم.', c: 0x4fb3e8 },
  inf: { t: 'البنى التحتية', tag: 'البنى التحتية', b: 'يتطلب ذلك خوادم سريعة وإنترنت ذا سرعات عالية.', c: 0x39414f },
  pl: { t: 'منصات التعلم', tag: 'منصات التعلم', b: 'سيتمكن الطلاب من خلال منصات التعليم وبحواسيبهم وهواتفهم الذكية من القيام بجميع الأعمال التعليمية.', c: 0xe5258f },
  rm: { t: 'التعليم عن بعد', tag: 'عن بُعد', b: 'سيصبح سمة المستقبل وبريق أمله، ويمتد ليشمل الطلبة المحليين والدوليين.', c: 0x2a9d8f },
  so: { t: 'تعلّم اجتماعي', tag: 'تعلّم اجتماعي', b: 'ينتهي المسار إلى تعليم يصبح اجتماعياً بين الطلبة والمعلمين.', c: 0xef8f2a },
};

export default function build(ctx) {
  const g = new THREE.Group(); g.position.copy(P(meta.center[0], meta.center[1])); ctx.stage.add(g); g.scale.setScalar(0.95);
  const seq = new Seq(), hints = new Hints(g, 6.0), tag = new Tag(g, 0.21);
  const brass = goldMat(), seen = new Set(); let finished = false, now = 0;
  const strMat = new THREE.MeshBasicMaterial({ color: 0x6b5a3c });

  const shadow = softShadow(0.7, 0.3, 0.28); g.add(shadow);
  const pool = lightPool(0xffe3b0, 0.3, 0.35); pool.position.y = 0.004; g.add(pool);
  // brass stand with a curved arm
  const px = 0.3;
  const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, 0.018, 36), brass); foot.position.set(px, 0.009, 0); g.add(shadowed(foot));
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.008, 0.52, 12), brass); pole.position.set(px, 0.27, 0); g.add(shadowed(pole));
  const arm = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([V(px, 0.55, 0), V(px - 0.03, 0.585, 0), V(px - 0.14, 0.595, 0), V(px - 0.26, 0.58, 0), V(0.0, 0.57, 0)].slice(0, 4).concat([V(0.02, 0.565, 0)])), 40, 0.0055, 8), brass); g.add(arm);
  const knob = new THREE.Mesh(new THREE.SphereGeometry(0.011, 14, 10), brass); knob.position.set(px, 0.57, 0); g.add(knob);
  seq.add(foot, 0.5, 0.7); seq.add(pole, 0.7, 0.8); seq.add(arm, 1.0, 0.8); seq.add(knob, 1.2, 0.4);
  const HOOK = V(0.02, 0.565, 0);

  const pivots = [];
  // a swinging hanger: pivot at `pos` inside `parent`, a string of length `len`, the child hangs at the end
  function hang(parent, pos, len, depth, delay) {
    const pv = new THREE.Group(); pv.position.copy(pos); parent.add(pv);
    const s = new THREE.Mesh(new THREE.CylinderGeometry(0.0022, 0.0022, len, 5), strMat); s.position.y = -len / 2; pv.add(s);
    const end = new THREE.Group(); end.position.y = -len; pv.add(end);
    const st = { pv, a: 0, v: 0, k: 9 + depth * 3, depth, ph: depth * 1.7 + pos.x * 5 };
    pivots.push(st); seq.add(pv, delay, 0.9);
    return { pv, end, st };
  }
  const spr = (grp, r) => grp; // placeholder to keep nodes simple
  const hits = {};
  function node(key, parentEnd, st, build) {
    const grp = new THREE.Group(); parentEnd.add(grp); grp.position.y = 0; grp.scale.setScalar(1.3); build(grp, N[key].c);
    const hit = new THREE.Mesh(new THREE.SphereGeometry(0.052, 10, 8), new THREE.MeshBasicMaterial({ visible: false })); hit.position.y = -0.0; grp.add(hit);
    const halo = glow(N[key].c, 0.17, 0.35); grp.add(halo);
    const hint = hints.add(V(), N[key].c, 0.14);
    hits[key] = { grp, st, key, halo, hint };
    ctx.tap(grp, () => touch(key));
    return grp;
  }
  function touch(key) {
    const h = hits[key]; ctx.sfx.pop?.(); h.st.v += 2.4; if (h.st.pv.parent && h.st.depth > 0) { /* children swing with it */ }
    ctx.ui.card({ tag: 'فكرة', title: N[key].t, body: N[key].b, color: N[key].c });
    const wp = V(); h.grp.getWorldPosition(wp); g.worldToLocal(wp); tag.show(N[key].tag, wp.add(V(0, 0.085, 0)), N[key].c); h.hint.on = false;
    ctx.fx.burst(wpos(g, wp), N[key].c, 14, 0.2, 0.025);
    seen.add(key);
    if (seen.size === 6 && !finished) { finished = true; setTimeout(() => { ctx.fx.burst(wpos(g, V(0, 0.35, 0)), 0xffd27a, 50, 0.55, 0.04); ctx.ui.done(); ctx.ui.hud('الشبكة كلها متوازنة'); }, 900); }
  }
  const ball = (r, c, o = {}) => new THREE.Mesh(new THREE.SphereGeometry(r, 24, 16), glossy(c, { roughness: 0.3, ...o }));

  // level 0: the future (with a mortarboard)
  const H0 = hang(g, HOOK, 0.07, 0, 1.4);
  node('t', H0.end, H0.st, (n, c) => {
    const b = ball(0.042, c); n.position.y = -0.0; b.position.y = -0.0; n.add(shadowed(b));
    const cap = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.005, 0.075), mat(0x2b2620)); cap.rotation.y = Math.PI / 4; cap.position.y = 0.04; n.add(cap);
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.024, 0.016, 16), mat(0x2b2620)); base.position.y = 0.03; n.add(base);
    const tas = new THREE.Mesh(new THREE.CylinderGeometry(0.0012, 0.0012, 0.03, 5), goldMat()); tas.position.set(0.034, 0.025, 0.0); n.add(tas);
  });
  // level 1: a long rod carrying three ideas
  const H1 = hang(H0.end, V(0, -0.05, 0), 0.05, 1, 1.7);
  const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.48, 10), brass); rod.rotation.z = Math.PI / 2; H1.end.add(rod);
  [-0.24, 0.24].forEach((x) => { const e = new THREE.Mesh(new THREE.SphereGeometry(0.008, 10, 8), brass); e.position.set(x, 0, 0); H1.end.add(e); });
  const A_rm = hang(H1.end, V(-0.24, 0, 0), 0.08, 2, 2.0), A_cl = hang(H1.end, V(0, 0, 0), 0.1, 2, 2.2), A_pl = hang(H1.end, V(0.24, 0, 0), 0.08, 2, 2.4);
  node('rm', A_rm.end, A_rm.st, (n, c) => {
    n.position.y = -0.04; const gl = ball(0.04, c); n.add(shadowed(gl));
    const eq = new THREE.Mesh(new THREE.TorusGeometry(0.041, 0.0014, 6, 40), mat(0xe8f4f0)); eq.rotation.x = Math.PI / 2; n.add(eq);
    const mer = new THREE.Mesh(new THREE.TorusGeometry(0.041, 0.0014, 6, 40), mat(0xe8f4f0)); n.add(mer);
    const sg = new THREE.Mesh(new THREE.TorusGeometry(0.058, 0.0018, 6, 50, Math.PI * 1.2), new THREE.MeshBasicMaterial({ color: 0xffd27a, toneMapped: false })); sg.rotation.x = Math.PI / 2.6; n.add(sg); n.userData.spin = sg;
  });
  node('cl', A_cl.end, A_cl.st, (n, c) => {
    n.position.y = -0.03; [[0, 0, 0.032], [-0.03, -0.008, 0.024], [0.03, -0.008, 0.026], [0.012, 0.014, 0.022]].forEach(([x, y, r]) => { const s = ball(r, c, { roughness: 0.4 }); s.position.set(x, y, 0); n.add(shadowed(s)); });
    const bot = new THREE.Mesh(new THREE.CapsuleGeometry(0.018, 0.05, 4, 10), glossy(c)); bot.rotation.z = Math.PI / 2; bot.position.set(0, -0.02, 0); n.add(bot);
  });
  node('pl', A_pl.end, A_pl.st, (n, c) => {
    n.position.y = -0.03; const base = new THREE.Mesh(new RoundedBoxGeometry(0.08, 0.007, 0.055, 3, 0.003), glossy(0x2b2e36)); base.position.y = -0.02; n.add(shadowed(base));
    const lid = new THREE.Group(); lid.position.set(0, -0.017, -0.026); lid.rotation.x = -0.15; n.add(lid);
    const l = new THREE.Mesh(new RoundedBoxGeometry(0.08, 0.055, 0.005, 3, 0.002), glossy(0x2b2e36)); l.position.y = 0.028; lid.add(l);
    const s = new THREE.Mesh(new THREE.PlaneGeometry(0.07, 0.045), new THREE.MeshBasicMaterial({ color: c, toneMapped: false })); s.position.set(0, 0.028, 0.0028); lid.add(s);
  });
  // level 2
  const B_so = hang(A_rm.end, V(0, -0.075, 0), 0.08, 3, 2.7), B_inf = hang(A_cl.end, V(0, -0.075, 0), 0.08, 3, 2.7);
  node('so', B_so.end, B_so.st, (n, c) => {
    n.position.y = -0.03; [-0.024, 0.0, 0.024].forEach((x, i) => { const b = new THREE.Mesh(new THREE.CapsuleGeometry(0.011, 0.022, 4, 10), mat([0xef8f2a, 0x2a8fd0, 0x2fae8f][i])); b.position.set(x, -0.01 + (i === 1 ? 0.01 : 0), i === 1 ? 0.006 : 0); n.add(shadowed(b)); const h = new THREE.Mesh(new THREE.SphereGeometry(0.0105, 12, 8), mat(0xf1bd96)); h.position.set(x, 0.017 + (i === 1 ? 0.01 : 0), i === 1 ? 0.006 : 0); n.add(h); });
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.04, 0.0025, 6, 40), new THREE.MeshBasicMaterial({ color: c, toneMapped: false })); ring.rotation.x = Math.PI / 2; ring.position.y = -0.03; n.add(ring);
  });
  node('inf', B_inf.end, B_inf.st, (n, c) => {
    n.position.y = -0.03; for (let i = 0; i < 3; i++) { const b = new THREE.Mesh(new RoundedBoxGeometry(0.06, 0.017, 0.042, 3, 0.004), glossy(c)); b.position.y = -0.022 + i * 0.02; n.add(shadowed(b)); const led = new THREE.Mesh(new THREE.SphereGeometry(0.0022, 6, 5), new THREE.MeshBasicMaterial({ color: 0x4cf08a, toneMapped: false })); led.position.set(0.02, -0.022 + i * 0.02, 0.022); n.add(led); }
  });
  const tm = V();
  Object.values(hits).forEach((h) => { h.hint.h.visible = true; });

  ctx.ui.hud('المس فكرة لتهتز الشبكة');

  return {
    update(t, dt, e) {
      now = t; seq.update(t, e); hints.update(t, e); tag.update(dt, e);
      if (t > 1.6 && !g.userData.kick) { g.userData.kick = 1; pivots.forEach((p) => { p.v += 0.5 + p.depth * 0.2; }); }
      pivots.forEach((p) => {
        const force = Math.sin(t * 0.9 + p.ph) * 0.15;
        p.v += (-p.k * p.a - 0.55 * p.v + force) * dt; p.a += p.v * dt; p.pv.rotation.z = p.a; p.pv.rotation.x = p.a * 0.3;
      });
      Object.values(hits).forEach((h) => { h.grp.getWorldPosition(tm); g.worldToLocal(tm); h.hint.h.position.copy(tm); h.halo.scale.setScalar(0.17 + 0.015 * Math.sin(t * 3)); });
      hits.rm.grp.userData.spin && (hits.rm.grp.userData.spin.rotation.z = t);
      pool.material.opacity = 0.35 * e;
    },
  };
}
