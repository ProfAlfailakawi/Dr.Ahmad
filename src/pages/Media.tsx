import { useSeo } from '../components/seo'
import { motion, useReducedMotion } from 'framer-motion'
import { EASE, FadeUp, Page, PageHead } from '../components/ui'
import { media, projects } from '../data'

const id = (u: string) => (u.match(/v=([\w-]{6,})/) || [])[1] || ''

export default function Media() {
  useSeo({ title: 'الظهور الإعلامي', path: '/media', description: 'لقاءات تلفزيونية وإذاعية.' })
  const reduce = useReducedMotion()
  return (
    <Page>
      <PageHead
        label="الظهور الإعلامي"
        title="على الشاشة."
        sub="مقتطفات من لقاءاتي الإذاعية والتلفزيونية، حيث يتحوّل الحوار إلى منصة للفكر."
      />

      <section className="px-6 py-20 md:px-11 md:py-24">
        <div className="mx-auto grid max-w-shell gap-6 md:grid-cols-2 md:gap-7">
          {media.map((m, i) => (
            <motion.a
              key={m.url}
              href={m.url}
              target="_blank"
              rel="noreferrer"
              data-hover
              initial={reduce ? false : { opacity: 0, y: 26 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.2 }}
              transition={{ duration: 0.7, delay: Math.min(i * 0.06, 0.3), ease: EASE }}
              whileHover={reduce ? {} : { y: -6 }}
              className="group block overflow-hidden rounded-2xl border border-hair bg-canvas transition-colors duration-300 hover:border-accent"
            >
              <div className="relative overflow-hidden bg-wash" style={{ aspectRatio: '16 / 9' }}>
                {id(m.url) ? (
                  <img
                    src={`https://i.ytimg.com/vi/${id(m.url)}/hqdefault.jpg`}
                    alt={m.title}
                    loading="lazy"
                    className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                ) : null}
                <span className="absolute inset-0 bg-ink/0 transition-colors duration-400 group-hover:bg-ink/20" />
                <span className="absolute left-1/2 top-1/2 flex h-14 w-14 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-[1.5px] border-white/80 bg-ink/40 text-[1rem] text-white backdrop-blur-sm transition-all duration-400 group-hover:scale-110 group-hover:bg-accent group-hover:border-accent">
                  ▶
                </span>
              </div>
              <div className="p-6">
                <span className="text-[.74rem] font-semibold text-accent">{m.outlet}</span>
                <h2 className="mt-2 text-[1.05rem] font-medium leading-[1.6] text-ink">{m.title}</h2>
              </div>
            </motion.a>
          ))}
        </div>

        <div className="mx-auto mt-20 max-w-shell border-t border-hair pt-14">
          <FadeUp>
            <span className="text-[.78rem] font-semibold uppercase tracking-[.1em] text-accent">المشاريع التقنية</span>
            <div className="mt-7 grid gap-8 md:grid-cols-2">
              {projects.map((p) => (
                <div key={p.title}>
                  <h3 className="font-display text-[1.35rem] font-semibold text-ink">{p.title}</h3>
                  <p className="mt-2 text-[.98rem] font-light leading-[1.8] text-[#3f454f]">{p.desc}</p>
                </div>
              ))}
            </div>
          </FadeUp>
        </div>
      </section>
    </Page>
  )
}
