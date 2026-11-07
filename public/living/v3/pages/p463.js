// p463 — technophilia: a phone feeds a drip into an arm. Six glass bubbles hold statements; find the three false ones and the line unplugs.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { P, ease, easeBack, clamp01, stag, mat, glossy, goldMat, shadowed, glow, lightTube } from '../../kit.js?v=15';
import { inked } from '../../pencil.js?v=15';
import { lightPool } from '../../v2/common.js?v=15';
import { Seq, Hints, Tag, TAU, V, wpos, softShadow } from '../lib/a9-kit.js?v=15';

export const meta = { free: true, center: [0.31, 0.666], typeLabel: 'لعبة اكتشاف الخطأ', title: 'اكتشف الخطأ' };

const S = [
  { t: 'يشير هوس التكنولوجيا إلى الحماسة والتعلق الشديد بالتكنولوجيا، وخاصة الجديدة منها.' },
  { t: 'من مظاهر الإدمان التكنولوجي فقدان الإحساس بالوقت أمام الهاتف أو الإنترنت أو الحاسب.' },
  { t: 'يُستخدم مصطلح هوس التكنولوجيا في علم النفس السريري وحده.', wrong: 1, fix: 'يستخدمه علم الاجتماع عند دراسة تفاعل الأفراد مع محيطهم، مقارناً برهاب التكنولوجيا (بايم).' },
  { t: 'يتأخر المصاب عن واجباته، ويلجأ إلى الأكاذيب الواهية عند سؤاله عن السبب.' },
  { t: 'من مظاهره شعور بقرب أكبر من الأهل والأصدقاء بفضل الاتصال الدائم.', wrong: 1, fix: 'من مظاهره الشعور بالوحدة والبعد عن الأهل والأصدقاء.' },
  { t: 'من يخاف التكنولوجيا يتخلص من خوفه بالابتعاد عنها تماماً.', wrong: 1, fix: 'عليهم الاعتراف بمشكلتهم أولاً، والاقتناع بأنه لا داعي للخوف أو الحرج.' },
];

