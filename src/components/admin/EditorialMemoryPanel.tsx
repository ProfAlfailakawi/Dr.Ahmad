import { useEffect, useMemo, useRef, useState } from 'react'
import type { ArticleRecord, BookRecord, PaperRecord } from '../../lib/cms'
import { getDb, getFirebaseApp } from '../../lib/firebase'
import { articleSimilarityReport, relatedForIdea } from '../../lib/intelligence'
import {
  buildAgendaAlignment,
  matchPersonalSources,
  type IntellectualAgendaItem,
  type IntellectualAgendaStatus,
  type PersonalSourceRecord,
  type PersonalSourceStatus,
} from '../../lib/editorial-memory'
import { useAdminAuth } from '../../lib/admin-auth'

const input = 'w-full rounded-xl border border-hair bg-canvas px-4 py-3 text-[.84rem] text-ink outline-none transition-colors placeholder:text-soft/60 focus:border-accent'
const primary = 'rounded-full bg-accent px-5 py-2.5 text-[.78rem] font-semibold text-white transition-colors hover:bg-accent-deep disabled:opacity-50'
const ghost = 'rounded-full border border-hair px-4 py-2 text-[.74rem] text-soft transition-colors hover:border-accent hover:text-accent disabled:opacity-50'

const agendaStatuses: Array<{ value: IntellectualAgendaStatus; label: string }> = [
  { value: 'explore', label: 'أستكشف' },
  { value: 'gather_evidence', label: 'أجمع الدليل' },
  { value: 'testing', label: 'أختبر موقفي' },
  { value: 'writing', label: 'أكتب' },
  { value: 'changed_mind', label: 'تغيّر موقفي' },
  { value: 'complete', label: 'اكتمل' },
]

const sourceStatuses: Array<{ value: PersonalSourceStatus; label: string }> = [
  { value: 'active', label: 'نشط' },
  { value: 'needs_review', label: 'يحتاج مراجعة' },
  { value: 'corrected', label: 'مصحح' },
  { value: 'retracted', label: 'منسحب' },
]

