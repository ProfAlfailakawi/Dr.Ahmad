// p211 — the two halves of the brain as one big split globe: a chalk-slate left half and a painted right half, held apart by a gold bridge; touch a half and its kind of thinking floats out.
import * as THREE from 'three';
import { P, ease, easeBack, clamp01, stag, mat, glossy, goldMat, shadowed, lightTube } from '../../kit.js?v=15';
import { tagSprite, setSpr, softLight } from '../../v2/common.js?v=15';
import { hints, finder, blobShadow, hitSphere } from '../lib/a3-kit.js?v=15';

export const meta = { free: true, center: [0.47, 0.68], typeLabel: 'مجسّم تفاعلي' };

const TAU = Math.PI * 2, R = 0.215;
function foldTex() {
  const c = document.createElement('canvas'); c.width = c.height = 512; const g = c.getContext('2d');
  g.fillStyle = '#7a7a7a'; g.fillRect(0, 0, 512, 512); g.lineCap = 'round';
  for (let i = 0; i < 90; i++) { g.strokeStyle = i % 2 ? '#ffffff' : '#3a3a3a'; g.lineWidth = 7 + Math.random() * 7; g.beginPath(); const x = Math.random() * 512, y = Math.random() * 512; g.moveTo(x, y); g.bezierCurveTo(x + 40 + Math.random() * 60, y - 50, x + 80, y + 60 + Math.random() * 40, x + 120 + Math.random() * 50, y + Math.random() * 40 - 20); g.stroke(); }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
}
function slateTex() {
  const c = document.createElement('canvas'); c.width = 512; c.height = 512; const g = c.getContext('2d');
  const gr = g.createLinearGradient(0, 0, 512, 512); gr.addColorStop(0, '#6f8c96'); gr.addColorStop(1, '#4d6870'); g.fillStyle = gr; g.fillRect(0, 0, 512, 512);
  g.fillStyle = 'rgba(255,255,248,.92)'; g.strokeStyle = 'rgba(255,255,248,.9)'; g.lineWidth = 3; g.font = '700 54px Georgia, serif';
  const w = ['x²+y²', 'Σ', 'π', '7+5', '∫f', '√25', '△', '12', 'a/b', '=', '%', '∞', 'n+1', 'Δx'];
  for (let i = 0; i < 30; i++) { g.save(); g.translate(Math.random() * 512, Math.random() * 512); g.rotate((Math.random() - 0.5) * 0.7); g.fillText(w[i % w.length], 0, 0); g.restore(); }
  for (let i = 0; i < 8; i++) { g.beginPath(); g.moveTo(Math.random() * 512, Math.random() * 512); g.lineTo(Math.random() * 512, Math.random() * 512); g.stroke(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}
function paintTex() {
  const c = document.createElement('canvas'); c.width = 512; c.height = 512; const g = c.getContext('2d');
  g.fillStyle = '#38b062'; g.fillRect(0, 0, 512, 512);
  const cols = ['#f6c73a', '#e8602c', '#d63a8c', '#7a4fc0', '#2aa0e0', '#ef8a2a', '#8ac04a', '#fbf1d0'];
  for (let i = 0; i < 60; i++) { g.fillStyle = cols[i % cols.length]; g.beginPath(); g.ellipse(Math.random() * 512, Math.random() * 512, 24 + Math.random() * 60, 14 + Math.random() * 36, Math.random() * 3, 0, TAU); g.fill(); }
  g.lineWidth = 9; for (let i = 0; i < 12; i++) { g.strokeStyle = cols[(i * 3) % cols.length]; g.beginPath(); const x = Math.random() * 512, y = Math.random() * 512; g.moveTo(x, y); g.bezierCurveTo(x + 80, y - 80, x + 160, y + 80, x + 240, y); g.stroke(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}
function half(sign, map, bump) {
  const geo = new THREE.SphereGeometry(1, 64, 44, sign > 0 ? Math.PI / 2 : -Math.PI / 2, Math.PI, 0, Math.PI);
  const grp = new THREE.Group();
  const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map, bumpMap: bump, bumpScale: 2.2, roughness: 0.5, metalness: 0.02 }));
  grp.add(m);
  const cap = new THREE.Mesh(new THREE.CircleGeometry(1, 56), new THREE.MeshStandardMaterial({ color: 0xf2d4cb, bumpMap: bump, bumpScale: 1.4, roughness: 0.6, side: THREE.DoubleSide }));
  cap.rotation.y = Math.PI / 2; grp.add(cap);
  grp.scale.set(R, R * 0.9, R * 1.12); return { grp, m, cap };
}
const glyphCache = {};
function glyphSprite(ch, color) {
  const k = ch + color; if (!glyphCache[k]) {
    const c = document.createElement('canvas'); c.width = c.height = 96; const g = c.getContext('2d');
    g.font = '800 70px Georgia, "Apple Color Emoji", serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.shadowColor = color; g.shadowBlur = 10; g.fillStyle = color; g.fillText(ch, 48, 52);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; glyphCache[k] = t;
  }
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glyphCache[k], transparent: true, depthWrite: false, opacity: 0, toneMapped: false })); s.scale.setScalar(0.07); s.renderOrder = 9; return s;
}

