import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { readCanonicalCms } from './canonical-cms.mjs'
import { refreshLiveCanonicalCms } from '../whatsapp-agent/live-cms.mjs'

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'dr-ahmad-live-cms-'))
const originalFetch = globalThis.fetch
const collectionSlug = {
  content_overrides: 'article:base',
  site_articles: 'live-article',
  site_books: 'live-book',
  site_papers: 'live-paper',
  site_media: 'live-media',
}

function stringValue(value) { return { stringValue: value } }
function fieldsFor(collection) {
  const slug = collectionSlug[collection]
  if (collection === 'content_overrides') return { patch: { mapValue: { fields: { title: stringValue('عنوان حي') } } } }
  const base = { slug: stringValue(slug), title: stringValue(`عنوان ${collection}`) }
  if (collection === 'site_articles') Object.assign(base, { status: stringValue('published'), body: stringValue('متن حي جديد') })
  return base
}

globalThis.fetch = async (input) => {
  const url = new URL(String(input))
  const collection = decodeURIComponent(url.pathname.split('/').pop() || '')
  if (!collectionSlug[collection]) return { ok: false, status: 404, json: async () => ({}) }
  return {
    ok: true,
    status: 200,
    json: async () => ({
      documents: [{
        name: `projects/test/databases/(default)/documents/${collection}/${encodeURIComponent(collectionSlug[collection])}`,
        fields: fieldsFor(collection),
      }],
    }),
  }
}

try {
  const first = await refreshLiveCanonicalCms(root, { force: true })
  assert.equal(first.changed, true)
  const snapshot = readCanonicalCms(root)
  assert.equal(snapshot.source, 'firestore-rest-live')
  assert.equal(snapshot.articles[0].slug, 'live-article')
  assert.equal(snapshot.articles[0].body, 'متن حي جديد')
  assert.equal(snapshot.books[0].slug, 'live-book')
  assert.equal(snapshot.papers[0].slug, 'live-paper')
  assert.equal(snapshot.media[0].slug, 'live-media')
  assert.equal(snapshot.overrides[0].id, 'article:base')

  const before = fs.readFileSync(path.join(root, '.cache', 'canonical-cms.json'), 'utf8')
  const second = await refreshLiveCanonicalCms(root, { force: true })
  assert.equal(second.changed, false, 'same Firestore payload must not trigger a needless reindex')
  const after = fs.readFileSync(path.join(root, '.cache', 'canonical-cms.json'), 'utf8')
  assert.equal(after, before, 'unchanged payload must preserve the last verified snapshot byte-for-byte')

  console.log('Live CMS refresh: 10/10 checks passed.')
} finally {
  globalThis.fetch = originalFetch
  fs.rmSync(root, { recursive: true, force: true })
}
