#!/usr/bin/env node
/**
 * مُفسِّرُ التعثُّر: يحوّل سجلَّ التشغيلة الإنجليزيَّ الطويل إلى سطرين بالعربية.
 *
 * العطب الذي يعالجه: تشغيلةُ الصوت فشلت كلَّ ساعةٍ يوماً كاملاً، والسببُ سطرٌ
 * واحدٌ مدفونٌ في مئات الأسطر: «Content-Length لا يطابق». الدكتور غير مبرمج،
 * فكان الفشل عنده حائطاً مصمتاً — يرى ✘ حمراء ولا يعرف ما العمل. وأنا نفسي
 * صرفتُ نصف ساعةٍ في تقصّيه.
 *
 * فلسفتُه: لا يخمّن. لكلِّ عطبٍ يعرفه بصمةٌ مقيسةٌ من سجلٍّ حقيقيّ، وسببٌ
 * بلغةٍ يفهمها صاحبُ الموقع، وأمرٌ واحدٌ يُصلحه. وما لا يعرفه يقوله صراحةً
 * ويعرض آخر أسطر الخطأ كما هي بدل أن يخترع تشخيصاً.
 *
 * الاستعمال:
 *   node scripts/explain-failure.mjs ci-log.txt
 *   cat log | node scripts/explain-failure.mjs
 *   node scripts/explain-failure.mjs --self-test
 */
import { existsSync, readFileSync } from 'node:fs'

const SELF_TEST = process.argv.includes('--self-test')

/* لكلِّ بصمةٍ: ما رآه المحرك · لماذا · وما يُصلحه. الترتيب مقصود: الأخصُّ أولاً،
   فبعض الأعطاب تتشارك كلماتٍ عامّة («فشل»، «error») فتلتقطها القاعدة الأعمّ. */
export const SIGNATURES = [
  {
    id: 'audio-meta-stale',
    match: /Content-Length\s+\d+\s+لا يطابق|لا يطابق\s+\d+/,
    what: 'سجلُّ الصوت متخلِّفٌ عن الواقع على R2',
    why: 'مدخلاتٌ في audio-meta.json تحمل أحجاماً قديمة، أو تشير إلى ملفاتٍ لم تعد موجودة. التوليدُ والرفعُ نجحا، لكنّ التحقّق أسقط التشغيلة كلَّها.',
    fix: 'npm run audio:reconcile -- --apply',
  },
  {
    id: 'audio-missing-404',
    match: /HTTP\s+404/,
    what: 'ملفُّ صوتٍ مذكورٌ في السجلّ وغيرُ موجودٍ على R2',
    why: 'حُذف الملفُّ من التخزين ولم يُحذف من السجلّ، فصار التحقّق يبحث عن شيءٍ لا وجود له.',
    fix: 'npm run audio:reconcile -- --apply',
  },
  {
    id: 'vocalized-mismatch',
    match: /stripTashkeel|النصّ المُشكَّل لا يطابق|تشكيلٌ لا يطابق/,
    what: 'النصُّ المُشكَّل لا يطابق المنشور',
    why: 'تعديلُ متنٍ منشورٍ بعد تشكيله يكسر مطابقةَ الحروف، فيُسقط المحرّكُ التشكيلَ ويعود للتخمين.',
    fix: 'node scripts/align-vocalized.mjs --apply',
  },
  {
    id: 'missing-secret',
    match: /غير مضبوط|is not set|required.*secret|Missing.*credential/i,
    what: 'سرٌّ أو متغيِّرٌ ناقصٌ في إعدادات المستودع',
    why: 'خطوةٌ تطلب مفتاحاً (R2 أو Azure أو Firebase) لم تجده في Secrets/Variables.',
    fix: 'راجع Settings ← Secrets and variables ← Actions، وتأكّد من اسم المفتاح المذكور أعلاه.',
  },
  {
    id: 'quota-exhausted',
    match: /quota|billing|429|RESOURCE_EXHAUSTED|insufficient.*fund/i,
    what: 'نفادُ رصيدٍ أو تجاوزُ حصّةٍ عند مزوِّدٍ خارجي',
    why: 'الخدمةُ رفضت الطلب لأسبابٍ ماليّةٍ أو حدِّ استعمال، لا لعطبٍ في الشيفرة.',
    fix: 'اشحن الرصيد أو انتظر تجدّد الحصّة — لا تُعِد التشغيل قبلها فستفشل ثانيةً.',
  },
  {
    id: 'r2-transaction-open',
    match: /transaction.*not committed|معاملةٌ مفتوحة|rollback/i,
    what: 'معاملةُ الرفع إلى R2 لم تُغلَق',
    why: 'سقطت التشغيلة بين الرفع والتثبيت، فبقيت ملفاتٌ معلّقةً لا مرفوعةً ولا ملغاة.',
    fix: 'npm run audio:r2:self-test ثم أعد التشغيل — الناشرُ الذّرّيُّ يُنظّف المعلَّق بنفسه.',
  },
  {
    id: 'npm-install',
    match: /npm ERR!|ERESOLVE|ENOTFOUND registry/,
    what: 'تعثَّر تركيبُ الحزم',
    why: 'انقطاعٌ في مستودع npm أو تعارضُ إصدارات. عطبُ بيئةٍ لا عطبُ محتوى.',
    fix: 'أعد تشغيل التشغيلة (Re-run) — الغالبُ أنّها تنجح دون تغييرِ شيء.',
  },
  {
    id: 'build-failed',
    match: /vite build failed|Build failed|tsc.*error TS/i,
    what: 'فشل بناءُ الموقع',
    why: 'خطأٌ في الشيفرة أو في ملفِّ بيانات، منع توليدَ نسخة النشر.',
    fix: 'npm run build محليّاً لرؤية الخطأ كاملاً قبل أيّ رفع.',
  },
]

