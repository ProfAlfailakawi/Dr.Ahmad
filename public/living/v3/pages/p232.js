// p232 — the learner's desk: a blue desk-top diorama; every object (laptop, report, notebook, colour fan, phone, coffee) wakes up and reveals one purpose of the computer in teaching.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { P, ease, easeBack, clamp01, stag, mat, glossy, goldMat, shadowed } from '../../kit.js?v=40';
import { tagSprite, setSpr, softLight } from '../../v2/common.js?v=40';
import { hints, finder } from '../lib/a3-kit.js?v=40';

export const meta = { free: true, center: [0.37, 0.4], typeLabel: 'مكتب تفاعلي' };

const INFO = {
  laptop: ['التفاعل المباشر', 'يتيح الحاسب للمتعلم أن يتفاعل مع المادة مباشرة، ويقدّم له التغذية الراجعة في الحال.', 'التفاعل المباشر', 0x45b6e8],
  report: ['تحسين نتائج التعلم', 'تُعرض الأرقام والمخططات بصرياً، فتتحسّن نتائج الطلاب وفاعلية عملية التعلم.', 'نتائج أفضل', 0x3aa86a],
  book: ['تخزين المعلومات واسترجاعها', 'يحفظ كمّاً كبيراً من المعلومات في مكان يسهل الوصول إليه واسترجاعه.', 'التخزين والاسترجاع', 0xf0a030],
  swatch: ['العرض المرئي', 'يقدّم المعلومات بالألوان والصور والرسوم، فيصبح التعلم أكثر تشويقاً.', 'العرض المرئي', 0xd63a8c],
  phone: ['تفريد التعليم', 'يتقدّم كل متعلم بحسب مستواه وسرعته، فتُراعى الفروق الفردية بين الطلبة.', 'تفريد التعليم', 0x8a5bd0],
  coffee: ['مناخ البحث والاستكشاف', 'يهيّئ بيئة تحفّز المتعلم على البحث والاستكشاف بنفسه.', 'البحث والاستكشاف', 0xc87a3a],
};

