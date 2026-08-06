import { useEffect, useRef, useState } from 'react'
import { IconTooltipPortal } from './IconTooltipPortal'

const STORAGE_PREFIX = 'clarified-icon:'

/**
 * أدوات أيقونية متخصصة قد لا يكفي شكلها وحده لفهم وظيفتها على الهاتف.
 * لا نضع هنا الأوامر العالمية الواضحة: إغلاق، بحث، رجوع، تشغيل، تنزيل، طباعة، مشاركة، نسخ.
 */
const CLARIFICATIONS: Record<string, { id: string; explanation: string }> = {
  'إشارة المقال': { id: 'article-pivot', explanation: 'تكشف موقع فكرة المقال داخل مشروع الكاتب وامتداداتها.' },
  'استشهد بهذا': { id: 'academic-citation', explanation: 'ينشئ الاستشهاد الأكاديمي الجاهز للمادة بصيغ التوثيق المعروفة.' },
  'الاستشهاد المرجعي': { id: 'academic-citation', explanation: 'ينشئ الاستشهاد الأكاديمي الجاهز للمادة بصيغ التوثيق المعروفة.' },
  'عرض الاستشهاد المرجعي': { id: 'academic-citation', explanation: 'يفتح صيغ التوثيق الأكاديمي الجاهزة للنسخ.' },
  'اصنع بطاقة اقتباس': { id: 'quote-card', explanation: 'يحوّل الاقتباس إلى بطاقة بصرية جاهزة للحفظ والمشاركة.' },
  'صناعة بطاقة اقتباس': { id: 'quote-card', explanation: 'يحوّل الاقتباس إلى بطاقة بصرية جاهزة للحفظ والمشاركة.' },
  'تتبّع الفكرة عبر السنوات': { id: 'idea-timeline', explanation: 'يتتبّع كيف ظهرت الفكرة وتطورت في مواد الكاتب عبر السنوات.' },
  'حياة الفكرة': { id: 'idea-life', explanation: 'يعرض رحلة الفكرة واعتراضاتها وتحولاتها وصلاتها داخل الأرشيف.' },
  'بصمة القارئ': { id: 'reader-fingerprint', explanation: 'يعرض الأثر القرائي الذي تكوّن من تفاعلك مع مواد الموقع.' },
  'أدوات القراءة': { id: 'reader-tools', explanation: 'يفتح أدوات القراءة المساندة من حفظ واقتباس ومظهر وتنقّل.' },
  'مظهر القراءة': { id: 'reading-appearance', explanation: 'يغيّر خلفية القراءة وهدوءها بما يلائم العين.' },
  'إعدادات وضع السكينة': { id: 'serenity-settings', explanation: 'يضبط تجربة القراءة الهادئة ويقلل العناصر المحيطة.' },
  'مواد الباب': { id: 'door-materials', explanation: 'يفتح مواد التدريس والعرض المرتبطة بهذا الباب من الموسوعة.' },
  'مواد التدريس': { id: 'door-materials', explanation: 'يفتح الشرائح ومواد التدريس المرتبطة بالموضوع.' },
  'ابحث في هذا الكتاب': { id: 'search-inside-book', explanation: 'ينقل البحث إلى متن هذا الكتاب وحده بدل البحث في الموقع كله.' },
  'فهم محرك البحث وصياغاته المقترحة': { id: 'search-help', explanation: 'يشرح أنواع البحث والصياغات التي تعطي نتائج أدق.' },
  'فتح لوحة الأوامر': { id: 'command-palette', explanation: 'يفتح لوحة سريعة للوصول إلى أوامر الإدارة من مكان واحد.' },
  'خريطة المقالات': { id: 'article-atlas', explanation: 'تعرض المقالات كخريطة مترابطة بحسب الأفكار والموضوعات.' },
  'فتح مساحتي': { id: 'my-space', explanation: 'يفتح مساحتك المحلية للمحفوظات وسجل القراءة والمزامنة.' },
  'نسخ رمز المزامنة': { id: 'sync-code', explanation: 'ينسخ رمزاً خاصاً لنقل محفوظاتك إلى جهاز آخر.' },
  'مشاركة المقال والاستشهاد به': { id: 'article-share-cite', explanation: 'يفتح أدوات مشاركة المقال والاستشهاد الأكاديمي به.' },
}

function isTouchLike() {
  return window.matchMedia?.('(hover: none), (pointer: coarse)').matches ?? false
}

function storageHas(key: string) {
  try { return window.localStorage.getItem(`${STORAGE_PREFIX}${key}`) === '1' } catch { return false }
}

function storageMark(key: string) {
  try { window.localStorage.setItem(`${STORAGE_PREFIX}${key}`, '1') } catch { /* الخصوصية الصارمة: يبقى السلوك سليماً ولو لم يُحفَظ */ }
}

function visibleText(element: HTMLElement) {
  return (element.innerText || '').replace(/\s+/g, ' ').trim()
}

export function SitewideIconClarifications() {
  const [active, setActive] = useState<{ el: HTMLElement; explanation: string } | null>(null)
  const timerRef = useRef<number | null>(null)

  useEffect(() => {
    const close = () => {
      if (timerRef.current) window.clearTimeout(timerRef.current)
      timerRef.current = null
      setActive(null)
    }

    const onClick = (event: MouseEvent) => {
      if (!isTouchLike()) return
      const target = event.target
      if (!(target instanceof Element)) return
      const control = target.closest<HTMLElement>('button, a[href], [role="button"]')
      if (!control || control.closest('[data-clarified-icon="true"]')) return

      // الأزرار التي تحمل نصاً ظاهراً لا تحتاج درساً للأيقونة.
      if (visibleText(control).length > 1) return
      const label = (control.getAttribute('aria-label') || control.getAttribute('title') || '').trim()
      const clarification = CLARIFICATIONS[label]
      if (!clarification || storageHas(clarification.id)) return

      event.preventDefault()
      event.stopPropagation()
      event.stopImmediatePropagation()
      storageMark(clarification.id)

      setActive({ el: control, explanation: clarification.explanation })
      if (timerRef.current) window.clearTimeout(timerRef.current)
      timerRef.current = window.setTimeout(close, 4800)
    }

    document.addEventListener('click', onClick, true)
    window.addEventListener('scroll', close, { passive: true })
    window.addEventListener('resize', close)
    return () => {
      document.removeEventListener('click', onClick, true)
      window.removeEventListener('scroll', close)
      window.removeEventListener('resize', close)
      if (timerRef.current) window.clearTimeout(timerRef.current)
    }
  }, [])

  if (!active) return null
  return <IconTooltipPortal targetEl={active.el} label={active.explanation} />
}
