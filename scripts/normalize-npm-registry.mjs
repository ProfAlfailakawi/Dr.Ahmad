import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const lockPath = resolve(process.cwd(), 'package-lock.json')
const original = readFileSync(lockPath, 'utf8')
const normalized = original
  .replace(/https:\/\/packages\.applied-caas-gateway[^/]*\.internal\.api\.openai\.org\/artifactory\/api\/npm\/npm-public\//g, 'https://registry.npmjs.org/')
  .replace(/https:\/\/[^\s"']*internal\.api\.openai\.org\/[^\s"']*\/npm-public\//g, 'https://registry.npmjs.org/')

if (/applied-caas-gateway|internal\.api\.openai\.org/.test(normalized)) {
  throw new Error('package-lock.json still contains a private npm registry URL')
}
if (normalized !== original) writeFileSync(lockPath, normalized)
console.log('npm lock registry: public and verified')
