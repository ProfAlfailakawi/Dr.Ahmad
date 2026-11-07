// p255 (round 3): one clear budgeting machine. A gold budget tube drains as you press big pucks; three glass tubes fill toward their gold marks.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { P, ease, easeBack, clamp01, stag, mat, glossy, goldMat, shadowed, glow } from '../../kit.js?v=16';
import { halos, liveTag, motes, canvasTex, blob, TAU, arcPoint, toAr } from '../lib/a4-kit.js?v=16';

export const meta = { free: true, center: [0.5, 0.68], typeLabel: 'لعبة قرار', title: 'وزّع ميزانية التعلم عن بعد' };

const OPTS = [
  { k: 'video', t: 'دروس مسجّلة', cost: 20, fx: [5, 30, 15], c: 0xe0453c },
  { k: 'hub', t: 'مراكز اتصال', cost: 30, fx: [5, 35, 5], c: 0x3a86d6 },
  { k: 'res', t: 'مصادر متنوعة', cost: 25, fx: [20, 15, 20], c: 0xef8f2a },
  { k: 'act', t: 'أنشطة عملية', cost: 25, fx: [25, 0, 20], c: 0x2fb5a8 },
];
const STAT = [
  { n: 'تفاعل', c: 0xef8f2a, ink: '#a8530a', target: 50 },
  { n: 'إتاحة', c: 0x3a86d6, ink: '#1c5497', target: 45 },
  { n: 'جودة', c: 0x5fae3a, ink: '#2f7a18', target: 50 },
];
const VH = 0.32, BUDGET = 100, TUBE_X = [0.27, 0.09, -0.09, -0.27];

function iconTex(op) {
  return canvasTex(256, 256, (c, w, h) => {
    c.clearRect(0, 0, w, h);
    c.strokeStyle = '#fff'; c.fillStyle = '#fff'; c.lineWidth = 15; c.lineCap = 'round'; c.lineJoin = 'round';
    const k = op.k, oy = -28;
    if (k === 'video') { c.beginPath(); c.moveTo(98, 70 + oy + 20); c.lineTo(98, 170 + oy + 20); c.lineTo(180, 120 + oy + 20); c.closePath(); c.fill(); }
    else if (k === 'hub') { c.beginPath(); c.moveTo(128, 64 + 10); c.lineTo(92, 190 + oy + 20); c.moveTo(128, 74); c.lineTo(164, 190 + oy + 20); c.moveTo(104, 150 + oy + 10); c.lineTo(152, 150 + oy + 10); c.stroke(); c.beginPath(); c.arc(128, 66, 12, 0, TAU); c.fill(); }
    else if (k === 'res') { [0, 1, 2].forEach((i) => c.fillRect(74, 52 + i * 38, 108, 28)); }
    else { c.beginPath(); c.moveTo(76, 168); c.lineTo(180, 64); c.stroke(); c.fillRect(170, 48, 28, 28); c.beginPath(); c.moveTo(76, 168); c.lineTo(70, 182); c.stroke(); }
    c.font = '800 78px Tajawal, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.lineWidth = 12; c.strokeStyle = 'rgba(0,0,0,.35)'; c.strokeText(toAr(op.cost), 128, 214); c.fillStyle = '#fff'; c.fillText(toAr(op.cost), 128, 214);
  });
}

