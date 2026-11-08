// museum — «متحف الباب»: a smoked-glass dome on a gold-and-door-coloured plinth. Every live page of the door floats inside as one small gem on a spiral:
// discovered pages blaze in their own colour, pages still waiting are ghosts of glass. A heart of light in the middle grows with the progress.
import * as THREE from 'three';
import { ease, easeBack, clamp01, stag, glow, glowTexture, sprite } from '../../kit.js?v=27';
import { lathe, std, brass, add, grp, blob, TAU } from './a2.js?v=27';

const DOOR_COL = { 1: 0x6b6b3a, 2: 0x7a1f1f, 3: 0x3b7fc4, 4: 0xc46a1d };
const AR = (n) => String(n).replace(/[0-9]/g, (d) => '٠١٢٣٤٥٦٧٨٩'[d]);
const GA = Math.PI * (3 - Math.sqrt(5));

export default function museum(ctx, door, meta) {
  const pages = ctx.doorPages(door) || [], n = pages.length;
  const found = pages.filter((p) => p.found).length, frac = n ? found / n : 0, all = n > 0 && found === n;
  const doorCol = new THREE.Color(DOOR_COL[door] || 0xd4ad55);
  const g = new THREE.Group(); ctx.stage.add(g);
  const cx = meta?.center?.[0] ?? 0.5, cz = meta?.center?.[1] ?? 0.55;
  g.position.set(cx - 0.5, 0, (cz - 0.5) * (1024 / 838));
  blob(g, 0.62, 0.62, 0.34);

  // ---- plinth: a velvet tray in the door's colour, gold-trimmed, closed underneath ----
  const BASE = 0.065, R = 0.31, DR = 0.285, DH = 0.62, RM = 0.232;
  const body = new THREE.Color(doorCol).multiplyScalar(0.55), velvet = new THREE.Color(doorCol).multiplyScalar(0.12).lerp(new THREE.Color(0x0a0c14), 0.6);
  add(g, lathe([[0, 0], [R * 0.9, 0], [R * 0.97, 0.008], [R * 1.04, 0.022], [R * 1.02, 0.05], [R * 0.99, BASE - 0.004]], 80), std(body, { roughness: 0.38, metalness: 0.25 }), 0, 0, 0, true);
  const tray = add(g, new THREE.CylinderGeometry(R * 0.985, R * 0.985, 0.004, 80), std(velvet, { roughness: 0.9 }), 0, BASE - 0.002, 0);
  const t1 = add(g, new THREE.TorusGeometry(R * 1.03, 0.0075, 10, 112), brass(), 0, 0.027, 0); t1.rotation.x = Math.PI / 2;
  const t2 = add(g, new THREE.TorusGeometry(R * 0.985, 0.0055, 10, 112), brass(), 0, BASE, 0); t2.rotation.x = Math.PI / 2;
  const inlay = add(g, new THREE.TorusGeometry(R * 1.015, 0.0045, 8, 112), new THREE.MeshStandardMaterial({ color: doorCol, emissive: doorCol, emissiveIntensity: 0.9, roughness: 0.4 }), 0, 0.045, 0); inlay.rotation.x = Math.PI / 2;
  add(g, new THREE.CylinderGeometry(R * 0.72, R * 0.8, 0.004, 56), brass(), 0, 0.0015, 0);   // gold underside plate

  // ---- the cloche: light smoked glass, six gold ribs, and a finial that is the heart of the museum ----
  const domeCol = new THREE.Color(0x0e1424).lerp(doorCol, 0.12);
  const dome = new THREE.Mesh(new THREE.SphereGeometry(DR, 56, 24, 0, TAU, 0, Math.PI / 2), new THREE.MeshPhysicalMaterial({ color: domeCol, roughness: 0.04, transparent: true, opacity: 0.16, depthWrite: false, side: THREE.DoubleSide, clearcoat: 1, clearcoatRoughness: 0.03, metalness: 0.1 }));
  dome.position.y = BASE; dome.scale.y = DH; dome.renderOrder = 1; g.add(dome);
  const ribM = brass();
  for (let i = 0; i < 3; i++) { const rib = add(g, new THREE.TorusGeometry(DR, 0.0042, 8, 64, Math.PI), ribM, 0, BASE, 0); rib.scale.y = DH; rib.rotation.y = (i * Math.PI) / 3; }
  const TOP = BASE + DR * DH;
  const heartM = new THREE.MeshStandardMaterial({ color: 0xffe9b0, emissive: 0xffc24a, emissiveIntensity: 1, roughness: 0.3 });
  const heart = add(g, new THREE.IcosahedronGeometry(1, 2), heartM, 0, TOP + 0.012, 0);
  const crown = add(g, new THREE.TorusGeometry(0.03, 0.0025, 8, 48), brass(), 0, TOP + 0.012, 0);
  const heartGlow = glow(0xffc86a, 0.3, 0.3); heartGlow.position.y = TOP + 0.012; heartGlow.renderOrder = 4; g.add(heartGlow);

  // ---- gems on a sunflower spiral, centre outwards in book order, each hovering over the velvet ----
  const sp = RM * Math.sqrt(Math.PI / Math.max(n, 1)), size = Math.min(0.04, 0.5 * sp), HR = Math.min(0.042, 0.52 * sp);
  const fx = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const r = RM * Math.sqrt((i + 0.5) / n), a = i * GA, q = (r / RM) * (r / RM);
    fx[i * 3] = Math.cos(a) * r; fx[i * 3 + 1] = BASE + 0.034 + size + 0.05 * (1 - q); fx[i * 3 + 2] = Math.sin(a) * r;
  }
  const gemGeo = new THREE.IcosahedronGeometry(1, 1);
  const foundM = new THREE.MeshPhysicalMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 0.8, roughness: 0.2, clearcoat: 1, flatShading: true });
  foundM.onBeforeCompile = (s) => { s.fragmentShader = s.fragmentShader.replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n#ifdef USE_COLOR\ntotalEmissiveRadiance *= vColor.rgb;\n#endif'); };
  const ghostM = new THREE.MeshPhysicalMaterial({ color: 0x59627e, roughness: 0.12, metalness: 0.2, transparent: true, opacity: 0.8, clearcoat: 1, flatShading: true, emissive: 0x7f8aa8, emissiveIntensity: 0.28 });
  const gF = new THREE.InstancedMesh(gemGeo, foundM, Math.max(n, 1)), gG = new THREE.InstancedMesh(gemGeo, ghostM, Math.max(n, 1));
  const aura = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: glowTexture(), transparent: true, opacity: 0.8, depthWrite: false, toneMapped: false }), Math.max(n, 1));
  const sock = new THREE.InstancedMesh(new THREE.CircleGeometry(1, 28), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.5, depthWrite: false, toneMapped: false, side: THREE.DoubleSide }), Math.max(n, 1));
  sock.frustumCulled = false; sock.instanceMatrix.setUsage(THREE.DynamicDrawUsage); sock.renderOrder = 0; g.add(sock);
  [gF, gG, aura].forEach((m) => { m.frustumCulled = false; m.instanceMatrix.setUsage(THREE.DynamicDrawUsage); g.add(m); });
  gG.renderOrder = 0; aura.renderOrder = 3;
  const zero = new THREE.Matrix4().makeScale(1e-4, 1e-4, 1e-4), col = new THREE.Color(), pc = [];
  pages.forEach((p, i) => { pc.push(new THREE.Color(p.color)); sock.setColorAt(i, p.found ? pc[i] : col.setRGB(0.26, 0.25, 0.3)); gF.setColorAt(i, pc[i]); gG.setColorAt(i, col.set(1, 1, 1)); aura.setColorAt(i, pc[i]); });
  sock.instanceColor.needsUpdate = true; gF.instanceColor.needsUpdate = true; aura.instanceColor.needsUpdate = true;

  // ---- one touch target per gem (picks by distance to the ray) ----
  const hits = [], sel = { i: -1, t: 9 }; let lastPick = -1, tapped = new Set(), done = false, cyc = 0;
  const wv = new THREE.Vector3(), cl = new THREE.Vector3();
  pages.forEach((p, i) => {
    const h = new THREE.Object3D(); h.visible = false; g.add(h); hits.push(h);
    h.raycast = function (rc, out) {
      this.getWorldPosition(wv); const r = HR * this.parent.matrixWorld.getMaxScaleOnAxis();
      if (rc.ray.distanceSqToPoint(wv) > r * r) return;
      rc.ray.closestPointToPoint(wv, cl);
      out.push({ distance: rc.ray.origin.distanceTo(cl) - 0.0001 * (1 - Math.min(1, rc.ray.distanceSqToPoint(wv) / (r * r))), point: cl.clone(), object: this });
    };
    ctx.tap(h, () => pick(i));
  });
  const words = (s, k) => String(s).split(/\s+/).slice(0, k).join(' ');
  function pick(i) {
    const p = pages[i]; if (!p) return;
    sel.i = i; sel.t = 0; tapped.add(i);
    ctx.sfx.pop?.();
    if (p.found) { ctx.fx.burst(hits[i].position.clone().add(g.position), pc[i].getHex(), 22, 0.32, 0.026); ctx.ui.card({ tag: 'اكتشفتها', title: words(p.title, 5), body: 'أضاءت في متحف هذا الباب، وبقيت لك جوهرة مشتعلة.', color: p.color }); }
    else { ctx.fx.burst(hits[i].position.clone().add(g.position), 0xaab4d0, 8, 0.14, 0.016); ctx.ui.card({ tag: 'تنتظرك', title: words(p.title, 5), body: 'ما زالت في الظل داخل هذا الباب. اكتشفها وسيشتعل ضوؤها هنا.', color: '#8b95b3' }); }
    if (!done && tapped.size >= 5) { done = true; ctx.ui.done(); }
  }
  const origTap = ctx.tap; void origTap;

  // ---- labels (two, large) ----
  const L1 = sprite(n ? `${AR(found)} من ${AR(n)}` : '—', 0.2, { size: 84, weight: 800, bg: 'rgba(252,248,238,.97)', border: '#d4ad55', pad: 26, radius: 40 });
  L1.position.set(0, 0.04, R + 0.06); g.add(L1);
  const st = all ? 'اكتمل المتحف' : found ? 'تابع الاكتشاف' : 'في انتظارك';
  const L2 = sprite(st, 0.2, { size: 70, weight: 800, bg: all ? 'rgba(212,173,85,.97)' : 'rgba(252,248,238,.9)', color: all ? '#2b2620' : '#4a4338', border: all ? null : '#c9b98c', pad: 24, radius: 36 });
  L2.position.set(0, 0.03, R + 0.15); g.add(L2);
  if (!found) ctx.ui.hud('اللمس يكشف ما ينتظر');

  const d = new THREE.Object3D(), qa = new THREE.Quaternion(), qb = new THREE.Quaternion(), tmp = new THREE.Color(), cc = new THREE.Color();
  let burstAt = 3;
  return {
    update(t, dt, e) {
      const k0 = Math.max(e, 1e-3); g.scale.setScalar(k0);
      sel.t += dt;
      g.getWorldQuaternion(qa).invert(); qb.copy(qa).multiply(ctx.camera.quaternion);
      for (let i = 0; i < n; i++) {
        const p = pages[i], k = stag(t, 0.8 + i * 0.07, 0.9, easeBack), kk = Math.max(k, 1e-4), ke = clamp01(k);
        const bob = Math.sin(t * 1.1 + i * 1.7) * 0.004, x = fx[i * 3] * ke, y = BASE + 0.02 + (fx[i * 3 + 1] - BASE - 0.02) * ke + bob, z = fx[i * 3 + 2] * ke;
        const bump = sel.i === i ? 1 + 0.5 * Math.max(0, 1 - sel.t * 0.85) * (0.6 + 0.4 * Math.cos(sel.t * 9)) : 1;
        hits[i].position.set(x, y, z); hits[i].visible = ke > 0.4;
        d.position.set(x, y, z);
        if (p.found) {
          const pu = 0.5 + 0.5 * Math.sin(t * 2.2 + i * 1.3);
          d.rotation.set(0.35, t * 0.9 + i, 0.15); d.scale.setScalar(size * kk * bump * (1 + 0.06 * pu)); d.updateMatrix(); gF.setMatrixAt(i, d.matrix); gG.setMatrixAt(i, zero);
          d.quaternion.copy(qb); d.scale.setScalar(size * (4 + 0.6 * pu) * kk * bump);
        } else {
          d.rotation.set(0.2, t * 0.25 + i, 0); d.scale.setScalar(size * 0.82 * kk * bump); d.updateMatrix(); gG.setMatrixAt(i, d.matrix); gF.setMatrixAt(i, zero);
          d.scale.setScalar(1e-4);
        }
        d.updateMatrix(); aura.setMatrixAt(i, d.matrix);
        d.position.set(x, BASE + 0.0035, z); d.rotation.set(-Math.PI / 2, 0, 0); d.scale.setScalar(size * 1.3 * kk * (p.found ? 1 + 0.08 * Math.sin(t * 2.2 + i * 1.3) : 1)); d.updateMatrix(); sock.setMatrixAt(i, d.matrix);
      }
      sock.instanceMatrix.needsUpdate = true;
      gF.instanceMatrix.needsUpdate = gG.instanceMatrix.needsUpdate = aura.instanceMatrix.needsUpdate = true;
      // the heart: an ember when nothing is found, a sun when everything is
      const hk = stag(t, 0.3, 1, easeBack), br = 0.25 + 0.75 * frac, pu = 0.5 + 0.5 * Math.sin(t * (all ? 3 : 1.6));
      heart.scale.setScalar(Math.max(1e-4, (0.011 + 0.014 * frac) * hk * (1 + 0.1 * pu)));
      heartM.emissiveIntensity = 0.35 + 1.1 * br * (0.8 + 0.2 * pu);
      heartGlow.scale.setScalar((0.1 + 0.26 * frac) * (1 + 0.15 * pu) * hk + 1e-3); heartGlow.material.opacity = (0.15 + 0.6 * frac) * (0.75 + 0.25 * pu) * clamp01(e);
      crown.rotation.set(Math.PI / 2 + Math.sin(t * 0.8) * 0.3, t * 0.6, 0); crown.scale.setScalar(Math.max(hk, 1e-4));
      if (all && t > burstAt) { burstAt = t + 2.2; ctx.fx.burst(new THREE.Vector3(g.position.x, TOP + 0.012, g.position.z), 0xffd27a, 14, 0.3, 0.022); }
    },
  };
}
