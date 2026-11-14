// p253: the journey of distance learning, as a bright packet that travels a spiral around an armillary globe, waking five beacons in time order.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { P, ease, easeBack, clamp01, stag, mat, glossy, goldMat, shadowed, glow } from '../../kit.js?v=38';
import { rising, halos, liveTag, motes, canvasTex, beam, blob, TAU, css } from '../lib/a4-kit.js?v=38';

export const meta = { free: true, center: [0.5, 0.66], typeLabel: 'خط زمني', title: 'رحلة التعلم عن بعد' };

const STEPS = [
  { s: 0.06, c: 0xef8f2a, tag: 'سبعينيات القرن الماضي', title: 'البدايات', body: 'بدأت الجامعات الغربية في أمريكا وأوروبا إرسال المواد التعليمية والخطة الدراسية والكتب والفيديوهات عبر البريد الإلكتروني.' },
  { s: 0.28, c: 0xd4ad55, tag: 'الامتحان حضورياً', title: 'الامتحان الرئيس حضورياً', body: 'ظل الامتحان النهائي الرئيس يشترط حضور الطالب إلى الجامعة لتقديمه.' },
  { s: 0.5, c: 0x35b5a8, tag: 'مواقع التواصل', title: 'مواقع التواصل الاجتماعي', body: 'ظهرت مواقع اجتماعية أسرع وأكثر حداثة من البريد الإلكتروني فاستُخدمت في التعلم عن بعد.' },
  { s: 0.73, c: 0xe0453c, tag: 'محاضرة مباشرة', title: 'المحاضرة المباشرة', body: 'أصبح بإمكان الطالب أن يشاهد محاضرته مباشرة ويطرح الأسئلة التي يريدها في الوقت نفسه.' },
  { s: 0.95, c: 0x3a86d6, tag: 'وسائل متعددة', title: 'وسائل تقنية متعددة', body: 'تُستخدم وسائل تكنولوجية متعددة وأكثر شيوعاً؛ والتعلم عن بعد لا يقتصر على الإنترنت.' },
];
const RG = 0.23;
const surf = (s, r, out) => {
  const lat = THREE.MathUtils.lerp(-0.55, 0.85, s), lon = THREE.MathUtils.lerp(-2.2, 2.4, s);
  return out.set(Math.cos(lat) * Math.sin(lon), Math.sin(lat), Math.cos(lat) * Math.cos(lon)).multiplyScalar(r);
};

