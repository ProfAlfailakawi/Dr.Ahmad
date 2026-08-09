import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildContentIndex, normalizeArabic } from '../whatsapp-agent/content-index.mjs'
import { buildSimilarityGraph } from '../src/lib/archive-scale.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const bookKnowledgeFile = path.join(root, 'src', 'data', 'book-knowledge.json')
const bookKnowledge = fs.existsSync(bookKnowledgeFile) ? JSON.parse(fs.readFileSync(bookKnowledgeFile, 'utf8')) : { books: [] }
const bookKnowledgeBySlug = new Map((bookKnowledge.books || []).map((book) => [book.slug, book]))
const stop = new Set('من في على الى عن هذا هذه ذلك التي الذي مع او ثم ما ماذا كيف هل لم لن قد كل بين عند بعد قبل عبر نحو حول داخل خارج'.split(' '))
const tok = (value) => [...new Set(normalizeArabic(String(value || '')).split(' ').filter((x) => x.length > 2 && !stop.has(x)))].slice(0, 140)
const overlap = (a, b) => { const bs = new Set(b); return a.filter((x) => bs.has(x)).length }
const yearOf = (value) => String(value || '').match(/(?:19|20)\d{2}/)?.[0] || ''
const addEdge = (edges, from, to, score, reasons = []) => { edges.push({ from, to, score, reasons }); edges.push({ from: to, to: from, score, reasons }) }

function baseNodes() {
  const items = buildContentIndex(root)
  const nodes = items.map((item) => {
    const book = item.kind === 'book' ? bookKnowledgeBySlug.get(item.slug) : null
    const bookText = book
      ? `${book.role || ''} ${(book.topTerms || []).join(' ')} ${(book.concepts || []).flatMap((concept) => [concept.title, ...(concept.keywords || [])]).join(' ')}`
      : ''
    const bookAxes = book ? (book.concepts || []).slice(0, 8).map((concept) => concept.title).join(' · ') : ''
    return {
      id: item.id,
      kind: item.kind,
      slug: item.slug,
      title: item.title,
      excerpt: `${String(item.excerpt || '')}${bookAxes ? ` · محاور من المتن: ${bookAxes}` : ''}`.slice(0, 900),
      url: item.url,
      year: yearOf(item.date),
      tokens: tok(`${item.title} ${item.excerpt} ${bookText} ${item.body} ${item.keywords}`),
    }
  })

  const audioNodes = []
  for (const item of items) {
    if (!item.audio || typeof item.audio !== 'object') continue
    for (const [mode, present] of Object.entries(item.audio)) {
      if (!present || mode === 'duration') continue
      const label = mode === 'dialogue' ? 'حوار صوتي' : mode === 'reading' ? 'قراءة صوتية' : mode === 'fahed' ? 'قراءة فهد' : mode === 'noura' ? 'قراءة نورة' : `صوت ${mode}`
      audioNodes.push({
        id: `audio:${item.slug}:${mode}`,
        kind: 'audio',
        slug: `${item.slug}-${mode}`,
        title: `${label}: ${item.title}`,
        excerpt: `امتداد صوتي للمادة «${item.title}».`,
        url: item.url,
        linkedTo: item.id,
        year: yearOf(item.date),
        tokens: tok(`${item.title} ${item.excerpt} ${item.keywords} ${label}`),
      })
    }
  }
  return [...nodes, ...audioNodes]
}

function glossaryNodes() {
  const file = path.join(root, 'src', 'data', 'dr-ahmad-domain-glossary.json')
  if (!fs.existsSync(file)) return []
  const rows = JSON.parse(fs.readFileSync(file, 'utf8'))
  return Array.isArray(rows) ? rows.map((entry) => ({
    id: `concept:${entry.id}`,
    kind: 'concept',
    slug: entry.id,
    title: entry.canonicalAr || entry.canonicalEn || entry.id,
    excerpt: String(entry.meaningAr || '').slice(0, 900),
    url: '',
    tokens: tok(`${entry.canonicalAr} ${entry.canonicalEn} ${(entry.aliases || []).join(' ')} ${entry.domain} ${entry.meaningAr}`),
  })) : []
}

