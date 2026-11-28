import { useEffect, useMemo, useRef, useState } from 'react'
import type { ArticleRecord } from '../../lib/cms'
import {
  articleMetrics,
  buildOrthographyIndex,
  countWords,
  judgeStyle,
  locateIssues,
  measureStyleDna,
  paragraphsOf,
  refineToStyle,
  resolveStyleDna,
  sentencesOf,
  styleBrief,
  styleReportLines,
  type StyleCheck,
  type StyleVerdict,
} from '../../lib/style-dna.mjs'

const DRAFT_KEY = 'admin-style-checker-draft-v1'
const card = 'min-w-0 rounded-2xl border border-hair bg-wash p-4 sm:p-5 md:p-6'
const inset = 'rounded-xl border border-hair bg-canvas'
const primary = 'rounded-full bg-accent px-5 py-2.5 text-[.8rem] font-semibold text-white transition-colors hover:bg-accent-deep disabled:cursor-not-allowed disabled:opacity-45'
const ghost = 'rounded-full border border-hair bg-canvas px-4 py-2.5 text-[.78rem] font-semibold text-soft transition-colors hover:border-accent hover:text-accent disabled:cursor-not-allowed disabled:opacity-45'

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

function paragraphNumber(sentence: string, paragraphs: string[]) {
  const compact = (value: string) => value.replace(/\s+/g, ' ').trim()
  const needle = compact(sentence).slice(0, 72)
  const found = paragraphs.findIndex((paragraph) => compact(paragraph).includes(needle))
  return found >= 0 ? found + 1 : 1
}

function naturalnessOf(verdict: StyleVerdict | null) {
  if (!verdict) return { score: 0, label: 'بانتظار النص', note: 'هذا مؤشر أسلوبي، وليس كاشف ذكاء اصطناعي.' }
  const grade = (key: string) => verdict.checks.find((check) => check.key === key)?.grade ?? 1
  const penalty =
    (1 - grade('banned')) * 28
    + (1 - grade('typography')) * 20
    + (1 - grade('repetition')) * 24
    + (1 - grade('lexicalDiversity')) * 14
    + (1 - grade('longSentences')) * 7
    + Math.min(12, verdict.metrics.duplicateGramRate * 2)
  const score = clamp(100 - penalty)
  if (score >= 86) return { score, label: 'طبيعي أسلوبيًا', note: 'لا تظهر في البنية علامات آلية بارزة.' }
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
    'المواضع التي تحتاج تعديلًا:',
    located,
    '',
    `العنوان: ${title.trim() || 'بلا عنوان'}`,
    '',
    'نص المقال:',
    body.trim(),
  ].join('\n')
}

