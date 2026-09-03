import { useEffect, useMemo, useState } from 'react'
import { getDb } from '../../lib/firebase'

/*
 * رسائل البوت — تحرير النصوص التي يخاطب بها مساعدُ واتساب جمهورَك، بلا لمس الكود.
 * تُحفظ في Firestore (bot_messages/templates)، ويجلبها البوت عبر REST كل ~٥ دقائق.
 * لو غاب Firestore يعمل البوت ببدائلَ مضمّنةٍ مطابقة، فلا يصمت أبداً.
 *
 * ملاحظة: المفاتيح والنصوص الافتراضية هنا يجب أن تطابق
 * whatsapp-agent/bot-messages.mjs (المصدر الأصلي للبوت).
 */

type Field = { key: string; label: string; hint: string; multiline: boolean; fallback: string; group: 'welcome' | 'reply' | 'control' }

const FIELDS: Field[] = [
  { key: 'welcomeLine', label: 'جملة الترحيب (الإيقاظ)', hint: 'أول ما يقرؤه الزائر عند كتابة «موقع د. أحمد». تسبقها تحية الوقت تلقائياً، ويضيف البوت النقطة في آخرها — فلا تضع نقطة.', multiline: false, group: 'welcome', fallback: 'حيّاك الله. فتحت لك مكتبة د. أحمد الفيلكاوي' },
  { key: 'dailyGateLabel', label: 'عنوان بوابة اليوم', hint: 'العنوان فوق مادة اليوم في رسالة الترحيب.', multiline: false, group: 'welcome', fallback: 'بوابة اليوم:' },
  { key: 'optionsPrompt', label: 'سطر خيارات الوقت', hint: 'يعرض خيارات القراءة (٣٠ ثانية · دقيقتان · تعمّق · اختبرني).', multiline: false, group: 'welcome', fallback: 'شنو يناسب وقتك؟ ٣٠ ثانية · دقيقتان · تعمّق · اختبرني' },
  { key: 'stopHint', label: 'تذكير إيقاف الرسائل', hint: 'سطرٌ يذكّر الزائر كيف يوقف الرسائل.', multiline: false, group: 'welcome', fallback: 'ولإيقاف الرسائل اكتب: أوقف الرسائل.' },
  { key: 'signature', label: 'توقيع الردّ الآلي', hint: 'يُلحق بكل ردٍّ آليّ (عدا ردود الخصوصية).', multiline: false, group: 'reply', fallback: 'رد آلي من موقع د. أحمد حسين الفيلكاوي' },
  { key: 'doorsPrefix', label: 'تمهيد أبواب الأرشيف', hint: 'يسبق قائمة الأبواب في رسالة «لم يُنشر عنه». احتفظ بالمسافة في آخره.', multiline: false, group: 'reply', fallback: 'أبواب الأرشيف الحاضرة: ' },
  { key: 'notPublishedReached', label: 'خارج المحتوى المنشور', hint: 'حين يكون الموضوع خارج المحتوى المنشور؛ يطلب زاوية أدق ولا يدّعي وصول الرسالة إلى شخص.', multiline: true, group: 'reply', fallback: 'سؤالك خارج المحتوى المنشور في الموقع. أعطني زاوية أو كلمة أدق، وسأحاول معك من جديد من دون اختلاق جواب.' },
  { key: 'notPublishedReachedCta', label: 'دعوة تالية (خارج المنشور)', hint: 'سطرٌ يقترح بوابة اليوم أو موضوعاً من المقالات.', multiline: true, group: 'reply', fallback: 'تقدر أيضاً تكتب «بوابة اليوم» أو تسأل عن أي موضوعٍ من مقالاته.' },
  { key: 'notPublishedNew', label: 'لم يُنشر عنه بعد', hint: 'حين لا يوجد محتوى منشور عن الموضوع أصلاً.', multiline: true, group: 'reply', fallback: 'هذا الموضوع لم يُنشر عنه في الموقع بعد. أقدر أبحث لك عن أقرب فكرة منشورة أو أوضح حدود ما هو متاح.' },
  { key: 'notPublishedNewCta', label: 'دعوة تالية (لم يُنشر)', hint: 'سطرٌ يقترح باباً من الأرشيف أو «آخر مقالاته».', multiline: true, group: 'reply', fallback: 'اسأل داخل أي بابٍ منها، أو اكتب «آخر مقالاته».' },
  { key: 'noMatch', label: 'لا مادة مطابقة', hint: 'حين لا يجد بحثُ الأرشيف مادةً منشورةً مطابقة.', multiline: true, group: 'reply', fallback: 'ما لقيت مادة منشورة مطابقة الآن. اكتب لي الموضوع أو النوع الذي تريده، وأبحث لك من جديد.' },
  { key: 'clarify', label: 'لم أفهم الطلب', hint: 'حين لا يفهم البوت الطلب بثقة كافية، يسأل عن المقصود.', multiline: true, group: 'reply', fallback: 'ما فهمت الطلب بدقة. هل تبحث في المقالات، الكتب، الأبحاث، أم البودكاست؟' },
  { key: 'humanHandoff', label: 'طلب التواصل المباشر', hint: 'ردّ صادق بلا وعد بموعد أو ادعاء أن فريقاً سيتابع تلقائياً.', multiline: false, group: 'reply', fallback: 'أفهم أنك تريد التواصل مع الدكتور مباشرة. اكتب رسالتك كاملة هنا؛ لا أستطيع أن أعدك بموعد رد.' },
  { key: 'stopConfirm', label: 'تأكيد إيقاف الرسائل', hint: 'يُعرض حين يطلب الزائر إيقاف رسائل المحتوى.', multiline: true, group: 'control', fallback: 'تم، لن تصلك رسائل محتوى جديدة. إذا رغبت بالعودة اكتب: رجع الرسائل.' },
  { key: 'resumeConfirm', label: 'تأكيد عودة الرسائل', hint: 'يُعرض حين يعيد الزائر تفعيل الرسائل.', multiline: false, group: 'control', fallback: 'عاد الاشتراك في رسائل المحتوى.' },
]

