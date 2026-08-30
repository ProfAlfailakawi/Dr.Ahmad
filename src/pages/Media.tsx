import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { Link } from 'react-router'
import { useSeo } from '../components/seo'
import { FadeUp, Page, PageHead, sharedViewName } from '../components/ui'
import { useCmsContent } from '../lib/content'
import { MediaSaveButton } from '../components/MySpace'
import { SocialIcon } from '../components/icons'
import { mergeMediaArchive, searchArchiveMoments, formatMediaTime, ensureArchiveTranscripts, useArchiveTranscripts } from '../lib/media-archive'
import { arabicCountPhrase, MOMENT_MATCH_FORMS } from '../lib/arabic-count.ts'

const kindLabel: Record<string, string> = {
  youtube: 'يوتيوب', television: 'تلفزيون', radio: 'إذاعة', audio: 'إذاعة', podcast: 'بودكاست',
}

/* حين لا صورة للظهور (لقاء إذاعي/صوتي، أو صورة يوتيوب سقطت)، لا نترك مربّعاً
   رمادياً فارغاً — بل هويةً بصريةً مصمَّمة: موجةٌ صوتية بلون العلامة على تدرّج
   هادئ، فيقرأ الكرت مقصوداً لا ناقصاً. مبنيّة كلها من SVG/CSS بلا أي أصلٍ خارجي. */
const POSTER_BARS = [14, 26, 40, 28, 52, 34, 60, 42, 66, 48, 66, 42, 60, 34, 52, 28, 40, 26, 14]
function MediaPoster({ hidden = false, compact = false }: { hidden?: boolean; compact?: boolean }) {
  return <div className={`media-poster${compact ? ' media-poster--compact' : ''}`} hidden={hidden} aria-hidden="true">
    <svg className="media-poster__wave" viewBox="0 0 240 120" preserveAspectRatio="xMidYMid meet" role="presentation" focusable="false">
      {POSTER_BARS.map((height, index) => <rect key={index} x={12 + index * 12} y={(120 - height) / 2} width={5} height={height} rx={2.5} style={{ opacity: 0.32 + (height / 66) * 0.5 }} />)}
    </svg>
  </div>
}
/* عند فشل صورة الفيديو: أخفِ الصورة واكشف البديل المصمَّم بدل مربّعٍ فارغ. */
const revealPoster = (img: HTMLImageElement) => {
  img.style.display = 'none'
  const poster = img.closest('.spatial-media, .media-editorial-row__visual')?.querySelector<HTMLElement>('.media-poster')
  if (poster) poster.hidden = false
}

const mediaYear = (item: { iso?: string; date?: string }) => {
  const match = String(item.iso || item.date || '').match(/(?:19|20)\d{2}/)
  return match?.[0] || ''
}

const mediaAppearanceOrder = (item: { iso?: string; date?: string }) => {
  const iso = String(item.iso || '').trim()
  const exact = iso.match(/^((?:19|20)\d{2})-(\d{2})-(\d{2})/)
  if (exact) return Number(`${exact[1]}${exact[2]}${exact[3]}`)
  const year = mediaYear(item)
  return year ? Number(year) * 10_000 : 0
}

