// p255 (round 4): the budget console. A jar of 20 gold coins, three glass tubes with gold target rings, seven programme cartridges.
// Tap a cartridge: coins leave the jar, the three tubes fill. Reach all three rings within the budget.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { P, ease, easeBack, clamp01, stag, mat, glossy, goldMat, shadowed, glow } from '../../kit.js?v=30';
import { rising, halos, motes, blob, canvasTex, screen, paintText, TAU, toAr } from '../lib/b4-kit.js?v=30';

export const meta = { free: true, center: [0.43, 0.5], typeLabel: 'لعبة ميزانية', title: 'وزّع ميزانية التعلم عن بعد' };

const OPTS = [
  { t: 'دروس مسجّلة', cost: 20, e: [5, 30, 15], c: '#3a86d6', ic: 'play' },
  { t: 'بث مباشر تفاعلي', cost: 35, e: [30, 10, 20], c: '#e0453c', ic: 'live' },
  { t: 'تدريب المعلمين', cost: 25, e: [10, 5, 30], c: '#35b5a8', ic: 'cap' },
  { t: 'مراكز ومعدات', cost: 30, e: [5, 35, 5], c: '#8d6bd1', ic: 'tower' },
  { t: 'مصادر متنوعة', cost: 25, e: [20, 15, 20], c: '#ef8f2a', ic: 'layers' },
  { t: 'أنشطة عملية', cost: 25, e: [25, 0, 20], c: '#6aa84f', ic: 'hand' },
  { t: 'حملة توعوية', cost: 15, e: [5, 10, 0], c: '#c98a3a', ic: 'mega' },
];
const BODY = [
  'دروس الفيديو المسجّلة تصل إلى المتعلم دون اتصال دائم، فترفع الإتاحة قبل غيرها.',
  'البث التفاعلي يرفع المشاركة بالأسئلة، لكنه الأغلى ثمناً.',
  'معلمون مؤهلون يعدّون محتوى تقنياً أجود، فترتفع الجودة أكثر من أي خيار آخر.',
  'المراكز والمعدات توصل التعلم إلى المناطق النائية، ولا ترفع الجودة كثيراً.',
  'تنوّع المصادر بين يدي المتعلم يضيّق فجوة الفروق ويرفع المحاور الثلاثة معاً.',
  'الأنشطة العملية تجعل المتعلم محور العملية فترتفع المشاركة والجودة.',
  'الحملة ترفع الثقافة العامة، لكن أثرها في الجودة محدود.',
];
const GOALS = [{ t: 'التفاعل', c: 0xef8f2a, target: 50 }, { t: 'الإتاحة', c: 0x3a86d6, target: 45 }, { t: 'الجودة', c: 0x35b5a8, target: 50 }];
const TH = 0.3, LIQ = 0.27;

