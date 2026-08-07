import { useCallback, useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { EASE } from './motion'
import { renderQuoteCard } from '../lib/quote-card'
import { SocialIcon } from './icons'

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

  const dataUrlToBlob = (value: string) => {
    const [header, encoded = ''] = value.split(',', 2)
    const mime = /^data:([^;]+)/.exec(header)?.[1] || 'image/png'
    const binary = atob(encoded)
    const bytes = new Uint8Array(binary.length)
    for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index)
    return new Blob([bytes], { type: mime })
  }

  const download = async () => {
    if (!img) return
    const blob = dataUrlToBlob(img)
    const file = new File([blob], 'اقتباس.png', { type: 'image/png' })
    const shareNavigator = navigator as Navigator & { canShare?: (data: ShareData) => boolean; standalone?: boolean }
    const isIos = /iP(?:hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
    const standalone = window.matchMedia?.('(display-mode: standalone)').matches || Boolean(shareNavigator.standalone)
    try {
      if ((isIos || standalone) && navigator.share && shareNavigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: 'بطاقة اقتباس' })
        return
      }
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = file.name
      link.style.display = 'none'
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.setTimeout(() => URL.revokeObjectURL(url), 30_000)
    } catch (reason) {
      if ((reason as DOMException)?.name === 'AbortError') return
      const url = URL.createObjectURL(blob)
      const opened = window.open(url, '_blank', 'noopener,noreferrer')
      if (!opened) URL.revokeObjectURL(url)
      else window.setTimeout(() => URL.revokeObjectURL(url), 60_000)
    }
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
            aria-label="اصنع بطاقة اقتباس"
            title="اصنع بطاقة اقتباس"
            className="absolute z-[215] flex h-11 w-11 items-center justify-center rounded-full bg-ink text-canvas shadow-[0_14px_34px_-14px_rgba(0,0,0,.6)]"
          >
            <SocialIcon name="Image" size={17} />
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
              <img decoding="async" src={img} alt="بطاقة اقتباس" className="w-full rounded-2xl shadow-[0_40px_80px_-30px_rgba(0,0,0,.7)]" />
              <div className="quote-card-controls mt-5 flex justify-center gap-3">
                <button type="button" onClick={() => void download()} aria-label="تنزيل الصورة" title="تنزيل الصورة" className="flex h-12 w-12 items-center justify-center rounded-full bg-accent text-canvas transition-colors hover:bg-accent-deep">
                  <SocialIcon name="Download" size={18} />
                </button>
                <button type="button" onClick={() => setImg(null)} aria-label="إغلاق الصورة" title="إغلاق الصورة" className="flex h-12 w-12 items-center justify-center rounded-full border-[1.5px] border-canvas/40 text-canvas transition-colors hover:border-canvas">
                  <SocialIcon name="Close" size={18} />
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
