import * as THREE from 'three';
import { scene, plinth, contactShadow, paintTex, drawText, textPlate, RB, GL, TAU, sm, mat, glossy, goldMat, shadowed, glow, ease, easeBack, clamp01, burstAt, lightPool, shuffle, faceYaw } from '../lib/b7-kit.js?v=21';
export const meta = { free: true, center: [0.5, 0.64], typeLabel: 'لعبة مطابقة' };

// Six real miniatures stand on a ring. A function token hovers in the middle: tap the invention it belongs to.
const INV = [
  { k: 'holo', n: 'HoloLens', c: 0x3b8fe0, f: 'نظارة بالأوامر الصوتية', full: 'نظارة ثلاثية الأبعاد تُدار بالأوامر الصوتية والإيماءات، دون أزرار أو شاشة لمس.' },
  { k: 'aura', n: 'Aura', c: 0x8a63c9, f: 'منبّه يقيس النوم', full: 'منبّه ذكي يقيس ساعات النوم وحرارة الغرفة، ويطلق الموسيقى الهادئة والضوء المناسب.' },
  { k: 'toy', n: 'Cognitoys', c: 0x3aa6a0, f: 'لعبة ناطقة للطفل', full: 'لعبة ناطقة تحدد شخصية الطفل وتعمل عبر الإنترنت، وتجيب عن أسئلته.' },
  { k: 'pan', n: 'Pantelligent', c: 0xf29a2e, f: 'مقلاة تذكّر بالخطوات', full: 'مقلاة ذكية تذكّر بخطوات الوجبة ومقاديرها، وتختار الحرارة والوقت المناسبين.' },
  { k: 'buds', n: 'Here Active', c: 0xd9344b, f: 'تتحكم في الضوضاء', full: 'سماعات لاسلكية تتحكم في الضوضاء المحيطة، تضخّم الأصوات أو تخفّضها.' },
  { k: 'dial', n: 'أداة النوم', c: 0x7ab648, f: 'يُدار بنظام IOS', full: 'أداة للتحكم في جهاز النوم الذكي، يُتحكم بها بواسطة نظام IOS.' },
];
const RAD = 0.25, PT = 0.05;

function sign(w, h, text, { color = '#f6efdf', fg = '#2b2620', border = '#d4ad55', fs = 64, px = 1500 } = {}) {
  const W = Math.round(w * px), H = Math.round(h * px);
  const draw = (t) => (x) => { x.clearRect(0, 0, W, H); x.beginPath(); x.roundRect(5, 5, W - 10, H - 10, H * 0.28); x.fillStyle = color; x.fill(); x.lineWidth = 7; x.strokeStyle = border; x.stroke(); drawText(x, t, W / 2, H / 2, W * 0.86, H * 0.74, { size: fs, color: fg }); };
  const tex = paintTex(W, H, draw(text));
  const g = new THREE.Group();
  const mk = (ry) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex, transparent: true, toneMapped: false, side: THREE.FrontSide })); m.rotation.y = ry; m.position.z = ry ? -0.0015 : 0.0015; return m; };
  g.add(mk(0)); g.add(mk(Math.PI));
  g.userData.set = (t) => { draw(t)(tex.userData.x); tex.needsUpdate = true; };
  return g;
}

