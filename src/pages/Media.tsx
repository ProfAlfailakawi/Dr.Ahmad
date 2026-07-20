import { useState } from 'react'
import { useSeo } from '../components/seo'
import { motion, useReducedMotion } from 'framer-motion'
import { EASE, FadeUp, Page, PageHead } from '../components/ui'
import { useCmsContent } from '../lib/content'

const id = (url: string) => (url.match(/(?:v=|youtu\.be\/|shorts\/|embed\/)([\w-]{6,})/) || [])[1] || ''
const mediaCount = (count: number) => {
  if (count === 1) return 'لقاء واحد'
  if (count === 2) return 'لقاءان'
  return `${count} لقاءات`
}

export default function Media() {
  const { media } = useCmsContent()
  const [visibleCount, setVisibleCount] = useState(10)
  const count = mediaCount(media.length)
  useSeo({ title: 'الظهور الإعلامي', path: '/media', description: `${count} تلفزيونياً وإذاعياً.` })
  const reduce = useReducedMotion()
  return (
    <Page className="content-media page-journey">
      <PageHead
        label="الظهور الإعلامي"
        title="لقاءات تتجاوز الشاشة."
        sub="مقتطفات من لقاءاتي الإذاعية والتلفزيونية، حيث يتحوّل الحوار إلى منصة للفكر."
      />

      <section className="px-6 py-20 md:px-11 md:py-24">
        <div className="mobile-card-rail mx-auto grid max-w-shell gap-6 md:grid-cols-2 md:gap-7">
          {media.slice(0, visibleCount).map((m, i) => {
            const videoUrl = m.url || ''
            const videoId = id(videoUrl)
            return (
              <motion.a
                key={m.slug}
                href={videoUrl || undefined}
                target={videoUrl ? '_blank' : undefined}
                rel={videoUrl ? 'noreferrer' : undefined}
                data-hover
                initial={reduce ? false : { opacity: 0 }}
                whileInView={{ opacity: 1 }}
                viewport={{ once: true, amount: 0.2 }}
                transition={{ duration: 0.7, delay: Math.min(i * 0.06, 0.3), ease: EASE }}
                className="group block overflow-hidden rounded-2xl border border-hair bg-canvas transition-colors duration-300 hover:border-accent"
              >
                <div className="relative overflow-hidden bg-wash" style={{ aspectRatio: '16 / 9' }}>
                  {videoId && (
                    <img
                      src={`https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`}
                      alt={m.title}
                      loading="lazy"
                      decoding="async"
                      width={480}
                      height={270}
                      onError={(e) => {
                        const img = e.currentTarget
                        // احتياطي: جرّب مقاساً آخر مرّة، وإلا أخفِ الصورة (تبقى الخلفية الأنيقة وزر التشغيل)
                        if (!img.dataset.fallback) { img.dataset.fallback = '1'; img.src = `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg` }
                        else { img.style.display = 'none' }
                      }}
                      className="h-full w-full object-cover"
                    />
                  )}
                  <span className="absolute inset-0 bg-ink/10" />
                  <span className="absolute left-1/2 top-1/2 flex h-14 w-14 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-white/80 bg-ink/40 text-[1rem] text-white">
                    ▶
                  </span>
                </div>
                <div className="p-6">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-[.74rem]">
                    <span className="font-semibold text-accent">{m.outlet || 'ظهور إعلامي'}</span>
                    {m.date && <time className="text-soft">{m.date}</time>}
                  </div>
                  <h2 className="mt-2 text-[1.05rem] font-medium leading-[1.6] text-ink">{m.title}</h2>
                </div>
              </motion.a>
            )
          })}
        </div>
        {visibleCount < media.length && <div className="mt-9 text-center"><button type="button" onClick={() => setVisibleCount((count) => count + 10)} className="rounded-full border border-hair px-6 py-3 text-[.84rem] font-semibold text-accent transition-colors hover:border-accent">عرض ١٠ لقاءات إضافية</button></div>}

      </section>
    </Page>
  )
}
