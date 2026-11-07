import * as THREE from 'three';
import { P, ease, easeBack, clamp01, stag, mat, glossy, goldMat, shadowed, glow } from '../../kit.js?v=18';
import { scene, RoundedBox, TAU, contactShadow, lightPool } from '../lib/a8-kit.js?v=18';
export const meta = { free: true, center: [0.5, 0.666], typeLabel: 'مجسّم تفاعلي' };

// Ten dark columns grow from the printed chart; a big phone crowns each. Six phones carry a statement to judge.
const H = [0.63, 0.52, 0.45, 0.58, 0.42, 0.33, 0.28, 0.12, 0.25, 0.24];
const COL = [0x3b8fe0, 0x6f5bd6, 0x8a5ad8, 0xe0527f, 0x2fbf8a, 0x7ac143, 0xa3c93a, 0xf29a2e, 0xf0803c, 0xf26b3a];
const ST = [
  { t: 'من التحديات التقنية للتعليم المتنقل محدودية ذاكرة الهواتف المحمولة وقدراتها الحسابية، وقصر عمر بطارياتها.', wrong: false },
  { t: 'تتوحد أنظمة تشغيل الهواتف المحمولة، فلا يواجه التعليم المتنقل مشكلة في توافق التطبيقات.', wrong: true, fix: 'تختلف أنظمة التشغيل وتتنوع، وهذا من التحديات التقنية التي يواجهها التعليم المتنقل.' },
  { t: 'تقتصر المشاكل الأمنية على فقدان الجهاز، ولا صلة لها بالشبكات اللاسلكية.', wrong: true, fix: 'قد يتعرض المستخدم لمشاكل أمنية عند اختراق الشبكات اللاسلكية باستخدام الأجهزة النقالة.' },
  { t: 'تخفف التجربة الناجحة للتعليم المتنقل عن المتعلمين عبء المسافات، أي المكان والزمان، وتعزز رغبتهم في التعلم.', wrong: false },
  { t: 'يعرض المخطط نسب استخدام الهواتف الذكية لدى جميع فئات المجتمع في الدول العربية.', wrong: true, fix: 'يخص المخطط فئة الشباب بين ١٨ و٣٠ سنة في بعض الدول العربية عام ٢٠١٢.' },
  { t: 'استند المخطط إلى ما جاء في مؤتمر منظمة اليونسكو الثاني حول التعليم بالأجهزة المحمولة الذي عُقد في باريس.', wrong: false },
];
function glyphTex(ch, c) {
  const k = document.createElement('canvas'); k.width = k.height = 128; const x = k.getContext('2d');
  const gr = x.createLinearGradient(0, 0, 0, 128); gr.addColorStop(0, '#ffffff'); gr.addColorStop(1, '#' + c.toString(16).padStart(6, '0')); x.fillStyle = gr; x.fillRect(0, 0, 128, 128);
  x.fillStyle = '#1f2a3a'; x.font = '800 78px Tajawal, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(ch, 64, 70);
  const t = new THREE.CanvasTexture(k); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function tickTex(bg) {
  const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d');
  x.fillStyle = bg; x.fillRect(0, 0, 128, 128); x.strokeStyle = '#fff'; x.lineWidth = 14; x.lineCap = 'round'; x.lineJoin = 'round';
  x.beginPath(); x.moveTo(34, 66); x.lineTo(56, 90); x.lineTo(96, 40); x.stroke();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

export default function build(ctx) {
  const S = scene(ctx, meta); const g = S.g;
  // warm light pool under the chart echoes the printed orange panel
  const pool = lightPool(0xf29a2e, 0.5, 0.0); pool.scale.set(1.1, 0.5, 1); pool.position.y = 0.002; g.add(pool);
  const base = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.004, 0.006), mat(0x2b2620)); base.position.set(0, 0.002, 0.045); g.add(base);
  S.part(base, 0.1, { rise: 0.0 });
  const bars = [], phones = [], rips = [], tex = ST.map((s, k) => glyphTex('؟', COL[k])), tickG = tickTex('#2fa86a'), tickA = tickTex('#e0a02f');
  const x0 = -0.351, dx = 0.078;
  H.forEach((h, i) => {
    const bh = Math.max(0.03, h * 0.36), x = x0 + i * dx;
    const sh = contactShadow(0.1, 0.12, 0.38); sh.position.set(x, 0.0015, 0.03); g.add(sh);
    const tubeGeo = new THREE.CylinderGeometry(0.034, 0.034, 1, 32, 1, true); tubeGeo.translate(0, 0.5, 0);
    const bar = new THREE.Mesh(tubeGeo, new THREE.MeshPhysicalMaterial({ color: COL[i], roughness: 0.04, transparent: true, opacity: 0.32, clearcoat: 1, emissive: COL[i], emissiveIntensity: 0.12, side: THREE.DoubleSide, depthWrite: false }));
    bar.position.set(x, 0, 0.02); bar.scale.set(1, 0.0001, 1); bar.renderOrder = 4; g.add(bar);
    const fillGeo = new THREE.CylinderGeometry(0.027, 0.027, 1, 28); fillGeo.translate(0, 0.5, 0);
    const fill = new THREE.Mesh(fillGeo, new THREE.MeshStandardMaterial({ color: COL[i], emissive: COL[i], emissiveIntensity: 0.55, roughness: 0.25 }));
    fill.position.set(x, 0.006, 0.02); fill.scale.set(1, 0.0001, 1); g.add(fill);
    const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.045, 0.01, 28), glossy(0xf6efdf)); foot.position.set(x, 0.005, 0.02); g.add(shadowed(foot));
    const stripe = new THREE.Mesh(new THREE.TorusGeometry(0.035, 0.0035, 8, 32), goldMat()); stripe.rotation.x = Math.PI / 2; g.add(stripe);
    const ph = new THREE.Group(); ph.position.set(x, bh + 0.004, 0.02); g.add(ph);
    const body = new THREE.Mesh(new RoundedBox(0.074, 0.132, 0.014, 0.012), glossy(COL[i], { roughness: 0.2 })); body.position.y = 0.064; ph.add(body);
    const sm = new THREE.MeshStandardMaterial({ color: 0xffffff, map: i < ST.length ? tex[i] : null, emissive: 0xffffff, emissiveIntensity: 0.12, roughness: 0.3 });
    if (i >= ST.length) { sm.color.set(0xffffff); sm.emissive.set(COL[i]); sm.emissiveIntensity = 0.5; }
    const scr = new THREE.Mesh(new THREE.PlaneGeometry(0.06, 0.112), sm); scr.position.set(0, 0.066, 0.0066); ph.add(scr);
    const hal = glow(COL[i], 0.2, 0.25); hal.position.set(0, 0.066, 0.016); ph.add(hal);
    ph.scale.setScalar(0.0001);
    bars.push({ bar, fill, stripe, bh, i, x }); phones.push({ ph, sm, scr, hal, i, y0: ph.position.y, lift: 0, state: 'idle', shakeT: -9 });
    if (i < ST.length) for (let r = 0; r < 2; r++) { const ring = new THREE.Mesh(new THREE.TorusGeometry(0.03, 0.0016, 6, 36), new THREE.MeshBasicMaterial({ color: COL[i], transparent: true, opacity: 0, depthWrite: false, toneMapped: false })); ring.rotation.x = Math.PI / 2; g.add(ring); rips.push({ ring, i, r, bx: x, by: bh }); }
  });

  let open = -1, solved = 0;
  const setOpen = (k) => { phones.forEach((p) => { if (p.state === 'open') p.state = 'idle'; }); if (k >= 0) phones[k].state = 'open'; open = k; };
  const judge = (k, sayWrong) => {
    const s = ST[k], p = phones[k];
    if (sayWrong === s.wrong) {
      p.state = 'done'; solved++; open = -1;
      p.sm.map = s.wrong ? tickA : tickG; p.sm.emissive.set(s.wrong ? 0xe0a02f : 0x35c27c); p.sm.emissiveIntensity = 0.3; p.sm.needsUpdate = true;
      p.hal.material.color.set(0x35c27c); p.hal.material.opacity = 0.55;
      S.burst(new THREE.Vector3(p.ph.position.x, 0.3, 0.05), 0x35c27c, 28);
      ctx.sfx.good?.(); ctx.ui.choices([]);
      ctx.ui.card({ tag: s.wrong ? 'أصبت · خاطئة' : 'أصبت · صحيحة', title: s.wrong ? 'التصحيح' : 'عبارة صحيحة', body: s.wrong ? s.fix : 'هذه العبارة توافق ما يقرره الكتاب.', color: 0x35c27c });
      ctx.ui.hud(solved >= ST.length ? 'راجعت كل العبارات' : `${['', 'واحدة', 'اثنتان', 'ثلاث', 'أربع', 'خمس'][solved]} من ست`);
      if (solved >= ST.length) setTimeout(() => ctx.ui.done(), 1800);
    } else { p.shakeT = S.now; ctx.sfx.bad?.(); ctx.ui.toast('أعد قراءة العبارة بتأنٍّ'); }
  };
  ST.forEach((s, k) => {
    const p = phones[k];
    S.touch(p.ph, () => {
      if (p.state === 'done') { ctx.ui.card({ tag: 'تمت مراجعتها', title: s.wrong ? 'التصحيح' : 'عبارة صحيحة', body: s.wrong ? s.fix : s.t, color: 0x35c27c }); return; }
      setOpen(k); ctx.ui.card({ tag: 'صحيحة أم خاطئة؟', title: 'راجع هذه العبارة', body: s.t, color: COL[k] });
      ctx.ui.choices([{ label: 'صحيحة', primary: true, onPick: () => judge(k, false) }, { label: 'خاطئة', onPick: () => judge(k, true) }]);
    }, { color: COL[k], size: 0.3, at: new THREE.Vector3(0, 0.066, 0.016), wake: 3.6 });
  });
  ctx.ui.hud('المس هاتفاً واحكم على عبارته');

  S.loop((t, dt, e) => {
    pool.material.opacity = 0.5 * ease((t - 0.2) / 1.2) * e;
    bars.forEach((b, i) => { const k = stag(t, 0.2 + i * 0.16, 0.8, ease) * e; b.bar.scale.y = Math.max(0.0001, b.bh * k); b.fill.scale.y = Math.max(0.0001, (b.bh - 0.012) * k * (0.97 + 0.03 * Math.sin(t * 2.4 + i))); b.fill.material.emissiveIntensity = 0.5 + 0.2 * Math.sin(t * 2 + i); b.stripe.position.set(b.x, b.bh * k + 0.002, 0.02); b.stripe.visible = k > 0.02; });
    phones.forEach((p, i) => {
      const k = stag(t, 1.1 + i * 0.14, 0.7, easeBack) * e;
      p.lift = THREE.MathUtils.damp(p.lift, p.state === 'open' ? 1 : 0, 6, dt);
      const sh = clamp01(1 - (t - p.shakeT) / 0.5) * Math.sin((t - p.shakeT) * 55) * 0.01;
      p.ph.scale.setScalar(Math.max(0.0001, k * (1 + p.lift * 0.28)));
      p.ph.position.y = p.y0 + 0.02 * (1 - clamp01(k)) + p.lift * 0.1 + Math.sin(t * 1.6 + i) * 0.003;
      p.ph.position.x = bars[i].x + sh; p.ph.rotation.y = p.lift * Math.sin(t * 1.3) * 0.5 + Math.sin(t * 0.8 + i) * 0.06;
      p.hal.material.opacity = (p.state === 'done' ? 0.55 : 0.3 + 0.12 * Math.sin(t * 2 + i)) * k * (i >= ST.length ? 0.6 : 1);
      p.sm.emissiveIntensity = i >= ST.length ? 0.5 : (p.state === 'open' ? 0.35 : 0.12 + 0.05 * Math.sin(t * 2.2 + i));
    });
    rips.forEach((r) => {
      const ph = phones[r.i]; const u = ((t * 0.55 + r.r * 0.5 + r.i * 0.13) % 1);
      r.ring.position.set(r.bx, ph.ph.position.y + 0.13 + u * 0.1, 0.02); r.ring.scale.setScalar(0.5 + u * 1.3);
      r.ring.material.opacity = (ph.state === 'done' ? 0 : 0.45 * (1 - u)) * clamp01((t - 2.4) / 0.6) * e;
    });
  });
  return { update: S.update };
}
