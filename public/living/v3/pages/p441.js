// p441 — brainstorming: a glass bulb above a hex stage; six idea-gems orbit it, each rule is a gem that you send into the filament.
import * as THREE from 'three';
import { P, ease, easeBack, clamp01, stag, mat, glossy, goldMat, shadowed, glow } from '../../kit.js?v=24';
import { inked } from '../../pencil.js?v=24';
import { lightPool } from '../../v2/common.js?v=24';
import { Seq, Hints, Tag, TAU, V, wpos, softShadow } from '../lib/a9-kit.js?v=24';

export const meta = { free: true, center: [0.5, 0.247], typeLabel: 'مصباح الأفكار', title: 'أضئ المصباح بالأفكار' };

const RULES = [
  { t: 'تشجيع الأفكار المغالية', tag: 'أفكار مغالية', b: 'الأفكار كالفرس الجموح: ترويضها وتهذيبها أيسر من إنتاج فكرة جديدة صالحة.', c: 0xe0562f },
  { t: 'الفكرة الأولى قد تُعدَّل', tag: 'عدّل الأولى', b: 'الأفكار الأولى غير الصالحة قد تفيد كثيراً عند تعديلها أو البناء عليها.', c: 0x2fae8f },
  { t: 'الكم قبل الكيف', tag: 'الكم قبل الكيف', b: 'الأفكار الرائعة تأتي مع الكم الكبير، فالعصف الذهني يعتمد على توليد أكبر عدد ممكن منها.', c: 0xef8f2a },
  { t: 'تأجيل التقويم', tag: 'أجّل التقويم', b: 'الانسياب المتدفق للأفكار يقلل الرغبة في التقويم ويساعد على فقد كوابح الأفكار.', c: 0x2a8fd0 },
  { t: 'البناء على أفكار الآخرين', tag: 'ابنِ على غيرك', b: 'الاستماع إلى آراء الآخرين بهدوء غاية الأدب، واستخدام أفكارهم للبناء عليها قمة التعقل.', c: 0x8a6fd0 },
];

function gemMesh(i, color) {
  const m = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.55, roughness: 0.25, metalness: 0.1 });
  const g = new THREE.Group();
  if (i === 0) { const k = new THREE.Mesh(new THREE.TorusKnotGeometry(0.03, 0.01, 64, 10, 2, 3), m); g.add(k); }
  else if (i === 1) { const a = new THREE.Mesh(new THREE.DodecahedronGeometry(0.036), m); g.add(a); }
  else if (i === 2) { for (let k = 0; k < 7; k++) { const s = new THREE.Mesh(new THREE.SphereGeometry(0.014 + (k % 3) * 0.004, 14, 10), m); const a = k * 2.4; s.position.set(Math.cos(a) * 0.03 * (k ? 1 : 0), ((k % 3) - 1) * 0.022, Math.sin(a) * 0.03 * (k ? 1 : 0)); g.add(s); } }
  else if (i === 3) { for (const x of [-0.016, 0.016]) { const b = new THREE.Mesh(new THREE.BoxGeometry(0.014, 0.06, 0.014), m); b.position.x = x; g.add(b); } }
  else { [[0, -0.02, 0.05], [-0.012, 0.0, 0.04], [0.012, 0.02, 0.03]].forEach(([x, y, w]) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w * 1.1, 0.02, 0.04), m); b.position.set(x, y, 0); g.add(b); }); }
  return g;
}

