// p234 — a small computer lab as a game: six big, chunky monitors on a tiered desk, each showing a "?" for one statement; read it, judge it, and the screen turns green with a tick (three of them hide a subtle error).
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { P, ease, easeBack, clamp01, stag, mat, glossy, goldMat, shadowed } from '../../kit.js?v=20';
import { softLight } from '../../v2/common.js?v=20';
import { hints, finder, toAr, blobShadow, hitSphere } from '../lib/a3-kit.js?v=20';

export const meta = { free: true, center: [0.53, 0.3], typeLabel: 'لعبة تدقيق' };

const S = [
  { t: 'يتيح الحاسب تخزين المعلومات الكبيرة في أماكن يسهل الوصول إليها واسترجاعها في أي وقت.', wrong: false },
  { t: 'يحلّ الحاسب محلّ المعلم في تدريب الطلاب على التعلم الذاتي، فلا حاجة إلى توجيهه.', wrong: true, fix: 'يُستخدم الحاسب في تدريب الطلاب على بعض مهارات التعلم الذاتي، ويدعم المعلم ولا يلغي دوره.' },
  { t: 'يساعد في تحسين أداء المعلمين وتطوير مهاراتهم.', wrong: false },
  { t: 'يُستخدم في عرض التجارب، وخصوصاً تلك التي يكون تنفيذها في المختبر سهلاً وآمناً.', wrong: true, fix: 'يفيد خصوصاً في عرض التجارب التي يشكّل عرضها في المختبر خطورة.' },
  { t: 'يساعد المعلم على مراعاة الفروق الفردية بين الطلبة.', wrong: false },
  { t: 'أصبح الحاسب ضرورة لأنه أفضل وسيلة لحفظ المعلومات واسترجاعها، لكن تعلّمه واستخدامه صعب.', wrong: true, fix: 'من أسباب ضرورته أنه أفضل وسيلة لحفظ المعلومات واسترجاعها بسرعة، وأن تعلّمه واستخدامه سهل.' },
];
// x, z, base height, scale
const LAYOUT = [[-0.235, -0.15, 0.092, 2.0], [0, -0.15, 0.092, 2.0], [0.235, -0.15, 0.092, 2.0], [-0.235, 0.13, 0.05, 1.65], [0, 0.13, 0.05, 1.65], [0.235, 0.13, 0.05, 1.65]];
const TINT = { 0: [0.78, 0.86, 1], 1: [1, 1, 1], 2: [0.6, 1, 0.7] };

function screenTex(n) {
  const c = document.createElement('canvas'); c.width = 256; c.height = 180; const g = c.getContext('2d');
  const gr = g.createLinearGradient(0, 0, 0, 180); gr.addColorStop(0, '#3a8fd8'); gr.addColorStop(1, '#1f5aa8'); g.fillStyle = gr; g.fillRect(0, 0, 256, 180);
  g.fillStyle = 'rgba(255,255,255,.18)'; for (let i = 0; i < 4; i++) g.fillRect(20, 24 + i * 12, 70 - i * 8, 5);
  g.fillStyle = '#fff'; g.font = '800 120px Tajawal, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('؟', 140, 98);
  g.font = '800 34px Tajawal, sans-serif'; g.textAlign = 'left'; g.fillText(toAr(n), 18, 150);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}
function tickTex() {
  const c = document.createElement('canvas'); c.width = 256; c.height = 180; const g = c.getContext('2d');
  const gr = g.createLinearGradient(0, 0, 0, 180); gr.addColorStop(0, '#59c97c'); gr.addColorStop(1, '#2a9a55'); g.fillStyle = gr; g.fillRect(0, 0, 256, 180);
  g.lineWidth = 26; g.lineCap = 'round'; g.lineJoin = 'round'; g.strokeStyle = '#fff'; g.beginPath(); g.moveTo(66, 96); g.lineTo(112, 140); g.lineTo(194, 44); g.stroke();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}