export function StyleChecker({ articles }: { articles: ArticleRecord[] }) {
  const fileRef = useRef<HTMLInputElement>(null)
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

  const archive = useMemo(() => articles
    .filter((article) => (article.body || '').trim().length >= 120)
    .map((article) => ({ title: article.title, body: article.body || '', iso: article.iso, excerpt: article.excerpt })), [articles])
  const dna = useMemo(() => resolveStyleDna(measureStyleDna(archive)), [archive])
  const orthography = useMemo(() => buildOrthographyIndex(archive), [archive])
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
    const timer = window.setTimeout(() => setNotice(''), 2800)
    return () => window.clearTimeout(timer)
  }, [notice])

  const verdict = useMemo(() => analysisBody.trim() && countWords(analysisBody) >= 40
    ? judgeStyle(analysisBody, dna, { archive, sources: archive, orthography, threshold: 80 })
    : null, [analysisBody, archive, dna, orthography])
  const paragraphs = useMemo(() => paragraphsOf(analysisBody), [analysisBody])
  const issues = useMemo<Issue[]>(() => {
    if (!verdict) return []
    const located = locateIssues(analysisBody, dna, {
      archive,
      sources: archive,
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
        reason: `${item.words} كلمة في فقرة واحدة؛ قسّمها عند انتقال الفكرة، والمعتاد ألا تتجاوز ${paragraphCeiling} تقريبًا.`,
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
    setNotice(polished === body ? 'النص مضبوط ترقيميًا بالفعل.' : 'صُقلت العلامات والإيقاع محليًا من دون إضافة أفكار.')
  }

  const clearDraft = () => {
    setTitle('')
    setBody('')
    setAnalysisBody('')
    localStorage.removeItem(DRAFT_KEY)
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
            <p className="text-[.7rem] font-semibold text-white/60">فاحص الأسلوب الشخصي</p>
            <h2 className="mt-2 font-display text-2xl font-semibold leading-snug sm:text-3xl">هل يبدو هذا المقال منك فعلًا؟</h2>
            <p className="mt-3 max-w-2xl text-[.82rem] leading-[1.9] text-white/70">مسطرة محلية تقارن الإيقاع والجمل والفقرات واللغة ببصمة أرشيفك، ثم تشير إلى موضع التعديل بدل أن تعطيك رقمًا مبهمًا.</p>
          </div>
          <div className="grid grid-cols-3 gap-2 sm:gap-3">
            <div className="border-r border-white/15 pr-3"><strong className="block font-display text-2xl">{dna?.sampleSize || archive.length}</strong><span className="text-[.62rem] text-white/55">مقالًا في البصمة</span></div>
            <div className="border-r border-white/15 pr-3"><strong className="block font-display text-2xl">{dna?.totalWords.toLocaleString('ar-EG') || '—'}</strong><span className="text-[.62rem] text-white/55">كلمة مرجعية</span></div>
            <div className="pr-3"><strong className="block font-display text-2xl">محلي</strong><span className="text-[.62rem] text-white/55">بلا إرسال النص</span></div>
          </div>
        </div>
      </section>

      <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(340px,.65fr)] xl:items-start">
        <section className={card}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-[.7rem] font-semibold text-accent">النص المراد فحصه</p>
              <h3 className="mt-1 font-display text-xl font-semibold text-ink">الصق المقال كما سيُنشر.</h3>
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
            <span className="mb-2 flex items-center justify-between gap-3 text-[.7rem] font-semibold text-soft"><span>نص المقال</span><span>{words.toLocaleString('ar-EG')} كلمة</span></span>
            <textarea
              value={body}
              onChange={(event) => setBody(event.target.value)}
              placeholder="الصق المقال هنا… يبدأ القياس بعد 40 كلمة."
              className="min-h-[520px] w-full resize-y rounded-xl border border-hair bg-canvas px-4 py-4 text-[.94rem] leading-[2.05] text-ink outline-none transition-colors placeholder:text-soft/45 focus:border-accent"
            />
          </label>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <p className="text-[.68rem] text-soft">المسودة محفوظة على هذا الجهاز فقط.</p>
            <button type="button" className={ghost} onClick={applyLocalPolish} disabled={!body.trim()}>صقل الترقيم والإيقاع</button>
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
                  <p className="mt-1 text-[.68rem] leading-relaxed text-soft">{naturalness.note} لا يمكن لأي أداة إثبات أن الكاتب إنسان أو نموذج من النص وحده.</p>
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
              <button type="button" onClick={() => setMode('generated')} className={`rounded-lg px-3 py-2 text-[.74rem] font-semibold transition-colors ${mode === 'generated' ? 'bg-ink text-white' : 'text-soft hover:text-ink'}`}>خرج من جيمناي</button>
            </div>
            <p className="mt-2 text-[.65rem] leading-relaxed text-soft">وضع جيمناي يشدد كشف العبارات الدخيلة والجمل المتضخمة.</p>
          </section>

          {verdict && (
            <section className={card}>
              <p className="text-[.7rem] font-semibold text-accent">نسخ وتسليم</p>
              <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
                <button type="button" className={primary} onClick={() => void copy(buildGeminiPrompt(title, body, verdict, issues, dna), 'نُسخ طلب جيمناي كاملًا.')}>نسخ طلب جيمناي</button>
                <button type="button" className={ghost} onClick={() => void copy(reportText, 'نُسخ تقرير الفحص.')}>نسخ التقرير فقط</button>
              </div>
            </section>
          )}
        </aside>
      </div>

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
              <span className="text-[.65rem] text-soft">الأكثر أثرًا أولًا</span>
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
