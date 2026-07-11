/* اختبار أصوات أعمى حقيقي: الـmanifest العام لا يحمل أسماء الأصوات أو الدول.
   اللوحة تحفظ optionKey + sampleHash فقط؛ سكربت الخادم وحده يطابقهما مع التدقيق
   الخاص ويمنع الإنتاج إن لم يكن الخيار مجتازاً. */
import { useEffect, useRef, useState } from 'react'
import { getDb } from '../../lib/firebase'

type Option = { key: string; durationSec: number; audio: string; audioHash: string; eligible: boolean }
type Manifest = {
  schemaVersion: 2
  generatedAt: string
  title: string
  sampleHash: string
  approvalHash: string
  status: 'awaiting_human_approval' | 'failed_closed'
  sampleGate: { pass: boolean; reason?: string }
  criteria: string[]
  options: Option[]
}

const isManifest = (value: unknown): value is Manifest => {
  if (!value || typeof value !== 'object') return false
  const item = value as Partial<Manifest>
  return item.schemaVersion === 2 && typeof item.sampleHash === 'string' && typeof item.approvalHash === 'string'
    && typeof item.sampleGate?.pass === 'boolean' && Array.isArray(item.criteria) && Array.isArray(item.options)
    && item.options.every((option) => typeof option?.key === 'string' && typeof option?.audio === 'string'
      && typeof option?.audioHash === 'string' && typeof option?.durationSec === 'number'
      && typeof option?.eligible === 'boolean')
}

const card = 'rounded-2xl border border-hair bg-wash p-6 md:p-7'
const ar = (n: number) => String(n).replace(/[0-9]/g, (d) => '٠١٢٣٤٥٦٧٨٩'[+d])
const clock = (s: number) => `${ar(Math.floor(s / 60))}:${ar(Math.floor(s % 60)).padStart(2, '٠')}`

