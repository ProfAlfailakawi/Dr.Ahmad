import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { P, ease, easeBack, clamp01, stag, mat, glossy, goldMat, shadowed, glow, sprite } from '../../kit.js?v=17';
import { Rig, hexCoin, badge, V, TAU } from '../lib/a5-kit.js?v=17';

export const meta = { free: true, center: [0.55, 0.57], typeLabel: 'بين عصرين' };

const TOK = [
  { k: 'coin', c: 0xe3b23c, t: 'ثمن الجهاز', n: 'ارتفاع ثمن أجهزة قراءة الكتاب الإلكتروني عبء على القراء البسطاء.' },
  { k: 'print', c: 0x5a6fd6, t: 'طباعة ممنوعة', n: 'قد تُمنع طباعته ونسخ مقتطفات منه.' },
  { k: 'pencil', c: 0xe8604c, t: 'نص قابل للتحوير', n: 'بعض الكتب التي تسمح بتعديل محتواها قد تحوّر الأفكار الرئيسية لصاحب الكتاب وتنسبها لغيره.' },
];

function readerScreen() {
  const c = document.createElement('canvas'); c.width = 256; c.height = 512; const g = c.getContext('2d');
  g.fillStyle = '#12203f'; g.fillRect(0, 0, 256, 512);
  const cl = ['#2a6fd0', '#ef8f2a', '#2fb3b8', '#e0452c', '#e3b23c', '#5a6fd6'];
  for (let row = 0; row < 4; row++) { let x = 10; for (let i = 0; i < 9; i++) { const w = 18 + ((i * 7 + row * 3) % 4) * 6, h = 70 + ((i * 5 + row * 11) % 5) * 12; g.fillStyle = cl[(i + row * 2) % 6]; g.fillRect(x, row * 128 + 120 - h, w, h); g.fillStyle = 'rgba(255,255,255,.35)'; g.fillRect(x, row * 128 + 120 - h, w, 5); x += w + 4; } g.fillStyle = '#c9a15a'; g.fillRect(0, row * 128 + 120, 256, 6); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapT = THREE.RepeatWrapping; return t;
}
function pageTex() {
  const c = document.createElement('canvas'); c.width = 128; c.height = 160; const g = c.getContext('2d');
  g.fillStyle = '#fbf3dc'; g.fillRect(0, 0, 128, 160); g.fillStyle = '#c9b78c'; for (let i = 0; i < 10; i++) g.fillRect(14, 16 + i * 14, 100 - (i % 3) * 18, 4);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

export default function build(ctx) {
  const g = new THREE.Group(); g.position.copy(P(meta.center[0], meta.center[1])); g.scale.setScalar(1.2); g.position.x -= 0.04; ctx.stage.add(g);
  const rig = new Rig(ctx);

  // wooden table (the photo's table)
  const table = new THREE.Mesh(new RoundedBoxGeometry(0.72, 0.03, 0.5, 3, 0.012), glossy(0x5a3520, { roughness: 0.4 })); table.position.y = 0.015; g.add(shadowed(table));
  const gc = document.createElement('canvas'); gc.width = 256; gc.height = 256; { const x = gc.getContext('2d'); x.fillStyle = '#8a5a32'; x.fillRect(0, 0, 256, 256); for (let i = 0; i < 70; i++) { x.strokeStyle = `rgba(40,20,8,${0.05 + (i % 5) * 0.03})`; x.lineWidth = 1 + (i % 3); x.beginPath(); const y = (i / 70) * 256; x.moveTo(0, y); x.bezierCurveTo(80, y + 6 * Math.sin(i), 170, y - 8 * Math.cos(i), 256, y + 4); x.stroke(); } }
  const grain = new THREE.CanvasTexture(gc); grain.colorSpace = THREE.SRGBColorSpace;
  const inlay = new THREE.Mesh(new RoundedBoxGeometry(0.66, 0.004, 0.44, 2, 0.004), new THREE.MeshStandardMaterial({ map: grain, roughness: 0.6 })); inlay.position.y = 0.031; g.add(inlay);
  const TY = 0.033;

  // old books stacked at the back
  const cols = [0x8b5a2b, 0x2f7f86, 0xa2452f, 0x3b5a8a, 0x6b4f3f, 0x5a7a3a];
  const stacks = [[-0.22, -0.17, 4], [-0.02, -0.19, 3], [0.2, -0.17, 5]].map(([x, z, n], si) => {
    const sg = new THREE.Group(); sg.position.set(x, TY, z); g.add(sg);
    let y = 0; for (let i = 0; i < n; i++) { const h = 0.022 + (i % 2) * 0.006, w = 0.13 - i * 0.008; const b = new THREE.Mesh(new RoundedBoxGeometry(w, h, 0.09, 2, 0.004), [mat(cols[(si + i) % 6]), mat(cols[(si + i) % 6]), mat(0xf4ead0), mat(0xf4ead0), mat(cols[(si + i) % 6]), mat(0xf4ead0)]); b.position.set((i % 2 ? 0.008 : -0.008), y + h / 2, 0); b.rotation.y = (i - 2) * 0.1; y += h; sg.add(shadowed(b)); }
    return sg;
  });

  // big open book
  const bk = new THREE.Group(); bk.position.set(-0.15, TY, 0.06); g.add(bk);
  const cover = new THREE.Mesh(new RoundedBoxGeometry(0.34, 0.012, 0.22, 2, 0.005), glossy(0x8b3a2b)); cover.position.y = 0.006; bk.add(shadowed(cover));
  const pgT = new THREE.MeshStandardMaterial({ map: pageTex(), roughness: 0.9 });
  [-1, 1].forEach((s) => { const h = new THREE.Mesh(new RoundedBoxGeometry(0.15, 0.016, 0.2, 1, 0.003), pgT); h.position.set(s * 0.077, 0.02, 0); h.rotation.z = -s * 0.12; bk.add(h); });
  const flips = []; for (let i = 0; i < 4; i++) { const pg = new THREE.Mesh(new THREE.PlaneGeometry(0.14, 0.19), new THREE.MeshStandardMaterial({ map: pageTex().clone ? pageTex() : null, side: THREE.DoubleSide, roughness: 0.9 })); pg.position.y = 0.03; bk.add(pg); flips.push(pg); }

  // e-reader
  const rd = new THREE.Group(); rd.position.set(0.17, TY, 0.04); g.add(rd);
  const tilt = new THREE.Group(); tilt.rotation.x = -0.34; tilt.position.y = 0.15; tilt.scale.setScalar(1.35); rd.add(tilt);
  const slab = new THREE.Mesh(new RoundedBoxGeometry(0.17, 0.23, 0.016, 4, 0.01), glossy(0x2b3440, { roughness: 0.3 })); tilt.add(shadowed(slab));
  const scrTex = readerScreen(); const scr = new THREE.Mesh(new THREE.PlaneGeometry(0.14, 0.19), new THREE.MeshBasicMaterial({ map: scrTex, toneMapped: false })); scr.position.z = 0.0085; tilt.add(scr);
  const dim = new THREE.Mesh(new THREE.PlaneGeometry(0.14, 0.19), new THREE.MeshBasicMaterial({ color: 0x3a0f10, transparent: true, opacity: 0, toneMapped: false, depthWrite: false })); dim.position.z = 0.0095; tilt.add(dim);
  const foot = new THREE.Mesh(new RoundedBoxGeometry(0.13, 0.02, 0.08, 2, 0.006), glossy(0x2b3440)); foot.position.set(0, 0.01, 0.0); rd.add(foot);
  const cone = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.2, 0.5, 36, 1, true), new THREE.MeshBasicMaterial({ color: 0xffd9a0, transparent: true, opacity: 0.1, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false })); cone.position.set(0, 0.26, 0.04); rd.add(cone);
  const rglow = glow(0x6fb0ff, 0.34, 0.3); rglow.position.set(0, 0.0, 0.03); tilt.add(rglow);
  const bands = TOK.map((tk, i) => { const grp = new THREE.Group(); grp.position.y = -0.07 + i * 0.07; const r = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.006, 8, 40), new THREE.MeshStandardMaterial({ color: tk.c, emissive: tk.c, emissiveIntensity: 0.5, metalness: 0.5, roughness: 0.3 })); r.scale.set(0.9, 0.2, 1); r.rotation.x = Math.PI / 2; grp.add(r); const pl = hexCoin('lock', tk.c, 0.022, 0.01); pl.rotation.x = Math.PI / 2; pl.position.set(0, 0.0, 0.03); grp.add(pl); tilt.add(grp); grp.scale.setScalar(0.0001); grp.visible = false; return grp; });
  const lib = new THREE.InstancedMesh(new RoundedBoxGeometry(0.02, 0.028, 0.016, 1, 0.003), mat(0xffffff, { roughness: 0.4 }), 20);
  const lc = [0x2a6fd0, 0xef8f2a, 0x2fb3b8, 0xe0452c, 0xe3b23c, 0x5a6fd6]; for (let i = 0; i < 20; i++) lib.setColorAt(i, new THREE.Color(lc[i % 6])); tilt.add(lib);
  const dm = new THREE.Object3D(); const ld = Array.from({ length: 20 }, (_, i) => ({ a: Math.random() * TAU, r: 0.02 + Math.random() * 0.09, ph: i / 20 }));

  // limit tokens above the e-reader
  const toks = TOK.map((tk, i) => { const hv = new THREE.Group(); const coin = hexCoin(tk.k, tk.c, 0.055, 0.02); hv.add(coin); hv.position.set(0.1 + i * 0.1, 0.34 + (i % 2) * 0.03, 0.06); g.add(hv); return { hv, coin, tk, i, done: false, t0: -9 }; });

  const tagL = sprite('المطبوع', 0.17, { size: 56, width: 380, weight: 800, border: '#8b3a2b' }); tagL.userData.w = 0.17; tagL.position.set(-0.15, 0.04, 0.24);
  const tagR = sprite('الإلكتروني', 0.19, { size: 56, width: 420, weight: 800, border: '#2a8fd0' }); tagR.userData.w = 0.19; tagR.position.set(0.2, 0.04, 0.24); g.add(tagL, tagR);

  let now = 0, locks = 0, libOn = -9, seen = new Set(), finished = false, flipAt = -9, shakeAt = -9;
  const mark = (id) => { seen.add(id); ctx.ui.hud(`وزنتَ ${seen.size} من 6`); if (seen.size >= 6 && !finished) { finished = true; setTimeout(() => { ctx.sfx.good?.(); ctx.ui.card({ tag: 'الحكم', title: 'وزن العيوب والمزايا', body: 'التعلّم الناضج لا يكتفي بالمزايا، بل يزن العيوب قبل اتخاذ قرار الاعتماد.', color: 0xd4ad55 }); ctx.ui.done(); }, 1300); } };
  toks.forEach((o) => rig.touch(o.hv, (hh) => {
    if (o.done) return; o.done = true; o.t0 = now; locks++; hh.on = false; ctx.sfx.pop?.(); shakeAt = now + 0.5;
    ctx.ui.card({ tag: 'قيد', title: o.tk.t, body: o.tk.n, color: o.tk.c }); mark('t' + o.i);
  }, { color: o.tk.c, size: 0.15, show: 3 + o.i * 0.3 }));
  rig.touch(rd, (hh) => {
    if (libOn < 0) { libOn = now; locks = 0; ctx.fx.burst(V(0.2, 0.2, 0.12), 0x6fb0ff, 26, 0.35, 0.03); mark('lib'); }
    ctx.sfx.pop?.(); hh.on = false; ctx.ui.card({ tag: 'ميزة', title: 'مكتبة في جهاز', body: 'يحمل الجهاز الواحد مكتبة كاملة ويتيح الوصول إليها في أي وقت.', color: 0x2a8fd0 });
  }, { color: 0x6fb0ff, size: 0.3, at: V(0, 0.1, 0.03), show: 3.4 });
  rig.touch(bk, (hh) => { flipAt = now; ctx.sfx.pop?.(); hh.on = false; mark('book'); ctx.ui.card({ tag: 'المطبوع', title: 'نص ثابت لا يتبدّل', body: 'نصه ثابت بعد الطباعة، فتبقى أفكار صاحبه كما كتبها.', color: 0x8b3a2b }); }, { color: 0xe3b23c, size: 0.3, at: V(0, 0.05, 0), show: 3.2 });
  rig.touch(stacks[1], (hh) => { ctx.sfx.pop?.(); hh.on = false; mark('pile'); ctx.ui.card({ tag: 'قيد', title: 'يشغل حيّزاً', body: 'يشغل حيزاً مادياً ويصعب حمل مكتبة كاملة منه.', color: 0x6b4f3f }); }, { color: 0xe3b23c, size: 0.22, at: V(0, 0.05, 0), show: 3.6 });
  ctx.ui.hud('زِن عيوب الكتاب الإلكتروني ومزاياه');

  return {
    update(t, dt, e) {
      now = t; rig.update(t, dt, e);
      scrTex.offset.y = (t * 0.12) % 1; cone.material.opacity = 0.1 * stag(t, 1, 1) * e * (0.85 + 0.15 * Math.sin(t * 1.5));
      table.scale.set(Math.max(stag(t, 0.1, 0.7) * e, 0.001), 1, 1); inlay.visible = table.scale.x > 0.5;
      stacks.forEach((s, i) => { const p = stag(t, 0.4 + i * 0.2, 0.8, easeBack) * e; s.scale.setScalar(Math.max(p, 0.001)); });
      const bp = stag(t, 0.6, 0.8, easeBack) * e; bk.scale.setScalar(Math.max(bp, 0.001));
      const rp = stag(t, 0.9, 0.8, easeBack) * e; rd.scale.setScalar(Math.max(rp, 0.001));
      const sh = clamp01(1 - (now - shakeAt) / 0.5) * (shakeAt > 0 ? 1 : 0); tilt.rotation.z = Math.sin(now * 50) * 0.03 * sh;
      dim.material.opacity = Math.min(0.55, locks * 0.18); rglow.material.opacity = (0.28 + 0.1 * Math.sin(t * 2)) * (1 - locks * 0.25) * rp;
      toks.forEach((o) => {
        const p = stag(t, 1.4 + o.i * 0.25, 0.8, easeBack) * e; const dp = clamp01((now - o.t0) / 0.7);
        if (!o.done) { o.hv.position.set(0.1 + o.i * 0.1, 0.34 + (o.i % 2) * 0.03 + Math.sin(t * 1.4 + o.i * 2) * 0.01, 0.06); o.hv.scale.setScalar(Math.max(p, 0.0001)); o.coin.rotation.y = t * 0.8 + o.i; }
        else { const tp = V(0.2, 0.11 + (-0.07 + o.i * 0.07) * 0.9, 0.09); o.hv.position.lerp(tp, ease(dp)); o.hv.scale.setScalar(Math.max(1 - ease(dp), 0.0001)); o.hv.visible = dp < 1; }
        const b = bands[o.i]; const on = o.done && libOn < 0 ? ease(clamp01((now - o.t0 - 0.4) / 0.5)) : (libOn > 0 ? 1 - ease(clamp01((now - libOn) / 0.6)) * 1 : 0);
        b.scale.setScalar(Math.max(on, 0.0001)); b.visible = on > 0.01;
      });
      for (let i = 0; i < 20; i++) { const d = ld[i]; const k = libOn > 0 ? (now * 0.25 + d.ph) % 1 : 0; dm.position.set(Math.cos(d.a + now) * d.r, 0.0 + k * 0.28, 0.03 + Math.sin(d.a + now) * d.r * 0.5); dm.rotation.set(k * 4, d.a, 0); dm.scale.setScalar(libOn > 0 ? Math.max(Math.sin(k * Math.PI), 0.0001) : 0.0001); dm.updateMatrix(); lib.setMatrixAt(i, dm.matrix); }
      lib.instanceMatrix.needsUpdate = true;
      flips.forEach((pg, i) => { const f = clamp01(1 - (now - flipAt) / 2.5) * (flipAt > 0 ? 1 : 0.35); const k = (t * 0.5 + i / 4) % 1; pg.rotation.z = -1.3 + k * 2.6; pg.position.set(0, 0.03 + Math.sin(k * Math.PI) * 0.045 * (0.5 + f), 0); pg.visible = bp > 0.6; });
      const tk = stag(t, 1.2, 0.6, easeBack) * e; [tagL, tagR].forEach((s) => s.scale.set(s.userData.w * tk + 0.0001, s.userData.w * s.userData.aspect * tk + 0.0001, 1));
      g.rotation.y = Math.sin(t * 0.3) * 0.03;
    },
  };
}
