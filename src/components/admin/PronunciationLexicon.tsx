/* قاموس النطق — يضيف الدكتور كلمةً بنفسه فتُنطق صحيحةً في كل حلقةٍ قادمة.
   ولا يمرّ بي: يكتب هنا، فتقرؤه Firestore، فيسحبه جسرُ القاموس قبل كل توليد. */
import { useEffect, useMemo, useState } from 'react'
import { Pagination, usePagedList } from '../Pagination'
import { getFirebaseApp } from '../../lib/firebase'
import lexiconFile from '../../../scripts/pronunciation-lexicon.json'
import bodies from '../../data/bodies.json'
import { ADJUSTED_WORD_FORMS, AUDIO_EPISODE_AFTER_PREPOSITION_FORMS, LEXICON_TERM_FORMS, PENDING_TERM_FORMS, TERM_OBJECT_FORMS, arabicCountPhrase } from '../../lib/arabic-count.ts'

type Entry = { word: string; sub?: string; diacritics?: string; note?: string; type?: string; updatedAt?: string }

const strip = (value: string) => value.replace(/[ً-ْٰ]/g, '')

/** المرآة الدقيقة لحارس السكربت — ولو اختلفا لقَبِلت اللوحة ما يرفضه المحرك */
/* القاموس الأساسي مقروءاً: الدكتور ظنّه فارغاً لأن اللوحة لا تعرض إلا ما يكتبه
   بيده، والـ322 مدخلاً تعمل بصمتٍ خلفه. فنُظهر الحجم والأصناف، ونُتيح تفتيشه
   كلّه — فيعرف قبل أن يُضيف أنّ الكلمة مضبوطةٌ سلفاً. */
type BaseEntry = { type?: string; sub?: string; diacritics?: string; note?: string }
const BASE = (lexiconFile as { entries: Record<string, BaseEntry> }).entries || {}

export function baseSummary(entries: Record<string, BaseEntry>): { total: number; types: [string, number][] } {
  const counts = new Map<string, number>()
  for (const value of Object.values(entries)) {
    const type = String(value?.type || 'أخرى').replace(' · متوقَّع', '')
    counts.set(type, (counts.get(type) || 0) + 1)
  }
  return {
    total: Object.keys(entries).length,
    types: [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5),
  }
}

