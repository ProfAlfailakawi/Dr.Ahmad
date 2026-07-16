#!/usr/bin/env node
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const out = resolve(ROOT, 'src/data/citations.json')
const profileId = String(process.env.SCHOLAR_PROFILE_ID || 'WVAtInIAAAAJ').trim()
const profileUrl = `https://scholar.google.com/citations?user=${encodeURIComponent(profileId)}&hl=en`
const previous = existsSync(out)
  ? JSON.parse(readFileSync(out, 'utf8'))
  : { profileId, profileUrl, total: null, updatedAt: null, history: [] }

const failSoft = (message) => {
  console.warn(`⚠️ Google Scholar: ${message}. احتفظت بآخر لقطة موثوقة.`)
  process.exit(0)
}

let response
try {
  response = await fetch(profileUrl, {
    headers: {
      'user-agent': 'Mozilla/5.0 (compatible; DrAlfailakawiSite/1.0; +https://dr-alfailakawi.com)',
      accept: 'text/html,application/xhtml+xml',
      'accept-language': 'en-US,en;q=0.9',
    },
    signal: AbortSignal.timeout(12_000),
  })
} catch (error) {
  failSoft(error?.name === 'TimeoutError' ? 'انتهت مهلة الاتصال' : 'تعذّر الاتصال')
}
if (!response?.ok) failSoft(`أعاد المصدر الحالة ${response?.status || 'unknown'}`)
const html = await response.text()

const citationRows = [...html.matchAll(/<a[^>]+class="gsc_rsb_f[^>]*>([^<]+)<\/a><\/td><td[^>]*class="gsc_rsb_std"[^>]*>([\d,]+)<\/td><td[^>]*class="gsc_rsb_std"[^>]*>([\d,]+)<\/td>/g)]
const citationRow = citationRows.find((match) => /Citations/i.test(match[1]))
const total = Number(String(citationRow?.[2] || '').replace(/,/g, ''))
if (!Number.isFinite(total) || total < 0) failSoft('لم أجد رقم الاستشهادات في الصفحة')

const years = [...html.matchAll(/class="gsc_g_t"[^>]*>(\d{4})<\/span>/g)].map((match) => Number(match[1]))
const counts = [...html.matchAll(/class="gsc_g_al"[^>]*>([\d,]+)<\/span>/g)].map((match) => Number(match[1].replace(/,/g, '')))
const yearly = years.map((year, index) => ({ year, count: Number.isFinite(counts[index]) ? counts[index] : 0 }))
const day = new Date().toISOString().slice(0, 10)
const history = Array.isArray(previous.history) ? previous.history.filter((item) => item?.date !== day) : []
history.push({ date: day, total })

const next = {
  profileId,
  profileUrl,
  total,
  updatedAt: new Date().toISOString(),
  history: history.slice(-730),
  yearly,
}
writeFileSync(out, `${JSON.stringify(next, null, 2)}\n`, 'utf8')
console.log(`✔ Google Scholar: ${total.toLocaleString('en-US')} citations`)
