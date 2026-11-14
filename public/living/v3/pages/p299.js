// p299 (round 4): one claim floats above a table at a time; tap the coin jar (material saving) or the orbit globe (beyond place, time and age).
// The claim drops into the vessel you chose: coins pile up in the jar, satellites join the globe's rings.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { P, ease, easeBack, clamp01, stag, mat, glossy, goldMat, shadowed, glow } from '../../kit.js?v=40';
import { rising, halos, motes, blob, dais, screen, paintText, TAU, toAr } from '../lib/b4-kit.js?v=40';

export const meta = { free: true, center: [0.5, 0.4], typeLabel: 'لعبة فرز', title: 'صنّف مزايا الفصول الافتراضية' };

const ITEMS = [
  ['طلاب من أماكن مختلفة', 1], ['بلا قاعات دراسية', 0], ['دراسة في أوقات مختلفة', 1], ['بلا مواصلات', 0], ['بلا ساحات مدرسية', 0], ['بلا قيود عمرية', 1],
  ['تجهيزات أقل بكثير', 0], ['تعليم مستمر للأفراد', 1], ['بلا أدوات مكلفة', 0], ['صفّ يتسع للكثيرين', 1], ['بلا أعباء إدارية', 0], ['الأمثل للمتباعدين', 1],
];
const ORANGE = 0xf7871b, TEAL = 0x2fb5a8;
const JAR = new THREE.Vector3(-0.2, 0, 0.14), GLB = new THREE.Vector3(0.2, 0, 0.14);

