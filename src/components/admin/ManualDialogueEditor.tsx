import { useEffect, useMemo, useRef, useState } from 'react'
import type { ArticleRecord } from '../../lib/cms'
import assessmentDialogue from '../../../manual-dialogues/how-do-we-assess-without-breaking-the-human-beingarabic.json'

type Speaker = 'male' | 'female'
type DialogueTurn = {
  speaker: Speaker
  text: string
  deliveryType: string
  pauseAfterMs: number
  overlapMs: number
  musicBridgeAfter: boolean
}

const CURRENT_DIALOGUE_SLUG = 'how-do-we-assess-without-breaking-the-human-beingarabic'
const bundledDialogues: Record<string, DialogueTurn[]> = {
  [CURRENT_DIALOGUE_SLUG]: assessmentDialogue as DialogueTurn[],
}

const deliveryTypes = [
  ['statement', 'حديث طبيعي'],
  ['question', 'سؤال'],
  ['response', 'رد'],
  ['reflection', 'تأمل'],
  ['objection', 'اعتراض'],
  ['gentleObjection', 'اعتراض هادئ'],
  ['explanation', 'شرح'],
  ['clarification', 'توضيح'],
  ['setup', 'تمهيد'],
  ['example', 'مثال'],
  ['emphasis', 'تأكيد'],
  ['briefReaction', 'رد فعل قصير'],
  ['conclusion', 'خلاصة'],
  ['closing', 'إغلاق'],
] as const

const card = 'rounded-2xl border border-hair bg-wash p-5 md:p-6'
const input = 'w-full rounded-xl border border-hair bg-canvas px-3.5 py-2.5 text-[.86rem] text-ink outline-none transition-colors focus:border-accent'
const ghost = 'rounded-full border border-hair bg-canvas px-4 py-2 text-[.78rem] font-semibold text-soft transition-colors hover:border-accent hover:text-accent disabled:cursor-not-allowed disabled:opacity-40'
const primary = 'rounded-full bg-accent px-5 py-2.5 text-[.8rem] font-semibold text-white transition-colors hover:bg-accent-deep disabled:cursor-not-allowed disabled:opacity-45'

const blankTurn = (speaker: Speaker): DialogueTurn => ({
  speaker,
  text: '',
  deliveryType: 'statement',
  pauseAfterMs: 320,
  overlapMs: 0,
  musicBridgeAfter: false,
})

function normalizeTurns(value: unknown): DialogueTurn[] | null {
  if (!Array.isArray(value) || value.length < 2) return null
  const turns: DialogueTurn[] = []
  for (const item of value) {
    if (!item || typeof item !== 'object') return null
    const raw = item as Record<string, unknown>
    const speakerValue = String(raw.speaker || '').trim().toLowerCase()
    const speaker = speakerValue === 'female' || speakerValue === 'b' ? 'female' : speakerValue === 'male' || speakerValue === 'a' ? 'male' : null
    const text = String(raw.text || '').trim()
    if (!speaker || !text) return null
    turns.push({
      speaker,
      text,
      deliveryType: deliveryTypes.some(([key]) => key === String(raw.deliveryType || '')) ? String(raw.deliveryType) : 'statement',
      pauseAfterMs: Math.max(0, Math.min(3000, Number(raw.pauseAfterMs ?? 320) || 0)),
      overlapMs: Math.max(0, Math.min(150, Number(raw.overlapMs ?? 0) || 0)),
      musicBridgeAfter: Boolean(raw.musicBridgeAfter),
    })
  }
  return turns
}

function storedDialogue(slug: string) {
  try {
    return normalizeTurns(JSON.parse(localStorage.getItem(`podcast:manual-dialogue:${slug}`) || 'null'))
  } catch {
    return null
  }
}

