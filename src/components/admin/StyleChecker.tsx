import { useEffect, useMemo, useRef, useState } from 'react'
import type { ArticleRecord } from '../../lib/cms'
import { loadArticleBodies } from '../../lib/article-bodies'
import { arabicCountPhrase, WORD_PLAIN_FORMS } from '../../lib/arabic-count'
import {
  articleMetrics,
  buildOrthographyIndex,
  countWords,
  judgeStyle,
  locateIssues,
  measureStyleDna,
  paragraphsOf,
  polishTypography,
  refineToStyle,
  resolveStyleDna,
  sentencesOf,
  styleBrief,
  styleReportLines,
  type StyleCheck,
  type StyleVerdict,
} from '../../lib/style-dna.mjs'
import { buildMimicLexicon, mimicVoice, type MimicResult } from '../../lib/style-mimic.mjs'

const DRAFT_KEY = 'admin-style-checker-draft-v1'
const card = 'min-w-0 rounded-2xl border border-hair bg-wash p-4 sm:p-5 md:p-6'
const inset = 'rounded-xl border border-hair bg-canvas'
const primary = 'rounded-full bg-accent px-5 py-2.5 text-[.8rem] font-semibold text-white transition-colors hover:bg-accent-deep disabled:cursor-not-allowed disabled:opacity-45'
const ghost = 'rounded-full border border-hair bg-canvas px-4 py-2.5 text-[.78rem] font-semibold text-soft transition-colors hover:border-accent hover:text-accent disabled:cursor-not-allowed disabled:opacity-45'
const actionBtn = 'rounded-full border border-accent/30 bg-accent/[.08] px-4 py-2.5 text-[.78rem] font-semibold text-accent transition-colors hover:bg-accent hover:text-white disabled:cursor-not-allowed disabled:opacity-45'

type ReviewMode = 'mine' | 'generated'
type Issue = ReturnType<typeof locateIssues>[number] & { paragraph: number }

const kindLabel: Record<string, string> = {
  banned: 'صوت دخيل',
  orthography: 'إملاء',
  evidence: 'إسناد',
  verbatim: 'نقل حرفي',
  repeat: 'تكرار',
  long: 'جملة طويلة',
  paragraph: 'فقرة متضخمة',
}

const clamp = (value: number) => Math.max(0, Math.min(100, Math.round(value)))

const CHANGE_FORMS = { one: 'تعديل واحد', two: 'تعديلان', few: 'تعديلات', many: 'تعديلاً' }
const PLACE_FORMS = { one: 'موضع', two: 'موضعان', few: 'مواضع', many: 'موضعاً' }

const mimicKindLabel: Record<string, string> = {
  matrix: 'فعل تقرير',
  opener: 'افتتاح مدرسي',
  connector: 'رابط دخيل',
  temporal: 'ظرف منفوخ',
  flourish: 'زخرفة',
  orthography: 'إملاء',
}

function paragraphNumber(sentence: string, paragraphs: string[]) {
  const compact = (value: string) => value.replace(/\s+/g, ' ').trim()
  const needle = compact(sentence).slice(0, 72)
  const found = paragraphs.findIndex((paragraph) => compact(paragraph).includes(needle))
  return found >= 0 ? found + 1 : 1
}

function naturalnessOf(verdict: StyleVerdict | null) {
  if (!verdict) return { score: 0, label: 'بانتظار النص', note: 'هذا مؤشر أسلوبي، وليس كاشف ذكاء اصطناعي.' }
  const grade = (key: string) => verdict.checks.find((check) => check.key === key)?.grade ?? 1
  /* سلامة التركيب أثقل من كل ما عداها في هذا المؤشر: نصٌّ بجملٍ مكسورة قد
     يكون إيقاعه مضبوطاً تماماً — وهو بالضبط ما تُنتجه آلةٌ تحسِّن الأرقام. */
  const penalty =
    (1 - grade('wellFormed')) * 34
    + (1 - grade('banned')) * 28
    + (1 - grade('typography')) * 20
    + (1 - grade('repetition')) * 24
    + (1 - grade('lexicalDiversity')) * 14
    + (1 - grade('longSentences')) * 7
    + Math.min(12, verdict.metrics.duplicateGramRate * 2)
  const score = clamp(100 - penalty)
  if (score >= 86) return { score, label: 'طبيعي أسلوبياً', note: 'لا تظهر في البنية علامات آلية بارزة.' }
  if (score >= 68) return { score, label: 'يحتاج لمسة بشرية', note: 'هناك انتظام أو صياغات تستحق المراجعة.' }
  return { score, label: 'آثار صياغة آلية', note: 'العبارات أو التكرار أو القالب أوضح من صوتك.' }
}

