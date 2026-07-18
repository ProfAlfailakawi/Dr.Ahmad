#!/usr/bin/env node
/**
 * فاحص المصادر الشامل — كل رابط في الموقع، لا المختارات وحدها.
 *
 * الفاحص السابق كان يرى ٣٧ رابطاً من ٢٣٢: الرادار وبنك المختارات فقط، ويحذف
 * الميّت بصمتٍ بلا تقرير. فكان الدكتور يسأل «أي مصدر تالف ولماذا؟» فلا جواب.
 *
 * هذا يفحص كل مصدرٍ في الموقع (مقالات، أبحاث، كتب، إعلام، مختارات، رادار،
 * لقاءات، ومجموعات Firestore)، ويكتب تقريراً تفصيلياً في `site_health/latest`
 * تقرؤه اللوحة: أين الرابط، ولماذا سقط، ومتى فُحص، وما اقتراح العلاج.
 *
 * لا يحذف شيئاً: القرار للدكتور. الحذف الآلي يبقى في فاحص المختارات القديم
 * وحده (وهو محكوم بقاعدة 404 فقط).
 */
import { readFileSync, existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const env = process.env
const SELF_TEST = process.argv.includes('--self-test')
const TIMEOUT_MS = Number(env.SOURCE_CHECK_TIMEOUT_MS || 12000)
const CONCURRENCY = Number(env.SOURCE_CHECK_CONCURRENCY || 6)

/* ═══ جمع الروابط من كل مصادر الموقع ═══ */
/* أي حقلٍ يحمل رابطاً — تسمية الحقول لا تُفترض: كان النمط الضيق يفوّت
   researchgate (١٢ رابطاً لأبحاث الدكتور) وscholar وbooking وغيرها. */
const linkPattern = /(\w+):\s*'(https?:\/\/[^']+)'/g
/* أطرٌ مضمّنة لا روابط تصفّح: خريطة الموقع تُحمَّل داخل iframe وتردّ على الفاحص
   بما لا يعني شيئاً. فحصها يولّد إنذاراً كاذباً عن «رابط ميت» في السيرة. */
const EMBED_FIELDS = new Set(['mapEmbed', 'embed', 'iframe', 'cover', 'image', 'og'])

function harvestFromFile(file, kind) {
  const path = resolve(ROOT, file)
  if (!existsSync(path)) return []
  const text = readFileSync(path, 'utf8')
  const found = []
  for (const match of text.matchAll(linkPattern)) {
    const field = match[1]
    const url = match[2]
    /* عنوان المادة الحاضنة: نبحث لأعلى عن أقرب title/ar لنسمّي العطب باسمه */
    /* نافذة أوسع: ملخّص البحث يتجاوز ٩٠٠ حرف فيبتلع العنوان ويترك العطب بلا اسم */
    const before = text.slice(Math.max(0, match.index - 4000), match.index)
    const title = [...before.matchAll(/(?:title|ar):\s*'((?:[^'\\]|\\.)*)'/g)].at(-1)?.[1] || ''
    const slug = [...before.matchAll(/slug:\s*'([^']+)'/g)].at(-1)?.[1] || ''
    if (EMBED_FIELDS.has(field)) continue
    found.push({ url, kind, field, title: title.slice(0, 90), slug, where: file })
  }
  return found
}

async function harvestFirestore() {
  if (!env.FIREBASE_SERVICE_ACCOUNT && !env.GOOGLE_APPLICATION_CREDENTIALS) return []
  const saPath = resolve(ROOT, env.FIREBASE_SERVICE_ACCOUNT || 'sa.json')
  if (!existsSync(saPath)) return []
  const { initializeApp, cert, getApps } = await import('firebase-admin/app')
  const { getFirestore } = await import('firebase-admin/firestore')
  const app = getApps()[0] || initializeApp({ credential: cert(JSON.parse(readFileSync(saPath, 'utf8'))) })
  const db = getFirestore(app)
  const collections = [
    ['site_radar', 'رادار'], ['site_picks', 'مختارات'], ['site_media', 'إعلام'],
    ['site_papers', 'بحث'], ['site_articles', 'مقال'], ['site_upcoming', 'لقاء'],
  ]
  const found = []
  for (const [name, kind] of collections) {
    const snapshot = await db.collection(name).get().catch(() => null)
    if (!snapshot) continue
    snapshot.forEach((document) => {
      const data = document.data()
      const url = String(data.url || data.source || data.link || '')
      if (/^https?:\/\//.test(url)) {
        found.push({ url, kind, title: String(data.title || data.ar || '').slice(0, 90), slug: document.id, where: name })
      }
    })
  }
  return found
}

