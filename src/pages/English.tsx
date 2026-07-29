/* ============================================================
   المرآة الإنجليزية — أربع صفحات: /en · /en/cv · /en/research
   نفس الجماليات (أحادية اللون + لون واحد)، اتجاه LTR كامل.
   المحتوى من data-en.ts (صياغة تحريرية، لا ترجمة حرفية).
   ============================================================ */
import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useSeo } from '../components/seo'
import { FadeUp, Page, PageHead } from '../components/ui'
import { SocialIcon } from '../components/icons'
import { Pagination, usePagedList } from '../components/Pagination'
import { academicProfiles, socials } from '../data'
import { useCmsContent } from '../lib/content'
import {
  advisoryEn, appointmentsEn, doctorateEn, educationEn,
  journalEn, membershipsEn, paperTitlesEn, profileEn,
} from '../data-en'
import { useCvLinks } from '../lib/settings'
import { useTrackView } from '../lib/views'
import { PROJECT_START_YEAR } from '../lib/project-meta'

/* يقلب المستند إلى الإنجليزية (اتجاه + لغة + عنوان) ويعيده عربياً عند المغادرة */
function useEnglish(title: string, path: string, description: string) {
  useSeo({ title, path, description })
  useEffect(() => {
    const html = document.documentElement
    html.setAttribute('lang', 'en')
    html.setAttribute('dir', 'ltr')
    document.title = `${title} — Dr. Ahmad H. Alfailakawi`
    return () => {
      html.setAttribute('lang', 'ar')
      html.setAttribute('dir', 'rtl')
    }
  }, [title])
}

const Label = ({ children }: { children: React.ReactNode }) => (
  <p className="text-[.76rem] font-semibold uppercase tracking-[.14em] text-accent">{children}</p>
)

/* أختام الأثر — نفس دوائر السيرة العربية */
function Impact() {
  const { articles, books, papers } = useCmsContent()
  const words = articles.reduce((sum, article) => sum + article.words, 0)
  const items = [
    { n: String(books.length), l: 'Published books' },
    { n: String(papers.length), l: 'Peer-reviewed papers' },
    { n: String(articles.length), l: 'Essays & articles' },
    { n: `${Math.round(words / 1000)}K`, l: 'Words published' },
  ]
  return (
    <div className="grid grid-cols-2 gap-6 md:grid-cols-4">
      {items.map((s) => (
        <div key={s.l} className="flex flex-col items-center text-center">
          <span className="relative flex h-24 w-24 items-center justify-center rounded-full border border-accent/30 md:h-28 md:w-28">
            <span className="pointer-events-none absolute inset-1.5 rounded-full border border-hair" />
            <span className="font-display text-[clamp(1.7rem,3vw,2.3rem)] font-bold leading-none text-accent">{s.n}</span>
          </span>
          <span className="mt-4 text-[.85rem] font-light text-soft">{s.l}</span>
        </div>
      ))}
    </div>
  )
}

