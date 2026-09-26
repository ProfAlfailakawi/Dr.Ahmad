import { useMemo } from 'react'
import { Link, useParams } from 'react-router'
import { useSeo, JsonLd } from '../components/seo'
import { FadeUp, Page, PageHead } from '../components/ui'
import { ThoughtSystemNav } from '../components/ThoughtSystemNav'
import { useRevealOnView } from '../components/ComposeScene'
import { versionedAudioUrl } from '../components/extras'
import { SITE_URL } from '../data'
import { useCmsContent } from '../lib/content'
import { usePersistentAudio } from '../lib/persistent-audio'
import { arabicCountPhrase, MINUTE_AFTER_PREPOSITION_FORMS, MINUTE_FORMS, STEP_FORMS } from '../lib/arabic-count.ts'
import {
  completedSteps,
  findLearningPath,
  learningPaths,
  nextStepIndex,
  pathMinutes,
  STEP_KIND_ACTION,
  STEP_KIND_LABEL,
  stepHref,
  stepKey,
  useLearningProgress,
  type LearningPath,
  type LearningStep,
} from '../lib/learning-paths'

/* ═══════════ مسارات التعلّم ═══════════
   تسلسلٌ قصير منتقى: مقالٌ وحلقةٌ ومدخلٌ وفصل، بترتيبٍ يُقرأ من أوله.
   الصفحة هادئة عمداً: خيطٌ واحد، وعقدةٌ لكل خطوة، وتقدّمٌ يحفظه المتصفح
   وحده. لا شارات ولا نقاط ولا احتفالات — المكافأة أن يكتمل الفهم. */

const two = (value: number) => String(value).padStart(2, '0')

/** يُسقط الخطوة التي حُذفت مادتها من اللوحة؛ المسار يبقى صالحاً بما بقي. */
function useLivePaths() {
  const { articles, books } = useCmsContent()
  return useMemo(() => {
    const articleSlugs = new Set(articles.map((item) => item.slug))
    const bookSlugs = new Set(books.map((item) => item.slug))
    const alive = (step: LearningStep) => {
      if (step.kind === 'article' || step.kind === 'podcast') return articleSlugs.has(step.ref)
      if (step.kind === 'book') return bookSlugs.has(step.ref.split('#')[0])
      return bookSlugs.has('encyclopedia')
    }
    return learningPaths.map((path) => ({ ...path, steps: path.steps.filter(alive) }))
  }, [articles, books])
}

function ProgressLine({ done, total, label }: { done: number; total: number; label: string }) {
  const percent = total ? Math.round((done / total) * 100) : 0
  return (
    <div>
      <div
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={done}
        aria-valuetext={`أكملت ${done} من ${total}`}
        className="h-[3px] w-full overflow-hidden rounded-full bg-wash"
      >
        <span className="block h-full rounded-full bg-accent transition-[width] duration-700 ease-out motion-reduce:transition-none" style={{ width: `${percent}%` }} />
      </div>
    </div>
  )
}

/* ───────────── قائمة المسارات ───────────── */

