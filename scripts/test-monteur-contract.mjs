import assert from 'node:assert/strict'
import { acceptStoryboard, sourceContains, orderedSourceWords, safeMonteurPhoto, MONTEUR_PROPS } from '../src/lib/monteur-storyboard.mjs'

const src = 'المعلم يدمج التكنولوجيا في التعليم ليصنع تجربة تعلم ذات معنى.'
const scene = { t: 'metaphor', prop: 'teacherai', src, l1: ['المعلم', 'يدمج'], l2: ['التكنولوجيا', 'في', 'التعليم'], em: 0, ann: 'under' }
const plan = (s = scene, extras = {}) => ({ theme: 'edtech', trio: ['يفهم', 'يصمم', 'يدمج'], quote: '', scenes: [s], ...extras })
assert.equal(acceptStoryboard(plan(), src).scenes.length, 1)
assert.equal(acceptStoryboard(plan({ ...scene, src: src.slice(0, 35) + ' ثم يضمن تفوق جميع الطلاب.' }), src).scenes.length, 0, 'reject a valid prefix with a fabricated tail')
assert.equal(acceptStoryboard(plan({ ...scene, src: 'نص قصير' }), src).scenes.length, 0, 'short claims still require proof')
assert.equal(sourceContains(src, 'المعلم يدمج التكنولوجيا'), true)
assert.equal(sourceContains(src, 'المعلم التكنولوجيا يدمج'), false)
assert.equal(orderedSourceWords(src, ['التعليم', 'المعلم']), false)
assert.equal(acceptStoryboard(plan({ ...scene, l1: ['التعليم'], l2: ['المعلم'] }), src).scenes.length, 0)
assert.equal(acceptStoryboard(plan(scene, { quote: 'كل الطلاب يتفوقون', opening: 'المعلم يدمج التكنولوجيا' }), src).quote, '')
assert.equal(acceptStoryboard(plan(scene, { opening: 'المعلم يدمج التكنولوجيا' }), src).opening, 'المعلم يدمج التكنولوجيا')
const neg = 'لا يحل الذكاء محل المعلم.'
assert.equal(acceptStoryboard(plan({ ...scene, src: neg, l1: ['يحل', 'الذكاء'], l2: ['محل', 'المعلم'] }), neg).scenes.length, 0)
const numeric = 'شارك 25 معلماً في البرنامج.'
assert.equal(acceptStoryboard(plan({ ...scene, t: 'counter', src: numeric, l1: ['شارك', '25'], l2: ['في', 'البرنامج'], value: 99 }), numeric).scenes.length, 0)
assert.equal(acceptStoryboard(plan({ ...scene, t: 'counter', src: numeric, l1: ['شارك', '25'], l2: ['في', 'البرنامج'], value: 25 }), numeric).scenes[0].value, 25)
const list = 'نقرأ النص ثم نفحص الدليل ثم نراجع النتيجة.'
assert.equal(acceptStoryboard(plan({ ...scene, t: 'flow', src: list, l1: ['نقرأ', 'النص'], l2: ['نراجع', 'النتيجة'], steps: ['نقرأ النص', 'نراجع النتيجة'] }), list).scenes.length, 1)
assert.equal(acceptStoryboard(plan({ ...scene, t: 'flow', src: list, l1: ['نقرأ', 'النص'], l2: ['نراجع', 'النتيجة'], steps: ['نراجع النتيجة', 'نقرأ النص'] }), list).scenes.length, 0)
assert.equal(safeMonteurPhoto('/covers/monteur-learning.png'), '/covers/monteur-learning.png')
for (const url of ['https://other.example/x.jpg', '/covers/../secret.png', '/covers/a.png" onload="alert(1)', '/portrait.jpg', 'javascript:alert(1)']) assert.equal(safeMonteurPhoto(url), '')
assert.equal(MONTEUR_PROPS.length, 72)
assert.equal(new Set(MONTEUR_PROPS).size, 72)
console.log('Monteur contract: Source integrity, numeric, ordering, negation, photo and specialist-vocabulary assertions passed.')
