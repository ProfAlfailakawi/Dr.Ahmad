#!/usr/bin/env node
import assert from 'node:assert/strict'
import { buildQueue, completedVideoIds, parseArgs } from './lib/encyclopedia-auto-transcribe.mjs'

const options = parseArgs(['--model-size', 'small', '--limit', '2', '--video-id', 'a', '--force', '--keep-audio'])
assert.equal(options.modelSize, 'small')
assert.equal(options.limit, 2)
assert.deepEqual(options.videoIds, ['a'])
assert.equal(options.force, true)
assert.equal(options.keepAudio, true)

const index = { records: { a: { videoId: 'a', available: true, segments: [{ start: 0, end: 1, text: 'x' }] }, b: { videoId: 'b', available: false, segments: [] } } }
assert.deepEqual([...completedVideoIds(index)], ['a'])
const catalog = { videos: [{ id: 'a', url: 'u' }, { id: 'b', url: 'u' }, { id: 'c', url: 'u' }] }
assert.deepEqual(buildQueue(catalog, index, {}).map((v) => v.id), ['b', 'c'])
assert.deepEqual(buildQueue(catalog, index, { force: true, limit: 2 }).map((v) => v.id), ['a', 'b'])
assert.deepEqual(buildQueue(catalog, index, { videoIds: ['c'] }).map((v) => v.id), ['c'])
console.log('نجح اختبار منظومة التفريغ التلقائي: 12 تحققاً')
