// p267: a glass-bright cloud above a hexagon of hands and devices. Upload from the tablet, the file rests in the servers, then comes down to a phone.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { P, ease, easeBack, clamp01, stag, mat, glossy, goldMat, shadowed, glow } from '../../kit.js?v=19';
import { rising, halos, liveTag, motes, canvasTex, beam, tagSprite, setSpr, TAU, css, arcPoint } from '../lib/a4-kit.js?v=19';

export const meta = { free: true, center: [0.53, 0.4], typeLabel: 'خريطة ضوئية', title: 'السحابة الحاسوبية في التعلّم' };

const NAVY = 0x1f2d44, ORANGE = 0xf0702a, SKY = 0x93dbf6, BLUE = 0x4a8fd8;
const CARDS = {
  cloud: { tag: 'السحابة', title: 'السحابة الحاسوبية', body: 'موارد تخزين ومعالجة تُقدَّم عبر الإنترنت، فيصل المستخدم إلى ملفاته وبرامجه من أي جهاز.', c: BLUE },
  server: { tag: 'تخزين', title: 'خوادم التخزين', body: 'تحتفظ بالمحتوى التعليمي في مراكز بيانات بعيدة عن جهاز المتعلم.', c: NAVY },
  services: { tag: 'معالجة', title: 'خدمات ومعالجة سحابية', body: 'تُنفَّذ المعالجة والتطبيقات على السحابة، فلا يحتاج الجهاز إلى قدرة عالية.', c: ORANGE },
  lock: { tag: 'حماية', title: 'الأمان والخصوصية', body: 'حماية بيانات الطلاب وضبط صلاحيات الوصول شرط أساسي لاعتماد الخدمة.', c: ORANGE },
  upload: { tag: 'رفع', title: 'رفع المحتوى', body: 'يرفع المعلم الملفات والمقاطع من جهازه إلى السحابة.', c: ORANGE },
  down: { tag: 'تنزيل', title: 'وصول المتعلم من هاتفه', body: 'يستعيد المتعلم المادة ويشغّلها من هاتفه أو جهازه اللوحي في أي وقت.', c: BLUE },
  files: { tag: 'إتاحة', title: 'ملفات المحتوى', body: 'مستندات ومقاطع وصوتيات تُحفظ مرة واحدة وتتاح لمجموعات متعددة.', c: BLUE },
};

function gear(r, teeth = 8, col = ORANGE) {
  const g = new THREE.Group();
  g.add(new THREE.Mesh(new THREE.CylinderGeometry(r, r, 0.008, 18), mat(col, { roughness: 0.4 })));
  for (let i = 0; i < teeth; i++) { const t = new THREE.Mesh(new THREE.BoxGeometry(r * 0.5, 0.008, r * 0.4), mat(col, { roughness: 0.4 })); const a = (i / teeth) * TAU; t.position.set(Math.cos(a) * r * 1.02, 0, Math.sin(a) * r * 1.02); t.rotation.y = -a; g.add(t); }
  const h = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.35, r * 0.35, 0.01, 12), mat(0xf6f1e4)); g.add(h);
  g.rotation.x = Math.PI / 2; const w = new THREE.Group(); w.add(g); return w;
}
function cloudMesh(col = 0xffffff, s = 1) {
  const g = new THREE.Group();
  [[-0.07, 0, 0, 0.05], [-0.02, 0.03, 0.005, 0.062], [0.045, 0.022, 0, 0.056], [0.09, -0.005, 0, 0.044], [0, -0.012, 0.02, 0.054], [-0.04, -0.014, -0.012, 0.05], [0.04, -0.012, -0.018, 0.05]].forEach(([x, y, z, r]) => {
    const m = new THREE.Mesh(new THREE.SphereGeometry(r * s, 24, 16), new THREE.MeshStandardMaterial({ color: col, roughness: 0.85 })); m.position.set(x * s, y * s, z * s); g.add(m);
  });
  const flat = new THREE.Mesh(new THREE.CylinderGeometry(0.1 * s, 0.1 * s, 0.01, 24), new THREE.MeshStandardMaterial({ color: col, roughness: 0.85 })); flat.position.set(0.01 * s, -0.04 * s, 0); flat.scale.set(1, 1, 0.45); g.add(flat);
  return g;
}

