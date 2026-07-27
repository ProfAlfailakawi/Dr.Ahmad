import { createHash, randomUUID, timingSafeEqual } from 'node:crypto'
import { buildContentIndex } from '../../whatsapp-agent/content-index.mjs'

const SITE_URL = String(process.env.WHATSAPP_SITE_URL || 'https://dr-alfailakawi.com').replace(/\/+$/, '')
const OWNER_ALERT_FALLBACK = 'وصلت رسالة تحتاج تدخلك البشري. افتح محادثات واتساب من جهازك المرتبط.'
const HUMAN_ACK = 'وصلتني رسالتك، وتحتاج تأكيدًا بشريًا. سيكمل معك الدكتور أو أحد الفريق بأقرب وقت.'
const DUPLICATE_ACK = 'وصلتني الرسالة نفسها وهي عندي بالفعل. إذا احتاجت متابعة بشرية سيكمل معك الفريق.'
const WELCOME = `حياك الله في موقع د. أحمد حسين الفيلكاوي.\n\nالموقع هو المرجع المعتمد للمقالات والكتب والمواد المنشورة:\n${SITE_URL}`
const MANUAL_MINUTES = Math.max(5, Math.min(240, Number(process.env.WHATSAPP_MANUAL_TAKEOVER_MINUTES || 30)))
const BRIDGE_ONLINE_MS = Math.max(30_000, Number(process.env.WHATSAPP_BRIDGE_ONLINE_MS || 90_000))
const MAX_BODY_BYTES = 2 * 1024 * 1024

const COLLECTIONS = Object.freeze({
  bridge: 'whatsapp_bridge_state',
  conversations: 'whatsapp_conversations',
  rules: 'whatsapp_reply_rules',
  ruleVersions: 'whatsapp_rule_versions',
  commands: 'whatsapp_bridge_commands',
  events: 'whatsapp_attention_events',
  settings: 'whatsapp_settings',
  audienceContacts: 'whatsapp_audience_contacts',
  audienceLists: 'whatsapp_audience_lists',
  audienceMembers: 'whatsapp_audience_members',
  campaigns: 'whatsapp_broadcast_campaigns',
})

const GREETINGS = [
  'السلام عليكم ورحمة الله وبركاته', 'السلام عليكم ورحمه الله وبركاته',
  'السلام عليكم', 'سلام عليكم', 'وعليكم السلام', 'هلا والله', 'هلا', 'مرحبا',
  'مرحبا بك', 'صباح الخير', 'مساء الخير', 'شلونك', 'كيف حالك', 'لو سمحت',
]

const NOISE_WORDS = new Set([
  'ابي', 'ابغى', 'اريد', 'ممكن', 'لو', 'سمحت', 'عندك', 'عن', 'حول', 'شي',
  'شيء', 'شنو', 'ماهو', 'ماهي', 'هل', 'في', 'من', 'الى', 'على', 'مع', 'هذا',
  'هذه', 'ذلك', 'اللي', 'الذي', 'التي', 'لي', 'لنا', 'فضلا', 'رجاء',
])

const HUMAN_PATTERNS = [
  /(?:ابي|اريد|ابغى|ممكن)\s+(?:موظف|انسان|شخص|الدكتور|احد)/,
  /(?:حولني|وصلني|كلمني|اكلم)\s+(?:موظف|الدكتور|شخص|انسان)/,
  /(?:تواصل|اتصال)\s+(?:بشري|مع الدكتور|مع موظف)/,
]

const PRICE_PATTERNS = [
  /(?:قائمه|منيو|اسعار|الاسعار|سعر|بكم|كم السعر|التكلفه|تكلفه)/,
]

const ARABIC_DIGITS = Object.freeze({
  '٠': '0', '١': '1', '٢': '2', '٣': '3', '٤': '4',
  '٥': '5', '٦': '6', '٧': '7', '٨': '8', '٩': '9',
  '۰': '0', '۱': '1', '۲': '2', '۳': '3', '۴': '4',
  '۵': '5', '۶': '6', '۷': '7', '۸': '8', '۹': '9',
})

function asIso(value = Date.now()) {
  const date = value instanceof Date ? value : new Date(value)
  return Number.isFinite(date.getTime()) ? date.toISOString() : new Date().toISOString()
}

function bounded(value, max = 2_000) {
  return String(value ?? '').trim().slice(0, max)
}

function hash(value) {
  return createHash('sha256').update(String(value || '')).digest('hex')
}

function conversationId(jid) {
  return hash(`whatsapp:${bounded(jid, 180)}`).slice(0, 40)
}

function maskJid(jid) {
  const value = bounded(jid, 180)
  const number = value.split('@', 1)[0].replace(/\D/g, '')
  return number.length > 4 ? `${'*'.repeat(Math.max(4, number.length - 4))}${number.slice(-4)}` : '****'
}

function normalizeWhitespace(value) {
  return String(value || '').replace(/\s+/g, ' ').trim()
}

export function normalizeArabicMessage(value) {
  return normalizeWhitespace(String(value || '')
    .normalize('NFKD')
    .replace(/[\u064B-\u065F\u0670\u06D6-\u06ED]/g, '')
    .replace(/[إأآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/[ؤئ]/g, 'ء')
    .replace(/ـ/g, '')
    .replace(/[٠-٩۰-۹]/g, (digit) => ARABIC_DIGITS[digit] || digit)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' '))
}

export function stripArabicGreetings(value) {
  let text = normalizeArabicMessage(value)
  const normalizedGreetings = GREETINGS.map(normalizeArabicMessage).sort((a, b) => b.length - a.length)
  let changed = true
  while (changed && text) {
    changed = false
    for (const greeting of normalizedGreetings) {
      if (text === greeting || text.startsWith(`${greeting} `)) {
        text = text.slice(greeting.length).trim()
        changed = true
        break
      }
    }
  }
  return text
}

function sharedPrefix(left, right) {
  const limit = Math.min(left.length, right.length)
  let index = 0
  while (index < limit && left[index] === right[index]) index += 1
  return index
}

function conservativeTokenMatch(inputToken, keywordToken) {
  if (!inputToken || !keywordToken) return false
  if (inputToken === keywordToken) return true
  if (keywordToken.length >= 4 && inputToken.includes(keywordToken)) return true
  if (inputToken.length < 4 || keywordToken.length < 4) return false
  if (Math.abs(inputToken.length - keywordToken.length) > 2) return false
  return sharedPrefix(inputToken, keywordToken) >= 4
}

function keywordMatches(message, keyword) {
  const query = stripArabicGreetings(message)
  const key = normalizeArabicMessage(keyword)
  if (!query || !key) return false
  if (query === key || query.includes(key)) return true
  const queryTokens = query.split(' ')
  const keyTokens = key.split(' ')
  return keyTokens.every((needle) => queryTokens.some((token) => conservativeTokenMatch(token, needle)))
}

export function findRuleMatch(message, rules = []) {
  const enabled = [...rules]
    .filter((rule) => rule && rule.enabled !== false && Array.isArray(rule.keywords) && rule.keywords.length)
    .sort((a, b) => Number(b.priority || 0) - Number(a.priority || 0))
  for (const rule of enabled) {
    const results = rule.keywords.map((keyword) => keywordMatches(message, keyword))
    const type = rule.matchType || 'any'
    const matched = type === 'all'
      ? results.every(Boolean)
      : type === 'exact'
        ? rule.keywords.some((keyword) => stripArabicGreetings(message) === normalizeArabicMessage(keyword))
        : results.some(Boolean)
    if (matched) return rule
  }
  return null
}

