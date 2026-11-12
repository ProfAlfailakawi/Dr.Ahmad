// portal — «باب تدخله»: two leaves of a door open in the paper itself and the reader looks down into a deep hall cut into the book.
// The walls carry the door's pages in frames: discovered pages in full colour, the others still in shadow. A gold seal glows at the bottom.
// The hole is real depth: an invisible mask writes depth over the paper around the opening, so the hall shows only through the opening.
import * as THREE from 'three';
import { ease, easeBack, clamp01, glow, sprite } from '../../kit.js?v=29';

const W = 0.5, D = 0.6, DEPTH = 0.85;
const AR = (n) => String(n).replace(/[0-9]/g, (d) => '٠١٢٣٤٥٦٧٨٩'[d]);

function gradientWall(w, h, top, bottom) {
  const geo = new THREE.PlaneGeometry(w, h, 1, 10), col = [], pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) { const k = (pos.getY(i) + h / 2) / h, c = new THREE.Color(bottom).lerp(new THREE.Color(top), Math.pow(k, 1.6)); col.push(c.r, c.g, c.b); }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  return geo;
}

export default function portal(ctx, door, color, at) {
  const doorCol = new THREE.Color(color);
  const root = new THREE.Group(); root.position.copy(at); root.visible = false;
  // ---- the mask around the opening (depth only, invisible)
  const shape = new THREE.Shape([new THREE.Vector2(-3, -3), new THREE.Vector2(3, -3), new THREE.Vector2(3, 3), new THREE.Vector2(-3, 3)]);
  shape.holes.push(new THREE.Path([new THREE.Vector2(-W / 2, -D / 2), new THREE.Vector2(-W / 2, D / 2), new THREE.Vector2(W / 2, D / 2), new THREE.Vector2(W / 2, -D / 2)]));
  const maskGeo = new THREE.ShapeGeometry(shape); maskGeo.rotateX(-Math.PI / 2);
  const mask = new THREE.Mesh(maskGeo, new THREE.MeshBasicMaterial({ colorWrite: false })); mask.position.y = 0.0004; mask.renderOrder = -20; root.add(mask);

  // ---- the hall
  const hall = new THREE.Group(); root.add(hall);
  const top = new THREE.Color(doorCol).multiplyScalar(0.75).lerp(new THREE.Color(0x2a2418), 0.35), bottom = new THREE.Color(0x05060a);
  const wm = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide });
  const walls = [
    [W, [0, -DEPTH / 2, -D / 2], 0],             // far
    [D, [-W / 2, -DEPTH / 2, 0], Math.PI / 2],   // left
    [D, [W / 2, -DEPTH / 2, 0], -Math.PI / 2],   // right
    [W, [0, -DEPTH / 2, D / 2], Math.PI],        // near
  ].map(([w, p, ry]) => { const m = new THREE.Mesh(gradientWall(w, DEPTH, top, bottom), wm); m.position.set(...p); m.rotation.y = ry; hall.add(m); return m; });
  void walls;
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(W, D), new THREE.MeshBasicMaterial({ color: 0x06070b })); floor.rotation.x = -Math.PI / 2; floor.position.y = -DEPTH; hall.add(floor);
  // gold rails down the corners and rings of light at each level
  const gold = new THREE.MeshBasicMaterial({ color: 0xd9b25a });
  for (const [x, z] of [[-W / 2, -D / 2], [W / 2, -D / 2], [-W / 2, D / 2], [W / 2, D / 2]]) { const r = new THREE.Mesh(new THREE.BoxGeometry(0.008, DEPTH, 0.008), gold); r.position.set(x, -DEPTH / 2, z); hall.add(r); }
  const rimGeo = new THREE.EdgesGeometry(new THREE.BoxGeometry(W, 0.001, D));
  [0, 0.2, 0.4, 0.6].forEach((y, i) => { const l = new THREE.LineSegments(rimGeo, new THREE.LineBasicMaterial({ color: 0xf0c45c, transparent: true, opacity: 0.9 - i * 0.18 })); l.position.y = -y - 0.001; hall.add(l); });
  // the seal at the bottom
  const seal = sprite(AR(door), 0.16, { size: 120, weight: 800, bg: 'rgba(0,0,0,0)', color: '#f5cf6b', pad: 8, shadow: false });
  seal.position.set(0, -DEPTH + 0.08, 0); hall.add(seal);
  const sealGlow = glow(0xffc55a, 0.55, 0.9); sealGlow.position.set(0, -DEPTH + 0.02, 0); hall.add(sealGlow);
  const shaftGlow = glow(doorCol.getHex(), 0.9, 0.35); shaftGlow.position.set(0, -DEPTH * 0.55, 0); hall.add(shaftGlow);

  // ---- the frames: the door's pages on three walls, row after row going down
  const pages = ctx.doorPages(door) || [];
  const FW = 0.088, FH = 0.108, frames = [];
  const slots = [];
  for (let row = 0; row < 6; row++) {
    const y = -0.11 - row * 0.13;
    for (let i = 0; i < 4; i++) slots.push({ p: [-W / 2 + 0.002, y, -D / 2 + 0.09 + i * 0.14], ry: Math.PI / 2 });
    for (let i = 0; i < 3; i++) slots.push({ p: [-W / 2 + 0.11 + i * 0.14, y, -D / 2 + 0.002], ry: 0 });
    for (let i = 0; i < 4; i++) slots.push({ p: [W / 2 - 0.002, y, -D / 2 + 0.09 + i * 0.14], ry: -Math.PI / 2 });
  }
  const back = new THREE.MeshBasicMaterial({ color: 0xd4ad55 }), backDim = new THREE.MeshBasicMaterial({ color: 0x5a5040 });
  pages.slice(0, slots.length).forEach((p, i) => {
    const s = slots[i], f = new THREE.Group(); f.position.set(...s.p); f.rotation.y = s.ry; hall.add(f);
    const b = new THREE.Mesh(new THREE.PlaneGeometry(FW + 0.012, FH + 0.012), p.found ? back : backDim); b.position.z = 0.001; f.add(b);
    const pic = new THREE.Mesh(new THREE.PlaneGeometry(FW, FH), new THREE.MeshBasicMaterial({ color: p.found ? 0xffffff : 0x3a3f50 })); pic.position.z = 0.002; f.add(pic);
    frames.push({ p, pic, f });
    ctx.tap(pic, () => {
      ctx.sfx.pop?.();
      ctx.ui.card({ tag: p.found ? 'اكتشفتها' : 'تنتظرك', title: p.title, body: p.found ? 'معلّقة على جدار هذا الباب، بين صفحاته التي عاشت أمامك.' : 'ما زالت في الظل. اكتشفها في الكتاب، وستضيء هنا في مكانها.', color: p.found ? 0xd4ad55 : 0x8a93ad });
    });
  });
  let loaded = false;
  const loadPictures = () => {
    if (loaded) return; loaded = true;
    const L = new THREE.TextureLoader();
    frames.forEach(({ p, pic }) => {
      if (!p.page) return;
      L.load(ctx.asset(`thumbs/${p.page}.jpg`), (tex) => { tex.colorSpace = THREE.SRGBColorSpace; pic.material.map = tex; pic.material.needsUpdate = true; }, undefined, () => {});
    });
  };

  // ---- the two leaves of the door, in the door's colour with a gold edge; they open upward and lean back
  const leafMat = new THREE.MeshStandardMaterial({ color: doorCol.clone().multiplyScalar(0.8), roughness: 0.45, metalness: 0.2 });
  const edge = new THREE.LineBasicMaterial({ color: 0xf0c45c });
  const leaves = [-1, 1].map((sd) => {
    const hinge = new THREE.Group(); hinge.position.set(sd * W / 2, 0.004, 0); root.add(hinge);
    const geo = new THREE.BoxGeometry(W / 2, 0.008, D);
    const m = new THREE.Mesh(geo, leafMat); m.position.x = -sd * W / 4; hinge.add(m);
    const e = new THREE.LineSegments(new THREE.EdgesGeometry(geo), edge); e.position.copy(m.position); hinge.add(e);
    const knob = new THREE.Mesh(new THREE.SphereGeometry(0.012, 12, 8), new THREE.MeshStandardMaterial({ color: 0xe8c063, metalness: 0.8, roughness: 0.25 })); knob.position.set(-sd * (W / 2 - 0.03), 0.008, 0); hinge.add(knob);
    return { hinge, sd };
  });
  const found = pages.filter((p) => p.found).length;
  const label = sprite(`الباب ${AR(door)}: ${AR(found)} من ${AR(pages.length)}`, 0.3, { size: 54, weight: 800, bg: 'rgba(14,20,38,.9)', color: '#f4d98a', border: '#d4ad55', pad: 16, radius: 30, shadow: false });
  label.position.set(0, 0.06, D / 2 + 0.06); root.add(label);

  let open = 0, target = 0;
  return {
    root,
    get isOpen() { return target === 1; },
    enter() { if (target === 1) return; target = 1; loadPictures(); ctx.sfx.whoosh?.(); ctx.sfx.signature?.(door); },
    exit() { if (target === 0) return; target = 0; ctx.sfx.whoosh?.(); },
    update(t, dt) {
      open = THREE.MathUtils.damp(open, target, target ? 2.2 : 3.5, dt);
      root.visible = open > 0.002;
      if (!root.visible) return;
      const k = ease(clamp01(open * 1.15));
      leaves.forEach(({ hinge, sd }) => { hinge.rotation.z = -sd * k * Math.PI * 0.6; });
      hall.position.y = -0.02 * (1 - k); hall.scale.set(1, Math.max(k, 0.01), 1);
      seal.material.opacity = k; sealGlow.material.opacity = 0.9 * k * (0.8 + 0.2 * Math.sin(t * 2.4)); shaftGlow.material.opacity = 0.35 * k;
      label.material.opacity = easeBack(clamp01((open - 0.5) * 2)); label.visible = open > 0.5;
      frames.forEach(({ f }, i) => { f.scale.setScalar(Math.max(1e-4, ease(clamp01(open * 1.6 - 0.4 - i * 0.008)))); });
    },
  };
}
