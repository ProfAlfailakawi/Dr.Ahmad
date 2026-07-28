import assert from 'node:assert/strict'
import {
  decideGroundedResponse,
  findRuleMatch,
  normalizeArabicMessage,
  isWhatsAppWakePhrase,
  isInvalidBridgeRegression,
  stripArabicGreetings,
  whatsappPolicy,
} from '../src/server/whatsapp-controller.mjs'

assert.equal(normalizeArabicMessage('إلى مدرسةٍ ١٢ — جميلة'), 'الي مدرسه 12 جميله')
assert.equal(stripArabicGreetings('السلام عليكم ورحمة الله وبركاته، أبي الذكاء الاصطناعي'), 'ابي الذكاء الاصطناعي')
assert.equal(whatsappPolicy.manualTakeoverMinutes, null)
assert.equal(whatsappPolicy.manualTakeoverAutoResume, false)
assert.equal(whatsappPolicy.resumeMode, 'wake-phrase-only')
assert.equal(whatsappPolicy.zeroHallucination, true)
assert.equal(whatsappPolicy.paidAiApis, false)
assert.equal(isWhatsAppWakePhrase('موقع د. أحمد'), true)
assert.equal(isWhatsAppWakePhrase('مَوْقِع د. الفيلكاوي؟'), true)
for (const phrase of ['السلام عليكم', 'آخر مقالة', 'اسأل الدكتور', 'موقع أحمد', 'لا تفتح موقع د أحمد']) {
  assert.equal(isWhatsAppWakePhrase(phrase), false, `${phrase} must not wake the bot`)
}
assert.equal(isInvalidBridgeRegression({ instanceId: 'one', connected: true, status: 'connected' }, 'one', 'syncing'), true)
assert.equal(isInvalidBridgeRegression({ instanceId: 'one', connected: true, status: 'connected' }, 'two', 'syncing'), false)

const controllerSource = await import('node:fs').then(({ readFileSync }) => readFileSync(new URL('../src/server/whatsapp-controller.mjs', import.meta.url), 'utf8'))
assert.match(controllerSource, /runtime-resume/)
assert.match(controllerSource, /\\d\{5,30\}.*s\\\.whatsapp\\\.net/)
assert.match(controllerSource, /awaiting-wake-phrase/)
assert.doesNotMatch(controllerSource, /resumedAutomaticallyAt/)
assert.match(controllerSource, /mode: 'silent', wakeActive: false, wakeVersion: 1/)
assert.match(controllerSource, /resumes: 'wake-phrase-only'/)

const rules = [{
  id: 'hours',
  name: 'الدوام',
  keywords: ['مواعيد الدوام'],
  priority: 100,
  matchType: 'any',
  actionType: 'text',
  responseText: 'المواعيد المعتمدة هي: الأحد إلى الخميس.',
  enabled: true,
}]

assert.equal(findRuleMatch('هلا، مواعيد الدوم شنو؟', rules)?.id, 'hours')
assert.equal(decideGroundedResponse({ text: 'مواعيد الدوام', rules }).reply, rules[0].responseText)

const media = decideGroundedResponse({ text: 'شوف الملف', hasMedia: true })
assert.equal(media.kind, 'silent')
assert.equal(media.reason, 'media')

const human = decideGroundedResponse({ text: 'أبي أكلم موظف' })
assert.equal(human.kind, 'silent')
assert.equal(human.reason, 'human-request')

const price = decideGroundedResponse({ text: 'أبي قائمة الأسعار' })
assert.equal(price.kind, 'reply')
assert.match(price.reply, /dr-alfailakawi\.com/)
assert.doesNotMatch(price.reply, /\d+\s*(?:د\.ك|دينار)/)

const unknown = decideGroundedResponse({ text: 'كم يبلغ مخزون منتج غير موجود إطلاقاً؟' })
assert.equal(unknown.kind, 'silent')
assert.equal(unknown.reason, 'no-grounded-answer')

const archive = decideGroundedResponse({ text: 'الذكاء الاصطناعي في التعليم' })
assert.equal(archive.kind, 'reply')
assert.match(archive.reply, /https:\/\/dr-alfailakawi\.com\//)
assert.match(archive.reply, /من دون إضافة معلومات من خارجها/)

console.log('WhatsApp central policy: passed')