function model(k, c) {
  const g = new THREE.Group(); const a = {};
  if (k === 'holo') {
    const band = new THREE.Mesh(new THREE.TorusGeometry(0.052, 0.006, 10, 40, TAU * 0.72), glossy(0x2b2f3a)); band.rotation.x = Math.PI / 2; band.rotation.z = Math.PI * 0.64; band.position.y = 0.05; g.add(band);
    const vis = new THREE.Mesh(new THREE.CylinderGeometry(0.056, 0.056, 0.04, 36, 1, true, -1.05, 2.1), new THREE.MeshPhysicalMaterial({ color: 0x5aa8ff, transparent: true, opacity: 0.55, roughness: 0.05, clearcoat: 1, side: THREE.DoubleSide, depthWrite: false })); vis.rotation.y = Math.PI / 2; vis.position.y = 0.05; g.add(vis);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.056, 0.003, 8, 40, 2.1), goldMat()); rim.rotation.x = Math.PI / 2; rim.rotation.z = Math.PI / 2 - 1.05; rim.position.y = 0.07; g.add(rim);
    const cube = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.03, 0.03), new THREE.MeshBasicMaterial({ color: 0x8cc8ff, wireframe: true, toneMapped: false })); cube.position.y = 0.125; g.add(cube); a.spin = cube;
    const core = new THREE.Mesh(new THREE.OctahedronGeometry(0.01), GL(0xbfe0ff, 1)); core.position.y = 0.125; g.add(core); a.spin2 = core;
    a.glow = glow(0x5aa8ff, 0.1, 0); a.glow.position.y = 0.125; g.add(a.glow);
  } else if (k === 'aura') {
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.052, 0.058, 0.026, 36), glossy(0xf1ebdd)); base.position.y = 0.013; g.add(base);
    const dome = new THREE.Mesh(new THREE.SphereGeometry(0.046, 32, 18, 0, TAU, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0xffb066, emissive: 0xff8a2a, emissiveIntensity: 0.8, roughness: 0.35, transparent: true, opacity: 0.95 })); dome.position.y = 0.026; g.add(dome); a.dome = dome;
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.047, 0.003, 8, 40), goldMat()); ring.rotation.x = Math.PI / 2; ring.position.y = 0.027; g.add(ring);
    [-1, 0, 1].forEach((i) => { const b = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.004, 0.003), goldMat()); b.position.set(i * 0.016, 0.014, 0.0575); g.add(b); });
    a.glow = glow(0xffb36a, 0.2, 0); a.glow.position.y = 0.05; g.add(a.glow);
  } else if (k === 'toy') {
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.044, 0.075, 32), glossy(c, { roughness: 0.3 })); body.position.y = 0.0375; g.add(body);
    const band = new THREE.Mesh(new THREE.CylinderGeometry(0.0445, 0.0445, 0.01, 32), goldMat()); band.position.y = 0.045; g.add(band);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.036, 28, 18, 0, TAU, 0, Math.PI * 0.62), glossy(0xf6efdf)); head.position.y = 0.075; g.add(head);
    const slit = new THREE.Mesh(new THREE.BoxGeometry(0.044, 0.007, 0.004), GL(0xbfffff, 1)); slit.position.set(0, 0.088, 0.031); slit.rotation.x = -0.25; g.add(slit); a.slit = slit;
    const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.0018, 0.0018, 0.035, 8), goldMat()); rod.position.y = 0.122; g.add(rod);
    const tip = new THREE.Mesh(new THREE.SphereGeometry(0.006, 12, 10), GL(0xffe3a0, 1)); tip.position.y = 0.142; g.add(tip); a.tip = tip;
    for (let i = 0; i < 9; i++) { const d = new THREE.Mesh(new THREE.CylinderGeometry(0.0025, 0.0025, 0.002, 8), mat(0x1e2a2a)); const ang = (i - 4) * 0.2; d.position.set(Math.sin(ang) * 0.039, 0.025, Math.cos(ang) * 0.039); d.rotation.x = Math.PI / 2; d.rotation.z = -ang; d.lookAt(d.position.x * 2, 0.025, d.position.z * 2); g.add(d); }
    a.glow = glow(0xbfffff, 0.1, 0); a.glow.position.y = 0.14; g.add(a.glow);
  } else if (k === 'pan') {
    const pan = new THREE.Mesh(new THREE.CylinderGeometry(0.058, 0.044, 0.026, 40, 1, true), new THREE.MeshStandardMaterial({ color: 0x3a3d45, metalness: 0.75, roughness: 0.28, side: THREE.DoubleSide })); pan.position.y = 0.03; g.add(pan);
    const floor = new THREE.Mesh(new THREE.CircleGeometry(0.044, 36), new THREE.MeshStandardMaterial({ color: 0x23262d, metalness: 0.6, roughness: 0.35 })); floor.rotation.x = -Math.PI / 2; floor.position.y = 0.018; g.add(floor);
    const lip = new THREE.Mesh(new THREE.TorusGeometry(0.058, 0.003, 8, 40), goldMat()); lip.rotation.x = Math.PI / 2; lip.position.y = 0.043; g.add(lip);
    const handle = new THREE.Mesh(RB(0.07, 0.008, 0.014, 0.004), glossy(0x2b2f3a)); handle.position.set(0.1, 0.034, 0); g.add(handle);
    const egg = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.004, 24), new THREE.MeshStandardMaterial({ color: 0xfaf6ea, roughness: 0.4 })); egg.position.set(-0.01, 0.021, 0.005); g.add(egg);
    const yolk = new THREE.Mesh(new THREE.SphereGeometry(0.0085, 16, 12), GL(0xffb92e, 0.35)); yolk.position.set(-0.01, 0.025, 0.005); g.add(yolk);
    a.steam = [0, 1, 2].map((i) => { const s = glow(0xffffff, 0.04, 0.0); s.userData.ph = i; g.add(s); return s; });
    const led = new THREE.Mesh(new THREE.SphereGeometry(0.004, 10, 8), GL(0x5aa8ff, 1)); led.position.set(0.062, 0.036, 0); g.add(led); a.led = led;
    a.glow = glow(0x5aa8ff, 0.07, 0); a.glow.position.set(0.062, 0.04, 0); g.add(a.glow);
  } else if (k === 'buds') {
    const cs = new THREE.Mesh(RB(0.07, 0.03, 0.045, 0.014), glossy(0xf6efdf)); cs.position.y = 0.015; g.add(cs);
    const seam = new THREE.Mesh(RB(0.072, 0.003, 0.047, 0.001), goldMat()); seam.position.y = 0.03; g.add(seam);
    a.buds = [-1, 1].map((s) => { const b = new THREE.Group(); const hd = new THREE.Mesh(new THREE.SphereGeometry(0.014, 18, 14), glossy(c)); b.add(hd); const st = new THREE.Mesh(new THREE.CapsuleGeometry(0.004, 0.026, 4, 10), glossy(0xf6efdf)); st.position.set(0, -0.022, -0.004); b.add(st); b.position.set(s * 0.02, 0.06, 0); b.rotation.z = s * -0.25; g.add(b); return b; });
    a.waves = [0, 1, 2].map((i) => { const w = new THREE.Mesh(new THREE.TorusGeometry(0.03 + i * 0.016, 0.0016, 6, 30, 1.6), new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.0, toneMapped: false })); w.position.y = 0.08; w.rotation.z = Math.PI / 2 - 0.8; g.add(w); return w; });
    a.glow = glow(c, 0.1, 0); a.glow.position.y = 0.06; g.add(a.glow);
  } else {
    const puck = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.054, 0.03, 40), glossy(0xf1ebdd)); puck.position.y = 0.015; g.add(puck);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.04, 0.0032, 10, 48), goldMat()); ring.rotation.x = Math.PI / 2; ring.position.y = 0.0315; g.add(ring);
    a.dial = new THREE.Group(); a.dial.position.y = 0.03; g.add(a.dial);
    const kn = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.028, 0.014, 32), glossy(0x2b2f3a)); kn.position.y = 0.007; a.dial.add(kn);
    const mk = new THREE.Mesh(new THREE.BoxGeometry(0.004, 0.003, 0.016), GL(c, 1)); mk.position.set(0, 0.0155, -0.01); a.dial.add(mk);
    a.leds = Array.from({ length: 10 }, (_, i) => { const l = new THREE.Mesh(new THREE.SphereGeometry(0.0023, 8, 6), GL(c, 0.2)); const an = (i / 10) * TAU; l.position.set(Math.cos(an) * 0.0455, 0.032, Math.sin(an) * 0.0455); g.add(l); return l; });
    const m1 = new THREE.Mesh(new THREE.TorusGeometry(0.014, 0.004, 8, 24, TAU * 0.78), goldMat()); m1.position.set(0, 0.075, 0); m1.rotation.z = 0.7; g.add(m1); a.moon = m1;
    a.glow = glow(c, 0.1, 0); a.glow.position.y = 0.075; g.add(a.glow);
  }
  g.userData.a = a; return shadowed(g);
}

