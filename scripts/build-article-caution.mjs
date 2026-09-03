#!/usr/bin/env node
/* حرارة السماء تُقاس وقت البناء من المتن الكامل، ثم تصل إلى /atlas كخريطة
   أرقام صغيرة. بهذا لا نحمّل bodies.json كي نلوّن النجوم، ولا نكرر قاموس
   الوعد والتحفّظ خارج مصدره الوحيد في idea-evolution.ts. */
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { articles } from '../src/data.ts'
import { articleCaution } from '../src/lib/idea-evolution.ts'
import { mergeCanonicalArticleBodies, mergeCanonicalRecords, readCanonicalCms } from './canonical-cms.mjs'

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)))
const canonical = readCanonicalCms(ROOT)
const bodies = mergeCanonicalArticleBodies(JSON.parse(readFileSync(resolve(ROOT, 'src/data/bodies.json'), 'utf8')), {}, canonical).normal
const liveArticles = mergeCanonicalRecords('article', articles, canonical)
const scores = {}

for (const article of liveArticles) {
  const score = articleCaution(`${article.title} ${article.excerpt || ''} ${bodies[article.slug] || ''}`)
  if (score !== null) scores[article.slug] = score
}

const output = { version: 1, scores }
writeFileSync(resolve(ROOT, 'src/data/article-caution.json'), `${JSON.stringify(output)}\n`)
console.log(`✔ حرارة المقالات: ${Object.keys(scores).length} من ${liveArticles.length}`)
