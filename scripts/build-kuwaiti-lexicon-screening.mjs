#!/usr/bin/env node
/** يكتب دفتر الاختبار الطويل قبل التوليد كي تبقى الأرقام ثابتة وقابلة للمراجعة. */
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildKuwaitiLexiconScreening } from './lib/kuwaiti-lexicon-screening.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const OUT = resolve(ROOT, 'podcast-audits', 'kuwaiti-lexicon-screening.json')
const MD = resolve(ROOT, 'podcast-audits', 'kuwaiti-lexicon-screening.md')
const suite = buildKuwaitiLexiconScreening()
const numbered = suite.screening.map((item, index) => ({ number: suite.optionTests.length + index + 1, ...item }))
const payload = { ...suite, screening: numbered }

mkdirSync(dirname(OUT), { recursive: true })
writeFileSync(OUT, JSON.stringify(payload, null, 2) + '\n')
const lines = [
  '# مختبر المعجم الكويتي الصلب', '',
  `الإصدار: ${suite.version}`, '',
  `اختبارات الخيارات: ${suite.optionTests.length} · فحوص السياق: ${numbered.length} · المجموع: ${suite.optionTests.length + numbered.length}`, '',
  '## الكلمات المختلف عليها — اختر 1 أو 2 أو 3', '',
]
suite.optionTests.forEach((item, index) => lines.push(`${index + 1}. **${item.key}** — ${item.options.join(' · ')}`))
lines.push('', '## فحص الكلمات المتوقعة وغير المتوقعة — اكتب أرقام الخطأ فقط', '')
for (const item of numbered) lines.push(`${item.number}. **${item.key}** — ${item.carrier} _(${item.category})_`)
lines.push('', '## المراجع الخارجية للتغطية لا للحكم', '', ...suite.references.map((url) => `- ${url}`), '')
writeFileSync(MD, lines.join('\n'))
console.log(`✓ دفتر المعجم: ${suite.optionTests.length} خيارات · ${numbered.length} فحصاً · ${OUT}`)
