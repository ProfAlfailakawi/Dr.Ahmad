import { useSeo } from '../components/seo'
import { Link } from 'react-router-dom'
import { FadeUp, Page, PageHead } from '../components/ui'
import { doctorate } from '../data'
import { useCmsContent } from '../lib/content'

const ar = (n: number) => String(n).padStart(2, '0').replace(/[0-9]/g, (d) => '0123456789'[+d])
const paperCount = (count: number) => {
  if (count === 1) return 'بحث واحد'
  if (count === 2) return 'بحثان'
  return `${count} بحثاً`
}

export default function Research() {
  const { papers } = useCmsContent()
  const count = paperCount(papers.length)
  useSeo({ title: 'المساهمات العلمية', path: '/research', description: `${count} محكّماً في تكنولوجيا التعليم.` })
  return (
    <Page>
      <PageHead label="المساهمات العلمية" title={`${count}.`} sub="أبحاث محكّمة تُسهم في تطوير ممارسات التعليم وتوظيف التكنولوجيا." />

      <section className="px-6 py-20 md:px-11 md:py-24">
        <div className="mx-auto max-w-shell">
          <ul>
            {papers.map((p, i) => (
              <FadeUp key={p.slug} delay={Math.min(i * 0.03, 0.3)}>
                <li className={i === 0 ? '' : 'border-t border-hair'}>
                  <Link to={`/research/${p.slug}`} className="group flex gap-6 py-6 transition-[padding] duration-400 hover:pe-3">
                    <span className="min-w-[40px] pt-1 font-display font-semibold text-accent">{ar(i + 1)}</span>
                    <span>
                      <span className="block text-[1.14rem] font-medium leading-[1.6] text-ink transition-colors group-hover:text-accent">{p.title}</span>
                      {p.meta && <span className="mt-1.5 block text-[.8rem] text-soft">{p.meta}</span>}
                      {p.journal && <span className="mt-1 block text-[.78rem] text-accent">{p.journal}</span>}
                    </span>
                  </Link>
                </li>
              </FadeUp>
            ))}
          </ul>

          <FadeUp delay={0.15}>
            <div className="mt-16 rounded-2xl border border-hair bg-wash p-8 md:p-10">
              <span className="text-[.76rem] font-semibold uppercase tracking-[.1em] text-accent">أطروحة الدكتوراه</span>
              <h2 className="mt-4 text-[1.1rem] font-medium leading-[1.75] text-ink">{doctorate.title}</h2>
              <p className="mt-4 text-[.92rem] text-soft">{doctorate.university}</p>
              <p className="mt-1 text-[.92rem] text-soft">{doctorate.note}</p>
            </div>
          </FadeUp>
        </div>
      </section>
    </Page>
  )
}
