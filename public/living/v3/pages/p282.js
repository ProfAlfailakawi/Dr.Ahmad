import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { P, ease, easeBack, clamp01, stag, mat, glossy, goldMat, shadowed, glow } from '../../kit.js?v=19';
import { inked } from '../../pencil.js?v=19';
import { Rig, iconTexture, badge, V, TAU, css } from '../lib/a5-kit.js?v=19';

export const meta = { free: true, center: [0.65, 0.74], typeLabel: 'رفّ تفاعلي' };

const BOOKS = [
  { k: 'clock', c: 0x2a6fd0, t: 'في أي وقت ومكان', n: 'يستخدمه الطالب متى شاء، فلا يعيقه زمان أو مكان.' },
  { k: 'screen', c: 0xef8f2a, t: 'بلا قاعات مخصصة', n: 'لا يحتاج إلى قاعات دراسية، ويمكن قراءة نصوصه بأجهزة كمبيوترية مختلفة.' },
  { k: 'loop', c: 0x1f3f7a, t: 'استخدام متكرر', n: 'يعود إليه الطالب عدة مرات وباستمرار، فتزيد مشاركته الإيجابية ويكتسب الخبرة.' },
  { k: 'pencil', c: 0x2fb3b8, t: 'تفاعل مع المقرر', n: 'يكتب الملحوظات ويظلّل الأجزاء ويضيف الرسومات، ويشارك في إعداد المادة العلمية.' },
  { k: 'spark', c: 0xf08a30, t: 'حداثة المعلومات', n: 'يتيح معلومات أكثر حداثة مما يقدّمه الكتاب التقليدي.' },
  { k: 'check', c: 0xe0452c, t: 'تقييم إلكتروني', n: 'يتم التقييم بالاتصال المباشر بين الطلاب والمادة، بحلقة أو رابط بموقع المؤلف.' },
];

