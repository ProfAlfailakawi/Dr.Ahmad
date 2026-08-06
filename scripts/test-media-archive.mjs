import fs from 'node:fs'
const archive = JSON.parse(fs.readFileSync('src/data/media-archive.json', 'utf8'))
const transcripts = JSON.parse(fs.readFileSync('src/data/media-archive-transcripts.json', 'utf8'))
const ids = new Set()
let checks = 0
for (const item of archive.items || []) {
  if (!item.id || !item.slug || ids.has(item.id)) throw new Error(`سجل غير صالح أو مكرر: ${item.id}`)
  ids.add(item.id); checks += 1
  const transcript = transcripts[item.id]
  if (transcript?.available) {
    if (!Array.isArray(transcript.segments) || !transcript.segments.length) throw new Error(`تفريغ بلا مقاطع: ${item.id}`)
    for (const segment of transcript.segments) {
      if (!(segment.start >= 0 && segment.end > segment.start && segment.displayText)) throw new Error(`مقطع غير صالح: ${item.id}`)
      checks += 1
    }
  }
}
console.log(`نجح اختبار الأرشيف الإعلامي: ${checks} تحققاً`)