function sourceKind(reference: string, storagePath = ''): PersonalSourceRecord['kind'] {
  if (storagePath) return 'pdf'
  if (/10\.\d{4,9}\/[\-._;()/:A-Z0-9]+/i.test(reference)) return 'doi'
  if (/^https?:\/\//i.test(reference)) return /\.pdf(?:[?#]|$)/i.test(reference) ? 'pdf' : 'url'
  return 'note'
}

function cleanDoi(value = '') {
  return String(value).trim().replace(/^doi\s*:\s*/i, '').replace(/^https?:\/\/(?:dx\.)?doi\.org\//i, '').match(/10\.\d{4,9}\/[\-._;()/:A-Z0-9]+/i)?.[0]?.replace(/[.,;،؛]+$/, '') || ''
}

function sourceId() {
  return `src-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

function agendaId() {
  return `agenda-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

function stringArray(value: unknown) {
  if (Array.isArray(value)) return value.map((item) => String(item || '').trim()).filter(Boolean)
  return String(value || '').split(/[،,;\n]/).map((item) => item.trim()).filter(Boolean)
}

async function uploadPrivatePdf(file: File, id: string) {
  if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) throw new Error('الملف يجب أن يكون PDF.')
  if (file.size <= 0 || file.size > 24 * 1024 * 1024) throw new Error('PDF الخاص يجب ألا يتجاوز 24MB.')
  const app = await getFirebaseApp()
  if (!app) throw new Error('Firebase غير متاح.')
  const { getStorage, ref, uploadBytes } = await import('firebase/storage')
  const storage = getStorage(app)
  const path = `admin-source-desk/${id}.pdf`
  await uploadBytes(ref(storage, path), file, { contentType: 'application/pdf', customMetadata: { visibility: 'admin-only' } })
  return path
}

type Props = {
  idea: string
  articles: ArticleRecord[]
  books: readonly BookRecord[]
  papers: readonly PaperRecord[]
  onDataChange?: (data: { sources: PersonalSourceRecord[]; agenda: IntellectualAgendaItem[] }) => void
}

export function EditorialMemoryPanel({ idea, articles, books, papers, onDataChange }: Props) {
  const { user } = useAdminAuth()
  const [sources, setSources] = useState<PersonalSourceRecord[]>([])
  const [agenda, setAgenda] = useState<IntellectualAgendaItem[]>([])
  const [usage, setUsage] = useState<Record<string, string[]>>({})
  const [sourceTitle, setSourceTitle] = useState('')
  const [sourceReference, setSourceReference] = useState('')
  const [sourceNote, setSourceNote] = useState('')
  const [sourceFile, setSourceFile] = useState<File | null>(null)
  const [sourceBusy, setSourceBusy] = useState(false)
  const [sourceFilter, setSourceFilter] = useState('')
  const [sourceNotice, setSourceNotice] = useState('')
  const [agendaTitle, setAgendaTitle] = useState('')
  const [agendaNote, setAgendaNote] = useState('')
  const [agendaStatus, setAgendaStatus] = useState<IntellectualAgendaStatus>('explore')
  const [agendaPriority, setAgendaPriority] = useState<1 | 2 | 3 | 4 | 5>(3)
  const [agendaBusy, setAgendaBusy] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    let active = true
    let stopSources = () => {}
    let stopAgenda = () => {}
    let stopIntelligence = () => {}
    void getDb().then(async (db) => {
      if (!db || !active) return
      const { collection, onSnapshot, orderBy, query } = await import('firebase/firestore')
      stopSources = onSnapshot(query(collection(db, 'admin_source_desk'), orderBy('updatedAtClient', 'desc')), (snapshot) => {
        if (!active) return
        setSources(snapshot.docs.map((doc) => ({ id: doc.id, ...(doc.data() as object) })) as PersonalSourceRecord[])
      }, () => undefined)
      stopAgenda = onSnapshot(query(collection(db, 'admin_intellectual_agenda'), orderBy('updatedAtClient', 'desc')), (snapshot) => {
        if (!active) return
        setAgenda(snapshot.docs.map((doc) => ({ id: doc.id, ...(doc.data() as object) })) as IntellectualAgendaItem[])
      }, () => undefined)
      stopIntelligence = onSnapshot(collection(db, 'admin_content_intelligence'), (snapshot) => {
        if (!active) return
        const next: Record<string, string[]> = {}
        for (const row of snapshot.docs) {
          const data = row.data() as { slug?: string; sourceIds?: string[] }
          for (const id of data.sourceIds || []) next[id] = [...(next[id] || []), String(data.slug || row.id)]
        }
        setUsage(next)
      }, () => undefined)
    }).catch(() => undefined)
    return () => { active = false; stopSources(); stopAgenda(); stopIntelligence() }
  }, [])

  useEffect(() => { onDataChange?.({ sources, agenda }) }, [agenda, onDataChange, sources])

  const sourceMatches = useMemo(() => matchPersonalSources(idea, sources, 5), [idea, sources])
  const agendaAlignment = useMemo(() => buildAgendaAlignment(idea, agenda), [agenda, idea])
  const filteredSources = useMemo(() => {
    const query = sourceFilter.trim().toLocaleLowerCase('ar')
    if (!query) return sources.slice(0, 30)
    return sources.filter((item) => `${item.title} ${item.reference} ${item.note} ${item.summary}`.toLocaleLowerCase('ar').includes(query)).slice(0, 30)
  }, [sourceFilter, sources])

  const saveSource = async () => {
    const reference = sourceReference.trim()
    if (!sourceTitle.trim() && !reference && !sourceNote.trim() && !sourceFile) {
      setSourceNotice('أدخل مرجعاً أو ملاحظة أو PDF أولاً.')
      return
    }
    setSourceBusy(true); setSourceNotice('')
    const id = sourceId()
    try {
      const db = await getDb()
      if (!db || !user) throw new Error('جلسة المشرف غير متاحة.')
      let storagePath = ''
      if (sourceFile) storagePath = await uploadPrivatePdf(sourceFile, id)
      const kind = sourceKind(reference, storagePath)
      const doi = cleanDoi(reference)
      const rawUrl = /^https?:\/\//i.test(reference) ? reference : doi ? `https://doi.org/${doi}` : ''
      let analysis: Record<string, unknown> = {}
      if (kind !== 'note') {
        try {
          const token = await user.getIdToken()
          const response = await fetch('/api/ai/paper-analysis', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({
              title: sourceTitle.trim(),
              meta: sourceNote.trim(),
              source: rawUrl && kind !== 'pdf' ? rawUrl : '',
              url: rawUrl && kind !== 'pdf' ? rawUrl : '',
              pdf: storagePath || (kind === 'pdf' ? rawUrl : ''),
              doi,
            }),
          })
          if (response.ok) analysis = await response.json() as Record<string, unknown>
        } catch { /* المصدر يبقى محفوظاً حتى إذا تعذر التحليل الخارجي */ }
      }
      const effectiveTitle = sourceTitle.trim() || String(analysis.titleAr || analysis.title || analysis.journal || doi || (rawUrl ? new URL(rawUrl).hostname : '') || 'مادة شخصية').trim()
      const summary = String(analysis.abstractAr || analysis.meta || analysis.keyFinding || sourceNote || '').trim()
      const ideaText = `${effectiveTitle} ${summary} ${sourceNote}`
      const linkedArticles = articleSimilarityReport(effectiveTitle, `${summary} ${sourceNote}`, articles, 5).matches
        .filter((row) => row.score >= .08)
        .map((row) => ({ slug: row.slug, title: row.title, score: Math.round(row.score * 100) }))
      const linkedBooks = relatedForIdea(ideaText, books, (book) => book.desc || '', 4).map((book) => ({ slug: book.slug, title: book.title }))
      const linkedPapers = relatedForIdea(ideaText, papers, (paper) => `${paper.meta || ''} ${paper.abstractAr || ''} ${paper.keyFinding || ''} ${paper.keywords || ''}`, 4).map((paper) => ({ slug: paper.slug, title: paper.titleAr || paper.title }))
      const { doc, serverTimestamp, setDoc } = await import('firebase/firestore')
      const now = new Date().toISOString()
      const optional = {
        doi: String(analysis.doi || doi || '').trim(),
        url: String(analysis.source || analysis.url || rawUrl || '').trim(),
        storagePath,
        journal: String(analysis.journal || '').trim(),
        year: String(analysis.year || '').trim(),
        keyFinding: String(analysis.keyFinding || '').trim(),
        evidenceLabel: String(analysis.evidenceLabel || '').trim(),
      }
      const payload: Record<string, unknown> = {
        id,
        kind,
        title: effectiveTitle,
        reference,
        note: sourceNote.trim(),
        summary,
        keywords: stringArray(analysis.keywords),
        evidenceScore: Number.isFinite(Number(analysis.evidenceScore)) ? Number(analysis.evidenceScore) : null,
        status: 'active',
        linkedArticles,
        linkedBooks,
        linkedPapers,
        createdAtClient: now,
        updatedAtClient: now,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }
      for (const [key, value] of Object.entries(optional)) if (value) payload[key] = value
      await setDoc(doc(db, 'admin_source_desk', id), payload)
      setSourceTitle(''); setSourceReference(''); setSourceNote(''); setSourceFile(null)
      if (fileRef.current) fileRef.current.value = ''
      setSourceNotice(analysis && Object.keys(analysis).length ? 'حُفظ المصدر، وحُلّل وربط بالأرشيف.' : 'حُفظ المصدر وربط بالأرشيف؛ التحليل الخارجي لم يكن متاحاً الآن.')
    } catch (reason) {
      setSourceNotice(reason instanceof Error ? reason.message : 'تعذّر حفظ المصدر.')
    } finally { setSourceBusy(false) }
  }

  const updateSourceStatus = async (item: PersonalSourceRecord, status: PersonalSourceStatus) => {
    try {
      const db = await getDb(); if (!db) return
      const { doc, serverTimestamp, setDoc } = await import('firebase/firestore')
      await setDoc(doc(db, 'admin_source_desk', item.id), { status, updatedAtClient: new Date().toISOString(), updatedAt: serverTimestamp() }, { merge: true })
    } catch { /* لا نغيّر العرض محلياً إذا تعذر الحفظ */ }
  }

  const updateAgendaItem = async (item: IntellectualAgendaItem, patch: Partial<Pick<IntellectualAgendaItem, 'status' | 'priority'>>) => {
    try {
      const db = await getDb(); if (!db) return
      const { doc, serverTimestamp, setDoc } = await import('firebase/firestore')
      await setDoc(doc(db, 'admin_intellectual_agenda', item.id), { ...patch, updatedAtClient: new Date().toISOString(), updatedAt: serverTimestamp() }, { merge: true })
    } catch { /* onSnapshot يبقي آخر نسخة مؤكدة إذا تعذر الحفظ */ }
  }

  const saveAgenda = async () => {
    if (agendaTitle.trim().length < 3) return
    setAgendaBusy(true)
    try {
      const db = await getDb(); if (!db) throw new Error('Firebase غير متاح.')
      const { doc, serverTimestamp, setDoc } = await import('firebase/firestore')
      const id = agendaId(); const now = new Date().toISOString()
      const payload: IntellectualAgendaItem & { createdAt: unknown; updatedAt: unknown } = {
        id, title: agendaTitle.trim(), note: agendaNote.trim(), status: agendaStatus, priority: agendaPriority,
        createdAtClient: now, updatedAtClient: now, createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
      }
      await setDoc(doc(db, 'admin_intellectual_agenda', id), payload)
      setAgendaTitle(''); setAgendaNote(''); setAgendaStatus('explore'); setAgendaPriority(3)
    } finally { setAgendaBusy(false) }
  }

  return (
    <details className="group min-w-0 max-w-full rounded-2xl border border-hair bg-wash p-4 sm:p-5" data-personal-editorial-memory="true">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-4">
        <span><span className="block text-[.72rem] font-semibold text-accent">ذاكرتي التحريرية الخاصة</span><span className="mt-1 block text-[.78rem] text-soft">{sources.length} مصدر محفوظ · {agenda.length} مسار في الأجندة · لا يظهر شيء منها للزوار</span></span>
        <span className="text-accent transition-transform group-open:rotate-45">+</span>
      </summary>
      <div className="mt-4 grid gap-3 border-t border-hair pt-4">
        <details className="group/source rounded-xl border border-hair bg-canvas px-4 py-3" data-personal-source-desk="true">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3"><span><strong className="text-[.82rem] text-ink">مكتب المصادر الشخصي</strong>{idea.trim() && <span className="ms-2 text-[.68rem] text-soft">{sourceMatches.length ? `${sourceMatches.length} مصدر قريب من الفكرة الحالية` : 'لا يوجد مصدر شخصي قريب الآن'}</span>}</span><span className="text-accent transition-transform group-open/source:rotate-45">+</span></summary>
          <div className="mt-4 grid gap-3 border-t border-hair pt-4">
            <div className="grid gap-3 md:grid-cols-2"><input className={input} placeholder="عنوان المصدر — اختياري" value={sourceTitle} onChange={(event) => setSourceTitle(event.target.value)} /><input className={input} dir="ltr" placeholder="DOI أو رابط — أو اتركه للملاحظة" value={sourceReference} onChange={(event) => setSourceReference(event.target.value)} /></div>
            <textarea className={`${input} min-h-20 leading-relaxed`} placeholder="لماذا حفظته؟ ملاحظة قصيرة تكفي." value={sourceNote} onChange={(event) => setSourceNote(event.target.value)} />
            <div className="flex flex-wrap items-center gap-2"><input ref={fileRef} type="file" accept="application/pdf,.pdf" className="hidden" onChange={(event) => setSourceFile(event.target.files?.[0] || null)} /><button type="button" className={ghost} onClick={() => fileRef.current?.click()}>{sourceFile ? `PDF: ${sourceFile.name}` : 'إرفاق PDF خاص'}</button><button type="button" className={primary} disabled={sourceBusy} onClick={() => void saveSource()}>{sourceBusy ? 'أحلّل وأربط…' : 'احفظ في ذاكرتي'}</button><span className="text-[.68rem] text-soft">PDF يُحفظ في مساحة admin-only، لا في ملفات الموقع العامة.</span></div>
            {sourceNotice && <p className="text-[.72rem] leading-relaxed text-soft">{sourceNotice}</p>}
            {sourceMatches.length > 0 && <div className="grid gap-2 border-t border-hair pt-3">{sourceMatches.map((match) => {
              const row = sources.find((item) => item.id === match.id)
              const uses = usage[`personal:${match.id}`]?.length || 0
              return <div key={match.id} className="grid gap-1 rounded-lg border border-hair/80 px-3 py-2.5 md:grid-cols-[minmax(0,1fr)_auto] md:items-center"><div className="min-w-0"><strong className="block truncate text-[.76rem] text-ink">{match.title}</strong><span className="mt-1 block text-[.66rem] leading-relaxed text-soft">صلة {match.score}/100{uses ? ` · مستخدم في ${uses} مادة داخلية` : ''}{row?.year ? ` · ${row.year}` : ''}</span></div>{row && <select className="rounded-lg border border-hair bg-canvas px-2 py-1.5 text-[.66rem] text-soft" value={row.status} onChange={(event) => void updateSourceStatus(row, event.target.value as PersonalSourceStatus)}>{sourceStatuses.map((status) => <option key={status.value} value={status.value}>{status.label}</option>)}</select>}</div>
            })}</div>}
            {sources.length > 0 && <details className="group/library rounded-xl border border-hair/80 bg-wash px-3 py-2.5" data-personal-source-library="true">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-[.72rem] font-semibold text-soft"><span>إدارة المصادر المحفوظة</span><span className="text-accent transition-transform group-open/library:rotate-45">+</span></summary>
              <div className="mt-3 grid gap-2 border-t border-hair pt-3">
                <input className={input} placeholder="ابحث في مصادري الخاصة" value={sourceFilter} onChange={(event) => setSourceFilter(event.target.value)} />
                {filteredSources.map((row) => <div key={row.id} className="grid gap-1 border-b border-hair/70 py-2 last:border-0 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"><span className="min-w-0"><strong className="block truncate text-[.72rem] text-ink">{row.title}</strong><span className="mt-0.5 block truncate text-[.62rem] text-soft">{row.doi || row.url || row.reference || 'ملاحظة شخصية'}{usage[`personal:${row.id}`]?.length ? ` · ${usage[`personal:${row.id}`].length} مادة مرتبطة` : ''}</span></span><select className="rounded-lg border border-hair bg-canvas px-2 py-1.5 text-[.64rem] text-soft" value={row.status} onChange={(event) => void updateSourceStatus(row, event.target.value as PersonalSourceStatus)}>{sourceStatuses.map((status) => <option key={status.value} value={status.value}>{status.label}</option>)}</select></div>)}
                {filteredSources.length === 0 && <p className="text-[.68rem] text-soft">لا يوجد مصدر مطابق للبحث.</p>}
              </div>
            </details>}
          </div>
        </details>

        <details className="group/agenda rounded-xl border border-hair bg-canvas px-4 py-3" data-intellectual-agenda="true">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3"><span><strong className="text-[.82rem] text-ink">الأجندة الفكرية الخاصة</strong>{idea.trim() && <span className="ms-2 text-[.68rem] text-soft">{agendaAlignment.score == null ? 'لم تُحدد بعد' : `اتساق الفكرة ${agendaAlignment.score}/100`}</span>}</span><span className="text-accent transition-transform group-open/agenda:rotate-45">+</span></summary>
          <div className="mt-4 grid gap-3 border-t border-hair pt-4">
            <input className={input} placeholder="قضية أريد أن أبني حولها مشروعي الفكري" value={agendaTitle} onChange={(event) => setAgendaTitle(event.target.value)} />
            <textarea className={`${input} min-h-16 leading-relaxed`} placeholder="ما الذي أريد فهمه أو إثباته أو إعادة التفكير فيه؟" value={agendaNote} onChange={(event) => setAgendaNote(event.target.value)} />
            <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-center"><select className={input} value={agendaStatus} onChange={(event) => setAgendaStatus(event.target.value as IntellectualAgendaStatus)}>{agendaStatuses.map((status) => <option key={status.value} value={status.value}>{status.label}</option>)}</select><select className={input} value={agendaPriority} onChange={(event) => setAgendaPriority(Number(event.target.value) as 1 | 2 | 3 | 4 | 5)}><option value={5}>أولوية 5 — محوري</option><option value={4}>أولوية 4</option><option value={3}>أولوية 3</option><option value={2}>أولوية 2</option><option value={1}>أولوية 1 — استكشافي</option></select><button type="button" className={primary} disabled={agendaBusy || agendaTitle.trim().length < 3} onClick={() => void saveAgenda()}>{agendaBusy ? 'أحفظ…' : 'أضف للأجندة'}</button></div>
            {agendaAlignment.matches.length > 0 && <div className="grid gap-2 border-t border-hair pt-3">{agendaAlignment.matches.map((match) => <div key={match.id} className="flex items-baseline justify-between gap-4"><span className="text-[.74rem] text-ink">{match.title}</span><span className="shrink-0 text-[.64rem] text-soft">صلة {match.score}/100 · أولوية {match.priority}</span></div>)}</div>}
            {agenda.length > 0 && <details className="group/agenda-list rounded-xl border border-hair/80 bg-wash px-3 py-2.5" data-intellectual-agenda-list="true">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-[.72rem] font-semibold text-soft"><span>مساراتي المحفوظة</span><span className="text-accent transition-transform group-open/agenda-list:rotate-45">+</span></summary>
              <div className="mt-3 grid gap-2 border-t border-hair pt-3">{agenda.slice(0, 24).map((item) => <div key={item.id} className="grid gap-2 border-b border-hair/70 py-2 last:border-0 lg:grid-cols-[minmax(0,1fr)_11rem_9rem] lg:items-center"><span className="min-w-0"><strong className="block truncate text-[.72rem] text-ink">{item.title}</strong>{item.note && <span className="mt-0.5 block line-clamp-1 text-[.62rem] text-soft">{item.note}</span>}</span><select className="rounded-lg border border-hair bg-canvas px-2 py-1.5 text-[.64rem] text-soft" value={item.status} onChange={(event) => void updateAgendaItem(item, { status: event.target.value as IntellectualAgendaStatus })}>{agendaStatuses.map((status) => <option key={status.value} value={status.value}>{status.label}</option>)}</select><select className="rounded-lg border border-hair bg-canvas px-2 py-1.5 text-[.64rem] text-soft" value={item.priority} onChange={(event) => void updateAgendaItem(item, { priority: Number(event.target.value) as 1 | 2 | 3 | 4 | 5 })}>{[5,4,3,2,1].map((value) => <option key={value} value={value}>أولوية {value}</option>)}</select></div>)}</div>
            </details>}
          </div>
        </details>
      </div>
    </details>
  )
}
