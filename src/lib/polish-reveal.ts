/**
 * ظهورٌ هادئ للبطاقات والصفوف — مرةً واحدة لكل عنصر.
 * يضيف الصنف `polish-in` (حركة opacity/translate بملء backwards) حين يدخل العنصر
 * الشاشة؛ لا يخفي شيئاً قبل ذلك، فتعطّل هذا الملف أو IntersectionObserver لا يُسقط محتوى.
 * يتخطّى: تقليل الحركة، وضع الصمت، متن القراءة الطويل، الجداول والنماذج، لوحة الإدارة،
 * وما له حركةٌ خاصة أصلاً. أقصى ٨ عناصر متتابعة لكل دفعة.
 */
const TARGET = 'main :is(.grid, ul, ol) > :is(a, li, article)'
const SKIP_INSIDE = [
  '.spatial-collection', '[data-draw]', '.admin-shell', '.monteur-root', '[data-panel]',
  'table', 'form', '[role="tablist"]', '[data-no-motion]', '.article-body', '.reader-prose',
  '.human-core', '[data-swipe-rail]',
].join(',')
const MAX_STAGGER = 8

export function installPolishReveal(): void {
  if (typeof window === 'undefined' || typeof IntersectionObserver === 'undefined') return
  const root = document.documentElement
  const seen = new WeakSet<Element>()
  let frame = 0
  let batch = 0
  let batchTimer = 0

  const io = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue
      io.unobserve(entry.target)
      const el = entry.target as HTMLElement
      el.style.setProperty('--polish-n', String(Math.min(batch++, MAX_STAGGER - 1)))
      el.classList.add('polish-in')
      el.addEventListener('animationend', () => el.classList.remove('polish-in'), { once: true })
    }
    window.clearTimeout(batchTimer)
    batchTimer = window.setTimeout(() => { batch = 0 }, 120)
  }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' })

  const scan = () => {
    frame = 0
    if (matchMedia('(prefers-reduced-motion: reduce)').matches || root.classList.contains('site-silent')) return
    document.querySelectorAll(TARGET).forEach((el) => {
      if (seen.has(el)) return
      seen.add(el)
      if (el.closest(SKIP_INSIDE)) return
      const style = getComputedStyle(el)
      if (style.animationName !== 'none' || style.opacity !== '1') return
      io.observe(el)
    })
  }
  const schedule = () => { if (!frame) frame = requestAnimationFrame(scan) }
  new MutationObserver(schedule).observe(document.body, { childList: true, subtree: true })
  schedule()
}