/* ---------- /en — الصفحة الرئيسية ---------- */
export function EnglishHome() {
  const { articles, books, papers } = useCmsContent()
  const firstYear = articles.length ? Math.min(PROJECT_START_YEAR, ...articles.map((article) => Number(article.year) || new Date().getFullYear())) : PROJECT_START_YEAR
  useEnglish('Professor of Educational Technology & AI', '/en', `Official website of Dr. Ahmad H. Alfailakawi — ${books.length} books, ${papers.length} peer-reviewed papers, and ${articles.length} essays since ${firstYear}.`)
  useTrackView('/en', 'English — Home')

  return (
    <Page>
      {/* المشهد الأول — الهوية */}
      <section className="flex min-h-[92vh] flex-col justify-center border-b border-hair px-6 pt-24 md:px-11">
        <div className="mx-auto w-full max-w-shell">
          <FadeUp>
            <Label>{profileEn.eyebrow}</Label>
            <h1 className="mt-5 font-display text-[clamp(2.6rem,7vw,5rem)] font-bold leading-[1.08] text-ink">
              Ahmad H. Alfailakawi
            </h1>
            <p className="mt-8 max-w-[680px] font-display text-[clamp(1.5rem,3.4vw,2.4rem)] font-light leading-[1.35] text-ink">
              {profileEn.statementLines[0]}
              <br />
              <span className="text-accent">{profileEn.statementLines[1]}</span>
            </p>
            <p className="mt-6 max-w-[560px] text-[1rem] font-light leading-[1.8] text-soft">{profileEn.tagline}</p>
            <div className="mt-10 flex flex-wrap items-center gap-4">
              <Link to="/en/research" className="rounded-full bg-accent px-7 py-3 text-[.9rem] font-semibold text-white transition-colors duration-300 hover:bg-accent-deep">
                Research
              </Link>
              <Link to="/en/cv" className="rounded-full border border-hair px-7 py-3 text-[.9rem] font-medium text-ink transition-colors duration-300 hover:border-accent hover:text-accent">
                Curriculum Vitae
              </Link>
              <span className="flex items-center gap-4 ps-2 text-soft">
                {socials.map((s) => (
                  <a key={s.label} href={s.url} target="_blank" rel="noreferrer" aria-label={s.label} className="transition-colors hover:text-accent">
                    <SocialIcon name={s.label} size={18} />
                  </a>
                ))}
              </span>
            </div>
          </FadeUp>
        </div>
      </section>

      {/* عن الدكتور */}
      <section className="border-b border-hair px-6 py-20 md:px-11">
        <div className="mx-auto max-w-shell">
          <FadeUp>
            <Label>About</Label>
            <p className="mt-6 max-w-[760px] text-[1.12rem] font-light leading-[2] text-ink">{profileEn.about}</p>
            <div className="mt-8 flex flex-wrap gap-2.5">
              {profileEn.facts.map((fact, index) => {
                const f = index === 2 ? `${books.length} published books` : index === 3 ? `${papers.length} peer-reviewed papers` : fact
                return (
                <span key={`${index}:${f}`} className="rounded-full border border-hair px-4 py-1.5 text-[.85rem] text-soft">{f}</span>
                )
              })}
            </div>
          </FadeUp>
        </div>
      </section>

      {/* الأثر */}
      <section className="border-b border-hair px-6 py-20 md:px-11">
        <div className="mx-auto max-w-shell">
          <FadeUp>
            <p className="mb-10 text-center text-[.76rem] font-semibold uppercase tracking-[.14em] text-accent">A documented record</p>
            <Impact />
          </FadeUp>
        </div>
      </section>

      {/* مختارات بحثية */}
      <section className="border-b border-hair px-6 py-20 md:px-11">
        <div className="mx-auto max-w-shell">
          <FadeUp>
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <Label>Selected research</Label>
                <h2 className="mt-3 font-display text-[clamp(1.6rem,3.5vw,2.3rem)] font-bold text-ink">Peer-reviewed contributions</h2>
              </div>
              <Link to="/en/research" className="text-[.9rem] font-medium text-accent transition-opacity hover:opacity-70">
                All {papers.length} papers →
              </Link>
            </div>
            <ul className="mobile-card-rail mt-10 grid gap-8 md:grid-cols-3">
              {papers.slice(0, 3).map((p) => (
                <li key={p.slug} className="border-l-2 border-hair pl-5 transition-colors hover:border-accent">
                  <p className="text-[1rem] font-medium leading-[1.6] text-ink">{paperTitlesEn[p.slug] || p.slug}</p>
                  {p.journal && <p className="mt-2.5 text-[.82rem] text-soft">{journalEn(p.journal)}</p>}
                </li>
              ))}
            </ul>
          </FadeUp>
        </div>
      </section>

      {/* الكتب + الختام */}
      <section className="px-6 py-20 md:px-11">
        <div className="mx-auto max-w-shell">
          <FadeUp>
            <div className="grid gap-12 md:grid-cols-2 md:items-center">
              <div>
                <Label>Books</Label>
                <h2 className="mt-3 font-display text-[clamp(1.6rem,3.5vw,2.3rem)] font-bold leading-[1.3] text-ink">
                  {books.length} books on education, technology and social change
                </h2>
                <p className="mt-4 max-w-[460px] text-[.95rem] font-light leading-[1.9] text-soft">
                  Written in Arabic — spanning a decade of thinking about how technology should serve learning, not replace it.
                </p>
                <Link to="/publications" className="mt-6 inline-block text-[.9rem] font-medium text-accent transition-opacity hover:opacity-70">
                  Browse the books (in Arabic) →
                </Link>
              </div>
              <div className="rounded-2xl border border-hair bg-wash p-8">
                <p className="font-display text-[1.3rem] font-semibold leading-[1.5] text-ink">Working with institutions on education, media and AI.</p>
                <p className="mt-3 text-[.92rem] font-light leading-[1.8] text-soft">Consulting, keynotes and digital-transformation projects — in Kuwait and beyond.</p>
                <div className="mt-6 flex flex-wrap gap-3.5">
                  <Link to="/en/contact#booking-form" className="rounded-full bg-accent px-6 py-2.5 text-[.88rem] font-semibold text-white transition-colors duration-300 hover:bg-accent-deep">
                    Book a meeting
                  </Link>
                  <a href="https://www.linkedin.com/in/prof-ahmad-alfailakawi-5922251a5" target="_blank" rel="noreferrer" className="rounded-full border border-hair px-6 py-2.5 text-[.88rem] font-medium text-ink transition-colors hover:border-accent hover:text-accent">
                    LinkedIn
                  </a>
                </div>
              </div>
            </div>
          </FadeUp>
        </div>
      </section>
    </Page>
  )
}

