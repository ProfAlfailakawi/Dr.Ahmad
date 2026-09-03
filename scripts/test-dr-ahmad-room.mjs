import assert from 'node:assert/strict'
import { buildDrAhmadDecisionPackage, classifyDrAhmadCommand } from '../src/lib/dr-ahmad-room.ts'

const article = (slug, title, excerpt, body) => ({ slug, title, excerpt, body, cat: 'التعليم', iso: '2026-01-01', date: '2026', hasAudio: false, words: body.split(/\s+/).length, year: '2026', missing: false, _cms: { kind: 'article', origin: 'base', modified: false, hidden: false, deleted: false, docId: slug, baseSlug: slug } })
const archive = {
  articles: [article('ai-teacher', 'الذكاء الاصطناعي والمعلم', 'المعلم لا يصبح أقل أهمية حين تظهر أداة جديدة.', 'الذكاء الاصطناعي يساعد في الاقتراح، لكن المعلم مسؤول عن السياق وعن بناء معنى التعلم لدى الطالب.'), article('future-teacher', 'مستقبل المعلم', 'المعلم يبني السؤال لا ينقل الإجابة فقط.', 'حين تتغير الأدوات يبقى دور المعلم في بناء الوعي والحكم الإنساني.')],
  books: [{ slug: 'digital-learning', title: 'التعلم الرقمي', desc: 'التعليم الرقمي والمعلم والطالب', isbn: '', cover: '', pdf: '', _cms: { kind: 'book', origin: 'base', modified: false, hidden: false, deleted: false, docId: 'digital-learning', baseSlug: 'digital-learning' } }],
  papers: [{ slug: 'ai-study', title: 'دراسة التعلم الإلكتروني', meta: 'دراسة محكمة عن استخدام التقنية', abstractAr: 'أثر التقنية في تعلم الطالب', _cms: { kind: 'paper', origin: 'base', modified: false, hidden: false, deleted: false, docId: 'ai-study', baseSlug: 'ai-study' } }],
  media: [{ slug: 'tv-ai', title: 'لقاء عن تكنولوجيا التعليم', outlet: 'تلفزيون الكويت', url: 'https://youtube.com/watch?v=test', topics: 'الذكاء الاصطناعي والتعليم', _cms: { kind: 'media', origin: 'base', modified: false, hidden: false, deleted: false, docId: 'tv-ai', baseSlug: 'tv-ai' } }],
}

assert.equal(classifyDrAhmadCommand('لدي لقاء تلفزيوني عن الذكاء الاصطناعي اليوم').needsCurrentContext, true)
assert.equal(classifyDrAhmadCommand('حضّر لي محاضرة عن مستقبل المعلم').type, 'lecture')
assert.equal(classifyDrAhmadCommand('حوّل هذا المقال إلى منشورات وفيديو Flow').type, 'compound')

const compound = buildDrAhmadDecisionPackage({ command: 'حوّل هذا المقال إلى منشورات وفيديو Flow', archive })
assert.equal(compound.material.some((item) => item.label === 'تغريدة'), true)
assert.equal(compound.material.some((item) => item.label.includes('ومضة Flow')), true)

const result = buildDrAhmadDecisionPackage({
  command: 'لدي لقاء تلفزيوني عن الذكاء الاصطناعي في التعليم اليوم',
  archive,
  current: [{ id: 'event-1', title: 'تقرير حديث', source: 'مصدر موثوق', url: 'https://example.com/report', publishedAt: '2026-08-01T00:00:00Z' }],
  audienceSignals: ['الذكاء الاصطناعي: سؤال متكرر'],
  readerSignals: ['مستقبل المعلم: 8 قراءات حديثة'],
})

assert.equal(result.material.some((item) => item.label.includes('20 ثانية')), true)
assert.equal(result.material.some((item) => item.label.includes('45 ثانية')), true)
assert.equal(result.archive.some((item) => item.kind === 'مقال'), true)
assert.equal(result.archive.some((item) => item.kind === 'كتاب'), true)
assert.equal(result.archive.some((item) => item.kind === 'بحث'), true)
assert.equal(result.archive.some((item) => item.kind === 'إعلام'), true)
assert.equal(result.current.available, true)
assert.match(result.current.note, /خارجية/)
assert.ok(result.strongestObjection.objection && result.strongestObjection.response)
assert.equal(result.nextActions.some((item) => item.id === 'flow_video'), true)
assert.equal(result.diagnostics.audienceSignals.length, 1)

const fallback = buildDrAhmadDecisionPackage({ command: 'ما أهم قراري اليوم؟', archive, currentError: 'network unavailable' })
assert.equal(fallback.current.available, false)
assert.ok(fallback.executiveSummary)

console.log('✓ غرفة د. أحمد: 16/16')
