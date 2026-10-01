/* بديل في الذاكرة لـ firebase/firestore — يُستخدم فقط في وضع العرض التوضيحي. */
import { DEMO_COLLECTIONS } from './seed'

export class Timestamp {
  constructor(public seconds: number, public nanoseconds = 0) {}
  static now() { return Timestamp.fromMillis(Date.now()) }
  static fromDate(d: Date) { return Timestamp.fromMillis(d.getTime()) }
  static fromMillis(ms: number) { return new Timestamp(Math.floor(ms / 1000), (ms % 1000) * 1e6) }
  toDate() { return new Date(this.seconds * 1000 + this.nanoseconds / 1e6) }
  toMillis() { return this.seconds * 1000 + this.nanoseconds / 1e6 }
  valueOf() { return String(this.toMillis()) }
}

type Data = Record<string, any>
type Sentinel = { __s: 'ts' | 'inc' | 'union' | 'del'; v?: any }
export const serverTimestamp = (): Sentinel => ({ __s: 'ts' })
export const increment = (v: number): Sentinel => ({ __s: 'inc', v })
export const arrayUnion = (...v: any[]): Sentinel => ({ __s: 'union', v })
export const deleteField = (): Sentinel => ({ __s: 'del' })

const store = new Map<string, Map<string, Data>>()
let seeded = false
function ensureSeed() {
  if (seeded) return
  seeded = true
  const now = Date.now()
  for (const [path, docs] of Object.entries(DEMO_COLLECTIONS(now))) {
    const m = new Map<string, Data>()
    for (const [id, data] of Object.entries(docs)) m.set(id, revive(data))
    store.set(path, m)
  }
}
function revive(v: any): any {
  if (v && typeof v === 'object') {
    if (typeof v.__ts === 'number') return Timestamp.fromMillis(v.__ts)
    if (Array.isArray(v)) return v.map(revive)
    return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, revive(x)]))
  }
  return v
}
const col = (path: string) => { ensureSeed(); let m = store.get(path); if (!m) { m = new Map(); store.set(path, m) } return m }

export type Firestore = { __db: true }
export const getFirestore = (): Firestore => ({ __db: true })
const joinPath = (parts: string[]) => parts.join('/')
export function collection(base: any, ...segs: string[]) {
  const p = base && base.__db ? segs : [base.path, ...segs]
  return { type: 'collection', path: joinPath(p), id: p[p.length - 1] }
}
let autoId = 0
export function doc(base: any, ...segs: string[]) {
  let p: string[]
  if (base && base.__db) p = segs
  else if (base.type === 'collection') p = [base.path, ...(segs.length ? segs : [`demo-${Date.now().toString(36)}${autoId++}`])]
  else p = [base.path, ...segs]
  const parts = p.join('/').split('/')
  return { type: 'doc', path: parts.join('/'), id: parts[parts.length - 1], parent: { type: 'collection', path: parts.slice(0, -1).join('/') } }
}

const getField = (data: Data, field: string) => field.split('.').reduce((o: any, k) => (o == null ? undefined : o[k]), data)
const cmpVal = (v: any) => (v instanceof Timestamp ? v.toMillis() : v instanceof Date ? v.getTime() : v)
export const where = (field: string, op: string, value: any) => ({ k: 'where', field, op, value })
export const orderBy = (field: string, dir: 'asc' | 'desc' = 'asc') => ({ k: 'order', field, dir })
export const limit = (n: number) => ({ k: 'limit', n })
export const startAfter = (..._v: any[]) => ({ k: 'noop' })
export const startAt = startAfter
export const endBefore = startAfter
export function query(ref: any, ...constraints: any[]) { return { type: 'query', path: ref.path, constraints: [...(ref.constraints || []), ...constraints] } }
const matches = (data: Data, c: any) => {
  const a = cmpVal(getField(data, c.field)); const b = cmpVal(c.value)
  switch (c.op) {
    case '==': return a === b
    case '!=': return a !== b
    case '<': return a < b
    case '<=': return a <= b
    case '>': return a > b
    case '>=': return a >= b
    case 'in': return Array.isArray(c.value) && c.value.map(cmpVal).includes(a)
    case 'not-in': return Array.isArray(c.value) && !c.value.map(cmpVal).includes(a)
    case 'array-contains': return Array.isArray(getField(data, c.field)) && getField(data, c.field).includes(c.value)
    default: return true
  }
}
const META = { fromCache: false, hasPendingWrites: false }
const mkSnap = (path: string, id: string, data: Data | undefined) => ({
  id, ref: { type: 'doc', path: `${path}/${id}`, id }, exists: () => data !== undefined, metadata: META,
  data: () => (data === undefined ? undefined : structuredCloneSafe(data)), get: (f: string) => (data ? getField(data, f) : undefined),
})
function structuredCloneSafe(d: Data): Data {
  const c = (v: any): any => v instanceof Timestamp ? new Timestamp(v.seconds, v.nanoseconds) : Array.isArray(v) ? v.map(c) : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, c(x)])) : v
  return c(d)
}
function run(q: any) {
  const m = col(q.path)
  let rows = [...m.entries()].map(([id, d]) => ({ id, d }))
  const cs: any[] = q.constraints || []
  for (const c of cs) if (c.k === 'where') rows = rows.filter((r) => matches(r.d, c))
  const orders = cs.filter((c) => c.k === 'order')
  if (orders.length) rows.sort((x, y) => { for (const o of orders) { const a = cmpVal(getField(x.d, o.field)), b = cmpVal(getField(y.d, o.field)); if (a === b) continue; if (a == null) return 1; if (b == null) return -1; return (a < b ? -1 : 1) * (o.dir === 'desc' ? -1 : 1) } return 0 })
  const lim = cs.filter((c) => c.k === 'limit').pop()
  if (lim) rows = rows.slice(0, lim.n)
  const docs = rows.map((r) => mkSnap(q.path, r.id, r.d))
  return { docs, metadata: META, size: docs.length, empty: !docs.length, forEach: (fn: any) => docs.forEach(fn), docChanges: () => docs.map((d, i) => ({ type: 'added', doc: d, newIndex: i, oldIndex: -1 })) }
}
export const getDocs = async (q: any) => run(q)
export const getDoc = async (r: any) => mkSnap(r.parent.path, r.id, col(r.parent.path).get(r.id))
export const getCountFromServer = async (q: any) => ({ data: () => ({ count: run(q).size }) })

