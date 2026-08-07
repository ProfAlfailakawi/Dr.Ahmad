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

const expectedAudio = new Map([
  ['Tarbawyah-14', 'Tarbawyah-14.mp3'],
  ['idaa', 'idaa.mp3'],
])
for (const [id, audioFile] of expectedAudio) {
  const item = (archive.items || []).find((entry) => entry.id === id)
  if (!item) throw new Error(`المادة الصوتية مفقودة: ${id}`)
  if (item.kind !== 'audio' || item.audioFile !== audioFile || !item.audioHostingRequired) {
    throw new Error(`ربط الصوت الخارجي غير صالح: ${id}`)
  }
  checks += 1
}

/* ١) لا تفريغ يتيم: كل مفتاحٍ في الفهرس يعود إلى مادةٍ حقيقية — إمّا في الأرشيف
   الساكن أو بين لقاءات data.ts. اليتيم علامةُ استيرادٍ بمعرّفٍ خاطئ، وهو بالضبط
   ما جعل ستة عشر تفريغاً حاضراً على الجهاز وغائباً عن الموقع. */
const siteData = fs.readFileSync('src/data.ts', 'utf8')
for (const id of Object.keys(transcripts)) {
  if (!ids.has(id) && !siteData.includes(id)) throw new Error(`تفريغ يتيم لا مادة له: ${id}`)
  checks += 1
}

/* ٢) الصوت لا يسكن المستودع أبداً: استضافة Firebase المجانية تعطي ٣٦٠ م.ب نقلاً
   يومياً، فملفٌ من عشرة ميغابايت يُنهي الحصة بستةٍ وثلاثين استماعاً ويُسقط الموقع.
   بيت الصوت R2 عبر AUDIO_PUBLIC_BASE_URL — لا public/ ولا رابطٌ نسبي. */
for (const item of archive.items || []) {
  if (!item.audioFile && !item.audioUrl) continue
  if (item.audioUrl && !/^https:\/\//.test(item.audioUrl)) {
    throw new Error(`صوت مستضاف داخل الموقع: ${item.slug} — ${item.audioUrl}`)
  }
  checks += 1
}
const repoAudio = []
const walk = (dir) => {
  for (const name of fs.readdirSync(dir, { withFileTypes: true })) {
    if (name.name === 'node_modules' || name.name.startsWith('.')) continue
    const path = `${dir}/${name.name}`
    if (name.isDirectory()) walk(path)
    else if (/\.(?:mp3|m4a|wav)$/i.test(name.name)) repoAudio.push(path)
  }
}
walk('public')
walk('src')
if (repoAudio.length) throw new Error(`ملفات صوت داخل المستودع: ${repoAudio.join('، ')}`)
checks += 1

/* ٣) العدد يُصرَّف بمحرك العربية لا بلفظٍ ثابت: «٩ مقاطع زمنية» لا «٩ مقطعاً زمنياً». */
const detail = fs.readFileSync('src/pages/MediaDetail.tsx', 'utf8')
if (!detail.includes('TIMED_SEGMENT_FORMS') || !detail.includes('arabicCountPhrase')) {
  throw new Error('بطاقة الأرشيف لا تستعمل محرك تصريف العدد العربي')
}
if (/segmentCount\}\s*مقطع/.test(detail)) throw new Error('لفظ العدد مكتوب ثابتاً بجانب segmentCount')
checks += 2

console.log(`نجح اختبار الأرشيف الإعلامي: ${checks} تحققاً`)
