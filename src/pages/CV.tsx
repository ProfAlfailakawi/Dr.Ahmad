import { useSeo } from '../components/seo'
import { Accordion, FadeUp, Label, Page, Reveal } from '../components/ui'
import { CvSectionEditor } from '../components/admin/CvSectionEditor'
import CitationImpact from '../components/CitationImpact'
import KnowledgeFingerprint from '../components/KnowledgeFingerprint'
import { bio, doctorate, links } from '../data'
import { useCmsContent } from '../lib/content'
import { useAdminAuth } from '../lib/admin-auth'
import { useCv, type CvTextItem } from '../lib/cv'
import { useTrackView } from '../lib/views'
import { useCvLinks } from '../lib/settings'

const ar = (n: number) => String(n)
// محفوظ للمستقبل من دون عرضه حالياً؛ إعادة تفعيله لا تحتاج استرجاع أي كود.
const SHOW_CITATION_IMPACT = false

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
        <span dir="auto">{item.text}</span>
      </li>
    ))}
  </ul>
)

const containsArabic = (value: string) => /[\u0600-\u06ff]/.test(value)

function CourseArchive({ items }: { items: CvTextItem[] }) {
  const professional = items.filter((item) => containsArabic(item.text))
  const technical = items.filter((item) => !containsArabic(item.text))
  const groups = [
    { title: 'الشهادات والدورات المهنية', items: professional, open: true },
    { title: 'الخبرات القيادية في التحول الرقمي وتقنيات التعليم', items: technical, open: false },
  ].filter((group) => group.items.length > 0)

  return (
    <div className="grid gap-4">
      {groups.map((group) => (
        <details key={group.title} open={group.open} className="group overflow-hidden rounded-2xl border border-hair bg-wash/45">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-5 px-5 py-4 marker:hidden">
            <span className="font-display text-[1rem] font-semibold text-ink">{group.title}</span>
            <span className="flex items-center gap-3 text-[.78rem] text-soft">
              <span>{group.items.length}</span>
              <span className="relative flex h-6 w-6 items-center justify-center" aria-hidden="true">
                <span className="absolute h-px w-3 bg-accent" />
                <span className="absolute h-3 w-px bg-accent transition-transform group-open:rotate-90" />
              </span>
            </span>
          </summary>
          <div className="border-t border-hair px-4 py-4 sm:px-5">
            <ul className="grid gap-2.5 md:grid-cols-2">
              {group.items.map((item, index) => (
                <li key={item.id} className="rounded-xl border border-hair/80 bg-canvas px-4 py-3 text-[.84rem] font-light leading-[1.65] text-ink">
                  <span className="me-2 text-[.7rem] font-semibold text-accent/70">{index + 1}</span>
                  <span dir="auto">{item.text}</span>
                </li>
              ))}
            </ul>
          </div>
        </details>
      ))}
    </div>
  )
}

