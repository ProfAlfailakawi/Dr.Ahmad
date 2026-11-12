import { useEffect, useState } from 'react'
import type { AdminTab } from './admin-navigation'
import {
  VIDEO_PATHS, VIDEO_STAGES, clearVideoSeed, directorSeedFor, readVideoSeed, reelSeedFor, standaloneSeedFor, writeReelSeed,
  type VideoPath, type VideoSeed,
} from '../../lib/video-hub'

/* مدخل الفيديو والموشن — مكان واحد يشرح الفرق بين المسارات الأربعة ويقود إلى أحدها.
   لا يصنع فيديو بنفسه ولا يكرّر أداة: يسلّم المادة المختارة (من الأطلس عادةً) إلى المسار
   الذي تختاره، ثم يعرض المراحل المشتركة: المصدر ← الخطة ← المعاينة ← الفحص ← التصدير. */

const card = 'rounded-[1.75rem] border border-hair bg-paper p-5 shadow-sm md:p-7'
const primary = 'rounded-full bg-accent px-5 py-2.5 text-[.8rem] font-bold text-canvas transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-50'
const ghost = 'rounded-full border border-hair bg-canvas px-4 py-2 text-[.76rem] font-semibold text-soft transition hover:border-accent hover:text-accent'

export function VideoHub({ onOpen }: { onOpen: (tab: AdminTab) => void }) {
  const [seed, setSeed] = useState<VideoSeed | null>(null)
  useEffect(() => { try { setSeed(readVideoSeed(sessionStorage)) } catch { setSeed(null) } }, [])

  const open = (path: VideoPath) => {
    try {
      if (path.tab === 'reel-studio') {
        const reel = reelSeedFor(path, seed)
        if (reel) writeReelSeed(sessionStorage, reel)
      } else if (path.tab === 'live-director') {
        const director = directorSeedFor(seed)
        if (director) {
          sessionStorage.setItem('admin:live-director-seed', JSON.stringify(director))
          window.dispatchEvent(new CustomEvent('studio:live-director-seed', { detail: director }))
          return
        }
      } else if (path.tab === 'social-posts') {
        const post = standaloneSeedFor(seed)
        if (post) {
          localStorage.setItem('studio-standalone-seed', JSON.stringify(post))
          window.dispatchEvent(new CustomEvent('studio:standalone-seed', { detail: post }))
        }
      }
    } catch { /* تسليم المادة اختياري؛ فتح الأداة لا يتوقف عليه */ }
    onOpen(path.tab)
  }

  return (
    <section className="grid gap-5" dir="rtl" data-panel="video-hub">
      <header className={card}>
        <p className="text-[.66rem] font-black uppercase tracking-[.18em] text-accent">الفيديو والموشن</p>
        <h2 className="mt-2 font-display text-2xl font-bold text-ink md:text-3xl">مدخل واحد لإنتاج الفيديو</h2>
        <p className="mt-2 max-w-3xl text-[.84rem] leading-relaxed text-soft">أربعة مسارات تختلف في ما يصنعه الموقع بنفسه وما تصنعه أنت. اختر المسار، وسيقودك عبر المراحل نفسها دائماً. أطلس القصص ليس مساراً خامساً: هو أداة <b className="text-ink">اختيار المادة</b> وبداية المشروع.</p>
        <ol className="mt-5 flex flex-wrap items-stretch gap-2" aria-label="مراحل العمل">
          {VIDEO_STAGES.map((stage, index) => (
            <li key={stage.id} className="flex min-w-[8.5rem] flex-1 items-center gap-2 rounded-2xl border border-hair bg-canvas px-3 py-2.5">
              <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-accent/10 text-[.7rem] font-black text-accent">{index + 1}</span>
              <span><b className="block text-[.78rem] text-ink">{stage.label}</b><span className="block text-[.62rem] leading-snug text-soft">{stage.note}</span></span>
            </li>
          ))}
        </ol>
      </header>

      <div className={`${card} flex flex-wrap items-center justify-between gap-3`} data-video-source={seed ? 'selected' : 'none'}>
        <div className="min-w-0">
          <p className="text-[.7rem] font-bold text-accent">١ · المصدر</p>
          {seed
            ? <p className="mt-1 text-[.86rem] leading-relaxed text-ink">المادة المختارة: <b>{seed.title || 'بلا عنوان'}</b> <span className="text-soft">({seed.origin === 'atlas' ? 'من الأطلس' : 'يدوية'})</span> — ستُسلَّم إلى المسار الذي تفتحه.</p>
            : <p className="mt-1 text-[.82rem] leading-relaxed text-soft">لم تختر مادة بعد. افتح الأطلس لتختار من أرشيفك، أو افتح أي مسار واكتب مادتك فيه.</p>}
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" className={primary} onClick={() => onOpen('storyboard-atlas')}>{seed ? 'غيّر المادة من الأطلس' : 'اختر مادة من الأطلس'}</button>
          {seed && <button type="button" className={ghost} onClick={() => { try { clearVideoSeed(sessionStorage) } catch { /* لا شيء */ } setSeed(null) }}>أزل الاختيار</button>}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2" data-video-paths="4">
        {VIDEO_PATHS.map((path) => (
          <article key={path.id} className={card} data-video-path={path.id}>
            <div className="flex items-start justify-between gap-3">
              <h3 className="font-display text-xl font-bold text-ink">{path.title}</h3>
              <span className={`shrink-0 rounded-full px-3 py-1 text-[.62rem] font-bold ${path.who === 'site-renders' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-800'}`}>{path.who === 'site-renders' ? 'الموقع يصنع الفيديو' : 'تولّد المقاطع بنفسك'}</span>
            </div>
            <p className="mt-2 text-[.82rem] leading-relaxed text-soft">{path.tagline}</p>
            <dl className="mt-4 grid gap-2 text-[.74rem] leading-relaxed">
              <div><dt className="inline font-bold text-ink">تعطيه: </dt><dd className="inline text-soft">{path.input}</dd></div>
              <div><dt className="inline font-bold text-ink">تأخذ: </dt><dd className="inline text-soft">{path.output}</dd></div>
              <div><dt className="inline font-bold text-ink">المدة: </dt><dd className="inline text-soft">{path.duration}</dd></div>
            </dl>
            <p className={`mt-3 rounded-xl border px-3 py-2 text-[.7rem] leading-relaxed ${path.who === 'site-renders' ? 'border-hair bg-canvas text-soft' : 'border-amber-300 bg-amber-50 text-amber-900'}`}>{path.whoNote}</p>
            <button type="button" className={`${primary} mt-4`} onClick={() => open(path)}>{path.actionLabel}{seed ? ' بالمادة المختارة' : ''}</button>
          </article>
        ))}
      </div>
    </section>
  )
}

export default VideoHub
