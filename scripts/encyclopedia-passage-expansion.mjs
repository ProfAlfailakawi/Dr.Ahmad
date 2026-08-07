/**
 * فهرس متن موسوعة تكنولوجيا التعليم — من صفحات الكتاب نفسها، ببرهانٍ لا اجتهاد.
 *
 * ما قبل هذا الملف كان «توسعةً»: يعيد تقطيع ٢٨٠ مقطعاً قديماً إلى نوافذ كلمات
 * متداخلة، فيتضخم العدد إلى ٢١٧٧ بينما التغطية الحقيقية ١٧٤ صفحة من ٦٩٦.
 * وهذا الباني يعود إلى المصدر ويقرأ الكتاب كله بمستخرجَين يكمّل أحدهما الآخر،
 * كلٌّ فيما يُتقنه وحده:
 *
 *   • هندسة الصفحة (PyMuPDF): تعطي **الترتيب والبنية**. كل إطار طباعي (block)
 *     يخرج وحدةً مستقلة، وسطوره تُقرأ يميناً فيساراً بإحداثياتها — فينحلّ من
 *     أصله تشابكُ الأعمدة والأشرطة الجانبية وحواشي الصور. لكنها تعكس مكوّنات
 *     لقاء «لام» داخل الكلمة (المستحدثات ← املستحدثات) فلا تصلح نصاً.
 *   • مجرى النص (pypdf): يعطي **الحروف** بصورتها الصحيحة وتشكيلها، لكن ترتيبه
 *     يخلط الأعمدة ويقذف الأرقام في غير مواضعها.
 *
 * فيُبنى النص من الاثنين: ترتيبُ الهندسة، وحروفُ المجرى. والوصل بينهما بمفتاحٍ
 * محايدٍ للانعكاس (حروف الكلمة مفروزة)، عبر قاموسٍ يُبنى لكل صفحة على حدة.
 * وحين يحمل المفتاحُ الواحد هجاءين مختلفين (قلبٌ لفظيّ نادر — ٠٫٣٢٪) تُرفض
 * الجملة كلها ولا يُخمَّن.
 *
 * عقد الأمانة الحرفية — بأسبابٍ مقيسة لا مفترضة:
 *   ١) لا تُقبل جملة فيها رقم أو حرف لاتيني أو نسبة: اتجاه النص يقلب مواضعها
 *      («ويعرفها الكندي (2005: ص6)» تخرج «2005( 6: ص )»)، وإصلاحها تخمين.
 *   ٢) لا يُضَمّ مقطعٌ من إطارين: ما لم يجمعه الطبّاع في إطارٍ واحد لا نجمعه.
 *   ٣) كل كلمة في كل مقطع مُثبَتة في نص صفحتها من المجرى المستقل، وترتيبها
 *      مُثبَت من هندسة الصفحة — ويُعاد التحقق من ذلك عند كل بناء.
 *
 * حدود الكتاب المقيسة من النص (وتُفحص عند كل بناء):
 *   ص1-33 غلاف وبيانات نشر وفهرس · ص34 المقدمة · المتن حتى ص656 ·
 *   ص657 لوحة اقتباس · ص658-684 قوائم المراجع مبوبة · بعدها ملحقات.
 */
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { dirname, extname, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
export const CACHE_VERSION = 4

/* ═══ حدود المتن — أرقام مثبتة بالفحص، يحرسها تحقق تشغيلي أدناه ═══ */
export const BODY_LIMITS = {
  bodyStart: 34,          // أول صفحة نثر: مقدمة الموسوعة
  bodyEnd: 656,           // آخر صفحة متن قبل لوحة الاقتباس والمراجع
  referencesStart: 658,   // «قائمة مصادر ومراجع الباب الأول»
  minPassageChars: 70,   // معيار البيت نفسه في مسبك الاقتباسات
  maxPassageChars: 420,   // سقف الضم؛ الجملة الواحدة الأطول تُقبل حتى الحد الصلب
  hardMaxChars: 640,
  minPassageWords: 10,
  minSentenceChars: 12,
  minSentenceWords: 3,
}

/* ═══ التطبيع — سياسة الموقع نفسها (التنوين قبل الألف) بلا مساسٍ بالكلمات ═══ */
const FATHATAN = 'ً'
export const normalizeArabic = (value = '') => String(value)
  .normalize('NFKC')
  .replace(/[​-‏‪-‮⁦-⁩﻿]/g, '')
  .replace(/ـ+/g, '')
  .replace(/ /g, ' ')
  .replaceAll(`${FATHATAN}ا`, `ا${FATHATAN}`)
  .replace(/([ء-يٱ-ۓ])[ \t]+([ً-ٍ])/g, '$1$2')
  .replace(/([ً-ٍ])\1+/g, '$1')
  .replace(/[ \t]+/g, ' ')
  /* هندسة الصفحة تفصل الترقيم عن كلمته («التعليم .») — المسافة أثر قياسٍ
     لا حرفٌ في الكتاب، فتُزال. والقوس والتنصيص يُلصقان بما يليهما. */
  .replace(/ +([.،؛:!؟»)”\]])/gu, '$1')
  .replace(/([«("\[]) +/gu, '$1')
  .trim()

export const bareArabic = (value = '') => normalizeArabic(value)
  .replace(/[ً-ْٰ]/g, '')
  .replace(/[^؀-ۿ]/g, '')

export const fingerprintOf = (value = '') => bareArabic(value).slice(0, 60)

const ARABIC_RUN = /[؀-ۿ]+/gu
const stripMarks = (word = '') => word.replace(/[ً-ْٰ]/g, '')
/* مفتاح محايد لانعكاس لقاء «لام»: حروف الكلمة مفروزة. */
const canonKey = (word = '') => [...stripMarks(word)].sort().join('')
export const canonWords = (text = '') => (normalizeArabic(text).match(ARABIC_RUN) || []).map(canonKey)

/* ═══ بوابات الجملة — كل بوابة تحمي من عرضٍ مبعثر أو منسوبٍ خطأً ═══ */
const BANNED = [
  'ردمك', 'رقم الإيداع', 'مكتبة الكويت الوطنية', 'قائمة المراجع', 'قائمة مصادر',
  'المحتويات', 'جميع الحقوق', 'الطبعة الأولى', 'دار النشر', 'ص.ب', 'تصميم الغلاف',
]
const REFERENCE_MARKERS = [
  'رسالة ماجستير', 'أطروحة دكتوراه', 'غير منشورة', 'دار النشر', 'رقم الإيداع', 'ردمك',
  'ترجمة أ.', 'ترجمة د.', 'كلية التربية، جامعة', 'الإصدار الأول، مؤسسة', 'مجلة كلية',
]

export function looksLikeReference(text = '') {
  const value = normalizeArabic(text)
  if (REFERENCE_MARKERS.some((marker) => value.includes(marker))) return true
  if ((value.match(/،/g) || []).length >= 4 && /(?:جامعة|كلية|مجلة|مؤتمر|رسالة|أطروحة)\s/u.test(value)) return true
  return false
}

/**
 * بوابة الجملة. الطول شرطُ الاستقلال لا شرطُ النظافة: الجملة القصيرة
 * النظيفة («ولهذا وجب الاهتمام بها.») جزءٌ أصيل من فقرتها، فتُضَمّ ولا
 * تُقصى — وإقصاؤها كان يكسر الفقرة من حولها فيضيع ما حولها معها.
 */
export function sentenceRejection(text = '', { standalone = true } = {}) {
  const value = String(text).trim()
  if (standalone && value.length < BODY_LIMITS.minSentenceChars) return 'قصيرة'
  if (standalone && value.split(/\s+/u).length < BODY_LIMITS.minSentenceWords) return 'كلمات قليلة'
  if (!value) return 'فارغة'
  /* الرقم واللاتينية والنسبة: مواضعها غير مضمونة في الاستخراج — تُرفض الجملة كلها. */
  if (/[0-9٠-٩۰-۹]/.test(value)) return 'فيها أرقام'
  if (/[A-Za-z]/.test(value)) return 'حروف لاتينية'
  if (value.includes('%') || value.includes('٪')) return 'نسبة مئوية'
  if (/[*•▪◦□■]/u.test(value)) return 'رمز تعداد'
  if (/�/.test(value)) return 'حرف تالف'
  if (/\s\.\s/.test(value) || value.includes(': .')) return 'نقطة شاردة'
  /* قوسٌ غير متوازن أو قوسٌ يحوي غير العربية: أثر انعكاس الاتجاه — لا يُقتبس. */
  for (const [open, close] of [['(', ')'], ['[', ']'], ['«', '»'], ['“', '”']]) {
    if (value.split(open).length !== value.split(close).length) return 'أقواس غير متوازنة'
  }
  if ((value.split('"').length - 1) % 2 !== 0) return 'اقتباس غير مغلق'
  for (const group of value.match(/\([^)]*\)/gu) || []) {
    const inner = group.slice(1, -1)
    if (/[^؀-ۿ\s،؛]/u.test(inner)) return 'قوس غير عربي'
    if (inner.includes('،')) return 'إحالة مرجعية'
    if (group.length > 60) return 'قوس طويل'
  }
  const letters = value.replace(/[^\p{L}]/gu, '')
  const arabicLetters = value.replace(/[^؀-ۿ]/g, '')
  if (!letters.length || arabicLetters.length / letters.length < 0.98) return 'نص غير عربي خالص'
  /* حرفٌ عربي مفرد قائمٌ بذاته: لا كلمة عربية بحرفٍ واحد، فهو أثرُ تنوينٍ
     انشقّ عن كلمته عند القياس («أساساً» ← «أساس ا») أو حطامُ عمود. */
  if (/(?:^|\s)[ء-ي](?:\s|$)/u.test(value)) return 'حرف مفرد شارد'
  /* كلمات مفردة الحرف متتابعة = استخراج متشظٍّ من جدول أو عمود. */
  let singles = 0
  for (const word of value.split(/\s+/u)) {
    const bare = word.replace(/[^\p{L}]/gu, '')
    if (bare.length === 1) { singles += 1; if (singles >= 3) return 'نص متشظٍّ' } else singles = 0
  }
  /* الكلمة نفسها مرتين متلاصقتين = تأتأة استخراج. (الأبعد تكرارٌ بلاغيّ مشروع.) */
  const bare = value.split(/\s+/u).map((word) => word.replace(/[^\p{L}]/gu, ''))
  for (let index = 0; index + 1 < bare.length; index += 1) {
    if (bare[index].length >= 4 && bare[index] === bare[index + 1]) return 'تكرار متلاصق'
  }
  if (/(?:^|\s)[ء-ي]\s*[-–—]\s/u.test(value)) return 'بند قائمة'
  /* «أ. كذا» عنوانٌ اندسّ في السطر عند الاستخراج فذيّل الجملة بحرفٍ منقوط. */
  if (/\s[ء-ي]\.$/u.test(value) || /(?:^|\s)[ء-ي]\.\s/u.test(value)) return 'ذيل ترقيم'
  for (const banned of BANNED) if (value.includes(banned)) return `عبارة ناشر: ${banned}`
  if (looksLikeReference(value)) return 'صيغة مرجع'
  if (!/[.؟!][»)”]?$/u.test(value)) return 'بلا نهاية'
  return null
}

/* بداية المقطع: تُرفض ذيول التعداد التي لا تقوم جملةً افتتاحية بنفسها.
   («و» و«كما» تفتتحان جملاً تامة في نثر الكتاب فلا تُرفضان.) */
const TAIL_STARTERS = /^(?:ثم|أو|بل|أي|كذا|كذلك|وعليه|أمّا بعد)\s/u

/* ═══ بوابة المقطع المجمَّع — يعيد الاختبار تطبيقها على الملف المنشور ═══ */
export function passageRejection(text = '') {
  const value = normalizeArabic(text)
  if (value.length < BODY_LIMITS.minPassageChars) return 'قصير'
  if (value.length > BODY_LIMITS.hardMaxChars) return 'طويل'
  if (value.split(/\s+/u).length < BODY_LIMITS.minPassageWords) return 'كلمات قليلة'
  if (TAIL_STARTERS.test(value)) return 'بداية معلّقة'
  if (/^[\s.،؛:!؟\-–—)»]/u.test(value)) return 'بداية مبتورة'
  for (const sentence of value.split(/(?<=[.؟!])\s+/u)) {
    const reason = sentenceRejection(sentence, { standalone: false })
    if (reason) return reason
  }
  return null
}

/* ═══ قراءة الكتاب — ذاكرة موقّعة ببصمة الملف، أو استخراج مزدوج جديد ═══ */
function locatePrivateDir() {
  return [
    process.env.PRIVATE_BOOKS_DIR,
    resolve(ROOT, '../PrivateBooks'),
    resolve(ROOT, '../../PrivateBooks'),
    '/Users/prof.ahmadalfailakawi/Downloads/Websites/PrivateBooks',
  ].filter(Boolean).find((candidate) => existsSync(candidate)) || null
}

/* يلزم: pip3 install pypdf pymupdf */
const EXTRACT_PY = String.raw`
import json, sys, re, unicodedata
from collections import defaultdict
from pypdf import PdfReader
import fitz

TATWEEL = re.compile('ـ+')
def norm(s):
    return TATWEEL.sub('', unicodedata.normalize('NFKC', s))

DESIGN = ('indd', 'Dr Ahmed Book Design')
path = sys.argv[1]

reader = PdfReader(path)
stream = []
for i, page in enumerate(reader.pages):
    try: text = page.extract_text() or ""
    except Exception: text = ""
    stream.append(norm(text))

doc = fitz.open(path)
pages = []
for i, page in enumerate(doc):
    width = page.rect.width or 1
    lines = defaultdict(list)
    for w in page.get_text('words'):
        lines[(w[5], w[6])].append(w)
    frames = defaultdict(list)
    for (block, line), ws in lines.items():
        # سطر عربي يُقرأ يميناً فيساراً: ترتيب الكلمات بإحداثياتها لا بمجرى الملف
        ws = sorted(ws, key=lambda w: -w[2])
        top = min(w[1] for w in ws)
        right = max(w[2] for w in ws)
        left = min(w[0] for w in ws)
        frames[block].append((top, right, left, ' '.join(w[4] for w in ws)))
    blocks = []
    for block in sorted(frames):
        rows = sorted(frames[block])
        text = norm(' '.join(row[3] for row in rows))
        if not text or any(mark in text for mark in DESIGN): continue
        span = max(row[1] for row in rows) - min(row[2] for row in rows)
        blocks.append({'text': text, 'share': round(span / width, 3)})
    pages.append({'page': i + 1, 'text': stream[i] if i < len(stream) else '', 'blocks': blocks})

print(json.dumps({'pages': pages}, ensure_ascii=False))
`

export function loadEncyclopediaBook() {
  const privateDir = locatePrivateDir()
  if (!privateDir) throw new Error('لم أجد مجلد PrivateBooks. عرّفه في PRIVATE_BOOKS_DIR ثم أعد البناء.')
  const fileName = readdirSync(privateDir)
    .filter((name) => extname(name).toLowerCase() === '.pdf')
    .find((name) => /موسوعة.*تكنولوجيا.*التعليم/u.test(name.normalize('NFC')))
  if (!fileName) throw new Error('ملف موسوعة تكنولوجيا التعليم غير موجود في PrivateBooks.')
  const fullPath = resolve(privateDir, fileName)
  const sourceSha256 = createHash('sha256').update(readFileSync(fullPath)).digest('hex')

  const cacheDir = resolve(ROOT, '.private-memory/extracted-pages')
  const cacheFile = resolve(cacheDir, 'encyclopedia-pages.json')
  if (existsSync(cacheFile)) {
    try {
      const cached = JSON.parse(readFileSync(cacheFile, 'utf8'))
      if (cached?.version === CACHE_VERSION && cached.sourceSha256 === sourceSha256 && Array.isArray(cached.pages)) {
        return { pages: cached.pages, sourceSha256 }
      }
    } catch { /* ذاكرة معطوبة — يعاد الاستخراج أدناه */ }
  }
  const result = spawnSync('python3', ['-c', EXTRACT_PY, fullPath], { encoding: 'utf8', maxBuffer: 320 * 1024 * 1024, timeout: 900_000 })
  if (result.status !== 0) {
    const detail = (result.stderr || result.stdout || '').trim().slice(0, 400)
    throw new Error(`تعذّر الاستخراج المزدوج للموسوعة (يلزم: pip3 install pypdf pymupdf)\n${detail}`)
  }
  const { pages } = JSON.parse(result.stdout)
  mkdirSync(cacheDir, { recursive: true })
  writeFileSync(cacheFile, `${JSON.stringify({ version: CACHE_VERSION, sourceSha256, pageCount: pages.length, pages })}\n`)
  return { pages, sourceSha256 }
}

/* ═══ جدول لقاءات الخط — يتعلّمه المحرك من الكتاب نفسه ═══
 *
 * هندسة الصفحة تُخرج مكوّنات اللقاء الطباعي معكوسةً: «لم»←«مل»، «ين»←«ني»،
 * «لمح»←«حمل». وجدول اللقاءات خاصٌّ بخط الكتاب، فلا يُفترض بل يُستخرج: كل
 * كلمةٍ اتفق عليها المستخرجان تُعلّم المحرك انعكاساً، فتتراكم من ٣٠ ألف كلمةٍ
 * موثّقة قاعدةُ الخط كاملة (لم · لا · لأ · لإ · ين · لح · يم · تح · لخ · لج …).
 * وما شذّ عن الجدول (٣٤ كلمة من ٢٩٩٥٣) يبقى شاذاً فتُرفض جملته.
 */
function learnLigatures(pages, bodyStart, bodyEnd) {
  const perPage = new Map()
  for (const page of pages) {
    const forms = new Map()
    for (const word of normalizeArabic(page.text || '').match(ARABIC_RUN) || []) {
      const key = canonKey(word)
      const set = forms.get(key) || new Set()
      set.add(stripMarks(word))
      forms.set(key, set)
    }
    perPage.set(page.page, forms)
  }
  const nearby = (pageNumber, word) => {
    const merged = new Set()
    for (const offset of [0, -1, 1]) {
      for (const form of perPage.get(pageNumber + offset)?.get(canonKey(word)) || []) merged.add(form)
    }
    return [...merged]
  }

  const counts = new Map()
  let explained = 0
  let stubborn = 0
  for (const page of pages) {
    if (page.page < bodyStart || page.page > bodyEnd) continue
    for (const block of page.blocks || []) {
      for (const raw of normalizeArabic(block.text).match(ARABIC_RUN) || []) {
        const shown = stripMarks(raw)
        if (shown.length < 3) continue
        const candidates = nearby(page.page, shown)
        if (candidates.length !== 1) continue
        const truth = candidates[0]
        if (truth === shown || truth.length !== shown.length) continue
        const segments = []
        let cursor = 0
        let ok = true
        while (cursor < truth.length) {
          if (truth[cursor] === shown[cursor]) { cursor += 1; continue }
          let size = 0
          for (const width of [2, 3, 4]) {
            const segment = truth.slice(cursor, cursor + width)
            if (segment.length < width) continue
            if ([...segment].reverse().join('') === shown.slice(cursor, cursor + width)) { size = width; break }
          }
          if (!size) { ok = false; break }
          segments.push(truth.slice(cursor, cursor + size))
          cursor += size
        }
        if (!ok) { stubborn += 1; continue }
        explained += 1
        for (const segment of segments) counts.set(segment, (counts.get(segment) || 0) + 1)
      }
    }
  }
  /* عتبة الشيوع تفصل اللقاء الحقيقي عن مصادفةٍ عابرة في كلمةٍ واحدة. */
  const table = new Set([...counts].filter(([, count]) => count >= 20).map(([segment]) => segment))
  if (table.size < 8) throw new Error(`جدول لقاءات الخط لم يتكوّن (${table.size} لقاءً) — راجع الاستخراج`)
  return { table, explained, stubborn }
}

/* ═══ قاموس الصفحة: مفتاحٌ محايد ← هجاء المجرى الصحيح ═══
 *
 * يُبنى من نص الصفحة ومن جارتيها، لأن الفقرة تعبر الصفحات. وحين يعطي جدولُ
 * اللقاءات أكثرَ من أصلٍ ممكن وكلاهما وارد («العملية» و«العلمية» يخرجان من
 * رسمٍ واحد) تُرفض الجملة كلها — لا يُخمَّن ولا يُرجَّح.
 */
function buildSpellingIndex(pages, ligatures) {
  const perPage = new Map()
  const streams = new Map()
  const corpus = new Map()
  for (const page of pages) {
    const counts = new Map()
    const stream = []
    for (const word of normalizeArabic(page.text || '').match(ARABIC_RUN) || []) {
      const skeleton = stripMarks(word)
      const forms = counts.get(skeleton) || new Map()
      forms.set(word, (forms.get(word) || 0) + 1)
      counts.set(skeleton, forms)
      corpus.set(skeleton, (corpus.get(skeleton) || 0) + 1)
      stream.push({ word, skeleton, key: canonKey(word) })
    }
    perPage.set(page.page, counts)
    streams.set(page.page, stream)
  }

  /* أصولٌ ممكنة لرسمٍ واحد: كل نافذةٍ يعرفها جدولُ اللقاءات قد تكون معكوسة. */
  const cache = new Map()
  const originsOf = (shown) => {
    const hit = cache.get(shown)
    if (hit) return hit
    const spots = []
    for (let index = 0; index < shown.length; index += 1) {
      for (const width of [2, 3, 4]) {
        const start = index
        const segment = shown.slice(start, start + width)
        if (segment.length < width) continue
        if (ligatures.has([...segment].reverse().join(''))) spots.push([start, start + width])
      }
    }
    const origins = new Set([shown])
    const capped = spots.slice(0, 10)
    const walk = (position, chosen, lastEnd) => {
      if (origins.size > 48) return
      if (position >= capped.length) {
        if (!chosen.length) return
        let chars = [...shown]
        for (const [start, end] of [...chosen].sort((left, right) => right[0] - left[0])) {
          chars = [...chars.slice(0, start), ...chars.slice(start, end).reverse(), ...chars.slice(end)]
        }
        origins.add(chars.join(''))
        return
      }
      walk(position + 1, chosen, lastEnd)
      const [start, end] = capped[position]
      if (start >= lastEnd) walk(position + 1, [...chosen, capped[position]], end)
    }
    walk(0, [], 0)
    const list = [...origins]
    cache.set(shown, list)
    return list
  }

  const pick = (forms) => [...forms.entries()]
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0], 'ar'))[0][0]

  return {
    /**
     * الحسم بالموضع — للكلمات التي يتساوى فيها أصلان («العملية» و«العلمية»
     * تُرسمان رسماً واحداً، وهما من أكثر كلمات الكتاب دوراناً). نبحث عن تسلسل
     * كلمات الجملة كاملاً في مجرى الصفحة المستقل؛ فإن وُجد موضعاً واحداً لا
     * ثانيَ له، قرأنا الهجاء من المجرى نفسه في موضعه — شهادةً لا ترجيحاً.
     * يرجع مصفوفة الهجاء بترتيب الجملة، أو null إن لم ينفرد الموضع.
     */
    locate(pageNumber, keys) {
      if (keys.length < 4) return null
      let found = null
      for (const offset of [0, -1, 1]) {
        const stream = streams.get(pageNumber + offset)
        if (!stream || stream.length < keys.length) continue
        for (let start = 0; start + keys.length <= stream.length; start += 1) {
          let match = true
          for (let index = 0; index < keys.length; index += 1) {
            if (stream[start + index].key !== keys[index]) { match = false; break }
          }
          if (!match) continue
          if (found) return null
          found = stream.slice(start, start + keys.length).map((item) => item.word)
        }
      }
      return found
    },
    /** يرجع { status, form }: ok إن انفرد أصلٌ واحد، وإلا ambiguous أو missing. */
    lookup(pageNumber, word) {
      const shown = stripMarks(word)
      const origins = originsOf(shown)
      /* أولاً: ما تشهد به صفحته وجارتاها — أقرب شاهدٍ وأصدقه. */
      const local = new Map()
      for (const origin of origins) {
        const merged = new Map()
        for (const offset of [0, -1, 1]) {
          const forms = perPage.get(pageNumber + offset)?.get(origin)
          if (!forms) continue
          for (const [form, count] of forms) merged.set(form, (merged.get(form) || 0) + count)
        }
        if (merged.size) local.set(origin, merged)
      }
      if (local.size === 1) return { status: 'ok', form: pick([...local.values()][0]) }
      if (local.size > 1) return { status: 'ambiguous' }
      /* ثانياً: ما يشهد به الكتاب كله — لأن المجرى يُسقط النصوص المقتبسة
         داخل «» بتمامها، وهي أثمن ما في الموسوعة. ويُشترط شيوعٌ يمنع
         التعلّق بخطأ مطبعيّ عابر. */
      const wide = origins.filter((origin) => (corpus.get(origin) || 0) >= 3)
      if (wide.length === 1) return { status: 'ok', form: wide[0] }
      if (wide.length > 1) return { status: 'ambiguous' }
      return { status: 'missing' }
    },
  }
}