export default function build(ctx) {
  const g = new THREE.Group(); g.position.copy(P(meta.center[0], meta.center[1])); ctx.stage.add(g);
  const hal = halos();
  const mo = motes(g, 18, { r: 0.42, h: 0.5, color: 0xfff0c0 });

  // ---- four tall tubes: budget (gold, drains) and three stats (fill)
  const tubes = TUBE_X.map((x, i) => {
    const isB = i === 0, st = isB ? { n: 'الميزانية', c: 0xf2c040, ink: '#8a6208', target: 0 } : STAT[i - 1], z = -0.13;
    const grp = new THREE.Group(); grp.position.set(x, 0, z); g.add(grp);
    const sh = blob(0.09, 0.32); grp.add(sh);
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.062, 0.07, 0.022, 28), glossy(0xe0b85e, { metalness: 0.7, roughness: 0.25 })); cap.position.y = 0.011; grp.add(cap);
    const glass = new THREE.Mesh(new THREE.CylinderGeometry(0.052, 0.052, VH, 32, 1, true), new THREE.MeshPhysicalMaterial({ color: 0xe8f6ff, roughness: 0.05, transparent: true, opacity: 0.2, depthWrite: false, side: THREE.DoubleSide, clearcoat: 1 }));
    glass.position.y = 0.022 + VH / 2; glass.renderOrder = 6; grp.add(glass);
    const liq = new THREE.Mesh(new THREE.CylinderGeometry(0.046, 0.046, VH, 28), new THREE.MeshStandardMaterial({ color: st.c, emissive: st.c, emissiveIntensity: isB ? 0.45 : 0.5, roughness: 0.25, metalness: isB ? 0.5 : 0 }));
    liq.geometry.translate(0, VH / 2, 0); liq.position.y = 0.022; liq.scale.y = 0.001; grp.add(liq);
    const top = new THREE.Mesh(new THREE.CylinderGeometry(0.062, 0.054, 0.018, 28), glossy(0xe0b85e, { metalness: 0.7, roughness: 0.25 })); top.position.y = 0.022 + VH + 0.009; grp.add(top);
    let mark = null, star = null;
    if (!isB) { mark = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.0045, 8, 40), new THREE.MeshBasicMaterial({ color: 0xffd27a, toneMapped: false })); mark.rotation.x = Math.PI / 2; mark.position.y = 0.022 + VH * st.target / 100; grp.add(mark); star = glow(0xffe08a, 0.22, 0); star.position.y = mark.position.y; grp.add(star); }
    const lt = liveTag(0.2, st.c, { size: 54, style: 'halo', ink: st.ink }); lt.set(st.n); g.add(lt.sp); lt.sp.position.set(x, VH + 0.1, z); lt.apply(0);
    shadowed(grp); grp.scale.setScalar(0.0001);
    const o = { st, grp, liq, mark, star, lt, v: isB ? 100 : 0, top: new THREE.Vector3(x, VH + 0.03, z), isB, i };
    ctx.tap(grp, () => ctx.ui.card(isB ? { tag: 'الميزانية', title: 'مئة وحدة فقط', body: 'كل قرار يستهلك جزءاً منها، فاختر ما يحقق الأهداف الثلاثة معاً.', color: 0xd4ad55 } : { tag: 'مستوى مقبول', title: st.n, body: 'يبلغ السائل العلامة الذهبية حين يتحقق المستوى المقبول.', color: st.c }));
    return o;
  });

  // ---- four big pucks
  const tokens = OPTS.map((op, i) => {
    const x = (i - 1.5) * 0.205, z = 0.2;
    const grp = new THREE.Group(); grp.position.set(x, 0, z); g.add(grp);
    const sh = blob(0.12, 0.3); grp.add(sh);
    const up = new THREE.Group(); grp.add(up);
    const puck = new THREE.Mesh(new THREE.CylinderGeometry(0.086, 0.095, 0.05, 44), glossy(op.c, { emissive: op.c, emissiveIntensity: 0.22, clearcoat: 1 })); puck.position.y = 0.025; up.add(puck);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.088, 0.006, 8, 44), goldMat()); rim.rotation.x = Math.PI / 2; rim.position.y = 0.05; up.add(rim);
    const ico = new THREE.Mesh(new THREE.PlaneGeometry(0.15, 0.15), new THREE.MeshBasicMaterial({ map: iconTex(op), transparent: true, toneMapped: false })); ico.rotation.x = -Math.PI / 2; ico.position.y = 0.0515; up.add(ico);
    const hl = hal.add(up, op.c, 0.3, [0, 0.06, 0], 2.4 + i * 0.1);
    shadowed(grp); grp.scale.setScalar(0.0001);
    const t = { op, grp, up, puck, hl, sel: false, lift: 0, shake: 0, pos: grp.position.clone(), i };
    ctx.tap(grp, () => toggle(t)); return t;
  });
  const tag = liveTag(0.25, 0xd4ad55, { size: 58, style: 'halo', ink: '#3a2a10' }); tag.set(OPTS[0].t); g.add(tag.sp); tag.apply(0);
  const pellets = Array.from({ length: 10 }, () => { const s = glow(0xffffff, 0.07, 0); s.renderOrder = 8; g.add(s); return { s, t: 1, from: new THREE.Vector3(), to: new THREE.Vector3() }; });
  let now = 0, spent = 0, finished = false, tagK = 0, tagT = 0, pi = 0; const tagPos = new THREE.Vector3();
  const val = [0, 0, 0];
  const hud = () => ctx.ui.hud(`الباقي ${toAr(BUDGET - spent)}: بلّغ العلامات الثلاث`);
  hud();
  const pel = (from, to, col) => { const p = pellets[pi++ % pellets.length]; p.t = 0; p.from.copy(from); p.to.copy(to); p.s.material.color.setHex(col); };

  function toggle(t) {
    if (now < 2.4 || finished) return;
    if (!t.sel && t.op.cost > BUDGET - spent) { t.shake = 1; ctx.sfx.bad?.(); ctx.ui.toast('الميزانية لا تكفي'); return; }
    t.sel = !t.sel; spent += t.sel ? t.op.cost : -t.op.cost; ctx.sfx.pop?.();
    if (t.sel) { pel(tubes[0].top, new THREE.Vector3(t.pos.x, 0.12, t.pos.z), 0xf2c040); t.op.fx.forEach((v, k) => { if (v > 0) pel(new THREE.Vector3(t.pos.x, 0.14, t.pos.z), tubes[k + 1].top, STAT[k].c); }); }
    t.op.fx.forEach((v, k) => { val[k] += t.sel ? v : -v; });
    tag.set(t.op.t); tagPos.set(t.pos.x, 0.2, t.pos.z + 0.08); tagK = 0; tagT = 1; hud();
    ctx.fx.burst(g.position.clone().add(t.pos).setY(0.1), t.sel ? 0xffd27a : 0xbbbbbb, 10, 0.2, 0.035);
    if (val[0] >= STAT[0].target && val[1] >= STAT[1].target && val[2] >= STAT[2].target && !finished) {
      finished = true;
      setTimeout(() => { ctx.fx.burst(g.position.clone().setY(0.3), 0xffd27a, 54, 0.55, 0.05); ctx.sfx.good?.(); tagT = 0;
        ctx.ui.card({ tag: 'بلغت الأهداف الثلاثة', title: 'مزيج لا قرار واحد', body: 'لا يكفي أن تصل التقنية إلى المناطق البعيدة؛ فالوصول يحتاج مصادر متنوعة وأنشطة تجعل المتعلم محور العملية ومعلمين مؤهلين.', color: 0xd4ad55 }); ctx.ui.hud('حققت التفاعل والإتاحة والجودة'); ctx.ui.done(); }, 900);
    }
  }

  return {
    update(t, dt, e) {
      now = t; hal.update(t, e); mo.update(t, dt, e);
      tubes.forEach((v, i) => {
        v.grp.scale.setScalar(Math.max(0.0001, stag(t, 0.2 + i * 0.15, 0.8, easeBack) * e));
        const target = v.isB ? BUDGET - spent : Math.min(100, val[i - 1]);
        v.v = THREE.MathUtils.damp(v.v, target, 4, dt);
        const fillIn = stag(t, 0.5 + i * 0.15, 1.0);                     // the tubes fill up as the scene builds
        const idle = v.isB ? 0 : (0.1 + 0.05 * Math.sin(t * 1.5 + i)) * (val[i - 1] === 0 ? 1 : 0);
        v.liq.scale.y = Math.max(0.001, ((v.isB ? 0.02 : 0.08) + idle + v.v / 100 * (v.isB ? 0.98 : 0.92)) * fillIn);
        if (!v.isB) { const ok = val[i - 1] >= v.st.target; v.mark.material.color.setHex(ok ? 0x4fd06a : 0xffd27a); v.star.material.opacity = (ok ? 0.8 + 0.2 * Math.sin(t * 5) : 0) * e; }
        v.lt.apply(stag(t, 1.2 + i * 0.12, 0.5, easeBack) * e);
      });
      tokens.forEach((k, i) => {
        const pk = stag(t, 0.6 + i * 0.15, 0.7, easeBack) * e; k.grp.scale.setScalar(Math.max(0.0001, pk));
        k.lift = THREE.MathUtils.damp(k.lift, k.sel ? 1 : 0, 7, dt); k.shake = Math.max(0, k.shake - dt * 3);
        k.up.position.y = k.lift * 0.07 + Math.sin(t * 1.6 + i) * 0.004 + (1 - stag(t, 0.6 + i * 0.15, 0.7)) * 0.25; k.puck.rotation.y += dt * (0.3 + k.lift * 3);
        k.grp.position.x = k.pos.x + Math.sin(t * 60) * 0.008 * k.shake; k.hl.on = k.sel ? 1.6 : 0.8;
      });
      pellets.forEach((p) => { if (p.t < 1) { p.t = Math.min(1, p.t + dt / 0.8); arcPoint(p.s.position, p.from, p.to, ease(p.t), 0.12); p.s.material.opacity = Math.sin(Math.PI * p.t); p.s.scale.setScalar(0.08); } else p.s.material.opacity = 0; });
      tagK = THREE.MathUtils.damp(tagK, tagT, 6, dt); tag.sp.position.copy(tagPos); tag.apply(easeBack(tagK) * e);
    },
  };
}
