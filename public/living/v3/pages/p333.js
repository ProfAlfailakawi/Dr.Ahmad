import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { P, ease, easeBack, clamp01, stag, mat, glossy, goldMat, shadowed, glow, sprite, lightTube } from '../../kit.js?v=25';
import { inked } from '../../pencil.js?v=25';
import { TAU, revealer, bumper, canvasTex, faceMat, hintGlow, pulseHint, setSpr, burstAt } from '../lib/a6-kit.js?v=25';

export const meta = { free: true, center: [0.5, 0.6], typeLabel: 'مخطط ينمو' };

const NODES = [
  { id: 'part', w: 'المشاركة', tag: 'يتميّز بـ', a: 30, c: 0xe0463a, g: 'chat', b: 'يتيح للطلبة إنشاء مقاطع الفيديو ومشاهدتها وإبداء آرائهم وتعليقاتهم والتواصل حول الملفات المعروضة.' },
  { id: 'pers', w: 'التخصيص', tag: 'يتميّز بـ', a: 90, c: 0xf2a02f, g: 'user', b: 'يتميز بالطابع الشخصي؛ إذ يختار كل متعلّم ما يشاهده وما ينتجه.' },
  { id: 'prod', w: 'الإنتاجية', tag: 'يتميّز بـ', a: 150, c: 0x8ac43a, g: 'gear', b: 'من خصائصه الإنتاجية، وله دور فاعل في تنمية مهارات الطلاب الرقمية.' },
  { id: 'skills', w: 'مهارات وتفكير ناقد', tag: 'تنمّي', a: 210, c: 0x2fa8c0, g: 'star', b: 'تحمّل المسؤولية والاحتكاك بالآخرين ومشاركتهم الخبرات، ومهارة التفكير الناقد وحل المشكلات.' },
  { id: 'clar', w: 'توضيح المحتوى', tag: 'تُثبت الدراسات', a: 270, c: 0x3a6fd0, g: 'lens', b: 'أثبتت الدراسات أن لمقاطع الفيديو جدوى كبيرة في توضيح المحتوى الدراسي واستحضار المعلومات.' },
  { id: 'att', w: 'الانتباه والاهتمام', tag: 'تُثبت الدراسات', a: 330, c: 0x8e5bd0, g: 'eye', b: 'تحافظ مقاطع الفيديو على انتباه الطلاب وتولّد لديهم الاهتمام بالموضوع.' },
];
const hx = (c) => '#' + c.toString(16).padStart(6, '0');
const RING = 0.27, CY = 0.3;

function glyph(c, kind, S) {
  c.strokeStyle = '#fff'; c.fillStyle = '#fff'; c.lineWidth = S * 0.06; c.lineCap = 'round'; c.lineJoin = 'round';
  const cx = S / 2, cy = S / 2;
  if (kind === 'chat') { c.beginPath(); c.roundRect(cx - S * 0.3, cy - S * 0.22, S * 0.6, S * 0.36, S * 0.08); c.stroke(); c.beginPath(); c.moveTo(cx - S * 0.1, cy + S * 0.14); c.lineTo(cx - S * 0.18, cy + S * 0.28); c.lineTo(cx + S * 0.02, cy + S * 0.14); c.stroke(); }
  if (kind === 'user') { c.beginPath(); c.arc(cx, cy - S * 0.1, S * 0.12, 0, TAU); c.stroke(); c.beginPath(); c.arc(cx, cy + S * 0.3, S * 0.24, Math.PI * 1.1, Math.PI * 1.9); c.stroke(); }
  if (kind === 'gear') { c.beginPath(); for (let i = 0; i < 16; i++) { const a = (i / 16) * TAU, r = i % 2 ? S * 0.2 : S * 0.29; c.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r); } c.closePath(); c.stroke(); c.beginPath(); c.arc(cx, cy, S * 0.08, 0, TAU); c.stroke(); }
  if (kind === 'star') { c.beginPath(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + (i / 10) * TAU, r = i % 2 ? S * 0.14 : S * 0.3; c.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r); } c.closePath(); c.stroke(); }
  if (kind === 'lens') { c.beginPath(); c.arc(cx - S * 0.04, cy - S * 0.04, S * 0.2, 0, TAU); c.stroke(); c.beginPath(); c.moveTo(cx + S * 0.1, cy + S * 0.1); c.lineTo(cx + S * 0.28, cy + S * 0.28); c.stroke(); }
  if (kind === 'eye') { c.beginPath(); c.moveTo(cx - S * 0.32, cy); c.quadraticCurveTo(cx, cy - S * 0.3, cx + S * 0.32, cy); c.quadraticCurveTo(cx, cy + S * 0.3, cx - S * 0.32, cy); c.stroke(); c.beginPath(); c.arc(cx, cy, S * 0.08, 0, TAU); c.fill(); }
}
function tileTex(n) {
  return canvasTex(256, 170, (c, w, h) => {
    const gr = c.createLinearGradient(0, 0, w, h); gr.addColorStop(0, hx(n.c)); gr.addColorStop(1, '#1f2a44'); c.fillStyle = gr; c.fillRect(0, 0, w, h);
    c.fillStyle = 'rgba(255,255,255,.16)'; c.fillRect(0, 0, w, 26);
    c.save(); c.translate(w / 2 - 60, h / 2 - 60 + 8); glyph(c, n.g, 120); c.restore();
    c.fillStyle = 'rgba(255,255,255,.9)'; c.fillRect(14, h - 20, w - 28, 5); c.fillStyle = '#ff5a4a'; c.fillRect(14, h - 20, (w - 28) * 0.45, 5);
  });
}
function roundRect(w, h, r) {
  const s = new THREE.Shape(); const x = -w / 2, y = -h / 2;
  s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r); s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r); s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y); return s;
}

