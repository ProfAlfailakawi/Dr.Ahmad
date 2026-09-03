import { trackUsage } from './usage-analytics'

type VitalName = 'CLS' | 'LCP' | 'INP' | 'TTFB' | 'FCP'
type PlausibleFunction = ((...args: unknown[]) => void) & { q?: unknown[][] }

declare global { interface Window { plausible?: PlausibleFunction } }

type TimedEntry = PerformanceEntry & { duration?: number; hadRecentInput?: boolean; interactionId?: number; value?: number }

const thresholds: Record<Exclude<VitalName, 'TTFB' | 'FCP'>, [number, number]> = {
  CLS: [0.1, 0.25], LCP: [2500, 4000], INP: [200, 500],
}

function rating(name: VitalName, value: number) {
  if (name === 'TTFB') return value <= 800 ? 'good' : value <= 1800 ? 'needs-improvement' : 'poor'
  if (name === 'FCP') return value <= 1800 ? 'good' : value <= 3000 ? 'needs-improvement' : 'poor'
  const [good, poor] = thresholds[name]
  return value <= good ? 'good' : value <= poor ? 'needs-improvement' : 'poor'
}

/** بيانات RUM حقيقية: عينة واحدة لكل مقياس وصفحة عند إخفاء الصفحة أو مغادرتها. */
export function startWebVitalsMonitoring() {
  if (typeof window === 'undefined' || !('PerformanceObserver' in window)) return
  const values: Partial<Record<VitalName, number>> = {}
  const observers: PerformanceObserver[] = []
  let sent = false
  const observe = (type: string, handler: (entry: TimedEntry) => void) => {
    try {
      const observer = new PerformanceObserver((list) => list.getEntries().forEach((entry) => handler(entry as TimedEntry)))
      observer.observe({ type, buffered: true } as PerformanceObserverInit)
      observers.push(observer)
    } catch { /* unsupported metric */ }
  }
  observe('largest-contentful-paint', (entry) => { values.LCP = entry.startTime })
  observe('layout-shift', (entry) => { if (!entry.hadRecentInput) values.CLS = (values.CLS || 0) + Number(entry.value || 0) })
  observe('event', (entry) => { if (entry.interactionId && Number(entry.duration || 0) > Number(values.INP || 0)) values.INP = Number(entry.duration) })
  observe('paint', (entry) => { if (entry.name === 'first-contentful-paint') values.FCP = entry.startTime })
  const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined
  if (navigation) values.TTFB = Math.max(0, navigation.responseStart - navigation.requestStart)

  const flush = () => {
    if (sent) return
    sent = true
    for (const [name, raw] of Object.entries(values) as [VitalName, number][]) {
      const value = name === 'CLS' ? Number(raw.toFixed(3)) : Math.round(raw)
      const grade = rating(name, raw)
      trackUsage('web_vital', { metric: name, value, rating: grade, route: location.pathname })
      window.plausible?.('Web Vital', { props: { metric: name, value, rating: grade, path: location.pathname } })
    }
    observers.forEach((observer) => observer.disconnect())
  }
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flush() })
  window.addEventListener('pagehide', flush, { once: true })
}

export {}
