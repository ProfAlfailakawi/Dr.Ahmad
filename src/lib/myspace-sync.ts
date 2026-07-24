/*
 * مزامنة «مساحتي» عبر الأجهزة — اختيارية، بلا حساب ولا بريد.
 *
 * الفلسفة: الوضع المحلي يبقى الافتراضي (خصوصية كاملة). من أراد المزامنة بين
 * هاتفه وحاسوبه يُنشئ «رمز مزامنة» سرّياً؛ يُخزَّن ما يخصّه — موضع القراءة،
 * التظليلات، قائمة الاستماع، المحفوظات، المسارات، الفعاليات — تحت هذا الرمز
 * في Firestore (نفس مسار الكتابة العلني للمشاهدات). الرمز وحده مفتاح الوصول،
 * فمن حازه رأى البيانات — لذا يُنبَّه المستخدم أن يحفظه سرّاً.
 *
 * الدمج لا يُهدر: القوائم تُوحَّد (لا يضيع تظليلٌ من جهاز)، وموضع القراءة يأخذ
 * الأبعد، والمؤشّرات المفردة يفوز فيها الأحدث دفعاً. وكلُّ شيءٍ يتحمّل غياب
 * Firestore بسلاسة: يبقى محلياً ولا ينكسر.
 */

const CODE_KEY = 'myspace:sync-code:v1'
const COLLECTION = 'myspace_sync'

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
  return String(raw || '').trim().toLowerCase().replace(/\s+/g, '')
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
    return String(Math.max(Number(parse(localRaw)) || 0, Number(parse(remoteRaw)) || 0))
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

const CHANGE_EVENTS = ['reader:space-changed', 'reader:quotes-changed', 'reader:journey-changed', 'reader:preferences-changed']

export function applyState(state: SyncState) {
  if (!hasWindow()) return
  for (const [key, value] of Object.entries(state)) {
    try { window.localStorage.setItem(key, value) } catch { /* تجاهل */ }
  }
  for (const event of CHANGE_EVENTS) {
    try { window.dispatchEvent(new CustomEvent(event)) } catch { /* تجاهل */ }
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
    const parsed = parse(raw)
    return parsed && typeof parsed === 'object' ? (parsed as SyncState) : null
  } catch { return null }
}

/** يدفع الحالة إلى السحابة تحت الرمز. يرجع نجاحه. */
export async function pushToCloud(code: string, state: SyncState): Promise<boolean> {
  try {
    const handle = await cloudDoc(code)
    if (!handle) return false
    const { setDoc, serverTimestamp } = await import('firebase/firestore')
    await setDoc(handle.ref, { data: JSON.stringify(state), updatedAt: serverTimestamp() }, { merge: true })
    return true
  } catch { return false }
}

export type SyncOutcome = 'synced' | 'unavailable' | 'error'

/**
 * مزامنةٌ كاملة: يسحب السحابة، يدمجها مع المحلي بلا فقد، يطبّق المدمَج محلياً،
 * ثم يدفعه ليتقارب الجهازان. يبقى محلياً بسلاسة إن غابت السحابة.
 */
export async function syncNow(code: string): Promise<SyncOutcome> {
  const local = collectLocalState()
  const remote = await pullFromCloud(code)
  const merged = remote ? mergeStates(local, remote) : local
  if (remote) applyState(merged)
  const pushed = await pushToCloud(code, merged)
  if (!pushed && !remote) return 'unavailable'
  return pushed ? 'synced' : 'error'
}
