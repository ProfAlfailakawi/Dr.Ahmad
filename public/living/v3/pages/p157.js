// p157 — a test bench: a prototype laptop and six chunky coins. Three coins carry false statements; tap one and it flips to the truth.
import * as THREE from 'three';
import { P, ease, easeBack, clamp01, stag, glow } from '../../kit.js?v=29';
import { rb, std, lit, gloss, brass, add, grp, hit, Seq, Pulse, touch, desk, at, TAU, INK, GOLD } from '../lib/a2.js?v=29';

export const meta = { free: true, center: [0.5, 0.42], typeLabel: 'لعبة كشف الأخطاء' };

const CL = [
  { t: 'اختبار النموذج الأولي', ok: true, msg: 'صحيحة: الهدف اختبار البرنامج بصورته الأولية' },
  { t: 'تجربة حقيقية بلا حضور المصمم', ok: false, fix: 'بإشراف المصمم، وفي ظروف غير حقيقية', title: 'التجربة ليست حقيقية', body: 'تُجرى في ظروف ليست حقيقية، مع مجموعة استطلاعية من خارج الفئة المستهدفة، وبإشراف المصمم وحضوره.' },
  { t: 'تهيئة القاعة والأجهزة', ok: true, msg: 'صحيحة: من التهيئة قاعة الدراسة والمعلم والأجهزة والأدوات' },
  { t: 'التنفيذ جزء من التصميم', ok: false, fix: 'تهيئة لتطبيق التصميم لا جزء منه', title: 'التنفيذ خارج التصميم', body: 'هذه العملية لا تدخل ضمن عملية التصميم، وإنما هي تهيئة لتطبيق التصميم التعليمي.' },
  { t: 'فريق التطبيق: معلم ومتعلم ومصمم', ok: true, msg: 'صحيحة: يضم الفريق المعلم والمتعلم ومصمم التعليم نفسه' },
  { t: 'الطباعة والتصوير تفاصيل ثانوية', ok: false, fix: 'جزئيات تضمن نجاح التطبيق', title: 'تفاصيل تضمن النجاح', body: 'قد يراها بعضهم غير مهمة، لكنها جزئيات تضمن نجاح عملية التطبيق بشكل كبير.' },
];