function icon(g, k, cx, cy, s, col) {
  g.save(); g.translate(cx, cy); g.scale(s, s); g.fillStyle = col; g.strokeStyle = col; g.lineWidth = 7; g.lineCap = 'round'; g.lineJoin = 'round';
  if (k === 'play') { g.beginPath(); g.roundRect(-34, -24, 68, 48, 9); g.stroke(); g.beginPath(); g.moveTo(-8, -12); g.lineTo(14, 0); g.lineTo(-8, 12); g.closePath(); g.fill(); }
  else if (k === 'live') { g.beginPath(); g.arc(0, 0, 8, 0, TAU); g.fill(); [18, 30].forEach((r) => { g.beginPath(); g.arc(0, 0, r, -0.9, 0.9); g.stroke(); g.beginPath(); g.arc(0, 0, r, Math.PI - 0.9, Math.PI + 0.9); g.stroke(); }); }
  else if (k === 'cap') { g.beginPath(); g.moveTo(0, -24); g.lineTo(38, -6); g.lineTo(0, 12); g.lineTo(-38, -6); g.closePath(); g.fill(); g.beginPath(); g.moveTo(-20, 6); g.lineTo(-20, 22); g.quadraticCurveTo(0, 32, 20, 22); g.lineTo(20, 6); g.stroke(); }
  else if (k === 'tower') { g.beginPath(); g.moveTo(0, -4); g.lineTo(-18, 30); g.moveTo(0, -4); g.lineTo(18, 30); g.moveTo(-10, 14); g.lineTo(10, 14); g.stroke(); g.beginPath(); g.arc(0, -10, 6, 0, TAU); g.fill(); [14, 26].forEach((r) => { g.beginPath(); g.arc(0, -10, r, -2.4, -0.74); g.stroke(); }); }
  else if (k === 'layers') { [14, 0, -14].forEach((y, i) => { g.globalAlpha = 1 - i * 0.22; g.beginPath(); g.moveTo(0, y - 14); g.lineTo(34, y); g.lineTo(0, y + 14); g.lineTo(-34, y); g.closePath(); g.fill(); }); g.globalAlpha = 1; }
  else if (k === 'hand') { g.beginPath(); g.moveTo(-26, 26); g.lineTo(-26, 0); g.lineTo(-14, -26); g.lineTo(-4, 0); g.lineTo(0, -30); g.lineTo(8, 0); g.lineTo(14, -22); g.lineTo(18, 4); g.lineTo(30, -6); g.lineTo(30, 26); g.closePath(); g.fill(); }
  else { g.beginPath(); g.moveTo(-30, -8); g.lineTo(-30, 12); g.lineTo(-10, 12); g.lineTo(26, 30); g.lineTo(26, -26); g.lineTo(-10, -8); g.closePath(); g.fill(); g.beginPath(); g.moveTo(-22, 12); g.lineTo(-16, 32); g.stroke(); }
  g.restore();
}
function tileTex(o, cost) {
  return canvasTex(256, 232, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#fffdf7'); gr.addColorStop(1, '#efe7d6'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
    g.fillStyle = o.c; g.fillRect(0, 0, w, 20);
    icon(g, o.ic, w / 2, 86, 1.2, o.c);
    paintText(g, o.t, w / 2, 184, w - 20, 84, { size: 62, color: '#2b2620', line: 1.1 });
    g.fillStyle = '#d4ad55'; g.beginPath(); g.arc(46, 52, 32, 0, TAU); g.fill(); g.lineWidth = 5; g.strokeStyle = '#8f6d2c'; g.stroke();
    paintText(g, toAr(cost / 5), 46, 54, 50, 44, { size: 44, color: '#4a3510' });
  });
}

