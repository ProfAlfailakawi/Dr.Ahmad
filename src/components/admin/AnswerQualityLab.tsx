import { useMemo, useState } from 'react'
import type { ArticleRecord } from '../../lib/cms'
import { toRoot } from '../../lib/dialect-lexicon'

const card = 'rounded-2xl border border-hair bg-canvas p-4 md:p-5'
const input = 'w-full rounded-xl border border-hair bg-canvas px-4 py-3 text-[.9rem] text-ink outline-none transition-colors placeholder:text-soft/60 focus:border-accent'

const STOP = new Set(['على','الى','إلى','من','في','عن','مع','هذا','هذه','ذلك','التي','الذي','هل','ما','لماذا','كيف','الدكتور','دكتور','احمد','أحمد','الفيلكاوي','شنو','ماذا'])
const roots = (value = '') => value
  .replace(/[ً-ْٰ]/g, '')
  .replace(/[أإآٱ]/g, 'ا')
  .replace(/ى/g, 'ي')
  .replace(/ة/g, 'ه')
  .replace(/[^\p{L}\p{N}\s]/gu, ' ')
  .toLowerCase()
  .split(/\s+/)
  .filter((word) => word.length > 2 && !STOP.has(word))
  .map(toRoot)

const CASES = [
  { question: 'ما أثر الذكاء الاصطناعي في التعليم؟', expected: ['ذكاء', 'تعليم'], mustAnswer: true },
  { question: 'شنو تأثير السوشيال ميديا على العيال؟', expected: ['تواصل', 'طفل'], mustAnswer: true },
  { question: 'كيف يفيد التلعيب في التعلّم؟', expected: ['تلعيب', 'تعلم'], mustAnswer: true },
  { question: 'هل التعليم عن بعد بديل كامل للمدرسة؟', expected: ['تعليم', 'بعد'], mustAnswer: true },
  { question: 'ما رأي الدكتور في علاج مرض نادر لم يكتب عنه؟', expected: [], mustAnswer: false },
] as const

type RankedSource = { slug: string; title: string; score: number }
type Result = { question: string; top: RankedSource[]; coverage: number; passed: boolean; note: string }

function evaluate(question: string, articles: ArticleRecord[], expected: readonly string[], mustAnswer: boolean): Result {
  const query = new Set(roots(question))
  const ranked = articles.map((article) => {
    const title = new Set(roots(article.title))
    const excerpt = new Set(roots(article.excerpt || ''))
    const body = roots(article.body || '')
    let score = 0
    for (const token of query) {
      if (title.has(token)) score += 7
      if (excerpt.has(token)) score += 4
      score += Math.min(4, body.filter((word) => word === token).length) * 0.65
    }
    return { slug: article.slug, title: article.title, score }
  }).filter((item) => item.score > 0).sort((a, b) => b.score - a.score).slice(0, 5)

  const sourceRoots = roots(ranked.map((item) => item.title).join(' '))
  const hitCount = expected.filter((term) => sourceRoots.includes(toRoot(term))).length
  const coverage = expected.length ? Math.round((hitCount / expected.length) * 100) : 100
  const confident = Boolean(ranked[0] && ranked[0].score >= 4)
  const passed = mustAnswer ? confident && coverage >= 50 : !confident
  return {
    question,
    top: ranked,
    coverage,
    passed,
    note: mustAnswer
      ? (confident ? 'وجد مصادر ذات صلة من الأرشيف.' : 'الاسترجاع ضعيف؛ يجب ألا تُصاغ إجابة واثقة.')
      : (confident ? 'اختبار الامتناع فشل: توجد مطابقة ضعيفة قد تُفهم كإجابة.' : 'امتنع كما ينبغي عند غياب مصدر كافٍ.'),
  }
}

