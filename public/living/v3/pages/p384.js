// p384 — a message travels phone → relay tower → phone; the slider turns it from plain text into a rich multimedia message.
import * as THREE from 'three';
import { P, ease, easeBack, clamp01, stag, mat, glossy, goldMat, shadowed, lightTube } from '../../kit.js?v=16';
import { TAU, canvasTex, rbox, lit, rig, hints, burstAt, lightPool, tagSprite, setSpr, hexSlab, lerp } from '../lib/a7.js?v=16';

export const meta = { free: true, center: [0.62, 0.28], typeLabel: 'مقارنة بمنزلق' };

function photoTex() {
  return canvasTex(256, 176, (g, W, H) => {
    const gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, '#7fd0f0'); gr.addColorStop(1, '#e9f6fb'); g.fillStyle = gr; g.fillRect(0, 0, W, H);
    g.fillStyle = '#ffd35a'; g.beginPath(); g.arc(196, 46, 24, 0, TAU); g.fill();
    g.fillStyle = '#4f9a6b'; g.beginPath(); g.moveTo(0, H); g.lineTo(70, 62); g.lineTo(140, H); g.fill();
    g.fillStyle = '#3a7f57'; g.beginPath(); g.moveTo(90, H); g.lineTo(168, 84); g.lineTo(256, H); g.fill();
  });
}

function phoneModel(c) {
  const o = new THREE.Group();
  const b = new THREE.Mesh(rbox(0.1, 0.19, 0.013, 0.014), glossy(0x1c2230)); b.position.y = 0.095; o.add(b);
  const s = new THREE.Mesh(new THREE.PlaneGeometry(0.088, 0.17), new THREE.MeshBasicMaterial({ color: c, toneMapped: false })); s.position.set(0, 0.095, 0.0072); o.add(s);
  const bar = new THREE.Mesh(new THREE.PlaneGeometry(0.06, 0.006), lit(0xffffff)); bar.position.set(0, 0.17, 0.0076); o.add(bar);
  return { o, s };
}

