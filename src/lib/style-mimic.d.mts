/* تعريفات محاكاة الصوت. الملف .mjs لأن الواجهة والاختبار يستوردانه معاً،
   والحَكَم نفسه (style-dna.mjs) هو مرجعه فلا يمدح أحدهما ما يرفضه الآخر. */

import type { StyleDna, StyleVerdict } from './style-dna.mjs'

export interface MimicCandidate {
  id: string
  phrase: string
  kind: 'matrix' | 'opener' | 'connector' | 'temporal' | 'flourish'
  swap?: string
  reason: string
}

/* `swap` هنا نتيجةُ قياس: عبارةٌ أذن بها المتن أو `null` — لا حقلٌ اختياري. */
export interface MimicRule extends Omit<MimicCandidate, 'swap'> {
  /* عدد وروده في أرشيفه **في سياق التعديل نفسه** لا ككلمةٍ مجردة. */
  own: number
  swap: string | null
  swapRejected: string | null
  swapCount: number
  source: string
}

export interface MimicLexicon {
  rules: MimicRule[]
  /* ما بلغ ثلاث مراتٍ فأكثر في أرشيفه: عادةٌ له، لا تُمسّ. */
  guarded: (MimicCandidate & { own: number; bare: number })[]
  corpusWords: number
  measured: boolean
}

export interface MimicChange {
  kind: string
  from: string
  to: string
  reason: string
  paragraph: number
}

export interface MimicPending {
  phrase: string
  sentence: string
  paragraph: number
  reason: string
}

export interface MimicResult {
  text: string
  changes: MimicChange[]
  /* مواضعُ امتنع المحرك عن تعديلها ومعها سبب الامتناع بالعربية. */
  skipped: MimicChange[]
  /* عباراتٌ يعتبرها الحَكَم قاطعةً ولا حذف آمن لها آلياً. */
  pending: MimicPending[]
  applied: boolean
  before: StyleVerdict | null
  after: StyleVerdict | null
  marks?: { ellipsis: number; medianSentence: number; paragraphs: number }
  note: string
}

export declare const OWN_FLOOR: number
export declare const MIMIC_CANDIDATES: MimicCandidate[]

export declare function flexBody(phrase: string): string
export declare function flexPattern(phrase: string): string
export declare function contextSource(candidate: MimicCandidate): string
export declare function buildMimicLexicon(archive?: ({ body?: string } | string)[]): MimicLexicon
export declare function gateEdit(before: string, after: string, allowed?: string[]): { ok: boolean; reason: string }
export declare function wellFormedness(text: string): {
  dangling: number; doubled: number; doubledPreposition: number
  orphans: number; stackedConnectives: number; breaks: number
  doubledRate: number; orphanRate: number
}

export declare function mimicVoice(
  text: string,
  dna: StyleDna | null,
  options?: {
    archive?: ({ body?: string } | string)[]
    lexicon?: MimicLexicon | null
    orthography?: Map<string, number> | null
    threshold?: number
  },
): MimicResult

export default mimicVoice
