/**
 * الأساس التقني المشترك لكل ما يسجّل Canvas إلى ملف فيديو في الموقع:
 * reel-motion.ts (الريل) وdesign-motion.ts (فيديو المنشور) وdesign-video.ts (تصميم متحرك).
 *
 * يوحّد أربعة أشياء كانت مكرّرة بصيغ متباعدة:
 *   1) دعم المتصفح واختيار الصيغة،
 *   2) حلقة الإطارات — حلقة واحدة منضبطة لا حلقتان متسابقتان،
 *   3) بدء MediaRecorder وجمع الملف مع نقل أخطائه إلى المُصدِّر،
 *   4) تنظيف الموارد والتحقق من الملف الناتج (المدة والمقاس والعيّنات).
 *
 * الاختلاف الإبداعي (ما يُرسم وكيف يُؤلَّف الصوت) يبقى في كل وحدة؛ هنا السباكة فقط.
 * الملف لا يستورد شيئاً عمداً: يُختبر تحت node مباشرة، ويُحقن فيه «المضيف» (الساعة
 * والمؤقّتات) في الاختبار فتُحاكى الأجهزة البطيئة والتبويبات الخلفية بدقة.
 */

/* ------------------------------ دعم المتصفح واختيار الصيغة ------------------------------ */

export type RecorderPreference = 'mp4-first' | 'webm-first'

const MIME_LISTS: Record<RecorderPreference, string[]> = {
  'mp4-first': [
    'video/mp4;codecs=avc1.640028,mp4a.40.2',
    'video/mp4',
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8,opus',
    'video/webm',
  ],
  'webm-first': [
    'video/webm;codecs=vp9',
    'video/webm;codecs=vp8',
    'video/webm',
    'video/mp4;codecs=avc1.42E01E,mp4a.40.2',
    'video/mp4;codecs=h264,aac',
    'video/mp4',
  ],
}

export interface RecorderLike { isTypeSupported(type: string): boolean }

/** أول صيغة يدعمها المتصفح بترتيب الأفضلية، أو '' إن لم توجد. لا يرمي أبداً. */
export function pickRecorderMime(preference: RecorderPreference, recorder: RecorderLike | undefined = (globalThis as { MediaRecorder?: RecorderLike }).MediaRecorder): string {
  if (!recorder || typeof recorder.isTypeSupported !== 'function') return ''
  for (const type of MIME_LISTS[preference]) {
    try { if (recorder.isTypeSupported(type)) return type } catch { /* جرّب التالي */ }
  }
  return ''
}

export interface CaptureSupport { supported: boolean; mime: string; reasons: string[] }

export interface CaptureSupportEnv {
  MediaRecorder?: RecorderLike
  canvasCaptureStream?: boolean
  AudioContext?: unknown
}

/** فحص واحد لدعم تسجيل Canvas؛ يعيد أسباب العجز بالعربية كي تظهر للمستخدم لا أن تُبتلع. */
export function detectCaptureSupport(options: { preference: RecorderPreference; needsAudio?: boolean; env?: CaptureSupportEnv }): CaptureSupport {
  const g = globalThis as { MediaRecorder?: RecorderLike; HTMLCanvasElement?: { prototype: { captureStream?: unknown } }; AudioContext?: unknown }
  const env: CaptureSupportEnv = options.env || {
    MediaRecorder: g.MediaRecorder,
    canvasCaptureStream: typeof g.HTMLCanvasElement !== 'undefined' && typeof g.HTMLCanvasElement.prototype.captureStream === 'function',
    AudioContext: g.AudioContext,
  }
  const reasons: string[] = []
  if (!env.MediaRecorder) reasons.push('المتصفح لا يوفّر MediaRecorder.')
  if (!env.canvasCaptureStream) reasons.push('المتصفح لا يدعم canvas.captureStream.')
  if (options.needsAudio && !env.AudioContext) reasons.push('المتصفح لا يدعم AudioContext لتأليف الصوت.')
  const mime = reasons.length ? '' : pickRecorderMime(options.preference, env.MediaRecorder)
  if (!reasons.length && !mime) reasons.push('لا توجد صيغة فيديو مدعومة للتسجيل في هذا المتصفح.')
  return { supported: reasons.length === 0, mime, reasons }
}

