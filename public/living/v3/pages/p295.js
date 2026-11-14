// p295 (round 4): a floating VR headset whose visor shows one claim at a time. Tap the green orb for fact, the red orb for illusion.
// Seven claims, three are illusions: catching one cracks the visor and lights a red crystal on the arc behind.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { P, ease, easeBack, clamp01, stag, mat, glossy, goldMat, shadowed, glow, sprite } from '../../kit.js?v=35';
import { rising, halos, motes, blob, dais, screen, paintText, TAU, toAr } from '../lib/b4-kit.js?v=35';

export const meta = { free: true, center: [0.5, 0.36], typeLabel: 'لعبة فحص', title: 'ما الحقيقة وما الوهم؟' };

const CLAIMS = [
  { t: 'قوة ردود الفعل اللمسية تعطي شعوراً بظروف البيئة الحقيقية', wrong: false },
  { t: 'الحضور عن بعد ممكن بلوحة المفاتيح والفأرة أو بالقفازات والمجسّات', wrong: false },
  { t: 'بيئة المحاكاة يجب أن تطابق العالم الحقيقي تماماً', wrong: true, fix: 'بيئة المحاكاة لا تشبه العالم الحقيقي؛ هي عوالم وهمية تولّدها الأرقام والرموز.' },
  { t: 'محاكاة الطيران الحية تنشأ من تطابق البيئة مع الطائرة', wrong: true, fix: 'تنشأ التجربة من خداع الحواس ومؤثرات التفاعل الرقمية، لا من تطابق البيئة مع الواقع.' },
  { t: 'التعليم الافتراضي يضيف قيمة على الطرق التقليدية', wrong: false },
  { t: 'التعليم الافتراضي لا يحتاج إلى شبكة الإنترنت', wrong: true, fix: 'التعليم الافتراضي نوع من التعليم الإلكتروني يتيح التواصل والتدريب عن طريق شبكة الإنترنت.' },
  { t: 'كلما زادت التجربة تحسّن الأداء والنتائج', wrong: false },
];
const ORDER = [2, 0, 1, 5, 4, 3, 6];
const NAVY = 0x25304f, GREEN = 0x35c27a, RED = 0xe8404a, CYAN = 0x6fd4ff;

