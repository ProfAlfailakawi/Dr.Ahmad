import { useCallback, useEffect, useMemo, useState } from 'react'
import { getDb, getFirebaseApp } from '../../lib/firebase'
import { books, papers } from '../../data'
import { publicationGate, topicMemory } from '../../lib/intelligence'
import { getArticleBody } from '../../lib/article-bodies'

export type ManagedKind = 'article' | 'book' | 'paper' | 'media'

type CmsMeta = {
  origin: 'base' | 'added'
  modified?: boolean
  hidden?: boolean
  docId?: string
  baseSlug?: string
  createdAt?: unknown
}

export type ManagedRecord = {
  slug: string
  title: string
  iso?: string
  date?: string
  cat?: string
  excerpt?: string
  body?: string
  source?: string
  url?: string
  status?: string
  scheduledAt?: string
  isbn?: string
  desc?: string
  cover?: string
  pdf?: string
  meta?: string
  journal?: string
  outlet?: string
  platform?: string
  _cms: CmsMeta
  [key: string]: unknown
}

type Props = {
  kind: ManagedKind
  items: ManagedRecord[]
  getBaseRecord: (kind: ManagedKind, slug: string) => Record<string, unknown> | undefined
  onChanged: () => Promise<unknown> | unknown
  /* تحرير موضعي: يفتح نموذج هذا الـslug فور الوصول (رابط ✎ من صفحة العرض) */
  openSlug?: string
}

type Form = Record<string, string>

const collections: Record<ManagedKind, string> = {
  article: 'site_articles',
  book: 'site_books',
  paper: 'site_papers',
  media: 'site_media',
}

const labels: Record<ManagedKind, { singular: string; plural: string }> = {
  article: { singular: 'مقال', plural: 'المقالات' },
  book: { singular: 'كتاب', plural: 'الكتب' },
  paper: { singular: 'بحث', plural: 'الأبحاث' },
  media: { singular: 'ظهور إعلامي', plural: 'الإعلام' },
}

const editableFields: Record<ManagedKind, string[]> = {
  article: ['slug', 'title', 'iso', 'date', 'cat', 'excerpt', 'body', 'source', 'url', 'status', 'scheduledAt'],
  book: ['slug', 'title', 'isbn', 'desc', 'cover', 'pdf', 'coAuthors'],
  paper: ['slug', 'title', 'meta', 'journal', 'source', 'url', 'scholar', 'researchgate', 'coAuthors'],
  media: ['slug', 'title', 'outlet', 'url', 'iso', 'date'],
}

const input = 'w-full rounded-xl border border-hair bg-canvas px-4 py-3 text-[.94rem] text-ink outline-none transition-colors placeholder:text-soft/60 focus:border-accent'
const primary = 'rounded-full bg-accent px-6 py-2.5 text-[.9rem] font-semibold text-white transition-colors hover:bg-accent-deep disabled:cursor-not-allowed disabled:opacity-50'
const secondary = 'rounded-full border border-hair px-5 py-2.5 text-[.86rem] text-soft transition-colors hover:border-accent hover:text-accent disabled:opacity-50'

/* اقتراح محلي فوري — احتياط زر الذكاء الاصطناعي حين لا يتوفر الخادم.
   نفس المنطق الحدسي الذي صنّف مقالات الأرشيف الـ96. */
const CAT_KEYS: [string, string[]][] = [
  ['تقنية', ['تقني', 'تكنولوج', 'ذكاء اصطناعي', 'روبوت', 'تطبيق', 'جوال', 'يوتيوب', 'إنترنت', 'رقمي', 'واقع معزز', 'افتراضي', 'بيانات', 'برمج', 'سوشيال']],
  ['التعليم', ['تعليم', 'التعلّم', 'التعلم', 'مدرس', 'معلم', 'طالب', 'جامع', 'منهج', 'امتحان', 'صف', 'تربوي', 'التدريس', 'مدرسة']],
  ['التربية', ['تربية', 'ابن', 'أبناء', 'طفل', 'أسرة', 'والدين', 'بيت', 'قيم']],
  ['إعلام', ['إعلام', 'صحافة', 'قناة', 'خبر', 'تلفزيون', 'فضائي', 'بث']],
  ['هوية', ['هوية', 'تراث', 'لغة', 'عربي', 'أصالة', 'انتماء', 'وطن', 'مواطن']],
  ['مجتمع', ['مجتمع', 'ناس', 'اجتماع', 'شباب', 'ظاهرة', 'سلوك', 'عادات', 'إدمان']],
  ['بحث', ['بحث', 'دراسة', 'أكاديمي', 'منهجية', 'نتائج', 'عينة', 'استبانة']],
]
function localSuggest(title: string, body: string) {
  const sample = title + ' ' + body.slice(0, 600)
  let cat = 'التعليم', best = 0
  for (const [name, keys] of CAT_KEYS) {
    let score = 0
    for (const k of keys) score += sample.split(k).length - 1
    if (score > best) { best = score; cat = name }
  }
  const flat = body.replace(/\s+/g, ' ').trim()
  const parts = flat.split(/(?<=[.!؟])\s/)
  let excerpt = ''
  for (const p of parts) {
    if (excerpt.length + p.length > 170 && excerpt) break
    excerpt = (excerpt + ' ' + p).trim()
  }
  return { cat, excerpt: excerpt.slice(0, 200).trim() }
}