function coinTex(text, c1, c2, fg) {
  const c = document.createElement('canvas'); c.width = c.height = 512; const g = c.getContext('2d');
  const gr = g.createRadialGradient(256, 200, 20, 256, 256, 256); gr.addColorStop(0, c1); gr.addColorStop(1, c2);
  g.fillStyle = gr; g.beginPath(); g.arc(256, 256, 256, 0, TAU); g.fill();
  g.strokeStyle = 'rgba(255,255,255,.55)'; g.lineWidth = 10; g.beginPath(); g.arc(256, 256, 232, 0, TAU); g.stroke();
  g.fillStyle = fg; g.direction = 'rtl'; g.textAlign = 'center'; g.textBaseline = 'middle';
  let size = 62; g.font = `800 ${size}px Tajawal, sans-serif`;
  const words = text.split(' '), lines = []; let cur = '';
  words.forEach((w) => { const tt = cur ? cur + ' ' + w : w; if (g.measureText(tt).width > 340 && cur) { lines.push(cur); cur = w; } else cur = tt; });
  lines.push(cur);
  const lh = size * 1.25, y0 = 256 - (lines.length - 1) * lh / 2;
  lines.forEach((l, i) => g.fillText(l, 256, y0 + i * lh));
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}
function codeTex() {
  const c = document.createElement('canvas'); c.width = 512; c.height = 340; const g = c.getContext('2d');
  g.fillStyle = '#4cc4b2'; g.fillRect(0, 0, 512, 340);
  g.fillStyle = '#a8e6dc'; g.beginPath(); g.roundRect(30, 30, 452, 280, 20); g.fill();
  g.strokeStyle = '#1b6f66'; g.lineWidth = 8; g.beginPath(); g.moveTo(90, 220); g.bezierCurveTo(90, 60, 250, 60, 250, 220); g.stroke();
  g.fillStyle = '#ffffff'; [[90, 220], [250, 220], [170, 96]].forEach(([x, y]) => g.fillRect(x - 11, y - 11, 22, 22));
  g.fillStyle = '#1b6f66'; g.font = 'bold 54px monospace'; g.textAlign = 'center'; g.fillText('</>', 380, 150);
  g.fillRect(300, 190, 150, 12); g.fillRect(300, 220, 100, 12); g.fillRect(300, 250, 130, 12);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

export default function build(ctx) {
  const g = new THREE.Group(); g.position.copy(P(meta.center[0], meta.center[1])); ctx.stage.add(g);
  const seq = new Seq(), pulse = new Pulse();
  let found = 0;
  const Y0 = 0.09;
  const bench = desk(g, 0.88, 0.56); seq.add(bench, 0, 0.7, { rise: 0.06 });

  // the prototype laptop, back centre
  const lap = grp(g, 0, Y0, -0.15); lap.scale.setScalar(1.35);
  add(lap, rb(0.27, 0.012, 0.18, 0.008, 3), std(0xe4e6e8, { metalness: 0.4 }), 0, 0.006, 0, true);
  add(lap, new THREE.PlaneGeometry(0.24, 0.15), std(0x9aa3a8), 0, 0.0124, 0.0).rotation.x = -Math.PI / 2;
  const hinge = grp(lap, 0, 0.012, -0.09), lid = grp(hinge, 0, 0, 0); lid.rotation.x = Math.PI / 2;
  add(lid, rb(0.27, 0.18, 0.008, 0.008, 3), std(0x2b2e3a, { metalness: 0.4 }), 0, 0.09, 0, true);
  const ct = codeTex();
  add(lid, new THREE.PlaneGeometry(0.25, 0.165), new THREE.MeshStandardMaterial({ map: ct, emissiveMap: ct, emissive: 0xffffff, emissiveIntensity: 0.6 }), 0, 0.09, 0.0046);
  const lg = glow(0x6cf0d8, 0.4, 0); lg.position.set(0, 0.1, 0.05); lid.add(lg);
  seq.add(lap, 0.1, 0.8, { rise: 0.04 });
  // tools of the printed picture: gear and pen nib
  const gear = grp(g, 0.37, Y0 + 0.04, -0.18);
  add(gear, new THREE.CylinderGeometry(0.04, 0.04, 0.014, 22), brass(), 0, 0, 0, true);
  for (let i = 0; i < 8; i++) { const a = i * TAU / 8; add(gear, rb(0.018, 0.014, 0.018, 0.003, 1), brass(), Math.cos(a) * 0.048, 0, Math.sin(a) * 0.048).rotation.y = -a; }
  add(gear, new THREE.CylinderGeometry(0.014, 0.014, 0.016, 14), std(0x2b2e3a), 0, 0, 0);
  seq.add(gear, 0.4, 0.7);
  const nib = grp(g, -0.37, Y0, -0.17);
  add(nib, new THREE.CylinderGeometry(0.014, 0.014, 0.1, 14), std(0xef8f2a), 0, 0.05, 0, true);
  add(nib, new THREE.ConeGeometry(0.014, 0.04, 14), brass(), 0, 0.12, 0, true);
  seq.add(nib, 0.5, 0.7);

  // six coins in two rows on the bench front
  const pos = [[-0.27, 0.05], [0, 0.05], [0.27, 0.05], [-0.27, 0.25], [0, 0.25], [0.27, 0.25]];
  const coins = CL.map((c, i) => {
    const [x, z] = pos[i];
    const s = grp(g, x, Y0, z);
    add(s, new THREE.CylinderGeometry(0.05, 0.058, 0.018, 28), std(0xf6efe0), 0, 0.009, 0, true);
    const tilt = grp(s, 0, 0.1, 0); tilt.rotation.x = -0.45;
    add(s, new THREE.CylinderGeometry(0.008, 0.008, 0.09, 8), brass(), 0, 0.055, -0.01);
    const spin = grp(tilt, 0, 0, 0), face = grp(spin, 0, 0, 0);
    const rimMesh = add(face, new THREE.CylinderGeometry(0.078, 0.078, 0.018, 40), brass(), 0, 0, 0, true); rimMesh.rotation.x = Math.PI / 2;
    const front = add(face, new THREE.CircleGeometry(0.07, 40), new THREE.MeshBasicMaterial({ map: coinTex(c.t, '#47485a', '#1f2030', '#ffffff'), toneMapped: false }), 0, 0, 0.0095);
    const back = add(face, new THREE.CircleGeometry(0.07, 40), new THREE.MeshBasicMaterial({ map: coinTex(c.ok ? c.t : c.fix, '#9bbf3a', '#4d6e12', '#ffffff'), toneMapped: false }), 0, 0, -0.0095); back.rotation.y = Math.PI;
    hit(s, 0.095, 0, 0.11, 0);
    const pp = pulse.add(s, 0xffc94a, 0.26, 0, 0.11, 0, { op: 0.35 });
    seq.add(s, 0.45 + i * 0.12, 0.7, { rise: 0.1 });
    return { s, face, spin, c, i, pp, flip: -1, done: false, d: 0.45 + i * 0.12 };
  });
  coins.forEach((o) => touch(ctx, o.s, () => {
    if (o.done) return;
    if (o.c.ok) { ctx.ui.toast(o.c.msg); ctx.sfx.pop?.(); return; }
    o.done = true; o.flip = 0; o.pp.visible = false; found++; ctx.sfx.good?.();
    ctx.ui.card({ tag: 'اكشف الخطأ: مرحلة التنفيذ', title: o.c.title, body: o.c.body, color: 0x8aa51f });
    if (found >= 3) { ctx.ui.hud('كشفت الأخطاء الثلاثة'); ctx.ui.done(); } else ctx.ui.hud(`${found} من ٣ — تابع`);
  }, 0xe0b85e));

  ctx.ui.hud('ثلاث عبارات خاطئة: اكتشفها');

  return {
    update(t, dt, e) {
      seq.update(t, e); pulse.update(t, e);
      lid.rotation.x = Math.PI / 2 - (Math.PI / 2 + 0.3) * ease((t - 0.2) / 1.3);
      lg.material.opacity = e * 0.25 * ease((t - 1) / 1);
      gear.rotation.x = Math.PI / 2; gear.rotation.z += dt * 0.9;
      coins.forEach((o) => {
        o.spin.rotation.y = (1 - ease((t - o.d) / 1.0)) * TAU;
        if (o.flip >= 0) { o.flip += dt; o.face.rotation.y = Math.PI * ease(o.flip / 0.7); if (o.flip > 0.35 && o.flip - dt <= 0.35) ctx.fx.burst(at(ctx, o.s, 0.12), 0x9bbf3a, 14, 0.3, 0.03); }
        o.face.position.y = Math.sin(t * 1.6 + o.i) * 0.003;
      });
    },
  };
}
