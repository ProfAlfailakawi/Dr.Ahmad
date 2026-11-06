// One geometric vote over ALL the pages at once: real matches agree on where the page sits in the picture, chance
// matches scatter. Built on the phone from the recognition file, so it needs no extra download.
// SEL = the balanced descriptor bits used for hashing (6 tables of 23 bits), chosen offline from the book itself.
const SEL = [[648,421,24,664,56,171,660,212,340,112,494,580,422,385,25,542,519,406,87,308,558,162,111],[635,459,47,535,224,32,348,159,261,322,379,440,248,292,355,323,103,550,203,0,600,485,1],[477,476,260,463,436,102,562,225,241,3,347,299,7,233,277,263,601,433,252,457,231,549,18],[661,78,278,482,649,240,227,270,311,16,200,267,9,137,179,565,557,296,222,36,27,54,10],[255,31,543,544,219,434,242,363,456,94,559,276,173,74,293,45,141,180,362,612,53,479,249],[386,611,419,628,121,93,220,183,442,172,428,420,629,164,466,603,46,291,556,89,215,184,120]];
const W = 21, MAX_D = 100, TOP = 3, STEP_ANGLE = Math.PI / 6;
let n = 0, targets = 0, desc, lab, wx, wy, ws, wa, cx, cy, keys, items, seen, stamp = 0;
const popcount = (v) => { v -= (v >>> 1) & 0x55555555; v = (v & 0x33333333) + ((v >>> 2) & 0x33333333); return (((v + (v >>> 4)) & 0x0f0f0f0f) * 0x01010101) >>> 24; };
const hash = (t, a, o, m) => { let h = m; const s = SEL[t]; for (let i = 0; i < s.length; i++) { const b = s[i]; h = (h * 2) + ((a[o + (b >> 5)] >>> (b & 31)) & 1); } return h; };
function build(list) {
  targets = list.length; n = 0;
  for (const t of list) for (const k of t) n += k.maximaPoints.length + k.minimaPoints.length;
  desc = new Int32Array(n * W); lab = new Uint8Array(n); wx = new Float32Array(n); wy = new Float32Array(n); ws = new Float32Array(n); wa = new Float32Array(n);
  cx = new Float32Array(targets); cy = new Float32Array(targets);
  const maxima = new Uint8Array(n); let i = 0;
  list.forEach((t, ti) => {
    cx[ti] = t[0].width / t[0].scale / 2; cy[ti] = t[0].height / t[0].scale / 2;
    for (const k of t) for (const [pts, m] of [[k.maximaPoints, 1], [k.minimaPoints, 0]]) for (const p of pts) {
      desc.set(p.descriptors, i * W); lab[i] = ti; maxima[i] = m; wx[i] = p.x / k.scale; wy[i] = p.y / k.scale; ws[i] = p.scale / k.scale; wa[i] = p.angle; i++;
    }
  });
  keys = []; items = []; seen = new Int32Array(n);
  for (let t = 0; t < SEL.length; t++) {
    const sorted = new Float64Array(n);
    for (let k = 0; k < n; k++) sorted[k] = hash(t, desc, k * W, maxima[k]) * 131072 + k;   // n < 2^17
    sorted.sort();
    const ks = new Int32Array(n), it = new Int32Array(n);
    for (let k = 0; k < n; k++) { ks[k] = Math.floor(sorted[k] / 131072); it[k] = sorted[k] % 131072; }
    keys.push(ks); items.push(it);
  }
}
const lowerBound = (a, v) => { let lo = 0, hi = a.length; while (lo < hi) { const m = (lo + hi) >>> 1; if (a[m] < v) lo = m + 1; else hi = m; } return lo; };
const q = new Int32Array(W);
function query(points) {
  const bins = new Map(), best = new Float32Array(targets);
  for (const p of points) {
    stamp++; const used = new Set(), d = p.descriptors, m = p.maxima ? 1 : 0;
    for (let w = 0; w < W; w++) q[w] = d[w];
    for (let t = 0; t < SEL.length; t++) {
      const h = hash(t, q, 0, m), ks = keys[t], it = items[t];
      for (let e = lowerBound(ks, h); e < n && ks[e] === h; e++) {
        const k = it[e]; if (seen[k] === stamp) continue; seen[k] = stamp;
        let dist = 0; const o = k * W; for (let w = 0; w < W; w++) dist += popcount(desc[o + w] ^ q[w]);
        if (dist > MAX_D) continue;
        const ti = lab[k], sr = p.scale / ws[k], th = p.angle - wa[k], c = Math.cos(th), s = Math.sin(th), dx = cx[ti] - wx[k], dy = cy[ti] - wy[k];
        const px = p.x + sr * (c * dx - s * dy), py = p.y + sr * (s * dx + c * dy);
        const sb = Math.round(Math.log2(sr) * 2) + 16, rb = (Math.round(th / STEP_ANGLE) + 24) % 12, xb = Math.round(px / 90) + 64, yb = Math.round(py / 90) + 64;
        const key = ti * 16777216 + (sb << 19) + (rb << 15) + (xb << 8) + yb;
        if (used.has(key)) continue; used.add(key);
        const v = (bins.get(key) || 0) + 1; bins.set(key, v); if (v > best[ti]) best[ti] = v;
      }
    }
  }
  return Array.from(best.keys()).filter((i) => best[i] > 0).sort((a, b) => best[b] - best[a]).slice(0, TOP);
}
onmessage = ({ data }) => {
  if (data.type === 'setup') {
    build(data.matchingDataList);
    // A few rehearsal votes, so the phone's JavaScript engine has optimised this code before the first real frame.
    const sample = Array.from({ length: 150 }, (_, i) => { const k = (i * 797) % n; return { descriptors: desc.subarray(k * W, k * W + W), maxima: i % 2 === 0, x: i, y: i, scale: 2, angle: 0 }; });
    for (let i = 0; i < 6; i++) query(sample);
    postMessage({ type: 'ready' }); return;
  }
  if (data.type === 'query') { const t = performance.now(); postMessage({ type: 'cands', list: query(data.points), ms: performance.now() - t }); }
};
