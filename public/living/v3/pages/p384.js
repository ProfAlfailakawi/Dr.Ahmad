import * as THREE from 'three';
import { scene, contactShadow, paintTex, rr, RB, GL, TAU, sm, mat, glossy, goldMat, shadowed, glow, ease, easeBack, clamp01, burstAt, lightPool, drawText } from '../lib/b7-kit.js?v=39';
export const meta = { free: true, center: [0.52, 0.26], typeLabel: 'مجسّم تفاعلي' };

// A message travels phone -> relay tower -> phone. Two discs choose what it carries: bare text (SMS) or text + picture (MMS).
const INK = '#2b2620', BLUE = 0x3b8fe0, GOLD = 0xd4ad55, ORG = 0xf29a2e;

function lines(x, px, py, w, n, col = '#8a8176', h = 12, gap = 24) { for (let i = 0; i < n; i++) { rr(x, px, py + i * gap, i === n - 1 ? w * 0.6 : w, h, 6); x.fillStyle = col; x.fill(); } }
function photo(x, px, py, w, h) {
  const gr = x.createLinearGradient(0, py, 0, py + h); gr.addColorStop(0, '#79bdf0'); gr.addColorStop(1, '#e9f3fb');
  rr(x, px, py, w, h, 14); x.fillStyle = gr; x.fill();
  x.save(); x.beginPath(); x.roundRect(px, py, w, h, 14); x.clip();
  x.fillStyle = '#ffd27a'; x.beginPath(); x.arc(px + w * 0.74, py + h * 0.32, h * 0.14, 0, TAU); x.fill();
  x.fillStyle = '#3f8f6a'; x.beginPath(); x.moveTo(px, py + h); x.lineTo(px + w * 0.34, py + h * 0.42); x.lineTo(px + w * 0.58, py + h * 0.74); x.lineTo(px + w * 0.78, py + h * 0.5); x.lineTo(px + w, py + h * 0.88); x.lineTo(px + w, py + h); x.closePath(); x.fill();
  x.fillStyle = '#2f6f52'; x.beginPath(); x.moveTo(px, py + h); x.lineTo(px + w * 0.2, py + h * 0.66); x.lineTo(px + w * 0.46, py + h); x.closePath(); x.fill();
  x.restore();
}
const phoneTex = (mode) => paintTex(240, 480, (x) => {
  rr(x, 0, 0, 240, 480, 30); x.fillStyle = '#f5f1e8'; x.fill();
  x.fillStyle = mode ? (mode === 'sms' ? '#3b8fe0' : '#f29a2e') : '#2b3a52'; x.fillRect(0, 0, 240, 62);
  rr(x, 90, 16, 60, 12, 6); x.fillStyle = 'rgba(0,0,0,.35)'; x.fill();
  if (mode === 'sms') { rr(x, 22, 110, 196, 112, 24); x.fillStyle = '#ffffff'; x.fill(); x.strokeStyle = '#d9d2c3'; x.lineWidth = 3; x.stroke(); lines(x, 44, 138, 150, 3); }
  else if (mode === 'mms') { rr(x, 22, 96, 196, 238, 24); x.fillStyle = '#ffffff'; x.fill(); x.strokeStyle = '#d9d2c3'; x.lineWidth = 3; x.stroke(); photo(x, 38, 112, 164, 120); lines(x, 44, 254, 150, 2); }
  else { x.fillStyle = 'rgba(0,0,0,.05)'; for (let i = 0; i < 3; i++) { rr(x, 22, 110 + i * 90, 150, 60, 20); x.fill(); } }
});
const packTex = (mode) => paintTex(256, mode === 'mms' ? 256 : 160, (x, w, h) => {
  rr(x, 6, 6, w - 12, h - 12, 34); x.fillStyle = '#ffffff'; x.fill(); x.lineWidth = 8; x.strokeStyle = mode === 'mms' ? '#f29a2e' : '#3b8fe0'; x.stroke();
  if (mode === 'mms') { photo(x, 28, 28, 200, 128); lines(x, 36, 176, 184, 2, '#8a8176', 14, 30); } else lines(x, 36, 44, 184, 3, '#8a8176', 16, 36);
});
const discTex = (mode) => paintTex(256, 256, (x) => {
  const c = mode === 'sms' ? ['#ffffff', '#e7efff'] : ['#ffe3b3', '#ffc269'];
  const gr = x.createRadialGradient(100, 90, 10, 128, 128, 140); gr.addColorStop(0, c[0]); gr.addColorStop(1, c[1]);
  x.fillStyle = gr; x.beginPath(); x.arc(128, 128, 126, 0, TAU); x.fill();
  if (mode === 'sms') { x.fillStyle = '#2b2620'; x.font = '800 44px Tajawal'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('SMS', 128, 70); lines(x, 62, 118, 132, 3, '#3b8fe0', 13, 28); }
  else { x.fillStyle = '#2b2620'; x.font = '800 44px Tajawal'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('MMS', 128, 56); photo(x, 62, 86, 132, 96); lines(x, 66, 198, 124, 1, '#8a5a12', 12, 20); }
});

