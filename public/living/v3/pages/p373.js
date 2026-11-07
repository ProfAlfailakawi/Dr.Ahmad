// p373 — a desk with notebooks, an apple and an iPad; four lesson stages, each offers three little objects: pick the one that fits and it docks into the iPad.
import * as THREE from 'three';
import { P, ease, easeBack, clamp01, stag, mat, glossy, goldMat, shadowed } from '../../kit.js?v=16';
import { TAU, canvasTex, rbox, lit, rig, hints, burstAt, lightPool, tagSprite, setSpr, hexSlab } from '../lib/a7.js?v=16';

export const meta = { free: true, center: [0.45, 0.25], typeLabel: 'لعبة تصميم' };

const STAGES = [
  { hud: 'نظّم عمل الطلبة', c: 0x4a8fd0, opts: [
    { l: 'مجموعات صغيرة', ok: true, fb: 'يضمن انشغال بقية المجموعات بتنفيذ عملها قبل أن يأتي دورها.' },
    { l: 'مشروع بالتتابع', fb: 'ينتظر بعض الطلبة دورهم، فيضيع الوقت ولا ينشغل الجميع.' },
    { l: 'طالب واحد', fb: 'ينفرد طالب واحد بالتعلّم النشط، ويتحول الباقون إلى متفرجين.' }] },
  { hud: 'اعرض على شاشة أكبر', c: 0x2fa38a, opts: [
    { l: 'سبورة تفاعلية', ok: true, fb: 'توفّر شاشة أكبر وتشرك عدداً كبيراً من الطلبة في مشاهدة الفيلم.' },
    { l: 'مشاهدة فردية', fb: 'يفقد الصف المشاهدة المشتركة التي تتيح النقاش الفوري.' },
    { l: 'صور ثابتة', fb: 'يُفقر المحتوى المرئي ولا يحلّ مشكلة حجم الشاشة.' }] },
  { hud: 'صِل الآيباد بجهاز العرض', c: 0xe8b23a, opts: [
    { l: 'منفذ متطابق', ok: true, fb: 'يجب أن يدعم الجهازان المنفذ نفسه، وإلا استُخدمت الوصلة VGA.' },
    { l: 'أي كابل', fb: 'لا يتم الربط ما لم يتطابق المنفذان في الجهاز والبروجكتور.' },
    { l: 'HDMI دائماً', fb: 'الوصلة وحدها لا تكفي؛ فالمنفذ يجب أن يكون مدعوماً في الطرفين.' }] },
  { hud: 'تابع درجات الطلبة', c: 0xe0605a, opts: [
    { l: 'TeacherPal', ok: true, fb: 'تطبيق مخصص لرصد الدرجات والملاحظات، يقوم مقام دفتر المتابعة.' },
    { l: 'KeyNote', fb: 'KeyNote تطبيق عروض شبيه بالبوربوينت، وليس أداة لرصد الدرجات.' },
    { l: 'الذاكرة', fb: 'يضيّع الملاحظات التكوينية التي تُكتب لحظتها ويُبنى عليها التوجيه.' }] },
];

