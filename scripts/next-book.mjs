#!/usr/bin/env node
/**
 * الكتاب العاشر — ما لم تجمعه في كتابٍ بعد.
 *
 * الفكرة: للدكتور ١٤٣ مقالاً وتسعة كتب. بعض محاور مقالاته صار كتاباً، وبعضها
 * تراكم عشر سنوات ولم يُجمع. هذا السكربت يجد الثاني: يعنقد المقالات بموضوعها،
 * ثم يطرح كل عنقودٍ على متون الكتب التسعة، فما غطّته الكتب يُستبعد، وما بقي
 * يُرتَّب بحجمه واتساع زمنه — ويخرج فهرساً جاهزاً مبنياً من مقالاته هو.
 *
 * ليس اقتراح موضوع؛ هو **مسوّدة كتاب**: عنوان، وفصول، وتحت كل فصل المقالات
 * التي تصلح مادةً له، مرتّبةً زمنياً.
 *
 * القاعدة: لا يخترع السكربت عنواناً ولا فكرة. كل ما يخرج منه مأخوذ من كلمات
 * مقالاته وعناوينها.
 *
 * التشغيل: node scripts/next-book.mjs [--top 3]
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const DATA = resolve(ROOT, 'src/data.ts')
const BODIES = resolve(ROOT, 'src/data/bodies.json')
const PASSAGES = resolve(ROOT, 'src/data/book-passages.json')
const KNOWLEDGE = resolve(ROOT, 'src/data/book-knowledge.json')
const OUT = resolve(ROOT, 'src/data/next-book.json')

const TOP = Number(process.argv[process.argv.indexOf('--top') + 1]) || 3

/* ═══ قراءة الأرشيف ═══ */
const dataText = readFileSync(DATA, 'utf8')
const articlesBlock = dataText.slice(
  dataText.indexOf('export const articles = ['),
  dataText.indexOf('export const articlesWithBody'),
)
const pick = (block, key) => block.match(new RegExp(`${key}:\\s*'((?:[^'\\\\]|\\\\.)*)'`))?.[1] || ''
/* السجلات مفصولة بسطر يبدأ بـ«  { slug:» — نقطعها عنده بدل مطابقة القوس
   المغلق، لأن المقتطفات تحوي أقواساً وفواصل تربك أي مطابقة متداخلة. */
