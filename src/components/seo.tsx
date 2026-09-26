import { useEffect } from 'react'
import { site } from '../data'

function setMeta(attr: 'name' | 'property', key: string, content: string) {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`)
  if (!el) {
    el = document.createElement('meta')
    el.setAttribute(attr, key)
    document.head.appendChild(el)
  }
  el.setAttribute('content', content)
}

function removeDuplicateMeta(attr: 'name' | 'property', key: string) {
  const all = Array.from(document.head.querySelectorAll<HTMLMetaElement>(`meta[${attr}="${key}"]`))
  all.slice(1).forEach((el) => el.remove())
}

function setLink(rel: string, href: string) {
  let el = document.head.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`)
  if (!el) {
    el = document.createElement('link')
    el.setAttribute('rel', rel)
    document.head.appendChild(el)
  }
  el.setAttribute('href', href)
}

/** وسوم SEO + Open Graph لكل صفحة */
export function useSeo({
  title,
  description,
  path = '',
  type = 'website',
  image,
  robots,
}: {
  title: string
  description?: string
  path?: string
  type?: 'website' | 'article'
  image?: string
  robots?: string
}) {
  useEffect(() => {
    const english = path === '/en' || path.startsWith('/en/')
    // لا تُلحق الاسم إن كان العنوان يحمله أصلاً (رئيسية الموقع مثلاً) — يمنع تضاعفه في التبويب
    const hasName = title === site.title || title.includes('د. أحمد حسين الفيلكاوي') || title.includes('Dr. Ahmad H. Alfailakawi')
    const full = hasName ? title : english ? `${title} — Dr. Ahmad H. Alfailakawi` : `${title} — د. أحمد حسين الفيلكاوي`
    const desc = description || site.description
    const url = site.url + path
    const img = image ? (image.startsWith('http') ? image : site.url + image) : `${site.url}/og/canonical-${english ? 'en' : 'ar'}.jpg`

    document.title = full
    // وسوم citation_* المولودة في HTML الساكن تخصّ الصفحة الأولى وحدها؛ عند التنقل
    // داخل التطبيق تُزال حتى لا تنسب برامجُ المراجع (Zotero) صفحةً إلى بحثٍ آخر.
    // الوسوم التي يضيفها useScholarMeta تحمل data-scholar فلا تُمسّ هنا.
    document.head.querySelectorAll('meta[name^="citation_"]:not([data-scholar])').forEach((el) => el.remove())
    ;[
      ['name', 'description'],
      ['name', 'robots'],
      ['property', 'og:title'],
      ['property', 'og:description'],
      ['property', 'og:type'],
      ['property', 'og:url'],
      ['property', 'og:image'],
      ['property', 'og:locale'],
      ['property', 'og:site_name'],
      ['name', 'twitter:card'],
      ['name', 'twitter:title'],
      ['name', 'twitter:description'],
      ['name', 'twitter:image'],
      ['name', 'twitter:creator'],
    ].forEach(([attr, key]) => removeDuplicateMeta(attr as 'name' | 'property', key))

    setMeta('name', 'description', desc)
    if (robots) setMeta('name', 'robots', robots)
    else document.head.querySelector('meta[name="robots"]')?.remove()
    setLink('canonical', url)

    setMeta('property', 'og:title', full)
    setMeta('property', 'og:description', desc)
    setMeta('property', 'og:type', type)
    setMeta('property', 'og:url', url)
    setMeta('property', 'og:image', img)
    setMeta('property', 'og:locale', english ? 'en_US' : 'ar_KW')
    setMeta('property', 'og:site_name', english ? 'Dr. Ahmad H. Alfailakawi' : site.title)

    setMeta('name', 'twitter:card', 'summary_large_image')
    setMeta('name', 'twitter:title', full)
    setMeta('name', 'twitter:description', desc)
    setMeta('name', 'twitter:image', img)
    setMeta('name', 'twitter:creator', '@drahmadkw')

    // تُضاف رموز إثبات الملكية من بيئة البناء فقط؛ لا نثبت رمز حساب داخل المستودع.
    const googleVerification = import.meta.env.VITE_GOOGLE_SITE_VERIFICATION
    const bingVerification = import.meta.env.VITE_BING_SITE_VERIFICATION
    if (googleVerification) setMeta('name', 'google-site-verification', googleVerification)
    if (bingVerification) setMeta('name', 'msvalidate.01', bingVerification)
  }, [title, description, path, type, image, robots])
}

/** وسوم Google Scholar (Highwire) في الصفحة الحية — مطابقة لما يولّده build-static.mjs. */
export function useScholarMeta(tags: Array<[string, string]> | null | undefined) {
  const payload = JSON.stringify(tags || [])
  useEffect(() => {
    const list = JSON.parse(payload) as Array<[string, string]>
    if (!list.length) return
    document.head.querySelectorAll('meta[name^="citation_"]').forEach((el) => el.remove())
    const added = list.map(([name, content]) => {
      const el = document.createElement('meta')
      el.setAttribute('name', name)
      el.setAttribute('content', content)
      el.setAttribute('data-scholar', '')
      document.head.appendChild(el)
      return el
    })
    return () => { added.forEach((el) => el.remove()) }
  }, [payload])
}

/** بيانات منظّمة — Schema.org */
export function JsonLd({ data }: { data: object }) {
  // البيانات تصل كائناً حرفياً جديداً في كل عرض، فنعتمد على نصّها لا على هُويّتها
  // كي لا يُحذف الوسم ويُعاد بناؤه مع كل رسمة.
  const payload = JSON.stringify(data)
  useEffect(() => {
    const s = document.createElement('script')
    s.type = 'application/ld+json'
    s.text = payload
    document.head.appendChild(s)
    // remove() لا ترمي خطأً إن كان الوسم قد أُزيل من قبل — بخلاف removeChild.
    return () => { s.remove() }
  }, [payload])
  return null
}
