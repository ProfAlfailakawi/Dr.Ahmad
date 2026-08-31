#!/usr/bin/env node
import { writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  PRODUCTION_CORPUS_CERTIFICATE_PATH,
  buildKuwaitiProductionCorpusCertificate,
  verifyKuwaitiProductionCorpusCertificate,
} from './lib/kuwaiti-production-corpus-certificate.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
if (process.argv.includes('--write')) {
  const { certificate } = buildKuwaitiProductionCorpusCertificate(ROOT)
  writeFileSync(resolve(ROOT, PRODUCTION_CORPUS_CERTIFICATE_PATH), `${JSON.stringify(certificate, null, 2)}\n`)
  console.log(`✓ اعتمدت شهادة متن الإنتاج: ${certificate.episodeCount} حلقة · ${certificate.corpusSha256}`)
} else {
  const { certificate } = verifyKuwaitiProductionCorpusCertificate(ROOT)
  console.log(`✓ شهادة متن الإنتاج مطابقة: ${certificate.episodeCount} حلقة · ${certificate.corpusSha256}`)
}