export function explain(log) {
  const text = String(log ?? '')
  const hits = SIGNATURES.filter((s) => s.match.test(text))
  /* آخرُ أسطر الخطأ تُعرض دائماً: إن عرفنا السبب فهي شاهد، وإن جهلناه فهي كلُّ ما نملك. */
  const errorLines = text.split('\n')
    .filter((line) => /✘|✗|error|Error|failed|فشل|##\[error\]/.test(line))
    /* سجلُّ Actions يسبق كلَّ سطرٍ باسم الوظيفة والخطوة وطابعِ وقتٍ بفواصل جدولة،
       ثم رموزِ تلوين. تُزال كلُّها وإلّا وصل السطرُ للدكتور مشوَّشاً غيرَ مقروء. */
    .map((line) => line
      .replace(/\x1b\[[0-9;]*m/g, '')
      .replace(/^﻿/, '')
      .replace(/^(?:[^\t]*\t)+/, '')
      .replace(/^\d{4}-\d{2}-\d{2}T\S+\s*/, '')
      .replace(/##\[error\]/g, '')
      .trim())
    .filter(Boolean)
    .slice(-6)
  return { hits, errorLines }
}

export function render({ hits, errorLines }, { runUrl = '' } = {}) {
  const lines = ['## تعثَّرت تشغيلة الصوت', '']
  if (hits.length === 0) {
    lines.push('**سببٌ غير معروف للمُفسِّر.** لم تطابق أيُّ بصمةٍ يعرفها.', '')
    lines.push('أرسل الأسطر التالية كما هي ولا تُعِد التشغيل قبل معرفة السبب:', '')
  } else {
    /* عطبان مختلفان قد يشتركان في العلاج — يُعرض السببان ويُكتب الأمرُ مرّةً
       واحدة، وإلّا ظنّ الدكتور أنّ عليه تشغيله مرّتين. */
    const groups = []
    for (const h of hits) {
      const found = groups.find((g) => g.fix === h.fix)
      if (found) found.causes.push(h); else groups.push({ fix: h.fix, causes: [h] })
    }
    for (const g of groups) {
      for (const c of g.causes) {
        lines.push(`**ما حدث:** ${c.what}`, '')
        lines.push(`**لماذا:** ${c.why}`, '')
      }
      lines.push('**ما يُصلحه:**', '', '```', g.fix, '```', '')
    }
    if (groups.length > 1) lines.push('_أكثرُ من عطبٍ مستقلٍّ في تشغيلةٍ واحدة — عالجها بالترتيب أعلاه._', '')
    lines.push('**الشاهد من السجلّ:**', '')
  }
  lines.push('```')
  lines.push(...(errorLines.length ? errorLines : ['(لا أسطرَ خطأ في السجلّ المُلتقَط)']))
  lines.push('```')
  if (runUrl) lines.push('', `[السجلُّ الكامل](${runUrl})`)
  return lines.join('\n')
}

if (SELF_TEST) {
  let pass = 0, fail = 0
  const assert = (cond, name) => { if (cond) pass += 1; else { fail += 1; console.error(`✘ ${name}`) } }

  const stale = explain('✘ فشل فحص 7 ملفاً\n- a.mp3: Content-Length 3079985 لا يطابق 1324224')
  assert(stale.hits.some((h) => h.id === 'audio-meta-stale'), 'يلتقط السجلّ المتخلّف')
  assert(/audio:reconcile/.test(render(stale)), 'يعرض أمر المصالحة')

  assert(explain('- x.mp3: HTTP 404').hits.some((h) => h.id === 'audio-missing-404'), 'يلتقط الملف المفقود')
  assert(explain('AUDIO_PUBLIC_BASE_URL غير مضبوط').hits.some((h) => h.id === 'missing-secret'), 'يلتقط السرّ الناقص')
  assert(explain('RESOURCE_EXHAUSTED: quota').hits.some((h) => h.id === 'quota-exhausted'), 'يلتقط نفاد الرصيد')
  assert(explain('npm ERR! ERESOLVE').hits.some((h) => h.id === 'npm-install'), 'يلتقط تعثّر الحزم')

  /* الصمتُ أمانةٌ: ما لا يُعرف يُقال إنّه لا يُعرف. */
  const unknown = explain('Something entirely unexpected happened\nError: boom')
  assert(unknown.hits.length === 0, 'لا يخمّن سبباً لا يعرفه')
  assert(/غير معروف للمُفسِّر/.test(render(unknown)), 'يصرّح بجهله')
  assert(/boom/.test(render(unknown)), 'يعرض سطر الخطأ الخام عند الجهل')

  assert(explain('').hits.length === 0 && render(explain('')).length > 0, 'لا ينهار أمام سجلٍّ فارغ')
  assert(/لا أسطرَ خطأ/.test(render(explain('كل شيء بخير'))), 'يقول إن لا أسطر خطأ')

  /* رموز التلوين وطوابع الوقت تُزال، وإلّا وصل السطرُ للدكتور مشوّشاً. */
  const noisy = explain('gen\tstep\t2026-07-20T13:19:12.6792085Z \x1b[31m✘ فشل الفحص\x1b[0m')
  assert(noisy.errorLines[0] === '✘ فشل الفحص', 'ينظّف الطابع والتلوين')

  const two = explain('HTTP 404\nnpm ERR! boom')
  assert(two.hits.length === 2 && /بالترتيب أعلاه/.test(render(two)), 'يعالج تعدّد الأعطاب')

  /* عطبان يتشاركان العلاج: سببان معروضان وأمرٌ واحد. */
  const shared = render(explain('Content-Length 5 لا يطابق 9\nHTTP 404'))
  assert((shared.match(/audio:reconcile/g) || []).length === 1, 'لا يكرّر الأمر المشترك')
  assert((shared.match(/\*\*ما حدث:\*\*/g) || []).length === 2, 'يعرض السببين معاً')
  assert(!/بالترتيب أعلاه/.test(shared), 'لا يقول «بالترتيب» والعلاج واحد')
  assert(/السجلُّ الكامل/.test(render(stale, { runUrl: 'https://x' })), 'يضيف رابط السجلّ')

  console.log(`${fail === 0 ? '✓' : '✘'} اختبارات مُفسِّر التعثُّر: ${pass}/${pass + fail}`)
  process.exit(fail === 0 ? 0 : 1)
}

const file = process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : ''
let log = ''
// غياب الملف ليس «لا أخطاء»: معناه أن التعثُّر وقع قبل أن تبلغ التشغيلةُ أوّلَ
// خطوةٍ تُسجِّل مخرجاتها (التنصيب أو الأسرار مثلاً). قُل ذلك بدل الصمت.
let missing = false
if (file) {
  if (existsSync(file)) log = readFileSync(file, 'utf8')
  else missing = true
} else if (!process.stdin.isTTY) {
  // القراءة المتزامنة من أنبوبٍ حيّ (`gh run view … | …`) ترمي EAGAIN لأن الطرف
  // الآخر ما زال يكتب. نقرأه دفقاً حتى النهاية بدل أن نسقط عند أول تعثُّر.
  const chunks = []
  for await (const chunk of process.stdin) chunks.push(chunk)
  log = Buffer.concat(chunks).toString('utf8')
}

console.log(render(explain(log), { runUrl: process.env.RUN_URL || '' }))
if (missing) {
  console.log(
    '\n> لم يُنشأ سجلٌّ أصلاً — أي أنّ التعثُّر وقع **قبل** التوليد:',
    'في تنصيب الحزم أو في الأسرار أو في الفحص الذاتي. افتح السجلَّ الكامل أعلاه.',
  )
}
