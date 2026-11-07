import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { P, ease, easeBack, clamp01, stag, mat, glossy, goldMat, shadowed, glow, sprite } from '../../kit.js?v=16';
import { Rig, badge, retext, V, TAU, css } from '../lib/a5-kit.js?v=16';
import { lightPool } from '../../v2/common.js?v=16';

export const meta = { free: true, center: [0.36, 0.28], typeLabel: 'لعبة: اكتشاف الخطأ' };

// five statements: three are wrong
const T = [
  { t: 'محاكاة مطابقة', wrong: true, n: 'بيئة المحاكاة لا يمكن أن تشبه العالم الحقيقي؛ فهي تخلق عوالم وهمية تولّدها الأرقام والرموز.', pos: [-0.25, 0.25, -0.12] },
  { t: 'حضور عن بعد', wrong: false, n: 'يتحقق الحضور عن بعد بأجهزة الإدخال القياسية أو بأجهزة متعددة الوسائط كمجسات الحركة والقفازات.', pos: [0, 0.25, -0.12] },
  { t: 'بلا إنترنت', wrong: true, n: 'التعليم الافتراضي يتيح التواصل والحصول على المعلومات والتدريب عن طريق شبكة الإنترنت.', pos: [0.25, 0.25, -0.12] },
  { t: 'أداء أفضل', wrong: false, n: 'كلما زادت التجربة في التعليم الافتراضي تحسّن الأداء وتحسّنت النتائج.', pos: [-0.245, 0.07, 0.12] },
  { t: 'طيران مطابق', wrong: true, n: 'تنشأ التجربة النابضة بالحياة بفعل خداع الحواس ومؤثرات التفاعل الرقمية، لا بتطابق البيئة مع الواقع.', pos: [0.245, 0.07, 0.12] },
];
const LW = 0.21;
const LAB = { size: 58, width: 520, weight: 800, pad: 14 };

