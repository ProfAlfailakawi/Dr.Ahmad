// p255 (round 2): five big glowing pucks to spend a stack of coins on, until three tall glass vials reach their gold marks.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { P, ease, easeBack, clamp01, stag, mat, glossy, goldMat, shadowed, glow } from '../../kit.js?v=15';
import { halos, liveTag, motes, canvasTex, blob, tagSprite, setSpr, TAU, css, arcPoint, toAr, fitTag } from '../lib/a4-kit.js?v=15';

export const meta = { free: true, center: [0.5, 0.68], typeLabel: 'لعبة قرار', title: 'وزّع ميزانية التعلم عن بعد' };

const OPTS = [
  { k: 'video', t: 'دروس مسجّلة', cost: 20, fx: [5, 30, 15], c: 0xe0453c },
  { k: 'live', t: 'بث مباشر', cost: 35, fx: [30, 10, 20], c: 0x8a63c8 },
  { k: 'hub', t: 'مراكز اتصال', cost: 30, fx: [5, 35, 5], c: 0x3a86d6 },
  { k: 'res', t: 'مصادر متنوعة', cost: 25, fx: [20, 15, 20], c: 0xef8f2a },
  { k: 'act', t: 'أنشطة عملية', cost: 25, fx: [25, 0, 20], c: 0x2fb5a8 },
];
const STAT = [
  { n: 'تفاعل', c: 0xef8f2a, target: 50 },
  { n: 'إتاحة', c: 0x3a86d6, target: 45 },
  { n: 'جودة', c: 0x5fae3a, target: 50 },
];
const VH = 0.3, BUDGET = 100;

function iconTex(op) {
  return canvasTex(256, 256, (c, w, h) => {
    c.fillStyle = 'rgba(0,0,0,0)'; c.clearRect(0, 0, w, h);
    c.strokeStyle = '#fff'; c.fillStyle = '#fff'; c.lineWidth = 16; c.lineCap = 'round'; c.lineJoin = 'round';
    const k = op.k;
    if (k === 'video') { c.beginPath(); c.moveTo(92, 66); c.lineTo(92, 176); c.lineTo(188, 121); c.closePath(); c.fill(); }
    else if (k === 'live') { c.beginPath(); c.arc(128, 128, 18, 0, TAU); c.fill(); [48, 78].forEach((r) => { c.beginPath(); c.arc(128, 128, r, -0.9, 0.9); c.stroke(); c.beginPath(); c.arc(128, 128, r, Math.PI - 0.9, Math.PI + 0.9); c.stroke(); }); }
    else if (k === 'hub') { c.beginPath(); c.moveTo(128, 56); c.lineTo(86, 200); c.moveTo(128, 56); c.lineTo(170, 200); c.moveTo(100, 150); c.lineTo(156, 150); c.stroke(); c.beginPath(); c.arc(128, 52, 12, 0, TAU); c.fill(); }
    else if (k === 'res') { [[70, 60], [100, 100], [130, 140]].forEach(([y], i) => { c.fillRect(66, 64 + i * 46, 124, 34); }); }
    else { c.beginPath(); c.moveTo(70, 190); c.lineTo(190, 70); c.stroke(); c.beginPath(); c.moveTo(70, 190); c.lineTo(66, 200); c.stroke(); c.fillRect(176, 56, 30, 30); }
  });
}

