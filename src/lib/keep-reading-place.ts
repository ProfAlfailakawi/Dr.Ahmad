import { useEffect } from 'react'
import { bookFlowReveal, isBookFlow } from './book-flow'

/**
 * يحفظ موضع القراءة حين يتغيّر عرض النافذة دون إعادة تحميل:
 * فتح iPhone Duo أو طيّه، أو تبديل Split View، أو تدوير الهاتف.
 *
 * المشكلة من جذرها: المتصفح يحفظ scrollY بالبكسل. حين يضيق العرض من 951 إلى 382
 * يطول النص أضعافاً، فيبقى scrollY كما هو ويجد القارئ نفسه في فقرة أبكر بكثير.
 * والعكس عند الاتساع. لذلك نتذكّر الفقرة التي في أعلى منطقة القراءة ونسبة ما
 * قُرئ منها، ثم بعد إعادة التخطيط نعيد هذه الفقرة نفسها إلى الموضع نفسه.
 *
 * لا يُستعمل screen ولا نوع الجهاز: العرض الفعلي للنافذة وحده هو الحَكَم.
 * التقاط الموضع يتجاهل أحداث التمرير التي يطلقها المتصفح أثناء التحجيم
 * (لأن العرض حينها تغيّر فعلاً)، فلا يُستبدل المرساة الصحيحة بموضع مشوّه.
 */
const BLOCKS = 'p, h2, h3, h4, blockquote, li, figure'

export function useKeepReadingPlace(containerId: string, enabled = true) {
  useEffect(() => {
    if (!enabled || typeof window === 'undefined') return
    let anchor: { el: Element; ratio: number } | null = null
    let width = window.innerWidth
    let frame = 0
    let restoreFrame = 0

    // خط القراءة: تحت الشريط العلوي الثابت.
    const readingLine = () => Math.min(120, window.innerHeight * 0.25)

    const capture = () => {
      frame = 0
      if (window.innerWidth !== width) return
      const body = document.getElementById(containerId)
      if (!body) { anchor = null; return }
      const line = readingLine()
      const flow = body.closest<HTMLElement>('[data-book-flow]')
      if (isBookFlow(flow)) {
        // الكتاب المفتوح: الصفحة الحالية هي أول كتلة تبدأ داخل نافذة التقليب (لا مسافة عمودية).
        const f = flow.getBoundingClientRect()
        const rtl = getComputedStyle(flow).direction === 'rtl'
        for (const el of body.querySelectorAll(BLOCKS)) {
          const r = el.getBoundingClientRect()
          if (!r.height || (rtl ? r.left >= f.right : r.right <= f.left) || (rtl ? r.right <= f.left : r.left >= f.right)) continue
          anchor = { el, ratio: 0 }
          return
        }
        anchor = null
        return
      }
      if (body.getBoundingClientRect().top > line) { anchor = null; return }
      for (const el of body.querySelectorAll(BLOCKS)) {
        const r = el.getBoundingClientRect()
        if (!r.height || r.bottom <= line) continue
        anchor = { el, ratio: Math.min(1, Math.max(0, (line - r.top) / r.height)) }
        return
      }
      anchor = null
    }

    const onScroll = () => { if (!frame) frame = window.requestAnimationFrame(capture) }

    const onResize = () => {
      if (window.innerWidth === width) return
      const saved = anchor
      width = window.innerWidth
      if (restoreFrame) window.cancelAnimationFrame(restoreFrame)
      restoreFrame = window.requestAnimationFrame(() => {
        restoreFrame = 0
        if (!saved || !saved.el.isConnected) { capture(); return }
        // دخلنا الكتاب (أو خرجنا منه): في الكتاب نقلّب إلى الورقة التي فيها الفقرة.
        if (bookFlowReveal(saved.el)) { anchor = saved; return }
        const r = saved.el.getBoundingClientRect()
        const delta = r.top + saved.ratio * r.height - readingLine()
        if (Math.abs(delta) > 2) window.scrollTo({ top: window.scrollY + delta, left: 0, behavior: 'instant' as ScrollBehavior })
        anchor = saved
      })
    }

    capture()
    window.addEventListener('scroll', onScroll, { passive: true, capture: true })
    window.addEventListener('resize', onResize, { passive: true })
    return () => {
      if (frame) window.cancelAnimationFrame(frame)
      if (restoreFrame) window.cancelAnimationFrame(restoreFrame)
      window.removeEventListener('scroll', onScroll, true)
      window.removeEventListener('resize', onResize)
    }
  }, [containerId, enabled])
}
