#!/usr/bin/env node
/**
 * تدقيقُ إملاءِ المقالات المنشورة — بشهادة أرشيف الدكتور على نفسه.
 *
 * لا قاموس يُنزَّل، ولا نموذج يُستدعى، ولا نيورون يُصرف. المبدأ الوحيد:
 * إن كتب «في» ألفاً وستمئة وثلاثاً وسبعين مرة و«فى» سبعاً، فالسبع زلّة.
 *
 * ولا يُنبَّه إلا على ما لا يحتمل معنىً ثانياً — «إن/أن» و«كأن/كان» و«إما/أما»
 * كلماتٌ صحيحة مختلفة المعنى وتُستثنى، ولولا ذلك لصار أغلب التقرير إنذاراً
 * كاذباً (٦٤ موضعاً أكثرها سليم، مقابل ٢٠ موضعاً كلها حقيقية).
 *
 *   node scripts/audit-published-orthography.mjs            تقرير
 *   node scripts/audit-published-orthography.mjs --self-test  فحص ذاتي
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const root = process.cwd()
const { buildOrthographyIndex, orthographySlips } = await import(resolve(root, 'src/lib/style-dna.mjs'))

const bodies = JSON.parse(readFileSync(resolve(root, 'src/data/bodies.json'), 'utf8'))
const articles = Object.entries(bodies)
  .filter(([, body]) => typeof body === 'string' && body.trim().length > 200)
  .map(([slug, body]) => ({ slug, body }))

const index = buildOrthographyIndex(articles)

const report = []
for (const article of articles) {
  const slips = orthographySlips(article.body, index)
  if (slips.length) report.push({ slug: article.slug, slips })
}

const positions = report.reduce((sum, item) => sum + item.slips.reduce((count, slip) => count + slip.times, 0), 0)
const forms = new Map()
for (const item of report) for (const slip of item.slips) {
  const seen = forms.get(slip.word) || { ...slip, times: 0, articles: 0 }
  seen.times += slip.times
  seen.articles += 1
  forms.set(slip.word, seen)
}

if (process.argv.includes('--self-test')) {
  const assert = await import('node:assert/strict')
  assert.default.ok(index.size > 5_000, `معجم صوابه مبنيّ (${index.size} صورة)`)
  /* الفحص الحاسم: لا يُنبَّه على أزواجٍ تحتمل معنيين */
  const ambiguous = [...forms.keys()].filter((word) => ['وإن', 'إنه', 'كأن', 'إما', 'ألا', 'انظر'].includes(word))
  assert.default.equal(ambiguous.length, 0, `لا إنذار على كلماتٍ صحيحة (${ambiguous.join(' · ')})`)
  /* وكل ما يُنبَّه عليه يكتبه هو بالصورة الأخرى ستة أضعاف على الأقل */
  for (const slip of forms.values()) {
    assert.default.ok(slip.archiveRight >= slip.times * 6, `«${slip.word}» محسومةٌ بالتفاوت (${slip.archiveRight} مقابل ${slip.times})`)
  }
  /* وحقنُ خطإٍ في مقالٍ سليم يُضبط */
  const clean = articles.find((item) => !orthographySlips(item.body, index).length)
  assert.default.ok(clean, 'يوجد مقالٌ سليم للاختبار')
  const injected = orthographySlips(clean.body.replace(/(?<![\p{L}])في(?![\p{L}])/u, 'فى'), index)
  assert.default.ok(injected.some((slip) => slip.word === 'فى'), 'الخطأ المحقون يُضبط')
  console.log(`تدقيق الإملاء: خضراء ✓  ·  ${positions} موضعاً في ${report.length} مقالاً منشوراً`)
  process.exit(0)
}

console.log(`\n  تدقيق إملاء المقالات المنشورة — ${articles.length} مقالاً، بلا قاموسٍ ولا خدمة\n`)
if (!report.length) {
  console.log('  لا موضع يخالف صورتك الغالبة. الأرشيف نظيف.\n')
  process.exit(0)
}
console.log(`  ${positions} موضعاً · ${forms.size} صورة مختلفة · في ${report.length} مقالاً\n`)
console.log('  المكتوب        الصواب           مرات   وهو يكتبها صحيحة')
console.log('  ' + '─'.repeat(62))
for (const slip of [...forms.values()].sort((left, right) => right.times - left.times)) {
  console.log(`  ${slip.word.padEnd(14)} ${slip.fixed.padEnd(16)} ${String(slip.times).padStart(4)}   ${String(slip.archiveRight).padStart(6)} مرة   ${slip.rule}`)
}
console.log('\n  المقالات المصابة:')
for (const item of report) {
  console.log(`  · ${item.slug} — ${item.slips.map((slip) => `${slip.word}→${slip.fixed}`).join(' · ')}`)
}
console.log('\n  التصحيح يدويٌّ بقرارك: هذه مقالاتٌ منشورة، ولا يُعدَّل نصٌّ لك بلا إذنك.\n')
