import { useMemo } from 'react'
import { Link, useParams } from 'react-router'
import { FadeUp, Page, Reveal } from '../components/ui'
import { JsonLd, useSeo } from '../components/seo'
import { OwnerEdit } from '../components/extras'
import { useCmsContent } from '../lib/content'
import { ideaWords } from '../lib/idea-life'
import { SITE_URL } from '../data'

const youtubeId = (url = '') => (url.match(/(?:v=|youtu\.be\/|shorts\/|embed\/)([\w-]{6,})/) || [])[1] || ''
const clockSeconds = (value = '') => value.split(':').reduce((total, part) => total * 60 + (Number(part) || 0), 0)
const isoDuration = (value = '') => {
  const seconds = clockSeconds(value)
  if (!seconds) return undefined
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const rest = seconds % 60
  return `PT${hours ? `${hours}H` : ''}${minutes ? `${minutes}M` : ''}${rest ? `${rest}S` : ''}`
}
const topicList = (value = '') => value.split(/[،,\n]/).map((item) => item.trim()).filter(Boolean)

function related<T>(seed: Set<string>, items: readonly T[], text: (item: T) => string, limit: number) {
  return items
    .map((item) => ({ item, score: ideaWords(text(item)).filter((word) => seed.has(word)).length }))
    .filter((row) => row.score > 0)
    .sort((left, right) => right.score - left.score)
    .slice(0, limit)
}