export default function CV() {
  const cvLinks = useCvLinks()
  useSeo({ title: 'السيرة الأكاديمية', path: '/cv', description: 'التعليم والخبرات والعضويات والمؤتمرات.' })
  useTrackView('/cv', 'السيرة الأكاديمية')
  const { isAdmin } = useAdminAuth()
  const { cv, error: cvError, saveSection } = useCv()
  const { articles, books, papers } = useCmsContent()
  const publishedWords = articles.reduce((sum, article) => sum + article.words, 0)

  return (
    <Page className="content-cv page-journey">
      <header className="relative overflow-hidden border-b border-hair px-6 pb-14 pt-32 md:px-11 md:pb-16 md:pt-40">
        <div className="pointer-events-none absolute inset-y-0 left-[8%] hidden w-px bg-gradient-to-b from-transparent via-accent/20 to-transparent md:block" aria-hidden="true" />
        <div className="mx-auto max-w-shell">
          <FadeUp>
            <Label>د. أحمد حسين الفيلكاوي</Label>
            <h1 className="max-w-[900px] font-display text-[clamp(2.55rem,7vw,5.2rem)] font-bold leading-[1.08] text-ink">
              <Reveal>كلُّ ما تعلّمتُه…</Reveal>
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
            <div className="cv-impact-grid mb-14 grid grid-cols-2 gap-6 border-b border-hair pb-14 md:grid-cols-4">
              {[
                { n: ar(books.length), l: 'كتاباً منشوراً' },
                { n: ar(papers.length), l: 'بحثاً محكّماً' },
                { n: ar(articles.length), l: 'مقالاً فكرياً' },
                { n: ar(Math.round(publishedWords / 1000)) + 'K', l: 'كلمة منشورة' },
              ].map((s) => (
                <div key={s.l} className="flex flex-col items-center text-center">
                  <span className="cv-impact-seal relative flex h-24 w-24 items-center justify-center rounded-full border border-accent/30 md:h-28 md:w-28">
                    <span className="pointer-events-none absolute inset-1.5 rounded-full border border-hair" />
                    <span dir="ltr" className="font-display text-[clamp(1.7rem,3vw,2.3rem)] font-bold leading-none text-accent">{s.n}</span>
                  </span>
                  <span className="cv-impact-label mt-4 text-[.85rem] font-light text-soft">{s.l}</span>
                </div>
              ))}
            </div>
          </FadeUp>

          {SHOW_CITATION_IMPACT && (
            <FadeUp delay={0.06}>
              <CitationImpact />
            </FadeUp>
          )}

          {/* البصمة المعرفية — توقيع بصري مبني من بيانات المسيرة نفسها */}
          <FadeUp delay={0.08}>
            <KnowledgeFingerprint />
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
                  <ul className="mobile-card-rail grid gap-7 md:grid-cols-2">
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
                <div className="grid gap-10">
                  <div className="grid gap-10 md:grid-cols-2">
                    <section>
                      <div className="flex items-baseline justify-between gap-4">
                        <h3 className="font-display text-[1.05rem] font-semibold text-ink">المؤلفات</h3>
                        <span className="text-[.78rem] text-soft">{books.length}</span>
                      </div>
                      <ul className="mt-3.5 space-y-2">
                        {books.map((book) => (
                          <li key={book.isbn} className="relative ps-5 text-[.93rem] font-light leading-[1.7] text-ink">
                            <span className="absolute right-0 top-[.7em] h-1.5 w-1.5 rounded-full bg-accent" />
                            {book.title}
                          </li>
                        ))}
                      </ul>
                    </section>
                    <section>
                      <h3 className="font-display text-[1.05rem] font-semibold text-ink">أطروحة الدكتوراه</h3>
                      <div className="mt-3.5 rounded-2xl border border-hair bg-wash p-5">
                        <p dir="auto" className="text-[.92rem] font-medium leading-[1.75] text-ink">{doctorate.title}</p>
                        <p className="mt-2.5 text-[.85rem] text-soft">{doctorate.university}</p>
                      </div>
                    </section>
                  </div>

                  <section className="border-t border-hair pt-8">
                    <div className="flex items-baseline justify-between gap-4">
                      <div>
                        <h3 className="font-display text-[1.1rem] font-semibold text-ink">الأبحاث المنشورة</h3>
                        <p className="mt-1 text-[.82rem] font-light text-soft">القائمة الكاملة من السيرة الأصلية، من دون اختصار أو حذف.</p>
                      </div>
                      <span className="text-[.78rem] text-soft">{papers.length}</span>
                    </div>
                    <ol className="mt-5 grid gap-3 md:grid-cols-2">
                      {papers.map((paper, index) => (
                        <li key={paper.slug} className="group rounded-2xl border border-hair bg-canvas p-4 transition-colors hover:border-accent/55 hover:bg-wash">
                          <a href={paper.url} className="block" aria-label={`فتح البحث: ${paper.title}`}>
                            <div className="flex items-start gap-3">
                              <span className="mt-0.5 flex h-7 min-w-7 items-center justify-center rounded-full border border-accent/30 text-[.7rem] font-semibold text-accent">{index + 1}</span>
                              <div className="min-w-0">
                                <h4 dir="auto" className="text-[.9rem] font-medium leading-[1.65] text-ink transition-colors group-hover:text-accent">{paper.title}</h4>
                                {paper.titleAr && paper.titleAr !== paper.title && (
                                  <p className="mt-1 text-[.78rem] font-light leading-[1.6] text-soft">{paper.titleAr}</p>
                                )}
                                <p dir="auto" className="mt-2 text-[.74rem] leading-[1.55] text-soft/85">{paper.journal}</p>
                              </div>
                            </div>
                          </a>
                        </li>
                      ))}
                    </ol>
                  </section>
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
                  <ul className="mobile-card-rail grid gap-4 md:grid-cols-2 md:gap-x-10">
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
                <Accordion title="الشهادات والدورات" count={cv.certifications.length}>
                  <CourseArchive items={cv.certifications} />
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