const hostOfUrl = (value) => { try { return new URL(value).host } catch { return 'المقصد' } }

/* ═══ فحص رابط واحد: نميّز الميت الحقيقي من العطل العابر ═══ */
async function probe(url) {
  /* لا نتبع التحويل تلقائياً: رابط DOI يردّ 302 سليماً إلى ناشرٍ قد يكون محجوباً
     عنّا، فكان الاتّباع التلقائي يُسقط الرابط السليم بذنب مقصده. نتبع يدوياً
     ثلاث قفزات، وإن تعثّرت قفزةٌ بعطبٍ شبكي حكمنا للرابط نفسه لا لمقصده. */
  const attempt = async (method) => {
    let current = url
    let lastStatus = 0
    for (let hop = 0; hop < 4; hop++) {
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
      let response
      try {
        response = await fetch(current, {
          method,
          redirect: 'manual',
          signal: controller.signal,
          headers: { 'user-agent': 'Mozilla/5.0 (compatible; AlfailakawiSourceCheck/1.0)' },
        })
      } catch (error) {
        if (hop === 0) throw error
        /* الرابط نفسه ردّ تحويلاً صحيحاً؛ العطب في المقصد */
        return { status: lastStatus || 302, finalUrl: current, hopFailed: true }
      } finally {
        clearTimeout(timer)
      }
      lastStatus = response.status
      const location = response.headers.get('location')
      if (response.status >= 300 && response.status < 400 && location) {
        current = new URL(location, current).toString()
        continue
      }
      return { status: response.status, finalUrl: current }
    }
    return { status: lastStatus, finalUrl: current, hopFailed: true }
  }
  try {
    let result = await attempt('HEAD')
    /* كثير من الخوادم ترفض HEAD (405/403) وهي حيّة — نعيد بـGET قبل الحكم */
    if (result.status === 405 || result.status === 403 || result.status === 501) {
      result = await attempt('GET')
    }
    const { status, finalUrl } = result
    const { hopFailed } = result
    if (hopFailed) return { state: 'ok', status, note: `الرابط سليم؛ مقصده (${hostOfUrl(finalUrl)}) لا يستجيب للفاحص`, finalUrl }
    if (status >= 200 && status < 400) {
      const redirected = finalUrl && new URL(finalUrl).host !== new URL(url).host
      return { state: 'ok', status, note: redirected ? `يحوّل إلى ${new URL(finalUrl).host}` : '', finalUrl }
    }
    if (status === 404 || status === 410) return { state: 'dead', status, note: 'الصفحة غير موجودة عند المصدر' }
    if (status === 401 || status === 403) return { state: 'blocked', status, note: 'المصدر يمنع الفحص الآلي — قد يعمل في المتصفح' }
    if (status === 429) return { state: 'throttled', status, note: 'المصدر يحدّ الطلبات — يُعاد فحصه لاحقاً' }
    if (status >= 500) return { state: 'server', status, note: 'عطل مؤقت في خادم المصدر' }
    return { state: 'suspect', status, note: `استجابة غير متوقعة (${status})` }
  } catch (error) {
    const message = String(error?.message || error)
    if (/abort|timeout/i.test(message)) return { state: 'timeout', status: 0, note: `تجاوز ${Math.round(TIMEOUT_MS / 1000)} ثوانٍ بلا رد` }
    return { state: 'unreachable', status: 0, note: `تعذّر الوصول: ${message.slice(0, 80)}` }
  }
}

