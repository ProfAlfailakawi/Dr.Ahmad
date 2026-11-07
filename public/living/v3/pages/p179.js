// p179 — "what does a theory do?": one tree of knowledge whose four branches end in four fruits, each doing one job of a theory (gather, explain, predict, guide).
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { P, ease, easeBack, clamp01, stag, mat, glossy, goldMat, shadowed } from '../../kit.js?v=16';
import { tagSprite, setSpr, softLight } from '../../v2/common.js?v=16';
import { hints, finder, blobShadow, hitSphere } from '../lib/a3-kit.js?v=16';

export const meta = { free: true, center: [0.47, 0.64], typeLabel: 'شجرة المعرفة' };

const TAU = Math.PI * 2;
const COL = { gather: 0x7fae2a, explain: 0xf08a2a, predict: 0x3b8fd0, guide: 0xd04a3a };
const INFO = {
  gather: ['وظيفة ١', 'تجميع الحقائق', 'تجمع الحقائق والمفاهيم وتُرتّبها في بناء منظّم، فيصير لها معنى وقيمة.'],
  explain: ['وظيفة ٢', 'التوضيح والتفسير', 'تقدّم توضيحاً وتفسيراً لعدد من الظواهر الطبيعية والإنسانية والكونية.'],
  predict: ['وظيفة ٣', 'التنبؤ', 'تساعد في توقّع الظواهر وحدوثها أو عدمه في ظل معطيات ومؤشرات معينة.'],
  guide: ['وظيفة ٤', 'توجيه الفكر العلمي', 'هي بمثابة الموجِّه لإجراءات البحث العلمي وعمليات الاستدلال العقلي.'],
};
const TIPS = [['gather', -0.25, 0.37, 0.04], ['explain', 0.25, 0.4, 0.03], ['predict', -0.12, 0.6, -0.04], ['guide', 0.14, 0.63, 0.04]];

