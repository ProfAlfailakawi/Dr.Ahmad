/* قاموس النطق — يضيف الدكتور كلمةً بنفسه فتُنطق صحيحةً في كل حلقةٍ قادمة.
   ولا يمرّ بي: يكتب هنا، فتقرؤه Firestore، فيسحبه جسرُ القاموس قبل كل توليد. */
import { useEffect, useMemo, useState } from 'react'
import { getFirebaseApp } from '../../lib/firebase'
import lexiconFile from '../../../scripts/pronunciation-lexicon.json'
import bodies from '../../data/bodies.json'

type Entry = { word: string; sub?: string; diacritics?: string; note?: string; type?: string; updatedAt?: string }

const strip = (value: string) => value.replace(/[ً-ْٰ]/g, '')

/** المرآة الدقيقة لحارس السكربت — ولو اختلفا لقَبِلت اللوحة ما يرفضه المحرك */
export function checkEntry(word: string, sub: string, diacritics: string): string {
  const key = word.trim()
  if (!key) return 'اكتب الكلمة كما تظهر في مقالك.'
  if (key.length > 60) return 'الكلمة طويلة أكثر من اللازم.'
  if (!sub.trim() && !diacritics.trim()) return 'اكتب إمّا نطقاً بديلاً وإمّا حركات.'
  if (diacritics.trim() && strip(diacritics.trim()) !== strip(key)) {
    return `الحركات لكلمةٍ أخرى: «${strip(diacritics.trim())}» ليست «${strip(key)}».`
  }
  return ''
}


/* ═══ كشّاف الألفاظ الجديدة ═══
   نفس منطق scripts/audit-pronunciation.mjs — ومقصودٌ أن يكونا متطابقين: ما
   يُنبّه عليه البناء يجب أن يراه الدكتور في اللوحة نفسها، وإلا نبّهه سطرٌ في
   سجلٍّ لا يفتحه أحد. */
const FOREIGN = /(?:ستات|يشن|تشن|كشن|نستا|غرام|سوشي|سوشا|ميدي|فاشن|فاشي|بلوك|لايك|فولو|هاشت|ترند|كوتش|ديجيت|تكنولوج|استراتيج|بروتوكول|سيناريو|ديموقراط|ايديولوج|انستغ|انستق|سناب|يوتيوب|واتس|تويت|فيسبوك|بودكاست|اونلاين|اوفلاين)/
const FORM_X = /^(?:[يتنأا]ست|وليست|ليست|لست)/
const bare = (word: string) => strip(word).replace(/^(?:وال|فال|بال|كال|لل|ال|و|ف|ب|ك|ل)/, '')

