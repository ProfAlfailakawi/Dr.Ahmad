#!/usr/bin/env node
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  applySegmentPolicies,
  applyTranscriptCorrections,
  assessSegmentQuality,
  buildSearchExpansionGroups,
  cleanDisplayText,
  compileTranscriptCorrections,
  isBoilerplateOnly,
  normalizeArabicSearchText,
} from '../src/lib/encyclopedia-transcript-quality.mjs'
import { atomicWriteJson } from './lib/encyclopedia-buzz-transcripts.mjs'

const root = resolve(import.meta.dirname, '..')
const transcriptFile = resolve(root, 'src/data/encyclopedia-video-transcripts.json')
const catalogFile = resolve(root, 'src/data/encyclopedia-videos-fallback.json')
const structureFile = resolve(root, 'src/data/encyclopedia-structure.json')
const correctionFile = resolve(root, 'src/data/encyclopedia-transcript-corrections.json')
const glossaryFile = resolve(root, 'src/data/dr-ahmad-domain-glossary.json')
const synonymsFile = resolve(root, 'src/data/encyclopedia-search-synonyms.json')
const reportFile = resolve(root, 'src/data/encyclopedia-transcript-quality-report.json')
const correctionLogFile = resolve(root, 'src/data/encyclopedia-transcript-correction-log.json')
const checkOnly = process.argv.includes('--check')

const readJson = (file, fallback) => {
  try { return JSON.parse(readFileSync(file, 'utf8')) } catch { return fallback }
}
const sha256 = (value) => createHash('sha256').update(String(value || '')).digest('hex')
const payload = readJson(transcriptFile, { version: 3, records: {} })
const now = checkOnly && payload.generatedAt ? String(payload.generatedAt) : new Date().toISOString()
const catalog = readJson(catalogFile, { videos: [] })
const structure = readJson(structureFile, { doors: [] })
const rules = readJson(correctionFile, {})
const glossary = readJson(glossaryFile, [])
const synonyms = readJson(synonymsFile, { groups: [] })
const compiled = compileTranscriptCorrections(rules)
const correctionVersion = Number(rules.version) || 1
const catalogById = new Map((catalog.videos || []).map((video) => [video.id, video]))
const doorByNumber = new Map((structure.doors || []).map((door) => [Number(door.doorNumber), door]))
const rawRecords = payload.records && typeof payload.records === 'object' ? payload.records : {}
const records = {}
const correctionLog = []
const qualityItems = []

const mappingFor = (videoId, record) => {
  const video = catalogById.get(videoId) || {}
  const isIntroduction = compiled.introductionVideoIds.has(videoId)
  if (isIntroduction) {
    return {
      contentType: 'encyclopedia-introduction',
      doorId: null,
      doorNumber: null,
      chapterNumber: null,
      chapterTitle: null,
      sequenceLabel: 'مادة تعريفية للموسوعة',
      mappingSource: 'manual-confirmed',
      mappingConfidence: 'confirmed',
      mappingReviewStatus: 'reviewed',
    }
  }
  const doorNumber = Number(record?.doorNumber || video?.doorNumber) || null
  const chapterNumber = Number(record?.chapterNumber || video?.chapterNumber) || null
  const door = doorByNumber.get(doorNumber) || null
  const chapter = door?.units?.find((item) => Number(item.number) === chapterNumber) || null
  const mapped = Boolean(door && chapter)
  return {
    contentType: 'encyclopedia-chapter-video',
    doorId: mapped ? String(door.id || record?.doorId || '') : null,
    doorNumber: mapped ? doorNumber : null,
    chapterNumber: mapped ? chapterNumber : null,
    chapterTitle: mapped ? String(chapter.title || record?.chapterTitle || '') : null,
    sequenceLabel: mapped ? `الباب ${doorNumber} · الفصل ${chapterNumber}` : '',
    mappingSource: mapped ? String(record?.mappingSource || video?.mappingSource || 'catalog') : 'needs-review',
    mappingConfidence: mapped ? String(record?.mappingConfidence || video?.mappingConfidence || 'exact') : 'unresolved',
    mappingReviewStatus: mapped ? 'reviewed' : 'needs-review',
  }
}