/* ------------------------------------ حلقة الإطارات ------------------------------------ */

export interface FrameHost {
  now(): number
  requestFrame(callback: () => void): number
  cancelFrame(id: number): void
  setTimer(callback: () => void, ms: number): number
  clearTimer(id: number): void
}

export function browserFrameHost(): FrameHost {
  return {
    now: () => performance.now(),
    requestFrame: (callback) => requestAnimationFrame(callback),
    cancelFrame: (id) => cancelAnimationFrame(id),
    setTimer: (callback, ms) => window.setTimeout(callback, ms),
    clearTimer: (id) => window.clearTimeout(id),
  }
}

export interface FrameInfo {
  /** ثوانٍ منذ بدء الحلقة (زمن حائط، لا عدّاد إطارات: الجهاز البطيء يُسقط إطارات ولا يُطيل الفيديو). */
  t: number
  /** ثوانٍ منذ الإطار الذي قبله، مسقوفة كي لا تقفز الفيزياء بعد خنق التبويب. */
  dt: number
  /** رقم الإطار المرسوم فعلاً، يبدأ من 1. */
  frame: number
}

export interface FrameLoopStats {
  /** كم مرة استُدعي رسم فعلاً. */
  frames: number
  /** كم مرة جاء الاستدعاء من rAF، وكم من المؤقّت الاحتياطي. */
  rafTicks: number
  timerTicks: number
  /** أقصى عدد طلبات rAF معلّقة في لحظة واحدة — يجب أن يبقى ≤ 1 دائماً. */
  maxPendingRaf: number
  maxPendingTimers: number
}

export interface FrameLoopOptions {
  /** معدّل الرسم المستهدف؛ الاستدعاءات الأسرع منه تُتخطّى بلا رسم. */
  fps: number
  /** يرسم الإطار؛ تُرجِع false لإنهاء الحلقة. استثناء هنا يُوقف الحلقة ويُرفض به الوعد. */
  onFrame(info: FrameInfo): boolean | void
  /** سقف dt بالثواني (الافتراضي 0.05). */
  maxDt?: number
  host?: FrameHost
  /**
   * مهلة المؤقّت الاحتياطي بالمللي ثانية. rAF هو الأصل؛ المؤقّت يوقظ الحلقة فقط حين لا يصل rAF
   * (تبويب خلفي). الافتراضي ضعف زمن الإطار، لا أقل من 50ms.
   */
  watchdogMs?: number
}

export interface FrameLoop {
  /** يشغّل الحلقة ويعيد وعداً يُحَلّ حين تنتهي (onFrame أعاد false أو stop()). */
  run(): Promise<FrameLoopStats>
  stop(): void
  readonly stats: FrameLoopStats
}

/**
 * حلقة رسم واحدة. كل دورة تسلّح طلب rAF واحداً ومؤقّتاً احتياطياً واحداً، وأيّهما سبق
 * يلغي الآخر قبل أن يُسلّح الدورة التالية. لذلك لا يتراكم أكثر من طلب معلّق لكل نوع مهما
 * طال الخنق، ولا تتعدّد السلاسل كما كانت تفعل صيغة «rAF + setInterval يستدعيان الدالة نفسها
 * وكلٌّ منهما يطلب rAF جديداً».
 */
