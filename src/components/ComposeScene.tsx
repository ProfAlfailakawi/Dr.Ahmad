import { useCallback, useEffect, useRef, useState } from 'react'
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
 *   1) لا شيء يظهر جاهزاً — يُركَّب أمام العين.
 *   2) الانتظار يُصمَّم، ويتكلّم بصوت الدكتور لا بلغة الأنظمة.
 *   3) البنية تُرى: خيطٌ رفيع وعقدة، ويُكتب **سبب** الصلة تحتها.
 *   4) الصندوق لا يقفز: الارتفاع محجوز، فيتبدّل المحتوى في مكانه.
 *   5) الجرأة في موضعٍ واحد: لون الاعتماد في نقطةٍ واحدة، وما حولها شعرة.
 *   6) زواياه 12، وخطّاه المسيري وتجوال، وألوانه ألوان الموقع — لا استعارة.
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
      {/* بلا جملة: يبقى المشهد وحده. لا نضع كلمةً لم يكتبها الدكتور. */}
      {shown ? <p className="compose-line">{shown}</p> : null}
      {shown ? <span className="compose-rule" aria-hidden="true"><i /></span> : null}
    </div>
  )
}

/**
 * «لا شيء يظهر جاهزاً» على مستوى الصفحة: يُعلّم العنصرَ حين يدخل الشاشة،
 * فيُرسم خيطُه وتستقرّ محطّاته بدل أن تكون مرسومةً قبل أن يصلها القارئ.
 *
 * ومن لا متصفّحه يعرف IntersectionObserver — أو أطفأ الحركة — يراه مكتملاً
 * من أول لحظة: الميزة تُحسّن، ولا تحجب شيئاً حين تغيب.
 */
export function useRevealOnView<T extends HTMLElement>() {
  const [shown, setShown] = useState(false)
  const observerRef = useRef<IntersectionObserver | null>(null)

  /* مرجعٌ دالّة لا كائن: العنصر قد يُركَّب متأخّراً — بعد أن يصل المسار من
     الأرشيف مثلاً — فلو راقبنا مرةً واحدة عند التركيب لبقي بلا مراقب،
     ولظلّ المحتوى مخفيّاً إلى الأبد. هنا نبدأ المراقبة لحظة تعلّقه. */
  const ref = useCallback((node: T | null) => {
    observerRef.current?.disconnect()
    observerRef.current = null
    if (!node) return

    if (typeof IntersectionObserver === 'undefined'
      || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      setShown(true)
      return
    }

    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue
        setShown(true)
        observer.disconnect()
      }
    }, { rootMargin: '0px 0px -12% 0px', threshold: 0.08 })

    observer.observe(node)
    observerRef.current = observer
  }, [])

  /* حزامُ أمان: لو تعطّل المراقب لأي سبب، لا يبقى المحتوى محجوباً. */
  useEffect(() => {
    const timer = window.setTimeout(() => setShown(true), 1200)
    return () => { window.clearTimeout(timer); observerRef.current?.disconnect() }
  }, [])

  return { ref, shown }
}

const KIND_LABEL: Record<string, string> = {
  article: 'مقال', book: 'كتاب', paper: 'بحث محكّم', media: 'لقاء',
}

const STOP = new Set('من في على الى عن هذا هذه ذلك التي الذي مع كان كانت بين كل ما لا'.split(' '))

