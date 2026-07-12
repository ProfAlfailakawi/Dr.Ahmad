/* فكرتان تفاعليتان بروح الموقع (أحادية اللون، بلا تلوث بصري):
   ١) خيط الفكرة: حدّد أي نصّ في المقال → تظهر كل المقالات التي لامست الفكرة نفسها عبر السنوات.
   ٢) بطاقة اقتباس: صورة أنيقة قابلة للتنزيل بجملة منتقاة + اسم الدكتور، للمشاركة الراقية. */
import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'

type Art = { slug: string; title: string; iso: string; cat: string; excerpt?: string; body?: string }

/* ── تطبيع عربي بسيط + كلمات دالة تُستبعد ── */
const AR_STOP = new Set(['من', 'في', 'على', 'إلى', 'عن', 'أن', 'إن', 'ما', 'لا', 'هذا', 'هذه', 'التي', 'الذي', 'مع', 'أو', 'ثم', 'قد', 'كل', 'بين', 'هو', 'هي', 'كان', 'كانت', 'لكن', 'حتى', 'إذا', 'عند', 'بعد', 'قبل', 'كما', 'لأن', 'حين', 'كيف', 'لماذا', 'أم', 'بل', 'قد', 'نحن', 'هم', 'أنت', 'أنا', 'به', 'له', 'لها', 'فيه', 'فيها', 'ذلك', 'تلك', 'أي', 'كذلك', 'أيضا', 'دون', 'غير', 'عبر', 'خلال', 'حول', 'نحو'])
const norm = (s: string) => s.replace(/[ًٌٍَُِّْـ]/g, '').replace(/[أإآٱ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه').replace(/ؤ/g, 'و').replace(/ئ/g, 'ي')
const tokens = (s: string) => norm(s).replace(/[^ء-ي\s]/g, ' ').split(/\s+/)
  .map((w) => w.replace(/^(وال|فال|بال|كال|ال|و|ف|ب|ل|ك)/, '')).filter((w) => w.length >= 4 && !AR_STOP.has(w))

const ar = (n: number) => String(n).replace(/[0-9]/g, (d) => '٠١٢٣٤٥٦٧٨٩'[+d])

/* ═══════════ ١) خيط الفكرة ═══════════ */
export function IdeaThread({ current, articles }: { current: Art; articles: Art[] }) {
  const [sel, setSel] = useState('')
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const onUp = () => {
      const s = window.getSelection()
      const text = s?.toString().trim() || ''
      const within = s && s.anchorNode && (s.anchorNode.parentElement?.closest('.article-body'))
      if (text && within && tokens(text).length >= 2) {
        const range = s!.getRangeAt(0).getBoundingClientRect()
        setSel(text)
        setPos({ x: range.left + range.width / 2, y: range.top - 8 })
      } else if (!open) { setPos(null) }
    }
    document.addEventListener('mouseup', onUp)
    document.addEventListener('touchend', onUp)
    return () => { document.removeEventListener('mouseup', onUp); document.removeEventListener('touchend', onUp) }
  }, [open])

  // مطابقة: تقاطع الكلمات الدالة بين التحديد وبقية المقالات، مرتّبة زمنياً
  const seed = new Set(tokens(sel))
  const matches = articles
    .filter((a) => a.slug !== current.slug)
    .map((a) => {
      const bag = new Set(tokens(`${a.title} ${a.excerpt || ''}`))
      let overlap = 0; const shared: string[] = []
      for (const t of seed) if (bag.has(t)) { overlap++; shared.push(t) }
      return { a, overlap, shared }
    })
    .filter((m) => m.overlap >= 1)
    .sort((x, y) => y.overlap - x.overlap || (y.a.iso).localeCompare(x.a.iso))
    .slice(0, 6)
    .sort((x, y) => x.a.iso.localeCompare(y.a.iso))

  return (
    <>
      {/* زر عائم صغير فوق التحديد */}
      <AnimatePresence>
        {pos && !open && sel && (
          <motion.button
            type="button"
            initial={{ opacity: 0, y: 6, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ duration: 0.18 }}
            onClick={() => setOpen(true)}
            style={{ left: pos.x, top: pos.y, transform: 'translate(-50%, -100%)' }}
            className="fixed z-[260] flex items-center gap-1.5 rounded-full border border-accent bg-canvas px-3.5 py-1.5 text-[.78rem] font-semibold text-accent shadow-sm transition-colors hover:bg-accent hover:text-canvas"
          >
            🧬 هذه الفكرة عبر السنوات
          </motion.button>
        )}
      </AnimatePresence>

      {/* لوحة الخيط */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[300] flex items-end justify-center bg-ink/40 backdrop-blur-sm sm:items-center"
            onClick={() => setOpen(false)}
          >
            <motion.div
              initial={{ y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 20, opacity: 0 }}
              transition={{ duration: 0.28 }}
              onClick={(e) => e.stopPropagation()}
              className="max-h-[82vh] w-full max-w-xl overflow-y-auto rounded-t-3xl border border-hair bg-canvas p-6 sm:rounded-3xl md:p-8"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[.74rem] font-semibold uppercase tracking-wide text-accent">🧬 خيط الفكرة</p>
                  <p className="mt-2 border-r-2 border-accent pe-0 ps-4 text-[.95rem] font-light leading-[1.9] text-ink/80">«{sel.length > 140 ? sel.slice(0, 140) + '…' : sel}»</p>
                </div>
                <button type="button" onClick={() => setOpen(false)} aria-label="إغلاق" className="shrink-0 text-soft transition-colors hover:text-accent">✕</button>
              </div>

              <div className="mt-6 border-t border-hair pt-6">
                {matches.length ? (
                  <ol className="relative space-y-5 before:absolute before:bottom-2 before:right-[6px] before:top-2 before:w-px before:bg-hair">
                    {matches.map(({ a, overlap }) => (
                      <li key={a.slug} className="relative pe-0 ps-6">
                        <span className="absolute right-0 top-[.4em] h-3 w-3 rounded-full border-2 border-accent bg-canvas" />
                        <span className="text-[.72rem] font-semibold text-accent">{ar(Number(a.iso.slice(0, 4)))}</span>
                        <Link to={`/articles/${a.slug}`} onClick={() => setOpen(false)} className="mt-0.5 block font-display text-[1.02rem] font-medium leading-[1.6] text-ink transition-colors hover:text-accent">
                          {a.title}
                        </Link>
                        <span className="mt-1 block text-[.72rem] text-soft">{a.cat} · {ar(overlap)} {overlap === 1 ? 'صلة' : 'صلات'} مشتركة</span>
                      </li>
                    ))}
                  </ol>
                ) : (
                  <p className="text-[.9rem] font-light leading-relaxed text-soft">لم أعثر على مقالٍ آخر يلامس هذه الفكرة بعد — لعلّها فكرة بِكر في أرشيفك.</p>
                )}
              </div>
              <p className="mt-6 text-[.72rem] leading-relaxed text-soft/80">حدّد أي جملة في المقال لتتبّع فكرتها عبر عشر سنوات من الكتابة.</p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}

/* ═══════════ ٢) بطاقة اقتباس للمشاركة ═══════════ */
function firstStrongSentence(body?: string, excerpt?: string) {
  const src = (body || excerpt || '').replace(/\s+/g, ' ').trim()
  const parts = src.split(/(?<=[.!؟])\s/).filter((s) => s.split(/\s+/).length >= 6)
  return (parts[0] || excerpt || '').slice(0, 220)
}

export function ShareQuoteCard({ title, body, excerpt }: { title: string; body?: string; excerpt?: string }) {
  const [open, setOpen] = useState(false)
  const [url, setUrl] = useState('')
  const canvasRef = useRef<HTMLCanvasElement>(null)

  const draw = (quote: string) => {
    const c = canvasRef.current
    if (!c) return
    const S = 1080
    c.width = S; c.height = S
    const ctx = c.getContext('2d')!
    // خلفية أحادية هادئة
    ctx.fillStyle = '#faf9f7'; ctx.fillRect(0, 0, S, S)
    ctx.strokeStyle = 'rgba(62,92,120,0.25)'; ctx.lineWidth = 2
    ctx.strokeRect(48, 48, S - 96, S - 96)
    // علامة اقتباس كبيرة
    ctx.fillStyle = 'rgba(62,92,120,0.18)'; ctx.font = 'bold 220px Georgia, serif'
    ctx.textAlign = 'right'; ctx.fillText('”', S - 96, 260)
    // النص (RTL، لفّ يدوي)
    ctx.direction = 'rtl'; ctx.textAlign = 'right'; ctx.fillStyle = '#2b3440'
    ctx.font = '600 46px "Noto Kufi Arabic", "Segoe UI", Tahoma, sans-serif'
    const words = quote.split(/\s+/); const maxW = S - 200; const lines: string[] = []
    let line = ''
    for (const w of words) {
      const test = line ? line + ' ' + w : w
      if (ctx.measureText(test).width > maxW && line) { lines.push(line); line = w } else line = test
    }
    if (line) lines.push(line)
    const lh = 74; const startY = S / 2 - (lines.length * lh) / 2 + 40
    lines.slice(0, 6).forEach((ln, i) => ctx.fillText(ln, S - 100, startY + i * lh))
    // خط أكسنت + التوقيع
    ctx.strokeStyle = '#3E5C78'; ctx.lineWidth = 4
    ctx.beginPath(); ctx.moveTo(S - 100, S - 190); ctx.lineTo(S - 240, S - 190); ctx.stroke()
    ctx.fillStyle = '#3E5C78'; ctx.font = '700 34px "Noto Kufi Arabic", sans-serif'
    ctx.fillText('د. أحمد حسين الفيلكاوي', S - 100, S - 130)
    ctx.fillStyle = 'rgba(43,52,64,0.55)'; ctx.font = '400 26px "Noto Kufi Arabic", sans-serif'
    ctx.fillText('dr-alfailakawi.web.app', S - 100, S - 88)
    setUrl(c.toDataURL('image/png'))
  }

  const openCard = () => {
    const s = window.getSelection()?.toString().trim()
    const quote = (s && s.split(/\s+/).length >= 5) ? s : firstStrongSentence(body, excerpt)
    setOpen(true)
    setTimeout(() => draw(quote.replace(/\s+/g, ' ').trim()), 30)
  }

  return (
    <>
      <button
        type="button"
        onClick={openCard}
        className="mt-4 inline-flex items-center gap-2 rounded-full border border-hair px-4 py-2 text-[.82rem] text-soft transition-colors hover:border-accent hover:text-accent"
      >
        🖼 شارك كبطاقة اقتباس
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[300] flex items-center justify-center bg-ink/50 p-4 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.94, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.94, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md rounded-3xl border border-hair bg-canvas p-6"
            >
              <div className="flex items-center justify-between">
                <p className="text-[.74rem] font-semibold uppercase text-accent">بطاقة اقتباس</p>
                <button type="button" onClick={() => setOpen(false)} aria-label="إغلاق" className="text-soft hover:text-accent">✕</button>
              </div>
              <div className="mt-4 overflow-hidden rounded-2xl border border-hair">
                <canvas ref={canvasRef} className="block h-auto w-full" />
              </div>
              <div className="mt-4 flex flex-wrap gap-3">
                {url && (
                  <a href={url} download={`اقتباس-${title.slice(0, 30)}.png`} className="rounded-full bg-accent px-6 py-2.5 text-[.86rem] font-semibold text-canvas transition-colors hover:bg-accent-deep">
                    ⬇ تنزيل الصورة
                  </a>
                )}
                <span className="self-center text-[.74rem] text-soft">حدّد جملة قبل الضغط لتصنع بطاقة منها.</span>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
