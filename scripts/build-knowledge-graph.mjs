import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildContentIndex, normalizeArabic } from '../whatsapp-agent/content-index.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const stop = new Set('من في على الى عن هذا هذه ذلك التي الذي مع او ثم ما ماذا كيف هل لم لن قد كل بين عند بعد قبل عبر نحو حول داخل خارج'.split(' '))
const tok = (value) => [...new Set(normalizeArabic(String(value || '')).split(' ').filter((x) => x.length > 2 && !stop.has(x)))].slice(0, 140)
const overlap = (a, b) => { const bs = new Set(b); return a.filter((x) => bs.has(x)).length }
const addEdge = (edges, from, to, score, reasons = []) => { edges.push({ from, to, score, reasons }); edges.push({ from: to, to: from, score, reasons }) }

function baseNodes() {
  const items = buildContentIndex(root)
  const nodes = items.map((item) => ({
    id: item.id,
    kind: item.kind,
    slug: item.slug,
    title: item.title,
    excerpt: String(item.excerpt || '').slice(0, 900),
    url: item.url,
    tokens: tok(`${item.title} ${item.excerpt} ${item.body} ${item.keywords}`),
  }))

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
  const byId = new Map(nodes.map((node) => [node.id, node]))
  for (const node of nodes) {
    if (node.linkedTo && byId.has(node.linkedTo)) addEdge(edges, node.id, node.linkedTo, 100, ['امتداد مباشر للمادة نفسها'])
  }
  for (let i = 0; i < nodes.length; i += 1) for (let j = i + 1; j < nodes.length; j += 1) {
    const a = nodes[i], b = nodes[j]
    if (a.linkedTo === b.id || b.linkedTo === a.id) continue
    const common = overlap(a.tokens || [], b.tokens || [])
    if (!common) continue
    const titleCommon = overlap(tok(a.title), tok(b.title))
    const conceptBridge = a.kind === 'concept' || b.kind === 'concept'
    const crossKind = a.kind !== b.kind
    const score = common * (conceptBridge ? 3 : 2) + titleCommon * 6 + (crossKind ? 1 : 0)
    const threshold = conceptBridge ? 6 : 8
    if (score < threshold) continue
    const reasons = [titleCommon ? 'تقاطع مباشر في العنوان' : '', conceptBridge ? 'صلة بمفهوم من قاموس د. أحمد' : '', common >= 4 ? 'محور معرفي مشترك' : '', crossKind ? 'امتداد بين نوعين من المحتوى' : ''].filter(Boolean)
    addEdge(edges, a.id, b.id, score, reasons)
  }
  // لا نُحمّل المتصفح شبكة O(n²) كاملة. نحتفظ بأقوى 18 صلة لكل عقدة؛
  // هذا يحفظ المعنى والروابط المباشرة ويمنع تضخم JSON إلى عشرات الميغابايت.
  edges.sort((a, b) => b.score - a.score)
  const perNode = new Map()
  return edges.filter((edge) => {
    const count = perNode.get(edge.from) || 0
    if (count >= 18) return false
    perNode.set(edge.from, count + 1)
    return true
  })
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
    tokens: (node.tokens || []).slice(0, 80),
  })),
}
fs.writeFileSync(path.join(root, 'src/data/knowledge-graph.json'), `${JSON.stringify(graph, null, 2)}\n`)
fs.writeFileSync(path.join(root, 'src/data/knowledge-graph-index.json'), `${JSON.stringify(browserIndex)}\n`)
console.log(`Knowledge graph v2: ${nodes.length} nodes / ${edges.length} directed edges — ${Object.entries(kinds).map(([kind, count]) => `${kind}:${count}`).join(' · ')}`)
