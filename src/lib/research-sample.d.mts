export type ResearchSampleValidationOptions = { requireNumber?: boolean }
export function isPlausibleResearchSample(value?: unknown, options?: ResearchSampleValidationOptions): boolean
export function cleanResearchSample(value?: unknown, options?: ResearchSampleValidationOptions): string
export function inferResearchSample(value?: unknown): string
export function splitResearchSentences(value?: unknown): string[]
