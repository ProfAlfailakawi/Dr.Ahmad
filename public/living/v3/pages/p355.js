// p355 — a small night city on a navy hexagon; three signal balloons drift to whichever situation you touch and name the Google tool it needs.
import * as THREE from 'three';
import { P, ease, easeBack, clamp01, stag, mat, glossy, goldMat, shadowed } from '../../kit.js?v=15';
import { TAU, canvasTex, rbox, lit, rig, hints, burstAt, lightPool, tagSprite, setSpr, hexSlab, twinkles } from '../lib/a7.js?v=15';

export const meta = { free: true, center: [0.4, 0.5], typeLabel: 'مجسّم تفاعلي' };

const TOOLS = [
  { k: 'earth', tool: 'Google Earth', t: 'جولة بصرية حول العالم', b: 'يصطحب المدرّس طلابه في جولة بصرية لمختلف أنحاء العالم.', c: 0x3aa0e8 },
  { k: 'news', tool: 'Google News', t: 'على اطلاع بالمستجدات', b: 'يستقي الموقع أخباره من مصادر رئيسة، فيبقى المدرّس والطلاب على اطلاع بآخر المستجدات.', c: 0xe8b23a },
  { k: 'goggles', tool: 'Google Goggles', t: 'الصورة بدل الكتابة', b: 'يصوّر الطالب غلاف كتاب أو شعاراً بكاميرا هاتفه ويبحث عنه دون كتابة كلمات البحث.', c: 0xe0605a },
  { k: 'photos', tool: 'Google Photos', t: 'مخزن صور المشروع', b: 'خدمة لتخزين الصور على الإنترنت تحفظ مجموعة صور المشروع.', c: 0x7bc86a },
  { k: 'translate', tool: 'Google Translate', t: 'رسالة المعلّم لولي الأمر', b: 'يترجم النص إلى ٩٠ لغة للتواصل مع الطلاب وأولياء الأمور الذين لا يشاركون المدرسة اللغة.', c: 0x5a7bf0 },
  { k: 'images', tool: 'Google Images', t: 'صور حول موضوع البحث', b: 'يبحث الطالب بالاسم أو الموضوع فيحصل على كمّ كبير من الصور.', c: 0xb05ad8 },
];

function globeMini() {
  return canvasTex(256, 128, (g, W, H) => {
    g.fillStyle = '#2a79c8'; g.fillRect(0, 0, W, H); g.fillStyle = '#dfeeda';
    [[60, 50, 30, 20], [120, 70, 22, 30], [190, 45, 36, 16], [215, 85, 14, 10], [30, 90, 18, 10]].forEach(([x, y, a, b]) => { g.beginPath(); g.ellipse(x, y, a, b, 0.4, 0, TAU); g.fill(); });
  });
}
function awningTex() {
  return canvasTex(128, 32, (g, W, H) => { for (let i = 0; i < 8; i++) { g.fillStyle = i % 2 ? '#fff6dc' : '#e8b23a'; g.fillRect(i * 16, 0, 16, H); } });
}
function galleryTex() {
  return canvasTex(256, 192, (g, W, H) => {
    g.fillStyle = '#f7f4ea'; g.fillRect(0, 0, W, H);
    const cols = ['#e0605a', '#3aa0e8', '#e8b23a', '#7bc86a', '#b05ad8', '#f08a3a'];
    for (let i = 0; i < 6; i++) { const x = 14 + (i % 3) * 80, y = 14 + Math.floor(i / 3) * 86; g.fillStyle = cols[i]; g.fillRect(x, y, 70, 74); g.fillStyle = 'rgba(255,255,255,.55)'; g.beginPath(); g.arc(x + 20, y + 22, 9, 0, TAU); g.fill(); g.beginPath(); g.moveTo(x, y + 74); g.lineTo(x + 28, y + 40); g.lineTo(x + 48, y + 58); g.lineTo(x + 58, y + 46); g.lineTo(x + 70, y + 74); g.fill(); }
  });
}