const tabl = (c, w = 0.04, h = 0.03) => { const o = new THREE.Group(); const b = new THREE.Mesh(rbox(w, h, 0.005, 0.004), glossy(0xf4f4f6)); const s = new THREE.Mesh(new THREE.PlaneGeometry(w - 0.006, h - 0.006), lit(c)); s.position.z = 0.0028; o.add(b, s); return o; };
const head = (c = 0xf1c9a4) => new THREE.Mesh(new THREE.SphereGeometry(0.009, 14, 10), glossy(c));
const MODELS = [
  [
    () => { const o = new THREE.Group(); [[-0.026, 0xe0605a], [0, 0x4a8fd0], [0.026, 0x7bc86a]].forEach(([x, c], i) => { const t = tabl(c, 0.024, 0.032); t.position.set(x, 0.026 + (i === 1 ? 0.01 : 0), 0); t.rotation.x = -0.4; o.add(t); }); return o; },
    () => { const o = new THREE.Group(); [0, 1, 2].forEach((i) => { const t = tabl(0x9aa4b8, 0.024, 0.032); t.position.set(0, 0.026, -0.03 + i * 0.03); t.rotation.set(-0.4, 0, 0); o.add(t); const h = head(); h.position.set(0.026, 0.012, -0.03 + i * 0.03); o.add(h); }); return o; },
    () => { const o = new THREE.Group(); const t = tabl(0x4a8fd0, 0.05, 0.036); t.position.y = 0.03; t.rotation.x = -0.4; o.add(t); const h = head(); h.position.set(0.0, 0.065, 0.0); h.position.set(0.036, 0.016, 0.012); o.add(h); return o; },
  ],
  [
    () => { const o = new THREE.Group(); const b = new THREE.Mesh(rbox(0.1, 0.062, 0.006, 0.004), glossy(0x1b1d24)); b.position.y = 0.05; const s = new THREE.Mesh(new THREE.PlaneGeometry(0.092, 0.054), lit(0x6fd2ff)); s.position.set(0, 0.05, 0.0035); const st = new THREE.Mesh(new THREE.CylinderGeometry(0.003, 0.003, 0.03, 8), goldMat()); st.position.set(0, 0.016, 0); o.add(b, s, st); return o; },
    () => { const o = new THREE.Group(); const t = tabl(0x6fd2ff, 0.038, 0.028); t.position.y = 0.03; t.rotation.x = -0.4; o.add(t); const h = head(); h.position.set(0.036, 0.016, 0.01); o.add(h); return o; },
    () => { const o = new THREE.Group(); const f = new THREE.Mesh(rbox(0.06, 0.05, 0.005, 0.003), glossy(0x7a5a3a)); f.position.y = 0.04; const s = new THREE.Mesh(new THREE.PlaneGeometry(0.05, 0.04), lit(0xb9d8ee)); s.position.set(0, 0.04, 0.003); const m = new THREE.Mesh(new THREE.CircleGeometry(0.014, 3), lit(0x6a8f55)); m.position.set(0.004, 0.036, 0.0035); o.add(f, s, m); return o; },
  ],
  [
    () => { const o = new THREE.Group(); const a = new THREE.Mesh(rbox(0.028, 0.02, 0.02, 0.003), glossy(0x242c40)); a.position.set(-0.03, 0.02, 0); const ai = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.008, 0.012), lit(0xe8b23a)); ai.position.set(-0.012, 0.02, 0); const b = new THREE.Mesh(rbox(0.028, 0.02, 0.02, 0.003), glossy(0x242c40)); b.position.set(0.03, 0.02, 0); const bi = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.008, 0.012), lit(0xe8b23a)); bi.position.set(0.012, 0.02, 0); o.add(a, ai, b, bi); return o; },
    () => { const o = new THREE.Group(); const c = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([new THREE.Vector3(-0.04, 0.01, 0.01), new THREE.Vector3(-0.02, 0.05, -0.01), new THREE.Vector3(0.01, 0.01, 0.02), new THREE.Vector3(0.04, 0.04, 0)]), 30, 0.004, 8), glossy(0x7b7e84)); o.add(c); return o; },
    () => { const o = new THREE.Group(); const a = new THREE.Mesh(rbox(0.028, 0.02, 0.02, 0.003), glossy(0x242c40)); a.position.set(-0.034, 0.02, 0); const b = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.03, 12), glossy(0x242c40)); b.rotation.z = Math.PI / 2; b.position.set(0.03, 0.02, 0); o.add(a, b); return o; },
  ],
  [
    () => { const o = new THREE.Group(); const b = new THREE.Mesh(rbox(0.05, 0.062, 0.008, 0.004), glossy(0x2d6fd0)); b.position.y = 0.04; b.rotation.x = -0.2; [0.012, 0, -0.012].forEach((y, i) => { const l = new THREE.Mesh(new THREE.PlaneGeometry(0.03, 0.005), lit(i === 1 ? 0x7bc86a : 0xffffff)); l.position.set(0.002, 0.04 + y, 0.0046); l.rotation.x = -0.2; o.add(l); }); o.add(b); return o; },
    () => { const o = new THREE.Group(); [0, 1, 2].forEach((i) => { const s = new THREE.Mesh(rbox(0.054, 0.036, 0.004, 0.003), glossy([0xf08a3a, 0xf4efe0, 0xe0605a][i])); s.position.set(i * 0.006 - 0.006, 0.03 + i * 0.008, -i * 0.006); s.rotation.x = -0.35; o.add(s); }); return o; },
    () => { const o = new THREE.Group(); [[0, 0.04, 0.02], [-0.018, 0.034, 0.015], [0.02, 0.036, 0.016]].forEach(([x, y, r]) => { const s = new THREE.Mesh(new THREE.SphereGeometry(r, 16, 12), glossy(0xe9edf5)); s.position.set(x, y, 0); o.add(s); }); [0.012, 0.005].forEach((y, i) => { const d = new THREE.Mesh(new THREE.SphereGeometry(0.004 - i * 0.001, 8, 6), glossy(0xe9edf5)); d.position.set(0.0 - i * 0.01, y - 0.0, 0); o.add(d); }); return o; },
  ],
];

