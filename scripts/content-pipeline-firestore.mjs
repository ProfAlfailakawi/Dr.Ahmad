import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

export async function pipelineFirestore() {
  const saFile = String(process.env.FIREBASE_SERVICE_ACCOUNT || '').trim()
  const inline = String(process.env.GOOGLE_SA_JSON || '').trim()
  if (!inline && (!saFile || !fs.existsSync(path.resolve(root, saFile)))) {
    throw new Error('يلزم FIREBASE_SERVICE_ACCOUNT أو GOOGLE_SA_JSON لتشغيل خط النشر.')
  }
  const [{ initializeApp, cert, getApps }, { getFirestore, FieldValue }] = await Promise.all([
    import('firebase-admin/app'),
    import('firebase-admin/firestore'),
  ])
  const credentials = inline
    ? JSON.parse(inline)
    : JSON.parse(fs.readFileSync(path.resolve(root, saFile), 'utf8'))
  const projectId = String(process.env.FIREBASE_PROJECT_ID || credentials.project_id || '').trim()
  if (!projectId) throw new Error('FIREBASE_PROJECT_ID غير معروف.')
  const app = getApps()[0] || initializeApp({ credential: cert(credentials), projectId })
  return { db: getFirestore(app), FieldValue, projectId }
}

export function timeMs(value) {
  if (!value) return 0
  if (typeof value?.toMillis === 'function') return value.toMillis()
  if (typeof value?.toDate === 'function') return value.toDate().getTime()
  const parsed = Date.parse(String(value))
  return Number.isFinite(parsed) ? parsed : 0
}
