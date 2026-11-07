#!/usr/bin/env node
/**
 * جالب مصادر «مِحور».
 *
 * - يجلب من واجهات رسمية مجانية وخلاصات RSS عامة فقط (بلا مفاتيح ولا بيانات خاصة).
 * - كل مصدر معزول: فشل مصدر لا يوقف البقية، وتُسجَّل حالته ووقت آخر نجاح له.
 * - كل ما يرد من الخارج يُعامل كبيانات غير موثوقة: تنظيف، روابط http/https فقط،
 *   تواريخ صالحة غير مستقبلية، إزالة التكرار.
 * - الكتابة إلى Firestore (mihwar_feed/*) بحساب الخدمة؛ القراءة للمشرف فقط بقواعد قاعدة البيانات.
 *
 * التشغيل:  node scripts/mihwar-feed.mjs            (جلب + كتابة)
 *           node scripts/mihwar-feed.mjs --dry-run   (جلب فقط، يطبع ملخصاً)
 *           node scripts/mihwar-feed.mjs --self-test (اختبارات المحلّلات بلا شبكة)
 */
import { readFileSync, existsSync, writeFileSync } from 'node:fs'
import { XMLParser } from 'fast-xml-parser'
import {
  DEFAULT_INTERESTS, scoreItem, sanitizeItem, dedupe, approxDate, safeUrl, parseEnglishDate, stripHtml, validPastDate, deadlineStatus, daysUntil,
} from '../src/pages/mihwar-core.mjs'

const DRY = process.argv.includes('--dry-run')
const SELF_TEST = process.argv.includes('--self-test')
const UA = 'Mozilla/5.0 (compatible; MihwarFeedBot/1.0; +https://dr-alfailakawi.com/robots.txt)'
const NOW = Date.now()
const MAX_ITEMS = 520
const CHUNK = 110
const RETENTION_DAYS = { 'بحث': 150, 'مقال': 60, 'خبر': 45 }
const xml = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_', textNodeName: '#text', trimValues: true, processEntities: true })
const arr = (v) => (v === undefined || v === null ? [] : Array.isArray(v) ? v : [v])
const text = (v) => (v && typeof v === 'object' ? String(v['#text'] ?? '') : String(v ?? ''))
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const isoDay = (ms) => new Date(ms).toISOString().slice(0, 10)

async function getText(url, { timeout = 25000, retries = 1, headers = {}, max = 4_000_000 } = {}) {
  let lastError
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await fetch(url, { headers: { 'User-Agent': UA, Accept: '*/*', ...headers }, signal: AbortSignal.timeout(timeout), redirect: 'follow' })
      if (!response.ok) throw new Error('HTTP ' + response.status)
      const body = await response.text()
      if (body.length > max) throw new Error('الاستجابة أكبر من الحد')
      return body
    } catch (error) {
      lastError = error
      if (attempt < retries) await sleep(1500 * (attempt + 1))
    }
  }
  throw new Error(String(lastError?.message || lastError).slice(0, 80) + (lastError?.cause?.code ? ' [' + lastError.cause.code + ']' : ''))
}
const getJson = async (url, opts) => {
  const body = await getText(url, opts)
  try { return JSON.parse(body) } catch { throw new Error('استجابة غير JSON (ربما حجب أو صفحة خطأ)') }
}

// ---------- مُحلِّلات ----------

export function parseRss(body, source) {
  let doc
  try { doc = xml.parse(body) } catch { throw new Error('ليست خلاصة RSS/Atom صالحة') }
  const channel = doc?.rss?.channel
  const entries = channel ? arr(channel.item) : arr(doc?.feed?.entry)
  if (!channel && !doc?.feed) throw new Error('ليست خلاصة RSS/Atom صالحة')
  return entries.map((entry) => {
    const link = entry.link
    const url = typeof link === 'string' ? link : arr(link).find((l) => (l['@_rel'] || 'alternate') === 'alternate')?.['@_href'] || text(arr(link)[0]) || text(entry.guid)
    return {
      title: text(entry.title), url, published: entry.pubDate || entry.published || entry.updated || entry['dc:date'] || null,
      description: text(entry.description || entry.summary || entry['content:encoded'] || entry.content), keywords: arr(entry.category).map((c) => text(typeof c === 'object' ? c['@_term'] ?? c : c)).join('، '),
      source: source.name, sourceId: source.id, type: source.type, language: source.lang,
    }
  })
}