export default function build(ctx) {
  const g = new THREE.Group(); g.position.copy(P(meta.center[0], meta.center[1])); ctx.stage.add(g);
  const rise = rising(), hal = halos(), mo = motes(g, 22, { r: 0.4, h: 0.6, color: 0xbfe6ff });
  const sh = blob(0.4, 0.34); sh.position.y = -0.02; g.add(sh);
  const base = dais(0.4, { top: NAVY, under: 0x141b2e }); rise.add(base, 0.05, 0.1, 0.9); g.add(base);
  const ringB = new THREE.Mesh(new THREE.TorusGeometry(0.33, 0.004, 8, 96), new THREE.MeshBasicMaterial({ color: CYAN, toneMapped: false })); ringB.rotation.x = Math.PI / 2; ringB.position.y = 0.032; g.add(ringB);
  const ringC = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.003, 8, 96), new THREE.MeshBasicMaterial({ color: 0x3d7bd8, toneMapped: false })); ringC.rotation.x = Math.PI / 2; ringC.position.y = 0.032; g.add(ringC);

  // ---- headset
  const hs = new THREE.Group(); hs.position.set(0, 0.29, -0.02); hs.scale.setScalar(1.28); g.add(hs);
  const lean = new THREE.Group(); lean.rotation.x = -0.45; hs.add(lean);
  const body = new THREE.Mesh(new RoundedBoxGeometry(0.34, 0.17, 0.17, 5, 0.06), glossy(0xeef1f7, { clearcoat: 0.9, roughness: 0.25 })); lean.add(body);
  const plate = new THREE.Mesh(new RoundedBoxGeometry(0.3, 0.136, 0.016, 4, 0.03), glossy(0x0a0f1a, { clearcoat: 1, roughness: 0.1 })); plate.position.z = 0.085; lean.add(plate);
  const trimG = new THREE.Mesh(new THREE.TorusGeometry(0.0, 0.0, 3, 3), goldMat());
  [[0, 0.07, 0.31, 0.006], [0, -0.07, 0.31, 0.006]].forEach(([x, y, w, h]) => { const b = new THREE.Mesh(new RoundedBoxGeometry(w, h, 0.01, 2, 0.003), goldMat()); b.position.set(x, y, 0.09); lean.add(b); });
  [[-0.155, 0], [0.155, 0]].forEach(([x]) => { const b = new THREE.Mesh(new RoundedBoxGeometry(0.006, 0.136, 0.01, 2, 0.003), goldMat()); b.position.set(x, 0, 0.09); lean.add(b); const hing = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.02, 16), goldMat()); hing.rotation.z = Math.PI / 2; hing.position.set(Math.sign(x) * 0.176, 0, -0.02); lean.add(hing); });
  const strap = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.012, 10, 48), glossy(0x9aa6bd, { clearcoat: 0.4 })); strap.rotation.x = Math.PI / 2; strap.scale.set(1.7, 2.1, 1); strap.position.set(0, 0, -0.2); lean.add(strap);
  const vis = screen(0.28, 0.12, 768); vis.mesh.position.z = 0.0935; lean.add(vis.mesh);
  const vglow = glow(CYAN, 0.5, 0.35); vglow.position.z = 0.1; lean.add(vglow);
  shadowed(hs); rise.add(hs, 0.4, 0.2, 1.0); hs.scale.setScalar(1.28);
  hal.add(lean, 0xbfe6ff, 0.5, [0, 0, 0.1], 5);

  // ---- progress arc behind
  const gems = CLAIMS.map((c, i) => {
    const a = (i - 3) * 0.42; const m = new THREE.Mesh(new THREE.OctahedronGeometry(0.024, 0), glossy(0x7d8aa6, { clearcoat: 0.6 }));
    m.position.set(Math.sin(a) * 0.3, 0.07, -Math.cos(a) * 0.3); m.scale.y = 1.35; g.add(m);
    const gl = glow(0xffd27a, 0.1, 0); gl.position.copy(m.position); g.add(gl); m.castShadow = true;
    rise.add(m, 1.2 + i * 0.08, 0.06, 0.6); return { m, gl, state: 0, k: 0 };
  });

  // ---- the two orbs
  const mkOrb = (x, col, word) => {
    const grp = new THREE.Group(); grp.position.set(x, 0.04, 0.27); g.add(grp);
    const stand = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.04, 0.03, 28), goldMat()); stand.position.y = 0.012; grp.add(stand);
    const orb = new THREE.Mesh(new THREE.SphereGeometry(0.052, 36, 28), glossy(col, { emissive: col, emissiveIntensity: 0.55, clearcoat: 1, roughness: 0.15 })); orb.position.y = 0.07; grp.add(orb);
    const lab = sprite(word, 0.15, { size: 60, width: 340, weight: 800, bg: 'rgba(255,253,247,.97)', color: col === RED ? '#b3202b' : '#1d7a48', radius: 36 }); lab.position.y = 0.17; grp.add(lab);
    const gl = glow(col, 0.2, 0.0); gl.position.y = 0.07; grp.add(gl);
    shadowed(grp); rise.add(grp, 1.5, 0.12, 0.7);
    const hh = hal.add(grp, col, 0.22, [0, 0.07, 0], 4.2);
    return { grp, orb, gl, hh, kick: 0 };
  };
  const orbNo = mkOrb(-0.2, RED, 'وهم'), orbYes = mkOrb(0.2, GREEN, 'حقيقة');
  ctx.tap(orbNo.grp, () => answer(true)); ctx.tap(orbYes.grp, () => answer(false)); ctx.tap(lean, () => { if (now > 3) { ctx.sfx.click?.(); ctx.ui.hud('عبارة أمامك: حقيقة أم وهم؟'); } });

  let idx = -1, now = 0, locked = true, nextAt = 3.2, found = 0, cracked = 0, flash = 0, flashCol = CYAN, shake = 0, solved = 0, finished = false, glitch = 0;
  function draw(text, col = '#ffffff') {
    vis.draw((c, w, h) => {
      const gr = c.createLinearGradient(0, 0, w, h); gr.addColorStop(0, '#102446'); gr.addColorStop(1, '#0a1630'); c.fillStyle = gr; c.fillRect(0, 0, w, h);
      c.strokeStyle = 'rgba(111,212,255,.18)'; c.lineWidth = 2; for (let x = 0; x < w; x += 48) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x, h); c.stroke(); } for (let y = 0; y < h; y += 48) { c.beginPath(); c.moveTo(0, y); c.lineTo(w, y); c.stroke(); }
      paintText(c, text, w / 2, h / 2, w * 0.86, h * 0.72, { size: 92, color: col, weight: 800, line: 1.25 });
    });
  }
  function crackDraw(text) {
    draw(text, '#ffd5d8');
    const c = vis.g, w = vis.cw, h = vis.ch; c.strokeStyle = 'rgba(255,255,255,.95)'; c.lineWidth = 5; c.beginPath();
    const cx = w * 0.5, cy = h * 0.45; for (let k = 0; k < 9; k++) { const a = k / 9 * TAU + 0.3; let x = cx, y = cy; c.moveTo(x, y); for (let s = 0; s < 4; s++) { a; x += Math.cos(a + (s % 2 ? 0.25 : -0.2)) * (50 + k * 6); y += Math.sin(a + (s % 2 ? 0.25 : -0.2)) * (40 + k * 4); c.lineTo(x, y); } } c.stroke(); vis.tex.needsUpdate = true;
  }
  function nextClaim() {
    idx++; ctx.ui.hideCard();
    if (idx >= CLAIMS.length) return finish();
    draw(CLAIMS[ORDER[idx]].t); locked = false; ctx.ui.hud(`عبارة ${toAr(idx + 1)} من ٧`); flash = 0.7; flashCol = CYAN; ctx.sfx.whoosh?.();
  }
  function answer(sayWrong) {
    if (locked || idx < 0 || now < 3) return;
    const cl = CLAIMS[ORDER[idx]]; const orb = sayWrong ? orbNo : orbYes; orb.kick = 1; ctx.sfx.pop?.();
    if (sayWrong === cl.wrong) {
      locked = true; solved++; const gm = gems[idx]; gm.state = cl.wrong ? 2 : 1;
      if (cl.wrong) {
        found++; crackDraw(cl.t); shake = 1; flash = 1; flashCol = RED; ctx.sfx.good?.(); ctx.fx.burst(g.position.clone().add(new THREE.Vector3(0, 0.32, 0.1)), 0xbfe6ff, 40, 0.5, 0.03); ctx.fx.burst(g.position.clone().add(new THREE.Vector3(0, 0.32, 0.1)), RED, 16, 0.3, 0.03);
        ctx.ui.card({ tag: 'وهمٌ انكشف', title: 'هذه العبارة خاطئة', body: cl.fix, color: RED }); nextAt = now + 5.2;
      } else { flash = 0.9; flashCol = GREEN; ctx.sfx.good?.(); ctx.fx.burst(g.position.clone().add(new THREE.Vector3(0, 0.3, 0.12)), GREEN, 20, 0.3, 0.03); ctx.ui.toast('صحيح، عبارة سليمة'); nextAt = now + 1.7; }
    } else {
      glitch = 1; flash = 0.8; flashCol = RED; ctx.sfx.bad?.(); ctx.ui.toast(cl.wrong ? 'تأمّل مرة أخرى، فيها وهم' : 'هذه عبارة سليمة'); ctx.fx.burst(g.position.clone().add(new THREE.Vector3(orb === orbNo ? -0.2 : 0.2, 0.12, 0.27)), RED, 8, 0.2, 0.02);
    }
  }
  function finish() {
    locked = true; if (finished) return; finished = true; draw('وجدت الأوهام الثلاثة', '#ffe6a0'); flash = 1; flashCol = 0xffd27a; ctx.ui.hud('انكشفت الأوهام الثلاثة');
    ctx.sfx.whoosh?.(); ctx.fx.burst(g.position.clone().add(new THREE.Vector3(0, 0.3, 0)), 0xffe6a0, 50, 0.5, 0.04);
    ctx.ui.card({ tag: 'اكتمل الفحص', title: 'الواقع الافتراضي خداع للحواس', body: 'المحاكاة لا تطابق الواقع، وتجربتها الحية تنشأ من خداع الحواس ومؤثرات التفاعل الرقمية.', color: 0x3d7bd8 }); ctx.ui.done();
  }
  draw('جاهز؟', '#9fdcff');
  ctx.ui.hud('حقيقة أم وهم؟');
  const cm = new THREE.Color();

  return {
    update(t, dt, e) {
      now = t; rise.update(t, e); hal.update(t, e); mo.update(t, dt, e);
      if (idx < 0 && t > nextAt) nextClaim(); else if (idx >= 0 && locked && !finished && t > nextAt) nextClaim();
      flash = Math.max(0, flash - dt * 1.6); shake = Math.max(0, shake - dt * 1.8); glitch = Math.max(0, glitch - dt * 2.5);
      hs.position.y = 0.29 + Math.sin(t * 1.4) * 0.012; hs.rotation.y = Math.sin(t * 0.5) * 0.18 + Math.sin(t * 60) * 0.02 * shake + (glitch ? Math.sin(t * 70) * 0.03 * glitch : 0);
      lean.rotation.z = Math.sin(t * 55) * 0.03 * shake;
      cm.setHex(flashCol); vglow.material.color.copy(cm); vglow.material.opacity = (0.22 + flash * 0.6) * e; vglow.scale.setScalar(0.5 + flash * 0.12);
      ringB.rotation.z = t * 0.2; ringC.rotation.z = -t * 0.3;
      [orbNo, orbYes].forEach((o) => { o.kick = Math.max(0, o.kick - dt * 3); o.orb.scale.setScalar(1 + o.kick * 0.25 + Math.sin(t * 2.6) * 0.02); o.grp.position.y = 0.04 + Math.sin(t * 1.8 + (o === orbNo ? 0 : 2)) * 0.004 + o.kick * 0.02; o.gl.material.opacity = (0.3 + o.kick * 0.5) * e; o.gl.scale.setScalar(0.2 + o.kick * 0.1); o.hh.on = locked ? 0.2 : 1; });
      gems.forEach((gm, i) => {
        gm.k = THREE.MathUtils.damp(gm.k, gm.state ? 1 : 0, 6, dt);
        const c = gm.state === 2 ? RED : gm.state === 1 ? 0xffd27a : 0x7d8aa6; gm.m.material.color.setHex(c); gm.m.material.emissive.setHex(gm.state ? c : 0x000000); gm.m.material.emissiveIntensity = gm.state ? 0.7 : 0;
        gm.m.rotation.y = t * 0.8 + i; gm.gl.material.color.setHex(c); gm.gl.material.opacity = gm.k * (0.5 + 0.2 * Math.sin(t * 3 + i)) * e;
        gm.m.position.y = 0.07 + gm.k * 0.014 + Math.sin(t * 1.5 + i) * 0.003 * gm.k;
      });
    },
  };
}
