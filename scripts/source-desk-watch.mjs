#!/usr/bin/env node
/**
 * حارس مكتب المصادر الشخصي.
 *
 * يراجع فقط المصادر الخاصة ذات DOI عبر Crossref. لا يلمس المحتوى العام، ولا
 * يستنتج سحباً أو تصحيحاً من غياب البيانات: لا يغيّر الحالة إلا عند وجود
 * علاقة صريحة من المصدر نفسه. إذا وُجدت إشارة، يرفع تنبيهاً داخل
 * admin_content_intelligence لكل مادة تعتمد على المصدر.
 */
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { buildCascadeCorrectionCase, cascadeCorrectionId, cascadeCorrectionSummary } from '../src/lib/cascade-correction.mjs'

export function extractDoi(value = '') {
  return String(value || '')
    .replace(/^doi\s*:\s*/i, '')
    .replace(/^https?:\/\/(?:dx\.)?doi\.org\//i, '')
    .match(/10\.\d{4,9}\/[\-._;()/:A-Z0-9]+/i)?.[0]
    ?.replace(/[.,;،؛]+$/, '') || ''
}

const relationRows = (value) => Array.isArray(value) ? value : value && typeof value === 'object' ? Object.values(value) : []

export function crossrefSignals(message = {}) {
  const relation = message && typeof message.relation === 'object' && message.relation ? message.relation : {}
  const keys = Object.keys(relation)
  const has = (...names) => names.some((name) => relationRows(relation[name]).length > 0 || keys.includes(name) && Boolean(relation[name]))
  const retracted = has('is-retracted-by', 'is-withdrawn-by')
  const corrected = has('is-corrected-by')
  const updated = has('is-updated-by') || Array.isArray(message['update-to']) && message['update-to'].length > 0
  const signals = [
    retracted ? 'Crossref يربط العمل صراحةً بإشعار سحب.' : '',
    corrected ? 'Crossref يربط العمل صراحةً بتصحيح.' : '',
    !retracted && !corrected && updated ? 'Crossref يربط العمل بتحديث لاحق؛ يحتاج مراجعة الدليل.' : '',
  ].filter(Boolean)
  return {
    signals,
    status: retracted ? 'retracted' : corrected ? 'corrected' : updated ? 'needs_review' : null,
  }
}


export function strongestSourceStatus(current = 'active', suggested = null) {
  const rank = { active: 0, needs_review: 1, corrected: 2, retracted: 3 }
  const safeCurrent = Object.prototype.hasOwnProperty.call(rank, current) ? current : 'active'
  if (!suggested || !Object.prototype.hasOwnProperty.call(rank, suggested)) return safeCurrent
  return rank[suggested] > rank[safeCurrent] ? suggested : safeCurrent
}

export function sourceAlert(sourceTitle, result) {
  if (!result?.status) return ''
  const state = result.status === 'retracted' ? 'منسحب' : result.status === 'corrected' ? 'مصحح' : 'يحتاج مراجعة'
  return `المصدر الشخصي «${sourceTitle || 'مصدر محفوظ'}» أصبح ${state} وفق إشارة Crossref الصريحة؛ راجع الادعاءات المرتبطة به.`
}

function selfTest() {
  assert.equal(extractDoi('https://doi.org/10.1000/ABC.12'), '10.1000/ABC.12')
  assert.equal(crossrefSignals({ relation: { 'is-retracted-by': [{ id: 'x' }] } }).status, 'retracted')
  assert.equal(crossrefSignals({ relation: { 'is-corrected-by': [{ id: 'x' }] } }).status, 'corrected')
  assert.equal(crossrefSignals({ relation: { 'is-updated-by': [{ id: 'x' }] } }).status, 'needs_review')
  assert.equal(crossrefSignals({ relation: {} }).status, null)
  assert.match(sourceAlert('دراسة', { status: 'retracted' }), /منسحب/)
  assert.equal(strongestSourceStatus('corrected', 'needs_review'), 'corrected')
  assert.equal(strongestSourceStatus('active', 'retracted'), 'retracted')
  console.log('source desk watch self-test: passed')
}

async function firebaseDb() {
  const path = resolve(process.cwd(), process.env.FIREBASE_SERVICE_ACCOUNT || 'sa.json')
  if (!existsSync(path)) throw new Error('حساب خدمة Firebase مفقود.')
  const serviceAccount = JSON.parse(readFileSync(path, 'utf8'))
  const [{ cert, getApps, initializeApp }, { FieldValue, getFirestore }] = await Promise.all([
    import('firebase-admin/app'),
    import('firebase-admin/firestore'),
  ])
  const app = getApps()[0] || initializeApp({ credential: cert(serviceAccount) })
  return { db: getFirestore(app), FieldValue }
}

async function crossref(doi) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 12_000)
  try {
    const response = await fetch(`https://api.crossref.org/works/${encodeURIComponent(doi)}`, {
      headers: { 'User-Agent': 'DrAhmadPersonalSourceDesk/1.0' },
      signal: controller.signal,
    })
    if (!response.ok) return null
    const payload = await response.json()
    return payload?.message && typeof payload.message === 'object' ? payload.message : null
  } catch {
    return null
  } finally { clearTimeout(timer) }
}

