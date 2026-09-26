#!/usr/bin/env node
/**
 * حارس مسارات التعلّم — يُسقط البناء إن قاد مسارٌ إلى مادةٍ غير موجودة.
 *
 * لكل خطوة في src/data/learning-paths.ts يتحقق من:
 *   ١) أن المعرّف موجودٌ فعلاً في مصدره (مقال، حلقة، مدخل موسوعة، فصل كتاب).
 *   ٢) أن العنوان المثبّت يطابق عنوان المصدر حرفاً بحرف — فإعادة تسمية المادة
 *      في مصدرها لا تمرّ صامتةً وتترك في المسار اسماً قديماً.
 *   ٣) سلامة بنية المسار: معرّفات فريدة، خطوات كافية، وتنوّعٌ حقيقي في الأنواع.
 *
 * وإن وُجدت لقطة CMS (.cache/canonical-cms.json) وحُذفت فيها مادةٌ من اللوحة،
 * يُنبَّه على ذلك تحذيراً (لا يُسقط البناء): الصفحة الحية والساكنة تُخفيان الخطوة.
 *
 * `--self-test` يتحقق أن الحارس نفسه يلتقط المعرّف المفقود والعنوان المختلف.
 */
import { readFileSync, existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const read = (relative) => readFileSync(resolve(ROOT, relative), 'utf8')
const json = (relative) => JSON.parse(read(relative))

export function loadLearningPaths(source = read('src/data/learning-paths.ts')) {
  const runtime = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText.replace(/\bexport\s+/g, '')
  return new Function(`${runtime}; return learningPaths`)()
}

const unescape = (value) => value.replace(/\\'/g, "'")

export function loadSources() {
  const data = read('src/data.ts')
  const grab = (name) => {
    const start = data.indexOf(`export const ${name} = [`)
    if (start < 0) return ''
    const end = data.indexOf('\n]', start)
    return data.slice(start, end < 0 ? undefined : end)
  }
  const articles = new Map([...grab('articles').matchAll(/\{ slug: '([^']+)', title: '((?:\\'|[^'])+)'/g)].map((m) => [m[1], unescape(m[2])]))
  const feedPath = resolve(ROOT, 'src/data/site-articles-feed.json')
  if (existsSync(feedPath)) {
    for (const item of JSON.parse(readFileSync(feedPath, 'utf8'))) if (item?.slug && item?.title && !articles.has(item.slug)) articles.set(item.slug, item.title)
  }
  const books = new Set([...grab('books').matchAll(/\{ slug: '([^']+)'/g)].map((m) => m[1]))
  const episodes = new Map((json('src/data/listen-index.json').episodes || []).map((episode) => [episode.slug, episode]))
  const encyclopedia = new Map()
  for (const door of json('src/data/encyclopedia-structure.json').doors || []) {
    for (const unit of door.units || []) encyclopedia.set(`${door.id}/${unit.number}`, unit.title)
  }
  const chapters = new Map()
  for (const book of json('src/data/book-knowledge.json').books || []) {
    for (const concept of book.concepts || []) chapters.set(`${book.slug}#${concept.id}`, concept.title)
  }
  return { articles, books, episodes, encyclopedia, chapters }
}

const KINDS = new Set(['article', 'podcast', 'encyclopedia', 'book'])

export function validateLearningPaths(paths, sources) {
  const errors = []
  const fail = (where, message) => errors.push(`${where}: ${message}`)
  if (!Array.isArray(paths) || paths.length < 3) fail('learningPaths', 'يلزم ثلاثة مسارات على الأقل')
  const ids = new Set()
  for (const path of paths || []) {
    const where = `المسار «${path?.id}»`
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(String(path?.id || ''))) fail(where, 'المعرّف يجب أن يكون kebab-case لاتينياً')
    if (ids.has(path.id)) fail(where, 'معرّفٌ مكرر')
    ids.add(path.id)
    if (!String(path.title || '').trim() || !String(path.intro || '').trim()) fail(where, 'العنوان والتعريف مطلوبان')
    const steps = Array.isArray(path.steps) ? path.steps : []
    if (steps.length < 3) fail(where, 'يلزم ثلاث خطوات على الأقل')
    const kinds = new Set(steps.map((step) => step.kind))
    if (kinds.size < 3) fail(where, 'المسار يجب أن يمزج ثلاثة أنواع على الأقل (مقال، حلقة، موسوعة، كتاب)')
    const keys = new Set()
    steps.forEach((step, index) => {
      const at = `${where} · الخطوة ${index + 1} (${step.kind}:${step.ref})`
      if (!KINDS.has(step.kind)) return fail(at, `نوعٌ غير معروف «${step.kind}»`)
      const key = `${step.kind}:${step.ref}`
      if (keys.has(key)) fail(at, 'خطوةٌ مكررة في المسار نفسه')
      keys.add(key)
      if (!String(step.note || '').trim()) fail(at, 'سطر «لماذا هذه الخطوة» مطلوب')
      if (!(Number(step.minutes) > 0 && Number(step.minutes) <= 60)) fail(at, 'الزمن التقريبي يجب أن يكون بين 1 و60 دقيقة')
      let expected
      if (step.kind === 'article') {
        expected = sources.articles.get(step.ref)
        if (expected === undefined) return fail(at, 'المقال غير موجود في src/data.ts')
      } else if (step.kind === 'podcast') {
        const episode = sources.episodes.get(step.ref)
        if (!episode) return fail(at, 'الحلقة غير موجودة في listen-index.json')
        expected = episode.title
        if (step.question && step.question !== episode.question) fail(at, `سؤال الحلقة لا يطابق المصدر: «${episode.question}»`)
      } else if (step.kind === 'encyclopedia') {
        expected = sources.encyclopedia.get(step.ref)
        if (expected === undefined) return fail(at, 'المدخل غير موجود في encyclopedia-structure.json (الصيغة door-N/U)')
      } else if (step.kind === 'book') {
        const slug = String(step.ref).split('#')[0]
        if (!sources.books.has(slug)) return fail(at, `الكتاب «${slug}» غير موجود في src/data.ts`)
        expected = sources.chapters.get(step.ref)
        if (expected === undefined) return fail(at, 'الفصل غير موجود في book-knowledge.json (الصيغة slug#cNN)')
      }
      if (expected !== step.title) fail(at, `العنوان المثبّت «${step.title}» لا يطابق المصدر «${expected}»`)
    })
  }
  return errors
}

function panelDeletions() {
  const file = resolve(ROOT, '.cache/canonical-cms.json')
  if (!existsSync(file)) return new Set()
  try {
    const cms = JSON.parse(readFileSync(file, 'utf8'))
    return new Set((cms.overrides || []).filter((row) => row?.deleted === true || row?.hidden === true).map((row) => String(row.id)))
  } catch { return new Set() }
}

function selfTest(paths, sources) {
  const clone = JSON.parse(JSON.stringify(paths))
  clone[0].steps[0].ref = 'this-slug-does-not-exist'
  clone[1].steps[0].title = 'عنوانٌ مختلف'
  const errors = validateLearningPaths(clone, sources)
  if (!errors.some((line) => line.includes('this-slug-does-not-exist'))) throw new Error('الحارس لم يلتقط معرّفاً مفقوداً')
  if (!errors.some((line) => line.includes('عنوانٌ مختلف'))) throw new Error('الحارس لم يلتقط عنواناً مختلفاً')
  console.log('✓ اختبار الحارس الذاتي: يلتقط المعرّف المفقود والعنوان المختلف')
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const paths = loadLearningPaths()
  const sources = loadSources()
  if (process.argv.includes('--self-test')) selfTest(paths, sources)
  const errors = validateLearningPaths(paths, sources)
  if (errors.length) {
    console.error('✘ حارس مسارات التعلّم:\n' + errors.map((line) => `  - ${line}`).join('\n'))
    process.exit(1)
  }
  const deleted = panelDeletions()
  for (const path of paths) {
    for (const step of path.steps) {
      const key = step.kind === 'article' || step.kind === 'podcast' ? `article:${step.ref}` : step.kind === 'book' ? `book:${step.ref.split('#')[0]}` : 'book:encyclopedia'
      if (deleted.has(key)) console.log(`::warning::مسار «${path.title}»: المادة ${key} محذوفة أو مخفية من اللوحة — ستُخفى خطوتها. حدّث src/data/learning-paths.ts.`)
    }
  }
  const steps = paths.reduce((sum, path) => sum + path.steps.length, 0)
  console.log(`✓ مسارات التعلّم سليمة: ${paths.length} مسارات، ${steps} خطوة، وكل معرّف يقود إلى مادةٍ موجودة بعنوانها الصحيح.`)
}
