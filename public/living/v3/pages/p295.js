import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { P, ease, easeBack, clamp01, stag, mat, glossy, goldMat, shadowed, glow, sprite } from '../../kit.js?v=15';
import { Rig, badge, retext, V, TAU, css } from '../lib/a5-kit.js?v=15';
import { lightPool } from '../../v2/common.js?v=15';

export const meta = { free: true, center: [0.36, 0.28], typeLabel: 'لعبة: اكتشاف الخطأ' };

const T = [
  { t: 'ردود لمسية', wrong: false, n: 'قوة ردود الفعل اللمسية تتميز بقدرتها على إيجاد الشعور بالظروف البيئية الحقيقية.' },
  { t: 'محاكاة مطابقة', wrong: true, n: 'بيئة المحاكاة لا يمكن أن تشبه العالم الحقيقي؛ فهي تخلق عوالم وهمية تولّدها الأرقام والرموز.' },
  { t: 'بلا إنترنت', wrong: true, n: 'التعليم الافتراضي يتيح التواصل والحصول على المعلومات والتدريب عن طريق شبكة الإنترنت.' },
  { t: 'حضور عن بعد', wrong: false, n: 'يتحقق الحضور عن بعد بأجهزة الإدخال القياسية أو بأجهزة متعددة الوسائط كمجسات الحركة والقفازات.' },
  { t: 'طيران مطابق', wrong: true, n: 'تنشأ التجربة النابضة بالحياة بفعل خداع الحواس ومؤثرات التفاعل الرقمية، لا بتطابق البيئة مع الواقع.' },
  { t: 'أداء أفضل', wrong: false, n: 'كلما زادت التجربة في التعليم الافتراضي تحسّن الأداء وتحسّنت النتائج.' },
];
const POS = [[-0.23, 0.17, -0.03], [0, 0.17, -0.03], [-0.23, 0.07, 0.14], [0.23, 0.17, -0.03], [0, 0.07, 0.14], [0.23, 0.07, 0.14]];
const ORDER = [0, 1, 2, 3, 4, 5];

