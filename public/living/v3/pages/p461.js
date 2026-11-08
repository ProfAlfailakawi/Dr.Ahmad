// p461 — design a BYOD policy: four decisions, each a choice of three gems; the right one becomes a glowing layer of protection over the phone, then a lock closes.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { P, ease, easeBack, clamp01, stag, mat, glossy, goldMat, shadowed, glow } from '../../kit.js?v=25';
import { inked } from '../../pencil.js?v=25';
import { lightPool } from '../../v2/common.js?v=25';
import { Seq, Hints, Tag, TAU, V, wpos, softShadow } from '../lib/a9-kit.js?v=25';

export const meta = { free: true, center: [0.5, 0.271], typeLabel: 'لعبة تصميم', title: 'صمّم سياسة BYOD' };

const ROUNDS = [
  { hud: 'ماذا يسبق السماح بالأجهزة؟', col: 0xef8f2a, name: 'التخطيط', opts: [
    { l: 'تخطيط مسبق', ok: 1, fb: 'الصفحة تجعل التخطيط أولى الإجراءات التي تكفل الاستخدام الآمن.' },
    { l: 'سماح فوري', fb: 'الاستعجال يعرّض الشبكة والطلاب للمخاطر قبل وجود قواعد.' },
    { l: 'أجهزة موحدة', fb: 'هذا نقيض فكرة BYOD التي تقوم على الأجهزة الشخصية.' }] },
  { hud: 'كيف يُضبط الاستعمال؟', col: 0x2fae8f, name: 'القوانين', opts: [
    { l: 'ترك الأمر للطالب', fb: 'غياب القواعد يفتح الباب للتشتت وسوء الاستعمال.' },
    { l: 'قوانين مدرسية', ok: 1, fb: 'القوانين المدرسية تحدد متى وكيف يُستعمل الجهاز.' },
    { l: 'منع كلي', fb: 'المنع الكلي يلغي الفائدة التي تثبتها التجارب في التعلم.' }] },
  { hud: 'ماذا عن الشبكة؟', col: 0x2a8fd0, name: 'الحماية', opts: [
    { l: 'شبكة مفتوحة', fb: 'السهولة هنا تهدد أمن الجميع.' },
    { l: 'اتصال شخصي', fb: 'يرهق الأسر ويبقي المدرسة بلا ضبط لشبكتها.' },
    { l: 'حماية الشبكتين', ok: 1, fb: 'توفير الحماية الجيدة للشبكات من شروط الاستخدام الآمن.' }] },
  { hud: 'كيف يُوظَّف الجهاز؟', col: 0xd4ad55, name: 'التوظيف', opts: [
    { l: 'تصفح حر', fb: 'التصفح الحر لا يخدم هدفاً تعليمياً.' },
    { l: 'أنشطة التعلم', ok: 1, fb: 'من مميزاته تعدد أشكال التعلم وتحسين التعاون بين الطلبة والمعلمين.' },
    { l: 'تصوير بلا تنسيق', fb: 'نشاط غير منظم لا تدعمه السياسة.' }] },
];
const SLOTS = [V(-0.17, 0.02, 0.33), V(0, 0.02, 0.37), V(0.17, 0.02, 0.33)];
const LAYER_Y = [0.08, 0.14, 0.2, 0.26];

function gemGeo(i) { return i === 0 ? new THREE.IcosahedronGeometry(0.034, 0) : i === 1 ? new THREE.BoxGeometry(0.052, 0.052, 0.052) : new THREE.OctahedronGeometry(0.04); }