function isGreetingOnly(text) {
  return Boolean(normalizeArabicMessage(text)) && !stripArabicGreetings(text)
}

function contentTokens(text) {
  return [...new Set(stripArabicGreetings(text).split(' ')
    .filter((token) => token.length >= 3 && !NOISE_WORDS.has(token)))]
}

function scoreContent(item, queryTokens) {
  if (!queryTokens.length) return { score: 0, matched: 0, headingMatches: 0 }
  const title = normalizeArabicMessage(item.title)
  const excerpt = normalizeArabicMessage(item.excerpt)
  const keywords = normalizeArabicMessage(item.keywords)
  const body = normalizeArabicMessage(item.body).slice(0, 20_000)
  let score = 0
  let matched = 0
  let headingMatches = 0
  for (const token of queryTokens) {
    const inTitle = title.includes(token)
    const inKeywords = keywords.includes(token)
    const inExcerpt = excerpt.includes(token)
    const inBody = body.includes(token)
    if (inTitle || inKeywords || inExcerpt || inBody) matched += 1
    if (inTitle || inKeywords) headingMatches += 1
    if (inTitle) score += 8
    else if (inKeywords) score += 5
    else if (inExcerpt) score += 3
    else if (inBody) score += 1
  }
  if (matched === queryTokens.length && queryTokens.length > 1) score += 6
  return { score, matched, headingMatches }
}

let contentIndexCache = null
function siteIndex() {
  if (contentIndexCache) return contentIndexCache
  try {
    contentIndexCache = buildContentIndex(process.cwd(), SITE_URL)
  } catch {
    contentIndexCache = []
  }
  return contentIndexCache
}

function exactSiteResults(query, overrideQuery = '') {
  const tokens = contentTokens(overrideQuery || query).slice(0, 8)
  if (!tokens.length) return []
  const rows = siteIndex()
    .map((item) => ({ item, ...scoreContent(item, tokens) }))
    .filter((row) => {
      if (tokens.length === 1) return row.score >= 8 && row.headingMatches >= 1
      const neededMatches = Math.min(tokens.length, Math.max(2, Math.ceil(tokens.length * .6)))
      return row.score >= 9 && row.matched >= neededMatches && row.headingMatches >= 1
    })
    .sort((a, b) => b.score - a.score || String(b.item.date || '').localeCompare(String(a.item.date || '')))
    .slice(0, 3)
  return rows.map((row) => row.item)
}

function siteResultReply(items) {
  const lines = items.map((item, index) => `${index + 1}) ${item.title}\n${item.url}`)
  return `وجدت في موقع الدكتور مواد منشورة مرتبطة بسؤالك:\n\n${lines.join('\n\n')}\n\nهذه روابط الموقع كما هي، من دون إضافة معلومات من خارجها.`
}

export function decideGroundedResponse({ text, hasMedia = false, rules = [], priorReplyHash = '' } = {}) {
  const clean = normalizeArabicMessage(text)
  if (hasMedia) return { kind: 'escalate', reason: 'media', reply: HUMAN_ACK }
  if (!clean) return { kind: 'escalate', reason: 'empty-after-normalization', reply: HUMAN_ACK }
  if (HUMAN_PATTERNS.some((pattern) => pattern.test(clean))) {
    return { kind: 'escalate', reason: 'human-request', reply: HUMAN_ACK }
  }

  const rule = findRuleMatch(text, rules)
  if (rule) {
    if (rule.actionType === 'transfer') return { kind: 'escalate', reason: `rule:${rule.id}`, reply: bounded(rule.responseText, 1_500) || HUMAN_ACK, rule }
    if (rule.actionType === 'site-content') {
      const found = exactSiteResults(text, rule.contentQuery)
      if (!found.length) return { kind: 'escalate', reason: `rule-no-grounding:${rule.id}`, reply: HUMAN_ACK, rule }
      return { kind: 'reply', reason: `rule:${rule.id}`, reply: siteResultReply(found), rule, evidence: found.map((item) => item.id) }
    }
    const response = bounded(rule.responseText, 2_000)
    if (response) return { kind: 'reply', reason: `rule:${rule.id}`, reply: response, rule }
  }

  if (PRICE_PATTERNS.some((pattern) => pattern.test(clean)) || isGreetingOnly(text)) {
    return { kind: 'reply', reason: isGreetingOnly(text) ? 'greeting' : 'site-is-source', reply: WELCOME }
  }

  const found = exactSiteResults(text)
  if (found.length) return { kind: 'reply', reason: 'site-index', reply: siteResultReply(found), evidence: found.map((item) => item.id) }

  const fallback = { kind: 'escalate', reason: 'no-grounded-answer', reply: HUMAN_ACK }
  if (priorReplyHash && hash(fallback.reply) === priorReplyHash) fallback.reply = 'سؤالك يحتاج تأكيدًا من الدكتور. تم تحويل المحادثة له ولن أضيف جوابًا غير موثّق.'
  return fallback
}

function safeEqualSecret(actual, expected) {
  const left = Buffer.from(String(actual || ''))
  const right = Buffer.from(String(expected || ''))
  if (!left.length || !right.length || left.length !== right.length) return false
  return timingSafeEqual(left, right)
}

async function readJson(req, limit = MAX_BODY_BYTES) {
  const chunks = []
  let size = 0
  for await (const chunk of req) {
    size += chunk.length
    if (size > limit) throw Object.assign(new Error('Payload too large'), { status: 413 })
    chunks.push(chunk)
  }
  if (!chunks.length) return {}
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'))
  } catch {
    throw Object.assign(new Error('Invalid JSON'), { status: 400 })
  }
}

function sendJson(res, status, body) {
  const data = Buffer.from(JSON.stringify(body))
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': data.length,
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
  })
  res.end(data)
}

function serializeDoc(snapshot) {
  return snapshot?.exists ? { id: snapshot.id, ...(snapshot.data() || {}) } : null
}