function beaconModel(i) {
  const g = new THREE.Group(), st = STEPS[i];
  if (i === 0) {
    const e = new THREE.Mesh(new RoundedBoxGeometry(0.07, 0.044, 0.008, 2, 0.002), mat(0xf4efe3)); e.position.y = 0.04; g.add(e);
    const fl = new THREE.Mesh(new THREE.ConeGeometry(0.0375, 0.026, 3), mat(st.c)); fl.rotation.set(Math.PI / 2, 0, Math.PI); fl.scale.set(1, 0.14, 1); fl.rotation.x = Math.PI / 2; fl.position.set(0, 0.052, 0.0055); fl.rotation.z = Math.PI; fl.scale.set(1, 1, 0.14); g.add(fl);
  } else if (i === 1) {
    const b = new THREE.Mesh(new RoundedBoxGeometry(0.07, 0.03, 0.04, 2, 0.003), mat(0xf4efe3)); b.position.y = 0.015; g.add(b);
    [-0.024, -0.008, 0.008, 0.024].forEach((x) => { const c = new THREE.Mesh(new THREE.CylinderGeometry(0.0035, 0.0035, 0.026, 8), mat(0xfff7e6)); c.position.set(x, 0.043, 0.014); g.add(c); });
    const roof = new THREE.Mesh(new THREE.ConeGeometry(0.044, 0.02, 4), mat(st.c, { metalness: 0.4 })); roof.rotation.y = Math.PI / 4; roof.scale.z = 0.62; roof.position.y = 0.066; g.add(roof);
  } else if (i === 2) {
    const m = glossy(st.c, { emissive: st.c, emissiveIntensity: 0.25 });
    const a = new THREE.Mesh(new RoundedBoxGeometry(0.05, 0.034, 0.01, 3, 0.012), m); a.position.set(-0.012, 0.05, 0); g.add(a);
    const b = new THREE.Mesh(new RoundedBoxGeometry(0.046, 0.03, 0.01, 3, 0.011), glossy(0xf4efe3)); b.position.set(0.016, 0.034, 0.012); g.add(b);
    [-0.014, -0.004, 0.006].forEach((x) => { const d = new THREE.Mesh(new THREE.SphereGeometry(0.0034, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffffff })); d.position.set(x, 0.05, 0.0055); g.add(d); });
  } else if (i === 3) {
    const s = new THREE.Mesh(new RoundedBoxGeometry(0.072, 0.048, 0.008, 3, 0.004), mat(0x26303c)); s.position.y = 0.04; g.add(s);
    const sc = new THREE.Mesh(new THREE.PlaneGeometry(0.064, 0.04), new THREE.MeshBasicMaterial({ color: 0xcfe9f5, toneMapped: false })); sc.position.set(0, 0.04, 0.0045); g.add(sc);
    const p = new THREE.Mesh(new THREE.CircleGeometry(0.012, 20), new THREE.MeshBasicMaterial({ color: 0x3a86d6, toneMapped: false })); p.position.set(0, 0.043, 0.005); g.add(p);
    const dot = new THREE.Mesh(new THREE.SphereGeometry(0.0055, 12, 8), new THREE.MeshBasicMaterial({ color: 0xff3b30, toneMapped: false })); dot.position.set(-0.026, 0.056, 0.006); g.add(dot); g.userData.live = dot;
  } else {
    const t = new THREE.Mesh(new RoundedBoxGeometry(0.05, 0.036, 0.005, 2, 0.003), mat(0x26303c)); t.position.set(-0.014, 0.034, 0); g.add(t);
    const ts = new THREE.Mesh(new THREE.PlaneGeometry(0.044, 0.03), new THREE.MeshBasicMaterial({ color: 0xa9d8ff, toneMapped: false })); ts.position.set(-0.014, 0.034, 0.003); g.add(ts);
    const ph = new THREE.Mesh(new RoundedBoxGeometry(0.02, 0.036, 0.005, 2, 0.003), mat(0xf4f4f6)); ph.position.set(0.026, 0.03, 0.012); g.add(ph);
    const ps = new THREE.Mesh(new THREE.PlaneGeometry(0.016, 0.03), new THREE.MeshBasicMaterial({ color: 0xffb36b, toneMapped: false })); ps.position.set(0.026, 0.03, 0.0153); g.add(ps);
  }
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return g;
}

