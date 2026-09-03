import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import * as esbuild from 'esbuild'

const root = resolve(process.cwd())
const requestedOutput = process.argv.find((arg) => arg.startsWith('--output='))?.slice('--output='.length)
const output = resolve(root, requestedOutput || 'reports/article-audit.md')
const temp = await mkdtemp(join(tmpdir(), 'article-audit-'))
const bundled = join(temp, 'data.mjs')

const ar = (value) => new Intl.NumberFormat('ar-KW').format(value)
const words = (value = '') => value.trim().split(/\s+/u).filter(Boolean).length
const exists = async (file) => { try { await stat(file); return true } catch { return false } }
const safe = (value = '') => String(value).replace(/\|/g, '¦').replace(/\s+/g, ' ').trim()
const domainOf = (value = '') => { try { return new URL(value).hostname.replace(/^www\./, '') } catch { return '' } }
const terminalPunctuation = /[.!؟…»”)]$/u

try {
  await esbuild.build({
    entryPoints: [join(root, 'src/data.ts')],
    bundle: true,
    platform: 'node',
    format: 'esm',
    outfile: bundled,
    logLevel: 'silent',
  })
  const data = await import(`${pathToFileURL(bundled).href}?v=${Date.now()}`)
  const articles = data.articles || []
  const bodies = JSON.parse(await readFile(join(root, 'src/data/bodies.json'), 'utf8'))
  const audioManifest = JSON.parse(await readFile(join(root, 'src/data/audio.json'), 'utf8'))

  const slugCounts = new Map()
  const titleCounts = new Map()
  for (const article of articles) {
    slugCounts.set(article.slug, (slugCounts.get(article.slug) || 0) + 1)
    const title = safe(article.title)
    titleCounts.set(title, (titleCounts.get(title) || 0) + 1)
  }

  const rows = []
  for (const article of articles) {
    const body = String(bodies[article.slug] || article.body || '')
    const count = words(body)
    const route = `/articles/${article.slug}`
    const staticPage = await exists(join(root, 'dist/articles', article.slug, 'index.html'))
    const audio = audioManifest[article.slug] || {}
    const audioVoices = ['fahed', 'noura', 'dialogue'].filter((voice) => Boolean(audio[voice]))
    const issues = []
    const missing = ['slug', 'title', 'date', 'iso', 'cat', 'excerpt'].filter((field) => !safe(article[field]))
    if (missing.length) issues.push(`حقول ناقصة: ${missing.join('، ')}`)
    if (!body) issues.push('النص الكامل مفقود')
    else if (count < 300) issues.push(`قصير جداً (${ar(count)} كلمة)`)
    else if (count < 350) issues.push(`أقل من النطاق المستهدف (${ar(count)})`)
    else if (count > 700) issues.push(`طويل جداً (${ar(count)})`)
    else if (count > 450) issues.push(`فوق النطاق المستهدف (${ar(count)})`)
    const excerptLength = Array.from(safe(article.excerpt)).length
    if (excerptLength < 60) issues.push(`المقتطف قصير (${ar(excerptLength)} حرفاً)`)
    if (excerptLength > 220) issues.push(`المقتطف طويل (${ar(excerptLength)} حرفاً)`)
    if (article.excerpt && !terminalPunctuation.test(safe(article.excerpt))) issues.push('المقتطف يبدو مقطوع النهاية')
    if (article.url && article.url.startsWith('/articles/') && article.url !== route) issues.push(`الرابط الداخلي يشير إلى ${article.url}`)
    if (article.url && !article.url.startsWith('/') && !/^https:\/\//i.test(article.url)) issues.push('صيغة رابط المقال غير سليمة')
    if (!article.source) issues.push('المصدر الخارجي غير موجود')
    else if (/\/author\/|\/profile\/?(?:[?#].*)?$/i.test(article.source)) issues.push('المصدر صفحة كاتب عامة لا رابط المقال المباشر')
    else if (!/^https:\/\//i.test(article.source)) issues.push('المصدر ليس HTTPS')
    if (!/^\d{4}-\d{2}-\d{2}$/.test(article.iso || '') || Number.isNaN(Date.parse(article.iso))) issues.push('التاريخ ISO غير صالح')
    if ((article.title || '').length < 8) issues.push('العنوان قصير جداً')
    if ((article.title || '').length > 115) issues.push('العنوان طويل بصرياً')
    if (!staticPage) issues.push('صفحة الإنتاج الثابتة غير موجودة')
    if (!audioVoices.length) issues.push('لا توجد قراءة صوتية مسجلة')
    if ((slugCounts.get(article.slug) || 0) > 1) issues.push('الرابط المختصر مكرر')
    if ((titleCounts.get(safe(article.title)) || 0) > 1) issues.push('العنوان مكرر حرفياً')

    rows.push({ article, body, count, route, staticPage, audioVoices, issues, domain: domainOf(article.source) })
  }

  const categoryMap = new Map()
  const sourceMap = new Map()
  for (const row of rows) {
    categoryMap.set(row.article.cat || 'بلا تصنيف', (categoryMap.get(row.article.cat || 'بلا تصنيف') || 0) + 1)
    sourceMap.set(row.domain || 'بلا مصدر', (sourceMap.get(row.domain || 'بلا مصدر') || 0) + 1)
  }
  const byCategory = [...categoryMap].sort((a, b) => b[1] - a[1])
  const bySource = [...sourceMap].sort((a, b) => b[1] - a[1])
  const missingBodies = rows.filter((row) => !row.body)
  const shortBodies = rows.filter((row) => row.body && row.count < 300)
  const underTarget = rows.filter((row) => row.count >= 300 && row.count < 350)
  const aboveTarget = rows.filter((row) => row.count > 450)
  const missingSources = rows.filter((row) => !row.article.source)
  const genericSources = rows.filter((row) => /\/author\/|\/profile\/?(?:[?#].*)?$/i.test(row.article.source || ''))
  const wrongRoutes = rows.filter((row) => row.article.url?.startsWith('/articles/') && row.article.url !== row.route)
  const missingPages = rows.filter((row) => !row.staticPage)
  const missingAudio = rows.filter((row) => !row.audioVoices.length)
  const dialogueAudio = rows.filter((row) => row.audioVoices.includes('dialogue'))
  const critical = rows.filter((row) => row.issues.some((issue) => /مفقود|ناقصة|غير صالح|غير موجود|يشير إلى/.test(issue)))
  const ready = rows.filter((row) => row.issues.length === 0)
  const totalWords = rows.reduce((sum, row) => sum + row.count, 0)
  const averageWords = rows.length ? Math.round(totalWords / rows.length) : 0

  const lines = []
  lines.push('# تقرير التدقيق الشامل للمقالات')
  lines.push('')
  lines.push(`تاريخ الفحص: ${new Intl.DateTimeFormat('ar-KW', { dateStyle: 'full', timeStyle: 'short', timeZone: 'Asia/Kuwait' }).format(new Date())}`)
  lines.push('')
  lines.push('## الخلاصة التنفيذية')
  lines.push('')
  lines.push(`- إجمالي المقالات: **${ar(rows.length)}**.`)
  lines.push(`- إجمالي كلمات النصوص المتاحة: **${ar(totalWords)}**، بمتوسط **${ar(averageWords)}** كلمة للمقال.`)
  lines.push(`- مكتملة بلا أي ملاحظة آلية: **${ar(ready.length)}**.`)
  lines.push(`- ملاحظات حرجة تحتاج معالجة مباشرة: **${ar(critical.length)}** مقالاً.`)
  lines.push(`- نص كامل مفقود: **${ar(missingBodies.length)}**.`)
  lines.push(`- أقل من 300 كلمة: **${ar(shortBodies.length)}**، وبين 300 و349 كلمة: **${ar(underTarget.length)}**.`)
  lines.push(`- فوق 450 كلمة: **${ar(aboveTarget.length)}**؛ الطول وحده ليس خطأ، لكنه خارج معيار 350–450 المعتمد للمقالات الجديدة.`)
  lines.push(`- مصدر خارجي مفقود: **${ar(missingSources.length)}**؛ مصدر عام بدل الرابط المباشر: **${ar(genericSources.length)}**.`)
  lines.push(`- روابط داخلية خاطئة: **${ar(wrongRoutes.length)}**؛ صفحات إنتاج ثابتة مفقودة: **${ar(missingPages.length)}**.`)
  lines.push(`- بلا قراءة صوتية: **${ar(missingAudio.length)}**؛ حلقات حوارية مسجلة في البيان الحالي: **${ar(dialogueAudio.length)}**.`)
  lines.push('')
  lines.push('## الأولويات')
  lines.push('')
  lines.push('1. استعادة النصوص الكاملة المفقودة أولاً؛ لأن المقال يظهر في الفهرس لكن تجربة القراءة لا تكتمل.')
  lines.push('2. استبدال روابط صفحات الكاتب العامة بروابط المقالات الأصلية الدقيقة متى أمكن، مع إبقاء المسار الداخلي للموقع مستقلاً.')
  lines.push('3. مراجعة المقالات الأقصر من 300 كلمة والمقتطفات المقطوعة؛ لا يُنصح بتمديد النصوص التاريخية آلياً من دون الرجوع إلى الأصل.')
  lines.push('4. اعتماد فحص آلي قبل كل نشر جديد للعنوان، والتصنيف، والرابط، والمصدر، والنص، والصورة والصوت.')
  lines.push('')

  const issueSection = (title, collection, format) => {
    lines.push(`## ${title}`)
    lines.push('')
    if (!collection.length) lines.push('لا توجد ملاحظات في هذا المحور.')
    else collection.forEach((row) => lines.push(`- ${format(row)}`))
    lines.push('')
  }

  issueSection('النصوص الكاملة المفقودة', missingBodies, (row) => `**${safe(row.article.title)}** — ${row.article.slug} — ${row.route}`)
  issueSection('المقالات الأقصر من 300 كلمة', shortBodies, (row) => `**${safe(row.article.title)}** — ${ar(row.count)} كلمة — ${row.route}`)
  issueSection('المقالات بين 300 و349 كلمة', underTarget, (row) => `**${safe(row.article.title)}** — ${ar(row.count)} كلمة — ${row.route}`)
  issueSection('المصادر المفقودة', missingSources, (row) => `**${safe(row.article.title)}** — ${row.route}`)
  issueSection('المصادر العامة التي تحتاج رابطاً مباشراً', genericSources, (row) => `**${safe(row.article.title)}** — ${row.article.source}`)
  issueSection('الروابط الداخلية غير المطابقة للرابط المختصر', wrongRoutes, (row) => `**${safe(row.article.title)}** — الحالي: ${row.article.url} — الصحيح: ${row.route}`)
  issueSection('صفحات الإنتاج الثابتة المفقودة', missingPages, (row) => `**${safe(row.article.title)}** — ${row.route}`)
  issueSection('المقالات التي لا تملك قراءة صوتية', missingAudio, (row) => `**${safe(row.article.title)}** — ${row.route}`)

  lines.push('## توزيع التصنيفات')
  lines.push('')
  lines.push('| التصنيف | العدد |')
  lines.push('|---|---:|')
  byCategory.forEach(([category, count]) => lines.push(`| ${safe(category)} | ${ar(count)} |`))
  lines.push('')
  lines.push('## توزيع المصادر')
  lines.push('')
  lines.push('| المصدر | العدد |')
  lines.push('|---|---:|')
  bySource.forEach(([source, count]) => lines.push(`| ${safe(source)} | ${ar(count)} |`))
  lines.push('')
  lines.push('## الجرد الكامل مقالاً مقالاً')
  lines.push('')
  lines.push('| المقال | السنة / التصنيف | الكلمات | النص | الصوت | المصدر | صفحة الإنتاج | الملاحظات |')
  lines.push('|---|---|---:|---|---|---|---|---|')
  for (const row of rows) {
    const sourceState = !row.article.source ? 'مفقود' : /\/author\/|\/profile\/?(?:[?#].*)?$/i.test(row.article.source) ? 'عام' : row.domain || 'موجود'
    const audioState = row.audioVoices.length ? row.audioVoices.map((voice) => voice === 'fahed' ? 'فهد' : voice === 'noura' ? 'نورة' : 'حوار').join(' + ') : 'مفقود'
    lines.push(`| [${safe(row.article.title)}](${row.route}) | ${safe(row.article.iso?.slice(0, 4))} / ${safe(row.article.cat)} | ${ar(row.count)} | ${row.body ? 'موجود' : 'مفقود'} | ${audioState} | ${safe(sourceState)} | ${row.staticPage ? 'موجودة' : 'مفقودة'} | ${safe(row.issues.join('؛ ') || 'سليم')} |`)
  }
  lines.push('')
  lines.push('## حدود هذا الفحص')
  lines.push('')
  lines.push('- تم فحص بيانات المشروع والنصوص ومسارات الإنتاج محلياً.')
  lines.push('- لم يُجرَ تحقق شبكي حي من استجابة كل رابط خارجي؛ لذلك الرابط الموجود قد يحتاج لاحقاً فحص HTTP منفصلاً بعد النشر.')
  lines.push('- الملاحظات اللغوية هنا آلية بنيوية، وليست حكماً تحريرياً على قيمة المقال أو أسلوبه.')

  await mkdir(dirname(output), { recursive: true })
  await writeFile(output, `${lines.join('\n')}\n`, 'utf8')
  console.log(`✔ تقرير المقالات: ${output}`)
  console.log(`• ${rows.length} مقالاً · ${critical.length} حرجاً · ${missingBodies.length} نصوص مفقودة · ${wrongRoutes.length} روابط داخلية خاطئة`)
} finally {
  await rm(temp, { recursive: true, force: true })
}