export default function MediaDetail() {
  const { slug = '' } = useParams()
  const { media, articles, papers, loading } = useCmsContent()
  const item = media.find((entry) => entry.slug === slug)
  const videoId = youtubeId(item?.url)
  const thumbnail = item?.thumbnail || (videoId ? `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg` : '')
  const topics = topicList(item?.topics)
  const seed = useMemo(() => new Set(ideaWords(`${item?.title || ''} ${item?.topics || ''}`)), [item?.title, item?.topics])
  const articleLinks = useMemo(() => related(seed, articles, (article) => `${article.title} ${article.excerpt || ''} ${article.cat || ''}`, 4), [articles, seed])
  const paperLinks = useMemo(() => related(seed, papers, (paper) => `${paper.title} ${paper.titleAr || ''} ${paper.abstractAr || ''} ${paper.meta || ''}`, 3), [papers, seed])
  const start = clockSeconds(item?.clipStart)
  const end = clockSeconds(item?.clipEnd)
  const excerptUrl = videoId ? `https://www.youtube-nocookie.com/embed/${videoId}?rel=0&start=${start}${end > start ? `&end=${end}` : ''}` : ''

  useSeo({
    title: item?.title || 'ظهور إعلامي',
    path: `/media/${slug}`,
    description: item ? `${item.program || 'لقاء إعلامي'} عبر ${item.channel || item.outlet}. ${item.topics || ''}` : undefined,
    type: 'article',
    image: thumbnail || undefined,
  })

  if (!item && loading) return <Page><div className="px-6 pt-44 text-center text-soft">لحظة…</div></Page>
  if (!item) return <Page><div className="px-6 pt-44 text-center text-soft">لم يُعثر على اللقاء.</div></Page>

  return (
    <Page className="content-media page-journey">
      <JsonLd data={{
        '@context': 'https://schema.org',
        '@graph': [
          {
            '@type': 'VideoObject',
            '@id': `${SITE_URL}/media/${item.slug}#video`,
            name: item.title,
            description: item.topics || item.title,
            thumbnailUrl: thumbnail || undefined,
            uploadDate: item.iso || undefined,
            duration: isoDuration(item.duration),
            embedUrl: videoId ? `https://www.youtube-nocookie.com/embed/${videoId}` : undefined,
            contentUrl: item.url,
            inLanguage: 'ar',
            about: topics.map((name) => ({ '@type': 'Thing', name })),
            creator: { '@type': 'Person', '@id': `${SITE_URL}/#person`, name: 'د. أحمد حسين الفيلكاوي' },
            ...(start >= 0 && end > start ? { hasPart: { '@type': 'Clip', name: 'مقتطف اللقاء', startOffset: start, endOffset: end, url: `${SITE_URL}/media/${item.slug}#excerpt` } } : {}),
          },
          {
            '@type': 'BreadcrumbList',
            itemListElement: [
              { '@type': 'ListItem', position: 1, name: 'الرئيسية', item: `${SITE_URL}/` },
              { '@type': 'ListItem', position: 2, name: 'الظهور الإعلامي', item: `${SITE_URL}/media` },
              { '@type': 'ListItem', position: 3, name: item.title, item: `${SITE_URL}/media/${item.slug}` },
            ],
          },
        ],
      }} />

      <article className="px-6 pb-24 pt-32 md:px-11 md:pt-40">
        <div className="mx-auto max-w-[980px]">
          <FadeUp><Link to="/media" className="text-[.85rem] text-soft transition-colors hover:text-accent">← كل اللقاءات</Link></FadeUp>
          <FadeUp delay={0.05}>
            <header className="mt-7 border-b border-hair pb-8">
              <div className="flex flex-wrap items-center gap-2 text-[.76rem] text-soft">
                <span className="font-semibold text-accent">{item.program || 'لقاء إعلامي'}</span>
                <span>·</span><span>{item.channel || item.outlet}</span>
                {item.date && <><span>·</span><time>{item.date}</time></>}
                {item.duration && <><span>·</span><span dir="ltr">{item.duration}</span></>}
              </div>
              <h1 className="mt-4 font-display text-[clamp(2rem,4.6vw,3.1rem)] font-bold leading-[1.35] text-ink"><Reveal>{item.title}</Reveal></h1>
              <OwnerEdit tab="media" slug={item.slug} className="mt-3" />
              {topics.length > 0 && <div className="mt-5 flex flex-wrap gap-2">{topics.map((topic) => <span key={topic} className="rounded-full border border-hair bg-wash px-3 py-1.5 text-[.7rem] text-soft">{topic}</span>)}</div>}
            </header>
          </FadeUp>

          <FadeUp delay={0.1}>
            <section id="excerpt" className="mt-8" aria-labelledby="excerpt-title">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div><span className="text-[.68rem] font-semibold text-accent">مقتطف مركز</span><h2 id="excerpt-title" className="mt-1 font-display text-xl font-semibold text-ink">{end > start ? `${end - start} ثانية من اللقاء` : 'مقتطف من اللقاء'}</h2></div>
                <span className="text-[.7rem] text-soft" dir="ltr">{item.clipStart || '00:00'} — {item.clipEnd || '00:45'}</span>
              </div>
              <div className="mt-4 overflow-hidden rounded-2xl border border-hair bg-ink" style={{ aspectRatio: '16 / 9' }}>
                {excerptUrl ? <iframe src={excerptUrl} title={`مقتطف: ${item.title}`} loading="lazy" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowFullScreen className="h-full w-full border-0" /> : <div className="flex h-full items-center justify-center text-white/70">المعاينة غير متاحة</div>}
              </div>
              <a href={item.url} target="_blank" rel="noreferrer" className="mt-4 inline-flex rounded-full bg-accent px-6 py-3 text-[.84rem] font-semibold text-white transition-colors hover:bg-accent-deep">مشاهدة الفيديو الكامل ↗</a>
            </section>
          </FadeUp>

          <FadeUp delay={0.14}>
            <section className="mt-10 rounded-2xl border border-hair bg-wash p-5 md:p-7" aria-labelledby="transcript-title">
              <span className="text-[.68rem] font-semibold text-accent">Transcript</span>
              <h2 id="transcript-title" className="mt-1 font-display text-xl font-semibold text-ink">النص المفرّغ</h2>
              {item.transcript ? <div className="mt-4 whitespace-pre-line text-[.94rem] leading-[2] text-ink/85">{item.transcript}</div> : <p className="mt-3 text-[.82rem] leading-relaxed text-soft">النص التلقائي لا يُنشر قبل مراجعته لغوياً. الحقل جاهز في لوحة التحكم، ويظهر هنا فور اعتماد النسخة المنقحة.</p>}
            </section>
          </FadeUp>

          {(articleLinks.length > 0 || paperLinks.length > 0) && <FadeUp delay={0.18}>
            <section className="mt-10 border-t border-hair pt-8" aria-labelledby="media-related-title">
              <h2 id="media-related-title" className="font-display text-xl font-semibold text-ink">مقالات وأبحاث مرتبطة</h2>
              <p className="mt-2 text-[.76rem] text-soft">صلة موضوعية محسوبة من الأرشيف نفسه، وليست ادعاءً بأن المواد ذُكرت داخل اللقاء.</p>
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                {articleLinks.map(({ item: article }) => <Link key={article.slug} to={`/articles/${article.slug}`} className="rounded-xl border border-hair p-4 transition-colors hover:border-accent"><span className="text-[.65rem] font-semibold text-accent">مقال</span><strong className="mt-1 block text-[.84rem] leading-relaxed text-ink">{article.title}</strong></Link>)}
                {paperLinks.map(({ item: paper }) => <Link key={paper.slug} to={`/research/${paper.slug}`} className="rounded-xl border border-hair p-4 transition-colors hover:border-accent"><span className="text-[.65rem] font-semibold text-accent">بحث</span><strong className="mt-1 block text-[.84rem] leading-relaxed text-ink">{paper.titleAr || paper.title}</strong></Link>)}
              </div>
            </section>
          </FadeUp>}
        </div>
      </article>
    </Page>
  )
}
