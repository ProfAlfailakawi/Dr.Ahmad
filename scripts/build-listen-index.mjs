#!/usr/bin/env node
/*
 * فهرس «مجلس الفكرة»: بابُ كل حلقةٍ سؤالٌ من داخلها.
 *
 * الفكرة: الأرشيف المسموع لا يُفهرس بعناوينه — العنوان يُقرأ فيُنسى، والسؤال
 * يوقف القارئ ويُلزمه بجواب. فنأخذ من حوار الدكتور نفسه سؤالاً واحداً نطقه فهد
 * أو نورة بنصّه حرفاً، ونعرف الثانية التي يُسأل فيها، فيبدأ الصوت عندها:
 * يُسمع الجوابُ حيث سُئل.
 *
 * مصادر الحقيقة كلها موجودة، ولا يُختلق شيء:
 *   • السؤال ونصّه: manual-dialogues/{slug}.json — كلمات الدكتور المقفولة.
 *   • الحلقة منشورة أم لا: src/data/audio-meta.json — سجلّ R2 الموثّق وحده.
 *   • ثانية السؤال: {slug}.dialogue.json المنشور (يُجلب عند توفّر العنوان).
 *
 * فإن تعذّر الجلب بقيت الحلقة في الفهرس بلا ثانية، فتُشغَّل من أولها — نقصٌ
 * في الدقّة لا كسرٌ في الصفحة. وما لم يُنشر صوته لا يدخل الفهرس أصلاً: لا سطر
 * يقود إلى صمت.
 */
