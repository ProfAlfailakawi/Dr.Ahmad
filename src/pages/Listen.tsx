import { useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { Link } from 'react-router'
import { EASE, FadeUp, Page, PageHead } from '../components/ui'
import { useSeo } from '../components/seo'
import { categoryLabel } from '../lib/content-taxonomy'
import { Pagination, usePagedList } from '../components/Pagination'
import { usePersistentAudio, type PersistentTrack } from '../lib/persistent-audio'
import { versionedAudioUrl } from '../components/extras'
import { AudioPlayer, openAudioPlayer } from '../components/AudioPlayer'
import { type ListenEpisode } from '../lib/listen-catalog'
import { listenEpisodes } from '../lib/listen-episodes'
import { SocialIcon } from '../components/icons'

/* ═══════════ مجلس الفكرة ═══════════
   الأرشيف المسموع لا يُفهرَس بعناوينه. كلُّ حلقةٍ هنا يمثّلها سؤالٌ نطقه فهد أو
   نورة داخلها بنصّه حرفاً؛ السؤال بابٌ للحلقة، لكن اختيار حلقةٍ جديدة يبدأها من
   الصفر. الاستئناف محفوظ فقط لباب «افتح المجلس». */

type Episode = ListenEpisode

const EPISODES = listenEpisodes

/* أرقامٌ غربية عمداً: قانون الموقع كلّه (WesternDigitsGuard في App.tsx) يحوّل
   الأرقام الهندية إلى غربية في كل نصّ، فكتابتها هندية هنا تعني تحويلاً في كل
   رسمٍ بلا فائدة. */
const clock = (seconds: number) => {
  if (!Number.isFinite(seconds) || seconds <= 0) return ''
  return `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`
}
const episodeSrc = (slug: string) => versionedAudioUrl(`/audio/${slug}.dialogue.mp3`)

/* العصور تُشتقّ من الأرشيف نفسه لا من قائمةٍ مكتوبة بيدنا: نقطة الانقسام هي
   أوسع فجوةٍ بين سنتين متتاليتين. فإن كتب الدكتور بلا انقطاع لم ينقسم شيء. */
function splitEras(episodes: Episode[]) {
  const years = [...new Set(episodes.map((episode) => Number(episode.iso.slice(0, 4))).filter(Boolean))]
    .sort((left, right) => right - left)
  if (years.length < 2) return [{ label: '', items: episodes }]
  let gap = 0
  let boundary = 0
  for (let index = 0; index < years.length - 1; index += 1) {
    const distance = years[index] - years[index + 1]
    if (distance > gap) { gap = distance; boundary = years[index] }
  }
  if (gap < 3) return [{ label: '', items: episodes }]
  const recent = episodes.filter((episode) => Number(episode.iso.slice(0, 4)) >= boundary)
  const earlier = episodes.filter((episode) => Number(episode.iso.slice(0, 4)) < boundary)
  const range = (items: Episode[]) => {
    const list = items.map((item) => Number(item.iso.slice(0, 4))).filter(Boolean)
    if (!list.length) return ''
    const min = Math.min(...list)
    const max = Math.max(...list)
    return min === max ? String(min) : `${min}–${max}`
  }
  return [
    { label: range(recent), items: recent },
    { label: range(earlier), items: earlier },
  ].filter((era) => era.items.length)
}

function QuestionRow({ episode, playing, expanded, onOpen }: {
  episode: Episode
  playing: boolean
  expanded: boolean
  onOpen: (episode: Episode) => void
}) {
  const reduce = useReducedMotion()
  return (
    <li
      data-majlis-slug={episode.slug}
      className={`majlis-row ${expanded ? 'is-open' : ''}`}
    >
      <button
        type="button"
        onClick={() => onOpen(episode)}
        aria-current={playing ? 'true' : undefined}
        aria-expanded={expanded}
        className={`group flex w-full items-start gap-3.5 px-1 py-4 text-start transition-[color,background-color,border-color] md:px-2 ${expanded ? 'rounded-t-2xl border-x border-t border-accent/[.18] bg-wash/[.5] px-3 md:px-4' : 'border-b border-hair hover:bg-wash/70'}`}
      >
        <span className={`mt-1.5 shrink-0 text-[.72rem] transition-colors ${playing ? 'text-accent' : 'text-accent/[.65] group-hover:text-accent'}`}>
          {playing ? (
            <svg aria-hidden width="13" height="13" viewBox="0 0 16 16" fill="currentColor"><rect x="3" y="2.5" width="3.2" height="11" rx="1" /><rect x="9.8" y="2.5" width="3.2" height="11" rx="1" /></svg>
          ) : <SocialIcon name="Play" size={13} />}
        </span>
        <span className="min-w-0 flex-1">
          <span className={`measure block font-display text-[1.04rem] leading-[1.75] transition-colors ${playing ? 'text-accent' : 'text-ink'}`}>
            {episode.question || episode.title}
          </span>
          <span className="mt-1 block truncate text-[.71rem] text-soft">
            {episode.question ? <>{episode.title}<span className="mx-1.5 opacity-45">·</span></> : null}
            {clock(episode.durationSec)}
            {episode.durationSec ? <span className="mx-1.5 opacity-45">·</span> : null}
            {episode.iso.slice(0, 4)}
          </span>
        </span>
      </button>
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            key="player"
            initial={reduce ? false : { opacity: 0, height: 0, y: -8, filter: 'blur(5px)' }}
            animate={{ opacity: 1, height: 'auto', y: 0, filter: 'blur(0px)' }}
            exit={reduce ? undefined : { opacity: 0, height: 0, y: -6, filter: 'blur(4px)' }}
            transition={{ duration: reduce ? 0 : .46, ease: EASE }}
            className="majlis-player-shell overflow-hidden rounded-b-2xl border-x border-b border-accent/[.18] bg-wash/[.35] px-3 pb-5 md:px-4"
          >
            <AudioPlayer
              sources={[{
                key: 'dialogue',
                label: 'استمع',
                avatar: 'dialogue',
                src: episodeSrc(episode.slug),
                transcript: versionedAudioUrl(`/audio/${episode.slug}.dialogue.json`),
                fallbackTranscript: `/spoken/${encodeURIComponent(episode.slug)}.json`,
                startFresh: true,
              }]}
              title={episode.title}
              controlId={`majlis-${episode.slug}`}
              showChapters
            />
          </motion.div>
        )}
      </AnimatePresence>
    </li>
  )
}