export function createFrameLoop(options: FrameLoopOptions): FrameLoop {
  const host = options.host || browserFrameHost()
  const frameMs = 1000 / Math.max(1, options.fps)
  const watchdogMs = options.watchdogMs ?? Math.max(50, Math.round(frameMs * 2))
  const maxDt = options.maxDt ?? 0.05
  const stats: FrameLoopStats = { frames: 0, rafTicks: 0, timerTicks: 0, maxPendingRaf: 0, maxPendingTimers: 0 }
  let rafId: number | null = null
  let timerId: number | null = null
  let startedAt = 0
  let lastDrawAt = 0
  let running = false
  let settle: { resolve: (s: FrameLoopStats) => void; reject: (e: unknown) => void } | null = null

  const pending = () => {
    stats.maxPendingRaf = Math.max(stats.maxPendingRaf, rafId === null ? 0 : 1)
    stats.maxPendingTimers = Math.max(stats.maxPendingTimers, timerId === null ? 0 : 1)
  }
  const disarm = () => {
    if (rafId !== null) { host.cancelFrame(rafId); rafId = null }
    if (timerId !== null) { host.clearTimer(timerId); timerId = null }
  }
  const finish = (error?: unknown) => {
    if (!running) return
    running = false
    disarm()
    const s = settle; settle = null
    if (!s) return
    if (error !== undefined) s.reject(error); else s.resolve(stats)
  }
  const arm = () => {
    disarm()
    rafId = host.requestFrame(() => { rafId = null; tick('raf') })
    timerId = host.setTimer(() => { timerId = null; tick('timer') }, watchdogMs)
    pending()
  }
  const tick = (source: 'raf' | 'timer') => {
    if (!running) return
    disarm() // أيّهما وصل أولاً يُلغي الآخر: دورة واحدة لا اثنتان
    if (source === 'raf') stats.rafTicks += 1; else stats.timerTicks += 1
    const now = host.now()
    const sinceDraw = now - lastDrawAt
    /* rAF على شاشة 60Hz يصل كل 16ms والهدف 30fps: نتخطّى الرسم الزائد، ولا نتخطّاه أبداً عند
       وصول المؤقّت لأن وصوله يعني أن rAF متأخّر أصلاً. */
    if (source === 'raf' && stats.frames > 0 && sinceDraw < frameMs - 2) { arm(); return }
    const t = (now - startedAt) / 1000
    const dt = stats.frames === 0 ? 0 : Math.min(maxDt, sinceDraw / 1000)
    lastDrawAt = now
    stats.frames += 1
    let keepGoing: boolean | void
    try { keepGoing = options.onFrame({ t, dt, frame: stats.frames }) } catch (error) { finish(error); return }
    if (keepGoing === false) { finish(); return }
    arm()
  }

  return {
    stats,
    run() {
      if (running) return Promise.reject(new Error('حلقة الإطارات تعمل بالفعل.'))
      running = true
      startedAt = host.now()
      lastDrawAt = startedAt
      return new Promise<FrameLoopStats>((resolve, reject) => {
        settle = { resolve, reject }
        tick('timer') // الإطار الأول فوري: لا ننتظر rAF في تبويب قد لا يصله
      })
    },
    stop() { finish() },
  }
}

/** يرصد إخفاء التبويب أثناء التسجيل: rAF يتوقف هناك والمؤقّتات تُخنق إلى ~1Hz فيخرج فيديو متقطّع. */
export function trackVisibility(doc: { hidden?: boolean; addEventListener?: (t: string, l: () => void) => void; removeEventListener?: (t: string, l: () => void) => void } | undefined = typeof document === 'undefined' ? undefined : document) {
  let hiddenAtStart = Boolean(doc?.hidden)
  let wasHidden = hiddenAtStart
  const listener = () => { if (doc?.hidden) wasHidden = true }
  doc?.addEventListener?.('visibilitychange', listener)
  return {
    get hiddenAtStart() { return hiddenAtStart },
    get wasHidden() { return wasHidden },
    dispose() { doc?.removeEventListener?.('visibilitychange', listener); hiddenAtStart = false },
  }
}

/* ----------------------------------- تنظيف الموارد ----------------------------------- */

export interface Disposable { dispose(): void | Promise<void> }

/**
 * يجمع كل ما فُتح أثناء التصدير ويغلقه مرة واحدة مهما كان المسار (نجاح أو استثناء أو إلغاء).
 * dispose() آمنة للتكرار ولا ترمي: فشل إغلاق مورد لا يمنع إغلاق الباقي.
 */