function phoneMesh(texIdle, ry) {
  const g = new THREE.Group(); const pw = 0.1, ph = 0.2, pd = 0.012;
  const b = new THREE.Mesh(RB(pw, ph, pd, 0.016), glossy(0xe9e2d2, { roughness: 0.25 })); b.position.y = ph / 2 + 0.01; g.add(b);
  const e = new THREE.Mesh(RB(pw + 0.003, ph + 0.003, pd * 0.3, 0.017), goldMat()); e.position.y = ph / 2 + 0.01; g.add(e);
  const scr = new THREE.Mesh(new THREE.PlaneGeometry(pw * 0.93, ph * 0.955), new THREE.MeshBasicMaterial({ map: texIdle, toneMapped: false })); scr.position.set(0, ph / 2 + 0.01, pd / 2 + 0.0008); g.add(scr);
  const bk = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.003, 28), goldMat()); bk.rotation.x = Math.PI / 2; bk.position.set(0, ph / 2 + 0.03, -pd / 2 - 0.0016); g.add(bk);
  const foot = new THREE.Mesh(RB(0.07, 0.01, 0.05, 0.005), goldMat()); foot.position.y = 0.005; g.add(foot);
  g.scale.setScalar(1.25); g.userData.scr = scr; g.userData.top = ph + 0.01; g.rotation.x = -0.1; g.rotation.y = ry;
  b.castShadow = true; return g;
}

