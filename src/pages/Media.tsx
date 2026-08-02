import { useEffect, useMemo, useState } from 'react'
import { useSeo } from '../components/seo'
import { motion, useReducedMotion } from 'framer-motion'
import { EASE, FadeUp, Page, PageHead } from '../components/ui'
import { useCmsContent } from '../lib/content'
import type { MediaRecord } from '../lib/cms'
import { Pagination, usePagedList } from '../components/Pagination'
import { Link } from 'react-router'
import { MediaSaveButton } from '../components/MySpace'
import { SPACE_EVENT, savedMediaSlugs } from '../lib/reading-space'

const id = (url: string) => (url.match(/(?:v=|youtu\.be\/|shorts\/|embed\/)([\w-]{6,})/) || [])[1] || ''
const mediaCount = (count: number) => {
  if (count === 1) return 'لقاء واحد'
  if (count === 2) return 'لقاءان'
  return `${count} لقاءات`
}

export default function Media() {
  const { media } = useCmsContent()
  const reduce = useReducedMotion()

  /* توحيد اللقاء المكرر (مقترح معتمد): الفيديو نفسه يظهر مرة واحدة */
  const uniqueMedia = useMemo(() => {
    const seen = new Set<string>()
    return media.filter((item) => {
      const key = id(item.url || '') || item.url || item.slug
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
  }, [media])

  const [year, setYear] = useState('الكل')
  const [outlet, setOutlet] = useState('الكل')
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [watchLater, setWatchLater] = useState<string[]>(() => typeof window === 'undefined' ? [] : savedMediaSlugs())

  useEffect(() => {
    const sync = () => setWatchLater(savedMediaSlugs())
    sync()
    window.addEventListener(SPACE_EVENT, sync)
    window.addEventListener('storage', sync)
    return () => {
      window.removeEventListener(SPACE_EVENT, sync)
      window.removeEventListener('storage', sync)
    }
  }, [])

  const years = useMemo(() => Array.from(new Set(uniqueMedia.map((item) => (item.iso || '').slice(0, 4)).filter(Boolean))).sort((a, b) => b.localeCompare(a)), [uniqueMedia])
  const outlets = useMemo(() => Array.from(new Set(uniqueMedia.map((item) => item.outlet).filter(Boolean))).sort((a, b) => a.localeCompare(b, 'ar')), [uniqueMedia])

  const filtered = useMemo(() => uniqueMedia
    .filter((item) => year === 'الكل' || (item.iso || '').startsWith(year))
    .filter((item) => outlet === 'الكل' || item.outlet === outlet), [uniqueMedia, year, outlet])

  /* مادة مختارة تتقدم الصف — تتبدل يومياً بتنويع الجهات (مقترح معتمد) */
  const featured = useMemo(() => {
    if (year !== 'الكل' || outlet !== 'الكل' || filtered.length < 3) return null
    const dayIndex = Math.floor(Date.now() / 86400000)
    const byOutlet = new Map<string, MediaRecord[]>()
    for (const item of filtered) {
      const list = byOutlet.get(item.outlet) || []
      list.push(item)
      byOutlet.set(item.outlet, list)
    }
    const outletsList = [...byOutlet.keys()]
    const chosenOutlet = outletsList[dayIndex % outletsList.length]
    const pool = byOutlet.get(chosenOutlet) || filtered
    return pool[dayIndex % pool.length] || null
  }, [filtered, year, outlet])

  const rest = useMemo(() => featured ? filtered.filter((item) => item.slug !== featured.slug) : filtered, [filtered, featured])
  const savedItems = useMemo(() => uniqueMedia.filter((item) => watchLater.includes(item.slug)), [uniqueMedia, watchLater])

  const paged = usePagedList(rest, 12, `${year}|${outlet}|${rest.length}`)
  const count = mediaCount(uniqueMedia.length)
  useSeo({ title: 'الظهور الإعلامي', path: '/media', description: `${count} تلفزيونياً وإذاعياً.` })

  const filtersActive = year !== 'الكل' || outlet !== 'الكل'

  const Card = ({ m, index, large = false }: { m: MediaRecord; index: number; large?: boolean }) => {
    const videoUrl = m.url || ''
    const videoId = id(videoUrl)
    return (
      <motion.div
        initial={reduce ? false : { opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true, amount: 0.2 }}
        transition={{ duration: 0.7, delay: Math.min(index * 0.06, 0.3), ease: EASE }}
        className={`group relative overflow-hidden rounded-2xl border bg-canvas transition-colors duration-300 hover:border-accent ${large ? 'border-accent/40 md:col-span-2' : 'border-hair'}`}
      >
        <Link
          to={`/media/${m.slug}`}
          data-hover
          className="block"
        >
          <div className="relative overflow-hidden bg-wash" style={{ aspectRatio: large ? '21 / 9' : '16 / 9' }}>
            {videoId && (
              <img
                src={m.thumbnail || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`}
                alt={m.title}
                loading="lazy"
                decoding="async"
                width={480}
                height={270}
                onLoad={(event) => {
                  const img = event.currentTarget
                  if (!m.thumbnail && img.naturalWidth <= 120 && !img.dataset.fallback) {
                    img.dataset.fallback = '1'
                    img.src = `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`
                  }
                }}
                onError={(event) => {
                  const img = event.currentTarget
                  if (!img.dataset.fallback) {
                    img.dataset.fallback = '1'
                    img.src = `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`
                  } else {
                    img.style.display = 'none'
                  }
                }}
                className="h-full w-full object-cover"
              />
            )}
            <span className="absolute inset-0 bg-ink/10" />
            <span className="absolute left-1/2 top-1/2 flex h-14 w-14 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-white/80 bg-ink/40 text-[1rem] text-white">
              ▶
            </span>
            {large && <span className="absolute right-4 top-4 rounded-full bg-accent px-3 py-1 text-[.7rem] font-bold text-white">مختارة اليوم</span>}
          </div>
          <div className="p-6">
            <div className="flex flex-wrap items-center justify-between gap-2 text-[.74rem]">
              <span className="font-semibold text-accent">{m.program || m.outlet || 'ظهور إعلامي'}</span>
              <span className="flex items-center gap-2 text-soft">{m.duration && <span dir="ltr">{m.duration}</span>}{m.date && <time>{m.date}</time>}</span>
            </div>
            <h2 className={`mt-2 font-medium leading-[1.6] text-ink ${large ? 'font-display text-[1.25rem]' : 'text-[1.05rem]'}`}>{m.title}</h2>
            {m.topics && <p className="mt-2 line-clamp-2 text-[.76rem] leading-relaxed text-soft">{m.topics}</p>}
          </div>
        </Link>
        {/* القائمة نفسها تظهر داخل «مساحتي» وفي صفحة اللقاء، بلا تكرار تخزين. */}
        <MediaSaveButton slug={m.slug} className="absolute left-4 top-4 border-white/70 shadow-sm backdrop-blur" />
      </motion.div>
    )
  }

  return (
    <Page className="content-media page-journey">
      <PageHead
        label="الظهور الإعلامي"
        title="لقاءات تتجاوز الشاشة."
        sub="لقاءاتي الإذاعية والتلفزيونية كاملة داخل الموقع، حيث يتحوّل الحوار إلى منصة للفكر."
      />

      <section className="px-6 py-14 md:px-11 md:py-16">
        <div className="mx-auto max-w-shell">
          {/* الفلاتر مغلقة افتراضياً (مقترح معتمد): السنة والجهة */}
          <FadeUp>
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-hair pb-5">
              <button
                type="button"
                onClick={() => setFiltersOpen((value) => !value)}
                aria-expanded={filtersOpen}
                className="text-[.82rem] font-semibold text-soft transition-colors hover:text-accent"
              >
                {filtersOpen ? 'إخفاء الفلاتر ▴' : `الفلاتر ▾${filtersActive ? ' · مفعّلة' : ''}`}
              </button>
              {savedItems.length > 0 && (
                <span className="text-[.78rem] text-soft">قائمتك للمشاهدة: {savedItems.length}</span>
              )}
            </div>
            {filtersOpen && (
              <div className="border-b border-hair py-4">
                <div className="flex flex-wrap gap-x-5 gap-y-2">
                  {['الكل', ...years].map((item) => (
                    <button
                      key={item}
                      onClick={() => setYear(item)}
                      className={`min-h-11 border-b px-1 py-2 text-[.82rem] transition-colors ${year === item ? 'border-accent text-accent' : 'border-transparent text-soft hover:border-accent hover:text-accent'}`}
                    >
                      {item === 'الكل' ? 'كل السنوات' : item}
                    </button>
                  ))}
                </div>
                <div className="mt-1 flex flex-wrap gap-x-5 gap-y-2">
                  {['الكل', ...outlets].map((item) => (
                    <button
                      key={item}
                      onClick={() => setOutlet(item)}
                      className={`min-h-11 border-b px-1 py-2 text-[.82rem] transition-colors ${outlet === item ? 'border-accent text-accent' : 'border-transparent text-soft hover:border-accent hover:text-accent'}`}
                    >
                      {item === 'الكل' ? 'كل الجهات' : item}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </FadeUp>

          {/* قائمة المشاهدة المحلية — تظهر فقط حين تحوي شيئاً */}
          {savedItems.length > 0 && (
            <FadeUp>
              <div className="mt-8">
                <h2 className="text-[.85rem] font-bold text-accent">قائمتك للمشاهدة — على هذا الجهاز فقط</h2>
                <div className="mobile-card-rail mt-4 grid gap-6 md:grid-cols-2">
                  {savedItems.map((m, i) => <Card key={`saved-${m.slug}`} m={m} index={i} />)}
                </div>
              </div>
            </FadeUp>
          )}

          <div id="media-grid" className="mobile-card-rail scroll-mt-28 mt-10 grid gap-6 md:grid-cols-2 md:gap-7">
            {featured && <Card m={featured} index={0} large />}
            {paged.pageItems.map((m, i) => <Card key={m.slug} m={m} index={i + 1} />)}
          </div>
          <div className="mt-9"><Pagination page={paged.page} pageCount={paged.pageCount} onChange={paged.setPage} totalItems={rest.length} firstItem={paged.firstItem} lastItem={paged.lastItem} scrollTargetId="media-grid" label="صفحات الظهور الإعلامي" /></div>
        </div>
      </section>
    </Page>
  )
}
