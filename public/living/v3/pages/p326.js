import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { P, ease, easeBack, clamp01, stag, mat, glossy, goldMat, shadowed, glow, sprite, lightTube } from '../../kit.js?v=26';
import { inked } from '../../pencil.js?v=26';
import { TAU, revealer, bumper, canvasTex, faceMat, fillText, hintGlow, pulseHint, setSpr, burstAt } from '../lib/a6-kit.js?v=26';

export const meta = { free: true, center: [0.47, 0.7], typeLabel: 'مجسّم يتفكك' };

const SPOTS = [
  { k: 'tool', w: 'شريط الأدوات', c: 0xe0603f, b: 'أدوات التحكم على جانب الشاشة لإدارة المحتوى؛ وما يكتبه المدرس يُحفظ في ذاكرة السبورة ويمكن محوه بممحاة إلكترونية.' },
  { k: 'data', w: 'بيانات من الحاسب', c: 0x2a8fd0, b: 'السبورة مجهزة للاتصال بالحاسب وأجهزة العرض، وبمجرد توصيلها تتحول في ثوانٍ إلى شاشة كمبيوتر عملاقة عالية الوضوح.' },
  { k: 'pie', w: 'مخطط دائري', c: 0x4aa84f, b: 'يمكن عرض صورة من الحاسب أو الإنترنت، وحفظها فوراً في ذاكرة السبورة ونقلها إلى حاسبات الطلاب إن أرادوا.' },
  { k: 'bars', w: 'أعمدة بيانية', c: 0xb5489a, b: 'استخدام معظم برامج مايكروسوفت أوفيس يثري المادة العلمية بإضافة أبعاد ومؤثرات، فتُعرض بأساليب مثيرة ومشوقة.' },
  { k: 'def', w: 'تعريف السبورة', c: 0x2b3a67, b: 'نوع من البرمجيات التعليمية: تعليمات موجّهة إلى الكمبيوتر توضح تسلسل الخطوات لحل مشكلة والوصول إلى نتائج معينة (قنديل، ١٩٩٩).' },
];
const hx = (c) => '#' + c.toString(16).padStart(6, '0');
const BX = -0.07; // board centre x
const MY = 0.33, BW = 0.5, BH = 0.34, ZF = 0.0155;

