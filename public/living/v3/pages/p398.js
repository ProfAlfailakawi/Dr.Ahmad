import * as THREE from 'three';
import { mat, glossy, goldMat, shadowed, glow, stag, ease, easeBack, clamp01, label } from '../../kit.js?v=15';
import { scene, RoundedBox, TAU, person2, contactShadow } from '../lib/a8-kit.js?v=15';
export const meta = { free: true, center: [0.56, 0.345], typeLabel: 'خريطة ضوئية' };
const hex = (c) => '#' + c.toString(16).padStart(6, '0');
const TECH = [
  { n: 'مواد مطبوعة', c: 0x7ac143, note: 'الكتب الدراسية والبرامج التعليمية ودليل الدروس.' },
  { n: 'تكنولوجيا الصوت', c: 0x3b8fe0, note: 'الأشرطة والبث الإذاعي والهواتف.' },
  { n: 'رسوم إلكترونية', c: 0xf29a2e, note: 'اللوحة الإلكترونية والفاكس.' },
  { n: 'تكنولوجيا الفيديو', c: 0x8a5ad8, note: 'التلفزيون التربوي والعادي والفيديو التفاعلي وأشرطة الفيديو وأقراصه.' },
  { n: 'الحاسوب وشبكاته', c: 0xd9344b, note: 'الحاسوب التعليمي وشبكة الإنترنت ومناقشات البريد الإلكتروني.' },
];
const GL = (c, i = 1) => new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: i, roughness: 0.3 });

function chalkTex() {
  const c = document.createElement('canvas'); c.width = c.height = 512; const x = c.getContext('2d');
  const gr = x.createRadialGradient(256, 256, 20, 256, 256, 280); gr.addColorStop(0, '#2f3a3f'); gr.addColorStop(1, '#171c1f');
  x.fillStyle = gr; x.fillRect(0, 0, 512, 512);
  x.strokeStyle = 'rgba(255,255,255,.88)'; x.lineWidth = 7; x.lineCap = 'round'; x.lineJoin = 'round';
  x.beginPath(); x.roundRect(120, 150, 272, 150, 10); x.stroke();            // laptop screen
  x.beginPath(); x.moveTo(90, 330); x.lineTo(422, 330); x.lineTo(396, 306); x.lineTo(116, 306); x.closePath(); x.stroke();
  x.font = '700 46px Arial'; x.fillStyle = 'rgba(255,255,255,.92)'; x.textAlign = 'center'; x.fillText('WWW', 256, 240);
  x.beginPath(); x.arc(256, 395, 16, 0, TAU); x.stroke(); x.beginPath(); x.moveTo(256, 411); x.lineTo(256, 450); x.stroke();
  const t = new THREE.CanvasTexture(x.canvas); t.colorSpace = THREE.SRGBColorSpace; return t;
}

