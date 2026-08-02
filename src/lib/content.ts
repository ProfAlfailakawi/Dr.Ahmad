import {
  createContext,
  createElement,
  startTransition,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { firebaseEnabled, fetchExtras, getDb } from './firebase'
import { normalizeArabicTypography } from './arabic-typography'
import {
  baseCmsSnapshot,
  mergeCmsContent,
  type CmsSnapshot,
  type RemoteCmsData,
  type RemoteDocument,
} from './cms'

const normalizeArabicTanween = <T,>(value: T): T => {
  if (typeof value === 'string') return normalizeArabicTypography(value) as T
  if (Array.isArray(value)) return value.map((item) => normalizeArabicTanween(item)) as T
  if (value && typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype) {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([key, item]) => [key, normalizeArabicTanween(item)])) as T
  }
  return value
}

export interface ExtraArticle {
  id: string
  slug: string
  title: string
  date: string
  iso: string
  cat: string
  excerpt: string
  body?: string
  createdAt?: unknown
  source?: string
  url?: string
  audio?: { fahed?: boolean | string; noura?: boolean | string; dialogue?: boolean | string }
  audioControl?: { readingDisabled?: boolean; fahedDisabled?: boolean; nouraDisabled?: boolean; dialogueDisabled?: boolean; readingStatus?: string; fahedStatus?: string; nouraStatus?: string; dialogueStatus?: string }
}

type ExtrasOptions = { realtime?: boolean }
export type ExtrasResource<T> = {
  data: T[]
  loading: boolean
  refreshing: boolean
  error: boolean
  fromCache: boolean
}

type ExtrasCacheEnvelope = { savedAt: number; data: unknown[] }
const EXTRAS_CACHE_PREFIX = 'site:extras-cache:v3:'
const EXTRAS_CACHE_MAX_AGE = 45 * 24 * 60 * 60 * 1000

const extrasCacheKey = (collectionName: string) => `${EXTRAS_CACHE_PREFIX}${collectionName}`

function readExtrasCache<T>(collectionName: string): T[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(extrasCacheKey(collectionName))
    if (!raw) return []
    const parsed = JSON.parse(raw) as ExtrasCacheEnvelope
    if (!Array.isArray(parsed.data) || !Number.isFinite(parsed.savedAt) || Date.now() - parsed.savedAt > EXTRAS_CACHE_MAX_AGE) return []
    return normalizeArabicTanween(parsed.data) as T[]
  } catch {
    return []
  }
}

function writeExtrasCache(collectionName: string, data: unknown[]) {
  if (typeof window === 'undefined') return
  try {
    const envelope: ExtrasCacheEnvelope = { savedAt: Date.now(), data }
    window.localStorage.setItem(extrasCacheKey(collectionName), JSON.stringify(envelope))
  } catch {
    /* امتلاء التخزين أو الوضع الخاص لا يعطل المحتوى الحي. */
  }
}

