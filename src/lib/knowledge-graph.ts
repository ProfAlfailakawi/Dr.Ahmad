import type { ArticleRecord, BookRecord, MediaRecord, PaperRecord } from './cms'
import { bookKnowledgeText } from './book-knowledge'
import { buildSmartQueryPlan, scoreSmartFields, smartRoots } from './smart-search.ts'
import { buildSearchPostings, buildSimilarityGraph, searchPostingCandidates } from './archive-scale.mjs'

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
const node = (kind: KnowledgeKind, item: { slug: string; title: string; year?: string; iso?: string }, text: string, url: string, includeTokens = true): KnowledgeNode => ({
  id: `${kind}:${item.slug}`,
  kind,
  slug: item.slug,
  title: item.title,
  text,
  url,
  year: String(item.year || item.iso || '').slice(0, 4) || undefined,
  tokens: includeTokens ? tokens(`${item.title} ${text}`) : [],
})

export function buildKnowledgeGraph(input: { articles: ArticleRecord[]; books: BookRecord[]; papers: PaperRecord[]; media?: MediaRecord[] }, options: { edges?: boolean; tokenize?: boolean } = {}): KnowledgeGraph {
  const includeTokens = options.tokenize !== false
  const nodes: KnowledgeNode[] = [
    ...input.articles.map((item) => node(
      'article',
      item,
      `${item.cat || ''} ${item.excerpt || ''} ${item.body || ''}`,
      `/articles/${item.slug}`,
      includeTokens,
    )),
    ...input.books.map((item) => node(
      'book',
      item,
      `${item.desc || ''} ${item.longDescription || ''} ${item.targetAudience || ''} ${item.whyWritten || ''} ${item.toc || ''} ${bookKnowledgeText(item.slug)}`,
      `/publications/${item.slug}`,
      includeTokens,
    )),
    ...input.papers.map((item) => node(
      'paper',
      { ...item, title: item.titleAr || item.title },
      `${item.abstractAr || ''} ${item.meta || ''} ${item.journal || ''} ${item.keywords || ''} ${item.researchQuestion || ''} ${item.keyFinding || ''} ${item.contribution || ''} ${item.applications || ''} ${item.limitations || ''} ${item.methodology || ''} ${item.analysisText || ''} ${item.pdfText || ''}`,
      `/research/${item.slug}`,
      includeTokens,
    )),
    ...(input.media || []).map((item) => node(
      'media',
      item,
      `${item.outlet || ''} ${item.program || ''} ${item.channel || ''} ${item.topics || ''} ${item.transcript || ''}`,
      `/media/${item.slug}`,
      includeTokens,
    )),
  ].filter((item) => item.slug)

  /* Archive 2036: the old nested node×node comparison was O(n²), which turns
     100k items into ~5 billion pairs. Rare-token postings now narrow each node
     to a bounded candidate pocket before scoring; semantic quality is kept,
     while work grows approximately linearly with archive size. */
  const compactEdges = options.edges === false ? [] : buildSimilarityGraph(nodes, {
    getText: (item: KnowledgeNode) => `${item.title} ${item.text}`,
    getTitle: (item: KnowledgeNode) => item.title,
    getKind: (item: KnowledgeNode) => item.kind,
    maxNeighbors: 12,
    maxCandidates: 320,
    maxCandidateTokens: 8,
    minScore: 7,
  })
  const edges: KnowledgeEdge[] = compactEdges.map((edge) => ({
    from: nodes[edge.from].id,
    to: nodes[edge.to].id,
    score: edge.score,
    reasons: edge.reasons,
  }))
  edges.sort((left, right) => right.score - left.score)
  const byId = Object.fromEntries(nodes.map((item) => [item.id, item]))
  const neighbors: Record<string, KnowledgeEdge[]> = {}
  for (const edge of edges) (neighbors[edge.from] ||= []).push(edge)
  for (const key of Object.keys(neighbors)) neighbors[key] = neighbors[key].slice(0, 12)
  return { version: 2, builtAt: new Date().toISOString(), nodes, edges, byId, neighbors }
}

const graphSearchPostings = new WeakMap<KnowledgeGraph, Map<string, Uint32Array>>()

function postingsForGraph(graph: KnowledgeGraph) {
  let postings = graphSearchPostings.get(graph)
  if (!postings) {
    postings = buildSearchPostings(graph.nodes, {
      getText: (item: KnowledgeNode) => `${item.title} ${item.text} ${item.tokens.join(' ')}`,
      maxTokensPerItem: 96,
    })
    graphSearchPostings.set(graph, postings)
  }
  return postings
}

export function graphVocabulary(graph: KnowledgeGraph, limit = 30_000) {
  const output: string[] = []
  for (const token of postingsForGraph(graph).keys()) {
    output.push(token)
    if (output.length >= limit) break
  }
  return output
}

export function graphSearch(graph: KnowledgeGraph, query: string, limit = 20) {
  const plan = buildSmartQueryPlan(query)
  const postings = postingsForGraph(graph)
  const candidates = searchPostingCandidates(postings, query, Math.max(240, limit * 24))
  const pool = candidates.length ? candidates.map((index) => graph.nodes[index]).filter((item): item is KnowledgeNode => Boolean(item)) : []
  return pool
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
