import { useCallback, useEffect, useRef, useState } from 'react'

/*
 * مختبر الصور — تحريرٌ احترافيٌّ كاملٌ داخل المتصفح، بلا API ولا تكلفة ولا رفعٍ
 * لأي خادم (الصورة لا تغادر جهاز الدكتور). كل المعالجة على Canvas: تعريض وتباين
 * وتشبّع وحرارة لونية ووضوح وحبيبات سينمائية وتظليل حواف وأحاديّ ودوتون، مع
 * مرشّحاتٍ جاهزة بلمسة، ومقارنة قبل/بعد، وتنزيلٍ فوري. حلمُ الصديق (مختبر الصور)
 * في مساره المجاني — الجزء الذي لا يحتاج ذكاءً مولّداً مدفوعاً.
 */

type Adjust = {
  brightness: number
  contrast: number
  saturate: number
  temperature: number
  vibrance: number
  grayscale: number
  sepia: number
  blur: number
  sharpen: number
  vignette: number
  grain: number
  duotone: number
}

const NEUTRAL: Adjust = {
  brightness: 100, contrast: 100, saturate: 100, temperature: 0, vibrance: 0,
  grayscale: 0, sepia: 0, blur: 0, sharpen: 0, vignette: 0, grain: 0, duotone: 0,
}

const PRESETS: { id: string; label: string; adjust: Partial<Adjust> }[] = [
  { id: 'original', label: 'الأصل', adjust: {} },
  { id: 'cinematic', label: 'سينمائي', adjust: { contrast: 118, saturate: 92, temperature: -12, vignette: 42, grain: 14, brightness: 98 } },
  { id: 'warm', label: 'دافئ', adjust: { temperature: 30, saturate: 112, brightness: 104, contrast: 104 } },
  { id: 'cool', label: 'بارد', adjust: { temperature: -28, saturate: 104, brightness: 101, contrast: 106 } },
  { id: 'editorial', label: 'تحريري', adjust: { contrast: 110, saturate: 96, brightness: 102, vignette: 20 } },
  { id: 'vivid', label: 'زاهٍ', adjust: { saturate: 150, contrast: 112, vibrance: 30, brightness: 102 } },
  { id: 'faded', label: 'باهت راقٍ', adjust: { contrast: 88, saturate: 82, brightness: 106, grain: 10 } },
  { id: 'mono', label: 'أحادي', adjust: { grayscale: 100, contrast: 116, vignette: 26, grain: 12 } },
  { id: 'sepia', label: 'سيبيا', adjust: { sepia: 78, contrast: 104, temperature: 14, vignette: 22 } },
  { id: 'noir', label: 'نوار', adjust: { grayscale: 100, contrast: 138, brightness: 94, vignette: 52, grain: 18 } },
]

const SLIDERS: { key: keyof Adjust; label: string; min: number; max: number; center: number }[] = [
  { key: 'brightness', label: 'الإضاءة', min: 40, max: 160, center: 100 },
  { key: 'contrast', label: 'التباين', min: 40, max: 180, center: 100 },
  { key: 'saturate', label: 'التشبّع', min: 0, max: 200, center: 100 },
  { key: 'vibrance', label: 'الحيوية', min: 0, max: 100, center: 0 },
  { key: 'temperature', label: 'الحرارة اللونية', min: -60, max: 60, center: 0 },
  { key: 'sharpen', label: 'الوضوح', min: 0, max: 100, center: 0 },
  { key: 'blur', label: 'النعومة', min: 0, max: 12, center: 0 },
  { key: 'vignette', label: 'تظليل الحواف', min: 0, max: 90, center: 0 },
  { key: 'grain', label: 'حبيبات سينمائية', min: 0, max: 40, center: 0 },
  { key: 'grayscale', label: 'أحادي', min: 0, max: 100, center: 0 },
  { key: 'sepia', label: 'سيبيا', min: 0, max: 100, center: 0 },
  { key: 'duotone', label: 'دوتون', min: 0, max: 100, center: 0 },
]

let grainTile: HTMLCanvasElement | null = null
function noiseTile() {
  if (grainTile) return grainTile
  const size = 140
  const c = document.createElement('canvas')
  c.width = size; c.height = size
  const g = c.getContext('2d')!
  const img = g.createImageData(size, size)
  for (let i = 0; i < img.data.length; i += 4) {
    const v = 120 + Math.random() * 135
    img.data[i] = img.data[i + 1] = img.data[i + 2] = v
    img.data[i + 3] = 255
  }
  g.putImageData(img, 0, 0)
  grainTile = c
  return c
}