export function parseArxiv(body, source) {
  const doc = xml.parse(body)
  return arr(doc?.feed?.entry).map((entry) => ({
    title: text(entry.title), url: arr(entry.link).find((l) => l['@_rel'] === 'alternate')?.['@_href'] || text(entry.id), published: entry.published,
    description: text(entry.summary), keywords: arr(entry.category).map((c) => c['@_term']).join('، '), source: 'arXiv', sourceId: source.id, type: 'بحث', language: 'en',
    venue: 'arXiv (نسخة أولية غير محكّمة)',
  }))
}

export function parseCrossref(json, source) {
  return arr(json?.message?.items).map((work) => {
    const parts = (work.issued || work.published || work['published-online'] || work['published-print'])?.['date-parts']?.[0] || []
    const published = parts.length >= 3 ? parts.slice(0, 3).map((v, i) => (i ? String(v).padStart(2, '0') : String(v))).join('-') : null
    const doi = String(work.DOI || '')
    return {
      title: arr(work.title)[0], url: doi ? 'https://doi.org/' + doi : '', published,
      description: stripHtml(work.abstract || '', 420), keywords: arr(work.subject).join('، '), venue: arr(work['container-title'])[0] || '',
      source: 'Crossref · ' + (work.publisher || 'ناشر غير محدد'), sourceId: source.id, type: 'بحث', language: 'en', year: parts[0], month: parts[1],
    }
  })
}

export function parseEric(json, source) {
  return arr(json?.response?.docs).map((doc) => {
    const date = String(doc.publicationdate || '')
    const full = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(date) ? date : null
    return {
      title: doc.title, url: doc.url || 'https://eric.ed.gov/?id=' + doc.id, published: full, year: Number(doc.publicationdateyear) || null, month: Number(date.slice(5, 7)) || null,
      description: doc.description, keywords: arr(doc.subject).join('، '), venue: doc.source || '', source: 'ERIC (وزارة التعليم الأمريكية)', sourceId: source.id, type: 'بحث', language: 'en',
    }
  })
}

export function parseOpenAlex(json, source) {
  return arr(json?.results).map((work) => ({
    title: work.title, url: work.doi || work.primary_location?.landing_page_url || '', published: work.publication_date,
    description: '', keywords: arr(work.topics).slice(0, 4).map((t) => t.display_name).join('، '), venue: work.primary_location?.source?.display_name || '',
    source: 'OpenAlex', sourceId: source.id, type: 'بحث', language: work.language || 'en',
  }))
}

export function parseWikiCfpList(body, source) {
  const doc = xml.parse(body)
  return arr(doc?.rss?.channel?.item).map((item) => {
    const desc = text(item.description)
    const bracket = [...desc.matchAll(/\[([^\]]+)\]/g)].map((m) => m[1])
    const when = bracket[bracket.length - 1] || ''
    const [start, end] = when.split(/\s+-\s+/)
    return { title: text(item.title), url: text(item.link), description: desc.replace(/\s*\[[^\]]+\]/g, '').trim(), location: bracket.length > 1 ? bracket[0] : '', eventStart: parseEnglishDate(start), eventEnd: parseEnglishDate(end), source: 'WikiCFP', sourceId: source.id, type: 'مؤتمر', language: 'en' }
  })
}

export function parseWikiCfpDetail(html) {
  const deadline = html.match(/<th>\s*Submission Deadline\s*<\/th>[\s\S]*?content="(\d{4}-\d{2}-\d{2})T/i)?.[1] || null
  const official = html.match(/Link:\s*<a href="([^"]+)"/i)?.[1] || null
  const where = html.match(/<th>\s*Where\s*<\/th>\s*<td[^>]*>([^<]*)</i)?.[1]?.trim() || ''
  const body = html.match(/<div class="cfp"[^>]*>([\s\S]*?)<\/div>/i)?.[1] || ''
  const online = /\b(virtual|online|hybrid)\b/i.test(where + ' ' + body.slice(0, 1500))
  const hybrid = /\bhybrid\b/i.test(where + ' ' + body.slice(0, 1500))
  return { deadline, officialUrl: official, location: where, mode: hybrid ? 'هجين' : online ? 'عن بُعد' : where ? 'حضوري' : 'غير محدد', description: stripHtml(body, 420) }
}

