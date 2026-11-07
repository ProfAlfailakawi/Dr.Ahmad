import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { P, ease, easeBack, clamp01, stag, mat, glossy, goldMat, shadowed, glow, sprite, lightTube } from '../../kit.js?v=15';
import { inked } from '../../pencil.js?v=15';
import { Rig, badge, V, TAU } from '../lib/a5-kit.js?v=15';
import { lightPool } from '../../v2/common.js?v=15';

export const meta = { free: true, center: [0.28, 0.3], typeLabel: 'مواقف تطبيقية' };

const hx = (c) => '#' + c.toString(16).padStart(6, '0');
const LM = [
  { t: 'للطلاب العاملين', c: 0xef8f2a, x: -0.22, y: 0.09, z: 0.1, n: 'إتاحة الفرصة للطلاب العاملين لإتمام تعليمهم دون الحاجة لترك أعمالهم.', lz: 0.09 },
  { t: 'من أي مكان', c: 0x2a8fd0, x: -0.12, y: 0.25, z: -0.02, n: 'يكفي حضور قاعة الجامعة الافتراضية والمشاركة فيها من أي جهاز حاسوب متصل بالإنترنت.' },
  { t: 'تحديث فوري', c: 0x2fa38a, x: 0.0, y: 0.09, z: 0.1, n: 'السرعة والمرونة في تطوير المنهج والحصول الفوري على أحدث التعديلات.', lz: 0.09 },
  { t: 'كلفة أقل', c: 0xe3b23c, x: 0.12, y: 0.25, z: -0.02, n: 'انخفاض الكلفة التعليمية مقارنة بالنمط التقليدي للتعلم.' },
  { t: 'شهادات عالمية', c: 0x5a6fd6, x: 0.22, y: 0.09, z: 0.1, n: 'عالمية الشهادات وإلغاء الحواجز بين الدول.', lz: 0.09 },
];
const Q = [
  { who: 'briefcase', title: 'موظف يريد إتمام دراسته', body: 'موظف بدوام كامل يريد إتمام دراسته الجامعية دون ترك عمله. أيّ ميزة تخدمه؟', a: 0 },
  { who: 'plane', title: 'طالبة انتقلت إلى بلد آخر', body: 'انتقلت في منتصف دراستها إلى بلد آخر، وتريد مواصلة مقرراتها دون أن تتأثر بالانتقال.', a: 1 },
  { who: 'bolt', title: 'تعديل مقرر يصل فوراً', body: 'عدّلت الجامعة محتوى مقرر ليواكب المستجدات، فوصل التعديل إلى الطلبة فور إقراره.', a: 2 },
];
const HUB = V(0, 0.38, -0.08);

function building(i, c) {
  const t = new THREE.Group(); const m = glossy(c, { roughness: 0.3 });
  if (i === 0) { const b = new THREE.Mesh(new RoundedBoxGeometry(0.05, 0.13, 0.05, 2, 0.007), m); b.position.y = 0.07; t.add(shadowed(b)); const w = new THREE.Mesh(new THREE.PlaneGeometry(0.03, 0.09), new THREE.MeshStandardMaterial({ color: 0xfff1b8, emissive: 0xffd27a, emissiveIntensity: 0.6 })); w.position.set(0, 0.07, 0.0255); t.add(w); }
  else if (i === 1) { const s = new THREE.Mesh(new THREE.SphereGeometry(0.048, 28, 18), glossy(c, { transparent: true, opacity: 0.8 })); s.position.y = 0.06; t.add(s); const r = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.0035, 8, 36), goldMat()); r.position.y = 0.06; r.rotation.set(1.1, 0.3, 0); t.add(r); t.userData.spin = r; }
  else if (i === 2) { const b = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.034, 0.12, 18), m); b.position.y = 0.065; t.add(shadowed(b)); const cn = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.06, 18), goldMat()); cn.position.y = 0.155; t.add(cn); }
  else if (i === 3) { const b = new THREE.Mesh(new RoundedBoxGeometry(0.09, 0.06, 0.055, 2, 0.007), m); b.position.y = 0.035; t.add(shadowed(b)); const c2 = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.007, 22), goldMat()); c2.position.y = 0.085; c2.rotation.x = Math.PI / 2; t.add(c2); t.userData.spin = c2; }
  else { const a = new THREE.Mesh(new THREE.TorusGeometry(0.042, 0.011, 10, 24, Math.PI), m); a.position.y = 0.04; t.add(shadowed(a)); const f = new THREE.Mesh(new THREE.CylinderGeometry(0.0035, 0.0035, 0.09, 6), goldMat()); f.position.y = 0.09; t.add(f); const fl = new THREE.Mesh(new THREE.PlaneGeometry(0.04, 0.025), new THREE.MeshStandardMaterial({ color: c, side: THREE.DoubleSide })); fl.geometry.translate(0.02, 0, 0); fl.position.set(0, 0.125, 0); t.add(fl); t.userData.flag = fl; }
  return t;
}