/* تطبيعٌ خفيف: يكفي لقياس التقارب، ولا يكلّف كخريطة المعرفة كاملة. */
const roots = (value = '') => new Set(String(value)
  .normalize('NFKC').replace(/ـ+/g, '').replace(/[\u064B-\u0652\u0670]/g, '')
  .replace(/[أإآٱ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه')
  .replace(/[^\p{L}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim().split(' ')
  .map((word) => word.replace(/^ال(?=.{3,})/u, '').replace(/(?:ات|ون|ين|ية|يه)$/u, ''))
  .filter((word) => word.length > 2 && !STOP.has(word)))

const shareCount = (left: Set<string>, right: Set<string>) => {
  let n = 0
  for (const item of left) if (right.has(item)) n += 1
  return n
}

/**
 * غصنان لمادةٍ بعينها — بلغة «اسأل المكتبة» نفسها: التنويع أولاً، وسببُ
 * الصلة مكتوبٌ تحت كلٍّ منهما.
 *
 * ولا تُبنى خريطة المعرفة هنا: بناؤها تربيعيٌّ على كل المواد، وثمنه على
 * هاتفٍ متوسط أغلى من أن يُدفع في صفحة قراءة. هذا مسحٌ خطّيٌّ للبذرة وحدها.
 */
export function useBranches(input: {
  seedTitle: string
  seedText?: string
  seedKind: string
  excludeSlug?: string
  articles: { slug: string; title: string; excerpt?: string; cat?: string }[]
  books: { slug: string; title: string; desc?: string }[]
  papers: { slug: string; title: string; titleAr?: string; abstractAr?: string; meta?: string }[]
  media?: { slug: string; title: string; topics?: string }[]
}) {
  const { seedTitle, seedText, seedKind, excludeSlug, articles, books, papers, media } = input
  const [branches, setBranches] = useState<Branch[]>([])

  useEffect(() => {
    if (!seedTitle) { setBranches([]); return }
    let on = true

    const build = () => {
      if (!on) return
      const seed = roots(`${seedTitle} ${seedText || ''}`)
      const seedTitleRoots = roots(seedTitle)
      if (seed.size < 2) { setBranches([]); return }

      type Candidate = Branch & { score: number }
      const found: Candidate[] = []
      const consider = (kind: string, slug: string, title: string, text: string, url: string) => {
        if (!slug || (kind === seedKind && slug === excludeSlug)) return
        const body = roots(`${title} ${text}`)
        const common = shareCount(seed, body)
        if (common < 3) return
        const titleCommon = shareCount(seedTitleRoots, roots(title))
        const cross = kind !== seedKind
        const why = titleCommon >= 2
          ? 'الفكرة نفسها، بعنوانٍ آخر'
          : cross ? 'الفكرة تمتدّ هنا في بابٍ آخر' : 'يلتقيان عند المحور نفسه'
        found.push({
          id: `${kind}:${slug}`,
          kind: KIND_LABEL[kind] || 'مادة',
          title, why, to: url,
          score: common + titleCommon * 4 + (cross ? 3 : 0),
        })
      }

      for (const a of articles) consider('article', a.slug, a.title, `${a.excerpt || ''} ${a.cat || ''}`, `/articles/${a.slug}`)
      for (const b of books) consider('book', b.slug, b.title, b.desc || '', `/publications/${b.slug}`)
      for (const r of papers) consider('paper', r.slug, r.titleAr || r.title, `${r.abstractAr || ''} ${r.meta || ''}`, `/research/${r.slug}`)
      for (const m of media || []) consider('media', m.slug, m.title, m.topics || '', `/media/${m.slug}`)

      found.sort((left, right) => right.score - left.score)
      /* التنويع أولاً: ما اختلف نوعه يسبق، كقانون «الفصل التالي». */
      const varied = found.filter((item) => item.kind !== (KIND_LABEL[seedKind] || ''))
      const pool = varied.length >= 2 ? varied : found
      const picked = pool.slice(0, 2).map(({ score: _score, ...branch }) => branch)
      /* سببان متطابقان تحت غصنين يقرأان كتكرارٍ لا كتعليل. الثاني يأخذ
         أقربَ سببٍ آخر يصفه بصدق. */
      if (picked.length === 2 && picked[0].why === picked[1].why) {
        picked[1] = {
          ...picked[1],
          why: picked[1].why === 'يلتقيان عند المحور نفسه'
            ? 'الفكرة تمتدّ هنا في بابٍ آخر'
            : 'يلتقيان عند المحور نفسه',
        }
      }
      setBranches(picked)
    }

    const win = window as unknown as {
      requestIdleCallback?: (cb: () => void, options?: { timeout: number }) => number
      cancelIdleCallback?: (handle: number) => void
    }
    const idle = win.requestIdleCallback
    const cancelIdle = win.cancelIdleCallback
    const handle = idle ? idle.call(window, build, { timeout: 1600 }) : window.setTimeout(build, 500)
    return () => {
      on = false
      if (idle && cancelIdle) cancelIdle.call(window, handle)
      else window.clearTimeout(handle)
    }
  }, [articles, books, excludeSlug, media, papers, seedKind, seedText, seedTitle])

  return branches
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
  variant = 'fork',
}: {
  items: Branch[]
  onOpen?: (branch: Branch) => void
  /* اللغة واحدة والصيغة تختلف، فلا يتكرّر المشهد نفسه من صفحةٍ لأخرى:
     fork  — شوكةٌ متناظرة تتفرّع من الجواب
     sprig — ساقٌ نازلة يخرج منها غصنان على عمقين مختلفين
     rail  — رفٌّ أفقيّ تتدلّى منه المادّتان */
  variant?: 'fork' | 'sprig' | 'rail'
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

  const thread = variant === 'rail'
    ? (
      <svg className="grove-thread grove-thread--rail" viewBox="0 0 520 40" preserveAspectRatio="none" aria-hidden="true">
        <path d="M124 6 L396 6" vectorEffect="non-scaling-stroke" />
        <path d="M124 6 L124 40" vectorEffect="non-scaling-stroke" />
        <path d="M396 6 L396 40" vectorEffect="non-scaling-stroke" />
        <circle cx="124" cy="6" r="2.4" />
        <circle cx="396" cy="6" r="2.4" />
      </svg>
    )
    : variant === 'sprig'
    ? null
    : (
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
    )

  return (
    <div className={`grove grove--${variant}${grown ? ' grove--grown' : ''}`}>
      {thread}

      <div className={`grove-slots${shown.length > 1 && variant !== 'sprig' ? '' : ' grove-slots--single'}`}>
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
