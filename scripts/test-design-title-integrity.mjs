#!/usr/bin/env node
/**
 * لا تُحذف كلمةٌ من العنوان أبداً — فحصٌ آليّ يقارن النص المرسوم بالنص الأصلي كلمةً كلمة.
 *
 * مراجعة ٢٤ سبتمبر ٢٠٢٦: «كاتدرائية الجذور» كانت تكتب «…من الكسل» بلا «المعرفي»،
 * و«الخريطة المعرفية» تُخفي العنوان، والمحرك يقصّ الفكرة ذات الخمس عشرة كلمة عند
 * السابعة. هذا الاختبار يرسم كل عالمٍ من العوالم الأربعة والستين وكل تكوينٍ يقوم على
 * صورة (بكل المقاسات ومناطق النص، بإطارٍ وبلا إطار) بثلاث أفكار: قصيرة ومتوسطة
 * وطويلة، ثم يتحقق من أن كل كلمةٍ من الفكرة مرسومةٌ في SVG بترتيبها.
 *
 * الهندسة (حافة ٤٨، فجوة التذييل ٢٤، الإطار) تُقاس في المتصفح بعد تحميل الخطوط؛
 * هذا الاختبار يحرس المحتوى فيعمل في Node بلا متصفح.
 */
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import ts from 'typescript'

const root = process.cwd()
const read = (file) => readFile(resolve(root, file), 'utf8')
const dataUrl = (source) => `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`
const transpile = (source, fileName) => ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 }, fileName }).outputText
const rep = (source, spec, url) => source.replaceAll(`'${spec}'`, `'${url}'`).replaceAll(`"${spec}"`, `"${url}"`)

