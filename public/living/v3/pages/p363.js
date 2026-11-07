// p363 — a laptop that writes itself on a teal hexagon; six little exhibits ring it, each wired to the screen by a thread of light.
import * as THREE from 'three';
import { P, ease, easeBack, clamp01, stag, mat, glossy, goldMat, shadowed, lightTube } from '../../kit.js?v=15';
import { TAU, canvasTex, rbox, lit, rig, hints, burstAt, lightPool, hexSlab } from '../lib/a7.js?v=15';

export const meta = { free: true, center: [0.38, 0.5], typeLabel: 'مجسّم تفاعلي' };

const KINDS = [
  { k: 'person', c: 0xe8604c, tag: 'ثلاثة أنواع', t: 'مدونات الأشخاص', b: 'يكتبها أشخاص بصفتهم الشخصية للمتعة فقط، وهي أحد أنواع المدونات الثلاثة.' },
  { k: 'pen', c: 0xe8b23a, tag: 'ثلاثة أنواع', t: 'المدونات التحريرية', b: 'يقوم محررون محترفون بكتابتها وتحريرها.' },
  { k: 'inst', c: 0x4a8fd0, tag: 'ثلاثة أنواع', t: 'مدونات المؤسسات', b: 'تخصّ المؤسسات والمدارس والشركات، وتتواصل بها مع القرّاء بالأحداث والأخبار.' },
  { k: 'video', c: 0xf08a3a, tag: 'صور متعددة', t: 'التدوين بالفيديو', b: 'للبلوق صور غير النص: vlog بالفيديو، وphotoblog بالصور، وpodcasting بالصوت، وmicroblog للمشاركات القصيرة.' },
  { k: 'folder', c: 0xd9a23a, tag: 'خدمات التدوين', t: 'حفظ وأرشفة وتصنيف', b: 'يتيح للمعلم كتابة مواضيع المقرر، وللمتعلمين إضافة تعليقات، مع حفظ المحتويات وأرشفتها وتصنيفها.' },
  { k: 'globe', c: 0x2fa38a, tag: 'خدمات التدوين', t: 'من أي مكان', b: 'يمكن استخدام خدمات التدوين من أي مكان تتوافر فيه شبكة الإنترنت، وبعضها عبر رسائل الهاتف المحمول.' },
];

const icons = {
  person() { const o = new THREE.Group(); const h = new THREE.Mesh(new THREE.SphereGeometry(0.02, 24, 16), glossy(0xf4d3b5)); h.position.y = 0.03; const s = new THREE.Mesh(new THREE.SphereGeometry(0.036, 28, 14, 0, TAU, 0, Math.PI / 2), glossy(0xe8604c)); s.position.y = -0.03; o.add(h, s); return o; },
  pen() { const o = new THREE.Group(); const b = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.009, 0.07, 6), glossy(0xf2c230)); const t = new THREE.Mesh(new THREE.ConeGeometry(0.009, 0.02, 6), glossy(0xf1d3a8)); t.position.y = -0.045; const lead = new THREE.Mesh(new THREE.ConeGeometry(0.0035, 0.008, 6), mat(0x333333)); lead.position.y = -0.058; const e = new THREE.Mesh(new THREE.CylinderGeometry(0.0095, 0.0095, 0.012, 12), glossy(0xe86a8a)); e.position.y = 0.041; o.add(b, t, lead, e); o.rotation.z = 0.7; return o; },
  inst() { const o = new THREE.Group(); const b = new THREE.Mesh(rbox(0.07, 0.04, 0.04, 0.003), glossy(0xf5f1e6)); b.position.y = -0.01; const r = new THREE.Mesh(new THREE.ConeGeometry(0.052, 0.026, 4), glossy(0x4a8fd0)); r.rotation.y = Math.PI / 4; r.position.y = 0.023; o.add(b, r); [-0.022, 0, 0.022].forEach((x) => { const c = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.034, 10), glossy(0xffffff)); c.position.set(x, -0.01, 0.022); o.add(c); }); return o; },
  video() { const o = new THREE.Group(); const b = new THREE.Mesh(rbox(0.082, 0.056, 0.012, 0.008), glossy(0xf08a3a)); const tri = new THREE.Mesh(new THREE.CircleGeometry(0.017, 3), lit(0xffffff)); tri.position.z = 0.0065; o.add(b, tri); return o; },
  folder() { const o = new THREE.Group(); const bk = new THREE.Mesh(rbox(0.07, 0.05, 0.01, 0.004), glossy(0xc88f25)); const tab = new THREE.Mesh(rbox(0.03, 0.01, 0.01, 0.003), glossy(0xc88f25)); tab.position.set(-0.02, 0.029, 0); const fr = new THREE.Mesh(rbox(0.07, 0.04, 0.008, 0.004), glossy(0xe9b94a)); fr.position.set(0, -0.005, 0.01); const pp = new THREE.Mesh(rbox(0.06, 0.04, 0.002, 0.001), mat(0xffffff)); pp.position.set(0, 0.008, 0.004); o.add(bk, tab, pp, fr); return o; },
  globe() { const o = new THREE.Group(); const s = new THREE.Mesh(new THREE.SphereGeometry(0.03, 28, 18), glossy(0x2fa38a)); const r = new THREE.Mesh(new THREE.TorusGeometry(0.04, 0.0025, 8, 40), goldMat()); r.rotation.set(1.2, 0.2, 0); o.add(s, r); [0.045, 0.06].forEach((rr, i) => { const w = new THREE.Mesh(new THREE.TorusGeometry(rr, 0.0018, 6, 24, 1.1), lit(0xbff5e8)); w.position.set(0.0, 0.0, 0); w.rotation.z = 0.2 + Math.PI / 4 - 0.55; w.position.x = 0.0; w.position.y = 0.0; w.scale.setScalar(1); w.userData.w = 1; w.position.set(0.035, 0.03, 0); o.add(w); }); return o; },
};