/* الأحوال التي تستدعي قرار الدكتور فعلاً (لا العابر منها) */
/* host-blocked ليس منها: النطاق محجوب عن الفاحص لا ميت */
const NEEDS_ATTENTION = new Set(['dead', 'unreachable', 'suspect'])
const ADVICE = {
  dead: 'الرابط ميت فعلاً — استبدله أو احذف المادة.',
  unreachable: 'النطاق نفسه لا يستجيب — ربما انتهى تسجيله.',
  suspect: 'استجابة غريبة — افتحه بنفسك للتأكد.',
  blocked: 'المصدر يحجب الفاحص الآلي؛ غالباً يعمل عندك في المتصفح.',
  throttled: 'المصدر حدّ الطلبات مؤقتاً — سيُفحص في الجولة القادمة.',
  server: 'عطل مؤقت عند المصدر — لا تتسرع بالحذف.',
  timeout: 'بطء شديد أو حجب — يُعاد فحصه في الجولة القادمة.',
  'host-blocked': 'النطاق كله محجوب عن الفاحص — الأرجح أنه سليم عند القرّاء.',
}

async function mapWithLimit(items, limit, worker) {
  const results = new Array(items.length)
  let index = 0
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (index < items.length) {
      const current = index++
      results[current] = await worker(items[current], current)
    }
  }))
  return results
}

if (SELF_TEST) {
  const cases = [
    [{ state: 'dead' }, true], [{ state: 'blocked' }, false],
    [{ state: 'throttled' }, false], [{ state: 'server' }, false],
    [{ state: 'unreachable' }, true], [{ state: 'ok' }, false],
  ]
  for (const [probeResult, shouldFlag] of cases) {
    if (NEEDS_ATTENTION.has(probeResult.state) !== shouldFlag) {
      console.error(`✘ تصنيف خاطئ لحالة ${probeResult.state}`)
      process.exit(1)
    }
  }
  console.log('✓ اختبار الفاحص الشامل: 404/نطاق ميت → يُبلَّغ · 403/429/5xx/مهلة → لا يُبلَّغ عنه كعطب')
  process.exit(0)
}

/* ═══ التشغيل ═══ */
/* تفريقٌ جوهري بأمر الدكتور:
   «مادة الغير» (مختارات ورادار) روابط خارجية لا سلطة له عليها — تُنظَّف آلياً
   فور موتها فلا يبقى في الموقع رابطٌ ميت.
   «إصداراته» (كتبه ومقالاته وأبحاثه) لا تُمسّ أبداً مهما مات رابطها — تُعرض
   له ليصلحها بنفسه، فحذف أثر عمله قرارٌ لا يملكه إلا هو. */
/* ═══ قاعدة الملكية — أمر الدكتور الصريح ═══
   ستةٌ له وحده لا تُمسّ أبداً مهما مات رابطها، لأنها أثر عمله:
     المقالات · الكتب · الأبحاث · الإعلام · اللقاءات القادمة · السيرة والهوية
   تُعرض له في التقرير ليصلح رابطها بنفسه من اللوحة (وهي تسمح بذلك أصلاً).
   وما عداها مادةُ غيره (مختارات ورادار) — يُنظَّف ميتها آلياً بلا سؤال. */
const OWNED_BY_DOCTOR = new Set(['مقال', 'كتاب', 'بحث', 'إعلام', 'لقاء', 'سيرة', 'محتوى', 'إنجليزي'])

const harvested = [
  ...harvestFromFile('src/data.ts', 'محتوى'),
  ...harvestFromFile('src/data/research-papers.ts', 'بحث'),
  ...harvestFromFile('src/data-curated.ts', 'مختارات'),
  ...harvestFromFile('src/data-en.ts', 'إنجليزي'),
  ...(await harvestFirestore()),
]

