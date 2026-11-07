import * as THREE from 'three';
import { mat, glossy, goldMat, shadowed, glow, stag, ease, easeBack, clamp01 } from '../../kit.js?v=17';
import { scene, TAU, contactShadow, lightPool } from '../lib/a8-kit.js?v=17';
export const meta = { free: true, center: [0.47, 0.575], typeLabel: 'ركّب المستويات' };

const GL = (c, i = 1) => new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: i, roughness: 0.3 });
const LV = [
  { n: 'التذكر', c: 0x6aa84f, b: 'العثور، وضع إشارات مرجعية، البحث.' },
  { n: 'الفهم', c: 0x2c5aa0, b: 'التصنيف، التعليق، التوسيم، الاشتراك.' },
  { n: 'التطبيق', c: 0x4fb3e0, b: 'تشغيل الوسائط والبرامج، الرفع، المشاركة.' },
  { n: 'التحليل', c: 0xf39a2b, b: 'المقارنة، الربط، الهندسة العكسية، قص الوسائط.' },
  { n: 'التقويم', c: 0xf6c026, b: 'الفحص، النقد، التجريب، التحكيم، المراقبة.' },
  { n: 'الإنشاء', c: 0xd9344b, b: 'التصميم، البرمجة، إنتاج الأفلام، البودكاست.' },
];
const SLOT = [3, 0, 5, 2, 4, 1]; // which level hovers at each ring position
const H = 0.046, Y0 = 0.022;
const rad = (k) => 0.2 - k * 0.022;

