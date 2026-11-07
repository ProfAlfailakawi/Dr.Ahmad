// p384 — a message travels phone → relay tower → phone; the slider turns it from plain text into a rich multimedia message.
import * as THREE from 'three';
import { P, ease, easeBack, clamp01, stag, mat, glossy, goldMat, shadowed, lightTube } from '../../kit.js?v=15';
import { TAU, canvasTex, rbox, lit, rig, hints, burstAt, lightPool, tagSprite, setSpr, hexSlab, lerp } from '../lib/a7.js?v=15';

export const meta = { free: true, center: [0.62, 0.27], typeLabel: 'مقارنة بمنزلق' };

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
  const g = new THREE.Group(); g.position.copy(P(meta.center[0], meta.center[1])); ctx.stage.add(g); g.scale.setScalar(0.95);
  const R = rig(), H = hints(g);
  const seen = new Set(); let done = false, rich = 0, richTo = 0.1, userSlid = false, maxRich = 0, auto = true, now = 0;
  const finish = (id) => { seen.add(id); if (seen.size >= 3 && maxRich > 0.85 && !done) { done = true; setTimeout(() => { ctx.sfx.good?.(); ctx.ui.done(); }, 900); } };

  const base = new THREE.Group(); g.add(base);
  const strip = new THREE.Mesh(rbox(0.82, 0.016, 0.34, 0.01), glossy(0x4a9cc0, { roughness: 0.35 })); strip.position.set(0, 0.008, 0.02); base.add(strip);
  const lane = new THREE.Mesh(rbox(0.74, 0.004, 0.06, 0.002), lit(0xd7f0f8)); lane.position.set(0, 0.017, -0.02); base.add(lane);
  const sh = lightPool(0x000000, 0.55, 0.2); sh.position.y = -0.002; base.add(sh);
  R.add(base, 0.1, { dur: 0.9, rise: 0.06 });
  const TY = 0.016;

  // ---- two phones and the relay tower
  const pa = phoneModel(0xdfe7f1), pb = phoneModel(0xdfe7f1);
  const A = new THREE.Group(); A.scale.setScalar(1.2); A.position.set(-0.24, TY, 0.1); A.rotation.set(-0.12, 0.35, 0); A.add(pa.o); g.add(A);
  const B = new THREE.Group(); B.scale.setScalar(1.2); B.position.set(0.24, TY, 0.1); B.rotation.set(-0.12, -0.35, 0); B.add(pb.o); g.add(B);
  [A, B].forEach((p, i) => { const st = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.055, 0.012, 32), goldMat()); st.position.y = 0.006; p.add(st); R.add(p, 1.0 + i * 0.3, { dur: 0.8, rise: 0.1 }); shadowed(p); });
  const tower = new THREE.Group(); tower.scale.setScalar(1.15); tower.position.set(0, TY, -0.1); g.add(tower);
  const tb = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.04, 0.26, 4), glossy(0xf4efe0)); tb.rotation.y = Math.PI / 4; tb.position.y = 0.13; tower.add(tb);
  [0.07, 0.13, 0.19].forEach((y, i) => { const r = new THREE.Mesh(new THREE.TorusGeometry(0.036 - i * 0.012, 0.0025, 6, 24), goldMat()); r.rotation.x = Math.PI / 2; r.position.y = y; tower.add(r); });
  const tip = new THREE.Mesh(new THREE.SphereGeometry(0.014, 16, 12), glossy(0xe8604c, { emissive: 0xe8604c, emissiveIntensity: 0.5 })); tip.position.y = 0.275; tower.add(tip);
  const waves = [0, 1, 2].map(() => { const w = new THREE.Mesh(new THREE.TorusGeometry(0.04, 0.0016, 6, 40), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false, toneMapped: false })); w.rotation.x = Math.PI / 2; w.position.y = 0.275; tower.add(w); return w; });
  R.add(tower, 0.6, { dur: 0.9, rise: 0.1 }); shadowed(tower);
  const hit = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.3, 8), new THREE.MeshBasicMaterial({ visible: false })); hit.position.y = 0.14; tower.add(hit);
  H.add(tip, 0xffd27a, 0.14, null, () => 1);

  const aTop = new THREE.Vector3(-0.24, TY + 0.2, 0.1), tTop = new THREE.Vector3(0, TY + 0.3, -0.1), bTop = new THREE.Vector3(0.24, TY + 0.2, 0.1);
  const c1 = new THREE.CatmullRomCurve3([aTop, new THREE.Vector3(-0.15, TY + 0.36, 0.0), tTop]);
  const c2 = new THREE.CatmullRomCurve3([tTop, new THREE.Vector3(0.15, TY + 0.36, 0.0), bTop]);
  const t1 = lightTube(c1, { radius: 0.0035, color: 0xffffff, speed: 0.5, glass: false }), t2 = lightTube(c2, { radius: 0.0035, color: 0xffffff, speed: 0.5, glass: false });
  [t1, t2].forEach((t) => { t.userData.core.material.opacity = 0.45; g.add(t); });

  // ---- packets: plain text bubble that grows into a multimedia message
  const photo = photoTex();
  const packets = [0, 1, 2].map((i) => {
    const p = new THREE.Group(); p.scale.setScalar(1.7); g.add(p);
    const plate = new THREE.Mesh(rbox(0.1, 0.07, 0.01, 0.012), glossy(0xdfe3ea, { roughness: 0.35 })); p.add(plate);
    const lines = [0, 1, 2].map((k) => { const l = new THREE.Mesh(new THREE.BoxGeometry(0.058 - k * 0.012, 0.006, 0.003), lit(0x586070)); l.position.set(-0.012 - k * 0.0, 0.016 - k * 0.014, 0.0065); p.add(l); return l; });
    const pic = new THREE.Mesh(new THREE.PlaneGeometry(0.05, 0.034), new THREE.MeshBasicMaterial({ map: photo, toneMapped: false })); pic.position.set(-0.02, 0.012, 0.0075); p.add(pic);
    const bars = [0, 1, 2].map((k) => { const b = new THREE.Mesh(new THREE.BoxGeometry(0.008, 1, 0.004), lit([0xe8604c, 0xf2c230, 0x4a8fd0][k])); b.position.set(0.026 + k * 0.011, -0.03, 0.0075); p.add(b); return b; });
    R.add(p, 2.2 + i * 0.2, { dur: 0.6, fn: ease });
    ctx.tap(p, () => { ctx.sfx.pop?.(); R.bounce(p); burstAt(ctx, p, 0xffffff, 12, 0.25, 0.02); H.seen(plate);
      if (rich < 0.5) ctx.ui.card({ tag: 'SMS', title: 'نص مجرّد', body: 'رسائل نصية قصيرة بين المشتركين في شبكة الهاتف النقال.', color: 0x586070 });
      else ctx.ui.card({ tag: 'MMS', title: 'نص وصورة ورسم', body: 'تدمج النص المرسَل بالرسوم والجرافيك والصور، فتتجاوز النص المجرد إلى مضمون أغنى بصرياً.', color: 0x2f9fc4 }); });
    H.add(plate, 0xffffff, 0.14, null, () => 1);
    return { p, plate, lines, pic, bars, i };
  });

  const card = (obj, tag, title, body, color, id) => { ctx.sfx.pop?.(); burstAt(ctx, obj, color, 18, 0.3, 0.024); ctx.ui.card({ tag, title, body, color }); finish(id); };
  ctx.tap(A, () => { R.bounce(A); card(A, 'SMS', 'رسالة نصية قصيرة', 'تقدم فرصاً جيدة للتواصل بين المحاضرين والطلاب، وبها يمكن نقل البيانات ودخول صفحات الواب WAP.', 0x586070, 'a'); });
  ctx.tap(B, () => { R.bounce(B); card(B, 'MMS', 'الوسائط المتعددة', 'خدمة إرسال الوسائط المتعددة، وهي تدمج النص بالرسوم والجرافيك والصور.', 0x2f9fc4, 'b'); });
  ctx.tap(hit, () => { R.bounce(tower); wv = 1; card(tower, 'مركز الإرسال', 'يعالجها ويديرها', 'تعبر الرسائل القصيرة مركز الإرسال الرئيس الذي يعالجها ويديرها.', 0xe8604c, 't'); });
  let wv = 0;

  ctx.ui.hud('حرّك المنزلق: من النص إلى الوسائط');
  ctx.ui.slider({ label: 'نص ← وسائط', value: 0.1, onInput: (v) => { auto = false; richTo = v; userSlid = true; } });

  const tmp = new THREE.Vector3();
  return {
    update(t, dt, e) {
      now = t; R.update(t, dt, e); H.update(t, e, stag(t, 4.0, 0.6));
      if (auto && t > 3) richTo = 0.5 + 0.5 * Math.sin((t - 3) * 0.7 - 1.2);
      rich = THREE.MathUtils.damp(rich, richTo, 5, dt); maxRich = Math.max(maxRich, rich);
      const col = new THREE.Color(0xdfe3ea).lerp(new THREE.Color(0x35b0d4), clamp01(rich * 1.1));
      packets.forEach((k) => {
        const u = ((t * 0.12 + k.i / 3) % 1);
        if (u < 0.45) c1.getPoint(u / 0.45, tmp); else if (u < 0.55) tmp.copy(tTop); else c2.getPoint((u - 0.55) / 0.45, tmp);
        k.p.position.copy(tmp); k.p.position.y += 0.04;
        const sc = (u > 0.45 && u < 0.55) ? 1 + 0.25 * Math.sin((u - 0.45) / 0.1 * Math.PI) : 1;
        k.p.rotation.y = Math.sin(t * 0.8 + k.i) * 0.3;
        k.plate.material.color.copy(col); const sz = 1 + rich * 0.6; k.plate.scale.z = sz; const fz = 0.005 * sz + 0.0025; k.pic.position.z = fz + 0.0005; k.bars.forEach((b) => { b.position.z = fz + 0.0005; });
        k.pic.scale.setScalar(Math.max(0.0001, clamp01((rich - 0.2) / 0.5))); k.pic.visible = rich > 0.22;
        k.bars.forEach((b, j) => { const h = Math.max(0.0001, 0.05 * clamp01((rich - 0.45 - j * 0.1) / 0.4)); b.scale.y = h; b.position.y = -0.028 + h / 2 - 0.0; b.visible = h > 0.001; });
        k.lines.forEach((l, j) => { l.position.set(lerp(-0.012, -0.02, rich), lerp(0.016 - j * 0.014, -0.022 - j * 0.0075, rich), fz); l.scale.x = lerp(1, 0.55, rich); l.material.color.set(rich > 0.5 ? 0xffffff : 0x586070); });
        k.p.scale.multiplyScalar(sc * (R.k(k.p) > 0.01 ? 1 : 1));
      });
      pb.s.material.color.copy(col).lerp(new THREE.Color(0xffffff), 0.5);
      const w = Math.max(wv, 0.25 + 0.2 * rich); wv = Math.max(0, wv - dt * 0.5);
      waves.forEach((m, i) => { const k = (t * 0.5 + i / 3) % 1; m.scale.setScalar(0.6 + k * 2.4); m.material.opacity = (1 - k) * 0.7 * w * e; });
      t1.userData.update(dt); t2.userData.update(dt);
      const lite = 0.35 + 0.5 * rich; t1.userData.core.material.opacity = lite; t2.userData.core.material.opacity = lite;
      tip.material.emissiveIntensity = 0.4 + 0.3 * Math.sin(t * 4);
    },
  };
}