/* ---------- /en/cv — السيرة ---------- */
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <FadeUp>
      <section className="border-b border-hair py-10">
        <h2 className="text-[.76rem] font-semibold uppercase tracking-[.14em] text-accent">{title}</h2>
        <div className="mt-6">{children}</div>
      </section>
    </FadeUp>
  )
}

export function EnglishCV() {
  useEnglish('Curriculum Vitae', '/en/cv', 'Education, academic appointments, advisory roles and international memberships of Dr. Ahmad H. Alfailakawi.')
  useTrackView('/en/cv', 'English — CV')
  const cv = useCvLinks()

  return (
    <Page>
      <PageHead label="Curriculum Vitae" title="Ahmad H. Alfailakawi" sub={profileEn.tagline} />
      <div className="px-6 py-14 md:px-11 md:py-16">
        <div className="mx-auto max-w-shell">
          <FadeUp>
            <p className="mb-8 text-center text-[.76rem] font-semibold uppercase tracking-[.14em] text-accent">A documented record</p>
            <div className="mb-14 border-b border-hair pb-14"><Impact /></div>
          </FadeUp>

          <Section title="Education">
            <ul className="space-y-6">
              {educationEn.map((e) => (
                <li key={e.degree} className="border-l-2 border-hair pl-6 transition-colors hover:border-accent">
                  <span className="block text-[1.06rem] font-medium text-ink">{e.degree}</span>
                  <span className="mt-1 block text-[.92rem] text-soft">{e.org}</span>
                  <span className="text-[.86rem] text-accent">{e.note}</span>
                </li>
              ))}
            </ul>
          </Section>

          <Section title="Academic appointments">
            <ul className="space-y-5">
              {appointmentsEn.map((a) => (
                <li key={a.role} className="border-l-2 border-hair pl-6 transition-colors hover:border-accent">
                  <span className="block text-[1.04rem] font-medium text-ink">{a.role}</span>
                  <span className="mt-0.5 block text-[.9rem] text-soft">{a.org}</span>
                </li>
              ))}
            </ul>
          </Section>

          <Section title="Advisory & consulting">
            <ul className="mobile-card-rail grid gap-6 md:grid-cols-2">
              {advisoryEn.map((a) => (
                <li key={a.org}>
                  <span className="block text-[1rem] font-medium text-ink">{a.org}</span>
                  <span className="mt-0.5 block text-[.88rem] text-soft">{a.role}</span>
                </li>
              ))}
            </ul>
          </Section>

          <Section title="International memberships">
            <ul className="grid gap-2.5 md:grid-cols-2 md:gap-x-10">
              {membershipsEn.map((m) => (
                <li key={m} className="relative pl-5 text-[.95rem] font-light leading-[1.8] text-ink">
                  <span className="absolute left-0 top-[.75em] h-1.5 w-1.5 rounded-full bg-accent" />
                  {m}
                </li>
              ))}
            </ul>
          </Section>

          <Section title="Doctoral dissertation">
            <div className="rounded-xl border border-hair bg-wash p-6">
              <p className="text-[1rem] font-medium leading-[1.7] text-ink">{doctorateEn.title}</p>
              <p className="mt-2.5 text-[.88rem] text-soft">{doctorateEn.university}</p>
              <p className="mt-1 text-[.84rem] text-accent">{doctorateEn.note}</p>
            </div>
          </Section>

          <FadeUp>
            <div className="mt-14">
              <a href={cv.en || cv.ar} target="_blank" rel="noreferrer" className="inline-block rounded-full bg-accent px-8 py-3.5 font-semibold text-white transition-colors duration-300 hover:bg-accent-deep">
                Download CV (PDF)
              </a>
            </div>
          </FadeUp>
        </div>
      </div>
    </Page>
  )
}

