// Hand-built scenes for the pages (one file per page in ./pages), loaded only when that page is recognised.
// ready.js is written by tools/gen-v3.mjs: the pages that exist and each page's `meta`.
import { READY, META } from './ready.js?v=25';
export { READY, META };
export const BUILDERS = new Map();
const loading = new Map();
export function loadPage(n) {
  if (!loading.has(n)) loading.set(n, import(`./pages/p${n}.js?v=25`).then((m) => { if (typeof m.default !== 'function') throw new Error('p' + n + ' has no default build(ctx)'); BUILDERS.set(n, m); return m; }));
  return loading.get(n);
}
export const v3ready = Promise.resolve();   // kept for the test tools: nothing is waited for any more
if (typeof window !== 'undefined') window.__v3ready = v3ready;
