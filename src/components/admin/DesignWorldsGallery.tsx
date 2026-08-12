/**
 * معرض عوالم التصميم — شريط الدساتير الثمانية.
 *
 * كل بطاقة ملصقٌ حيّ يُصاغ بمحرك التصميم نفسه (مرشح خفيف عبر worldPreviewPlan)
 * ويُجسَّد في عالمه كاملاً: الجوّ واللون والطباعة والعمق. البطاقة تلبس ألوان
 * عالمها هي نفسها، فيصير الشريط ذاته لوحةً تتعاقب فيها الليالي والأصباح.
 *
 * الشريط يُلَفّ يميناً ويساراً بيد الدكتور — بلا حركة ذاتية إطلاقاً.
 * الملصقات تُبنى تباعاً بعد التركيب (ملصق لكل إطار) وتُحفظ في ذاكرة الوحدة،
 * فلا يدفع الاستوديو كلفتها إلا مرة واحدة في الجلسة.
 */

import { useEffect, useState } from 'react'
import {
  DESIGN_WORLDS,
  WORLD_ORDER,
  worldPreviewPlan,
  type DesignWorld,
  type DesignWorldId,
} from '../../lib/design-worlds'
import { renderCompositionSvg } from '../../lib/social-design-renderer'

/** ذاكرة ملصقات الجلسة: العالم لا يتبدل نصّ معاينته فلا يُرسم مرتين. */
const posterCache = new Map<DesignWorldId, string>()

function posterOf(world: DesignWorld): string {
  const cached = posterCache.get(world.id)
  if (cached) return cached
  const svg = renderCompositionSvg(worldPreviewPlan(world), { ariaLabel: `ملصق عالم ${world.label}` })
  posterCache.set(world.id, svg)
  return svg
}

export interface DesignWorldsGalleryProps {
  /** العالم الذي يكسو التصميم المختار الآن (للتمييز في المعرض). */
  activeWorldId?: DesignWorldId | null
  /** كسوة: يلبس الجوَّ واللون مع إبقاء بنية التصميم. */
  onDress: (world: DesignWorld) => void
  /** ولادة كاملة من داخل العالم (توليد دفعة جديدة بدستوره). */
  onGenerate?: (world: DesignWorld) => void
  /** إزالة الكسوة والعودة للوحات المختارة. */
  onClear?: () => void
  /** نسخة مضغوطة (منشور مستقل): بطاقات أصغر بلا دستور مفصل. */
  compact?: boolean
}