function useExtrasResource<T>(collectionName: string, options: ExtrasOptions = {}): ExtrasResource<T> {
  const initial = useMemo(() => readExtrasCache<T>(collectionName), [collectionName])
  const [data, setData] = useState<T[]>(initial)
  const [loading, setLoading] = useState(initial.length === 0)
  const [refreshing, setRefreshing] = useState(firebaseEnabled)
  const [error, setError] = useState(false)
  const [fromCache, setFromCache] = useState(initial.length > 0)
  const realtime = Boolean(options.realtime)

  useEffect(() => {
    let active = true
    let unsubscribe = () => {}
    const cached = readExtrasCache<T>(collectionName)
    setData(cached)
    setLoading(cached.length === 0)
    setRefreshing(firebaseEnabled)
    setError(false)
    setFromCache(cached.length > 0)

    if (!firebaseEnabled) {
      setLoading(false)
      setRefreshing(false)
      return () => { active = false }
    }

    const accept = (items: T[], { confirmed, cache }: { confirmed: boolean; cache: boolean }) => {
      if (!active) return
      const normalized = normalizeArabicTanween(items) as T[]
      /* لا نستبدل أرشيفاً محفوظاً بلقطة Firestore محلية فارغة أثناء بدء
         المزامنة. الفراغ لا يصبح حقيقةً إلا بعد أن يؤكده الخادم. */
      if (normalized.length > 0 || confirmed || cached.length === 0) {
        startTransition(() => setData(normalized))
        setFromCache(!confirmed)
      }
      if (cache && (normalized.length > 0 || confirmed)) writeExtrasCache(collectionName, normalized as unknown[])
      if (confirmed) {
        setLoading(false)
        setRefreshing(false)
        setError(false)
        setFromCache(false)
      }
    }

    if (!realtime) {
      fetchExtras<T>(collectionName)
        .then((items) => {
          if (!active) return
          /* fetchExtras يعيد [] أيضاً عند تعذر الشبكة؛ لذلك لا نمحو نسخةً
             محفوظة بفراغٍ غير موثوق. */
          if (items.length > 0) accept(items, { confirmed: true, cache: true })
          else {
            setLoading(false)
            setRefreshing(false)
            if (cached.length === 0) startTransition(() => setData([]))
          }
        })
        .catch(() => {
          if (!active) return
          setLoading(false)
          setRefreshing(false)
          setError(true)
        })
      return () => { active = false }
    }

    ;(async () => {
      try {
        const db = await getDb()
        if (!db || !active) {
          setLoading(false)
          setRefreshing(false)
          return
        }
        const { collection, onSnapshot, orderBy, query } = await import('firebase/firestore')
        unsubscribe = onSnapshot(
          query(collection(db, collectionName), orderBy('createdAt', 'desc')),
          { includeMetadataChanges: true },
          (snapshot) => {
            if (!active) return
            const items = snapshot.docs.map((item) => ({ id: item.id, ...item.data() })) as T[]
            const confirmed = !snapshot.metadata.fromCache
            accept(items, { confirmed, cache: confirmed })
          },
          () => {
            if (!active) return
            setLoading(false)
            setRefreshing(false)
            setError(true)
            /* النسخة المحفوظة تبقى معروضة؛ لا نعلن أن الأرشيف اختفى. */
          },
        )
      } catch {
        if (!active) return
        setLoading(false)
        setRefreshing(false)
        setError(true)
      }
    })()

    return () => { active = false; unsubscribe() }
  }, [collectionName, realtime])

  return { data, loading, refreshing, error, fromCache }
}

export function useExtras<T>(collectionName: string, options: ExtrasOptions = {}): T[] {
  return useExtrasResource<T>(collectionName, options).data
}

export function useExtrasState<T>(collectionName: string, options: ExtrasOptions = {}): ExtrasResource<T> {
  return useExtrasResource<T>(collectionName, options)
}

/** يبدأ استعادة المجموعات الحساسة عند فتح الموقع، قبل أن يصل الزائر إلى
    صفحات الرسائل والرادار. لا يمحو التخزين عند فشل الشبكة أو رجوع نتيجة فارغة. */
export async function warmPublicExtras(collectionNames: string[]) {
  await Promise.all(collectionNames.map(async (collectionName) => {
    try {
      const items = await fetchExtras<Record<string, unknown>>(collectionName)
      if (items.length > 0) writeExtrasCache(collectionName, normalizeArabicTanween(items) as unknown[])
    } catch {
      /* النسخة المحلية هي خط الدفاع الأول. */
    }
  }))
}

type CmsContextValue = {
  remote: RemoteCmsData
  loading: boolean
  error: string | null
  reload: () => Promise<void>
}

const CmsContext = createContext<CmsContextValue | null>(null)

const collectionMap = {
  content_overrides: 'overrides',
  site_articles: 'articles',
  site_books: 'books',
  site_papers: 'papers',
  site_media: 'media',
} as const

type RemoteKey = (typeof collectionMap)[keyof typeof collectionMap]
type CollectionName = keyof typeof collectionMap

const errorMessage = (error: unknown) =>
  error instanceof Error && error.message ? error.message : 'تعذّر تحميل المحتوى الحي.'

const documents = (snapshot: { docs: { id: string; data: () => Record<string, unknown> }[] }): RemoteDocument[] =>
  normalizeArabicTanween(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })))

const isAdminRoute = () =>
  typeof window !== 'undefined' && window.location.pathname.startsWith('/admin')

