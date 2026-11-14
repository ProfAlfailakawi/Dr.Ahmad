import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { P, ease, easeBack, clamp01, stag, mat, glossy, goldMat, shadowed, glow, sprite, lightTube } from '../../kit.js?v=38';
import { inked } from '../../pencil.js?v=38';
import { Rig, hexCoin, retext, V, TAU } from '../lib/a5-kit.js?v=38';

export const meta = { free: true, center: [0.33, 0.8], typeLabel: 'لعبة: سباق الزمن' };

const toAr = (n) => String(n).replace(/\d/g, (d) => '٠١٢٣٤٥٦٧٨٩'[d]);
const EV = [
  { t: 'خوذة', y: '1968', k: 'eye', c: 0x5a6fd6 },
  { t: 'Videoplace', y: '1975', k: 'person', c: 0xef8f2a },
  { t: 'مصطلح', y: '1990', k: 'plus', c: 0x2fa38a },
  { t: 'تعقّب', y: '1994', k: 'tower', c: 0xe0452c },
  { t: 'حاسب', y: 'أواخر التسعينيات', k: 'screen', c: 0x2a8fd0 },
  { t: 'نقّال', y: '2008', k: 'wifi', c: 0xe3b23c },
];
const PERM = [3, 0, 5, 2, 4, 1];
const RAIL_Z = 0.19, RAIL_X0 = 0.21, DX = 0.084;
const station = (i) => V(RAIL_X0 - i * DX, 0.03, RAIL_Z);
const hexc = (c) => '#' + c.toString(16).padStart(6, '0');

