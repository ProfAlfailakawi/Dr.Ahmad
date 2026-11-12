// p184 — a chalkboard easel and three school pedestals: carry each technology to the theory it came from, staking coins on your confidence.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { P, ease, easeBack, clamp01, stag, mat, glossy, goldMat, shadowed } from '../../kit.js?v=29';
import { tagSprite, setSpr, softLight } from '../../v2/common.js?v=29';
import { blobShadow, hints, finder } from '../lib/a3-kit.js?v=29';

export const meta = { free: true, center: [0.5, 0.75], typeLabel: 'لعبة مراهنة' };

const SCH = [
  { n: 'سلوكية', c: 0xef7a2a, x: -0.25, why: 'الحواسيب التقليدية كالبرامج التدريبية اتبعت المبادئ السلوكية المتسلسلة وقدمت تغذية راجعة منتظمة.' },
  { n: 'معرفية', c: 0x3b8fd0, x: 0, why: 'النظرية المعرفية طُبقت في تطوير الحواسيب والبرمجيات ذات البنية الصارمة للمدخلات والمخرجات.' },
  { n: 'بنائية', c: 0x6a9a2a, x: 0.25, why: 'استُخدمت الوسائط المتعددة، من صور وفيديو وخرائط، في تطبيق النظرية البنائية.' },
];

