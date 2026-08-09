import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { Link } from 'react-router'
import { useSeo } from '../components/seo'
import { FadeUp, Page, PageHead, sharedViewName } from '../components/ui'
import { useCmsContent } from '../lib/content'
import { MediaSaveButton } from '../components/MySpace'
import { SocialIcon } from '../components/icons'
import { mergeMediaArchive, searchArchiveMoments, formatMediaTime } from '../lib/media-archive'
import { arabicCountPhrase, MOMENT_MATCH_FORMS } from '../lib/arabic-count.ts'

const kindLabel: Record<string, string> = {
  youtube: 'يوتيوب', television: 'تلفزيون', radio: 'إذاعة', audio: 'إذاعة', podcast: 'بودكاست',
}

export default function Media() {
  const { media: cmsMedia } = useCmsContent()
  const media = useMemo(() => mergeMediaArchive(cmsMedia), [cmsMedia])
  const [query, setQuery] = useState('')
  const [visibleCount, setVisibleCount] = useState(25)
  const moments = useMemo(() => searchArchiveMoments(query, media), [query, media])
  const visibleMedia = useMemo(() => media.slice(0, visibleCount), [media, visibleCount])
  useEffect(() => { setVisibleCount((count) => Math.min(Math.max(25, count), Math.max(25, media.length))) }, [media.length])
  useSeo({ title: 'الأرشيف الإعلامي', path: '/media', description: 'أرشيف مرئي ومسموع قابل للبحث داخل اللحظة، يجمع اللقاءات التلفزيونية والإذاعية واستضافات يوتيوب.' })

  return <Page className="content-media page-journey">
    <PageHead label="الأرشيف الإعلامي" title="الفكرة كما قيلت، في لحظتها." />


    <section className="media-archive-body px-6 py-5 md:px-11 md:py-8">
      <div className="mx-auto max-w-shell">
        <FadeUp>
          <div className="media-search-shell rounded-2xl border border-hair bg-wash p-3 md:rounded-[1.6rem] md:p-6">
            <label className="media-search-label block text-[.72rem] font-bold text-accent md:text-[.74rem]" htmlFor="media-search">ابحث داخل ما قيل</label>
            <div className="media-search-input mt-2 flex items-center gap-3 rounded-xl border border-hair bg-canvas px-3 focus-within:border-accent md:mt-3 md:rounded-2xl md:px-4">
              <span aria-hidden className="text-accent">⌕</span>
              <input id="media-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="مثال: التعليم الإلكتروني، الذكاء الاصطناعي، المهارات…" className="min-w-0 flex-1 self-stretch bg-transparent py-2.5 text-base text-ink outline-none placeholder:text-soft/70 md:py-3 md:text-[.92rem]" />
              {query && <button type="button" onClick={() => setQuery('')} className="text-[.72rem] text-soft hover:text-accent">مسح</button>}
            </div>
            <p className="media-search-note measure mt-2 text-[.68rem] leading-relaxed text-soft md:mt-3 md:text-[.7rem]">عند وجود تفريغ زمني موثّق، تنقلك النتيجة مباشرة إلى اللحظة التي قيلت فيها العبارة.</p>
          </div>
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

        <div className="spatial-collection media-archive-grid mt-6 grid gap-3 md:mt-10 md:grid-cols-2 md:gap-6 xl:grid-cols-3">
          {visibleMedia.map((item, mediaIndex) => {
            const video = item.id && item.kind !== 'audio' && item.kind !== 'radio'
            const available = Boolean(item.transcript?.available)
            const thumbnail = item.thumbnail || (item.id ? `https://i.ytimg.com/vi/${item.id}/hqdefault.jpg` : '')
            return <article key={item.slug} className={`media-archive-card spatial-card group relative overflow-hidden rounded-[1.35rem] border border-hair bg-canvas transition-colors hover:border-accent ${mediaIndex === 0 ? 'is-featured' : 'is-compact-mobile'}`}>
              <Link to={`/media/${item.slug}`} viewTransition className="block">
                <div className={`spatial-media relative overflow-hidden bg-wash ${video ? 'complete-media-frame' : ''}`} style={{ aspectRatio: '16 / 9', viewTransitionName: sharedViewName('media-visual', item.slug), ['--spatial-image' as string]: thumbnail ? `url(${thumbnail})` : 'none', ...(video ? ({ '--media-thumb': `url(${thumbnail})` } as CSSProperties) : {}) }}>
                  {video ? <><img decoding="async" src={thumbnail} alt="" loading="lazy" onLoad={(event) => { const img = event.currentTarget; if (!item.thumbnail && img.naturalWidth <= 120 && img.src.includes('/hqdefault.')) img.src = `https://i.ytimg.com/vi/${item.id}/mqdefault.jpg`; }} onError={(event) => { const img = event.currentTarget; if (img.src.includes('/hqdefault.')) img.src = `https://i.ytimg.com/vi/${item.id}/mqdefault.jpg`; else img.style.display = 'none'; }} className="complete-media-image h-full w-full" /><span className="cinematic-play" aria-hidden><SocialIcon name="Play" size={16} /></span></> : <div className="flex h-full items-center justify-center"><div className="text-center"><span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border border-accent/25 bg-canvas text-accent"><SocialIcon name="Play" size={19} /></span><span className="mt-3 hidden text-[.72rem] font-semibold text-soft sm:block">مادة إذاعية</span></div></div>}
                  <span className="absolute right-3 top-3 hidden rounded-full border border-white/50 bg-ink/[.55] px-3 py-1 text-[.65rem] text-white backdrop-blur sm:inline-flex">{kindLabel[item.kind] || 'ظهور إعلامي'}</span>
                  {available && <span className="absolute bottom-3 right-3 hidden rounded-full bg-accent px-3 py-1 text-[.62rem] font-bold text-white sm:inline-flex">مفهرس زمنياً</span>}
                </div>
                <div className="p-5">
                  <div className="mb-2 flex flex-wrap items-center gap-2 text-[.64rem] sm:hidden">
                    <span className="font-semibold text-accent">{kindLabel[item.kind] || 'ظهور إعلامي'}</span>
                    {available && <><span className="text-hair">·</span><span className="font-semibold text-soft">مفهرس زمنياً</span></>}
                  </div>
                  <div className="flex items-center justify-between gap-3 text-[.68rem] text-soft"><span className="font-semibold text-accent">{item.program || item.outlet}</span><span dir="ltr">{item.duration || ''}</span></div>
                  <h2 style={{ viewTransitionName: sharedViewName('media-title', item.slug) }} className="mt-2 line-clamp-3 font-display text-[1.08rem] font-semibold leading-[1.65] text-ink">{item.title}</h2>
                  <p className="mt-2 line-clamp-2 min-h-[2.7rem] text-[.74rem] leading-relaxed text-soft">{item.topics || (available ? 'يمكن البحث داخل هذا اللقاء والانتقال إلى اللحظة الدقيقة.' : 'مادة محفوظة في الأرشيف الإعلامي.')}</p>
                  <div className="mt-4 flex items-center justify-between border-t border-hair pt-4 text-[.7rem]"><span className="text-soft">{item.outlet}</span><span className="font-semibold text-accent">افتح الأرشيف ←</span></div>
                </div>
              </Link>
              <MediaSaveButton slug={item.slug} className="absolute left-3 top-3 border-white/70 bg-canvas/90 backdrop-blur" />
            </article>
          })}
        </div>
        {visibleCount < media.length && (
          <div className="mt-7 flex justify-center">
            <button type="button" onClick={() => setVisibleCount((count) => Math.min(media.length, count + 24))} className="min-h-11 rounded-full border border-hair px-5 text-[.76rem] font-semibold text-soft transition-colors hover:border-accent hover:text-accent">
              أظهر المزيد <span className="ms-1 text-[.68rem] opacity-75">({Math.min(24, media.length - visibleCount).toLocaleString('en-US')})</span>
            </button>
          </div>
        )}
      </div>
    </section>
  </Page>
}
