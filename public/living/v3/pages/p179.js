// p179 — "what does a theory do?": a glass mind with turning gears, and four little machines that do its four jobs.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { P, ease, easeBack, clamp01, stag, mat, glossy, goldMat, shadowed } from '../../kit.js?v=15';
import { tagSprite, setSpr, softLight } from '../../v2/common.js?v=15';
import { blobShadow, hints, finder, css } from '../lib/a3-kit.js?v=15';

export const meta = { free: true, center: [0.4, 0.65], typeLabel: 'نموذج تفاعلي' };

const COL = { gather: 0x8ba32a, explain: 0xef8a2a, predict: 0x3b8fd0, guide: 0xb5483a };
const TAU = Math.PI * 2;

function gear(r, teeth, th, color) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CylinderGeometry(r, r, th, 28), goldMat()); body.rotation.x = Math.PI / 2; g.add(body);
  const hole = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.28, r * 0.28, th * 1.2, 16), mat(0x2b2620)); hole.rotation.x = Math.PI / 2; g.add(hole);
  for (let i = 0; i < teeth; i++) {
    const a = (i / teeth) * TAU;
    const t = new THREE.Mesh(new THREE.BoxGeometry(r * 0.3, r * 0.34, th), goldMat());
    t.position.set(Math.cos(a) * r * 1.07, Math.sin(a) * r * 1.07, 0); t.rotation.z = a; g.add(t);
  }
  return g;
}

