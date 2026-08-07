import crypto from 'node:crypto'
import { TIME_ZONE } from './config.mjs'

const now = () => new Date()

function localParts(date = now()) {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: TIME_ZONE, year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', hour12: false }).formatToParts(date)
  return Object.fromEntries(parts.filter((part) => part.type !== 'literal').map((part) => [part.type, Number(part.value)]))
}

export function parseReminderTime(text, reference = now()) {
  const value = String(text || '').toLowerCase().replace(/[ًٌٍَُِّْـ]/g, '').replace(/ة/g, 'ه').replace(/\s+/g, ' ').trim()
  const relative = value.match(/بعد\s+(?:(\d+)\s*)?(دقيقه|دقائق|دقيقتين|ساعه|ساعات|ساعتين|يوم|ايام|يومين)/)
  if (relative) {
    const unit = relative[2]; const amount = Number(relative[1] || (/ين$/.test(unit) ? 2 : 1))
    const multiplier = /دقيق/.test(unit) ? 60 * 1000 : /ساع/.test(unit) ? 60 * 60 * 1000 : 24 * 60 * 60 * 1000
    return { dueAt: new Date(reference.getTime() + amount * multiplier).toISOString(), source: 'relative' }
  }
  const hourMatch = value.match(/(?:الليله|باجر|بكره|بكرا|غدا|الجمعه)?(?:\s*الساعه\s*(\d{1,2})(?:\s*(صباحا|صباح|مساء|مساءا|ظهرا|ظهر|العصر|الليل))?)?$/)
  /* «الساعة ٧ مساءً» كانت تُحفظ ٧ صباحاً: الفرع الوحيد الذي نظر إلى «مساء»
     كتبها `? 0 : 0` — شرطاً لا أثر له، والفرعان الآخران لم ينظرا إليها أصلاً.
     التحويل الآن في موضعٍ واحد يمرّ عليه الجميع. */
  const meridiem = (hour) => {
    const mark = hourMatch?.[2] || ''
    if (!hour && hour !== 0) return hour
    if (/مساء|الليل|العصر/.test(mark) && hour < 12) return hour + 12
    if (/ظهر/.test(mark) && hour < 12) return hour === 12 ? 12 : hour + 12
    if (/صباح/.test(mark) && hour === 12) return 0
    return hour
  }
  if (/الليله/.test(value)) {
    const p = localParts(reference); const raw = hourMatch?.[1] ? Number(hourMatch[1]) : 21
    /* «الليلة الساعة ٩» ليلٌ بطبعه وإن لم يقل «مساءً». */
    const hour = hourMatch?.[2] ? meridiem(raw) : (raw < 12 ? raw + 12 : raw)
    return { dueAt: nextLocalDate(reference, p.year, p.month, p.day, hour, 0).toISOString(), source: 'tonight' }
  }
  if (/باجر|بكره|بكرا|غدا/.test(value)) {
    const p = localParts(reference); const hour = meridiem(hourMatch?.[1] ? Number(hourMatch[1]) : 9)
    return { dueAt: nextLocalDate(reference, p.year, p.month, p.day + 1, hour, 0).toISOString(), source: 'tomorrow' }
  }
  if (/الجمعه/.test(value)) {
    const p = localParts(reference); const current = new Date(Date.UTC(p.year, p.month - 1, p.day)).getUTCDay(); const days = (5 - current + 7) % 7 || 7; const hour = hourMatch?.[1] ? meridiem(Number(hourMatch[1])) : null
    if (hour === null) return { ambiguous: true, reason: 'missing-hour' }
    return { dueAt: nextLocalDate(reference, p.year, p.month, p.day + days, hour, 0).toISOString(), source: 'friday' }
  }
  return { ambiguous: true, reason: 'unrecognized-time' }
}

function nextLocalDate(reference, year, month, day, hour, minute) {
  // Kuwait is UTC+3 year-round. Keep conversion explicit and deterministic.
  const utc = Date.UTC(year, month - 1, day, Number(hour) || 0, Number(minute) || 0) - (3 * 60 * 60 * 1000)
  const result = new Date(utc)
  if (result <= reference) result.setDate(result.getDate() + 1)
  return result
}

export function createReminder(db, { jid, contentId = null, originalText, dueAt }) {
  const id = crypto.randomBytes(10).toString('base64url'); const nowIso = new Date().toISOString()
  if (!jid) throw new Error('لا يمكن إنشاء تذكير بلا جهة محادثة')
  const encText = typeof db.encryptText === 'function' ? db.encryptText(String(originalText).slice(0, 300)) : String(originalText).slice(0, 300)
  db.run('INSERT INTO reminders(id,jid,content_id,due_at,original_text,state,created_at) VALUES(?,?,?,?,?,?,?)', id, db.encryptJid(jid), contentId, dueAt, encText, 'pending', nowIso)
  db.addAudit('reminder-created', 'local', `id=${id}`)
  return id
}
