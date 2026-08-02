import profileData from '../../data/legacy-profile.json'

type LegacyExample = { id: string; kind: string; title: string; url?: string; year?: string }
type LegacyTheme = { id: string; title: string; support: number; firstYear?: string; lastYear?: string; kinds?: string[]; examples?: LegacyExample[] }
type LegacyRepresentative = { id: string; kind: string; title: string; url?: string; year?: string; centrality: number; concepts?: string[] }
type LegacyTimeline = { year: string; count: number; kinds?: Record<string, number>; titles?: LegacyExample[] }
type LegacyArc = { id: string; title: string; firstYear: string; lastYear: string; support: number; examples?: LegacyExample[] }
type LegacyProfile = {
  builtAt?: string
  note?: string
  stats?: { themes?: number; representatives?: number; years?: number }
  themes?: LegacyTheme[]
  representatives?: LegacyRepresentative[]
  timeline?: LegacyTimeline[]
  arcs?: LegacyArc[]
}

const profile = profileData as LegacyProfile
const kindLabel: Record<string, string> = { article: 'مقال', book: 'كتاب', paper: 'بحث', curated: 'مختارات', podcast: 'بودكاست', social: 'منشور', media: 'إعلام' }

function OpenItem({ item }: { item: LegacyExample | LegacyRepresentative }) {
  const content = (
    <>
      <span className="block text-[.64rem] font-semibold text-accent">{kindLabel[item.kind] || item.kind}{item.year ? ` · ${item.year}` : ''}</span>
      <strong className="mt-1 block text-[.8rem] leading-[1.65] text-ink">{item.title}</strong>
    </>
  )
  return item.url ? <a href={item.url} target={item.url.startsWith('/') ? undefined : '_blank'} rel="noreferrer" className="block rounded-xl border border-hair bg-canvas px-3.5 py-3 transition-colors hover:border-accent/[.45]">{content}</a> : <div className="rounded-xl border border-hair bg-canvas px-3.5 py-3">{content}</div>
}

export function LegacyModePanel() {
  const themes = profile.themes || []
  const representatives = profile.representatives || []
  const timeline = profile.timeline || []
  const arcs = profile.arcs || []
  const recentTimeline = timeline.slice(-10)
  const maxYearCount = Math.max(1, ...recentTimeline.map((item) => item.count || 0))

  return (
    <div className="mt-5 grid gap-5" data-legacy-mode="true">
      <div className="rounded-2xl border border-accent/20 bg-canvas p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-3xl">
            <span className="text-[.68rem] font-semibold uppercase tracking-[.08em] text-accent">Legacy Mode · وضع الإرث</span>
            <h3 className="mt-1 font-display text-xl font-semibold text-ink">ما الذي يتكرر في فكرك، وما الذي يبقى ممثلاً له عبر الزمن؟</h3>
            <p className="mt-2 text-[.78rem] leading-[1.8] text-soft">ليس Analytics. هذه قراءة تركيبية للرسم المعرفي نفسه: المحاور الأعلى حضوراً، المواد المركزية، والامتدادات الزمنية الموثقة داخل الأرشيف.</p>
          </div>
          <div className="flex flex-wrap gap-1.5 text-[.66rem] text-soft">
            <span className="rounded-full border border-hair bg-wash px-3 py-1.5">{profile.stats?.themes || themes.length} محوراً</span>
            <span className="rounded-full border border-hair bg-wash px-3 py-1.5">{profile.stats?.years || timeline.length} سنة موثقة</span>
          </div>
        </div>
        {profile.note && <p className="mt-4 rounded-xl border border-hair bg-wash px-4 py-3 text-[.7rem] leading-relaxed text-soft">{profile.note}</p>}
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.05fr_.95fr]">
        <section className="rounded-2xl border border-hair bg-canvas p-4 sm:p-5">
          <span className="text-[.66rem] font-semibold text-accent">البصمة الفكرية المتكررة</span>
          <h4 className="mt-1 font-display text-lg font-semibold text-ink">المحاور التي تربط أنواعاً متعددة من إنتاجك</h4>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {themes.slice(0, 8).map((theme, index) => (
              <div key={theme.id} className="rounded-xl border border-hair bg-wash p-3.5">
                <div className="flex items-start justify-between gap-3">
                  <strong className="text-[.82rem] leading-relaxed text-ink">{theme.title}</strong>
                  <span className="shrink-0 font-display text-[.72rem] font-semibold text-accent">0{index + 1}</span>
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5 text-[.62rem] text-soft">
                  <span>{theme.support} مواد مرتبطة</span>
                  {theme.firstYear && theme.lastYear && <span>· {theme.firstYear === theme.lastYear ? theme.firstYear : `${theme.firstYear}—${theme.lastYear}`}</span>}
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-hair bg-canvas p-4 sm:p-5">
          <span className="text-[.66rem] font-semibold text-accent">مواد مركزية</span>
          <h4 className="mt-1 font-display text-lg font-semibold text-ink">عُقد تصل بين أكبر عدد من الأفكار</h4>
          <div className="mt-4 grid gap-2">
            {representatives.slice(0, 6).map((item) => <OpenItem key={item.id} item={item} />)}
          </div>
        </section>
      </div>

      <section className="rounded-2xl border border-hair bg-canvas p-4 sm:p-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <span className="text-[.66rem] font-semibold text-accent">الخط الزمني</span>
            <h4 className="mt-1 font-display text-lg font-semibold text-ink">كيف يتراكم الأرشيف الموثق عبر السنوات؟</h4>
          </div>
          <span className="text-[.64rem] text-soft">آخر {recentTimeline.length} سنوات متاحة في البيانات</span>
        </div>
        <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-5 lg:grid-cols-10">
          {recentTimeline.map((item) => (
            <div key={item.year} className="flex min-h-28 flex-col justify-end rounded-xl border border-hair bg-wash p-3">
              <span className="mb-2 block w-full rounded-full bg-accent/20" style={{ height: `${Math.max(4, Math.round((item.count / maxYearCount) * 42))}px` }} aria-hidden="true" />
              <strong className="font-display text-[.8rem] text-ink">{item.year}</strong>
              <span className="mt-1 text-[.62rem] text-soft">{item.count} مادة</span>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-hair bg-canvas p-4 sm:p-5">
        <span className="text-[.66rem] font-semibold text-accent">امتدادات طويلة</span>
        <h4 className="mt-1 font-display text-lg font-semibold text-ink">أفكار تعود في أكثر من زمن</h4>
        <p className="mt-2 text-[.72rem] leading-relaxed text-soft">نسمّيها امتداداً لا «تغيّر موقف»؛ التحول لا يُنسب إلا إذا كان الأرشيف نفسه يثبته.</p>
        <div className="mt-4 grid gap-2 md:grid-cols-2 xl:grid-cols-4">
          {arcs.slice(0, 8).map((arc) => (
            <div key={arc.id} className="rounded-xl border border-hair bg-wash p-3.5">
              <strong className="block text-[.8rem] leading-relaxed text-ink">{arc.title}</strong>
              <span className="mt-2 block font-display text-[.72rem] font-semibold text-accent">{arc.firstYear} → {arc.lastYear}</span>
              <span className="mt-1 block text-[.62rem] text-soft">{arc.support} مواد متصلة</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
