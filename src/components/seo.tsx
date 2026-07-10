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
    const full = title === site.title ? title : `${title} — د. أحمد الفيلكاوي`
    const desc = description || site.description
    const url = site.url + path
    const img = site.url + (image || site.ogImage)

    document.title = full
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
    setMeta('property', 'og:locale', 'ar_KW')
    setMeta('property', 'og:site_name', site.title)

    setMeta('name', 'twitter:card', 'summary_large_image')
    setMeta('name', 'twitter:title', full)
    setMeta('name', 'twitter:description', desc)
    setMeta('name', 'twitter:image', img)
    setMeta('name', 'twitter:creator', '@drahmadkw')
  }, [title, description, path, type, image, robots])
}

/** بيانات منظّمة — Schema.org */
export function JsonLd({ data }: { data: object }) {
  useEffect(() => {
    const s = document.createElement('script')
    s.type = 'application/ld+json'
    s.text = JSON.stringify(data)
    document.head.appendChild(s)
    return () => { document.head.removeChild(s) }
  }, [data])
  return null
}
