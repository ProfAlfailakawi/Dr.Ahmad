#!/usr/bin/env node
/**
 * يحرس الأساس المشترك لتسجيل الفيديو (src/lib/video-capture-core.ts):
 *  - حلقة الإطارات واحدة لا حلقتان، في تبويب ظاهر وخلفي وعلى جهاز بطيء؛
 *  - أخطاء المسجِّل تصل إلى المُصدِّر ولا تُبتلع؛
 *  - الموارد تُغلق مرة واحدة مهما فشل بعضها؛
 *  - «جاهز للنشر» لا تصحّ إلا إذا مرّت كل الفحوص، وما تعذّر قياسه «غير متحقَّق» لا «ناجح».
 *
 * ملاحظة أمانة: الساعة والمؤقّتات هنا محاكاة (host مُحقَن). هذا اختبار منطق الجدولة، وليس
 * تسجيلاً حقيقياً في متصفح؛ التسجيل الفعلي يُفحص يدوياً (راجع تقرير الجلسة).
 */
import assert from 'node:assert/strict'
import {
  pickRecorderMime, detectCaptureSupport, createFrameLoop, createCaptureSession, collectRecording,
  evaluateProbe, evaluateSamples, evaluateMotion, evaluateFrameCount, evaluateFileSize, summarizeChecks,
  describeVerification, firstFailure, lumaStats, isBlankFrame, durationTolerance,
} from '../src/lib/video-capture-core.ts'

let checks = 0
const check = (condition, message) => { assert.ok(condition, message); checks += 1 }
const eq = (a, b, message) => { assert.deepEqual(a, b, message); checks += 1 }

/* ------------------------- ساعة ومؤقّتات وهمية دقيقة ------------------------- */
function fakeHost({ rafHz = 60, visible = true, timerFloorMs = 0 } = {}) {
  const clock = { now: 0 }
  let nextId = 1
  const rafs = new Map()
  const timers = new Map()
  const frameMs = 1000 / rafHz
  const host = {
    now: () => clock.now,
    requestFrame(cb) { const id = nextId++; rafs.set(id, cb); return id },
    cancelFrame(id) { rafs.delete(id) },
    setTimer(cb, ms) { const id = nextId++; timers.set(id, { cb, at: clock.now + Math.max(ms, timerFloorMs) }); return id },
    clearTimer(id) { timers.delete(id) },
  }
  const peak = { raf: 0, timers: 0 }
  const track = () => { peak.raf = Math.max(peak.raf, rafs.size); peak.timers = Math.max(peak.timers, timers.size) }
  function advanceTo(limitMs) {
    for (let guard = 0; guard < 200000; guard += 1) {
      const nextRaf = visible && rafs.size ? (Math.floor(clock.now / frameMs + 1e-9) + 1) * frameMs : Infinity
      let nextTimer = Infinity; let timerId = 0
      for (const [id, t] of timers) if (t.at < nextTimer) { nextTimer = t.at; timerId = id }
      const next = Math.min(nextRaf, nextTimer)
      if (!Number.isFinite(next) || next > limitMs) { clock.now = Math.max(clock.now, limitMs); return }
      clock.now = Math.max(clock.now, next)
      if (nextRaf <= nextTimer) { const batch = [...rafs.values()]; rafs.clear(); batch.forEach((cb) => cb()) }
      else { const t = timers.get(timerId); timers.delete(timerId); t.cb() }
      track()
    }
    throw new Error('الحلقة لم تنتهِ — ربما جدولة لا نهائية')
  }
  return { host, clock, advanceTo, pending: () => ({ raf: rafs.size, timers: timers.size }), peak }
}

/* ------------------------------ 1) الصيغة والدعم ------------------------------ */
const supports = (set) => ({ isTypeSupported: (t) => set.includes(t) })
check(pickRecorderMime('webm-first', supports(['video/webm', 'video/mp4'])) === 'video/webm', 'webm-first يفضّل webm')
check(pickRecorderMime('mp4-first', supports(['video/webm', 'video/mp4'])) === 'video/mp4', 'mp4-first يفضّل mp4')
check(pickRecorderMime('mp4-first', supports([])) === '', 'لا صيغة → نص فارغ')
check(pickRecorderMime('mp4-first', undefined) === '', 'لا MediaRecorder → نص فارغ بلا استثناء')
check(pickRecorderMime('webm-first', { isTypeSupported() { throw new Error('boom') } }) === '', 'isTypeSupported يرمي → لا ينهار')
const noRec = detectCaptureSupport({ preference: 'mp4-first', needsAudio: true, env: { canvasCaptureStream: true } })
check(!noRec.supported && noRec.reasons.some((r) => r.includes('MediaRecorder')), 'غياب MediaRecorder يُذكر سبباً')
const noAudio = detectCaptureSupport({ preference: 'mp4-first', needsAudio: true, env: { MediaRecorder: supports(['video/webm']), canvasCaptureStream: true } })
check(!noAudio.supported && noAudio.reasons.some((r) => r.includes('AudioContext')), 'الريل يحتاج AudioContext ويُبلَّغ بغيابه')
const okSupport = detectCaptureSupport({ preference: 'webm-first', env: { MediaRecorder: supports(['video/webm']), canvasCaptureStream: true } })
check(okSupport.supported && okSupport.mime === 'video/webm', 'دعم كامل بلا صوت مطلوب')

