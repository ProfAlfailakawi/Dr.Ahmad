import { useEffect } from 'react'
import { getDb } from './firebase'

const memorySeen = new Set<string>()
const pendingWrites = new Map<string, Promise<boolean>>()

const normalizePath = (value: string) => {
  const trimmed = value.trim()
  if (!trimmed) return '/'
  const withSlash = trimmed.startsWith('/') ? trimmed : `/${trimmed}`
  return withSlash.length > 1 ? withSlash.replace(/\/+$/, '') : withSlash
}

export const encodeViewPath = (path: string) => encodeURIComponent(normalizePath(path))

const kuwaitDay = (date = new Date()) => {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Kuwait',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date)
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]))
  return `${value.year}-${value.month}-${value.day}`
}

export function viewDocumentIds(path: string, date = new Date()) {
  const encodedPath = encodeViewPath(path)
  return {
    total: `total:${encodedPath}`,
    day: `day:${kuwaitDay(date)}:${encodedPath}`,
  }
}

export type ParsedViewDocument = {
  kind: 'total' | 'day'
  path: string
  day?: string
}

export function parseViewDocumentId(id: string): ParsedViewDocument | null {
  try {
    if (id.startsWith('total:')) {
      return { kind: 'total', path: decodeURIComponent(id.slice('total:'.length)) }
    }
    if (id.startsWith('day:')) {
      const day = id.slice(4, 14)
      if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || id[14] !== ':') return null
      return { kind: 'day', day, path: decodeURIComponent(id.slice(15)) }
    }
  } catch {
    return null
  }
  return null
}

const wasSeen = (key: string) => {
  if (memorySeen.has(key)) return true
  try {
    return window.sessionStorage.getItem(key) === '1'
  } catch {
    return false
  }
}

const markSeen = (key: string) => {
  memorySeen.add(key)
  try {
    window.sessionStorage.setItem(key, '1')
  } catch {
    // الذاكرة المؤقتة أعلاه تمنع التكرار حتى إن حجب المتصفح sessionStorage.
  }
}

function incrementViewDocument(id: string, title: string): Promise<boolean> {
  const sessionKey = `view:${id}`
  if (wasSeen(sessionKey)) return Promise.resolve(true)
  const pending = pendingWrites.get(sessionKey)
  if (pending) return pending

  const write = (async () => {
    try {
      const db = await getDb()
      if (!db) return false
      const { doc, increment, serverTimestamp, setDoc, updateDoc } = await import('firebase/firestore')
      const ref = doc(db, 'views', id)

      try {
        await setDoc(ref, {
          count: increment(1),
          title,
          updatedAt: serverTimestamp(),
        }, { merge: true })
      } catch {
        // قواعد views تسمح بتثبيت العنوان عند الإنشاء فقط. إذا تغيّر عنوان
        // المحتوى لاحقاً، نزيد العدّاد من دون محاولة تعديل العنوان القديم.
        await updateDoc(ref, {
          count: increment(1),
          updatedAt: serverTimestamp(),
        })
      }

      markSeen(sessionKey)
      return true
    } catch {
      return false
    } finally {
      pendingWrites.delete(sessionKey)
    }
  })()

  pendingWrites.set(sessionKey, write)
  return write
}

/**
 * يسجل مشاهدة واحدة للمسار في الجلسة: إجمالي للمسار + عدّاد يومي بتوقيت الكويت.
 * لا يقرأ مستند views، ولذلك يعمل للزائر العام مع قواعد القراءة الخاصة بالمشرف.
 */
export function useTrackView(path: string, title: string, enabled = true) {
  useEffect(() => {
    if (!enabled || typeof window === 'undefined') return

    const normalizedPath = normalizePath(path)
    const safeTitle = title.trim().slice(0, 200) || normalizedPath
    const ids = viewDocumentIds(normalizedPath)
    const pathSessionKey = `view:path:${encodeViewPath(normalizedPath)}`
    if (wasSeen(pathSessionKey)) return

    void Promise.all([
      incrementViewDocument(ids.total, safeTitle),
      incrementViewDocument(ids.day, safeTitle),
    ]).then(([totalSaved, daySaved]) => {
      if (totalSaved && daySaved) markSeen(pathSessionKey)
    })
  }, [enabled, path, title])
}
