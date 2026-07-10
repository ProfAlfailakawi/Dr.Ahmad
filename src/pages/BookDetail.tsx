import { Link, useParams } from 'react-router-dom'
import { FadeUp, Page, Reveal } from '../components/ui'
import { books } from '../data'
import { useSeo } from '../components/seo'

export default function BookDetail() {
  const { slug } = useParams()
  const book = books.find((b) => b.slug === slug)
  useSeo({ title: book?.title ?? 'كتاب', description: book?.desc, path: `/publications/${slug}` })
  if (!book) return <Page><div className="px-6 pt-44 text-center text-soft">لم يُعثر على الكتاب.</div></Page>

  return (
    <Page>
      <section className="px-6 pb-24 pt-36 md:px-11 md:pt-44">
        <div className="mx-auto max-w-shell">
          <FadeUp>
            <Link to="/publications" className="text-[.85rem] text-soft transition-colors hover:text-accent">← كل المؤلفات</Link>
          </FadeUp>

          <div className="mt-10 grid gap-12 md:grid-cols-[1fr_1.1fr] md:gap-16">
            <FadeUp>
              <div className="overflow-hidden rounded-xl bg-white shadow-[0_30px_60px_-30px_rgba(21,22,26,.45)]">
                <img src={book.cover} alt={book.title} className="w-full" />
              </div>
            </FadeUp>

            <FadeUp delay={0.1}>
              <span className="text-[.8rem] font-semibold uppercase tracking-[.13em] text-accent">كتاب</span>
              <h1 className="mt-4 font-display text-[clamp(2rem,4.6vw,3.2rem)] font-bold leading-[1.25] text-ink">
                <Reveal>{book.title}</Reveal>
              </h1>
              <p className="mt-5 text-[1.08rem] font-light leading-[1.9] text-ink/80">{book.desc}</p>

              <dl className="mt-8 border-t border-hair pt-6">
                <div className="flex gap-4">
                  <dt className="w-24 shrink-0 text-[.85rem] text-soft">ردمك</dt>
                  <dd className="text-[.95rem] font-medium text-ink">{book.isbn}</dd>
                </div>
              </dl>

              <a
                href={book.pdf}
                target="_blank"
                rel="noreferrer"
                className="mt-9 inline-flex items-center gap-3 rounded-full bg-accent px-8 py-3.5 font-semibold text-white transition-colors duration-300 hover:bg-accent-deep"
              >
                <span>المقدّمة والفهرس</span>
                <span className="text-[.85rem] opacity-80">PDF</span>
              </a>
              <p className="mt-3 text-[.8rem] text-soft">يفتح ملف الفهرس ومقدّمة الكتاب.</p>
            </FadeUp>
          </div>
        </div>
      </section>
    </Page>
  )
}
