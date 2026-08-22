/**
 * استوديو الريل السينمائي — يحوّل أي مادة إلى فيديو عمودي 1080×1920
 * بصوت مؤلَّف داخل المتصفح، ويصدّره ملفاً جاهزاً للنشر. كل شيء محلي
 * ومجاني: لا خدمة خارجية ولا تسجيل شاشة.
 *
 * يُحمَّل كسولاً من استوديو التصاميم كي لا يثقل حزمة اللوحة.
 */

import { useEffect, useMemo, useRef, useState } from 'react'
import { auditReelPlan, planReel, planReelWithMemory, commitReelMemory, type ReelPlan } from '../../lib/reel-scenes'
import { downloadReelBlob, exportReelVideo, playReelPreview, reelExportSupported, type ReelHandle } from '../../lib/reel-motion'
import { arabicCountPhrase, REEL_SCENE_FORMS, SECOND_FORMS } from '../../lib/arabic-count.ts'

const card = 'rounded-[1.75rem] border border-hair bg-paper p-5 shadow-sm md:p-7'
const input = 'w-full rounded-2xl border border-hair bg-canvas px-4 py-3 text-[.88rem] text-ink outline-none transition focus:border-accent'
const primary = 'rounded-full bg-accent px-5 py-2.5 text-[.8rem] font-bold text-white transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-50'
const ghost = 'rounded-full border border-hair bg-canvas px-4 py-2 text-[.76rem] font-semibold text-soft transition hover:border-accent hover:text-accent disabled:opacity-50'

const TEMPLATE_LABELS: Record<ReelPlan['templateId'], string> = {
  question: 'السؤال',
  siren: 'الصفارة',
  weave: 'النسيج',
  manuscript: 'المخطوطة',
  counter: 'العدّاد',
}
const MOOD_LABELS: Record<ReelPlan['mood'], string> = {
  dark: 'داكن مشدود',
  warm: 'دافئ إنساني',
  bright: 'مشرق احتفالي',
  scholar: 'رصين معرفي',
}