import { existsSync, readFileSync, readdirSync, rmSync, writeFileSync, mkdirSync, statSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { mergeCanonicalRecords, readCanonicalCms } from './canonical-cms.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const OUT = resolve(ROOT, 'src/data/listen-index.json')
const SPOKEN_OUT = resolve(ROOT, 'src/data/spoken-index.json')
const SELF_TEST = process.argv.includes('--self-test')

const AUDIO_BASE = String(process.env.AUDIO_PUBLIC_BASE_URL || process.env.VITE_AUDIO_BASE_URL || '').replace(/\/+$/, '')

/* ── السؤال-الباب ──
   نأخذ جملة السؤال وحدها لا المداخلة كلها: المتحدث قد يمهّد ثم يسأل
   («النص لا يلومه، بل يسأل: هل نربّي أدمغة…؟») فنقتطع من آخر فاصلٍ قبل
   علامة الاستفهام. ثم نختار من أسئلة الحلقة أقربها إلى ٥٢ حرفاً: أقصرُ من
   ذلك مبتور بلا سياق، وأطولُ منه فقرةٌ لا سؤال. */
export function questionSentence(text) {
  const clean = String(text || '').replace(/\s+/g, ' ').trim()
  const mark = clean.indexOf('؟')
  if (mark < 0) return ''
  const upto = clean.slice(0, mark + 1)
  const parts = upto.split(/(?<=[.؛:])\s+|(?<=:)\s*/).filter(Boolean)
  return (parts[parts.length - 1] || upto).replace(/^[،:\s]+/, '').trim()
}

const IDEAL_LENGTH = 52
const MIN_LENGTH = 20
const MAX_LENGTH = 92

const INTERROGATIVE = /^(هل|أهل|ألا|أليس|أليست|ما |ماذا|لماذا|كيف|أين|متى|من |أيّ|أي |كم )/
const DEICTIC = /(هذا|هذه|ذلك|تلك|كهذه|كهذا|هؤلاء|ذاك)/

/* حرفُ العطف في أول السؤال («وهل نلغي المكافآت؟») رابطٌ بما قبله لا جزءٌ من
   السؤال. وحين يُقتطع السؤال ليقف وحده يصير الحرف بقيّةَ جملةٍ غائبة، وقائمةٌ
   يبدأ سبعون في المئة من سطورها بواوٍ تُقرأ في العربية كنصٍّ فقد نصفه الأول —
   وهذا هو «التلوّث» بعينه. نجرّده حين يليه استفهامٌ صريح فقط، فلا يتغيّر معنى
   ولا تُمسّ تركيبةٌ ليست عطفاً («وليس هل سبقت غيرك، بل…» تبقى كما هي فتُرفض). */
export function standaloneQuestion(text) {
  let question = questionSentence(text)
  if (!question) return ''
  const conjoined = question.match(/^([وف])([^\s].*)$/)
  if (conjoined && INTERROGATIVE.test(conjoined[2])) question = conjoined[2]
  const worded = question.match(/^(ولكن|لكن|ثم|أو|بل)\s+(.*)$/)
  if (worded && INTERROGATIVE.test(worded[2])) question = worded[2]
  question = question.trim()
  if (question.length < MIN_LENGTH || question.length > MAX_LENGTH) return ''
  if (!INTERROGATIVE.test(question)) return ''
  return question
}

/* الترتيب: المكتفي بنفسه أولاً (بلا اسم إشارةٍ معلّق)، ثم الأقرب إلى طولٍ
   يُقرأ في نفَسٍ واحد. والحلقة التي لا سؤال فيها يصلح باباً تُفتح بعنوانها. */
export function pickDoorQuestion(turns = []) {
  const candidates = []
  for (let index = 0; index < turns.length; index += 1) {
    const question = standaloneQuestion(turns[index]?.text)
    if (!question) continue
    candidates.push({
      index,
      question,
      speaker: turns[index]?.speaker === 'female' ? 'نورة' : 'فهد',
      dangling: DEICTIC.test(question) ? 1 : 0,
    })
  }
  if (!candidates.length) return null
  return candidates.sort((left, right) =>
    left.dangling - right.dangling
    || Math.abs(IDEAL_LENGTH - left.question.length) - Math.abs(IDEAL_LENGTH - right.question.length))[0]
}

function staticArticles() {
  const source = readFileSync(resolve(ROOT, 'src/data.ts'), 'utf8')
  const block = source.match(/export const articles = \[([\s\S]*?)\n\]/)?.[1] || source
  return [...block.matchAll(/\{ slug: '([^']+)', title: '((?:[^'\\]|\\.)*)', date: '([^']*)', iso: '([^']*)'(?:, cat: '([^']*)')?/g)]
    .map((match) => ({
      slug: match[1],
      title: match[2].replace(/\\'/g, "'"),
      date: match[3],
      iso: match[4],
      cat: match[5] || '',
    }))
}

async function fetchTimings(episodes, spoken) {
  if (!AUDIO_BASE || !episodes.length) return
  const queue = [...episodes]
  const worker = async () => {
    for (;;) {
      const episode = queue.shift()
      if (!episode) return
      try {
        const controller = new AbortController()
        const timer = setTimeout(() => controller.abort(), 12_000)
        const response = await fetch(`${AUDIO_BASE}/${episode.slug}.dialogue.json`, { signal: controller.signal })
        clearTimeout(timer)
        if (!response.ok) continue
        const transcript = await response.json()
        const utterances = Array.isArray(transcript?.utterances) ? transcript.utterances : []
        const line = utterances[episode.turn]
        /* لا نثق بالترتيب وحده: لو تغيّر الحوار بعد النشر لصار الرقم على جملةٍ
           أخرى فيبدأ الصوت في غير موضعه. نتحقّق أن الجملة تحمل السؤال نفسه،
           وإلا بحثنا عنه في النصّ كله، وإلا تركنا الحلقة بلا ثانية. */
        const matches = (item) => typeof item?.text === 'string' && item.text.includes(episode.question)
        const found = matches(line) ? line : utterances.find(matches)
        if (found && typeof found.startSec === 'number') episode.startSec = Number(found.startSec.toFixed(2))
        /* فهرس المنطوق: كل جملةٍ قيلت في الحلقة بثانيتها ومتحدثها. منه يصير
           الأرشيف المسموع قابلاً للبحث بالكلمة التي نُطقت لا بالعنوان. لا
           يُجمع إلا لحلقةٍ موقّتة — الجملة بلا ثانيةٍ لا تُفتح على شيء. */
        if (spoken && utterances.some((item) => typeof item?.startSec === 'number')) {
          spoken.push({
            slug: episode.slug,
            title: episode.title,
            lines: utterances
              .filter((item) => typeof item?.startSec === 'number' && typeof item?.text === 'string')
              .map((item) => [Number(Number(item.startSec).toFixed(1)), item.speaker === 'نورة' ? 1 : 0, item.text]),
          })
        }
      } catch { /* الحلقة تبقى بلا ثانية وتُشغَّل من أولها */ }
    }
  }
  await Promise.all(Array.from({ length: Math.min(6, episodes.length) }, worker))
}

export function buildIndex({ articles, audioMeta, dialogueOf }) {
  const episodes = []
  for (const article of articles) {
    const published = audioMeta[`${article.slug}.dialogue.mp3`]
    if (!published || published.validationStatus !== 'verified-r2') continue
    const turns = dialogueOf(article.slug)
    if (!Array.isArray(turns) || !turns.length) continue
    const door = pickDoorQuestion(turns)
    episodes.push({
      slug: article.slug,
      title: article.title,
      cat: article.cat || '',
      iso: article.iso || '',
      date: article.date || '',
      question: door?.question || '',
      speaker: door?.speaker || '',
      turn: door ? door.index : -1,
      durationSec: Number(published.durationSeconds || 0),
    })
  }
  return episodes.sort((left, right) => (right.iso || '').localeCompare(left.iso || ''))
}

if (SELF_TEST) {
  const assert = (await import('node:assert/strict')).default
  assert.equal(questionSentence('النص لا يسأل عنه، بل يسأل عن النظام: هل نربّي عقولاً أم نسخاً؟'),
    'هل نربّي عقولاً أم نسخاً؟', 'السؤال يُقتطع من آخر فاصلٍ قبل علامة الاستفهام')
  assert.equal(questionSentence('جملة خبرية بلا سؤال.'), '', 'ما لا سؤال فيه لا يصلح باباً')
  const door = pickDoorQuestion([
    { speaker: 'male', text: 'مقدمة طويلة بلا سؤال إطلاقاً في هذه المداخلة.' },
    { speaker: 'female', text: 'ولكن هل نستعد لامتحانٍ، أم نستعد لمعركةٍ تثبت من نحن؟' },
    { speaker: 'male', text: 'حقاً؟' },
  ])
  assert.equal(door.index, 1, 'يُختار السؤال المكتمل لا الشظية')
  assert.equal(door.speaker, 'نورة', 'المتحدثة تُسمّى باسمها المعتمد')
  assert.equal(door.question, 'هل نستعد لامتحانٍ، أم نستعد لمعركةٍ تثبت من نحن؟',
    'حرف الربط يُجرَّد فيقف السؤال وحده')
  assert.equal(standaloneQuestion('وليس هل سبقت غيرك، بل هل نضجت قليلاً عما كنت؟'), '',
    'ما ليس عطفاً لا يُجرَّد، والسؤال المعلَّق يُرفض بدل أن يُشوَّه')
  assert.equal(standaloneQuestion('فهل نلغي المكافآت إذن؟'), 'هل نلغي المكافآت إذن؟', 'الفاء تُجرَّد كالواو')
  const preferSelfContained = pickDoorQuestion([
    { speaker: 'male', text: 'ألا يعني هذا خفض المعايير كلها في المدرسة؟' },
    { speaker: 'female', text: 'كيف نقيس فهم الطالب دون أن نكسر ثقته بنفسه؟' },
  ])
  assert.equal(preferSelfContained.index, 1, 'السؤال المستغني عن اسم الإشارة يتقدّم على المعلَّق بما قبله')
  const built = buildIndex({
    articles: [
      { slug: 'a', title: 'عنوان', cat: 'التعليم', iso: '2026-01-01', date: '١ يناير' },
      { slug: 'b', title: 'غير منشور', cat: 'تقنية', iso: '2026-02-01', date: '١ فبراير' },
    ],
    audioMeta: {
      'a.dialogue.mp3': { validationStatus: 'verified-r2', durationSeconds: 204 },
      'b.dialogue.mp3': { validationStatus: 'pending' },
    },
    dialogueOf: () => ([{ speaker: 'male', text: 'ولكن هل نستعد لامتحانٍ، أم نستعد لمعركةٍ تثبت من نحن؟' }]),
  })
  assert.equal(built.length, 1, 'ما لم يُوثَّق على R2 لا يدخل الفهرس — لا سطر يقود إلى صمت')
  assert.equal(built[0].durationSec, 204, 'المدة تُؤخذ من سجلّ R2 لا من تقدير')
  console.log("✓ اختبارات فهرس مجلس الفكرة: 10/10")
  process.exit(0)
}

const articles = mergeCanonicalRecords('article', staticArticles(), readCanonicalCms(ROOT))
const audioMeta = existsSync(resolve(ROOT, 'src/data/audio-meta.json'))
  ? JSON.parse(readFileSync(resolve(ROOT, 'src/data/audio-meta.json'), 'utf8')) : {}
const dialogueOf = (slug) => {
  const file = resolve(ROOT, 'manual-dialogues', `${slug}.json`)
  if (!existsSync(file)) return null
  try { return JSON.parse(readFileSync(file, 'utf8')) } catch { return null }
}

const episodes = buildIndex({ articles, audioMeta, dialogueOf })
const spoken = []
await fetchTimings(episodes, spoken)

mkdirSync(dirname(OUT), { recursive: true })
writeFileSync(OUT, `${JSON.stringify({
  schemaVersion: 1,
  generatedAt: new Date().toISOString().slice(0, 10),
  episodes,
}, null, 2)}\n`)

/* فهرس المنطوق ملفٌّ مستقل ثقيل عمداً: لا يُحمَّل إلا لمن فتح تبويب «جُمل
   منطوقة» فعلاً (استيراد ديناميكي)، فلا يدفع ثمنه من لا يبحث في الصوت.
   ويُكتب مضغوطاً بلا مسافات: مصفوفة [ثانية، متحدث، نص] لا كائن بمفاتيح. */
spoken.sort((left, right) => left.slug.localeCompare(right.slug))
writeFileSync(SPOKEN_OUT, `${JSON.stringify({ schemaVersion: 1, episodes: spoken })}\n`)

const timed = episodes.filter((episode) => typeof episode.startSec === 'number').length
const lines = spoken.reduce((total, item) => total + item.lines.length, 0)
console.log(`✔ مجلس الفكرة: ${episodes.length} حلقة منشورة · ${timed} منها تبدأ عند ثانية السؤال`)
console.log(`✔ فهرس المنطوق: ${lines} جملة من ${spoken.length} حلقة · ${Math.round(statSync(SPOKEN_OUT).size / 1024)}KB`)

/* بصمات الصوت المصغّرة: حزمة الدخول تحتاج ست عشرة خانةً من بصمة كل ملف
   لكسر تخزين المتصفح، لا السجلّ كلّه. تُولَّد هنا فلا تتخلّف عن السجلّ. */
{
  const metaPath = resolve(ROOT, 'src/data/audio-meta.json')
  if (existsSync(metaPath)) {
    const meta = JSON.parse(readFileSync(metaPath, 'utf8'))
    const versions = {}
    for (const [name, row] of Object.entries(meta)) {
      const sha = row && typeof row.sha256 === 'string' ? row.sha256.slice(0, 16) : ''
      if (sha) versions[name] = sha
    }
    writeFileSync(resolve(ROOT, 'src/data/audio-versions.json'), `${JSON.stringify(versions)}\n`)
    console.log(`✔ بصمات الصوت: ${Object.keys(versions).length} ملفاً`)
  }
}

/* خلاصة مجلس الفكرة: العدّ وحفنةٌ للسؤال الدوّار — تكفي حزمة الدخول،
   والفهرس الكامل يبقى لصفحة الاستماع الكسولة وحدها. */
{
  const indexPath = resolve(ROOT, 'src/data/listen-index.json')
  if (existsSync(indexPath)) {
    const full = JSON.parse(readFileSync(indexPath, 'utf8'))
    const episodes = Array.isArray(full.episodes) ? full.episodes : []
    writeFileSync(resolve(ROOT, 'src/data/listen-summary.json'),
      `${JSON.stringify({ schemaVersion: 1, count: episodes.length, pool: episodes.slice(0, 24) }, null, 1)}\n`)
    console.log(`✔ خلاصة المجلس: ${episodes.length} حلقة · ${Math.min(24, episodes.length)} في دورة السؤال`)
  }
}

/* جدول الإذاعة: حلقةُ يومٍ واحدة تُرصف فيها الحوارات بترتيبٍ ثابت لا يتغيّر
   بين بناءٍ وبناء (بالاسم لا بالعشوائية)، فيسمع الجميع اللحظة نفسها من أي
   جهاز — الموضع يُحسب من ساعة الكويت لا من خادم بثّ. */
{
  const indexPath = resolve(ROOT, 'src/data/listen-index.json')
  if (existsSync(indexPath)) {
    const full = JSON.parse(readFileSync(indexPath, 'utf8'))
    const episodes = (Array.isArray(full.episodes) ? full.episodes : [])
      .filter((e) => Number(e.durationSec) > 30)
      .sort((a, b) => a.slug.localeCompare(b.slug, 'en'))
    const GAP_SECONDS = 8
    let at = 0
    const items = episodes.map((e) => {
      const row = { slug: e.slug, title: e.title, cat: e.cat, at, dur: Math.round(e.durationSec) }
      at += row.dur + GAP_SECONDS
      return row
    })
    const table = `${JSON.stringify({ schemaVersion: 1, loop: at, gap: GAP_SECONDS, items }, null, 1)}\n`
    writeFileSync(resolve(ROOT, 'src/data/radio-schedule.json'), table)
    /* ونسخةٌ في public/: شارة «على الهواء» في الصفحة الرئيسية تجلبه بالشبكة
       بعد سكون الصفحة، فلا يُحزم جدولُ تسعِ ساعاتٍ في حزمة الدخول. */
    writeFileSync(resolve(ROOT, 'public/radio-schedule.json'), table)
    console.log(`✔ جدول الإذاعة: ${items.length} حلقة · حلقة اليوم ${(at / 3600).toFixed(1)} ساعة`)
  }
}

/* جُمل كل حلقة على حدة: الإذاعة والصفحة الرئيسية تعرضان الجملة المنطوقة في
   حلقةٍ واحدة، فلا معنى لأن تجرّا الفهرس كلّه (٦٥٠KB) من أجل خمسة كيلوبايت.
   الفهرس الجامع يبقى كما هو لبحث «الجُمل المنطوقة» وحده — فهو وحده يحتاج
   كلّ الحلقات معاً. تُكتب في public/ لتُجلب بالشبكة عند الطلب لا أن تُحزم. */
{
  const dir = resolve(ROOT, 'public/spoken')
  mkdirSync(dir, { recursive: true })
  /* الشوارد تُمسح: حلقةٌ حُذفت من المجلس تترك ملفّها يُجلب إلى الأبد. */
  for (const file of (existsSync(dir) ? readdirSync(dir) : [])) {
    if (file.endsWith('.json') && !spoken.some((item) => `${item.slug}.json` === file)) {
      rmSync(resolve(dir, file), { force: true })
    }
  }
  let bytes = 0
  for (const item of spoken) {
    const body = `${JSON.stringify({ slug: item.slug, lines: item.lines })}\n`
    bytes += body.length
    writeFileSync(resolve(dir, `${item.slug}.json`), body)
  }
  console.log(`✔ جُمل الحلقات المفردة: ${spoken.length} ملفاً · وسطي ${Math.round(bytes / Math.max(1, spoken.length) / 1024 * 10) / 10}KB للحلقة`)
}