export default function Media() {
  const { media: cmsMedia } = useCmsContent()
  const media = useMemo(() => mergeMediaArchive(cmsMedia).sort((left, right) => mediaAppearanceOrder(right) - mediaAppearanceOrder(left)), [cmsMedia])
  const [query, setQuery] = useState('')
  const [visibleCount, setVisibleCount] = useState(25)
  const [yearFilter, setYearFilter] = useState('all')
  const [kindFilter, setKindFilter] = useState('all')
  const archiveYears = useMemo(() => Array.from(new Set(media.map((item) => mediaYear(item)).filter(Boolean))).sort((a, b) => Number(b) - Number(a)), [media])
  const archiveKinds = useMemo(() => Array.from(new Set(media.map((item) => item.kind).filter(Boolean))), [media])
  const filteredMedia = useMemo(() => media.filter((item) => {
    const year = mediaYear(item)
    return (yearFilter === 'all' || year === yearFilter) && (kindFilter === 'all' || item.kind === kindFilter)
  }), [kindFilter, media, yearFilter])
  /* البحث داخل الكلام يحتاج المقاطع كاملة (١٫١ ميغابايت)، والقائمة لا تحتاجها.
     فتُجلب في أول فراغٍ للمتصفح بعد رسم الصفحة — أو فور لمس حقل البحث إن سبق الزائرُ
     الفراغ — فلا تُثقل الفتحة الأولى ولا يشعر الباحث بانتظار. */
  const transcriptsRevision = useArchiveTranscripts()
  useEffect(() => {
    const idle = window.requestIdleCallback?.(() => { void ensureArchiveTranscripts() }, { timeout: 2500 })
    const timer = idle === undefined ? window.setTimeout(() => { void ensureArchiveTranscripts() }, 1200) : 0
    return () => { if (idle !== undefined) window.cancelIdleCallback?.(idle); else window.clearTimeout(timer) }
  }, [])
  const moments = useMemo(() => searchArchiveMoments(query, filteredMedia), [query, filteredMedia, transcriptsRevision])
  const visibleMedia = useMemo(() => filteredMedia.slice(0, visibleCount), [filteredMedia, visibleCount])
  const featuredMedia = useMemo(() => visibleMedia.slice(0, 3), [visibleMedia])
  const archiveGroups = useMemo(() => {
    const groups = new Map<string, typeof visibleMedia>()
    for (const item of visibleMedia.slice(3)) {
      const year = mediaYear(item) || 'قيد التحقق'
      const current = groups.get(year) || []
      current.push(item)
      groups.set(year, current)
    }
    return Array.from(groups.entries())
  }, [visibleMedia])

  useEffect(() => { setVisibleCount(25) }, [yearFilter, kindFilter])
  useEffect(() => { setVisibleCount((count) => Math.min(Math.max(25, count), Math.max(25, filteredMedia.length))) }, [filteredMedia.length])
  useSeo({ title: 'الأرشيف الإعلامي', path: '/media', description: 'أرشيف مرئي ومسموع قابل للبحث داخل اللحظة، يجمع اللقاءات التلفزيونية والإذاعية واستضافات يوتيوب.' })

  return <Page className="content-media page-journey">
    <PageHead label="الأرشيف الإعلامي" title="الفكرة كما قيلت، في لحظتها." />

    <section className="media-archive-body editorial-breath-section px-6 py-5 md:px-11 md:py-8">
      <div className="mx-auto max-w-shell">
        <FadeUp>
          <div className="media-search-shell rounded-2xl border border-hair bg-wash p-3 md:rounded-[1.6rem] md:p-6">
            <label className="media-search-label block text-[.72rem] font-bold text-accent md:text-[.74rem]" htmlFor="media-search">ابحث داخل ما قيل</label>
            <div className="media-search-input mt-2 flex items-center gap-3 rounded-xl border border-hair bg-canvas px-3 focus-within:border-accent md:mt-3 md:rounded-2xl md:px-4">
              <span aria-hidden className="text-accent">⌕</span>
              <input id="media-search" value={query} onFocus={() => { void ensureArchiveTranscripts() }} onChange={(event) => setQuery(event.target.value)} placeholder="مثال: التعليم الإلكتروني، الذكاء الاصطناعي" className="min-w-0 flex-1 self-stretch bg-transparent py-2.5 text-base text-ink outline-none placeholder:text-soft/70 md:py-3 md:text-[.92rem]" />
              {query && <button type="button" onClick={() => setQuery('')} className="text-[.72rem] text-soft hover:text-accent">مسح</button>}
            </div>
            <p className="media-search-note measure mt-2 text-[.68rem] leading-relaxed text-soft md:mt-3 md:text-[.7rem]">عند وجود تفريغ زمني موثّق، تنقلك النتيجة مباشرة إلى اللحظة التي قيلت فيها العبارة.</p>
          </div>
        </FadeUp>

        <FadeUp delay={0.04}>
          <section className="media-archive-index mt-6 border-y border-hair py-4" aria-label="فهرس الأرشيف الإعلامي">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <span className="editorial-micro-label text-[.66rem] font-semibold text-accent">المسار الإعلامي</span>
                <p className="mt-1 text-[.7rem] font-light text-soft">{filteredMedia.length.toLocaleString('en-US')} ظهوراً في النطاق الحالي</p>
              </div>
              {(yearFilter !== 'all' || kindFilter !== 'all') && <button type="button" onClick={() => { setYearFilter('all'); setKindFilter('all') }} className="border-b border-accent/[.35] pb-0.5 text-[.68rem] font-semibold text-accent">إظهار الكل</button>}
            </div>
            <div className="editorial-tablist edge-fade mt-3 flex gap-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" role="group" aria-label="تصفية حسب السنة">
              <button type="button" onClick={() => setYearFilter('all')} aria-pressed={yearFilter === 'all'} className={`editorial-tab shrink-0 px-3 py-1.5 text-[.7rem] font-semibold ${yearFilter === 'all' ? 'is-active' : ''}`}>كل السنوات</button>
              {archiveYears.map((year) => <button key={year} type="button" onClick={() => setYearFilter(year)} aria-pressed={yearFilter === year} className={`editorial-tab shrink-0 px-3 py-1.5 font-mono text-[.7rem] ${yearFilter === year ? 'is-active' : ''}`}>{year}</button>)}
            </div>
            <div className="editorial-tablist edge-fade mt-1 flex gap-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" role="group" aria-label="تصفية حسب نوع الظهور">
              <button type="button" onClick={() => setKindFilter('all')} aria-pressed={kindFilter === 'all'} className={`editorial-tab shrink-0 px-3 py-1.5 text-[.68rem] font-medium ${kindFilter === 'all' ? 'is-active' : ''}`}>كل الأنواع</button>
              {archiveKinds.map((kind) => <button key={kind} type="button" onClick={() => setKindFilter(kind)} aria-pressed={kindFilter === kind} className={`editorial-tab shrink-0 px-3 py-1.5 text-[.68rem] font-medium ${kindFilter === kind ? 'is-active' : ''}`}>{kindLabel[kind] || 'ظهور إعلامي'}</button>)}
            </div>
          </section>
        </FadeUp>

        {query.trim() && <FadeUp>
          <section className="mt-7" aria-label="نتائج البحث داخل اللقاءات">
            <div className="flex items-end justify-between gap-4"><div><span className="text-[.7rem] font-semibold text-accent">نتائج داخل الكلام</span><h2 className="mt-1 font-display text-2xl font-semibold text-ink">{moments.length ? arabicCountPhrase(moments.length, MOMENT_MATCH_FORMS) : 'لا توجد لحظة موثقة مطابقة'}</h2></div></div>
            {moments.length > 0 && <div className="mt-4 grid gap-3">
              {moments.slice(0, 10).map(({ item, segment }, index) => <Link key={`${item.id}-${segment.start}-${index}`} to={`/media/${item.slug}?t=${Math.floor(segment.start)}`} viewTransition className="group grid gap-3 rounded-2xl border border-hair bg-canvas p-4 transition hover:border-accent md:grid-cols-[8rem_minmax(0,1fr)_auto] md:items-center">
                <span className="font-mono text-[.78rem] font-bold text-accent">{formatMediaTime(segment.start)}</span>
                <span><strong className="block text-[.88rem] text-ink">{item.title}</strong><span className="mt-1 line-clamp-2 block text-[.76rem] leading-relaxed text-soft">{segment.displayText || segment.text}</span></span>
                <span className="text-[.72rem] font-semibold text-accent transition-transform group-hover:-translate-x-1">شاهد من اللحظة ←</span>
              </Link>)}
            </div>}
          </section>
        </FadeUp>}

        {featuredMedia.length > 0 && (
          <FadeUp delay={0.04}>
            <section className="media-editorial-feature mt-8 md:mt-14" aria-label="أبرز الظهورات الإعلامية">
              <div className="media-editorial-intro mb-6 flex items-end justify-between gap-5 border-b border-hair pb-4">
                <div>
                  <span className="editorial-micro-label text-[.68rem] font-semibold text-accent">الواجهة الإعلامية</span>
                  <h2 className="mt-2 font-display text-[clamp(1.55rem,3.2vw,2.35rem)] font-semibold text-ink">محطات تستحق أن تبدأ منها.</h2>
                </div>
                <span className="hidden text-[.7rem] text-soft sm:block">ثم يتكثف الأرشيف إلى مسار زمني سريع.</span>
              </div>

              <div className="media-feature-grid spatial-collection">
                {featuredMedia.map((item, mediaIndex) => {
                  const video = item.id && item.kind !== 'audio' && item.kind !== 'radio'
                  const available = Boolean(item.transcript?.available)
                  const thumbnail = item.thumbnail || (item.id ? `https://i.ytimg.com/vi/${item.id}/hqdefault.jpg` : '')
                  return <article key={item.slug} className={`media-feature-card spatial-card group relative overflow-hidden border border-hair bg-canvas ${mediaIndex === 0 ? 'is-lead' : 'is-secondary'}`}>
                    <Link to={`/media/${item.slug}`} viewTransition className="block h-full">
                      <div className={`spatial-media relative overflow-hidden bg-wash ${video ? 'complete-media-frame' : ''}`} style={{ aspectRatio: '16 / 9', viewTransitionName: sharedViewName('media-visual', item.slug), ['--spatial-image' as string]: thumbnail ? `url(${thumbnail})` : 'none', ...(video ? ({ '--media-thumb': `url(${thumbnail})` } as CSSProperties) : {}) }}>
                        <MediaPoster hidden={video} />
                        {video && <img decoding="async" src={thumbnail} alt="" loading={mediaIndex === 0 ? 'eager' : 'lazy'} onLoad={(event) => { const img = event.currentTarget; if (!item.thumbnail && img.naturalWidth <= 120 && img.src.includes('/hqdefault.')) img.src = `https://i.ytimg.com/vi/${item.id}/mqdefault.jpg`; }} onError={(event) => { const img = event.currentTarget; if (img.src.includes('/hqdefault.')) img.src = `https://i.ytimg.com/vi/${item.id}/mqdefault.jpg`; else revealPoster(img); }} className="complete-media-image h-full w-full" />}
                        <span className="cinematic-play" aria-hidden><SocialIcon name="Play" size={16} /></span>
                      </div>
                      <div className="p-5 md:p-6">
                        <div className="flex items-center gap-2 text-[.66rem] text-soft"><span className="font-semibold text-accent">{kindLabel[item.kind] || 'ظهور إعلامي'}</span>{available && <><span>·</span><span>مفهرس زمنياً</span></>}</div>
                        <h3 style={{ viewTransitionName: sharedViewName('media-title', item.slug) }} className="mt-2 line-clamp-3 font-display text-[1.04rem] font-semibold leading-[1.65] text-ink md:text-[1.16rem]">{item.title}</h3>
                        <div className="mt-4 flex items-center justify-between border-t border-hair pt-3 text-[.68rem] text-soft"><span>{item.program || item.outlet}</span><span dir="ltr">{item.duration || ''}</span></div>
                      </div>
                    </Link>
                    <MediaSaveButton slug={item.slug} className="absolute left-3 top-3 border-white/70 bg-canvas" />
                  </article>
                })}
              </div>
            </section>
          </FadeUp>
        )}

        {archiveGroups.length > 0 && (
          <section className="media-editorial-archive mt-12 md:mt-20" aria-label="المسار الزمني للأرشيف الإعلامي">
            <FadeUp>
              <div className="mb-7 grid gap-2 border-b border-hair pb-5 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
                <div>
                  <span className="editorial-micro-label text-[.68rem] font-semibold text-accent">المسار الإعلامي</span>
                  <h2 className="mt-2 font-display text-[clamp(1.65rem,3.6vw,2.55rem)] font-semibold text-ink">تاريخ يُقرأ، لا جدار فيديوهات.</h2>
                </div>
                <p className="max-w-[34rem] text-[.75rem] font-light leading-relaxed text-soft md:text-left">كل ظهور محطة؛ الصورة أصغر، والمعلومة أسرع، والأرشيف يبقى مريحاً حتى لو صار بالآلاف.</p>
              </div>
            </FadeUp>

            <div className="media-year-groups">
              {archiveGroups.map(([year, items]) => (
                <div key={year} className="media-year-group">
                  <div className="media-year-mark" aria-hidden="true"><span>{year}</span><i /></div>
                  <div className="media-year-items">
                    {items.map((item) => {
                      const video = item.id && item.kind !== 'audio' && item.kind !== 'radio'
                      const thumbnail = item.thumbnail || (item.id ? `https://i.ytimg.com/vi/${item.id}/mqdefault.jpg` : '')
                      return <article key={item.slug} className="media-editorial-row group relative">
                        <Link to={`/media/${item.slug}`} viewTransition className="media-editorial-row__link">
                          <div className="media-editorial-row__visual" style={{ ['--spatial-image' as string]: thumbnail ? `url(${thumbnail})` : 'none' }}>
                            <MediaPoster hidden={Boolean(video && thumbnail)} compact />
                            {video && thumbnail && <img src={thumbnail} alt="" loading="lazy" decoding="async" onError={(event) => revealPoster(event.currentTarget)} />}
                          </div>
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2 text-[.62rem] text-soft"><span className="font-semibold text-accent">{kindLabel[item.kind] || 'ظهور إعلامي'}</span><span>·</span><span>{item.outlet || item.program}</span>{item.date && <><span>·</span><time>{item.date}</time></>}</div>
                            <h3 className="mt-1 line-clamp-2 text-[.92rem] font-semibold leading-[1.65] text-ink transition-colors group-hover:text-accent md:text-[1rem]">{item.title}</h3>
                          </div>
                          <span className="media-editorial-row__meta" dir="ltr">{item.duration || '↗'}</span>
                        </Link>
                        <MediaSaveButton slug={item.slug} className="media-editorial-row__save" />
                      </article>
                    })}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {visibleCount < filteredMedia.length && (
          <div className="mt-10 flex justify-center">
            <button type="button" onClick={() => setVisibleCount((count) => Math.min(filteredMedia.length, count + 24))} className="editorial-more-link min-h-11 px-2 text-[.76rem] font-semibold text-soft transition-colors hover:text-accent">
              أظهر المزيد <span className="ms-1 text-[.68rem] opacity-75">({Math.min(24, filteredMedia.length - visibleCount).toLocaleString('en-US')})</span>
            </button>
          </div>
        )}
      </div>
    </section>
  </Page>
}