/**
 * الكلمة المنشقّة: قياسُ الصفحة يفصل حرفاً عن كلمته أحياناً — ألفُ التنوين
 * («أساساً» ← «أساس ا»)، أو واوُ العطف («واكتساب» ← «و اكتساب»)، أو ما بعد
 * الشدّة («توضّح» ← «توضّ ح»). ولا كلمة عربية بحرفٍ واحد. تُلأَم الكلمة
 * بشرطٍ واحد: أن يشهد المجرى المستقل بها ملتئمةً — وإلا تُركت لتُرفض جملتها.
 */
function healSplitWords(text, pageNumber, index) {
  const words = normalizeArabic(text).split(' ')
  const out = []
  for (let position = 0; position < words.length; position += 1) {
    const current = words[position]
    const next = words[position + 1]
    if (next && /^[؀-ۿ]+$/u.test(current)) {
      const parts = next.match(/^([؀-ۿ]+)([\s\S]*)$/u)
      if (parts) {
        const [, core, tail] = parts
        /* لا يُلأَم إلا ما لا يقوم بنفسه: حرفٌ مفرد، أو يسارٌ منتهٍ بتشكيل. */
        const suspect = stripMarks(current).length === 1
          || stripMarks(core).length === 1
          || /[ً-ْٰ]$/u.test(current)
        if (suspect && index.lookup(pageNumber, `${current}${core}`).status === 'ok') {
          out.push(`${current}${core}${tail}`)
          position += 1
          continue
        }
      }
    }
    out.push(current)
  }
  return out.join(' ')
}

