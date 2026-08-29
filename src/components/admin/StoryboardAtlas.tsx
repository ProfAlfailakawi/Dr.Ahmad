import { useMemo, useState } from 'react'
import type { ArticleRecord, BookRecord, PaperRecord } from '../../lib/cms'
import { buildAtlas, stableHash, ATLAS_KIND_LABEL, type AtlasEntry, type AtlasKind } from '../../lib/storyboard-atlas.ts'
import { MASTER_WORLD_ORDER, resolveWorld, type DesignWorld } from '../../lib/design-worlds.ts'

/* أطلس القصص البصرية — لوحة إدارية تمرّ على كامل الأرشيف، ترتّب كل عملٍ حسب
   إمكانيته البصرية، تقترح له عالماً من عوالم الاستوديو الأربعة والستين، ثم تفتحه
   بنقرةٍ في «المخرج الحي» عبر المصافحة القائمة. لا تولّد شيئاً ولا تستهلك مفتاح
   API ولا تكلّف أيّ زائر؛ الحساب حتميٌّ في storyboard-atlas.ts. */

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

function AtlasCard({ entry, rank }: { entry: AtlasEntry; rank: number }) {
  const world = useMemo(() => worldForEntry(entry), [entry.slug, entry.familyHint])
  const ready = entry.potential >= 55 ? 'good' : entry.potential >= 40 ? 'warn' : 'crit'
  const readyLabel = ready === 'good' ? 'جاهزة للوحة' : ready === 'warn' ? 'تحتاج تقوية الفكرة' : 'تحتاج مادة أوضح'
  const readyColor = ready === 'good' ? 'rgb(62 107 87)' : ready === 'warn' ? 'rgb(138 109 47)' : 'rgb(138 59 59)'
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

        <div className="flex items-center gap-2.5" title="الإمكانية البصرية">
          <span className="min-w-[34px] text-end text-[12.5px] tabular-nums text-soft">{entry.potential}٪</span>
          <span className="h-1.5 flex-1 overflow-hidden rounded-full border border-hair bg-wash">
            <i className="block h-full rounded-full" style={{ width: `${entry.potential}%`, background: 'linear-gradient(90deg, rgb(var(--c-accent)), rgb(var(--c-accent-deep)))' }} />
          </span>
          <span className="text-xs text-soft">إمكانية بصرية</span>
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

        {entry.reasons[0] ? <p className="text-[12px] leading-relaxed text-soft">{entry.reasons.slice(0, 2).join(' · ')}</p> : null}

        <div className="mt-auto flex items-center justify-between gap-2.5 pt-1">
          <span className="inline-flex items-center gap-1.5 text-xs text-soft">
            <span className="h-[7px] w-[7px] rounded-full" style={{ background: readyColor }} />{readyLabel}
          </span>
          <button
            type="button"
            onClick={() => openInLiveDirector(entry)}
            className="inline-flex items-center gap-1.5 rounded-[10px] bg-accent px-[15px] py-2 font-sans text-[13px] font-medium text-white transition-colors hover:bg-accent-deep"
          >
            افتح في المخرج الحي
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-3.5 w-3.5"><path d="M13 5l7 7-7 7M20 12H4" /></svg>
          </button>
        </div>
      </div>
    </article>
  )
}

type Filter = 'all' | AtlasKind

export function StoryboardAtlas({ articles = [], papers = [], books = [] }: {
  articles?: ArticleRecord[]
  papers?: PaperRecord[]
  books?: BookRecord[]
}) {
  const [filter, setFilter] = useState<Filter>('all')

  const atlas = useMemo(() => buildAtlas({
    articles: articles.map((a) => ({ slug: a.slug, title: a.title, excerpt: a.excerpt, body: a.body, cat: a.cat, year: a.year })),
    papers: papers.map((p) => ({ slug: p.slug, title: p.title, titleAr: p.titleAr, abstractAr: p.abstractAr, keyFinding: p.keyFinding, researchQuestion: p.researchQuestion, contribution: p.contribution, methodology: p.methodology, keywords: p.keywords, journal: p.journal, year: p.year })),
    books: books.map((b) => ({ slug: b.slug, title: b.title, desc: b.desc, longDescription: b.longDescription, whyWritten: b.whyWritten, toc: b.toc, targetAudience: b.targetAudience, year: b.year })),
  }), [articles, papers, books])

  const shown = useMemo(() => (filter === 'all' ? atlas : atlas.filter((e) => e.kind === filter)), [atlas, filter])
  const strong = atlas.filter((e) => e.potential >= 55).length

  const stats: Array<[string, string, string]> = [
    [String(atlas.length), '', 'عملاً في الأرشيف'],
    [String(atlas.filter((e) => e.kind === 'article').length), 'مقالاً', 'جاهزة للوحة قصة'],
    [String(atlas.filter((e) => e.kind === 'paper').length + atlas.filter((e) => e.kind === 'book').length), 'مصدراً', 'أبحاث وكتب'],
    [String(strong), 'عملاً', 'إمكانية بصرية عالية'],
  ]

  const filters: Array<[Filter, string]> = [['all', 'الكل'], ['article', 'مقالات'], ['paper', 'أبحاث'], ['book', 'كتب']]

  return (
    <section className="grid gap-6" dir="rtl">
      <header className="flex flex-col gap-2">
        <span className="inline-flex items-center gap-2 text-xs font-medium tracking-[0.14em] text-soft before:inline-block before:h-px before:w-[22px] before:bg-accent">الاستوديو · الأطلس</span>
        <h2 className="font-display text-[clamp(24px,4vw,34px)] font-semibold leading-tight text-balance">أطلس القصص البصرية</h2>
        <p className="max-w-[62ch] text-[15px] text-soft">يمرّ على كامل الأرشيف — المقالات والأبحاث والكتب — ويرتّب كل عملٍ حسب إمكانيته البصرية، يقترح له عالماً من عوالمك، ويجهّز لوحة قصةٍ أولية. بنقرة واحدة يفتح في «المخرج الحي» للتنقيح. لا يستهلك شيئاً من أيّ زائر.</p>
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
        <span className="text-[13.5px] text-soft">مرتّب حسب: <b className="font-medium text-ink">الإمكانية البصرية</b></span>
      </div>

      {shown.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-hair bg-wash px-5 py-8 text-center text-soft">لا مواد في هذا التصنيف بعد.</p>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(320px,1fr))] gap-[18px]">
          {shown.map((entry, index) => <AtlasCard key={`${entry.kind}:${entry.slug}`} entry={entry} rank={index + 1} />)}
        </div>
      )}
    </section>
  )
}
