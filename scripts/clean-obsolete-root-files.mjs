import { readdir, readFile, rm, writeFile } from 'node:fs/promises'
import { basename, join, resolve } from 'node:path'

// هذه ملفات قديمة يتيمة خارج المسارات الحية كانت بعض أدوات المزامنة تعتبرها التطبيق الحقيقي.
// حذفها قبل كل بناء يلغي ازدواجية مصدر التطبيق ويمنع أدوات المزامنة من اختيار شجرة قديمة خارج src/.
const obsolete = [
  'App.tsx',
  'ArticleDetail.tsx',
  'PaperDetail.tsx',
  'IdeaFeatures.tsx',
  'SocialDesignStudio.tsx',
  'social-design-engine.ts',
  'social-design-renderer.ts',
  'agent.mjs',
  'intent-engine.mjs',
  'verify-domain-migration.mjs',
  'public/sitemap.xml',
  // بقايا خطة تحويل WordPress القديمة: وجودها بعد إلغاء المسارات يربك تدقيقات
  // Search Console ويعيد اقتراح تحويلات عامة سببت soft 404 سابقاً.
  'ROOT-CAUSES-AND-FILES.txt',
  'docs/MIGRATION.md',
  'reports/legacy-links-report.json',
  'reports/legacy-links-report.md',
  'reports/legacy-links.json',
  'scripts/audit-legacy-links.mjs',
  'scripts/verify-legacy-retirement.mjs',
  'src/pages/Legacy.tsx',
]

const root = process.cwd()

for (const relative of obsolete) {
  await rm(resolve(root, relative), { force: true })
}

const readCurrentArticleSlugs = async () => {
  const dataSource = await readFile(resolve(root, 'src/data.ts'), 'utf8')
  const articleBlock = dataSource.match(/export const articles = \[([\s\S]*?)\n\]/)?.[1] || ''
  return new Set([...articleBlock.matchAll(/\bslug:\s*['"]([^'"]+)['"]/g)].map((match) => match[1]))
}

const walk = async (dir) => {
  const absolute = resolve(root, dir)
  let entries = []
  try {
    entries = await readdir(absolute, { withFileTypes: true })
  } catch {
    return []
  }
  const files = []
  for (const entry of entries) {
    const relative = join(dir, entry.name)
    if (entry.isDirectory()) files.push(...await walk(relative))
    else files.push(relative)
  }
  return files
}

const slugs = await readCurrentArticleSlugs()
const staleStaticPages = (await walk('articles')).filter((relative) => {
  if (!relative.endsWith('.html')) return false
  const route = relative.replace(/^articles\//, '')
  if (route === 'index.html') return false
  const slug = route.endsWith('/index.html') ? route.slice(0, -'/index.html'.length) : route.replace(/\.html$/, '')
  return !slugs.has(slug)
})

const staleOgImages = (await walk('og/articles')).filter((relative) => {
  if (!relative.endsWith('.svg')) return false
  return !slugs.has(basename(relative, '.svg'))
})

for (const relative of [...staleStaticPages, ...staleOgImages]) {
  await rm(resolve(root, relative), { force: true })
}

let orphanBodies = []
const bodiesPath = resolve(root, 'src/data/bodies.json')
try {
  const bodies = JSON.parse(await readFile(bodiesPath, 'utf8'))
  orphanBodies = Object.keys(bodies).filter((slug) => !slugs.has(slug))
  if (orphanBodies.length) {
    for (const slug of orphanBodies) delete bodies[slug]
    await writeFile(bodiesPath, `${JSON.stringify(bodies, null, 2)}\n`, 'utf8')
  }
} catch {
  orphanBodies = []
}

console.log(`[clean-obsolete] removed/confirmed ${obsolete.length} obsolete roots, ${staleStaticPages.length} stale article pages, ${staleOgImages.length} stale OG images, ${orphanBodies.length} orphan bodies`)