export default function build(ctx) {
  const g = new THREE.Group(); g.position.copy(P(meta.center[0], meta.center[1])); ctx.stage.add(g);
  const rise = rising(), hal = halos();
  const sh = blob(0.32, 0.34); g.add(sh);
  const mo = motes(g, 22, { r: 0.42, h: 0.6, color: 0xcfe6ff });

  // ---- stand
  const stand = new THREE.Group(); g.add(stand);
  const col = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.03, 0.14, 18), goldMat()); col.position.y = 0.07; stand.add(col);
  const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.13, 0.026, 36), glossy(0x5b4636, { clearcoat: 0.4 })); foot.position.y = 0.013; stand.add(foot);
  const footR = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.006, 8, 40), goldMat()); footR.rotation.x = Math.PI / 2; footR.position.y = 0.026; stand.add(footR);
  shadowed(stand); rise.add(stand, 0.2, 0.15);

  const GY = 0.14 + RG - 0.02;
  const cradle = new THREE.Group(); cradle.position.y = GY; g.add(cradle);
  const tilt = new THREE.Group(); tilt.rotation.z = 0.4; cradle.add(tilt);
  const spin = new THREE.Group(); tilt.add(spin);
  const earth = new THREE.Mesh(new THREE.SphereGeometry(RG, 48, 32), new THREE.MeshStandardMaterial({ roughness: 0.4, metalness: 0.05, map: canvasTex(512, 256, (c, w, h) => {
    const grd = c.createLinearGradient(0, 0, 0, h); grd.addColorStop(0, '#3b8bd6'); grd.addColorStop(1, '#2a6db8'); c.fillStyle = grd; c.fillRect(0, 0, w, h);
    c.fillStyle = 'rgba(255,255,255,.18)'; for (let x = 0; x < w; x += 32) c.fillRect(x, 0, 1.5, h); for (let y = 0; y < h; y += 32) c.fillRect(0, y, w, 1.5);
    c.fillStyle = '#8fd0f4';
    [[110, 90, 60, 36, 0.3], [150, 90, 30, 20, -0.4], [180, 170, 24, 46, 0.3], [270, 80, 30, 18, 0.1], [295, 150, 34, 50, 0.1], [370, 90, 70, 34, 0.1], [410, 70, 40, 24, 0.2], [440, 175, 28, 18, 0], [60, 200, 50, 12, 0]].forEach(([x, y, a, b, r]) => { c.beginPath(); c.ellipse(x, y, a, b, r, 0, TAU); c.fill(); });
  }) })); spin.add(earth);
  // gold armillary rings (fixed to the cradle, not spinning)
  const rings = new THREE.Group(); cradle.add(rings);
  [[0, 0, 0], [Math.PI / 2, 0, 0], [0, 0, Math.PI / 2]].forEach(([rx, ry, rz], i) => { const r = new THREE.Mesh(new THREE.TorusGeometry(RG + 0.02, 0.0028, 8, 72), goldMat()); r.rotation.set(rx, ry, rz); rings.add(r); });
  const eq = new THREE.Mesh(new THREE.TorusGeometry(RG + 0.003, 0.002, 6, 72), new THREE.MeshBasicMaterial({ color: 0xfff0c0, transparent: true, opacity: 0.55 })); eq.rotation.x = Math.PI / 2; spin.add(eq);
  shadowed(cradle); rise.add(cradle, 0.5, 0.25);

  // ---- spiral path of time
  const tmp = new THREE.Vector3();
  const pts = Array.from({ length: 40 }, (_, i) => surf(i / 39, RG + 0.006, new THREE.Vector3()));
  const curve = new THREE.CatmullRomCurve3(pts);
  const path = beam(curve, { radius: 0.0055, color: 0xffd27a, segs: 140, speed: 0.3 }); spin.add(path);
  const pkt = glow(0xfff3c4, 0.13, 0); pkt.renderOrder = 8; spin.add(pkt);
  const pktCore = glow(0xffffff, 0.05, 0); pktCore.renderOrder = 9; spin.add(pktCore);

  // ---- beacons
  const beacons = STEPS.map((st, i) => {
    const up = surf(st.s, 1, new THREE.Vector3()).normalize();
    const grp = new THREE.Group(); grp.position.copy(up).multiplyScalar(RG - 0.002); grp.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), up); grp.userData.s = 1; spin.add(grp);
    const pin = new THREE.Mesh(new THREE.CylinderGeometry(0.0022, 0.0022, 0.03, 6), goldMat()); pin.position.y = 0.015; grp.add(pin);
    const mdl = beaconModel(i); mdl.position.y = 0.006; grp.add(mdl);
    const hl = hal.add(grp, st.c, 0.16, [0, 0.05, 0], 9999);
    const o = { st, grp, mdl, hl, up, lit: 0, found: false, ph: i * 1.3 };
    ctx.tap(grp, () => pick(o, i));
    return o;
  });
  const tag = liveTag(0.25, 0xd4ad55, { size: 58 }); tag.set(STEPS[0].tag); g.add(tag.sp); tag.apply(0);
  let tagK = 0, tagT = 0, now = 0, p = 0, pTarget = 0, journey = true, foundN = 0, focus = -1, autoSpin = 0, finished = false;
  const wp = new THREE.Vector3(), tagPos = new THREE.Vector3(), cur = new THREE.Vector3();
  ctx.ui.hud('رحلة عبر الزمن حول الأرض');

  function pick(o, i) {
    if (journey && now < 5.6) return;
    focus = i; pTarget = o.st.s; ctx.sfx.pop?.(); ctx.fx.burst(g.position.clone().add(new THREE.Vector3(0, GY + 0.12, 0.1)), o.st.c, 14, 0.25, 0.028);
    if (!o.found) { o.found = true; foundN++; }
    tag.set(o.st.tag, o.st.c); tagK = 0; tagT = 1;
    ctx.ui.card({ tag: `المحطة ${['', '١', '٢', '٣', '٤', '٥'][i + 1]} من ٥`, title: o.st.title, body: o.st.body, color: o.st.c });
    ctx.ui.hud(foundN < 5 ? `اكتشفت ${['', '١', '٢', '٣', '٤'][foundN]} من ٥ محطات` : 'من البريد إلى كل الوسائل');
    if (foundN === 5 && !finished) { finished = true; setTimeout(() => { ctx.fx.burst(g.position.clone().add(new THREE.Vector3(0, GY + 0.1, 0)), 0xffd27a, 50, 0.55, 0.04); ctx.sfx.good?.(); ctx.ui.done(); }, 900); }
  }
  ctx.tap(earth, () => ctx.ui.card({ tag: 'التعلم عن بعد', title: 'ليس بالإنترنت وحدها', body: 'التعلم عن بعد عملية تعليمية لا تقتصر على التعلم من خلال شبكة الإنترنت.', color: 0x3a86d6 }));

  return {
    update(t, dt, e) {
      now = t; rise.update(t, e); hal.update(t, e); mo.update(t, dt, e);
      path.userData.update(dt);
      if (journey) { const jp = clamp01((t - 0.7) / 4.6); p = jp; pTarget = jp; if (t > 5.4) { journey = false; p = 1; pTarget = 1; ctx.ui.hud('المس محطة لتقف عندها'); } }
      else p = THREE.MathUtils.damp(p, pTarget, 2.2, dt);
      path.userData.grow(Math.max(p, 0.001) * stag(t, 0.5, 0.5)); path.visible = p > 0.01;
      cur.copy(curve.getPointAt(clamp01(p)));
      pkt.position.copy(cur); pktCore.position.copy(cur);
      const pk = stag(t, 0.6, 0.5) * e; pkt.material.opacity = pk * (0.8 + 0.2 * Math.sin(t * 8)); pktCore.material.opacity = pk;
      if (focus >= 0) { // turn the globe so the chosen beacon faces the viewer
        const b = beacons[focus]; const target = -Math.atan2(b.up.x, b.up.z) - 0.0; let d = ((target - spin.rotation.y) % TAU + 3 * Math.PI) % TAU - Math.PI;
        spin.rotation.y += d * Math.min(1, dt * 2.6);
      } else spin.rotation.y += dt * 0.18 * stag(t, 0.4, 1);
      beacons.forEach((b, i) => {
        const reached = p + 0.002 >= b.st.s; b.lit = THREE.MathUtils.damp(b.lit, reached ? 1 : 0, 5, dt);
        const k = stag(t, 0.5 + i * 0.3, 0.7, easeBack) * e;
        b.grp.scale.setScalar(Math.max(0.0001, k * 1.9 * (1 + (focus === i ? 0.25 : 0) + 0.04 * Math.sin(t * 2 + b.ph))));
        b.mdl.traverse((o) => { if (o.isMesh && o.material.emissive) o.material.emissiveIntensity = 0.15 + b.lit * 0.5; });
        b.hl.on = b.lit * (focus === i ? 1 : 0.7);
        if (b.mdl.userData.live) b.mdl.userData.live.visible = Math.sin(t * 5) > -0.3;
      });
      tagK = THREE.MathUtils.damp(tagK, tagT, 6, dt);
      if (focus >= 0) { beacons[focus].grp.getWorldPosition(wp); g.worldToLocal(wp); tagPos.copy(wp); tagPos.y += 0.16; }
      else if (journey && p > 0) { // during the journey the tag follows the packet and names each era
        let k = 0; beacons.forEach((b, i) => { if (p >= b.st.s - 0.02) k = i; });
        if (tag.text !== STEPS[k].tag) tag.set(STEPS[k].tag, STEPS[k].c); tagT = 1; beacons[k].grp.getWorldPosition(wp); g.worldToLocal(wp); tagPos.copy(wp); tagPos.y += 0.16;
      }
      if (!journey && focus < 0) tagT = 0;
      tag.sp.position.copy(tagPos); tag.apply(easeBack(tagK) * e);
    },
  };
}
