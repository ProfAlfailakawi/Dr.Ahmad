import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

/* Google allows 50k URLs per sitemap. We stay below the hard edge so future
   metadata additions never turn a valid deployment into an oversized file. */
export const SITEMAP_URL_CHUNK = 45_000

const xml = (value = '') => String(value)
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&apos;')

function urlset(entries) {
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries.map((entry) => `  <url><loc>${xml(entry.loc)}</loc>${entry.lastmod ? `<lastmod>${xml(entry.lastmod)}</lastmod>` : ''}${entry.priority ? `<priority>${xml(entry.priority)}</priority>` : ''}</url>`).join('\n')}\n</urlset>\n`
}

export function buildSitemapDocuments(entries, site, chunkSize = SITEMAP_URL_CHUNK) {
  const safe = Math.max(1, Math.min(49_000, Math.floor(Number(chunkSize) || SITEMAP_URL_CHUNK)))
  if (entries.length <= safe) return new Map([['sitemap.xml', urlset(entries)]])
  const documents = new Map()
  const childNames = []
  for (let offset = 0, part = 1; offset < entries.length; offset += safe, part += 1) {
    const name = `sitemap-${String(part).padStart(3, '0')}.xml`
    childNames.push(name)
    documents.set(name, urlset(entries.slice(offset, offset + safe)))
  }
  documents.set('sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${childNames.map((name) => `  <sitemap><loc>${xml(`${site}/${name}`)}</loc></sitemap>`).join('\n')}\n</sitemapindex>\n`)
  return documents
}

export function sitemapLocsFromDist(dist, mainFile = 'sitemap.xml') {
  const mainPath = resolve(dist, mainFile)
  if (!existsSync(mainPath)) return []
  const main = readFileSync(mainPath, 'utf8')
  if (!/<sitemapindex\b/i.test(main)) return [...main.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1].trim())
  const output = []
  for (const match of main.matchAll(/<loc>([^<]+)<\/loc>/g)) {
    const name = String(match[1]).split('/').pop()
    if (!name || !/^sitemap-\d+\.xml$/.test(name)) continue
    const child = resolve(dist, name)
    if (!existsSync(child)) continue
    const body = readFileSync(child, 'utf8')
    output.push(...[...body.matchAll(/<loc>([^<]+)<\/loc>/g)].map((row) => row[1].trim()))
  }
  return output
}
