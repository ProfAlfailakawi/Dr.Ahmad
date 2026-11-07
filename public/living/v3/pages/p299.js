import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { P, ease, easeBack, clamp01, stag, mat, glossy, goldMat, shadowed, glow, sprite } from '../../kit.js?v=16';
import { Rig, hexCoin, retext, V, TAU } from '../lib/a5-kit.js?v=16';
import { lightPool } from '../../v2/common.js?v=16';

export const meta = { free: true, center: [0.3, 0.3], typeLabel: 'لعبة: فرز سريع' };

const ITEMS = [
  ['بلا قاعات دراسية', 0, 'home'], ['بلا ساحات مدرسية', 0, 'tower'], ['بلا مواصلات', 0, 'plane'], ['بلا أدوات مكلفة', 0, 'pencil'], ['تجهيزات أقل بكثير', 0, 'gear'], ['بلا أعباء إدارية', 0, 'cap'],
  ['فصل يتّسع للكثيرين', 1, 'person'], ['طلاب من أماكن شتى', 1, 'globe'], ['دراسة في أوقات متنوعة', 1, 'clock'], ['بلا قيود عمرية', 1, 'loop'], ['تعليم مستمر للأفراد', 1, 'book'], ['تعليم المتباعدين', 1, 'wifi'],
];
const BIN = [{ c: 0xef8f2a, x: -0.2 }, { c: 0x2a8fd0, x: 0.2 }];
const BZ = 0.13;
const rnd = (() => { let s = 11; return () => ((s = (s * 16807) % 2147483647) / 2147483647); })();