function screenTex() {
  const c = document.createElement('canvas'); c.width = 512; c.height = 256; const g = c.getContext('2d');
  const gr = g.createLinearGradient(0, 0, 0, 256); gr.addColorStop(0, '#9be06b'); gr.addColorStop(1, '#4fb04a'); g.fillStyle = gr; g.fillRect(0, 0, 512, 256);
  g.strokeStyle = 'rgba(255,255,255,.18)'; g.lineWidth = 2; for (let i = 0; i < 16; i++) { g.beginPath(); g.moveTo(i * 34, 0); g.lineTo(i * 34, 256); g.stroke(); } for (let j = 0; j < 8; j++) { g.beginPath(); g.moveTo(0, j * 34); g.lineTo(512, j * 34); g.stroke(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

export default function build(ctx) {
  const g = new THREE.Group(); g.position.copy(P(meta.center[0], meta.center[1])); g.scale.setScalar(1.08); g.position.x += 0.11; g.position.z -= 0.11; ctx.stage.add(g);
  const rig = new Rig(ctx);

  // phone
  const phone = inked(new RoundedBoxGeometry(0.62, 0.022, 0.36, 4, 0.03), { color: 0x2b3038 }); phone.position.y = 0.011; g.add(phone); rig.ink(phone, 0.1, 1.2);
  const scr = new THREE.Mesh(new RoundedBoxGeometry(0.56, 0.004, 0.3, 2, 0.01), new THREE.MeshStandardMaterial({ map: screenTex(), emissive: 0x9be06b, emissiveIntensity: 0.18, roughness: 0.4 })); scr.position.set(-0.01, 0.0235, -0.015); g.add(scr);
  const home = new THREE.Mesh(new THREE.TorusGeometry(0.012, 0.002, 8, 24), mat(0xaeb6c0)); home.rotation.x = Math.PI / 2; home.position.set(0.265, 0.024, 0.0); g.add(home);

  // hologram desk
  const holo = new THREE.Group(); holo.position.set(0, 0.025, -0.02); g.add(holo);
  const wood = glossy(0xe09a55, { roughness: 0.4 });
  const top = new THREE.Mesh(new RoundedBoxGeometry(0.14, 0.01, 0.075, 2, 0.003), wood); top.position.y = 0.065; holo.add(shadowed(top));
  const drawers = new THREE.Mesh(new RoundedBoxGeometry(0.05, 0.06, 0.07, 2, 0.003), wood); drawers.position.set(-0.04, 0.03, 0); holo.add(shadowed(drawers));
  [0.012, 0.03, 0.048].forEach((y) => { const h = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.003, 0.002), goldMat()); h.position.set(-0.04, y, 0.036); holo.add(h); });
  const leg = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.06, 0.07), wood); leg.position.set(0.062, 0.03, 0); holo.add(leg);
  const mon = new THREE.Mesh(new RoundedBoxGeometry(0.05, 0.036, 0.004, 2, 0.002), glossy(0x1e2430)); mon.position.set(0.0, 0.1, -0.012); mon.rotation.x = -0.1; holo.add(mon);
  const mscr = new THREE.Mesh(new THREE.PlaneGeometry(0.044, 0.03), new THREE.MeshBasicMaterial({ color: 0x9fe0ff, toneMapped: false })); mscr.position.set(0, 0.1, -0.0098); mscr.rotation.x = -0.1; mscr.rotation.y = Math.PI; holo.add(mscr);
  const stand = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.025, 8), mat(0x555)); stand.position.set(0, 0.082, -0.012); holo.add(stand);
  const chair = new THREE.Group(); chair.position.set(0.07, 0, 0.065); holo.add(chair);
  const red = glossy(0xd9362c); const seat = new THREE.Mesh(new RoundedBoxGeometry(0.036, 0.008, 0.036, 2, 0.003), red); seat.position.y = 0.04; chair.add(shadowed(seat));
  const back = new THREE.Mesh(new RoundedBoxGeometry(0.034, 0.05, 0.006, 2, 0.003), red); back.position.set(0, 0.07, 0.018); back.rotation.x = 0.15; chair.add(shadowed(back));
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.003, 0.003, 0.04, 8), mat(0x444)); pole.position.y = 0.02; chair.add(pole);
  const star = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.003, 5), mat(0x444)); star.position.y = 0.002; chair.add(star);
  const hr = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.0025, 8, 64), new THREE.MeshBasicMaterial({ color: 0x9fe0ff, transparent: true, opacity: 0.7, toneMapped: false, blending: THREE.AdditiveBlending, depthWrite: false })); hr.rotation.x = Math.PI / 2; holo.add(hr);
  const hcone = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.14, 40, 1, true), new THREE.MeshBasicMaterial({ color: 0x9fe0ff, transparent: true, opacity: 0.07, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false })); hcone.position.y = 0.07; holo.add(hcone);

  // rail of time
  const railPts = [station(0), station(5)]; const rc = new THREE.CatmullRomCurve3([V(RAIL_X0 + 0.04, 0.03, RAIL_Z), V(RAIL_X0 - 5 * 0.084 - 0.04, 0.03, RAIL_Z)]);
  const rail = lightTube(rc, { radius: 0.004, color: 0x9fe0ff, speed: 0.4 }); g.add(rail);
  const dots = EV.map((_, i) => { const d = new THREE.Mesh(new THREE.TorusGeometry(0.015, 0.0025, 6, 24), goldMat()); d.rotation.x = Math.PI / 2; d.position.copy(station(i)); g.add(d); return d; });
  const marker = new THREE.Mesh(new THREE.OctahedronGeometry(0.014), new THREE.MeshBasicMaterial({ color: 0xffd27a, toneMapped: false })); g.add(marker);
  const mglow = glow(0xffd27a, 0.1, 0.8); marker.add(mglow);

  // event coins on an arc behind
  const toks = EV.map((ev, ci) => { const pos = PERM.indexOf(ci); return { ev, ci, pos }; }).map((o) => {
    const th = Math.PI * (0.1 + 0.8 * (o.pos / 5)); const x = Math.cos(th) * 0.25, y = 0.12 + (o.pos % 2) * 0.14, z = -0.1 - Math.sin(th) * 0.09 - 0.0;
    const grp = new THREE.Group(); const coin = hexCoin(o.ev.k, o.ev.c, 0.04, 0.015); coin.rotation.x = Math.PI / 2 * 0.7; grp.add(coin);
    const lab = sprite(o.ev.t, 0.15, { size: 70, width: 340, weight: 800, border: hexc(o.ev.c) }); lab.userData.w = 0.15; lab.position.y = 0.065; grp.add(lab);
    grp.position.set(x, y, z); g.add(grp);
    return { ...o, grp, coin, lab, home: grp.position.clone(), st: 'idle', t0: -9, w: 0.15 };
  });

  let next = 0, placed = 0, now = 0, finished = false;
  toks.forEach((o) => rig.touch(o.grp, (hh) => {
    if (o.st !== 'idle') return;
    if (o.ci === next) { o.st = 'fly'; o.t0 = now; next++; ctx.sfx.good?.(); ctx.fx.burst(o.grp.position.clone(), o.ev.c, 22, 0.35, 0.03); hh.on = false; ctx.ui.hud(next < EV.length ? 'أحسنت، ما الأقرب بعده؟' : 'اكتمل السباق'); }
    else { o.st = 'shake'; o.t0 = now; ctx.sfx.bad?.(); ctx.ui.hud('سبقه حدث أقدم'); }
  }, { color: o.ev.c, size: 0.17, show: 3 + o.pos * 0.2 }));
  rig.touch(holo, (hh) => {
    ctx.sfx.pop?.(); hh.on = false; ctx.ui.card({ tag: 'التعرف', title: 'طريقتان للتعرّف', body: 'علامات تلتقطها الكاميرا وتميّزها، أو دون علامات بالاعتماد على موقع الكاميرا الجغرافي.', color: 0x2fa38a });
  }, { color: 0x9fe0ff, size: 0.2, at: V(0, 0.07, 0), show: 6.2 });
  ctx.ui.hud('اضغط الأقدم أولاً، ثم الأحدث');

  return {
    update(t, dt, e) {
      now = t; rig.update(t, dt, e);
      const sk = stag(t, 0.3, 0.9, easeBack) * e; holo.scale.setScalar(Math.max(sk, 0.001)); holo.rotation.y = t * 0.35;
      hr.position.y = 0.02 + (t * 0.08 % 1) * 0.12; hr.material.opacity = 0.6 * (1 - (t * 0.08 % 1)) * sk;
      hcone.material.opacity = 0.06 * sk;
      rail.userData.fill(stag(t, 0.5, 1.0, clamp01) * e); rail.userData.update(dt);
      dots.forEach((d, i) => { d.scale.setScalar(Math.max(stag(t, 0.8 + i * 0.1, 0.5, easeBack) * e, 0.001)); });
      const mp = next >= EV.length ? station(EV.length - 1) : station(next); marker.position.lerp(mp.clone().setY(0.07 + Math.sin(t * 3) * 0.008), Math.min(1, dt * 5)); marker.rotation.y = t * 2; marker.visible = next < EV.length && t > 1.5; mglow.material.opacity = 0.7 + 0.2 * Math.sin(t * 4);
      toks.forEach((o) => {
        const p = stag(t, 1.0 + o.pos * 0.25, 0.8, easeBack) * e; const el = now - o.t0;
        if (o.st === 'idle') { o.grp.position.set(o.home.x, o.home.y + Math.sin(t * 1.3 + o.pos) * 0.008, o.home.z); o.grp.scale.setScalar(Math.max(p, 0.0001)); o.coin.rotation.y = t * 0.8 + o.pos; }
        else if (o.st === 'shake') { o.grp.position.set(o.home.x + Math.sin(el * 55) * 0.012 * (1 - el / 0.5), o.home.y, o.home.z); if (el > 0.5) o.st = 'idle'; }
        else if (o.st === 'fly') {
          const k = clamp01(el / 1.0), S = station(o.ci).setY(0.05);
          o.grp.position.lerpVectors(o.home, S, ease(k)); o.grp.position.y += Math.sin(k * Math.PI) * 0.1; o.grp.scale.setScalar(1 - 0.25 * ease(k)); o.coin.rotation.y += dt * 6 * (1 - k);
          if (k > 0.5 && !o.swapped) { o.swapped = true; retext(o.lab, o.ev.y === 'أواخر التسعينيات' ? o.ev.y : toAr(o.ev.y), 0.08, { size: 58, width: o.ev.y.length > 5 ? 420 : 240, weight: 800, border: hexc(o.ev.c) }); o.w = o.ev.y.length > 5 ? 0.12 : 0.075; o.lab.userData.w = o.w; o.lab.position.y = 0.06; }
          if (k >= 1) { o.st = 'done'; placed++; if (placed >= EV.length && !finished) { finished = true; setTimeout(() => { ctx.ui.card({ tag: 'تسلسل الزمن', title: 'كل تطوير جاء بعد ما سبقه', body: 'من أول شاشة على الرأس إلى التطبيقات النقالة: مسار واحد بُنيت محطاته بعضها على بعض.', color: 0x2fa38a }); ctx.ui.done(); }, 900); } }
        } else if (o.st === 'done') { o.grp.position.copy(station(o.ci)).setY(0.05 + Math.sin(t * 1.5 + o.ci) * 0.004); o.coin.rotation.y = 0; o.coin.rotation.x = Math.PI / 2 * 0.0; }
        o.lab.scale.set(o.lab.userData.w * Math.max(p, 0.0001), o.lab.userData.w * o.lab.userData.aspect * Math.max(p, 0.0001), 1);
      });
    },
  };
}