export default function build(ctx) {
  const g = new THREE.Group(); g.position.copy(P(0.47, 0.64)); g.scale.setScalar(0.88); ctx.stage.add(g);
  const H = hints(), found = finder(ctx, 4);
  const sh = blobShadow(0.7, 0.42, 0.3); g.add(sh);
  const bark = mat(0x7b4f2e, { roughness: 0.85 });
  const tree = new THREE.Group(); g.add(tree);
  // trunk (lathe) and roots
  const trunk = new THREE.Mesh(new THREE.LatheGeometry([[0.07, 0], [0.05, 0.03], [0.036, 0.1], [0.028, 0.2], [0.024, 0.3]].map(([r, y]) => new THREE.Vector2(r, y)), 28), bark); tree.add(trunk);
  for (let i = 0; i < 5; i++) { const a = i / 5 * TAU + 0.4; const r = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.02, 0.1, 8), bark); r.position.set(Math.cos(a) * 0.055, 0.015, Math.sin(a) * 0.055); r.rotation.z = Math.cos(a) * 1.15; r.rotation.x = -Math.sin(a) * 1.15; tree.add(r); }
  // branches
  const curves = TIPS.map(([, x, y, z], i) => new THREE.CatmullRomCurve3([new THREE.Vector3(0, 0.22 + (i > 1 ? 0.06 : 0), 0), new THREE.Vector3(x * 0.35, 0.28 + (y - 0.3) * 0.5, z * 0.4), new THREE.Vector3(x * 0.75, y - 0.03, z * 0.8), new THREE.Vector3(x, y - 0.045, z)]));
  curves.forEach((c) => { const b = new THREE.Mesh(new THREE.TubeGeometry(c, 30, 0.012, 8), bark); tree.add(b); });
  // leaves
  const leaves = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 8, 6), mat(0xffffff, { roughness: 0.6 }), 150); const mx = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), pos = new THREE.Vector3(), cc = new THREE.Color();
  const greens = [0x5d9a2e, 0x86b03a, 0x3f8a3a, 0xb2c43a, 0x6aa84a]; let seed = 5; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < 150; i++) {
    const c = curves[i % 4]; const t = 0.25 + rnd() * 0.5; c.getPoint(t, pos);
    pos.x += (rnd() - 0.5) * 0.1; pos.y += (rnd() - 0.3) * 0.08; pos.z += (rnd() - 0.75) * 0.08;
    const s = 0.013 + rnd() * 0.014; sc.set(s * 1.3, s * 0.7, s); q.setFromEuler(new THREE.Euler(rnd() * 3, rnd() * 3, rnd() * 3)); mx.compose(pos, q, sc); leaves.setMatrixAt(i, mx);
    leaves.setColorAt(i, cc.setHex(i % 23 === 0 ? 0xef8a2a : greens[i % greens.length]));
  }
  leaves.castShadow = true; tree.add(leaves);

  // ---- the four fruits, one at the end of each branch
  const fruits = {}, order = [];
  const mkFruit = (id, x, y, z) => {
    const grp = new THREE.Group(); grp.position.set(x, y, z); tree.add(grp);
    const k = { id, grp, act: 0, t0: -9, update: null }; fruits[id] = k; order.push(k);
    return k;
  };
  // gather: loose cubes that snap into an ordered block
  {
    const f = mkFruit('gather', ...TIPS[0].slice(1)); const cols = [0x7fae2a, 0xef8a2a, 0x3b8fd0, 0xd4ad55, 0xd04a3a, 0x6aa89a];
    const cubes = cols.map((c, i) => { const m = new THREE.Mesh(new RoundedBoxGeometry(0.04, 0.04, 0.04, 3, 0.008), glossy(c)); f.grp.add(m); const a = i * 1.7; return { m, home: new THREE.Vector3(((i % 3) - 1) * 0.046, 0.0 + Math.floor(i / 3) * 0.046, 0), loose: new THREE.Vector3(Math.cos(a) * 0.08, 0.04 + (i % 3) * 0.04, Math.sin(a) * 0.06), ph: i * 1.3 }; });
    let asm = 0;
    f.hit = hitSphere(0.1, [0, 0.02, 0]); f.grp.add(f.hit);
    f.update = (t, dt) => { asm += ((f.act > 0 ? 1 : 0) - asm) * Math.min(1, dt * 3); cubes.forEach((c) => { pos.lerpVectors(c.loose, c.home, ease(asm)); pos.y += (1 - asm) * Math.sin(t * 1.4 + c.ph) * 0.012; c.m.position.copy(pos); c.m.rotation.set((1 - asm) * Math.sin(t * 0.8 + c.ph), (1 - asm) * (t + c.ph) * 0.5, 0); }); };
  }
  // explain: a bulb
  {
    const f = mkFruit('explain', ...TIPS[1].slice(1));
    const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.02, 0.034, 20), goldMat()); foot.position.y = -0.03; f.grp.add(foot);
    const glass = new THREE.Mesh(new THREE.SphereGeometry(0.05, 28, 20), new THREE.MeshPhysicalMaterial({ color: 0xfff6dd, transparent: true, opacity: 0.4, roughness: 0.05, clearcoat: 1, depthWrite: false })); glass.position.y = 0.03; f.grp.add(glass);
    const fil = new THREE.Mesh(new THREE.SphereGeometry(0.03, 20, 14), new THREE.MeshBasicMaterial({ color: 0xffe08a, transparent: true, opacity: 0.2, toneMapped: false })); fil.position.y = 0.03; f.grp.add(fil);
    const rays = Array.from({ length: 10 }, (_, i) => { const r = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.005, 0.005), new THREE.MeshBasicMaterial({ color: 0xffc24a, toneMapped: false })); r.userData.a = i / 10 * TAU; f.grp.add(r); return r; });
    const gl = softLight(0xffc24a, 0.3, 0); gl.position.y = 0.03; f.grp.add(gl); let on = 0;
    f.hit = hitSphere(0.09, [0, 0.02, 0]); f.grp.add(f.hit);
    f.update = (t, dt) => { on += ((f.act > 0 ? 1 : 0.15 + 0.1 * Math.sin(t * 2)) - on) * Math.min(1, dt * 5); fil.material.opacity = 0.15 + on * 0.85; gl.material.opacity = on * 0.8; rays.forEach((r) => { const a = r.userData.a + t * 0.3, d = 0.07 + on * 0.03; r.position.set(Math.cos(a) * d, 0.03 + Math.sin(a) * d, 0); r.rotation.z = a; r.scale.setScalar(Math.max(on * (f.act > 0 ? 1 : 0), 0.001)); }); };
  }
  // predict: an arrow that flies on a dotted path to a flag and comes back
  {
    const f = mkFruit('predict', ...TIPS[2].slice(1));
    const arrow = new THREE.Group(); const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.0045, 0.0045, 0.07, 8), mat(0xf1e6c9)); shaft.rotation.z = Math.PI / 2; const head = new THREE.Mesh(new THREE.ConeGeometry(0.014, 0.03, 12), glossy(0x3b8fd0)); head.rotation.z = -Math.PI / 2; head.position.x = 0.05; const fl = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.014, 0.003), glossy(0x3b8fd0)); fl.position.x = -0.035; arrow.add(shaft, head, fl); f.grp.add(arrow);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.003, 0.003, 0.12, 8), mat(0x3a3f45)); pole.position.set(0.19, 0.0, 0); f.grp.add(pole);
    const flag = new THREE.Mesh(new THREE.PlaneGeometry(0.06, 0.036), new THREE.MeshStandardMaterial({ color: 0x3b8fd0, side: THREE.DoubleSide })); flag.position.set(0.222, 0.042, 0); f.grp.add(flag);
    const dots = Array.from({ length: 9 }, () => { const s = new THREE.Mesh(new THREE.SphereGeometry(0.0055, 8, 6), new THREE.MeshBasicMaterial({ color: 0x3b8fd0, transparent: true, opacity: 0.45 })); f.grp.add(s); return s; });
    const arc = (k, out) => out.set(0.0 + k * 0.17, Math.sin(k * Math.PI) * 0.06, 0);
    f.hit = hitSphere(0.1, [0.08, 0.0, 0]); f.grp.add(f.hit);
    f.update = (t) => { const fk = clamp01((t - f.t0) / 1.2); dots.forEach((s, i) => { arc((i + 1) / 10, s.position); s.material.opacity = 0.25 + 0.3 * Math.sin(t * 3 - i * 0.6); });
      if (fk > 0 && fk < 1) { arc(fk, arrow.position); arrow.rotation.z = Math.atan2(Math.cos(fk * Math.PI) * Math.PI * 0.06, 0.17); } else { arrow.position.set(0, 0.012 + Math.sin(t * 2) * 0.006, 0); arrow.rotation.z = 0.25; } };
  }
  // guide: a compass
  {
    const f = mkFruit('guide', ...TIPS[3].slice(1));
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.058, 0.062, 0.016, 40), mat(0xf6efe0)); disc.rotation.x = Math.PI / 2; f.grp.add(disc);
    const bez = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.006, 10, 48), goldMat()); f.grp.add(bez);
    const needle = new THREE.Group(); needle.position.z = 0.012; f.grp.add(needle);
    const n1 = new THREE.Mesh(new THREE.ConeGeometry(0.012, 0.055, 4), glossy(0xd04a3a)); n1.position.y = 0.0275; const n2 = new THREE.Mesh(new THREE.ConeGeometry(0.012, 0.055, 4), glossy(0xf1e6c9)); n2.rotation.z = Math.PI; n2.position.y = -0.0275; needle.add(n1, n2, new THREE.Mesh(new THREE.SphereGeometry(0.006, 10, 8), goldMat()));
    let a = 1.2, vel = 0; f.kick = () => { vel = 14; };
    f.hit = hitSphere(0.09, [0, 0, 0]); f.grp.add(f.hit);
    f.update = (t, dt) => { vel *= Math.exp(-dt * 1.6); a += vel * dt; if (f.act > 0 && vel < 1.5) a += Math.atan2(Math.sin(-a), Math.cos(-a)) * Math.min(1, dt * 3); else if (f.act <= 0) a += Math.sin(t * 0.7) * dt * 0.5; needle.rotation.z = a; };
  }
  order.forEach((f, i) => {
    f.grp.scale.setScalar(1);
    ctx.tap(f.grp, () => touch(f.id));
    f.hint = H.add(f.grp, COL[f.id], 0.2, [0, 0.02, 0.02], 2.6 + i * 0.2);
  });
  shadowed(tree);
  const tag = tagSprite('تجميع الحقائق', 0.25, COL.gather); tag.visible = false; tag.userData.nm = ''; g.add(tag);
  let lastId = null, now = 0;
  function touch(id) {
    const f = fruits[id]; f.act = 1; f.t0 = now; f.hint.calm = true; ctx.sfx.pop?.(); f.kick?.(); found(id); lastId = id;
    ctx.ui.card({ tag: INFO[id][0], title: INFO[id][1], body: INFO[id][2], color: COL[id] });
    ctx.fx.burst(f.grp.getWorldPosition(new THREE.Vector3()).sub(ctx.stage.position), COL[id], 20, 0.35, 0.03);
    ctx.ui.hud('المس بقية الثمار');
  }
  // light packets climbing the trunk to each fruit
  const packets = curves.map((c, i) => { const s = softLight(COL[TIPS[i][0]], 0.07, 0.9); tree.add(s); return { s, c, o: i * 0.27 }; });
  ctx.ui.hud('المس ثمار الشجرة الأربع');
  return {
    update(t, dt, e) {
      now = t;
      sh.material.opacity = 0.3 * e;
      const tk = Math.max(stag(t, 0.1, 0.9, easeBack) * e, 0.001); tree.scale.set(tk, tk, tk);
      tree.rotation.y = Math.sin(t * 0.4) * 0.12;
      order.forEach((f, i) => { f.act = f.act > 0 && t - f.t0 > 4 ? 0 : f.act; const k = Math.max(stag(t, 0.7 + i * 0.15, 0.7, easeBack) * e, 0.001); f.grp.scale.setScalar(k * 1.65); f.grp.position.y = TIPS[i][2] + Math.sin(t * 1.3 + i) * 0.006; f.update?.(t, dt); });
      packets.forEach((p) => { const k = ((t * 0.33 + p.o) % 1); p.c.getPoint(Math.min(0.98, k), p.s.position); p.s.material.opacity = Math.sin(k * Math.PI) * 0.9 * clamp01((t - 0.5) * 2) * e; });
      if (lastId) { const f = fruits[lastId]; f.grp.getWorldPosition(pos); g.worldToLocal(pos); tag.position.set(pos.x, pos.y + 0.12, pos.z + 0.02); tag.visible = t - f.t0 < 5;
        if (tag.userData.nm !== lastId) { tag.userData.nm = lastId; const nm = INFO[lastId][1].length > 12 ? 'توجيه الفكر' : INFO[lastId][1]; const nt = tagSprite(nm, 0.25, COL[lastId]); tag.material.map = nt.material.map; tag.userData.aspect = nt.userData.aspect; }
        setSpr(tag, 0.25, e); }
      H.update(t, e);
    },
  };
}
