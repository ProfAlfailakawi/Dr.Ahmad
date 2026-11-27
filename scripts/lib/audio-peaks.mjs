import { spawn } from 'node:child_process'

export const AUDIO_PEAK_COUNT = 180

/** يفك الصوت إلى mono/8kHz في الذاكرة ثم يختصره إلى ذُرى صحيحة 0–100. */
export function extractAudioPeaks(input, count = AUDIO_PEAK_COUNT) {
  return new Promise((resolve, reject) => {
    const child = spawn('ffmpeg', [
      '-v', 'error', '-i', input,
      '-map', '0:a:0', '-ac', '1', '-ar', '8000', '-f', 's16le', 'pipe:1',
    ], { stdio: ['ignore', 'pipe', 'pipe'] })
    const chunks = []
    let error = ''
    child.stdout.on('data', (chunk) => chunks.push(chunk))
    child.stderr.on('data', (chunk) => { error += chunk })
    child.on('error', reject)
    child.on('close', (code) => {
      if (code !== 0) { reject(new Error(error.trim() || `ffmpeg exited ${code}`)); return }
      const pcm = Buffer.concat(chunks)
      const samples = Math.floor(pcm.length / 2)
      if (!samples) { resolve([]); return }
      const bucket = Math.max(1, Math.ceil(samples / count))
      const raw = []
      for (let start = 0; start < samples; start += bucket) {
        let peak = 0
        const end = Math.min(samples, start + bucket)
        for (let index = start; index < end; index += 1) peak = Math.max(peak, Math.abs(pcm.readInt16LE(index * 2)))
        raw.push(peak)
      }
      const ceiling = Math.max(...raw, 1)
      resolve(raw.slice(0, count).map((value) => Math.max(1, Math.min(100, Math.round((value / ceiling) * 100)))))
    })
  })
}