function screenDraw(g, W, H, kind, p) {
  g.fillStyle = '#ffffff'; g.fillRect(0, 0, W, H);
  g.fillStyle = '#e9eef2'; g.fillRect(0, 0, W, 26); [['#ff6159', 14], ['#ffbd2e', 32], ['#28c840', 50]].forEach(([c, x]) => { g.fillStyle = c; g.beginPath(); g.arc(x, 13, 5, 0, TAU); g.fill(); });
  const col = '#' + KINDS[kind].c.toString(16).padStart(6, '0');
  g.fillStyle = col; g.fillRect(24, 44, W - 48, 100);
  g.fillStyle = 'rgba(255,255,255,.92)';
  const cx = W / 2, cy = 94;
  if (kind === 0) { g.beginPath(); g.arc(cx, cy - 12, 17, 0, TAU); g.fill(); g.beginPath(); g.ellipse(cx, cy + 36, 34, 22, 0, Math.PI, 0); g.fill(); }
  if (kind === 1) { g.save(); g.translate(cx, cy); g.rotate(0.7); g.fillRect(-8, -40, 16, 66); g.beginPath(); g.moveTo(-8, 26); g.lineTo(8, 26); g.lineTo(0, 44); g.fill(); g.restore(); }
  if (kind === 2) { g.fillRect(cx - 40, cy - 6, 80, 38); g.beginPath(); g.moveTo(cx - 50, cy - 6); g.lineTo(cx, cy - 36); g.lineTo(cx + 50, cy - 6); g.fill(); }
  if (kind === 3) { g.beginPath(); g.moveTo(cx - 16, cy - 28); g.lineTo(cx + 26, cy); g.lineTo(cx - 16, cy + 28); g.fill(); }
  if (kind === 4) { g.fillRect(cx - 44, cy - 22, 88, 56); g.fillStyle = col; g.fillRect(cx - 34, cy - 10, 68, 5); g.fillRect(cx - 34, cy + 6, 68, 5); g.fillRect(cx - 34, cy + 22, 44, 5); }
  if (kind === 5) { g.strokeStyle = 'rgba(255,255,255,.92)'; g.lineWidth = 6; g.beginPath(); g.arc(cx, cy, 30, 0, TAU); g.stroke(); g.beginPath(); g.ellipse(cx, cy, 13, 30, 0, 0, TAU); g.stroke(); g.beginPath(); g.moveTo(cx - 30, cy); g.lineTo(cx + 30, cy); g.stroke(); }
  g.fillStyle = '#cdd6dd';
  const lines = [[24, 168, 360], [24, 190, 300], [24, 212, 330], [24, 234, 210], [24, 256, 280]];
  const total = lines.reduce((s, l) => s + l[2], 0); let used = p * total;
  lines.forEach(([x, y, w]) => { const k = Math.max(0, Math.min(1, used / w)); used -= w; g.fillRect(x, y, w * k, 10); });
}