function screenDraw(g, W, H, done, play) {
  g.fillStyle = '#10131b'; g.fillRect(0, 0, W, H);
  const cols = ['#4a8fd0', '#2fa38a', '#e8b23a', '#e0605a'];
  for (let i = 0; i < 4; i++) {
    const x = 18 + (i % 2) * 118, y = 18 + Math.floor(i / 2) * 78, on = i < done;
    g.fillStyle = on ? cols[i] : '#232836'; g.beginPath(); g.roundRect(x, y, 108, 68, 12); g.fill();
    g.fillStyle = on ? 'rgba(255,255,255,.92)' : '#3a4152'; const cx = x + 54, cy = y + 34;
    if (i === 0) { [[-16, 6], [0, -8], [16, 6]].forEach(([dx, dy]) => { g.beginPath(); g.arc(cx + dx, cy + dy, 9, 0, TAU); g.fill(); }); }
    if (i === 1) { g.fillRect(cx - 28, cy - 17, 56, 30); g.fillRect(cx - 3, cy + 13, 6, 8); }
    if (i === 2) { g.fillRect(cx - 30, cy - 7, 22, 14); g.fillRect(cx + 8, cy - 7, 22, 14); g.fillRect(cx - 8, cy - 2, 16, 4); }
    if (i === 3) { g.fillRect(cx - 22, cy - 22, 44, 44); g.fillStyle = on ? cols[i] : '#232836'; for (let k = 0; k < 3; k++) g.fillRect(cx - 14, cy - 13 + k * 12, 28, 5); }
  }
  if (play) { g.fillStyle = 'rgba(16,19,27,.55)'; g.fillRect(0, 0, W, H); g.fillStyle = '#fff'; g.beginPath(); g.moveTo(W / 2 - 18, H / 2 - 28); g.lineTo(W / 2 + 28, H / 2); g.lineTo(W / 2 - 18, H / 2 + 28); g.fill(); }
}

