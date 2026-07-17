export type LockableDialogueTurn = {
  speaker: 'male' | 'female'
  text: string
  deliveryType?: string
  pauseAfterMs?: number
  overlapMs?: number
  musicBridgeAfter?: boolean
}

export type DialogueFingerprint = {
  turns: Required<LockableDialogueTurn>[]
  contentSha256: string
  revisionSha256: string
  revisionId: string
  turnCount: number
}

export const MANUAL_DIALOGUE_SCHEMA_VERSION = 2

export function canonicalizeDialogueTurns(value: LockableDialogueTurn[]): Required<LockableDialogueTurn>[] {
  if (!Array.isArray(value) || value.length < 2) throw new Error('الحوار يحتاج مداخلتين على الأقل')
  const turns = value.map((item, index) => {
    const speaker = item?.speaker
    if (speaker !== 'male' && speaker !== 'female') throw new Error(`المتحدث في المداخلة ${index + 1} غير صالح`)
    const text = String(item?.text ?? '').replace(/\r\n?/g, '\n').trim()
    if (!text) throw new Error(`المداخلة ${index + 1} بلا نص`)
    return {
      speaker,
      text,
      deliveryType: String(item.deliveryType || 'statement').trim() || 'statement',
      pauseAfterMs: Math.max(0, Math.min(3000, Number(item.pauseAfterMs ?? 560) || 0)),
      overlapMs: Math.max(0, Math.min(150, Number(item.overlapMs ?? 0) || 0)),
      musicBridgeAfter: Boolean(item.musicBridgeAfter),
    }
  })
  if (new Set(turns.map((turn) => turn.speaker)).size !== 2) throw new Error('الحوار يجب أن يحتوي الرجل والمرأة معاً')
  return turns
}

export function canonicalDialogueContent(turns: Required<LockableDialogueTurn>[]) {
  return JSON.stringify(turns.map(({ speaker, text }) => ({ speaker, text })))
}

export function canonicalDialogueRevision(turns: Required<LockableDialogueTurn>[]) {
  return JSON.stringify({ schemaVersion: MANUAL_DIALOGUE_SCHEMA_VERSION, turns })
}

async function sha256Hex(value: string) {
  if (!globalThis.crypto?.subtle) throw new Error('متصفحك لا يدعم بصمة SHA-256 الآمنة')
  const digest = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
}

export async function fingerprintDialogue(value: LockableDialogueTurn[]): Promise<DialogueFingerprint> {
  const turns = canonicalizeDialogueTurns(value)
  const [contentSha256, revisionSha256] = await Promise.all([
    sha256Hex(canonicalDialogueContent(turns)),
    sha256Hex(canonicalDialogueRevision(turns)),
  ])
  return { turns, contentSha256, revisionSha256, revisionId: revisionSha256, turnCount: turns.length }
}
