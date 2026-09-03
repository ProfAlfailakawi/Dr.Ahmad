import audioMeta from '../data/audio-meta.json'

type AudioMetaRow = {
  sha256?: string
  sourceHash?: string
  validationStatus?: string
  bytes?: number
  durationSeconds?: number
}

const meta = audioMeta as Record<string, AudioMetaRow>

/** Exact binary proofs for the published voices of one article, not booleans or URLs. */
export function audioProofAssets(slug = '') {
  const prefix = `${slug}.`
  return Object.entries(meta)
    .filter(([file, row]) => file.startsWith(prefix) && file.endsWith('.mp3') && /^[a-f0-9]{64}$/i.test(row.sha256 || '') && row.validationStatus === 'verified-r2')
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([file, row]) => `${file}|sha256:${row.sha256}|source:${row.sourceHash || 'unknown'}|bytes:${Number(row.bytes || 0)}|seconds:${Number(row.durationSeconds || 0)}`)
}