function scoreTone(score: number) {
  if (score >= 80) return 'text-accent'
  if (score >= 60) return 'text-ink'
  return 'text-soft'
}

function ScoreDial({ score, label }: { score: number; label: string }) {
  const radius = 48
  const circumference = 2 * Math.PI * radius
  const offset = circumference * (1 - score / 100)
  return (
    <div className="relative grid h-36 w-36 shrink-0 place-items-center" aria-label={`${label}: ${score}٪`}>
      <svg className="absolute inset-0 -rotate-90" width="144" height="144" viewBox="0 0 120 120" aria-hidden="true">
        <circle cx="60" cy="60" r={radius} fill="none" stroke="currentColor" strokeWidth="7" className="text-hair" />
        <circle cx="60" cy="60" r={radius} fill="none" stroke="currentColor" strokeWidth="7" strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={offset} className="text-accent transition-all duration-700" />
      </svg>
      <div className="relative text-center">
        <strong className={`block font-display text-3xl ${scoreTone(score)}`}>{score}٪</strong>
        <span className="mt-1 block text-[.64rem] text-soft">{label}</span>
      </div>
    </div>
  )
}

function Metric({ value, label, note }: { value: string | number; label: string; note?: string }) {
  return (
    <div className={`${inset} min-w-0 px-3 py-3 text-center`}>
      <strong className="block font-display text-xl text-ink">{value}</strong>
      <span className="mt-1 block text-[.68rem] font-semibold text-soft">{label}</span>
      {note && <span className="mt-1 block text-[.6rem] text-soft/70">{note}</span>}
    </div>
  )
}

function CheckRow({ check }: { check: StyleCheck }) {
  const percent = Math.round(check.grade * 100)
  return (
    <div className={`${inset} px-4 py-3`}>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <strong className="block text-[.8rem] text-ink">{check.label}</strong>
          <span className="mt-1 block text-[.68rem] leading-relaxed text-soft">الموجود: {check.actual} · نطاقك: {check.wanted}</span>
        </div>
        <span className="shrink-0 font-display text-[.82rem] text-accent">{percent}٪</span>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-hair">
        <div className="h-full rounded-full bg-accent transition-all duration-500" style={{ width: `${percent}%` }} />
      </div>
    </div>
  )
}

function buildGeminiPrompt(title: string, body: string, verdict: StyleVerdict, issues: Issue[], dna: ReturnType<typeof measureStyleDna>) {
  const report = styleReportLines(verdict).map((line) => `- ${line}`).join('\n')
  const located = issues.length
    ? issues.map((issue, index) => `${index + 1}. الفقرة ${issue.paragraph}: ${issue.reason}\nالجملة: «${issue.sentence}»`).join('\n')
    : 'لا توجد مواضع قاطعة؛ طبّق الملاحظات الرقمية فقط.'
  return [
    'أنت محرر عربي دقيق. راجع المقال التالي ليطابق بصمة الكاتب المقيسة من أرشيفه، من دون اختراع معلومة أو تغيير موقفه الفكري.',
    '',
    'قواعد العمل:',
    '1. أصلح المواضع المحددة فقط وما يلزمها، ولا تعِد كتابة المقال من الصفر.',
    '2. حافظ على المعنى والأمثلة والأسماء والأرقام. لا تضف دراسة أو نسبة أو واقعة.',
    '3. لا تجعل النص أكثر زخرفة، ولا تكرر الفكرة بصياغة ثانية.',
    '4. أعد النتيجة في قسمين: «النص المنقح» ثم «سجل التعديلات» مع رقم الفقرة وسبب التعديل.',
    '',
    'بصمة الكاتب الرقمية:',
    styleBrief(dna, countWords(body)),
    '',
    'نتيجة الفحص الحالي:',
    report,
    '',
    'المواضع التي تحتاج تعديلاً:',
    located,
    '',
    `العنوان: ${title.trim() || 'بلا عنوان'}`,
    '',
    'نص المقال:',
    body.trim(),
  ].join('\n')
}

