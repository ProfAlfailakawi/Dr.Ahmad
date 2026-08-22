#!/usr/bin/env node
/**
 * حارس كويتية الديوانية — الضلع الناقص في فاحص DNA.
 *
 * حكم الدكتور على كناريا v2 (٢٢ أغسطس ٢٠٢٦): «الحوار روووعه والبشرية
 * والوضع الطبيعي والقطعات وكل شي جميل جداً — لكن مو كويتي لحد الحين،
 * والكلمات واللهجة مو كويتي إطلاقاً».
 *
 * والسبب مقيس: audit-kuwaiti-diwania-dna يحرس **الإيقاع** بـ٢٢ تأكيداً
 * (عدد الأدوار · الجسور · التداخل · الأسئلة · المدة) وثلاثة أسطر فقط
 * تمسّ اللهجة. وما يُقاس هو ما يتحسّن — فتحسّن الإيقاع وحده.
 *
 * هذا الحارس يقيس الضلع الآخر، وعتباته مأخوذة من متن الدكتور نفسه
 * لا من رأيي: كثافة العلامات في الـ١٤٤ الأصلية = ١٫٠٦/مداخلة.
 *
 *   node scripts/guard-diwania-kuwaitiness.mjs --file=src/data/kuwaiti-diwania-v2-canaries.json
 *   node scripts/guard-diwania-kuwaitiness.mjs --self-test
 */
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const SELF_TEST = process.argv.includes('--self-test')
const FILE = process.argv.find((a) => a.startsWith('--file='))?.slice(7) || 'src/data/kuwaiti-diwania-v2-canaries.json'

/* علامات الكويتي الحضري — نفس قائمة بوابة اللهجة، مضافاً إليها ما أقرّه
   الدكتور سماعاً (عقب · منو · يبت) وحرفا الحضر (چ · ظ). */
const MARKERS = ['شنو','شلون','وايد','هني','جذي','عيل','خوش','صج','أكو','ماكو','الحين','ترى','يبي','تبي','أبي','هالشي','هال','مو ','بس ','اللي','زين','يبت','جم ','ويا','عقب','چ','ظ','منو','شفيه']
/* حشوٌ عامٌّ يمرّ في أي لهجة عربية — كثرته تميّع الهوية الكويتية */
const FILLERS = ['يعني','يمكن','ممكن','طبعا','أكيد']

/* العتبات — كلها مقيسة من متن الدكتور الأصلي (١٤٤ حلقة، ٥٥٨٠ مداخلة) */
/* معايرةٌ على توزيع متن الدكتور نفسه (١٤٤ حلقة): الكثافة وسيطها ١٫٠٥
   ومئينها العاشر ٠٫٨٢؛ والحشو وسيطه ٣٪ ومئينه الخامس والتسعون ١٠٪.
   وهذه المعايرة صحّحت تشخيصي: كثافة v2 (٠٫٨٣–١٫٠) داخل مدى متنه فعلاً،
   فليست هي العلّة. العلّتان المقيستان: طوفان الحشو العام (١٤–٣١٪ = خمسة
   إلى عشرة أضعاف عادته) وانعدام وفاء المصدر. */
export const THRESHOLDS = {
  density: 0.82,        /* المئين العاشر لمتنه — ٩٠٪ من كتابته تعبره */
  fillerRatio: 0.10,    /* مئينه الخامس والتسعون */
  sourceFidelity: 0.60, /* كم مداخلةٍ أصلُها كلامُ الدكتور */
  nameInClosing: true,  /* «موقع الدكتور أحمد … الفيلچاوي» في الختام */
}

const norm = (s) => String(s || '').replace(/[ً-ْٰ]/g, '').replace(/\s+/g, ' ').trim()

export function measure (episodes, originals = {}) {
  const per = []
  for (const [slug, ep] of Object.entries(episodes)) {
    const turns = Array.isArray(ep) ? ep : Object.values(ep)
    const orig = originals[slug] ? (Array.isArray(originals[slug]) ? originals[slug] : Object.values(originals[slug])).map((t) => norm(t.text)) : null
    let hits = 0; let fillerTurns = 0; let fromSource = 0
    for (const t of turns) {
      const s = String(t.text || '')
      for (const m of MARKERS) hits += s.split(m).length - 1
      if (FILLERS.some((f) => new RegExp('(^|[\\s،.!؟…])' + f + '($|[\\s،.!؟…])', 'u').test(s))) fillerTurns += 1
      if (orig) { const n = norm(s); if (orig.some((o) => o === n || o === 'و' + n || (n.length > 25 && o.includes(n.slice(0, 25))))) fromSource += 1 }
    }
    const last = String(turns[turns.length - 1]?.text || '')
    per.push({
      slug,
      turns: turns.length,
      density: +(hits / turns.length).toFixed(2),
      fillerRatio: +(fillerTurns / turns.length).toFixed(2),
      sourceFidelity: orig ? +(fromSource / turns.length).toFixed(2) : null,
      nameInClosing: /الفيلچاوي|الفيلكاوي|موقع الدكتور/.test(last),
    })
  }
  return per
}

