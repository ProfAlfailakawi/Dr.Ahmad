import { useEffect, useMemo, useState } from 'react'

export type GeneratedLibraryAsset = {
  id: string
  storagePath: string
  title: string
  note: string
  thumbnail: string
  mime: string
  width: number
  height: number
  prompt: string
  model: string
  generatedAt: string
  visualWorld: string
  description: string
  createdAtMs: number
}

export type GeneratedDesignLibraryAsset = {
  id: string
  storagePath: string
  title: string
  note: string
  thumbnail: string
  formatId: string
  formatLabel: string
  width: number
  height: number
  quality: number
  directionLabel: string
  generationKind: string
  createdAtMs: number
  topic?: string
  visualWorld?: string
  campaign?: string
  /* ذاكرة ما نجح (٣١ يوليو): ما اختاره الدكتور فعلاً — عائلةً ولوحةً ونبرة. */
  layoutFamily?: string
  paletteId?: string
  toneId?: string
  kindId?: string
  seasonIdentity?: string
}

type Props = {
  designs: GeneratedDesignLibraryAsset[]
  assets: GeneratedLibraryAsset[]
  designBusy: boolean
  assetBusy: boolean
  designError: string
  assetError: string
  designHasMore: boolean
  assetHasMore: boolean
  storageStatus: 'idle' | 'checking' | 'ready' | 'failed'
  storageMessage: string
  backfillBusy: boolean
  backfillSummary: string
  savedCount: number
  ghostClass: string
  primaryClass: string
  onVerify: () => void
  onBackfill: () => void
  onUseDesign: (asset: GeneratedDesignLibraryAsset) => void
  onDeleteDesign: (asset: GeneratedDesignLibraryAsset) => void
  onUseAsset: (asset: GeneratedLibraryAsset) => void
  onDeleteAsset: (asset: GeneratedLibraryAsset) => void
  onOlderDesigns: () => void
  onOlderAssets: () => void
}

const FAVES_KEY = 'dr-ahmad-generation-library-faves-v1'
const normalized = (value: unknown) => String(value || '').toLocaleLowerCase('ar').replace(/\s+/g, ' ').trim()
const dimensions = (width: number, height: number) => width && height ? `${width}×${height}` : ''

function loadFavorites() {
  if (typeof window === 'undefined') return new Set<string>()
  try {
    const value = JSON.parse(window.localStorage.getItem(FAVES_KEY) || '[]')
    return new Set(Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [])
  } catch { return new Set<string>() }
}

