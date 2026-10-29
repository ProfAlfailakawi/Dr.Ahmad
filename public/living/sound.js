// Soft sounds made by the browser itself (Web Audio): no audio files, nothing to download.
// Browsers only allow sound after a first touch, so everything stays silent until then.
const MUTE_KEY = 'living-encyclopedia:muted';

let ctx = null, master = null, unlocked = false;
let muted = (() => { try { return localStorage.getItem(MUTE_KEY) === '1'; } catch { return false; } })();

function audio() {
  if (ctx) return ctx;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  ctx = new AC();
  master = ctx.createGain();
  master.gain.value = 0.55;
  const soften = ctx.createBiquadFilter(); // takes the edge off every sound
  soften.type = 'lowpass'; soften.frequency.value = 6500;
  master.connect(soften).connect(ctx.destination);
  return ctx;
}

export function unlockAudio() {
  const c = audio(); if (!c) return;
  if (c.state === 'suspended') c.resume();
  unlocked = true;
}
export const isMuted = () => muted;
export function setMuted(m) {
  muted = m;
  try { localStorage.setItem(MUTE_KEY, m ? '1' : '0'); } catch { /* private mode */ }
}
const ready = () => unlocked && !muted && audio() && ctx.state === 'running';

function tone(freq, at, dur, { type = 'sine', gain = 0.16, attack = 0.006, glide = null } = {}) {
  const t0 = ctx.currentTime + at;
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, t0);
  if (glide) o.frequency.exponentialRampToValueAtTime(glide, t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g).connect(master);
  o.start(t0); o.stop(t0 + dur + 0.05);
}

let noiseBuf = null;
function noise(at, dur, { gain = 0.08, low = 400, high = 4000, sweep = null } = {}) {
  if (!noiseBuf) {
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  const t0 = ctx.currentTime + at;
  const src = ctx.createBufferSource(); src.buffer = noiseBuf;
  const bp = ctx.createBiquadFilter(); bp.type = 'bandpass';
  bp.frequency.setValueAtTime(Math.sqrt(low * high), t0);
  if (sweep) bp.frequency.exponentialRampToValueAtTime(sweep, t0 + dur);
  bp.Q.value = 0.7;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + Math.min(0.05, dur / 3));
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  src.connect(bp).connect(g).connect(master);
  src.start(t0, Math.random() * 0.5); src.stop(t0 + dur + 0.05);
}

export const sfx = {
  // A page wakes up: a breath of paper, then a soft two-note chime.
  wake() { if (!ready()) return; noise(0, 0.45, { gain: 0.06, low: 900, high: 5000, sweep: 2400 }); tone(784, 0.18, 1.1, { gain: 0.07 }); tone(1175, 0.3, 1.3, { gain: 0.05 }); },
  tap() { if (!ready()) return; tone(660, 0, 0.12, { type: 'triangle', gain: 0.06 }); },
  discover() { if (!ready()) return; tone(880, 0, 0.35, { gain: 0.06 }); tone(1318, 0.07, 0.5, { gain: 0.045 }); },
  good() { if (!ready()) return; [523, 659, 784, 1046].forEach((f, i) => tone(f, i * 0.07, 0.45, { gain: 0.07 })); },
  bad() { if (!ready()) return; tone(196, 0, 0.35, { type: 'triangle', gain: 0.09, glide: 150 }); },
  pop() { if (!ready()) return; noise(0, 0.12, { gain: 0.12, low: 1500, high: 7000 }); tone(900, 0, 0.18, { gain: 0.06, glide: 300 }); },
  whoosh() { if (!ready()) return; noise(0, 0.5, { gain: 0.05, low: 300, high: 3000, sweep: 5000 }); },
  click() { if (!ready()) return; noise(0, 0.04, { gain: 0.12, low: 2000, high: 8000 }); tone(1800, 0, 0.03, { type: 'square', gain: 0.012 }); },
  // The golden stamp: a small bell.
  stamp() { if (!ready()) return; [[523, 0.09], [1046, 0.05], [1568, 0.03], [2093, 0.02]].forEach(([f, g]) => tone(f, 0, 2.2, { gain: g })); tone(392, 0.02, 1.4, { gain: 0.05 }); },
};