function normalizeAudienceDigits(value) {
  let digits = String(value || '')
    .replace(/[٠-٩]/g, (digit) => String(digit.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, (digit) => String(digit.charCodeAt(0) - 0x06f0))
    .replace(/\D/g, '')
    .replace(/^00+/, '')
  if (digits.length === 8) digits = `965${digits}`
  return /^\d{10,15}$/.test(digits) ? digits : ''
}

function audienceJid(value) {
  const digits = normalizeAudienceDigits(String(value || '').split('@', 1)[0])
  return digits ? `${digits}@c.us` : ''
}

function audienceContactId(jid) {
  return hash(`audience:${audienceJid(jid)}`).slice(0, 32)
}

function normalizeAudienceSearch(value) {
  return normalizeArabicMessage(value).replace(/\s+/g, ' ').trim()
}

function audienceDisplayName(row = {}) {
  return bounded(row.nickname || row.waName || row.displayName, 120) || `••${bounded(row.tail, 4)}`
}

function audienceVocative(row = {}) {
  const raw = audienceDisplayName(row).replace(/[‎‏]/g, '').replace(/\s+/g, ' ').trim()
  if (!raw || /^••\d{4}$/.test(raw)) return ''
  const title = raw.match(/^(?:(?:د|أ|ا|م)\s*\.|الدكتور(?:ة)?|دكتور(?:ة)?|الأستاذ(?:ة)?|استاذ(?:ة)?|الشيخ(?:ة)?)\s*/u)?.[0] || ''
  const rest = raw.slice(title.length).trim()
  const words = rest.split(/\s+/).filter(Boolean)
  const compound = /^(?:عبد|عبدال|أبو|ابو|أبا|ابا|أم|ام|ابن|بن|ذو|أبي|ابي|بو)$/u.test(words[0] || '')
  const first = compound && words[1] ? `${words[0]} ${words[1]}` : words[0] || ''
  return [title.trim(), first].filter(Boolean).join(' ')
}

function personalizeAudienceText(text, contact, at = new Date()) {
  const hour = Number(new Intl.DateTimeFormat('en-US', {
    hour: 'numeric', hour12: false, timeZone: 'Asia/Kuwait',
  }).format(at))
  const name = audienceVocative(contact)
  return bounded(text, 4_000)
    .replace(/\{تحية\}/g, hour < 12 ? 'صباح الخير' : 'مساء الخير')
    .replace(/\{ترحيب\}/g, 'أهلاً')
    .replace(/\{الاسم\}/g, name)
    .replace(/[ \t]+([،,.؛:!?؟])/g, '$1')
    .replace(/^[ \t]*[،,؛:]\s*$/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function parseAudienceImport(text) {
  const source = String(text || '').slice(0, MAX_BODY_BYTES)
    .replace(/\r\n[ \t]/g, '')
    .replace(/\n[ \t]/g, '')
    .replace(/^(PHOTO|LOGO|SOUND|KEY)[^:]*:.*$/gim, '')
  const rows = []
  if (/BEGIN:VCARD/i.test(source)) {
    for (const card of source.split(/BEGIN:VCARD/i).slice(1)) {
      const name = bounded(/^FN(?:;[^:]*)?:(.*)$/im.exec(card)?.[1], 120)
      const numbers = [...card.matchAll(/^TEL(?:;[^:]*)?:(.*)$/gim)]
      for (const match of numbers) rows.push({ name, phone: match[1] })
    }
  } else {
    for (const line of source.split(/\r?\n/).filter((item) => item.trim())) {
      const phoneMatch = line.match(/(?:\+|00)?[\d٠-٩۰-۹][\d٠-٩۰-۹\s().-]{6,}[\d٠-٩۰-۹]/)
      if (!phoneMatch) {
        rows.push({ name: '', phone: '' })
        continue
      }
      const name = bounded(line.replace(phoneMatch[0], '').replace(/^[\s,،;:|\-–—]+|[\s,،;:|\-–—]+$/g, ''), 120)
      rows.push({ name, phone: phoneMatch[0] })
    }
  }
  return rows
}

async function getAudienceContactsByIds(db, ids) {
  const unique = [...new Set(ids.filter(Boolean))]
  const contacts = []
  for (let offset = 0; offset < unique.length; offset += 250) {
    const refs = unique.slice(offset, offset + 250)
      .map((id) => db.collection(COLLECTIONS.audienceContacts).doc(id))
    if (!refs.length) continue
    const snapshots = await db.getAll(...refs)
    contacts.push(...snapshots.map(serializeDoc).filter(Boolean))
  }
  return contacts
}

async function listAudienceMembers(db, listId) {
  const memberships = await db.collection(COLLECTIONS.audienceMembers)
    .where('listId', '==', bounded(listId, 100)).limit(5_000).get()
  const contacts = await getAudienceContactsByIds(db, memberships.docs.map((doc) => doc.data()?.contactId))
  return contacts.sort((left, right) => audienceDisplayName(left).localeCompare(audienceDisplayName(right), 'ar'))
}

function bridgeStatus(data = {}) {
  const heartbeatAt = bounded(data.lastHeartbeatAt || data.updatedAt, 80)
  const heartbeatAgeMs = heartbeatAt ? Math.max(0, Date.now() - Date.parse(heartbeatAt)) : null
  const bridgeOnline = Number.isFinite(heartbeatAgeMs) && heartbeatAgeMs <= BRIDGE_ONLINE_MS
  const rawStatus = bounded(data.status, 40)
  const lastError = bounded(data.lastError, 600) || null
  const savedQr = bounded(data.qr, 8_000) || null
  const savedQrImage = bounded(data.qrImage, 500_000) || null
  const hasQr = Boolean(savedQr || savedQrImage)
  const explicitConnected = data.connected === true || rawStatus === 'connected'
  const inferredConnected = bridgeOnline && data.connected !== false && !hasQr && rawStatus === 'pairing' && !lastError
  const connected = Boolean(explicitConnected || inferredConnected)
  const normalizedStatus = !bridgeOnline
    ? 'disconnected'
    : connected
      ? 'connected'
      : hasQr
        ? 'pairing'
        : rawStatus || 'disconnected'
  return {
    status: normalizedStatus,
    bridgeOnline,
    lastHeartbeatAt: heartbeatAt || null,
    heartbeatAgeMs,
    last_error: lastError,
    device_name: bounded(data.deviceName, 120) || 'جسر واتساب المركزي',
    updated_at: bounded(data.updatedAt, 80) || null,
    qr: connected ? null : savedQr,
    qrImage: connected ? null : savedQrImage,
    pairing_code: null,
    runtimePaused: Boolean(data.runtimePaused),
    indexed: siteIndex().length,
    timeZone: 'Asia/Kuwait',
    health: {
      code: connected ? 'ready' : hasQr ? 'scan-qr' : bridgeOnline ? 'connecting' : 'offline',
      label: connected ? 'جاهز' : hasQr ? 'امسح رمز QR' : bridgeOnline ? 'يتصل' : 'الجسر غير متصل',
      why: connected ? 'الجلسة محفوظة والجسر يرسل نبضاته.' : 'الاتصال يحتاج إكمالًا أو تشغيل الخدمة.',
      fix: hasQr ? 'امسح الرمز من واتساب ← الأجهزة المرتبطة.' : 'راجع خدمة whatsapp-bridge على السيرفر.',
      ready: connected,
      needsAuthScan: Boolean(hasQr && !connected),
      connected,
      quietNow: Boolean(data.runtimePaused),
      silenced: 0,
      pollFailures: 0,
    },
  }
}

async function getConversation(db, jid) {
  const ref = db.collection(COLLECTIONS.conversations).doc(conversationId(jid))
  const snapshot = await ref.get()
  return { ref, data: snapshot.exists ? snapshot.data() || {} : {} }
}

async function listRules(db) {
  const snapshot = await db.collection(COLLECTIONS.rules).limit(250).get()
  return snapshot.docs.map(serializeDoc).filter(Boolean)
    .sort((a, b) => Number(b.priority || 0) - Number(a.priority || 0) || String(a.name || '').localeCompare(String(b.name || ''), 'ar'))
}

async function enqueueCommand(db, type, payload = {}, metadata = {}) {
  const id = randomUUID()
  const now = asIso()
  await db.collection(COLLECTIONS.commands).doc(id).set({
    id, type, payload, status: 'pending', attempts: 0, createdAt: now, updatedAt: now,
    availableAt: bounded(metadata.availableAt, 80) || now,
    campaignId: bounded(metadata.campaignId, 100) || null,
    campaignIndex: Number.isFinite(Number(metadata.campaignIndex)) ? Number(metadata.campaignIndex) : null,
  })
  return { id, type }
}

async function queueNextCampaignMessage(db, campaignId, delayMs = 0) {
  const ref = db.collection(COLLECTIONS.campaigns).doc(bounded(campaignId, 100))
  const snapshot = await ref.get()
  if (!snapshot.exists) return null
  const campaign = snapshot.data() || {}
  if (campaign.state !== 'sending' || campaign.pendingCommandId) return null
  const targets = Array.isArray(campaign.targetIds) ? campaign.targetIds.slice(0, 5_000) : []
  let cursor = Math.max(0, Number(campaign.cursor || 0))
  let contact = null
  while (cursor < targets.length && !contact) {
    const candidate = await db.collection(COLLECTIONS.audienceContacts).doc(bounded(targets[cursor], 100)).get()
    const data = serializeDoc(candidate)
    if (data && !data.suppressed && audienceJid(data.jid)) contact = data
    else cursor += 1
  }
  if (!contact) {
    await ref.set({
      state: 'completed',
      cursor: targets.length,
      pendingCommandId: null,
      completedAt: asIso(),
      updatedAt: asIso(),
    }, { merge: true })
    return null
  }
  const availableAt = asIso(Date.now() + Math.max(0, Number(delayMs || 0)))
  const command = await enqueueCommand(db, 'send-message', {
    jid: contact.jid,
    text: personalizeAudienceText(campaign.message, contact),
  }, { campaignId: ref.id, campaignIndex: cursor, availableAt })
  await ref.set({
    cursor: cursor + 1,
    pendingCommandId: command.id,
    nextAt: availableAt,
    updatedAt: asIso(),
  }, { merge: true })
  return command
}

async function sweepExpiredManualStates(db) {
  const now = Date.now()
  const snapshot = await db.collection(COLLECTIONS.conversations).limit(250).get()
  const writes = []
  for (const doc of snapshot.docs) {
    const data = doc.data() || {}
    const until = Date.parse(data.manualUntil || data.autoResumeAt || '')
    if (data.mode === 'human' && data.needsHuman !== true && Number.isFinite(until) && until <= now) {
      writes.push(doc.ref.set({
        mode: 'bot', manualUntil: null, autoResumeAt: null, notificationMutedUntil: null,
        updatedAt: asIso(), resumedAutomaticallyAt: asIso(),
      }, { merge: true }))
    }
  }
  await Promise.all(writes)
  return writes.length
}

function adminPath(url) {
  return url.pathname.slice('/api/admin/whatsapp'.length) || '/'
}

function bridgePath(url) {
  return url.pathname.slice('/api/whatsapp'.length) || '/'
}

export function createWhatsAppController({ getFirestore, verifyAdminRequest } = {}) {
  if (typeof getFirestore !== 'function') throw new Error('getFirestore is required')
  if (typeof verifyAdminRequest !== 'function') throw new Error('verifyAdminRequest is required')

  const bridgeSecret = String(process.env.WHATSAPP_BRIDGE_SECRET || '').trim()

  async function requireAdmin(req, res) {
    try {
      if (await verifyAdminRequest(req)) return true
    } catch {
      // الرد الموحد أدناه لا يكشف سبب فشل التوثيق.
    }
    sendJson(res, 403, { error: 'Admin access required' })
    return false
  }

  function requireBridge(req, res) {
    const supplied = req.headers['x-whatsapp-bridge-secret']
    if (bridgeSecret && safeEqualSecret(supplied, bridgeSecret)) return true
    sendJson(res, 401, { error: 'Invalid bridge secret' })
    return false
  }

  async function handleWebhook(req, res) {
    if (!requireBridge(req, res)) return
    const body = await readJson(req)
    const event = bounded(body.event, 40)
    const { db } = await getFirestore()
    const now = asIso()

    if (event === 'heartbeat' || event === 'status' || event === 'qr') {
      const patch = {
        lastHeartbeatAt: now,
        updatedAt: now,
        deviceName: bounded(body.deviceName, 120),
        version: bounded(body.version, 80),
        lastError: bounded(body.error, 600) || null,
      }
      const nextStatus = event === 'qr'
        ? 'pairing'
        : bounded(body.status, 40) || (body.connected === true ? 'connected' : '')
      if (nextStatus) patch.status = nextStatus
      if (body.connected === true) patch.connected = true
      else if (body.connected === false) patch.connected = false
      if (event === 'qr') {
        patch.qr = bounded(body.qr, 8_000)
        patch.qrImage = bounded(body.qrImage, 500_000)
      } else if (body.status === 'connected' || body.connected === true) {
        patch.qr = null
        patch.qrImage = null
      }
      await db.collection(COLLECTIONS.bridge).doc('primary').set(patch, { merge: true })
      if (event === 'heartbeat') await sweepExpiredManualStates(db)
      sendJson(res, 200, { ok: true })
      return
    }

    if (event === 'contacts-sync') {
      const contacts = Array.isArray(body.contacts) ? body.contacts.slice(0, 5_000) : []
      let accepted = 0
      let batch = db.batch()
      let batchSize = 0
      const flush = async () => {
        if (!batchSize) return
        await batch.commit()
        batch = db.batch()
        batchSize = 0
      }
      for (const item of contacts) {
        const jid = audienceJid(item?.jid || item?.id)
        if (!jid) continue
        const id = audienceContactId(jid)
        const digits = jid.split('@', 1)[0]
        const ref = db.collection(COLLECTIONS.audienceContacts).doc(id)
        const waName = bounded(item?.name || item?.pushname || item?.shortName, 120)
        const displayName = bounded(item?.displayName, 120)
        batch.set(ref, {
          id,
          jid,
          tail: digits.slice(-4),
          ...(waName ? { waName } : {}),
          ...(displayName ? { displayName } : {}),
          source: 'whatsapp-sync',
          lastSeenAt: now,
          updatedAt: now,
        }, { merge: true })
        accepted += 1
        batchSize += 1
        if (batchSize >= 400) await flush()
      }
      await flush()
      sendJson(res, 200, { ok: true, accepted })
      return
    }

    const jid = bounded(body.jid, 180)
    if (!jid || !/@(?:c|s)\.us$|@s\.whatsapp\.net$/.test(jid)) {
      sendJson(res, 400, { error: 'Invalid conversation id' })
      return
    }
    const { ref, data } = await getConversation(db, jid)

    if (event === 'manual') {
      const until = asIso(Date.now() + MANUAL_MINUTES * 60_000)
      await ref.set({
        jid,
        masked: maskJid(jid),
        mode: 'human',
        needsHuman: false,
        manualUntil: until,
        autoResumeAt: until,
        notificationMutedUntil: until,
        lastManualAt: now,
        updatedAt: now,
      }, { merge: true })
      sendJson(res, 200, { ok: true, mutedUntil: until })
      return
    }

    if (event === 'delivery-failed') {
      await ref.set({ lastDeliveryError: bounded(body.error, 600), lastDeliveryFailedAt: now, updatedAt: now }, { merge: true })
      sendJson(res, 200, { ok: true })
      return
    }

    if (event !== 'incoming') {
      sendJson(res, 400, { error: 'Unsupported webhook event' })
      return
    }

    const text = bounded(body.text, 12_000)
    const incomingHash = hash(normalizeArabicMessage(text) || `media:${bounded(body.mediaType, 80)}`)
    const lastInboundAt = Date.parse(data.lastInboundAt || '')
    const duplicate = data.lastIncomingHash === incomingHash && Number.isFinite(lastInboundAt) && Date.now() - lastInboundAt < 10 * 60_000
    const manualUntil = Date.parse(data.manualUntil || data.autoResumeAt || '')
    const manualActive = data.mode === 'human' && (
      data.needsHuman === true || (Number.isFinite(manualUntil) && manualUntil > Date.now())
    )

    const basePatch = {
      jid,
      masked: maskJid(jid),
      lastInboundAt: now,
      lastIncomingHash: incomingHash,
      lastMessageType: bounded(body.mediaType, 80) || 'text',
      updatedAt: now,
    }

    if (manualActive) {
      await ref.set(basePatch, { merge: true })
      sendJson(res, 200, { ok: true, action: 'none', reason: 'human-takeover' })
      return
    }

    if (duplicate) {
      const replyHash = hash(DUPLICATE_ACK)
      const reply = data.lastReplyHash === replyHash ? 'نعم، رسالتك محفوظة عندي.' : DUPLICATE_ACK
      await ref.set({ ...basePatch, mode: 'bot', lastReplyHash: hash(reply), lastReplyAt: now }, { merge: true })
      sendJson(res, 200, { ok: true, action: 'reply', reply: { text: reply }, reason: 'duplicate' })
      return
    }

    const settingsSnapshot = await db.collection(COLLECTIONS.settings).doc('runtime').get()
    const runtimePaused = Boolean(settingsSnapshot.exists && settingsSnapshot.data()?.paused)
    if (runtimePaused) {
      await ref.set(basePatch, { merge: true })
      sendJson(res, 200, { ok: true, action: 'none', reason: 'runtime-paused' })
      return
    }

    const rules = await listRules(db)
    const decision = decideGroundedResponse({
      text,
      hasMedia: Boolean(body.hasMedia),
      rules,
      priorReplyHash: bounded(data.lastReplyHash, 80),
    })
    const replyText = bounded(decision.reply, 2_000)
    const replyHash = hash(replyText)
    const safeReply = data.lastReplyHash === replyHash
      ? 'وصلت فكرتك. حتى لا أكرر الرد، سأترك المتابعة للدكتور إذا احتاج السؤال تأكيدًا.'
      : replyText

    if (decision.kind === 'escalate') {
      const eventId = randomUUID()
      await Promise.all([
        ref.set({
          ...basePatch,
          mode: 'human',
          needsHuman: true,
          manualUntil: null,
          autoResumeAt: null,
          notificationMutedUntil: null,
          escalationReason: decision.reason,
          escalatedAt: now,
          lastReplyHash: hash(safeReply),
          lastReplyAt: now,
        }, { merge: true }),
        db.collection(COLLECTIONS.events).doc(eventId).set({
          id: eventId,
          conversationId: ref.id,
          masked: maskJid(jid),
          reason: decision.reason,
          status: 'open',
          createdAt: now,
          updatedAt: now,
        }),
      ])
      sendJson(res, 200, {
        ok: true,
        action: 'reply-and-escalate',
        reason: decision.reason,
        reply: { text: safeReply },
        notifyOwner: {
          text: `${OWNER_ALERT_FALLBACK}\nالمحادثة: ${maskJid(jid)}\nالسبب: ${decision.reason}`,
          conversationId: jid,
        },
      })
      return
    }

    await ref.set({
      ...basePatch,
      mode: 'bot',
      needsHuman: false,
      manualUntil: null,
      autoResumeAt: null,
      lastReplyHash: hash(safeReply),
      lastReplyAt: now,
      lastEvidence: decision.evidence || [],
      lastDecisionReason: decision.reason,
    }, { merge: true })
    sendJson(res, 200, { ok: true, action: 'reply', reason: decision.reason, reply: { text: safeReply } })
  }

  async function handleBridgeCommand(req, res, url, method) {
    if (!requireBridge(req, res)) return
    const { db } = await getFirestore()
    if (method === 'GET') {
      const snapshot = await db.collection(COLLECTIONS.commands).limit(100).get()
      const now = Date.now()
      const pending = snapshot.docs.map(serializeDoc).filter((command) => {
        const availableAt = Date.parse(command.availableAt || command.createdAt || '')
        if (command.status === 'pending') return !Number.isFinite(availableAt) || availableAt <= now
        const lease = Date.parse(command.leasedAt || '')
        return command.status === 'leased' && Number.isFinite(lease) && now - lease > 90_000
      }).sort((a, b) => String(a.availableAt || a.createdAt || '').localeCompare(String(b.availableAt || b.createdAt || '')))[0]
      if (!pending) {
        sendJson(res, 200, { command: null })
        return
      }
      await db.collection(COLLECTIONS.commands).doc(pending.id).set({
        status: 'leased', leasedAt: asIso(), updatedAt: asIso(), attempts: Number(pending.attempts || 0) + 1,
      }, { merge: true })
      sendJson(res, 200, { command: pending })
      return
    }
    if (method === 'POST') {
      const body = await readJson(req)
      const id = bounded(body.commandId, 80)
      if (!id) {
        sendJson(res, 400, { error: 'commandId is required' })
        return
      }
      const commandRef = db.collection(COLLECTIONS.commands).doc(id)
      const commandSnapshot = await commandRef.get()
      const command = serializeDoc(commandSnapshot)
      await commandRef.set({
        status: body.ok === false ? 'failed' : 'completed',
        error: bounded(body.error, 600) || null,
        completedAt: asIso(),
        updatedAt: asIso(),
      }, { merge: true })
      if (command?.campaignId) {
        const campaignRef = db.collection(COLLECTIONS.campaigns).doc(command.campaignId)
        const campaignSnapshot = await campaignRef.get()
        const campaign = campaignSnapshot.data() || {}
        const succeeded = body.ok !== false
        await campaignRef.set({
          pendingCommandId: null,
          sent: Number(campaign.sent || 0) + (succeeded ? 1 : 0),
          failed: Number(campaign.failed || 0) + (succeeded ? 0 : 1),
          lastError: succeeded ? null : bounded(body.error, 600),
          lastDeliveredAt: succeeded ? asIso() : campaign.lastDeliveredAt || null,
          updatedAt: asIso(),
        }, { merge: true })
        const intervalMs = Math.max(20_000, Math.min(15 * 60_000, Number(campaign.intervalSeconds || 45) * 1_000))
        await queueNextCampaignMessage(db, command.campaignId, intervalMs)
      }
      sendJson(res, 200, { ok: true })
      return
    }
    sendJson(res, 405, { error: 'Method Not Allowed' })
  }

  async function handleAdmin(req, res, url, method) {
    if (!(await requireAdmin(req, res))) return
    const { db } = await getFirestore()
    const path = adminPath(url)

    if (path === '/status' && method === 'GET') {
      await sweepExpiredManualStates(db)
      const [bridgeSnapshot, runtimeSnapshot, conversations] = await Promise.all([
        db.collection(COLLECTIONS.bridge).doc('primary').get(),
        db.collection(COLLECTIONS.settings).doc('runtime').get(),
        db.collection(COLLECTIONS.conversations).limit(250).get(),
      ])
      const data = bridgeSnapshot.exists ? bridgeSnapshot.data() || {} : {}
      const status = bridgeStatus({ ...data, runtimePaused: Boolean(runtimeSnapshot.data()?.paused) })
      const now = Date.now()
      const silenced = conversations.docs.filter((doc) => {
        const row = doc.data() || {}
        const until = Date.parse(row.manualUntil || row.autoResumeAt || '')
        return row.mode === 'human' && (row.needsHuman === true || (Number.isFinite(until) && until > now))
      }).length
      status.health.silenced = silenced
      status.health.quietNow = status.runtimePaused || silenced > 0
      sendJson(res, 200, status)
      return
    }

    if (path === '/silence' && method === 'GET') {
      const snapshot = await db.collection(COLLECTIONS.conversations).limit(250).get()
      const active = snapshot.docs.map((doc) => doc.data() || {}).filter((row) => {
        const until = Date.parse(row.manualUntil || row.autoResumeAt || '')
        return row.mode === 'human' && (row.needsHuman === true || (Number.isFinite(until) && until > Date.now()))
      })
      const timestamps = active.map((row) => Date.parse(row.manualUntil || row.autoResumeAt || '')).filter(Number.isFinite)
      sendJson(res, 200, { silenced: active.length, until: timestamps.length ? asIso(Math.max(...timestamps)) : null })
      return
    }

    if (path === '/rules' && method === 'GET') {
      sendJson(res, 200, await listRules(db))
      return
    }

    if (path === '/rules' && ['POST', 'PATCH'].includes(method)) {
      const body = await readJson(req, 64 * 1024)
      const id = method === 'PATCH' ? bounded(body.id, 100) : randomUUID()
      if (!id || !bounded(body.name, 120) || !Array.isArray(body.keywords) || !body.keywords.length) {
        sendJson(res, 400, { error: 'الاسم وكلمة مطابقة واحدة على الأقل مطلوبان.' })
        return
      }
      const existing = await db.collection(COLLECTIONS.rules).doc(id).get()
      if (existing.exists) {
        const versionId = Date.now()
        await db.collection(COLLECTIONS.ruleVersions).doc(`${id}:${versionId}`).set({
          id: versionId, ruleId: id, snapshot: existing.data(), createdAt: asIso(),
        })
      }
      const rule = {
        id,
        name: bounded(body.name, 120),
        keywords: body.keywords.map((value) => bounded(value, 100)).filter(Boolean).slice(0, 40),
        priority: Math.max(-100, Math.min(1_000, Number(body.priority || 0))),
        matchType: ['any', 'all', 'exact'].includes(body.matchType) ? body.matchType : 'any',
        actionType: ['text', 'site-content', 'transfer'].includes(body.actionType) ? body.actionType : 'text',
        responseText: bounded(body.responseText, 2_000),
        contentQuery: bounded(body.contentQuery, 500),
        enabled: body.enabled !== false,
        updatedAt: asIso(),
      }
      await db.collection(COLLECTIONS.rules).doc(id).set(rule)
      sendJson(res, 200, rule)
      return
    }

    const ruleDelete = /^\/rules\/([^/]+)$/.exec(path)
    if (ruleDelete && method === 'DELETE') {
      const id = decodeURIComponent(ruleDelete[1])
      const ref = db.collection(COLLECTIONS.rules).doc(id)
      const current = await ref.get()
      if (current.exists) {
        const versionId = Date.now()
        await db.collection(COLLECTIONS.ruleVersions).doc(`${id}:${versionId}`).set({
          id: versionId, ruleId: id, snapshot: current.data(), createdAt: asIso(),
        })
        await ref.delete()
      }
      sendJson(res, 200, { ok: true })
      return
    }

    const versionsMatch = /^\/rules\/([^/]+)\/versions$/.exec(path)
    if (versionsMatch && method === 'GET') {
      const id = decodeURIComponent(versionsMatch[1])
      const snapshot = await db.collection(COLLECTIONS.ruleVersions).limit(250).get()
      const versions = snapshot.docs.map(serializeDoc).filter((row) => row.ruleId === id)
        .sort((a, b) => Number(b.id || 0) - Number(a.id || 0))
        .map(({ id: docId, ...row }) => ({ ...row, id: Number(row.id || String(docId).split(':').at(-1)) }))
      sendJson(res, 200, versions)
      return
    }

    const rollbackMatch = /^\/rules\/([^/]+)\/rollback\/(\d+)$/.exec(path)
    if (rollbackMatch && method === 'POST') {
      const id = decodeURIComponent(rollbackMatch[1])
      const versionId = rollbackMatch[2]
      const snapshot = await db.collection(COLLECTIONS.ruleVersions).doc(`${id}:${versionId}`).get()
      if (!snapshot.exists || !snapshot.data()?.snapshot) {
        sendJson(res, 404, { error: 'Version not found' })
        return
      }
      await db.collection(COLLECTIONS.rules).doc(id).set({ ...snapshot.data().snapshot, id, updatedAt: asIso() })
      sendJson(res, 200, { ok: true })
      return
    }

    if (path === '/restart' && method === 'POST') {
      sendJson(res, 200, { ok: true, command: await enqueueCommand(db, 'restart') })
      return
    }
    if (path === '/repair' && method === 'POST') {
      sendJson(res, 200, { ok: true, command: await enqueueCommand(db, 'repair-session'), message: 'أُرسل طلب إعادة الربط إلى الجسر المركزي.' })
      return
    }
    if (path === '/agent/pause' && method === 'POST') {
      await db.collection(COLLECTIONS.settings).doc('runtime').set({ paused: true, updatedAt: asIso() }, { merge: true })
      sendJson(res, 200, { ok: true })
      return
    }
    if (path === '/agent/resume' && method === 'POST') {
      await db.collection(COLLECTIONS.settings).doc('runtime').set({ paused: false, updatedAt: asIso() }, { merge: true })
      sendJson(res, 200, { ok: true })
      return
    }
    if (path === '/manual-takeover' && method === 'POST') {
      const body = await readJson(req)
      const jid = bounded(body.jid, 180)
      const minutes = Math.max(5, Math.min(240, Number(body.minutes || MANUAL_MINUTES)))
      const until = asIso(Date.now() + minutes * 60_000)
      const { ref } = await getConversation(db, jid)
      await ref.set({ jid, masked: maskJid(jid), mode: 'human', needsHuman: false, manualUntil: until, autoResumeAt: until, notificationMutedUntil: until, updatedAt: asIso() }, { merge: true })
      sendJson(res, 200, { ok: true, until })
      return
    }
    if (path === '/bot-return' && method === 'POST') {
      const body = await readJson(req)
      const { ref } = await getConversation(db, bounded(body.jid, 180))
      await ref.set({ mode: 'bot', needsHuman: false, manualUntil: null, autoResumeAt: null, notificationMutedUntil: null, updatedAt: asIso() }, { merge: true })
      sendJson(res, 200, { ok: true })
      return
    }
    if (path === '/bot-return-all' && method === 'POST') {
      const snapshot = await db.collection(COLLECTIONS.conversations).limit(500).get()
      const rows = snapshot.docs.filter((doc) => doc.data()?.mode === 'human')
      await Promise.all(rows.map((doc) => doc.ref.set({ mode: 'bot', needsHuman: false, manualUntil: null, autoResumeAt: null, notificationMutedUntil: null, updatedAt: asIso() }, { merge: true })))
      sendJson(res, 200, { returned: rows.length })
      return
    }

    if (path === '/audience/contacts' && method === 'GET') {
      const term = normalizeAudienceSearch(url.searchParams.get('q') || '')
      const limit = Math.max(1, Math.min(500, Number(url.searchParams.get('limit') || 200)))
      const offset = Math.max(0, Number(url.searchParams.get('offset') || 0))
      const [contactSnapshot, membershipSnapshot] = await Promise.all([
        db.collection(COLLECTIONS.audienceContacts).limit(5_000).get(),
        db.collection(COLLECTIONS.audienceMembers).limit(10_000).get(),
      ])
      const listCounts = new Map()
      for (const membership of membershipSnapshot.docs) {
        const id = bounded(membership.data()?.contactId, 100)
        if (id) listCounts.set(id, Number(listCounts.get(id) || 0) + 1)
      }
      const contacts = contactSnapshot.docs.map(serializeDoc).filter(Boolean)
        .map((contact) => ({
          id: contact.id,
          name: audienceDisplayName(contact),
          nickname: bounded(contact.nickname, 120),
          waName: bounded(contact.waName || contact.displayName, 120),
          tail: bounded(contact.tail, 4),
          suppressed: Boolean(contact.suppressed),
          lists: Number(listCounts.get(contact.id) || 0),
        }))
        .filter((contact) => !term
          || normalizeAudienceSearch(contact.name).includes(term)
          || contact.tail.includes(term))
        .sort((left, right) => left.name.localeCompare(right.name, 'ar'))
      sendJson(res, 200, {
        contacts: contacts.slice(offset, offset + limit),
        total: contacts.length,
        offset,
        limit,
      })
      return
    }

    if (path === '/audience/contacts' && method === 'POST') {
      const body = await readJson(req)
      const digits = normalizeAudienceDigits(body.phone)
      if (!digits) {
        sendJson(res, 400, { error: 'الرقم غير مكتمل.' })
        return
      }
      const jid = `${digits}@c.us`
      const id = audienceContactId(jid)
      const nickname = bounded(body.nickname, 120)
      await db.collection(COLLECTIONS.audienceContacts).doc(id).set({
        id,
        jid,
        tail: digits.slice(-4),
        ...(nickname ? { nickname, displayName: nickname } : {}),
        source: 'manual',
        updatedAt: asIso(),
        createdAt: asIso(),
      }, { merge: true })
      sendJson(res, 200, { ok: true, id })
      return
    }

    if (path === '/audience/import' && method === 'POST') {
      const body = await readJson(req, MAX_BODY_BYTES)
      const parsed = parseAudienceImport(body.text)
      const normalized = new Map()
      const skipped = []
      for (const [index, item] of parsed.entries()) {
        const digits = normalizeAudienceDigits(item.phone)
        if (!digits) {
          skipped.push(index)
          continue
        }
        const jid = `${digits}@c.us`
        const id = audienceContactId(jid)
        if (!normalized.has(id)) normalized.set(id, {
          id, jid, tail: digits.slice(-4), name: bounded(item.name, 120),
        })
      }
      const rows = [...normalized.values()]
      const knownSnapshots = await getAudienceContactsByIds(db, rows.map((row) => row.id))
      const knownIds = new Set(knownSnapshots.map((row) => row.id))
      const newcomers = []
      let batch = db.batch()
      let writes = 0
      const commit = async () => {
        if (!writes) return
        await batch.commit()
        batch = db.batch()
        writes = 0
      }
      for (const row of rows) {
        const isKnown = knownIds.has(row.id)
        const ref = db.collection(COLLECTIONS.audienceContacts).doc(row.id)
        batch.set(ref, {
          id: row.id,
          jid: row.jid,
          tail: row.tail,
          ...(row.name ? { displayName: row.name } : {}),
          source: isKnown ? 'import-refresh' : 'import',
          updatedAt: asIso(),
          ...(!isKnown ? { createdAt: asIso() } : {}),
        }, { merge: true })
        writes += 1
        if (!isKnown) newcomers.push({ id: row.id, name: row.name || `••${row.tail}`, tail: row.tail })
        if (body.listId) {
          const memberId = `${bounded(body.listId, 100)}:${row.id}`
          batch.set(db.collection(COLLECTIONS.audienceMembers).doc(memberId), {
            id: memberId, listId: bounded(body.listId, 100), contactId: row.id, createdAt: asIso(),
          }, { merge: true })
          writes += 1
        }
        if (writes >= 390) await commit()
      }
      await commit()
      sendJson(res, 200, {
        ok: true,
        added: newcomers.length,
        known: rows.length - newcomers.length,
        skipped,
        newcomers: newcomers.slice(0, 60),
      })
      return
    }

    if (path === '/audience/nickname' && method === 'POST') {
      const body = await readJson(req)
      const id = bounded(body.contactId, 100)
      if (!id) {
        sendJson(res, 400, { error: 'جهة الاتصال مطلوبة.' })
        return
      }
      await db.collection(COLLECTIONS.audienceContacts).doc(id).set({
        nickname: bounded(body.nickname, 120) || null,
        updatedAt: asIso(),
      }, { merge: true })
      sendJson(res, 200, { ok: true })
      return
    }

    if (path === '/audience/lists' && method === 'GET') {
      const snapshot = await db.collection(COLLECTIONS.audienceLists).limit(500).get()
      const lists = snapshot.docs.map(serializeDoc).filter(Boolean)
        .map((list) => ({
          id: list.id,
          name: bounded(list.name, 120) || 'قائمة بلا اسم',
          note: bounded(list.note, 300),
          kind: bounded(list.kind, 40) || 'manual',
          count: Number(list.count || 0),
        }))
        .sort((left, right) => left.name.localeCompare(right.name, 'ar'))
      sendJson(res, 200, { lists })
      return
    }

    if (path === '/audience/lists' && method === 'POST') {
      const body = await readJson(req)
      if (body.action === 'delete') {
        const id = bounded(body.id, 100)
        const members = await db.collection(COLLECTIONS.audienceMembers).where('listId', '==', id).limit(5_000).get()
        let batch = db.batch()
        let writes = 0
        for (const member of members.docs) {
          batch.delete(member.ref)
          writes += 1
          if (writes >= 400) {
            await batch.commit()
            batch = db.batch()
            writes = 0
          }
        }
        batch.delete(db.collection(COLLECTIONS.audienceLists).doc(id))
        await batch.commit()
        sendJson(res, 200, { ok: true })
        return
      }
      const name = bounded(body.name, 120)
      if (!name) {
        sendJson(res, 400, { error: 'اسم القائمة مطلوب.' })
        return
      }
      const id = body.action === 'rename' ? bounded(body.id, 100) : randomUUID()
      await db.collection(COLLECTIONS.audienceLists).doc(id).set({
        id,
        name,
        note: bounded(body.note, 300),
        kind: 'manual',
        ...(body.action === 'rename' ? {} : { count: 0, createdAt: asIso() }),
        updatedAt: asIso(),
      }, { merge: true })
      sendJson(res, 200, { ok: true, id })
      return
    }

    if (path === '/audience/members' && method === 'GET') {
      const members = await listAudienceMembers(db, url.searchParams.get('list') || '')
      sendJson(res, 200, {
        members: members.map((contact) => ({
          id: contact.id,
          name: audienceDisplayName(contact),
          vocative: audienceVocative(contact),
          nickname: bounded(contact.nickname, 120),
          tail: bounded(contact.tail, 4),
          suppressed: Boolean(contact.suppressed),
        })),
      })
      return
    }

    if (path === '/audience/members' && method === 'POST') {
      const body = await readJson(req)
      const listId = bounded(body.listId, 100)
      if (!listId) {
        sendJson(res, 400, { error: 'القائمة مطلوبة.' })
        return
      }
      if (body.action === 'remove') {
        const contactId = bounded(body.contactId, 100)
        await db.collection(COLLECTIONS.audienceMembers).doc(`${listId}:${contactId}`).delete()
      } else {
        const contactIds = [...new Set((Array.isArray(body.contactIds) ? body.contactIds : [])
          .map((id) => bounded(id, 100)).filter(Boolean))].slice(0, 5_000)
        let batch = db.batch()
        let writes = 0
        for (const contactId of contactIds) {
          const memberId = `${listId}:${contactId}`
          batch.set(db.collection(COLLECTIONS.audienceMembers).doc(memberId), {
            id: memberId, listId, contactId, createdAt: asIso(),
          }, { merge: true })
          writes += 1
          if (writes >= 400) {
            await batch.commit()
            batch = db.batch()
            writes = 0
          }
        }
        if (writes) await batch.commit()
      }
      const countSnapshot = await db.collection(COLLECTIONS.audienceMembers).where('listId', '==', listId).count().get()
      const count = Number(countSnapshot.data()?.count || 0)
      await db.collection(COLLECTIONS.audienceLists).doc(listId).set({ count, updatedAt: asIso() }, { merge: true })
      sendJson(res, 200, { ok: true, count })
      return
    }

    if (path === '/audience/preview' && method === 'POST') {
      const body = await readJson(req)
      const members = await listAudienceMembers(db, bounded(body.listId, 100))
      const send = members.filter((contact) => !contact.suppressed)
      sendJson(res, 200, {
        samples: send.slice(0, 3).map((contact) => ({
          name: audienceDisplayName(contact),
          body: personalizeAudienceText(body.text, contact),
        })),
        willSend: send.length,
        suppressed: members.length - send.length,
      })
      return
    }

    if (path === '/send-self-preview' && method === 'POST') {
      const body = await readJson(req)
      const text = bounded(body.message || body.text, 4_000)
      if (!text) {
        sendJson(res, 400, { error: 'نص المعاينة مطلوب.' })
        return
      }
      const command = await enqueueCommand(db, 'send-self-message', { text })
      sendJson(res, 200, { ok: true, queued: true, messageId: command.id })
      return
    }

    if (path === '/audience/draft' && method === 'POST') {
      const body = await readJson(req)
      const listId = bounded(body.listId, 100)
      const message = bounded(body.message, 4_000)
      if (!listId || !message) {
        sendJson(res, 400, { error: 'القائمة والرسالة مطلوبتان.' })
        return
      }
      const list = await db.collection(COLLECTIONS.audienceLists).doc(listId).get()
      if (!list.exists) {
        sendJson(res, 404, { error: 'القائمة غير موجودة.' })
        return
      }
      const members = await listAudienceMembers(db, listId)
      const targetIds = members.filter((contact) => !contact.suppressed).map((contact) => contact.id)
      const id = randomUUID()
      await db.collection(COLLECTIONS.campaigns).doc(id).set({
        id,
        listId,
        name: bounded(body.name, 180) || bounded(list.data()?.name, 120) || 'بث واتساب',
        message,
        targetIds,
        total: targetIds.length,
        sent: 0,
        failed: 0,
        cursor: 0,
        state: 'draft',
        createdAt: asIso(),
        updatedAt: asIso(),
      })
      sendJson(res, 200, { id, state: 'draft', total: targetIds.length })
      return
    }

    const campaignApprove = /^\/campaigns\/([^/]+)\/approve$/.exec(path)
    if (campaignApprove && method === 'POST') {
      const body = await readJson(req)
      if (body.confirm !== true) {
        sendJson(res, 400, { error: 'التأكيد مطلوب.' })
        return
      }
      const id = decodeURIComponent(campaignApprove[1])
      await db.collection(COLLECTIONS.campaigns).doc(id).set({
        state: 'approved', approvedAt: asIso(), updatedAt: asIso(),
      }, { merge: true })
      sendJson(res, 200, { id, state: 'approved' })
      return
    }

    const campaignSend = /^\/campaigns\/([^/]+)\/send-quiet$/.exec(path)
    if (campaignSend && method === 'POST') {
      const body = await readJson(req)
      if (body.confirm !== true || body.confirmAgain !== true) {
        sendJson(res, 400, { error: 'يلزم التأكيد مرتين قبل البث.' })
        return
      }
      const id = decodeURIComponent(campaignSend[1])
      const ref = db.collection(COLLECTIONS.campaigns).doc(id)
      const snapshot = await ref.get()
      if (!snapshot.exists || !['approved', 'paused'].includes(snapshot.data()?.state)) {
        sendJson(res, 409, { error: 'المسودة غير معتمدة أو بدأ إرسالها بالفعل.' })
        return
      }
      const intervalSeconds = Math.max(20, Math.min(15 * 60, Number(body.intervalSeconds || 45)))
      await ref.set({
        state: 'sending',
        intervalSeconds,
        startedAt: snapshot.data()?.startedAt || asIso(),
        updatedAt: asIso(),
      }, { merge: true })
      const command = await queueNextCampaignMessage(db, id, 0)
      sendJson(res, 202, { id, state: command ? 'sending' : 'completed', total: Number(snapshot.data()?.total || 0) })
      return
    }

    if (path === '/simulate' && method === 'POST') {
      const body = await readJson(req)
      const rules = await listRules(db)
      const decision = decideGroundedResponse({ text: body.text, rules })
      sendJson(res, 200, {
        willReply: true,
        why: decision.reason,
        quietNow: false,
        intent: decision.reason,
        mode: decision.kind === 'escalate' ? 'human' : 'bot',
        confidence: decision.kind === 'escalate' ? 0 : 1,
        needsHuman: decision.kind === 'escalate',
        ruleId: decision.rule?.id || null,
        ruleName: decision.rule?.name || null,
        preview: decision.reply,
      })
      return
    }

    if (path === '/learning' && method === 'GET') {
      sendJson(res, 200, { total: 0, learned: 0, observing: 0, ignored: 0, policy: 'لا يتعلم النظام من محادثات الناس تلقائيًا؛ كل قاعدة تعتمدها أنت صراحة.', items: [] })
      return
    }
    if (path === '/knowledge' && method === 'GET') {
      const index = siteIndex()
      sendJson(res, 200, {
        modes: [
          { id: 'site-only', label: 'الموقع فقط', boundary: 'لا إجابة بلا رابط أو قاعدة معتمدة.' },
          { id: 'human', label: 'تصعيد بشري', boundary: 'الصورة والملف والسؤال غير الموثق تتحول للبشر.' },
        ],
        sourcePolicies: { site: ['المقالات', 'الكتب', 'الأبحاث', 'المواد المنشورة'], customRules: ['قواعد تعتمدها من اللوحة'] },
        evidence: { total: index.length, enabled: index.length, lastUpdatedAt: asIso(), domains: [{ domain: new URL(SITE_URL).hostname, total: index.length, enabled: index.length }] },
        conversations: { active: 0, human: 0, intents: [], gaps: [], answers: [] },
        personality: { verbosity: 'brief', dialect: 'kuwaiti-light', initiative: 'none', signature: 'always', memoryConsent: 'explicit' },
        privacy: 'تُقنّع الأرقام في السجلات، ولا يتعلم البوت من كلام الناس تلقائيًا.',
      })
      return
    }
    if (path.startsWith('/trusted-evidence') && method === 'GET') {
      sendJson(res, 200, [])
      return
    }

    sendJson(res, 404, { error: 'WhatsApp admin endpoint not found' })
  }

  return async function handleWhatsAppRequest(req, res, url, method = req.method || 'GET') {
    try {
      if (url.pathname.startsWith('/api/whatsapp/')) {
        const path = bridgePath(url)
        if (path === '/webhook' && method === 'POST') await handleWebhook(req, res)
        else if (path === '/commands') await handleBridgeCommand(req, res, url, method)
        else sendJson(res, 404, { error: 'WhatsApp bridge endpoint not found' })
        return true
      }
      if (url.pathname.startsWith('/api/admin/whatsapp')) {
        await handleAdmin(req, res, url, method)
        return true
      }
      return false
    } catch (error) {
      sendJson(res, Number(error?.status || 500), {
        error: Number(error?.status || 500) >= 500 ? 'WhatsApp service error' : bounded(error?.message, 300),
      })
      return true
    }
  }
}

export const whatsappPolicy = Object.freeze({
  siteUrl: SITE_URL,
  manualTakeoverMinutes: MANUAL_MINUTES,
  zeroHallucination: true,
  paidAiApis: false,
})
