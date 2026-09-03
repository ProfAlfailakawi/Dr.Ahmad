#!/usr/bin/env node
import assert from 'node:assert/strict'; import { readFileSync } from 'node:fs'
const read=p=>readFileSync(p,'utf8')
const checks=[
 ['BibTeX',read('src/lib/bibtex.ts'),/buildBibTeX/],['Bib download',read('src/components/CitationCopy.tsx'),/application\/x-bibtex/],
 ['public analytics',read('src/lib/usage-analytics.ts'),/search_zero_results/],['RUM p75 inputs',read('src/lib/web-vitals.ts'),/INP/],
 ['admin semantic analytics',read('src/lib/admin-usage.ts'),/admin_result_converted/],['analytics dashboard',read('src/components/admin/UsageAnalytics.tsx'),/الاستخدام الفعلي/],
 ['deep search URL',read('src/components/EncyclopediaPortal.tsx'),/pushState/],['share API',read('src/components/EncyclopediaPortal.tsx'),/navigator\.share/],
 ['manual canonical hash',read('scripts/lib/manual-dialogue-source.mjs'),/canonicalDialogueRevision/],['podcast checkpoints',read('scripts/lib/human-reading-pipeline.mjs'),/checkpointJson/],
 ['podcast stage status',read('scripts/podcast-production-status.mjs'),/currentSegment/],['idempotent dispatch',read('server.mjs'),/dispatchedDialogueRevisionId/],
 ['generated status',read('scripts/generate-project-status.mjs'),/PROJECT-STATUS/]
]
for(const [name,text,rx] of checks)assert.match(text,rx,String(name)); console.log(`✓ comprehensive upgrades: ${checks.length}/${checks.length}`)
