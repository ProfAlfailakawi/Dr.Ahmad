#!/usr/bin/env node
/**
 * بوابة المنطوق — تفحص ما سيصل المحرّك فعلاً، بعد تجهيز المصدر.
 *
 * حكم الدكتور (٢٢ أغسطس ٢٠٢٦): «كانت كل الاختبارات مجتازة — راجع كل
 * الاختبارات». وكان محقّاً: مراجعةُ السلسلة كشفت أربعة أعطاب تجعل
 * الخُضرة كذباً:
 *   ١) الفواحص كلها تعمل في الخطوة ٣ من ورشة الكناريا، والمصدر الحقيقي
 *      يُكتب في الخطوة ٤ — فكل فاحصٍ يحكم على ملفٍّ ليس هو المنطوق.
 *   ٢) قائمة المنع في verify-kuwaiti-dialogues فيها ١٥ كلمة مصرية
 *      وشامية و**صفر إماراتية** — فلا تمسك «نحنا» ولا أخواتها.
 *   ٣) guard-diwania-kuwaitiness مربوطٌ بـ--self-test وحده: يختبر نفسه
 *      على بيانات مصطنعة ولا يفحص حلقةً واحدة.
 *   ٤) guard-name-pronunciation موصولٌ بورشة الفصحى لا بالكويتية —
 *      فاسم الدكتور بلا حارسٍ في كل توليدٍ كويتي (قيل خطأً ٤ من ٥).
 *
 * وهذا الحارس يقف حيث يجب: على `manual-dialogues-kuwaiti/` بعد كتابتها،
 * ويفحص **الصيغة المنطوقة** (بعد المعجم والقلب) لا النص المعروض.
 *
 *   node scripts/guard-spoken-episode.mjs --dir=manual-dialogues-kuwaiti
 *   node scripts/guard-spoken-episode.mjs --self-test
 */
import assert from 'node:assert/strict'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildPronunciationMap, toSpokenKuwaiti, buildForeignRedactions, redactForeignNames, stripTashkeel } from './lib/kuwaiti-pronunciation.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const SELF_TEST = process.argv.includes('--self-test')
const DIR = process.argv.find((a) => a.startsWith('--dir='))?.slice(6) || 'manual-dialogues-kuwaiti'

const SRC = JSON.parse(readFileSync(resolve(ROOT, 'src/data/kuwaiti-pronunciation.json'), 'utf8'))
const MAP = buildPronunciationMap(SRC)
const RED = buildForeignRedactions(SRC)
export const spoken = (t) => toSpokenKuwaiti(redactForeignNames(String(t ?? ''), RED), MAP)

/* ═══ قائمة المنع الموسّعة — الإماراتي والعماني أولاً ═══
   القائمة القديمة كانت تحرس من المصري والشامي، وهما لم يكونا المشكلة
   قط. وكل ما شكا منه الدكتور مرّ بلا مانع. هذه مبنيّة من شكاواه هو. */
export const FOREIGN = {
  'نحنا': 'إماراتية/شامية — الكويتي «احنا»',
  'اشحالك': 'إماراتية — الكويتي «شلونك»',
  'شحالك': 'إماراتية — الكويتي «شلونك»',
  'شحال': 'إماراتية — الكويتي «شلون/جم»',
  'يبا': 'إماراتية — الكويتي «يبه/أبوي»',
  'حياك': 'خليجية عامة في موضع التحية الكويتية «حيا الله»',
  'وايدين': 'إماراتية — الكويتي «وايد»',
  'مب': 'إماراتية — الكويتي «مو»',
  'ماكوش': 'مسخ — الكويتي «ماكو»',
  'شفيك': 'مقبولة لكن تُراقب — الكويتي «شفيه/شبك»',
  'عاد شو': 'شامية',
  'هيه': 'إماراتية في موضع «إي»',
  'زين انت': 'تركيب غير كويتي',
  'چذيه': 'إماراتية — الكويتي «جذي»',
  'الحين شو': 'خليط',
}

/* الكلمات التي شكا منها بأذنه ولم تُعالَج بعد — تُوسم تحذيراً لا سقوطاً
   حتى تُحسم في المختبر، فلا تمرّ صامتةً مرّةً أخرى. */
