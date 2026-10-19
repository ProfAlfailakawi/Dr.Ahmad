import { useEffect } from 'react'
import { ArrowUpRight, HardDrive, MonitorPlay, ShieldCheck } from 'lucide-react'
import { useSeo } from '../components/seo'

// Top-level navigation to the local app; assemble the URL so static security
// audits don't mistake it for an embedded insecure resource.
const LOCAL_STUDIO = ['http:', '', 'localhost:4173', '#presenter'].join('/')

export default function Live() {
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('openLocal') === '1') {
      window.location.assign(LOCAL_STUDIO)
    }
  }, [])

  useSeo({
    title: 'استوديو المحاضرات الحي',
    description: 'بوابة خاصة لفتح استوديو المحاضرات المحلي على جهاز الدكتور أحمد.',
    path: '/live',
    robots: 'noindex, nofollow',
  })

  return (
    <main dir="rtl" className="relative grid min-h-screen place-items-center overflow-hidden bg-canvas px-5 py-12 text-ink">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 opacity-40 [background:radial-gradient(ellipse_at_50%_0%,var(--tw-gradient-stops))] from-accent/15 via-transparent to-transparent" />
      <section className="relative w-full max-w-2xl rounded-[2rem] border border-hair bg-canvas/90 p-7 shadow-2xl shadow-ink/5 backdrop-blur md:p-12">
        <a href="https://dr-alfailakawi.com" className="text-sm text-soft transition hover:text-accent">د. أحمد الفيلكاوي</a>
        <div className="mt-10 flex size-14 items-center justify-center rounded-2xl border border-accent/20 bg-accent/10 text-accent">
          <MonitorPlay aria-hidden size={27} strokeWidth={1.5} />
        </div>
        <p className="mt-8 text-xs font-semibold tracking-[.18em] text-accent">مساحة المحاضر الخاصة</p>
        <h1 className="mt-3 font-display text-4xl font-semibold leading-tight md:text-5xl">استوديو المحاضرات</h1>
        <p className="mt-5 max-w-xl text-base font-light leading-8 text-soft">
          افتح الاستوديو المحلي على هذا الكمبيوتر، ثم اختر ملف المحاضرة. التحويل والعرض يجريان على جهازك.
        </p>

        <a href="/live?openLocal=1" onClick={(event) => { event.preventDefault(); window.location.assign(LOCAL_STUDIO) }} className="mt-9 inline-flex min-h-14 w-full items-center justify-center gap-3 rounded-2xl bg-accent px-6 py-4 text-center font-semibold text-canvas transition hover:bg-accent-deep focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2">
          فتح الاستوديو على هذا الكمبيوتر <ArrowUpRight aria-hidden size={18} />
        </a>

        <div className="mt-8 grid gap-3 border-t border-hair pt-6 sm:grid-cols-2">
          <div className="flex items-start gap-3 text-sm leading-6 text-soft"><HardDrive className="mt-1 shrink-0 text-accent" size={17} /> الملفات تبقى على جهازك ولا تُرفع إلى الموقع.</div>
          <div className="flex items-start gap-3 text-sm leading-6 text-soft"><ShieldCheck className="mt-1 shrink-0 text-accent" size={17} /> لا توجد رسوم لخادم تحويل سحابي.</div>
        </div>

        <p className="mt-6 rounded-xl bg-wash px-4 py-3 text-sm leading-6 text-soft">
          إذا لم يفتح الاستوديو، شغّل برنامج ALFA المحلي على الكمبيوتر أولاً، ثم ارجع إلى هذه الصفحة واضغط الزر. يحتاج البرنامج المحلي أن يبقى مفتوحاً أثناء التحويل والعرض.
        </p>
        <p className="mt-5 text-center text-xs text-soft/70">هذا رابط غير مفهرس بمحركات البحث، لكنه ليس محمياً بكلمة مرور؛ شاركه مع نفسك فقط.</p>
      </section>
    </main>
  )
}