function PathsIndex() {
  const paths = useLivePaths()
  const { progress } = useLearningProgress()

  useSeo({
    title: 'مسارات التعلّم',
    description: 'مسارات قصيرة منتقاة تمزج المقال والحلقة المسموعة ومدخل الموسوعة وفصل الكتاب في ترتيبٍ واحد، مع حفظ تقدّمك في متصفحك.',
    path: '/paths',
  })

  return (
    <Page className="content-learning-paths page-journey">
      <JsonLd data={{
        '@context': 'https://schema.org',
        '@type': 'ItemList',
        name: 'مسارات التعلّم',
        itemListElement: paths.map((path, index) => ({ '@type': 'ListItem', position: index + 1, url: `${SITE_URL}/paths/${path.id}`, name: path.title })),
      }} />
      <PageHead
        label="تعلّم بترتيب"
        title="مسارات التعلّم."
        sub="تسلسلاتٌ قصيرة منتقاة بعناية: مقالٌ، وحلقةٌ مسموعة، ومدخلٌ من الموسوعة، وفصلٌ من كتاب — في ترتيبٍ واحد يُقرأ من أوله إلى آخره."
      />
      <ThoughtSystemNav />

      <section className="px-6 py-14 md:px-11 md:py-20">
        <div className="mx-auto max-w-shell">
          <ol className="grid gap-5 md:grid-cols-2 md:gap-6">
            {paths.map((path, index) => {
              const done = completedSteps(path, progress)
              const next = nextStepIndex(path, done)
              const started = done.size > 0
              const finished = path.steps.length > 0 && next === null
              return (
                <li key={path.id}>
                  <FadeUp delay={Math.min(index, 3) * 0.06} className="h-full">
                    <Link
                      to={`/paths/${path.id}`}
                      viewTransition
                      className="group flex h-full flex-col rounded-2xl border border-hair bg-canvas p-6 transition-colors duration-300 hover:border-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/[.35] md:p-8"
                    >
                      <span className="flex items-center justify-between gap-4 text-[.74rem] text-soft">
                        <span className="font-display tabular-nums text-accent">{two(index + 1)}</span>
                        <span>{arabicCountPhrase(path.steps.length, STEP_FORMS)} · نحو {arabicCountPhrase(pathMinutes(path), MINUTE_AFTER_PREPOSITION_FORMS)}</span>
                      </span>
                      <h2 className="mt-4 font-display text-[clamp(1.45rem,2.6vw,1.8rem)] font-semibold leading-[1.45] text-ink transition-colors group-hover:text-accent">{path.title}</h2>
                      <p className="mt-3 text-[.92rem] font-light leading-[1.9] text-soft">{path.intro}</p>

                      <span aria-hidden className="mt-6 flex items-center gap-1.5">
                        {path.steps.map((step) => (
                          <span
                            key={stepKey(step)}
                            className={`h-1.5 flex-1 rounded-full transition-colors duration-500 ${done.has(stepKey(step)) ? 'bg-accent' : 'bg-wash'}`}
                          />
                        ))}
                      </span>

                      <span className="mt-auto flex items-center justify-between gap-4 pt-5 text-[.8rem]">
                        <span className="text-soft">
                          {finished ? 'أتممت المسار' : started ? `أكملت ${done.size} من ${path.steps.length}` : path.steps.map((step) => STEP_KIND_LABEL[step.kind].split(' ')[0]).filter((label, i, all) => all.indexOf(label) === i).join(' · ')}
                        </span>
                        <span className="shrink-0 font-semibold text-accent">
                          {finished ? 'راجع المسار ←' : started ? 'تابع ←' : 'ابدأ المسار ←'}
                        </span>
                      </span>
                    </Link>
                  </FadeUp>
                </li>
              )
            })}
          </ol>

          <p className="mt-10 max-w-2xl text-[.78rem] font-light leading-[1.9] text-soft">
            يُحفظ تقدّمك في هذا المتصفح وحده، ولا يُرسل إلى أي مكان. ولمن يريد أن يرى كيف تطوّرت فكرةٌ بعينها عبر السنوات، فهناك{' '}
            <Link to="/thought-paths" className="font-medium text-accent hover:underline">مسار الفكرة</Link>.
          </p>
        </div>
      </section>
    </Page>
  )
}

/* ───────────── مسارٌ واحد ───────────── */

function StepAction({ step, primary = false }: { step: LearningStep; primary?: boolean }) {
  const player = usePersistentAudio()
  const base = primary
    ? 'inline-flex min-h-11 items-center gap-2 rounded-full bg-accent px-5 text-[.8rem] font-semibold text-white transition-colors hover:bg-accent-deep focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/[.35]'
    : 'inline-flex min-h-10 items-center gap-2 rounded-full border border-hair px-4 text-[.76rem] font-semibold text-ink transition-colors hover:border-accent hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/[.35]'

  if (step.kind === 'podcast') {
    const src = versionedAudioUrl(`/audio/${step.ref}.dialogue.mp3`)
    const playing = player.isActive(src)
    return (
      <button
        type="button"
        className={base}
        aria-pressed={playing}
        onClick={() => {
          void player.playTrack({ id: src, src, title: step.title, label: 'مجلس الفكرة · مسار تعلّم', path: `/articles/${step.ref}`, startFresh: true })
        }}
      >
        <span aria-hidden>{playing ? '♪' : '▶'}</span>
        <span>{playing ? 'تُسمع الآن' : STEP_KIND_ACTION.podcast}</span>
      </button>
    )
  }
  return (
    <Link to={stepHref(step)} className={base}>
      <span>{STEP_KIND_ACTION[step.kind]}</span>
      <span aria-hidden>←</span>
    </Link>
  )
}

