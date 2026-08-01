type VitalName = 'CLS' | 'LCP' | 'INP'
type PlausibleFunction = ((...args: unknown[]) => void) & { q?: unknown[][] }

declare global {
  interface Window {
    plausible?: PlausibleFunction
  }
}

type TimedEntry = PerformanceEntry & {
  duration?: number
  hadRecentInput?: boolean
  interactionId?: number
  value?: number
}

const thresholds: Record<VitalName, [number, number]> = {
  CLS: [0.1, 0.25],
  LCP: [2500, 4000],
  INP: [200, 500],
}

function rating(name: VitalName, value: number) {
  const [good, poor] = thresholds[name]
  return value <= good ? 'good' : value <= poor ? 'needs-improvement' : 'poor'
}

/** يرسل المقاييس الحقيقية من أجهزة الزوار إلى Plausible كأحداث بلا كوكيز. */
export function startWebVitalsMonitoring() {
  if (!('PerformanceObserver' in window) || !window.plausible) return

  const values: Partial<Record<VitalName, number>> = {}
  const observers: PerformanceObserver[] = []
  let sent = false

  const observe = (type: string, handler: (entry: TimedEntry) => void) => {
    try {
      const observer = new PerformanceObserver((list) => list.getEntries().forEach((entry) => handler(entry as TimedEntry)))
      observer.observe({ type, buffered: true } as PerformanceObserverInit)
      observers.push(observer)
    } catch { /* المتصفح لا يدعم هذا المقياس */ }
  }

  observe('largest-contentful-paint', (entry) => { values.LCP = entry.startTime })
  observe('layout-shift', (entry) => {
    if (!entry.hadRecentInput) values.CLS = (values.CLS || 0) + Number(entry.value || 0)
  })
  observe('event', (entry) => {
    if (entry.interactionId && Number(entry.duration || 0) > Number(values.INP || 0)) values.INP = Number(entry.duration)
  })

  const flush = () => {
    if (sent || !window.plausible) return
    sent = true
    for (const [name, raw] of Object.entries(values) as [VitalName, number][]) {
      const value = name === 'CLS' ? Number(raw.toFixed(3)) : Math.round(raw)
      window.plausible('Web Vital', {
        props: { metric: name, value, rating: rating(name, raw), path: location.pathname },
      })
    }
    observers.forEach((observer) => observer.disconnect())
  }

  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flush() }, { once: true })
  window.addEventListener('pagehide', flush, { once: true })
}

export {}
