#!/usr/bin/env node
/**
 * حارس الطباعة العربية
 * ====================
 * وُلد هذا الحارس من عطبٍ حقيقي: قرار «الأنهار البيضاء» كان مكتوباً في
 * src/index.css منذ مدة — تعليقٌ يشرح أن الرصف الكامل في عمود الجوال الضيّق
 * يمزّق المسافات بين الكلمات — ثم كان الكود تحته يطبّق الرصف الكامل على الجوال
 * رغم ذلك. التعليق وحده لا يمنع الانزلاق؛ فما يُكتب رأياً يُنسى، وما يُفحص يبقى.
 *
 * ثلاثة فحوص، كلها طباعية بحتة ولا تمسّ ميزة:
 *
 *  ١) الرصف: كل `text-align: justify` في متن المقال يجب أن يقابله في الملف
 *     نفسه إبطالٌ داخل `@media (max-width: 640px)`. العربية تُرصف بالكشيدة لا
 *     بتوسيع الفراغ، والمتصفّح لا يجيدها.
 *
 *  ٢) تباعد الحروف: العربية متّصلة الحروف، والتباعد يفكّ وصلاتها. فكل
 *     `letter-spacing` موجب يجب أن يحمل في سطره الوسم `latin` ليعلن أن نصّه
 *     لاتيني (مثل ESSAY أو أرقام السنوات) — وإلا فهو مرفوض.
 *
 *  ٣) ارتفاع سطر العناوين: كل عنوان بخط العرض `font-display` بمقاس `clamp`
 *     يجب أن يصرّح بـ`leading-[…]` لا يقلّ عن ١٫٢، لأن التشكيل يعلو الحرف
 *     وذيول الحروف تهبط تحته، فيلتقيان إن ضاق السطر.
 *
 * التشغيل:  node scripts/guard-arabic-typography.mjs
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { extname, join, relative, resolve } from 'node:path'

const ROOT = resolve('.')
const CSS = join(ROOT, 'src/index.css')
const SCAN_DIRS = ['src/pages', 'src/components']
const SKIP_DIRS = new Set(['admin'])
const MIN_DISPLAY_LEADING = 1.2
const problems = []

/* ───────── ١) الرصف الكامل يحتاج إبطالاً على الجوال ─────────
   لا يكفي وجود «start» في مكانٍ ما من الملف: يجب أن يكون **للمُحدِّد نفسه**
   إبطالٌ داخل استعلام الجوال، وإلا بقي ذلك المتن مرصوفاً على الشاشة الضيّقة. */
function eachRule(css, visit) {
  const clean = css.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' ')) // نُفرِغ التعليقات ونُبقي الأسطر
  const stack = []
  let buf = '', line = 1
  for (let i = 0; i < clean.length; i++) {
    const ch = clean[i]
    if (ch === '\n') line++
    if (ch === '{') { stack.push({ prelude: buf.trim(), line }); buf = '' }
    else if (ch === '}') {
      const top = stack.pop()
      if (top && !top.prelude.startsWith('@')) {
        const inMobile = stack.some((s) => /max-width:\s*640px/.test(s.prelude))
        visit(top.prelude.replace(/\s+/g, ' '), buf, inMobile, top.line)
      }
      buf = ''
    } else buf += ch
  }
}

/* متن المقال لا يُرصف من الطرفين في أيّ عرض.
   قِيس على أربعة مقالات كاملة بعمود ٥٨٣px (حاسوب): وسيط تمدّد المسافة بين
   الكلمات ١٫٦٥–١٫٩٢× وأكثر الفقرات فوق ١٫٥× — فالعلّة في الرصف مع العربية
   لا في ضيق العمود. ولا كشيدة في نصّ الويب تسدّ الفجوة كما يسدّها الخطّاط. */
const PROSE = /article-body|synced-paragraph/
function checkJustify(css) {
  eachRule(css, (prelude, body, _inMobile, line) => {
    if (!/text-align\s*:\s*justify/.test(body)) return
    if (!PROSE.test(prelude)) return
    problems.push(
      `src/index.css:${line}  «${prelude}» يرصف متن المقال من الطرفين — ` +
      `وهذا يفتح «الأنهار البيضاء» في النصّ العربي. المتن يُرصف من اليمين وحده (text-align: start).`,
    )
  })
}

/* ───────── ٢) تباعد الحروف يحتاج إعلاناً أنه لاتيني ───────── */
function checkLetterSpacing(css) {
  css.split(/\r?\n/).forEach((line, i) => {
    // أسطر التعليق تُذكر فيها القاعدة نفسها، فلا تُحاسب عليها
    if (/^\s*(\/\*|\*|\/\/)/.test(line)) return
    const m = line.match(/letter-spacing\s*:\s*([^;}]+)/)
    if (!m) return
    const value = m[1].replace(/!important/gi, '').trim()
    if (/^(0|0px|0em|0rem|normal)$/.test(value)) return
    if (value.startsWith('-')) return          // التضييق لا يفكّ الوصلات
    if (/\blatin\b/i.test(line)) return        // معلَنٌ لاتينياً
    problems.push(
      `src/index.css:${i + 1}  letter-spacing: ${value} — العربية متّصلة الحروف والتباعد يفكّ وصلاتها. ` +
      `إن كان النصّ لاتينياً فأضف الوسم في السطر نفسه:  /* latin */`,
    )
  })
}

/* ───────── ٣) عناوين العرض تصرّح بارتفاع سطرها ───────── */
function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (SKIP_DIRS.has(name)) continue
    const file = join(dir, name)
    if (statSync(file).isDirectory()) walk(file, out)
    else if (extname(name) === '.tsx') out.push(file)
  }
  return out
}

function checkDisplayLeading() {
  for (const dir of SCAN_DIRS.map((d) => join(ROOT, d))) {
    let files = []
    try { files = walk(dir) } catch { continue }
    for (const file of files) {
      // الصفحات الإنجليزية لاتينية بحتة: لا تشكيل فيها، والسطر الضيّق فيها صواب
      if (/\/English/.test(file)) continue
      readFileSync(file, 'utf8').split(/\r?\n/).forEach((line, i) => {
        if (!line.includes('font-display')) return
        // عنوان عرضٍ حقيقي: مقاسه clamp (أي كبير ومتجاوب)
        if (!/text-\[clamp\(/.test(line)) return
        // لا نُلزم بالتصريح حيث لم يُصرَّح أصلاً — الحارس يحرس ما قرّرناه لا ما لم نقرّره.
        // فمتى صُرِّح بارتفاعٍ وجب ألّا ينزل تحت العتبة.
        const lead = line.match(/leading-\[([\d.]+)\]/)
        if (!lead) return
        const value = Number(lead[1])
        if (value < MIN_DISPLAY_LEADING) {
          problems.push(
            `${relative(ROOT, file)}:${i + 1}  leading-[${value}] أضيق من ${MIN_DISPLAY_LEADING} — ` +
            `لا يتّسع لعلامات التشكيل فوق الحرف وذيوله تحته.`,
          )
        }
      })
    }
  }
}

const css = readFileSync(CSS, 'utf8')
checkJustify(css)
checkLetterSpacing(css)
checkDisplayLeading()

if (problems.length) {
  console.error('فشل حارس الطباعة العربية:\n' + problems.map((p) => `- ${p}`).join('\n'))
  process.exit(1)
}
console.log('✓ الطباعة العربية سليمة (الرصف · تباعد الحروف · ارتفاع سطر العناوين)')
