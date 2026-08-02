/*
 * مزامنة «مساحتي» عبر الأجهزة — اختيارية، بلا حساب ولا بريد.
 *
 * الفلسفة: الوضع المحلي يبقى الافتراضي (خصوصية كاملة). من أراد المزامنة بين
 * هاتفه وحاسوبه يُنشئ «رمز مزامنة» سرّياً؛ تُشفَّر داخل المتصفح بيانات موضع
 * القراءة والتظليلات وقائمة الاستماع والمحفوظات والمسارات والفعاليات قبل رفعها
 * إلى Firestore. لا يصل إلى السحابة سوى نص مشفّر، والرمز هو مفتاح فكّه؛ لذلك
 * يُنبَّه المستخدم إلى حفظه سرياً وعدم مشاركته.
 *
 * الدمج لا يُهدر: القوائم تُوحَّد (لا يضيع تظليلٌ من جهاز)، وموضع القراءة يأخذ
 * الأبعد، والمؤشّرات المفردة يفوز فيها الأحدث دفعاً. وكلُّ شيءٍ يتحمّل غياب
 * Firestore بسلاسة: يبقى محلياً ولا ينكسر.
 */

const CODE_KEY = 'myspace:sync-code:v1'
const COLLECTION = 'myspace_sync'
const SYNC_COOLDOWN_MS = 4_000
let lastSyncAt = 0
let lastSyncCode = ''

/* المفاتيح الشخصية التي تُزامَن (لا شيء من بيانات الموقع العامة). */
const EXACT_KEYS = [
  'read:last',
  'reader:recent:v1',
  'reader:quotes:v2',
  'reader:saved:v1',
  'reader:read:v1',
  'audio:last:v1',
  'media:watch-later:v1',
  'thought-paths:last:v1',
  'journey:last-path',
  'reader:preferences:v2',
  'idea-memory:v1',
]
const PREFIX_KEYS = ['reader:progress:v2:']

export type SyncState = Record<string, string>

const hasWindow = () => typeof window !== 'undefined'

export function getSyncCode(): string | null {
  if (!hasWindow()) return null
  try { return window.localStorage.getItem(CODE_KEY) } catch { return null }
}

export function setSyncCode(code: string | null) {
  if (!hasWindow()) return
  try {
    if (code) window.localStorage.setItem(CODE_KEY, code)
    else window.localStorage.removeItem(CODE_KEY)
  } catch { /* التخزين قد يكون محجوباً */ }
}

/** رمزٌ سهل النطق بلا حروفٍ ملتبسة، طويلٌ بما يكفي ليصعب تخمينه. */
export function generateSyncCode(): string {
  const alphabet = 'abcdefghjkmnpqrstuvwxyz23456789'
  const pick = (n: number) => {
    const bytes = hasWindow() && window.crypto?.getRandomValues
      ? window.crypto.getRandomValues(new Uint8Array(n))
      : Array.from({ length: n }, () => Math.floor(Math.random() * 256))
    return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join('')
  }
  return `${pick(4)}-${pick(4)}-${pick(4)}`
}

export function normalizeSyncCode(raw: string): string {
  return String(raw || '').trim().toLowerCase().replace(/\s+/g, '').replace(/[^a-z0-9-]/g, '')
}

function allSyncKeys(): string[] {
  const keys = new Set(EXACT_KEYS)
  if (hasWindow()) {
    try {
      for (let index = 0; index < window.localStorage.length; index++) {
        const key = window.localStorage.key(index)
        if (key && PREFIX_KEYS.some((prefix) => key.startsWith(prefix))) keys.add(key)
      }
    } catch { /* تجاهل */ }
  }
  return [...keys]
}

export function collectLocalState(): SyncState {
  const state: SyncState = {}
  if (!hasWindow()) return state
  for (const key of allSyncKeys()) {
    try { const value = window.localStorage.getItem(key); if (value != null) state[key] = value } catch { /* تجاهل */ }
  }
  return state
}

function parse(value: string): unknown {
  try { return JSON.parse(value) } catch { return value }
}

