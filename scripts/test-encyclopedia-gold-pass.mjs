#!/usr/bin/env node
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  getEncyclopediaTranscriptProgress,
  searchEncyclopediaVideoMoments,
} from '../src/server/encyclopedia-videos.mjs'
import { applyTranscriptCorrections, compileTranscriptCorrections, normalizeArabicSearchText } from '../src/lib/encyclopedia-transcript-quality.mjs'
import { buildTranscriptReport } from './lib/encyclopedia-buzz-transcripts.mjs'

const root = resolve(import.meta.dirname, '..')
const read = (file) => readFileSync(resolve(root, file), 'utf8')
const json = (file) => JSON.parse(read(file))
let checks = 0
const check = (condition, message) => { assert.ok(condition, message); checks += 1 }

const index = json('src/data/encyclopedia-video-transcripts.json')
const corrections = json('src/data/encyclopedia-transcript-corrections.json')
const quality = json('src/data/encyclopedia-transcript-quality-report.json')
const passagesData = json('src/data/book-passages.json')
const teachingData = json('src/data/encyclopedia-teaching-map.json')
const structureData = json('src/data/encyclopedia-structure.json')
const log = json('src/data/encyclopedia-transcript-correction-log.json')
const records = Object.values(index.records || {})
const intros = records.filter((record) => record.contentType === 'encyclopedia-introduction')
const noSpeech = records.filter((record) => record.status === 'no-speech')
const transcribed = records.filter((record) => record.available && Array.isArray(record.segments) && record.segments.length)
const compiled = compileTranscriptCorrections(corrections)

check(index.version >= 3 && index.catalogCount === 169 && records.length === 169, 'الفهرس الذهبي يغطي الكتالوج كاملاً')
check(index.progress.processed === 169 && index.progress.completed === 169 && index.progress.missing === 0, 'تمت معالجة 169 من 169 بلا نقص')
check(transcribed.length === 166 && noSpeech.length === 3, '166 تفريغاً زمنياً و3 فيديوهات بلا كلام')
check(intros.length === 2 && intros.every((record) => !record.doorNumber && !record.chapterNumber && record.mappingSource === 'manual-confirmed' && record.mappingReviewStatus === 'reviewed'), 'الفيديوهان التعريفيان لا يُجبران على باب أو فصل')
check(noSpeech.every((record) => !record.available && record.checked && record.reviewStatus === 'reviewed' && record.transcriptReviewStatus === 'not-applicable' && record.noSpeechVerification === 'manual-audio-review'), 'الفيديوهات بلا كلام موثقة ولا يعاد تفريغها')
check(index.progress.needsReview === 0 && quality.blockingIssues.length === 0, 'لا توجد ملاحظة مانعة أو تصنيف مجهول')
check(index.progress.processingPercent === 100 && index.progress.transcriptionPercent === 98.22, 'التقرير يفصل المعالجة الكاملة عن نسبة التفريغ النصي')

const intro = index.records.emisZzaICy8
check(intro.text.includes('الدكتور أحمد حسين الفيلكاوي') && intro.text.includes('الدكتور عبدالعزيز العنزي'), 'الأسماء الأساسية مصححة بصيغتها المعتمدة')
check(intro.segments[0].originalText.includes('الفالد شاوي') && intro.segments[0].text.includes('أحمد حسين الفيلكاوي'), 'النص الخام محفوظ بجانب النص المصحح')
check(!intro.text.includes('الفالد شاوي') && !intro.text.includes('عبدالأزيز لعنزي') && !intro.text.includes('أول موسوع '), 'التحريفات المعروفة لا تظهر للزائر')
check(log.count > 0 && log.items.some((item) => item.videoId === 'emisZzaICy8' && item.kind === 'proper-name'), 'سجل التصحيح يوثق السبب والموضع')
check(quality.counts.correctedSegments > 0 && quality.counts.correctionOccurrences >= quality.counts.correctedSegments, 'تقرير الجودة يحصي المقاطع والتصحيحات')

