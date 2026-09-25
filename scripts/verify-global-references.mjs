#!/usr/bin/env node
/**
 * يعيد التحقق من «مراجع العالم» من صفحاتها الأصلية: كل مقطعٍ من الاقتباس (المقاطع
 * مفصولة بـ«…») يجب أن يرد حرفياً في ملخّص الدراسة المسجَّل لمعرّفها (Crossref أو
 * OpenAlex أو PubMed بعد مطابقة العنوان، أو صفحة الناشر) أو في الصفحة الرسمية للمنظمة.
 *
 *   node scripts/verify-global-references.mjs          → تقرير، ورمز خروج 1 عند أي سقوط
 *
 * يحتاج شبكةً مفتوحة، فليس جزءاً من البناء. ما تحجبه الصفحة عن الطلب الآلي (ScienceDirect)
 * يُعلَّم «يدوي» ويُذكر مصدره في quote_source.
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const bank = JSON.parse(readFileSync(resolve('src/data/global-references.json'), 'utf8'))
const UA = { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36', Accept: 'text/html,application/json', 'Accept-Language': 'en' }
const NAMED = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', ndash: '–', mdash: '—', ldquo: '“', rdquo: '”', lsquo: '‘', rsquo: '’', hellip: '…', middot: '·', thinsp: ' ', minus: '−' }
const decode = (value = '') => String(value)
  .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
  .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(Number(dec)))
  .replace(/&([a-z]+);/gi, (entity, name) => NAMED[name.toLowerCase()] ?? entity)
/* النص يُقارَن ولا يُعرض أبداً. الوسوم تُنزع بمرورٍ على الحروف لا بتعبيرٍ نمطي (CodeQL:
   نزع «<script» بالتعبير النمطي قد يترك بقايا وسم): كل ما بين «<» و«>» يسقط، ثم يُمحى
   أي «<» أو «>» يبقى بعد فكّ الكيانات. محتوى السكربتات إن بقي نصاً لا يضرّ المطابقة. */
const stripTags = (value = '', gap = ' ') => {
  let out = ''
  let inTag = false
  for (const character of String(value)) {
    if (character === '<') { inTag = true; out += gap } else if (character === '>' && inTag) inTag = false
    else if (!inTag) out += character
  }
  return out
}
const noAngles = (value = '') => value.replace(/[<>]/g, ' ')
const plain = (value = '') => noAngles(decode(stripTags(value))).replace(/\s+/g, ' ').trim()
const tight = (value = '') => noAngles(decode(stripTags(value, ''))).replace(/\s+/g, ' ').trim()
const squash = (value = '') => value.toLowerCase().replace(/[^a-z0-9]/g, '')

/* بعض الخوادم ترفض الطلب المتلاحق أحياناً: ثلاث محاولاتٍ متباعدة قبل الحكم بالسقوط. */
/* الرابط الميت (404 أو 410) غير الخادم الرافض (403 أو قطع الاتصال): الأول خطأٌ في البنك
   يُسقط الفحص، والثاني «تعذّر الوصول» يُعاد لاحقاً (Codex). آخر حالةٍ لكل رابطٍ هنا. */
const lastStatus = new Map()
async function get(url, as = 'text') {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const response = await fetch(url, { headers: UA, redirect: 'follow' })
      lastStatus.set(url, response.status)
      if (response.ok) return as === 'json' ? await response.json() : await response.text()
      if ([404, 410].includes(response.status)) return null
    } catch { lastStatus.set(url, 0) }
    await new Promise((done) => setTimeout(done, 1500 * (attempt + 1)))
  }
  return null
}

