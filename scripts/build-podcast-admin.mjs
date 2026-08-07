#!/usr/bin/env node
/**
 * يبني manifest خفيف للوحة البودكاست من ملفات audio الحوارية.
 * لا يعتمد على المتصفح، ولا يضيف حلقات غير موجودة.
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const AUDIO = resolve(ROOT, 'audio')
const DATA = readFileSync(resolve(ROOT, 'src/data.ts'), 'utf8')
const OUT = resolve(ROOT, 'src/data/podcast-admin.json')
const AUDITS = resolve(ROOT, 'podcast-audits')
const EXTERNAL_AUDIO_BASE_URL = (process.env.AUDIO_PUBLIC_BASE_URL || process.env.VITE_AUDIO_BASE_URL || '').replace(/\/+$/, '')
const podcastStatePath = resolve(ROOT, '.podcast-state.json')
const podcastState = existsSync(podcastStatePath) ? JSON.parse(readFileSync(podcastStatePath, 'utf8')) : { done: {} }

const articlesSource = DATA.slice(DATA.indexOf('export const articles = ['), DATA.indexOf('export const articlesWithBody'))
const pick = (block, key) => block.match(new RegExp(`${key}:\\s*'([^']*)'`))?.[1] || ''
const articles = [...articlesSource.matchAll(/\{\s*slug:\s*'[^']+'[\s\S]*?\},/g)]
  .map((m) => {
    const block = m[0]
    return { slug: pick(block, 'slug'), title: pick(block, 'title'), date: pick(block, 'date'), iso: pick(block, 'iso'), cat: pick(block, 'cat') }
  })
  .filter((article) => article.slug && article.title)

const articleBySlug = new Map(articles.map((article) => [article.slug, article]))
const files = existsSync(AUDIO) ? readdirSync(AUDIO) : []
const metaPath = resolve(ROOT, 'src/data/audio-meta.json')
const audioMeta = EXTERNAL_AUDIO_BASE_URL && existsSync(metaPath) ? JSON.parse(readFileSync(metaPath, 'utf8')) : {}
const externalDialogue = Object.keys(audioMeta).filter((name) => name.endsWith('.dialogue.mp3'))
const dialogue = [...new Set([...files.filter((name) => name.endsWith('.dialogue.mp3')), ...externalDialogue])].sort()
const generatedAt = dialogue.length ? new Date().toISOString() : null

/* غيابُ الإعداد ليس غيابَ المحتوى.
   بعد انتقال الصوت إلى R2 صار مجلد audio/ فارغاً، فلم يبقَ للحوارات إلا سجلّ
   audio-meta.json — وهو محجوبٌ خلف AUDIO_PUBLIC_BASE_URL. من شغّل هذا الباني
   بلا المتغيّر رأى صفر حوارات، فكتب بياناً فارغاً فوق بيانٍ عامر، فاختفت
   الحلقات من الموقع ومن البوت بلا خطأٍ واحد.
   القاعدة: لا نُفرغ بياناً قائماً إلا حين نرى المصدر فعلاً ونجده فارغاً. */
if (!dialogue.length && existsSync(OUT)) {
  const previous = (() => { try { return JSON.parse(readFileSync(OUT, 'utf8')) } catch { return null } })()
  const hadEpisodes = Array.isArray(previous?.episodes) && previous.episodes.length
  const metaDeclares = !EXTERNAL_AUDIO_BASE_URL && existsSync(metaPath)
    && Object.keys(JSON.parse(readFileSync(metaPath, 'utf8'))).some((name) => name.endsWith('.dialogue.mp3'))
  if (hadEpisodes && (metaDeclares || !EXTERNAL_AUDIO_BASE_URL)) {
    console.warn('⚠ لا AUDIO_PUBLIC_BASE_URL ومجلد audio/ فارغ — لا يمكن رؤية الحوارات.')
    console.warn(`  أبقيتُ podcast-admin.json كما هو (${previous.episodes.length} حلقة) بدل أن أمحوه.`)
    console.warn('  لتحديثه فعلاً: AUDIO_PUBLIC_BASE_URL=<رابط R2> node scripts/build-podcast-admin.mjs')
    process.exit(0)
  }
}

function readAudit(slug) {
  const file = resolve(AUDITS, `${slug}.ar.json`)
  if (!existsSync(file)) return null
  try { return JSON.parse(readFileSync(file, 'utf8')) }
  catch { return null }
}

function roundedScore(value) {
  const numeric = Number(value)
  return Number.isFinite(numeric) ? Math.max(0, Math.min(100, Math.round(numeric))) : 0
}