export default function build(ctx) {
  const g = new THREE.Group(); g.position.copy(P(0.47, 0.68)); g.scale.setScalar(0.88); ctx.stage.add(g);
  const H = hints(), found = finder(ctx, 3);
  const sh = blobShadow(0.62, 0.52, 0.3); g.add(sh);
  const BY = 0.28;
  const bump = foldTex();
  const brain = new THREE.Group(); brain.position.y = BY; g.add(brain);
  const sides = [
    { ...half(-1, slateTex(), bump), sign: -1, kick: 0, ch: ['Σ', 'π', '7', '+', '=', '√', '△', '%'], cols: ['#fbf8ea'], card: ['النصف الأيسر', 'الكلمات والأعداد والتسلسل', 'يختص بالتحليل والمنطق، وفيه نمط التفكير اليساري: التتابع واللفظ والتحليل.'], c: 0x5d7a86 },
    { ...half(1, paintTex(), bump), sign: 1, kick: 0, ch: ['♪', '♥', '★', '✿', '♫', '☀', '✦', '◐'], cols: ['#e8602c', '#d63a8c', '#f6c73a', '#2aa0e0'], card: ['النصف الأيمن', 'الموسيقا والألوان والخيال', 'يدرك الكل ويبتكر العلاقات المكانية بالصور، ويستكشف استدلالاً غير لفظي.'], c: 0xe0603a },
  ];
  sides.forEach((s) => { brain.add(s.grp); s.stem = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.02, 0.2, 14), goldMat()); s.stem.position.set(s.sign * R * 0.5, -0.17, 0); brain.add(s.stem); s.foot = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, 0.014, 28), goldMat()); s.foot.position.set(s.sign * R * 0.5, -BY + 0.007, 0); brain.add(s.foot); });
  // glyph pools
  const pool = [];
  sides.forEach((s, si) => { for (let i = 0; i < 8; i++) { const sp = glyphSprite(s.ch[i], s.cols[i % s.cols.length]); g.add(sp); pool.push({ sp, si, life: 9, max: 2.4, v: new THREE.Vector3() }); } });
  const emit = (si) => { let n = 0; pool.forEach((p) => { if (p.si === si) { p.life = -n * 0.1; n += 1; p.max = 2.2 + Math.random() * 0.8; p.v.set((Math.random() - 0.5) * 0.08 + sides[si].sign * 0.06, 0.12 + Math.random() * 0.06, (Math.random() - 0.5) * 0.1); p.sp.position.set(sides[si].sign * 0.16, BY + 0.08, 0.1); } }); };
  sides.forEach((s, si) => {
    ctx.tap(s.grp, () => { s.kick = 1; emit(si); ctx.sfx.pop?.(); found(si); ctx.ui.card({ tag: s.card[0], title: s.card[1], body: s.card[2], color: s.c }); s.hint.calm = true; });
    s.hint = H.add(s.grp, s.c, 5, [0, 0, 0], 2.8 + si * 0.3);
  });
  // gold bridge between the halves (a bundle of three light tubes)
  const bridges = [-0.06, 0, 0.06].map((z, i) => {
    const cv = new THREE.CatmullRomCurve3([new THREE.Vector3(-0.12, BY - 0.02 + i * 0.03, z), new THREE.Vector3(-0.04, BY + 0.0 + i * 0.03, z + 0.01), new THREE.Vector3(0.04, BY + 0.0 + i * 0.03, z + 0.01), new THREE.Vector3(0.12, BY - 0.02 + i * 0.03, z)]);
    const tb = lightTube(cv, { radius: 0.011, color: 0xffc24a, speed: 0.9 }); g.add(tb); tb.userData.fill(0); return tb;
  });
  const bhit = hitSphere(0.09, [0, BY + 0.02, 0.0]); g.add(bhit);
  let cross = -9;
  ctx.tap(bhit, () => { cross = now; ctx.sfx.pop?.(); found('bridge'); ctx.ui.card({ tag: 'بين الفصين', title: 'تفاعل لا انفصال', body: 'الفصان يتفاعلان، ونسبة قلة الدقة إلى النصف الأيمن اعتقاد خاطئ لا يُعمَّم.', color: 0xd4ad55 }); });
  H.add(g, 0xffc24a, 0.14, [0, BY + 0.02, 0.0], 3.2);
  const spark = softLight(0xffe08a, 0.1, 0); g.add(spark);
  const tagL = tagSprite('الأيسر', 0.17, 0x5d7a86), tagR = tagSprite('الأيمن', 0.17, 0xe0603a);
  tagL.position.set(-0.2, BY + 0.27, 0.0); tagR.position.set(0.2, BY + 0.27, 0.0); g.add(tagL, tagR);
  ctx.ui.hud('المس نصفي الدماغ ثم الجسر بينهما');
  let now = 0, nextEmit = 2.2;
  return {
    update(t, dt, e) {
      now = t;
      sh.material.opacity = 0.3 * e;
      brain.position.y = Math.sin(t * 1.1) * 0.006 - (1 - stag(t, 0.1, 1.0)) * 0.1;
      brain.rotation.y = Math.sin(t * 0.45) * 0.3;
      const k = Math.max(stag(t, 0.1, 0.9, easeBack) * e, 0.001); brain.scale.setScalar(k);
      const settle = 1 - ease((t - 0.1) / 1.4);
      sides.forEach((s) => {
        s.kick = Math.max(0, s.kick - dt * 1.5);
        const gap = 0.07 + 0.012 * Math.sin(t * 1.4) + s.kick * Math.sin(s.kick * Math.PI) * 0.06 + settle * 0.3;
        s.grp.position.x = s.sign * gap; s.grp.rotation.y = s.sign * s.kick * 0.18;
        s.stem.position.x = s.sign * (gap + R * 0.45);
        s.foot.position.x = s.stem.position.x;
      });
      bridges.forEach((b, i) => { b.userData.fill(stag(t, 1.2 + i * 0.15, 0.9)); b.userData.update(dt); b.visible = e > 0.02; });
      const ck = clamp01((now - cross) / 1.1);
      if (ck > 0 && ck < 1) { spark.position.set(-0.12 + ck * 0.24, BY + 0.0, 0.0); spark.material.opacity = Math.sin(ck * Math.PI) * 0.95; } else spark.material.opacity = 0;
      if (t > nextEmit) { emit(Math.floor(t / 2.5) % 2); nextEmit = t + 2.5; }
      pool.forEach((p) => {
        p.life += dt; if (p.life < 0 || p.life > p.max) { p.sp.material.opacity = 0; return; }
        p.sp.position.addScaledVector(p.v, dt); p.v.y -= dt * 0.015; const a = p.life / p.max;
        p.sp.material.opacity = Math.sin(a * Math.PI);
      });
      tagL.visible = tagR.visible = t > 1.4; setSpr(tagL, 0.17, clamp01((t - 1.4) * 1.6) * e); setSpr(tagR, 0.17, clamp01((t - 1.6) * 1.6) * e);
      H.update(t, e);
    },
  };
}