async function liveSocialNodes() {
  try {
    const serviceAccountPath = String(process.env.FIREBASE_SERVICE_ACCOUNT || '').trim()
    const inline = String(process.env.GOOGLE_SA_JSON || '').trim()
    if (!inline && (!serviceAccountPath || !fs.existsSync(serviceAccountPath))) return []
    const [{ cert, getApps, initializeApp }, { getFirestore }] = await Promise.all([import('firebase-admin/app'), import('firebase-admin/firestore')])
    const credentials = inline ? JSON.parse(inline) : JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'))
    const projectId = String(process.env.FIREBASE_PROJECT_ID || credentials.project_id || 'drahmad-8e9e2')
    const app = getApps()[0] || initializeApp({ credential: cert(credentials), projectId })
    const db = getFirestore(app)
    let snapshot
    try { snapshot = await db.collection('social_queue').orderBy('createdAt', 'desc').limit(180).get() }
    catch { snapshot = await db.collection('social_queue').limit(180).get() }
    return snapshot.docs.map((document) => {
      const data = document.data() || {}
      const postText = Object.values(data.posts || {}).flat().map(String).join(' ')
      const title = String(data.articleTitle || data.idea || 'منشور مستقل').trim()
      return {
        id: `social:${document.id}`,
        kind: 'social',
        slug: document.id,
        title,
        excerpt: `${data.idea || ''} ${postText}`.slice(0, 1_200),
        url: '/admin?tab=studio',
        year: yearOf(data.createdAt?.toDate?.()?.toISOString?.() || data.createdAt || ''),
        tokens: tok(`${title} ${data.idea || ''} ${postText}`),
      }
    })
  } catch (error) {
    console.warn(`Knowledge graph: live social layer skipped (${error instanceof Error ? error.message : String(error)})`)
    return []
  }
}

function buildEdges(nodes) {
  const edges = []
  const byId = new Map(nodes.map((node, index) => [node.id, { node, index }]))
  const directKeys = new Set()
  for (const node of nodes) {
    if (!node.linkedTo || !byId.has(node.linkedTo)) continue
    addEdge(edges, node.id, node.linkedTo, 100, ['امتداد مباشر للمادة نفسها'])
    directKeys.add(`${node.id}>${node.linkedTo}`)
    directKeys.add(`${node.linkedTo}>${node.id}`)
  }

  /* Archive 2036: no quadratic all-pairs walk. Rare token postings create a
     bounded candidate neighborhood for each node, then the existing semantic
     scoring is applied only inside that pocket. 100k nodes stay practical. */
  const similar = buildSimilarityGraph(nodes, {
    getText: (node) => `${node.title || ''} ${node.excerpt || ''} ${(node.tokens || []).join(' ')}`,
    getTitle: (node) => node.title || '',
    getKind: (node) => node.kind || '',
    maxNeighbors: 18,
    maxCandidates: 360,
    maxCandidateTokens: 8,
    maxPostingRatio: .018,
    maxPostingAbsolute: 1200,
    minScore: 8,
    conceptKind: 'concept',
  })
  for (const edge of similar) {
    const from = nodes[edge.from]?.id
    const to = nodes[edge.to]?.id
    if (!from || !to || directKeys.has(`${from}>${to}`)) continue
    edges.push({ from, to, score: edge.score, reasons: edge.reasons })
  }

  edges.sort((a, b) => b.score - a.score)
  const perNode = new Map()
  return edges.filter((edge) => {
    /* Direct material links always survive. Similarity remains capped so the
       browser never receives a giant graph even when the archive reaches 100k. */
    if (edge.score >= 100) return true
    const count = perNode.get(edge.from) || 0
    if (count >= 18) return false
    perNode.set(edge.from, count + 1)
    return true
  })
}

