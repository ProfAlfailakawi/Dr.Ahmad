/* بديل firebase/storage في وضع العرض: روابط وهمية تشير إلى أصول الموقع المحلية. */
export const getStorage = (..._a: any[]) => ({})
export const ref = (_s: any, path = '') => ({ fullPath: path, name: String(path).split('/').pop() || '' })
const fake = async (r: any) => ({ ref: r, metadata: { fullPath: r.fullPath } })
export const uploadBytes = async (r: any, ..._a: any[]) => fake(r)
export const uploadBytesResumable = (r: any, ..._a: any[]) => { const p: any = Promise.resolve(fake(r)); p.on = (_e: string, _n?: any, _er?: any, done?: () => void) => { setTimeout(() => done?.(), 50); return () => {} }; p.snapshot = { ref: r, bytesTransferred: 1, totalBytes: 1 }; return p }
export const getDownloadURL = async (r: any) => `/portrait.jpg?demo=${encodeURIComponent(r.fullPath)}`
export const getBlob = async () => new Blob([''])
export const deleteObject = async () => {}
export const listAll = async () => ({ items: [], prefixes: [] })
