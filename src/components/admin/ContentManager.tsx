import { useMemo, useState } from 'react'
import { articleCats } from '../../data'
import { getDb, getFirebaseApp } from '../../lib/firebase'

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
  article: ['slug', 'title', 'iso', 'date', 'cat', 'excerpt', 'body', 'source', 'url'],
  book: ['slug', 'title', 'isbn', 'desc', 'cover', 'pdf'],
  paper: ['slug', 'title', 'meta', 'journal', 'source', 'url'],
  media: ['slug', 'title', 'outlet', 'url', 'iso', 'date'],
}

const input = 'w-full rounded-xl border border-hair bg-canvas px-4 py-3 text-[.94rem] text-ink outline-none transition-colors placeholder:text-soft/60 focus:border-accent'
const primary = 'rounded-full bg-accent px-6 py-2.5 text-[.9rem] font-semibold text-white transition-colors hover:bg-accent-deep disabled:cursor-not-allowed disabled:opacity-50'
const secondary = 'rounded-full border border-hair px-5 py-2.5 text-[.86rem] text-soft transition-colors hover:border-accent hover:text-accent disabled:opacity-50'

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
  if (kind === 'article') return { slug: '', title: '', iso, date: dateArabic(iso), cat: 'التعليم', excerpt: '', body: '', source: '', url: '' }
  if (kind === 'book') return { slug: '', title: '', isbn: '', desc: '', cover: '', pdf: '' }
  if (kind === 'paper') return { slug: '', title: '', meta: '', journal: '', source: '', url: '' }
  return { slug: '', title: '', outlet: '', url: '', iso, date: dateArabic(iso) }
}

function asForm(kind: ManagedKind, item: ManagedRecord): Form {
  return Object.fromEntries(editableFields[kind].map((field) => [field, String(item[field] ?? '')]))
}

