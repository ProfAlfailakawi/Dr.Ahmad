#!/usr/bin/env node
/**
 * فلتر النص الكويتي الحضري — **يوسم ولا يخترع**.
 *
 * خلاصة صديق الدكتور (٢٢ أغسطس ٢٠٢٦): «أكبر قفزة من هنا راح تجي من
 * تنظيف النص، مو إضافة أسماء لهجات أخرى إلى المنع… البرومت ما يقدر
 * يحوّل الجملة الفصيحة أو المكتوبة إلى أداء كويتي طبيعي من نفسه».
 * وحكمه على الملفين: «نهائي-١ كويتي يقدّم فكرة · نهائي-٣ مقدّم محتوى
 * خليجي يحاول يتكلم كويتي» — والفرق كله في النص لا في الصوت.
 *
 * ولماذا يوسم ولا يبدّل؟ لأن اختراعاتي الثلاثة سقطت بأذن الدكتور
 * واحداً بعد واحد (يشرد · منظرة · يتْمَحَّن). فالبدائل تأتي منه أو من
 * صديقه، وهذا الفلتر يرسم لهما **أين** تحتاج الجملة يداً، لا يكتبها.
 *
 *   node scripts/flag-written-register.mjs --file=src/data/kuwaiti-diwania-v3.json
 *   node scripts/flag-written-register.mjs --self-test
 */
import assert from 'node:assert/strict'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const SELF_TEST = process.argv.includes('--self-test')
const FILE = process.argv.find((a) => a.startsWith('--file='))?.slice(7) || 'src/data/kuwaiti-diwania-v3.json'

/* ما رصده صديقه بالاسم في الملفين، معمَّماً على أنماطه لا على كلماته. */
export const SIGNALS = [
  { id: 'مصطلح أكاديمي', re: /ميتا[- ]?(تحليل|أناليسس)|دراسة طولية|عينة عشوائية|ارتباط إحصائي|مؤشر دال/u,
    why: 'يحوّل الأداء من سالفة إلى مذيع يقرأ مادة علمية' },
  { id: 'فعل فصيح صريح', re: /(^|[\s،])(كاد|كادت|بات|باتت|أضحى|غدا|شرع|أخذ ي|لم يعد|لن)(\s|$)/u,
    why: 'الفصحى الصريحة تكسر الوهم فوراً' },
  { id: 'تركيب مقالي', re: /(^|[\s،])(إن الإنسان|إن الطالب|وبقى|وبقي|مقصور على|انسحب من المشهد|في الضوء)(\s|$)/u,
    why: 'جملة كاتب لا جملة محادثة' },
  { id: 'سؤال محايد', re: /وين الخسارة|ما الفائدة|ما الحل|ما السبب/u,
    why: 'عربية محايدة — الكويتي يقول «زين وين المشكلة»' },
  { id: 'نداء خطابي', re: /(^|[\s،])(ويا آباء|ويا أولياء|أيها|يا معشر)/u,
    why: 'نبرة خطبة أو إعلان توعوي' },
  { id: 'جملة طويلة معلوماتية', re: /^.{95,}$/u,
    why: 'الجملة الطويلة تدفع الصوت لوضعية المذيع' },
]

export function flagTurns (turns) {
  const out = []
  turns.forEach((t, i) => {
    const text = String(t.text ?? '')
    for (const s of SIGNALS) if (s.re.test(text)) out.push({ at: i, id: s.id, why: s.why, text })
  })
  return out
}

if (SELF_TEST) {
  const bad = flagTurns([
    { text: 'ترى أكو ميتا-تحليل منشور في مجلة علمية عن الموضوع.' },
    { text: 'إنه كاد ينسى ليش يسوي اللي يسويه.' },
    { text: 'وبقى السؤال التكنولوجي بروحه في الضوء.' },
    { text: 'وين الخسارة في هذا؟' },
  ])
  assert.ok(bad.some((f) => f.id === 'مصطلح أكاديمي'), 'المصطلح الأكاديمي يُوسم')
  assert.ok(bad.some((f) => f.id === 'فعل فصيح صريح'), '«كاد» تُوسم — رصدها صديقه بالاسم')
  assert.ok(bad.some((f) => f.id === 'تركيب مقالي'), 'التركيب المقالي يُوسم')
  assert.ok(bad.some((f) => f.id === 'سؤال محايد'), 'السؤال المحايد يُوسم')
  const good = flagTurns([{ text: 'إي والله، إي بالضبط.' }, { text: 'بس في شي داخله ساكت.' }, { text: 'الحمد لله عدّت.' }])
  assert.equal(good.length, 0, 'الجمل التي مدحها صديقه تمرّ بلا وسم')
  /* والأهم: هذا الملف لا يبدّل كلمةً واحدة — يوسم فقط. */
  assert.ok(!/writeFileSync\(.*turns/.test(readFileSync(resolve(ROOT, 'scripts/flag-written-register.mjs'), 'utf8')),
    'الفلتر لا يكتب في المتن — يوسم ولا يخترع')
  console.log('✓ فلتر النص: الفحص الذاتي 6/6 — يوسم ولا يخترع')
  process.exit(0)
}

const path = resolve(ROOT, FILE)
if (!existsSync(path)) { console.log('ℹ لا ملف: ' + FILE); process.exit(0) }
const data = JSON.parse(readFileSync(path, 'utf8'))
const episodes = data.episodes || data
const rows = []
let flagged = 0; let turns = 0
for (const [slug, ep] of Object.entries(episodes)) {
  const t = Array.isArray(ep) ? ep : Object.values(ep)
  turns += t.length
  const f = flagTurns(t)
  if (f.length) { flagged += f.length; rows.push({ slug, count: f.length, items: f }) }
}
rows.sort((a, b) => b.count - a.count)
console.log(`فُحص ${Object.keys(episodes).length} حلقة · ${turns} مداخلة · ${flagged} موضعاً بنَفَسٍ مكتوب\n`)
const byId = {}
for (const r of rows) for (const i of r.items) byId[i.id] = (byId[i.id] || 0) + 1
Object.entries(byId).sort((a, b) => b[1] - a[1]).forEach(([k, v]) => console.log(`  ${String(v).padStart(4)} × ${k}`))
console.log('\nأثقل عشر حلقات — هذه أولى بيد الدكتور أو صديقه:')
rows.slice(0, 10).forEach((r) => console.log(`  ${String(r.count).padStart(3)} · ${r.slug}`))
writeFileSync(resolve(ROOT, 'podcast-audits/written-register-flags.json'), JSON.stringify(rows, null, 1) + '\n')
console.log('\nالتفصيل الكامل: podcast-audits/written-register-flags.json')
console.log('ملاحظة: هذا الفلتر **لا يبدّل كلمة** — البدائل من الدكتور أو صديقه وحدهما.')