export default function build(ctx) {
  const g = new THREE.Group(); g.position.copy(P(meta.center[0], meta.center[1])); g.scale.setScalar(1.0); g.position.x += 0.1; ctx.stage.add(g);
  const rig = new Rig(ctx);
  const pool = lightPool(0x2f6f78, 0.4, 0); pool.position.y = 0.002; pool.scale.set(0.95, 0.95, 0.7); g.add(pool); rig.fn((p) => { pool.material.opacity = 0.28 * p; }, 0.1, 1);

  // hub: glass dome island
  const hub = new THREE.Group(); hub.position.copy(HUB); g.add(hub);
  const rockH = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.12, 30), mat(0x8a6b4f, { roughness: 0.9 })); rockH.rotation.x = Math.PI; rockH.position.y = -0.06; hub.add(shadowed(rockH));
  const topH = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.016, 40), glossy(0xf6efe0)); hub.add(topH);
  const dome = new THREE.Mesh(new THREE.SphereGeometry(0.085, 40, 20, 0, TAU, 0, Math.PI / 2), new THREE.MeshPhysicalMaterial({ color: 0xcfeff6, transparent: true, opacity: 0.4, roughness: 0.08, side: THREE.DoubleSide, depthWrite: false })); dome.position.y = 0.008; hub.add(dome);
  for (let i = 0; i < 4; i++) { const r = new THREE.Mesh(new THREE.TorusGeometry(0.085, 0.003, 6, 40, Math.PI), goldMat()); r.position.y = 0.008; r.rotation.y = (i / 4) * Math.PI; hub.add(r); }
  const core = glow(0xffd27a, 0.14, 0.9); core.position.y = 0.04; hub.add(core);

  // islands + light bridges
  const isl = LM.map((l, i) => {
    const grp = new THREE.Group(); grp.position.set(l.x, l.y, l.z); g.add(grp);
    const rock = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.09, 24), mat(0x8a6b4f, { roughness: 0.9 })); rock.rotation.x = Math.PI; rock.position.y = -0.045; grp.add(shadowed(rock));
    const topD = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.014, 32), glossy(0xf6efe0)); grp.add(shadowed(topD));
    const band = new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.004, 8, 40), new THREE.MeshStandardMaterial({ color: l.c, emissive: l.c, emissiveIntensity: 0.4 })); band.rotation.x = Math.PI / 2; band.position.y = 0.007; grp.add(band);
    const top = building(i, l.c); top.position.y = 0.007; grp.add(top);
    const start = V(HUB.x, HUB.y - 0.02, HUB.z), end = V(l.x, l.y + 0.03, l.z);
    const curve = new THREE.CatmullRomCurve3([start, V((start.x + end.x) / 2, Math.max(start.y, end.y) + 0.04, (start.z + end.z) / 2), end]);
    const tube = lightTube(curve, { radius: 0.0045, color: l.c, speed: 0.5 }); g.add(tube);
    const lab = sprite(l.t, 0.19, { size: 54, width: 440, weight: 800, border: hx(l.c) }); lab.userData.w = 0.19;
    lab.position.set(l.x, l.lz ? 0.012 : l.y - 0.1, l.lz ? l.z + l.lz : l.z); g.add(lab);
    return { grp, band, top, l, i, tube, lab, curve, flash: -9, bad: -9 };
  });

  // student pin
  const pin = new THREE.Group(); g.add(pin); pin.visible = false;
  const body = inked(new THREE.CapsuleGeometry(0.02, 0.036, 6, 16), { color: 0xfff2dc }); body.position.y = 0.05; pin.add(body);
  const head = inked(new THREE.SphereGeometry(0.019, 18, 12), { color: 0xfff2dc }); head.position.y = 0.105; pin.add(head);
  const who = badge('briefcase', 0xd4ad55, 0.07); who.position.y = 0.17; pin.add(who);
  const PIN0 = V(HUB.x, HUB.y + 0.03, HUB.z + 0.09);

  let qi = -1, st = 'idle', t0 = 0, now = 0, solved = 0, finished = false, target = null;
  function ask() {
    qi++; if (qi >= Q.length) return;
    const q = Q[qi]; st = 'drop'; t0 = now; pin.visible = true;
    who.material.map = badge(q.who, 0xd4ad55, 0.07).material.map; who.material.needsUpdate = true;
    ctx.ui.card({ tag: `موقف ${qi + 1} من ${Q.length}`, title: q.title, body: q.body, color: 0xd4ad55 });
    ctx.ui.hud('المس الجزيرة التي تخدم الموقف'); ctx.sfx.whoosh?.();
  }
  isl.forEach((o) => rig.touch(o.grp, () => {
    if (st !== 'wait') { ctx.ui.card({ tag: 'ميزة', title: o.l.t, body: o.l.n, color: o.l.c }); ctx.sfx.pop?.(); return; }
    if (o.i === Q[qi].a) { st = 'go'; t0 = now; target = o; ctx.sfx.good?.(); o.flash = now; ctx.fx.burst(o.grp.position.clone().add(V(0, 0.1, 0)), o.l.c, 28, 0.4, 0.03); ctx.ui.card({ tag: 'إجابة صحيحة', title: o.l.t, body: o.l.n, color: o.l.c }); solved++; }
    else { o.bad = now; ctx.sfx.bad?.(); ctx.ui.hud('ليست هذه الميزة، جرّب غيرها'); }
  }, { color: o.l.c, size: 0.24, at: V(0, 0.07, 0), show: 3 }));
  rig.touch(hub, (hh) => { ctx.sfx.pop?.(); hh.on = false; ctx.ui.card({ tag: 'الجامعة الافتراضية', title: 'جامعة بلا جدران', body: 'كيان إلكتروني يلتقي فيه الطلاب والمعلمون في بيئة فضائية بواسطة الحاسب وشبكة الاتصالات العالمية.', color: 0xd4ad55 }); }, { color: 0xffd27a, size: 0.26, at: V(0, 0.05, 0), show: 3.2 });

  return {
    update(t, dt, e) {
      now = t; rig.update(t, dt, e);
      const hk = stag(t, 0.2, 0.9, easeBack) * e; hub.scale.setScalar(Math.max(hk, 0.001));
      hub.position.y = HUB.y + Math.sin(t * 1.0) * 0.008; core.material.opacity = 0.55 * hk * (0.8 + 0.2 * Math.sin(t * 2));
      isl.forEach((o, i) => {
        const p = stag(t, 0.5 + i * 0.25, 0.9, easeBack) * e; o.grp.scale.setScalar(Math.max(p, 0.001)); o.grp.visible = p > 0.01;
        const fl = clamp01(1 - (now - o.flash) / 1.0), bd = clamp01(1 - (now - o.bad) / 0.5);
        o.grp.position.set(o.l.x + Math.sin(now * 60) * 0.006 * bd, o.l.y + (1 - Math.min(p, 1)) * -0.12 + Math.sin(t * 1.2 + i * 1.7) * 0.01 + Math.sin(fl * Math.PI) * 0.03, o.l.z);
        o.top.rotation.y = t * 0.3 * (o.top.userData.spin ? 1 : 0.1);
        if (o.top.userData.flag) o.top.userData.flag.rotation.y = Math.sin(t * 3) * 0.4;
        o.band.material.emissiveIntensity = 0.4 + fl * 1.2;
        o.tube.userData.fill(stag(t, 1.4 + i * 0.25, 0.9, clamp01) * e); o.tube.userData.update(dt * (1 + 4 * fl));
        const lk = p; o.lab.position.y = (o.l.lz ? 0.012 : o.grp.position.y - 0.1);
        o.lab.scale.set(o.lab.userData.w * lk + 0.0001, o.lab.userData.w * o.lab.userData.aspect * lk + 0.0001, 1);
      });
      if (st === 'idle' && t > 3.2) ask();
      if (st === 'drop') { const k = clamp01((now - t0) / 0.8); pin.position.set(PIN0.x, PIN0.y + (1 - easeBack(k)) * 0.15, PIN0.z); pin.scale.setScalar(Math.max(k, 0.01)); if (k >= 1) st = 'wait'; }
      else if (st === 'wait') { pin.position.set(PIN0.x, PIN0.y + Math.abs(Math.sin(t * 3)) * 0.012, PIN0.z); }
      else if (st === 'go') {
        const k = clamp01((now - t0) / 1.5); const p = target.curve.getPoint(ease(k)); pin.position.set(p.x, p.y + 0.0, p.z + 0.0);
        if (k >= 1) { pin.visible = false; st = 'between'; t0 = now; if (solved >= Q.length && !finished) { finished = true; setTimeout(() => { ctx.ui.card({ tag: 'جامعة بلا جدران', title: 'كيان إلكتروني', body: 'كيان إلكتروني يلتقي فيه الطلاب والمعلمون في بيئة فضائية بواسطة الحاسب وشبكة الاتصالات العالمية.', color: 0xd4ad55 }); ctx.ui.done(); }, 2800); } }
      } else if (st === 'between' && now - t0 > 2.8 && qi < Q.length - 1) ask();
      who.scale.setScalar(0.07 + Math.sin(t * 3) * 0.003);
    },
  };
}