export default function build(ctx) {
  const S = scene(ctx, meta), g = S.g;
  const pool = lightPool(0xd4ad55, 0.36, 0.0); pool.position.y = 0.002; g.add(pool); const shd = contactShadow(0.5, 0.5, 0.38); g.add(shd);
  // ghost rings: where each level will sit
  const ghosts = LV.map((l, k) => { const r = new THREE.Mesh(new THREE.TorusGeometry(rad(k) - 0.004, 0.0022, 8, 60), GL(0xd4ad55, 0.5)); r.rotation.x = Math.PI / 2; r.position.y = Y0 + k * H + 0.002; g.add(r); S.part(r, 0.2 + k * 0.12, { rise: 0.04 }); return r; });
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 6 * H + 0.06, 8), goldMat()); pole.position.y = Y0 + (6 * H + 0.06) / 2; g.add(pole); S.part(pole, 0.4);

  const slabs = LV.map((l, k) => {
    const grp = new THREE.Group();
    const m = new THREE.Mesh(new THREE.CylinderGeometry(rad(k) - 0.012, rad(k), H - 0.004, 56), glossy(l.c, { roughness: 0.3 }));
    const lip = new THREE.Mesh(new THREE.TorusGeometry(rad(k) - 0.006, 0.0035, 8, 60), glossy(l.c)); lip.rotation.x = Math.PI / 2; lip.position.y = (H - 0.004) / 2;
    const top = new THREE.Mesh(new THREE.CircleGeometry(rad(k) - 0.013, 48), GL(l.c, 0.18)); top.rotation.x = -Math.PI / 2; top.position.y = (H - 0.004) / 2 + 0.0005;
    grp.add(m, lip, top); shadowed(grp);
    const h = glow(l.c, 0.34, 0.0); h.position.y = 0.0; grp.add(h);
    const si = SLOT.indexOf(k), a = (si / 6) * TAU + 0.3;
    const home = new THREE.Vector3(Math.cos(a) * 0.31, 0.11 + (si % 2) * 0.03, Math.sin(a) * 0.27);
    const FS = 0.088 / rad(k);
    grp.position.copy(home); grp.scale.setScalar(FS * 0.0001);
    g.add(grp);
    const tg = S.tag(l.n, l.c, 0.115, { ppu: 2200 }); tg.delay = 2.6 + si * 0.2;
    return { grp, h, home, FS, k, state: 'float', fly: 0, from: new THREE.Vector3(), to: new THREE.Vector3(0, Y0 + H / 2 + k * H, 0), shake: -9, tg, ph: si, born: 0.5 + si * 0.3 };
  });
  let next = 0, tN = 0;
  const hud = () => ctx.ui.hud(next === 0 ? 'ابدأ ببناء القاعدة' : next < 6 ? `المستوى ${['', 'الثاني', 'الثالث', 'الرابع', 'الخامس'][next]}؟` : 'اكتمل تصنيف بلوم الرقمي');
  hud();
  slabs.forEach((s) => {
    S.touch(s.grp, () => {
      if (s.state !== 'float') { ctx.ui.card({ tag: 'مهام رقمية', title: LV[s.k].n, body: LV[s.k].b, color: LV[s.k].c }); return; }
      if (s.k === next) {
        s.state = 'fly'; s.fly = S.now; s.from.copy(s.grp.position); s.tg.tk = 0; ctx.sfx.good?.(); next++; hud();
        ctx.ui.card({ tag: 'مهام رقمية', title: LV[s.k].n, body: LV[s.k].b, color: LV[s.k].c });
      } else { s.shake = S.now; ctx.sfx.bad?.(); ctx.ui.toast('ابدأ بمهارات التفكير الدنيا من القاعدة'); }
    }, { color: LV[s.k].c, size: 0.3, wake: 3.4 });
  });
  const crown = glow(0xffd27a, 0.7, 0); crown.position.y = Y0 + 6 * H + 0.06; g.add(crown);
  const star = new THREE.Mesh(new THREE.OctahedronGeometry(0.022, 0), GL(0xffe3a0, 1.4)); star.position.y = Y0 + 6 * H + 0.05; star.scale.setScalar(0.0001); g.add(star);
  let fin = -1;
  S.loop((t, dt, e) => {
    pool.material.opacity = 0.5 * ease(t / 0.8) * e;
    slabs.forEach((s) => {
      s.tg.s.position.copy(s.grp.position); s.tg.s.position.y += 0.075;
      const bob = Math.sin(t * 1.5 + s.ph * 1.3) * 0.006;
      if (s.state === 'float') {
        const k = easeBack((t - s.born) / 0.8) * e;
        s.grp.scale.setScalar(Math.max(0.0001, s.FS * k));
        const a = t * 0.12;
        const c = Math.cos(a), sn = Math.sin(a);
        s.grp.position.set(s.home.x * c - s.home.z * sn + clamp01(1 - (t - s.shake) / 0.5) * Math.sin((t - s.shake) * 55) * 0.012, s.home.y + bob, s.home.x * sn + s.home.z * c);
        s.grp.rotation.y = t * 0.5 + s.ph;
        s.h.material.opacity = (t > 3.4 ? 0.3 + 0.12 * Math.sin(t * 2.4 + s.ph) : 0) * k;
      } else if (s.state === 'fly') {
        const u = clamp01((t - s.fly) / 1.0), q = ease(u);
        s.grp.position.lerpVectors(s.from, s.to, q); s.grp.position.y += Math.sin(u * Math.PI) * 0.12;
        s.grp.scale.setScalar(s.FS + (1 - s.FS) * q); s.grp.rotation.y = (1 - q) * (t * 0.5 + s.ph);
        s.h.material.opacity = 0.5 * (1 - u);
        if (u >= 1) { s.state = 'set'; s.grp.rotation.y = 0; s.grp.position.copy(s.to); s.grp.scale.setScalar(1); ghosts[s.k].visible = false; S.burst(new THREE.Vector3(0, s.to.y + 0.02, 0), LV[s.k].c, 26, 0.5); if (s.k === 5) fin = t; }
      }
    });
    if (fin > 0) {
      const u = clamp01((t - fin) / 0.8); star.scale.setScalar(Math.max(0.0001, easeBack(u))); star.rotation.y = t * 1.5; crown.material.opacity = 0.6 * u;
      if (!S.finished && t - fin > 1.6) { S.finished = true; ctx.ui.card({ tag: 'اكتمل البناء', title: 'من التذكر إلى الإنشاء', body: 'يبدأ التذكر باسترجاع المعلومة، ثم يفسّرها الفهم، ويستخدمها التطبيق، ويفككها التحليل، ويحكم عليها التقويم، ثم يركّب الإنشاء شيئاً جديداً.', color: 0xd9344b }); ctx.ui.done(); }
    }
    ghosts.forEach((r, i) => { if (r.visible) r.material.emissiveIntensity = 0.35 + 0.25 * Math.sin(t * 2.2 + i); });
  });
  return { update: S.update };
}
