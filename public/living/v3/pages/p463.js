import * as THREE from 'three';
import { mat, glossy, goldMat, shadowed, glow, ease, easeBack, clamp01 } from '../../kit.js?v=37';
import { scene, RoundedBox, TAU, contactShadow, lightPool, paint, smooth, GL, plinth, textPlane } from '../lib/b8-kit.js?v=37';
export const meta = { free: true, center: [0.5, 0.6], typeLabel: 'لعبة اكتشاف' };

const TEAL = 0x4fc3c8, RED = 0xe8412c, GOLD = 0xd4ad55;
const AR = ['١', '٢', '٣', '٤', '٥', '٦', '٧'];
const SENT = [
  { t: 'يشير هوس التكنولوجيا إلى الحماسة العامة والتعلق الشديد بالتكنولوجيا، وخاصة الجديدة منها.', wrong: false },
  { t: 'من مظاهر الإدمان التكنولوجي فقدان الإحساس بالوقت أمام الهاتف أو الإنترنت أو الحاسب.', wrong: false },
  { t: 'يُستخدم مصطلح هوس التكنولوجيا في علم النفس السريري وحده عند تشخيص الاضطرابات.', wrong: true, fix: 'يستخدمه علم الاجتماع عند دراسة تفاعل الأفراد مع محيطهم، وخاصة حين يقارن بنقيضه رهاب التكنولوجيا.' },
  { t: 'يتأخر المصاب عن الواجبات أو وظائف العمل، ويلجأ إلى الحجج والأكاذيب الواهية.', wrong: false },
  { t: 'من مظاهره شعور بقرب أكبر من الأهل والأصدقاء بفضل الاتصال الدائم.', wrong: true, fix: 'من مظاهره الشعور بالوحدة والبعد عن الأهل والأصدقاء.' },
  { t: 'من يخاف التكنولوجيا يتخلص من خوفه بالابتعاد عنها تماماً.', wrong: true, fix: 'عليهم أن يعترفوا بمشكلتهم أولاً ويقتنعوا بأنه ليس هناك ما يدعو للخوف، وأن بالإمكان التخلص منه.' },
  { t: 'من مظاهره الإحساس بالذنب بسبب تضييع الوقت.', wrong: false },
];
const phoneScreen = () => paint(256, 512, (x, w, h) => {
  const gr = x.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#6fd6d6'); gr.addColorStop(1, '#3aa8b8'); x.fillStyle = gr; x.fillRect(0, 0, w, h);
  x.fillStyle = '#fff'; x.beginPath(); x.roundRect(88, 40, 80, 24, 12); x.fill();
  x.fillStyle = '#2f7fbf'; x.beginPath(); x.roundRect(52, 90, 152, 250, 40); x.fill(); x.fillStyle = 'rgba(255,255,255,.28)'; x.beginPath(); x.roundRect(66, 106, 30, 190, 15); x.fill();
  x.fillStyle = '#1f4f87'; x.fillRect(52, 190, 152, 62); x.fillStyle = '#fff'; x.font = '800 30px Tajawal, sans-serif'; x.textAlign = 'center'; x.fillText('SOCIAL', 128, 218); x.fillText('MEDIA', 128, 246);
  x.fillStyle = '#9bd7ea'; x.fillRect(122, 340, 12, 90); x.fillStyle = '#e8412c'; x.beginPath(); x.roundRect(60, 450, 136, 28, 14); x.fill();
});
const numTex = (n) => paint(128, 128, (x, w, h) => { x.fillStyle = '#f4e3b0'; x.fillRect(0, 0, w, h); x.fillStyle = '#2b2620'; x.font = '800 92px Tajawal, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(n, w / 2, h / 2 + 6); });

export default function build(ctx) {
  const S = scene(ctx, meta), g = S.g;
  const pl = plinth(0.4, { h: 0.026, color: 0x2f8a8c }); g.add(pl); S.part(pl, 0.1, { rise: 0.06 });
  const shd = contactShadow(0.92, 0.92, 0.3); g.add(shd);
  const top = 0.03;
  // phone
  const ph = new THREE.Group(); ph.position.set(0, top, -0.12); ph.scale.setScalar(1.12); g.add(ph);
  const foot = new THREE.Mesh(new RoundedBox(0.2, 0.018, 0.12, 0.008), goldMat()); foot.position.y = 0.009; ph.add(foot);
  const body = new THREE.Mesh(new RoundedBox(0.23, 0.38, 0.03, 0.03), glossy(RED, { roughness: 0.3 })); body.position.y = 0.21; ph.add(body);
  const sm = new THREE.MeshStandardMaterial({ map: phoneScreen(), emissive: 0xffffff, emissiveIntensity: 0.45, roughness: 0.25 }); sm.emissiveMap = sm.map;
  const scr = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.345), sm); scr.position.set(0, 0.215, 0.0155); ph.add(scr);
  const cam = new THREE.Mesh(new THREE.CircleGeometry(0.006, 14), mat(0x1b1a18)); cam.position.set(0, 0.388, 0.0156); ph.add(cam);
  const bk = new THREE.Mesh(new RoundedBox(0.07, 0.07, 0.004, 0.02), goldMat()); bk.position.set(0, 0.26, -0.0155); ph.add(bk);
  const drops = [0, 1, 2].map((i) => { const d = new THREE.Mesh(new THREE.SphereGeometry(0.007, 12, 10), GL(0x9bd7ea, 0.9)); d.position.set(0, 0.2, 0.02); ph.add(d); return d; });
  shadowed(ph); S.part(ph, 0.5, { rise: 0.08 });
  const halo = glow(RED, 0.5, 0.0); halo.position.set(0, 0.21, 0.0); ph.add(halo);
  // pips: three errors to find
  const pips = [-1, 0, 1].map((k, i) => { const p = new THREE.Mesh(new THREE.SphereGeometry(0.014, 18, 14), GL(0x8a8378, 0.0, { color: 0x8a8378 })); p.position.set(k * 0.06, 0.46, -0.1); g.add(p); const r = new THREE.Mesh(new THREE.TorusGeometry(0.02, 0.0025, 8, 32), goldMat()); r.position.copy(p.position); g.add(r); S.part(p, 2.2 + i * 0.15, { rise: 0.05 }); S.part(r, 2.2 + i * 0.15, { rise: 0.05 }); return { p, r, lit: 0 }; });

  // rack and vials
  const R = 0.285, TH = 0.95, n = SENT.length;
  const rail = new THREE.Mesh(new THREE.TorusGeometry(R, 0.016, 10, 80, TH * 2 + 0.3), glossy(0xe0b85e, { metalness: 0.7, roughness: 0.3 })); rail.rotation.x = Math.PI / 2; rail.rotation.z = Math.PI / 2 - TH - 0.15; rail.position.y = top + 0.016; g.add(shadowed(rail)); S.part(rail, 0.8, { rise: 0.05 });
  const vials = SENT.map((s, i) => {
    const th = -TH + (i / (n - 1)) * TH * 2, hold = new THREE.Group(), vial = new THREE.Group(); hold.add(vial);
    const homeP = new THREE.Vector3(Math.sin(th) * R, top + 0.03, Math.cos(th) * R);
    const glass = new THREE.Mesh(new THREE.CylinderGeometry(0.019, 0.019, 0.1, 22, 1, true), new THREE.MeshPhysicalMaterial({ color: 0xdff7f8, transparent: true, opacity: 0.28, roughness: 0.05, clearcoat: 1, side: THREE.DoubleSide, depthWrite: false })); glass.position.y = 0.06; vial.add(glass);
    const bot = new THREE.Mesh(new THREE.SphereGeometry(0.019, 18, 10, 0, TAU, Math.PI / 2, Math.PI / 2), glass.material); bot.position.y = 0.01; vial.add(bot);
    const liq = new THREE.Mesh(new THREE.CylinderGeometry(0.0155, 0.0155, 0.06, 20), new THREE.MeshStandardMaterial({ color: 0xcfd7d6, emissive: 0xcfd7d6, emissiveIntensity: 0.15, roughness: 0.2 })); liq.position.y = 0.04; vial.add(liq);
    const lb = new THREE.Mesh(new THREE.SphereGeometry(0.0155, 16, 10, 0, TAU, Math.PI / 2, Math.PI / 2), liq.material); lb.position.y = 0.01; vial.add(lb);
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.0215, 0.0215, 0.016, 22), goldMat()); cap.position.y = 0.114; vial.add(cap);
    const plate = new THREE.Mesh(new THREE.CircleGeometry(0.0145, 20), new THREE.MeshBasicMaterial({ map: numTex(AR[i]), toneMapped: false })); plate.position.set(0, 0.072, 0.0195); vial.add(plate);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.0145, 0.0016, 8, 24), goldMat()); ring.position.copy(plate.position); ring.position.z += 0.0004; vial.add(ring);
    shadowed(vial); hold.position.copy(homeP); hold.rotation.y = th; g.add(hold); S.part(vial, 1.1 + i * 0.14, { rise: 0.06 });
    return { hold, vial, liq, th, homeP, i, state: 'idle', lift: 0, shake: -9, done: false, color: 0xcfd7d6 };
  });
  vials.forEach((v) => v.hold.scale.multiplyScalar(1.5)); vials.forEach((v) => { v.hold.scale.set(1, 1, 1); });

  let cur = null, found = 0, finished = false;
  const setPip = () => pips.forEach((p, i) => { p.lit = i < found ? 1 : 0; });
  const release = (v) => { if (!v) return; v.state = 'idle'; if (cur === v) cur = null; ctx.ui.choices([]); };
  const verdict = (v, saysWrong) => {
    const s = SENT[v.i], right = saysWrong === s.wrong; ctx.ui.choices([]);
    if (!right) { v.shake = S.now; ctx.sfx.bad?.(); ctx.ui.toast(s.wrong ? 'فكّر ثانية: فيها خطأ' : 'هذه العبارة دقيقة'); setTimeout(() => release(v), 900); return; }
    ctx.sfx.good?.(); v.done = true; v.state = 'idle'; cur = null;
    const col = s.wrong ? RED : 0x4cc38a; v.color = col; v.liq.material.color.setHex(col); v.liq.material.emissive.setHex(col); v.liq.material.emissiveIntensity = 0.55;
    S.burst(v.hold.position.clone().add(new THREE.Vector3(0, 0.12, 0)), col, 24, 0.45);
    if (s.wrong) { found++; setPip(); ctx.ui.card({ tag: 'خطأ مكتشف', title: 'التصحيح', body: s.fix, color: RED }); } else ctx.ui.card({ tag: 'عبارة دقيقة', title: 'صحيحة', body: s.t, color: 0x4cc38a });
    ctx.ui.hud(found < 3 ? `وجدت ${['', 'خطأً واحداً', 'خطأين'][found] || 'لا شيء'} من ثلاثة` : 'وجدت الأخطاء الثلاثة');
    if (found >= 3 && !finished) { finished = true; setTimeout(() => ctx.ui.done(), 2200); }
  };
  vials.forEach((v) => S.touch(v.hold, () => {
    if (v.done) { ctx.ui.card({ tag: v.liq.material.color.getHex() === RED ? 'خطأ' : 'صحيحة', title: `العبارة ${AR[v.i]}`, body: SENT[v.i].wrong ? SENT[v.i].fix : SENT[v.i].t, color: v.color }); return; }
    if (cur && cur !== v) release(cur);
    cur = v; v.state = 'up'; v.lift = 0;
    ctx.ui.card({ tag: `العبارة ${AR[v.i]}`, title: 'صحيحة أم خاطئة؟', body: SENT[v.i].t, color: GOLD });
    ctx.ui.choices([{ label: 'صحيحة', primary: true, onPick: () => verdict(v, false) }, { label: 'خاطئة', onPick: () => verdict(v, true) }]);
  }, { color: 0xffe3a0, size: 0.1, at: new THREE.Vector3(0, 0.06, 0), wake: 4.4 }));
  ctx.ui.hud('اكتشف ثلاث عبارات خاطئة');

  S.loop((t, dt, e) => {
    const sf = clamp01(found / 3); sm.emissiveIntensity = 0.45 + 0.15 * Math.sin(t * 2);
    halo.material.opacity = 0.35 * (1 - sf) * clamp01((t - 2) / 1.5) * (0.7 + 0.3 * Math.sin(t * 3));
    drops.forEach((d, i) => { const f = (t * 0.6 + i / 3) % 1; d.position.y = 0.2 - f * 0.12; d.position.x = 0; d.material.emissiveIntensity = 1 - f; d.visible = true; });
    ph.rotation.y = Math.sin(t * 0.5) * 0.08;
    pips.forEach((p, i) => { p.p.material.emissiveIntensity = p.lit ? 1.2 + 0.4 * Math.sin(t * 3) : 0; p.p.material.color.setHex(p.lit ? 0xffd27a : 0x8a8378); p.p.material.emissive.setHex(0xffc24a); p.p.position.y = 0.46 + Math.sin(t * 2 + i) * 0.004; p.r.position.y = p.p.position.y; });
    vials.forEach((v) => {
      v.lift = THREE.MathUtils.damp(v.lift, v.state === 'up' ? 1 : 0, 6, dt); const k = smooth(v.lift);
      v.hold.position.set(v.homeP.x * (1 - k * 0.7), v.homeP.y + k * 0.22, v.homeP.z + k * 0.0 + k * 0.1); v.hold.scale.setScalar(1.3 + k * 0.7);
      const sh = clamp01(1 - (t - v.shake) / 0.5); v.hold.rotation.set(0, v.th * (1 - k) + Math.sin(t * 2.5) * 0.12 * k, Math.sin((t - v.shake) * 50) * sh * 0.2);
      if (!v.done) v.liq.material.emissiveIntensity = 0.12 + 0.1 * k + (k > 0.5 ? 0.15 * Math.sin(t * 5) : 0);
    });
  });
  return { update: S.update };
}
