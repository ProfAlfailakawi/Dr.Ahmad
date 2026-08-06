import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import { motion, useReducedMotion } from 'framer-motion'
import { useSeo } from '../components/seo'
import { EASE, FadeUp, Page, PageHead } from '../components/ui'
import { useCmsContent } from '../lib/content'
import { MediaSaveButton } from '../components/MySpace'
import { mergeMediaArchive, searchArchiveMoments, formatMediaTime } from '../lib/media-archive'

const kindLabel: Record<string, string> = {
  youtube: 'يوتيوب', television: 'تلفزيون', radio: 'إذاعة', audio: 'إذاعة', podcast: 'بودكاست',
}

export default function Media() {
  const { media: cmsMedia } = useCmsContent()
  const reduce = useReducedMotion()
  const media = useMemo(() => mergeMediaArchive(cmsMedia), [cmsMedia])
  const [query, setQuery] = useState('')
  const [kind, setKind] = useState('الكل')
  const [outlet, setOutlet] = useState('الكل')
  const moments = useMemo(() => searchArchiveMoments(query, media), [query, media])
  const outlets = useMemo(() => [...new Set(media.map((item) => item.outlet).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'ar')), [media])
  const filtered = useMemo(() => media.filter((item) => (kind === 'الكل' || item.kind === kind) && (outlet === 'الكل' || item.outlet === outlet)), [media, kind, outlet])
  const transcribed = media.filter((item) => item.transcript?.available).length
  const audioCount = media.filter((item) => item.kind === 'audio' || item.kind === 'radio').length
  useSeo({ title: 'الأرشيف الإعلامي', path: '/media', description: 'أرشيف مرئي ومسموع قابل للبحث داخل اللحظة، يجمع اللقاءات التلفزيونية والإذاعية واستضافات يوتيوب.' })

  return <Page className="content-media page-journey">
    <PageHead label="الأرشيف الإعلامي" title="الفكرة كما قيلت، في لحظتها." sub="لقاءات مرئية ومسموعة، مفهرسة زمنياً، قابلة للبحث داخل الكلام نفسه." />

    <section className="px-6 pb-8 md:px-11">
      <div className="mx-auto -mt-6 grid max-w-shell gap-3 sm:grid-cols-3">
        {[
          ['المواد', media.length, 'مرئية ومسموعة'],
          ['المفهرس زمنياً', transcribed, 'بحث حتى الثانية'],
          ['مواد إذاعية', audioCount, 'صوتيات مستقلة'],
        ].map(([label, value, note]) => <FadeUp key={String(label)}><div className="rounded-2xl border border-hair bg-canvas p-5 shadow-[0_16px_40px_rgba(20,31,45,.05)]"><span className="text-[.7rem] font-semibold text-accent">{label}</span><strong className="mt-2 block font-display text-3xl text-ink">{value}</strong><span className="mt-1 block text-[.72rem] text-soft">{note}</span></div></FadeUp>)}
      </div>
    </section>

    <section className="px-6 py-8 md:px-11">
      <div className="mx-auto max-w-shell">
        <FadeUp>
          <div className="rounded-[1.6rem] border border-hair bg-wash p-4 md:p-6">
            <label className="block text-[.74rem] font-bold text-accent" htmlFor="media-search">ابحث داخل ما قيل</label>
            <div className="mt-3 flex items-center gap-3 rounded-2xl border border-hair bg-canvas px-4 py-3 focus-within:border-accent">
              <span aria-hidden className="text-accent">⌕</span>
              <input id="media-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="مثال: التعليم الإلكتروني، الذكاء الاصطناعي، المهارات…" className="min-w-0 flex-1 bg-transparent text-[.92rem] text-ink outline-none placeholder:text-soft/70" />
              {query && <button type="button" onClick={() => setQuery('')} className="text-[.72rem] text-soft hover:text-accent">مسح</button>}
            </div>
            <p className="mt-3 text-[.7rem] leading-relaxed text-soft">عند وجود تفريغ زمني موثّق، تنقلك النتيجة مباشرة إلى اللحظة التي قيلت فيها العبارة.</p>
          </div>
        </FadeUp>

        {query.trim() && <FadeUp>
          <section className="mt-7" aria-label="نتائج البحث داخل اللقاءات">
            <div className="flex items-end justify-between gap-4"><div><span className="text-[.7rem] font-semibold text-accent">نتائج داخل الكلام</span><h2 className="mt-1 font-display text-2xl font-semibold text-ink">{moments.length ? `${moments.length} لحظة مطابقة` : 'لا توجد لحظة موثقة مطابقة'}</h2></div></div>
            {moments.length > 0 && <div className="mt-4 grid gap-3">
              {moments.slice(0, 10).map(({ item, segment }, index) => <Link key={`${item.id}-${segment.start}-${index}`} to={`/media/${item.slug}?t=${Math.floor(segment.start)}`} className="group grid gap-3 rounded-2xl border border-hair bg-canvas p-4 transition hover:border-accent md:grid-cols-[8rem_minmax(0,1fr)_auto] md:items-center">
                <span className="font-mono text-[.78rem] font-bold text-accent">{formatMediaTime(segment.start)}</span>
                <span><strong className="block text-[.88rem] text-ink">{item.title}</strong><span className="mt-1 line-clamp-2 block text-[.76rem] leading-relaxed text-soft">{segment.displayText || segment.text}</span></span>
                <span className="text-[.72rem] font-semibold text-accent transition-transform group-hover:-translate-x-1">شاهد من اللحظة ←</span>
              </Link>)}
            </div>}
          </section>
        </FadeUp>}

        <FadeUp>
          <div className="mt-10 flex flex-wrap items-center justify-between gap-4 border-b border-hair pb-4">
            <div className="flex flex-wrap gap-2">
              {[['الكل','الكل'],['youtube','يوتيوب'],['television','تلفزيون'],['audio','إذاعة'],['podcast','بودكاست']].map(([value,label]) => <button key={value} type="button" onClick={() => setKind(value)} className={`rounded-full border px-4 py-2 text-[.74rem] transition ${kind === value ? 'border-accent bg-accent text-white' : 'border-hair bg-canvas text-soft hover:border-accent hover:text-accent'}`}>{label}</button>)}
            </div>
            <select value={outlet} onChange={(event) => setOutlet(event.target.value)} className="rounded-xl border border-hair bg-canvas px-3 py-2 text-[.74rem] text-soft outline-none focus:border-accent"><option value="الكل">كل الجهات</option>{outlets.map((value) => <option key={value} value={value}>{value}</option>)}</select>
          </div>
        </FadeUp>

        <div className="mt-7 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((item, index) => {
            const video = item.id && item.kind !== 'audio' && item.kind !== 'radio'
            const available = Boolean(item.transcript?.available)
            return <motion.article key={item.slug} initial={reduce ? false : { opacity: 0, y: 14 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: .15 }} transition={{ duration: .55, delay: Math.min(index * .035, .2), ease: EASE }} className="group relative overflow-hidden rounded-[1.35rem] border border-hair bg-canvas transition hover:-translate-y-1 hover:border-accent hover:shadow-[0_20px_50px_rgba(20,31,45,.08)]">
              <Link to={`/media/${item.slug}`} className="block">
                <div className="relative overflow-hidden bg-wash" style={{ aspectRatio: '16 / 9' }}>
                  {video ? <img src={item.thumbnail || `https://i.ytimg.com/vi/${item.id}/hqdefault.jpg`} alt="" loading="lazy" className="h-full w-full object-cover transition duration-700 group-hover:scale-[1.025]" /> : <div className="flex h-full items-center justify-center"><div className="text-center"><span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border border-accent/25 bg-canvas text-2xl text-accent">◉</span><span className="mt-3 block text-[.72rem] font-semibold text-soft">مادة إذاعية</span></div></div>}
                  <span className="absolute right-3 top-3 rounded-full border border-white/50 bg-ink/55 px-3 py-1 text-[.65rem] text-white backdrop-blur">{kindLabel[item.kind] || 'ظهور إعلامي'}</span>
                  {available && <span className="absolute bottom-3 right-3 rounded-full bg-accent px-3 py-1 text-[.62rem] font-bold text-white">مفهرس زمنياً</span>}
                </div>
                <div className="p-5">
                  <div className="flex items-center justify-between gap-3 text-[.68rem] text-soft"><span className="font-semibold text-accent">{item.program || item.outlet}</span><span dir="ltr">{item.duration || ''}</span></div>
                  <h2 className="mt-2 font-display text-[1.08rem] font-semibold leading-[1.65] text-ink">{item.title}</h2>
                  <p className="mt-2 line-clamp-2 min-h-[2.7rem] text-[.74rem] leading-relaxed text-soft">{item.topics || (available ? 'يمكن البحث داخل هذا اللقاء والانتقال إلى اللحظة الدقيقة.' : 'مادة محفوظة في الأرشيف الإعلامي.')}</p>
                  <div className="mt-4 flex items-center justify-between border-t border-hair pt-4 text-[.7rem]"><span className="text-soft">{item.outlet}</span><span className="font-semibold text-accent">افتح الأرشيف ←</span></div>
                </div>
              </Link>
              <MediaSaveButton slug={item.slug} className="absolute left-3 top-3 border-white/70 bg-canvas/90 backdrop-blur" />
            </motion.article>
          })}
        </div>
      </div>
    </section>
  </Page>
}
