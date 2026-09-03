import { createHash } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

export const MANUAL_DIALOGUE_SCHEMA_VERSION = 2

const allowedSpeakers = new Set(['male', 'female'])

export function normalizeManualDialogueTurns(value, { minTurns = 2, requireBothSpeakers = true } = {}) {
  if (!Array.isArray(value) || value.length < minTurns) {
    throw new Error(`الحوار اليدوي يحتاج ${minTurns} مداخلتين على الأقل`)
  }
  const turns = value.map((item, index) => {
    if (!item || typeof item !== 'object') throw new Error(`المداخلة ${index + 1} غير صالحة`)
    const rawSpeaker = String(item.speaker || '').trim().toLowerCase()
    const speaker = rawSpeaker === 'a' ? 'male' : rawSpeaker === 'b' ? 'female' : rawSpeaker
    if (!allowedSpeakers.has(speaker)) throw new Error(`المتحدث في المداخلة ${index + 1} غير صالح`)
    const text = String(item.text ?? '').replace(/\r\n?/g, '\n').trim()
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
  if (requireBothSpeakers && new Set(turns.map((turn) => turn.speaker)).size !== 2) {
    throw new Error('الحوار اليدوي يجب أن يحتوي الرجل والمرأة معاً')
  }
  return turns
}

export function canonicalDialogueContent(turns) {
  return JSON.stringify(turns.map(({ speaker, text }) => ({ speaker, text })))
}

export function canonicalDialogueRevision(turns) {
  return JSON.stringify({ schemaVersion: MANUAL_DIALOGUE_SCHEMA_VERSION, turns })
}

export function sha256Text(text) {
  return createHash('sha256').update(String(text), 'utf8').digest('hex')
}

export function dialogueHashes(turns) {
  const normalized = normalizeManualDialogueTurns(turns)
  const contentSha256 = sha256Text(canonicalDialogueContent(normalized))
  const revisionSha256 = sha256Text(canonicalDialogueRevision(normalized))
  return {
    turns: normalized,
    contentSha256,
    revisionSha256,
    revisionId: revisionSha256,
    turnCount: normalized.length,
  }
}


export function validateCloudDialogueLock({ slug = 'unknown', dialogue = {}, production = {}, requireQueued = true } = {}) {
  const source = dialogueHashes(dialogue.turns)
  const fail = (message) => { throw new Error(`${slug}: ${message}`) }
  if (dialogue.source !== 'admin-upload' || Number(dialogue.schemaVersion) !== MANUAL_DIALOGUE_SCHEMA_VERSION)
    fail('الحوار لم يُحفظ عبر مسار الرفع المقفول الجديد')
  if (dialogue.contentSha256 !== source.contentSha256) fail('بصمة كلمات الحوار داخل Firestore غير صحيحة')
  if (dialogue.revisionSha256 !== source.revisionSha256 || dialogue.revisionId !== source.revisionId)
    fail('بصمة نسخة الحوار الكاملة داخل Firestore غير صحيحة')
  if (Number(dialogue.turnCount) !== source.turnCount) fail('عدد المداخلات المحفوظ لا يطابق المحتوى')
  if (requireQueued && production.status !== 'queued') fail('الحالة ليست queued؛ لن يبدأ Azure')
  if (production.sourceCollection !== 'podcast_dialogues') fail('مصدر قائمة الانتظار غير معتمد')
  if (production.expectedDialogueContentSha256 !== source.contentSha256
    || production.expectedDialogueRevisionSha256 !== source.revisionSha256
    || production.expectedDialogueRevisionId !== source.revisionId
    || Number(production.expectedTurnCount) !== source.turnCount)
    fail('الحوار تغيّر بعد الضغط على الإرسال؛ أعد قفله وإرساله من اللوحة')
  return source
}

export function sourceLockPath(root, slug) {
  return resolve(root, 'podcast-audits', 'source-locks', `${slug}.json`)
}

export function loadSourceLock(root, slug) {
  const path = sourceLockPath(root, slug)
  if (!existsSync(path)) throw new Error(`قفل مصدر الحوار مفقود: ${path}`)
  const lock = JSON.parse(readFileSync(path, 'utf8'))
  if (!lock || lock.slug !== slug || lock.mode !== 'manual-upload-locked') {
    throw new Error(`قفل مصدر الحوار غير صالح للحلقة ${slug}`)
  }
  return { path, lock }
}
