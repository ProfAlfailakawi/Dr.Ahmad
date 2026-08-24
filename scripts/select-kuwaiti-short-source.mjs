#!/usr/bin/env node
/**
 * يستبدل متن Firestore الكامل بالمكثف المقفول قبل التوليد، بعد أن يبرهن
 * أن كل دور قصير موجود في المتن المقفول نفسه وبالترتيب وللمتحدث نفسه.
 * يبقى revisionId الأصلي كما هو: النسخة القصيرة مشتقة حتمياً منه، وتُضاف
 * بصمتها وعدد أدوارها إلى القفل كي لا تختلط بالمصدر الكامل في التدقيق.
 */
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const arg = (name) => process.argv.find((v) => v.startsWith(`--${name}=`))?.slice(name.length + 3) || ''
const slugs = arg('slugs').split(',').map((s) => s.trim()).filter(Boolean)
assert.ok(slugs.length, 'مرّر --slugs=slug[,slug]')

/* [٢٢ أغسطس ٢٠٢٦] خط الاعتماد يقرأ v3 — إيقاع الديوانية بكلمات الدكتور،
   وجسوره مصحّحة بأمره («الجسور لازم تكون في مكانها الصحيح»): كل جسر عند
   تبادلٍ حقيقي بين المتحدثَين ولا احتكار بعده. والمكثف القديم يبقى بديلاً
   إن غاب v3، فلا يسقط المسار على مستودعٍ قديم. */
const V3 = resolve(ROOT, 'src/data/kuwaiti-diwania-v3.json')
const OLD = resolve(ROOT, 'src/data/kuwaiti-dialogues-short.json')
const SHORT_SRC = process.env.PODCAST_KW_SHORT_LIB || (existsSync(V3) ? V3 : OLD)
const shortLib = JSON.parse(readFileSync(SHORT_SRC, 'utf8'))
console.log('المصدر القصير: ' + SHORT_SRC.split('/').pop())
const sha256 = (value) => createHash('sha256').update(value).digest('hex')
const turnsOf = (value) => Array.isArray(value) ? value : Object.values(value || {})
/* [٢٢ أغسطس ٢٠٢٦] v3 **يقسّم** المداخلة الطويلة إلى مداخلتين بنفس
   الكلمات (حدٌّ جديد عند نقطةٍ أو فاصلة) — فالتطابق الحرفي وحده كان
   يرفضها ويقفل خط الاعتماد. الضمانة تبقى كما هي في جوهرها: **لا كلمة
   من خارج متن Firestore المقفول**. فيُقبل الجزءُ المتّصل من مداخلةٍ
   مقفولة، ويُرفض ما عداه. والواو المستأنَفة تُقتنص كما كانت. */
const norm = (v) => String(v).replace(/\s+/g, ' ').trim()
/* v3 القديم كان يسمح بإضافة واحدة من إشارتين صوتيتين على رأس المداخلة
   («إي والله.» أو «ممم…») حتى لو لم تكونا في متن Firestore. هذا يناقض
   عقد هذه الخطوة: الصوت لا يأخذ كلمةً واحدةً من خارج النص المقفول.
   نبقي الإشارة إذا كانت موجودة فعلاً في المتن، وإلا نجرب النسخة المنزوعة
   فقط؛ لا يوجد هنا تعميم على أي حشو أو إعادة صياغة أخرى. */
const SYNTHETIC_INTERJECTION = /^(?:إي والله\.|ممم…)\s+/u
const textVariants = (value) => {
  const original = norm(value)
  const withoutSyntheticInterjection = original.replace(SYNTHETIC_INTERJECTION, '').trim()
  return withoutSyntheticInterjection && withoutSyntheticInterjection !== original
    ? [original, withoutSyntheticInterjection]
    : [original]
}
const sameText = (full, short, allowShortIndexedPart = false) => {
  const f = norm(full); const t = norm(short)
  if (f === t || f === `و${t}`) return true
  if (t.length < 8 && !allowShortIndexedPart) return false
  return f.includes(t) || f.includes(`و${t}`) || `و${f}`.includes(t)
}

for (const slug of slugs) {
  assert.match(slug, /^[a-z0-9-]+$/, `slug غير صالح: ${slug}`)
  const sourceFile = resolve(ROOT, 'manual-dialogues-kuwaiti', `${slug}.json`)
  const lockFile = resolve(ROOT, 'podcast-audits', 'source-locks-kuwaiti', `${slug}.json`)
  const full = turnsOf(JSON.parse(readFileSync(sourceFile, 'utf8')))
  const selectedRaw = turnsOf(shortLib.episodes?.[slug])
  const lock = JSON.parse(readFileSync(lockFile, 'utf8'))
  assert.ok(full.length > selectedRaw.length && selectedRaw.length >= 15, `${slug}: المصدر القصير غير منطقي (${full.length}→${selectedRaw.length})`)
  assert.equal(selectedRaw.filter((t) => t.musicBridgeAfter).length, 2, `${slug}: يلزم جسران في النسخة القصيرة`)

  const selected = []
  let removedSyntheticInterjections = 0
  let cursor = 0
  for (const [i, turn] of selectedRaw.entries()) {
    let found = -1
    let matchedText = ''
    for (const variant of textVariants(turn.text)) {
      found = full.findIndex((candidate, j) => j >= cursor && candidate.speaker === turn.speaker
        && sameText(String(candidate.text), variant, Number(turn._src) === j))
      if (found >= 0) { matchedText = variant; break }
    }
    assert.ok(found >= 0, `${slug}: الدور القصير ${i} ليس جزءاً مرتباً من متن Firestore المقفول: ${turn.text}`)
    const preparedTurn = matchedText === norm(turn.text) ? turn : { ...turn, text: matchedText }
    if (preparedTurn !== turn) removedSyntheticInterjections += 1
    selected.push(preparedTurn)
    /* دورٌ مقفولٌ واحد قد يلد شطرين متتاليين — فلا يتقدّم المؤشر إلا
       حين ينتقل الشطر التالي إلى مداخلةٍ أخرى. */
    const next = selectedRaw[i + 1]
    const nextMatchedText = next && next.speaker === turn.speaker
      ? textVariants(next.text).find((variant) => sameText(String(full[found].text), variant, Number(next._src) === found))
      : ''
    const stillSame = Boolean(nextMatchedText) && norm(full[found].text) !== norm(nextMatchedText)
    cursor = stillSame ? found : found + 1
  }

  const serialized = JSON.stringify(selected, null, 2) + '\n'
  writeFileSync(sourceFile, serialized)
  writeFileSync(lockFile, JSON.stringify({
    ...lock,
    sourceVariant: 'condensed-2m30-v1',
    fullTurnCount: full.length,
    turnCount: selected.length,
    bridgeCount: 2,
    shortContentSha256: sha256(serialized),
  }, null, 2) + '\n')
  const removedNote = removedSyntheticInterjections ? ` · نُزعت ${removedSyntheticInterjections} إشارة غير مقفولة` : ''
  console.log(`✓ ${slug}: المصدر المقفول ${full.length}→${selected.length} دوراً · جسران${removedNote} · بصمة ${sha256(serialized).slice(0, 12)}`)
}
