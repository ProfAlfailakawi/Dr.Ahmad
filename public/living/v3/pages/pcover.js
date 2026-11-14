// pcover — the film of the book (about 26 seconds), shown for EVERY cover edition, today's and next year's.
// Nothing here depends on the cover's picture: a book opens, four doors rise out of it, pages fly out in a ring, the kinds of
// experience turn in front of it, and the title forms. Everything is drawn in code (no video file, no images), so it costs nothing to load.
// Tap the scene to watch it again.
import * as THREE from 'three';
import { P, ease, easeBack, clamp01, glow, glowTexture, fontsReady, sprite, mat, glossy } from '../../kit.js?v=38';

export const meta = { free: true, center: [0.5, 0.5], typeLabel: 'الغلاف' };

const GOLD = 0xe9b94f;
const DOORS = [
  { n: '١', t: 'مفهوم تكنولوجيا التعليم', c: '#7d7d42' },
  { n: '٢', t: 'مستحدثات تكنولوجيا التعليم', c: '#a13030' },
  { n: '٣', t: 'نماذج مستحدثات تكنولوجيا التعليم', c: '#3f86cc' },
  { n: '٤', t: 'المعلم والتكنولوجيا', c: '#d17621' },
];
const CAPS = [
  [0.6, 4.2, 'كتاب يُقرأ… ثم يُعاش'],
  [4.4, 9.8, 'أربعة أبواب تفتح لك عالماً كاملاً'],
  [10.2, 15.6, 'أكثر من مئة صفحة تستيقظ أمام الكاميرا'],
  [16, 21.2, 'مجسّمات وألعاب وخطوط زمنية'],
  [22.6, 27.6, 'وجّه الكاميرا إلى أي صفحة لتبدأ الرحلة'],
];
const KINDS = [
  { t: 'مجسّمات', c: 0x2a7fd0 }, { t: 'ألعاب', c: 0xd62b3a }, { t: 'خطوط زمنية', c: 0xe0861f },
  { t: 'اختبارات', c: 0x8a5bb5 }, { t: 'إنفوجرافيك', c: 0xb5202f }, { t: 'مقارنات', c: 0x1fa5a0 },
];
const END = 26, NCARD = 26;
const cv = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
const tex = (c) => { const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 2; return t; };
const lerp = (a, b, k) => a + (b - a) * k;
const win = (t, a, b) => clamp01((t - a) / (b - a));      // 0..1 inside [a, b]
const pulse = (t, a, b, f = 0.5) => Math.min(win(t, a, a + f), 1 - win(t, b - f, b));

