import fs from 'node:fs'
import path from 'node:path'
import { SITE_URL } from './config.mjs'

export function pickQuote(item) {
  const source = String(item?.body || item?.excerpt || '').replace(/\s+/g, ' ').trim()
  return source.split(/(?<=[.!؟])/u).map((part) => part.trim()).find((part) => part.length >= 25 && part.length <= 180) || source.slice(0, 180)
}

export function quoteCardPayload(item, quote = pickQuote(item)) {
  if (!item || !quote) return null
  return { quote, title: item.title, author: 'د. أحمد حسين الفيلكاوي', url: item.url || `${SITE_URL}/articles/${item.slug}`, siteUrl: SITE_URL, renderer: 'site-quote-card' }
}

export function saveQuoteCardPayload(dir, item, quote) {
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 })
  const payload = quoteCardPayload(item, quote); if (!payload) throw new Error('لا يوجد اقتباس صالح')
  const file = path.join(dir, `${item.slug}.json`)
  fs.writeFileSync(file, JSON.stringify(payload, null, 2), { mode: 0o600 })
  return { file, payload }
}