export function createCaptureSession() {
  const streams: Array<{ getTracks(): Array<{ stop(): void }> }> = []
  const contexts: Array<{ close(): Promise<void> | void }> = []
  const nodes: Array<{ remove(): void }> = []
  const urls: string[] = []
  const extra: Array<() => void | Promise<void>> = []
  let disposed = false
  return {
    stream<T extends { getTracks(): Array<{ stop(): void }> }>(stream: T): T { streams.push(stream); return stream },
    audio<T extends { close(): Promise<void> | void }>(context: T): T { contexts.push(context); return context },
    node<T extends { remove(): void }>(node: T): T { nodes.push(node); return node },
    url(value: string): string { urls.push(value); return value },
    onDispose(fn: () => void | Promise<void>) { extra.push(fn) },
    get disposed() { return disposed },
    async dispose(revoke: (url: string) => void = (u) => URL.revokeObjectURL(u)) {
      if (disposed) return
      disposed = true
      for (const stream of streams) { try { stream.getTracks().forEach((track) => { try { track.stop() } catch { /* مغلق */ } }) } catch { /* مغلق */ } }
      for (const node of nodes) { try { node.remove() } catch { /* أُزيل */ } }
      for (const url of urls) { try { revoke(url) } catch { /* لا يهم */ } }
      for (const fn of extra) { try { await fn() } catch { /* لا يهم */ } }
      for (const context of contexts) { try { await context.close() } catch { /* أُغلق مسبقاً */ } }
    },
  }
}

/* --------------------------------------- المسجِّل --------------------------------------- */

export interface RecorderEvents {
  ondataavailable: ((event: { data: { size: number } }) => void) | null
  onstop: (() => void) | null
  onerror: ((event?: unknown) => void) | null
  state?: string
  start(timeslice?: number): void
  stop(): void
  requestData?(): void
}

export interface RecorderCollector {
  /** خطأ المسجِّل إن وقع؛ يفحصه المُصدِّر داخل حلقة الرسم كي لا يُكمل تسجيلاً ميتاً. */
  failure(): Error | null
  /** يوقف المسجِّل ويعيد الملف، أو يرفض إن أخطأ المسجِّل أو لم يصدر onstop في المهلة. */
  finish(options?: { timeoutMs?: number; setTimer?: (cb: () => void, ms: number) => number; clearTimer?: (id: number) => void }): Promise<Blob>
}

export function collectRecording(recorder: RecorderEvents, mime: string, errorMessage: string): RecorderCollector {
  const chunks: BlobPart[] = []
  let failure: Error | null = null
  let stopped = false
  let onStopped: (() => void) | null = null
  recorder.ondataavailable = (event) => { if (event.data.size) chunks.push(event.data as unknown as BlobPart) }
  recorder.onerror = () => { failure = failure || new Error(errorMessage); onStopped?.() }
  recorder.onstop = () => { stopped = true; onStopped?.() }
  return {
    failure: () => failure,
    finish(options = {}) {
      const setTimer = options.setTimer || ((cb, ms) => globalThis.setTimeout(cb, ms) as unknown as number)
      const clearTimer = options.clearTimer || ((id) => globalThis.clearTimeout(id as unknown as ReturnType<typeof setTimeout>))
      return new Promise<Blob>((resolve, reject) => {
        let timer: number | null = null
        const done = () => {
          if (timer !== null) clearTimer(timer)
          if (failure) reject(failure)
          else resolve(new Blob(chunks, { type: mime.split(';')[0] }))
        }
        if (stopped) { done(); return }
        onStopped = done
        timer = setTimer(() => {
          failure = failure || new Error('انتهت مهلة المسجِّل قبل إغلاق الملف؛ لم يصدر حدث الإيقاف.')
          onStopped = null
          reject(failure)
        }, options.timeoutMs ?? 8000)
        try { if (recorder.state !== 'inactive') recorder.stop(); else done() } catch (error) {
          failure = failure || (error instanceof Error ? error : new Error(String(error)))
          done()
        }
      })
    },
  }
}

/* ------------------------------- التحقق من الملف الناتج ------------------------------- */

export type CheckStatus = 'pass' | 'fail' | 'unverified'
export interface VerificationCheck { id: string; label: string; status: CheckStatus; detail: string }
export interface FileVerification {
  /** verified: كل الفحوص مرّت. failed: فحص حاسم فشل. unverified: لم يفشل شيء لكن شيئاً لم يمكن قياسه. */
  status: 'verified' | 'failed' | 'unverified'
  checks: VerificationCheck[]
  /** نفس status==='verified'؛ الواجهة لا تكتب «جاهز للنشر» إلا بها. */
  readyToPublish: boolean
}

