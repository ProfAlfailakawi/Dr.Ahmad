import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

const root = resolve(fileURLToPath(new URL('..', import.meta.url)))
const out = mkdtempSync(join(tmpdir(), 'editorial-memory-'))
const fixture = join(out, 'fixture')
const compiled = join(out, 'compiled')
mkdirSync(fixture, { recursive: true })
writeFileSync(join(fixture, 'editorial-memory.ts'), readFileSync(join(root, 'src/lib/editorial-memory.ts'), 'utf8'))
writeFileSync(join(fixture, 'intelligence.ts'), readFileSync(join(root, 'src/lib/intelligence.ts'), 'utf8'))
writeFileSync(join(fixture, 'cms.ts'), `
export type ArticleRecord = { slug:string; title:string; excerpt?:string; body?:string; cat:string; iso:string; hasAudio:boolean; words:number; year?:string; [key:string]: any }
export type BookRecord = { slug:string; title:string; desc:string; [key:string]: any }
export type PaperRecord = { slug:string; title:string; titleAr?:string; meta:string; abstractAr?:string; journal?:string; keyFinding?:string; keywords?:string; analysisNeedsReview?:boolean; url?:string; source?:string; pdf?:string; doi?:string; [key:string]: any }
`)
// لا نعتمد على tsc العالمي في GitHub Runner: قد تكون نسخته مختلفة عن
// النسخة المقفلة في package-lock، وهذا كان يجعل الاختبار يمر محلياً ويفشل في CI.
// بعد npm ci يجب أن نستخدم TypeScript الخاص بالمشروع حصراً.
const requireFromRoot = createRequire(join(root, 'package.json'))
let localTsc = ''
try {
  localTsc = requireFromRoot.resolve('typescript/bin/tsc')
} catch {
  // fallback للبيئات المحلية التي تملك TypeScript فقط على PATH؛ CI لا يصل لهذا المسار.
  localTsc = ''
}
const compileArgs = [
  ...(localTsc ? [localTsc] : []),
  join(fixture, 'editorial-memory.ts'),
  '--target', 'ES2022',
  '--module', 'commonjs',
  '--moduleResolution', 'node',
  '--skipLibCheck',
  '--noEmitOnError',
  '--outDir', compiled,
]
const compile = localTsc
  ? spawnSync(process.execPath, compileArgs, { cwd: root, encoding: 'utf8' })
  : spawnSync('tsc', compileArgs, { cwd: root, encoding: 'utf8' })
if (compile.status !== 0) {
  const diagnostics = [compile.stdout, compile.stderr].filter(Boolean).join('\n').trim()
  throw new Error(`Editorial-memory fixture TypeScript compilation failed${diagnostics ? `:\n${diagnostics}` : ''}`)
}
const memory = createRequire(import.meta.url)(join(compiled, 'editorial-memory.js'))

const source = (patch = {}) => ({
  id: 's-ai', kind: 'doi', title: 'استقلالية الطالب مع الذكاء الاصطناعي', reference: '10.1000/example', note: 'تفويض القرار للآلة',
  summary: 'دراسة عن اعتماد الطلاب على أدوات الذكاء الاصطناعي وتأثير ذلك في الاستقلالية واتخاذ القرار.', keywords: ['الذكاء الاصطناعي', 'الاستقلالية', 'الطلاب'],
  status: 'active', linkedArticles: [], linkedBooks: [], linkedPapers: [], ...patch,
})
const article = (slug, title, cat, body) => ({ slug, title, cat, body, excerpt: body.slice(0, 120), date: '2026', iso: '2026-01-01', words: 900, year: '2026', hasAudio: false, missing: false, _cms: { origin: 'base' } })
const paper = (slug, title) => ({ slug, title, meta: 'دراسة محكمة عن الذكاء الاصطناعي والتعليم والاستقلالية', abstractAr: 'نتائج تربط استخدام الأدوات بطريقة اتخاذ القرار لدى الطالب', keyFinding: 'أثر مرتبط بكيفية الاستخدام', keywords: 'ذكاء اصطناعي، تعليم، استقلالية', _cms: { origin: 'base' } })

const tests = []
const test = (name, fn) => { fn(); tests.push(name) }

test('1) مكتب المصادر يعيد المادة المرتبطة ولا يرفع المنسحب كدليل قوي', () => {
  const active = memory.matchPersonalSources('الذكاء الاصطناعي واستقلالية الطالب واتخاذ القرار', [source()], 5)
  assert.equal(active[0]?.id, 's-ai')
  assert.equal(active[0]?.status, 'active')
  const retracted = memory.matchPersonalSources('الذكاء الاصطناعي واستقلالية الطالب واتخاذ القرار', [source({ status: 'retracted' })], 5)
  assert.ok((retracted[0]?.score || 0) < (active[0]?.score || 0))
})

test('2) الأجندة الفكرية لا تخترع اتجاهاً عند غيابها وتحتسب الحقيقي فقط', () => {
  assert.equal(memory.buildAgendaAlignment('التعليم', []).score, null)
  const result = memory.buildAgendaAlignment('استقلالية الطالب في عصر الذكاء الاصطناعي', [{ id: 'a1', title: 'استقلالية المتعلم والآلة', note: 'حدود تفويض القرار', status: 'writing', priority: 5 }])
  assert.equal(result.available, true)
  assert.ok(result.score >= 40)
  assert.equal(result.matches[0].id, 'a1')
})

