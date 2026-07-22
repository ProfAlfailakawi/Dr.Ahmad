import { useCallback, useEffect, useMemo, useState } from 'react'
import { getDb, getFirebaseApp } from '../../lib/firebase'
import { useCmsContent } from '../../lib/content'
import { publicationGate, topicMemory } from '../../lib/intelligence'
import { describe as describeEcho, findEchoes, indexPast } from '../../lib/echoes'
import { getArticleBody } from '../../lib/article-bodies'
import { beginAdminTask, setAdminTaskState } from '../../lib/admin-task-state'
import { normalizeArabicTypography } from '../../lib/arabic-typography'
import { analyzeResearch } from '../../lib/research-intelligence'
import { Pagination, usePagedList } from '../Pagination'

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
  bodyVocalized?: string
  source?: string
  url?: string
  status?: string
  scheduledAt?: string
  audio?: { fahed?: boolean | string; noura?: boolean | string; dialogue?: boolean | string }
  audioControl?: { readingDisabled?: boolean; fahedDisabled?: boolean; nouraDisabled?: boolean; dialogueDisabled?: boolean; readingStatus?: string; fahedStatus?: string; nouraStatus?: string; dialogueStatus?: string; readingMessage?: string; fahedMessage?: string; nouraMessage?: string; dialogueMessage?: string }
  hasAudio?: boolean
  isbn?: string
  desc?: string
  cover?: string
  pdf?: string
  meta?: string
  abstractAr?: string
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
  article: ['slug', 'title', 'iso', 'date', 'cat', 'excerpt', 'body', 'bodyVocalized', 'source', 'url', 'status', 'scheduledAt'],
  book: ['slug', 'title', 'isbn', 'desc', 'cover', 'pdf', 'coAuthors'],
  paper: ['slug', 'title', 'titleAr', 'meta', 'abstractAr', 'journal', 'source', 'url', 'pdf', 'scholar', 'researchgate', 'orcid', 'repository', 'coAuthors', 'doi', 'reviewStatus', 'studyType', 'methodology', 'sample', 'researchQuestion', 'keyFinding', 'contribution', 'applications', 'limitations', 'year', 'metadataText', 'pdfText', 'analysisText', 'analysisFingerprint', 'analysisSources', 'evidenceLabel', 'evidenceScore', 'keywords', 'openAccess', 'analysisConfidence', 'analysisNeedsReview', 'analyzedAt'],
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


async function requestResearchAnalysis(form: Form): Promise<Form> {
  const app = await getFirebaseApp()
  if (!app) throw new Error('Firebase غير متاح')
  const { getAuth } = await import('firebase/auth')
  const token = await getAuth(app).currentUser?.getIdToken()
  if (!token) throw new Error('انتهت جلسة الدخول')
  const response = await fetch('/api/ai/paper-analysis', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ ...Object.fromEntries(Object.entries(form).filter(([key]) => !key.startsWith('_'))), analysisFingerprint: analyzeResearch(form).analysisFingerprint }),
  })
  const payload = await response.json() as Form & { error?: string; cached?: boolean }
  if (!response.ok) throw new Error(payload.error || 'تعذّر تحليل البحث')
  return payload
}

