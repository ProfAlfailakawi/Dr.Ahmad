// p455: three forks on a round table; a golden marble waits at each fork and rolls to the object you touch. Right choices open the road to the technological teacher; wrong ones roll back.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { P, ease, easeBack, clamp01, stag, mat, glossy, goldMat, glow } from '../../kit.js?v=22';
import { halos, motes, blob, TAU, setSpr } from '../lib/a4-kit.js?v=22';
import { fitTag } from '../lib/a4-kit.js?v=22';

export const meta = { free: true, center: [0.46, 0.46], typeLabel: 'قرار متفرّع', title: 'طريق المعلّم التكنولوجي' };

const TIERS = [
  { z: 0.17, good: -1,
    g: { label: 'ميول كل طالب', title: 'يدرك ميول كل طالب', body: 'المعلم التكنولوجي يدرك ميول كل طالب واحتياجاته الخاصة.' },
    b: { label: 'طريقة واحدة', title: 'طريقة واحدة للجميع', body: 'الطريقة الواحدة لا ترى ميول الطلاب ولا احتياجاتهم الخاصة. عد إلى المفترق واختر طريقاً آخر.' } },
  { z: 0.03, good: 1,
    g: { label: 'تعلّم ذاتي', title: 'يشجّع التعلم الذاتي', body: 'يشجع طلبته على التعلم الذاتي الذي يطوّر شخصياتهم، لتكون فعالة في المجتمع والبيئة المحيطة.' },
    b: { label: 'تلقين', title: 'تلقين من طرف واحد', body: 'التلقين لا يبني تعلماً ذاتياً ولا شخصية فعالة. عد إلى المفترق واختر طريقاً آخر.' } },
  { z: -0.11, good: -1,
    g: { label: 'وسائل هادفة', title: 'وسائل هادفة متوازنة', body: 'يتوافر فيه توازن بين الوسائل التكنولوجية وعدد الطلاب، ووسائل تعليمية مشحونة ببرامج تعليمية هادفة.' },
    b: { label: 'أجهزة بلا هدف', title: 'أجهزة بلا برامج', body: 'الأجهزة وحدها لا تكفي: المطلوب برامج تعليمية هادفة وتوازن مع عدد الطلاب. أعد الاختيار.' } },
];
const GOAL_Z = -0.255, TX = 0.125, SURF = 0.034, HUDS = ['القرار ١ من ٣: أي معلم تريد؟', 'القرار ٢ من ٣: تابع الطريق', 'القرار ٣ من ٣: الأخير'];

function prop(i, good) {
  const g = new THREE.Group();
  const grey = (c = 0xb9b2a4) => mat(c, { roughness: 0.55 });
  if (i === 0 && good) { [[-0.022, 0xef8f2a, 0.014], [0.003, 0x3a86d6, 0.019], [0.027, 0x35b5a8, 0.012]].forEach(([x, c, r]) => { const s = new THREE.Mesh(new THREE.SphereGeometry(r, 18, 12), glossy(c)); s.position.set(x, 0.01 + r, 0); g.add(s); }); }
  else if (i === 0) { [-0.026, 0, 0.026].forEach((x) => { const b = new THREE.Mesh(new RoundedBoxGeometry(0.02, 0.026, 0.02, 2, 0.004), grey()); b.position.set(x, 0.023, 0); g.add(b); }); }
  else if (i === 1 && good) {
    const st = new THREE.Mesh(new THREE.CylinderGeometry(0.0025, 0.004, 0.04, 8), mat(0x4a9a52)); st.position.y = 0.03; g.add(st);
    [[-1, 0.032], [1, 0.044]].forEach(([s, y]) => { const lf = new THREE.Mesh(new THREE.SphereGeometry(0.016, 14, 8), glossy(0x6cc46a)); lf.scale.set(1, 0.3, 0.6); lf.position.set(s * 0.014, y, 0); lf.rotation.z = -s * 0.5; g.add(lf); });
    const tip = new THREE.Mesh(new THREE.SphereGeometry(0.006, 10, 8), glossy(0xffd27a, { emissive: 0xffc94d, emissiveIntensity: 0.5 })); tip.position.y = 0.054; g.add(tip);
  } else if (i === 1) {
    const f = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.006, 0.038, 20, 1, true), new THREE.MeshStandardMaterial({ color: 0xb9b2a4, roughness: 0.4, metalness: 0.5, side: THREE.DoubleSide })); f.position.y = 0.035; g.add(f);
    const sp = new THREE.Mesh(new THREE.CylinderGeometry(0.0045, 0.0045, 0.014, 8), grey()); sp.position.y = 0.011; g.add(sp);
  } else if (i === 2 && good) {
    const t = new THREE.Mesh(new RoundedBoxGeometry(0.06, 0.044, 0.008, 3, 0.004), mat(0x26303c)); t.position.y = 0.036; t.rotation.x = -0.22; g.add(t);
    const sc = new THREE.Mesh(new THREE.PlaneGeometry(0.052, 0.036), new THREE.MeshBasicMaterial({ color: 0xa9d8ff, toneMapped: false })); sc.position.set(0, 0.0, 0.0045); t.add(sc);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.011, 0.0025, 8, 24), goldMat()); ring.position.set(0, 0, 0.006); t.add(ring);
    const dot = new THREE.Mesh(new THREE.CircleGeometry(0.0045, 14), new THREE.MeshBasicMaterial({ color: 0xe8453c, toneMapped: false })); dot.position.set(0, 0, 0.0065); t.add(dot);
    const st = new THREE.Mesh(new THREE.CylinderGeometry(0.003, 0.004, 0.02, 8), goldMat()); st.position.y = 0.014; g.add(st);
  } else { [0, 1, 2].forEach((k) => { const b = new THREE.Mesh(new RoundedBoxGeometry(0.05, 0.011, 0.034, 2, 0.003), grey(0x8e98a1)); b.position.set(0, 0.016 + k * 0.012, 0); b.rotation.y = k * 0.25 - 0.2; g.add(b); }); }
  return g;
}