/* ------------------- 2) النمط القديم: يُثبت العيب (نموذج للمقارنة) ------------------- */
{
  // نسخة مطابقة لما كان في reel-motion/design-video: rAF + setInterval يستدعيان step، وstep يطلب rAF جديداً دائماً.
  const sim = fakeHost({ rafHz: 60 })
  let frames = 0
  let rafId = 0
  const step = () => { frames += 1; rafId = sim.host.requestFrame(step) }
  rafId = sim.host.requestFrame(step)
  const intervalFire = () => { step(); sim.host.setTimer(intervalFire, 33) }
  sim.host.setTimer(intervalFire, 33)
  sim.advanceTo(2000)
  check(sim.pending().raf > 1, `النمط القديم يراكم سلاسل rAF (معلّق الآن: ${sim.pending().raf})`)
  check(frames > 2 * 30 * 1.5, `النمط القديم يرسم أكثر من ضعف المعدل المقصود (${frames} إطاراً في ثانيتين بدل ~60)`)
  void rafId
}

/* ------------------------ 3) الحلقة الجديدة: واحدة ومنضبطة ------------------------ */
{
  const sim = fakeHost({ rafHz: 60 })
  const seen = []
  const loop = createFrameLoop({ fps: 30, host: sim.host, onFrame: ({ t, dt, frame }) => { seen.push({ t, dt, frame }); return t < 2 } })
  const done = loop.run()
  sim.advanceTo(2500)
  const stats = await done
  check(sim.peak.raf <= 1 && sim.peak.timers <= 1, `لا أكثر من طلب rAF ومؤقّت واحد معلّقين (${JSON.stringify(sim.peak)})`)
  check(stats.maxPendingRaf <= 1 && stats.maxPendingTimers <= 1, 'الإحصاءات الداخلية تؤكد سلسلة واحدة')
  check(stats.frames >= 55 && stats.frames <= 66, `~30fps لثانيتين = ~60 إطاراً (فعلي ${stats.frames})`)
  check(sim.pending().raf === 0 && sim.pending().timers === 0, 'لا شيء معلّق بعد الانتهاء')
  check(seen[0].dt === 0 && seen[0].frame === 1, 'الإطار الأول dt=0 ورقمه 1')
  check(seen.every((s) => s.dt <= 0.05 + 1e-9), 'dt مسقوف')
  check(seen.every((s, i) => i === 0 || s.t >= seen[i - 1].t), 'الزمن لا يرجع')
}

/* ----------------------- 4) التبويب الخلفي: rAF صامت والمؤقّت يكمل ----------------------- */
{
  const sim = fakeHost({ rafHz: 60, visible: false, timerFloorMs: 1000 }) // Chrome يخنق المؤقّتات إلى ~1Hz
  let last = 0
  const loop = createFrameLoop({ fps: 30, host: sim.host, onFrame: ({ t }) => { last = t; return t < 5 } })
  const done = loop.run()
  sim.advanceTo(8000)
  const stats = await done
  check(last >= 5, 'الحلقة تصل نهاية المدة رغم أن rAF لا يصل أبداً')
  check(stats.rafTicks === 0 && stats.timerTicks >= 5, 'كل الإطارات جاءت من المؤقّت الاحتياطي')
  check(sim.peak.raf <= 1 && sim.peak.timers <= 1, 'حتى في الخلفية: سلسلة واحدة')
  check(stats.frames <= 8, `الخنق يُنتج إطارات قليلة (${stats.frames}) — والمُصدِّر يكشفها بفحص عدد الإطارات`)
}

