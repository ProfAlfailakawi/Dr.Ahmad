// The four door museums in one scene: the page that was recognised picks the door to start with, and four small numbered chips under the cabinet
// switch to any other door. (The chapter-list pages of door 3 and door 4 are almost identical on paper, so the reader can always put it right with one touch.)
import * as THREE from 'three';
import { ease, clamp01, sprite } from '../../kit.js?v=25';
import museum from './museum.js?v=25';

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
  // door chips
  const bar = new THREE.Group(); bar.position.set(cx - 0.5, 0, (cz - 0.5) * (1024 / 838) + 0.57); ctx.stage.add(bar);
  const chips = [1, 2, 3, 4].map((d, i) => {
    const css = '#' + DOOR_COL[i].toString(16).padStart(6, '0');
    const off = sprite(NUM[i], 0.11, { size: 92, weight: 800, bg: 'rgba(252,248,238,.94)', color: '#4a4338', border: css, pad: 22, radius: 60 });
    const on = sprite(NUM[i], 0.11, { size: 92, weight: 800, bg: css, color: '#ffffff', border: '#f3d98a', pad: 22, radius: 60 });
    const grp = new THREE.Group(); grp.position.set((i - 1.5) * 0.125, 0.02, 0); grp.add(off, on); bar.add(grp);
    const hit = new THREE.Mesh(new THREE.SphereGeometry(0.065, 8, 6), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false })); grp.add(hit);
    ctx.tap(hit, () => { ctx.sfx.click?.(); show(d); });
    return { d, off, on, grp };
  });
  function show(d) {
    if (d === cur) return;
    ctx.ui.hideCard(); cur = d;
    if (!slots[d]) make(d);
    Object.entries(slots).forEach(([k, s]) => { s.holder.visible = +k === d; });
  }
  Object.entries(slots).forEach(([k, s]) => { s.holder.visible = +k === cur; });
  return {
    update(t, dt, e) {
      Object.entries(slots).forEach(([k, s]) => { if (+k === cur) s.api.update(t, dt, e); });
      const k = ease(clamp01((t - 1.4) / 0.8)) * e;
      bar.scale.setScalar(Math.max(k, 1e-4));
      chips.forEach((c) => { const a = c.d === cur; c.on.visible = a; c.off.visible = !a; c.grp.position.y = 0.02 + (a ? 0.012 : 0); });
    },
  };
}
