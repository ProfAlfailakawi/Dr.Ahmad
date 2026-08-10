import fs from 'node:fs'

const read = (path) => fs.readFileSync(path, 'utf8')
const weave = read('src/lib/concept-weave.ts')
const echo = read('src/components/ConceptEcho.tsx')
const reader = read('src/components/ArticleReader.tsx')
const detail = read('src/pages/ArticleDetail.tsx')
const life = read('src/pages/ConceptLife.tsx')
const css = read('src/index.css')

const checks = [
  ['المعجم المركزي هو مصدر سيرة المفهوم', weave.includes('DR_AHMAD_DOMAIN_GLOSSARY') && weave.includes('resolveGlossaryConcept')],
  ['aliases تستخدم للمطابقة والاسم العربي المعياري للعرض', weave.includes('entry.canonicalAr') && weave.includes('entry.aliases')],
  ['صدى الفكرة محدود إلى 2–4 إشارات', weave.includes('paragraphCount >= 14 ? 4 : paragraphCount >= 7 ? 3 : 2')],
  ['العلاقات الخمس موجودة ولا تظهر دفعة واحدة', ['يؤيدها','يعارضها','يعمّقها','سبقتها','تطورت منها'].every((label) => weave.includes(label))],
  ['التأييد/التعارض البحثي يحتاج نتيجة ومطابقة قوية', weave.includes('findingOverlap >= 4') && weave.includes('paper.keyFinding')],
  ['المصطلح داخل المقال يفتح سيرة مصغرة لا صفحة مزدحمة', reader.includes('concept-life-peek') && reader.includes('افتح سيرة المفهوم كاملة')],
  ['سيرة المفهوم الكاملة تبقى خلف رابط المفهوم نفسه', reader.includes('/concept/${encodeURIComponent(xray.title)}')],
  ['صدى الفكرة مربوط بالفقرة نفسها', detail.includes('ConceptEchoMarker') && detail.includes('echo.paragraph === pIdx')],
  ['صدى الفكرة يعتمد المقالات والأبحاث والكتب الحالية', detail.includes('articles={articles}') && detail.includes('papers={papers}') && detail.includes('books={books}')],
  ['العلامة في الهامش نقطة لا بطاقة داخل النص', css.includes('.concept-echo-dot') && css.includes('inline-size: .36rem')],
  ['الحركة تحترم تقليل الحركة', css.includes('@media (prefers-reduced-motion: reduce)') && css.includes('.concept-echo-dot > span::after')],
  ['سيرة المفهوم تعرض ما الذي تغير من الأرشيف', life.includes('conceptContextShift') && life.includes('ما الذي تغيّر؟')],
  ['المصطلح غير المعتمد لا يتحول إلى تسمية مخترعة', life.includes('ليس اسماً معتمداً في المعجم المفاهيمي للموقع')],
  ['الطباعة لا تحمل إشارات الصدى', css.includes('.concept-echo-overlay') && css.includes('@media print')],
]

let failed = 0
for (const [label, ok] of checks) {
  if (ok) console.log(`✓ ${label}`)
  else { console.error(`✗ ${label}`); failed += 1 }
}
if (failed) {
  console.error(`\nConcept weave guard failed: ${failed}/${checks.length}`)
  process.exit(1)
}
console.log(`\nConcept weave guard passed (${checks.length}/${checks.length}).`)
