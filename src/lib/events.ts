import type { Event as SiteEvent } from '../data'

const westernDigits = (value: string) => value
  .replace(/[٠-٩]/g, (digit) => '0123456789'['٠١٢٣٤٥٦٧٨٩'.indexOf(digit)] || digit)
  .replace(/[۰-۹]/g, (digit) => '0123456789'['۰۱۲۳۴۵۶۷۸۹'.indexOf(digit)] || digit)

/**
 * يحوّل وقت اللقاء المكتوب بالعربية أو الإنجليزية إلى ساعة ودقيقة.
 * يدعم: 6:30 م، 6 م، 5 pm، pm 5، 17:00.
 */
export function parseEventTime(value = ''): { hour: number; minute: number } | null {
  const raw = westernDigits(value).trim().toLowerCase()
  if (!raw) return null
  const compact = raw
    .replace(/p\.?m\.?/g, ' pm ')
    .replace(/a\.?m\.?/g, ' am ')
    .replace(/مساءً?|مساء/g, ' pm ')
    .replace(/صباحاً?|صباح/g, ' am ')
    .replace(/م/g, ' pm ')
    .replace(/ص/g, ' am ')
    .replace(/\s+/g, ' ')
    .trim()
  const marker = /(?:^|\s)(am|pm)(?:\s|$)/.exec(compact)?.[1] || ''
  const numbers = compact.match(/\d{1,2}(?::\d{1,2})?/)?.[0]
  if (!numbers) return null
  const [hourText, minuteText = '0'] = numbers.split(':')
  let hour = Number(hourText)
  const minute = Number(minuteText)
  if (!Number.isInteger(hour) || !Number.isInteger(minute) || minute < 0 || minute > 59) return null
  if (marker) {
    if (hour < 1 || hour > 12) return null
    if (marker === 'pm' && hour < 12) hour += 12
    if (marker === 'am' && hour === 12) hour = 0
  } else if (hour < 0 || hour > 23) return null
  return { hour, minute }
}

/** وقت اختفاء اللقاء بتوقيت الكويت. إن لم يُكتب وقت، يبقى حتى نهاية يومه. */
export function eventEndTimestamp(event: Pick<SiteEvent, 'iso' | 'time'>): number {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(event.iso || '')) return Number.NEGATIVE_INFINITY
  const parsed = parseEventTime(event.time || '')
  const time = parsed
    ? `${String(parsed.hour).padStart(2, '0')}:${String(parsed.minute).padStart(2, '0')}:00`
    : '23:59:59'
  return Date.parse(`${event.iso}T${time}+03:00`)
}

export function isUpcomingEvent(event: Pick<SiteEvent, 'iso' | 'time'>, now = Date.now()) {
  const end = eventEndTimestamp(event)
  return Number.isFinite(end) && end >= now
}

export function sortUpcomingEvents<T extends Pick<SiteEvent, 'iso' | 'time' | 'title'>>(events: T[], now = Date.now()) {
  return events
    .filter((event, index, list) => list.findIndex((candidate) => candidate.iso === event.iso && candidate.title === event.title) === index)
    .filter((event) => isUpcomingEvent(event, now))
    .sort((left, right) => eventEndTimestamp(left) - eventEndTimestamp(right))
}

export function sortPastEvents<T extends Pick<SiteEvent, 'iso' | 'time' | 'title'>>(events: T[], now = Date.now()) {
  return events
    .filter((event, index, list) => list.findIndex((candidate) => candidate.iso === event.iso && candidate.title === event.title) === index)
    .filter((event) => !isUpcomingEvent(event, now) && Number.isFinite(eventEndTimestamp(event)))
    .sort((left, right) => eventEndTimestamp(right) - eventEndTimestamp(left))
}

