// Fast recognition on top of MindAR, with no change to the library:
// - fast-index.js narrows every frame to the few likely pages, so a frame costs almost the same for 7 pages or 107;
// - the pages are shared between several workers, one per spare CPU core, instead of one worker scanning all of them;
// - each frame is limited to its strongest spread of points;
// - pages near the last one found are tried first (a reader moves through the book in order);
// - a page counts only after it matches twice, so a one-frame coincidence never opens the wrong page.
const MISS = { targetIndex: -1, modelViewTransform: null };
const Native = window.Worker;
// MindAR builds its worker from a private script; the same script is started here `count` more times.
export function captureWorkers(count) {
  const extra = [];
  let done = false;
  window.Worker = class extends Native {
    constructor(url, opts) { super(url, opts); if (!done) { done = true; window.Worker = Native; for (let i = 0; i < count; i++) extra.push(new Native(url, opts)); } }
  };
  return extra;
}
export function installFast(ctl, workers, { maxPoints = 150 } = {}) {
  const shard = new Map();                    // target -> [worker, local index]
  let indexReady = false, onCands = null;
  const index = new Native(new URL('./fast-index.js?v=10', import.meta.url));
  workers.index = index;
  index.onerror = () => { indexReady = false; if (onCands) onCands(null); };   // without the index every page is simply scanned
  index.onmessage = ({ data }) => { if (data.type === 'ready') indexReady = true; else if (onCands) { window.__indexMs = data.ms; onCands(data.list); } };
  const send = ctl.worker.postMessage.bind(ctl.worker);
  ctl.worker.postMessage = (msg, ...rest) => {
    if (msg.type !== 'setup') return send(msg, ...rest);
    workers.forEach((w, n) => {
      const list = msg.matchingDataList.filter((_, i) => i % workers.length === n);
      msg.matchingDataList.forEach((_, i) => { if (i % workers.length === n) shard.set(i, [w, Math.floor(i / workers.length)]); });
      w.postMessage({ ...msg, matchingDataList: list });
    });
    index.postMessage({ type: 'setup', matchingDataList: msg.matchingDataList });
    return send({ ...msg, matchingDataList: [] }, ...rest);   // the first worker keeps only the pose refinement
  };
  let waiting = null;
  workers.forEach((w, n) => { w.onmessage = ({ data }) => { if (data.type === 'matchDone' && waiting) waiting(n, data); }; });
  const toGlobal = (n, local) => local * workers.length + n;
  const candidates = (pts) => new Promise((resolve) => { onCands = (list) => { onCands = null; resolve(list); }; index.postMessage({ type: 'query', points: pts }); });
  ctl._workerMatch = async (points, indexes) => {
    let list = indexes;
    if (indexReady && indexes.length > 3) { const c = await candidates(points); if (!c) list = indexes; else if (!c.length) return MISS; else list = c; }
    return scan(points, list);
  };
  const scan = (points, indexes) => new Promise((resolve) => {
    const stride = points.length / maxPoints;
    const pts = stride > 1 ? Array.from({ length: maxPoints }, (_, i) => points[Math.floor(i * stride)]) : points;
    const jobs = new Map();
    for (const i of indexes) { const [w, local] = shard.get(i); if (!jobs.has(w)) jobs.set(w, []); jobs.get(w).push(local); }
    let left = jobs.size, hit = null;
    waiting = (n, d) => { if (d.targetIndex !== -1 && !hit) hit = { targetIndex: toGlobal(n, d.targetIndex), modelViewTransform: d.modelViewTransform };
      if (--left === 0) { waiting = null; resolve(hit || MISS); } };
    for (const [w, list] of jobs) w.postMessage({ type: 'match', featurePoints: pts, targetIndexes: list });
  });
  const detect = ctl._detectAndMatch.bind(ctl);
  let last = 0, pending = -1, tries = 0;
  ctl._detectAndMatch = async (input, indexes) => {
    if (pending !== -1) {
      const r = await detect(input, indexes.includes(pending) ? [pending] : indexes);
      if (r.targetIndex === pending) { last = pending; pending = -1; return r; }
      if (++tries >= 6) pending = -1;
      return MISS;
    }
    const ordered = [...indexes].sort((a, b) => Math.abs(a - last) - Math.abs(b - last));
    const r = await detect(input, ordered);
    if (r.targetIndex !== -1) { pending = r.targetIndex; tries = 0; return MISS; }
    return r;
  };
}