function report (per) {
  const fails = []
  console.log('حلقة'.padEnd(34) + 'كثافة  حشو   وفاء   الاسم')
  for (const r of per) {
    const bad = []
    if (r.density < THRESHOLDS.density) bad.push(`كثافة ${r.density} < ${THRESHOLDS.density}`)
    if (r.fillerRatio > THRESHOLDS.fillerRatio) bad.push(`حشو ${Math.round(r.fillerRatio * 100)}% > ${THRESHOLDS.fillerRatio * 100}%`)
    if (r.sourceFidelity !== null && r.sourceFidelity < THRESHOLDS.sourceFidelity) bad.push(`وفاء المصدر ${Math.round(r.sourceFidelity * 100)}% < ${THRESHOLDS.sourceFidelity * 100}%`)
    if (THRESHOLDS.nameInClosing && !r.nameInClosing) bad.push('الختام بلا اسم الدكتور وموقعه')
    const mark = bad.length ? '✗' : '✓'
    console.log(mark + ' ' + r.slug.slice(0, 31).padEnd(32) + String(r.density).padEnd(7) + String(Math.round(r.fillerRatio * 100) + '%').padEnd(6) +
      String(r.sourceFidelity === null ? '—' : Math.round(r.sourceFidelity * 100) + '%').padEnd(7) + (r.nameInClosing ? 'نعم' : 'لا'))
    if (bad.length) fails.push({ slug: r.slug, bad })
  }
  if (!fails.length) { console.log('\n✅ كويتية الديوانية سليمة في كل الحلقات.'); return 0 }
  console.log('\n⛔ ' + fails.length + ' حلقة دون العتبة:')
  for (const f of fails) console.log('   · ' + f.slug + ' → ' + f.bad.join(' · '))
  console.log('\nالعتبات معايَرة على توزيع متن الدكتور: الكثافة مئينه العاشر (٠٫٨٢) والحشو مئينه ٩٥ (١٠٪).')
  console.log('العلاج: كتابة المداخلات من كلام الدكتور نفسه (وفاء المصدر)، وزيادة العلامات القحّة،')
  console.log('وإعادة سطر الإحالة كاملاً: «تلقى المقال الأصلي في موقع الدكتور أحمد حسين الفيلچاوي».')
  return 1
}

if (SELF_TEST) {
  const good = { ep: [{ text: 'ترى هالشي وايد مهم، شنو رايك؟' }, { text: 'إي صج، بس عقب جذي شلون نسوي؟' },
    { text: 'وإذا تبي الفكرة كاملة، تلقى المقال الأصلي في موقع الدكتور أحمد حسين الفيلچاوي.' }] }
  const bad = { ep: [{ text: 'يعني أمس واحد كان يكلمني عن ولده.' }, { text: 'يمكن هذه طبيعته؟' },
    { text: 'المقال الكامل موجود في الموقع.' }] }
  const g = measure(good)[0]; const b = measure(bad)[0]
  assert.ok(g.density >= THRESHOLDS.density, 'المتن الكويتي القحّ يعبر عتبة الكثافة')
  assert.ok(g.nameInClosing, 'الختام السليم يحمل اسم الدكتور وموقعه')
  assert.ok(b.density < THRESHOLDS.density, 'النص العام يسقط في الكثافة — وهذه علّة كناريا v2')
  assert.ok(b.fillerRatio > THRESHOLDS.fillerRatio, 'كثرة «يعني/يمكن» تُرصد')
  assert.ok(!b.nameInClosing, 'اختفاء اسم الدكتور من الختام يُرصد')
  const withSrc = measure({ ep: [{ text: 'كلام جديد ما قاله الدكتور' }] }, { ep: [{ text: 'كلام الدكتور الأصلي' }] })[0]
  assert.ok(withSrc.sourceFidelity === 0, 'وفاء المصدر يُقاس: نصٌّ مخترع = صفر')
  console.log('✓ حارس كويتية الديوانية: الفحص الذاتي 6/6')
  process.exit(0)
}

/* التنفيذ المباشر وحده — الاستيراد للقياس لا يفحص ولا يخرج (نفس فخ المصنع). */
const RUN_MAIN = process.argv[1] && process.argv[1].endsWith('guard-diwania-kuwaitiness.mjs')
if (RUN_MAIN) {
const path = resolve(ROOT, FILE)
if (!existsSync(path)) { console.log('ℹ لا ملف: ' + FILE); process.exit(0) }
const data = JSON.parse(readFileSync(path, 'utf8'))
const episodes = data.episodes || data
const originalsPath = resolve(ROOT, 'src/data/kuwaiti-dialogues.json')
const originals = existsSync(originalsPath) ? JSON.parse(readFileSync(originalsPath, 'utf8')).episodes : {}
process.exit(report(measure(episodes, originals)))
}
