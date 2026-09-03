#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { dialogueHashes, loadSourceLock } from './lib/manual-dialogue-source.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const arg = (name, fallback = '') => {
  const raw = process.argv.find((item) => item.startsWith(`--${name}=`))
  return raw ? raw.slice(name.length + 3) : fallback
}
const phase = arg('phase', 'source')
const slugs = arg('slugs', arg('slug', '')).split(',').map((item) => item.trim()).filter(Boolean)
if (!slugs.length) throw new Error('لم يُحدد slug للتحقق من قفل الحوار')

const speakerFromAudit = (value) => String(value).toUpperCase() === 'B' ? 'female' : 'male'

for (const slug of slugs) {
  const { path: lockPath, lock } = loadSourceLock(ROOT, slug)
  const manualPath = resolve(ROOT, 'manual-dialogues', `${slug}.json`)
  if (!existsSync(manualPath)) throw new Error(`${slug}: ملف الحوار اليدوي المحلي مفقود`)
  const source = dialogueHashes(JSON.parse(readFileSync(manualPath, 'utf8')))
  if (source.contentSha256 !== lock.contentSha256) throw new Error(`${slug}: بصمة كلمات الحوار تغيّرت بعد سحبها من السحابة`)
  if (source.revisionSha256 !== lock.revisionSha256) throw new Error(`${slug}: بصمة نسخة الحوار الكاملة تغيّرت بعد سحبها من السحابة`)
  if (source.turnCount !== Number(lock.turnCount)) throw new Error(`${slug}: عدد المداخلات لا يطابق القفل السحابي`)

  if (phase === 'output') {
    const auditPath = resolve(ROOT, 'podcast-audits', `${slug}.ar.json`)
    const transcriptPath = resolve(ROOT, 'audio', `${slug}.dialogue.json`)
    if (!existsSync(auditPath)) throw new Error(`${slug}: تقرير التوليد غير موجود`)
    if (!existsSync(transcriptPath)) throw new Error(`${slug}: Transcript النهائي غير موجود`)
    const audit = JSON.parse(readFileSync(auditPath, 'utf8'))
    if (audit.dialogueSource !== 'manual-upload-locked') throw new Error(`${slug}: المحرك لم يثبت أن المصدر هو الحوار المرفوع المقفول`)
    if (audit.manualSource?.contentSha256 !== lock.contentSha256
      || audit.manualSource?.revisionSha256 !== lock.revisionSha256) {
      throw new Error(`${slug}: بصمة المصدر داخل تقرير المحرك لا تطابق الحوار المرفوع`)
    }
    const auditTurns = (audit.dialogue?.utterances || []).map((item) => ({
      speaker: speakerFromAudit(item.speaker),
      text: String(item.dialogueText ?? ''),
      deliveryType: 'statement', pauseAfterMs: 0, overlapMs: 0, musicBridgeAfter: false,
    }))
    const auditContent = dialogueHashes(auditTurns).contentSha256
    if (auditContent !== lock.contentSha256) throw new Error(`${slug}: كلمات/متحدثو تقرير المحرك لا تطابق الحوار المرفوع حرفياً`)

    const transcript = JSON.parse(readFileSync(transcriptPath, 'utf8'))
    const transcriptTurns = (transcript.utterances || []).map((item, index) => ({
      speaker: source.turns[index]?.speaker,
      text: String(item.text ?? ''),
      deliveryType: 'statement', pauseAfterMs: 0, overlapMs: 0, musicBridgeAfter: false,
    }))
    const transcriptContent = dialogueHashes(transcriptTurns).contentSha256
    if (transcriptContent !== lock.contentSha256) throw new Error(`${slug}: Transcript المنشور لا يطابق كلمات الحوار المرفوع حرفياً`)
    if (transcript.sourceLock?.contentSha256 !== lock.contentSha256
      || transcript.sourceLock?.revisionSha256 !== lock.revisionSha256) {
      throw new Error(`${slug}: إثبات المصدر مفقود من Transcript النهائي`)
    }

    const evidence = {
      ...lock,
      verifiedAt: new Date().toISOString(),
      verification: {
        sourceFile: true,
        engineAudit: true,
        publicTranscript: true,
        exactSpeakerAndTextMatch: true,
      },
    }
    mkdirSync(dirname(lockPath), { recursive: true })
    writeFileSync(lockPath, `${JSON.stringify(evidence, null, 2)}\n`)
    console.log(`🔒 ${slug}: تطابق حرفي مثبت — السحابة = ملف التوليد = تقرير المحرك = Transcript`)
  } else {
    console.log(`🔒 ${slug}: قفل المصدر سليم (${source.turnCount} مداخلة · ${source.contentSha256.slice(0, 12)})`)
  }
}