export function ManualDialogueEditor({ articles }: { articles: ArticleRecord[] }) {
  const sortedArticles = useMemo(() => [...articles].sort((a, b) => b.iso.localeCompare(a.iso)), [articles])
  const initialSlug = sortedArticles.some((item) => item.slug === CURRENT_DIALOGUE_SLUG)
    ? CURRENT_DIALOGUE_SLUG
    : sortedArticles[0]?.slug || CURRENT_DIALOGUE_SLUG
  const [slug, setSlug] = useState(initialSlug)
  const [turns, setTurns] = useState<DialogueTurn[]>(() => storedDialogue(initialSlug) || bundledDialogues[initialSlug]?.map((item) => ({ ...item })) || [blankTurn('male'), blankTurn('female')])
  const [notice, setNotice] = useState('')
  const [dirty, setDirty] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const article = sortedArticles.find((item) => item.slug === slug)
  const json = useMemo(() => JSON.stringify(turns, null, 2), [turns])
  const wordCount = useMemo(() => turns.reduce((sum, item) => sum + item.text.split(/\s+/).filter(Boolean).length, 0), [turns])
  const warnings = useMemo(() => {
    const result: string[] = []
    const dialect = /(^|[\s،.؟!؛:])(مو|ليش|شلون|خلنا|هني|جذي|وايد|صج|شنو|أبي|تدري|يا معود)([\s،.؟!؛:]|$)/u
    turns.forEach((turn, index) => {
      if (!turn.text.trim()) result.push(`المداخلة ${index + 1} بلا نص.`)
      if (turn.text.length > 220) result.push(`المداخلة ${index + 1} طويلة؛ اختصرها لتبقى منطوقة وطبيعية.`)
      if (dialect.test(turn.text)) result.push(`المداخلة ${index + 1} تحتوي تعبيرًا عاميًا يحتاج مراجعة.`)
      if (index > 0 && turns[index - 1].speaker === turn.speaker) result.push(`المداخلتان ${index} و${index + 1} للصوت نفسه متتاليتان.`)
    })
    if (turns.length < 2) result.push('الحوار يحتاج مداخلتين على الأقل.')
    return result
  }, [turns])

  useEffect(() => {
    const next = storedDialogue(slug) || bundledDialogues[slug]?.map((item) => ({ ...item })) || [blankTurn('male'), blankTurn('female')]
    setTurns(next)
    setDirty(false)
    setNotice(bundledDialogues[slug] ? 'فُتح الحوار اليدوي الموجود لهذه الحلقة.' : 'مسودة جديدة جاهزة للكتابة.')
  }, [slug])

  const update = (index: number, patch: Partial<DialogueTurn>) => {
    setTurns((current) => current.map((turn, turnIndex) => turnIndex === index ? { ...turn, ...patch } : turn))
    setDirty(true)
    setNotice('')
  }

  const save = () => {
    try {
      localStorage.setItem(`podcast:manual-dialogue:${slug}`, json)
      setDirty(false)
      setNotice('حُفظت المسودة على هذا الجهاز ✓')
    } catch {
      setNotice('تعذّر الحفظ المحلي على هذا الجهاز.')
    }
  }

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(json)
      setNotice('نُسخ JSON كاملًا ✓')
    } catch {
      setNotice('تعذّر النسخ التلقائي؛ استخدم زر التنزيل.')
    }
  }

  const download = () => {
    const blob = new Blob([`${json}\n`], { type: 'application/json;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `${slug}.json`
    anchor.click()
    window.setTimeout(() => URL.revokeObjectURL(url), 1000)
    setNotice('نُزّل ملف الحوار باسم الحلقة، جاهز لمسار الصوت ✓')
  }

  const importFile = async (file?: File) => {
    if (!file) return
    try {
      const parsed = normalizeTurns(JSON.parse(await file.text()))
      if (!parsed) throw new Error('invalid')
      setTurns(parsed)
      setDirty(true)
      setNotice(`استُورد ${parsed.length} مداخلة بنجاح؛ راجعها ثم احفظ.`)
    } catch {
      setNotice('الملف غير صالح. المطلوب مصفوفة JSON فيها speaker وtext لكل مداخلة.')
    } finally {
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const move = (index: number, direction: -1 | 1) => {
    const target = index + direction
    if (target < 0 || target >= turns.length) return
    setTurns((current) => {
      const next = [...current]
      ;[next[index], next[target]] = [next[target], next[index]]
      return next
    })
    setDirty(true)
  }

  const remove = (index: number) => {
    if (turns.length <= 2) return
    setTurns((current) => current.filter((_, turnIndex) => turnIndex !== index))
    setDirty(true)
  }

  const add = () => {
    const last = turns[turns.length - 1]
    setTurns((current) => [...current, blankTurn(last?.speaker === 'male' ? 'female' : 'male')])
    setDirty(true)
  }

  return (
    <div className="grid gap-5">
      <section className={card}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-3xl">
            <p className="text-[.76rem] font-semibold uppercase text-accent">الحوار اليدوي للحلقة</p>
            <h2 className="mt-1 font-display text-2xl font-semibold text-ink">اكتب فهد ونورة مداخلةً مداخلة.</h2>
            <p className="mt-2 text-[.84rem] leading-relaxed text-soft">اختر المقال، اكتب الحوار الطبيعي، واضبط الوقفات البسيطة. الحفظ يبقي المسودة على جهازك، والتنزيل يخرج ملف JSON الجاهز لمسار إنتاج الحلقة.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <input ref={fileRef} type="file" accept="application/json,.json" className="hidden" onChange={(event) => void importFile(event.target.files?.[0])} />
            <button type="button" className={ghost} onClick={() => fileRef.current?.click()}>استيراد JSON</button>
            <button type="button" className={ghost} onClick={() => void copy()}>نسخ JSON</button>
            <button type="button" className={primary} onClick={download} disabled={warnings.some((item) => item.includes('بلا نص'))}>تنزيل الحوار</button>
          </div>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
          <label className="block min-w-0">
            <span className="mb-1.5 block text-[.76rem] font-semibold text-soft">الحلقة / المقال</span>
            <select className={input} value={slug} onChange={(event) => setSlug(event.target.value)}>
              {sortedArticles.map((item) => <option key={item.slug} value={item.slug}>{item.title}</option>)}
            </select>
          </label>
          <button type="button" onClick={save} className={dirty ? primary : ghost}>{dirty ? 'حفظ المسودة' : 'المسودة محفوظة'}</button>
        </div>

        <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 rounded-xl border border-hair bg-canvas px-4 py-3 text-[.76rem] text-soft">
          <span><strong className="text-ink">{turns.length}</strong> مداخلة</span>
          <span><strong className="text-ink">{wordCount}</strong> كلمة</span>
          <span><strong className="text-ink">{turns.filter((item) => item.speaker === 'male').length}</strong> لفهد</span>
          <span><strong className="text-ink">{turns.filter((item) => item.speaker === 'female').length}</strong> لنورة</span>
          {article && <span className="min-w-0 truncate">الملف: <span dir="ltr">{article.slug}.json</span></span>}
        </div>

        {notice && <p className="mt-4 rounded-xl border border-accent/25 bg-canvas px-4 py-3 text-[.8rem] text-accent">{notice}</p>}
        {warnings.length > 0 && (
          <details className="mt-4 rounded-xl border border-hair bg-canvas px-4 py-3">
            <summary className="cursor-pointer text-[.8rem] font-semibold text-soft">ملاحظات الجودة ({warnings.length})</summary>
            <ul className="mt-3 grid gap-1.5 text-[.76rem] leading-relaxed text-soft">
              {warnings.slice(0, 12).map((warning, index) => <li key={`${warning}-${index}`} className="text-start">{warning}</li>)}
            </ul>
          </details>
        )}
      </section>

      <section className="grid gap-3">
        {turns.map((turn, index) => (
          <div key={index} className="rounded-2xl border border-hair bg-canvas p-4 md:p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-wash font-display text-[.82rem] font-semibold text-accent">{index + 1}</span>
                <select className="rounded-full border border-hair bg-wash px-3 py-1.5 text-[.76rem] font-semibold text-ink outline-none focus:border-accent" value={turn.speaker} onChange={(event) => update(index, { speaker: event.target.value as Speaker })}>
                  <option value="male">فهد</option>
                  <option value="female">نورة</option>
                </select>
                <select className="rounded-full border border-hair bg-wash px-3 py-1.5 text-[.76rem] text-soft outline-none focus:border-accent" value={turn.deliveryType} onChange={(event) => update(index, { deliveryType: event.target.value })}>
                  {deliveryTypes.map(([key, label]) => <option key={key} value={key}>{label}</option>)}
                </select>
              </div>
              <div className="flex items-center gap-1.5">
                <button type="button" className="h-8 w-8 rounded-full border border-hair text-soft disabled:opacity-30" aria-label="تحريك لأعلى" disabled={index === 0} onClick={() => move(index, -1)}>↑</button>
                <button type="button" className="h-8 w-8 rounded-full border border-hair text-soft disabled:opacity-30" aria-label="تحريك لأسفل" disabled={index === turns.length - 1} onClick={() => move(index, 1)}>↓</button>
                <button type="button" className="h-8 rounded-full border border-hair px-3 text-[.72rem] text-soft disabled:opacity-30" disabled={turns.length <= 2} onClick={() => remove(index)}>حذف</button>
              </div>
            </div>

            <textarea
              className={`${input} mt-3 min-h-24 resize-y leading-[1.9]`}
              dir="rtl"
              value={turn.text}
              placeholder={turn.speaker === 'male' ? 'مداخلة فهد…' : 'مداخلة نورة…'}
              onChange={(event) => update(index, { text: event.target.value })}
            />

            <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-[10rem_10rem_minmax(0,1fr)] sm:items-end">
              <label className="block">
                <span className="mb-1 block text-[.7rem] text-soft">الوقفة بعدها (ms)</span>
                <input className={input} type="number" min="0" max="3000" step="10" value={turn.pauseAfterMs} onChange={(event) => update(index, { pauseAfterMs: Math.max(0, Math.min(3000, Number(event.target.value) || 0)) })} />
              </label>
              <label className="block">
                <span className="mb-1 block text-[.7rem] text-soft">التداخل (ms)</span>
                <input className={input} type="number" min="0" max="150" step="10" value={turn.overlapMs} onChange={(event) => update(index, { overlapMs: Math.max(0, Math.min(150, Number(event.target.value) || 0)) })} />
              </label>
              <label className="col-span-2 flex min-h-[42px] items-center gap-2 rounded-xl border border-hair bg-wash px-3 text-[.76rem] text-soft sm:col-span-1">
                <input type="checkbox" checked={turn.musicBridgeAfter} onChange={(event) => update(index, { musicBridgeAfter: event.target.checked })} />
                جسر موسيقي بعد المداخلة
              </label>
            </div>
          </div>
        ))}
      </section>

      <button type="button" onClick={add} className="rounded-2xl border border-dashed border-accent/45 bg-wash px-5 py-4 text-[.82rem] font-semibold text-accent transition-colors hover:border-accent">إضافة مداخلة جديدة +</button>
    </div>
  )
}