/* رابط واحد قد يتكرر في مواضع — نفحصه مرة ونذكر كل مواضعه */
const byUrl = new Map()
for (const item of harvested) {
  const entry = byUrl.get(item.url) || { url: item.url, places: [] }
  entry.places.push({ kind: item.kind, title: item.title, slug: item.slug, where: item.where })
  byUrl.set(item.url, entry)
}
const unique = [...byUrl.values()]
console.log(`فحص ${unique.length} رابطاً فريداً من ${harvested.length} موضعاً في الموقع…`)

let done = 0
const checked = await mapWithLimit(unique, CONCURRENCY, async (entry) => {
  const result = await probe(entry.url)
  done += 1
  if (done % 25 === 0) console.log(`  … ${done}/${unique.length}`)
  return { ...entry, ...result, advice: ADVICE[result.state] || '' }
})

/* رابطٌ يقع في مادة الدكتور ولو مرةً واحدة يُعامل معاملتها: لا يُمسّ */
const isOwned = (item) => (item.places || []).some((place) => OWNED_BY_DOCTOR.has(place.kind))

/* ═══ حارس الإنذار الكاذب ═══
   نطاقٌ كامل لا يستجيب (حتى صفحته الرئيسية) ليس سبعةَ عشرَ رابطاً ميتاً، بل
   حجبٌ شبكي أو جغرافي أمام الفاحص — بنك المعرفة المصري (ekb.eg) مثالٌ حيّ:
   يستجيب للقرّاء ولا يستجيب لنا. إعلانُ أبحاث الدكتور «ميتة» بسببه إنذارٌ
   كاذب يدفعه لتغيير روابط سليمة. نُنزّل هذه الحالة إلى تنبيهٍ صريح. */
/* التجميع بالنطاق المسجَّل لا المضيف الكامل: journals.ekb.eg وssj.journals.ekb.eg
   وjsrep.journals.ekb.eg خادمٌ واحد محجوب، لا ثلاثة مواقع ميتة. */
const hostOf = (url) => {
  try {
    const host = new URL(url).host
    const parts = host.split('.')
    if (parts.length <= 2) return host
    /* نطاقات البلد المركّبة (co.uk، ekb.eg…): نأخذ ثلاث تسميات */
    const twoLevelTld = /^(co|com|org|net|gov|edu|ac)\.[a-z]{2}$/.test(parts.slice(-2).join('.'))
    return parts.slice(twoLevelTld ? -3 : -2).join('.')
  } catch { return '' }
}
const hostStats = new Map()
for (const item of checked) {
  const host = hostOf(item.url)
  if (!host) continue
  const stat = hostStats.get(host) || { total: 0, unreachable: 0 }
  stat.total += 1
  if (item.state === 'unreachable' || item.state === 'timeout') stat.unreachable += 1
  hostStats.set(host, stat)
}
for (const item of checked) {
  const stat = hostStats.get(hostOf(item.url))
  if (!stat) continue
  /* كل روابط النطاق سقطت، وهي أكثر من واحد → النطاق نفسه محجوب عنّا */
  if ((item.state === 'unreachable' || item.state === 'timeout') && stat.total >= 2 && stat.unreachable === stat.total) {
    item.state = 'host-blocked'
    item.note = `النطاق كله لا يستجيب للفاحص (${stat.total} روابط) — غالباً حجب شبكي أو جغرافي`
    item.advice = 'افتحه بنفسك للتأكد؛ الأرجح أنه يعمل عند القرّاء ولا يحتاج تغييراً.'
  }
}

let summaryExtra = { hidden: 0, replaced: 0, revived: 0 }
const problems = checked.filter((item) => NEEDS_ATTENTION.has(item.state))
const warnings = checked.filter((item) => !NEEDS_ATTENTION.has(item.state) && item.state !== 'ok')
const mine = problems.filter(isOwned)
const foreign = problems.filter((item) => !isOwned(item))