async function main() {
  const { db, FieldValue } = await firebaseDb()
  const sources = await db.collection('admin_source_desk').get()
  let checked = 0
  let alerted = 0
  for (const document of sources.docs) {
    const source = document.data() || {}
    const doi = extractDoi(source.doi || source.reference || source.url || '')
    if (!doi) continue
    const message = await crossref(doi)
    if (!message) continue
    checked += 1
    const result = crossrefSignals(message)
    const now = new Date().toISOString()
    const patch = {
      watch: {
        provider: 'Crossref',
        doi,
        checkedAt: now,
        title: Array.isArray(message.title) ? String(message.title[0] || '') : String(message.title || ''),
        signals: result.signals,
        suggestedStatus: result.status,
      },
      updatedAtClient: now,
      updatedAt: FieldValue.serverTimestamp(),
    }
    const nextStatus = strongestSourceStatus(source.status, result.status)
    if (nextStatus !== source.status) patch.status = nextStatus
    await document.ref.set(patch, { merge: true })
    const alert = sourceAlert(source.title, result)
    if (!alert) continue
    const dependency = await db.collection('admin_content_intelligence').where('sourceIds', 'array-contains', `personal:${document.id}`).get()
    for (const row of dependency.docs) {
      const dependencyData = row.data() || {}
      let correctionProtocol = null
      if (['corrected', 'retracted'].includes(result.status)) {
        const articleSlug = String(dependencyData.slug || row.id.replace(/^article:/, '')).trim()
        const caseId = cascadeCorrectionId(document.id, articleSlug)
        const caseRef = db.collection('admin_correction_cases').doc(caseId)
        const existingCase = await caseRef.get()
        const correction = buildCascadeCorrectionCase({
          source: { id: document.id, ...source, status: result.status, provider: 'Crossref', signals: result.signals },
          dependency: dependencyData,
          article: { slug: articleSlug, title: dependencyData.title, publicationPassport: { passportId: dependencyData.publicationPassportId || '' } },
          existingCase: existingCase.exists ? existingCase.data() : null,
          now,
        })
        correctionProtocol = cascadeCorrectionSummary(correction)
        await caseRef.set({
          ...correction,
          updatedAt: FieldValue.serverTimestamp(),
          ...(!existingCase.exists ? { createdAt: FieldValue.serverTimestamp() } : {}),
        }, { merge: true })
        const queued = await db.collection('social_queue').where('articleSlug', '==', articleSlug).get()
        for (const queuedRow of queued.docs) {
          const queuedData = queuedRow.data() || {}
          if (queuedData.correctionCaseId === caseId && queuedData.status === 'correction_hold') continue
          await queuedRow.ref.set({
            status: 'correction_hold',
            statusBeforeCorrection: queuedData.status === 'correction_hold' ? queuedData.statusBeforeCorrection || 'ready_for_review' : queuedData.status || 'ready_for_review',
            correctionCaseId: caseId,
            correctionHeldAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
          }, { merge: true })
        }
      }
      await row.ref.set({
        needsEvidenceReview: true,
        sourceWatchAlerts: FieldValue.arrayUnion(`[personal:${document.id}] ${alert}`),
        sourceWatchUpdatedAt: FieldValue.serverTimestamp(),
        ...(correctionProtocol ? { correctionCaseId: correctionProtocol.id, correctionCaseIds: FieldValue.arrayUnion(correctionProtocol.id), correctionProtocol } : {}),
      }, { merge: true })
      alerted += 1
    }
  }
  console.log(`source desk watch: checked=${checked} affected=${alerted}`)
}

if (process.argv.includes('--self-test')) selfTest()
else await main()
