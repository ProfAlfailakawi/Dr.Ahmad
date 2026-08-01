#!/usr/bin/env node
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()
const read = (path) => readFileSync(join(root, path), 'utf8')
const watcher = read('scripts/source-desk-watch.mjs')
const memory = read('src/components/admin/EditorialMemoryPanel.tsx')
const manager = read('src/components/admin/ContentManager.tsx')
const tweets = read('src/components/admin/TweetStudio.tsx')
const designs = read('src/components/admin/SocialDesignStudio.tsx')
const server = read('server.mjs')
const rules = read('firestore.rules')

assert.match(watcher, /buildCascadeCorrectionCase/)
assert.match(watcher, /admin_correction_cases/)
assert.match(watcher, /status: 'correction_hold'/)
assert.match(memory, /فُتحت سلسلة التصحيح فوراً/)
assert.match(memory, /where\('sourceIds', 'array-contains'/)
assert.match(manager, /افتح سلسلة التصحيح/)
assert.match(manager, /advanceCascadeCorrection\(activeCorrectionCase, 'passport_signed'/)
assert.match(manager, /التجاوز اليدوي لا يلغي سلسلة الإثبات/)
assert.match(manager, /correctedMeaningLanded/)
assert.match(tweets, /data-correction-hold="tweets"/)
assert.match(tweets, /correctionHoldSlugs/)
assert.match(designs, /data-correction-hold="design"/)
assert.match(designs, /correctionRefreshRequired/)
assert.match(server, /admin_publication_passport_heads/)
assert.match(server, /admin_publication_passport_links/)
assert.match(server, /runTransaction/)
assert.doesNotMatch(server, /admin_publication_passports[\s\S]{0,180}\.update\(/)
for (const collection of ['admin_correction_cases', 'admin_publication_passport_heads', 'admin_publication_passport_links']) assert.match(rules, new RegExp(`match /${collection}`))

console.log('cascade correction integration: passed')
