import { useState, useEffect } from 'react'
import { firebaseEnabled, fetchExtras } from './firebase'

export interface ExtraArticle {
  id: string
  slug: string
  title: string
  date: string
  iso: string
  cat: string
  excerpt: string
  body?: string
  createdAt?: string
  // موجودان في المقالات الثابتة فقط — اختياريان هنا لتوافق الدمج
  source?: string
  url?: string
  // يضبطه سكربت الصوت الليلي بعد توليد MP3 للمقال
  audio?: { fahed?: boolean; noura?: boolean }
}

export function useExtras<T>(collectionName: string): T[] {
  const [data, setData] = useState<T[]>([])

  useEffect(() => {
    let active = true
    if (firebaseEnabled) {
      fetchExtras<T>(collectionName).then((items) => {
        if (active) {
          setData(items as any)
        }
      })
    }
    return () => {
      active = false
    }
  }, [collectionName])

  return data
}
