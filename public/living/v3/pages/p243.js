// p243 (round 2): a big glowing screen with seven devices orbiting it on light beams: what every definition of e-learning agrees on.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { P, ease, easeBack, clamp01, stag, mat, glossy, goldMat, shadowed, glow } from '../../kit.js?v=26';
import { halos, liveTag, motes, canvasTex, beam, blob, TAU, css } from '../lib/a4-kit.js?v=26';

export const meta = { free: true, center: [0.5, 0.62], typeLabel: 'خريطة ضوئية', title: 'خريطة مفهوم التعليم الإلكتروني' };

const NODES = [
  { id: 'devices', tag: 'أجهزة متعددة الوسائط', c: 0x2a8fd0, note: 'يقوم على الأجهزة الإلكترونية والوسائل التي تعرض المحتوى بأشكال متعددة.' },
  { id: 'content', tag: 'محتوى وأنشطة', c: 0xef8f2a, note: 'المحتوى الدراسي والأنشطة المصاحبة تُعدّ وتُصمَّم وتُنتَج في صورة برنامج إلكتروني.' },
  { id: 'standards', tag: 'معايير مقننة', c: 0xd4ad55, note: 'تُنتَج البرمجية في ضوء معايير مقننة وأغراض تعليمية محددة.' },
  { id: 'sync', tag: 'شبكات متزامنة', c: 0x35b5a8, note: 'يجري التفاعل في الوقت نفسه بين المعلم والمتعلم أو بين المتعلمين.' },
  { id: 'async', tag: 'شبكات غير متزامنة', c: 0x8a63c8, note: 'يجري التفاعل في أوقات مختلفة بحسب ظروف المتعلم.' },
  { id: 'interaction', tag: 'تفاعل إيجابي', c: 0xe0453c, note: 'تركّز الأغراض بالدرجة الأولى على التفاعل الإيجابي مع المتعلم.' },
  { id: 'distance', tag: 'تعليم عن بعد', c: 0x3f9ad8, note: 'يرتبط بالتعليم عن بعد باستخدام الأجهزة الإلكترونية والشبكات.' },
];

