import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { P, ease, easeBack, clamp01, stag, mat, glossy, goldMat, shadowed, glow, sprite } from '../../kit.js?v=15';
import { inked } from '../../pencil.js?v=15';
import { Rig, retext, V, TAU } from '../lib/a5-kit.js?v=15';

export const meta = { free: true, center: [0.3, 0.72], typeLabel: 'نسيج التعلّم' };

const N = 14, CELL = 0.026;
const ACC = [0x2a8fd0, 0xef8f2a, 0x2fa38a, 0xe3b23c, 0xe0452c].map((c) => new THREE.Color(c));
const CREAM = new THREE.Color(0xe9dcc0), CREAM2 = new THREE.Color(0xd9c9a4);

function gadTex() {
  const c = document.createElement('canvas'); c.width = 256; c.height = 160; const g = c.getContext('2d');
  const gr = g.createLinearGradient(0, 0, 256, 160); gr.addColorStop(0, '#3f5fa8'); gr.addColorStop(1, '#1f2f63'); g.fillStyle = gr; g.fillRect(0, 0, 256, 160);
  g.fillStyle = 'rgba(255,255,255,.55)'; for (let i = 0; i < 4; i++) { g.beginPath(); g.roundRect(24, 26 + i * 30, 120 - i * 14, 12, 6); g.fill(); }
  g.fillStyle = '#ef8f2a'; g.beginPath(); g.arc(200, 60, 22, 0, Math.PI * 2); g.fill();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
const BLK = [
  { t: 'نسيج المجتمع', n: 'التكنولوجيا جزء من نسيج المجتمع أيضاً، لا مظهر خارجي للتقدّم.', c: 0x6fcf6a },
  { t: 'ليست ترفاً', n: 'ليست مجرد ترف بل مكوّن أصيل في العملية التعليمية.', c: 0x2a8fd0 },
  { t: 'فقر علمي', n: 'المعلم أو الإعلامي غير الملمّ بالمستحدثات يُعدّ في أحضان الفقر العلمي.', c: 0xe0452c },
];
export default function build(ctx) {
  const g = new THREE.Group(); g.position.copy(P(meta.center[0], meta.center[1])); g.scale.setScalar(1.15); g.position.x += 0.05; ctx.stage.add(g);
  const rig = new Rig(ctx);

  // loom frame
  const FR = N * CELL / 2 + 0.03;
  const bars = [[0, -FR, FR * 2 + 0.03, 0.026], [0, FR, FR * 2 + 0.03, 0.026]].map(([x, z, w, d]) => { const b = inked(new RoundedBoxGeometry(w, 0.03, d, 2, 0.008), { color: 0xd8a96c }); b.position.set(x, 0.015, z); g.add(b); return b; });
  const sides = [-FR, FR].map((x) => { const b = inked(new RoundedBoxGeometry(0.026, 0.03, FR * 2, 2, 0.008), { color: 0xd8a96c }); b.position.set(x, 0.015, 0); g.add(b); return b; });
  [...bars, ...sides].forEach((b, i) => rig.ink(b, 0.1 + i * 0.12, 0.9));

  // woven cloth: instanced warp (along z) and weft (along x) pieces
  const cnt = N * N;
  const warp = new THREE.InstancedMesh(new RoundedBoxGeometry(0.0125, 0.0055, CELL * 1.18, 1, 0.002), new THREE.MeshStandardMaterial({ roughness: 0.75 }), cnt);
  const weft = new THREE.InstancedMesh(new RoundedBoxGeometry(CELL * 1.18, 0.0055, 0.0125, 1, 0.002), new THREE.MeshStandardMaterial({ roughness: 0.75 }), cnt);
  g.add(warp, weft); [warp, weft].forEach((m) => { m.castShadow = m.receiveShadow = true; });
  const dm = new THREE.Object3D(), col = new THREE.Color();
  const cells = []; for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) cells.push({ i, j, x: (i - (N - 1) / 2) * CELL, z: (j - (N - 1) / 2) * CELL, d: Math.hypot(i - (N - 1) / 2, j - (N - 1) / 2) });

  // the gadget: laptop + toy blocks
  const gad = new THREE.Group(); g.add(gad);
  const lb = new THREE.Mesh(new RoundedBoxGeometry(0.1, 0.008, 0.07, 2, 0.003), glossy(0xdfe4ea)); lb.position.y = 0.004; gad.add(shadowed(lb));
  const hg = new THREE.Group(); hg.position.set(0, 0.008, -0.034); hg.rotation.x = -0.35; gad.add(hg);
  const ls = new THREE.Mesh(new RoundedBoxGeometry(0.1, 0.066, 0.006, 2, 0.003), glossy(0xdfe4ea)); ls.position.y = 0.033; hg.add(shadowed(ls));
  const lf = new THREE.Mesh(new THREE.PlaneGeometry(0.09, 0.056), new THREE.MeshBasicMaterial({ map: gadTex(), toneMapped: true })); lf.position.set(0, 0.033, 0.0035); hg.add(lf);
  const bk = [[0x6fcf6a, -0.07, 0.03], [0x2a8fd0, 0.07, 0.035], [0xe0452c, 0.0, 0.07]].map(([c, x, z], i) => { const b = new THREE.Mesh(new RoundedBoxGeometry(0.03, 0.03, 0.03, 2, 0.004), glossy(c)); b.position.set(x, 0.015, z); b.rotation.y = i; gad.add(shadowed(b)); return b; });
  const halo = glow(0xffd9a0, 0.2, 0.3); halo.position.y = 0.04; gad.add(halo);
  const shuttle = new THREE.Group(); const sb = new THREE.Mesh(new THREE.CapsuleGeometry(0.008, 0.05, 6, 12), glossy(0xb06a2a)); sb.rotation.z = Math.PI / 2; shuttle.add(sb); const sp = new THREE.Mesh(new THREE.TorusGeometry(0.007, 0.002, 6, 12), goldMat()); shuttle.add(sp); g.add(shadowed(shuttle));

  BLK.forEach((b, i) => { rig.touch(bk[i], (hh) => { taps.add('b' + i); ctx.sfx.pop?.(); ctx.fx.burst(bk[i].position.clone().setY(0.06), b.c, 18, 0.3, 0.03); ctx.ui.card({ tag: 'نظرة الدول المتقدمة', title: b.t, body: b.n, color: b.c }); chk(); hh.on = false; }, { color: b.c, size: 0.1, show: 4 + i * 0.3 }); });
  const tag = sprite('مظهر خارجي', 0.22, { size: 50, width: 420, weight: 800, border: '#8fa6b5' }); tag.userData.w = 0.22; tag.position.set(0, 0.012, FR + 0.075); g.add(tag);

  let taps = new Set(); let m = 0, mT = 0, now = 0, seenA = false, seenB = false, finished = false, autoAt = 3.0, auto = false, lastTag = '';
  const info = (b) => {
    if (b) { ctx.ui.card({ tag: 'نظرة الدول المتقدمة', title: 'جزء من نسيج التعلّم', body: 'التكنولوجيا جزء من نسيج العملية التعليمية والمجتمع، لا مجرد ترف ولا مظهر خارجي للتقدّم.', color: 0x2fa38a }); seenB = true; }
    else { ctx.ui.card({ tag: 'الاعتقاد السائد', title: 'مستحدثات مستوردة', body: 'أن التكنولوجيا استيراد أجهزة ومواد، ومجاراة للتقدّم، ونوع من الرفاهية.', color: 0x8fa6b5 }); seenA = true; }
    chk();
  };
  const chk = () => { if (!finished && seenA && seenB && taps.size >= 4) { finished = true; setTimeout(() => ctx.ui.done(), 1000); } };
  rig.touch(gad, (hh) => { mT = mT ? 0 : 1; auto = true; ctx.sfx.whoosh?.(); taps.add('g'); info(!!mT); hh.on = false; }, { color: 0x6fb0ff, size: 0.2, at: V(0, 0.04, 0), show: 6 });
  rig.touch(shuttle, (hh) => { taps.add('s'); ctx.sfx.pop?.(); ctx.fx.burst(shuttle.position.clone().setY(0.06), 0xef8f2a, 18, 0.3, 0.03); ctx.ui.card({ tag: 'المكوك', title: 'خيط يدخل النسيج', body: 'حين يُنسج الخيط في القماش يصير جزءاً منه لا يُنزع كما تُنزع الزينة.', color: 0xef8f2a }); chk(); hh.on = false; }, { color: 0xef8f2a, size: 0.12, show: 6.4 });
  const hit = new THREE.Mesh(new THREE.BoxGeometry(FR * 2, 0.02, FR * 2), new THREE.MeshBasicMaterial({ visible: false })); hit.position.y = 0.02; g.add(hit);
  ctx.tap(hit, () => { taps.add('c'); ctx.sfx.pop?.(); ctx.ui.card({ tag: 'المستفيد', title: 'المستفيد الحقيقي', body: 'في الاعتقاد السائد يُنسى المستفيد الحقيقي، أما في نظرة الدول المتقدمة فالتكنولوجيا في صميم العملية التعليمية.', color: 0xd4ad55 }); chk(); });
  ctx.ui.hud('المس الجهاز: زينة أم نسيج؟');

  return {
    update(t, dt, e) {
      now = t; rig.update(t, dt, e);
      if (!auto && t > autoAt) { auto = true; mT = 1; }
      m += (mT - m) * Math.min(1, dt * 0.9); const M = m;
      const wave = M * 11;
      const rise = (k) => stag(t, 0.3 + k * 0.012, 0.6, ease) * e;
      cells.forEach((c, n) => {
        const r = rise(c.d + (c.i % 3) * 0.2), par = (c.i + c.j) % 2 ? 1 : -1;
        const w = clamp01((wave - c.d) / 1.8);
        const undul = Math.sin(t * 1.2 + c.d * 0.8) * 0.0025 * w;
        dm.position.set(c.x, 0.032 + par * 0.0026 + undul + (1 - r) * 0.1, c.z); dm.rotation.set(0, 0, 0); dm.scale.setScalar(Math.max(r, 0.0001)); dm.updateMatrix(); warp.setMatrixAt(n, dm.matrix);
        dm.position.y = 0.032 - par * 0.0026 + undul + (1 - r) * 0.1; dm.updateMatrix(); weft.setMatrixAt(n, dm.matrix);
        const a = ACC[(Math.floor(c.d * 0.8)) % ACC.length], b = ACC[(Math.floor(c.d * 0.8) + 2) % ACC.length];
        col.copy((c.i + c.j) % 2 ? CREAM : CREAM2).lerp(a, w * 0.9); warp.setColorAt(n, col);
        col.copy((c.i + c.j) % 2 ? CREAM2 : CREAM).lerp(b, w * ((c.j % 2) ? 0.9 : 0.35)); weft.setColorAt(n, col);
      });
      warp.instanceMatrix.needsUpdate = weft.instanceMatrix.needsUpdate = true; warp.instanceColor.needsUpdate = weft.instanceColor.needsUpdate = true;
      const L = ease(M);
      const gk = stag(t, 0.9, 0.9, easeBack) * e;
      gad.position.set(0, 0.15 * (1 - L) + 0.037 * L + Math.sin(t * 1.5) * 0.007 * (1 - L), 0); gad.scale.setScalar(Math.max(gk, 0.001)); gad.rotation.y = Math.sin(t * 0.5) * 0.6 * (1 - L);
      halo.material.opacity = (0.25 + 0.2 * L + 0.1 * Math.sin(t * 2)) * gk;
      bk.forEach((b, i) => { b.position.y = 0.015 + Math.sin(t * 1.3 + i) * 0.003 * (1 - L); });
      const sx = Math.sin(t * 1.6) * (FR - 0.03) * (0.2 + 0.8 * L);
      shuttle.position.set(sx, 0.05 + 0.02 * (1 - L), THREE.MathUtils.lerp(FR - 0.02, Math.sin(t * 0.7) * 0.5 * (FR - 0.04), L));
      shuttle.scale.setScalar(Math.max(stag(t, 3.0, 0.6, easeBack) * e, 0.001));
      const want = M > 0.5 ? 'جزء من النسيج' : 'مظهر خارجي';
      if (want !== lastTag) { lastTag = want; retext(tag, want, 0.22, { size: 50, width: 420, weight: 800, border: M > 0.5 ? '#2fa38a' : '#8fa6b5' }); }
      const tk = stag(t, 2.2, 0.6, easeBack) * e; tag.scale.set(tag.userData.w * tk + 0.0001, tag.userData.w * tag.userData.aspect * tk + 0.0001, 1);
      g.rotation.y = Math.sin(t * 0.25) * 0.05;
    },
  };
}
