/* شارة «على الهواء الآن» — النافذة التي يطلّ منها الزائر على الإذاعة قبل أن
   يدخلها. لا تعرض عنوان الحلقة وحده (ذاك سطرٌ بارد)، بل الجملة التي تُقال في
   هذه اللحظة نفسها: من فتح الصفحة يرى فكرةً حيّة، لا إعلاناً عن فكرة.

   وزنها: جدول الإذاعة وجُمل الحلقة الجارية وحدها تُجلبان بالشبكة بعد أن
   تستقرّ الصفحة (‎~٣٠KB مجتمعَين)، فلا تدخل حزمة الدخول ولا تزاحم أول رسم.
   وإن تعذّر الجلب لم يظهر شيء — لا هيكلٌ فارغ ولا رسالة عطب. */
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router'
import { FadeUp } from '../ui'

type Item = { slug: string; title: string; cat: string; at: number; dur: number }
type Schedule = { loop: number; items: Item[] }
type Line = { s: number; t: string; f: boolean }

const kuwaitSecondsOfDay = (d: Date) =>
  ((d.getUTCHours() * 3600 + d.getUTCMinutes() * 60 + d.getUTCSeconds()) + 3 * 3600) % 86400

const clean = (t: string) => t.replace(/⏸/g, '').replace(/\s*~~\s*/g, ' ').replace(/\s+/g, ' ').trim()

/* الجدول والجُمل كلاهما يُجلب مرّةً واحدة ويُخزَّن خارج المكوّن: React يركّب
   المكوّن ويفكّه ثم يعيد تركيبه، فحارسٌ داخليٌّ أو إشارة «حيّ» تُسقط نتيجة
   الجلب الأول ولا يبدأ ثانٍ — فتبقى الشارة صامتةً بلا خطأٍ واحد في السجلّ. */
let scheduleReady: Promise<Schedule | null> | null = null
function loadSchedule(): Promise<Schedule | null> {
  if (!scheduleReady) {
    scheduleReady = fetch('/radio-schedule.json')
      .then((res) => (res.ok ? res.json() : null))
      .then((data: Schedule | null) => (data?.items?.length ? data : null))
      .catch(() => null)
  }
  return scheduleReady
}

const cache = new Map<string, Promise<Line[]>>()
function linesOf(slug: string): Promise<Line[]> {
  let ready = cache.get(slug)
  if (!ready) {
    ready = fetch(`/spoken/${encodeURIComponent(slug)}.json`)
      .then((res) => (res.ok ? res.json() : { lines: [] }))
      .then((file: { lines?: [number, number, string][] }) =>
        (file.lines || []).map((row) => ({ s: row[0], t: clean(row[2]), f: row[1] !== 1 })))
      .catch(() => [] as Line[])
    cache.set(slug, ready)
  }
  return ready
}

export default function OnAirNow() {
  const [schedule, setSchedule] = useState<Schedule | null>(null)
  const [lines, setLines] = useState<Line[]>([])
  const [now, setNow] = useState(() => kuwaitSecondsOfDay(new Date()))

  /* الجلب يتأخّر إلى ما بعد سكون الصفحة: الشارة زينةُ لحظةٍ لا سببَ زيارة،
     فلا يجوز أن تزاحم المقالات على أول اتصال. */
  useEffect(() => {
    let alive = true
    const start = () => { loadSchedule().then((data) => { if (alive && data) setSchedule(data) }) }
    const idle = (window as unknown as { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number })
      .requestIdleCallback
    const id = idle ? idle(start, { timeout: 2600 }) : window.setTimeout(start, 1400)
    return () => {
      alive = false
      const cancel = (window as unknown as { cancelIdleCallback?: (h: number) => void }).cancelIdleCallback
      if (idle && cancel) cancel(id as number)
      else window.clearTimeout(id as number)
    }
  }, [])

  useEffect(() => {
    if (!schedule) return undefined
    const id = window.setInterval(() => setNow(kuwaitSecondsOfDay(new Date())), 1000)
    return () => window.clearInterval(id)
  }, [schedule])

  const position = useMemo(() => {
    if (!schedule) return null
    const at = now % schedule.loop
    const items = schedule.items
    let lo = 0
    let hi = items.length - 1
    let idx = 0
    while (lo <= hi) {
      const mid = (lo + hi) >> 1
      if (items[mid].at <= at) { idx = mid; lo = mid + 1 } else hi = mid - 1
    }
    return { item: items[idx], into: at - items[idx].at }
  }, [schedule, now])

  /* الجلب يُخزَّن على مستوى الوحدة لا في مرجعٍ داخل المكوّن: React يركّب
     المكوّن ويفكّه ثم يعيد تركيبه في التطوير، فحارسٌ داخليٌّ يمنع الجلب الثاني
     بينما إشارة «حيّ» تُلغي نتيجة الأول — فلا يصل نصٌّ أبداً. */
  useEffect(() => {
    const slug = position?.item.slug
    if (!slug) return undefined
    let alive = true
    linesOf(slug).then((list) => { if (alive) setLines(list) })
    return () => { alive = false }
  }, [position?.item.slug])

  const spoken = useMemo(() => {
    if (!position || !lines.length) return null
    /* الجُمل مؤقّتة على الصوت الكامل، والحلقة تُبثّ من أولها — فالموضع داخل
       الحلقة هو الثانية نفسها. */
    let found = lines[0]
    for (const line of lines) { if (position.into >= line.s) found = line; else break }
    return found
  }, [position, lines])

  if (!position || !spoken) return null
  const progress = Math.min(100, Math.max(0, (position.into / Math.max(1, position.item.dur)) * 100))

  return (
    <section className="border-t border-hair py-5 md:py-6">
      <div className="mx-auto max-w-shell px-6 md:px-11">
        <FadeUp>
          <Link
            to="/radio"
            className="onair group block overflow-hidden rounded-xl border border-hair bg-wash transition-colors hover:border-accent"
            style={{ ['--onair-voice' as string]: spoken.f ? '#B0703A' : '#4E6E70' }}
          >
            <div className="flex items-start gap-4 px-4 py-3.5 md:px-5 md:py-4">
              <span className="onair-dot mt-[7px] shrink-0" aria-hidden="true" />
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                  <span className="text-[.72rem] font-semibold tracking-[.14em] text-accent">على الهواء الآن</span>
                  <span className="truncate text-[.7rem] text-soft">{position.item.title}</span>
                </span>
                <span className="onair-line mt-1.5 block font-display text-[1rem] leading-[1.75] text-ink md:text-[1.12rem]">
                  {spoken.t}
                </span>
              </span>
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-hair text-accent transition-colors group-hover:border-accent" aria-hidden="true">↗</span>
            </div>
            <span className="onair-progress" aria-hidden="true"><i style={{ width: `${progress}%` }} /></span>
          </Link>
        </FadeUp>
      </div>
    </section>
  )
}