function model(id, c) {
  const g = new THREE.Group();
  if (id === 'devices') {
    const t = new THREE.Mesh(new RoundedBoxGeometry(0.06, 0.08, 0.006, 3, 0.004), glossy(0x26303c)); t.rotation.y = 0.3; g.add(t);
    const s = new THREE.Mesh(new THREE.PlaneGeometry(0.052, 0.07), new THREE.MeshBasicMaterial({ color: 0x9fd8ff, toneMapped: false })); s.position.z = 0.0035; t.add(s);
    const p = new THREE.Mesh(new RoundedBoxGeometry(0.03, 0.055, 0.005, 3, 0.003), glossy(0xf4f4f6)); p.position.set(0.05, -0.012, 0.01); p.rotation.y = -0.3; g.add(p);
    const ps = new THREE.Mesh(new THREE.PlaneGeometry(0.025, 0.045), new THREE.MeshBasicMaterial({ color: 0xffb36b, toneMapped: false })); ps.position.z = 0.003; p.add(ps);
  } else if (id === 'content') {
    [[0xef8f2a, 0], [0x2f6fb8, 0.3], [0xd8372f, -0.2]].forEach(([col, r], i) => { const b = new THREE.Mesh(new RoundedBoxGeometry(0.08 - i * 0.008, 0.018, 0.056, 3, 0.005), glossy(col, { clearcoat: 0.6 })); b.position.y = -0.02 + i * 0.019; b.rotation.y = r; g.add(b); });
    const pg = new THREE.Mesh(new THREE.TorusGeometry(0.012, 0.0025, 6, 14, Math.PI * 1.5), goldMat()); pg.position.y = 0.05; g.add(pg);
  } else if (id === 'standards') {
    const d = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.008, 32), goldMat()); d.rotation.x = Math.PI / 2; g.add(d);
    const r2 = new THREE.Mesh(new THREE.TorusGeometry(0.022, 0.003, 8, 28), mat(0xfff0c0, { metalness: 0.6, roughness: 0.3 })); r2.position.z = 0.005; g.add(r2);
    const star = new THREE.Mesh(new THREE.OctahedronGeometry(0.012), mat(0xfff7dc, { emissive: 0xffd27a, emissiveIntensity: 0.5 })); star.position.z = 0.008; star.scale.z = 0.4; g.add(star);
    [-1, 1].forEach((sgn) => { const rb = new THREE.Mesh(new THREE.BoxGeometry(0.014, 0.04, 0.003), mat(0xc0392b)); rb.position.set(sgn * 0.011, -0.04, -0.004); rb.rotation.z = sgn * 0.2; g.add(rb); });
  } else if (id === 'sync') {
    [-1, 1].forEach((s) => { const t = new THREE.Mesh(new THREE.TorusGeometry(0.026, 0.006, 12, 36), glossy(c, { emissive: c, emissiveIntensity: 0.25 })); t.position.x = s * 0.02; t.rotation.y = s * 0.3; g.add(t); });
  } else if (id === 'async') {
    const m = glossy(0xe8f4f6, { transparent: true, opacity: 0.35, depthWrite: false });
    const top = new THREE.Mesh(new THREE.ConeGeometry(0.026, 0.036, 20, 1, true), m); top.position.y = 0.02; top.rotation.x = Math.PI; g.add(top);
    const bot = new THREE.Mesh(new THREE.ConeGeometry(0.026, 0.036, 20, 1, true), m); bot.position.y = -0.02; g.add(bot);
    const sand = new THREE.Mesh(new THREE.ConeGeometry(0.019, 0.026, 16), mat(0xe8b04a, { emissive: 0xb07a20, emissiveIntensity: 0.3 })); sand.position.y = -0.028; g.add(sand);
    [0.04, -0.04].forEach((y) => { const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.004, 20), goldMat()); cap.position.y = y; g.add(cap); });
    g.userData.sand = sand;
  } else if (id === 'interaction') {
    const bub = new THREE.Mesh(new RoundedBoxGeometry(0.07, 0.048, 0.012, 4, 0.016), glossy(c, { emissive: c, emissiveIntensity: 0.2 })); g.add(bub);
    const tail = new THREE.Mesh(new THREE.ConeGeometry(0.01, 0.02, 3), glossy(c)); tail.rotation.z = Math.PI; tail.position.set(0.016, -0.034, 0); g.add(tail);
    [-0.018, 0, 0.018].forEach((x) => { const d = new THREE.Mesh(new THREE.SphereGeometry(0.005, 10, 8), new THREE.MeshBasicMaterial({ color: 0xffffff })); d.position.set(x, 0, 0.0075); g.add(d); });
  } else {
    const gl = new THREE.Mesh(new THREE.SphereGeometry(0.032, 30, 20), new THREE.MeshStandardMaterial({ roughness: 0.45, map: canvasTex(256, 128, (k, w, h) => { k.fillStyle = '#3f9ad8'; k.fillRect(0, 0, w, h); k.fillStyle = '#7cc46a'; [[40, 50, 28, 18], [100, 70, 20, 30], [170, 45, 34, 18], [220, 80, 22, 14]].forEach(([x, y, a, b]) => { k.beginPath(); k.ellipse(x, y, a, b, 0.4, 0, TAU); k.fill(); }); }) })); gl.rotation.z = 0.4; g.add(gl); g.userData.globe = gl;
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.042, 0.002, 8, 44), goldMat()); ring.rotation.x = Math.PI / 2.6; g.add(ring);
    const sat = new THREE.Mesh(new THREE.OctahedronGeometry(0.006), goldMat()); g.add(sat); g.userData.sat = sat;
  }
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return g;
}