export function VoiceBakeoffCard() {
  const [manifest, setManifest] = useState<Manifest | null>(null)
  const [missing, setMissing] = useState(false)
  const [approved, setApproved] = useState<{ optionKey?: string; sampleHash?: string; approvalHash?: string; status?: string } | null>(null)
  const [saved, setSaved] = useState('')
  const [playing, setPlaying] = useState<string | null>(null)
  const audios = useRef<Record<string, HTMLAudioElement>>({})

  useEffect(() => {
    fetch('/audio/bakeoff/manifest.json', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((m: unknown) => { if (!isManifest(m)) throw new Error('stale manifest'); setManifest(m) })
      .catch(() => setMissing(true))
    ;(async () => {
      try {
        const db = await getDb()
        if (!db) return
        const { doc, getDoc } = await import('firebase/firestore')
        const snap = await getDoc(doc(db, 'site_settings', 'podcast_voices'))
        if (snap.exists()) setApproved(snap.data() as { optionKey?: string; sampleHash?: string; approvalHash?: string; status?: string })
      } catch { /* noop */ }
    })()
  }, [])

  const toggle = (key: string) => {
    const el = audios.current[key]
    if (!el) return
    Object.entries(audios.current).forEach(([k, a]) => { if (k !== key) { a.pause() } })
    if (el.paused) { el.play(); setPlaying(key) } else { el.pause(); setPlaying(null) }
  }

  const persist = async (patch: Record<string, unknown>) => {
    const db = await getDb()
    if (!db) throw new Error('no db')
    const { doc, setDoc, serverTimestamp } = await import('firebase/firestore')
    await setDoc(doc(db, 'site_settings', 'podcast_voices'), { ...patch, updatedAt: serverTimestamp() }, { merge: true })
  }

  const approve = async (opt: Option) => {
    try {
      if (!manifest?.sampleGate.pass || !opt.eligible) throw new Error('sample gate failed')
      await persist({ optionKey: opt.key, sampleHash: manifest.sampleHash,
        approvalHash: manifest.approvalHash, status: 'approved' })
      setApproved({ optionKey: opt.key, sampleHash: manifest.sampleHash,
        approvalHash: manifest.approvalHash, status: 'approved' })
      setSaved(`سُجّل اعتماد النسخة ${ar(manifest.options.indexOf(opt) + 1)}؛ وسيثبتها الخادم بعد مطابقة التدقيق الخاص ✓`)
      setTimeout(() => setSaved(''), 4000)
    } catch { setSaved('تعذّر الحفظ') }
  }

  const rejectAll = async () => {
    try {
      await persist({ status: 'none_acceptable' })
      setApproved({ status: 'none_acceptable' })
      setSaved('سُجّل: لا زوج جاهز يحقق الجودة — يُجهَّز النظام لاحقاً لـ Azure Custom Voice.')
      setTimeout(() => setSaved(''), 6000)
    } catch { setSaved('تعذّر الحفظ') }
  }

  if (missing) return (
    <div className={card}>
      <p className="text-[.76rem] font-semibold uppercase text-accent">اختبار الأصوات الأعمى</p>
      <p className="mt-2 text-[.85rem] font-light leading-relaxed text-soft">
        لم تُولَّد نسخ الاختبار بعد. شغّل <code className="rounded bg-canvas px-1.5 py-0.5 text-[.8rem] text-ink">npm run podcast:ar:bakeoff</code> فتظهر هنا خمس نسخ بلا أسماء للتقييم الأعمى.
      </p>
    </div>
  )
  if (!manifest) return <div className={card}><p className="text-[.85rem] text-soft">جارٍ تحميل نسخ الاختبار…</p></div>

  return (
    <div className={card}>
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <p className="text-[.76rem] font-semibold uppercase text-accent">اختبار الأصوات الأعمى</p>
        {approved?.status === 'approved' && (
          <span className="text-[.78rem] text-soft">الاختيار المسجل: <span className="text-accent">{approved.optionKey}</span></span>
        )}
      </div>
      <p className="mt-1 text-[.85rem] font-light leading-relaxed text-soft">
        النسخ الخمس بالنص والموسيقى والوقفات نفسها — المتغيّر الوحيد هو الصوت. لا يحمل هذا الملف العام أسماءً أو دولاً؛ استمع ثم اعتمد الأنسب.
      </p>
      {!manifest.sampleGate.pass && (
        <p className="mt-3 rounded-xl border border-red-400/40 bg-red-500/5 px-4 py-3 text-[.8rem] leading-relaxed text-red-700 dark:text-red-300">
          العينة مغلقة آلياً ولم تجتز كل شروط القبول. يمكن الاستماع للتشخيص، لكن لا يمكن اعتماد أي نسخة: {manifest.sampleGate.reason || 'فشل غير محدد'}
        </p>
      )}

      {/* المعايير التسعة — تذكير أثناء التقييم */}
      <div className="mt-4 flex flex-wrap gap-1.5">
        {manifest.criteria.map((c) => (
          <span key={c} className="rounded-full border border-hair px-2.5 py-1 text-[.72rem] text-soft">{c}</span>
        ))}
      </div>

      {/* النسخ — بلا أسماء حتى الاعتماد */}
      <div className="mt-5 grid gap-3">
        {manifest.options.map((opt, i) => (
          <div key={opt.key} className="rounded-xl border border-hair bg-canvas p-4">
            <div className="flex items-center gap-4">
              <button
                type="button"
                onClick={() => toggle(opt.key)}
                aria-label={playing === opt.key ? 'إيقاف' : 'تشغيل'}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-accent text-canvas transition-colors hover:bg-accent-deep"
              >
                <span className="text-[.9rem] leading-none">{playing === opt.key ? '❚❚' : '▶'}</span>
              </button>
              <div className="min-w-0 flex-1">
                <p className="text-[.95rem] font-semibold text-ink">
                  النسخة {ar(i + 1)}
                </p>
                <p className="text-[.78rem] text-soft" dir="ltr">{clock(opt.durationSec)}</p>
              </div>
              <button
                type="button"
                onClick={() => approve(opt)}
                disabled={!manifest.sampleGate.pass || !opt.eligible}
                className="shrink-0 rounded-full border border-accent px-4 py-1.5 text-[.8rem] font-semibold text-accent transition-colors hover:bg-accent hover:text-canvas disabled:cursor-not-allowed disabled:opacity-40"
              >
                {opt.eligible ? 'اعتمد هذا' : 'مستبعد آلياً'}
              </button>
            </div>
            <audio
              ref={(el) => { if (el) audios.current[opt.key] = el }}
              src={opt.audio}
              preload="none"
              onEnded={() => setPlaying(null)}
            />
          </div>
        ))}
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-hair pt-4">
        <button type="button" onClick={rejectAll} className="text-[.8rem] text-soft underline underline-offset-4 transition-colors hover:text-accent">
          لا شيء منها يكفي — سجّل «غير مقبول»
        </button>
        <span className="text-[.75rem] text-soft">تُحفظ خريطة الأصوات خارج الملفات العامة لحماية عمى الاختبار.</span>
      </div>

      {saved && <p className="mt-3 text-[.82rem] font-medium text-accent">{saved}</p>}
      {approved?.status === 'none_acceptable' && (
        <p className="mt-3 rounded-xl border border-hair bg-canvas px-4 py-3 text-[.82rem] leading-relaxed text-soft">
          الحالة الحالية: لا زوج جاهز مقبول. النظام مُهيّأ لدعم <span className="text-ink">Azure Custom Voice</span> لاحقاً — يبقى فهد ونورة افتراضاً مؤقتاً حتى يتوفّر صوت مخصّص بالجودة المطلوبة.
        </p>
      )}
    </div>
  )
}