function screenTex() {
  const c = document.createElement('canvas'); c.width = 256; c.height = 480; const x = c.getContext('2d');
  x.fillStyle = '#f7f1e2'; x.fillRect(0, 0, 256, 480);
  x.fillStyle = '#2a6fa8'; x.fillRect(30, 150, 196, 90);
  x.fillStyle = '#fff'; x.font = '800 40px Tajawal, sans-serif'; x.textAlign = 'center'; x.fillText('SOCIAL', 128, 190); x.fillText('MEDIA', 128, 232);
  x.fillStyle = '#7ccbc6'; x.fillRect(95, 40, 66, 110);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

export default function build(ctx) {
  const g = new THREE.Group(); g.position.copy(P(meta.center[0], meta.center[1])); ctx.stage.add(g); g.scale.setScalar(0.9);
  const seq = new Seq(), hints = new Hints(g, 5.8), tag = new Tag(g, 0.2);
  let now = 0, found = 0, freed = 0, finished = false, current = -1;

  const shadow = softShadow(0.6, 0.45, 0.3); g.add(shadow);

  // the phone, upright, leaning back
  const phone = new THREE.Group(); phone.position.set(-0.08, 0.004, -0.04); phone.rotation.x = -0.18; phone.scale.setScalar(1.3); g.add(phone);
  const pb = new THREE.Mesh(new RoundedBoxGeometry(0.15, 0.27, 0.024, 4, 0.012), glossy(0xe8472b)); pb.position.y = 0.135; phone.add(shadowed(pb));
  const ps = new THREE.Mesh(new THREE.PlaneGeometry(0.128, 0.24), new THREE.MeshBasicMaterial({ map: screenTex(), toneMapped: false })); ps.position.set(0, 0.138, 0.0125); phone.add(ps);
  const drip = new THREE.Mesh(new THREE.CapsuleGeometry(0.018, 0.05, 6, 14), new THREE.MeshPhysicalMaterial({ color: 0x3a8fd0, transparent: true, opacity: 0.8, roughness: 0.1, clearcoat: 1 })); drip.position.set(0, 0.185, 0.02); phone.add(drip);
  const foot = new THREE.Mesh(new RoundedBoxGeometry(0.17, 0.02, 0.1, 3, 0.008), glossy(0x2b2620)); foot.position.set(0, 0.012, 0.02); phone.add(foot);
  // the arm and its two bandages
  const arm = new THREE.Group(); arm.position.set(0.1, 0.04, 0.13); arm.rotation.y = -0.25; arm.scale.setScalar(1.25); g.add(arm);
  const skin = glossy(0xf1bd96, { roughness: 0.5, clearcoat: 0.2 });
  const forearm = new THREE.Mesh(new THREE.CapsuleGeometry(0.036, 0.2, 8, 20), skin); forearm.rotation.z = Math.PI / 2; arm.add(shadowed(forearm));
  const hand = new THREE.Mesh(new THREE.SphereGeometry(0.04, 18, 12), skin); hand.scale.set(1.2, 0.8, 1); hand.position.x = 0.14; arm.add(hand);
  [-0.03, -0.01, 0.01, 0.03].forEach((z, i) => { const f = new THREE.Mesh(new THREE.CapsuleGeometry(0.008, 0.03, 4, 8), skin); f.rotation.z = Math.PI / 2; f.position.set(0.19 + (i === 1 || i === 2 ? 0.008 : 0), 0, z); arm.add(f); });
  const bands = [-0.03, 0.015].map((x) => { const b = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.012, 0.09), mat(0xf6f1e1)); b.position.set(x, 0.033, 0); b.rotation.y = 0.35; arm.add(b); return b; });
  const port = new THREE.Mesh(new THREE.SphereGeometry(0.008, 10, 8), mat(0xe8472b)); port.position.set(-0.045, 0.04, 0.012); arm.add(port);

  // the glowing line phone -> arm
  const a0 = V(-0.08, 0.075, 0.03), a1 = V(0.03, 0.04, 0.2), a2 = V(0.04, 0.1, 0.23);
  const portW = V(0.1 - 0.045 * Math.cos(-0.25), 0.1, 0.13 + 0.045 * Math.sin(-0.25) * -1);
  const curve = new THREE.CatmullRomCurve3([a0, V(-0.1, 0.045, 0.1), V(-0.03, 0.04, 0.2), V(0.04, 0.05, 0.2), V(0.056, 0.1, 0.14)]);
  const tube = lightTube(curve, { radius: 0.0095, color: 0x1f78d8, speed: 0.5 }); g.add(tube);
  const calm = glow(0x6fe0a6, 0.5, 0); calm.position.set(0, 0.15, 0.0); g.add(calm);
  const pool = lightPool(0xffe9c8, 0.3, 0.4); pool.position.y = 0.003; g.add(pool);

  // two stamps: tap one to judge the chosen bubble
  function glyphTex(ch, bg) { const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d'); x.fillStyle = bg; x.fillRect(0, 0, 128, 128); x.strokeStyle = '#fff'; x.lineWidth = 16; x.lineCap = 'round'; x.beginPath(); if (ch === 'ok') { x.moveTo(30, 66); x.lineTo(54, 92); x.lineTo(98, 38); } else { x.moveTo(38, 38); x.lineTo(90, 90); x.moveTo(90, 38); x.lineTo(38, 90); } x.stroke(); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; }
  const stamps = [['ok', 0x2fae8f, -0.13, false, '#2fae8f'], ['no', 0xe0562f, 0.13, true, '#e0562f']].map(([k, col, x, saysWrong, bg]) => {
    const grp = new THREE.Group(); grp.position.set(x, 0.004, 0.36); g.add(grp);
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.05, 0.026, 32), glossy(col, { roughness: 0.3 })); base.position.y = 0.013; grp.add(shadowed(base));
    const top = new THREE.Mesh(new THREE.CircleGeometry(0.038, 32), new THREE.MeshBasicMaterial({ map: glyphTex(k, bg), toneMapped: false })); top.rotation.x = -Math.PI / 2; top.position.y = 0.0275; grp.add(top);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.047, 0.0035, 8, 40), goldMat()); ring.rotation.x = Math.PI / 2; ring.position.y = 0.026; grp.add(ring);
    const h = glow(col, 0.16, 0); h.position.y = 0.04; grp.add(h);
    seq.add(grp, 1.8, 0.7);
    return { grp, h, saysWrong, press: -9, col };
  });
  // six bubbles, one statement each
  const bubbles = S.map((s, i) => {
    const grp = new THREE.Group(); g.add(grp);
    const gl = new THREE.Mesh(new THREE.SphereGeometry(0.05, 24, 16), new THREE.MeshPhysicalMaterial({ color: 0xb9e3f2, transparent: true, opacity: 0.6, roughness: 0.05, clearcoat: 1, depthWrite: false })); gl.renderOrder = 4; grp.add(gl);
    const core = new THREE.Mesh(new THREE.SphereGeometry(0.024, 16, 12), new THREE.MeshBasicMaterial({ color: 0xff9a3c, toneMapped: false })); grp.add(core);
    const halo = glow(0xffd27a, 0.1, 0.25); grp.add(halo);
    seq.add(grp, 2.0 + i * 0.25, 0.8);
    const h = hints.add(V(), 0xffd27a, 0.1);
    return { grp, gl, core, halo, s, i, state: 0, h, shake: -9, a: (i / 6) * TAU + 0.5 };
  });

  seq.add(phone, 0.7, 0.9); seq.add(arm, 1.0, 0.9); seq.add(tube, 1.3, 0.1);

  function choose(b, saysWrong) {
    const isWrong = !!b.s.wrong;
    if (saysWrong === isWrong) {
      b.state = 1; b.h.on = false;
      if (isWrong) { found++; b.core.material.color.set(0xf2b632); b.halo.material.color.set(0xf2b632); ctx.sfx.good?.(); ctx.ui.card({ tag: 'خطأ مكتشَف', title: 'والصحيح هو', body: b.s.fix, color: 0xf2b632 }); ctx.fx.burst(wpos(g, b.grp.position), 0xf2b632, 20, 0.3, 0.03); }
      else { b.core.material.color.set(0x4cc38f); b.halo.material.color.set(0x4cc38f); ctx.sfx.pop?.(); ctx.ui.card({ tag: 'عبارة دقيقة', title: 'أحسنت', body: 'هذه العبارة صحيحة بحسب ما يعرضه الكتاب.', color: 0x4cc38f }); }
      tag.hide();
      if (found === 3 && !finished) { finished = true; setTimeout(() => { freed = now; ctx.sfx.good?.(); ctx.ui.hud('انفكّ الارتباط'); ctx.ui.done(); ctx.fx.burst(wpos(g, V(0, 0.2, 0)), 0x6fe0a6, 50, 0.5, 0.04); }, 1200); }
    } else {
      b.shake = now; ctx.sfx.bad?.();
      ctx.ui.card({ tag: 'أعد النظر', title: isWrong ? 'هذه العبارة غير دقيقة' : 'هذه العبارة دقيقة', body: 'تأمّل صياغتها مرة أخرى، ثم احكم.', color: 0xc0504a });
    }
  }
  let selected = null;
  bubbles.forEach((b) => ctx.tap(b.grp, () => {
    if (b.state || finished) return;
    ctx.sfx.pop?.(); selected = b;
    ctx.ui.card({ tag: 'اختبر العبارة', title: 'صحيحة أم غير دقيقة؟', body: b.s.t, color: 0xd4ad55 });
  }));
  stamps.forEach((st) => ctx.tap(st.grp, () => {
    st.press = now; if (finished) return;
    if (!selected) { ctx.sfx.bad?.(); ctx.ui.toast('اختر عبارة أولاً'); return; }
    const b = selected; selected = null; choose(b, st.saysWrong);
  }));
  ctx.ui.hud('اختر عبارة ثم اضغط الختم');

  return {
    update(t, dt, e) {
      now = t; seq.update(t, e); hints.update(t, e); tag.update(dt, e);
      const f = freed ? ease((t - freed) / 1.2) : 0;
      stamps.forEach((st) => { const d = clamp01(1 - (t - st.press) / 0.3); st.grp.children[0].position.y = 0.013 - 0.008 * d; st.h.material.opacity = (selected ? 0.5 + 0.3 * Math.sin(t * 5) : 0.1) * e; });
      bubbles.forEach((b) => {
        const a = b.a + t * 0.22, r = 0.28;
        b.grp.position.set(Math.cos(a) * r * 1.05 + 0.0, 0.18 + Math.sin(t * 1.3 + b.i) * 0.014, Math.sin(a) * r * 0.9 + 0.02);
        if (t - b.shake < 0.5) b.grp.position.x += Math.sin((t - b.shake) * 50) * 0.01;
        b.h.h.position.copy(b.grp.position); b.halo.scale.setScalar(0.1 + 0.012 * Math.sin(t * 3 + b.i));
        b.core.scale.setScalar(1 + 0.08 * Math.sin(t * 4 + b.i));
      });
      tube.userData.fill(stag(t, 1.4, 1.2, clamp01) * e); tube.userData.update(dt);
      tube.userData.core.material.opacity = 0.95 * (1 - f);
      tube.position.y = f * 0.0; tube.visible = f < 0.98 || true;
      arm.position.x = 0.1 + 0.05 * f; bands.forEach((b, i) => { b.position.y = 0.033 + 0.12 * f * (1 + i * 0.4); b.rotation.x = f * 1.5; });
      drip.material.opacity = 0.8 - 0.45 * f; ps.material.color.setScalar(1 - 0.0 * f);
      calm.material.opacity = 0.6 * f * e; pool.material.opacity = 0.4;
    },
  };
}
