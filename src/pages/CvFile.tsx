import { useEffect, useState } from 'react'
import { useParams } from 'react-router'
import { getDb } from '../lib/firebase'

type CvFileMetadata = {
  version?: string
  size?: number
  chunkSize?: number
  chunkCount?: number
  sha256?: string
  fileName?: string
}

const cacheName = 'cv-files-v1'

function chunkId(version: string, index: number) {
  return `${version}-${String(index).padStart(4, '0')}`
}

async function cachedPdf(kind: 'ar' | 'en', version: string) {
  if (!('caches' in window)) return null
  try {
    const cache = await caches.open(cacheName)
    const response = await cache.match(new Request(`${window.location.origin}/__cv-cache/${kind}/${version}`))
    return response?.ok ? response.blob() : null
  } catch {
    return null
  }
}

async function rememberPdf(kind: 'ar' | 'en', version: string, blob: Blob) {
  if (!('caches' in window)) return
  try {
    const cache = await caches.open(cacheName)
    await cache.put(
      new Request(`${window.location.origin}/__cv-cache/${kind}/${version}`),
      new Response(blob, { headers: { 'content-type': 'application/pdf', 'cache-control': 'public,max-age=31536000,immutable' } }),
    )
  } catch {
    // التخزين المؤقت تحسين فقط؛ لا يمنع فتح السيرة.
  }
}

export default function CvFile() {
  const { kind: rawKind } = useParams()
  const kind: 'ar' | 'en' = rawKind === 'en' ? 'en' : 'ar'
  const [status, setStatus] = useState<'loading' | 'error'>('loading')
  const fallback = kind === 'ar' ? '/files/cv.pdf' : '/files/cv-en.pdf'

  useEffect(() => {
    let active = true
    let objectUrl = ''
    ;(async () => {
      try {
        const db = await getDb()
        if (!db) {
          window.location.replace(fallback)
          return
        }
        const firestore = await import('firebase/firestore')
        const fileRef = firestore.doc(db, 'site_cv_files', kind)
        const snapshot = await firestore.getDoc(fileRef)
        if (!snapshot.exists()) {
          window.location.replace(fallback)
          return
        }
        const metadata = snapshot.data() as CvFileMetadata
        const version = String(metadata.version || '')
        const size = Number(metadata.size || 0)
        const chunkCount = Number(metadata.chunkCount || 0)
        if (!version || !Number.isSafeInteger(size) || size <= 0 || size > 30 * 1024 * 1024
          || !Number.isSafeInteger(chunkCount) || chunkCount <= 0 || chunkCount > 100) {
          throw new Error('بيانات ملف السيرة غير مكتملة.')
        }

        let blob = await cachedPdf(kind, version)
        if (!blob || blob.size !== size) {
          const chunks = firestore.collection(fileRef, 'chunks')
          const parts: Uint8Array[] = []
          for (let offset = 0; offset < chunkCount; offset += 10) {
            const group = Array.from({ length: Math.min(10, chunkCount - offset) }, (_, relative) => offset + relative)
            const docs = await Promise.all(group.map((index) => firestore.getDoc(firestore.doc(chunks, chunkId(version, index)))))
            for (const docSnapshot of docs) {
              if (!docSnapshot.exists()) throw new Error('أحد أجزاء ملف السيرة مفقود.')
              const data = docSnapshot.data()?.data as { toUint8Array?: () => Uint8Array } | undefined
              const bytes = data?.toUint8Array?.()
              if (!bytes?.length) throw new Error('أحد أجزاء ملف السيرة غير صالح.')
              parts.push(bytes)
            }
          }
          const total = parts.reduce((sum, part) => sum + part.length, 0)
          if (total !== size) throw new Error('حجم ملف السيرة غير متطابق.')
          const merged = new Uint8Array(total)
          let cursor = 0
          for (const part of parts) {
            merged.set(part, cursor)
            cursor += part.length
          }
          if (String.fromCharCode(...merged.slice(0, 5)) !== '%PDF-') throw new Error('الملف المحفوظ ليس PDF صحيحاً.')
          blob = new Blob([merged], { type: 'application/pdf' })
          await rememberPdf(kind, version, blob)
        }

        if (!active) return
        objectUrl = URL.createObjectURL(blob)
        window.location.replace(objectUrl)
      } catch {
        /* داخل الـPWA قد يفشل Firestore أو Cache Storage لحظياً. لا نحبس
           الزائر في شاشة وسيطة: نفتح النسخة الأساسية مباشرةً، وتبقى شاشة
           الخطأ احتياطاً فقط إن منع النظام الانتقال نفسه. */
        if (active) {
          window.location.replace(fallback)
          window.setTimeout(() => { if (active) setStatus('error') }, 1200)
        }
      }
    })()
    return () => {
      active = false
      if (objectUrl) window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000)
    }
  }, [fallback, kind])

  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-canvas px-6" dir={kind === 'ar' ? 'rtl' : 'ltr'}>
      <div className="max-w-md text-center">
        {status === 'loading' ? (
          <>
            <span className="mx-auto block h-8 w-8 animate-spin rounded-full border-2 border-hair border-t-accent" aria-hidden="true" />
            <p className="mt-5 font-display text-[1.05rem] font-semibold text-ink">{kind === 'ar' ? 'جارٍ تجهيز السيرة الذاتية…' : 'Preparing the CV…'}</p>
            <p className="mt-2 text-[.78rem] leading-relaxed text-soft">{kind === 'ar' ? 'ستفتح نسخة PDF تلقائياً.' : 'The PDF will open automatically.'}</p>
          </>
        ) : (
          <>
            <p className="font-display text-[1.08rem] font-semibold text-ink">{kind === 'ar' ? 'تعذّر تجهيز النسخة المحدثة.' : 'The updated CV could not be prepared.'}</p>
            <a href={fallback} className="mt-5 inline-flex rounded-full bg-accent px-6 py-3 text-[.82rem] font-semibold text-white">{kind === 'ar' ? 'فتح النسخة الأساسية' : 'Open the built-in copy'}</a>
          </>
        )}
      </div>
    </div>
  )
}