const invalidSegments = []
for (const record of transcribed) {
  check(record.text === record.segments.map((segment) => segment.text).join(' '), `النص الكامل متطابق مع المقاطع: ${record.videoId}`)
  for (const segment of record.segments) {
    if (!(Number.isFinite(segment.start) && Number.isFinite(segment.end) && segment.start >= 0 && segment.end > segment.start && segment.text && segment.displayText && segment.originalText && segment.searchText)) invalidSegments.push({ videoId: record.videoId, segment })
  }
}
check(invalidSegments.length === 0, 'كل المقاطع ذات توقيت صالح ونص خام وعرض وفهرسة')
check(records.filter((record) => record.quality?.status === 'boilerplate-only').length === 3, 'المقاطع الدعائية الخالصة معزولة عن البحث ولا تحذف الفيديو')
check(records.filter((record) => record.quality?.status === 'boilerplate-only').every((record) => record.indexableSegmentCount === 0 && record.segments.every((segment) => segment.indexable === false)), 'لا تدخل عبارة اشترك في القناة إلى نتائج المعرفة')

const sampleCorrection = applyTranscriptCorrections('قادة الاتصال هي الأداء والتغذي الرجيّة', compiled)
check(sampleCorrection.text.includes('قناة الاتصال هي الأداة') && sampleCorrection.text.includes('التغذية الراجعة'), 'محرك التصحيح يطبق المصطلحات الأكاديمية المؤكدة')
const boundarySample = applyTranscriptCorrections('التصميم التعليمي والبرامج التعليمية والمتعلمين والطلبة', compiled)
check(boundarySample.text === 'التصميم التعليمي والبرامج التعليمية والمتعلمين والطلبة', 'قواعد التصحيح لا تفسد لواحق الكلمات الصحيحة')
const adjectiveSample = applyTranscriptCorrections('معلم تكنولوجي وتعليم تفاعلي تكنولوجي', compiled)
check(adjectiveSample.text === 'معلم تكنولوجي وتعليم تفاعلي تكنولوجي', 'لا تُحوّل الصفة تكنولوجي إلى الاسم تكنولوجيا')
const suppressedSample = applyTranscriptCorrections('اللغة الكثير المستغربة وعلى لغتين هم ويقترح القول 2008', compiled)
check(suppressedSample.text === 'اللغة الكثير المستغربة وعلى لغتين هم ويقترح القول 2008', 'القواعد الدلالية غير المؤكدة لا تطبق على نص العرض')
check(index.records.VzJCd6CoH8o.text.includes('لتشهد عام 1967') && !index.records.VzJCd6CoH8o.text.includes('لشهد عام'), 'التصحيح السياقي لا ينتج تركيباً مكسوراً')
check(index.records.TJ4zPzvZLmk.text.includes('يوضع للفيلم دليل للمعلم'), 'تصحيح دليل الفيلم محافظ ومتسق مع الجملة')
check(index.records.b8vOCmLiCwA.text.includes('جامعة ييل') && index.records.b8vOCmLiCwA.segments.some((segment) => segment.originalText.includes('جامعة مال')), 'اسم جامعة ييل يصحح بصورة محدودة مع حفظ النص الخام')
const unintelligible = index.records.ZUHJ9QUIgrU
check(unintelligible.excludedSegments?.length === 1 && unintelligible.quality?.excludedSegmentCount === 1 && !unintelligible.text.includes('ما سيصلك تلك المياه') && !unintelligible.text.includes('المؤسسات القائمة'), 'المقطع غير المفهوم محفوظ للتدقيق ومستبعد من العرض والبحث بلا اختلاق')
const truncated = index.records.msj1d0QU4k0
check(truncated.originalText.includes('تطوير قدو-') && !truncated.text.includes('تطوير قدو-') && !truncated.text.includes('تطوير قدرات المتعلمين') && truncated.quality?.omittedFragmentCount === 1, 'النهاية المبتورة تحذف من العرض فقط ولا تستكمل بكلام غير مسموع')
check(quality.counts.suppressedUncertainRules === 3 && quality.counts.excludedUnintelligibleSegments === 1 && quality.counts.omittedFragments === 2, 'تقرير الجودة يفصل القواعد المستبعدة والمقاطع غير المفهومة والنهايات المبتورة')
const allDisplayText = transcribed.flatMap((record) => record.segments.map((segment) => segment.text)).join(' ')
check(!/(?:التعليميي|التعليميةة|المتعلمن|الطلبةة|التكنوجية|أزدحام|الأتية|التدريسة|اتتعرضه|سوث موتون|كولوتشتاين|\.\.\.)/u.test(allDisplayText), 'لا تبقى التحريفات المعروفة أو النصوص المبتورة في نص العرض')
check(log.items.every((item) => item.source && item.confidence), 'كل تصحيح مطبق موثق بمصدر ودرجة ثقة')
check(!log.items.some((item) => ['gold-suppressed-programming-language', 'gold-suppressed-foreign-terms', 'gold-suppressed-author-2008'].includes(item.ruleId)), 'القواعد المستبعدة لا تدخل سجل التصحيحات المطبقة')
check(normalizeArabicSearchText('إِنترنت ١٢') === 'انترنت 12', 'الفهرسة تطبع التشكيل والهمزات والأرقام من دون تغيير العرض')