/* محرك المحاكاة انتقل إلى src/lib/style-mimic.mjs.

   ما كان هنا قبله كان يفعل واحداً من اثنين ولا ثالث:
   • على نصّ الدكتور: لا شيء. طبقتاه الفاعلتان (رفع الوقفات وتصحيح الإملاء)
     كانتا مبنيّتين على `\b`، وهي في جافاسكربت لا ترى الحرف العربي، فلم
     يطابق `/،\s+(?=بل\b)/` موضعاً واحداً في اللغة كلها. ومن هنا شعور
     الدكتور بأن «المحاكاة نفس الكلام بدون أي تغيير» — وكان محقاً حرفياً.
   • على مسودةٍ من نموذج: تمسيخ. «يعد التعليم الرقمي من أهم التحولات» صارت
     «ليس الحديث اليوم عن التعليم الرقمي كمجرد ا… بل عن لتحولات»، وكانت تُحقن
     في نصه عباراتٌ لم يكتبها قط («الواقع أن» صفر في ٥٣ ألف كلمة · «الظاهر
     أن» صفر · «من هنا» صفر)، وتُذيَّل المقالات بسؤالٍ معلَّب واحد.

   البديل يقيس كل عبارةٍ على أرشيفه قبل المساس بها، ولا يستبدل إلا ببديلٍ
   مقيسٍ في متنه، ويحاكم كل تعديلٍ على حدة بستّ بوابات نحوية وأمانية. */