/**
 * يعيد بناء نصّ الهندسة بحروف المجرى: كل كلمة عربية تُستبدل بأصلها الموثّق،
 * وما حولها من ترقيمٍ يبقى في موضعه. يرجع null إن نقصت كلمة أو التبست.
 */
function respell(text, pageNumber, index, stats) {
  const clean = normalizeArabic(text)
  let missing = 0
  let ambiguous = 0
  const rebuilt = clean.replace(ARABIC_RUN, (word) => {
    const found = index.lookup(pageNumber, word)
    if (found.status === 'ok') return found.form
    if (found.status === 'ambiguous') ambiguous += 1
    else missing += 1
    return word
  })
  if (!missing && !ambiguous) return rebuilt
  /* الالتباس وحده يُحسم بالموضع: تسلسل الجملة إن انفرد في مجرى الصفحة قرأنا
     هجاءه منه. أما نقصُ كلمةٍ فلا يُحسم بموضع، لأن المجرى نفسه لا يحملها. */
  if (!missing) {
    const keys = (clean.match(ARABIC_RUN) || []).map(canonKey)
    const located = index.locate(pageNumber, keys)
    if (located) {
      let cursor = 0
      stats.locatedByPosition += 1
      return clean.replace(ARABIC_RUN, () => located[cursor++])
    }
  }
  if (missing) stats.missingWords += missing
  else stats.ambiguousWords += ambiguous
  return null
}