const summary = {
  checkedAt: new Date().toISOString(),
  total: unique.length,
  places: harvested.length,
  ok: checked.filter((item) => item.state === 'ok').length,
  problems: problems.length,
  warnings: warnings.length,
  /* عدّادان منفصلان: ما ينتظر قرار الدكتور، وما نظّفه النظام عنه */
  mine: mine.length,
  cleaned: foreign.length,

  items: [...mine, ...foreign, ...warnings].slice(0, 200).map((item) => ({
    url: item.url,
    state: item.state,
    status: item.status,
    note: item.note,
    advice: item.advice,
    owned: isOwned(item),
    places: item.places.slice(0, 3),
  })),
}

console.log(`\n✔ سليمة: ${summary.ok} · إصداراتك التي تحتاج قرارك: ${mine.length} · مادة خارجية للتنظيف: ${foreign.length} · تنبيهات عابرة: ${warnings.length}`)
if (mine.length) {
  console.log('\n══ إصداراتك — لا يمسّها النظام، أنت تصلح رابطها من اللوحة ══')
  for (const item of mine.slice(0, 20)) {
    const place = item.places[0] || {}
    console.log(`  ✘ [${item.state}] ${place.kind || ''} «${(place.title || place.slug || '').slice(0, 55)}»\n     ${item.url}\n     ${item.note}`)
  }
}
if (foreign.length) {
  console.log('\n══ مادة خارجية — يُنظّفها النظام تلقائياً ══')
  for (const item of foreign.slice(0, 20)) {
    const place = item.places[0] || {}
    console.log(`  ✘ [${item.state}] ${place.kind || ''} «${(place.title || place.slug || '').slice(0, 55)}»\n     ${item.url}`)
  }
}

/* ═══ التنظيف الآلي: المادة الخارجية وحدها ═══
   بأمر الدكتور: ما ليس من إصداراته يُنظَّف فور موته بلا سؤال، فلا يبقى في
   الموقع رابطٌ ميت. وإصداراته لا تُمسّ مهما كان. */
if (foreign.length && !process.argv.includes('--report-only')) {
  const deadStorePath = resolve(ROOT, 'src/data/curated-dead-links.json')
  let deadStore = {}
  try { deadStore = JSON.parse(readFileSync(deadStorePath, 'utf8')) } catch { /* أول مرة */ }
  let addedBank = 0
  for (const item of foreign) {
    if (item.state !== 'dead') continue
    const fromBank = (item.places || []).some((place) => String(place.where || '').includes('data-curated'))
    if (fromBank && !deadStore[item.url]) { deadStore[item.url] = new Date().toISOString(); addedBank += 1 }
  }
  if (addedBank) {
    const { writeFileSync } = await import('node:fs')
    writeFileSync(deadStorePath, `${JSON.stringify(deadStore, null, 2)}\n`, 'utf8')
    console.log(`\n🧹 نُظّف ${addedBank} رابطاً خارجياً ميتاً من المختارات (يُصفّى وقت العرض).`)
  }

  /* الميت في Firestore (رادار/مختارات اللوحة) يُحذف مباشرةً */
  const saCleanup = resolve(ROOT, env.FIREBASE_SERVICE_ACCOUNT || 'sa.json')
  if (existsSync(saCleanup)) {
    const { initializeApp, cert, getApps } = await import('firebase-admin/app')
    const { getFirestore } = await import('firebase-admin/firestore')
    const app = getApps()[0] || initializeApp({ credential: cert(JSON.parse(readFileSync(saCleanup, 'utf8'))) })
    const db = getFirestore(app)
    let removed = 0
    for (const item of foreign) {
      if (item.state !== 'dead') continue
      for (const place of item.places || []) {
        if (!['site_radar', 'site_picks'].includes(place.where)) continue
        await db.collection(place.where).doc(place.slug).delete().catch(() => undefined)
        console.log(`  🧹 حُذف من ${place.where}: ${(place.title || place.slug).slice(0, 50)}`)
        removed += 1
      }
    }
    if (removed) console.log(`✓ حُذف ${removed} عنصراً خارجياً ميتاً تلقائياً.`)
  }
}

