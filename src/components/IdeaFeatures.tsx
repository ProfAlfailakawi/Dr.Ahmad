/* أداة تحديدٍ واحدة أنيقة (أحادية اللون، بلا تلوث بصري): تظهر عند تظليل أي جملةٍ في المقال،
   وتقدّم فعلين متباعدين في شريطٍ واحد لا يتداخلان:
   ١) 🧬 خيط الفكرة: كل المقالات التي لامست الفكرة نفسها عبر السنوات.
   ٢) 🖼 بطاقة اقتباس: صورة أنيقة بجملةٍ منتقاة + توقيع الدكتور، للمشاركة الراقية. */
import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'

type Art = { slug: string; title: string; iso: string; cat: string; excerpt?: string; body?: string }

/* ── تطبيع عربي بسيط + كلمات دالة تُستبعد ── */
const AR_STOP = new Set(['من', 'في', 'على', 'إلى', 'عن', 'أن', 'إن', 'ما', 'لا', 'هذا', 'هذه', 'التي', 'الذي', 'مع', 'أو', 'ثم', 'قد', 'كل', 'بين', 'هو', 'هي', 'كان', 'كانت', 'لكن', 'حتى', 'إذا', 'عند', 'بعد', 'قبل', 'كما', 'لأن', 'حين', 'كيف', 'لماذا', 'أم', 'بل', 'نحن', 'هم', 'أنت', 'أنا', 'به', 'له', 'لها', 'فيه', 'فيها', 'ذلك', 'تلك', 'أي', 'كذلك', 'أيضا', 'دون', 'غير', 'عبر', 'خلال', 'حول', 'نحو'])
const norm = (s: string) => s.replace(/[ًٌٍَُِّْـ]/g, '').replace(/[أإآٱ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه').replace(/ؤ/g, 'و').replace(/ئ/g, 'ي')
const tokens = (s: string) => norm(s).replace(/[^ء-ي\s]/g, ' ').split(/\s+/)
  .map((w) => w.replace(/^(وال|فال|بال|كال|ال|و|ف|ب|ل|ك)/, '')).filter((w) => w.length >= 4 && !AR_STOP.has(w))

const ar = (n: number) => String(n)

/* ── بطاقة الاقتباس: رسمٌ أحادي اللون واعٍ بالوضع الداكن ── */
const W = 1080
function drawQuote(quote: string, dark: boolean): string {
  const c = document.createElement('canvas')
  c.width = W; c.height = W
  const g = c.getContext('2d')!
  const bg = dark ? '#111215' : '#FCFCFA'
  const ink = dark ? '#EAEAE7' : '#15161A'
  const accent = dark ? '#8AADCC' : '#3E5C78'
  const soft = dark ? '#8A8F98' : '#7C818B'
  g.fillStyle = bg; g.fillRect(0, 0, W, W)
  const grad = g.createRadialGradient(W * 0.82, W * 0.2, 40, W * 0.82, W * 0.2, 620)
  grad.addColorStop(0, accent + '22'); grad.addColorStop(1, accent + '00')
  g.fillStyle = grad; g.fillRect(0, 0, W, W)
  g.strokeStyle = accent + '30'; g.lineWidth = 2; g.strokeRect(56, 56, W - 112, W - 112)
  g.fillStyle = accent + '2e'; g.font = '700 220px "El Messiri", serif'; g.textAlign = 'right'
  g.fillText('”', W - 104, 250)
  const size = quote.length > 260 ? 40 : quote.length > 170 ? 48 : quote.length > 90 ? 56 : 64
  g.font = `300 ${size}px "El Messiri", serif`; g.fillStyle = ink; g.textAlign = 'right'; g.direction = 'rtl'
  const maxW = W - 220; const words = quote.split(/\s+/); const lines: string[] = []; let line = ''
  for (const w of words) {
    const test = line ? line + ' ' + w : w
    if (g.measureText(test).width > maxW && line) { lines.push(line); line = w } else line = test
  }
  if (line) lines.push(line)
  const lh = size * 1.72; let y = W / 2 - ((lines.length - 1) * lh) / 2 - 20
  for (const l of lines.slice(0, 8)) { g.fillText(l, W - 110, y); y += lh }
  g.strokeStyle = accent; g.lineWidth = 3; g.beginPath(); g.moveTo(W - 110, W - 214); g.lineTo(W - 210, W - 214); g.stroke()
  g.font = '600 34px "Tajawal", sans-serif'; g.fillStyle = ink; g.fillText('د. أحمد حسين الفيلكاوي', W - 110, W - 152)
  g.font = '400 26px "Tajawal", sans-serif'; g.fillStyle = soft; g.fillText('dr-alfailakawi.web.app', W - 110, W - 106)
  return c.toDataURL('image/png')
}
function firstStrongSentence(body?: string, excerpt?: string) {
  const src = (body || excerpt || '').replace(/\s+/g, ' ').trim()
  const parts = src.split(/(?<=[.!؟])\s/).filter((s) => s.split(/\s+/).length >= 6)
  return (parts[0] || excerpt || '').slice(0, 220)
}

/* ═══════════ أداة التحديد الموحّدة ═══════════ */
export function SelectionTools({ current, articles, body, excerpt }: { current: Art; articles: Art[]; body?: string; excerpt?: string }) {
  const [sel, setSel] = useState('')
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null)
  const [view, setView] = useState<null | 'thread' | 'card'>(null)
  const [img, setImg] = useState<string | null>(null)

  useEffect(() => {
    const onUp = () => {
      if (view) return
      const s = window.getSelection()
      const text = s?.toString().trim() || ''
      const within = s && s.anchorNode && s.anchorNode.parentElement?.closest('.article-body')
      if (text.length >= 20 && text.length <= 400 && within && s!.rangeCount) {
        const range = s!.getRangeAt(0).getBoundingClientRect()
        setSel(text)
        setPos({ x: range.left + range.width / 2, y: range.top - 10 })
      } else { setPos(null) }
    }
    document.addEventListener('mouseup', onUp)
    document.addEventListener('touchend', onUp)
    return () => { document.removeEventListener('mouseup', onUp); document.removeEventListener('touchend', onUp) }
  }, [view])

  // مطابقة خيط الفكرة: تقاطع الكلمات الدالة، مرتّبة زمنياً
  const seed = new Set(tokens(sel))
  const matches = articles
    .filter((a) => a.slug !== current.slug)
    .map((a) => {
      const bag = new Set(tokens(`${a.title} ${a.excerpt || ''}`))
      let overlap = 0
      for (const t of seed) if (bag.has(t)) overlap++
      return { a, overlap }
    })
    .filter((m) => m.overlap >= 1)
    .sort((x, y) => y.overlap - x.overlap || y.a.iso.localeCompare(x.a.iso))
    .slice(0, 6)
    .sort((x, y) => x.a.iso.localeCompare(y.a.iso))

  const openCard = async () => {
    const quote = (sel.split(/\s+/).length >= 5 ? sel : firstStrongSentence(body, excerpt)).replace(/\s+/g, ' ').trim()
    setView('card'); setPos(null)
    try { await (document as unknown as { fonts?: { ready?: Promise<unknown> } }).fonts?.ready } catch { /* noop */ }
    setImg(drawQuote(quote, document.documentElement.classList.contains('dark')))
  }
  const close = () => { setView(null); setImg(null); setSel('') }

  return (
    <>
      {/* شريط واحد فوق التحديد — فعلان متباعدان بينهما فاصل، لا تداخل */}
      <AnimatePresence>
        {pos && !view && sel && (
          <motion.div
            initial={{ opacity: 0, y: 6, scale: 0.94 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.94 }}
            transition={{ duration: 0.18 }}
            style={{ left: pos.x, top: pos.y, transform: 'translate(-50%,-100%)' }}
            className="fixed z-[260] flex items-stretch overflow-hidden rounded-full border border-hair bg-canvas shadow-[0_16px_38px_-16px_rgba(0,0,0,.5)]"
          >
            <button type="button" onClick={() => setView('thread')} className="flex items-center gap-1.5 px-4 py-2 text-[.78rem] font-semibold text-ink transition-colors hover:bg-accent hover:text-canvas">
              🧬 عبر السنوات
            </button>
            <span className="my-1.5 w-px bg-hair" />
            <button type="button" onClick={openCard} className="flex items-center gap-1.5 px-4 py-2 text-[.78rem] font-semibold text-ink transition-colors hover:bg-accent hover:text-canvas">
              🖼 بطاقة اقتباس
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* لوحة خيط الفكرة */}
      <AnimatePresence>
        {view === 'thread' && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[300] flex items-end justify-center bg-ink/40 backdrop-blur-sm sm:items-center" onClick={close}
          >
            <motion.div
              initial={{ y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 20, opacity: 0 }}
              transition={{ duration: 0.28 }} onClick={(e) => e.stopPropagation()}
              className="max-h-[82vh] w-full max-w-xl overflow-y-auto rounded-t-3xl border border-hair bg-canvas p-6 sm:rounded-3xl md:p-8"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[.74rem] font-semibold uppercase tracking-wide text-accent">🧬 خيط الفكرة</p>
                  <p className="mt-2 border-r-2 border-accent pe-0 ps-4 text-[.95rem] font-light leading-[1.9] text-ink/80">«{sel.length > 140 ? sel.slice(0, 140) + '…' : sel}»</p>
                </div>
                <button type="button" onClick={close} aria-label="إغلاق" className="shrink-0 text-soft transition-colors hover:text-accent">✕</button>
              </div>
              <div className="mt-6 border-t border-hair pt-6">
                {matches.length ? (
                  <ol className="relative space-y-5 before:absolute before:bottom-2 before:right-[6px] before:top-2 before:w-px before:bg-hair">
                    {matches.map(({ a, overlap }) => (
                      <li key={a.slug} className="relative pe-0 ps-6">
                        <span className="absolute right-0 top-[.4em] h-3 w-3 rounded-full border-2 border-accent bg-canvas" />
                        <span className="text-[.72rem] font-semibold text-accent">{ar(Number(a.iso.slice(0, 4)))}</span>
                        <Link to={`/articles/${a.slug}`} onClick={close} className="mt-0.5 block font-display text-[1.02rem] font-medium leading-[1.6] text-ink transition-colors hover:text-accent">
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
              <p className="mt-6 text-[.72rem] leading-relaxed text-soft/80">حدّد أي جملة في المقال لتتبّع فكرتها عبر سنوات الكتابة.</p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* لوحة بطاقة الاقتباس */}
      <AnimatePresence>
        {view === 'card' && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[300] flex items-center justify-center bg-ink/60 p-5 backdrop-blur-sm" onClick={close}
          >
            <motion.div
              initial={{ scale: 0.94, y: 14 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.96, opacity: 0 }}
              transition={{ duration: 0.32 }} onClick={(e) => e.stopPropagation()} className="w-full max-w-[440px]"
            >
              {img ? (
                <img src={img} alt="بطاقة اقتباس" className="w-full rounded-2xl shadow-[0_40px_80px_-30px_rgba(0,0,0,.7)]" />
              ) : (
                <div className="flex aspect-square items-center justify-center rounded-2xl border border-hair bg-canvas text-soft">…</div>
              )}
              <div className="mt-5 flex justify-center gap-3">
                {img && (
                  <a href={img} download="اقتباس.png" className="rounded-full bg-accent px-7 py-3 font-semibold text-canvas transition-colors hover:bg-accent-deep">تحميل الصورة</a>
                )}
                <button type="button" onClick={close} className="rounded-full border-[1.5px] border-canvas/40 px-7 py-3 font-semibold text-canvas transition-colors hover:border-canvas">إغلاق</button>
              </div>
              <p className="mt-4 text-center text-[.82rem] text-canvas/70">1080×1080 — جاهزة لإنستغرام و X</p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
