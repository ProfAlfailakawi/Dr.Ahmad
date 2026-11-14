import * as THREE from 'three';
import { mat, glossy, goldMat, shadowed, glow, stag, ease, easeBack, clamp01 } from '../../kit.js?v=34';
import { scene, RoundedBox, TAU, person2, contactShadow } from '../lib/a8-kit.js?v=34';
export const meta = { free: true, center: [0.62, 0.353], typeLabel: 'مجسّم تفاعلي' };

const GL = (c, i = 1) => new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: i, roughness: 0.3 });
const SPOT = [
  { k: 'teacher', n: 'مدرّسون مؤهلون', c: 0xd9344b, body: 'مدرّسون مؤهلون لتنفيذ النشاطات وإدارة الصفوف، وهم أحد العناصر الأساسية الثلاثة اللازمة للنجاح في هذا القرن.' },
  { k: 'design', n: 'مصمّمون مختصون', c: 0x3b8fe0, body: 'مصمّمون مختصون في تصميم النشاطات اللازمة لتنمية المهارات وتطويرها.' },
  { k: 'school', n: 'مدارس فاعلة', c: 0xf29a2e, body: 'مدارس فاعلة في مجال إستراتيجيات تدريس المهارات المتنوعة.' },
  { k: 'team', n: 'مهارات خفيفة', c: 0x7ac143, body: 'تتمثل المهارات الخفيفة في التواصل والمبادرة والتأقلم وإيجاد الحلول والعمل ضمن فريق.' },
  { k: 'learner', n: 'متعلم القرن', c: 0xd4ad55, body: 'يحتاج إلى المهارات الأساسية التي تساعده في المستقبل، والفهم العميق للاختصاص، إضافة إلى المهارات الخفيفة.' },
];
function screenTex() {
  const c = document.createElement('canvas'); c.width = 512; c.height = 300; const x = c.getContext('2d');
  const g = x.createLinearGradient(0, 0, 512, 300); g.addColorStop(0, '#1d4f6e'); g.addColorStop(1, '#0f2f45'); x.fillStyle = g; x.fillRect(0, 0, 512, 300);
  x.fillStyle = '#f3b13a'; [120, 170, 90, 140].forEach((h, i) => x.fillRect(300 + i * 42, 250 - h, 28, h));
  x.fillStyle = '#e3b894'; x.beginPath(); x.arc(130, 120, 44, 0, TAU); x.fill();
  x.fillStyle = '#d9344b'; x.beginPath(); x.roundRect(70, 170, 120, 130, 40); x.fill();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function blueTex() {
  const c = document.createElement('canvas'); c.width = 512; c.height = 360; const x = c.getContext('2d');
  x.fillStyle = '#2a68b4'; x.fillRect(0, 0, 512, 360);
  x.strokeStyle = 'rgba(255,255,255,.28)'; x.lineWidth = 2; for (let i = 0; i <= 512; i += 32) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i, 360); x.stroke(); } for (let j = 0; j <= 360; j += 30) { x.beginPath(); x.moveTo(0, j); x.lineTo(512, j); x.stroke(); }
  x.strokeStyle = '#fff'; x.lineWidth = 6; x.lineJoin = 'round'; x.strokeRect(90, 150, 150, 130); x.beginPath(); x.moveTo(90, 150); x.lineTo(165, 90); x.lineTo(240, 150); x.stroke(); x.beginPath(); x.arc(380, 200, 70, 0, TAU); x.stroke(); x.beginPath(); x.moveTo(380, 200); x.lineTo(430, 150); x.stroke();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}


