/* تعريفات بصمة الأسلوب — الملف نفسه .mjs لأن الخادم (server.mjs) يستورده
   بالمسطرة نفسها التي تستعملها الواجهة؛ فلا يمدح أحدهما ما يرفضه الآخر. */

export interface StyleBand {
  p03: number; p15: number; p35: number; p50: number; p65: number; p85: number; p97: number
}

export interface StyleDna {
  version: number
  sampleSize: number
  totalWords: number
  article: { p10: number; p25: number; median: number; p75: number; p90: number; mean: number }
  sentence: { mean: number; median: number; p10: number; p90: number; shortRate: number; longRate: number }
  paragraph: {
    mean: number; median: number; p25: number; p75: number; p90: number
    singleSentenceRate: number; twoSentenceRate: number
    perArticle: number; perArticleMedian: number; perArticleP75: number
  }
  marks: {
    ellipsisPer100: number; ellipsisPerArticle: number; questionsPerArticle: number
    guillemetsPer100: number; semicolonPer100: number; emDashPer100: number
    shaddaPer100: number; commaPer100: number
  }
  moves: {
    antithesisPer100: number; negationAntithesisPer100: number; collectivePer100: number
    articlesWithEllipsis: number; articlesWithAntithesis: number
    articlesWithQuestion: number; articlesWithGuillemets: number
  }
  openers: { word: string; count: number }[]
  closings: { questionRate: number; antithesisRate: number; appealRate: number }
  perArticle: Record<string, StyleBand>
  banned: string[]
  bannedVoice: string[]
}

export interface StyleMetrics {
  words: number; sentences: number; paragraphs: number
  ellipsis: number; ellipsisPer100: number
  antithesis: number; antithesisPer100: number
  questions: number; collective: number; guillemets: number
  medianSentence: number; longSentenceRate: number; shortRate: number
  medianParagraph: number; maxParagraph: number; singleRate: number
  duplicateSentenceRate: number; duplicateGramRate: number
  lexicalDiversity: number; worstSentenceRepeat: number
  firstSentenceWords: number; lastSentence: string
}

export interface StyleCheck {
  key: string; label: string; ok: boolean; grade: number; weight: number
  actual: string | number; wanted: string | number
}

export interface StyleVerdict {
  score: number
  ready: boolean
  checks: StyleCheck[]
  corrections: string[]
  fatal: string[]
  metrics: StyleMetrics
}

export declare const BANNED_PHRASES: string[]
export declare const BANNED_VOICE: string[]
export declare const FALLBACK_STYLE_DNA: StyleDna

export declare function stripTashkeel(value?: string): string
export declare function bareText(value?: string): string
export declare function wordsOf(value?: string): string[]
export declare function countWords(value?: string): number
export declare function sentencesOf(value?: string): string[]
export declare function paragraphsOf(value?: string): string[]

export declare function measureStyleDna(articles: ({ body?: string } | string)[]): StyleDna | null
export declare function articleMetrics(body: string): StyleMetrics
export declare function resolveStyleDna(dna: unknown): StyleDna
export declare function styleBrief(dna: StyleDna | null, targetWords?: number): string
export declare function judgeStyle(
  body: string,
  dna: StyleDna | null,
  options?: {
    archive?: ({ body?: string } | string)[]
    /* مصادر الإسناد: الأرشيف + الأحداث الراهنة. كل رقمٍ أو دراسةٍ في النص
       يجب أن يكون له أثرٌ هنا، وإلا فهو مُختلَق. */
    sources?: ({ body?: string; title?: string; summary?: string; excerpt?: string } | string)[]
    threshold?: number
  },
): StyleVerdict

export declare function unsupportedClaims(
  body: string,
  sources?: ({ body?: string; title?: string; summary?: string; excerpt?: string } | string)[],
): { kind: string; value: string }[]
export declare function verbatimOverlap(
  body: string,
  archiveTexts: ({ body?: string } | string)[],
  size?: number,
): string[]
export declare function polishTypography(value?: string): string
export declare function liftPauses(value?: string, dna?: StyleDna | null): string
export declare function applyRhythm(value?: string, dna?: StyleDna | null): string
export declare function breakLongSentences(value?: string, dna?: StyleDna | null): string
export declare function refineToStyle(value?: string, dna?: StyleDna | null): string
export declare function styleReportLines(verdict: StyleVerdict | null): string[]

export declare function extractVoiceSignature(rejectedText: string, corpus?: ({ body?: string } | string)[], limit?: number): string[]
export declare function withVoiceMemory(dna: StyleDna | null, exclusions?: string[]): StyleDna

export declare const PROOFREAD_INSTRUCTION: string
export declare function acceptProofread(
  original: string,
  corrected: string,
  dna?: StyleDna | null,
): { accepted: boolean; reason: string; score?: number }
