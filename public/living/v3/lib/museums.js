// The four door museums in one scene: the page that was recognised picks the door to start with, and four small numbered chips under the cabinet
// switch to any other door. (The chapter-list pages of door 3 and door 4 are almost identical on paper, so the reader can always put it right with one touch.)
import * as THREE from 'three';
import { ease, clamp01, sprite } from '../../kit.js?v=28';
import museum from './museum.js?v=28';
import portal from './portal.js?v=28';

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
  function show(d) {
    if (d === cur) return;
    ctx.ui.hideCard(); portals[cur]?.exit(); cur = d;
    if (!slots[d]) make(d);
    Object.entries(slots).forEach(([k, s]) => { s.holder.visible = +k === d; });
  }
  Object.entries(slots).forEach(([k, s]) => { s.holder.visible = +k === cur; });
  return {
    update(t, dt, e) {
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