export default function build(ctx) {
  const g = new THREE.Group(); g.position.copy(P(meta.center[0], meta.center[1])); g.scale.setScalar(1.2); g.position.x += 0.115; ctx.stage.add(g);
  const rig = new Rig(ctx);
  const pool = lightPool(0x3b2b1a, 0.42, 0); pool.position.y = 0.002; pool.scale.set(0.9, 0.9, 0.6); g.add(pool); rig.fn((p) => { pool.material.opacity = 0.3 * p; }, 0.1, 1);

  // the virtual school
  const sch = new THREE.Group(); sch.position.set(0, 0, -0.1); g.add(sch);
  const body = new THREE.Mesh(new RoundedBoxGeometry(0.26, 0.17, 0.13, 3, 0.012), glossy(0xef8f2a, { roughness: 0.3 })); body.position.y = 0.085; sch.add(shadowed(body));
  const roof = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.08, 4), glossy(0x3b7fd0)); roof.rotation.y = Math.PI / 4; roof.scale.set(1, 1, 0.55); roof.position.y = 0.21; sch.add(shadowed(roof));
  const clock = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.026, 0.008, 28), glossy(0xfff6dc)); clock.rotation.x = Math.PI / 2; clock.position.set(0, 0.2, 0.066); sch.add(clock);
  const hand = new THREE.Mesh(new THREE.BoxGeometry(0.003, 0.02, 0.003), mat(0x2b2620)); hand.position.set(0, 0.2, 0.072); hand.geometry.translate(0, 0.008, 0); sch.add(hand);
  const wins = [-0.08, 0.08].map((x) => { const w = new THREE.Mesh(new RoundedBoxGeometry(0.05, 0.06, 0.006, 1, 0.003), new THREE.MeshStandardMaterial({ color: 0xfff1b8, emissive: 0xffd27a, emissiveIntensity: 0.7 })); w.position.set(x, 0.1, 0.066); sch.add(w); return w; });
  const door = new THREE.Mesh(new RoundedBoxGeometry(0.05, 0.075, 0.008, 1, 0.004), glossy(0x1f3f7a)); door.position.set(0, 0.0375, 0.066); sch.add(door);
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.003, 0.003, 0.1, 6), goldMat()); pole.position.set(0.1, 0.3, 0); sch.add(pole);
  const flag = new THREE.Mesh(new THREE.PlaneGeometry(0.06, 0.036), new THREE.MeshStandardMaterial({ color: 0x2a8fd0, side: THREE.DoubleSide })); flag.geometry.translate(0.03, 0, 0); flag.position.set(0.1, 0.3, 0); sch.add(flag);
  // chute from the door to the belt
  const chute = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([V(0, 0.04, -0.03), V(0, 0.035, 0.0), V(0, 0.07, 0.07)]), 30, 0.022, 12), new THREE.MeshPhysicalMaterial({ color: 0xcfe8ff, transparent: true, opacity: 0.35, roughness: 0.1, depthWrite: false })); g.add(chute);

  // belt
  const belt = new THREE.Group(); belt.position.set(0, 0, BZ); g.add(belt);
  const bed = new THREE.Mesh(new RoundedBoxGeometry(0.46, 0.026, 0.12, 3, 0.012), glossy(0x39414c, { roughness: 0.45 })); bed.position.y = 0.025; belt.add(shadowed(bed));
  [-1, 1].forEach((s) => { const r = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.13, 20), goldMat()); r.rotation.x = Math.PI / 2; r.position.set(s * 0.23, 0.027, 0); belt.add(shadowed(r)); });
  [-1, 1].forEach((s) => { const l = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.008, 0.006), goldMat()); l.position.set(0, 0.04, s * 0.063); belt.add(l); });
  const chev = new THREE.InstancedMesh(new THREE.BoxGeometry(0.012, 0.002, 0.07), mat(0x8a96a4), 18); belt.add(chev);
  const dm = new THREE.Object3D();

  // bins
  const bins = BIN.map((b, k) => {
    const grp = new THREE.Group(); grp.position.set(b.x, 0.04, BZ); g.add(grp);
    let bodyM;
    if (k === 0) {
      bodyM = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.062, 0.12, 36, 1, true), new THREE.MeshPhysicalMaterial({ color: 0xfff1d8, transparent: true, opacity: 0.4, roughness: 0.1, side: THREE.DoubleSide, depthWrite: false })); bodyM.position.y = 0.06;
      const base = new THREE.Mesh(new THREE.CylinderGeometry(0.062, 0.062, 0.01, 32), goldMat()); base.position.y = 0.005; grp.add(base);
      const lid = new THREE.Mesh(new THREE.TorusGeometry(0.075, 0.007, 8, 40), goldMat()); lid.rotation.x = Math.PI / 2; lid.position.y = 0.12; grp.add(lid);
    } else {
      bodyM = new THREE.Mesh(new THREE.SphereGeometry(0.07, 36, 24), new THREE.MeshPhysicalMaterial({ color: 0x9cd0f0, transparent: true, opacity: 0.5, roughness: 0.1, depthWrite: false })); bodyM.position.y = 0.11;
      const st = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.034, 0.05, 16), goldMat()); st.position.y = 0.025; grp.add(st);
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.082, 0.005, 8, 48), goldMat()); ring.position.y = 0.11; ring.rotation.set(1.1, 0.3, 0); grp.add(ring);
    }
    grp.add(bodyM);
    const fill = new THREE.InstancedMesh(new THREE.CylinderGeometry(k ? 0.008 : 0.045, k ? 0.008 : 0.045, k ? 0.016 : 0.009, k ? 8 : 20), mat(k ? 0xffffff : 0xe3b23c, k ? { emissive: 0x6fb0ff, emissiveIntensity: 0.9 } : { metalness: 0.7, roughness: 0.3 }), 8);
    grp.add(fill); fill.count = 0;
    const lab = sprite(k ? 'تجاوز القيود' : 'وفر مادي', 0.22, { size: 56, width: 420, weight: 800, border: k ? '#2a8fd0' : '#ef8f2a' }); lab.userData.w = 0.22; lab.position.set(b.x, 0.012, BZ + 0.135); g.add(lab);
    return { grp, fill, lab, n: 0, pulse: -9, k };
  });
  const beads = ITEMS.map((_, i) => { const m = new THREE.Mesh(new THREE.SphereGeometry(0.0085, 12, 8), new THREE.MeshBasicMaterial({ color: 0xcfd6dc, toneMapped: false })); m.position.set(-0.11 + i * 0.02, 0.05, BZ + 0.075); g.add(m); return m; });

  // token
  const tok = new THREE.Group(); g.add(tok); tok.visible = false;
  const coinHolder = new THREE.Group(); tok.add(coinHolder);
  const tlab = sprite('x', 0.3, { size: 56, width: 480, weight: 800, border: '#d4ad55' }); tlab.userData.w = 0.3; tlab.position.y = 0.1; tok.add(tlab);
  let coin = null;
  const queue = ITEMS.map((_, i) => i).sort(() => rnd() - 0.5);
  let cur = null, now = 0, placed = 0, finished = false;
  const S = V(0, 0.07, -0.03), H = V(0, 0.115, BZ);
  const arc = (a, b, k, lift) => { const p = a.clone().lerp(b, k); p.y += Math.sin(k * Math.PI) * lift; return p; };
  function nextToken() {
    if (!queue.length) return;
    const idx = queue.shift(); cur = { idx, st: 'in', t0: now, item: ITEMS[idx], bin: -1 };
    if (coin) coinHolder.remove(coin);
    coin = hexCoin(cur.item[2], 0xf1d585, 0.05, 0.018); coin.rotation.x = Math.PI / 2 * 0.9; coinHolder.add(coin);
    retext(tlab, cur.item[0], 0.3, { size: 56, width: 480, weight: 800, border: '#d4ad55' });
    tok.visible = true; ctx.sfx.pop?.();
  }
  function choose(k) {
    if (!cur || cur.st !== 'hold') return;
    const right = cur.item[1] === k; ctx.sfx[right ? 'good' : 'bad']?.();
    if (right) { cur.st = 'fly'; cur.t0 = now; cur.bin = k; bins[k].pulse = now + 0.8; placed++; beads[placed - 1].material.color.setHex(BIN[k].c); ctx.ui.hud(`فرزتَ ${placed} من ${ITEMS.length}`); }
    else { cur.st = 'shake'; cur.t0 = now; queue.push(cur.idx); ctx.ui.hud('أعد التفكير: أيّ المحورين أولى؟'); }
  }
  bins.forEach((b, k) => rig.touch(b.grp, () => { if (!cur || cur.st !== 'hold') { ctx.sfx.click?.(); return; } choose(k); }, { color: BIN[k].c, size: 0.26, at: V(0, 0.08, 0), show: 2.8 }));
  rig.touch(sch, (hh) => { ctx.ui.card({ tag: 'الفصل الافتراضي', title: 'قاعة بلا جدران', body: 'أشبه بقاعة محاضرات مجهّزة بأجهزة عرض وحاسب متصل بالإنترنت.', color: 0xef8f2a }); ctx.sfx.pop?.(); hh.on = false; }, { color: 0xffd27a, size: 0.34, at: V(0, 0.12, 0.05), show: 3 });
  ctx.ui.hud('إلى أيّ محور تنتمي الميزة؟');

  return {
    update(t, dt, e) {
      now = t; rig.update(t, dt, e);
      const sk = stag(t, 0.2, 0.9, easeBack) * e; sch.scale.setScalar(Math.max(sk * 1.25, 0.001)); sch.visible = sk > 0.01;
      belt.scale.set(Math.max(stag(t, 0.1, 0.8) * e, 0.001), 1, 1);
      chute.visible = sk > 0.3; hand.rotation.z = -t * 1.2; flag.rotation.y = Math.sin(t * 3) * 0.3;
      wins.forEach((w, i) => { w.material.emissiveIntensity = 0.6 + 0.3 * Math.sin(t * 2 + i * 2); });
      for (let i = 0; i < 18; i++) { const x = ((i / 18 + t * 0.12) % 1 - 0.5) * 0.42; dm.position.set(x, 0.039, 0); dm.updateMatrix(); chev.setMatrixAt(i, dm.matrix); } chev.instanceMatrix.needsUpdate = true;
      bins.forEach((b, k) => {
        const p = stag(t, 0.4 + k * 0.2, 0.8, easeBack) * e; b.grp.scale.setScalar(Math.max(p, 0.001));
        b.grp.position.y = 0.04 + (b.pulse > 0 ? Math.sin(clamp01(1 - (b.pulse - now) / 0.8) * Math.PI) * 0.012 : 0);
        b.lab.scale.set(b.lab.userData.w * p + 0.0001, b.lab.userData.w * b.lab.userData.aspect * p + 0.0001, 1);
        b.fill.count = Math.min(8, b.n);
        for (let i = 0; i < b.fill.count; i++) { if (b.k === 0) dm.position.set(((i % 2) - 0.5) * 0.024, 0.014 + Math.floor(i / 2) * 0.01, ((i % 3) - 1) * 0.01); else { const a = t * 0.8 + i * 0.8; dm.position.set(Math.cos(a) * 0.05, 0.11 + Math.sin(a * 1.3 + i) * 0.04, Math.sin(a) * 0.05); } dm.rotation.set(0, i, 0); dm.scale.setScalar(1); dm.updateMatrix(); b.fill.setMatrixAt(i, dm.matrix); }
        b.fill.instanceMatrix.needsUpdate = true;
      });
      if (!cur && t > 2.6 && queue.length) nextToken();
      if (cur) {
        const el = now - cur.t0; coinHolder.rotation.y = t * 1.4;
        if (cur.st === 'in') { const k = clamp01(el / 1.0); tok.position.copy(arc(S, H, ease(k), 0.04)); tok.scale.setScalar(Math.max(easeBack(k), 0.001)); if (k >= 1) { cur.st = 'hold'; cur.t0 = now; } }
        else if (cur.st === 'hold') { tok.position.set(H.x, H.y + Math.sin(t * 2) * 0.008, H.z); tok.scale.setScalar(1); }
        else if (cur.st === 'shake') { tok.position.set(H.x + Math.sin(el * 50) * 0.014 * (1 - el / 0.5), H.y, H.z); if (el > 0.5) { cur.st = 'out'; cur.t0 = now; } }
        else if (cur.st === 'fly') {
          const k = clamp01(el / 0.8), B = V(BIN[cur.bin].x, 0.16, BZ);
          tok.position.copy(arc(H, B, ease(k), 0.1)); tok.scale.setScalar(1 - 0.6 * ease(k));
          if (k >= 1) { bins[cur.bin].n++; ctx.fx.burst(V(BIN[cur.bin].x, 0.16, BZ), BIN[cur.bin].c, 16, 0.3, 0.025); tok.visible = false; cur = null; if (placed >= ITEMS.length && !finished) { finished = true; setTimeout(() => { ctx.ui.card({ tag: 'اكتمل الفرز', title: 'وفر وتجاوز للقيود', body: 'الفصول الافتراضية توفّر الموارد، وتتجاوز قيود المكان والزمن والعمر.', color: 0xd4ad55 }); ctx.ui.done(); }, 700); } }
        } else if (cur.st === 'out') { const k = clamp01(el / 0.5); tok.scale.setScalar(1 - ease(k)); if (k >= 1) { tok.visible = false; cur = null; } }
      }
      const s = tok.scale.x; tlab.scale.set(0.3 * s + 0.0001, 0.3 * tlab.userData.aspect * s + 0.0001, 1);
    },
  };
}