function buildLegacyProfile(nodes, edges, builtAt) {
  const byId = new Map(nodes.map((node) => [node.id, node]))
  const byFrom = new Map()
  for (const edge of edges) {
    const list = byFrom.get(edge.from) || []
    list.push(edge)
    byFrom.set(edge.from, list)
  }
  const contentKinds = new Set(['article', 'book', 'paper', 'curated', 'podcast', 'social', 'media'])
  const themes = []
  for (const concept of nodes.filter((node) => node.kind === 'concept')) {
    const links = (byFrom.get(concept.id) || [])
      .map((edge) => ({ edge, node: byId.get(edge.to) }))
      .filter((row) => row.node && contentKinds.has(row.node.kind))
    if (!links.length) continue
    const unique = new Map()
    for (const row of links) {
      const current = unique.get(row.node.id)
      if (!current || row.edge.score > current.edge.score) unique.set(row.node.id, row)
    }
    const supported = [...unique.values()]
    const years = [...new Set(supported.map((row) => row.node.year).filter(Boolean))].sort()
    const kinds = [...new Set(supported.map((row) => row.node.kind))]
    themes.push({
      id: concept.id,
      title: concept.title,
      support: supported.length,
      score: supported.reduce((sum, row) => sum + Number(row.edge.score || 0), 0),
      kinds,
      years,
      firstYear: years[0] || '',
      lastYear: years.at(-1) || '',
      examples: supported.sort((a, b) => b.edge.score - a.edge.score).slice(0, 4).map((row) => ({ id: row.node.id, kind: row.node.kind, title: row.node.title, url: row.node.url, year: row.node.year || '' })),
    })
  }
  themes.sort((a, b) => b.support - a.support || b.score - a.score)

  const representatives = nodes
    .filter((node) => contentKinds.has(node.kind))
    .map((node) => {
      const links = byFrom.get(node.id) || []
      const concepts = links.map((edge) => byId.get(edge.to)).filter((linked) => linked?.kind === 'concept')
      const kindSpread = new Set(links.map((edge) => byId.get(edge.to)?.kind).filter(Boolean)).size
      const centrality = links.reduce((sum, edge) => sum + Number(edge.score || 0), 0) + concepts.length * 7 + kindSpread * 4
      return { id: node.id, kind: node.kind, title: node.title, url: node.url, year: node.year || '', centrality, concepts: concepts.slice(0, 4).map((item) => item.title) }
    })
    .sort((a, b) => b.centrality - a.centrality)
    .slice(0, 10)

  const timelineMap = new Map()
  for (const node of nodes.filter((item) => contentKinds.has(item.kind) && item.year)) {
    const row = timelineMap.get(node.year) || { year: node.year, count: 0, kinds: {}, titles: [] }
    row.count += 1
    row.kinds[node.kind] = (row.kinds[node.kind] || 0) + 1
    if (row.titles.length < 5) row.titles.push({ id: node.id, kind: node.kind, title: node.title, url: node.url })
    timelineMap.set(node.year, row)
  }
  const timeline = [...timelineMap.values()].sort((a, b) => a.year.localeCompare(b.year))
  const arcs = themes
    .filter((theme) => theme.firstYear && theme.lastYear && theme.firstYear !== theme.lastYear)
    .sort((a, b) => Number(b.lastYear) - Number(a.lastYear) || b.support - a.support)
    .slice(0, 8)
    .map((theme) => ({ id: theme.id, title: theme.title, firstYear: theme.firstYear, lastYear: theme.lastYear, support: theme.support, examples: theme.examples }))

  return {
    version: 1,
    builtAt,
    note: 'وضع الإرث يصف الأنماط الموثقة في الأرشيف فقط؛ لا يفترض موقفاً أو تحولاً غير مسجل في المواد.',
    stats: { themes: themes.length, representatives: representatives.length, years: timeline.length },
    themes: themes.slice(0, 12),
    representatives,
    timeline,
    arcs,
  }
}