async function requestContentSuggestion(kind: ManagedKind, form: Form): Promise<Form> {
  try {
    const app = await getFirebaseApp()
    if (!app) throw new Error('Firebase غير متاح')
    const { getAuth } = await import('firebase/auth')
    const token = await getAuth(app).currentUser?.getIdToken()
    if (!token) throw new Error('انتهت جلسة الدخول')
    const response = await fetch('/api/ai/content-suggestion', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        kind,
        title: form.title || '',
        text: kind === 'article' ? form.body || '' : kind === 'book' ? form.desc || '' : kind === 'paper' ? form.meta || '' : '',
        url: form.url || form.source || form.pdf || '',
      }),
    })
    const payload = await response.json() as Form & { error?: string }
    if (!response.ok) throw new Error(payload.error || 'تعذّر إنشاء الاقتراح')
    return payload
  } catch (reason) {
    if (kind !== 'article') throw reason
    const fallback = localSuggest(form.title || '', form.body || '')
    if (!fallback.cat || !fallback.excerpt) throw new Error('نص المقال قصير جداً لإنشاء المقتطف')
    return { ...fallback, _aiFallback: '1' }
  }
}

function suggestionKey(kind: ManagedKind, form: Form) {
  if (kind === 'article') return `${form.title || ''}\u0000${form.body || ''}`
  if (kind === 'media') return form.url || ''
  if (kind === 'book') return `${form.title || ''}\u0000${form.pdf || ''}`
  return `${form.title || ''}\u0000${form.url || form.source || ''}`
}