export default function build(ctx) {
  const g = new THREE.Group(); g.position.copy(P(meta.center[0], meta.center[1])); g.position.x += 0.03; g.position.z += 0.1; ctx.stage.add(g);
  const rig = new Rig(ctx);
  const cam = ctx.camera, cp = new THREE.Vector3();
  const pool = lightPool(0x45c6ff, 0.36, 0); pool.position.y = 0.004; pool.position.z = 0.02; pool.scale.set(1, 1, 0.7); g.add(pool); rig.fn((p) => { pool.material.opacity = 0.32 * p; }, 0.1, 0.8);

  // headset, resting low in the middle
  const hs = new THREE.Group(); hs.position.set(0, 0.075, 0.1); g.add(hs);
  const shell = new THREE.Mesh(new RoundedBoxGeometry(0.2, 0.1, 0.1, 5, 0.034), glossy(0xf4f6f9, { roughness: 0.2 })); hs.add(shadowed(shell));
  const visor = new THREE.Mesh(new RoundedBoxGeometry(0.19, 0.082, 0.02, 4, 0.028), glossy(0x161b26, { roughness: 0.1 })); visor.position.z = 0.05; hs.add(visor);
  const lenses = [-1, 1].map((s) => { const l = new THREE.Mesh(new THREE.TorusGeometry(0.02, 0.005, 10, 28), new THREE.MeshBasicMaterial({ color: 0x45c6ff, toneMapped: false })); l.position.set(s * 0.04, 0, 0.062); hs.add(l); const gl = glow(0x45c6ff, 0.12, 0.7); gl.position.set(s * 0.04, 0, 0.07); hs.add(gl); return { l, gl }; });
  const strap = new THREE.Mesh(new THREE.TorusGeometry(0.105, 0.011, 10, 40, Math.PI), glossy(0x39414c)); strap.rotation.set(0, Math.PI / 2, 0); strap.position.z = -0.03; hs.add(strap);
  const strap2 = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.009, 10, 40, Math.PI), glossy(0x39414c)); strap2.rotation.set(Math.PI / 2, 0, 0); hs.add(strap2);
  const hRing = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.003, 8, 90), new THREE.MeshBasicMaterial({ color: 0x45c6ff, transparent: true, opacity: 0.6, toneMapped: false })); hRing.rotation.x = Math.PI / 2; hRing.position.y = -0.07; hs.add(hRing);
  const hRing2 = hRing.clone(); hRing2.scale.setScalar(0.7); hRing2.position.y = -0.07; hs.add(hRing2);

  // tiles
  const tiles = T.map((tt, i) => {
    const grp = new THREE.Group(); const [x, y, z] = tt.pos; grp.position.set(x, y, z); g.add(grp);
    const plate = new THREE.Mesh(new RoundedBoxGeometry(LW + 0.02, 0.085, 0.014, 2, 0.007), new THREE.MeshStandardMaterial({ color: 0x45c6ff, emissive: 0x45c6ff, emissiveIntensity: 0.5, roughness: 0.3 }));
    grp.add(plate);
    const lab = sprite(tt.t, LW, { ...LAB, border: '#45c6ff' }); lab.userData.w = LW; lab.position.z = 0.014; grp.add(lab);
    const mark = badge('check', 0x2fa38a, 0.05); mark.position.set(0.1, 0.04, 0.02); mark.visible = false; grp.add(mark);
    return { grp, plate, lab, mark, t: tt, i, state: 0, shake: -9, base: grp.position.clone() };
  });

  let found = 0, now = 0, finished = false, flare = -9;
  const setState = (o, s) => {
    o.state = s; const col = s === 1 ? 0x2fa38a : 0xe0452c;
    o.plate.material.color.setHex(col); o.plate.material.emissive.setHex(col);
    o.mark.material.map = badge(s === 1 ? 'check' : 'x', col, 0.05).material.map; o.mark.material.needsUpdate = true; o.mark.visible = true;
    retext(o.lab, o.t.t, LW, { ...LAB, border: css(col) });
  };
  tiles.forEach((o) => rig.touch(o.grp, (hh) => {
    ctx.sfx.pop?.();
    if (o.t.wrong) {
      if (o.state !== 2) { setState(o, 2); found++; o.shake = now; ctx.sfx.good?.(); ctx.fx.burst(o.grp.position.clone(), 0xe0452c, 30, 0.45, 0.03); hh.on = false; ctx.ui.hud(found < 3 ? `بقي ${3 - found} من الأخطاء` : 'كشفتَ الأخطاء الثلاثة'); }
      ctx.ui.card({ tag: 'عبارة خاطئة', title: 'التصحيح', body: o.t.n, color: 0xe0452c });
      if (found >= 3 && !finished) { finished = true; flare = now; setTimeout(() => { ctx.ui.card({ tag: 'اكتمل الفحص', title: 'كشفتَ الأخطاء الثلاثة', body: 'بيئة المحاكاة تخلق عوالم تولّدها الأرقام والرموز، ولا تطابق الواقع.', color: 0x45c6ff }); ctx.ui.done(); }, 2200); }
    } else {
      if (o.state !== 1) { setState(o, 1); o.shake = now - 0.5; }
      ctx.ui.hud('هذه سليمة، تابع الفحص'); hh.on = false;
      ctx.ui.card({ tag: 'عبارة سليمة', title: 'لا خطأ هنا', body: o.t.n, color: 0x2fa38a });
    }
  }, { color: 0x45c6ff, size: 0.28, at: V(0, 0, 0.02), show: 2.6 + o.i * 0.2 }));
  ctx.ui.hud('اعثر على ثلاث عبارات خاطئة');

  return {
    update(t, dt, e) {
      now = t; rig.update(t, dt, e);
      const hk = stag(t, 0.1, 0.8, easeBack) * e; hs.scale.setScalar(Math.max(hk * 1.05, 0.0001));
      hs.rotation.y = Math.sin(t * 0.7) * 0.5; hs.rotation.x = Math.sin(t * 0.9) * 0.06; hs.position.y = 0.075 + Math.sin(t * 1.2) * 0.012;
      hRing.rotation.z = t * 0.6; hRing2.rotation.z = -t * 0.8;
      const fl = clamp01((now - flare) / 2), fk = flare > 0 ? Math.sin(fl * Math.PI) : 0;
      lenses.forEach((o, i) => { o.gl.material.opacity = (0.55 + 0.2 * Math.sin(t * 2 + i) + fk * 0.6) * hk; o.l.scale.setScalar(1 + fk * 0.6); });
      tiles.forEach((o) => {
        const k = stag(t, 0.5 + o.i * 0.2, 0.7, easeBack) * e;
        o.grp.scale.setScalar(Math.max(k, 0.0001)); o.grp.visible = k > 0.01;
        const sh = clamp01((now - o.shake) / 0.6), amp = o.state === 2 ? (1 - sh) * 0.012 : o.state === 1 ? (1 - sh) * 0.004 : 0;
        o.grp.position.set(o.base.x + Math.sin(t * 60) * amp, o.base.y + (1 - Math.min(k, 1)) * -0.1 + Math.sin(t * 1.2 + o.i * 1.1) * 0.006, o.base.z);
        cam.getWorldPosition(cp); o.grp.lookAt(cp);
        const scan = 0.5 + 0.5 * Math.sin(t * 1.6 - o.i * 0.9);
        o.plate.material.emissiveIntensity = o.state === 0 ? 0.3 + 0.35 * scan : 0.55;
        o.lab.scale.set(o.lab.userData.w * k + 0.0001, o.lab.userData.w * o.lab.userData.aspect * k + 0.0001, 1);
      });
    },
  };
}
