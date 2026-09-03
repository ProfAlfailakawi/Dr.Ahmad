import { useEffect, useState } from 'react'
import { getDb } from './firebase'
import { DR_AHMAD_DOMAIN_GLOSSARY, normalizeDomainTerm } from './dr-ahmad-domain-glossary'
import generatedConstellations from '../data/atlas-constellations.json'

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
  /* لا نزرع أسماءً افتراضية من عندنا. أسماء الكوكبات تأتي حصراً من
     قاموس الدكتور أو من الملف المولّد منه، حتى تبقى لغة السماء هي لغة
     المشروع نفسها لا عناوين تحريرية عابرة. */
  constellations: [],
}
const clean = (value: unknown) => typeof value === 'string' ? value.trim() : ''

const canonicalByAlias = new Map<string, string>()
for (const entry of DR_AHMAD_DOMAIN_GLOSSARY) {
  for (const label of [entry.canonicalAr, ...entry.aliases]) {
    const normalized = normalizeDomainTerm(label)
    if (normalized && !canonicalByAlias.has(normalized)) canonicalByAlias.set(normalized, entry.canonicalAr)
  }
}

export function canonicalConstellationTitle(value: unknown) {
  const title = clean(value)
  if (!title) return null
  return canonicalByAlias.get(normalizeDomainTerm(title)) || null
}

const normalizeConstellation = (value: unknown, index: number): AtlasConstellation | null => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const row = value as Record<string, unknown>
  const title = canonicalConstellationTitle(row.title)
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
  try { localStorage.setItem(CACHE_KEY, JSON.stringify(normalizeAtlasSettings(value))) } catch { /* التخزين تحسين تشغيلي فقط. */ }
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

/* الكوكبات التي تُعرض للزائر: ما حرّره الدكتور إن كان اسمه من القاموس، ثم
   الكوكبات المولّدة من القاموس نفسه. نزيل التكرار بالاسم المعياري وبالمعرّف،
   فلا يظهر المصطلح مرتين بصيغتين أو بمرادفين مختلفين. */
export function visibleConstellations(settings: AtlasEditorialSettings): AtlasConstellation[] {
  const output: AtlasConstellation[] = []
  const seenIds = new Set<string>()
  const seenTitles = new Set<string>()

  const append = (raw: AtlasConstellation, index: number) => {
    const item = normalizeConstellation(raw, index)
    if (!item || seenIds.has(item.id) || seenTitles.has(item.title)) return
    seenIds.add(item.id)
    seenTitles.add(item.title)
    output.push(item)
  }

  settings.constellations.forEach(append)
  ;(generatedConstellations.constellations as AtlasConstellation[]).forEach((item, index) => append(item, settings.constellations.length + index))
  return output
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
