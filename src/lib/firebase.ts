/**
 * Firebase — اختياري وكسول.
 * لا يُحمَّل إلا عند أول استخدام فعلي (إرسال رسالة / اشتراك).
 * إن لم تُضبط متغيّرات البيئة، يعمل الموقع بالكامل بلا Firestore.
 */
import type { Firestore } from 'firebase/firestore'

type FirebaseConfig = {
  apiKey: string
  authDomain?: string
  projectId: string
  storageBucket?: string
  messagingSenderId?: string
  appId: string
}

const envConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}
const appCheckSiteKey = import.meta.env.VITE_FIREBASE_APPCHECK_SITE_KEY

const complete = (value: Partial<FirebaseConfig> | null | undefined): value is FirebaseConfig =>
  Boolean(value?.apiKey && value?.projectId && value?.appId)

/**
 * Firebase client keys are public application identifiers, not service-account
 * secrets. Production loads the generated runtime config when Vite build-time
 * variables are unavailable (Cloud Run excludes .env by design).
 */
let configPromise: Promise<FirebaseConfig | null> | null = null
async function getFirebaseConfig(): Promise<FirebaseConfig | null> {
  if (complete(envConfig)) return envConfig
  if (configPromise) return configPromise

  configPromise = fetch('/firebase-applet-config.json', { cache: 'no-store' })
    .then(async (response) => {
      if (!response.ok) return null
      const value = await response.json() as Partial<FirebaseConfig>
      return complete(value) ? value : null
    })
    .catch(() => null)

  return configPromise
}

// A runtime config ships with this project. Consumers still handle a null app
// gracefully if a deployment omits that file.
export const firebaseEnabled = true

let cached: Firestore | null = null
let appCheckReady = false
let appPromise: ReturnType<typeof createFirebaseApp> | null = null

async function createFirebaseApp() {
  const cfg = await getFirebaseConfig()
  if (!cfg) return null
  const { initializeApp, getApps, getApp } = await import('firebase/app')
  const app = getApps().length === 0 ? initializeApp(cfg) : getApp()
  if (appCheckSiteKey && !appCheckReady && typeof window !== 'undefined') {
    try {
      const { ReCaptchaV3Provider, initializeAppCheck } = await import('firebase/app-check')
      initializeAppCheck(app, {
        provider: new ReCaptchaV3Provider(appCheckSiteKey),
        isTokenAutoRefreshEnabled: true,
      })
      appCheckReady = true
    } catch {
      appCheckReady = false
    }
  }
  return app
}

/** يحمّل تطبيق Firebase عند الطلب (للوحة التحكم: المصادقة وغيرها). */
export async function getFirebaseApp() {
  if (!appPromise) appPromise = createFirebaseApp()
  try {
    return await appPromise
  } catch (error) {
    appPromise = null
    throw error
  }
}

/** يحمّل Firebase عند الطلب فقط. يعيد null إن لم يُفعَّل. */
export async function getDb(): Promise<Firestore | null> {
  if (cached) return cached
  const [app, { getFirestore }] = await Promise.all([getFirebaseApp(), import('firebase/firestore')])
  if (!app) return null
  cached = getFirestore(app!)
  return cached
}

/** يجلب مجموعة محتوى منشورة من لوحة التحكم (الأحدث أولاً).
    يعيد [] بصمت إن لم يُفعَّل Firebase أو تعذّر الجلب —
    فيبقى الموقع يعمل بمحتواه الثابت كاملاً. */
export async function fetchExtras<T>(name: string): Promise<(T & { id: string })[]> {
  const db = await getDb()
  if (!db) return []
  try {
    const { collection, getDocs, query, orderBy } = await import('firebase/firestore')
    const snap = await getDocs(query(collection(db, name), orderBy('createdAt', 'desc')))
    return snap.docs.map((d) => ({ id: d.id, ...d.data() })) as (T & { id: string })[]
  } catch {
    return []
  }
}

/** محتوى عام معتمد فقط؛ لا يسرّب مرشحات الرادار قيد المراجعة. */
export async function fetchPublishedExtras<T>(name: string): Promise<(T & { id: string })[]> {
  const db = await getDb()
  if (!db) return []
  try {
    const { collection, getDocs, query, where } = await import('firebase/firestore')
    const snap = await getDocs(query(collection(db, name), where('status', '==', 'published')))
    return snap.docs.map((d) => ({ id: d.id, ...d.data() })) as (T & { id: string })[]
  } catch {
    return []
  }
}
