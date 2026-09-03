import { getFirebaseApp } from './firebase'

export type PublicationSyncKind = 'article' | 'book' | 'paper' | 'media'
export type PublicationSyncRequest = {
  kind: PublicationSyncKind
  slug: string
  status?: string
  scheduledAt?: string
}
export type PublicationSyncResult = {
  ok: boolean
  state: 'draft' | 'scheduled' | 'queued'
  dispatched: boolean
  workflow?: string
  message?: string
}

const wait = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms))

/**
 * Registers every CMS save in the server-side publication pipeline.
 * Public material also dispatches the guarded GitHub deployment automatically;
 * draft/scheduled material is merely queued until it is eligible.
 *
 * The content write has already succeeded before this helper is called. A
 * deployment outage must never roll the editorial data back, so callers show a
 * warning and the recovery workflow can retry queued jobs later.
 */
export async function requestContentPublicationSync(request: PublicationSyncRequest): Promise<PublicationSyncResult> {
  const app = await getFirebaseApp()
  if (!app) throw new Error('Firebase غير متاح لبدء الربط التلقائي.')
  const { getAuth } = await import('firebase/auth')
  const user = getAuth(app).currentUser
  if (!user) throw new Error('جلسة المشرف غير متاحة لبدء الربط التلقائي.')
  const token = await user.getIdToken()

  let lastError = 'تعذّر بدء الربط التلقائي.'
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const response = await fetch('/api/admin/content/publish-sync', {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
        body: JSON.stringify(request),
      })
      const payload = await response.json().catch(() => ({})) as PublicationSyncResult & { error?: string }
      if (response.ok && payload.ok) return payload
      lastError = payload.error || payload.message || `HTTP ${response.status}`
      if (![502, 503, 504].includes(response.status) || attempt > 0) break
    } catch (error) {
      lastError = error instanceof Error ? error.message : lastError
      if (attempt > 0) break
    }
    await wait(450)
  }
  throw new Error(lastError)
}
