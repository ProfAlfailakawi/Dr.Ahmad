import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'

const source = readFileSync(new URL('../public/monteur/monteur.js', import.meta.url), 'utf8')
const tracks = [...source.matchAll(/url:"(\/music\/[a-z0-9-]+\.mp3)"/g)].map((match) => match[1])
assert.equal(tracks.length, 14, 'the monteur exposes the complete fourteen-track library')
assert.equal(new Set(tracks).size, tracks.length, 'music paths do not repeat')
for (const track of tracks) assert.ok(existsSync(new URL(`../${track.slice(1)}`, import.meta.url)), `missing ${track}`)
assert.match(source, /TRACK_POOLS=.*ai:/s, 'specialist themes have semantic music pools')
assert.match(source, /monteur:last-music:/, 'automatic selection remembers the previous article track')
assert.match(source, /packagePoster/, 'publishing package creates a vertical cover')
assert.match(source, /packageCaption/, 'publishing package creates concise posting copy')
assert.match(source, /navigator\.share/, 'publishing package uses the native share sheet when available')
assert.match(source, /MUSIC\[AU\.cur\].*vol|MUSIC\[AU\.cur\]\|\|\{\}\)\.vol/, 'track loudness is respected')
console.log('✓ مكتبة المونتير الموسيقية وحزمة النشر: 14 مقطوعة مترابطة وتصدير بثلاثة أصول')