export default function build(ctx) {
  const g = new THREE.Group(); g.position.copy(P(meta.center[0], meta.center[1])); ctx.stage.add(g); g.scale.setScalar(1.0);
  const seq = new Seq(), hints = new Hints(g, 4.2), tag = new Tag(g, 0.22);
  const brass = goldMat();
  const BY = 0.33; // bulb centre height

  const shadow = softShadow(0.3, 0.22, 0.3); g.add(shadow);
  const pool = lightPool(0xffd978, 0.34, 0); pool.position.y = 0.004; g.add(pool);
  // a slender brass pedestal: the bulb stands on it like a lamp on a desk
  const ped = new THREE.Mesh(new THREE.LatheGeometry([[0, 0], [0.085, 0], [0.09, 0.008], [0.07, 0.02], [0.03, 0.04], [0.014, 0.07], [0.012, 0.13], [0.02, 0.15], [0.04, 0.165], [0.046, 0.18]].map(([x, y]) => new THREE.Vector2(x, y)), 40), brass); g.add(shadowed(ped));

  // the bulb: a pear of glass on a brass collar
  const bulb = new THREE.Group(); bulb.position.y = BY; g.add(bulb);
  const pear = [[0.046, -0.15], [0.05, -0.13], [0.07, -0.09], [0.105, -0.04], [0.13, 0.03], [0.14, 0.1], [0.125, 0.17], [0.085, 0.215], [0.04, 0.24], [0.0, 0.248]].map(([x, y]) => new THREE.Vector2(x, y));
  const glass = new THREE.Mesh(new THREE.LatheGeometry(pear, 56), new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.03, transparent: true, opacity: 0.3, clearcoat: 1, depthWrite: false })); glass.renderOrder = 4; bulb.add(glass);
  const shell = new THREE.Mesh(new THREE.LatheGeometry(pear.map((v) => new THREE.Vector2(v.x * 1.02 + 0.002, v.y)), 56), new THREE.MeshBasicMaterial({ color: 0xcfe3f2, transparent: true, opacity: 0.2, side: THREE.BackSide, depthWrite: false })); shell.renderOrder = 3; bulb.add(shell);
  const collar = new THREE.Group(); bulb.add(collar);
  for (let k = 0; k < 3; k++) { const r = new THREE.Mesh(new THREE.TorusGeometry(0.048, 0.0065, 8, 32), brass); r.rotation.x = Math.PI / 2; r.position.y = -0.165 - k * 0.014; collar.add(r); }
  const filCurve = []; for (let i = 0; i <= 80; i++) { const u = i / 80, a = u * TAU * 7; filCurve.push(V(-0.045 + u * 0.09, 0.045 + Math.sin(a) * 0.012, Math.cos(a) * 0.012)); }
  const fil = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(filCurve), 140, 0.0025, 6), new THREE.MeshBasicMaterial({ color: 0xffc766, toneMapped: false })); bulb.add(fil);
  [-0.045, 0.045].forEach((x) => { const w = new THREE.Mesh(new THREE.CylinderGeometry(0.0018, 0.0018, 0.2, 6), mat(0x8a8274)); w.position.set(x, -0.06, 0); w.rotation.z = x * 1.2; bulb.add(w); });
  const core = glow(0xffd86b, 0.5, 0); core.position.y = 0.05; bulb.add(core);
  const aura = glow(0xffb84a, 1.0, 0); aura.position.y = 0.05; bulb.add(aura);
  // rays: one per rule, they take the rule's colour when it lights
  const rays = RULES.map((r, i) => { const a = Math.PI * 0.2 + (i / 4) * Math.PI * 0.6; const m = new THREE.Mesh(new THREE.CapsuleGeometry(0.0035, 0.03, 3, 6), new THREE.MeshBasicMaterial({ color: 0xd8d0c0, toneMapped: false, transparent: true, opacity: 0.0 })); m.userData.a = a; bulb.add(m); return m; });
  seq.add(ped, 0.2, 0.8); seq.add(glass, 0.5, 0.9); seq.add(shell, 0.5, 0.9); seq.add(collar, 0.7, 0.7); seq.add(fil, 0.9, 0.6);

  const gems = RULES.map((r, i) => {
    const m = gemMesh(i, r.c); const orb = new THREE.Group(); g.add(orb); orb.add(m);
    const halo = glow(r.c, 0.14, 0.4); orb.add(halo);
    const it = { r, i, orb, m, halo, state: 0, t0: 0, hint: null, ph: i * TAU / 5, tilt: (i % 2 ? 0.35 : -0.25) };
    it.hint = hints.add(V(), r.c, 0.15);
    seq.add(orb, 1.0 + i * 0.25, 0.8);
    return it;
  });

  let nIn = 0, finished = false, now = 0, spurt = -9;
  const tmp = V();
  const orbitPos = (q, t, out) => { const a = t * 0.5 + q.ph; out.set(Math.cos(a) * 0.3, BY + 0.06 + Math.sin(a * 1.0 + q.i) * 0.08 + q.tilt * Math.sin(a) * 0.16, Math.sin(a) * 0.3); return out; };
  function pick(q) {
    ctx.sfx.pop?.();
    ctx.ui.card({ tag: 'قاعدة العصف', title: q.r.t, body: q.r.b, color: q.r.c });
    tag.show(q.r.tag, q.orb.position.clone().add(V(0, 0.08, 0)), q.r.c);
    if (!q.state) { q.state = 1; q.t0 = now; q.hint.on = false; }
  }
  ctx.tap(bulb, () => {
    spurt = now; ctx.sfx.pop?.(); ctx.fx.burst(wpos(g, V(0, BY + 0.05, 0)), 0xffd27a, 36, 0.5, 0.03);
    ctx.ui.card({ tag: 'الفكرة', title: 'عصف ذهني', body: 'جلسات العصف الذهني تحتّم علينا أحياناً تسجيل أي أفكار غريبة، بل والاستفادة منها.', color: 0xf0b13a });
  });
  gems.forEach((q) => ctx.tap(q.orb, () => pick(q)));
  ctx.ui.hud('أرسل الأفكار إلى المصباح');

  return {
    update(t, dt, e) {
      now = t;
      seq.update(t, e); hints.update(t, e); tag.update(dt, e);
      for (const q of gems) {
        if (q.state === 0) orbitPos(q, t, q.orb.position);
        else if (q.state === 1) {
          const k = ease((t - q.t0) / 1.1); orbitPos(q, q.t0, tmp);
          q.orb.position.set(tmp.x * (1 - k), tmp.y * (1 - k) + (BY + 0.05) * k + Math.sin(k * Math.PI) * 0.1, tmp.z * (1 - k));
          q.orb.scale.setScalar(1 - 0.75 * k);
          if (k >= 1) { q.state = 2; nIn++; ctx.sfx.good?.(); ctx.fx.burst(wpos(g, V(0, BY + 0.05, 0)), q.r.c, 22, 0.35, 0.03); rays[q.i].material.color.set(q.r.c); rays[q.i].userData.on = 1; q.orb.visible = false; q.hint.h.visible = false; tag.hide();
            if (nIn === 5 && !finished) { finished = true; setTimeout(() => { ctx.fx.burst(wpos(g, V(0, BY + 0.05, 0)), 0xffd27a, 60, 0.6, 0.04); ctx.ui.done(); ctx.ui.hud('المصباح يضيء بأفكار الجميع'); }, 500); } }
        }
        q.m.rotation.y += dt * 1.4; q.m.rotation.x += dt * 0.6;
        q.hint.h.position.copy(q.orb.position);
        q.halo.scale.setScalar(0.14 + 0.02 * Math.sin(t * 3 + q.i));
      }
      const lit = nIn / 5 + Math.max(0, 1 - (t - spurt) / 1.0) * 0.3 * (spurt > 0);
      const l = clamp01(lit) * e;
      core.material.opacity = 0.2 + 0.8 * l; core.scale.setScalar(0.4 + 0.35 * l + 0.02 * Math.sin(t * 7));
      aura.material.opacity = 0.6 * l; aura.scale.setScalar(0.9 + 0.5 * l);
      fil.material.color.setRGB(1, 0.62 + 0.3 * l, 0.28 + 0.4 * l);
      glass.material.opacity = 0.26 + 0.1 * l;
      pool.material.opacity = 0.55 * l;
      rays.forEach((r) => { const a = r.userData.a, on = r.userData.on ? 1 : 0; r.material.opacity = THREE.MathUtils.damp(r.material.opacity, on * 0.95, 4, dt); const rr = 0.2 + 0.015 * Math.sin(t * 3 + a * 3); r.position.set(Math.cos(a) * rr * 0.9, 0.05 + Math.sin(a) * rr, 0); r.rotation.z = a - Math.PI / 2; });
      bulb.rotation.y = Math.sin(t * 0.5) * 0.2;
    },
  };
}
