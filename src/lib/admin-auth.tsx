import { useCallback, useSyncExternalStore } from 'react'
import type { User } from 'firebase/auth'
import { getFirebaseApp } from './firebase'

export type AdminAuthState = {
  user: User | null
  isAdmin: boolean
  loading: boolean
  error: string | null
}

const initialState: AdminAuthState = {
  user: null,
  isAdmin: false,
  loading: true,
  error: null,
}

let state = initialState
let started = false
let authVersion = 0
const listeners = new Set<() => void>()

const emit = (next: AdminAuthState) => {
  state = next
  listeners.forEach((listener) => listener())
}

const messageFor = (error: unknown) => {
  if (error instanceof Error && error.message) return error.message
  return 'تعذّر التحقق من صلاحية المشرف.'
}

async function startAdminAuth() {
  if (started) return
  started = true

  try {
    const app = await getFirebaseApp()
    if (!app) {
      emit({ user: null, isAdmin: false, loading: false, error: null })
      return
    }

    const { getAuth, getIdTokenResult, onAuthStateChanged } = await import('firebase/auth')
    const auth = getAuth(app)

    onAuthStateChanged(
      auth,
      async (user) => {
        const version = ++authVersion
        if (!user) {
          emit({ user: null, isAdmin: false, loading: false, error: null })
          return
        }

        emit({ user, isAdmin: false, loading: true, error: null })
        try {
          const token = await getIdTokenResult(user)
          if (version !== authVersion) return
          emit({ user, isAdmin: token.claims.admin === true, loading: false, error: null })
        } catch (error) {
          if (version !== authVersion) return
          emit({ user, isAdmin: false, loading: false, error: messageFor(error) })
        }
      },
      (error) => {
        authVersion += 1
        emit({ user: null, isAdmin: false, loading: false, error: messageFor(error) })
      },
    )
  } catch (error) {
    emit({ user: null, isAdmin: false, loading: false, error: messageFor(error) })
  }
}

const subscribe = (listener: () => void) => {
  listeners.add(listener)
  void startAdminAuth()
  return () => listeners.delete(listener)
}

const getSnapshot = () => state
const getServerSnapshot = () => initialState

/**
 * حالة المصادقة المشتركة للمكوّنات التي تحتاج معرفة صلاحية المشرف.
 * تعمل بلا Provider، وتعود إلى وضع الزائر بصمت إذا لم يتوفر إعداد Firebase.
 */
export function useAdminAuth() {
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)

  const refresh = useCallback(async () => {
    const user = state.user
    if (!user) return false

    const version = ++authVersion
    emit({ ...state, loading: true, error: null })
    try {
      const { getIdTokenResult } = await import('firebase/auth')
      const token = await getIdTokenResult(user, true)
      if (version !== authVersion) return false
      const isAdmin = token.claims.admin === true
      emit({ user, isAdmin, loading: false, error: null })
      return isAdmin
    } catch (error) {
      if (version === authVersion) {
        emit({ user, isAdmin: false, loading: false, error: messageFor(error) })
      }
      return false
    }
  }, [])

  const signOut = useCallback(async () => {
    try {
      const app = await getFirebaseApp()
      if (!app) return
      const { getAuth, signOut: firebaseSignOut } = await import('firebase/auth')
      await firebaseSignOut(getAuth(app))
    } catch (error) {
      emit({ ...state, error: messageFor(error), loading: false })
    }
  }, [])

  return { ...snapshot, refresh, signOut }
}
