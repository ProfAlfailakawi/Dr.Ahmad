import { useEffect, useState } from 'react'
import { getDb } from './firebase'

export type AtlasConstellation = {
  id: string
  title: string
  slugs: string[]
}

export type AtlasEditorialSettings = {
  dailyStarSlug: string
  constellations: AtlasConstellation[]
}

const CACHE_KEY = 'atlas:editorial-settings:v1'
const DEFAULT_SETTINGS: AtlasEditorialSettings = {
  dailyStarSlug: '',
  constellations: [
    {
      id: 'educational-anxiety',
      title: 'رحلة القلق التربوي',
      slugs: ['the-classroom-that-fears-mistakesarabic', 'when-a-student-wishes-for-death-before-the-first-bell-2', 'he-passed-the-exam-but-failed-the-question-2'],
    },
    {
      id: 'human-and-machine',
      title: 'الإنسان مقابل الآلة',
      slugs: ['qabas-201702-001', 'qabas-201712-002', 'artificial-intelligence-teaches-while-the-human-mind-is-pushed-aside-2', 'students-minds-are-on-vacation-while-chatgpt-works-full-time-2'],
    },
  ],
}
const clean = (value: unknown) => typeof value === 'string' ? value.trim() : ''

const normalizeConstellation = (value: unknown, index: number): AtlasConstellation | null => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const row = value as Record<string, unknown>
  const title = clean(row.title)
  const slugs = Array.isArray(row.slugs)
    ? [...new Set(row.slugs.map(clean).filter(Boolean))].slice(0, 16)
    : []
  if (!title || slugs.length < 2) return null
  return { id: clean(row.id) || `constellation-${index + 1}`, title, slugs }
}

export function normalizeAtlasSettings(value: unknown): AtlasEditorialSettings {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return DEFAULT_SETTINGS
  const row = value as Record<string, unknown>
  return {
    dailyStarSlug: clean(row.dailyStarSlug),
    constellations: Array.isArray(row.constellations)
      ? row.constellations.map(normalizeConstellation).filter((item): item is AtlasConstellation => Boolean(item)).slice(0, 12)
      : [],
  }
}

export function parseConstellationLines(value: string): AtlasConstellation[] {
  return value.split(/\n+/).map((line, index) => {
    const [titlePart, slugsPart = ''] = line.split('|')
    return normalizeConstellation({
      id: `constellation-${index + 1}`,
      title: titlePart,
      slugs: slugsPart.split(/[،,]/),
    }, index)
  }).filter((item): item is AtlasConstellation => Boolean(item))
}

export function constellationLines(items: AtlasConstellation[]) {
  return items.map((item) => `${item.title} | ${item.slugs.join(', ')}`).join('\n')
}

function cachedSettings() {
  if (typeof window === 'undefined') return DEFAULT_SETTINGS
  try { return normalizeAtlasSettings(JSON.parse(localStorage.getItem(CACHE_KEY) || 'null')) } catch { return DEFAULT_SETTINGS }
}

export function cacheAtlasSettings(value: AtlasEditorialSettings) {
  if (typeof window === 'undefined') return
  try { localStorage.setItem(CACHE_KEY, JSON.stringify(value)) } catch { /* التخزين تحسين تشغيلي فقط. */ }
}

export async function fetchAtlasSettings() {
  const db = await getDb()
  if (!db) return cachedSettings()
  try {
    const { doc, getDoc } = await import('firebase/firestore')
    const snapshot = await getDoc(doc(db, 'site_settings', 'atlas'))
    const settings = normalizeAtlasSettings(snapshot.exists() ? snapshot.data() : null)
    cacheAtlasSettings(settings)
    return settings
  } catch {
    return cachedSettings()
  }
}

export function useAtlasSettings() {
  const [settings, setSettings] = useState<AtlasEditorialSettings>(() => cachedSettings())
  useEffect(() => {
    let active = true
    const timer = window.setTimeout(() => {
      fetchAtlasSettings().then((value) => { if (active) setSettings(value) })
    }, 900)
    return () => { active = false; window.clearTimeout(timer) }
  }, [])
  return settings
}