/* ------------------- 5) العودة من الخلفية: لا تراكم ولا قفزة فيزياء ------------------- */
{
  const sim = fakeHost({ rafHz: 60, visible: false, timerFloorMs: 1000 })
  const dts = []
  const loop = createFrameLoop({ fps: 30, host: sim.host, onFrame: ({ t, dt }) => { dts.push(dt); return t < 6 } })
  const done = loop.run()
  sim.advanceTo(3000) // انقطاع طويل ثم إيقاف
  loop.stop()
  await done
  check(dts.every((d) => d <= 0.05 + 1e-9), 'بعد انقطاع طويل dt مسقوف فلا تقفز الجسيمات')
  check(sim.pending().raf === 0 && sim.pending().timers === 0, 'stop() يزيل كل ما هو معلّق')
}

/* ----------------------------- 6) الجهاز البطيء ----------------------------- */
{
  const sim = fakeHost({ rafHz: 60 })
  const ts = []
  const loop = createFrameLoop({
    fps: 30, host: sim.host,
    onFrame: ({ t }) => { ts.push(t); sim.clock.now += 90; return t < 3 }, // كل رسم يستهلك 90ms (≈11fps)
  })
  const done = loop.run()
  sim.advanceTo(10_000)
  const stats = await done
  check(ts[ts.length - 1] >= 3 && ts[ts.length - 1] < 3.6, 'الزمن زمن حائط: الجهاز البطيء يُسقط إطارات ولا يمدّ المدة')
  check(stats.frames < 3 * 30 * 0.5, `الإطارات أقل بكثير من المعدل المستهدف (${stats.frames}) — وهذا ما يلتقطه فحص عدد الإطارات`)
  check(sim.peak.raf <= 1 && sim.peak.timers <= 1, 'البطء لا يُنتج سلاسل إضافية')
}

/* ----------------------------- 7) الأخطاء والإيقاف ----------------------------- */
{
  const sim = fakeHost()
  const loop = createFrameLoop({ fps: 30, host: sim.host, onFrame: ({ frame }) => { if (frame === 4) throw new Error('فشل الرسم') } })
  const done = loop.run()
  sim.advanceTo(2000)
  await assert.rejects(done, /فشل الرسم/); checks += 1
  check(sim.pending().raf === 0 && sim.pending().timers === 0, 'استثناء الرسم يوقف الحلقة ولا يتركها معلّقة')
  const twice = fakeHost(); const l2 = createFrameLoop({ fps: 30, host: twice.host, onFrame: () => true })
  const p = l2.run(); await assert.rejects(l2.run(), /تعمل بالفعل/); checks += 1
  l2.stop(); await p
}

/* ------------------------------ 8) المسجِّل ------------------------------ */
const fakeRecorder = () => ({ ondataavailable: null, onstop: null, onerror: null, state: 'recording', start() {}, stop() { this.state = 'inactive'; queueMicrotask(() => this.onstop?.()) } })
{
  const rec = fakeRecorder()
  const col = collectRecording(rec, 'video/webm;codecs=vp9', 'خطأ المسجِّل')
  rec.ondataavailable({ data: new Blob(['abc']) })
  const blob = await col.finish()
  check(blob.size === 3 && blob.type === 'video/webm', 'يجمع الأجزاء ويخرج النوع بلا codecs')
}
{
  const rec = fakeRecorder()
  const col = collectRecording(rec, 'video/webm', 'MediaRecorder أبلغ عن خطأ')
  rec.onerror()
  check(col.failure()?.message === 'MediaRecorder أبلغ عن خطأ', 'خطأ المسجِّل متاح للحلقة قبل النهاية')
  await assert.rejects(col.finish(), /MediaRecorder أبلغ عن خطأ/); checks += 1
}
{
  const rec = { ...fakeRecorder(), stop() { this.state = 'inactive' /* لا onstop أبداً */ } }
  const col = collectRecording(rec, 'video/webm', 'x')
  let fire = null
  const p = col.finish({ timeoutMs: 100, setTimer: (cb) => { fire = cb; return 1 }, clearTimer() {} })
  fire()
  await assert.rejects(p, /انتهت مهلة المسجِّل/); checks += 1
}