export function StyleChecker({ articles }: { articles: ArticleRecord[] }) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [fullCorpusBodies, setFullCorpusBodies] = useState<Record<string, string> | null>(null)
  const [loadingArchive, setLoadingArchive] = useState(false)
  const [title, setTitle] = useState(() => {
    if (typeof window === 'undefined') return ''
    try { return JSON.parse(localStorage.getItem(DRAFT_KEY) || '{}').title || '' } catch { return '' }
  })
  const [body, setBody] = useState(() => {
    if (typeof window === 'undefined') return ''
    try { return JSON.parse(localStorage.getItem(DRAFT_KEY) || '{}').body || '' } catch { return '' }
  })
  const [analysisBody, setAnalysisBody] = useState(body)
  const [mode, setMode] = useState<ReviewMode>('mine')
  const [notice, setNotice] = useState('')
  const [mimic, setMimic] = useState<MimicResult | null>(null)
  const [undoBody, setUndoBody] = useState<string | null>(null)

  // تحميل الأرشيف الكامل تلقائياً ومحلياً لضمان تغذية البصمة بكامل الـ 143 مقالاً
  useEffect(() => {
    let active = true
    setLoadingArchive(true)
    loadArticleBodies()
      .then((bodies) => {
        if (active) {
          setFullCorpusBodies(bodies)
        }
      })
      .catch(() => {})
      .finally(() => {
        if (active) setLoadingArchive(false)
      })
    return () => { active = false }
  }, [])

  const archive = useMemo(() => {
    const bodies = fullCorpusBodies || {}
    const list = articles.map((article) => {
      const explicitBody = (article.body || '').trim()
      const diskBody = (bodies[article.slug] || '').trim()
      const finalBody = explicitBody.length >= 120 ? explicitBody : diskBody
      return {
        title: article.title,
        body: finalBody,
        iso: article.iso,
        excerpt: article.excerpt,
      }
    }).filter((item) => item.body.length >= 120)

    if (!list.length && Object.keys(bodies).length > 0) {
      return Object.entries(bodies).map(([slug, b]) => ({
        title: slug,
        body: b,
        iso: '2026-01-01',
        excerpt: '',
      })).filter((item) => item.body.length >= 120)
    }
    return list
  }, [articles, fullCorpusBodies])

  const dna = useMemo(() => resolveStyleDna(measureStyleDna(archive)), [archive])
  const orthography = useMemo(() => buildOrthographyIndex(archive), [archive])
  /* يُبنى مرةً واحدة على الأرشيف: كل عبارةٍ توزن في سياق تعديلها قبل المساس بها. */
  const mimicLexicon = useMemo(() => buildMimicLexicon(archive), [archive])
  const words = countWords(body)

  useEffect(() => {
    const timer = window.setTimeout(() => setAnalysisBody(body), 420)
    return () => window.clearTimeout(timer)
  }, [body])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      localStorage.setItem(DRAFT_KEY, JSON.stringify({ title, body }))
    }, 250)
    return () => window.clearTimeout(timer)
  }, [title, body])

  useEffect(() => {
    if (!notice) return
    const timer = window.setTimeout(() => setNotice(''), 3200)
    return () => window.clearTimeout(timer)
  }, [notice])

  const verdict = useMemo(() => analysisBody.trim() && countWords(analysisBody) >= 40
    ? judgeStyle(analysisBody, dna, { orthography, threshold: 80 })
    : null, [analysisBody, dna, orthography])
  const paragraphs = useMemo(() => paragraphsOf(analysisBody), [analysisBody])
  const issues = useMemo<Issue[]>(() => {
    if (!verdict) return []
    const located = locateIssues(analysisBody, dna, {
      orthography,
      strict: mode === 'generated',
    }).map((issue) => ({ ...issue, paragraph: paragraphNumber(issue.sentence, paragraphs) }))
    const paragraphCeiling = Math.max(70, Math.round(dna.paragraph.p90 * 1.15))
    const swollen = paragraphs
      .map((paragraph, index) => ({ paragraph, index, words: countWords(paragraph) }))
      .filter((item) => item.words > paragraphCeiling)
      .sort((left, right) => right.words - left.words)
      .slice(0, 3)
      .map((item) => ({
        sentence: sentencesOf(item.paragraph)[0] || item.paragraph.slice(0, 180),
        reason: `${arabicCountPhrase(item.words, WORD_PLAIN_FORMS, (v) => v.toLocaleString('ar-EG'))} في فقرة واحدة؛ قسّمها عند انتقال الفكرة، والمعتاد ألا تتجاوز ${paragraphCeiling} تقريباً.`,
        kind: 'paragraph',
        paragraph: item.index + 1,
      }))
    return [...located, ...swollen].slice(0, 10)
  }, [analysisBody, archive, dna, mode, orthography, paragraphs, verdict])
  const naturalness = naturalnessOf(verdict)
  const weakest = useMemo(() => verdict
    ? [...verdict.checks].filter((check) => check.grade < .8).sort((left, right) => left.grade - right.grade).slice(0, 6)
    : [], [verdict])

  const copy = async (value: string, success: string) => {
    try {
      await navigator.clipboard.writeText(value)
      setNotice(success)
    } catch {
      setNotice('تعذّر النسخ في هذا المتصفح.')
    }
  }

  const importText = async (file?: File) => {
    if (!file) return
    if (!/\.(txt|md)$/i.test(file.name)) {
      setNotice('ارفع ملف TXT أو MD، أو الصق النص مباشرة.')
      return
    }
    const text = await file.text()
    setBody(text.trim())
    if (!title.trim()) setTitle(file.name.replace(/\.(txt|md)$/i, '').replace(/[-_]+/g, ' '))
    setNotice('حُمّل النص وبدأ الفحص.')
    if (fileRef.current) fileRef.current.value = ''
  }

  const applyLocalPolish = () => {
    if (!body.trim()) return
    const polished = refineToStyle(body, dna)
    setBody(polished)
    setNotice(polished === body ? 'النص مضبوط ترقيمياً بالفعل.' : 'صُقلت العلامات والإيقاع محلياً من دون إضافة أفكار.')
  }

  /* المحاكاة: تُطبَّق وتُشرح وتُتراجَع. الشرح جزءٌ من العمل لا زينةٌ فوقه —
     تعديلٌ لا يعرف الدكتور سببه لا يستطيع الحكم عليه. */
  const applyLocalMimic = () => {
    if (!body.trim()) return
    const result = mimicVoice(body, dna, { orthography, lexicon: mimicLexicon, archive })
    setMimic(result)
    if (!result.applied) {
      setNotice(result.note || 'لم يتغيّر شيء: النص داخل مدى أسلوبك أصلاً.')
      return
    }
    setUndoBody(body)
    setBody(result.text)
    setAnalysisBody(result.text)
    const gain = (result.after?.raw ?? 0) - (result.before?.raw ?? 0)
    setNotice(`${arabicCountPhrase(result.changes.length, CHANGE_FORMS)} · المطابقة ${gain >= 0 ? '+' : ''}${gain} نقطة`)
  }

  const undoMimic = () => {
    if (undoBody === null) return
    setBody(undoBody)
    setAnalysisBody(undoBody)
    setUndoBody(null)
    setMimic(null)
    setNotice('رُجّع النص كما كان قبل المحاكاة.')
  }

  const syncFullArchive = async () => {
    setLoadingArchive(true)
    try {
      const bodies = await loadArticleBodies()
      setFullCorpusBodies(bodies)
      setNotice('تم استيعاب الـ 143 مقالاً بالكامل في البصمة الحية ✓')
    } catch {
      setNotice('تم استخدام المتون المتوفرة محلياً.')
    } finally {
      setLoadingArchive(false)
    }
  }

  const clearDraft = () => {
    setTitle('')
    setBody('')
    setAnalysisBody('')
    localStorage.removeItem(DRAFT_KEY)
    setMimic(null)
    setUndoBody(null)
    setNotice('مُسحت المسودة من هذا الجهاز.')
  }

  const reportText = verdict ? [
    title.trim() ? `العنوان: ${title.trim()}` : '',
    ...styleReportLines(verdict),
    '',
    'المواضع:',
    ...(issues.length ? issues.map((issue) => `الفقرة ${issue.paragraph} · ${kindLabel[issue.kind] || 'مراجعة'}: ${issue.reason}\n«${issue.sentence}»`) : ['لا توجد مواضع قاطعة.']),
    '',
    'التعديلات المطلوبة:',
    ...verdict.corrections,
  ].filter(Boolean).join('\n') : ''

  return (
    <div className="grid gap-5" data-style-checker="true">
      <section className="relative overflow-hidden rounded-2xl border border-ink/10 bg-ink px-5 py-6 text-white sm:px-7 sm:py-8">
        <div className="relative grid gap-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
          <div className="max-w-3xl">
            <div className="flex items-center gap-2">
              <span className="text-[.7rem] font-semibold text-white/60">فاحص ومحاكي الأسلوب الشخصي</span>
              {loadingArchive && <span className="rounded-full bg-accent/20 px-2 py-0.5 text-[.6rem] text-accent">يستوعب الأرشيف…</span>}
            </div>
            <h2 className="mt-2 font-display text-2xl font-semibold leading-snug sm:text-3xl">هل يبدو هذا المقال منك فعلاً؟</h2>
            <p className="mt-3 max-w-2xl text-[.82rem] leading-[1.9] text-white/70">مسطرة ومحاكي أسلوبي يقارن الإيقاع والجمل والفقرات ببصمة مقالاتك الـ 143 المنشورة، ويقلد صوتك ويصقل النص فوراً محلياً وبلا إرسال للإنترنت.</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="grid grid-cols-3 gap-2 sm:gap-3">
              <div className="border-r border-white/15 pr-3"><strong className="block font-display text-2xl">{dna?.sampleSize || archive.length}</strong><span className="text-[.62rem] text-white/55">مقالاً في البصمة</span></div>
              <div className="border-r border-white/15 pr-3"><strong className="block font-display text-2xl">{dna?.totalWords.toLocaleString('ar-EG') || '—'}</strong><span className="text-[.62rem] text-white/55">كلمة مرجعية</span></div>
              <div className="pr-3"><strong className="block font-display text-2xl">محلي</strong><span className="text-[.62rem] text-white/55">بلا إنترنت</span></div>
            </div>
            {archive.length < 100 && (
              <button type="button" onClick={() => void syncFullArchive()} className="rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-[.68rem] font-semibold text-white hover:bg-white/20">
                استيعاب كامل الأرشيف (143)
              </button>
            )}
          </div>
        </div>
      </section>

      <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(340px,.65fr)] xl:items-start">
        <section className={card}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-[.7rem] font-semibold text-accent">النص المراد فحصه ومحاكاته</p>
              <h3 className="mt-1 font-display text-xl font-semibold text-ink">الصق المقال كما سيُنشر أو خاماً.</h3>
            </div>
            <div className="flex flex-wrap gap-2">
              <input ref={fileRef} className="sr-only" type="file" accept=".txt,.md,text/plain,text/markdown" onChange={(event) => void importText(event.target.files?.[0])} />
              <button type="button" className={ghost} onClick={() => fileRef.current?.click()}>رفع ملف نصي</button>
              <button type="button" className={ghost} onClick={clearDraft} disabled={!body && !title}>مسح</button>
            </div>
          </div>

          <label className="mt-5 block">
            <span className="mb-2 block text-[.7rem] font-semibold text-soft">عنوان المقال</span>
            <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="اكتب العنوان هنا" className="w-full rounded-xl border border-hair bg-canvas px-4 py-3 text-[.92rem] text-ink outline-none transition-colors placeholder:text-soft/50 focus:border-accent" />
          </label>
          <label className="mt-4 block">
            <span className="mb-2 flex items-center justify-between gap-3 text-[.7rem] font-semibold text-soft"><span>نص المقال</span><span>{arabicCountPhrase(words, WORD_PLAIN_FORMS, (v) => v.toLocaleString('ar-EG'))}</span></span>
            <textarea
              value={body}
              onChange={(event) => setBody(event.target.value)}
              placeholder="الصق المقال هنا… يبدأ القياس بعد 40 كلمة، ويمكنك ضغط زر «محاكاة أسلوبي وصقل النص» لتحويله فوراً."
              className="min-h-[520px] w-full resize-y rounded-xl border border-hair bg-canvas px-4 py-4 text-[.94rem] leading-[2.05] text-ink outline-none transition-colors placeholder:text-soft/[.45] focus:border-accent"
            />
          </label>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <p className="text-[.68rem] text-soft">المعالجة فورية محلياً داخل جهازك بدون إرسال النص لأي جهة.</p>
            <div className="flex flex-wrap gap-2">
              <button type="button" className={actionBtn} onClick={applyLocalMimic} disabled={!body.trim()}>
                ✨ محاكاة أسلوبي وصقل النص محلياً
              </button>
              <button type="button" className={ghost} onClick={applyLocalPolish} disabled={!body.trim()}>
                صقل الترقيم والإيقاع
              </button>
              {undoBody !== null && (
                <button type="button" className={ghost} onClick={undoMimic}>
                  تراجع عن المحاكاة
                </button>
              )}
            </div>
          </div>
        </section>

        <aside className="grid gap-5 xl:sticky xl:top-28">
          <section className={card}>
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[.7rem] font-semibold text-accent">الحكم المختصر</p>
                <h3 className="mt-1 font-display text-xl font-semibold text-ink">{!verdict ? 'بانتظار مقال قابل للقياس' : verdict.ready ? 'داخل مدى أسلوبك' : 'يحتاج مراجعة قبل النشر'}</h3>
              </div>
              {analysisBody !== body && <span className="text-[.62rem] text-soft">يُحدّث…</span>}
            </div>

            {verdict ? (
              <>
                <div className="mt-4 flex flex-wrap items-center justify-around gap-3">
                  <ScoreDial score={verdict.score} label="مطابقة الأسلوب" />
                  <ScoreDial score={naturalness.score} label="طبيعية الصياغة" />
                </div>
                <div className={`${inset} mt-3 px-4 py-3`}>
                  <div className="flex items-center justify-between gap-3"><strong className="text-[.8rem] text-ink">{naturalness.label}</strong><span className="font-display text-accent">{naturalness.score}٪</span></div>
                  <p className="mt-1 text-[.68rem] leading-relaxed text-soft">{naturalness.note} مقيس على 143 مقالاً في الأرشيف المعتمد.</p>
                </div>
              </>
            ) : (
              <div className={`${inset} mt-5 px-4 py-8 text-center text-[.78rem] leading-relaxed text-soft`}>ألصق 40 كلمة على الأقل لتظهر النتيجة، وتصبح أدق بعد 120 كلمة.</div>
            )}
          </section>

          <section className={card}>
            <p className="text-[.7rem] font-semibold text-accent">نوع النص</p>
            <div className="mt-3 grid grid-cols-2 rounded-xl border border-hair bg-canvas p-1">
              <button type="button" onClick={() => setMode('mine')} className={`rounded-lg px-3 py-2 text-[.74rem] font-semibold transition-colors ${mode === 'mine' ? 'bg-ink text-white' : 'text-soft hover:text-ink'}`}>كتبته بنفسي</button>
              <button type="button" onClick={() => setMode('generated')} className={`rounded-lg px-3 py-2 text-[.74rem] font-semibold transition-colors ${mode === 'generated' ? 'bg-ink text-white' : 'text-soft hover:text-ink'}`}>خرج من نموذج آلي</button>
            </div>
            <p className="mt-2 text-[.65rem] leading-relaxed text-soft">وضع النموذج الآلي يشدد كشف العبارات الدخيلة والجمل المتضخمة والتكرار.</p>
          </section>

          {verdict && (
            <section className={card}>
              <p className="text-[.7rem] font-semibold text-accent">نسخ وتسليم</p>
              <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
                <button type="button" className={primary} onClick={() => void copy(buildGeminiPrompt(title, body, verdict, issues, dna), 'نُسخ طلب جيمناي كاملاً.')}>نسخ طلب جيمناي</button>
                <button type="button" className={ghost} onClick={() => void copy(reportText, 'نُسخ تقرير الفحص.')}>نسخ التقرير فقط</button>
              </div>
            </section>
          )}
        </aside>
      </div>

      {mimic && (
        <section className={card} data-mimic-log="true">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-[.7rem] font-semibold text-accent">سجل المحاكاة</p>
              <h3 className="mt-1 font-display text-xl font-semibold text-ink">ما غيّرته بالضبط، ولماذا.</h3>
              <p className="mt-2 max-w-2xl text-[.7rem] leading-relaxed text-soft">
                كل عبارةٍ هنا وُزنت على أرشيفك قبل المساس بها: ما ورد عندك ثلاث مراتٍ فأكثر لا يُمسّ، ولا يدخل نصك بديلٌ لم تكتبه بنفسك.
              </p>
            </div>
            {mimic.before && mimic.after && (
              <div className="grid grid-cols-2 gap-3 text-center">
                <div className={`${inset} px-4 py-2`}>
                  <strong className="block font-display text-lg text-ink">{mimic.before.raw}٪ ← {mimic.after.raw}٪</strong>
                  <span className="text-[.62rem] text-soft">المطابقة قبل السقف</span>
                </div>
                <div className={`${inset} px-4 py-2`}>
                  <strong className="block font-display text-lg text-accent">{mimic.changes.length}</strong>
                  <span className="text-[.62rem] text-soft">{arabicCountPhrase(mimic.changes.length, CHANGE_FORMS)}</span>
                </div>
              </div>
            )}
          </div>

          {mimic.note && <p className="mt-3 rounded-xl border border-hair bg-canvas px-4 py-3 text-[.76rem] leading-relaxed text-soft">{mimic.note}</p>}

          {mimic.changes.length > 0 && (
            <div className="mt-4 grid gap-2">
              {mimic.changes.map((change, index) => (
                <div key={`${change.kind}-${index}`} className={`${inset} flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5`}>
                  <span className="shrink-0 rounded-full border border-accent/20 bg-accent/[.05] px-2.5 py-1 text-[.6rem] font-semibold text-accent">{mimicKindLabel[change.kind] || 'تعديل'}</span>
                  <span className="text-[.62rem] text-soft">الفقرة {change.paragraph}</span>
                  <span className="text-[.8rem] text-ink">«{change.from}»</span>
                  <span className="text-soft">←</span>
                  <span className="text-[.8rem] text-accent">{change.to ? `«${change.to}»` : 'حُذفت'}</span>
                  <span className="basis-full text-[.68rem] leading-relaxed text-soft">{change.reason}</span>
                </div>
              ))}
            </div>
          )}

          {mimic.pending.length > 0 && (
            <div className="mt-4 rounded-xl border border-ink/[.15] bg-canvas px-4 py-4">
              <strong className="text-[.74rem] text-ink">
                {arabicCountPhrase(mimic.pending.length, PLACE_FORMS)} تحتاج يدك — وهي وحدها ما يُبقي الدرجة مسقوفة
              </strong>
              <p className="mt-1 text-[.68rem] leading-relaxed text-soft">عباراتٌ يعتبرها الحَكَم قاطعة، ونزعها آلياً يكسر الجملة أو يستبدلها بكلامٍ لم تكتبه. القرار قرارك.</p>
              <ul className="mt-3 grid gap-2">
                {mimic.pending.map((item, index) => (
                  <li key={`${item.phrase}-${index}`} className="text-[.76rem] leading-[1.85] text-soft">
                    <span className="font-semibold text-ink">«{item.phrase}»</span> · الفقرة {item.paragraph}
                    {item.sentence && <span className="mt-0.5 block text-[.7rem] text-soft/80">«{item.sentence}…»</span>}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {mimic.skipped.length > 0 && (
            <details className="mt-4 rounded-xl border border-hair bg-canvas px-4 py-3">
              <summary className="cursor-pointer text-[.74rem] font-semibold text-ink">
                وما امتنعتُ عنه ({mimic.skipped.length})
              </summary>
              <ul className="mt-3 grid gap-2">
                {mimic.skipped.map((item, index) => (
                  <li key={`skip-${index}`} className="text-[.72rem] leading-relaxed text-soft">
                    «{item.from}» — {item.reason}
                  </li>
                ))}
              </ul>
            </details>
          )}

          {mimicLexicon.guarded.length > 0 && (
            <p className="mt-4 text-[.68rem] leading-relaxed text-soft">
              محميّةٌ لأنك تكتبها فعلاً: {mimicLexicon.guarded.map((item) => `«${item.phrase}» ${item.own}`).join(' · ')}.
            </p>
          )}
        </section>
      )}

      {verdict && (
        <section className={card}>
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-[.7rem] font-semibold text-accent">لوحة القياس</p>
              <h3 className="mt-1 font-display text-xl font-semibold text-ink">أرقام هذا المقال مقابل عادتك.</h3>
            </div>
            <span className="text-[.68rem] text-soft">{verdict.metrics.sentences} جملة · {verdict.metrics.paragraphs} فقرة</span>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-8">
            <Metric value={verdict.metrics.words} label="كلمة" />
            <Metric value={verdict.metrics.medianSentence} label="وسيط الجملة" note="كلمة" />
            <Metric value={`${verdict.metrics.shortRate}٪`} label="جمل قصيرة" />
            <Metric value={verdict.metrics.ellipsis} label="وقفات …" />
            <Metric value={verdict.metrics.antithesis} label="انقلابات بل" />
            <Metric value={verdict.metrics.questions} label="أسئلة" />
            <Metric value={`${verdict.metrics.lexicalDiversity}٪`} label="تنوع المفردات" />
            <Metric value={`${verdict.metrics.duplicateSentenceRate}٪`} label="تكرار الجمل" />
          </div>
        </section>
      )}

      {verdict && (
        <div className="grid min-w-0 gap-5 lg:grid-cols-2 lg:items-start">
          <section className={card}>
            <div className="flex items-end justify-between gap-3">
              <div><p className="text-[.7rem] font-semibold text-accent">أين بالضبط؟</p><h3 className="mt-1 font-display text-xl font-semibold text-ink">الفقرات التي تحتاج يدك.</h3></div>
              <span className="font-display text-lg text-accent">{issues.length}</span>
            </div>
            <div className="mt-4 grid gap-3">
              {issues.length ? issues.map((issue, index) => (
                <article key={`${issue.kind}-${index}`} className={`${inset} overflow-hidden`}>
                  <div className="flex items-center justify-between gap-3 border-b border-hair px-4 py-2.5">
                    <strong className="text-[.72rem] text-ink">الفقرة {issue.paragraph}</strong>
                    <span className="rounded-full border border-accent/20 bg-accent/[.05] px-2.5 py-1 text-[.62rem] font-semibold text-accent">{kindLabel[issue.kind] || 'مراجعة'}</span>
                  </div>
                  <div className="px-4 py-3"><p className="text-[.8rem] leading-[1.9] text-ink">«{issue.sentence}»</p><p className="mt-2 text-[.7rem] leading-relaxed text-soft">{issue.reason}</p></div>
                </article>
              )) : <div className={`${inset} px-4 py-8 text-center text-[.78rem] text-soft`}>لا توجد جملة قاطعة بعينها. راجع الفروق الرقمية في البطاقة المقابلة.</div>}
            </div>
          </section>

          <section className={card}>
            <div className="flex items-end justify-between gap-3">
              <div><p className="text-[.7rem] font-semibold text-accent">الأولوية</p><h3 className="mt-1 font-display text-xl font-semibold text-ink">ابدأ بأضعف الفروق.</h3></div>
              <span className="text-[.65rem] text-soft">الأكثر أثراً أولاً</span>
            </div>
            <div className="mt-4 grid gap-3">
              {weakest.length ? weakest.map((check) => <CheckRow key={check.key} check={check} />) : <div className={`${inset} px-4 py-8 text-center text-[.78rem] text-soft`}>كل المقاييس الأساسية داخل مداك.</div>}
            </div>
            {verdict.corrections.length > 0 && (
              <div className="mt-4 rounded-xl border border-accent/25 bg-accent/[.04] px-4 py-4">
                <strong className="text-[.74rem] text-accent">خطة التعديل</strong>
                <ol className="mt-3 grid gap-2">
                  {verdict.corrections.slice(0, 6).map((correction, index) => <li key={index} className="text-[.76rem] leading-[1.85] text-soft"><span className="font-display text-accent">{index + 1}.</span> {correction}</li>)}
                </ol>
              </div>
            )}
          </section>
        </div>
      )}

      {notice && <div role="status" className="fixed bottom-5 left-1/2 z-50 -translate-x-1/2 rounded-full border border-accent/20 bg-ink px-5 py-3 text-[.76rem] font-semibold text-white shadow-xl">{notice}</div>}
    </div>
  )
}

