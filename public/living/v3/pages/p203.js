// p203 — Fleming's cycle of information: a chalk-slate disc under a hanging lamp, four little machines on a ring, and a spark of information that travels round them.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { P, ease, easeBack, clamp01, stag, mat, glossy, goldMat, shadowed } from '../../kit.js?v=15';
import { tagSprite, setSpr, softLight, lightPool } from '../../v2/common.js?v=15';
import { hints, finder, blobShadow } from '../lib/a3-kit.js?v=15';

export const meta = { free: true, center: [0.43, 0.66], typeLabel: 'دورة تفاعلية' };

const TAU = Math.PI * 2, RR = 0.18;
const ST = [
  { n: 'يستقبل', c: 0x45b6e8, card: ['المحطة الأولى', 'يستقبل', 'الطريقة التي يستقبل بها المتعلم المعرفة والمعلومات والخبرات.'] },
  { n: 'يرتّب وينظّم', c: 0xf0a030, card: ['المحطة الثانية', 'يرتّب وينظّم', 'الطريقة التي يرتّب وينظّم بها هذه المعلومات.'] },
  { n: 'يسجّل ويرمّز', c: 0x8ac04a, card: ['المحطة الثالثة', 'يسجّل ويرمّز', 'يسجّل المعلومات ويرمّزها ويدمجها ويحتفظ بها في مخزونه المعرفي.'] },
  { n: 'يسترجع ويعبّر', c: 0xe0605a, card: ['المحطة الرابعة', 'يسترجع ويعبّر', 'يسترجع المعلومات والخبرات بالطريقة التي تمثل طريقته في التعبير عنها.'] },
];

