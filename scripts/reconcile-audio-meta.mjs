#!/usr/bin/env node
/**
 * مُصالِح سجلّ الصوت — يفكّ الحلقة المفرغة بين السجلّ و R2.
 *
 * الحال قبله: التشغيلة تولّد الصوت وترفعه، ثم تتحقّق من أن كل مدخلٍ في
 * `audio-meta.json` موجودٌ على R2 بحجمه المسجّل. فإن فشل التحقّق تراجعت
 * ولم تُثبّت السجلّ. وهنا مقتلٌ صامت:
 *
 *   • ملفٌ حُذف في التصفير الشامل بقي مدخلُه في السجلّ ⇐ 404 أبداً ⇐ كل
 *     تشغيلةٍ تفشل، وإلى الأبد.
 *   • ملفٌ أُعيد توليده ورُفع بحجمٍ جديد، لكن تثبيت السجلّ سقط مع التشغيلة
 *     ⇐ السجلّ يحمل الحجم القديم ⇐ فشلٌ دائم.
 *
 * فيولّد الصوت كل ساعة ويُرفض، ويُستهلك رصيد Azure بلا ثمرة.
 *
 * وهذا يُصالح السجلّ مع الواقع قبل التحقّق، بقاعدتين لا ثالثة لهما:
 *   ١) مدخلٌ لا وجود لملفه على R2 (404) ⇐ يُحذف. غيابُ الصوت أصدق من رابطٍ
 *      مكسور، والمقال يظهر بلا صوت حتى يُولَّد.
 *   ٢) مدخلٌ ملفُه موجود بحجمٍ مختلف ⇐ يُؤخذ حجم R2. فالموجود على الخادم هو
 *      ما يسمعه الناس، والسجلّ وصفٌ له لا حَكَمٌ عليه.
 *
 * ولا يخترع شيئاً: لا يضيف مدخلاً، ولا يلمس ما طابق، ويطبع كل تغييرٍ باسمه.
 */
import { existsSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { spawnSync } from 'node:child_process'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const SELF_TEST = process.argv.includes('--self-test')

/** قرارُ مدخلٍ واحد بعد سؤال R2 عنه */
export function decideEntry({ name, recordedBytes, status, remoteBytes }) {
  if (status === 404) return { action: 'drop', why: 'لا وجود له على R2' }
  if (status !== 200 && status !== 206) return { action: 'keep', why: `حالة عابرة ${status} — لا نحكم` }
  if (!remoteBytes || !recordedBytes) return { action: 'keep', why: 'حجمٌ ناقص — لا نحكم' }
  if (remoteBytes === recordedBytes) return { action: 'keep', why: 'مطابق' }
  return { action: 'refresh', why: `${recordedBytes} ← ${remoteBytes}`, bytes: remoteBytes }
}

/* ═══ الاختبارات ═══ */

if (SELF_TEST) {
  const assert = (c, m) => { if (!c) throw new Error(`✘ ${m}`) }

  assert(decideEntry({ status: 404 }).action === 'drop', '★ المحذوف يُحذف من السجلّ — وإلا فشلت كل تشغيلةٍ أبداً')
  assert(decideEntry({ status: 200, recordedBytes: 100, remoteBytes: 100 }).action === 'keep', 'المطابق لا يُمَسّ')
  const refreshed = decideEntry({ status: 200, recordedBytes: 100, remoteBytes: 300 })
  assert(refreshed.action === 'refresh' && refreshed.bytes === 300, '★ المختلف يأخذ حجم R2 — فالخادم هو ما يسمعه الناس')
  /* ★ العارض لا يُحذف: 429 من R2 عند الضغط لا يعني أن الملف ذهب */
  assert(decideEntry({ status: 429, recordedBytes: 100 }).action === 'keep', '★ الحدّ العابر لا يُسقط مدخلاً سليماً')
  assert(decideEntry({ status: 503 }).action === 'keep', 'ولا عطلُ الخادم')
  assert(decideEntry({ status: 200, recordedBytes: 0, remoteBytes: 0 }).action === 'keep', 'وبلا حجمٍ لا حكم')

  console.log('✓ اختبارات مصالحة سجلّ الصوت: 6/6')
  process.exit(0)
}

/* ═══ التشغيل ═══ */

const apply = process.argv.includes('--apply')
const base = (process.env.AUDIO_PUBLIC_BASE_URL || process.env.VITE_AUDIO_BASE_URL || '').replace(/\/+$/, '')
if (!base) { console.error('✘ AUDIO_PUBLIC_BASE_URL غير مضبوط.'); process.exit(1) }

const metaPath = resolve(ROOT, 'src/data/audio-meta.json')
if (!existsSync(metaPath)) { console.error('✘ audio-meta.json غير موجود.'); process.exit(1) }
const meta = JSON.parse(readFileSync(metaPath, 'utf8'))

const TRANSIENT = new Set([408, 425, 429, 500, 502, 503, 504])
const sleep = (ms) => new Promise((done) => setTimeout(done, ms))
/* الحدّ العابر يُعاد لا يُحكم عليه — وإلا حذفنا ملفاتٍ سليمةً لأن R2 ازدحم */
async function head(url, attempts = 4) {
  let last = { status: 0 }
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetch(url, { method: 'HEAD' })
      if (!TRANSIENT.has(response.status)) return { status: response.status, bytes: Number(response.headers.get('content-length') || 0) }
      last = { status: response.status }
    } catch { last = { status: 0 } }
    if (attempt < attempts) await sleep(400 * attempt * attempt)
  }
  return last
}

