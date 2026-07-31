import fs from 'node:fs'
import path from 'node:path'
import { normalizeArabic } from './content-index.mjs'

/* ═══ المعنى قبل اللفظ ═══
   كان البوت يطابق الحروف: من سأل عن «تقييم الطلاب» لا يجد «التقويم التربوي»
   وهما الشيء نفسه عند الدكتور. وعندنا معجمٌ ضخم بُني بتعبٍ طويل — ٢٩٠ مفهوماً
   و١٣٢٢ اسماً بديلاً بالعربية والإنجليزية، لكلٍّ منها تعريفُه ومجالُه — ولم
   يكن البوت يفتحه قط.
   هنا نفتحه: نردّ لفظ السائل إلى مفهومه، ثم نبحث بكل أسماء المفهوم لا بلفظه
   وحده. ولا نخترع شيئاً — الأسماء والتعريفات من معجم الدكتور نفسه. */

const clean = (value) => normalizeArabic(String(value || '')).replace(/\s+/g, ' ').trim()

let cache = null

function loadGlossary(root) {
  const candidates = [
    path.join(root, 'src', 'data', 'dr-ahmad-domain-glossary.json'),
    path.join(process.cwd(), 'src', 'data', 'dr-ahmad-domain-glossary.json'),
  ]
  for (const file of candidates) {
    try {
      const rows = JSON.parse(fs.readFileSync(file, 'utf8'))
      if (Array.isArray(rows) && rows.length) return rows
    } catch { /* نجرّب المسار التالي */ }
  }
  return []
}

/* فهرسٌ يُبنى مرّةً واحدة: اسمٌ مطبَّع ← مفهومه. والأسماء القصيرة جداً تُستبعد
   لأنها تطابق كل شيء فتُفسد البحث بدل أن تحسّنه. */
export function conceptIndex(root = process.cwd()) {
  if (cache) return cache
  const rows = loadGlossary(root)
  const byAlias = new Map()
  const concepts = []
  for (const row of rows) {
    const canonicalAr = String(row?.canonicalAr || '').trim()
    if (!canonicalAr) continue
    const aliases = [...new Set([canonicalAr, String(row?.canonicalEn || ''), ...(Array.isArray(row?.aliases) ? row.aliases : [])]
      .map((alias) => clean(alias))
      .filter((alias) => alias.length >= 4))]
    if (!aliases.length) continue
    const concept = {
      id: String(row?.id || canonicalAr),
      canonicalAr,
      domain: String(row?.domain || ''),
      meaningAr: String(row?.meaningAr || ''),
      aliases,
    }
    concepts.push(concept)
    for (const alias of aliases) {
      if (!byAlias.has(alias)) byAlias.set(alias, concept)
    }
  }
  cache = { concepts, byAlias }
  return cache
}

/* أي مفاهيم يحملها هذا السؤال؟ نطابق الاسم كوحدةٍ كاملة (بحدود الكلمات) حتى
   لا يبتلع اسمٌ قصير كلمةً أطول منه فيغيّر معنى السؤال. */
export function conceptsInText(text, root = process.cwd()) {
  const haystack = ` ${clean(text)} `
  if (haystack.length <= 2) return []
  const { byAlias } = conceptIndex(root)
  const hits = new Map()
  for (const [alias, concept] of byAlias) {
    if (!haystack.includes(` ${alias} `)) continue
    const previous = hits.get(concept.id)
    if (!previous || alias.length > previous.alias.length) hits.set(concept.id, { concept, alias })
  }
  /* الأطول أدقّ: «التقويم البديل» أولى من «تقويم» حين ترد الاثنتان. */
  return [...hits.values()]
    .sort((a, b) => b.alias.length - a.alias.length)
    .map((row) => row.concept)
}

/* ألفاظ البحث الموسَّعة: أسماء المفهوم كلها — بها يجد السائلُ ما كتبه الدكتور
   بلفظٍ آخر. تُحدّ بعددٍ معقول كي لا يذوب السؤال في مرادفاته. */
export function conceptQueryFor(text, root = process.cwd()) {
  const matched = conceptsInText(text, root)
  if (!matched.length) return null
  const primary = matched[0]
  const terms = [...new Set([primary.canonicalAr, ...primary.aliases])]
    .filter((term) => /[؀-ۿ]/.test(term))
    .slice(0, 8)
  return { concept: primary, query: terms.join(' '), terms }
}

export function glossarySize(root = process.cwd()) {
  const { concepts, byAlias } = conceptIndex(root)
  return { concepts: concepts.length, aliases: byAlias.size }
}
