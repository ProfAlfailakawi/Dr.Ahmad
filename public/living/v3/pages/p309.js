import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { P, ease, easeBack, clamp01, stag, mat, glossy, goldMat, shadowed, glow, sprite } from '../../kit.js?v=16';
import { inked } from '../../pencil.js?v=16';
import { Rig, V, TAU } from '../lib/a5-kit.js?v=16';

export const meta = { free: true, center: [0.55, 0.5], typeLabel: 'طبقة فوق الواقع' };

const WEDGES = [
  { f: 0.46, c: 0x7bc043 }, { f: 0.26, c: 0xdce13a }, { f: 0.17, c: 0xef8f2a }, { f: 0.11, c: 0xe0452c },
];
const RAD = 0.078, PIE_C = V(0.07, 0, 0.1);

function sheetTex() {
  const c = document.createElement('canvas'); c.width = 512; c.height = 384; const g = c.getContext('2d');
  g.fillStyle = '#fffdf6'; g.fillRect(0, 0, 512, 384);
  g.fillStyle = '#d6dbe0'; g.beginPath(); g.roundRect(30, 28, 210, 34, 10); g.fill();
  [0, 1, 2, 3].forEach((i) => { g.strokeStyle = '#9aa4ae'; g.lineWidth = 4; g.strokeRect(32, 96 + i * 44, 24, 24); g.fillStyle = '#c4ccd4'; g.beginPath(); g.roundRect(72, 102 + i * 44, 120 + (i % 2) * 40, 14, 6); g.fill(); });
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function cardTex() {
  const c = document.createElement('canvas'); c.width = 256; c.height = 320; const g = c.getContext('2d');
  g.fillStyle = 'rgba(244,240,255,0.94)'; g.beginPath(); g.roundRect(6, 6, 244, 308, 34); g.fill(); g.strokeStyle = '#7b5fd0'; g.lineWidth = 6; g.stroke();
  g.fillStyle = '#7b5fd0'; g.beginPath(); g.roundRect(30, 28, 130, 22, 10); g.fill();
  WEDGES.slice().reverse().forEach((w, i) => { const y = 88 + i * 52; g.fillStyle = '#' + w.c.toString(16).padStart(6, '0'); g.beginPath(); g.arc(62, y + 14, 20, 0, TAU); g.fill(); g.fillStyle = '#c9c0e6'; g.beginPath(); g.roundRect(100, y + 6, 110 - i * 10, 16, 8); g.fill(); });
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

export default function build(ctx) {
  const g = new THREE.Group(); g.position.copy(P(meta.center[0], meta.center[1])); g.scale.setScalar(1.32); g.position.x -= 0.02; ctx.stage.add(g);
  const rig = new Rig(ctx);

  // reality layer: desk plank + printed sheet + flat pie
  const plank = inked(new RoundedBoxGeometry(0.58, 0.02, 0.4, 3, 0.01), { color: 0xe3b783 }); plank.position.y = 0.01; g.add(plank); rig.ink(plank, 0.1, 1.1);
  const sheet = new THREE.Mesh(new RoundedBoxGeometry(0.44, 0.004, 0.33, 1, 0.002), new THREE.MeshStandardMaterial({ map: sheetTex(), roughness: 0.9 })); sheet.position.set(0, 0.022, 0.0); g.add(sheet);
  const pen = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.005, 0.1, 10), glossy(0xe0452c)); pen.rotation.z = Math.PI / 2; pen.rotation.y = 0.5; pen.position.set(-0.17, 0.03, 0.14); g.add(shadowed(pen));
  const pie = new THREE.Group(); pie.position.set(PIE_C.x, 0.024, PIE_C.z); g.add(pie);
  let a0 = 0;
  const wedges = WEDGES.map((w, i) => {
    const th = w.f * TAU; const geo = new THREE.CylinderGeometry(RAD, RAD, 1, 28, 1, false, a0, th);
    const m = new THREE.Mesh(geo, glossy(w.c, { roughness: 0.25, transparent: true, opacity: 0.95 })); m.castShadow = true;
    const mid = a0 + th / 2; a0 += th;
    const grp = new THREE.Group(); grp.add(m); pie.add(grp);
    return { grp, m, mid, dir: V(Math.sin(mid), 0, Math.cos(mid)), pop: -9, popped: false, i, w, tgt: 0.002 };
  });

  // device: a tablet that rises from the desk
  const dev = new THREE.Group(); g.add(dev);
  const bez = new THREE.Mesh(new RoundedBoxGeometry(0.38, 0.012, 0.27, 3, 0.012), glossy(0x161a22, { roughness: 0.2 })); dev.add(shadowed(bez));
  const pane = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.23), new THREE.MeshBasicMaterial({ color: 0xb9a8ff, transparent: true, opacity: 0.12, toneMapped: false, depthWrite: false, side: THREE.DoubleSide })); pane.rotation.x = -Math.PI / 2; pane.position.y = 0.008; dev.add(pane);
  const edge = new THREE.Mesh(new THREE.TorusGeometry(0.0, 0.0, 3, 3), goldMat());
  const frame = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.PlaneGeometry(0.34, 0.23)), new THREE.LineBasicMaterial({ color: 0xb9a8ff, transparent: true, opacity: 0.9 })); frame.rotation.x = -Math.PI / 2; frame.position.y = 0.009; dev.add(frame);
  const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.004, 14), glossy(0x45c6ff)); lens.position.set(0, 0.008, -0.12); dev.add(lens);

  // digital card hovering above the sheet
  const card = new THREE.Mesh(new THREE.PlaneGeometry(0.1, 0.125), new THREE.MeshBasicMaterial({ map: cardTex(), transparent: true, toneMapped: false, depthWrite: false, side: THREE.DoubleSide }));
  card.position.set(0.0, 0.2, 0.02); card.rotation.x = -0.18; g.add(card); card.renderOrder = 6;
  const cglow = glow(0xb9a8ff, 0.2, 0); card.add(cglow);

  const tagR = sprite('الواقع', 0.11, { size: 44, width: 300, weight: 800, border: '#d4ad55' }); tagR.userData.w = 0.11; tagR.position.set(-0.17, 0.03, 0.235); g.add(tagR);
  const tagD = sprite('طبقة رقمية', 0.15, { size: 44, width: 380, weight: 800, border: '#7b5fd0' }); tagD.userData.w = 0.15; tagD.position.set(0.0, 0.31, 0.02); g.add(tagD);

  let layer = 0, lt = 0, now = 0, seen = new Set(), finished = false, autoOn = false;
  const mark = (id) => { seen.add(id); if (seen.size >= 4 && !finished) { finished = true; setTimeout(() => ctx.ui.done(), 1100); } };
  const toggle = (v) => { lt = v === undefined ? (lt ? 0 : 1) : v; ctx.sfx.whoosh?.(); };
  rig.touch(dev, (hh) => {
    toggle(); ctx.ui.card({ tag: 'الوسيط', title: 'الجهاز الوسيط', body: 'الشاشة هي النافذة التي يُدمج عليها الواقعي والرقمي، فتلتقط الكاميرا العلامة وتعرض ما يرتبط بها.', color: 0x7b5fd0 }); mark('dev'); hh.on = false;
  }, { color: 0xb9a8ff, size: 0.34, at: V(0, 0.02, 0), show: 5.5 });
  rig.touch(card, (hh) => { ctx.sfx.pop?.(); ctx.ui.card({ tag: 'معلومة', title: 'المعلومة المضافة', body: 'بطاقة التقييم الافتراضية تُعرض فوق المشهد الحقيقي؛ فيضيف الواقع المعزز معلومات رقمية بدل أن يستبدله.', color: 0x7b5fd0 }); mark('card'); hh.on = false; }, { color: 0xb9a8ff, size: 0.2, show: 5.8 });
  rig.touch(sheet, (hh) => { ctx.sfx.pop?.(); ctx.ui.card({ tag: 'الواقع', title: 'الواقع المطبوع', body: 'ورقة استبيان حقيقية عليها مخطط دائري؛ هذا هو المشهد الذي تلتقطه الكاميرا وتتعرّف عليه.', color: 0xd4ad55 }); mark('paper'); hh.on = false; }, { color: 0xffd27a, size: 0.3, at: V(-0.1, 0.02, 0.0), show: 5.2 });
  wedges.forEach((w) => rig.touch(w.grp, (hh) => {
    if (lt < 0.5) { toggle(1); return; }
    w.pop = now; w.popped = !w.popped; ctx.sfx.pop?.(); ctx.fx.burst(V(PIE_C.x + w.dir.x * 0.07, 0.1, PIE_C.z + w.dir.z * 0.07), w.w.c, 16, 0.3, 0.03);
    ctx.ui.card({ tag: 'ثلاثي الأبعاد', title: 'مخطط مجسّم', body: 'المخطط الدائري يرتفع ثلاثي الأبعاد فوق الورقة؛ وهذا ما يفرّق الواقع المعزز عن الافتراضي الذي يحلّ محل المشهد كله.', color: w.w.c }); mark('pie'); hh.on = false;
  }, { color: w.w.c, size: 0.13, at: V(w.dir.x * 0.035, 0.04, w.dir.z * 0.035), show: 7 + w.i * 0.2 }));
  ctx.ui.hud('ارفع الجهاز لتظهر الطبقة الرقمية');

  return {
    update(t, dt, e) {
      now = t; rig.update(t, dt, e);
      if (!autoOn && t > 1.8) { autoOn = true; lt = 1; }
      layer += (lt - layer) * Math.min(1, dt * 2.4); const L = ease(layer);
      dev.position.set(THREE.MathUtils.lerp(0.33, 0.0, L), THREE.MathUtils.lerp(0.032, 0.15, L), THREE.MathUtils.lerp(0.02, -0.17, L));
      dev.rotation.set(L * 1.12, THREE.MathUtils.lerp(-0.5, 0, L), 0);
      dev.scale.setScalar(Math.max(stag(t, 1.0, 0.8, easeBack) * e, 0.001));
      pane.material.opacity = (0.08 + 0.1 * L) * (0.8 + 0.2 * Math.sin(t * 2));
      wedges.forEach((w) => {
        const base = stag(t, 1.4 + w.i * 0.15, 0.7, easeBack) * e;
        const pk = clamp01((now - w.pop) / 0.5); const off = w.popped ? ease(pk) : 1 - ease(w.pop > 0 ? pk : 1) * (w.pop > 0 ? 1 : 0);
        const out = w.pop > 0 ? (w.popped ? ease(pk) : 1 - ease(pk)) : 0;
        const hgt = 0.002 + (0.03 + 0.012 * (1 - w.i / 4)) * L;
        w.m.scale.set(Math.max(base, 0.001), hgt, Math.max(base, 0.001)); w.m.position.y = hgt / 2;
        w.grp.position.set(w.dir.x * (0.012 + out * 0.025) * L, out * 0.02 * L + Math.sin(t * 2 + w.i) * 0.002 * L, w.dir.z * (0.012 + out * 0.025) * L);
      });
      card.scale.setScalar(Math.max(L * stag(t, 2.2, 0.8, easeBack) * e, 0.001)); card.visible = L > 0.02;
      card.position.y = 0.2 + Math.sin(t * 1.6) * 0.006; cglow.material.opacity = 0.35 * L;
      tagD.scale.setScalar(Math.max(L, 0.0001)); tagD.scale.set(tagD.userData.w * L + 0.0001, tagD.userData.w * tagD.userData.aspect * L + 0.0001, 1);
      const k = stag(t, 2.0, 0.6, easeBack) * e; tagR.scale.set(tagR.userData.w * k + 0.0001, tagR.userData.w * tagR.userData.aspect * k + 0.0001, 1);
      g.rotation.y = Math.sin(t * 0.3) * 0.04;
    },
  };
}
