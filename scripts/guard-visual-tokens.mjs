import fs from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve('src')
const EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.css'])
const semanticTokens = new Set(['canvas', 'ink', 'soft', 'accent', 'accent-deep', 'wash', 'hair'])
const generatedOpacityScale = new Set([0, 5, 10, 20, 25, 30, 40, 50, 60, 70, 75, 80, 90, 95, 100])
const invalid = []

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name)
    if (entry.isDirectory()) walk(file)
    else if (EXTENSIONS.has(path.extname(entry.name))) inspect(file)
  }
}

function inspect(file) {
  const text = fs.readFileSync(file, 'utf8')
  const lines = text.split(/\r?\n/)
  lines.forEach((line, index) => {
    if (line.includes('rgb(var(--c-hair')) {
      invalid.push(`${path.relative(process.cwd(), file)}:${index + 1}  rgb(var(--c-hair…) — --c-hair يحمل قيمة rgba كاملة؛ استخدم var(--c-hair) مباشرة.`)
    }
    for (const match of line.matchAll(/\b(?:bg|text|border|ring)-(canvas|ink|soft|accent|accent-deep|wash|hair)\/(\d+)\b/g)) {
      const [, token, rawOpacity] = match
      if (!semanticTokens.has(token)) continue
      const opacity = Number(rawOpacity)
      const reason = token === 'hair'
        ? 'توكن hair يحمل شفافيته داخل المتغير؛ لا تستخدم معه /opacity.'
        : !generatedOpacityScale.has(opacity)
          ? 'القيمة غير مولّدة في سلم Tailwind؛ استخدم الصيغة الاعتباطية مثل /[.92].'
          : ''
      if (reason) invalid.push(`${path.relative(process.cwd(), file)}:${index + 1}  ${match[0]} — ${reason}`)
    }
  })
}

walk(ROOT)
if (invalid.length) {
  console.error('فشل حارس التوكنات البصرية:\n' + invalid.map((item) => `- ${item}`).join('\n'))
  process.exit(1)
}
console.log('✓ التوكنات البصرية سليمة')
