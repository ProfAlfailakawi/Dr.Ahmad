import { useSeo } from '../components/seo'
import { Accordion, FadeUp, Label, Page, Reveal } from '../components/ui'
import { CvSectionEditor } from '../components/admin/CvSectionEditor'
import { bio, books, doctorate, links, papers, stats } from '../data'
import { useAdminAuth } from '../lib/admin-auth'
import { useCv, type CvTextItem } from '../lib/cv'
import { useTrackView } from '../lib/views'
import { useCvLinks } from '../lib/settings'

const ar = (n: number) => String(n)

/* الأقسام المفتوحة دائماً — الجوهر */
function Open({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <FadeUp>
      <section className="border-b border-hair py-10">
        <h2 className="text-[.76rem] font-semibold uppercase text-accent">{title}</h2>
        <div className="mt-6">{children}</div>
      </section>
    </FadeUp>
  )
}

const Dots = ({ items }: { items: CvTextItem[] }) => (
  <ul className="grid gap-2.5 md:grid-cols-2 md:gap-x-10">
    {items.map((item) => (
      <li key={item.id} className="relative ps-5 text-[.95rem] font-light leading-[1.8] text-ink">
        <span className="absolute right-0 top-[.75em] h-1.5 w-1.5 rounded-full bg-accent" />
        {item.text}
      </li>
    ))}
  </ul>
)

