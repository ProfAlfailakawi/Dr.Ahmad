// p351 — a cork board of pinned paper slips: each slip is one student's slide; tap them into the rail and they fuse into one deck the projector lights.
import * as THREE from 'three';
import { P, ease, easeBack, clamp01, stag, mat, glossy, goldMat, shadowed } from '../../kit.js?v=31';
import { TAU, canvasTex, rbox, lit, rig, hints, burstAt, lightPool, tagSprite, setSpr } from '../lib/a7.js?v=31';

export const meta = { free: true, center: [0.4, 0.56], typeLabel: 'مجسّم تفاعلي' };

const LETTERS = [
  ['G', 0x4285f4], ['o', 0xea4335], ['o', 0xfbbc05], ['g', 0x4285f4], ['l', 0x34a853], ['e', 0xea4335],
];

function corkTex() {
  return canvasTex(512, 512, (g, W, H) => {
    g.fillStyle = '#b8793f'; g.fillRect(0, 0, W, H);
    for (let i = 0; i < 2600; i++) {
      const x = Math.random() * W, y = Math.random() * H, r = 1 + Math.random() * 4.5, l = 28 + Math.random() * 28;
      g.fillStyle = `hsla(${24 + Math.random() * 10},${50 + Math.random() * 20}%,${l}%,${0.35 + Math.random() * 0.4})`;
      g.beginPath(); g.ellipse(x, y, r, r * (0.6 + Math.random() * 0.5), Math.random() * 3, 0, TAU); g.fill();
    }
  });
}
function slipTex(ch, color) {
  return canvasTex(192, 240, (g, W, H) => {
    g.fillStyle = '#fbf9f2'; g.fillRect(0, 0, W, H);
    g.fillStyle = 'rgba(0,0,0,.05)'; g.fillRect(0, H - 14, W, 14);
    g.fillStyle = '#' + color.toString(16).padStart(6, '0');
    g.font = '700 230px Georgia, "Times New Roman", serif'; g.textAlign = 'center'; g.textBaseline = 'alphabetic';
    g.fillText(ch, W / 2, ch === 'g' ? H * 0.68 : H * 0.8);
  });
}
function deckTex() {
  return canvasTex(768, 192, (g, W, H) => {
    const gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, '#ffffff'); gr.addColorStop(1, '#eef3ff');
    g.fillStyle = gr; g.fillRect(0, 0, W, H);
    g.font = '700 150px Georgia, serif'; g.textBaseline = 'alphabetic'; g.textAlign = 'left';
    let x = 148;
    LETTERS.forEach(([ch, c]) => { g.fillStyle = '#' + c.toString(16).padStart(6, '0'); g.fillText(ch, x, 140); x += g.measureText(ch).width; });
  });
}

function hexShape(r) {
  const s = new THREE.Shape();
  for (let i = 0; i < 6; i++) { const a = (i / 6) * TAU; const x = Math.cos(a) * r, y = Math.sin(a) * r; i ? s.lineTo(x, y) : s.moveTo(x, y); }
  s.closePath(); return s;
}
function hexSlab(r, depth, color, y, bevel = 0.004) {
  const m = new THREE.Mesh(new THREE.ExtrudeGeometry(hexShape(r), { depth, bevelEnabled: true, bevelSize: bevel, bevelThickness: bevel, bevelSegments: 2 }), glossy(color, { roughness: 0.35 }));
  m.rotation.x = -Math.PI / 2; m.position.y = y; return m;
}