function PathDetail({ path }: { path: LearningPath }) {
  const paths = useLivePaths()
  const live = paths.find((item) => item.id === path.id) || path
  const { progress, setStepDone, resetPath } = useLearningProgress()
  const { ref: spineRef, shown: spineShown } = useRevealOnView<HTMLOListElement>()
  const done = completedSteps(live, progress)
  const next = nextStepIndex(live, done)
  const finished = live.steps.length > 0 && next === null
  const nextStep = next === null ? null : live.steps[next]
  const others = paths.filter((item) => item.id !== live.id)
  const position = paths.findIndex((item) => item.id === live.id)
  const following = paths.length > 1 ? paths[(position + 1) % paths.length] : undefined

  useSeo({ title: live.title, description: live.intro, path: `/paths/${live.id}` })

  const markDone = (step: LearningStep, value: boolean) => setStepDone(live.id, stepKey(step), value)

  return (
    <Page className="content-learning-paths page-journey">
      <JsonLd data={{
        '@context': 'https://schema.org',
        '@type': 'Course',
        name: live.title,
        description: live.intro,
        inLanguage: 'ar',
        url: `${SITE_URL}/paths/${live.id}`,
        provider: { '@id': `${SITE_URL}/#person` },
        hasPart: live.steps.map((step, index) => ({ '@type': 'CreativeWork', position: index + 1, name: step.title, url: `${SITE_URL}${stepHref(step)}` })),
      }} />
      <PageHead label="مسار تعلّم" title={`${live.title}.`} sub={live.intro} />
      <ThoughtSystemNav />

      <section className="px-6 py-12 md:px-11 md:py-16">
        <div className="mx-auto max-w-3xl">
          <FadeUp>
            <Link to="/paths" viewTransition className="text-[.82rem] text-soft transition-colors hover:text-accent">← كل المسارات</Link>
            <p className="mt-6 text-[.9rem] font-light leading-[1.9] text-soft">{live.audience}</p>
            <p className="mt-2 text-[.76rem] font-medium text-soft">
              {arabicCountPhrase(live.steps.length, STEP_FORMS)} · نحو {arabicCountPhrase(pathMinutes(live), MINUTE_AFTER_PREPOSITION_FORMS)}
            </p>
          </FadeUp>

          <FadeUp delay={0.06}>
            <div className="mt-8 rounded-2xl border border-hair bg-wash/[.55] p-5 md:p-7" aria-live="polite">
              <div className="flex items-baseline justify-between gap-4 text-[.78rem]">
                <span className="font-semibold text-ink">{finished ? 'أتممت هذا المسار' : nextStep ? 'الخطوة التالية' : ''}</span>
                <span className="tabular-nums text-soft">أكملت {done.size} من {live.steps.length}</span>
              </div>
              <div className="mt-3"><ProgressLine done={done.size} total={live.steps.length} label={`تقدّمك في مسار ${live.title}`} /></div>
              {nextStep && next !== null ? (
                <div className="mt-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <span className="text-[.72rem] text-soft">{two(next + 1)} · {STEP_KIND_LABEL[nextStep.kind]}</span>
                    <p className="mt-1 font-display text-[1.15rem] font-semibold leading-[1.6] text-ink">{nextStep.title}</p>
                  </div>
                  <div className="flex shrink-0 flex-wrap items-center gap-2">
                    <StepAction step={nextStep} primary />
                    <button type="button" onClick={() => markDone(nextStep, true)} className="inline-flex min-h-11 items-center rounded-full border border-hair px-4 text-[.76rem] font-semibold text-soft transition-colors hover:border-accent hover:text-accent">أتممتها</button>
                  </div>
                </div>
              ) : finished ? (
                <div className="mt-5 flex flex-wrap items-center justify-between gap-4">
                  <p className="text-[.88rem] font-light leading-[1.85] text-soft">مرّت الفكرة بكل محطاتها. يمكنك أن تعيد المسار متى شئت، أو تنتقل إلى مسارٍ آخر.</p>
                  <div className="flex flex-wrap gap-2">
                    {following && <Link to={`/paths/${following.id}`} className="inline-flex min-h-10 items-center rounded-full bg-accent px-4 text-[.76rem] font-semibold text-white transition-colors hover:bg-accent-deep">{following.title} ←</Link>}
                    <button type="button" onClick={() => resetPath(live.id)} className="inline-flex min-h-10 items-center rounded-full border border-hair px-4 text-[.76rem] font-semibold text-soft transition-colors hover:border-accent hover:text-accent">ابدأ من جديد</button>
                  </div>
                </div>
              ) : null}
            </div>
          </FadeUp>

          <ol
            ref={spineRef}
            aria-label={`خطوات مسار ${live.title}`}
            className={`thread-spine mt-14 border-r border-hair ps-7 pe-7 md:ps-10 md:pe-10${spineShown ? ' thread-spine--drawn' : ''}`}
          >
            {live.steps.map((step, index) => {
              const key = stepKey(step)
              const isDone = done.has(key)
              const isCurrent = index === next
              return (
                <li
                  key={key}
                  className="thread-station relative pb-12 last:pb-0"
                  style={{ ['--station-delay' as string]: `${Math.min(index, 7) * 110}ms` }}
                  aria-current={isCurrent ? 'step' : undefined}
                >
                  <span
                    aria-hidden
                    className={`thread-node absolute -right-[34px] top-1.5 flex h-3.5 w-3.5 items-center justify-center rounded-full border-2 md:-right-[46px] ${isDone ? 'border-accent bg-accent' : isCurrent ? 'border-accent bg-canvas' : 'border-hair bg-canvas'}`}
                  >
                    {isDone && <svg viewBox="0 0 12 12" className="h-2 w-2 text-white" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M2.5 6.2 5 8.5l4.5-5" /></svg>}
                  </span>

                  <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[.73rem] font-medium text-soft">
                    <span className="font-display tabular-nums text-accent">{two(index + 1)}</span>
                    <span>· {STEP_KIND_LABEL[step.kind]}</span>
                    <span>· {arabicCountPhrase(step.minutes, MINUTE_FORMS)}</span>
                    {isCurrent && <span className="ms-1 rounded-full border border-accent/[.35] px-2 py-0.5 text-[.66rem] text-accent">أنت هنا</span>}
                  </span>

                  <h3 className={`mt-2 font-display text-[1.22rem] font-semibold leading-[1.65] transition-colors ${isDone ? 'text-soft' : 'text-ink'}`}>
                    {step.kind === 'podcast' ? step.title : (
                      <Link to={stepHref(step)} className="transition-colors hover:text-accent">{step.title}</Link>
                    )}
                  </h3>
                  {step.question && (
                    <p className="mt-2 border-r-2 border-accent/[.35] pr-3 text-[.9rem] font-light leading-[1.85] text-ink/80">«{step.question}»</p>
                  )}
                  <p className="mt-2 text-[.88rem] font-light leading-[1.9] text-soft">{step.note}</p>

                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    <StepAction step={step} />
                    {step.kind === 'podcast' && (
                      <Link to={stepHref(step)} className="inline-flex min-h-10 items-center px-2 text-[.74rem] font-medium text-soft transition-colors hover:text-accent">المقال الأصلي ←</Link>
                    )}
                    <button
                      type="button"
                      aria-pressed={isDone}
                      onClick={() => markDone(step, !isDone)}
                      className={`inline-flex min-h-10 items-center gap-2 rounded-full px-3 text-[.74rem] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/[.35] ${isDone ? 'text-accent hover:text-accent-deep' : 'text-soft hover:text-accent'}`}
                    >
                      <span aria-hidden className={`flex h-4 w-4 items-center justify-center rounded-[5px] border ${isDone ? 'border-accent bg-accent text-white' : 'border-hair'}`}>
                        {isDone && <svg viewBox="0 0 12 12" className="h-2.5 w-2.5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M2.5 6.2 5 8.5l4.5-5" /></svg>}
                      </span>
                      <span>{isDone ? 'أتممتها' : 'علّمها مكتملة'}</span>
                    </button>
                  </div>
                </li>
              )
            })}
          </ol>

          {others.length > 0 && (
            <FadeUp>
              <nav aria-label="مسارات أخرى" className="mt-20 border-t border-hair pt-8">
                <p className="text-[.76rem] font-semibold text-accent">مسارات أخرى</p>
                <ul className="mt-4 grid gap-x-8 gap-y-3 sm:grid-cols-2">
                  {others.map((item) => (
                    <li key={item.id}>
                      <Link to={`/paths/${item.id}`} viewTransition className="group flex items-baseline justify-between gap-4 border-b border-hair py-3 text-[.92rem] text-ink transition-colors hover:text-accent">
                        <span className="font-display font-semibold leading-[1.6]">{item.title}</span>
                        <span aria-hidden className="text-soft transition-colors group-hover:text-accent">←</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </nav>
            </FadeUp>
          )}
        </div>
      </section>
    </Page>
  )
}

function MissingPath() {
  useSeo({ title: 'مسار غير موجود', description: 'المسار المطلوب غير موجود.', path: '/paths', robots: 'noindex, follow' })
  return (
    <Page className="content-learning-paths">
      <div className="px-6 pb-24 pt-44 text-center md:px-11">
        <p className="font-display text-[1.4rem] font-semibold leading-[1.6] text-ink">لم نجد هذا المسار.</p>
        <Link to="/paths" className="mt-4 inline-block text-[.86rem] font-semibold text-accent hover:underline">كل مسارات التعلّم ←</Link>
      </div>
    </Page>
  )
}

export default function LearningPaths() {
  const { id } = useParams()
  if (!id) return <PathsIndex />
  const path = findLearningPath(id)
  return path ? <PathDetail key={path.id} path={path} /> : <MissingPath />
}