export default function build(ctx) {
  const g = new THREE.Group(); g.position.copy(P(meta.center[0], meta.center[1])); ctx.stage.add(g); g.scale.setScalar(1.1);
  const seq = new Seq(), hints = new Hints(g, 4.2);
  let round = 0, locked = 0, now = 0, finished = false, wait = 0;

  const shadow = softShadow(0.34, 0.52, 0.3); g.add(shadow);
  // the phone, lying under the layers
  const phone = new THREE.Group(); phone.position.set(0, 0.012, -0.02); phone.rotation.y = -0.32; g.add(phone);
  const pb = new THREE.Mesh(new RoundedBoxGeometry(0.24, 0.016, 0.42, 4, 0.014), glossy(0xf1f1f1)); phone.add(shadowed(pb));
  const ps = new THREE.Mesh(new THREE.PlaneGeometry(0.21, 0.37), new THREE.MeshBasicMaterial({ color: 0x2c3a96, toneMapped: false })); ps.rotation.x = -Math.PI / 2; ps.position.y = 0.0085; phone.add(ps);
  [[-0.048, -0.1, 0xf2b632], [0.048, -0.1, 0xe5258f], [-0.048, 0.0, 0x4cc3d8], [0.048, 0.0, 0xf2b632], [-0.048, 0.1, 0xf8f8f8], [0.048, 0.1, 0x4cc38f]].forEach(([x, z, c]) => { const t = new THREE.Mesh(new RoundedBoxGeometry(0.08, 0.003, 0.08, 2, 0.004), new THREE.MeshBasicMaterial({ color: c, toneMapped: false })); t.position.set(x, 0.0095, z); phone.add(t); });
    const pool = lightPool(0xbfe6ff, 0.3, 0.5); pool.position.y = 0.004; g.add(pool);

  // four layers of protection, hovering above the phone
  const layers = ROUNDS.map((r, i) => {
    const grp = new THREE.Group(); grp.position.set(0, LAYER_Y[i], -0.02); g.add(grp);
    const m = new THREE.MeshPhysicalMaterial({ color: r.col, transparent: true, opacity: 0.12, roughness: 0.15, clearcoat: 1, depthWrite: false, side: THREE.DoubleSide });
    const pg = new RoundedBoxGeometry(0.23 - i * 0.012, 0.005, 0.4 - i * 0.02, 2, 0.006); const disc = new THREE.Mesh(pg, m); grp.add(disc);
    const edge = new THREE.LineSegments(new THREE.EdgesGeometry(pg), new THREE.LineBasicMaterial({ color: r.col, transparent: true, opacity: 0.35 })); grp.add(edge);
    const core = glow(r.col, 0.36, 0); core.position.y = 0.0; grp.add(core);
    seq.add(grp, 1.2 + i * 0.2, 0.9, 0.04);
    return { grp, m, edge, core, on: 0, t0: 0, r };
  });
  // the padlock that closes at the end
  const lock = new THREE.Group(); lock.position.set(0, 0.36, -0.02); g.add(lock);
  const lb = new THREE.Mesh(new RoundedBoxGeometry(0.07, 0.056, 0.03, 3, 0.01), goldMat()); lock.add(shadowed(lb));
  const sh = new THREE.Group(); sh.position.set(0.0, 0.026, 0); lock.add(sh);
  const sk = new THREE.Mesh(new THREE.TorusGeometry(0.02, 0.005, 8, 24, Math.PI), goldMat()); sk.position.set(0.0, 0.0, 0); sh.add(sk);
  lock.visible = false;

  // three choice gems (reused each round) with their own tag
  const gems = [0, 1, 2].map((i) => {
    const grp = new THREE.Group(); grp.position.copy(SLOTS[i]); g.add(grp);
    const m = new THREE.MeshStandardMaterial({ color: 0xf0cf7a, emissive: 0xd4ad55, emissiveIntensity: 0.4, roughness: 0.25, metalness: 0.2 });
    const body = new THREE.Mesh(gemGeo(i), m); body.scale.setScalar(1.3); body.position.y = 0.05; grp.add(shadowed(body));
    const halo = glow(0xffd27a, 0.14, 0.4); halo.position.y = 0.04; grp.add(halo);
    const tg = new Tag(g, 0.2, 0xc08a2b);
    seq.add(grp, 2.4 + i * 0.2, 0.7, 0.05);
    return { i, grp, body, m, halo, tg, state: 0, t0: 0, ph: i * 2 };
  });
  gems.forEach((q) => hints.add(SLOTS[q.i].clone().setY(0.1), 0xffd27a, 0.1).on = false);

  function startRound() {
    const r = ROUNDS[round];
    ctx.ui.hud(r.hud);
    gems.forEach((q, i) => { q.state = 0; q.grp.visible = true; q.grp.position.copy(SLOTS[i]); q.grp.scale.setScalar(1); q.m.color.set(0xf0cf7a); q.m.emissive.set(0xd4ad55); q.halo.material.opacity = 0.4; q.tg.show(r.opts[i].l, SLOTS[i].clone().add(V(0, 0.13, 0)), 0xc08a2b); hints.list[i].on = true; });
  }
  function pick(q) {
    if (finished || q.state !== 0 || wait > now) return;
    const r = ROUNDS[round], o = r.opts[q.i]; q.t0 = now; hints.list[q.i].on = false;
    if (o.ok) {
      q.state = 2; ctx.sfx.good?.();
      ctx.ui.card({ tag: 'قرار سليم', title: o.l, body: o.fb, color: r.col });
      wait = now + 1.7; gems.forEach((z) => { if (z !== q) { z.state = 3; z.t0 = now; z.tg.hide(); } });
    } else { q.state = 1; ctx.sfx.bad?.(); ctx.ui.card({ tag: 'ليس هذا', title: o.l, body: o.fb, color: 0xc0504a }); q.m.color.set(0xb9b2a2); q.m.emissive.set(0x444038); q.halo.material.opacity = 0.05; q.tg.hide(); }
  }
  gems.forEach((q) => ctx.tap(q.grp, () => pick(q)));
  const tmp = V();

  return {
    update(t, dt, e) {
      now = t; seq.update(t, e); hints.update(t, e); gems.forEach((q) => q.tg.update(dt, e));
      if (t > 2.4 && round === 0 && !gems[0].started) { gems[0].started = true; startRound(); }
      gems.forEach((q) => {
        const bob = Math.sin(t * 2 + q.ph) * 0.006; q.body.rotation.y += dt * 1.2; q.body.rotation.x += dt * 0.4;
        if (q.state === 0) q.grp.position.y = SLOTS[q.i].y + bob;
        if (q.state === 1) { q.grp.position.x = SLOTS[q.i].x + Math.sin((t - q.t0) * 40) * 0.012 * Math.max(0, 1 - (t - q.t0) / 0.5); q.grp.position.y = SLOTS[q.i].y + bob - 0.015; }
        if (q.state === 2) {
          const k = ease((t - q.t0) / 1.0), L = layers[round]; tmp.set(0, LAYER_Y[round], -0.02);
          q.grp.position.lerpVectors(SLOTS[q.i], tmp, k); q.grp.position.y += Math.sin(k * Math.PI) * 0.1; q.grp.scale.setScalar(1 - 0.65 * k);
          if (k >= 1) { q.state = 4; L.on = 1; L.t0 = t; q.grp.visible = false; ctx.fx.burst(wpos(g, V(0, LAYER_Y[round], -0.02)), ROUNDS[round].col, 24, 0.35, 0.03); ctx.sfx.pop?.(); locked++; round++;
            if (round < ROUNDS.length) setTimeout(startRound, 500);
            else { finished = true; setTimeout(() => { lock.visible = true; lock.userData.t0 = performance.now(); ctx.ui.hud('سياسة آمنة'); ctx.sfx.good?.(); ctx.ui.done(); ctx.fx.burst(wpos(g, V(0, 0.36, -0.02)), 0xffd27a, 50, 0.5, 0.04); }, 700); } }
        }
        if (q.state === 3) { const k = ease((t - q.t0) / 0.6); q.grp.scale.setScalar(Math.max(1 - k, 0.0001)); if (k >= 1) q.grp.visible = false; }
      });
      layers.forEach((L, i) => {
        const on = L.on ? ease((t - L.t0) / 0.8) : 0;
        L.m.opacity = 0.12 + 0.5 * on; L.edge.material.opacity = 0.35 + 0.65 * on; L.core.material.opacity = 0.35 * on * e; L.core.scale.setScalar(0.3 + 0.1 * Math.sin(t * 3 + i));
        L.grp.position.y = LAYER_Y[i] + Math.sin(t * 1.4 + i) * 0.003 * on;
      });
      if (lock.visible) { const k = clamp01((performance.now() - lock.userData.t0) / 1000); lock.scale.setScalar(Math.max(easeBack(k), 0.001)); sh.position.y = 0.026 - 0.016 * ease((k - 0.3) / 0.5); lock.rotation.y = Math.sin(t * 0.8) * 0.4; }
      pool.material.opacity = 0.2 + 0.1 * locked;
    },
  };
}
