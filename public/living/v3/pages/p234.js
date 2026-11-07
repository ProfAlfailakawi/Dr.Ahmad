// p234 — the computer lab as a game: seven monitors, each shows one statement; three hide a subtle error. Read, judge, and the screen turns green (or glitches red).
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { P, ease, easeBack, clamp01, stag, mat, glossy, goldMat, shadowed } from '../../kit.js?v=15';
import { softLight } from '../../v2/common.js?v=15';
import { hints, finder, toAr, blobShadow } from '../lib/a3-kit.js?v=15';

export const meta = { free: true, center: [0.57, 0.3], typeLabel: 'لعبة تدقيق' };

const S = [
  { t: 'يتيح الحاسب تخزين المعلومات الكبيرة في أماكن يسهل الوصول إليها واسترجاعها في أي وقت.', wrong: false },
  { t: 'يحلّ الحاسب محلّ المعلم في تدريب الطلاب على التعلم الذاتي، فلا حاجة إلى توجيهه.', wrong: true, fix: 'يُستخدم الحاسب في تدريب الطلاب على بعض مهارات التعلم الذاتي، ويدعم المعلم ولا يلغي دوره.' },
  { t: 'يساعد في تحسين أداء المعلمين وتطوير مهاراتهم.', wrong: false },
  { t: 'يُستخدم في عرض التجارب، وخصوصاً تلك التي يكون تنفيذها في المختبر سهلاً وآمناً.', wrong: true, fix: 'يفيد خصوصاً في عرض التجارب التي يشكّل عرضها في المختبر خطورة.' },
  { t: 'يساعد المعلم على مراعاة الفروق الفردية بين الطلبة.', wrong: false },
  { t: 'أصبح الحاسب ضرورة لأنه أفضل وسيلة لحفظ المعلومات واسترجاعها، لكن تعلّمه واستخدامه صعب.', wrong: true, fix: 'من أسباب ضرورته أنه أفضل وسيلة لحفظ المعلومات واسترجاعها بسرعة، وأن تعلّمه واستخدامه سهل.' },
  { t: 'يتيح مجالاً واسعاً لتنويع أساليب تقديم المعلومات للمتعلمين بوجود المعلم أو عدمه.', wrong: false },
];
const LAYOUT = [[-0.21, 0.1, 0.062], [0, 0.1, 0.062], [0.21, 0.1, 0.062], [-0.27, -0.12, 0.092], [-0.09, -0.12, 0.092], [0.09, -0.12, 0.092], [0.27, -0.12, 0.092]];
const TINT = { 0: [0.55, 0.7, 0.95], 1: [1, 1, 1], 2: [0.55, 1, 0.65], 3: [0.55, 1, 0.65], bad: [1, 0.35, 0.35] };