function dateArabic(iso: string) {
  if (!iso) return ''
  const date = new Date(`${iso}T12:00:00+03:00`)
  if (Number.isNaN(date.getTime())) return ''
  return new Intl.DateTimeFormat('ar-KW', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Kuwait' }).format(date)
}

function todayIso() {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Kuwait', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date())
  const get = (type: string) => parts.find((part) => part.type === type)?.value || ''
  return `${get('year')}-${get('month')}-${get('day')}`
}

function localDateTimeValue(date = new Date(Date.now() + 60 * 60 * 1000)) {
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function slugify(value: string) {
  const arabic: Record<string, string> = {
    ا: 'a', أ: 'a', إ: 'i', آ: 'a', ب: 'b', ت: 't', ث: 'th', ج: 'j', ح: 'h', خ: 'kh',
    د: 'd', ذ: 'th', ر: 'r', ز: 'z', س: 's', ش: 'sh', ص: 's', ض: 'd', ط: 't', ظ: 'z',
    ع: 'a', غ: 'gh', ف: 'f', ق: 'q', ك: 'k', ل: 'l', م: 'm', ن: 'n', ه: 'h', و: 'w',
    ي: 'y', ى: 'a', ة: 'h', ء: '', ئ: 'y', ؤ: 'w',
  }
  const transliterated = Array.from(value).map((character) => arabic[character] ?? character).join('')
  const normalized = transliterated
    .normalize('NFKD')
    .toLowerCase()
    .replace(/[ًٌٍَُِّْـ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 90)
  return normalized || `content-${todayIso()}-${Math.random().toString(36).slice(2, 7)}`
}

function blank(kind: ManagedKind): Form {
  const iso = todayIso()
  if (kind === 'article') return { slug: '', title: '', iso, date: dateArabic(iso), cat: '', excerpt: '', body: '', source: '', url: '', status: 'published', scheduledAt: '', _aiReady: '' }
  if (kind === 'book') return { slug: '', title: '', isbn: '', desc: '', cover: '', pdf: '', coAuthors: '' }
  if (kind === 'paper') return { slug: '', title: '', meta: '', journal: '', source: '', url: '', scholar: '', researchgate: '', coAuthors: '' }
  return { slug: '', title: '', outlet: '', url: '', iso, date: dateArabic(iso) }
}

function asForm(kind: ManagedKind, item: ManagedRecord): Form {
  const form = Object.fromEntries(editableFields[kind].map((field) => [field, String(item[field] ?? '')]))
  if (kind === 'article' && !form.status) form.status = 'published'
  if (kind === 'article' && form.cat && form.excerpt) form._aiReady = '1'
  return form
}

function cleanData(kind: ManagedKind, form: Form) {
  const data: Record<string, string> = {}
  for (const field of editableFields[kind]) {
    const value = String(form[field] ?? '').trim()
    if (value || ['slug', 'title', 'date', 'iso', 'cat', 'excerpt', 'body', 'desc', 'meta', 'outlet'].includes(field)) data[field] = value
  }
  if ((kind === 'article' || kind === 'media') && data.iso) data.date = dateArabic(data.iso)
  if (kind === 'article') {
    const fallback = localSuggest(data.title || '', data.body || '')
    if (!data.cat) data.cat = fallback.cat
    if (!data.excerpt) data.excerpt = fallback.excerpt
    data.excerpt = Array.from(data.excerpt.replace(/\s+/g, ' ').trim()).slice(0, 200).join('')
    if (data.status !== 'scheduled') data.scheduledAt = ''
  }
  return data
}

function same(a: unknown, b: unknown) {
  return String(a ?? '').trim() === String(b ?? '').trim()
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="grid gap-1.5">
      <span className="text-[.82rem] font-semibold text-ink">{label}</span>
      {children}
      {hint && <span className="text-[.72rem] leading-relaxed text-soft">{hint}</span>}
    </label>
  )
}

export function UploadField({
  label,
  value,
  accept,
  folder,
  slug,
  maxMb,
  onChange,
}: {
  label: string
  value: string
  accept: string
  folder: 'covers' | 'files'
  slug: string
  maxMb: number
  onChange: (value: string) => void
}) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const upload = async (file?: File) => {
    if (!file) return
    setError('')
    if (file.size > maxMb * 1024 * 1024) {
      setError(`الحد الأقصى ${maxMb}MB.`)
      return
    }
    setBusy(true)
    try {
      const app = await getFirebaseApp()
      if (!app) throw new Error('Firebase غير متاح')
      const { getStorage, getDownloadURL, ref, uploadBytes } = await import('firebase/storage')
      const safe = slugify(slug || file.name.replace(/\.[^.]+$/, ''))
      const extension = file.name.split('.').pop()?.toLowerCase().replace(/[^a-z0-9]/g, '') || (folder === 'covers' ? 'webp' : 'pdf')
      const storage = getStorage(app)
      const target = ref(storage, `site-content/${folder}/${safe}-${Date.now()}.${extension}`)
      await uploadBytes(target, file, { contentType: file.type })
      onChange(await getDownloadURL(target))
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'تعذّر رفع الملف')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Field label={label} hint={error || (value ? 'تم حفظ رابط الملف؛ يمكنك رفع بديل.' : undefined)}>
      <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
        <input className={input} dir="ltr" value={value} onChange={(event) => onChange(event.target.value)} placeholder="https://… أو ارفع ملفاً" />
        <label className={`${secondary} cursor-pointer text-center`}>
          {busy ? 'جارٍ الرفع…' : 'رفع ملف'}
          <input className="sr-only" type="file" accept={accept} disabled={busy} onChange={(event) => void upload(event.target.files?.[0])} />
        </label>
      </div>
    </Field>
  )
}

function Editor({
  kind,
  current,
  form,
  busy,
  error,
  setForm,
  onClose,
  onSave,
  allItems,
}: {
  kind: ManagedKind
  current: ManagedRecord | null
  form: Form
  busy: boolean
  error: string
  setForm: React.Dispatch<React.SetStateAction<Form>>
  onClose: () => void
  onSave: () => void
  allItems: ManagedRecord[]
}) {
  // أي رقم هندي يكتبه الدكتور يتحوّل غربياً فوراً — قاعدة الموقع في كل الخانات
  const west = (s: string) => s.replace(/[٠-٩]/g, (d) => '0123456789'['٠١٢٣٤٥٦٧٨٩'.indexOf(d)])
  const set = (field: string, value: string) => setForm((previous) => {
    value = west(value)
    const next = { ...previous, [field]: value }
    if (!current && field === 'title' && (!previous.slug || previous.slug === slugify(previous.title))) next.slug = slugify(value)
    if ((kind === 'article' || kind === 'media') && field === 'iso') next.date = dateArabic(value)
    if (kind === 'article' && (field === 'title' || field === 'body')) {
      next.cat = ''
      next.excerpt = ''
      next._aiReady = ''
      next._aiFallback = ''
    }
    if (kind === 'media' && field === 'url' && value !== previous.url) {
      if (previous.title && previous.title === previous._aiGeneratedTitle) {
        if (!current && previous.slug === slugify(previous.title)) next.slug = ''
        next.title = ''
      }
      if (previous.outlet && previous.outlet === previous._aiGeneratedOutlet) next.outlet = ''
      next._aiInput = ''
    }
    if (kind === 'book' && field === 'title' && previous.desc === previous._aiGeneratedDesc) {
      next.desc = ''
      next._aiInput = ''
    }
    if (kind === 'paper' && ['title', 'source', 'url'].includes(field) && previous.meta === previous._aiGeneratedMeta) {
      next.meta = ''
      next._aiInput = ''
    }
    return next
  })

  const suggest = async (automatic = false) => {
    if (form._aiBusy === '1') return
    if (kind === 'article' && !form.body?.trim()) return
    const key = suggestionKey(kind, form)
    setForm((previous) => ({ ...previous, _aiBusy: '1', _aiError: '' }))
    try {
      const payload = await requestContentSuggestion(kind, form)
      setForm((previous) => {
        const next: Form = { ...previous, _aiBusy: '', _aiError: '', _aiInput: key }
        for (const [field, value] of Object.entries(payload)) {
          if (field.startsWith('_')) continue
          if (!automatic || !String(previous[field] || '').trim()) next[field] = String(value || '')
        }
        if (kind === 'article') {
          next.cat = payload.cat || previous.cat
          next.excerpt = Array.from(payload.excerpt || previous.excerpt || '').slice(0, 200).join('')
          next._aiReady = next.cat && next.excerpt ? '1' : ''
          next._aiFallback = payload._aiFallback || ''
        }
        if (kind === 'book' && next.desc !== previous.desc) next._aiGeneratedDesc = next.desc
        if (kind === 'paper' && next.meta !== previous.meta) next._aiGeneratedMeta = next.meta
        if (kind === 'media') {
          if (next.title !== previous.title) next._aiGeneratedTitle = next.title
          if (next.outlet !== previous.outlet) next._aiGeneratedOutlet = next.outlet
        }
        if (!current && next.title && !previous.slug) next.slug = slugify(next.title)
        return next
      })
    } catch (reason) {
      setForm((previous) => ({
        ...previous,
        _aiBusy: '',
        _aiError: reason instanceof Error ? reason.message : 'تعذّر إنشاء الاقتراح',
        _aiInput: automatic ? key : previous._aiInput || '',
      }))
    }
  }

  const articleMemory = useMemo(() => {
    if (kind !== 'article') return null
    const comparable = allItems.filter((item) => item.slug !== current?.slug)
    return {
      memory: topicMemory(form.title || '', form.body || '', comparable as never, books as never, papers as never),
      gate: publicationGate({
        title: form.title,
        slug: form.slug,
        excerpt: form.excerpt,
        body: form.body,
        cat: form.cat,
        hasAudio: Boolean(current?.hasAudio),
      }, comparable as never),
    }
  }, [allItems, current?.hasAudio, current?.slug, form.body, form.cat, form.excerpt, form.slug, form.title, kind])

  useEffect(() => {
    if (form._aiBusy === '1') return
    const key = suggestionKey(kind, form)
    if (!key || form._aiInput === key) return
    const hasUrl = /^https?:\/\//i.test(form.url || form.source || form.pdf || '')
    const shouldSuggest = kind === 'media'
      ? hasUrl && (!form.title?.trim() || !form.outlet?.trim())
      : kind === 'book'
        ? Boolean(form.title?.trim().length >= 3 && !form.desc?.trim())
        : kind === 'paper'
          ? Boolean((form.title?.trim().length >= 3 || hasUrl) && !form.meta?.trim())
          : false
    if (!shouldSuggest) return
    const timer = window.setTimeout(() => void suggest(true), 900)
    return () => window.clearTimeout(timer)
  }, [form._aiBusy, form._aiInput, form.desc, form.meta, form.outlet, form.pdf, form.source, form.title, form.url, kind])

  return (
    <div className="fixed inset-0 z-[400] overflow-y-auto bg-ink/45 px-4 py-8 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label={`تحرير ${labels[kind].singular}`}>
      <div className="mx-auto max-w-3xl rounded-3xl border border-hair bg-canvas p-5 shadow-2xl md:p-8">
        <div className="mb-7 flex items-start justify-between gap-4">
          <div>
            <p className="text-[.76rem] font-semibold uppercase text-accent">{current ? 'تعديل' : 'إضافة جديدة'}</p>
            <h2 className="mt-1 font-display text-2xl font-bold text-ink">{labels[kind].singular}</h2>
          </div>
          <button type="button" onClick={onClose} className="flex h-10 w-10 items-center justify-center rounded-full border border-hair text-soft hover:border-accent hover:text-accent" aria-label="إغلاق">×</button>
        </div>

        <div className="grid gap-5">
          <Field label="العنوان" hint={kind === 'media' ? 'يمكنك لصق رابط الفيديو أولاً؛ سنملأ العنوان تلقائياً ثم تراجعه قبل النشر.' : undefined}>
            <input className={input} value={form.title || ''} onChange={(event) => set('title', event.target.value)} />
          </Field>
          <Field label="الرابط المختصر (slug)" hint={current ? 'يثبت بعد النشر حتى لا تنكسر الروابط والصوت والإحصاءات.' : 'تولّد تلقائياً، ويمكنك مراجعته قبل النشر.'}>
            <input className={input} dir="ltr" value={form.slug || ''} disabled={Boolean(current)} onChange={(event) => set('slug', slugify(event.target.value))} />
          </Field>

          {kind === 'article' && (
            <>
              <div className="grid gap-5 sm:grid-cols-2">
                <Field label="التاريخ"><input className={input} dir="ltr" type="date" value={form.iso || ''} onChange={(event) => set('iso', event.target.value)} /></Field>
                <Field label="التاريخ العربي (تلقائي)"><input className={input} value={form.date || ''} readOnly /></Field>
              </div>
              <div className="rounded-2xl border border-hair bg-wash p-4">
                <p className="text-[.82rem] font-semibold text-ink">النشر</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setForm((previous) => ({ ...previous, status: 'published', scheduledAt: '' }))}
                    className={`rounded-full border px-4 py-2 text-[.82rem] transition-colors ${form.status === 'scheduled' ? 'border-hair text-soft hover:border-accent hover:text-accent' : 'border-accent bg-accent text-white'}`}
                  >
                    نشر الآن
                  </button>
                  <button
                    type="button"
                    onClick={() => setForm((previous) => ({ ...previous, status: 'scheduled', scheduledAt: previous.scheduledAt || localDateTimeValue() }))}
                    className={`rounded-full border px-4 py-2 text-[.82rem] transition-colors ${form.status === 'scheduled' ? 'border-accent bg-accent text-white' : 'border-hair text-soft hover:border-accent hover:text-accent'}`}
                  >
                    جدولة النشر
                  </button>
                </div>
                {form.status === 'scheduled' && (
                  <div className="mt-4 max-w-sm">
                    <Field label="موعد النشر" hint="لن يظهر المقال للزوار إلا بعد هذا الوقت، وسيبقى ظاهرًا لك داخل اللوحة.">
                      <input className={input} dir="ltr" type="datetime-local" value={form.scheduledAt || ''} onChange={(event) => set('scheduledAt', event.target.value)} />
                    </Field>
                  </div>
                )}
              </div>
              <Field label="نص المقال" hint="افصل بين الفقرات بسطر فارغ. يظهر النص بمحاذاة كاملة أثناء الكتابة واللصق.">
                <textarea dir="rtl" style={{ textAlign: 'justify' }} className={`${input} min-h-[320px] text-justify leading-loose`} value={form.body || ''} onChange={(event) => set('body', event.target.value)} />
              </Field>
              {articleMemory && (form.title?.trim() || form.body?.trim()) && (
                <div className="rounded-2xl border border-hair bg-wash p-4">
                  <p className="text-[.82rem] font-semibold text-ink">ذاكرة المقال قبل النشر</p>
                  <p className="mt-2 text-[.8rem] leading-relaxed text-soft">{articleMemory.memory.note}</p>
                  <div className="mt-3 grid gap-3 md:grid-cols-2">
                    <div className="rounded-xl border border-hair bg-canvas p-3">
                      <p className="text-[.75rem] font-semibold text-accent">أقرب مقالات</p>
                      <ul className="mt-2 grid gap-1 text-[.78rem] text-soft">
                        {articleMemory.memory.relatedArticles.slice(0, 3).map((item) => <li key={item.slug}>• {item.title}</li>)}
                        {!articleMemory.memory.relatedArticles.length && <li>لا تشابه واضح؛ زاوية جديدة.</li>}
                      </ul>
                    </div>
                    <div className="rounded-xl border border-hair bg-canvas p-3">
                      <p className="text-[.75rem] font-semibold text-accent">{articleMemory.gate.ready ? 'بوابة النشر: جاهز' : 'بوابة النشر: يحتاج انتباه'}</p>
                      <ul className="mt-2 grid gap-1 text-[.78rem] text-soft">
                        {(articleMemory.gate.issues.length ? articleMemory.gate.issues : ['العناصر الأساسية مكتملة.']).slice(0, 5).map((issue) => <li key={issue}>• {issue}</li>)}
                      </ul>
                    </div>
                  </div>
                </div>
              )}
              <div className="flex flex-wrap items-center gap-3">
                <button type="button" onClick={() => void suggest()} disabled={form._aiBusy === '1' || !form.body?.trim()} className={secondary}>
                  {form._aiBusy === '1' ? 'أفكّر…' : '✦ تجهيز التصنيف والمقتطف الآن'}
                </button>
                {form._aiReady === '1' && <span className="text-[.78rem] text-accent">✓ التصنيف والمقتطف جاهزان تلقائياً{form._aiFallback === '1' ? ' (احتياط محلي)' : ''}.</span>}
                {form._aiError && <span className="text-[.78rem] text-soft">{form._aiError}</span>}
              </div>
              <p className="text-[.75rem] leading-relaxed text-soft">عند الضغط على «حفظ ونشر» يُنشأ التصنيف والمقتطف (بحد أقصى 200 حرف) تلقائياً إن لم يكونا جاهزين؛ لا يلزم إدخالهما يدوياً.</p>
              <Field label="رابط المصدر (اختياري)"><input className={input} dir="ltr" type="url" value={form.source || ''} onChange={(event) => set('source', event.target.value)} /></Field>
            </>
          )}

          {kind === 'book' && (
            <>
              <Field label="ISBN / ردمك"><input className={input} dir="ltr" value={form.isbn || ''} onChange={(event) => set('isbn', event.target.value)} /></Field>
              <Field label="الوصف"><textarea className={`${input} min-h-28 leading-loose`} value={form.desc || ''} onChange={(event) => set('desc', event.target.value)} /></Field>
              <div className="flex flex-wrap items-center gap-3">
                <button type="button" onClick={() => void suggest()} disabled={form._aiBusy === '1' || !form.title?.trim()} className={secondary}>{form._aiBusy === '1' ? 'أفكّر…' : '✦ اقترح وصفاً'}</button>
                <span className="text-[.75rem] text-soft">الاقتراح قابل للتعديل والمراجعة قبل الحفظ.</span>
                {form._aiError && <span className="text-[.78rem] text-soft">{form._aiError}</span>}
              </div>
              <UploadField label="الغلاف" value={form.cover || ''} accept="image/jpeg,image/png,image/webp" folder="covers" slug={form.slug || form.title} maxMb={12} onChange={(value) => set('cover', value)} />
              <UploadField label="ملف PDF" value={form.pdf || ''} accept="application/pdf" folder="files" slug={form.slug || form.title} maxMb={100} onChange={(value) => set('pdf', value)} />
              <Field label="مؤلفون مشاركون (اختياري)" hint="افصل بين الأسماء بفاصلة — تظهر «بالاشتراك مع…» في صفحة الكتاب."><input className={input} placeholder="مثال: د. فلان الفلاني، د. علّان العلّاني" value={form.coAuthors || ''} onChange={(event) => set('coAuthors', event.target.value)} /></Field>
            </>
          )}

          {kind === 'paper' && (
            <>
              <Field label="الوصف / الميتا"><textarea className={`${input} min-h-24`} value={form.meta || ''} onChange={(event) => set('meta', event.target.value)} /></Field>
              <div className="flex flex-wrap items-center gap-3">
                <button type="button" onClick={() => void suggest()} disabled={form._aiBusy === '1' || (!form.title?.trim() && !form.url?.trim() && !form.source?.trim())} className={secondary}>{form._aiBusy === '1' ? 'أفكّر…' : '✦ اقترح وصف الميتا'}</button>
                <span className="text-[.75rem] text-soft">الاقتراح قابل للتعديل والمراجعة قبل الحفظ.</span>
                {form._aiError && <span className="text-[.78rem] text-soft">{form._aiError}</span>}
              </div>
              <Field label="بيانات المجلة (اختياري)"><input className={input} value={form.journal || ''} onChange={(event) => set('journal', event.target.value)} /></Field>
              <UploadField label="رابط البحث أو PDF" value={form.source || form.url || ''} accept="application/pdf" folder="files" slug={form.slug || form.title} maxMb={100} onChange={(value) => { set('source', value); set('url', value) }} />
              <div className="grid gap-5 sm:grid-cols-2">
                <Field label="رابط Google Scholar (اختياري)" hint="يظهر كأيقونة في صفحة البحث إن مُلئ."><input className={input} dir="ltr" type="url" placeholder="https://scholar.google.com/…" value={form.scholar || ''} onChange={(event) => set('scholar', event.target.value)} /></Field>
                <Field label="رابط ResearchGate (اختياري)"><input className={input} dir="ltr" type="url" placeholder="https://www.researchgate.net/…" value={form.researchgate || ''} onChange={(event) => set('researchgate', event.target.value)} /></Field>
              </div>
              <Field label="باحثون مشاركون (اختياري)" hint="افصل بين الأسماء بفاصلة — تظهر «بالاشتراك مع…» في صفحة البحث."><input className={input} placeholder="مثال: د. فلان الفلاني، د. علّان العلّاني" value={form.coAuthors || ''} onChange={(event) => set('coAuthors', event.target.value)} /></Field>
            </>
          )}

          {kind === 'media' && (
            <>
              <Field label="المنصّة / القناة"><input className={input} value={form.outlet || ''} onChange={(event) => set('outlet', event.target.value)} /></Field>
              <Field label="رابط الفيديو" hint="الصق رابط يوتيوب — يُجلب العنوان والقناة تلقائياً إن كانا فارغين.">
                <input className={input} dir="ltr" type="url" value={form.url || ''} onChange={(event) => set('url', event.target.value)}
                  onBlur={async () => {
                    const u = (form.url || '').trim()
                    if (!u) return
                    try {
                      const r = await fetch(`https://www.youtube.com/oembed?url=${encodeURIComponent(u)}&format=json`)
                      if (!r.ok) return
                      const j = await r.json() as { title?: string; author_name?: string }
                      if (j.title && !form.title?.trim()) set('title', j.title)
                      if (j.author_name && !form.outlet?.trim()) set('outlet', j.author_name)
                    } catch { /* noop */ }
                  }} />
              </Field>
              <div className="flex flex-wrap items-center gap-3">
                <button type="button" onClick={() => void suggest()} disabled={form._aiBusy === '1' || !form.url?.trim()} className={secondary}>{form._aiBusy === '1' ? 'أقرأ الرابط…' : '✦ جلب العنوان والقناة'}</button>
                <span className="text-[.75rem] text-soft">راجع الحقول أعلاه وعدّلها قبل الحفظ.</span>
                {form._aiError && <span className="text-[.78rem] text-soft">{form._aiError}</span>}
              </div>
              <div className="grid gap-5 sm:grid-cols-2">
                <Field label="التاريخ"><input className={input} dir="ltr" type="date" value={form.iso || ''} onChange={(event) => set('iso', event.target.value)} /></Field>
                <Field label="التاريخ العربي (تلقائي)"><input className={input} value={form.date || ''} readOnly /></Field>
              </div>
            </>
          )}

          {error && <p className="rounded-xl border border-accent/30 bg-wash px-4 py-3 text-[.86rem] text-soft">{error}</p>}
          <div className="flex flex-wrap items-center gap-3 border-t border-hair pt-5">
            <button type="button" onClick={onSave} disabled={busy || !form.title?.trim() || !form.slug?.trim() || (kind === 'article' && (form.body || '').trim().length < 40)} className={primary}>
              {busy && kind === 'article' && form._aiReady !== '1' ? 'جارٍ تجهيز التصنيف والمقتطف…' : busy ? 'جارٍ الحفظ…' : kind === 'article' && form.status === 'scheduled' ? 'حفظ وجدولة' : 'حفظ ونشر'}
            </button>
            <button type="button" onClick={onClose} disabled={busy} className={secondary}>إلغاء</button>
          </div>
        </div>
      </div>
    </div>
  )
}