export default function build(ctx) {
  const g = new THREE.Group(); g.position.copy(P(meta.center[0], meta.center[1])); ctx.stage.add(g);
  const hal = halos();
  const mo = motes(g, 20, { r: 0.42, h: 0.5, color: 0xfff0c0 });

  // ---- three tall vials standing right on the print
  const vials = STAT.map((st, i) => {
    const x = (i - 1) * 0.17, z = -0.14;
    const grp = new THREE.Group(); grp.position.set(x, 0, z); g.add(grp);
    const sh = blob(0.09, 0.32); grp.add(sh);
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.058, 0.064, 0.02, 28), glossy(0xe0b85e, { metalness: 0.7, roughness: 0.25 })); cap.position.y = 0.01; grp.add(cap);
    const glass = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, VH, 32, 1, true), new THREE.MeshPhysicalMaterial({ color: 0xe8f6ff, roughness: 0.05, transparent: true, opacity: 0.22, depthWrite: false, side: THREE.DoubleSide, clearcoat: 1 }));
    glass.position.y = 0.02 + VH / 2; glass.renderOrder = 6; grp.add(glass);
    const liq = new THREE.Mesh(new THREE.CylinderGeometry(0.044, 0.044, VH, 28), new THREE.MeshStandardMaterial({ color: st.c, emissive: st.c, emissiveIntensity: 0.5, roughness: 0.25 }));
    liq.geometry.translate(0, VH / 2, 0); liq.position.y = 0.02; liq.scale.y = 0.001; grp.add(liq);
    const top = new THREE.Mesh(new THREE.CylinderGeometry(0.058, 0.052, 0.016, 28), glossy(0xe0b85e, { metalness: 0.7, roughness: 0.25 })); top.position.y = 0.02 + VH + 0.008; grp.add(top);
    const mark = new THREE.Mesh(new THREE.TorusGeometry(0.058, 0.0045, 8, 40), new THREE.MeshBasicMaterial({ color: 0xffd27a, toneMapped: false })); mark.rotation.x = Math.PI / 2; mark.position.y = 0.02 + VH * st.target / 100; grp.add(mark);
    const star = glow(0xffe08a, 0.2, 0); star.position.y = mark.position.y; grp.add(star);
    const lt = liveTag(0.2, st.c, { size: 62, style: 'solid' }); lt.set(st.n, st.c); g.add(lt.sp); lt.sp.position.set(x, VH + 0.1, z); lt.apply(0);
    shadowed(grp); grp.scale.setScalar(0.0001);
    const o = { st, grp, liq, mark, star, lt, v: 0, top: new THREE.Vector3(x, VH + 0.03, z), ok: false, i };
    ctx.tap(grp, () => ctx.ui.card({ tag: 'مستوى مقبول', title: st.n, body: 'يبلغ السائل العلامة الذهبية حين يتحقق المستوى المقبول.', color: st.c }));
    return o;
  });

  // ---- coin tower (budget) at the right
  const COINS = 20, coinMat = mat(0xf2c040, { metalness: 0.35, roughness: 0.3, emissive: 0x8a6a10, emissiveIntensity: 0.25 });
  const coins = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.04, 0.04, 0.012, 32), coinMat, COINS);
  coins.castShadow = true; coins.position.set(0.355, 0, -0.14); g.add(coins);
  const cbs = blob(0.08, 0.3); cbs.position.set(0.355, 0.0015, -0.14); g.add(cbs);
  const coinK = new Float32Array(COINS).fill(0);
  const mtx = new THREE.Matrix4(), sc = new THREE.Vector3(), qq = new THREE.Quaternion(), pp = new THREE.Vector3();
  const hit = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.26, 12), new THREE.MeshBasicMaterial({ visible: false })); hit.position.y = 0.13; coins.add(hit);
  ctx.tap(coins, () => ctx.ui.card({ tag: 'الميزانية', title: 'ميزانية محدودة', body: 'مئة وحدة فقط؛ كل قرار يستهلك جزءاً منها، فاختر ما يحقق الأهداف الثلاثة معاً.', color: 0xd4ad55 }));

  // ---- five big pucks in a front row
  const tokens = OPTS.map((op, i) => {
    const x = (i - 2) * 0.165, z = 0.2 + Math.abs(i - 2) * 0.0;
    const grp = new THREE.Group(); grp.position.set(x, 0, z); g.add(grp);
    const sh = blob(0.1, 0.3); grp.add(sh);
    const up = new THREE.Group(); up.position.y = 0.0; grp.add(up);
    const puck = new THREE.Mesh(new THREE.CylinderGeometry(0.072, 0.08, 0.04, 40), glossy(op.c, { emissive: op.c, emissiveIntensity: 0.2, clearcoat: 1 })); puck.position.y = 0.02; up.add(puck);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.074, 0.005, 8, 40), goldMat()); rim.rotation.x = Math.PI / 2; rim.position.y = 0.04; up.add(rim);
    const ico = new THREE.Mesh(new THREE.PlaneGeometry(0.1, 0.1), new THREE.MeshBasicMaterial({ map: iconTex(op), transparent: true, toneMapped: false })); ico.rotation.x = -Math.PI / 2; ico.position.y = 0.0415; up.add(ico);
    // price: coin stack standing beside
    const pr = new THREE.Group(); pr.position.set(0.05, 0, 0.085); up.add(pr);
    for (let c = 0; c < op.cost / 5; c++) { const cn = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.005, 16), coinMat); cn.position.y = 0.0025 + c * 0.0053; pr.add(cn); }
    const hl = hal.add(up, op.c, 0.26, [0, 0.05, 0], 2.8 + i * 0.1);
    shadowed(grp); grp.scale.setScalar(0.0001);
    const t = { op, grp, up, puck, hl, sel: false, lift: 0, shake: 0, pos: grp.position.clone(), i };
    ctx.tap(grp, () => toggle(t)); return t;
  });
  const tag = liveTag(0.25, 0xd4ad55, { size: 62 }); tag.set(OPTS[0].t); g.add(tag.sp); tag.apply(0);
  const pellets = Array.from({ length: 9 }, () => { const s = glow(0xffffff, 0.06, 0); s.renderOrder = 8; g.add(s); return { s, t: 1, from: new THREE.Vector3(), to: new THREE.Vector3() }; });
  let now = 0, spent = 0, finished = false, tagK = 0, tagT = 0, pi = 0; const tagPos = new THREE.Vector3();
  const val = [0, 0, 0];
  const hud = () => ctx.ui.hud(`الباقي ${toAr(BUDGET - spent)}: بلّغ العلامات الثلاث`);
  hud();

  function toggle(t) {
    if (now < 2.8 || finished) return;
    if (!t.sel && t.op.cost > BUDGET - spent) { t.shake = 1; ctx.sfx.bad?.(); ctx.ui.toast('الميزانية لا تكفي'); return; }
    t.sel = !t.sel; spent += t.sel ? t.op.cost : -t.op.cost; ctx.sfx.pop?.();
    t.op.fx.forEach((v, k) => { val[k] += t.sel ? v : -v; if (t.sel && v > 0) { const p = pellets[pi++ % pellets.length]; p.t = 0; p.from.copy(t.grp.position).setY(0.14); p.to.copy(vials[k].top); p.s.material.color.setHex(STAT[k].c); } });
    tag.set(t.op.t, t.op.c); tagPos.copy(t.grp.position); tagPos.y += 0.2; tagPos.z += 0.08; tagK = 0; tagT = 1; hud();
    ctx.fx.burst(g.position.clone().add(t.grp.position).setY(0.1), t.sel ? 0xffd27a : 0xbbbbbb, 10, 0.2, 0.035);
    if (val[0] >= STAT[0].target && val[1] >= STAT[1].target && val[2] >= STAT[2].target && !finished) {
      finished = true;
      setTimeout(() => { ctx.fx.burst(g.position.clone().setY(0.3), 0xffd27a, 54, 0.55, 0.05); ctx.sfx.good?.(); tagT = 0;
        ctx.ui.card({ tag: 'بلغت الأهداف الثلاثة', title: 'مزيج لا قرار واحد', body: 'لا يكفي أن تصل التقنية إلى المناطق البعيدة؛ فالوصول يحتاج مصادر متنوعة وأنشطة تجعل المتعلم محور العملية ومعلمين مؤهلين.', color: 0xd4ad55 }); ctx.ui.hud('حققت التفاعل والإتاحة والجودة'); ctx.ui.done(); }, 900);
    }
  }

  return {
    update(t, dt, e) {
      now = t; hal.update(t, e); mo.update(t, dt, e);
      const remainCoins = (BUDGET - spent) / 5;
      for (let i = 0; i < COINS; i++) {
        const born = stag(t, 0.3 + i * 0.05, 0.4, easeBack);
        coinK[i] = THREE.MathUtils.damp(coinK[i], i < remainCoins ? 1 : 0, 9, dt);
        const k = Math.max(0.0001, coinK[i] * born * e); pp.set(0, 0.006 + i * 0.0125 + (1 - k) * 0.03 + (1 - born) * 0.2, 0); sc.set(k, k, k); mtx.compose(pp, qq, sc); coins.setMatrixAt(i, mtx);
      }
      coins.instanceMatrix.needsUpdate = true; cbs.material.opacity = 0.3 * e;
      vials.forEach((v, i) => {
        const gk = stag(t, 0.4 + i * 0.2, 0.8, easeBack) * e; v.grp.scale.setScalar(Math.max(0.0001, gk));
        v.v = THREE.MathUtils.damp(v.v, Math.min(100, val[i]), 4, dt);
        // while idle the vials breathe a little so the scene is alive from the first second
        const idle = (0.1 + 0.05 * Math.sin(t * 1.5 + i)) * (val[i] === 0 ? 1 : 0);
        v.liq.scale.y = Math.max(0.001, (0.08 + idle + v.v / 100 * 0.92) * stag(t, 0.8 + i * 0.2, 0.9));
        const ok = val[i] >= v.st.target; v.ok = ok; v.mark.material.color.setHex(ok ? 0x4fd06a : 0xffd27a);
        v.star.material.opacity = (ok ? 0.8 + 0.2 * Math.sin(t * 5) : 0) * e; v.lt.apply(stag(t, 1.4 + i * 0.15, 0.5, easeBack) * e);
      });
      tokens.forEach((k, i) => {
        const pk = stag(t, 0.9 + i * 0.18, 0.7, easeBack) * e; k.grp.scale.setScalar(Math.max(0.0001, pk));
        k.lift = THREE.MathUtils.damp(k.lift, k.sel ? 1 : 0, 7, dt); k.shake = Math.max(0, k.shake - dt * 3);
        k.up.position.y = k.lift * 0.06 + Math.sin(t * 1.6 + i) * 0.004 + (1 - stag(t, 0.9 + i * 0.18, 0.7)) * 0.2; k.puck.rotation.y += dt * (0.3 + k.lift * 3);
        k.grp.position.x = k.pos.x + Math.sin(t * 60) * 0.008 * k.shake; k.hl.on = k.sel ? 1.6 : 0.8;
      });
      pellets.forEach((p) => { if (p.t < 1) { p.t = Math.min(1, p.t + dt / 0.8); arcPoint(p.s.position, p.from, p.to, ease(p.t), 0.12); p.s.material.opacity = Math.sin(Math.PI * p.t); p.s.scale.setScalar(0.07); } else p.s.material.opacity = 0; });
      tagK = THREE.MathUtils.damp(tagK, tagT, 6, dt); tag.sp.position.copy(tagPos); tag.apply(easeBack(tagK) * e);
    },
  };
}
