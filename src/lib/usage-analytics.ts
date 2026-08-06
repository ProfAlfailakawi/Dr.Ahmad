export type PublicUsageEvent =
  | 'atlas_impression' | 'atlas_discovered' | 'atlas_opened' | 'atlas_interaction'
  | 'living_mind_opened' | 'living_mind_started' | 'living_mind_completed' | 'living_mind_failed' | 'living_mind_result_used' | 'living_mind_abandoned'
  | 'search_submitted' | 'search_results_shown' | 'search_zero_results' | 'search_result_opened' | 'search_refined' | 'search_abandoned'
  | 'web_vital'

type EventProps = Record<string, string | number | boolean | null | undefined>
const SESSION_KEY = 'dr-ahmad:anonymous-analytics-session:v1'
const SENT_KEY = 'dr-ahmad:analytics-once:v1'

function sessionId() {
  try {
    const current = sessionStorage.getItem(SESSION_KEY)
    if (current) return current
    const next = crypto.randomUUID()
    sessionStorage.setItem(SESSION_KEY, next)
    return next
  } catch { return `session-${Date.now()}-${Math.random().toString(36).slice(2)}` }
}

function referrerPath() {
  try {
    if (!document.referrer) return ''
    const referrer = new URL(document.referrer)
    return referrer.origin === location.origin ? `${referrer.pathname}${referrer.search}` : 'external'
  } catch { return '' }
}

export function normalizeSearchQuery(value: string) {
  const clean = value.replace(/<[^>]*>/g, ' ').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 160)
  if (/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.test(clean) || /(?:\+?\d[\s().-]*){8,}/.test(clean)) return '[redacted]'
  return clean
}

export function trackUsage(name: PublicUsageEvent, props: EventProps = {}, options: { onceKey?: string } = {}) {
  if (typeof window === 'undefined') return
  if (options.onceKey) {
    try {
      const keys = new Set(JSON.parse(sessionStorage.getItem(SENT_KEY) || '[]') as string[])
      if (keys.has(options.onceKey)) return
      keys.add(options.onceKey)
      sessionStorage.setItem(SENT_KEY, JSON.stringify([...keys].slice(-100)))
    } catch { /* tracking remains best effort */ }
  }
  const payload = JSON.stringify({
    name, sessionId: sessionId(), path: `${location.pathname}${location.search}`,
    referrerPath: referrerPath(), device: matchMedia('(max-width: 767px)').matches ? 'mobile' : 'desktop',
    clientAt: new Date().toISOString(), props,
  })
  if (navigator.sendBeacon && document.visibilityState === 'hidden') {
    navigator.sendBeacon('/api/analytics/event', new Blob([payload], { type: 'application/json' }))
    return
  }
  void fetch('/api/analytics/event', { method: 'POST', headers: { 'content-type': 'application/json' }, body: payload, keepalive: true }).catch(() => undefined)
}
