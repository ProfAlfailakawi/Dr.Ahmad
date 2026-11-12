import { useMemo, useState } from 'react'
import type { ArticleRecord, BookRecord, PaperRecord } from '../../lib/cms'
import { buildAtlas, stableHash, ATLAS_KIND_LABEL, type AtlasEntry, type AtlasKind } from '../../lib/storyboard-atlas.ts'
import { MASTER_WORLD_ORDER, resolveWorld, type DesignWorld } from '../../lib/design-worlds.ts'
import { writeVideoSeed } from '../../lib/video-hub.ts'
import type { AdminTab } from './admin-navigation'

/* أطلس القصص البصرية — لوحة إدارية تمرّ على كامل الأرشيف، ترتّب كل عملٍ حسب
   اكتمال مادته وقوة فكرته (مقياسان منفصلان)، تقترح له عالماً من عوالم الاستوديو
   الأربعة والستين، ثم تسلّمه إلى «مدخل الفيديو» ليختار المستخدم المسار. الأطلس أداة
   اختيار المادة وبداية المشروع، لا مسار إنتاج. لا تولّد شيئاً ولا تستهلك مفتاح API
   ولا تكلّف أيّ زائر؛ الحساب حتميٌّ في storyboard-atlas.ts. */

const card = 'bg-canvas border border-hair rounded-2xl overflow-hidden flex flex-col transition-[transform,box-shadow,border-color] duration-200 hover:-translate-y-0.5 hover:shadow-[0_1px_2px_rgba(21,22,26,.04),0_14px_38px_-22px_rgba(21,22,26,.28)] hover:border-accent/40'
const seg = 'inline-flex rounded-xl overflow-hidden border border-hair bg-wash'
const segBtn = (on: boolean) => `font-sans text-[13.5px] px-[15px] py-2 transition-colors border-r border-hair first:border-r-0 ${on ? 'bg-canvas text-ink font-medium' : 'text-soft'}`

// عوالم مجمّعة حسب العائلة — يُختار منها عالمٌ حتميٌّ ببصمة الـslug (لا عشوائية).
const WORLDS_BY_FAMILY = (() => {
  const map: Record<string, DesignWorld[]> = {}
  for (const id of MASTER_WORLD_ORDER) {
    const world = resolveWorld(id)
    if (!world) continue
    ;(map[world.family] ||= []).push(world)
  }
  return map
})()

function worldForEntry(entry: AtlasEntry): DesignWorld {
  const pool = WORLDS_BY_FAMILY[entry.familyHint] || WORLDS_BY_FAMILY.editorial || []
  if (!pool.length) return resolveWorld(MASTER_WORLD_ORDER[0]) as DesignWorld
  return pool[stableHash(entry.slug) % pool.length]
}

function swatches(world: DesignWorld): string[] {
  const p = world.palette
  return [p.background, p.surface, p.accent, p.ink]
}

const rankColor = (rank: number) => (rank <= 3 ? 'rgb(var(--c-accent-deep))' : rank <= 6 ? 'rgb(var(--c-accent))' : 'rgb(var(--c-soft))')

function StoryBoard({ world }: { world: DesignWorld }) {
  const [c0, c1, , c3] = swatches(world)
  const ink = world.palette.ink
  return (
    <svg viewBox="0 0 340 150" role="img" aria-label="لوحة قصة مصغّرة بلون العالم المقترح" className="block w-full h-auto">
      <rect width="340" height="150" fill={c0} />
      <rect x="14" y="14" width="140" height="122" rx="6" fill={c1} />
      <rect x="162" y="14" width="164" height="58" rx="6" fill={c1} />
      <rect x="162" y="78" width="164" height="58" rx="6" fill={c1} />
      <circle cx="84" cy="66" r="26" fill="none" stroke={c3} strokeWidth="2.5" opacity="0.9" />
      <rect x="44" y="104" width="80" height="7" rx="3.5" fill={ink} opacity="0.82" />
      <rect x="60" y="116" width="48" height="6" rx="3" fill={ink} opacity="0.42" />
      <rect x="180" y="30" width="120" height="9" rx="4.5" fill={ink} opacity="0.82" />
      <rect x="180" y="46" width="86" height="7" rx="3.5" fill={c3} opacity="0.8" />
      <rect x="180" y="96" width="120" height="9" rx="4.5" fill={ink} opacity="0.82" />
      <rect x="180" y="112" width="70" height="7" rx="3.5" fill={c3} opacity="0.8" />
    </svg>
  )
}