export default function build(ctx) {
  const g = new THREE.Group(); g.position.copy(P(meta.center[0], meta.center[1])); g.scale.setScalar(0.92); ctx.stage.add(g);
  const rise = rising(), hal = halos(), mo = motes(g, 14, { r: 0.4, h: 0.45 });
  const sh = blob(0.42, 0.3); sh.scale.set(0.95, 0.62, 1); sh.position.y = -0.01; g.add(sh);

  // ---- console base: two steps, gold trim, finished underside
  const base = new THREE.Group(); g.add(base);
  const slab = new THREE.Mesh(new RoundedBoxGeometry(0.8, 0.04, 0.54, 4, 0.016), mat(0x6b4a34, { roughness: 0.5 })); slab.position.y = 0.02; base.add(slab);
  const trim = new THREE.Mesh(new RoundedBoxGeometry(0.82, 0.012, 0.56, 3, 0.006), goldMat()); trim.position.y = 0.012; base.add(trim);
  const under = new THREE.Mesh(new RoundedBoxGeometry(0.68, 0.03, 0.42, 3, 0.012), mat(0x5b4636)); under.position.y = -0.012; base.add(under);
  const step = new THREE.Mesh(new RoundedBoxGeometry(0.74, 0.03, 0.2, 3, 0.012), mat(0x7d5a41, { roughness: 0.5 })); step.position.set(0, 0.052, 0.02); base.add(step);
  shadowed(base); rise.add(base, 0.05, 0.1, 0.8);

  // ---- three glass tubes with liquid and a gold target ring
  const tubes = GOALS.map((G, i) => {
    const grp = new THREE.Group(); grp.position.set(-0.2 + i * 0.15, 0.04, -0.16); g.add(grp);
    const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.046, 0.05, 0.022, 32), goldMat()); foot.position.y = 0.011; grp.add(foot);
    const glass = new THREE.Mesh(new THREE.CylinderGeometry(0.033, 0.033, TH, 32, 1, true), new THREE.MeshPhysicalMaterial({ color: 0xe6f1f4, transparent: true, opacity: 0.22, roughness: 0.05, clearcoat: 1, side: THREE.DoubleSide, depthWrite: false })); glass.position.y = TH / 2 + 0.02; grp.add(glass);
    const cap = new THREE.Mesh(new THREE.TorusGeometry(0.033, 0.0045, 8, 32), goldMat()); cap.rotation.x = Math.PI / 2; cap.position.y = TH + 0.02; grp.add(cap);
    const liq = new THREE.Mesh(new THREE.CylinderGeometry(0.027, 0.027, 1, 28), glossy(G.c, { emissive: G.c, emissiveIntensity: 0.35, clearcoat: 0.6 })); liq.position.y = 0.022; liq.scale.y = 0.0001; grp.add(liq);
    const top = new THREE.Mesh(new THREE.CircleGeometry(0.027, 28), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.55, toneMapped: false })); top.rotation.x = -Math.PI / 2; grp.add(top);
    const ty = 0.022 + G.target / 100 * LIQ;
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.039, 0.0042, 8, 36), goldMat()); ring.rotation.x = Math.PI / 2; ring.position.y = ty; grp.add(ring);
    const rg = glow(0xffe6a0, 0.16, 0); rg.position.y = ty; grp.add(rg);
    const plate = screen(0.14, 0.06, 256);
    plate.draw((c, w, h) => { c.fillStyle = '#2b2620'; c.beginPath(); c.roundRect(2, 2, w - 4, h - 4, 22); c.fill(); paintText(c, G.t, w / 2, h / 2 + 2, w - 30, h - 16, { size: 56, color: '#f6e6b8' }); });
    plate.mesh.position.set(0, 0.012, 0.062); plate.mesh.rotation.x = -0.9; plate.mesh.scale.setScalar(1); grp.add(plate.mesh); plate.mesh.renderOrder = 6;
    shadowed(grp); rise.add(grp, 0.5 + i * 0.2, 0.12, 0.8);
    const hh = hal.add(grp, G.c, 0.18, [0, 0.2, 0.02], 4);
    const s = { G, grp, liq, top, ring, rg, lvl: 0, val: 0, ok: false, hh };
    ctx.tap(grp, () => ctx.ui.card({ tag: 'هدف الصندوق', title: G.t, body: `حلقة الذهب تحدّد المستوى المقبول. اجمع البنود حتى تبلغها.`, color: G.c }));
    return s;
  });

  // ---- coin jar
  const jar = new THREE.Group(); jar.position.set(0.31, 0.04, -0.1); g.add(jar);
  const jf = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.06, 0.02, 36), goldMat()); jf.position.y = 0.01; jar.add(jf);
  const jg = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.31, 36, 1, true), new THREE.MeshPhysicalMaterial({ color: 0xf1ead6, transparent: true, opacity: 0.2, roughness: 0.05, clearcoat: 1, side: THREE.DoubleSide, depthWrite: false })); jg.position.y = 0.175; jar.add(jg);
  const jc = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.005, 8, 36), goldMat()); jc.rotation.x = Math.PI / 2; jc.position.y = 0.33; jar.add(jc);
  const coins = []; for (let i = 0; i < 20; i++) { const c = new THREE.Mesh(new THREE.CylinderGeometry(0.043, 0.043, 0.011, 28), goldMat()); c.position.set(0, 0.026 + i * 0.0125, 0); c.rotation.y = i * 0.7; jar.add(c); coins.push({ m: c, y: c.position.y, k: 1 }); }
  const counter = screen(0.11, 0.06, 256);
  const drawCounter = (n) => counter.draw((c, w, h) => { c.fillStyle = '#2b2620'; c.beginPath(); c.roundRect(2, 2, w - 4, h - 4, 24); c.fill(); paintText(c, `الميزانية ${toAr(n)}`, w / 2, h / 2 + 2, w - 30, h - 16, { size: 54, color: '#f6e6b8' }); });
  drawCounter(100); counter.mesh.position.set(0, 0.012, 0.075); counter.mesh.rotation.x = -0.9; jar.add(counter.mesh); counter.mesh.renderOrder = 6;
  shadowed(jar); rise.add(jar, 0.7, 0.12, 0.8);
  ctx.tap(jar, () => ctx.ui.card({ tag: 'الميزانية', title: 'مئة وحدة محدودة', body: 'كل عملة تمثّل خمس وحدات. وزّعها على بنود تبلغ بها الأهداف الثلاثة معاً.', color: 0xd4ad55 }));

  // ---- seven cartridges on two steps
  const carts = OPTS.map((o, i) => {
    const row = i < 4 ? 0 : 1, col = row === 0 ? i : i - 4, n = row === 0 ? 4 : 3;
    const x = (col - (n - 1) / 2) * 0.19, z = row === 0 ? 0.04 : 0.215, y = row === 0 ? 0.075 : 0.045;
    const grp = new THREE.Group(); grp.position.set(x, y, z); g.add(grp);
    const lean = new THREE.Group(); lean.rotation.x = -0.75; lean.position.y = 0.055; grp.add(lean);
    const body = new THREE.Mesh(new RoundedBoxGeometry(0.17, 0.152, 0.016, 3, 0.009), glossy(0xfbf7ee, { clearcoat: 0.5 })); lean.add(body);
    const face = new THREE.Mesh(new THREE.PlaneGeometry(0.157, 0.14), new THREE.MeshBasicMaterial({ map: tileTex(o, o.cost), toneMapped: false })); face.position.z = 0.0086; lean.add(face);
    const edge = new THREE.Mesh(new RoundedBoxGeometry(0.178, 0.16, 0.01, 3, 0.01), goldMat()); edge.position.z = -0.008; lean.add(edge);
    const check = new THREE.Group(); lean.add(check); check.position.set(0.05, -0.045, 0.014);
    { const d = new THREE.Mesh(new THREE.CylinderGeometry(0.019, 0.019, 0.006, 24), new THREE.MeshBasicMaterial({ color: 0x2f9e5b, toneMapped: false })); d.rotation.x = Math.PI / 2; check.add(d); const c1 = new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.0035, 0.004), new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false })); c1.position.set(-0.005, -0.002, 0.004); c1.rotation.z = -0.8; check.add(c1); const c2 = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.0035, 0.004), new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false })); c2.position.set(0.004, 0.002, 0.004); c2.rotation.z = 0.8; check.add(c2); }
    check.scale.setScalar(0.0001);
    shadowed(grp); rise.add(grp, 1.0 + i * 0.16, 0.14, 0.7);
    const hh = hal.add(lean, 0xffe0a0, 0.2, [0, 0, 0.03], 3.8);
    const s = { i, o, grp, lean, check, hh, bought: false, lift: 0, wob: 0, home: grp.position.clone() };
    ctx.tap(grp, () => toggle(s));
    return s;
  });

  let spent = 0, now = 0, won = false, tags = 0;
  const lvl = [0, 0, 0];
  const wp = new THREE.Vector3();
  function toggle(s) {
    if (won || now < 3.8) return;
    if (!s.bought) {
      if (spent + s.o.cost > 100) { s.wob = 1; ctx.sfx.bad?.(); ctx.ui.toast('الميزانية لا تكفي'); return; }
      s.bought = true; spent += s.o.cost; ctx.sfx.good?.();
      s.grp.getWorldPosition(wp); g.worldToLocal(wp);
      ctx.ui.card({ tag: `تكلفته ${toAr(s.o.cost)}`, title: s.o.t, body: BODY[s.i], color: parseInt(s.o.c.slice(1), 16) });
    } else {
      s.bought = false; spent -= s.o.cost; ctx.sfx.click?.();
      ctx.ui.hideCard();
    }
    refresh();
  }
  function refresh() {
    lvl[0] = lvl[1] = lvl[2] = 0; carts.forEach((s) => { if (s.bought) s.o.e.forEach((v, k) => { lvl[k] += v; }); });
    drawCounter(100 - spent);
    const ok = tubes.every((tb, k) => lvl[k] >= tb.G.target);
    ctx.ui.hud(ok ? 'بلغت الأهداف الثلاثة' : spent ? `المتبقي ${toAr(100 - spent)} وحدة` : 'المس بنداً لتموّله');
    if (ok && !won) {
      won = true; ctx.sfx.whoosh?.();
      setTimeout(() => { ctx.fx.burst(g.position.clone().add(new THREE.Vector3(0, 0.3, -0.1)), 0xffe6a0, 60, 0.55, 0.04); ctx.ui.card({ tag: 'نجحت الخطة', title: 'وصول وتنوّع وجودة معاً', body: 'الوصول وحده لا يكفي: تنوّع المصادر والأنشطة العملية يرفعان التفاعل والجودة مع الإتاحة.', color: 0x35b5a8 }); ctx.ui.done(); }, 900);
    }
  }
  ctx.ui.hud('المس بنداً لتموّله');

  return {
    update(t, dt, e) {
      now = t; rise.update(t, e); hal.update(t, e); mo.update(t, dt, e);
      tubes.forEach((tb, k) => {
        tb.val = THREE.MathUtils.damp(tb.val, Math.min(lvl[k], 100), 3.2, dt);
        const hgt = Math.max(0.0001, tb.val / 100 * LIQ);
        tb.liq.scale.y = hgt; tb.liq.position.y = 0.022 + hgt / 2; tb.top.position.y = 0.022 + hgt + 0.0005; tb.top.visible = hgt > 0.002;
        const ok = lvl[k] >= tb.G.target; tb.ok = ok;
        tb.rg.material.opacity = (ok ? 0.85 + 0.15 * Math.sin(t * 5) : 0.0) * e; tb.rg.scale.setScalar(ok ? 0.17 + 0.02 * Math.sin(t * 5) : 0.1);
        tb.ring.scale.setScalar(ok ? 1.12 : 1);
        tb.hh.on = ok ? 0 : 1;
      });
      carts.forEach((s) => {
        s.lift = THREE.MathUtils.damp(s.lift, s.bought ? 1 : 0, 7, dt);
        s.wob = Math.max(0, s.wob - dt * 2.5);
        s.grp.position.y = s.home.y + s.lift * 0.012; s.lean.rotation.x = -0.75 + s.lift * 0.12; s.lean.rotation.z = Math.sin(t * 50) * 0.08 * s.wob;
        s.grp.position.z = s.home.z - s.lift * 0.018;
        s.check.scale.setScalar(Math.max(0.0001, easeBack(s.lift) * 1.0));
        s.hh.on = s.bought ? 0.25 : 1;
      });
      // coins stack follows remaining budget
      const remaining = Math.round((100 - spent) / 5);
      coins.forEach((c, i) => { const want = i < remaining; c.k = THREE.MathUtils.damp(c.k, want ? 1 : 0, 9, dt); c.m.visible = c.k > 0.03; c.m.scale.setScalar(Math.max(0.0001, c.k)); c.m.position.y = c.y + (1 - c.k) * 0.06; });
    },
  };
}