export default function Listen() {
  useSeo({
    title: 'مجلس الفكرة',
    path: '/listen',
    description: 'حلقات حوارية مسموعة من مقالات د. أحمد حسين الفيلكاوي.',
  })
  const player = usePersistentAudio()
  const [term, setTerm] = useState('')
  const [cat, setCat] = useState('الكل')
  /* صفٌّ واحد مفتوح لا أكثر: مشغّلان مفتوحان في صفحةٍ واحدة زحمة. */
  const [openSlug, setOpenSlug] = useState('')

  const categories = useMemo(() => {
    const found = [...new Set(EPISODES.map((episode) => episode.cat).filter(Boolean))]
      .sort((left, right) => left.localeCompare(right, 'ar'))
    return ['الكل', ...found]
  }, [])

  const filtered = useMemo(() => {
    const needle = term.trim()
    return EPISODES
      .filter((episode) => (cat === 'الكل' ? true : episode.cat === cat))
      .filter((episode) => (needle ? `${episode.question} ${episode.title}`.includes(needle) : true))
  }, [cat, term])

  const paged = usePagedList(filtered, 20, `${cat}|${term}`)
  const eras = useMemo(() => splitEras(paged.pageItems), [paged.pageItems])

  /* المجلس يمشي: كل حلقةٍ تحمل تاليتها بترتيب ما يراه الزائر الآن (بعد التصفية
     والبحث)، فإذا انتهت بدأت التي بعدها بلا نقرة، وإن غادر الصفحة ليقرأ مقالاً
     بقي المجلس يمشي معه. سلسلةٌ تُبنى مرّة عند النقر لا في كل رسم. */
  const chainFrom = (start: number, resumeFirst = false): PersistentTrack | undefined => {
    const episode = filtered[start]
    if (!episode) return undefined
    const src = episodeSrc(episode.slug)
    return {
      id: src,
      src,
      title: episode.title,
      label: 'مجلس الفكرة',
      path: `/articles/${episode.slug}`,
      /* كل حلقةٍ تالية تبدأ من الصفر. الاستئناف استثناءٌ للحلقة الأولى فقط
         عندما يضغط الزائر «افتح المجلس» ليستكمل ما تركه. */
      startFresh: !resumeFirst,
      next: chainFrom(start + 1, false),
    }
  }

  const open = (episode: Episode, { atQuestion = false, resumeSaved = false } = {}) => {
    setOpenSlug(episode.slug)
    const index = filtered.findIndex((item) => item.slug === episode.slug)
    const track = chainFrom(index >= 0 ? index : 0, resumeSaved)
    if (!track) return
    /* القفز إلى سؤالٍ يبقى ممكناً إن استُدعي صراحةً، لكن فتح حلقةٍ أخرى من
       القائمة يبدأها من أولها ولا يحمل 2:20 مثلاً من الحلقة السابقة. */
    if (atQuestion && typeof episode.startSec === 'number' && episode.startSec > 1) {
      track.startAt = episode.startSec
      track.startFresh = false
    }
    void player.playTrack(track)
    /* المشغّل يُركَّب من الصف نفسه ثم يتمدّد؛ لا قفزة إلى سطح منفصل. */
    window.requestAnimationFrame(() => {
      openAudioPlayer(`majlis-${episode.slug}`, 'dialogue')
      const row = document.querySelector<HTMLElement>(`[data-majlis-slug="${CSS.escape(episode.slug)}"]`)
      if (!row) return
      const rect = row.getBoundingClientRect()
      if (rect.top < 72 || rect.bottom > window.innerHeight - 24) row.scrollIntoView({ behavior: 'smooth', block: 'center' })
    })
  }

  /* «افتح المجلس»: يستأنف آخر حلقةٍ سمعها من موضعها المحفوظ، وإلا بدأ بأحدثها.
     بلا اختيارٍ ولا قرار — يضغط فيمشي الأرشيف. */
  const resumeRef = useRef<Episode | null>(null)
  if (!resumeRef.current) {
    let candidate: Episode | null = null
    if (typeof window !== 'undefined') {
      for (const episode of EPISODES) {
        try {
          const saved = Number(window.localStorage.getItem(`audio:pos:${episodeSrc(episode.slug)}`) || 0)
          if (saved > 20 && saved < episode.durationSec - 15) { candidate = episode; break }
        } catch { /* التخزين اختياري */ }
      }
    }
    resumeRef.current = candidate || EPISODES[0] || null
  }
  const resume = resumeRef.current
  const resumeIsContinuation = Boolean(resume && typeof window !== 'undefined'
    && Number(window.localStorage.getItem(`audio:pos:${episodeSrc(resume.slug)}`) || 0) > 20)

  if (!EPISODES.length) {
    return (
      <Page className="content-listen">
        <PageHead label="استمع" title="مجلس الفكرة." />
        <section className="mx-auto max-w-shell px-6 py-16 md:px-11">
          <p className="text-[.9rem] leading-loose text-soft">
            الحلقات في طريقها. تجدها الآن داخل كل مقالٍ عند زر «استمع».{' '}
            <Link to="/articles" className="text-accent hover:underline">إلى المقالات ←</Link>
          </p>
        </section>
      </Page>
    )
  }

  return (
    <Page className="content-listen page-journey">
      <PageHead label="استمع" title="مجلس الفكرة." />

      <section className="mx-auto max-w-shell px-6 md:px-11">
        {resume && (
          <FadeUp>
            <button
              type="button"
              onClick={() => open(resume, { resumeSaved: resumeIsContinuation })}
              className="flex w-full items-center gap-3.5 rounded-xl border border-hair bg-wash/[.55] px-4 py-3.5 text-start transition-colors hover:border-accent/[.45] md:px-5"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent text-white"><SocialIcon name="Play" size={16} /></span>
              <span className="min-w-0">
                <span className="block text-[.84rem] font-semibold text-ink">افتح المجلس</span>
                <span className="mt-0.5 block truncate text-[.71rem] text-soft">
                  {resumeIsContinuation ? `يكمل: ${resume.title}` : resume.title}
                </span>
              </span>
            </button>
          </FadeUp>
        )}
      </section>

      <section className="sticky top-16 z-[120] mt-6 border-y border-hair bg-canvas/[.92] px-4 py-3 backdrop-blur-md sm:px-6 md:px-11">
        <div className="mx-auto grid max-w-shell gap-3 lg:grid-cols-[minmax(240px,.55fr)_minmax(0,1fr)] lg:items-center">
          <div className="relative">
            <input
              value={term}
              onChange={(event) => setTerm(event.target.value)}
              placeholder="ابحث في الأسئلة…"
              aria-label="بحث في أسئلة المجلس"
              className="w-full rounded-full border border-hair bg-canvas py-3 pe-12 ps-5 text-[.92rem] text-ink outline-none transition-colors placeholder:text-soft/70 focus:border-accent"
            />
            <span className="pointer-events-none absolute left-5 top-1/2 -translate-y-1/2 text-soft"><SocialIcon name="Search" size={17} /></span>
          </div>
          <div className="rail -mx-1 flex gap-2 overflow-x-auto px-1 pb-1 lg:mx-0 lg:flex-wrap lg:overflow-visible lg:px-0 lg:pb-0">
            {categories.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setCat(item)}
                aria-pressed={cat === item}
                className={`shrink-0 rounded-full border px-4 py-2 text-[.8rem] font-medium transition-colors duration-300 ${cat === item ? 'border-accent bg-accent text-white' : 'border-hair bg-canvas text-soft hover:border-accent hover:text-accent'}`}
              >
                {item === 'الكل' ? 'الكل' : categoryLabel(item)}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section id="listen-list" className="mx-auto max-w-shell px-6 pb-16 md:px-11">
        {!filtered.length && <p className="py-14 text-[.88rem] text-soft">لا سؤال يطابق هذا البحث.</p>}
        <>
        {eras.map((era) => (
          <div key={era.label || 'all'}>
            {era.label && (
              <div className="my-7 flex items-center gap-3 text-[.68rem] text-soft">
                <i className="h-px flex-1 bg-hair" />
                {era.label}
                <i className="h-px flex-1 bg-hair" />
              </div>
            )}
            <ul>
              {era.items.map((episode) => (
                <QuestionRow
                  key={episode.slug}
                  episode={episode}
                  playing={player.isActive(episodeSrc(episode.slug))}
                  expanded={openSlug === episode.slug}
                  onOpen={open}
                />
              ))}
            </ul>
          </div>
        ))}
        </>
        <Pagination
          page={paged.page}
          pageCount={paged.pageCount}
          onChange={paged.setPage}
          totalItems={filtered.length}
          firstItem={paged.firstItem}
          lastItem={paged.lastItem}
          scrollTargetId="listen-list"
          label="صفحات المجلس"
        />
      </section>
    </Page>
  )
}