function mkTech(i) {
  const g = new THREE.Group(), c = TECH[i].c;
  if (i === 0) {
    [[0xd9344b, 0.0, 0.08], [0x3b8fe0, 0.014, -0.05], [0xf29a2e, 0.028, 0.02]].forEach(([col, y, r]) => { const b = new THREE.Mesh(new RoundedBox(0.085, 0.014, 0.06, 0.004), glossy(col)); b.position.y = 0.007 + y; b.rotation.y = r; g.add(b); const pg = new THREE.Mesh(new THREE.BoxGeometry(0.078, 0.009, 0.055), mat(0xfbf6ea)); pg.position.set(0.003, 0.007 + y, 0); pg.rotation.y = r; g.add(pg); });
    const top = new THREE.Mesh(new RoundedBox(0.085, 0.014, 0.06, 0.004), glossy(c)); top.position.y = 0.049; top.rotation.y = 0.2; g.add(top);
  } else if (i === 1) {
    const r = new THREE.Mesh(new RoundedBox(0.1, 0.055, 0.04, 0.012), glossy(0x2f2b27)); r.position.y = 0.0275; g.add(r);
    const sp = new THREE.Mesh(new THREE.CylinderGeometry(0.019, 0.019, 0.004, 24), mat(0x6a625a)); sp.rotation.x = Math.PI / 2; sp.position.set(-0.026, 0.028, 0.02); g.add(sp);
    const dial = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.011, 0.005, 20), GL(c, 1.1)); dial.rotation.x = Math.PI / 2; dial.position.set(0.026, 0.03, 0.02); g.add(dial);
    const an = new THREE.Mesh(new THREE.CylinderGeometry(0.0013, 0.0013, 0.07, 6), mat(0xcfcfcf)); an.position.set(0.035, 0.085, 0); an.rotation.z = -0.35; g.add(an);
  } else if (i === 2) {
    const tb = new THREE.Mesh(new RoundedBox(0.09, 0.065, 0.007, 0.006), glossy(0x24211e)); tb.position.y = 0.04; tb.rotation.x = -0.35; g.add(tb);
    const sc = new THREE.Mesh(new THREE.PlaneGeometry(0.08, 0.055), GL(c, 0.9)); sc.position.set(0, 0.041, 0.0045); sc.rotation.x = -0.35; sc.position.y = 0.0405; sc.position.z = 0.0042 + 0.0; g.add(sc);
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.004, 0.035), glossy(0x24211e)); leg.position.set(0, 0.002, 0); g.add(leg);
    const st = new THREE.Mesh(new THREE.CapsuleGeometry(0.0022, 0.05, 4, 8), glossy(0xf6efdf)); st.position.set(0.055, 0.02, 0.014); st.rotation.z = 0.5; g.add(st);
  } else if (i === 3) {
    const tv = new THREE.Mesh(new RoundedBox(0.095, 0.07, 0.055, 0.014), glossy(0x2f2b27)); tv.position.y = 0.04; g.add(tv);
    const sc = new THREE.Mesh(new RoundedBox(0.07, 0.05, 0.004, 0.01), GL(c, 0.85)); sc.position.set(-0.007, 0.04, 0.028); g.add(sc);
    [-1, 1].forEach((s) => { const a = new THREE.Mesh(new THREE.CylinderGeometry(0.0013, 0.0013, 0.06, 6), mat(0xcfcfcf)); a.position.set(s * 0.02, 0.1, 0); a.rotation.z = -s * 0.5; g.add(a); });
  } else {
    const b = new THREE.Mesh(new RoundedBox(0.1, 0.007, 0.07, 0.004), glossy(0xb8bec7, { metalness: 0.5 })); b.position.y = 0.0035; g.add(b);
    const sc = new THREE.Group(); sc.position.set(0, 0.007, -0.033); sc.rotation.x = -0.28; g.add(sc);
    const fr = new THREE.Mesh(new RoundedBox(0.1, 0.066, 0.005, 0.004), glossy(0x24211e)); fr.position.y = 0.033; sc.add(fr);
    const sm = new THREE.Mesh(new THREE.PlaneGeometry(0.09, 0.056), GL(c, 0.8)); sm.position.set(0, 0.033, 0.003); sc.add(sm);
  }
  return shadowed(g);
}


