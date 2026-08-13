import { Component, type ErrorInfo, type ReactNode } from 'react'

/*
 * حارسُ العطب: يلتقط أي خطأ في العرض فلا تُظلم الشاشة بيضاء بلا رجعة، بل تظهر
 * صفحةٌ هادئةٌ بهوية الموقع تدعو لإعادة التحميل. صامتٌ تماماً ما لم يقع خطأ.
 * لا يُرسل شيئاً خارج الجهاز؛ يسجّل في الكونسول للتشخيص فقط.
 */
interface State {
  hasError: boolean
}

export default class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { hasError: false }

  static getDerivedStateFromError(): State {
    return { hasError: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // تشخيصٌ محلّي فقط — لا إرسال لأي خدمة
    console.error('[حارس العطب] خطأٌ في العرض:', error, info.componentStack)
  }

  private reload = () => {
    try { sessionStorage.removeItem('chunk-heal') } catch { /* اختياري */ }
    window.location.reload()
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
          background: 'rgb(var(--c-canvas, 252 252 250))',
          color: 'rgb(var(--c-ink, 21 22 26))',
        }}
      >
        <span aria-hidden style={{ fontSize: '2rem', opacity: 0.5 }}>·</span>
        <h1 className="font-display" style={{ fontSize: 'clamp(1.4rem, 4vw, 2rem)', fontWeight: 600, lineHeight: 1.5, margin: 0 }}>
          حدث خللٌ مؤقّت.
        </h1>
        <p style={{ maxWidth: '30rem', fontSize: '.95rem', lineHeight: 1.9, color: 'rgb(var(--c-soft, 94 101 112))', margin: 0 }}>
          نعتذر عن هذا. أعد تحميل الصفحة وسيعود كل شيء إلى مكانه — لم يُفقد شيءٌ من محتواك.
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '.75rem', justifyContent: 'center', marginTop: '.5rem' }}>
          <button
            type="button"
            onClick={this.reload}
            style={{
              borderRadius: '999px',
              border: 'none',
              background: 'rgb(var(--c-accent, 62 92 120))',
              color: '#fff',
              padding: '.7rem 1.6rem',
              fontSize: '.9rem',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            أعد التحميل
          </button>
          <a
            href="/"
            style={{
              borderRadius: '999px',
              border: '1px solid var(--c-hair, rgba(21, 22, 26, .18))',
              color: 'rgb(var(--c-ink, 21 22 26))',
              padding: '.7rem 1.6rem',
              fontSize: '.9rem',
              fontWeight: 600,
              textDecoration: 'none',
            }}
          >
            الصفحة الرئيسية
          </a>
        </div>
      </div>
    )
  }
}