export default function build(ctx) {
  const g = new THREE.Group(); g.position.copy(P(meta.center[0], meta.center[1])); g.scale.setScalar(1.25); ctx.stage.add(g);
  const rise = rising(), hal = halos();
  // no plinth: a thin glass hexagon with a glowing blue outline lies on the print
  const hexShape = (r) => { const sh = new THREE.Shape(); for (let k = 0; k < 6; k++) { const a = Math.PI / 6 + (k / 6) * TAU; k ? sh.lineTo(Math.cos(a) * r, Math.sin(a) * r) : sh.moveTo(Math.cos(a) * r, Math.sin(a) * r); } sh.closePath(); return sh; };
  const hexFill = new THREE.Mesh(new THREE.ShapeGeometry(hexShape(0.36)), new THREE.MeshBasicMaterial({ color: SKY, transparent: true, opacity: 0.22, depthWrite: false, toneMapped: false })); hexFill.rotation.x = Math.PI / 2; hexFill.position.y = 0.002; g.add(hexFill);
  const outer = hexShape(0.37), hole = new THREE.Path(); hexShape(0.345).getPoints().forEach((p2, k) => (k ? hole.lineTo(p2.x, p2.y) : hole.moveTo(p2.x, p2.y))); outer.holes.push(hole);
  const hexRing = new THREE.Mesh(new THREE.ExtrudeGeometry(outer, { depth: 0.012, bevelEnabled: false }), new THREE.MeshStandardMaterial({ color: BLUE, roughness: 0.3, metalness: 0.2, emissive: BLUE, emissiveIntensity: 0.3 })); hexRing.rotation.x = Math.PI / 2; hexRing.position.y = 0.012; hexRing.castShadow = true; g.add(hexRing);
  const hexRing2 = new THREE.Mesh(new THREE.ExtrudeGeometry((() => { const o2 = hexShape(0.335), h2 = new THREE.Path(); hexShape(0.325).getPoints().forEach((p2, k) => (k ? h2.lineTo(p2.x, p2.y) : h2.moveTo(p2.x, p2.y))); o2.holes.push(h2); return o2; })(), { depth: 0.006, bevelEnabled: false }), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.7, toneMapped: false })); hexRing2.rotation.x = Math.PI / 2; hexRing2.position.y = 0.007; g.add(hexRing2);
  const TOP = 0.0;
  const mo = motes(g, 16, { r: 0.32, h: 0.5, color: 0xffffff, cy: 0.03 });

  // ---- cloud
  const cloud = new THREE.Group(); cloud.position.set(0, 0.3, -0.03); g.add(cloud);
  const cl = cloudMesh(); cloud.add(cl); shadowed(cl);
  const cglow = glow(0xbfe8ff, 0.4, 0); cglow.position.z = 0.0; cloud.add(cglow);
  rise.add(cloud, 0.3, 0.2);
  const cTag = tagSprite('السحابة', 0.12, BLUE); cTag.visible = false;

  // ---- servers (upper left)
  const rack = new THREE.Group(); rack.position.set(-0.17, TOP, -0.11); g.add(rack);
  const stripes = [];
  [0.03, 0.085].forEach((y) => { const b = new THREE.Mesh(new RoundedBoxGeometry(0.08, 0.05, 0.06, 3, 0.006), mat(NAVY, { roughness: 0.45 })); b.position.y = y; rack.add(b);
    for (let i = 0; i < 3; i++) { const s = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.004, 0.003), new THREE.MeshBasicMaterial({ color: ORANGE, toneMapped: false })); s.position.set(0, y - 0.012 + i * 0.012, 0.031); rack.add(s); stripes.push(s); } });
  const led = new THREE.Mesh(new THREE.SphereGeometry(0.004, 8, 6), new THREE.MeshBasicMaterial({ color: 0x4fd06a, toneMapped: false })); led.position.set(0.03, 0.115, 0.031); rack.add(led);
  const rg = gear(0.018); rg.position.set(-0.05, 0.02, 0.04); rack.add(rg);
  shadowed(rack); rise.add(rack, 0.7, 0.15);
  hal.add(rack, 0x7fd0ff, 0.2, [0, 0.07, 0], 4);

  // ---- services (upper right): a dark cloud with gears
  const svc = new THREE.Group(); svc.position.set(0.18, 0.2, -0.12); g.add(svc);
  const sc = cloudMesh(0x2b3d57, 0.55); svc.add(sc); shadowed(sc);
  const g1 = gear(0.02), g2 = gear(0.013); g1.position.set(-0.01, 0, 0.04); g2.position.set(0.026, -0.012, 0.04); svc.add(g1, g2);
  rise.add(svc, 0.9, 0.15);
  hal.add(svc, 0xffa060, 0.22, [0, 0, 0.03], 4.2);

  // ---- lock
  const lock = new THREE.Group(); lock.position.set(0.215, 0.085, -0.01); g.add(lock);
  const lb = new THREE.Mesh(new RoundedBoxGeometry(0.06, 0.06, 0.02, 3, 0.012), mat(NAVY)); lock.add(lb);
  const lk = new THREE.Mesh(new RoundedBoxGeometry(0.03, 0.024, 0.008, 2, 0.004), mat(ORANGE)); lk.position.set(0, -0.004, 0.013); lock.add(lk);
  const lsh = new THREE.Mesh(new THREE.TorusGeometry(0.0095, 0.0025, 8, 18, Math.PI), mat(ORANGE)); lsh.position.set(0, 0.008, 0.013); lock.add(lsh);
  shadowed(lock); rise.add(lock, 1.0, 0.12);
  hal.add(lock, 0xffa060, 0.16, [0, 0, 0.02], 4.4);

  // ---- learner phones and the teacher's tablet
  const mkPhone = (x, z, ry) => {
    const grp = new THREE.Group(); grp.position.set(x, TOP, z); grp.rotation.y = ry; g.add(grp);
    const pl = new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.04, 0.012, 20), mat(0xf6f1e4)); pl.position.y = 0.006; grp.add(pl);
    const ph = new THREE.Mesh(new RoundedBoxGeometry(0.05, 0.088, 0.008, 3, 0.006), mat(0xf6f6f8, { roughness: 0.3 })); ph.position.y = 0.062; ph.rotation.x = -0.18; grp.add(ph);
    const tex = canvasTex(128, 224, (c, w, h) => { c.fillStyle = '#f0702a'; c.fillRect(0, 0, w, h); c.fillStyle = 'rgba(255,255,255,.9)'; c.beginPath(); c.moveTo(48, 84); c.lineTo(48, 140); c.lineTo(94, 112); c.fill(); });
    const sc2 = new THREE.Mesh(new THREE.PlaneGeometry(0.043, 0.078), new THREE.MeshBasicMaterial({ map: tex, toneMapped: false })); sc2.position.z = 0.0045; ph.add(sc2);
    shadowed(grp); return { grp, ph, sc2 };
  };
  const phL = mkPhone(-0.2, 0.1, 0.5), phR = mkPhone(0.17, 0.14, -0.45);
  rise.add(phL.grp, 1.1, 0.12); rise.add(phR.grp, 1.25, 0.12);
  const tab = new THREE.Group(); tab.position.set(-0.01, TOP, 0.17); g.add(tab);
  const tp = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.056, 0.012, 24), mat(0xf6f1e4)); tp.position.y = 0.006; tab.add(tp);
  const tb = new THREE.Mesh(new RoundedBoxGeometry(0.11, 0.075, 0.008, 3, 0.005), mat(NAVY)); tb.position.y = 0.045; tb.rotation.x = -1.0; tab.add(tb);
  const ttex = canvasTex(256, 176, (c, w, h) => { c.fillStyle = '#f0702a'; c.fillRect(0, 0, w, h); c.strokeStyle = '#fff'; c.lineWidth = 7; c.lineJoin = 'round'; c.beginPath(); c.moveTo(24, 130); c.lineTo(80, 90); c.lineTo(130, 112); c.lineTo(200, 40); c.stroke(); [[24, 130], [80, 90], [130, 112], [200, 40]].forEach(([x, y]) => { c.fillStyle = '#fff'; c.beginPath(); c.arc(x, y, 9, 0, TAU); c.fill(); }); });
  const tsc = new THREE.Mesh(new THREE.PlaneGeometry(0.1, 0.066), new THREE.MeshBasicMaterial({ map: ttex, toneMapped: false })); tsc.position.z = 0.0045; tb.add(tsc);
  shadowed(tab); rise.add(tab, 1.0, 0.12);
  hal.add(tab, 0xffa060, 0.2, [0, 0.05, 0.02], 4.1);
  hal.add(phL.grp, 0x7fd0ff, 0.16, [0, 0.06, 0.02], 4.3); hal.add(phR.grp, 0x7fd0ff, 0.16, [0, 0.06, 0.02], 4.5);

  // ---- flowing beams
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const bm = (a, b, lift, col, sp) => { const m = a.clone().lerp(b, 0.5); m.y += lift; return beam(new THREE.QuadraticBezierCurve3(a, m, b), { radius: 0.0034, color: col, segs: 28, speed: sp }); };
  const cloudBase = V(0, 0.255, -0.02);
  const beams = [
    { m: bm(V(-0.01, 0.1, 0.16), V(-0.015, 0.25, 0.02), 0.01, ORANGE, 0.5), d: 0.6 },
    { m: bm(V(-0.04, 0.25, 0.0), V(-0.2, 0.125, 0.1), 0.05, BLUE, 0.45), d: 0.9 },
    { m: bm(V(0.04, 0.25, 0.0), V(0.17, 0.125, 0.14), 0.05, BLUE, 0.45), d: 1.1 },
    { m: bm(V(-0.06, 0.26, -0.05), V(-0.17, 0.15, -0.1), 0.03, 0x5aa8e0, 0.35), d: 1.3 },
    { m: bm(V(0.07, 0.26, -0.05), V(0.17, 0.21, -0.11), 0.03, 0xf08a4a, 0.35), d: 1.5 },
    { m: bm(V(0.05, 0.27, 0.0), V(0.215, 0.115, -0.01), 0.04, 0xf08a4a, 0.35), d: 1.7 },
  ];
  beams.forEach((b) => g.add(b.m));
  const upTag = tagSprite('رفع', 0.07, ORANGE), dnTag = tagSprite('تنزيل', 0.08, BLUE); upTag.visible = dnTag.visible = false;

  // ---- the travelling file
  const fileM = new THREE.Group();
  fileM.add(new THREE.Mesh(new RoundedBoxGeometry(0.034, 0.042, 0.005, 2, 0.002), mat(0xffffff, { roughness: 0.3 })));
  const hd = new THREE.Mesh(new THREE.PlaneGeometry(0.022, 0.006), new THREE.MeshBasicMaterial({ color: ORANGE, toneMapped: false })); hd.position.set(0, 0.012, 0.003); fileM.add(hd);
  [0.002, -0.006, -0.014].forEach((y) => { const l = new THREE.Mesh(new THREE.PlaneGeometry(0.022, 0.002), new THREE.MeshBasicMaterial({ color: 0x8aa0b8, toneMapped: false })); l.position.set(0, y, 0.003); fileM.add(l); });
  const fg = glow(0xffd8a0, 0.09, 0.8); fileM.add(fg); fileM.visible = false; g.add(fileM);
  const act = { on: false, wps: [], seg: 0, t: 0, dur: 1, done: null, lift: 0.1 };
  const stored = { n: 0 };
  const tag = liveTag(0.2, '#4a8fd8', { size: 60 }); tag.set('السحابة'); g.add(tag.sp); tag.apply(0);
  let now = 0, tagK = 0, tagT = 0, uploaded = false, downs = 0, others = new Set(), finished = false, started = false, demo = true; const tagPos = new THREE.Vector3(), tmp = new THREE.Vector3();
  ctx.ui.hud('المس الجهاز لترى المحتوى يصعد');

  function fly(wps, dur, done) { act.on = true; act.wps = wps; act.seg = 0; act.t = 0; act.dur = dur; act.done = done; fileM.visible = true; fileM.scale.setScalar(1); fileM.position.copy(wps[0]); }
  const show = (k, at) => { const c = CARDS[k]; tag.set(c.tag, css(c.c)); tagPos.copy(at); tagK = 0; tagT = 1; ctx.ui.card({ tag: 'رحلة المحتوى', title: c.title, body: c.body, color: c.c }); };
  const check = () => { if (uploaded && downs > 0 && others.size >= 1 && !finished) { finished = true; setTimeout(() => { ctx.fx.burst(g.position.clone().add(V(0, 0.3, 0)), 0xffd27a, 46, 0.5, 0.04); ctx.sfx.good?.(); ctx.ui.hud('ملف واحد ومتعلمون كثيرون'); ctx.ui.done(); }, 1500); } };

  function upload() {
    if (act.on || now < 2.4) return;
    ctx.sfx.whoosh?.(); beams[0].m.userData.boost = 6;
    fly([V(-0.01, 0.12, 0.16), V(0, 0.3, -0.03), V(-0.17, 0.12, -0.1)], 2.2, () => { uploaded = true; stored.n++; ctx.sfx.good?.(); ctx.fx.burst(g.position.clone().add(V(-0.17, 0.1, -0.1)), ORANGE, 18, 0.3, 0.03); fileM.visible = false; });
    show('upload', V(-0.01, 0.2, 0.16)); check();
  }
  function download(ph, bi, x, z) {
    if (act.on || now < 2.4) return;
    if (!uploaded) { ctx.ui.toast('ارفع الملف أولاً'); ctx.sfx.bad?.(); return; }
    ctx.sfx.whoosh?.(); beams[bi].m.userData.boost = 6;
    fly([V(0, 0.28, -0.03), V(x, 0.14, z)], 1.4, () => { downs++; ctx.sfx.good?.(); ctx.fx.burst(g.position.clone().add(V(x, 0.12, z)), BLUE, 16, 0.25, 0.03); fileM.visible = false; ph.userData.flash = 1; check(); });
    show(downs ? 'files' : 'down', V(x, 0.2, z));
  }
  ctx.tap(tab, upload);
  ctx.tap(phL.grp, () => download(phL.grp, 1, -0.2, 0.1));
  ctx.tap(phR.grp, () => download(phR.grp, 2, 0.17, 0.14));
  ctx.tap(cloud, () => { show('cloud', V(0, 0.4, 0)); others.add('cloud'); check(); ctx.sfx.pop?.(); });
  ctx.tap(rack, () => { show('server', V(-0.17, 0.2, -0.11)); others.add('server'); check(); ctx.sfx.pop?.(); beams[3].m.userData.boost = 6; });
  ctx.tap(svc, () => { show('services', V(0.18, 0.29, -0.12)); others.add('services'); svc.userData.spin = 1; check(); ctx.sfx.pop?.(); beams[4].m.userData.boost = 6; });
  ctx.tap(lock, () => { show('lock', V(0.215, 0.16, -0.01)); others.add('lock'); lock.userData.wob = 1; check(); ctx.sfx.pop?.(); beams[5].m.userData.boost = 6; });

  return {
    update(t, dt, e) {
      now = t; rise.update(t, e); hal.update(t, e); mo.update(t, dt, e);
      cloud.position.y = 0.3 + Math.sin(t * 1.1) * 0.008; cglow.material.opacity = (0.3 + 0.1 * Math.sin(t * 1.7)) * stag(t, 0.5, 1) * e; cglow.scale.setScalar(0.4);
      cloud.rotation.y = Math.sin(t * 0.3) * 0.2;
      beams.forEach((b, i) => { const k = stag(t, b.d, 0.9) * e; b.m.userData.grow(k); b.m.visible = k > 0.01; b.m.userData.update(dt); b.m.userData.boost = Math.max(1, b.m.userData.boost - dt * 3); });
      const ck = stag(t, 2.4, 0.6, easeBack) * e; 
      
      rg.rotation.y += dt * 1.2; g1.rotation.y += dt * (0.8 + (svc.userData.spin || 0) * 6); g2.rotation.y -= dt * (1.2 + (svc.userData.spin || 0) * 6); svc.userData.spin = Math.max(0, (svc.userData.spin || 0) - dt);
      svc.position.y = 0.2 + Math.sin(t * 1.3 + 1) * 0.006;
      lock.userData.wob = Math.max(0, (lock.userData.wob || 0) - dt * 2); lock.rotation.z = Math.sin(t * 40) * 0.2 * lock.userData.wob;
      stripes.forEach((s, i) => { s.visible = stored.n > 0 || Math.sin(t * 2 + i) > -0.2; });
      led.visible = Math.sin(t * (stored.n ? 9 : 3)) > -0.3;
      [phL, phR].forEach((p) => { const f = p.grp.userData.flash || 0; p.grp.userData.flash = Math.max(0, f - dt * 1.2); p.ph.position.y = 0.062 + f * 0.02; p.sc2.material.color.setScalar(1 + f * 0.6); });
      // the intro demo: a file climbs to the cloud and rests in the servers, by itself
      if (demo && t > 1.4 && !act.on) { demo = false; ctx.sfx.whoosh?.(); beams[0].m.userData.boost = 6; fly([V(-0.01, 0.12, 0.16), V(0, 0.3, -0.03), V(-0.17, 0.12, -0.1)], 2.2, () => { uploaded = true; stored.n++; fileM.visible = false; ctx.fx.burst(g.position.clone().add(V(-0.17, 0.1, -0.1)), ORANGE, 12, 0.25, 0.028); ctx.ui.hud('المس الهاتف لتنزّل الملف'); }); }
      if (act.on) {
        act.t += dt / (act.dur / (act.wps.length - 1)); const si = Math.min(act.wps.length - 2, Math.floor(act.t)); const f = Math.min(1, act.t - si);
        arcPoint(fileM.position, act.wps[si], act.wps[si + 1], ease(f), 0.05); fileM.rotation.y += dt * 4; fileM.rotation.z = Math.sin(t * 6) * 0.2;
        if (act.t >= act.wps.length - 1) { act.on = false; act.done?.(); }
      }
      tagK = THREE.MathUtils.damp(tagK, tagT, 6, dt); tag.sp.position.copy(tagPos); tag.apply(easeBack(tagK) * e);
    },
  };
}
