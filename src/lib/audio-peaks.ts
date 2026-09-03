type AudioPeaksFile = { peaks?: Record<string, number[]> }
let cache: Record<string, number[]> | null = null
let pending: Promise<Record<string, number[]>> | null = null

const fileName = (source: string) => {
  try { return decodeURIComponent(new URL(source, location.origin).pathname.split('/').pop() || '') }
  catch { return decodeURIComponent(source.split('?', 1)[0].split('/').pop() || '') }
}

export async function loadAudioPeaks(source: string): Promise<number[] | null> {
  if (!pending) pending = import('../data/audio-peaks.json')
    .then((module) => {
      const file = (module.default || module) as AudioPeaksFile
      cache = file.peaks || {}
      return cache
    })
    .catch(() => (cache = {}))
  const map = cache || await pending
  return map[fileName(source)] || null
}