/* حالة التسجيل التلقائية (مقترح معتمد): تُحسب من التاريخ وحده، بلا صيانة يدوية */
export function eventStatus(event: Pick<SiteEvent, 'iso' | 'time' | 'url'>, now = Date.now()): { key: 'today' | 'soon' | 'open' | 'announced'; label: string } | null {
  if (!isUpcomingEvent(event, now)) return null
  const kuwaitToday = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kuwait' }).format(new Date(now))
  if (event.iso === kuwaitToday) return { key: 'today', label: 'اليوم' }
  const start = Date.parse(`${event.iso}T00:00:00+03:00`)
  if (start - now <= 7 * 86_400_000) return { key: 'soon', label: 'اقترب الموعد' }
  if (/^https?:\/\//.test(event.url || '')) return { key: 'open', label: 'التسجيل مفتوح' }
  return { key: 'announced', label: 'معلن' }
}

/* ═══ «أضف إلى تقويمي» — مقترح معتمد ═══
   اللقاء يذهب إلى تقويم الزائر بنقرة: رابط Google مباشر، وملف ICS يفتحه
   تقويم Apple وOutlook. كله محلي بلا خدمات وسيطة. */

const pad2 = (value: number) => String(value).padStart(2, '0')

function eventUtcStamp(iso: string, hour: number, minute: number) {
  const utc = new Date(Date.parse(`${iso}T${pad2(hour)}:${pad2(minute)}:00+03:00`))
  return `${utc.getUTCFullYear()}${pad2(utc.getUTCMonth() + 1)}${pad2(utc.getUTCDate())}T${pad2(utc.getUTCHours())}${pad2(utc.getUTCMinutes())}00Z`
}

function eventCalendarTimes(event: Pick<SiteEvent, 'iso' | 'time'>) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(event.iso || '')) return null
  const parsed = parseEventTime(event.time || '')
  if (parsed) {
    const start = eventUtcStamp(event.iso, parsed.hour, parsed.minute)
    const end = eventUtcStamp(event.iso, parsed.hour + 1, parsed.minute)
    return { allDay: false, start, end }
  }
  const day = event.iso.replace(/-/g, '')
  const next = new Date(Date.parse(`${event.iso}T00:00:00Z`) + 86400000)
  const nextDay = `${next.getUTCFullYear()}${pad2(next.getUTCMonth() + 1)}${pad2(next.getUTCDate())}`
  return { allDay: true, start: day, end: nextDay }
}

function calendarDescription(event: Pick<SiteEvent, 'org' | 'place' | 'url'>) {
  return [event.org, event.place, event.url].filter(Boolean).join(' — ')
}

export function googleCalendarUrl(event: Pick<SiteEvent, 'iso' | 'time' | 'title' | 'org' | 'place' | 'url'>) {
  const times = eventCalendarTimes(event)
  if (!times) return ''
  const url = new URL('https://calendar.google.com/calendar/render')
  url.searchParams.set('action', 'TEMPLATE')
  url.searchParams.set('text', event.title || 'لقاء — د. أحمد الفيلكاوي')
  url.searchParams.set('dates', `${times.start}/${times.end}`)
  const details = calendarDescription(event)
  if (details) url.searchParams.set('details', details)
  if (event.place) url.searchParams.set('location', event.place)
  return url.toString()
}

export function downloadEventIcs(event: Pick<SiteEvent, 'iso' | 'time' | 'title' | 'org' | 'place' | 'url'>) {
  const times = eventCalendarTimes(event)
  if (!times || typeof document === 'undefined') return
  const escapeText = (value = '') => value.replace(/\\/g, '\\\\').replace(/;/g, '\;').replace(/,/g, '\\,').replace(/\n/g, '\\n')
  const stampNow = eventUtcStamp(new Date().toISOString().slice(0, 10), new Date().getUTCHours(), new Date().getUTCMinutes())
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//dr-alfailakawi.com//events//AR',
    'BEGIN:VEVENT',
    `UID:${event.iso}-${escapeText(event.title || '').slice(0, 40).replace(/[^\w؀-ۿ-]+/g, '-')}@dr-alfailakawi.com`,
    `DTSTAMP:${stampNow}`,
    times.allDay ? `DTSTART;VALUE=DATE:${times.start}` : `DTSTART:${times.start}`,
    times.allDay ? `DTEND;VALUE=DATE:${times.end}` : `DTEND:${times.end}`,
    `SUMMARY:${escapeText(event.title || 'لقاء — د. أحمد الفيلكاوي')}`,
    calendarDescription(event) ? `DESCRIPTION:${escapeText(calendarDescription(event))}` : '',
    event.place ? `LOCATION:${escapeText(event.place)}` : '',
    event.url ? `URL:${escapeText(event.url)}` : '',
    'END:VEVENT',
    'END:VCALENDAR',
  ].filter(Boolean)
  const blob = new Blob([lines.join('\r\n')], { type: 'text/calendar;charset=utf-8' })
  const href = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = href
  anchor.download = `${(event.title || 'event').slice(0, 60).replace(/[\\/:*?"<>|]+/g, '-')}.ics`
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  window.setTimeout(() => URL.revokeObjectURL(href), 1000)
}