function openInLiveDirector(entry: AtlasEntry) {
  const detail = entry.seed
  try { sessionStorage.setItem('admin:live-director-seed', JSON.stringify(detail)) } catch { /* بذرة لا تُخزَّن لا توقف الفتح */ }
  window.dispatchEvent(new CustomEvent('studio:live-director-seed', { detail }))
}

/* بداية مشروع: تُسلَّم المادة المختارة إلى مدخل الفيديو، فيختار المستخدم المسار هناك. */
function startVideoProject(entry: AtlasEntry, onOpen?: (tab: AdminTab) => void) {
  const saved = writeVideoSeed(sessionStorage, { origin: 'atlas', kind: entry.kind, slug: entry.slug, title: entry.title, body: entry.seed.article.body, excerpt: entry.seed.article.excerpt, cat: entry.seed.article.cat })
  if (!saved) return false
  onOpen?.('video-hub')
  return true
}

/* الجاهزية تفصل المادة عن الفكرة: «جاهزة للوحة» = مادة كافية + حدٌّ أدنى من المؤشرات اللفظية، لا حكماً بأن الفكرة بصريةٌ ممتازة. */
const BOARD_LABEL = { ready: 'جاهزة للوحة', 'needs-idea': 'المادة كافية — الفكرة تحتاج زاوية بصرية', 'needs-material': 'تحتاج مادة أوضح' } as const
const BOARD_COLOR = { ready: 'rgb(62 107 87)', 'needs-idea': 'rgb(138 109 47)', 'needs-material': 'rgb(138 59 59)' } as const

function ScoreBar({ label, value, hint }: { label: string; value: number; hint: string }) {
  return (
    <div className="flex items-center gap-2.5" title={hint}>
      <span className="min-w-[34px] text-end text-[12.5px] tabular-nums text-soft">{value}٪</span>
      <span className="h-1.5 flex-1 overflow-hidden rounded-full border border-hair bg-wash" role="img" aria-label={`${label} ${value}٪`}>
        <i className="block h-full rounded-full" style={{ width: `${value}%`, background: 'linear-gradient(90deg, rgb(var(--c-accent)), rgb(var(--c-accent-deep)))' }} />
      </span>
      <span className="w-[8.5rem] text-xs text-soft">{label}</span>
    </div>
  )
}

