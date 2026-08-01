import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const root = resolve(new URL('..', import.meta.url).pathname)
const read = (path) => readFileSync(resolve(root, path), 'utf8')
const data = read('src/data.ts')
const book = read('src/pages/BookDetail.tsx')
const media = read('src/pages/MediaDetail.tsx')
const mediaIndex = read('src/pages/Media.tsx')
const staticBuilder = read('scripts/build-static.mjs')
const manager = read('src/components/admin/ContentManager.tsx')
const transcripts = JSON.parse(read('src/data/media-transcripts.json'))

assert.equal((data.match(/publisher: 'المؤلفون'/g) || []).length, 9, 'all nine books must credit the authors as publisher')
for (const slug of ['encyclopedia', 'teaching', 'mega-data', 'handy-tech', 'smart-school', 'virtual-world', 'kids-tech', 'gamification', 'digital-education']) {
  assert.match(data, new RegExp(`toc: bookTocs(?:\\.${slug.replace('-', '\\-')}|\\['${slug}'\\])`), `${slug} must use its PDF-derived contents`)
}
assert.doesNotMatch(book, /300[–-]600 كلمة/, 'the public book page must not show a word-count brief')
assert.doesNotMatch(manager, /الوصف الموسّع \(300[–-]600 كلمة\)/, 'the admin label must not impose the retired public brief')
assert.doesNotMatch(book, /من النسخة المعتمدة/, 'the retired contents eyebrow must be removed')
assert.match(book, /<details className="group mx-auto mt-14[\s\S]*?عن الكتاب/, 'About the book must be a calm collapsed disclosure')

assert.match(media, /اللقاء الكامل/, 'the full interview must be embedded inside the site')
assert.doesNotMatch(media, /مقتطف مركز|ثانية من اللقاء|مشاهدة الفيديو الكامل/, 'excerpt and outbound full-video controls must be removed')
assert.doesNotMatch(media, /[?&](?:start|end)=/, 'the embedded player must not be clipped')
assert.doesNotMatch(media, /النص التلقائي لا يُنشر/, 'the old transcript placeholder must be removed')
assert.match(media, /youtubeTranscript && <FadeUp/, 'the transcript surface must appear only when YouTube supplies text')
assert.match(media, /import\('\.\.\/data\/media-transcripts\.json'\)/, 'YouTube transcripts must load lazily on media detail pages')
assert.doesNotMatch(data, /import mediaTranscripts/, 'transcripts must not inflate the shared site data bundle')
assert.match(mediaIndex, /لقاءاتي الإذاعية والتلفزيونية كاملة داخل الموقع/, 'the media index must describe full in-site playback')
assert.doesNotMatch(staticBuilder, /مشاهدة الفيديو الكامل|النص التلقائي لا يُنشر/, 'static media HTML must not restore retired outbound or placeholder controls')
assert.match(staticBuilder, /youtube-nocookie\.com\/embed/, 'static media HTML must preserve in-site playback before hydration')
assert.match(staticBuilder, /media-transcripts\.json/, 'static media HTML must use the locally captured YouTube transcript when available')

for (const id of ['MdMDpX9jwTU', 'UsO9ju--z2M', 'x_nNolE8DuM', 'cOlGZibqDiw']) {
  assert.ok((transcripts[id] || '').split(/\s+/).length > 500, `${id} must contain the available YouTube Arabic transcript`)
}

console.log('Book metadata, PDF contents, and in-site media regression guard: passed')