export function GenerationLibraryPanel(props: Props) {
  const {
    designs, assets, designBusy, assetBusy, designError, assetError, designHasMore, assetHasMore,
    storageStatus, storageMessage, backfillBusy, backfillSummary, savedCount, ghostClass, primaryClass,
    onVerify, onBackfill, onUseDesign, onDeleteDesign, onUseAsset, onDeleteAsset, onOlderDesigns, onOlderAssets,
  } = props

  const [search, setSearch] = useState('')
  const [kind, setKind] = useState<'all' | 'design' | 'asset' | 'campaign'>('all')
  const [generationKind, setGenerationKind] = useState('all')
  const [size, setSize] = useState('all')
  const [world, setWorld] = useState('all')
  const [dateRange, setDateRange] = useState<'all' | '1' | '7' | '30' | '365'>('all')
  const [favoritesOnly, setFavoritesOnly] = useState(false)
  const [favorites, setFavorites] = useState<Set<string>>(() => loadFavorites())

  useEffect(() => {
    try { window.localStorage.setItem(FAVES_KEY, JSON.stringify([...favorites])) } catch { /* المفضلة تحسين محلي؛ لا توقف المكتبة */ }
  }, [favorites])

  const generationKinds = useMemo(() => [...new Set(designs.map((item) => item.generationKind).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'ar')), [designs])
  const sizes = useMemo(() => [...new Set([
    ...designs.map((item) => item.formatLabel || dimensions(item.width, item.height)),
    ...assets.map((item) => dimensions(item.width, item.height)),
  ].filter(Boolean))].sort((a, b) => a.localeCompare(b, 'ar')), [assets, designs])
  const worlds = useMemo(() => [...new Set([
    ...designs.map((item) => item.visualWorld || item.directionLabel),
    ...assets.map((item) => item.visualWorld),
  ].filter(Boolean))].sort((a, b) => a.localeCompare(b, 'ar')), [assets, designs])

  const terms = normalized(search).split(' ').filter(Boolean)
  const withinDate = (createdAtMs: number) => {
    if (dateRange === 'all') return true
    const days = Number(dateRange)
    return createdAtMs > 0 && Date.now() - createdAtMs <= days * 86_400_000
  }
  const textMatch = (values: unknown[]) => {
    if (!terms.length) return true
    const haystack = normalized(values.join(' '))
    return terms.every((term) => haystack.includes(term))
  }
  const toggleFavorite = (id: string) => setFavorites((current) => {
    const next = new Set(current)
    if (next.has(id)) next.delete(id); else next.add(id)
    return next
  })

  const filteredDesigns = useMemo(() => designs.slice(0, 1).filter((item) => {
    if (kind === 'asset') return false
    if (kind === 'campaign' && !/(?:حملة|campaign)/i.test(item.campaign || item.generationKind)) return false
    if (generationKind !== 'all' && item.generationKind !== generationKind) return false
    const itemSize = item.formatLabel || dimensions(item.width, item.height)
    if (size !== 'all' && itemSize !== size) return false
    const itemWorld = item.visualWorld || item.directionLabel
    if (world !== 'all' && itemWorld !== world) return false
    if (!withinDate(item.createdAtMs)) return false
    if (favoritesOnly && !favorites.has(item.id)) return false
    return textMatch([item.title, item.topic, item.note, item.formatLabel, item.generationKind, item.campaign, item.directionLabel, item.visualWorld])
  }), [designs, kind, generationKind, size, world, dateRange, favoritesOnly, favorites, search])

  const filteredAssets = useMemo(() => assets.filter((item) => {
    if (kind === 'design' || kind === 'campaign') return false
    const itemSize = dimensions(item.width, item.height)
    if (size !== 'all' && itemSize !== size) return false
    if (world !== 'all' && item.visualWorld !== world) return false
    if (!withinDate(item.createdAtMs)) return false
    if (favoritesOnly && !favorites.has(item.id)) return false
    return textMatch([item.title, item.note, item.description, item.prompt, item.model, item.visualWorld])
  }), [assets, kind, size, world, dateRange, favoritesOnly, favorites, search])

  const filtersActive = Boolean(search.trim() || kind !== 'all' || generationKind !== 'all' || size !== 'all' || world !== 'all' || dateRange !== 'all' || favoritesOnly)
  const resetFilters = () => { setSearch(''); setKind('all'); setGenerationKind('all'); setSize('all'); setWorld('all'); setDateRange('all'); setFavoritesOnly(false) }
  const selectClass = 'min-h-10 rounded-xl border border-hair bg-canvas px-3 text-[.62rem] font-semibold text-soft outline-none transition focus:border-accent'

  return (
    <details data-generation-library="true" className="mt-4 overflow-hidden rounded-2xl border border-accent/20 bg-accent/[.025]">
      <summary className="group flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-[.7rem] font-semibold text-ink">
        <span>مكتبة التوليد <span className="ms-2 font-normal text-soft">آخر تصميم معتمد + كل الأصول المولّدة</span></span>
        <span className="shrink-0 rounded-full border border-accent/15 bg-paper px-2.5 py-1 text-[.58rem] font-semibold text-accent">{designs.length ? 'تصميم معتمد' : 'لا تصميم معتمد'} · {assets.length} أصل</span>
      </summary>
      <div className="grid gap-5 border-t border-hair p-3 md:p-4">
        <div className="rounded-2xl border border-hair bg-paper/70 p-3">
          <div className="flex flex-wrap items-center gap-2">
            <label className="relative min-w-[220px] flex-1">
              <span className="sr-only">ابحث في مكتبة التوليد</span>
              <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="ابحث بالعنوان، الموضوع، العالم البصري أو الحملة…" className="min-h-11 w-full rounded-xl border border-hair bg-canvas px-4 pe-10 text-[.68rem] text-ink outline-none placeholder:text-soft/55 focus:border-accent" />
              <span aria-hidden className="pointer-events-none absolute end-3 top-1/2 -translate-y-1/2 text-accent">⌕</span>
            </label>
            <select aria-label="نوع الأصل" className={selectClass} value={kind} onChange={(event) => setKind(event.target.value as typeof kind)}><option value="all">كل الأصول</option><option value="design">التصاميم فقط</option><option value="asset">الصور فقط</option><option value="campaign">الحملات فقط</option></select>
            <select aria-label="نوع التصميم" className={selectClass} value={generationKind} onChange={(event) => setGenerationKind(event.target.value)} disabled={kind === 'asset'}><option value="all">كل أنواع التصميم</option>{generationKinds.map((value) => <option key={value} value={value}>{value}</option>)}</select>
            <select aria-label="المقاس" className={selectClass} value={size} onChange={(event) => setSize(event.target.value)}><option value="all">كل المقاسات</option>{sizes.map((value) => <option key={value} value={value}>{value}</option>)}</select>
            <select aria-label="العالم البصري" className={selectClass} value={world} onChange={(event) => setWorld(event.target.value)}><option value="all">كل العوالم البصرية</option>{worlds.map((value) => <option key={value} value={value}>{value}</option>)}</select>
            <select aria-label="التاريخ" className={selectClass} value={dateRange} onChange={(event) => setDateRange(event.target.value as typeof dateRange)}><option value="all">كل التواريخ</option><option value="1">اليوم</option><option value="7">آخر 7 أيام</option><option value="30">آخر 30 يوماً</option><option value="365">آخر سنة</option></select>
            <button type="button" aria-pressed={favoritesOnly} onClick={() => setFavoritesOnly((value) => !value)} className={`${selectClass} ${favoritesOnly ? 'border-accent bg-accent/[.07] text-accent' : ''}`}>★ المفضلة</button>
            {filtersActive && <button type="button" onClick={resetFilters} className={ghostClass}>مسح الفلاتر</button>}
          </div>
          <p className="mt-2 px-1 text-[.58rem] text-soft">{filteredDesigns.length + filteredAssets.length} نتيجة من {designs.length + assets.length} · البحث والفلترة يعملان داخل المكتبة نفسها بلا شاشة إضافية.</p>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-hair bg-paper/70 px-3 py-2.5">
          <div className="min-w-0">
            <p className="text-[.62rem] font-semibold text-ink">حالة التخزين السحابي</p>
            <p className={`mt-1 text-[.58rem] leading-relaxed ${storageStatus === 'ready' ? 'text-emerald-700' : storageStatus === 'failed' ? 'text-amber-800' : 'text-soft'}`}>{storageMessage || 'سيُفحص Firebase Storage تلقائياً عند دخول المشرف.'}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className={`rounded-full px-2.5 py-1 text-[.56rem] font-bold ${storageStatus === 'ready' ? 'bg-emerald-100 text-emerald-700' : storageStatus === 'failed' ? 'bg-amber-100 text-amber-800' : 'bg-wash text-soft'}`}>{storageStatus === 'ready' ? 'Storage جاهز' : storageStatus === 'checking' ? 'أفحص…' : storageStatus === 'failed' ? 'يحتاج مراجعة' : 'غير مفحوص'}</span>
            <button type="button" className={ghostClass} disabled={storageStatus === 'checking'} onClick={onVerify}>إعادة الفحص</button>
            <button type="button" className={ghostClass} disabled={backfillBusy || storageStatus === 'checking' || !savedCount} onClick={onBackfill}>{backfillBusy ? 'أستعيد…' : `استعادة المحفوظات القديمة (${savedCount})`}</button>
          </div>
        </div>
        {backfillSummary && <p className="rounded-xl border border-accent/15 bg-accent/[.035] px-3 py-2 text-[.6rem] leading-relaxed text-soft">{backfillSummary}</p>}
        {(designError || assetError) && <div className="grid gap-2">{designError && <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[.62rem] leading-relaxed text-amber-900">{designError}</p>}{assetError && <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[.62rem] leading-relaxed text-amber-900">{assetError}</p>}</div>}

        {kind !== 'asset' && <section aria-labelledby="generated-design-library-title">
          <div className="mb-3 flex flex-wrap items-end justify-between gap-2 px-1"><div><h4 id="generated-design-library-title" className="text-[.72rem] font-bold text-ink">آخر تصميم معتمد</h4><p className="mt-1 text-[.6rem] leading-relaxed text-soft">يبقى تصميم كامل واحد بطبقاته وتكوينه؛ اعتماد نسخة جديدة يستبدله من دون تكديس مرشحي التوليد.</p></div><span className="text-[.58rem] text-soft">خاص بلوحة التحكم · غير منشور للعامة</span></div>
          {designBusy && !designs.length ? <p className="rounded-xl border border-dashed border-hair px-4 py-5 text-[.68rem] text-soft">أحمّل آخر تصميم معتمد…</p> : filteredDesigns.length ? (
            <div className="mobile-card-rail flex snap-x snap-mandatory gap-3 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {filteredDesigns.map((asset) => <article key={asset.id} className="relative w-[210px] shrink-0 snap-start overflow-hidden rounded-2xl border border-hair bg-canvas shadow-[0_12px_32px_rgba(17,41,75,.045)]">
                <button type="button" onClick={() => toggleFavorite(asset.id)} aria-pressed={favorites.has(asset.id)} aria-label={favorites.has(asset.id) ? 'إزالة من المفضلة' : 'إضافة إلى المفضلة'} title={favorites.has(asset.id) ? 'إزالة من المفضلة' : 'إضافة إلى المفضلة'} className={`absolute end-2 top-2 z-10 flex h-8 w-8 items-center justify-center rounded-full border bg-canvas/90 text-sm shadow-sm backdrop-blur ${favorites.has(asset.id) ? 'border-accent text-accent' : 'border-hair text-soft'}`}>{favorites.has(asset.id) ? '★' : '☆'}</button>
                {asset.thumbnail ? <img src={asset.thumbnail} alt="" className="aspect-[4/3] w-full object-cover" loading="lazy" /> : <div className="relative grid aspect-[4/3] w-full place-items-center overflow-hidden bg-[radial-gradient(circle_at_22%_18%,rgba(47,111,142,.16),transparent_34%),linear-gradient(145deg,var(--paper),var(--canvas))]"><span className="absolute inset-x-5 top-5 h-px bg-accent/15" /><span className="font-display text-3xl font-black text-accent/25">A</span><span className="absolute bottom-4 end-4 text-[.5rem] font-bold tracking-[.18em] text-soft/65">ARCHIVE</span></div>}
                <div className="grid gap-2 p-3 text-right"><div className="flex items-center justify-between gap-2"><span className="rounded-full border border-accent/15 bg-accent/[.045] px-2 py-1 text-[.53rem] font-semibold text-accent">{asset.generationKind}</span>{asset.quality > 0 && <span className="text-[.54rem] font-semibold text-soft">{Math.round(asset.quality)}٪</span>}</div><strong className="line-clamp-2 min-h-[2.5rem] text-[.69rem] leading-relaxed text-ink">{asset.title}</strong><span className="line-clamp-1 text-[.56rem] text-soft">{asset.visualWorld || asset.directionLabel || asset.note || 'نسخة محفوظة'}</span><span className="text-[.53rem] text-soft" dir="ltr">{asset.width}×{asset.height}{asset.formatLabel ? ` · ${asset.formatLabel}` : ''} · {asset.createdAtMs ? new Date(asset.createdAtMs).toLocaleDateString('ar-KW-u-nu-latn') : ''}</span><div className="flex gap-2"><button type="button" className={`${primaryClass} flex-1 px-3 py-2 text-[.62rem]`} disabled={designBusy} onClick={() => onUseDesign(asset)}>فتح للتعديل</button><button type="button" className={`${ghostClass} px-3 py-2 text-[.62rem]`} disabled={designBusy} onClick={() => onDeleteDesign(asset)}>حذف</button></div></div>
              </article>)}
            </div>
          ) : <p className="rounded-xl border border-dashed border-hair px-4 py-5 text-[.68rem] text-soft">{filtersActive ? 'التصميم المعتمد لا يطابق البحث أو الفلاتر الحالية.' : 'لا يوجد تصميم معتمد بعد. سيظهر هنا بعد اعتماد النتيجة أو حفظ التحرير.'}</p>}
          {designs.length > 0 && designHasMore && <div className="mt-3 text-center"><button type="button" className={ghostClass} disabled={designBusy} onClick={onOlderDesigns}>{designBusy ? 'أحمّل…' : 'تحميل تصاميم أقدم'}</button></div>}
        </section>}

        {kind !== 'design' && kind !== 'campaign' && <section aria-labelledby="generated-image-library-title" className="border-t border-hair pt-4">
          <div className="mb-3 flex flex-wrap items-end justify-between gap-2 px-1"><div><h4 id="generated-image-library-title" className="text-[.72rem] font-bold text-ink">الأصول البصرية المولّدة</h4><p className="mt-1 text-[.6rem] leading-relaxed text-soft">الصور الأصلية التي أنشأها الاستوديو تبقى مستقلة أيضاً، لتعيد استخدامها داخل أي تصميم جديد.</p></div><span className="text-[.58rem] text-soft">الأصل الكامل محفوظ في Storage الخاص</span></div>
          {assetBusy && !assets.length ? <p className="rounded-xl border border-dashed border-hair px-4 py-5 text-[.68rem] text-soft">أحمّل الأصول البصرية الخاصة…</p> : filteredAssets.length ? (
            <div className="mobile-card-rail flex snap-x snap-mandatory gap-3 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {filteredAssets.map((asset) => <article key={asset.id} className="relative w-[190px] shrink-0 snap-start overflow-hidden rounded-2xl border border-hair bg-canvas"><button type="button" onClick={() => toggleFavorite(asset.id)} aria-pressed={favorites.has(asset.id)} aria-label={favorites.has(asset.id) ? 'إزالة من المفضلة' : 'إضافة إلى المفضلة'} title={favorites.has(asset.id) ? 'إزالة من المفضلة' : 'إضافة إلى المفضلة'} className={`absolute end-2 top-2 z-10 flex h-8 w-8 items-center justify-center rounded-full border bg-canvas/90 text-sm shadow-sm backdrop-blur ${favorites.has(asset.id) ? 'border-accent text-accent' : 'border-hair text-soft'}`}>{favorites.has(asset.id) ? '★' : '☆'}</button><img src={asset.thumbnail} alt="" className="aspect-[4/3] w-full object-cover" loading="lazy" /><div className="grid gap-2 p-3 text-right"><strong className="line-clamp-2 text-[.7rem] text-ink">{asset.title}</strong><span className="line-clamp-1 text-[.58rem] text-soft">{asset.visualWorld || asset.model || 'توليد أصلي'}</span><span className="text-[.55rem] text-soft" dir="ltr">{asset.width}×{asset.height} · {asset.generatedAt ? new Date(asset.generatedAt).toLocaleDateString('ar-KW-u-nu-latn') : ''}</span><div className="flex gap-2"><button type="button" className={`${primaryClass} flex-1 px-3 py-2 text-[.62rem]`} disabled={assetBusy} onClick={() => onUseAsset(asset)}>استخدم/عدّل</button><button type="button" className={`${ghostClass} px-3 py-2 text-[.62rem]`} disabled={assetBusy} onClick={() => onDeleteAsset(asset)}>حذف</button></div></div></article>)}
            </div>
          ) : <p className="rounded-xl border border-dashed border-hair px-4 py-5 text-[.68rem] text-soft">{filtersActive ? 'لا توجد أصول بصرية تطابق البحث أو الفلاتر الحالية.' : 'لا توجد أصول مولّدة بعد. أول صورة تُنشأ من الصفر ستدخل هنا تلقائياً من دون أن تختلط بمكتبة الموقع العامة.'}</p>}
          {assets.length > 0 && assetHasMore && <div className="mt-3 text-center"><button type="button" className={ghostClass} disabled={assetBusy} onClick={onOlderAssets}>{assetBusy ? 'أحمّل…' : 'تحميل أصول أقدم'}</button></div>}
        </section>}
      </div>
    </details>
  )
}
