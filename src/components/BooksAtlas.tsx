import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import { allBookKnowledge } from '../lib/book-knowledge'

/**
 * خريطة العقل التسعة — الجسور بين الكتب.
 *
 * الكتب التسعة تُعرض عادةً كقائمة أغلفة: تسعة منتجات متجاورة. وهذه الخريطة
 * تُظهر البنية بدلاً من الرصف — أي مفهومٍ يعبر أكثر من كتاب، وكم كتاباً يحمله.
 * كل بياناتها مشتقّة من المتون المفهرسة، فلا تحتاج سطراً واحداً من محتوى جديد.
 *
 * جمالياً: قسمٌ واحد هادئ، مطويّ افتراضياً، بلا رسمٍ متحرك ولا ألوان جديدة —
 * فالغرض إظهار الترابط لا مزاحمة الأغلفة.
 */

const normalize = (value = '') => value
  .normalize('NFKC').replace(/ـ+/g, '').replace(/[ً-ْٰ]/g, '')
  .replace(/[أإآٱ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه')
  .replace(/^ال(?=.{3,})/, '')
  .trim()

/* ألفاظٌ تعبر كل الكتب فلا تدلّ على جسرٍ خاص — «التعليم» في تسعة كتبٍ عن
   التعليم ليست اكتشافاً. نستبعدها ليظهر ما يميّز فعلاً. */
const TOO_COMMON = new Set([
  'تعليم', 'تعلم', 'تكنولوجيا', 'رقمي', 'رقميه', 'معلومات', 'استخدام', 'تعليميه', 'الكترونيه',
])

/* ألفاظ بنية الكتاب لا معناه: «المراجع» و«الخاتمة» تعبر الكتب كلها لأنها
   أجزاء من أي كتاب، لا لأنها فكرةٌ تشغل الدكتور. عرضها ضجيجٌ بصري. */
const STRUCTURAL = new Set([
  'مراجع', 'خاتمه', 'مقدمه', 'فصل', 'فصول', 'باب', 'ابواب', 'محتويات', 'فهرس',
  'اساسيه', 'اساسي', 'عامه', 'عام', 'دراسي', 'دراسيه', 'عمليه', 'عمليات',
  'ملخص', 'توصيات', 'نتائج', 'مصادر', 'موضوع', 'موضوعات', 'جزء', 'قسم',
  'تطوير', 'عالم', 'اداره',
  /* أوصافٌ وكمّيات لا مفاهيم: «المختلفة» و«جميع» تعبر كل كتابٍ في العربية. */
  'مختلفه', 'جميع', 'خاصه', 'كثير', 'بعض', 'جديده', 'حديثه', 'مناسبه', 'معينه',
  'وسايل', 'اهداف', 'جامعه', 'كبير', 'افضل',
])

type Bridge = { term: string; books: { slug: string; title: string }[] }

export function BooksAtlas() {
  const [active, setActive] = useState('')

  const bridges = useMemo(() => {
    const carriers = new Map<string, { term: string; books: Map<string, string> }>()

    for (const book of allBookKnowledge) {
      /* المصطلحات المحورية للكتاب + عناوين محاوره: كلاهما يكشف ما يشغله. */
      const terms = new Set<string>()
      for (const term of book.topTerms) terms.add(term)
      for (const concept of book.concepts) for (const keyword of concept.keywords) terms.add(keyword)

      for (const term of terms) {
        const key = normalize(term)
        if (key.length < 4 || TOO_COMMON.has(key) || STRUCTURAL.has(key)) continue
        if (!carriers.has(key)) carriers.set(key, { term, books: new Map() })
        carriers.get(key)!.books.set(book.slug, book.title)
      }
    }

    return [...carriers.values()]
      .map(({ term, books }): Bridge => ({ term, books: [...books].map(([slug, title]) => ({ slug, title })) }))
      /* الجسر يبدأ من كتابين: ما انفرد به كتابٌ واحد ليس عبوراً. */
      .filter((bridge) => bridge.books.length >= 3)
      .sort((left, right) => right.books.length - left.books.length || left.term.localeCompare(right.term, 'ar'))
      .slice(0, 18)
  }, [])

  const activeBridge = bridges.find((bridge) => bridge.term === active) || null

  if (bridges.length < 3) return null

  return (
    <section className="border-t border-hair px-6 py-14 md:px-11 md:py-16" aria-labelledby="books-atlas-title">
      <div className="mx-auto max-w-shell">
        <details className="group">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-4">
            <span className="min-w-0">
              <span className="block text-[.7rem] font-semibold uppercase tracking-[.08em] text-accent">خريطة المؤلَّفات</span>
              <strong id="books-atlas-title" className="mt-2 block font-display text-[clamp(1.4rem,2.6vw,1.95rem)] font-semibold leading-[1.35] text-ink">
                المفاهيم التي تعبر أكثر من كتاب
              </strong>
              <span className="mt-2 block max-w-2xl text-[.82rem] leading-[1.8] text-soft">
                الكتب التسعة ليست تسعة موضوعات منفصلة؛ بينها مفاهيم تتكرّر وتتطوّر. هذه المفاهيم مستخرجة من المتون نفسها.
              </span>
            </span>
            <span aria-hidden="true" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-hair text-accent transition-transform group-open:rotate-45">+</span>
          </summary>

          <div className="mt-7 border-t border-hair pt-6">
            <div className="flex flex-wrap gap-2" aria-label="مفاهيم عابرة بين الكتب">
              {bridges.map((bridge) => {
                const on = active === bridge.term
                return (
                  <button
                    key={bridge.term}
                    type="button"
                    onClick={() => setActive(on ? '' : bridge.term)}
                    aria-pressed={on}
                    className={`rounded-full border px-3.5 py-2 text-[.72rem] transition-colors ${on ? 'border-accent bg-accent/[.07] font-semibold text-accent' : 'border-hair bg-wash text-ink hover:border-accent/40'}`}
                  >
                    {bridge.term}
                    <span className="mr-2 text-[.64rem] text-soft">{bridge.books.length}</span>
                  </button>
                )
              })}
            </div>

            {activeBridge && (
              <div className="mt-6 rounded-2xl border border-hair bg-wash px-4 py-4 sm:px-5">
                <p className="text-[.78rem] leading-relaxed text-soft">
                  «{activeBridge.term}» يعبر <strong className="text-ink">{activeBridge.books.length}</strong> من كتبه:
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {activeBridge.books.map((item) => (
                    <Link
                      key={item.slug}
                      to={`/publications/${item.slug}#book-knowledge`}
                      className="rounded-full border border-hair bg-canvas px-3 py-1.5 text-[.7rem] text-ink transition-colors hover:border-accent hover:text-accent"
                    >
                      {item.title}
                    </Link>
                  ))}
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Link
                    to={`/concept/${encodeURIComponent(activeBridge.term)}`}
                    className="inline-flex rounded-full border border-accent/[.35] px-4 py-2 text-[.72rem] font-semibold text-accent transition-colors hover:bg-accent hover:text-white"
                  >
                    سيرة هذا المفهوم عبر السنوات ←
                  </Link>
                  <Link
                    to={`/search?q=${encodeURIComponent(activeBridge.term)}&tab=passage`}
                    className="inline-flex rounded-full border border-hair px-4 py-2 text-[.72rem] font-semibold text-ink transition-colors hover:border-accent hover:text-accent"
                  >
                    اقرأ ما قاله عنه في المتون
                  </Link>
                </div>
              </div>
            )}
          </div>
        </details>
      </div>
    </section>
  )
}
