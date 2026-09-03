import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { NATIVE_SPOKEN_VERSION, optimizeNativeSpokenEpisode } from './kuwaiti-native-spoken.mjs'

const DEFAULT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
export const PRODUCTION_CORPUS_CERTIFICATE_PATH = 'scripts/data/kuwaiti-production-corpus-certificate-v1.json'
export const PRODUCTION_CORPUS_CERTIFICATE_VERSION = '2026-08-31-kuwaiti-production-corpus-v1'

export const sha256 = (value) => createHash('sha256').update(value).digest('hex')
export const serializeSpokenTurns = (turns) => `${JSON.stringify(turns, null, 2)}\n`
export const spokenTurnsSha256 = (turns) => sha256(serializeSpokenTurns(turns))

const readJson = (root, path) => JSON.parse(readFileSync(resolve(root, path), 'utf8'))

export function buildKuwaitiProductionCorpusCertificate(root = DEFAULT_ROOT) {
  const v3 = readJson(root, 'src/data/kuwaiti-diwania-v3.json')
  const site = new Set(Object.keys(readJson(root, 'src/data/bodies.json')))
  const slugs = Object.keys(v3.episodes || {}).filter((slug) => site.has(slug)).sort()
  assert.equal(slugs.length, 143, `شهادة المتن تتطلب 143 مقالا؛ الموجود ${slugs.length}`)

  const episodes = {}
  const corpus = new Map()
  for (const slug of slugs) {
    const sourceTurns = Object.values(v3.episodes[slug] || {})
    const prepared = optimizeNativeSpokenEpisode(sourceTurns, { slug })
    assert.equal(prepared.audit.hard.length, 0,
      `${slug}: لا يمكن اعتماد متن فيه صياغة مانعة: ${prepared.audit.hard.map((item) => item.label).join('، ')}`)
    assert.equal(prepared.turns.filter((turn) => turn.musicBridgeAfter).length, 2,
      `${slug}: شهادة المتن تتطلب جسرين تحريريين`)
    const sourceSerialized = serializeSpokenTurns(sourceTurns)
    const spokenSerialized = serializeSpokenTurns(prepared.turns)
    episodes[slug] = {
      sourceSha256: sha256(sourceSerialized),
      spokenSha256: sha256(spokenSerialized),
      turnCount: prepared.turns.length,
      bridgeCount: prepared.turns.filter((turn) => turn.musicBridgeAfter).length,
      rewriteCount: prepared.changes.length,
    }
    corpus.set(slug, prepared.turns)
  }

  const corpusSha256 = sha256(JSON.stringify(Object.entries(episodes)))
  return {
    certificate: {
      schemaVersion: 1,
      certificateVersion: PRODUCTION_CORPUS_CERTIFICATE_VERSION,
      nativeSpokenVersion: NATIVE_SPOKEN_VERSION,
      episodeCount: slugs.length,
      corpusSha256,
      episodes,
    },
    corpus,
  }
}

export function verifyKuwaitiProductionCorpusCertificate(root = DEFAULT_ROOT) {
  const expected = readJson(root, PRODUCTION_CORPUS_CERTIFICATE_PATH)
  const built = buildKuwaitiProductionCorpusCertificate(root)
  assert.deepEqual(built.certificate, expected,
    'شهادة متن الـ143 لا تطابق المصدر والصقل الحاليين؛ أوقف TTS وراجع التغيير ثم جدد الشهادة صراحة')
  return built
}
