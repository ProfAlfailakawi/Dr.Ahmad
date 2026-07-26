import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import { READING_VOICES, sourceHash } from './lib/arabic-audio-engine.mjs'
import { readingNeedsGeneration } from './lib/human-reading-pipeline.mjs'

const root = mkdtempSync(resolve(tmpdir(), 'audio-idempotency-'))
try {
  const output = resolve(root, 'article.mp3')
  const auditFile = resolve(root, 'article.fahed.json')
  const article = {
    slug: 'article',
    title: 'عنوان ثابت',
    body: 'هذا نص المقال الذي لم يتغير.',
    bodyVocalized: 'هَذا نَصُّ المَقالِ الَّذي لَمْ يَتَغَيَّرْ.',
  }
  writeFileSync(output, Buffer.alloc(6_000, 1))
  writeFileSync(auditFile, JSON.stringify({
    status: 'accepted',
    sourceHash: sourceHash({
      title: article.title,
      text: `${article.body}\0${article.bodyVocalized}`,
      voice: READING_VOICES.fahed.azure,
    }),
    // تغيير نسخة المحرك وحده لا يشتري الملف نفسه مرة أخرى.
    pipelineHash: createHash('sha256').update('old-pipeline').digest('hex'),
  }))

  assert.deepEqual(
    readingNeedsGeneration({ article, voiceKey: 'fahed', output, auditFile }),
    { needed: false, reason: 'content_hash_match' },
  )
  assert.equal(
    readingNeedsGeneration({ article: { ...article, body: `${article.body} إضافة.` }, voiceKey: 'fahed', output, auditFile }).reason,
    'source_changed',
  )

  console.log('Audio idempotency self-test passed: unchanged accepted audio survives pipeline updates.')
} finally {
  rmSync(root, { recursive: true, force: true })
}
