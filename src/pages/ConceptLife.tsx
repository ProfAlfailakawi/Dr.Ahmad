import { useEffect, useMemo, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router'
import { FadeUp, Page, PageHead } from '../components/ui'
import { useSeo } from '../components/seo'
import { useCmsContent } from '../lib/content'
import { loadBookPassages, matchBookQuotes, searchBookPassages, type BookQuoteMatch } from '../lib/book-quotes'
import { chapterUrl, searchMediaChapters, stamp } from '../lib/media-chapters'
import { QuoteCite } from '../components/QuoteCite'
import { loadArticleBodies } from '../lib/article-bodies'
import { ideaEvolution } from '../lib/idea-evolution'
import { arabicCountPhrase, ARTICLE_PLAIN_FORMS, POINT_AFTER_PREPOSITION_FORMS, YEAR_FORMS } from '../lib/arabic-count.ts'

/**
 * سيرة مفهوم — «المعلّم الرقمي عبر عشرين سنة».
 *
 * الفرق عن كل ما سبق: بقية الصفحات تبدأ من **مادة** (مقال، كتاب، لقاء) ثم
 * تبحث عن قريباتها. وهذه تبدأ من **فكرة** ثم تعرض رحلتها في الزمن عبر كل
 * ما نشره: مقالٌ في 2017، لقاءٌ في 2020 عند دقيقته، كتابٌ في 2021 بصفحته،
 * بحثٌ محكّم في 2022، ثم مقالٌ في 2025.
 *
 * أثرها: تُثبت للزائر أن الدكتور صاحب **مشروع** يمتدّ ويتراكم، لا مؤلّف
 * كتبٍ متجاورة. ولا تحتاج سطراً واحداً من محتوى جديد — كلها من أرشيفه.
 */

type Station = {
  key: string
  year: string
  date: string
  kind: 'مقال' | 'بحث محكّم' | 'كتاب' | 'لقاء'
  title: string
  note: string
  to?: string
  href?: string
  quote?: BookQuoteMatch
}

const STOP = new Set('من في على الى عن هذا هذه ذلك التي الذي مع كان كانت'.split(' '))
/* الجمع المكسّر لا تصلحه قاعدة: «أطفال» ليست «طفل» + لاحقة. وهذه أكثر
   الكلمات دوراناً في مجال الدكتور، فبلا ردّها إلى مفردها يفشل البحث في
   أشيع ما يكتبه الناس. قائمةٌ صغيرة مقصودة — لا معجم كامل. */
const BROKEN_PLURALS: Record<string, string> = {
  اطفال: 'طفل', مدارس: 'مدرس', معلمين: 'معلم', معلمون: 'معلم',
  طلاب: 'طالب', طلبه: 'طالب', كتب: 'كتاب', العاب: 'لعب', الالعاب: 'لعب',
  وسايل: 'وسيل', وسائل: 'وسيل', مفاهيم: 'مفهوم', مناهج: 'منهج',
  اجهزه: 'جهاز', اجهزة: 'جهاز', شاشات: 'شاش', مهارات: 'مهار',
  اهداف: 'هدف', ادوات: 'اداه', بيئات: 'بيئه', فصول: 'فصل',
}

const roots = (value = '') => new Set(String(value)
  .normalize('NFKC').toLowerCase().replace(/ـ+/g, '').replace(/[ً-ْٰ]/g, '')
  .replace(/[أإآٱ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه').replace(/[ؤئ]/g, 'ء')
  .replace(/[^\p{L}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim().split(' ')
  /* السوابق العربية تلتصق بالكلمة: «بالتلعيب» و«والشاشة» و«للمعلم» كلها
     صور للجذر نفسه. بلا إسقاطها يفشل البحث في أكثر أسئلة الناس شيوعاً. */
  .map((word) => word
    .replace(/^(?:[وف])(?=[بكل]ال|ال)/u, '')
    .replace(/^لل(?=.{3,})/u, '')
    .replace(/^[بكل](?=ال.{3,})/u, '')
    .replace(/^ال(?=.{3,})/u, '')
    .replace(/^[وف](?=.{4,})/u, '')
    /* «شاشات» و«شاشة» جذرٌ واحد عند المطابقة؛ بلا توحيدهما يفشل أكثر
       ما يكتبه الناس. نطبّق القاعدة على الطرفين فيبقى الميزان عادلاً. */
    .replace(/(?:ات|ون|ين|ية|يه)$/u, '')
    .replace(/ه$/u, (match, offset, full) => (full.length > 4 ? '' : match)))
  .map((word) => BROKEN_PLURALS[word] || word)
  .filter((word) => word.length > 2 && !STOP.has(word)))

const overlap = (left: Set<string>, right: Set<string>) => {
  let score = 0
  for (const word of left) if (right.has(word)) score += 1
  return score
}

const KIND_ORDER: Record<Station['kind'], number> = { 'مقال': 0, 'لقاء': 1, 'كتاب': 2, 'بحث محكّم': 3 }

export default function ConceptLife() {
  const params = useParams()
  const [search] = useSearchParams()
  const term = decodeURIComponent(params.term || search.get('term') || '').trim()
  const { articles, papers, books, media } = useCmsContent()
  const [deepReady, setDeepReady] = useState(false)
  const [activeKind, setActiveKind] = useState<Station['kind'] | null>(null)

  useSeo({
    title: term ? `سيرة مفهوم: ${term}` : 'سيرة مفهوم',
    path: `/concept/${encodeURIComponent(term)}`,
    description: term ? `رحلة مفهوم «${term}» عبر مقالات د. أحمد الفيلكاوي وكتبه وأبحاثه ولقاءاته، مرتّبةً في الزمن.` : undefined,
  })

  useEffect(() => {
    if (!term || deepReady) return
    let on = true
    void loadBookPassages().then(() => { if (on) setDeepReady(true) })
    return () => { on = false }
  }, [deepReady, term])

  /* متون المقالات تلزم لقياس النبرة واختيار الجملة الدالّة — لا للعرض.
     تُجلب بعد أول رسم فلا تؤخّر ظهور المحطات. */
  const [bodies, setBodies] = useState<Record<string, string> | null>(null)
  useEffect(() => {
    if (!term || bodies) return
    let on = true
    void loadArticleBodies().then((map) => { if (on) setBodies(map as Record<string, string>) })
    return () => { on = false }
  }, [bodies, term])

  const stations = useMemo<Station[]>(() => {
    if (term.length < 2) return []
    const seed = roots(term)
    if (!seed.size) return []
    const list: Station[] = []

    for (const article of articles) {
      const score = overlap(seed, roots(`${article.title} ${article.excerpt || ''} ${article.cat || ''}`))
      if (score < 1) continue
      list.push({
        key: `a-${article.slug}`,
        year: String(article.iso || '').slice(0, 4),
        date: article.date || String(article.iso || '').slice(0, 10),
        kind: 'مقال',
        title: article.title,
        note: article.excerpt?.slice(0, 130) || '',
        to: `/articles/${article.slug}`,
      })
    }

    for (const paper of papers) {
      const record = paper as typeof paper & { titleAr?: string; abstractAr?: string; journal?: string; year?: string }
      const score = overlap(seed, roots(`${record.titleAr || paper.title} ${record.abstractAr || ''} ${paper.meta || ''}`))
      if (score < 1) continue
      const year = (record.journal || record.year || '').match(/(?:19|20)\d{2}/)?.[0] || ''
      list.push({
        key: `p-${paper.slug}`,
        year,
        date: year,
        kind: 'بحث محكّم',
        title: record.titleAr || paper.title,
        note: record.abstractAr?.slice(0, 130) || paper.meta || '',
        to: `/research/${paper.slug}`,
      })
    }

    /* الكتب: نأخذ المقطع نفسه لا عنوان الكتاب — فيقرأ الزائر ما قاله فعلاً. */
    const deep = deepReady ? searchBookPassages(term, 6) : matchBookQuotes(term, 4)
    for (const match of deep) {
      const record = books.find((item) => item.slug === match.bookSlug) as (typeof books)[number] & { year?: string } | undefined
      list.push({
        key: `b-${match.quote.id}`,
        year: record?.year || '',
        date: record?.year || '',
        kind: 'كتاب',
        title: `${match.bookTitle} · ص ${match.quote.page}`,
        note: match.quote.text,
        to: `/publications/${match.bookSlug}#book-knowledge`,
        quote: match,
      })
    }

    for (const hit of searchMediaChapters(term, 4)) {
      const record = media.find((item) => item.slug === `media-${hit.videoId}`)
      list.push({
        key: `m-${hit.videoId}-${hit.chapter.at}`,
        year: String(record?.iso || '').slice(0, 4),
        date: record?.date || String(record?.iso || '').slice(0, 10),
        kind: 'لقاء',
        title: `${hit.title} · نحو ${stamp(hit.chapter.at)}`,
        /* التفريغ التلقائي كلامٌ عاميّ خام لا يليق بصفحة سيرة. العنوان
           والموضع يكفيان، والزائر يسمع الأصل بنقرة. */
        note: '',
        to: `/media/media-${hit.videoId}`,
        href: chapterUrl(hit.url, hit.chapter.at),
      })
    }

    /* الترتيب زمنيّ: هذه سيرةٌ لا قائمة نتائج. وما بلا سنة يذهب آخراً. */
    return list.sort((left, right) => {
      const yl = Number(left.year) || 9999
      const yr = Number(right.year) || 9999
      return yl - yr || KIND_ORDER[left.kind] - KIND_ORDER[right.kind]
    })
  }, [articles, books, deepReady, media, papers, term])

  /* «ما تغيّر رأيه فيه»: مقياسٌ لا تفسير — انظر src/lib/idea-evolution.ts */
  const evolution = useMemo(() => {
    if (!bodies || term.length < 2) return null
    const seed = [...roots(term)]
    const matched = articles
      .filter((article) => overlap(roots(term), roots(`${article.title} ${article.excerpt || ''} ${article.cat || ''}`)) >= 1)
      .map((article) => ({ ...article, body: bodies[article.slug] || '' }))
    return ideaEvolution(matched, seed)
  }, [articles, bodies, term])

  const span = useMemo(() => {
    const years = stations.map((item) => Number(item.year)).filter((year) => year > 1900)
    return years.length >= 2 ? { from: Math.min(...years), to: Math.max(...years) } : null
  }, [stations])

  const visibleStations = useMemo(() => activeKind ? stations.filter((item) => item.kind === activeKind) : stations, [activeKind, stations])

  useEffect(() => { setActiveKind(null) }, [term])

  const kinds = useMemo(() => {
    const counts = new Map<Station['kind'], number>()
    for (const item of stations) counts.set(item.kind, (counts.get(item.kind) || 0) + 1)
    return [...counts.entries()]
  }, [stations])

  return (
    <Page className="content-search">
      <PageHead
        label="سيرة مفهوم"
        title={term ? `«${term}»` : 'سيرة مفهوم'}
        sub={span
          ? `رحلة الفكرة من ${span.from} إلى ${span.to} عبر مقالات ولقاءات وكتب وأبحاث نشرها على امتداد المسيرة.`
          : 'اختر مفهوماً لترى رحلته في الزمن عبر مقالاته وكتبه وأبحاثه ولقاءاته.'}
      />

      <section className="px-6 pb-24 pt-10 md:px-11">
        <div className="mx-auto max-w-shell">
          {kinds.length > 0 && (
            <FadeUp>
              <div className="flex flex-wrap gap-2 border-b border-hair pb-6">
                {kinds.map(([kind, count]) => (
                  <button key={kind} type="button" onClick={() => setActiveKind((current) => current === kind ? null : kind)} aria-pressed={activeKind === kind} className={`relative z-10 min-h-11 rounded-full border px-4 py-2 text-[.72rem] font-medium transition-colors ${activeKind === kind ? 'border-accent bg-accent text-white' : 'border-hair bg-wash text-soft hover:border-accent hover:text-accent'}`}>
                    {kind} · {count}
                  </button>
                ))}
              </div>
            </FadeUp>
          )}

          {evolution && (
            <FadeUp>
              <section className="mt-8 rounded-2xl border border-hair bg-wash px-5 py-6 md:px-7" aria-labelledby="evolution-title">
                <div className="flex flex-wrap items-baseline justify-between gap-3">
                  <h2 id="evolution-title" className="font-display text-[1.15rem] font-semibold text-ink">
                    {evolution.meaningful ? 'كيف تحوّلت نبرته' : 'كيف امتدّ الموقف'}
                  </h2>
                  <span className="text-[.7rem] text-soft">{arabicCountPhrase(evolution.years, YEAR_FORMS)} بين الطرفين</span>
                </div>

                <div className="mt-5 grid gap-4 md:grid-cols-2">
                  {[evolution.early, evolution.late].map((side, index) => (
                    <figure key={side.slug || index} className="rounded-xl border border-hair bg-canvas px-4 py-4">
                      <figcaption className="flex items-baseline justify-between gap-2">
                        <span className="font-display text-[1.05rem] font-semibold text-accent tabular-nums">{side.year}</span>
                        <span className="text-[.7rem] text-soft">{arabicCountPhrase(side.articles, ARTICLE_PLAIN_FORMS)} · تحفّظ {side.caution}٪</span>
                      </figcaption>
                      <blockquote className="mt-2 border-r-2 border-accent/30 pr-3 text-[.86rem] font-light leading-[1.9] text-ink/[.85]">
                        {side.line}
                      </blockquote>
                      {side.slug && (
                        <Link to={`/articles/${side.slug}`} className="mt-2 inline-block pr-3 text-[.66rem] text-soft transition-colors hover:text-accent">
                          {side.title} ←
                        </Link>
                      )}
                    </figure>
                  ))}
                </div>

                <p className="mt-4 border-t border-hair pt-3 text-[.72rem] leading-relaxed text-soft">
                  {evolution.meaningful
                    ? `نبرة التحفّظ في كتابته عن «${term}» ${evolution.shift > 0 ? 'ارتفعت' : 'انخفضت'} بمقدار ${arabicCountPhrase(Math.abs(evolution.shift), POINT_AFTER_PREPOSITION_FORMS)} بين الطرفين.`
                    : `النبرة ثابتة تقريباً (بفارق ${arabicCountPhrase(Math.abs(evolution.shift), POINT_AFTER_PREPOSITION_FORMS)}) — الفكرة امتدّت ولم تنقلب.`}
                  {' '}المقياس آليّ من مفردات الوعد والتحفّظ، لا حكم تحريري.
                </p>
              </section>
            </FadeUp>
          )}

          {stations.length === 0 && (
            <FadeUp>
              <p className="py-16 text-center text-[.9rem] leading-relaxed text-soft">
                {term ? `لم أجد أثراً لـ«${term}» في الأرشيف. جرّب كلمة أقرب إلى محاوره،` : 'اكتب مفهوماً في الرابط، أو'}{' '}
                <Link to="/search" className="text-accent">ابدأ من البحث</Link>.
              </p>
            </FadeUp>
          )}

          <ol className="mt-8 grid gap-0">
            {visibleStations.map((station, index) => (
              <FadeUp key={station.key} delay={Math.min(index * 0.03, 0.3)}>
                <li className="relative grid gap-2 border-r border-hair pr-6 pb-8 sm:grid-cols-[6.5rem_minmax(0,1fr)] sm:gap-5">
                  {/* نقطة المحطة على خيط الزمن */}
                  <span aria-hidden="true" className="absolute right-0 top-1.5 -mr-[5px] block h-2.5 w-2.5 rounded-full bg-accent" />
                  <div className="pt-0.5">
                    <span className="block font-display text-[1.05rem] font-semibold text-accent tabular-nums">{station.year || '—'}</span>
                    <span className="mt-0.5 block text-[.66rem] text-soft">{station.kind}</span>
                  </div>
                  <div className="min-w-0">
                    <Link to={station.to || '/'} className="group block">
                      <strong className="block text-[.95rem] leading-relaxed text-ink transition-colors group-hover:text-accent">{station.title}</strong>
                    </Link>
                    {station.quote ? (
                      <figure className="mt-2">
                        <blockquote className="border-r-2 border-accent/[.35] pr-3 text-[.85rem] font-light leading-[1.9] text-ink/80">{station.note}</blockquote>
                        <figcaption className="mt-1.5 pr-3">
                          {books.find((item) => item.slug === station.quote!.bookSlug) && (
                            <QuoteCite book={books.find((item) => item.slug === station.quote!.bookSlug)!} page={station.quote.quote.page} />
                          )}
                        </figcaption>
                      </figure>
                    ) : (
                      station.note && <p className="mt-1.5 text-[.8rem] leading-relaxed text-soft">{station.note}</p>
                    )}
                    {station.href && (
                      <a href={station.href} target="_blank" rel="noreferrer" className="mt-2 inline-block text-[.7rem] font-semibold text-accent transition-opacity hover:opacity-70">
                        شاهد اللحظة نفسها ↗
                      </a>
                    )}
                  </div>
                </li>
              </FadeUp>
            ))}
          </ol>

          {visibleStations.length > 0 && (
            <FadeUp>
              <div className="mt-6 flex flex-wrap gap-3 border-t border-hair pt-8">
                <Link to={`/search?q=${encodeURIComponent(term)}`} className="rounded-full border border-hair px-5 py-2.5 text-[.76rem] font-semibold text-ink transition-colors hover:border-accent hover:text-accent">ابحث في الأرشيف كله</Link>
                <Link to={`/ask?q=${encodeURIComponent(term)}`} className="rounded-full border border-accent/[.35] px-5 py-2.5 text-[.76rem] font-semibold text-accent transition-colors hover:bg-accent hover:text-white">اسأل الأرشيف عنه</Link>
              </div>
            </FadeUp>
          )}
        </div>
      </section>
    </Page>
  )
}