function scoreAudioGate({ approved, hasTranscript, byteSize, meta, audit }) {
  const finalGate = audit?.finalGate || {}
  const technical = finalGate.technicalAudit || {}
  const comparison = finalGate.fullComparison || {}
  const judge = finalGate.finalJudge || {}
  const humanGate = finalGate.humanGate || {}
  const issues = []
  const metrics = {
    durationSeconds: Math.round(Number(meta?.durationSeconds || technical?.dur || 0)),
    bytes: byteSize,
    sttRatio: Number.isFinite(Number(comparison?.ratio)) ? Math.round(Number(comparison.ratio) * 100) : null,
    importantRatio: Number.isFinite(Number(comparison?.importantRatio)) ? Math.round(Number(comparison.importantRatio) * 100) : null,
    longSilences: Array.isArray(technical?.longSilences) ? technical.longSilences.length : null,
    unexpectedLongSilences: Array.isArray(technical?.unexpectedLongSilences)
      ? technical.unexpectedLongSilences.length : null,
    peakDb: Number.isFinite(Number(technical?.peakDb)) ? Number(technical.peakDb) : null,
    judgePass: judge?.pass === true,
    humanLikeness: Number.isFinite(Number(humanGate?.minimumJudgeDimension))
      ? Math.round(Number(humanGate.minimumJudgeDimension)) : null,
    humanProxy: Number.isFinite(Number(humanGate?.proxy?.score)) ? Math.round(Number(humanGate.proxy.score)) : null,
  }

  const durationOk = metrics.durationSeconds >= 120 && metrics.durationSeconds <= 360
  const bytesOk = byteSize >= 200_000
  const transcriptOk = Boolean(hasTranscript)
  const auditOk = finalGate.pass === true
  const sttOk = metrics.importantRatio === null ? auditOk : metrics.importantRatio >= 95
  const silenceOk = metrics.unexpectedLongSilences !== null
    ? metrics.unexpectedLongSilences === 0
    : metrics.longSilences === null ? auditOk : metrics.longSilences === 0
  const permanentUrlOk = Boolean(meta?.url || meta?.r2Key || EXTERNAL_AUDIO_BASE_URL)
  const humanOk = metrics.humanLikeness === null ? auditOk
    : metrics.humanLikeness >= 95 && Number(metrics.humanProxy || 0) >= 95

  if (!approved) issues.push('الحلقة ليست معتمدة آلياً في حالة البودكاست.')
  if (!transcriptOk) issues.push('لا يوجد Transcript منشور لهذه الحلقة.')
  if (!auditOk) issues.push('لا يوجد تقرير جودة نهائي مجتاز للحلقة.')
  if (!sttOk) issues.push('تطابق STT مع النص المقصود أقل من الحد الصارم.')
  if (!durationOk) issues.push('مدة الحلقة خارج المجال الطبيعي المطلوب.')
  if (!silenceOk) issues.push('توجد وقفات طويلة تتجاوز الحد المقبول.')
  if (!bytesOk) issues.push('حجم الملف مريب أو غير صالح للبودكاست.')
  if (!permanentUrlOk) issues.push('رابط الصوت الدائم غير مثبت.')
  if (!humanOk) issues.push('بوابة البشرية أقل من 95/100.')

  const score = roundedScore(
    (approved ? 18 : 0)
    + (transcriptOk ? 14 : 0)
    + (auditOk ? 24 : 0)
    + (sttOk ? 14 : 0)
    + (durationOk ? 10 : 0)
    + (silenceOk ? 10 : 0)
    + (bytesOk ? 5 : 0)
    + (permanentUrlOk ? 3 : 0)
    + (humanOk ? 2 : 0)
  )

  return {
    score,
    pass: score >= 94 && issues.length === 0,
    metrics,
    pronunciation: auditOk && sttOk ? 'مقبول' : 'ينتظر فحص النطق والمعنى',
    pace: durationOk ? 'مقبول' : 'يحتاج ضبط السرعة/المدة',
    pauses: silenceOk ? 'مقبول' : 'يحتاج تقليل الوقفات',
    issues,
  }
}