/* --------------------------- 9) تنظيف الموارد --------------------------- */
{
  const calls = []
  const session = createCaptureSession()
  session.stream({ getTracks: () => [{ stop: () => calls.push('track1') }, { stop: () => { calls.push('track2'); throw new Error('مغلق') } }] })
  session.stream({ getTracks: () => { throw new Error('تالف') } })
  session.audio({ close: async () => { calls.push('audio'); throw new Error('أُغلق') } })
  session.node({ remove: () => calls.push('canvas') })
  session.url('blob:x')
  session.onDispose(() => calls.push('extra'))
  await session.dispose((u) => calls.push(`revoke:${u}`))
  await session.dispose((u) => calls.push(`revoke-again:${u}`))
  eq(calls.filter((c) => c === 'track1').length, 1, 'المسار يُوقف مرة واحدة')
  check(calls.includes('track2') && calls.includes('audio') && calls.includes('canvas') && calls.includes('extra') && calls.includes('revoke:blob:x'), 'فشل مورد لا يمنع إغلاق الباقي')
  check(!calls.some((c) => c.startsWith('revoke-again')) && session.disposed, 'dispose آمنة للتكرار')
}

/* --------------------- 10) التحقق من الملف: لا «جاهز» بلا قياس --------------------- */
{
  const good = evaluateProbe({ duration: 24.1, width: 1080, height: 1920 }, { seconds: 24, width: 1080, height: 1920 })
  check(good.every((c) => c.status === 'pass'), 'مدة ومقاس مطابقان → نجاح')
  const shortRun = evaluateProbe({ duration: 9, width: 1080, height: 1920 }, { seconds: 24, width: 1080, height: 1920 })
  check(shortRun.find((c) => c.id === 'duration').status === 'fail', 'ملف مقطوع (9ث من 24ث) → فشل')
  const wrongSize = evaluateProbe({ duration: 24, width: 1920, height: 1080 }, { seconds: 24, width: 1080, height: 1920 })
  check(wrongSize.find((c) => c.id === 'size').status === 'fail', 'مقاس أفقي بدل العمودي → فشل')
  const unknown = evaluateProbe({ duration: null, width: null, height: null }, { seconds: 24, width: 1080, height: 1920 })
  check(unknown.every((c) => c.status === 'unverified'), 'تعذّر القياس → غير متحقَّق لا نجاح')
  check(durationTolerance(100) === 8 && durationTolerance(5) === 0.9, 'سماحية المدة نسبة بحدّ أدنى')

  const black = { mean: 1, variance: 0.1 }; const lit = { mean: 90, variance: 800 }
  check(isBlankFrame(black) && !isBlankFrame(lit), 'الإطار الأسود يُعرف')
  const s = evaluateSamples([{ position: 0.06, label: 'بداية الفيديو', stats: lit }, { position: 0.5, label: 'وسط الفيديو', stats: black }, { position: 0.95, label: 'نهاية الفيديو', stats: null }])
  eq(s.map((c) => c.status), ['pass', 'fail', 'unverified'], 'بداية سليمة، وسط أسود، نهاية غير ممكنة القياس')
  check(evaluateMotion([{ stats: { mean: 90, variance: 9 } }, { stats: { mean: 90.2, variance: 9 } }, { stats: { mean: 90.1, variance: 9 } }]).status === 'fail', 'ثلاث عيّنات متطابقة → تجمّد')
  check(evaluateMotion([{ stats: { mean: 40, variance: 9 } }, { stats: { mean: 95, variance: 9 } }]).status === 'pass', 'عيّنات متباينة → حركة')
  check(evaluateMotion([{ stats: null }, { stats: null }]).status === 'unverified', 'بلا عيّنات → غير متحقَّق')
  check(evaluateFrameCount(31, 24, 30).status === 'fail' && evaluateFrameCount(500, 24, 30).status === 'pass', 'عدد الإطارات الكافي')
  check(evaluateFileSize(10, 24000).status === 'fail' && evaluateFileSize(90000, 24000).status === 'pass', 'حجم الملف')

  const allPass = summarizeChecks(good)
  check(allPass.readyToPublish && allPass.status === 'verified', 'كل الفحوص ناجحة → جاهز للنشر')
  const partial = summarizeChecks([...good, ...s.slice(2)])
  check(!partial.readyToPublish && partial.status === 'unverified', 'فحص غير متحقَّق واحد يكفي لمنع «جاهز للنشر»')
  const failed = summarizeChecks([...good, ...shortRun])
  check(failed.status === 'failed' && !failed.readyToPublish, 'فحص فاشل → failed')
  check(firstFailure(failed)?.includes('المدة') && firstFailure(allPass) === null, 'firstFailure يسمّي الفحص الفاشل')
  check(describeVerification(partial).includes('نهاية الفيديو'), 'الوصف يذكر ما تعذّر')
  check(lumaStats(new Uint8ClampedArray(64).fill(0)).mean === 0, 'lumaStats على أسود')
}

console.log(`✓ اجتاز الأساس المشترك لتسجيل الفيديو ${checks} فحصاً`)