function screenTex() {
  const c = document.createElement('canvas'); c.width = 256; c.height = 180; const g = c.getContext('2d');
  g.fillStyle = '#e7f2ff'; g.fillRect(0, 0, 256, 180); g.fillStyle = '#2a6fb0'; g.fillRect(0, 0, 256, 22);
  g.fillStyle = '#3b4650'; for (let i = 0; i < 7; i++) { const w = 120 + ((i * 53) % 90); g.fillRect(256 - 20 - w, 42 + i * 18, w, 7); }
  g.fillStyle = '#ef8a2a'; g.beginPath(); g.arc(34, 80, 16, 0, 7); g.fill();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function iconTex(kind) {
  const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d');
  g.lineWidth = 16; g.lineCap = 'round'; g.lineJoin = 'round'; g.strokeStyle = kind ? '#2f9d52' : '#d8322f'; g.shadowColor = g.strokeStyle; g.shadowBlur = 14;
  g.beginPath(); if (kind) { g.moveTo(26, 68); g.lineTo(54, 96); g.lineTo(104, 34); } else { g.moveTo(30, 30); g.lineTo(98, 98); g.moveTo(98, 30); g.lineTo(30, 98); } g.stroke();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

export default function build(ctx) {
  const g = new THREE.Group(); g.position.copy(P(0.57, 0.3)); ctx.stage.add(g);
  const H = hints(), found = finder(ctx, 3);
  // a tiered lab: a raised back desk and a front desk, warm wood and white, soft shadow on the print
  const sh = blobShadow(0.95, 0.62, 0.3); g.add(sh);
  const wood = mat(0xe3b77c, { roughness: 0.5 }), white = mat(0xf4efe4, { roughness: 0.55 });
  const slab = new THREE.Group(); g.add(slab);
  const tier = new THREE.Mesh(new RoundedBoxGeometry(0.78, 0.07, 0.19, 3, 0.012), white); tier.position.set(0, 0.035, -0.12); slab.add(tier);
  const tierTop = new THREE.Mesh(new RoundedBoxGeometry(0.8, 0.018, 0.21, 3, 0.008), wood); tierTop.position.set(0, 0.079, -0.12); slab.add(tierTop);
  const fdTop = new THREE.Mesh(new RoundedBoxGeometry(0.7, 0.018, 0.2, 3, 0.008), wood); fdTop.position.set(0, 0.051, 0.1); slab.add(fdTop);
  [-0.31, 0.31].forEach((x) => { const l = new THREE.Mesh(new RoundedBoxGeometry(0.018, 0.05, 0.17, 2, 0.005), white); l.position.set(x, 0.025, 0.1); slab.add(l); });
  const apron = new THREE.Mesh(new RoundedBoxGeometry(0.64, 0.03, 0.012, 2, 0.004), white); apron.position.set(0, 0.035, 0.185); slab.add(apron);
  [-0.22, 0, 0.22].forEach((x) => { const st = new THREE.Mesh(new THREE.CylinderGeometry(0.034, 0.034, 0.03, 20), glossy(0xe6592b)); st.position.set(x, 0.015, 0.245); slab.add(st); });
  const edge = slab, under = slab;
  const tex = screenTex(), tick = iconTex(true), cross = iconTex(false);
  const mons = S.map((s, i) => {
    const [x, z, yb] = LAYOUT[i];
    const grp = new THREE.Group(); grp.position.set(x, yb, z); grp.rotation.y = -x * 0.9; g.add(grp);
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.008, 0.03, 10), mat(0xb8bcc2, { metalness: 0.5 })); neck.position.y = 0.015; grp.add(neck);
    const bs = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.03, 0.006, 24), mat(0xb8bcc2, { metalness: 0.5 })); bs.position.y = 0.003; grp.add(bs);
    const pivot = new THREE.Group(); pivot.position.y = 0.06; pivot.rotation.x = -0.12; grp.add(pivot);
    const bez = new THREE.Mesh(new RoundedBoxGeometry(0.105, 0.078, 0.013, 3, 0.005), glossy(0xf2f2f4)); pivot.add(bez);
    const sm = new THREE.MeshBasicMaterial({ map: tex, toneMapped: false }); const scr = new THREE.Mesh(new THREE.PlaneGeometry(0.092, 0.065), sm); scr.position.z = 0.0072; pivot.add(scr);
    const ic = new THREE.Mesh(new THREE.PlaneGeometry(0.04, 0.04), new THREE.MeshBasicMaterial({ map: tick, transparent: true, depthWrite: false, toneMapped: false })); ic.position.z = 0.0085; ic.visible = false; pivot.add(ic);
    const glowS = softLight(0x7fc4ff, 0.16, 0); glowS.position.z = 0.02; pivot.add(glowS);
    shadowed(grp);
    const hit = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.1, 0.06), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false })); hit.position.y = 0.06; grp.add(hit);
    ctx.tap(grp, () => select(i));
    const hint = H.add(pivot, 0x7fc4ff, 0.14, [0, 0, 0.02], 2.6 + i * 0.12);
    return { i, s, grp, yb, pivot, sm, ic, glowS, hint, state: 0, shake: 0, lift: 0, liftTo: 0, bad: 0, born: 0.15 + i * 0.1, tint: new THREE.Color() };
  });
  // scan beam over the rows
  const beam = new THREE.Mesh(new THREE.PlaneGeometry(0.66, 0.012), new THREE.MeshBasicMaterial({ color: 0x7fc4ff, transparent: true, opacity: 0.0, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false })); beam.rotation.x = -Math.PI / 2; beam.position.y = 0.036; g.add(beam);

  let sel = -1, now = 0, errs = 0;
  function select(i) {
    const m = mons[i]; ctx.sfx.pop?.();
    mons.forEach((o) => { o.liftTo = o === m && m.state < 2 ? 1 : 0; });
    sel = i;
    ctx.ui.hud(`وجدت ${toAr(errs)} من ٣ أخطاء`);
    if (m.state >= 2) { ctx.ui.card({ tag: m.s.wrong ? 'تم التصحيح' : 'عبارة صحيحة', title: m.s.wrong ? 'الصيغة الصحيحة' : 'صحيحة', body: m.s.wrong ? m.s.fix : m.s.t, color: 0x2f9d52 }); ctx.ui.choices([]); return; }
    ctx.ui.card({ tag: `عبارة ${toAr(i + 1)} من ٧`, title: 'اقرأ ثم احكم', body: m.s.t, color: 0x2a8fd0 });
    ctx.ui.choices([{ label: 'صحيحة', onPick: () => judge(i, false) }, { label: 'فيها خطأ', primary: true, onPick: () => judge(i, true) }]);
  }
  function judge(i, saysWrong) {
    const m = mons[i]; ctx.ui.choices([]);
    if (saysWrong === m.s.wrong) {
      m.state = m.s.wrong ? 3 : 2; m.liftTo = 0; ctx.sfx.good?.();
      ctx.fx.burst(m.grp.position.clone().add(g.position).add(new THREE.Vector3(0, 0.08, 0)), m.s.wrong ? 0xf2c14a : 0x6fd68a, 26, 0.4, 0.035);
      m.hint.calm = true;
      if (m.s.wrong) { errs += 1; found(i); ctx.ui.card({ tag: 'أحسنت، وجدت الخطأ', title: 'الصيغة الصحيحة', body: m.s.fix, color: 0x2f9d52 }); }
      else ctx.ui.card({ tag: 'أحسنت', title: 'عبارة صحيحة', body: 'لا خطأ فيها. تابع بقية الشاشات.', color: 0x2f9d52 });
      ctx.ui.hud(errs < 3 ? `وجدت ${toAr(errs)} من ٣ أخطاء` : 'وجدت الأخطاء الثلاثة');
      if (errs >= 3) mons.forEach((o) => { if (o.state < 2) o.state = 2; });
    } else {
      m.shake = 1; m.bad = 1; ctx.sfx.bad?.(); ctx.ui.hideCard();
      ctx.ui.toast(saysWrong ? 'هذه العبارة صحيحة، أعد القراءة' : 'في هذه العبارة خطأ، أعد القراءة');
    }
  }
  ctx.ui.hud('اكتشف العبارات الثلاث الخاطئة');
  return {
    update(t, dt, e) {
      now = t;
      const sk = Math.max(stag(t, 0.05, 0.7, easeBack) * e, 0.001); slab.scale.set(sk, sk, sk); sh.material.opacity = 0.3 * e;
      beam.position.z = -0.25 + ((t * 0.3) % 1) * 0.5; beam.position.y = 0.1; beam.material.opacity = (t > 0.8 ? 0.2 : 0) * e;
      mons.forEach((m) => {
        const k = Math.max(stag(t, m.born, 0.8, easeBack) * e, 0.001); m.grp.scale.setScalar(k * 1.55);
        m.lift += (m.liftTo - m.lift) * Math.min(1, dt * 8); m.shake = Math.max(0, m.shake - dt * 2); m.bad = Math.max(0, m.bad - dt * 1.4);
        m.grp.position.y = m.yb + m.lift * 0.04; m.pivot.position.x = Math.sin(t * 60) * 0.004 * m.shake;
        m.pivot.rotation.x = -0.12 - m.lift * 0.15; m.pivot.rotation.y = Math.sin(t * 0.7 + m.i) * 0.03;
        const base = TINT[m.state === 0 && m.lift > 0.5 ? 1 : m.state];
        const lit = clamp01((t - 0.5 - m.i * 0.12) * 1.5);
        const flick = 0.92 + 0.08 * Math.sin(t * 7 + m.i * 2);
        m.tint.setRGB(base[0], base[1], base[2]).multiplyScalar(lit * flick * (m.state === 0 ? 0.95 : 1));
        if (m.bad > 0) m.tint.lerp(new THREE.Color(1, 0.2, 0.2), m.bad * 0.7);
        m.sm.color.copy(m.tint);
        m.ic.visible = m.state >= 2; if (m.state >= 2) { m.ic.material.map = m.s.wrong ? tick : tick; m.ic.scale.setScalar(clamp01(1.0)); }
        m.glowS.material.opacity = (m.state >= 2 ? 0.3 : 0.12 + m.lift * 0.3) * lit * e; m.glowS.material.color.setHex(m.state >= 2 ? 0x6fd68a : 0x7fc4ff);
      });
      H.update(t, e);
    },
  };
}
