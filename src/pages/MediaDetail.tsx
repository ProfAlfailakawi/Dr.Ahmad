import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router'
import { chapterUrl, chaptersForVideo, stamp } from '../lib/media-chapters'
import { NextStep } from '../components/NextStep'
import { FadeUp, Page, Reveal } from '../components/ui'
import { JsonLd, useSeo } from '../components/seo'
import { OwnerEdit } from '../components/extras'
import { useCmsContent } from '../lib/content'
import { ideaWords } from '../lib/idea-life'
import { SITE_URL } from '../data'
import { bookKnowledgeAnchor, relatedBookKnowledge } from '../lib/book-knowledge'

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
  const { media, articles, books, papers, loading } = useCmsContent()
  const item = media.find((entry) => entry.slug === slug)
  const videoId = youtubeId(item?.url)
  const chapters = chaptersForVideo(videoId || '')
  const thumbnail = item?.thumbnail || (videoId ? `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg` : '')
  const topics = topicList(item?.topics)
  const [youtubeTranscript, setYoutubeTranscript] = useState('')
  const contextText = `${item?.title || ''} ${item?.topics || ''} ${youtubeTranscript.slice(0, 6_000)}`
  const seed = useMemo(() => new Set(ideaWords(contextText)), [contextText])
  const articleLinks = useMemo(() => related(seed, articles, (article) => `${article.title} ${article.excerpt || ''} ${article.cat || ''}`, 4), [articles, seed])
  const paperLinks = useMemo(() => related(seed, papers, (paper) => `${paper.title} ${paper.titleAr || ''} ${paper.abstractAr || ''} ${paper.meta || ''}`, 3), [papers, seed])
  const bookLinks = useMemo(() => {
    const live = new Set(books.map((book) => book.slug))
    return relatedBookKnowledge(contextText, 3).filter((match) => live.has(match.book.slug))
  }, [books, contextText])
  const playerUrl = videoId ? `https://www.youtube-nocookie.com/embed/${videoId}?rel=0` : ''

  useEffect(() => {
    let active = true
    setYoutubeTranscript(item?.transcript || '')
    if (!videoId || item?.transcript) return () => { active = false }
    void import('../data/media-transcripts.json').then(({ default: transcripts }) => {
      if (active) setYoutubeTranscript((transcripts as Record<string, string>)[videoId] || '')
    }).catch(() => {
      if (active) setYoutubeTranscript('')
    })
    return () => { active = false }
  }, [item?.transcript, videoId])

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
            <section className="mt-8" aria-labelledby="video-title">
              <h2 id="video-title" className="font-display text-xl font-semibold text-ink">اللقاء الكامل</h2>
              <div className="mt-4 overflow-hidden rounded-2xl border border-hair bg-ink shadow-[0_18px_50px_rgba(20,31,45,.08)]" style={{ aspectRatio: '16 / 9' }}>
                {playerUrl ? <iframe src={playerUrl} title={item.title} loading="lazy" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowFullScreen className="h-full w-full border-0" /> : <div className="flex h-full items-center justify-center text-white/70">المعاينة غير متاحة</div>}
              </div>
            </section>
          </FadeUp>

          {/* ═══ دقيقة الفكرة ═══
              اللقاء الطويل يخيف الزائر. هذه محاوره، والنقر يفتح يوتيوب عند
              الموضع نفسه. المواضع تقديرية (يوتيوب لا يمنح التوقيتات مجاناً)
              ومطروحٌ منها هامش أمان، فنقول «نحو» ولا ندّعي دقةً لا نملكها. */}
          {chapters.length > 0 && <FadeUp delay={0.12}>
            <details className="group mt-10 overflow-hidden rounded-2xl border border-hair bg-wash">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-5 p-5 md:px-7">
                <span>
                  <span className="block font-display text-xl font-semibold text-ink">محاور اللقاء</span>
                  <span className="mt-1 block text-[.7rem] text-soft">{chapters.length} محوراً · النقر يفتح اللقاء عند موضعه التقريبي</span>
                </span>
                <span aria-hidden="true" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-hair text-accent transition-transform group-open:rotate-45">+</span>
              </summary>
              <div className="border-t border-hair p-5 md:px-7">
                <ol className="grid gap-1">
                  {chapters.map((chapter) => (
                    <li key={chapter.at}>
                      <a
                        href={chapterUrl(item.url, chapter.at)}
                        target="_blank"
                        rel="noreferrer"
                        className="grid gap-1 rounded-xl px-2 py-2.5 transition-colors hover:bg-canvas sm:grid-cols-[6.5rem_minmax(0,1fr)] sm:items-baseline sm:gap-3"
                      >
                        <span className="text-[.72rem] font-semibold text-accent">نحو {stamp(chapter.at)}</span>
                        <span className="text-[.82rem] leading-relaxed text-ink">{chapter.label}</span>
                      </a>
                    </li>
                  ))}
                </ol>
              </div>
            </details>
          </FadeUp>}

          {youtubeTranscript && <FadeUp delay={0.14}>
            <details className="group mt-10 overflow-hidden rounded-2xl border border-hair bg-wash">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-5 p-5 md:px-7">
                <span><span id="transcript-title" className="block font-display text-xl font-semibold text-ink">النص المفرّغ</span><span className="mt-1 block text-[.7rem] text-soft">من النص العربي التلقائي المتاح في YouTube</span></span>
                <span aria-hidden="true" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-hair bg-canvas text-accent transition-transform group-open:rotate-45">+</span>
              </summary>
              <div className="max-h-[34rem] overflow-y-auto whitespace-pre-line border-t border-hair bg-canvas px-5 py-6 text-[.9rem] leading-[2] text-ink/85 md:px-7">{youtubeTranscript}</div>
            </details>
          </FadeUp>}

          {(articleLinks.length > 0 || paperLinks.length > 0 || bookLinks.length > 0) && <FadeUp delay={0.18}>
            <section className="mt-10 border-t border-hair pt-8" aria-labelledby="media-related-title">
              <h2 id="media-related-title" className="font-display text-xl font-semibold text-ink">امتداد اللقاء في المشروع المعرفي</h2>
              <p className="mt-2 text-[.76rem] text-soft">صلة موضوعية محسوبة من عنوان اللقاء ومحاوره ونصه المفرّغ ومن الأرشيف نفسه؛ لا تعني أن المادة ذُكرت حرفياً داخل اللقاء.</p>
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                {articleLinks.map(({ item: article }) => <Link key={article.slug} to={`/articles/${article.slug}`} className="rounded-xl border border-hair p-4 transition-colors hover:border-accent"><span className="text-[.65rem] font-semibold text-accent">مقال</span><strong className="mt-1 block text-[.84rem] leading-relaxed text-ink">{article.title}</strong></Link>)}
                {paperLinks.map(({ item: paper }) => <Link key={paper.slug} to={`/research/${paper.slug}`} className="rounded-xl border border-hair p-4 transition-colors hover:border-accent"><span className="text-[.65rem] font-semibold text-accent">بحث</span><strong className="mt-1 block text-[.84rem] leading-relaxed text-ink">{paper.titleAr || paper.title}</strong></Link>)}
                {bookLinks.map(({ book, concept }) => <Link key={book.slug} to={`/publications/${book.slug}#${bookKnowledgeAnchor(concept)}`} className="rounded-xl border border-hair p-4 transition-colors hover:border-accent"><span className="text-[.65rem] font-semibold text-accent">{book.slug === 'encyclopedia' ? 'من الموسوعة' : 'من كتاب'} · ص {concept.pageStart}</span><strong className="mt-1 block text-[.84rem] leading-relaxed text-ink">{book.title}</strong><span className="mt-1.5 block text-[.7rem] leading-relaxed text-soft">{concept.title}</span></Link>)}
              </div>
            </section>
          </FadeUp>}
        </div>
      </article>

      {/* الفصل التالي: من شاهد لقاءً يُدعى إلى نصٍّ أو مقطعِ كتاب — لا لقاءٍ آخر. */}
      <NextStep
        seed={`${item.title} ${(item as { topics?: string }).topics || ''}`}
        from="لقاء"
        articles={articles}
        papers={papers}
        media={media}
        excludeKey={`media:${videoId}`}
      />
    </Page>
  )
}