const asg = (m, o) => { if (o.position) m.position.copy(o.position); if (o.rotation) m.rotation.copy(o.rotation); return m; };
function screenTex() {
  const c = document.createElement('canvas'); c.width = 256; c.height = 160; const g = c.getContext('2d');
  const gr = g.createLinearGradient(0, 0, 0, 160); gr.addColorStop(0, '#dff3ff'); gr.addColorStop(1, '#a9d6f5'); g.fillStyle = gr; g.fillRect(0, 0, 256, 160);
  g.fillStyle = '#2a8fd0'; g.fillRect(14, 14, 90, 10); g.fillStyle = '#fff'; g.fillRect(14, 32, 100, 60);
  g.fillStyle = '#ef8a2a'; [[26, 80, 14, -30], [48, 80, 14, -46], [70, 80, 14, -22], [92, 80, 14, -52]].forEach(([x, y, w, h]) => g.fillRect(x, y + h, w, -h));
  g.fillStyle = '#2b2620'; for (let i = 0; i < 7; i++) g.fillRect(130, 20 + i * 16, 70 + (i % 3) * 20, 7);
  g.fillStyle = '#3aa86a'; g.beginPath(); g.arc(70, 130, 14, 0, 7); g.fill(); g.fillStyle = '#e0603a'; g.fillRect(110, 118, 120, 22);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

export default function build(ctx) {
  const g = new THREE.Group(); g.position.copy(P(0.37, 0.4)); g.scale.setScalar(1.12); ctx.stage.add(g);
  const H = hints(), found = finder(ctx, 6);
  // the desk
  const desk = new THREE.Mesh(new RoundedBoxGeometry(0.56, 0.03, 0.5, 4, 0.06), glossy(0x4f84c9, { roughness: 0.45 })); desk.position.y = 0.0; desk.receiveShadow = true; g.add(desk);
  const rim = new THREE.Mesh(new RoundedBoxGeometry(0.575, 0.008, 0.515, 3, 0.065), goldMat()); rim.position.y = 0.003; rim.scale.set(1, 1, 1); g.add(rim);
  const foot = new THREE.Mesh(new RoundedBoxGeometry(0.48, 0.03, 0.42, 3, 0.05), mat(0x2b2620)); foot.position.y = -0.028; g.add(foot);
  const Y = 0.019;
  const tags = {}, objs = {};
  const hit = (r, at) => { const m = new THREE.Mesh(new THREE.SphereGeometry(r, 8, 6), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false })); m.position.set(...at); return m; };
  const reg = (id, grp, x, z, hr, hy = 0.04) => {
    grp.position.set(x, Y, z); g.add(grp); grp.add(hit(hr, [0, hy, 0]));
    const o = { id, grp, t0: -99, x, z, born: 0.12 + Object.keys(objs).length * 0.13, hint: H.add(grp, INFO[id][3], hr * 2.4, [0, hy, 0], 2.4 + Object.keys(objs).length * 0.2) };
    objs[id] = o; ctx.tap(grp, () => touch(id));
    const tg = tagSprite(INFO[id][2], 0.17, INFO[id][3]); tg.position.set(0, hy + 0.1, 0); tg.visible = false; grp.add(tg); tags[id] = tg;
    shadowed(grp); return o;
  };

  // laptop
  const lap = new THREE.Group();
  lap.add(asg(new THREE.Mesh(new RoundedBoxGeometry(0.22, 0.012, 0.15, 3, 0.005), mat(0xc9cfd4, { metalness: 0.7, roughness: 0.3 })), { position: new THREE.Vector3(0, 0.006, 0) }));
  const keys = new THREE.InstancedMesh(new THREE.BoxGeometry(0.014, 0.004, 0.012), mat(0x2b2f33), 36); const mtx = new THREE.Matrix4();
  for (let i = 0; i < 36; i++) { mtx.makeTranslation(-0.085 + (i % 12) * 0.0155, 0.014, -0.002 + Math.floor(i / 12) * 0.017); keys.setMatrixAt(i, mtx); } lap.add(keys);
  const lid = new THREE.Group(); lid.position.set(0, 0.012, -0.075); lap.add(lid);
  lid.add(asg(new THREE.Mesh(new RoundedBoxGeometry(0.22, 0.15, 0.008, 3, 0.005), mat(0xc9cfd4, { metalness: 0.7, roughness: 0.3 })), { position: new THREE.Vector3(0, 0.075, 0) }));
  const scr = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.128), new THREE.MeshBasicMaterial({ map: screenTex(), toneMapped: false })); scr.position.set(0, 0.075, 0.0045); lid.add(scr);
  lid.rotation.x = -0.28; const scrGlow = softLight(0x9fe0ff, 0.28, 0); scrGlow.position.set(0, 0.08, 0.06); lap.add(scrGlow);
  reg('laptop', lap, 0.0, -0.1, 0.12, 0.07);

  // report with bars
  const rep = new THREE.Group();
  rep.add(asg(new THREE.Mesh(new RoundedBoxGeometry(0.15, 0.005, 0.19, 2, 0.002), mat(0xfbf8f0)), { position: new THREE.Vector3(0, 0.0025, 0) }));
  const bars = [0.03, 0.055, 0.04, 0.075].map((h, i) => { const b = new THREE.Mesh(new RoundedBoxGeometry(0.02, 1, 0.02, 2, 0.003), glossy([0x3aa86a, 0x2a8fd0, 0xef8a2a, 0xd63a8c][i])); b.userData.h = h; b.position.set(-0.04 + i * 0.03, 0.005, -0.03); rep.add(b); return b; });
  for (let i = 0; i < 4; i++) rep.add(asg(new THREE.Mesh(new THREE.BoxGeometry(0.1 - (i % 2) * 0.03, 0.0015, 0.005), mat(0x9aa3a8)), { position: new THREE.Vector3(0.0, 0.0058, 0.04 + i * 0.012) }));
  rep.rotation.y = -0.1;
  reg('report', rep, 0.02, 0.14, 0.1, 0.05);

  // notebook (open) with a flipping page
  const book = new THREE.Group();
  const pg = (s) => { const p = new THREE.Mesh(new RoundedBoxGeometry(0.085, 0.005, 0.12, 2, 0.002), mat(0xfaf6e8)); p.position.set(s * 0.043, 0.008, 0); p.rotation.z = -s * 0.07; return p; };
  const cover = new THREE.Mesh(new RoundedBoxGeometry(0.19, 0.008, 0.13, 2, 0.003), mat(0xf0a030)); cover.position.y = 0.004; book.add(cover, pg(-1), pg(1));
  for (let i = 0; i < 5; i++) [-1, 1].forEach((s) => { const l = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.001, 0.003), mat(0x2b2620)); l.position.set(s * 0.044, 0.0115, -0.04 + i * 0.02); book.add(l); });
  const flip = new THREE.Group(); flip.position.set(0, 0.011, 0); book.add(flip);
  flip.add(asg(new THREE.Mesh(new RoundedBoxGeometry(0.085, 0.002, 0.12, 2, 0.001), mat(0xfffdf2)), { position: new THREE.Vector3(0.0425, 0, 0) }));
  flip.rotation.z = 0;
  const usb = new THREE.Mesh(new RoundedBoxGeometry(0.034, 0.01, 0.014, 2, 0.003), glossy(0xf0a030)); usb.position.set(0.0, 0.01, 0.1); book.add(usb);
  const usbHead = new THREE.Mesh(new THREE.BoxGeometry(0.014, 0.006, 0.01), mat(0xcfd6db, { metalness: 0.8 })); usbHead.position.set(0.024, 0.01, 0.1); book.add(usbHead);
  book.rotation.y = 0.25;
  reg('book', book, -0.17, 0.0, 0.1, 0.03);

  // colour fan
  const fan = new THREE.Group(); const cols = [0xe0453c, 0xf0a030, 0xf2d24a, 0x6ab04a, 0x2a8fd0, 0x7a4fb0, 0xd63a8c];
  const blades = cols.map((c, i) => { const b = new THREE.Mesh(new RoundedBoxGeometry(0.024, 0.003, 0.11, 2, 0.001), mat(c)); b.geometry.translate(0, 0, -0.055); b.position.y = 0.004 + i * 0.0016; fan.add(b); return b; });
  fan.add(asg(new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.02, 10), goldMat()), { position: new THREE.Vector3(0, 0.01, 0) }));
  reg('swatch', fan, -0.19, 0.17, 0.08, 0.03);

  // phone
  const ph = new THREE.Group();
  ph.add(asg(new THREE.Mesh(new RoundedBoxGeometry(0.06, 0.11, 0.008, 3, 0.006), mat(0x1d2126)), { position: new THREE.Vector3(0, 0.055, 0), rotation: new THREE.Euler(-0.25, 0, 0) }));
  const phs = new THREE.Group(); phs.rotation.x = -0.25; phs.position.set(0, 0.055, 0.0045); ph.add(phs);
  phs.add(new THREE.Mesh(new THREE.PlaneGeometry(0.052, 0.098), new THREE.MeshBasicMaterial({ color: 0xece4ff, toneMapped: false })));
  const pbars = [0.5, 0.8, 0.3].map((v, i) => { const b = new THREE.Mesh(new THREE.PlaneGeometry(1, 0.01), new THREE.MeshBasicMaterial({ color: [0x8a5bd0, 0x3aa86a, 0xef8a2a][i], toneMapped: false })); b.position.set(0, 0.025 - i * 0.025, 0.001); phs.add(b); b.userData.v = v; return b; });
  reg('phone', ph, 0.2, -0.08, 0.07, 0.06);

  // coffee + magnifier + steam
  const cof = new THREE.Group();
  cof.add(asg(new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.004, 32), mat(0xfaf6e8)), { position: new THREE.Vector3(0, 0.002, 0) }));
  cof.add(asg(new THREE.Mesh(new THREE.CylinderGeometry(0.034, 0.026, 0.04, 28), mat(0xf3efe3)), { position: new THREE.Vector3(0, 0.024, 0) }));
  cof.add(asg(new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.002, 28), mat(0x5a3820)), { position: new THREE.Vector3(0, 0.040, 0) }));
  const hnd = new THREE.Mesh(new THREE.TorusGeometry(0.014, 0.004, 8, 16), mat(0xf3efe3)); hnd.position.set(0.04, 0.026, 0); cof.add(hnd);
  const steam = Array.from({ length: 5 }, (_, i) => { const s = softLight(0xffffff, 0.04, 0.5); cof.add(s); return { s, o: i / 5 }; });
  const mag = new THREE.Group(); const ml = new THREE.Mesh(new THREE.TorusGeometry(0.028, 0.004, 10, 32), goldMat()); const mh = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.05, 8), mat(0x2b2620)); mh.rotation.z = Math.PI / 4; mh.position.set(0.032, -0.032, 0);
  const mg = new THREE.Mesh(new THREE.CircleGeometry(0.026, 24), new THREE.MeshBasicMaterial({ color: 0xcfeaff, transparent: true, opacity: 0.35, depthWrite: false, side: THREE.DoubleSide })); mag.add(ml, mh, mg); mag.visible = false; cof.add(mag);
  reg('coffee', cof, 0.17, 0.13, 0.07, 0.04);

  // a pencil for charm
  const pen = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.13, 8), mat(0xf2d24a)); pen.rotation.z = Math.PI / 2; pen.rotation.y = 0.4; pen.position.set(-0.07, Y + 0.006, 0.2); g.add(pen);
  const tip = new THREE.Mesh(new THREE.ConeGeometry(0.004, 0.012, 8), mat(0xe0b890)); tip.position.set(-0.07 - 0.07 * Math.cos(0.4), Y + 0.006, 0.2 + 0.07 * Math.sin(0.4)); tip.rotation.z = Math.PI / 2; tip.rotation.y = 0.4; g.add(tip);

  let shown = null, now = 0;
  function touch(id) {
    const o = objs[id]; o.t0 = now; o.hint.calm = true; ctx.sfx.pop?.(); const [a, b] = INFO[id];
    ctx.ui.card({ tag: 'غرض من الأغراض', title: a, body: b, color: INFO[id][3] });
    ctx.fx.burst(new THREE.Vector3(o.x, 0.1, o.z).add(g.position), INFO[id][3], 20, 0.35, 0.03);
    shown = id; found(id);
    ctx.ui.hud('المس بقية الأشياء على المكتب');
  }
  ctx.ui.hud('المس الأشياء على المكتب لتكتشف أغراض الحاسب');
  return {
    update(t, dt, e) {
      now = t;
      const dk = Math.max(stag(t, 0.05, 0.7, easeBack) * e, 0.001); desk.scale.set(dk, 1, dk); rim.scale.set(dk, 1, dk); foot.scale.set(dk, 1, dk);
      const act = (id) => clamp01(1 - (t - objs[id].t0) / 3.2) * (t - objs[id].t0 > 0 ? 1 : 0);
      Object.values(objs).forEach((o) => { const k = Math.max(stag(t, o.born, 0.8, easeBack) * e, 0.001); o.grp.scale.setScalar(k); });
      // laptop
      const a1 = act('laptop'); lid.rotation.x = -0.28 - Math.sin(t * 0.8) * 0.01 - a1 * 0.12 * Math.sin(a1 * 3.14); scr.material.color.setScalar(0.82 + a1 * 0.25 + 0.04 * Math.sin(t * 2)); scrGlow.material.opacity = (0.18 + a1 * 0.6) * clamp01((t - 1) * 0.8) * e;
      // report bars
      const a2 = act('report');
      bars.forEach((b, i) => { const h = b.userData.h * (0.6 + 0.4 * Math.sin(t * 1.2 + i)) * (1 + a2 * 1.1); const k = clamp01((t - 0.7 - i * 0.15) * 1.4); b.scale.y = Math.max(h * k, 0.001); b.position.y = 0.005 + b.scale.y / 2; });
      // book flip
      const a3 = act('book'); const fk = clamp01((t - objs.book.t0) / 1.2); flip.rotation.z = objs.book.t0 > 0 && fk < 1 ? -Math.PI * 0.99 * ease(fk) : (objs.book.t0 > 0 ? -Math.PI * 0.99 * (1 - 0) * 0 : 0);
      if (objs.book.t0 > 0 && fk >= 1) flip.rotation.z = 0, flip.position.y = 0.011;
      usb.position.x = 0.0 + a3 * 0.01;
      // fan
      const a4 = act('swatch'); blades.forEach((b, i) => { b.rotation.y = (0.14 + a4 * 0.12) * (i - 3) + Math.sin(t * 0.9 + i) * 0.01; });
      // phone bars
      const a5 = act('phone'); pbars.forEach((b, i) => { const v = b.userData.v; const w = 0.045 * (a5 > 0 ? (v + (i === 0 ? 0.4 : i === 1 ? -0.3 : 0.5) * a5 * Math.sin(t * 6 + i)) : v + 0.05 * Math.sin(t + i)); b.scale.x = Math.max(w, 0.002); b.position.x = -0.026 + b.scale.x / 2; });
      // coffee
      const a6 = act('coffee'); steam.forEach((s) => { const p = (t * 0.35 + s.o) % 1; s.s.position.set(Math.sin(p * 6 + s.o * 9) * 0.008, 0.05 + p * 0.1, 0); s.s.material.opacity = Math.sin(p * Math.PI) * 0.45 * e; s.s.scale.setScalar(0.03 + p * 0.05); });
      mag.visible = a6 > 0.02; mag.position.set(Math.sin(t * 2) * 0.02, 0.1 + a6 * 0.02, 0.04); mag.rotation.y = 0; mag.scale.setScalar(a6 > 0 ? Math.min(1, a6 * 4) : 0.001);
      // tags: only the last touched
      Object.keys(tags).forEach((id) => { const on = id === shown && t - objs[id].t0 < 6; tags[id].visible = on; if (on) setSpr(tags[id], 0.17, clamp01((t - objs[id].t0) * 3) * e); });
      H.update(t, e);
    },
  };
}
