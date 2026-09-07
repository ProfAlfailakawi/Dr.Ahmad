import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const source = readFileSync(new URL('../public/monteur/monteur.js', import.meta.url), 'utf8')
const css = readFileSync(new URL('../public/monteur/monteur.css', import.meta.url), 'utf8')
assert.match(source, /DIRECTION_CUTS=.*cinema:.*symbolic:.*pulse:/s, 'three direction candidates are scored')
assert.match(source, /function impossibleWorldFor/, 'the climax receives a semantic impossible world')
assert.match(source, /wordBirth=true/, 'the strongest word becomes a moving symbol')
assert.match(source, /goldenSilence=true/, 'the climax owns one golden silence')
assert.match(source, /emotionalCamera/, 'camera motion follows the scene emotion')
assert.match(source, /class="hidden-kufic"/, 'the Kufic identity is hidden inside scenes')
assert.match(source, /class="loop-echo"/, 'the ending visually returns to the opening')
assert.match(source, /async function motionCover/, 'the package creates a living cover')
assert.match(source, /async function reviewExport/, 'the exported file is sampled after recording')
assert.match(source, /for\(var i=1;i<=5;i\+\+\)/, 'the critic samples five moments across the result')
assert.match(source, /quality.txt/, 'the publishing package includes the critic report')
assert.match(css, /\.impossible-world/, 'the impossible world has a production visual layer')
assert.match(css, /@keyframes loopReturn/, 'the loop ending has a continuous return motion')
console.log('✓ العالم غير المتوقع: مشهد مستحيل وصمت وولادة رمز وغلاف حي وناقد تصدير')