export function ReelStudio({ seedText = '' }: { seedText?: string }) {
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [variant, setVariant] = useState(0)
  const [plan, setPlan] = useState<ReelPlan | null>(null)
  const [busy, setBusy] = useState<'idle' | 'preview' | 'export'>('idle')
  const [progress, setProgress] = useState(0)
  const [notice, setNotice] = useState('')
  const [memoryNote, setMemoryNote] = useState('')
  const memoryKeyRef = useRef<string>('')
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const handleRef = useRef<ReelHandle | null>(null)
  const supported = useMemo(() => reelExportSupported(), [])
  const quality = useMemo(() => plan ? auditReelPlan(plan) : null, [plan])

  /* نص الاستوديو الحالي يصير بذرة الريل تلقائياً — بلا نسخ يدوي. */
  useEffect(() => {
    if (!body && seedText.trim()) setBody(seedText.trim())
  }, [seedText, body])

  useEffect(() => () => { handleRef.current?.stop() }, [])

  const buildPlan = (nextVariant = variant, useMemory = false) => {
    const cleanTitle = title.trim() || body.trim().split(/[\n.!؟…]/)[0]?.trim() || 'مادة جديدة'
    if (!body.trim() && !title.trim()) { setNotice('اكتب المادة أولاً — عنواناً أو فقرة من المقال.'); return null }
    const source = { title: cleanTitle, body: body.trim() || cleanTitle }
    if (useMemory) {
      /* أول بناءٍ للمادة يستشير الذاكرة: إن سبق تناول المفهوم، يعطي نسخةً مختلفة. */
      const aware = planReelWithMemory(source)
      memoryKeyRef.current = aware.key
      setVariant(aware.plan.variant)
      setPlan(aware.plan)
      setNotice('')
      setMemoryNote(aware.timesSeenBefore > 0
        ? `تناولتَ هذا المفهوم من قبل ${aware.timesSeenBefore === 1 ? 'مرةً واحدة' : `${aware.timesSeenBefore} مرات`} — نوّعتُ لك القالب والعالم والاستعارة.`
        : 'أول مرة تتناول هذا المفهوم — سأتذكّره وأنوّع في المرات القادمة.')
      return aware.plan
    }
    const next = planReel(source, nextVariant)
    setPlan(next)
    setNotice('')
    return next
  }

  /* الخطة تُمرَّر صراحةً لا تُقرأ من الحالة: حالة React لا تكون قد تحدّثت بعد
     في النقرة نفسها، فقراءتها هنا كانت تعيد تشغيل خطة المادة السابقة —
     فتبدو كل الريلات متشابهة وإن اختلف نصها. */
  const preview = async (planToPlay?: ReelPlan) => {
    const active = planToPlay || plan || buildPlan()
    if (!active || !canvasRef.current) return
    handleRef.current?.stop()
    setBusy('preview')
    handleRef.current = await playReelPreview(canvasRef.current, active, { audio: true, onDone: () => setBusy('idle') })
  }

  const stopPreview = () => { handleRef.current?.stop(); setBusy('idle') }

  const anotherTake = () => {
    const nextVariant = variant + 1
    setVariant(nextVariant)
    const next = buildPlan(nextVariant)
    if (next) void preview(next)
  }

  const exportVideo = async (planToRecord?: ReelPlan) => {
    const active = planToRecord || plan || buildPlan()
    if (!active) return
    const gate = auditReelPlan(active)
    if (!gate.ready) { setNotice(`أوقفت بوابة الجودة التصدير: ${gate.warnings.join(' · ')}`); return }
    handleRef.current?.stop()
    setBusy('export')
    setProgress(0)
    setNotice('')
    try {
      const result = await exportReelVideo(active, { canvas: canvasRef.current || undefined, onProgress: setProgress })
      downloadReelBlob(result, active.title)
      if (memoryKeyRef.current) commitReelMemory(memoryKeyRef.current, active)
      setNotice(`نزل الفيديو (${result.mime.includes('mp4') ? 'MP4' : 'WebM'} · ${Math.round(result.blob.size / 1024 / 102.4) / 10} MB · ${arabicCountPhrase(active.seconds, SECOND_FORMS)}) — جاهز للنشر.`)
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'تعذّر التصدير — جرّب متصفح Chrome.')
    } finally {
      setBusy('idle')
      setProgress(0)
    }
  }

  return (
    <section className={card} data-panel="reel-studio">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-2xl">
          <p className="text-[.66rem] font-black uppercase tracking-[.18em] text-accent">Cinematic Reel · محلي ومجاني</p>
          <h3 className="mt-2 font-display text-2xl font-bold text-ink md:text-3xl">استوديو الريل السينمائي</h3>
          <p className="mt-2 text-[.82rem] leading-relaxed text-soft">
            ألصق المقال — يقرؤه المخطِّط، يختار قالباً وعالماً لونياً ومزاجاً موسيقياً من النص نفسه،
            ثم يصدّر فيديو 1080×1920 بصوت مؤلَّف في متصفحك. المادة نفسها تعطي الريل نفسه دائماً،
            ومادتان لا تتشابهان، و«لقطة أخرى» تفتح تنويعاً شقيقاً.
          </p>
        </div>
        {!supported && <span className="rounded-xl border border-amber-200 bg-amber-50/60 px-3 py-2 text-[.68rem] text-amber-800">هذا المتصفح لا يدعم تسجيل الفيديو — المعاينة تعمل، والتصدير يحتاج Chrome.</span>}
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_300px]">
        <div className="grid gap-3">
          <label className="grid gap-2 text-[.76rem] font-semibold text-ink">
            عنوان المادة
            <input className={input} value={title} onChange={(event) => setTitle(event.target.value)} placeholder="مثال: ذكاءٌ بلا ضمير" />
          </label>
          <label className="grid gap-2 text-[.76rem] font-semibold text-ink">
            متن المقال أو مقاطعه الأقوى
            <textarea className={`${input} min-h-44 resize-y leading-loose`} value={body} onChange={(event) => setBody(event.target.value)} placeholder="ألصق المقال كاملاً أو فقراته الجوهرية — المخطِّط ينقّب فيه عن السؤال والمقابلة والاقتباس والرقم." />
          </label>

          <div className="flex flex-wrap items-center gap-2">
            <button type="button" className={primary} disabled={busy === 'export'} onClick={() => { const next = buildPlan(0, true); if (next) void preview(next) }}>جهّز الريل وشغّل المعاينة</button>
            <button type="button" className={ghost} disabled={!plan || busy === 'export'} onClick={anotherTake}>لقطة أخرى</button>
            {busy === 'preview'
              ? <button type="button" className={ghost} onClick={stopPreview}>إيقاف المعاينة</button>
              : <button type="button" className={ghost} disabled={!plan || busy === 'export'} onClick={() => void preview()}>إعادة المعاينة</button>}
            <button type="button" className={primary} disabled={!supported || busy === 'export' || Boolean(quality && !quality.ready)} onClick={() => void exportVideo()}>
              {busy === 'export' ? `يسجّل… ${Math.round(progress * 100)}%` : 'صدّر الفيديو'}
            </button>
          </div>
          {busy === 'export' && (
            <div className="h-2 overflow-hidden rounded-full border border-hair bg-canvas">
              <div className="h-full rounded-full bg-accent transition-[width]" style={{ width: `${Math.round(progress * 100)}%` }} />
            </div>
          )}
          {memoryNote && <p className="rounded-xl border border-accent/25 bg-accent/[.06] px-3 py-2 text-[.72rem] leading-relaxed text-accent">{memoryNote}</p>}
          {notice && <p className="rounded-xl border border-hair bg-canvas px-3 py-2 text-[.72rem] leading-relaxed text-ink" role="status">{notice}</p>}

          {plan && (
            <div className="grid gap-2 rounded-2xl border border-hair bg-canvas p-4">
              <div className="flex flex-wrap gap-2 text-[.68rem] font-bold">
                <span className="rounded-full bg-accent/10 px-3 py-1 text-accent">القالب: {TEMPLATE_LABELS[plan.templateId]}</span>
                <span className="rounded-full bg-ink/[.06] px-3 py-1 text-ink">العالم: {plan.world.label}</span>
                <span className="rounded-full bg-ink/[.06] px-3 py-1 text-ink">الموسيقى: {MOOD_LABELS[plan.mood]}</span>
                <span className="rounded-full bg-ink/[.06] px-3 py-1 text-ink">فعل الكلمة: {plan.motionVerb}</span>
                <span className="rounded-full bg-ink/[.06] px-3 py-1 text-ink">{arabicCountPhrase(plan.scenes.length, REEL_SCENE_FORMS)} · {arabicCountPhrase(plan.seconds, SECOND_FORMS)}</span>
                {quality && <span className={`rounded-full px-3 py-1 ${quality.ready ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-800'}`}>بوابة الريل {quality.score}٪</span>}
                {plan.concept && <span className="rounded-full bg-accent/10 px-3 py-1 text-accent">المعجم: {plan.concept}</span>}
                {plan.metaphors.length > 0 && <span className="rounded-full bg-ink/[.06] px-3 py-1 text-ink">استعارة: {plan.metaphors.join(' · ')}</span>}
              </div>
              <ol className="grid gap-1.5">
                {plan.scenes.map((scene, index) => (
                  <li key={`${scene.slug}-${index}`} className="flex items-baseline gap-3 text-[.74rem] leading-relaxed">
                    <span className="min-w-[86px] font-mono text-[.62rem] font-bold text-soft" dir="ltr">{scene.slug}</span>
                    <span className="text-ink">{scene.eyebrow ? `${scene.eyebrow} — ` : ''}<strong>{scene.line}</strong>{scene.line2 ? ` / ${scene.line2}` : ''}</span>
                  </li>
                ))}
              </ol>
              {quality?.warnings.length ? <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[.66rem] leading-relaxed text-amber-800">{quality.warnings.join(' · ')}</p> : <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-[.66rem] leading-relaxed text-emerald-800">✓ لا بتر، لا تكرار، ولا خروج للنص من الإطار.</p>}
              <details className="text-[.7rem] text-soft">
                <summary className="cursor-pointer font-semibold text-ink">لماذا اختار المخطِّط هذا الشكل؟</summary>
                <ul className="mt-2 grid list-disc gap-1 pr-5">
                  {plan.rationale.map((reason, index) => <li key={index}>{reason}</li>)}
                </ul>
              </details>
            </div>
          )}
        </div>

        <div className="grid content-start justify-items-center gap-2">
          <div className="overflow-hidden rounded-[1.4rem] border border-hair bg-ink shadow-lg" style={{ width: 252, height: 448 }}>
            <canvas ref={canvasRef} style={{ width: '100%', height: '100%', display: 'block' }} aria-label="معاينة الريل" />
          </div>
          <p className="text-center text-[.64rem] text-soft">معاينة حيّة بالمقاس الحقيقي 1080×1920 — التسجيل يجري على هذه اللوحة نفسها.</p>
        </div>
      </div>
    </section>
  )
}

export default ReelStudio