export const EAR_FLAGGED = ['الهنايا', 'يعلى', 'تنجر', 'تصنه', 'يشرد', 'منين', 'بصدق']

/* كلمات القاف المرشحة للمختبر — ليست أمراً بقلبها إلى گ. تُقرأ من البيانات
   كي يبقى القرار معجمياً، وتُحصى للوعي وإعادة الصياغة اليدوية إن كان قفل
   المصدر يسمح، لا لتصفيرها آلياً. */
export const QAF_CANDIDATES = Array.isArray(SRC.qafCandidates) ? SRC.qafCandidates : []

/* أحكام أذن سقطت داخل حلقة كاملة بعد نجاح العينة المعزولة. لا نعيد تخمين
   حركاتها ولا نعمم همزة وصل عليها؛ أي تصريف جديد يقف قبل Gemini إلى أن
   يختاره الدكتور في مختبر السياق الطويل. «الكهربا» فخ مقابل: فيها حروف
   هرب متجاورة لكنها ليست من الجذر، لذلك المطابقة صرفية مقيدة لا includes. */
export const EAR_BLOCKED = Array.isArray(SRC.earBlockedUntilAudition) ? SRC.earBlockedUntilAudition : []
const blockedToken = (word) => {
  const bare = stripTashkeel(String(word)).replace(/^[وفبل]?(?:ال)?/u, '')
  if (EAR_BLOCKED.includes('ركض') && /رك[ضظ]/u.test(bare)) return 'ركض'
  if (EAR_BLOCKED.includes('هرب') && /^(?:ا|أ|ن|ي|ت|م)?(?:تهرّ?ب|هرب)(?:ون|وا|ان|ها|ه|نا|كم|هم|ي)?$/u.test(bare)) return 'هرب'
  if (EAR_BLOCKED.includes('يقربنا') && bare === 'يقربنا') return 'يقربنا'
  return ''
}

/* اسم الدكتور — المعتمد في دفتر النطق. أي خاتمةٍ تحمل اسمه يجب أن
   تصل المحرّك بالصيغة المعتمدة نفسها حرفاً بحرف. */
export const NAME_SPOKEN = spoken('الفيلكاوي')

export function auditTurns (turns) {
  const hard = []; const soft = []; let qaf = 0
  for (const t of turns) {
    const raw = String(t.text ?? '')
    const say = spoken(raw)
    for (const token of `${raw} ${say}`.match(/[ء-يچگَُِّْ]+/gu) || []) {
      const root = blockedToken(token)
      if (root) hard.push(`«${token}» من عائلة ${root} سقطت بأذن الدكتور — يلزم سياق مختبر معتمد قبل Gemini`)
    }
    for (const [w, why] of Object.entries(FOREIGN)) {
      if (new RegExp('(^|[\\s،.!؟…])' + w + '($|[\\s،.!؟…])', 'u').test(say)) hard.push(`دخيلة «${w}» — ${why}`)
    }
    for (const w of EAR_FLAGGED) if (say.includes(w)) soft.push(`كلمة شكا منها بأذنه ولم تُحسم: «${w}»`)
    for (const w of QAF_CANDIDATES) if (new RegExp('(^|[\\s،.!؟…])و?' + w, 'u').test(say)) qaf += 1
    if (/[A-Za-z]/.test(say)) hard.push(`حرف لاتيني يصل المحرّك: «${say.match(/\S*[A-Za-z]+\S*/)[0]}»`)
    if (/[0-9٠-٩%]/.test(say)) hard.push(`رقم خام يصل المحرّك: «${say.match(/\S*[0-9٠-٩%]+\S*/)[0]}»`)
  }
  /* الاسم: إن ذُكر فبالصيغة المعتمدة، وإلا فهو خطأٌ صامت. */
  const closing = spoken(String(turns[turns.length - 1]?.text ?? ''))
  if (/الفيل/.test(closing) && !closing.includes(NAME_SPOKEN)) {
    hard.push(`اسم الدكتور بغير الصيغة المعتمدة (${NAME_SPOKEN}) في الخاتمة`)
  }
  return { hard, soft, qaf }
}

