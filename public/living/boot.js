// Loaded before everything else: the pages and the recognition library start arriving at once, side by side, while the
// rest of the app loads. A visit that opens something other than the camera (lecture, remote, previews) skips this.
import { startPack } from './fast.js?v=11';
const q = new URLSearchParams(location.search);
if (!q.has('lecture') && !q.get('remote') && !q.has('home') && !location.hash.includes('show=')) {
  startPack(new URL('targets/all.pack.gz?v=11', import.meta.url).href);
  import('mindar-image-three').catch(() => { /* app.js reports it when it needs the library */ });
}