const listeners = new Set<() => void>()
const notify = () => queueMicrotask(() => listeners.forEach((l) => l()))
export function onSnapshot(ref: any, a: any, b?: any, _c?: any) {
  const next: (s: any) => void = typeof a === 'function' ? a : b
  const emit = () => next(ref.type === 'doc' ? mkSnap(ref.parent.path, ref.id, col(ref.parent.path).get(ref.id)) : run(ref))
  listeners.add(emit)
  setTimeout(emit, 0)
  return () => { listeners.delete(emit) }
}

function resolve(prev: Data | undefined, patch: Data): Data {
  const out: Data = { ...(prev || {}) }
  for (const [k, v] of Object.entries(patch)) {
    if (v && typeof v === 'object' && (v as any).__s) {
      const s = v as Sentinel
      if (s.__s === 'ts') out[k] = Timestamp.now()
      else if (s.__s === 'inc') out[k] = Number(out[k] || 0) + s.v
      else if (s.__s === 'union') out[k] = [...new Set([...(out[k] || []), ...s.v])]
      else if (s.__s === 'del') delete out[k]
    } else if (v && typeof v === 'object' && !Array.isArray(v) && !(v instanceof Timestamp) && !(v instanceof Date) && Object.getPrototypeOf(v) === Object.prototype) {
      out[k] = resolve(undefined, v as Data)
    } else out[k] = v
  }
  return out
}
export async function setDoc(r: any, data: Data, opts?: { merge?: boolean }) {
  const m = col(r.parent.path)
  m.set(r.id, resolve(opts?.merge ? m.get(r.id) : undefined, data)); notify()
}
export async function addDoc(c: any, data: Data) { const r = doc(c); await setDoc(r, data); return r }
export async function updateDoc(r: any, data: Data) {
  const m = col(r.parent.path)
  let next: Data = { ...(m.get(r.id) || {}) }
  for (const [k, v] of Object.entries(data)) {
    if (k.includes('.')) {
      const parts = k.split('.'); const last = parts.pop() as string
      let o: Data = next
      for (const p of parts) { o[p] = { ...(o[p] || {}) }; o = o[p] }
      o[last] = resolve({}, { x: v }).x
    } else next = resolve(next, { [k]: v })
  }
  m.set(r.id, next); notify()
}
export async function deleteDoc(r: any) { col(r.parent.path).delete(r.id); notify() }
export function writeBatch(_db?: any) {
  const ops: (() => Promise<void>)[] = []
  const b = {
    set: (r: any, d: Data, o?: any) => { ops.push(() => setDoc(r, d, o)); return b },
    update: (r: any, d: Data) => { ops.push(() => updateDoc(r, d)); return b },
    delete: (r: any) => { ops.push(() => deleteDoc(r)); return b },
    commit: async () => { for (const op of ops) await op() },
  }
  return b
}
export async function runTransaction<T>(_db: any, fn: (tx: any) => Promise<T>): Promise<T> {
  const tx = { get: getDoc, set: (r: any, d: Data, o?: any) => { void setDoc(r, d, o); return tx }, update: (r: any, d: Data) => { void updateDoc(r, d); return tx }, delete: (r: any) => { void deleteDoc(r); return tx } }
  return fn(tx)
}
export const documentId = () => '__name__'
export const enableIndexedDbPersistence = async () => {}
