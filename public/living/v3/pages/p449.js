// p449 — the future kitchen: a lamp projects a floating recipe book onto the counter; a remote sets the plates by itself.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { P, ease, easeBack, clamp01, stag, mat, glossy, goldMat, shadowed, glow } from '../../kit.js?v=37';
import { inked } from '../../pencil.js?v=37';
import { lightPool } from '../../v2/common.js?v=37';
import { Seq, Hints, Tag, TAU, V, wpos, softShadow } from '../lib/a9-kit.js?v=37';

export const meta = { free: true, center: [0.5, 0.542], typeLabel: 'مطبخ من ضوء', title: 'المطبخ المستقبلي' };

const CARDS = {
  lamp: { t: 'المطبخ المستقبلي', tag: 'مطبخ المستقبل', b: 'من الاختراعات المستقبلية التي ستجد لها مكاناً بيننا، وهو موجه بالدرجة الأولى لربة البيت والعاملين في المهن المطبخية.', c: 0x2a8fd0 },
  book: { t: 'كتاب الطبخ المُسقَط', tag: 'وصفة مسقطة', b: 'يعرض الوصفات بتقنية الإسقاط ثلاثي الأبعاد، ويوفر الراحة التي يحتاجها الطاهي أثناء الطبخ أو قراءة الوصفات.', c: 0x2fae8f },
  pad: { t: 'تعليم الطعام', tag: 'تعليم الطهي', b: 'قد يحوّل هذا المطبخ تعليم صنع الطعام من تعليم فندقي تقليدي إلى تعليم في إطار التقدم التكنولوجي.', c: 0xef8f2a },
  plates: { t: 'أطباق يُتحكم بها عن بعد', tag: 'عن بُعد', b: 'أطباق مستقبلية يُتحكم بها عن بعد عبر جهاز، فيصبح ترتيب الطاولة سهلاً بالكبس على بعض الأزرار.', c: 0xd4ad55 },
};