const glossaryJson = await read('src/data/dr-ahmad-domain-glossary.json')
const glossaryUrl = dataUrl(transpile((await read('src/lib/dr-ahmad-domain-glossary.ts')).replace(/^import\s+glossaryData\s+from\s+['"]\.\.\/data\/dr-ahmad-domain-glossary\.json['"][^\n]*$/m, `const glossaryData = ${glossaryJson}`), 'dr-ahmad-domain-glossary.ts'))
const countUrl = dataUrl(transpile(await read('src/lib/arabic-count.ts'), 'arabic-count.ts'))
const ideaUrl = dataUrl(rep(transpile(await read('src/lib/idea-dna.ts'), 'idea-dna.ts'), './dr-ahmad-domain-glossary', glossaryUrl))
const designSystemUrl = dataUrl(transpile(await read('src/lib/design-system.ts'), 'design-system.ts'))
let engineOut = transpile(await read('src/lib/social-design-engine.ts'), 'social-design-engine.ts')
for (const [spec, url] of [['./dr-ahmad-domain-glossary', glossaryUrl], ['./idea-dna', ideaUrl], ['./arabic-count.ts', countUrl], ['./design-system', designSystemUrl]]) engineOut = rep(engineOut, spec, url)
const engineUrl = dataUrl(engineOut)
const engine = await import(engineUrl)
const worldsUrl = dataUrl(rep(transpile(await read('src/lib/design-worlds.ts'), 'design-worlds.ts'), './social-design-engine', engineUrl))
const worlds = await import(worldsUrl)
const seasonUrl = dataUrl(`export const currentSeason=()=>({id:'none',label:'',kind:'none'});export const seasonStrokePath=()=>'';`)
let rendererOut = transpile(await read('src/lib/social-design-renderer.ts'), 'social-design-renderer.ts')
for (const [spec, url] of [['./social-design-engine', engineUrl], ['./seasons', seasonUrl], ['./design-system', designSystemUrl]]) rendererOut = rep(rendererOut, spec, url)
const renderer = await import(dataUrl(rendererOut))

const IDEAS = [
  'التعلم يبدأ بالسؤال',
  'القراءة العميقة تحمي عقل الطالب من الكسل المعرفي',
  'حين نعلّم أبناءنا أن يسألوا قبل أن يحفظوا نصنع جيلاً يفكّر بعمق ويختار بوعي',
]
/* فكّ الكيانات بترتيبٍ واحد (&amp; آخراً) كي لا يُفكّ النص مرتين. */
const ENTITIES = { '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'", '&amp;': '&' }
const decode = (value) => value.replace(/&(?:lt|gt|quot|#39|amp);/g, (entity) => ENTITIES[entity])
/* نص العنصر بلا وسومه الداخلية (tspan): نجمع ما بين الوسوم بدل حذفها بتعبيرٍ واحد. */
const textContent = (inner) => inner.split(/<[^>]*>/).join('')
const normalize = (value) => value.replace(/[ً-ْـ…]/g, '').split(/\s+/).filter(Boolean)
const drawnText = (svg) => [...svg.matchAll(/<text\b[^>]*>([\s\S]*?)<\/text>/g)].map((match) => decode(textContent(match[1]))).join(' ')
/** كل كلمات الفكرة مرسومة، وبترتيبها (تسلسلٌ جزئي داخل النص المرسوم). */
function missingWords(idea, svg) {
  const drawn = normalize(svg.includes('<text') ? drawnText(svg) : svg)
  const wanted = normalize(idea)
  const missing = []
  let cursor = 0
  for (const word of wanted) {
    const found = drawn.indexOf(word, cursor)
    if (found < 0) missing.push(word)
    else cursor = found + 1
  }
  return missing
}

const failures = []
let checked = 0

/* ١) العوالم الأربعة والستون بمعاينتها الفعلية. */
for (const id of worlds.MASTER_WORLD_ORDER) {
  for (const idea of IDEAS) {
    checked += 1
    const svg = renderer.renderCompositionSvg(worlds.worldPreviewPlan(worlds.DESIGN_WORLDS[id], idea))
    const missing = missingWords(idea, svg)
    if (missing.length) failures.push(`عالم ${id} (${idea.split(' ').length} كلمات): ناقص «${missing.join(' ')}»`)
  }
}

/* ٢) كل تكوينٍ يقوم على صورة، بكل المقاسات ومناطق النص، بإطارٍ داخل الصورة وبدونه. */
const pixel = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='
const frames = { bottom: { x: .065, y: .065, width: .87, height: .5 }, right: { x: .065, y: .065, width: .47, height: .87 }, left: { x: .47, y: .065, width: .47, height: .87 } }
for (const idea of IDEAS) {
  for (const format of Object.keys(engine.SOCIAL_FORMATS)) {
    const base = engine.generateSocialDesigns({ text: idea, format, count: 1, seed: 7 }).plans[0]
    assert.ok(base, `خطة للمقاس ${format}`)
    assert.ok(missingWords(idea, base.content.title).length === 0, `المحرك لا يقصّ العنوان (${format}): «${base.content.title}»`)
    for (const layout of ['hero-word', 'quote-stage', 'evidence-ledger', 'event-marquee', 'cinematic-window', 'editorial-axis']) {
      for (const zone of ['right', 'left', 'bottom', 'top']) {
        for (const framed of [false, true]) {
          checked += 1
          const frameBox = framed ? frames[zone] : undefined
          const plan = { ...base, layout, paletteOverride: engine.identityPalette(false), overlays: [{ id: 'hero', kind: 'image', x: 0, y: 0, width: 1, height: 1, src: pixel, color: 'paper', imageRole: 'background', imageTreatment: 'editorial', textZone: zone, ...(frameBox ? { frameBox } : {}) }] }
          const missing = missingWords(idea, renderer.renderCompositionSvg(plan))
          if (missing.length) failures.push(`${format} · ${layout} · ${zone}${framed ? ' · إطار' : ''}: ناقص «${missing.join(' ')}»`)
        }
      }
    }
  }
}

/* ٣) لوحة الهوية وحدها في التصاميم القائمة على صورة: أزرق · جمر · حبر. */
const identity = engine.identityPalette(false)
assert.equal(identity.accent, '#3E5C78', 'الأساس أزرق الهوية')
assert.equal(identity.highlight, '#8F5A28', 'الإبراز جمر الهوية')
assert.equal(identity.ink, '#15161A', 'النص حبر الهوية')

assert.equal(failures.length, 0, `كلماتٌ ساقطة من العنوان:\n${failures.slice(0, 20).join('\n')}`)
console.log(`سلامة العنوان: ${checked} رسمة (٦٤ عالماً × ٣ أفكار + كل التكوينات القائمة على صورة) — لا كلمة ساقطة ✓`)
