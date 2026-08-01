import { getFirebaseApp } from './firebase'
import { sealPublicationPassportDraft, type PublicationPassportDraft, type SignedPublicationPassport } from './sovereign-publishing.mjs'

async function sha256(value: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

export async function requestPublicationPassportSignature(draft: PublicationPassportDraft): Promise<SignedPublicationPassport> {
  const app = await getFirebaseApp()
  if (!app) throw new Error('Firebase غير متاح لتوقيع جواز النشر.')
  const { getAuth } = await import('firebase/auth')
  const token = await getAuth(app).currentUser?.getIdToken()
  if (!token) throw new Error('انتهت جلسة الدخول قبل توقيع جواز النشر.')
  const manifest = await sealPublicationPassportDraft(draft, sha256)
  const response = await fetch('/api/admin/publication-passport/sign', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
    body: JSON.stringify({ manifest }),
  })
  let payload: (SignedPublicationPassport & { error?: string }) | null = null
  try { payload = await response.json() as SignedPublicationPassport & { error?: string } } catch { /* الرسالة أدناه أدق للمستخدم */ }
  if (!response.ok || !payload?.signature) throw new Error(payload?.error || `تعذّر توقيع جواز النشر (${response.status}).`)
  return payload
}

