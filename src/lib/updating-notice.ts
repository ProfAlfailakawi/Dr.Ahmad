/*
 * «الموقع قيد التحديث» داخل الصفحة.
 *
 * أثناء نشر خادم dr-api على Cloud Run تجيب واجهةُ Google الأمامية طلباتِ /api
 * بصفحة HTML إنجليزية (500/502/503/504) لم يكتبها الخادم — هو يجيب /api بـJSON.
 * هنا يُعرف ذلك الجواب فيظهر أسفل الصفحة سطرٌ واحد كقصاصة تصحيح: حوافّ
 * مطبعيّة حادّة وشعرةُ حبرٍ في أعلاه، لا كبسولةٌ عائمة، ويسأل /api/version
 * كل ثلاث ثوانٍ (ويتباطأ إلى خمس عشرة) حتى يعود الخادم فيختفي ويُطلق
 * SERVER_BACK_EVENT على window.
 *
 * لا يغيّر أيَّ جواب: المراقبة وحدها، فكل شاشةٍ تتصرّف كما كانت تتصرّف.
 */

const UPDATING_STATUSES = new Set([500, 502, 503, 504])

export const UPDATING_MESSAGE = 'يُجدَّد الموقع الآن؛ تعود الصفحة وحدها بعد قليل.'
/** يُطلق على window حين يعود الخادم. */
export const SERVER_BACK_EVENT = 'alfailakawi:server-back'
const HEALTH_URL = '/api/version'

/** جوابُ المنصّة لا جوابُ الخادم: 5xx بغير JSON. */
export const isPlatformUpdating = (status: number, contentType: string | null | undefined) =>
  UPDATING_STATUSES.has(status) && !String(contentType || '').includes('application/json')

let notice: HTMLElement | null = null
let installed = false

/** يُظهر الشريطَ مرّةً واحدة مهما تكرّر الطلب، ويخفيه حين يجيب `probe`. */
export function showUpdatingNotice(probe: () => Promise<boolean>): void {
  if (notice || typeof document === 'undefined' || !document.body) return
  const bar = document.createElement('div')
  bar.className = 'updating-notice'
  bar.setAttribute('role', 'status')
  bar.setAttribute('aria-live', 'polite')
  bar.dir = 'rtl'
  bar.textContent = UPDATING_MESSAGE
  bar.style.cssText = [
    'position:fixed', 'inset-inline:16px', 'bottom:max(16px,env(safe-area-inset-bottom))', 'margin:0 auto', 'width:auto', 'max-width:560px',
    'z-index:2147483000', 'padding:10px 16px 11px', 'border-radius:2px', 'font-family:inherit', 'font-size:14px', 'font-weight:500', 'line-height:1.6',
    'background:rgb(var(--c-canvas,252 252 250))', 'color:rgb(var(--c-ink,21 22 26))',
    'border:1px solid var(--c-hair,rgba(21,22,26,.09))', 'border-top:2px solid rgb(var(--c-ink,21 22 26))',
    'box-shadow:0 10px 24px -20px rgba(21,22,26,.45)', 'text-align:start', 'pointer-events:none',
  ].join(';')
  document.body.appendChild(bar)
  notice = bar
  let tries = 0
  const ask = async () => {
    const back = await probe().catch(() => false)
    if (!back) { tries++; window.setTimeout(ask, Math.min(15_000, 3000 * Math.pow(1.3, Math.max(0, tries - 5)))); return }
    bar.remove()
    notice = null
    window.dispatchEvent(new Event(SERVER_BACK_EVENT))
  }
  window.setTimeout(ask, 3000)
}

function isOwnApi(input: RequestInfo | URL): boolean {
  try {
    const raw = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
    const url = new URL(raw, window.location.href)
    return url.origin === window.location.origin && url.pathname.startsWith('/api/')
  } catch { return false }
}

/**
 * يراقب fetch لطلبات /api على الأصل نفسه فقط. لا يلمس طلبات Firebase ولا غيرها،
 * ولا يبدّل الجواب: يمرّره كما هو بعد أن يرى حالته.
 */
export function installUpdatingNotice(): void {
  if (installed || typeof window === 'undefined' || typeof window.fetch !== 'function') return
  installed = true
  const nativeFetch = window.fetch.bind(window)
  const serverAnswers = () => nativeFetch(HEALTH_URL, { cache: 'no-store', credentials: 'same-origin' }).then((response) => response.ok, () => false)
  window.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
    const pending = nativeFetch(input, init)
    if (!isOwnApi(input)) return pending
    return pending.then((response) => {
      if (isPlatformUpdating(response.status, response.headers.get('content-type'))) showUpdatingNotice(serverAnswers)
      return response
    })
  }) as typeof window.fetch
}