/** مواعيد قاعدة ccf-deadlines (YAML مبسّط) — نقرأ الحقول اللازمة دون مكتبة YAML. */
export function parseCcf(yml, source, now = NOW) {
  const head = yml.match(/- title:\s*(.+)\n\s*description:\s*(.+)/)
  const title = head?.[1]?.trim() || source.name
  const desc = head?.[2]?.trim() || ''
  const out = []
  for (const block of yml.split(/\n\s{4}- year:/).slice(1)) {
    const year = block.match(/^\s*(\d{4})/)?.[1]
    const link = block.match(/link:\s*(\S+)/)?.[1]
    const place = block.match(/place:\s*(.+)/)?.[1]?.replace(/^['"]|['"]$/g, '').trim() || ''
    const date = block.match(/date:\s*(.+)/)?.[1]?.replace(/^['"]|['"]$/g, '').trim() || ''
    const tz = block.match(/timezone:\s*(\S+)/)?.[1] || 'UTC'
    const comment = block.match(/comment:\s*(.+)/)?.[1]?.replace(/^['"]|['"]$/g, '').trim() || ''
    for (const dl of [...block.matchAll(/(?:^|\s)deadline:\s*'?(\d{4}-\d{2}-\d{2}(?: \d{2}:\d{2}:\d{2})?)'?/g)].map((m) => m[1])) {
      const offset = tz === 'AoE' ? -12 : (tz.match(/^UTC([+-]\d{1,2})/)?.[1] ? Number(tz.match(/^UTC([+-]\d{1,2})/)[1]) : 0)
      const ms = Date.parse(dl.replace(' ', 'T') + 'Z') - offset * 3600000
      if (!Number.isFinite(ms) || ms < now) continue
      const eventDates = parseRange(date, Number(year))
      out.push({ title: `${title} ${year}`, url: link, officialUrl: link, published: null, description: `${desc}. ${comment}`.trim(), location: place, mode: /online|virtual/i.test(place) ? 'عن بُعد' : place ? 'حضوري' : 'غير محدد', deadline: isoDay(ms), deadlineNote: `الموعد الأقرب المنشور في قاعدة ccf-deadlines (${tz})`, ...eventDates, source: 'ccf-deadlines (' + title + ')', sourceId: source.id, type: 'مؤتمر', language: 'en' })
      break
    }
  }
  return out
}

function parseRange(text, year) {
  const m = String(text).match(/([A-Za-z]+)\.?\s+(\d{1,2})(?:\s*[-–]\s*(?:([A-Za-z]+)\.?\s+)?(\d{1,2}))?/)
  if (!m) return {}
  const mon = (s) => ({ jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 })[String(s).toLowerCase().slice(0, 3)]
  if (mon(m[1]) === undefined) return {}
  const start = new Date(Date.UTC(year, mon(m[1]), Number(m[2])))
  const end = m[4] ? new Date(Date.UTC(year, m[3] ? mon(m[3]) ?? mon(m[1]) : mon(m[1]), Number(m[4]))) : start
  return { eventStart: start.toISOString().slice(0, 10), eventEnd: end.toISOString().slice(0, 10) }
}

// ---------- تعريف المصادر ----------

const Q_RESEARCH = ['educational technology', 'generative AI higher education', 'artificial intelligence education students', 'e-learning online learning', 'gamification education', 'inclusive education assistive technology', 'media literacy digital literacy', 'academic integrity plagiarism artificial intelligence', 'augmented reality education', 'learning analytics', 'Kuwait Arab higher education']
const fromDate = isoDay(NOW - 120 * 86400000)
const enc = encodeURIComponent

export const SOURCES = [
  // أبحاث
  { id: 'crossref', name: 'Crossref', kind: 'research', licence: 'واجهة رسمية مجانية', urls: Q_RESEARCH.map((q) => `https://api.crossref.org/works?query.bibliographic=${enc(q)}&rows=40&filter=from-pub-date:${fromDate},until-pub-date:${isoDay(NOW)},type:journal-article&select=DOI,title,issued,publisher,container-title,subject,abstract`), parse: parseCrossref, json: true, delay: 1200 },
  { id: 'eric', name: 'ERIC', kind: 'research', licence: 'واجهة رسمية مجانية (IES)', urls: ['educational technology', 'generative artificial intelligence', 'gamification', 'distance learning', 'inclusive education technology', 'media literacy', 'academic integrity'].map((q) => `https://api.ies.ed.gov/eric/?search=${enc(q + ' AND publicationdateyear:[' + new Date(NOW).getUTCFullYear() + ' TO ' + new Date(NOW).getUTCFullYear() + ']')}&format=json&rows=25&fields=id,title,description,source,publicationdate,publicationdateyear,url,subject`), parse: parseEric, json: true, delay: 800 },
  { id: 'arxiv', name: 'arXiv', kind: 'research', licence: 'واجهة رسمية مجانية', urls: ['"educational technology"', '"generative AI" AND education', '"learning analytics"', '"AI tutor"', '"academic integrity"'].map((q) => `https://export.arxiv.org/api/query?search_query=all:${enc(q)}%20AND%20(cat:cs.CY%20OR%20cat:cs.HC%20OR%20cat:cs.AI%20OR%20cat:cs.CL)&sortBy=submittedDate&sortOrder=descending&max_results=20`), parse: parseArxiv, delay: 3200 },
  { id: 'openalex', name: 'OpenAlex', kind: 'research', licence: 'واجهة رسمية مجانية (ميزانية مشتركة)', urls: ['generative AI education', 'educational technology', 'gamification education', 'digital learning higher education'].map((q) => `https://api.openalex.org/works?search=${enc(q)}&filter=from_publication_date:${fromDate},type:article&sort=publication_date:desc&per-page=20&select=title,doi,publication_date,primary_location,topics,language`), parse: parseOpenAlex, json: true, delay: 1000, optional: true },
  // مقالات وأخبار مهنية
  { id: 'nature-edu', name: 'Nature · Education', kind: 'article', type: 'مقال', lang: 'en', urls: ['https://www.nature.com/subjects/education.rss'], parse: parseRss },
  { id: 'edsurge', name: 'EdSurge', kind: 'article', type: 'مقال', lang: 'en', urls: ['https://www.edsurge.com/articles_rss'], parse: parseRss },
  { id: 'ihe', name: 'Inside Higher Ed', kind: 'article', type: 'خبر', lang: 'en', urls: ['https://www.insidehighered.com/rss.xml'], parse: parseRss },
  { id: 'hechinger', name: 'The Hechinger Report', kind: 'article', type: 'مقال', lang: 'en', urls: ['https://hechingerreport.org/feed/'], parse: parseRss },
  { id: 'alt', name: 'Association for Learning Technology', kind: 'article', type: 'خبر', lang: 'en', urls: ['https://www.alt.ac.uk/rss.xml'], parse: parseRss },
  { id: 'guardian-edu', name: 'The Guardian · Education', kind: 'article', type: 'خبر', lang: 'en', urls: ['https://www.theguardian.com/education/rss'], parse: parseRss },
  { id: 'guardian-ai', name: 'The Guardian · AI', kind: 'article', type: 'خبر', lang: 'en', urls: ['https://www.theguardian.com/technology/artificialintelligenceai/rss'], parse: parseRss },
  { id: 'niemanlab', name: 'Nieman Lab', kind: 'article', type: 'مقال', lang: 'en', urls: ['https://www.niemanlab.org/feed/'], parse: parseRss },
  { id: 'aljazeera', name: 'الجزيرة نت', kind: 'article', type: 'خبر', lang: 'ar', urls: ['https://www.aljazeera.net/rss'], parse: parseRss },
  { id: 'bbc-ar', name: 'BBC عربي', kind: 'article', type: 'خبر', lang: 'ar', urls: ['https://feeds.bbci.co.uk/arabic/rss.xml'], parse: parseRss },
  // مؤتمرات وفرص
  { id: 'wikicfp', name: 'WikiCFP', kind: 'conference', licence: 'خلاصة RSS عامة (محتوى يضيفه المنظمون)', urls: ['education', 'e-learning', 'artificial intelligence', 'educational technology'].map((c) => `http://www.wikicfp.com/cfp/rss?cat=${enc(c)}`), parse: parseWikiCfpList, delay: 3000 },
  { id: 'ccf', name: 'ccf-deadlines (GitHub)', kind: 'conference', licence: 'بيانات مفتوحة عامة', urls: ['AI/aaai', 'AI/ijcai', 'AI/acl', 'AI/emnlp', 'AI/naacl', 'HI/chi', 'HI/cscw', 'HI/iui', 'HI/uist', 'DB/www', 'AI/icml'].map((p) => `https://raw.githubusercontent.com/ccfddl/ccf-deadlines/main/conference/${p}.yml`), parse: parseCcf, perUrl: true, delay: 200 },
]

// ---------- التشغيل ----------

async function runSource(source) {
  const started = Date.now()
  const status = { id: source.id, name: source.name, kind: source.kind, licence: source.licence || 'خلاصة عامة', optional: !!source.optional, ok: false, fetched: 0, kept: 0, error: null, ms: 0, attemptedAt: new Date(NOW).toISOString() }
  const raw = []
  let okUrls = 0
  const errors = []
  for (const url of source.urls) {
    try {
      const body = source.json ? await getJson(url) : await getText(url)
      raw.push(...source.parse(body, source).map((r) => ({ ...r, source: r.source || source.name })))
      okUrls++
    } catch (error) { errors.push(String(error.message || error).slice(0, 100)) }
    if (source.delay) await sleep(source.delay)
  }
  status.ms = Date.now() - started
  status.fetched = raw.length
  if (!okUrls) status.error = errors[0] || 'تعذر الجلب'
  else { status.ok = true; if (errors.length) status.error = `نجح ${okUrls} من ${source.urls.length} طلبات (${errors[0]})` }
  return { status, raw }
}

function cleanAndFilter(raw, source, now) {
  const kept = []
  const year = new Date(now).getUTCFullYear()
  for (const r of raw) {
    const item = sanitizeItem({ ...r, fetched: new Date(now).toISOString() }, now)
    if (!item) continue
    if (source.kind === 'research') {
      // لا بحث قبل السنة الماضية، ولا نشر بلا تاريخ ولا سنة موثوقة.
      if (!item.published && !(item.year >= year - 1)) continue
      const when = approxDate(item)
      if (when && now - new Date(when) > RETENTION_DAYS['بحث'] * 86400000) continue
    } else if (source.kind === 'article') {
      if (!item.published || now - new Date(item.published) > RETENTION_DAYS[item.type] * 86400000) continue
    }
    kept.push(item)
  }
  return kept
}

async function enrichConferences(items, previous) {
  const known = new Map(previous.filter((p) => p.type === 'مؤتمر').map((p) => [p.id, p]))
  const out = []
  let detailFetches = 0
  for (const item of items) {
    if (item.source !== 'WikiCFP') { out.push(item); continue }
    const old = known.get(item.id)
    if (old && old.deadline !== undefined && old.detailChecked) { out.push({ ...item, ...pick(old, ['deadline', 'officialUrl', 'mode', 'location', 'description', 'detailChecked']), eventStart: item.eventStart || old.eventStart, eventEnd: item.eventEnd || old.eventEnd }); continue }
    if (detailFetches >= 15) { out.push(item); continue }
    detailFetches++
    try {
      const detail = parseWikiCfpDetail(await getText(item.url, { timeout: 20000, retries: 0 }))
      out.push({ ...item, deadline: detail.deadline, officialUrl: safeUrl(detail.officialUrl) || null, mode: detail.mode, location: detail.location || item.location, description: detail.description || item.description, detailChecked: true })
    } catch { out.push(item) }
    await sleep(2500)
  }
  return out
}
const pick = (o, keys) => Object.fromEntries(keys.filter((k) => k in o).map((k) => [k, o[k]]))

/** المؤتمرات: لا تبقى منتهية. موعد التقديم مجهول = تبقى بحالة «غير مؤكد» ولا تُعرض كفرصة. */
function conferenceKeep(item, now) {
  const today = isoDay(now)
  if (item.eventEnd && item.eventEnd < today) return false
  if (item.deadline && item.deadline < today && (!item.eventStart || item.eventStart < today)) return false
  if (!item.eventStart && !item.deadline) return false
  return true
}

async function main() {
  const sourceStatuses = []
  const all = []
  for (const source of SOURCES) {
    const { status, raw } = await runSource(source)
    let items = cleanAndFilter(raw, source, NOW)
    if (source.kind === 'conference') {
      items = items.filter((i) => scoreItem(i, DEFAULT_INTERESTS).relevant || source.id === 'ccf')
    }
    status.kept = items.length
    console.log(`${status.ok ? '✓' : '✗'} ${source.id.padEnd(12)} جُلب ${String(status.fetched).padStart(4)} · مقبول ${String(items.length).padStart(4)}${status.error ? ' · ' + status.error : ''}`)
    sourceStatuses.push(status)
    all.push(...items.map((i) => ({ ...i, _kind: source.kind })))
  }

  // الاحتفاظ بما جُلب سابقاً من مصادر فشلت الآن، وبقيّة التفاصيل المخزّنة.
  const previous = DRY ? { items: [], meta: null } : await readPrevious()
  const metaPrev = new Map((previous.meta?.sources || []).map((s) => [s.id, s]))
  for (const status of sourceStatuses) {
    const old = metaPrev.get(status.id)
    status.lastSuccess = status.ok ? status.attemptedAt : old?.lastSuccess || null
    if (!status.ok && old) status.lastGoodCount = old.kept
  }
  const failed = new Set(sourceStatuses.filter((s) => !s.ok).map((s) => s.id))
  const carried = previous.items.filter((i) => failed.has(i.sourceId) && !isExpired(i))

  let conferences = await enrichConferences(all.filter((i) => i.type === 'مؤتمر'), previous.items)
  conferences = conferences.filter((i) => conferenceKeep(i, NOW))
  const others = all.filter((i) => i.type !== 'مؤتمر')

  // البحث والمقالات: لا يُخزَّن إلا ما له إشارة صلة بالاهتمامات الافتراضية، أو من مصدر تعليمي متخصص بعتبة أخف.
  const topical = new Set(['eric', 'nature-edu', 'edsurge', 'ihe', 'hechinger', 'alt', 'guardian-edu'])
  const scored = others.map((i) => ({ i, s: scoreItem(i, DEFAULT_INTERESTS) })).filter(({ i, s }) => s.relevant || (topical.has(i.sourceId) && s.total >= 1))
  let merged = dedupe([...scored.sort((a, b) => b.s.total - a.s.total).map(({ i }) => i), ...conferences, ...carried.map((c) => ({ ...c }))])
  merged = merged.map(({ _kind, ...rest }) => rest)
  merged.sort((a, b) => (approxDate(b) || '').localeCompare(approxDate(a) || '') || String(b.fetched).localeCompare(String(a.fetched)))
  const confs = merged.filter((i) => i.type === 'مؤتمر')
  const nonConf = merged.filter((i) => i.type !== 'مؤتمر')
  const rest = [...nonConf.filter((i) => i.type === 'بحث').slice(0, 300), ...nonConf.filter((i) => i.type !== 'بحث').slice(0, 180)].slice(0, MAX_ITEMS - confs.length)
  const finalItems = [...rest, ...confs]
  await addArabicTitles(finalItems, previous.items)
  for (const s of sourceStatuses) s.kept = finalItems.filter((i) => i.sourceId === s.id).length

  const meta = {
    version: 1, updatedAt: new Date(NOW).toISOString(), total: finalItems.length, sources: sourceStatuses,
    categories: { research: finalItems.filter((i) => i.type === 'بحث').length, articles: finalItems.filter((i) => ['مقال', 'خبر'].includes(i.type)).length, conferences: confs.length, withDeadline: confs.filter((i) => i.deadline && deadlineStatus(i, NOW).code !== 'expired').length },
    note: 'المحتوى بيانات خارجية غير موثوقة؛ يُنظَّف ويُتحقق من الروابط والتواريخ قبل التخزين.',
  }
  console.log(JSON.stringify(meta.categories), 'المجموع', finalItems.length)
  if (DRY) { writeFileSync(process.env.MIHWAR_DRY_OUT || '/tmp/mihwar-feed-dry.json', JSON.stringify({ meta, items: finalItems }, null, 1)); return }
  if (!sourceStatuses.some((s) => s.ok)) throw new Error('فشلت كل المصادر؛ لا كتابة (تبقى البيانات السابقة).')
  await writeFirestore(meta, finalItems)
}

// ---------- ترجمة العناوين الإنجليزية (سطر عربي واحد، مجاناً بلا مفتاح) ----------

const TRANSLATE_PER_RUN = 160

export async function translateToArabic(title) {
  const url = 'https://api.mymemory.translated.net/get?langpair=en%7Car&q=' + encodeURIComponent(title.slice(0, 300))
  const data = JSON.parse(await getText(url, { timeout: 12000, retries: 0, max: 200_000 }))
  const out = String(data?.responseData?.translatedText || '').replace(/\s+/g, ' ').trim()
  // إجابات الحصة/الأخطاء تأتي كنص إنجليزي؛ لا نقبل إلا ما فيه حروف عربية فعلاً.
  if (Number(data?.responseStatus) !== 200 || /MYMEMORY|QUERY LENGTH|INVALID/i.test(out) || !/[؀-ۿ]/.test(out)) return ''
  return out.slice(0, 300)
}

export async function addArabicTitles(items, previousItems, translate = translateToArabic) {
  const prior = new Map(previousItems.filter((p) => p.titleAr).map((p) => [p.id, p.titleAr]))
  let budget = TRANSLATE_PER_RUN, done = 0
  for (const item of items) {
    if (item.language !== 'en') continue
    if (prior.has(item.id)) { item.titleAr = prior.get(item.id); continue }
    if (budget <= 0) continue
    budget--
    try {
      const ar = await translate(item.title)
      if (ar) { item.titleAr = ar; done++ } else if (done === 0 && budget < TRANSLATE_PER_RUN - 5) break // الخدمة رفضت الطلبات الأولى: نتوقف حتى الجلسة القادمة
    } catch (error) { console.warn('تعذرت الترجمة:', error.message); if (done === 0 && budget < TRANSLATE_PER_RUN - 5) break }
    await sleep(350)
  }
  console.log(`ترجمة العناوين: ${done} جديدة، ${prior.size} محفوظة.`)
}

function isExpired(item) {
  if (item.type === 'مؤتمر') return !conferenceKeep(item, NOW)
  const days = RETENTION_DAYS[item.type] || 60
  return item.published ? NOW - new Date(item.published) > days * 86400000 : false
}

// ---------- Firestore ----------

let _db
async function db() {
  if (_db) return _db
  const { initializeApp, cert } = await import('firebase-admin/app')
  const { getFirestore } = await import('firebase-admin/firestore')
  const saPath = process.env.FIREBASE_SERVICE_ACCOUNT || 'sa.json'
  if (!existsSync(saPath)) throw new Error('ملف حساب الخدمة مفقود')
  const app = initializeApp({ credential: cert(JSON.parse(readFileSync(saPath, 'utf8'))), projectId: process.env.FIREBASE_PROJECT_ID || 'drahmad-8e9e2' }, 'mihwar-feed')
  _db = getFirestore(app)
  return _db
}

async function readPrevious() {
  try {
    const firestore = await db()
    const meta = await firestore.doc('mihwar_feed/meta').get()
    const items = []
    for (let n = 0; n < Math.max(1, meta.data()?.chunks || 0); n++) {
      const snap = await firestore.doc(`mihwar_feed/items-${n}`).get()
      if (snap.exists) items.push(...JSON.parse(snap.data().payload || '[]'))
    }
    return { meta: meta.exists ? JSON.parse(meta.data().payload || 'null') : null, items }
  } catch (error) { console.warn('تعذرت قراءة الحالة السابقة:', error.message); return { meta: null, items: [] } }
}

async function writeFirestore(meta, items) {
  const firestore = await db()
  const chunks = []
  for (let i = 0; i < items.length; i += CHUNK) chunks.push(items.slice(i, i + CHUNK))
  for (const [n, chunk] of chunks.entries()) {
    const payload = JSON.stringify(chunk)
    if (payload.length > 900_000) throw new Error('الدفعة أكبر من حد Firestore')
    await firestore.doc(`mihwar_feed/items-${n}`).set({ payload, count: chunk.length, updatedAt: meta.updatedAt })
  }
  const old = await firestore.collection('mihwar_feed').listDocuments()
  for (const ref of old) if (/^items-(\d+)$/.test(ref.id) && Number(ref.id.split('-')[1]) >= chunks.length) await ref.delete()
  await firestore.doc('mihwar_feed/meta').set({ payload: JSON.stringify(meta), chunks: chunks.length, updatedAt: meta.updatedAt })
  console.log(`كُتب ${items.length} عنصراً في ${chunks.length} دفعات.`)
}

// ---------- اختبارات ذاتية ----------

function selfTest() {
  const assert = (cond, msg) => { if (!cond) { console.error('✗ ' + msg); process.exitCode = 1 } else console.log('✓ ' + msg) }
  const rss = `<?xml version="1.0"?><rss version="2.0"><channel><item><title>Generative AI in higher education: new study</title><link>https://example.org/a?utm_source=x</link><pubDate>Mon, 02 Nov 2026 10:00:00 GMT</pubDate><description>&lt;p&gt;Students and teachers&lt;/p&gt;</description></item><item><title>javascript:alert(1) item title long</title><link>javascript:alert(1)</link></item><item><title>Future dated story about education technology</title><link>https://example.org/f</link><pubDate>Mon, 02 Nov 2031 10:00:00 GMT</pubDate></item></channel></rss>`
  const src = { id: 't', name: 'اختبار', type: 'مقال', lang: 'en' }
  const parsed = parseRss(rss, src).map((r) => sanitizeItem(r, Date.parse('2026-11-05T00:00:00Z'))).filter(Boolean)
  assert(parsed.length === 2, 'يُسقَط رابط javascript:')
  assert(parsed[0].description === 'Students and teachers', 'تنظيف HTML من الوصف')
  assert(parsed[1].published === null, 'تاريخ مستقبلي بعيد يصبح غير موثوق')
  const atom = `<feed xmlns="http://www.w3.org/2005/Atom"><entry><title>Atom entry about gamification</title><link rel="alternate" href="https://example.org/atom"/><published>2026-11-01T00:00:00Z</published></entry></feed>`
  assert(parseRss(atom, src)[0].url === 'https://example.org/atom', 'Atom')
  let threw = false; try { parseRss('<html>Just a moment</html>', src) } catch { threw = true }
  assert(threw, 'صفحة حجب ليست خلاصة')
  const cfpList = `<rss version="2.0"><channel><item><title>X 2027 : Conf on Education</title><link>http://www.wikicfp.com/cfp/servlet/event.showcfp?eventid=1</link><description>Conf on Education [Oslo, Norway] [Dec 26, 2027 - Dec 28, 2027]</description></item></channel></rss>`
  const c = parseWikiCfpList(cfpList, { id: 'wikicfp' })[0]
  assert(c.url.startsWith('http://www.wikicfp.com') && c.location === 'Oslo, Norway' && c.eventStart === '2027-12-26' && c.eventEnd === '2027-12-28', 'WikiCFP: مكان وتواريخ')
  const detail = parseWikiCfpDetail(`<th>Submission Deadline</th><td><span content="2027-03-15T00:00:00">Mar 15, 2027</span></td> Link: <a href="https://conf.example.org/">x</a><th>Where</th><td align="center">Oslo, Norway</td>`)
  assert(detail.deadline === '2027-03-15' && detail.officialUrl === 'https://conf.example.org/', 'WikiCFP: موعد ورابط رسمي')
  const ccf = parseCcf(`- title: CHI\n  description: ACM CHI\n  sub: HI\n  confs:\n    - year: 2027\n      id: chi27\n      link: https://chi2027.acm.org/\n      timeline:\n        - abstract_deadline: '2026-09-04 23:59:59'\n          deadline: '2027-09-11 23:59:59'\n      timezone: AoE\n      date: April 28 - May 1, 2028\n      place: Yokohama, Japan\n`, { id: 'ccf', name: 'CHI' }, Date.parse('2026-11-05'))
  assert(ccf.length === 1 && ccf[0].deadline === '2027-09-12', 'ccf: توقيت AoE')
  const eric = parseEric({ response: { docs: [{ id: 'EJ1', title: 'Study of gamification', publicationdate: '2026-00-00', publicationdateyear: 2026, url: 'https://doi.org/10.1/x' }] } }, { id: 'eric' })[0]
  assert(eric.published === null && eric.year === 2026, 'ERIC: سنة بلا تاريخ كامل لا تُختلق')
  assert(deadlineStatus({ deadline: '2020-01-01' }).code === 'expired' && deadlineStatus({}).code === 'unknown', 'حالة الموعد')
  const dd = dedupe([sanitizeItem({ title: 'Generative AI in higher education: a long enough title here', url: 'https://a.org/x?utm_source=1', source: 'A' }), sanitizeItem({ title: 'Generative AI in higher education: a long enough title here', url: 'https://b.org/y', source: 'B' })])
  assert(dd.length === 1 && dd[0].alsoIn?.includes('B'), 'إزالة التكرار بالعنوان عبر المصادر')
  const titled = [{ id: 'a', language: 'en', title: 'New English title' }, { id: 'b', language: 'en', title: 'Old English title' }, { id: 'c', language: 'ar', title: 'عنوان عربي' }]
  const calls = []
  addArabicTitles(titled, [{ id: 'b', titleAr: 'عنوان قديم' }], async (t) => { calls.push(t); return 'عنوان جديد' }).then(() => {
    assert(titled[0].titleAr === 'عنوان جديد' && titled[1].titleAr === 'عنوان قديم' && !titled[2].titleAr && calls.length === 1, 'ترجمة العناوين: إعادة استخدام المحفوظ، وترجمة الجديد الإنجليزي فقط')
  })
}

const isMain = process.argv[1] && import.meta.url === new URL('file://' + process.argv[1]).href
if (!isMain) { /* مستورد كوحدة (اختبارات/تشخيص): لا يعمل شيء */ }
else if (SELF_TEST) selfTest()
else main().catch((error) => { console.error('فشل الجالب:', error.message); process.exit(1) })
