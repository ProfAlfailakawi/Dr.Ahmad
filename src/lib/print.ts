type PrintOptions = {
  selector?: string
  title?: string
  beforePrint?: () => void
  afterPrint?: () => void
}

const escapeHtml = (value = '') => value
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#039;')

const mobileLike = () => {
  if (typeof window === 'undefined') return false
  return window.matchMedia('(max-width: 820px), (pointer: coarse)').matches
}

/**
 * الطباعة على الهاتف لا تعتمد على نافذة الصفحة الحالية وحدها: بعض إصدارات
 * Safari تتعامل مع print() من الصفحات الطويلة/الطبقات العائمة بشكل غير ثابت.
 * لذلك نفتح، من نفس ضغطة المستخدم، ورقة طباعة نظيفة في تبويب مستقل ونبقي فيها
 * زر «طباعة / حفظ PDF» ظاهراً إن لم يفتح الحوار الآلي. الكمبيوتر يبقى على
 * window.print() الأصلي حتى لا نغيّر سلوكه المعتاد.
 */
export function printSiteContent({ selector = '#main', title = document.title, beforePrint, afterPrint }: PrintOptions = {}) {
  beforePrint?.()

  if (!mobileLike()) {
    if (afterPrint) window.addEventListener('afterprint', afterPrint, { once: true })
    window.print()
    return true
  }

  const source = document.querySelector<HTMLElement>(selector)
  if (!source) {
    if (afterPrint) window.addEventListener('afterprint', afterPrint, { once: true })
    window.print()
    return false
  }

  const popup = window.open('', '_blank')
  if (!popup) {
    if (afterPrint) window.addEventListener('afterprint', afterPrint, { once: true })
    window.print()
    return false
  }

  const styles = Array.from(document.querySelectorAll<HTMLLinkElement | HTMLStyleElement>('link[rel="stylesheet"], style'))
    .map((node) => node.outerHTML)
    .join('\n')
  const dir = document.documentElement.dir || 'rtl'
  const lang = document.documentElement.lang || 'ar'
  const bodyClass = document.body.className || ''

  popup.document.open()
  popup.document.write(`<!doctype html><html lang="${escapeHtml(lang)}" dir="${escapeHtml(dir)}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><base href="${escapeHtml(location.origin)}/"><title>${escapeHtml(title)}</title>${styles}<style>
    html,body{background:#fff!important;min-height:100%;}
    body{margin:0!important;padding:18px!important;}
    .mobile-print-toolbar{position:sticky;top:8px;z-index:9999;display:flex;justify-content:center;margin:0 0 18px;}
    .mobile-print-toolbar button{min-height:46px;border:1px solid #3e5c78;border-radius:999px;background:#3e5c78;color:#fff;padding:10px 18px;font:700 14px/1.2 -apple-system,BlinkMacSystemFont,"Segoe UI",Tahoma,Arial,sans-serif;}
    .mobile-print-sheet{max-width:980px;margin:0 auto;}
    @media print{body{padding:0!important}.mobile-print-toolbar{display:none!important}.mobile-print-sheet{max-width:none!important;margin:0!important}}
  </style></head><body class="${escapeHtml(bodyClass)}"><div class="mobile-print-toolbar"><button type="button" onclick="window.print()">طباعة / حفظ PDF</button></div><div class="mobile-print-sheet">${source.outerHTML}</div><script>
    addEventListener('load',()=>setTimeout(()=>{try{window.print()}catch(e){}},220));
    /* لا نغلق المعاينة تلقائياً على الهاتف: Safari قد يطلق afterprint حتى
       عند إلغاء الحوار، وبقاء الورقة يضمن أن زر الطباعة اليدوي يظل متاحاً. */
  <\/script></body></html>`)
  popup.document.close()
  try { popup.opener = null } catch { /* same-origin preview remains safe without this hardening */ }
  afterPrint?.()
  return true
}
