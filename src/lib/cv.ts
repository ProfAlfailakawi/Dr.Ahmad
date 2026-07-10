import { useCallback, useEffect, useMemo, useState } from 'react'
import { bio, conferences, memberships } from '../data'
import { getDb } from './firebase'

export type CvEducationItem = {
  id: string
  degree: string
  org: string
  note: string
}

export type CvRoleItem = {
  id: string
  role: string
  org: string
}

export type CvWorkItem = CvRoleItem & {
  items: string[]
}

export type CvConferenceItem = {
  id: string
  title: string
  place: string
}

export type CvTextItem = {
  id: string
  text: string
}

export type CvSectionMap = {
  education: CvEducationItem[]
  teaching: CvRoleItem[]
  work: CvWorkItem[]
  committees: CvTextItem[]
  memberships: CvTextItem[]
  conferences: CvConferenceItem[]
  workshops: CvTextItem[]
  certifications: CvTextItem[]
  skills: CvTextItem[]
}

export type CvSectionKey = keyof CvSectionMap
export type CvItem = CvSectionMap[CvSectionKey][number]

export const cvSectionLabels: Record<CvSectionKey, string> = {
  education: 'التعليم',
  teaching: 'الخبرات التدريسية',
  work: 'الخبرات الوظيفية والاستشارية',
  committees: 'اللجان والعضويات المحلية',
  memberships: 'العضويات الدولية',
  conferences: 'المؤتمرات والزيارات العلمية',
  workshops: 'ورش العمل والمحاضرات',
  certifications: 'الشهادات والدورات',
  skills: 'مهارات الكمبيوتر',
}

const baseId = (section: CvSectionKey, index: number) => `base:${section}:${index + 1}`

const textItems = (section: CvSectionKey, items: readonly string[]): CvTextItem[] =>
  items.map((text, index) => ({ id: baseId(section, index), text }))

export const baseCv: CvSectionMap = {
  education: bio.education.map((item, index) => ({
    id: baseId('education', index),
    degree: item.degree,
    org: item.org,
    note: item.note,
  })),
  teaching: bio.teaching.map((item, index) => ({
    id: baseId('teaching', index),
    role: item.role,
    org: item.org,
  })),
  work: bio.work.map((item, index) => ({
    id: baseId('work', index),
    role: item.role,
    org: item.org,
    items: 'items' in item && Array.isArray(item.items) ? [...item.items] : [],
  })),
  committees: textItems('committees', bio.committees),
  memberships: textItems('memberships', memberships),
  conferences: conferences.map((item, index) => ({
    id: baseId('conferences', index),
    title: item.title,
    place: item.place,
  })),
  workshops: textItems('workshops', bio.workshops),
  certifications: textItems('certifications', bio.certifications),
  skills: textItems('skills', bio.skills),
}

const sectionKeys = Object.keys(cvSectionLabels) as CvSectionKey[]
const isSectionKey = (value: string): value is CvSectionKey => sectionKeys.includes(value as CvSectionKey)
const isRecord = (value: unknown): value is Record<string, unknown> => Boolean(value && typeof value === 'object' && !Array.isArray(value))
const stringValue = (value: unknown) => typeof value === 'string' ? value.trim() : ''

const savedId = (section: CvSectionKey, item: unknown, index: number) => {
  if (isRecord(item)) {
    const id = stringValue(item.id)
    if (id) return id
  }
  return `saved:${section}:${index + 1}`
}

