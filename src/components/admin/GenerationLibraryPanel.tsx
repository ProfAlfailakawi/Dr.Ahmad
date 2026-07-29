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

export function GenerationLibraryPanel(props: Props) {
  const {
    designs, assets, designBusy, assetBusy, designError, assetError, designHasMore, assetHasMore,
    storageStatus, storageMessage, backfillBusy, backfillSummary, savedCount, ghostClass, primaryClass,
    onVerify, onBackfill, onUseDesign, onDeleteDesign, onUseAsset, onDeleteAsset, onOlderDesigns, onOlderAssets,
  } = props
  return (
    <details data-generation-library="true" className="mt-4 overflow-hidden rounded-2xl border border-accent/20 bg-accent/[.025]">
      <summary className="group flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-[.7rem] font-semibold text-ink">
        <span>مكتبة التوليد <span className="ms-2 font-normal text-soft">أرشيف خاص للتصاميم الكاملة والأصول المولّدة</span></span>
        <span className="shrink-0 rounded-full border border-accent/15 bg-paper px-2.5 py-1 text-[.58rem] font-semibold text-accent">{designs.length} تصميم · {assets.length} أصل</span>
      </summary>
      <div className="grid gap-5 border-t border-hair p-3 md:p-4">
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

        <section aria-labelledby="generated-design-library-title">
          <div className="mb-3 flex flex-wrap items-end justify-between gap-2 px-1"><div><h4 id="generated-design-library-title" className="text-[.72rem] font-bold text-ink">التصاميم الكاملة</h4><p className="mt-1 text-[.6rem] leading-relaxed text-soft">كل اتجاه أو حملة أو نسخة نهائية تُحفظ بطبقاتها وتكوينها لتفتحها لاحقاً وتكمل التحرير من حيث توقفت.</p></div><span className="text-[.58rem] text-soft">خاص بلوحة التحكم · غير منشور للعامة</span></div>
          {designBusy && !designs.length ? <p className="rounded-xl border border-dashed border-hair px-4 py-5 text-[.68rem] text-soft">أحمّل أرشيف التصاميم الخاصة…</p> : designs.length ? (
            <div className="mobile-card-rail flex snap-x snap-mandatory gap-3 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {designs.map((asset) => <article key={asset.id} className="w-[210px] shrink-0 snap-start overflow-hidden rounded-2xl border border-hair bg-canvas shadow-[0_12px_32px_rgba(17,41,75,.045)]">
                {asset.thumbnail ? <img src={asset.thumbnail} alt="" className="aspect-[4/3] w-full object-cover" loading="lazy" /> : <div className="relative grid aspect-[4/3] w-full place-items-center overflow-hidden bg-[radial-gradient(circle_at_22%_18%,rgba(47,111,142,.16),transparent_34%),linear-gradient(145deg,var(--paper),var(--canvas))]"><span className="absolute inset-x-5 top-5 h-px bg-accent/15" /><span className="font-display text-3xl font-black text-accent/25">A</span><span className="absolute bottom-4 end-4 text-[.5rem] font-bold tracking-[.18em] text-soft/65">ARCHIVE</span></div>}
                <div className="grid gap-2 p-3 text-right"><div className="flex items-center justify-between gap-2"><span className="rounded-full border border-accent/15 bg-accent/[.045] px-2 py-1 text-[.53rem] font-semibold text-accent">{asset.generationKind}</span>{asset.quality > 0 && <span className="text-[.54rem] font-semibold text-soft">{Math.round(asset.quality)}٪</span>}</div><strong className="line-clamp-2 min-h-[2.5rem] text-[.69rem] leading-relaxed text-ink">{asset.title}</strong><span className="line-clamp-1 text-[.56rem] text-soft">{asset.directionLabel || asset.note || 'نسخة محفوظة'}</span><span className="text-[.53rem] text-soft" dir="ltr">{asset.width}×{asset.height}{asset.formatLabel ? ` · ${asset.formatLabel}` : ''} · {asset.createdAtMs ? new Date(asset.createdAtMs).toLocaleDateString('ar-KW-u-nu-latn') : ''}</span><div className="flex gap-2"><button type="button" className={`${primaryClass} flex-1 px-3 py-2 text-[.62rem]`} disabled={designBusy} onClick={() => onUseDesign(asset)}>فتح للتعديل</button><button type="button" className={`${ghostClass} px-3 py-2 text-[.62rem]`} disabled={designBusy} onClick={() => onDeleteDesign(asset)}>حذف</button></div></div>
              </article>)}
            </div>
          ) : <p className="rounded-xl border border-dashed border-hair px-4 py-5 text-[.68rem] text-soft">لا توجد تصاميم مؤرشفة بعد. أول توليد جديد سيُحفظ هنا تلقائياً بكامل تكوينه.</p>}
          {designs.length > 0 && designHasMore && <div className="mt-3 text-center"><button type="button" className={ghostClass} disabled={designBusy} onClick={onOlderDesigns}>{designBusy ? 'أحمّل…' : 'تحميل تصاميم أقدم'}</button></div>}
        </section>

        <section aria-labelledby="generated-image-library-title" className="border-t border-hair pt-4">
          <div className="mb-3 flex flex-wrap items-end justify-between gap-2 px-1"><div><h4 id="generated-image-library-title" className="text-[.72rem] font-bold text-ink">الأصول البصرية المولّدة</h4><p className="mt-1 text-[.6rem] leading-relaxed text-soft">الصور الأصلية التي أنشأها الاستوديو تبقى مستقلة أيضاً، لتعيد استخدامها داخل أي تصميم جديد.</p></div><span className="text-[.58rem] text-soft">الأصل الكامل محفوظ في Storage الخاص</span></div>
          {assetBusy && !assets.length ? <p className="rounded-xl border border-dashed border-hair px-4 py-5 text-[.68rem] text-soft">أحمّل الأصول البصرية الخاصة…</p> : assets.length ? (
            <div className="mobile-card-rail flex snap-x snap-mandatory gap-3 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {assets.map((asset) => <article key={asset.id} className="w-[190px] shrink-0 snap-start overflow-hidden rounded-2xl border border-hair bg-canvas"><img src={asset.thumbnail} alt="" className="aspect-[4/3] w-full object-cover" loading="lazy" /><div className="grid gap-2 p-3 text-right"><strong className="line-clamp-2 text-[.7rem] text-ink">{asset.title}</strong><span className="line-clamp-1 text-[.58rem] text-soft">{asset.visualWorld || asset.model || 'توليد أصلي'}</span><span className="text-[.55rem] text-soft" dir="ltr">{asset.width}×{asset.height} · {asset.generatedAt ? new Date(asset.generatedAt).toLocaleDateString('ar-KW-u-nu-latn') : ''}</span><div className="flex gap-2"><button type="button" className={`${primaryClass} flex-1 px-3 py-2 text-[.62rem]`} disabled={assetBusy} onClick={() => onUseAsset(asset)}>استخدم/عدّل</button><button type="button" className={`${ghostClass} px-3 py-2 text-[.62rem]`} disabled={assetBusy} onClick={() => onDeleteAsset(asset)}>حذف</button></div></div></article>)}
            </div>
          ) : <p className="rounded-xl border border-dashed border-hair px-4 py-5 text-[.68rem] text-soft">لا توجد أصول مولّدة بعد. أول صورة تُنشأ من الصفر ستدخل هنا تلقائياً من دون أن تختلط بمكتبة الموقع العامة.</p>}
          {assets.length > 0 && assetHasMore && <div className="mt-3 text-center"><button type="button" className={ghostClass} disabled={assetBusy} onClick={onOlderAssets}>{assetBusy ? 'أحمّل…' : 'تحميل أصول أقدم'}</button></div>}
        </section>
      </div>
    </details>
  )
}
