import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8')

const home = read('src/pages/Home.tsx')
const article = read('src/pages/ArticleDetail.tsx')
const extras = read('src/components/extras.tsx')
const audio = read('src/components/AudioPlayer.tsx')
const dock = read('src/lib/persistent-audio.tsx')
const cv = read('src/components/CvDownloadCards.tsx')
const thought = read('src/pages/ThoughtOverview.tsx')
const css = read('src/index.css')

assert.match(home, /aria-label="منصات الدكتور"/)
assert.match(home, /aria-label="أدوات الموقع"/)
assert.match(home, /grid justify-items-center gap-3\.5/)

assert.match(article, />شارك المقال<\/p>/)
assert.match(article, /flex flex-nowrap items-center gap-2\.5 overflow-x-auto/)
assert.match(extras, /compact \? 'flex shrink-0 flex-nowrap items-center gap-2\.5'/)
assert.doesNotMatch(extras, /\{compact && <span[^>]*>شارك المقال/)

assert.match(cv, />السير الذاتية<\/p>/)
assert.match(cv, />نسخ مخصصة لكل سياق\.<\/h2>/)
assert.match(cv, />أكاديمية · تدريبية · إعلامية<\/span>/)
assert.doesNotMatch(cv, /ثلاثة أبواب، وسجل واحد/)

assert.doesNotMatch(thought, /ThoughtHub/)

assert.match(audio, /ARTICLE_VOICE_PREFERENCE_KEY/)
assert.ok(extras.indexOf("voices.fahed ?") < extras.indexOf("voices.noura ?"), 'فهد يجب أن يسبق نورة في ترتيب القراءة')
assert.match(audio, /sources\.find\(\(item\) => item\.avatar === 'man'\)/)
assert.doesNotMatch(audio, />◀ العبارة<|>العبارة ▶</)
assert.match(audio, /aria-label="السابق"[^>]*>◀<\/button>/)
assert.match(audio, /aria-label="التالي"[^>]*>▶<\/button>/)

assert.match(dock, /canJumpArticleSentence/)
assert.match(dock, /article-audio-jump-sentence/)
assert.match(dock, /aria-label="السابق"[^>]*>◀<\/button>/)
assert.match(dock, /aria-label="التالي"[^>]*>▶<\/button>/)

assert.match(css, /\.inbox-page \.archive-dialogue-rail[\s\S]*touch-action: pan-x pan-y !important;/)
assert.match(css, /overscroll-behavior-y: auto !important;/)

console.log('✓ final polish 2026: all requested last-round checks passed')
