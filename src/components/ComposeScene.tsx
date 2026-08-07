import { useEffect, useState } from 'react'
import { Link } from 'react-router'

/**
 * «الإجابة تُبنى أمامك» — بدل الدوّارة وبدل سطر «جارٍ…».
 *
 * الدوّارة تقول للزائر: انتظر. وهذا المشهد يقول له: **انظر**. فالفرق بينهما
 * ليس زخرفياً: الانتظار الذي يُرى أقصرُ في الإحساس من الانتظار الذي يُخفى،
 * والزائر الذي يرى الجواب يُركَّب يثق بأنه رُكِّب من شيء.
 *
 * والمشهد مأخوذٌ من عالم الدكتور لا من عالم الطيران: مسطرة سطورٍ كمسطرة
 * الصفّ، وعمودا هامشٍ كهامش الصفحة، وكتلٌ شبحية تنزل سطراً بعد سطر كما
 * تُصفّ الفقرة — وآخرُ سطرٍ يقصر من اليسار كما تقصر الفقرة العربية.
 *
 * القواعد الستّ التي يقوم عليها هذا الملف، وتنتقل معه إلى بقيّة الصفحات:
 *   ١) لا شيء يظهر جاهزاً — يُركَّب أمام العين.
 *   ٢) الانتظار يُصمَّم، ويتكلّم بصوت الدكتور لا بلغة الأنظمة.
 *   ٣) البنية تُرى: خيطٌ رفيع وعقدة، ويُكتب **سبب** الصلة تحتها.
 *   ٤) الصندوق لا يقفز: الارتفاع محجوز، فيتبدّل المحتوى في مكانه.
 *   ٥) الجرأة في موضعٍ واحد: لون الاعتماد في نقطةٍ واحدة، وما حولها شعرة.
 *   ٦) زواياه ١٢، وخطّاه المسيري وتجوال، وألوانه ألوان الموقع — لا استعارة.
 */

export function ComposeScene({
  lines,
  compact = false,
}: {
  lines: string[]
  compact?: boolean
}) {
  const [step, setStep] = useState(0)

  useEffect(() => {
    if (lines.length < 2) return
    /* الجملة تتبدّل ببطءٍ يكفي لتُقرأ — لا وميضاً يُقلق. */
    const id = window.setInterval(() => {
      setStep((current) => (current + 1) % lines.length)
    }, 1700)
    return () => window.clearInterval(id)
  }, [lines.length])

  const shown = lines[Math.min(step, lines.length - 1)] || lines[0] || ''

  return (
    <div className="compose-scene" role="status" aria-live="polite">
      <div className={`compose-frame${compact ? ' compose-frame--compact' : ''}`} aria-hidden="true">
        <i className="compose-guide compose-guide--start" />
        <i className="compose-guide compose-guide--end" />
        <i className="compose-ghost compose-ghost--head" />
        <i className="compose-ghost compose-ghost--full" />
        <i className="compose-ghost compose-ghost--wide" />
        <i className="compose-ghost compose-ghost--tail" />
        <i className="compose-drop" />
      </div>
      <p className="compose-line">{shown}</p>
      <span className="compose-rule" aria-hidden="true"><i /></span>
    </div>
  )
}

export type Branch = {
  /** مفتاحٌ ثابت — سطر المفاتيح في React لا يُبنى من العنوان وحده. */
  id: string
  kind: string
  title: string
  /** سبب الصلة كما يُعيده المحرّك — لا صياغة من عندنا. */
  why: string
  to: string
}

/**
 * الأغصان: البطاقة الأمّ تتفرّع، ويُكتب تحت كلّ غصنٍ سببُ صلته.
 * غصنان فقط — لأن الثلاثة تصير قائمة، والقائمةُ تُنهي الزيارة.
 */
export function BranchGrove({
  items,
  onOpen,
}: {
  items: Branch[]
  onOpen?: (branch: Branch) => void
}) {
  const shown = items.slice(0, 2)
  const [grown, setGrown] = useState(false)

  useEffect(() => {
    if (!shown.length) return
    /* إطارٌ واحد يفصل بين الظهور وبين النموّ، وإلا لم يعمل الانتقال. */
    const id = window.requestAnimationFrame(() => setGrown(true))
    return () => window.cancelAnimationFrame(id)
  }, [shown.length])

  if (!shown.length) return null

  return (
    <div className={`grove${grown ? ' grove--grown' : ''}`}>
      <svg className="grove-thread" viewBox="0 0 520 54" preserveAspectRatio="none" aria-hidden="true">
        {shown.length > 1 ? (
          <>
            <path d="M260 0 C260 28 124 24 124 54" vectorEffect="non-scaling-stroke" />
            <path d="M260 0 C260 28 396 24 396 54" vectorEffect="non-scaling-stroke" />
          </>
        ) : (
          <path d="M260 0 L260 54" vectorEffect="non-scaling-stroke" />
        )}
        <circle cx="260" cy="2" r="2.6" />
      </svg>

      <div className={`grove-slots${shown.length > 1 ? '' : ' grove-slots--single'}`}>
        {shown.map((branch, index) => (
          <div className="grove-slot" key={branch.id} style={{ ['--grove-delay' as string]: `${index * 380}ms` }}>
            <Link
              to={branch.to}
              onClick={() => onOpen?.(branch)}
              className="grove-box"
            >
              <span className="grove-kind">{branch.kind}</span>
              <span className="grove-title">{branch.title}</span>
            </Link>
            <p className="grove-why">{branch.why}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
