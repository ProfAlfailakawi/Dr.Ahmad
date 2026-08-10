#!/usr/bin/env node
/**
 * فهرس التفريغات الخفيف — كي لا يحمل زائرُ الأرشيف ميغابايتاً ليقرأ عناوين.
 *
 * الجذر: `media-archive-transcripts.json` يقارب ١٫١ ميغابايت (كلّ كلمةٍ قيلت في
 * عشرين لقاءً بتوقيتاتها). كان يُستورد استيراداً ساكناً في `lib/media-archive.ts`
 * فيدخل حزمة صفحة /media كاملاً، بينما الصفحة لا تحتاج منه إلا شارة «مفهرس زمنياً»
 * — أي حقل `available` وحده. أما المقاطع فلا تُقرأ إلا عند البحث داخل الكلام أو
 * عند فتح لقاءٍ بعينه.
 *
 * فهذا الملف يستخرج البطاقة التعريفية لكل تفريغ (بلا مقاطع) في ملفٍ صغير
 * يُستورد ساكناً، ويبقى الثقيل يُجلب عند الطلب بـ import() ديناميكي.
 *
 * التشغيل: node scripts/build-media-transcript-index.mjs
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const SOURCE = resolve(ROOT, 'src/data/media-archive-transcripts.json')
const OUT = resolve(ROOT, 'src/data/media-archive-transcript-index.json')

if (!existsSync(SOURCE)) {
  console.error('✘ لا يوجد src/data/media-archive-transcripts.json')
  process.exit(1)
}

const source = JSON.parse(readFileSync(SOURCE, 'utf8'))
const index = {}
for (const [id, transcript] of Object.entries(source || {})) {
  if (!transcript || typeof transcript !== 'object') continue
  index[id] = {
    id: transcript.id || id,
    available: Boolean(transcript.available),
    source: transcript.source || 'none',
    language: transcript.language || 'ar',
    segmentCount: Number(transcript.segmentCount || (transcript.segments || []).length || 0),
    ...(transcript.indexedAt ? { indexedAt: transcript.indexedAt } : {}),
  }
}

const payload = `${JSON.stringify(index, null, 2)}\n`
const previous = existsSync(OUT) ? readFileSync(OUT, 'utf8') : ''
if (previous === payload) {
  console.log(`• فهرس التفريغات الخفيف كما هو (${Object.keys(index).length} مادة)`)
} else {
  writeFileSync(OUT, payload)
  console.log(`✓ فهرس التفريغات الخفيف: ${Object.keys(index).length} مادة → src/data/media-archive-transcript-index.json`)
}