export default function build(ctx) {
  const g = new THREE.Group(); g.position.copy(P(meta.center[0], meta.center[1])); ctx.stage.add(g); g.scale.setScalar(1.0);
  const R = rig(), H = hints(g);
  let stage = 0, solved = 0, finishedAt = -1, now = 0, lastDraw = -1;

  // ---- wooden desk hexagon, notebooks, apple
  const base = new THREE.Group(); g.add(base);
  const sh = lightPool(0x000000, 0.55, 0.2); sh.position.y = -0.002; base.add(sh);
  R.add(base, 0.1, { dur: 0.9, rise: 0.06 });
  const TY = 0.01;
  const books = new THREE.Group(); books.position.set(0, TY, -0.13); books.scale.setScalar(1.9); g.add(books);
  [[0x4a56c8, 0.2, 0.3, 0], [0x2fa38a, 0.19, 0.27, 0.2], [0xe8604c, 0.16, 0.23, -0.15]].forEach(([c, w, d, r], i) => { const b = new THREE.Mesh(rbox(0.14 * w / 0.19, 0.016, 0.19 * d / 0.27, 0.004), glossy(c)); b.position.y = 0.008 + i * 0.017; b.rotation.y = r; books.add(b); });
  const apple = new THREE.Group(); apple.position.set(0.31, TY + 0.045, -0.06); apple.scale.setScalar(1.3); g.add(apple);
  const ab = new THREE.Mesh(new THREE.SphereGeometry(0.036, 28, 20), glossy(0x8dc63f)); ab.scale.set(1, 0.9, 1); apple.add(ab);
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.0022, 0.0022, 0.016, 6), mat(0x5a3d22)); stem.position.set(0, 0.035, 0); stem.rotation.z = 0.2; apple.add(stem);
  const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.01, 10, 8), glossy(0x4f8a2a)); leaf.scale.set(1.8, 0.35, 0.8); leaf.position.set(0.012, 0.04, 0); apple.add(leaf);
  R.add(books, 0.6, { dur: 0.7, rise: 0.1 }); R.add(apple, 0.9, { dur: 0.7, rise: 0.1 });

  // ---- the iPad
  const pad = new THREE.Group(); pad.position.set(0, TY, -0.1); g.add(pad);
  const tilt = new THREE.Group(); tilt.rotation.x = -0.9; tilt.position.y = 0.2; pad.add(tilt);
  const PW = 0.6, PH = 0.42;
  const pb = new THREE.Mesh(rbox(PW, PH, 0.012, 0.012), glossy(0xf2f2f4)); tilt.add(pb);
  const sc = document.createElement('canvas'); sc.width = 250; sc.height = 180; const sg = sc.getContext('2d');
  const stex = new THREE.CanvasTexture(sc); stex.colorSpace = THREE.SRGBColorSpace;
  const scr = new THREE.Mesh(new THREE.PlaneGeometry(PW - 0.03, PH - 0.03), new THREE.MeshBasicMaterial({ map: stex, toneMapped: false })); scr.position.z = 0.0065; tilt.add(scr);
  const prop = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.006, 0.07), mat(0xd9d9de)); prop.position.set(0, -0.2, -0.1); prop.visible = false; prop.rotation.x = 0.0; pad.add(prop);
  const leds = [0, 1, 2, 3].map((i) => { const l = new THREE.Mesh(new THREE.CapsuleGeometry(0.006, 0.05, 6, 10), new THREE.MeshBasicMaterial({ color: 0x3a4152, toneMapped: false })); l.rotation.z = Math.PI / 2; l.position.set(-0.12 + i * 0.08, PH / 2 + 0.02, 0.0); tilt.add(l); return l; });
  R.add(pad, 0.4, { dur: 1.0, rise: 0.12 });
  const dock = () => { const v = new THREE.Vector3(); scr.getWorldPosition(v); ctx.stage.worldToLocal(v); return v; };

  // ---- option tokens (three per stage)
  const slotsX = [-0.29, 0, 0.29];
  const tokens = STAGES.map((st, s) => st.opts.map((op, k) => {
    const gp = new THREE.Group(); gp.position.set(slotsX[k], TY + 0.002, 0.24); g.add(gp);
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.058, 0.064, 0.01, 36), glossy(0xfdfaf2)); disc.position.y = 0.005; gp.add(disc);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.0026, 8, 40), lit(st.c)); rim.rotation.x = Math.PI / 2; rim.position.y = 0.009; gp.add(rim);
    const ico = MODELS[s][k](); const ih = new THREE.Group(); ih.position.y = 0.014; ih.scale.setScalar(1.75); ih.add(ico); gp.add(ih);
    const tag = tagSprite(op.l, 0.2, st.c, { size: 40, pad: 12 }); tag.position.set(0, 0.2, 0.03); gp.add(tag);
    gp.visible = false;
    const o = { gp, op, s, k, ih, rim, tag, state: 0, t0: 0, shake: 0, from: new THREE.Vector3(), hide: s !== 0 };
    ctx.tap(gp, () => choose(o));
    return o;
  }));
  const cur = () => tokens[stage];
  H.add(tokens[0][0].gp, 0xffd27a, 0.18, new THREE.Vector3(0, TY + 0.08, 0.24), () => (solved === 0 ? 1 : 0));

  function choose(o) {
    if (o.s !== stage || o.state !== 0 || stage >= 4) return;
    const st = STAGES[stage];
    if (o.op.ok) {
      ctx.sfx.good?.(); burstAt(ctx, o.gp, st.c, 22, 0.35, 0.026); o.state = 1; o.t0 = now; o.from.copy(o.gp.position); H.seen(tokens[0][0].gp);
      ctx.ui.card({ tag: 'اختيار موفّق', title: o.op.l, body: o.op.fb, color: st.c });
    } else {
      ctx.sfx.bad?.(); o.shake = 1; burstAt(ctx, o.gp, 0xe0453c, 10, 0.2, 0.02); H.seen(tokens[0][0].gp);
      ctx.ui.card({ tag: 'ليس الأنسب', title: o.op.l, body: o.op.fb, color: 0xe0453c });
    }
  }
  ctx.ui.hud(STAGES[0].hud);

  return {
    update(t, dt, e) {
      now = t; R.update(t, dt, e); H.update(t, e, stag(t, 3.6, 0.6));
      const start = stag(t, 1.6, 1, ease);
      const dockPos = dock();
      tokens.forEach((arr, s) => arr.forEach((o) => {
        const active = s === stage;
        let vis = 0;
        if (o.state === 0) vis = active ? start : 0;
        if (active && o.state === 0 && o.hideT) vis = 0;
        if (o.state === 1) {
          const k = clamp01((t - o.t0) / 0.9);
          o.gp.position.lerpVectors(o.from, dockPos, ease(k)); o.gp.position.y += Math.sin(k * Math.PI) * 0.12;
          vis = 1 - clamp01((k - 0.6) / 0.4);
          if (k >= 1) { o.state = 2; leds[s].material.color.setHex(STAGES[s].c); solved = s + 1; stage = s + 1; lastDraw = -1;
            if (stage < 4) { ctx.ui.hud(STAGES[stage].hud); } else { ctx.ui.hud('الدرس جاهز'); finishedAt = t; ctx.sfx.good?.(); burstAt(ctx, scr, 0xffffff, 40, 0.5, 0.035); setTimeout(() => { ctx.ui.card({ tag: 'الحصة جاهزة', title: 'كل خيار يخدم هدفاً', body: 'الجهاز وحده لا يصنع الدرس؛ ينجح حين يخدم كل خيار هدفاً واضحاً.', color: 0xe8b23a }); ctx.ui.done(); }, 900); } }
        }
        if (o.state === 2) vis = 0;
        o.shake = Math.max(0, o.shake - dt * 2.2);
        if (o.state === 0) { o.gp.position.x = slotsX[o.k] + Math.sin(t * 40) * 0.01 * o.shake; o.gp.position.y = TY + 0.002 + Math.sin(t * 1.6 + o.k) * 0.004 * vis; }
        o.gp.visible = vis > 0.01 && R.k(base) > 0.5; o.gp.scale.setScalar(Math.max(0.001, active || o.state ? 1.3 * easeBack(vis) : 0.001));
        o.ih.rotation.y += dt * 0.7; o.rim.material.color.setHex(o.shake > 0.1 ? 0xe0453c : STAGES[s].c);
      }));
      const q = solved * 10 + (finishedAt > 0 && t - finishedAt > 0.8 ? 1 : 0);
      if (q !== lastDraw) { lastDraw = q; screenDraw(sg, 250, 180, solved, q % 10 === 1); stex.needsUpdate = true; }
      pad.position.y = TY + Math.sin(t * 1.2) * 0.003;
      apple.rotation.y = Math.sin(t * 0.5) * 0.3;
    },
  };
}