export function ContentManager({ kind, items, getBaseRecord, onChanged , openSlug }: Props) {
  const [query, setQuery] = useState('')
  const [descending, setDescending] = useState(true)
  const [current, setCurrent] = useState<ManagedRecord | null | undefined>(undefined)
  // ✎ من الموقع: افتح النموذج على العنصر المطلوب أول ما تتوفر القائمة (مرة واحدة)
  const [consumedOpen, setConsumedOpen] = useState(false)
  const hydrateArticleBody = useCallback((item: ManagedRecord) => {
    if (kind !== 'article' || item.body || item._cms.origin !== 'base') return
    void getArticleBody(item.slug).then((body) => {
      if (!body) return
      setForm((previous) => (
        previous.slug === item.slug && !previous.body ? { ...previous, body } : previous
      ))
    })
  }, [kind])
  useEffect(() => {
    if (consumedOpen || !openSlug || current !== undefined) return
    const target = items.find((it) => it.slug === openSlug)
    // لا بد من ملء النموذج أيضاً (كما في openEdit) وإلا فتحت شاشة تحرير فارغة
    if (target) {
      setForm(asForm(kind, target))
      setCurrent(target)
      hydrateArticleBody(target)
      setConsumedOpen(true)
    }
  }, [openSlug, items, current, consumedOpen, kind, hydrateArticleBody])
  const [form, setForm] = useState<Form>(blank(kind))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase()
    return [...items]
      .filter((item) => !term || `${item.title} ${item.slug} ${item.cat || ''} ${item.outlet || ''}`.toLowerCase().includes(term))
      .sort((a, b) => {
        const left = String(a.iso || a._cms.createdAt || '')
        const right = String(b.iso || b._cms.createdAt || '')
        return descending ? right.localeCompare(left) : left.localeCompare(right)
      })
  }, [descending, items, query])

  const openNew = () => {
    setError('')
    setForm(blank(kind))
    setCurrent(null)
  }

  const openEdit = (item: ManagedRecord) => {
    setError('')
    setForm(asForm(kind, item))
    setCurrent(item)
    hydrateArticleBody(item)
  }

  const done = async (message: string) => {
    setNotice(message)
    setTimeout(() => setNotice(''), 4000)
    await onChanged()
  }

  const save = async () => {
    setBusy(true)
    setError('')
    try {
      let preparedForm = { ...form }
      if (kind === 'article') {
        if ((preparedForm.body || '').trim().length < 40) throw new Error('نص المقال يجب أن يكون 40 حرفاً على الأقل.')
        if (preparedForm.status === 'scheduled') {
          const scheduled = Date.parse(preparedForm.scheduledAt || '')
          if (!Number.isFinite(scheduled)) throw new Error('حدد موعد نشر صحيح قبل الجدولة.')
          if (scheduled <= Date.now() - 60 * 1000) throw new Error('موعد الجدولة يجب أن يكون في المستقبل.')
        }
        if (preparedForm._aiReady !== '1' || !preparedForm.cat || !preparedForm.excerpt) {
          setForm((previous) => ({ ...previous, _aiBusy: '1', _aiError: '' }))
          const suggestion = await requestContentSuggestion('article', preparedForm)
          preparedForm = {
            ...preparedForm,
            cat: suggestion.cat,
            excerpt: Array.from(suggestion.excerpt || '').slice(0, 200).join(''),
            _aiReady: '1',
            _aiFallback: suggestion._aiFallback || '',
            _aiBusy: '',
          }
          if (!preparedForm.cat || !preparedForm.excerpt) throw new Error('تعذّر إنشاء التصنيف والمقتطف؛ لم يُنشر المقال.')
          setForm(preparedForm)
        }
      }
      const db = await getDb()
      if (!db) throw new Error('Firebase غير متاح')
      const { deleteDoc, doc, serverTimestamp, setDoc } = await import('firebase/firestore')
      const data = cleanData(kind, preparedForm)
      const slug = data.slug
      if (!slug) throw new Error('الرابط المختصر مطلوب')

      const collision = items.find((item) => item.slug === slug && item !== current)
      if (!current && collision) throw new Error('هذا الرابط المختصر مستخدم؛ غيّره قبل النشر.')

      if (!current) {
        await setDoc(doc(db, collections[kind], slug), { ...data, createdAt: serverTimestamp(), updatedAt: serverTimestamp() })
      } else if (current._cms.origin === 'added') {
        await setDoc(doc(db, collections[kind], current._cms.docId || current.slug), { ...data, updatedAt: serverTimestamp() }, { merge: true })
      } else {
        const base = getBaseRecord(kind, current._cms.baseSlug || current.slug)
        if (!base) throw new Error('تعذّر العثور على نسخة الأصل لهذا العنصر')
        const patch = Object.fromEntries(editableFields[kind]
          .filter((field) => field !== 'slug' && !same(data[field], base[field]))
          .map((field) => [field, data[field] ?? '']))
        const overrideRef = doc(db, 'content_overrides', `${kind}:${current._cms.baseSlug || current.slug}`)
        if (!Object.keys(patch).length && !current._cms.hidden) await deleteDoc(overrideRef)
        else await setDoc(overrideRef, { patch, hidden: Boolean(current._cms.hidden), updatedAt: serverTimestamp() })
      }
      setCurrent(undefined)
      await done(kind === 'article' && data.status === 'scheduled' ? '✓ حُفظ المقال مجدولاً ولن يظهر للزوار قبل موعده.' : '✓ حُفظ التعديل ويظهر للزوار فوراً.')
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'تعذّر الحفظ')
      setForm((previous) => ({ ...previous, _aiBusy: '', _aiError: previous._aiError || '' }))
    } finally {
      setBusy(false)
    }
  }

  const toggleVisibility = async (item: ManagedRecord) => {
    if (item._cms.origin === 'added') {
      if (!window.confirm(`حذف «${item.title}» نهائياً؟`)) return
    }
    setBusy(true)
    try {
      const db = await getDb()
      if (!db) throw new Error('Firebase غير متاح')
      const { deleteDoc, doc, serverTimestamp, setDoc } = await import('firebase/firestore')
      if (item._cms.origin === 'added') {
        await deleteDoc(doc(db, collections[kind], item._cms.docId || item.slug))
        await done('✓ حُذف العنصر المضاف.')
      } else {
        await setDoc(doc(db, 'content_overrides', `${kind}:${item._cms.baseSlug || item.slug}`), {
          hidden: !item._cms.hidden,
          updatedAt: serverTimestamp(),
        }, { merge: true })
        await done(item._cms.hidden ? '✓ أُعيد إظهار العنصر.' : '✓ أُخفي العنصر مع بقاء الأصل محفوظاً.')
      }
    } catch (reason) {
      setNotice(reason instanceof Error ? reason.message : 'تعذّر تنفيذ العملية')
    } finally {
      setBusy(false)
    }
  }

  const resetOriginal = async (item: ManagedRecord) => {
    if (!window.confirm('إلغاء كل تعديلات هذا العنصر واستعادة الأصل؟')) return
    setBusy(true)
    try {
      const db = await getDb()
      if (!db) throw new Error('Firebase غير متاح')
      const { deleteDoc, doc } = await import('firebase/firestore')
      await deleteDoc(doc(db, 'content_overrides', `${kind}:${item._cms.baseSlug || item.slug}`))
      await done('✓ استُعيدت نسخة الأصل.')
    } catch (reason) {
      setNotice(reason instanceof Error ? reason.message : 'تعذّرت استعادة الأصل')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="grid gap-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[.76rem] font-semibold uppercase text-accent">إدارة المحتوى</p>
          <h2 className="mt-1 font-display text-2xl font-bold text-ink">{labels[kind].plural}</h2>
          <p className="mt-1 text-[.82rem] text-soft">{items.length} عنصراً — الأصل والإضافات في قائمة واحدة.</p>
        </div>
        <button type="button" onClick={openNew} className={primary}>+ إضافة {labels[kind].singular}</button>
      </div>

      <div className="grid gap-3 rounded-2xl border border-hair bg-wash p-4 sm:grid-cols-[minmax(0,1fr)_auto]">
        <input className={input} type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={`ابحث في ${labels[kind].plural}…`} aria-label={`بحث في ${labels[kind].plural}`} />
        <button type="button" onClick={() => setDescending((value) => !value)} className={secondary}>{descending ? 'الأحدث أولاً ↓' : 'الأقدم أولاً ↑'}</button>
      </div>

      {notice && <p className="rounded-xl border border-accent/30 bg-wash px-4 py-3 text-[.84rem] text-accent">{notice}</p>}

      <div className="overflow-x-auto rounded-2xl border border-hair bg-canvas">
        <table className="w-full min-w-[760px] border-collapse text-right">
          <thead className="bg-wash text-[.75rem] text-soft">
            <tr>
              <th className="px-5 py-4 font-semibold">العنوان</th>
              <th className="px-4 py-4 font-semibold">التاريخ / النوع</th>
              <th className="px-4 py-4 font-semibold">الحالة</th>
              <th className="px-5 py-4 font-semibold">الإجراءات</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-hair">
            {filtered.map((item) => (
              <tr
                key={`${item._cms.origin}:${item.slug}`}
                tabIndex={0}
                onClick={(event) => {
                  if ((event.target as HTMLElement).closest('button,a,input,select,textarea')) return
                  openEdit(item)
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault()
                    openEdit(item)
                  }
                }}
                className={`cursor-pointer transition-colors hover:bg-wash/70 focus-visible:bg-wash ${item._cms.hidden ? 'opacity-55' : ''}`}
                aria-label={`تعديل ${item.title}`}
              >
                <td className="max-w-md px-5 py-4">
                  <button type="button" onClick={() => openEdit(item)} className="block w-full text-right">
                    <span className="block font-medium leading-relaxed text-ink transition-colors hover:text-accent">{item.title}</span>
                    <span className="mt-1 block truncate text-[.72rem] text-soft" dir="ltr">{item.slug}</span>
                  </button>
                </td>
                <td className="px-4 py-4 text-[.82rem] text-soft">{item.date || item.cat || item.outlet || item.isbn || '—'}</td>
                <td className="px-4 py-4">
                  <div className="flex flex-wrap gap-1.5">
                    <span className="rounded-full border border-hair px-2.5 py-1 text-[.7rem] text-soft">{item._cms.origin === 'base' ? 'أصل' : 'مُضاف'}</span>
                    {item._cms.modified && <span className="rounded-full bg-accent/10 px-2.5 py-1 text-[.7rem] text-accent">مُعدّل</span>}
                    {item._cms.hidden && <span className="rounded-full border border-accent/30 px-2.5 py-1 text-[.7rem] text-accent">مخفي</span>}
                    {kind === 'article' && item.status === 'scheduled' && <span className="rounded-full border border-accent/30 px-2.5 py-1 text-[.7rem] text-accent">مجدول</span>}
                    {kind === 'article' && item.status === 'draft' && <span className="rounded-full border border-hair px-2.5 py-1 text-[.7rem] text-soft">مسودة</span>}
                  </div>
                </td>
                <td className="px-5 py-4">
                  <div className="flex flex-wrap items-center gap-3 text-[.78rem]">
                    <button type="button" onClick={() => openEdit(item)} className="font-semibold text-accent hover:text-accent-deep">تعديل</button>
                    <button type="button" disabled={busy} onClick={() => void toggleVisibility(item)} className="text-soft hover:text-accent">
                      {item._cms.origin === 'added' ? 'حذف' : item._cms.hidden ? 'إظهار' : 'إخفاء'}
                    </button>
                    {item._cms.origin === 'base' && (item._cms.modified || item._cms.hidden) && (
                      <button type="button" disabled={busy} onClick={() => void resetOriginal(item)} className="text-soft hover:text-accent">استعادة الأصل</button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!filtered.length && <p className="px-6 py-14 text-center text-[.9rem] text-soft">لا نتائج مطابقة.</p>}
      </div>

      {current !== undefined && (
        <Editor
          kind={kind}
          current={current}
          form={form}
          busy={busy}
          error={error}
          setForm={setForm}
          onClose={() => setCurrent(undefined)}
          onSave={() => void save()}
          allItems={items}
        />
      )}
    </section>
  )
}