export default function build(ctx) {
  const g = new THREE.Group(); g.position.copy(P(0.4, 0.65)); g.scale.setScalar(0.84); ctx.stage.add(g);
  const H = hints(), found = finder(ctx, 4);
  const Y = 0.004;
  const base = new THREE.Group(); g.add(base);
  const ringFlat = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.004, 8, 100), goldMat()); ringFlat.rotation.x = Math.PI / 2; ringFlat.position.y = 0.004; base.add(ringFlat);
  const sh = blobShadow(0.75, 0.72, 0.22); base.add(sh);

  // ---- the glass mind in the centre
  const mind = new THREE.Group(); mind.position.y = Y + 0.13; g.add(mind);
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.028, 0.09, 16), goldMat()); stem.position.y = Y + 0.045; stem.scale.set(1, 1, 1); g.add(stem);
  const globe = new THREE.Mesh(new THREE.SphereGeometry(0.085, 40, 28), new THREE.MeshPhysicalMaterial({ color: 0xeaf6ff, transparent: true, opacity: 0.22, roughness: 0.05, clearcoat: 1, depthWrite: false }));
  mind.add(globe);
  const gA = gear(0.04, 11, 0.012, 0), gB = gear(0.03, 8, 0.012, 0);
  gA.position.set(-0.026, 0.008, 0); gB.position.set(0.04, -0.018, 0.0); mind.add(gA, gB);
  const core = softLight(0xffd27a, 0.2, 0.5); mind.add(core);
  const bandMesh = new THREE.Mesh(new THREE.TorusGeometry(0.088, 0.003, 8, 80), goldMat()); bandMesh.rotation.x = Math.PI / 2; mind.add(bandMesh);
  ctx.tap(mind, () => {
    ctx.sfx.pop?.(); mindKick = 1;
    ctx.ui.card({ tag: 'عند مور', title: 'ما النظرية؟', body: 'مجموعة فروض يُتوصَّل منها إلى مبادئ تفسّر ما هو كائن، لا ما ينبغي أن يكون.', color: 0xd4ad55 });
  });
  H.add(mind, 0xffd27a, 0.3, [0, 0, 0], 4.5);
  let mindKick = 0;

  // ---- 1 gather: loose cubes that snap into an ordered wall
  const gatherG = new THREE.Group(); gatherG.position.set(-0.22, Y, 0.0); g.add(gatherG);
  const tray = new THREE.Mesh(new RoundedBoxGeometry(0.17, 0.014, 0.12, 3, 0.005), mat(0x3a3f45)); tray.position.y = 0.007; gatherG.add(tray);
  const frame = new THREE.Mesh(new THREE.TorusGeometry(0.003, 0.003, 4, 4), goldMat()); frame.visible = false; gatherG.add(frame);
  const cubeCols = [0x8ba32a, 0xef8a2a, 0x3b8fd0, 0xd4ad55, 0xb5483a, 0x6aa89a];
  const cubes = cubeCols.map((c, i) => {
    const m = new THREE.Mesh(new RoundedBoxGeometry(0.04, 0.04, 0.04, 3, 0.008), glossy(c)); m.castShadow = true; gatherG.add(m);
    const ox = ((i % 3) - 1) * 0.048, oz = (Math.floor(i / 3) - 0.5) * 0.048;
    const a = i * 2.1;
    return { m, home: new THREE.Vector3(ox, 0.034, oz), loose: new THREE.Vector3(Math.cos(a) * 0.1, 0.1 + (i % 3) * 0.035, Math.sin(a) * 0.075), ph: i * 1.3 };
  });
  let asm = 0, asmTo = 0;
  ctx.tap(gatherG, () => { asmTo = asmTo ? 0 : 1; ctx.sfx.pop?.(); if (asmTo) { card('gather'); } });

  // ---- 2 explain: a bulb that lights
  const bulbG = new THREE.Group(); bulbG.position.set(0.22, Y, 0.0); g.add(bulbG);
  const bfoot = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.05, 0.014, 32), mat(0x3a3f45)); bfoot.position.y = 0.007; bulbG.add(bfoot);
  const socket = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.022, 0.04, 20), goldMat()); socket.position.y = 0.035; bulbG.add(socket);
  const glass = new THREE.Mesh(new THREE.SphereGeometry(0.04, 28, 20), new THREE.MeshPhysicalMaterial({ color: 0xfff6dd, transparent: true, opacity: 0.4, roughness: 0.05, clearcoat: 1, depthWrite: false })); glass.position.y = 0.09; bulbG.add(glass);
  const fil = new THREE.Mesh(new THREE.SphereGeometry(0.024, 20, 14), new THREE.MeshBasicMaterial({ color: 0xffe08a, transparent: true, opacity: 0.1, toneMapped: false })); fil.position.y = 0.09; bulbG.add(fil);
  const rays = Array.from({ length: 10 }, (_, i) => {
    const a = (i / 10) * TAU; const r = new THREE.Mesh(new THREE.BoxGeometry(0.026, 0.004, 0.004), new THREE.MeshBasicMaterial({ color: 0xffc24a, toneMapped: false }));
    r.userData.a = a; bulbG.add(r); return r;
  });
  const bglow = softLight(0xffc24a, 0.25, 0); bglow.position.y = 0.09; bulbG.add(bglow);
  let bulbOn = 0, bulbT = -9;
  ctx.tap(bulbG, () => { bulbT = now; ctx.sfx.pop?.(); card('explain'); });

  // ---- 3 predict: a crystal ball and an arrow that lands where the data point
  const predG = new THREE.Group(); predG.position.set(-0.03, Y, 0.22); g.add(predG);
  const pbase = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.04, 0.02, 28), goldMat()); pbase.position.y = 0.01; predG.add(pbase);
  const ball = new THREE.Mesh(new THREE.SphereGeometry(0.045, 32, 24), new THREE.MeshPhysicalMaterial({ color: 0xcfe6ff, transparent: true, opacity: 0.35, roughness: 0.02, clearcoat: 1, depthWrite: false })); ball.position.y = 0.065; predG.add(ball);
  const ballGlow = softLight(0x3b8fd0, 0.14, 0.35); ballGlow.position.y = 0.065; predG.add(ballGlow);
  const flagPole = new THREE.Mesh(new THREE.CylinderGeometry(0.003, 0.003, 0.09, 8), mat(0x3a3f45)); flagPole.position.set(0.17, 0.045, -0.02); predG.add(flagPole);
  const flag = new THREE.Mesh(new THREE.PlaneGeometry(0.05, 0.03), new THREE.MeshStandardMaterial({ color: 0x3b8fd0, side: THREE.DoubleSide })); flag.position.set(0.195, 0.078, -0.02); predG.add(flag);
  const arrow = new THREE.Group(); const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.0035, 0.0035, 0.05, 8), mat(0xf1e6c9)); shaft.rotation.z = Math.PI / 2;
  const head = new THREE.Mesh(new THREE.ConeGeometry(0.009, 0.02, 12), glossy(0x3b8fd0)); head.rotation.z = -Math.PI / 2; head.position.x = 0.035; arrow.add(shaft, head); predG.add(arrow);
  const trail = Array.from({ length: 9 }, () => { const s = new THREE.Mesh(new THREE.SphereGeometry(0.004, 8, 6), new THREE.MeshBasicMaterial({ color: 0x3b8fd0, transparent: true, opacity: 0.4 })); predG.add(s); return s; });
  const arcAt = (k, out) => out.set(0.02 + k * 0.145, 0.07 + Math.sin(k * Math.PI) * 0.075, -0.02 * k);
  let flyT = -9;
  ctx.tap(predG, () => { flyT = now; ctx.sfx.whoosh?.(); card('predict'); });

  // ---- 4 guide: a compass that points the way
  const compG = new THREE.Group(); compG.position.set(0, Y, -0.25); g.add(compG);
  const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.075, 0.016, 48), mat(0xf6efe0)); disc.position.y = 0.008; compG.add(disc);
  const bezel = new THREE.Mesh(new THREE.TorusGeometry(0.072, 0.006, 10, 60), goldMat()); bezel.rotation.x = Math.PI / 2; bezel.position.y = 0.016; compG.add(bezel);
  for (let i = 0; i < 12; i++) { const a = (i / 12) * TAU; const k = new THREE.Mesh(new THREE.BoxGeometry(0.003, 0.002, i % 3 ? 0.008 : 0.016), mat(0x2b2620)); k.position.set(Math.sin(a) * 0.056, 0.017, -Math.cos(a) * 0.056); k.rotation.y = -a; compG.add(k); }
  const needle = new THREE.Group(); needle.position.y = 0.024; compG.add(needle);
  const n1 = new THREE.Mesh(new THREE.ConeGeometry(0.012, 0.06, 4), glossy(0xb5483a)); n1.rotation.x = -Math.PI / 2; n1.position.z = -0.03; n1.scale.y = 1;
  const n2 = new THREE.Mesh(new THREE.ConeGeometry(0.012, 0.06, 4), glossy(0xf1e6c9)); n2.rotation.x = Math.PI / 2; n2.position.z = 0.03;
  const pivot = new THREE.Mesh(new THREE.SphereGeometry(0.006, 10, 8), goldMat()); needle.add(n1, n2, pivot);
  let needleA = 1.2, needleV = 0, spin = -9;
  ctx.tap(compG, () => { needleV = 14; spin = now; ctx.sfx.pop?.(); card('guide'); });

  shadowed(gatherG); shadowed(bulbG); shadowed(predG); shadowed(compG);
  [[gatherG, 'gather', 0.2], [bulbG, 'explain', 0.18], [predG, 'predict', 0.2], [compG, 'guide', 0.2]].forEach(([o, k, s], i) => H.add(o, COL[k], s, [0, 0.06, 0], 4.2 + i * 0.3));

  const INFO = {
    gather: ['وظيفة ١', 'تجميع الحقائق', 'تجمع الحقائق والمفاهيم والمبادئ وترتّبها في بناء منظّم، فيصير لها معنى وقيمة.'],
    explain: ['وظيفة ٢', 'التوضيح والتفسير', 'تقدّم توضيحاً وتفسيراً لعدد من الظواهر الطبيعية والإنسانية والكونية.'],
    predict: ['وظيفة ٣', 'التنبؤ', 'تساعد في توقّع الظواهر وحدوثها أو عدمه في ظل معطيات ومؤشرات معينة.'],
    guide: ['وظيفة ٤', 'توجيه الفكر العلمي', 'هي بمثابة الموجِّه لإجراءات البحث العلمي وعمليات الاستدلال العقلي.'],
  };
  function card(k) { const [a, b, c] = INFO[k]; ctx.ui.card({ tag: a, title: b, body: c, color: COL[k] }); found(k); }

  const tags = [
    ['تجميع الحقائق', gatherG, 'gather'], ['التفسير', bulbG, 'explain'], ['التنبؤ', predG, 'predict'], ['توجيه الفكر', compG, 'guide'],
  ].map(([t, o, k], i) => { const s2 = tagSprite(t, 0.19 / 1.35, COL[k]); s2.position.set(0, 0.015, i === 3 ? 0.12 : 0.15); o.add(s2); return s2; });

  ctx.ui.hud('المس كل آلة لترى ما تفعله النظرية');
  let now = 0; const v = new THREE.Vector3();
  return {
    update(t, dt, e) {
      now = t;
      sh.material.opacity = 0.22 * e; ringFlat.scale.setScalar(Math.max(stag(t, 0.1, 1) * e, 0.001));
      const grow = (o, d, m = 1) => { const k = Math.max(stag(t, d, 0.7, easeBack) * e, 0.001); o.scale.setScalar(k * m); };
      grow(mind, 0.2, 1.2); grow(stem, 0.2); grow(gatherG, 0.5, 1.35); grow(bulbG, 0.7, 1.35); grow(predG, 0.9, 1.35); grow(compG, 1.1, 1.2);
      // mind
      mindKick = Math.max(0, mindKick - dt * 1.4);
      const sp = 0.5 + mindKick * 3;
      gA.rotation.z += dt * sp; gB.rotation.z -= dt * sp * (11 / 8);
      mind.rotation.y = Math.sin(t * 0.5) * 0.25; mind.position.y = Y + 0.13 + Math.sin(t * 1.2) * 0.004;
      core.material.opacity = 0.4 + mindKick * 0.4 + Math.sin(t * 2) * 0.05;
      // gather
      asm += (asmTo - asm) * Math.min(1, dt * 3.5);
      cubes.forEach((c) => {
        v.lerpVectors(c.loose, c.home, ease(asm)); v.y += (1 - asm) * Math.sin(t * 1.4 + c.ph) * 0.012;
        c.m.position.copy(v); c.m.rotation.set((1 - asm) * Math.sin(t * 0.8 + c.ph), (1 - asm) * (t * 0.5 + c.ph), 0);
      });
      // bulb
      const want = t - bulbT < 4 ? 1 : 0;
      bulbOn += (want - bulbOn) * Math.min(1, dt * 5);
      glass.material.opacity = 0.35 + bulbOn * 0.1; fil.material.opacity = 0.12 + bulbOn * 0.85; bglow.material.opacity = bulbOn * 0.7;
      rays.forEach((r) => { const a = r.userData.a + t * 0.3; const d = 0.06 + bulbOn * 0.03; r.position.set(Math.cos(a) * d, 0.09 + Math.sin(a) * d, 0); r.rotation.set(0, 0, a);
        r.scale.setScalar(Math.max(bulbOn, 0.001)); });
      // predict
      const fk = clamp01((t - flyT) / 1.3);
      if (fk > 0 && fk < 1) { arcAt(fk, arrow.position); arrow.rotation.z = Math.atan2(Math.cos(fk * Math.PI) * Math.PI * 0.075, 0.145); arrow.visible = true; }
      else if (fk >= 1) arrow.visible = false;
      else { arrow.visible = true; arrow.position.set(0.02, 0.15 + Math.sin(t * 2) * 0.01, 0); arrow.rotation.z = 0; }
      trail.forEach((s, i) => { arcAt((i + 1) / 10, s.position); s.material.opacity = 0.25 + 0.35 * (fk >= 1 || fk <= 0 ? 0.5 + 0.5 * Math.sin(t * 3 - i * 0.6) : 1); });
      ballGlow.material.opacity = 0.3 + 0.1 * Math.sin(t * 2.2);
      // compass
      needleV *= Math.exp(-dt * 1.6);
      needleA += needleV * dt;
      if (now - spin > 2.2 || spin < 0) { const d = Math.atan2(Math.sin(0 - needleA), Math.cos(0 - needleA)); if (spin > 0) needleA += d * Math.min(1, dt * 3); else needleA += Math.sin(t * 0.7) * dt * 0.4; }
      needle.rotation.y = needleA;
      tags.forEach((s, i) => { s.visible = t > 1.4; setSpr(s, 0.19 / 1.35, clamp01((t - 1.4 - i * 0.12) * 1.6) * e); });
      H.update(t, e);
    },
  };
}
