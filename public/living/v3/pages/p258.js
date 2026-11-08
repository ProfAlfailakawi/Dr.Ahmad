// p258 (round 2): three towers of spending (2011, 2014, 2015) standing straight on the print; lift each year's increase onto the podium and compare.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { P, ease, easeBack, clamp01, stag, mat, glossy, goldMat, shadowed, glow } from '../../kit.js?v=25';
import { halos, liveTag, motes, blob, beam, fitTag, setSpr, TAU, css, arcPoint } from '../lib/a4-kit.js?v=25';

export const meta = { free: true, center: [0.5, 0.58], typeLabel: 'قراءة الأرقام', title: 'نموّ الإنفاق على التعليم الإلكتروني' };

const S = 0.46 / 112.3;                 // height per billion dollars
const YEARS = [
  { y: '2011', v: 35.6, inc: 35.6, c: 0xf5a31a, x: 0.27, label: '2011 · 35.6', pod: '35.6', body: 'قُدِّر الإنفاق العالمي على التعليم الإلكتروني والتعلم الذاتي بنحو 35.6 مليار دولار عام 2011.', title: 'نقطة البداية' },
  { y: '2014', v: 56.2, inc: 20.6, c: 0x8fcb14, x: 0, label: '2014 · 56.2', pod: '+20.6', body: 'ارتفع الإنفاق نحو 20.6 مليار دولار بين 2011 و2014، أي على مدى ثلاث سنوات.', title: 'نموّ ثلاث سنوات' },
  { y: '2015', v: 112.3, inc: 56.1, c: 0x2fb9c4, x: -0.27, label: '2015 · 112.3', pod: '+56.1', body: 'ارتفع نحو 56 مليار دولار في سنة واحدة؛ أي أن الرقم تضاعف تقريباً في عام واحد.', title: 'نموّ سنة واحدة' },
];
const TW = 0.15, POD_Z = 0.27, POD_X = [0.16, 0, -0.16], BZ = -0.08;