test('3) سلسلة الدليل تربط الادعاء بالمصدر وتطلق تنبيه السحب', () => {
  const chain = memory.buildEvidenceChain({
    slug: 'new-article', title: 'استقلالية الطالب والآلة',
    body: 'تشير دراسة حديثة إلى أن تفويض الطالب قراراته للأداة قد يغيّر استقلاليته في التعلم. لكن هذا لا يعني أن كل استخدام للذكاء الاصطناعي يضعف المتعلم.',
    personalSources: [source({ status: 'retracted' })], papers: [paper('p1', 'الذكاء الاصطناعي واستقلالية المتعلم')], preferredPaperSlugs: ['p1'],
  })
  assert.ok(!chain.sourceIds.includes('personal:s-ai'), 'المصدر المنسحب لا يصبح تبعية دليل حتى لو كان قريباً موضوعياً')
  assert.ok(chain.sourceIds.includes('paper:p1'))
  assert.ok(chain.claims.length >= 1)
  assert.ok(!chain.alerts.some((line) => /منسحب/.test(line)), 'المصدر المنسحب غير المستخدم لا يصنع إنذار تبعية زائفاً')
  assert.ok(chain.claims.every((claim) => !claim.sourceIds.includes('personal:s-ai')))
  const activeChain = memory.buildEvidenceChain({
    slug: 'active-article', title: 'استقلالية الطالب والآلة',
    body: 'تشير دراسة حديثة إلى أن تفويض الطالب قراراته للأداة قد يغيّر استقلاليته في التعلم، ولذلك يجب فحص أثر الذكاء الاصطناعي في القرار التعليمي.',
    personalSources: [source()], papers: [],
  })
  assert.ok(activeChain.sourceIds.includes('personal:s-ai'))
})

test('4) بصمة المعنى تمرر النص المحافظ وتوقف الانزياح الواضح', () => {
  const body = 'الفكرة الأساسية أن الذكاء الاصطناعي يجب أن يدعم استقلالية الطالب لا أن يستبدل قراره. تشير الأدلة إلى أن طريقة الاستخدام أهم من وجود الأداة وحده. لكن هذا لا يعني رفض التقنية؛ بل وضع حدود تجعل القرار النهائي للمتعلم.'
  const fingerprint = memory.buildMeaningFingerprint({ slug: 'a', title: 'الطالب والآلة', body, thesis: 'الذكاء الاصطناعي يجب أن يدعم استقلالية الطالب لا أن يستبدل قراره.' })
  assert.ok(fingerprint.hash.startsWith('meaning-'))
  assert.equal(memory.reviewMeaningDrift(fingerprint, body).ready, true)
  const drift = memory.reviewMeaningDrift(fingerprint, 'خبر قصير عن سرعة المعالجات وأسعار الأجهزة الجديدة في الأسواق العالمية.')
  assert.equal(drift.ready, false)
})

test('5) معمار الكتاب يبنى من الأرشيف الحقيقي ويعلن النقص بدلاً من اختراع فصول', () => {
  const articles = [
    article('a1', 'الذكاء الاصطناعي واستقلالية الطالب', 'التعليم', 'الذكاء الاصطناعي في التعليم واستقلالية الطالب واتخاذ القرار.'),
    article('a2', 'المعلم والقرار في زمن الذكاء الاصطناعي', 'التعليم', 'دور المعلم في التعليم والذكاء الاصطناعي والقرار.'),
    article('a3', 'أخلاقيات تفويض القرار للآلة', 'تكنولوجيا', 'أخلاقيات الذكاء الاصطناعي والقرار البشري في التعليم.'),
    article('a4', 'التقييم في عصر الأدوات الذكية', 'بحث', 'التقييم والبحث في الذكاء الاصطناعي والتعليم.'),
    article('a5', 'مهارات الطالب المستقبلية', 'التعليم', 'مهارات الطالب والاستقلالية والتعلم.'),
  ]
  const architecture = memory.buildBookArchitecture({ title: 'الإنسان والآلة في التعليم', desc: 'الذكاء الاصطناعي واستقلالية الطالب والمعلم', articles, papers: [paper('p1', 'دراسة الاستقلالية'), paper('p2', 'دراسة القرار')] })
  assert.ok(architecture.reusableArticles >= 1)
  assert.ok(architecture.chapters.length >= 1)
  assert.ok(architecture.readiness >= 0 && architecture.readiness <= 100)
})

const rules = readFileSync(join(root, 'firestore.rules'), 'utf8')
const storage = readFileSync(join(root, 'storage.rules'), 'utf8')
const studio = readFileSync(join(root, 'src/components/admin/PublishingStudio.tsx'), 'utf8')
const memoryPanel = readFileSync(join(root, 'src/components/admin/EditorialMemoryPanel.tsx'), 'utf8')
const manager = readFileSync(join(root, 'src/components/admin/ContentManager.tsx'), 'utf8')
const dialogue = readFileSync(join(root, 'src/components/admin/ManualDialogueEditor.tsx'), 'utf8')
const server = readFileSync(join(root, 'server.mjs'), 'utf8')
const ci = readFileSync(join(root, '.github/workflows/firebase-hosting-live.yml'), 'utf8')

