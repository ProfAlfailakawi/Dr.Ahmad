#!/usr/bin/env node
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
import { atomicWriteJson, countArabicWords, planReadingPerformance } from './lib/arabic-audio-engine.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const EXECUTE = process.argv.includes('--execute')
const WITH_DIALOGUE = process.argv.includes('--with-dialogue')
const pilotLimitArg = process.argv.find((argument) => argument.startsWith('--pilot-limit='))
const PILOT_LIMIT = Math.max(1, Number(pilotLimitArg?.split('=')[1] || 7))
const pilotSlugArg = process.argv.find((argument) => argument.startsWith('--pilot-slug='))
const PILOT_SLUG = pilotSlugArg?.slice('--pilot-slug='.length).trim() || ''
const bodies = JSON.parse(readFileSync(resolve(ROOT, 'src/data/bodies.json'), 'utf8'))
const data = readFileSync(resolve(ROOT, 'src/data.ts'), 'utf8')
const articleBlock = (data.match(/export const articles = \[([\s\S]*?)\n\]/) || ['', ''])[1]
const titles = Object.fromEntries([...articleBlock.matchAll(/slug: '([^']+)', title: '((?:\\'|[^'])+)'/g)]
  .map((match) => [match[1], match[2].replace(/\\'/g, "'")]))

const rows = Object.entries(bodies).map(([slug, body]) => {
  const sentences = String(body).split(/(?<=[.!؟])\s+|\n+/).filter(Boolean)
  const lengths = sentences.map(countArabicWords).filter(Boolean)
  const averageSentenceWords = lengths.length ? lengths.reduce((sum, value) => sum + value, 0) / lengths.length : 0
  return { slug, title: titles[slug] || slug, body: String(body), words: countArabicWords(body), averageSentenceWords,
    hasNumbers: /\d|٪|%/.test(body),
    human: /(الإنسان|الطفل|الطالب|الخوف|الألم|الأسرة|الكرامة)/.test(body),
    education: /(التعليم|التقييم|المعلم|المدرسة|التعلم)/.test(body),
    critical: /(لكن|المشكلة|نرفض|خطر|وهم|لا يكفي)/.test(body),
    story: /(كنت|دخل|عاد|قال|رأيت|تخيل|في يوم|عندما كنت)/.test(body),
  }
})

const picked = new Set()
const choose = (label, predicate, sort) => {
  const candidates = rows.filter((row) => !picked.has(row.slug) && predicate(row))
  // الاختبار السمعي يجب أن يمثل المقالات الفعلية المعتادة (350–450 كلمة تقريبًا)،
  // لا أن يستهلك الرصيد على مادة أرشيفية شديدة الطول.
  const normalLength = candidates.filter((row) => row.words >= 330 && row.words <= 470)
  const candidate = (normalLength.length ? normalLength : candidates).sort(sort)[0]
  if (!candidate) return null
  picked.add(candidate.slug)
  return { label, ...candidate }
}
const descWords = (left, right) => right.words - left.words
const selection = [
  choose('إنساني عاطفي', (row) => row.human, descWords),
  choose('تربوي تحليلي', (row) => row.education, descWords),
  choose('أرقام ونسب', (row) => row.hasNumbers, descWords),
  choose('نقدي قوي', (row) => row.critical, descWords),
  choose('قصصي', (row) => row.story, descWords),
  choose('جمل قصيرة', () => true, (left, right) => left.averageSentenceWords - right.averageSentenceWords),
  choose('جمل طويلة', () => true, (left, right) => right.averageSentenceWords - left.averageSentenceWords),
].filter(Boolean)
const requestedPilot = PILOT_SLUG ? rows.find((row) => row.slug === PILOT_SLUG) : null
if (PILOT_SLUG && !requestedPilot) throw new Error(`مقال Pilot غير موجود: ${PILOT_SLUG}`)
const executionSelection = requestedPilot
  ? [{ label: 'اختبار مخصص', ...requestedPilot }]
  : selection

const report = {
  generatedAt: new Date().toISOString(),
  status: EXECUTE ? 'execution_requested' : 'plan_only',
  note: 'الاختيار حتمي ومتنوع. لا تعني المقاييس الآلية اعتماداً سمعياً؛ يلزم Blind A/B بشري.',
  samples: selection.map((article) => ({
    label: article.label, slug: article.slug, title: article.title, words: article.words,
    averageSentenceWords: Math.round(article.averageSentenceWords * 10) / 10,
    sourceHash: createHash('sha256').update(article.body).digest('hex'),
    plans: Object.fromEntries(['fahed', 'noura'].map((voiceKey) => {
      const plan = planReadingPerformance({ title: article.title, sourceText: article.body, voiceKey })
      return [voiceKey, { units: plan.units.length,
        targetWpmRange: [Math.min(...plan.units.map((unit) => unit.targetWordsPerMinute)),
          Math.max(...plan.units.map((unit) => unit.targetWordsPerMinute))],
        semanticTypes: [...new Set(plan.units.map((unit) => unit.type))],
        highRiskWords: plan.units.flatMap((unit) => unit.risks.map((risk) => risk.word)),
      }]
    })),
  })),
}

const out = resolve(ROOT, 'audio-audits/pilot-selection.json')
mkdirSync(dirname(out), { recursive: true })
atomicWriteJson(out, report)
console.log(`✔ خطة Pilot متنوعة: ${selection.length} مقالات · ${out}`)

if (EXECUTE) {
  if (!process.env.AZURE_SPEECH_KEY || (!process.env.GEMINI_API_KEY && !process.env.GOOGLE_API_KEY)) {
    throw new Error('يتطلب تنفيذ Pilot مفاتيح Azure وGemini؛ إنشاء الخطة وحده لا يحتاج شبكة')
  }
  for (const article of executionSelection.slice(0, PILOT_LIMIT)) {
    const reading = spawnSync(process.execPath, [resolve(ROOT, 'scripts/auto-audio.mjs'),
      `--slug=${article.slug}`, '--base-only', '--upgrade-existing', '--limit=2'],
    { cwd: ROOT, stdio: 'inherit', env: process.env })
    if (reading.status !== 0) throw new Error(`فشل Pilot القراءة: ${article.slug}`)
    if (WITH_DIALOGUE) {
      const dialogue = spawnSync(process.execPath, [resolve(ROOT, 'scripts/podcast-dialogue.mjs'),
        `--slug=${article.slug}`, '--lang=ar', '--pilot=1', '--force'],
      { cwd: ROOT, stdio: 'inherit', env: process.env })
      if (dialogue.status !== 0) throw new Error(`فشل Pilot الحوار: ${article.slug}`)
    }
  }
}