function identity(item: unknown): string {
  if (item && typeof item === 'object') {
    const record = item as Record<string, unknown>
    for (const field of ['slug', 'id', 'key', 'url']) {
      if (record[field] != null) return `${field}:${String(record[field])}`
    }
  }
  return JSON.stringify(item)
}

/** يوحّد قائمتين بلا تكرار، مبقياً أحدث نسخةٍ لكل عنصرٍ متطابق الهوية. */
function unionArrays(local: unknown[], remote: unknown[]): unknown[] {
  const byId = new Map<string, unknown>()
  for (const item of [...local, ...remote]) byId.set(identity(item), item)
  return [...byId.values()]
}

/** دمج قيمة مفتاحٍ واحد: القوائم تُوحَّد، وغيرها يفوز فيه الأحدث (البعيد دفعاً). */
export function mergeValue(key: string, localRaw: string, remoteRaw: string): string {
  if (key.startsWith('reader:progress:v2:')) {
    /* العطب الذي صفّر «أكمل القراءة»: القيمة المخزنة كائن {progress, updatedAt}
       وكان الدمج يحوّله برقمٍ مباشر Number(object)=NaN فيكتب "0" فوق كل تقدم
       مع كل مزامنة. الدمج الصحيح: الأحدث زمنياً يفوز (يحترم «من البداية»
       المتعمدة)، مع قبول الشكل الرقمي القديم ومعالجة القيم الفاسدة. */
    const normalize = (raw: string) => {
      const value = parse(raw) as { progress?: number; updatedAt?: number } | number | string
      if (typeof value === 'number') return { progress: Math.min(1, Math.max(0, value)), updatedAt: 0 }
      if (value && typeof value === 'object') {
        return {
          progress: Math.min(1, Math.max(0, Number((value as { progress?: number }).progress || 0))),
          updatedAt: Math.max(0, Number((value as { updatedAt?: number }).updatedAt || 0)),
        }
      }
      return { progress: 0, updatedAt: 0 }
    }
    const local = normalize(localRaw)
    const remote = normalize(remoteRaw)
    const winner = remote.updatedAt > local.updatedAt ? remote : local
    return JSON.stringify({ progress: winner.progress, updatedAt: Math.max(local.updatedAt, remote.updatedAt) })
  }
  const local = parse(localRaw)
  const remote = parse(remoteRaw)
  if (Array.isArray(local) && Array.isArray(remote)) return JSON.stringify(unionArrays(local, remote))
  return remoteRaw
}

/** يدمج حالتين محليةً وسحابيةً بلا فقدان. */
export function mergeStates(localState: SyncState, remoteState: SyncState): SyncState {
  const merged: SyncState = { ...localState }
  for (const [key, remoteValue] of Object.entries(remoteState)) {
    const localValue = localState[key]
    merged[key] = localValue == null ? remoteValue : mergeValue(key, localValue, remoteValue)
  }
  return merged
}

const CHANGE_EVENTS = ['reader:space-changed', 'reader:quotes-changed', 'reader:journey-changed', 'reader:preferences-changed', 'media:watch-later-changed']

export function applyState(state: SyncState) {
  if (!hasWindow()) return
  for (const [key, value] of Object.entries(state)) {
    try { window.localStorage.setItem(key, value) } catch { /* تجاهل */ }
  }
  for (const event of CHANGE_EVENTS) {
    try { window.dispatchEvent(new CustomEvent(event)) } catch { /* تجاهل */ }
  }
}

type EncryptedEnvelope = {
  version: 2
  algorithm: 'AES-GCM'
  salt: string
  iv: string
  ciphertext: string
}

const bytesToBase64 = (bytes: Uint8Array) => {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary)
}

const base64ToBytes = (value: string) => {
  const binary = atob(value)
  return Uint8Array.from(binary, (char) => char.charCodeAt(0))
}

async function encryptionKey(code: string, salt: Uint8Array) {
  if (!hasWindow() || !window.crypto?.subtle) return null
  const material = await window.crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(normalizeSyncCode(code)),
    'PBKDF2',
    false,
    ['deriveKey'],
  )
  return window.crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: 180_000, hash: 'SHA-256' },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  )
}

