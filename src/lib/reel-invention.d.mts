/** تصريح أنواع المصدر الوحيد لابتكار المشاهد (المنطق في reel-invention.mjs). */
export type GlossaryEntry = { id?: string; canonicalAr?: string; domain?: string; aliases?: string[] }
export type CorpusPassage = { title?: string; text?: string; url?: string }

export type InventionRequest = {
  idea: string
  sentence?: string
  seconds: number
  count: number
  concepts: string[]
  passages: CorpusPassage[]
}

export type InventedScene = {
  labelAr: string
  sceneAr: string
  sceneEn: string
  arcStartEn: string
  arcEndEn: string
  whyAr: string
}

export function conceptsInText(text: string, glossary: GlossaryEntry[], limit?: number): string[]
export function passagesForIdea(idea: string, corpus: CorpusPassage[], limit?: number): CorpusPassage[]
export function inventionInstruction(): string
export function inventionPrompt(request: InventionRequest): string
export function acceptInventedScenes(raw: unknown, expected: number): InventedScene[]
export const INVENTION_PROPERTIES: Record<string, unknown>
export const INVENTION_REQUIRED: string[]
