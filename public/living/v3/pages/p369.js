// p369 — a standing phone whose screen is a bookshelf (a library in the pocket); small smart devices wait around it. Touch books, the phone, the devices.
import * as THREE from 'three';
import { P, ease, easeBack, clamp01, stag, mat, glossy, goldMat, shadowed } from '../../kit.js?v=36';
import { TAU, canvasTex, rbox, lit, rig, hints, burstAt, lightPool, hexSlab } from '../lib/a7.js?v=36';

export const meta = { free: true, center: [0.4, 0.52], typeLabel: 'مجسّم تفاعلي' };

const BOOK_C = [0x2fa3a0, 0xe0605a, 0xf08a3a, 0xf4efe0, 0x4a8fd0, 0xe8b23a, 0x7bc86a, 0xb05ad8];
const EX = 'من أمثلة الأجهزة الذكية: الهواتف الذكية، والأجهزة اللوحية، والساعات الذكية، والحواسيب المحمولة، والتلفزيونات الذكية.';

export default function build(ctx) {
  const g = new THREE.Group(); g.position.copy(P(meta.center[0], meta.center[1])); ctx.stage.add(g); g.scale.setScalar(1.0);
  const R = rig(), H = hints(g);
  const seen = new Set(); let done = false, nowT = 0, floatT = -9;
  const finish = (id) => { seen.add(id); if (seen.has('book') && seen.has('phone') && seen.size >= 4 && !done) { done = true; setTimeout(() => { ctx.sfx.good?.(); ctx.ui.done(); }, 1000); } };

  const base = new THREE.Group(); g.add(base);
  const sh = lightPool(0x000000, 0.5, 0.22); sh.scale.set(1.4, 1, 1); sh.position.y = -0.002; base.add(sh);
  R.add(base, 0.1, { dur: 0.9, rise: 0.06 });
  const TY = 0.012;

  // ---- the phone: bezel + shelf unit inside
  const phone = new THREE.Group(); phone.position.set(0, TY, -0.02); g.add(phone);
  const tilt = new THREE.Group(); tilt.rotation.x = -0.12; phone.add(tilt);
  const PW = 0.27, PH = 0.46, BZ = 0.02, BD = 0.034;
  const bodyM = glossy(0x14161c, { roughness: 0.2 });
  const cy = PH / 2 + 0.03;
  const bk0 = new THREE.Mesh(rbox(PW, PH, 0.012, 0.02), bodyM); bk0.position.set(0, cy, -0.016); tilt.add(bk0);
  const body = new THREE.Group(); tilt.add(body);
  [[-1, 0].map(() => 0), 0].length;
  const sideL = new THREE.Mesh(rbox(BZ, PH, BD, 0.008), bodyM); sideL.position.set(-PW / 2 + BZ / 2, cy, 0); body.add(sideL);
  const sideR = sideL.clone(); sideR.position.x = PW / 2 - BZ / 2; body.add(sideR);
  const topB = new THREE.Mesh(rbox(PW, 0.034, BD, 0.012), bodyM); topB.position.set(0, cy + PH / 2 - 0.017, 0); body.add(topB);
  const botB = topB.clone(); botB.position.y = cy - PH / 2 + 0.017; body.add(botB);
  const IW = PW - 2 * BZ, IH = PH - 0.068;
  const back = new THREE.Mesh(new THREE.PlaneGeometry(IW, IH), mat(0xc79a62, { roughness: 0.85 })); back.position.set(0, cy, -0.0095); tilt.add(back);
  const stand = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.056, 0.03, 32), goldMat()); stand.position.y = 0.015; phone.add(stand);
  const SHELF_Y = [0.035, 0.16, 0.285], books = [];
  let seed = 7; const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  SHELF_Y.forEach((sy, s) => {
    const board = new THREE.Mesh(rbox(IW, 0.008, 0.024, 0.002), glossy(0xe8dcc4)); board.position.set(0, 0.03 + 0.034 + sy - 0.004, 0); tilt.add(board);
    let x = -IW / 2 + 0.006;
    for (let i = 0; i < 9; i++) {
      const w = 0.017 + rnd() * 0.012, h = 0.07 + rnd() * 0.04, c = BOOK_C[Math.floor(rnd() * BOOK_C.length)];
      if (x + w > IW / 2 - 0.004) break;
      const bk = new THREE.Mesh(rbox(w, h, 0.018, 0.0025), glossy(c, { roughness: 0.4 }));
      bk.position.set(x + w / 2, 0.03 + 0.034 + sy + h / 2, 0.0); x += w + 0.0025;
      bk.userData.home = bk.position.clone(); bk.userData.pull = 0; bk.userData.s = s; tilt.add(bk);
      R.add(bk, 1.1 + s * 0.35 + i * 0.07, { dur: 0.6, rise: -0.07 });
      ctx.tap(bk, () => pull(bk)); books.push(bk);
    }
  });
  const glass = new THREE.Mesh(new THREE.PlaneGeometry(IW, IH), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.06, depthWrite: false })); glass.position.set(0, cy, 0.0165); tilt.add(glass);
  phone.scale.setScalar(1.12);
  R.add(phone, 0.5, { dur: 1.0, rise: 0.1 });
  H.add(books[4], 0xffd27a, 0.12);
  const feather = new THREE.Group(); const fv = new THREE.Mesh(new THREE.PlaneGeometry(0.02, 0.1, 1, 6), new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide, transparent: true, opacity: 0 })); feather.add(fv); g.add(feather);
  function pull(bk) {
    ctx.sfx.pop?.(); bk.userData.pull = 1; burstAt(ctx, bk, bk.material.color.getHex(), 12, 0.25, 0.02); H.seen(books[4]);
    ctx.ui.card({ tag: 'مرونة التطبيقات', title: 'مكتبة في الجيب', body: 'تتصف الأجهزة الذكية بمرونة عالية في عرض المحتوى وإنشائه وتعديله.', color: bk.material.color.getHex() }); finish('book');
  }
  const phoneTap = () => {
    floatT = nowT; ctx.sfx.pop?.(); R.bounce(phone); burstAt(ctx, phone, 0xfff3c4, 24, 0.35, 0.025);
    ctx.ui.card({ tag: 'صغر الحجم وخفة الوزن', title: 'يُحمل بسهولة', body: 'هاتان الخاصيتان جعلتا حملها والتعامل معها سهلاً، وهما سبب إقبال القائمين على التعليم عليها.', color: 0xf0a030 }); finish('phone');
  };
  ctx.tap(body, phoneTap); ctx.tap(stand, phoneTap); ctx.tap(bk0, phoneTap);

  // ---- devices around the base
  const devs = [
    { k: 'watch', x: -0.27, z: 0.14, t: 'ساعة ذكية', mk() { const o = new THREE.Group(); const b1 = new THREE.Mesh(rbox(0.02, 0.1, 0.008, 0.004), glossy(0xe0605a)); const f = new THREE.Mesh(rbox(0.05, 0.055, 0.016, 0.012), glossy(0x1b1d24)); const s = new THREE.Mesh(new THREE.PlaneGeometry(0.038, 0.042), lit(0x6fd2ff)); s.position.z = 0.0085; o.add(b1, f, s); return o; } },
    { k: 'tab', x: 0.27, z: 0.14, t: 'جهاز لوحي', mk() { const o = new THREE.Group(); const b = new THREE.Mesh(rbox(0.1, 0.075, 0.008, 0.007), glossy(0xf2f2f4)); const s = new THREE.Mesh(new THREE.PlaneGeometry(0.09, 0.065), lit(0xf08a3a)); s.position.z = 0.0045; o.add(b, s); return o; } },
    { k: 'lap', x: -0.27, z: -0.14, t: 'حاسوب محمول', mk() { const o = new THREE.Group(); const d = new THREE.Mesh(rbox(0.1, 0.006, 0.07, 0.003), glossy(0xcdd2da)); const l = new THREE.Mesh(rbox(0.1, 0.07, 0.005, 0.003), glossy(0xcdd2da)); l.position.set(0, 0.036, -0.034); l.rotation.x = -0.25; const s = new THREE.Mesh(new THREE.PlaneGeometry(0.092, 0.06), lit(0x4a8fd0)); s.position.set(0, 0.036, -0.0315); s.rotation.x = -0.25; o.add(d, l, s); return o; } },
    { k: 'tv', x: 0.27, z: -0.14, t: 'تلفزيون ذكي', mk() { const o = new THREE.Group(); const b = new THREE.Mesh(rbox(0.12, 0.07, 0.008, 0.004), glossy(0x1b1d24)); b.position.y = 0.045; const s = new THREE.Mesh(new THREE.PlaneGeometry(0.112, 0.062), lit(0x7bc86a)); s.position.set(0, 0.045, 0.0045); const st = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.016, 0.006, 16), goldMat()); st.position.y = 0.003; o.add(b, s, st); return o; } },
  ].map((dv, i) => {
    const gp = new THREE.Group(); gp.position.set(dv.x, TY, dv.z); gp.scale.setScalar(1.15); g.add(gp);
    const pad = new THREE.Mesh(new THREE.CylinderGeometry(0.052, 0.056, 0.008, 36), glossy(0xfdfaf2)); pad.position.y = 0.004; gp.add(pad);
    const ico = dv.mk(); const ih = new THREE.Group(); ih.position.y = 0.075; ih.scale.setScalar(1.35); ih.add(ico); gp.add(ih);
    R.add(gp, 1.8 + i * 0.25, { dur: 0.8, rise: 0.1 }); H.add(pad, 0xffd27a, 0.15, new THREE.Vector3(dv.x, TY + 0.06, dv.z));
    ctx.tap(gp, () => { ctx.sfx.pop?.(); R.bounce(gp); H.seen(pad); burstAt(ctx, ih, 0xffd27a, 14, 0.28, 0.022); ctx.ui.card({ tag: 'أمثلة', title: dv.t, body: EX, color: 0xf0a030 }); finish(dv.k); });
    return { gp, ih };
  });

  ctx.ui.hud('المس الكتب والهاتف والأجهزة');
  return {
    update(t, dt, e) {
      nowT = t; R.update(t, dt, e); H.update(t, e, stag(t, 3.4, 0.6));
      books.forEach((b) => {
        const u = b.userData; u.pull = Math.max(0, u.pull - dt * 0.6);
        const out = u.pull > 0 ? Math.min(1, (1 - u.pull) * 6, u.pull * 3) : 0;
        if (R.k(b) > 0.99) { b.position.z = u.home.z + 0.1 * out; b.position.y = u.home.y + 0.02 * out; b.rotation.y = out * 0.6; }
      });
      const ft = t - floatT, fk = floatT > -1 ? clamp01(ft / 1.6) : 0;
      phone.position.y = TY + (floatT > -1 ? Math.sin(fk * Math.PI) * 0.08 : 0) + Math.sin(t * 1.2) * 0.002;
      phone.rotation.y = (floatT > -1 ? fk * TAU : 0) + Math.sin(t * 0.5) * 0.08;
      fv.material.opacity = floatT > -1 && fk < 1 ? Math.sin(fk * Math.PI) : 0;
      feather.position.set(0.12 + Math.sin(t * 3) * 0.03, 0.4 - fk * 0.3, 0.12); feather.rotation.set(Math.sin(t * 2) * 0.6, 0, Math.sin(t * 3) * 0.5);
      devs.forEach((d, i) => { d.ih.rotation.y = Math.sin(t * 0.8 + i * 1.7) * 0.55; d.ih.position.y = 0.075 + Math.sin(t * 1.5 + i) * 0.006; });
    },
  };
}