export default function build(ctx) {
  const g = new THREE.Group(); g.position.copy(P(meta.center[0], meta.center[1])); g.scale.setScalar(1.12); ctx.stage.add(g);
  const R = revealer(), B = bumper();

  // no plinth: a soft shadow and a faint ring of light on the page show where the thumbnails orbit
  const shadow = new THREE.Mesh(new THREE.CircleGeometry(0.2, 36), new THREE.MeshBasicMaterial({ color: 0x1b2540, transparent: true, opacity: 0.16, depthWrite: false })); shadow.rotation.x = -Math.PI / 2; shadow.scale.set(1.3, 1, 0.8); shadow.position.set(0, 0.002, 0.02); g.add(shadow);
  const ringTop = new THREE.Mesh(new THREE.TorusGeometry(RING, 0.0035, 6, 90), new THREE.MeshBasicMaterial({ color: 0xe0463a, transparent: true, opacity: 0.55, toneMapped: false })); ringTop.rotation.x = Math.PI / 2; ringTop.position.y = 0.004; g.add(ringTop);
  const disc = { userData: { reveal() {} } }, redRim = ringTop, under = { scale: { setScalar() {} } };

  // laptop
  const lap = new THREE.Group(); lap.position.set(0, 0.0, 0.02); lap.scale.setScalar(1.12); g.add(lap);
  const lbase = inked(new RoundedBoxGeometry(0.3, 0.012, 0.2, 3, 0.005), { color: 0xd8dce0 }); lbase.position.y = 0.006; lap.add(lbase); R.add(lbase, 0.5, 1);
  const keyTex = canvasTex(256, 160, (c, w, h) => { c.fillStyle = '#c9ced3'; c.fillRect(0, 0, w, h); c.fillStyle = '#4a4f57'; for (let r = 0; r < 5; r++) for (let k = 0; k < 14; k++) c.fillRect(10 + k * 17.2, 10 + r * 17, 14, 13); c.fillStyle = '#b4bac0'; c.fillRect(88, 100, 80, 40); });
  const keys = new THREE.Mesh(new THREE.PlaneGeometry(0.26, 0.15), faceMat(keyTex)); keys.rotation.x = -Math.PI / 2; keys.position.set(0, 0.0125, 0.012); lap.add(keys);
  const lid = new THREE.Group(); lid.position.set(0, 0.012, -0.095); lid.rotation.x = -0.22; lap.add(lid);
  const lidBody = inked(new RoundedBoxGeometry(0.3, 0.2, 0.01, 3, 0.005), { color: 0xd8dce0 }); lidBody.position.y = 0.1; lid.add(lidBody); R.add(lidBody, 0.7, 1);
  const scrTex = canvasTex(256, 160, (c, w, h) => { const gr = c.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#2a1a3a'); gr.addColorStop(1, '#7a2a30'); c.fillStyle = gr; c.fillRect(0, 0, w, h); c.fillStyle = '#e0463a'; c.beginPath(); c.roundRect(w / 2 - 54, h / 2 - 38, 108, 76, 20); c.fill(); c.fillStyle = '#fff'; c.beginPath(); c.moveTo(w / 2 - 12, h / 2 - 20); c.lineTo(w / 2 - 12, h / 2 + 20); c.lineTo(w / 2 + 22, h / 2); c.closePath(); c.fill(); });
  const scr = new THREE.Mesh(new THREE.PlaneGeometry(0.28, 0.18), faceMat(scrTex, { transparent: true, opacity: 0 })); scr.position.set(0, 0.1, 0.0056); lid.add(scr);
  const badge = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.003, 20), goldMat()); badge.rotation.x = Math.PI / 2; badge.position.set(0, 0.1, -0.0065); lid.add(badge);

  // the hovering play button
  const hol = new THREE.Group(); hol.position.set(0, CY + 0.14, 0); g.add(hol);
  const body = new THREE.Mesh(new THREE.ExtrudeGeometry(roundRect(0.13, 0.092, 0.026), { depth: 0.016, bevelEnabled: true, bevelThickness: 0.004, bevelSize: 0.004, bevelSegments: 2, curveSegments: 8 }), glossy(0xe0302a, { emissive: 0xe0302a, emissiveIntensity: 0.25 })); body.position.z = -0.008; hol.add(body);
  const tri = new THREE.Shape(); tri.moveTo(-0.014, -0.024); tri.lineTo(-0.014, 0.024); tri.lineTo(0.03, 0); tri.closePath();
  const triM = new THREE.Mesh(new THREE.ExtrudeGeometry(tri, { depth: 0.004, bevelEnabled: false }), new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false })); triM.position.z = 0.0125; hol.add(triM);
  const triB = triM.clone(); triB.rotation.y = Math.PI; triB.position.z = -0.0125; hol.add(triB);
  const holGlow = glow(0xff5a4a, 0.34, 0.5); hol.add(holGlow);
  shadowed(hol);

  // thumbnails around the ring
  const nodes = NODES.map((n, i) => {
    const a = (n.a * Math.PI) / 180;
    const home = new THREE.Vector3(RING * Math.sin(a), CY, RING * Math.cos(a));
    const holder = new THREE.Group(); holder.position.copy(home); g.add(holder); holder.rotation.y = a;
    const inner = new THREE.Group(); holder.add(inner);
    const frame = new THREE.Mesh(new RoundedBoxGeometry(0.1, 0.07, 0.012, 3, 0.006), glossy(0x1f2a44)); inner.add(frame);
    const face = new THREE.Mesh(new THREE.PlaneGeometry(0.09, 0.06), faceMat(tileTex(n))); face.position.z = 0.0065; inner.add(face);
    const faceB = new THREE.Mesh(new THREE.PlaneGeometry(0.09, 0.06), new THREE.MeshBasicMaterial({ color: n.c, toneMapped: false })); faceB.rotation.y = Math.PI; faceB.position.z = -0.0065; inner.add(faceB);
    const hint = hintGlow(n.c, 0.18); hint.position.z = 0.012; inner.add(hint);
    const lw = n.w.length > 12 ? 0.2 : 0.15;
    const lab = sprite(n.w, lw, { size: 40, width: Math.round(lw * 1900), weight: 800, border: hx(n.c), color: '#2b2620', bg: 'rgba(251,248,240,.97)' });
    g.add(lab); lab.userData.lw = lw;
    // light tube from the play button
    const mid = new THREE.Vector3(home.x * 0.5, CY + 0.2, home.z * 0.5);
    const tube = lightTube(new THREE.QuadraticBezierCurve3(new THREE.Vector3(0, CY + 0.14, 0), mid, home.clone().add(new THREE.Vector3(0, 0.0, 0))), { radius: 0.0032, color: n.c, speed: 0.6, glass: false });
    g.add(tube); tube.userData.fill(0);
    const pk = glow(n.c, 0.045, 0.9); g.add(pk);
    return { n, holder, inner, hint, lab, lw, tube, pk, home, curve: tube.userData.curve, lift: 0, seen: false };
  });
  nodes.forEach((nd) => { nd.curve = new THREE.QuadraticBezierCurve3(new THREE.Vector3(0, CY + 0.14, 0), new THREE.Vector3(nd.home.x * 0.5, CY + 0.2, nd.home.z * 0.5), nd.home.clone()); });

  let now = 0, sel = -1, seen = new Set(), finished = false;
  function touch(i) {
    if (now < 3.2) return;
    const nd = nodes[i]; sel = i; seen.add(i); nd.seen = true; ctx.sfx.pop?.(); B.hit(nd.inner, now, 0.12);
    burstAt(ctx, g, nd.home.clone().add(new THREE.Vector3(0, 0.03, 0)), nd.n.c, 22, 0.35, 0.03);
    ctx.ui.card({ tag: nd.n.tag, title: nd.n.w, body: nd.n.b, color: nd.n.c });
    if (seen.size === NODES.length && !finished) { finished = true; setTimeout(() => { ctx.sfx.good?.(); ctx.ui.done(); }, 1500); }
  }
  nodes.forEach((nd, i) => ctx.tap(nd.holder, () => touch(i)));
  ctx.tap(hol, () => { ctx.sfx.pop?.(); B.hit(hol, now, 0.15); ctx.ui.card({ tag: 'ويب ٢٫٠', title: 'اليوتيوب أداة تعليم', body: 'من أقوى تطبيقات الويب ٢٫٠، وقد أثبت فعاليته في التعليم حتى غدا الأكثر استخداماً في الفصول من وسائل الإعلام الاجتماعية الأخرى.', color: 0xe0463a }); });
  ctx.ui.hud('المس الصور المصغّرة حول الزر');

  const pv = new THREE.Vector3();
  return {
    update(t, dt, e) {
      now = t; R.update(t, e); B.update(t);
      ringTop.scale.setScalar(Math.max(stag(t, 0.3, 0.8) * e, 0.001));
      scr.material.opacity = stag(t, 1.2, 0.8) * e;
      const hk = stag(t, 1.8, 0.9, easeBack) * e; hol.scale.setScalar(Math.max(hk, 0.001)); hol.rotation.y = Math.sin(t * 0.8) * 0.6; hol.position.y = CY + 0.14 + 0.008 * Math.sin(t * 1.6);
      holGlow.material.opacity = 0.35 * hk * (0.85 + 0.15 * Math.sin(t * 3));
      nodes.forEach((nd, i) => {
        const k = stag(t, 2.2 + i * 0.4, 0.8, easeBack) * e;
        nd.holder.visible = k > 0.01;
        nd.lift = THREE.MathUtils.damp(nd.lift, sel === i ? 1 : 0, 6, dt);
        nd.holder.scale.setScalar(Math.max(k * (1 + 0.28 * nd.lift), 0.001));
        nd.holder.position.set(nd.home.x * (1 + 0.18 * nd.lift), nd.home.y + 0.008 * Math.sin(t * 1.5 + i) + 0.02 * nd.lift, nd.home.z * (1 + 0.18 * nd.lift));
        pulseHint(nd.hint, t, i * 1.1, nd.seen ? 0 : 1, 0.32);
        nd.lab.position.set(nd.holder.position.x, nd.holder.position.y - 0.065, nd.holder.position.z + 0.0);
        setSpr(nd.lab, nd.lw, stag(t, 2.6 + i * 0.4, 0.5, easeBack) * e);
        nd.tube.userData.update(dt); nd.tube.userData.fill(stag(t, 2.0 + i * 0.4, 0.8, ease) * e);
        // a packet of meaning travelling along the tube
        const u = (t * 0.35 + i * 0.17) % 1; nd.curve.getPoint(u, pv); nd.pk.position.copy(pv);
        nd.pk.material.opacity = 0.9 * stag(t, 2.8 + i * 0.4, 0.5) * e * Math.sin(u * Math.PI); nd.pk.scale.setScalar(0.04 + (nd.seen ? 0.02 : 0));
      });
    },
  };
}
