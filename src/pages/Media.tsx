import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { Link, useSearchParams } from 'react-router'
import { useSeo } from '../components/seo'
import { FadeUp, Page, PageHead, sharedViewName } from '../components/ui'
import { useCmsContent } from '../lib/content'
import { MediaSaveButton } from '../components/MySpace'
import { SocialIcon } from '../components/icons'
import { mergeMediaArchive, searchArchiveMoments, formatMediaTime, ensureArchiveTranscripts, useArchiveTranscripts } from '../lib/media-archive'
import { arabicCountPhrase, MOMENT_MATCH_FORMS } from '../lib/arabic-count.ts'
import { ContextualViewer } from '../components/ContextualViewer'

const kindLabel: Record<string, string> = {
  youtube: 'يوتيوب', television: 'تلفزيون', radio: 'إذاعة', audio: 'إذاعة', podcast: 'بودكاست',
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
  const [searchParams, setSearchParams] = useSearchParams()
  const [query, setQuery] = useState('')
  const [visibleCount, setVisibleCount] = useState(25)
  const yearFilter = searchParams.get('year') || 'all'
  const kindFilter = searchParams.get('kind') || 'all'
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

  const selectedSlug = searchParams.get('item') || ''
  const selectedMedia = filteredMedia.find((item) => item.slug === selectedSlug)
  const selectedIndex = selectedMedia ? filteredMedia.findIndex((item) => item.slug === selectedMedia.slug) : -1
  const setParam = (key: 'year' | 'kind' | 'item', value: string, replace = true) => {
    const next = new URLSearchParams(searchParams)
    if (!value || value === 'all') next.delete(key)
    else next.set(key, value)
    if (key !== 'item') next.delete('item')
    setSearchParams(next, { replace })
  }
  const itemHref = (slug: string) => {
    const next = new URLSearchParams(searchParams)
    next.set('item', slug)
    return `?${next.toString()}`
  }

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
              {(yearFilter !== 'all' || kindFilter !== 'all') && <button type="button" onClick={() => { const next = new URLSearchParams(searchParams); next.delete('year'); next.delete('kind'); next.delete('item'); setSearchParams(next, { replace: true }) }} className="border-b border-accent/[.35] pb-0.5 text-[.68rem] font-semibold text-accent">إظهار الكل</button>}
            </div>
            <div className="editorial-tablist edge-fade mt-3 flex gap-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" role="group" aria-label="تصفية حسب السنة">
              <button type="button" onClick={() => setParam('year', 'all')} aria-pressed={yearFilter === 'all'} className={`editorial-tab shrink-0 px-3 py-1.5 text-[.7rem] font-semibold ${yearFilter === 'all' ? 'is-active' : ''}`}>كل السنوات</button>
              {archiveYears.map((year) => <button key={year} type="button" onClick={() => setParam('year', year)} aria-pressed={yearFilter === year} className={`editorial-tab shrink-0 px-3 py-1.5 font-mono text-[.7rem] ${yearFilter === year ? 'is-active' : ''}`}>{year}</button>)}
            </div>
            <div className="editorial-tablist edge-fade mt-1 flex gap-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" role="group" aria-label="تصفية حسب نوع الظهور">
              <button type="button" onClick={() => setParam('kind', 'all')} aria-pressed={kindFilter === 'all'} className={`editorial-tab shrink-0 px-3 py-1.5 text-[.68rem] font-medium ${kindFilter === 'all' ? 'is-active' : ''}`}>كل الأنواع</button>
              {archiveKinds.map((kind) => <button key={kind} type="button" onClick={() => setParam('kind', kind)} aria-pressed={kindFilter === kind} className={`editorial-tab shrink-0 px-3 py-1.5 text-[.68rem] font-medium ${kindFilter === kind ? 'is-active' : ''}`}>{kindLabel[kind] || 'ظهور إعلامي'}</button>)}
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
                    <Link to={itemHref(item.slug)} className="block h-full" aria-label={`معاينة ${item.title}`}>
                      <div className={`spatial-media relative overflow-hidden bg-wash ${video ? 'complete-media-frame' : ''}`} style={{ aspectRatio: '16 / 9', viewTransitionName: sharedViewName('media-visual', item.slug), ['--spatial-image' as string]: thumbnail ? `url(${thumbnail})` : 'none', ...(video ? ({ '--media-thumb': `url(${thumbnail})` } as CSSProperties) : {}) }}>
                        {video ? <><img decoding="async" src={thumbnail} alt="" loading={mediaIndex === 0 ? 'eager' : 'lazy'} onLoad={(event) => { const img = event.currentTarget; if (!item.thumbnail && img.naturalWidth <= 120 && img.src.includes('/hqdefault.')) img.src = `https://i.ytimg.com/vi/${item.id}/mqdefault.jpg`; }} onError={(event) => { const img = event.currentTarget; if (img.src.includes('/hqdefault.')) img.src = `https://i.ytimg.com/vi/${item.id}/mqdefault.jpg`; else img.style.display = 'none'; }} className="complete-media-image h-full w-full" /><span className="cinematic-play" aria-hidden><SocialIcon name="Play" size={16} /></span></> : <div className="flex h-full items-center justify-center"><div className="text-center"><span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-accent/25 bg-canvas text-accent"><SocialIcon name="Play" size={18} /></span></div></div>}
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
                        <Link to={itemHref(item.slug)} className="media-editorial-row__link" aria-label={`معاينة ${item.title}`}>
                          <div className="media-editorial-row__visual" style={{ ['--spatial-image' as string]: thumbnail ? `url(${thumbnail})` : 'none' }}>
                            {video && thumbnail ? <img src={thumbnail} alt="" loading="lazy" decoding="async" /> : <span aria-hidden><SocialIcon name="Play" size={15} /></span>}
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

    <ContextualViewer
      open={Boolean(selectedMedia)}
      onClose={() => setParam('item', '')}
      eyebrow={selectedMedia ? `${kindLabel[selectedMedia.kind] || 'ظهور إعلامي'} · ${selectedMedia.outlet || selectedMedia.program || ''}` : 'الأرشيف الإعلامي'}
      title={selectedMedia?.title || ''}
      description={selectedMedia?.topics || 'معاينة هادئة داخل سياق الأرشيف؛ التشغيل لا يبدأ إلا حين تختار فتح المادة.'}
      visual={selectedMedia ? (() => {
        const video = selectedMedia.id && selectedMedia.kind !== 'audio' && selectedMedia.kind !== 'radio'
        const thumbnail = video ? (selectedMedia.thumbnail || `https://i.ytimg.com/vi/${selectedMedia.id}/hqdefault.jpg`) : '/podcast-cover.png'
        return <div className={video ? 'h-full w-full' : 'media-context-audio'}><img src={thumbnail} alt="" decoding="async" className={video ? 'h-full w-full object-cover' : 'h-full w-full object-contain'} /></div>
      })() : null}
      onPrevious={selectedIndex > 0 ? () => setParam('item', filteredMedia[selectedIndex - 1].slug, false) : undefined}
      onNext={selectedIndex >= 0 && selectedIndex < filteredMedia.length - 1 ? () => setParam('item', filteredMedia[selectedIndex + 1].slug, false) : undefined}
      position={selectedIndex >= 0 ? `${selectedIndex + 1} / ${filteredMedia.length}` : undefined}
      footer={selectedMedia ? <div className="flex flex-wrap items-center gap-3">
        <Link to={`/media/${selectedMedia.slug}`} viewTransition className="context-viewer-primary">افتح المادة كاملة ←</Link>
        <MediaSaveButton slug={selectedMedia.slug} className="context-viewer-save" />
      </div> : undefined}
    >
      {selectedMedia && <dl className="context-viewer-facts">
        {selectedMedia.date && <div><dt>التاريخ</dt><dd>{selectedMedia.date}</dd></div>}
        {selectedMedia.duration && <div><dt>المدة</dt><dd dir="ltr">{selectedMedia.duration}</dd></div>}
        <div><dt>الفهرسة</dt><dd>{selectedMedia.transcript?.available ? 'متاحة داخل الكلام' : 'بيانات اللقاء فقط'}</dd></div>
      </dl>}
    </ContextualViewer>
  </Page>
}
