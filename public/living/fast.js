// Fast recognition on top of MindAR, with no change to the library:
// - fast-index.js loads every page in the background and narrows each frame to the few likely pages;
// - MindAR starts on a tiny placeholder file, and a page's real data is unpacked only when that page is a candidate,
//   so opening costs the same for 7 pages or 107;
// - the candidates are shared between several workers, one per spare CPU core;
// - each frame is limited to its strongest spread of points;
// - a page counts only after it matches twice, so a one-frame coincidence never opens the wrong page.
const MISS = { targetIndex: -1, modelViewTransform: null };
const Native = window.Worker;
const W = 21;
let loader = null;   // { worker, pack, waiters } kept alive from page load until the camera stops
// Started as early as possible, so the download runs while the libraries load.
export function startPack(url) {
  if (loader) return loader;
  const l = loader = { worker: new Native(new URL('./fast-index.js?v=37', import.meta.url)), pack: null, onCands: null, onFail: null, failed: false };
  const fail = () => { l.failed = true; l.onFail?.(); };
  l.worker.onerror = fail;
  l.worker.onmessage = ({ data }) => {
    if (data.type === 'ready') l.pack = readPack(data.buffer);
    else if (data.type === 'failed') fail();
    else if (l.onCands) { const f = l.onCands; l.onCands = null; f(data.list); }
  };
  l.worker.postMessage({ type: 'load', url });
  return l;
}
export function stopPack() { loader?.worker.terminate(); loader = null; }
function readPack(buffer) {
  const size = new DataView(buffer).getUint32(0, true), head = JSON.parse(new TextDecoder().decode(new Uint8Array(buffer, 4, size)));
  const n = head.n; let o = (4 + size + 3) & ~3;
  const take = (Type, len) => { const a = new Type(buffer, o, len); o += a.byteLength; return a; };
  const pack = { buffer, head, desc: take(Uint32Array, n * W), wx: take(Float32Array, n), wy: take(Float32Array, n), ws: take(Float32Array, n), wa: take(Float32Array, n) };
  pack.blocks = o + n * 2;   // the two byte columns only the index uses
  return pack;
}
// A small MessagePack reader: only what the page blocks contain.
function unpack(bytes) {
  const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength), text = new TextDecoder(); let o = 0;
  const array = (n) => { const a = new Array(n); for (let i = 0; i < n; i++) a[i] = read(); return a; };
  const map = (n) => { const m = {}; for (let i = 0; i < n; i++) { const k = read(); m[k] = read(); } return m; };
  const str = (n) => { o += n; return text.decode(bytes.subarray(o - n, o)); };
  const bin = (n) => { o += n; return bytes.slice(o - n, o); };
  const step = (n, value) => { o += n; return value; };
  function read() {
    const b = bytes[o++];
    if (b < 0x80) return b;
    if (b < 0x90) return map(b & 15);
    if (b < 0xa0) return array(b & 15);
    if (b < 0xc0) return str(b & 31);
    if (b >= 0xe0) return b - 256;
    switch (b) {
      case 0xc0: return null; case 0xc2: return false; case 0xc3: return true;
      case 0xc4: return bin(step(1, bytes[o])); case 0xc5: return bin(step(2, v.getUint16(o))); case 0xc6: return bin(step(4, v.getUint32(o)));
      case 0xca: return step(4, v.getFloat32(o)); case 0xcb: return step(8, v.getFloat64(o));
      case 0xcc: return step(1, bytes[o]); case 0xcd: return step(2, v.getUint16(o)); case 0xce: return step(4, v.getUint32(o));
      case 0xd0: return step(1, v.getInt8(o)); case 0xd1: return step(2, v.getInt16(o)); case 0xd2: return step(4, v.getInt32(o));
      case 0xd9: return str(step(1, bytes[o])); case 0xda: return str(step(2, v.getUint16(o)));
      case 0xdc: return array(step(2, v.getUint16(o))); case 0xdd: return array(step(4, v.getUint32(o)));
      case 0xde: return map(step(2, v.getUint16(o))); case 0xdf: return map(step(4, v.getUint32(o)));
      default: throw new Error('pack byte ' + b);
    }
  }
  return read();
}
// One page's data, back in the shape MindAR's matcher expects.
const pages = new Map();
function page(pack, i) {
  if (pages.get(i)?.pack === pack) return pages.get(i);
  const { off, len, first } = pack.head.pages[i], block = unpack(new Uint8Array(pack.buffer, pack.blocks + off, len));
  let at = first;
  const points = (count, maxima, s) => Array.from({ length: count }, () => {
    const k = at++;
    return { maxima, x: pack.wx[k] * s, y: pack.wy[k] * s, scale: pack.ws[k] * s, angle: pack.wa[k], descriptors: Array.from(pack.desc.subarray(k * W, k * W + W)) };
  });
  const matching = block.kf.map((k) => ({
    maximaPoints: points(k.a, true, k.scale), minimaPoints: points(k.b, false, k.scale), maximaPointsCluster: k.ac, minimaPointsCluster: k.bc, width: k.width, height: k.height, scale: k.scale,
  }));
  const entry = { pack, matching, track: block.track };
  pages.set(i, entry);
  return entry;
}
// MindAR builds its worker from a private script; the same script is started here `count` more times.
export function captureWorkers(count) {
  const extra = [];
  let done = false;
  window.Worker = class extends Native {
    constructor(url, opts) { super(url, opts); if (!done) { done = true; window.Worker = Native; for (let i = 0; i < count; i++) extra.push(new Native(url, opts)); } }
  };
  return extra;
}
export function installFast(ctl, workers, { maxPoints = 150, url, onFail } = {}) {
  const l = startPack(url);
  l.onFail = onFail;
  if (l.failed) onFail?.();
  let base = null;
  const send = ctl.worker.postMessage.bind(ctl.worker);
  ctl.worker.postMessage = (msg, ...rest) => {
    if (msg.type === 'setup') base = msg;   // the matching workers are given their pages on demand
    return send(msg, ...rest);
  };
  const holds = workers.map(() => []);   // the pages each worker has right now
  const give = (n, list) => {
    if (list.every((i) => holds[n].includes(i))) return;
    holds[n] = list;
    workers[n].postMessage({ ...base, matchingDataList: list.map((i) => page(l.pack, i).matching) });
  };
  let waiting = null;
  workers.forEach((w, n) => { w.onmessage = ({ data }) => { if (data.type === 'matchDone' && waiting) waiting(n, data); }; });
  const candidates = (points) => new Promise((resolve) => { l.onCands = resolve; l.worker.postMessage({ type: 'query', points }); });
  const scan = (points, list) => new Promise((resolve) => {
    if (!workers.length) { resolve(MISS); return; }   // the camera was stopped while a scan was on its way
    const stride = points.length / maxPoints;
    const pts = stride > 1 ? Array.from({ length: maxPoints }, (_, i) => points[Math.floor(i * stride)]) : points;
    const shares = workers.map(() => []);
    list.forEach((i) => shares[i % workers.length].push(i));
    let left = 0, hit = null;
    waiting = (n, d) => {
      if (d.targetIndex !== -1 && !hit) hit = { targetIndex: holds[n][d.targetIndex], modelViewTransform: d.modelViewTransform };
      if (--left === 0) { waiting = null; resolve(hit || MISS); }
    };
    shares.forEach((share, n) => {
      if (!share.length) return;
      give(n, share); left++;
      workers[n].postMessage({ type: 'match', featurePoints: pts, targetIndexes: share.map((i) => holds[n].indexOf(i)) });
    });
    if (!left) resolve(MISS);
  });
  ctl._workerMatch = async (points, indexes) => {
    if (!l.pack) return MISS;   // the camera is up before the pages finish arriving
    const list = indexes.length > 3 ? await candidates(points) : indexes;
    return list.length ? scan(points, list) : MISS;
  };
  // The placeholder pages have no pictures; the real one replaces it the moment the page is found.
  const tracked = new Set();
  const track = (i) => {
    if (tracked.has(i)) return;
    tracked.add(i);
    const tr = ctl.tracker, kf = page(l.pack, i).track, built = tr._prebuild(kf, tr.featurePointsListT[0].shape[0]);
    tr.trackingKeyframeList[i] = kf; tr.featurePointsListT[i] = built.featurePoints; tr.imagePixelsListT[i] = built.imagePixels; tr.imagePropertiesListT[i] = built.imageProperties;
  };
  // MindAR warms up by tracking every page once. One page is enough to build the shared programs.
  ctl.dummyRun = (input) => { const t = ctl.inputLoader.loadInput(input); ctl.cropDetector.detect(t); ctl.tracker.track(t, [[1, 1, 1, 1], [1, 1, 1, 1], [1, 1, 1, 1]], 0); t.dispose(); };
  const detect = ctl._detectAndMatch.bind(ctl);
  let pending = -1, tries = 0;
  ctl._detectAndMatch = async (input, indexes) => {
    if (pending !== -1) {
      const r = await detect(input, indexes.includes(pending) ? [pending] : indexes);
      if (r.targetIndex === pending) { track(pending); pending = -1; return r; }
      if (++tries >= 6) pending = -1;
      return MISS;
    }
    const r = await detect(input, indexes);
    if (r.targetIndex !== -1) { pending = r.targetIndex; tries = 0; return MISS; }
    return r;
  };
}
