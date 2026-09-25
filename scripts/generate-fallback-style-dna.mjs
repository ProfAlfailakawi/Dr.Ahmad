#!/usr/bin/env node
/**
 * يولّد FALLBACK_STYLE_DNA في src/lib/style-dna.mjs من قياس الأرشيف المؤرّخ نفسه
 * (measureStyleDna)، فلا تتخلّف البصمة الاحتياطية عن طريقة القياس. الاستعمال:
 *   node scripts/generate-fallback-style-dna.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
const S = await import(resolve(process.cwd(), 'src/lib/style-dna.mjs'))
const src = readFileSync('src/data.ts', 'utf8')
const isoBySlug = new Map([...src.matchAll(/slug:\s*'([^']+)'[^}]*?iso:\s*'([0-9-]+)'/g)].map((m) => [m[1], m[2]]))
const bodies = JSON.parse(readFileSync('src/data/bodies.json', 'utf8'))
const archive = Object.entries(bodies).filter(([, b]) => typeof b === 'string' && b.trim().length > 200).map(([slug, body]) => ({ body, iso: isoBySlug.get(slug) || '' }))
const d = S.measureStyleDna(archive)
const num = (v) => { const s = String(v); return s.startsWith('0.') ? s.slice(1) : s }
const obj = (o) => '{ ' + Object.entries(o).map(([k, v]) => `${k}: ${typeof v === 'number' ? num(v) : JSON.stringify(v)}`).join(', ') + ' }'
const lines = []
lines.push('export const FALLBACK_STYLE_DNA = {')
lines.push(`  version: ${d.version ?? 3},`)
lines.push(`  sampleSize: ${d.sampleSize},`)
lines.push(`  totalWords: ${d.totalWords},`)
for (const key of ['article', 'sentence', 'paragraph', 'marks']) lines.push(`  ${key}: ${obj(d[key])},`)
lines.push('  moves: {')
lines.push('    ' + Object.entries(d.moves).map(([k, v]) => `${k}: ${num(v)}`).join(', ') + ',')
lines.push('  },')
lines.push('  openers: [')
for (let i = 0; i < 9; i += 3) lines.push('    ' + d.openers.slice(i, i + 3).map((o) => `{ word: '${o.word}', count: ${o.count} }`).join(', ') + ',')
lines.push('  ],')
lines.push(`  closings: ${obj(d.closings)},`)
lines.push('  /* مفاصله بعد الفاصلة، مقيسةً على أرشيفه (measureHinges). */')
lines.push(`  hinges: [${d.hinges.map((h) => `'${h}'`).join(', ')}],`)
lines.push('  collectiveVerbs: COLLECTIVE_VERBS_FALLBACK,')
lines.push(`  era: ${obj(d.era)},`)
lines.push('  /* صوته اليوم: من آخر عشرين مقالاً مؤرّخاً (recentVoice). */')
lines.push(`  recent: { sample: ${d.recent.sample}, retired: [${d.recent.retired.map((w) => `'${w}'`).join(', ')}], semicolonShare: ${num(d.recent.semicolonShare)}, askYourselfShare: ${num(d.recent.askYourselfShare)}, perhapsBeginsShare: ${num(d.recent.perhapsBeginsShare)}, openers: [${d.recent.openers.map((w) => `'${w}'`).join(', ')}], paragraphsMedian: ${d.recent.paragraphsMedian}, paragraphsP75: ${d.recent.paragraphsP75}, paragraphWordsMedian: ${d.recent.paragraphWordsMedian}, openingShares: { ${Object.entries(d.recent.openingShares).map(([k, v]) => `${k}: ${num(v)}`).join(', ')} } },`)
lines.push('  /* مسطرة الحَكَم: توزيع كل مقياسٍ على مقالاته منفردة، **مرجَّحةً بالحقبة**')
lines.push('     (نصف عمرٍ ستة أشهر) فتكون بصمة أحمد ٢٠٢٦ لا أحمد ٢٠١٧. */')
lines.push('  perArticle: {')
for (const [k, band] of Object.entries(d.perArticle)) lines.push(`    ${k}: ${obj(band)},`)
lines.push('  },')
lines.push('  banned: BANNED_PHRASES,')
lines.push('  bannedVoice: BANNED_VOICE,')
lines.push('}')
const file = readFileSync('src/lib/style-dna.mjs', 'utf8')
const start = file.indexOf('export const FALLBACK_STYLE_DNA = {')
const end = file.indexOf('\n}\n', start) + 3
let out = file.slice(0, start) + lines.join('\n') + '\n' + file.slice(end)
out = out.replace('measureStyleDna على ١٤٣ مقالاً بتاريخ ١ أغسطس ٢٠٢٦. */', 'measureStyleDna على ١٤٣ مقالاً مؤرّخاً بتاريخ ٢٤ سبتمبر ٢٠٢٦ (يُعاد توليدها بـ\n   scripts/generate-fallback-style-dna.mjs كلما تغيّر القياس). */')
writeFileSync('src/lib/style-dna.mjs', out)
console.log(lines.length, 'lines')
