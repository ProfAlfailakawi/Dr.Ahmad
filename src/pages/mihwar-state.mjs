// حالة «مِحور» الخاصة: الشكل، الترحيل، الدمج عند التعارض، الموجز والاختيار السريع.
// دوال نقية بلا DOM كي تُختبر في Node.
import { DEFAULT_INTERESTS, scoreItem, deadlineStatus, daysUntil, safeUrl, hashString, approxDate } from './mihwar-core.mjs'

export const STATE_VERSION = 2
export const COLLECTIONS = ['research', 'conferences', 'projects', 'achievements', 'tasks', 'ideas', 'appointments']
export const MAPS = ['saved', 'read', 'ignored', 'notes', 'links']
export const APPLICATION_STATUSES = ['قيد الدراسة', 'قررت التقديم', 'قيد الإعداد', 'قُدِّم', 'قُبل', 'رُفض', 'تخطيت']
export const MAX_PAYLOAD = 850_000

export const newId = () => (globalThis.crypto?.randomUUID?.() || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`)

export function blankState() {
  return {
    version: STATE_VERSION, interests: DEFAULT_INTERESTS.map((i) => ({ ...i })),
    research: [], conferences: [], projects: [], achievements: [], tasks: [], ideas: [], appointments: [],
    saved: {}, read: {}, ignored: {}, notes: {}, links: {}, pinned: {}, tombstones: {},
    sourcesOff: {}, lastVisit: null, lastReview: null, lastBackup: null,
  }
}

/** ترحيل حالة النسخة 1 (Crossref داخل المستند) إلى النسخة 2 دون فقد المحفوظات والملاحظات. */
export function migrate(input) {
  const base = blankState()
  if (!input || typeof input !== 'object') return base
  const s = { ...base, ...input }
  for (const key of COLLECTIONS) s[key] = Array.isArray(input[key]) ? input[key].filter((x) => x && typeof x === 'object').map((x) => ({ ...x, id: x.id || newId() })) : []
  for (const key of [...MAPS, 'pinned', 'tombstones', 'sourcesOff']) s[key] = input[key] && typeof input[key] === 'object' && !Array.isArray(input[key]) ? { ...input[key] } : {}
  // اهتمامات: حافظ على ما عدّله المستخدم، وأضف الافتراضية الجديدة، وحوّل terms القديمة إلى phrases.
  const existing = Array.isArray(input.interests) ? input.interests : []
  const byName = new Map(existing.map((i) => [i.id || i.name, i]))
  const interests = []
  for (const d of DEFAULT_INTERESTS) {
    const mine = existing.find((i) => i.id === d.id)
    interests.push(mine ? { ...d, ...mine, phrases: mine.phrases || d.phrases } : { ...d })
    byName.delete(d.id)
  }
  for (const i of existing) if (!DEFAULT_INTERESTS.some((d) => d.id === i.id)) {
    // اهتمامات v1 القديمة المبنية على terms مفردة لا تُعتمد كما هي: تُحفظ معطّلة كي لا تعيد الخلط.
    interests.push({ id: i.id || 'u_' + hashString(i.name || newId()), name: i.name || 'اهتمام', source: i.source || 'أضفته أنت', active: i.id ? i.active !== false : false, phrases: i.phrases || i.terms || [], exclude: i.exclude || [] })
  }
  s.interests = interests
  if (Array.isArray(input.items)) {
    for (const item of input.items) {
      if (item && item.id && (s.saved[item.id] || s.notes[item.id] || s.links[item.id])) s.pinned[item.id] = compactItem(item)
    }
  }
  delete s.items; delete s.sourceErrors; delete s.lastRefresh; delete s.density; delete s.demo
  s.version = STATE_VERSION
  return s
}

export const compactItem = (item) => {
  const out = {}
  for (const k of ['id', 'title', 'url', 'source', 'sourceId', 'type', 'language', 'published', 'year', 'month', 'fetched', 'description', 'keywords', 'venue', 'deadline', 'eventStart', 'eventEnd', 'location', 'mode', 'officialUrl', 'deadlineNote']) if (item[k] !== undefined && item[k] !== null && item[k] !== '') out[k] = item[k]
  if (out.description) out.description = String(out.description).slice(0, 300)
  return out
}

const newer = (a, b) => String(a?.updated || '') >= String(b?.updated || '')

/** دمج حالتين عند تعارض الحفظ بين جهازين: لا يُفقد عنصر، والحذف المتعمَّد يُحترم بالشواهد (tombstones). */
export function mergeStates(local, remote) {
  const a = migrate(local); const b = migrate(remote)
  const out = blankState()
  out.tombstones = { ...b.tombstones, ...a.tombstones }
  for (const key of COLLECTIONS) {
    const map = new Map()
    for (const item of [...b[key], ...a[key]]) {
      const old = map.get(item.id)
      if (!old || newer(item, old)) map.set(item.id, item)
    }
    out[key] = [...map.values()].filter((item) => !(out.tombstones[item.id] && out.tombstones[item.id] >= String(item.updated || '')))
  }
  for (const key of [...MAPS, 'pinned', 'sourcesOff']) out[key] = { ...b[key], ...a[key] }
  const interests = new Map(b.interests.map((i) => [i.id, i]))
  for (const i of a.interests) interests.set(i.id, i)
  out.interests = [...interests.values()]
  for (const key of ['lastVisit', 'lastReview', 'lastBackup']) out[key] = [a[key], b[key]].filter(Boolean).sort().pop() || null
  return out
}

export function validateBackup(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return { ok: false, error: 'الملف ليس نسخة مِحور.' }
  if (![1, 2].includes(data.version)) return { ok: false, error: 'إصدار النسخة غير معروف.' }
  for (const key of COLLECTIONS.filter((k) => k !== 'appointments')) if (data[key] !== undefined && !Array.isArray(data[key])) return { ok: false, error: `الحقل ${key} غير صالح.` }
  if (data.version === 1 && !Array.isArray(data.projects)) return { ok: false, error: 'نسخة قديمة غير مكتملة.' }
  const migrated = migrate(data)
  // الروابط الواردة من ملف خارجي تُنقّى.
  for (const key of ['research', 'conferences', 'achievements']) for (const r of migrated[key]) { if (r.url && !safeUrl(r.url)) r.url = '' }
  for (const key of Object.keys(migrated.pinned)) { const u = safeUrl(migrated.pinned[key].url); if (!u) delete migrated.pinned[key]; else migrated.pinned[key].url = u }
  const counts = Object.fromEntries(COLLECTIONS.map((k) => [k, migrated[k].length]))
  return { ok: true, state: migrated, counts, saved: Object.values(migrated.saved).filter(Boolean).length }
}

// ---------- ترتيب وصلة ----------

/** حديثة بما يكفي لتظهر في «لك»: منشورة خلال 45 يوماً، أو مؤتمر لم ينتهِ موعده. غير المؤرَّخة تبقى في تبويباتها. */
export function isFresh(item, now = Date.now()) {
  if (item.type === 'مؤتمر') return deadlineStatus(item, now).code !== 'expired'
  const when = approxDate(item); return !!when && now - new Date(when) <= 45 * 86400000
}

export function rankFeed(items, state, now = Date.now()) {
  const interests = state.interests.filter((i) => i.active !== false)
  const out = []
  for (const item of items) {
    if (state.sourcesOff[item.sourceId]) continue
    const s = scoreItem(item, interests, state.projects)
    if (!s.relevant && !state.saved[item.id] && !state.links[item.id]) continue
    const when = approxDate(item); const ageDays = when ? Math.max(0, (now - new Date(when)) / 86400000) : 30
    const fresh = Math.max(0, 1 - ageDays / 45)
    const dl = item.deadline ? deadlineStatus(item, now) : null
    const urgency = dl?.code === 'urgent' ? 3 : dl?.code === 'soon' ? 1.5 : 0
    out.push({ item, reasons: s.reasons, relevance: s.total, rank: s.total + fresh * 2 + urgency + (state.read[item.id] ? -2 : 0.5) })
  }
  return out
}

const dueSoon = (x, now, days) => { if (!x.deadline || x.done) return false; const d = daysUntil(x.deadline, now); return d !== null && d >= 0 && d <= days }
const overdue = (x, now) => { if (!x.deadline || x.done) return false; const d = daysUntil(x.deadline, now); return d !== null && d < 0 }

/** «شنو فاتني؟»: ما تغيّر منذ آخر زيارة، مرتّباً بما يحتاج إجراءً أولاً. */
export function buildDigest(state, feedItems, previousVisit, now = Date.now()) {
  const ranked = rankFeed(feedItems, state, now)
  const since = previousVisit || state.lastReview
  const fresh = ranked.filter((r) => !state.read[r.item.id] && (!since || (r.item.fetched && r.item.fetched > since) || (r.item.published && r.item.published > since)))
  const urgentOpps = feedItems.filter((i) => i.type === 'مؤتمر' && i.deadline && !state.ignored[i.id]).map((i) => ({ i, d: deadlineStatus(i, now), s: scoreItem(i, state.interests.filter((x) => x.active !== false), state.projects) })).filter((x) => ['urgent', 'soon'].includes(x.d.code) && (x.s.relevant || state.saved[x.i.id])).sort((x, y) => x.i.deadline.localeCompare(y.i.deadline))
  const trackedDeadlines = state.conferences.filter((c) => dueSoon(c, now, 21) && !['قُدِّم', 'قُبل', 'رُفض', 'تخطيت'].includes(c.status)).sort((x, y) => x.deadline.localeCompare(y.deadline))
  const tasksOverdue = state.tasks.filter((t) => overdue(t, now))
  const tasksSoon = state.tasks.filter((t) => dueSoon(t, now, 7)).sort((x, y) => x.deadline.localeCompare(y.deadline))
  const appointments = state.appointments.filter((a) => dueSoon({ deadline: a.date, done: a.done }, now, 7)).sort((x, y) => x.date.localeCompare(y.date))
  const projectNews = []
  for (const p of state.projects.filter((p) => p.status !== 'مكتمل' && p.status !== 'مؤرشف')) {
    const hits = fresh.filter((r) => r.reasons.some((x) => x.project === p.id) || state.links[r.item.id] === p.id)
    if (hits.length) projectNews.push({ project: p, items: hits.slice(0, 3).map((h) => h.item) })
  }
  const savedConfirm = Object.keys(state.saved).filter((id) => state.saved[id])
    .map((id) => feedItems.find((i) => i.id === id) || state.pinned[id]).filter((i) => i && i.deadline && ['urgent', 'soon'].includes(deadlineStatus(i, now).code))
  return {
    since, fresh: fresh.sort((x, y) => y.rank - x.rank), urgentOpps, trackedDeadlines, tasksOverdue, tasksSoon, appointments, projectNews, savedConfirm,
    counts: { fresh: fresh.length, research: fresh.filter((r) => r.item.type === 'بحث').length, opportunities: urgentOpps.length + trackedDeadlines.length, actions: tasksOverdue.length + tasksSoon.length + trackedDeadlines.length },
  }
}

/** «وضع خمس دقائق»: خطة قصيرة بمجموع زمن ≤ 5 دقائق: إجراء واحد عاجل + قراءات متنوعة + لمسة للأفكار. */
export function fiveMinutePlan(state, feedItems, now = Date.now()) {
  const steps = []
  let minutes = 0
  const urgent = [
    ...state.tasks.filter((t) => overdue(t, now)).map((t) => ({ kind: 'tasks', rec: t, title: t.title, why: 'مهمة متأخرة', when: t.deadline })),
    ...state.tasks.filter((t) => dueSoon(t, now, 3)).map((t) => ({ kind: 'tasks', rec: t, title: t.title, why: 'تستحق خلال 3 أيام', when: t.deadline })),
    ...state.conferences.filter((c) => dueSoon(c, now, 10) && !['قُدِّم', 'قُبل', 'رُفض', 'تخطيت'].includes(c.status)).map((c) => ({ kind: 'conferences', rec: c, title: c.title, why: 'موعد تقديم قريب', when: c.deadline })),
  ].sort((a, b) => String(a.when).localeCompare(String(b.when)))
  if (urgent[0]) { steps.push({ ...urgent[0], minutes: 1, action: 'افتحه وحدد خطوتك التالية' }); minutes += 1 }
  const ranked = rankFeed(feedItems, state, now).filter((r) => !state.read[r.item.id] && r.item.type !== 'مؤتمر' && isFresh(r.item, now)).sort((a, b) => b.rank - a.rank)
  const seen = new Set(); const types = new Set()
  for (const r of ranked) {
    if (steps.filter((s) => s.kind === 'item').length >= 3 || minutes >= 4) break
    if (seen.has(r.item.sourceId)) continue
    if (types.has(r.item.type) && ranked.length > 8 && steps.filter((s) => s.kind === 'item').length < 2) continue
    seen.add(r.item.sourceId); types.add(r.item.type)
    steps.push({ kind: 'item', item: r.item, reasons: r.reasons, title: r.item.title, why: r.reasons[0] ? `يخص: ${r.reasons[0].interest}` : '', minutes: r.item.type === 'بحث' ? 2 : 1, action: r.item.type === 'بحث' ? 'اقرأ الملخص، ثم احفظه أو تجاهله' : 'اقرأ العنوان والمقدمة' })
    minutes += steps[steps.length - 1].minutes
  }
  const idea = state.ideas.filter((x) => !x.done).sort((a, b) => String(a.updated || '').localeCompare(String(b.updated || '')))[0]
  if (idea && minutes < 5) { steps.push({ kind: 'ideas', rec: idea, title: idea.title, why: 'فكرة تنتظر منذ مدة', minutes: 1, action: 'أضف سطراً واحداً لتطويرها' }); minutes += 1 }
  return { steps, minutes }
}

export function toCsvRows(state, names) {
  const rows = [['النوع', 'العنوان', 'الحالة', 'الموعد', 'المشروع', 'الرابط', 'ملاحظات']]
  const title = (id) => state.projects.find((p) => p.id === id)?.title || ''
  for (const key of COLLECTIONS) for (const x of state[key]) rows.push([names[key], x.title || '', x.status || (x.done ? 'منجز' : ''), x.deadline || x.date || x.eventDate || '', title(x.projectId), x.url || x.sourceUrl || '', x.notes || x.description || ''])
  for (const id of Object.keys(state.saved).filter((k) => state.saved[k])) { const i = state.pinned[id]; if (i) rows.push(['مادة محفوظة', i.title, i.type, i.deadline || '', title(state.links[id]), i.url, state.notes[id] || '']) }
  return rows
}

/** حدث تقويم ICS مع تذكيرين قبل الموعد. */
export function buildIcs({ id, title, date, description = '', url = '', alarms = [3, 1] }) {
  const d = String(date).replaceAll('-', '')
  const esc = (t) => String(t).replace(/[\\;,]/g, (m) => '\\' + m).replace(/\r?\n/g, '\\n')
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Mihwar//AR', 'BEGIN:VEVENT', `UID:${id}@mihwar.dr-alfailakawi.com`, `DTSTAMP:${new Date().toISOString().slice(0, 19).replace(/\D/g, '').replace(/^(\d{8})(\d{6})$/, '$1T$2')}Z`, `DTSTART;VALUE=DATE:${d}`, `SUMMARY:${esc(title)}`]
  if (description) lines.push(`DESCRIPTION:${esc(description)}`)
  if (safeUrl(url)) lines.push(`URL:${safeUrl(url)}`)
  for (const days of alarms) lines.push('BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${esc(title)}`, `TRIGGER:-P${days}D`, 'END:VALARM')
  lines.push('END:VEVENT', 'END:VCALENDAR')
  return lines.join('\r\n')
}