export function ImageLab() {
  const [image, setImage] = useState<HTMLImageElement | null>(null)
  const [fileName, setFileName] = useState('صورة')
  const [adjust, setAdjust] = useState<Adjust>(NEUTRAL)
  const [preset, setPreset] = useState('original')
  const [compare, setCompare] = useState(false)
  const [dragging, setDragging] = useState(false)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  const loadFile = useCallback((file: File) => {
    if (!file || !file.type.startsWith('image/')) return
    setFileName(file.name.replace(/\.[^.]+$/, '') || 'صورة')
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => { setImage(img); URL.revokeObjectURL(url) }
    img.src = url
  }, [])

  useEffect(() => {
    const onPaste = (event: ClipboardEvent) => {
      const item = [...(event.clipboardData?.items || [])].find((entry) => entry.type.startsWith('image/'))
      const file = item?.getAsFile()
      if (file) loadFile(file)
    }
    window.addEventListener('paste', onPaste)
    return () => window.removeEventListener('paste', onPaste)
  }, [loadFile])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !image) return
    const maxW = 1400
    const scale = Math.min(1, maxW / image.naturalWidth)
    const w = Math.round(image.naturalWidth * scale)
    const h = Math.round(image.naturalHeight * scale)
    canvas.width = w; canvas.height = h
    const ctx = canvas.getContext('2d')!
    const a = compare ? NEUTRAL : adjust

    ctx.clearRect(0, 0, w, h)
    const filterParts = [
      `brightness(${a.brightness}%)`,
      `contrast(${a.contrast}%)`,
      `saturate(${a.saturate + a.vibrance * 0.6}%)`,
      a.grayscale ? `grayscale(${a.grayscale}%)` : '',
      a.sepia ? `sepia(${a.sepia}%)` : '',
      a.blur ? `blur(${a.blur * scale}px)` : '',
    ].filter(Boolean).join(' ')
    ctx.filter = filterParts
    ctx.drawImage(image, 0, 0, w, h)
    ctx.filter = 'none'

    // الحرارة اللونية: طبقةٌ دافئة/باردة بمزجٍ ناعم
    if (a.temperature) {
      ctx.globalCompositeOperation = 'soft-light'
      ctx.fillStyle = a.temperature > 0
        ? `rgba(255, 168, 76, ${Math.min(0.6, a.temperature / 100)})`
        : `rgba(76, 148, 255, ${Math.min(0.6, -a.temperature / 100)})`
      ctx.fillRect(0, 0, w, h)
      ctx.globalCompositeOperation = 'source-over'
    }

    // دوتون: حبرٌ + ورق بمزج
    if (a.duotone) {
      ctx.globalCompositeOperation = 'color'
      ctx.fillStyle = `rgba(62, 92, 120, ${a.duotone / 130})`
      ctx.fillRect(0, 0, w, h)
      ctx.globalCompositeOperation = 'source-over'
    }

    // الوضوح: نسخةٌ محدّبة بمزج overlay (شحذٌ بسيطٌ بلا تعقيد الالتفاف)
    if (a.sharpen) {
      ctx.globalCompositeOperation = 'overlay'
      ctx.globalAlpha = a.sharpen / 260
      ctx.filter = 'contrast(160%) brightness(102%)'
      ctx.drawImage(canvas, 0, 0, w, h)
      ctx.filter = 'none'
      ctx.globalAlpha = 1
      ctx.globalCompositeOperation = 'source-over'
    }

    // حبيباتٌ سينمائية
    if (a.grain) {
      const tile = noiseTile()
      const pattern = ctx.createPattern(tile, 'repeat')!
      ctx.globalCompositeOperation = 'overlay'
      ctx.globalAlpha = a.grain / 100
      ctx.fillStyle = pattern
      ctx.fillRect(0, 0, w, h)
      ctx.globalAlpha = 1
      ctx.globalCompositeOperation = 'source-over'
    }

    // تظليل الحواف
    if (a.vignette) {
      const grd = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.32, w / 2, h / 2, Math.max(w, h) * 0.72)
      grd.addColorStop(0, 'rgba(0,0,0,0)')
      grd.addColorStop(1, `rgba(0,0,0,${a.vignette / 100})`)
      ctx.fillStyle = grd
      ctx.fillRect(0, 0, w, h)
    }
  }, [image, adjust, compare])

  const applyPreset = (id: string) => {
    setPreset(id)
    const found = PRESETS.find((entry) => entry.id === id)
    setAdjust({ ...NEUTRAL, ...(found?.adjust || {}) })
  }
  const setOne = (key: keyof Adjust, value: number) => { setPreset('custom'); setAdjust((prev) => ({ ...prev, [key]: value })) }

  const download = (type: 'image/png' | 'image/jpeg') => {
    const canvas = canvasRef.current
    if (!canvas) return
    canvas.toBlob((blob) => {
      if (!blob) return
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${fileName}-محرّرة.${type === 'image/png' ? 'png' : 'jpg'}`
      a.click()
      URL.revokeObjectURL(url)
    }, type, 0.94)
  }

  const card = 'rounded-2xl border border-hair bg-canvas p-4'
  const ghost = 'rounded-full border border-hair bg-canvas px-3 py-1.5 text-[.72rem] font-semibold text-soft transition hover:border-accent hover:text-accent'
  const primary = 'rounded-full bg-accent px-4 py-2 text-[.76rem] font-semibold text-white transition hover:bg-accent-deep'

  return (
    <section className="grid gap-5" aria-labelledby="image-lab-title">
      <header className={`${card} bg-wash`}>
        <p className="text-[.7rem] font-bold uppercase tracking-[.16em] text-accent">IMAGE LAB · بلا تكلفة</p>
        <h2 id="image-lab-title" className="mt-1 font-display text-3xl font-bold text-ink">مختبر الصور</h2>
        <p className="mt-2 max-w-2xl text-[.85rem] font-light leading-relaxed text-soft">حرّر صورك احترافياً داخل المتصفح — لا رفع لأي خادم، ولا اشتراك. الصورة لا تغادر جهازك.</p>
      </header>

      <div className="grid gap-5 lg:grid-cols-[minmax(320px,.85fr)_minmax(0,1.15fr)]">
        <div className="grid content-start gap-4">
          {/* منطقة الرفع */}
          <label
            onDragOver={(event) => { event.preventDefault(); setDragging(true) }}
            onDragLeave={() => setDragging(false)}
            onDrop={(event) => { event.preventDefault(); setDragging(false); const file = event.dataTransfer.files?.[0]; if (file) loadFile(file) }}
            className={`grid cursor-pointer place-items-center rounded-2xl border-2 border-dashed p-6 text-center transition ${dragging ? 'border-accent bg-accent/[.06]' : 'border-hair bg-canvas hover:border-accent/50'}`}
          >
            <input type="file" accept="image/*" className="hidden" onChange={(event) => { const file = event.target.files?.[0]; if (file) loadFile(file) }} />
            <span className="text-[.8rem] font-semibold text-ink">اسحب صورة هنا · أو الصقها · أو انقر للاختيار</span>
            <span className="mt-1 text-[.68rem] text-soft">PNG · JPG · WEBP — تبقى على جهازك</span>
          </label>

          {/* المرشّحات الجاهزة */}
          <section className={card}>
            <p className="text-[.7rem] font-bold text-accent">مرشّحات بلمسة</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {PRESETS.map((entry) => (
                <button key={entry.id} type="button" onClick={() => applyPreset(entry.id)} className={`rounded-full px-3 py-1.5 text-[.72rem] font-semibold transition ${preset === entry.id ? 'bg-accent text-white' : 'border border-hair bg-canvas text-soft hover:border-accent hover:text-accent'}`}>{entry.label}</button>
              ))}
            </div>
          </section>

          {/* الضبط الدقيق */}
          <section className={card}>
            <div className="flex items-center justify-between">
              <p className="text-[.7rem] font-bold text-accent">ضبطٌ دقيق</p>
              <button type="button" onClick={() => { setAdjust(NEUTRAL); setPreset('original') }} className={ghost}>تصفير</button>
            </div>
            <div className="mt-3 grid gap-3">
              {SLIDERS.map((slider) => (
                <label key={slider.key} className="grid gap-1">
                  <span className="flex items-center justify-between text-[.68rem] text-soft"><span>{slider.label}</span><span className="font-mono text-ink">{Math.round(adjust[slider.key])}</span></span>
                  <input type="range" min={slider.min} max={slider.max} value={adjust[slider.key]} onChange={(event) => setOne(slider.key, Number(event.target.value))} className="accent-[#3E5C78]" />
                </label>
              ))}
            </div>
          </section>
        </div>

        {/* المعاينة */}
        <div className="grid content-start gap-3">
          <div className="relative grid min-h-[280px] place-items-center overflow-hidden rounded-2xl border border-hair bg-[#101216] p-3">
            {image
              ? <canvas ref={canvasRef} className="max-h-[70vh] w-auto max-w-full rounded-lg shadow-lg" />
              : <p className="text-[.85rem] text-white/40">ستظهر صورتك هنا بعد رفعها</p>}
            {image && (
              <button type="button" onMouseDown={() => setCompare(true)} onMouseUp={() => setCompare(false)} onMouseLeave={() => setCompare(false)} onTouchStart={() => setCompare(true)} onTouchEnd={() => setCompare(false)} className="absolute bottom-4 left-4 rounded-full bg-white/90 px-4 py-2 text-[.72rem] font-semibold text-ink shadow">اضغط للمقارنة بالأصل</button>
            )}
          </div>
          {image && (
            <div className="flex flex-wrap gap-2">
              <button type="button" className={primary} onClick={() => download('image/png')}>تنزيل PNG</button>
              <button type="button" className={ghost} onClick={() => download('image/jpeg')}>تنزيل JPG</button>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
