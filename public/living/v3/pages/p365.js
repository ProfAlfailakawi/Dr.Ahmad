// p365 — fat glossy letters spell "blog" on a laptop; word tiles sit on the keys. Touch the letters (they leap) and each word.
import * as THREE from 'three';
import { P, ease, easeBack, clamp01, stag, mat, glossy, goldMat, shadowed } from '../../kit.js?v=32';
import { TAU, canvasTex, rbox, lit, rig, hints, burstAt, lightPool } from '../lib/a7.js?v=32';

export const meta = { free: true, center: [0.5, 0.5], typeLabel: 'مجسّم تفاعلي' };

const WORDS = [
  { w: 'follow', bg: '#7b7e84', fg: '#fff', c: 0x7b7e84, x: 0.285, t: 'يتابعه القرّاء', b: 'يدخل أصحاب البلوق عليه بشكل منتظم، ويتابعه القرّاء ليبقوا على اتصال بجديده.' },
  { w: 'comment', bg: '#fbfaf5', fg: '#23262c', c: 0x2fa38a, x: 0.095, t: 'التعليق', b: 'يزوّد المدوّنون مدوناتهم بتعليقات، ويتيح البلوق للمتعلمين إضافة تعليقاتهم على المواضيع المنشورة.' },
  { w: 'networking', bg: '#fbfaf5', fg: '#23262c', c: 0x4a8fd0, x: -0.095, t: 'التواصل', b: 'تتواصل المؤسسات والمدارس والشركات مع القرّاء عبر مدوناتها بالأحداث والأخبار.' },
  { w: 'like', bg: '#7b7e84', fg: '#fff', c: 0xe0453c, x: -0.285, t: 'الإعجاب', b: 'مؤشر بسيط على تفاعل القارئ، ويكمل التعليق في بناء حوار حول المحتوى.' },
];

function tileTex(w, bg, fg) {
  return canvasTex(384, 128, (g, W, H) => {
    g.fillStyle = bg; g.fillRect(0, 0, W, H);
    g.fillStyle = fg; g.font = '700 74px Helvetica, Arial, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    let fs = 74; while (g.measureText(w).width > W - 30 && fs > 30) { fs -= 4; g.font = `700 ${fs}px Helvetica, Arial, sans-serif`; }
    g.fillText(w, W / 2, H / 2 + 4);
  });
}