export default function build(ctx) {
  const S = scene(ctx, meta), g = S.g;
  // the one round stage of this batch: the printed green disc, as a thin soft rug (not a plinth)
  const rug = new THREE.Mesh(new THREE.CircleGeometry(0.4, 72), new THREE.MeshStandardMaterial({ color: 0x7fae3c, roughness: 0.85, transparent: true, opacity: 0.0 })); rug.rotation.x = -Math.PI / 2; rug.position.y = 0.002; g.add(rug);
  const rug2 = new THREE.Mesh(new THREE.RingGeometry(0.36, 0.4, 72), new THREE.MeshStandardMaterial({ color: 0xd4ad55, roughness: 0.5, metalness: 0.6, transparent: true, opacity: 0.0 })); rug2.rotation.x = -Math.PI / 2; rug2.position.y = 0.003; g.add(rug2);
  const sh0 = contactShadow(0.7, 0.4, 0.3); sh0.position.y = 0.0035; g.add(sh0);

  // ---- the meeting table: wood oval, chrome stem, glass top
  const table = new THREE.Group(); g.add(table);
  const top = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 0.02, 64), glossy(0x7a4f38, { roughness: 0.28, clearcoat: 0.8 })); top.scale.set(0.23, 1, 0.12); top.position.y = 0.115; table.add(top);
  const rimT = new THREE.Mesh(new THREE.TorusGeometry(1, 0.045, 8, 64), goldMat()); rimT.rotation.x = Math.PI / 2; rimT.scale.set(0.23, 0.12, 0.2); rimT.position.y = 0.105; rimT.scale.set(0.23, 0.12, 0.18); table.add(rimT);
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.03, 0.1, 20), glossy(0xc8ccd2, { metalness: 0.7, roughness: 0.2 })); stem.position.y = 0.055; table.add(stem);
  const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.12, 0.008, 40), glossy(0xc8ccd2, { metalness: 0.7, roughness: 0.2 })); foot.position.y = 0.004; table.add(foot);
  const glass = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 0.002, 64), new THREE.MeshStandardMaterial({ color: 0xffd9a0, emissive: 0xf29a2e, emissiveIntensity: 0.0, transparent: true, opacity: 0.0 })); glass.scale.set(0.21, 1, 0.1); glass.position.y = 0.126; table.add(glass);
  // papers and a small laptop on the table
  const lap = new THREE.Group(); lap.position.set(-0.07, 0.126, 0.02); table.add(lap);
  const lb = new THREE.Mesh(new RoundedBox(0.07, 0.006, 0.05, 0.004), glossy(0xc8ccd2, { metalness: 0.5 })); lap.add(lb);
  const ls = new THREE.Mesh(new RoundedBox(0.07, 0.048, 0.004, 0.004), glossy(0x2a2f38)); ls.position.set(0, 0.026, -0.024); ls.rotation.x = -0.25; lap.add(ls);
  const lsc = new THREE.Mesh(new THREE.PlaneGeometry(0.06, 0.038), new THREE.MeshStandardMaterial({ color: 0x4aa0ff, emissive: 0x4aa0ff, emissiveIntensity: 0.9 })); lsc.position.set(0, 0.026, -0.0216); lsc.rotation.x = -0.25; lap.add(lsc);
  const pap = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.002, 0.035), mat(0xfbf6ea)); pap.position.set(0.09, 0.1275, 0.03); pap.rotation.y = 0.4; table.add(pap);
  shadowed(table); S.part(table, 0.2, { rise: 0.06 });

  // ---- six colleagues in chairs
  const fig = [];
  const palette = [[0x2f3f5a, 0xe3b894, 0x2a211c, false], [0xf0ede6, 0xc78d63, 0x2a211c, true], [0x3a5a4a, 0xf0c9a6, 0x7a4a2a, false], [0x6b4a8a, 0xe3b894, 0x1c1713, true], [0xe8e2d4, 0x8a5a3a, 0x1c1713, false], [0x2f3f5a, 0xf0c9a6, 0xb98a4a, true]];
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * TAU + 0.52, x = Math.cos(a) * 0.3, z = Math.sin(a) * 0.17;
    const grp = new THREE.Group(); grp.position.set(x, 0, z); grp.rotation.y = Math.atan2(-x, -z); g.add(grp);
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.006, 16), glossy(0x2b2620)); base.position.set(0, 0.012, -0.03); grp.add(base);
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.05, 8), glossy(0xc8ccd2, { metalness: 0.6 })); post.position.set(0, 0.04, -0.03); grp.add(post);
    const seat = new THREE.Mesh(new RoundedBox(0.09, 0.016, 0.09, 0.008), glossy(0xe0643a)); seat.position.set(0, 0.067, -0.025); grp.add(seat);
    const back = new THREE.Mesh(new RoundedBox(0.09, 0.07, 0.014, 0.007), glossy(0xe0643a)); back.position.set(0, 0.115, -0.07); back.rotation.x = -0.12; grp.add(back);
    const [bc, sk, hr, lg] = palette[i];
    const p = person2({ body: bc, skin: sk, hair: hr, long: lg, s: 1.15, seated: true, trousers: 0x2b2f3a }); p.position.set(0, 0.05, -0.052); grp.add(p);
    const u = p.userData; u.armL.rotation.set(-0.85, 0, -0.1); u.armR.rotation.set(-0.85, 0, 0.1); u.armL.userData.elbow.rotation.x = -0.55; u.armR.userData.elbow.rotation.x = -0.55;
    S.part(grp, 0.6 + i * 0.16, { rise: 0.12 }); fig.push({ grp, p, a });
  }

  // ---- the remote teacher on the wall screen, and the teacher figure beside it
  const screenG = new THREE.Group(); screenG.position.set(0, 0, -0.31); g.add(screenG);
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.005, 0.2, 8), goldMat()); post.position.y = 0.1; screenG.add(post);
  const sc = new THREE.Mesh(new RoundedBox(0.3, 0.17, 0.014, 0.01), glossy(0x1b1f24)); sc.position.y = 0.28; screenG.add(sc);
  const sf = new THREE.Mesh(new THREE.PlaneGeometry(0.28, 0.15), new THREE.MeshBasicMaterial({ map: screenTex(), toneMapped: false })); sf.position.set(0, 0.28, 0.0075); screenG.add(sf);
  shadowed(screenG); S.part(screenG, 1.2, { rise: 0.1 });
  const teacher = person2({ body: 0xd9344b, trousers: 0x2b2f3a, s: 1.45, long: true }); teacher.position.set(0.25, 0, -0.2); teacher.rotation.y = -0.5; g.add(teacher); S.part(teacher, 1.4, { rise: 0.1 });
  teacher.userData.armR.rotation.set(-0.5, 0, 0.9); teacher.userData.armR.userData.elbow.rotation.x = -0.5;
  // designer's blueprint
  const bp = new THREE.Group(); bp.position.set(-0.27, 0.17, -0.15); bp.rotation.y = 0.7; g.add(bp);
  const bpf = new THREE.Mesh(new RoundedBox(0.23, 0.165, 0.01, 0.008), glossy(0xf3efe8)); bp.add(bpf);
  const bpi = new THREE.Mesh(new THREE.PlaneGeometry(0.21, 0.145), new THREE.MeshBasicMaterial({ map: blueTex(), toneMapped: false })); bpi.position.z = 0.0055; bp.add(bpi);
  shadowed(bp); S.part(bp, 1.6, { rise: 0.1 });
  // an effective school
  const school = new THREE.Group(); school.position.set(0.0, 0.0, 0.3); g.add(school);
  const sb = new THREE.Mesh(new RoundedBox(0.2, 0.09, 0.1, 0.01), glossy(0xf6efdf)); sb.position.y = 0.045; school.add(sb);
  const roof = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.22, 3), glossy(0xf29a2e)); roof.rotation.set(-Math.PI / 2, 0, Math.PI / 2); roof.position.set(0, 0.118, 0); school.add(roof);
  [-0.06, 0, 0.06].forEach((x) => { const w = new THREE.Mesh(new THREE.PlaneGeometry(0.03, 0.04), GL(0xffd27a, 0.7)); w.position.set(x, 0.052, 0.0505); school.add(w); });
  const door = new THREE.Mesh(new RoundedBox(0.03, 0.045, 0.005, 0.003), glossy(0x7a4f38)); door.position.set(0, 0.023, 0.052); school.add(door);
  const flag = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.02, 0.002), GL(0xd9344b, 0.6)); flag.position.set(0.022, 0.2, 0); school.add(flag);
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.0016, 0.0016, 0.08, 6), goldMat()); pole.position.y = 0.16; school.add(pole);
  shadowed(school); S.part(school, 1.8, { rise: 0.1 });
  // the learner's crystal over the table
  const crystal = new THREE.Group(); crystal.position.y = 0.25; g.add(crystal);
  const cm = new THREE.MeshPhysicalMaterial({ color: 0xbfe6ff, roughness: 0.05, transparent: true, opacity: 0.6, emissive: 0x7ac1ff, emissiveIntensity: 0.5, clearcoat: 1, depthWrite: false });
  const cry = new THREE.Mesh(new THREE.OctahedronGeometry(0.05, 0), cm); cry.scale.y = 1.45; crystal.add(cry);
  const ch = glow(0xbfe6ff, 0.28, 0.5); crystal.add(ch);
  S.part(crystal, 2.0, { rise: 0.12 });

  const tri = new THREE.Group(); g.add(tri);
  const triPts = [new THREE.Vector3(0.25, 0.26, -0.2), new THREE.Vector3(-0.27, 0.17, -0.15), new THREE.Vector3(0, 0.18, 0.3)];
  const triLine = new THREE.Line(new THREE.BufferGeometry().setFromPoints([...triPts, triPts[0]]), new THREE.LineBasicMaterial({ color: 0xffd27a, transparent: true, opacity: 0 })); tri.add(triLine);
  const spokes = triPts.map((p) => { const l = new THREE.Line(new THREE.BufferGeometry().setFromPoints([p, new THREE.Vector3(0, 0.25, 0)]), new THREE.LineBasicMaterial({ color: 0xffd27a, transparent: true, opacity: 0 })); tri.add(l); return l; });

  const targets = { teacher, design: bp, school, team: table, learner: crystal };
  const at = { teacher: [0, 0.15, 0], design: [0, 0, 0.01], school: [0, 0.1, 0.0], team: [0, 0.12, 0], learner: [0, 0, 0] };
  const sizes = { teacher: 0.34, design: 0.34, school: 0.32, team: 0.5, learner: 0.28 };
  const tagAt = { teacher: [0.27, 0.34, -0.12], design: [-0.3, 0.34, -0.05], school: [0, 0.27, 0.36], team: [0.0, 0.17, 0.02], learner: [0, 0.38, 0.0] };
  const seen = new Set(); let lit = 0;
  SPOT.forEach((sp, i) => {
    const tg = S.tag(sp.n, sp.c, 0.12, { ppu: 2200 }); tg.s.position.set(...tagAt[sp.k]); tg.delay = 3.0 + i * 0.2;
    S.touch(targets[sp.k], () => {
      if (!seen.has(sp.k)) { seen.add(sp.k); lit++; }
      S.burst(targets[sp.k].position.clone().add(new THREE.Vector3(0, 0.18, 0)), sp.c, 30, 0.55);
      ctx.sfx.good?.(); ctx.ui.card({ tag: 'ما يحتاجه المتعلم', title: sp.n, body: sp.body, color: sp.c });
      if (sp.k === 'team') S.teamT = S.now;
      ctx.ui.hud(lit >= 5 ? 'اكتملت صورة متعلم القرن' : `${['', 'واحد', 'اثنان', 'ثلاثة', 'أربعة'][lit]} من خمسة`);
      if (lit >= 5 && !S.finished) { S.finished = true; setTimeout(() => ctx.ui.done(), 2000); }
    }, { color: sp.c, size: sizes[sp.k], at: new THREE.Vector3(...at[sp.k]), wake: 3.4 });
  });
  ctx.ui.hud('ما الذي يحتاجه متعلم القرن؟');

  S.loop((t, dt, e) => {
    rug.material.opacity = 0.9 * ease(t / 1.0) * e; rug2.material.opacity = 0.7 * ease(t / 1.0) * e;
    crystal.rotation.y = t * 0.8; crystal.position.y = 0.25 + Math.sin(t * 1.6) * 0.008;
    const three = seen.has('teacher') && seen.has('design') && seen.has('school'), k3 = three ? 1 : 0;
    triLine.material.opacity = THREE.MathUtils.damp(triLine.material.opacity, 0.9 * k3, 3, dt);
    spokes.forEach((l) => { l.material.opacity = THREE.MathUtils.damp(l.material.opacity, 0.6 * k3, 3, dt); });
    cm.emissiveIntensity = 0.5 + (three ? 0.6 : 0) + Math.sin(t * 2.4) * 0.12; cm.color.set(three ? 0xffe3a0 : 0xbfe6ff); cm.emissive.set(three ? 0xffc65a : 0x7ac1ff);
    const tk = S.teamT !== undefined ? clamp01(1 - (t - S.teamT) / 4) : 0;
    glass.material.opacity = 0.4 * tk; glass.material.emissiveIntensity = 0.9 * tk;
    fig.forEach((f, i) => { f.p.position.y = 0.05 + Math.sin(t * 1.3 + i * 1.7) * 0.0015 + tk * Math.max(0, Math.sin(t * 6 + i)) * 0.006; f.p.userData.head.rotation.y = Math.sin(t * 0.7 + i) * 0.25; });
    teacher.userData.armR.rotation.x = -0.5 + Math.sin(t * 1.8) * 0.15; teacher.rotation.y = -0.5 + Math.sin(t * 0.7) * 0.15;
    bp.position.y = 0.17 + Math.sin(t * 1.4) * 0.004; flag.position.x = 0.022 + Math.sin(t * 3) * 0.003;
  });
  return { update: S.update };
}