function chalkTex() {
  const c = document.createElement('canvas'); c.width = c.height = 512; const g = c.getContext('2d');
  const gr = g.createRadialGradient(256, 256, 20, 256, 256, 256); gr.addColorStop(0, '#4a5256'); gr.addColorStop(1, '#2b3235'); g.fillStyle = gr; g.fillRect(0, 0, 512, 512);
  g.strokeStyle = 'rgba(255,255,255,.2)'; g.fillStyle = 'rgba(255,255,255,.22)'; g.lineWidth = 2; g.font = '700 26px Georgia, serif';
  const w = ['x² + y²', 'Σ', 'π', 'a/b', '∫ f', 'E=mc²', '√25', '△', '∞', 'n+1'];
  for (let i = 0; i < 26; i++) { const x = 40 + Math.random() * 430, y = 40 + Math.random() * 430; if (Math.hypot(x - 256, y - 256) > 235) continue; g.save(); g.translate(x, y); g.rotate((Math.random() - 0.5) * 0.7); g.fillText(w[i % w.length], 0, 0); g.restore(); }
  for (let i = 0; i < 8; i++) { g.beginPath(); g.moveTo(80 + Math.random() * 350, 80 + Math.random() * 350); g.lineTo(80 + Math.random() * 350, 80 + Math.random() * 350); g.stroke(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}

export default function build(ctx) {
  const g = new THREE.Group(); g.position.copy(P(0.43, 0.66)); g.scale.setScalar(0.84); ctx.stage.add(g);
  const H = hints(), found = finder(ctx, 4);
  // a round chalk table on three legs (the one raised stage of this set)
  const TH = 0.15, Y = TH;
  const base = new THREE.Group(); g.add(base);
  const wood = mat(0xc98f55, { roughness: 0.5 });
  const topD = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.03, 72), wood); topD.position.y = TH - 0.016; base.add(topD);
  const skirt = new THREE.Mesh(new THREE.CylinderGeometry(0.255, 0.26, 0.026, 60), mat(0x9a6a38)); skirt.position.y = TH - 0.046; base.add(skirt);
  const rimG = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.007, 10, 90), goldMat()); rimG.rotation.x = Math.PI / 2; rimG.position.y = TH - 0.002; base.add(rimG);
  [0, 1, 2].forEach((k) => { const a = k * TAU / 3 + 0.5; const L = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.02, TH - 0.03, 12), wood); L.position.set(Math.cos(a) * 0.19, (TH - 0.03) / 2, Math.sin(a) * 0.19); L.rotation.z = -Math.cos(a) * 0.12; L.rotation.x = Math.sin(a) * 0.12; base.add(L); });
  const slate = new THREE.Mesh(new THREE.CircleGeometry(0.275, 64), new THREE.MeshStandardMaterial({ map: chalkTex(), roughness: 0.9 })); slate.rotation.x = -Math.PI / 2; slate.position.y = TH + 0.0005; g.add(slate);
  const tsh = blobShadow(0.78, 0.78, 0.32); g.add(tsh);
  // chalk ring
  const ring = new THREE.Mesh(new THREE.TorusGeometry(RR, 0.0045, 8, 90), new THREE.MeshStandardMaterial({ color: 0xf6f1e4, roughness: 0.9, emissive: 0xf6f1e4, emissiveIntensity: 0.15 })); ring.rotation.x = Math.PI / 2; ring.position.y = Y + 0.003; g.add(ring);
  const arrows = ST.map((s, k) => {
    const a = -Math.PI / 2 + (k + 0.5) * TAU / 4;
    const c = new THREE.Mesh(new THREE.ConeGeometry(0.011, 0.026, 12), mat(0xf6f1e4, { emissive: 0xf6f1e4, emissiveIntensity: 0.2 }));
    c.position.set(Math.cos(a) * RR, Y + 0.008, Math.sin(a) * RR); c.rotation.x = Math.PI / 2; c.rotation.z = 0;
    const w = new THREE.Group(); w.add(c); w.position.copy(c.position); c.position.set(0, 0, 0); w.rotation.y = -(a + Math.PI / 2) + Math.PI; g.add(w); return w;
  });

  // hanging lamp + light pool
  const lamp = new THREE.Group(); lamp.position.y = 0.7; g.add(lamp);
  const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.0022, 0.0022, 0.3, 6), mat(0xb08a4a)); cord.position.y = 0.15; lamp.add(cord);
  const shade = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.07, 0.05, 36, 1, true), new THREE.MeshStandardMaterial({ color: 0xf0d79c, roughness: 0.3, metalness: 0.5, side: THREE.DoubleSide })); shade.position.y = -0.02; lamp.add(shade);
  const inner = new THREE.Mesh(new THREE.CylinderGeometry(0.017, 0.068, 0.049, 36, 1, true), new THREE.MeshBasicMaterial({ color: 0xffe3a0, side: THREE.BackSide, toneMapped: false })); inner.position.y = -0.02; lamp.add(inner);
  const bulb = softLight(0xffd27a, 0.15, 0.9); bulb.position.y = -0.045; lamp.add(bulb);
  const pool = lightPool(0xffd9a0, 0.3, 0.0); pool.position.y = TH + 0.004; g.add(pool);
  ctx.tap(lamp, () => { ctx.sfx.pop?.(); ctx.ui.card({ tag: 'نموذج فارك', title: 'أنماط التعلم المفضلة', body: 'عرّفها فليمنج وبونويل بأنها الطريقة التي يستقبل بها المتعلم المعلومات ثم يرتّبها ويرمّزها ويسترجعها.', color: 0xd4ad55 }); });

  // ---- stations
  const stations = ST.map((s, k) => {
    const a = -Math.PI / 2 + k * TAU / 4;
    const grp = new THREE.Group(); grp.position.set(Math.cos(a) * RR, Y, Math.sin(a) * RR); grp.userData.k = 1.3; g.add(grp);
    const pad = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.06, 0.012, 36), glossy(s.c)); pad.position.y = 0.006; grp.add(pad);
    const part = { grp, pad, k, a, act: 0, anim: [] };
    if (k === 0) { // funnel + falling motes
      const cone = new THREE.Mesh(new THREE.CylinderGeometry(0.048, 0.01, 0.06, 28, 1, true), new THREE.MeshStandardMaterial({ color: 0xe9f6ff, metalness: 0.6, roughness: 0.25, side: THREE.DoubleSide })); cone.position.y = 0.055; grp.add(cone);
      const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.025, 12), goldMat()); tube.position.y = 0.02; grp.add(tube);
      part.motes = Array.from({ length: 6 }, (_, i) => { const m = softLight(0x7fd4ff, 0.026, 0.9); grp.add(m); return { m, o: i / 6, x: (Math.random() - 0.5) * 0.06, z: (Math.random() - 0.5) * 0.06 }; });
    } else if (k === 1) { // sorting shelf
      const rack = new THREE.Mesh(new RoundedBoxGeometry(0.1, 0.01, 0.04, 2, 0.003), goldMat()); rack.position.y = 0.03; grp.add(rack);
      part.cubes = [0xe0605a, 0x45b6e8, 0x8ac04a].map((c, i) => { const m = new THREE.Mesh(new RoundedBoxGeometry(0.026, 0.026, 0.026, 2, 0.004), glossy(c)); grp.add(m); return { m, i, from: [2, 0, 1][i] }; });
    } else if (k === 2) { // glass jar with a gold bead
      const jar = new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.036, 0.075, 28), new THREE.MeshPhysicalMaterial({ color: 0xeaffe0, transparent: true, opacity: 0.28, roughness: 0.05, clearcoat: 1, depthWrite: false })); jar.position.y = 0.05; jar.renderOrder = 5; grp.add(jar);
      const lid = new THREE.Mesh(new THREE.TorusGeometry(0.036, 0.004, 8, 32), goldMat()); lid.rotation.x = Math.PI / 2; lid.position.y = 0.088; grp.add(lid);
      part.bead = new THREE.Mesh(new THREE.SphereGeometry(0.012, 18, 14), glossy(0xf1c25a, { emissive: 0xffb300, emissiveIntensity: 0.5, metalness: 0.5 })); grp.add(part.bead);
      part.beadGlow = softLight(0xffc24a, 0.07, 0); part.bead.add(part.beadGlow);
      part.lidT = 0;
    } else { // megaphone
      const horn = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.015, 0.075, 28, 1, true), new THREE.MeshStandardMaterial({ color: s.c, roughness: 0.3, metalness: 0.2, side: THREE.DoubleSide })); horn.rotation.z = Math.PI / 2; horn.position.set(0, 0.05, 0); grp.add(horn);
      const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.03, 10), mat(0x2b2620)); handle.position.set(-0.03, 0.03, 0); grp.add(handle);
      part.waves = Array.from({ length: 3 }, (_, i) => { const w = new THREE.Mesh(new THREE.TorusGeometry(0.03, 0.002, 6, 30), new THREE.MeshBasicMaterial({ color: s.c, transparent: true, opacity: 0, toneMapped: false })); w.rotation.y = Math.PI / 2; grp.add(w); return { w, o: i / 3 }; });
      horn.userData.horn = true; part.horn = horn;
    }
    shadowed(grp);
    const tg = tagSprite(s.n, 0.15 / 1.3, s.c); tg.position.set(Math.cos(a) * 0.1, 0.1, Math.sin(a) * 0.1); grp.add(tg); part.tg = tg;
    ctx.tap(grp, () => jumpTo(k));
    part.hint = H.add(grp, s.c, 0.15, [0, 0.06, 0], 4.4 + k * 0.25);
    return part;
  });

  const orb = new THREE.Mesh(new THREE.SphereGeometry(0.014, 18, 14), glossy(0xfff0b0, { emissive: 0xffc24a, emissiveIntensity: 1 })); g.add(orb);
  orb.add(softLight(0xffc24a, 0.12, 0.7));
  const trail = Array.from({ length: 10 }, (_, i) => { const s = softLight(0xffc24a, 0.04 * (1 - i / 12), 0.5 * (1 - i / 10)); g.add(s); return s; });
  let ang = -Math.PI / 2, speed = 0.55, hold = 0, holdAt = -1, now = 0;
  const nearIdx = () => { const k = Math.round(((ang + Math.PI / 2) / (TAU / 4))); return ((k % 4) + 4) % 4; };
  function jumpTo(k) {
    ctx.sfx.pop?.(); const tAng = -Math.PI / 2 + k * TAU / 4;
    let d = ((tAng - ang) % TAU + TAU) % TAU; ang += d; hold = 3.2; holdAt = k; // teleports forward along ring: quick hop
    const [a, b, c] = ST[k].card; ctx.ui.card({ tag: a, title: b, body: c, color: ST[k].c });
    stations[k].hint.calm = true; found(k);
    ctx.fx.burst(new THREE.Vector3(Math.cos(tAng) * RR, 0.09, Math.sin(tAng) * RR).add(g.position), ST[k].c, 22, 0.35, 0.03);
    ctx.ui.hud('المعلومة تدور من محطة إلى التي تليها');
  }
  ctx.ui.hud('تتبّع دورة المعلومة وامسّ كل محطة');
  const v = new THREE.Vector3();
  return {
    update(t, dt, e) {
      now = t;
      { const k = Math.max(stag(t, 0.1, 0.8, easeBack) * e, 0.001); base.scale.set(k, k, k); slate.scale.set(k, k, k); tsh.material.opacity = 0.32 * e; }
      ring.scale.setScalar(Math.max(stag(t, 0.6, 1.0) * e, 0.001));
      arrows.forEach((w, i) => w.scale.setScalar(Math.max(stag(t, 1.4 + i * 0.15, 0.5, easeBack) * e, 0.001)));
      lamp.position.y = 0.58 + 0.14 * (1 - easeBack(clamp01((t - 0.2) / 0.9))) + (1 - e) * 0.14; lamp.rotation.z = Math.sin(t * 0.9) * 0.025;
      pool.material.opacity = 0.45 * clamp01((t - 1.2) * 0.8) * e * (0.92 + 0.08 * Math.sin(t * 5));
      pool.position.x = Math.sin(t * 0.9) * 0.01;
      // orb travel
      if (t > 1.4) {
        if (hold > 0) hold -= dt; else { ang += dt * speed; holdAt = -1; }
        // slow down near stations so each one gets its moment
        const nr = ang + Math.PI / 2, ph = ((nr % (TAU / 4)) + TAU / 4) % (TAU / 4); const near = Math.min(ph, TAU / 4 - ph);
        speed = 0.35 + clamp01(near / 0.5) * 0.9;
      }
      orb.position.set(Math.cos(ang) * RR, Y + 0.035 + Math.sin(t * 4) * 0.004, Math.sin(ang) * RR);
      orb.scale.setScalar(Math.max(stag(t, 1.2, 0.6, easeBack) * e, 0.001));
      trail.forEach((s, i) => { const a = ang - (i + 1) * 0.07; s.position.set(Math.cos(a) * RR, Y + 0.035, Math.sin(a) * RR); s.visible = t > 1.6; });
      stations.forEach((s, i) => {
        s.grp.scale.setScalar(Math.max(stag(t, 0.5 + i * 0.18, 0.7, easeBack) * e, 0.001) * 1.3);
        let d = Math.abs(((ang - s.a + Math.PI) % TAU + TAU) % TAU - Math.PI);
        const want = t > 1.4 ? clamp01(1 - d / 0.7) : 0; s.act += (want - s.act) * Math.min(1, dt * 6);
        s.pad.material.emissive.setHex(ST[i].c); s.pad.material.emissiveIntensity = s.act * 0.5;
        if (s.motes) s.motes.forEach((m) => { const p = (t * 0.7 + m.o) % 1; m.m.position.set(m.x * (1 - p), 0.12 - p * 0.1, m.z * (1 - p)); m.m.material.opacity = 0.9 * (0.3 + s.act * 0.7) * Math.sin(p * Math.PI) * e; });
        if (s.cubes) s.cubes.forEach((c) => { const slot = (n) => (n - 1) * 0.034; const x = slot(c.from) * (1 - ease(s.act)) + slot(c.i) * ease(s.act); c.m.position.set(x, 0.048 + Math.sin(s.act * Math.PI) * 0.02 * (c.i === 1 ? 0 : 1), 0); c.m.rotation.y = s.act * 0.8; });
        if (s.bead) { const p = ease(s.act); s.bead.position.y = 0.13 - p * 0.09 + Math.sin(t * 3) * 0.002; s.beadGlow.material.opacity = p * 0.8; }
        if (s.waves) s.waves.forEach((w) => { const p = (t * 0.9 + w.o) % 1; w.w.position.x = 0.05 + p * 0.1; w.w.scale.setScalar(0.5 + p * 1.2); w.w.material.opacity = (1 - p) * 0.7 * s.act; });
        s.tg.visible = t > 1.8; setSpr(s.tg, 0.15 / 1.3, clamp01((t - 1.8 - i * 0.12) * 1.6) * e);
      });
      H.update(t, e);
    },
  };
}
