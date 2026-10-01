/* بديل firebase/auth في وضع العرض: مشرفٌ تجريبي مُسجَّل الدخول دائماً. */
export type User = { uid: string; email: string; displayName: string; getIdToken: (force?: boolean) => Promise<string> }
export type Auth = { currentUser: User | null }
const demoUser: User = { uid: 'demo-owner', email: 'demo@example.com', displayName: 'مشرف تجريبي', getIdToken: async () => 'demo-token' }
const auth: Auth = { currentUser: demoUser }
export const getAuth = (_app?: any): Auth => auth
export const getIdTokenResult = async (_u: any, _f?: boolean) => ({ token: 'demo-token', claims: { admin: true } })
export const onAuthStateChanged = (_a: any, next: (u: User | null) => void) => { setTimeout(() => next(auth.currentUser), 0); return () => {} }
export const signInWithEmailAndPassword = async () => { auth.currentUser = demoUser; return { user: demoUser } }
export const signInAnonymously = async () => { auth.currentUser = demoUser; return { user: demoUser } }
export const signOut = async () => { auth.currentUser = null; setTimeout(() => { auth.currentUser = demoUser }, 1500) }