export default function build(ctx) {
  const S = scene(ctx, meta, 1.06), g = S.g;
  const pad = plinth(0.37, { color: 0x2e4250 }); g.add(pad); S.part(pad, 0.1, { dur: 0.8, rise: 0 });
  g.add(contactShadow(0.9, 0.9, 0.4));
  const wash = lightPool(0xf29a2e, 0.34, 0.0); wash.position.y = 0.027; g.add(wash);
  const top = 0.025;
  const cam = ctx.camera, cv = new THREE.Vector3(), gv = new THREE.Vector3();

  const items = INV.map((d, i) => {
    const ang = (i / 6) * TAU + Math.PI / 6 * 0 - Math.PI / 2 + Math.PI / 6;
    const o = new THREE.Group(); o.position.set(Math.cos(ang) * RAD, top, Math.sin(ang) * RAD); g.add(o);
    const ped = new THREE.Group(); o.add(ped);
    const cyl = new THREE.Mesh(new THREE.CylinderGeometry(0.072, 0.082, PT, 40), glossy(0xf1ebdd, { roughness: 0.35 })); cyl.position.y = PT / 2; ped.add(cyl);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.0725, 0.0045, 10, 48), goldMat()); rim.rotation.x = Math.PI / 2; rim.position.y = PT; ped.add(rim);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.082, 0.0034, 8, 48), new THREE.MeshBasicMaterial({ color: d.c, transparent: true, opacity: 0.0, toneMapped: false })); ring.rotation.x = Math.PI / 2; ring.position.y = 0.004; ped.add(ring);
    shadowed(ped);
    const m = model(d.k, d.c); m.scale.setScalar(1.4); m.position.y = PT + 0.004; m.rotation.y = -ang + Math.PI / 2; ped.add(m);
    const a = m.userData.a;
    const nm = sign(0.2, 0.052, d.n, { fs: 64 }); nm.position.set(0, 0.021, 0.0); o.add(nm);
    const rec = { d, o, ped, m, a, ring, nm, ang, done: false, shake: -9, wrong: -9, ok: -9 };
    S.part(o, 0.5 + i * 0.22, { rise: 0.1, dur: 0.9 });
    rec.pr = S.touch(ped, () => pick(rec), { color: d.c, size: 0.16, at: new THREE.Vector3(0, PT + 0.05, 0), wake: 3.6 });
    return rec;
  });
  // name plates in front of each pedestal (always readable): placed at pedestal front (+z), lying on the plinth
  items.forEach((r) => { r.nm.position.set(0, 0.014, 0.125); });

  // hovering token
  const token = new THREE.Group(); token.position.set(0, top + 0.3, 0); g.add(token);
  const tk = sign(0.34, 0.1, '', { color: '#fff7e6', border: '#f29a2e', fs: 64 }); token.add(tk);
  const tkGlow = glow(0xffc860, 0.4, 0.5); tk.add(tkGlow);
  const tkTrim = new THREE.Mesh(new THREE.TorusGeometry(0.014, 0.003, 8, 24), goldMat()); // gold pin on top
  token.visible = false;

  const order = shuffle([0, 1, 2, 3, 4, 5], 11);
  let round = -1, solved = 0, tries = 0, flight = null, nextAt = 3.4, fin = false, finT = -1;
  const target = () => items[order[round]];
  function next() {
    round++;
    if (round >= 6) { finT = S.now; return; }
    tk.userData.set(INV[order[round]].f); token.visible = true; tkT0 = S.now; flight = null;
    ctx.ui.hud('المس الابتكار المناسب');
  }
  let tkT0 = 0;
  function pick(r) {
    if (round < 0 || round >= 6) { cardFor(r); return; }
    if (flight) return;
    const t = target();
    if (r.done) { cardFor(r); return; }
    if (r === t) {
      r.done = true; r.pr.on = false; solved++; r.ok = S.now; ctx.sfx.good?.();
      flight = { t0: S.now, from: token.position.clone(), r };
      burstAt(S, r.m, r.d.c, 30, 0.5, 0.03);
      ctx.ui.card({ tag: r.d.n, title: r.d.n, body: r.d.full, color: r.d.c });
      ctx.ui.hud(`${['', 'واحد', 'اثنان', 'ثلاثة', 'أربعة', 'خمسة', 'ستة'][solved]} من ستة`);
    } else {
      tries++; r.wrong = S.now; ctx.sfx.bad?.(); tkT0 = S.now - 99; wig = S.now;
      ctx.ui.toast('ليس هذا، تأمّل الوظيفة');
    }
  }
  let wig = -9;
  function cardFor(r) { ctx.ui.card({ tag: r.d.n, title: r.d.n, body: r.d.full, color: r.d.c }); }

  // finale ring
  const crown = new THREE.Mesh(new THREE.TorusGeometry(RAD, 0.003, 8, 120), new THREE.MeshBasicMaterial({ color: 0xffd27a, transparent: true, opacity: 0, toneMapped: false })); crown.rotation.x = Math.PI / 2; crown.position.y = top + 0.012; g.add(crown);
  ctx.ui.hud('ابتكارات تعلّم المستقبل');

  S.loop((t, dt, e) => {
    wash.material.opacity = 0.22 * ease((t - 0.4) / 1.2) * e;
    const yaw = faceYaw(g, cam);
    if (t > nextAt && round < 0) { next(); nextAt = 1e9; }
    items.forEach((r, i) => {
      const a = r.a, dn = r.done;
      r.nm.rotation.y = yaw - 0; // plates face the viewer
      r.nm.rotation.y = yaw;
      const sh = clamp01(1 - (t - r.wrong) / 0.5) * Math.sin((t - r.wrong) * 55) * 0.008;
      r.ped.position.x = sh;
      r.ring.material.opacity = dn ? 0.55 + 0.2 * Math.sin(t * 2 + i) : clamp01(1 - (t - r.wrong) / 0.8) * 0.0;
      if (!dn && t - r.wrong < 0.8) { r.ring.material.color.setHex(0xd9344b); r.ring.material.opacity = 0.8 * (1 - (t - r.wrong) / 0.8); } else r.ring.material.color.setHex(r.d.c);
      const act = dn ? 1 : 0.0;
      const idle = 0.5 + 0.5 * Math.sin(t * 2 + i);
      r.m.position.y = PT + 0.004 + (dn ? 0.006 * Math.sin(t * 2 + i) : 0) * 1;
      if (a.glow) { a.glow.material.opacity = dn ? 0.55 + 0.2 * Math.sin(t * 3) : 0.0; }
      if (a.spin) { a.spin.rotation.y = t * (dn ? 2.2 : 0.7); a.spin.rotation.x = t * (dn ? 1.5 : 0.4); a.spin.position.y = 0.125 + 0.008 * Math.sin(t * 2); a.spin2.rotation.y = -t * 2; a.spin2.position.y = a.spin.position.y; a.glow.position.y = a.spin.position.y; }
      if (a.dome) a.dome.material.emissiveIntensity = dn ? 1.4 + 0.5 * Math.sin(t * 2.6) : 0.5 + 0.12 * Math.sin(t * 1.5);
      if (a.slit) { a.slit.material.emissiveIntensity = dn ? 1.8 : 0.9 + 0.3 * Math.sin(t * 4 + i); a.tip.scale.setScalar(1 + (dn ? 0.4 : 0.1) * Math.sin(t * 6)); a.tip.position.y = 0.142; }
      if (a.steam) a.steam.forEach((s) => { const u = ((t * 0.5 + s.userData.ph / 3) % 1); s.position.set(-0.012 + 0.008 * Math.sin(u * 7 + s.userData.ph), 0.05 + u * 0.08, 0.004); s.scale.setScalar(0.03 + u * 0.05); s.material.opacity = (dn ? 0.45 : 0.14) * (1 - u); });
      if (a.led) a.led.material.emissiveIntensity = 0.6 + 0.6 * Math.sin(t * (dn ? 8 : 3));
      if (a.buds) { a.buds.forEach((b, k) => { b.position.y = 0.06 + 0.004 * Math.sin(t * 2.2 + k) + (dn ? 0.008 : 0); }); a.waves.forEach((w, k) => { const u = (t * 0.9 + k / 3) % 1; w.material.opacity = (dn ? 0.7 : 0.18) * (1 - u); w.scale.setScalar(0.8 + u * 0.5); }); }
      if (a.dial) { a.dial.rotation.y = dn ? t * 1.6 : Math.sin(t * 0.8) * 0.8; a.leds.forEach((l, k) => { l.material.emissiveIntensity = dn ? 0.4 + 1.2 * Math.max(0, Math.sin(t * 5 - k * 0.6)) : 0.15; }); a.moon.rotation.y = t * 1.2; a.moon.position.y = 0.075 + 0.005 * Math.sin(t * 2); a.glow.position.y = a.moon.position.y; }
    });
    // token
    if (token.visible) {
      token.rotation.y = yaw;
      if (flight) {
        const u = sm((t - flight.t0) / 0.8);
        const tp = flight.r.o.position; token.position.set(lerpN(flight.from.x, tp.x, u), lerpN(flight.from.y, top + PT + 0.06, u) + Math.sin(u * Math.PI) * 0.06, lerpN(flight.from.z, tp.z, u));
        token.scale.setScalar(Math.max(0.05, 1 - u * 0.9));
        if (u >= 1) { token.visible = false; nextAt2 = t + 0.5; flight = null; round_pending = true; }
      } else {
        const pop = easeBack((t - tkT0) / 0.7);
        token.position.set(Math.sin((t - wig) * 55) * 0.01 * clamp01(1 - (t - wig) / 0.5), top + 0.3 + 0.012 * Math.sin(t * 2), 0); token.scale.setScalar(Math.max(0.0001, t - tkT0 < 5 ? pop : 1));
        tkGlow.material.opacity = 0.4 + 0.15 * Math.sin(t * 3);
      }
    }
    if (round_pending && t > nextAt2) { round_pending = false; next(); }
    if (finT > 0) {
      const u = clamp01((t - finT) / 1.2); crown.material.opacity = 0.9 * u; crown.rotation.z = t * 0.5; crown.position.y = top + 0.012 + 0.03 * u;
      if (!fin && t - finT > 0.5) { fin = true; burstAt(S, pad, 0xffd27a, 60, 0.7, 0.045); ctx.sfx.good?.(); ctx.ui.card({ tag: 'ابتكارات تعلّم المستقبل', title: 'لكل ابتكار وظيفة تميّزه', body: tries ? `طابقت الستة بعد ${['', 'محاولة خاطئة واحدة', 'محاولتين خاطئتين'][Math.min(tries, 2)]}${tries > 2 ? ' عدة محاولات' : ''}. الاسترجاع بجهد يقوّي الذاكرة.` : 'طابقت الستة دون خطأ. الاسترجاع بجهد يقوّي الذاكرة.', color: 0xf29a2e }); ctx.ui.done(); }
    }
  });
  let nextAt2 = 0, round_pending = false;
  return { update: S.update };
}
const lerpN = (a, b, k) => a + (b - a) * k;
