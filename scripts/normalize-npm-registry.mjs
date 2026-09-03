import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { resolve, join, relative } from 'node:path'

const ROOT = process.cwd()
const CHECK_ONLY = process.argv.includes('--check')
const SKIP = new Set(['node_modules', '.git', 'dist', '.firebase', '.audio-human-work'])
const locks = []

function walk(dir) {
  for (const name of readdirSync(dir)) {
    if (SKIP.has(name)) continue
    const file = join(dir, name)
    const stat = statSync(file)
    if (stat.isDirectory()) walk(file)
    else if (name === 'package-lock.json') locks.push(file)
  }
}

walk(ROOT)
if (!locks.length) throw new Error('No package-lock.json files were found')

const privateRegistry = /https:\/\/(?:packages\.applied-caas-gateway[^/]*\.internal\.api\.openai\.org|[^\s"']*internal\.api\.openai\.org)\/[^\s"']*?npm-public\//g
let changed = 0
for (const lockPath of locks) {
  const original = readFileSync(lockPath, 'utf8')
  const normalized = original.replace(privateRegistry, 'https://registry.npmjs.org/')
  if (/applied-caas-gateway|internal\.api\.openai\.org/.test(normalized)) {
    throw new Error(`${relative(ROOT, lockPath)} still contains a private npm registry URL`)
  }
  if (normalized !== original) {
    changed += 1
    if (!CHECK_ONLY) writeFileSync(lockPath, normalized)
  }
}
if (CHECK_ONLY && changed) throw new Error(`${changed} lockfile(s) require public-registry normalization`)
console.log(`npm lock registry: ${locks.length} public lockfile(s) verified${changed && !CHECK_ONLY ? `; ${changed} repaired` : ''}`)