const episodes = dialogue.map((name) => {
  const slug = name.slice(0, -'.dialogue.mp3'.length)
  const article = articleBySlug.get(slug)
  const file = resolve(AUDIO, name)
  const localAudio = existsSync(file)
  const transcriptFile = resolve(AUDIO, `${slug}.dialogue.json`)
  const transcriptMeta = audioMeta?.[`${slug}.dialogue.json`] || {}
  const hasTranscript = existsSync(transcriptFile) || Boolean(transcriptMeta.sha256 && Number(transcriptMeta.bytes || 0) > 100)
  const hash = localAudio ? createHash('sha256').update(readFileSync(file)).digest('hex') : String(audioMeta?.[name]?.sha256 || '')
  const accepted = podcastState?.done?.[`${slug}:ar`]
  const transcriptHash = existsSync(transcriptFile) ? createHash('sha256').update(readFileSync(transcriptFile)).digest('hex') : String(transcriptMeta.sha256 || '')
  /* الاعتماد له مصدران، والثاني ليس تساهلاً بل هو الأبقى:
     ‎.podcast-state.json يكتبه المصنع أثناء التوليد، لكنّه مستثنى من المستودع
     (‎.gitignore) فيموت مع مشغّل GitHub. فلو اكتفينا به لظهرت كل حلقةٍ مولّدةٍ
     في السحابة «قيد المراجعة» في اللوحة إلى الأبد مهما كان صوتها سليماً.
     والسجلّ audio-meta.json لا يُكتب فيه سطرٌ إلا بعد رفعةٍ ناجحة إلى R2،
     وفيه بصمة الملف المرفوع نفسه — فوجود الصوت والنصّ فيه ببصمتين صالحتين
     شهادةُ نشرٍ حقيقية، أقوى من ملفٍّ مؤقّت. */
  const acceptedLocally = accepted?.status === 'accepted_automated' && accepted.audioHash === hash
    && accepted.transcriptHash === transcriptHash
  const publishedToStore = Boolean(hash) && Boolean(transcriptHash)
    && Number(audioMeta?.[name]?.bytes || 0) > 0 && Number(transcriptMeta.bytes || 0) > 100
  const approved = acceptedLocally || publishedToStore
  const meta = audioMeta?.[name] || {}
  const byteSize = localAudio ? statSync(file).size : Number(meta.bytes || 0)
  const audit = readAudit(slug)
  let utterances = 0
  if (hasTranscript) {
    try {
      const json = JSON.parse(readFileSync(transcriptFile, 'utf8'))
      utterances = Array.isArray(json.utterances) ? json.utterances.length : 0
    } catch { /* noop */ }
  }
  const gate = scoreAudioGate({ approved, hasTranscript, byteSize, meta, audit })
  const listen = EXTERNAL_AUDIO_BASE_URL
    ? `${EXTERNAL_AUDIO_BASE_URL}/${name}`
    : `/audio/${name}`
  return {
    slug,
    title: article?.title || slug,
    category: article?.cat || 'بودكاست',
    date: article?.date || '',
    iso: article?.iso || '',
    status: gate.pass ? 'published' : 'under_review',
    listen,
    audio: `/audio/${name}`,
    bytes: byteSize,
    audioHash: hash ? hash.slice(0, 16) : '',
    hasTranscript,
    utterances,
    quality: {
      score: gate.score,
      pass: gate.pass,
      metrics: gate.metrics,
      pronunciation: gate.pronunciation,
      pace: gate.pace,
      pauses: gate.pauses,
      issues: gate.issues,
    },
  }
})

/* الحالات الحقيقية لغرفة الإنتاج: الحلقة الفاشلة أو الجارية تظهر بحالتها وسببها،
   لا تبقى «مسودة» وهمية بعد تشغيلٍ فشل. المنشور يبقى مشروطاً باعتماد الحالة + الرابط الدائم. */
const knownSlugs = new Set(episodes.map((episode) => episode.slug))
const auditFiles = existsSync(AUDITS) ? readdirSync(AUDITS).filter((name) => name.endsWith('.ar.json')) : []
for (const name of auditFiles) {
  const slug = name.slice(0, -'.ar.json'.length)
  if (knownSlugs.has(slug)) continue
  const article = articleBySlug.get(slug)
  if (!article) continue
  const audit = readAudit(slug)
  if (!audit) continue
  let status = 'under_review'
  let statusLabel = 'يحتاج مراجعة'
  let failure = null
  let progress = null
  if (audit.status === 'quarantined') {
    status = 'failed'
    const failed = audit?.finalGate?.failedUtterance || audit?.failure || null
    const reason = String(failed?.reason || audit?.finalGate?.reasonCodes?.[0] || 'سبب غير مسجل').slice(0, 220)
    failure = { utteranceId: failed?.utteranceId || failed?.id || '', reason }
    statusLabel = failure.utteranceId ? `فشل في المداخلة ${failure.utteranceId}` : 'فشل التوليد'
  } else if (audit.status === 'qa_in_progress') {
    status = 'generating'
    progress = audit.progress && Number(audit.progress.total)
      ? { done: Number(audit.progress.done || 0), total: Number(audit.progress.total) } : null
    statusLabel = progress ? `جارٍ توليد المداخلة ${progress.done}/${progress.total}` : 'جارٍ بناء الحوار'
  } else if (audit.status === 'accepted_automated') {
    status = 'passed'
    statusLabel = 'مجتاز — بانتظار النشر'
  }
  const reviewKey = audit?.finalGate?.reviewAudioKey
  episodes.push({
    slug,
    title: article.title,
    category: article.cat || 'بودكاست',
    date: article.date || '',
    iso: article.iso || '',
    status,
    statusLabel,
    failure,
    progress,
    listen: reviewKey && EXTERNAL_AUDIO_BASE_URL ? `${EXTERNAL_AUDIO_BASE_URL}/${reviewKey}` : '',
    audio: '',
    bytes: 0,
    audioHash: '',
    hasTranscript: false,
    utterances: Array.isArray(audit?.dialogue?.utterances) ? audit.dialogue.utterances.length : 0,
    quality: { score: 0, pass: false, metrics: {}, pronunciation: failure ? failure.reason : (statusLabel || ''),
      pace: '', pauses: '', issues: failure ? [failure.reason] : [] },
  })
}