const articles = articlesBlock
  .split(/\n(?=  \{ slug: ')/)
  .slice(1)
  .map((block) => ({
    slug: pick(block, 'slug'),
    title: pick(block, 'title'),
    excerpt: pick(block, 'excerpt'),
    cat: pick(block, 'cat'),
    iso: pick(block, 'iso'),
  }))
  .filter((item) => item.slug && item.title)

const bodies = existsSync(BODIES) ? JSON.parse(readFileSync(BODIES, 'utf8')) : {}
const passages = existsSync(PASSAGES) ? JSON.parse(readFileSync(PASSAGES, 'utf8')) : { books: [] }
const knowledge = existsSync(KNOWLEDGE) ? JSON.parse(readFileSync(KNOWLEDGE, 'utf8')) : { books: [] }

/* ═══ التطبيع والجذور ═══ */
const STOP = new Set(('في من على الى عن هذا هذه ذلك التي الذي مع كان كانت يكون تكون هو هي كل بعض بين عند بعد قبل ثم او ام لا ما هل قد نحن انا انت هم كما حيث لكن بل ايضا حتى لان لذلك عندما اليوم امس غدا شيء شيئا اشياء'
  + ' يجب يمكن قال قالت نقول يقول اقول عام سنة سنوات جدا كثير قليل نفس بعضها').split(' '))

const roots = (value = '') => String(value)
  .normalize('NFKC').toLowerCase().replace(/ـ+/g, '').replace(/[ً-ْٰ]/g, '')
  .replace(/[أإآٱ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه').replace(/[ؤئ]/g, 'ء')
  .replace(/[^\p{L}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim().split(' ')
  .map((word) => word
    .replace(/^(?:[وف])(?=[بكل]ال|ال)/u, '')
    .replace(/^لل(?=.{3,})/u, '')
    .replace(/^[بكل](?=ال.{3,})/u, '')
    .replace(/^ال(?=.{3,})/u, '')
    .replace(/^[وف](?=.{4,})/u, '')
    .replace(/(?:ات|ون|ين|ية|يه)$/u, ''))
  .filter((word) => word.length > 3 && !STOP.has(word))

/* ═══ ١) المفردات المحورية في الأرشيف ═══
   نقيس تكرار كل جذر في **عناوين** المقالات ومقتطفاتها — العنوان أدلّ من
   المتن لأن الدكتور يختاره ليقول موضوع المقال. */
/* الجذر «سءال» لا يُعرض لأحد. نحتفظ بأكثر صوره ظهوراً في كلام الدكتور
   («سؤال»)، فتخرج الفصول بلغته لا بلغة المُجذِّر. */
const surfaceOf = new Map()
const rememberSurface = (text = '') => {
  const words = String(text).split(/\s+/).filter(Boolean)
  for (const word of words) {
    const clean = word.replace(/[^\p{L}]/gu, '')
    if (clean.length < 4) continue
    const [root] = roots(clean)
    if (!root) continue
    const entry = surfaceOf.get(root) || new Map()
    entry.set(clean, (entry.get(clean) || 0) + 1)
    surfaceOf.set(root, entry)
  }
}
const surface = (root) => {
  const entry = surfaceOf.get(root)
  if (!entry) return root
  return [...entry.entries()].sort((left, right) => right[1] - left[1])[0][0]
}

for (const article of articles) rememberSurface(`${article.title} ${article.excerpt}`)

const docs = articles.map((article) => ({
  article,
  title: new Set(roots(article.title)),
  all: new Set([...roots(article.title), ...roots(article.excerpt), ...roots(String(bodies[article.slug] || '').slice(0, 4000))]),
}))

const frequency = new Map()
for (const doc of docs) {
  for (const word of doc.all) frequency.set(word, (frequency.get(word) || 0) + 1)
}

/* البذرة من العناوين وحدها: الدكتور يختار العنوان ليقول موضوع المقال، أما
   المتن فيمرّ بكلماتٍ كثيرة لا تدلّ على موضوعه. */
const titleFrequency = new Map()
for (const doc of docs) {
  for (const word of doc.title) titleFrequency.set(word, (titleFrequency.get(word) || 0) + 1)
}

/* ═══ ٢) تغطية الكتب ═══
   جذر ورد كثيراً في متون الكتب التسعة يعني أن الموضوع مطروق عنده أصلاً. */
const bookFrequency = new Map()
for (const book of passages.books || []) {
  for (const passage of book.passages || []) {
    for (const word of new Set(roots(passage.text))) {
      bookFrequency.set(word, (bookFrequency.get(word) || 0) + 1)
    }
  }
}
for (const book of knowledge.books || []) {
  for (const term of book.topTerms || []) {
    for (const word of roots(term)) bookFrequency.set(word, (bookFrequency.get(word) || 0) + 12)
  }
  for (const concept of book.concepts || []) {
    for (const word of roots(concept.title)) bookFrequency.set(word, (bookFrequency.get(word) || 0) + 8)
  }
}

/* ═══ ٣) العناقيد: بذرةٌ ثم ما يلتفّ حولها ═══ */
const seeds = [...titleFrequency.entries()]
  .filter(([word, count]) => count >= 5 && count <= 40)
  .map(([word, count]) => {
    const covered = bookFrequency.get(word) || 0
    /* الفجوة: حضورٌ قويّ في المقالات وغيابٌ في الكتب. */
    return { word, count, covered, gap: count / (1 + covered / 6) }
  })
  .sort((left, right) => right.gap - left.gap)

const used = new Set()
const clusters = []

for (const seed of seeds) {
  if (clusters.length >= TOP) break
  if (used.has(seed.word)) continue

  const members = docs.filter((doc) => doc.all.has(seed.word) && !used.has(doc.article.slug))
  if (members.length < 8) continue

  /* المفردات المرافقة: ما يتكرّر داخل العنقود ولا يتكرّر خارجه — هي التي
     تصلح فصولاً، لأنها تميّز هذا الموضوع عن سائر الأرشيف. */
  const inside = new Map()
  for (const doc of members) for (const word of doc.all) inside.set(word, (inside.get(word) || 0) + 1)

  /* عنوان الفصل لا بد أن يكون موضوعاً لا وصفاً: نشترط أن يكون قد ظهر في
     **عناوين** مقالين على الأقل، فتسقط «الكاذب» و«وإذا» ويبقى ما يسمّي
     موضوعاً فعلاً. */
  const inTitles = new Map()
  for (const doc of members) for (const word of doc.title) inTitles.set(word, (inTitles.get(word) || 0) + 1)

  const companions = [...inside.entries()]
    .filter(([word, count]) => word !== seed.word && count >= 3 && (inTitles.get(word) || 0) >= 2)
    .map(([word, count]) => {
      const outside = (frequency.get(word) || 0) - count
      const distinctive = count / (1 + outside / 4)
      return { word, count, distinctive, covered: bookFrequency.get(word) || 0 }
    })
    .filter((item) => item.covered < 60)
    .sort((left, right) => right.distinctive - left.distinctive)
    .slice(0, 6)

  /* الفصول: كل مفردة مرافقة تجمع مقالاتها، ولا يتكرّر مقالٌ في فصلين. */
  const claimed = new Set()
  const chapters = []
  for (const companion of companions) {
    const inChapter = members
      .filter((doc) => doc.all.has(companion.word) && !claimed.has(doc.article.slug))
      .sort((left, right) => String(left.article.iso).localeCompare(String(right.article.iso)))
    if (inChapter.length < 2) continue
    for (const doc of inChapter) claimed.add(doc.article.slug)
    chapters.push({
      theme: surface(companion.word),
      articles: inChapter.map((doc) => ({ slug: doc.article.slug, title: doc.article.title, year: String(doc.article.iso).slice(0, 4) })),
    })
  }

  const rest = members.filter((doc) => !claimed.has(doc.article.slug))
  if (rest.length >= 2) {
    chapters.push({
      theme: 'مقالات تنتظر موضعها',
      articles: rest
        .sort((left, right) => String(left.article.iso).localeCompare(String(right.article.iso)))
        .map((doc) => ({ slug: doc.article.slug, title: doc.article.title, year: String(doc.article.iso).slice(0, 4) })),
    })
  }

  if (chapters.length < 2) continue

  const years = members.map((doc) => Number(String(doc.article.iso).slice(0, 4))).filter(Boolean)
  for (const doc of members) used.add(doc.article.slug)
  used.add(seed.word)

  clusters.push({
    seed: surface(seed.word),
    articles: members.length,
    span: years.length ? { from: Math.min(...years), to: Math.max(...years) } : null,
    /* تغطية الكتب: صفرٌ يعني موضوعاً لم تطرقه كتبه بعد. */
    bookCoverage: seed.covered,
    chapters,
  })
}

/* الترتيب النهائي بالفجوة لا بالحجم: موضوعٌ بعشر مقالات لم تطرقه الكتب
   أثمن من موضوعٍ بأربع عشرة غطّته الكتب مئة مرة. */
clusters.sort((left, right) => (right.articles / (1 + right.bookCoverage / 20)) - (left.articles / (1 + left.bookCoverage / 20)))
for (const cluster of clusters) {
  cluster.verdict = cluster.bookCoverage < 20
    ? 'لم تطرقه كتبك التسعة'
    : cluster.bookCoverage < 80 ? 'مسّته كتبك ولم تفرده' : 'مطروق في كتبك'
}

const payload = {
  version: 1,
  policy: 'تحليل آليّ للفجوة بين ما كُتب في المقالات وما جُمع في الكتب. اقتراحٌ للمؤلف لا محتوى للزوار.',
  builtFrom: { articles: articles.length, books: (passages.books || []).length },
  clusters,
}
writeFileSync(OUT, `${JSON.stringify(payload, null, 2)}\n`, 'utf8')

console.log(`✔ الكتاب العاشر: ${clusters.length} موضوعاً غير مجموع، من ${articles.length} مقالاً و${(passages.books || []).length} كتباً\n`)
for (const cluster of clusters) {
  console.log(`█ «${cluster.seed}» — ${cluster.articles} مقالاً${cluster.span ? ` (${cluster.span.from}–${cluster.span.to})` : ''} · ${cluster.verdict}`)
  for (const chapter of cluster.chapters) {
    console.log(`   فصل «${chapter.theme}» — ${chapter.articles.length} مقالات`)
    for (const item of chapter.articles.slice(0, 3)) console.log(`      · ${item.year} ${item.title}`)
  }
  console.log('')
}