const GROUPS: { id: Field['group']; label: string }[] = [
  { id: 'welcome', label: 'رسائل الترحيب (الإيقاظ)' },
  { id: 'reply', label: 'ردود المحتوى' },
  { id: 'control', label: 'التحكم والخصوصية' },
]

const DEFAULTS: Record<string, string> = Object.fromEntries(FIELDS.map((field) => [field.key, field.fallback]))
const LEGACY_HUMAN_PROMISE = /(?:احتاجت|تحتاج)\s+متابعه\s+بشريه|سيكمل\s+معك\s+(?:الفريق|الدكتور)|سيرد\s+عليك\s+الدكتور|وصلت?\s+رسالتك\s+(?:للدكتور|للفريق)|وصل(?:ت)?\s+للدكتور|يجيبك\s+بنفسه/i

function normalizeArabic(value: string) {
  return value.normalize('NFKD').replace(/[\u064B-\u065F\u0670]/g, '').replace(/ة/g, 'ه')
}

function safeTemplateValue(field: Field, value: unknown) {
  const candidate = typeof value === 'string' ? value.trim() : ''
  if (!candidate || LEGACY_HUMAN_PROMISE.test(normalizeArabic(candidate))) return field.fallback
  return candidate
}

export function BotMessagesPanel() {
  const [values, setValues] = useState<Record<string, string>>(() => ({ ...DEFAULTS }))
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [notice, setNotice] = useState('')

  useEffect(() => {
    let alive = true
    void (async () => {
      try {
        const db = await getDb()
        if (!db) { if (alive) setNotice('Firebase غير متاح الآن — تُعرض النصوص الافتراضية.'); return }
        const { doc, getDoc } = await import('firebase/firestore')
        const snapshot = await getDoc(doc(db, 'bot_messages', 'templates'))
        if (alive && snapshot.exists()) {
          const data = snapshot.data() as Record<string, unknown>
          let repairedLegacyPromise = false
          const next = { ...DEFAULTS }
          for (const field of FIELDS) {
            const original = typeof data[field.key] === 'string' ? (data[field.key] as string).trim() : ''
            next[field.key] = safeTemplateValue(field, original)
            if (original && next[field.key] !== original) repairedLegacyPromise = true
          }
          setValues(next)
          if (repairedLegacyPromise) {
            setDirty(true)
            setNotice('عُزلت تلقائياً عبارات قديمة كانت تعد بمتابعة بشرية. اضغط «احفظ القوالب» لتنظيف النسخة السحابية نهائياً.')
          }
        }
      } catch { if (alive) setNotice('تعذّر جلب القوالب — تُعرض النصوص الافتراضية.') }
      finally { if (alive) setLoading(false) }
    })()
    return () => { alive = false }
  }, [])

  const setOne = (key: string, value: string) => { setValues((prev) => ({ ...prev, [key]: value })); setDirty(true); if (notice) setNotice('') }
  const resetOne = (key: string) => setOne(key, DEFAULTS[key])
  const resetAll = () => { setValues({ ...DEFAULTS }); setDirty(true); setNotice('') }

  const changedCount = useMemo(() => FIELDS.filter((field) => (values[field.key] || '') !== DEFAULTS[field.key]).length, [values])

  // معاينة حيّة: كيف يبدو ردّان مجمّعان (ترحيب + «لم يُنشر») من القيم الحالية.
  const preview = useMemo(() => {
    const value = (key: string) => (values[key] || '').trim() || DEFAULTS[key]
    const welcome = `صباح الخير · ${value('welcomeLine')}.\n\n${value('dailyGateLabel')}\nعنوان مادة اليوم · ٢٠٢٦\n«اقتباسٌ قصيرٌ من المادة…»\nhttps://dr-alfailakawi.com/…\n\n${value('optionsPrompt')}\n${value('stopHint')}`
    const notPublished = `${value('notPublishedNew')}\n${value('doorsPrefix')}المقالات · الكتب · الأبحاث.\n${value('notPublishedNewCta')}\n\n${value('signature')}`
    return { welcome, notPublished }
  }, [values])

  const save = async () => {
    setSaving(true); setNotice('')
    try {
      const db = await getDb()
      if (!db) throw new Error('Firebase غير متاح')
      const { doc, setDoc, serverTimestamp } = await import('firebase/firestore')
      const payload: Record<string, unknown> = { updatedAt: serverTimestamp() }
      const safeValues = { ...values }
      let repairedLegacyPromise = false
      for (const field of FIELDS) {
        const original = (values[field.key] || '').trim()
        const safeValue = safeTemplateValue(field, original)
        payload[field.key] = safeValue
        safeValues[field.key] = safeValue
        if (original && safeValue !== original) repairedLegacyPromise = true
      }
      await setDoc(doc(db, 'bot_messages', 'templates'), payload, { merge: true })
      setValues(safeValues)
      setDirty(false)
      setNotice(repairedLegacyPromise
        ? 'حُفظت القوالب ✓ ونُظّفت تلقائياً أي عبارة تعد بمتابعة بشرية. يلتقطها البوت خلال خمس دقائق.'
        : 'حُفظت القوالب ✓ — يلتقطها البوت خلال خمس دقائق. ولو غاب Firestore تعمل البدائل المضمّنة فلا يصمت.')
    } catch (error) { setNotice(`تعذّر الحفظ: ${error instanceof Error ? error.message : 'خطأ'}`) }
    finally { setSaving(false) }
  }

  const card = 'rounded-2xl border border-hair bg-canvas p-4'
  const ghost = 'rounded-full border border-hair bg-canvas px-3 py-1.5 text-[.7rem] font-semibold text-soft transition hover:border-accent hover:text-accent disabled:opacity-50'
  const primary = 'rounded-full bg-accent px-5 py-2.5 text-[.8rem] font-bold text-white transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-50'

  return (
    <section className="grid gap-5" aria-labelledby="bot-messages-title">
      <header className={`${card} bg-wash`}>
        <p className="text-[.7rem] font-bold uppercase tracking-[.16em] text-accent">BOT MESSAGES</p>
        <h2 id="bot-messages-title" className="mt-1 font-display text-3xl font-bold text-ink">رسائل البوت</h2>
        <p className="mt-2 max-w-2xl text-[.85rem] font-light leading-relaxed text-soft">حرّر ما يقوله مساعدُ واتساب للزوّار. تُحفظ في السحابة ويلتقطها البوت خلال خمس دقائق — ولو انقطعت السحابة يعمل بنصوصٍ مضمّنةٍ مطابقة فلا يصمت أبداً.</p>
      </header>

      {notice && <p className="rounded-2xl border border-accent/25 bg-accent/[.06] px-4 py-3 text-[.8rem] font-medium text-accent">{notice}</p>}

      {GROUPS.map((grp) => (
      <div key={grp.id} className="grid gap-3">
        <p className="text-[.7rem] font-bold uppercase tracking-[.12em] text-accent/80">{grp.label}</p>
        {FIELDS.filter((field) => field.group === grp.id).map((field) => {
          const value = values[field.key] ?? ''
          const isDefault = value === DEFAULTS[field.key]
          return (
            <div key={field.key} className={card}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-[.82rem] font-bold text-ink">{field.label}</p>
                  <p className="mt-0.5 text-[.68rem] font-light leading-relaxed text-soft">{field.hint}</p>
                </div>
                <button type="button" disabled={isDefault || loading} onClick={() => resetOne(field.key)} className={ghost}>استعد الافتراضي</button>
              </div>
              {field.multiline
                ? <textarea dir="rtl" value={value} disabled={loading} onChange={(event) => setOne(field.key, event.target.value)} rows={2} className="mt-3 w-full resize-y rounded-xl border border-hair bg-paper px-3 py-2 text-[.85rem] leading-relaxed text-ink outline-none transition focus:border-accent" />
                : <input dir="rtl" value={value} disabled={loading} onChange={(event) => setOne(field.key, event.target.value)} className="mt-3 w-full rounded-xl border border-hair bg-paper px-3 py-2 text-[.85rem] text-ink outline-none transition focus:border-accent" />}
            </div>
          )
        })}
      </div>
      ))}

      <section className={`${card} bg-wash`}>
        <p className="text-[.7rem] font-bold text-accent">معاينة حيّة · كيف يقرؤها الزائر</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div>
            <p className="mb-1.5 text-[.64rem] font-semibold text-soft">ردّ الترحيب (الإيقاظ)</p>
            <div dir="rtl" className="whitespace-pre-wrap rounded-2xl rounded-tr-sm border border-hair bg-canvas p-3 text-[.78rem] leading-relaxed text-ink">{preview.welcome}</div>
          </div>
          <div>
            <p className="mb-1.5 text-[.64rem] font-semibold text-soft">ردّ «موضوع لم يُنشر»</p>
            <div dir="rtl" className="whitespace-pre-wrap rounded-2xl rounded-tr-sm border border-hair bg-canvas p-3 text-[.78rem] leading-relaxed text-ink">{preview.notPublished}</div>
          </div>
        </div>
      </section>

      <div className="flex flex-wrap items-center gap-3">
        <button type="button" className={primary} disabled={saving || loading || !dirty} onClick={() => void save()}>{saving ? 'يحفظ…' : 'احفظ القوالب'}</button>
        <button type="button" className={ghost} disabled={saving || loading || changedCount === 0} onClick={resetAll}>استعد كل الافتراضي</button>
        <span className="text-[.72rem] text-soft">{changedCount ? `${changedCount} قالب مُعدَّل عن الأصل` : 'كل القوالب على النص الأصلي'}</span>
      </div>
    </section>
  )
}
