import { useCallback, useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { EASE } from './motion'
import { renderQuoteCard } from '../lib/quote-card'

export function QuoteCard() {
  const [sel, setSel] = useState('')
  const [pos, setPos] = useState({ x: 0, y: 0 })
  const [img, setImg] = useState<string | null>(null)

  useEffect(() => {
    const onUp = () => {
      const s = window.getSelection()
      const text = s?.toString().trim() ?? ''
      if (text.length < 25 || text.length > 400 || !s?.rangeCount) {
        setSel('')
        return
      }
      // يجب أن يكون التحديد داخل نصّ المقال
      const node = s.anchorNode?.parentElement
      if (!node?.closest('.article-body')) {
        setSel('')
        return
      }
      const r = s.getRangeAt(0).getBoundingClientRect()
      setPos({ x: r.left + r.width / 2, y: r.top + window.scrollY - 14 })
      setSel(text)
    }
    document.addEventListener('mouseup', onUp)
    document.addEventListener('touchend', onUp)
    return () => {
      document.removeEventListener('mouseup', onUp)
      document.removeEventListener('touchend', onUp)
    }
  }, [])

  const make = useCallback(async () => {
    /* الرسم صار في src/lib/quote-card — تستعمله بطاقات الكتب أيضاً،
       فتبقى الهويّة واحدة أينما ظهر الاقتباس. */
    setImg(await renderQuoteCard(sel))
  }, [sel])

  const download = () => {
    if (!img) return
    const a = document.createElement('a')
    a.href = img
    a.download = 'اقتباس.png'
    a.click()
  }

  return (
    <>
      {/* زر يطفو فوق التحديد */}
      <AnimatePresence>
        {sel && !img && (
          <motion.button
            initial={{ opacity: 0, y: 6, scale: 0.94 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.94 }}
            transition={{ duration: 0.22, ease: EASE }}
            onClick={make}
            style={{ left: pos.x, top: pos.y, transform: 'translate(-50%,-100%)' }}
            className="absolute z-[215] whitespace-nowrap rounded-full bg-ink px-5 py-2.5 text-[.84rem] font-semibold text-canvas shadow-[0_14px_34px_-14px_rgba(0,0,0,.6)]"
          >
            ✦ اصنع بطاقة اقتباس
          </motion.button>
        )}
      </AnimatePresence>

      {/* المعاينة */}
      <AnimatePresence>
        {img && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="reader-modal-overlay quote-card-overlay fixed inset-0 z-[260] flex items-start justify-center overflow-y-auto bg-ink/70 p-5 backdrop-blur-sm"
            onClick={() => setImg(null)}
          >
            <motion.div
              initial={{ scale: 0.94, y: 14 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.96 }}
              transition={{ duration: 0.35, ease: EASE }}
              onClick={(e) => e.stopPropagation()}
              className="quote-card-dialog w-full max-w-[440px]"
            >
              <img src={img} alt="بطاقة اقتباس" className="w-full rounded-2xl shadow-[0_40px_80px_-30px_rgba(0,0,0,.7)]" />
              <div className="quote-card-controls mt-5 flex justify-center gap-3">
                <button onClick={download} className="rounded-full bg-accent px-7 py-3 font-semibold text-canvas transition-colors hover:bg-accent-deep">
                  تحميل الصورة
                </button>
                <button onClick={() => setImg(null)} className="rounded-full border-[1.5px] border-canvas/40 px-7 py-3 font-semibold text-canvas transition-colors hover:border-canvas">
                  إغلاق
                </button>
              </div>
              <p className="mt-4 text-center text-[.82rem] text-canvas/70">1080×1080 — جاهزة لإنستغرام و X</p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