function AtlasCard({ entry, rank, onOpen }: { entry: AtlasEntry; rank: number; onOpen?: (tab: AdminTab) => void }) {
  const world = useMemo(() => worldForEntry(entry), [entry.slug, entry.familyHint])
  const readyLabel = BOARD_LABEL[entry.board]
  const readyColor = BOARD_COLOR[entry.board]
  return (
    <article className={card}>
      <div className="relative">
        <span className="absolute top-2.5 z-[2] inline-flex items-center gap-1.5 rounded-full border border-hair bg-canvas/80 px-2 py-[3px] text-xs text-ink backdrop-blur" style={{ insetInlineStart: '10px' }}>
          <span className="grid h-4 w-4 place-items-center rounded-full text-[10px] font-bold text-white tabular-nums" style={{ background: rankColor(rank) }}>{rank}</span>
          الترتيب
        </span>
        <span className="absolute top-2.5 z-[2] rounded-full border border-accent/25 bg-accent/10 px-2.5 py-1 text-[11.5px] font-medium text-accent-deep" style={{ insetInlineEnd: '10px' }}>{ATLAS_KIND_LABEL[entry.kind]}</span>
        <StoryBoard world={world} />
      </div>

      <div className="flex flex-1 flex-col gap-3 p-4">
        <h3 className="font-display text-[19px] font-semibold leading-snug text-balance">{entry.title}</h3>
        <div className="flex flex-wrap items-center gap-2 text-[12.5px] text-soft">
          <span>{entry.subtitle}</span>
          {entry.year ? (<><span className="h-[3px] w-[3px] rounded-full bg-current opacity-50" /><span className="tabular-nums">{entry.year}</span></>) : null}
        </div>

        <div className="grid gap-1.5">
          <ScoreBar label="اكتمال المادة" value={entry.material} hint="هل في النص ما يكفي لبناء لوحة؟ يقيس الطول ووجود مقتطف وعنوان — لا جودة الفكرة." />
          <ScoreBar label="قوة الفكرة (مؤشرات لفظية)" value={entry.idea} hint="كلمات دالّة على حكاية أو سؤال أو صورة حسية وتظليل القرّاء. مؤشر لفظي لا فهم للمعنى ولا حكم على جودة الفكرة." />
        </div>

        <div className="flex items-center gap-2.5 rounded-xl border border-hair bg-wash px-3 py-2.5">
          <span className="inline-flex" aria-hidden="true">
            {swatches(world).map((color, index) => (
              <span key={index} className="-ms-1 h-[15px] w-[15px] rounded border-[1.5px] border-canvas shadow-[0_0_0_1px_var(--c-hair)]" style={{ background: color }} />
            ))}
          </span>
          <span className="flex flex-col leading-tight">
            <span className="text-[12.5px] font-medium text-ink">{world.labelAr}</span>
            <span className="text-[11px] text-soft">عائلة {world.familyLabel}</span>
          </span>
        </div>

        <div className="flex gap-1.5">
          {[[entry.estimate.shots, 'لقطات'], [`${Math.floor(entry.estimate.seconds)}ث`, 'المدة'], [entry.estimate.layers, 'طبقات']].map(([value, label], index) => (
            <div key={index} className="flex-1 rounded-md border border-hair bg-canvas px-0.5 py-1.5 text-center text-[10.5px] text-soft">
              <b className="block font-display text-xs font-medium text-ink">{value}</b>{label}
            </div>
          ))}
        </div>

        {entry.reasons[0] ? <p className="text-[12px] leading-relaxed text-soft">{[entry.materialReasons[0], entry.ideaReasons[0]].filter(Boolean).join(' · ')}</p> : null}

        <div className="mt-auto flex items-center justify-between gap-2.5 pt-1">
          <span className="inline-flex items-center gap-1.5 text-xs text-soft">
            <span className="h-[7px] w-[7px] rounded-full" style={{ background: readyColor }} />{readyLabel}
          </span>
          <span className="flex flex-wrap justify-end gap-2">
            <button
              type="button"
              onClick={() => { if (!startVideoProject(entry, onOpen)) openInLiveDirector(entry) }}
              className="inline-flex items-center gap-1.5 rounded-[10px] bg-accent px-[15px] py-2 font-sans text-[13px] font-medium text-canvas transition-colors hover:bg-accent-deep"
            >
              ابدأ مشروع فيديو
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-3.5 w-3.5"><path d="M13 5l7 7-7 7M20 12H4" /></svg>
            </button>
            <button type="button" onClick={() => openInLiveDirector(entry)} className="rounded-[10px] border border-hair bg-canvas px-3 py-2 font-sans text-[12.5px] text-soft transition-colors hover:border-accent hover:text-accent">خطة للمخرج الحي مباشرة</button>
          </span>
        </div>
      </div>
    </article>
  )
}

type Filter = 'all' | AtlasKind

type SortKey = 'start' | 'idea' | 'material'
const BOARD_RANK = { ready: 0, 'needs-idea': 1, 'needs-material': 2 } as const