export default function build(ctx) {
  const g = new THREE.Group(); g.position.copy(P(0.53, 0.3)); g.scale.setScalar(0.95); ctx.stage.add(g);
  const H = hints(), found = finder(ctx, 3);
  const sh = blobShadow(0.95, 0.66, 0.3); g.add(sh);
  const wood = mat(0xe3b77c, { roughness: 0.5 }), white = mat(0xf4efe4, { roughness: 0.55 });
  const furn = new THREE.Group(); g.add(furn);
  const tier = new THREE.Mesh(new RoundedBoxGeometry(0.82, 0.07, 0.22, 3, 0.012), white); tier.position.set(0, 0.035, -0.15); furn.add(tier);
  const tierTop = new THREE.Mesh(new RoundedBoxGeometry(0.84, 0.018, 0.24, 3, 0.008), wood); tierTop.position.set(0, 0.079, -0.15); furn.add(tierTop);
  const fd = new THREE.Mesh(new RoundedBoxGeometry(0.78, 0.018, 0.24, 3, 0.008), wood); fd.position.set(0, 0.04, 0.13); furn.add(fd);
  [-0.35, 0.35].forEach((x) => { const l = new THREE.Mesh(new RoundedBoxGeometry(0.02, 0.04, 0.2, 2, 0.005), white); l.position.set(x, 0.02, 0.13); furn.add(l); });
  const tex = tickTex();
  const mons = S.map((s, i) => {
    const [x, z, yb, sc] = LAYOUT[i];
    const grp = new THREE.Group(); grp.position.set(x, yb, z); grp.rotation.y = -x * 0.5; g.add(grp);
    const kb = new THREE.Mesh(new RoundedBoxGeometry(0.11, 0.008, 0.04, 2, 0.003), white); kb.position.set(-0.01, 0.004, 0.08 / 1.0); grp.add(kb);
    for (let r = 0; r < 3; r++) { const k = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.002, 0.006), mat(0x9aa3a8)); k.position.set(-0.01, 0.009, 0.068 + r * 0.011); grp.add(k); }
    const ms = new THREE.Mesh(new THREE.SphereGeometry(0.014, 14, 10), white); ms.scale.set(1, 0.5, 1.3); ms.position.set(0.075, 0.006, 0.08); grp.add(ms);
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.007, 0.01, 0.034, 12), mat(0xb8bcc2, { metalness: 0.5 })); neck.position.y = 0.017; grp.add(neck);
    const bs = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.034, 0.006, 24), mat(0xb8bcc2, { metalness: 0.5 })); bs.position.y = 0.003; grp.add(bs);
    const pivot = new THREE.Group(); pivot.position.y = 0.074; pivot.rotation.x = -0.1; grp.add(pivot);
    pivot.add(new THREE.Mesh(new RoundedBoxGeometry(0.108, 0.082, 0.016, 3, 0.007), glossy(0xf2f2f4)));
    const sm = new THREE.MeshBasicMaterial({ map: screenTex(i + 1), toneMapped: false }); const scr = new THREE.Mesh(new THREE.PlaneGeometry(0.094, 0.068), sm); scr.position.z = 0.0085; pivot.add(scr);
    const glowS = softLight(0x7fc4ff, 0.2, 0); glowS.position.z = 0.03; pivot.add(glowS);
    grp.scale.setScalar(sc);
    shadowed(grp);
    grp.add(hitSphere(0.07, [0, 0.07, 0.02]));
    ctx.tap(grp, () => select(i));
    const hint = H.add(pivot, 0x7fc4ff, 0.16, [0, 0, 0.03], 2.6 + i * 0.12);
    return { i, s, grp, pivot, sm, glowS, hint, state: 0, shake: 0, lift: 0, liftTo: 0, bad: 0, born: 0.12 + i * 0.1, yb, sc, tint: new THREE.Color(), swapped: false };
  });
  const bad = new THREE.Color(1, 0.2, 0.2);
  let sel = -1, now = 0, errs = 0;
  function select(i) {
    const m = mons[i]; ctx.sfx.pop?.();
    mons.forEach((o) => { o.liftTo = o === m && m.state < 2 ? 1 : 0; });
    sel = i; ctx.ui.hud(`وجدت ${toAr(errs)} من ٣ أخطاء`);
    if (m.state >= 2) { ctx.ui.card({ tag: m.s.wrong ? 'تم التصحيح' : 'عبارة صحيحة', title: m.s.wrong ? 'الصيغة الصحيحة' : 'صحيحة', body: m.s.wrong ? m.s.fix : m.s.t, color: 0x2f9d52 }); ctx.ui.choices([]); return; }
    ctx.ui.card({ tag: `عبارة ${toAr(i + 1)} من ٦`, title: 'اقرأ ثم احكم', body: m.s.t, color: 0x2a8fd0 });
    ctx.ui.choices([{ label: 'صحيحة', onPick: () => judge(i, false) }, { label: 'فيها خطأ', primary: true, onPick: () => judge(i, true) }]);
  }
  function judge(i, saysWrong) {
    const m = mons[i]; ctx.ui.choices([]);
    if (saysWrong === m.s.wrong) {
      m.state = 2; m.liftTo = 0; ctx.sfx.good?.();
      ctx.fx.burst(m.grp.position.clone().add(g.position).add(new THREE.Vector3(0, 0.12, 0)), m.s.wrong ? 0xf2c14a : 0x6fd68a, 26, 0.4, 0.035);
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
      sh.material.opacity = 0.3 * e;
      const sk = Math.max(stag(t, 0.05, 0.7, easeBack) * e, 0.001); furn.scale.set(sk, sk, sk);
      mons.forEach((m) => {
        const k = Math.max(stag(t, m.born, 0.8, easeBack) * e, 0.001); m.grp.scale.setScalar(k * m.sc);
        m.lift += (m.liftTo - m.lift) * Math.min(1, dt * 8); m.shake = Math.max(0, m.shake - dt * 2); m.bad = Math.max(0, m.bad - dt * 1.4);
        m.grp.position.y = m.yb + m.lift * 0.03; m.pivot.position.x = Math.sin(t * 60) * 0.004 * m.shake;
        m.pivot.rotation.x = -0.1 - m.lift * 0.14; m.pivot.rotation.y = Math.sin(t * 0.7 + m.i) * 0.03;
        if (m.state >= 2 && !m.swapped) { m.swapped = true; m.sm.map = tex; m.sm.needsUpdate = true; }
        const base = TINT[m.state === 0 && m.lift > 0.5 ? 1 : m.state === 0 ? 0 : 2];
        const lit = clamp01((t - 0.5 - m.i * 0.12) * 1.5);
        m.tint.setRGB(base[0], base[1], base[2]).multiplyScalar(lit * (0.94 + 0.06 * Math.sin(t * 7 + m.i * 2)));
        if (m.bad > 0) m.tint.lerp(bad, m.bad * 0.7);
        m.sm.color.copy(m.tint);
        m.glowS.material.opacity = (m.state >= 2 ? 0.3 : 0.12 + m.lift * 0.3) * lit * e; m.glowS.material.color.setHex(m.state >= 2 ? 0x6fd68a : 0x7fc4ff);
      });
      H.update(t, e);
    },
  };
}
