import { createHash } from 'node:crypto'
import { cert, getApps, initializeApp } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { openDatabase } from '../whatsapp-agent/db.mjs'

const APPLY = process.argv.includes('--apply')
const CONTACTS = 'whatsapp_audience_contacts'
const LISTS = 'whatsapp_audience_lists'
const MEMBERS = 'whatsapp_audience_members'

function digitsOf(value) {
  let digits = String(value || '').split('@', 1)[0].replace(/\D/g, '').replace(/^00+/, '')
  if (digits.length === 8) digits = `965${digits}`
  return /^\d{10,15}$/.test(digits) ? digits : ''
}

function centralId(jid) {
  const digits = digitsOf(jid)
  return digits
    ? createHash('sha256').update(`audience:${digits}@c.us`).digest('hex').slice(0, 32)
    : ''
}

function serviceAccount() {
  const raw = String(process.env.GOOGLE_SA_JSON || '').trim()
  if (!raw) throw new Error('GOOGLE_SA_JSON is required')
  const parsed = JSON.parse(raw)
  if (!parsed?.project_id || !parsed?.client_email || !parsed?.private_key) {
    throw new Error('GOOGLE_SA_JSON is invalid')
  }
  return parsed
}

async function writeInBatches(db, operations) {
  for (let offset = 0; offset < operations.length; offset += 400) {
    const batch = db.batch()
    for (const operation of operations.slice(offset, offset + 400)) {
      batch.set(operation.ref, operation.data, { merge: true })
    }
    await batch.commit()
  }
}

const legacy = openDatabase()
try {
  const contactRows = legacy.all('SELECT * FROM contacts')
  const listRows = legacy.all('SELECT * FROM broadcast_lists WHERE jid IS NULL')
  const memberRows = legacy.all('SELECT list_id, jid FROM broadcast_members')
  const idMap = new Map()
  const contacts = []

  for (const row of contactRows) {
    let legacyJid = ''
    try { legacyJid = legacy.decryptJid(row.jid) || '' } catch { /* صف تالف يُعزل */ }
    const digits = digitsOf(legacyJid)
    const id = centralId(legacyJid)
    if (!digits || !id) continue
    idMap.set(row.id, id)
    contacts.push({
      id,
      jid: `${digits}@c.us`,
      tail: digits.slice(-4),
      nickname: String(row.nickname || '').slice(0, 120) || null,
      waName: String(row.wa_name || '').slice(0, 120) || null,
      displayName: String(row.display_name || '').slice(0, 120) || null,
      suppressed: Boolean(row.suppressed),
      source: String(row.source || 'legacy-migration').slice(0, 40),
      migratedAt: new Date().toISOString(),
      updatedAt: String(row.updated_at || new Date().toISOString()),
      createdAt: String(row.created_at || new Date().toISOString()),
    })
  }

  const members = memberRows.flatMap((row) => {
    const contactId = idMap.get(row.jid)
    if (!contactId) return []
    const id = `${row.list_id}:${contactId}`
    return [{ id, listId: row.list_id, contactId, migratedAt: new Date().toISOString() }]
  })
  const counts = new Map()
  for (const member of members) counts.set(member.listId, Number(counts.get(member.listId) || 0) + 1)
  const lists = listRows.map((row) => ({
    id: row.id,
    name: String(row.name || 'قائمة بلا اسم').slice(0, 120),
    note: String(row.note || '').slice(0, 300),
    kind: String(row.kind || 'manual').slice(0, 40),
    count: Number(counts.get(row.id) || 0),
    createdAt: String(row.discovered_at || new Date().toISOString()),
    updatedAt: String(row.updated_at || new Date().toISOString()),
    migratedAt: new Date().toISOString(),
  }))

  const summary = {
    sourceContacts: contactRows.length,
    transferableContacts: contacts.length,
    lists: lists.length,
    memberships: members.length,
    skippedContacts: contactRows.length - contacts.length,
    mode: APPLY ? 'apply' : 'dry-run',
  }
  console.log(JSON.stringify(summary))
  if (!APPLY) process.exit(0)

  const account = serviceAccount()
  const app = getApps()[0] || initializeApp({ credential: cert(account), projectId: account.project_id })
  const cloud = getFirestore(app)
  await writeInBatches(cloud, contacts.map((data) => ({ ref: cloud.collection(CONTACTS).doc(data.id), data })))
  await writeInBatches(cloud, lists.map((data) => ({ ref: cloud.collection(LISTS).doc(data.id), data })))
  await writeInBatches(cloud, members.map((data) => ({ ref: cloud.collection(MEMBERS).doc(data.id), data })))

  const verified = {}
  for (const collection of [CONTACTS, LISTS, MEMBERS]) {
    const snapshot = await cloud.collection(collection).count().get()
    verified[collection] = Number(snapshot.data()?.count || 0)
  }
  console.log(JSON.stringify({ ok: true, verified }))
} finally {
  legacy.close()
}