/* يعيد النصوص مع علامة: هل وصلنا إلى ملخّصٍ واحدٍ على الأقل؟ العنوان وحده لا يكفي حكماً. */
async function abstractsFor(reference) {
  const texts = []
  let reached = false
  const doi = reference.doi
  const crossref = await get(`https://api.crossref.org/works/${encodeURIComponent(doi)}`, 'json')
  const title = crossref?.message?.title?.[0] || ''
  if (title) texts.push(plain(title))
  if (crossref?.message?.abstract) { texts.push(plain(crossref.message.abstract)); reached = true }
  const openalex = await get(`https://api.openalex.org/works/doi:${doi}`, 'json')
  if (openalex?.abstract_inverted_index && squash(openalex.title || '').slice(0, 30) === squash(title).slice(0, 30)) {
    const words = []
    for (const [word, positions] of Object.entries(openalex.abstract_inverted_index)) for (const position of positions) words[position] = word
    texts.push(plain(words.join(' ')))
    reached = true
  }
  const search = await get(`https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&retmode=json&term=${encodeURIComponent(`${doi}[doi]`)}`, 'json')
  const pmid = search?.esearchresult?.idlist?.[0]
  if (pmid) {
    const xml = await get(`https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?db=pubmed&id=${pmid}&retmode=xml`) || ''
    const pubmedTitle = plain((xml.match(/<ArticleTitle>([\s\S]*?)<\/ArticleTitle>/) || [])[1] || '')
    /* بحث PubMed بالمعرّف تقريبي: أعاد لدراستين ملخّص بحثٍ آخر تماماً. العنوان هو الحكم. */
    if (squash(pubmedTitle).slice(0, 30) === squash(title).slice(0, 30)) {
      const abstract = plain([...xml.matchAll(/<AbstractText[^>]*>([\s\S]*?)<\/AbstractText>/g)].map((match) => match[1]).join(' '))
      if (abstract) { texts.push(abstract); reached = true }
    }
  }
  if (doi.startsWith('10.1007/')) {
    const page = await get(`https://link.springer.com/article/${doi}`) || ''
    const block = (page.match(/id="Abs1-content"[^>]*>([\s\S]*?)<\/div>/) || [])[1]
    if (block) { texts.push(tight(block)); reached = true }
  }
  return { texts, reached }
}

let failed = 0
let manual = 0
let unreachable = 0
for (const reference of bank.references) {
  if (/manuscript/i.test(reference.quote_source || '')) {
    manual += 1
    console.log(`… يدوي  ${reference.id} — ${reference.quote_source}`)
    continue
  }
  /* رابط WHO للوحدة فيه «improved-heath» كما نشرته المنظمة نفسها؛ «health» تعطي 404. */
  const page = reference.doi ? null : plain(await get(reference.url) || '')
  const { texts, reached } = reference.doi ? await abstractsFor(reference) : { texts: [page], reached: Boolean(page) }
  const deadStatus = lastStatus.get(reference.doi ? `https://api.crossref.org/works/${encodeURIComponent(reference.doi)}` : reference.url)
  if ([404, 410].includes(deadStatus)) {
    failed += 1
    console.log(`✗ ${reference.id} — الرابط ميت (${reference.doi ? 'المعرّف غير مسجّل في Crossref' : deadStatus})`)
    continue
  }
  const parts = plain(reference.quote).split(/\s*…\s*/).map((part) => part.trim()).filter(Boolean)
  const missing = parts.filter((part) => !texts.some((text) => text.includes(part)))
  /* خادمٌ يقطع الاتصال (UNESCO وSpringer يرفضان بصمة fetch في Node أحياناً) ليس دليلاً على خطأ
     الاقتباس: يُعدّ «تعذّر الوصول» ويُعاد الفحص لاحقاً أو من متصفح، ولا يُحسب سقوطاً. */
  if (missing.length && !reached) {
    unreachable += 1
    console.log(`? ${reference.id} — تعذّر الوصول إلى الملخّص أو الصفحة الآن`)
  } else if (missing.length) {
    failed += 1
    console.log(`✗ ${reference.id} — لم يُعثر على: «${missing[0].slice(0, 80)}…»`)
  } else console.log(`✓ ${reference.id}`)
  await new Promise((done) => setTimeout(done, 300))
}
console.log(`\n${bank.references.length - failed - manual - unreachable} مُتحقَّق · ${manual} يدوي · ${unreachable} تعذّر الوصول · ${failed} ساقط`)
process.exit(failed ? 1 : 0)