const nodes = [...baseNodes(), ...glossaryNodes(), ...(await liveSocialNodes())]
const edges = buildEdges(nodes)
const kinds = Object.fromEntries([...new Set(nodes.map((node) => node.kind))].sort().map((kind) => [kind, nodes.filter((node) => node.kind === kind).length]))
const builtAt = new Date().toISOString()
const stats = { nodes: nodes.length, directedEdges: edges.length, kinds }
const graph = { version: 2, builtAt, nodes, edges, stats }
const browserIndex = {
  version: 2,
  builtAt,
  stats,
  nodes: nodes.map((node) => ({
    id: node.id,
    kind: node.kind,
    slug: node.slug,
    title: node.title,
    excerpt: String(node.excerpt || '').slice(0, 520),
    url: node.url,
    linkedTo: node.linkedTo,
    year: node.year || '',
    tokens: (node.tokens || []).slice(0, 80),
  })),
}
/* ── اكتب ثم اقرأ ما كتبتَ ──
   نسخة `knowledge-graph.json` المرفوعة في المستودع كانت **مبتورة**: ١٬٩٩٩٬٥٧١
   بايتاً من ستة ملايين، تنتهي في منتصف نصٍّ مفتوح. فكان `npm run
   nuclear:self-test` — وهو أحد فاحصات ما قبل الرفع — يسقط عند أول سطرٍ فيه
   بـSyntaxError، أي أنّ ذلك الفاحص كان **معطَّلاً بلا أن يعلم أحد**. ولأن
   البتر لا يصدر عنه خطأ (الكتابة «نجحت»)، لا يُكشف إلا بقراءة الناتج. */
function writeJsonVerified(relativePath, payload) {
  const target = path.join(root, relativePath)
  fs.writeFileSync(target, payload)
  const written = fs.readFileSync(target, 'utf8')
  try { JSON.parse(written) } catch (error) {
    throw new Error(`${relativePath}: الملف المكتوب لا يُقرأ JSON (${written.length} حرفاً) — ${error.message}`)
  }
}
writeJsonVerified('src/data/knowledge-graph.json', `${JSON.stringify(graph, null, 2)}\n`)
writeJsonVerified('src/data/knowledge-graph-index.json', `${JSON.stringify(browserIndex)}\n`)
/* صفحة القراءة لا تبني الخريطة التربيعية ولا تحمل الستة ميغابايت. نشتق أثناء
   البناء جيوب الجوار التي تحتاجها «حياة هذه الفكرة» فقط، من الحواف نفسها التي
   يغذي بها graphNeighbors العقل الحي. */
const byId = new Map(nodes.map((node) => [node.id, node]))
const graphEdgesByFrom = new Map()
for (const edge of edges) {
  const list = graphEdgesByFrom.get(edge.from) || []
  list.push(edge)
  graphEdgesByFrom.set(edge.from, list)
}
const articleGraphNeighbors = Object.fromEntries(nodes
  .filter((node) => node.kind === 'article')
  .map((node) => [node.id, (graphEdgesByFrom.get(node.id) || [])
    .filter((edge) => ['article', 'book', 'paper', 'media'].includes(byId.get(edge.to)?.kind || ''))
    .slice(0, 5)
    .map((edge) => {
      const neighbor = byId.get(edge.to)
      return neighbor ? {
        id: neighbor.id,
        kind: neighbor.kind,
        slug: neighbor.slug,
        title: neighbor.title,
        excerpt: String(neighbor.excerpt || '').slice(0, 170),
        url: neighbor.url,
        year: neighbor.year || '',
        score: edge.score,
        reasons: edge.reasons,
        /* نوع الصلة يُحسم وقت البناء من الدليل نفسه. لا نخمن «تضاداً» من
           كلمةٍ عابرة داخل عنوانين في المتصفح. */
        relation: (edge.reasons || []).some((reason) => /امتداد|مباشر/u.test(reason)) ? 'امتداد' : 'سياق',
        reason: (edge.reasons || [])[0] || 'قرابة موضوعية محسوبة من الأرشيف',
      } : null
    })
    .filter(Boolean)]))
writeJsonVerified('src/data/article-graph-neighbors.json', `${JSON.stringify({ version: 2, builtAt, neighbors: articleGraphNeighbors })}\n`)
const legacyProfile = buildLegacyProfile(nodes, edges, builtAt)
writeJsonVerified('src/data/legacy-profile.json', `${JSON.stringify(legacyProfile, null, 2)}\n`)
console.log(`Knowledge graph v2: ${nodes.length} nodes / ${edges.length} directed edges — ${Object.entries(kinds).map(([kind, count]) => `${kind}:${count}`).join(' · ')} · legacy:${legacyProfile.themes.length} themes/${legacyProfile.timeline.length} years`)