export function AnswerQualityLab({ articles }: { articles: ArticleRecord[] }) {
  const [custom, setCustom] = useState('')
  const [runId, setRunId] = useState(0)
  const rows = useMemo(() => CASES.map((item) => evaluate(item.question, articles, item.expected, item.mustAnswer)), [articles, runId])
  const customRow = useMemo(() => custom.trim().length >= 3 ? evaluate(custom, articles, [], true) : null, [articles, custom, runId])
  const passed = rows.filter((row) => row.passed).length
  const score = rows.length ? Math.round((passed / rows.length) * 100) : 0

  return (
    <section className="grid gap-4" aria-labelledby="answer-quality-title">
      <div className={card}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-[.7rem] font-semibold text-accent">داخلي · لا يظهر للزائر</p>
            <h3 id="answer-quality-title" className="mt-1 font-display text-xl font-semibold text-ink">مختبر جودة «اسأل المكتبة»</h3>
            <p className="mt-2 max-w-2xl text-[.8rem] leading-relaxed text-soft">يفحص الاسترجاع، اللهجة، صلة المصادر، والامتناع عن الإجابة عند غياب دليل. لا يغيّر أي محتوى ولا ينشر شيئاً.</p>
          </div>
          <div className="text-left">
            <strong className="block font-display text-3xl text-ink">{score}%</strong>
            <span className="text-[.68rem] text-soft">{passed} من {rows.length} اجتازت</span>
          </div>
        </div>
        <button type="button" onClick={() => setRunId((value) => value + 1)} className="mt-4 rounded-full bg-accent px-5 py-2 text-[.76rem] font-semibold text-white hover:bg-accent-deep">أعد الفحص</button>
      </div>

      <div className="grid gap-3">
        {rows.map((row, index) => (
          <details key={`${row.question}-${index}`} className={card}>
            <summary className="flex cursor-pointer list-none items-start justify-between gap-4">
              <span className="min-w-0">
                <span className="block text-[.68rem] font-semibold text-accent">اختبار {index + 1}</span>
                <strong className="mt-1 block text-[.88rem] leading-relaxed text-ink">{row.question}</strong>
              </span>
              <span className={`shrink-0 rounded-full px-3 py-1 text-[.65rem] font-semibold ${row.passed ? 'bg-accent/10 text-accent' : 'border border-hair text-soft'}`}>{row.passed ? 'اجتاز' : 'يحتاج مراجعة'}</span>
            </summary>
            <div className="mt-4 border-t border-hair pt-4">
              <p className="text-[.76rem] leading-relaxed text-soft">{row.note} تغطية المفاهيم: {row.coverage}%.</p>
              {row.top.length > 0 ? (
                <ol className="mt-3 grid gap-2">
                  {row.top.slice(0, 3).map((source) => (
                    <li key={source.slug} className="flex items-baseline justify-between gap-3 text-[.76rem]">
                      <a href={`/articles/${source.slug}`} target="_blank" rel="noreferrer" className="text-ink hover:text-accent">{source.title}</a>
                      <span className="shrink-0 text-soft">{source.score.toFixed(1)}</span>
                    </li>
                  ))}
                </ol>
              ) : <p className="mt-3 text-[.76rem] text-soft">لا يوجد مصدر قوي، وهذا صحيح في اختبار الامتناع.</p>}
            </div>
          </details>
        ))}
      </div>

      <div className={card}>
        <label htmlFor="quality-custom-question" className="text-[.72rem] font-semibold text-accent">اختبار يدوي سريع</label>
        <input id="quality-custom-question" value={custom} onChange={(event) => setCustom(event.target.value)} className={`${input} mt-3`} placeholder="اكتب سؤالاً بصياغة حقيقية أو لهجة محلية" />
        {customRow && (
          <div className="mt-4 border-t border-hair pt-4">
            <p className="text-[.76rem] text-soft">أقوى المصادر الحالية:</p>
            <ol className="mt-2 grid gap-1.5">
              {customRow.top.slice(0, 5).map((source) => <li key={source.slug} className="text-[.78rem]"><a href={`/articles/${source.slug}`} target="_blank" rel="noreferrer" className="text-ink hover:text-accent">{source.title}</a></li>)}
            </ol>
            {!customRow.top.length && <p className="mt-2 text-[.78rem] text-soft">لا يوجد سند كافٍ؛ يجب أن يصرّح النظام بذلك بدلاً من التخمين.</p>}
          </div>
        )}
      </div>
    </section>
  )
}