export default function build(ctx) {
  const g = new THREE.Group(); g.position.copy(P(meta.center[0], meta.center[1])); ctx.stage.add(g); g.scale.setScalar(1.08);
  const hal = halos(), mo = motes(g, 5, { r: 0.34, h: 0.5, color: 0xffe6b0 });
  g.add(blob(0.38, 0.32));

  // ---- round table
  const table = new THREE.Group(); g.add(table);
  const DZ = -0.04, R = 0.31;
  const top = new THREE.Mesh(new THREE.CylinderGeometry(R, R * 0.94, 0.03, 48), glossy(0x2d5c86, { clearcoat: 0.6, roughness: 0.35 })); top.position.set(0, 0.015, DZ); top.castShadow = true; top.receiveShadow = true; table.add(top);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(R, 0.009, 8, 56), goldMat()); rim.rotation.x = Math.PI / 2; rim.position.set(0, 0.03, DZ); table.add(rim);
  const foot = new THREE.Mesh(new THREE.CylinderGeometry(R * 0.94, R * 0.5, 0.05, 48), mat(0x5b4636, { roughness: 0.5 })); foot.position.set(0, -0.025, DZ); table.add(foot);

  const w = new THREE.Group(); w.position.y = SURF; g.add(w); // working plane on the table

  // ---- nodes, tokens, path
  const V = (x, z) => new THREE.Vector3(x, 0, z);
  const N = TIERS.map((t) => V(0, t.z)); const GOAL = V(0, GOAL_Z);
  const pathMat = mat(0xf4efe3, { roughness: 0.45 });
  const tubes = [], pend = [];
  const tube = (curve) => { const g2 = new THREE.TubeGeometry(curve, 16, 0.0065, 6); pend.push(g2); };
  const flush = (delay) => { const geo = mergeGeometries(pend.splice(0)); const m = new THREE.Mesh(geo, pathMat); m.position.y = 0.004; m.scale.y = 0.6; m.userData = { idx: geo.index.count, delay }; w.add(m); tubes.push(m); };
  const seg = (a, b, lift = 0) => lift ? new THREE.QuadraticBezierCurve3(a, a.clone().lerp(b, 0.5).add(V(lift, 0)), b) : new THREE.LineCurve3(a, b);
  const toks = [], legs = [];
  TIERS.forEach((t, i) => {
    const gx = t.good * TX, bx = -t.good * TX;
    const gp = V(gx, t.z), bp = V(bx, t.z), next = i < 2 ? N[i + 1] : GOAL;
    legs.push({ toG: seg(N[i], gp), toB: seg(N[i], bp), on: seg(gp, next, -t.good * 0.03) });
    tube(legs[i].toG); tube(legs[i].toB); tube(legs[i].on); flush(0.8 + i * 0.5);
    [[true, gp], [false, bp]].forEach(([good, p]) => {
      const d = good ? t.g : t.b, tk = new THREE.Group(); tk.position.copy(p); w.add(tk);
      const pl = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.045, 0.016, 28), glossy(0xf4efe3)); pl.position.y = 0.008; tk.add(pl);
      const pp = prop(i, good); pp.position.y = 0.012; tk.add(pp);
      const lb = fitTag(d.label, good ? 0xd4ad55 : 0x8fa6b5, { size: 46, style: 'paper' }); lb.position.set(p.x, 0.115 + SURF, p.z); g.add(lb); setSpr(lb, lb.userData.w, 0);
      const hl = hal.add(tk, 0xffd27a, 0.15, [0, 0.03, 0], 9999); hl.on = 0;
      const o = { tk, good, i, d, lb, hl, k: 0, dim: 0, shake: 0, x: p.x, z: p.z, pp };
      ctx.tap(tk, () => pick(o));
      toks.push(o);
    });
  });
  tube(seg(V(0, 0.255), N[0])); flush(0.6);
  // goal gate + silhouette
  const gate = new THREE.Group(); gate.position.set(0, 0, GOAL_Z); gate.scale.setScalar(1.3); w.add(gate);
  const gp0 = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.056, 0.012, 28), glossy(0xf4efe3)); gp0.position.y = 0.006; gate.add(gp0);
  [-0.05, 0.05].forEach((x) => { const c = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.01, 0.09, 12), goldMat()); c.position.set(x, 0.045, 0); c.castShadow = true; gate.add(c); });
  const arch = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.0075, 10, 32, Math.PI), goldMat()); arch.position.y = 0.09; arch.castShadow = true; gate.add(arch);
  const figMat = mat(0x6b7885, { roughness: 0.5 });
  const fig = new THREE.Group(); gate.add(fig);
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.018, 0.05, 16), figMat); body.position.y = 0.03; fig.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.012, 16, 12), figMat); head.position.y = 0.066; fig.add(head);
  const ptr = new THREE.Mesh(new THREE.CylinderGeometry(0.0013, 0.0013, 0.06, 6), goldMat()); ptr.position.set(0.026, 0.06, 0); ptr.rotation.z = -0.7; fig.add(ptr);
  const gl = glow(0xffe29a, 0.3, 0); gl.position.y = 0.06; gate.add(gl);
  const goalTag = fitTag('المعلم التكنولوجي', 0xd4ad55, { size: 46, style: 'paper' }); goalTag.position.set(0, 0.24 + SURF, GOAL_Z); g.add(goalTag); setSpr(goalTag, goalTag.userData.w, 0);
  // pips
  const pips = [-0.07, 0, 0.07].map((x) => { const p = new THREE.Mesh(new THREE.SphereGeometry(0.011, 14, 10), mat(0x9db4c6, { roughness: 0.4 })); p.position.set(x, 0.012, 0.235); w.add(p); return p; });
  // marble
  const marble = new THREE.Group(); w.add(marble);
  const mb = new THREE.Mesh(new THREE.SphereGeometry(0.017, 24, 16), glossy(0xffc94d, { emissive: 0xffa000, emissiveIntensity: 0.5, metalness: 0.5 })); mb.castShadow = true; marble.add(mb);
  const mg = glow(0xfff0b8, 0.15, 0.8); marble.add(mg);
  const mpos = new THREE.Vector3().copy(N[0]);

  // ---- game state
  let tier = 0, busy = true, now = 0, done = false, mv = null, mvT = 0, tmr = [];
  const tm = (fn, ms) => { tmr.push(setTimeout(fn, ms)); };
  const tmp = new THREE.Vector3();
  const roll = (curve, dur, cb, rev = false) => { mv = { curve, dur, cb, rev }; mvT = 0; };
  const show = (i) => { toks.forEach((o) => { o.active = o.i === i && !done; }); };
  ctx.ui.hud(HUDS[0]);

  function pick(o) {
    if (busy || now < 5.2 || o.i !== tier) return;
    busy = true; ctx.sfx.pop?.();
    const L = legs[tier];
    roll(o.good ? L.toG : L.toB, 0.7, () => {
      const wp = o.tk.getWorldPosition(new THREE.Vector3()); wp.y += 0.05;
      if (o.good) {
        ctx.sfx.good?.(); ctx.fx.burst(wp, 0xffd27a, 18, 0.3, 0.03); o.lit = true; o.hl.on = 1.3;
        pips[tier].material = glossy(0xffc94d, { emissive: 0xffa000, emissiveIntensity: 0.6 });
        ctx.ui.card({ tag: `القرار ${['', '١', '٢', '٣'][tier + 1]} من ٣`, title: o.d.title, body: o.d.body, color: 0xd4ad55 });
        tm(() => {
          const last = tier === 2;
          roll(L.on, 0.9, () => {
            if (last) finish(); else { tier++; busy = false; ctx.ui.hud(HUDS[tier]); }
          });
        }, 1100);
      } else {
        ctx.sfx.bad?.(); ctx.fx.burst(wp, 0x8fa6b5, 10, 0.2, 0.025); o.shake = 1; o.dim = 1;
        ctx.ui.card({ tag: 'ليس هذا الطريق', title: o.d.title, body: o.d.body, color: 0x8fa6b5 });
        tm(() => roll(L.toB, 0.7, () => { busy = false; }, true), 900);
      }
    });
  }
  function finish() {
    done = true; fin = 0; ctx.sfx.good?.();
    const wp = gate.getWorldPosition(new THREE.Vector3()); wp.y += 0.08; ctx.fx.burst(wp, 0xffd27a, 50, 0.5, 0.04);
    ctx.ui.card({ tag: 'اكتمل الطريق', title: 'المعلم التكنولوجي', body: 'يدرك ميول طلبته، ويشجعهم على التعلم الذاتي، ويوظف وسائل تعليمية هادفة ومتوازنة.', color: 0xd4ad55 });
    ctx.ui.hud('وصلت: معلم تكنولوجي');
    tm(() => ctx.ui.done(), 900);
  }
  let fin = -1;
  ctx.tap(gate, () => { if (done) ctx.ui.card({ tag: 'الغاية', title: 'المعلم التكنولوجي', body: 'يدرك ميول طلبته، ويشجعهم على التعلم الذاتي، ويوظف وسائل تعليمية هادفة ومتوازنة.', color: 0xd4ad55 }); });

  return {
    update(t, dt, e) {
      now = t; hal.update(t, e); mo.update(t, dt, e);
      const kt = stag(t, 0.1, 0.8, easeBack) * e;
      table.scale.setScalar(Math.max(kt, 0.0001)); table.visible = kt > 0.002; w.visible = kt > 0.4; w.scale.setScalar(Math.max(kt, 0.0001));
      tubes.forEach((m) => { const p = stag(t, m.userData.delay, 0.7) * e; m.geometry.setDrawRange(0, Math.floor(m.userData.idx / 6 * p) * 6); m.visible = p > 0.01; });
      if (t > 4.4 && busy && !mv && tier === 0 && !done && !toks[0].started) { toks.forEach((o) => { o.started = true; }); busy = false; }
      // marble
      if (mv) {
        mvT = Math.min(1, mvT + dt / mv.dur); const u = ease(mvT);
        mv.curve.getPoint(mv.rev ? 1 - u : u, mpos);
        marble.userData.hop = Math.sin(u * Math.PI) * 0.02;
        if (mvT >= 1) { const cb = mv.cb; mv = null; cb(); }
      } else marble.userData.hop = 0;
      marble.position.x = mpos.x; marble.position.z = mpos.z;
      marble.position.y = 0.019 + (marble.userData.hop || 0) + Math.sin(t * 3) * 0.003 * (mv ? 0 : 1);
      mb.rotation.x += dt * 4; mg.material.opacity = (0.55 + 0.25 * Math.sin(t * 4)) * kt;
      // tokens
      toks.forEach((o) => {
        const act = o.i === tier && !done, appear = stag(t, 1.3 + o.i * 0.5, 0.7, easeBack) * e;
        o.k = THREE.MathUtils.damp(o.k, act && !busy ? 1 : (act ? 0.7 : 0), 6, dt);
        o.dim = THREE.MathUtils.damp(o.dim, o.dim > 0.5 && !o.good ? 1 : 0, 3, dt);
        o.shake = Math.max(0, o.shake - dt * 1.6);
        o.tk.scale.setScalar(Math.max(0.0001, appear * (act ? 1 + 0.04 * Math.sin(t * 3 + o.i) : 0.88) * (1 - 0.1 * o.dim)));
        o.tk.position.x = o.x + Math.sin(t * 40) * 0.006 * o.shake;
        o.pp.rotation.y += dt * (act ? 0.8 : 0.2);
        if (!o.lit) o.hl.on = act && !busy ? 0.9 : 0.0;
        o.hl.appear = 0;
        setSpr(o.lb, o.lb.userData.w, easeBack(o.k) * appear * (act ? 1 : 0));
        o.lb.visible = o.lb.scale.x > 0.001;
      });
      // goal
      if (fin >= 0) fin = Math.min(1, fin + dt / 1.2);
      const f = Math.max(0, fin);
      figMat.color.setHex(0x6b7885).lerp(tmp2.setHex(0xe8a317), f); figMat.emissive.setHex(0xffa000); figMat.emissiveIntensity = f * 0.6;
      fig.position.y = f * 0.012 + Math.sin(t * 2) * 0.002 * f; fig.scale.setScalar(1 + f * 0.25);
      gl.material.opacity = f * (0.7 + 0.2 * Math.sin(t * 3)) * e; gl.scale.setScalar(0.3 + f * 0.1);
      setSpr(goalTag, goalTag.userData.w, easeBack(f) * e); goalTag.visible = f > 0.02;
    },
    onLost() { tmr.forEach(clearTimeout); },
  };
}
const tmp2 = new THREE.Color();
