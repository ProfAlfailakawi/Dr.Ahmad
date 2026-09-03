#!/usr/bin/env node
import assert from 'node:assert/strict'
import { existsSync, readFileSync, statSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(fileURLToPath(new URL('..', import.meta.url)))
const read = (file) => readFileSync(resolve(root, file), 'utf8')
const data = JSON.parse(read('src/data/encyclopedia-teaching-map.json'))
const structure = JSON.parse(read('src/data/encyclopedia-structure.json'))
const portal = read('src/components/EncyclopediaPortal.tsx')
const helper = read('src/lib/encyclopedia-teaching-map.ts')
const buildStatic = read('scripts/build-static.mjs')
const gitignore = read('.gitignore')
const expectedSlides = { 'door-1': 203, 'door-2': 197, 'door-3': 425, 'door-4': 115 }
const expectedFiles = {
  'door-1': 'files/encyclopedia/encyclopedia-door-1.pptx',
  'door-2': 'files/encyclopedia/encyclopedia-door-2.pptx',
  'door-3': 'files/encyclopedia/encyclopedia-door-3.pptx',
  'door-4': 'files/encyclopedia/encyclopedia-door-4.pptx',
}

assert.deepEqual(Object.keys(data).sort(), Object.keys(expectedSlides).sort())
assert.equal(structure.sourcePdf, '/files/encyclopedia.pdf')
assert.equal(structure.doors.length, 5, 'the book has five doors in the verified PDF table of contents')
assert.deepEqual(structure.doors.map((door) => door.units.length), [5, 5, 6, 5, 11])
assert.equal(structure.doors.filter((door) => door.presentation).length, 4, 'only four doors have teaching decks')
const pdfPath = resolve(root, 'files/encyclopedia.pdf')
assert.ok(existsSync(pdfPath), 'files/encyclopedia.pdf must remain available')
assert.ok(statSync(pdfPath).size > 1_000_000, 'the encyclopedia PDF must be the real source, not a placeholder')
assert.equal(readFileSync(pdfPath).subarray(0, 4).toString('ascii'), '%PDF', 'the encyclopedia source must be a valid PDF')
let topicCount = 0
for (const [doorId, expectedSlideCount] of Object.entries(expectedSlides)) {
  const door = data[doorId]
  assert.equal(door.slideCount, expectedSlideCount, `${doorId} slide count must match the source deck`)
  const deckPath = resolve(root, expectedFiles[doorId])
  assert.ok(existsSync(deckPath), `${expectedFiles[doorId]} must exist`)
  assert.ok(statSync(deckPath).size > 100_000, `${expectedFiles[doorId]} must be the real presentation, not an empty placeholder`)
  assert.equal(readFileSync(deckPath).subarray(0, 2).toString('ascii'), 'PK', `${expectedFiles[doorId]} must be a valid Office archive`)
  const topics = Object.entries(door.topics || {})
  assert.equal(topics.length, 6, `${doorId} must expose six concise teaching topics`)
  topicCount += topics.length
  for (const [title, topic] of topics) {
    assert.ok(title.trim())
    assert.ok(topic.chapter?.trim())
    assert.ok(topic.objective?.trim())
    assert.ok(topic.discussion?.trim())
    assert.ok(Array.isArray(topic.videoHints) && topic.videoHints.length > 0)
    assert.ok(Array.isArray(topic.chapterNumbers) && topic.chapterNumbers.length > 0)
    assert.ok(topic.chapterNumbers.every((value) => Number.isInteger(value) && value >= 1))
    assert.ok(Array.isArray(topic.ranges) && topic.ranges.length > 0)
    for (const range of topic.ranges) {
      assert.ok(Number.isInteger(range.from) && Number.isInteger(range.to))
      assert.ok(range.from >= 1 && range.to >= range.from)
      assert.ok(range.to <= expectedSlideCount, `${doorId}/${title} points outside the source deck`)
      assert.ok(range.label?.trim())
    }
  }
}
assert.equal(topicCount, 24)

assert.match(helper, /getEncyclopediaTeachingTopic/)
assert.match(helper, /encyclopediaSlideRangeLabel/)
assert.match(helper, /scoreEncyclopediaTeachingTopic/)
assert.match(portal, /knowledgeResults\.slides/)
assert.match(portal, /EncyclopediaKnowledgeResults/)
assert.match(portal, /موضع الموضوع في العرض/)
assert.match(portal, /خيط المادة/)
assert.match(portal, /aria-label="تحميل عرض الباب"/)
assert.match(portal, /شاهد الشرح/)
assert.match(portal, /aria-label="ابحث في الموسوعة"/)
assert.match(portal, /name="Search"/)
assert.doesNotMatch(portal, />\s*ابحث\s*<\/a>/, 'the search entrance must be an icon only')
assert.doesNotMatch(portal, /bg-ink\/45|text-soft\/55/)
assert.doesNotMatch(portal, /AUDIENCES|activeAudience|setActiveAudience/)
assert.match(portal, /book\.pdf/)
assert.match(portal, /عرض عيّنة الكتاب/)
assert.match(portal, /target="_blank"/)
assert.doesNotMatch(portal, /تحميل المقدمة والفهرس|downloadPdf/)
assert.match(portal, /PRESENTATION_DOORS/)
assert.match(portal, /DOORS\.map/)
assert.match(portal, /download=\{`موسوعة تكنولوجيا التعليم - الباب \$\{teachingMaterial\.door\.number\}\.pptx`\}/)
assert.doesNotMatch(gitignore, /^files(?:\/|$)/m, 'the tracked root files directory must not be ignored')
assert.match(buildStatic, /files\/encyclopedia/, 'the production build must copy encyclopedia presentations from the tracked root source')
assert.match(buildStatic, /\.pptx/, 'the production build must include PowerPoint presentations')

console.log('✓ خريطة الكتاب تتبع الأبواب الخمسة في PDF، بينما الشرائح تخص أربعة أبواب فقط')
console.log('✓ كل محور يربط النص والشرح المرئي والشرائح الدقيقة من دون ازدحام')
console.log('✓ مدخل البحث في رأس الموسوعة أيقونة فقط وله تسمية وصول واضحة')
