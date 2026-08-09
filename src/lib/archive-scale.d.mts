export type ArchiveIndex<T> = {
  items: readonly T[]
  order: Uint32Array
  tokensByIndex: string[][]
  tokenPostings: Map<string, Uint32Array>
  yearPostings: Map<string, Uint32Array>
  categoryPostings: Map<string, Uint32Array>
  years: string[]
  categories: string[]
}

export type ArchiveIndexOptions<T> = {
  getText?: (item: T, index: number) => string
  getYear?: (item: T, index: number) => string
  getCategory?: (item: T, index: number) => string
  getSortKey?: (item: T, index: number) => string
  maxTokensPerItem?: number
}

export type ArchiveQueryOptions = {
  query?: string
  year?: string
  category?: string
  page?: number
  pageSize?: number
}

export type ArchiveQueryResult<T> = {
  total: number
  page: number
  pageSize: number
  pageCount: number
  firstItem: number
  lastItem: number
  items: T[]
}

export type VisualArchiveOptions<T> = {
  keyOf?: (item: T, index: number) => string
  groupOf?: (item: T, index: number) => string
  pinKeys?: readonly string[]
}

export type SimilarityEdge = {
  from: number
  to: number
  score: number
  reasons: string[]
}

export type SimilarityGraphOptions<T> = {
  getText?: (node: T, index: number) => string
  getTitle?: (node: T, index: number) => string
  getKind?: (node: T, index: number) => string
  maxNeighbors?: number
  maxCandidates?: number
  maxCandidateTokens?: number
  minScore?: number
  conceptKind?: string
  maxPostingAbsolute?: number
  maxPostingRatio?: number
}

export type SearchPostingOptions<T> = {
  getText?: (node: T, index: number) => string
  maxTokensPerItem?: number
}

export function normalizeArchiveText(value?: unknown): string
export function archiveTokens(value?: unknown, limit?: number): string[]
export function selectTopK<T>(
  items: readonly T[],
  limit: number,
  scoreOf: (item: T, index: number) => number,
  tieOf?: (item: T, index: number) => unknown,
): T[]
export function createArchiveIndex<T>(items: readonly T[], options?: ArchiveIndexOptions<T>): ArchiveIndex<T>
export function queryArchiveIndex<T>(index: ArchiveIndex<T>, options?: ArchiveQueryOptions): ArchiveQueryResult<T>
export function sampleVisualArchive<T>(items: readonly T[], limit: number, options?: VisualArchiveOptions<T>): T[]
export function buildSimilarityGraph<T>(nodes: readonly T[], options?: SimilarityGraphOptions<T>): SimilarityEdge[]
export function buildSearchPostings<T>(nodes: readonly T[], options?: SearchPostingOptions<T>): Map<string, Uint32Array>
export function searchPostingCandidates(postings: Map<string, Uint32Array>, query: string, limit?: number): number[]
