import fs from 'node:fs'
import path from 'node:path'

const file = path.resolve('src/data/bodies.json')
const write = process.argv.includes('--write')
const data = JSON.parse(fs.readFileSync(file, 'utf8'))

function normalize(input = '') {
  return input
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
