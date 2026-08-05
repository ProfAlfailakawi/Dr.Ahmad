#!/usr/bin/env node
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const read = (file) => JSON.parse(readFileSync(resolve(root, file), 'utf8'))
const index = read('src/data/encyclopedia-video-transcripts.json')
const quality = read('src/data/encyclopedia-transcript-quality-report.json')
const corrections = read('src/data/encyclopedia-transcript-correction-log.json')
const progress = index.progress || {}
const counts = quality.counts || {}

console.log([
  'Encyclopedia Gold Pass',
  `إجمالي الفيديوهات: ${progress.total || index.catalogCount || 0}`,
  `تمت معالجتها: ${progress.processed || progress.completed || 0}`,
  `تفريغ زمني فعلي: ${progress.transcribed || progress.available || 0}`,
  `بلا كلام بعد التحقق: ${progress.noSpeech || 0}`,
  `مواد تعريفية: ${progress.introductions || 0}`,
  `مقاطع زمنية: ${counts.segments || 0}`,
  `مقاطع قابلة للبحث: ${counts.indexableSegments || 0}`,
  `مقاطع مصححة: ${counts.correctedSegments || 0}`,
  `مواضع تصحيح موثقة: ${counts.correctionOccurrences || 0}`,
  `قواعد تصحيح مستخدمة: ${counts.correctionRulesUsed || 0}`,
  `قواعد غير مؤكدة مستبعدة: ${counts.suppressedUncertainRules || 0}`,
  `مقاطع غير مفهومة مستبعدة: ${counts.excludedUnintelligibleSegments || 0}`,
  `نهايات ASR مبتورة محذوفة من العرض: ${counts.omittedFragments || 0}`,
  `مجموعات توسيع البحث: ${counts.searchExpansionGroups || 0}`,
  `ملاحظات مانعة: ${quality.blockingIssues?.length || 0}`,
  `سجل التصحيحات: ${corrections.count || 0}`,
  `نسبة المعالجة: ${progress.processingPercent || 0}%`,
  `نسبة التفريغ النصي: ${progress.transcriptionPercent || 0}%`,
].join('\n'))
