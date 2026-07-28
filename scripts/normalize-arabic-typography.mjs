#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'

const file = path.resolve('src/data/bodies.json')
const write = process.argv.includes('--write')
const data = JSON.parse(fs.readFileSync(file, 'utf8'))

function normalize(input = '') {
  return String(input)
    .normalize('NFC')
    .replace(/\u064B\u0627/g, '\u0627\u064B')
    .replace(/([\u0621-\u064A\u0671-\u06D3])[ \t]+([\u064B-\u064D])/g, '$1$2')
    .replace(/([\u064B-\u064D])\1+/g, '$1')
    .replace(/\.\.\.+/g, '…')
    .replace(/\.\./g, '…')
    .replace(/[“”](.*?)[“”]/g, '«$1»')
    .replace(/(^|[\s(])"([^"\n]{2,})"(?=$|[\s،؛؟!.)])/g, '$1«$2»')
    .replace(/[ \t]+([،؛؟!])/g, '$1')
    .replace(/([،؛؟!])(?=[^\s\n»])/g, '$1 ')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

if (process.argv.includes('--self-test')) {
  const samples = [
    ['مشروع\u064B\u0627', 'مشروعاً'],
    ['ممدوح \u064C', 'ممدوحٌ'],
    ['كتاب \u064D', 'كتابٍ'],
  ]
  for (const [before, after] of samples) {
    if (normalize(before) !== after) throw new Error(`typography self-test failed: ${before}`)
  }
  console.log('✓ Arabic typography normalizer: all three tanween forms')
  process.exit(0)
}

let changed = 0
for (const [slug, body] of Object.entries(data)) {
  const next = normalize(String(body))
  if (next !== body) {
    changed += 1
    if (write) data[slug] = next
  }
}
if (write && changed) fs.writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`)
console.log(`[typography] ${changed} article bodies ${write ? 'normalized' : 'would be normalized'}.`)