async function encryptState(code: string, state: SyncState): Promise<string | null> {
  try {
    if (!window.crypto?.getRandomValues) return null
    const salt = window.crypto.getRandomValues(new Uint8Array(16))
    const iv = window.crypto.getRandomValues(new Uint8Array(12))
    const key = await encryptionKey(code, salt)
    if (!key) return null
    const encrypted = await window.crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      key,
      new TextEncoder().encode(JSON.stringify(state)),
    )
    const envelope: EncryptedEnvelope = {
      version: 2,
      algorithm: 'AES-GCM',
      salt: bytesToBase64(salt),
      iv: bytesToBase64(iv),
      ciphertext: bytesToBase64(new Uint8Array(encrypted)),
    }
    return JSON.stringify(envelope)
  } catch {
    return null
  }
}

async function decryptState(code: string, raw: string): Promise<SyncState | null> {
  try {
    const parsed = parse(raw)
    if (!parsed || typeof parsed !== 'object') return null
    const envelope = parsed as Partial<EncryptedEnvelope>
    if (envelope.version !== 2) return parsed as SyncState
    if (envelope.algorithm !== 'AES-GCM' || !envelope.salt || !envelope.iv || !envelope.ciphertext) return null
    const salt = base64ToBytes(envelope.salt)
    const iv = base64ToBytes(envelope.iv)
    const key = await encryptionKey(code, salt)
    if (!key) return null
    const decrypted = await window.crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      key,
      base64ToBytes(envelope.ciphertext),
    )
    const state = JSON.parse(new TextDecoder().decode(decrypted))
    return state && typeof state === 'object' ? state as SyncState : null
  } catch {
    return null
  }
}

async function cloudDoc(code: string) {
  const { getDb } = await import('./firebase')
  const db = await getDb()
  if (!db) return null
  const { doc } = await import('firebase/firestore')
  return { db, ref: doc(db, COLLECTION, code) }
}

/** يسحب حالة السحابة لهذا الرمز، أو null إن تعذّر/غاب. */
export async function pullFromCloud(code: string): Promise<SyncState | null> {
  try {
    const handle = await cloudDoc(code)
    if (!handle) return null
    const { getDoc } = await import('firebase/firestore')
    const snapshot = await getDoc(handle.ref)
    if (!snapshot.exists()) return null
    const raw = snapshot.data()?.data
    if (typeof raw !== 'string') return null
    return await decryptState(code, raw)
  } catch { return null }
}

/** يدفع الحالة إلى السحابة تحت الرمز. يرجع نجاحه. */
export async function pushToCloud(code: string, state: SyncState): Promise<boolean> {
  try {
    const handle = await cloudDoc(code)
    if (!handle) return false
    const { setDoc, serverTimestamp } = await import('firebase/firestore')
    const encrypted = await encryptState(code, state)
    if (!encrypted) return false
    await setDoc(handle.ref, { data: encrypted, updatedAt: serverTimestamp() }, { merge: true })
    return true
  } catch { return false }
}

export type SyncOutcome = 'synced' | 'unavailable' | 'error'

/**
 * مزامنةٌ كاملة: يسحب السحابة، يدمجها مع المحلي بلا فقد، يطبّق المدمَج محلياً،
 * ثم يدفعه ليتقارب الجهازان. يبقى محلياً بسلاسة إن غابت السحابة.
 */
export async function syncNow(code: string): Promise<SyncOutcome> {
  const now = Date.now()
  if (code === lastSyncCode && now - lastSyncAt < SYNC_COOLDOWN_MS) return 'synced'
  lastSyncAt = now
  lastSyncCode = code
  const local = collectLocalState()
  const remote = await pullFromCloud(code)
  const merged = remote ? mergeStates(local, remote) : local
  if (remote) applyState(merged)
  const pushed = await pushToCloud(code, merged)
  if (!pushed && !remote) return 'unavailable'
  return pushed ? 'synced' : 'error'
}


/** يمحو النسخة السحابية فقط بكتابتها حالةً مشفّرة فارغة؛ لا يمسّ بيانات الجهاز. */
export async function clearCloudState(code: string): Promise<boolean> {
  const ok = await pushToCloud(code, {})
  if (ok) {
    lastSyncAt = Date.now()
    lastSyncCode = code
  }
  return ok
}
