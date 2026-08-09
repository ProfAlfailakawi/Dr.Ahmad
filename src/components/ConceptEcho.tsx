import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router'
import type { ConceptEcho } from '../lib/concept-weave'
import { SocialIcon } from './icons'

const relationNote: Record<ConceptEcho['relation'], string> = {
  'يؤيدها': 'نتيجة بحثية موثقة تتقاطع مباشرة مع معنى هذه الفقرة.',
  'يعارضها': 'نتيجة بحثية موثقة تضع قيداً أو نتيجة مخالفة قرب هذه الفكرة.',
  'يوسّعها': 'المفهوم نفسه يُقرأ هنا من مساحة أوسع داخل الأرشيف.',
  'سبقتها': 'ظهور أسبق زمنياً للفكرة نفسها داخل الأرشيف.',
  'تطورت منها': 'ظهور لاحق للمفهوم يكشف كيف اتسع سياقه عبر الزمن.',
}

export function ConceptEchoMarker({ echo }: { echo: ConceptEcho }) {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') setOpen(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  return (
    <>
      <button
        type="button"
        className="concept-echo-dot reader-hide-focus"
        onClick={(event) => { event.stopPropagation(); setOpen(true) }}
        aria-label={`صدى الفكرة: ${echo.relation}`}
        title="صدى الفكرة"
      >
        <span aria-hidden="true" />
      </button>
      {open && createPortal(
        <div className="concept-echo-overlay" role="presentation" onClick={() => setOpen(false)}>
          <aside className="concept-echo-sheet" role="dialog" aria-modal="true" aria-label="صدى الفكرة" dir="rtl" onClick={(event) => event.stopPropagation()}>
            <header className="concept-echo-head">
              <div>
                <p className="concept-echo-kicker">صدى الفكرة</p>
                <p className="concept-echo-relation">{echo.relation}</p>
              </div>
              <button type="button" className="concept-echo-close" onClick={() => setOpen(false)} aria-label="إغلاق" title="إغلاق"><SocialIcon name="Close" size={13} /></button>
            </header>
            <div className="concept-echo-thread" aria-hidden="true"><span /></div>
            <p className="concept-echo-context">{relationNote[echo.relation]}</p>
            <p className="concept-echo-concept">{echo.concept}</p>
            <h3 className="concept-echo-title">{echo.title}</h3>
            {echo.note && <p className="concept-echo-note">{echo.note}</p>}
            <footer className="concept-echo-foot">
              <span>{echo.sourceKind}{echo.year ? ` · ${echo.year}` : ''}</span>
              <Link viewTransition to={echo.to} onClick={() => setOpen(false)}>افتح المصدر <span aria-hidden="true">←</span></Link>
            </footer>
          </aside>
        </div>,
        document.body,
      )}
    </>
  )
}