const themes = [
  { title: 'الإنسان في قلب الآلة', terms: ['الذكاء', 'الآلة', 'الإنسان', 'التقنية'] },
  { title: 'مستقبل المعلم', terms: ['المعلم', 'التعليم', 'التدريس'] },
  { title: 'الامتحان والخوف', terms: ['الامتحان', 'القياس', 'الخوف', 'الدرجة'] },
  { title: 'الطفل والتكنولوجيا', terms: ['الطفل', 'الأسرة', 'التكنولوجيا'] },
]

const playlists = themes.map((theme) => ({
  title: theme.title,
  episodes: episodes.filter((episode) => {
    const text = `${episode.title} ${episode.category}`
    return theme.terms.some((term) => text.includes(term))
  }).slice(0, 6),
})).filter((playlist) => playlist.episodes.length)

mkdirSync(dirname(OUT), { recursive: true })
/* حوارٌ جاهز يحبسه مقاله —
   كل ما في هذا النظام معلَّقٌ بالمقال: الحلقة تُبنى من مقال، وتُعرض تحت مقال،
   وخاتمتها تقول للمستمع «فليقرأ المقال الأصلي في موقع الدكتور». فإن لم يُنشر
   المقال فلا يجوز أن تُنشر الحلقة — وإلا وجّه الصوتُ الناسَ إلى صفحةٍ لا وجود
   لها. لكنّ الخطأ الحقيقي كان الصمت: المصنع يتخطّاها بلا كلمة، والمنظّف يمحو
   مدخلها من السجلّ بلا كلمة، فتبقى حلقةٌ كاملةً مكنوسةً مضبوطةً بلا أن يعرف
   أحدٌ لماذا لم تصل. تُسمّى هنا بسببها وبالفعل الذي يفكّها. */
const dialogueTexts = existsSync(resolve(ROOT, 'manual-dialogues-soul'))
  ? readdirSync(resolve(ROOT, 'manual-dialogues-soul')).filter((name) => name.endsWith('.soul.json'))
  : []
const blocked = dialogueTexts
  .map((name) => name.slice(0, -'.soul.json'.length))
  .filter((slug) => !knownSlugs.has(slug))
  .map((slug) => {
    let opening = ''
    let turns = 0
    try {
      const soul = JSON.parse(readFileSync(resolve(ROOT, 'manual-dialogues-soul', `${slug}.soul.json`), 'utf8'))
      turns = Array.isArray(soul.utterances) ? soul.utterances.length : 0
      opening = String(soul.utterances?.[0]?.text || '').replace(/[⏸~]/g, '').replace(/\s+/g, ' ').trim()
    } catch { /* الحوار يبقى مُسمّى بمعرّفه */ }
    return {
      slug,
      turns,
      opening,
      reason: 'المقال غير منشور في الموقع',
      action: `انشر مقال «${slug}» من لوحة المقالات، ثم شغّل مصنع الروح — تُولَّد الحلقة وتُرفع وحدها.`,
    }
  })

writeFileSync(OUT, `${JSON.stringify({ generatedAt, episodes, playlists, blocked }, null, 2)}\n`, 'utf8')
console.log(`✔ podcast-admin.json · ${episodes.length} حلقات حوارية · ${playlists.length} قوائم`)
if (blocked.length) {
  console.log(`⚠ ${blocked.length} حوار جاهز لا يُنشر لأن مقاله غير منشور:`)
  for (const item of blocked) console.log(`  - ${item.slug} (${item.turns} مداخلة)`)
}
