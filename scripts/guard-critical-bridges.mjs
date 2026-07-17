import { access, readFile, readdir } from 'node:fs/promises'
import { resolve } from 'node:path'

const root = process.cwd()
const requiredFiles = [
  'src/components/admin/ManualDialogueEditor.tsx',
  'scripts/fetch-manual-dialogues.mjs',
  'src/lib/social-templates.ts',
  'manual-dialogues/success-that-does-not-bring-joy-to-its-ownerarabic.json',
]

for (const file of requiredFiles) {
  await access(resolve(root, file)).catch(() => {
    throw new Error(`[guard-critical] missing protected file: ${file}`)
  })
}

async function textFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true })
  const files = []
  for (const entry of entries) {
    const full = resolve(directory, entry.name)
    if (entry.isDirectory()) files.push(...await textFiles(full))
    else if (/\.(?:ts|tsx|js|jsx|mjs|html)$/i.test(entry.name)) files.push(full)
  }
  return files
}

const manualEditor = await readFile(resolve(root, 'src/components/admin/ManualDialogueEditor.tsx'), 'utf8')
const fetchBridge = await readFile(resolve(root, 'scripts/fetch-manual-dialogues.mjs'), 'utf8')
const socialTemplates = await readFile(resolve(root, 'src/lib/social-templates.ts'), 'utf8')
const liveSource = (await Promise.all((await textFiles(resolve(root, 'src'))).map((file) => readFile(file, 'utf8')))).join('\n')

const assertions = [
  [manualEditor.includes('turnsFromScript') && manualEditor.includes('documentText(file)'), 'Word must be parsed locally in the browser'],
  [manualEditor.includes("doc(db, 'podcast_dialogues', slug)"), 'manual dialogue must save to podcast_dialogues'],
  [!liveSource.toLowerCase().includes('submitmanualdialogue'), 'legacy submitmanualdialogue endpoint must stay retired from all live src files'],
  [fetchBridge.includes('manual-dialogues') && fetchBridge.includes('podcast_dialogues'), 'nightly Firestore-to-repository bridge must remain active'],
  [socialTemplates.includes("type Composition = 'midad' | 'layl' | 'jarida' | 'sharit' | 'mishkat' | 'tawqee'"), 'six signed social compositions must remain present'],
]

for (const [pass, message] of assertions) {
  if (!pass) throw new Error(`[guard-critical] ${message}`)
}

console.log('[guard-critical] manual dialogue bridge and six social templates are protected')