export default function build(ctx) {
  const g = new THREE.Group(); g.position.copy(P(meta.center[0], meta.center[1])); g.scale.setScalar(1.0); g.position.x += 0.03; ctx.stage.add(g);
  const rig = new Rig(ctx);
  const pool = lightPool(0x45c6ff, 0.34, 0); pool.position.y = 0.004; g.add(pool); rig.fn((p) => { pool.material.opacity = 0.34 * p; }, 0.1, 1);
  const cam = ctx.camera, cp = new THREE.Vector3();

  // headset
  const hs = new THREE.Group(); hs.position.y = 0.36; g.add(hs);
  const shell = new THREE.Mesh(new RoundedBoxGeometry(0.2, 0.1, 0.1, 5, 0.034), glossy(0xf4f6f9, { roughness: 0.2 })); hs.add(shadowed(shell));
  const visor = new THREE.Mesh(new RoundedBoxGeometry(0.19, 0.082, 0.02, 4, 0.028), glossy(0x161b26, { roughness: 0.1 })); visor.position.z = 0.05; hs.add(visor);
  const lensMat = new THREE.MeshBasicMaterial({ color: 0x45c6ff, toneMapped: false });
  const lenses = [-1, 1].map((s) => { const l = new THREE.Mesh(new THREE.TorusGeometry(0.02, 0.005, 10, 28), lensMat.clone()); l.position.set(s * 0.04, 0, 0.062); hs.add(l); const gl = glow(0x45c6ff, 0.11, 0.7); gl.position.set(s * 0.04, 0, 0.07); hs.add(gl); return { l, gl }; });
  const strap = new THREE.Mesh(new THREE.TorusGeometry(0.105, 0.011, 10, 40, Math.PI), glossy(0x39414c)); strap.rotation.set(0, Math.PI / 2, 0); strap.position.z = -0.03; hs.add(strap);
  const strap2 = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.009, 10, 40, Math.PI), glossy(0x39414c)); strap2.rotation.set(Math.PI / 2, 0, 0); strap2.position.set(0, 0, -0.0); hs.add(strap2);
  const hRing = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.0025, 8, 90), new THREE.MeshBasicMaterial({ color: 0x45c6ff, transparent: true, opacity: 0.6, toneMapped: false })); hRing.rotation.x = Math.PI / 2; hRing.position.y = 0.0; hs.add(hRing);
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.15, 0.3, 40, 1, true), new THREE.MeshBasicMaterial({ color: 0x45c6ff, transparent: true, opacity: 0.1, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false })); beam.position.y = 0.16; g.add(beam);
  const scan = new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.003, 8, 120), new THREE.MeshBasicMaterial({ color: 0x45c6ff, transparent: true, opacity: 0.5, toneMapped: false, depthWrite: false, blending: THREE.AdditiveBlending })); scan.rotation.x = Math.PI / 2; g.add(scan);

  // tiles
  const tiles = T.map((tt, i) => {
    const grp = new THREE.Group(); const [x, y, z] = POS[i];
    grp.position.set(x, y + 0.04, z); g.add(grp);
    const plate = new THREE.Mesh(new RoundedBoxGeometry(0.215, 0.068, 0.012, 2, 0.006), new THREE.MeshStandardMaterial({ color: 0x45c6ff, emissive: 0x45c6ff, emissiveIntensity: 0.5, roughness: 0.3 }));
    grp.add(plate);
    const lab = sprite(tt.t, 0.2, { size: 62, width: 440, weight: 800, border: '#45c6ff', pad: 14 }); lab.userData.w = 0.2; lab.position.z = 0.012; grp.add(lab);
    const mark = badge('check', 0x2fa38a, 0.04); mark.position.set(0.1, 0.03, 0.02); mark.visible = false; grp.add(mark);
    return { grp, plate, lab, mark, t: tt, i, state: 0, shake: -9, base: grp.position.clone(), seen: false };
  });

  let found = 0, tried = 0, now = 0, finished = false, flare = -9;
  const setState = (o, s) => {
    o.state = s; const col = s === 1 ? 0x2fa38a : 0xe0452c;
    o.plate.material.color.setHex(col); o.plate.material.emissive.setHex(col);
    o.mark.material.map?.dispose?.(); o.mark.material.map = badge(s === 1 ? 'check' : 'x', col, 0.04).material.map; o.mark.material.needsUpdate = true; o.mark.visible = true;
    retext(o.lab, o.t.t, 0.2, { size: 62, width: 440, weight: 800, border: css(col), pad: 18 });
  };
  tiles.forEach((o) => rig.touch(o.grp, (hh) => {
    ctx.sfx.pop?.();
    if (o.t.wrong) {
      if (o.state !== 2) { setState(o, 2); found++; o.shake = now; ctx.sfx.good?.(); ctx.fx.burst(o.grp.position.clone(), 0xe0452c, 30, 0.45, 0.03); hh.on = false; ctx.ui.hud(found < 3 ? `بقي ${3 - found} من الأخطاء` : 'كشفتَ الأخطاء الثلاثة'); }
      ctx.ui.card({ tag: 'عبارة خاطئة', title: 'التصحيح', body: o.t.n, color: 0xe0452c });
      if (found >= 3 && !finished) { finished = true; flare = now; setTimeout(() => { ctx.ui.card({ tag: 'اكتمل الفحص', title: 'كشفتَ الأخطاء الثلاثة', body: 'بيئة المحاكاة تخلق عوالم تولّدها الأرقام والرموز، ولا تطابق الواقع.', color: 0x45c6ff }); ctx.ui.done(); }, 2200); }
    } else {
      if (o.state !== 1) { setState(o, 1); o.shake = now - 0.5; tried++; }
      ctx.ui.hud('هذه سليمة، تابع الفحص'); hh.on = false;
      ctx.ui.card({ tag: 'عبارة سليمة', title: 'لا خطأ هنا', body: o.t.n, color: 0x2fa38a });
    }
  }, { color: 0x45c6ff, size: 0.26, at: V(0, 0, 0.02), show: 3 + o.i * 0.2 }));
  ctx.ui.hud('اعثر على ثلاث عبارات خاطئة');

  return {
    update(t, dt, e) {
      now = t; rig.update(t, dt, e);
      const hk = stag(t, 0.2, 0.9, easeBack) * e; hs.scale.setScalar(Math.max(hk * 1.25, 0.0001));
      hs.rotation.y = Math.sin(t * 0.6) * 0.45; hs.rotation.x = Math.sin(t * 0.8) * 0.06; hs.position.y = 0.36 + Math.sin(t * 1.1) * 0.01;
      hRing.rotation.z = t * 0.5;
      const fl = clamp01((now - flare) / 2) , fk = flare > 0 ? Math.sin(fl * Math.PI) : 0;
      lenses.forEach((o, i) => { o.gl.material.opacity = (0.55 + 0.2 * Math.sin(t * 2 + i) + fk * 0.6) * hk; o.l.scale.setScalar(1 + fk * 0.6); });
      beam.material.opacity = (0.08 + 0.04 * Math.sin(t * 1.5) + fk * 0.15) * hk; beam.scale.set(1 + fk * 0.4, 1, 1 + fk * 0.4);
      const sy = ((t * 0.18) % 1); scan.position.y = 0.02 + sy * 0.34; scan.material.opacity = 0.5 * Math.sin(sy * Math.PI) * stag(t, 1, 1) * e; scan.scale.setScalar(0.85 + 0.15 * Math.sin(t));
      tiles.forEach((o) => {
        const k = stag(t, 1.0 + o.i * 0.25, 0.8, easeBack) * e;
        o.grp.scale.setScalar(Math.max(k, 0.0001)); o.grp.visible = k > 0.01;
        const sh = clamp01((now - o.shake) / 0.6), amp = o.state === 2 ? (1 - sh) * 0.012 : o.state === 1 ? (1 - sh) * 0.004 : 0;
        o.grp.position.set(o.base.x + Math.sin(t * 60) * amp, o.base.y + Math.sin(t * 1.2 + o.i * 1.1) * 0.006, o.base.z);
        cam.getWorldPosition(cp); o.grp.lookAt(cp);
        const gl = o.state === 0 ? 0.35 + 0.25 * Math.max(0, 1 - Math.abs(scan.position.y - o.base.y) * 14) : 0.55;
        o.plate.material.emissiveIntensity = gl;
        const lk = k; o.lab.scale.set(o.lab.userData.w * lk, o.lab.userData.w * o.lab.userData.aspect * lk, 1);
      });
    },
  };
}