/** قياس المدّة من الملف الحيّ — يُنزَّل مؤقتاً ويُمسح، ولا يُستدعى إلا للمختلف */
async function probeSeconds(url) {
  const temp = resolve(tmpdir(), `audio-probe-${Date.now()}.mp3`)
  try {
    const response = await fetch(url)
    if (!response.ok) return 0
    writeFileSync(temp, Buffer.from(await response.arrayBuffer()))
    const probe = spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=nw=1:nk=1', temp], { encoding: 'utf8' })
    const seconds = Math.round(Number(String(probe.stdout || '').trim()))
    return Number.isFinite(seconds) && seconds > 0 ? seconds : 0
  } catch { return 0 } finally { try { unlinkSync(temp) } catch { /* مؤقتٌ ذهب */ } }
}

const names = Object.keys(meta).filter((name) => name.endsWith('.mp3'))
console.log(`═══ مصالحة ${names.length} مدخلاً مع R2 ═══\n`)

const dropped = []
const refreshed = []
for (const name of names) {
  const entry = meta[name]
  const { status, bytes } = await head(`${base}/${encodeURIComponent(name)}`)
  const verdict = decideEntry({ name, recordedBytes: Number(entry?.bytes || 0), status, remoteBytes: bytes })
  if (verdict.action === 'drop') { dropped.push(name); console.log(`  ✘ يُحذف · ${name} · ${verdict.why}`) }
  else if (verdict.action === 'refresh') {
    refreshed.push(name)
    /* المدّة تُقاس من الملف نفسه لا تُورَّث. فالفرق ليس جودةً أعلى لنصٍّ واحد:
       قيس ملفٌ منها فإذا هو ١٨٩ ثانية والسجلّ يقول ٢١٦ — قراءةٌ أخرى بتمامها.
       ولو نقلنا الحجم وتركنا المدّة لعرض المشغّل زمناً لا يطابق ما يُسمع. */
    const seconds = await probeSeconds(`${base}/${encodeURIComponent(name)}`)
    meta[name] = { ...entry, bytes: verdict.bytes, ...(seconds ? { durationSeconds: seconds } : {}) }
    console.log(`  ↻ يُحدَّث · ${name} · ${verdict.why} بايت${seconds ? ` · ${entry?.durationSeconds || '؟'} ← ${seconds} ثانية` : ' · تعذّر قياس المدّة'}`)
  }
}
for (const name of dropped) delete meta[name]

console.log(`\n── محذوف: ${dropped.length} · محدَّث: ${refreshed.length} · سليم: ${names.length - dropped.length - refreshed.length} ──`)
if (!dropped.length && !refreshed.length) { console.log('\n✓ السجلّ يطابق R2 — لا شيء يُفعل.'); process.exit(0) }

if (!apply) { console.log('\nⓘ تشغيلةٌ جافّة: لم يُكتب شيء. أضف --apply للحفظ.'); process.exit(0) }
writeFileSync(metaPath, `${JSON.stringify(meta, null, 2)}\n`)
console.log('\n✓ حُفظ السجلّ مصالَحاً مع R2.')