for (const [videoId, rawRecord] of Object.entries(rawRecords)) {
  const record = rawRecord && typeof rawRecord === 'object' ? rawRecord : {}
  const mapping = mappingFor(videoId, record)
  const noSpeech = compiled.noSpeechVideoIds.has(videoId) || record.status === 'no-speech'
  const sourceSegments = [
    ...(Array.isArray(record.segments) ? record.segments : []),
    ...(Array.isArray(record.excludedSegments) ? record.excludedSegments : []),
  ].sort((left, right) => Number(left?.start || 0) - Number(right?.start || 0))
  const polishedSegments = []
  const excludedSegments = []
  const sourceOriginalTexts = []
  let correctedSegments = 0
  let correctedOccurrences = 0
  let omittedFragmentCount = 0
  let indexableSegments = 0
  const videoFlags = new Set()

  if (!noSpeech) {
    for (const [segmentIndex, segment] of sourceSegments.entries()) {
      const start = Number(segment?.start)
      const end = Number(segment?.end)
      const originalText = cleanDisplayText(segment?.originalText || segment?.rawText || segment?.text)
      if (!Number.isFinite(start) || !Number.isFinite(end) || start < 0 || end <= start || !originalText) {
        videoFlags.add('invalid-segment')
        continue
      }
      sourceOriginalTexts.push(originalText)
      const result = applyTranscriptCorrections(originalText, compiled)
      const policyResult = applySegmentPolicies({ videoId, start, text: result.text, compiledOrRules: compiled })
      policyResult.flags.forEach((flag) => videoFlags.add(flag))
      if (policyResult.hiddenFromDisplay) {
        excludedSegments.push({
          start: Number(start.toFixed(3)),
          end: Number(end.toFixed(3)),
          originalText,
          reason: 'unintelligible',
          policyIds: policyResult.policies.map((item) => item.id),
        })
        continue
      }
      const displayText = policyResult.displayText
      const boilerplate = isBoilerplateOnly(displayText, compiled)
      const indexable = policyResult.indexable && !boilerplate
      const omissions = policyResult.omissions || []
      const occurrences = result.changes.reduce((sum, item) => sum + item.count, 0)
      const changed = result.changed || omissions.length > 0
      if (changed) correctedSegments += 1
      correctedOccurrences += occurrences
      omittedFragmentCount += omissions.length
      if (indexable) indexableSegments += 1
      const quality = assessSegmentQuality({
        originalText,
        displayText,
        start,
        end,
        indexable,
        correctionCount: occurrences,
      })
      quality.flags.forEach((flag) => videoFlags.add(flag))
      if (boilerplate) videoFlags.add('boilerplate-only')
      const correctionIds = result.changes.map((item) => item.id)
      polishedSegments.push({
        start: Number(start.toFixed(3)),
        end: Number(end.toFixed(3)),
        text: displayText,
        displayText,
        originalText,
        searchText: normalizeArabicSearchText(displayText),
        indexable,
        ...(correctionIds.length ? { correctionIds } : {}),
        ...(omissions.length ? { omissions } : {}),
      })
      for (const change of result.changes) {
        correctionLog.push({
          videoId,
          segmentIndex,
          start: Number(start.toFixed(3)),
          end: Number(end.toFixed(3)),
          ruleId: change.id,
          kind: change.kind,
          confidence: change.confidence,
          source: change.source,
          from: change.from,
          to: change.to,
          count: change.count,
          original: originalText,
          corrected: displayText,
        })
      }
      for (const omission of omissions) {
        correctionLog.push({
          videoId,
          segmentIndex,
          start: Number(start.toFixed(3)),
          end: Number(end.toFixed(3)),
          ruleId: omission.policyId,
          kind: 'omission',
          confidence: omission.confidence,
          source: omission.source,
          from: omission.fragment,
          to: '',
          count: 1,
          original: originalText,
          corrected: displayText,
          reason: omission.reason,
        })
      }
    }
  }

  const available = !noSpeech && polishedSegments.length > 0 && Boolean(record.source)
  const displayText = polishedSegments.map((segment) => segment.text).join(' ').trim()
  const originalText = sourceOriginalTexts.join(' ').trim()
  const changed = displayText !== originalText
  const transcriptReviewStatus = noSpeech ? 'not-applicable' : changed ? 'auto-corrected' : 'auto-transcribed'
  const qualityStatus = noSpeech
    ? 'verified-no-speech'
    : !available
      ? 'missing-transcript'
      : indexableSegments === 0
        ? 'boilerplate-only'
        : videoFlags.has('invalid-segment')
          ? 'needs-attention'
          : 'ready'

  records[videoId] = {
    ...record,
    videoId,
    available,
    checked: Boolean(record.checked || available || noSpeech),
    status: noSpeech ? 'no-speech' : available ? 'transcribed' : 'metadata-only',
    language: String(record.language || 'ar'),
    source: available ? record.source : null,
    title: String(record.title || catalogById.get(videoId)?.title || ''),
    description: String(record.description || catalogById.get(videoId)?.description || ''),
    ...mapping,
    reviewStatus: noSpeech ? 'reviewed' : transcriptReviewStatus,
    transcriptReviewStatus,
    segments: noSpeech ? [] : polishedSegments,
    ...(excludedSegments.length ? { excludedSegments } : {}),
    text: noSpeech ? '' : displayText,
    displayText: noSpeech ? '' : displayText,
    originalText: noSpeech ? '' : originalText,
    searchText: noSpeech ? '' : normalizeArabicSearchText(displayText),
    segmentCount: noSpeech ? 0 : polishedSegments.length,
    indexableSegmentCount: noSpeech ? 0 : indexableSegments,
    lastTimestamp: noSpeech ? 0 : Number(polishedSegments.at(-1)?.end || 0),
    correctionVersion,
    correctionCount: correctedOccurrences,
    correctedSegmentCount: correctedSegments,
    quality: {
      status: qualityStatus,
      flags: [...videoFlags].sort(),
      sourceSegmentCount: sourceSegments.length,
      validSegmentCount: polishedSegments.length,
      indexableSegmentCount: indexableSegments,
      correctedSegmentCount: correctedSegments,
      correctionCount: correctedOccurrences,
      omittedFragmentCount,
      excludedSegmentCount: excludedSegments.length,
      rawHash: sha256(originalText),
      displayHash: sha256(displayText),
      auditedAt: now,
    },
    ...(noSpeech ? {
      noSpeechVerification: String(record.noSpeechVerification || 'manual-audio-review'),
      noSpeechReason: String(record.noSpeechReason || 'verified-no-speech'),
      noSpeechVerifiedAt: String(record.noSpeechVerifiedAt || now),
      sourceFile: '', sourceHash: '', sourceBytes: 0, indexedAt: '',
    } : {}),
  }

  qualityItems.push({
    videoId,
    contentType: mapping.contentType,
    status: records[videoId].status,
    qualityStatus,
    segmentCount: records[videoId].segmentCount,
    indexableSegmentCount: records[videoId].indexableSegmentCount,
    correctedSegmentCount: correctedSegments,
    correctionCount: correctedOccurrences,
    omittedFragmentCount,
    excludedSegmentCount: excludedSegments.length,
    flags: [...videoFlags].sort(),
    mappingReviewStatus: mapping.mappingReviewStatus,
    transcriptReviewStatus,
  })
}