export default function build(ctx) {
  const g = new THREE.Group(); g.position.copy(P(meta.center[0], meta.center[1])); g.scale.setScalar(1.25); ctx.stage.add(g);
  const R = revealer(), B = bumper();

  const sh1 = new THREE.Mesh(new THREE.CircleGeometry(0.3, 40), new THREE.MeshBasicMaterial({ color: 0x1b2540, transparent: true, opacity: 0.13, depthWrite: false })); sh1.rotation.x = -Math.PI / 2; sh1.scale.set(1.25, 1, 0.5); sh1.position.set(BX, 0.002, 0.02); g.add(sh1);
  const sh2 = sh1.clone(); sh2.scale.set(0.45, 1, 0.3); sh2.position.set(0.3, 0.002, 0.1); g.add(sh2);
  const under = { scale: { setScalar() {} } }, edge = under;

  // stand
  const stand = new THREE.Group(); stand.position.set(BX, 0, 0); g.add(stand);
  [-0.19, 0.19].forEach((x, i) => {
    const up = inked(new RoundedBoxGeometry(0.018, 0.2, 0.018, 2, 0.004), { color: 0xcfd6dc }); up.position.set(x, 0.1, -0.01); stand.add(up); R.add(up, 0.5 + i * 0.1, 0.9);
    const ft = inked(new RoundedBoxGeometry(0.03, 0.014, 0.24, 2, 0.005), { color: 0xcfd6dc }); ft.position.set(x, 0.007, 0.0); stand.add(ft); R.add(ft, 0.4 + i * 0.1, 0.9);
  });
  const crossbar = inked(new RoundedBoxGeometry(0.4, 0.014, 0.014, 2, 0.003), { color: 0xcfd6dc }); crossbar.position.set(0, 0.11, -0.01); stand.add(crossbar); R.add(crossbar, 0.8, 0.8);

  // board
  const board = new THREE.Group(); board.position.set(BX, MY - 0.02, 0); g.add(board);
  const frame = inked(new RoundedBoxGeometry(BW, BH, 0.03, 4, 0.012), { color: 0xd9dee2 }); board.add(frame); R.add(frame, 0.6, 1.2);
  const screenTex = canvasTex(512, 320, (c, w, h) => {
    const gr = c.createLinearGradient(0, 0, w, h); gr.addColorStop(0, '#ffffff'); gr.addColorStop(1, '#e6eef4'); c.fillStyle = gr; c.fillRect(0, 0, w, h);
    c.fillStyle = '#c8d2da'; for (let i = 0; i < 7; i++) c.fillRect(268, 190 + i * 15, 190 - (i % 3) * 30, 6);
    c.strokeStyle = '#dfe7ed'; c.lineWidth = 2; c.strokeRect(6, 6, w - 12, h - 12);
  });
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(BW - 0.04, BH - 0.05), faceMat(screenTex, { transparent: true, opacity: 0 }));
  screen.position.z = ZF + 0.0005; board.add(screen);
  const tray = new THREE.Mesh(new RoundedBoxGeometry(0.26, 0.012, 0.03, 2, 0.004), mat(0xc0c8ce)); tray.position.set(0, -BH / 2 - 0.004, 0.012); board.add(tray);
  const back = inked(new RoundedBoxGeometry(BW * 0.74, BH * 0.7, 0.024, 3, 0.01), { color: 0xc9d0d6 }); back.position.z = -0.026; board.add(back); R.add(back, 0.9, 1);
  const logo = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.004, 24), goldMat()); logo.rotation.x = Math.PI / 2; logo.position.z = -0.04; board.add(logo);

  // parts
  const parts = {};
  const mk = (key, x, y, z = ZF) => {
    const sp = SPOTS.find((s) => s.k === key);
    const holder = new THREE.Group(); holder.position.set(x, y, z); board.add(holder);
    const inner = new THREE.Group(); holder.add(inner);
    const hint = hintGlow(sp.c, 0.16); hint.position.z = 0.012; inner.add(hint);
    const lab = sprite(sp.w, 0.19, { size: 40, width: 360, weight: 800, border: hx(sp.c), color: '#2b2620', bg: 'rgba(251,248,240,.97)' });
    const p = { sp, holder, inner, hint, lab, rest: holder.position.clone(), pop: 0, want: 0, landed: false };
    parts[key] = p; return p;
  };
  // toolbar: round buttons in a column on the left edge
  const tool = mk('tool', -BW / 2 + 0.037, 0, ZF);
  const toolBody = new THREE.Mesh(new RoundedBoxGeometry(0.044, 0.25, 0.012, 2, 0.006), glossy(0x2b3342)); toolBody.position.z = 0.004; tool.inner.add(toolBody);
  const tcols = [0xffffff, 0xffffff, 0xffffff, 0xffffff, 0xffffff, 0x7fe08c];
  for (let i = 0; i < 6; i++) {
    const b = new THREE.Mesh(new THREE.CylinderGeometry(0.0145, 0.0145, 0.008, 20), new THREE.MeshStandardMaterial({ color: tcols[i], emissive: i === 5 ? 0x2a8a45 : 0x888888, emissiveIntensity: 0.4, roughness: 0.3 }));
    b.rotation.x = Math.PI / 2; b.position.set(0, 0.098 - i * 0.04, 0.011); tool.inner.add(b);
  }
  tool.hint.position.set(0, 0, 0.02);
  // table slab
  const data = mk('data', -0.07, 0.085);
  const tTex = canvasTex(256, 128, (c, w, h) => {
    c.fillStyle = '#f4f9fd'; c.fillRect(0, 0, w, h); c.font = '600 13px Tajawal, monospace'; c.fillStyle = '#2a5f8f'; c.textAlign = 'center';
    for (let r = 0; r < 6; r++) { c.fillStyle = r % 2 ? '#dbeaf6' : '#eef6fc'; c.fillRect(0, r * 21, w, 21); c.fillStyle = '#2a5f8f'; for (let k = 0; k < 6; k++) c.fillText(String(Math.floor(((r * 7 + k * 13) % 29) * 97 / 3 + 120)), 22 + k * 42, r * 21 + 15); }
  });
  const slabD = new THREE.Mesh(new RoundedBoxGeometry(0.2, 0.1, 0.008, 2, 0.003), [mat(0xbcd2e4), mat(0xbcd2e4), mat(0xbcd2e4), mat(0xbcd2e4), faceMat(tTex), mat(0xbcd2e4)]);
  slabD.position.z = 0.004; data.inner.add(slabD);
  // pie, extruded
  const pie = mk('pie', 0.115, 0.04);
  const wedges = [[0.35, 0x2f3f9a], [0.25, 0xf2e035], [0.2, 0xe0463a], [0.2, 0x3fae4f]];
  let a0 = 0; const pieG = new THREE.Group(); pieG.rotation.x = Math.PI / 2; pie.inner.add(pieG); pieG.position.z = 0.012;
  wedges.forEach(([f, c]) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.022, 28, 1, false, a0, TAU * f), glossy(c)); pieG.add(m); a0 += TAU * f; });
  pie.pieG = pieG; shadowed(pieG);
  // bars
  const bars = mk('bars', -0.115, -0.1);
  const bcols = [0xe0463a, 0xf2b630, 0x7fd0f0, 0x2f3f9a, 0xb5489a], bh = [0.05, 0.035, 0.075, 0.11, 0.125];
  const barMeshes = bcols.map((c, i) => { const m = new THREE.Mesh(new RoundedBoxGeometry(0.026, 1, 0.026, 2, 0.004), glossy(c)); m.position.set(-0.06 + i * 0.034 + 0.01, 0, 0.014); bars.inner.add(m); return m; });
  bars.hint.position.set(0, 0.04, 0.03);
  // definition medallion floating above the board
  const def = mk('def', 0.14, BH / 2 + 0.085, 0.03);
  const medal = new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.036, 0.01, 32), goldMat()); medal.rotation.x = Math.PI / 2; def.inner.add(medal);
  const mface = new THREE.Mesh(new THREE.CircleGeometry(0.03, 32), faceMat(canvasTex(128, 128, (c) => { c.fillStyle = '#2b3a67'; c.fillRect(0, 0, 128, 128); fillText(c, '؟', 64, 70, 100, '#ffe9a8', 800, '"Reem Kufi", Tajawal'); })));
  mface.position.z = 0.0055; def.inner.add(mface);
  const medalBack = new THREE.Mesh(new THREE.CircleGeometry(0.03, 32), mat(0x2b3a67)); medalBack.rotation.y = Math.PI; medalBack.position.z = -0.0055; def.inner.add(medalBack);

  // laptop on the floor and a light cable into the back of the board
  const lap = new THREE.Group(); lap.position.set(0.3, 0.0, 0.1); lap.rotation.y = -0.4; g.add(lap);
  const lbase = inked(new RoundedBoxGeometry(0.15, 0.01, 0.1, 2, 0.004), { color: 0xe9e6df }); lbase.position.y = 0.005; lap.add(lbase); R.add(lbase, 1.0, 0.9);
  const lscr = new THREE.Group(); lscr.position.set(0, 0.01, -0.045); lscr.rotation.x = -0.35; lap.add(lscr);
  const lbody = inked(new RoundedBoxGeometry(0.15, 0.1, 0.008, 2, 0.004), { color: 0xe9e6df }); lbody.position.y = 0.05; lscr.add(lbody); R.add(lbody, 1.1, 0.9);
  const lfaceTex = canvasTex(256, 170, (c, w, h) => { c.fillStyle = '#12304f'; c.fillRect(0, 0, w, h); c.fillStyle = '#2a8fd0'; c.fillRect(24, 100, 30, 46); c.fillStyle = '#ffd27a'; c.fillRect(70, 70, 30, 76); c.fillStyle = '#e0603f'; c.fillRect(116, 50, 30, 96); c.strokeStyle = '#7fe3ff'; c.lineWidth = 4; c.beginPath(); c.arc(200, 70, 34, 0, TAU * 0.7); c.stroke(); });
  const lface = new THREE.Mesh(new THREE.PlaneGeometry(0.136, 0.088), faceMat(lfaceTex)); lface.position.set(0, 0.05, 0.0045); lscr.add(lface);
  const cableCurve = new THREE.CatmullRomCurve3([new THREE.Vector3(0.26, 0.012, 0.03), new THREE.Vector3(0.18, 0.01, -0.06), new THREE.Vector3(0.06, 0.04, -0.12), new THREE.Vector3(BX + 0.06, 0.2, -0.07), new THREE.Vector3(BX + 0.02, MY - 0.05, -0.04)]);
  const cable = lightTube(cableCurve, { radius: 0.0055, color: 0x45c6ff, speed: 0.7 }); g.add(cable); cable.userData.fill(0);
  shadowed(lap);

  const order = ['tool', 'data', 'pie', 'bars', 'def'];
  let now = 0, sel = null, seen = new Set(), finished = false;
  const lbPos = new THREE.Vector3();
  function touch(k) {
    const p = parts[k]; if (now < 3.2) return;
    sel = sel === k ? null : k; ctx.sfx.pop?.();
    if (sel) {
      seen.add(k); B.hit(p.inner, now, 0.08);
      burstAt(ctx, g, new THREE.Vector3(BX, MY, 0.15), p.sp.c, 20, 0.35, 0.03);
      ctx.ui.card({ tag: 'جزء من السبورة', title: p.sp.w, body: p.sp.b, color: p.sp.c });
      if (seen.size === 5 && !finished) { finished = true; setTimeout(() => { ctx.sfx.good?.(); ctx.ui.done(); }, 1500); }
    } else ctx.ui.hideCard();
  }
  order.forEach((k) => g.add(parts[k].lab));
  order.forEach((k) => ctx.tap(parts[k].holder, () => touch(k)));
  ctx.ui.hud('المس أجزاء السبورة لتخرج منها');

  return {
    update(t, dt, e) {
      now = t; R.update(t, e); B.update(t);
      under.scale.setScalar(Math.max(e, 0.001)); edge.scale.setScalar(Math.max(e, 0.001));
      screen.material.opacity = stag(t, 1.2, 0.8) * e;
      cable.userData.update(dt); cable.userData.fill(stag(t, 1.4, 1.6, ease) * e);
      logo.scale.setScalar(Math.max(stag(t, 1.5, 0.6, easeBack) * e, 0.001));
      order.forEach((k, i) => {
        const p = parts[k], k0 = stag(t, 1.6 + i * 0.5, 0.8, easeBack) * e;
        p.holder.visible = k0 > 0.01;
        const on = sel === k ? 1 : 0;
        p.pop = THREE.MathUtils.damp(p.pop, on, 5, dt);
        const pp = ease(p.pop);
        p.holder.scale.setScalar(Math.max(k0 * (1 + 0.35 * pp), 0.001));
        p.holder.position.set(p.rest.x, p.rest.y + 0.02 * pp, p.rest.z + 0.16 * pp);
        p.inner.rotation.y = pp * Math.sin(t * 1.6) * 0.5 + (k === 'def' ? t * 0.8 : 0);
        pulseHint(p.hint, t, i * 1.2, seen.has(k) || on ? 0.0 : 1, 0.3);
        // label only for the opened part
        p.holder.getWorldPosition(lbPos); g.worldToLocal(lbPos);
        p.lab.position.set(lbPos.x, lbPos.y + 0.12 + 0.05 * pp, lbPos.z + 0.04);
        setSpr(p.lab, 0.19, on * pp);
      });
      parts.pie.pieG.rotation.z = t * 0.5;
      barMeshes.forEach((m, i) => { const h = bh[i] * stag(t, 2.0 + i * 0.25, 0.9, easeBack) * e * (0.92 + 0.08 * Math.sin(t * 1.5 + i)); m.scale.y = Math.max(h, 0.001); m.position.y = h / 2; });
    },
  };
}