export function summarizeChecks(checks: VerificationCheck[]): FileVerification {
  const status = checks.some((c) => c.status === 'fail') ? 'failed' : checks.some((c) => c.status === 'unverified') ? 'unverified' : 'verified'
  return { status, checks, readyToPublish: status === 'verified' }
}

/** سطر عربي واحد يصف ما تعذّر أو فشل — للواجهة. */
export function describeVerification(verification: FileVerification): string {
  const bad = verification.checks.filter((c) => c.status !== 'pass')
  if (!bad.length) return 'اجتاز كل فحوص الملف.'
  return bad.map((c) => `${c.label}: ${c.detail}`).join(' · ')
}

export interface ProbeMeasurement { duration: number | null; width: number | null; height: number | null }

export interface ExpectedMedia { seconds: number; width?: number; height?: number; toleranceSeconds?: number; tolerancePixels?: number }

export function durationTolerance(expectedSeconds: number, ratio = 0.08, floor = 0.9) {
  return Math.max(floor, expectedSeconds * ratio)
}

/** تقييم قياسات الملف مقابل المتوقع — دالة نقية قابلة للاختبار بلا متصفح. */
export function evaluateProbe(measured: ProbeMeasurement, expected: ExpectedMedia): VerificationCheck[] {
  const checks: VerificationCheck[] = []
  if (measured.duration == null) {
    checks.push({ id: 'duration', label: 'المدة', status: 'unverified', detail: 'تعذّر قراءة مدة الملف من المتصفح.' })
  } else {
    const tolerance = expected.toleranceSeconds ?? durationTolerance(expected.seconds)
    const ok = Math.abs(measured.duration - expected.seconds) <= tolerance
    checks.push({ id: 'duration', label: 'المدة', status: ok ? 'pass' : 'fail', detail: ok ? `${measured.duration.toFixed(2)}ث تطابق المخطط ${expected.seconds.toFixed(2)}ث.` : `مدة الملف ${measured.duration.toFixed(2)}ث لا تطابق المخطط ${expected.seconds.toFixed(2)}ث.` })
  }
  if (expected.width && expected.height) {
    if (!measured.width || !measured.height) {
      checks.push({ id: 'size', label: 'المقاس', status: 'unverified', detail: 'تعذّر قراءة مقاس الملف.' })
    } else {
      const slack = expected.tolerancePixels ?? 2
      const ok = Math.abs(measured.width - expected.width) <= slack && Math.abs(measured.height - expected.height) <= slack
      checks.push({ id: 'size', label: 'المقاس', status: ok ? 'pass' : 'fail', detail: ok ? `${measured.width}×${measured.height}.` : `المقاس ${measured.width}×${measured.height} بدل ${expected.width}×${expected.height}.` })
    }
  }
  return checks
}

/** grid: سطوع كل خلية 6×6px من العيّنة المصغّرة؛ يلتقط الحركة الموضعية (أيقونة صغيرة) التي لا يغيّر متوسطها شيئاً. */
export interface FrameStats { mean: number; variance: number; grid?: number[] }
export interface FrameSampleResult { position: number; label: string; stats: FrameStats | null }

/** إطار شبه أسود/ثابت اللون يعني تسجيلاً فارغاً أو منطقة التقاط خاطئة. */
export function isBlankFrame(stats: FrameStats) { return stats.mean < 5 || stats.variance < 2 }

export function lumaStats(rgba: ArrayLike<number>, step = 16, width = 0): FrameStats {
  let sum = 0; let sum2 = 0; let n = 0
  for (let i = 0; i + 2 < rgba.length; i += step) {
    const y = 0.2126 * rgba[i] + 0.7152 * rgba[i + 1] + 0.0722 * rgba[i + 2]
    sum += y; sum2 += y * y; n += 1
  }
  if (!n) return { mean: 0, variance: 0 }
  const mean = sum / n
  const stats: FrameStats = { mean, variance: sum2 / n - mean * mean }
  if (width > 0) {
    const cell = 6
    const pixels = Math.floor(rgba.length / 4)
    const cols = Math.ceil(width / cell)
    const rows = Math.ceil(pixels / width / cell)
    const totals = new Array<number>(cols * rows).fill(0)
    const counts = new Array<number>(cols * rows).fill(0)
    for (let px = 0; px < pixels; px += 1) {
      const index = Math.floor(px / width / cell) * cols + Math.floor((px % width) / cell)
      totals[index] += 0.2126 * rgba[px * 4] + 0.7152 * rgba[px * 4 + 1] + 0.0722 * rgba[px * 4 + 2]
      counts[index] += 1
    }
    stats.grid = totals.map((total, i) => (counts[i] ? total / counts[i] : 0))
  }
  return stats
}