function faceTex(kind) {
  const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d');
  g.fillStyle = '#fbf6ea'; g.fillRect(0, 0, 128, 128);
  if (kind === 0) { g.fillStyle = '#9ad0ee'; g.fillRect(12, 12, 104, 104); g.fillStyle = '#f5c242'; g.beginPath(); g.arc(88, 40, 12, 0, 7); g.fill(); g.fillStyle = '#5b8f3a'; g.beginPath(); g.moveTo(12, 116); g.lineTo(50, 52); g.lineTo(84, 116); g.fill(); g.fillStyle = '#3f6b2a'; g.beginPath(); g.moveTo(54, 116); g.lineTo(88, 70); g.lineTo(116, 116); g.fill(); }
  else if (kind === 1) { g.fillStyle = '#2b2620'; g.fillRect(12, 20, 104, 88); g.fillStyle = '#fbf6ea'; for (let i = 0; i < 5; i++) { g.fillRect(16, 26 + i * 17, 8, 9); g.fillRect(104, 26 + i * 17, 8, 9); } g.fillStyle = '#ef7a2a'; g.beginPath(); g.moveTo(50, 44); g.lineTo(84, 64); g.lineTo(50, 84); g.fill(); }
  else if (kind === 2) { g.fillStyle = '#e9e0c4'; g.fillRect(12, 12, 104, 104); g.strokeStyle = '#b9a77a'; g.lineWidth = 3; for (let i = 1; i < 4; i++) { g.beginPath(); g.moveTo(12 + i * 26, 12); g.lineTo(12 + i * 26, 116); g.moveTo(12, 12 + i * 26); g.lineTo(116, 12 + i * 26); g.stroke(); } g.fillStyle = '#d63b2f'; g.beginPath(); g.arc(64, 54, 18, 0, 7); g.fill(); g.beginPath(); g.moveTo(50, 64); g.lineTo(64, 96); g.lineTo(78, 64); g.fill(); g.fillStyle = '#fff'; g.beginPath(); g.arc(64, 54, 7, 0, 7); g.fill(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

export default function build(ctx) {
  const g = new THREE.Group(); g.position.copy(P(0.5, 0.75)); ctx.stage.add(g);
  const H = hints(), found = finder(ctx, 3);
  const Y = 0.004;
  const sh0 = blobShadow(0.7, 0.34, 0.3); sh0.position.set(0, 0.003, -0.12); g.add(sh0);

  // ---- easel with a chalkboard
  const easel = new THREE.Group(); easel.position.set(0, Y, -0.17); g.add(easel);
  const wood = mat(0xd9a860, { roughness: 0.6 });
  [[-0.14, 0.05], [0.14, 0.05], [0, -0.08]].forEach(([x, z], i) => {
    const l = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.009, 0.36, 10), wood);
    l.position.set(x * (i === 2 ? 0 : 1), 0.17, z * 0.4); l.rotation.x = i === 2 ? -0.5 : 0.2; easel.add(l);
  });
  const frame = new THREE.Mesh(new RoundedBoxGeometry(0.4, 0.28, 0.022, 3, 0.008), wood); frame.position.set(0, 0.26, 0.02); frame.rotation.x = -0.14; easel.add(frame);
  const bc = document.createElement('canvas'); bc.width = 512; bc.height = 352; const bg = bc.getContext('2d');
  const drawBoard = (done) => {
    bg.fillStyle = '#2c312c'; bg.fillRect(0, 0, 512, 352);
    bg.fillStyle = 'rgba(255,255,255,.06)'; for (let i = 0; i < 40; i++) bg.fillRect(Math.random() * 512, Math.random() * 352, 60, 2);
    bg.fillStyle = '#f4f1e6'; bg.textAlign = 'center'; bg.font = '800 112px "Reem Kufi", Tajawal, sans-serif'; bg.fillText('LEARN', 256, 140);
    bg.font = 'italic 700 82px Georgia, serif'; bg.fillText('Theory', 256, 235);
    done.forEach((d, i) => { bg.fillStyle = '#' + SCH[d].c.toString(16).padStart(6, '0'); bg.fillRect(130 + i * 100, 276, 80, 8); });
  };
  drawBoard([]);
  const btex = new THREE.CanvasTexture(bc); btex.colorSpace = THREE.SRGBColorSpace; btex.anisotropy = 4;
  const bmesh = new THREE.Mesh(new THREE.PlaneGeometry(0.36, 0.247), new THREE.MeshBasicMaterial({ map: btex })); bmesh.position.z = 0.0125; frame.add(bmesh);
  const back = new THREE.Mesh(new THREE.PlaneGeometry(0.36, 0.247), new THREE.MeshStandardMaterial({ color: 0xb98a4a })); back.position.z = -0.0115; back.rotation.y = Math.PI; frame.add(back);
  const ledge = new THREE.Mesh(new RoundedBoxGeometry(0.4, 0.014, 0.04, 2, 0.005), wood); ledge.position.set(0, 0.115, 0.05); ledge.rotation.x = -0.14; easel.add(ledge);

  // ---- alarm clock
  const clock = new THREE.Group(); clock.position.set(0.39, Y, 0.0); g.add(clock);
  const cring = new THREE.Mesh(new THREE.TorusGeometry(0.036, 0.007, 12, 40), goldMat()); cring.position.y = 0.05; clock.add(cring);
  const cface = new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.036, 0.012, 36), mat(0xf6efe0)); cface.rotation.x = Math.PI / 2; cface.position.y = 0.05; clock.add(cface);
  const hand = new THREE.Mesh(new THREE.BoxGeometry(0.003, 0.028, 0.004), mat(0x2b2620)); hand.geometry.translate(0, 0.012, 0); const hand2 = hand.clone(); hand2.scale.y = 0.65;
  const hp = new THREE.Group(); hp.position.set(0, 0.05, 0.008); hp.add(hand, hand2); clock.add(hp);
  [-1, 1].forEach((s) => { const b = new THREE.Mesh(new THREE.SphereGeometry(0.014, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), goldMat()); b.position.set(s * 0.026, 0.092, 0); b.rotation.z = -s * 0.5; clock.add(b); const lg = new THREE.Mesh(new THREE.CylinderGeometry(0.003, 0.003, 0.02, 6), mat(0x2b2620)); lg.position.set(s * 0.024, 0.01, 0); lg.rotation.z = s * 0.4; clock.add(lg); });

  // ---- coins (your stake)
  const coinG = new THREE.Group(); coinG.position.set(-0.37, Y, 0.0); g.add(coinG);
  const coins = Array.from({ length: 5 }, (_, i) => { const c = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, 0.008, 28), goldMat()); c.position.y = 0.005 + i * 0.0095; c.castShadow = true; coinG.add(c); return c; });
  let stake = 3;
  ctx.tap(coinG, () => { ctx.sfx.pop?.(); ctx.ui.card({ tag: 'المراهنة', title: 'قدّر ثقتك أولاً', body: 'من يكتشف أنه واثق ومخطئ يصحّح فهمه أسرع ممن يقرأ الصواب فقط.', color: 0xd4ad55 }); });

  // ---- pedestals
  const peds = SCH.map((s, i) => {
    const grp = new THREE.Group(); grp.position.set(s.x, Y, 0.11); g.add(grp); const psh = blobShadow(0.2, 0.2, 0.3); psh.position.set(s.x, 0.003, 0.12); g.add(psh);
    const b = new THREE.Mesh(new THREE.CylinderGeometry(0.058, 0.07, 0.05, 40), glossy(s.c)); b.position.y = 0.025; grp.add(b);
    const top = new THREE.Mesh(new THREE.CylinderGeometry(0.062, 0.062, 0.008, 40), goldMat()); top.position.y = 0.054; grp.add(top);
    const tg = tagSprite(s.n, 0.17 / 1.35, s.c); tg.position.set(0, 0.13, -0.01); grp.add(tg);
    shadowed(grp);
    ctx.tap(grp, () => place(i));
    const hint = H.add(grp, s.c, 0.16, [0, 0.06, 0], 2.6 + i * 0.2);
    return { grp, tg, s, hint, flash: 0, bad: 0 };
  });

  // ---- case tokens
  const tokenDefs = [
    { school: 0, build() { // drill program: monitor with stair + check
      const t = new THREE.Group();
      const m = new THREE.Mesh(new RoundedBoxGeometry(0.075, 0.056, 0.012, 3, 0.005), mat(0x2b2620)); t.add(m);
      const sc = new THREE.Mesh(new THREE.PlaneGeometry(0.064, 0.044), new THREE.MeshBasicMaterial({ color: 0xfff1d6 })); sc.position.z = 0.0065; t.add(sc);
      for (let i = 0; i < 3; i++) { const s = new THREE.Mesh(new THREE.BoxGeometry(0.014, 0.008 * (i + 1), 0.004), mat(0xef7a2a)); s.position.set(-0.016 + i * 0.015, -0.015 + 0.004 * (i + 1), 0.009); t.add(s); }
      const ck = new THREE.Mesh(new THREE.BoxGeometry(0.004, 0.014, 0.004), new THREE.MeshBasicMaterial({ color: 0x3a9a4a })); ck.position.set(0.02, 0.012, 0.009); ck.rotation.z = 0.7; t.add(ck);
      const ck2 = new THREE.Mesh(new THREE.BoxGeometry(0.004, 0.026, 0.004), new THREE.MeshBasicMaterial({ color: 0x3a9a4a })); ck2.position.set(0.028, 0.016, 0.009); ck2.rotation.z = -0.7; t.add(ck2);
      const st = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.014, 0.01), mat(0x2b2620)); st.position.y = -0.035; t.add(st);
      return t; } },
    { school: 1, build() { // rigid input/output chip
      const t = new THREE.Group();
      const m = new THREE.Mesh(new RoundedBoxGeometry(0.052, 0.014, 0.052, 3, 0.004), glossy(0x1f3a52)); t.add(m);
      const die = new THREE.Mesh(new THREE.BoxGeometry(0.026, 0.004, 0.026), goldMat()); die.position.y = 0.009; t.add(die);
      for (let i = 0; i < 5; i++) [-1, 1].forEach((s) => { const p = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.003, 0.004), goldMat()); p.position.set(s * 0.032, 0, -0.02 + i * 0.01); t.add(p); });
      const mk = (x, r) => { const c = new THREE.Mesh(new THREE.ConeGeometry(0.008, 0.02, 12), glossy(0x3b8fd0)); c.rotation.z = r; c.position.set(x, 0.002, 0); t.add(c); };
      mk(-0.05, -Math.PI / 2); mk(0.05, -Math.PI / 2);
      return t; } },
    { school: 2, build() { // media cube
      const t = new THREE.Group();
      const ms = [1, 0, 2, 0, 1, 2].map((k) => new THREE.MeshStandardMaterial({ map: faceTex(k), roughness: 0.5 }));
      const m = new THREE.Mesh(new RoundedBoxGeometry(0.055, 0.055, 0.055, 2, 0.004), ms); t.add(m);
      return t; } },
  ];
  const slots = [-0.12, 0, 0.12];
  const order = [1, 2, 0];     // shuffle which case sits where
  const tokens = tokenDefs.map((d, i) => {
    const holder = new THREE.Group(); const rest = new THREE.Vector3([-0.25, 0, 0.25][order.indexOf(i)], Y + 0.12, 0.27); holder.position.copy(rest); g.add(holder);
    const body = d.build(); holder.add(body); shadowed(body);
    const halo = softLight(0xffc24a, 0.12, 0); holder.add(halo);
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.07, 0.01, 32), mat(0xf6efe0)); disc.position.set(rest.x, Y + 0.005, rest.z); g.add(disc);
    ctx.tap(holder, () => selectTok(i));
    const hint = H.add(holder, 0xffc24a, 0.1, [0, 0, 0], 2.2 + i * 0.2);
    return { d, holder, body, rest, halo, hint, home: rest.clone(), state: 'idle', t0: 0, from: new THREE.Vector3(), to: new THREE.Vector3(), shake: 0, i };
  });
  let sel = -1, now = 0, placed = 0; const doneList = [];

  function selectTok(i) {
    const k = tokens[i]; if (k.state === 'placed') return;
    ctx.sfx.pop?.(); sel = sel === i ? -1 : i;
    ctx.ui.hud(sel >= 0 ? 'أين تنتمي هذه الحالة؟' : 'اختر الحالة ثم المدرسة');
  }
  function place(pi) {
    if (sel < 0) { ctx.sfx.click?.(); ctx.ui.toast('اختر حالة أولاً'); peds[pi].flash = 0.6; return; }
    const k = tokens[sel], p = peds[pi];
    if (k.d.school === pi) {
      k.state = 'fly'; k.t0 = now; k.from.copy(k.holder.position); k.to.set(p.s.x, Y + 0.17, 0.11);
      p.flash = 1.6; sel = -1; placed += 1; doneList.push(pi); drawBoard(doneList); btex.needsUpdate = true;
      stake = Math.min(5, stake + 1); ctx.sfx.good?.();
      ctx.fx.burst(new THREE.Vector3(p.s.x, 0.12, 0.075).add(g.position), p.s.c, 30, 0.45, 0.035);
      ctx.ui.card({ tag: p.s.n, title: 'أحسنت', body: p.s.why, color: p.s.c });
      found(pi);
      ctx.ui.hud(placed < 3 ? 'اختر الحالة التالية' : 'عرفت أصل كل تقنية');
    } else {
      k.shake = 1; p.bad = 1; sel = -1; stake = Math.max(0, stake - 1); ctx.sfx.bad?.();
      ctx.ui.toast('ليست هذه المدرسة، جرّب غيرها');
      ctx.ui.hud('اختر الحالة ثم المدرسة');
    }
  }
  ctx.ui.hud('اختر الحالة ثم المدرسة');
  const v = new THREE.Vector3();
  return {
    update(t, dt, e) {
      now = t;
      sh0.material.opacity = 0.3 * e;
      easel.scale.setScalar(Math.max(stag(t, 0.1, 0.8, easeBack) * e, 0.001) * 1.35);
      clock.scale.setScalar(Math.max(stag(t, 0.5, 0.6, easeBack) * e, 0.001) * 1.5);
      coinG.scale.setScalar(Math.max(stag(t, 0.6, 0.6, easeBack) * e, 0.001) * 1.5);
      hp.children[0].rotation.z = -t * 0.8; hp.children[1].rotation.z = -t * 0.07;
      coins.forEach((c, i) => { const want = i < stake ? 1 : 0; c.scale.y += (want - c.scale.y) * Math.min(1, dt * 8); c.scale.x = c.scale.z = Math.max(0.001, c.scale.y); c.visible = c.scale.y > 0.05; });
      peds.forEach((p, i) => {
        p.grp.scale.setScalar(Math.max(stag(t, 0.3 + i * 0.15, 0.7, easeBack) * e, 0.001) * 1.35);
        p.flash = Math.max(0, p.flash - dt); p.bad = Math.max(0, p.bad - dt * 2);
        p.grp.position.y = Y + p.flash * 0.01 * Math.sin(t * 20) * 0 + (p.bad > 0 ? Math.sin(t * 40) * 0.003 * p.bad : 0);
        p.grp.children[0].material.emissive.setHex(p.bad > 0 ? 0xff2020 : p.s.c); p.grp.children[0].material.emissiveIntensity = p.bad > 0 ? p.bad * 0.7 : Math.min(0.6, p.flash * 0.4);
        setSpr(p.tg, 0.17 / 1.35, clamp01((t - 1.2 - i * 0.12) * 1.6) * e); p.tg.visible = t > 1.2;
      });
      tokens.forEach((k, i) => {
        const gk = Math.max(stag(t, 0.8 + i * 0.2, 0.7, easeBack) * e, 0.001); k.holder.scale.setScalar(gk * 1.6);
        k.shake = Math.max(0, k.shake - dt * 2);
        if (k.state === 'idle') {
          const up = sel === i ? 0.05 : 0;
          k.holder.position.x = k.rest.x + Math.sin(t * 50) * 0.008 * k.shake;
          k.holder.position.y = k.rest.y + up + Math.sin(t * 1.5 + i) * 0.006; k.holder.position.z = k.rest.z - (sel === i ? 0.02 : 0);
          k.halo.material.opacity = sel === i ? 0.7 : 0; k.hint.calm = sel === i;
          k.body.rotation.y = t * (sel === i ? 1.6 : 0.5) + i;
        } else if (k.state === 'fly') {
          const p = clamp01((t - k.t0) / 0.9); const q = ease(p);
          k.holder.position.lerpVectors(k.from, k.to, q); k.holder.position.y += Math.sin(p * Math.PI) * 0.12;
          k.body.rotation.y += dt * 3; k.halo.material.opacity = 0.6 * (1 - p);
          if (p >= 1) { k.state = 'placed'; k.hint.calm = true; }
        } else { k.holder.position.copy(k.to); k.holder.position.y += Math.sin(t * 2 + i) * 0.004; k.body.rotation.y += dt * 0.8; k.halo.material.opacity = 0.35; }
      });
      H.update(t, e);
    },
  };
}