export default function build(ctx) {
  const g = new THREE.Group(); g.position.copy(P(meta.center[0], meta.center[1])); ctx.stage.add(g);
  const hal = halos();
  const mo = motes(g, 20, { r: 0.45, h: 0.6, color: 0xfff0c0 });
  const gl = new THREE.Mesh(new THREE.BoxGeometry(0.86, 0.004, 0.006), goldMat()); gl.position.set(0, 0.003, POD_Z + 0.07); g.add(gl); gl.scale.x = 0.0001;

  const towers = YEARS.map((yr, i) => {
    const grp = new THREE.Group(); grp.position.set(yr.x, 0, BZ); g.add(grp);
    const sh = blob(0.17, 0.34); grp.add(sh);
    const plinth = new THREE.Mesh(new RoundedBoxGeometry(0.2, 0.024, 0.2, 3, 0.008), glossy(yr.c, { clearcoat: 0.6 })); plinth.position.y = 0.012; grp.add(plinth);
    const body = new THREE.Group(); body.position.y = 0.024; grp.add(body);
    const hBase = (yr.v - (i ? yr.inc : 0)) * S, hInc = (i ? yr.inc : 0) * S;
    const solid = new THREE.Mesh(new RoundedBoxGeometry(TW, hBase, TW, 4, 0.01), glossy(yr.c, { clearcoat: 0.8 })); solid.position.y = hBase / 2; body.add(solid);
    let incM = null;
    if (hInc) {
      incM = new THREE.Mesh(new RoundedBoxGeometry(TW + 0.006, hInc, TW + 0.006, 4, 0.01), glossy(yr.c, { clearcoat: 1, emissive: yr.c, emissiveIntensity: 0.3, transparent: true, opacity: 0.88 })); incM.position.y = hBase + hInc / 2; body.add(incM);
      const seam = new THREE.Mesh(new RoundedBoxGeometry(TW + 0.014, 0.006, TW + 0.014, 2, 0.002), goldMat()); seam.position.y = hBase; body.add(seam);
    }
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.01, 28), goldMat()); cap.position.y = yr.v * S + 0.005; body.add(cap);
    shadowed(grp);
    const top = new THREE.Vector3(yr.x, 0.024 + yr.v * S + 0.012, BZ);
    const lt = fitTag(yr.label, yr.c, { size: 56, style: 'ink' }); lt.visible = false; g.add(lt);
    hal.add(body, yr.c, 0.36, [0, (hBase + hInc) * 0.6, 0], 2.4 + i * 0.2);
    const t = { yr, grp, body, solid, incM, lt, hBase, hInc, top };
    ctx.tap(grp, () => lift(t, i)); return t;
  });
  // a gold line rising through the three tops
  const climb = beam(new THREE.CatmullRomCurve3([towers[0].top.clone().add(new THREE.Vector3(0, 0.03, 0)), towers[1].top.clone().add(new THREE.Vector3(0, 0.05, 0)), towers[2].top.clone().add(new THREE.Vector3(0, 0.07, 0))]), { radius: 0.004, color: 0xffd27a, segs: 40, speed: 0.4 }); g.add(climb);

  const bars = YEARS.map((yr, i) => {
    const h = yr.inc * S;
    const b = new THREE.Mesh(new RoundedBoxGeometry(0.1, h, 0.1, 4, 0.008), glossy(yr.c, { clearcoat: 1, emissive: yr.c, emissiveIntensity: 0.28 })); b.geometry.translate(0, h / 2, 0);
    b.position.set(POD_X[i], 0.0, POD_Z); b.visible = false; b.castShadow = true; g.add(b);
    const tg = fitTag(yr.pod, yr.c, { size: 64, style: 'solid' }); tg.position.set(POD_X[i], h + 0.07, POD_Z); tg.visible = false; g.add(tg);
    const sh = blob(0.1, 0.3); sh.position.set(POD_X[i], 0.0015, POD_Z); sh.visible = false; g.add(sh);
    return { b, tg, h, fly: 1, from: new THREE.Vector3(), sh };
  });
  let now = 0, finished = false, done = [false, false, false];
  ctx.ui.hud('المس برجاً لترفع زيادته إلى المنصة');
  const cmpLine = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.004, 0.006), new THREE.MeshBasicMaterial({ color: 0xe0453c, toneMapped: false, transparent: true, opacity: 0 })); cmpLine.position.set(0, YEARS[0].inc * S, POD_Z + 0.06); g.add(cmpLine);

  function lift(t, i) {
    if (now < 2.6) return;
    const yr = t.yr, bar = bars[i]; ctx.sfx.pop?.();
    if (!done[i]) { done[i] = true; bar.b.visible = true; bar.fly = 0; bar.from.set(yr.x, 0.024 + (i ? (yr.v - yr.inc / 2) * S : yr.inc * S / 2), BZ); ctx.ui.hud(`على المنصة: ${['', 'زيادة واحدة', 'زيادتان', 'ثلاث زيادات'][done.filter(Boolean).length]}`); }
    ctx.fx.burst(g.position.clone().add(new THREE.Vector3(yr.x, 0.024 + yr.v * S * 0.7, BZ)), yr.c, 14, 0.3, 0.04);
    ctx.ui.card({ tag: `${yr.y} · ${yr.v} مليار دولار`, title: yr.title, body: yr.body, color: yr.c });
    if (done.every(Boolean) && !finished) {
      finished = true;
      setTimeout(() => { ctx.sfx.good?.(); ctx.fx.burst(g.position.clone().add(new THREE.Vector3(-0.16, 0.25, POD_Z)), 0xffd27a, 44, 0.5, 0.05);
        ctx.ui.card({ tag: 'تسارع النمو', title: 'سنة واحدة تفوق ما قبلها', body: 'زيادة 2015 وحدها (56.1) أكبر من إنفاق 2011 كله (35.6) ومن زيادة السنوات الثلاث السابقة (20.6).', color: 0xd4ad55 }); ctx.ui.hud('النمو متسارع لا ثابت'); ctx.ui.done(); }, 1800);
    }
  }
  const tmp = new THREE.Vector3(), to = new THREE.Vector3();
  return {
    update(t, dt, e) {
      now = t; hal.update(t, e); mo.update(t, dt, e); climb.userData.update(dt); climb.userData.grow(stag(t, 1.6, 1.2) * e);
      gl.scale.x = Math.max(0.0001, stag(t, 0.2, 0.8) * e);
      towers.forEach((tw, i) => {
        const gk = stag(t, 0.3 + (2 - i) * 0.35, 0.9, easeBack) * e;     // grow in height, tallest last
        tw.grp.scale.setScalar(Math.max(0.0001, Math.min(1, gk * 4)) * 1); tw.body.scale.y = Math.max(0.0001, gk);
        const k = stag(t, 1.4 + (2 - i) * 0.3, 0.6, easeBack) * e;
        tw.lt.visible = k > 0.02; setSpr(tw.lt, tw.lt.userData.w, k);
        tw.lt.position.set(tw.yr.x, 0.024 + tw.yr.v * S + 0.09 + Math.sin(t * 1.6 + i) * 0.005, BZ);
        if (tw.incM) tw.incM.material.emissiveIntensity = 0.22 + 0.15 * Math.sin(t * 2.2 + i) + (done[i] ? 0 : 0.12);
      });
      bars.forEach((b, i) => {
        b.sh.visible = b.b.visible; if (!b.b.visible) return;
        b.fly = Math.min(1, b.fly + dt / 1.1); to.set(POD_X[i], 0, POD_Z);
        const f = ease(b.fly); arcPoint(tmp, b.from, to, f, 0.2); b.b.position.copy(tmp); b.b.scale.set(1, Math.max(0.0001, 0.2 + 0.8 * f), 1); b.b.rotation.y = (1 - f) * 3;
        const arrived = b.fly >= 1; b.tg.visible = arrived; if (arrived) { setSpr(b.tg, b.tg.userData.w, easeBack(1)); b.tg.position.y = b.h + 0.075 + Math.sin(t * 2 + i) * 0.004; }
      });
      cmpLine.material.opacity = finished ? 0.8 * e : 0;
    },
  };
}