/** عيّنات البداية والوسط والنهاية: يلزم نجاح الثلاث؛ العيّنة المفقودة «غير متحقَّق» لا نجاح. */
export const DEFAULT_SAMPLE_POINTS: Array<{ position: number; label: string }> = [
  { position: 0.06, label: 'بداية الفيديو' },
  { position: 0.5, label: 'وسط الفيديو' },
  { position: 0.95, label: 'نهاية الفيديو' },
]

export function evaluateSamples(samples: FrameSampleResult[]): VerificationCheck[] {
  return samples.map((sample, index) => {
    if (!sample.stats) return { id: `sample-${index}`, label: sample.label, status: 'unverified' as const, detail: 'تعذّر أخذ عيّنة من الملف.' }
    return isBlankFrame(sample.stats)
      ? { id: `sample-${index}`, label: sample.label, status: 'fail' as const, detail: 'الإطار فارغ أو شبه أسود.' }
      : { id: `sample-${index}`, label: sample.label, status: 'pass' as const, detail: 'محتوى مرئي.' }
  })
}

/**
 * هل بين العيّنات فرق حقيقي؟ نقارن شبكة السطوع خليةً خلية: حركة أيقونة صغيرة فوق خلفية ثابتة
 * تغيّر خلاياها وإن لم يتغيّر متوسط الإطار. فيديو متجمّد (حلقة ماتت أو التقاط ثابت) فروقه
 * ضجيج ترميز أقل من درجة واحدة. بلا شبكة نعود إلى المتوسط والتباين.
 */
export function evaluateMotion(samples: FrameSampleResult[], minCellDelta = 1.0, minMeanDelta = 0.3, minVarianceRatio = 0.02): VerificationCheck {
  const stats = samples.map((s) => s.stats).filter((v): v is FrameStats => Boolean(v))
  if (stats.length < 2) return { id: 'motion', label: 'الحركة', status: 'unverified', detail: 'عيّنات غير كافية لقياس الحركة.' }
  let moving = false
  const grids = stats.map((s) => s.grid).filter((g): g is number[] => Array.isArray(g))
  if (grids.length === stats.length) {
    for (let i = 0; i < grids.length && !moving; i += 1) for (let j = i + 1; j < grids.length && !moving; j += 1) {
      let diff = 0
      for (let k = 0; k < grids[i].length; k += 1) diff += Math.abs(grids[i][k] - grids[j][k])
      if (diff / Math.max(1, grids[i].length) >= minCellDelta) moving = true
    }
  } else {
    const means = stats.map((s) => s.mean)
    const variances = stats.map((s) => s.variance)
    const meanSpread = Math.max(...means) - Math.min(...means)
    const varianceSpread = (Math.max(...variances) - Math.min(...variances)) / Math.max(1, Math.max(...variances))
    moving = meanSpread >= minMeanDelta || varianceSpread >= minVarianceRatio
  }
  return moving
    ? { id: 'motion', label: 'الحركة', status: 'pass', detail: 'الإطارات تتغيّر عبر الفيديو.' }
    : { id: 'motion', label: 'الحركة', status: 'fail', detail: 'إطارات البداية والوسط والنهاية متطابقة تقريباً — يبدو الفيديو متجمّداً.' }
}

export function evaluateFrameCount(frames: number, expectedSeconds: number, fps: number, minRatio = 0.42): VerificationCheck {
  const needed = Math.max(12, Math.floor(expectedSeconds * fps * minRatio))
  return frames >= needed
    ? { id: 'frames', label: 'عدد الإطارات', status: 'pass', detail: `${frames} إطاراً مرسوماً (الحد الأدنى ${needed}).` }
    : { id: 'frames', label: 'عدد الإطارات', status: 'fail', detail: `رُسم ${frames} إطاراً فقط والمطلوب ${needed} على الأقل — الجهاز بطيء أو التبويب خُنق.` }
}