export default function DesignWorldsGallery({ activeWorldId, onDress, onGenerate, onClear, compact }: DesignWorldsGalleryProps) {
  /* الملصقات تُبنى تباعاً كي لا يقف الاستوديو لحظة الفتح: ملصق كل إطار. */
  const [readyCount, setReadyCount] = useState(() => posterCache.size >= WORLD_ORDER.length ? WORLD_ORDER.length : 0)
  useEffect(() => {
    if (readyCount >= WORLD_ORDER.length) return
    let cancelled = false
    const frame = requestAnimationFrame(() => {
      if (cancelled) return
      posterOf(DESIGN_WORLDS[WORLD_ORDER[readyCount]])
      setReadyCount((count) => count + 1)
    })
    return () => { cancelled = true; cancelAnimationFrame(frame) }
  }, [readyCount])

  return (
    <section className="mt-3 overflow-hidden rounded-2xl border border-hair" style={{ background: 'linear-gradient(160deg, #0B101C 0%, #111827 55%, #16202F 100%)' }}>
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 pt-3.5">
        <div className="min-w-0">
          <p className="font-display text-[.95rem] font-bold" style={{ color: '#EDF2FB' }}>
            عوالم التصميم
            <span className="mr-2 rounded-full px-2 py-0.5 text-[.55rem] font-semibold tracking-wide" style={{ background: 'rgba(134,168,240,.14)', color: '#A9C2F5', border: '1px solid rgba(134,168,240,.3)' }}>8 دساتير متكاملة</span>
          </p>
          <p className="mt-0.5 text-[.62rem]" style={{ color: '#93A3C0' }}>
            جوٌّ ولونٌ وطباعةٌ وعمقٌ بضغطة واحدة — على نهج دساتير العلامات العالمية، مطوّعةً لهويتك لا منسوخة.
          </p>
        </div>
        {activeWorldId ? (
          <span className="flex items-center gap-1.5">
            <span className="rounded-full px-2.5 py-1 text-[.6rem] font-bold" style={{ background: 'rgba(134,168,240,.16)', color: '#C7D7FF' }}>يلبس الآن: {DESIGN_WORLDS[activeWorldId].label}</span>
            {onClear && (
              <button type="button" onClick={onClear} className="rounded-full border px-2.5 py-1 text-[.6rem] font-semibold transition hover:opacity-80" style={{ borderColor: 'rgba(237,242,251,.25)', color: '#B9C6DE' }}>أزل الكسوة</button>
            )}
          </span>
        ) : null}
      </div>

      <div className="flex snap-x gap-3 overflow-x-auto px-4 pb-4 pt-3" style={{ scrollbarWidth: 'thin' }}>
        {WORLD_ORDER.map((worldId, index) => {
          const world = DESIGN_WORLDS[worldId]
          const wp = world.palette
          const ready = index < readyCount
          const active = activeWorldId === world.id
          return (
            <article
              key={world.id}
              className={`group relative shrink-0 snap-start overflow-hidden rounded-xl transition-transform duration-300 ${compact ? 'w-40' : 'w-52'} ${active ? '' : 'hover:-translate-y-1'}`}
              style={{
                background: wp.background,
                border: `1px solid ${active ? wp.accent : wp.rule}`,
                boxShadow: active
                  ? `0 0 0 2px ${wp.accent}55, 0 14px 30px -18px ${wp.isDark ? '#000000CC' : '#3A2E2255'}`
                  : `0 10px 24px -20px ${wp.isDark ? '#000000B3' : '#3A2E2240'}`,
              }}
            >
              <button
                type="button"
                onClick={() => onDress(world)}
                title={`${world.essence}\n\nافعل: ${world.dos.join(' · ')}\nلا تفعل: ${world.donts.join(' · ')}`}
                className="block w-full text-right"
                aria-label={`اكسُ التصاميم بعالم ${world.label}`}
              >
                <span className="relative block w-full overflow-hidden" style={{ aspectRatio: '4 / 5', background: wp.background }}>
                  {ready ? (
                    <span className="absolute inset-0 block" dangerouslySetInnerHTML={{ __html: posterOf(world) }} />
                  ) : (
                    <span className="absolute inset-0 block animate-pulse" style={{ background: `linear-gradient(150deg, ${wp.background} 30%, ${wp.surface} 60%, ${wp.background} 85%)` }} />
                  )}
                  {active && (
                    <span className="absolute right-2 top-2 rounded-full px-2 py-0.5 text-[.55rem] font-bold" style={{ background: wp.accent, color: wp.isDark ? '#10131C' : '#FFFFFF' }}>العالم الحي</span>
                  )}
                </span>
                <span className="block px-3 pb-2 pt-2" style={{ borderTop: `1px solid ${wp.rule}` }}>
                  <span className="block font-display text-[.82rem] font-bold leading-snug" style={{ color: wp.ink }}>{world.label}</span>
                  <span className="mt-0.5 block text-[.58rem] leading-relaxed" style={{ color: wp.muted }}>{world.tagline}</span>
                  {!compact && <span className="mt-1 block text-[.52rem] italic opacity-80" style={{ color: wp.muted }}>{world.reference}</span>}
                </span>
              </button>
              {onGenerate && (
                <div className="px-3 pb-2.5">
                  <button
                    type="button"
                    onClick={() => onGenerate(world)}
                    className="w-full rounded-full px-2 py-1 text-[.58rem] font-bold transition hover:opacity-85"
                    style={{ background: wp.accent, color: wp.isDark ? '#10131C' : '#FFFFFF' }}
                  >ولادة كاملة من هذا العالم</button>
                </div>
              )}
            </article>
          )
        })}
      </div>
    </section>
  )
}