export default function build(ctx) {
  const g = new THREE.Group(); g.position.copy(P(meta.center[0], meta.center[1])); ctx.stage.add(g); g.scale.setScalar(0.92);
  const R = rig(), H = hints(g);
  const seen = new Set(); let done = false, rich = 0, richTo = 0.05, maxRich = 0, auto = true, prevRich = 0, now = 0, boomAt = -9;
  const finish = (id) => { seen.add(id); if (seen.size >= 3 && maxRich > 0.85 && !done) { done = true; setTimeout(() => { ctx.sfx.good?.(); ctx.ui.done(); }, 900); } };
  const sh = lightPool(0x000000, 0.5, 0.25); sh.position.y = -0.002; sh.scale.set(1.6, 0.6, 1); g.add(sh);

  // ---- two phones at the sides
  const pa = phoneModel(0xdfe7f1), pb = phoneModel(0xdfe7f1);
  const A = new THREE.Group(); A.scale.setScalar(1.3); A.position.set(-0.34, 0.0, 0.04); A.rotation.set(-0.1, 0.5, 0); A.add(pa.o);
  const B = new THREE.Group(); B.scale.setScalar(1.3); B.position.set(0.34, 0.0, 0.04); B.rotation.set(-0.1, -0.5, 0); B.add(pb.o);
  g.add(A, B); [A, B].forEach((p, i) => { R.add(p, 0.4 + i * 0.25, { dur: 0.8, rise: 0.12 }); shadowed(p); });

  // ---- the message: one big card that grows from plain text into a rich message
  const msg = new THREE.Group(); msg.position.set(0, 0.26, 0); g.add(msg);
  const plate = new THREE.Mesh(rbox(0.5, 0.38, 0.05, 0.03), glossy(0xdfe3ea, { roughness: 0.3 })); msg.add(plate);
  const tail = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.07, 4), glossy(0xdfe3ea, { roughness: 0.3 })); tail.rotation.set(Math.PI, 0.8, 0.5); tail.position.set(-0.17, -0.23, 0); msg.add(tail);
  const lines = [0, 1, 2, 3].map(() => { const l = new THREE.Mesh(new THREE.BoxGeometry(1, 0.024, 0.004), lit(0x586070)); msg.add(l); return l; });
  const pic = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.2), new THREE.MeshBasicMaterial({ map: photoTex(), toneMapped: false })); msg.add(pic);
  const play = new THREE.Group(); const pc = new THREE.Mesh(new THREE.CircleGeometry(0.036, 32), lit(0xffffff)); const pt = new THREE.Mesh(new THREE.CircleGeometry(0.02, 3), lit(0xe8604c)); pt.position.x = 0.004; play.add(pc, pt); msg.add(play);
  const bars = [0, 1, 2].map((k) => { const b = new THREE.Mesh(new THREE.BoxGeometry(0.04, 1, 0.006), lit([0xe8604c, 0xf2c230, 0x3a8fe0][k])); msg.add(b); return b; });
  const star = new THREE.Mesh(new THREE.OctahedronGeometry(0.045, 0), glossy(0xf2c230, { emissive: 0xf08a3a, emissiveIntensity: 0.5 })); star.scale.set(1, 1.3, 0.6); msg.add(star);
  R.add(msg, 0.8, { dur: 1.0, rise: 0.15 });
  H.add(plate, 0xffffff, 0.3, null, () => 1);

  // threads of light from each phone to the card
  const mk = (a, b) => lightTube(new THREE.CatmullRomCurve3([a, new THREE.Vector3((a.x + b.x) / 2, 0.42, 0.05), b]), { radius: 0.005, color: 0xffffff, speed: 0.5, glass: false });
  const t1 = mk(new THREE.Vector3(-0.34, 0.26, 0.04), new THREE.Vector3(-0.26, 0.3, 0.02)), t2 = mk(new THREE.Vector3(0.26, 0.3, 0.02), new THREE.Vector3(0.34, 0.26, 0.04));
  [t1, t2].forEach((t) => { t.userData.core.material.opacity = 0.5; g.add(t); });

  const card = (obj, tag, title, body, color, id) => { ctx.sfx.pop?.(); burstAt(ctx, obj, color, 18, 0.3, 0.024); ctx.ui.card({ tag, title, body, color }); finish(id); };
  ctx.tap(A, () => { R.bounce(A); card(A, 'SMS', 'رسالة نصية قصيرة', 'رسائل نصية قصيرة بين المشتركين في شبكة الهاتف النقال، تقدم فرصاً جيدة للتواصل بين المحاضرين والطلاب.', 0x586070, 'a'); });
  ctx.tap(B, () => { R.bounce(B); card(B, 'MMS', 'الوسائط المتعددة', 'خدمة إرسال الوسائط المتعددة، تدمج النص بالرسوم والجرافيك والصور.', 0x2f9fc4, 'b'); });
  ctx.tap(msg, () => {
    R.bounce(msg); H.seen(plate);
    if (rich < 0.5) card(msg, 'SMS', 'نص مجرّد', 'تعبر الرسالة القصيرة مركز الإرسال الرئيس الذي يعالجها ويديرها.', 0x586070, 'm');
    else card(msg, 'MMS', 'نص وصورة ورسم', 'تدمج النص المرسَل بالرسوم والجرافيك والصور، فتتجاوز النص المجرد إلى مضمون أغنى بصرياً.', 0x2f9fc4, 'm');
  });

  ctx.ui.hud('حرّك المنزلق: من النص إلى الوسائط');
  ctx.ui.slider({ label: 'نص ← وسائط', value: 0.05, onInput: (v) => { auto = false; richTo = v; } });
  const c0 = new THREE.Color(0xdfe3ea), c1 = new THREE.Color(0x35b0d4), col = new THREE.Color();
  return {
    update(t, dt, e) {
      now = t; R.update(t, dt, e); H.update(t, e, stag(t, 2.6, 0.6));
      if (auto && t > 1.6) richTo = 0.5 + 0.5 * Math.sin((t - 1.6) * 0.8 - 1.5);
      rich = THREE.MathUtils.damp(rich, richTo, 5, dt); maxRich = Math.max(maxRich, rich);
      if (prevRich < 0.7 && rich >= 0.7) { burstAt(ctx, star, 0xffd27a, 26, 0.45, 0.035); boomAt = t; }
      prevRich = rich;
      const r = clamp01(rich * 1.1); col.copy(c0).lerp(c1, r); plate.material.color.copy(col); tail.material.color.copy(col);
      const sz = 1 + rich * 0.8; plate.scale.z = sz; const fz = 0.025 * sz + 0.003;
      const tw = (a, b, k) => a + (b - a) * k;
      lines.forEach((l, j) => {
        const w = tw([0.38, 0.32, 0.35, 0.22][j], [0.3, 0.26, 0.2, 0][j], clamp01(rich * 1.4)); l.scale.x = Math.max(0.0001, w);
        l.position.set(tw(0, -0.0, rich) + tw(0, -0.0, rich), tw(0.12 - j * 0.075, -0.125 - j * 0.032, clamp01(rich * 1.5)), fz);
        l.material.color.set(rich > 0.5 ? 0xffffff : 0x586070); l.visible = l.scale.x > 0.01;
      });
      const pk = clamp01((rich - 0.15) / 0.45); pic.scale.setScalar(Math.max(0.0001, pk)); pic.position.set(-0.06, 0.05, fz + 0.001); pic.visible = pk > 0.01;
      const pl = clamp01((rich - 0.55) / 0.3); play.scale.setScalar(Math.max(0.0001, pl * (1 + 0.1 * Math.sin(t * 5)))); play.position.set(-0.06, 0.05, fz + 0.004); play.visible = pl > 0.01;
      bars.forEach((b, k) => { const h = Math.max(0.0001, [0.12, 0.2, 0.15][k] * clamp01((rich - 0.4 - k * 0.1) / 0.35)); b.scale.y = h; b.position.set(0.16 + k * 0.05, -0.085 + h / 2, fz + 0.001); b.visible = h > 0.001; });
      const sk = clamp01((rich - 0.78) / 0.2); star.scale.setScalar(Math.max(0.0001, sk)); star.position.set(0.2, 0.17, fz + 0.02); star.rotation.y += dt * 2; star.visible = sk > 0.01;
      msg.rotation.y = Math.sin(t * 0.55) * 0.3; msg.rotation.x = -0.08 + Math.sin(t * 0.8) * 0.03; msg.position.y = 0.26 + Math.sin(t * 1.2) * 0.008;
      pb.s.material.color.copy(col).lerp(new THREE.Color(0xffffff), 0.5);
      t1.userData.update(dt); t2.userData.update(dt); const lite = 0.4 + 0.5 * rich; t1.userData.core.material.opacity = lite; t2.userData.core.material.opacity = lite;
    },
  };
}