const progress = getEncyclopediaTranscriptProgress()
check(progress.total === 169 && progress.processed === 169 && progress.available === 166 && progress.noSpeech === 3 && progress.needsReview === 0, 'الخادم يعرض حالة الإنجاز الحقيقية')
const programmed = await searchEncyclopediaVideoMoments({ query: 'التعليم المبرمج', limit: 5 })
check(programmed.moments.some((moment) => moment.hasExactTiming && moment.startSeconds >= 0 && /التعليم المبرمج/u.test(moment.excerpt)), 'البحث يصل إلى لحظة حقيقية لمصطلح التعليم المبرمج')
check(programmed.moments.every((moment, index, all) => all.slice(0, index).every((previous) => previous.videoId !== moment.videoId || normalizeArabicSearchText(previous.excerpt) !== normalizeArabicSearchText(moment.excerpt))), 'لا تتكرر اللحظة نفسها من الفيديو بلا قيمة')
check(programmed.moments[0]?.matchReason && programmed.moments[0]?.matchReasonLabel, 'النتيجة تشرح سبب ظهورها')
const flipped = await searchEncyclopediaVideoMoments({ query: 'الفصل المعكوس', limit: 5 })
check(flipped.moments.some((moment) => moment.hasExactTiming && /المقلوب|المعكوس/u.test(moment.excerpt)), 'المرادفات تصل إلى المقطع الزمني الصحيح')
check(flipped.moments.filter((moment) => moment.videoId === 'JNa3t4VhCnw').length === 1, 'السياق المجاور لا يصنع توقيتاً ثانياً وهمياً داخل الفيديو')
const nameSearch = await searchEncyclopediaVideoMoments({ query: 'أحمد الفيلكاوي', limit: 5 })
check(nameSearch.moments.length === 1 && nameSearch.moments[0]?.videoId === 'emisZzaICy8' && nameSearch.moments[0]?.contentType === 'encyclopedia-introduction', 'البحث في الاسم يصل حصراً إلى المادة التعريفية ولا يصنع نتائج عامة')

