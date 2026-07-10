import { useSeo } from '../components/seo'
import { Accordion, FadeUp, Page, PageHead } from '../components/ui'
import { advisory, bio, books, conferences, doctorate, links, memberships, papers, stats } from '../data'

const ar = (n: number) => String(n).replace(/[0-9]/g, (d) => '0123456789'[+d])

/* الأقسام المفتوحة دائماً — الجوهر */
function Open({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <FadeUp>
      <section className="border-b border-hair py-10">
        <h2 className="text-[.76rem] font-semibold uppercase tracking-[.12em] text-accent">{title}</h2>
        <div className="mt-6">{children}</div>
      </section>
    </FadeUp>
  )
}

const Dots = ({ items }: { items: string[] }) => (
  <ul className="grid gap-2.5 md:grid-cols-2 md:gap-x-10">
    {items.map((m) => (
      <li key={m} className="relative ps-5 text-[.95rem] font-light leading-[1.8] text-ink">
        <span className="absolute right-0 top-[.75em] h-1.5 w-1.5 rounded-full bg-accent" />
        {m}
      </li>
    ))}
  </ul>
)

export default function CV() {
  useSeo({ title: 'السيرة الأكاديمية', path: '/cv', description: 'التعليم والخبرات والعضويات والمؤتمرات.' })
  return (
    <Page>
      <PageHead label="السيرة الأكاديمية" title="أحمد حسين الفيلكاوي" sub={bio.intro} />

      <div className="px-6 py-14 md:px-11 md:py-16">
        <div className="mx-auto max-w-shell">
          {/* أثرٌ موثّق — أختام هادئة لا أرقام صاخبة */}
          <FadeUp>
            <p className="mb-8 text-center text-[.76rem] font-semibold uppercase tracking-[.18em] text-accent">أثرٌ موثّق</p>
            <div className="mb-14 grid grid-cols-2 gap-6 border-b border-hair pb-14 md:grid-cols-4">
              {[
                { n: ar(books.length), l: 'كتاباً منشوراً' },
                { n: ar(papers.length), l: 'بحثاً محكّماً' },
                { n: ar(stats.articles), l: 'مقالاً فكرياً' },
                { n: ar(Math.round(stats.words / 1000)) + 'ك', l: 'كلمة منشورة' },
              ].map((s) => (
                <div key={s.l} className="flex flex-col items-center text-center">
                  <span className="relative flex h-24 w-24 items-center justify-center rounded-full border border-accent/30 md:h-28 md:w-28">
                    <span className="pointer-events-none absolute inset-1.5 rounded-full border border-hair" />
                    <span className="font-display text-[clamp(1.7rem,3vw,2.3rem)] font-bold leading-none text-accent">{s.n}</span>
                  </span>
                  <span className="mt-4 text-[.85rem] font-light tracking-wide text-soft">{s.l}</span>
                </div>
              ))}
            </div>
          </FadeUp>

          {/* ── الجوهر: مفتوح دائماً ── */}
          <Open title="التعليم">
            <ul className="space-y-6">
              {bio.education.map((e) => (
                <li key={e.degree} className="relative border-r-2 border-hair pe-0 ps-0 pr-6 transition-colors hover:border-accent">
                  <span className="block text-[1.06rem] font-medium text-ink">{e.degree}</span>
                  <span className="mt-1 block text-[.92rem] text-soft">{e.org}</span>
                  <span className="text-[.86rem] text-accent">{e.note}</span>
                </li>
              ))}
            </ul>
          </Open>

          <Open title="الخبرات التدريسية">
            <ul className="space-y-5">
              {bio.teaching.map((t) => (
                <li key={t.role} className="border-r-2 border-hair pr-6 transition-colors hover:border-accent">
                  <span className="block text-[1.04rem] font-medium text-ink">{t.role}</span>
                  <span className="mt-0.5 block text-[.9rem] text-soft">{t.org}</span>
                </li>
              ))}
            </ul>
          </Open>

          {/* ── التفاصيل: مطويّات ── */}
          <FadeUp>
            <div className="mt-6">
              <Accordion title="الخبرات الوظيفية والاستشارية" count={advisory.length}>
                <ul className="grid gap-7 md:grid-cols-2">
                  {bio.work.map((w) => (
                    <li key={w.org}>
                      <span className="block text-[1.02rem] font-medium text-ink">{w.org}</span>
                      <span className="mt-0.5 block text-[.88rem] text-soft">{w.role}</span>
                      {'items' in w && w.items && (
                        <ul className="mt-2.5 space-y-1">
                          {w.items.map((it) => (
                            <li key={it} className="relative ps-4 text-[.85rem] font-light text-soft">
                              <span className="absolute right-0 top-[.7em] h-1 w-1 rounded-full bg-accent/60" />
                              {it}
                            </li>
                          ))}
                        </ul>
                      )}
                    </li>
                  ))}
                </ul>
              </Accordion>

              <Accordion title="الأبحاث والكتب" count={`${books.length} + ${papers.length}`}>
                <div className="grid gap-10 md:grid-cols-2">
                  <div>
                    <h3 className="font-display text-[1.05rem] font-semibold text-ink">المؤلفات</h3>
                    <ul className="mt-3.5 space-y-2">
                      {books.map((b) => (
                        <li key={b.isbn} className="relative ps-5 text-[.93rem] font-light leading-[1.7] text-ink">
                          <span className="absolute right-0 top-[.7em] h-1.5 w-1.5 rounded-full bg-accent" />
                          {b.title}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <h3 className="font-display text-[1.05rem] font-semibold text-ink">أطروحة الدكتوراه</h3>
                    <div className="mt-3.5 rounded-xl border border-hair bg-wash p-5">
                      <p className="text-[.92rem] font-medium leading-[1.75] text-ink">{doctorate.title}</p>
                      <p className="mt-2.5 text-[.85rem] text-soft">{doctorate.university}</p>
                    </div>
                  </div>
                </div>
              </Accordion>

              <Accordion title="اللجان والعضويات المحلية" count={bio.committees.length}>
                <Dots items={bio.committees} />
              </Accordion>

              <Accordion title="العضويات الدولية" count={memberships.length}>
                <Dots items={memberships} />
              </Accordion>

              <Accordion title="المؤتمرات والزيارات العلمية" count={conferences.length}>
                <ul className="grid gap-4 md:grid-cols-2 md:gap-x-10">
                  {conferences.map((c) => (
                    <li key={c.title}>
                      <span className="block text-[.96rem] font-medium leading-[1.55] text-ink">{c.title}</span>
                      <span className="text-[.84rem] text-soft">{c.place}</span>
                    </li>
                  ))}
                </ul>
              </Accordion>

              <Accordion title="ورش العمل والمحاضرات" count={bio.workshops.length}>
                <Dots items={bio.workshops} />
              </Accordion>

              <Accordion title="الشهادات والدورات" count="+100">
                <Dots items={bio.certifications} />
                <p className="mt-6 text-[.85rem] text-soft">وأكثر من مئة شهادة تدريبية أخرى في التعليم والتقنية والقيادة.</p>
              </Accordion>

              <Accordion title="مهارات الكمبيوتر" count={bio.skills.length}>
                <div className="flex flex-wrap gap-2.5">
                  {bio.skills.map((s) => (
                    <span key={s} className="rounded-full border border-hair px-4 py-1.5 text-[.88rem] text-ink">{s}</span>
                  ))}
                </div>
              </Accordion>
            </div>
          </FadeUp>

          <FadeUp>
            <div className="mt-14">
              <a href={links.cv} target="_blank" rel="noreferrer" className="inline-block rounded-full bg-accent px-8 py-3.5 font-semibold text-white transition-colors duration-300 hover:bg-accent-deep">
                تحميل السيرة الذاتية (PDF)
              </a>
            </div>
          </FadeUp>
        </div>
      </div>
    </Page>
  )
}