function doorTexture(d) {
  const w = 300, h = 400, c = cv(w, h), g = c.getContext('2d');
  const arch = (i) => { g.beginPath(); g.moveTo(i, h - i); g.lineTo(i, w / 2); g.arc(w / 2, w / 2, w / 2 - i, Math.PI, 0); g.lineTo(w - i, h - i); g.closePath(); };
  g.shadowColor = 'rgba(0,0,0,.5)'; g.shadowBlur = 18; arch(10);
  const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, d.c); gr.addColorStop(1, '#101a30'); g.fillStyle = gr; g.fill(); g.shadowBlur = 0;
  g.lineWidth = 7; g.strokeStyle = '#f0c45c'; g.stroke(); arch(24); g.lineWidth = 2.5; g.strokeStyle = 'rgba(240,196,92,.7)'; g.stroke();
  g.direction = 'rtl'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.font = '800 120px "Reem Kufi", Tajawal, sans-serif'; g.fillStyle = '#ffe9a8'; g.shadowColor = 'rgba(0,0,0,.5)'; g.shadowBlur = 8; g.fillText(d.n, w / 2, 150); g.shadowBlur = 0;
  g.font = '700 31px Tajawal, sans-serif'; g.fillStyle = '#fff';
  const words = d.t.split(' '), lines = []; let cur = '';
  for (const wd of words) { const tt = cur ? cur + ' ' + wd : wd; if (g.measureText(tt).width > 236 && cur) { lines.push(cur); cur = wd; } else cur = tt; }
  lines.push(cur);
  lines.forEach((l, i) => g.fillText(l, w / 2, 262 + i * 40));
  return tex(c);
}
function cardTexture(col) {
  const c = cv(96, 128), g = c.getContext('2d');
  g.shadowColor = 'rgba(0,0,0,.35)'; g.shadowBlur = 6; g.fillStyle = '#fbf6ea'; g.beginPath(); g.roundRect(6, 6, 84, 116, 8); g.fill(); g.shadowBlur = 0;
  g.fillStyle = col; g.beginPath(); g.roundRect(6, 6, 84, 30, [8, 8, 0, 0]); g.fill();
  g.fillStyle = '#c9c1ae'; [52, 66, 80, 94].forEach((y, i) => g.fillRect(16, y, i === 3 ? 34 : 64, 5));
  g.fillStyle = col; g.globalAlpha = 0.55; g.beginPath(); g.arc(70, 98, 11, 0, 7); g.fill();
  return tex(c);
}
function bookFace(w, h) {
  const c = cv(w, h), g = c.getContext('2d'), cx = w / 2, cy = h / 2;
  const bg = g.createLinearGradient(0, 0, w, h); bg.addColorStop(0, '#1d3560'); bg.addColorStop(1, '#0b1630'); g.fillStyle = bg; g.fillRect(0, 0, w, h);
  g.strokeStyle = '#f0c45c'; g.lineWidth = 6; g.strokeRect(14, 14, w - 28, h - 28); g.lineWidth = 2; g.strokeRect(24, 24, w - 48, h - 48);
  g.lineWidth = 4; for (let k = 0; k < 2; k++) { g.beginPath(); for (let i = 0; i < 4; i++) { const a = k * Math.PI / 4 + i * Math.PI / 2 + Math.PI / 4, x = cx + Math.cos(a) * w * 0.3, y = cy + Math.sin(a) * w * 0.3; i ? g.lineTo(x, y) : g.moveTo(x, y); } g.closePath(); g.stroke(); }
  g.fillStyle = '#f0c45c'; g.beginPath(); g.arc(cx, cy, 9, 0, 7); g.fill();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

export default function build(ctx) {
  const g = new THREE.Group(); g.position.copy(P(0.5, 0.5)); ctx.stage.add(g);
  const act = (o) => { g.add(o); return o; };
  let t0 = 0, now = 0, ready = false, fired = new Set(), doneOnce = false;
  const once = (k, when, fn) => { if (when && !fired.has(k)) { fired.add(k); fn(); } };

  // ---- the book (flat on the page, tipped toward the reader)
  const book = act(new THREE.Group()); book.rotation.x = 0.42; book.position.set(0, 0, 0.14);
  const BW = 0.36, BD = 0.48;
  const block = new THREE.Mesh(new THREE.BoxGeometry(BW, 0.04, BD), mat(0xfbf3df)); block.position.set(0, 0.02, 0); book.add(block);
  const faceTex = bookFace(256, 340);
  const coverMat = [mat(0x12203f), mat(0x12203f), new THREE.MeshStandardMaterial({ map: faceTex, roughness: 0.5 }), mat(0x12203f), mat(0x12203f), mat(0x12203f)];
  const baseCover = new THREE.Mesh(new THREE.BoxGeometry(BW + 0.012, 0.01, BD + 0.012), mat(0x12203f)); baseCover.position.y = -0.003; book.add(baseCover);
  const hinge = new THREE.Group(); hinge.position.set(-BW / 2, 0.045, 0); book.add(hinge);
  const lid = new THREE.Mesh(new THREE.BoxGeometry(BW + 0.012, 0.012, BD + 0.012), coverMat); lid.position.x = BW / 2; hinge.add(lid);
  const leaves = [];
  for (let i = 0; i < 4; i++) {
    const h = new THREE.Group(); h.position.set(-BW / 2, 0.041 + i * 0.0008, 0); book.add(h);
    const m = new THREE.Mesh(new THREE.BoxGeometry(BW - 0.01, 0.002, BD - 0.014), mat(0xfffaf0)); m.position.x = (BW - 0.01) / 2; h.add(m); leaves.push(h);
  }
  const edges = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(BW + 0.012, 0.05, BD + 0.012)), new THREE.LineBasicMaterial({ color: GOLD, transparent: true, opacity: 0.8 }));
  edges.position.y = 0.021; book.add(edges);
  const halo = act(glow(0xffc55a, 1.1, 0)); halo.position.set(0, 0.16, 0.05);
  const beam = act(glow(0xfff0c0, 0.5, 0)); beam.position.set(0, 0.12, 0.1);

  // ---- things that need the fonts: doors, captions, title (made on the first frame after fonts load)
  let skyBright = null, skyDim = null, skyLines = null;
  let doors = [], caps = [], title = null, sub = null, kinds = [], cards = [], cardRoot = act(new THREE.Group()), kindRoot = act(new THREE.Group());
  const makeText = () => {
    DOORS.forEach((d, i) => {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: doorTexture(d), transparent: true, depthWrite: false, toneMapped: false, opacity: 0 }));
      s.scale.set(0.2, 0.2667, 1); s.renderOrder = 7; s.visible = false; act(s); doors.push({ s, i, home: new THREE.Vector3((i - 1.5) * 0.235, 0.32, -0.2) });
    });
    CAPS.forEach(([a, b, text]) => {
      const s = sprite(text, 0.86, { width: 760, size: 38, color: '#f4d98a', bg: 'rgba(11,20,42,0.86)', border: 'rgba(240,196,92,.6)', pad: 18, radius: 30, shadow: false });
      s.material.opacity = 0; s.visible = false; s.position.set(0, 0.1, 0.66); act(s); caps.push({ s, a, b });
    });
    title = sprite('موسوعة تكنولوجيا التعليم', 1.0, { width: 900, size: 76, weight: 700, color: '#f5cf6b', bg: null, title: true, shadow: false, pad: 10 });
    title.material.opacity = 0; title.visible = false; title.position.set(0, 0.76, -0.3); act(title);
    sub = sprite('الموسوعة الحيّة', 0.5, { width: 520, size: 62, weight: 800, color: '#ffffff', bg: 'rgba(11,20,42,0.82)', border: 'rgba(240,196,92,.7)', shadow: false, pad: 16, radius: 40 });
    sub.material.opacity = 0; sub.visible = false; sub.position.set(0, 0.64, -0.3); act(sub);
    const ct = ['#8a8a45', '#b53a3a', '#4a95e0', '#e08a2c'].map(cardTexture);
    for (let i = 0; i < NCARD; i++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: ct[i % 4], transparent: true, depthWrite: false, toneMapped: false, opacity: 0 }));
      s.scale.set(0.085, 0.113, 1); s.visible = false; cardRoot.add(s); cards.push({ s, i, ph: (i / NCARD) * Math.PI * 2, lane: i % 3 });
    }
    KINDS.forEach((k, i) => {
      const grp = new THREE.Group(); let m;
      if (i === 0) m = new THREE.Mesh(new THREE.BoxGeometry(0.085, 0.085, 0.085), glossy(k.c));
      else if (i === 1) m = new THREE.Mesh(new THREE.IcosahedronGeometry(0.058, 0), glossy(k.c));
      else if (i === 2) m = new THREE.Mesh(new THREE.TorusGeometry(0.052, 0.014, 8, 24), glossy(k.c));
      else if (i === 3) m = new THREE.Mesh(new THREE.OctahedronGeometry(0.066), glossy(k.c));
      else if (i === 4) { m = new THREE.Group(); [0.045, 0.085, 0.065].forEach((hh, j) => { const b = new THREE.Mesh(new THREE.BoxGeometry(0.03, hh, 0.03), glossy(k.c)); b.position.set((j - 1) * 0.04, hh / 2 - 0.04, 0); m.add(b); }); }
      else { m = new THREE.Group(); const beamM = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.012, 0.012), glossy(k.c)); const post = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.09, 8), glossy(k.c)); post.position.y = -0.04; m.add(beamM, post); [-0.06, 0.06].forEach((x) => { const pan = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, 0.006, 14), glossy(0xf0c45c)); pan.position.set(x, -0.035, 0); m.add(pan); }); }
      grp.add(m); const lab = sprite(k.t, 0.19, { width: 320, size: 44, color: '#f4d98a', bg: 'rgba(11,20,42,0.86)', pad: 12, radius: 22, shadow: false }); lab.position.set(0, -0.085, 0.09); grp.add(lab);
      grp.visible = false; grp.userData.m = m; kindRoot.add(grp); kinds.push({ grp, m, i });
    });

    // ---- the reader's sky: every page this reader has discovered is a star; the stars of one door are joined in book order
    const doorsInfo = (ctx.doors?.() || []).map((d) => ({ door: d.door, pages: ctx.doorPages?.(d.door) || [] }));
    const total = doorsInfo.reduce((n, d) => n + d.pages.length, 0), found = doorsInfo.reduce((n, d) => n + d.pages.filter((p) => p.found).length, 0);
    const AR = (n) => String(n).replace(/[0-9]/g, (d) => '٠١٢٣٤٥٦٧٨٩'[d]);
    const skyText = found ? `سماؤك: ${AR(found)} من ${AR(total)} صفحة صارت نجوماً` : 'كل صفحة تكتشفها تصير نجمة في سمائك';
    { const s = sprite(skyText, 0.86, { width: 760, size: 38, color: '#f4d98a', bg: 'rgba(11,20,42,0.86)', border: 'rgba(240,196,92,.6)', pad: 18, radius: 30, shadow: false });
      s.material.opacity = 0; s.visible = false; s.position.set(0, 0.1, 0.66); act(s); caps.push({ s, a: 28, b: 1e9 }); }
    const SKY_COL = { 1: 0xb8b86a, 2: 0xe06a6a, 3: 0x6fb2f0, 4: 0xf0a050 };
    const bright = [], dim = [], lines = [];
    doorsInfo.forEach(({ door, pages }, di) => {
      const cx = (di - 1.5) * 0.235, cy = 0.42, cz = -0.32, n = pages.length, R = 0.108;
      let prev = null;
      pages.forEach((p, i) => {
        const r = R * Math.sqrt((i + 0.5) / Math.max(n, 1)), a = i * 2.39996;
        const v = new THREE.Vector3(cx + Math.cos(a) * r, cy + Math.sin(a) * r * 1.15, cz);
        (p.found ? bright : dim).push({ v, c: new THREE.Color(SKY_COL[door] || 0xffd27a), ph: Math.random() * 6.28 });
        if (p.found) { if (prev) lines.push(prev, v); prev = v; }
      });
    });
    const pts = (list, size, op) => {
      const geo = new THREE.BufferGeometry(), pos = new Float32Array(Math.max(list.length, 1) * 3), colr = new Float32Array(Math.max(list.length, 1) * 3);
      list.forEach((o, i) => { pos.set([o.v.x, o.v.y, o.v.z], i * 3); colr.set([o.c.r, o.c.g, o.c.b], i * 3); });
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('color', new THREE.BufferAttribute(colr, 3)); geo.setDrawRange(0, list.length);
      geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 3);
      const m = new THREE.Points(geo, new THREE.PointsMaterial({ map: glowTexture(), size, vertexColors: true, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
      m.userData.op = op; m.frustumCulled = false; m.renderOrder = 12; act(m); return m;
    };
    skyBright = pts(bright, 0.06, 1); skyDim = pts(dim, 0.022, 0.45);
    if (lines.length) {
      const lg = new THREE.BufferGeometry().setFromPoints(lines);
      skyLines = new THREE.LineSegments(lg, new THREE.LineBasicMaterial({ color: 0xf0c45c, transparent: true, opacity: 0, depthWrite: false })); skyLines.renderOrder = 11; act(skyLines);
      lg.setDrawRange(0, 0); skyLines.userData.n = lines.length;
    }
    ready = true;
  };
  fontsReady().then(() => { try { makeText(); } catch (e) { console.warn('[cover]', e); } });

  // ---- motes of light
  const NM = 40, mp = new Float32Array(NM * 3), mph = new Float32Array(NM * 3);
  for (let i = 0; i < NM; i++) { mph[i * 3] = Math.random(); mph[i * 3 + 1] = Math.random() * 6.28; mph[i * 3 + 2] = 0.5 + Math.random(); }
  const mgeo = new THREE.BufferGeometry(); mgeo.setAttribute('position', new THREE.BufferAttribute(mp, 3).setUsage(THREE.DynamicDrawUsage));
  mgeo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 3);
  const motes = new THREE.Points(mgeo, new THREE.PointsMaterial({ map: glowTexture(), color: 0xffd98a, size: 0.035, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
  motes.frustumCulled = false; motes.renderOrder = 10; g.add(motes);

  // ---- tap: watch it again
  const replay = () => { if (!ready) return; t0 = now; fired = new Set(); ctx.sfx.whoosh?.(); ctx.sfx.pop?.(); };
  ctx.tap(book, replay);

  return {
    update(t, dt, e) {
      now = t;
      if (!ready) return;
      const tl = t - t0, fin = tl > END ? 1 : 0;
      // act 1: the book rises, glows, opens
      const rise = easeBack(win(tl, 0.2, 1.4)), open = ease(win(tl, 1.6, 3.4));
      book.position.y = 0.0015 + rise * 0.14 + Math.sin(t * 1.3) * 0.006 * rise;
      book.scale.setScalar(Math.max(0.001, win(tl, 0.1, 0.9)) * (1 - 0.22 * win(tl, 21, 24)));
      book.rotation.y = Math.sin(t * 0.5) * 0.18 * win(tl, 1.4, 3);
      hinge.rotation.z = open * Math.PI * 0.93;
      leaves.forEach((h, i) => { h.rotation.z = ease(win(tl, 2.6 + i * 0.35, 3.5 + i * 0.35)) * Math.PI * (0.9 - i * 0.025) * (i === 3 ? 0 : 1); });
      once('whoosh', tl > 0.05, () => { ctx.sfx.whoosh?.(); });
      once('open', tl > 1.7, () => { ctx.sfx.pop?.(); ctx.fx.burst(new THREE.Vector3(0, 0.2, 0.12), GOLD, 26, 0.5, 0.032); });
      halo.material.opacity = 0.5 * win(tl, 0.4, 2.2) * (0.88 + 0.12 * Math.sin(t * 1.7)); beam.material.opacity = 0.7 * pulse(tl, 1.5, 4.2, 0.8);
      beam.scale.setScalar(0.3 + 0.5 * win(tl, 1.5, 3));

      // act 2: four doors rise out of the book
      doors.forEach(({ s, i, home }) => {
        const a = 4.1 + i * 0.95, k = easeBack(win(tl, a, a + 1.0)), settle = ease(win(tl, 9.6, 11));
        s.visible = k > 0.001; s.material.opacity = Math.min(1, win(tl, a, a + 0.5)) * (1 - 0.4 * win(tl, 22, 25)) * (1 - 0.88 * win(tl, 26.6, 28));
        const sc = Math.max(0.001, k) * (1 - 0.18 * settle);
        s.scale.set(0.2 * sc, 0.2667 * sc, 1);
        s.position.set(lerp(0, home.x, k), lerp(0.2, home.y + 0.1 * settle, k) + Math.sin(t * 1.1 + i) * 0.006 * k, lerp(0.1, home.z - 0.12 * settle, k));
        once('door' + i, tl >= a, () => { ctx.sfx.signature?.(i + 1); ctx.fx.burst(new THREE.Vector3(home.x, home.y, home.z), GOLD, 16, 0.4, 0.028); });
      });

      // act 3: pages leave the book and circle it
      cards.forEach(({ s, i, ph, lane }) => {
        const a = 10 + i * 0.07, k = ease(win(tl, a, a + 1.6)), out = (1 - win(tl, 21.5, 24.5) * 0.45) * (1 - 0.6 * win(tl, 26.6, 28));
        s.visible = k > 0.001 && tl < 99;
        const ang = ph + t * (0.28 + lane * 0.04) * (fin ? 0.6 : 1), R = lerp(0.04, 0.46 + lane * 0.05, k);
        s.position.set(Math.cos(ang) * R, lerp(0.16, 0.2 + lane * 0.06 + Math.sin(ang * 2) * 0.03, k), 0.12 + Math.sin(ang) * R * 0.5);
        s.material.opacity = Math.min(1, k * 1.4) * 0.95 * out; const z = 0.7 + 0.5 * k; s.scale.set(0.085 * z, 0.113 * z, 1); s.material.rotation = Math.sin(ang * 3 + i) * 0.35;
      });

      // act 4: the kinds of experience
      kinds.forEach(({ grp, m, i }) => {
        const a = 16 + i * 0.55, k = easeBack(win(tl, a, a + 0.8)), fade = 1 - 0.0 * win(tl, 22, 25);
        grp.visible = k > 0.001; grp.scale.setScalar(Math.max(0.001, k) * (1 - 0.15 * win(tl, 22, 25)) * fade);
        grp.position.set((i - 2.5) * 0.172, lerp(0.2, 0.23 + Math.sin(t * 1.2 + i) * 0.012, k), lerp(0.2, 0.5, k));
        m.rotation.y = t * 0.8 + i; m.rotation.x = Math.sin(t * 0.6 + i) * 0.35 + (i === 1 ? t * 0.4 : 0);
        once('kind' + i, tl >= a, () => { ctx.sfx.tap?.(); ctx.fx.burst(grp.position.clone(), KINDS[i].c, 8, 0.28, 0.022); });
      });

      // act 5: the title forms
      const tk = ease(win(tl, 21.8, 24)), sk = ease(win(tl, 23.2, 25));
      title.visible = tk > 0.001; title.material.opacity = tk; title.scale.set(1.0 * (0.9 + 0.1 * tk), 1.0 * title.userData.aspect * (0.9 + 0.1 * tk), 1);
      title.position.y = 0.76 + 0.02 * (1 - tk) + Math.sin(t * 1.0) * 0.004 * tk;
      sub.visible = sk > 0.001; sub.material.opacity = sk; sub.scale.set(0.42, 0.42 * sub.userData.aspect, 1);
      once('title', tl >= 21.8, () => { ctx.sfx.good?.(); ctx.fx.burst(new THREE.Vector3(0, 0.68, -0.3), GOLD, 34, 0.5, 0.03); if (!doneOnce) { doneOnce = true; ctx.ui.done?.(); } });

      // act 6: the reader's sky
      const skk = ease(win(tl, 27.2, 29.4));
      if (skyBright) { skyBright.material.opacity = skk * (0.85 + 0.15 * Math.sin(t * 2.3)); skyBright.visible = skk > 0.001; skyBright.material.size = 0.05 + 0.012 * Math.sin(t * 1.7); }
      if (skyDim) { skyDim.material.opacity = skk * 0.45; skyDim.visible = skk > 0.001; }
      if (skyLines) { const lk = ease(win(tl, 28.6, 31)); skyLines.visible = lk > 0.001; skyLines.material.opacity = 0.7 * lk; skyLines.geometry.setDrawRange(0, Math.floor((skyLines.userData.n / 2) * lk) * 2); }
      once('sky', tl >= 27.4, () => { ctx.sfx.discover?.(); });

      // captions follow the story
      caps.forEach(({ s, a, b }) => {
        const k = Math.min(win(tl, a, a + 0.5), 1 - win(tl, b - 0.5, b)); s.visible = k > 0.002; s.material.opacity = k;
        s.position.y = 0.1 - 0.012 * (1 - k); s.scale.set(0.86, 0.86 * s.userData.aspect, 1);
      });

      // motes
      motes.material.opacity = 0.85 * win(tl, 1.2, 3) * e;
      for (let i = 0; i < NM; i++) {
        const a = mph[i * 3 + 1] + t * 0.2 * mph[i * 3 + 2], u = (mph[i * 3] + t * 0.06 * mph[i * 3 + 2]) % 1, r = 0.3 + 0.2 * Math.sin(a * 2.1 + i);
        mp[i * 3] = Math.cos(a) * r; mp[i * 3 + 1] = 0.08 + u * 0.55; mp[i * 3 + 2] = 0.1 + Math.sin(a) * r * 0.8;
      }
      mgeo.attributes.position.needsUpdate = true;
    },
  };
}
