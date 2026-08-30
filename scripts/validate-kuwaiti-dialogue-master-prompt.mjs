#!/usr/bin/env node
/** حارس برومت المقالات الجديدة: يمنع رجوع قالب المذيع أو الخاتمة المثبتة. */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const promptPath = resolve(ROOT, 'scripts/prompts/dialogue-kuwaiti-new-articles.md')
const prompt = readFileSync(promptPath, 'utf8')
const engine = readFileSync(resolve(ROOT, 'scripts/podcast-kuwaiti-gemini.mjs'), 'utf8')
const variety = readFileSync(resolve(ROOT, 'scripts/lib/kuwaiti-dialogue-variety.mjs'), 'utf8')

assert.ok(prompt.length >= 18000, `برومت المقالات الجديدة مختصر أكثر من اللازم (${prompt.length} حرف)`)

for (const heading of [
  'أمان المعنى والإسناد',
  'الهوية اللغوية — كويتي حضري من مدينة الكويت',
  'الكتابة الشفهية قبل البلاغة',
  'الشخصيتان — مستقلتان ومتساويتان',
  'عائلات المحادثة الست',
  'البحث والأرقام داخل السالفة',
  'القاف والحروف عالية الخطورة',
  'الجسران — مونتاج خارجي فقط',
  'الخاتمة والإحالة',
  'بوابة الجودة الصامتة قبل الإخراج',
]) assert.match(prompt, new RegExp(heading), `قسم مطلوب مفقود: ${heading}`)

for (const family of [
  'quick-practical', 'curious-unfolding', 'warm-friction',
  'lived-scene', 'evidence-midstream', 'quiet-reflection',
]) assert.match(prompt, new RegExp(`\`${family}\``), `عائلة الحوار مفقودة: ${family}`)

assert.match(prompt, /24 إلى 32 مداخلة/u, 'حد الأدوار غير مقفول')
assert.match(prompt, /220 إلى 300 كلمة/u, 'حد الكلمات غير مقفول')
assert.match(prompt, /TARGET_TURNS[\s\S]*عدد عناصر المصفوفة \*\*ذلك الرقم بالضبط\*\*/u,
  'الهدف العددي للأدوار غير ملزم')
assert.match(prompt, /ممنوع جمع تقديم الدراسة ونتيجتها الأساسية في مداخلة واحدة/u,
  'المعلومة البحثية ما زالت قابلة للتحول إلى فقرة مقدم')
assert.match(prompt, /طبّق سلسلة التمهيد → السؤال → النتيجة على \*\*كل دراسة\*\*/u,
  'الدراسة الثانية ما زالت قابلة للرجوع إلى فقرة مقدم')
assert.match(prompt, /الدور الوحيد المتداخل يحمل `overlapMs: 70` بالضبط/u,
  'التداخل القصير الوحيد غير مقفول بقيمة الإنتاج')
assert.match(prompt, /18 دوراً على الأقل من 8 كلمات أو أكثر/u,
  'عدد الأدوار مقفول لكن كثافة المعنى غير مقفولة')
assert.match(prompt, /musicBridgeAfter: true[^]*دورين بالضبط/u, 'الجسران الخارجيان غير مقفولين')
assert.match(prompt, /الجملة العظيمة قد يقولها الإنسان بسرعة ونبرة عادية/u,
  'الجمل المهمة ما زالت معرضة لإلقاء كل-جملة-تهم')
assert.match(prompt, /لا تحوّل كل قاف إلى گ/u, 'قاعدة القاف المعجمية غير موجودة')
assert.match(prompt, /ممنوع ظهور حرف `گ` أو `چ` في أي `text`/u,
  'الإملاء الصوتي الزخرفي غير ممنوع')
assert.match(prompt, /معلومة البحثية ما تفتح وضع المذيع/u, 'قفل البحث الحواري مفقود')
assert.match(prompt, /امنع داخل الحوار العبارات الأكاديمية الجاهزة/u,
  'عبارات المقدم الأكاديمي غير ممنوعة صراحة')
assert.match(prompt, /اسم الكاتب في البيانات المكتوبة والـmetadata/u, 'الاسم الكامل غير محفوظ في البيانات المكتوبة')
assert.match(prompt, /اسم العائلة والاسم الكامل ممنوعان في أي `text` منطوق/u,
  'اسم العائلة ما زال قابلاً للدخول إلى TTS')
assert.match(prompt, /CLOSING_VARIANT/u, 'اختيار صيغة الإحالة مفقود')
assert.match(prompt, /الصيغ الثماني/u, 'تنويع الإحالة غير مقفول')
assert.match(prompt, /موقع الدكتور أحمد/u, 'الإحالة المختصرة مفقودة')
assert.match(prompt, /`deliveryType` يساوي `statement`/u, 'الإحالة ما زالت معرضة لإلقاء خاتمة إعلانية')
assert.match(prompt, /`pauseAfterMs` يساوي `260`/u, 'وقفة الإحالة المختصرة غير مقفولة')
assert.match(prompt, /لا تثبّتها دائماً على نورة أو دائماً على فهد/u,
  'الإحالة ما زالت معرضة للتثبيت على صوت واحد')
assert.match(prompt, /Take صوتي واحد بلا موسيقى/u, 'نظام Same-Take والجسور الخارجية غير موثق')
assert.match(prompt, /ممنوع استخدام علامة الاقتباس الإنجليزية `"` داخل قيمة `text`/u,
  'JSON ما زال معرضاً لاقتباس غير مهرب داخل النص')

const jsonBlock = prompt.match(/```json\n([\s\S]*?)```/u)?.[1]
assert.ok(jsonBlock, 'مثال JSON الإنتاجي مفقود')
const sample = JSON.parse(jsonBlock)
assert.ok(Array.isArray(sample) && sample.length === 2, 'مثال JSON ليس مصفوفة أدوار')
const expectedKeys = ['deliveryType', 'musicBridgeAfter', 'overlapMs', 'pauseAfterMs', 'speaker', 'text']
for (const turn of sample) {
  assert.deepEqual(Object.keys(turn).sort(), expectedKeys, 'مثال الدور يحمل حقولاً لا يفهمها المسار الكويتي')
  assert.ok(['male', 'female'].includes(turn.speaker), 'مثال المتحدث ليس male/female')
}

const acousticLock = 'The opening 20 seconds establish the permanent acoustic reference for both speakers.'
assert.equal(engine.split(acousticLock).length - 1, 2,
  'قفل أول عشرين ثانية يجب أن يظهر مرة في الرأس الكامل ومرة في رأس Vertex فقط')
assert.doesNotMatch(engine, /opening 30 seconds|At every internal transition, preserve the exact pre-transition/u,
  'بقي قفل انتقال قديم فوق القفل الوحيد الذي طلبه الدكتور')
assert.doesNotMatch(variety, /output\[lastIndex\]\.speaker\s*=\s*['"]female['"]|asset بصوت نورة/u,
  'طبقة التنويع ما زالت تثبت الإحالة على نورة')

console.log(`✓ Master Dialogue Writer: ${prompt.length} حرف · 6 عائلات · JSON إنتاجي · قفل Same-Take واحد`)