const encyclopediaBook = passagesData.books?.find((book) => book.slug === 'encyclopedia')
const directBookPassages = (encyclopediaBook?.passages || []).filter((passage) => normalizeArabicSearchText(`${passage.text} ${passage.conceptTitle || ''}`).includes(normalizeArabicSearchText('تكنولوجيا التعليم')))
check(directBookPassages.some((passage) => Number(passage.page) > 0), 'متن الكتاب يحتوي صفحات حقيقية قابلة للربط')
const presentations = new Map((structureData.doors || []).map((door) => [door.id, door.presentation || '']))
const teachingTopics = Object.entries(teachingData).flatMap(([doorId, door]) => Object.entries(door.topics || {}).map(([title, topic]) => ({ doorId, title, presentation: presentations.get(doorId), ...topic })))
check(teachingTopics.every((topic) => !topic.ranges?.length || (topic.presentation && topic.ranges.every((range) => range.from > 0 && range.to >= range.from))), 'كل مادة تدريس قابلة للعرض لها ملف ونطاق شرائح موثق')

const report = buildTranscriptReport({ index, importReport: {} })
check(report.processed === 169 && report.available === 166 && report.noSpeech === 3 && report.unmapped.length === 0 && report.missing === 0, 'تقرير Buzz لا يعد المواد التعريفية غير مصنفة')

const server = read('src/server/encyclopedia-videos.mjs')
const results = read('src/components/EncyclopediaKnowledgeResults.tsx')
const client = read('src/lib/encyclopedia-videos.ts')
const knowledgeSource = read('src/lib/encyclopedia-knowledge-search.ts')
const portal = read('src/components/EncyclopediaPortal.tsx')
const docker = read('Dockerfile')
const cloud = read('.gcloudignore')
check(server.includes('dr-ahmad-domain-glossary.json') && server.includes('encyclopedia-transcript-corrections.json') && server.includes('buildSearchExpansionGroups'), 'الخادم يربط القاموس والتصحيحات بمحرك البحث')
check(server.includes("segment.indexable !== false") && server.includes("matchReasonLabel"), 'الخادم يستبعد الضوضاء ويشرح سبب المطابقة')
check(results.includes('مادة تعريفية للموسوعة') && !results.includes('لماذا ظهرت هذه النتيجة؟') && !results.includes('افتح صفحة') && results.includes('بلا كلام'), 'واجهة النتائج تعرض الحالات بلا تفسير زائد أو رابط لفتح الكتاب')
check((results.match(/لم يوجد مقطع زمني موثوق/g) || []).length === 1, 'رسالة غياب التوقيت لا تتكرر بصرياً')
check(!results.includes('#page=${Math.max') && !results.includes('encyclopedia.pdf#page=') && results.includes('encyclopediaSlideRangeLabel'), 'بطاقة المتن لا تفتح الكتاب وتبقى الشرائح متاحة')
check(!portal.includes('scrollIntoView') && portal.includes('data-horizontal-video-rail="true"'), 'الهاتف لا يقفز عمودياً ويحافظ على السحب الأفقي')
check(!server.includes('مقدمات ومواد عامة') && !results.includes('مقدمات ومواد عامة'), 'القسم المحذوف لا يعود')
check(client.includes('processingPercent') && client.includes('matchReasonLabel') && knowledgeSource.includes('matchReason'), 'أنواع TypeScript تغطي بيانات Gold Pass')
check(docker.includes('COPY src/data/encyclopedia-transcript-corrections.json') && docker.includes('COPY src/lib/encyclopedia-transcript-quality.mjs'), 'صورة Cloud Run تضم موارد Gold Pass')
check(cloud.includes('!src/data/encyclopedia-transcript-corrections.json') && cloud.includes('!src/lib/encyclopedia-transcript-quality.mjs'), 'سياق Cloud Build يسمح بموارد Gold Pass')
check(existsSync(resolve(root, 'src/data/encyclopedia-transcript-quality-report.json')) && existsSync(resolve(root, 'src/data/encyclopedia-transcript-correction-log.json')), 'تقارير الجودة والتصحيح موجودة وقابلة للتدقيق')

console.log(`✓ Encyclopedia Gold Pass: ${checks} checks passed.`)