const afterFirstPaint = (callback: () => void, timeout = 2500) => {
  if (typeof window === 'undefined') return () => {}
  let cancelled = false
  const run = () => { if (!cancelled) callback() }
  const win = window as typeof window & {
    requestIdleCallback?: (cb: () => void, options?: { timeout: number }) => number
    cancelIdleCallback?: (id: number) => void
  }
  const id = win.requestIdleCallback
    ? win.requestIdleCallback(run, { timeout })
    : window.setTimeout(run, Math.min(timeout, 1200))
  return () => {
    cancelled = true
    if (win.cancelIdleCallback && typeof id === 'number') win.cancelIdleCallback(id)
    else window.clearTimeout(id)
  }
}

export function CmsProvider({ children }: { children: ReactNode }) {
  const [remote, setRemote] = useState<RemoteCmsData>({})
  const [loading, setLoading] = useState(isAdminRoute)
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    const db = await getDb()
    if (!db) {
      setLoading(false)
      return
    }
    try {
      const { collection, getDocs } = await import('firebase/firestore')
      const entries = await Promise.all(
        (Object.keys(collectionMap) as CollectionName[]).map(async (name) => {
          const snapshot = await getDocs(collection(db, name))
          return [collectionMap[name], documents(snapshot)] as const
        }),
      )
      // تحديث غير عاجل: دمج المحتوى الحي يعيد رسم الموقع كله، وجعله قابلاً
      // للمقاطعة يمنع تجميد نقرة أو تنقّل تزامن وصول البيانات معه.
      startTransition(() => {
        setRemote(Object.fromEntries(entries) as RemoteCmsData)
        setError(null)
      })
    } catch (loadError) {
      setError(errorMessage(loadError))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    let active = true
    const unsubscribers: (() => void)[] = []
    let cancelStart = () => {}

    const startRealtime = async () => {
      try {
        const db = await getDb()
        if (!active) return
        if (!db) {
          setLoading(false)
          return
        }
        const { collection, onSnapshot } = await import('firebase/firestore')
        const ready = new Set<RemoteKey>()
        const finish = (key: RemoteKey) => {
          ready.add(key)
          if (ready.size === Object.keys(collectionMap).length) setLoading(false)
        }

        for (const name of Object.keys(collectionMap) as CollectionName[]) {
          const key = collectionMap[name]
          const unsubscribe = onSnapshot(
            collection(db, name),
            (snapshot) => {
              if (!active) return
              startTransition(() => {
                setRemote((previous) => ({ ...previous, [key]: documents(snapshot) }))
                setError(null)
              })
              finish(key)
            },
            (snapshotError) => {
              if (!active) return
              setError(errorMessage(snapshotError))
              finish(key)
            },
          )
          unsubscribers.push(unsubscribe)
        }
      } catch (loadError) {
        if (!active) return
        setError(errorMessage(loadError))
        setLoading(false)
      }
    }

    // المحتوى والعدادات في كل صفحات الموقع مصدرها واحد حيّ. بذلك ينعكس الحذف والإخفاء
    // فوراً في الرئيسية والسيرة والبحث والقوائم، ولا تبقى أرقام قديمة حتى إعادة البناء.
    cancelStart = afterFirstPaint(() => { void startRealtime() }, isAdminRoute() ? 450 : 900)

    return () => {
      active = false
      cancelStart()
      unsubscribers.forEach((unsubscribe) => unsubscribe())
    }
  }, [reload])

  const value = useMemo<CmsContextValue>(() => ({
    remote,
    loading,
    error,
    reload,
  }), [error, loading, reload, remote])

  return createElement(CmsContext.Provider, { value }, children)
}

export function useCmsContent({ includeHidden = false }: { includeHidden?: boolean } = {}): CmsSnapshot & {
  loading: boolean
  error: string | null
  reload: () => Promise<void>
} {
  const context = useContext(CmsContext)
  const merged = useMemo(
    () => context ? mergeCmsContent(context.remote, includeHidden) : baseCmsSnapshot,
    [context?.remote, includeHidden],
  )
  const fallbackReload = useCallback(async () => {}, [])

  return {
    ...merged,
    loading: context?.loading ?? false,
    error: context?.error ?? null,
    reload: context?.reload ?? fallbackReload,
  }
}
