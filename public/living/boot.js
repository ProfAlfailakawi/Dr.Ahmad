// Runs before everything else, so the slow parts of opening happen side by side instead of one after another:
// the pages, the recognition library and the camera all start now, while the rest of the app loads.
// A visit that opens something other than the camera (lecture, remote, previews) skips that.
import { startPack } from './fast.js?v=31';
const q = new URLSearchParams(location.search);
if (!q.has('lecture') && !q.get('remote') && !q.has('home') && !location.hash.includes('show=')) {
  startPack(new URL('targets/all.pack.gz?v=15', import.meta.url).href);
  import('mindar-image-three').catch(() => { /* app.js reports it when it needs the library */ });
  // The camera is asked for now and handed to the recognition library when it asks; a refusal reaches it unchanged.
  const media = navigator.mediaDevices;
  if (media?.getUserMedia) {
    const ask = media.getUserMedia.bind(media);
    let early = ask({ audio: false, video: { facingMode: 'environment' } });
    early.catch(() => {});
    media.getUserMedia = (wanted) => {
      if (!early || wanted?.audio) return ask(wanted);
      const stream = early; early = null;
      return stream;
    };
  }
}
// The fonts arrive without holding back the scripts (a stylesheet in the page head makes every script wait for it).
const fonts = document.createElement('link');
fonts.rel = 'stylesheet';
fonts.href = 'https://fonts.googleapis.com/css2?family=Reem+Kufi:wght@500;700&family=Tajawal:wght@400;500;700;800&display=swap';
document.head.append(fonts);