function screenTex() {
  const c = document.createElement('canvas'); c.width = 512; c.height = 340; const g = c.getContext('2d');
  const gr = g.createRadialGradient(256, 340, 20, 256, 200, 380); gr.addColorStop(0, '#3d6fc4'); gr.addColorStop(0.5, '#1f3f7a'); gr.addColorStop(1, '#0f2147');
  g.fillStyle = gr; g.fillRect(0, 0, 512, 340);
  g.strokeStyle = 'rgba(255,255,255,.07)'; g.lineWidth = 2;
  for (let i = 1; i < 12; i++) { g.beginPath(); g.moveTo(i * 43, 0); g.lineTo(i * 43, 340); g.stroke(); }
  for (let j = 1; j < 8; j++) { g.beginPath(); g.moveTo(0, j * 43); g.lineTo(512, j * 43); g.stroke(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

export default function build(ctx) {
  const g = new THREE.Group(); g.position.copy(P(meta.center[0], meta.center[1])); g.scale.setScalar(1.22); g.position.x -= 0.06; ctx.stage.add(g);
  const rig = new Rig(ctx);

  // laptop ------------------------------------------------------------
  const lap = new THREE.Group(); g.add(lap);
  const base = inked(new RoundedBoxGeometry(0.46, 0.02, 0.3, 3, 0.008), { color: 0xdfe4ea }); base.position.y = 0.01; lap.add(base); rig.ink(base, 0.1, 1.1);
  const keys = new THREE.InstancedMesh(new RoundedBoxGeometry(0.026, 0.008, 0.022, 1, 0.003), mat(0x4b5563, { roughness: 0.5 }), 60);
  const dm = new THREE.Object3D(); let ki = 0;
  for (let r = 0; r < 5; r++) for (let c = 0; c < 12; c++) { dm.position.set(-0.165 + c * 0.03, 0.023, -0.08 + r * 0.027); dm.updateMatrix(); keys.setMatrixAt(ki++, dm.matrix); }
  lap.add(keys);
  const pad = new THREE.Mesh(new RoundedBoxGeometry(0.1, 0.004, 0.05, 1, 0.002), mat(0xc4cbd4)); pad.position.set(0, 0.021, 0.115); lap.add(pad);
  const hinge = new THREE.Group(); hinge.position.set(0, 0.02, -0.14); hinge.rotation.x = -0.28; lap.add(hinge);
  const scr = inked(new RoundedBoxGeometry(0.46, 0.31, 0.012, 3, 0.008), { color: 0xdfe4ea }); scr.position.y = 0.155; hinge.add(scr); rig.ink(scr, 0.3, 1.1);
  const face = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.275), new THREE.MeshBasicMaterial({ map: screenTex(), toneMapped: false, transparent: true, opacity: 0 }));
  face.position.set(0, 0.155, 0.0068); hinge.add(face);
  const halo = glow(0x6fb0ff, 0.5, 0); halo.position.set(0, 0.17, 0.02); hinge.add(halo);

  // books rising from the screen ----------------------------------------
  const books = [];
  const bz = -0.045;
  BOOKS.forEach((b, i) => {
    const w = 0.056, h = 0.17 + (i % 3) * 0.012, d = 0.115;
    const cover = new THREE.MeshStandardMaterial({ map: iconTexture(b.k, { bg: css(b.c), size: 256, color: '#f7e7b5' }), roughness: 0.45 });
    const plain = mat(b.c, { roughness: 0.45 }), pages = mat(0xf6efdc, { roughness: 0.8 });
    const body = new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 2, 0.004), [cover, cover, pages, pages, plain, pages]);
    body.position.y = h / 2 + 0.02;
    const band1 = new THREE.Mesh(new THREE.BoxGeometry(w * 1.02, 0.006, 0.004), goldMat()); band1.position.set(0, h * 0.8 + 0.02, d / 2); 
    const band2 = band1.clone(); band2.position.y = h * 0.25 + 0.02;
    const grp = new THREE.Group(); grp.add(body, band1, band2); shadowed(grp);
    const x = (i - 2.5) * 0.075;
    grp.position.set(x, 0, bz); lap.add(grp);
    const badgeS = badge(b.k, b.c, 0.06); badgeS.position.set(0, h + 0.1, 0); badgeS.visible = false; grp.add(badgeS);
    books.push({ grp, b, i, h, x, open: 0, tgt: 0, seen: false, badge: badgeS, phase: i * 0.8 });
  });

  // sheets of paper drifting out of the screen
  const sheets = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.03, 0.04), new THREE.MeshBasicMaterial({ color: 0xfff6dc, side: THREE.DoubleSide, transparent: true, opacity: 0.9, toneMapped: false }), 16);
  g.add(sheets);
  const sd = Array.from({ length: 16 }, (_, i) => ({ x: (Math.random() - 0.5) * 0.36, ph: Math.random(), sp: 0.05 + Math.random() * 0.06, r: Math.random() * TAU }));

  let openIdx = -1, found = 0, finished = false, now = 0;
  books.forEach((bk) => {
    rig.touch(bk.grp, (hh) => {
      ctx.sfx.pop?.();
      if (openIdx === bk.i) { bk.tgt = 0; openIdx = -1; ctx.ui.hideCard(); return; }
      if (openIdx >= 0) books[openIdx].tgt = 0;
      openIdx = bk.i; bk.tgt = 1;
      ctx.fx.burst(V(bk.x, 0.25, bz + 0.1).multiplyScalar(1.0).add(g.position).sub(g.position), bk.b.c, 24, 0.35, 0.03);
      ctx.ui.card({ tag: 'ميزة', title: bk.b.t, body: bk.b.n, color: bk.b.c });
      if (!bk.seen) { bk.seen = true; found++; ctx.ui.hud(`فتحتَ ${found} من ${BOOKS.length} كتب`); if (found === BOOKS.length && !finished) { finished = true; setTimeout(() => ctx.ui.done(), 1200); } }
      hh.on = false;
    }, { color: bk.b.c, size: 0.16, at: V(0, bk.h * 0.55 + 0.02, 0.06), show: 3.2 + bk.i * 0.2 });
  });
  ctx.ui.hud('المس كتاباً ليخرج من الشاشة');

  return {
    update(t, dt, e) {
      now = t; rig.update(t, dt, e);
      const fo = stag(t, 0.4, 0.8) * e; face.material.opacity = fo;
      halo.material.opacity = 0.35 * fo * (0.8 + 0.2 * Math.sin(t * 1.4));
      keys.scale.setScalar(Math.max(stag(t, 0.6, 0.8) * e, 0.001));
      books.forEach((bk) => {
        bk.open += (bk.tgt - bk.open) * Math.min(1, dt * 5);
        const p = stag(t, 0.9 + bk.i * 0.22, 0.9, easeBack) * e;
        const o = ease(bk.open);
        bk.grp.visible = p > 0.01;
        bk.grp.scale.set(1, Math.max(p, 0.001), 1);
        const wave = Math.sin(t * 1.3 + bk.phase) * 0.005 * (1 - o);
        bk.grp.position.set(bk.x + (0 - bk.x) * 0 , wave + o * 0.045, bz + (1 - Math.min(p, 1)) * -0.09 + o * 0.115);
        bk.grp.rotation.y = -o * Math.PI / 2;
        bk.grp.rotation.x = -o * 0.18;
        bk.badge.visible = o > 0.05; bk.badge.scale.setScalar(0.06 * o);
        bk.badge.position.set(0, bk.h + 0.07 + Math.sin(t * 2) * 0.006, 0);
      });
      for (let i = 0; i < sd.length; i++) {
        const s = sd[i]; const k = (t * s.sp + s.ph) % 1;
        dm.position.set(s.x + Math.sin(t + i) * 0.03, 0.12 + k * 0.32, -0.15 + k * 0.05);
        dm.rotation.set(k * 5 + s.r, t * 0.8 + s.r, 0.3); dm.scale.setScalar(Math.max(Math.sin(k * Math.PI) * stag(t, 1.2 + i * 0.1, 1) * e, 0.0001)); dm.updateMatrix(); sheets.setMatrixAt(i, dm.matrix);
      }
      sheets.instanceMatrix.needsUpdate = true;
      lap.rotation.y = Math.sin(t * 0.3) * 0.05;
    },
  };
}
