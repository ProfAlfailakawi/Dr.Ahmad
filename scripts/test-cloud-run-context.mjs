import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const dockerfile = readFileSync(resolve(root, 'Dockerfile'), 'utf8')
const cloudIgnore = readFileSync(resolve(root, '.gcloudignore'), 'utf8')
const copySources = dockerfile
  .split('\n')
  .map((line) => line.trim())
  .filter((line) => line.startsWith('COPY '))
  .flatMap((line) => {
    const tokens = line.slice(5).trim().split(/\s+/).filter((token) => token && !token.startsWith('--'))
    return tokens.slice(0, -1)
  })
const copiedSources = new Set(copySources)

for (const source of copySources) {
  assert.equal(existsSync(resolve(root, source)), true, `Docker COPY source is missing: ${source}`)
  assert.match(cloudIgnore, new RegExp(`^!${source.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'm'), `Cloud Build upload excludes Docker COPY source: ${source}`)
}

const visited = new Set()
function walk(sourceFile) {
  if (visited.has(sourceFile)) return
  visited.add(sourceFile)
  assert.equal(existsSync(sourceFile), true, `server import is missing locally: ${relative(root, sourceFile)}`)
  if (!/\.(?:mjs|js)$/.test(sourceFile)) return
  const content = readFileSync(sourceFile, 'utf8')
  for (const match of content.matchAll(/from\s+['"](\.[^'"]+)['"]/g)) walk(resolve(dirname(sourceFile), match[1]))
  for (const match of content.matchAll(/new URL\(['"](\.[^'"]+)['"],\s*import\.meta\.url\)/g)) walk(resolve(dirname(sourceFile), match[1]))
}
walk(resolve(root, 'server.mjs'))

for (const sourceFile of visited) {
  const repoPath = relative(root, sourceFile)
  assert.equal(copiedSources.has(repoPath), true, `server import is not copied into the Cloud Run image: ${repoPath}`)
}

console.log(`✓ Cloud Run context: ${copySources.length} Docker sources uploaded, ${visited.size} server imports/resources copied`)