export function evaluateFileSize(bytes: number, minBytes: number): VerificationCheck {
  return bytes >= minBytes
    ? { id: 'size-bytes', label: 'حجم الملف', status: 'pass', detail: `${Math.round(bytes / 1024)}KB.` }
    : { id: 'size-bytes', label: 'حجم الملف', status: 'fail', detail: 'الملف فارغ أو أصغر من أن يحتوي فيديو حقيقياً.' }
}

/* ---------------------------------- قياس الصوت ---------------------------------- */

export interface AudioMeter { input: AudioNode; sample(): void; readonly peak: number }

/**
 * يقيس أعلى قمة صوتية فعلية تمرّ إلى التسجيل. «طُلب الصوت» لا تعني «سُجّل الصوت»:
 * AudioContext معلّق بسياسة التشغيل التلقائي أو مسار مفصول يُنتج ملفاً صامتاً بلا أي خطأ.
 * المصدر الصوتي يُوصَل بـinput بدل الوجهة مباشرة، ويُستدعى sample() في كل إطار.
 */
export function createAudioMeter(context: AudioContext, destination: AudioNode): AudioMeter {
  const input = context.createGain()
  const analyser = context.createAnalyser()
  analyser.fftSize = 1024
  input.connect(destination)
  input.connect(analyser)
  const buffer = new Float32Array(analyser.fftSize)
  let peak = 0
  return {
    input,
    sample() {
      analyser.getFloatTimeDomainData(buffer)
      for (let i = 0; i < buffer.length; i += 1) { const v = Math.abs(buffer[i]); if (v > peak) peak = v }
    },
    get peak() { return peak },
  }
}

export function evaluateAudio(requested: boolean, trackAttached: boolean, peak: number | null): VerificationCheck | null {
  if (!requested) return null
  if (!trackAttached) return { id: 'audio', label: 'الصوت', status: 'fail', detail: 'طُلب الصوت لكن لم يُركَّب مسار صوتي في التسجيل.' }
  if (peak === null) return { id: 'audio', label: 'الصوت', status: 'unverified', detail: 'رُكّب مسار صوتي لكن تعذّر قياس مستواه.' }
  return peak >= 0.002
    ? { id: 'audio', label: 'الصوت', status: 'pass', detail: `مسار صوتي حيّ (قمة ${peak.toFixed(2)}).` }
    : { id: 'audio', label: 'الصوت', status: 'fail', detail: 'المسار الصوتي صامت طوال التسجيل (تحقق من تعليق الصوت في المتصفح).' }
}

/* ---- أدوات المتصفح: قراءة الملف وأخذ العيّنات. لا تُختبر في Node؛ تُختبر دوالها النقية أعلاه. ---- */

export async function probeVideoBlob(blob: Blob, timeoutMs = 2600): Promise<ProbeMeasurement> {
  const url = URL.createObjectURL(blob)
  try {
    const video = document.createElement('video')
    video.preload = 'metadata'
    video.muted = true
    return await new Promise<ProbeMeasurement>((resolve) => {
      let done = false
      let timer = 0
      const finish = (duration: number | null) => {
        if (done) return
        done = true
        window.clearTimeout(timer)
        resolve({ duration, width: video.videoWidth || null, height: video.videoHeight || null })
      }
      const read = () => {
        if (Number.isFinite(video.duration) && video.duration > 0) return finish(video.duration)
        /* ملفات MediaRecorder بلا مدة في الترويسة: القفز إلى نهاية بعيدة يُجبر المتصفح على حسابها. */
        try { video.currentTime = 1e7 } catch { finish(null) }
      }
      video.onloadedmetadata = read
      video.ondurationchange = () => { if (Number.isFinite(video.duration) && video.duration > 0) finish(video.duration) }
      video.onerror = () => finish(null)
      timer = window.setTimeout(() => finish(null), timeoutMs)
      video.src = url
    })
  } finally { URL.revokeObjectURL(url) }
}

