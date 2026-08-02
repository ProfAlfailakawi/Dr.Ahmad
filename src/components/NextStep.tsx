import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import type { ArticleRecord, MediaRecord, PaperRecord } from '../lib/cms'
import { loadBookPassages } from '../lib/book-quotes'
import { pickNextStep, rememberStep, type NextStep as Step } from '../lib/next-step'

/**
 * الفصل التالي — سطرٌ واحد في نهاية الصفحة.
 *
 * قصداً بلا بطاقة ولا صورة ولا عنوان قسم: عنصرٌ واحد، ومكانه بعد كل شيء.
 * القارئ الذي أنهى المادة يجد أمامه باباً واحداً مفتوحاً، لا عشرة أبواب.
 */
export function NextStep({
  seed,
  from,
  articles,
  papers,
  media,
  excludeKey,
}: {
  seed: string
  from: Step['kind']
  articles: ArticleRecord[]
  papers: PaperRecord[]
  media: MediaRecord[]
  excludeKey?: string
}) {
  const [step, setStep] = useState<Step | null>(null)

  useEffect(() => {
    let on = true
    /* المختارات محمّلة أصلاً فتظهر الخطوة فوراً؛ ثم يُجلب فهرس المتون في
       الخلفية فترتقي الخطوة إن وجد ما هو أقرب. */
    const decide = (deepReady: boolean) => {
      if (!on) return
      const next = pickNextStep({ seed, from, articles, papers, media, excludeKey, deepReady })
      if (next) setStep(next)
    }
    decide(false)
    void loadBookPassages().then(() => decide(true))
    return () => { on = false }
  }, [articles, excludeKey, from, media, papers, seed])

  if (!step) return null

  return (
    <div className="mx-auto max-w-shell px-6 pb-20 md:px-11">
      <Link
        to={step.to}
        onClick={() => rememberStep(step.key)}
        className="group flex flex-wrap items-baseline gap-x-3 gap-y-1 border-t border-hair pt-6 transition-colors"
      >
        {/* بلا عنوان «التالي»: الصفحة فيها تنقّل مقالات يحمل الاسم نفسه،
            وتكراره زحمة. الدعوة وحدها تكفي وتقول أكثر. */}
        <span className="text-[.82rem] text-soft">{step.invite}</span>
        <strong className="text-[.95rem] font-semibold leading-relaxed text-ink transition-colors group-hover:text-accent">
          {step.title} ←
        </strong>
      </Link>
    </div>
  )
}
