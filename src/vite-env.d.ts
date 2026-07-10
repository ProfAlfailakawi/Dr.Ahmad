/// <reference types="vite/client" />
declare module '*.png'
declare module '*.webp'
declare module '*.jpg'

interface ImportMetaEnv {
  readonly VITE_FIREBASE_APPCHECK_SITE_KEY?: string
}