/* الاقتباس المنقول قد يمتدّ جملتين («…فلان. وقال…»)، فقطعُه عندها يترك
   تنصيصاً مفتوحاً في شطرٍ ومغلقاً في آخر فيُرفض الاثنان. فلا يُقطع إلا
   خارج التنصيص. */
function splitSentences(text = '') {
  const value = normalizeArabic(text)
  const out = []
  let start = 0
  let depth = 0
  for (let index = 0; index < value.length; index += 1) {
    const char = value[index]
    if (char === '«') depth += 1
    else if (char === '»') depth = Math.max(0, depth - 1)
    else if (depth === 0 && /[.؟!]/u.test(char)) {
      let end = index + 1
      if (/[»)”]/u.test(value[end] || '')) end += 1
      if (/\s/u.test(value[end] || '') || end >= value.length) {
        const piece = value.slice(start, end).trim()
        if (piece) out.push(piece)
        start = end
      }
    }
  }
  const tail = value.slice(start).trim()
  if (tail) out.push(tail)
  return out
}

/* ═══ الباني الرئيس ═══ */
export function buildEncyclopediaBodyIndex({
  pages,
  concepts = [],
  blockedFingerprints = new Set(),
  voiceOf = () => 0,
} = {}) {
  const { bodyStart, bodyEnd } = BODY_LIMITS
  const byPage = new Map(pages.map((page) => [page.page, page]))

  /* تحقق الحدود: يُفحص في النص نفسه عند كل بناء، فإن تبدّل ملف الكتاب يوماً
     انكشف الأمر هنا لا في مقاطع فاسدة. */
  const textOf = (pageNumber) => normalizeArabic(byPage.get(pageNumber)?.text || '')
  if (!textOf(bodyStart).includes('انتشرت التكنولوجيا')) {
    throw new Error(`حدود المتن تزحزحت: ص${bodyStart} لا تفتتح المقدمة المعروفة — راجع BODY_LIMITS`)
  }
  if (!/قائمة مصادر ومراجع/u.test(textOf(BODY_LIMITS.referencesStart))) {
    throw new Error(`حدود المتن تزحزحت: ص${BODY_LIMITS.referencesStart} ليست بداية المراجع — راجع BODY_LIMITS`)
  }
  if (!pages.some((page) => Array.isArray(page.blocks) && page.blocks.length)) {
    throw new Error('بنية الإطارات مفقودة — أعد الاستخراج المزدوج (يلزم pymupdf).')
  }

  const ligatures = learnLigatures(pages, bodyStart, bodyEnd)
  const index = buildSpellingIndex(pages, ligatures.table)
  const conceptFor = (pageNumber) => concepts.find((item) => pageNumber >= item.pageStart && pageNumber <= Math.min(item.pageEnd, bodyEnd)) || null
  const titleBleeds = concepts.map((item) => item.title).filter((title) => title && title.length >= 12)

  const stats = { sentences: 0, dropped: {}, rejected: {}, blocked: 0, missingWords: 0, ambiguousWords: 0, joinOnlyOrphans: 0, locatedByPosition: 0, dropSamples: {} }
  const note = (bucket, reason, text = '', page = 0) => {
    stats[bucket][reason] = (stats[bucket][reason] || 0) + 1
    if (text) {
      const samples = stats.dropSamples[reason] || (stats.dropSamples[reason] = [])
      if (samples.length < 6) samples.push(`ص${page}: ${text.slice(0, 140)}`)
    }
  }

  const passages = []
  const seen = new Set()

  /* ═══ مجرى الإطارات ═══
     الإطار وحدة الطبّاع، والفقرة تعبر منه إلى تاليه: ٣١٥٦ من ٤٠٢٣ إطاراً في
     المتن تنتهي بلا ختام لأن بقيتها في الإطار التالي. فيُخاط المجرى: ذيلُ
     الإطار غيرُ المختوم يُوصل بأول تاليه، ورقمُ الصفحة يُتجاوز فلا يقطع،
     والعنوانُ القصير يقطع الوصل ويُسقط الذيل المبتور — فلا يُلصق عنوانٌ
     بفقرةٍ ولا تُوهم فقرتان بأنهما واحدة. */
  const isPageNumber = (text = '') => !/[؀-ۿ]/u.test(text)
  /* العنوان: إطارٌ قصير لا يُختم بعلامة نهاية. وشرط «لا نقطة فيه» كان يُفلت
     «ج . النظرية البنائية» فيلتصق العنوان بفقرته — والختامُ هو الفيصل. */
  const isHeading = (text = '') => text.length < 100 && !/[.؟!][»)”]?$/u.test(text)
  const flow = []
  for (const page of pages) {
    if (page.page < bodyStart || page.page > bodyEnd) continue
    for (const block of page.blocks || []) {
      const text = normalizeArabic(block.text)
      if (!text || isPageNumber(text)) continue
      flow.push({ page: page.page, text, heading: isHeading(text) })
    }
  }

  let group = null
  const closeGroup = () => {
    if (!group) return
    const text = normalizeArabic(group.texts.join(' '))
    const page = group.page
    group = null
    const reason = passageRejection(text)
    if (reason) { note('rejected', reason); return }
    const fingerprint = fingerprintOf(text)
    if (blockedFingerprints.has(fingerprint)) { stats.blocked += 1; note('rejected', 'محجوب بأمر الدكتور'); return }
    if (seen.has(fingerprint)) { note('rejected', 'مكرّر'); return }
    seen.add(fingerprint)
    const concept = conceptFor(page)
    passages.push({
      text,
      page,
      section: concept?.title || 'مقدمة الموسوعة',
      conceptId: concept?.id || '',
      conceptTitle: concept?.title || '',
      fingerprint,
    })
  }

  let carry = null
  for (const frame of flow) {
    if (frame.heading) {
      if (carry) { note('dropped', 'ذيل قطعه عنوان', carry.text, carry.page); carry = null }
      closeGroup()
      continue
    }
    let sentences = splitSentences(frame.text)
    if (!sentences.length) continue
    let firstPage = frame.page
    if (carry) {
      sentences[0] = normalizeArabic(`${carry.text} ${sentences[0]}`)
      firstPage = carry.page
      carry = null
    } else closeGroup()

    const last = sentences[sentences.length - 1]
    if (!/[.؟!][»)”]?$/u.test(last)) {
      carry = { text: last, page: sentences.length === 1 ? firstPage : frame.page }
      sentences = sentences.slice(0, -1)
    }

    sentences.forEach((raw, order) => {
      const page = order === 0 ? firstPage : frame.page
      stats.sentences += 1
      /* الرفض المبكر يوفّر بناء الهجاء لما لن يُقبل أصلاً. */
      const healed = healSplitWords(raw, page, index)
      const early = sentenceRejection(healed, { standalone: false })
      if (early) { note('dropped', early, healed, page); closeGroup(); return }
      const sentence = respell(healed, page, index, stats)
      if (!sentence) { note('dropped', 'كلمة لم يثبتها المجرى', raw, page); closeGroup(); return }
      const reason = sentenceRejection(sentence, { standalone: false })
      if (reason) { note('dropped', reason, sentence, page); closeGroup(); return }
      /* القصيرة تنضمّ إلى فقرتها ولا تفتتح مقطعاً بنفسها. */
      const joinOnly = Boolean(sentenceRejection(sentence))
      if (titleBleeds.some((title) => sentence.indexOf(title) > 0)) {
        note('dropped', 'عنوان داخل الجملة', sentence, page)
        closeGroup()
        return
      }
      if (group) {
        const joined = group.texts.join(' ').length + sentence.length + 1
        const startsAsTail = joinOnly || TAIL_STARTERS.test(sentence)
        if (joined <= BODY_LIMITS.maxPassageChars || (startsAsTail && joined <= BODY_LIMITS.hardMaxChars)) {
          group.texts.push(sentence)
          return
        }
        closeGroup()
      }
      if (joinOnly) { stats.joinOnlyOrphans += 1; return }
      group = { texts: [sentence], page }
    })
  }
  if (carry) note('dropped', 'ذيل بلا ختام عند نهاية المتن', carry.text, carry.page)
  closeGroup()

  /* ═══ برهان الحرفية ═══
     كل كلمة في كل مقطع مُثبَتة في مجرى نصّ الكتاب — على صفحتها أو على غيرها.
     والثانية ليست تساهلاً بل هي جوهر الكسب: المجرى يُسقط ما بين «» بتمامه
     (تعريفات العلماء المنقولة)، فتأتي من هندسة الصفحة ويُثبتها المجرى من
     موضعٍ آخر. والترتيب مُثبَت من الهندسة. ويُعاد هذا الفحص عند كل بناء. */
  const streamWords = new Set()
  for (const page of pages) {
    for (const word of normalizeArabic(page.text || '').match(ARABIC_RUN) || []) streamWords.add(stripMarks(word))
  }
  const pageWords = new Map(pages.map((page) => [
    page.page,
    new Set((normalizeArabic(page.text || '').match(ARABIC_RUN) || []).map(stripMarks)),
  ]))
  let offPageWords = 0
  for (const passage of passages) {
    for (const word of normalizeArabic(passage.text).match(ARABIC_RUN) || []) {
      const skeleton = stripMarks(word)
      if (skeleton.length < 3) continue
      if (!streamWords.has(skeleton)) {
        throw new Error(`برهان الحرفية سقط في ص${passage.page}: الكلمة «${word}» ليست في مجرى نصّ الكتاب`)
      }
      const near = [passage.page - 1, passage.page, passage.page + 1]
        .some((pageNumber) => pageWords.get(pageNumber)?.has(skeleton))
      if (!near) offPageWords += 1
    }
  }
  stats.offPageWords = offPageWords

  passages.sort((left, right) => left.page - right.page)
  const shaped = passages.map((passage, order) => ({
    id: `encyclopedia-p${String(order + 1).padStart(5, '0')}`,
    text: passage.text,
    page: passage.page,
    section: passage.section,
    conceptId: passage.conceptId,
    conceptTitle: passage.conceptTitle,
    voice: voiceOf(passage.text),
    fingerprint: passage.fingerprint,
  }))

  const coveredPages = new Set(shaped.map((passage) => passage.page))
  const bodyPages = pages.filter((page) => page.page >= bodyStart && page.page <= bodyEnd)
  const uncovered = bodyPages
    .filter((page) => !coveredPages.has(page.page))
    .map((page) => ({
      page: page.page,
      reason: bareArabic(page.text).length < 80
        ? 'صفحة فاصل أو صور بلا نثر'
        : 'رفضتها بوابات الأمانة (أرقام أو لاتينية أو قوائم أو ترقيم متشابك)',
    }))

  return {
    passages: shaped,
    report: {
      bodyRange: `${bodyStart}-${bodyEnd}`,
      bodyPageCount: bodyPages.length,
      coveredPageCount: coveredPages.size,
      uncovered,
      totalChars: shaped.reduce((sum, passage) => sum + passage.text.length, 0),
      ligatures: { learned: ligatures.table.size, explainedWords: ligatures.explained, stubbornWords: ligatures.stubborn },
      offPageWords: stats.offPageWords,
      locatedByPosition: stats.locatedByPosition,
      stats,
    },
  }
}