export default function build(ctx) {
  const g = new THREE.Group(); g.position.copy(P(meta.center[0], meta.center[1])); ctx.stage.add(g); g.scale.setScalar(1.0);
  const R = rig(), H = hints(g);

  // ---- hexagon board: blue frames around real cork
  const board = new THREE.Group(); g.add(board);
  const wood = new THREE.Mesh(rbox(0.7, 0.03, 0.52, 0.012), glossy(0x8a5a32, { roughness: 0.55 })); wood.position.y = 0.015; board.add(wood);
  const corkMat = new THREE.MeshStandardMaterial({ map: corkTex(), roughness: 0.95 });
  const cork = new THREE.Mesh(rbox(0.63, 0.012, 0.45, 0.004), corkMat); cork.position.y = 0.03; board.add(cork);
  const sh = lightPool(0x000000, 0.5, 0.2); sh.position.y = -0.002; board.add(sh);
  R.add(board, 0.1, { dur: 0.9, rise: 0.05 });
  const CY = 0.04;

  // ---- screen (the shared deck) standing behind the board
  const screen = new THREE.Group(); screen.position.set(0, 0, -0.31); g.add(screen);
  const frame = new THREE.Mesh(rbox(0.6, 0.19, 0.014, 0.006), glossy(0x24365c)); frame.position.y = 0.2; screen.add(frame);
  const face = new THREE.Mesh(new THREE.PlaneGeometry(0.57, 0.16), new THREE.MeshBasicMaterial({ color: 0xe9eef7, toneMapped: false })); face.position.set(0, 0.2, 0.0075); screen.add(face);
  [-0.24, 0.24].forEach((x) => { const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.008, 0.12, 12), goldMat()); leg.position.set(x, 0.06, 0); screen.add(leg); });
  const deck = new THREE.Mesh(new THREE.PlaneGeometry(0.57, 0.16), new THREE.MeshBasicMaterial({ map: deckTex(), transparent: true, opacity: 0, toneMapped: false })); deck.position.set(0, 0.2, 0.0085); screen.add(deck);
  const slots = LETTERS.map((_, i) => new THREE.Vector3(-0.2125 + i * 0.085, 0.2, -0.31 + 0.02));
  const slotMarks = slots.map((p) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(0.076, 0.11), new THREE.MeshBasicMaterial({ color: 0xc6cfe2, toneMapped: false, transparent: true, opacity: 0.8 })); m.position.set(p.x, 0.2, -0.31 + 0.0082); g.add(m); return m; });
  R.add(screen, 0.4, { dur: 0.9, rise: 0.08 });
  slotMarks.forEach((m, i) => R.add(m, 0.8 + i * 0.06, { dur: 0.4, fn: ease }));

  // ---- slips pinned on the cork
  const spots = [[-0.155, -0.06, 0.2], [-0.06, 0.07, -0.16], [0.05, -0.09, 0.1], [0.15, 0.05, -0.22], [-0.1, 0.15, 0.12], [0.1, 0.17, -0.1]];
  let placed = 0, finished = false, merged = 0;
  const shown = new Set();
  const slips = LETTERS.map(([ch, c], i) => {
    const grp = new THREE.Group(); const [x, z, rot] = spots[i];
    const home = new THREE.Vector3(x, CY + 0.004, z);
    grp.position.copy(home); grp.scale.setScalar(1.22); g.add(grp);
    const paper = new THREE.Group(); grp.add(paper);
    const card = new THREE.Mesh(rbox(0.068, 0.0045, 0.086, 0.001), new THREE.MeshStandardMaterial({ roughness: 0.7, color: 0xffffff }));
    card.material = [mat(0xf2efe6), mat(0xf2efe6), new THREE.MeshStandardMaterial({ map: slipTex(ch, c), roughness: 0.7 }), mat(0xf2efe6), mat(0xf2efe6), mat(0xf2efe6)];
    // RoundedBoxGeometry has a single group, so use a thin plane for the print and a box for the paper
    card.material = mat(0xf4f1e8); paper.add(card);
    const print = new THREE.Mesh(new THREE.PlaneGeometry(0.064, 0.082), new THREE.MeshStandardMaterial({ map: slipTex(ch, c), roughness: 0.7 })); print.rotation.x = -Math.PI / 2; print.position.y = 0.0024; paper.add(print);
    const pin = new THREE.Group(); const head = new THREE.Mesh(new THREE.SphereGeometry(0.0085, 16, 12), glossy(c)); head.position.y = 0.011; const spike = new THREE.Mesh(new THREE.CylinderGeometry(0.0013, 0.0013, 0.012, 6), mat(0xaaaaaa)); spike.position.y = 0.004;
    pin.add(head, spike); pin.position.set(0, 0.0, -0.028); paper.add(pin);
    paper.rotation.y = rot; paper.rotation.x = 0;
    const o = { grp, paper, pin, home, i, c, state: 0, k: 0, from: new THREE.Vector3(), phase: Math.random() * 6 };
    R.add(grp, 1.0 + i * 0.25, { dur: 0.7, rise: 0.22 });
    H.add(card, c, 0.14);
    ctx.tap(grp, () => pick(o));
    return o;
  });

  function pick(o) {
    if (o.state !== 0) return;
    o.state = 1; o.k = 0; o.from.copy(o.grp.position); ctx.sfx.pop?.(); H.seen(o.paper.children[0]); burstAt(ctx, o.grp, o.c, 14, 0.3, 0.022);
    if (!shown.has('slip')) { shown.add('slip'); ctx.ui.card({ tag: 'عرض مشترك', title: 'شريحة لكل طالب', body: 'يُكلَّف كل طالب بنشاط تعليمي مختلف عن زملائه.', color: 0x4285f4 }); }
    o.order = placed++;
  }

  // ---- comment bubble and projector
  const bubble = new THREE.Group(); bubble.position.set(0.31, 0.12, 0.05); g.add(bubble);
  const bb = new THREE.Mesh(rbox(0.1, 0.07, 0.016, 0.02), glossy(0xfbbc05)); bubble.add(bb);
  const tail = new THREE.Mesh(new THREE.ConeGeometry(0.014, 0.03, 4), glossy(0xfbbc05)); tail.rotation.set(Math.PI, 0.8, 0.3); tail.position.set(-0.025, -0.05, 0); bubble.add(tail);
  [-0.025, 0, 0.025].forEach((x) => { const d = new THREE.Mesh(new THREE.SphereGeometry(0.006, 12, 8), mat(0xffffff)); d.position.set(x, 0, 0.0095); bubble.add(d); });
  R.add(bubble, 2.4, { dur: 0.8, rise: 0.1 }); H.add(bb, 0xfbbc05, 0.16);
  ctx.tap(bubble, () => { ctx.sfx.pop?.(); H.seen(bb); R.bounce(bubble); burstAt(ctx, bubble, 0xfbbc05, 16, 0.3, 0.022); ctx.ui.card({ tag: 'خاصية التعليقات', title: 'متابعة دون لقاء', body: 'يتابع المدرّس إنجاز الطلبة ويوجّههم بالتعليقات دون حاجة إلى لقاء مباشر.', color: 0xfbbc05 }); });

  const proj = new THREE.Group(); proj.position.set(0, 0.03, 0.34); g.add(proj);
  const pbody = new THREE.Mesh(rbox(0.12, 0.05, 0.08, 0.014), glossy(0xf4f1e8)); pbody.position.y = 0.03; proj.add(pbody);
  const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.02, 24), glossy(0x2a3350)); lens.rotation.x = Math.PI / 2; lens.position.set(0, 0.035, -0.045); proj.add(lens);
  const lg = new THREE.Mesh(new THREE.CircleGeometry(0.012, 20), lit(0x9fd0ff)); lg.position.set(0, 0.035, -0.0555); lg.rotation.y = Math.PI; proj.add(lg);
  const beamLen = 0.62;
  const beam = new THREE.Mesh(new THREE.ConeGeometry(0.17, beamLen, 40, 1, true), new THREE.MeshBasicMaterial({ color: 0xcfe4ff, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, toneMapped: false }));
  const dir = new THREE.Vector3(0, 0.2 - 0.07, -0.3 - 0.33).normalize();
  beam.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), dir);
  beam.position.copy(new THREE.Vector3(0, 0.07, 0.33 - 0.05)).addScaledVector(dir, beamLen / 2);
  g.add(beam);
  R.add(proj, 2.0, { dur: 0.8, rise: 0.1 }); H.add(pbody, 0x9fd0ff, 0.16);
  ctx.tap(proj, () => {
    ctx.sfx.pop?.(); H.seen(pbody); R.bounce(proj);
    if (merged) ctx.ui.card({ tag: 'عرض موحّد', title: 'تُجمَّع الشرائح', body: 'تُنسَّق الشرائح في عرض واحد يُقدَّم عبر جهاز العرض.', color: 0x34a853 });
    else ctx.ui.card({ tag: 'جهاز العرض', title: 'Projector', body: 'ضع الشرائح في الإطار لتُعرض معاً.', color: 0x9fd0ff });
  });

  ctx.ui.hud('المس الشرائح لتجمعها');
  const tmp = new THREE.Vector3(); let now = 0;
  return {
    update(t, dt, e) {
      now = t;
      R.update(t, dt, e); H.update(t, e, stag(t, 3.2, 0.6));
      slips.forEach((o) => {
        if (o.state === 0) {
          const k = R.k(o.grp);
          o.paper.position.y = Math.sin(t * 1.5 + o.phase) * 0.003 + 0.002;
        } else if (o.state === 1) {
          o.k = Math.min(1, o.k + dt / 1.0);
          const k = ease(o.k), tg = slots[o.order];
          tmp.lerpVectors(o.from, tg, k); tmp.y += Math.sin(k * Math.PI) * 0.16;
          o.grp.position.copy(tmp);
          o.paper.rotation.x = THREE.MathUtils.lerp(0, Math.PI / 2, k);
          o.paper.rotation.y = THREE.MathUtils.lerp(o.paper.rotation.y, 0, k * 0.2);
          o.pin.visible = k < 0.2;
          if (o.k >= 1) { o.state = 2; ctx.sfx.click?.(); burstAt(ctx, o.grp, o.c, 10, 0.2, 0.02); if (placed === 6 && slips.every((s) => s.state === 2)) merge(); }
        }
      });
      const mk = merged ? clamp01((t - merged) / 1.1) : 0;
      deck.material.opacity = mk;
      beam.material.opacity = 0.12 * mk * (0.85 + 0.15 * Math.sin(t * 4));
      face.material.color.setScalar(0.92 + 0.08 * mk);
      slips.forEach((o) => { if (o.state === 2) { o.grp.visible = mk < 0.98; const s = 1 - 0.06 * mk; o.paper.scale.setScalar(s); } });
      slotMarks.forEach((m, i) => { if (slips.some((s) => s.order === i && s.state > 0)) m.material.opacity = Math.max(0, m.material.opacity - dt * 3); });
      lg.material.opacity = 1;
    },
  };
  function merge() {
    merged = now + 0.0001;
    ctx.sfx.good?.();
    burstAt(ctx, deck, 0xffffff, 40, 0.5, 0.035);
    setTimeout(() => {
      ctx.ui.card({ tag: 'عرض موحّد', title: 'الشرائح صارت عرضاً', body: 'تُجمَّع الشرائح وتُنسَّق في عرض موحّد يُقدَّم عبر جهاز العرض.', color: 0x34a853 });
      ctx.ui.done();
    }, 1200);
  }
}