export default function build(ctx) {
  const S = scene(ctx, meta), g = S.g;
  const sh0 = contactShadow(0.95, 0.5, 0.35); sh0.position.set(0, 0.0015, 0.05); g.add(sh0);
  // ---- the easel and the round chalkboard
  const board = new THREE.Group(); board.position.set(-0.1, 0, -0.14); g.add(board);
  [[-0.12, 0.03], [0.12, 0.03], [0, -0.1]].forEach(([x, z], k) => { const l = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.007, 0.34, 8), goldMat()); l.position.set(x * 0.5, 0.17, z * 0.5); l.rotation.z = -x * 1.2; l.rotation.x = z * 0.9; board.add(l); });
  const face = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.016, 64), mat(0x1d1f21)); face.rotation.x = Math.PI / 2; face.position.y = 0.34; board.add(face);
  const chalk = new THREE.Mesh(new THREE.CircleGeometry(0.195, 64), new THREE.MeshBasicMaterial({ map: chalkTex(), toneMapped: false })); chalk.position.set(0, 0.34, 0.0088); board.add(chalk);
  const ringM = new THREE.MeshStandardMaterial({ color: 0xe0b85e, emissive: 0xd4ad55, emissiveIntensity: 0.15, roughness: 0.28, metalness: 0.85 });
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.203, 0.013, 12, 80), ringM); ring.position.set(0, 0.34, 0.002); board.add(ring);
  const ring2 = new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.006, 8, 80), new THREE.MeshStandardMaterial({ color: 0x4a9fe0, emissive: 0x4a9fe0, emissiveIntensity: 0.3 })); ring2.position.set(0, 0.34, -0.004); board.add(ring2);
  shadowed(board); S.part(board, 0.15, { rise: 0.1 });
  const bhalo = glow(0xffd27a, 0.7, 0.0); bhalo.position.set(0, 0.34, 0.04); board.add(bhalo);

  // ---- the teacher's desk
  const desk = new THREE.Group(); desk.position.set(0, 0, 0.1); g.add(desk);
  const top = new THREE.Mesh(new RoundedBox(0.84, 0.03, 0.3, 0.012), glossy(0x9b6a43, { roughness: 0.35, clearcoat: 0.6 })); top.position.y = 0.115; desk.add(top);
  const edge = new THREE.Mesh(new RoundedBox(0.846, 0.006, 0.306, 0.012), goldMat()); edge.position.y = 0.101; desk.add(edge);
  [[-0.38, -0.12], [0.38, -0.12], [-0.38, 0.12], [0.38, 0.12]].forEach(([x, z]) => { const l = new THREE.Mesh(new THREE.CylinderGeometry(0.013, 0.01, 0.1, 12), glossy(0x7a4f32)); l.position.set(x, 0.05, z); desk.add(l); });
  const front = new THREE.Mesh(new RoundedBox(0.76, 0.06, 0.012, 0.006), glossy(0x84573a)); front.position.set(0, 0.075, 0.14); desk.add(front);
  [-0.12, 0.12].forEach((x) => { const h = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.06, 8), goldMat()); h.rotation.z = Math.PI / 2; h.position.set(x, 0.075, 0.153); desk.add(h); });
  shadowed(desk); S.part(desk, 0.3, { rise: 0.08 });

  // ---- the teacher, pointer in hand
  const teacher = person2({ body: 0xd9344b, trousers: 0x2b2f3a, s: 1.55, long: true }); teacher.position.set(0.32, 0, -0.12); g.add(teacher); S.part(teacher, 0.7, { rise: 0.12 });
  const aR = teacher.userData.armR, aL = teacher.userData.armL; aL.rotation.set(0.1, 0, -0.15);
  const wand = new THREE.Mesh(new THREE.CylinderGeometry(0.0022, 0.0022, 0.2, 6), goldMat()); wand.position.y = -0.1; aR.userData.elbow.add(wand);
  const tipObj = new THREE.Object3D(); tipObj.position.y = -0.2; aR.userData.elbow.add(tipObj);
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.003, 0.003, 1, 8), new THREE.MeshBasicMaterial({ color: 0xffd27a, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false })); g.add(beam); beam.renderOrder = 5;
  const beamTip = glow(0xffd27a, 0.1, 0); g.add(beamTip);

  // ---- five technologies on the desk
  const items = []; const xs = [-0.31, -0.155, 0, 0.155, 0.31];
  TECH.forEach((tc, i) => {
    const grp = new THREE.Group(); grp.position.set(xs[i], 0.13, 0.08); g.add(grp);
    const padm = new THREE.Mesh(new RoundedBox(0.14, 0.006, 0.12, 0.016), new THREE.MeshStandardMaterial({ color: tc.c, emissive: tc.c, emissiveIntensity: 0.35, roughness: 0.35 })); padm.position.y = 0.003; grp.add(padm);
    const m = mkTech(i); m.position.y = 0.006; m.scale.setScalar(1.55); grp.add(m);
    const plate = label(tc.n, 0.13, { size: 52, width: 420, weight: 800, border: hex(tc.c), pad: 16, radius: 18 }); plate.rotation.x = -1.05; plate.position.set(0, 0.012, 0.088); grp.add(plate);
    const lamp = glow(tc.c, 0.3, 0); lamp.position.y = 0.07; grp.add(lamp);
    shadowed(grp); S.part(grp, 1.0 + i * 0.3, { rise: 0.14 });
    items.push({ grp, m, padm, lamp, tc, i, on: false });
  });

  let aim = null, aimK = 0, touched = 0, aimY = 0;
  const tip = new THREE.Vector3(), dst = new THREE.Vector3(), dir = new THREE.Vector3(), Y = new THREE.Vector3(0, 1, 0);
  items.forEach((it) => {
    S.touch(it.grp, () => {
      aim = it; aimK = 0;
      if (!it.on) { it.on = true; touched++; it.lamp.material.opacity = 0.6; it.padm.material.emissiveIntensity = 1.2; S.burst(new THREE.Vector3(it.grp.position.x, 0.2, it.grp.position.z), it.tc.c, 28); ctx.sfx.good?.(); }
      beam.material.color.set(it.tc.c); beamTip.material.color.set(it.tc.c); ringM.emissive.set(it.tc.c); ringM.emissiveIntensity = 0.7;
      ctx.ui.card({ tag: 'يوظّفها المعلم', title: it.tc.n, body: it.tc.note, color: it.tc.c });
      ctx.ui.hud(touched >= 5 ? 'خمس تقنيات بيد المعلم' : `${['', 'واحدة', 'اثنتان', 'ثلاث', 'أربع'][touched]} من خمس`);
      if (touched >= 5 && !S.finished) { S.finished = true; setTimeout(() => ctx.ui.done(), 1900); }
    }, { color: it.tc.c, size: 0.34, at: new THREE.Vector3(0, 0.07, 0), wake: 3.4 });
  });
  ctx.ui.hud('المس تقنية ليشير إليها المعلم');

  S.loop((t, dt, e) => {
    const goal = aim ? new THREE.Vector3(aim.grp.position.x, 0.19, aim.grp.position.z) : new THREE.Vector3(-0.1, 0.3, -0.12);
    const dx = goal.x - teacher.position.x, dz = goal.z - teacher.position.z, want = Math.atan2(dx, dz);
    let d = want - teacher.rotation.y; d = Math.atan2(Math.sin(d), Math.cos(d)); teacher.rotation.y += d * Math.min(1, dt * 5);
    teacher.userData.head.rotation.y = Math.sin(t * 0.9) * 0.15;
    aR.rotation.x = -1.2 - Math.min(0.25, (goal.y - 0.15) * 0.8) + Math.sin(t * 1.5) * 0.05; aR.rotation.z = 0.05; aR.userData.elbow.rotation.x = -0.25;
    aimK = THREE.MathUtils.damp(aimK, aim ? 1 : 0, 4, dt);
    teacher.updateMatrixWorld(true); tip.setFromMatrixPosition(tipObj.matrixWorld); g.worldToLocal(tip);
    dir.subVectors(goal, tip); const L = dir.length();
    beam.position.copy(tip).addScaledVector(dir, 0.5); beam.scale.set(1, Math.max(L, 0.001), 1); beam.quaternion.setFromUnitVectors(Y, dir.normalize());
    beam.material.opacity = (aim ? 0.55 + 0.25 * Math.sin(t * 6) : 0) * aimK; beam.visible = aimK > 0.02;
    beamTip.position.copy(goal); beamTip.material.opacity = 0.85 * aimK; beamTip.scale.setScalar(0.09 + Math.sin(t * 6) * 0.01);
    bhalo.material.opacity = touched ? 0.16 + 0.08 * Math.sin(t * 2) : 0; bhalo.material.color.set(aim ? aim.tc.c : 0xffd27a);
    items.forEach((it, i) => { it.m.rotation.y = Math.sin(t * 0.8 + i) * 0.4; it.m.position.y = 0.006 + Math.sin(t * 1.7 + i) * 0.003 + (it.on ? 0.012 : 0); if (!it.on) it.lamp.material.opacity = t > 3.4 ? 0.18 + 0.1 * Math.sin(t * 2.4 + i) : 0; });
  });
  return { update: S.update };
}