if (SELF_TEST) {
  const bad = auditTurns([{ text: 'نحنا نقول جذي' }, { text: 'المقال في موقع الدكتور أحمد الفيلباوي.' }])
  assert.ok(bad.hard.some((h) => h.includes('نحنا')), 'الدخيلة الإماراتية تُمسك — القائمة القديمة كانت تُمررها')
  assert.ok(bad.hard.some((h) => h.includes('اسم الدكتور')), 'اسمٌ بغير الصيغة المعتمدة يُمسك')
  const good = auditTurns([{ text: 'ترى هالشي وايد مهم' }, { text: 'تلقى المقال في موقع الدكتور أحمد حسين الفيلچاوي.' }])
  assert.equal(good.hard.length, 0, 'المتن الكويتي السليم يمرّ')
  /* MASTER VOICE DIRECTOR: المرشح يبقى بإملائه حتى يُختبر، والگ لا تصل
     تلقائياً إلا في صيغةٍ اختارها الدكتور سماعاً. */
  assert.ok(QAF_CANDIDATES.length > 20, 'قائمة المرشحين محفوظة للمختبر لا مفقودة')
  const q = auditTurns([{ text: QAF_CANDIDATES[0] + ' مرة ثانية' }])
  assert.ok(q.qaf >= 1, 'الإحصاء يرصد مرشح القاف بلا أن يبدله')
  assert.ok(!spoken(QAF_CANDIDATES[0]).includes('گ'), 'المرشح غير المختبر لا يُكتب گ آلياً')
  assert.ok(spoken('يقلب').includes('گ'), 'الصيغة المسموعة المعتمدة وحدها تبقى في المعجم')
  const flagged = auditTurns([{ text: 'وبدت الهنايا من كل صوب' }])
  assert.ok(flagged.soft.length > 0, 'الكلمات التي شكا منها لا تمرّ صامتة')
  const blocked = auditTurns([{ text: 'انركظ وايد، ونتهرّب، وبعدين يهرب، وشغل يقربنا.' }])
  assert.ok(blocked.hard.some((h) => h.includes('ركض')), 'عائلة ركض المرفوضة تقف قبل Gemini')
  assert.ok(blocked.hard.some((h) => h.includes('هرب')), 'عائلة هرب/تهرّب المرفوضة تقف قبل Gemini')
  assert.ok(blocked.hard.some((h) => h.includes('يقربنا')), 'يقرّبنا المرفوضة تقف قبل Gemini')
  assert.equal(auditTurns([{ text: 'الكهربا منتشرة بكل مكان.' }]).hard.length, 0,
    'الكهربا لا تُحسب خطأً من عائلة هرب')
  assert.ok(NAME_SPOKEN.length > 4, 'صيغة الاسم المعتمدة تُقرأ من دفتر النطق لا من الشيفرة')
  console.log('✓ بوابة المنطوق: الفحص الذاتي 13/13')
  process.exit(0)
}

const dir = resolve(ROOT, DIR)
if (!existsSync(dir)) { console.log('ℹ لا مجلد مصدرٍ مجهّز: ' + DIR); process.exit(0) }
const files = readdirSync(dir).filter((f) => f.endsWith('.json'))
if (!files.length) { console.log('⛔ مجلد المصدر فارغ — هذه البوابة يجب أن تعمل **بعد** تجهيز المصدر لا قبله.'); process.exit(1) }
let hard = 0; let soft = 0; let qaf = 0
for (const f of files) {
  const data = JSON.parse(readFileSync(resolve(dir, f), 'utf8'))
  const turns = Array.isArray(data) ? data : Object.values(data.turns || data)
  const r = auditTurns(turns)
  qaf += r.qaf
  if (r.hard.length || r.soft.length) {
    console.log('── ' + f.replace('.json', ''))
    for (const h of [...new Set(r.hard)]) { console.log('   ⛔ ' + h); hard += 1 }
    for (const s of [...new Set(r.soft)]) { console.log('   ⚠ ' + s); soft += 1 }
  }
}
console.log(`\nفُحص ${files.length} مصدراً منطوقاً · أخطاء قاطعة ${hard} · تحذيرات ${soft} · مرشحات قاف للمراجعة ${qaf} موضعاً`)
if (!hard) console.log('✅ ما يصل المحرّك نظيفٌ من الدخيل ومن اسمٍ مغلوط.')
process.exit(hard ? 1 : 0)
