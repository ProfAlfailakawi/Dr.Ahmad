import type { ArticleRecord, BookRecord, MediaRecord, PaperRecord } from './cms'
import { bookKnowledgeText } from './book-knowledge'
import { buildSmartQueryPlan, scoreSmartFields, smartRoots } from './smart-search'

export type KnowledgeKind = 'article' | 'book' | 'paper' | 'media' | 'curated' | 'podcast' | 'audio' | 'social' | 'concept'
export type KnowledgeNode = {
  id: string
  kind: KnowledgeKind
  slug: string
  title: string
  text: string
  url: string
  year?: string
  tokens: string[]
}
export type KnowledgeEdge = { from: string; to: string; score: number; reasons: string[] }
export type KnowledgeGraph = {
  version: 1 | 2
  builtAt: string
  nodes: KnowledgeNode[]
  edges: KnowledgeEdge[]
  byId: Record<string, KnowledgeNode>
  neighbors: Record<string, KnowledgeEdge[]>
}

const tokens = (value: string) => [...new Set(smartRoots(value))].slice(0, 180)
const overlap = (left: string[], right: string[]) => {
  const rightSet = new Set(right)
  return left.filter((item) => rightSet.has(item)).length
}
const node = (kind: KnowledgeKind, item: { slug: string; title: string; year?: string; iso?: string }, text: string, url: string): KnowledgeNode => ({
  id: `${kind}:${item.slug}`,
  kind,
  slug: item.slug,
  title: item.title,
  text,
  url,
  year: String(item.year || item.iso || '').slice(0, 4) || undefined,
  tokens: tokens(`${item.title} ${text}`),
})

export function buildKnowledgeGraph(input: { articles: ArticleRecord[]; books: BookRecord[]; papers: PaperRecord[]; media?: MediaRecord[] }): KnowledgeGraph {
  const nodes: KnowledgeNode[] = [
    ...input.articles.map((item) => node(
      'article',
      item,
      `${item.cat || ''} ${item.excerpt || ''} ${item.body || ''}`,
      `/articles/${item.slug}`,
    )),
    ...input.books.map((item) => node(
      'book',
      item,
      `${item.desc || ''} ${item.longDescription || ''} ${item.targetAudience || ''} ${item.whyWritten || ''} ${item.toc || ''} ${bookKnowledgeText(item.slug)}`,
      `/publications/${item.slug}`,
    )),
    ...input.papers.map((item) => node(
      'paper',
      { ...item, title: item.titleAr || item.title },
      `${item.abstractAr || ''} ${item.meta || ''} ${item.journal || ''} ${item.keywords || ''} ${item.researchQuestion || ''} ${item.keyFinding || ''} ${item.contribution || ''} ${item.applications || ''} ${item.limitations || ''} ${item.methodology || ''} ${item.analysisText || ''} ${item.pdfText || ''}`,
      `/research/${item.slug}`,
    )),
    ...(input.media || []).map((item) => node(
      'media',
      item,
      `${item.outlet || ''} ${item.program || ''} ${item.channel || ''} ${item.topics || ''} ${item.transcript || ''}`,
      `/media/${item.slug}`,
    )),
  ].filter((item) => item.slug)

  const edges: KnowledgeEdge[] = []
  for (let leftIndex = 0; leftIndex < nodes.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < nodes.length; rightIndex += 1) {
      const left = nodes[leftIndex]
      const right = nodes[rightIndex]
      const common = overlap(left.tokens, right.tokens)
      const titleCommon = overlap(tokens(left.title), tokens(right.title))
      const crossKind = left.kind !== right.kind ? 1 : 0
      const score = common * 2 + titleCommon * 5 + crossKind + (left.year && left.year === right.year ? 1 : 0)
      if (score < 7) continue
      const reasons = [
        titleCommon ? 'تقاطع مباشر في العنوان' : '',
        common >= 4 ? 'محور معرفي مشترك' : '',
        crossKind ? 'امتداد بين نوعين من المحتوى' : '',
      ].filter(Boolean)
      edges.push({ from: left.id, to: right.id, score, reasons })
      edges.push({ from: right.id, to: left.id, score, reasons })
    }
  }

  edges.sort((left, right) => right.score - left.score)
  const byId = Object.fromEntries(nodes.map((item) => [item.id, item]))
  const neighbors: Record<string, KnowledgeEdge[]> = {}
  for (const edge of edges) (neighbors[edge.from] ||= []).push(edge)
  for (const key of Object.keys(neighbors)) neighbors[key] = neighbors[key].slice(0, 12)
  return { version: 2, builtAt: new Date().toISOString(), nodes, edges, byId, neighbors }
}

export function graphSearch(graph: KnowledgeGraph, query: string, limit = 20) {
  const plan = buildSmartQueryPlan(query)
  return graph.nodes
    .map((item) => ({
      node: item,
      score: scoreSmartFields(plan, [
        { value: item.title, weight: 4.8, phraseWeight: 1.5, exactWeight: 1.5 },
        { value: item.text, weight: 1.15, phraseWeight: 1.05 },
      ]),
    }))
    .filter((item) => item.score > 4)
    .sort((left, right) => right.score - left.score || String(right.node.year || '').localeCompare(String(left.node.year || '')))
    .slice(0, limit)
}

export function graphNeighbors(graph: KnowledgeGraph, id: string, limit = 6) {
  return (graph.neighbors[id] || [])
    .slice(0, limit)
    .map((edge) => ({ edge, node: graph.byId[edge.to] }))
    .filter((item) => item.node)
}