/** تفتيش القاموس الأساسي — يُطمئن الدكتور أن اللفظ مضبوطٌ قبل أن يُضيفه */
export function lookupBase(term: string, entries: Record<string, BaseEntry>): { word: string; how: string; type: string }[] {
  const needle = strip(String(term || '').trim())
  if (needle.length < 2) return []
  const out: { word: string; how: string; type: string }[] = []
  for (const [word, value] of Object.entries(entries)) {
    if (!strip(word).includes(needle)) continue
    out.push({
      word,
      how: value?.diacritics || value?.sub || value?.note || '—',
      type: String(value?.type || ''),
    })
    if (out.length >= 12) break
  }
  return out
}

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
  /* تفتيش القاموس الأساسي: الدكتور يريد أن يعرف قبل أن يُضيف — أمضبوطةٌ الكلمة
     سلفاً أم لا. ولا نعرض الـ322 دفعةً واحدة كي لا تصير زحمةً بصرية. */
  const [probe, setProbe] = useState('')
  const summary = useMemo(() => baseSummary(BASE), [])
  const probeHits = useMemo(() => lookupBase(probe, BASE), [probe])
  /* الطابور: ما حُوّل من التنبيهات لينتظر ضبط الدكتور. صفٌّ لكل لفظ، بحقوله،
     أمامه دفعةً واحدة — فإضافة عشرة ألفاظ لا تحتمل عشر دورات ملء وحفظ. */
  const [queue, setQueue] = useState<{ word: string; diacritics: string; sub: string }[]>([])
  const [pending, setPending] = useState<{ slug: string; words: { word: string; kind: string }[] }[]>([])

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
    const waiting = await getDocs(collection(getFirestore(app), 'pronunciation_pending'))
    setPending(waiting.docs.map((document) => document.data() as { slug: string; words: { word: string; kind: string }[] }))
  }
  useEffect(() => { void load() }, [])

  /* التحويل: نجمع ألفاظ كل التنبيهات، نُسقط المكرّر وما دخل القاموس أصلاً */
  const transferAll = () => {
    const already = new Set(entries.map((entry) => strip(entry.word)))
    const seen = new Set<string>()
    const rows: { word: string; diacritics: string; sub: string }[] = []
    for (const item of pending) {
      for (const row of item.words || []) {
        const key = strip(row.word)
        if (seen.has(key) || already.has(key)) continue
        seen.add(key)
        rows.push({ word: row.word, diacritics: '', sub: '' })
      }
    }
    setQueue(rows)
    setNotice(rows.length ? `${arabicCountPhrase(rows.length, PENDING_TERM_FORMS)} أدناه.` : 'كلها مضبوطةٌ في القاموس بالفعل.')
  }

  const editRow = (index: number, patch: Partial<{ diacritics: string; sub: string }>) =>
    setQueue((rows) => rows.map((row, i) => (i === index ? { ...row, ...patch } : row)))

  /* الحفظ الجماعي: يحفظ المكتمل ويُبقي الناقص في الطابور، ولا يُسقط عمل الدكتور
     لأن صفّاً واحداً بقي فارغاً. */
  const saveQueue = async () => {
    const ready = queue.filter((row) => !checkEntry(row.word, row.sub, row.diacritics))
    if (!ready.length) { setNotice('املأ حركات أو نطقاً بديلاً لواحدٍ على الأقل.'); return }
    setBusy(true)
    try {
      const app = await getFirebaseApp()
      const { getFirestore, doc, setDoc, serverTimestamp } = await import('firebase/firestore')
      for (const row of ready) {
        await setDoc(doc(getFirestore(app!), 'pronunciation_lexicon', row.word.trim()), {
          word: row.word.trim(),
          ...(row.diacritics.trim() ? { diacritics: row.diacritics.trim() } : {}),
          ...(row.sub.trim() ? { sub: row.sub.trim() } : {}),
          type: 'من اللوحة',
          updatedAt: serverTimestamp(),
        }, { merge: true })
      }
      const savedKeys = new Set(ready.map((row) => row.word))
      setQueue((rows) => rows.filter((row) => !savedKeys.has(row.word)))
      setNotice(`✓ حُفظ ${arabicCountPhrase(ready.length, TERM_OBJECT_FORMS)}. ستُنطق هكذا في كل حلقةٍ بعد الآن.`)
      await load()
    } catch (error) {
      setNotice(`تعذّر الحفظ: ${error instanceof Error ? error.message : 'خطأ'}`)
    } finally { setBusy(false) }
  }

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

  const pendingPages = usePagedList(pending, 6, String(pending.length))
  const queuePages = usePagedList(queue, 10, String(queue.length))
  const entryPages = usePagedList(shown, 12, search)
  const field = 'w-full rounded-xl border border-hair bg-canvas px-3 py-2 text-[.85rem] text-ink outline-none focus:border-accent'

  return (
    <details className="rounded-2xl border border-hair bg-wash p-5" open>
      <summary className="cursor-pointer text-[.95rem] font-semibold text-ink">
        قاموس النطق — {arabicCountPhrase(summary.total, ADJUSTED_WORD_FORMS)}
      </summary>

      <p className="mt-3 text-[.8rem] leading-relaxed text-soft">
        كل كلمةٍ تضيفها هنا تُنطق كما تريد في <strong>كل حلقةٍ قادمة</strong>، ولا تحتاج إعادة كتابة الحوار.
        والنصّ الذي يقرؤه زوّارك لا يتغيّر — الحركات تعمل في طبقة الصوت وحدها.
      </p>

      {/* الحجم والأصناف: يعرف الدكتور ما يملكه بلا أن يُغرَق بثلاثمئة سطر */}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-accent px-4 py-1.5 text-[.78rem] font-semibold text-white">
          {arabicCountPhrase(summary.total, ADJUSTED_WORD_FORMS)} سلفاً
        </span>
        {summary.types.map(([type, count]) => (
          <span key={type} className="rounded-full border border-hair bg-canvas px-3 py-1.5 text-[.74rem] text-soft">
            {type} · {count}
          </span>
        ))}
      </div>

      {/* تفتيش: أمضبوطةٌ هذه الكلمة؟ */}
      <div className="mt-3 rounded-xl border border-hair bg-canvas p-3">
        <label className="text-[.75rem] font-semibold text-accent">أمضبوطةٌ كلمةٌ ما؟ فتّش قبل أن تُضيف</label>
        <input
          value={probe}
          onChange={(event) => setProbe(event.target.value)}
          placeholder="اكتب كلمة — الفاشينستات، 2026، et al…"
          className="mt-2 w-full rounded-xl border border-hair bg-wash px-3 py-2 text-[.85rem] text-ink outline-none focus:border-accent"
        />
        {probe.trim().length >= 2 && (
          probeHits.length ? (
            <ul className="mt-2 grid gap-1.5">
              {probeHits.map((hit) => (
                <li key={hit.word} className="text-[.8rem] text-ink">
                  ✓ <strong>{hit.word}</strong> <span className="text-soft">← {hit.how}</span>
                  {hit.type && <span className="text-[.7rem] text-soft/70"> · {hit.type}</span>}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-[.8rem] text-soft">لم أجدها في القاموس — أضِفها أدناه لتُنطق كما تريد.</p>
          )
        )}
      </div>

      {/* تنبيهات التوليد: ما نطقه المحرك باجتهاده في حلقاتٍ وُلِّدت فعلاً */}
      {pending.length > 0 && (
        <div className="mt-4 rounded-xl border border-accent/40 bg-canvas p-3">
          <p className="text-[.78rem] font-semibold text-accent">
            المحرك نطق ألفاظاً باجتهاده في {arabicCountPhrase(pending.length, AUDIO_EPISODE_AFTER_PREPOSITION_FORMS)}
          </p>
          <ul className="mt-2 grid gap-1.5">
            {pendingPages.pageItems.map((item) => (
              <li key={item.slug} className="text-[.76rem] leading-relaxed text-soft">
                <span className="text-ink">{item.slug}</span> — {(item.words || []).map((row) => `«${row.word}»`).join('، ')}
              </li>
            ))}
          </ul>
          <Pagination page={pendingPages.page} pageCount={pendingPages.pageCount} onChange={pendingPages.setPage} totalItems={pending.length} firstItem={pendingPages.firstItem} lastItem={pendingPages.lastItem} label="صفحات تنبيهات النطق" className="mt-3" />
          <button
            type="button"
            onClick={transferAll}
            className="mt-3 rounded-full bg-accent px-4 py-2 text-[.78rem] font-semibold text-white transition-opacity hover:opacity-90"
          >
            حوّلها كلها إلى القاموس
          </button>
        </div>
      )}

      {/* الطابور: كل لفظٍ بحقوله أمام الدكتور، ثم حفظٌ واحد للجميع */}
      {queue.length > 0 && (
        <div className="mt-4 rounded-xl border border-accent/40 bg-canvas p-4">
          <p className="text-[.8rem] font-semibold text-ink">{arabicCountPhrase(queue.length, PENDING_TERM_FORMS)}</p>
          <p className="mt-1 text-[.72rem] text-soft">لكلٍّ إمّا حركات (الكلمة نفسها مشكولة) وإمّا نطقٌ بديل. اترك ما لا تعرفه واحفظ الباقي.</p>
          <ul className="mt-3 grid gap-2">
            {queuePages.pageItems.map((row, index) => {
              const rowProblem = (row.diacritics || row.sub) ? checkEntry(row.word, row.sub, row.diacritics) : ''
              return (
                <li key={row.word} className="grid gap-2 rounded-xl border border-hair bg-wash p-2.5 md:grid-cols-[9rem_1fr_1fr]">
                  <span className="self-center text-[.82rem] font-semibold text-ink">{row.word}</span>
                  <input
                    value={row.diacritics}
                    onChange={(event) => editRow((queuePages.page - 1) * 10 + index, { diacritics: event.target.value })}
                    placeholder="الحركات"
                    className="rounded-lg border border-hair bg-canvas px-2.5 py-1.5 text-[.8rem] text-ink outline-none focus:border-accent"
                  />
                  <input
                    value={row.sub}
                    onChange={(event) => editRow((queuePages.page - 1) * 10 + index, { sub: event.target.value })}
                    placeholder="أو نطقٌ بديل"
                    className="rounded-lg border border-hair bg-canvas px-2.5 py-1.5 text-[.8rem] text-ink outline-none focus:border-accent"
                  />
                  {rowProblem && <p className="text-[.72rem] text-accent md:col-span-3">{rowProblem}</p>}
                </li>
              )
            })}
          </ul>
          <Pagination page={queuePages.page} pageCount={queuePages.pageCount} onChange={queuePages.setPage} totalItems={queue.length} firstItem={queuePages.firstItem} lastItem={queuePages.lastItem} label="صفحات طابور ضبط النطق" className="mt-3" />
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => void saveQueue()}
              disabled={busy}
              className="rounded-full bg-accent px-5 py-2.5 text-[.82rem] font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {busy ? 'أحفظ…' : 'احفظ المكتمل'}
            </button>
            <button type="button" onClick={() => setQueue([])} className="text-[.78rem] text-soft hover:text-accent">أفرغ الطابور</button>
          </div>
        </div>
      )}

      {candidates.length > 0 && (
        <div className="mt-4 rounded-xl border border-accent/30 bg-canvas p-3">
          <p className="text-[.75rem] font-semibold text-accent">
            {arabicCountPhrase(candidates.length, LEXICON_TERM_FORMS)} خارج القاموس — ستُنطق باجتهاد المحرك
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
          {entryPages.pageItems.map((entry) => (
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
        <Pagination page={entryPages.page} pageCount={entryPages.pageCount} onChange={entryPages.setPage} totalItems={shown.length} firstItem={entryPages.firstItem} lastItem={entryPages.lastItem} label="صفحات كلمات القاموس" className="mt-4" />
      </div>
    </details>
  )
}
