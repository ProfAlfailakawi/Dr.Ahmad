#!/usr/bin/env node
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { tmpdir } from 'node:os'
import {
  importBuzzDirectory,
  normalizeTranscriptSearchText,
  parseTranscriptText,
  buildTranscriptReport,
} from './lib/encyclopedia-buzz-transcripts.mjs'

let checks = 0
const check = (condition, message) => { assert.ok(condition, message); checks += 1 }
const root = resolve(import.meta.dirname, '..')
const temporary = mkdtempSync(join(tmpdir(), 'encyclopedia-buzz-'))

try {
  const vtt = parseTranscriptText('WEBVTT\n\n00:00:01.000 --> 00:00:03.500\nالتَّعليمُ المُبرمج\n', '.vtt')
  check(vtt.segments.length === 1 && vtt.segments[0].start === 1, 'يستورد VTT العربي')
  const srt = parseTranscriptText('1\n00:00:04,000 --> 00:00:06,500\nالحاسب والكمبيوتر\n', '.srt')
  check(srt.segments.length === 1 && srt.segments[0].end === 6.5, 'يستورد SRT')
  const compactVtt = parseTranscriptText('WEBVTT\n00:00:01.000 --> 00:00:02.000\nسطر أول\n00:00:02.000 --> 00:00:03.000\nسطر ثانٍ\n', '.vtt')
  check(compactVtt.segments.length === 2, 'يستورد VTT حتى عند غياب السطر الفارغ بين المقاطع')
  const json = parseTranscriptText(JSON.stringify({ segments: [{ start: 7, end: 9, text: 'الوسائط المتعددة' }] }), '.json')
  check(json.segments.length === 1 && json.segments[0].text.includes('الوسائط'), 'يستورد JSON')
  check(parseTranscriptText('WEBVTT\n', '.vtt').segments.length === 0, 'يرفض الملف الفارغ')
  check(parseTranscriptText('WEBVTT\n\n-00:00:01.000 --> 00:00:03.000\nخطأ\n', '.vtt').segments.length === 0, 'يرفض التوقيت السالب')
  check(parseTranscriptText('1\n00:00:08,000 --> 00:00:06,000\nخطأ\n', '.srt').segments.length === 0, 'يرفض end الأصغر من start')
  const overlap = parseTranscriptText('WEBVTT\n\n00:00:01.000 --> 00:00:04.000\nنص واحد\n\n00:00:03.000 --> 00:00:05.000\nنص واحد\n', '.vtt')
  check(overlap.segments.length === 1 && overlap.segments[0].end === 5, 'يدمج التكرار المتداخل بحذر')
  const rolling = parseTranscriptText('WEBVTT\n\n00:00:01.000 --> 00:00:03.000\nالتعليم المبرمج\n\n00:00:02.500 --> 00:00:05.000\nالتعليم المبرمج خطوة بخطوة\n', '.vtt')
  check(rolling.segments.length === 2 && rolling.segments[1].text === 'خطوة بخطوة', 'يزيل تكرار الترجمة المتدحرجة من دون تغيير الكلام الجديد')
  check(normalizeTranscriptSearchText('إِنترنت ١٢') === 'انترنت 12', 'يطبع الهمزات والتشكيل والأرقام للبحث فقط')
  check(parseTranscriptText('WEBVTT\n\n00:00:01.000 --> 00:00:02.000\n[موسيقى]\n', '.vtt').segments.length === 0, 'يحذف الضوضاء غير المفيدة')

  const input = join(temporary, 'input')
  mkdirSync(input)
  const catalogFile = join(temporary, 'catalog.json')
  const structureFile = join(temporary, 'structure.json')
  const outputFile = join(temporary, 'output.json')
  const catalog = { videos: [
    { id: 'knownVideo1', title: 'التعليم المبرمج', description: '', doorNumber: 1, chapterNumber: 1, mappingSource: 'manual-approved', mappingConfidence: 'exact' },
    { id: 'knownVideo2', title: 'فيديو بلا تفريغ', description: '' },
  ] }
  const structure = { doors: [{ id: 'door-1', doorNumber: 1, title: 'الأول', units: [{ number: 1, title: 'الفصل الأول' }] }] }
  writeFileSync(catalogFile, JSON.stringify(catalog))
  writeFileSync(structureFile, JSON.stringify(structure))
  writeFileSync(outputFile, JSON.stringify({ version: 2, records: {} }))
  writeFileSync(join(input, 'knownVideo1.vtt'), 'WEBVTT\n\n00:00:03.000 --> 00:00:07.000\nالتعليم المبرمج خطوة بخطوة\n')
  writeFileSync(join(input, 'unknownVideo.vtt'), 'WEBVTT\n\n00:00:01.000 --> 00:00:02.000\nمجهول\n')
  writeFileSync(join(input, 'knownVideo1.srt'), '1\n00:00:03,000 --> 00:00:07,000\nالتعليم المبرمج خطوة بخطوة\n')
  const imported = await importBuzzDirectory({ inputDir: input, outputFile, catalogFile, structureFile, now: () => '2026-08-04T00:00:00.000Z' })
  const record = imported.index.records.knownVideo1
  check(imported.report.imported === 1, 'يستورد ملفاً صالحاً واحداً لكل فيديو')
  check(imported.report.unknown.length === 1, 'يبلغ عن video ID غير الموجود')
  check(imported.report.duplicates.length === 1, 'يبلغ عن الملفات المكررة')
  check(record.videoId === 'knownVideo1' && record.sourceFile.endsWith('.vtt'), 'يربط بواسطة video ID ويطبق أولوية VTT')
  check(record.doorNumber === 1 && record.chapterNumber === 1 && record.doorId === 'door-1', 'يحفظ الباب والفصل الصحيحين')
  check(record.available && record.status === 'transcribed' && record.source === 'buzz', 'لا يعلن الاكتمال إلا مع مقاطع فعلية')
  check(record.segmentCount === 1 && record.lastTimestamp === 7, 'يحفظ عدد المقاطع وآخر توقيت')
  check(imported.index.records.knownVideo2.available === false, 'metadata وحدها ليست تفريغاً')
  const firstHash = record.sourceHash
  const resumed = await importBuzzDirectory({ inputDir: input, outputFile, catalogFile, structureFile })
  check(resumed.report.skipped === 1 && resumed.index.records.knownVideo1.sourceHash === firstHash, 'يتخطى الملف غير المتغير للاستئناف')

  writeFileSync(join(input, 'knownVideo1.vtt'), 'WEBVTT\n')
  const failedNew = await importBuzzDirectory({ inputDir: input, outputFile, catalogFile, structureFile, force: true })
  check(failedNew.index.records.knownVideo1.available === true && failedNew.index.records.knownVideo1.segmentCount === 1, 'لا يحذف التفريغ الصالح عند فشل الملف الجديد')
  const report = buildTranscriptReport({ index: failedNew.index, importReport: failedNew.report })
  check(report.total === 2 && report.available === 1 && report.missing === 1, 'التقرير يحسب المنجز والمتبقي بدقة')
  check(report.needsReview === 2, 'التقرير يجمع التفريغ غير المراجع والفيديو غير المصنف من دون احتساب metadata المصنفة')
  check(report.unmapped.includes('knownVideo2'), 'التقرير يكشف الفيديو غير المصنف')

  const server = readFileSync(resolve(root, 'src/server/encyclopedia-videos.mjs'), 'utf8')
  const portal = readFileSync(resolve(root, 'src/components/EncyclopediaPortal.tsx'), 'utf8')
  const results = readFileSync(resolve(root, 'src/components/EncyclopediaKnowledgeResults.tsx'), 'utf8')
  const docker = readFileSync(resolve(root, 'Dockerfile'), 'utf8')
  const cloud = readFileSync(resolve(root, '.gcloudignore'), 'utf8')
  const gitignore = readFileSync(resolve(root, '.gitignore'), 'utf8')
  check(server.includes('STATIC_TRANSCRIPT_SOURCES') && !server.includes('fetchWithDeadline(fetchImpl, `https://www.youtube.com/watch'), 'الخادم يستخدم فهرساً ثابتاً بلا جلب ترجمة وقت الزيارة')
  check(server.includes('hasExactTiming: exact') && results.includes('moment.hasExactTiming'), 'لا يعرض توقيتاً وهمياً')
  check(results.includes('#page=${') && results.includes('encyclopediaSlideRangeLabel') && results.includes('fileName(primarySlide.presentation)'), 'يربط PDF والشرائح واسم ملف العرض')
  check(!portal.includes('scrollIntoView') && portal.includes('data-horizontal-video-rail="true"'), 'لا يقفز عمودياً ويحافظ على السحب الأفقي')
  check(docker.includes('COPY src/data/encyclopedia-video-transcripts.json') && docker.includes('COPY src/data/encyclopedia-search-synonyms.json'), 'Docker يضم الفهرس والقاموس صراحة')
  check(cloud.includes('!src/data/encyclopedia-video-transcripts.json') && cloud.includes('!src/data/encyclopedia-search-synonyms.json'), 'سياق Cloud Build يسمح بالملفات المطلوبة')
  check(gitignore.includes('local-data/encyclopedia-buzz-transcripts/*') && gitignore.includes('whisper-models'), 'ملفات Buzz والنماذج والصوت لا تدخل Git')
  check(!server.includes('مقدمات ومواد عامة') && !results.includes('مقدمات ومواد عامة'), 'القسم المحذوف لا يعود')
  check(results.includes('شاهد من') && results.includes('شاهد من البداية'), 'تجربة التشغيل تميز اللحظة الموثقة عن البداية')
  check(results.includes('{primarySlide && (') && !results.includes('لا توجد مادة تدريس مرتبطة'), 'لا يعرض بطاقة مواد تدريس فارغة عند ضعف المطابقة')

  console.log(`✓ Buzz transcript import self-test: ${checks} checks passed.`)
} finally {
  rmSync(temporary, { recursive: true, force: true })
}