/* ---------- /en/research — الأبحاث ---------- */
export function EnglishResearch() {
  const { papers } = useCmsContent()
  useEnglish('Research', '/en/research', `${papers.length} peer-reviewed papers on educational technology, e-learning systems and emerging technologies in higher education.`)
  useTrackView('/en/research', 'English — Research')
  const paged = usePagedList(papers, 12, String(papers.length))

  return (
    <Page>
      <PageHead label="Research" title="Peer-reviewed contributions" sub={`${papers.length} published papers on educational technology, e-learning systems and emerging technologies in higher education.`} />
      <div className="px-6 py-14 md:px-11 md:py-16">
        <div className="mx-auto max-w-shell">
          {/* الملفان العلميان الرسميان — أيقونتان فقط، بلا أسماءٍ طويلة */}
          <FadeUp>
            <div className="mb-10 flex items-center justify-between border-b border-hair pb-6">
              <span className="text-[.78rem] text-soft">Academic profiles</span>
              <span className="flex items-center gap-2.5">
                {academicProfiles.map((profileLink) => (
                  <a key={profileLink.label} href={profileLink.url} target="_blank" rel="noreferrer" aria-label={profileLink.label} title={profileLink.label} className="flex h-10 w-10 items-center justify-center rounded-full border border-hair text-soft transition-colors hover:border-accent hover:text-accent">
                    <SocialIcon name={profileLink.label} size={18} />
                  </a>
                ))}
              </span>
            </div>
          </FadeUp>
          <ul id="english-research-list">
            {paged.pageItems.map((p, i) => (
              <FadeUp key={p.slug}>
                <li className="group flex gap-6 border-b border-hair py-8">
                  <span className="w-9 shrink-0 pt-1 font-display text-[1.05rem] font-bold text-accent/50 transition-colors group-hover:text-accent">
                    {String((paged.page - 1) * 12 + i + 1).padStart(2, '0')}
                  </span>
                  <div className="min-w-0">
                    <h2 className="text-[1.08rem] font-medium leading-[1.65] text-ink">{paperTitlesEn[p.slug] || p.slug}</h2>
                    {p.journal && <p className="mt-2 text-[.85rem] text-soft">{journalEn(p.journal)}</p>}
                    <div className="mt-3 flex flex-wrap items-center gap-4 text-[.82rem]">
                      {p.meta && <span className="text-soft/80">{p.meta}</span>}
                      <Link to={`/research/${p.slug}`} className="font-medium text-accent transition-opacity hover:opacity-70">
                        Details (Arabic) →
                      </Link>
                    </div>
                  </div>
                </li>
              </FadeUp>
            ))}
          </ul>
          <Pagination page={paged.page} pageCount={paged.pageCount} onChange={paged.setPage} totalItems={papers.length} firstItem={paged.firstItem} lastItem={paged.lastItem} scrollTargetId="english-research-list" label="Research pages" className="mt-8" />
        </div>
      </div>
    </Page>
  )
}