export default function build(ctx) {
  const g = new THREE.Group(); g.position.copy(P(meta.center[0], meta.center[1])); ctx.stage.add(g);
  const hal = halos();
  const mo = motes(g, 22, { r: 0.42, h: 0.5, color: 0xffffff, cy: 0.03 });

  // ---- the central screen on a slim gold stand (no stage)
  const mon = new THREE.Group(); mon.position.set(0, 0, 0); g.add(mon);
  const ms = blob(0.2, 0.34); g.add(ms);
  const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, 0.014, 6), glossy(0xf6f1e4)); foot.position.y = 0.007; mon.add(foot);
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.016, 0.1, 14), goldMat()); neck.position.y = 0.06; mon.add(neck);
  const frame = new THREE.Mesh(new RoundedBoxGeometry(0.32, 0.22, 0.02, 4, 0.01), glossy(0x1d2a38)); frame.position.y = 0.2; mon.add(frame);
  const rimG = new THREE.Mesh(new RoundedBoxGeometry(0.33, 0.23, 0.01, 3, 0.01), goldMat()); rimG.position.set(0, 0.2, -0.007); mon.add(rimG);
  let lit = 0;
  const stex = canvasTex(512, 360, () => {});
  const drawScreen = () => {
    const c = stex.userData.canvas.getContext('2d'), w = 512, h = 360;
    const grd = c.createLinearGradient(0, 0, w, h); grd.addColorStop(0, '#0f3a5a'); grd.addColorStop(1, '#1f8aa6'); c.fillStyle = grd; c.fillRect(0, 0, w, h);
    c.fillStyle = '#ffffff'; c.font = '800 62px "Reem Kufi", Tajawal, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('التعليم الإلكتروني', w / 2, h * 0.36);
    c.font = '700 34px Tajawal, sans-serif'; c.fillStyle = '#ffd27a'; c.fillText('E-LEARNING', w / 2, h * 0.56);
    for (let i = 0; i < 7; i++) { c.beginPath(); c.arc(w / 2 + (i - 3) * 50, h * 0.8, 15, 0, TAU); c.fillStyle = i < lit ? css(NODES[i].c) : 'rgba(255,255,255,.22)'; c.fill(); }
    stex.needsUpdate = true;
  };
  drawScreen();
  const scr = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.2), new THREE.MeshBasicMaterial({ map: stex, toneMapped: false })); scr.position.set(0, 0.2, 0.0105); mon.add(scr);
  const sg = glow(0x7fd0ff, 0.7, 0); sg.position.set(0, 0.2, 0.05); mon.add(sg);
  shadowed(mon); mon.scale.setScalar(0.0001);

  // ---- orbit rings on the page and seven devices
  const R = 0.34, RZ = 0.26;
  const ring = new THREE.Mesh(new THREE.TorusGeometry(1, 0.003, 6, 96), new THREE.MeshBasicMaterial({ color: 0xd4ad55, toneMapped: false, transparent: true, opacity: 0.8 })); ring.rotation.x = Math.PI / 2; ring.scale.set(R, RZ, 1); ring.position.y = 0.004; g.add(ring);
  const nodes = NODES.map((nd, i) => {
    const grp = new THREE.Group(); g.add(grp);
    const obj = model(nd.id, nd.c); obj.scale.setScalar(1.9); grp.add(obj);
    const mark = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.004, 8, 40), new THREE.MeshBasicMaterial({ color: nd.c, toneMapped: false, transparent: true, opacity: 0.9 })); mark.rotation.x = Math.PI / 2; grp.add(mark);
    const sh = blob(0.1, 0.3); grp.add(sh);
    const hl = hal.add(grp, nd.c, 0.34, [0, 0.14, 0], 2.2 + i * 0.1);
    const cg = new THREE.CylinderGeometry(0.0045, 0.0045, 1, 6); cg.translate(0, 0.5, 0);
    const tube = new THREE.Mesh(cg, new THREE.MeshBasicMaterial({ color: nd.c, transparent: true, opacity: 0.75, toneMapped: false, depthWrite: false })); tube.renderOrder = 3; g.add(tube);
    const pk = glow(nd.c, 0.05, 0.95); pk.renderOrder = 8; g.add(pk); tube.userData.pk = pk; tube.userData.ph = Math.random();
    const o = { nd, grp, obj, tube, hl, mark, sh, a: -Math.PI / 2 + (i / 7) * TAU + 0.2, found: false, pulse: 0, lift: 0, x: 0, z: 0 };
    ctx.tap(grp, () => pick(o)); return o;
  });
  const tag = liveTag(0.25, 0xd4ad55, { size: 60 }); tag.set(NODES[0].tag); g.add(tag.sp); tag.apply(0);
  let tagK = 0, tagT = 0, now = 0, finished = false, foundN = 0; const tagPos = new THREE.Vector3();
  ctx.ui.hud('المس كل أداة حول الشاشة');

  function pick(o) {
    if (now < 2.4) return;
    o.pulse = 1; ctx.sfx.pop?.(); ctx.fx.burst(g.position.clone().add(new THREE.Vector3(o.x, 0.16, o.z)), o.nd.c, 16, 0.25, 0.035);
    if (!o.found) { o.found = true; foundN++; lit = foundN; drawScreen(); }
    tag.set(o.nd.tag, o.nd.c); tagK = 0; tagT = 1;
    ctx.ui.card({ tag: `ما تتفق عليه التعريفات · ${['', '١', '٢', '٣', '٤', '٥', '٦', '٧'][foundN]} من ٧`, title: o.nd.tag, body: o.nd.note, color: o.nd.c });
    ctx.ui.hud(foundN < 7 ? `اكتشفت ${['', '١', '٢', '٣', '٤', '٥', '٦'][foundN]} من ٧` : 'اتفاق واحد من تعريفات شتى');
    if (foundN === 7 && !finished) { finished = true; setTimeout(() => { ctx.fx.burst(g.position.clone().add(new THREE.Vector3(0, 0.25, 0)), 0xffd27a, 50, 0.55, 0.05); ctx.sfx.good?.(); ctx.ui.done(); }, 900); }
  }
  ctx.tap(mon, () => ctx.ui.card({ tag: 'المفهوم المركزي', title: 'التعليم الإلكتروني', body: 'تتفق التعريفات في المبادئ وإن اختلفت في الصياغة: يشمل أساسيات نماذج مستحدثات تكنولوجيا التعليم.', color: 0x2a8fd0 }));

  const a3 = new THREE.Vector3(), b3 = new THREE.Vector3(), d3 = new THREE.Vector3(), UP = new THREE.Vector3(0, 1, 0);
  return {
    update(t, dt, e) {
      now = t; hal.update(t, e); mo.update(t, dt, e);
      const mk = stag(t, 0.2, 0.8, easeBack) * e; mon.scale.setScalar(Math.max(0.0001, mk)); ms.material.opacity = 0.34 * e;
      sg.material.opacity = (0.28 + 0.06 * Math.sin(t * 2) + foundN * 0.05) * stag(t, 0.6, 0.8) * e;
      ring.material.opacity = 0.8 * stag(t, 0.4, 0.8) * e; ring.scale.set(R * stag(t, 0.4, 0.9), RZ * stag(t, 0.4, 0.9), 1);
      nodes.forEach((o, i) => {
        o.a += dt * 0.09;
        o.x = Math.cos(o.a) * R; o.z = Math.sin(o.a) * RZ;
        const k = stag(t, 0.7 + i * 0.18, 0.8, easeBack) * e;
        o.grp.position.set(o.x, 0, o.z); o.grp.scale.setScalar(Math.max(0.0001, k));
        o.pulse = Math.max(0, o.pulse - dt * 1.2); o.lift = THREE.MathUtils.damp(o.lift, o.pulse > 0 ? 1 : 0, 6, dt);
        o.obj.position.y = 0.13 + Math.sin(t * 1.5 + i * 0.9) * 0.01 + o.lift * 0.05; o.obj.rotation.y += dt * (0.5 + o.lift * 3);
        o.mark.rotation.z += dt * 0.6; o.mark.material.opacity = o.found ? 1 : 0.55 + 0.3 * Math.sin(t * 2.5 + i);
        // beam from the screen foot to this device
        a3.set(o.x * 0.2, 0.05, o.z * 0.2 + 0.03); b3.set(o.x * 0.88, 0.1, o.z * 0.88);
        d3.subVectors(b3, a3); const len = d3.length(); d3.multiplyScalar(1 / len);
        o.tube.position.copy(a3); o.tube.quaternion.setFromUnitVectors(UP, d3); o.tube.scale.set(1, Math.max(0.0001, len * stag(t, 1.0 + i * 0.18, 0.8) * e), 1);
        const pk = o.tube.userData.pk, ph = (t * (0.35 + o.pulse * 1.5) + o.tube.userData.ph) % 1;
        pk.position.copy(a3).addScaledVector(d3, len * ph); pk.material.opacity = Math.sin(Math.PI * ph) * stag(t, 1.2 + i * 0.18, 0.5) * e;
        o.tube.material.opacity = 0.45 + o.pulse * 0.5;
        o.hl.on = o.found ? 0.5 : 1;
        const u = o.obj.userData; if (u.globe) u.globe.rotation.y += dt; if (u.sat) { const aa = t * 1.6; u.sat.position.set(Math.cos(aa) * 0.042, Math.sin(aa) * 0.012, Math.sin(aa) * 0.042); } if (u.sand) u.sand.scale.y = 0.6 + 0.4 * Math.abs(Math.sin(t * 0.5));
      });
      tagK = THREE.MathUtils.damp(tagK, tagT, 6, dt);
      const tn = nodes.find((n) => n.nd.tag === tag.text); if (tn) tagPos.set(tn.x, 0.31, tn.z);
      tag.sp.position.copy(tagPos); tag.apply(easeBack(tagK) * e);
    },
  };
}