export default function build(ctx) {
  const g = new THREE.Group(); g.position.copy(P(meta.center[0], meta.center[1])); ctx.stage.add(g); g.scale.setScalar(1.0);
  const R = rig(), H = hints(g);
  const seen = new Set(); let done = false, sel = 0, typed = 0, redraw = 0, last = -1;

  const base = new THREE.Group(); g.add(base);
  const sh = lightPool(0x000000, 0.55, 0.2); sh.position.y = -0.002; sh.scale.set(1.5, 1, 1); base.add(sh);
  R.add(base, 0.1, { dur: 0.9, rise: 0.06 });
  const TY = 0.012;

  // ---- laptop
  const lap = new THREE.Group(); lap.scale.setScalar(1.2); lap.position.set(0, TY, 0.0); g.add(lap);
  const deck = new THREE.Mesh(rbox(0.31, 0.012, 0.21, 0.006), glossy(0xcdd2da, { roughness: 0.3 })); deck.position.y = 0.006; lap.add(deck);
  const keys = new THREE.InstancedMesh(rbox(0.0165, 0.004, 0.0165, 0.002), glossy(0x232a38), 14 * 4); const d = new THREE.Object3D(); let ki = 0;
  for (let r = 0; r < 4; r++) for (let c = 0; c < 14; c++) { d.position.set(-0.1 + c * 0.0155, 0.014, -0.045 + r * 0.0185); d.updateMatrix(); keys.setMatrixAt(ki++, d.matrix); }
  lap.add(keys);
  const pad = new THREE.Mesh(rbox(0.07, 0.002, 0.045, 0.002), glossy(0xe3e6eb)); pad.position.set(0, 0.013, 0.07); lap.add(pad);
  const hinge = new THREE.Group(); hinge.position.set(0, 0.012, -0.1); hinge.rotation.x = -0.28; lap.add(hinge);
  const lid = new THREE.Mesh(rbox(0.31, 0.2, 0.009, 0.006), glossy(0xcdd2da, { roughness: 0.3 })); lid.position.y = 0.1; hinge.add(lid);
  const sc = document.createElement('canvas'); sc.width = 420; sc.height = 280; const sg = sc.getContext('2d');
  const stex = new THREE.CanvasTexture(sc); stex.colorSpace = THREE.SRGBColorSpace;
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.286, 0.19), new THREE.MeshBasicMaterial({ map: stex, toneMapped: false })); screen.position.set(0, 0.1, 0.0052); hinge.add(screen);
  R.add(lap, 0.5, { dur: 1.0, rise: 0.12 });
  ctx.tap(screen, () => { ctx.sfx.pop?.(); R.bounce(lap); ctx.ui.card({ tag: 'Web Log', title: 'سجلّ على الشبكة', body: 'البلوق موقع إلكتروني يكون عادة ملكاً لأشخاص، يدخلون عليه بشكل منتظم ويزودونه بتعليقات أو أوصاف.', color: 0x2fa38a }); });
  H.add(screen, 0xffffff, 0.2, new THREE.Vector3(0, TY + 0.17, 0.0), () => (seen.size ? 0 : 0.6));

  // ---- six exhibits
  const RN = 0.31;
  const ex = KINDS.map((kd, i) => {
    const a = (i / 6) * TAU + 0.52; const x = Math.cos(a) * RN * 1.0, z = Math.sin(a) * RN * 0.78 + 0.02;
    const gp = new THREE.Group(); gp.position.set(x, TY, z); gp.scale.setScalar(1.3); g.add(gp);
    const ped = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.056, 0.01, 36), glossy(0xfdf9ee)); ped.position.y = 0.005; gp.add(ped);
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.0028, 0.0028, 0.07, 8), goldMat()); stem.position.y = 0.045; gp.add(stem);
    const ico = icons[kd.k](); const ih = new THREE.Group(); ih.position.y = 0.115; ih.scale.setScalar(1.25); ih.add(ico); gp.add(ih);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.0026, 8, 40), lit(kd.c)); ring.rotation.x = Math.PI / 2; ring.position.y = 0.011; gp.add(ring);
    const from = new THREE.Vector3(0, TY + 0.17, -0.1), to = new THREE.Vector3(x, TY + 0.115, z);
    const mid = from.clone().lerp(to, 0.5); mid.y += 0.1;
    const tube = lightTube(new THREE.CatmullRomCurve3([from, mid, to]), { radius: 0.0045, color: kd.c, speed: 0.4, glass: false });
    tube.userData.core.material.opacity = 0.35; g.add(tube);
    R.add(gp, 1.1 + i * 0.22, { dur: 0.8, rise: 0.1 }); R.add(tube, 2.0 + i * 0.1, { dur: 0.01, fn: ease });
    H.add(ped, kd.c, 0.17, new THREE.Vector3(x, TY + 0.1, z));
    const o = { kd, gp, ih, tube, ring, on: 0 };
    ctx.tap(gp, () => {
      ctx.sfx.pop?.(); R.bounce(gp); burstAt(ctx, ih, kd.c, 20, 0.3, 0.025); H.seen(ped); sel = i; redraw = 0; typed = 0; o.on = 1;
      ctx.ui.card({ tag: kd.tag, title: kd.t, body: kd.b, color: kd.c });
      seen.add(i); if (seen.size === 6 && !done) { done = true; setTimeout(() => { ctx.sfx.good?.(); ctx.ui.done(); }, 1100); }
    });
    return o;
  });

  ctx.ui.hud('المس المعروضات حول الشاشة');
  return {
    update(t, dt, e) {
      R.update(t, dt, e); H.update(t, e, stag(t, 3.4, 0.6));
      typed = Math.min(1, typed + dt * 0.18); redraw += dt;
      const q = Math.round(typed * 40) + sel * 100;
      if (redraw > 0.08 && q !== last) { last = q; redraw = 0; screenDraw(sg, 420, 280, sel, ease(typed)); stex.needsUpdate = true; }
      ex.forEach((o, i) => {
        o.on = Math.max(0, o.on - dt * 0.25); const act = i === sel ? 1 : 0;
        o.ih.rotation.y += dt * (0.8 + o.on * 3); o.ih.position.y = 0.115 + Math.sin(t * 1.5 + i) * 0.006;
        o.tube.userData.update(dt); o.tube.userData.core.material.opacity = 0.3 + 0.65 * Math.max(act, o.on);
        o.ring.scale.setScalar(1 + 0.05 * Math.sin(t * 3 + i) * act);
      });
    },
  };
}
