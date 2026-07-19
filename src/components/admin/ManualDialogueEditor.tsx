import { useEffect, useMemo, useRef, useState } from 'react'
import type { ArticleRecord } from '../../lib/cms'
import { loadArticleBodies } from '../../lib/article-bodies'
import { useAdminAuth } from '../../lib/admin-auth'
import { getDb } from '../../lib/firebase'
import podcastAdmin from '../../data/podcast-admin.json'
import { fingerprintDialogue } from '../../lib/podcast-dialogue-lock'
import { dispatchPodcastGeneration } from '../../lib/podcast-generation'

type Speaker = 'male' | 'female'
type DialogueTurn = {
  speaker: Speaker
  text: string
  deliveryType: string
  pauseAfterMs: number
  overlapMs: number
  musicBridgeAfter: boolean
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

const card = 'min-w-0 max-w-full rounded-2xl border border-hair bg-wash p-4 sm:p-5 md:p-6'
const input = 'w-full rounded-xl border border-hair bg-canvas px-3.5 py-2.5 text-[.86rem] text-ink outline-none transition-colors focus:border-accent'
const ghost = 'rounded-full border border-hair bg-canvas px-4 py-2 text-[.78rem] font-semibold text-soft transition-colors hover:border-accent hover:text-accent disabled:cursor-not-allowed disabled:opacity-40'
const primary = 'rounded-full bg-accent px-5 py-2.5 text-[.8rem] font-semibold text-white transition-colors hover:bg-accent-deep disabled:cursor-not-allowed disabled:opacity-45'
const dialogueAudioBase = (import.meta.env.VITE_AUDIO_BASE_URL || '').replace(/\/+$/, '')
const dialogueAudioUrl = (path: string) => dialogueAudioBase ? `${dialogueAudioBase}/${path.replace(/^\/?audio\//, '')}` : path

const blankTurn = (speaker: Speaker): DialogueTurn => ({
  speaker,
  text: '',
  deliveryType: 'statement',
  pauseAfterMs: 320,
  overlapMs: 0,
  musicBridgeAfter: false,
})

function normalizeTurns(value: unknown): DialogueTurn[] | null {
  if (!Array.isArray(value) || value.length < 1) return null
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

function sentenceChunks(value = '') {
  return value
    .replace(/\r/g, '')
    .split(/(?:\n{2,}|(?<=[.!؟])\s+)/u)
    .map((item) => item.replace(/\s+/g, ' ').trim())
    .filter((item) => item.length >= 18)
}

function firstTurnFromSource(title: string, value: string): DialogueTurn {
  const chunks = sentenceChunks(value)
  const first = chunks[0] || `حلقتنا اليوم عن «${title}»… سنبدأ من الفكرة الأساسية ثم تضيف ما بعدها يدوياً.`
  const normalized = first.length > 220 ? `${first.slice(0, 217).trim()}…` : first
  return { ...blankTurn('male'), deliveryType: 'setup', text: normalized }
}

function dialogueFromText(title: string, value: string): DialogueTurn[] {
  const chunks = sentenceChunks(value).slice(0, 22)
  if (!chunks.length) return [blankTurn('male'), blankTurn('female')]
  const reactions = ['وهنا تبدأ المسألة الحقيقية.', 'صحيح… لكن دعنا نتوقف عند أثرها في الإنسان.', 'هذه نقطة مهمة؛ ماذا تعني عملياً؟', 'وهذا يغيّر طريقة فهمنا للسؤال كله.']
  const turns: DialogueTurn[] = [{ ...blankTurn('male'), deliveryType: 'setup', text: `حلقتنا اليوم عن «${title}»… لكننا لن نقرأ مقالاً بصوتين؛ سنفكك الفكرة كما تجري في حديث حقيقي.` }]
  chunks.forEach((chunk, index) => {
    const speaker: Speaker = turns[turns.length - 1]?.speaker === 'male' ? 'female' : 'male'
    turns.push({ ...blankTurn(speaker), text: chunk, deliveryType: index % 4 === 1 ? 'reflection' : index % 4 === 2 ? 'question' : 'statement', pauseAfterMs: index % 5 === 4 ? 520 : 300 })
    if (index > 0 && index % 5 === 0 && turns.length < 24) {
      turns.push({ ...blankTurn(speaker === 'male' ? 'female' : 'male'), text: reactions[index % reactions.length], deliveryType: 'briefReaction', pauseAfterMs: 180, overlapMs: 40 })
    }
  })
  turns.push({ ...blankTurn(turns[turns.length - 1]?.speaker === 'male' ? 'female' : 'male'), deliveryType: 'closing', text: 'الخلاصة ليست أن نرفض الأداة أو ننبهر بها؛ بل أن نسأل دائماً: ماذا صنعت في الإنسان؟', pauseAfterMs: 700, musicBridgeAfter: true })
  return turns.slice(0, 26)
}

/* ═══ تحويل مستند الصديق الكامل إلى حوار ═══
   الصيغة الطبيعية: سطر لكل مداخلة يبدأ باسم المتحدث ثم نقطتان —
   «الرجل: …» / «المرأة: …» — والسطور بلا اسم تُلحق بالمداخلة السابقة.
   وسوم اختيارية داخل النص: [موسيقى] · [وقفة 800] · [تداخل 90] · [سؤال] [تأمل]
   [اعتراض هادئ] [رد قصير] [خلاصة]… وما لم يوسم يُستنتج: «؟» سؤال، والقصير رد،
   والأخيرة خلاصة. النص نفسه لا يُمس — الاستنتاج للأداء فقط. */
const SPEAKER_ALIASES: Record<string, Speaker> = {
  'الرجل': 'male', 'رجل': 'male', 'م': 'male', 'male': 'male', 'a': 'male', 'فهد': 'male', 'عثمان': 'male', 'المذيع': 'male', 'هو': 'male',
  'المرأة': 'female', 'امرأة': 'female', 'المرأه': 'female', 'أ': 'female', 'female': 'female', 'b': 'female', 'نورة': 'female', 'نوره': 'female', 'أزيان': 'female', 'المذيعة': 'female', 'هي': 'female',
}
const TYPE_TAGS: Record<string, string> = {
  'خبر': 'statement', 'سؤال': 'question', 'رد': 'response', 'تأمل': 'reflection', 'اعتراض': 'objection',
  'اعتراض هادئ': 'gentleObjection', 'شرح': 'explanation', 'توضيح': 'clarification', 'تمهيد': 'setup',
  'مثال': 'example', 'تأكيد': 'emphasis', 'رد قصير': 'briefReaction', 'خلاصة': 'conclusion', 'إغلاق': 'closing',
}
const TYPE_PAUSES: Record<string, number> = {
  statement: 560, question: 680, response: 520, reflection: 760, objection: 640, gentleObjection: 620,
  explanation: 600, clarification: 600, setup: 640, example: 580, emphasis: 620, briefReaction: 240,
  conclusion: 900, closing: 900,
}

function turnsFromScript(value: string): DialogueTurn[] | null {
  const lines = String(value || '').replace(/\r/g, '').split('\n').map((line) => line.trim()).filter(Boolean)
  const turns: DialogueTurn[] = []
  const locked: { type?: boolean; pause?: boolean }[] = []
  for (const line of lines) {
    const match = line.match(/^([^:：]{1,16})\s*[:：]\s*(.+)$/u)
    const speaker = match ? SPEAKER_ALIASES[match[1].trim().toLowerCase()] : undefined
    if (match && speaker) {
      turns.push({ ...blankTurn(speaker), text: match[2].trim() })
      locked.push({})
    } else if (turns.length) {
      turns[turns.length - 1].text = `${turns[turns.length - 1].text} ${line}`.trim()
    }
  }
  if (turns.length < 2 || new Set(turns.map((turn) => turn.speaker)).size < 2) return null
  turns.forEach((turn, index) => {
    const lock = locked[index]
    turn.text = turn.text.replace(/\[([^\]]{1,24})\]/g, (_, rawTag: string) => {
      const tag = rawTag.trim()
      const pauseMatch = tag.match(/^وقفة\s*(\d{2,4})$/)
      const overlapMatch = tag.match(/^تداخل\s*(\d{1,3})$/)
      if (tag === 'موسيقى') turn.musicBridgeAfter = true
      else if (pauseMatch) { turn.pauseAfterMs = Math.min(2000, Number(pauseMatch[1])); lock.pause = true }
      else if (overlapMatch) turn.overlapMs = Math.min(150, Number(overlapMatch[1]))
      else if (TYPE_TAGS[tag]) { turn.deliveryType = TYPE_TAGS[tag]; lock.type = true }
      return ' '
    }).replace(/\s+/g, ' ').trim()
    if (!lock.type) {
      if (/[؟?]\s*$/.test(turn.text)) turn.deliveryType = 'question'
      else if (turn.text.split(/\s+/).length <= 8) turn.deliveryType = 'briefReaction'
      else if (index === turns.length - 1) turn.deliveryType = 'conclusion'
    }
    if (!lock.pause) turn.pauseAfterMs = TYPE_PAUSES[turn.deliveryType] ?? 560
  })
  return turns.every((turn) => turn.text) ? turns : null
}

async function unzipDocxEntry(buffer: ArrayBuffer, wanted = 'word/document.xml') {
  const bytes = new Uint8Array(buffer)
  const view = new DataView(buffer)
  let eocd = -1
  for (let offset = bytes.length - 22; offset >= Math.max(0, bytes.length - 65_557); offset -= 1) {
    if (view.getUint32(offset, true) === 0x06054b50) { eocd = offset; break }
  }
  if (eocd < 0) throw new Error('docx-zip')
  const entries = view.getUint16(eocd + 10, true)
  let cursor = view.getUint32(eocd + 16, true)
  const decoder = new TextDecoder()
  for (let index = 0; index < entries; index += 1) {
    if (view.getUint32(cursor, true) !== 0x02014b50) throw new Error('docx-directory')
    const compression = view.getUint16(cursor + 10, true)
    const compressedSize = view.getUint32(cursor + 20, true)
    const fileNameLength = view.getUint16(cursor + 28, true)
    const extraLength = view.getUint16(cursor + 30, true)
    const commentLength = view.getUint16(cursor + 32, true)
    const localOffset = view.getUint32(cursor + 42, true)
    const name = decoder.decode(bytes.slice(cursor + 46, cursor + 46 + fileNameLength))
    if (name === wanted) {
      if (view.getUint32(localOffset, true) !== 0x04034b50) throw new Error('docx-entry')
      const localNameLength = view.getUint16(localOffset + 26, true)
      const localExtraLength = view.getUint16(localOffset + 28, true)
      const start = localOffset + 30 + localNameLength + localExtraLength
      const payload = bytes.slice(start, start + compressedSize)
      if (compression === 0) return decoder.decode(payload)
      if (compression !== 8 || typeof DecompressionStream === 'undefined') throw new Error('docx-compression')
      const stream = new Blob([payload]).stream().pipeThrough(new DecompressionStream('deflate-raw'))
      return decoder.decode(await new Response(stream).arrayBuffer())
    }
    cursor += 46 + fileNameLength + extraLength + commentLength
  }
  throw new Error('docx-document-missing')
}

async function documentText(file: File) {
  const name = file.name.toLowerCase()
  if (name.endsWith('.docx')) {
    const xml = await unzipDocxEntry(await file.arrayBuffer())
    const documentXml = new DOMParser().parseFromString(xml, 'application/xml')
    const paragraphs = Array.from(documentXml.getElementsByTagNameNS('*', 'p')).map((paragraph) =>
      Array.from(paragraph.getElementsByTagNameNS('*', 't')).map((node) => node.textContent || '').join(''),
    ).map((value) => value.trim()).filter(Boolean)
    return paragraphs.join('\n\n')
  }
  return await file.text()
}

function storedDialogue(slug: string) {
  try {
    return normalizeTurns(JSON.parse(localStorage.getItem(`podcast:manual-dialogue:${slug}`) || 'null'))
  } catch {
    return null
  }
}

export function ManualDialogueEditor({ articles, onQueued }: { articles: ArticleRecord[]; onQueued?: () => void }) {
  const { user, isAdmin, refresh } = useAdminAuth()
  const sortedArticles = useMemo(() => [...articles].sort((a, b) => b.iso.localeCompare(a.iso)), [articles])
  const focusedSlug = typeof window !== 'undefined' ? localStorage.getItem('podcast:focus-slug') || '' : ''
  const initialSlug = sortedArticles.some((item) => item.slug === focusedSlug) ? focusedSlug : sortedArticles[0]?.slug || ''
  const [slug, setSlug] = useState(initialSlug)

  /* «فتح المسودة» كان يفتح على مقالٍ آخر: المقالات تصل بعد أول رسم، فيُحسب المقال
     المطلوب على قائمة فارغة ويسقط الاختيار إلى الأول. نلتقط الطلب حين تصل القائمة. */
  useEffect(() => {
    if (!sortedArticles.length) return
    let requested = ''
    try { requested = localStorage.getItem('podcast:focus-slug') || '' } catch { /* noop */ }
    if (requested && requested !== slug && sortedArticles.some((item) => item.slug === requested)) setSlug(requested)
    else if (!slug) setSlug(sortedArticles[0].slug)
  }, [sortedArticles, slug])
  const [turns, setTurns] = useState<DialogueTurn[]>(() => [blankTurn('male')])
  const [availableDraft, setAvailableDraft] = useState<DialogueTurn[] | null>(() => storedDialogue(initialSlug))
  const [notice, setNotice] = useState('')
  const [dirty, setDirty] = useState(false)
  const [articleBody, setArticleBody] = useState('')
  const [documentBusy, setDocumentBusy] = useState(false)
  const [cloudBusy, setCloudBusy] = useState(false)
  const [queueBusy, setQueueBusy] = useState(false)
  /* بعد الضغط لم يكن الدكتور يعرف أنجح الإرسال أم لا: الزرّ يعود كما كان،
     ولا شيء يتغيّر إلا سطرُ إشعارٍ خافت أسفل الصفحة قد لا يراه. فيضغط ثانيةً
     وثالثة وهو لا يدري. الآن يُقفل الزرّ ويُعلن النجاح في مكانه. */
  const [queuedProof, setQueuedProof] = useState<{ turnCount: number; sha: string; runId?: string } | null>(null)
  const [audioAvailable, setAudioAvailable] = useState(false)
  const [audioChecking, setAudioChecking] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const article = sortedArticles.find((item) => item.slug === slug)
  const episode = (podcastAdmin as { episodes?: { slug: string; audio?: string; status?: string; quality?: { score?: number; pass?: boolean } }[] }).episodes?.find((item) => item.slug === slug)
  const audioSource = dialogueAudioUrl(episode?.audio || `/audio/${slug}.dialogue.mp3`)
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
    try {
      if (localStorage.getItem('podcast:focus-slug') === slug) localStorage.removeItem('podcast:focus-slug')
    } catch { /* noop */ }
    let active = true
    const local = storedDialogue(slug)
    /* «فتح المسودة» يفتحها فعلاً: كان يبدأ بمداخلة فارغة ويكتفي بزر استعادة،
       فيظن الدكتور أن ما كتبه ضاع. المحفوظة تُحمَّل مباشرة عند وجودها. */
    setTurns(local && local.length ? local : [blankTurn('male')])
    setAvailableDraft(local)
    setDirty(false)
    setNotice(local
      ? `فُتحت المسودة المحفوظة (${local.length} مداخلة).`
      : 'مداخلة واحدة جاهزة؛ أضف غيرها فقط عند الحاجة.')
    setArticleBody('')
    loadArticleBodies().then((bodies) => { if (active) setArticleBody(article?.body || bodies[slug] || article?.excerpt || '') }).catch(() => { if (active) setArticleBody(article?.body || article?.excerpt || '') })
    if (isAdmin) {
      void getDb().then(async (db) => {
        if (!db || !active) return
        const { doc, getDoc } = await import('firebase/firestore')
        const candidates = [
          doc(db, 'podcast_dialogues', slug),
          doc(db, 'social_queue', `podcast-dialogue-${slug}`),
        ]
        for (const reference of candidates) {
          try {
            const snapshot = await getDoc(reference)
            if (!active) return
            if (!snapshot.exists()) continue
            const cloud = normalizeTurns(snapshot.data().turns)
            if (!cloud) continue
            setAvailableDraft(cloud)
            localStorage.setItem(`podcast:manual-dialogue:${slug}`, JSON.stringify(cloud))
            localStorage.removeItem(`podcast:pending-cloud:${slug}`)
            setNotice(`بدأ الوضع اليدوي بمداخلة واحدة. توجد مسودة سحابية محفوظة (${cloud.length} مداخلة) ويمكن استعادتها عند الحاجة.`)
            return
          } catch {
            // جرّب المسار الاحتياطي؛ بعض المشاريع لم تُنشر فيها قاعدة المجموعة الجديدة بعد.
          }
        }
      }).catch(() => undefined)
    }
    return () => { active = false }
  }, [article?.body, article?.excerpt, isAdmin, slug])

  useEffect(() => {
    let active = true
    let timer = 0
    const check = async () => {
      setAudioChecking(true)
      try {
        let response = await fetch(audioSource, { method: 'HEAD', cache: 'no-store' })
        if (response.status === 405) response = await fetch(audioSource, { headers: { Range: 'bytes=0-0' }, cache: 'no-store' })
        if (active) setAudioAvailable(response.ok)
      } catch {
        if (active) setAudioAvailable(Boolean(episode?.audio))
      } finally {
        if (active) setAudioChecking(false)
      }
    }
    void check()
    timer = window.setInterval(() => void check(), 30_000)
    return () => { active = false; window.clearInterval(timer) }
  }, [audioSource, episode?.audio])

  const update = (index: number, patch: Partial<DialogueTurn>) => {
    setTurns((current) => current.map((turn, turnIndex) => turnIndex === index ? { ...turn, ...patch } : turn))
    setDirty(true)
    setNotice('')
  }

  const save = async (automatic = false, strict = false) => {
    const localKey = `podcast:manual-dialogue:${slug}`
    const pendingKey = `podcast:pending-cloud:${slug}`
    let proof: Awaited<ReturnType<typeof fingerprintDialogue>>
    try {
      proof = await fingerprintDialogue(turns)
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'الحوار غير صالح للحفظ.')
      return null
    }
    const canonicalJson = JSON.stringify(proof.turns, null, 2)
    localStorage.setItem(localKey, canonicalJson)

    if (!isAdmin) {
      setDirty(false)
      setNotice('حُفظت المسودة على هذا الجهاز فقط؛ يلزم دخول المشرف لإرسالها للتوليد.')
      return null
    }

    setCloudBusy(true)
    try {
      const db = await getDb()
      if (!db) throw new Error('firebase-unavailable')
      const { doc, getDoc, serverTimestamp, setDoc } = await import('firebase/firestore')
      const primary = doc(db, 'podcast_dialogues', slug)
      const payload = {
        slug,
        title: article?.title || slug,
        turns: proof.turns,
        source: 'admin-upload',
        schemaVersion: 2,
        contentSha256: proof.contentSha256,
        revisionSha256: proof.revisionSha256,
        revisionId: proof.revisionId,
        turnCount: proof.turnCount,
        status: 'draft',
        savedAtClient: new Date().toISOString(),
        updatedAt: serverTimestamp(),
      }
      await setDoc(primary, payload, { merge: true })

      // قراءة راجعة إلزامية: لا نعلن نجاح الحفظ حتى نثبت أن Firestore يحمل النص نفسه حرفياً.
      const readBack = await getDoc(primary)
      if (!readBack.exists()) throw new Error('cloud-readback-missing')
      const cloud = readBack.data()
      const cloudProof = await fingerprintDialogue(normalizeTurns(cloud.turns) || [])
      if (cloudProof.contentSha256 !== proof.contentSha256
        || cloudProof.revisionSha256 !== proof.revisionSha256
        || cloud.contentSha256 !== proof.contentSha256
        || cloud.revisionSha256 !== proof.revisionSha256
        || cloud.revisionId !== proof.revisionId
        || Number(cloud.turnCount) !== proof.turnCount) {
        throw new Error('cloud-fingerprint-mismatch')
      }

      // مرآة قديمة احتياطية فقط؛ مسار التوليد لا يقرأها بعد الآن.
      try {
        await setDoc(doc(db, 'social_queue', `podcast-dialogue-${slug}`), payload, { merge: true })
      } catch { /* لا يؤثر في المصدر المقفول */ }

      localStorage.removeItem(pendingKey)
      setTurns(proof.turns)
      setAvailableDraft(null)
      setDirty(false)
      setNotice(`${automatic ? 'حفظ تلقائي' : 'حُفظ الحوار'} وتطابقت القراءة الراجعة ✓ بصمة ${proof.contentSha256.slice(0, 12)}`)
      return proof
    } catch (error) {
      localStorage.setItem(pendingKey, canonicalJson)
      setDirty(false)
      const reason = error instanceof Error ? error.message : 'cloud-save-failed'
      setNotice(`لم يُثبت الحفظ السحابي، لذلك مُنع الإرسال للتوليد. بقيت نسخة على هذا الجهاز. (${reason})`)
      if (strict) return null
      return null
    } finally {
      setCloudBusy(false)
    }
  }

  const queueForGeneration = async () => {
    if (warnings.some((item) => item.includes('بلا نص')) || turns.length < 2) {
      setNotice('أكمل الحوار أولاً؛ لن يُرسل أي نص ناقص إلى Azure.')
      return
    }
    setQueueBusy(true)
    try {
      const proof = await save(false, true)
      if (!proof) return
      const db = await getDb()
      if (!db) throw new Error('firebase-unavailable')
      const { doc, getDoc, serverTimestamp, setDoc } = await import('firebase/firestore')
      const productionRef = doc(db, 'podcast_production', slug)
      await setDoc(productionRef, {
        status: 'queued',
        sourceCollection: 'podcast_dialogues',
        expectedDialogueContentSha256: proof.contentSha256,
        expectedDialogueRevisionSha256: proof.revisionSha256,
        expectedDialogueRevisionId: proof.revisionId,
        expectedTurnCount: proof.turnCount,
        queuedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        note: 'الحوار اليدوي مقفول بالبصمة؛ ممنوع استخدام المقال أو نسخة أخرى.',
      }, { merge: true })
      const queued = await getDoc(productionRef)
      const data = queued.data() || {}
      if (!queued.exists()
        || data.status !== 'queued'
        || data.expectedDialogueContentSha256 !== proof.contentSha256
        || data.expectedDialogueRevisionSha256 !== proof.revisionSha256
        || data.expectedDialogueRevisionId !== proof.revisionId
        || Number(data.expectedTurnCount) !== proof.turnCount) {
        throw new Error('queue-readback-mismatch')
      }
      const dispatch = await dispatchPodcastGeneration({ user, slug, proof })
      setQueuedProof({ turnCount: proof.turnCount, sha: proof.contentSha256.slice(0, 12), runId: dispatch.workflowRunId ? String(dispatch.workflowRunId) : undefined })
      setNotice(dispatch.duplicate
        ? `الحوار نفسه مقفول والتوليد يعمل بالفعل ✓ ${proof.turnCount} مداخلة · بصمة ${proof.contentSha256.slice(0, 12)}`
        : `بدأ التوليد تلقائياً من لوحة التحكم ✓ ${proof.turnCount} مداخلة · بصمة ${proof.contentSha256.slice(0, 12)}${dispatch.workflowRunId ? ` · تشغيل ${dispatch.workflowRunId}` : ''}. لا تحتاج إلى دخول GitHub.`)
      /* التحويل المباشر إلى صفحة التوليد: الدكتور يرى حالة حلقته فوراً، ولا تبقى
         بين يديه شاشةٌ فيها زرّ إرسالٍ قد يُضغط مرّةً ثانية فيُنتج تكراراً. */
      onQueued?.()
    } catch (error) {
      setNotice(`مُنع الإرسال لأن القفل السحابي لم يثبت: ${error instanceof Error ? error.message : 'unknown-error'}`)
    } finally {
      setQueueBusy(false)
    }
  }

  /* عاد يحرّر أو بدّل المقال؟ الإرسال السابق لم يعد يخصّ ما بين يديه */
  useEffect(() => { setQueuedProof(null) }, [slug])
  useEffect(() => { if (dirty) setQueuedProof(null) }, [dirty])

  useEffect(() => {
    if (!dirty) return
    const timer = window.setTimeout(() => void save(true), 1400)
    return () => window.clearTimeout(timer)
  }, [dirty, json, slug, isAdmin])


  useEffect(() => {
    if (!isAdmin) return
    const retryPending = () => {
      if (!localStorage.getItem(`podcast:pending-cloud:${slug}`)) return
      void save(true)
    }
    window.addEventListener('online', retryPending)
    const timer = window.setTimeout(retryPending, 900)
    return () => {
      window.removeEventListener('online', retryPending)
      window.clearTimeout(timer)
    }
  }, [isAdmin, slug])

  const restoreSavedDraft = () => {
    if (!availableDraft) return
    setTurns(availableDraft)
    setAvailableDraft(null)
    setDirty(false)
    setNotice(`استُعيدت المسودة المحفوظة (${availableDraft.length} مداخلة) ✓`)
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
    if (file.size > 25 * 1024 * 1024) {
      setNotice('المستند أكبر من 25MB. احفظه DOCX نصياً من دون صور ثقيلة ثم أعد رفعه؛ الحوار نفسه لا يحتاج صوراً.')
      if (fileRef.current) fileRef.current.value = ''
      return
    }
    setDocumentBusy(true)
    try {
      const name = file.name.toLowerCase()
      if (name.endsWith('.json')) {
        const parsed = normalizeTurns(JSON.parse(await file.text()))
        if (!parsed) throw new Error('invalid-json')
        setTurns(parsed)
        setNotice(`استُوردت نسخة احتياطية تحتوي ${parsed.length} مداخلة؛ راجعها ثم احفظ.`)
      } else {
        const text = await documentText(file)
        const script = turnsFromScript(text)
        if (script) {
          setTurns(script)
          const maleCount = script.filter((turn) => turn.speaker === 'male').length
          setNotice(`استُورد الحوار كاملاً من المستند: ${script.length} مداخلة (الرجل ${maleCount} · المرأة ${script.length - maleCount}). راجع المداخلات ثم احفظ — الحفظ يوصلها لغرفة الإنتاج.`)
        } else {
          const firstTurn = firstTurnFromSource(article?.title || file.name.replace(/\.[^.]+$/, ''), text)
          setTurns([firstTurn])
          setNotice('لم أجد سطوراً بصيغة «الرجل: …» / «المرأة: …» فأدرجت مداخلة افتتاحية واحدة. اكتب المستند سطراً لكل مداخلة يبدأ باسم المتحدث ونقطتين ليُستورد الحوار كاملاً.')
        }
      }
      setDirty(true)
    } catch {
      setNotice('تعذّر قراءة المستند. استخدم DOCX أو TXT أو MD، أو نسخة JSON احتياطية صحيحة.')
    } finally {
      setDocumentBusy(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const buildFromArticle = () => {
    if (!articleBody.trim()) {
      setNotice('النص الكامل للمقال غير متاح بعد؛ ارفع مستند الحلقة مباشرة.')
      return
    }
    const firstTurn = firstTurnFromSource(article?.title || 'الحلقة', articleBody)
    setTurns([firstTurn])
    setDirty(true)
    setNotice('وُضعت مداخلة افتتاحية واحدة فقط من نص المقال. أضف ما بعدها يدوياً حتى يبقى الوضع اليدوي نظيفاً.')
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
    if (turns.length <= 1) return
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
            <p className="mt-2 text-[.84rem] leading-relaxed text-soft">اختر المقال ثم ارفع ملف Word (أو TXT) بالحوار كاملاً: سطر لكل مداخلة يبدأ بـ«الرجل:» أو «المرأة:»، ووسوم اختيارية داخل النص مثل [موسيقى] و[وقفة 800] و[تداخل 90] — يُحوَّل تلقائياً إلى مداخلات جاهزة تراجعها هنا ثم تحفظها، وثم تضغط «حفظ وإرسال الحوار نفسه للتوليد». يقبل أيضاً JSON جاهزاً.</p>
            <p className="mt-2 rounded-xl border border-accent/25 bg-canvas px-4 py-3 text-[.78rem] font-semibold leading-relaxed text-accent">حل جذري لمشكلة 413: ملف Word يُقرأ داخل متصفحك ولا يُرسل كملف إلى أي Cloud Function. بعد القراءة يُحفظ النص المنظّم فقط في Firestore، لذلك لا يوجد طلب رفع ضخم يمكن أن يرفضه الخادم.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <input ref={fileRef} type="file" accept=".docx,.txt,.md,.json,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,application/json" className="hidden" onChange={(event) => void importFile(event.target.files?.[0])} />
            <button type="button" className={ghost} disabled={documentBusy} onClick={() => fileRef.current?.click()}>{documentBusy ? 'أقرأ المستند…' : 'رفع مستند'}</button>
            <button type="button" className={ghost} onClick={buildFromArticle}>ملء المداخلة الأولى من المقال</button>
            <button type="button" className={primary} onClick={download} disabled={warnings.some((item) => item.includes('بلا نص'))}>تنزيل نسخة احتياطية</button>
          </div>
        </div>

        <div className="mt-4 rounded-2xl border border-accent/20 bg-canvas px-4 py-4 text-[.8rem] leading-relaxed text-soft">
          <p className="font-semibold text-accent">في الوضع اليدوي</p>
          <ul className="mt-2 grid gap-1.5 pr-4">
            <li>تظهر مداخلة واحدة فقط افتراضياً.</li>
            <li>لا ينشئ النظام مداخلات كثيرة تلقائياً.</li>
            <li>أنت تضيف مداخلة جديدة فقط عند الضغط على «إضافة مداخلة».</li>
            <li>تبقى خيارات الصوت ونوع المداخلة والوقفة والتداخل والجسر الموسيقي داخل البطاقة نفسها.</li>
            <li>حوارك المرفوع هو المصدر الوحيد: يُقفل ببصمتين، ثم يبدأ التوليد تلقائياً من هذه اللوحة بلا دخول إلى GitHub.</li>
          </ul>
        </div>
        {availableDraft && (
          <button
            type="button"
            onClick={restoreSavedDraft}
            className="mt-3 inline-flex w-fit items-center rounded-full border border-accent/35 bg-canvas px-4 py-2 text-[.76rem] font-semibold text-accent transition-colors hover:border-accent hover:bg-accent hover:text-white"
          >
            استعادة المسودة المحفوظة ({availableDraft.length} مداخلة)
          </button>
        )}

        <div className="mt-5 grid gap-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
          <label className="block min-w-0">
            <span className="mb-1.5 block text-[.76rem] font-semibold text-soft">الحلقة / المقال</span>
            <select className={input} value={slug} onChange={(event) => setSlug(event.target.value)}>
              {sortedArticles.map((item) => <option key={item.slug} value={item.slug}>{item.title}</option>)}
            </select>
          </label>
          <div className="flex flex-wrap justify-end gap-2">
            <button type="button" onClick={() => void save(false)} disabled={cloudBusy || queueBusy} className={dirty ? primary : ghost}>{cloudBusy ? 'أثبت الحفظ…' : dirty ? 'حفظ وتثبيت البصمة' : isAdmin ? 'الحوار محفوظ ومثبت' : 'المسودة محفوظة'}</button>
            <button
              type="button"
              onClick={() => void queueForGeneration()}
              disabled={cloudBusy || queueBusy || turns.length < 2 || Boolean(queuedProof)}
              className={queuedProof ? `${primary} cursor-default opacity-60` : primary}
            >
              {queueBusy ? 'أحفظ وأبدأ التوليد…' : queuedProof ? '✓ أُرسل للتوليد' : 'حفظ وإرسال الحوار نفسه للتوليد'}
            </button>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 rounded-xl border border-hair bg-canvas px-4 py-3 text-[.76rem] text-soft">
          <span><strong className="text-ink">{turns.length}</strong> مداخلة</span>
          <span><strong className="text-ink">{wordCount}</strong> كلمة</span>
          <span><strong className="text-ink">{turns.filter((item) => item.speaker === 'male').length}</strong> لفهد</span>
          <span><strong className="text-ink">{turns.filter((item) => item.speaker === 'female').length}</strong> لنورة</span>
          {article && <span className="min-w-0 truncate">الحلقة: <span dir="ltr">{article.slug}</span></span>}
        </div>

        <div className="mt-4 rounded-2xl border border-accent/25 bg-canvas p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-[.76rem] font-semibold text-accent">الصوت المرتبط بهذه الحلقة</p>
              <p className="mt-1 text-[.74rem] text-soft">رفع المستند يبني الحوار ويحفظه تلقائياً. يظهر المشغّل هنا وحده فور وجود ملف الصوت المنشور في مسار الإنتاج.</p>
            </div>
            <span className={`rounded-full px-3 py-1 text-[.7rem] font-semibold ${audioAvailable && episode?.quality?.pass ? 'bg-emerald-50 text-emerald-700' : 'bg-wash text-soft'}`}>{audioChecking ? 'أتحقق…' : audioAvailable ? episode?.quality?.pass ? 'مجتاز' : 'الصوت متاح' : 'بانتظار التوليد'}</span>
          </div>
          {audioAvailable ? (
            <>
              <audio className="mt-3 w-full" controls preload="metadata" src={audioSource} />
              <p className="mt-2 text-[.7rem] text-soft">الحالة: {episode?.status || 'منشور'}{typeof episode?.quality?.score === 'number' ? ` · درجة الجودة ${episode.quality.score}` : ''}</p>
            </>
          ) : <p className="mt-3 rounded-xl border border-hair bg-wash px-4 py-3 text-[.76rem] leading-relaxed text-soft">المسودة جاهزة، لكن الصوت لا يُنشأ داخل المتصفح؛ يظهر تلقائياً بعد مرورها بمسار Azure والمراجعة الصوتية.</p>}
        </div>

        {queuedProof && (
          <div role="status" className="mt-4 grid gap-2 rounded-2xl border border-accent/45 bg-canvas px-5 py-4">
            <p className="font-display text-[1.05rem] font-semibold text-ink">✓ وصل الحوار وبدأ التوليد</p>
            <p className="text-[.82rem] leading-relaxed text-soft">
              {queuedProof.turnCount} مداخلة · بصمة {queuedProof.sha}
              {queuedProof.runId ? ` · تشغيل ${queuedProof.runId}` : ''}
              <br />
              التوليد يستغرق نحو عشر دقائق. لا تحتاج إلى الضغط ثانيةً، ولا إلى دخول GitHub —
              الحلقة تظهر في صفحة المقال وحدها متى اجتازت البوابات.
            </p>
            <div className="flex flex-wrap gap-2">
              <a href="/admin?tab=production" className="rounded-full bg-accent px-5 py-2.5 text-[.82rem] font-semibold text-white transition-opacity hover:opacity-90">تابع التوليد</a>
              <button type="button" className={ghost} onClick={() => setQueuedProof(null)}>أرسل حواراً آخر</button>
            </div>
          </div>
        )}
        {notice && !queuedProof && <p role="status" className="admin-inline-notice mt-4 rounded-xl border border-accent/25 bg-canvas px-4 py-3 text-[.8rem] leading-relaxed text-accent">{notice}</p>}
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
                <button type="button" className="h-8 rounded-full border border-hair px-3 text-[.72rem] text-soft disabled:opacity-30" disabled={turns.length <= 1} onClick={() => remove(index)}>حذف</button>
              </div>
            </div>

            <textarea
              className={`${input} mt-3 min-h-24 resize-y leading-[1.9]`}
              dir="rtl"
              value={turn.text}
              placeholder={turn.speaker === 'male' ? 'مداخلة فهد…' : 'مداخلة نورة…'}
              onChange={(event) => update(index, { text: event.target.value })}
            />

            <div className="mt-3 grid gap-3 sm:grid-cols-[10rem_10rem_minmax(0,1fr)] sm:items-end">
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
