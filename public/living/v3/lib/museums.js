// The four door museums in one scene: the page that was recognised picks the door to start with, and four small numbered chips under the cabinet
// switch to any other door. (The chapter-list pages of door 3 and door 4 are almost identical on paper, so the reader can always put it right with one touch.)
import * as THREE from 'three';
import { ease, clamp01, sprite } from '../../kit.js?v=35';
import museum from './museum.js?v=35';
import portal from './portal.js?v=35';

const NUM = ['١', '٢', '٣', '٤'], DOOR_COL = [0x6b6b3a, 0x7a1f1f, 0x3b7fc4, 0xc46a1d];
export default function museums(ctx, startDoor, meta) {
  const cx = meta?.center?.[0] ?? 0.5, cz = meta?.center?.[1] ?? 0.55;
  const slots = {}; let cur = startDoor;
  const make = (door) => {
    const holder = new THREE.Group(); ctx.stage.add(holder);
    const proxy = Object.create(ctx); proxy.stage = holder;
    slots[door] = { holder, api: museum(proxy, door, meta) };
  };
  make(startDoor);
  // «باب تدخله»: bring the phone close to the museum (or touch the lit door chip) and the door opens in the paper; move back to come out.
  const pw = new THREE.Group(); pw.position.copy(ctx.stage.position); ctx.stage.parent.add(pw);   // outside the scene's fit box
  const at = new THREE.Vector3(cx - 0.5, 0, (cz - 0.5) * (1024 / 838));
  const portals = {};
  const portalOf = (d) => portals[d] || (portals[d] = (() => { const p = portal(ctx, d, DOOR_COL[d - 1], at); pw.add(p.root); return p; })());
  const toggle = (near = false) => { const p = portalOf(cur); byNear = near; if (p.isOpen) { p.exit(); } else { p.enter(); ctx.ui.toast?.('أنت داخل الباب · ابتعد بالجوال لتخرج'); } };
  ctx.stage.userData.enterDoor = () => toggle(false);   // for local checks
  const cw = new THREE.Vector3(), mw = new THREE.Vector3();
  let near = 0, far = 0, hinted = false, shrink = 1, byNear = false;
  // door chips
  const bar = new THREE.Group(); bar.position.set(cx - 0.5, 0, (cz - 0.5) * (1024 / 838) + 0.57); ctx.stage.add(bar);
  const chips = [1, 2, 3, 4].map((d, i) => {
    const css = '#' + DOOR_COL[i].toString(16).padStart(6, '0');
    const off = sprite(NUM[i], 0.11, { size: 92, weight: 800, bg: 'rgba(252,248,238,.94)', color: '#4a4338', border: css, pad: 22, radius: 60 });
    const on = sprite(NUM[i], 0.11, { size: 92, weight: 800, bg: css, color: '#ffffff', border: '#f3d98a', pad: 22, radius: 60 });
    const grp = new THREE.Group(); grp.position.set((i - 1.5) * 0.125, 0.02, 0); grp.add(off, on); bar.add(grp);
    const hit = new THREE.Mesh(new THREE.SphereGeometry(0.065, 8, 6), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false })); grp.add(hit);
    ctx.tap(hit, () => { ctx.sfx.click?.(); if (d === cur) toggle(false); else show(d); });
    return { d, off, on, grp };
  });
  const NAMES = ['الأول', 'الثاني', 'الثالث', 'الرابع'];
  function show(d) {
    if (d === cur) return;
    ctx.retitle?.(`متحف الباب ${NAMES[d - 1]}`);
    ctx.ui.hideCard(); portals[cur]?.exit(); cur = d;
    if (!slots[d]) make(d);
    Object.entries(slots).forEach(([k, s]) => { s.holder.visible = +k === d; });
  }
  Object.entries(slots).forEach(([k, s]) => { s.holder.visible = +k === cur; });
  // The chapter lists of door 3 and door 4 are the same picture; only the small lettering differs. So the scene reads the page itself:
  // on door 3 the first ribbon carries two lines of text and the second one line; on door 4 it is the other way round.
  // When the camera picture is too soft to tell, the last page the reader opened decides (before or after the middle of the two doors).
  const inkSpread = (f, v0, v1) => {
    const cv = f.canvas, g = cv.getContext('2d', { willReadFrequently: true }), NX = 44, NY = 34, lum = [], p = new THREE.Vector3();
    for (let j = 0; j < NY; j++) for (let i = 0; i < NX; i++) {
      p.set(0.34 + (i / (NX - 1)) * 0.34 - 0.5, 0, (v0 + (j / (NY - 1)) * (v1 - v0) - 0.5) * (1024 / 838));
      const q = f.uv(p), x = Math.round(q[0] * cv.width), y = Math.round((1 - q[1]) * cv.height);
      if (x < 0 || y < 0 || x >= cv.width || y >= cv.height) { lum.push(-1); continue; }
      const d = g.getImageData(x, y, 1, 1).data; lum.push(0.3 * d[0] + 0.59 * d[1] + 0.11 * d[2]);
    }
    const ok = lum.filter((v) => v >= 0).sort((a, b) => a - b); if (ok.length < NX * NY * 0.8) return null;
    const med = ok[ok.length >> 1], thr = med * 0.72, rows = [];
    for (let j = 0; j < NY; j++) { let n = 0; for (let i = 0; i < NX; i++) { const v = lum[j * NX + i]; if (v >= 0 && v < thr) n++; } rows.push(n); }
    const total = rows.reduce((a, b) => a + b, 0); if (total < 12) return null;
    let acc = 0, lo = 0, hi = NY - 1;
    for (let j = 0; j < NY; j++) { acc += rows[j]; if (acc >= total * 0.12) { lo = j; break; } }
    acc = 0; for (let j = NY - 1; j >= 0; j--) { acc += rows[j]; if (acc >= total * 0.12) { hi = j; break; } }
    return (hi - lo) / NY;
  };
  let judged = startDoor < 3, judgeAt = 0.35, tries = 0;
  const judge = () => {
    let f = null; try { f = ctx.captureFrame?.(); } catch { f = null; }
    let pick = 0, how = 'none';
    if (f) {
      const a = inkSpread(f, 0.135, 0.265), b = inkSpread(f, 0.265, 0.405);
      if (a !== null && b !== null && Math.abs(a - b) > 0.1) { pick = a > b ? 3 : 4; how = `ink ${a.toFixed(2)}/${b.toFixed(2)}`; }
      f.tex.dispose();
    }
    if (!pick && ++tries < 4) { judgeAt += 0.3; return; }
    if (!pick) { const last = ctx.lastPage?.() || 0; if (last >= 224) { pick = last >= 392 ? 4 : last >= 268 ? 3 : 0; how = `last page ${last}`; } }
    judged = true;
    console.info('[door]', 'recognised', startDoor, '→', pick || startDoor, how);
    if (pick && pick !== cur) show(pick);
  };
  return {
    update(t, dt, e) {
      if (!judged && ctx.mode === 'ar' && t > judgeAt) judge();
      Object.entries(slots).forEach(([k, s]) => { if (+k === cur) s.api.update(t, dt, e); });
      // distance from the phone to the museum, in page widths
      ctx.camera.getWorldPosition(cw); pw.localToWorld(mw.copy(at));
      const dist = mw.distanceTo(cw) / Math.max(1e-6, pw.matrixWorld.getMaxScaleOnAxis());
      const P = portals[cur], isOpen = !!P?.isOpen;
      if (t > 2.5) {
        near = dist < 0.95 ? near + dt : 0; far = dist > 1.45 ? far + dt : 0;
        if (!isOpen && near > 0.5) toggle(true);
        if (isOpen && byNear && far > 0.8) P.exit();
        if (!hinted && t > 3.5) { hinted = true; ctx.ui.toast?.('قرّب الجوال من المتحف لتدخل الباب'); }
      }
      Object.values(portals).forEach((p) => p.update(t, dt));
      shrink = THREE.MathUtils.damp(shrink, portals[cur]?.isOpen ? 0 : 1, 4, dt);
      const hs = slots[cur]?.holder; if (hs) { hs.scale.setScalar(Math.max(shrink, 1e-4)); hs.visible = shrink > 0.01; }
      const k = ease(clamp01((t - 1.4) / 0.8)) * e;
      bar.scale.setScalar(Math.max(k, 1e-4));
      chips.forEach((c) => { const a = c.d === cur; c.on.visible = a; c.off.visible = !a; c.grp.position.y = 0.02 + (a ? 0.012 : 0); });
    },
  };
}