export default function build(ctx) {
  const g = new THREE.Group(); g.position.copy(P(meta.center[0], meta.center[1])); ctx.stage.add(g); g.scale.setScalar(1.0);
  const R = rig(), H = hints(g);
  const seen = new Set(); let done = false, leap = -9, nowT = 0;
  const finish = (id) => { seen.add(id); if (seen.size >= 5 && !done) { done = true; setTimeout(() => { ctx.sfx.good?.(); ctx.ui.done(); }, 1000); } };

  // ---- laptop deck, screen panel, keys
  const base = new THREE.Group(); g.add(base);
  const deck = new THREE.Mesh(rbox(0.86, 0.03, 0.66, 0.014), glossy(0xd4d8df, { roughness: 0.32 })); deck.position.y = 0.015; base.add(deck);
  const sh = lightPool(0x000000, 0.55, 0.22); sh.position.y = -0.002; sh.scale.set(1.1, 0.9, 1); base.add(sh);
  const panel = new THREE.Mesh(rbox(0.74, 0.012, 0.32, 0.01), glossy(0xfdfcf8)); panel.position.set(0, 0.036, -0.13); base.add(panel);
  const bar = new THREE.Mesh(rbox(0.74, 0.004, 0.034, 0.002), mat(0x6dcdb4)); bar.position.set(0, 0.044, -0.255); base.add(bar);
  const bar2 = bar.clone(); bar2.position.z = 0.0; bar2.scale.x = 0.0; // spare
  const keys = new THREE.InstancedMesh(rbox(0.048, 0.01, 0.036, 0.006), glossy(0x1f2530), 15 * 3); const d = new THREE.Object3D(); let ki = 0;
  for (let r = 0; r < 3; r++) for (let c = 0; c < 15; c++) { d.position.set(-0.382 + c * 0.0545, 0.034, 0.105 + r * 0.045); d.updateMatrix(); keys.setMatrixAt(ki++, d.matrix); }
  base.add(keys);
  R.add(base, 0.1, { dur: 0.9, rise: 0.06 });

  // ---- fat letters: b l o g
  const BL = 0x16181d, TUBE = 0.021, BR = 0.05, Y0 = 0.045 + TUBE + BR;
  const lm = glossy(BL, { roughness: 0.18 });
  const caps = (parent, y0, y1, x = 0) => { const s = new THREE.Mesh(new THREE.CapsuleGeometry(TUBE, y1 - y0, 10, 20), lm); s.position.set(x, (y0 + y1) / 2, 0); parent.add(s); return s; };
  const ring = (parent, x, y) => { const t = new THREE.Mesh(new THREE.TorusGeometry(BR, TUBE, 20, 48), lm); t.position.set(x, y, 0); parent.add(t); return t; };
  const letters = [];
  const mk = (x) => { const gr = new THREE.Group(); gr.position.set(x, 0, -0.13); g.add(gr); return gr; };
  { const L = mk(-0.255); caps(L, 0.045, 0.05 + 0.26, -0.05); ring(L, 0.0, Y0); letters.push(L); }       // b
  { const L = mk(-0.095); caps(L, 0.045, 0.05 + 0.26, 0); letters.push(L); }                                // l
  { const L = mk(0.045); ring(L, 0.0, Y0); letters.push(L); }                                               // o
  { const L = mk(0.2); ring(L, 0.0, Y0 + 0.07); caps(L, 0.1, Y0 + 0.07, 0.05); const hook = new THREE.Mesh(new THREE.TorusGeometry(0.04, TUBE, 16, 32, Math.PI), lm); hook.rotation.z = Math.PI; hook.position.set(0.01, 0.1, 0); L.add(hook); letters.push(L); } // g
  const wordG = new THREE.Group(); g.add(wordG);
  letters.forEach((L, i) => { R.add(L, 0.9 + i * 0.28, { dur: 0.8, rise: 0.18 }); shadowed(L); });
  const caret = new THREE.Mesh(rbox(0.012, 0.2, 0.012, 0.004), lit(0x2fc9a4)); caret.position.set(0.305, 0.13, -0.13); g.add(caret);
  const letterHit = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.34, 0.1), new THREE.MeshBasicMaterial({ visible: false })); letterHit.position.set(0.0, 0.2, -0.13); g.add(letterHit);
  H.add(letterHit, 0xffffff, 0.2, new THREE.Vector3(-0.255, 0.2, -0.1));
  ctx.tap(letterHit, () => {
    leap = nowT; ctx.sfx.pop?.(); H.seen(letterHit);
    letters.forEach((L, i) => burstAt(ctx, L, 0x2fc9a4, 8, 0.25, 0.022));
    ctx.ui.card({ tag: 'Web Log', title: 'blog', body: 'اختصار Web Log، أي سجلّ في الشبكة؛ موقع إلكتروني يضم تأملات شخصية وتعليقات وروابط يقدمها الكاتب.', color: 0x2fc9a4 }); finish('blog');
  });

  // ---- word tiles on the keys
  const tiles = WORDS.map((wd, i) => {
    const gp = new THREE.Group(); gp.position.set(wd.x, 0.045, 0.145 + (i % 2) * 0.02); gp.rotation.y = (i - 1.5) * -0.07; g.add(gp);
    const body = new THREE.Mesh(rbox(0.18, 0.034, 0.062, 0.006), glossy(0xfdfcf8)); body.position.y = 0.022; gp.add(body);
    const face = new THREE.Mesh(new THREE.PlaneGeometry(0.168, 0.052), new THREE.MeshBasicMaterial({ map: tileTex(wd.w, wd.bg, wd.fg), toneMapped: false })); face.rotation.x = -Math.PI / 2; face.position.y = 0.0406; gp.add(face);
    const ringM = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.002, 6, 40), lit(wd.c)); ringM.rotation.x = Math.PI / 2; ringM.position.y = 0.002; ringM.scale.set(1.6, 1, 0.75); gp.add(ringM);
    R.add(gp, 2.1 + i * 0.22, { dur: 0.7, rise: 0.15 });
    H.add(body, wd.c, 0.15);
    const o = { wd, gp, lift: 0 };
    ctx.tap(gp, () => { ctx.sfx.pop?.(); R.bounce(gp); burstAt(ctx, body, wd.c, 16, 0.28, 0.024); H.seen(body); o.lift = 1; ctx.ui.card({ tag: wd.w, title: wd.t, body: wd.b, color: wd.c }); finish(wd.w); });
    return o;
  });

  ctx.ui.hud('المس الحروف والكلمات');
  return {
    update(t, dt, e) {
      nowT = t; R.update(t, dt, e); H.update(t, e, stag(t, 3.6, 0.6));
      letters.forEach((L, i) => {
        const k = clamp01((t - leap - i * 0.12) / 0.7);
        const jump = leap > -1 ? Math.sin(k * Math.PI) * 0.06 : 0;
        L.position.y = jump + Math.sin(t * 1.3 + i) * 0.003;
        L.rotation.y = Math.sin(t * 0.7 + i * 0.8) * 0.12 + (leap > -1 ? Math.sin(k * Math.PI) * 0.4 : 0);
      });
      caret.visible = Math.sin(t * 5) > -0.2 && R.k(letters[3]) > 0.9;
      tiles.forEach((o, i) => { o.lift = Math.max(0, o.lift - dt * 1.2); o.gp.position.y = 0.045 + Math.sin(o.lift * Math.PI) * 0.05 + Math.sin(t * 1.4 + i) * 0.002; });
    },
  };
}