const recordList = Object.values(records)
const total = Number(payload.catalogCount) || recordList.length
const transcribed = recordList.filter((record) => record.available && record.segmentCount > 0).length
const noSpeech = recordList.filter((record) => record.status === 'no-speech').length
const processed = transcribed + noSpeech
const introductions = recordList.filter((record) => record.contentType === 'encyclopedia-introduction').length
const blockingNeedsReview = recordList.filter((record) => record.mappingReviewStatus === 'needs-review' || record.quality?.status === 'missing-transcript').length
const autoCorrected = recordList.filter((record) => record.transcriptReviewStatus === 'auto-corrected').length
const autoTranscribed = recordList.filter((record) => record.transcriptReviewStatus === 'auto-transcribed').length
const boilerplateOnly = recordList.filter((record) => record.quality?.status === 'boilerplate-only').length
const sources = { buzz: 0, 'youtube-captions': 0, 'manual-reviewed': 0 }
for (const record of recordList) if (record.available && Object.hasOwn(sources, record.source)) sources[record.source] += 1

const progress = {
  running: false,
  total,
  catalogued: total,
  completed: processed,
  processed,
  available: transcribed,
  transcribed,
  noSpeech,
  introductions,
  needsReview: blockingNeedsReview,
  missing: Math.max(0, total - processed),
  autoCorrected,
  autoTranscribed,
  boilerplateOnly,
  processingPercent: total ? Number(((processed / total) * 100).toFixed(2)) : 0,
  transcriptionPercent: total ? Number(((transcribed / total) * 100).toFixed(2)) : 0,
  sources,
}