test('6) المجموعات الجديدة Admin-only ولا توجد قراءة عامة', () => {
  for (const name of ['admin_source_desk', 'admin_intellectual_agenda', 'admin_content_intelligence', 'admin_book_architecture']) {
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const block = rules.match(new RegExp(`match \\/${escaped}\\/\\{id\\}[\\s\\S]*?\\n    \\}`))?.[0] || ''
    assert.match(block, /allow read, create, update, delete: if isAdmin\(\)/, name)
    assert.doesNotMatch(block, /if true/, name)
  }
  assert.match(storage, /match \/admin-source-desk\/\{fileName\}/)
  const storageBlock = storage.match(/match \/admin-source-desk\/\{fileName\}[\s\S]*?\n    }/)?.[0] || ''
  assert.match(storageBlock, /allow read: if isAdmin\(\)/)
  assert.doesNotMatch(storageBlock, /allow read: if true/)
})

test('7) الواجهة الخاصة مطوية ولا تُنشئ تبويباً عاماً جديداً', () => {
  assert.match(memoryPanel, /<details[^>]*data-personal-editorial-memory="true"/)
  assert.doesNotMatch(memoryPanel.match(/<details[^>]*data-personal-editorial-memory="true"[^>]*>/)?.[0] || '', /\sopen(?:=|\s|>)/)
  assert.match(studio, /<EditorialMemoryPanel/)
  assert.match(memoryPanel, /data-personal-source-library="true"/)
  assert.match(memoryPanel, /data-intellectual-agenda-list="true"/)
  assert.match(memoryPanel, /updateAgendaItem/)
  assert.doesNotMatch(studio, /PublishingStudioView[^\n]*source|PublishingStudioView[^\n]*agenda/i)
})

test('8) سلسلة الدليل وبصمة المعنى لا تُكتب داخل site_articles', () => {
  const siteWrite = studio.match(/setDoc\(doc\(db, 'site_articles', bundle\.slug\), \{[\s\S]*?\n      \}\)/)?.[0] || ''
  assert.ok(siteWrite)
  assert.doesNotMatch(siteWrite, /admin_source_desk|sourceIds|evidenceChain|meaningFingerprint/)
  assert.match(studio, /admin_content_intelligence/)
  assert.match(studio, /data-evidence-chain="true"/)
  const chainTag = studio.match(/<details[^>]*data-evidence-chain="true"[^>]*>/)?.[0] || ''
  assert.doesNotMatch(chainTag, /\sopen(?:=|\s|>)/)
  assert.match(manager, /admin_content_intelligence/)
  assert.match(manager, /data-private-evidence-review="true"/)
  assert.match(manager, /resolveArticleEvidenceReview/)
})

test('9) PDF الشخصي يبقى في مسار خاص والخادم يقبله فقط من هذا المسار', () => {
  assert.match(memoryPanel, /admin-source-desk\/\$\{id\}\.pdf/)
  assert.match(server, /async function privateResearchPdf/)
  assert.match(server, /\^admin-source-desk\\\/\[A-Za-z0-9\]/)
  assert.match(server, /bytes\.subarray\(0, 5\).*%PDF-/s)
  assert.doesNotMatch(memoryPanel, /getDownloadURL/)
})

test('10) معمار الكتاب داخل محرر الكتب ومطوي افتراضياً', () => {
  assert.match(manager, /data-book-architect="true"/)
  const tag = manager.match(/<details[^>]*data-book-architect="true"[^>]*>/)?.[0] || ''
  assert.ok(tag)
  assert.doesNotMatch(tag, /\sopen(?:=|\s|>)/)
  assert.match(manager, /admin_book_architecture/)
})

test('11) بصمة المعنى تحرس البودكاست والسوشال قبل الإرسال', () => {
  assert.match(dialogue, /reviewMeaningDrift/)
  assert.match(dialogue, /بصمة المعنى أوقفت التوليد قبل Azure/)
  assert.match(studio, /بصمة المعنى أوقفت الحزمة قبل الطابور/)
  assert.match(dialogue, /meaningFingerprintHash/)
  assert.match(studio, /meaningFingerprintHash/)
})

test('12) سياسة المصادر والحارس الجديدان داخل GitHub Gate', () => {
  assert.match(ci, /test-editorial-policy\.mjs/)
  assert.match(ci, /test-editorial-memory\.mjs/)
  assert.match(ci, /source-desk-watch\.mjs --self-test/)
  assert.match(readFileSync(join(root, 'scripts/source-desk-watch.mjs'), 'utf8'), /sourceWatchAlerts: FieldValue\.arrayUnion\(`\[personal:/)
})

rmSync(out, { recursive: true, force: true })
console.log(`Personal editorial intelligence: ${tests.length}/${tests.length} passed`)
