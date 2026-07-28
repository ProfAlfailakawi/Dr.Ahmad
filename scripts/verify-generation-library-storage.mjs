#!/usr/bin/env node
/**
 * فحص بيانات Firebase Storage لمكتبة التوليد.
 *
 * - CI: يكتب ملف JSON صغيراً في نفس مساحة التصاميم، يقرأه، ثم يحذفه.
 *   هذا يثبت أن الحاوية نفسها متاحة للكتابة/القراءة/الحذف قبل نشر Hosting.
 * - المتصفح: SocialDesignStudio يعيد الفحص بصلاحية admin الحقيقية، فيغطي
 *   storage.rules أيضاً لأن Admin SDK في CI يتجاوز قواعد العميل بطبيعته.
 */
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'

const SELF_TEST = process.argv.includes('--self-test')

export const healthPath = (id = randomUUID()) => `admin-generated-designs/health-ci-${String(id).replace(/[^A-Za-z0-9_-]/g, '-').slice(0, 96)}.json`
export const healthPayload = (at = new Date().toISOString()) => ({ ok: true, scope: 'generation-library-storage-ci', at })

if (SELF_TEST) {
  const path = healthPath('abc:123')
  assert.equal(path, 'admin-generated-designs/health-ci-abc-123.json')
  const payload = healthPayload('2026-07-28T00:00:00.000Z')
  assert.equal(payload.ok, true)
  assert.equal(payload.scope, 'generation-library-storage-ci')
  console.log('✓ Generation Library Storage verifier self-test')
  process.exit(0)
}

const projectId = String(process.env.FIREBASE_PROJECT_ID || 'drahmad-8e9e2').trim()
const storageBucket = String(process.env.FIREBASE_STORAGE_BUCKET || 'drahmad-8e9e2.firebasestorage.app').trim()
if (!projectId || !storageBucket) throw new Error('FIREBASE_PROJECT_ID/FIREBASE_STORAGE_BUCKET مفقود')

const [{ initializeApp, applicationDefault, deleteApp }, { getStorage }] = await Promise.all([
  import('firebase-admin/app'),
  import('firebase-admin/storage'),
])
const app = initializeApp({ credential: applicationDefault(), projectId, storageBucket }, `generation-library-storage-check-${Date.now()}`)
const filePath = healthPath()
const file = getStorage(app).bucket(storageBucket).file(filePath)
const payload = healthPayload()
try {
  await file.save(JSON.stringify(payload), {
    resumable: false,
    contentType: 'application/json',
    metadata: { metadata: { source: 'generation-library-ci-health-check' } },
  })
  const [downloaded] = await file.download()
  const parsed = JSON.parse(downloaded.toString('utf8'))
  if (parsed.ok !== true || parsed.scope !== payload.scope) throw new Error('Storage read-back payload mismatch')
  await file.delete({ ignoreNotFound: false })
  console.log(`✓ Firebase Storage data-plane ready for Generation Library (${storageBucket})`)
} catch (error) {
  try { await file.delete({ ignoreNotFound: true }) } catch { /* best effort */ }
  console.error('✘ Generation Library Firebase Storage health check failed:', error instanceof Error ? error.message : error)
  process.exitCode = 1
} finally {
  await deleteApp(app)
}
