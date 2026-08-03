#!/usr/bin/env node
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(fileURLToPath(new URL('..', import.meta.url)))
const read = (file) => readFileSync(resolve(root, file), 'utf8')
const data = JSON.parse(read('src/data/encyclopedia-teaching-map.json'))
const portal = read('src/components/EncyclopediaPortal.tsx')
const helper = read('src/lib/encyclopedia-teaching-map.ts')
const expectedSlides = { 'door-1': 203, 'door-2': 197, 'door-3': 425, 'door-4': 115 }
const expectedFiles = {
  'door-1': 'public/files/encyclopedia/encyclopedia-door-1.pptx',
  'door-2': 'public/files/encyclopedia/encyclopedia-door-2.pptx',
  'door-3': 'public/files/encyclopedia/encyclopedia-door-3.pptx',
  'door-4': 'public/files/encyclopedia/encyclopedia-door-4.pptx',
}

assert.deepEqual(Object.keys(data).sort(), Object.keys(expectedSlides).sort())
let topicCount = 0
for (const [doorId, expectedSlideCount] of Object.entries(expectedSlides)) {
  const door = data[doorId]
  assert.equal(door.slideCount, expectedSlideCount, `${doorId} slide count must match the source deck`)
  assert.ok(existsSync(resolve(root, expectedFiles[doorId])), `${expectedFiles[doorId]} must exist`)
  const topics = Object.entries(door.topics || {})
  assert.equal(topics.length, 6, `${doorId} must expose six concise teaching topics`)
  topicCount += topics.length
  for (const [title, topic] of topics) {
    assert.ok(title.trim())
    assert.ok(topic.chapter?.trim())
    assert.ok(topic.objective?.trim())
    assert.ok(topic.discussion?.trim())
    assert.ok(Array.isArray(topic.videoHints) && topic.videoHints.length > 0)
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
assert.match(portal, /searchResults\.slides/)
assert.match(portal, /موضع الموضوع في العرض/)
assert.match(portal, /خيط المادة/)
assert.match(portal, /افتح الشرائح/)
assert.match(portal, /شاهد الشرح/)
assert.match(portal, /aria-label="ابحث في الموسوعة"/)
assert.match(portal, /name="Search"/)
assert.doesNotMatch(portal, />\s*ابحث\s*<\/a>/, 'the search entrance must be an icon only')
assert.doesNotMatch(portal, /bg-ink\/45|text-soft\/55/)

console.log('✓ خريطة الشرائح تطابق عروض الأبواب الأربعة وتغطي ٢٤ محوراً')
console.log('✓ كل محور يربط النص والشرح المرئي والشرائح الدقيقة من دون ازدحام')
console.log('✓ مدخل البحث في رأس الموسوعة أيقونة فقط وله تسمية وصول واضحة')
