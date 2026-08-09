export type ArchiveIndex<T> = {
  items: T[]
  order: Uint32Array
  tokensByIndex: string[][]
  tokenPostings: Map<string, Uint32Array>
  yearPostings: Map<string, Uint32Array>
  categoryPostings: Map<string, Uint32Array>
  years: string[]
  categories: string[]
}
export function normalizeArchiveText(value?: string): string
export function archiveTokens(value?: string, limit?: number): string[]
export function selectTopK<T>(items: readonly T[], limit: number, scoreOf: (item: T, index: number) => number, tieOf?: (item: T, index: number) => string): T[]
export function createArchiveIndex<T>(items: T[], options?: {
  getText?: (item: T, index: number) => string
  getYear?: (item: T, index: number) => string
  getCategory?: (item: T, index: number) => string
  getSortKey?: (item: T, index: number) => string
  maxTokensPerItem?: number
}): ArchiveIndex<T>
export function queryArchiveIndex<T>(index: ArchiveIndex<T>, options?: { query?: string; year?: string; category?: string; page?: number; pageSize?: number }): {
  total: number; page: number; pageSize: number; pageCount: number; firstItem: number; lastItem: number; items: T[]
}
export type SimilarityGraphOptions<T> = {
  getText?: (node: T, index?: number) => string
  getTitle?: (node: T, index?: number) => string
  getKind?: (node: T, index?: number) => string
  maxNeighbors?: number
  maxCandidates?: number
  maxCandidateTokens?: number
  minScore?: number
  conceptKind?: string
  maxPostingAbsolute?: number
  maxPostingRatio?: number
}
export function sampleVisualArchive<T>(items: readonly T[], limit: number, options?: {
  keyOf?: (item: T, index: number) => string
  groupOf?: (item: T, index: number) => string
  pinKeys?: readonly string[]
}): readonly T[]

export function buildSimilarityGraph<T>(nodes: T[], options?: SimilarityGraphOptions<T>): Array<{ from: number; to: number; score: number; reasons: string[] }>
export function buildSearchPostings<T>(nodes: T[], options?: { getText?: (node: T, index?: number) => string; maxTokensPerItem?: number }): Map<string, Uint32Array>
export function searchPostingCandidates(postings: Map<string, Uint32Array>, query: string, limit?: number): number[]