export default function build(ctx) {
  const g = new THREE.Group(); g.position.copy(P(meta.center[0], meta.center[1])); ctx.stage.add(g);
  const rise = rising(), hal = halos(), mo = motes(g, 18, { r: 0.4, h: 0.55 });
  const sh = blob(0.42, 0.3); sh.position.y = -0.02; g.add(sh);
  const base = dais(0.4, { top: 0xffcf96, under: 0x7a4a22 }); rise.add(base, 0.05, 0.1, 0.9); g.add(base);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.36, 0.005, 8, 96), new THREE.MeshBasicMaterial({ color: 0xe8700a, toneMapped: false })); ring.rotation.x = Math.PI / 2; ring.position.y = 0.034; g.add(ring);
  ctx.tap(base, () => ctx.ui.card({ tag: 'قاعدة الفرز', title: 'ضع الميزة حيث تنتمي', body: 'إمّا وفرٌ في الموارد، وإمّا تجاوزٌ لقيود المكان والزمن والعمر.', color: ORANGE }));

  // ---- coin jar (material saving)
  const jar = new THREE.Group(); jar.position.copy(JAR); jar.position.y = 0.03; jar.scale.setScalar(1.12); g.add(jar);
  const jf = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.095, 0.022, 40), goldMat()); jf.position.y = 0.011; jar.add(jf);
  const jg = new THREE.Mesh(new THREE.CylinderGeometry(0.078, 0.078, 0.24, 40, 1, true), new THREE.MeshPhysicalMaterial({ color: 0xf3ecd9, transparent: true, opacity: 0.2, roughness: 0.05, clearcoat: 1, side: THREE.DoubleSide, depthWrite: false })); jg.position.y = 0.14; jar.add(jg);
  const jc = new THREE.Mesh(new THREE.TorusGeometry(0.078, 0.006, 8, 40), goldMat()); jc.rotation.x = Math.PI / 2; jc.position.y = 0.26; jar.add(jc);
  const coins = []; for (let i = 0; i < 6; i++) { const c = new THREE.Mesh(new THREE.CylinderGeometry(0.066, 0.066, 0.016, 36), goldMat()); c.position.y = 0.032 + i * 0.0175; c.rotation.y = i * 0.8; c.scale.setScalar(0.0001); c.visible = false; jar.add(c); const e = new THREE.Mesh(new THREE.TorusGeometry(0.052, 0.0022, 6, 30), goldMat()); e.rotation.x = Math.PI / 2; e.position.y = 0.008; c.add(e); coins.push({ m: c, k: 0, y: c.position.y }); }
  const jp = screen(0.17, 0.065, 384); jp.draw((c, w, h) => { c.fillStyle = '#2b2620'; c.beginPath(); c.roundRect(3, 3, w - 6, h - 6, 28); c.fill(); paintText(c, 'الوفر المادي', w / 2, h / 2 + 2, w - 36, h - 18, { size: 72, color: '#f6e6b8' }); });
  jp.mesh.position.set(0, 0.012, 0.14); jp.mesh.rotation.x = -0.95; jar.add(jp.mesh); jp.mesh.renderOrder = 6;
  shadowed(jar); rise.add(jar, 0.6, 0.12, 0.8);
  const jarGlow = glow(0xffd27a, 0.3, 0); jarGlow.position.y = 0.16; jar.add(jarGlow);
  hal.add(jar, 0xffe0a0, 0.3, [0, 0.14, 0.02], 4.2);

  // ---- orbit globe (beyond place, time, age)
  const glb = new THREE.Group(); glb.position.copy(GLB); glb.position.y = 0.03; glb.scale.setScalar(1.12); g.add(glb);
  const gf = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.09, 0.03, 36), goldMat()); gf.position.y = 0.015; glb.add(gf);
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.06, 14), goldMat()); stem.position.y = 0.06; glb.add(stem);
  const gc = new THREE.Group(); gc.position.y = 0.17; glb.add(gc);
  const core = new THREE.Mesh(new THREE.SphereGeometry(0.058, 36, 28), glossy(0x2f78c8, { clearcoat: 0.8, emissive: 0x153f7a, emissiveIntensity: 0.5 })); gc.add(core);
  const shell = new THREE.Mesh(new THREE.SphereGeometry(0.082, 36, 28), new THREE.MeshPhysicalMaterial({ color: 0xe6f4f6, transparent: true, opacity: 0.18, roughness: 0.05, clearcoat: 1, depthWrite: false })); gc.add(shell);
  const rings = [0, 1, 2].map((i) => { const r = new THREE.Mesh(new THREE.TorusGeometry(0.108 + i * 0.008, 0.0035, 8, 64), goldMat()); r.rotation.set(0.6 + i * 0.5, i * 1.1, 0); gc.add(r); return r; });
  const sats = []; for (let i = 0; i < 6; i++) { const s = new THREE.Mesh(new THREE.SphereGeometry(0.015, 16, 12), glossy([0xef8f2a, 0x35b5a8, 0x3a86d6][i % 3], { emissive: [0xef8f2a, 0x35b5a8, 0x3a86d6][i % 3], emissiveIntensity: 0.4 })); s.scale.setScalar(0.0001); s.visible = false; gc.add(s); sats.push({ m: s, k: 0, ring: i % 3, ph: i * 1.3, sp: 0.8 + i * 0.12 }); }
  const gp = screen(0.19, 0.065, 384); gp.draw((c, w, h) => { c.fillStyle = '#2b2620'; c.beginPath(); c.roundRect(3, 3, w - 6, h - 6, 28); c.fill(); paintText(c, 'تجاوز القيود', w / 2, h / 2 + 2, w - 36, h - 18, { size: 72, color: '#f6e6b8' }); });
  gp.mesh.position.set(0, 0.014, 0.14); gp.mesh.rotation.x = -0.95; glb.add(gp.mesh); gp.mesh.renderOrder = 6;
  shadowed(glb); rise.add(glb, 0.8, 0.12, 0.8);
  const glbGlow = glow(0x9fdcff, 0.34, 0); glbGlow.position.y = 0.17; glb.add(glbGlow);
  hal.add(glb, 0xbfe6ff, 0.3, [0, 0.17, 0.02], 4.4);

  // ---- the claim token
  const tok = new THREE.Group(); tok.position.set(0, 0.32, -0.06); tok.scale.setScalar(1.25); g.add(tok);
  const tl = new THREE.Group(); tl.rotation.x = -0.5; tok.add(tl);
  const tb = new THREE.Mesh(new RoundedBoxGeometry(0.3, 0.13, 0.02, 4, 0.016), glossy(0xfffdf7, { clearcoat: 0.6 })); tl.add(tb);
  const te = new THREE.Mesh(new RoundedBoxGeometry(0.31, 0.14, 0.012, 3, 0.018), goldMat()); te.position.z = -0.008; tl.add(te);
  const ts = screen(0.28, 0.11, 640); ts.mesh.position.z = 0.0115; tl.add(ts.mesh);
  const tg = glow(0xffe0a0, 0.5, 0.0); tg.position.z = 0.03; tl.add(tg);
  shadowed(tok); rise.add(tok, 1.4, 0.15, 0.8);
  hal.add(tl, 0xffe0a0, 0.4, [0, 0, 0.03], 4);
  const drawTok = (text) => ts.draw((c, w, h) => { paintText(c, text, w / 2, h / 2, w * 0.88, h * 0.7, { size: 96, color: '#2b2620', weight: 800, line: 1.2 }); });

  ctx.tap(jar, () => choose(0)); ctx.tap(glb, () => choose(1)); ctx.tap(tok, () => { tokK.shim = 1; ctx.sfx.click?.(); });

  let idx = -1, now = 0, locked = true, nextAt = 3.2, fly = null, mistakes = 0, shake = 0, finished = false, nj = 0, ng = 0, tokK = { show: 0, shim: 0 };
  const tmpA = new THREE.Vector3(), tmpB = new THREE.Vector3();
  function nextItem() { idx++; if (idx >= ITEMS.length) return finish(); drawTok(ITEMS[idx][0]); locked = false; tokK.show = 0; ctx.ui.hud(`${toAr(idx + 1)} من ١٢`); ctx.sfx.whoosh?.(); }
  function choose(bin) {
    if (locked || idx < 0 || fly || now < 3) return;
    if (ITEMS[idx][1] === bin) {
      locked = true; ctx.sfx.good?.();
      fly = { t: 0, bin, from: tok.position.clone() };
    } else { mistakes++; shake = 1; ctx.sfx.bad?.(); ctx.ui.toast('جرّب الوعاء الآخر'); }
  }
  function land(bin) {
    if (bin === 0) { const c = coins[nj++]; if (c) { c.k = 0.001; c.m.visible = true; } ctx.fx.burst(g.position.clone().add(tmpA.copy(JAR).setY(0.2)), 0xffd27a, 18, 0.3, 0.03); jarGlow.userData.p = 1; }
    else { const s = sats[ng++]; if (s) { s.k = 0.001; s.m.visible = true; } ctx.fx.burst(g.position.clone().add(tmpA.copy(GLB).setY(0.2)), 0x9fdcff, 18, 0.3, 0.03); glbGlow.userData.p = 1; }
    fly = null; tokK.show = 0; tok.visible = false; nextAt = now + 0.9;
  }
  function finish() {
    finished = true; locked = true; tok.visible = true; drawTok('كل ميزة في مكانها'); ctx.ui.hud(mistakes ? `أخطأت ${toAr(mistakes)} مرات` : 'بلا أخطاء'); ctx.sfx.whoosh?.();
    ctx.fx.burst(g.position.clone().add(new THREE.Vector3(0, 0.32, 0)), 0xffe6a0, 50, 0.5, 0.04);
    ctx.ui.card({ tag: 'اكتمل الفرز', title: 'وفرٌ مادي وتحرّر من القيود', body: 'الفصل الافتراضي يوفّر القاعات والمواصلات والتجهيزات، ويتجاوز قيود المكان والزمن والعمر.', color: ORANGE }); ctx.ui.done();
  }
  drawTok('...'); ctx.ui.hud('اختر الوعاء المناسب');

  return {
    update(t, dt, e) {
      now = t; rise.update(t, e); hal.update(t, e); mo.update(t, dt, e);
      if (!finished && !fly && t > nextAt && (idx < 0 || locked)) { tok.visible = true; nextItem(); }
      shake = Math.max(0, shake - dt * 2.2); tokK.shim = Math.max(0, tokK.shim - dt * 2); tokK.show = Math.min(1, tokK.show + dt * 2.4);
      if (fly) {
        fly.t = Math.min(1, fly.t + dt / 0.75); const k = ease(fly.t);
        tmpB.copy(fly.bin ? GLB : JAR); tmpB.y = 0.24; tmpB.z += 0.0;
        tok.position.lerpVectors(fly.from, tmpB, k); tok.position.y += Math.sin(Math.PI * k) * 0.06; tok.scale.setScalar(Math.max(0.0001, 1.25 * (1 - 0.8 * k))); 
        if (fly.t >= 1) { tok.scale.setScalar(1.25); tok.position.set(0, 0.32, -0.06); land(fly.bin); }
      } else { tok.position.set(Math.sin(t * 60) * 0.006 * shake, 0.32 + Math.sin(t * 1.5) * 0.012, -0.06); tok.scale.setScalar(Math.max(0.0001, easeBack(tokK.show)) * e * 1.25); }
      tl.rotation.z = Math.sin(t * 55) * 0.05 * shake; tg.material.opacity = (0.12 + tokK.shim * 0.5) * e;
      coins.forEach((c) => { c.k = c.k > 0 ? Math.min(1, c.k + dt * 3) : 0; c.m.scale.setScalar(Math.max(0.0001, easeBack(c.k))); c.m.position.y = c.y + (1 - ease(c.k)) * 0.1 * (c.k > 0 ? 1 : 0); });
      jarGlow.userData.p = Math.max(0, (jarGlow.userData.p || 0) - dt * 1.2); jarGlow.material.opacity = jarGlow.userData.p * 0.6 * e;
      gc.rotation.y = t * 0.25; rings.forEach((r, i) => { r.rotation.z = t * (0.4 + i * 0.15); });
      sats.forEach((s) => { s.k = s.k > 0 ? Math.min(1, s.k + dt * 3) : 0; const a = t * s.sp + s.ph, R = 0.108 + s.ring * 0.008; tmpA.set(Math.cos(a) * R, Math.sin(a) * R, 0); tmpA.applyEuler(rings[s.ring].rotation); s.m.position.copy(tmpA); s.m.scale.setScalar(Math.max(0.0001, easeBack(s.k))); });
      glbGlow.userData.p = Math.max(0, (glbGlow.userData.p || 0) - dt * 1.2); glbGlow.material.opacity = glbGlow.userData.p * 0.6 * e;
    },
  };
}