const output = {
  ...payload,
  version: Math.max(3, Number(payload.version) || 0),
  generatedAt: now,
  catalogCount: total,
  correctionVersion,
  progress,
  records,
}

const groups = buildSearchExpansionGroups({ synonyms, glossary, corrections: rules })
const qualityReport = {
  version: 1,
  generatedAt: now,
  policy: 'تقرير آلي قابل للتدقيق؛ لا يصف التفريغ الآلي بأنه مراجعة بشرية.',
  progress,
  counts: {
    records: recordList.length,
    segments: recordList.reduce((sum, record) => sum + Number(record.segmentCount || 0), 0),
    indexableSegments: recordList.reduce((sum, record) => sum + Number(record.indexableSegmentCount || 0), 0),
    correctedSegments: recordList.reduce((sum, record) => sum + Number(record.correctedSegmentCount || 0), 0),
    correctionOccurrences: correctionLog.reduce((sum, item) => sum + Number(item.count || 0), 0),
    correctionRulesUsed: new Set(correctionLog.map((item) => item.ruleId)).size,
    omittedFragments: correctionLog.filter((item) => item.kind === 'omission').length,
    excludedUnintelligibleSegments: recordList.reduce((sum, record) => sum + Number(record.quality?.excludedSegmentCount || 0), 0),
    suppressedUncertainRules: compiled.entries.filter((entry) => entry.applyToDisplay === false || entry.applyToSearch === false).length,
    searchExpansionGroups: groups.length,
  },
  blockingIssues: qualityItems.filter((item) => item.mappingReviewStatus === 'needs-review' || item.qualityStatus === 'missing-transcript'),
  informationalFlags: qualityItems.filter((item) => item.flags.length || item.qualityStatus === 'boilerplate-only'),
  videos: qualityItems,
}
const correctionLogPayload = {
  version: 1,
  generatedAt: now,
  correctionVersion,
  policy: 'كل تعديل موثق مع النص الخام؛ لا تعني auto-corrected مراجعة بشرية.',
  count: correctionLog.length,
  items: correctionLog,
}

if (checkOnly) {
  const current = JSON.stringify(payload)
  const next = JSON.stringify(output)
  if (current !== next) {
    console.error('✘ فهرس الموسوعة يحتاج تشغيل encyclopedia:gold:polish قبل البناء.')
    process.exit(1)
  }
  console.log(`✓ Gold Pass check: ${total} معالجة، ${transcribed} تفريغاً زمنياً، ${noSpeech} بلا كلام، ${blockingNeedsReview} ملاحظات مانعة.`)
} else {
  atomicWriteJson(transcriptFile, output)
  atomicWriteJson(reportFile, qualityReport)
  atomicWriteJson(correctionLogFile, correctionLogPayload)
  console.log(`✓ تمت معالجة ${processed} من ${total}.`)
  console.log(`✓ تفريغ زمني فعلي: ${transcribed}.`)
  console.log(`✓ بلا كلام بعد التحقق: ${noSpeech}.`)
  console.log(`✓ مواد تعريفية: ${introductions}.`)
  console.log(`✓ مقاطع مصححة: ${qualityReport.counts.correctedSegments}، ومواضع تصحيح موثقة: ${qualityReport.counts.correctionOccurrences}.`)
  console.log(`✓ قواعد غير مؤكدة مستبعدة: ${qualityReport.counts.suppressedUncertainRules}، مقاطع غير مفهومة مستبعدة: ${qualityReport.counts.excludedUnintelligibleSegments}، نهايات ASR مبتورة محذوفة من العرض: ${qualityReport.counts.omittedFragments}.`)
  console.log(`✓ ملاحظات مانعة: ${blockingNeedsReview}.`)
}
