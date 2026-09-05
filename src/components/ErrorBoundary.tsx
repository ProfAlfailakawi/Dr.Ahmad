import { Component, type ErrorInfo, type ReactNode } from 'react'

/*
 * حارسُ العطب: يلتقط أي خطأ في العرض فلا تُظلم الشاشة بيضاء بلا رجعة، بل تظهر
 * صفحةٌ هادئةٌ بهوية الموقع تدعو لإعادة التحميل. صامتٌ تماماً ما لم يقع خطأ.
 * لا يُرسل شيئاً خارج الجهاز؛ يسجّل في الكونسول للتشخيص فقط.
 *
 * وفيه شفاءٌ ذاتي: أكثر أعطال ما بعد النشر سببها حزمةٌ قديمة بقيت في كاش
 * المتصفح أو في خدمة العمل، فيطلب الهيكلُ الجديد ملفاً اختفى اسمه. في هذه
 * الحالة نُفرغ الكاش ونُلغي تسجيل خدمة العمل ونُعيد التحميل مرة واحدة، فيعود
 * الموقع من تلقاء نفسه بلا تدخّل من الزائر.
 */
interface State {
  hasError: boolean
  detail: string
  healing: boolean
}

const HEAL_KEY = 'chunk-heal'

/** رسائل فشل تحميل الحزم في كروم وسفاري وفَيَرفُكس. */
export function isStaleBundleError(message: string) {
  if (/dynamically imported module|module script failed|error loading dynamically|chunkloaderror/i.test(message)) return true
  // «فشل التحميل» وحدها قد تكون انقطاع شبكة عادياً، فلا نُفرغ الكاش إلا إن
  // صاحبها ذكرُ حزمةٍ أو نصٍّ برمجي، أو ردٌّ HTML مكان ملف JS بعد نشرةٍ جديدة.
  if (/failed to fetch|load failed/i.test(message)) return /\.js\b|module|script|import|chunk|assets\//i.test(message)
  return /unexpected token '<'|expected expression, got '<'/i.test(message)
}

/** يُفرغ كل كاشات الموقع ويُلغي خدمات العمل ثم يعيد التحميل مرة واحدة. */
export async function healStaleBundles() {
  try {
    if ('serviceWorker' in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations()
      await Promise.all(registrations.map((registration) => registration.unregister().catch(() => false)))
    }
  } catch { /* الشفاء أفضل جهد */ }
  try {
    if ('caches' in window) {
      const keys = await caches.keys()
      await Promise.all(keys.map((key) => caches.delete(key).catch(() => false)))
    }
  } catch { /* الشفاء أفضل جهد */ }
  window.location.reload()
}

export default class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { hasError: false, detail: '', healing: false }

  static getDerivedStateFromError(error: Error): State {
    const message = String(error?.message || error || '')
    return { hasError: true, detail: message, healing: isStaleBundleError(message) }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // تشخيصٌ محلّي فقط — لا إرسال لأي خدمة
    console.error('[حارس العطب] خطأٌ في العرض:', error, info.componentStack)
    if (!isStaleBundleError(String(error?.message || ''))) return
    let healedBefore = false
    try { healedBefore = sessionStorage.getItem(HEAL_KEY) === '1' } catch { /* اختياري */ }
    if (healedBefore) {
      this.setState({ healing: false })
      return
    }
    try { sessionStorage.setItem(HEAL_KEY, '1') } catch { /* اختياري */ }
    void healStaleBundles()
  }

  private reload = () => {
    try { sessionStorage.removeItem(HEAL_KEY) } catch { /* اختياري */ }
    window.location.reload()
  }

  private hardReload = () => {
    try { sessionStorage.removeItem(HEAL_KEY) } catch { /* اختياري */ }
    void healStaleBundles()
  }

  render() {
    if (!this.state.hasError) return this.props.children
    return (
      <div
        dir="rtl"
        role="alert"
        style={{
          minHeight: '100svh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '1.25rem',
          padding: '2rem',
          textAlign: 'center',
          // ألوانٌ صريحة لا تتبع التوكنات: صفحة العطب قد تظهر قبل تحميل الأنماط.
          background: '#fcfcfa',
          color: '#15161a',
        }}
      >
        <span aria-hidden style={{ fontSize: '2rem', opacity: 0.5 }}>·</span>
        <h1 className="font-display" style={{ fontSize: 'clamp(1.4rem, 4vw, 2rem)', fontWeight: 600, lineHeight: 1.5, margin: 0 }}>
          {this.state.healing ? 'نُحدّث نسخة الموقع…' : 'حدث خللٌ مؤقّت.'}
        </h1>
        <p style={{ maxWidth: '30rem', fontSize: '.95rem', lineHeight: 1.9, color: '#5e6570', margin: 0 }}>
          {this.state.healing
            ? 'وصلتك نسخةٌ قديمة من الملفات. نُفرغها الآن وتعود الصفحة وحدها بعد لحظة — لم يُفقد شيءٌ من محتواك.'
            : 'نعتذر عن هذا. أعد تحميل الصفحة وسيعود كل شيء إلى مكانه — لم يُفقد شيءٌ من محتواك.'}
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '.75rem', justifyContent: 'center', marginTop: '.5rem' }}>
          <button
            type="button"
            onClick={this.reload}
            style={{
              borderRadius: '999px',
              border: 'none',
              background: '#3e5c78',
              color: '#fff',
              padding: '.7rem 1.6rem',
              fontSize: '.9rem',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            أعد التحميل
          </button>
          <button
            type="button"
            onClick={this.hardReload}
            style={{
              borderRadius: '999px',
              border: '1px solid rgba(21, 22, 26, .18)',
              background: 'transparent',
              color: '#15161a',
              padding: '.7rem 1.6rem',
              fontSize: '.9rem',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            أفرغ الذاكرة وأعد التحميل
          </button>
          <a
            href="/"
            style={{
              borderRadius: '999px',
              border: '1px solid rgba(21, 22, 26, .18)',
              color: '#15161a',
              padding: '.7rem 1.6rem',
              fontSize: '.9rem',
              fontWeight: 600,
              textDecoration: 'none',
            }}
          >
            الصفحة الرئيسية
          </a>
        </div>
        {this.state.detail ? (
          <p
            dir="ltr"
            style={{
              maxWidth: '38rem',
              margin: '1rem 0 0',
              fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
              fontSize: '.72rem',
              lineHeight: 1.7,
              color: '#8b909a',
              wordBreak: 'break-word',
            }}
          >
            {this.state.detail.slice(0, 300)}
          </p>
        ) : null}
      </div>
    )
  }
}