export function StoryboardAtlas({ articles = [], papers = [], books = [], onOpen }: {
  articles?: ArticleRecord[]
  papers?: PaperRecord[]
  books?: BookRecord[]
  onOpen?: (tab: AdminTab) => void
}) {
  const [filter, setFilter] = useState<Filter>('all')
  const [sort, setSort] = useState<SortKey>('start')

  const atlas = useMemo(() => buildAtlas({
    articles: articles.map((a) => ({ slug: a.slug, title: a.title, excerpt: a.excerpt, body: a.body, cat: a.cat, year: a.year })),
    papers: papers.map((p) => ({ slug: p.slug, title: p.title, titleAr: p.titleAr, abstractAr: p.abstractAr, keyFinding: p.keyFinding, researchQuestion: p.researchQuestion, contribution: p.contribution, methodology: p.methodology, keywords: p.keywords, journal: p.journal, year: p.year })),
    books: books.map((b) => ({ slug: b.slug, title: b.title, desc: b.desc, longDescription: b.longDescription, whyWritten: b.whyWritten, toc: b.toc, targetAudience: b.targetAudience, year: b.year })),
  }), [articles, papers, books])

  const shown = useMemo(() => {
    const list = filter === 'all' ? atlas : atlas.filter((e) => e.kind === filter)
    const compare: Record<SortKey, (a: AtlasEntry, b: AtlasEntry) => number> = {
      start: (a, b) => BOARD_RANK[a.board] - BOARD_RANK[b.board] || b.potential - a.potential,
      idea: (a, b) => b.idea - a.idea || b.material - a.material,
      material: (a, b) => b.material - a.material || b.idea - a.idea,
    }
    return [...list].sort(compare[sort])
  }, [atlas, filter, sort])
  const ready = atlas.filter((e) => e.board === 'ready').length
  const strongIdeas = atlas.filter((e) => e.idea >= 65).length

  const stats: Array<[string, string, string]> = [
    [String(atlas.length), '', 'عملاً في الأرشيف'],
    [String(ready), 'عملاً', 'جاهزة للوحة (مادة كافية + مؤشرات فكرة)'],
    [String(atlas.filter((e) => e.board === 'needs-material').length), 'عملاً', 'تحتاج مادة أوضح'],
    [String(strongIdeas), 'عملاً', 'فكرتها قوية بمؤشرات لفظية'],
  ]

  const filters: Array<[Filter, string]> = [['all', 'الكل'], ['article', 'مقالات'], ['paper', 'أبحاث'], ['book', 'كتب']]

  return (
    <section className="grid gap-6" dir="rtl">
      <header className="flex flex-col gap-2">
        <span className="inline-flex items-center gap-2 text-xs font-medium tracking-[0.14em] text-soft before:inline-block before:h-px before:w-[22px] before:bg-accent">الاستوديو · الأطلس</span>
        <h2 className="font-display text-[clamp(24px,4vw,34px)] font-semibold leading-tight text-balance">أطلس القصص البصرية</h2>
        <p className="max-w-[62ch] text-[15px] text-soft">أداة اختيار المادة وبداية المشروع: يمرّ على المقالات والأبحاث والكتب ويقيس لكل عملٍ شيئين منفصلين — <b className="font-medium text-ink">اكتمال المادة</b> (هل تكفي لبناء لوحة؟) و<b className="font-medium text-ink">قوة الفكرة</b> (مؤشرات لفظية: حكاية، سؤال، ألفاظ حسية، تظليل القرّاء). «جاهزة للوحة» تعني مادةً كافية وحداً أدنى من المؤشرات، لا حكماً بأن الفكرة بصرية ممتازة. اختر مادة ثم «ابدأ مشروع فيديو» لتختار المسار في مدخل الفيديو. لا يستهلك شيئاً من أيّ زائر.</p>
      </header>

      <div className="grid grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-px overflow-hidden rounded-2xl border border-hair bg-hair">
        {stats.map(([n, unit, label], index) => (
          <div key={index} className="bg-canvas px-5 py-[18px]">
            <div className="font-display text-[26px] font-semibold leading-none tabular-nums">{n}{unit ? <span className="ms-1 font-sans text-[13px] font-normal text-soft">{unit}</span> : null}</div>
            <div className="mt-1.5 text-[13px] text-soft">{label}</div>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2.5">
        <div className={seg} role="group" aria-label="النوع">
          {filters.map(([value, label]) => (
            <button key={value} type="button" className={segBtn(filter === value)} aria-pressed={filter === value} onClick={() => setFilter(value)}>{label}</button>
          ))}
        </div>
        <div className="flex-1" />
        <label className="flex items-center gap-2 text-[13.5px] text-soft">مرتّب حسب:
          <select value={sort} onChange={(event) => setSort(event.target.value as SortKey)} className="rounded-xl border border-hair bg-canvas px-3 py-1.5 text-[13px] text-ink">
            <option value="start">الأنسب للبدء (جاهزة ثم الأقوى)</option>
            <option value="idea">قوة الفكرة</option>
            <option value="material">اكتمال المادة</option>
          </select>
        </label>
      </div>

      {shown.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-hair bg-wash px-5 py-8 text-center text-soft">لا مواد في هذا التصنيف بعد.</p>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(320px,1fr))] gap-[18px]">
          {shown.map((entry, index) => <AtlasCard key={`${entry.kind}:${entry.slug}`} entry={entry} rank={index + 1} onOpen={onOpen} />)}
        </div>
      )}
    </section>
  )
}