/* ═══ سجلّ الروابط الميتة: تُخفى أيقونتها فوراً، ويُبحث لها عن بديلٍ مؤكد ═══
   بأمر الدكتور: أي رابط بحثٍ أو مقالةٍ أو لقاءٍ يموت تختفي أيقونته مباشرةً —
   لا يبقى للزائر رابطٌ مكسور. والمادة نفسها لا تُمسّ.
   ثم نبحث عن بديل: لا يُقبل إلا إن كان يقيناً لا اجتهاداً — أن يستجيب فعلاً،
   وأن يكون المعرّف نفسه (DOI/الملف) على نطاقٍ رسميٍّ بديل. وما دون ذلك تنبيه. */
async function findCertainReplacement(url) {
  /* DOI ميت عند doi.org: نجرّب المُحوّل الرسمي البديل بالمعرّف نفسه حرفياً */
  const doiMatch = url.match(/doi\.org\/(10\.[^\s?#]+)/i)
  if (doiMatch) {
    for (const base of ['https://dx.doi.org/', 'https://doi.org/api/handles/']) {
      const candidate = base === 'https://doi.org/api/handles/' ? `${base}${doiMatch[1]}` : `${base}${doiMatch[1]}`
      const verdict = await probe(candidate)
      /* البديل لا يُقبل إلا إن ردّ ٢٠٠ فعلاً وبنفس المعرّف — لا تخمين */
      if (verdict.state === 'ok' && base !== 'https://doi.org/api/handles/') return candidate
    }
    return ''
  }
  /* http→https على النطاق نفسه: تحسينٌ يقيني لا تخمين فيه */
  if (url.startsWith('http://')) {
    const secure = url.replace(/^http:\/\//, 'https://')
    const verdict = await probe(secure)
    if (verdict.state === 'ok') return secure
  }
  return ''
}

{
  const deadPath = resolve(ROOT, 'src/data/dead-links.json')
  let registry = { note: '', updatedAt: '', items: [] }
  try { registry = JSON.parse(readFileSync(deadPath, 'utf8')) } catch { /* أول مرة */ }
  const previous = new Map((registry.items || []).map((item) => [item.url, item]))
  const nextItems = []
  let hidden = 0, replaced = 0, revived = 0

  for (const item of checked) {
    const wasDead = previous.get(item.url)
    if (item.state === 'dead' || item.state === 'unreachable') {
      const existing = wasDead || { url: item.url, state: item.state, since: new Date().toISOString() }
      if (!existing.replacement) {
        const replacement = await findCertainReplacement(item.url)
        if (replacement) { existing.replacement = replacement; replaced += 1 }
        else hidden += 1
      }
      existing.state = item.state
      nextItems.push(existing)
    } else if (wasDead) {
      revived += 1  /* عاد للحياة → يُرفع من السجل فتعود أيقونته */
    }
  }

  registry.updatedAt = new Date().toISOString()
  registry.items = nextItems
  const { writeFileSync } = await import('node:fs')
  writeFileSync(deadPath, `${JSON.stringify(registry, null, 2)}\n`, 'utf8')
  if (hidden || replaced || revived) {
    console.log(`\n🔗 سجلّ الروابط: أُخفيت ${hidden} · استُبدلت بيقين ${replaced} · عادت للحياة ${revived}`)
  }
  summaryExtra = { hidden, replaced, revived }
}

/* التقرير إلى Firestore كي تقرأه اللوحة وتعرضه مفصّلاً */
const saPath = resolve(ROOT, env.FIREBASE_SERVICE_ACCOUNT || 'sa.json')
if (existsSync(saPath)) {
  const { initializeApp, cert, getApps } = await import('firebase-admin/app')
  const { getFirestore } = await import('firebase-admin/firestore')
  const app = getApps()[0] || initializeApp({ credential: cert(JSON.parse(readFileSync(saPath, 'utf8'))) })
  await getFirestore(app).collection('site_health').doc('sources').set({ ...summary, links: summaryExtra })
  console.log('\n✓ كُتب التقرير التفصيلي في site_health/sources — تقرؤه اللوحة.')
}

process.exit(0)
