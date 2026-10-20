import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'

const source = readFileSync(new URL('../public/boot.js', import.meta.url), 'utf8')
function boot({ type = 'navigate', last = 0, blocked = false, reduced = false } = {}) {
  let now = 100000, removed = false, ready = false, observer
  const tasks = [], events = {}, classes = new Set(), splashClasses = new Set()
  const storage = { getItem: key => { if (blocked) throw Error('blocked'); return key === 'boot:splash-at' ? String(last) : null }, setItem: () => { if (blocked) throw Error('blocked') } }
  const splash = { classList: { add: value => splashClasses.add(value) }, remove: () => { removed = true } }
  const html = { classList: { add: value => classes.add(value), toggle() {}, remove() {} }, hasAttribute: () => ready }
  const document = { documentElement: html, querySelector: () => null, getElementById: id => id === 'boot-splash' && !removed ? splash : null, addEventListener: (event, callback) => { events[event] = callback } }
  const window = { location: { hostname: 'example.com' }, matchMedia: () => ({ matches: reduced }), setTimeout: (callback, delay) => tasks.push({ callback, at: now + delay }) }
  vm.runInNewContext(source, { window, document, navigator: {}, localStorage: storage, sessionStorage: storage, performance: { getEntriesByType: () => [{ type }] }, Date: { now: () => now }, MutationObserver: class { constructor(cb) { observer = cb } observe() {} disconnect() {} } })
  return { classes, splashClasses, removed: () => removed, ready: () => { ready = true; observer() }, parsed: () => events.DOMContentLoaded(), advance(ms) { const target = now + ms; while (true) { tasks.sort((a, b) => a.at - b.at); if (!tasks.length || tasks[0].at > target) break; const task = tasks.shift(); now = task.at; task.callback() } now = target } }
}
for (const reduced of [false, true]) {
  const page = boot({ reduced })
  page.advance(2000) // head assets must not consume the visible hold
  page.ready()
  page.parsed()
  page.advance((reduced ? 1000 : 1800) - 1)
  assert.equal(page.splashClasses.has('is-leaving'), false)
  page.advance(1)
  assert.equal(page.splashClasses.has('is-leaving'), true)
  page.ready() // duplicate ready notifications must be harmless
  page.advance(360)
  assert.equal(page.removed(), true)
}
const reload = boot({ type: 'reload', last: 99000 })
assert.equal(reload.classes.has('skip-boot-splash'), true)
reload.parsed()
assert.equal(reload.removed(), true)
assert.equal(boot({ type: 'navigate', last: 99000 }).classes.has('skip-boot-splash'), false)
assert.equal(boot({ type: 'reload', last: 80000 }).classes.has('skip-boot-splash'), false)
const privatePage = boot({ blocked: true })
privatePage.parsed(); privatePage.ready(); privatePage.advance(2160)
assert.equal(privatePage.removed(), true)
const failed = boot()
failed.parsed(); failed.advance(12000)
assert.equal(failed.removed(), true)
console.log('✓ Single boot splash: visible hold, reduced motion, reload, blocked storage, and timeout')
