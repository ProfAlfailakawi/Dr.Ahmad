#!/usr/bin/env node
/**
 * كوكبات السماء: لا يُعرض للزائر مصطلحٌ ليس في معجم الدكتور.
 *
 * السماء تعرض أسماء مفاهيم بوصفها مصطلحاتٍ معتمدة؛ فإن تسرّب إليها لفظٌ
 * استنتاجيّ أو أدبيّ صار الموقع ينسب إلى الدكتور اصطلاحاً لم يضعه.
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const read = (path) => JSON.parse(readFileSync(resolve(root, path), 'utf8'))

const glossary = read('src/data/dr-ahmad-domain-glossary.json')
const payload = read('src/data/atlas-constellations.json')
const articles = new Set(Object.keys(read('src/data/bodies.json')))

const canonical = new Set(glossary.map((entry) => String(entry?.canonicalAr || '').trim()).filter(Boolean))
let passed = 0
const check = (label, fn) => { fn(); passed += 1; console.log(`✓ ${label}`) }

check('المعجم مرجعٌ حيّ لا فارغ', () => {
  assert.ok(canonical.size >= 100, `أسماء المعجم المعتمدة: ${canonical.size}`)
})

check('لكل كوكبة اسمٌ معتمد في المعجم', () => {
  const strangers = payload.constellations.filter((item) => !canonical.has(String(item.title || '').trim()))
  assert.deepEqual(strangers.map((item) => item.title), [], 'أسماء خارج المعجم')
})

check('كل محطة مقالٌ منشور فعلاً', () => {
  const missing = payload.constellations.flatMap((item) => item.slugs.filter((slug) => !articles.has(slug)))
  assert.deepEqual(missing, [], 'محطات لا تقابلها مقالات')
})

check('المسار محطتان موثقتان فأكثر ولا يكرّر مقالاً', () => {
  for (const item of payload.constellations) {
    assert.ok(item.slugs.length >= 2, `${item.title}: ${item.slugs.length} محطات`)
    assert.equal(new Set(item.slugs).size, item.slugs.length, `${item.title}: محطة مكررة`)
  }
})

check('المُنتقي يستحقّ أن يُفتح', () => {
  assert.ok(payload.constellations.length >= 8, `عدد الكوكبات المولّدة: ${payload.constellations.length}`)
})

console.log(`\nالنتيجة: ${passed} تحققاً ناجحاً، 0 إخفاقاً.`)