function mergeResearchAnalysis(previous: Form, result: Form, fingerprint: string): Form {
  const autoFields = ['studyType', 'methodology', 'sample', 'researchQuestion', 'keyFinding', 'contribution', 'applications', 'limitations', 'doi', 'keywords', 'journal', 'year', 'orcid', 'repository']
  const next = { ...previous }
  for (const field of autoFields) {
    if (!next[field]?.trim() && result[field]?.trim()) next[field] = result[field]
  }
  next.reviewStatus = 'محكّم'
  next.openAccess = String(result.openAccess ?? previous.openAccess ?? 'false')
  next.analysisConfidence = String(result.analysisConfidence ?? result.confidence ?? previous.analysisConfidence ?? '')
  next.analysisNeedsReview = 'false'
  next.analysisSources = String(result.analysisSources ?? previous.analysisSources ?? '')
  next.analysisFingerprint = String(result.analysisFingerprint ?? fingerprint)
  next.analyzedAt = String(result.analyzedAt ?? new Date().toISOString())
  return next
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
  return new Intl.DateTimeFormat('ar-KW-u-nu-latn', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Kuwait' }).format(date)
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
  if (kind === 'article') return { slug: '', title: '', iso, date: dateArabic(iso), cat: '', excerpt: '', body: '', bodyVocalized: '', source: '', url: '', status: 'published', scheduledAt: '', _aiReady: '' }
  if (kind === 'book') return { slug: '', title: '', isbn: '', desc: '', cover: '', pdf: '', coAuthors: '' }
  if (kind === 'paper') return { slug: '', title: '', titleAr: '', meta: '', abstractAr: '', journal: '', source: '', url: '', pdf: '', scholar: '', researchgate: '', orcid: '', repository: '', coAuthors: '', doi: '', reviewStatus: '', studyType: '', methodology: '', sample: '', researchQuestion: '', keyFinding: '', contribution: '', applications: '', limitations: '', year: '', metadataText: '', pdfText: '', analysisText: '', analysisFingerprint: '', analysisSources: '', evidenceLabel: '', evidenceScore: '', keywords: '', openAccess: '', analysisConfidence: '', analysisNeedsReview: '', analyzedAt: '' }
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
    if (value || ['slug', 'title', 'date', 'iso', 'cat', 'excerpt', 'body', 'bodyVocalized', 'desc', 'meta', 'abstractAr', 'outlet'].includes(field)) data[field] = value
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

async function hasPdfSignature(file: File) {
  const head = new Uint8Array(await file.slice(0, 5).arrayBuffer())
  return head.length === 5
    && head[0] === 0x25
    && head[1] === 0x50
    && head[2] === 0x44
    && head[3] === 0x46
    && head[4] === 0x2d
}

async function uploadCvPdfToFirestore(file: File, kind: 'ar' | 'en', onProgress: (value: number) => void) {
  const db = await getDb()
  if (!db) throw new Error('Firestore غير متاح لحفظ السيرة.')
  const firestore = await import('firebase/firestore')
  const chunkSize = 650 * 1024
  const bytes = new Uint8Array(await file.arrayBuffer())
  const chunkCount = Math.ceil(bytes.length / chunkSize)
  if (!chunkCount || chunkCount > 100) throw new Error('حجم ملف السيرة أكبر من الحد الآمن.')
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  const sha256 = Array.from(new Uint8Array(digest)).map((value) => value.toString(16).padStart(2, '0')).join('')
  const version = `${Date.now().toString(36)}-${sha256.slice(0, 12)}`
  const fileRef = firestore.doc(db, 'site_cv_files', kind)
  const previousSnapshot = await firestore.getDoc(fileRef)
  const previous = previousSnapshot.exists() ? previousSnapshot.data() as { version?: string; chunkCount?: number } : {}
  const chunks = firestore.collection(fileRef, 'chunks')
  const writtenIds: string[] = []
  try {
    // Firestore يضع حداً لحجم طلب commit؛ لذلك نكتب أجزاء PDF في دفعات صغيرة
    // ثم ننشر metadata أخيراً. لا يرى الزائر نسخة ناقصة في أي لحظة.
    for (let offset = 0; offset < chunkCount; offset += 8) {
      const batch = firestore.writeBatch(db)
      const end = Math.min(chunkCount, offset + 8)
      for (let index = offset; index < end; index++) {
        const start = index * chunkSize
        const chunk = bytes.slice(start, Math.min(bytes.length, start + chunkSize))
        const chunkDocumentId = `${version}-${String(index).padStart(4, '0')}`
        writtenIds.push(chunkDocumentId)
        batch.set(firestore.doc(chunks, chunkDocumentId), {
          version,
          index,
          size: chunk.length,
          data: firestore.Bytes.fromUint8Array(chunk),
        })
      }
      await batch.commit()
      onProgress(Math.max(1, Math.min(92, Math.round((end / chunkCount) * 90))))
    }

    await firestore.setDoc(fileRef, {
      kind,
      version,
      size: bytes.length,
      chunkSize,
      chunkCount,
      sha256,
      contentType: 'application/pdf',
      fileName: kind === 'ar' ? 'cv.pdf' : 'cv-en.pdf',
      originalName: file.name.slice(0, 180),
      updatedAt: firestore.serverTimestamp(),
    }, { merge: true })
  } catch (reason) {
    for (let offset = 0; offset < writtenIds.length; offset += 100) {
      const cleanup = firestore.writeBatch(db)
      for (const id of writtenIds.slice(offset, offset + 100)) cleanup.delete(firestore.doc(chunks, id))
      await cleanup.commit().catch(() => undefined)
    }
    throw reason
  }
  onProgress(96)

  const oldVersion = typeof previous.version === 'string' ? previous.version : ''
  const oldChunkCount = Number(previous.chunkCount || 0)
  if (oldVersion && oldVersion !== version && Number.isInteger(oldChunkCount) && oldChunkCount > 0 && oldChunkCount <= 100) {
    for (let offset = 0; offset < oldChunkCount; offset += 100) {
      const cleanup = firestore.writeBatch(db)
      for (let index = offset; index < Math.min(oldChunkCount, offset + 100); index++) {
        cleanup.delete(firestore.doc(chunks, `${oldVersion}-${String(index).padStart(4, '0')}`))
      }
      await cleanup.commit().catch(() => undefined)
    }
  }
  onProgress(100)
  return `/cv-file/${kind}?v=${encodeURIComponent(version)}`
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
  helper,
  onChange,
}: {
  label: string
  value: string
  accept: string
  folder: 'covers' | 'files'
  slug: string
  maxMb: number
  helper?: string
  onChange: (value: string) => void
}) {
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState('')

  const readableUploadError = (reason: unknown) => {
    const value = reason as { code?: string; message?: string; customData?: { serverResponse?: string } }
    const code = String(value?.code || '')
    if (code === 'permission-denied' || code === 'firestore/permission-denied') return 'قواعد Firestore الجديدة لملفات السيرة لم تُنشر بعد. شغّل نشر الموقع مرة واحدة ثم أعد الرفع؛ اسم الملف لا علاقة له بالمشكلة.'
    if (code === 'resource-exhausted' || code === 'firestore/resource-exhausted') return 'توقّف الرفع بسبب حصة Firestore الحالية. انتظر قليلاً ثم أعد المحاولة.'
    if (code === 'storage/unauthorized') return 'الحساب مسجّل، لكن قواعد Storage لم تُطبّق بعد. الحزمة تنشرها تلقائياً مع GitHub؛ راجع نجاح خطوة «Deploy Firestore and Storage rules».'
    if (code === 'storage/bucket-not-found') return 'حاوية Firebase Storage غير مفعّلة لهذا المشروع أو اسمها غير صحيح.'
    if (code === 'storage/quota-exceeded') return 'توقّف Firebase Storage بسبب الخطة أو الحصة. افتح Storage في مشروع drahmad-8e9e2 وتحقق من تفعيل الحاوية.'
    if (code === 'storage/retry-limit-exceeded') return 'انقطع الاتصال أثناء الرفع. أعد المحاولة بعد ثوانٍ؛ لن يُحفظ رابط ناقص.'
    if (code === 'storage/invalid-checksum') return 'وصل الملف ناقصاً إلى الخادم؛ أعد اختياره وسيُرفع من البداية.'
    if (code === 'storage/canceled') return 'أُلغي الرفع قبل اكتماله.'
    if (code === 'storage/unknown') {
      const response = String(value?.customData?.serverResponse || '')
      return response.includes('billing') || response.includes('Blaze')
        ? 'Firebase Storage رفض الرفع لأن الحاوية أو خطة المشروع غير مفعّلة. افتح Storage في drahmad-8e9e2 مرة واحدة ثم أعد المحاولة.'
        : 'Firebase Storage رفض الطلب من الخادم. اسم الملف لا علاقة له بالمشكلة؛ تحقق من نجاح نشر قواعد Storage ومن تفعيل الحاوية في مشروع drahmad-8e9e2.'
    }
    return value?.message || 'تعذّر رفع الملف.'
  }

  const upload = async (file?: File) => {
    if (!file) return
    setError('')
    setProgress(0)
    if (file.size > maxMb * 1024 * 1024) {
      setError(`الحد الأقصى ${maxMb}MB.`)
      setAdminTaskState('needs-input', `الملف أكبر من ${maxMb}MB`)
      return
    }
    const task = beginAdminTask('رفع الملف')
    setBusy(true)
    try {
      const app = await getFirebaseApp()
      if (!app) throw new Error('Firebase غير متاح')
      const { getAuth, getIdTokenResult } = await import('firebase/auth')
      const user = getAuth(app).currentUser
      if (!user) throw new Error('انتهت جلسة المشرف. سجّل الدخول من جديد ثم ارفع الملف.')
      // يجدد claim المشرف ويتحقق منه صراحةً قبل بدء أي بايت من الرفع.
      const token = await getIdTokenResult(user, true)
      if (token.claims.admin !== true) throw new Error('الحساب الحالي لا يحمل صلاحية admin. سجّل الخروج ثم ادخل من جديد.')

      const safe = slugify(slug || file.name.replace(/\.[^.]+$/, ''))
      const expectsPdf = accept.split(',').some((type) => type.trim().toLowerCase() === 'application/pdf')
      if (expectsPdf && !(await hasPdfSignature(file))) {
        throw new Error('الملف المختار ليس PDF حقيقياً. اسم الملف لا يهم، لكن محتواه يجب أن يبدأ بتوقيع PDF الصحيح.')
      }
      // اسم المستخدم لا يدخل في مسار السيرة إطلاقاً: أي اسم عربي/إنجليزي يتحول إلى cv.pdf أو cv-en.pdf.
      const sourceExtension = file.name.split('.').pop()?.toLowerCase().replace(/[^a-z0-9]/g, '')
      const extension = expectsPdf ? 'pdf' : sourceExtension || (folder === 'covers' ? 'webp' : 'bin')
      const contentType = expectsPdf
        ? 'application/pdf'
        : file.type || (extension === 'webp' ? 'image/webp' : extension === 'png' ? 'image/png' : 'image/jpeg')
      const stableCvFile = folder === 'files' && (safe === 'cv' || safe === 'cv-en')

      // السيرة لها مسار مستقل لا يعتمد على Firebase Storage إطلاقاً؛ تُجزّأ داخل
      // Firestore وتُعرض من رابط ثابت. بذلك لا تعود الحاوية أو خططتها سبباً لفشل الرفع.
      if (stableCvFile) {
        const url = await uploadCvPdfToFirestore(file, safe === 'cv' ? 'ar' : 'en', setProgress)
        onChange(url)
        setProgress(100)
        task.complete('تم رفع السيرة وتحديث رابطها')
        return
      }

      const storageModule = await import('firebase/storage')
      const bucket = String(app.options.storageBucket || '').replace(/^gs:\/\//, '').replace(/\/$/, '')
      if (!bucket) throw new Error('اسم Firebase Storage غير موجود في إعدادات الموقع.')
      // هذه هي الحاوية الافتراضية لتطبيق البيانات؛ لا نمرر عنواناً ثانياً قد يكوّن instance مختلفاً في PWA.
      const storage = storageModule.getStorage(app)
      storage.maxUploadRetryTime = 120_000
      const fileName = `${safe}-${Date.now()}.${extension}`
      const target = storageModule.ref(storage, `site-content/${folder}/${fileName}`)
      const uploadTask = storageModule.uploadBytesResumable(target, file, {
        contentType,
        cacheControl: 'public,max-age=31536000,immutable',
        customMetadata: { uploadedBy: user.uid, source: 'admin-panel' },
      })

      await new Promise<void>((resolve, reject) => {
        uploadTask.on('state_changed', (snapshot) => {
          setProgress(Math.max(1, Math.round((snapshot.bytesTransferred / Math.max(1, snapshot.totalBytes)) * 100)))
        }, reject, resolve)
      })
      const url = await storageModule.getDownloadURL(target)
      onChange(url)
      setProgress(100)
      task.complete('تم رفع الملف')
    } catch (reason) {
      const message = readableUploadError(reason)
      setError(message)
      task.fail(reason, message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Field label={label} hint={error || (busy ? `اكتمل ${progress}%` : value ? 'تم حفظ رابط الملف؛ يمكنك رفع بديل.' : helper)}>
      <div className="grid min-w-0 gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
        <input className={input} dir="ltr" value={value} onChange={(event) => onChange(event.target.value)} placeholder="https://… أو ارفع ملفاً" />
        <label className={`${secondary} min-w-0 cursor-pointer text-center`}>
          {busy ? `جارٍ الرفع ${progress}%` : 'رفع ملف'}
          <input className="sr-only" type="file" accept={accept} disabled={busy} onChange={(event) => { void upload(event.target.files?.[0]); event.currentTarget.value = '' }} />
        </label>
      </div>
      {busy && <span className="h-1.5 overflow-hidden rounded-full bg-hair" aria-label={`تقدم الرفع ${progress}%`}><span className="block h-full bg-accent transition-[width] duration-200" style={{ width: `${progress}%` }} /></span>}
    </Field>
  )
}

const stripArabicDiacritics = (value = '') => value
  .normalize('NFC')
  .replace(/[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED\u0640]/g, '')
  .replace(/\s+/g, ' ')
  .trim()

const vocalizedBodyMatches = (body = '', vocalized = '') =>
  Boolean(body.trim() && vocalized.trim())
  && stripArabicDiacritics(body) === stripArabicDiacritics(vocalized)

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
  const { books, papers } = useCmsContent()
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

  /* فهرس جُمل الأرشيف يُبنى مرّة لكل تبدّلٍ في المكتبة، لا مع كل حرفٍ يكتبه
     الدكتور — ألفٌ وخمسمئة جملةٍ تُقطَّع مع كل ضغطة مفتاح تُجمّد اللوحة. */
  const echoIndex = useMemo(
    () => indexPast(allItems
      .filter((item) => item.slug !== current?.slug && item.body)
      .map((item) => ({ slug: item.slug, title: item.title, iso: item.iso, body: item.body }))),
    [allItems, current?.slug],
  )

  const echoes = useMemo(
    () => (kind === 'article' && (form.body || '').trim().length > 120 ? findEchoes(form.body || '', echoIndex) : []),
    [echoIndex, form.body, kind],
  )

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

  const researchAnalysis = useMemo(() => kind === 'paper' ? analyzeResearch(form) : null, [form, kind])
  const applyResearchAnalysis = async () => {
    if (!researchAnalysis || form._researchBusy === '1') return
    const fingerprint = researchAnalysis.analysisFingerprint
    if (form.analysisFingerprint === fingerprint && form.analyzedAt) {
      setForm((previous) => ({ ...previous, reviewStatus: 'محكّم', _researchMessage: 'التحليل محفوظ ومحدّث.' }))
      return
    }
    setForm((previous) => ({ ...previous, _researchBusy: '1', _researchMessage: '' }))
    try {
      const remote = await requestResearchAnalysis(form)
      setForm((previous) => ({ ...mergeResearchAnalysis(previous, remote, fingerprint), _researchBusy: '', _researchMessage: 'اكتمل التحليل الشامل وحُفظت بصمته.' }))
    } catch {
      const local = Object.fromEntries(Object.entries(researchAnalysis).map(([key, value]) => [key, String(value ?? '')])) as Form
      setForm((previous) => ({ ...mergeResearchAnalysis(previous, local, fingerprint), _researchBusy: '', _researchMessage: 'اكتمل استخراج البيانات المتاحة وحُفظت بصمته.' }))
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
                    className={`rounded-full border px-4 py-2 text-[.82rem] transition-colors ${form.status === 'published' ? 'border-accent bg-accent text-white' : 'border-hair text-soft hover:border-accent hover:text-accent'}`}
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
                  <button
                    type="button"
                    onClick={() => setForm((previous) => ({ ...previous, status: 'draft', scheduledAt: '' }))}
                    className={`rounded-full border px-4 py-2 text-[.82rem] transition-colors ${form.status === 'draft' ? 'border-accent bg-accent text-white' : 'border-hair text-soft hover:border-accent hover:text-accent'}`}
                  >
                    حفظ كمسودة
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
              <div className="border-t border-hair pt-5">
                <Field
                  label="النص المُشكَّل لتوليد الصوت (اختياري)"
                  hint="ألصق هنا المقال نفسه كاملاً بعد التشكيل. لا يظهر هذا النص للزوار؛ يستخدمه محرك فهد ونورة للنطق فقط. يجب أن يطابق نص المقال حرفياً بعد إزالة الحركات، وإلا يتجاهله المحرك بأمان."
                >
                  <textarea
                    dir="rtl"
                    spellCheck={false}
                    style={{ textAlign: 'justify' }}
                    className={`${input} min-h-[240px] text-justify leading-loose`}
                    value={form.bodyVocalized || ''}
                    onChange={(event) => set('bodyVocalized', event.target.value)}
                    placeholder="ألصق النسخة المُشكَّلة الكاملة هنا…"
                  />
                </Field>
                {form.bodyVocalized?.trim() && (
                  <p className={`mt-2 text-[.76rem] leading-relaxed ${vocalizedBodyMatches(form.body || '', form.bodyVocalized) ? 'text-accent' : 'text-soft'}`}>
                    {vocalizedBodyMatches(form.body || '', form.bodyVocalized)
                      ? '✓ النص المُشكَّل مطابق وجاهز لمسار توليد الصوت.'
                      : 'تنبيه: النسخة المُشكَّلة لا تطابق نص المقال بعد تجريد الحركات؛ سيحفظها الموقع، لكن محرك الصوت سيتجاهلها حتى تُصحَّح.'}
                  </p>
                )}
              </div>
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

                  {/* أصداء الأرشيف: العناوين المشابهة أعلاه لا تُقلق كاتباً كتب
                      مئةً وستين مقالاً — الجملة المكرّرة هي التي تُقلق. هنا نضع
                      نصّه القديم بحرفه إلى جانب الجديد، ولا نحكم عليه بشيء. */}
                  {echoes.length > 0 && (
                    <div className="mt-3 rounded-xl border border-accent/30 bg-canvas p-3">
                      <p className="text-[.75rem] font-semibold text-accent">
                        ماذا لو نشرتَه اليوم؟ — {echoes.length === 1 ? 'جملةٌ لها صدى' : `${echoes.length} جُمَل لها صدى`} في أرشيفك
                      </p>
                      <ul className="mt-2 grid gap-3">
                        {echoes.map((echo) => (
                          <li key={`${echo.slug}:${echo.past.slice(0, 24)}`} className="border-r-2 border-accent/40 pr-3">
                            <p className="text-[.7rem] text-soft">
                              {describeEcho(echo.overlap)} · {echo.year} · «{echo.title}»
                            </p>
                            <p className="mt-1 text-[.78rem] leading-relaxed text-ink">اليوم: {echo.draft}</p>
                            <p className="mt-1 text-[.78rem] leading-relaxed text-soft">سابقاً: {echo.past}</p>
                          </li>
                        ))}
                      </ul>
                      <p className="mt-3 text-[.7rem] text-soft">الحكم لك: قد يكون التكرار قصداً — وقد يكون سهواً.</p>
                    </div>
                  )}
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
              <Field label="الترجمة العربية للعنوان (للأبحاث الإنجليزية)" hint="تظهر بخط رفيع تحت العنوان الإنجليزي في قائمة الأبحاث وصفحة البحث. اتركها فارغة للأبحاث العربية.">
                <input dir="rtl" className={input} value={form.titleAr || ''} onChange={(event) => set('titleAr', event.target.value)} />
              </Field>
              <Field label="الوصف / الميتا"><textarea className={`${input} min-h-24`} value={form.meta || ''} onChange={(event) => set('meta', event.target.value)} /></Field>
              <Field label="الملخص" hint="اكتب الملخص كما تريد ظهوره في صفحة البحث. إذا كان البحث إنجليزيًا يمكن وضع ترجمة أكاديمية عربية هنا.">
                <textarea className={`${input} min-h-32 leading-loose`} value={form.abstractAr || ''} onChange={(event) => set('abstractAr', event.target.value)} />
              </Field>
              <div className="flex flex-wrap items-center gap-3">
                <button type="button" onClick={() => void suggest()} disabled={form._aiBusy === '1' || (!form.title?.trim() && !form.url?.trim() && !form.source?.trim())} className={secondary}>{form._aiBusy === '1' ? 'أفكّر…' : '✦ اقترح وصف الميتا'}</button>
                <span className="text-[.75rem] text-soft">الاقتراح قابل للتعديل والمراجعة قبل الحفظ.</span>
                {form._aiError && <span className="text-[.78rem] text-soft">{form._aiError}</span>}
              </div>
              <div className="grid gap-5 sm:grid-cols-2">
                <Field label="بيانات المجلة"><input className={input} value={form.journal || ''} onChange={(event) => set('journal', event.target.value)} /></Field>
                <Field label="سنة النشر"><input className={input} dir="ltr" inputMode="numeric" value={form.year || ''} onChange={(event) => set('year', event.target.value)} /></Field>
              </div>
              <section className="rounded-3xl border border-accent/30 bg-wash/70 p-5 md:p-6">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="text-[.78rem] font-semibold text-accent">التحليل العلمي الشامل</p>
                    <h3 className="mt-1 text-lg font-bold text-ink">يقرأ الملخص وPDF والروابط وDOI والبيانات الوصفية</h3>
                    <p className="mt-2 max-w-2xl text-[.8rem] leading-relaxed text-soft">يستخرج البيانات العلمية المتاحة، ويخفي الحقول الفارغة في صفحة البحث. تُحفظ بصمة التحليل، فلا يُعاد إلا عند تغيّر الملف أو البيانات.</p>
                  </div>
                  <button type="button" onClick={() => void applyResearchAnalysis()} disabled={form._researchBusy === '1'} className={secondary}>{form._researchBusy === '1' ? 'أحلّل جميع المصادر…' : 'تحليل شامل الآن'}</button>
                </div>
                {form._researchMessage && <p className="mt-3 text-[.78rem] font-semibold text-accent">{form._researchMessage}</p>}
                {researchAnalysis && (
                  <div className="mt-5 grid gap-3 sm:grid-cols-3">
                    <div className="rounded-2xl border border-hair bg-canvas p-4"><span className="text-[.72rem] text-soft">حالة التحكيم</span><strong className="mt-1 block text-[.9rem] text-ink">محكّم</strong></div>
                    <div className="rounded-2xl border border-hair bg-canvas p-4"><span className="text-[.72rem] text-soft">نوع الدراسة</span><strong className="mt-1 block text-[.9rem] text-ink">{researchAnalysis.studyType}</strong></div>
                    <div className="rounded-2xl border border-hair bg-canvas p-4"><span className="text-[.72rem] text-soft">حالة التحليل</span><strong className="mt-1 block text-[.9rem] text-ink">{form.analysisFingerprint === researchAnalysis.analysisFingerprint && form.analyzedAt ? 'محفوظ ومحدّث' : 'جاهز للتحليل'}</strong></div>
                  </div>
                )}
                <div className="mt-5 grid gap-4 sm:grid-cols-2">
                  <Field label="حالة التحكيم"><input className={input} value="محكّم" readOnly /></Field>
                  <Field label="نوع الدراسة"><input className={input} value={form.studyType || ''} onChange={(event) => set('studyType', event.target.value)} /></Field>
                  <Field label="المنهج"><textarea className={`${input} min-h-24`} value={form.methodology || ''} onChange={(event) => set('methodology', event.target.value)} /></Field>
                  <Field label="العينة"><textarea className={`${input} min-h-24`} value={form.sample || ''} onChange={(event) => set('sample', event.target.value)} /></Field>
                </div>
                <div className="mt-4 grid gap-4">
                  <Field label="السؤال العلمي"><textarea className={`${input} min-h-24`} value={form.researchQuestion || ''} onChange={(event) => set('researchQuestion', event.target.value)} /></Field>
                  <Field label="أبرز النتائج"><textarea className={`${input} min-h-24`} value={form.keyFinding || ''} onChange={(event) => set('keyFinding', event.target.value)} /></Field>
                  <Field label="الإضافة العلمية"><textarea className={`${input} min-h-24`} value={form.contribution || ''} onChange={(event) => set('contribution', event.target.value)} /></Field>
                  <Field label="التطبيقات"><textarea className={`${input} min-h-24`} value={form.applications || ''} onChange={(event) => set('applications', event.target.value)} /></Field>
                  <Field label="القيود"><textarea className={`${input} min-h-24`} value={form.limitations || ''} onChange={(event) => set('limitations', event.target.value)} /></Field>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="DOI"><input className={input} dir="ltr" value={form.doi || ''} onChange={(event) => set('doi', event.target.value)} /></Field>
                    <Field label="الكلمات المفتاحية"><input className={input} value={form.keywords || ''} onChange={(event) => set('keywords', event.target.value)} /></Field>
                  </div>
                  <Field label="Metadata إضافية" hint="أي بيانات وصفية مرفقة بالبحث يمكن لصقها هنا، ويضمها التحليل تلقائياً."><textarea className={`${input} min-h-24`} value={form.metadataText || ''} onChange={(event) => set('metadataText', event.target.value)} /></Field>
                </div>
              </section>
              <Field label="رابط صفحة البحث أو المجلة"><input className={input} dir="ltr" type="url" value={form.source || form.url || ''} onChange={(event) => { set('source', event.target.value); set('url', event.target.value) }} /></Field>
              <UploadField label="ملف PDF أو رابطه" value={form.pdf || ''} accept="application/pdf" folder="files" slug={form.slug || form.title} maxMb={100} onChange={(value) => set('pdf', value)} />
              <div className="grid gap-5 sm:grid-cols-2">
                <Field label="Google Scholar"><input className={input} dir="ltr" type="url" placeholder="https://scholar.google.com/…" value={form.scholar || ''} onChange={(event) => set('scholar', event.target.value)} /></Field>
                <Field label="ResearchGate"><input className={input} dir="ltr" type="url" placeholder="https://www.researchgate.net/…" value={form.researchgate || ''} onChange={(event) => set('researchgate', event.target.value)} /></Field>
                <Field label="ORCID"><input className={input} dir="ltr" type="url" placeholder="https://orcid.org/…" value={form.orcid || ''} onChange={(event) => set('orcid', event.target.value)} /></Field>
                <Field label="مستودع الجامعة"><input className={input} dir="ltr" type="url" value={form.repository || ''} onChange={(event) => set('repository', event.target.value)} /></Field>
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
              {busy && kind === 'article' && form._aiReady !== '1' ? 'جارٍ تجهيز التصنيف والمقتطف…' : busy ? 'جارٍ الحفظ…' : kind === 'article' && form.status === 'scheduled' ? 'حفظ وجدولة' : kind === 'article' && form.status === 'draft' ? 'حفظ كمسودة' : 'حفظ ونشر'}
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

  const paged = usePagedList(filtered, 15, `${kind}|${query}|${descending}`)

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
    const task = beginAdminTask(`حفظ ${labels[kind].singular}`)
    setBusy(true)
    setError('')
    try {
      let preparedForm = { ...form }
      if (kind === 'paper') {
        const local = analyzeResearch(preparedForm)
        const fingerprint = local.analysisFingerprint
        let result = Object.fromEntries(Object.entries(local).map(([key, value]) => [key, String(value ?? '')])) as Form
        if (preparedForm.analysisFingerprint !== fingerprint || !preparedForm.analyzedAt) {
          try {
            result = await requestResearchAnalysis(preparedForm)
          } catch {
            // يحفظ الاستخراج المحلي الموثوق، وتبقى الحقول غير الموجودة مخفية في الواجهة العامة.
          }
        }
        preparedForm = mergeResearchAnalysis(preparedForm, result, fingerprint)
        preparedForm.reviewStatus = 'محكّم'
        setForm(preparedForm)
      }
      if (kind === 'article') {
        preparedForm = { ...preparedForm, title: normalizeArabicTypography(preparedForm.title || ''), excerpt: normalizeArabicTypography(preparedForm.excerpt || ''), body: normalizeArabicTypography(preparedForm.body || '') }
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
        const patch: Record<string, unknown> = Object.fromEntries(editableFields[kind]
          .filter((field) => field !== 'slug' && !same(data[field], base[field]))
          .map((field) => [field, data[field] ?? '']))
        // حالة الصوت ليست حقلاً تحريرياً نصياً، لكنها يجب أن تبقى عند تعديل المقال لاحقاً.
        if (kind === 'article' && current.audioControl) patch.audioControl = current.audioControl
        const overrideRef = doc(db, 'content_overrides', `${kind}:${current._cms.baseSlug || current.slug}`)
        if (!Object.keys(patch).length && !current._cms.hidden) await deleteDoc(overrideRef)
        else await setDoc(overrideRef, { patch, hidden: Boolean(current._cms.hidden), updatedAt: serverTimestamp() })
      }
      setCurrent(undefined)
      await done(kind === 'article' && data.status === 'scheduled' ? '✓ حُفظ المقال مجدولاً ولن يظهر للزوار قبل موعده.' : kind === 'article' && data.status === 'draft' ? '✓ حُفظ المقال كمسودة ولم يظهر للزوار.' : '✓ حُفظ التعديل ويظهر للزوار فوراً.')
      task.complete(`تم حفظ ${labels[kind].singular}`)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'تعذّر الحفظ')
      setForm((previous) => ({ ...previous, _aiBusy: '', _aiError: previous._aiError || '' }))
      task.fail(reason, `تعذّر حفظ ${labels[kind].singular}`)
    } finally {
      setBusy(false)
    }
  }

  const toggleVisibility = async (item: ManagedRecord) => {
    const task = beginAdminTask(item._cms.hidden ? 'إظهار عنصر' : 'إخفاء عنصر')
    setBusy(true)
    try {
      const db = await getDb()
      if (!db) throw new Error('Firebase غير متاح')
      const { doc, serverTimestamp, setDoc } = await import('firebase/firestore')
      if (item._cms.origin === 'added') {
        await setDoc(doc(db, collections[kind], item._cms.docId || item.slug), {
          hidden: !item._cms.hidden,
          updatedAt: serverTimestamp(),
        }, { merge: true })
      } else {
        await setDoc(doc(db, 'content_overrides', `${kind}:${item._cms.baseSlug || item.slug}`), {
          hidden: !item._cms.hidden,
          updatedAt: serverTimestamp(),
        }, { merge: true })
      }
      await done(item._cms.hidden ? '✓ أُعيد إظهار العنصر.' : '✓ أُخفي العنصر من الموقع مع بقائه محفوظاً في اللوحة.')
      task.complete('اكتملت العملية')
    } catch (reason) {
      setNotice(reason instanceof Error ? reason.message : 'تعذّر تنفيذ العملية')
      task.fail(reason, 'تعذّر تنفيذ العملية')
    } finally {
      setBusy(false)
    }
  }

  const deleteItem = async (item: ManagedRecord) => {
    if (!window.confirm(`حذف «${item.title}» نهائياً من الموقع؟ لا يمكن التراجع عن حذف العناصر المضافة.`)) return
    const task = beginAdminTask('حذف عنصر')
    setBusy(true)
    try {
      const db = await getDb()
      if (!db) throw new Error('Firebase غير متاح')
      const { deleteDoc, doc, serverTimestamp, setDoc } = await import('firebase/firestore')
      if (item._cms.origin === 'added') {
        await deleteDoc(doc(db, collections[kind], item._cms.docId || item.slug))
      } else {
        // عناصر الأصل موجودة في الشفرة؛ نحذفها من الموقع بطابع حذف دائم بدلاً من العبث بملف المصدر.
        await setDoc(doc(db, 'content_overrides', `${kind}:${item._cms.baseSlug || item.slug}`), {
          deleted: true,
          hidden: true,
          updatedAt: serverTimestamp(),
        }, { merge: true })
      }
      await done(item._cms.origin === 'added' ? '✓ حُذف العنصر نهائياً.' : '✓ حُذف العنصر من الموقع مع حماية ملفات الأصل من التعديل.')
      task.complete('حُذف العنصر')
    } catch (reason) {
      setNotice(reason instanceof Error ? reason.message : 'تعذّر حذف العنصر')
      task.fail(reason, 'تعذّر حذف العنصر')
    } finally {
      setBusy(false)
    }
  }

  const resetOriginal = async (item: ManagedRecord) => {
    if (!window.confirm('إلغاء كل تعديلات هذا العنصر واستعادة الأصل؟')) return
    const task = beginAdminTask('استعادة النسخة الأصلية')
    setBusy(true)
    try {
      const db = await getDb()
      if (!db) throw new Error('Firebase غير متاح')
      const { deleteDoc, doc } = await import('firebase/firestore')
      await deleteDoc(doc(db, 'content_overrides', `${kind}:${item._cms.baseSlug || item.slug}`))
      await done('✓ استُعيدت نسخة الأصل.')
      task.complete('استُعيدت النسخة الأصلية')
    } catch (reason) {
      setNotice(reason instanceof Error ? reason.message : 'تعذّرت استعادة الأصل')
      task.fail(reason, 'تعذّرت استعادة الأصل')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section id={`admin-content-${kind}`} className="grid min-w-0 max-w-full gap-5">
      <div className="grid min-w-0 gap-4 sm:flex sm:flex-wrap sm:items-end sm:justify-between">
        <div className="min-w-0">
          <p className="text-[.76rem] font-semibold uppercase text-accent">إدارة المحتوى</p>
          <h2 className="mt-1 font-display text-2xl font-bold text-ink">{labels[kind].plural}</h2>
          <p className="mt-1 text-[.82rem] text-soft">{items.length} عنصراً — الأصل والإضافات في قائمة واحدة.</p>
        </div>
        <button type="button" onClick={openNew} className={`${primary} w-full sm:w-auto`}>+ إضافة {labels[kind].singular}</button>
      </div>

      <div className="grid gap-3 rounded-2xl border border-hair bg-wash p-4 sm:grid-cols-[minmax(0,1fr)_auto]">
        <input className={input} type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={`ابحث في ${labels[kind].plural}…`} aria-label={`بحث في ${labels[kind].plural}`} />
        <button type="button" onClick={() => setDescending((value) => !value)} className={secondary}>{descending ? 'الأحدث أولاً ↓' : 'الأقدم أولاً ↑'}</button>
      </div>

      {notice && <p className="rounded-xl border border-accent/30 bg-wash px-4 py-3 text-[.84rem] text-accent">{notice}</p>}

      <div className="grid min-w-0 gap-3 sm:hidden">
        {paged.pageItems.map((item) => (
          <article key={`${item._cms.origin}:${item.slug}`} className={`min-w-0 overflow-hidden rounded-2xl border border-hair bg-canvas p-4 ${item._cms.hidden ? 'opacity-60' : ''}`}>
            <button type="button" onClick={() => openEdit(item)} className="block min-w-0 w-full text-right">
              <span className="block break-words font-medium leading-[1.7] text-ink">{item.title}</span>
            </button>
            <p className="mt-2 break-words text-[.76rem] text-soft">{item.date || item.cat || item.outlet || item.isbn || '—'}</p>
            <details className="mt-2 rounded-xl border border-hair bg-wash px-3 py-2">
              <summary className="cursor-pointer list-none text-[.7rem] font-semibold text-soft">الرابط المختصر</summary>
              <span className="mt-1 block max-w-full truncate text-[.68rem] text-soft" dir="ltr">{item.slug}</span>
            </details>
            <div className="mt-3 flex min-w-0 flex-wrap gap-1.5">
              <span className="rounded-full border border-hair px-2.5 py-1 text-[.68rem] text-soft">{item._cms.origin === 'base' ? 'أصل' : 'مُضاف'}</span>
              {item._cms.modified && <span className="rounded-full bg-accent/10 px-2.5 py-1 text-[.68rem] text-accent">مُعدّل</span>}
              {item._cms.hidden && <span className="rounded-full border border-accent/30 px-2.5 py-1 text-[.68rem] text-accent">مخفي</span>}
              {kind === 'article' && item.status === 'scheduled' && <span className="rounded-full border border-accent/30 px-2.5 py-1 text-[.68rem] text-accent">مجدول</span>}
              {kind === 'article' && item.status === 'draft' && <span className="rounded-full border border-hair px-2.5 py-1 text-[.68rem] text-soft">مسودة</span>}
            </div>
            <div className="mt-4 grid min-w-0 grid-cols-3 gap-2 text-[.72rem]">
              <button type="button" onClick={() => openEdit(item)} className="min-w-0 rounded-full border border-accent/30 px-2 py-2 font-semibold text-accent">تعديل</button>
              <button type="button" disabled={busy} onClick={() => void toggleVisibility(item)} className="min-w-0 rounded-full border border-hair px-2 py-2 text-soft disabled:opacity-50">{item._cms.hidden ? 'إظهار' : 'إخفاء'}</button>
              <button type="button" disabled={busy} onClick={() => void deleteItem(item)} className="min-w-0 rounded-full border border-red-700/20 px-2 py-2 font-semibold text-red-700/80 disabled:opacity-50 dark:text-red-300/80">حذف</button>
            </div>
            {item._cms.origin === 'base' && (item._cms.modified || item._cms.hidden) && (
              <button type="button" disabled={busy} onClick={() => void resetOriginal(item)} className="mt-2 w-full rounded-full border border-hair px-3 py-2 text-[.72rem] text-soft disabled:opacity-50">استعادة الأصل</button>
            )}
          </article>
        ))}
        {!filtered.length && <p className="rounded-2xl border border-hair bg-canvas px-5 py-12 text-center text-[.86rem] text-soft">لا نتائج مطابقة.</p>}
      </div>

      <div className="admin-table-scroll hidden max-w-full overflow-x-auto rounded-2xl border border-hair bg-canvas sm:block">
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
            {paged.pageItems.map((item) => (
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
                className={`group cursor-pointer transition-colors hover:bg-wash/70 focus-visible:bg-wash ${item._cms.hidden ? 'opacity-55' : ''}`}
                aria-label={`تعديل ${item.title}`}
              >
                <td className="max-w-md px-5 py-4">
                  <button type="button" onClick={() => openEdit(item)} className="block w-full text-right">
                    <span className="block font-medium leading-relaxed text-ink transition-colors hover:text-accent">{item.title}</span>
                    <span className="mt-1 block truncate text-[.72rem] text-soft opacity-0 transition-opacity duration-200 group-hover:opacity-100 group-focus-within:opacity-100" dir="ltr">{item.slug}</span>
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
                    <button type="button" disabled={busy} onClick={() => void toggleVisibility(item)} className="text-soft hover:text-accent">{item._cms.hidden ? 'إظهار' : 'إخفاء'}</button>
                    <button type="button" disabled={busy} onClick={() => void deleteItem(item)} className="font-semibold text-red-700/75 transition-colors hover:text-red-700 dark:text-red-300/80 dark:hover:text-red-300">حذف</button>
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

      <Pagination
        page={paged.page}
        pageCount={paged.pageCount}
        onChange={paged.setPage}
        totalItems={filtered.length}
        firstItem={paged.firstItem}
        lastItem={paged.lastItem}
        scrollTargetId={`admin-content-${kind}`}
        label={`صفحات ${labels[kind].plural}`}
      />

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