function normalizeItems(section: CvSectionKey, rawItems: readonly unknown[]): CvItem[] {
  switch (section) {
    case 'education':
      return rawItems.flatMap((item, index) => {
        if (!isRecord(item)) return []
        const degree = stringValue(item.degree)
        const org = stringValue(item.org)
        if (!degree || !org) return []
        return [{ id: savedId(section, item, index), degree, org, note: stringValue(item.note) }]
      })
    case 'teaching':
      return rawItems.flatMap((item, index) => {
        if (!isRecord(item)) return []
        const role = stringValue(item.role)
        const org = stringValue(item.org)
        if (!role || !org) return []
        return [{ id: savedId(section, item, index), role, org }]
      })
    case 'work':
      return rawItems.flatMap((item, index) => {
        if (!isRecord(item)) return []
        const role = stringValue(item.role)
        const org = stringValue(item.org)
        if (!role || !org) return []
        const details = Array.isArray(item.items) ? item.items.map(stringValue).filter(Boolean) : []
        return [{ id: savedId(section, item, index), role, org, items: details }]
      })
    case 'conferences':
      return rawItems.flatMap((item, index) => {
        if (!isRecord(item)) return []
        const title = stringValue(item.title)
        const place = stringValue(item.place)
        if (!title || !place) return []
        return [{ id: savedId(section, item, index), title, place }]
      })
    default:
      return rawItems.flatMap((item, index) => {
        const text = typeof item === 'string' ? item.trim() : isRecord(item) ? stringValue(item.text) : ''
        return text ? [{ id: savedId(section, item, index), text }] : []
      })
  }
}

type CvOverrides = Partial<Record<CvSectionKey, CvItem[]>>
export type SaveCvSection = (section: CvSectionKey, items: readonly CvItem[]) => Promise<void>

const errorMessage = (error: unknown) => error instanceof Error && error.message
  ? error.message
  : 'تعذّر تحميل تعديلات السيرة.'

export function useCv() {
  const [overrides, setOverrides] = useState<CvOverrides>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    let unsubscribe = () => {}

    ;(async () => {
      try {
        const db = await getDb()
        if (!active) return
        if (!db) {
          setLoading(false)
          return
        }

        const { collection, onSnapshot } = await import('firebase/firestore')
        if (!active) return
        unsubscribe = onSnapshot(
          collection(db, 'cv_overrides'),
          (snapshot) => {
            if (!active) return
            const next: CvOverrides = {}
            snapshot.docs.forEach((snapshotDoc) => {
              if (!isSectionKey(snapshotDoc.id)) return
              const value = snapshotDoc.data().items
              if (Array.isArray(value)) next[snapshotDoc.id] = normalizeItems(snapshotDoc.id, value)
            })
            setOverrides(next)
            setError(null)
            setLoading(false)
          },
          (snapshotError) => {
            if (!active) return
            setError(errorMessage(snapshotError))
            setLoading(false)
          },
        )
      } catch (loadError) {
        if (!active) return
        setError(errorMessage(loadError))
        setLoading(false)
      }
    })()

    return () => {
      active = false
      unsubscribe()
    }
  }, [])

  const cv = useMemo<CvSectionMap>(() => ({
    education: (overrides.education ?? baseCv.education) as CvEducationItem[],
    teaching: (overrides.teaching ?? baseCv.teaching) as CvRoleItem[],
    work: (overrides.work ?? baseCv.work) as CvWorkItem[],
    committees: (overrides.committees ?? baseCv.committees) as CvTextItem[],
    memberships: (overrides.memberships ?? baseCv.memberships) as CvTextItem[],
    conferences: (overrides.conferences ?? baseCv.conferences) as CvConferenceItem[],
    workshops: (overrides.workshops ?? baseCv.workshops) as CvTextItem[],
    certifications: (overrides.certifications ?? baseCv.certifications) as CvTextItem[],
    skills: (overrides.skills ?? baseCv.skills) as CvTextItem[],
  }), [overrides])

  const saveSection = useCallback<SaveCvSection>(async (section, items) => {
    const db = await getDb()
    if (!db) throw new Error('Firebase غير متاح حالياً؛ لم يُحفظ التعديل.')
    const { doc, serverTimestamp, setDoc } = await import('firebase/firestore')
    const cleanItems = normalizeItems(section, items)
    await setDoc(doc(db, 'cv_overrides', section), {
      items: cleanItems,
      updatedAt: serverTimestamp(),
    })
  }, [])

  return { cv, loading, error, saveSection }
}
