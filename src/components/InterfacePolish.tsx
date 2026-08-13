import { useEffect } from 'react'
import { useLocation } from 'react-router'
import './interface-polish.css'

/* ═══════════════════════════════════════════════════════════════════
   تلميع الواجهة — حارسان عامّان على غرار MobileCardRailGuard:
   لا يلمسان متن أيّ صفحة، ويعملان على الحاضنات المشتركة وحدها.

   ١) هيكل الانتظار: لمعةٌ تملأ إطار الصورة حتى تصل الصورة.
   ٢) تتابع الظهور: بنود القوائم ترتفع تباعاً عند دخولها الشاشة.

   ★ قاعدة الفشل في كليهما واحدة: **لا حالةَ إخفاءٍ في هذا الملف أصلاً.**
   الهيكل طبقةٌ تُضاف فوق الإطار وتُنزع، والتتابع حركةٌ تنتهي عند الظهور
   دائماً بـboth. فأسوأ ما يقع عند تعطّل المنطق كلّه أن تفوت الحركة —
   لا أن يغيب المحتوى. (سابقة محطّات «مسار الفكرة» التي بقيت opacity:0
   للأبد لأن المراقب لم يرَ قائمةً رُكِّبت بعد وصول البيانات؛ وقد علقت
   الصيغةُ الأولى من هذا الملف عند opacity:0 مرتين أثناء الفحص.)
   ═══════════════════════════════════════════════════════════════════ */

const FRAME_SELECTOR = '.spatial-media'
const COLLECTION_SELECTOR = '.spatial-collection'

/* أقصى تأخيرٍ تراكمي: بعد البند الثامن يتساوى الجميع، فقائمةُ خمسين
   بنداً لا تستغرق ثلاث ثوانٍ حتى تكتمل. */
const STAGGER_CAP = 8

/* حزام أمانٍ للّمعة: لو لم يصل حدث تحميلٍ ولا خطأ (صورةٌ نُزعت من
   الشجرة، أو شبكةٌ معلّقة) يُرفع الهيكل بعد هذه المدة. رمادٌ عارٍ
   أهون من لمعةٍ لا تنتهي. */
const SKELETON_MAX_MS = 6000

function prefersReducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/* ─────────────────────────── ١) هيكل الانتظار ─────────────────────── */
export function MediaSkeletonGuard() {
  const location = useLocation()

  useEffect(() => {
    const tracked = new Map<HTMLElement, () => void>()

    const dressFrame = (frame: HTMLElement) => {
      if (tracked.has(frame)) return
      const image = frame.querySelector('img')
      if (!image) return
      /* الصورة المخزّنة في المتصفح تصل قبل أن نبدأ: لا لمعة أصلاً. */
      if (image.complete && image.naturalWidth > 0) return

      const skeleton = document.createElement('span')
      skeleton.className = 'polish-skeleton'
      skeleton.setAttribute('aria-hidden', 'true')
      frame.prepend(skeleton)

      let removalTimer = 0
      let settled = false

      const lift = () => {
        if (settled) return
        settled = true
        window.clearTimeout(removalTimer)
        skeleton.classList.add('is-leaving')
        removalTimer = window.setTimeout(() => skeleton.remove(), 360)
        image.removeEventListener('load', lift)
        image.removeEventListener('error', lift)
        tracked.delete(frame)
      }

      image.addEventListener('load', lift)
      image.addEventListener('error', lift)
      const guard = window.setTimeout(lift, SKELETON_MAX_MS)

      tracked.set(frame, () => {
        window.clearTimeout(guard)
        window.clearTimeout(removalTimer)
        image.removeEventListener('load', lift)
        image.removeEventListener('error', lift)
        skeleton.remove()
      })
    }

    const sweep = () => {
      for (const frame of document.querySelectorAll<HTMLElement>(FRAME_SELECTOR)) dressFrame(frame)
    }

    sweep()

    /* البطاقات تصل بعد البيانات لا مع الهيكل، فالمسح مرةً واحدة لا يكفي. */
    const observer = new MutationObserver(() => sweep())
    observer.observe(document.body, { childList: true, subtree: true })

    return () => {
      observer.disconnect()
      for (const cleanup of tracked.values()) cleanup()
      tracked.clear()
    }
  }, [location.pathname])

  return null
}

/* ─────────────────────────── ٢) تتابع الظهور ──────────────────────── */
export function StaggerRevealGuard() {
  const location = useLocation()

  useEffect(() => {
    if (prefersReducedMotion()) return
    if (typeof IntersectionObserver === 'undefined') return

    /* «in» = شغّل الحركة. و«skip» = مرّ من هنا ولا حركة (كان داخل الشاشة
       أصلاً، فالحركة عليه ومضةٌ لا وصول). كلتاهما حالة ظهورٍ لا إخفاء. */
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue
        const collection = entry.target as HTMLElement
        observer.unobserve(collection)
        if (!collection.dataset.polishStagger) collection.dataset.polishStagger = 'in'
      }
    }, { threshold: 0, rootMargin: '0px 0px -4% 0px' })

    const watched = new Set<HTMLElement>()

    const prepare = (collection: HTMLElement) => {
      if (collection.dataset.polishStagger || watched.has(collection)) return

      const children = Array.from(collection.children).filter(
        (node): node is HTMLElement => node instanceof HTMLElement,
      )
      /* بندٌ واحد ليس تتابعاً. */
      if (children.length < 2) return

      /* تخطيطٌ لم يستقرّ بعد: لا نحكم على موضعٍ كاذب، ونتركه لطفرةٍ تالية
         أو لتغيّر مقاس. الحكم المبكّر كان يكشف كلّ حاضنة فوراً فيضيع
         التتابع من أصله. */
      const rect = collection.getBoundingClientRect()
      if (rect.height < 1) return

      children.forEach((child, index) => {
        child.style.setProperty('--polish-i', String(Math.min(index, STAGGER_CAP)))
      })

      /* ما هو داخل الشاشة أو فوقها الآن: لا حركة له. الحركة للقادم من
         تحت الطيّة وحده — وهو موضع التتابع الصحيح. */
      if (window.innerHeight > 0 && rect.top < window.innerHeight) {
        collection.dataset.polishStagger = 'skip'
        return
      }

      watched.add(collection)
      observer.observe(collection)
    }

    const sweep = () => {
      for (const collection of document.querySelectorAll<HTMLElement>(COLLECTION_SELECTOR)) prepare(collection)
    }

    sweep()

    /* البطاقات تصل بعد البيانات، والمقاس قد يتغيّر بعد أن تكون نافذةٌ
       بلا ارتفاع قد أفشلت قياس أول مسح. فالمسح يتكرّر على الحدثين. */
    const mutations = new MutationObserver(() => sweep())
    mutations.observe(document.body, { childList: true, subtree: true })
    window.addEventListener('resize', sweep, { passive: true })

    return () => {
      mutations.disconnect()
      observer.disconnect()
      window.removeEventListener('resize', sweep)
      watched.clear()
    }
  }, [location.pathname])

  return null
}