function woodTex() {
  const c = document.createElement('canvas'); c.width = 512; c.height = 128; const x = c.getContext('2d');
  x.fillStyle = '#d8bd96'; x.fillRect(0, 0, 512, 128);
  for (let i = 0; i < 46; i++) { x.fillStyle = `rgba(${150 + (i * 7) % 40},${110 + (i * 5) % 30},${70 + (i * 3) % 20},${0.12 + (i % 5) * 0.04})`; x.fillRect(0, (i * 2.9) % 128, 512, 1 + (i % 3)); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function recipeTex(seed) {
  const c = document.createElement('canvas'); c.width = 256; c.height = 320; const x = c.getContext('2d');
  x.clearRect(0, 0, 256, 320); x.fillStyle = 'rgba(20,140,205,0.95)'; x.fillRect(24, 28, 140, 14);
  x.fillStyle = 'rgba(20,140,205,0.6)';
  for (let i = 0; i < 9; i++) x.fillRect(24, 66 + i * 22, 208 - ((i * 37 + seed * 29) % 70), 8);
  x.strokeStyle = 'rgba(20,140,205,0.95)'; x.lineWidth = 5; x.strokeRect(10, 10, 236, 300);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

const QI = new THREE.Quaternion();
export default function build(ctx) {
  const g = new THREE.Group(); g.position.copy(P(meta.center[0], meta.center[1])); ctx.stage.add(g); g.scale.setScalar(0.9);
  const seq = new Seq(), hints = new Hints(g, 6.0), tag = new Tag(g, 0.2);
  const white = glossy(0xf5f2ea, { roughness: 0.2 });
  const seen = new Set(); let finished = false, now = 0;

  const counter = new THREE.Mesh(new RoundedBoxGeometry(0.78, 0.03, 0.4, 3, 0.012), new THREE.MeshStandardMaterial({ map: woodTex(), roughness: 0.4 })); counter.position.y = 0.055; g.add(shadowed(counter));
  const shadow = softShadow(0.9, 0.5, 0.3); g.add(shadow);
  const edge = new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.01, 0.01)); edge.visible = false;
  [-0.34, 0.34].forEach((x) => [-0.15, 0.15].forEach((z) => { const l = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.006, 0.07, 10), goldMat()); l.position.set(x, 0.02, z); g.add(l); }));

  // lamp
  const PADX = -0.04, PADZ = 0.0;
  const head = V(0.13, 0.4, -0.02), padPos = V(PADX, 0.072, PADZ);
  const lamp = new THREE.Group(); g.add(lamp);
  const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.05, 0.014, 32), white); foot.position.set(0.27, 0.077, -0.06); lamp.add(foot);
  const neck = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([V(0.27, 0.08, -0.06), V(0.27, 0.27, -0.06), V(0.24, 0.37, -0.05), V(head.x + 0.03, head.y + 0.015, head.z)]), 40, 0.0085, 10), white); lamp.add(neck);
  const lhead = new THREE.Mesh(new RoundedBoxGeometry(0.055, 0.05, 0.055, 3, 0.014), white); lhead.position.copy(head); lhead.rotation.z = 0.35; lamp.add(lhead);
  const lens = new THREE.Mesh(new THREE.CircleGeometry(0.014, 20), new THREE.MeshBasicMaterial({ color: 0xbfeaff, toneMapped: false })); lens.rotation.x = Math.PI / 2; lens.position.set(head.x - 0.01, head.y - 0.026, head.z); lamp.add(lens);
  const accent = new THREE.Mesh(new THREE.BoxGeometry(0.057, 0.008, 0.01), new THREE.MeshBasicMaterial({ color: 0x2a8fd0 })); accent.position.set(head.x + 0.002, head.y + 0.012, head.z + 0.028); accent.rotation.z = 0.35; lamp.add(accent);
  // cone of light from the lens to the pad
  const from = V(head.x - 0.01, head.y - 0.03, head.z), dir = padPos.clone().sub(from), len = dir.length();
  const cone = new THREE.Mesh(new THREE.ConeGeometry(0.1, len, 40, 1, true), new THREE.MeshBasicMaterial({ color: 0x58b8ea, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide, toneMapped: false }));
  cone.position.copy(from).add(padPos).multiplyScalar(0.5); cone.quaternion.setFromUnitVectors(V(0, 1, 0), from.clone().sub(padPos).normalize()); g.add(cone);
  const pad = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.004, 8, 70), new THREE.MeshBasicMaterial({ color: 0x2a8fd0, toneMapped: false, transparent: true, opacity: 0 })); pad.rotation.x = Math.PI / 2; pad.position.copy(padPos); g.add(pad);
  const pad2 = new THREE.Mesh(new THREE.TorusGeometry(0.065, 0.0025, 8, 60), pad.material); pad2.rotation.x = Math.PI / 2; pad2.position.copy(padPos); g.add(pad2);
  const spot = lightPool(0x58b8ea, 0.14, 0); spot.position.copy(padPos).setY(0.073); g.add(spot);

  // holographic recipe book
  const book = new THREE.Group(); book.scale.setScalar(1.0); book.position.set(PADX, 0.2, PADZ); g.add(book);
  const hm = (tex) => new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0.88, side: THREE.DoubleSide, depthWrite: false, toneMapped: false });
  const mkPage = (tex, ang) => { const pv = new THREE.Group(); const m = new THREE.Mesh(new THREE.PlaneGeometry(0.13, 0.16), hm(tex)); m.rotation.x = -Math.PI / 2; m.position.x = 0.065; pv.add(m); pv.rotation.z = ang; book.add(pv); return pv; };
  const pgR = mkPage(recipeTex(1), 0.3), pgL = mkPage(recipeTex(2), Math.PI - 0.3), flip = mkPage(recipeTex(3), 0.3);
  const spine = new THREE.Mesh(new THREE.CylinderGeometry(0.003, 0.003, 0.13, 8), new THREE.MeshBasicMaterial({ color: 0x2a8fd0, toneMapped: false })); spine.rotation.x = Math.PI / 2; book.add(spine);
  const bookGlow = glow(0x6cc4ee, 0.35, 0.3); book.add(bookGlow);
  // ingredients drawn in light, circling the book
  const ing = [[0xe0452f, 'sphere'], [0xef8f2a, 'cone'], [0xf7e6b0, 'egg'], [0x6fbf4a, 'leaf'], [0xf2c14a, 'coin']].map(([c, k], i) => {
    const m = new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.85, toneMapped: false });
    let geo = k === 'cone' ? new THREE.ConeGeometry(0.009, 0.03, 12) : k === 'egg' ? new THREE.SphereGeometry(0.011, 14, 10) : k === 'leaf' ? new THREE.SphereGeometry(0.014, 12, 8) : k === 'coin' ? new THREE.CylinderGeometry(0.012, 0.012, 0.004, 16) : new THREE.SphereGeometry(0.014, 14, 10);
    const o = new THREE.Mesh(geo, m); if (k === 'egg') o.scale.y = 1.3; if (k === 'leaf') o.scale.set(1.6, 0.35, 0.9); o.userData.b = o.scale.clone(); g.add(o); return { o, i };
  });

  // remote + plates
  const remote = new THREE.Group(); remote.position.set(-0.05, 0.079, 0.15); g.add(remote);
  const rb = new THREE.Mesh(new RoundedBoxGeometry(0.075, 0.016, 0.034, 3, 0.007), glossy(0x24211e)); remote.add(shadowed(rb));
  const btns = [-0.022, 0, 0.022].map((x, i) => { const b = new THREE.Mesh(new THREE.CylinderGeometry(0.0055, 0.0055, 0.004, 14), new THREE.MeshBasicMaterial({ color: [0xef8f2a, 0x2fae8f, 0x2a8fd0][i], toneMapped: false })); b.position.set(x, 0.01, 0); remote.add(b); return b; });
  const plateGeo = new THREE.LatheGeometry([[0, 0], [0.028, 0], [0.042, 0.009], [0.046, 0.012], [0.041, 0.012], [0.03, 0.005], [0, 0.005]].map(([x, y]) => new THREE.Vector2(x, y)), 36);
  const slots = [[-0.32, 0.0], [-0.32, 0.11], [-0.2, 0.0], [-0.2, 0.11]].map(([x, z]) => V(x, 0.071, z - 0.03));
  const mess = [V(0.1, 0.071, 0.14), V(-0.12, 0.071, -0.12), V(-0.3, 0.08, -0.12), V(0.16, 0.071, 0.05)];
  const plates = slots.map((s, i) => {
    const p = new THREE.Mesh(plateGeo, glossy(i % 2 ? 0xf5f2ea : 0xe9eef2, { roughness: 0.15 })); p.position.copy(mess[i]); p.rotation.set((i - 1.5) * 0.12, i, (i % 2 - 0.5) * 0.25); g.add(shadowed(p));
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.0018, 6, 40), new THREE.MeshBasicMaterial({ color: 0xd4ad55, toneMapped: false, transparent: true, opacity: 0.0 })); ring.rotation.x = Math.PI / 2; ring.position.copy(s).setY(0.0705); g.add(ring);
    return { p, ring, i, from: mess[i].clone(), to: s.clone(), neat: false, t0: -9 };
  });
  let neat = false, setAt = -9;
  function setTable(on) { neat = on; setAt = now; plates.forEach((q) => { q.from.copy(q.p.position); q.fq = q.p.quaternion.clone(); }); ctx.sfx.whoosh?.(); }

  function see(k, pos, extra) { const c = CARDS[k]; ctx.sfx.pop?.(); ctx.ui.card({ tag: 'تقنية الغد', title: c.t, body: c.b, color: c.c }); tag.show(c.tag, pos, c.c); seen.add(k); extra?.();
    if (seen.size === 4 && !finished) { finished = true; setTimeout(() => { ctx.fx.burst(wpos(g, V(0, 0.25, 0)), 0x9fdcff, 44, 0.5, 0.035); ctx.ui.done(); }, 900); } }
  let flipAt = 2.0, flipT = -9;
  ctx.tap(lamp, () => { see('lamp', V(0.18, 0.48, 0)); hints.list[0].on = false; });
  ctx.tap(book, () => { see('book', V(PADX, 0.34, PADZ), () => { flipT = now; }); hints.list[1].on = false; });
  ctx.tap(pad, () => { see('pad', V(PADX, 0.12, 0.12)); ctx.fx.burst(wpos(g, padPos), 0x9fdcff, 20, 0.2, 0.025); hints.list[2].on = false; });
  const plateTap = () => { setTable(!neat); see('plates', V(-0.2, 0.17, 0.13)); hints.list[3].on = false; };
  ctx.tap(remote, plateTap); plates.forEach((q) => ctx.tap(q.p, plateTap));
  hints.add(V(0.2, 0.3, -0.05), 0xbfeaff, 0.12); hints.add(book.position.clone(), 0xbfeaff, 0.16); hints.add(padPos.clone().setY(0.07), 0xbfeaff, 0.14); hints.add(remote.position.clone().setY(0.08), 0xffd27a, 0.1);
  seq.add(counter, 0.2, 0.9); seq.add(lamp, 0.9, 0.9); seq.add(remote, 1.4, 0.7, 0.06);
  plates.forEach((q, i) => seq.add(q.p, 1.6 + i * 0.15, 0.7, 0.1));
  ctx.ui.hud('المس المصباح والكتاب والأطباق');
  const tm = V();

  return {
    update(t, dt, e) {
      now = t; seq.update(t, e); hints.update(t, e); tag.update(dt, e);
      const on = stag(t, 1.4, 1.2) * e;
      cone.material.opacity = 0.15 * on; pad.material.opacity = 0.9 * on; spot.material.opacity = 0.55 * on;
      pad.rotation.z = t * 0.5; pad2.rotation.z = -t * 0.8; pad.scale.setScalar(0.9 + 0.1 * on);
      book.visible = on > 0.02; book.scale.setScalar(Math.max(on, 0.001) * 1.25); book.position.y = 0.2 + Math.sin(t * 1.4) * 0.008; book.rotation.y = Math.sin(t * 0.4) * 0.2;
      bookGlow.material.opacity = 0.45 * on;
      // page flipping, every 4 seconds (and when touched)
      let fk = ((t - flipAt) % 4) / 1.3; if (flipT > 0 && t - flipT < 1.3) fk = (t - flipT) / 1.3; if (t < flipAt) fk = 2;
      if (fk < 1) { const k = ease(fk); flip.rotation.z = 0.3 + (Math.PI - 0.6) * k; flip.position.y = Math.sin(k * Math.PI) * 0.05; flip.visible = true; } else flip.visible = false;
      ing.forEach(({ o, i }) => { const a = t * 0.7 + i * TAU / 5; const r = 0.115; o.position.set(PADX + Math.cos(a) * r, 0.2 + 0.08 + Math.sin(t * 1.3 + i * 2) * 0.02, PADZ + Math.sin(a) * r); o.rotation.y = t + i; o.visible = on > 0.4; o.scale.copy(o.userData.b).multiplyScalar(Math.max(on, 0.001)); });
      const mv = ease((t - setAt) / 1.3);
      plates.forEach((q) => {
        if (setAt < 0) { q.p.position.y += Math.sin(t * 2 + q.i) * 0.00002; return; }
        const a = neat ? q.to : q.from, b = neat ? q.to : q.p.position;
        if (neat) { q.p.position.lerpVectors(q.from, q.to, mv); q.p.position.y += Math.sin(mv * Math.PI) * 0.06; q.p.quaternion.slerp(QI, Math.min(1, dt * 6)); }
        else { tm.copy(mess[q.i]); q.p.position.lerpVectors(q.from, tm, mv); q.p.position.y += Math.sin(mv * Math.PI) * 0.04; }
        q.ring.material.opacity = THREE.MathUtils.damp(q.ring.material.opacity, neat ? 0.9 : 0, 5, dt);
      });
      btns.forEach((b, i) => { b.scale.y = 1 + (neat && now - setAt < 0.5 ? -0.4 : 0); b.material.color.offsetHSL(0, 0, 0); });
    },
  };
}
