// p122 — two phones joined by a wire of light, and four ways of reaching beyond the ordinary (ascent, revelation, the cave, the message).
import * as THREE from 'three';
import { P, ease, easeBack, clamp01, stag, glow, lightTube } from '../../kit.js?v=27';
import { rb, lathe, std, lit, gloss, glass, brass, add, grp, hit, Seq, Pulse, touch, chip, slab, organic, at, rnd, TAU, INK, GOLD } from '../lib/a2.js?v=27';

export const meta = { free: true, center: [0.5, 0.74], typeLabel: 'مجسّم تفاعلي' };

function barsTex(col) {
  const c = document.createElement('canvas'); c.width = 256; c.height = 480; const g = c.getContext('2d');
  const gr = g.createLinearGradient(0, 0, 0, 480); gr.addColorStop(0, '#dff6ff'); gr.addColorStop(1, col); g.fillStyle = gr; g.fillRect(0, 0, 256, 480);
  g.fillStyle = 'rgba(255,255,255,.95)'; g.beginPath(); g.arc(128, 150, 54, 0, TAU); g.fill();
  [30, 60, 90, 50, 24].forEach((h, i) => { g.fillStyle = 'rgba(255,255,255,.9)'; g.beginPath(); g.roundRect(48 + i * 36, 330 - h, 20, h * 2, 10); g.fill(); });
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

export default function build(ctx) {
  const g = new THREE.Group(); g.position.copy(P(meta.center[0], meta.center[1])); ctx.stage.add(g);
  const seq = new Seq(), pulse = new Pulse(), seen = new Set();
  const found = (k) => { seen.add(k); if (seen.size >= 4) ctx.ui.done(); else ctx.ui.hud(`${seen.size} من ٤`); };

  const sl = organic(g, 0.92, 0.5, { color: 0x3d7ea3, seed: 3 }); seq.add(sl, 0, 0.7, { rise: 0.04 });
  const Y0 = 0.014;

  // ---------------- two phones
  const phones = [-1, 1].map((d, i) => {
    const p = grp(g, d * 0.35, Y0, -0.02); p.rotation.y = d * -0.45; p.scale.setScalar(1.3);
    add(p, rb(0.1, 0.19, 0.012, 0.014, 3), std(0xf1efe8, { roughness: 0.35 }), 0, 0.1, 0, true);
    const tex = barsTex(i ? '#f3a6c0' : '#8fd0e8');
    add(p, new THREE.PlaneGeometry(0.086, 0.165), new THREE.MeshStandardMaterial({ map: tex, emissiveMap: tex, emissive: 0xffffff, emissiveIntensity: 0.7 }), 0, 0.1, 0.0065);
    add(p, new THREE.CylinderGeometry(0.0055, 0.0055, 0.003, 12), std(0xcfcab8), 0, 0.0245, 0.0068).rotation.x = Math.PI / 2;
    const foot = add(p, new THREE.CylinderGeometry(0.03, 0.034, 0.008, 24), std(0xf1efe8), 0, 0.004, -0.015, true);
    hit(p, 0.09, 0, 0.1, 0);
    seq.add(p, 0.1 + i * 0.1, 0.8); return p;
  });

  // ---------------- wire of light behind the four
  const pts = []; for (let i = 0; i <= 14; i++) { const u = i / 14; pts.push(new THREE.Vector3(-0.33 + u * 0.66, Y0 + 0.13 + Math.sin(u * TAU * 1.5) * 0.03, -0.14 + Math.sin(u * TAU) * 0.02)); }
  const curve = new THREE.CatmullRomCurve3(pts);
  const wire = lightTube(curve, { radius: 0.0045, color: 0xffe08a, speed: 0.6 }); g.add(wire); wire.userData.fill(0);
  const packets = [0, 1, 2].map(() => { const s = glow(0xfff0b0, 0.05, 0); g.add(s); return { s, u: -1, dir: 1 }; });
  const sendPacket = (dir) => { const q = packets.find((x) => x.u < 0) || packets[0]; q.u = dir > 0 ? 0 : 1; q.dir = dir; };
  phones.forEach((p, i) => touch(ctx, p, () => { sendPacket(i ? -1 : 1); ctx.sfx.whoosh?.(); }, 0xffe08a));

  const stand = (x, col, z = 0.06) => {
    const s = grp(g, x, Y0, z); s.scale.setScalar(1.55);
    add(s, new THREE.CylinderGeometry(0.052, 0.058, 0.014, 32), std(0xf6efe0), 0, 0.007, 0, true);
    const t = add(s, new THREE.TorusGeometry(0.053, 0.0035, 6, 40), brass(), 0, 0.014, 0); t.rotation.x = Math.PI / 2;
    pulse.add(s, col, 0.2, 0, 0.06, 0, { op: 0.4 });
    hit(s, 0.075, 0, 0.07, 0);
    return s;
  };
  const num = (s, txt, col, y, delay) => { const c = chip(txt, 0, col, { k: 0.85 }); c.position.set(0, 0.03, 0.095); s.add(c); seq.add(c, delay, 0.5); };
  const card = (title, body, col) => ctx.ui.card({ tag: 'أنواع الاتصال', title, body, color: col });
  const STATE = {};

  // 1) seven heavens — a tower of seven rings, a light climbs
  const s1 = stand(-0.235, 0xf0a030, 0.0);
  add(s1, new THREE.CylinderGeometry(0.003, 0.003, 0.2, 8), brass(), 0, 0.114, 0);
  const rings = Array.from({ length: 7 }, (_, i) => { const r = add(s1, new THREE.TorusGeometry(0.044 - i * 0.0046, 0.0036, 8, 40), gloss(new THREE.Color().setHSL(0.11 + i * 0.075, 0.8, 0.58)), 0, 0.03 + i * 0.026, 0, true); r.rotation.x = Math.PI / 2; return r; });
  const climber = glow(0xfff2c0, 0.05, 0.95); s1.add(climber);
  seq.add(s1, 0.35, 0.8); num(s1, '١', 0xf0a030, 0.235, 1.5);
  let c1 = -1;
  touch(ctx, s1, () => { c1 = 0; card('جسدي وروحي', 'رحلة الإسراء والمعراج إلى السماء السابعة. ويرى الكتاب أن النبي محمداً صلى الله عليه وسلم أول من قام بهذا النوع من الاتصال.', 0xf0a030); found('1'); }, 0xf0a030);

  // 2) inspiration — an open book under a descending beam
  const s2 = stand(-0.08, 0x2a8fd0, 0.11);
  const bookG = grp(s2, 0, 0.03, 0);
  [-1, 1].forEach((d) => { const pg = grp(bookG, d * 0.021, 0, 0); pg.rotation.z = -d * 0.2; add(pg, rb(0.042, 0.005, 0.058, 0.002, 2), std(0xfbf6ea), 0, 0, 0, true); add(pg, rb(0.044, 0.003, 0.06, 0.002, 2), std(0x2a8fd0), 0, -0.004, 0); });
  const beamMat = new THREE.MeshBasicMaterial({ color: 0xbfe6ff, transparent: true, opacity: 0.3, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
  const beam = add(s2, new THREE.CylinderGeometry(0.012, 0.045, 0.2, 24, 1, true), beamMat, 0, 0.14, 0);
  const star = glow(0xffffff, 0.06, 0.9); star.position.set(0, 0.245, 0); s2.add(star);
  seq.add(s2, 0.55, 0.8); num(s2, '٢', 0x2a8fd0, 0.235, 1.6);
  let c2 = -1;
  touch(ctx, s2, () => { c2 = 0; card('روحي إلهامي', 'يتمثل في الوحي، وفي اتصال المؤمنين بربهم من خلال الصلاة والدعاء.', 0x2a8fd0); found('2'); }, 0x2a8fd0);

  // 3) the cave
  const s3 = stand(0.08, 0x8a9a1f, 0.11);
  const dome = new THREE.SphereGeometry(0.05, 20, 12, 0, TAU, 0, Math.PI / 2);
  { const p = dome.attributes.position, v = new THREE.Vector3(); for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i); const n = Math.sin(v.x * 70) * Math.cos(v.z * 63) * 0.18 + Math.sin(v.y * 90) * 0.1; v.multiplyScalar(1 + n * 0.5); v.y *= 0.9; v.x *= 1.15; p.setXYZ(i, v.x, v.y, v.z); } dome.computeVertexNormals(); }
  const rock = add(s3, dome, new THREE.MeshStandardMaterial({ color: 0xb59a74, roughness: 0.9, flatShading: true }), 0, 0.014, -0.005, true);
  const mouth = add(s3, new THREE.CircleGeometry(0.02, 20), new THREE.MeshBasicMaterial({ color: 0x1d1a24 }), 0, 0.03, 0.044); mouth.scale.set(1, 1.15, 1);
  const cglow = glow(0xffe9a8, 0.1, 0.0); cglow.position.set(0, 0.032, 0.046); s3.add(cglow);
  seq.add(s3, 0.75, 0.8); num(s3, '٣', 0x8a9a1f, 0.1, 1.7);
  let c3 = -1;
  touch(ctx, s3, () => { c3 = 0; card('روحي عضوي', 'ضمّ الملك جبريل للرسول الكريم ثلاثاً في أول نزول للوحي في غار حراء، وقوله له: اقرأ.', 0x8a9a1f); found('3'); }, 0x8a9a1f);

  // 4) the message goes out to people
  const s4 = stand(0.235, 0xd9482b, 0.0);
  const core = add(s4, new THREE.SphereGeometry(0.022, 24, 16), gloss(0xe0b85e, { metalness: 0.6 }), 0, 0.05, 0, true);
  const ripM = [0, 1, 2].map(() => { const m = new THREE.MeshBasicMaterial({ color: 0xd9482b, transparent: true, opacity: 0, depthWrite: false }); const r = add(s4, new THREE.TorusGeometry(0.03, 0.0016, 6, 48), m, 0, 0.02, 0); r.rotation.x = Math.PI / 2; return { r, m }; });
  const people = Array.from({ length: 8 }, (_, i) => { const a = i / 8 * TAU; const q = grp(s4, Math.cos(a) * 0.044, 0.014, Math.sin(a) * 0.044); add(q, new THREE.CapsuleGeometry(0.004, 0.008, 3, 8), std(0xd9482b), 0, 0.008, 0); add(q, new THREE.SphereGeometry(0.004, 8, 6), std(0xf1d6b8), 0, 0.02, 0); return q; });
  seq.add(s4, 0.95, 0.8); num(s4, '٤', 0xd9482b, 0.15, 1.8);
  let c4 = -1;
  touch(ctx, s4, () => { c4 = 0; card('روحي إنساني', 'تبليغ الرسالة للناس كما أمر الله تعالى في سورة المائدة. ومن هنا يمكن القول إن الوحي لازم حالات الاتصال بشتى أشكالها.', 0xd9482b); found('4'); }, 0xd9482b);

  ctx.ui.hud('أربعة أنواع بين الجهازين');
  const tmp = new THREE.Vector3();

  return {
    update(t, dt, e) {
      seq.update(t, e); pulse.update(t, e);
      wire.userData.fill(stag(t, 0.5, 1.5, ease) * e); wire.userData.update(dt);
      packets.forEach((q) => { if (q.u >= 0) { q.u += dt * 0.5 * q.dir * (q.dir > 0 ? 1 : 1); const u = q.dir > 0 ? q.u : q.u; if (u > 1 || u < 0) { q.u = -1; q.s.material.opacity = 0; return; } curve.getPoint(u, tmp); q.s.position.copy(tmp); q.s.material.opacity = 0.9; } });
      phones.forEach((p, i) => { p.position.y = Y0 + Math.sin(t * 1.2 + i * 2) * 0.002; });
      // 1: the light climbs the seven rings
      if (c1 >= 0) { c1 += dt; if (c1 > 2.4) c1 = -1; }
      const cu = c1 >= 0 ? clamp01(c1 / 2.0) : ((t * 0.25) % 1);
      climber.position.set(Math.sin(cu * 12) * 0.012, 0.03 + cu * 0.156, Math.cos(cu * 12) * 0.012); climber.scale.setScalar(0.05 + (c1 >= 0 ? 0.04 : 0));
      rings.forEach((r, i) => { r.position.y = 0.03 + i * 0.026 + (c1 >= 0 ? Math.max(0, Math.sin((c1 * 3 - i * 0.35)) ) * 0.004 : 0); });
      // 2: the beam breathes
      if (c2 >= 0) { c2 += dt; if (c2 > 1.6) c2 = -1; }
      const b2 = c2 >= 0 ? Math.sin(clamp01(c2 / 1.6) * Math.PI) : 0;
      beamMat.opacity = e * (0.14 + 0.06 * Math.sin(t * 2) + 0.35 * b2); star.material.opacity = e * (0.5 + 0.4 * b2); star.scale.setScalar(0.05 + 0.06 * b2);
      bookG.position.y = 0.03 + Math.sin(t * 1.3) * 0.003;
      // 3: cave glows three times
      if (c3 >= 0) { c3 += dt; if (c3 > 3.2) c3 = -1; }
      const b3 = c3 >= 0 ? Math.max(0, Math.sin(c3 * Math.PI)) * (c3 < 3 ? 1 : 0) : 0.18 + 0.1 * Math.sin(t * 1.5);
      cglow.material.opacity = e * b3; cglow.scale.setScalar(0.1 + 0.1 * b3);
      // 4: ripples go out to the people
      if (c4 >= 0) { c4 += dt; if (c4 > 2.8) c4 = -1; }
      ripM.forEach((q, i) => { const k = ((t * 0.28 + i / 3) % 1); const kk = c4 >= 0 ? ((c4 * 0.55 + i * 0.3) % 1) : k; q.r.scale.setScalar(0.4 + kk * 1.5); q.m.opacity = e * (c4 >= 0 ? 0.7 : 0.35) * (1 - kk); });
      core.position.y = 0.05 + Math.sin(t * 1.6) * 0.004; core.rotation.y = t;
      people.forEach((q, i) => { q.scale.setScalar(1 + (c4 >= 0 ? 0.25 * Math.max(0, Math.sin(c4 * 4 - i * 0.7)) : 0)); });
    },
  };
}