export default function CV() {
  const cvLinks = useCvLinks()
  useSeo({ title: 'السيرة الأكاديمية', path: '/cv', description: 'التعليم والخبرات والعضويات والمؤتمرات.' })
  useTrackView('/cv', 'السيرة الأكاديمية')
  const { isAdmin } = useAdminAuth()
  const { cv, error: cvError, saveSection } = useCv()

  return (
    <Page>
      <header className="relative overflow-hidden border-b border-hair px-6 pb-14 pt-32 md:px-11 md:pb-16 md:pt-40">
        <div className="pointer-events-none absolute inset-y-0 left-[8%] hidden w-px bg-gradient-to-b from-transparent via-accent/20 to-transparent md:block" aria-hidden="true" />
        <div className="mx-auto max-w-shell">
          <FadeUp>
            <Label>د. أحمد حسين الفيلكاوي</Label>
            <h1 className="max-w-[900px] font-display text-[clamp(2.55rem,7vw,5.2rem)] font-bold leading-[1.08] tracking-[-0.025em] text-ink">
              <Reveal>كلُّ ما تعلّمتُه…</Reveal>
              <span className="mt-2 block text-accent">
                <Reveal delay={0.12}>حاولتُ أن أحوّله إلى أثر.</Reveal>
              </span>
            </h1>
            <p className="mt-7 max-w-[690px] text-[clamp(1rem,2vw,1.15rem)] font-light leading-[1.9] text-ink/75">
              مسارٌ امتد من قاعة الدرس إلى البحث والتأليف والاستشارة وصناعة المبادرات؛ لا ليجمع محطاتٍ أكثر، بل ليجعل المعرفة أقرب إلى الإنسان والحياة.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-x-5 gap-y-2 text-[.78rem] font-semibold text-soft" aria-label="مجالات السيرة">
              <span>التعليم</span>
              <span className="h-1 w-1 rounded-full bg-accent" aria-hidden="true" />
              <span>البحث</span>
              <span className="h-1 w-1 rounded-full bg-accent" aria-hidden="true" />
              <span>التأليف</span>
              <span className="h-1 w-1 rounded-full bg-accent" aria-hidden="true" />
              <span>صناعة المبادرات</span>
            </div>
          </FadeUp>
        </div>
      </header>

      <div className="px-6 py-14 md:px-11 md:py-16">
        <div className="mx-auto max-w-shell">
          {isAdmin && cvError && (
            <div role="alert" className="mb-8 rounded-xl border border-hair bg-wash px-5 py-4 text-[.85rem] leading-relaxed text-soft">
              تعذّر تحميل تعديلات السيرة حالياً، لذلك تُعرض النسخة الأصلية. يمكنك المحاولة مجدداً بعد التحقق من الاتصال.
            </div>
          )}

          {/* أثرٌ موثّق — أختام هادئة لا أرقام صاخبة */}
          <FadeUp>
            <p className="mb-8 text-center text-[.76rem] font-semibold uppercase text-accent">أثرٌ موثّق</p>
            <div className="mb-14 grid grid-cols-2 gap-6 border-b border-hair pb-14 md:grid-cols-4">
              {[
                { n: ar(books.length), l: 'كتاباً منشوراً' },
                { n: ar(papers.length), l: 'بحثاً محكّماً' },
                { n: ar(stats.articles), l: 'مقالاً فكرياً' },
                { n: ar(Math.round(stats.words / 1000)) + 'K', l: 'كلمة منشورة' },
              ].map((s) => (
                <div key={s.l} className="flex flex-col items-center text-center">
                  <span className="relative flex h-24 w-24 items-center justify-center rounded-full border border-accent/30 md:h-28 md:w-28">
                    <span className="pointer-events-none absolute inset-1.5 rounded-full border border-hair" />
                    <span dir="ltr" className="font-display text-[clamp(1.7rem,3vw,2.3rem)] font-bold leading-none text-accent">{s.n}</span>
                  </span>
                  <span className="mt-4 text-[.85rem] font-light text-soft">{s.l}</span>
                </div>
              ))}
            </div>
          </FadeUp>

          {/* ── الجوهر: مفتوح دائماً ── */}
          <Open title="التعليم">
            <CvSectionEditor section="education" items={cv.education} isAdmin={isAdmin} onSave={saveSection}>
              <ul className="space-y-6">
                {cv.education.map((item) => (
                  <li key={item.id} className="relative border-r-2 border-hair pe-0 ps-0 pr-6 transition-colors hover:border-accent">
                    <span className="block text-[1.06rem] font-medium text-ink">{item.degree}</span>
                    <span className="mt-1 block text-[.92rem] text-soft">{item.org}</span>
                    {item.note && <span className="text-[.86rem] text-accent">{item.note}</span>}
                  </li>
                ))}
              </ul>
            </CvSectionEditor>
          </Open>

          <Open title="الخبرات التدريسية">
            <CvSectionEditor section="teaching" items={cv.teaching} isAdmin={isAdmin} onSave={saveSection}>
              <ul className="space-y-5">
                {cv.teaching.map((item) => (
                  <li key={item.id} className="border-r-2 border-hair pr-6 transition-colors hover:border-accent">
                    <span className="block text-[1.04rem] font-medium text-ink">{item.role}</span>
                    <span className="mt-0.5 block text-[.9rem] text-soft">{item.org}</span>
                  </li>
                ))}
              </ul>
            </CvSectionEditor>
          </Open>

          {/* ── التفاصيل: مطويّات ── */}
          <FadeUp>
            <div className="mt-6">
              <CvSectionEditor section="work" items={cv.work} isAdmin={isAdmin} onSave={saveSection}>
                <Accordion title="الخبرات الوظيفية والاستشارية" count={cv.work.length}>
                  <ul className="grid gap-7 md:grid-cols-2">
                    {cv.work.map((item) => (
                      <li key={item.id}>
                        <span className="block text-[1.02rem] font-medium text-ink">{item.org}</span>
                        <span className="mt-0.5 block text-[.88rem] text-soft">{item.role}</span>
                        {item.items.length > 0 && (
                          <ul className="mt-2.5 space-y-1">
                            {item.items.map((detail, index) => (
                              <li key={`${item.id}:${index}`} className="relative ps-4 text-[.85rem] font-light text-soft">
                                <span className="absolute right-0 top-[.7em] h-1 w-1 rounded-full bg-accent/60" />
                                {detail}
                              </li>
                            ))}
                          </ul>
                        )}
                      </li>
                    ))}
                  </ul>
                </Accordion>
              </CvSectionEditor>

              <Accordion title="الأبحاث والكتب" count={`${books.length} + ${papers.length}`}>
                <div className="grid gap-10 md:grid-cols-2">
                  <div>
                    <h3 className="font-display text-[1.05rem] font-semibold text-ink">المؤلفات</h3>
                    <ul className="mt-3.5 space-y-2">
                      {books.map((book) => (
                        <li key={book.isbn} className="relative ps-5 text-[.93rem] font-light leading-[1.7] text-ink">
                          <span className="absolute right-0 top-[.7em] h-1.5 w-1.5 rounded-full bg-accent" />
                          {book.title}
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

              <CvSectionEditor section="committees" items={cv.committees} isAdmin={isAdmin} onSave={saveSection}>
                <Accordion title="اللجان والعضويات المحلية" count={cv.committees.length}>
                  <Dots items={cv.committees} />
                </Accordion>
              </CvSectionEditor>

              <CvSectionEditor section="memberships" items={cv.memberships} isAdmin={isAdmin} onSave={saveSection}>
                <Accordion title="العضويات الدولية" count={cv.memberships.length}>
                  <Dots items={cv.memberships} />
                </Accordion>
              </CvSectionEditor>

              <CvSectionEditor section="conferences" items={cv.conferences} isAdmin={isAdmin} onSave={saveSection}>
                <Accordion title="المؤتمرات والزيارات العلمية" count={cv.conferences.length}>
                  <ul className="grid gap-4 md:grid-cols-2 md:gap-x-10">
                    {cv.conferences.map((item) => (
                      <li key={item.id}>
                        <span className="block text-[.96rem] font-medium leading-[1.55] text-ink">{item.title}</span>
                        <span className="text-[.84rem] text-soft">{item.place}</span>
                      </li>
                    ))}
                  </ul>
                </Accordion>
              </CvSectionEditor>

              <CvSectionEditor section="workshops" items={cv.workshops} isAdmin={isAdmin} onSave={saveSection}>
                <Accordion title="ورش العمل والمحاضرات" count={cv.workshops.length}>
                  <Dots items={cv.workshops} />
                </Accordion>
              </CvSectionEditor>

              <CvSectionEditor section="certifications" items={cv.certifications} isAdmin={isAdmin} onSave={saveSection}>
                <Accordion title="الشهادات والدورات" count="+100">
                  <Dots items={cv.certifications} />
                  <p className="mt-6 text-[.85rem] text-soft">وأكثر من مئة شهادة تدريبية أخرى في التعليم والتقنية والقيادة.</p>
                </Accordion>
              </CvSectionEditor>

              <CvSectionEditor section="skills" items={cv.skills} isAdmin={isAdmin} onSave={saveSection}>
                <Accordion title="مهارات الكمبيوتر" count={cv.skills.length}>
                  <div className="flex flex-wrap gap-2.5">
                    {cv.skills.map((item) => (
                      <span key={item.id} className="rounded-full border border-hair px-4 py-1.5 text-[.88rem] text-ink">{item.text}</span>
                    ))}
                  </div>
                </Accordion>
              </CvSectionEditor>
            </div>
          </FadeUp>

          <FadeUp>
            <div className="mt-14">
              <a href={cvLinks.ar} target="_blank" rel="noreferrer" className="inline-block rounded-full bg-accent px-8 py-3.5 font-semibold text-white transition-colors duration-300 hover:bg-accent-deep">
                تحميل السيرة الذاتية (PDF)
              </a>
            </div>
          </FadeUp>
        </div>
      </div>
    </Page>
  )
}
