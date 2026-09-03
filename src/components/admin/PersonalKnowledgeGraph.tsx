import { useEffect, useMemo, useState } from 'react'
import graphData from '../../data/knowledge-graph-index.json'
import { getDb } from '../../lib/firebase'
import { interpretDrAhmadDomain, DR_AHMAD_GLOSSARY_CONCEPT_CAPACITY } from '../../lib/dr-ahmad-domain-glossary'
import { LegacyModePanel } from './LegacyModePanel'

type Node = { id: string; kind: string; slug?: string; title: string; url?: string; tokens?: string[]; excerpt?: string; linkedTo?: string }
type SocialNode = Node & { kind: 'social' }

const card = 'min-w-0 max-w-full rounded-2xl border border-hair bg-wash p-4 sm:p-5 md:p-6'
const input = 'w-full rounded-xl border border-hair bg-canvas px-4 py-3 text-[.92rem] text-ink outline-none transition-colors placeholder:text-soft/60 focus:border-accent'
const KIND_LABEL: Record<string, string> = {
  article: 'مقال', book: 'كتاب', paper: 'بحث', media: 'إعلام', curated: 'مختارات', podcast: 'صوت/بودكاست', audio: 'صوت', social: 'منشور', concept: 'مصطلح',
}
const KIND_ORDER = ['concept', 'article', 'book', 'paper', 'podcast', 'audio', 'social', 'media', 'curated']
const normalize = (value = '') => value.toLowerCase().replace(/[\u064B-\u065F\u0670]/g, '').replace(/[أإآٱ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه').replace(/[ؤئ]/g, 'ء').replace(/[^\p{L}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim()
const words = (value = '') => [...new Set(normalize(value).split(' ').filter((word) => word.length > 2))]

function scoreNode(node: Node, query: string) {
  const q = words(query)
  if (!q.length) return 0
  const title = words(node.title)
  const nodeTokens = Array.isArray(node.tokens) ? node.tokens.map(normalize) : words(`${node.title} ${node.excerpt || ''}`)
  const set = new Set(nodeTokens)
  const titleSet = new Set(title)
  return q.reduce((sum, token) => sum + (titleSet.has(token) ? 12 : set.has(token) ? 4 : nodeTokens.some((candidate) => candidate.startsWith(token) || token.startsWith(candidate)) ? 2 : 0), 0)
}

export function PersonalKnowledgeGraph() {
  const [query, setQuery] = useState(() => {
    if (typeof window === 'undefined') return 'الذكاء الاصطناعي في التعليم'
    try {
      const seed = sessionStorage.getItem('admin:knowledge-seed') || 'الذكاء الاصطناعي في التعليم'
      sessionStorage.removeItem('admin:knowledge-seed')
      return seed
    } catch { return 'الذكاء الاصطناعي في التعليم' }
  })
  const [social, setSocial] = useState<SocialNode[]>([])
  const [mode, setMode] = useState<'graph' | 'legacy'>('graph')
  const staticNodes = (graphData as { nodes?: Node[] }).nodes || []

  useEffect(() => {
    let active = true
    ;(async () => {
      try {
        const db = await getDb()
        if (!db) return
        const { collection, getDocs, limit, orderBy, query: firestoreQuery } = await import('firebase/firestore')
        const snapshot = await getDocs(firestoreQuery(collection(db, 'social_queue'), orderBy('createdAt', 'desc'), limit(120)))
        if (!active) return
        setSocial(snapshot.docs.map((document) => {
          const data = document.data() as { articleTitle?: string; idea?: string; posts?: Record<string, unknown>; source?: string }
          const text = Object.values(data.posts || {}).flat().map(String).join(' ')
          return { id: `social:${document.id}`, kind: 'social', title: data.articleTitle || data.idea || 'منشور مستقل', excerpt: `${data.idea || ''} ${text}`.slice(0, 2_000), tokens: words(`${data.articleTitle || ''} ${data.idea || ''} ${text}`), url: '/admin?tab=studio' }
        }))
      } catch { /* الرسم الثابت يبقى متاحاً */ }
    })()
    return () => { active = false }
  }, [])

  const allNodes = useMemo(() => [...staticNodes, ...social], [social, staticNodes])
  const understanding = useMemo(() => interpretDrAhmadDomain(query), [query])
  const results = useMemo(() => allNodes
    .map((node) => ({ node, score: scoreNode(node, query) }))
    .filter((row) => row.score > 0)
    .sort((a, b) => b.score - a.score || KIND_ORDER.indexOf(a.node.kind) - KIND_ORDER.indexOf(b.node.kind))
    .slice(0, 28), [allNodes, query])
  const grouped = useMemo(() => Object.fromEntries(KIND_ORDER.map((kind) => [kind, results.filter((row) => row.node.kind === kind).slice(0, 5)])), [results])
  const stats = useMemo(() => {
    const map = new Map<string, number>()
    allNodes.forEach((node) => map.set(node.kind, (map.get(node.kind) || 0) + 1))
    return map
  }, [allNodes])

  return (
    <section className={`${card} border-accent/20 bg-accent/[.025]`}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-[.76rem] font-semibold uppercase text-accent">Dr. Ahmad Knowledge Graph</p>
          <h2 className="mt-1 font-display text-2xl font-bold text-ink">عقل الأرشيف: الفكرة الواحدة ترى تاريخها كله.</h2>
          <p className="mt-2 max-w-3xl text-[.84rem] leading-relaxed text-soft">يربط المقالات والكتب والأبحاث والصوت والمنشورات والمصطلحات؛ لا يكتفي بكلمة مفتاحية، بل يستعين بالقاموس المتخصص ثم يبحث عن الامتدادات داخل أرشيفك.</p>
        </div>
        <div className="flex max-w-xl flex-wrap justify-end gap-2 text-[.68rem]">
          {['article','book','paper','podcast','audio','social','concept'].map((kind) => <span key={kind} className="rounded-full border border-hair bg-canvas px-3 py-1.5 text-soft">{KIND_LABEL[kind]} {stats.get(kind) || 0}</span>)}
        </div>
      </div>

      <div className="mt-5 flex w-fit rounded-full border border-hair bg-canvas p-1" role="tablist" aria-label="منظور عقل الأرشيف">
        <button type="button" role="tab" aria-selected={mode === 'graph'} onClick={() => setMode('graph')} className={`rounded-full px-4 py-2 text-[.74rem] font-semibold transition-colors ${mode === 'graph' ? 'bg-accent text-white' : 'text-soft hover:text-accent'}`}>عقل الأرشيف</button>
        <button type="button" role="tab" aria-selected={mode === 'legacy'} onClick={() => setMode('legacy')} className={`rounded-full px-4 py-2 text-[.74rem] font-semibold transition-colors ${mode === 'legacy' ? 'bg-accent text-white' : 'text-soft hover:text-accent'}`}>وضع الإرث</button>
      </div>

      {mode === 'legacy' ? <LegacyModePanel /> : <>
      <div className="mt-5 grid gap-3 lg:grid-cols-[minmax(0,1fr)_320px]">
        <input className={input} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="اكتب فكرة أو مصطلحاً: الواقع الافتراضي، بر الأبناء، الذكاء الاصطناعي…" />
        <div className="rounded-xl border border-hair bg-canvas px-4 py-3 text-[.76rem] leading-relaxed text-soft">
          <strong className="text-ink">القاموس:</strong> {understanding.primary?.canonicalAr || understanding.recognizedFrom || 'لا تطابق متخصص بعد'}
          <span className="mx-2">·</span>
          سعة تركيبية تتجاوز {DR_AHMAD_GLOSSARY_CONCEPT_CAPACITY.toLocaleString('en-US')} احتمالاً مفاهيمياً.
        </div>
      </div>

      {understanding.compoundMeaning && <div className="mt-3 rounded-xl border border-accent/20 bg-canvas p-4 text-[.82rem] leading-relaxed text-soft"><strong className="text-accent">الفهم المتخصص: </strong>{understanding.compoundMeaning}</div>}

      <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {KIND_ORDER.filter((kind) => grouped[kind]?.length).map((kind) => (
          <div key={kind} className="rounded-2xl border border-hair bg-canvas p-4">
            <div className="flex items-center justify-between gap-3">
              <strong className="font-display text-[1rem] text-ink">{KIND_LABEL[kind] || kind}</strong>
              <span className="text-[.68rem] text-soft">{grouped[kind].length} أقرب</span>
            </div>
            <div className="mt-3 grid gap-2">
              {grouped[kind].map(({ node, score }) => (
                node.url ? <a key={node.id} href={node.url} target={node.url.startsWith('/admin') ? undefined : '_blank'} rel="noreferrer" className="rounded-xl border border-hair px-3 py-2.5 transition-colors hover:border-accent/40">
                  <span className="block text-[.8rem] font-semibold leading-relaxed text-ink">{node.title}</span>
                  <span className="mt-1 block text-[.67rem] text-soft">صلة {score}</span>
                </a> : <div key={node.id} className="rounded-xl border border-hair px-3 py-2.5"><span className="block text-[.8rem] font-semibold leading-relaxed text-ink">{node.title}</span><span className="mt-1 block text-[.67rem] text-soft">صلة {score}</span></div>
              ))}
            </div>
          </div>
        ))}
      </div>
      {!results.length && <p className="mt-5 rounded-xl border border-hair bg-canvas p-4 text-[.82rem] text-soft">لم يجد الرسم صلة مباشرة بعد. جرّب صياغة أوسع؛ القاموس سيظل يحفظ المعنى المتخصص حتى عندما لا توجد مادة سابقة.</p>}
      </>}
    </section>
  )
}
