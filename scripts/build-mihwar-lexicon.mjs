// يولّد src/pages/mihwar-lexicon.json (مجموعات مترادفات مدمجة) من قاموس الموقع.
// التشغيل: node scripts/build-mihwar-lexicon.mjs   — والاختبار يتحقق أن الملف غير قديم.
import fs from 'node:fs'
import { normalizeText } from '../src/pages/mihwar-core.mjs'

export function buildLexicon() {
  const glossary = JSON.parse(fs.readFileSync(new URL('../src/data/dr-ahmad-domain-glossary.json', import.meta.url), 'utf8'))
  const syn = JSON.parse(fs.readFileSync(new URL('../src/data/encyclopedia-search-synonyms.json', import.meta.url), 'utf8'))
  const groups = []
  for (const g of glossary) {
    const terms = [g.canonicalAr, g.canonicalEn, ...(g.aliases || [])].map((s) => String(s || '').trim()).filter(Boolean)
    groups.push({ name: g.canonicalAr, terms: [...new Map(terms.map((t) => [normalizeText(t), t])).values()] })
  }
  for (const terms of syn.groups || []) groups.push({ name: terms[0], terms })
  return { version: 1, groups }
}

if (process.argv[1] && new URL(import.meta.url).pathname === process.argv[1]) {
  const out = new URL('../src/pages/mihwar-lexicon.json', import.meta.url)
  fs.writeFileSync(out, JSON.stringify(buildLexicon()) + '\n')
  console.log('lexicon written', fs.statSync(out).size, 'bytes')
}