export function findNewWords(texts: string[], known: Set<string>, min = 2) {
  const counts = new Map<string, number>()
  for (const text of texts) {
    for (const raw of String(text).split(/[\s.,،؛:!؟()«»"'…]+/)) {
      const word = strip(raw.trim())
      if (!word || word.length < 4) continue
      if (known.has(word) || known.has(bare(word))) continue
      const stem = bare(word)
      if (FORM_X.test(stem) || FORM_X.test(word)) continue
      if (!FOREIGN.test(stem)) continue
      counts.set(word, (counts.get(word) || 0) + 1)
    }
  }
  return [...counts.entries()]
    .filter(([, count]) => count >= min)
    .sort((a, b) => b[1] - a[1])
    .map(([word, count]) => ({ word, count }))
}

export function PronunciationLexicon() {
  const [entries, setEntries] = useState<Entry[]>([])
  const [word, setWord] = useState('')
  const [diacritics, setDiacritics] = useState('')
  const [sub, setSub] = useState('')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState('')
  const [search, setSearch] = useState('')

  /* الألفاظ التي دخلت مقالاته ولم تدخل قاموسه بعد */
  const candidates = useMemo(() => {
    const known = new Set<string>([
      ...Object.keys((lexiconFile as { entries: Record<string, unknown> }).entries || {}),
      ...entries.map((entry) => entry.word),
    ].flatMap((key) => [strip(key), bare(key)]))
    return findNewWords(Object.values(bodies as Record<string, string>), known).slice(0, 12)
  }, [entries])

  const load = async () => {
    const app = await getFirebaseApp()
    if (!app) return
    const { getFirestore, collection, getDocs } = await import('firebase/firestore')
    const snapshot = await getDocs(collection(getFirestore(app), 'pronunciation_lexicon'))
    setEntries(snapshot.docs.map((document) => ({ word: document.id, ...(document.data() as Omit<Entry, 'word'>) })))
  }
  useEffect(() => { void load() }, [])

  const problem = checkEntry(word, sub, diacritics)

  const save = async () => {
    if (problem) { setNotice(problem); return }
    setBusy(true); setNotice('')
    try {
      const app = await getFirebaseApp()
      const { getFirestore, doc, setDoc, serverTimestamp } = await import('firebase/firestore')
      await setDoc(doc(getFirestore(app!), 'pronunciation_lexicon', word.trim()), {
        word: word.trim(),
        ...(diacritics.trim() ? { diacritics: diacritics.trim() } : {}),
        ...(sub.trim() ? { sub: sub.trim() } : {}),
        ...(note.trim() ? { note: note.trim() } : {}),
        type: 'من اللوحة',
        updatedAt: serverTimestamp(),
      }, { merge: true })
      setWord(''); setDiacritics(''); setSub(''); setNote('')
      setNotice('✓ حُفظت. ستُنطق هكذا في كل حلقةٍ تُولَّد بعد الآن.')
      await load()
    } catch (error) {
      setNotice(`تعذّر الحفظ: ${error instanceof Error ? error.message : 'خطأ غير معروف'}`)
    } finally { setBusy(false) }
  }

  const remove = async (key: string) => {
    if (!window.confirm(`سيُحذف «${key}» من قاموس النطق. هل تتابع؟`)) return
    const app = await getFirebaseApp()
    const { getFirestore, doc, deleteDoc } = await import('firebase/firestore')
    await deleteDoc(doc(getFirestore(app!), 'pronunciation_lexicon', key))
    await load()
  }

  const shown = useMemo(() => {
    const term = strip(search.trim())
    return entries
      .filter((entry) => !term || strip(entry.word).includes(term))
      .sort((a, b) => a.word.localeCompare(b.word, 'ar'))
  }, [entries, search])

  const field = 'w-full rounded-xl border border-hair bg-canvas px-3 py-2 text-[.85rem] text-ink outline-none focus:border-accent'

  return (
    <details className="rounded-2xl border border-hair bg-wash p-5">
      <summary className="cursor-pointer text-[.95rem] font-semibold text-ink">
        قاموس النطق — أضف كلمةً تُنطق خطأً
      </summary>

      <p className="mt-3 text-[.8rem] leading-relaxed text-soft">
        كل كلمةٍ تضيفها هنا تُنطق كما تريد في <strong>كل حلقةٍ قادمة</strong>، ولا تحتاج إعادة كتابة الحوار.
        والنصّ الذي يقرؤه زوّارك لا يتغيّر — الحركات تعمل في طبقة الصوت وحدها.
      </p>

      {candidates.length > 0 && (
        <div className="mt-4 rounded-xl border border-accent/30 bg-canvas p-3">
          <p className="text-[.75rem] font-semibold text-accent">
            {candidates.length === 1 ? 'لفظٌ في مقالاتك' : `${candidates.length} ألفاظٍ في مقالاتك`} ليست في القاموس — ستُنطق باجتهاد المحرك
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {candidates.map((item) => (
              <button
                key={item.word}
                type="button"
                onClick={() => { setWord(item.word); setDiacritics(''); setSub(''); setNotice('') }}
                className="rounded-full border border-hair bg-wash px-3 py-1.5 text-[.76rem] text-ink transition-colors hover:border-accent hover:text-accent"
              >
                {item.word} <span className="text-soft">×{item.count}</span>
              </button>
            ))}
          </div>
          <p className="mt-2 text-[.7rem] text-soft">اضغط أيّها لتضبط نطقه.</p>
        </div>
      )}

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <div>
          <label className="text-[.75rem] font-semibold text-accent">الكلمة كما تكتبها</label>
          <input value={word} onChange={(event) => setWord(event.target.value)} placeholder="الفاشينستات" className={`mt-1 ${field}`} />
        </div>
        <div>
          <label className="text-[.75rem] font-semibold text-accent">الحركات (الكلمة نفسها مشكولة)</label>
          <input value={diacritics} onChange={(event) => setDiacritics(event.target.value)} placeholder="الفاشِنِسْتات" className={`mt-1 ${field}`} />
        </div>
        <div>
          <label className="text-[.75rem] font-semibold text-accent">أو نطقٌ بديل تماماً</label>
          <input value={sub} onChange={(event) => setSub(event.target.value)} placeholder="مثال: et al. ← وآخرون" className={`mt-1 ${field}`} />
        </div>
        <div>
          <label className="text-[.75rem] font-semibold text-accent">ملاحظة (اختيارية)</label>
          <input value={note} onChange={(event) => setNote(event.target.value)} placeholder="فتح الفاء وكسر النون" className={`mt-1 ${field}`} />
        </div>
      </div>

      {problem && (word || sub || diacritics) && (
        <p className="mt-3 rounded-xl border border-accent/30 bg-canvas px-4 py-2.5 text-[.78rem] text-accent">{problem}</p>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => void save()}
          disabled={busy || Boolean(problem)}
          className="rounded-full bg-accent px-5 py-2.5 text-[.82rem] font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-default disabled:opacity-50"
        >
          {busy ? 'أحفظ…' : 'أضف إلى القاموس'}
        </button>
        {notice && <span className="text-[.78rem] text-soft">{notice}</span>}
      </div>

      <div className="mt-6 border-t border-hair pt-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-[.8rem] font-semibold text-ink">كلماتك المضافة ({entries.length})</p>
          {entries.length > 6 && (
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="ابحث…" className="w-40 rounded-full border border-hair bg-canvas px-3 py-1.5 text-[.78rem] outline-none focus:border-accent" />
          )}
        </div>

        {!shown.length && <p className="mt-3 text-[.78rem] text-soft">لم تُضف كلمةً بعد. القاموس الأساسي يعمل كما هو.</p>}

        <ul className="mt-3 grid gap-2">
          {shown.map((entry) => (
            <li key={entry.word} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-hair bg-canvas px-4 py-2.5">
              <span className="text-[.82rem] text-ink">
                <strong>{entry.word}</strong>
                {entry.diacritics ? <span className="text-soft"> ← {entry.diacritics}</span> : null}
                {entry.sub ? <span className="text-soft"> ← {entry.sub}</span> : null}
                {entry.note ? <span className="text-[.72rem] text-soft"> · {entry.note}</span> : null}
              </span>
              <button type="button" onClick={() => void remove(entry.word)} className="text-[.75rem] text-accent hover:underline">حذف</button>
            </li>
          ))}
        </ul>
      </div>
    </details>
  )
}