export default function build(ctx) {
  const g = new THREE.Group(); g.position.copy(P(meta.center[0], meta.center[1])); ctx.stage.add(g); g.scale.setScalar(1.0);
  const R = rig(), H = hints(g);
  const seen = new Set(); let done = false;

  // ---- navy hexagon with a light-blue frame, like the printed one, and a mint hill on top
  const base = new THREE.Group(); g.add(base);
  const plate = new THREE.Mesh(rbox(0.68, 0.03, 0.5, 0.03), glossy(0x7fd3cc, { roughness: 0.45 })); plate.position.y = 0.015; base.add(plate);
  const roadA = new THREE.Mesh(rbox(0.66, 0.003, 0.05, 0.001), mat(0x3f9f9c)); roadA.position.set(0, 0.031, 0); base.add(roadA);
  const roadB = new THREE.Mesh(rbox(0.05, 0.003, 0.48, 0.001), mat(0x3f9f9c)); roadB.position.set(0, 0.031, 0); base.add(roadB);
  const sh = lightPool(0x000000, 0.5, 0.22); sh.position.y = -0.002; base.add(sh);
  R.add(base, 0.1, { dur: 0.9, rise: 0.06 });
  const GY = 0.032;
  const stars = twinkles(g, 14, 0.62, 0.42, 0.5, 0xffe9a6, 0.03);

  // ---- six little situations, each a tiny model on its own pad
  const pad = (r = 0.047, c = 0xf8fbfb) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 1.05, 0.008, 36), glossy(c)); m.position.y = 0.004; return m; };
  const makers = {
    earth() {
      const o = new THREE.Group(); o.add(pad());
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.009, 0.06, 12), goldMat()); pole.position.y = 0.036; o.add(pole);
      const gl = new THREE.Mesh(new THREE.SphereGeometry(0.036, 32, 20), glossy(0xffffff, { map: globeMini() })); gl.position.y = 0.092; o.add(gl); o.userData.spin = gl; return o;
    },
    news() {
      const o = new THREE.Group(); o.add(pad());
      const b = new THREE.Mesh(rbox(0.058, 0.04, 0.04, 0.004), glossy(0xf1e6c8)); b.position.y = 0.028; o.add(b);
      const aw = new THREE.Mesh(rbox(0.07, 0.008, 0.05, 0.003), new THREE.MeshStandardMaterial({ map: awningTex(), roughness: 0.6 })); aw.position.set(0, 0.068, 0.006); aw.rotation.x = 0.2; o.add(aw);
      const pp = new THREE.Mesh(rbox(0.026, 0.004, 0.034, 0.001), mat(0xffffff)); pp.position.set(0.013, 0.05, 0.022); pp.rotation.set(-0.2, 0.2, 0); o.add(pp); return o;
    },
    goggles() {
      const o = new THREE.Group(); o.add(pad());
      const book = new THREE.Mesh(rbox(0.036, 0.009, 0.046, 0.002), glossy(0xe0605a)); book.position.set(0, 0.014, 0.012); o.add(book);
      const cam = new THREE.Mesh(rbox(0.05, 0.034, 0.03, 0.006), glossy(0x242c40)); cam.position.set(0, 0.07, -0.008); cam.rotation.x = 0.5; o.add(cam);
      const len = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.014, 0.018, 24), glossy(0x7fb6e8)); len.rotation.x = Math.PI / 2 + 0.5; len.position.set(0, 0.058, 0.009); o.add(len);
      const st = new THREE.Mesh(new THREE.CylinderGeometry(0.003, 0.004, 0.05, 8), goldMat()); st.position.set(0, 0.035, -0.014); o.add(st);
      const brk = new THREE.Group(); [[1, 1], [-1, 1], [1, -1], [-1, -1]].forEach(([a, b]) => { const l = new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.001, 0.0018), lit(0xffd27a)); l.position.set(a * 0.026, 0.02, 0.012 + b * 0.029); brk.add(l); }); o.add(brk); return o;
    },
    photos() {
      const o = new THREE.Group(); o.add(pad());
      const cl = new THREE.Group(); [[0, 0, 0.026], [-0.026, -0.006, 0.019], [0.027, -0.006, 0.02], [0.01, 0.014, 0.018]].forEach(([x, y, r]) => { const s = new THREE.Mesh(new THREE.SphereGeometry(r, 20, 14), glossy(0xffffff)); s.position.set(x, y, 0); cl.add(s); }); cl.position.y = 0.08; o.add(cl);
      [0, 1, 2].forEach((i) => { const f = new THREE.Mesh(rbox(0.03, 0.022, 0.003, 0.002), glossy([0x7bc86a, 0xe8b23a, 0xe0605a][i])); f.position.set(-0.03 + i * 0.03, 0.03 + (i % 2) * 0.008, 0.03); f.rotation.z = (i - 1) * 0.18; o.add(f); } ); o.userData.cloud = cl; return o;
    },
    translate() {
      const o = new THREE.Group(); o.add(pad());
      const b = new THREE.Mesh(rbox(0.05, 0.032, 0.04, 0.004), glossy(0xf4efe0)); b.position.y = 0.024; o.add(b);
      const roof = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.026, 4), glossy(0xe0605a)); roof.rotation.y = Math.PI / 4; roof.position.y = 0.053; o.add(roof);
      const b1 = new THREE.Mesh(rbox(0.04, 0.026, 0.008, 0.01), glossy(0x5a7bf0)); b1.position.set(-0.02, 0.098, 0); o.add(b1);
      const b2 = new THREE.Mesh(rbox(0.04, 0.026, 0.008, 0.01), glossy(0x7bc86a)); b2.position.set(0.024, 0.114, 0); o.add(b2); o.userData.b = [b1, b2]; return o;
    },
    images() {
      const o = new THREE.Group(); o.add(pad());
      const fr = new THREE.Mesh(rbox(0.07, 0.054, 0.008, 0.003), glossy(0x242c40)); fr.position.y = 0.047; o.add(fr);
      const im = new THREE.Mesh(new THREE.PlaneGeometry(0.062, 0.046), new THREE.MeshBasicMaterial({ map: galleryTex(), toneMapped: false })); im.position.set(0, 0.047, 0.0045); o.add(im);
      [-0.025, 0.025].forEach((x) => { const lg = new THREE.Mesh(new THREE.CylinderGeometry(0.003, 0.003, 0.03, 8), goldMat()); lg.position.set(x, 0.015, -0.006); o.add(lg); }); return o;
    },
  };
  const spots = TOOLS.map((_, i) => { return new THREE.Vector3(((i % 3) - 1) * 0.22, GY, (Math.floor(i / 3) - 0.5) * 0.2 + 0.02); });
  const items = TOOLS.map((d, i) => {
    const o = makers[d.k](); o.position.copy(spots[i]); o.scale.setScalar(1.7); g.add(o); shadowed(o);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.052, 0.003, 8, 40), lit(d.c, 0)); ring.rotation.x = Math.PI / 2; ring.position.y = 0.01; o.add(ring);
    R.add(o, 1.0 + i * 0.2, { dur: 0.7, rise: 0.1 });
    H.add(o.children[0], d.c, 0.15);
    const it = { d, o, ring, lit: 0 };
    ctx.tap(o, () => pick(it));
    return it;
  });

  // ---- three balloons with antennas
  const balloons = [[-0.2, 0.4, -0.12, 1.0], [0.02, 0.5, -0.02, 1.35], [0.22, 0.38, -0.12, 0.9]].map(([x, y, z, s], i) => {
    const b = new THREE.Group(); b.position.set(x, y, z); b.scale.setScalar(s); g.add(b);
    const env = new THREE.Mesh(new THREE.SphereGeometry(0.058, 32, 24), new THREE.MeshPhysicalMaterial({ color: 0xdfe9fb, roughness: 0.15, transmission: 0, clearcoat: 1, transparent: true, opacity: 0.88 })); env.scale.y = 1.2; b.add(env);
    for (let k = 0; k < 4; k++) { const seam = new THREE.Mesh(new THREE.TorusGeometry(0.058, 0.0011, 6, 48), mat(0x8da6d8)); seam.rotation.y = (k / 4) * Math.PI; seam.scale.y = 1.2; b.add(seam); }
    const bs = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.011, 0.016, 16), goldMat()); bs.position.y = -0.09; b.add(bs);
    [-1, 1].forEach((sx) => { const ln = new THREE.Mesh(new THREE.CylinderGeometry(0.0007, 0.0007, 0.032, 4), mat(0x6a7aa0)); ln.position.set(sx * 0.016, -0.066, 0); ln.rotation.z = sx * 0.4; b.add(ln); });
    const an = new THREE.Mesh(new THREE.CylinderGeometry(0.0018, 0.0018, 0.04, 6), goldMat()); an.position.y = 0.092; b.add(an);
    const tip = new THREE.Mesh(new THREE.SphereGeometry(0.005, 12, 8), lit(0xffd27a)); tip.position.y = 0.114; b.add(tip);
    const rings = [0, 1, 2].map(() => { const r = new THREE.Mesh(new THREE.TorusGeometry(0.03, 0.0016, 6, 40), new THREE.MeshBasicMaterial({ color: 0xffe9a6, transparent: true, opacity: 0, depthWrite: false, toneMapped: false })); r.position.y = 0.114; r.rotation.x = Math.PI / 2; b.add(r); return r; });
    R.add(b, 2.0 + i * 0.3, { dur: 1.0, rise: 0.2 });
    return { b, home: new THREE.Vector3(x, y, z), tgt: new THREE.Vector3(x, y, z), s, rings, ph: i * 2, boost: 0 };
  });

  const tag = tagSprite('Google Earth', 0.3, 0x3aa0e8, { size: 36, pad: 16 }); tag.visible = false; g.add(tag);
  let cur = null, tagT = 0;
  function retag(text, color) {
    const s = tagSprite(text, 0.3, color, { size: 40, pad: 16 });
    tag.material.map.dispose(); tag.material.map = s.material.map; tag.userData.aspect = s.userData.aspect; tag.material.needsUpdate = true;
  }
  function pick(it) {
    ctx.sfx.pop?.(); H.seen(it.o.children[0]); R.bounce(it.o); burstAt(ctx, it.o, it.d.c, 18, 0.3, 0.025);
    cur = it; tagT = 0; retag(it.d.tool, it.d.c); it.lit = 1;
    // nearest balloon floats over it
    let best = balloons[0], bd = 9;
    balloons.forEach((bl) => { const d = bl.home.distanceTo(it.o.position); if (d < bd) { bd = d; best = bl; } });
    balloons.forEach((bl) => { bl.tgt.copy(bl.home); bl.boost = 0; });
    best.tgt.set(it.o.position.x * 0.85, 0.4, it.o.position.z * 0.85); best.boost = 1; cur.bl = best;
    ctx.ui.card({ tag: it.d.tool, title: it.d.t, body: it.d.b, color: it.d.c });
    seen.add(it.d.k);
    if (seen.size === 6 && !done) { done = true; setTimeout(() => { ctx.sfx.good?.(); ctx.ui.done(); }, 1200); }
  }

  ctx.ui.hud('المس موقفاً لتصله الأداة');
  return {
    update(t, dt, e) {
      R.update(t, dt, e); H.update(t, e, stag(t, 3.4, 0.6)); stars.update(t, e);
      balloons.forEach((bl) => {
        bl.b.position.x = THREE.MathUtils.damp(bl.b.position.x, bl.tgt.x + Math.sin(t * 0.6 + bl.ph) * 0.012, 1.8, dt);
        bl.b.position.y = THREE.MathUtils.damp(bl.b.position.y, bl.tgt.y + Math.sin(t * 0.9 + bl.ph) * 0.01, 1.8, dt);
        bl.b.position.z = THREE.MathUtils.damp(bl.b.position.z, bl.tgt.z, 1.8, dt);
        bl.rings.forEach((r, i) => { const k = ((t * 0.45 + i / 3 + bl.ph) % 1); const sc = 0.5 + k * 2.2; r.scale.setScalar(sc); r.material.opacity = (1 - k) * (bl.boost ? 0.9 : 0.4) * clamp01((t - 2.6) / 0.6) * e; });
      });
      items.forEach((it) => {
        it.lit = it === cur ? 1 : Math.max(0, it.lit - dt * 0.2);
        it.ring.material.opacity = it.lit * 0.9 * (0.7 + 0.3 * Math.sin(t * 5)); it.ring.visible = it.lit > 0.02;
        if (it.o.userData.spin) it.o.userData.spin.rotation.y += dt * 0.8;
        if (it.o.userData.cloud) it.o.userData.cloud.position.y = 0.08 + Math.sin(t * 1.4) * 0.004;
        if (it.o.userData.b) it.o.userData.b.forEach((b, i) => { b.position.y += Math.sin(t * 1.6 + i * 2) * 0.00008; });
      });
      if (cur) {
        tagT = Math.min(1, tagT + dt * 3);
        tag.visible = true; tag.position.set(cur.o.position.x, GY + 0.3, cur.o.position.z);
        setSpr(tag, 0.3, easeBack(tagT));
      }
    },
  };
}