export default function build(ctx) {
  const S = scene(ctx, meta, 0.98), g = S.g;
  // tray
  const tray = new THREE.Group(); g.add(tray);
  const slab = new THREE.Mesh(RB(0.64, 0.02, 0.28, 0.05), glossy(0x24405f, { roughness: 0.4, clearcoat: 0.5 })); slab.position.y = 0.01; tray.add(slab);
  const trim = new THREE.Mesh(RB(0.648, 0.006, 0.288, 0.052), goldMat()); trim.position.y = 0.011; tray.add(trim);
  const foot = new THREE.Mesh(RB(0.54, 0.012, 0.2, 0.04), mat(0x3a332b)); foot.position.y = -0.002; tray.add(foot);
  slab.castShadow = true; S.part(tray, 0.1, { rise: 0.0, dur: 0.8 });
  g.add(Object.assign(contactShadow(0.95, 0.5, 0.4), {}));
  const wash = lightPool(0x5aa8ff, 0.4, 0.0); wash.scale.set(0.9, 0.9, 1); wash.position.y = 0.023; g.add(wash);
  const top = 0.022;

  const T = { idle: phoneTex(null), sms: phoneTex('sms'), mms: phoneTex('mms') };
  const snd = phoneMesh(T.idle, 0.38); snd.position.set(-0.22, top, 0.0); g.add(snd); S.part(snd, 0.8, { rise: 0.1 });
  const rcv = phoneMesh(T.idle, -0.38); rcv.position.set(0.22, top, 0.0); g.add(rcv); S.part(rcv, 1.0, { rise: 0.1 });

  // relay tower (centre)
  const tw = new THREE.Group(); tw.position.y = top; g.add(tw);
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.02, 0.3, 16), glossy(0xe9e2d2, { roughness: 0.35 })); mast.position.y = 0.15; tw.add(mast);
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 0.02, 28), goldMat()); base.position.y = 0.01; tw.add(base);
  [0.09, 0.17, 0.24].forEach((y, i) => { const r = new THREE.Mesh(new THREE.TorusGeometry(0.034 - i * 0.009, 0.003, 8, 36), goldMat()); r.rotation.x = Math.PI / 2; r.position.y = y; tw.add(r); });
  const ball = new THREE.Mesh(new THREE.SphereGeometry(0.019, 22, 16), GL(0xffe3a0, 0.9)); ball.position.y = 0.32; tw.add(ball);
  const bglow = glow(0xffd27a, 0.15, 0.7); bglow.position.y = 0.32; tw.add(bglow);
  mast.castShadow = true; base.castShadow = true;
  const twHit = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.4, 0.16), new THREE.MeshBasicMaterial({ visible: false })); twHit.position.y = 0.18; tw.add(twHit);
  S.part(tw, 1.2, { rise: 0.1 });
  const sig = [0, 1].map((i) => { const r = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.0015, 8, 48), new THREE.MeshBasicMaterial({ color: 0xffc860, transparent: true, opacity: 0, toneMapped: false, depthWrite: false })); r.position.y = top + 0.32; g.add(r); return r; });

  // mode discs (front of the tray)
  const mkDisc = (mode, x, col) => {
    const o = new THREE.Group(); o.position.set(x, top, 0.2); g.add(o); const d = new THREE.Group(); o.add(d);
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.052, 0.056, 0.018, 48), glossy(0xf6efdf, { roughness: 0.3 })); body.position.y = 0.009; d.add(body);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.0525, 0.004, 10, 56), goldMat()); rim.rotation.x = Math.PI / 2; rim.position.y = 0.018; d.add(rim);
    const face = new THREE.Mesh(new THREE.CircleGeometry(0.047, 48), new THREE.MeshBasicMaterial({ map: discTex(mode), toneMapped: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 })); face.rotation.x = -Math.PI / 2; face.position.y = 0.0186; d.add(face);
    body.castShadow = true;
    const dHit = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.06, 12), new THREE.MeshBasicMaterial({ visible: false })); dHit.position.y = 0.02; o.add(dHit);
    S.part(o, 2.0 + (mode === 'mms' ? 0.2 : 0), { rise: 0.06 });
    return { o, d, mode, col };
  };
  const dSms = mkDisc('sms', -0.1, BLUE), dMms = mkDisc('mms', 0.1, ORG);

  // packets
  const mkPack = (mode, w, h) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: packTex(mode), transparent: true, side: THREE.DoubleSide, toneMapped: false })); m.visible = false; m.renderOrder = 7; g.add(m); return m; };
  const pk = { sms: mkPack('sms', 0.056, 0.035), mms: mkPack('mms', 0.07, 0.07) };
  const trail = glow(0xffd27a, 0.08, 0); g.add(trail);
  const A = new THREE.Vector3(-0.22, top + 0.17, 0.03), Tp = new THREE.Vector3(0, top + 0.32, 0.01), R = new THREE.Vector3(0.22, top + 0.17, 0.03);
  const c1 = new THREE.QuadraticBezierCurve3(A, new THREE.Vector3(-0.13, top + 0.4, 0.04), Tp), c2 = new THREE.QuadraticBezierCurve3(Tp, new THREE.Vector3(0.13, top + 0.4, 0.04), R);

  let mode = 'sms', sent = 0, lastLaunch = 3.0, flying = null, arrivedMode = null, seen = { sms: false, mms: false, tower: false }, fin = false;
  const press = { sms: 0, mms: 0 };
  const upd = () => { snd.userData.scr.material.map = T[mode]; };
  function pick(m) {
    mode = m; seen[m] = true; press[m] = 1; upd(); (m === 'sms' ? dSms : dMms).d.userData.k = 1;
    burstAt(S, (m === 'sms' ? dSms : dMms).o, m === 'sms' ? BLUE : ORG, 22, 0.35, 0.028); lastLaunch = Math.min(lastLaunch, S.now - 1.0);
    if (m === 'sms') ctx.ui.card({ tag: 'رسائل نصية قصيرة', title: 'SMS', body: 'رسائل نصية قصيرة بين المشتركين في شبكة الهاتف النقال، ويمكن بها نقل البيانات ودخول صفحات الواب WAP.', color: BLUE });
    else ctx.ui.card({ tag: 'وسائط متعددة', title: 'MMS', body: 'خدمة إرسال الوسائط المتعددة، تدمج النص المرسَل بالرسوم والجرافيك والصور.', color: ORG });
    ctx.ui.hud(seen.sms && seen.mms && !seen.tower ? 'المس برج الإرسال' : (m === 'sms' ? 'نص مجرّد' : 'نص وصورة'));
    check();
  }
  function check() { if (!fin && seen.sms && seen.mms && seen.tower) { fin = true; ctx.ui.done(); } }
  S.touch(dSms.o, () => pick('sms'), { color: BLUE, size: 0.15, wake: 3.2 });
  S.touch(dMms.o, () => pick('mms'), { color: ORG, size: 0.15, wake: 3.4 });
  S.touch(tw, () => {
    seen.tower = true; burstAt(S, ball, 0xffd27a, 30, 0.5, 0.03); sigK = 1;
    ctx.ui.card({ tag: 'مركز الإرسال', title: 'الرسالة تعبر المركز', body: 'تعبر الرسائل مركز الإرسال الرئيس الذي يعالجها ويديرها قبل أن تصل إلى المستلم.', color: GOLD }); check();
  }, { color: 0xffd27a, size: 0.2, at: new THREE.Vector3(0, 0.28, 0), wake: 3.6 });
  S.touch(rcv, () => { burstAt(S, rcv, 0xffd27a, 18, 0.3, 0.025); ctx.ui.card({ tag: 'التواصل', title: 'محاضر وطالب', body: 'تقدم الرسائل النصية والوسائط المتعددة فرصاً جيدة للتواصل بين المحاضرين والطلاب.', color: GOLD }); }, { color: 0xffd27a, size: 0.17, at: new THREE.Vector3(0, 0.12, 0.02), wake: 4.0 });
  let sigK = 0;
  ctx.ui.hud('اختر ما تحمله الرسالة');

  S.loop((t, dt, e) => {
    wash.material.opacity = 0.4 * ease((t - 0.5) / 1.2) * e;
    bglow.material.opacity = 0.55 + 0.25 * Math.sin(t * 3);
    sigK = Math.max(0, sigK - dt * 0.6);
    sig.forEach((r, i) => { const u = (t * 0.6 + i * 0.5) % 1; r.rotation.x = Math.PI / 2; r.scale.setScalar(0.4 + u * 1.5); r.material.opacity = (0.4 + sigK * 0.5) * (1 - u) * ease((t - 1.5) / 1) * e; r.visible = r.material.opacity > 0.01; });
    [dSms, dMms].forEach((d) => { const on = mode === d.mode; const k = d.d.userData.k || 0; d.d.userData.k = Math.max(0, k - dt * 3); d.d.position.y = (on ? -0.004 : 0) - 0.006 * Math.sin(Math.min(1, d.d.userData.k) * Math.PI); d.d.scale.setScalar(on ? 1.06 : 0.95); });
    // flight
    if (!flying && t - lastLaunch > 3.4 && t > 3.0) { flying = { t0: t, mode }; lastLaunch = t; sent++; }
    if (flying) {
      const u = (t - flying.t0) / 3.0, P_ = pk[flying.mode], o = pk[flying.mode === 'sms' ? 'mms' : 'sms']; o.visible = false;
      if (u >= 1) { P_.visible = false; trail.material.opacity = 0; rcv.userData.scr.material.map = T[flying.mode]; arrivedMode = flying.mode; burstAt(S, rcv, flying.mode === 'sms' ? BLUE : ORG, flying.mode === 'sms' ? 8 : 30, 0.3, 0.022); flying = null; }
      else {
        const k = sm(u); const pos = k < 0.5 ? c1.getPoint(k * 2) : c2.getPoint((k - 0.5) * 2);
        P_.visible = true; P_.position.copy(pos); P_.rotation.z = Math.sin(u * 8) * 0.1; const pop = u < 0.12 ? sm(u / 0.12) : 1; P_.scale.setScalar(1.7 * pop * (0.9 + 0.1 * Math.sin(u * 20))); P_.position.y += 0.002;
        trail.position.copy(pos); trail.material.opacity = 0.5; trail.material.color.setHex(flying.mode === 'sms' ? BLUE : ORG);
        if (u > 0.47 && u < 0.53) { sigK = Math.max(sigK, 0.5); }
      }
    }
  });
  return { update: S.update };
}
