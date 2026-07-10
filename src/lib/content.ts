import {
  createContext,
  createElement,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { firebaseEnabled, fetchExtras, getDb } from './firebase'
import {
  baseCmsSnapshot,
  mergeCmsContent,
  type CmsSnapshot,
  type RemoteCmsData,
  type RemoteDocument,
} from './cms'

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
  audio?: { fahed?: boolean | string; noura?: boolean | string }
}

export function useExtras<T>(collectionName: string): T[] {
  const [data, setData] = useState<T[]>([])

  useEffect(() => {
    let active = true
    if (firebaseEnabled) {
      fetchExtras<T>(collectionName).then((items) => {
        if (active) setData(items as T[])
      })
    }
    return () => { active = false }
  }, [collectionName])

  return data
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
  snapshot.docs.map((item) => ({ id: item.id, ...item.data() }))

export function CmsProvider({ children }: { children: ReactNode }) {
  const [remote, setRemote] = useState<RemoteCmsData>({})
  const [loading, setLoading] = useState(true)
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
      setRemote(Object.fromEntries(entries) as RemoteCmsData)
      setError(null)
    } catch (loadError) {
      setError(errorMessage(loadError))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    let active = true
    const unsubscribers: (() => void)[] = []

    ;(async () => {
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
              setRemote((previous) => ({ ...previous, [key]: documents(snapshot) }))
              setError(null)
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
    })()

    return () => {
      active = false
      unsubscribers.forEach((unsubscribe) => unsubscribe())
    }
  }, [])

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
