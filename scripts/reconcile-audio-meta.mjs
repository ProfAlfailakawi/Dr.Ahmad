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
  if (remoteBytes === recordedBytes) return { action: 'verify', why: 'مطابق ومتحقق على R2' }
  return { action: 'refresh', why: `${recordedBytes} ← ${remoteBytes}`, bytes: remoteBytes }
}

/** الحقيقة المرشّحة: نحافظ على كل ما في السجل (ومن ضمنه نورة للمستقبل)،
 * لكن الاكتشاف الجديد لقراءة المقالات يسأل عن فهد فقط. */
export function discoveryCandidates(knownNames = [], slugs = []) {
  const candidates = new Set(knownNames.filter((name) => name.endsWith('.mp3')))
  for (const slug of slugs.filter(Boolean)) candidates.add(`${slug}.mp3`)
  return [...candidates]
}

/* ═══ الاختبارات ═══ */

if (SELF_TEST) {
  const assert = (c, m) => { if (!c) throw new Error(`✘ ${m}`) }

  assert(decideEntry({ status: 404 }).action === 'drop', '★ المحذوف يُحذف من السجلّ — وإلا فشلت كل تشغيلةٍ أبداً')
  assert(decideEntry({ status: 200, recordedBytes: 100, remoteBytes: 100 }).action === 'verify', 'المطابق يُوسم متحققاً بلا إعادة توليد')
  const refreshed = decideEntry({ status: 200, recordedBytes: 100, remoteBytes: 300 })
  assert(refreshed.action === 'refresh' && refreshed.bytes === 300, '★ المختلف يأخذ حجم R2 — فالخادم هو ما يسمعه الناس')
  /* ★ العارض لا يُحذف: 429 من R2 عند الضغط لا يعني أن الملف ذهب */
  assert(decideEntry({ status: 429, recordedBytes: 100 }).action === 'keep', '★ الحدّ العابر لا يُسقط مدخلاً سليماً')
  assert(decideEntry({ status: 503 }).action === 'keep', 'ولا عطلُ الخادم')
  assert(decideEntry({ status: 200, recordedBytes: 0, remoteBytes: 0 }).action === 'keep', 'وبلا حجمٍ لا حكم')
  const candidates = discoveryCandidates(['a.noura.mp3', 'legacy.dialogue.mp3'], ['a', 'b'])
  assert(candidates.includes('a.noura.mp3'), 'نورة المحفوظة لا تُحذف من السجل')
  assert(candidates.includes('a.mp3') && candidates.includes('b.mp3'), 'كل مقالات المصدر تدخل اكتشاف فهد')
  assert(!candidates.includes('b.noura.mp3'), 'لا يُنشأ اكتشاف جديد لنورة في قراءة المقالات')

  console.log('✓ اختبارات مصالحة سجلّ الصوت: 9/9')
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

/* اكتشافٌ من R2 (العلاج الجذري): المُصالِح القديم كان يتحقّق فقط من مداخل السجلّ
   الموجودة، فإن فقد السجلُّ مداخلَ — تشغيلةٌ ملغاة تكتب سجلاً جزئياً، أو دهسٌ من
   جلسةٍ متزامنة، أو حسم تعارضٍ يأخذ نسخةً أصغر — لم يستطع استعادتها، فتنهار الخلاصة
   (شوهد: ١٠٤→٢٥، والخلاصة نزلت ٥٦→١٣). الآن نسأل R2 عن كل ملفٍ ممكن (مقال × صوت)
   ونضيف ما وُجِد وغاب عن السجلّ. فيصير السجلّ دائماً ⩾ ما في R2 ولا يُحذف إلا ما
   غاب فعلاً (404) — فالدهس يصير غير مؤذٍ: أيّ تشغيلةٍ تعيد بناءه من الحقيقة. */
const bodiesPath = resolve(ROOT, 'src/data/bodies.json')
let slugs = []
try { slugs = Object.keys(JSON.parse(readFileSync(bodiesPath, 'utf8'))) }
catch { console.warn('  ⚠ تعذّر قراءة نصوص المقالات — نكتفي بمداخل السجلّ.') }
const candidates = new Set(discoveryCandidates(Object.keys(meta), slugs))
console.log(`═══ مصالحة ${candidates.size} ملفاً محتملاً مع R2 (السجلّ يحمل ${Object.keys(meta).length}) ═══\n`)

const dropped = []
const refreshed = []
const added = []
const verified = []
for (const name of candidates) {
  const entry = meta[name]
  const { status, bytes } = await head(`${base}/${encodeURIComponent(name)}`)
  if (status === 200 || status === 206) {
    if (!entry) {
      /* ملفٌ حيٌّ على R2 غائبٌ عن السجلّ ⇐ يُضاف. عتبة 200KB تحمي من إضافة ردٍّ
         خاطئٍ صغير. المدّة تُقاس من الملف نفسه؛ فإن تعذّرت يُضاف بالحجم وحده. */
      if (bytes > 200_000) {
        const seconds = await probeSeconds(`${base}/${encodeURIComponent(name)}`)
        meta[name] = {
          ...(seconds ? { durationSeconds: seconds } : {}),
          bytes,
          validationStatus: 'verified-r2',
          verifiedAt: new Date().toISOString(),
        }
        added.push(name)
        console.log(`  ＋ يُضاف · ${name} · ${bytes} بايت${seconds ? ` · ${seconds} ثانية` : ''}`)
      }
    } else {
      const verdict = decideEntry({ name, recordedBytes: Number(entry?.bytes || 0), status, remoteBytes: bytes })
      if (verdict.action === 'refresh') {
        refreshed.push(name)
        const seconds = await probeSeconds(`${base}/${encodeURIComponent(name)}`)
        meta[name] = {
          ...entry,
          bytes: verdict.bytes,
          ...(seconds ? { durationSeconds: seconds } : {}),
          validationStatus: 'verified-r2',
          verifiedAt: entry.verifiedAt || new Date().toISOString(),
        }
        console.log(`  ↻ يُحدَّث · ${name} · ${verdict.why} بايت`)
      } else if (verdict.action === 'verify' && (entry.validationStatus !== 'verified-r2' || !entry.verifiedAt)) {
        verified.push(name)
        const seconds = Number(entry.durationSeconds || 0) > 0
          ? Number(entry.durationSeconds)
          : await probeSeconds(`${base}/${encodeURIComponent(name)}`)
        meta[name] = {
          ...entry,
          ...(seconds ? { durationSeconds: seconds } : {}),
          validationStatus: 'verified-r2',
          verifiedAt: entry.verifiedAt || new Date().toISOString(),
        }
        console.log(`  ✓ موثّق · ${name} · موجود على R2 بالحجم نفسه`)
      }
    }
  } else if (status === 404 && entry) {
    dropped.push(name)
    console.log(`  ✘ يُحذف · ${name} · لا وجود له على R2`)
  }
}
for (const name of dropped) delete meta[name]

console.log(`\n── مضاف: ${added.length} · موثّق: ${verified.length} · محدَّث: ${refreshed.length} · محذوف: ${dropped.length} ──`)
if (!added.length && !verified.length && !refreshed.length && !dropped.length) { console.log('\n✓ السجلّ يطابق R2 — لا شيء يُفعل.'); process.exit(0) }

if (!apply) { console.log('\nⓘ تشغيلةٌ جافّة: لم يُكتب شيء. أضف --apply للحفظ.'); process.exit(0) }
writeFileSync(metaPath, `${JSON.stringify(meta, null, 2)}\n`)
console.log('\n✓ حُفظ السجلّ مصالَحاً مع R2 (⩾ ما في R2 دائماً).')