export async function sampleVideoFrames(blob: Blob, durationSeconds: number, points = DEFAULT_SAMPLE_POINTS, seekTimeoutMs = 1500): Promise<FrameSampleResult[]> {
  const url = URL.createObjectURL(blob)
  const results: FrameSampleResult[] = []
  try {
    const video = document.createElement('video')
    video.muted = true
    video.playsInline = true
    video.preload = 'auto'
    await new Promise<void>((resolve, reject) => {
      const timer = window.setTimeout(() => reject(new Error('timeout')), 3000)
      video.onloadeddata = () => { window.clearTimeout(timer); resolve() }
      video.onerror = () => { window.clearTimeout(timer); reject(new Error('error')) }
      video.src = url
    })
    /* ملفات MediaRecorder تأتي بلا مدة في الترويسة (Infinity) ولا يمكن القفز فيها قبل أن تُحسب المدة. */
    if (!Number.isFinite(video.duration)) {
      await new Promise<void>((resolve) => {
        const timer = window.setTimeout(resolve, 2000)
        const done = () => { if (Number.isFinite(video.duration)) { window.clearTimeout(timer); resolve() } }
        video.ondurationchange = done
        video.onseeked = done
        try { video.currentTime = 1e7 } catch { window.clearTimeout(timer); resolve() }
      })
    }
    const canvas = document.createElement('canvas')
    canvas.width = 54; canvas.height = 96
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    for (const point of points) {
      if (!ctx) { results.push({ ...point, stats: null }); continue }
      try {
        const target = Math.max(0.05, Math.min(durationSeconds - 0.08, durationSeconds * point.position))
        await new Promise<void>((resolve) => {
          const timer = window.setTimeout(resolve, seekTimeoutMs)
          video.onseeked = () => { window.clearTimeout(timer); resolve() }
          video.currentTime = target
        })
        /* القفز لم يصل إلى الموضع المطلوب: عيّنة «غير متحقَّق منها» أصدق من إطارٍ خاطئ يُحتسب نجاحاً أو فشلاً. */
        if (Math.abs(video.currentTime - target) > 0.6) { results.push({ ...point, stats: null }); continue }
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
        results.push({ ...point, stats: lumaStats(ctx.getImageData(0, 0, canvas.width, canvas.height).data, 16, canvas.width) })
      } catch { results.push({ ...point, stats: null }) }
    }
  } catch {
    for (const point of points) results.push({ ...point, stats: null })
  } finally { URL.revokeObjectURL(url) }
  return results
}

/** تحقق كامل لملف مُسجَّل من Canvas: الحجم والإطارات والمدة والمقاس وعيّنات البداية/الوسط/النهاية. */
export async function verifyRecordedVideo(input: {
  blob: Blob
  expected: ExpectedMedia
  frames: number
  fps: number
  minBytes: number
  sampleFrames?: boolean
  extraChecks?: Array<VerificationCheck | null>
}): Promise<{ verification: FileVerification; measured: ProbeMeasurement }> {
  const checks: VerificationCheck[] = [evaluateFileSize(input.blob.size, input.minBytes), evaluateFrameCount(input.frames, input.expected.seconds, input.fps)]
  for (const extra of input.extraChecks || []) if (extra) checks.push(extra)
  const measured = await probeVideoBlob(input.blob)
  checks.push(...evaluateProbe(measured, input.expected))
  if (input.sampleFrames !== false) {
    const duration = measured.duration ?? input.expected.seconds
    const samples = await sampleVideoFrames(input.blob, duration)
    checks.push(...evaluateSamples(samples), evaluateMotion(samples))
  }
  return { verification: summarizeChecks(checks), measured }
}

/** أول فحص فاشل بين «الفحوص الحاسمة» كرسالة خطأ قابلة للرمي؛ غيرها يمنع «جاهز للنشر» دون أن يمنع التنزيل. */
export const HARD_CHECK_IDS = ['size-bytes', 'frames', 'duration', 'size']
export function firstFailure(verification: FileVerification, hardIds: string[] = HARD_CHECK_IDS): string | null {
  const failed = verification.checks.find((c) => c.status === 'fail' && hardIds.includes(c.id))
  return failed ? `فشل التصدير — ${failed.label}: ${failed.detail}` : null
}