function cleanData(kind: ManagedKind, form: Form) {
  const data: Record<string, string> = {}
  for (const field of editableFields[kind]) {
    const value = String(form[field] ?? '').trim()
    if (value || ['slug', 'title', 'date', 'iso', 'cat', 'excerpt', 'body', 'desc', 'meta', 'outlet'].includes(field)) data[field] = value
  }
  if ((kind === 'article' || kind === 'media') && data.iso) data.date = dateArabic(data.iso)
  if (kind === 'article' && !data.excerpt) data.excerpt = data.body.replace(/\s+/g, ' ').slice(0, 200)
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

function UploadField({
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
}: {
  kind: ManagedKind
  current: ManagedRecord | null
  form: Form
  busy: boolean
  error: string
  setForm: React.Dispatch<React.SetStateAction<Form>>
  onClose: () => void
  onSave: () => void
}) {
  const set = (field: string, value: string) => setForm((previous) => {
    const next = { ...previous, [field]: value }
    if (!current && field === 'title' && (!previous.slug || previous.slug === slugify(previous.title))) next.slug = slugify(value)
    if ((kind === 'article' || kind === 'media') && field === 'iso') next.date = dateArabic(value)
    return next
  })

  const suggest = async () => {
    if (!form.body?.trim()) return
    setForm((previous) => ({ ...previous, _aiBusy: '1', _aiError: '' }))
    try {
      const app = await getFirebaseApp()
      if (!app) throw new Error('Firebase غير متاح')
      const { getAuth } = await import('firebase/auth')
      const token = await getAuth(app).currentUser?.getIdToken()
      if (!token) throw new Error('انتهت جلسة الدخول')
      const response = await fetch('/api/ai/article-suggestion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ title: form.title, text: form.body }),
      })
      const payload = await response.json() as { cat?: string; excerpt?: string; error?: string }
      if (!response.ok) throw new Error(payload.error || 'تعذّر الاقتراح')
      setForm((previous) => ({ ...previous, cat: payload.cat || previous.cat, excerpt: payload.excerpt || previous.excerpt, _aiBusy: '', _aiError: '' }))
    } catch (reason) {
      setForm((previous) => ({ ...previous, _aiBusy: '', _aiError: reason instanceof Error ? reason.message : 'تعذّر الاقتراح' }))
    }
  }

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
          <Field label="العنوان"><input className={input} value={form.title || ''} onChange={(event) => set('title', event.target.value)} /></Field>
          <Field label="الرابط المختصر (slug)" hint={current ? 'يثبت بعد النشر حتى لا تنكسر الروابط والصوت والإحصاءات.' : 'تولّد تلقائياً، ويمكنك مراجعته قبل النشر.'}>
            <input className={input} dir="ltr" value={form.slug || ''} disabled={Boolean(current)} onChange={(event) => set('slug', slugify(event.target.value))} />
          </Field>

          {kind === 'article' && (
            <>
              <div className="grid gap-5 sm:grid-cols-2">
                <Field label="التاريخ"><input className={input} dir="ltr" type="date" value={form.iso || ''} onChange={(event) => set('iso', event.target.value)} /></Field>
                <Field label="التاريخ العربي (تلقائي)"><input className={input} value={form.date || ''} readOnly /></Field>
              </div>
              <Field label="التصنيف">
                <select className={input} value={form.cat || 'التعليم'} onChange={(event) => set('cat', event.target.value)}>
                  {articleCats.filter((category) => category !== 'الكل').map((category) => <option key={category}>{category}</option>)}
                </select>
              </Field>
              <Field label="نص المقال" hint="افصل بين الفقرات بسطر فارغ."><textarea className={`${input} min-h-[320px] leading-loose`} value={form.body || ''} onChange={(event) => set('body', event.target.value)} /></Field>
              <div className="flex flex-wrap items-center gap-3">
                <button type="button" onClick={() => void suggest()} disabled={form._aiBusy === '1' || !form.body?.trim()} className={secondary}>
                  {form._aiBusy === '1' ? 'أفكّر…' : '✦ اقترح التصنيف والمقتطف'}
                </button>
                {form._aiError && <span className="text-[.78rem] text-soft">{form._aiError}</span>}
              </div>
              <Field label="المقتطف" hint={`${(form.excerpt || '').length}/200 حرف`}><textarea className={`${input} min-h-24`} maxLength={200} value={form.excerpt || ''} onChange={(event) => set('excerpt', event.target.value)} /></Field>
              <Field label="رابط المصدر (اختياري)"><input className={input} dir="ltr" type="url" value={form.source || ''} onChange={(event) => set('source', event.target.value)} /></Field>
            </>
          )}

          {kind === 'book' && (
            <>
              <Field label="ISBN / ردمك"><input className={input} dir="ltr" value={form.isbn || ''} onChange={(event) => set('isbn', event.target.value)} /></Field>
              <Field label="الوصف"><textarea className={`${input} min-h-28 leading-loose`} value={form.desc || ''} onChange={(event) => set('desc', event.target.value)} /></Field>
              <UploadField label="الغلاف" value={form.cover || ''} accept="image/jpeg,image/png,image/webp" folder="covers" slug={form.slug || form.title} maxMb={12} onChange={(value) => set('cover', value)} />
              <UploadField label="ملف PDF" value={form.pdf || ''} accept="application/pdf" folder="files" slug={form.slug || form.title} maxMb={100} onChange={(value) => set('pdf', value)} />
            </>
          )}

          {kind === 'paper' && (
            <>
              <Field label="الوصف / الميتا"><textarea className={`${input} min-h-24`} value={form.meta || ''} onChange={(event) => set('meta', event.target.value)} /></Field>
              <Field label="بيانات المجلة (اختياري)"><input className={input} value={form.journal || ''} onChange={(event) => set('journal', event.target.value)} /></Field>
              <UploadField label="رابط البحث أو PDF" value={form.source || form.url || ''} accept="application/pdf" folder="files" slug={form.slug || form.title} maxMb={100} onChange={(value) => { set('source', value); set('url', value) }} />
            </>
          )}

          {kind === 'media' && (
            <>
              <Field label="المنصّة / القناة"><input className={input} value={form.outlet || ''} onChange={(event) => set('outlet', event.target.value)} /></Field>
              <Field label="رابط الفيديو"><input className={input} dir="ltr" type="url" value={form.url || ''} onChange={(event) => set('url', event.target.value)} /></Field>
              <div className="grid gap-5 sm:grid-cols-2">
                <Field label="التاريخ"><input className={input} dir="ltr" type="date" value={form.iso || ''} onChange={(event) => set('iso', event.target.value)} /></Field>
                <Field label="التاريخ العربي (تلقائي)"><input className={input} value={form.date || ''} readOnly /></Field>
              </div>
            </>
          )}

          {error && <p className="rounded-xl border border-accent/30 bg-wash px-4 py-3 text-[.86rem] text-soft">{error}</p>}
          <div className="flex flex-wrap items-center gap-3 border-t border-hair pt-5">
            <button type="button" onClick={onSave} disabled={busy || !form.title?.trim() || !form.slug?.trim()} className={primary}>{busy ? 'جارٍ الحفظ…' : 'حفظ ونشر'}</button>
            <button type="button" onClick={onClose} disabled={busy} className={secondary}>إلغاء</button>
          </div>
        </div>
      </div>
    </div>
  )
}

export function ContentManager({ kind, items, getBaseRecord, onChanged }: Props) {
  const [query, setQuery] = useState('')
  const [descending, setDescending] = useState(true)
  const [current, setCurrent] = useState<ManagedRecord | null | undefined>(undefined)
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
      const db = await getDb()
      if (!db) throw new Error('Firebase غير متاح')
      const { deleteDoc, doc, serverTimestamp, setDoc } = await import('firebase/firestore')
      const data = cleanData(kind, form)
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
      await done('✓ حُفظ التعديل ويظهر للزوار فوراً.')
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'تعذّر الحفظ')
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
              <tr key={`${item._cms.origin}:${item.slug}`} className={item._cms.hidden ? 'opacity-55' : ''}>
                <td className="max-w-md px-5 py-4">
                  <span className="block font-medium leading-relaxed text-ink">{item.title}</span>
                  <span className="mt-1 block truncate text-[.72rem] text-soft" dir="ltr">{item.slug}</span>
                </td>
                <td className="px-4 py-4 text-[.82rem] text-soft">{item.date || item.cat || item.outlet || item.isbn || '—'}</td>
                <td className="px-4 py-4">
                  <div className="flex flex-wrap gap-1.5">
                    <span className="rounded-full border border-hair px-2.5 py-1 text-[.7rem] text-soft">{item._cms.origin === 'base' ? 'أصل' : 'مُضاف'}</span>
                    {item._cms.modified && <span className="rounded-full bg-accent/10 px-2.5 py-1 text-[.7rem] text-accent">مُعدّل</span>}
                    {item._cms.hidden && <span className="rounded-full border border-accent/30 px-2.5 py-1 text-[.7rem] text-accent">مخفي</span>}
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
        />
      )}
    </section>
  )
}
