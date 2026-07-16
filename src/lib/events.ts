import type { Event as SiteEvent } from '../data'

const westernDigits = (value: string) => value
  .replace(/[٠-٩]/g, (digit) => '0123456789'['٠١٢٣٤٥٦٧٨٩'.indexOf(digit)] || digit)
  .replace(/[۰-۹]/g, (digit) => '0123456789'['۰۱۲۳۴۵۶۷۸۹'.indexOf(digit)] || digit)

/**
 * يحوّل وقت اللقاء المكتوب بالعربية أو الإنجليزية إلى ساعة ودقيقة.
 * يدعم: 6:30 م، ٦ م، 5 pm، pm 5، 17:00.
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
