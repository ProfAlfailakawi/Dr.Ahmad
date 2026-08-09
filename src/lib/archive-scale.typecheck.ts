/*
 * Compile-time contract for archive-scale.mjs.
 *
 * This file is intentionally included by tsconfig but imported nowhere at runtime.
 * It prevents a missing/weak declaration from silently turning Archive 2036 into
 * `any` and cascading TS7006 through Atlas, Search and the editorial admin tools.
 */
import { buildSearchPostings, createArchiveIndex, queryArchiveIndex, sampleVisualArchive, selectTopK } from './archive-scale.mjs'

type Probe = { slug: string; title: string; score: number; year: string; category: string }
const probeRows: Probe[] = []

const top = selectTopK(probeRows, 3, (item) => item.score, (item) => item.slug)
const visual = sampleVisualArchive(probeRows, 20, { keyOf: (item) => item.slug, groupOf: (item) => item.category })
const archive = createArchiveIndex(probeRows, {
  getText: (item) => `${item.title} ${item.slug}`,
  getYear: (item) => item.year,
  getCategory: (item) => item.category,
  getSortKey: (item) => item.slug,
})
const page = queryArchiveIndex(archive, { query: 'تعليم', pageSize: 10 })
const postings = buildSearchPostings(probeRows, { getText: (item) => item.title })

/* Type-only assertions: if any generic collapses to `any`, CI's strict gate catches
   the callback and property contracts that previously produced the reported errors. */
const _typedTop: Probe[] = top
const _typedVisual: Probe[] = visual
const _typedPage: Probe[] = page.items
const _typedPostings: Map<string, Uint32Array> = postings
void [_typedTop, _typedVisual, _typedPage, _typedPostings]
